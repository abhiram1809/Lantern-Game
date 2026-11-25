// Coast City's ground (2026-11-19; the map rework, 2026-11-24). One material over all of the city's land: level
// ground in 100 m tiles at y 0 (one quad each: a triangle kilometres across loses its depth at the near plane), the
// hills, the beach and the banks in tiles of their own that follow the ground's height (city/Relief.js, Terrain.js),
// everything painted in the shader: the streets the plan has (Plan.streetSegments: a stretch of street only where
// there's a block beside it), their lanes and crossings (crosswalks and stop bars only where three or four streets
// meet), the pavements' concrete (the real pavements, 14 cm up, stand on it near the camera), the blocks' alleys,
// downtown's paved plots, the parks (Coast Park as one across its blocks), the plazas, the promenade and the beach
// down into the sea, the quaysides, the waste ground between, the hills' dry grass, scrub and earth, and at the
// city's edge the desert's own sand. The water is city/Water.js.
import * as THREE from 'three';
import { pbrMaterial } from '../fx/Textures.js';
import { CITY, HALS_LOT, PROMENADE, LOT_Z, K_MIN, K_MAX, STREET_Z, cityCells, streetSegments } from './Plan.js';
import { HOME_LOT } from './HalsHome.js';
import { PARKS } from './Layout.js';
import { cityU } from './Kit.js';
import { TERRAIN_GLSL, terrainTextures, terrainY, sdfAt, zoneAt, inHills, WATER_Y, W_BEACH } from './Terrain.js';
import { ReliefTiles } from './Relief.js';
import { cityWater } from './Water.js';

const f1 = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const WY = (d) => f1(+(WATER_Y + d).toFixed(3)); // (the water's height and a bit, as a GLSL float)

// The roads' wear (the polish pass, 2026-11-23), shared by the city's ground and the road in from the field
// (Ferris.buildRoad, which runs on up Hal's street): two tyre tracks to a lane at `a` and `b` from the road's
// middle, and the ruts they wear as a bump on the normal (from the height's change across the pixel, so it
// must be worked out outside any branch).
export const WEAR_GLSL = /* glsl */`
float wTracks(float d, float a, float b) { return 2.0 - smoothstep(0.16, 0.36, abs(d - a)) - smoothstep(0.16, 0.36, abs(d - b)); }
vec3 wBump(vec3 n, vec3 sp, float hgt, float face) {
  vec3 sx = dFdx(sp), sy = dFdy(sp);
  vec2 dH = vec2(dFdx(hgt) / max(length(sx), 1e-4), dFdy(hgt) / max(length(sy), 1e-4));
  vec3 ux = normalize(sx), uy = normalize(sy), r1 = cross(uy, n), r2 = cross(n, ux);
  float det = dot(ux, r1) * face;
  return normalize(abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2));
}`;
// The wear on a plain road material running north-south with its middle at world x `mid` (Ferris's road in)
export function wearRoad(mat, mid) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uWear = cityU.uWear;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWw; uniform float uWear;
      ${WEAR_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float trk = 0.0, rVar = 1.0;
      if (uWear > 0.001) {
        vec4 big = texture2D(roughnessMap, vWw.xz / 41.0), mid = texture2D(roughnessMap, vWw.xz / 13.0);
        trk = clamp(wTracks(abs(vWw.x - ${mid.toFixed(2)}), 1.45, 3.05), 0.0, 1.0) * clamp(big.g * 1.6 - 0.2, 0.0, 1.0) * uWear;
        diffuseColor.rgb *= (0.9 + 0.25 * (big.g - 0.5)) * (1.0 - 0.3 * trk);
        rVar = (0.88 + 0.4 * (mid.g - 0.5)) * mix(1.0, 0.42, trk);
      }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= rVar;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = wBump(normal, -vViewPosition, -0.006 * trk * (1.0 - smoothstep(25.0, 70.0, length(vViewPosition))), faceDirection);');
  };
  mat.customProgramCacheKey = () => `wornRoad${mid}`;
  return mat;
}

