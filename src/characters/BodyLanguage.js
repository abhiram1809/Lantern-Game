import * as THREE from 'three';
import { ease, damp } from '../engine/Time.js';

// Body language for a character who stands and talks (Kilowog on his podium). The approach is the
// one conversation systems in games use: a library of short hand gestures solved with arm IK, cued
// to words of a line; small head beats while speaking; a resting stance to return to between
// gestures; and idle fidgets so a listener never freezes.
//
// Hand keys are [t, [x, y, z]] in the body's own frame (x toward its left hand, y up, z forward),
// in metres for Kilowog (2.4 m, shoulders at ±0.43, 1.78; arms about 0.69 m long), scaled to the
// rig. A hand eases between keys; its arm blends in at the start and back out at the end.
// `lean` keys are [t, pitch, yaw] for the chest; `head` cues are [t, kind, duration, amount].
const GESTURES = {
  // thumping his own chest: "Kilowog", "you're mine"
  chest: { dur: 1.3, rate: 9, poleR: [-1, -0.3, -0.2], R: [[0.15, [-0.2, 1.63, 0.47]], [0.33, [-0.16, 1.6, 0.39]], [0.5, [-0.2, 1.63, 0.47]], [0.66, [-0.16, 1.6, 0.39]], [1.0, [-0.2, 1.62, 0.46]]], lean: [[0.1, -0.05, 0.1], [1.0, -0.02, 0]], head: [[0.2, 'chin', 0.8, 0.8]] },
  // a raised fist, shaken: "these ones bite", "break 'em"
  fist: { dur: 1.3, rate: 9, poleR: [-1, -0.6, -0.4], R: [[0.25, [-0.52, 1.92, 0.42]], [0.45, [-0.5, 2.0, 0.44]], [0.6, [-0.52, 1.9, 0.44]], [0.75, [-0.5, 1.99, 0.45]], [1.1, [-0.52, 1.92, 0.42]]], lean: [[0.2, 0.09, -0.08], [1.1, 0.04, 0]], head: [[0.35, 'beat', 0.4, 0.8]] },
  // a short pump of the fist: a kill
  pump: { dur: 0.9, rate: 12, poleR: [-1, -0.6, -0.4], R: [[0.12, [-0.5, 1.78, 0.42]], [0.28, [-0.52, 1.5, 0.38]], [0.7, [-0.52, 1.5, 0.36]]], head: [[0.2, 'beat', 0.35, 0.7]] },
  // an open hand toward the listener: "you", "rookie"
  open: { dur: 1.2, rate: 7, poleR: [-0.8, -0.7, -0.2], R: [[0.3, [-0.5, 1.5, 0.52]], [1.0, [-0.5, 1.52, 0.5]]], lean: [[0.3, 0.06, 0], [1.0, 0.03, 0]] },
  // both hands out at the sides: "means you're new", "what?"
  shrug: { dur: 1.3, rate: 7, poleL: [1, -0.4, -0.4], poleR: [-1, -0.4, -0.4], L: [[0.3, [0.72, 1.42, 0.34]], [1.0, [0.74, 1.44, 0.32]]], R: [[0.3, [-0.72, 1.42, 0.34]], [1.0, [-0.74, 1.44, 0.32]]], lean: [[0.3, -0.04, 0], [1.0, 0, 0]], head: [[0.3, 'tilt', 0.9, 0.7]] },
  // an open hand swept across the range, the chest following it
  sweep: { dur: 1.5, rate: 6, poleR: [-0.9, -0.6, -0.3], R: [[0.25, [-0.28, 1.62, 0.55]], [0.95, [-0.75, 1.55, 0.3]], [1.2, [-0.78, 1.5, 0.26]]], lean: [[0.25, 0.03, 0.22], [0.95, 0.02, -0.26], [1.4, 0, 0]] },
  // "come on": the hand pulled in toward himself, twice
  beckon: { dur: 1.2, rate: 10, poleR: [-1, -0.5, -0.2], R: [[0.2, [-0.45, 1.62, 0.5]], [0.4, [-0.46, 1.72, 0.27]], [0.6, [-0.45, 1.62, 0.5]], [0.8, [-0.46, 1.72, 0.27]], [1.0, [-0.45, 1.62, 0.48]]], lean: [[0.2, 0.05, 0], [1.0, 0, 0]], head: [[0.3, 'chin', 0.7, 0.6]] },
  // a flick of the hand: "wash out", "fists are for bar fights"
  dismiss: { dur: 0.9, rate: 11, poleR: [-1, -0.5, -0.3], R: [[0.18, [-0.36, 1.58, 0.5]], [0.36, [-0.72, 1.45, 0.38]], [0.7, [-0.74, 1.43, 0.34]]], lean: [[0.2, 0, 0.1], [0.5, 0, -0.12], [0.85, 0, 0]], head: [[0.2, 'shake', 0.6, 0.5]] },
  // a finger to the temple: "if you can see it"
  temple: { dur: 1.5, rate: 8, poleR: [-1, -0.2, -0.3], R: [[0.3, [-0.38, 2.04, 0.24]], [0.5, [-0.34, 2.07, 0.27]], [1.2, [-0.36, 2.05, 0.25]]], head: [[0.35, 'tilt', 0.9, -0.5]] },
};
// Resting stances: fists on the hips, elbows out (the drill sergeant), or arms down (the mocap).
const STANCES = {
  hips: { L: [0.6, 1.24, 0.08], R: [-0.6, 1.24, 0.08], poleL: [1, 0, -0.6], poleR: [-1, 0, -0.6] },
};

