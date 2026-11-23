// Page helper (dev server): what each thing in the frame costs. Renders one frame with every draw call
// counted, the main pass and the shadow pass apart, and lists the biggest by triangles.
//   const p = await import('/tools/perf-probe.js');
//   p.probe()                 // the top 25 draws by what's drawn (the mesh's name, its nearest named parents)
//   p.probe({ by: 'root' })   // by the scene's top-level groups
//   p.probe({ by: 'material' })
//   await p.toCoast(); p.time()  // free roam on Hal's street; a frame's length in ms
//   await p.palmPair('a', 3)     // a palm as the tree and as its cards
// Each row: draw calls and triangles in the main pass, then in the shadow pass.
const named = (o) => { const out = []; for (let p = o; p && out.length < 3; p = p.parent) if (p.name && !p.isScene) out.push(p.name); return out.join(' < ') || o.type; };
const root = (o) => { let p = o; while (p.parent && !p.parent.isScene) p = p.parent; return p.name || p.type; };
// what moves on its own and so varies run to run: people (skinned) and traffic's cars (city/Traffic.js marks them `away`)
const moving = (o) => { if (o.isSkinnedMesh) return true; for (let p = o; p; p = p.parent) if (p.userData && 'away' in p.userData) return true; return false; };

export function probe({ by = 'name', top = 25 } = {}) {
  const G = window.__game, r = G.engine.renderer, info = r.info, sm = r.shadowMap;
  const rows = new Map();
  let pass = 'main';
  const draw = r.renderBufferDirect, shadows = sm.render;
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    const t = info.render.triangles;
    draw.call(this, camera, scene, geometry, material, object, group);
    const key = by === 'root' ? root(object) : by === 'material' ? `${material.name || material.type}${material.map?.name ? ` (${material.map.name})` : ''}` : `${named(object)}${object.isInstancedMesh ? ` ×${object.count}` : ''}`;
    const row = rows.get(key) ?? { key, calls: 0, tris: 0, shadowCalls: 0, shadowTris: 0, dynCalls: 0, dynShadow: 0 };
    if (pass === 'main') { row.calls++; row.tris += info.render.triangles - t; } else { row.shadowCalls++; row.shadowTris += info.render.triangles - t; }
    if (moving(object)) row[pass === 'main' ? 'dynCalls' : 'dynShadow']++;
    rows.set(key, row);
  };
  sm.render = function (...args) { pass = 'shadow'; try { return shadows.apply(this, args); } finally { pass = 'main'; } };
  sm.needsUpdate = true;
  try { G.engine.composer.render(0); } finally { r.renderBufferDirect = draw; sm.render = shadows; }
  const all = [...rows.values()];
  const sum = (k) => all.reduce((s, x) => s + x[k], 0);
  const list = all.sort((a, b) => b.tris + b.shadowTris - (a.tris + a.shadowTris)).slice(0, top)
    .map((x) => ({ ...x, tris: Math.round(x.tris / 1e3) + ' k', shadowTris: Math.round(x.shadowTris / 1e3) + ' k' }));
  return { calls: sum('calls'), tris: Math.round(sum('tris') / 1e3) + ' k', shadowCalls: sum('shadowCalls'), shadowTris: Math.round(sum('shadowTris') / 1e3) + ' k', staticCalls: sum('calls') - sum('dynCalls'), staticShadow: sum('shadowCalls') - sum('dynShadow'), list };
}

// the same, as text lines (easier to read back from a tool)
export function table(opts) {
  const p = probe(opts);
  return [`main ${p.calls} calls ${p.tris} · shadow ${p.shadowCalls} calls ${p.shadowTris}`,
    ...p.list.map((x) => `${String(x.calls).padStart(4)} ${x.tris.padStart(7)} | ${String(x.shadowCalls).padStart(4)} ${x.shadowTris.padStart(7)}  ${x.key}`)].join('\n');
}

// how long a frame takes to draw, CPU and GPU together: `n` renders, each waited on (a pixel read back),
// the median in ms (the engine paused first, so only these frames draw)
export function time(n = 15) {
  const G = window.__game, gl = G.engine.renderer.getContext(), px = new Uint8Array(4), ms = [];
  for (let i = 0; i < n + 2; i++) {
    const t0 = performance.now();
    G.engine.composer.render(0);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (i >= 2) ms.push(performance.now() - t0);
  }
  ms.sort((a, b) => a - b);
  return Math.round(ms[ms.length >> 1] * 10) / 10;
}

