import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { clamp, damp } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { POSES, still, makePose, blendInto } from '../characters/Poses.js';
import { solveTwoBone } from '../characters/IK.js';
import { createCharacter } from '../characters/Characters.js';
import { glowTexture } from '../fx/Textures.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '../engine/Assets.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Qward's Thunderers (Part Six; the user's four scans): the Weaponers' soldiers, come through the dark
// after the ring. Four kinds, each with its tell before it strikes, so a fight with them is read and
// answered, not sprayed (as with the drones, at most two of them attack at once: `TOKENS`):
// - brute: on foot, a flail; the arm goes up and the head of it swings (0.75 s), then it comes down
//   on where Hal stood. Heavy: shield it (a parry staggers him) or step out.
// - caster (the woman): on foot, keeps her distance; a crackling bolt forms in her raised hand (0.6 s)
//   and she throws it with lead. The shield stops it; parried, it flies back into her.
// - archer: crouched on high ground as he's scanned (his bow drawn); turns to Hal, and a glint on
//   the arrow (0.8 s) is the tell before it flies. He doesn't move: get to him.
// - winged: hovers and circles out of reach; a shriek and a rise (0.7 s), then a dive through Hal.
// The brute and the caster walk on the mocap; the flail's chain and ball swing from the brute's fist
// as a pendulum (gravity, his arm's motion, the swing of his strike), turned in the vertex shader.
// The winged one flies in poses of its own (talons ready circling, arms swept back in the dive, both
// hands out to strike), its wings beating and folding in the shader (they're part of the scan, bound
// to its chest: turned about their roots, the bend spread out along them). The archer, crouched on
// his perch, lifts the bow he holds low in his scan: his body turns side-on to Hal, the bow comes up
// and round to the vertical as the pair of hands (bow and string) moves as one, an arrow nocked; it
// looses, and the bow comes down. Each is a kinematic capsule in the scene's dynamics (where the
// ring's impacts look for targets), and a construct target. Hit, they reel (a hook interrupts a tell);
// killed, they go down and come apart in the antimatter's violet.
export const KINDS = {
  brute: { model: 'thunder_brute', health: 170, radius: 0.55, height: 2.1, speed: 2.6, reach: 2.6, damage: 18, tell: 0.75 },
  caster: { model: 'thunder_woman', health: 110, radius: 0.45, height: 1.85, speed: 2.2, range: 16, damage: 11, tell: 0.6 },
  archer: { model: 'thunder_archer', health: 90, radius: 0.5, height: 1.9, range: 46, damage: 10, tell: 1.05 },
  winged: { model: 'thunder_winged', health: 120, radius: 0.55, height: 1.9, speed: 7, damage: 14, tell: 0.7 },
};
const TOKENS = 2;
// the brute's flail, in his scan's bind pose: the chain's top under his fist, the ball's middle
const FLAIL = { grip: V(-0.575, 0.965, 0.075), ball: V(-0.6, 0.36, 0.08) };
// the archer's bow, tip to tip in his scan's bind pose
const BOW = { tipA: V(-0.762, 0.887, 0.353), tipB: V(0.762, 1.051, 0.018), brace: -0.18 }; // (and its string at rest, braced, 18 cm off the grip)
const ease = (k) => k * k * (3 - 2 * k);
// the bind pose's point (no turn): the string hand where his scan has it
const xf0 = (p, bw, out) => out.copy(p);
// The scan's bow cut out: every vertex carried by the bow hand (bone 10) farther than his fist from
// the hand's middle (in the bind pose), and the string's end on the other hand (bone 7).
const BOW_GLSL = {
  pars: `attribute float aBowCut; varying float vBowCut;`,
  normal: `vBowCut = aBowCut;`,
  position: ``,
  fragPars: `varying float vBowCut;`,
  frag: `if (vBowCut > 0.5) discard;`,
};
// Which of the archer's vertices are the scan's bow (worked out once per load, on the shared
// geometry): those the bow hand carries (bone 10) past his fist; the string's end on the other hand
// (bone 7) past that fist; and the rest of the sheet, weighted to his hips and thighs where it lay
// across him, found by its texture: any vertex in the bow's own texels (the atlas cells the hand-bound
// bow uses), in the band of height the bow lay in.
function bowCut(geo) {
  if (geo.attributes.aBowCut) return;
  const P = geo.attributes.position, UV = geo.attributes.uv, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, n = P.count;
  const w = (i, b) => (SI.getX(i) === b ? SW.getX(i) : 0) + (SI.getY(i) === b ? SW.getY(i) : 0) + (SI.getZ(i) === b ? SW.getZ(i) : 0) + (SI.getW(i) === b ? SW.getW(i) : 0);
  const p = new THREE.Vector3(), hR = V(0.025, 0.86, 0.275), hL = V(0.141, 1.107, -0.166), cut = new Float32Array(n);
  const G = 256, occ = new Uint8Array(G * G), cell = (i) => Math.min(G - 1, Math.max(0, Math.floor(UV.getY(i) * G))) * G + Math.min(G - 1, Math.max(0, Math.floor(UV.getX(i) * G)));
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(P, i);
    if (w(i, 10) > 0.99 && p.distanceTo(hR) > 0.1) { cut[i] = 1; if (p.distanceTo(hR) > 0.14) occ[cell(i)] = 1; }
    else if (w(i, 7) > 0.6 && p.distanceTo(hL) > 0.11) cut[i] = 1;
  }
  const occ2 = occ.slice();
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (occ[y * G + x]) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < G && yy < G) occ2[yy * G + xx] = 1; }
  for (let i = 0; i < n; i++) { if (cut[i]) continue; p.fromBufferAttribute(P, i); if (occ2[cell(i)] && p.y > 0.72 && p.y < 1.13 && p.distanceTo(hR) > 0.1) cut[i] = 1; }
  geo.setAttribute('aBowCut', new THREE.BufferAttribute(cut, 1));
}
// The Thunderer's own bow: a recurve of blackened iron, gold at the grip and the tips, its limbs
// swept back toward him and the tips curling away (built along +Y, the arrow along +Z, the grip at the
// origin). The string is two thin segments, tip to the string hand, set each frame.
function makeBow() {
  const group = new THREE.Group(), half = 0.68;
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.42, metalness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb48a3c, roughness: 0.3, metalness: 0.95, emissive: 0x1a1004 });
  for (const sgn of [1, -1]) {
    // the limb: a curve from the grip out to the tip, back toward the archer then curling forward
    const pts = [[0, 0.06, 0.0], [0, 0.22, -0.035], [0, 0.42, -0.075], [0, 0.58, -0.07], [0, 0.66, -0.03], [0, half, 0.02]].map(([x, y, z]) => V(x, sgn * y, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const n = 28, geo = new THREE.TubeGeometry(curve, n, 1, 6, false);
    // taper: thick at the grip, fine at the tip (scale each ring about its centre)
    const pos = geo.attributes.position, c = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      curve.getPointAt(i / n, c);
      const r = THREE.MathUtils.lerp(0.02, 0.006, i / n);
      for (let j = 0; j <= 6; j++) {
        const k = i * 7 + j;
        p.fromBufferAttribute(pos, k).sub(c);
        // (flattened across the bow's plane, like a limb)
        p.multiplyScalar(r); p.x *= 1.7;
        pos.setXYZ(k, c.x + p.x, c.y + p.y, c.z + p.z);
      }
    }
    geo.computeVertexNormals();
    const limb = new THREE.Mesh(geo, iron);
    limb.castShadow = true;
    group.add(limb);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), gold);
    tip.position.set(0, sgn * half, 0.02);
    group.add(tip);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10), gold);
  grip.castShadow = true;
  group.add(grip);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05).translate(0, 0.07, 0.02), iron);
  group.add(shelf);
  const cord = new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.7 });
  const seg = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 4), cord); group.add(m); return m; };
  return { group, tipA: V(0, half, 0.02), tipB: V(0, -half, 0.02), stringA: seg(), stringB: seg() };
}
// the winged one's poses (its own: the mocap has no flying): circling with its talons ready, the
// shriek (arms flung wide, head back), the dive (arms swept back along its sides), the strike
// (hands and feet thrown out ahead)
const WINGED = {
  hover: makePose({ sx: 0.14, cx: 0.1, nx: -0.14, kx: -0.12, aL: [0.5, -0.62, 0.6], eL: 1.05, aR: [-0.5, -0.62, 0.6], eR: 1.05, wL: 0.4, wR: 0.4, lLx: 0.35, kL: 0.8, lRx: 0.5, kR: 0.95, lLz: 0.06, lRz: -0.06, fL: 0.7, fR: 0.7 }),
  shriek: makePose({ sx: -0.12, cx: -0.2, nx: -0.3, kx: -0.45, aL: [0.85, -0.15, 0.3], eL: 0.55, aR: [-0.85, -0.15, 0.3], eR: 0.55, lLx: 0.3, kL: 0.65, lRx: 0.4, kR: 0.75, fL: 0.6, fR: 0.6 }),
  dive: makePose({ sx: -0.05, cx: -0.1, nx: -0.5, kx: -0.35, aL: [0.32, -0.5, -0.82], eL: 0.15, aR: [-0.32, -0.5, -0.82], eR: 0.15, lLx: 0.2, kL: 0.15, lRx: 0.28, kR: 0.22, fL: 0.85, fR: 0.85 }),
  strike: makePose({ sx: 0.18, cx: 0.16, nx: -0.42, kx: -0.3, aL: [0.35, 0.05, 0.95], eL: 0.35, aR: [-0.35, 0.05, 0.95], eR: 0.35, lLx: -0.65, kL: 1.05, lRx: -0.55, kR: 1.15, fL: 0.35, fR: 0.35 }),
};
// The wings: every vertex bound to the chest (bone 2) behind the back and out from the body's middle
// (an ellipse round the torso), turned about its wing's root: up and down (uFlap, about the body's
// forward axis) and swept back (uFold, about the vertical); the bend spread from the root outward.
const WING_GLSL = {
  pars: `uniform float uFlap, uFold;
    mat3 tRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 tRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }`,
  normal: `
    vec3 tWr = vec3(0.0); mat3 tWR = mat3(1.0);
    #ifdef USE_SKINNING
    {
      vec3 wp = position;
      float chest = dot(skinWeight, vec4(equal(skinIndex, vec4(2.0))));
      float e = length(vec2(wp.x / 0.26, (wp.z + 0.01) / 0.17));
      float ww = chest * smoothstep(-0.02, -0.07, wp.z) * smoothstep(1.02, 1.42, e) * step(1.05, wp.y);
      float sd = wp.x >= 0.0 ? 1.0 : -1.0;
      tWr = vec3(sd * 0.1, 1.46, -0.11);
      float reach = 0.55 + 0.45 * smoothstep(0.1, 0.7, abs(wp.x));
      tWR = tRotY(sd * uFold * ww) * tRotZ(sd * uFlap * ww * reach);
    }
    #endif
    objectNormal = tWR * objectNormal;`,
  position: `transformed = tWr + tWR * (transformed - tWr);`,
};
// The flail: the vertices the hand bone (10) carries below the fist and out at his side, turned about
// the chain's top by the pendulum's swing (uSwing, bind frame).
const FLAIL_GLSL = {
  pars: `uniform mat3 uSwing; uniform vec3 uGrip;`,
  normal: `
    float tFw = 0.0;
    #ifdef USE_SKINNING
      tFw = dot(skinWeight, vec4(equal(skinIndex, vec4(10.0)))) * step(position.x, -0.33) * (1.0 - smoothstep(0.93, 0.975, position.y));
    #endif
    objectNormal = mix(objectNormal, uSwing * objectNormal, tFw);`,
  position: `transformed = mix(transformed, uGrip + uSwing * (transformed - uGrip), tFw);`,
};
const BOLT = { caster: { speed: 22, color: [1.4, 0.8, 2.1], size: 0.2 }, archer: { speed: 42, color: [1.9, 1.5, 0.6], size: 0.16 } };

