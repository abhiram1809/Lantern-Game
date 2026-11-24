// The water round Coast City (2026-11-19; the map rework, 2026-11-24): the Pacific west of it, Coast Bay south, the
// river down its east side, Port Haven's basin and the shipyards' slips, the marina. One sheet at the water's height
// (Terrain.WATER_Y) in tiles only where there's water (fine along the shores, 125 m out at sea), its shader reading
// the terrain's distance field: deep water out, the shallows going green-blue toward a beach, a harbour's murky
// green in the basins and the river, the surf breaking where the swell comes in (the sea's beach most, the bay's
// shores a little, none inside the breakwater), a lip of foam where it laps at a quay, the river's ripples running
// down to the bay; waves in the normal (the long swells and the chop on them), the sky and sun in it.
//
// And the quays: a concrete wall down into the water wherever the shore's a quay (Terrain.shoreKind: the port, the
// marina, the river through town, the bay's sea wall), traced along the shore's line from the terrain's fine grid,
// a coping along its top; their colliders (the heightfield can't stand a wall up: Ferris.roadGround).
import * as THREE from 'three';
import { cityU } from './Kit.js';
import { LOT_Z } from './Plan.js';
import { pbrMaterial } from '../fx/Textures.js';
import { TERRAIN_GLSL, terrainTextures, sdfAt, fineField, freeFine, kindAt, WATER_Y, FINE, QUAY } from './Terrain.js';