const _a = new THREE.Vector3();

export class BodyLanguage {
  // `gestures` / `stances` replace Kilowog's library for another character (then `scale` is usually
  // 1, the library written in that character's own metres). `shift` is the pair of stances an idle
  // fidget swaps between (null: never).
  constructor(rig, animator, { lookHome = null, gestures = GESTURES, stances = STANCES, scale = rig.restPos.head.y / 2.1, reach = 0.62, shift = ['hips', null] } = {}) {
    Object.assign(this, { rig, anim: animator, lookHome, gestures, stances, scale, reach, shift });
    this.stanceName = null;
    this.active = null;
    this.talking = false;
    this.beatT = 0;
    this.idleT = 3;
    this.lean = { pitch: 0, yaw: 0 };
    this.glanceT = 0;
  }

  // body-local keyframe position to world
  world(p, out = new THREE.Vector3()) {
    const root = this.rig.root;
    root.updateMatrixWorld();
    return out.set(p[0], p[1], p[2]).multiplyScalar(this.scale).applyMatrix4(root.matrixWorld);
  }

  stance(name) {
    this.stanceName = name;
    for (const side of ['L', 'R']) if (!this.active?.def[side] && !this.held?.[side]) this.rest(side);
  }

  // A hand taken over by something else (a construct in it); null gives it back to the stance.
  hold(side, on) {
    (this.held ??= {})[side] = on;
    if (!on) this.rest(side);
  }

  // put a hand back in the stance (or let it go to the mocap)
  rest(side) {
    const s = this.stances[this.stanceName];
    if (!s?.[side]) { this.anim.reach(side, null, { rate: 4 }); return; } // (a stance may only place one hand)
    const p = s[side], out = new THREE.Vector3();
    this.anim.reach(side, () => this.world(p, out), { pole: new THREE.Vector3(...s[`pole${side}`]), rate: 3.5 });
  }

  // Play a gesture by name (or a definition). One at a time; a new one takes over.
  play(name) {
    const def = typeof name === 'string' ? this.gestures[name] : name;
    if (!def) return;
    const prev = this.active;
    const g = (this.active = { def, t: 0, cued: new Set() });
    for (const side of ['L', 'R']) {
      const keys = def[side];
      if (!keys) { if (prev?.def[side] && !this.held?.[side]) this.rest(side); continue; }
      const out = new THREE.Vector3();
      this.anim.reach(side, () => this.world(sample(keys, g.t), out), { pole: new THREE.Vector3(...(def[`pole${side}`] ?? [side === 'L' ? 1 : -1, -0.5, -0.3])), rate: def.rate ?? 7 });
    }
  }

