import * as THREE from 'three';
import { makePose } from './Poses.js';
import { ease, damp, clamp } from '../engine/Time.js';
import { solveTwoBone, rotateBoneWorld } from './IK.js';

export const BONE_ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_L', 'foreArm_L', 'hand_L', 'upperArm_R', 'foreArm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];
export const PARENT = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  upperArm_L: 'chest', foreArm_L: 'upperArm_L', hand_L: 'foreArm_L', upperArm_R: 'chest', foreArm_R: 'upperArm_R', hand_R: 'foreArm_R',
  thigh_L: 'hips', shin_L: 'thigh_L', foot_L: 'shin_L', thigh_R: 'hips', shin_R: 'thigh_R', foot_R: 'shin_R',
};
const CHILD = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', upperArm_L: 'foreArm_L', foreArm_L: 'hand_L', upperArm_R: 'foreArm_R', foreArm_R: 'hand_R', thigh_L: 'shin_L', shin_L: 'foot_L', thigh_R: 'shin_R', shin_R: 'foot_R' };

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _axis = new THREE.Vector3(), _e = new THREE.Euler();

// A pose as local bone rotations (in BONE_ORDER) plus the hips' offset from rest.
export class QPose {
  constructor() {
    this.q = new Float32Array(BONE_ORDER.length * 4);
    this.hp = new Float32Array(3);
    for (let i = 0; i < BONE_ORDER.length; i++) this.q[i * 4 + 3] = 1;
  }
  copy(o) { this.q.set(o.q); this.hp.set(o.hp); return this; }
}

function blendQPose(out, a, b, t) {
  for (let i = 0; i < BONE_ORDER.length; i++) {
    _q.fromArray(a.q, i * 4);
    _q2.fromArray(b.q, i * 4);
    _q.slerp(_q2, t).toArray(out.q, i * 4);
  }
  for (let k = 0; k < 3; k++) out.hp[k] = a.hp[k] + (b.hp[k] - a.hp[k]) * t;
}