const f1 = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------------------------------------ the water
// Its tiles: 125 m where it's all water, 25 m where a shore crosses (and only those with water in them), over the
// city's waters and the sea well out past them (the airspace's sea takes over from altitude: Ferris.airspace).
export const WATER_AREA = { x0: -9000, x1: 4500, z0: -4800, z1: 8800 };
function waterGeometry() {
  const A = WATER_AREA, quads = [], B = 125, S = 25;
  for (let z0 = A.z0; z0 < A.z1; z0 += B) for (let x0 = A.x0; x0 < A.x1; x0 += B) {
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j <= 5; j++) for (let i = 0; i <= 5; i++) { const d = sdfAt(x0 + i * 25, z0 + j * 25); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    if (lo > 30) continue;
    if (hi < -30) { quads.push([x0, z0, B]); continue; }
    for (let zz = z0; zz < z0 + B; zz += S) for (let xx = x0; xx < x0 + B; xx += S) {
      let m = Infinity;
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) m = Math.min(m, sdfAt(xx + i * 6.25, zz + j * 6.25));
      if (m < 4) quads.push([xx, zz, S]);
    }
  }
  const pos = new Float32Array(quads.length * 12), nor = new Float32Array(quads.length * 12), idx = new Uint32Array(quads.length * 6);
  quads.forEach(([x, z, s], k) => {
    pos.set([x, 0, z, x + s, 0, z, x, 0, z + s, x + s, 0, z + s], k * 12);
    nor.set([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], k * 12);
    const a = k * 4;
    idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], k * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

export function cityWater() {
  // (pushed back a little in depth: where a beach goes gently down under it, the sand wins, and doesn't flicker
  // through the water along the line where they meet)
  const mat = new THREE.MeshStandardMaterial({ color: 0x1d4c60, roughness: 0.09, metalness: 0.0, envMapIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4 });
  const tex = terrainTextures();
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tex.uniforms);
    sh.uniforms.uTime = cityU.uTime;
    sh.uniforms.uNight = cityU.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOw;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvOw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOw;
      uniform float uTime; uniform float uNight;
      ${TERRAIN_GLSL}
      float oH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
      float oN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(oH(i), oH(i + vec2(1, 0)), f.x), mix(oH(i + vec2(0, 1)), oH(i + vec2(1, 1)), f.x), f.y); }
      float wSwell = 1.0, wRiver = 0.0; vec2 wFlow = vec2(0.0, -1.0);`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec2 lp = vec2(vOw.x, vOw.z - ${f1(LOT_Z)});
      float sd = tSdf(lp);
      if (sd > 1.5) discard; // (the land's)
      float off = max(0.0, -sd); // metres out from the waterline
      wSwell = tInfo(lp).g; // (the sea's swell, the bay's a third of it, none in the basins and the river)
      // the river: its ripples run down it, across the slope of the distance to its banks
      wRiver = step(1300.0, lp.x) * step(-1000.0, lp.y) * (1.0 - wSwell);
      if (wRiver > 0.5) {
        vec2 g = vec2(tSdf(lp + vec2(3.0, 0.0)) - sd, tSdf(lp + vec2(0.0, 3.0)) - sd);
        vec2 f = vec2(g.y, -g.x);
        wFlow = length(f) > 0.05 ? normalize(f) * (f.y > 0.0 ? -1.0 : 1.0) : vec2(0.0, -1.0);
      }
      // the colour: the open water's blue, a harbour's murky green where it's sheltered, the shallows near a shore (a
      // sandy green-blue toward a beach, wider where the swell's built them)
      vec3 deep = mix(vec3(0.075, 0.16, 0.16), diffuseColor.rgb, wSwell);
      vec3 shoal = mix(vec3(0.12, 0.25, 0.22), vec3(0.2, 0.52, 0.54), wSwell);
      diffuseColor.rgb = mix(shoal, deep, smoothstep(2.0, mix(26.0, 160.0, wSwell), off));
      // the surf: bands of white water running in toward the shore where the swell comes in, and the wash at the sand
      // (broken up along the shore: unbroken, they read as stripes painted on the water)
      float run = fract(off / 26.0 + uTime * 0.075 + oN(lp.yy / 90.0 + lp.xx / 140.0) * 0.8);
      float foam = smoothstep(0.9, 0.99, run) * (1.0 - smoothstep(18.0, 60.0, off)) * smoothstep(0.35, 0.7, oN(vec2((lp.y + lp.x) / 38.0, off / 9.0) + uTime * 0.05)) * (0.5 + 0.5 * oN(vOw.xz / 3.0 + uTime * 0.3));
      foam = max(foam * smoothstep(0.15, 0.6, wSwell), (1.0 - smoothstep(0.0, 3.5 + 2.0 * sin(uTime * 0.6 + (lp.y + lp.x) * 0.05), off)) * 0.85 * smoothstep(0.1, 0.5, wSwell));
      // a quay's lip: a thin froth where the water slaps at the wall, broken
      float lap = (1.0 - smoothstep(0.0, 0.9 + 0.5 * oN(lp * 0.7 + uTime * 0.4), off)) * (0.35 + 0.4 * oN(lp * 2.3 - uTime * 0.8)) * (1.0 - smoothstep(0.1, 0.5, wSwell));
      foam = max(foam, lap);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.95), foam);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // swells from the south-west and the chop over them (a world-space slope, into view space); sheltered water
        // only the chop, and the river's carried down it
        vec2 q = vOw.xz;
        float t = uTime;
        vec2 g = vec2(0.0);
        g += (vec2(0.7, 0.7) * cos(dot(q, vec2(0.7, 0.7)) * 0.045 + t * 0.9) * 0.05 + vec2(-0.3, 0.95) * cos(dot(q, vec2(-0.3, 0.95)) * 0.11 + t * 1.4) * 0.03) * (0.25 + 0.75 * wSwell);
        vec2 qc = mat2(0.866, -0.5, 0.5, 0.866) * (q - wFlow * t * 1.6 * wRiver); // (turned off the noise's lattice: square on, it read as a grid out on the water)
        g += vec2(oN(qc * 0.35 + t * 0.6 * (1.0 - wRiver)) - 0.5, oN(qc * 0.35 - t * 0.5 * (1.0 - wRiver) + 9.0) - 0.5) * mix(0.07, 0.12, wSwell);
        g += vec2(oN(qc * 1.7 + t * 1.3) - 0.5, oN(qc * 1.7 - t * 1.1 + 3.0) - 0.5) * 0.05;
        float fade = 1.0 - smoothstep(60.0, 900.0, length(vOw - cameraPosition)); // (far off, smooth: the chop would only shimmer)
        vec3 nW = normalize(vec3(-g.x * fade, 1.0, -g.y * fade));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        // specular anti-aliasing: where the chop changes faster than a pixel, rougher, so the moon's
        // glint is a soft path on the water and not pixel-sized highlights the bloom turns into blocks
        vec3 dn = fwidth(nW);
        // (by night less: a rough lobe spreads the moon over a whole sheet of the sea)
        roughnessFactor = clamp(sqrt(roughnessFactor * roughnessFactor + 2.2 * dot(dn, dn)), roughnessFactor, mix(0.55, 0.26, uNight));
      }`)
      // and never brighter than a white wall (by night than moonlit foam): the moon's path on the water stays a
      // glint, not a sheet the bloom spreads over the screen (the night fight over the sea looks down on it)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb = min(gl_FragColor.rgb, mix(vec3(0.9), vec3(0.26, 0.3, 0.36), uNight));`);
  };
  mat.customProgramCacheKey = () => 'cityWater';
  const mesh = new THREE.Mesh(waterGeometry(), mat);
  mesh.position.set(0, WATER_Y, LOT_Z);
  mesh.name = 'cityWater';
  mesh.renderOrder = 1; // (after the ground: what's under the land is rejected by its depth)
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// ------------------------------------------------------------------------------------------------ the quays
// The shore's line where it's a quay, traced on the terrain's fine grid (marching squares, the field's zero), each
// run a polyline with the water on its left, thinned where it runs straight.
let RUNS = null;
export function quayRuns() {
  if (RUNS) return RUNS;
  const D = fineField(), G = FINE;
  if (!D) return (RUNS = []);
  const nx = G.nx, nz = G.nz, X = (i) => G.x0 + (i + 0.5) * G.step, Z = (j) => G.z0 + (j + 0.5) * G.step;
  // the crossing on each edge (horizontal: (i, j)-(i+1, j), id 2k; vertical: (i, j)-(i, j+1), id 2k + 1)
  const at = (e) => {
    const k = e >> 1, i = k % nx, j = (k / nx) | 0;
    if (!(e & 1)) { const a = D[k], b = D[k + 1], t = a / (a - b); return { x: X(i) + t * G.step, z: Z(j) }; }
    const a = D[k], b = D[k + nx], t = a / (a - b); return { x: X(i), z: Z(j) + t * G.step };
  };
  const next = new Map(), prev = new Map();
  for (let j = 0; j + 1 < nz; j++) for (let i = 0; i + 1 < nx; i++) {
    const k = j * nx + i, a = D[k], b = D[k + 1], c = D[k + nx + 1], d = D[k + nx];
    const m = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (d < 0 ? 8 : 0); // (water at the corners: a (i,j), b (i+1,j), c (i+1,j+1), d (i,j+1))
    if (m === 0 || m === 15) continue;
    // only where the land's a quay
    const li = a >= 0 ? 0 : b >= 0 ? 1 : c >= 0 ? 2 : 3, lx = X(i + (li === 1 || li === 2 ? 1 : 0)), lz = Z(j + (li >= 2 ? 1 : 0));
    if (kindAt(lx, lz) !== QUAY) continue;
    const eS = 2 * k, eE = 2 * (k + 1) + 1, eN = 2 * (k + nx), eW = 2 * k + 1, mid = (a + b + c + d) / 4;
    // the segments across the cell (which corners each cuts off), then each turned to have the water on its left
    const segs = {
      1: [[eW, eS]], 2: [[eS, eE]], 3: [[eW, eE]], 4: [[eE, eN]], 6: [[eS, eN]], 7: [[eW, eN]], 8: [[eN, eW]],
      9: [[eS, eN]], 11: [[eE, eN]], 12: [[eE, eW]], 13: [[eS, eE]], 14: [[eW, eS]],
      5: mid < 0 ? [[eS, eE], [eN, eW]] : [[eW, eS], [eE, eN]],
      10: mid < 0 ? [[eW, eS], [eE, eN]] : [[eS, eE], [eN, eW]],
    }[m];
    const wet = [[a, X(i), Z(j)], [b, X(i + 1), Z(j)], [c, X(i + 1), Z(j + 1)], [d, X(i), Z(j + 1)]].filter((q) => q[0] < 0);
    for (let [u, v] of segs) {
      const P = at(u), Q = at(v), mx = (P.x + Q.x) / 2, mz = (P.z + Q.z) / 2;
      let w = wet[0];
      for (const q of wet) if (Math.hypot(q[1] - mx, q[2] - mz) < Math.hypot(w[1] - mx, w[2] - mz)) w = q;
      if ((Q.x - P.x) * (w[2] - P.z) - (Q.z - P.z) * (w[1] - P.x) < 0) [u, v] = [v, u];
      next.set(u, v); prev.set(v, u);
    }
  }
  // linked into runs: from each start (no edge before it), or round each loop
  const runs = [], seen = new Set();
  const walk = (start) => {
    const pts = [];
    let e = start;
    while (e !== undefined && !seen.has(e)) { seen.add(e); pts.push(at(e)); e = next.get(e); }
    if (e !== undefined && e === start) pts.push(pts[0]);
    let L = 0;
    for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    if (pts.length < 3 || L < 4) return; // (a corner's sliver)
    const loop = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 0.01;
    if (!loop) { runs.push(simplify(pts, 0.04)); return; }
    // (a loop thinned in two halves: its ends are the same point; none round a speck of land in the water)
    let area = 0;
    for (let i = 0; i + 1 < pts.length; i++) area += pts[i].x * pts[i + 1].z - pts[i + 1].x * pts[i].z;
    if (Math.abs(area) / 2 < 40) return;
    const h = pts.length >> 1;
    runs.push([...simplify(pts.slice(0, h + 1), 0.04), ...simplify(pts.slice(h), 0.04).slice(1)]);
  };
  for (const e of next.keys()) if (!prev.has(e)) walk(e);
  for (const e of next.keys()) if (!seen.has(e)) walk(e);
  RUNS = runs;
  freeFine(); // (traced: the fine field's float copy can go)
  return runs;
}
// Ramer-Douglas-Peucker: the points a polyline needs to stay within `tol` of itself
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(), A = pts[a], B = pts[b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1e-9;
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i].x - A.x) * dz - (pts[i].z - A.z) * dx) / L; if (d > worst) { worst = d; wi = i; } }
    if (worst > tol) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// The walls and their copings, one mesh (its colours tell them apart), in the lot's frame
