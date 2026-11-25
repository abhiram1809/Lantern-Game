// Page helper (dev server): Hal's neighbourhood from the street, the car and the air, by day and at night, the same
// views every time (the residential streets' rework, 2026-11-24). Free roam in Coast City first
// (tools/perf-probe.js `toCoast()`), the engine paused.
//   const H = await import('/tools/hood-shots.js');
//   await H.shots('before')              // every view at each hour: `before_hood_<view>_<hour>.png` in SHOT_DIR
//   await H.shots('after', { only: ['air'], hours: [10.5] })
//   await H.air()                        // the frame's cost from over the lot (perf-probe's time() and probe())
// (the lot's frame: LOT is (0, 0, 6000) in the world; the views below are world coordinates)
import { stage } from './look-shots.js';

export const HOOD_VIEWS = {
  air: { eye: [150, 115, 5850], at: [20, 0, 6020] }, // over the lot from the south-east, the houses round it
  airEast: { eye: [40, 80, 5940], at: [230, 0, 6080] }, // the streets east of the boulevard, from 80 m
  airHigh: { eye: [-120, 150, 5760], at: [120, 0, 6150] }, // the suburb from 150 m, the hills beyond
  street: { eye: [158, 1.7, 5860], at: [160, 2.2, 6000] }, // walking up a residential street (x 166), houses both sides
  behind: { eye: [93.5, 1.7, 5880], at: [86, 2.4, 5990] }, // the street behind Hal's building (x 86): his blocks' outer half
  drive: { eye: [168.5, 1.25, 5800], at: [168.5, 1.3, 5980] }, // a car's seat down the same street
  corner: { eye: [175, 6, 5786], at: [140, 1, 5830] }, // a corner lot turning its corner, from a third-person height
  lane: { eye: [126, 1.7, 5900], at: [126, 1.8, 5990] }, // the alley between two rows of back yards (block 1,4)
};
export const HOURS = [10.5, 18.6, 23];

const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });

export async function shots(prefix, { only = null, hours = HOURS, settle = 1.5 } = {}) {
  const G = window.__game, s = G.story, r = G.engine.renderer, out = [];
  for (const h of hours) {
    s.dayCycle?.setHour(h);
    s.dayCycle?.setWeather?.('clear', true);
    for (const [k, v] of Object.entries(HOOD_VIEWS)) {
      if (only && !only.includes(k)) continue;
      await stage(v, settle);
      G.engine.paused = true;
      for (let i = 0; i < 6; i++) { G.engine.composer.render(0); await tick(); } // (the occlusion's answers)
      const name = `${prefix}_hood_${k}_${Math.round(h)}`;
      await fetch(`/__shot?name=${name}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
      out.push(name);
    }
  }
  return out;
}

// A house of a style close up, from its street: the nearest lot to Hal's lot of that style (or passing `test`, given
// the lot), from `back` metres out in front of its front line and `side` metres along the street, at eye height
// (`h`); `n` skips that many nearer ones. Saves `<name>.png`; returns the lot's style, garage and cell.
export async function lotShot(name, test, { back = 9, side = 4, h = 1.7, n = 0, hour = 10.5, at = 2.2, settle = 1.2 } = {}) {
  const G = window.__game, s = G.story, C = s.current.city, r = G.engine.renderer;
  const pass = typeof test === 'string' ? (L) => L.style === test : test, lots = [];
  for (const c of C.index.cells) for (const L of c.lots ?? []) if (pass(L, c)) lots.push({ L, c, d: Math.hypot(L.O.x + L.A.x * L.u0 - 6, L.O.z + L.A.z * L.u0) });
  lots.sort((a, b) => a.d - b.d);
  const hit = lots[n];
  if (!hit) return null;
  const { L, c } = hit, P = (u, v, y) => [L.O.x + L.A.x * u + L.N.x * v, y, L.O.z + L.A.z * u + L.N.z * v + 6000];
  const uc = L.hu0 + L.hw / 2;
  s.dayCycle?.setHour(hour);
  await stage({ eye: P(uc + side, -back, (L.y ?? 0) + h), at: P(uc, L.setback + 1, (L.y ?? 0) + at) }, settle);
  G.engine.paused = true;
  for (let i = 0; i < 6; i++) { G.engine.composer.render(0); await tick(); }
  await fetch(`/__shot?name=${name}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
  return { style: L.style, g: L.g, cell: c.id, u0: L.u0, porch: L.porch?.kind, roof: L.house?.roof, ridge: L.house?.ridge, wing: !!L.wing, front: L.front };
}

// The frame's cost from over the lot, by day and at 11 PM: CPU and GPU together (perf-probe's time()), and the draws
export async function air({ views = ['air', 'airHigh', 'street'], hours = [10.5, 23] } = {}) {
  const G = window.__game, s = G.story, p = await import('./perf-probe.js'), out = {};
  for (const h of hours) for (const k of views) {
    s.dayCycle?.setHour(h);
    s.dayCycle?.setWeather?.('clear', true);
    await stage(HOOD_VIEWS[k], 2);
    G.engine.paused = true;
    for (let i = 0; i < 8; i++) { G.engine.composer.render(0); await tick(); }
    const pr = p.probe({ top: 1 });
    out[`${k} ${h}`] = { ms: p.time(20), calls: pr.calls, staticCalls: pr.staticCalls, shadowCalls: pr.shadowCalls, staticShadow: pr.staticShadow, tris: pr.tris, shadowTris: pr.shadowTris, geometries: G.engine.renderer.info.memory.geometries };
  }
  return out;
}
