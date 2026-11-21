// Coast City's ground and its sea (2026-11-19). The ground is one mesh over the whole city in 100 m
// tiles (a triangle kilometres across loses its depth at the near plane: see Gotchas), at y 0, its
// streets painted in the shader from the plan's grid: asphalt, the lane lines and crosswalks, the stop
// bars, the pavements' concrete (the real pavements, 14 cm up, stand on it near the camera), the
// alleys, downtown's plazas, the promenade and the beach down to the waterline. The sea is the bay
// west of the shore, waves in its normals, shallows and surf toward the beach.
import * as THREE from 'three';
import { pbrMaterial } from '../fx/Textures.js';
import { CITY, HALS_LOT, DOWNTOWN, PROMENADE, SHORE_GLSL, COAST_GLSL, LOT_Z, CHANNEL, K_MIN, K_MAX, cityCells } from './Plan.js';
import { cityU } from './Kit.js';

const tiled = (x0, x1, z0, z1, tile) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / tile), Math.ceil((z1 - z0) / tile)).rotateX(-Math.PI / 2);
  return g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
};

// the plan's streets in GLSL (the lot's frame): signed distance from the nearest north-south street's
// middle (and which), and from the nearest east-west one's
export const GRID_GLSL = /* glsl */`
float gNS(float x, out float k) { k = floor((x - 6.0) / 80.0 + 0.5); return x - (6.0 + 80.0 * k); }
float gEW(float z) {
  float n = clamp(floor((z - 70.0) / 200.0 + 0.5), 0.0, 17.0), d = z - (70.0 + 200.0 * n), d2 = z + 210.0;
  return abs(d2) < abs(d) ? d2 : d;
}`;

