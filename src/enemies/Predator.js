import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ktx2 } from '../engine/Ktx2.js';
import { assetUrl } from '../engine/Assets.js';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { Particles } from '../fx/Particles.js';

// The Predator (Part Seven): the violet light's entity, love with nothing to temper it. Its body is a
// downloaded wyvern (DM-913's "Prowler", CC BY; tools/build-props.mjs), rigged with its own skeleton and
// clips, given the violet here: its hide turned to amethyst with deep-violet bands, the membranes of its
// wings near-black with the red in them lit magenta, its mouth and eyes the gem's colour, and a rim of
// violet light round all of it (what it is, under the body it's taken).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let pending = null;
export function loadPredator() {
  return (pending ??= new GLTFLoader().setKTX2Loader(ktx2).loadAsync(assetUrl('models/props/predator.glb')));
}

const HIDE = /* glsl */ `
  vec3 c0 = diffuseColor.rgb;
  float l = dot(c0, vec3(0.299, 0.587, 0.114));
  pdRed = clamp((c0.r - max(c0.g, c0.b) * 1.25) * 9.0, 0.0, 1.0);          // the membranes' red patches
  float pink = clamp((c0.b - c0.g) * 10.0, 0.0, 1.0) * step(c0.g, c0.r);   // the mouth, the tongue
  float dark = 1.0 - smoothstep(0.012, 0.05, l);                           // membrane, claws, spines
  vec3 band = mix(uPdDeep, uPdPale, smoothstep(0.02, 0.2, l));
  vec3 col = mix(band, uPdDeep * 0.55, dark);
  col = mix(col, uPdLove * 0.7, pdRed);
  col = mix(col, uPdLove, pink);
  diffuseColor.rgb = col;
  pdDark = dark;
`;