// Wraps an auto-rigged skeleton. Poses can come from flat parameters (`apply`, aims arms by
// direction so it works on T- and A-pose scans) or from quaternion poses (`applyQ`, mocap).
export class Rig {
  constructor(root) {
    this.root = root;
    this.bones = {};
    this.meshes = [];
    root.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        this.meshes.push(o);
        o.frustumCulled = false;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const local = (n) => this.bones[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    this.rest = Object.fromEntries(Object.entries(this.bones).map(([n, b]) => [n, b.position.clone()]));
    this.restPos = Object.fromEntries(BONE_ORDER.map((n) => [n, local(n)]));
    this.restDir = {};
    for (const n of BONE_ORDER) {
      if (CHILD[n]) this.restDir[n] = this.restPos[CHILD[n]].clone().sub(this.restPos[n]).normalize();
    }
    for (const s of ['L', 'R']) this.restDir[`hand_${s}`] = this.restDir[`foreArm_${s}`].clone();
    this.restDir.head = Y.clone();
    this.restDir.foot_L = this.restDir.foot_R = new THREE.Vector3(0, -0.5, 1).normalize();
    this.arm = { L: { upper: this.restDir.upperArm_L, fore: this.restDir.foreArm_L }, R: { upper: this.restDir.upperArm_R, fore: this.restDir.foreArm_R } };
    this.hipsHeight = this.restPos.hips.y;
    this.legLength = this.restPos.thigh_L.distanceTo(this.restPos.shin_L) + this.restPos.shin_L.distanceTo(this.restPos.foot_L);
    this.u = null; // shared material uniforms (glow, tint, dissolve), set by the character factory
  }

  get material() { return this.meshes[0].material; }

  apply(p) {
    const b = this.bones, r = this.rest;
    b.hips.position.set(r.hips.x + p.hx, r.hips.y + p.hy, r.hips.z + p.hz);
    b.hips.quaternion.setFromEuler(_e.set(p.hrx, p.hry, p.hrz));
    b.spine.quaternion.setFromEuler(_e.set(p.sx, p.sy, p.sz));
    b.chest.quaternion.setFromEuler(_e.set(p.cx, p.cy, p.cz));
    b.neck.quaternion.setFromEuler(_e.set(p.nx, p.ny, p.nz));
    b.head.quaternion.setFromEuler(_e.set(p.kx, p.ky, p.kz));
    this.aimArm('L', p.aL, p.tL, p.eL, p.wL);
    this.aimArm('R', p.aR, p.tR, p.eR, p.wR);
    b.thigh_L.quaternion.setFromEuler(_e.set(p.lLx, p.lLy, p.lLz));
    b.shin_L.quaternion.setFromAxisAngle(X, p.kL);
    b.foot_L.quaternion.setFromAxisAngle(X, p.fL);
    b.thigh_R.quaternion.setFromEuler(_e.set(p.lRx, p.lRy, p.lRz));
    b.shin_R.quaternion.setFromAxisAngle(X, p.kR);
    b.foot_R.quaternion.setFromAxisAngle(X, p.fR);
  }

  // Upper arm: shortest rotation from its rest direction to `dir`, then a twist about `dir`.
  // Elbow and wrist bend toward the front of the limb (positive = flex).
  aimArm(s, dir, twist, elbow, wrist) {
    const rest = this.arm[s];
    _v.set(dir[0], dir[1], dir[2]).normalize();
    _q.setFromUnitVectors(rest.upper, _v);
    _q2.setFromAxisAngle(_v, twist);
    this.bones[`upperArm_${s}`].quaternion.multiplyQuaternions(_q2, _q);
    _axis.crossVectors(rest.fore, Z).normalize();
    this.bones[`foreArm_${s}`].quaternion.setFromAxisAngle(_axis, elbow);
    this.bones[`hand_${s}`].quaternion.setFromAxisAngle(_axis, wrist);
  }

  capture(out) {
    BONE_ORDER.forEach((n, i) => this.bones[n].quaternion.toArray(out.q, i * 4));
    const h = this.bones.hips.position, r = this.rest.hips;
    out.hp[0] = h.x - r.x; out.hp[1] = h.y - r.y; out.hp[2] = h.z - r.z;
    return out;
  }

  applyQ(p) {
    BONE_ORDER.forEach((n, i) => this.bones[n].quaternion.fromArray(p.q, i * 4));
    const r = this.rest.hips;
    this.bones.hips.position.set(r.x + p.hp[0], r.y + p.hp[1], r.z + p.hp[2]);
  }

  // World position of a bone (e.g. to attach props or aim cameras).
  bonePosition(name, target = new THREE.Vector3()) {
    return this.bones[name].getWorldPosition(target);
  }
}

// Crossfades between pose generators and layers procedural motion on top. A generator is either
// a function (out, t, dt) => param pose, or an object with sample(outQPose, rig) and an optional
// update(dt) (mocap). Several rigs can follow one animator (both bodies during the transformation).
export class Animator {
  constructor(rig) {
    this.states = [];
    this.setRig(rig);
    this.param = makePose();
    this.gen = null;
    this.t = 0;
    this.fade = 1;
    this.fadeTime = 0.4;
    this.overlay = null; // (paramPose, t, dt) => void, for param generators
    this.breath = 0; // the param poses and the mocap clips carry their own breathing
    this.lean = { pitch: 0, roll: 0, yaw: 0 }; // yaw turns the chest (a gesture following a hand)
    this.twist = 0; // radians the hips (so the legs) turn toward the travel while strafing; the chest turns back
    this.armSpread = 0; // radians the upper arms swing out from the body (bulky characters' hands clear their armour)
    this.look = { target: null, weight: 0, w: 0, yaw: 0, pitch: 0, maxYaw: 0.85 };
    this.arms = { L: { target: null, weight: 0, w: 0, pole: null, keepHand: false }, R: { target: null, weight: 0, w: 0, pole: null, keepHand: false } };
    this.feet = { ground: null, offL: 0, offR: 0, drop: 0 };
    this.gestures = [];
  }

  get rig() { return this.states[0].rig; }

  setRig(rig) {
    const prev = this.states[0];
    const st = this.states.find((s) => s.rig === rig) ?? { rig, cur: new QPose(), from: new QPose(), tgt: new QPose() };
    if (!this.states.includes(st)) {
      if (prev) { st.cur.copy(prev.cur); st.from.copy(prev.from); } else rig.capture(st.cur);
    }
    this.states = [st];
    rig.applyQ(st.cur);
  }

  addRig(rig) {
    const st = { rig, cur: new QPose().copy(this.states[0].cur), from: new QPose().copy(this.states[0].from), tgt: new QPose() };
    this.states.push(st);
    rig.applyQ(st.cur);
  }

  play(gen, fadeTime = 0.45) {
    if (gen === this.gen) return;
    for (const s of this.states) s.from.copy(s.cur);
    this.gen = gen;
    this.fade = fadeTime > 0 ? 0 : 1;
    this.fadeTime = fadeTime;
  }

