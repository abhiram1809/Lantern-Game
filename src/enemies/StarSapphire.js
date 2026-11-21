import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { makePose, blendInto, still, POSES } from '../characters/Poses.js';
import { constructMesh } from '../powers/Constructs.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Star Sapphire over the waterfront (Part Seven): Carol Ferris with the Zamarons' gem in her. She doesn't want
// Hal dead; she wants to keep him. Three things she does: a fan of violet crystal shards (`volley`), a cage of
// crystal closing on him where he is (`cage`), and a dive at him with her arms open (`embrace`). What there is
// to beat is the gem's hold on her (the target's health, the boss bar), not Carol: blows on her body while
// she's guarded scrape the hold and hurt her (`hurt`; at 100 the story stops it). The ways in, the same as the
// other fights' (block, then strike): her shards parried go back into the gem, a parried dive throws her open,
// and held in the ring's bubble (`held`, through `trap()`) the gem is open to his blows until she breaks it.
// Built on Sinestro's: a dynamic capsule with no gravity on a damped spring, the same tells and tokens.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PIVOT = 1.0;
export const LOVE = { color: new THREE.Color(0.5, 0.05, 0.36), rim: new THREE.Color(1.6, 0.32, 1.25), spark: [[3.2, 0.9, 2.6, 1], [0.8, 0.1, 0.6, 0]] };
export function loveLight(group) {
  for (const u of [group.userData.u, group.userData.ou]) { u.uColor.value.copy(LOVE.color); u.uRim.value.copy(LOVE.rim); }
  return group;
}
// How she holds herself in the air (her own, not Hal's flight pose, which on her was a mannequin's A-pose):
// upright and easy, the toes pointed, one knee drawn up, the arms a little out from her sides and the
// elbows soft; at speed she leans into it, the arms swept back.
const SAP_HOVER = makePose({
  sx: -0.04, cx: -0.08, nx: 0.05, kx: 0.03,
  aL: [0.45, -0.85, 0.16], eL: 0.5, wL: 0.15, aR: [-0.45, -0.85, 0.16], eR: 0.5, wR: 0.15,
  lLx: -0.16, kL: 0.42, lLz: 0.04, lRx: 0.05, kR: 0.1, lRz: -0.03, fL: 0.7, fR: 0.8,
});
const SAP_DIVE = makePose({
  sx: 0.18, cx: 0.1, nx: -0.3, kx: -0.16,
  aL: [0.38, -0.6, -0.62], eL: 0.22, aR: [-0.38, -0.6, -0.62], eR: 0.22,
  lLx: 0.12, kL: 0.22, lRx: 0.24, kR: 0.48, fL: 0.9, fR: 0.9,
});
export function sapFlight(state) {
  return (out, t) => {
    const k = state.k ?? 0, still = 1 - k;
    blendInto(out, SAP_HOVER, SAP_DIVE, k);
    const b = Math.sin(t * 1.4);
    out.kL += 0.08 * b * still;
    out.lLx -= 0.04 * b * still;
    out.aL[0] += 0.05 * Math.sin(t * 1.1) * still;
    out.aR[0] -= 0.05 * Math.sin(t * 1.1 + 0.6) * still;
    out.cx += 0.02 * Math.sin(t * 1.6);
    return out;
  };
}
const SHARD = { speed: 25, damage: 7, count: 6, back: 11 };
const EMBRACE = { wind: 0.7, damage: 16, range: 16 };
const CAGE = { wind: 0.9, hold: 2.6, squeeze: 10, breaks: 2 };
export const HOLD = 420, YIELD_AT = 0.25;
const LANDS = { held: 1.0, exposed: 1.0, guarded: 0.15 }; // how much of a blow reaches the gem
const HURT = 0.55; // how much of a guarded blow reaches Carol
const HELD = 2.6; // how long the bubble holds her before her light breaks it

