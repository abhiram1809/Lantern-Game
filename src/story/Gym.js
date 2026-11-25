import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame, clamp, damp } from '../engine/Time.js';
import { makePose, copyPose, blendInto } from '../characters/Poses.js';
import { solveTwoBone } from '../characters/IK.js';
import { prop, hasProp } from '../props/Props.js';

// Iron Beach Gym's day passes played out (2026-11-24, the user: "when he's working out in the gym, make
// animations for that so that he can be seen bench pressing or boxing the bag"): bought at the counter
// (city/Shops.js SHOPS.gym, Roam.shopBuy), each is shown for half a minute or less, E or a click cuts it
// short, and the rest of the hour passes in a fade (his health back, as before).
//   bench  to the bench's foot, back onto the pad, lain back under the bar, the bar out of the hooks, six reps
//          that get harder (the trainer comes over to spot the last ones), racked, and up again
//   bag    gloved up, squared up to the heavy bag on its chain: combinations and footwork round it, each blow
//          a push on the bag's body where the glove lands (it swings and turns on its chain), a thud for each
//   rope   the jump rope: two feet, then a boxer's skip, the rope round him under his feet
// Hal is driven here outside the player's update (`Body`): his root placed so his hips are where the move
// wants them, his feet and hands put on their marks by two-bone IK after the pose (planted feet don't slide),
// his hands turned to what they hold, and his fingers, which the scans don't have, given two joints of their
// own (`fingerBones`) so a hand closes round the bar, a rope's handle, or into a fist inside a glove.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SKIP = Symbol('skip');
const UP = V(0, 1, 0), X = V(1, 0, 0);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _v = V(0, 0, 0), _v2 = V(0, 0, 0), _v3 = V(0, 0, 0), _fa = V(0, 0, 0), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();

const HAND_IN = 0.45; // (a gloved hand's size inside the glove: wearGloves)

// ------------------------------------------------------------------------------------------- fingers
// Two bones for each hand's four fingers, added to the scan's skeleton once: at the knuckles, and at the
// fingers' middle joints, each turning about the hand's breadth (toward the palm: a curl). The fingers'
// vertices past the knuckles are weighted over to them (blended across a centimetre or two); the thumb's
// stay with the hand. Uncurled, they move with the hand exactly as before.
export function fingerBones(rig) {
  if (rig._fingers) return rig._fingers;
  const mesh = rig.meshes[0], sk = mesh?.skeleton;
  // set(side, knuckles, middle joints, thumb): the thumb's `t` brings it in across the palm (toward the palm and
  // along the fingers: into a glove's thumb, under a bar)
  // (`shrink` draws the fingers and the thumb in toward the knuckles and the wrist: inside a glove, where nothing
  // of them may show through its cuff)
  const out = (rig._fingers = { sides: {}, set: (side, a1, a2, t = 0, shrink = 1) => {
    const s = out.sides[side];
    if (!s) return;
    s.b1.scale.setScalar(shrink);
    s.b3?.scale.setScalar(shrink < 1 ? shrink * 0.5 : 1);
    s.b1.quaternion.setFromAxisAngle(s.axis, a1);
    s.b2.quaternion.setFromAxisAngle(s.axis, a2);
    s.b3?.quaternion.setFromAxisAngle(s.along, -s.thumbSide * t).multiply(_q2.setFromAxisAngle(s.normal, s.thumbSide * t * 0.45));
  } });
  if (!sk) return out;
  const G = mesh.geometry, P = G.attributes.position, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight;
  for (const side of ['L', 'R']) {
    const hand = rig.bones[`hand_${side}`], hi = sk.bones.indexOf(hand);
    if (hi < 0) continue;
    const palm = rig.palm(side), A = palm.along.clone(), N = palm.normal.clone(), C = V(0, 0, 0).crossVectors(A, N).normalize();
    const toBone = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[hi], mesh.bindMatrix);
    const pts = [];
    for (let i = 0; i < P.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === hi) w += SW.getComponent(i, k);
      if (w <= 0) continue;
      _v.fromBufferAttribute(P, i).applyMatrix4(toBone);
      pts.push({ i, w, a: _v.dot(A), c: _v.dot(C), n: _v.dot(N) });
    }
    if (pts.length < 50) continue;
    const aMax = Math.max(...pts.filter((p) => p.w > 0.5).map((p) => p.a));
    // the fingers' breadth where only they are (past the thumb), and the thumb: what reaches out beyond it
    const band = pts.filter((p) => p.a > aMax * 0.62 && p.a < aMax * 0.8);
    const c0 = Math.min(...band.map((p) => p.c)), c1 = Math.max(...band.map((p) => p.c));
    const low = pts.filter((p) => p.a > aMax * 0.2 && p.a < aMax * 0.5);
    const sign = Math.max(...low.map((p) => p.c)) - c1 > c0 - Math.min(...low.map((p) => p.c)) ? 1 : -1;
    const thumb = (p) => (sign > 0 ? p.c > c1 + 0.004 : p.c < c0 - 0.004);
    const aThumb = Math.max(0, ...pts.filter(thumb).map((p) => p.a));
    const k1 = Math.max(aThumb + 0.006, aMax * 0.5), k2 = k1 + (aMax - k1) * 0.45;
    const near = pts.filter((p) => Math.abs(p.a - k1) < 0.006 && !thumb(p));
    const nMid = near.reduce((s, p) => s + p.n, 0) / Math.max(1, near.length);
    const p1 = A.clone().multiplyScalar(k1).addScaledVector(C, (c0 + c1) / 2).addScaledVector(N, nMid), p2 = A.clone().multiplyScalar(k2 - k1);
    const b1 = new THREE.Bone(), b2 = new THREE.Bone();
    b1.name = `fingers_${side}`; b2.name = `fingertips_${side}`;
    b1.position.copy(p1); b2.position.copy(p2);
    hand.add(b1); b1.add(b2);
    const inv1 = new THREE.Matrix4().makeTranslation(-p1.x, -p1.y, -p1.z).multiply(sk.boneInverses[hi]);
    const inv2 = new THREE.Matrix4().makeTranslation(-p2.x, -p2.y, -p2.z).multiply(inv1);
    const i1 = sk.bones.length, i2 = i1 + 1;
    sk.bones.push(b1, b2);
    sk.boneInverses.push(inv1, inv2);
    for (const p of pts) {
      if (thumb(p)) continue;
      const s1 = smooth(k1 - 0.014, k1 + 0.008, p.a);
      if (s1 <= 0) continue;
      const s2 = smooth(k2 - 0.012, k2 + 0.008, p.a);
      const ws = [0, 1, 2, 3].map((k) => SW.getComponent(p.i, k)), is = [0, 1, 2, 3].map((k) => SI.getComponent(p.i, k));
      const h = is.indexOf(hi), wh = ws[h];
      ws[h] = wh * (1 - s1);
      const put = (bone, w) => {
        if (w <= 1e-4) return;
        let k = ws.findIndex((x, j) => j !== h && x <= 1e-5);
        if (k < 0) { k = [0, 1, 2, 3].filter((j) => j !== h && is[j] !== i1).sort((a, b) => ws[a] - ws[b])[0]; ws[h] += ws[k]; }
        is[k] = bone; ws[k] = w;
      };
      put(i1, wh * s1 * (1 - s2));
      put(i2, wh * s1 * s2);
      const sum = ws.reduce((s, x) => s + x, 0) || 1;
      for (let k = 0; k < 4; k++) { SI.setComponent(p.i, k, is[k]); SW.setComponent(p.i, k, ws[k] / sum); }
    }
    // the palm's surface (out along the normal) every 5 mm along the hand, the fingers' half thickness
    const surf = [];
    for (const p of pts) { if (thumb(p) || p.c < c0 || p.c > c1) continue; const k = Math.floor(p.a / 0.005); surf[k] = Math.max(surf[k] ?? -1, p.n); }
    const tips = pts.filter((p) => !thumb(p) && Math.abs(p.a - (k1 + k2) / 2) < 0.005);
    const half = tips.length ? (Math.max(...tips.map((p) => p.n)) - Math.min(...tips.map((p) => p.n))) / 2 : 0.009;
    // the thumb: a bone at its root by the wrist, its vertices weighted over to it past there (blended over 2.5 cm)
    const tp = pts.filter(thumb), aRoot = tp.length ? Math.min(...tp.map((p) => p.a)) : 0.02;
    let b3 = null;
    if (tp.length > 20) {
      const cRoot = sign > 0 ? c1 : c0, nRoot = tp.reduce((s, p) => s + p.n, 0) / tp.length;
      const p3 = A.clone().multiplyScalar(aRoot).addScaledVector(C, cRoot).addScaledVector(N, nRoot);
      b3 = new THREE.Bone();
      b3.name = `thumb_${side}`;
      b3.position.copy(p3);
      hand.add(b3);
      const inv3 = new THREE.Matrix4().makeTranslation(-p3.x, -p3.y, -p3.z).multiply(sk.boneInverses[hi]);
      const i3 = sk.bones.length;
      sk.bones.push(b3);
      sk.boneInverses.push(inv3);
      // (what's beyond the fingers' edge on the thumb's side, from its root on: a hair inside the edge, softly)
      for (const p of pts) {
        const out3 = sign > 0 ? p.c - c1 : c0 - p.c;
        const s3 = smooth(-0.002, 0.008, out3) * smooth(aRoot, aRoot + 0.025, p.a) * (1 - smooth(k1 - 0.01, k1 + 0.004, p.a) * smooth(0.004, -0.004, out3));
        if (s3 <= 0.01) continue;
        const ws = [0, 1, 2, 3].map((k) => SW.getComponent(p.i, k)), is = [0, 1, 2, 3].map((k) => SI.getComponent(p.i, k));
        const h = is.indexOf(hi);
        if (h < 0) continue;
        const wh = ws[h];
        ws[h] = wh * (1 - s3);
        let k = ws.findIndex((x, j) => j !== h && x <= 1e-5);
        if (k < 0) { k = [0, 1, 2, 3].filter((j) => j !== h).sort((x, y) => ws[x] - ws[y])[0]; ws[h] += ws[k]; }
        is[k] = i3; ws[k] = wh * s3;
        const sum = ws.reduce((t, x) => t + x, 0) || 1;
        for (let j = 0; j < 4; j++) { SI.setComponent(p.i, j, is[j]); SW.setComponent(p.i, j, ws[j] / sum); }
      }
    }
    out.sides[side] = { b1, b2, b3, axis: C, along: A, normal: N, across: C, k1, k2, aMax, nK: nMid, cMid: (c0 + c1) / 2, half: Math.min(0.012, half), surf, thumbSide: sign };
  }
  // A grip round a bar of radius `r` across the palm: where the bar's middle goes in the hand's frame, and the
  // fingers' two curls, so they close round it as far as they can without going into it (a search: the bar
  // a little either side of the knuckles, against the palm, and the curls that wrap it furthest)
  out.grip = (side, r) => {
    const s = out.sides[side];
    if (!s) return { point: V(0.08, 0, 0), curl: [0, 0] };
    const l1 = s.k2 - s.k1, l2 = s.aMax - s.k2, R = r + s.half;
    const surfAt = (a) => s.surf[Math.floor(a / 0.005)] ?? s.surf.filter((x) => x != null).at(-1) ?? 0.025;
    let best = null;
    for (let ab = s.k1 - 0.03; ab <= s.k1 + 0.012; ab += 0.003) {
      const nb = Math.max(surfAt(ab - 0.004), surfAt(ab), surfAt(ab + 0.004)) + r - 0.002; // (pressed 2 mm into the palm)
      for (let t1 = 0; t1 <= 1.65; t1 += 0.05) for (let t2 = 0; t2 <= 1.9; t2 += 0.05) {
        // the finger's middle line: the knuckle, the middle joint, the tip
        const x1 = s.k1, y1 = s.nK, x2 = x1 + l1 * Math.cos(t1), y2 = y1 + l1 * Math.sin(t1), x3 = x2 + l2 * Math.cos(t1 + t2), y3 = y2 + l2 * Math.sin(t1 + t2);
        let dmin = Infinity;
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          dmin = Math.min(dmin, Math.hypot(x1 + (x2 - x1) * u - ab, y1 + (y2 - y1) * u - nb), Math.hypot(x2 + (x3 - x2) * u - ab, y2 + (y3 - y2) * u - nb));
        }
        if (dmin < R - 0.0015) continue;
        // round it as far as it goes (the tip's angle about the bar, from the palm's side), and close to it
        const wrapA = Math.atan2(y3 - nb, x3 - ab), tipGap = Math.hypot(x3 - ab, y3 - nb) - R;
        const score = (Math.PI - Math.abs(wrap(wrapA - Math.PI * 0.75))) - tipGap * 18;
        if (!best || score > best.score) best = { score, ab, nb, t1, t2 };
      }
    }
    if (!best) return { point: s.along.clone().multiplyScalar(s.k1 - 0.012).addScaledVector(s.normal, 0.05), curl: [0.6, 0.6] };
    return { point: s.along.clone().multiplyScalar(best.ab).addScaledVector(s.normal, best.nb).addScaledVector(s.across, s.cMid), curl: [best.t1, best.t2], fit: best };
  };
  for (const a of [SI, SW]) { if (a.isInterleavedBufferAttribute) a.data.needsUpdate = true; else a.needsUpdate = true; }
  sk.boneMatrices = new Float32Array(sk.bones.length * 16);
  if (sk.boneTexture) { sk.boneTexture.dispose(); sk.boneTexture = null; }
  return out;
}

