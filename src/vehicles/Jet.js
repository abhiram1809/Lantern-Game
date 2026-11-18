import * as THREE from 'three';
import { damp, clamp } from '../engine/Time.js';
import { meshes, boundsIn, pivot } from '../props/Props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _fw = new THREE.Vector3(), _up = new THREE.Vector3(), _lf = new THREE.Vector3(), _vh = new THREE.Vector3(), _t = new THREE.Vector3(), _ax = new THREE.Vector3();
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Ferris Aircraft's prototype, flown (Part Five's test flight). The flight model is the usual
// arcade-sim one: the airframe is a rigid body with lift, drag, side force, thrust and weight from
// its speed, its angle of attack and the air's density at its height (lift linear in alpha to a
// stall at 22 degrees; drag with an induced part and a transonic rise; thrust lapsing with altitude,
// the afterburner past full throttle); its rotation follows commanded rates (a fly-by-wire jet is
// flown in rates: the stick asks for a pitch rate, the computer delivers it), with an angle-of-attack
// limiter and a 9 g limiter, and less authority when it's slow. On the ground it sits on its gear:
// rolling friction, brakes, nose-wheel steering; touching down too hard, too steep or with the gear
// up is a crash.
//
// Control is the mouse-aim of MouseFlight (and War Thunder's "instructor"): the mouse points a
// direction in the world, and the autopilot rolls the wings toward it and pulls (or flies wings-level
// when it's nearly there). W and S set the throttle (past 100% is afterburner), A and D roll and Q and
// E yaw over the top of it, G the gear, B the wheel brakes and airbrake. C changes the view: behind
// the jet, looking where the mouse points (the jet banks round in front of it), or the cockpit, from
// Hal's eyes, with the HUD.
//
// The airframe's own frame: nose along +Z, +Y up, +X its left wing (Ferris.freeJet's pivot).
export const JET = {
  mass: 25000, S: 78, cla: 4.4, stall: 0.38, cd0: 0.017, k: 0.11,
  dry: 230000, ab: 380000, maxPitch: 1.05, maxRoll: 3.2, maxYaw: 0.32, gLimit: 9, alphaMax: 0.42,
};
export const FT = 3.2808, KT = 1.9438; // feet per metre, knots per m/s

export class Jet {
  constructor({ rig, input, director, audio, hud, ground = () => 0, engine }) {
    Object.assign(this, { rig, input, director, audio, hud, ground, engine });
    this.pos = rig.position.clone();
    this.vel = new THREE.Vector3();
    this.quat = rig.quaternion.clone();
    this.w = new THREE.Vector3(); // body rates: x pitch (positive nose down), y yaw (nose left), z roll (right wing down)
    this.throttle = 0;
    this.gearDown = true;
    this.brake = 0;
    this.onGround = true;
    this.view = 'chase';
    this.aim = { yaw: Math.atan2(_fw.set(0, 0, 1).applyQuaternion(this.quat).x, _fw.z), pitch: 0 };
    this.enabled = false;
    this.g = 1;
    this.mach = 0;
    this.camPos = new THREE.Vector3();
    this.crashed = false;
    this.hc = rig.userData.hc; // its centre's height on its wheels
    this.surfaces = this.hingeSurfaces();
    this.flames = this.buildFlames();
    this.darkCockpit();
    this.input.look.dx = this.input.look.dy = 0;
  }

  // The control surfaces on hinges, so they can be seen working: the flaperons (pitch and roll), the
  // all-moving tailplanes, the rudders on the canted fins.
  hingeSurfaces() {
    const jet = this.rig.children[0], out = [];
    const hinge = (re, axis, k) => {
      const list = meshes(jet, (n) => re.test(n));
      if (!list.length) return;
      const b = boundsIn(this.rig, list), at = b.getCenter(V(0, 0, 0)); at.z = b.max.z; // the front edge
      out.push({ p: pivot(this.rig, list, at), axis, k });
    };
    hinge(/^Left_Eleron/, V(1, 0, 0), { pitch: -0.25, roll: -0.35 });
    hinge(/^Right_Eleron/, V(1, 0, 0), { pitch: -0.25, roll: 0.35 });
    hinge(/^Left_Stabilizer/, V(1, 0, 0), { pitch: -0.35, roll: -0.12 });
    hinge(/^Right_Stabilizer/, V(1, 0, 0), { pitch: -0.35, roll: 0.12 });
    hinge(/^Left_Keel/, V(0, 1, 0), { yaw: 0.35 });
    hinge(/^Right_Keel/, V(0, 1, 0), { yaw: 0.35 });
    return out;
  }

