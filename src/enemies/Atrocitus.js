import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { createAtrocitus } from '../characters/Characters.js';
import { Particles } from '../fx/Particles.js';
import { glowTexture } from '../fx/Textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const HEALTH = 640;
const CHEST = 1.6; // his chest's height (he's 2.25 m)
const WALK = 2.1;
const CHARGE = { wind: 0.85, speed: 11, time: 1.25, damage: 20, reach: 1.8, stun: 2.4 };
const BEAM = { speed: 19, damage: 16, pick: 10 };
const BLOOD = { count: 7, speed: 16, damage: 5, burn: 4.5, dps: 9 };
const SLAM = { wind: 0.75, reach: 9.5, speed: 17, damage: 14, near: 4 };

// Atrocitus, downtown (Part Four): the last of Ysmault's Five Inversions, out of Abin Sur's cell and
// strong enough to break a Lantern with his hands. On foot and heavy (a kinematic body the ring's
// constructs hit but don't shove), he comes on at a walk and picks from four things, each with a
// tell: a charge (he drops his head and a red line runs out along the ground; he comes in a straight
// rush, and a wall or a held shield in his way stops him dead and stuns him, which is the opening);
// a steel beam off the site's floor, lifted overhead and thrown (the shield or a wall stops it); his
// blood, the Inversions' magic, drawn from his palm and flung in a fan of burning drops that leave
// fires on the ground; and close in, both fists into the ground, a shockwave that only flight gets
// over. His health is the bar across the top; the story ends the fight from it.
export class Atrocitus {
  constructor({ scene, physics, powers, player, audio, director, engine, mocap, characters, ground = () => 0, center = V(0, 0, 0), radius = 30, blocks = [], loose = [] }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, engine, ground, center, radius, blocks, loose });
    const rig = (this.rig = createAtrocitus(characters.atrocitus));
    scene.add(rig.root);
    this.anim = new Animator(rig);
    this.loco = new Locomotion(mocap);
    this.loco.scale = rig.hipsHeight / mocap.hipsHeight;
    this.loco.relax = { elbow: 0.3, wrist: 0.5, adduct: 0 };
    this.anim.play(this.loco, 0);
    this.anim.look.maxYaw = 0.6;
    this.anim.lookAt(() => player.rig.bonePosition('head', _look), 0.5);
    this.anim.feet.ground = ground;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.state = 'stand'; // stand | fight | script
    this.action = null;
    this.cool = 2;
    this.stun = 0;
    this.globs = [];
    this.burns = [];
    this.waves = [];
    this.onQuip = this.onHurtHal = null;

    // a capsule for the ring to hit, moved with him
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.7, 0.62), this.rb);
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: 0.9, health: HEALTH, maxHealth: HEALTH, alive: true, hit: (a, p, d) => this.hit(a, p, d) };
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() }); // (the fist's and the hammer's impacts look for targets there)

    // the tells and the blood: a red line along the ground, the slam's ring, the drops and fires
    const red = new THREE.Color(2.6, 0.25, 0.12);
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: red, map: lineTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.line.renderOrder = 23;
    scene.add(this.line);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.22, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.renderOrder = 23;
    scene.add(this.ring);
    this.fx = new Particles(900, { additive: true, drag: 1.1, turbulence: 0.9 });
    scene.add(this.fx.points);
    this.dropGeo = new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1, 1.8); // drawn out along its flight
    this.dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.06, 0.02) });
    this.burnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.3, 0.08), map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.32)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.handLight = new THREE.PointLight(0xff2a10, 0, 6, 2);
    scene.add(this.handLight);
  }

  get position() { return this.rig.root.position; }
  get health() { return this.tg.health / this.tg.maxHealth; }

  place(at, yaw = this.yaw) {
    this.rig.root.position.copy(at);
    this.rig.root.position.y = this.ground(at.x, at.z);
    this.yaw = yaw;
    this.rig.root.rotation.y = yaw;
    this.vel.set(0, 0, 0);
    this.syncBody(true);
  }

  engage() {
    this.state = 'fight';
    this.powers.addTarget(this.tg);
    this.cool = 1.2;
  }

  // out of the fight (the story takes him): whatever he was doing stops
  disengage() {
    this.state = 'script';
    this.endAction();
    this.vel.set(0, 0, 0);
    this.powers.removeTarget(this.tg);
  }

  hit(amount, point) {
    if (this.state !== 'fight' || !this.tg.alive) return 0;
    if (this.stun > 0) amount *= 1.5; // reeling: open
    this.tg.health = Math.max(1, this.tg.health - amount);
    if (amount > 30) this.onQuip?.('hurt');
    this.flinch = Math.min(1, (this.flinch ?? 0) + amount / 60);
    void point;
    return amount;
  }

  // ---------------------------------------------------------------------------------- update
  update(dt, t) {
    if (dt <= 0) return;
    const root = this.rig.root, P = this.player;
    this.stun = Math.max(0, this.stun - dt);
    this.flinch = Math.max(0, (this.flinch ?? 0) - dt * 2.5);
    if (this.state === 'fight') this.think(dt);
    // moving: walking to Hal, or the rush; inside the site, round its columns
    const p = root.position;
    p.addScaledVector(this.vel, dt);
    _a.set(p.x - this.center.x, 0, p.z - this.center.z);
    if (_a.length() > this.radius) { _a.setLength(this.radius); p.x = this.center.x + _a.x; p.z = this.center.z + _a.z; }
    for (const b of this.blocks) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), r = b.r + 0.75;
      if (d < r) { p.x = b.x + (dx / (d || 1)) * r; p.z = b.z + (dz / (d || 1)) * r; }
    }
    p.y = damp(p.y, this.ground(p.x, p.z), 12, dt);
    // facing: Hal in the fight, unless a rush has locked his line; out of it, the way he walks
    const hs0 = Math.hypot(this.vel.x, this.vel.z);
    const want = this.action?.lock ?? (this.state === 'fight' ? Math.atan2(P.position.x - p.x, P.position.z - p.z) : hs0 > 0.2 ? Math.atan2(this.vel.x, this.vel.z) : this.faceYaw ?? this.yaw);
    const turn = this.action?.kind === 'charge' && this.action.phase === 'rush' ? 0 : 3.2;
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -turn * dt, turn * dt));
    root.rotation.y = this.yaw;
    this.syncBody();
    this.tg.position.copy(p).y += CHEST - 0.1;
    // the body: the gait from his speed; leaning into a rush, rocked back by a stun or a big hit
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.loco.speed = damp(this.loco.speed, hs, 8, dt);
    const lean = this.anim.lean;
    const pitch = (this.action?.lean ?? 0) + hs * 0.018 - this.stun * 0.12 - this.flinch * 0.18;
    lean.pitch = damp(lean.pitch, clamp(pitch, -0.35, 0.55), 6, dt);
    this.updateBeamHeld(dt);
    this.updateGlobs(dt, t);
    this.updateBurns(dt, t);
    this.updateWaves(dt);
    this.fx.update(dt, t, this.engine.camera, this.engine.renderer);
    this.anim.update(dt);
    this.handLight.intensity = damp(this.handLight.intensity, this.action?.glow ?? 0, 8, dt);
    if (this.handLight.intensity > 0.01) this.rig.bonePosition('hand_R', this.handLight.position);
  }

  syncBody(teleport = false) {
    const p = this.rig.root.position, at = { x: p.x, y: p.y + 1.3, z: p.z };
    if (teleport) this.rb.setTranslation(at, true);
    else this.rb.setNextKinematicTranslation(at);
  }

  // A point in his body frame (metres, +Z ahead), in the world.
  local(x, y, z, out) {
    return out.set(x, y, z).applyAxisAngle(_up, this.yaw).add(this.rig.root.position);
  }

  think(dt) {
    const P = this.player, me = this.position, hal = P.position;
    const d = Math.hypot(hal.x - me.x, hal.z - me.z), up = hal.y - this.ground(hal.x, hal.z);
    if (this.action) { this.runAction(dt, d); return; }
    if (this.stun > 0) { this.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); return; }
    // walking in on him
    _a.set(hal.x - me.x, 0, hal.z - me.z).normalize();
    const pace = d > 6 ? WALK : d > 3.2 ? WALK * 0.5 : 0;
    this.vel.lerp(_a.multiplyScalar(pace), Math.min(1, dt * 3));
    this.cool -= dt;
    if (this.cool > 0) return;
    const r = Math.random();
    if (d < SLAM.near && up < 2) this.begin('slam');
    else if (d > 6 && d < 18 && up < 1.2 && r < 0.4 && this.clearLine(hal)) this.begin('charge');
    else if (r < 0.75 && this.nearestBeam()) this.begin('beam');
    else this.begin('blood');
  }

  begin(kind) {
    const a = (this.action = { kind, phase: 'wind', t: 0, lean: 0, glow: 0 });
    const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); }; // (each target its own vector)
    if (kind === 'charge') {
      a.lock = this.yaw;
      this.vel.set(0, 0, 0);
      this.anim.armSpread = 0.45;
      this.roar(0.9);
      this.onQuip?.('charge');
    } else if (kind === 'beam') {
      a.beam = this.nearestBeam();
      a.beam.claimed = true;
      a.phase = 'fetch';
    } else if (kind === 'blood') {
      this.vel.set(0, 0, 0);
      this.anim.reach('R', R(-0.3, 1.85, 0.42), { pole: V(-1, -0.4, -0.3), rate: 6 });
      this.anim.reach('L', R(0.05, 1.7, 0.5), { pole: V(1, -0.4, -0.3), rate: 6 });
      a.glow = 4;
      this.audio.tone({ type: 'sawtooth', freq: 120, to: 70, attack: 0.3, peak: 0.06, dur: 0.8, wet: 0.5 });
      this.audio.burst({ type: 'bandpass', from: 2400, to: 600, q: 1.2, attack: 0.25, peak: 0.12, dur: 0.6, wet: 0.3 });
    } else if (kind === 'slam') {
      this.vel.set(0, 0, 0);
      this.anim.reach('R', R(-0.32, 2.55, 0.18), { pole: V(-1, -0.2, -0.4), rate: 7 });
      this.anim.reach('L', R(0.32, 2.55, 0.18), { pole: V(1, -0.2, -0.4), rate: 7 });
      a.lean = -0.12;
      this.roar(0.6);
    }
  }

  endAction(cool = 1.4) {
    const a = this.action;
    this.action = null;
    this.cool = cool;
    this.anim.armSpread = 0;
    this.anim.reach('R', null, { rate: 4 });
    this.anim.reach('L', null, { rate: 4 });
    this.line.material.opacity = 0;
    if (a?.beam && a.beam.state === 'held') this.dropBeam(a.beam);
    if (a?.beam) a.beam.claimed = false;
  }

  runAction(dt, d) {
    const a = this.action, P = this.player, me = this.position;
    a.t += dt;
    if (a.kind === 'charge') {
      const dir = _a.set(Math.sin(a.lock), 0, Math.cos(a.lock));
      if (a.phase === 'wind') {
        // head down, the line runs out along the ground ahead of him
        a.lean = 0.38 * Math.min(1, a.t / 0.4);
        const k = Math.min(1, a.t / 0.5);
        this.line.position.copy(me).addScaledVector(dir, 0.8).y += 0.04;
        this.line.rotation.y = a.lock;
        this.line.scale.set(1.3, 1, CHARGE.speed * CHARGE.time * k);
        this.line.material.opacity = 0.75 * (0.6 + 0.4 * Math.sin(a.t * 22));
        if (a.t > CHARGE.wind) { a.phase = 'rush'; a.t = 0; this.audio.whoosh(0.8, 0.9); this.audio.rumble(1.0, 0.4); }
      } else if (a.phase === 'rush') {
        this.line.material.opacity = Math.max(0, this.line.material.opacity - dt * 3);
        this.vel.copy(dir).multiplyScalar(CHARGE.speed);
        a.lean = 0.45;
        if (Math.random() < dt * 14) this.powers.dustFx(me, 2, 1.2);
        // anything solid ahead: a wall or the shield stops him dead
        const from = _b.copy(me).y += 1.2, step = CHARGE.speed * dt + 0.9;
        const hit = this.physics.world.castRay(new RAPIER.Ray(from, dir), step, true, undefined, undefined, this.col, undefined, (c) => c.handle !== P.collider?.handle && !this.powers.bounds?.has(c.handle));
        const sh = this.powers.shield;
        const blocked = hit && (hit.collider.parent()?.isKinematic() || hit.collider.parent()?.isFixed()) && hit.timeOfImpact < step;
        if (blocked || (sh && sh.blocks?.(from) && P.position.distanceTo(me) < CHARGE.reach + 0.4)) {
          const construct = sh && (hit?.collider === sh.col || !hit) ? 'shield' : this.powers.walls?.some((w) => w.col === hit?.collider || w.collider === hit?.collider) ? 'wall' : 'solid';
          this.crash(construct, from.clone().addScaledVector(dir, hit ? hit.timeOfImpact : 0.8));
          return;
        }
        // through Hal
        if (!a.struck && P.position.distanceTo(me) < CHARGE.reach && P.position.y - me.y < 1.6) {
          a.struck = true;
          const dealt = this.powers.damage(CHARGE.damage, _c.copy(me).y += 1.2);
          if (dealt > 0) { P.dash(_d.copy(dir).addScaledVector(_up, 0.15).normalize(), 10, 0.28); this.onHurtHal?.('charge'); this.director.shake(0.5, 0.4); this.audio.impact(1.4); }
        }
        if (a.t > CHARGE.time) { a.phase = 'skid'; a.t = 0; }
      } else if (a.phase === 'skid') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
        a.lean = 0.2;
        if (a.t > 0.6) this.endAction(1.6 + Math.random());
      }
    } else if (a.kind === 'beam') {
      const b = a.beam;
      if (a.phase === 'fetch') {
        // to the beam and down to it
        const bp = b.mesh.position;
        _a.set(bp.x - me.x, 0, bp.z - me.z);
        const far = _a.length();
        a.lock = Math.atan2(_a.x, _a.z);
        // (to arm's length and no closer: he's kinematic, and walking into it shoves it away)
        if (far > 2.1) this.vel.lerp(_a.normalize().multiplyScalar(WALK * 1.3), Math.min(1, dt * 4));
        else { this.vel.set(0, 0, 0); a.phase = 'lift'; a.t = 0; this.grabBeam(b); return; }
        if (a.t > 6 || b.state !== 'loose') this.endAction(0.6);
      } else if (a.phase === 'lift') {
        a.lock = undefined;
        b.lift = Math.min(1, a.t / 0.7);
        if (a.t > 0.7) { a.phase = 'hold'; a.t = 0; this.roar(0.5); }
      } else if (a.phase === 'hold') {
        // overhead, shaking with the weight: the tell
        if (a.t > 0.75) { this.throwBeam(b); a.phase = 'after'; a.t = 0; }
      } else if (a.phase === 'after') {
        if (a.t > 0.5) this.endAction(1.2 + Math.random() * 1.2);
      }
    } else if (a.kind === 'blood') {
      if (a.phase === 'wind') {
        // his palm opened, the blood drawn and lit
        if (Math.random() < dt * 30) {
          this.rig.bonePosition('hand_R', _c);
          this.fx.emit(1, (q, v) => { q[0] = _c.x; q[1] = _c.y; q[2] = _c.z; v[0] = (Math.random() - 0.5) * 0.4; v[1] = -0.5 - Math.random(); v[2] = (Math.random() - 0.5) * 0.4; }, { life: 0.6, size: [0.07, 0.02], color: [[3, 0.4, 0.15, 1], [0.6, 0.05, 0.02, 0]] });
        }
        if (a.t > 0.75) {
          a.phase = 'fling'; a.t = 0;
          const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
          this.anim.reach('R', R(-0.1, 1.75, 0.75), { pole: V(-1, -0.3, 0), rate: 16 });
          this.anim.reach('L', null, { rate: 5 });
          this.audio.whoosh(0.45, 0.7);
        }
      } else if (a.phase === 'fling') {
        a.glow = 6;
        if (!a.thrown && a.t > 0.12) { a.thrown = true; this.fling(); }
        if (a.t > 0.6) this.endAction(1.6 + Math.random());
      }
    } else if (a.kind === 'slam') {
      if (a.phase === 'wind' && a.t > SLAM.wind) {
        a.phase = 'down'; a.t = 0;
        const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
        this.anim.reach('R', R(-0.28, 0.55, 0.8), { pole: V(-1, 0.3, -0.3), rate: 22 });
        this.anim.reach('L', R(0.28, 0.55, 0.8), { pole: V(1, 0.3, -0.3), rate: 22 });
        a.lean = 0.55;
      } else if (a.phase === 'down' && a.t > 0.16 && !a.landed) {
        a.landed = true;
        const at = this.local(0, 0, 0.9, new THREE.Vector3());
        at.y = this.ground(at.x, at.z);
        this.waves.push({ at, r: 0.5, hit: false });
        this.audio.explosion(0.5);
        this.audio.rumble(0.9, 0.6);
        this.director.shake(0.55, 0.5);
        this.powers.dustFx(at, 36, 4);
        this.physics.burst(at, 7, 7, 3, 0.6);
      } else if (a.phase === 'down' && a.t > 0.8) this.endAction(1.8 + Math.random());
    }
  }

  // stopped dead by something: by a wall or the shield he reels, and he's open
  crash(what, at) {
    const a = this.action;
    this.vel.set(0, 0, 0);
    this.endAction(0.5);
    this.stun = what === 'solid' ? 1.2 : CHARGE.stun;
    this.director.shake(0.6, 0.5);
    this.audio.impact(1.6);
    this.audio.shieldHit?.(1);
    this.powers.sparks.emit(50, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 6; }, { life: 0.6, size: [0.08, 0], color: [[1.5, 5, 2, 1], [0.2, 1.2, 0.4, 0]] });
    if (what === 'shield') this.powers.shield?.ripple?.(at);
    this.anim.gesture('shake', 1.2, 0.5);
    this.onQuip?.(what === 'solid' ? 'solid' : 'stunned');
    void a;
  }

  clearLine(to) {
    _a.set(to.x - this.position.x, 0, to.z - this.position.z);
    const d = _a.length();
    _b.copy(this.position).y += 1.2;
    const hit = this.physics.world.castRay(new RAPIER.Ray(_b, _a.divideScalar(d)), d, true, undefined, undefined, this.col, undefined, (c) => c.handle !== this.player.collider?.handle && !this.powers.bounds?.has(c.handle) && !c.parent()?.isDynamic());
    return !hit;
  }

  roar(peak = 0.8) {
    this.audio.tone({ type: 'sawtooth', freq: 82, to: 48, attack: 0.08, peak: 0.1 * peak, dur: 0.95, wet: 0.35 });
    this.audio.tone({ type: 'square', freq: 61, to: 40, attack: 0.1, peak: 0.05 * peak, dur: 0.9, wet: 0.35, detune: 18 });
    this.audio.burst({ buffer: this.audio.brownBuf, type: 'lowpass', from: 700, to: 160, attack: 0.06, peak: 0.45 * peak, dur: 0.9, wet: 0.3 });
  }

  // ---------------------------------------------------------------------------------- the beams
  nearestBeam() {
    let best = null, bd = BEAM.pick;
    for (const b of this.loose) {
      if (b.state !== 'loose' || b.claimed) continue;
      const v = b.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > 1) continue;
      const d = b.mesh.position.distanceTo(this.position);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  grabBeam(b) {
    b.state = 'held';
    b.lift = 0;
    b.from = b.mesh.position.clone();
    b.fromQ = b.mesh.quaternion.clone();
    b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.audio.burst({ type: 'bandpass', from: 500, to: 260, q: 4, peak: 0.3, dur: 0.4, wet: 0.3 });
    const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
    this.anim.reach('R', R(-0.36, 2.5, 0.2), { pole: V(-1, -0.2, -0.4), rate: 5 });
    this.anim.reach('L', R(0.36, 2.5, 0.2), { pole: V(1, -0.2, -0.4), rate: 5 });
  }

  // held across his shoulders, over his head: its middle between his hands
  updateBeamHeld(dt) {
    const b = this.action?.beam;
    if (!b || b.state !== 'held') return;
    const k = 1 - (1 - b.lift) ** 3, shake = this.action.phase === 'hold' ? 1 : 0;
    this.local(0, 2.62, 0.15, _c);
    _c.x += Math.sin(this.engine.time * 37) * 0.02 * shake; _c.y += Math.sin(this.engine.time * 29) * 0.025 * shake;
    _q.setFromAxisAngle(_up, this.yaw + Math.PI / 2);
    b.mesh.position.lerpVectors(b.from, _c, k);
    b.mesh.quaternion.slerpQuaternions(b.fromQ, _q, k);
    b.body.setNextKinematicTranslation(b.mesh.position);
    b.body.setNextKinematicRotation(b.mesh.quaternion);
    void dt;
  }

  throwBeam(b) {
    const P = this.player, p = b.mesh.position;
    const target = P.rig.bonePosition('chest', new THREE.Vector3());
    const T = clamp(p.distanceTo(target) / BEAM.speed, 0.3, 1.6);
    if (P.flying) target.addScaledVector(P.vel, T * 0.8);
    else target.add(_a.set(Math.sin(P.heading) * P.speed, 0, Math.cos(P.heading) * P.speed).multiplyScalar(T * 0.8));
    const v = target.sub(p).divideScalar(T);
    v.y += 0.5 * 9.81 * T;
    b.state = 'thrown';
    b.t = 0;
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.body.setAngvel({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 2 }, true);
    this.anim.reach('R', null, { rate: 8 });
    this.anim.reach('L', null, { rate: 8 });
    this.audio.whoosh(0.6, 0.9);
    this.watchBeam(b);
  }

  dropBeam(b) {
    b.state = 'loose';
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  }

  // a thrown beam hurts what it hits at speed, then lies where it fell, to be thrown again
  watchBeam(b) {
    const P = this.player;
    b.update = (dt) => {
      b.t += dt;
      const lv = b.body.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z);
      if (sp > 5 && !b.struck) {
        const chest = P.rig.bonePosition('chest', _c);
        // nearest point of the beam's axis to his chest
        _a.set(0, 0, 1).applyQuaternion(b.mesh.quaternion);
        _b.subVectors(chest, b.mesh.position);
        const s = clamp(_b.dot(_a), -b.half.z, b.half.z);
        _d.copy(b.mesh.position).addScaledVector(_a, s);
        if (_d.distanceTo(chest) < 0.75) {
          b.struck = true;
          const dealt = this.powers.damage(BEAM.damage, _d.clone());
          if (dealt > 0) { this.onHurtHal?.('beam'); this.audio.impact(1.2); }
          else this.audio.clash?.();
        }
      }
      if (b.t > 0.5 && sp < 2) { b.state = 'loose'; b.struck = false; b.update = null; }
    };
  }

  // ---------------------------------------------------------------------------------- the blood
  fling() {
    const P = this.player, hand = this.rig.bonePosition('hand_R', new THREE.Vector3());
    const aim = P.rig.bonePosition('chest', new THREE.Vector3());
    const T = hand.distanceTo(aim) / BLOOD.speed;
    if (P.flying) aim.addScaledVector(P.vel, T * 0.7);
    const base = _a.subVectors(aim, hand).normalize();
    for (let i = 0; i < BLOOD.count; i++) {
      const spread = ((i / (BLOOD.count - 1)) - 0.5) * 0.7 + (Math.random() - 0.5) * 0.06;
      const dir = base.clone().applyAxisAngle(_up, spread);
      dir.y += 0.08 + Math.random() * 0.06;
      const m = new THREE.Mesh(this.dropGeo, this.dropMat);
      m.position.copy(hand);
      this.scene.add(m);
      this.globs.push({ mesh: m, pos: m.position, prev: hand.clone(), vel: dir.normalize().multiplyScalar(BLOOD.speed * (0.92 + Math.random() * 0.16)), life: 0 });
    }
    this.audio.burst({ type: 'bandpass', from: 1500, to: 400, q: 1.5, peak: 0.25, dur: 0.35, wet: 0.3 });
  }

  updateGlobs(dt) {
    const P = this.powers, world = this.physics.world, player = this.player;
    this.globs = this.globs.filter((g) => {
      g.life += dt;
      g.prev.copy(g.pos);
      g.vel.y -= 7 * dt;
      g.pos.addScaledVector(g.vel, dt);
      g.mesh.lookAt(_c.copy(g.pos).add(g.vel));
      if (Math.random() < 0.7) this.fx.emit(1, (q, v) => { q[0] = g.pos.x; q[1] = g.pos.y; q[2] = g.pos.z; v[0] = 0; v[1] = 0.3; v[2] = 0; }, { life: 0.35, size: [0.1, 0.02], color: [[1.6, 0.22, 0.06, 0.8], [0.4, 0.04, 0.02, 0]] });
      _a.subVectors(g.pos, g.prev);
      const len = _a.length();
      let done = g.life > 3;
      if (!done && len > 1e-5) {
        const hit = world.castRay(new RAPIER.Ray(g.prev, _a.divideScalar(len)), len, true, undefined, undefined, this.col, undefined, (c) => !P.bounds?.has(c.handle));
        const gy = this.ground(g.pos.x, g.pos.z);
        if (hit || g.pos.y <= gy + 0.02) {
          const at = hit ? g.prev.clone().addScaledVector(_a, hit.timeOfImpact) : g.pos.clone().setY(gy);
          const h = hit?.collider.handle;
          if (P.shield && h === P.shield.col.handle) { P.shield.ripple(at); this.audio.shieldHit(0.4); }
          else if (h !== undefined && h === player.collider?.handle) { if (P.damage(BLOOD.damage, g.prev) > 0) this.onHurtHal?.('blood'); }
          else if (at.y < this.ground(at.x, at.z) + 0.4) this.ignite(at.setY(this.ground(at.x, at.z)));
          this.fx.emit(10, (q, v) => { q[0] = at.x; q[1] = at.y + 0.05; q[2] = at.z; v[0] = (Math.random() - 0.5) * 3; v[1] = Math.random() * 2.5; v[2] = (Math.random() - 0.5) * 3; }, { life: 0.45, size: [0.08, 0], color: [[3, 0.5, 0.15, 1], [0.4, 0.04, 0.02, 0]] });
          done = true;
        }
      }
      if (done) { g.mesh.removeFromParent(); return false; }
      return true;
    });
  }

  // where a drop lands, the ground burns for a few seconds (a hazard for Hal)
  ignite(at) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), this.burnMat.clone());
    m.position.copy(at).y += 0.04;
    m.renderOrder = 22;
    this.scene.add(m);
    const burn = { at, mesh: m, t: 0 };
    burn.hazard = { position: at, radius: 0.85, dps: BLOOD.dps, height: 1.2, active: () => burn.t < BLOOD.burn };
    this.powers.hazards.push(burn.hazard);
    this.burns.push(burn);
  }

  updateBurns(dt) {
    this.burns = this.burns.filter((b) => {
      b.t += dt;
      const k = b.t / BLOOD.burn, fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : Math.min(1, b.t * 4);
      b.mesh.material.opacity = Math.max(0, fade) * (0.75 + 0.25 * Math.sin(b.t * 13 + b.at.x));
      if (Math.random() < dt * 22 * fade) this.fx.emit(1, (q, v) => { q[0] = b.at.x + (Math.random() - 0.5) * 1.2; q[1] = b.at.y + 0.05; q[2] = b.at.z + (Math.random() - 0.5) * 1.2; v[0] = 0; v[1] = 0.9 + Math.random() * 1.1; v[2] = 0; }, { life: 0.7, size: [0.22, 0.04], color: [[2.6, 0.55, 0.12, 0.9], [0.5, 0.06, 0.02, 0]] });
      if (k >= 1) {
        b.mesh.removeFromParent();
        b.mesh.material.dispose();
        this.powers.hazards = this.powers.hazards.filter((h) => h !== b.hazard);
        return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------------- the slam
  updateWaves(dt) {
    const P = this.player;
    for (const w of this.waves) {
      w.r += SLAM.speed * dt;
      const d = Math.hypot(P.position.x - w.at.x, P.position.z - w.at.z), up = P.position.y - this.ground(P.position.x, P.position.z);
      if (!w.hit && w.r >= d && d < SLAM.reach) {
        w.hit = true;
        if (up < 1.4) {
          const dealt = this.powers.damage(SLAM.damage * (1 - (d / SLAM.reach) * 0.4), null);
          if (dealt > 0) { this.onHurtHal?.('slam'); P.dash(_a.set(P.position.x - w.at.x, 0, P.position.z - w.at.z).normalize(), 6, 0.2); }
        }
      }
    }
    this.waves = this.waves.filter((w) => w.r < SLAM.reach + 2);
    const w = this.waves[0];
    this.ring.material.opacity = w ? 0.85 * (1 - w.r / (SLAM.reach + 2)) : 0;
    if (w) { this.ring.position.copy(w.at).y += 0.06; this.ring.scale.set(w.r, 1, w.r); }
    if (w && Math.random() < 0.8) {
      const a = Math.random() * Math.PI * 2;
      this.powers.dustFx(_a.set(w.at.x + Math.cos(a) * w.r, w.at.y, w.at.z + Math.sin(a) * w.r), 1, 1.2);
    }
  }

  dispose() {
    this.endAction();
    for (const g of this.globs) g.mesh.removeFromParent();
    for (const b of this.burns) b.mesh.removeFromParent();
    this.powers.hazards = this.powers.hazards.filter((h) => !this.burns.some((b) => b.hazard === h));
    for (const o of [this.rig.root, this.line, this.ring, this.fx.points, this.handLight]) o.removeFromParent();
    this.powers.removeTarget(this.tg);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
    if (!this.physics.freed) this.physics.world.removeRigidBody(this.rb);
  }
}

// the charge's line: bright down the middle, soft at the edges, fading out at its far end
function lineTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(0.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 0, 256);
  along.addColorStop(0, 'rgba(0,0,0,0)'); along.addColorStop(0.15, 'rgba(0,0,0,1)'); along.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = along; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _look = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
