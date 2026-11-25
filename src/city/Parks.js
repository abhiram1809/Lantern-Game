// Coast City's green (the map rework, 2026-11-24): the materials the gardens, parks and hills share (the lawns, the
// decomposed-granite paths, the plazas' pavers, a leafier hedge, the pools' water and the fountains' falling water),
// the city's trees in one field (`TreeField`: every oak, cypress and bush, three detail levels each), Coast Park
// laid out as one park across its 24 blocks (city/Layout.js PARKS: the fountain where the boulevard's line meets the
// old 1070 street's, the reflecting canal from downtown's side, the bandstand, the playground, the pond, the lawns
// climbing the hills' foot) and downtown's three plazas.
//
// Everything is in the lot's frame (as Plan.js and Layout.js), and stands on the ground as Layout.js has it
// (`groundAt`): the park's east side climbs the hills' foot. Coast Park's lawns, paths, water and trees are built
// once and always drawn (the ground, seen from anywhere: in the city's batches, no draw calls of their own); what
// stands in it (the fountain, the bandstand, the benches and lamps, the colliders) is built with the block it's in,
// as the streamed blocks are (Stream.js `buildCell` calls `coastParkCell`).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial } from '../fx/Textures.js';
import { foliageMaterial } from '../fx/Trees.js';
import { box, metreUV } from './Building.js';
import { PARKS, groundAt, smooth, nearest, inPoly } from './Layout.js';
import { streetX, STREET_Z, seeded } from './Plan.js';
import { cityU } from './Kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const I = new THREE.Matrix4();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _Y = V(0, 1, 0), _v = V(0, 0, 0);
export const COAST = PARKS.find((p) => p.id === 'coast');
const hash = (x) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };

// ------------------------------------------------------------------------------------------------ materials
const NOISE = /* glsl */`
float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), f.x), mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
// world position into the fragment shader (as `vPw`)
const worldPos = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPw;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
    #ifdef USE_BATCHING
      vPw = (modelMatrix * batchingMatrix * vec4(transformed, 1.0)).xyz;
    #else
      vPw = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vPw;\n${NOISE}`);
};

// The materials the green adds to the city's (Kit.js cityMaterials), by the batches' keys
export function greenMaterials(mats) {
  // a Southern California lawn: dusty, mottled green, drier in patches, the sand's grain under it (its texture's
  // light and dark), the mower's stripes faint; a vertex colour tints it (a lot's own, a park's)
  const lawn = pbrMaterial('gravelly_sand', { repeat: [1 / 0.9, 1 / 0.9], normalScale: 1.6 });
  Object.assign(lawn, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  lawn.onBeforeCompile = (sh) => {
    worldPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      {
        vec4 tx = texture2D(map, vMapUv), tx2 = texture2D(map, vMapUv * 0.23 + 0.37);
        float lum = dot(tx.rgb, vec3(0.333)), lum2 = dot(tx2.rgb, vec3(0.333));
        vec2 q = vPw.xz;
        float n = pNoise(q / 13.0) * 0.5 + pNoise(q / 3.7) * 0.3 + pNoise(q * 0.9) * 0.2;
        float dry = smoothstep(0.4, 0.82, n + (lum2 - 0.45) * 0.6);
        // (blades: a fine speckle of light and dark, faded to its average with distance)
        float sp = pHash(floor(q * 16.0)) * 0.6 + pHash(floor(q * 5.0) + 3.1) * 0.4, far = smoothstep(6.0, 45.0, length(vViewPosition));
        vec3 g = mix(vec3(0.07, 0.108, 0.036), vec3(0.18, 0.16, 0.08), dry);
        g *= (0.5 + 1.0 * lum) * mix(0.72 + 0.56 * sp, 1.0, far);
        g = mix(g, vec3(dot(g, vec3(0.3, 0.59, 0.11))), 0.12); // (a touch less saturated: the sun bleaches it)
        g *= 0.97 + 0.03 * step(0.5, fract(q.x / 5.0 + 0.5 * step(0.5, fract(q.y / 60.0))));
        diffuseColor.rgb *= g;
      }`);
  };
  lawn.onBeforeCompile = ((prev) => (sh) => {
    prev(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec2 q2 = vPw.xz * 9.0; float fade = 1.0 - smoothstep(4.0, 30.0, length(vViewPosition));
        normal = normalize(normal + fade * 0.35 * vec3(pHash(floor(q2)) - 0.5, 0.0, pHash(floor(q2) + 7.3) - 0.5)); }`);
  })(lawn.onBeforeCompile);
  lawn.customProgramCacheKey = () => 'cityLawn';
  mats.lawn = lawn;
  // decomposed granite: the parks' and the hills' walks, tan and gritty
  const gravel = pbrMaterial('gravelly_sand', { repeat: [1 / 1.8, 1 / 1.8], tint: new THREE.Color(1.02, 0.98, 0.9), normalScale: 0.8 });
  gravel.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.45) * vec3(1.12, 1.06, 0.95);'); };
  gravel.customProgramCacheKey = () => 'cityGravel';
  Object.assign(gravel, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -5 });
  mats.gravel = gravel;
  // the plazas' and the promenades' pavers (the pavement's concrete, laid in slabs: a darker joint every 1.2 m)
  const pavers = pbrMaterial('concrete_pavement', { repeat: [1 / 2.4, 1 / 2.4], tint: new THREE.Color(1.12, 1.07, 1.0) });
  Object.assign(pavers, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -7 });
  pavers.onBeforeCompile = (sh) => {
    worldPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 q = vPw.xz / 1.2, f = abs(fract(q) - 0.5), w = fwidth(q);
        float joint = 1.0 - smoothstep(0.47 - w.x, 0.5, max(f.x, f.y)) * (1.0 - smoothstep(0.2, 0.6, max(w.x, w.y)));
        diffuseColor.rgb *= mix(0.78, 1.0, joint) * (0.93 + 0.1 * pHash(floor(q)));
      }`);
  };
  pavers.customProgramCacheKey = () => 'cityPavers';
  mats.pavers = pavers;
  // hedges and shrubs cut square: the leaves' light and dark, and a bumpy normal from the same noise
  const hedge = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  hedge.onBeforeCompile = (sh) => {
    worldPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float hn = pNoise(vPw.xz * 3.1 + vPw.y * 2.3) * 0.6 + pNoise(vPw.zy * 7.3 + vPw.x) * 0.4;
      diffuseColor.rgb *= 0.62 + 0.75 * hn;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = normalize(normal + 0.55 * vec3(pNoise(vPw.yz * 6.0) - 0.5, pNoise(vPw.xz * 6.0 + 3.0) - 0.5, pNoise(vPw.xy * 6.0 + 7.0) - 0.5));`);
  };
  hedge.customProgramCacheKey = () => 'cityHedge';
  mats.hedge = hedge;
  // the pools' and the fountains' water: a ripple in its normal, the sky in it
  const water = new THREE.MeshStandardMaterial({ color: 0x1d3f44, roughness: 0.1, metalness: 0, envMapIntensity: 0.55, vertexColors: true });
  water.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityU.uTime;
    worldPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec2 q = vPw.xz;
        float a = sin(q.x * 1.9 + uTime * 1.3) + sin(q.y * 2.3 - uTime * 1.1) + 0.6 * sin((q.x + q.y) * 4.1 + uTime * 2.2);
        float b = cos(q.x * 2.1 - uTime * 0.9) + cos(q.y * 1.7 + uTime * 1.4) + 0.6 * cos((q.x - q.y) * 3.7 - uTime * 1.9);
        float fade = 1.0 - smoothstep(20.0, 90.0, length(vViewPosition));
        normal = normalize(normal + vec3(a, 0.0, b) * 0.045 * fade * (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).y);
      }`);
  };
  water.customProgramCacheKey = () => 'cityWater';
  mats.water = water;
  // falling water: a fountain's sheets and jets, streaks running down (its uv's v up the sheet)
  const spray = new THREE.MeshBasicMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
  spray.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSu;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSu = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vSu;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      {
        float x = vSu.x * 30.0, i0 = floor(x), f = smoothstep(0.0, 1.0, fract(x));
        float ph = mix(fract(sin(i0 * 12.9898) * 43758.5453), fract(sin((i0 + 1.0) * 12.9898) * 43758.5453), f);
        ph = mix(ph, 0.5, clamp(fwidth(x) * 1.5, 0.0, 1.0)); // (a pattern finer than a pixel is its average: no moire)
        float st = 0.5 + 0.5 * sin((vSu.y * (3.0 + 2.0 * ph) + uTime * (1.8 + ph) + ph * 6.0) * 6.2832);
        st = mix(st, 0.5, clamp(fwidth(vSu.y * 4.0) * 1.5, 0.0, 1.0));
        diffuseColor.a *= (0.45 + 0.55 * st) * (0.65 + 0.35 * ph) * (0.75 + 0.5 * (1.0 - smoothstep(0.0, 0.3, vSu.y))); // (whiter where it lands)
      }`);
  };
  spray.customProgramCacheKey = () => 'citySpray';
  mats.spray = spray;
  // bronze (the plazas' monuments)
  mats.bronze = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.8, color: 0x8a6a3c });
  return mats;
}