// From the title (`/?r=1#world`, free roam): Continue, then travel to Hal's street and let the city stream in;
// the engine left paused.
export async function toCoast() {
  const b = await import('./sapphire-end-bot.js');
  const s = await b.boot('world');
  s.goTo('coast');
  await b.until(() => s.roam.where === 'coast' && !s.busy && s.player.control && s.player.rb && !/Space|Hyperspace/.test(s.current?.constructor?.name ?? ''), 40);
  await b.steps(8);
  s.engine.paused = true;
  return s;
}

// A palm seen as the tree and as its cards (city/Palms.js), from `dist` m away at height `h`, `az` round it,
// through a `fov`° lens: `<name>_hi.png` and `<name>_lo.png` in SHOT_DIR. `tree`: its index in the field.
export async function palmPair(name, tree, { dist = 100, h = 1.7, fov = 30, az = 0 } = {}) {
  const G = window.__game, cam = G.engine.camera, P = G.story.current.palms, t = [...P.trees.values()][tree], c = t.p;
  const keep = { fov: cam.fov, p: cam.position.clone(), q: cam.quaternion.clone(), near: P.near };
  cam.fov = fov;
  cam.position.set(c.x + Math.sin(az) * dist, h, c.z + Math.cos(az) * dist);
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  for (const [k, near] of [['hi', 1e9], ['lo', 0]]) {
    P.near = near; P.dirty = true; P.update(cam);
    G.engine.composer.render(0);
    await fetch(`/__shot?name=${name}_${k}`, { method: 'POST', body: G.engine.renderer.domElement.toDataURL('image/png') });
  }
  P.near = keep.near; P.dirty = true;
  cam.fov = keep.fov; cam.position.copy(keep.p); cam.quaternion.copy(keep.q); cam.updateProjectionMatrix();
  return t.kind;
}