// ------------------------------------------------------------------------------------------- the body
// A rig driven directly: `R.q` the root's turn, `R.hips` where the hips go (the root follows), `pose` the
// body's own angles (spine, chest, neck, head; arms and legs where nothing holds them); each foot on its
// mark (`feet[s].p`, flat at `yaw`, `pitch` toes down), each hand where its grip should be (`hands[s].at`),
// turned by `frame` (along the fingers, out of the palm) with `grip` (a point in the hand's own frame) on
// the mark, the fingers curled `curl`.
class Body {
  constructor(rig, anim, root) {
    Object.assign(this, { rig, anim, root });
    this.pose = makePose();
    this.R = { q: root.quaternion.clone(), hips: null };
    this.feet = { L: { w: 0, p: V(0, 0, 0), yaw: 0, pitch: 0, pole: V(0, 0, 1) }, R: { w: 0, p: V(0, 0, 0), yaw: 0, pitch: 0, pole: V(0, 0, 1) } };
    this.hands = { L: { w: 0, at: null, frame: null, grip: V(0, 0, 0), pole: V(1, -0.5, -0.5), curl: [0, 0] }, R: { w: 0, at: null, frame: null, grip: V(0, 0, 0), pole: V(-1, -0.5, -0.5), curl: [0, 0] } };
    this.fingers = fingerBones(rig);
    this.jaw = 0;
    this.lt = {};
    for (const s of ['L', 'R']) { const pm = rig.palm(s); this.lt[s] = new THREE.Matrix4().makeBasis(V(0, 0, 0).crossVectors(pm.along, pm.normal), pm.along, pm.normal).transpose(); }
  }

  get scale() { return this.rig.root.getWorldScale(_v3).y; }

  // (run from the scene's updaters, after the frame's tweens have moved the marks: from `onFrame` it ran
  // before them, a frame behind, and a punch was drawn landing a frame late, 25 cm short of the bag)
  start(fade = 0.4, updaters = null) {
    this.anim.play(() => this.pose, fade);
    this.anim.post = (rig) => { if (rig === this.rig) this.post(); };
    const fn = (dt) => { if (dt <= 0) return; this.dt = dt; this.before?.(dt); this.place(); this.anim.update(dt); this.each?.(dt); };
    if (updaters) { updaters.push(fn); this.off = () => { const i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1); }; } else this.off = onFrame(fn);
  }

  stop() {
    this.off?.();
    this.off = null;
    if (this.anim.post) this.anim.post = null;
    this.fingers.set('L', 0, 0, 0);
    this.fingers.set('R', 0, 0, 0);
  }

  // where the hips bone is in the world now (the root's frame applied to the pose's hips)
  hipsNow(out = V(0, 0, 0)) { return this.rig.bonePosition('hips', out); }

  place() {
    const o = this.root, R = this.R;
    if (R.q) o.quaternion.copy(R.q);
    if (R.hips) {
      _v.copy(this.rig.restPos.hips).add(_v2.set(this.pose.hx, this.pose.hy, this.pose.hz)).multiplyScalar(this.scale).applyQuaternion(o.quaternion);
      o.position.copy(R.hips).sub(_v);
    }
    o.updateMatrixWorld(true);
  }

  // the feet and hands on their marks, after the pose and the look
  post() {
    const b = this.rig.bones;
    this.rig.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const f = this.feet[s];
      if (f.w < 1e-3) continue;
      solveTwoBone(b[`thigh_${s}`], b[`shin_${s}`], b[`foot_${s}`], f.p, f.pole, f.w);
      _q.setFromEuler(_e.set(f.pitch, f.yaw, f.roll ?? 0, 'YXZ'));
      b[`shin_${s}`].getWorldQuaternion(_q2);
      b[`foot_${s}`].quaternion.slerp(_q2.invert().multiply(_q), f.w);
      b[`foot_${s}`].updateMatrixWorld(true);
    }
    for (const s of ['L', 'R']) {
      const h = this.hands[s], hand = b[`hand_${s}`];
      // a new mark: the hand goes there from where it was (its wrist and its turn), over `blend` seconds
      if (h.at !== h._at) { h._at = h.at; if (h.lastW) { h.fromW = h.lastW.clone(); h.fromQ = h.lastQ.clone(); h.k = 0; } }
      if (h.w > 1e-3 && h.at) {
        const at = typeof h.at === 'function' ? h.at() : h.at, pole = typeof h.pole === 'function' ? h.pole() : h.pole;
        const wrist = V(0, 0, 0);
        let q = null;
        for (let it = 0; it < 2; it++) {
          q = this.handQ(s, h);
          wrist.copy(h.grip).applyQuaternion(q).negate().add(at);
          if (h.fromW && h.k < 1) { const e = ease.inOut(h.k); wrist.lerpVectors(h.fromW, _v.copy(wrist), e); q.slerpQuaternions(h.fromQ, _q.copy(q), e); }
          solveTwoBone(b[`upperArm_${s}`], b[`foreArm_${s}`], hand, wrist, pole, h.w);
        }
        hand.parent.getWorldQuaternion(_q2).invert();
        hand.quaternion.slerp(_q2.multiply(q), h.w);
        hand.updateMatrixWorld(true);
      }
      (h.lastW ??= V(0, 0, 0)).copy(hand.getWorldPosition(_v));
      (h.lastQ ??= new THREE.Quaternion()).copy(hand.getWorldQuaternion(_q));
      if (h.k < 1) h.k = Math.min(1, h.k + (this.dt ?? 1 / 30) / (h.blend ?? 0.45));
      this.fingers.set(s, h.curl[0], h.curl[1], h.curl[2] ?? 0, h.shrink ?? 1);
    }
    if (this.rig.u?.uJaw) this.rig.u.uJaw.value = this.jaw;
  }

  // the hand's turn in the world from its frame: [along the fingers, out of the palm] (world directions)
  handQ(s, h) { const [A0, N] = h.frame(this, s); return this.quatFor(s, A0, N); }
  quatFor(s, A0, N) {
    const A = A0.clone().addScaledVector(N, -A0.dot(N)).normalize(); // (square to the palm)
    const C = _v3.crossVectors(A, N).normalize();
    _m.makeBasis(C, A, N).multiply(this.lt[s]);
    return new THREE.Quaternion().setFromRotationMatrix(_m);
  }

  // the forearm's direction now (elbow to wrist)
  forearm(s, out = V(0, 0, 0)) { this.rig.bonePosition(`foreArm_${s}`, _fa); return this.rig.bonePosition(`hand_${s}`, out).sub(_fa).normalize(); }
}