// ------------------------------------------------------------------------------------------------ geometry
// a surface over a rectangle of the ground, `lift` above it, in cells about `step` metres (one cell where it's
// flat: a park's lawns are mostly level), uvs in metres
export function drape(x0, z0, x1, z1, lift = 0.04, step = 4, y = groundAt) {
  let flat = true;
  for (let x = x0; x <= x1 + 0.01 && flat; x += Math.min(step, x1 - x0) || 1) for (let z = z0; z <= z1 + 0.01; z += Math.min(step, z1 - z0) || 1) if (y(x, z) > 0.005) { flat = false; break; }
  const nx = flat ? 1 : Math.max(1, Math.ceil((x1 - x0) / step)), nz = flat ? 1 : Math.max(1, Math.ceil((z1 - z0) / step));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, (flat ? 0 : y(x, z)) + lift); uv.setXY(i, x, z); }
  g.computeVertexNormals();
  return g;
}
// a ribbon along a polyline ({ x, z }), `half` wide either side, on the ground `lift` above it; uvs in metres
export function ribbon(line, half, lift = 0.07, y = groundAt, across = 2) {
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], p = line[i];
    let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i > 0) s += Math.hypot(p.x - line[i - 1].x, p.z - line[i - 1].z);
    for (let k = 0; k <= across; k++) {
      const t = -1 + (2 * k) / across, x = p.x - dz * half * t, z = p.z + dx * half * t;
      pos.push(x, (p.y ?? y(x, z)) + lift, z);
      uv.push(half * t, s);
    }
  }
  const n = across + 1;
  for (let i = 0; i + 1 < line.length; i++) for (let k = 0; k < across; k++) { const a = i * n + k, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (faces up whichever way the line runs)
  if (g.attributes.normal.getY(0) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; g.computeVertexNormals(); }
  return g;
}
// a disc (or a ring from r0) on the ground
export function disc(cx, cz, r, lift = 0.1, r0 = 0, seg = 48, y = groundAt) {
  const g = new THREE.RingGeometry(Math.max(r0, 0.01), r, seg, 3).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, y(x, z) + lift); uv.setXY(i, x, z); }
  g.computeVertexNormals();
  return g;
}
export const cyl = (r0, r1, h, x, y, z, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y + h / 2, z);
export const lathe = (pts, x, y, z, seg = 40) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg).translate(x, y, z);
// a box turned about y by `yaw`, its middle at (x, y0.., z): for walls along a line
export function boxAt(x, z, y0, y1, len, thick, yaw) {
  const g = box(-len / 2, y0, -thick / 2, len / 2, y1, thick / 2);
  g.rotateY(yaw).translate(x, 0, z);
  return g;
}
// Walls along a polyline, a segment every `seg` metres, standing on the ground (each its own height): into the
// batch, and their colliders into ctx.solids
export function wallAlong(ctx, line, { h = 0.55, thick = 0.4, key = 'concrete', color = 0xd8cfbf, cap = 0xe8e0d2, seg = 6, gaps = [], y = groundAt, solid = true, capKey = 'concrete' } = {}) {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / seg));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, x0 = a.x + (b.x - a.x) * t0, z0 = a.z + (b.z - a.z) * t0, x1 = a.x + (b.x - a.x) * t1, z1 = a.z + (b.z - a.z) * t1;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (gaps.some((g) => Math.hypot(mx - g.x, mz - g.z) < g.r)) continue;
      const yaw = Math.atan2(-(z1 - z0), x1 - x0), len = Math.hypot(x1 - x0, z1 - z0) + 0.02;
      const g0 = Math.min(y(x0, z0), y(x1, z1), y(mx, mz)) - 0.3, top = Math.max(y(x0, z0), y(x1, z1)) + h;
      ctx.batch.add(key, boxAt(mx, mz, g0, top, len, thick, yaw), I, color);
      if (cap != null) ctx.batch.add(capKey, boxAt(mx, mz, top, top + 0.08, len + 0.04, thick + 0.12, yaw), I, cap);
      if (solid) ctx.solids.push({ c: V(mx, (g0 + top + 0.08) / 2, mz), half: V(len / 2, (top + 0.08 - g0) / 2, thick / 2 + 0.06), q: new THREE.Quaternion().setFromAxisAngle(_Y, yaw) });
    }
  }
}

// ------------------------------------------------------------------------------------------------ the trees
// Tree geometry at unit height: a trunk and a crown of lumps (fx/Trees.js broadleaf's way), `detail` the lumps'
let rs = 1;
const rand = () => ((rs = (rs * 16807) % 2147483647) - 1) / 2147483646;
function colorize(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); c.set(fn(_v), i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function mergeParts(parts) {
  return mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k); return n; }));
}
function trunkGeo(h, r, segs, top = 0.55) {
  const g = new THREE.CylinderGeometry(r * top, r, h, segs, 1, true).translate(0, h / 2, 0);
  return colorize(g, (v) => { const k = 0.55 + 0.3 * (v.y / h); return [0.15 * k, 0.12 * k, 0.095 * k]; });
}
// a crown of `lumps` lumps between y0 and y1 of the unit height, `spread` out from the trunk. Its normals point out
// from the crown's middle (bent up a little), so it shades as one soft, round mass rather than as facets; each lump a
// shade of its own, darker toward the crown's underside and its inside (the light the leaves keep from each other)
function crown({ lumps, detail, y0 = 0.55, y1 = 0.93, spread = 0.2, r0 = 0.11, r1 = 0.19, seed = 1, sx = 1, green = [0.075, 0.11, 0.042], column = false }) {
  rs = seed * 7919 + 3;
  const parts = [], cy = (y0 + y1) / 2, ext = Math.max(spread * sx + r1, (y1 - y0) / 2 + r1);
  for (let i = 0; i < lumps; i++) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(r0 + rand() * (r1 - r0), detail));
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      _v.fromBufferAttribute(p, k);
      _v.multiplyScalar(0.74 + 0.4 * hash(Math.round(_v.x * 40) * 13 + Math.round(_v.y * 40) * 7 + Math.round(_v.z * 40) * 3 + i));
      p.setXYZ(k, _v.x * sx, _v.y, _v.z * sx);
    }
    const a = rand() * Math.PI * 2, r = spread * (0.25 + 0.75 * rand()), shade = 0.82 + 0.36 * rand();
    // (a column's lumps stacked evenly up it, each a little off its place: scattered at random they left gaps, and a
    // lump hung over the rest of a cypress on its own, seen from an alley)
    const at = column ? (i + 0.5 + (rand() - 0.5) * 0.7) / lumps : rand();
    g.translate(Math.cos(a) * r * sx, y0 + at * (y1 - y0), Math.sin(a) * r * sx);
    g.computeVertexNormals();
    const n = g.attributes.normal, P = g.attributes.position, c = new Float32Array(P.count * 3), d = V(0, 0, 0);
    for (let k = 0; k < P.count; k++) {
      _v.fromBufferAttribute(P, k);
      d.set(_v.x, column ? 0 : (_v.y - cy) * 0.85, _v.z);
      const out = d.length() / ext;
      d.normalize().multiplyScalar(0.8).add(V(0, column ? 0.3 : 0.42, 0));
      _v.fromBufferAttribute(n, k).multiplyScalar(0.3).add(d).normalize();
      n.setXYZ(k, _v.x, _v.y, _v.z);
      const hgt = Math.min(1, Math.max(0, (P.getY(k) - y0 + 0.08) / (y1 - y0 + 0.16)));
      const kk = shade * (0.42 + 0.58 * hgt) * (0.55 + 0.6 * Math.min(1, out)) * (0.92 + 0.16 * hash(k * 1.37 + i));
      c.set([green[0] * kk * 1.6, green[1] * kk * 1.6, green[2] * kk * 1.6], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  }
  return parts;
}
// The kinds, their detail levels (geometry, how far it's drawn) and the level whose shape casts the near ones' shadows
function treeKinds() {
  const oak = (lumps, detail, segs) => mergeParts([trunkGeo(0.45, 0.035, segs), ...crown({ lumps, detail, seed: 8 })]);
  // an Italian cypress: a tall column of dark lumps, close to the trunk
  const cypress = (lumps, detail) => mergeParts([trunkGeo(0.2, 0.02, 5), ...crown({ lumps, detail, y0: 0.15, y1: 0.86, spread: 0.035, r0: 0.07, r1: 0.1, seed: 3, green: [0.05, 0.08, 0.045], column: true })]);
  // a bush (unit height: it's scaled to a metre or two): lumps from the ground up
  const shrub = (lumps, detail) => mergeParts(crown({ lumps, detail, y0: 0.32, y1: 0.62, spread: 0.32, r0: 0.3, r1: 0.42, seed: 5, green: [0.07, 0.1, 0.05] }));
  // the hills' chaparral and the dry slopes' scrub: greyer, lower and wider
  const scrub = (lumps, detail) => mergeParts(crown({ lumps, detail, y0: 0.3, y1: 0.55, spread: 0.36, r0: 0.28, r1: 0.4, seed: 11, green: [0.085, 0.09, 0.055] }));
  return {
    oak: { tiers: [{ geo: oak(11, 2, 8), d: 65 }, { geo: oak(8, 1, 6), d: 260 }, { geo: oak(5, 0, 4), d: 1500 }], shade: 1 },
    cypress: { tiers: [{ geo: cypress(12, 1), d: 140 }, { geo: cypress(5, 0), d: 1600 }], shade: 1 },
    shrub: { tiers: [{ geo: shrub(4, 1), d: 90 }, { geo: shrub(2, 0), d: 380 }], shade: -1 },
    scrub: { tiers: [{ geo: scrub(4, 1), d: 90 }, { geo: scrub(2, 0), d: 700 }], shade: -1 },
  };
}
const NEAR_BACK = 6;

