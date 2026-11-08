// Flat pose parameters (radians / metres) and procedural motion generators.
//   h*  hips offset + rotation      s*, c*, n*, k*  spine, chest, neck, head (euler)
//   aL/aR  arm direction in chest space (+X is the character's left, +Z forward)
//   tL/tR twist, eL/eR elbow flex, wL/wR wrist flex
//   lL*/lR*  thigh euler (negative x swings the leg forward), kL/kR knee flex, fL/fR foot
const DEFAULT = {
  hx: 0, hy: 0, hz: 0, hrx: 0, hry: 0, hrz: 0,
  sx: 0, sy: 0, sz: 0, cx: 0, cy: 0, cz: 0, nx: 0, ny: 0, nz: 0, kx: 0, ky: 0, kz: 0,
  aL: [0.14, -1, 0.05], tL: 0, eL: 0.2, wL: 0,
  aR: [-0.14, -1, 0.05], tR: 0, eR: 0.2, wR: 0,
  lLx: 0, lLy: 0, lLz: 0, kL: 0, fL: 0,
  lRx: 0, lRy: 0, lRz: 0, kR: 0, fR: 0,
};
const KEYS = Object.keys(DEFAULT);

export function makePose(overrides = {}) {
  const p = {};
  for (const k of KEYS) p[k] = Array.isArray(DEFAULT[k]) ? [...DEFAULT[k]] : DEFAULT[k];
  for (const [k, v] of Object.entries(overrides)) p[k] = Array.isArray(v) ? [...v] : v;
  return p;
}

export function copyPose(out, src) {
  for (const k of KEYS) {
    if (Array.isArray(out[k])) { out[k][0] = src[k][0]; out[k][1] = src[k][1]; out[k][2] = src[k][2]; } else out[k] = src[k];
  }
  return out;
}