export class StarSapphire {
  constructor({ scene, physics, powers, player, audio, director, root, anim, rig, centre, radius = 60 }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, rig, anim, radius });
    this.centre = centre.clone();
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = PIVOT;
    this.object.add(this.pivot);
    scene.add(this.object);
    // her body (the casual Carol rig the animator drives, the Sapphire rig on it) under the pivot
    const at = root.getWorldPosition(new THREE.Vector3());
    this.root = root;
    this.pivot.add(root);
    root.position.set(0, -PIVOT, 0);
    root.rotation.set(0, 0, 0);
    this.object.position.copy(at);
    this.flyState = { k: 0 };
    this.anim.play(sapFlight(this.flyState), 0.6);
    this.yaw = 0;
    this.body = { pitch: 0, roll: 0 };
    this.state = 'wait'; // wait | duel | pause | yield
    this.vel = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y + PIVOT, at.z).setGravityScale(0).setLinearDamping(1.2).lockRotations().setCcdEnabled(true));
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setDensity(180).setRestitution(0.2), this.rb);
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() });
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: 0.5, health: HOLD, maxHealth: HOLD, alive: true, hit: (a, p, d, k) => this.hit(a, p, d, k), openState: () => this.openState() };
    // her constructs: the shards, the cage
    this.shardGeo = new THREE.OctahedronGeometry(1, 0).scale(0.2, 0.2, 0.95);
    this.shards = [];
    this.cageMesh = loveLight(constructMesh(cageGeometry(), { uPattern: 0, outline: 0.012 }));
    this.cageMesh.userData.set('uForm', 0);
    this.cageMesh.visible = false;
    scene.add(this.cageMesh);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mark.renderOrder = 23;
    scene.add(this.mark);
    this.action = null;
    this.cool = 1.6;
    this.stagger = 0;
    this.exposed = 0;
    this.heldT = -1; // in the bubble, how long (-1: not)
    this.trapCool = 0;
    this.hurt = 0;
    this.orbit = 0;
    this.orbitDir = 1;
    this.clock = 0;
    this.onQuip = this.onYield = this.onHurtHal = this.onHurtCarol = this.onMoment = null;
    this.moment = false; // the one time Carol's own voice gets through (`onMoment`, at 55%)
  }

  get position() { return this.object.position; }
  get health() { return this.tg.health / this.tg.maxHealth; }

  engage() {
    this.state = 'duel';
    this.powers.addTarget(this.tg);
    this.powers.watchers.add(this);
    this.cool = 1.4;
  }
  disengage() {
    this.state = 'wait';
    this.endAction();
    this.clearShards();
    this.powers.removeTarget(this.tg);
    this.powers.watchers.delete(this);
  }

  // Where a blow lands: on the gem when she's held in the bubble or thrown open by a parry, else on her
  stance() { return this.heldT >= 0 ? 'held' : this.exposed > 0 ? 'exposed' : 'guarded'; }
  openState() { const s = this.stance(); return s === 'held' || s === 'exposed' ? 'exposed' : this.action && this.action.phase !== 'wind' ? 'open' : null; }

  hit(amount, point, dir, kind = 'hit') {
    if (this.state !== 'duel' || !this.tg.alive) return 0;
    const how = this.stance(), hud = this.powers.hud;
    let toGem = amount * LANDS[how];
    if (kind === 'gatling') toGem *= 0.5;
    if (how === 'guarded') {
      // her light round her takes some of it; the rest is Carol's
      this.hurt += amount * HURT * (kind === 'gatling' ? 0.6 : 1);
      if (this.clock - (this.lastHurtCall ?? -9) > 1.2) { hud.callout('Careful', 'block'); this.lastHurtCall = this.clock; }
      if (amount > 18) this.onQuip?.('hurt');
      if (this.hurt >= 100) { this.onHurtCarol?.(); return 0; }
    } else if (kind !== 'gatling') hud.callout('The gem', 'counter');
    this.tg.health = Math.max(0, this.tg.health - toGem);
    this.check();
    return toGem;
  }
  check() {
    if (!this.moment && this.health < 0.55 && this.state === 'duel') { this.moment = true; this.state = 'pause'; this.endAction(); this.onMoment?.(); }
    if (this.state === 'duel' && this.tg.health <= this.tg.maxHealth * YIELD_AT) this.yieldFight();
  }
  resume() { if (this.state === 'pause') { this.state = 'duel'; this.cool = 1.0; } }

  yieldFight() {
    if (this.state !== 'duel') return;
    this.state = 'yield';
    this.endAction();
    this.clearShards(); // (the last volley's, still in the air, hung there while she came down)
    this.powers.removeTarget(this.tg);
    this.powers.watchers.delete(this);
    this.onYield?.();
  }

  // thrown open: rocked back, a moment before she gathers herself
  expose(at, dur = 1.5) {
    this.endAction();
    this.exposed = Math.max(this.exposed, dur);
    this.stagger = Math.max(this.stagger, dur);
    this.cool = 0.6;
    const away = _b.subVectors(this.object.position, this.player.position).setY(0).normalize(), m = this.rb.mass();
    this.rb.applyImpulse({ x: away.x * 3.5 * m, y: 1.0 * m, z: away.z * 3.5 * m }, true);
    this.anim.gesture('shake', 1, 0.4);
    if (at) this.sparks(at, 36);
  }

  // The ring's bubble round her (the chapter's `trappable`): held where she is, the gem open, for a few
  // seconds, then her light breaks it outward.
  trap() {
    if (this.state !== 'duel' || this.trapCool > 0 || this.heldT >= 0) return null;
    const me = this;
    return {
      name: 'Star Sapphire', radius: 1.35, criminal: false,
      get trapped() { return me.trapped; }, set trapped(v) { me.trapped = v; },
      center: (out) => out.copy(me.tg.position).add(_d.set(0, -0.2, 0)),
      hold: (on) => {
        if (on) {
          me.endAction();
          me.heldT = 0;
          // (still, and kinematic: a dynamic body inside the bubble's ball was thrown out of it)
          me.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          me.rb.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
          me.onQuip?.('held');
        } else if (me.heldT >= 0) me.breakOut();
      },
      free: () => me.heldT > HELD || me.state !== 'duel',
      gone: () => me.state === 'yield',
    };
  }
  breakOut() {
    this.heldT = -1;
    this.rb.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.trapCool = 6;
    this.cool = 0.5;
    const at = this.tg.position.clone();
    this.sparks(at, 60);
    this.audio.explosion?.(0.35);
    this.director.shake(0.35, 0.4);
    const hal = this.player.position;
    if (hal.distanceTo(this.object.position) < 6) this.player.dash?.(_b.subVectors(hal, this.object.position).setY(0).normalize().clone(), 5, 0.3);
  }

  // what Hal cast: in the cage, a blow at its bars cracks it (two and he's out)
  onCast(id) {
    const a = this.action;
    if (a?.kind === 'cage' && a.phase === 'hold' && (id === 'fist' || id === 'hammer' || id === 'sword' || id === 'staff')) {
      a.cracks = (a.cracks ?? 0) + 1;
      this.audio.shieldHit?.(0.7);
      this.sparks(this.cageMesh.position.clone().add(_d.set(0, 1.3, 0)), 24);
      if (a.cracks >= CAGE.breaks) { this.audio.glass?.(0.8); this.releaseCage(); this.cool = 0.7; this.endAction(); this.onQuip?.('broke'); }
    }
  }

  endAction() {
    const a = this.action;
    this.action = null;
    if (a?.kind === 'volley') for (const s of a.made) if (!s.flying) s.mesh.removeFromParent();
    if (a?.kind === 'cage') this.releaseCage();
    this.anim.reach('R', null, { rate: 5 });
    this.anim.reach('L', null, { rate: 5 });
    this.mark.material.opacity = 0;
    this.rig.glowUp?.(1);
  }
  clearShards() {
    for (const s of this.shards) s.mesh.removeFromParent();
    this.shards = [];
  }
  releaseCage() {
    this.caged = false;
    this.cageMesh.visible = false;
    this.player.hamper = 1;
  }

  update(dt, t) {
    if (dt <= 0) return;
    this.clock += dt;
    this.trapCool = Math.max(0, this.trapCool - dt);
    this.hurt = Math.max(0, this.hurt - dt * 2.5); // (it eases off, slowly)
    const p = this.rb.translation();
    this.object.position.set(p.x, p.y - PIVOT, p.z);
    this.fly(dt);
    this.tg.position.set(this.object.position.x, this.object.position.y + 1.3, this.object.position.z);
    if (this.heldT >= 0) this.heldT += dt;
    if (this.state === 'duel' && this.heldT < 0) this.think(dt);
    this.updateShards(dt);
    this.cageMesh.userData.set('uTime', t);
  }

  // circling him at her own range, at his height, over the beach and the water
  fly(dt) {
    const hal = this.player.position, me = this.object.position;
    this.stagger = Math.max(0, this.stagger - dt);
    this.exposed = Math.max(0, this.exposed - dt);
    if (this.state === 'pause') {
      // (her moment with him: she drifts in to three metres, where the shots on her can be close)
      _a.subVectors(me, hal).setY(0);
      if (_a.lengthSq() < 1e-4) _a.set(Math.sin(this.yaw + Math.PI), 0, Math.cos(this.yaw + Math.PI));
      this.goal.copy(hal).addScaledVector(_a.normalize(), 3.2);
      this.goal.y = hal.y + 0.35;
    } else if (this.heldT >= 0 || this.state === 'yield' || this.state === 'wait') this.goal.copy(me);
    else if (this.exposed > 0) this.goal.copy(me);
    else if (!this.action?.moves) {
      this.orbit += this.orbitDir * dt * 0.42;
      if (Math.random() < dt * 0.1) this.orbitDir *= -1;
      const r = this.action?.kind === 'volley' ? 10 : 7.5; // (close: at 10 to 13 m she was a doll beside him on the screen)
      this.goal.set(hal.x + Math.sin(this.orbit) * r, Math.max(hal.y + 1.3, 6), hal.z + Math.cos(this.orbit) * r);
    }
    const cx = this.centre.x, cz = this.centre.z, rr = Math.hypot(this.goal.x - cx, this.goal.z - cz), lim = this.radius - 4;
    if (rr > lim) { this.goal.x = cx + (this.goal.x - cx) * lim / rr; this.goal.z = cz + (this.goal.z - cz) * lim / rr; }
    this.goal.y = clamp(this.goal.y, 3, 60);
    const lv = this.rb.linvel(), dash = this.action?.dash, maxV = dash ? 18 : 8;
    _a.subVectors(this.goal, me).multiplyScalar(dash ? 6 : 2.2);
    if (_a.length() > maxV) _a.setLength(maxV);
    const grip = this.stagger > 0 ? 1.2 : dash ? 12 : 4;
    if (this.heldT >= 0) this.vel.set(0, 0, 0);
    else {
      this.vel.set(lv.x, lv.y, lv.z).lerp(_a, Math.min(1, grip * dt));
      this.rb.setLinvel({ x: this.vel.x, y: this.vel.y, z: this.vel.z }, true);
    }
    const want = Math.atan2(hal.x - me.x, hal.z - me.z);
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -5 * dt, 5 * dt));
    this.object.rotation.set(0, this.yaw, 0);
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw), side = -this.vel.x * Math.cos(this.yaw) + this.vel.z * Math.sin(this.yaw);
    this.body.pitch = damp(this.body.pitch, clamp(0.04 + fwd * 0.03, -0.25, 0.5) - Math.min(this.stagger, 0.9) * 0.4, 5, dt);
    this.body.roll = damp(this.body.roll, clamp(side * 0.025, -0.35, 0.35), 5, dt);
    this.pivot.quaternion.copy(_qa.setFromAxisAngle(_Z, this.body.roll)).multiply(_qb.setFromAxisAngle(_X, this.body.pitch));
    this.flyState.k = damp(this.flyState.k, (dash ? 0.9 : 0) + Math.min(0.5, this.vel.length() / 20), 4, dt);
  }

  think(dt) {
    if (this.action) { this.runAction(dt); return; }
    if (this.stagger > 0) return;
    this.cool -= dt;
    if (this.cool > 0) return;
    const d = this.object.position.distanceTo(this.player.position), r = Math.random();
    if (this.clock - (this.lastCage ?? -99) > 11 && r < 0.3) this.begin('cage');
    else if (d < EMBRACE.range && r < 0.65) this.begin('embrace');
    else this.begin('volley');
  }

  begin(kind) {
    if (this.action) this.endAction();
    this.action = { kind, t: 0, phase: 'wind' };
    const a = this.action;
    this.audio.constructForm?.(0.5);
    if (kind === 'volley') { a.made = []; a.fired = 0; this.reachOut(true); }
    else if (kind === 'embrace') {
      // her arms open and the light in her flares: the tell
      this.anim.reach('L', () => this.armOut('L'), { rate: 7, pole: V(0.6, -0.6, -0.3) });
      this.anim.reach('R', () => this.armOut('R'), { rate: 7, pole: V(-0.6, -0.6, -0.3) });
      this.audio.tone?.({ type: 'sine', freq: 330, to: 660, attack: 0.5, peak: 0.05, dur: 0.7, wet: 0.5 });
    } else if (kind === 'cage') {
      this.lastCage = this.clock;
      this.reachOut(true);
      a.at = this.player.position.clone();
      this.onQuip?.('cage');
    }
  }

  // a hand out at Hal (the shards, the cage), or both arms open (the dive)
  reachOut(on) {
    const sh = new THREE.Vector3(), out = new THREE.Vector3();
    this.anim.reach('R', on ? () => { this.rig.bonePosition('upperArm_R', sh); return out.copy(this.player.position).setY(this.player.position.y + 1.2).sub(sh).normalize().multiplyScalar(0.52).add(sh); } : null, { pole: V(-0.6, -0.7, -0.3), rate: 9 });
  }
  armOut(side) {
    const s = side === 'L' ? 1 : -1, y = this.yaw, sh = this.rig.bonePosition(side === 'L' ? 'upperArm_L' : 'upperArm_R', side === 'L' ? _l : _r);
    return sh.add(_d.set(Math.cos(y) * 0.42 * s + Math.sin(y) * 0.22, 0.05, -Math.sin(y) * 0.42 * s + Math.cos(y) * 0.22));
  }

  runAction(dt) {
    const a = this.action, hal = this.player.position, me = this.object.position, P = this.powers;
    a.t += dt;
    if (a.kind === 'volley') {
      if (a.phase === 'wind') {
        while (a.made.length < SHARD.count && a.t > a.made.length * 0.08) {
          const m = loveLight(constructMesh(this.shardGeo, { uPattern: 0, outline: 0.012 }));
          m.userData.set('uForm', 0);
          this.scene.add(m);
          a.made.push({ mesh: m, t: 0, slot: a.made.length });
        }
        if (a.t > 0.65) { a.phase = 'fire'; a.t = 0; }
      } else if (a.phase === 'fire') {
        while (a.fired < a.made.length && a.t > a.fired * 0.12) this.launch(a.made[a.fired++]);
        if (a.fired >= a.made.length && a.t > 0.4) { this.endAction(); this.cool = 0.9 + Math.random() * 0.9; }
      }
      for (const s of a.made) if (!s.flying) this.holdShard(s, dt);
    } else if (a.kind === 'embrace') {
      if (a.phase === 'wind') {
        this.rig.glowUp?.(1 + 2.2 * Math.min(1, a.t / EMBRACE.wind));
        if (a.t > EMBRACE.wind) { a.phase = 'dash'; a.t = 0; a.dash = a.moves = true; this.audio.whoosh?.(0.6, 0.6); }
      } else if (a.phase === 'dash') {
        this.goal.copy(hal).add(_d.set(0, 0.3, 0));
        if (me.distanceTo(hal) < 1.8 || a.t > 0.9) {
          a.phase = 'recover'; a.t = 0; a.dash = false;
          if (me.distanceTo(hal) < 2.4) {
            const guard = P.guardHit(me, this.tg.position.clone());
            if (guard === 'parry') { this.audio.parry?.(); this.expose(this.tg.position.clone(), 1.6); this.onQuip?.('parried'); return; }
            if (guard === 'block') {
              this.audio.shieldHit?.(0.8);
              this.stagger = 0.7;
              const away = _b.subVectors(me, hal).setY(0).normalize(), m = this.rb.mass();
              this.rb.applyImpulse({ x: away.x * 3 * m, y: 0.6 * m, z: away.z * 3 * m }, true);
            } else {
              P.damage(EMBRACE.damage, me);
              this.player.dash?.(_b.subVectors(hal, me).setY(0).normalize().clone(), 6, 0.3);
              this.director.shake(0.5, 0.4);
              this.onHurtHal?.();
            }
          }
        }
      } else if (a.phase === 'recover') {
        this.rig.glowUp?.(Math.max(1, 3.2 - a.t * 4));
        if (a.t > 0.6) { this.endAction(); this.cool = 0.8 + Math.random() * 0.8; }
      }
    } else if (a.kind === 'cage') {
      // a ring of light where he is, following him; then the bars come up round him
      if (a.phase === 'wind') {
        a.at.lerp(hal, Math.min(1, dt * 3));
        this.mark.position.copy(a.at).add(_d.set(0, 0.05, 0));
        this.mark.material.opacity = Math.min(0.9, a.t * 1.4) * (0.6 + 0.4 * Math.sin(a.t * 18));
        if (a.t > CAGE.wind) {
          a.phase = 'close'; a.t = 0;
          this.mark.material.opacity = 0;
          // got out from under it: nothing
          if (Math.hypot(hal.x - a.at.x, hal.z - a.at.z) > 1.7 || Math.abs(hal.y - a.at.y) > 1.6) { this.endAction(); this.cool = 0.6; return; }
          this.caged = true;
          a.hold = hal.clone();
          this.cageMesh.visible = true;
          this.cageMesh.position.copy(hal);
          this.audio.shieldUp?.();
        }
      } else if (a.phase === 'close') {
        this.cageMesh.userData.set('uForm', Math.min(1, a.t / 0.3));
        this.pin(a.hold);
        if (a.t > 0.3) { a.phase = 'hold'; a.t = 0; }
      } else if (a.phase === 'hold') {
        this.pin(a.hold);
        if (a.t > CAGE.hold) {
          // it closes on him, then lets go
          P.damage(CAGE.squeeze, this.cageMesh.position.clone().add(_d.set(0, 1, 0)));
          this.audio.glass?.(0.6);
          this.onHurtHal?.();
          this.endAction();
          this.cool = 0.8;
        }
      }
    }
  }
  // held where the cage closed on him (in the air, his velocity pulled back to the spot each frame:
  // `place` would drop him out of flight)
  pin(at) {
    const p = this.player;
    p.hamper = 0;
    if (p.flying) p.vel.subVectors(at, p.position).multiplyScalar(3);
    this.cageMesh.position.copy(at);
  }

  holdShard(s, dt) {
    s.t += dt;
    s.mesh.userData.set('uForm', Math.min(1, s.t / 0.25));
    const me = this.object.position, k = (s.slot / (SHARD.count - 1) - 0.5) * 2.4;
    const fwd = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), right = _b.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    s.mesh.position.copy(me).addScaledVector(fwd, 0.7).addScaledVector(right, k * 0.85).y += 1.75 + Math.cos(k) * 0.4;
    s.mesh.lookAt(_c.copy(this.player.position).setY(this.player.position.y + 1.2));
  }

  launch(s) {
    const p = this.player, from = s.mesh.position.clone(), lead = from.distanceTo(p.position) / SHARD.speed;
    const aim = V(p.position.x, p.position.y + 1.15, p.position.z);
    if (p.flying && p.vel) aim.addScaledVector(p.vel, lead * 0.7);
    else aim.add(_a.set(Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed).multiplyScalar(lead * 0.7));
    s.flying = true;
    s.vel = aim.sub(from).normalize().multiplyScalar(SHARD.speed);
    s.pos = from;
    s.prev = from.clone();
    s.life = 0;
    this.shards.push(s);
    this.audio.tone?.({ type: 'triangle', freq: 1300, to: 520, attack: 0.005, peak: 0.04, dur: 0.2, wet: 0.4 });
  }

  updateShards(dt) {
    const P = this.powers, world = this.physics.world, player = this.player;
    this.shards = this.shards.filter((s) => {
      s.life += dt;
      s.prev.copy(s.pos);
      if (s.back) s.vel.lerp(_a.subVectors(this.tg.position, s.pos).setLength(SHARD.speed), Math.min(1, dt * 8));
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      s.mesh.lookAt(_a.copy(s.pos).add(s.vel));
      _a.subVectors(s.pos, s.prev);
      const len = _a.length();
      let done = s.life > 2.6;
      if (s.back) {
        if (s.pos.distanceTo(this.tg.position) < 1.0) { this.intoGem(s.pos); done = true; }
        else if (s.life > 1.3) done = true;
      } else if (!done && len > 1e-5) {
        const hit = world.castRay(new RAPIER.Ray(s.prev, _a.divideScalar(len)), len, true, undefined, undefined, this.col, undefined, (c) => !P.bounds?.has(c.handle));
        if (hit) {
          const at = s.prev.clone().addScaledVector(_a, hit.timeOfImpact), h = hit.collider.handle;
          const prop = this.physics.smash?.ofCollider(hit.collider);
          if (prop) this.physics.smash.blow(prop, 4, at, _c.copy(s.vel).normalize(), 'spike');
          if (P.shield && h === P.shield.col.handle) {
            if (P.guardHit(s.prev, at) === 'parry' && this.state === 'duel') { s.back = true; s.life = 0; s.pos.copy(at); s.vel.negate(); return true; }
            if (!P.shield.blocks(s.prev)) P.shield.ripple(at);
          } else if (h === player.collider?.handle) { P.damage(SHARD.damage, s.prev); this.onHurtHal?.(); }
          this.sparks(at, 12);
          done = true;
        }
      }
      if (done) { s.mesh.removeFromParent(); return false; }
      return true;
    });
  }

  // her own shard, back into the gem: the hold takes it, and the first throws her open
  intoGem(at) {
    if (this.state !== 'duel') return;
    this.powers.dealDamage({ alive: true, hit: (a) => { this.tg.health = Math.max(0, this.tg.health - a); return a; } }, SHARD.back, at);
    this.audio.glass?.(0.4);
    this.sparks(at, 16);
    if (this.exposed <= 0) { this.expose(null, 1.4); this.onQuip?.('parried'); }
    this.check();
  }

  sparks(at, n) {
    this.powers.sparks.emit(n, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 5; }, { life: 0.45, size: [0.06, 0], color: LOVE.spark });
  }

  // her body back to the story (out of the pivot, where it is in the world)
  release(scene) {
    this.root.getWorldPosition(_a);
    scene.add(this.root);
    this.root.position.copy(_a);
    this.root.rotation.set(0, this.yaw, 0);
  }

  dispose() {
    this.endAction();
    this.releaseCage();
    this.powers.watchers.delete(this);
    for (const s of this.shards) s.mesh.removeFromParent();
    for (const o of [this.object, this.cageMesh, this.mark]) o.removeFromParent();
    this.powers.removeTarget(this.tg);
    this.physics.world.removeRigidBody(this.rb);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
  }
}