// Every tree drawn in one field: each kind's detail levels one instanced mesh each, every tree in the one its
// distance from the camera says (sorted again when the camera's moved a few metres). The near ones' shadows from
// the next level's shape (a shadow-only copy on layer 1, which only the sun's camera sees); a bush casts none.
// What touches a tree is its collider, made with the block it stands in; the field only draws.
export class TreeField {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = 'trees';
    parent.add(this.group);
    this.mat = foliageMaterial(cityU.uTime);
    // (a tree's tint is its leaves': a jacaranda's lavender, a ficus's dark green, a sweetgum's red (city/Homes.js); its
    // trunk keeps its bark, only lighter or darker)
    this.mat.onBeforeCompile = ((prev) => (sh) => {
      prev(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `vColor = vec4(1.0);
        #ifdef USE_COLOR
          vColor.rgb *= color.rgb;
        #endif
        #ifdef USE_INSTANCING_COLOR
          float leaf = smoothstep(1.08, 1.3, color.g / max(color.r, 1e-4));
          vColor.rgb *= mix(vec3(clamp(dot(instanceColor.rgb, vec3(0.3333)), 0.7, 1.3)), instanceColor.rgb, leaf);
        #endif`);
    })(this.mat.onBeforeCompile);
    this.mat.customProgramCacheKey = () => 'cityTrees';
    this.kinds = {};
    for (const [k, K] of Object.entries(treeKinds())) { K.name = k; K.n = 0; K.cap = 0; this.kinds[k] = K; this.grow(K, 256); }
    this.trees = new Map();
    this.next = 1;
    this.at = V(1e9, 0, 0);
    this.look = V(0, 0, 0);
    this.frustum = new THREE.Frustum();
    this.dirty = true;
  }
  grow(K, cap) {
    for (const t of K.tiers) if (t.im) { t.im.removeFromParent(); t.im.dispose(); }
    if (K.shadeIm) { K.shadeIm.removeFromParent(); K.shadeIm.dispose(); }
    K.cap = cap;
    const mk = (geo, cast) => {
      const im = new THREE.InstancedMesh(geo, this.mat, cap);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; im.matrixAutoUpdate = false; im.count = 0; im.visible = false;
      this.group.add(im);
      return im;
    };
    K.tiers.forEach((t, i) => { t.im = mk(t.geo, K.shade >= 0 && i > 0 && i === K.shade); });
    if (K.shade > 0) { K.shadeIm = mk(K.tiers[K.shade].geo, true); K.shadeIm.layers.set(1); }
    this.dirty = true;
  }
  // a tree of `kind` with its foot at (x, y, z) in the world, `h` tall and `w` across (its crown's scale), `rot`
  // about its trunk, `tint` its green's shade; returns its id
  add(kind, x, y, z, h, w = h, rot = hash(x * 0.31 + z * 0.17) * 6.28, tint = 0.8 + 0.4 * hash(x * 1.7 + z)) {
    const K = this.kinds[kind], id = this.next++;
    const M = new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromAxisAngle(_Y, rot), _s.set(w, h, w));
    const c = Array.isArray(tint) ? new THREE.Color(...tint) : new THREE.Color(tint, tint * (0.95 + 0.1 * hash(x + z * 3.1)), tint); // (a flowering bush: its colour)
    this.trees.set(id, { K, M, p: V(x, y + h * 0.5, z), r: Math.max(h, w) * 0.6, tier: -1, c });
    if (++K.n > K.cap) this.grow(K, Math.max(K.cap * 2, K.n));
    this.dirty = true;
    return id;
  }
  remove(id) { const t = this.trees.get(id); if (!t) return; this.trees.delete(id); t.K.n--; this.dirty = true; }
  // (sorted again when the camera's moved 4 m or turned 6 degrees: what's behind it isn't drawn, against a view a
  // little wider than the camera's so a turn between sorts shows no gap)
  update(camera) {
    const c = camera.position, look = camera.getWorldDirection(_v);
    if (!this.dirty && c.distanceToSquared(this.at) < 16 && look.dot(this.look) > 0.9945) return;
    this.dirty = false;
    this.at.copy(c);
    this.look.copy(look);
    const wide = (this.wideCam ??= new THREE.PerspectiveCamera());
    wide.position.copy(c); wide.quaternion.copy(camera.quaternion); wide.fov = Math.min(170, camera.fov + 30); wide.aspect = camera.aspect * 1.25; wide.near = 0.1; wide.far = 2000;
    wide.updateProjectionMatrix(); wide.updateMatrixWorld(true);
    this.frustum.setFromProjectionMatrix(_m.multiplyMatrices(wide.projectionMatrix, wide.matrixWorldInverse));
    const sph = this.sph ??= new THREE.Sphere();
    for (const K of Object.values(this.kinds)) { K.counts = K.tiers.map(() => 0); K.shaded = 0; }
    for (const t of this.trees.values()) {
      const K = t.K, d2 = t.p.distanceToSquared(c);
      let tier = -1;
      for (let i = 0; i < K.tiers.length; i++) { const r = K.tiers[i].d + (t.tier === i ? NEAR_BACK : 0); if (d2 < r * r) { tier = i; break; } }
      t.tier = tier;
      if (tier < 0) continue;
      // (behind the camera: not drawn, unless it's near enough to cast a shadow into the view)
      if (d2 > 3600) { sph.center.copy(t.p); sph.radius = t.r; if (!this.frustum.intersectsSphere(sph)) continue; }
      const im = K.tiers[tier].im, n = K.counts[tier]++;
      im.setMatrixAt(n, t.M); im.setColorAt(n, t.c);
      if (tier < K.shade && K.shadeIm) { K.shadeIm.setMatrixAt(K.shaded, t.M); K.shaded++; }
    }
    for (const K of Object.values(this.kinds)) {
      const list = K.tiers.map((t, i) => [t.im, K.counts[i]]);
      if (K.shadeIm) list.push([K.shadeIm, K.shaded]);
      for (const [im, n] of list) {
        im.count = n; im.visible = n > 0;
        if (!n) continue;
        im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, n * 16); im.instanceMatrix.needsUpdate = true;
        im.instanceColor.clearUpdateRanges(); im.instanceColor.addUpdateRange(0, n * 3); im.instanceColor.needsUpdate = true;
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ Coast Park
// The plan: its paths (each a polyline, a half width and what it's paved with), the features and where the
// benches, lamps, palms and trees stand. Worked out once, the same every time.
const LOT_Z = 6000;
const CX = 6, CZ = 1070; // the fountain: the boulevard's line (x 6) on the old 1070 street's
const POND = (() => { // the pond in the north-west lawns: an easy, irregular shore
  const pts = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 1 + 0.13 * Math.sin(a * 3 + 0.7) + 0.08 * Math.sin(a * 5 + 2.1); pts.push({ x: -112 + Math.cos(a) * 52 * r, z: 1300 + Math.sin(a) * 34 * r }); }
  return smooth(pts, 4, true);
})();
const BAND = { x: -110, z: 862 }, PLAY = { x: 92, z: 810, w: 34, d: 24 }, CANAL = { x0: -196, x1: -44, z: CZ, half: 4.6 };
let PLAN = null;
export function coastParkPlan() {
  if (PLAN) return PLAN;
  const P = COAST, rnd = seeded(0xc0a57);
  const L = (pts, step = 5) => smooth(pts.map(([x, z]) => ({ x, z })), step);
  const paths = [
    // the promenades: up the boulevard's line from the south gate to the fountain and on to the north gate; from
    // downtown's side along the canal; on from the fountain up the slope to the hill road at the park's corner
    { line: L([[CX, P.z0 - 1], [CX, CZ - 28]]), half: 5, key: 'pavers', main: true },
    { line: L([[CX, CZ + 28], [CX, P.z1 + 1]]), half: 4.5, key: 'pavers', main: true },
    { line: L([[P.x0 - 1, CZ], [CX - 28, CZ]]), half: 13, key: 'pavers', canal: true },
    { line: L([[CX + 28, CZ], [70, 1082], [128, 1124], [176, 1182], [212, 1236], [P.x1 + 1, 1270]], 4), half: 3.2, key: 'pavers', main: true },
    // the loop inside the park's edge
    { line: L([[P.x0 + 9, P.z0 + 9], [P.x1 - 9, P.z0 + 9], [P.x1 - 9, P.z1 - 9], [P.x0 + 9, P.z1 - 9], [P.x0 + 9, P.z0 + 9]], 6), half: 1.9, key: 'gravel', loop: true },
    // to the bandstand, the playground and the pond, and the slopes' walks
    { line: L([[CX, 760], [-30, 790], [-72, 826], [BAND.x + 9, BAND.z - 4]]), half: 1.9, key: 'gravel' },
    { line: L([[BAND.x - 4, BAND.z + 13], [-118, 940], [-104, 1010], [-96, CZ - 13]]), half: 1.9, key: 'gravel' },
    { line: L([[P.x0 + 9, 835], [-160, 846], [BAND.x - 14, BAND.z]]), half: 1.6, key: 'gravel' },
    { line: L([[CX, 905], [40, 880], [PLAY.x - PLAY.w / 2 - 2, PLAY.z + 6]]), half: 1.9, key: 'gravel' },
    { line: L([[PLAY.x + PLAY.w / 2 + 2, PLAY.z], [150, 780], [190, 742], [P.x1 - 9, 712]], 4), half: 1.6, key: 'gravel' },
    { line: L([[-60, CZ + 13], [-70, 1160], [-90, 1225], [-96, 1262]]), half: 1.9, key: 'gravel' },
    { line: L([[CX, 1290], [-30, 1296], [-52, 1300]]), half: 1.9, key: 'gravel' },
    { line: L([[CX, 1390], [52, 1408], [104, 1372], [150, 1394], [196, 1420], [P.x1 - 9, P.z1 - 9]], 4), half: 1.6, key: 'gravel' },
    { line: L([[CX, 980], [50, 990], [104, 1020], [150, 1000], [196, 960], [P.x1 - 9, 930]], 4), half: 1.6, key: 'gravel' },
  ];
  // the walk round the pond, 5 m off its shore
  const ring = POND.map((p) => { const dx = p.x + 112, dz = p.z - 1300, d = Math.hypot(dx, dz); return { x: p.x + (dx / d) * 6, z: p.z + (dz / d) * 6 }; });
  paths.push({ line: [...ring, ring[0]], half: 1.8, key: 'gravel' });
  // how far a point is from a path's edge (negative inside it)
  const offPath = (x, z) => Math.min(...paths.map((p) => nearest(p.line, x, z).d - p.half));
  const features = [
    { kind: 'fountain', x: CX, z: CZ, r: 34 },
    { kind: 'canal', x: (CANAL.x0 + CANAL.x1) / 2, z: CZ, r: 0, rect: [CANAL.x0 - 4, CZ - 14, CANAL.x1 + 4, CZ + 14] },
    { kind: 'bandstand', x: BAND.x, z: BAND.z, r: 17 },
    { kind: 'playground', x: PLAY.x, z: PLAY.z, r: 0, rect: [PLAY.x - PLAY.w / 2 - 3, PLAY.z - PLAY.d / 2 - 3, PLAY.x + PLAY.w / 2 + 3, PLAY.z + PLAY.d / 2 + 3] },
    { kind: 'pond', x: -112, z: 1300, r: 0 },
  ];
  const clear = (x, z, m) => offPath(x, z) > m && !features.some((f) => (f.rect ? x > f.rect[0] - m && x < f.rect[2] + m && z > f.rect[1] - m && z < f.rect[3] + m : f.r && Math.hypot(x - f.x, z - f.z) < f.r + m))
    && !inPoly(ring, x, z) && x > P.x0 + 3 && x < P.x1 - 3 && z > P.z0 + 3 && z < P.z1 - 3;
  // what stands along the paths: benches facing them, lamps, the promenades' palms
  const kit = [], trees = [];
  const along = (line, every, off, fn, start = every / 2) => {
    let s = 0, next = start;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], L2 = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / L2, dz = (b.z - a.z) / L2;
      while (next < s + L2) { const t = next - s; for (const side of off) fn(a.x + dx * t - dz * side, a.z + dz * t + dx * side, dx, dz, side); next += every; }
      s += L2;
    }
  };
  const nearFeature = (x, z, r) => features.some((f) => f.r && Math.hypot(x - f.x, z - f.z) < f.r + r);
  let n = 0;
  for (const p of paths) {
    if (p.canal) {
      along(p.line, 16, [-11.8, 11.8], (x, z) => kit.push({ k: n++ % 2 ? 'palm1' : 'palm0', x, z, yaw: rnd() * 6, s: 0.62 + rnd() * 0.1 }), 10);
      along(p.line, 24, [-8.2, 8.2], (x, z, dx, dz, side) => kit.push({ k: 'bench', x, z, yaw: Math.atan2(dz * Math.sign(side), -dx * Math.sign(side)) }), 18);
      along(p.line, 24, [-9.6, 9.6], (x, z, dx, dz, side) => kit.push({ k: 'lamp', x, z, yaw: Math.atan2(-dx, -dz) * 0 + (side > 0 ? Math.PI : 0) }), 6);
      continue;
    }
    if (p.main) {
      along(p.line, 14, [-(p.half + 2.2), p.half + 2.2], (x, z) => { if (!nearFeature(x, z, 2)) kit.push({ k: n++ % 2 ? 'palm1' : 'palm0', x, z, yaw: rnd() * 6, s: 0.6 + rnd() * 0.12 }); }, 9);
      along(p.line, 28, [-(p.half + 0.9), p.half + 0.9], (x, z, dx, dz, side) => { if (!nearFeature(x, z, 1)) kit.push({ k: 'bench', x, z, yaw: Math.atan2(dz * Math.sign(side), -dx * Math.sign(side)) }); }, 16);
      along(p.line, 28, [p.half + 0.6], (x, z, dx, dz) => { if (!nearFeature(x, z, 1)) kit.push({ k: 'lamp', x, z, yaw: Math.atan2(dz, -dx) }); }, 2);
      continue;
    }
    along(p.line, p.loop ? 46 : 34, [p.half + 0.6], (x, z, dx, dz) => { if (!nearFeature(x, z, 1) && clear(x, z, -p.half - 1.2)) kit.push({ k: 'lamp', x, z, yaw: Math.atan2(dz, -dx) }); }, 12);
    along(p.line, p.loop ? 38 : 30, [-(p.half + 0.8)], (x, z, dx, dz, side) => { if (!nearFeature(x, z, 1) && clear(x, z, -p.half - 1.5)) kit.push({ k: 'bench', x, z, yaw: Math.atan2(dz * Math.sign(side), -dx * Math.sign(side)) }); }, 20);
  }
  // round the fountain's square: palms on its ring, benches facing in, lamps
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.PI / 16; kit.push({ k: i % 2 ? 'palm1' : 'palm0', x: CX + Math.cos(a) * 31, z: CZ + Math.sin(a) * 31, yaw: rnd() * 6, s: 0.64 + rnd() * 0.1 }); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + Math.PI / 12; if (Math.abs(Math.sin(a)) < 0.2 || Math.abs(Math.cos(a)) < 0.2) continue; const x = CX + Math.cos(a) * 25.5, z = CZ + Math.sin(a) * 25.5; kit.push({ k: 'bench', x, z, yaw: Math.atan2(CX - x, CZ - z) }); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; kit.push({ k: 'lamp', x: CX + Math.cos(a) * 27.6, z: CZ + Math.sin(a) * 27.6, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }); }
  // round the bandstand: benches facing it
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3; if (Math.abs(a - Math.PI * 1.75) < 0.4) continue; const x = BAND.x + Math.cos(a) * 14.2, z = BAND.z + Math.sin(a) * 14.2; kit.push({ k: 'bench', x, z, yaw: Math.atan2(BAND.x - x, BAND.z - z) }); }
  // the pond's benches facing the water
  for (let i = 0; i < 10; i++) { const p = ring[Math.floor((i / 10) * ring.length)], dx = p.x + 112, dz = p.z - 1300, d = Math.hypot(dx, dz); kit.push({ k: 'bench', x: p.x + (dx / d) * 2.6, z: p.z + (dz / d) * 2.6, yaw: Math.atan2(-dx, -dz) }); }
  // the trees: oaks in clumps on the lawns (more of them up the slope, and a few cypresses), clear of the paths
  const spots = [];
  const ok = (x, z, gap) => clear(x, z, 3.2) && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < gap);
  const clumps = [];
  for (let i = 0; i < 72; i++) clumps.push({ x: P.x0 + 12 + rnd() * (P.x1 - P.x0 - 24), z: P.z0 + 12 + rnd() * (P.z1 - P.z0 - 24) });
  for (const c of clumps) {
    const k = 4 + Math.floor(rnd() * (c.x > 100 ? 8 : 6));
    for (let j = 0; j < k * 4 && k > 0; j++) {
      const x = c.x + (rnd() - 0.5) * 34, z = c.z + (rnd() - 0.5) * 34;
      if (!ok(x, z, 7.5)) continue;
      const h = 7 + rnd() * 6;
      spots.push({ kind: rnd() < 0.1 ? 'cypress' : 'oak', x, z, h, w: h * (0.75 + rnd() * 0.35) });
    }
  }
  for (const s of spots) { if (s.kind === 'cypress') { s.h = 9 + rnd() * 4; s.w = s.h * 0.9; } trees.push(s); }
  // a hedge of bushes along the playground's fence and round the bandstand's square
  for (let i = 0; i < 26; i++) { const x = PLAY.x - PLAY.w / 2 - 1.8 + rnd() * (PLAY.w + 3.6), z = PLAY.z + (i % 2 ? 1 : -1) * (PLAY.d / 2 + 1.6); trees.push({ kind: 'shrub', x, z, h: 1.1 + rnd() * 0.5, w: 1.6 + rnd() * 0.8 }); }
  return (PLAN = { paths, features, kit, trees, ring, offPath });
}

