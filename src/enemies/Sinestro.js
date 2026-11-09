import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp, tween, wait } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { MocapClip } from '../characters/Mocap.js';
import { flight } from '../characters/Poses.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { createSinestro } from '../characters/Characters.js';
import { Blade, constructMesh, fistGeometry, shieldGeometry, swordGeometry } from '../powers/Constructs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PIVOT = 1.0; // the body pitches and banks about this height, as Hal's does
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// His own gestures and stances, in his body frame and metres (shoulders at ±0.2, 1.55; arms 0.6 m).
// He stands with his hands clasped behind his back, and fights with the left one kept there.
const GESTURES = {
  present: { dur: 1.3, rate: 6, poleR: [-0.8, -0.6, -0.2], R: [[0.3, [-0.3, 1.25, 0.36]], [1.0, [-0.31, 1.27, 0.34]]], lean: [[0.3, 0.03, 0], [1.0, 0.01, 0]] },
  ring: { dur: 1.6, rate: 6, poleR: [-0.9, -0.5, -0.1], R: [[0.35, [-0.1, 1.43, 0.33]], [1.3, [-0.1, 1.45, 0.32]]], head: [[0.3, 'chin', 1.0, 0.5]] },
  dismiss: { dur: 0.9, rate: 10, poleR: [-1, -0.5, -0.3], R: [[0.15, [-0.14, 1.3, 0.34]], [0.32, [-0.44, 1.2, 0.16]], [0.6, [-0.46, 1.18, 0.14]]], head: [[0.15, 'shake', 0.6, 0.4]] },
};
const STANCES = {
  behind: { L: [0.06, 1.06, -0.27], R: [-0.06, 1.08, -0.27], poleL: [0.9, -0.1, -0.7], poleR: [-0.9, -0.1, -0.7] },
  oneBehind: { L: [0.06, 1.06, -0.27], poleL: [0.9, -0.1, -0.7] },
};
// his cut: blade raised over his right shoulder, then across and down
const CUT = {
  wind: [[-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]],
  keys: [[0, [-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]], [0.12, [0.06, 1.2, 0.44], [0.75, -0.35, 0.55]], [0.3, [0.1, 1.12, 0.38], [0.6, -0.3, 0.75]]],
};
// the lesson: the blade held up before his face, raised over his shoulder, cut across the air
const DEMO = [[0, [-0.12, 1.47, 0.36], [0.02, 1, 0.12]], [0.5, [-0.12, 1.48, 0.36], [0.02, 1, 0.14]], [0.72, [-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]], [0.86, [0.06, 1.2, 0.44], [0.75, -0.35, 0.55]], [1.2, [0.1, 1.12, 0.38], [0.6, -0.3, 0.75]]];
const SPIKE = { speed: 30, damage: 6, count: 5 };
const HEALTH = 420, YIELD = 0.35; // he calls it off at 35%