// ------------------------------------------------------------------------------------------- sounds
// (made of the synth's noise and tones, as the rest of the game's are)
const SOUND = {
  // a glove into a leather bag: a deep thump and a slap
  thud(audio, k = 1) {
    audio.tone({ freq: 92 + Math.random() * 14, to: 46, attack: 0.002, peak: 0.42 * k, dur: 0.22, wet: 0.12 });
    audio.burst({ buffer: audio.brownBuf, from: 900, to: 140, attack: 0.002, peak: 0.55 * k, dur: 0.2, wet: 0.15 });
    audio.burst({ type: 'bandpass', from: 1700, to: 800, q: 1.1, attack: 0.001, peak: 0.16 * k, dur: 0.07, wet: 0.1 });
  },
  // the bag's chain shaken
  chain(audio, k = 1) { for (let i = 0; i < 4; i++) audio.burst({ type: 'bandpass', from: 4200 + Math.random() * 2400, q: 6, attack: 0.001, peak: 0.05 * k, dur: 0.05, wet: 0.2, delay: 0.05 + i * 0.05 + Math.random() * 0.03 }); },
  // the bar set down in the hooks: steel on steel, the plates shifting
  clank(audio, k = 1) {
    audio.tone({ type: 'triangle', freq: 540, to: 470, attack: 0.001, peak: 0.08 * k, dur: 0.5, wet: 0.35 });
    audio.tone({ type: 'triangle', freq: 1270, to: 1180, attack: 0.001, peak: 0.04 * k, dur: 0.3, wet: 0.35 });
    audio.burst({ type: 'bandpass', from: 2600, to: 1500, q: 2, attack: 0.001, peak: 0.25 * k, dur: 0.09, wet: 0.2 });
    audio.burst({ buffer: audio.brownBuf, from: 500, to: 120, attack: 0.002, peak: 0.3 * k, dur: 0.18, wet: 0.15 });
    audio.tone({ type: 'triangle', freq: 390, to: 360, attack: 0.002, peak: 0.04 * k, dur: 0.3, wet: 0.3, delay: 0.07 });
  },
  // a breath out through the teeth (the press), or in
  breath(audio, out = true, k = 1) { audio.burst({ type: 'bandpass', from: out ? 900 : 1300, to: out ? 420 : 1700, q: 0.7, attack: out ? 0.04 : 0.15, peak: (out ? 0.06 : 0.035) * k, dur: out ? 0.5 : 0.6, wet: 0.08 }); },
  // the rope on the floor
  slap(audio, k = 1) { audio.burst({ type: 'highpass', from: 2600, to: 1800, attack: 0.001, peak: 0.12 * k, dur: 0.035, wet: 0.08 }); audio.tone({ freq: 160, to: 120, attack: 0.001, peak: 0.05 * k, dur: 0.05, wet: 0.05 }); },
  // a foot landing on the concrete
  pat(audio, k = 1) { audio.burst({ from: 700 + Math.random() * 200, peak: 0.09 * k, dur: 0.06, wet: 0.04 }); },
};

// ------------------------------------------------------------------------------------------- the gym
// (`cue`, when a test sets it, hears the moments worth a close-up: 'gripped', `bottom${i}`, `hit_${punch}`, ...)
export class Gym {
  constructor(story) {
    this.s = story;
    this.cue = null;
  }

  get f() { return this.s.ferrisScene ?? this.s.current; }
  get G() { return this.f?.block?.ctx?.gym; }
  get origin() { return this.f.block.group.position; }
  // a point in the gym's own frame (the room's: its front along +x, the room toward -z) in the world
  room(x, y, z) { return V(x, y, z).applyMatrix4(this.G.M).add(this.origin); }
  roomDir(x, z) { return V(x, 0, z).transformDirection(this.G.M); }
  trainer() { return this.s.cityLife?.people.find((p) => p.tag === 'shop:gym') ?? null; }

  // E or a click: the rest of it in the fade
  async w(t) { await Promise.race([wait(t), waitFor(() => this.skip)]); if (this.skip) throw SKIP; }
  async tw(t, fn, easing = ease.inOut) { await Promise.race([tween(t, (k) => { if (!this.skip) fn(k); }, easing), waitFor(() => this.skip)]); if (this.skip) throw SKIP; }
  async walk(to, speed) {
    const p = this.s.player;
    await Promise.race([p.walkTo(to, speed ?? p.walkSpeed), waitFor(() => this.skip)]);
    if (this.skip) throw SKIP;
  }
  say(key) { this.s.bark(key)?.catch?.(console.warn); }
  trainerSay(key) {
    const cl = this.s.cityLife, t = this.trainer();
    if (cl && t?.active) cl.say(t, key).catch(console.warn); else this.s.bark(key)?.catch?.(console.warn);
  }

  async run(sp, kind) {
    const S = this.s, { ui, player, powers, dayCycle: dc } = S;
    if (!this.G) return;
    const go = { bench: () => this.bench(), bag: () => this.bag(), rope: () => this.rope() }[kind];
    if (!go || (kind === 'bench' && !this.G.bench)) return;
    // (the bags still on their chains: a construct can tear one down, and it lies where it fell)
    if (kind === 'bag' && !this.G.bags.some((b) => b.joint)) { S.life?.pay(2, 'a refund'); this.trainerSay('gymBagTorn'); return; }
    S.takeControl();
    powers.holster?.();
    ui.objective('Working out · E to finish');
    // (the foot IK's floor: the gym's, 15 cm up from the street the city's gives it; on the street's it walked
    // him over with his knees bent)
    const ground = player.ground, floor = this.room(0, 0.15, 0).y;
    player.ground = () => floor;
    this.skip = false;
    this.cleanup = [];
    const watch = onFrame(() => { if (S.input.hit('KeyE', 'Click')) { S.input.consume('KeyE', 'Click'); this.skip = true; } });
    let skipped = false;
    try { await go(); } catch (e) { if (e !== SKIP) console.warn('gym', e); skipped = true; }
    watch();
    // the rest of the hour
    await ui.fade(1, skipped ? 0.45 : 0.7);
    for (const fn of this.cleanup.reverse()) { try { fn(); } catch (e) { console.warn('gym cleanup', e); } }
    this.cleanup = [];
    this.body?.stop();
    this.body = null;
    S.mouths?.delete(player.rig);
    if (player.rig?.u?.uJaw) player.rig.u.uJaw.value = 0;
    player.lookAt(null);
    player.animator.reach('L', null);
    player.animator.reach('R', null);
    S.playerActive = true;
    player.autoAnim = true;
    player.ground = ground;
    player.animator.play(player.loco, 0);
    player.place(this.after.at, this.after.yaw);
    dc?.setHour(dc.hour + 1);
    if (dc) dc.apply(S.engine.camera);
    powers.health = powers.maxHealth;
    await wait(0.5);
    await ui.fade(0, 0.7);
    S.giveControl(S.roamObjective());
    S.bark({ bench: 'halBenchDone', bag: 'halBagDone', rope: 'halRopeDone' }[kind] ?? 'halWorkout');
  }