let gltfs = null;
// the four scans, loaded once when a part first needs them
export async function loadThunderers(manager) {
  if (gltfs) return gltfs;
  const loader = new GLTFLoader(manager), names = [...new Set(Object.values(KINDS).map((k) => k.model))];
  const loaded = await Promise.all(names.map((n) => loader.loadAsync(assetUrl(`models/${n}.glb`)).catch(() => null)));
  gltfs = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
  for (const g of loaded) g?.scene.traverse((o) => { if (o.isSkinnedMesh) { const m = o.material; if (m.metalnessMap) { m.aoMap = m.metalnessMap; m.aoMapIntensity = 0.85; } m.envMapIntensity = 0.6; } });
  return gltfs;
}

export class Thunderers {
  // scene: { scene, physics }; ground(x, z): the floor's height; centre and radius: where they keep to;
  // blocks: [{ x, z, r }] to walk round
  constructor({ scene, physics, powers, player, audio, director, mocap, ground = () => 0, centre = V(0, 0, 0), radius = 40, blocks = [] }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, mocap, ground, centre, radius, blocks });
    this.units = [];
    this.bolts = [];
    this.attacking = 0;
    this.onKill = this.onHurtHal = null;
    this.glow = glowTexture(undefined, 'rgba(255,255,255,0.3)');
  }

  get alive() { return this.units.filter((u) => u.tg.alive).length; }

  // one of them, stepping out of the dark at `at` (yaw toward Hal); `perch`: an archer's ledge height
  spawn(kind, at, { yaw = null } = {}) {
    const K = KINDS[kind], g = gltfs?.[K.model];
    if (!g) return null;
    const rig = createCharacter(g, { roughMin: 0.45 });
    rig.root.position.copy(at);
    this.scene.add(rig.root);
    const u = { kind, K, rig, pos: rig.root.position, yaw: yaw ?? Math.atan2(this.player.position.x - at.x, this.player.position.z - at.z), vel: V(0, 0, 0), state: 'idle', t: 0, cool: 1.2 + Math.random() * 1.5, stagger: 0, exposed: 0, token: false, rh: V(0, 0, 0), hover: at.y, orbit: Math.random() * 6.28, dir: Math.random() < 0.5 ? 1 : -1 };
    rig.root.rotation.y = u.yaw;
    if (kind === 'winged') this.wings(u);
    if (kind === 'brute') this.flail(u);
    if (kind === 'archer') this.bow(u);
    if (kind === 'brute' || kind === 'caster') {
      u.anim = new Animator(rig);
      u.loco = new Locomotion(this.mocap);
      u.loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
      u.anim.play(u.loco, 0);
      u.anim.look.maxYaw = 0.6;
      u.anim.lookAt(() => this.player.rig.bonePosition('head', u.lookAt ??= V(0, 0, 0)), 0.5);
      if (kind === 'brute') u.anim.feet.ground = this.ground;
    }
    // the body: kinematic (it goes where they go), in the dynamics list so impacts find it
    const world = this.physics.world;
    u.rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y + K.height / 2, at.z));
    u.col = world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(0.1, K.height / 2 - K.radius), K.radius), u.rb);
    u.dyn = { body: u.rb, mesh: new THREE.Object3D() };
    this.physics.dynamics.push(u.dyn);
    this.player.camIgnore?.add(u.col.handle);
    u.tg = { body: u.rb, collider: u.col, position: V(0, 0, 0), radius: K.radius + 0.2, health: K.health, maxHealth: K.health, alive: true, hit: (a, p, d, k) => this.hit(u, a, p, d, k), openState: () => (u.exposed > 0 ? 'exposed' : u.state === 'tell' || u.stagger > 0 ? 'open' : null) };
    this.powers.addTarget(u.tg);
    // out of the dark: a violet burst, the body forming up out of nothing
    const ru = rig.u;
    ru.uEdgeColor.value.setRGB(2.0, 1.2, 3.0);
    ru.uDissolveOn.value = 1; ru.uDissolveSign.value = -1; ru.uDissolve.value = -0.1;
    u.form = 0;
    this.sparks(at.clone().setY(at.y + 1.1), 30, [[2, 1.2, 3, 1], [0.4, 0.1, 0.8, 0]]);
    this.audio.rift?.(true);
    this.units.push(u);
    return u;
  }

  sparks(at, n, color) {
    this.powers.sparks.emit(n, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 3.5; v[2] = (Math.random() - 0.5) * 5; }, { life: 0.5, size: [0.06, 0], color });
  }

  hit(u, amount, point, dir, kind) {
    if (!u.tg.alive) return 0;
    const k = u.exposed > 0 ? 1.35 : 1;
    const dealt = Math.min(u.tg.health, amount * k);
    u.tg.health -= dealt;
    this.sparks(point ?? u.tg.position, 12, [[3, 2.4, 1.2, 1], [0.6, 0.3, 0.1, 0]]);
    // a blow knocks them back, and out of whatever they were winding up (a gun's round only stings)
    if (kind !== 'gatling' || Math.random() < 0.15) {
      if (u.state === 'tell') this.release(u);
      u.state = 'idle';
      u.stagger = kind === 'gatling' ? 0.15 : 0.45;
      u.cool = Math.max(u.cool, 0.6);
      if (dir) u.vel.addScaledVector(_a.copy(dir).setY(0).normalize(), kind === 'hammer' ? 9 : kind === 'hook' ? 6 : 2.5);
    }
    if (u.tg.health <= 0) this.die(u);
    return dealt;
  }

  release(u) {
    if (u.token) { u.token = false; this.attacking--; }
    u.anim?.reach('R', null, { rate: 6 });
    if (u.orb) u.orb.visible = false;
    if (u.glint) u.glint.visible = false;
  }

  die(u) {
    u.tg.alive = false;
    this.release(u);
    this.powers.removeTarget(u.tg);
    u.state = 'dead';
    u.t = 0;
    if (u.kind !== 'winged') u.anim?.play(still(POSES.kneel, 0.5), 0.25);
    u.anim?.lookAt(null);
    if (u.arrow) u.arrow.visible = false;
    this.audio.droneDown?.();
    this.onKill?.(u);
  }

  // ------------------------------------------------------------------------------------ update
  update(dt) {
    if (dt <= 0) return;
    const hal = this.player.position;
    for (const u of this.units) {
      u.t += dt;
      u.stagger = Math.max(0, u.stagger - dt);
      u.exposed = Math.max(0, u.exposed - dt);
      const ru = u.rig.u;
      if (u.form < 1) { u.form = Math.min(1, u.form + dt / 0.9); ru.uDissolve.value = -0.1 + u.form * 1.25; if (u.form >= 1) ru.uDissolveOn.value = 0; }
      if (u.state === 'dead') {
        // down, then gone in the violet
        if (u.t > 0.7) { ru.uDissolveOn.value = 1; ru.uDissolveSign.value = 1; ru.uDissolve.value = (u.t - 0.7) * 0.9 - 0.1; }
        if (u.kind === 'winged' || u.kind === 'archer') { u.pos.y = Math.max(this.ground(u.pos.x, u.pos.z), u.pos.y - dt * (u.kind === 'winged' ? 6 : 0.4)); u.rig.root.rotation.x = Math.min(1.2, u.t * 1.5) * (u.kind === 'winged' ? 1 : 0.3); }
        if (u.t > 2.2) u.gone = true;
        if (u.kind === 'winged') { u.wing.fold = damp(u.wing.fold, 0.5, 3, dt); u.wing.flap = damp(u.wing.flap, -0.75, 3, dt); this.wingShader(u); }
        u.anim?.update(dt);
        if (u.kind === 'brute') this.swingFlail(u, dt);
        continue;
      }
      if (u.kind === 'brute' || u.kind === 'caster') this.walker(u, dt, hal);
      else if (u.kind === 'archer') this.archer(u, dt, hal);
      else this.flyer(u, dt, hal);
      u.tg.position.set(u.pos.x, u.pos.y + u.K.height * 0.55, u.pos.z);
      u.rb.setNextKinematicTranslation({ x: u.pos.x, y: u.pos.y + u.K.height / 2, z: u.pos.z });
      if (u.kind === 'winged') this.beat(u, dt);
      u.anim?.update(dt);
      if (u.kind === 'brute') this.swingFlail(u, dt);
      if (u.kind === 'archer') this.aimBow(u, dt, hal);
    }
    for (const u of this.units) if (u.gone) this.remove(u);
    this.units = this.units.filter((u) => !u.gone);
    this.updateBolts(dt);
  }

  // whether this one may start an attack now (two at a time)
  take(u) {
    if (this.attacking >= TOKENS) return false;
    this.attacking++;
    u.token = true;
    return true;
  }

  face(u, yaw, dt, rate = 6) {
    u.yaw = wrap(u.yaw + clamp(wrap(yaw - u.yaw), -rate * dt, rate * dt));
    u.rig.root.rotation.y = u.yaw;
  }

  // keep inside the fight's ground, out of the blocks
  keep(p, r) {
    const c = this.centre, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), lim = this.radius - 2;
    if (d > lim) { p.x = c.x + (dx / d) * lim; p.z = c.z + (dz / d) * lim; }
    for (const b of this.blocks) {
      if (b.h !== undefined && p.y > b.h) continue;
      const bx = p.x - b.x, bz = p.z - b.z, bd = Math.hypot(bx, bz);
      if (bd < b.r + r) { p.x = b.x + (bx / (bd || 1)) * (b.r + r); p.z = b.z + (bz / (bd || 1)) * (b.r + r); }
    }
  }

  walker(u, dt, hal) {
    const K = u.K, me = u.pos, d = Math.hypot(hal.x - me.x, hal.z - me.z), toHal = Math.atan2(hal.x - me.x, hal.z - me.z);
    const want = _w.set(0, 0, 0);
    if (u.stagger > 0) {
      // reeling: carried by the blow
    } else if (u.state === 'idle') {
      u.cool -= dt;
      if (u.kind === 'brute') {
        // straight at him, slowing to swing
        if (d > K.reach * 0.8) want.set(hal.x - me.x, 0, hal.z - me.z).setLength(K.speed * (d > 8 ? 1 : 0.6));
        if (d < K.reach + 0.6 && Math.abs(hal.y - me.y) < 2.6 && u.cool <= 0 && this.take(u)) this.tell(u);
      } else {
        // at her range, side-stepping round him
        u.orbit += u.dir * dt * 0.4;
        if (Math.random() < dt * 0.15) u.dir *= -1;
        const r = K.range * 0.7, gx = hal.x + Math.sin(u.orbit) * r, gz = hal.z + Math.cos(u.orbit) * r;
        want.set(gx - me.x, 0, gz - me.z);
        if (want.length() > 0.6) want.setLength(Math.min(K.speed, want.length())); else want.set(0, 0, 0);
        if (d < K.range * 1.3 && u.cool <= 0 && this.take(u)) this.tell(u);
      }
    } else if (u.state === 'tell') {
      if (u.kind === 'brute') {
        // the flail up and back over his shoulder
        u.anim.reach('R', () => this.local(u, -0.35, 2.55, -0.45, u.rh), { pole: V(-0.8, -0.3, -0.4), rate: 7 });
        if (u.t > K.tell) { u.state = 'strike'; u.t = 0; u.at = hal.clone(); this.audio.whoosh(0.5, 0.6); }
      } else {
        u.anim.reach('R', () => this.local(u, -0.32, 2.05, 0.25, u.rh), { pole: V(-0.8, -0.5, -0.2), rate: 8 });
        this.orb(u).visible = true;
        u.orb.scale.setScalar(0.25 + Math.min(1, u.t / K.tell) * 0.5);
        u.rig.bones.hand_R.getWorldPosition(u.orb.position);
        if (u.t > K.tell) { u.state = 'strike'; u.t = 0; this.throwBolt(u, u.orb.position.clone(), 'caster'); u.orb.visible = false; }
      }
    } else if (u.state === 'strike') {
      if (u.kind === 'brute') {
        // down across in front of him, landing a pace ahead
        u.anim.reach('R', () => this.local(u, -0.15, 0.6, 1.25, u.rh), { pole: V(-0.8, 0.2, 0.4), rate: 22 });
        if (!u.struck && u.t > 0.14) {
          u.struck = true;
          const at = this.local(u, -0.1, 0.4, 1.6, V(0, 0, 0));
          this.audio.impact?.(0.8);
          this.powers.dustFx(at, 18, 2);
          this.director.shake(0.25, 0.25);
          const dh = Math.hypot(hal.x - at.x, hal.z - at.z);
          if (dh < 1.9 && Math.abs(hal.y - me.y) < 2.4) {
            const g = this.powers.guardHit(at.clone().setY(me.y + 1.2), at);
            if (g === 'parry') { u.exposed = 1.5; u.stagger = 0.9; u.vel.addScaledVector(_a.set(me.x - hal.x, 0, me.z - hal.z).normalize(), 4); }
            else if (g === 'block') u.stagger = 0.35;
            else { this.powers.damage(K.damage, at); this.player.dash?.(_a.set(hal.x - me.x, 0, hal.z - me.z).normalize(), 5, 0.22); this.onHurtHal?.(u); }
          }
        }
        if (u.t > 0.6) { u.struck = false; this.release(u); u.state = 'idle'; u.cool = 1.6 + Math.random() * 1.2; }
      } else if (u.t > 0.35) { this.release(u); u.state = 'idle'; u.cool = 1.8 + Math.random() * 1.6; }
    }
    // move: toward what they want, carried by any blow, along the ground
    u.vel.lerp(want, Math.min(1, dt * (u.stagger > 0 ? 1.5 : 6)));
    me.addScaledVector(u.vel, dt);
    this.keep(me, K.radius + 0.3);
    me.y = this.ground(me.x, me.z);
    u.loco.speed = Math.hypot(u.vel.x, u.vel.z);
    if (u.state !== 'dead') this.face(u, toHal, dt, u.state === 'strike' ? 2 : 6);
  }

  // The archer: low and ready, turned to Hal; then up into the draw (side-on to him, the bow up to the
  // vertical, the arrow nocked and its head glinting: the tell), the loose, and down again.
  archer(u, dt, hal) {
    const K = u.K, me = u.pos, d = me.distanceTo(hal), toHal = Math.atan2(hal.x - me.x, hal.z - me.z);
    const drawn = u.state === 'tell' || u.state === 'strike';
    // (side-on to him to shoot: his bow arm, the right, toward Hal; faced round to him otherwise)
    this.face(u, toHal + (drawn ? 1.15 : 0.28), dt, drawn ? 4 : 2.5);
    if (u.stagger > 0) { u.rig.root.rotation.x = -u.stagger * 0.25; u.aimTo = 0; return; }
    u.rig.root.rotation.x = 0;
    if (u.state === 'idle') {
      u.aimTo = 0;
      u.cool -= dt;
      if (u.cool <= 0 && d < K.range && this.take(u)) { u.state = 'tell'; u.t = 0; this.audio.tone({ type: 'triangle', freq: 220, to: 330, attack: 0.5, peak: 0.025, dur: 0.7, wet: 0.4 }); }
    } else if (u.state === 'tell') {
      u.aimTo = 1;
      if (u.aimK > 0.85) {
        // the arrow's head catches the light: the tell
        const g = this.glint(u);
        g.visible = true;
        g.position.copy(u.tipW);
        g.scale.setScalar(0.3 + 0.3 * Math.sin(u.t * 30) ** 2);
        if (!u.glinted) { u.glinted = true; this.audio.tone({ freq: 1800, to: 2600, attack: 0.3, peak: 0.02, dur: 0.6, wet: 0.5 }); }
      }
      if (u.t > K.tell && u.aimK > 0.95) {
        u.state = 'strike'; u.t = 0; u.glinted = false;
        this.glint(u).visible = false;
        this.throwBolt(u, u.tipW.clone(), 'archer');
        u.arrow.visible = false;
        u.loose = 1; // (the string hand flies back off it)
        this.audio.whoosh(0.25, 1.6);
        this.audio.tone({ type: 'triangle', freq: 160, to: 90, attack: 0.002, peak: 0.06, dur: 0.18, wet: 0.2 });
      }
    } else if (u.t > 0.45) { this.release(u); u.state = 'idle'; u.cool = 2.2 + Math.random() * 1.8; }
  }

  flyer(u, dt, hal) {
    const K = u.K, me = u.pos;
    const goal = _w;
    if (u.state === 'idle' || u.stagger > 0) {
      // circling high and wide, a slow beat up and down
      u.orbit += u.dir * dt * 0.35;
      goal.set(hal.x + Math.sin(u.orbit) * 11, Math.max(hal.y, this.ground(hal.x, hal.z)) + 6 + Math.sin(u.t * 1.3) * 0.8, hal.z + Math.cos(u.orbit) * 11);
      u.cool -= dt;
      if (u.stagger <= 0 && u.cool <= 0 && this.take(u)) { u.state = 'tell'; u.t = 0; this.audio.tone({ type: 'sawtooth', freq: 900, to: 1500, attack: 0.08, peak: 0.03, dur: 0.6, wet: 0.5 }); }
    } else if (u.state === 'tell') {
      goal.copy(me).setY(me.y + 2.5 * dt * 2);
      if (u.t > K.tell) { u.state = 'strike'; u.t = 0; u.dive = _a.set(hal.x - me.x, hal.y + 1.0 - me.y, hal.z - me.z).normalize().clone(); this.audio.whoosh(0.6, 0.9); }
    } else if (u.state === 'strike') {
      goal.copy(me).addScaledVector(u.dive, 22 * 0.25);
      const chest = _b.set(hal.x, hal.y + 1.0, hal.z);
      if (!u.struck && me.distanceTo(chest) < 1.7) {
        u.struck = true;
        const g = this.powers.guardHit(me.clone(), me.clone());
        if (g === 'parry') { u.exposed = 1.5; u.stagger = 1.0; u.vel.multiplyScalar(-0.5); }
        else if (g === 'block') { u.stagger = 0.5; u.vel.multiplyScalar(-0.3); }
        else { this.powers.damage(K.damage, me); this.onHurtHal?.(u); }
      }
      if (u.t > 0.9 || me.y < this.ground(me.x, me.z) + 0.6) { u.struck = false; this.release(u); u.state = 'idle'; u.cool = 2.5 + Math.random() * 2; }
    }
    // a spring toward the goal (hard and straight in the dive)
    const diving = u.state === 'strike' && u.stagger <= 0;
    _a.subVectors(goal, me).multiplyScalar(diving ? 4 : 1.6);
    if (_a.length() > (diving ? 22 : K.speed)) _a.setLength(diving ? 22 : K.speed);
    u.vel.lerp(_a, Math.min(1, dt * (diving ? 8 : u.stagger > 0 ? 1 : 3)));
    me.addScaledVector(u.vel, dt);
    this.keep(me, 0.8);
    me.y = Math.max(me.y, this.ground(me.x, me.z) + 0.4);
    // the body: circling (talons ready), the shriek (up, arms flung wide), the dive (arms swept back),
    // the strike (hands and feet out ahead) near the end of it
    const w = u.wing, near = diving && me.distanceTo(_b.set(hal.x, hal.y + 1, hal.z)) < 5;
    w.mode = u.state === 'tell' ? 'shriek' : diving ? (near ? 'strike' : 'dive') : 'hover';
    // facing Hal, leaning into the flight; the dive head first
    this.face(u, Math.atan2(hal.x - me.x, hal.z - me.z), dt, 4);
    const fwd = u.vel.x * Math.sin(u.yaw) + u.vel.z * Math.cos(u.yaw);
    u.rig.root.rotation.x = damp(u.rig.root.rotation.x, diving ? 0.9 : clamp(fwd * 0.04, -0.2, 0.35), 6, dt);
  }

  // ---------------------------------------------------------------- the winged one
  // Its pose (an animator of its own: the scan stands in an A-pose with its wings spread) and its
  // wings (in the vertex shader: every vertex the wings carry, bound to the chest behind the back, is
  // turned about the wing's root, up and down in the beat and back to fold, the bend spread out from
  // the root so the wing's shoulder flexes most).
  wings(u) {
    u.wing = { mode: 'hover', phase: Math.random() * 6.28, flap: 0, fold: 0, k: { hover: 1, shriek: 0, dive: 0, strike: 0 }, lastBeat: 0 };
    u.anim = new Animator(u.rig);
    u.anim.look.maxYaw = 0.5;
    u.anim.lookAt(() => this.player.rig.bonePosition('head', u.lookAt ??= V(0, 0, 0)), 0.45);
    const P = WINGED, k = u.wing.k, tmp = makePose(), tmp2 = makePose();
    u.anim.play((out, t) => {
      // the four poses blended by their weights (eased in the beat)
      blendInto(tmp, P.hover, P.shriek, k.shriek / Math.max(1e-3, k.hover + k.shriek));
      blendInto(tmp2, P.dive, P.strike, k.strike / Math.max(1e-3, k.dive + k.strike));
      blendInto(out, tmp, tmp2, (k.dive + k.strike) / Math.max(1e-3, k.hover + k.shriek + k.dive + k.strike));
      // the body rides the beat: lifted on the downstroke
      const b = Math.sin(u.wing.phase);
      out.hy += 0.05 * b * (k.hover + k.shriek);
      out.cx += 0.05 * b * k.hover;
      out.kL += 0.08 * Math.sin(u.wing.phase + 0.6) * k.hover;
      out.kR += 0.08 * Math.sin(u.wing.phase + 1.1) * k.hover;
      out.eL += 0.12 * Math.sin(t * 2.3); out.eR += 0.12 * Math.sin(t * 2.1 + 1);
      return out;
    }, 0);
    for (const m of u.rig.meshes) this.patch(m.material, 'wing', u.rig.u);
    Object.assign(u.rig.u, { uFlap: { value: 0 }, uFold: { value: 0 } });
  }

  beat(u, dt) {
    const w = u.wing, k = w.k;
    for (const m of Object.keys(k)) k[m] = damp(k[m], m === w.mode ? 1 : 0, m === 'strike' ? 10 : 5, dt);
    // the beat: slow and deep circling, fast and high in the shriek, held tucked and swept back in the dive
    const rate = 1.45 * k.hover + 2.6 * k.shriek + 0.4 * (k.dive + k.strike);
    w.phase += dt * rate * Math.PI * 2;
    const flap = (-0.2 + 0.62 * Math.sin(w.phase)) * k.hover + (0.05 + 0.75 * Math.sin(w.phase)) * k.shriek - 0.35 * k.dive + (0.25 + 0.1 * Math.sin(w.phase)) * k.strike;
    w.flap = flap;
    w.fold = 1.15 * k.dive + 0.35 * k.strike + 0.08 * Math.max(0, -Math.sin(w.phase)) * k.hover;
    this.wingShader(u);
    // a beat's downstroke you can hear, close by
    const down = Math.sin(w.phase) < -0.2 && Math.sin(w.phase - dt * rate * 6.28) >= -0.2;
    if (down && (k.hover + k.shriek) > 0.5 && u.pos.distanceTo(this.player.position) < 28) this.audio.whoosh(0.32, 0.28 + 0.2 * k.shriek);
  }

  wingShader(u) { u.rig.u.uFlap.value = u.wing.flap; u.rig.u.uFold.value = u.wing.fold; }

  // A material's extra vertex stage: 'wing' (the winged one's wings) or 'flail' (the brute's chain and
  // ball). The scans' own patch (Characters.patchMaterial) runs first.
  patch(mat, what, uni) {
    const base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      base(sh, r);
      const body = { wing: WING_GLSL, flail: FLAIL_GLSL, bow: BOW_GLSL }[what];
      if (what === 'wing') Object.assign(sh.uniforms, { uFlap: uni.uFlap, uFold: uni.uFold });
      else if (what === 'flail') Object.assign(sh.uniforms, { uSwing: uni.uSwing, uGrip: uni.uGrip });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${body.pars}`)
        .replace('#include <skinnormal_vertex>', `${body.normal}\n#include <skinnormal_vertex>`)
        .replace('#include <skinning_vertex>', `${body.position}\n#include <skinning_vertex>`);
      if (body.frag) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${body.fragPars}`).replace('#include <map_fragment>', `#include <map_fragment>\n${body.frag}`);
    };
    mat.customProgramCacheKey = () => `thunder-${what}`;
    mat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the brute's flail
  // The chain and ball as a pendulum hung from his fist: a point mass on a 0.6 m rod (gravity, a
  // little air drag), integrated in the world; the rotation from its bind-pose hang to where it swings
  // now goes to the shader in the bind frame (the verts the hand bone carries below the fist).
  flail(u) {
    const uni = u.rig.u;
    uni.uSwing = { value: new THREE.Matrix3() };
    uni.uGrip = { value: FLAIL.grip.clone() };
    for (const m of u.rig.meshes) this.patch(m.material, 'flail', uni);
    u.fl = { ball: null, prev: null, len: FLAIL.ball.distanceTo(FLAIL.grip), rest: FLAIL.ball.clone().sub(FLAIL.grip).normalize(), mesh: u.rig.meshes[0], bone: u.rig.bones.hand_R };
  }

  swingFlail(u, dt) {
    const f = u.fl, bone = f.bone, mesh = f.mesh, sk = mesh.skeleton;
    const i = sk.bones.indexOf(bone);
    u.rig.root.updateMatrixWorld(true); // (this frame's pose, not the last one's)
    // the hand's skinning matrix (bind space to world): where the grip is now, and how the hand is turned
    _m.multiplyMatrices(bone.matrixWorld, sk.boneInverses[i]).multiply(mesh.bindMatrix);
    const grip = _g.copy(FLAIL.grip).applyMatrix4(_m);
    _r.setFromMatrix4(_m);
    const sc = _sx.setFromMatrixColumn(_m, 0).length();
    _r.multiplyScalar(1 / sc);
    if (!f.ball) { f.ball = f.rest.clone().applyMatrix3(_r).multiplyScalar(f.len).add(grip); f.prev = f.ball.clone(); }
    // verlet: carried on by its speed (a little drag), pulled down, held at the chain's length
    const h = Math.min(dt, 1 / 30);
    _v.subVectors(f.ball, f.prev).multiplyScalar(0.985);
    f.prev.copy(f.ball);
    f.ball.add(_v).y -= 9.8 * h * h;
    if (u.state === 'tell') {
      // wound up over his shoulder: whirled round his fist, flat (it flies out level as it speeds up)
      _v.subVectors(f.ball, grip).setY(0);
      if (_v.lengthSq() < 1e-4) _v.set(1, 0, 0);
      _w.set(-_v.z, 0, _v.x).normalize().multiplyScalar(Math.min(1, u.t / 0.3) * 70 * h * h);
      f.ball.add(_w);
    } else if (u.state === 'strike' && u.t < 0.12 && u.at) {
      // the strike: flung down at where Hal stood
      _w.subVectors(u.at, f.ball).normalize().multiplyScalar(160 * h * h);
      f.ball.add(_w);
    }
    _v.subVectors(f.ball, grip);
    const len = _v.length() || 1;
    f.ball.copy(grip).addScaledVector(_v, (f.len * sc) / len);
    // the ball stays above the ground
    const gy = this.ground(f.ball.x, f.ball.z) + 0.12;
    if (f.ball.y < gy) { f.ball.y = gy; f.prev.y = Math.min(f.prev.y, gy); }
    // the rotation that turns the bind hang to the swing, in the bind frame: R_bind = S⁻¹ R_world S
    const now = _v.subVectors(f.ball, grip).normalize(), was = _w.copy(f.rest).applyMatrix3(_r).normalize();
    _q.setFromUnitVectors(was, now);
    _mw.makeRotationFromQuaternion(_q);
    _r3.setFromMatrix4(_mw);
    _rt.copy(_r).transpose();
    u.rig.u.uSwing.value.copy(_rt).multiply(_r3).multiply(_r);
  }

  // ---------------------------------------------------------------- the archer's bow
  // His scan holds the bow low across him, drawn (the bow in his right hand, the string at his left
  // hip). The two hands and the bow between them move as one rigid piece: turned from the bind pose's
  // frame (the arrow from the string hand to the grip, the limbs tip to tip) to the aimed one (the arrow
  // at Hal, the limbs upright, a little canted), the grip at the bow arm's length out from his shoulder;
  // the arms reach their hands there (two-bone IK) and the hands take the turn. A nocked arrow shows
  // while it's up.
  bow(u) {
    const r = u.rig, b = r.bones;
    r.root.updateMatrixWorld(true);
    const inv = _m.copy(r.root.matrixWorld).invert(), rq = new THREE.Quaternion().setFromRotationMatrix(inv);
    const bindQ = Object.fromEntries(Object.entries(b).map(([n, bone]) => [n, bone.quaternion.clone()]));
    const handQ = (n) => rq.clone().multiply(b[n].getWorldQuaternion(new THREE.Quaternion()));
    const grip = r.restPos.hand_R.clone().add(V(0, -0.02, 0.06)), nock = r.restPos.hand_L.clone();
    const A0 = grip.clone().sub(nock).normalize(), L0 = BOW.tipB.clone().sub(BOW.tipA);
    L0.addScaledVector(A0, -L0.dot(A0)).normalize();
    u.bw = { bindQ, qR: handQ('hand_R'), qL: handQ('hand_L'), grip, nock, A0, L0, draw: grip.distanceTo(nock), X0: new THREE.Vector3().crossVectors(L0, A0) };
    u.aimK = 0; u.aimTo = 0; u.loose = 0; u.tipW = V(0, 0, 0);
    // (the scan's own bow is a sheet: its limbs and string were filled in between, a thin line only
    // while it lay flat across him. Cut out in the shader, past his fist; a bow of our own in its place)
    for (const m of r.meshes) { bowCut(m.geometry); this.patch(m.material, 'bow', r.u); }
    const bow = (u.bowMesh = makeBow());
    r.root.add(bow.group);
    // the nocked arrow: a shaft of dark metal, a gold head, fletched, along the arrow axis
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.78, 6).rotateX(Math.PI / 2).translate(0, 0, 0.39 - 0.05), new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.5, metalness: 0.6 }));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 6).rotateX(Math.PI / 2).translate(0, 0, 0.765), new THREE.MeshStandardMaterial({ color: 0xc9a040, roughness: 0.3, metalness: 0.9, emissive: 0x3a2a08 }));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1).rotateY(Math.PI / 2).translate(0, 0.012, 0.0), new THREE.MeshStandardMaterial({ color: 0x5a2a6a, roughness: 0.8, side: THREE.DoubleSide }));
    const fl2 = fl.clone(); fl2.rotation.z = Math.PI * 2 / 3; const fl3 = fl.clone(); fl3.rotation.z = -Math.PI * 2 / 3;
    u.arrow = new THREE.Group();
    u.arrow.add(shaft, head, fl, fl2, fl3);
    u.arrow.visible = false;
    r.root.add(u.arrow);
  }

  aimBow(u, dt, hal) {
    const r = u.rig, b = r.bones, bw = u.bw, root = r.root;
    u.aimK = damp(u.aimK, u.aimTo, u.aimTo > u.aimK ? 5.5 : 3, dt);
    u.loose = Math.max(0, u.loose - dt * 3);
    // the bind pose each frame (no animator: his scan is his stance), then the arms
    for (const [n, q] of Object.entries(bw.bindQ)) b[n].quaternion.copy(q);
    // a slow breath in the shoulders
    b.chest.rotateX(0.015 * Math.sin(u.t * 1.6));
    root.updateMatrixWorld(true);
    const k = u.aimK;
    if (k < 1e-3) { u.arrow.visible = false; this.placeBow(u, _qk.identity(), bw.grip, xf0(bw.nock, bw, _n)); return; }
    // the aim, in his frame: from his bow shoulder to Hal's chest; the limbs upright about it
    const inv = _m.copy(root.matrixWorld).invert();
    const sh = r.restPos.upperArm_R;
    const A1 = _a.set(hal.x, hal.y + 1.15, hal.z).applyMatrix4(inv).sub(sh).normalize();
    const L1 = _w.set(0, 1, 0).addScaledVector(A1, -A1.y).normalize().applyAxisAngle(A1, 0.14);
    const M0 = _m0.makeBasis(bw.A0, bw.L0, _x0.crossVectors(bw.A0, bw.L0));
    const M1 = _m1.makeBasis(A1, L1, _x1.crossVectors(A1, L1));
    _q.setFromRotationMatrix(M1.multiply(M0.transpose()));
    const qk = _qk.identity().slerp(_q, ease(k));
    // the grip at the bow arm's length out along the aim, raised to his eyes' line
    const gripTo = _gt.copy(sh).addScaledVector(A1, 0.54).add(_o.set(0, 0.04, 0));
    const gripK = _gk.lerpVectors(bw.grip, gripTo, ease(k));
    const xf = (p, out) => out.copy(p).sub(bw.grip).applyQuaternion(qk).add(gripK);
    // the hands: the bow hand at the grip, the string hand at the nock (and off it, after the loose)
    const wR = xf(r.restPos.hand_R, _hr), wL = xf(r.restPos.hand_L, _hl);
    wL.addScaledVector(A1, -0.07 * u.loose).add(_o.set(0, 0.03 * u.loose, 0));
    root.localToWorld(wR); root.localToWorld(wL);
    const pole = (x, y, z) => _p.set(x, y, z).applyQuaternion(root.quaternion);
    solveTwoBone(b.upperArm_R, b.foreArm_R, b.hand_R, wR, pole(-1, -0.4, 0.1), 1);
    solveTwoBone(b.upperArm_L, b.foreArm_L, b.hand_L, wL, pole(0.9, 0.1, -0.7), 1);
    // the hands take the turn (in his frame, then the world)
    const rootQ = root.getWorldQuaternion(_rq);
    for (const [n, q0] of [['hand_R', bw.qR], ['hand_L', bw.qL]]) {
      const want = _hq.copy(rootQ).multiply(qk).multiply(q0);
      b[n].parent.getWorldQuaternion(_pq);
      b[n].quaternion.copy(_pq.invert().multiply(want));
    }
    root.updateMatrixWorld(true);
    this.placeBow(u, qk, gripK, root.worldToLocal(_n.copy(wL)));
    // the arrow: nocked on the string, along the aim, through the grip
    const show = k > 0.6 && (u.state === 'tell');
    u.arrow.visible = show;
    if (show) {
      const nock = xf(bw.nock, _n), dir = _d.copy(gripK).sub(nock).normalize();
      u.arrow.position.copy(nock);
      u.arrow.quaternion.setFromUnitVectors(_z, dir);
      u.tipW.copy(nock).addScaledVector(dir, 0.8);
      root.localToWorld(u.tipW);
    } else {
      const g = xf(bw.grip, _n), dir = _d.copy(A1);
      u.tipW.copy(g).addScaledVector(dir, 0.15);
      root.localToWorld(u.tipW);
    }
  }

  // The bow in his frame: the grip at `grip`, turned by `q` from the scan's (its limbs along L0, the
  // arrow along A0), the string from each tip to `nock` (his string hand), straight when it's let go.
  placeBow(u, q, grip, nock) {
    const bw = u.bw, b = u.bowMesh;
    _m0.makeBasis(bw.X0, bw.L0, bw.A0);
    b.group.quaternion.setFromRotationMatrix(_m0).premultiply(q);
    b.group.position.copy(grip);
    b.group.updateMatrix();
    // the string's middle: on his hand while he holds it, snapped back toward the bow when he looses
    const local = _d.copy(nock).sub(grip).applyQuaternion(_qi.copy(b.group.quaternion).invert());
    local.lerp(_o.set(0, 0, BOW.brace), u.loose > 0 ? Math.min(1, u.loose * 3) : 0);
    for (const [seg, tip] of [[b.stringA, b.tipA], [b.stringB, b.tipB]]) {
      _v.subVectors(local, tip);
      seg.position.copy(tip).addScaledVector(_v, 0.5);
      seg.scale.set(1, _v.length(), 1);
      seg.quaternion.setFromUnitVectors(_y, _v.normalize());
    }
  }

  // a point in one of their own frames (+x their left, +z ahead of them), from their feet
  local(u, x, y, z, out) {
    const s = Math.sin(u.yaw), c = Math.cos(u.yaw);
    return out.set(u.pos.x + x * c + z * s, u.pos.y + y, u.pos.z - x * s + z * c);
  }

  tell(u) {
    u.state = 'tell';
    u.t = 0;
    if (u.kind === 'brute') this.audio.tone({ type: 'sawtooth', freq: 70, to: 140, attack: 0.5, peak: 0.05, dur: 0.75, wet: 0.4 });
    else this.audio.droneCharge?.();
  }

  orb(u) {
    if (!u.orb) {
      u.orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(1.8, 1.0, 2.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.scene.add(u.orb);
    }
    return u.orb;
  }

  glint(u) {
    if (!u.glint) {
      u.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(3, 2.4, 1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.scene.add(u.glint);
    }
    return u.glint;
  }

  // ------------------------------------------------------------------------------------ bolts
  throwBolt(u, from, kind) {
    const B = BOLT[kind], hal = this.player.position, aim = _a.set(hal.x, hal.y + 1.1, hal.z);
    // lead: where he'll be when it gets there
    const t = from.distanceTo(aim) / B.speed, pv = this.player.vel;
    if (pv) aim.addScaledVector(pv, Math.min(0.8, t) * 0.7);
    const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: new THREE.Color(...B.color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    mesh.scale.setScalar(B.size * 2.2);
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.005, B.size * 0.25, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...B.color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
    trail.scale.z = kind === 'archer' ? 2.2 : 1.2;
    const g = new THREE.Group();
    g.add(mesh, trail);
    g.position.copy(from);
    this.scene.add(g);
    const vel = aim.sub(from).normalize().multiplyScalar(B.speed);
    g.lookAt(g.position.clone().add(vel));
    this.bolts.push({ g, vel, life: 3, damage: u.K.damage, from: u, back: false });
  }

  updateBolts(dt) {
    const hal = this.player.position, chest = _b.set(hal.x, hal.y + 1.1, hal.z);
    for (const b of this.bolts) {
      const p = b.g.position;
      if (b.back && b.from.tg.alive) {
        // parried: home in on whoever threw it
        _a.copy(b.from.tg.position).sub(p).normalize().multiplyScalar(b.vel.length());
        b.vel.lerp(_a, Math.min(1, dt * 6));
      }
      p.addScaledVector(b.vel, dt);
      b.g.lookAt(_c.copy(p).add(b.vel));
      b.life -= dt;
      if (b.back) {
        if (b.from.tg.alive && p.distanceTo(b.from.tg.position) < b.from.K.radius + 0.4) { this.powers.dealDamage(b.from.tg, b.damage * 3, p.clone(), b.vel.clone().normalize(), 'spike'); b.life = 0; }
      } else if (p.distanceTo(chest) < 0.75) {
        const g = this.powers.guardHit(p.clone(), p.clone());
        if (g === 'parry') { b.back = true; b.vel.negate(); b.life = 2; continue; }
        if (!g) { this.powers.damage(b.damage, p.clone()); this.onHurtHal?.(b.from); }
        b.life = 0;
      }
      if (p.y < this.ground(p.x, p.z) + 0.05) b.life = 0;
      if (b.life <= 0) { this.sparks(p, 10, [[2, 1.6, 2.4, 1], [0.4, 0.2, 0.5, 0]]); b.g.removeFromParent(); }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  remove(u) {
    this.release(u);
    this.powers.removeTarget(u.tg);
    u.rig.root.removeFromParent();
    u.orb?.removeFromParent();
    u.glint?.removeFromParent();
    u.arrow?.removeFromParent();
    const i = this.physics.dynamics.indexOf(u.dyn);
    if (i >= 0) this.physics.dynamics.splice(i, 1);
    this.physics.world.removeRigidBody(u.rb);
  }

  clear() {
    for (const u of this.units) this.remove(u);
    for (const b of this.bolts) b.g.removeFromParent();
    this.units = [];
    this.bolts = [];
    this.attacking = 0;
  }
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _w = new THREE.Vector3(), _rh = new THREE.Vector3();
const _m = new THREE.Matrix4(), _mw = new THREE.Matrix4(), _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4(), _r = new THREE.Matrix3(), _r3 = new THREE.Matrix3(), _rt = new THREE.Matrix3();
const _g = new THREE.Vector3(), _v = new THREE.Vector3(), _sx = new THREE.Vector3(), _q = new THREE.Quaternion(), _qk = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _hq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _qi = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
const _x0 = new THREE.Vector3(), _x1 = new THREE.Vector3(), _gt = new THREE.Vector3(), _gk = new THREE.Vector3(), _o = new THREE.Vector3(), _hr = new THREE.Vector3(), _hl = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