// Sinestro, sparring with Hal on Kilowog's range. Out of the fight he stands (mocap idle, hands
// behind his back) and talks with his ring hand (BodyLanguage). In the fight he flies (a dynamic
// body steered by a damped spring, like the drones, so fists knock him about and he recovers):
// he keeps his distance, circling, and picks from a lunge with a blade (telegraphed: the blade
// raised and flaring), a volley of light spikes, a guard (a shield, when Hal hoses him with the
// gatling), and below 60% health a giant fist dropped on a marked spot. Hal's shield blocks his
// blade and spikes; a sword cut meeting his parries it and staggers him. At 35% he yields.
export class Sinestro {
  constructor({ scene, physics, powers, player, audio, director, mocap, abin, ring, attachRing, arena = 40, blocks = [] }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, arena, blocks });
    const rig = (this.rig = createSinestro(abin));
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = PIVOT;
    this.object.add(this.pivot);
    this.pivot.add(rig.root);
    rig.root.position.y = -PIVOT;
    scene.add(this.object);
    attachRing(ring, rig);
    this.ring = ring;
    this.anim = new Animator(rig);
    this.standGen = new MocapClip(mocap, 'idle', { timeScale: 0.7 });
    this.flyState = { k: 0 };
    this.flyGen = flight(this.flyState);
    this.anim.play(this.standGen, 0);
    this.anim.look.maxYaw = 0.75;
    const halHead = () => player.rig.bonePosition('head', _look);
    this.anim.lookAt(halHead, 0.6);
    this.bl = new BodyLanguage(rig, this.anim, { gestures: GESTURES, stances: STANCES, scale: 1, reach: 0.55, lookHome: () => halHead, shift: ['behind', 'oneBehind'] });
    this.bl.stance('behind');
    this.yaw = 0;
    this.body = { pitch: 0, roll: 0 };
    this.state = 'stand'; // stand | duel | yield
    this.vel = new THREE.Vector3();
    this.goal = new THREE.Vector3();

    // physics: a capsule the constructs can hit (and shove), steered toward where he wants to be
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -50, 0).setGravityScale(0).setLinearDamping(1.2).lockRotations().setCcdEnabled(true));
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.33).setDensity(200).setRestitution(0.2), this.rb);
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() });
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: 0.5, health: HEALTH, maxHealth: HEALTH, alive: true, hit: (a, p, d) => this.hit(a, p, d), parry: (from) => this.parry(from) };

    // constructs: his blade, his shield, the spikes, the giant fist
    this.blade = new Blade(scene, swordGeometry());
    this.blade.form = 0;
    this.shield = constructMesh(shieldGeometry().scale(0.8, 0.8, 0.8), { uPattern: 1, uScale: 0.13, uEmblem: 1, outline: 0.015 });
    this.shield.userData.set('uForm', 0);
    scene.add(this.shield);
    this.spikeGeo = new THREE.OctahedronGeometry(1, 0).scale(0.1, 0.1, 0.6);
    this.spikes = [];
    this.fist = constructMesh(fistGeometry().scale(2.3, 2.3, 2.3), { uPattern: 1, uScale: 0.3, outline: 0.03 });
    this.fist.userData.set('uForm', 0);
    this.fist.visible = false;
    scene.add(this.fist);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mark.renderOrder = 23;
    scene.add(this.mark);
    this.light = new THREE.PointLight(0x55ff88, 0, 5, 2);
    scene.add(this.light);
    this.hand = new THREE.Vector3();
    this.handTarget = new THREE.Vector3();
    this.bladeDir = new THREE.Vector3(0, 1, 0);
    this.bladeEdge = new THREE.Vector3(1, 0, 0);
    this.action = null;
    this.cool = 1.6;
    this.stagger = 0;
    this.orbit = 0;
    this.orbitDir = 1;
    this.hitLog = [];
    this.onQuip = this.onYield = this.onHurtHal = null;
  }

  get position() { return this.object.position; }
  get health() { return this.tg.health / this.tg.maxHealth; }

  // stand at a spot (out of the fight), facing a yaw
  place(at, yaw) {
    this.object.position.copy(at);
    this.yaw = yaw;
    this.object.rotation.set(0, yaw, 0);
    this.rb.setTranslation({ x: at.x, y: at.y + PIVOT, z: at.z }, true);
    this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  // The sword lesson, standing: a blade from nothing, held up, a cut through the air, then gone.
  async demo() {
    this.bl.hold('R', true);
    this.anim.reach('R', () => this.handTarget, { pole: V(-0.8, -0.55, -0.35), rate: 9 });
    this.audio.constructForm(0.8);
    let swung = false;
    await tween(1.2, (k) => {
      const t = k * 1.2;
      const [h, d] = sampleKeys(DEMO, t);
      this.setHand(h, d);
      this.blade.form = Math.min(1, t / 0.35);
      if (!swung && t > 0.72) { swung = true; this.audio.swordSwing(1.3); }
    }, (x) => x);
    await wait(0.4);
    await tween(0.3, (k) => (this.blade.form = 1 - k));
    this.audio.dissolve();
    this.bl.hold('R', false);
  }

  // into the fight: flying, a target for Hal's constructs
  engage() {
    this.state = 'duel';
    this.anim.play(this.flyGen, 0.5);
    this.bl.stance('oneBehind');
    this.powers.addTarget(this.tg);
    const p = this.object.position;
    this.rb.setTranslation({ x: p.x, y: p.y + PIVOT, z: p.z }, true);
    this.cool = 1.2;
  }

  // out of the fight: constructs away, back to his feet
  disengage() {
    this.state = 'stand';
    this.endAction();
    this.powers.removeTarget(this.tg);
    this.anim.play(this.standGen, 0.6);
    this.bl.stance('behind');
  }

  hit(amount, point, dir) {
    if (this.state !== 'duel' || !this.tg.alive) return 0;
    const fwd = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // his guard turns what comes at him from the front
    if (this.guard > 0.6 && dir && fwd.dot(dir) < -0.2) {
      this.audio.shieldHit(0.5);
      this.shield.userData.set('uHit', 1);
      this.shield.userData.u.uHitPos.value.copy(point);
      return 0;
    }
    this.tg.health = Math.max(0, this.tg.health - amount);
    this.stagger = Math.max(this.stagger, amount > 20 ? 0.55 : 0.08);
    const now = performance.now();
    this.hitLog.push(now);
    if (amount > 20) this.onQuip?.('hurt');
    if (this.tg.health <= this.tg.maxHealth * YIELD) this.yieldFight();
    return amount;
  }

  // Hal's sword meeting his blade mid-cut: the blades ring, he reels
  parry() {
    if (this.action?.kind !== 'lunge' || this.action.phase !== 'cut') return false;
    this.clash();
    return true;
  }

  clash() {
    this.audio.clash();
    this.director.shake(0.2, 0.3);
    this.powers.sparks.emit(40, (q, v) => {
      q[0] = this.blade.tip.x; q[1] = this.blade.tip.y; q[2] = this.blade.tip.z;
      v[0] = (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 6;
    }, { life: 0.5, size: [0.07, 0], color: [[1.5, 5, 2, 1], [0.2, 1.2, 0.4, 0]] });
    this.endAction();
    this.stagger = 1.2;
    const away = _b.subVectors(this.object.position, this.player.position).setY(0).normalize();
    this.rb.applyImpulse({ x: away.x * 7 * this.rb.mass(), y: 1 * this.rb.mass(), z: away.z * 7 * this.rb.mass() }, true);
    this.onQuip?.('parried');
  }

  yieldFight() {
    if (this.state !== 'duel') return;
    this.state = 'yield';
    this.endAction();
    this.powers.removeTarget(this.tg);
    this.onYield?.();
  }

  endAction() {
    const a = this.action;
    this.action = null;
    if (a?.kind === 'lunge' || a?.kind === 'guard') this.bl.hold('R', false);
    if (a?.kind === 'volley' || a?.kind === 'slam') this.anim.reach('R', null, { rate: 5 });
    this.mark.material.opacity = 0;
    this.fist.visible = false;
  }

  // ------------------------------------------------------------------------------------ update
  update(dt, t) {
    if (dt <= 0) return;
    const p = this.rb.translation();
    if (this.state === 'stand') {
      this.rb.setTranslation({ x: this.object.position.x, y: this.object.position.y + PIVOT, z: this.object.position.z }, true);
      this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      this.object.position.set(p.x, p.y - PIVOT, p.z);
      this.fly(dt);
    }
    this.tg.position.set(this.object.position.x, this.object.position.y + 1.25, this.object.position.z);
    if (this.state === 'duel') this.think(dt, t);
    this.updateConstructs(dt, t);
    this.updateSpikes(dt);
    this.bl.update(dt);
    this.anim.update(dt);
  }

  // where he wants to be, and flying there
  fly(dt) {
    const hal = this.player.position, me = this.object.position;
    this.stagger = Math.max(0, this.stagger - dt);
    if (this.state === 'duel' && !this.action?.moves) {
      // circling at his preferred range, at Hal's height when Hal flies, else hovering over the deck
      this.orbit += this.orbitDir * dt * 0.45;
      if (Math.random() < dt * 0.12) this.orbitDir *= -1;
      const r = this.action?.kind === 'guard' ? 7.5 : 6.5;
      this.goal.set(hal.x + Math.sin(this.orbit) * r, 0, hal.z + Math.cos(this.orbit) * r);
      this.goal.y = this.player.flying ? hal.y + 0.6 : 0.4;
    } else if (this.state === 'yield') this.goal.set(me.x, 0.25, me.z);
    // inside the deck, clear of the pillars
    const rr = Math.hypot(this.goal.x, this.goal.z), lim = this.arena - 4;
    if (rr > lim) { this.goal.x *= lim / rr; this.goal.z *= lim / rr; }
    for (const b of this.blocks) {
      const dx = this.goal.x - b.x, dz = this.goal.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r + 1.6 && this.goal.y < b.h + 0.5) { this.goal.x = b.x + (dx / (d || 1)) * (b.r + 1.6); this.goal.z = b.z + (dz / (d || 1)) * (b.r + 1.6); }
    }
    if (this.goal.y < 0.25) this.goal.y = 0.25;
    // a damped spring toward the goal; weaker while he reels
    const lv = this.rb.linvel(), maxV = this.action?.dash ? 17 : 8;
    _a.subVectors(this.goal, me).multiplyScalar(this.action?.dash ? 6 : 2.2);
    if (_a.length() > maxV) _a.setLength(maxV);
    const grip = this.stagger > 0 ? 1.2 : this.action?.dash ? 12 : 4;
    this.vel.set(lv.x, lv.y, lv.z).lerp(_a, Math.min(1, grip * dt));
    this.rb.setLinvel({ x: this.vel.x, y: this.vel.y, z: this.vel.z }, true);
    // facing Hal; leaning into his flight, rocked back while he reels
    const want = Math.atan2(hal.x - me.x, hal.z - me.z);
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -6 * dt, 6 * dt));
    this.object.rotation.set(0, this.yaw, 0);
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw), side = -this.vel.x * Math.cos(this.yaw) + this.vel.z * Math.sin(this.yaw);
    this.body.pitch = damp(this.body.pitch, clamp(0.05 + fwd * 0.03, -0.25, 0.5) - this.stagger * 0.35, 5, dt);
    this.body.roll = damp(this.body.roll, clamp(side * 0.025, -0.35, 0.35), 5, dt);
    this.pivot.quaternion.copy(_qa.setFromAxisAngle(_Z, this.body.roll)).multiply(_qb.setFromAxisAngle(_X, this.body.pitch));
    this.flyState.k = damp(this.flyState.k, smooth(5, 14, this.vel.length()) * 0.6, 4, dt);
  }

  // the fight: wait, then pick an attack
  think(dt) {
    const hal = this.player.position, d = this.object.position.distanceTo(hal);
    // the gatling on him for a while: guard
    const now = performance.now();
    this.hitLog = this.hitLog.filter((x) => now - x < 1000);
    if (!this.action && this.hitLog.length >= 4 && (this.guardCool ?? 0) <= 0) this.begin('guard');
    this.guardCool = Math.max(0, (this.guardCool ?? 0) - dt);
    if (this.action) { this.runAction(dt); return; }
    if (this.stagger > 0) return;
    this.cool -= dt;
    if (this.cool > 0) return;
    const phase2 = this.health < 0.62, r = Math.random();
    if (phase2 && r < 0.28) this.begin('slam');
    else if (d < 9 && r < 0.55) this.begin('lunge');
    else this.begin('volley');
  }

  begin(kind) {
    this.action = { kind, t: 0, phase: 'wind' };
    const a = this.action;
    if (kind === 'lunge') {
      this.bl.hold('R', true);
      this.anim.reach('R', () => this.handTarget, { pole: V(-0.8, -0.55, -0.35), rate: 16 });
      this.audio.constructForm(0.6);
      this.audio.tone({ type: 'sawtooth', freq: 160, to: 520, attack: 0.4, peak: 0.04, dur: 0.55, wet: 0.4 });
    } else if (kind === 'volley') {
      this.pointAt(true);
      this.audio.constructForm(0.5);
      a.made = [];
      a.fired = 0;
    } else if (kind === 'guard') {
      this.bl.hold('R', true);
      this.anim.reach('R', () => this.handTarget, { pole: V(-0.7, -0.6, -0.3), rate: 12 });
      this.audio.shieldUp();
      this.guardCool = 5;
    } else if (kind === 'slam') {
      this.pointAt(true);
      a.at = this.player.position.clone();
      this.onQuip?.('slam');
    }
  }

  pointAt(on) {
    const sh = new THREE.Vector3(), out = new THREE.Vector3(), hal = this.player.position;
    this.anim.reach('R', on ? () => { this.rig.bonePosition('upperArm_R', sh); return out.set(hal.x, hal.y + 1.2, hal.z).sub(sh).normalize().multiplyScalar(0.56).add(sh); } : null, { pole: V(-0.6, -0.7, -0.3), rate: 9 });
  }

  runAction(dt) {
    const a = this.action, hal = this.player.position, me = this.object.position, P = this.powers;
    a.t += dt;
    if (a.kind === 'lunge') {
      if (a.phase === 'wind') {
        // the blade forms over his shoulder and flares: the tell
        this.setHand(CUT.wind[0], CUT.wind[1]);
        this.blade.form = Math.min(1, a.t / 0.3);
        a.moves = false;
        if (a.t > 0.6) { a.phase = 'dash'; a.t = 0; a.dash = true; a.moves = true; this.audio.whoosh(0.6, 0.5); }
      } else if (a.phase === 'dash') {
        this.goal.copy(hal).addScaledVector(_a.subVectors(me, hal).setY(0).normalize(), 1.3).setY(this.player.flying ? hal.y : 0.3);
        if (me.distanceTo(hal) < 2.0 || a.t > 0.65) { a.phase = 'cut'; a.t = 0; a.dash = false; this.audio.swordSwing(1.2); }
      } else if (a.phase === 'cut') {
        const [h, d] = sampleKeys(CUT.keys, a.t);
        this.setHand(h, d);
        if (!a.struck && a.t > 0.11) {
          a.struck = true;
          if (me.distanceTo(hal) < 2.4) {
            // Hal's sword mid-cut parries; his shield blocks; else the blade lands
            if (P.sword?.cutting) { this.clash(); return; }
            const from = this.blade.tip.clone();
            if (P.shield?.blocks(me)) { P.shield.ripple(from); this.audio.shieldHit(0.9); this.audio.clash(); this.stagger = 0.4; }
            else { P.damage(16, me); this.audio.swordHit(1); this.onHurtHal?.(); }
          }
        }
        if (a.t > 0.3) { a.phase = 'recover'; a.t = 0; }
      } else if (a.phase === 'recover') {
        this.blade.form = Math.max(0, 1 - a.t / 0.3);
        if (a.t > 0.45) { this.endAction(); this.cool = 1.2 + Math.random() * 1.2; }
      }
    } else if (a.kind === 'volley') {
      // spikes of light take shape in an arc behind him, then fly at Hal one after another
      if (a.phase === 'wind') {
        while (a.made.length < SPIKE.count && a.t > a.made.length * 0.08) {
          const m = constructMesh(this.spikeGeo, { uPattern: 0, outline: 0.012 });
          m.userData.set('uForm', 0);
          this.scene.add(m);
          a.made.push({ mesh: m, t: 0, slot: a.made.length });
        }
        if (a.t > 0.6) { a.phase = 'fire'; a.t = 0; }
      } else if (a.phase === 'fire') {
        while (a.fired < a.made.length && a.t > a.fired * 0.14) this.launch(a.made[a.fired++]);
        if (a.fired >= a.made.length && a.t > 0.5) { this.endAction(); this.cool = 1.4 + Math.random() * 1.4; }
      }
      for (const s of a.made) if (!s.flying) this.holdSpike(s, dt);
    } else if (a.kind === 'guard') {
      this.setHand([-0.06, 1.36, 0.42], [0, 1, 0]);
      this.guard = Math.min(1, (this.guard ?? 0) + dt * 5);
      if (a.t > 2.2) { this.endAction(); this.cool = 0.8; }
    } else if (a.kind === 'slam') {
      // he marks the spot under Hal, then a giant fist comes down on it
      if (a.phase === 'wind') {
        a.at.lerp(_a.copy(hal), Math.min(1, dt * 3));
        a.at.y = this.player.flying ? hal.y : 0;
        this.mark.position.copy(a.at).y += 0.05;
        this.mark.material.opacity = Math.min(0.9, a.t * 1.5) * (0.6 + 0.4 * Math.sin(a.t * 18));
        this.fist.visible = true;
        this.fist.userData.set('uForm', Math.min(1, a.t / 0.5));
        this.fist.position.copy(a.at).y += 9;
        this.fist.quaternion.setFromUnitVectors(_Zf, _down);
        if (a.t > 1.0) { a.phase = 'drop'; a.t = 0; this.audio.whoosh(0.5, 0.8); }
      } else if (a.phase === 'drop') {
        this.fist.position.copy(a.at).y += 9 * (1 - Math.min(1, a.t / 0.18)) + 1.2;
        if (a.t >= 0.18) {
          a.phase = 'recover'; a.t = 0;
          this.audio.explosion(0.55);
          this.director.shake(0.7, 0.6);
          P.dustFx(a.at, 40, 4);
          this.physics.burst(a.at, 6, 5, 3, 1);
          const dh = Math.hypot(hal.x - a.at.x, hal.z - a.at.z);
          if (dh < 3.1 && Math.abs(hal.y - a.at.y) < 2.5) { P.damage(22, a.at.clone().setY(a.at.y + 3)); this.onHurtHal?.(); }
        }
      } else if (a.phase === 'recover') {
        this.mark.material.opacity = Math.max(0, 0.9 - a.t * 3);
        this.fist.userData.set('uForm', Math.max(0, 1 - a.t / 0.4));
        if (a.t > 0.6) { this.endAction(); this.cool = 1.6 + Math.random(); }
      }
    }
  }

  // the right hand at a point and the blade's direction, in his own frame
  setHand(h, d) {
    const root = this.rig.root;
    root.updateMatrixWorld(true);
    this.handTarget.set(h[0], h[1], h[2]).applyMatrix4(root.matrixWorld);
    root.getWorldQuaternion(_qa);
    _b.copy(this.bladeDir);
    this.bladeDir.set(d[0], d[1], d[2]).normalize().applyQuaternion(_qa);
    _b.subVectors(this.bladeDir, _b);
    if (_b.lengthSq() > 1e-6) this.bladeEdge.lerp(_b.normalize(), 0.5);
  }

  holdSpike(s, dt) {
    s.t += dt;
    s.mesh.userData.set('uForm', Math.min(1, s.t / 0.25));
    const me = this.object.position, k = (s.slot / (SPIKE.count - 1) - 0.5) * 2.2;
    const back = _a.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = _b.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    s.mesh.position.copy(me).addScaledVector(back, 0.5).addScaledVector(right, k * 0.9).y += 1.9 + Math.cos(k) * 0.35;
    s.mesh.lookAt(this.player.position.x, this.player.position.y + 1.2, this.player.position.z);
  }

  launch(s) {
    const p = this.player, from = s.mesh.position.clone(), lead = from.distanceTo(p.position) / SPIKE.speed;
    const aim = p.position.clone().setY(p.position.y + 1.15);
    if (p.flying) aim.addScaledVector(p.vel, lead * 0.7);
    else aim.add(_a.set(Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed).multiplyScalar(lead * 0.7));
    s.flying = true;
    s.vel = aim.sub(from).normalize().multiplyScalar(SPIKE.speed);
    s.pos = from;
    s.prev = from.clone();
    s.life = 0;
    this.spikes.push(s);
    this.audio.tone({ type: 'triangle', freq: 900, to: 300, attack: 0.005, peak: 0.05, dur: 0.18, wet: 0.3 });
  }

  updateSpikes(dt) {
    const P = this.powers, world = this.physics.world, player = this.player;
    this.spikes = this.spikes.filter((s) => {
      s.life += dt;
      s.prev.copy(s.pos);
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      s.mesh.lookAt(_a.copy(s.pos).add(s.vel));
      _a.subVectors(s.pos, s.prev);
      const len = _a.length();
      let done = s.life > 2.5;
      if (!done && len > 1e-5) {
        const hit = world.castRay(new RAPIER.Ray(s.prev, _a.divideScalar(len)), len, true, undefined, undefined, this.col, undefined, (c) => !P.bounds?.has(c.handle));
        if (hit) {
          const at = s.prev.clone().addScaledVector(_a, hit.timeOfImpact), h = hit.collider.handle;
          if (P.shield && h === P.shield.col.handle) { P.shield.ripple(at); this.audio.shieldHit(0.5); }
          else if (h === player.collider?.handle) { P.damage(SPIKE.damage, s.prev); this.onHurtHal?.(); }
          P.sparks.emit(14, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 4; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 4; }, { life: 0.35, size: [0.05, 0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
          done = true;
        }
      }
      if (done) { s.mesh.removeFromParent(); return false; }
      return true;
    });
  }

  updateConstructs(dt, t) {
    // the blade in his right hand (forming, held, dissolving)
    if (this.blade.form > 0.001) {
      this.rig.bonePosition('hand_R', this.hand);
      this.rig.bonePosition('foreArm_R', _c);
      this.hand.addScaledVector(_c.subVectors(this.hand, _c).normalize(), 0.075);
      this.blade.place(this.hand, this.bladeDir, this.bladeEdge);
    }
    this.blade.mesh.visible = this.blade.form > 0.001;
    this.blade.update(dt, t);
    // the shield before his ring fist
    if (this.action?.kind !== 'guard') this.guard = Math.max(0, (this.guard ?? 0) - dt * 4);
    this.shield.visible = this.guard > 0.01;
    if (this.shield.visible) {
      this.rig.bonePosition('hand_R', this.hand);
      const fwd = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.shield.position.copy(this.hand).addScaledVector(fwd, 0.35);
      this.shield.quaternion.setFromUnitVectors(_Zf, fwd);
      this.shield.userData.set('uForm', this.guard);
      this.shield.userData.set('uTime', t);
      const u = this.shield.userData.u;
      u.uHit.value = Math.max(0, u.uHit.value - dt * 2.5);
      this.shield.userData.ou.uHit.value = u.uHit.value;
    }
    this.fist.userData.set('uTime', t);
    this.light.position.copy(this.ring.getWorldPosition(_c));
    this.light.intensity = damp(this.light.intensity, this.action ? 3 : 0.6, 6, dt);
  }

  dispose() {
    this.endAction();
    for (const s of this.spikes) s.mesh.removeFromParent();
    this.blade.dispose();
    for (const o of [this.object, this.shield, this.fist, this.mark, this.light]) o.removeFromParent();
    this.powers.removeTarget(this.tg);
    this.physics.world.removeRigidBody(this.rb);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
  }
}

function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, h0, d0] = keys[i], [t1, h1, d1] = keys[i + 1];
    if (t < t1) {
      const k = (t - t0) / (t1 - t0), e = k * k * (3 - 2 * k);
      return [h0.map((v, j) => v + (h1[j] - v) * e), d0.map((v, j) => v + (d1[j] - v) * e)];
    }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _look = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1), _Zf = new THREE.Vector3(0, 0, 1), _down = new THREE.Vector3(0, -1, 0);