  // take Hal out of the player's update and drive him (`Body`), from the pose he's in
  drive() {
    const S = this.s, p = S.player;
    S.playerActive = false;
    p.autoAnim = false;
    p.speed = 0;
    const B = (this.body = new Body(p.rig, p.animator, p.object));
    p.animator.feet.ground = null;
    p.animator.lean.pitch = p.animator.lean.roll = 0;
    p.animator.twist = 0;
    // each foot held where it is, at its heading and pitch
    p.rig.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const f = B.feet[s], d = V(0, 0, 1).applyQuaternion(p.rig.bones[`foot_${s}`].getWorldQuaternion(_q));
      p.rig.bonePosition(`foot_${s}`, f.p);
      f.yaw = Math.atan2(d.x, d.z);
      f.pitch = 0;
      f.pole = V(Math.sin(f.yaw), 0.3, Math.cos(f.yaw));
      f.w = 1;
    }
    // (the root stays where it is: the hips go to the pose's)
    B.R.hips = p.object.localToWorld(p.rig.restPos.hips.clone());
    // his jaw is the workout's (the story closes it for anyone not talking: not while it's open on a breath)
    B.before = () => { if (S.voice?.who !== 'hal') S.mouths?.delete(p.rig); };
    B.start(0.35, this.f?.updaters);
    return B;
  }

  // ===================================================================================== the bench press
  async bench() {
    const S = this.s, { player, director, audio } = S, G = this.G, bench = G.bench.o, bar = G.bench.bar, rig = player.rig;
    bench.updateMatrixWorld(true);
    const L = (x, y, z) => bench.localToWorld(V(x, y, z));
    const BQ = bench.getWorldQuaternion(new THREE.Quaternion()), yaw = Math.atan2(...(() => { const d = V(0, 0, 1).applyQuaternion(BQ); return [d.x, d.z]; })());
    const dirB = (x, y, z) => V(x, y, z).applyQuaternion(BQ);
    const LIE = BQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, -Math.PI / 2));
    const PAD = 0.496, BACK = 0.163; // (the pad's top; the scan's shoulder blades behind its spine, measured)
    // the bar: where it is in the bench's frame, set in the world (`barAt`); its rest in the hooks
    const REST = V(0, 0.935, -0.39), barL = REST.clone(), roll = { a: 0 };
    const barAt = () => {
      const w = L(barL.x, barL.y, barL.z);
      bar.position.copy(bar.parent.worldToLocal(w));
      bar.quaternion.copy(G.bench.restQ).multiply(_q.setFromAxisAngle(V(0, 0, 1), roll.a));
    };
    this.cleanup.push(() => { barL.copy(REST); roll.a = 0; barAt(); });
    this.after = { at: L(0.85, 0, 1.0), yaw: yaw + Math.PI * 0.5 };
    // the trainer over to spot, behind the uprights
    this.trainerTo([this.room(0.8, 0.15, -9.15), this.room(0.8, 0.15, -7.55), this.room(1.6, 0.15, -6.5), this.room(2.0, 0.15, -4.36)], yaw, 'bench');
    // up to the bench's foot, facing it, and round, his back to it
    director.cut(L(2.6, 1.55, 2.7), L(0, 0.7, 0.5), 48);
    const brisk = player.walkSpeed * 1.15;
    if (player.position.distanceTo(L(0, 0, 1.28)) > 1.2) await this.walk(L(1.1, 0, 1.55), brisk); // (round the bar's end, not into it)
    await this.walk(L(0, 0, 1.28), brisk);
    player.turnTo(yaw, 4);
    director.move(L(2.45, 1.05, 0.55), L(0, 0.72, 0.25), 3.5, ease.inOut, 44);
    await this.w(0.75);
    // ------------------------------------------------ down onto the pad's end, and back under the bar
    const B = this.drive(), P = B.pose;
    const qA = B.R.q.clone();
    this.tw(0.4, (k) => B.R.q.slerpQuaternions(qA, BQ, k)).catch(() => {});
    const flat = (s, x, z, out = 0.22) => { const f = B.feet[s]; f.target = L(x, 0.092, z); f.yaw = yaw + (x > 0 ? out : -out); f.pole = dirB(x > 0 ? 0.25 : -0.25, 0.6, 1); };
    // a foot from where it is to its mark, lifted on the way (an arc), turning to its heading
    const stepFoot = async (s, x, z, dur = 0.42, out = 0.22) => {
      const f = B.feet[s], from = f.p.clone(), y0 = f.yaw;
      flat(s, x, z, out);
      const to = f.target.clone(), y1 = f.yaw;
      await this.tw(dur, (k) => { f.p.lerpVectors(from, to, k); f.p.y += Math.sin(Math.PI * k) * 0.07; f.yaw = y0 + wrap(y1 - y0) * k; }, ease.inOut);
    };
    const hips0 = B.R.hips.clone(), hy0 = bench.worldToLocal(hips0.clone()).y; // (standing: the hips' height off the floor)
    const stand = makePose({ sx: 0.04, nx: 0.06 });
    copyPose(P, stand);
    // feet out to either side of the pad's end, a step back each, the hips going with them
    const step1 = this.tw(0.9, (k) => B.R.hips.lerpVectors(hips0, L(0, hy0 - 0.02, 1.05), k));
    await stepFoot('L', 0.3, 0.86);
    await stepFoot('R', -0.3, 0.86);
    await step1;
    // sat down on the pad's end (leaning into it, then upright)
    const SIT = makePose({ sx: 0.1, cx: 0.04, nx: 0.08, aL: [0.25, -0.85, 0.45], eL: 0.5, aR: [-0.25, -0.85, 0.45], eR: 0.5 });
    const lean = makePose({ ...SIT, sx: 0.42, cx: 0.1, nx: 0.12 });
    const h1 = B.R.hips.clone(), hSit = L(0, PAD + 0.13, 0.5);
    const s0 = makePose(); copyPose(s0, P);
    // (the hands come to rest on his thighs as he sits: flat, a hand's length back from the knee)
    const palmOn = (s) => { const pm = rig.palm(s); return pm.centre.clone().addScaledVector(pm.normal, pm.surface); };
    const onThigh = (s) => {
      const h = B.hands[s], k = V(0, 0, 0), hp = V(0, 0, 0), d = V(0, 0, 0);
      h.at = () => { rig.bonePosition(`shin_${s}`, k); rig.bonePosition(`thigh_${s}`, hp); d.subVectors(k, hp).normalize(); return k.clone().addScaledVector(d, -0.13).add(V(0, 0.075, 0)); };
      h.grip.copy(palmOn(s));
      h.frame = () => [d.clone().lengthSq() ? d.clone() : dirB(0, 0, 1), V(0, -1, 0)];
      h.pole = dirB(s === 'L' ? 1 : -1, -0.4, -0.6);
    };
    onThigh('L'); onThigh('R');
    await this.tw(1.0, (k) => {
      B.R.hips.lerpVectors(h1, hSit, k);
      B.R.hips.y = h1.y + (hSit.y - h1.y) * ease.inOut(Math.min(1, k * 1.15));
      if (k < 0.5) blendInto(P, s0, lean, k * 2); else blendInto(P, lean, SIT, (k - 0.5) * 2);
      B.hands.L.w = B.hands.R.w = smooth(0.45, 1, k);
    }, ease.linear);
    audio.step?.('wood');
    this.cue?.('sat');
    await this.w(0.25);
    // hands back to the pad's edges, and lain back down it, the hips sliding a little up the pad, the
    // chin tucked till the head's down; the eyes come to rest under the bar
    const hips2 = L(0, PAD + BACK - 0.008 - 0.004, 0.45);
    // (a hand flat on the pad's edge: the palm's middle on it, the fingers toward his head)
    const support = (s) => { const h = B.hands[s], x = s === 'L' ? 0.19 : -0.19; h.at = L(x, PAD + 0.004, 0.26); h.grip.copy(palmOn(s)); h.pole = dirB(x > 0 ? 0.6 : -0.6, 0.2, -1); h.frame = () => [dirB(x > 0 ? 0.2 : -0.2, 0, -1).normalize(), dirB(0, -1, 0)]; };
    support('L'); support('R');
    const LYING = makePose({ sx: 0, cx: 0, nx: -0.16, kx: -0.08, aL: [0.35, -0.9, -0.15], eL: 0.35, aR: [-0.35, -0.9, -0.15], eR: 0.35 });
    const tuck = makePose({ ...LYING, sx: 0.12, nx: 0.32, kx: 0.12 });
    const q0 = B.R.q.clone(), s1 = makePose(); copyPose(s1, P);
    flat('L', 0.3, 0.78); flat('R', -0.3, 0.78);
    const fL0 = B.feet.L.p.clone(), fR0 = B.feet.R.p.clone(), fL1 = B.feet.L.target.clone(), fR1 = B.feet.R.target.clone();
    await this.w(0.35);
    await this.tw(1.5, (k) => {
      const e = ease.inOut(k);
      B.R.q.slerpQuaternions(q0, LIE, e);
      B.R.hips.lerpVectors(hSit, hips2, e);
      B.feet.L.p.lerpVectors(fL0, fL1, e); B.feet.R.p.lerpVectors(fR0, fR1, e);
      if (k < 0.7) blendInto(P, s1, tuck, k / 0.7); else blendInto(P, tuck, LYING, (k - 0.7) / 0.3);
      B.hands.L.w = B.hands.R.w = 1 - smooth(0.55, 1, k);
    }, ease.linear);
    // (the setup and the first reps from high off his feet's side: the near plate clear of his hands and face)
    director.move(L(1.45, 1.55, 1.3), L(0, 0.84, -0.12), 3.0, ease.inOut, 38);
    player.lookAt(L(0, 0.935, -0.39), 0.5);
    audio.step?.('wood');
    await this.w(0.3);
    // ------------------------------------------------ the hands up onto the bar
    // (the grip: the bar across the palm at the fingers' roots, the wrist a little back, the fingers round it)
    const grip = (s) => {
      const h = B.hands[s], x = s === 'L' ? 0.42 : -0.42, g = B.fingers.grip(s, 0.022);
      h.at = () => L(barL.x + x, barL.y, barL.z);
      h.grip.copy(g.point);
      h.closed = g.curl;
      h.pole = () => dirB(x > 0 ? 1 : -1, -0.35, 0.55);
      // along: the forearm, the hand tipped back 14 degrees toward his head; out of the palm toward his feet
      h.frame = (b, side) => gripFrame(b.forearm(side, V(0, 0, 0)));
    };
    const ax = dirB(1, 0, 0);
    const gripFrame = (F) => {
      const A = F.clone().applyAxisAngle(ax, -0.24);
      const N = dirB(0, 0, 1).addScaledVector(A, -dirB(0, 0, 1).dot(A)).normalize();
      return [A, N];
    };
    grip('L'); grip('R');
    const curl = { k: 0 };
    const setCurl = () => { for (const s of ['L', 'R']) { const c = B.hands[s].closed ?? [1, 1.2]; B.hands[s].curl = [c[0] * curl.k, c[1] * curl.k, 0.55 * curl.k]; } };
    B.each = () => { barAt(); setCurl(); };
    await this.tw(0.9, (k) => { B.hands.L.w = B.hands.R.w = k; }, ease.inOut);
    await this.tw(0.35, (k) => { curl.k = k; });
    this.cue?.('gripped');
    SOUND.breath(audio, false);
    await this.w(0.4);
    // ------------------------------------------------ out of the hooks, over his shoulders
    // (locked out: the bar over his shoulders as high as his arms reach, just short of straight; at the
    // bottom it touches his chest at the nipples' line)
    const reach = (s) => rig.restPos[`upperArm_${s}`].distanceTo(rig.restPos[`foreArm_${s}`]) + rig.restPos[`foreArm_${s}`].distanceTo(rig.restPos[`hand_${s}`]);
    const lockY = (z) => {
      let top = 1.3;
      for (const s of ['L', 'R']) {
        const h = B.hands[s], sh = rig.bonePosition(`upperArm_${s}`, V(0, 0, 0)), x = s === 'L' ? 0.42 : -0.42, max = 0.972 * reach(s);
        let lo = 0.85, hi = 1.4;
        for (let i = 0; i < 22; i++) {
          const m = (lo + hi) / 2, bw = L(x, m, z), q = B.quatFor(s, ...gripFrame(bw.clone().sub(sh).normalize()));
          if (h.grip.clone().applyQuaternion(q).negate().add(bw).distanceTo(sh) > max) hi = m; else lo = m;
        }
        top = Math.min(top, lo);
      }
      return top;
    };
    const shZ = bench.worldToLocal(rig.bonePosition('upperArm_L', V(0, 0, 0))).z, zTop = shZ + 0.03;
    const TOP = V(0, lockY(zTop), zTop), BOT = V(0, 0.818, 0.035);
    const lift = REST.clone().add(V(0, 0.07, 0));
    await this.tw(0.45, (k) => barL.lerpVectors(REST, lift, k), ease.inOut);
    await this.tw(0.8, (k) => { barL.lerpVectors(lift, TOP, k); barL.y = lift.y + (TOP.y - lift.y) * ease.out(k); }, ease.inOut);
    player.lookAt(() => L(0, 1.6, -0.2), 0.35);
    // ------------------------------------------------ the reps: down to the chest, and up, harder each time
    const path = (u, out) => { out.lerpVectors(TOP, BOT, u); out.z = TOP.z + (BOT.z - TOP.z) * Math.pow(u, 0.7); return out; };
    const REPS = [{ down: 0.95, up: 0.65 }, { down: 0.95, up: 0.7 }, { down: 1.0, up: 0.85 }, { down: 1.05, up: 1.15, strain: 0.3 }, { down: 1.1, up: 1.7, strain: 0.6 }, { down: 1.15, up: 2.7, strain: 1 }];
    const shake = { k: 0 };
    let tt = 0;
    const prevEach = B.each;
    B.each = (dt) => {
      tt += dt;
      if (shake.k > 0) { barL.y += Math.sin(tt * 37) * 0.0022 * shake.k; roll.a = Math.sin(tt * 2.3) * 0.025 * shake.k; } else roll.a *= 0.9;
      prevEach(dt);
    };
    for (const [i, r] of REPS.entries()) {
      if (i === 3) this.trainerSay('gymDrive');
      if (i === 4) this.spot(true, () => L(barL.x, barL.y, barL.z));
      if (i === 5) this.trainerSay('gymAllYou');
      if (i === 2) director.move(L(1.2, 1.38, 1.05), L(0, 0.88, -0.14), 5, ease.inOut, 36);
      // the hard ones low from beside his knees, up past the bar to his face (the plate behind the shot)
      if (i === 3) director.cut(L(0.42, 1.22, 1.0), L(-0.03, 0.9, -0.28), 34);
      if (i === 4) director.move(L(0.34, 1.12, 0.82), L(-0.03, 0.9, -0.3), 7, ease.inOut, 30);
      SOUND.breath(audio, false, 0.8);
      await this.tw(r.down, (k) => path(k, barL), ease.inOut);
      this.cue?.(`bottom${i}`);
      await this.w(0.12);
      SOUND.breath(audio, true, 0.7 + (r.strain ?? 0) * 0.6);
      shake.k = r.strain ?? 0;
      // the press: fast off the chest, slowing through the sticking point when it's hard
      const stick = r.strain ?? 0;
      await this.tw(r.up, (k) => {
        const u = k + stick * 0.85 * Math.sin(2 * Math.PI * k) / (2 * Math.PI);
        path(1 - ease.inOut(clamp(u)), barL);
        P.nx = LYING.nx - 0.12 * stick * Math.sin(Math.PI * k);
        B.jaw = (0.12 + 0.3 * stick) * Math.sin(Math.PI * Math.min(1, k * 1.3));
      }, ease.linear);
      this.cue?.(`top${i}`);
      B.jaw = 0;
      shake.k = 0;
      P.nx = LYING.nx;
      await this.w(i >= 3 ? 0.45 : 0.2);
    }
    // ------------------------------------------------ racked: back over the hooks, down into them
    this.spot(false);
    const over = REST.clone().add(V(0, 0.06, 0));
    await this.tw(0.85, (k) => barL.lerpVectors(TOP, over, k), ease.inOut);
    await this.tw(0.3, (k) => barL.lerpVectors(over, REST, k), ease.in);
    SOUND.clank(audio);
    this.cue?.('racked');
    S.director.shake?.(0.03, 0.2);
    await this.w(0.3);
    await this.tw(0.3, (k) => { curl.k = 1 - k; });
    // the hands down onto his chest, a breath, and up
    const rest = (s) => { const h = B.hands[s], x = s === 'L' ? 0.11 : -0.11; h.at = L(x, PAD + BACK + 0.15, 0.26); h.grip.copy(palmOn(s)); h.frame = () => [dirB(x > 0 ? -0.5 : 0.5, 0, 1).normalize(), dirB(0, -1, 0)]; h.pole = dirB(x > 0 ? 1 : -1, -0.6, 0.1); };
    rest('L'); rest('R');
    SOUND.breath(audio, true, 1.3);
    B.jaw = 0.25;
    this.trainerSay('gymRacked');
    player.lookAt(null);
    director.cut(L(2.45, 1.08, 0.55), L(0, 0.74, 0.22), 44);
    await this.tw(0.8, (k) => { B.jaw = 0.25 * (1 - k); });
    await this.w(0.3);
    // sitting up: a hand to the pad's edge each side, rolled up over the hips
    support('L'); support('R');
    const s2 = makePose(); copyPose(s2, P);
    await this.tw(1.4, (k) => {
      const e = ease.inOut(k);
      B.R.q.slerpQuaternions(LIE, BQ, e);
      B.R.hips.lerpVectors(hips2, hSit, e);
      if (k < 0.45) blendInto(P, s2, tuck, k / 0.45); else blendInto(P, tuck, SIT, (k - 0.45) / 0.55);
      B.hands.L.w = B.hands.R.w = k < 0.6 ? 1 : 1 - smooth(0.6, 1, k);
    }, ease.linear);
    // up off the bench, and a step forward out from over it
    const s3 = makePose(); copyPose(s3, P);
    const hUp = L(0, hy0 - 0.02, 1.0);
    await this.tw(1.0, (k) => {
      B.R.hips.lerpVectors(hSit, hUp, ease.inOut(k));
      B.R.hips.y = hSit.y + (hUp.y - hSit.y) * ease.inOut(smooth(0.2, 1, k));
      if (k < 0.5) blendInto(P, s3, lean, k * 2); else blendInto(P, lean, stand, (k - 0.5) * 2);
    }, ease.linear);
    const h3 = B.R.hips.clone();
    const step2 = this.tw(0.8, (k) => B.R.hips.lerpVectors(h3, L(0, hy0, 1.3), k));
    await stepFoot('L', 0.1, 1.32);
    await stepFoot('R', -0.1, 1.32);
    await step2;
    this.after = { at: L(0, 0, 1.3), yaw };
    await this.w(0.25);
  }

  // ===================================================================================== the trainer
  // over from his counter (round its end, past the dumbbells) to where he's needed, and back after
  async trainerTo(route, faceYaw, why) {
    const cl = this.s.cityLife, t = this.trainer();
    if (!cl || !t?.active || t.talking) return;
    t.actor = true;
    this.cleanup.push(() => this.trainerBack(route, t));
    try {
      await cl.go(t, [t.pos.clone(), ...route], { speed: 1.05, face: faceYaw });
      if (why === 'bench') t.anim.play(t.loco, 0.3);
    } catch (e) { console.warn('trainer', e); }
  }

  trainerBack(route, t) {
    const cl = this.s.cityLife;
    if (!cl || !t) return;
    t.anim.reach('L', null); t.anim.reach('R', null);
    cl.look(t, null);
    // (he's back at his post when the fade lifts: the hour's gone by)
    t.route = null; t.routeDone = null;
    t.pos.copy(t.home);
    cl.settle(t);
    t.actor = false;
  }

  // the spotter's hands under the bar on the last reps (where they can reach it)
  spot(on, bar) {
    const t = this.trainer();
    if (!t?.active) return;
    if (!on) { t.anim.reach('L', null); t.anim.reach('R', null); t.anim.play(t.loco, 0.5); return; }
    const hold = makePose({ sx: 0.38, cx: 0.12, nx: 0.25, kx: 0.1, lLx: -0.12, kL: 0.2, lRx: -0.1, kR: 0.22 });
    t.anim.play(() => hold, 0.6);
    this.s.cityLife.look(t, bar, 0.9);
    const yaw = t.rig.root.rotation.y, fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), side = V(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const [s, k] of [['L', 1], ['R', -1]]) {
      const at = V(0, 0, 0), sh = V(0, 0, 0), ready = V(0, 0, 0);
      t.anim.reach(s, () => {
        at.copy(bar()).addScaledVector(side, 0.14 * k).y -= 0.05;
        // under the bar while it's in his reach; out of it, the hands ready in front of him, palms up
        t.rig.bonePosition(`upperArm_${s}`, sh);
        ready.copy(sh).addScaledVector(fwd, 0.3).addScaledVector(side, -0.08 * k).y -= 0.32;
        const d = at.distanceTo(sh), max = 0.5 * t.rig.root.scale.y;
        return at.lerpVectors(ready, at, smooth(max + 0.06, max - 0.02, d));
      }, { weight: 1, rate: 4, pole: V(0.6 * k, -1, -0.3) });
    }
  }

  // ===================================================================================== the heavy bag
  // Gloved up (the pair from the trainer's box: on his hands at a cut), squared up to the bag in an orthodox
  // stance: jabs, crosses, hooks and an uppercut in combinations, each one aimed where the bag is that moment
  // (it swings and turns), each landing a push on its body at the glove (`hit`), and a thud; between them his
  // feet take him round it a step at a time, and he waits for it to come back to him.
  async bag() {
    const S = this.s, { player, director, audio } = S, rig = player.rig, G = this.G, bag = G.bags.find((b) => b.joint), body = bag?.body;
    if (!body) throw SKIP;
    const BAGR = bag.radius;
    // the bag's rest: under its pivot; Hal on the room's back side of it, facing the window
    const rest = V(bag.pivot.x, 0, bag.pivot.z), floor = this.room(0, 0.15, 0).y;
    const toWin = this.roomDir(0, 1).normalize(), side = V(0, 0, 0).crossVectors(UP, toWin).normalize(); // (room +z, and +x)
    let theta = 0, D = 1.05;
    const stanceAt = (th, d = D) => { const f = toWin.clone().applyAxisAngle(UP, th); return { f, c: rest.clone().addScaledVector(f, -d).setY(floor) }; };
    this.after = { at: stanceAt(0, 1.3).c, yaw: Math.atan2(toWin.x, toWin.z) };
    // ---- the bag calmer while he works it (it swings on long after a set, in free roam)
    const damp0 = body.linearDamping(), adamp0 = body.angularDamping();
    body.setLinearDamping(0.32);
    body.setAngularDamping(2.2);
    this.cleanup.push(() => { body.setLinearDamping(damp0); body.setAngularDamping(adamp0); });
    // ---- to it, and the gloves on
    const trainer = this.trainer();
    const watchAt = this.room(9.5, 0.15, -4.3), look = rest.clone().sub(watchAt);
    this.trainerTo([this.room(0.8, 0.15, -9.15), this.room(0.8, 0.15, -7.55), this.room(3.2, 0.15, -6.4), watchAt], Math.atan2(look.x, look.z), 'bag');
    const st0 = stanceAt(0);
    director.cut(st0.c.clone().addScaledVector(side, 2.2).addScaledVector(toWin, -1.9).setY(floor + 1.75), rest.clone().setY(floor + 1.1), 46);
    await this.walk(st0.c.clone().addScaledVector(toWin, -0.35), player.walkSpeed * 1.1);
    player.turnTo(Math.atan2(toWin.x, toWin.z), 5);
    await this.w(0.5);
    // the gloves: on at a cut (the pair from the trainer's box)
    await S.ui.fade(1, 0.25);
    const gloves = this.wearGloves(rig);
    // (the ring's inside the right glove: its light showed through the cuff)
    const ring = S.ring?.parent === rig.bones.hand_R ? S.ring : null, ringWas = ring?.visible;
    if (ring) ring.visible = false;
    this.cleanup.push(() => { gloves.remove(); if (ring) ring.visible = ringWas; });
    await this.w(0.1);
    // ---- squared up
    const B = this.drive(), P = B.pose;
    const GUARD = makePose({ sx: 0.14, cx: 0.06, cy: 0.32, nx: 0.16, ny: -0.12, kx: 0.06 });
    copyPose(P, GUARD);
    const yawOf = (f) => Math.atan2(f.x, f.z);
    const ST = { th: 0, bob: 0, t: 0, turn: 0, shift: V(0, 0, 0), dip: 0, lean: 0 };
    // the stance's marks for an angle round the bag: the feet, the hips, the root's turn (bladed: the lead
    // shoulder to the bag)
    const marks = (th, d = D) => {
      const { f, c } = stanceAt(th, d), r = V(0, 0, 0).crossVectors(f, UP).normalize(), yaw = yawOf(f);
      return {
        f, r, c, yaw, rootYaw: yaw - 0.55,
        L: c.clone().addScaledVector(f, 0.19).addScaledVector(r, -0.1), R: c.clone().addScaledVector(f, -0.2).addScaledVector(r, 0.17),
        yL: yaw - 0.25, yR: yaw - 1.0,
      };
    };
    let M = marks(0);
    const feet = (m) => { for (const s of ['L', 'R']) { const f = B.feet[s]; f.p.copy(m[s]).setY(floor + 0.092); f.yaw = m[`y${s}`]; f.pitch = s === 'R' ? 0.18 : 0; f.pole = V(Math.sin(m[`y${s}`]), 0.4, Math.cos(m[`y${s}`])); } };
    const hipsAt = (m) => m.c.clone().addScaledVector(m.f, -0.01 + ST.shift.dot(m.f)).addScaledVector(m.r, 0.03 + ST.shift.dot(m.r)).setY(floor + rig.hipsHeight - 0.07 - ST.dip + ST.bob);
    // into the stance from where he stands (a step each foot)
    const from = { L: B.feet.L.p.clone(), R: B.feet.R.p.clone(), yL: B.feet.L.yaw, yR: B.feet.R.yaw, h: B.R.hips.clone(), q: B.R.q.clone() };
    const qOf = (y) => new THREE.Quaternion().setFromAxisAngle(UP, y);
    await S.ui.fade(0, 0.35);
    director.cut(M.c.clone().addScaledVector(M.r, 1.9).addScaledVector(M.f, -0.6).setY(floor + 1.35), rest.clone().addScaledVector(M.f, -0.45).setY(floor + 1.25), 42);
    this.trainerSay('gymBagHands');
    await this.tw(0.55, (k) => {
      for (const s of ['L', 'R']) { const kk = smooth(s === 'L' ? 0 : 0.35, s === 'L' ? 0.65 : 1, k); B.feet[s].p.lerpVectors(from[s], M[s], kk).setY(floor + 0.092 + Math.sin(Math.PI * kk) * 0.05); B.feet[s].yaw = from[`y${s}`] + wrap(M[`y${s}`] - from[`y${s}`]) * kk; }
      B.R.hips.lerpVectors(from.h, hipsAt(M), ease.inOut(k));
      B.R.q.slerpQuaternions(from.q, qOf(M.rootYaw), ease.inOut(k));
    }, ease.linear);
    feet(M);
    // ---- the hands: the guard, and the punches from it (each hand's phase: 0 guard, 1 landed)
    const fist = (s) => B.fingers.sides[s] ? [1.45, 1.55, 0.75] : [0, 0, 0];
    const head = () => rig.bonePosition('head', V(0, 0, 0));
    const guard = (s) => {
      const hd = head(), k = s === 'L' ? 1 : -1;
      return hd.addScaledVector(M.f, s === 'L' ? 0.27 : 0.2).addScaledVector(M.r, -0.1 * k).add(V(0, s === 'L' ? -0.1 : -0.12, 0));
    };
    const guardFrame = (s) => { const k = s === 'L' ? 1 : -1, A = M.f.clone().multiplyScalar(0.45).add(V(0, 0.9, 0)).normalize(); return [A, M.r.clone().multiplyScalar(k)]; };
    // a point on the bag's surface now: `h` above the floor (up the bag from its foot, 70 cm up), `ang` round it
    // from his side (+ toward his left)
    const bagPoint = (h, ang, out = V(0, 0, 0)) => {
      bag.o.updateWorldMatrix(true, false);
      const axis = bag.o.localToWorld(V(0, h - bag.foot, 0)), sh = rig.bonePosition('chest', V(0, 0, 0));
      const d = sh.sub(axis).setY(0).normalize().applyAxisAngle(UP, -ang);
      return out.copy(axis).addScaledVector(d, BAGR);
    };
    const PUNCH = {
      jab: { s: 'L', ext: 0.11, ret: 0.17, h: 1.47, ang: 0.05, J: 7, cy: -0.22, kind: 'straight' },
      cross: { s: 'R', ext: 0.15, ret: 0.21, h: 1.44, ang: -0.05, J: 13, cy: 0.5, hry: 0.25, pivot: 'R', kind: 'straight' },
      hook: { s: 'L', ext: 0.17, ret: 0.22, h: 1.44, ang: 0.7, J: 12, cy: -0.55, hry: -0.22, pivot: 'L', kind: 'hook' },
      body: { s: 'R', ext: 0.16, ret: 0.22, h: 1.08, ang: -0.1, J: 12, cy: 0.42, hry: 0.2, dip: 0.09, pivot: 'R', kind: 'straight' },
      bodyhook: { s: 'L', ext: 0.17, ret: 0.22, h: 1.04, ang: 0.65, J: 11, cy: -0.55, hry: -0.2, dip: 0.1, pivot: 'L', kind: 'hook' },
      upper: { s: 'R', ext: 0.17, ret: 0.22, h: 1.3, ang: -0.15, J: 10, cy: 0.38, dip: 0.07, kind: 'upper' },
    };
    const GLOVE = gloves.front; // (from the wrist to the glove's face)
    const ph = { L: 0, R: 0 }, aim = { L: null, R: null }, kindOf = { L: 'straight', R: 'straight' };
    for (const s of ['L', 'R']) {
      const h = B.hands[s], k = s === 'L' ? 1 : -1;
      h.grip.set(0, 0, 0);
      h.curl = fist(s);
      h.shrink = 0.6; // (in the glove)
      // (the elbow down and in for the guard and the straight ones; up and out to his side for a hook)
      h.pole = () => (ph[s] > 0.2 && kindOf[s] === 'hook' ? V(0, 0.55, 0).addScaledVector(M.r, -0.85 * k) : V(0, -1, 0).addScaledVector(M.r, -0.5 * k).addScaledVector(M.f, -0.3));
      h.frame = () => {
        const [Ag, Ng] = guardFrame(s);
        if (!aim[s] || ph[s] <= 0) return [Ag, Ng];
        const dir = aim[s].dir, kind = kindOf[s];
        // a straight punch lands with the fist turned over (palm down), a hook and an uppercut with it upright
        const Ap = dir.clone(), Np = kind === 'straight' ? V(0, -1, 0) : M.f.clone().negate().addScaledVector(M.r, 0.3 * k).normalize();
        if (kind === 'upper') Np.copy(M.f).negate();
        const e = smooth(0.1, 0.9, ph[s]);
        return [Ag.lerp(Ap, e).normalize(), Ng.lerp(Np, e).normalize()];
      };
      h.at = () => {
        const g = guard(s);
        if (!aim[s] || ph[s] <= 0) return g;
        const T = aim[s].point().addScaledVector(aim[s].dir, -GLOVE + 0.015); // (the wrist: the glove's face 1.5 cm into the leather)
        // straight out, or round in an arc for a hook (out to the side first), or up from below for the uppercut
        const p = g.clone().lerp(T, ease.out(ph[s]));
        const arc = Math.sin(Math.PI * ph[s]);
        if (kindOf[s] === 'hook') p.addScaledVector(M.r, -0.16 * k * arc).addScaledVector(M.f, -0.05 * arc);
        if (kindOf[s] === 'upper') p.y -= 0.14 * arc;
        return p;
      };
    }
    await this.tw(0.4, (k) => { B.hands.L.w = B.hands.R.w = k; });
    player.lookAt(() => bagPoint(1.45, 0), 0.8);
    this.cue?.('guard');
    // ---- the stance's life: a bounce on the toes, the shoulders loose
    B.each = (dt) => {
      ST.t += dt;
      ST.bob = 0.012 * Math.sin(ST.t * 2 * Math.PI * 1.6);
      B.R.hips.copy(hipsAt(M));
      B.R.q.copy(qOf(M.rootYaw + ST.turn));
      P.cy = GUARD.cy + ST.lean;
      P.hry = ST.hry ?? 0;
      P.sz = 0.04 * Math.sin(ST.t * 1.3);
    };
    // ---- one punch: out to where the bag is, a push on the bag where the glove lands, and back
    const hit = async (name) => {
      const pu = PUNCH[name], s = pu.s;
      kindOf[s] = pu.kind;
      aim[s] = { point: () => bagPoint(pu.h, pu.ang) };
      aim[s].dir = aim[s].point().sub(rig.bonePosition(`upperArm_${s}`, V(0, 0, 0))).normalize();
      if (pu.kind === 'hook') aim[s].dir.copy(M.r).multiplyScalar(s === 'L' ? 1 : -1).addScaledVector(M.f, 0.55).normalize();
      if (pu.kind === 'upper') aim[s].dir.copy(M.f).multiplyScalar(0.6).add(V(0, 0.8, 0)).normalize();
      const turn0 = ST.lean, hry0 = ST.hry ?? 0, dip0 = ST.dip;
      // his weight into it as far as it takes to land (the bag a little out of reach: it's swinging, or it's low)
      // (found as it goes: whatever's still out of his reach, the hips take him toward it, never back)
      const arm = rig.restPos[`upperArm_${s}`].distanceTo(rig.restPos[`foreArm_${s}`]) + rig.restPos[`foreArm_${s}`].distanceTo(rig.restPos[`hand_${s}`]);
      let lunge = pu.s === 'R' ? 0.03 : 0.015;
      const reachShort = () => rig.bonePosition(`upperArm_${s}`, V(0, 0, 0)).distanceTo(aim[s].point().addScaledVector(aim[s].dir, -GLOVE + 0.015)) - arm * 0.965;
      const pf = pu.pivot ? B.feet[pu.pivot] : null, py0 = pf?.yaw, pp0 = pf?.pitch;
      SOUND.breath(audio, true, 0.5);
      await this.tw(pu.ext, (k) => {
        ph[s] = k;
        ST.lean = turn0 + (pu.cy - turn0) * ease.out(k);
        ST.hry = hry0 + ((pu.hry ?? 0) - hry0) * ease.out(k);
        ST.dip = dip0 + ((pu.dip ?? 0) - dip0) * ease.out(k);
        if (k > 0.35) lunge = Math.min(0.16, Math.max(lunge, lunge + reachShort() * 0.5));
        ST.shift.copy(M.f).multiplyScalar(lunge * ease.out(k));
        if (pf) { pf.yaw = py0 + (pu.pivot === 'R' ? 0.5 : -0.45) * ease.out(k); pf.pitch = (pu.pivot === 'R' ? 0.4 : 0.25) * ease.out(k); }
      }, ease.linear);
      // landed: the glove's face is on the leather; the bag takes the blow there
      const at = aim[s].point(), J = pu.J * (0.9 + Math.random() * 0.2);
      // (a hook's push partly into the bag's middle: it swings off more than it turns on its chain)
      const push = pu.kind === 'hook' ? aim[s].dir.clone().multiplyScalar(0.45).add(bag.o.getWorldPosition(V(0, 0, 0)).setY(at.y).sub(at).normalize().multiplyScalar(0.55)).normalize() : aim[s].dir;
      body.applyImpulseAtPoint({ x: push.x * J, y: push.y * J, z: push.z * J }, { x: at.x, y: at.y, z: at.z }, true);
      SOUND.thud(audio, 0.55 + J / 26);
      if (J > 9) { SOUND.chain(audio, 0.6); director.shake?.(0.012 * J / 10, 0.12); }
      this.cue?.(`hit_${name}`);
      await this.tw(pu.ret, (k) => {
        ph[s] = 1 - ease.inOut(k);
        ST.lean = pu.cy * (1 - ease.inOut(k));
        ST.hry = (pu.hry ?? 0) * (1 - ease.inOut(k));
        ST.dip = (pu.dip ?? 0) * (1 - ease.inOut(k));
        ST.shift.copy(M.f).multiplyScalar(lunge * (1 - ease.inOut(k)));
        if (pf) { pf.yaw = py0 + (pu.pivot === 'R' ? 0.5 : -0.45) * (1 - ease.inOut(k)); pf.pitch = pp0 + ((pu.pivot === 'R' ? 0.4 : 0.25) - pp0) * (1 - ease.inOut(k)); }
      }, ease.linear);
      ph[s] = 0;
      aim[s] = null;
    };
    // it swings away and back: the next combination when it's come back to him
    const ready = async () => {
      for (let i = 0; i < 40; i++) {
        const t = body.translation(), v = body.linvel(), off = (t.x - rest.x) * M.f.x + (t.z - rest.z) * M.f.z, vel = v.x * M.f.x + v.z * M.f.z;
        if (Math.abs(off) < 0.06 || (off > 0 && vel < -0.05 && off < 0.14)) return;
        await this.w(1 / 30);
      }
    };
    // a step round the bag (the lead foot first going left, the rear first going right), the hips with them
    const circle = async (dth, dd = 0) => {
      const M0 = M, M1 = marks(theta + dth, D + dd), lead = dth > 0 ? 'L' : 'R', trail = lead === 'L' ? 'R' : 'L';
      const p0 = { L: B.feet.L.p.clone(), R: B.feet.R.p.clone() };
      theta += dth; D += dd;
      const go = (s, a, b) => (k) => { const kk = smooth(a, b, k); B.feet[s].p.lerpVectors(p0[s], M1[s], kk).setY(floor + 0.092 + Math.sin(Math.PI * kk) * 0.045); B.feet[s].yaw = M0[`y${s}`] + wrap(M1[`y${s}`] - M0[`y${s}`]) * kk; };
      const gl = go(lead, 0, 0.55), gt = go(trail, 0.4, 1);
      await this.tw(0.42, (k) => {
        gl(k); gt(k);
        const e = ease.inOut(k);
        M = { ...M1, c: M0.c.clone().lerp(M1.c, e), f: M0.f.clone().lerp(M1.f, e).normalize(), r: M0.r.clone().lerp(M1.r, e).normalize(), rootYaw: M0.rootYaw + wrap(M1.rootYaw - M0.rootYaw) * e, L: B.feet.L.p, R: B.feet.R.p };
      }, ease.linear);
      M = M1;
      feet(M);
      audio.step?.('stone');
    };
    // ---- the set
    const combo = async (...names) => { await ready(); for (const n of names) { await hit(n); await this.w(0.04); } };
    const cam = (dist, h, ang, lookH = 1.2, fov = 40) => { const d = M.f.clone().applyAxisAngle(UP, ang); director.cut(rest.clone().addScaledVector(d, -dist).setY(floor + h), rest.clone().addScaledVector(M.f, -0.45).setY(floor + lookH), fov); };
    const pan = (dist, h, ang, dur, lookH = 1.2, fov = 40) => { const d = M.f.clone().applyAxisAngle(UP, ang); director.move(rest.clone().addScaledVector(d, -dist).setY(floor + h), rest.clone().addScaledVector(M.f, -0.45).setY(floor + lookH), dur, ease.inOut, fov); };
    // (at range, D 1.05, the straight punches land at full reach; for the hooks and the uppercut he steps in,
    // D 0.74, where a hook lands with the elbow bent square)
    const IN = -0.31;
    pan(2.0, 1.45, 1.15, 4.5, 1.25, 40);
    await this.w(0.5);
    await combo('jab', 'jab');
    await this.w(0.35);
    await combo('jab', 'cross');
    this.trainerSay('gymBagJab');
    await circle(0.28);
    // over his shoulder: the bag, the window, the street
    cam(1.9, 1.72, -0.28, 1.25, 42);
    await combo('jab', 'cross', 'body');
    await circle(0.05, IN);
    await combo('hook', 'bodyhook');
    await this.w(0.2);
    await circle(-0.3, -IN);
    // from behind the bag: his face past it
    { const d = M.f.clone(); director.cut(rest.clone().addScaledVector(d, 1.5).addScaledVector(M.r, -0.85).setY(floor + 1.55), rest.clone().addScaledVector(d, -0.95).setY(floor + 1.45), 38); }
    await combo('jab', 'jab', 'cross');
    this.trainerSay('gymBagGood');
    await circle(0.05, IN);
    await combo('upper', 'hook');
    pan(2.2, 1.3, 1.35, 3.5, 1.15, 40);
    await circle(-0.24, -IN);
    await combo('jab', 'cross', 'body');
    await this.w(0.4);
    // ---- done: the gloves down, a breath, a glove on the bag to stop it
    for (const s of ['L', 'R']) aim[s] = null;
    const steady = (s) => { const h = B.hands[s]; h.at = () => bagPoint(1.3, s === 'L' ? 0.55 : -0.55).addScaledVector(M.f, -GLOVE * 0.75); };
    steady('L'); steady('R');
    SOUND.breath(audio, true, 1.2);
    B.jaw = 0.22;
    await this.tw(0.8, (k) => { B.jaw = 0.22 * (1 - k); ST.lean *= 0.9; });
    this.trainerSay('gymBagDone');
    body.setLinearDamping(1.2);
    await this.w(1.2);
    this.after = { at: M.c.clone().addScaledVector(M.f, -0.25), yaw: M.yaw };
    void trainer;
  }

  // His gloves: a copy of the pair's two (the right is the pair's Object_7, the left Object_9: city/Shops.js),
  // each turned onto his hand (the cuff along the forearm, the palm side on the palm), the wrist at the cuff's
  // lace band; `front` how far the glove's face is past the wrist. His fingers close into a fist inside.
  wearGloves(rig) {
    if (!hasProp('gloves')) return { front: 0.1, remove() {} };
    const pair = prop('gloves');
    pair.updateMatrixWorld(true);
    const out = [];
    const find = (mat) => { let m = null; pair.traverse((o) => { if (o.isMesh && o.material?.name === mat) m = o; }); return m; };
    let front = 0.15;
    for (const [s, mat, nz] of [['R', 'Material_126', 1], ['L', 'Material_125', -1]]) {
      const src = find(mat);
      if (!src) continue;
      // the glove's long axis (cuff to fist: down, as it hangs), its palm side (`nz` along z), and its wrist point
      const P = src.geometry.attributes.position, v = V(0, 0, 0), pts = [];
      for (let i = 0; i < P.count; i += 3) pts.push(v.fromBufferAttribute(P, i).applyMatrix4(src.matrixWorld).clone());
      const ys = pts.map((p) => p.y), y0 = Math.max(...ys), y1 = Math.min(...ys), len = y0 - y1;
      const band = pts.filter((p) => Math.abs(p.y - (y0 - len * 0.45)) < len * 0.04);
      const wristP = band.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / Math.max(1, band.length));
      const Ag = V(0, -1, 0), Ng = V(0, 0, nz), Cg = V(0, 0, 0).crossVectors(Ag, Ng);
      const pm = rig.palm(s), Ah = pm.along, Nh = pm.normal, Ch = V(0, 0, 0).crossVectors(Ah, Nh).normalize();
      const k = 0.86; // (sized to his hand)
      const Rg = new THREE.Matrix4().makeBasis(Cg, Ag, Ng), Rh = new THREE.Matrix4().makeBasis(Ch, Ah, Nh);
      const R = Rh.clone().multiply(Rg.clone().transpose());
      // glove space → hand space: about the wrist point, turned, scaled, onto the wrist (a centimetre down the hand)
      const M = new THREE.Matrix4().makeTranslation(Ah.x * 0.012, Ah.y * 0.012, Ah.z * 0.012).multiply(R).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-wristP.x, -wristP.y, -wristP.z)).multiply(src.matrixWorld);
      // the hand itself drawn in toward the wrist inside it (its thumb, weighted to the hand, showed through the
      // top of the glove in a hook and an uppercut), the glove scaled back up by as much so it keeps its size
      const hand = rig.bones[`hand_${s}`];
      hand.scale.setScalar(HAND_IN);
      M.premultiply(new THREE.Matrix4().makeScale(1 / HAND_IN, 1 / HAND_IN, 1 / HAND_IN));
      const g = new THREE.Mesh(src.geometry, src.material);
      g.matrixAutoUpdate = false;
      g.matrix.copy(M);
      g.castShadow = true;
      g.frustumCulled = false;
      rig.bones[`hand_${s}`].add(g);
      out.push(g);
      front = (wristP.y - y1) * k + 0.012;
    }
    return { front, meshes: out, remove: () => { for (const g of out) g.removeFromParent(); for (const s of ['L', 'R']) rig.bones[`hand_${s}`]?.scale.setScalar(1); } };
  }

  // ===================================================================================== the rope
  // The jump rope on the open floor by the ring: the rope (a tube drawn along its curve each frame) swung round
  // him from the handles in his fists, his wrists turning it, a hop over it each time it comes under his feet
  // (two feet, then a boxer's skip, a foot at a time), the slap of it on the concrete.
  async rope() {
    const S = this.s, { player, director, audio } = S, rig = player.rig;
    const floor = this.room(0, 0.15, 0).y, spot = this.room(13.3, 0.15, -2.35), f = this.roomDir(0, 1).normalize(), r = V(0, 0, 0).crossVectors(f, UP).normalize();
    const yaw = Math.atan2(f.x, f.z);
    this.after = { at: spot.clone(), yaw };
    const watchAt = this.room(11.0, 0.15, -3.9), look = spot.clone().sub(watchAt);
    this.trainerTo([this.room(0.8, 0.15, -9.15), this.room(0.8, 0.15, -7.55), this.room(3.2, 0.15, -6.4), this.room(10.2, 0.15, -4.4), watchAt], Math.atan2(look.x, look.z), 'rope');
    director.cut(spot.clone().addScaledVector(f, 1.9).addScaledVector(r, -2.2).setY(floor + 1.5), spot.clone().setY(floor + 0.9), 46);
    await this.walk(spot, player.walkSpeed * 1.1);
    player.turnTo(yaw, 5);
    await this.w(0.6);
    // ---- the rope: its handles in his fists (on at a cut, from the hook by the ring)
    await S.ui.fade(1, 0.25);
    const B = this.drive(), P = B.pose;
    copyPose(P, makePose({ sx: 0.06, nx: 0.08, kx: 0.04 }));
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.55 }), cord = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, side: THREE.DoubleSide });
    const handles = {}, parts = [];
    for (const s of ['L', 'R']) {
      const g = B.fingers.grip(s, 0.016), sd = B.fingers.sides[s], h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.15, 10), wood);
      // along the hand's breadth through the fist, a little more of it out of the little finger's side
      const C = sd ? sd.across.clone() : V(1, 0, 0), down = C.clone().multiplyScalar(-(sd?.thumbSide ?? 1));
      h.position.copy(g.point).addScaledVector(down, 0.035);
      h.quaternion.setFromUnitVectors(UP, down.clone().negate());
      h.castShadow = true;
      rig.bones[`hand_${s}`].add(h);
      handles[s] = { mesh: h, down, curl: g.curl, end: () => h.localToWorld(V(0, -0.075, 0)) };
      parts.push(h);
    }
    const N = 40, RAD = 6, tube = new THREE.BufferGeometry(), pos = new Float32Array((N + 1) * RAD * 3), idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < RAD; j++) { const a = i * RAD + j, b = i * RAD + ((j + 1) % RAD), c = a + RAD, d = b + RAD; idx.push(a, c, b, b, c, d); }
    tube.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tube.setIndex(idx);
    const ropeMesh = new THREE.Mesh(tube, cord);
    ropeMesh.frustumCulled = false;
    ropeMesh.castShadow = true;
    this.f.scene.add(ropeMesh);
    parts.push(ropeMesh);
    this.cleanup.push(() => { for (const p of parts) p.removeFromParent(); tube.dispose(); });
    const RO = { phi: Math.PI * 0.05, len: 1.0, lag: 0.35 };
    const cur = [], fr = V(0, 0, 0), up2 = V(0, 0, 0), sideA = V(0, 0, 0), tmp = V(0, 0, 0);
    const drawRope = () => {
      const a = handles.L.end(), b = handles.R.end(), ax = tmp.subVectors(b, a).normalize();
      for (let i = 0; i <= N; i++) {
        const u = i / N, bulge = Math.pow(Math.sin(Math.PI * u), 0.85), ph = RO.phi - RO.lag * bulge;
        // the bulge's way round the hands' line: up at 0, ahead of him at a quarter, under his feet at a half
        const d = up2.copy(UP).multiplyScalar(Math.cos(ph)).addScaledVector(f, Math.sin(ph));
        d.addScaledVector(ax, -d.dot(ax)).normalize();
        const p = (cur[i] ??= V(0, 0, 0)).lerpVectors(a, b, u).addScaledVector(d, RO.len * bulge);
        p.y = Math.max(p.y, floor + 0.006);
      }
      for (let i = 0; i <= N; i++) {
        const t = fr.subVectors(cur[Math.min(N, i + 1)], cur[Math.max(0, i - 1)]).normalize();
        const n1 = sideA.crossVectors(t, Math.abs(t.y) < 0.9 ? UP : X).normalize(), n2 = V(0, 0, 0).crossVectors(t, n1);
        for (let j = 0; j < RAD; j++) {
          const an = (j / RAD) * Math.PI * 2, k = (i * RAD + j) * 3, c = Math.cos(an) * 0.0045, sn = Math.sin(an) * 0.0045;
          pos[k] = cur[i].x + n1.x * c + n2.x * sn; pos[k + 1] = cur[i].y + n1.y * c + n2.y * sn; pos[k + 2] = cur[i].z + n1.z * c + n2.z * sn;
        }
      }
      tube.attributes.position.needsUpdate = true;
      tube.computeVertexNormals();
    };
    // the feet and hips: together, on the balls of the feet; the hands at his hips, out a little and forward
    const base = { L: spot.clone().addScaledVector(r, -0.1).addScaledVector(f, 0.02), R: spot.clone().addScaledVector(r, 0.1).addScaledVector(f, 0.02) };
    const hop = { L: 0, R: 0, dip: 0 };
    for (const s of ['L', 'R']) { const fo = B.feet[s]; fo.yaw = yaw + (s === 'L' ? 0.12 : -0.12); fo.pole = V(Math.sin(yaw), 0.3, Math.cos(yaw)); }
    const hand = (s) => {
      const h = B.hands[s], k = s === 'L' ? 1 : -1;
      h.grip.copy(B.fingers.grip(s, 0.016).point);
      h.curl = [...handles[s].curl, 0.5];
      h.pole = () => V(0, -1, 0).addScaledVector(r, -0.6 * k).addScaledVector(f, -0.4);
      h.frame = () => [f.clone().multiplyScalar(0.75).add(V(0, -0.65, 0)).normalize(), r.clone().multiplyScalar(k)];
      h.at = () => rig.bonePosition('hips', V(0, 0, 0)).addScaledVector(r, -0.27 * k).addScaledVector(f, 0.16).add(V(0, -0.02, 0))
        .addScaledVector(f, 0.04 * Math.cos(RO.phi)).add(V(0, 0.04 * Math.sin(RO.phi), 0));
    };
    hand('L'); hand('R');
    B.hands.L.w = B.hands.R.w = 1;
    const hipsY = floor + rig.hipsHeight - 0.012; // (up on the balls of his feet, the knees soft, not bent)
    B.each = () => {
      for (const s of ['L', 'R']) { const fo = B.feet[s]; fo.p.copy(base[s]).setY(floor + 0.092 + hop[s]); fo.pitch = 0.22 + hop[s] * 4; }
      B.R.hips.copy(spot).setY(hipsY + Math.max(hop.L, hop.R) * 0.85 - hop.dip).addScaledVector(f, -0.02);
      drawRope();
    };
    B.R.q.copy(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
    await this.w(0.1);
    await S.ui.fade(0, 0.35);
    player.lookAt(() => spot.clone().addScaledVector(f, 3).setY(floor + 1.4), 0.5);
    this.trainerSay('gymRope1');
    // ---- skipping: the rope's turn, and the hop timed to it (in the air while it's under his feet)
    let turns = 0, last = RO.phi;
    const air = (ph) => { const x = ((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return smooth(0.62 * Math.PI, 0.9 * Math.PI, x) * (1 - smooth(1.08 * Math.PI, 1.36 * Math.PI, x)); };
    const swing = async (secs, rate, style) => {
      await this.tw(secs, (k) => {
        const dt = B.dt ?? 1 / 30;
        RO.phi += rate * Math.PI * 2 * dt;
        const a = air(RO.phi), lift = style === 'boxer' ? 0.035 : 0.045;
        if (style === 'boxer') { const odd = Math.floor((RO.phi - Math.PI * 0.62) / (Math.PI * 2)) % 2 === 0; hop.L = a * lift * (odd ? 1 : 0.15) + (odd ? 0 : 0.05 * a); hop.R = a * lift * (odd ? 0.15 : 1) + (odd ? 0.05 * a : 0); }
        else { hop.L = hop.R = a * lift; }
        // a soft landing: the knees give a little just after
        const x = ((RO.phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        hop.dip = 0.025 * Math.max(0, Math.sin(((x - 1.3 * Math.PI) / (0.5 * Math.PI)) * Math.PI)) * (x > 1.3 * Math.PI && x < 1.8 * Math.PI ? 1 : 0);
        // the rope on the floor, and his feet back on it
        const wrapAt = (p, at) => Math.floor((p - at) / (Math.PI * 2));
        if (wrapAt(RO.phi, 0.92 * Math.PI) > wrapAt(last, 0.92 * Math.PI)) { SOUND.slap(audio, 0.8); turns++; }
        if (wrapAt(RO.phi, 1.36 * Math.PI) > wrapAt(last, 1.36 * Math.PI)) SOUND.pat(audio, 0.7);
        last = RO.phi;
        void k;
      }, ease.linear);
    };
    // the first turns slow, from behind his heels over his head
    director.move(spot.clone().addScaledVector(f, 2.6).addScaledVector(r, -0.9).setY(floor + 1.1), spot.clone().setY(floor + 0.95), 6, ease.inOut, 44);
    await swing(1.0, 1.4, 'two');
    this.cue?.('skip');
    await swing(4.0, 2.0, 'two');
    // low at his feet: the rope under them
    director.cut(spot.clone().addScaledVector(f, 1.5).addScaledVector(r, 0.9).setY(floor + 0.35), spot.clone().setY(floor + 0.3), 42);
    await swing(3.0, 2.15, 'boxer');
    this.trainerSay('gymRope2');
    director.cut(spot.clone().addScaledVector(r, 2.6).addScaledVector(f, 0.4).setY(floor + 1.2), spot.clone().setY(floor + 0.95), 44);
    await swing(4.0, 2.3, 'boxer');
    // stopped: the rope let come round under his feet and caught there, behind his heels
    const phi0 = RO.phi, target = Math.ceil((phi0 - Math.PI * 0.5) / (Math.PI * 2)) * Math.PI * 2 + Math.PI * 1.55;
    await this.tw(0.9, (k) => { RO.phi = phi0 + (target - phi0) * ease.out(k); hop.L = hop.R = 0.04 * air(RO.phi); }, ease.linear);
    hop.L = hop.R = hop.dip = 0;
    SOUND.breath(audio, true, 1.1);
    B.jaw = 0.18;
    await this.tw(0.7, (k) => { B.jaw = 0.18 * (1 - k); });
    await this.w(0.6);
    void turns;
  }
}
