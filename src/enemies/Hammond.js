import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { MocapClip } from '../characters/Mocap.js';
import { createHammond } from '../characters/Characters.js';
import { pbrMaterial } from '../fx/Textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BARRIER = 1.7; // the shell's radius about his chest
const HEALTH = 360, YIELD = 0.45; // at 45% the shell cracks and he goes for Hal's mind
const THROW = { speed: 21, damage: 14, max: 14 };
const WAVE = { reach: 24, damage: 11, every: [8, 10] };

// Hector Hammond, in the fight at Ferris Aircraft: a man on foot whose mind has outgrown his body.
// He hardly moves. He stands a hand to his temple and throws what's round him with his mind: slabs
// torn out of the runway, each lifted and held shimmering for a moment (the telegraph), then hurled
// with lead at Hal, or at Carol where she lies (Hal has to put a shield or a wall in the way); and
// as the effort builds, a psychic wave rolls out from him that hurts Hal (and warps the screen)
// unless he's out of its reach. A shell of force takes the ring's hits: its strength is the bar
// across the top, and at YIELD it cracks (onBreak). His skull swells with every wave (rig.hu).
export class Hammond {
  constructor({ scene, physics, powers, player, audio, director, engine, mocap, gltf }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, engine });
    const rig = (this.rig = createHammond(gltf));
    scene.add(rig.root);
    this.anim = new Animator(rig);
    this.anim.play(new MocapClip(mocap, 'idle', { timeScale: 0.8 }), 0);
    this.anim.look.maxYaw = 0.7;
    this.anim.lookAt(() => player.rig.bonePosition('head', _look), 0.5); // (gentle: a big head on a thin neck)
    this.yaw = 0;
    this.fighting = false;
    this.cool = 2.2;
    this.waveCool = WAVE.every[0];
    this.throws = 0;
    this.action = null;
    this.chunks = [];
    this.waves = [];
    this.carol = null; // { position(): Vector3 } while she lies there to be aimed at
    this.onHurtHal = this.onCarolHit = this.onBreak = this.onQuip = this.onAimCarol = null;

    // the shell: something to hit (a dynamic ball the ring's constructs find, pinned in place)
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -50, 0).setGravityScale(0).lockTranslations().lockRotations());
    this.col = world.createCollider(RAPIER.ColliderDesc.ball(BARRIER).setDensity(50), this.rb);
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() });
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: BARRIER, health: HEALTH, maxHealth: HEALTH, alive: true, hit: (a, p, d) => this.hit(a, p, d) };
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(BARRIER, 48, 32), shellMaterial());
    this.shell.renderOrder = 22;
    this.shell.visible = false;
    scene.add(this.shell);
    this.slabMat = pbrMaterial('asphalt_02', { repeat: [0.6, 0.6] });
    this.holeMat = new THREE.MeshStandardMaterial({ color: 0x2b241c, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  get position() { return this.rig.root.position; }
  get strength() { return this.tg.health / this.tg.maxHealth; }

  place(at, yaw) {
    this.rig.root.position.copy(at);
    this.yaw = yaw;
    this.rig.root.rotation.y = yaw;
    this.rb.setTranslation({ x: at.x, y: at.y + 1.25, z: at.z }, true);
  }

  // into the fight: the shell up, and the ring's constructs can hit it
  engage() {
    this.fighting = true;
    this.shell.visible = true;
    this.shell.material.uniforms.uOn.value = 0;
    this.powers.addTarget(this.tg);
    this.cool = 1.8;
  }

  hit(amount, point) {
    if (!this.fighting || !this.tg.alive) return 0;
    const u = this.shell.material.uniforms;
    u.uHit.value = 1;
    u.uHitPos.value.copy(point ?? this.tg.position);
    this.audio.shieldHit?.(0.6);
    this.tg.health = Math.max(0, this.tg.health - amount);
    if (amount > 20) this.onQuip?.('hurt');
    if (this.tg.health <= this.tg.maxHealth * YIELD) this.crack();
    return amount;
  }

  // the shell gives: whatever he holds up falls, and he stops throwing
  crack() {
    if (!this.fighting) return;
    this.fighting = false;
    this.powers.removeTarget(this.tg);
    for (const c of this.chunks) if (c.state === 'rise' || c.state === 'hold') this.release(c, V(0, 0, 0));
    this.action = null;
    this.anim.reach('L', null, { rate: 4 });
    this.anim.reach('R', null, { rate: 4 });
    this.onBreak?.();
  }

  // ---------------------------------------------------------------------------------- update
  update(dt, t) {
    if (dt <= 0) return;
    const root = this.rig.root, hal = this.player.position;
    const want = Math.atan2(hal.x - root.position.x, hal.z - root.position.z);
    this.yaw += wrap(want - this.yaw) * Math.min(1, dt * 2);
    root.rotation.y = this.yaw;
    this.tg.position.copy(root.position).y += 1.25;
    this.shell.position.copy(this.tg.position);
    const su = this.shell.material.uniforms;
    su.uTime.value = t;
    su.uOn.value = damp(su.uOn.value, this.shell.visible && this.fighting ? 0.55 + 0.45 * this.strength : 0, 4, dt);
    su.uHit.value = Math.max(0, su.uHit.value - dt * 2.2);
    const hu = this.rig.hu;
    hu.uThrob.value = damp(hu.uThrob.value, this.action ? 1 : 0.15 + 0.1 * Math.sin(t * 2.2), 5, dt);
    if (this.fighting) this.think(dt);
    this.updateChunks(dt);
    this.updateWaves(dt);
    this.anim.update(dt);
  }

  think(dt) {
    const a = this.action;
    this.cool -= dt;
    this.waveCool -= dt;
    if (!a) {
      if (this.waveCool <= 0) this.begin('wave');
      else if (this.cool <= 0) this.begin('throw');
      return;
    }
    a.t += dt;
    if (a.kind === 'throw') {
      // a hand to his temple; the slabs come up out of the runway and hang there, then go
      if (a.phase === 'lift' && a.t > 1.15) { a.phase = 'fire'; a.t = 0; }
      if (a.phase === 'fire') {
        while (a.fired < a.made.length && a.t > a.fired * 0.35) {
          const c = a.made[a.fired++];
          this.hurl(c, a.atCarol ? this.carol?.position() : null);
        }
        if (a.fired >= a.made.length && a.t > 0.6) { if (a.atCarol) this.onAimCarol?.(false); this.end(1.6 + Math.random() * 1.6); }
      }
    } else if (a.kind === 'wave') {
      // both hands to his head, the skull throbbing, then it rolls out of him
      if (a.phase === 'build' && a.t > 1.25) {
        a.phase = 'out'; a.t = 0;
        this.waves.push({ r: BARRIER, hit: false });
        this.audio.psychic?.(1);
        this.director.shake(0.25, 0.5);
        this.rig.setSwell(Math.min(0.72, this.rig.hu.uSwell.value + 0.035));
      }
      if (a.phase === 'out' && a.t > 0.8) { this.end(1.0); this.waveCool = WAVE.every[0] + Math.random() * (WAVE.every[1] - WAVE.every[0]); }
    }
  }

  begin(kind) {
    // (each hand's target with its own vectors: the arm IK reads both before solving either)
    // (beside his eyes, out past the swollen head; each target with its own vectors)
    const temple = (side) => { const p = new THREE.Vector3(), o = new THREE.Vector3(); return () => this.rig.face(p).add(o.set((side === 'L' ? 1 : -1) * (this.rig.headWidth() + 0.05), 0, -0.02).applyAxisAngle(_up, this.yaw)); };
    if (kind === 'throw') {
      this.throws++;
      const n = this.strength < 0.75 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 1 + (Math.random() < 0.5 ? 1 : 0);
      const made = [];
      for (let i = 0; i < n; i++) made.push(this.tear(i, n));
      this.action = { kind, phase: 'lift', t: 0, made, fired: 0, atCarol: !!this.carol && this.throws % 3 === 0 };
      if (this.action.atCarol) this.onAimCarol?.(true);
      this.anim.reach('R', temple('R'), { pole: V(-1, -0.3, -0.2), rate: 7 });
      this.audio.rumble?.(1.2, 0.5);
    } else {
      this.action = { kind, phase: 'build', t: 0 };
      this.anim.reach('R', temple('R'), { pole: V(-1, -0.3, -0.2), rate: 6 });
      this.anim.reach('L', temple('L'), { pole: V(1, -0.3, -0.2), rate: 6 });
      this.audio.psychic?.(0.4);
    }
  }

  end(cool) {
    this.action = null;
    this.cool = cool;
    this.anim.reach('R', null, { rate: 4 });
    this.anim.reach('L', null, { rate: 4 });
  }

  // ------------------------------------------------------------------------------- the slabs
  // A slab of runway torn up from beside him: it rises, turning, and hangs at shoulder height or
  // above, shaking, until it's thrown. A dark hole is left where it came from.
  tear(i, n) {
    const root = this.rig.root.position, side = (i - (n - 1) / 2) * 2.6;
    const fwd = _ta.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = _tb.set(fwd.z, 0, -fwd.x);
    const from = root.clone().addScaledVector(right, side + (Math.random() - 0.5)).addScaledVector(fwd, 2.6 + Math.random() * 1.5).setY(0.05);
    const w = 1.0 + Math.random() * 0.9, d = 0.8 + Math.random() * 0.7, h = 0.24 + Math.random() * 0.1;
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), this.slabMat);
    mesh.castShadow = true;
    mesh.position.copy(from);
    this.scene.add(mesh);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.05, d * 1.05).rotateX(-Math.PI / 2), this.holeMat);
    hole.position.copy(from).y = 0.012;
    this.scene.add(hole);
    this.powers.dustFx(from, 10, 1.4);
    const hold = root.clone().addScaledVector(right, side * 1.2).addScaledVector(fwd, 1.2).setY(2.8 + Math.random() * 1.6 + Math.abs(side) * 0.3);
    const spin = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2);
    const c = { mesh, hole, half: V(w / 2, h / 2, d / 2), from, hold, spin, state: 'rise', t: 0, body: null };
    this.chunks.push(c);
    return c;
  }

  // Thrown: a physics body now, on a ballistic path to where its target will be (aimed with lead).
  hurl(c, at) {
    const P = this.player, p = c.mesh.position;
    const target = at ? at.clone().setY(at.y + 0.5) : P.rig.bonePosition('chest', V(0, 0, 0));
    const T = clamp(p.distanceTo(target) / (at ? THROW.speed * 0.6 : THROW.speed), 0.35, 1.8);
    if (!at && P.flying) target.addScaledVector(P.vel, T * 0.8);
    else if (!at) target.add(_ta.set(Math.sin(P.yaw) * P.speed, 0, Math.cos(P.yaw) * P.speed).multiplyScalar(T * 0.8));
    const v = target.sub(p).divideScalar(T);
    v.y += 0.5 * 9.81 * T;
    c.atCarol = !!at;
    this.release(c, v);
    this.audio.whoosh(0.5, 0.6);
  }

  release(c, v) {
    c.state = 'thrown';
    c.t = 0;
    c.body = this.physics.dynamic(c.mesh, RAPIER.ColliderDesc.cuboid(c.half.x, c.half.y, c.half.z), { density: 2.3, damping: 0.02, angularDamping: 0.1, restitution: 0.15 });
    c.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    c.body.setAngvel({ x: c.spin.x * 2, y: c.spin.y * 2, z: c.spin.z * 2 }, true);
  }

  updateChunks(dt) {
    const P = this.player, chest = P.rig.bonePosition('chest', _tc), carol = this.carol?.position();
    for (const c of this.chunks) {
      c.t += dt;
      const m = c.mesh;
      if (c.state === 'rise' || c.state === 'hold') {
        const k = Math.min(1, c.t / 1.0), e = 1 - (1 - k) ** 3;
        m.position.lerpVectors(c.from, c.hold, e);
        // held: a tremor, as if it were fighting him
        m.position.x += Math.sin(c.t * 37) * 0.025 * k; m.position.y += Math.sin(c.t * 29 + 1) * 0.03 * k;
        m.rotation.x += c.spin.x * dt * (1.2 - k); m.rotation.y += c.spin.y * dt; m.rotation.z += c.spin.z * dt * (1.2 - k);
        if (k >= 1) c.state = 'hold';
      } else if (c.state === 'thrown') {
        const lv = c.body.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z);
        if (sp > 4) {
          const reach = Math.max(c.half.x, c.half.z) + 0.55;
          if (m.position.distanceTo(chest) < reach) {
            const dealt = this.powers.damage(THROW.damage, m.position.clone());
            if (dealt > 0) this.onHurtHal?.();
            c.state = 'spent';
          } else if (c.atCarol && carol && m.position.distanceTo(_td.copy(carol).setY(carol.y + 0.5)) < reach + 0.2) {
            c.state = 'spent';
            this.onCarolHit?.();
          }
        } else if (c.t > 0.4) c.state = 'spent';
      }
      if (c.state === 'spent' || c.state === 'thrown') c.life = (c.life ?? 0) + dt;
    }
    // the oldest slabs go once there are too many lying about
    while (this.chunks.filter((c) => c.body).length > THROW.max) {
      const i = this.chunks.findIndex((c) => c.body);
      this.removeChunk(this.chunks[i]);
      this.chunks.splice(i, 1);
    }
  }

  removeChunk(c) {
    c.mesh.removeFromParent();
    c.mesh.geometry.dispose();
    if (c.body && !this.physics.freed) {
      this.physics.world.removeRigidBody(c.body);
      this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== c.body);
    }
  }

  // ------------------------------------------------------------------------------- the waves
  updateWaves(dt) {
    const P = this.player, d = P.position.distanceTo(this.position), grade = this.engine.gradeUniforms;
    for (const w of this.waves) {
      w.r += dt * 26;
      if (!w.hit && w.r >= d && d < WAVE.reach) {
        w.hit = true;
        const dealt = this.powers.damage(WAVE.damage * (1 - (d / WAVE.reach) * 0.5), null, 'psychic');
        if (dealt > 0) this.onHurtHal?.('wave');
        this.pulse = 1;
      }
    }
    this.waves = this.waves.filter((w) => w.r < WAVE.reach + 6);
    // the screen swims as it goes through him (the dream's warp, briefly)
    this.pulse = Math.max(0, (this.pulse ?? 0) - dt * 1.4);
    if (this.fighting || this.pulse > 0) grade.uDream.value = Math.max(this.dreamFloor ?? 0, this.pulse * 0.45);
    this.ringMesh ??= this.buildWaveMesh();
    const w = this.waves[0];
    this.ringMesh.visible = !!w;
    if (w) {
      this.ringMesh.position.copy(this.position).y += 1.2;
      this.ringMesh.scale.setScalar(w.r);
      this.ringMesh.material.uniforms.uFade.value = 1 - w.r / (WAVE.reach + 6);
    }
  }

  buildWaveMesh() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.ShaderMaterial({
      uniforms: { uFade: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uFade; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.75, 0.7, 0.95) * f * uFade * 0.6, 1.0); }',
    }));
    m.renderOrder = 23;
    this.scene.add(m);
    return m;
  }

  dispose() {
    this.powers.removeTarget(this.tg);
    for (const c of this.chunks) this.removeChunk(c);
    this.chunks = [];
    this.shell.removeFromParent();
    this.ringMesh?.removeFromParent();
    if (!this.physics.freed) this.physics.world.removeRigidBody(this.rb);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
  }
}

// The shell of force round him: a faint, warping skin, brightest at its rim, rippling where hit.
function shellMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uHit: { value: 0 }, uHitPos: { value: new THREE.Vector3() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN, vV, vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uOn, uHit; uniform vec3 uHitPos; varying vec3 vN, vV, vW;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float sw = 0.6 + 0.4 * sin(vW.y * 9.0 + uTime * 3.0 + sin(vW.x * 7.0 + uTime * 2.0));
        float d = distance(vW, uHitPos), rip = uHit * exp(-pow((d - (1.0 - uHit) * 2.2) * 4.0, 2.0));
        gl_FragColor = vec4(vec3(0.78, 0.74, 1.0) * (f * sw * 0.55 + rip * 1.4) * uOn, 1.0);
      }`,
  });
}

const _look = new THREE.Vector3(), _tp = new THREE.Vector3(), _tq = new THREE.Vector3(), _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3(), _td = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