  // Point at a world point (or a function returning one) for `hold` seconds, with the arm on that
  // side (a right arm reaching across the chest reads as a fist at the chin), the chest turning a
  // little toward it.
  pointAt(target, hold = 1.6) {
    const sh = new THREE.Vector3(), out = new THREE.Vector3();
    const at0 = (typeof target === 'function' ? target() : target).clone();
    this.rig.root.updateMatrixWorld();
    const local = this.rig.root.worldToLocal(at0);
    const side = local.x > 0.3 ? 'L' : 'R', other = side === 'L' ? 'R' : 'L';
    if (this.active?.def[other]) this.rest(other);
    const yaw = Math.max(-0.3, Math.min(0.3, Math.atan2(local.x, local.z) * 0.35));
    this.active = { def: { dur: hold, [side]: true, lean: [[0.3, 0.05, yaw], [hold, 0.03, yaw * 0.5]] }, t: 0, cued: new Set() };
    this.anim.reach(side, () => {
      this.rig.bonePosition(`upperArm_${side}`, sh);
      const at = typeof target === 'function' ? target() : target;
      return out.copy(at).sub(sh).normalize().multiplyScalar(this.reach * this.scale).add(sh);
    }, { pole: new THREE.Vector3(side === 'L' ? 0.6 : -0.6, -0.7, -0.3), rate: 6 });
  }

  // Head beats while speaking.
  talk(on) { this.talking = on; this.beatT = 0.1; }

  update(dt) {
    const g = this.active;
    let wantPitch = this.talking ? 0.025 : 0, wantYaw = 0;
    if (g) {
      g.t += dt;
      const d = g.def;
      for (const [i, c] of (d.head ?? []).entries()) if (!g.cued.has(i) && g.t >= c[0]) { g.cued.add(i); this.anim.gesture(c[1], c[2], c[3]); }
      if (d.lean) { const l = sampleLean(d.lean, g.t); wantPitch += l[0]; wantYaw += l[1]; }
      if (g.t >= d.dur) {
        this.active = null;
        for (const side of ['L', 'R']) if (d[side] && !this.held?.[side]) this.rest(side);
      }
    }
    this.lean.pitch = damp(this.lean.pitch, wantPitch, 5, dt);
    this.lean.yaw = damp(this.lean.yaw, wantYaw, 4, dt);
    this.anim.lean.pitch = this.lean.pitch;
    this.anim.lean.yaw = this.lean.yaw;

    // talking: a beat of the head every syllable group, now and then a tilt
    if (this.talking) {
      if ((this.beatT -= dt) <= 0) {
        this.beatT = 0.28 + Math.random() * 0.42;
        if (Math.random() < 0.18) this.anim.gesture('tilt', 0.7, (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.3));
        else this.anim.gesture('beat', 0.3, 0.25 + Math.random() * 0.35);
      }
      this.idleT = 2.5 + Math.random() * 2;
      return;
    }
    // listening or waiting: fidgets
    if (this.glanceT > 0 && (this.glanceT -= dt) <= 0 && this.lookHome) this.anim.lookAt(this.lookHome(), 0.6);
    if (g || (this.idleT -= dt) > 0) return;
    this.idleT = 4 + Math.random() * 5;
    const r = Math.random();
    if (r < 0.28) this.anim.gesture('tilt', 1.1, (Math.random() < 0.5 ? -1 : 1) * 0.45);
    else if (r < 0.5 && this.shift) this.stance(this.stanceName === this.shift[0] ? this.shift[1] : this.shift[0]);
    else if (r < 0.78 && this.lookHome) {
      // a glance off to one side and back
      const side = Math.random() < 0.5 ? -1 : 1;
      this.anim.lookAt(this.world([side * 2.5, 2.2 + Math.random() * 1.5, 4], _a).clone(), 0.5);
      this.glanceT = 1.2 + Math.random();
    } else this.anim.gesture('chin', 1.2, 0.6);
  }
}

// position along eased keys at time t
function sample(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t < t1) {
      const e = ease.inOut((t - t0) / (t1 - t0));
      return [p0[0] + (p1[0] - p0[0]) * e, p0[1] + (p1[1] - p0[1]) * e, p0[2] + (p1[2] - p0[2]) * e];
    }
  }
  return keys[keys.length - 1][1];
}

function sampleLean(keys, t) {
  if (t <= keys[0][0]) { const k = Math.min(1, t / Math.max(keys[0][0], 1e-3)); return [keys[0][1] * k, keys[0][2] * k]; }
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0, y0] = keys[i], [t1, p1, y1] = keys[i + 1];
    if (t < t1) { const e = ease.inOut((t - t0) / (t1 - t0)); return [p0 + (p1 - p0) * e, y0 + (y1 - y0) * e]; }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}
