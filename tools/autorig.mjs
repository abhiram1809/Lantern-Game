// Procedural humanoid auto-rig for T/A-pose scans that are Y-up, facing +Z, feet at y = 0.
// Joint positions come from anatomical landmarks measured on the mesh; skin weights come from
// distance to limb chains, blended across joints and smoothed over the surface.
//
// `opts` overrides landmarks for figures far from human proportions (see RIG_DEFAULTS). Every
// default reproduces the original constants, so models built without opts are unchanged.

export const BONES = [
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['upperArm_L', 'chest'], ['foreArm_L', 'upperArm_L'], ['hand_L', 'foreArm_L'],
  ['upperArm_R', 'chest'], ['foreArm_R', 'upperArm_R'], ['hand_R', 'foreArm_R'],
  ['thigh_L', 'hips'], ['shin_L', 'thigh_L'], ['foot_L', 'shin_L'],
  ['thigh_R', 'hips'], ['shin_R', 'thigh_R'], ['foot_R', 'shin_R'],
];
const B = Object.fromEntries(BONES.map(([name], i) => [name, i]));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => mul(a, 1 / len(a));
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export const RIG_DEFAULTS = {
  neckMid: null,    // neck height as a fraction of H; null = narrowest slice between 0.8 and 0.93 H
  jawBack: 0.02,    // the jaw line's back end sits this far (× H) above the chin
  neckBack: null,   // z of the jaw line's back end (× H); null = back of the neck slice
  headFill: false,  // head override only on the surface connected to the face above the jaw line
                    // (keeps a collar or armour that rises behind the head off the head bone)
  neckColumn: false, // head and neck weights only inside the column under the head (0.1 H to
                     // each side, back to the jaw line's back end); armour around it (a collar,
                     // pauldron flanges) goes to the chest
  shoulder: null,   // [x, y] of the shoulder joints (× H); null = extrapolate from the upper arm
  armMinX: 0.06,    // arm chains can't claim vertices nearer the centre line than this (× H)
  armRadius: 1,     // scales the arm chains' radii (thicker arms claim more of the shoulder)
  legX: 0.15,       // leg slabs reach this far out from the centre line (× H)
  hipX: null,       // hip joints' distance from the centre line (× H); null = 0.95 × the centroid
                    // of the thigh tops (pulled inward by a dense crotch)
  knee: 0.285,      // knee height (× H)
  armLo: 0.2,       // the arm axis is fitted to vertices from this far out (× H)...
  armTipIn: 0.12,   // ...to this far short of the fingertips (× H)...
  armMinY: 0.35,    // ...and above this height (× H). An A-pose's hands don't reach far out, so the
                    // T-pose band is nearly empty there; narrow it in and raise it clear of the hips
  armMaxY: Infinity, // ...and below this one (× H): under pauldrons that reach out past the arm
  elbowK: 0.42,     // the elbow and wrist as fractions of the way from the shoulder to the
  wristK: 0.76,     // fingertips (short forearms, or fingers curled under, move them out)
};

