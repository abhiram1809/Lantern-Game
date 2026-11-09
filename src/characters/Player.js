import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { Animator } from './Rig.js';
import { Locomotion } from './Mocap.js';
import { POSES, still, flight } from './Poses.js';
import { damp, clamp } from '../engine/Time.js';

const HALF = 0.6, RADIUS = 0.27, CENTER = HALF + RADIUS, SKIN = 0.02;
const PIVOT = 1.0; // the body pitches and banks about this height in flight
const _dir = new THREE.Vector3(), _pivot = new THREE.Vector3(), _right = new THREE.Vector3(), _want = new THREE.Vector3();
const _fwd = new THREE.Vector3(), _dv = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Flight tuning (m/s, m/s²). Momentum carries: acceleration is limited, so turns arc and stops glide.
const FLY = { cruise: 7.5, boost: 19, climb: 4.5, boostClimb: 7, accel: 7, boostAccel: 13, brake: 4.5, top: 48 };

// Third-person Hal: Rapier kinematic character controller with momentum (acceleration, turn rate,
// braking into sharp turns), mocap locomotion matched to ground speed, body lean from acceleration
// and turning, feet planted on the ground, orbit camera with collision, scripted walking, and flight
// (double-tap Space) with the body pitching toward the direction of travel and banking into turns.
export class Player {
  constructor({ input, audio, director, mocap }) {
    Object.assign(this, { input, audio, director, mocap });
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = PIVOT;
    this.object.add(this.pivot);
    this.control = false;
    this.inputBlocked = false; // the construct wheel has the mouse and keys
    this.moveScale = 1; // slowed while firing a held construct
    this.strafe = false; // a held construct is up: face where the camera looks, move where the keys say
    this.autoAnim = true;
    this.tired = 0.7;
    this.yaw = 0;
    this.heading = 0; // direction of travel on the ground (the facing, except when strafing)
    this.backing = false;
    this.speed = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.22;
    this.camDist = 2.3;
    this.camDistNow = 2.3;
    this.shoulder = 0.34;
    this.pivotHeight = 1.55;
    this.speedScale = 1;
    this.vy = 0;
    this.grounded = true;
    this.surface = 'wood';
    this.script = null;
    this.ground = null; // (x, z) => ground height, for foot placement
    this.lean = { pitch: 0, roll: 0, accel: 0 };
    this.ignore = new Set(); // collider handles the controller and camera pass through (held constructs)
    // flight
    this.canFly = false;
    this.flying = false;
    this.vel = new THREE.Vector3();
    this.boosting = false;
    this.air = null; // { floor(x, z), canLand(x, z), ignoreInFlight: Set } from the scene
    this.flightState = { k: 0 };
    this.flightGen = flight(this.flightState);
    this.landGen = still(POSES.land, 0.6);
    this.landing = 0;
    this.body = { pitch: 0, roll: 0 };
    this.fall = 0; // fastest downward speed since leaving the ground
    this.onTakeoff = this.onLand = this.onNoLanding = null;
  }

  // Put a rig's root under the pivot so it turns about the body's centre in flight.
  mount(rig) {
    this.pivot.add(rig.root);
    rig.root.position.set(0, -PIVOT, 0);
  }

  setRig(rig) {
    if (this.rig && this.rig !== rig) this.rig.root.removeFromParent();
    this.rig = rig;
    this.mount(rig);
    if (!this.animator) {
      this.animator = new Animator(rig);
      this.loco = new Locomotion(this.mocap, { tired: this.tired });
      this.loco.onStep = (kind) => this.audio.step(this.surface, kind);
      this.animator.play(this.loco, 0);
    } else this.animator.setRig(rig);
    this.loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
  }

  setTired(tired) {
    this.tired = tired;
    this.loco.tired = tired;
  }

  get walkSpeed() { return this.loco.walkSpeed * (1 - 0.22 * this.tired) * this.speedScale; }
  get runSpeed() { return this.loco.runSpeed * (1 - 0.15 * this.tired) * this.speedScale; }