// The block of the park a point is in (its streets' middles: so everything in the park belongs to one)
const ROWS = STREET_Z;
export function coastCellAt(x, z) {
  const j = Math.floor((x - 6) / 80), r = ROWS.findIndex((zr, i) => z >= zr && z < (ROWS[i + 1] ?? Infinity));
  return `${j},${r}`;
}

// The park's ground, made once: its lawns over the whole of it (cut into tiles), its paths and its water (in the
// city's batches, always shown), and its trees (in the tree field)
export function buildCoastParkGround(stream) {
  const P = COAST, plan = coastParkPlan(), B = stream.batches, mats = stream.mats;
  const geos = { lawn: [], gravel: [], pavers: [], water: [] };
  for (let x = P.x0; x < P.x1 - 0.01; x += 38) for (let z = P.z0; z < P.z1 - 0.01; z += 39) geos.lawn.push(drape(x, z, Math.min(P.x1, x + 38), Math.min(P.z1, z + 39), 0.04, 4));
  for (const p of plan.paths) geos[p.key].push(ribbon(p.line, p.half, p.key === 'pavers' ? 0.1 : 0.07, groundAt, p.half > 4 ? 4 : 2));
  geos.pavers.push(disc(CX, CZ, 30, 0.1, 0, 64));
  geos.pavers.push(disc(BAND.x, BAND.z, 15.5, 0.08, 0, 40));
  // the pond's water (level: it lies on the flat), and the canal's
  geos.water.push(new THREE.ShapeGeometry(new THREE.Shape(POND.map((p) => new THREE.Vector2(p.x, -p.z))), 1).rotateX(-Math.PI / 2).translate(0, 0.28, 0));
  geos.water.push(new THREE.PlaneGeometry(CANAL.x1 - CANAL.x0, CANAL.half * 2).rotateX(-Math.PI / 2).translate((CANAL.x0 + CANAL.x1) / 2, 0.38, CZ));
  const handles = [];
  for (const [key, list] of Object.entries(geos)) {
    // (each piece one geometry of its key's batch, so the camera leaves out what it can't see)
    for (const g of list) {
      const n = g.index ? g.toNonIndexed() : g;
      for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a);
      const c = new Float32Array(n.attributes.position.count * 3).fill(1);
      if (key === 'lawn') c.fill(1.0);
      n.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const h = B.add(key, mats[key], n, false);
      B.show(h, true);
      handles.push(h);
    }
  }
  for (const t of plan.trees) stream.trees.add(t.kind, t.x, groundAt(t.x, t.z), t.z + LOT_Z, t.h, t.w);
  return handles;
}