  // Look at a world point (or null to look ahead). weight 0..1 eases in and out.
  lookAt(target, weight = 1) { this.look.target = target; this.look.weight = target ? weight : 0; }

  // Reach a hand to a world point (Vector3 or function returning one); null releases it.
  // `rate` is how fast the arm blends in and out (higher snaps, e.g. for a punch).
  reach(side, target, { weight = 1, pole = null, keepHand = false, rate = 5 } = {}) {
    const arm = this.arms[side];
    Object.assign(arm, { weight: target ? weight : 0, pole: target ? pole : arm.pole, keepHand, rate });
    if (target) arm.target = target; // released arms keep their target while they ease out
  }

  // Procedural head gesture: 'nod', 'shake', 'beat' (one dip, for emphasis while talking), 'chin'
  // (a lift, looking down the nose) or 'tilt' (negative amount tilts the other way).
  gesture(kind, duration = 1.1, amount = 1) { this.gestures.push({ kind, t: 0, duration, amount }); }

  update(dt) {
    this.t += dt;
    if (!this.gen) return;
    let param = null;
    if (typeof this.gen === 'function') {
      param = this.gen(this.param, this.t, dt);
      this.overlay?.(param, this.t, dt);
    } else this.gen.update?.(dt);
    let k = 1;
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / this.fadeTime);
      k = ease.inOut(this.fade);
    }
    const lk = this.look, primary = this.states[0].rig;
    lk.w = damp(lk.w, lk.weight, 4, dt);
    for (const side of ['L', 'R']) { const a = this.arms[side]; a.w = damp(a.w, a.weight, a.rate ?? 5, dt); }
    this.gestures = this.gestures.filter((g) => (g.t += dt) < g.duration);