// Carol on Hal's side (Part Seven, the Predator): Star Sapphire with the gem her own. She keeps to its flank
// across from him, at his height, and sends her shards into it (a little on its hide, more when it's
// open); thrown open by his parry, it's hers to hold: crystal chains from her hands onto its neck, stakes
// from the plaza over it (`pin`), and his blows land. In the air its beam takes her (`tethered`, `pull`):
// held, drawn up to it, until he breaks it; let it finish and it drinks her light, and she's down a while
// (`drained`). A kinematic body of no physics: nothing of Hal's hits her.
const VOLLEY = { every: [2.6, 4.2], count: 3, speed: 26, damage: 4 };
const CHAIN = { reach: 11, form: 0.35 };
export class SapphireAlly {
  constructor({ scene, powers, player, audio, rig, anim, centre, radius = 34, ground = () => 0 }) {
    Object.assign(this, { scene, powers, player, audio, rig, anim, radius, ground });
    this.centre = centre.clone();
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = PIVOT;
    this.object.add(this.pivot);
    scene.add(this.object);
    this.root = rig.root;
    this.object.position.copy(rig.root.getWorldPosition(new THREE.Vector3()));
    this.pivot.add(rig.root);
    rig.root.position.set(0, -PIVOT, 0);
    rig.root.rotation.set(0, 0, 0);
    this.flyState = { k: 0 };
    this.anim.play(sapFlight(this.flyState), 0.6);
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.body = { pitch: 0, roll: 0 };
    this.state = 'script'; // script | follow | pin | held | down
    this.foe = null;
    this.side = 1;
    this.next = 2;
    this.t = 0;
    this.shards = [];
    this.shardGeo = new THREE.OctahedronGeometry(1, 0).scale(0.18, 0.18, 0.85);
    this.chains = [0, 1, 2, 3].map(() => {
      const m = loveLight(constructMesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 6, 1).translate(0, 0.5, 0), { uPattern: 0, outline: 0.012 }));
      m.userData.set('uForm', 0);
      m.visible = false;
      scene.add(m);
      return m;
    });
    this.onQuip = null;
  }

  // where she is (her chest), for its beam and the camera
  get position() { const p = this.object.position.clone(); p.y += 1.25; return p; }

  start(foe) { this.foe = foe; this.state = 'follow'; this.next = 1.6; this.anim.lookAt(() => foe.parts[0].tg.position, 0.6); }
  stop() { this.state = 'script'; this.endPin(); this.clearShards(); this.anim.reach('L', null); this.anim.reach('R', null); }
  canTether() { return this.state === 'follow'; }

  update(dt, t) {
    if (dt <= 0) return;
    this.t += dt;
    const foe = this.foe, me = this.object.position, hal = this.player.position;
    if (this.state === 'follow' && foe) {
      // on its flank across from him, at his height (or over the plaza), a little way off
      const c = foe.parts[1].tg.position;
      _aa.subVectors(hal, c).setY(0);
      if (_aa.lengthSq() < 1e-3) _aa.set(0, 0, 1);
      const away = Math.atan2(_aa.x, _aa.z) + this.side * 1.45 + Math.sin(this.t * 0.3) * 0.25;
      this.goal.set(c.x + Math.sin(away) * 13, Math.max(this.ground(c.x, c.z) + 4.5, hal.y + 2), c.z + Math.cos(away) * 13);
      if (foe.flying) this.goal.y = Math.max(this.goal.y, foe.root.position.y + 2);
      if (Math.random() < dt * 0.05) this.side *= -1;
      this.next -= dt;
      if (this.next <= 0 && foe.state === 'fight') { this.volley(); this.next = VOLLEY.every[0] + Math.random() * (VOLLEY.every[1] - VOLLEY.every[0]); }
      // its head thrown open: hers to hold
      if ((foe.exposed > 0.3 || foe.stagger > 1.2) && foe.pinned <= 0 && foe.state === 'fight' && !foe.action) this.beginPin();
    } else if (this.state === 'pin' && foe) {
      const head = foe.parts[0].tg.position;
      _aa.subVectors(me, head).setY(0);
      if (_aa.lengthSq() < 1e-3) _aa.set(1, 0, 0);
      this.goal.copy(head).addScaledVector(_aa.normalize(), 6.5).setY(head.y + 2.6);
      this.pinT += dt;
      const near = me.distanceTo(head) < CHAIN.reach;
      if (near && !this.pinned) { this.pinned = true; this.pinT = 0; foe.pin(); this.audio.glass?.(0.6); this.audio.constructForm?.(1.2); this.onQuip?.('pin'); }
      if (this.pinned) this.drawChains();
      if ((this.pinned && foe.pinned <= 0) || this.pinT > 4 || foe.state !== 'fight') { this.endPin(); this.state = 'follow'; this.next = 1.2; }
    } else if (this.state === 'hold' && foe) {
      // (the end of it, scripted: over its head, the chains on, for as long as the story says)
      const head = foe.parts[0].tg.position;
      this.goal.copy(head).add(_aa.set(Math.cos(foe.yaw) * 5, 5, -Math.sin(foe.yaw) * 5));
      this.pinT += dt;
      this.drawChains();
    } else if (this.state === 'held') {
      this.goal.copy(me); // (`pull` moves her)
    } else if (this.state === 'down') {
      this.downT -= dt;
      this.goal.copy(me);
      me.y = damp(me.y, this.ground(me.x, me.z), 3, dt);
      if (this.downT <= 0) { this.state = 'follow'; this.anim.play(sapFlight(this.flyState), 0.8); this.rig.glowUp?.(1); this.onQuip?.('up'); }
    }
    this.fly(dt);
    this.updateShards(dt);
    for (const c of this.chains) c.userData.set('uTime', t);
  }

  fly(dt) {
    const me = this.object.position;
    if (this.state !== 'down' && this.state !== 'held') {
      const fast = this.state === 'pin' || this.state === 'hold';
      _aa.subVectors(this.goal, me).multiplyScalar(fast ? 2.6 : 1.6);
      _aa.clampLength(0, fast ? 20 : 11);
      this.vel.lerp(_aa, Math.min(1, dt * 3));
      me.addScaledVector(this.vel, dt);
      const cx = this.centre.x, cz = this.centre.z, r = Math.hypot(me.x - cx, me.z - cz);
      if (r > this.radius) { me.x = cx + (me.x - cx) * this.radius / r; me.z = cz + (me.z - cz) * this.radius / r; }
      me.y = Math.max(me.y, this.ground(me.x, me.z) + 0.8);
    }
    // facing it (or the way she's going, fast)
    const foe = this.foe, look = foe ? foe.parts[1].tg.position : this.player.position;
    const want = this.vel.length() > 7 && this.state !== 'pin' ? Math.atan2(this.vel.x, this.vel.z) : Math.atan2(look.x - me.x, look.z - me.z);
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -4 * dt, 4 * dt));
    this.object.rotation.set(0, this.yaw, 0);
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw), side = -this.vel.x * Math.cos(this.yaw) + this.vel.z * Math.sin(this.yaw);
    const held = this.state === 'held' ? Math.sin(this.t * 13) * 0.08 : 0;
    this.body.pitch = damp(this.body.pitch, clamp(0.04 + fwd * 0.03, -0.25, 0.5) + held, 5, dt);
    this.body.roll = damp(this.body.roll, clamp(side * 0.025, -0.35, 0.35) + held * 0.6, 5, dt);
    this.pivot.quaternion.copy(_qa.setFromAxisAngle(_Z, this.body.roll)).multiply(_qb.setFromAxisAngle(_X, this.body.pitch));
    this.flyState.k = damp(this.flyState.k, Math.min(0.6, this.vel.length() / 18) + (this.state === 'held' ? 0.4 : 0), 4, dt);
  }

  // ---- her shards: three out of her right hand, homing on its body
  volley() {
    const foe = this.foe;
    this.reachAt(() => foe.parts[1].tg.position, 'R');
    for (let i = 0; i < VOLLEY.count; i++) {
      const m = loveLight(constructMesh(this.shardGeo, { uPattern: 0, outline: 0.012 }));
      m.userData.set('uForm', 1);
      this.scene.add(m);
      this.shards.push({ mesh: m, delay: 0.25 + i * 0.12, pos: null, vel: new THREE.Vector3(), life: 0 });
    }
    this.audio.tone?.({ type: 'triangle', freq: 1100, to: 700, attack: 0.01, peak: 0.03, dur: 0.25, wet: 0.5 });
  }
  updateShards(dt) {
    const foe = this.foe;
    this.shards = this.shards.filter((s) => {
      s.life += dt;
      if (s.delay > 0) {
        s.delay -= dt;
        this.rig.bonePosition('hand_R', _ab);
        s.mesh.position.copy(_ab);
        if (s.delay <= 0) {
          s.pos = _ab.clone();
          s.vel.copy(foe ? foe.parts[1].tg.position : this.player.position).sub(s.pos).setLength(VOLLEY.speed);
          if (s.life > 0.5) this.anim.reach('R', null, { rate: 4 });
        }
        return true;
      }
      const to = _ab.subVectors(foe.parts[1].tg.position, s.pos);
      s.vel.lerp(to.setLength(VOLLEY.speed), Math.min(1, dt * 4));
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      s.mesh.lookAt(_ab.copy(s.pos).add(s.vel));
      if (s.pos.distanceTo(foe.parts[1].tg.position) < 1.6 || s.pos.distanceTo(foe.parts[0].tg.position) < 1.2) {
        foe.allyHit(VOLLEY.damage, s.pos.clone());
        foe.sparks?.(s.pos, 10, true);
        s.mesh.removeFromParent();
        return false;
      }
      if (s.life > 3) { s.mesh.removeFromParent(); return false; }
      return true;
    });
  }
  clearShards() { for (const s of this.shards) s.mesh.removeFromParent(); this.shards = []; }

  reachAt(fn, side) {
    const sh = new THREE.Vector3(), out = new THREE.Vector3(), bone = side === 'L' ? 'upperArm_L' : 'upperArm_R';
    this.anim.reach(side, () => { this.rig.bonePosition(bone, sh); return out.copy(fn()).sub(sh).normalize().multiplyScalar(0.52).add(sh); }, { pole: V(side === 'L' ? 0.6 : -0.6, -0.7, -0.3), rate: 8 });
  }

  // ---- the pin: both hands out at its neck, the chains on, and two stakes over it from the plaza
  beginPin() {
    this.state = 'pin';
    this.pinned = false;
    this.pinT = 0;
    const at = new THREE.Vector3(), neck = () => this.foe.bone('Neck', at);
    this.reachAt(neck, 'L');
    this.reachAt(neck, 'R');
    this.onQuip?.('pinning');
  }
  drawChains() {
    const foe = this.foe, k = Math.min(1, this.pinT / CHAIN.form);
    const neck = foe.bone('Neck', _an), torso = foe.bone('Torso', _at), pelvis = foe.bone('Pelvis', _apv);
    this.rig.bonePosition('hand_L', _ab);
    this.rig.bonePosition('hand_R', _ac);
    const g = foe.ground(neck.x, neck.z);
    const lat = _ad.set(Math.cos(foe.yaw), 0, -Math.sin(foe.yaw));
    const links = [[_ab, neck], [_ac, torso], [_ae.copy(neck).addScaledVector(lat, 4).setY(g), _af.copy(torso).addScaledVector(lat, -0.3)], [_ag.copy(pelvis).addScaledVector(lat, -4).setY(g), _ah.copy(pelvis).addScaledVector(lat, 0.3)]];
    links.forEach(([a, b], i) => {
      const m = this.chains[i];
      m.visible = true;
      m.userData.set('uForm', k);
      m.position.copy(a);
      _ai.subVectors(b, a);
      const len = _ai.length();
      m.quaternion.setFromUnitVectors(_Y, _ai.normalize());
      m.scale.set(1, len * k, 1);
    });
  }
  // the story's own pin, at the end: held until `stop`
  holdDown() {
    this.state = 'hold';
    this.pinned = true;
    this.pinT = 0;
    const at = new THREE.Vector3(), neck = () => this.foe.bone('Neck', at);
    this.reachAt(neck, 'L');
    this.reachAt(neck, 'R');
    this.audio.glass?.(0.8);
    this.audio.constructForm?.(1.4);
  }
  endPin() {
    if (this.pinned) this.audio.glass?.(0.7);
    this.pinned = false;
    for (const c of this.chains) c.visible = false;
    this.anim.reach('L', null, { rate: 4 });
    this.anim.reach('R', null, { rate: 4 });
  }

  // ---- its beam: held, drawn up to it, her hands out at it, struggling; then free, or drained
  tethered() {
    this.endPin();
    this.state = 'held';
    this.vel.set(0, 0, 0);
    const foe = this.foe;
    this.reachAt(() => foe.parts[0].tg.position, 'L');
    this.reachAt(() => foe.parts[0].tg.position, 'R');
    this.onQuip?.('held');
  }
  pull(mouth, dt) {
    if (this.state !== 'held') return;
    const me = this.object.position, to = _aa.subVectors(mouth, me), d = to.length();
    if (d > 5.5) me.addScaledVector(to.normalize(), Math.min(d - 5.5, 1.7 * dt));
  }
  untethered() {
    if (this.state !== 'held') return;
    this.state = 'follow';
    this.next = 1.5;
    this.anim.reach('L', null, { rate: 4 });
    this.anim.reach('R', null, { rate: 4 });
    this.onQuip?.('free');
  }
  drained() {
    this.state = 'down';
    this.downT = 8;
    this.vel.set(0, 0, 0);
    this.anim.reach('L', null, { rate: 4 });
    this.anim.reach('R', null, { rate: 4 });
    this.anim.play(still(POSES.kneel, 1.4), 0.9);
    this.rig.glowUp?.(0.35);
    this.onQuip?.('drained');
  }

  // her body back to the story, where it is
  release(scene) {
    this.stop();
    this.root.getWorldPosition(_aa);
    scene.add(this.root);
    this.root.position.copy(_aa);
    this.root.rotation.set(0, this.yaw, 0);
    this.object.removeFromParent();
  }
  dispose() {
    this.stop();
    for (const c of this.chains) c.removeFromParent();
    this.object.removeFromParent();
  }
}
const _aa = new THREE.Vector3(), _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _ad = new THREE.Vector3(), _ae = new THREE.Vector3(), _af = new THREE.Vector3(), _ag = new THREE.Vector3(), _ah = new THREE.Vector3(), _ai = new THREE.Vector3();
const _an = new THREE.Vector3(), _at = new THREE.Vector3(), _apv = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);

// bars of crystal in a ring, a band at the foot and the head
function cageGeometry() {
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(new THREE.OctahedronGeometry(1, 0).scale(0.09, 1.45, 0.09).translate(Math.sin(a) * 1.15, 1.3, Math.cos(a) * 1.15));
  }
  for (const y of [0.08, 2.55]) parts.push(new THREE.TorusGeometry(1.15, 0.05, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _l = new THREE.Vector3(), _r = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1);