// What stands in one block of the park (built and put away with the block, Stream.buildCell): the features whose
// middles are in it, the kit along its paths, the trees' trunks, the wall round the park on its edges
export function coastParkCell(stream, ctx, c, places) {
  const plan = coastParkPlan(), id = `${c.j},${c.r}`, mine = (x, z) => coastCellAt(x, z) === id;
  const put = (k, x, z, yaw, s) => places.push({ k, M: new THREE.Matrix4().compose(V(x, groundAt(x, z) + (k === 'lamp' || k === 'bench' ? 0.09 : 0), z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s ?? (k === 'lamp' ? 1.8 : 1))), s: s ?? (k === 'lamp' ? 1.8 : 1) });
  for (const f of plan.features) if (mine(f.x, f.z)) FEATURES[f.kind](ctx, f, places, put);
  for (const k of plan.kit) if (mine(k.x, k.z)) {
    put(k.k, k.x, k.z, k.yaw, k.s);
    if (k.k === 'lamp') ctx.lamps.push({ at: V(k.x, groundAt(k.x, k.z) + 6.2, k.z), k: 1, street: true, y: groundAt(k.x, k.z) + 0.12 });
  }
  for (const t of plan.trees) if (mine(t.x, t.z) && t.kind !== 'shrub') { const y = groundAt(t.x, t.z), r = 0.035 * t.w * 0.9; ctx.pads.push({ c: V(t.x, y + 1.6, t.z), half: V(r, 1.6, r) }); }
  // the low wall round the park, its gates where the paths come out (on the blocks along its edges)
  const P = COAST, gx0 = streetX(c.j), gx1 = streetX(c.j + 1), gz0 = ROWS[c.r], gz1 = ROWS[c.r + 1];
  const gates = plan.paths.flatMap((p) => [p.line[0], p.line.at(-1)].map((q) => ({ x: q.x, z: q.z, r: p.half + 1.6 })));
  const edge = (pts) => {
    wallAlong(ctx, pts, { h: 0.5, thick: 0.45, color: 0xd6ccba, cap: 0xe9e2d4, seg: 6, gaps: gates });
    for (const g of gates) if (pts.some((q, i) => i && nearest([pts[i - 1], q], g.x, g.z).d < 1)) pier(ctx, pts, g);
  };
  const clip = (a, b) => [Math.max(a, Math.min(b, a)), b];
  void clip;
  if (gz0 <= P.z0 && gz1 > P.z0) edge([{ x: Math.max(P.x0, gx0), z: P.z0 - 0.3 }, { x: Math.min(P.x1, gx1), z: P.z0 - 0.3 }]);
  if (gz0 < P.z1 && gz1 >= P.z1) edge([{ x: Math.max(P.x0, gx0), z: P.z1 + 0.3 }, { x: Math.min(P.x1, gx1), z: P.z1 + 0.3 }]);
  if (gx0 <= P.x0 && gx1 > P.x0) edge([{ x: P.x0 - 0.3, z: Math.max(P.z0, gz0) }, { x: P.x0 - 0.3, z: Math.min(P.z1, gz1) }]);
  if (gx0 < P.x1 && gx1 >= P.x1) edge([{ x: P.x1 + 0.3, z: Math.max(P.z0, gz0) }, { x: P.x1 + 0.3, z: Math.min(P.z1, gz1) }]);
}
// a gate's two stone piers either side of the path, a lamp globe on each
function pier(ctx, pts, g) {
  const a = pts[0], b = pts[1], L = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
  for (const s of [-1, 1]) {
    const x = g.x + dx * s * (g.r + 0.2), z = g.z + dz * s * (g.r + 0.2), y = groundAt(x, z);
    ctx.batch.add('stucco', box(x - 0.45, y - 0.2, z - 0.45, x + 0.45, y + 2.3, z + 0.45), I, 0xe6dcc8);
    ctx.batch.add('concrete', box(x - 0.58, y + 2.3, z - 0.58, x + 0.58, y + 2.48, z + 0.58), I, 0xeee6d6);
    ctx.batch.add('metal', cyl(0.07, 0.1, 0.25, x, y + 2.48, z, 8), I, 0x2a2620);
    ctx.batch.add('lamp', new THREE.SphereGeometry(0.26, 14, 10).translate(x, y + 2.98, z), I, 0xfff2d8);
    ctx.solids.push({ c: V(x, y + 1.2, z), half: V(0.5, 1.3, 0.5), q: new THREE.Quaternion() });
  }
}