    for (const s of this.states) {
      if (param) { s.rig.apply(param); s.rig.capture(s.tgt); } else this.gen.sample(s.tgt, s.rig);
      if (k < 1) blendQPose(s.cur, s.from, s.tgt, k); else s.cur.copy(s.tgt);
      s.rig.applyQ(s.cur);
      this.applyLayers(s.rig, dt, s.rig === primary);
    }
  }

  applyLayers(rig, dt, primary) {
    const b = rig.bones, root = rig.root;
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_q3);
    // breathing in the chest
    if (this.breath) b.chest.quaternion.multiply(_q.setFromAxisAngle(X, Math.sin(this.t * 1.6) * 0.016 * this.breath));
    // momentum lean: pitch about the character's right axis, roll about its forward axis, and a turn
    // of the chest about its up axis
    const { pitch, roll, yaw = 0 } = this.lean;
    if (Math.abs(pitch) + Math.abs(roll) + Math.abs(yaw) > 1e-4) {
      _q.setFromAxisAngle(_v.copy(Y).applyQuaternion(_q3), yaw * 0.5)
        .multiply(_q2.setFromAxisAngle(_v.copy(X).applyQuaternion(_q3), pitch * 0.5))
        .multiply(_q4.setFromAxisAngle(_v2.copy(Z).applyQuaternion(_q3), roll * 0.5));
      rotateBoneWorld(b.spine, _q);
      rotateBoneWorld(b.chest, _q);
      root.updateMatrixWorld(true);
    }
    // strafing: the hips turn toward the travel, the spine and chest turn the upper body back square
    if (Math.abs(this.twist) > 1e-4) {
      const up = _axis.copy(Y).applyQuaternion(_q3);
      rotateBoneWorld(b.hips, _q.setFromAxisAngle(up, this.twist));
      rotateBoneWorld(b.spine, _q.setFromAxisAngle(up, -this.twist * 0.55));
      rotateBoneWorld(b.chest, _q.setFromAxisAngle(up, -this.twist * 0.45));
      root.updateMatrixWorld(true);
    }
    // arms set out from a bulky body, about the character's forward axis
    if (this.armSpread) {
      for (const [side, sgn] of [['L', 1], ['R', -1]]) rotateBoneWorld(b[`upperArm_${side}`], _q.setFromAxisAngle(_v.copy(Z).applyQuaternion(_q3), sgn * this.armSpread));
      root.updateMatrixWorld(true);
    }
    // head gestures
    for (const g of this.gestures) {
      const e = Math.sin(Math.PI * (g.t / g.duration)) * g.amount;
      let axis = X, a;
      if (g.kind === 'nod') a = Math.sin(g.t * 11) * 0.16 * e;
      else if (g.kind === 'shake') { axis = Y; a = Math.sin(g.t * 13) * 0.22 * e; }
      else if (g.kind === 'beat') a = 0.13 * e;
      else if (g.kind === 'chin') a = -0.14 * e;
      else { axis = Z; a = 0.16 * e; }
      b.head.quaternion.multiply(_q.setFromAxisAngle(axis, a));
    }
    this.applyLook(rig, dt, primary);
    for (const side of ['L', 'R']) {
      const arm = this.arms[side];
      if (arm.w < 0.002 || !arm.target) continue;
      const target = typeof arm.target === 'function' ? arm.target() : arm.target;
      if (!target) continue;
      const pole = _v2.copy(arm.pole ?? (side === 'L' ? _polL : _polR)).applyQuaternion(_q3);
      root.updateMatrixWorld(true);
      solveTwoBone(b[`upperArm_${side}`], b[`foreArm_${side}`], b[`hand_${side}`], target, pole, arm.w, arm.keepHand);
    }
    this.applyFeet(rig, dt, primary);
  }

  applyLook(rig, dt, primary) {
    const lk = this.look;
    if (lk.w < 0.002 && Math.abs(lk.yaw) + Math.abs(lk.pitch) < 1e-3) return;
    const b = rig.bones, root = rig.root;
    root.updateMatrixWorld(true);
    if (primary) {
      let yaw = 0, pitch = 0;
      const target = typeof lk.target === 'function' ? lk.target() : lk.target;
      if (target) {
        const head = b.head.getWorldPosition(_v);
        const dir = _v2.copy(target).sub(head).applyQuaternion(_q.copy(_q3).invert());
        // current head facing, relative to the body
        const fwd = Z.clone().applyQuaternion(b.head.getWorldQuaternion(_q2)).applyQuaternion(_q);
        const want = [clamp(Math.atan2(dir.x, dir.z), -lk.maxYaw, lk.maxYaw), clamp(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.5, 0.4)];
        const have = [Math.atan2(fwd.x, fwd.z), Math.atan2(fwd.y, Math.hypot(fwd.x, fwd.z))];
        yaw = (want[0] - have[0]) * lk.w; pitch = (want[1] - have[1]) * lk.w;
      }
      lk.yaw = damp(lk.yaw, yaw, 4, dt);
      lk.pitch = damp(lk.pitch, pitch, 4, dt);
    }
    // shared between neck and head, yaw about the body's up axis then pitch about its right axis
    for (const [bone, share] of [[b.neck, 0.5], [b.head, 0.5]]) {
      _q.setFromAxisAngle(_v.copy(Y).applyQuaternion(_q3), lk.yaw * share)
        .multiply(_q2.setFromAxisAngle(_v2.copy(X).applyQuaternion(_q3), -lk.pitch * share));
      rotateBoneWorld(bone, _q);
      bone.updateMatrixWorld(true);
    }
  }

  // Keep the feet on uneven ground: lower the hips for the lower foot, bend the other leg.
  applyFeet(rig, dt, primary) {
    const f = this.feet;
    if (!f.ground) return;
    const b = rig.bones, root = rig.root;
    root.updateMatrixWorld(true);
    const base = root.getWorldPosition(_v).y;
    if (primary) {
      const pl = b.foot_L.getWorldPosition(_v2), offL = clamp(f.ground(pl.x, pl.z) - base, -0.3, 0.3);
      const pr = b.foot_R.getWorldPosition(_v2), offR = clamp(f.ground(pr.x, pr.z) - base, -0.3, 0.3);
      f.offL = damp(f.offL, offL, 18, dt);
      f.offR = damp(f.offR, offR, 18, dt);
      f.drop = damp(f.drop, Math.min(0, f.offL, f.offR), 12, dt);
    }
    if (Math.abs(f.offL) + Math.abs(f.offR) < 0.004) return;
    b.hips.position.y += f.drop / Math.max(1e-3, root.getWorldScale(_v2).y);
    root.updateMatrixWorld(true);
    const fwd = _v2.copy(Z).applyQuaternion(_q3);
    for (const [side, off] of [['L', f.offL], ['R', f.offR]]) {
      const target = b[`foot_${side}`].getWorldPosition(new THREE.Vector3());
      target.y += off - f.drop;
      solveTwoBone(b[`thigh_${side}`], b[`shin_${side}`], b[`foot_${side}`], target, fwd, 1, true);
    }
  }
}
const _polL = new THREE.Vector3(0.45, -0.55, -0.7), _polR = new THREE.Vector3(-0.45, -0.55, -0.7); // elbows out, down, back
