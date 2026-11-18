import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const UP = V(0, 1, 0);

// Hal's car, driven (Part Five's commute): a raycast vehicle, the way most games do cars, on Rapier's
// (DynamicRayCastVehicleController): a dynamic chassis on four wheels, each a ray down from its
// hardpoint with a spring and damper, tyre grip by friction slip. Rear-wheel drive, like the '71
// Phoenix it is; speed-sensitive steering (full lock when parking, a few degrees at speed),
// aerodynamic drag and rolling resistance for its top speed, the handbrake on the rear wheels (they
// let go: it slides). The car's own mesh (Car.js makeCar) follows the chassis; the wheels ride on
// their suspension and spin, the fronts steer, the steering wheel turns and Hal's hands with it.
//
// Two views (C): behind the car, the chase camera swinging after it (the mouse looks round; it
// settles back behind when the mouse is left alone), or first person from Hal's seat (his head
// hidden, the mouse turning it).
//
// The chassis' mass is set (1450 kg, its centre low between the axles) rather than taken from the
// colliders, so it sits on its springs like a car instead of a box; the colliders are only its shape.
export class Drive {
  constructor({ physics, car, input, director, audio, hal, hud }) {
    Object.assign(this, { physics, car, input, director, audio, hal, hud });
    this.view = 'chase';
    this.steerNow = 0;
    this.speed = 0;
    this.orbit = { yaw: 0, pitch: 0, idle: 9 };
    this.headLook = { yaw: 0, pitch: 0 };
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.enabled = false; // the player's keys drive it
    this.throttle = 0; this.brake = 0; this.handbrake = 0; this.steerIn = 0;
  }