// which blocks are parks and which the channel (a texel a block: R a park, G the channel), for the
// shader to paint the parks' grass and paths from anywhere and to open the channel between its bridges
const NJ = K_MAX - K_MIN, NR = 20;
function cellMask() {
  const data = new Uint8Array(NJ * NR * 4);
  for (const c of cityCells()) {
    const i = ((c.r) * NJ + (c.j - K_MIN)) * 4;
    if (c.park) data[i] = 255;
    if (c.channel) data[i + 1] = 255;
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, NJ, NR, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function cityGround() {
  // (the mesh's UVs span the whole city: its normal and roughness repeat every 3 m of it)
  const mat = pbrMaterial('asphalt_02', { repeat: [1, 1], detailRepeat: [(CITY.x1 - CITY.x0 + 42) / 3, (CITY.z1 - CITY.z0 + 20) / 3], tint: new THREE.Color(0.9, 0.88, 0.85) });
  const conc = pbrMaterial('concrete_pavement', { repeat: [1, 1] }).map, sand = pbrMaterial('gravelly_sand', { repeat: [1, 1] }).map;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uConc = { value: conc };
    sh.uniforms.uSand = { value: sand };
    sh.uniforms.uCells = { value: cellMask() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGp;
      uniform sampler2D uConc, uSand, uCells;
      float rowEdge(float r) { return r < 0.5 ? -404.0 : r < 1.5 ? -210.0 : 70.0 + 200.0 * (r - 2.0); }
      ${GRID_GLSL}
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      // a line from a to b across x, anti-aliased over a pixel (thinner than one, dimmed)
      float gBand(float x, float a, float b) { float w = fwidth(x); return clamp(min(x - a, b - x) / max(w, 1e-4) + 0.5, 0.0, 1.0); }`)
      .replace('#include <map_fragment>', `
      vec2 p = vec2(vGp.x, vGp.z - ${LOT_Z.toFixed(1)});
      float shore = ${SHORE_GLSL('p.y')};
      if (p.x < shore - 0.5) discard; // (the sea's)
      if (p.x > ${HALS_LOT.x0 + 2}.0 && p.x < ${HALS_LOT.x1 - 14}.0 && p.y > -17.0 && p.y < 13.0) discard; // (Hal's lot: its own asphalt)
      float k; float dx = gNS(p.x, k), dz = gEW(p.y);
      float boul = step(abs(k), 0.5);
      // where the boulevard doesn't run (Hal's lot and building at its head) it's no street
      float nsOn = 1.0 - boul * step(-24.0, p.y) * step(p.y, 64.0);
      float kerbNS = mix(7.0, 6.4, boul), frontNS = mix(12.0, 11.9, boul);
      float ewOn = step(-404.0, p.y);
      float roadNS = nsOn * step(abs(dx), kerbNS), roadEW = ewOn * step(abs(dz), 6.0);
      float paveNS = nsOn * step(abs(dx), frontNS), paveEW = ewOn * step(abs(dz), 11.0);
      // the block it's in: a park, or the channel (opened between its bridges)
      float cj = floor((p.x - 6.0) / 80.0), cr = p.y < -210.0 ? 0.0 : p.y < 70.0 ? 1.0 : min(19.0, 2.0 + floor((p.y - 70.0) / 200.0));
      vec4 cm = texture2D(uCells, vec2((cj - ${K_MIN.toFixed(1)} + 0.5) / ${NJ.toFixed(1)}, (cr + 0.5) / ${NR.toFixed(1)}));
      if (cm.g > 0.5 && p.x > ${CHANNEL.x0.toFixed(1)} && p.x < ${CHANNEL.x1.toFixed(1)} && abs(dz) > 11.0 && p.y > -404.0) discard; // (the channel's: city/Landmarks.js)
      vec4 asph = texture2D(map, p * 0.11);
      vec4 cc = texture2D(uConc, p / 3.0) * vec4(1.08, 1.05, 1.0, 1.0);
      vec4 col = asph;
      // the blocks: alleys and lots dark asphalt; downtown's plazas paving
      float plaza = 1.0 - step(300.0, length(p - vec2(${DOWNTOWN.x}.0, ${DOWNTOWN.z}.0)));
      if (max(roadNS, roadEW) < 0.5) col = max(paveNS, paveEW) > 0.5 || plaza > 0.5 ? cc : asph * vec4(0.82, 0.8, 0.78, 1.0);
      // a park: grass (mown in stripes), a path round it inside the railings, two across it corner to
      // corner, a ring round the fountain's square in the middle
      if (cm.r > 0.5 && max(paveNS, paveEW) < 0.5) {
        float bx0 = 6.0 + 80.0 * cj + 12.0, bx1 = 6.0 + 80.0 * (cj + 1.0) - 12.0, bz0 = rowEdge(cr) + (cr > 0.5 ? 11.0 : 0.0), bz1 = rowEdge(cr + 1.0) - 11.0;
        vec2 u = vec2(p.x - bx0, p.y - bz0), S = vec2(bx1 - bx0, bz1 - bz0), c = S * 0.5;
        float edge = min(min(u.x, S.x - u.x), min(u.y, S.y - u.y));
        vec2 dg = normalize(S);
        float d1 = abs(u.x * dg.y - u.y * dg.x), d2 = abs((S.x - u.x) * dg.y - u.y * dg.x), r = length(u - c);
        float path = max(max(gBand(edge, 2.6, 5.0), max(1.0 - smoothstep(1.1, 1.5, min(d1, d2)), 0.0) * step(10.5, r)), gBand(r, 8.6, 11.0));
        float sq = 1.0 - smoothstep(8.4, 8.7, r);
        // (Southern California's grass: a dusty, mottled green, drier in patches, the mower's stripes faint)
        float lum = dot(asph.rgb, vec3(0.33)), sdl = dot(texture2D(uSand, p / 7.0).rgb, vec3(0.33));
        float dry = smoothstep(0.35, 0.78, gNoise(p / 13.0) * 0.45 + gNoise(p / 4.0) * 0.2 + sdl * 0.5);
        vec3 grass = mix(vec3(0.13, 0.2, 0.075), vec3(0.24, 0.25, 0.12), dry) * (0.7 + 0.55 * lum) * (0.96 + 0.04 * step(0.5, fract(u.y / 6.0)));
        col.rgb = grass;
        col.rgb = mix(col.rgb, cc.rgb * vec3(0.95, 0.9, 0.82), max(path, sq));
      }
      // the lines: not where Hal's blocks paint their own
      float own = step(-8.0, p.x) * step(p.x, 20.0) * step(-412.0, p.y) * step(p.y, -20.0) + step(-52.0, p.x) * step(p.x, 62.0) * step(-234.0, p.y) * step(p.y, -186.0);
      float mark = 0.0; vec3 mc = vec3(0.83, 0.82, 0.78);
      if (own < 0.5) {
        float inX = roadNS * roadEW; // (the intersection's box: no lines in it)
        // down the north-south streets: the double yellow, the parking lanes' lines
        float yl = (gBand(abs(dx), 0.06, 0.16)) * roadNS * (1.0 - roadEW) * (1.0 - step(abs(dz), 11.0));
        float wl = gBand(abs(dx), 4.35, 4.45) * roadNS * (1.0 - step(abs(dz), 11.0));
        // across the east-west ones
        float ylz = gBand(abs(dz), 0.06, 0.16) * roadEW * (1.0 - step(abs(dx), frontNS));
        float wlz = gBand(abs(dz), 3.55, 3.65) * roadEW * (1.0 - step(abs(dx), frontNS));
        // crosswalks over each street at the corners, and the stop bars before them
        float cwNS = roadNS * step(7.0, abs(dz)) * step(abs(dz), 10.0) * step(fract(p.x / 0.95), 0.52) * ewOn;
        float cwEW = roadEW * step(kerbNS + 0.6, abs(dx)) * step(abs(dx), kerbNS + 3.6) * step(fract(p.y / 0.95), 0.52) * nsOn;
        float barN = roadNS * gBand(dz * -sign(dx), 10.6, 11.0) * step(0.2, abs(dx)) * ewOn;
        float barE = roadEW * gBand(dx * sign(dz), kerbNS + 4.0, kerbNS + 4.4) * step(0.2, abs(dz)) * nsOn;
        float y = max(yl, ylz);
        mark = max(max(wl, wlz), max(max(cwNS, cwEW) * (1.0 - inX), max(barN, barE) * (1.0 - inX)));
        mc = mix(mc, vec3(0.82, 0.62, 0.18), step(mark, y));
        mark = max(mark, y);
        // (worn: the paint thins where the tyres run)
        mark *= 0.75 + 0.25 * gHash(floor(p * 2.0));
      }
      col.rgb = mix(col.rgb, mc, mark * 0.85);
      // the promenade, the beach, wet sand at the waterline
      if (p.x < ${PROMENADE.x1.toFixed(1)}) col = cc;
      float beach = 1.0 - step(${PROMENADE.x0.toFixed(1)}, p.x);
      vec4 sd = texture2D(uSand, p / 2.2);
      sd.rgb = mix(vec3(dot(sd.rgb, vec3(0.3, 0.59, 0.11))), sd.rgb, 0.5) * vec3(1.42, 1.34, 1.18); // (a pale beach: the desert's gravel is redder)
      sd.rgb = mix(sd.rgb, sd.rgb * vec3(0.62, 0.6, 0.58), 1.0 - smoothstep(0.0, 9.0, p.x - shore));
      col = mix(col, sd, beach);
      diffuseColor *= col;`);
  };
  mat.customProgramCacheKey = () => 'cityGround';
  const mesh = new THREE.Mesh(tiled(CITY.x0 - 30, CITY.x1 + 12, CITY.z0 - 8, CITY.z1 + 12, 100), mat);
  mesh.position.set(0, 0, LOT_Z);
  mesh.receiveShadow = true;
  mesh.name = 'cityGround';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// The bay: deep water out, the shallows going green-blue toward the beach, the surf breaking in bands
// along the sand; waves in the normal (a few long swells and the chop on them), the sky and sun in it.
export function cityOcean() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1d4c60, roughness: 0.09, metalness: 0.0, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = cityU.uTime;
    sh.uniforms.uNight = cityU.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOw;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvOw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vOw;
      uniform float uTime; uniform float uNight;
      float oH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
      float oN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(oH(i), oH(i + vec2(1, 0)), f.x), mix(oH(i + vec2(0, 1)), oH(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float coast = ${COAST_GLSL('vOw.z')};
      if (vOw.x > coast + 0.5) discard; // (the land's)
      float off = coast - vOw.x; // metres out from the waterline
      // the shallows, a sandy green-blue, deepening out
      diffuseColor.rgb = mix(vec3(0.2, 0.52, 0.54), diffuseColor.rgb, smoothstep(4.0, 160.0, off));
      // the surf: bands of white water running in toward the beach, and the wash on the sand
      // (broken up along the beach: unbroken, they read as stripes painted on the water)
      float run = fract(off / 26.0 + uTime * 0.075 + oN(vOw.zz / 90.0) * 0.8);
      float foam = smoothstep(0.9, 0.99, run) * (1.0 - smoothstep(18.0, 60.0, off)) * smoothstep(0.35, 0.7, oN(vec2(vOw.z / 38.0, off / 9.0) + uTime * 0.05)) * (0.5 + 0.5 * oN(vOw.xz / 3.0 + uTime * 0.3));
      foam = max(foam, (1.0 - smoothstep(0.0, 3.5 + 2.0 * sin(uTime * 0.6 + vOw.z * 0.05), off)) * 0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.95), foam);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        // swells from the south-west and the chop over them (a world-space slope, into view space)
        vec2 q = vOw.xz;
        float t = uTime;
        vec2 g = vec2(0.0);
        g += vec2(0.7, 0.7) * cos(dot(q, vec2(0.7, 0.7)) * 0.045 + t * 0.9) * 0.05;
        g += vec2(-0.3, 0.95) * cos(dot(q, vec2(-0.3, 0.95)) * 0.11 + t * 1.4) * 0.03;
        g += vec2(oN(q * 0.35 + t * 0.6) - 0.5, oN(q * 0.35 - t * 0.5 + 9.0) - 0.5) * 0.12;
        g += vec2(oN(q * 1.7 + t * 1.3) - 0.5, oN(q * 1.7 - t * 1.1 + 3.0) - 0.5) * 0.05;
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
  mat.customProgramCacheKey = () => 'cityOcean';
  // the bay and well out past it (the airspace's sea takes over from altitude beyond)
  const mesh = new THREE.Mesh(tiled(-9000, -900, 1200, 14800, 125), mat);
  mesh.position.y = -0.02;
  mesh.name = 'cityOcean';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
