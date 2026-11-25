// Page helper (dev server): the same views measured the same way, for comparing two builds one after the other in
// one tab (the residential streets' rework: the old city code checked out, then the new). Free roam in Coast City
// first (tools/perf-probe.js `toCoast()`). Each view: its draws by the scene's top-level groups, main and shadow,
// and the frame's time (the minimum of a few runs: the GPU is shared with whatever else is running).
//   const A = await import('/tools/hood-ab.js'); await A.measure('old')   // kept in localStorage gl_ab
//   A.compare('old', 'new')
import { stage } from './look-shots.js';
import { HOOD_VIEWS } from './hood-shots.js';
import { BENCH, probe, time } from './perf-probe.js';

const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
export const VIEWS = {
  'street 11 PM': { ...BENCH[1] }, 'car by day': { ...BENCH[2] }, 'downtown 6 PM': { ...BENCH[0] },
  'air 10.5': { ...HOOD_VIEWS.air, hour: 10.5 }, 'air 23': { ...HOOD_VIEWS.air, hour: 23 }, 'airHigh 10.5': { ...HOOD_VIEWS.airHigh, hour: 10.5 },
  'hood street 10.5': { ...HOOD_VIEWS.street, hour: 10.5 }, 'hood street 23': { ...HOOD_VIEWS.street, hour: 23 }, 'behind 10.5': { ...HOOD_VIEWS.behind, hour: 10.5 },
};
export async function measure(label, { views = Object.keys(VIEWS), runs = 3 } = {}) {
  const G = window.__game, s = G.story, out = {};
  for (const k of views) {
    const v = VIEWS[k];
    s.dayCycle?.setHour(v.hour);
    s.dayCycle?.setWeather?.('clear', true);
    await stage(v, 2.5);
    G.engine.paused = true;
    for (let i = 0; i < 10; i++) { G.engine.composer.render(0); await tick(); }
    const p = probe({ top: 40, by: 'root' }), ms = [];
    for (let i = 0; i < runs; i++) { ms.push(time(12)); await tick(); }
    out[k] = { ms: Math.min(...ms), calls: p.calls, static: p.staticCalls, shadow: p.shadowCalls, tris: p.tris, shadowTris: p.shadowTris,
      roots: Object.fromEntries(p.list.map((x) => [x.key, `${x.calls}|${x.shadowCalls} ${x.tris}`])), geometries: G.engine.renderer.info.memory.geometries, textures: G.engine.renderer.info.memory.textures };
  }
  const all = JSON.parse(localStorage.gl_ab ?? '{}');
  all[label] = out;
  localStorage.gl_ab = JSON.stringify(all);
  return out;
}
export function compare(a, b) {
  const all = JSON.parse(localStorage.gl_ab ?? '{}'), A = all[a], B = all[b], rows = [];
  for (const k of Object.keys(A ?? {})) {
    const x = A[k], y = B?.[k];
    if (!y) continue;
    rows.push(`${k}: ms ${x.ms} -> ${y.ms}, calls ${x.calls} -> ${y.calls} (static ${x.static} -> ${y.static}), shadow ${x.shadow} -> ${y.shadow}, tris ${x.tris} -> ${y.tris}, shadowTris ${x.shadowTris} -> ${y.shadowTris}`);
    const keys = new Set([...Object.keys(x.roots), ...Object.keys(y.roots)]);
    for (const r of keys) if (x.roots[r] !== y.roots[r]) rows.push(`    ${r}: ${x.roots[r] ?? '-'} -> ${y.roots[r] ?? '-'}`);
  }
  return rows.join('\n');
}