const COPE = { w: 0.45, h: 0.16, over: 0.05 };
export function quayWalls() {
  const runs = quayRuns();
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const quad = (a, b, c, d, n, uva, uvb, uvc, uvd, cv) => {
    const o = pos.length / 3;
    for (const [p, u] of [[a, uva], [b, uvb], [c, uvc], [d, uvd]]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u[0], u[1]); col.push(cv, cv, cv); }
    idx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
  };
  const bottom = WATER_Y - 4.8, top = 0;
  for (const run of runs) {
    // the inland side's offset line (mitred), and each point's outward (water's) normal
    const n = run.length, closed = Math.hypot(run[0].x - run[n - 1].x, run[0].z - run[n - 1].z) < 0.01;
    const segN = [];
    for (let i = 0; i + 1 < n; i++) { const dx = run[i + 1].x - run[i].x, dz = run[i + 1].z - run[i].z, L = Math.hypot(dx, dz) || 1; segN.push({ x: -dz / L, z: dx / L, L }); } // (left: the water's side)
    const pn = run.map((_, i) => {
      const a = segN[Math.max(0, i - 1)] ?? segN[0], b = segN[Math.min(segN.length - 1, i)];
      const A = closed && i === 0 ? segN[segN.length - 1] : a, B = closed && i === n - 1 ? segN[0] : b;
      let x = A.x + B.x, z = A.z + B.z;
      const l = Math.hypot(x, z) || 1;
      x /= l; z /= l;
      const m = Math.max(0.35, x * B.x + z * B.z);
      return { x, z, m };
    });
    let s = 0;
    for (let i = 0; i + 1 < n; i++) {
      const a = run[i], b = run[i + 1], na = pn[i], nb = pn[i + 1], sn = segN[i], s1 = s + sn.L;
      const out = V(sn.x, 0, sn.z);
      // the wall's face, from the coping's underside down past the bed
      quad(V(a.x, bottom, a.z), V(b.x, bottom, b.z), V(a.x, top - 0.1, a.z), V(b.x, top - 0.1, b.z), out, [s / 3, bottom / 3], [s1 / 3, bottom / 3], [s / 3, (top - 0.1) / 3], [s1 / 3, (top - 0.1) / 3], 0.82);
      // the coping: its outer face (a little over the wall), its top, its inner face down to the quay
      const ao = { x: a.x + na.x * COPE.over / na.m, z: a.z + na.z * COPE.over / na.m }, bo = { x: b.x + nb.x * COPE.over / nb.m, z: b.z + nb.z * COPE.over / nb.m };
      const ai = { x: a.x - na.x * COPE.w / na.m, z: a.z - na.z * COPE.w / na.m }, bi = { x: b.x - nb.x * COPE.w / nb.m, z: b.z - nb.z * COPE.w / nb.m };
      quad(V(ao.x, top - 0.12, ao.z), V(bo.x, top - 0.12, bo.z), V(ao.x, top + COPE.h, ao.z), V(bo.x, top + COPE.h, bo.z), out, [s / 2, 0], [s1 / 2, 0], [s / 2, 0.12], [s1 / 2, 0.12], 1.12);
      quad(V(ao.x, top + COPE.h, ao.z), V(bo.x, top + COPE.h, bo.z), V(ai.x, top + COPE.h, ai.z), V(bi.x, top + COPE.h, bi.z), V(0, 1, 0), [s / 2, 0.2], [s1 / 2, 0.2], [s / 2, 0.45], [s1 / 2, 0.45], 1.18);
      quad(V(ai.x, top + COPE.h, ai.z), V(bi.x, top + COPE.h, bi.z), V(ai.x, top - 0.02, ai.z), V(bi.x, top - 0.02, bi.z), out.clone().negate(), [s / 2, 0.5], [s1 / 2, 0.5], [s / 2, 0.6], [s1 / 2, 0.6], 1.05);
      s = s1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  // concrete, darker and greener down by the water: the wet line the tide leaves, the weed below it, rust streaks
  const mat = pbrMaterial('concrete_floor_02', { repeat: [1, 1], tint: new THREE.Color(0.95, 0.93, 0.9), roughness: 0.95 });
  mat.vertexColors = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vQw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvQw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vQw;
      float qH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float qN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(qH(i), qH(i + vec2(1, 0)), f.x), mix(qH(i + vec2(0, 1)), qH(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float y = vQw.y - ${f1(WATER_Y)}, s = vQw.x + vQw.z;
        float streak = qN(vec2(s * 1.7, vQw.y * 0.25)) * qN(vec2(s * 0.37, 3.1));
        diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.45, 0.85, streak) * step(0.3, y); // (rain's streaks down it)
        float tide = 1.0 - smoothstep(0.35, 0.75 + 0.15 * qN(vec2(s * 0.5, 1.0)), y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.44, 0.36), tide);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.14, 0.08), (1.0 - smoothstep(-0.1, 0.32, y)) * (0.6 + 0.4 * qN(vec2(s * 3.0, y * 6.0))));
      }`);
  };
  mat.customProgramCacheKey = () => 'quayWalls';
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(0, 0, LOT_Z);
  mesh.name = 'quayWalls';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// Their colliders: along each run a strip of quay at the ground's height a few metres in from the edge (where the
// heightfield's cells come down to the bed), and the coping. (Each run's long straights in 14 m pieces at most.)
export function quayColliders(physics) {
  const bodies = [], q = new THREE.Quaternion(), Y = V(0, 1, 0);
  for (const run of quayRuns()) for (let i = 0; i + 1 < run.length; i++) {
    const a = run[i], b = run[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const ux = dx / L, uz = dz / L, inx = dz / L, inz = -dx / L; // (along it; in from it, the land's side)
    q.setFromAxisAngle(Y, Math.atan2(-uz, ux));
    const pieces = Math.ceil(L / 14);
    for (let k = 0; k < pieces; k++) {
      const l = L / pieces, cx = a.x + ux * l * (k + 0.5), cz = a.z + uz * l * (k + 0.5) + LOT_Z;
      bodies.push(physics.fixedBox({ x: cx + inx * 2.6, y: -0.6, z: cz + inz * 2.6 }, { x: l / 2 + 0.15, y: 0.6, z: 2.6 }, q));
      bodies.push(physics.fixedBox({ x: cx + inx * COPE.w / 2, y: COPE.h / 2, z: cz + inz * COPE.w / 2 }, { x: l / 2 + 0.02, y: COPE.h / 2, z: COPE.w / 2 }, q));
    }
  }
  return bodies;
}