  spawn(physics, scene, position, yaw = 0) {
    this.removeFromPhysics(); // out of the last scene's world (travel goes back and forth)
    this.physics = physics;
    scene.add(this.object);
    const world = physics.world;
    this.body = { pitch: 0, roll: 0 };
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y + CENTER + SKIN, position.z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), this.rb);
    this.kcc = world.createCharacterController(SKIN);
    this.groundMode();
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(85);
    this.place(position, yaw);
  }

  groundMode() {
    this.kcc.enableAutostep(0.25, 0.15, false);
    this.kcc.enableSnapToGround(0.35);
  }

  place(position, yaw = this.yaw) {
    if (this.rb) {
      this.rb.setTranslation({ x: position.x, y: position.y + CENTER + SKIN, z: position.z }, true);
      this.rb.setNextKinematicTranslation({ x: position.x, y: position.y + CENTER + SKIN, z: position.z });
    }
    this.object.position.copy(position);
    this.yaw = this.heading = yaw;
    this.object.rotation.set(0, yaw, 0);
    this.pivot.quaternion.identity();
    this.camYaw = yaw + Math.PI;
    this.speed = 0;
    this.flying = false;
    this.vel.set(0, 0, 0);
    if (this.kcc) this.groundMode();
  }

  get position() { return this.object.position; }

  walkTo(target, speed = this.walkSpeed) {
    return new Promise((resolve) => (this.script = { target: target.clone(), speed, resolve }));
  }

  turnTo(yaw, rate = 5) { this.yawTarget = yaw; this.yawRate = rate; }

  // Head tracking: a world point to look at (null to look ahead).
  lookAt(target, weight = 1) { this.animator.lookAt(target, weight); }

  get acting() { return this.control && !this.inputBlocked; }

  // Collision filter: skip held constructs, and the shore's invisible walls while airborne.
  filter = (c) => !this.ignore.has(c.handle) && !(this.flying && this.air?.ignoreInFlight?.has(c.handle));
  // The camera only dodges the world, not things that move (drones, debris, crates): those would
  // snap it into Hal's head whenever one passed behind him.
  camFilter = (c) => this.filter(c) && !c.parent()?.isDynamic();

  takeOff() {
    if (this.flying || !this.rb) return;
    this.flying = true;
    this.vel.set(Math.sin(this.yaw) * this.speed, 6.5, Math.cos(this.yaw) * this.speed);
    this.kcc.disableSnapToGround();
    this.kcc.disableAutostep();
    this.grounded = false;
    this.landing = 0;
    this.animator.play(this.flightGen, 0.35);
    this.onTakeoff?.();
  }

  // Drop out of flight (falls, carrying momentum). Refused where there's no ground to land on.
  stopFlying(force = false) {
    if (!this.flying) return;
    if (!force && this.air && !this.air.canLand(this.position.x, this.position.z)) { this.onNoLanding?.(); return; }
    this.flying = false;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.3) this.heading = Math.atan2(this.vel.x, this.vel.z);
    if (this.speed > 0.3 && !this.strafe) this.yaw = this.heading;
    this.vy = this.vel.y;
    this.fall = 0;
    this.groundMode();
  }

  update(dt) {
    const input = this.input;
    if (this.acting && this.canFly && input.doubleTap('Space')) {
      if (this.flying) this.stopFlying(); else this.takeOff();
    }
    if (this.flying) this.updateFlight(dt);
    else this.updateGround(dt);
    if (this.director.mode === 'follow') this.updateCamera(dt);
  }

  updateGround(dt) {
    const input = this.input;
    let wantSpeed = 0, want = null;
    if (this.landing > 0) this.landing -= dt;
    if (this.acting && this.landing <= 0) {
      const { x, z } = input.moveAxis();
      if (x || z) {
        const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
        const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
        want = _want.set(fx * z + rx * x, 0, fz * z + rz * x).normalize();
        wantSpeed = (input.down('ShiftLeft') || input.down('ShiftRight') ? this.runSpeed : this.walkSpeed) * this.moveScale;
      }
    } else if (this.script) {
      const sc = this.script;
      want = _want.subVectors(sc.target, this.object.position).setY(0);
      const d = want.length();
      // finish when there, or when no progress is made for a moment (cutscenes must never hang on a prop)
      if (d < (sc.best ?? Infinity) - 0.01) { sc.best = d; sc.stuck = 0; } else sc.stuck = (sc.stuck ?? 0) + dt;
      if (d < 0.1 || sc.stuck > 0.8) {
        this.script = null;
        sc.resolve();
        want = null;
      } else {
        want.normalize();
        wantSpeed = Math.min(sc.speed, d * 1.6 + 0.25); // ease into the stop
      }
    }
    if (this.acting) this.steerCamera(-0.35, 0.9);

    const prevYaw = this.yaw, prevSpeed = this.speed;
    const strafe = this.strafe && this.acting && this.landing <= 0;
    if (strafe) this.strafeStep(dt, want, wantSpeed);
    else {
      // leaving a strafe: keep only the part of the motion that goes the way Hal faces
      if (this.heading !== this.yaw) { this.speed *= Math.max(0, Math.cos(wrap(this.heading - this.yaw))); this.heading = this.yaw; }
      // heading: turn toward the wanted direction at a rate that drops with speed; brake for sharp turns
      if (want) {
        const diff = wrap(Math.atan2(want.x, want.z) - this.yaw);
        const rate = THREE.MathUtils.lerp(11, 4.5, smooth(0, this.runSpeed, this.speed));
        this.yaw = wrap(this.yaw + clamp(diff * (1 - Math.exp(-9 * dt)), -rate * dt, rate * dt));
        wantSpeed *= THREE.MathUtils.lerp(1, 0.3, smooth(0.7, 2.4, Math.abs(diff)));
      }
      this.turnToTarget(dt);
      // falling (after dropping out of flight) keeps its momentum; on the ground the usual limits apply
      const accel = !this.grounded ? 1.5 : wantSpeed > this.speed ? THREE.MathUtils.lerp(3.2, 5.5, smooth(0, this.runSpeed, wantSpeed)) : 7;
      this.speed += clamp(wantSpeed - this.speed, -accel * dt, accel * dt);
      this.heading = this.yaw;
    }

    let actual = this.speed;
    if (this.rb && (this.control || this.script || this.speed > 0.01 || !this.grounded)) {
      const vx = Math.sin(this.heading) * this.speed, vz = Math.cos(this.heading) * this.speed;
      const wasAirborne = !this.grounded;
      this.vy = this.grounded ? -1 : this.vy - 9.81 * dt;
      this.fall = Math.max(this.fall, -this.vy);
      this.kcc.computeColliderMovement(this.collider, { x: vx * dt, y: this.vy * dt, z: vz * dt }, undefined, undefined, this.filter);
      const m = this.kcc.computedMovement();
      this.grounded = this.kcc.computedGrounded();
      const t = this.rb.translation();
      const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
      this.rb.setNextKinematicTranslation(next);
      this.object.position.set(next.x, next.y - CENTER - SKIN, next.z);
      actual = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
      if (actual < this.speed - 0.3 && this.grounded) this.speed = damp(this.speed, actual, 6, dt); // walked into something
      if (wasAirborne && this.grounded) {
        const impact = this.fall;
        this.fall = 0;
        if (impact > 3) {
          if (impact > 9) { this.landing = 0.65; this.speed *= 0.2; }
          this.onLand?.(impact);
        }
      }
    }

    // straighten up after flight
    const B = this.body;
    B.pitch = damp(B.pitch, 0, 9, dt);
    B.roll = damp(B.roll, 0, 9, dt);
    this.applyBody(dt, 0);

    if (this.autoAnim) {
      this.object.rotation.set(0, this.yaw, 0);
      const gen = this.landing > 0 ? this.landGen : this.loco;
      if (this.animator.gen !== gen) this.animator.play(gen, gen === this.landGen ? 0.12 : 0.45);
      this.loco.speed = damp(this.loco.speed, actual, 14, dt);
      // strafing: the walk runs backwards when backing off, and the legs turn toward the travel
      // while the chest stays squared up (the upper/lower body split of third-person shooters)
      const rel = wrap(this.heading - this.yaw);
      if (strafe && this.speed > 0.15) this.backing = Math.abs(rel) > (this.backing ? 1.4 : 1.9);
      else if (!strafe) this.backing = false;
      this.loco.direction = this.backing ? -1 : 1;
      const twist = strafe ? clamp(this.backing ? wrap(rel - Math.PI) : rel, -1.05, 1.05) * smooth(0.15, 0.7, this.speed) : 0;
      this.animator.twist = damp(this.animator.twist, twist, 10, dt);
      // lean forward into acceleration and with speed, bank into turns
      const L = this.lean;
      L.accel = damp(L.accel, strafe ? 0 : (this.speed - prevSpeed) / Math.max(dt, 1e-4), 6, dt);
      const yawRate = wrap(this.yaw - prevYaw) / Math.max(dt, 1e-4);
      const pitchWant = strafe ? clamp(Math.cos(rel) * this.speed * 0.02, -0.05, 0.1) : clamp(L.accel * 0.035 + this.speed * 0.018, -0.12, 0.17);
      L.pitch = damp(L.pitch, pitchWant, 8, dt);
      L.roll = damp(L.roll, strafe ? 0 : clamp(-yawRate * this.speed * 0.04, -0.2, 0.2), 6, dt);
      this.animator.lean.pitch = this.grounded ? L.pitch : 0;
      this.animator.lean.roll = this.grounded ? L.roll : 0;
      this.animator.feet.ground = this.grounded && this.landing <= 0 ? this.ground : null;
    } else {
      this.animator.lean.pitch = damp(this.animator.lean.pitch, 0, 6, dt);
      this.animator.lean.roll = damp(this.animator.lean.roll, 0, 6, dt);
      this.animator.twist = damp(this.animator.twist, 0, 10, dt);
      this.animator.feet.ground = null;
    }
    this.animator.update(dt);
  }

  // Strafing on the ground: travel where the keys point (camera-relative, same acceleration limits,
  // a little slower backing off) while turning to face where the camera looks.
  strafeStep(dt, want, wantSpeed) {
    const face = this.camYaw + Math.PI;
    if (want) wantSpeed *= 1 - 0.3 * smooth(1.6, 2.6, Math.abs(wrap(Math.atan2(want.x, want.z) - face)));
    const vx = Math.sin(this.heading) * this.speed, vz = Math.cos(this.heading) * this.speed;
    _dv.set(want ? want.x * wantSpeed - vx : -vx, 0, want ? want.z * wantSpeed - vz : -vz);
    const accel = (want ? wantSpeed : 0) > this.speed ? 5 : 7, l = _dv.length();
    if (l > accel * dt) _dv.multiplyScalar((accel * dt) / l);
    this.speed = Math.hypot(vx + _dv.x, vz + _dv.z);
    if (this.speed > 1e-3) this.heading = Math.atan2(vx + _dv.x, vz + _dv.z);
    this.yaw = wrap(this.yaw + clamp(wrap(face - this.yaw) * (1 - Math.exp(-14 * dt)), -9 * dt, 9 * dt));
    this.yawTarget = undefined;
  }

  updateFlight(dt) {
    const input = this.input, v = this.vel;
    if (!Number.isFinite(v.x + v.y + v.z)) v.set(0, 0, 0);
    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    // wanted velocity: fly where the camera looks; Space / C climb and descend; Shift boosts
    _want.set(0, 0, 0);
    let climb = 0;
    this.boosting = false;
    if (this.acting) {
      const { x, z } = input.moveAxis();
      const cp = Math.cos(this.camPitch);
      _fwd.set(-Math.sin(this.camYaw) * cp, -Math.sin(this.camPitch), -Math.cos(this.camYaw) * cp);
      _right.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      _want.addScaledVector(_fwd, z).addScaledVector(_right, x);
      if (_want.lengthSq() > 1) _want.normalize();
      this.boosting = (input.down('ShiftLeft') || input.down('ShiftRight')) && (x || z);
      _want.multiplyScalar((this.boosting ? FLY.boost : FLY.cruise) * Math.min(1, this.moveScale + 0.2));
      climb = (input.down('Space') ? 1 : 0) - (input.down('KeyC') ? 1 : 0);
      _want.y += climb * (this.boosting ? FLY.boostClimb : FLY.climb);
      this.steerCamera(-1.15, 1.25);
    }
    const accel = _want.lengthSq() > 0.01 ? (this.boosting ? FLY.boostAccel : FLY.accel) : FLY.brake;
    _dv.subVectors(_want, v);
    const dvl = _dv.length();
    if (dvl > accel * dt) _dv.multiplyScalar((accel * dt) / dvl);
    v.add(_dv);
    if (v.length() > FLY.top) v.setLength(FLY.top);

    // keep above the ground and water (also outside the physics terrain), and inside the play space
    const p = this.object.position, air = this.air;
    if (air) {
      const floor = air.floor(p.x, p.z);
      const gap = p.y - floor;
      if (gap < 0.6 && v.y < 0) v.y *= clamp(gap / 0.6, 0, 1); // cushion near the floor
      const r = Math.hypot(p.x - air.center.x, p.z - air.center.z);
      if (r > air.radius) { _dv.set(p.x - air.center.x, 0, p.z - air.center.z).normalize(); const out = v.dot(_dv); if (out > 0) v.addScaledVector(_dv, -out * Math.min(1, (r - air.radius) * 0.2 + 0.05)); }
      if (p.y > air.ceiling && v.y > 0) v.y *= 0.9;
    }

    if (this.rb) {
      this.kcc.computeColliderMovement(this.collider, { x: v.x * dt, y: v.y * dt, z: v.z * dt }, undefined, undefined, this.filter);
      const m = this.kcc.computedMovement();
      const t = this.rb.translation();
      const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
      if (air) next.y = Math.max(next.y, air.floor(next.x, next.z) + CENTER + SKIN);
      // walls that have no colliders (the forest): stop at the edge and lose the speed into it
      if (air?.solid?.(next.x, next.y - CENTER, next.z) && !air.solid(t.x, t.y - CENTER, t.z)) {
        const sideways = !air.solid(t.x, next.y - CENTER, t.z); // into the side of it, or down onto it
        if (sideways) { next.x = t.x; next.z = t.z; v.x *= -0.15; v.z *= -0.15; } else { next.y = t.y; v.y = Math.max(0, v.y); }
        if (air.solid(next.x, next.y - CENTER, next.z)) { next.x = t.x; next.y = t.y; next.z = t.z; }
      }
      this.rb.setNextKinematicTranslation(next);
      this.object.position.set(next.x, next.y - CENTER - SKIN, next.z);
      // lose the velocity that went into whatever we hit
      if (dt > 1e-4) {
        _dv.set(m.x / dt, (next.y - t.y) / dt, m.z / dt);
        if (_dv.lengthSq() < v.lengthSq() - 0.5) v.lerp(_dv, 0.5);
      }
      // touch down on landable ground when coming down gently
      const grounded = this.kcc.computedGrounded() || (air && p.y - air.floor(p.x, p.z) < 0.04);
      if (grounded && climb <= 0 && v.y < 0.5 && Math.hypot(v.x, v.z) < 6 && (!air || air.canLand(p.x, p.z))) {
        const impact = -Math.min(0, v.y);
        this.stopFlying(true);
        this.grounded = true;
        this.vy = -1;
        this.onLand?.(impact, true);
      }
    }
    if (!this.flying) { this.animator.update(dt); return; }

    // face the direction of travel (or where the camera looks when hovering); turn rate drops with speed.
    // Aiming a held construct, Hal faces where the camera looks and strafes upright instead.
    const prevYaw = this.yaw, h = Math.hypot(v.x, v.z), speed = v.length();
    const aiming = this.strafe && this.acting;
    const yawWant = aiming ? this.camYaw + Math.PI : h > 1.2 ? Math.atan2(v.x, v.z) : this.acting ? this.camYaw + Math.PI : this.yaw;
    const rate = aiming ? 9 : THREE.MathUtils.lerp(5, 2.2, smooth(4, 18, speed));
    this.yaw = wrap(this.yaw + clamp(wrap(yawWant - this.yaw) * (1 - Math.exp((aiming ? -14 : -6) * dt)), -rate * dt, rate * dt));
    if (aiming) this.yawTarget = undefined; else this.turnToTarget(dt);
    this.speed = h;
    // body: long axis toward the velocity once moving (head first), banked into turns; aiming, it
    // stays upright, tipping toward the way it drifts
    const B = this.body;
    const align = aiming ? 0 : smooth(1.5, 7, speed);
    const yawRate = wrap(this.yaw - prevYaw) / Math.max(dt, 1e-4);
    let pitch, roll;
    if (aiming) {
      const fwd = v.x * Math.sin(this.yaw) + v.z * Math.cos(this.yaw), side = -v.x * Math.cos(this.yaw) + v.z * Math.sin(this.yaw);
      pitch = clamp(0.06 + fwd * 0.035, -0.25, 0.45);
      roll = clamp(side * 0.03, -0.35, 0.35);
    } else {
      pitch = THREE.MathUtils.lerp(0.06 + 0.04 * h, clamp(Math.atan2(h, v.y) * 0.85, 0, 2.0), align);
      roll = clamp(-yawRate * h * 0.055, -0.75, 0.75);
    }
    B.pitch = damp(B.pitch, pitch, 4, dt);
    B.roll = damp(B.roll, roll, 4, dt);
    this.applyBody(dt, 1 - align);
    this.object.rotation.set(0, this.yaw, 0);
    this.flightState.k = damp(this.flightState.k, align, 5, dt);
    if (this.autoAnim && this.animator.gen !== this.flightGen) this.animator.play(this.flightGen, 0.35);
    this.animator.lean.pitch = damp(this.animator.lean.pitch, 0, 6, dt);
    this.animator.lean.roll = damp(this.animator.lean.roll, 0, 6, dt);
    this.animator.twist = damp(this.animator.twist, 0, 10, dt);
    this.animator.feet.ground = null;
    this.animator.update(dt);
  }

  // Pitch then bank the body about its centre; `bob` adds a hover drift.
  applyBody(dt, bob) {
    const B = this.body;
    this.hoverT = (this.hoverT ?? 0) + dt;
    this.pivot.position.y = PIVOT + Math.sin(this.hoverT * 1.9) * 0.035 * bob * (this.flying ? 1 : 0);
    if (Math.abs(B.pitch) + Math.abs(B.roll) < 1e-4) { this.pivot.quaternion.identity(); return; }
    this.pivot.quaternion.copy(_qa.setFromAxisAngle(Z, B.roll)).multiply(_qb.setFromAxisAngle(X, B.pitch));
  }

  turnToTarget(dt) {
    if (this.yawTarget === undefined) return;
    const diff = wrap(this.yawTarget - this.yaw), rate = this.yawRate ?? 5;
    this.yaw = wrap(this.yaw + clamp(diff * (1 - Math.exp(-rate * 1.2 * dt)), -rate * dt, rate * dt));
    if (Math.abs(diff) < 0.01) this.yawTarget = undefined;
  }

  steerCamera(minPitch, maxPitch) {
    this.camYaw -= this.input.look.dx * 0.0026;
    this.camPitch = clamp(this.camPitch + this.input.look.dy * 0.002, minPitch, maxPitch);
  }

  updateCamera(dt) {
    const fly = this.flying ? 1 : 0;
    this.camFly = damp(this.camFly ?? 0, fly, 2.5, dt);
    const speed = this.flying ? this.vel.length() : 0;
    _pivot.copy(this.object.position).y += THREE.MathUtils.lerp(this.pivotHeight, 1.25, this.camFly);
    _right.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    _pivot.addScaledVector(_right, this.shoulder);
    // in fast flight the camera rides a little higher, looking down onto Hal's back
    const pitch = this.camPitch + this.camFly * 0.28 * smooth(3, 14, speed);
    const cp = Math.cos(pitch);
    _dir.set(Math.sin(this.camYaw) * cp, Math.sin(pitch), Math.cos(this.camYaw) * cp);
    const want = THREE.MathUtils.lerp(this.camDist, 4.0 + smooth(8, 20, speed) * 1.4, this.camFly);
    let dist = want;
    if (this.physics) {
      const ray = new RAPIER.Ray(_pivot, _dir);
      const hit = this.physics.world.castRay(ray, want + 0.2, true, undefined, undefined, this.collider, undefined, this.camFilter);
      if (hit) dist = Math.max(0.35, Math.min(dist, (hit.timeOfImpact ?? hit.toi) - 0.22));
    }
    this.camDistNow = dist < this.camDistNow ? dist : damp(this.camDistNow, dist, 3, dt);
    this.director.pos.copy(_pivot).addScaledVector(_dir, this.camDistNow);
    this.director.look.copy(_pivot).addScaledVector(_dir, -1.5);
    this.director.fov = 55 + 14 * smooth(8, 22, speed);
  }

  removeFromPhysics() {
    if (!this.rb) return;
    if (!this.physics.freed) {
      this.physics.world.removeCharacterController(this.kcc);
      this.physics.world.removeRigidBody(this.rb);
    }
    this.rb = null;
  }

  // Already in the air (arriving from space): flying, without a takeoff.
  airborne(vel) {
    this.flying = true;
    this.vel.copy(vel);
    this.kcc.disableSnapToGround();
    this.kcc.disableAutostep();
    this.grounded = false;
    this.landing = 0;
    this.flightState.k = 1;
    this.animator.play(this.flightGen, 0.3);
  }
}