export function blendInto(out, a, b, t) {
  for (const k of KEYS) {
    if (Array.isArray(out[k])) for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
    else out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}

const breathe = (p, t, amount = 1) => {
  const b = Math.sin(t * 1.6);
  p.cx += 0.018 * b * amount;
  p.aL[2] += 0.015 * b * amount;
  p.aR[2] += 0.015 * b * amount;
  return p;
};

// A held pose with breathing on top.
export function still(pose, breathing = 1) {
  return (out, t) => breathe(copyPose(out, pose), t, breathing);
}

export function idle({ tired = 0 } = {}) {
  return (out, t) => {
    copyPose(out, POSES.stand);
    const sway = Math.sin(t * 0.45);
    out.hx = 0.012 * sway;
    out.hrz = 0.025 * sway;
    out.sz = -0.02 * sway;
    out.lLz = -0.025 * sway; out.lRz = -0.025 * sway;
    out.nx = 0.06 + 0.22 * tired;
    out.kx = 0.03 + 0.08 * tired;
    out.sx = 0.03 + 0.05 * tired;
    out.ky = 0.08 * Math.sin(t * 0.21);
    return breathe(out, t, 1 + tired * 0.6);
  };
}

// Walk/run cycle. `state.phase` advances with distance travelled; speed in m/s.
export function locomotion(state, { tired = 0 } = {}) {
  return (out, t) => {
    copyPose(out, POSES.stand);
    const s = Math.min(1, Math.max(0, (state.speed - 1.2) / 2.4));
    const phase = state.phase;
    const sin = Math.sin(phase), cos = Math.cos(phase);
    const A = 0.38 + 0.3 * s, K = 0.55 + 0.55 * s, B = 0.32 + 0.45 * s;
    out.lLx = -A * sin;
    out.lRx = A * sin;
    out.kL = 0.08 + K * Math.max(0, cos) ** 1.4;
    out.kR = 0.08 + K * Math.max(0, -cos) ** 1.4;
    out.fL = -0.15 * Math.max(0, cos) + 0.1 * Math.max(0, -sin);
    out.fR = -0.15 * Math.max(0, -cos) + 0.1 * Math.max(0, sin);
    out.hy = -0.035 * (1 - Math.abs(cos)) - 0.02 * tired - 0.03 * s;
    out.hry = 0.12 * A * sin;
    out.hrz = 0.03 * cos;
    out.cy = -0.16 * A * sin;
    out.sx = 0.05 + 0.14 * s + 0.06 * tired;
    out.nx = 0.04 + 0.2 * tired - 0.06 * s;
    out.kx = 0.02;
    const swingL = -B * sin, swingR = B * sin;
    out.aL = [0.14 + 0.04 * s, -Math.cos(swingL), Math.sin(swingL) + 0.05];
    out.aR = [-0.14 - 0.04 * s, -Math.cos(swingR), Math.sin(swingR) + 0.05];
    out.eL = 0.25 + 0.9 * s + 0.25 * Math.max(0, swingL);
    out.eR = 0.25 + 0.9 * s + 0.25 * Math.max(0, swingR);
    return out;
  };
}

// Flight: hovering upright, blending into the stretched-out flying pose with speed (the body's
// pitch toward horizontal comes from the player, this only shapes the limbs).
export function flight(state) {
  return (out, t) => {
    const k = state.k ?? 0, still = 1 - k;
    blendInto(out, POSES.hover, POSES.flyFast, k);
    const bob = Math.sin(t * 1.9);
    out.kL += 0.07 * bob * still;
    out.kR += 0.06 * Math.sin(t * 1.9 + 0.8) * still;
    out.aL[2] += 0.05 * bob * still;
    out.aR[2] += 0.05 * Math.sin(t * 1.9 + 0.4) * still;
    // trailing leg and free arm ripple in the airflow
    out.lRx += 0.04 * Math.sin(t * 7.3) * k;
    out.kR += 0.05 * Math.sin(t * 6.1) * k;
    out.eL += 0.06 * Math.sin(t * 5.2) * k;
    return breathe(out, t, 1 - 0.6 * k);
  };
}

// Lying on the back on a bed (the character root is rotated to horizontal by the caller).
export function asleep(state) {
  // state.roll: -1 (left side) .. 0 (back) .. 1 (right side); state.unrest 0..1
  return (out, t) => {
    const r = state.roll ?? 0;
    const side = Math.abs(r);
    // negative roll brings the left side up, so he is lying on his right side
    blendInto(out, POSES.lieBack, r < 0 ? POSES.lieSideR : POSES.lieSideL, side);
    const u = state.unrest ?? 0;
    out.ky += 0.25 * u * Math.sin(t * 2.3) * Math.sin(t * 0.7);
    out.kz += 0.1 * u * Math.sin(t * 1.7);
    out.eL += 0.3 * u * Math.max(0, Math.sin(t * 1.1));
    out.lLx -= 0.15 * u * Math.max(0, Math.sin(t * 0.9 + 1));
    out.kL += 0.25 * u * Math.max(0, Math.sin(t * 0.9 + 1));
    return breathe(out, t, 0.8 + u);
  };
}

export const POSES = {
  stand: makePose({ eL: 0.18, eR: 0.18 }),
  heroStand: makePose({
    cx: -0.06, nx: -0.03, kx: -0.05,
    aL: [0.3, -1, 0.06], aR: [-0.3, -1, 0.06], eL: 0.25, eR: 0.25,
    lLz: 0.07, lRz: -0.07, fL: 0.02, fR: 0.02,
  }),
  lieBack: makePose({
    aL: [0.3, -1, -0.1], aR: [-0.3, -1, -0.1], eL: 0.15, eR: 0.3,
    kL: 0.12, kR: 0.2, lLz: 0.04, lRz: -0.04, fL: 0.45, fR: 0.45, nx: 0.12, kx: 0.1, ky: 0.15,
  }),
  // On the left side: knees drawn up, bottom (left) arm forward under the pillow,
  // top (right) arm draped over the body toward the mattress.
  lieSideL: makePose({
    sx: 0.18, cx: 0.1, kx: 0.25, kz: -0.15,
    aL: [0.05, -0.3, 1], eL: 1.6, aR: [0.45, -0.75, 0.5], eR: 0.6,
    lLx: -0.75, kL: 1.2, lRx: -0.9, kR: 1.3, lRz: 0.08, fL: 0.4, fR: 0.4,
  }),
  lieSideR: makePose({
    sx: 0.18, cx: 0.1, kx: 0.25, kz: 0.15,
    aR: [-0.05, -0.3, 1], eR: 1.6, aL: [-0.45, -0.75, 0.5], eL: 0.6,
    lRx: -0.75, kR: 1.2, lLx: -0.9, kL: 1.3, lLz: -0.08, fL: 0.4, fR: 0.4,
  }),
  // Sitting on the edge of the bed, hands on thighs.
  sitEdge: makePose({
    hy: -0.29, sx: 0.22, cx: 0.08, nx: 0.05,
    lLx: -1.45, kL: 1.5, lRx: -1.5, kR: 1.55, lLz: 0.08, lRz: -0.08,
    aL: [0.2, -0.75, 0.65], eL: 0.7, aR: [-0.2, -0.75, 0.65], eR: 0.7,
  }),
  // Sitting up, right forearm raised against a blinding light.
  shield: makePose({
    hy: -0.29, sx: -0.05, cx: -0.12, nx: -0.05, kx: -0.12, ky: 0.15,
    lLx: -1.45, kL: 1.5, lRx: -1.5, kR: 1.55, lLz: 0.1, lRz: -0.1,
    aL: [0.35, -0.85, 0.3], eL: 0.4,
    aR: [-0.4, 0.55, 0.75], eR: 1.75, tR: 0.4,
  }),
  // Floating inside the light's bubble.
  float: makePose({
    sx: -0.05, cx: -0.1, nx: -0.08, kx: -0.18,
    aL: [0.75, -0.65, 0.12], eL: 0.35, aR: [-0.75, -0.65, 0.12], eR: 0.35,
    lLx: -0.12, kL: 0.35, lRx: 0.12, kR: 0.55, fL: 0.6, fR: 0.6,
  }),
  // Carried head-first through hyperspace: body leaning into the flight, arms swept back.
  carried: makePose({
    sx: -0.1, cx: -0.12, nx: -0.25, kx: -0.2,
    aL: [0.55, -0.75, -0.35], eL: 0.35, aR: [-0.55, -0.75, -0.35], eR: 0.35,
    lLx: 0.12, kL: 0.25, lRx: 0.28, kR: 0.45, fL: 0.7, fR: 0.7,
  }),
  kneel: makePose({
    hy: -0.48, sx: 0.35, cx: 0.15, nx: 0.1,
    lLx: -1.35, kL: 1.65, lRx: 0.25, kR: 2.25, fR: -0.6,
    aL: [0.25, -0.75, 0.55], eL: 0.6, aR: [-0.15, -1, 0.35], eR: 0.15,
  }),
  // Reaching out, right palm up, toward the floating ring.
  reach: makePose({
    sx: 0.04, cy: 0.12, ky: 0.05,
    aR: [-0.3, -0.12, 1], eR: 0.35, tR: -2.2, wR: -0.25,
    aL: [0.2, -1, 0.0], eL: 0.3,
    lLx: -0.18, lRx: 0.12, kR: 0.1,
  }),
  // Fist raised at the lantern.
  ringForward: makePose({
    sx: 0.02, cx: -0.05, kx: -0.05,
    aR: [-0.15, 0.08, 1], eR: 0.08, tR: 0,
    aL: [0.25, -1, 0.05], eL: 0.35,
    lLx: -0.2, lRx: 0.15, kR: 0.12,
  }),
  // Abin Sur, slumped against the hull of his ship (hips lowered to the ground).
  sitGround: makePose({
    hy: -0.8, sx: -0.32, cx: -0.12, nx: 0.12, kx: 0.18, kz: 0.12,
    lLx: -1.5, kL: 0.25, lLz: 0.12, lRx: -1.05, kR: 1.4, lRz: -0.1,
    aL: [-0.25, -0.45, 0.85], eL: 1.45,
    aR: [-0.55, -0.85, 0.2], eR: 0.35,
  }),
  offerRing: makePose({
    hy: -0.8, sx: -0.25, cx: -0.08, nx: 0.05, kx: 0.05, kz: 0.08,
    lLx: -1.5, kL: 0.25, lLz: 0.12, lRx: -1.05, kR: 1.4, lRz: -0.1,
    aL: [-0.25, -0.45, 0.85], eL: 1.45,
    aR: [-0.45, -0.05, 0.9], eR: 0.25, tR: -2.0,
  }),
  dead: makePose({
    hy: -0.8, sx: -0.3, cx: -0.12, nx: 0.45, kx: 0.4, kz: 0.35,
    lLx: -1.5, kL: 0.2, lLz: 0.14, lRx: -1.35, kR: 0.6, lRz: -0.14,
    aL: [0.05, -0.75, 0.6], eL: 1.1,
    aR: [-0.5, -0.9, 0.1], eR: 0.2,
  }),
  // Hovering: upright, arms a little out from the body, legs hanging loose, toes down.
  hover: makePose({
    sx: -0.04, cx: -0.07, nx: -0.03, kx: -0.06,
    aL: [0.42, -0.88, 0.1], eL: 0.42, aR: [-0.42, -0.88, 0.1], eR: 0.42,
    lLx: -0.12, kL: 0.32, lRx: 0.1, kR: 0.52, lLz: 0.04, lRz: -0.04, fL: 0.55, fR: 0.5,
  }),
  // Flying flat out: ring fist leading (along the body, overhead), free arm back along the side,
  // head lifted to look ahead, legs trailing with one knee bent.
  flyFast: makePose({
    sx: -0.1, cx: -0.08, nx: -0.42, kx: -0.32,
    aR: [-0.12, 0.96, 0.24], eR: 0.06, tR: 0.2,
    aL: [0.22, -0.95, -0.18], eL: 0.22,
    lLx: 0.06, kL: 0.08, lRx: 0.22, kR: 0.62, lLz: 0.03, lRz: -0.05, fL: 0.75, fR: 0.7,
  }),
  // Hard landing: down on one knee, ring fist to the ground, head up.
  land: makePose({
    hy: -0.56, sx: 0.46, cx: 0.16, nx: -0.14, kx: -0.18,
    lLx: -1.3, kL: 1.65, lRx: 0.3, kR: 2.2, fR: -0.55,
    aL: [0.45, -0.7, 0.3], eL: 0.55, aR: [-0.18, -0.82, 0.55], eR: 0.12,
  }),
  wave: makePose({ aR: [-0.55, 0.85, 0.1], eR: 0.6, tR: -0.6, ky: 0.1 }),
};