function patchHide(mat, u) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uPdDeep, uPdPale, uPdLove, uPdRim; uniform float uPdGlow, uPdRimK;\nvoid main() {\n  float pdRed = 0.0, pdDark = 0.0;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + HIDE)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float pdRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uPdLove * (pdRed * 0.55 + pdDark * 0.05) * uPdGlow + uPdRim * pdRim * uPdRimK;`);
  };
  mat.customProgramCacheKey = () => 'predator-hide';
}

// The clips the fight plays, cut from the wyvern's two (`Walk`, and `Landing`: a glide in, a hover on
// beating wings, the drop to the ground), each in place (its root's travel taken out: the fight moves the
// body itself): [source, first frame, last frame] at the source's 24 frames a second
const CUTS = { walk: ['Walk', 0, 117], idle: ['Landing', 101, 105], land: ['Landing', 70, 105], hover: ['Landing', 34, 67], glide: ['Landing', 2, 14] };
const ROOT_TRACK = /^Root_Bone_\d+\.position$/;
const PIV = 2.4; // the pivot (pitch and roll, in flight and when struck) at the hips' height

// The entity's look, over the wyvern: { root, pivot, mixer, play(name), glow(k), bones, pose, update(dt) }.
// `root` stands on its lowest point whatever clip is playing (each clip's own ground is measured from its
// skin and taken out, blended by the clips' weights); `pose` holds the layers drawn over the clips.
export function createPredator(gltf) {
  const model = gltf.scene, root = new THREE.Group(), pivot = new THREE.Group();
  pivot.position.y = PIV;
  root.add(pivot);
  pivot.add(model);
  // (dark, so it reads against Zamaron's pale rose and violet: mid-violet, it went into the crystals)
  const u = {
    uPdDeep: { value: new THREE.Color(0.022, 0.005, 0.04) },
    uPdPale: { value: new THREE.Color(0.19, 0.06, 0.27) },
    uPdLove: { value: new THREE.Color(1.0, 0.1, 0.72) },
    uPdRim: { value: new THREE.Color(0.6, 0.12, 1.0) },
    uPdGlow: { value: 1.25 },
    uPdRimK: { value: 0.7 },
  };
  const bones = {};
  let skin = null, eyes = null;
  model.traverse((o) => {
    if (o.isBone) bones[o.name.replace(/_\d+$/, '')] ??= o;
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // (a skinned body's bounds are its bind pose: it flew out of them)
    const m = o.material;
    if (/Main_Material/.test(m.name)) {
      skin = o;
      m.roughness = Math.max(m.roughness, 0.55);
      m.emissive = new THREE.Color(0, 0, 0);
      patchHide(m, u);
    } else if (/Eye/.test(m.name)) {
      eyes = m;
      m.emissive = new THREE.Color(1.3, 0.25, 1.1);
      m.color.setRGB(0.5, 0.1, 0.45);
    }
  });
  const src = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  // the root bone held where the walk has it, so every clip shares one frame
  const rootRest = src.Walk.tracks.find((t) => ROOT_TRACK.test(t.name))?.values.slice(0, 3) ?? bones.Root_Bone.position.toArray();
  // every clip carries every bone: `subclip` drops a track with no key inside the cut (the exporter's
  // constant tracks have one key), and a bone with no track keeps whatever played before it (the standing
  // pose sank 0.6 m after the walk, measured one way and drawn another)
  const bind = new Map();
  model.traverse((o) => { if (o.isBone) bind.set(o.name, { position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray() }); });
  const names = new Set(gltf.animations.flatMap((c) => c.tracks.map((t) => t.name)));
  const clips = {};
  for (const [name, [from, a, b]] of Object.entries(CUTS)) {
    const s0 = src[from], c = THREE.AnimationUtils.subclip(s0, name, a, b, 24), have = new Set(c.tracks.map((t) => t.name));
    for (const n of names) {
      if (have.has(n)) continue;
      const [node, prop] = n.split('.'), st = s0.tracks.find((t) => t.name === n);
      const val = st ? Array.from(st.createInterpolant().evaluate(a / 24)) : bind.get(node)?.[prop];
      if (!val) continue;
      c.tracks.push(new (prop === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack)(n, [0], val));
    }
    for (const t of c.tracks) if (ROOT_TRACK.test(t.name)) for (let i = 0; i < t.values.length; i += 3) t.values.set(rootRest, i);
    clips[name] = c;
  }
  clips.hover2 = clips.hover.clone(); // (the hover, looped by a crossfade into a second copy of itself)
  clips.hover2.name = 'hover2';
  const mixer = new THREE.AnimationMixer(model);
  // each clip's ground: the lowest point of the skin over a few of its frames, under the model's origin
  const ground = {};
  const low = new THREE.Vector3();
  for (const [name, c] of Object.entries(clips)) {
    const act = mixer.clipAction(c);
    act.play();
    let m = Infinity;
    for (const k of [0, 0.33, 0.66, 1]) {
      act.time = k * c.duration * 0.999;
      mixer.update(0);
      root.updateMatrixWorld(true);
      skin.skeleton.update();
      const n = skin.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 2) { skin.getVertexPosition(i, low); model.worldToLocal(low.applyMatrix4(skin.matrixWorld)); m = Math.min(m, low.y); }
    }
    ground[name] = -m; // (in the model's own frame: the model is drawn at ground - PIV under the pivot, at PIV)
    act.stop();
    act.enabled = false; // (stop() leaves it enabled at full weight: it would have counted in `update`)
  }
  // the bones the layers turn: each put back to the pose the clip gave it before the mixer runs again, so
  // nothing gathers. (Back to the clip's pose, not the bind pose: the mixer writes a bone only when its
  // clip's value changes, and a held pose left the bones reset to bind under it.)
  const LAYERED = ['Spine', 'Torso', 'Neck', 'Head', 'Jaw1', 'TailBase', 'Tail2', 'Tail4', 'Tail6', 'ShoulderL', 'ShoulderR', 'Wing1L', 'Wing1R'];
  const rest = new Map(LAYERED.filter((n) => bones[n]).map((n) => [bones[n], bones[n].quaternion.clone()]));
  const pose = { rear: 0, lunge: 0, aimYaw: 0, aimPitch: 0, jaw: 0, tailLift: 0, tailSweep: 0, wings: 0, flap: 0, flapT: 0, shake: 0 };
  let current = null, loopPartner = null;
  const body = {
    root, pivot, model, mixer, clips, bones, u, pose, ground,
    get clip() { return current?.getClip().name; },
    // crossfade to a clip (`loop` false holds its last frame)
    play(name, { fade = 0.4, loop = true, speed = 1, from = 0 } = {}) {
      if (current?.getClip().name === name && current.isRunning() && loop) { current.timeScale = speed; return current; }
      const a = mixer.clipAction(clips[name]);
      a.reset();
      a.setLoop(loop && !/^hover/.test(name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.timeScale = speed;
      a.time = from;
      a.enabled = true;
      a.setEffectiveWeight(1);
      a.play();
      if (current && current !== a) current.crossFadeTo(a, fade, false);
      current = a;
      loopPartner = name === 'hover' ? 'hover2' : name === 'hover2' ? 'hover' : null;
      return a;
    },
    glow(k) { u.uPdGlow.value = 1.25 * k; u.uPdRimK.value = 0.7 * Math.max(0.6, k); if (eyes) eyes.emissiveIntensity = k; },
    update(dt) {
      for (const [b, q] of rest) b.quaternion.copy(q);
      // the hover, round again: into its twin a quarter second before its end (no seam to see)
      if (loopPartner && current && current.time > current.getClip().duration - 0.26) body.play(loopPartner, { fade: 0.25, speed: current.timeScale });
      mixer.update(dt);
      for (const [b, q] of rest) q.copy(b.quaternion);
      let w = 0, y = 0;
      for (const [name, clip] of Object.entries(clips)) {
        const a = mixer.existingAction(clip);
        const k = a?.enabled ? a.getEffectiveWeight() : 0; // (a clip held on its last frame still counts)
        w += k;
        y += k * ground[name];
      }
      model.position.y = (w > 0 ? y / w : 0) - PIV;
      layers(dt);
    },
  };

  // ---- the layers over the clips: about the creature's own axes in the world, so whatever way each
  // bone was rigged: `lat` its left (a turn about it by +a pitches the front down), `up`, `fwd`
  const Q = new THREE.Quaternion(), lat = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const turn = (bone, axis, a) => {
    if (!bone || Math.abs(a) < 1e-5) return;
    bone.parent.getWorldQuaternion(_pq);
    _q.setFromAxisAngle(axis, a);
    bone.quaternion.premultiply(_pq.clone().invert().multiply(_q).multiply(_pq));
    bone.updateMatrixWorld(true);
  };
  function layers(dt) {
    const B = bones, p = pose;
    root.updateMatrixWorld(true);
    pivot.getWorldQuaternion(Q);
    lat.set(1, 0, 0).applyQuaternion(Q);
    up.set(0, 1, 0).applyQuaternion(Q);
    fwd.set(0, 0, 1).applyQuaternion(Q);
    // rearing (the front up, from the spine: the hips carry the legs) and the lunge (the front driven
    // down and out)
    // (the lunge's reach is the body's slide: the front dips a little, the neck straightens out level so
    // the head goes forward, not into the ground)
    const r = p.rear * 0.8 - p.lunge * 0.25;
    turn(B.Spine, lat, -r * 0.22);
    turn(B.Torso, lat, -r * 0.2);
    turn(B.Neck, lat, -r * 0.18 - p.lunge * 0.22);
    turn(B.Head, lat, p.lunge * 0.12);
    // a shudder (struck, pinned, rocked)
    if (p.shake > 0.01) { const s = Math.sin(performance.now() * 0.045) * p.shake * 0.06; turn(B.Torso, fwd, s); turn(B.Neck, up, -s * 1.5); }
    // the head on what it's after: shared down the neck
    turn(B.Torso, up, p.aimYaw * 0.2);
    turn(B.Neck, up, p.aimYaw * 0.4);
    turn(B.Neck, lat, p.aimPitch * 0.45);
    turn(B.Head, up, p.aimYaw * 0.4);
    turn(B.Head, lat, p.aimPitch * 0.55);
    // the jaw, about the head's own side
    if (B.Jaw1 && p.jaw > 0.001) {
      const h = B.Head.getWorldPosition(_a), j = B.Jaw1.getWorldPosition(_b);
      const side = _c.subVectors(j, h).cross(up).normalize();
      if (side.lengthSq() > 0.5) turn(B.Jaw1, side, p.jaw * 0.75);
    }
    // the tail: lifted (the tell before it sweeps), and swept to a side
    // (it points back: a turn about its left by +a lifts it)
    turn(B.TailBase, lat, p.tailLift * 0.3);
    turn(B.Tail2, lat, p.tailLift * 0.25);
    turn(B.Tail4, lat, -p.tailLift * 0.2);
    for (const [n, k] of [['TailBase', 0.3], ['Tail2', 0.3], ['Tail4', 0.25], ['Tail6', 0.2]]) turn(B[n], up, p.tailSweep * k);
    // the wings raised over it (+1, the tell before a gust) or swept down (-), and beating (flap)
    p.flapT += dt * (2.2 + p.flap * 1.2);
    const beat = p.flap * Math.sin(p.flapT * Math.PI * 2) * 0.55;
    // (its left is +x: a turn about its forward line by +a lifts the left wing, -a the right)
    turn(B.ShoulderL, fwd, p.wings * 0.85 + beat);
    turn(B.ShoulderR, fwd, -(p.wings * 0.85 + beat));
    turn(B.Wing1L, up, -p.wings * 0.3);
    turn(B.Wing1R, up, p.wings * 0.3);
  }
  return body;
}

// ------------------------------------------------------------------------------------- the fight
// What it does, each with a tell, and how each is met (block, then strike):
//  bite   its head drawn back and up, the jaw opening, the eyes flaring; then the lunge. A parry throws its
//         head open (`exposed`): Carol's chance to pin it, and his.
//  tail   Hal at its side or behind it: the tail lifts and rattles, then it spins, the tail sweeping round
//         at shin height. Flight gets over it; a parry rocks it.
//  gust   the wings raised high, then brought down: a wind that tears a held shield out of his hand and
//         throws him back (its answer to a turtle, and to Hal hanging in its face). Only distance helps.
//  pounce from across the plaza: crouched, then a bound at him and the bite at the end of it.
// In the air (below AIR of its health): it circles over the citadel and
//  dive   rears in the air and screeches, a violet line run out to where he is; then falls on him. Parried,
//         it hits the plaza and lies there open.
//  tether a beam out of its mouth at Carol: love's hold, drawing her up to it. Get between them with the
//         shield up and it breaks (the Predator thrown open), or break its head off her (three blows);
//         let it finish and it drinks her light: stronger, and she's down a while.
// Its hide turns most of what lands between those (`stance`): turned blows are answered.
export const PRED = { health: 1400, air: 0.6, yieldAt: 0.2 };
const LANDS = { exposed: 0.65, pinned: 0.6, open: 0.35, guarded: 0.1 }; // (one parry and Carol's pin, seven hooks on the head: 45% of it, at 1 and 1.1)
const HEAD = 1.35; // blows on its head while it's open to them
const POISE = 75; // damage inside one of its attacks that rocks it out of it
const WALK = 3.0, CLIP_WALK = 2.6; // its stalk, and the speed the walk clip covers the ground at
const BITE = { wind: 0.85, quick: 0.5, strike: 0.3, reach: 6.0, lunge: 3.4, hit: 3.0, damage: 22, recover: 0.8 };
const TAIL = { wind: 0.8, sweep: 0.6, reach: 11, spin: 2.7, hit: 1.9, damage: 18, recover: 0.8 };
const GUST = { wind: 0.7, blow: 0.35, reach: 17, cone: 0.7, damage: 6, push: 15, recover: 0.7 };
const POUNCE = { wind: 0.75, leap: 0.65, near: 3.2, hit: 3.6, damage: 24, recover: 1.0 };
const DIVE = { wind: 1.0, speed: 30, hit: 3.4, damage: 26, recover: 1.1 };
const TETHER = { wind: 0.85, hold: 7, near: 5, breaks: 3, drink: 0.06, every: 22 }; // (it drank 12% each time, every 20 s: back to full)
const EXPOSE = 2.2, PIN = 2.8;
const COMMITTED = new Set(['bite', 'tail', 'gust', 'pounce', 'dive', 'tether']);

export class Predator {
  constructor({ scene, physics, powers, player, audio, director, engine, gltf, ground = () => 0, centre, radius = 30, avoid = [], ally = null }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, engine, ground, radius, avoid, ally });
    this.centre = centre.clone();
    const body = (this.body = createPredator(gltf));
    this.root = body.root;
    scene.add(this.root);
    this.root.position.copy(centre);
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.state = 'wait'; // wait | fight | script | down
    this.phase = 'ground'; // ground | air
    this.flying = false;
    this.alt = 0; // height over the plaza in flight
    this.action = null;
    this.cool = 1.8;
    this.clock = 0;
    this.stagger = this.exposed = this.pinned = 0;
    this.poise = 0;
    this.shielded = 0;
    this.lean = { pitch: 0, roll: 0 };
    this.onQuip = this.onHurtHal = this.onExposed = this.onPhase = this.onYield = this.onTether = null;
    body.play('idle', { fade: 0, loop: false });

    // its body for the ring to hit: three parts (head, body, tail), each a kinematic body whose capsules
    // follow its bones, each a target of its own sharing one health. Sensors: the character controller
    // walks through a sensor, and a kinematic capsule swung into Hal would have trapped him in it
    // (`push` below keeps him out of its body instead).
    this.health = PRED.health;
    const world = physics.world;
    const part = (name, segs, radius) => {
      const rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(centre.x, centre.y - 40, centre.z));
      const cols = segs.map(([, , r]) => world.createCollider(RAPIER.ColliderDesc.capsule(0.5, r).setSensor(true), rb));
      const me = this;
      const tg = {
        body: rb, collider: cols[0], position: new THREE.Vector3(), radius, part: name, alive: true,
        get health() { return me.health; }, set health(v) { me.health = v; },
        maxHealth: PRED.health,
        hit: (a, p, d, k) => this.hit(name, a, p, d, k),
        openState: () => this.openState(name),
      };
      physics.dynamics.push({ body: rb, mesh: new THREE.Object3D() }); // (the fist's and the hammer's impacts look for targets there)
      for (const c of cols) player.camIgnore?.add(c.handle);
      return { name, rb, cols, segs, tg };
    };
    // [from bone, to bone (or a point ahead of the head), radius]
    this.parts = [
      part('head', [['Head', 'snout', 0.75]], 1.25),
      part('body', [['Neck', 'Torso', 0.85], ['Torso', 'Spine', 1.05], ['Spine', 'Pelvis', 1.0]], 1.9),
      part('tail', [['TailBase', 'Tail3', 0.6], ['Tail3', 'Tail5', 0.45], ['Tail5', 'Tail7', 0.3]], 0.9),
    ];
    this.tg = this.parts[1].tg;

    // the tells: a violet line run out along the ground (the dive), the tether's beam; its breath, sparks
    const love = new THREE.Color(2.4, 0.35, 1.9), beamLove = new THREE.Color(1.3, 0.16, 1.05); // (the beam at the line's strength bloomed white)
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: love, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.line.renderOrder = 23;
    scene.add(this.line);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: beamLove, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.renderOrder = 24;
    this.beam.visible = false;
    scene.add(this.beam);
    this.fx = new Particles(1400, { additive: true, drag: 1.4, turbulence: 1.2 });
    scene.add(this.fx.points);
    this.mouthLight = new THREE.PointLight(0xd048ff, 0, 10, 2);
    scene.add(this.mouthLight);
  }

  get position() { return this.root.position; }
  get fraction() { return this.health / PRED.health; }
  get targets() { return this.parts.map((p) => p.tg); }

  engage() {
    this.state = 'fight';
    for (const t of this.targets) this.powers.addTarget(t);
    this.powers.watchers.add(this);
    this.cool = 1.6;
  }
  disengage(state = 'wait') {
    this.state = state;
    this.endAction();
    for (const t of this.targets) this.powers.removeTarget(t);
    this.powers.watchers.delete(this);
  }

  // ------------------------------------------------------------------------------- how blows land
  // 'exposed' (a parry threw it open), 'pinned' (Carol's crystal holding it down), 'open' (rocked, or inside
  // an attack's tell or its recovery), 'guarded' (its hide turns it: between attacks, and in the strike itself)
  stance() {
    if (this.pinned > 0) return 'pinned';
    if (this.exposed > 0) return 'exposed';
    if (this.stagger > 0) return 'open';
    const a = this.action;
    if (!a) return 'guarded';
    return a.phase === 'wind' || a.phase === 'recover' || a.phase === 'hold' ? 'open' : 'guarded';
  }
  openState(part) {
    if (this.state !== 'fight') return null;
    const s = this.stance();
    return s === 'exposed' || s === 'pinned' ? (part === 'head' ? 'exposed' : 'open') : s === 'open' ? 'open' : null;
  }

  hit(part, amount, point, dir, kind = 'hit') {
    if (this.state !== 'fight' || amount <= 0) return 0;
    // (one swing that reaches two of its parts lands once)
    if (kind !== 'gatling' && this.clock - (this.lastHitAt ?? -1) < 0.12 && kind === this.lastHitKind) return 0;
    this.lastHitAt = this.clock;
    this.lastHitKind = kind;
    const how = this.stance(), blow = kind === 'hook' || kind === 'hammer' || kind === 'sword' || kind === 'staff', hud = this.powers.hud;
    // a blow on it while it holds Carol: three and it lets her go
    const a = this.action;
    if (a?.kind === 'tether' && a.phase === 'hold') {
      a.cracks = (a.cracks ?? 0) + (kind === 'gatling' ? 0.12 : 1);
      if (a.cracks >= TETHER.breaks) this.breakTether(false);
    }
    let k = LANDS[how];
    if (how === 'guarded') {
      this.deflect(point, blow);
      if (!blow && kind !== 'blast') return 0;
      hud.callout('Turned', 'turned');
      this.answer();
    } else {
      if (part === 'head' && (how === 'exposed' || how === 'pinned')) { k *= HEAD; if (blow) hud.callout('Counter', 'counter'); }
      if (part === 'tail') k *= 0.6;
    }
    if (kind === 'gatling') k *= 0.45;
    const dealt = amount * k;
    this.hurt(dealt, point);
    // inside an attack, enough of it rocks it out
    if (how === 'open' && a && COMMITTED.has(a.kind) && (this.poise += dealt) >= POISE) {
      this.poise = 0;
      this.endAction();
      this.rock(1.1);
      this.onQuip?.('rocked');
    }
    return dealt;
  }
  // Carol's shards: little on its hide, more when it's open
  allyHit(amount, point) {
    if (this.state !== 'fight') return 0;
    const how = this.stance(), k = how === 'guarded' ? 0.15 : how === 'open' ? 0.5 : 1;
    this.hurt(amount * k, point, true);
    return amount * k;
  }
  hurt(amount, point, quiet = false) {
    if (amount <= 0) return;
    this.health = Math.max(1, this.health - amount);
    this.body.pose.shake = Math.min(1, this.body.pose.shake + amount / 40);
    if (point && !quiet) this.sparks(point, Math.min(40, 8 + amount));
    if (amount > 30) this.onQuip?.('hurt');
    this.check();
  }
  check() {
    if (this.state !== 'fight') return;
    if (this.fraction <= PRED.yieldAt) { this.disengage('down'); this.onYield?.(); return; }
    if (this.phase === 'ground' && this.fraction <= PRED.air) { this.phase = 'air'; this.wantAir = true; this.onPhase?.('air'); }
  }

  // a turned blow: it answers, at once, unless it's already coming
  answer() {
    if (this.action || this.clock < (this.answered ?? 0) || this.stagger > 0) return;
    this.answered = this.clock + 1.6;
    const s = this.sense();
    if (this.flying) return;
    if (s.behind && s.d < TAIL.reach) this.begin('tail', { quick: true });
    else if (s.up > 5 || s.d < 5) this.begin('gust', { quick: true });
    else if (s.headD < BITE.reach + 1) this.begin('bite', { quick: true });
  }

  // thrown open: its head flung up and back, a long moment before it gathers itself
  expose(dur = EXPOSE) {
    this.endAction();
    this.exposed = Math.max(this.exposed, dur);
    this.stagger = Math.max(this.stagger, dur);
    this.poise = 0;
    this.vel.multiplyScalar(0.2);
    this.body.pose.shake = 1;
    this.roar(0.8, 1.25);
    this.onExposed?.(this);
  }
  rock(dur) {
    this.stagger = Math.max(this.stagger, dur);
    this.body.pose.shake = 1;
    this.roar(0.5, 1.1);
  }
  // Carol's crystal on it (the ally, when it's open): held down, open, a while longer
  pin(dur = PIN) {
    if (this.state !== 'fight') return;
    this.pinned = Math.max(this.pinned, dur);
    this.exposed = Math.max(this.exposed, 0.2);
    this.stagger = Math.max(this.stagger, dur);
    this.endAction();
    if (this.flying) this.fall();
  }

  deflect(point, heavy) {
    if (!point) return;
    if (heavy && this.clock - (this.lastClank ?? -1) > 0.1) { this.lastClank = this.clock; this.audio.turned?.(1.1); }
    this.sparks(point, 6, true);
  }
  sparks(at, n, dim = false) {
    this.fx.emit(n, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 6; }, { life: 0.45, size: [dim ? 0.06 : 0.1, 0], color: dim ? [[1.6, 0.5, 1.4, 1], [0.4, 0.05, 0.3, 0]] : [[3.2, 0.9, 2.6, 1], [0.8, 0.1, 0.6, 0]] });
  }
  roar(peak = 0.8, pitch = 1) {
    const A = this.audio;
    A.tone?.({ type: 'sawtooth', freq: 130 * pitch, to: 62 * pitch, attack: 0.08, peak: 0.08 * peak, dur: 1.1, wet: 0.5 });
    A.tone?.({ type: 'square', freq: 196 * pitch, to: 90 * pitch, attack: 0.12, peak: 0.035 * peak, dur: 1.0, wet: 0.5, detune: 24 });
    A.tone?.({ type: 'sine', freq: 880 * pitch, to: 520 * pitch, attack: 0.05, peak: 0.02 * peak, dur: 0.8, wet: 0.6 });
    A.burst?.({ buffer: A.brownBuf, type: 'lowpass', from: 900, to: 180, attack: 0.06, peak: 0.4 * peak, dur: 1.0, wet: 0.35 });
  }
  hiss(peak = 0.5) {
    const A = this.audio;
    A.burst?.({ buffer: A.whiteBuf ?? A.brownBuf, type: 'bandpass', from: 3200, to: 1800, attack: 0.25, peak: 0.18 * peak, dur: 0.8, wet: 0.3 });
    A.tone?.({ type: 'sine', freq: 300, to: 700, attack: 0.4, peak: 0.03 * peak, dur: 0.8, wet: 0.5 });
  }

  // ---------------------------------------------------------------------------------- where things are
  bone(name, out) { return this.body.bones[name].getWorldPosition(out); }
  // the end of its snout: a point fixed in the head's own frame (taken off the jaw's line in its standing
  // pose; off the jaw's line as it moves, an open jaw put the snout in the plaza)
  snout(out) {
    const B = this.body.bones;
    if (!this.snoutLocal) {
      // (in the head's own units, at its full size: the first frame can find it small, in the battery)
      const j = B.Head.worldToLocal(B.Jaw1.getWorldPosition(_a)), t = B.Head.worldToLocal(B.Tongue3.getWorldPosition(_b));
      const unit = B.Head.getWorldScale(_c).x / this.root.scale.x;
      this.snoutLocal = t.sub(j).setLength(1.7 / unit).add(j).clone();
    }
    return B.Head.localToWorld(out.copy(this.snoutLocal));
  }
  head(out) { return this.bone('Head', out); }
  mouth(out) { this.snout(out); return out.lerp(this.bone('Jaw2', _c), 0.45); }
  // what it knows about Hal: distance (to its body's line, and to its head), height over the ground, which
  // side of it he's on
  sense() {
    const hal = this.player.position, me = this.root.position;
    const d = Math.hypot(hal.x - me.x, hal.z - me.z);
    this.head(_d);
    const headD = Math.hypot(hal.x - _d.x, hal.z - _d.z);
    const want = Math.atan2(hal.x - me.x, hal.z - me.z), ang = wrap(want - this.yaw);
    return { d, headD, ang, behind: Math.abs(ang) > 1.75, up: hal.y - this.ground(hal.x, hal.z), want };
  }

  // ------------------------------------------------------------------------------------- update
  update(dt, t) {
    if (dt <= 0) return;
    this.clock += dt;
    for (const k of ['stagger', 'exposed', 'pinned']) this[k] = Math.max(0, this[k] - dt);
    const R = this.powers, pose = this.body.pose;
    this.shielded = R.shield && !R.shield.ending ? this.shielded + dt : 0;
    if (this.state === 'fight') this.think(dt);
    this.move(dt);
    // the head on what it's after (Hal, or Carol in its beam), gently
    const tgt = this.lookAt?.() ?? (this.state === 'fight' || this.state === 'script' ? this.player.position : null);
    if (tgt && this.exposed <= 0) {
      this.head(_a);
      const dx = tgt.x - _a.x, dz = tgt.z - _a.z, dy = (tgt.y + 1.2) - _a.y;
      const yaw = clamp(wrap(Math.atan2(dx, dz) - this.yaw), -0.9, 0.9), pitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.5);
      pose.aimYaw = damp(pose.aimYaw, yaw, 4, dt);
      pose.aimPitch = damp(pose.aimPitch, pitch, 4, dt);
    } else { pose.aimYaw = damp(pose.aimYaw, 0, 3, dt); pose.aimPitch = damp(pose.aimPitch, this.exposed > 0 ? -0.5 : 0, 3, dt); }
    // thrown open, pinned: head up and back, the jaw slack, shuddering
    const open = Math.max(Math.min(1, this.exposed * 2), Math.min(1, this.pinned * 2));
    if (!this.action) {
      pose.rear = damp(pose.rear, open ? (this.pinned > 0 ? -0.5 : 0.8) : 0, 4, dt);
      pose.jaw = damp(pose.jaw, open ? 0.45 : 0, 5, dt);
      pose.lunge = damp(pose.lunge, 0, 5, dt);
      pose.tailLift = damp(pose.tailLift, 0, 4, dt);
      pose.tailSweep = damp(pose.tailSweep, Math.sin(this.clock * 0.9) * 0.25, 2, dt);
      pose.wings = damp(pose.wings, open && this.pinned <= 0 ? 0.5 : 0, 3, dt);
    }
    pose.shake = Math.max(this.pinned > 0 ? 0.6 : 0, pose.shake - dt * 1.8);
    pose.flap = damp(pose.flap, this.flying ? (this.gliding ? 0.15 : 1) * 0.35 : 0, 3, dt);
    this.animate(dt);
    this.body.update(dt);
    this.sync();
    this.push();
    this.fx.update(dt, t, this.engine?.camera, this.engine?.renderer);
    this.mouthLight.intensity = damp(this.mouthLight.intensity, this.action?.glow ?? 0, 8, dt);
    if (this.mouthLight.intensity > 0.01) this.mouth(this.mouthLight.position);
  }

  // which clip: on the ground the walk (by its speed) or standing; in the air the hover or, moving fast,
  // the glide
  animate(dt) {
    const b = this.body, sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.scripted) return;
    if (this.flying) {
      this.gliding = sp > 11 && !this.action;
      const want = this.gliding ? 'glide' : 'hover';
      if (b.clip !== want && !(want === 'hover' && b.clip === 'hover2')) b.play(want, { fade: 0.6 });
    } else if (sp > 0.4 || Math.abs(this.turning ?? 0) > 0.5) {
      b.play('walk', { fade: 0.5, speed: clamp(Math.max(sp, Math.abs(this.turning ?? 0) * 3) / CLIP_WALK, 0.4, 1.8) });
    } else if (b.clip !== 'idle' && b.clip !== 'land') b.play('idle', { fade: 0.6, loop: false });
  }

  // its body round the plaza: walking (inside the arena, off the dais), or in flight at its height
  move(dt) {
    const p = this.root.position;
    if (this.scripted) { this.root.rotation.y = this.yaw; return; } // (a cutscene has it: it puts the body where it goes)
    p.x += this.vel.x * dt; // (its height is the ground's, or its flight's: `alt`)
    p.z += this.vel.z * dt;
    const lim = this.flying ? this.radius + 10 : this.radius;
    _a.set(p.x - this.centre.x, 0, p.z - this.centre.z);
    this.atEdge = _a.length() > lim - 0.5;
    if (_a.length() > lim) { _a.setLength(lim); p.x = this.centre.x + _a.x; p.z = this.centre.z + _a.z; }
    if (!this.flying) for (const b of this.avoid) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r) { p.x = b.x + (dx / (d || 1)) * b.r; p.z = b.z + (dz / (d || 1)) * b.r; }
    }
    const g = this.ground(p.x, p.z);
    if (this.flying) p.y = damp(p.y, g + this.alt, this.action?.kind === 'dive' && this.action.phase === 'dive' ? 30 : 2.2, dt);
    else if (!this.leaping) p.y = damp(p.y, g, 10, dt);
    // facing: what it's after, unless an attack has locked its line
    const a = this.action, want = a?.lock ?? (this.state === 'fight' ? this.sense().want : this.faceYaw ?? this.yaw);
    const rate = a?.spin ? 0 : this.flying ? 1.3 : this.stagger > 0 ? 0.4 : 1.5;
    const step = clamp(wrap(want - this.yaw), -rate * dt, rate * dt);
    this.turning = step / dt;
    this.yaw = wrap(this.yaw + step);
    this.root.rotation.y = this.yaw;
    // banked into its turns in flight, pitched by its climb
    const climb = this.flying ? clamp(-this.vel.y * 0.03, -0.5, 0.6) : 0;
    this.lean.pitch = damp(this.lean.pitch, climb, 3, dt);
    this.lean.roll = damp(this.lean.roll, this.flying ? clamp(-this.turning * 0.35, -0.5, 0.5) : 0, 3, dt);
    this.body.pivot.rotation.set(this.lean.pitch, 0, this.lean.roll);
  }

  // its parts' bodies and capsules onto its bones; the targets on the nearest point of each part to Hal
  sync() {
    const hal = _e.copy(this.player.position).add(_up12);
    for (const pt of this.parts) {
      let best = Infinity;
      const segs = pt.segs.map(([a, b]) => [this.bone(a, new THREE.Vector3()), b === 'snout' ? this.snout(new THREE.Vector3()) : this.bone(b, new THREE.Vector3())]);
      const c0 = _f.copy(segs[0][0]).lerp(segs[segs.length - 1][1], 0.5);
      pt.rb.setNextKinematicTranslation({ x: c0.x, y: c0.y, z: c0.z });
      segs.forEach(([a, b], i) => {
        const col = pt.cols[i], len = a.distanceTo(b), r = pt.segs[i][2];
        col.setHalfHeight?.(Math.max(0.05, len / 2 - r * 0.5));
        _g.lerpVectors(a, b, 0.5).sub(c0);
        col.setTranslationWrtParent({ x: _g.x, y: _g.y, z: _g.z });
        _q.setFromUnitVectors(_Y, _h.subVectors(b, a).normalize());
        col.setRotationWrtParent({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
        const q = closest(hal, a, b, _h);
        const dd = q.distanceTo(hal);
        if (dd < best) { best = dd; pt.tg.position.copy(q); }
      });
      pt.near = best;
    }
  }
  // Hal kept out of its body (its capsules are sensors): pushed out along the shortest way, from under its
  // chest (the spine's line is high: he stood under it, between its forelimbs), its head, its forelimbs
  push() {
    if (this.state === 'wait' || !this.root.visible) return;
    const P = this.player, hal = _e.copy(P.position).add(_up12);
    let best = Infinity;
    const test = (a, b, r) => {
      const q = closest(hal, a, b, _g), d = q.distanceTo(hal);
      if (d < r && d - r < best) { best = d - r; _f.copy(q); }
    };
    test(this.bone('Neck', _b), this.bone('Pelvis', _c), 2.1);
    test(this.bone('Head', _b), this.snout(_c), 1.1);
    for (const sd of ['L', 'R']) {
      test(this.bone('Wing1' + sd, _b), this.bone('Wing2' + sd, _c), 0.9);
      test(this.bone('Wing2' + sd, _b), this.bone('Hand' + sd, _c), 0.8);
    }
    if (best >= 0) return;
    _a.subVectors(hal, _f);
    if (!P.flying) _a.y = 0;
    if (_a.lengthSq() < 1e-4) _a.set(Math.sin(this.yaw + Math.PI / 2), 0, Math.cos(this.yaw + Math.PI / 2));
    this.knock(_a.normalize(), 6, 0.12);
  }
  knock(dir, speed, dur = 0.3) {
    const P = this.player;
    if (P.flying && P.vel) P.vel.addScaledVector(dir, speed);
    else P.dash?.(dir.clone().setY(0).normalize(), speed, dur);
  }

  // ---------------------------------------------------------------------------------- choosing
  think(dt) {
    const P = this.player, s = this.sense();
    if (this.action) { this.runAction(dt, s); return; }
    if (this.stagger > 0 || this.pinned > 0) { this.vel.multiplyScalar(Math.max(0, 1 - dt * 4)); return; }
    this.poise = 0;
    if (this.wantAir) { this.wantAir = false; this.begin('rise'); return; }
    if (this.flying) { this.thinkAir(dt, s); return; }
    // stalking him: in to biting range, round him a little, backing off if he's under its chin
    const toHal = _a.set(P.position.x - this.root.position.x, 0, P.position.z - this.root.position.z).normalize();
    const pace = s.headD > BITE.reach - 0.5 ? WALK : s.headD < 3.5 ? -1.2 : 0;
    this.vel.lerp(_b.copy(toHal).multiplyScalar(pace), Math.min(1, dt * 2));
    this.cool -= dt;
    if (!P.control && this.cool > 0.4) this.cool = 0.4;
    if (this.cool > 0) return;
    const turtle = this.shielded > 1.4, r = Math.random();
    if (s.behind && s.d < TAIL.reach) this.begin('tail');
    else if ((turtle || s.up > 6) && s.d < GUST.reach && Math.abs(s.ang) < 1.2) this.begin('gust');
    else if (s.headD < BITE.reach && Math.abs(s.ang) < 0.6) this.begin(r < 0.15 ? 'gust' : 'bite');
    else if (s.headD > BITE.reach + 0.5 && s.headD < 26 && s.up < 3 && Math.abs(s.ang) < 0.5 && (r < 0.5 || this.atEdge)) this.begin('pounce'); // (at its arena's edge it can't walk in: no waiting out a gap)
    else this.cool = 0.3;
  }

  // in the air: round the citadel at its height, falling on him or reaching for her
  thinkAir(dt, s) {
    const P = this.player, me = this.root.position;
    this.orbit = (this.orbit ?? Math.atan2(me.x - this.centre.x, me.z - this.centre.z)) + dt * 0.32;
    const goal = _a.set(this.centre.x + Math.sin(this.orbit) * 22, 0, this.centre.z + Math.cos(this.orbit) * 22);
    this.alt = 15 + Math.sin(this.clock * 0.4) * 3;
    _b.subVectors(goal, me).setY(0);
    this.vel.lerp(_b.multiplyScalar(0.9).clampLength(0, 14), Math.min(1, dt * 1.5));
    this.cool -= dt;
    if (this.cool > 0) return;
    const carol = this.ally;
    if (carol?.canTether?.() && this.clock - (this.lastTether ?? -99) > TETHER.every && Math.random() < 0.35) this.begin('tether');
    else this.begin('dive');
  }

  begin(kind, opts = {}) {
    if (this.action) this.endAction();
    const a = (this.action = { kind, phase: 'wind', t: 0, glow: 0, ...opts });
    this.poise = 0;
    if (kind === 'bite') { this.hiss(0.8); this.onQuip?.('bite'); }
    else if (kind === 'tail') {
      // it turns its side to him, the way the tail will come round
      const s = this.sense();
      a.dir = s.ang > 0 ? -1 : 1;
      a.lock = this.yaw;
      this.audio.tone?.({ type: 'square', freq: 40, to: 70, attack: 0.3, peak: 0.04, dur: 0.8, wet: 0.3 });
      this.onQuip?.('tail');
    } else if (kind === 'gust') { this.roar(0.9, 0.9); this.onQuip?.('gust'); }
    else if (kind === 'pounce') { a.lock = this.yaw; this.hiss(1); a.from = this.root.position.clone(); }
    else if (kind === 'rise') { this.roar(1, 0.85); a.lock = null; }
    else if (kind === 'dive') { this.roar(1.1, 1.3); this.onQuip?.('dive'); }
    else if (kind === 'tether') { this.lastTether = this.clock; this.onQuip?.('tether'); this.hiss(1.2); }
  }

  endAction() {
    const a = this.action;
    this.action = null;
    this.leaping = false;
    this.line.material.opacity = 0;
    if (a?.kind === 'tether') this.releaseTether();
    this.cool = Math.max(this.cool, 0.6);
  }

  runAction(dt, s) {
    const a = this.action, P = this.player, R = this.powers, pose = this.body.pose, me = this.root.position;
    a.t += dt;
    const k = (d) => clamp(a.t / d);
    if (a.kind === 'bite') {
      const wind = a.quick ? BITE.quick : BITE.wind;
      if (a.phase === 'wind') {
        // drawn back and up, the jaw open, the eyes and the mouth lit: the tell
        const back = _a.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.vel.lerp(back.multiplyScalar(a.t < wind * 0.6 ? 0.9 : 0), Math.min(1, dt * 8));
        pose.rear = damp(pose.rear, 1.4, 6, dt);
        pose.jaw = damp(pose.jaw, 0.65, 6, dt);
        pose.wings = damp(pose.wings, 0.15, 4, dt);
        a.glow = 6 * k(wind);
        this.body.glow(1 + k(wind) * 0.9);
        if (a.t > wind) {
          a.phase = 'strike'; a.t = 0;
          a.lock = this.yaw;
          a.at = _e.copy(P.position).add(_up12).clone();
          if (P.flying && P.vel) a.at.addScaledVector(P.vel, 0.2);
          this.snout(_a);
          a.reach = clamp(Math.hypot(a.at.x - _a.x, a.at.z - _a.z) - 0.6, 0.5, BITE.lunge);
          a.from = me.clone();
          this.vel.set(0, 0, 0);
          this.leaping = true; // (a low hop: all four feet off the plaza while it goes, none sliding on it)
          this.audio.whoosh?.(0.4, 0.5);
        }
      } else if (a.phase === 'strike') {
        pose.rear = damp(pose.rear, 0.15, 14, dt);
        pose.lunge = damp(pose.lunge, 1, 16, dt);
        pose.jaw = damp(pose.jaw, 1, 18, dt);
        pose.wings = damp(pose.wings, 0.3, 10, dt);
        const e = clamp(a.t / BITE.strike);
        me.copy(a.from).addScaledVector(_a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), a.reach * (1 - (1 - e) * (1 - e)));
        me.y = this.ground(me.x, me.z) + Math.sin(Math.PI * e) * 0.45;
        this.snout(_b);
        if (!a.done && (a.t > BITE.strike || _b.distanceTo(a.at) < 1.2)) {
          a.done = true;
          pose.jaw = 0;
          this.audio.crunch?.(1.2);
          this.contact(_b, BITE.hit, BITE.damage, 'bite');
        }
        if (a.t > BITE.strike + 0.05) { a.phase = 'recover'; a.t = 0; this.vel.set(0, 0, 0); this.leaping = false; this.body.glow(1); }
      } else if (a.phase === 'recover') {
        a.glow = 0;
        pose.lunge = damp(pose.lunge, 0, 4, dt);
        pose.rear = damp(pose.rear, 0, 4, dt);
        pose.jaw = damp(pose.jaw, 0, 5, dt);
        pose.wings = damp(pose.wings, 0, 4, dt);
        if (a.t > BITE.recover) { this.endAction(); this.cool = 0.8 + Math.random() * 0.9; }
      }
    } else if (a.kind === 'tail') {
      const wind = a.quick ? 0.5 : TAIL.wind;
      if (a.phase === 'wind') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
        pose.tailLift = damp(pose.tailLift, 1, 5, dt);
        pose.tailSweep = damp(pose.tailSweep, -a.dir * 0.6, 4, dt);
        pose.rear = damp(pose.rear, 0.3, 4, dt);
        if (Math.random() < dt * 14) this.audio.tick?.();
        if (a.t > wind) { a.phase = 'sweep'; a.t = 0; a.spun = 0; a.spin = true; this.audio.whoosh?.(0.6, 0.7); }
      } else if (a.phase === 'sweep') {
        const w = (TAIL.spin / TAIL.sweep) * a.dir;
        this.yaw = wrap(this.yaw + w * dt);
        a.lock = this.yaw;
        a.spun += Math.abs(w * dt);
        pose.tailSweep = damp(pose.tailSweep, a.dir * 0.9, 10, dt);
        pose.tailLift = damp(pose.tailLift, -0.2, 8, dt);
        // the tail's line against him, at his shins to his chest
        const tail = this.parts[2];
        if (!a.done && tail.near < TAIL.hit && P.position.y - this.ground(P.position.x, P.position.z) < 2.6) {
          a.done = true;
          this.contact(tail.tg.position.clone(), 99, TAIL.damage, 'tail');
        }
        if (a.t > TAIL.sweep) { a.phase = 'recover'; a.t = 0; a.spin = false; }
      } else if (a.phase === 'recover') {
        pose.tailSweep = damp(pose.tailSweep, 0, 3, dt);
        pose.tailLift = damp(pose.tailLift, 0, 3, dt);
        pose.rear = damp(pose.rear, 0, 3, dt);
        if (a.t > TAIL.recover) { this.endAction(); this.cool = 0.7 + Math.random() * 0.8; }
      }
    } else if (a.kind === 'gust') {
      const wind = a.quick ? 0.45 : GUST.wind;
      if (a.phase === 'wind') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
        pose.wings = damp(pose.wings, 1, 6, dt);
        pose.rear = damp(pose.rear, 0.7, 5, dt);
        if (a.t > wind) { a.phase = 'blow'; a.t = 0; this.audio.whoosh?.(1.2, 0.9); this.audio.rumble?.(0.6, 0.4); this.director.shake(0.25, 0.4); this.gust(); }
      } else if (a.phase === 'blow') {
        pose.wings = damp(pose.wings, -0.5, 16, dt);
        pose.rear = damp(pose.rear, 0.2, 8, dt);
        if (a.t > GUST.blow) { a.phase = 'recover'; a.t = 0; }
      } else if (a.phase === 'recover') {
        pose.wings = damp(pose.wings, 0, 3, dt);
        pose.rear = damp(pose.rear, 0, 3, dt);
        if (a.t > GUST.recover) { this.endAction(); this.cool = 0.9 + Math.random() * 0.8; }
      }
    } else if (a.kind === 'pounce') {
      if (a.phase === 'wind') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
        pose.rear = damp(pose.rear, -0.35, 5, dt);
        pose.tailLift = damp(pose.tailLift, 0.8, 4, dt);
        pose.jaw = damp(pose.jaw, 0.3, 4, dt);
        a.lock = s.want;
        a.glow = 4 * k(POUNCE.wind);
        if (a.t > POUNCE.wind) {
          a.phase = 'leap'; a.t = 0;
          a.from = me.clone();
          // to just short of him: its head ends where he is
          this.head(_a);
          const reach = _a.sub(me).setY(0).length();
          _b.set(P.position.x - me.x, 0, P.position.z - me.z);
          const dist = Math.max(0, _b.length() - reach - POUNCE.near * 0.3);
          a.to = me.clone().addScaledVector(_b.normalize(), dist);
          // (inside its arena: landed outside it, it snapped back)
          _c.set(a.to.x - this.centre.x, 0, a.to.z - this.centre.z);
          if (_c.length() > this.radius) { _c.setLength(this.radius); a.to.x = this.centre.x + _c.x; a.to.z = this.centre.z + _c.z; }
          this.leaping = true;
          this.audio.whoosh?.(0.8, 0.8);
        }
      } else if (a.phase === 'leap') {
        const e = clamp(a.t / POUNCE.leap);
        me.lerpVectors(a.from, a.to, e);
        me.y = this.ground(me.x, me.z) + Math.sin(Math.PI * e) * 2.6;
        this.vel.set(0, 0, 0);
        pose.rear = damp(pose.rear, 0.2, 8, dt);
        pose.jaw = damp(pose.jaw, 1, 8, dt);
        pose.wings = damp(pose.wings, 0.6, 6, dt);
        if (e >= 1) {
          this.leaping = false;
          this.snout(_b);
          pose.jaw = 0;
          this.audio.impact?.(1.2);
          this.director.shake(0.4, 0.4);
          this.contact(_b, POUNCE.hit, POUNCE.damage, 'pounce');
          a.phase = 'recover'; a.t = 0;
        }
      } else if (a.phase === 'recover') {
        a.glow = 0;
        pose.rear = damp(pose.rear, 0, 3, dt);
        pose.wings = damp(pose.wings, 0, 3, dt);
        pose.tailLift = damp(pose.tailLift, 0, 3, dt);
        if (a.t > POUNCE.recover) { this.endAction(); this.cool = 0.8 + Math.random() * 0.8; }
      }
    } else if (a.kind === 'rise') {
      // up off the plaza on its wings
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
      pose.wings = damp(pose.wings, a.t < 0.6 ? 1 : 0, 5, dt);
      if (a.t > 0.6 && !this.flying) { this.flying = true; this.alt = 0.5; this.audio.whoosh?.(1.6, 0.8); this.director.shake(0.2, 0.5); }
      if (this.flying) this.alt = damp(this.alt, 16, 1.2, dt);
      if (a.t > 3.2) { this.endAction(); this.cool = 1.2; }
    } else if (a.kind === 'dive') {
      if (a.phase === 'wind') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
        pose.rear = damp(pose.rear, 1, 5, dt);
        pose.jaw = damp(pose.jaw, 0.6, 5, dt);
        a.glow = 8 * k(DIVE.wind);
        this.body.glow(1 + k(DIVE.wind));
        // the line out along the ground to where he is
        const at = P.position;
        this.line.position.set(me.x, this.ground(me.x, me.z) + 0.06, me.z);
        const dx = at.x - me.x, dz = at.z - me.z, L = Math.hypot(dx, dz);
        this.line.rotation.set(0, Math.atan2(dx, dz), 0);
        this.line.scale.set(1.4, 1, Math.max(1, L));
        this.line.material.opacity = Math.min(0.75, a.t * 1.6) * (0.6 + 0.4 * Math.sin(a.t * 22));
        if (a.t > DIVE.wind) {
          a.phase = 'dive'; a.t = 0;
          a.at = _e.copy(P.position).add(_up12).clone();
          if (P.flying && P.vel) a.at.addScaledVector(P.vel, 0.25);
          this.head(_a);
          a.dir = a.at.clone().sub(_a).normalize();
          a.lock = Math.atan2(a.dir.x, a.dir.z);
          this.line.material.opacity = 0;
          this.audio.whoosh?.(1.0, 1.0);
          this.body.glow(1);
        }
      } else if (a.phase === 'dive') {
        pose.rear = damp(pose.rear, -0.5, 10, dt);
        pose.wings = damp(pose.wings, -0.6, 8, dt);
        pose.jaw = damp(pose.jaw, 1, 10, dt);
        // (bending toward him a little as it comes: a sharp sidestep still gets out from under it)
        const chest = _e.copy(P.position).add(_up12);
        a.at.lerp(chest, Math.min(1, dt * 2.5));
        this.head(_a);
        a.dir.lerp(_c.subVectors(a.at, _a).normalize(), Math.min(1, dt * 4)).normalize();
        a.lock = Math.atan2(a.dir.x, a.dir.z);
        this.vel.copy(a.dir).multiplyScalar(DIVE.speed);
        this.alt = Math.max(1.5, this.alt + a.dir.y * DIVE.speed * dt);
        this.snout(_b);
        // met at its closest pass (or on him, or the ground, or late)
        const near = _b.distanceTo(chest), passing = a.near != null && near > a.near + 0.05 && a.near < 7;
        a.near = Math.min(a.near ?? Infinity, near);
        if (!a.done && (near < DIVE.hit || passing || a.t > 1.4 || this.alt <= 1.6)) {
          a.done = true;
          this.audio.crunch?.(1.4);
          pose.jaw = 0;
          this.contact(_b, DIVE.hit, DIVE.damage, 'dive');
          if (this.action === a) { a.phase = 'recover'; a.t = 0; }
        }
      } else if (a.phase === 'recover') {
        a.glow = 0;
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 2));
        this.alt = damp(this.alt, 14, 1.5, dt);
        pose.rear = damp(pose.rear, 0, 3, dt);
        pose.wings = damp(pose.wings, 0, 3, dt);
        pose.jaw = damp(pose.jaw, 0, 4, dt);
        if (a.t > DIVE.recover) { this.endAction(); this.cool = 1.6 + Math.random() * 1.2; }
      }
    } else if (a.kind === 'tether') {
      const carol = this.ally;
      if (!carol) { this.endAction(); return; }
      this.lookAt = () => carol.position;
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
      this.alt = damp(this.alt, 12, 1, dt);
      a.lock = Math.atan2(carol.position.x - me.x, carol.position.z - me.z);
      if (a.phase === 'wind') {
        pose.jaw = damp(pose.jaw, 0.9, 4, dt);
        pose.rear = damp(pose.rear, 0.5, 4, dt);
        a.glow = 10 * k(TETHER.wind);
        if (a.t > TETHER.wind) { a.phase = 'hold'; a.t = 0; carol.tethered?.(this); this.beam.visible = true; this.audio.rift?.(0.5); this.onTether?.('start'); }
      } else if (a.phase === 'hold') {
        a.glow = 9 + Math.sin(a.t * 20) * 3;
        this.mouth(_a);
        _b.copy(carol.position).add(_up12);
        this.beam.position.copy(_a);
        this.beam.lookAt(_b);
        this.beam.scale.set(1 + Math.sin(a.t * 31) * 0.25, 1 + Math.sin(a.t * 27) * 0.25, _a.distanceTo(_b));
        this.beam.material.opacity = 0.55 + Math.sin(a.t * 17) * 0.15;
        carol.pull?.(_a, dt);
        // Hal across its line, the shield up: it breaks
        const at = closest(_e.copy(P.position).add(_up12), _a, _b, _c);
        const along = at.distanceTo(_a) / Math.max(0.1, _a.distanceTo(_b));
        if (R.shield && !R.shield.ending && at.distanceTo(_e) < 2.4 && along > 0.06 && along < 0.96) {
          const g = R.guardHit(_a.clone(), at.clone());
          if (g) { this.breakTether(true); return; }
        }
        a.drunk = a.t / TETHER.hold;
        if (a.t > TETHER.hold) {
          // it drinks her light
          this.health = Math.min(PRED.health, this.health + PRED.health * TETHER.drink);
          this.releaseTether();
          carol.drained?.();
          this.onTether?.('drank');
          this.action = null;
          this.cool = 1.4;
          this.roar(1, 1.2);
        }
      }
    }
  }

  // the blow at its end: met by his shield, or on him
  contact(at, reach, damage, what) {
    const P = this.player, R = this.powers, chest = _e.copy(P.position).add(_up12);
    if (at.distanceTo(chest) > reach && reach < 50) return 'miss';
    const g = R.guardHit(at.clone(), chest.clone());
    const away = _a.subVectors(P.position, this.root.position).setY(0).normalize();
    if (g === 'parry') {
      this.onQuip?.('parried');
      if (what === 'dive') { this.crash(); this.exposed = Math.max(this.exposed, EXPOSE + 1); this.onExposed?.(this); }
      else if (what === 'tail') this.rock(1.4);
      else this.expose();
      return 'parry';
    }
    if (g === 'block') {
      this.audio.shieldHit?.(1);
      this.knock(away, what === 'tail' ? 8 : 5);
      if (what === 'tail') R.damage(4, null);
      this.stagger = Math.max(this.stagger, 0.4);
      return 'block';
    }
    R.damage(damage, null);
    this.knock(away, what === 'tail' ? 11 : 8);
    this.director.shake(0.5, 0.45);
    this.onHurtHal?.(what);
    return 'hit';
  }

  // the gust: a cone ahead of it; the shield torn out of his hand, Hal thrown back; loose things too
  gust() {
    const P = this.player, R = this.powers, me = this.root.position;
    const f = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const to = _b.subVectors(P.position, me), d = to.length();
    this.fx.emit(140, (q, v) => {
      const s = (Math.random() - 0.5) * 2;
      q[0] = me.x + f.x * 4 + f.z * s * 5; q[1] = me.y + 0.4 + Math.random(); q[2] = me.z + f.z * 4 - f.x * s * 5;
      v[0] = f.x * 18 + (Math.random() - 0.5) * 6; v[1] = Math.random() * 2; v[2] = f.z * 18 + (Math.random() - 0.5) * 6;
    }, { life: 0.9, size: [0.16, 0.02], color: [[0.9, 0.5, 1.0, 0.5], [0.3, 0.1, 0.35, 0]] });
    if (d < GUST.reach && to.normalize().dot(f) > GUST.cone) {
      if (R.shield && !R.shield.ending) { R.shield.release(true); R.hud.callout('Guard torn', 'block'); this.audio.glass?.(0.5); }
      R.damage(GUST.damage, null);
      this.knock(_c.copy(to).setY(0.25).normalize(), GUST.push * (1 - d / GUST.reach * 0.5), 0.5);
      this.onHurtHal?.('gust');
    }
    for (const dyn of this.physics.dynamics) {
      const b = dyn.body;
      if (!b?.isDynamic?.() || this.parts.some((p) => p.rb === b)) continue;
      const t = b.translation(), dx = t.x - me.x, dz = t.z - me.z, dd = Math.hypot(dx, dz);
      if (dd > GUST.reach || (dx * f.x + dz * f.z) / (dd || 1) < GUST.cone) continue;
      const m = b.mass(), kk = (1 - dd / GUST.reach) * 9;
      b.applyImpulse({ x: (dx / dd) * m * kk, y: m * kk * 0.3, z: (dz / dd) * m * kk }, true);
    }
  }

  // parried out of a dive, or pinned in the air: down onto the plaza
  crash() {
    this.endAction();
    this.flying = false;
    this.alt = 0;
    this.vel.set(0, 0, 0);
    this.audio.impact?.(1.6);
    this.audio.rumble?.(0.8, 0.5);
    this.director.shake(0.6, 0.6);
    this.stagger = Math.max(this.stagger, EXPOSE + 1);
    this.body.pose.shake = 1;
    this.wantAir = this.phase === 'air'; // (up again once it's gathered itself)
  }
  fall() { this.crash(); }

  breakTether(byShield) {
    if (this.action?.kind !== 'tether') return;
    this.releaseTether();
    this.action = null;
    this.onTether?.(byShield ? 'shield' : 'head');
    if (byShield) this.expose(EXPOSE);
    else this.rock(1.4);
    this.audio.glass?.(0.9);
    this.cool = 1;
  }
  releaseTether() {
    this.beam.visible = false;
    this.beam.material.opacity = 0;
    this.lookAt = null;
    this.ally?.untethered?.();
  }

  dispose() {
    this.disengage();
    for (const o of [this.root, this.line, this.beam, this.fx.points, this.mouthLight]) o.removeFromParent();
    const world = this.physics.world;
    for (const p of this.parts) {
      world.removeRigidBody(p.rb);
      this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== p.rb);
    }
  }
}

// the point on the segment a-b nearest p
function closest(p, a, b, out) {
  const ab = _cl.subVectors(b, a), l2 = ab.lengthSq();
  const t = l2 > 1e-9 ? clamp(_cm.subVectors(p, a).dot(ab) / l2) : 0;
  return out.copy(a).addScaledVector(ab, t);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3(), _h = new THREE.Vector3();
const _cl = new THREE.Vector3(), _cm = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0), _up12 = new THREE.Vector3(0, 1.2, 0);