// ------------------------------------------------------------------------------------------------ the features
const stone = 0xdcd3c3, stoneDark = 0xb9b0a1;
// a basin's rim as a ring of boxes (walls you can't walk through, the water open inside them)
function rimSolids(ctx, cx, y, cz, r, h, thick, n = 24) {
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2, len = 2 * Math.PI * r / n + 0.1;
    ctx.solids.push({ c: V(cx + Math.cos(a) * r, y + h / 2, cz + Math.sin(a) * r), half: V(thick / 2, h / 2, len / 2), q: new THREE.Quaternion().setFromAxisAngle(_Y, -a) });
  }
}
const FEATURES = {
  // The fountain: a round basin 16 m across its water, a wide coping to sit on, and in the middle two bowls on a
  // pedestal, their water falling in sheets to the one below, a jet from the top
  fountain(ctx, f) {
    const { batch } = ctx, x = f.x, z = f.z, y = groundAt(x, z) + 0.1, R = 15;
    batch.add('concrete', lathe([[R + 0.85, 0], [R + 0.85, 0.6], [R + 0.7, 0.7], [R - 0.4, 0.7], [R - 0.55, 0.62], [R - 0.55, 0.3]], x, y, z, 72), I, stone);
    batch.add('concrete', lathe([[R - 0.5, 0.3], [R - 0.5, 0.06], [0.01, 0.06]], x, y, z, 72), I, 0x8a948e); // (the basin's floor, under the water)
    batch.add('water', new THREE.CircleGeometry(R - 0.5, 72).rotateX(-Math.PI / 2).translate(x, y + 0.5, z), I, 0xffffff);
    rimSolids(ctx, x, y, z, R + 0.15, 0.7, 1.3, 36);
    // the pedestal, the bowls and the finial
    batch.add('concrete', lathe([[0.01, 0], [2.4, 0], [2.4, 0.5], [1.4, 0.7], [0.9, 1.2], [0.7, 2.6], [1.1, 2.9], [0.01, 2.9]], x, y + 0.1, z, 36), I, stone);
    batch.add('concrete', lathe([[0.6, 2.9], [4.6, 3.1], [4.9, 3.45], [4.6, 3.55], [0.01, 3.4]], x, y, z, 48), I, stone);
    batch.add('water', new THREE.CircleGeometry(4.55, 40).rotateX(-Math.PI / 2).translate(x, y + 3.43, z), I, 0xffffff);
    batch.add('concrete', lathe([[0.01, 3.4], [0.5, 3.5], [0.38, 5.2], [0.6, 5.4], [0.01, 5.4]], x, y, z, 24), I, stone);
    batch.add('concrete', lathe([[0.3, 5.3], [2.3, 5.5], [2.45, 5.75], [2.3, 5.82], [0.01, 5.7]], x, y, z, 36), I, stone);
    batch.add('water', new THREE.CircleGeometry(2.28, 32).rotateX(-Math.PI / 2).translate(x, y + 5.74, z), I, 0xffffff);
    batch.add('concrete', lathe([[0.01, 5.7], [0.28, 5.75], [0.18, 6.6], [0.32, 6.8], [0.01, 7.0]], x, y, z, 16), I, stoneDark);
    // the falling water: from the upper bowl to the lower, from the lower to the basin, and the jet
    const sheet = (r0, r1, y0, y1, seg = 48) => { const g = new THREE.CylinderGeometry(r0, r1, y1 - y0, seg, 3, true).translate(x, y + (y0 + y1) / 2, z); batch.add('spray', g, I, 0xffffff); };
    sheet(2.5, 2.75, 3.5, 5.78); sheet(4.95, 5.6, 0.5, 3.5, 64); sheet(0.12, 0.05, 6.9, 9.6, 10);
    const jet = new THREE.ConeGeometry(0.9, 2.2, 14, 1, true).rotateX(Math.PI).translate(x, y + 9.6, z); batch.add('spray', jet, I, 0xffffff);
    ctx.solids.push({ c: V(x, y + 2.6, z), half: V(2.3, 2.6, 2.3), q: new THREE.Quaternion() });
    ctx.solids.push({ c: V(x, y + 3.3, z), half: V(4.4, 0.25, 4.4), q: new THREE.Quaternion() });
  },
  // The reflecting canal along the walk from downtown's side: its stone rim, a jet arching in every 12 m
  canal(ctx, f) {
    const { batch } = ctx, y = 0.1, z = CANAL.z, h = CANAL.half;
    for (const s of [-1, 1]) {
      batch.add('concrete', box(CANAL.x0 - 0.6, 0, z + s * h - 0.35, CANAL.x1 + 0.6, y + 0.48, z + s * h + 0.35), I, stone);
      ctx.solids.push({ c: V((CANAL.x0 + CANAL.x1) / 2, (y + 0.48) / 2, z + s * h), half: V((CANAL.x1 - CANAL.x0) / 2 + 0.6, (y + 0.48) / 2, 0.35), q: new THREE.Quaternion() });
    }
    for (const x of [CANAL.x0, CANAL.x1]) { batch.add('concrete', box(x - 0.35, 0, z - h - 0.35, x + 0.35, y + 0.48, z + h + 0.35), I, stone); ctx.solids.push({ c: V(x, 0.29, z), half: V(0.35, 0.29, h + 0.35), q: new THREE.Quaternion() }); }
    batch.add('concrete', box(CANAL.x0, 0, z - h, CANAL.x1, 0.14, z + h), I, 0x7f8a86);
    // the jets: thin arcs from each rim toward the middle
    for (let x = CANAL.x0 + 8; x < CANAL.x1 - 4; x += 12) for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V(x, y + 0.5 + Math.sin(t * Math.PI) * 1.6, z + s * (h - 0.2) * (1 - t * 0.9))); }
      batch.add('spray', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.05, 5, false), I, 0xffffff);
    }
  },
  // The bandstand: an octagon on a plinth a metre up, its steps toward the fountain, slender white columns, a
  // railing between them, a tiled roof rising to a lantern
  bandstand(ctx, f) {
    const { batch } = ctx, x = f.x, z = f.z, y = groundAt(x, z) + 0.08, R = 6.4, rot = Math.PI / 8;
    const oct = (r, h, y0, key, color, seg = 8) => batch.add(key, new THREE.CylinderGeometry(r, r, h, seg).rotateY(rot).translate(x, y0 + h / 2, z), I, color);
    oct(R + 0.3, 0.9, y - 0.3, 'concrete', 0xe8e0d0); oct(R + 0.45, 0.12, y + 0.6, 'concrete', 0xf0ebe0);
    // the steps, toward the path from the fountain (north-east)
    const sa = -0.42, sx = Math.cos(sa), sz = Math.sin(sa); // (toward the path from the fountain)
    for (let i = 0; i < 4; i++) { const d = R + 0.5 + i * 0.36; batch.add('concrete', boxAt(x + sx * d, z + sz * d, y - 0.3, y + 0.72 - (i + 1) * 0.18, 2.6, 0.36, -sa + Math.PI / 2), I, 0xe2dacb); ctx.solids.push({ c: V(x + sx * d, y + (0.72 - (i + 1) * 0.18 - 0.3) / 2, z + sz * d), half: V(1.3, (0.72 - (i + 1) * 0.18 + 0.3) / 2, 0.18), q: new THREE.Quaternion().setFromAxisAngle(_Y, -sa + Math.PI / 2) }); }
    const top = y + 0.72;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rot, cx = x + Math.cos(a) * (R - 0.25), cz = z + Math.sin(a) * (R - 0.25);
      batch.add('paint', cyl(0.11, 0.13, 3.3, cx, top, cz, 10), I, 0xf4f1ea);
      batch.add('paint', box(cx - 0.18, top + 3.25, cz - 0.18, cx + 0.18, top + 3.45, cz + 0.18), I, 0xf4f1ea);
      ctx.solids.push({ c: V(cx, top + 1.65, cz), half: V(0.14, 1.65, 0.14), q: new THREE.Quaternion() });
      // the railing to the next column, open at the steps
      const b = ((i + 1) / 8) * Math.PI * 2 + rot, bx = x + Math.cos(b) * (R - 0.25), bz = z + Math.sin(b) * (R - 0.25), mid = (a + b) / 2;
      if (Math.abs(Math.atan2(Math.sin(mid - sa), Math.cos(mid - sa))) < 0.3) continue;
      const mx = (cx + bx) / 2, mz = (cz + bz) / 2, len = Math.hypot(bx - cx, bz - cz), yaw = Math.atan2(-(bz - cz), bx - cx);
      batch.add('paint', boxAt(mx, mz, top + 0.92, top + 1.0, len, 0.1, yaw), I, 0xf4f1ea);
      batch.add('paint', boxAt(mx, mz, top + 0.08, top + 0.14, len, 0.08, yaw), I, 0xf4f1ea);
      for (let k = 1; k < 12; k++) { const t = k / 12; batch.add('paint', box(cx + (bx - cx) * t - 0.025, top + 0.14, cz + (bz - cz) * t - 0.025, cx + (bx - cx) * t + 0.025, top + 0.92, cz + (bz - cz) * t + 0.025), I, 0xf4f1ea); }
      ctx.solids.push({ c: V(mx, top + 0.5, mz), half: V(len / 2, 0.5, 0.06), q: new THREE.Quaternion().setFromAxisAngle(_Y, yaw) });
    }
    // the ring beam, the roof and its lantern
    oct(R + 0.05, 0.42, top + 3.45, 'paint', 0xf0ebe0);
    batch.add('paint', new THREE.CylinderGeometry(R + 0.65, R + 0.65, 0.16, 8, 1, true).rotateY(rot).translate(x, top + 3.95, z), I, 0x6a4a34);
    batch.add('roofTile', metreUV(new THREE.ConeGeometry(R + 0.75, 2.9, 8, 1, true).rotateY(rot).translate(x, top + 3.87 + 1.45, z)), I, 0xffffff);
    batch.add('paint', new THREE.CircleGeometry(R + 0.7, 8).rotateX(Math.PI / 2).rotateY(rot).translate(x, top + 3.86, z), I, 0xe8e2d6); // (its ceiling)
    batch.add('paint', new THREE.CylinderGeometry(0.75, 0.75, 0.8, 8).rotateY(rot).translate(x, top + 6.6, z), I, 0xf4f1ea);
    batch.add('roofTile', metreUV(new THREE.ConeGeometry(0.95, 0.9, 8).rotateY(rot).translate(x, top + 7.45, z)), I, 0xffffff);
    batch.add('metal', cyl(0.03, 0.03, 1.1, x, top + 7.85, z, 6), I, 0x3a3026);
    const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + rot; for (const yy of [y - 0.3, top]) pts.push(V(x + Math.cos(a) * (R + 0.3), yy, z + Math.sin(a) * (R + 0.3))); }
    ctx.hulls.push({ pts });
    const roof = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + rot; roof.push(V(x + Math.cos(a) * (R + 0.75), top + 3.87, z + Math.sin(a) * (R + 0.75))); } roof.push(V(x, top + 6.8, z));
    ctx.hulls.push({ pts: roof });
  },
  // The playground: a soft rubber floor in a low fence, swings, a slide off a deck with a ladder, a climbing
  // dome, a sandpit
  playground(ctx, f) {
    const { batch } = ctx, x = PLAY.x, z = PLAY.z, w = PLAY.w, d = PLAY.d, y = groundAt(x, z);
    batch.add('roadpaint', box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.08, z + d / 2), I, 0x9a4a32);
    batch.add('roadpaint', box(x - w / 2 + 4, y, z - d / 2 + 3, x - w / 2 + 14, y + 0.085, z + d / 2 - 3), I, 0x3f6a8a);
    ctx.pads.push({ c: V(x, y + 0.04, z), half: V(w / 2, 0.04, d / 2) });
    // the fence: posts and two rails, a gate gap on the west and the east
    const fence = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2)), yaw = Math.atan2(-(z1 - z0), x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      for (let i = 0; i <= n; i++) { const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t; batch.add('paint', box(px - 0.05, y, pz - 0.05, px + 0.05, y + 1.0, pz + 0.05), I, 0x2f5a3e); }
      for (const h of [0.45, 0.92]) batch.add('paint', boxAt(mx, mz, y + h, y + h + 0.06, L, 0.05, yaw), I, 0x2f5a3e);
      ctx.solids.push({ c: V(mx, y + 0.5, mz), half: V(L / 2, 0.5, 0.06), q: new THREE.Quaternion().setFromAxisAngle(_Y, yaw) });
    };
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    fence(x0, z0, x1, z0); fence(x0, z1, x1, z1); fence(x0, z0, x0, z + 4.5); fence(x0, z + 8.5, x0, z1); fence(x1, z0, x1, z - 2); fence(x1, z + 2, x1, z1);
    const red = 0xb8322a, yellow = 0xe8b830, blue = 0x2a5a9a, steel = 0x9aa0a4;
    // swings: an A-frame each end, the beam, three seats on their chains
    const sx = x0 + 9, sz = z + 4;
    for (const e of [-3.4, 3.4]) for (const s of [-1, 1]) {
      const g = new THREE.CylinderGeometry(0.05, 0.05, 2.75, 8).rotateX(s * 0.32).translate(sx + e, y + 1.3, sz + s * 0.42);
      batch.add('metal', g, I, blue);
    }
    batch.add('metal', new THREE.CylinderGeometry(0.06, 0.06, 7, 8).rotateZ(Math.PI / 2).translate(sx, y + 2.6, sz), I, blue);
    for (const u of [-2.2, 0, 2.2]) {
      for (const k of [-0.22, 0.22]) batch.add('metal', box(sx + u + k - 0.008, y + 0.5, sz - 0.008, sx + u + k + 0.008, y + 2.6, sz + 0.008), I, steel);
      batch.add('dark', box(sx + u - 0.28, y + 0.46, sz - 0.12, sx + u + 0.28, y + 0.5, sz + 0.12), I, 0x222222);
    }
    ctx.solids.push({ c: V(sx - 3.4, y + 1.3, sz), half: V(0.1, 1.3, 0.9), q: new THREE.Quaternion() }, { c: V(sx + 3.4, y + 1.3, sz), half: V(0.1, 1.3, 0.9), q: new THREE.Quaternion() });
    // the slide: a deck on four posts, its roof, a ladder up one side and the chute down the other
    const dx = x + 3, dz = z - 4, dh = 1.9;
    for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) batch.add('metal', cyl(0.06, 0.06, 3.4, dx + a, y, dz + b, 8), I, red);
    batch.add('paint', box(dx - 0.85, y + dh - 0.08, dz - 0.85, dx + 0.85, y + dh, dz + 0.85), I, 0x6a4a34);
    batch.add('roadpaint', new THREE.ConeGeometry(1.4, 0.9, 4).rotateY(Math.PI / 4).translate(dx, y + 3.85, dz), I, yellow);
    for (let i = 0; i < 6; i++) batch.add('metal', box(dx - 1.25, y + 0.3 + i * 0.3, dz - 0.35, dx - 1.2, y + 0.33 + i * 0.3, dz + 0.35), I, steel);
    for (const s of [-1, 1]) batch.add('metal', box(dx - 1.25, y, dz + s * 0.36 - 0.02, dx - 1.2, y + dh + 0.8, dz + s * 0.36 + 0.02), I, steel);
    const chute = new THREE.BoxGeometry(3.9, 0.06, 0.7).translate(1.95, 0, 0).rotateZ(-Math.atan2(dh - 0.35, 3.6)).translate(dx + 0.85, y + dh - 0.04, dz);
    batch.add('roadpaint', chute, I, yellow);
    for (const s of [-1, 1]) batch.add('roadpaint', new THREE.BoxGeometry(3.9, 0.25, 0.05).translate(1.95, 0.12, s * 0.36).rotateZ(-Math.atan2(dh - 0.35, 3.6)).translate(dx + 0.85, y + dh - 0.04, dz), I, yellow);
    ctx.solids.push({ c: V(dx, y + dh / 2, dz), half: V(0.85, dh / 2, 0.85), q: new THREE.Quaternion() });
    // the climbing dome: a geodesic frame of red tubes
    const cx = x1 - 7, cz = z + 3, ico = new THREE.IcosahedronGeometry(2.4, 1), P = ico.attributes.position, seen = new Set();
    const tube = (a, b) => { const L = a.distanceTo(b), g = new THREE.CylinderGeometry(0.035, 0.035, L, 5).translate(0, L / 2, 0); g.applyQuaternion(_q.setFromUnitVectors(_Y, _v.subVectors(b, a).normalize())); g.translate(a.x, a.y, a.z); batch.add('metal', g, I, red); };
    for (let i = 0; i < P.count; i += 3) for (let k = 0; k < 3; k++) {
      const a = V(P.getX(i + k), P.getY(i + k), P.getZ(i + k)), b = V(P.getX(i + (k + 1) % 3), P.getY(i + (k + 1) % 3), P.getZ(i + (k + 1) % 3));
      if (a.y < -0.3 && b.y < -0.3) continue;
      const key = [a, b].map((v) => v.toArray().map((n) => n.toFixed(2)).join(',')).sort().join('|');
      if (seen.has(key)) continue; seen.add(key);
      tube(a.setY(Math.max(a.y, -0.3)).add(V(cx, y + 0.3, cz)), b.setY(Math.max(b.y, -0.3)).add(V(cx, y + 0.3, cz)));
    }
    const dome = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; dome.push(V(cx + Math.cos(a) * 2.3, y, cz + Math.sin(a) * 2.3)); } dome.push(V(cx, y + 2.7, cz));
    ctx.hulls.push({ pts: dome });
    // the sandpit: a timber edge round the sand
    const px = x1 - 7, pz = z - 6;
    batch.add('gravel', box(px - 3, y, pz - 2.4, px + 3, y + 0.16, pz + 2.4), I, 0xf0e0bc);
    for (const [a0, b0, a1, b1] of [[-3.2, -2.6, 3.2, -2.4], [-3.2, 2.4, 3.2, 2.6], [-3.2, -2.4, -3, 2.4], [3, -2.4, 3.2, 2.4]]) { batch.add('paint', box(px + a0, y, pz + b0, px + a1, y + 0.3, pz + b1), I, 0x7a5a3a); }
  },
  // The pond: its stone kerb round the water (the water itself is the park's ground: buildCoastParkGround)
  pond(ctx) {
    const { batch } = ctx;
    for (let i = 0; i < POND.length; i++) {
      const a = POND[i], b = POND[(i + 1) % POND.length], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(-(b.z - a.z), b.x - a.x), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      batch.add('concrete', boxAt(mx, mz, -0.2, 0.42, L + 0.25, 1.0, yaw), I, i % 3 ? 0xcfc5b3 : 0xc4baa8);
      ctx.solids.push({ c: V(mx, 0.11, mz), half: V(L / 2 + 0.12, 0.31, 0.5), q: new THREE.Quaternion().setFromAxisAngle(_Y, yaw) });
    }
    batch.add('concrete', new THREE.ShapeGeometry(new THREE.Shape(POND.map((p) => new THREE.Vector2(p.x, -p.z))), 1).rotateX(-Math.PI / 2).translate(0, 0.06, 0), I, 0x5a6a5a);
  },
};