export function autoRig(pos, idx, H, opts = {}) {
  const o = { ...RIG_DEFAULTS, ...opts };
  const n = pos.length / 3;
  const V = (i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];

  const centroid = (pred) => {
    let sx = 0, sy = 0, sz = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      if (pred(x, y, z)) { sx += x; sy += y; sz += z; c++; }
    }
    if (!c) throw new Error('autoRig: empty slab');
    return [sx / c, sy / c, sz / c];
  };

  // --- Landmarks -------------------------------------------------------------------------
  // Crotch: walk down the midline (x = 0 plane) from the pelvis. Stop at a gap between the legs,
  // or, where the scan fused the inner thighs into one sheet, where the midline section gets
  // much shallower front-to-back than the pelvis.
  const slice = 0.01 * H, NS = Math.ceil(H / slice) + 1;
  const zMin = new Float32Array(NS).fill(Infinity), zMax = new Float32Array(NS).fill(-Infinity);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    if (Math.min(pos[a], pos[b], pos[c]) > 0 || Math.max(pos[a], pos[b], pos[c]) < 0) continue;
    const y0 = Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), y1 = Math.max(pos[a + 1], pos[b + 1], pos[c + 1]);
    const z = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    for (let s = Math.floor(y0 / slice); s <= Math.floor(y1 / slice); s++) { zMin[s] = Math.min(zMin[s], z); zMax[s] = Math.max(zMax[s], z); }
  }
  const depth = (s) => (zMax[s] > zMin[s] ? zMax[s] - zMin[s] : 0);
  const pelvisDepth = [52, 53, 54, 55].map(depth).sort((a, b) => a - b)[2];
  let k = 55;
  while (k > 30 && depth(k - 1) >= 0.65 * pelvisDepth) k--;
  const crotchRaw = k * slice;
  const crotchY = Math.min(0.52 * H, Math.max(0.38 * H, crotchRaw));
  const hipY = crotchY + 0.04 * H;

  const torsoAt = (y, halfW = 0.1) => centroid((x, yy) => Math.abs(x) < halfW * H && Math.abs(yy - y) < 0.012 * H);
  const pelvis = torsoAt(hipY + 0.01 * H, 0.12);
  const hips = [0, hipY, pelvis[2]];
  const spine = [0, hipY + 0.09 * H, torsoAt(hipY + 0.09 * H)[2]];
  const chest = [0, hipY + 0.2 * H, torsoAt(hipY + 0.2 * H)[2]];

  // Neck: narrowest horizontal slice between shoulders and head.
  let neckMid = 0.86 * H, best = Infinity;
  for (let y = 0.8 * H; o.neckMid === null && y <= 0.93 * H; y += 0.004 * H) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[3 * i];
      if (Math.abs(pos[3 * i + 1] - y) < 0.003 * H && Math.abs(x) < 0.1 * H) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
    }
    if (mx - mn < best) { best = mx - mn; neckMid = y; }
  }
  if (o.neckMid !== null) neckMid = o.neckMid * H;
  let topY = -Infinity;
  for (let i = 0; i < n; i++) topY = Math.max(topY, pos[3 * i + 1]);
  const neckY = neckMid - 0.025 * H, headY = neckMid + 0.015 * H;
  const neck = [0, neckY, torsoAt(neckY, 0.07)[2]];
  const head = [0, headY, torsoAt(headY, 0.07)[2]];
  const headTop = [0, topY, head[2]];

  // Legs: centroids of thin horizontal slabs on each side.
  const leg = (s) => {
    const slab = (y0, y1) => centroid((x, y) => s * x > 0.008 * H && Math.abs(x) < o.legX * H && y >= y0 && y <= y1);
    const top = slab(crotchY - 0.06 * H, crotchY - 0.02 * H);
    const kneeY = o.knee * H;
    const knee = slab(kneeY - 0.015 * H, kneeY + 0.015 * H);
    const ank = slab(0.07 * H, 0.09 * H);
    let toe = null, bz = -Infinity;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = V(i);
      if (y < 0.06 * H && s * x > 0 && z > bz) { bz = z; toe = [x, y, z]; }
    }
    return {
      hip: [o.hipX === null ? top[0] * 0.95 : s * o.hipX * H, hipY, top[2]],
      knee: [knee[0], kneeY, knee[2]],
      ankle: [ank[0], 0.05 * H, ank[2]],
      toe: [toe[0], 0.02 * H, toe[2] - 0.01 * H],
    };
  };

  // Arms: principal axis of the clearly-arm vertices, joints at standard proportions,
  // then re-centred inside the limb.
  const arm = (s) => {
    let tip = null, bx = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = V(i);
      if (v[1] > 0.3 * H && s * v[0] > bx) { bx = s * v[0]; tip = v; }
    }
    const lo = o.armLo * H, hi = s * tip[0] - o.armTipIn * H;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const v = V(i);
      if (s * v[0] > lo && s * v[0] < hi && v[1] > o.armMinY * H && v[1] < o.armMaxY * H) pts.push(v);
    }
    const mean = mul(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) {
      const d = sub(p, mean);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] += d[r] * d[c];
    }
    let d = [s, 0, 0];
    for (let k = 0; k < 50; k++) d = norm([dot(C[0], d), dot(C[1], d), dot(C[2], d)]);
    if (d[0] * s < 0) d = mul(d, -1);
    const recenter = (j, dir) => {
      let c;
      try {
        c = centroid((x, y, z) => {
          const r = sub([x, y, z], j), a = dot(r, dir);
          return Math.abs(a) < 0.012 * H && len(sub(r, mul(dir, a))) < 0.04 * H;
        });
      } catch { return j; }
      const off = sub(c, j);
      return add(j, sub(off, mul(dir, dot(off, dir))));
    };
    // Shoulder: extrapolate a short way inward from the upper arm's own cross-section, along the
    // upper arm. (Extrapolating the whole-arm axis drifts badly in z on A-poses.)
    const xe = s * 0.1 * H + 0.42 * (tip[0] - s * 0.1 * H);
    const elbow0 = recenter(add(mean, mul(d, (xe - mean[0]) / d[0])), d);
    let shoulder;
    if (o.shoulder) {
      // given in x and y; z is the middle of the shoulder's column there
      const [sx, sy] = [s * o.shoulder[0] * H, o.shoulder[1] * H];
      shoulder = [sx, sy, centroid((x, y) => Math.abs(x - sx) < 0.02 * H && Math.abs(y - sy) < 0.02 * H)[2]];
    } else {
      const root = centroid((x, y) => s * x > 0.17 * H && s * x < 0.22 * H && y > 0.55 * H);
      const ua = norm(sub(elbow0, root));
      shoulder = add(root, mul(ua, (s * 0.1 * H - root[0]) / ua[0]));
      shoulder[1] = Math.min(0.83 * H, Math.max(0.76 * H, shoulder[1]));
    }
    const dir = norm(sub(tip, shoulder));
    const L = len(sub(tip, shoulder));
    return {
      shoulder,
      elbow: recenter(add(shoulder, mul(dir, o.elbowK * L)), dir),
      wrist: recenter(add(shoulder, mul(dir, o.wristK * L)), dir),
      tip,
    };
  };

  const aL = arm(1), aR = arm(-1), lL = leg(1), lR = leg(-1);
  const jointPos = {
    hips, spine, chest, neck, head,
    upperArm_L: aL.shoulder, foreArm_L: aL.elbow, hand_L: aL.wrist,
    upperArm_R: aR.shoulder, foreArm_R: aR.elbow, hand_R: aR.wrist,
    thigh_L: lL.hip, shin_L: lL.knee, foot_L: lL.ankle,
    thigh_R: lR.hip, shin_R: lR.knee, foot_R: lR.ankle,
  };

  // --- Weights ---------------------------------------------------------------------------
  // Each chain: points p0..pk, the bone for each segment, a radius per segment (for comparing
  // thick and thin limbs fairly), plus the parent bone it blends into at its start.
  const chains = [
    { pts: [[0, crotchY, pelvis[2]], spine, chest, neck, head, headTop], bones: [B.hips, B.spine, B.chest, B.neck, B.head], radii: [0.09, 0.085, 0.09, 0.035, 0.06], band: 0.03 },
    { pts: [aL.shoulder, aL.elbow, aL.wrist, aL.tip], bones: [B.upperArm_L, B.foreArm_L, B.hand_L], radii: [0.035, 0.03, 0.03].map((r) => r * o.armRadius), band: 0.025, attach: B.chest, attachBand: 0.035, side: 1, arm: true },
    { pts: [aR.shoulder, aR.elbow, aR.wrist, aR.tip], bones: [B.upperArm_R, B.foreArm_R, B.hand_R], radii: [0.035, 0.03, 0.03].map((r) => r * o.armRadius), band: 0.025, attach: B.chest, attachBand: 0.035, side: -1, arm: true },
    { pts: [lL.hip, lL.knee, lL.ankle, lL.toe], bones: [B.thigh_L, B.shin_L, B.foot_L], radii: [0.055, 0.038, 0.035], band: 0.03, attach: B.hips, attachBand: 0.03, side: 1, leg: true },
    { pts: [lR.hip, lR.knee, lR.ankle, lR.toe], bones: [B.thigh_R, B.shin_R, B.foot_R], radii: [0.055, 0.038, 0.035], band: 0.03, attach: B.hips, attachBand: 0.03, side: -1, leg: true },
  ];
  for (const ch of chains) {
    ch.segs = [];
    let acc = 0;
    for (let k = 0; k < ch.pts.length - 1; k++) {
      const a = ch.pts[k], d = sub(ch.pts[k + 1], a), l = len(d);
      ch.segs.push({ a, dir: mul(d, 1 / l), l, s0: acc, r: ch.radii[k] * H });
      acc += l;
    }
  }

  // Merge vertices that share a position (UV seams) so both sides of a seam get identical weights.
  const keyOf = (i) => `${Math.round(pos[3 * i] * 1e5)},${Math.round(pos[3 * i + 1] * 1e5)},${Math.round(pos[3 * i + 2] * 1e5)}`;
  const canonMap = new Map(), canon = new Uint32Array(n), reps = [];
  for (let i = 0; i < n; i++) {
    const k = keyOf(i);
    let c = canonMap.get(k);
    if (c === undefined) { c = reps.length; canonMap.set(k, c); reps.push(i); }
    canon[i] = c;
  }
  const m = reps.length, NB = BONES.length;
  const landmarksExtra = {};
  let W = new Float32Array(m * NB);

  for (let c = 0; c < m; c++) {
    const p = V(reps[c]);
    let bestCh = null, bestNd = Infinity, bestS = 0;
    for (const ch of chains) {
      if (ch.arm && ch.side * p[0] < o.armMinX * H) continue;
      if (ch.leg && (p[1] > hipY + 0.06 * H || ch.side * p[0] < -0.02 * H)) continue;
      if (!ch.arm && !ch.leg && p[1] < crotchY - 0.005 * H) continue;
      for (let k = 0; k < ch.segs.length; k++) {
        const sg = ch.segs[k], r = sub(p, sg.a), raw = dot(r, sg.dir);
        const u = Math.min(sg.l, Math.max(0, raw));
        const nd = len(sub(r, mul(sg.dir, u))) / sg.r;
        if (nd < bestNd) { bestNd = nd; bestCh = ch; bestS = k === 0 && raw < 0 ? raw : sg.s0 + u; }
      }
    }
    const row = c * NB;
    const ch = bestCh;
    // Partition of unity along the chain: smooth handover at each interior joint.
    const wb = new Array(ch.bones.length).fill(0);
    let carry = 1;
    for (let k = 0; k < ch.bones.length; k++) {
      const next = k + 1 < ch.segs.length ? smoothstep(ch.segs[k + 1].s0 - ch.band * H, ch.segs[k + 1].s0 + ch.band * H, bestS) : 0;
      wb[k] = carry * (1 - next);
      carry *= next;
    }
    const attachW = ch.attach !== undefined ? 1 - smoothstep(-ch.attachBand * H, ch.attachBand * H, bestS) : 0;
    for (let k = 0; k < ch.bones.length; k++) W[row + ch.bones[k]] += wb[k] * (1 - attachW);
    if (attachW > 0) W[row + ch.attach] += attachW;
  }

  // Laplacian smoothing over the surface hides the seams between chain classifications.
  const nbrSets = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const a = canon[idx[t]], b = canon[idx[t + 1]], d = canon[idx[t + 2]];
    nbrSets[a].add(b).add(d); nbrSets[b].add(a).add(d); nbrSets[d].add(a).add(b);
  }
  const nbrs = nbrSets.map((s) => Uint32Array.from(s));
  for (let it = 0; it < 10; it++) {
    const W2 = new Float32Array(m * NB);
    for (let c = 0; c < m; c++) {
      const nb = nbrs[c];
      for (let b = 0; b < NB; b++) {
        let s = 0;
        for (let j = 0; j < nb.length; j++) s += W[nb[j] * NB + b];
        W2[c * NB + b] = nb.length ? 0.4 * W[c * NB + b] + 0.6 * (s / nb.length) : W[c * NB + b];
      }
    }
    W = W2;
  }

  // The whole skull, face and jaw belong to the head bone: everything above the jaw line (from
  // under the chin at the front to the base of the skull at the back) is head-only, with a short
  // blend just below it. Without this the mouth stays with the neck and the face shears when the
  // head turns.
  {
    const nb = []; // neck slice: front and back of the neck
    for (let i = 0; i < n; i++) if (Math.abs(pos[3 * i + 1] - neckMid) < 0.004 * H && Math.abs(pos[3 * i]) < 0.05 * H) nb.push(pos[3 * i + 2]);
    const neckFront = Math.max(...nb), neckBack = o.neckBack === null ? Math.min(...nb) : o.neckBack * H;
    // front profile of the face: nose tip, then down past lips and chin until the profile falls
    // well behind the nose (the underside of the jaw sweeping back to the neck)
    const slice = 0.003 * H, k = H / 1.83;
    const front = (y) => {
      let zf = -Infinity;
      for (let i = 0; i < n; i++) if (Math.abs(pos[3 * i + 1] - y) < slice / 2 && Math.abs(pos[3 * i]) < 0.02 * H) zf = Math.max(zf, pos[3 * i + 2]);
      return zf;
    };
    let noseY = neckMid, noseZ = -Infinity;
    for (let y = neckMid; y < neckMid + 0.1 * H; y += slice) { const z = front(y); if (z > noseZ) { noseZ = z; noseY = y; } }
    let chinY = noseY - 0.06 * k, chinZ = noseZ - 0.03 * k;
    for (let y = noseY; y > neckMid - 0.05 * H; y -= slice) {
      const z = front(y);
      if (z < noseZ - 0.05 * k) break;
      chinY = y; chinZ = z;
    }
    const backY = chinY + o.jawBack * H;
    const jawY = (z) => backY + (chinY - backY) * Math.min(1, Math.max(0, (z - neckBack) / (chinZ - neckBack)));
    const headW = (c) => {
      const [x, y, z] = [pos[3 * reps[c]], pos[3 * reps[c] + 1], pos[3 * reps[c] + 2]];
      if (Math.abs(x) > 0.09 * H || y < neckMid - 0.06 * H) return 0;
      return smoothstep(jawY(z) - 0.012 * H, jawY(z) + 0.004 * H, y);
    };
    let reached = null;
    if (o.headFill) {
      // flood the candidate region from the face (the most forward point near the nose)
      let start = -1, bz = -Infinity;
      for (let c = 0; c < m; c++) {
        const v = reps[c];
        if (Math.abs(pos[3 * v + 1] - noseY) < 0.01 * H && Math.abs(pos[3 * v]) < 0.02 * H && pos[3 * v + 2] > bz) { bz = pos[3 * v + 2]; start = c; }
      }
      reached = new Uint8Array(m);
      const stack = [start];
      reached[start] = 1;
      while (stack.length) {
        const c = stack.pop();
        for (const d of nbrs[c]) if (!reached[d] && headW(d) > 0) { reached[d] = 1; stack.push(d); }
      }
    }
    // (open at the front: nothing there to protect, and the face may jut out past the chin)
    const colZ = (chinZ + neckBack) / 2, colRZ = (chinZ - neckBack) / 2, colRX = 0.1 * H;
    const column = (c) => 1 - smoothstep(0.9, 1.15, Math.hypot(pos[3 * reps[c]] / colRX, Math.min(0, pos[3 * reps[c] + 2] - colZ) / colRZ));
    for (let c = 0; c < m; c++) {
      if (reached && !reached[c]) continue;
      const h = headW(c) * (o.neckColumn ? column(c) : 1);
      if (h <= 0) continue;
      const row = c * NB;
      for (let b = 0; b < NB; b++) W[row + b] *= 1 - h;
      W[row + B.head] += h;
    }
    if (o.neckColumn) {
      for (let c = 0; c < m; c++) {
        const out = 1 - column(c), row = c * NB;
        if (out <= 0) continue;
        for (const b of [B.neck, B.head]) { W[row + B.chest] += W[row + b] * out; W[row + b] *= 1 - out; }
      }
    }
    landmarksExtra.chinY = chinY;
    if (o.headFill) Object.assign(landmarksExtra, { noseY, chinZ, jawBackY: backY, jawBackZ: neckBack });
  }

  // Keep the four strongest influences per vertex.
  const skinIndex = new Uint8Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const row = canon[i] * NB;
    const order = [...Array(NB).keys()].sort((a, b) => W[row + b] - W[row + a]).slice(0, 4);
    let sum = 0;
    for (const b of order) sum += W[row + b];
    order.forEach((b, k) => { skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = W[row + b] / sum; });
  }

  return { joints: BONES.map(([name, parent]) => ({ name, parent, pos: jointPos[name] })), skinIndex, skinWeight, landmarks: { crotchRaw, crotchY, hipY, neckMid, topY, ...landmarksExtra } };
}