  // The cockpit as cockpits are: matte dark grey consoles and seat (the model's were pale), the
  // displays lit a dim green.
  darkCockpit() {
    const jet = this.rig.children[0];
    for (const m of meshes(jet, (n) => /^(Control_Panel|Cabin_Inner|Cabin_Carcas|Pilot_Seat|Pilot_Horizon|Pilot_Fuel|Right_Display)/.test(n))) {
      const lit = /Display|Horizon|Fuel/.test(m.name);
      m.material = m.material.clone();
      m.material.color.multiplyScalar(lit ? 0.4 : 0.22);
      m.material.roughness = 0.8;
      m.material.metalness = 0.1;
      if (lit) { m.material.emissive = new THREE.Color(0.05, 0.22, 0.12); m.material.emissiveIntensity = 1; }
    }
  }

  // The afterburner: a lit cone of exhaust from each nozzle, its length the throttle past 100%.
  buildFlames() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uK: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uK, uTime; varying vec2 vUv;
        void main(){
          float a = (1.0 - vUv.y);
          float diamond = 0.75 + 0.25 * sin(vUv.y * 38.0 - uTime * 40.0);
          vec3 c = mix(vec3(1.6, 0.7, 0.25), vec3(0.5, 0.7, 1.6), smoothstep(0.75, 1.0, a)) * diamond;
          gl_FragColor = vec4(c * a * a * uK, 1.0);
        }`,
    });
    const out = [];
    for (const side of ['L', 'R']) {
      const n = this.rig.userData.nozzles?.[side];
      if (!n) continue;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 6, 18, 1, true).translate(0, -3, 0).rotateX(Math.PI / 2), mat);
      cone.position.copy(n).add(V(0, 0, -0.6));
      cone.scale.set(1, 1, 0.001);
      cone.frustumCulled = false;
      this.rig.add(cone);
      out.push(cone);
    }
    this.flameMat = mat;
    return out;
  }

  axes() {
    _fw.set(0, 0, 1).applyQuaternion(this.quat);
    _up.set(0, 1, 0).applyQuaternion(this.quat);
    _lf.set(1, 0, 0).applyQuaternion(this.quat);
  }

  get alt() { return this.pos.y - this.hc - this.ground(this.pos.x, this.pos.z); }
  get speed() { return this.vel.length(); }
  get heading() { this.axes(); return (THREE.MathUtils.radToDeg(Math.atan2(_fw.x, -_fw.z)) + 360) % 360; }

  aimDir(out = new THREE.Vector3()) {
    const { yaw, pitch } = this.aim, cp = Math.cos(pitch);
    return out.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
  }

  // The player's input, then the airframe forward in small steps.
  update(dt) {
    if (this.crashed) return;
    const inp = this.input, J = JET;
    let roll = 0, yawK = 0;
    if (this.enabled) {
      if (inp.down('KeyW')) this.throttle = Math.min(1.25, this.throttle + dt * 0.45);
      if (inp.down('KeyS')) this.throttle = Math.max(0, this.throttle - dt * 0.6);
      if (inp.hit('KeyG')) { this.gearDown = !this.gearDown; this.onGear?.(this.gearDown); }
      if (inp.hit('KeyC')) this.toggleView();
      this.brake = inp.down('KeyB') ? 1 : 0;
      roll = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
      yawK = (inp.down('KeyQ') ? 1 : 0) - (inp.down('KeyE') ? 1 : 0);
      // the mouse moves the aim (in the world, level with the horizon)
      this.aim.yaw -= inp.look.dx * 0.0021;
      this.aim.pitch = clamp(this.aim.pitch - inp.look.dy * 0.0017, this.onGround ? -0.05 : -1.45, 1.45);
    }
    this.rollKey = roll; this.yawKey = yawK;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) this.step(dt / n);
    this.place();
    this.updateCamera(dt);
    this.report(dt);
  }

  step(h) {
    const J = JET;
    this.axes();
    const v = this.vel, sp = v.length(), ground = this.ground(this.pos.x, this.pos.z);
    const rho = 1.225 * Math.exp(-Math.max(0, this.pos.y) / 8500), qbar = 0.5 * rho * sp * sp;
    const vh = sp > 0.5 ? _vh.copy(v).divideScalar(sp) : _vh.copy(_fw);
    // angle of attack (velocity below the nose is positive) and sideslip
    const alpha = Math.atan2(-vh.dot(_up), Math.max(1e-3, vh.dot(_fw)));
    const beta = Math.atan2(vh.dot(_lf), Math.max(1e-3, vh.dot(_fw)));
    this.alpha = alpha;
    const aAbs = Math.abs(alpha);
    const cl = Math.sign(alpha) * (aAbs < J.stall ? J.cla * aAbs : J.cla * J.stall * Math.max(0.35, 1 - (aAbs - J.stall) * 2.2));
    this.mach = sp / (340 - 0.004 * Math.max(0, this.pos.y));
    const wave = 0.011 * ss(0.85, 1.02, this.mach) * (1 - 0.4 * ss(1.1, 1.6, this.mach));
    const cd = J.cd0 + J.k * cl * cl + wave + (this.gearDown ? 0.022 : 0) + (this.brake && !this.onGround ? 0.05 : 0);
    // forces (world), not counting weight
    const F = _a.set(0, 0, 0);
    const ab = this.throttle > 1;
    const thrust = (ab ? J.dry + (J.ab - J.dry) * (this.throttle - 1) / 0.25 : J.dry * this.throttle) * Math.pow(rho / 1.225, 0.55);
    F.addScaledVector(_fw, thrust);
    if (sp > 0.5) {
      // lift across the velocity, in the plane of the velocity and the wing's up
      _b.copy(_up).addScaledVector(vh, -_up.dot(vh));
      if (_b.lengthSq() > 1e-8) F.addScaledVector(_b.normalize(), qbar * J.S * cl);
      F.addScaledVector(vh, -qbar * J.S * cd);
      F.addScaledVector(_lf, -qbar * J.S * 0.9 * beta); // the fins weathervane it into the wind
    }
    const accel = _c.copy(F).divideScalar(J.mass);
    this.gNow = accel.dot(_up) / 9.81;
    accel.y -= 9.81;
    // the commanded rates: the mouse aim's autopilot, the keys over it
    const loc = _t.copy(this.aimDir(_t)).applyQuaternion(_q.copy(this.quat).invert());
    // gear down (an approach), the aim is where it should go, not where the nose points: slow, the
    // nose rides high above the flight path, and pointing the nose at the runway dives it in
    if (this.gearDown && !this.onGround && sp > 30) { loc.y += Math.sin(alpha) * loc.z; loc.normalize(); }
    const off = Math.acos(clamp(loc.z, -1, 1));
    let pitchCmd = clamp(loc.y * 4.5, -1, 1);
    if (loc.z < 0) pitchCmd = loc.y >= 0 ? 1 : -1; // behind: pull round
    let yawCmd = clamp(loc.x * 2.5, -1, 1);
    // bank toward it (right is positive); a target below is reached by pushing, not by rolling over
    const toward = Math.atan2(-loc.x, Math.max(Math.abs(loc.y), 0.05));
    const level = -_lf.y * 2.2; // wings level (left wing up: roll left)
    let rollCmd = clamp(THREE.MathUtils.lerp(level, toward * 2.5, ss(0.04, 0.22, off)), -1, 1);
    if (this.rollKey) rollCmd = this.rollKey;
    if (this.yawKey) yawCmd = this.yawKey;
    if (!this.enabled) { pitchCmd = this.script?.pitch ?? 0; rollCmd = this.script?.roll ?? level; yawCmd = 0; }
    const auth = clamp(qbar / 9000, 0.12, 1.2);
    let pRate = pitchCmd * J.maxPitch * Math.min(1, auth * 1.3);
    // the limiters: no more alpha than it can fly, no more than 9 g
    if (alpha > J.alphaMax && pRate > 0) pRate *= Math.max(0, 1 - (alpha - J.alphaMax) * 8);
    const gMax = J.gLimit * 9.81 / Math.max(sp, 30);
    pRate = clamp(pRate, -gMax * 0.5, gMax);
    const cmd = _b.set(-pRate, yawCmd * J.maxYaw * Math.min(1, auth), rollCmd * J.maxRoll * Math.min(1, auth));
    if (this.onGround) cmd.z = 0;
    const lag = 1 - Math.exp(-h * 6);
    this.w.lerp(cmd, lag);
    // integrate
    v.addScaledVector(accel, h);
    this.pos.addScaledVector(v, h);
    // (its own axis vector: `loc` lives in _t, and the nose-wheel steering below still reads it)
    if (this.w.lengthSq() > 1e-12) this.quat.multiply(_q.setFromAxisAngle(_ax.copy(this.w).normalize(), this.w.length() * h)).normalize();
    // the ground: on its wheels, or a crash
    const floor = ground + this.hc;
    if (this.pos.y <= floor + 0.02) {
      this.axes();
      const pitch = Math.asin(clamp(_fw.y, -1, 1)), bank = Math.asin(clamp(_lf.y, -1, 1));
      const sink = -v.y;
      if (!this.onGround && (!this.gearDown || sink > 5.5 || Math.abs(bank) > 0.3 || pitch < -0.06 || pitch > 0.32 || this.offField?.(this.pos.x, this.pos.z))) { this.crash(); return; }
      this.onGround = true;
      this.pos.y = floor;
      if (v.y < 0) v.y = 0;
      // the wheels: no sliding sideways, rolling friction, the brakes
      const fs = v.dot(_b.copy(_fw).setY(0).normalize());
      const fwdFlat = _b;
      _c.copy(v).setY(0).addScaledVector(fwdFlat, -fs);
      v.addScaledVector(_c, -Math.min(1, h * 12));
      const decel = (0.25 + this.brake * 5.5) * h;
      const nfs = Math.sign(fs) * Math.max(0, Math.abs(fs) - decel);
      v.addScaledVector(fwdFlat, nfs - fs);
      // level wings, no nose below the horizon; the nose wheel steers it (slower, the more it turns)
      const yaw = Math.atan2(_fw.x, _fw.z) + (this.enabled ? (this.yawKey || clamp(loc.x * 3, -1, 1)) * h * clamp(4 / Math.max(1, Math.abs(fs)), 0.04, 0.6) : 0);
      const p = clamp(pitch + (-this.w.x) * h, 0, 0.3);
      this.quat.setFromEuler(new THREE.Euler(-p, yaw, 0, 'YXZ'));
      this.w.set(this.w.x, 0, 0);
      if (p <= 0 && this.w.x > 0) this.w.x = 0;
    } else if (this.pos.y > floor + 0.3) this.onGround = false;
  }

  crash() {
    this.crashed = true;
    this.onCrash?.();
  }

  place() {
    const r = this.rig;
    r.position.copy(this.pos);
    r.quaternion.copy(this.quat);
    // the control surfaces show what it's asking for
    const w = this.w, k = { pitch: clamp(-w.x / JET.maxPitch, -1, 1), roll: clamp(w.z / JET.maxRoll, -1, 1), yaw: clamp(w.y / JET.maxYaw, -1, 1) };
    for (const s of this.surfaces) {
      const a = (s.k.pitch ?? 0) * k.pitch + (s.k.roll ?? 0) * k.roll + (s.k.yaw ?? 0) * k.yaw;
      s.p.quaternion.setFromAxisAngle(s.axis, a);
    }
    const ab = clamp((this.throttle - 1) / 0.25, 0, 1);
    for (const f of this.flames) f.scale.set(0.6 + 0.4 * ab, 0.6 + 0.4 * ab, 0.001 + ab * (0.85 + Math.random() * 0.15));
    this.flameMat.uniforms.uK.value = ab;
    this.flameMat.uniforms.uTime.value += 0.016;
  }

  toggleView() {
    this.view = this.view === 'chase' ? 'cockpit' : 'chase';
    this.onView?.(this.view);
  }

  updateCamera(dt) {
    const d = this.director;
    this.axes();
    const aim = this.aimDir(_a);
    if (this.view === 'cockpit') {
      // from his eyes: fixed to the airframe (the HUD's on its glass), looking a little toward the aim
      const eye = this.eye?.() ?? this.pos.clone().addScaledVector(_fw, 5.4).addScaledVector(_up, 1.25);
      d.pos.copy(eye);
      _b.copy(_fw).lerp(aim, 0.18).normalize();
      d.look.copy(eye).addScaledVector(_b, 50);
      d.up = _up.clone();
      d.fov = 62;
      d.mode = 'follow';
      return;
    }
    d.up = null;
    // behind it along the aim, a little above (MouseFlight's rig): the jet banks round in front of it
    const sp = this.speed, dist = 17 + Math.min(6, sp * 0.02);
    _b.copy(this.pos).addScaledVector(aim, -dist).addScaledVector(UP, 4.2);
    const gnd = this.ground(_b.x, _b.z) + 1.5;
    if (_b.y < gnd) _b.y = gnd;
    if (this.snap) { this.camPos.copy(_b); this.snap = false; } else this.camPos.lerp(_b, 1 - Math.exp(-dt * 9));
    d.pos.copy(this.camPos);
    d.look.copy(this.camPos).addScaledVector(aim, 60).addScaledVector(UP, -2.5);
    d.fov = 60 + Math.min(10, sp * 0.03);
    d.mode = 'follow';
  }

  // The readouts, and where the aim and the nose are on screen.
  report(dt) {
    const cam = this.engine.camera, W = innerWidth, H = innerHeight;
    const scr = (p) => { _c.copy(p).project(cam); return _c.z < 1 ? { x: (_c.x * 0.5 + 0.5) * W, y: (0.5 - _c.y * 0.5) * H } : null; };
    this.axes();
    const aimP = scr(_a.copy(cam.position).addScaledVector(this.aimDir(_b), 800));
    const noseP = scr(_a.copy(this.pos).addScaledVector(_fw, 800));
    const fpm = this.speed > 5 ? scr(_a.copy(cam.position).addScaledVector(_b.copy(this.vel).normalize(), 800)) : null;
    const pitch = THREE.MathUtils.radToDeg(Math.asin(clamp(_fw.y, -1, 1)));
    const bank = Math.atan2(_lf.y, _up.y);
    this.g = damp(this.g, this.gNow ?? 1, 6, dt);
    const kias = this.speed * KT * Math.sqrt(Math.exp(-Math.max(0, this.pos.y) / 8500));
    const stall = !this.onGround && (this.alpha ?? 0) > JET.stall * 0.9;
    const pullUp = !this.onGround && !this.gearDown && this.vel.y < -5 && this.alt / -this.vel.y < 6;
    this.hud?.jet({
      view: this.view, kias, mach: this.mach, alt: this.alt * FT, vs: this.vel.y * FT * 60, g: this.g, heading: this.heading,
      throttle: Math.min(1, this.throttle), ab: this.throttle > 1.001, gear: this.gearDown, brake: !!this.brake,
      aim: aimP, nose: this.view === 'chase' ? noseP : null, water: this.view === 'cockpit' ? noseP : null, fpm: this.view === 'cockpit' ? fpm : null,
      pitch, roll: bank, ppd: H / 62, stall, warn: pullUp ? 'PULL UP' : stall ? 'STALL' : this.warn ?? null,
    });
  }
}
