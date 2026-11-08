import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { glowTexture } from '../fx/Textures.js';
import { Particles } from '../fx/Particles.js';

// Training drones: hard-surface robots made of rigid parts (no skinning), flown by a damped spring
// toward where their AI wants them, so blows knock them around physically and they recover.
// Attackers circle Hal and take turns firing (an "attack token" keeps it to two at once, the way
// action games pace a crowd), each shot telegraphed by a charging eye and an aim line. Dead
// drones spiral down trailing smoke, then burst into their parts.

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const BOLT = { speed: 26, damage: 5, life: 3 };
const RED = new THREE.Color(3.2, 0.5, 0.25);

let kit = null;
function droneKit() {
  if (kit) return kit;
  const metal = new THREE.MeshStandardMaterial({ color: 0x485158, roughness: 0.32, metalness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.5, metalness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0f3a22, roughness: 0.4, metalness: 0.6, emissive: 0x0a3a18, emissiveIntensity: 0.6 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: RED.clone() });
  const jet = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.35) });
  const core = new THREE.LatheGeometry([[0, -0.22], [0.2, -0.2], [0.34, -0.1], [0.38, 0], [0.36, 0.07], [0.28, 0.15], [0.14, 0.2], [0, 0.21]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const plate = new RoundedBoxGeometry(0.34, 0.2, 0.07, 2, 0.025);
  const bezel = new THREE.TorusGeometry(0.115, 0.03, 10, 28);
  const lens = new THREE.CircleGeometry(0.1, 24);
  const pod = new THREE.CylinderGeometry(0.07, 0.09, 0.22, 12);
  const nozzle = new THREE.CircleGeometry(0.065, 16);
  const fin = new THREE.BoxGeometry(0.02, 0.16, 0.12);
  const ring = new THREE.TorusGeometry(0.385, 0.018, 6, 40);
  kit = { metal, dark, trim, eyeMat, jet, core, plate, bezel, lens, pod, nozzle, fin, ring, glow: glowTexture('rgba(255,255,255,1)', 'rgba(255,90,60,0.4)') };
  return kit;
}

// The drone's parts, each its own mesh (so it can break apart). Faces +Z.
function buildDrone() {
  const k = droneKit(), g = new THREE.Group(), parts = [];
  const add = (geo, mat, pos, rot, size) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    m.userData.size = size;
    g.add(m);
    parts.push(m);
    return m;
  };
  add(k.core, k.metal, [0, 0, 0], null, [0.36, 0.2, 0.36]);
  add(k.ring, k.trim, [0, 0.0, 0], [Math.PI / 2, 0, 0], [0.38, 0.03, 0.38]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    add(k.plate, k.dark, [Math.sin(a) * 0.36, 0.02, Math.cos(a) * 0.36], [0, a, 0], [0.17, 0.1, 0.04]);
  }
  add(k.bezel, k.dark, [0, 0.02, 0.33], null, [0.13, 0.13, 0.03]);
  const eye = add(k.lens, k.eyeMat, [0, 0.02, 0.345], null, [0.1, 0.1, 0.02]);
  for (const s of [-1, 1]) {
    add(k.pod, k.dark, [s * 0.26, -0.19, -0.04], [0.15, 0, s * 0.2], [0.08, 0.11, 0.08]);
    const n = add(k.nozzle, k.jet, [s * 0.285, -0.3, -0.06], [Math.PI / 2, 0, 0], [0.06, 0.01, 0.06]);
    n.castShadow = false;
    add(k.fin, k.metal, [s * 0.12, 0.25, -0.1], [0.3, 0, s * 0.25], [0.01, 0.08, 0.06]);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: k.glow, color: new THREE.Color(1, 0.3, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  halo.scale.setScalar(0.5);
  halo.position.set(0, 0.02, 0.38);
  g.add(halo);
  return { group: g, parts, eye, halo };
}

class Drone {
  constructor(swarm, position, kind) {
    this.swarm = swarm;
    this.kind = kind;
    this.maxHealth = this.health = kind === 'target' ? 40 : 70;
    this.radius = 0.6;
    this.alive = true;
    this.state = 'spawn';
    this.t = 0;
    this.stagger = 0;
    this.cool = 1.5 + Math.random() * 2;
    this.orbit = Math.random() * Math.PI * 2;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitR = 8.5 + Math.random() * 4.5;
    this.alt = 2 + Math.random() * 3;
    this.home = position.clone();
    this.target = position.clone();
    const { group, parts, eye, halo } = buildDrone();
    Object.assign(this, { group, parts, eye, halo });
    group.position.copy(position).y -= 1.5;
    group.scale.setScalar(0.01);
    this.size = 1.4; // the model is built at about 0.8 m across
    swarm.scene.add(group);
    const world = swarm.physics.world;
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y - 1.5, position.z)
      .setGravityScale(0).setLinearDamping(0.8).setAngularDamping(4).lockRotations().setCcdEnabled(true));
    this.collider = world.createCollider(RAPIER.ColliderDesc.ball(this.radius).setDensity(60).setRestitution(0.3), this.body);
    this.position = new THREE.Vector3().copy(position);
    this.vel = new THREE.Vector3();
    this.look = new THREE.Quaternion();
    swarm.physics.dynamics.push({ body: this.body, mesh: this.proxy = new THREE.Object3D() });
  }

  // Damage from a construct. Returns the damage dealt.
  hit(amount, point, dir) {
    if (!this.alive) return 0;
    this.health -= amount;
    this.stagger = Math.max(this.stagger, amount > 20 ? 0.6 : 0.12);
    this.flashT = 0.12;
    this.swarm.onHit?.(this, amount, point);
    if (this.health <= 0) this.die(dir);
    return amount;
  }

  die(dir) {
    this.alive = false;
    this.state = 'dying';
    this.t = 0;
    this.body.setEnabledRotations(true, true, true, true);
    this.body.setGravityScale(1, true);
    this.body.setLinearDamping(0.1);
    this.body.setAngularDamping(0.4);
    this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3 }, true);
    if (dir) this.body.applyImpulse({ x: dir.x * 8, y: 4, z: dir.z * 8 }, true);
    this.swarm.release(this);
    this.swarm.audio.droneDown();
    this.swarm.onKill?.(this);
  }

  update(dt, t) {
    const S = this.swarm, hal = S.player.position;
    this.t += dt;
    const tr = this.body.translation();
    this.position.set(tr.x, tr.y, tr.z);
    const lv = this.body.linvel();
    this.vel.set(lv.x, lv.y, lv.z);

    if (this.state === 'dying') return this.updateDying(dt, t);

    // where the AI wants to be
    if (this.state === 'spawn') {
      const k = Math.min(1, this.t / 0.9);
      this.group.scale.setScalar(this.size * (0.01 + 0.99 * (1 - (1 - k) ** 3)));
      this.target.copy(this.home);
      if (k >= 1) this.state = this.kind === 'target' ? 'idle' : 'engage';
    } else if (this.kind === 'target') {
      this.target.copy(this.home).y += Math.sin(t * 1.3 + this.orbit) * 0.25;
      this.target.x += Math.sin(t * 0.4 + this.orbit) * 0.6;
    } else this.steer(dt, hal);

    // damped spring toward the target, gentler while staggered; plus separation from the others
    const kp = this.stagger > 0 ? 4 : 18, kd = this.stagger > 0 ? 2 : 7.5;
    _a.subVectors(this.target, this.position).multiplyScalar(kp).addScaledVector(this.vel, -kd);
    for (const o of S.drones) {
      if (o === this || !o.alive) continue;
      _b.subVectors(this.position, o.position);
      const d = _b.length();
      if (d < 2.2 && d > 1e-3) _a.addScaledVector(_b.divideScalar(d), (2.2 - d) * 14);
    }
    const maxA = 16;
    if (_a.length() > maxA) _a.setLength(maxA);
    const m = this.body.mass();
    this.body.applyImpulse({ x: _a.x * m * dt, y: _a.y * m * dt, z: _a.z * m * dt }, true);
    this.stagger = Math.max(0, this.stagger - dt);

    // face Hal (or drift idly), banking with lateral velocity
    _b.set(hal.x, hal.y + 1.3, hal.z).sub(this.position);
    _m.lookAt(_c.set(0, 0, 0), _b.negate(), UP);
    _q.setFromRotationMatrix(_m);
    const bank = clamp(this.vel.dot(_c.set(1, 0, 0).applyQuaternion(_q)) * -0.06, -0.5, 0.5);
    _q.multiply(new THREE.Quaternion().setFromAxisAngle(_c.set(0, 0, 1), bank + Math.sin(t * 2 + this.orbit) * 0.05));
    if (this.stagger > 0) _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(this.t * 37) * 0.25 * this.stagger, 0, Math.cos(this.t * 29) * 0.3 * this.stagger)));
    this.look.slerp(_q, 1 - Math.exp(-8 * dt));
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.look);

    // eye: charge glow, hit flash
    this.flashT = Math.max(0, (this.flashT ?? 0) - dt);
    const charge = this.state === 'aim' ? Math.min(1, this.aimT / 0.75) : 0;
    this.eye.material.color.copy(RED).multiplyScalar(1 + charge * 1.6 + (this.flashT > 0 ? 2 : 0));
    this.halo.material.opacity = 0.5 + charge * 0.5;
    this.halo.scale.setScalar(0.5 + charge * 0.6);
    this.updateAttack(dt);
  }

  // Circle Hal at a chosen radius and height, drifting around him, staying out of cover and inside
  // the arena; reposition when there's no line of sight.
  steer(dt, hal) {
    const S = this.swarm;
    this.orbit += this.orbitDir * dt * (this.state === 'aim' ? 0.05 : 0.32);
    if (Math.random() < dt * 0.15) this.orbitDir *= -1;
    const flying = S.player.flying;
    const baseY = flying ? hal.y : 0;
    this.target.set(hal.x + Math.sin(this.orbit) * this.orbitR, baseY + this.alt + (flying ? -1 : 0), hal.z + Math.cos(this.orbit) * this.orbitR);
    const r = Math.hypot(this.target.x, this.target.z), lim = S.arena - 2.5;
    if (!flying && r > lim) this.target.multiplyScalar(lim / r).setY(baseY + this.alt);
    for (const b of S.blocks) {
      const dx = this.target.x - b.x, dz = this.target.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r + 1.2 && this.target.y < b.h + 1) this.target.y = b.h + 1.2;
    }
    if (this.target.y < 1.2) this.target.y = 1.2;
  }

  updateAttack(dt) {
    const S = this.swarm;
    if (this.kind !== 'attacker' || this.state === 'spawn') return;
    const hal = _c.copy(S.player.position).setY(S.player.position.y + 1.2);
    if (this.state === 'engage') {
      this.cool -= dt;
      if (this.cool <= 0 && S.takeToken(this)) {
        if (S.sees(this, hal)) { this.state = 'aim'; this.aimT = 0; S.audio.droneCharge(); }
        else { S.release(this); this.cool = 0.6; this.orbitDir *= -1; }
      }
    } else if (this.state === 'aim') {
      this.aimT += dt;
      S.aimLine(this, hal, this.aimT / 0.75);
      if (this.aimT >= 0.75) { this.state = 'fire'; this.shots = 3; this.shotT = 0; }
    } else if (this.state === 'fire') {
      this.shotT -= dt;
      if (this.shotT <= 0 && this.shots > 0) {
        this.shots--;
        this.shotT = 0.13;
        S.fire(this, hal);
      }
      if (this.shots <= 0 && this.shotT <= 0) {
        this.state = 'engage';
        this.cool = 2.2 + Math.random() * 2.5;
        S.release(this);
      }
    }
    if (this.stagger > 0.3 && (this.state === 'aim' || this.state === 'fire')) { this.state = 'engage'; this.cool = 1.2; S.release(this); }
  }

  updateDying(dt, t) {
    const S = this.swarm;
    this.group.position.copy(this.position);
    const r = this.body.rotation();
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    this.eye.material.color.copy(RED).multiplyScalar(Math.random() < 0.3 ? 0.2 : 1.5);
    if (Math.random() < 0.8) S.smoke.emit(1, (p, v) => {
      p[0] = this.position.x; p[1] = this.position.y; p[2] = this.position.z;
      v[0] = (Math.random() - 0.5) * 0.4; v[1] = 0.6 + Math.random() * 0.5; v[2] = (Math.random() - 0.5) * 0.4;
    }, { life: 2.2, size: [0.3, 1.4], color: [[0.08, 0.08, 0.09, 0.55], [0.12, 0.12, 0.13, 0]] });
    if (Math.random() < 0.5) S.sparks.emit(2, (p, v) => {
      p[0] = this.position.x; p[1] = this.position.y; p[2] = this.position.z;
      v[0] = (Math.random() - 0.5) * 4; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 4;
    }, { life: 0.5, size: [0.04, 0.01], color: [[4, 2, 0.6, 1], [2, 0.4, 0.05, 0]] });
    const landed = this.t > 0.25 && this.position.y < 0.7 + this.radius;
    if (landed || this.t > 1.4) this.burst();
  }

  // Break into parts: each becomes its own small physics body, thrown outward.
  burst() {
    const S = this.swarm, world = S.physics.world;
    S.explosion(this.position);
    this.group.updateMatrixWorld(true);
    for (const part of this.parts) {
      const wp = part.getWorldPosition(new THREE.Vector3()), wq = part.getWorldQuaternion(new THREE.Quaternion());
      part.removeFromParent();
      part.position.copy(wp);
      part.quaternion.copy(wq);
      S.scene.add(part);
      part.scale.multiplyScalar(this.size);
      const sz = (part.userData.size ?? [0.05, 0.05, 0.05]).map((v) => v * this.size);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(wp.x, wp.y, wp.z).setRotation(wq).setLinearDamping(0.2).setAngularDamping(0.6));
      world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(0.01, sz[0]), Math.max(0.01, sz[1]), Math.max(0.01, sz[2])).setDensity(800).setFriction(0.8).setRestitution(0.25), body);
      _a.subVectors(wp, this.position).normalize().multiplyScalar(2 + Math.random() * 4);
      body.setLinvel({ x: _a.x + this.vel.x * 0.4, y: _a.y + 2.5 + Math.random() * 2, z: _a.z + this.vel.z * 0.4 }, true);
      body.setAngvel({ x: (Math.random() - 0.5) * 14, y: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 14 }, true);
      S.physics.dynamics.push({ body, mesh: part });
      S.debris.push({ body, mesh: part, t: 0, base: part.scale.x });
    }
    this.group.removeFromParent();
    this.remove();
    this.state = 'gone';
  }

  remove() {
    const S = this.swarm;
    const i = S.physics.dynamics.findIndex((d) => d.body === this.body);
    if (i >= 0) S.physics.dynamics.splice(i, 1);
    S.powers.removeTarget(this);
    S.physics.world.removeRigidBody(this.body);
    this.group.removeFromParent();
  }
}