// ------------------------------------------------------------------------------------------------ the plazas
// Downtown's three squares (Layout.js PARKS, one block each): paved from kerb to kerb in pale slabs with a darker
// border and bands, a monument in the middle (Civic Plaza's obelisk over a long fountain, Pershing Square's bell
// tower beside its round pool, Harbor Square's anchor on its compass rose), palms in rows, trees in square planters,
// benches and lamps.
export function plaza(stream, ctx, c, places) {
  const { batch } = ctx, rnd = ctx.rnd;
  const x0 = c.x0, x1 = c.x1, z0 = c.z0, z1 = c.z1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, H = z1 - z0;
  const put = (k, x, z, yaw, s) => places.push({ k, M: new THREE.Matrix4().compose(V(x, 0.16, z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s ?? (k === 'lamp' ? 1.8 : 1))), s: s ?? (k === 'lamp' ? 1.8 : 1) });
  // the paving, level with the pavements round it, the border and the bands across
  batch.add('pavers', box(x0, 0, z0, x1, 0.15, z1), I, 0xffffff);
  ctx.pads.push({ c: V(cx, 0.075, cz), half: V(W / 2, 0.075, H / 2) });
  for (const [a0, b0, a1, b1] of [[x0, z0, x1, z0 + 1.2], [x0, z1 - 1.2, x1, z1], [x0, z0, x0 + 1.2, z1], [x1 - 1.2, z0, x1, z1]]) batch.add('pavers', box(a0, 0.15, b0, a1, 0.152, b1), I, 0x9a8e80);
  for (let z = z0 + 22; z < z1 - 10; z += 22) batch.add('pavers', box(x0 + 1.2, 0.15, z - 0.6, x1 - 1.2, 0.152, z + 0.6), I, 0xb4a894);
  const kind = c.parkId;
  const lamp = (x, z, yaw) => { put('lamp', x, z, yaw); ctx.lamps.push({ at: V(x, 6.3, z), k: 1, street: true }); };
  // rows of palms down both long sides, lamps between
  for (let z = z0 + 9; z < z1 - 6; z += 15) for (const s of [-1, 1]) {
    const x = cx + s * (W / 2 - 5);
    if (Math.abs(z - cz) < 26) continue;
    put(rnd() < 0.5 ? 'palm0' : 'palm1', x, z, rnd() * 6, 0.62 + rnd() * 0.1);
    batch.add('iron', box(x - 0.7, 0.15, z - 0.7, x + 0.7, 0.17, z + 0.7), I, 0x2a2622);
  }
  for (let z = z0 + 16.5; z < z1 - 6; z += 30) for (const s of [-1, 1]) lamp(cx + s * (W / 2 - 4.2), z, s > 0 ? Math.PI : 0);
  // two avenues of shade trees in grates down the square (clear of the middle), every other one a planter with a
  // seat round it and a bench facing the middle; low hedged beds at the square's ends
  let k = 0;
  for (let z = z0 + 14; z < z1 - 12; z += 12) for (const s of [-1, 1]) {
    if (Math.abs(z - cz) < 31) continue;
    const x = cx + s * 12, planter = (k++ % 3) === 1;
    if (planter) {
      batch.add('concrete', box(x - 1.7, 0.15, z - 1.7, x + 1.7, 0.55, z + 1.7), I, 0xd8cfbe);
      batch.add('concrete', box(x - 1.85, 0.55, z - 1.85, x + 1.85, 0.62, z + 1.85), I, 0xe6dfd2);
      batch.add('hedge', box(x - 1.5, 0.55, z - 1.5, x + 1.5, 0.82, z + 1.5), I, 0x34502a);
      ctx.solids.push({ c: V(x, 0.38, z), half: V(1.85, 0.24, 1.85), q: new THREE.Quaternion() });
      put('bench', x - s * 2.9, z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    } else batch.add('iron', box(x - 0.8, 0.15, z - 0.8, x + 0.8, 0.165, z + 0.8), I, 0x2a2622);
    ctx.trees.push({ kind: 'oak', x, y: planter ? 0.75 : 0.15, z, h: 6.5 + rnd() * 2, w: 5.5 + rnd() * 1.5 });
  }
  for (const e of [z0 + 5, z1 - 5]) {
    batch.add('concrete', box(cx - 9, 0.15, e - 1.3, cx + 9, 0.6, e + 1.3), I, 0xd8cfbe);
    batch.add('hedge', box(cx - 8.8, 0.6, e - 1.1, cx + 8.8, 1.05, e + 1.1), I, 0x2f4a24);
    ctx.solids.push({ c: V(cx, 0.6, e), half: V(9, 0.45, 1.3), q: new THREE.Quaternion() });
    for (const s of [-1, 1]) put('bench', cx + s * 4, e + (e < cz ? 2.4 : -2.4), e < cz ? 0 : Math.PI);
  }
  // the monument
  if (kind === 'civic') {
    // a long basin with jets down its middle, the obelisk at its north end on its stepped base
    const bw = 7, bh = 34, bz = cz - 6;
    batch.add('concrete', box(cx - bw / 2 - 0.6, 0.15, bz - bh / 2 - 0.6, cx + bw / 2 + 0.6, 0.65, bz + bh / 2 + 0.6), I, stone);
    batch.add('water', new THREE.PlaneGeometry(bw, bh).rotateX(-Math.PI / 2).translate(cx, 0.6, bz), I, 0xffffff);
    for (const s of [-1, 1]) ctx.solids.push({ c: V(cx + s * (bw / 2 + 0.3), 0.4, bz), half: V(0.3, 0.25, bh / 2 + 0.6), q: new THREE.Quaternion() });
    for (const s of [-1, 1]) ctx.solids.push({ c: V(cx, 0.4, bz + s * (bh / 2 + 0.3)), half: V(bw / 2 + 0.6, 0.25, 0.3), q: new THREE.Quaternion() });
    for (let z = bz - bh / 2 + 3; z < bz + bh / 2 - 2; z += 4) batch.add('spray', new THREE.ConeGeometry(0.35, 1.8, 10, 1, true).rotateX(Math.PI).translate(cx, 0.6 + 0.9, z), I, 0xffffff);
    const oz = cz + 22;
    for (let i = 0; i < 3; i++) batch.add('concrete', box(cx - 4 + i, 0.15, oz - 4 + i, cx + 4 - i, 0.15 + (i + 1) * 0.35, oz + 4 - i), I, 0xe4dccb);
    const ob = new THREE.CylinderGeometry(0.85, 1.35, 24, 4, 1).rotateY(Math.PI / 4).translate(cx, 1.2 + 12, oz);
    batch.add('stucco', ob, I, 0xeee6d6);
    batch.add('bronze', new THREE.ConeGeometry(1.2, 1.6, 4).rotateY(Math.PI / 4).translate(cx, 1.2 + 24 + 0.8, oz), I, 0xffffff);
    ctx.solids.push({ c: V(cx, 0.68, oz), half: V(4, 0.55, 4), q: new THREE.Quaternion() }, { c: V(cx, 13.2, oz), half: V(1.0, 12, 1.0), q: new THREE.Quaternion() });
  } else if (kind === 'pershing') {
    // a round pool, and a tall bell tower in violet stucco beside it (the square's landmark)
    const R = 9;
    batch.add('concrete', lathe([[R + 0.5, 0], [R + 0.5, 0.62], [R - 0.4, 0.62], [R - 0.4, 0.3]], cx, 0.15, cz - 10, 48), I, stone);
    batch.add('water', new THREE.CircleGeometry(R - 0.4, 48).rotateX(-Math.PI / 2).translate(cx, 0.65, cz - 10), I, 0xffffff);
    rimSolids(ctx, cx, 0.15, cz - 10, R + 0.05, 0.62, 0.9, 24);
    batch.add('spray', new THREE.CylinderGeometry(0.1, 0.06, 3.2, 8, 1, true).translate(cx, 0.65 + 1.6, cz - 10), I, 0xffffff);
    batch.add('spray', new THREE.ConeGeometry(1.4, 1.6, 16, 1, true).rotateX(Math.PI).translate(cx, 0.65 + 3.2, cz - 10), I, 0xffffff);
    const tx = cx, tz = cz + 16, tw = 2.6, th = 30, violet = 0x8a6aa8;
    batch.add('stucco', box(tx - tw, 0.15, tz - tw, tx + tw, th, tz + tw), I, violet);
    batch.add('concrete', box(tx - tw - 0.35, 0.15, tz - tw - 0.35, tx + tw + 0.35, 1.4, tz + tw + 0.35), I, 0xd8cfbe); // its base
    for (const yb of [9, 18, th - 6]) batch.add('concrete', box(tx - tw - 0.08, yb, tz - tw - 0.08, tx + tw + 0.08, yb + 0.35, tz + tw + 0.08), I, 0xeee6d6); // the bands
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // a clock face each side under the belfry
      const g = new THREE.CircleGeometry(1.25, 32).rotateY(Math.atan2(nx, nz)).translate(tx + nx * (tw + 0.03), th - 8.2, tz + nz * (tw + 0.03));
      batch.add('paint', g, I, 0xf4f0e6);
      const h = new THREE.PlaneGeometry(0.12, 0.9).translate(0, 0.35, 0).rotateZ(0.6).rotateY(Math.atan2(nx, nz)).translate(tx + nx * (tw + 0.05), th - 8.2, tz + nz * (tw + 0.05));
      batch.add('dark', h, I, 0x1a1a1a);
    }
    for (const s of [-1, 1]) for (const ax of ['x', 'z']) { // the open belfry: an arch's dark each side near the top
      const g = ax === 'x' ? box(tx + s * tw, th - 5, tz - 1.2, tx + s * (tw + 0.02), th - 1.4, tz + 1.2) : box(tx - 1.2, th - 5, tz + s * tw, tx + 1.2, th - 1.4, tz + s * (tw + 0.02));
      batch.add('dark', g, I, 0x1a1418);
    }
    batch.add('concrete', box(tx - tw - 0.2, th, tz - tw - 0.2, tx + tw + 0.2, th + 0.3, tz + tw + 0.2), I, 0xeee6d6);
    batch.add('bronze', new THREE.ConeGeometry(tw * 1.3, 3, 4).rotateY(Math.PI / 4).translate(tx, th + 1.8, tz), I, 0xffffff);
    ctx.solids.push({ c: V(tx, th / 2, tz), half: V(tw, th / 2, tw), q: new THREE.Quaternion() });
  } else {
    // Harbor Square: a compass rose in the paving, a ship's anchor on a granite plinth, a tall flagstaff
    const rose = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 3.2 : i % 4 ? 5.5 : 8.5; rose.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    batch.add('pavers', new THREE.ShapeGeometry(new THREE.Shape(rose)).rotateX(-Math.PI / 2).translate(cx, 0.153, cz), I, 0x6a7a8a);
    batch.add('pavers', new THREE.RingGeometry(8.6, 9.4, 48).rotateX(-Math.PI / 2).translate(cx, 0.153, cz), I, 0x8a7a64);
    batch.add('concrete', box(cx - 1.6, 0.15, cz + 18 - 1.6, cx + 1.6, 1.4, cz + 18 + 1.6), I, 0x8c8580);
    const ax = cx, az = cz + 18, ay = 1.4;
    batch.add('iron', new THREE.CylinderGeometry(0.16, 0.16, 3.8, 10).translate(ax, ay + 1.9, az), I, 0x2a2826);
    batch.add('iron', new THREE.TorusGeometry(0.42, 0.09, 8, 18).translate(ax, ay + 4.1, az), I, 0x2a2826);
    batch.add('iron', new THREE.BoxGeometry(2.0, 0.22, 0.22).translate(ax, ay + 3.2, az), I, 0x2a2826);
    batch.add('iron', new THREE.TorusGeometry(1.45, 0.15, 8, 24, Math.PI).rotateZ(Math.PI).translate(ax, ay + 1.45, az), I, 0x2a2826);
    for (const s of [-1, 1]) batch.add('iron', new THREE.ConeGeometry(0.32, 0.7, 4).rotateZ(s * 0.7).translate(ax + s * 1.5, ay + 1.55, az), I, 0x2a2826);
    ctx.solids.push({ c: V(ax, 0.78, az), half: V(1.6, 0.63, 1.6), q: new THREE.Quaternion() }, { c: V(ax, ay + 2.2, az), half: V(1.6, 2.2, 0.3), q: new THREE.Quaternion() });
    batch.add('metal', cyl(0.12, 0.2, 22, cx, 0.15, cz - 20, 10), I, 0xe6e8ea);
    batch.add('metal', new THREE.SphereGeometry(0.3, 10, 8).translate(cx, 22.3, cz - 20), I, 0xc8a24a);
    batch.add('concrete', box(cx - 1, 0.15, cz - 21, cx + 1, 0.6, cz - 19), I, 0xd8cfbe);
    ctx.solids.push({ c: V(cx, 11, cz - 20), half: V(0.25, 11, 0.25), q: new THREE.Quaternion() });
  }
  // benches round the middle
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const x = cx + Math.cos(a) * 15, z = cz + Math.sin(a) * 15 * 1.6; if (Math.abs(x - cx) > W / 2 - 8) continue; put('bench', x, z, Math.atan2(cx - x, cz - z)); }
  // a newsstand's boxes and a phone at the corners
  void stream;
}