// The desert's sand as Ferris's desert paints it (by the world's x and z), so the city's waste ground can turn into
// it at the city's edge without a seam: the same texture at the same scale, the same patches of hardpan and wash.
export const DESERT_GLSL = /* glsl */`
float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(dHash(i), dHash(i + vec2(1, 0)), f.x), mix(dHash(i + vec2(0, 1)), dHash(i + vec2(1, 1)), f.x), f.y); }
vec3 desertLook(sampler2D sandTex, vec2 w) {
  vec3 c = texture2D(sandTex, vec2(w.x, -w.y) / 3.0189).rgb * vec3(1.15, 1.08, 1.0);
  float gA = dNoise(w / 90.0) * 0.6 + dNoise(w / 23.0) * 0.3 + dNoise(w / 6.0) * 0.1;
  float gB = dNoise(w / 41.0 + 7.3);
  c *= mix(vec3(1.08, 1.02, 0.94), vec3(0.86, 0.7, 0.58), smoothstep(0.45, 0.75, gA));
  c *= mix(1.0, 0.82, smoothstep(0.6, 0.85, gB));
  c *= 0.9 + 0.12 * dNoise(w * 1.7) + 0.08 * dNoise(w * 9.0);
  return c;
}`;

// ------------------------------------------------------------------------------------------------ the streets' map
// A texel for each street (k, along x) and each row of the grid (along z): R the north-south stretch of street k from
// row r to the next, G the east-west one along row r from street k to the next, B the block between streets k, k + 1
// and rows r, r + 1 (what it is: CELL), A how many stretches meet at street k and row r (a real crossing has three
// or four: its crosswalks and stop bars).
const NK = K_MAX - K_MIN + 1, NR = STREET_Z.length;
const CELL = { built: 1, downtown: 2, park: 3, plaza: 4, big: 5, half: 6 };
function streetMap() {
  const data = new Uint8Array(NK * NR * 4), at = (k, r) => ((r * NK) + (k - K_MIN)) * 4, deg = new Uint8Array(NK * NR);
  const row = (z) => STREET_Z.indexOf(z);
  for (const s of streetSegments()) {
    if (s.ns) { const r = row(s.z0); data[at(s.k, r)] = 255; deg[r * NK + s.k - K_MIN]++; deg[(r + 1) * NK + s.k - K_MIN]++; }
    else { const k = Math.round((s.x0 - 6) / 80); data[at(k, s.s) + 1] = 255; deg[s.s * NK + k - K_MIN]++; deg[s.s * NK + k + 1 - K_MIN]++; }
  }
  for (const c of cityCells()) {
    const code = c.half ? CELL.half : c.park === 'big' ? CELL.big : c.park === 'plaza' ? CELL.plaza : c.park ? CELL.park : c.district === 'downtown' ? CELL.downtown : CELL.built;
    data[at(c.j, c.r) + 2] = code * 32;
  }
  for (let r = 0; r < NR; r++) for (let k = 0; k < NK; k++) data[(r * NK + k) * 4 + 3] = deg[r * NK + k] * 50;
  const t = new THREE.DataTexture(data, NK, NR, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const STREET_GLSL = /* glsl */`
uniform highp sampler2D uStreets;
const float ROWS[${NR}] = float[${NR}](${STREET_Z.map(f1).join(', ')});
// the row a z is past (-1 south of the first), the map's texel for street (or block) k and row r
float sRowOf(float z) { float r = -1.0; for (int i = 0; i < ${NR}; i++) if (z >= ROWS[i]) r = float(i); return r; }
vec4 sAt(float k, float r) { return (k < ${f1(K_MIN)} || k > ${f1(K_MAX)} || r < 0.0 || r > ${f1(NR - 1)}) ? vec4(0.0) : texelFetch(uStreets, ivec2(int(k - ${f1(K_MIN)}), int(r)), 0); }
float sCell(float k, float r) { return floor(sAt(k, r).b * 255.0 / 32.0 + 0.5); }
float sNS(float k, float r) { return r < ${f1(NR - 1)} ? step(0.5, sAt(k, r).r) : 0.0; }
float sEW(float k, float r) { return step(0.5, sAt(k, r).g); }`;

// a small park's paths: a walk round inside its edge, two corner to corner, a ring round its middle. In metres from its
// south-west corner across a park S in size; `ring` the ring's inner and outer radius. (Stream.park keeps its trees
// off these.) Coast Park lays its own ground (city/Parks.js: its lawns, paths and water over the whole of it).
const PARK_GLSL = /* glsl */`
float parkPath(vec2 u, vec2 S, vec2 ring, float w, float pw) {
  float edge = min(min(u.x, S.x - u.x), min(u.y, S.y - u.y));
  vec2 dg = normalize(S);
  float d1 = abs(u.x * dg.y - u.y * dg.x), d2 = abs((S.x - u.x) * dg.y - u.y * dg.x), r = length(u - S * 0.5);
  float band = clamp(min(edge - 2.6, 5.0 - edge) / w + 0.5, 0.0, 1.0);
  float diag = (1.0 - smoothstep(pw - 0.2, pw + 0.2, min(d1, d2))) * step(ring.y - 0.5, r);
  float rg = clamp(min(r - ring.x, ring.y - r) / w + 0.5, 0.0, 1.0);
  return max(max(band, diag), rg);
}`;
const COAST = PARKS.find((p) => p.id === 'coast');

// ------------------------------------------------------------------------------------------------ the material
function groundMaterial() {
  const mat = pbrMaterial('asphalt_02', { repeat: [1, 1], detailRepeat: [1, 1] }); // (the geometry's UVs are the lot's metres / 3)
  const conc = pbrMaterial('concrete_pavement', { repeat: [1, 1] }).map, sand = pbrMaterial('gravelly_sand', { repeat: [1, 1] }).map;
  const streets = streetMap(), tex = terrainTextures();
  const H = HALS_LOT, C = COAST;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tex.uniforms);
    sh.uniforms.uConc = { value: conc };
    sh.uniforms.uSand = { value: sand };
    sh.uniforms.uStreets = { value: streets };
    sh.uniforms.uWear = cityU.uWear; // (the roads' wear: 0 off, for measuring it)
    sh.uniforms.uTime = cityU.uTime;
    sh.uniforms.uCemetery = groundU.uCemetery;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGp; varying vec3 vGn;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGp = (modelMatrix * vec4(transformed, 1.0)).xyz; vGn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGp; varying vec3 vGn;
      uniform sampler2D uConc, uSand;
      uniform float uWear, uTime, uCemetery;
      ${TERRAIN_GLSL}
      ${STREET_GLSL}
      ${DESERT_GLSL}
      ${PARK_GLSL}
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      // three octaves turned against each other, the first bent by another (patches that don't line up on the lattice)
      float gFbm(vec2 p) {
        p += vec2(gNoise(p * 0.5 + 3.7), gNoise(p * 0.5 - 1.9)) * 1.4;
        return gNoise(p) * 0.55 + gNoise(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03 + 5.1) * 0.3 + gNoise(mat2(0.36, -0.93, 0.93, 0.36) * p * 4.1 - 2.3) * 0.15;
      }
      // a line from a to b across x, anti-aliased over a pixel w wide (thinner than one, dimmed)
      float gBand(float x, float a, float b, float w) { return clamp(min(x - a, b - x) / max(w, 1e-4) + 0.5, 0.0, 1.0); }
      ${WEAR_GLSL}`)
      .replace('#include <map_fragment>', `
      vec2 p = vec2(vGp.x, vGp.z - ${f1(LOT_Z)});
      vec4 inf = tInfo(p);
      float zone = inf.b;
      if (zone < 0.5) discard; // (the desert's: Ferris.buildGround)
      float sdf = tSdf(p);
      if (sdf < 0.0 && vGp.y > ${WY(0.05)}) discard; // (the water's, past a quay's edge: the banks go on down under it)
      if (vGp.y < ${WY(-0.03)}) discard; // (under the water: from high up the depth can't tell a beach's shelf from the water over it)
      // what has its own ground: Hal's lot, the memorial park's lawn and its drive (Ferris.cemetery), the road in from
      // the field up Hal's street (Ferris.buildRoad)
      if (p.x > ${f1(HOME_LOT.x0)} && p.x < ${f1(HOME_LOT.x1)} && p.y > ${f1(HOME_LOT.z0)} && p.y < ${f1(HOME_LOT.z1)}) discard;
      if (uCemetery > 0.5 && ((p.x > 118.02 && p.x < 181.98 && p.y > -875.98 && p.y < -824.02) || (p.x > 12.02 && p.x < 233.98 && p.y > -923.98 && p.y < -826.02))) discard; // (once it's built: its lawn, and its grounds out to the streets)
      if (uCemetery > 0.5 && p.x > 10.02 && p.x < 117.98 && p.y > -852.98 && p.y < -847.02) discard;
      if (p.x > 2.02 && p.x < 9.98 && p.y > -404.0 && p.y < -14.0) discard;
      if (p.x > ${f1(C.x0 + 0.02)} && p.x < ${f1(C.x1 - 0.02)} && p.y > ${f1(C.z0 + 0.02)} && p.y < ${f1(C.z1 - 0.02)}) discard; // (Coast Park's own lawns: city/Parks.js)
      float fwX = fwidth(p.x), fwZ = fwidth(p.y), fw = max(fwX, fwZ);
      // ---- where it is on the grid: the nearest north-south street (k) and east-west row (s), the block (j, r)
      float kf = clamp(floor((p.x - 6.0) / 80.0 + 0.5), ${f1(K_MIN)}, ${f1(K_MAX)}), dx = p.x - (6.0 + 80.0 * kf);
      float jf = floor((p.x - 6.0) / 80.0), r = sRowOf(p.y);
      float rIn = step(0.0, r) * (1.0 - step(${f1(NR - 1)}, r));
      float zA = ROWS[int(clamp(r, 0.0, ${f1(NR - 1)}))], zB = ROWS[int(clamp(r + 1.0, 0.0, ${f1(NR - 1)}))];
      float sI = r < 0.0 ? 0.0 : r >= ${f1(NR - 1)} ? ${f1(NR - 1)} : (p.y - zA < zB - p.y ? r : r + 1.0);
      float dz = p.y - ROWS[int(sI)], ax = abs(dx), az = abs(dz);
      float boul = 1.0 - step(0.5, abs(kf));
      float kerbNS = mix(7.0, 6.4, boul), frontNS = mix(12.0, 11.9, boul);
      float nsSeg = sNS(kf, r) * (1.0 - boul * step(-24.0, p.y) * step(p.y, 64.0)); // (no boulevard through Hal's lot and building)
      float ewSeg = sEW(jf, sI), deg = floor(sAt(kf, sI).a * 255.0 / 50.0 + 0.5);
      float sideK = dx < 0.0 ? kf - 1.0 : kf, sideR = dz < 0.0 ? sI - 1.0 : sI;
      float cellOn = step(0.5, sCell(sideK, sideR)), cellK = step(0.5, sCell(sideK, r)), cellR = step(0.5, sCell(jf, sideR));
      // ---- road and pavement
      float road = 0.0, pave = 0.0;
      bool inNS = ax < kerbNS, inEW = az < 6.0, padNS = ax < frontNS, padEW = az < 11.0;
      if (inNS && inEW) road = step(0.5, deg); // a crossing's box
      else if (inNS) { road = nsSeg; if (!(road > 0.5) && padEW) pave = step(0.5, sCell(kf - 1.0, sideR)) * step(0.5, sCell(kf, sideR)) * max(sEW(kf - 1.0, sI), sEW(kf, sI)); } // (across a missing street, its blocks' pavements meet)
      else if (inEW) { road = ewSeg; if (!(road > 0.5) && padNS) pave = step(0.5, sCell(sideK, sI - 1.0)) * step(0.5, sCell(sideK, sI)) * max(sNS(kf, sI - 1.0), sNS(kf, sI)); }
      else if (padNS && padEW) pave = cellOn * max(sNS(kf, sideR), sEW(sideK, sI)); // a corner, round its block
      else if (padNS) pave = nsSeg * cellK; // beside a north-south street, where it has a block
      else if (padEW) pave = ewSeg * cellR; // beside an east-west one
      float inBlock = rIn * (1.0 - step(ax, frontNS)) * (1.0 - step(az, 11.0));
      float code = inBlock > 0.5 ? sCell(jf, r) : 0.0;
      // ---- the surfaces
      vec4 asph = texture2D(map, p * 0.11) * vec4(0.9, 0.88, 0.85, 1.0);
      vec4 cc = texture2D(uConc, p / 3.0) * vec4(1.08, 1.05, 1.0, 1.0);
      vec4 sdT = texture2D(uSand, p / 2.2), sdF = texture2D(uSand, p / 7.0);
      float sdl = dot(sdF.rgb, vec3(0.33)), lum = dot(asph.rgb, vec3(0.33));
      float rVar = 1.0;
      vec3 col = asph.rgb * 0.82; // (the blocks' alleys and yards)
      // a park's grass: Southern California's, a dusty, mottled green, drier in patches, the mower's stripes faint
      float dryG = smoothstep(0.35, 0.78, gNoise(p / 13.0) * 0.45 + gNoise(p / 4.0) * 0.2 + sdl * 0.5);
      vec3 grass = mix(vec3(0.13, 0.2, 0.075), vec3(0.24, 0.25, 0.12), dryG) * (0.7 + 0.55 * lum);
      vec3 walk = cc.rgb * vec3(0.95, 0.9, 0.82);
      // (linear colours: what the eye calls a straw-gold is a third of that in light)
      float grain = 0.62 + 1.4 * sdl;
      vec3 dsrt = desertLook(uSand, vGp.xz); // (read here, out of the branches: its texture's mip wants the pixel's neighbours)
      if (road > 0.5) col = asph.rgb;
      else if (pave > 0.5) col = cc.rgb;
      else if (code > 4.5 && code < 5.5) col = grass; // (Coast Park's: under its own lawns, city/Parks.js)
      else if (code > 2.5 && code < 3.5) {
        // a small park: a path round it inside the hedge, two across it corner to corner, a ring round the fountain
        vec2 b0 = vec2(6.0 + 80.0 * jf + 12.0, zA + 11.0), u = p - b0, S = vec2(56.0, zB - zA - 22.0);
        col = mix(grass * (0.96 + 0.04 * step(0.5, fract(u.y / 6.0))), walk, parkPath(u, S, vec2(8.6, 11.0), fw, 1.3));
        col = mix(col, walk, 1.0 - smoothstep(8.4, 8.7, length(u - S * 0.5)));
      } else if (code > 3.5 && code < 4.5) {
        // a plaza: big slabs of pale stone in a grid, a darker band round its edge, a circle in its middle
        vec2 b0 = vec2(6.0 + 80.0 * jf + 12.0, zA + 11.0), u = p - b0, S = vec2(56.0, zB - zA - 22.0);
        vec2 g = abs(fract(u / 1.8) - 0.5);
        float joint = 1.0 - smoothstep(0.46, 0.49, max(g.x, g.y));
        vec3 slab = cc.rgb * vec3(1.06, 1.03, 0.97) * (0.93 + 0.1 * gHash(floor(u / 1.8)));
        col = mix(slab * 0.78, slab, joint);
        float edge = min(min(u.x, S.x - u.x), min(u.y, S.y - u.y)), rr = length(u - S * 0.5);
        col = mix(col, cc.rgb * vec3(0.78, 0.74, 0.7), gBand(edge, 0.0, 1.6, fw));
        col = mix(col, cc.rgb * vec3(0.82, 0.76, 0.7), gBand(rr, 12.0, 13.2, fw));
      } else if (code > 1.5 && code < 2.5) col = cc.rgb * vec3(1.02, 1.0, 0.96); // downtown's plots: paved, towers on their plazas
      else if (code < 0.5) {
        // no block here: the promenade, the beach, the port's yards, the quaysides, the waste ground, the hills
        // the waste ground: dirt and dry grass, a few greener patches, and at the city's edge the desert's sand
        float fb = gFbm(p / 23.0), fs = gFbm(p / 7.0 + 3.1);
        vec3 dirt = vec3(0.2, 0.148, 0.088) * grain, straw = vec3(0.27, 0.198, 0.088) * grain;
        vec3 verge = mix(dirt, straw, smoothstep(0.3, 0.7, fb * 0.65 + fs * 0.35));
        verge = mix(verge, vec3(0.085, 0.1, 0.035) * grain, smoothstep(0.62, 0.78, gFbm(p / 41.0 + 7.7) * 0.7 + fs * 0.3) * 0.6);
        verge = mix(verge, dsrt, (1.0 - smoothstep(0.6, 0.92, zone)));
        // the hills: dry golden grass over them, the chaparral's dark scrub in clumps, thicker on the slopes facing north
        // and down the folds, the earth where they're cut steep (the roads' and terraces' banks)
        // (up close the grass in tufts and the dirt between them, fading to its average where they're under a pixel)
        float tuftK = 1.0 - smoothstep(0.08, 0.35, fw);
        float tuft = mix(0.5, gNoise(p * 1.9) * 0.55 + gNoise(mat2(0.8, -0.6, 0.6, 0.8) * p * 4.7) * 0.45, tuftK);
        verge *= 0.84 + 0.32 * tuft;
        float hill = smoothstep(0.05, 1.2, vGp.y);
        vec3 hillG = verge;
        if (hill > 0.0) {
          float slope = 1.0 - clamp(vGn.y, 0.0, 1.0);
          hillG = mix(vec3(0.37, 0.25, 0.095), vec3(0.27, 0.18, 0.07), smoothstep(0.3, 0.7, fb)) * grain * (0.8 + 0.4 * tuft);
          float scrub = smoothstep(0.52, 0.62, gFbm(p / 31.0 + 1.3) * 0.7 + fs * 0.22 + vGn.z * 0.45 - 0.02 + slope * 0.2);
          float clump = smoothstep(0.6, 0.72, gFbm(p / 4.5 + 9.1)); // (single bushes out on the grass)
          hillG = mix(hillG, vec3(0.04, 0.052, 0.018) * (0.8 + 0.8 * sdl), max(scrub * 0.9, clump * 0.7));
          hillG = mix(hillG, vec3(0.2, 0.13, 0.075) * grain, smoothstep(0.34, 0.5, slope + (fs - 0.5) * 0.12) * (1.0 - scrub * 0.6));
        }
        float quayside = (1.0 - smoothstep(6.0, 7.0, sdf)) * (1.0 - step(-330.0, p.x) * step(p.x, 720.0) * step(p.y, -800.0));
        if (p.x < ${f1(PROMENADE.x0)} && p.y < 2252.0 && p.y > -1000.0) {
          // the beach: pale sand, raked smooth up by the promenade, wetter as it goes down to the water (and the
          // swash running up it and back, darkening it as it goes)
          vec3 sd = mix(vec3(dot(sdT.rgb, vec3(0.3, 0.59, 0.11))), sdT.rgb, 0.5) * vec3(1.42, 1.34, 1.18);
          float wet = (1.0 - smoothstep(${WY(0.05)}, -0.55, vGp.y));
          float swash = (1.0 - smoothstep(${WY(0.05)}, ${WY(0.45)}, vGp.y - 0.2 - 0.2 * sin(uTime * 0.55 + p.y * 0.031) - 0.07 * sin(uTime * 1.3 + p.y * 0.11)));
          float damp = max(wet * 0.8, swash);
          col = mix(sd, sd * vec3(0.52, 0.5, 0.47), damp);
          rVar = mix(1.0, 0.32, swash * 0.9 + wet * 0.3); // (the sand the wash has just left shines)
          // the line of froth and weed the last wave left, a little up the sand
          col = mix(col, sd * 1.08, gBand(vGp.y + 0.03 * sin(p.y * 0.07), ${WY(0.34)}, ${WY(0.42)}, fw * 0.05 + 0.002) * 0.35 * smoothstep(0.4, 0.7, gNoise(p * 0.4)));
        }
        else if (p.x < ${f1(PROMENADE.x1)} && p.y < 2252.0 && p.y > -1000.0) col = cc.rgb; // the promenade (its paving stands on this)
        else if (p.y > 2090.0 && p.x < 400.0 && p.y < 3120.0) {
          // the port's yards and the shipyards: concrete in big bays, a few old stains, the joints between the pours
          vec2 g = abs(fract(p / vec2(12.0, 6.0)) - 0.5);
          col = cc.rgb * vec3(0.96, 0.95, 0.92) * (0.92 + 0.08 * fb) * (1.0 - 0.12 * smoothstep(0.47, 0.495, max(g.x, g.y)));
          col = mix(col, col * vec3(0.62, 0.58, 0.54), smoothstep(0.66, 0.8, gFbm(p / 9.0 + 2.2)) * 0.35);
          col = mix(col, verge, (1.0 - smoothstep(0.6, 0.85, zone)));
        } else col = mix(mix(verge, hillG, hill), cc.rgb * vec3(0.92, 0.9, 0.86), quayside);
        // a bank going down to the water: earth, stones at the water, and wet below the tide's line
        float bank = (1.0 - smoothstep(-0.4, -0.05, vGp.y)) * step(${f1(PROMENADE.x0)}, p.x);
        vec3 mud = mix(vec3(0.13, 0.1, 0.07), vec3(0.24, 0.22, 0.19), smoothstep(0.55, 0.7, gFbm(p / 1.7))) * grain;
        mud = mix(mud, mud * vec3(0.5, 0.55, 0.45), (1.0 - smoothstep(${WY(0.1)}, ${WY(0.6)}, vGp.y)));
        col = mix(col, mud, bank);
      }
      // ---- the roads worn (the polish pass, 2026-11-23): patches of older and newer asphalt, and two tyre tracks to a
      // lane, darker and glossier, a few millimetres worn in (below: the roughness and the normal); not across the
      // crossings (on the roads' pixels only, from low-frequency reads of the textures it has)
      vec4 big = texture2D(uSand, p / 41.0), mid = texture2D(uConc, p / 13.0);
      float trk = 0.0;
      if (road > 0.5 && uWear > 0.001) {
        float tNS = wTracks(ax, 1.45, 3.05), tEW = wTracks(az, 1.05, 2.65), arm = float(inNS) * (1.0 - float(inEW)), armE = float(inEW) * (1.0 - float(inNS));
        trk = clamp(tNS * arm + tEW * armE, 0.0, 1.0) * clamp(0.2 + big.r * 1.3, 0.0, 1.0) * uWear;
        col *= (0.88 + 0.3 * (big.g - 0.35)) * (1.0 - 0.3 * trk);
        rVar = (0.86 + 0.5 * (mid.b - 0.45)) * mix(1.0, 0.42, trk);
      }
      // ---- the lines: not where Hal's blocks paint their own
      float own = step(-8.0, p.x) * step(p.x, 20.0) * step(-412.0, p.y) * step(p.y, -20.0) + step(-52.0, p.x) * step(p.x, 62.0) * step(-234.0, p.y) * step(p.y, -186.0);
      float mark = 0.0; vec3 mc = vec3(0.83, 0.82, 0.78);
      float yb = gBand(ax, 0.06, 0.16, fwX), wb = gBand(ax, 4.35, 4.45, fwX), ybz = gBand(az, 0.06, 0.16, fwZ), wbz = gBand(az, 3.55, 3.65, fwZ);
      float barNb = gBand(dz * -sign(dx), 10.6, 11.0, fwZ), barEb = gBand(dx * sign(dz), kerbNS + 4.0, kerbNS + 4.4, fwX);
      if (own < 0.5 && road > 0.5) {
        float real = step(2.5, deg); // (three or four streets: a real crossing)
        float straightNS = (1.0 - real) * sNS(kf, sI - 1.0) * sNS(kf, sI), straightEW = (1.0 - real) * sEW(kf - 1.0, sI) * sEW(kf, sI);
        float box = float(inNS && inEW);
        // down the north-south streets: the double yellow, the parking lanes' lines (on through a crossing that's only a bend
        // in the street: through the box where it runs straight on)
        float alongNS = float(inNS) * (1.0 - box) * mix(step(11.0, az), 1.0, 1.0 - real) + box * straightNS;
        float alongEW = float(inEW) * (1.0 - box) * mix(step(frontNS, ax), 1.0, 1.0 - real) + box * straightEW;
        float yl = yb * alongNS, wl = wb * alongNS, ylz = ybz * alongEW, wlz = wbz * alongEW;
        // the crosswalks over each street at a crossing, and the stop bars before them
        float cwNS = real * float(inNS) * step(7.0, az) * step(az, 10.0) * step(fract(p.x / 0.95), 0.52);
        float cwEW = real * float(inEW) * step(kerbNS + 0.6, ax) * step(ax, kerbNS + 3.6) * step(fract(p.y / 0.95), 0.52);
        float barN = real * float(inNS) * (1.0 - box) * barNb * step(0.2, ax);
        float barE = real * float(inEW) * (1.0 - box) * barEb * step(0.2, az);
        float y = max(yl, ylz);
        mark = max(max(wl, wlz), max(cwNS, cwEW) + max(barN, barE));
        mc = mix(mc, vec3(0.82, 0.62, 0.18), step(mark, y));
        mark = clamp(max(mark, y), 0.0, 1.0);
        mark *= 0.75 + 0.25 * gHash(floor(p * 2.0)); // (worn: the paint thins where the tyres run)
      }
      col = mix(col, mc, mark * 0.85);
      diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= rVar;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = wBump(normal, -vViewPosition, -0.006 * trk * (1.0 - smoothstep(25.0, 70.0, length(vViewPosition))), faceDirection); // (the ruts; the asphalt's own normal map is the aggregate)`);
  };
  mat.customProgramCacheKey = () => 'cityGround2';
  return mat;
}