// The polish pass's benchmark (the user's brief, 2026-11-23): four views, each at its hour, the same buffer
// (localStorage gl_res 1.5 at a 1024×640 pane: 1536×960), the scene settled 2 s there, then 20 frames each
// waited on (the median: CPU and GPU together, FPS from it), the draw calls and triangles of one frame (the
// shadow pass's share apart) and the renderer's geometries and textures. Kept in localStorage `gl_bench`
// by label, so a run after a reload can be compared: `deltas(['baseline', 'step1'])`.
export const BENCH = [
  { key: 'downtown 6 PM', place: 'coast', hour: 17.9, eye: [-200, 140, 6300], at: [-560, 40, 6660] },
  { key: 'street 11 PM', place: 'coast', hour: 23, eye: [2, 1.8, 5960], at: [6, 3, 5800] },
  { key: 'car by day', place: 'coast', hour: 10.5, eye: [12.4, 1.3, 5945], at: [9.3, 0.6, 5935] },
  { key: 'Korugar plaza', place: 'korugar', eye: [0, 1.8, -46], at: [0, 8, 30] },
  { key: 'downtown 11 PM', place: 'coast', hour: 23, eye: [-200, 140, 6300], at: [-560, 40, 6660] }, // (the windows' bloom)
];
export async function bench(label, { views = BENCH } = {}) {
  const G = window.__game, L = await import('./look-shots.js'), b = await import('./sapphire-end-bot.js'), r = G.engine.renderer;
  const out = {};
  for (const v of views) {
    const s = G.story;
    // (arrived: in the place's own scene, not only named there with control: that's so all through the voyage, and
    // the space scene has physics of its own)
    const there = () => s.roam.where === v.place && !s.busy && s.player.control && s.player.rb && !/Space|Hyperspace/.test(s.current?.constructor?.name ?? '');
    if (s.roam?.where !== v.place) { s.goTo(v.place); await b.until(there, 60); await b.steps(0.5); }
    if (v.hour != null) { s.dayCycle?.setHour(v.hour); s.dayCycle?.setWeather?.('clear', true); }
    s.current.night?.(false);
    await L.stage(v, 2);
    G.engine.paused = true;
    // (frames drawn with the browser let in between: the occlusion queries' answers only come after a task)
    for (let i = 0; i < 8; i++) { G.engine.composer.render(0); await new Promise((res) => setTimeout(res, 0)); }
    const ms = time(20), p = probe({ top: 1 }), m = r.info.memory;
    out[v.key] = { ms, fps: Math.round(1000 / ms), calls: p.calls, staticCalls: p.staticCalls, shadowCalls: p.shadowCalls, staticShadow: p.staticShadow, tris: p.tris, shadowTris: p.shadowTris, geometries: m.geometries, textures: m.textures };
    G.engine.composer.render(0);
    await fetch(`/__shot?name=bench_${label}_${v.key.replace(/\W+/g, '_')}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
  }
  const all = JSON.parse(localStorage.gl_bench ?? '{}');
  all[label] = out;
  localStorage.gl_bench = JSON.stringify(all);
  return deltas([label]);
}
// a table of the labelled runs side by side, each view's numbers as `first -> … -> last`
export function deltas(labels) {
  const all = JSON.parse(localStorage.gl_bench ?? '{}'), rows = [];
  const keys = ['ms', 'fps', 'calls', 'staticCalls', 'shadowCalls', 'staticShadow', 'tris', 'shadowTris', 'geometries', 'textures'];
  for (const v of BENCH) {
    rows.push(`${v.key}`);
    for (const k of keys) rows.push(`  ${k.padEnd(12)} ${labels.map((l) => all[l]?.[v.key]?.[k] ?? '–').join('  ->  ')}`);
  }
  return `${labels.join(' -> ')}\n${rows.join('\n')}`;
}

// The frame's draws by the system that makes them (the street's: which to batch first). Main pass and shadow
// pass apart; `moving` (traffic, people) apart from the rest.
export function systems() {
  const G = window.__game, r = G.engine.renderer, info = r.info, draw = r.renderBufferDirect, sm = r.shadowMap, sr = sm.render, rows = new Map();
  let pass = 'main';
  const kind = (o, mat) => {
    if (moving(o)) return o.isSkinnedMesh ? 'people (moving)' : 'traffic (moving)';
    const chain = []; for (let q = o; q && !q.isScene; q = q.parent) chain.push(q);
    const names = chain.map((q) => q.name);
    const top = chain.at(-1);
    if (chain.some((q) => q.userData?.wheels)) return 'parked cars';
    if (names.includes('halsBlock')) {
      if (o.name.startsWith('city_')) return `halsBlock merged (${o.name})`.replace(/\d+\)$/, ')');
      if (o.isInstancedMesh) return 'halsBlock instanced props';
      if (names.includes('night') || mat.blending === 2) return 'halsBlock night';
      return 'halsBlock objects';
    }
    if (top?.name === 'city') {
      const blk = names.find((n) => n.startsWith('block '));
      if (blk) { const sub = chain[chain.indexOf(chain.find((q) => q.name === blk)) - 1]; const i = sub ? sub.parent.children.indexOf(sub) : -1; return `stream block ${['far', 'near', 'kit', 'night'][i] ?? '?'}`; }
      return `city: ${names.at(-2) ?? o.name}`;
    }
    if (o.isSprite) return 'sprites';
    return `other: ${top?.name || top?.type} ${o.isInstancedMesh ? 'inst' : ''}`.trim();
  };
  r.renderBufferDirect = function (cam, sc, geo, mat, obj) {
    const t = info.render.triangles; draw.apply(this, arguments);
    const k = kind(obj, mat), e = rows.get(k) ?? rows.set(k, { k, calls: 0, tris: 0, sh: 0, shTris: 0 }).get(k);
    if (pass === 'main') { e.calls++; e.tris += info.render.triangles - t; } else { e.sh++; e.shTris += info.render.triangles - t; }
  };
  sm.render = function (...a) { pass = 'shadow'; try { return sr.apply(this, a); } finally { pass = 'main'; } };
  sm.needsUpdate = true;
  try { G.engine.composer.render(0); } finally { r.renderBufferDirect = draw; sm.render = sr; }
  const list = [...rows.values()].sort((a, b) => b.calls + b.sh - a.calls - a.sh);
  return list.map((e) => `${String(e.calls).padStart(5)} ${String(Math.round(e.tris / 1e3)).padStart(6)}k | ${String(e.sh).padStart(4)} ${String(Math.round(e.shTris / 1e3)).padStart(6)}k  ${e.k}`).join('\n');
}