  // On its wheels at the car's pose now.
  start() {
    const { physics, car } = this, w = physics.world;
    car.updateMatrixWorld(true);
    const body = (this.body = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(car.position.x, car.position.y + 0.05, car.position.z)
      .setRotation(car.quaternion)
      .setLinearDamping(0.02).setAngularDamping(0.5).setCcdEnabled(true).setCanSleep(false)
      .setAdditionalMassProperties(1450, { x: 0, y: 0.42, z: 0.08 }, { x: 2600, y: 2900, z: 560 }, { x: 0, y: 0, z: 0, w: 1 })));
    const shape = (hx, hy, hz, x, y, z) => w.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setDensity(0).setFriction(0.45).setRestitution(0.05)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(9000), body);
    this.colliders = [shape(0.9, 0.27, 2.38, 0, 0.6, 0), shape(0.74, 0.2, 1.02, 0, 1.06, -0.32)];
    const ctrl = (this.ctrl = w.createVehicleController(body));
    ctrl.indexUpAxis = 1;
    ctrl.setIndexForwardAxis = 2; // (Rapier's setter is misnamed: the forward axis is z, the car's nose)
    // (the springs settle about 6.5 cm under its weight, measured: the hardpoints sit that much lower
    // than rest length above the hubs, so at rest the wheels are where the model has them and the body
    // sits on the ground's level)
    const rest = 0.3, radius = 0.335, settle = 0.065;
    this.wheels = car.userData.wheels.map((pv, i) => {
      const hub = pv.position, front = hub.z > 0;
      ctrl.addWheel({ x: hub.x, y: hub.y + rest - settle, z: hub.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, radius);
      ctrl.setWheelSuspensionStiffness(i, 32);
      ctrl.setWheelSuspensionCompression(i, 3.2);
      ctrl.setWheelSuspensionRelaxation(i, 4.4);
      ctrl.setWheelMaxSuspensionTravel(i, 0.22);
      ctrl.setWheelMaxSuspensionForce(i, 40000);
      ctrl.setWheelFrictionSlip(i, front ? 3.4 : 3.1);
      ctrl.setWheelSideFrictionStiffness(i, 1);
      return { pv, hub: hub.clone(), front, rest: rest - settle };
    });
    this.pre = (dt) => this.step(dt);
    (physics.beforeStep ??= []).push(this.pre);
    this.camPos.copy(car.position).addScaledVector(_f.set(0, 0, -1).applyQuaternion(car.quaternion), 7).y += 2.4;
    this.camLook.copy(car.position).y += 1;
    this.onHit = null;
    return this;
  }

  // Off its wheels: the chassis out of the world (the car stays where it stopped).
  stop() {
    if (!this.body) return;
    const w = this.physics.world;
    this.physics.beforeStep = (this.physics.beforeStep ?? []).filter((f) => f !== this.pre);
    if (!this.physics.freed) { w.removeVehicleController(this.ctrl); w.removeRigidBody(this.body); }
    this.body = this.ctrl = null;
    this.hal.u.uHideBone.value = -1;
    this.enabled = false;
  }

  // Put it at a pose (a respawn: back on its wheels, still).
  place(at, yaw) {
    if (!this.body) return;
    _q.setFromAxisAngle(UP, yaw);
    this.body.setTranslation({ x: at.x, y: at.y + 0.1, z: at.z }, true);
    this.body.setRotation(_q, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.sync();
  }

  // Before the physics step: the keys (or a script's `throttle` / `brake` / `steerIn`) into engine
  // force, brakes and steering.
  step(dt) {
    const { ctrl, input, body } = this;
    if (!ctrl) return;
    // (the chassis was found disabled once after getting in, and never moved: keep it live)
    if (!body.isEnabled()) body.setEnabled(true);
    this.speed = ctrl.currentVehicleSpeed();
    if (this.enabled) {
      const fwd = input.down('KeyW') || input.down('ArrowUp'), back = input.down('KeyS') || input.down('ArrowDown');
      this.steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
      this.handbrake = input.down('Space') ? 1 : 0;
      // S brakes while it's rolling forward, and backs up once it's stopped; W the other way round
      if (fwd) { this.throttle = this.speed < -0.6 ? 0 : 1; this.brake = this.speed < -0.6 ? 1 : 0; }
      else if (back) { this.throttle = this.speed > 0.6 ? 0 : -0.55; this.brake = this.speed > 0.6 ? 1 : 0; }
      else { this.throttle = 0; this.brake = 0; }
    }
    const v = Math.abs(this.speed);
    // steering: full lock when slow, a few degrees at speed; it winds on and off at a rate
    const lock = 0.58 / (1 + v * 0.075);
    this.steerNow = damp(this.steerNow, this.steerIn * lock, this.steerIn ? 5 : 7, dt);
    const engine = this.throttle * 2600 * (this.throttle > 0 ? clamp(1.15 - v / 52, 0.15, 1) : 1);
    // Brakes as forces per wheel (N): about 0.85 g with both pedals' worth, 60% on the front. Rapier
    // takes a wheel's brake as the most impulse it may take off in one step, so they're times the
    // step: a bare number stopped the car half as hard at 30 fps as at 60 (7 m from walking pace).
    const coast = this.throttle === 0 && this.brake === 0 ? 90 : 0; // engine braking, lightly
    for (let i = 0; i < this.wheels.length; i++) {
      const wh = this.wheels[i];
      ctrl.setWheelSteering(i, wh.front ? this.steerNow : 0);
      ctrl.setWheelEngineForce(i, wh.front ? 0 : engine);
      ctrl.setWheelBrake(i, (this.brake * (wh.front ? 3600 : 2400) + (!wh.front ? this.handbrake * 3600 : 0) + coast) * dt);
      if (!wh.front) ctrl.setWheelFrictionSlip(i, this.handbrake ? 1.1 : 3.1);
    }
    // drag and rolling resistance against its motion
    const lv = body.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z);
    if (sp > 0.05) {
      const k = (0.44 * sp + 14) * sp * dt / sp;
      body.applyImpulse({ x: -lv.x * k, y: 0, z: -lv.z * k }, true);
    }
    ctrl.updateVehicle(dt);
  }

  // After the step: the mesh on the chassis, the wheels on their suspension, the steering wheel and
  // the hands; righting it if it's on its roof; the view.
  update(dt) {
    if (!this.body) return;
    this.sync();
    const { car, body } = this;
    // upside down for a while: put it back on its wheels where it is
    _u.set(0, 1, 0).applyQuaternion(car.quaternion);
    this.flipped = _u.y < 0.35 ? (this.flipped ?? 0) + dt : 0;
    if (this.flipped > 2.5) { const t = body.translation(); this.place(V(t.x, 0, t.z), Math.atan2(_f.set(0, 0, 1).applyQuaternion(car.quaternion).x, _f.z)); this.flipped = 0; }
    this.motor?.set(0.12 + Math.min(0.6, Math.abs(this.speed) / 40) + this.throttle * 0.12);
    if (this.input.hit('KeyC') && this.enabled) this.toggleView();
    this.hud?.drive?.({ mph: Math.abs(this.speed) * 2.237, gear: this.speed < -0.3 && this.throttle < 0 ? 'R' : 'D', view: this.view });
    if (this.camera !== false) this.updateCamera(dt);
  }

  sync() {
    const { car, body, ctrl } = this, t = body.translation(), r = body.rotation();
    car.position.set(t.x, t.y, t.z);
    car.quaternion.set(r.x, r.y, r.z, r.w);
    for (let i = 0; i < this.wheels.length; i++) {
      const wh = this.wheels[i], len = ctrl.wheelSuspensionLength(i) ?? wh.rest;
      wh.pv.position.y = wh.hub.y + wh.rest - len;
      if (wh.front) wh.pv.rotation.y = this.steerNow;
      wh.pv.rotation.x = -(ctrl.wheelRotation(i) ?? 0);
    }
    car.userData.steer?.(this.steerNow * 3.2);
    car.updateMatrixWorld(true);
  }

  toggleView() {
    this.view = this.view === 'chase' ? 'first' : 'chase';
    this.hal.u.uHideBone.value = this.view === 'first' ? 4 : -1;
    this.headLook.yaw = this.headLook.pitch = 0;
  }

  updateCamera(dt) {
    const { car, director, input } = this, d = director;
    const look = this.enabled ? input.look : { dx: 0, dy: 0 };
    _f.set(0, 0, 1).applyQuaternion(car.quaternion).setY(0).normalize();
    if (this.view === 'first') {
      // from his eyes: the head bone, a little up and forward, the mouse turning it
      const h = this.headLook;
      h.yaw = clamp(h.yaw - look.dx * 0.0026, -1.7, 1.7);
      h.pitch = clamp(h.pitch - look.dy * 0.002, -0.6, 0.45);
      this.hal.bones.head.getWorldPosition(_p);
      _u.set(0, 1, 0).applyQuaternion(car.quaternion);
      _p.addScaledVector(_u, 0.1).addScaledVector(_f, 0.07);
      _a.set(0, 0, 1).applyAxisAngle(V(1, 0, 0), -h.pitch).applyAxisAngle(UP, h.yaw).applyQuaternion(car.quaternion);
      d.pos.copy(_p);
      d.look.copy(_p).add(_a);
      d.fov = 68;
      d.mode = 'follow';
      return;
    }
    // behind it: swung round after its heading (and the mouse), riding up a little at speed
    const o = this.orbit;
    if (look.dx || look.dy) o.idle = 0; else o.idle += dt;
    o.yaw -= look.dx * 0.003;
    o.pitch = clamp(o.pitch + look.dy * 0.002, -0.25, 0.7);
    if (o.idle > 1.6) { o.yaw = damp(o.yaw, 0, 1.8, dt); o.pitch = damp(o.pitch, 0, 1.8, dt); }
    const v = Math.abs(this.speed), back = this.speed < -1 ? -1 : 1;
    const yaw = Math.atan2(_f.x, _f.z) + o.yaw + (back < 0 ? Math.PI : 0);
    const dist = 6.4 + Math.min(1.6, v * 0.05), hgt = 2.1 + o.pitch * 3;
    _b.copy(car.position).y += 1.15;
    _p.set(-Math.sin(yaw) * dist, hgt, -Math.cos(yaw) * dist).add(_b);
    // (not through walls: pulled in along the ray from the car)
    _a.subVectors(_p, _b);
    const len = _a.length();
    _a.divideScalar(len);
    const hit = this.physics.world.castRay(new RAPIER.Ray(_b, _a), len, true, undefined, undefined, this.colliders[0], this.body, (c) => !c.parent()?.isDynamic());
    if (hit) _p.copy(_b).addScaledVector(_a, Math.max(1.5, hit.timeOfImpact - 0.3));
    if (this.snap) { this.camPos.copy(_p); this.snap = false; } else this.camPos.x = damp(this.camPos.x, _p.x, 7, dt), this.camPos.y = damp(this.camPos.y, _p.y, 7, dt), this.camPos.z = damp(this.camPos.z, _p.z, 7, dt);
    _b.addScaledVector(_f, 2.5 * back).y -= 0.15;
    this.camLook.lerp(_b, 1 - Math.exp(-10 * dt));
    d.pos.copy(this.camPos);
    d.look.copy(this.camLook);
    d.fov = 58 + Math.min(12, v * 0.3);
    d.mode = 'follow';
  }
}