// ------------------------------------------------------------------------------------------------ the ground
// Its tiles: 100 m on the lot's lattice over the city's ground (Terrain.zoneAt), level ones one quad each, the rest
// relief (Relief.js); none that are all water or all the desert's.
const TILE = 100, GX0 = -1900, GZ0 = -1100, GX1 = 2200, GZ1 = 3300;
const uvOf = (x, z) => [x / 3, -z / 3];
function* tileSteps(out) {
  const flat = [], relief = [];
  for (let z0 = GZ0; z0 < GZ1; z0 += TILE) {
    for (let x0 = GX0; x0 < GX1; x0 += TILE) {
      let zone = 0, land = false, bumpy = false;
      // (relief where any of it that's out of the water isn't level: the hills' rise, a beach or a bank going down; a
      // quay's tile is level, its wall and the bed under the water are no matter of the ground's)
      const seen = (x, z) => { const y = terrainY(x, z); return Math.abs(y) > 0.002 && y > WATER_Y - 0.03; };
      for (let j = 0; j <= 10; j++) for (let i = 0; i <= 10; i++) {
        const x = x0 + i * 10, z = z0 + j * 10;
        zone = Math.max(zone, zoneAt(x, z));
        const d = sdfAt(x, z);
        if (d > -2) land = true;
        if (!bumpy && ((d < W_BEACH + 12 && d > -40) || (inHills(x, z) && terrainY(x, z) !== 0))) {
          // (a finer look where it might not be level)
          for (let q = 0; q < 4 && !bumpy; q++) for (let w = 0; w < 4; w++) if (seen(x + q * 2.5 - 5, z + w * 2.5 - 5)) { bumpy = true; break; }
        }
      }
      if (zone < 0.45 || !land) continue;
      (bumpy ? relief : flat).push({ x0, z0 });
    }
    yield;
  }
  out.flat = flat;
  out.relief = relief;
}
function flatGeometry(tiles) {
  const n = tiles.length, pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = [];
  tiles.forEach((t, k) => {
    [[0, 0], [TILE, 0], [0, TILE], [TILE, TILE]].forEach(([dx, dz], c) => {
      const x = t.x0 + dx, z = t.z0 + dz, v = k * 4 + c;
      pos.set([x, 0, z], v * 3);
      nor.set([0, 1, 0], v * 3);
      uv.set(uvOf(x, z), v * 2);
    });
    const a = k * 4;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// The city's ground, built a stage at a time (Ferris.steps, before the city: Stream.js only adds it).
let BUILT = null;
export function* buildCityGround() {
  if (BUILT) return BUILT;
  const mat = groundMaterial(), tiles = {};
  yield* tileSteps(tiles);
  const group = new THREE.Group();
  group.name = 'cityGround';
  const flat = new THREE.Mesh(flatGeometry(tiles.flat), mat);
  flat.position.set(0, 0, LOT_Z);
  flat.receiveShadow = true;
  flat.name = 'cityGround flat';
  flat.matrixAutoUpdate = false;
  flat.updateMatrix();
  group.add(flat);
  const relief = new ReliefTiles({ material: mat, tiles: tiles.relief, size: TILE, height: (x, z, level) => terrainY(x, z, true, level), uv: uvOf, origin: new THREE.Vector3(0, 0, LOT_Z), name: 'cityGround relief', castShadow: true });
  group.add(yield* relief.build());
  group.userData.relief = relief;
  group.userData.update = (camera) => relief.update(camera);
  group.userData.tiles = tiles;
  BUILT = group;
  return group;
}
// (Stream.js asks for it by this name)
export function cityGround() {
  if (!BUILT) { const it = buildCityGround(); let r; while (!(r = it.next()).done); }
  return BUILT;
}
export const cityGroundBuilt = () => BUILT;
// what the ground leaves to others once they're there (uCemetery: the memorial park's lawn and drive, Ferris.cemetery)
export const groundU = { uCemetery: { value: 0 } };

// The water round the city (city/Water.js), by its old name
export const cityOcean = () => cityWater();
export { CITY };