export class DroneSwarm {
  constructor({ scene, physics, powers, player, audio, director, arena = 40, blocks = [] }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, arena, blocks });
    this.drones = [];
    this.tokens = new Set();
    this.maxTokens = 2;
    this.debris = [];
    this.sparks = new Particles(500, { additive: true, gravity: -9.8, drag: 0.6 });
    this.smoke = new Particles(300, { additive: false, soft: 0.15, puffy: true, drag: 0.4, wind: new THREE.Vector3(0.3, 0.1, 0.1) });
    this.flare = new Particles(200, { additive: true, drag: 3 });
    for (const p of [this.sparks, this.smoke, this.flare]) scene.add(p.points);
    // enemy bolts: one instanced, additive streak mesh
    this.bolts = [];
    const geo = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 6).rotateX(Math.PI / 2);
    this.boltMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.6, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 96);
    this.boltMesh.count = 0;
    this.boltMesh.frustumCulled = false;
    scene.add(this.boltMesh);
    // aim lines while a drone charges
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 6), 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.15), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.lineCount = 0;
    this.light = new THREE.PointLight(0xff6a3a, 0, 10, 2);
    scene.add(this.light);
    this.onHit = this.onKill = this.onPlayerHit = null;
  }

  spawn(position, kind = 'attacker') {
    const d = new Drone(this, position, kind);
    this.drones.push(d);
    this.powers.addTarget(d);
    this.audio.droneSpawn();
    this.sparks.emit(30, (p, v) => {
      p[0] = position.x; p[1] = position.y - 1; p[2] = position.z;
      const a = Math.random() * Math.PI * 2;
      v[0] = Math.cos(a) * 2; v[1] = 1 + Math.random() * 3; v[2] = Math.sin(a) * 2;
    }, { life: 0.6, size: [0.05, 0], color: [[3, 1, 0.5, 1], [1, 0.2, 0.05, 0]] });
    return d;
  }

  get alive() { return this.drones.filter((d) => d.alive); }

  takeToken(d) {
    if (this.tokens.has(d)) return true;
    if (this.tokens.size >= this.maxTokens) return false;
    this.tokens.add(d);
    return true;
  }
  release(d) { this.tokens.delete(d); }

  // Line of sight from a drone to a point (cover, walls and the shield block it).
  sees(d, point) {
    _a.subVectors(point, d.position);
    const len = _a.length();
    const hit = this.physics.world.castRay(new RAPIER.Ray(d.position, _a.divideScalar(len)), len, true, undefined, undefined, d.collider, undefined, (c) => c.handle !== this.player.collider?.handle && !this.isDrone(c));
    return !hit || hit.timeOfImpact > len - 0.6;
  }

  isDrone(collider) { return this.drones.some((d) => d.collider === collider); }

  aimLine(d, at, k) {
    if (this.lineCount >= 16) return;
    const p = this.lines.geometry.attributes.position, i = this.lineCount++ * 2;
    const from = _a.set(0, 0.02, 0.38 * d.size).applyQuaternion(d.look).add(d.position);
    p.setXYZ(i, from.x, from.y, from.z);
    const flick = 0.6 + 0.4 * Math.sin(k * 40);
    _b.subVectors(at, from).multiplyScalar(Math.min(1, 0.3 + k) * flick).add(from);
    p.setXYZ(i + 1, _b.x, _b.y, _b.z);
  }

  // Three bolts at where Hal will be, with a little spread.
  fire(d, at) {
    const from = new THREE.Vector3(0, 0.02, 0.45 * d.size).applyQuaternion(d.look).add(d.position);
    const p = this.player, lead = from.distanceTo(at) / BOLT.speed;
    const aim = at.clone();
    if (p.flying) aim.addScaledVector(p.vel, lead * 0.8);
    else aim.add(_a.set(Math.sin(p.yaw) * p.speed, 0, Math.cos(p.yaw) * p.speed).multiplyScalar(lead * 0.8));
    aim.x += (Math.random() - 0.5) * 0.8; aim.y += (Math.random() - 0.5) * 0.5; aim.z += (Math.random() - 0.5) * 0.8;
    const vel = aim.sub(from).normalize().multiplyScalar(BOLT.speed);
    this.bolts.push({ pos: from, prev: from.clone(), vel, t: 0, owner: d });
    this.flare.emit(6, (q, v) => { q[0] = from.x; q[1] = from.y; q[2] = from.z; v[0] = vel.x * 0.05 + (Math.random() - 0.5); v[1] = vel.y * 0.05 + (Math.random() - 0.5); v[2] = vel.z * 0.05 + (Math.random() - 0.5); }, { life: 0.18, size: [0.25, 0], color: [[4, 1, 0.5, 1], [2, 0.3, 0.1, 0]] });
    d.body.applyImpulse({ x: -vel.x * 0.06, y: -vel.y * 0.06, z: -vel.z * 0.06 }, true); // recoil
    this.audio.droneShot();
  }

  updateBolts(dt) {
    const world = this.physics.world, P = this.powers, player = this.player;
    const keep = [];
    for (const b of this.bolts) {
      b.t += dt;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      _a.subVectors(b.pos, b.prev);
      const len = _a.length();
      let done = b.t > BOLT.life;
      if (len > 1e-5 && !done) {
        const hit = world.castRay(new RAPIER.Ray(b.prev, _a.divideScalar(len)), len, true, undefined, undefined, b.owner.collider, undefined, (c) => !this.isDrone(c) && !P.bounds?.has(c.handle));
        if (hit) {
          const at = b.prev.clone().addScaledVector(_a, hit.timeOfImpact);
          const h = hit.collider.handle;
          if (P.shield && h === P.shield.col.handle) { P.shield.ripple(at); this.audio.shieldHit(0.6); P.stats.blocks++; }
          else if (h === player.collider?.handle) { P.damage(BOLT.damage, b.prev); this.onPlayerHit?.(); }
          this.impact(at);
          done = true;
        }
      }
      // whip past Hal's head
      if (!done && !b.whizzed && b.pos.distanceTo(_c.copy(player.position).setY(player.position.y + 1.5)) < 1.4) { b.whizzed = true; this.audio.whiz(); }
      if (!done) keep.push(b);
    }
    this.bolts = keep;
    const mesh = this.boltMesh;
    keep.forEach((b, i) => {
      _q.setFromUnitVectors(_c.set(0, 0, 1), _a.copy(b.vel).normalize());
      _m.compose(b.pos, _q, _b.set(1, 1, 1));
      mesh.setMatrixAt(i, _m);
    });
    mesh.count = keep.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  impact(at) {
    this.sparks.emit(14, (p, v) => {
      p[0] = at.x; p[1] = at.y; p[2] = at.z;
      v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 5;
    }, { life: 0.4, size: [0.05, 0], color: [[4, 1, 0.4, 1], [1.5, 0.2, 0.05, 0]] });
  }

  explosion(at) {
    this.audio.explosion(0.35);
    this.director.shake(0.15, 0.4);
    this.physics.burst(at, 3, 3.5, 1.5, 1);
    this.light.position.copy(at);
    this.light.intensity = 40;
    this.sparks.emit(60, (p, v) => {
      p[0] = at.x; p[1] = at.y; p[2] = at.z;
      _a.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 7);
      v[0] = _a.x; v[1] = _a.y; v[2] = _a.z;
    }, { life: 0.9, size: [0.07, 0.01], color: [[5, 2.2, 0.7, 1], [2, 0.4, 0.05, 0]] });
    this.flare.emit(14, (p, v) => {
      p[0] = at.x; p[1] = at.y; p[2] = at.z;
      v[0] = (Math.random() - 0.5) * 3; v[1] = (Math.random() - 0.5) * 3; v[2] = (Math.random() - 0.5) * 3;
    }, { life: 0.35, size: [1.4, 0.2], color: [[5, 2.4, 0.8, 1], [2, 0.3, 0.05, 0]] });
    this.smoke.emit(12, (p, v) => {
      p[0] = at.x + (Math.random() - 0.5) * 0.5; p[1] = at.y; p[2] = at.z + (Math.random() - 0.5) * 0.5;
      v[0] = (Math.random() - 0.5) * 1.2; v[1] = 0.6 + Math.random(); v[2] = (Math.random() - 0.5) * 1.2;
    }, { life: 3, size: [0.6, 2.4], color: [[0.09, 0.09, 0.1, 0.6], [0.13, 0.13, 0.14, 0]] });
  }

  update(dt, t) {
    const cam = this.powers.engine.camera, renderer = this.powers.engine.renderer;
    this.lineCount = 0;
    for (const d of this.drones) d.update(dt, t);
    this.drones = this.drones.filter((d) => d.state !== 'gone');
    this.updateBolts(dt);
    const lp = this.lines.geometry.attributes.position;
    for (let i = this.lineCount * 2; i < 32; i++) lp.setXYZ(i, 0, -999, 0);
    lp.needsUpdate = true;
    this.light.intensity = Math.max(0, this.light.intensity - dt * 160);
    // spent parts sink into the deck after a while
    this.debris = this.debris.filter((p) => {
      p.t += dt;
      if (p.t < 9) return true;
      const k = Math.min(1, (p.t - 9) / 1.5);
      p.mesh.scale.setScalar(p.base * (1 - k));
      if (k < 1) return true;
      const i = this.physics.dynamics.findIndex((d) => d.body === p.body);
      if (i >= 0) this.physics.dynamics.splice(i, 1);
      this.physics.world.removeRigidBody(p.body);
      p.mesh.removeFromParent();
      return false;
    });
    for (const p of [this.sparks, this.smoke, this.flare]) p.update(dt, t, cam, renderer);
  }

  clear() {
    for (const d of this.drones) if (d.state !== 'gone') d.remove();
    this.drones = [];
    this.bolts = [];
    this.tokens.clear();
  }
}
