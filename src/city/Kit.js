// Coast City's building kit: the shared materials (stucco that weathers toward the ground, painted
// and old brick, barrel tiles, shutters, frames, iron, roofing, canvas) and the glass with rooms
// behind it (interior mapping: each pane looks into a box of a room, its walls, floor, ceiling and a
// little furniture, blinds or curtains in front, lit or dark at night). Geometry goes into a Batch by
// material, merged into one mesh each at the end, so a whole block is a dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial } from '../fx/Textures.js';

// the time of day the city's materials share: 0 day, 1 night (windows lit, signs on)
export const cityU = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uSkyTop: { value: new THREE.Color(0x4f86c6) },
  uSkyHor: { value: new THREE.Color(0xd9e4ec) },
  uGround: { value: new THREE.Color(0x6b6660) },
  uDayLight: { value: new THREE.Color(1, 0.97, 0.92) },
};

const NOISE = /* glsl */`
float cHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1, 0, 0)), f.x), mix(cHash(i + vec3(0, 1, 0)), cHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0, 0, 1)), cHash(i + vec3(1, 0, 1)), f.x), mix(cHash(i + vec3(0, 1, 1)), cHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

// Weathering on a wall material (world space): grime splashed up from the pavement, a darker band
// under the coping where rain runs off, and broad sun-faded patches.
function weather(mat, { base = 0.3, fade = 0.1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vCWorld;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float n = cNoise(vCWorld * vec3(0.9, 1.6, 0.9)), n2 = cNoise(vCWorld * 0.23 + 7.0);
        float grime = (1.0 - smoothstep(0.12, 1.25 + 0.5 * n, vCWorld.y)) * ${base.toFixed(2)};
        diffuseColor.rgb *= 1.0 - grime * (0.55 + 0.45 * n);
        diffuseColor.rgb *= 1.0 - ${fade.toFixed(2)} + ${(fade * 2).toFixed(2)} * n2;
      }`);
  };
  mat.customProgramCacheKey = () => `cityWeather${base}${fade}`;
  return mat;
}

// The materials, made once per scene (textures are cached by fx/Textures). Geometry UVs are in
// metres, so each repeat is 1 / the texture's size on the wall.
export function cityMaterials() {
  const m = {};
  const pbr = (id, size, opts = {}) => pbrMaterial(id, { repeat: [1 / size, 1 / size], ...opts });
  m.stucco = weather(Object.assign(pbr('painted_plaster_wall', 3, { normalScale: 0.9 }), { vertexColors: true }));
  m.stucco.color.setScalar(1.38); // (the plaster's texture is a mid grey: lifted, a building's paint reads as its colour)
  m.pbrick = weather(Object.assign(pbr('painted_worn_brick', 2.2, { normalScale: 1.1 }), { vertexColors: true }), { base: 0.25 });
  m.pbrick.color.setScalar(1.15);
  m.brick = weather(Object.assign(pbr('red_brick_plaster_patch_02', 2.6, { normalScale: 1.2 }), { vertexColors: true }), { base: 0.2, fade: 0.06 });
  m.tile = Object.assign(pbr('clay_roof_tiles_02', 2.2, { normalScale: 1.3 }), { vertexColors: true });
  m.shutter = Object.assign(pbr('painted_metal_shutter', 1.6, { metalness: 0.5, roughness: 0.75 }), { vertexColors: true });
  m.patio = Object.assign(pbr('patio_tiles', 1.6), { vertexColors: true });
  m.checker = Object.assign(pbr('floor_tiles_06', 1.2), { vertexColors: true });
  m.facadeTiles = Object.assign(pbr('rectangular_facade_tiles', 1.2, { roughness: 0.55 }), { vertexColors: true });
  m.concrete = weather(Object.assign(pbr('concrete_floor_02', 3), { vertexColors: true }), { base: 0.15, fade: 0.08 });
  m.roofing = Object.assign(pbr('concrete_floor_02', 2.5, { roughness: 1 }), { vertexColors: true });
  // painted wood and metal: frames, sills' paint, fascia boards, doors
  m.paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  // paint on the road and the kerbs: worn and rough, so the sun doesn't glare off it
  m.roadpaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  m.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.75 });
  m.iron = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.55 });
  m.dark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1 }); // doors, rubber, shadows
  m.glass = glassMaterial();
  // the glass of a shop you can see into: clear, the sky in it at a grazing angle
  m.clearGlass = new THREE.MeshStandardMaterial({ color: 0xa8bcc0, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  // light fittings: always lit (a shop is open by day too)
  m.glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.95, 0.95, 0.95) }); // (brighter, the bloom hazes a room white)
  m.canvas = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, map: awningTexture() });
  m.canvas.map.colorSpace = THREE.SRGBColorSpace;
  m.lamp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: new THREE.Color(1, 0.8, 0.55), emissiveIntensity: 0 });
  return m;
}

// --------------------------------------------------------------------------------- the glass
// Each pane carries its room: aCell = (u0, floor y, room width, room height) in the block's frame
// along the pane's own tangent, aRoom = (depth, seed, kind, lit share). kind 0 a home, 1 a shop, 2 an
// office, 3 the diner. The camera's ray is followed into the box; what it meets is painted.
function glassMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(uniforms, cityU, { uCamObj: { value: new THREE.Vector3() } });
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: /* glsl */`
      attribute vec4 aCell; attribute vec4 aRoom;
      varying vec3 vP; varying vec3 vN; varying vec4 vCell; varying vec4 vRoom;
      #include <fog_pars_vertex>
      void main() {
        vP = position; vN = normal; vCell = aCell; vRoom = aRoom;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uNight; uniform float uTime; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uGround; uniform vec3 uDayLight; uniform vec3 uCamObj;
      varying vec3 vP; varying vec3 vN; varying vec4 vCell; varying vec4 vRoom;
      #include <common>
      #include <fog_pars_fragment>
      float h1(float s) { return fract(sin(s * 91.731 + 3.17) * 43758.5453); }
      vec3 pick4(float r, vec3 a, vec3 b, vec3 c, vec3 d) { return r < 0.25 ? a : r < 0.5 ? b : r < 0.75 ? c : d; }
      void main() {
        vec3 N = normalize(vN), Tc = cross(vec3(0.0, 1.0, 0.0), N);
        vec3 T = dot(Tc, Tc) > 1e-6 ? normalize(Tc) : vec3(1.0, 0.0, 0.0);
        vec3 D = normalize(vP - uCamObj);
        vec3 dims = vec3(vCell.z, vCell.w, vRoom.x);
        vec3 p = vec3((dot(vP, T) - vCell.x) / vCell.z, (vP.y - vCell.y) / vCell.w, 0.0);
        vec3 ds = vec3(dot(D, T), D.y, max(-dot(D, N), 1e-3)) / dims;
        vec3 tt = (step(0.0, ds) - p) / ds;
        float t = min(min(tt.x, tt.y), tt.z);
        vec3 h = clamp(p + ds * t, 0.0, 1.0);
        float sd = vRoom.y, kind = vRoom.z;
        float r1 = h1(sd), r2 = h1(sd + 1.7), r3 = h1(sd + 3.1), r4 = h1(sd + 5.3), r5 = h1(sd + 7.9), r6 = h1(sd + 9.4), r7 = h1(sd + 11.2);
        vec3 wallC = pick4(r1, vec3(0.86, 0.81, 0.7), vec3(0.64, 0.71, 0.76), vec3(0.7, 0.74, 0.6), vec3(0.88, 0.74, 0.62));
        vec3 floorC = r2 < 0.55 ? vec3(0.42, 0.27, 0.15) * (0.85 + 0.15 * step(0.5, fract(h.x * 9.0))) : vec3(0.52, 0.47, 0.42);
        vec3 ceilC = vec3(0.9, 0.88, 0.84);
        bool shop = kind > 0.5 && kind < 1.5, office = kind > 1.5 && kind < 2.5, diner = kind > 2.5;
        if (shop || diner) { floorC = mix(vec3(0.75), vec3(0.18), step(0.5, mod(floor(h.x * 10.0) + floor(h.z * 8.0), 2.0))); wallC = pick4(r1, vec3(0.92, 0.9, 0.84), vec3(0.95, 0.88, 0.72), vec3(0.78, 0.86, 0.84), vec3(0.94, 0.94, 0.94)); }
        if (diner) { wallC = h.y < 0.3 ? vec3(0.7, 0.1, 0.1) : vec3(0.93, 0.9, 0.82); floorC = mix(vec3(0.85), vec3(0.08), step(0.5, mod(floor(h.x * 14.0) + floor(h.z * 10.0), 2.0))); }
        if (office) { wallC = vec3(0.82, 0.83, 0.82); floorC = vec3(0.42, 0.44, 0.48); }
        vec3 col; float face;
        if (t == tt.z) { // the back wall, and what stands against it
          col = wallC * 0.88; face = 0.0;
          if (!shop && !diner && !office) {
            if (h.y < 0.3 && abs(h.x - 0.5) < 0.3) col = pick4(r3, vec3(0.35, 0.2, 0.16), vec3(0.2, 0.26, 0.34), vec3(0.45, 0.42, 0.36), vec3(0.28, 0.3, 0.22)) * (0.8 + 0.2 * step(0.22, h.y));
            if (abs(h.x - 0.32 - r4 * 0.36) < 0.09 && abs(h.y - 0.62) < 0.08) col = mix(vec3(0.22, 0.16, 0.1), pick4(r5, vec3(0.6, 0.5, 0.3), vec3(0.3, 0.45, 0.6), vec3(0.7, 0.62, 0.55), vec3(0.4, 0.5, 0.3)), step(abs(h.x - 0.32 - r4 * 0.36), 0.075) * step(abs(h.y - 0.62), 0.065));
          }
          if (office) { if (h.y < 0.36) col = vec3(0.35, 0.3, 0.26); if (abs(h.y - 0.6) < 0.12 && fract(h.x * 3.0) < 0.7) col = vec3(0.55, 0.52, 0.46); }
        } else if (t == tt.x) { col = wallC; face = 1.0; }
        else if (ds.y < 0.0) { col = floorC; face = 2.0; }
        else { col = ceilC; face = 3.0; }
        // shops: shelves of goods down the walls, a counter
        if ((shop) && face < 1.5) {
          float u = face < 0.5 ? h.x : h.z, sh = fract(h.y * 5.0);
          if (h.y > 0.06 && h.y < 0.62) {
            float row = floor(h.y * 9.0), sh9 = fract(h.y * 9.0), item = floor(u * (40.0 + 20.0 * r3) + row * 3.1);
            vec3 goods = pick4(h1(item + row * 7.0 + sd), vec3(0.62, 0.32, 0.24), vec3(0.3, 0.4, 0.55), vec3(0.72, 0.66, 0.44), vec3(0.42, 0.5, 0.36));
            goods = mix(goods, vec3(0.55), 0.35) * (0.75 + 0.25 * h1(item * 1.7 + sd));
            col = sh9 < 0.14 ? vec3(0.28, 0.27, 0.26) : mix(goods, col * 0.7, step(0.82 - 0.3 * h1(item), sh9));
          }
        }
        if (diner && face < 0.5) { if (h.y < 0.32) col = vec3(0.6, 0.08, 0.08) * (0.8 + 0.2 * step(0.26, h.y)); if (abs(h.y - 0.34) < 0.02) col = vec3(0.8); }
        // light: the daylight through the window, less of it deeper in; at night a ceiling lamp, or the TV
        float day = 1.0 - uNight;
        float lit = step(r6, vRoom.w);
        float dk = h.z;
        vec3 light = day * uDayLight * mix(0.5, 0.14, dk) * (shop || diner ? 0.75 : 0.85);
        if ((shop || office || diner) && face > 2.5) light += vec3(0.9, 0.95, 1.0) * step(0.86, fract(h.z * 3.0 + 0.2)) * step(abs(h.x - 0.5), 0.36) * (shop ? 0.9 : 0.6); // fluorescent tubes
        vec2 c2 = h.xz - vec2(0.5, 0.45);
        float lamp = lit * uNight * (face > 2.5 ? 1.6 * (1.0 - smoothstep(0.0, 0.55, length(c2))) + 0.25 : 0.55 + 0.45 * (1.0 - h.z * 0.6));
        vec3 lampC = shop || office ? vec3(0.95, 0.98, 1.0) : vec3(1.0, 0.76, 0.48);
        vec3 inside = col * (light + lampC * lamp * (shop || diner ? 1.1 : 0.85));
        if (!shop && !diner && lit < 0.5 && r7 < 0.12) inside += uNight * vec3(0.12, 0.18, 0.34) * (0.6 + 0.4 * sin(uTime * 7.0 + sd * 30.0) * sin(uTime * 2.3)); // a television
        // blinds and curtains, in the window's own plane
        float blind = step(r5, kind > 0.5 ? 0.15 : 0.45) * (0.15 + 0.7 * r4);
        if (p.y > 1.0 - blind) {
          float slat = 0.78 + 0.22 * smoothstep(0.0, 0.6, fract(p.y * vCell.w / 0.045));
          inside = vec3(0.84, 0.82, 0.76) * slat * (day * 0.5 * uDayLight + lit * uNight * vec3(0.9, 0.7, 0.45));
        }
        float cw = step(r7, kind > 0.5 ? 0.0 : 0.35) * (0.16 + 0.12 * r3);
        if (p.x < cw || p.x > 1.0 - cw) {
          vec3 cc = pick4(r2, vec3(0.75, 0.68, 0.55), vec3(0.55, 0.2, 0.18), vec3(0.3, 0.4, 0.55), vec3(0.85, 0.85, 0.8));
          inside = cc * (0.72 + 0.28 * sin(p.x * vCell.z * 42.0)) * (day * 0.48 * uDayLight + lit * uNight * vec3(0.95, 0.72, 0.45));
        }
        // the glass itself: the sky and the street in it, more at a grazing angle
        vec3 R = reflect(D, N);
        vec3 sky = R.y > 0.0 ? mix(uSkyHor, uSkyTop, pow(R.y, 0.55)) : mix(uSkyHor * 0.6, uGround, min(-R.y * 4.0, 1.0));
        sky *= mix(1.0, 0.12, uNight);
        float F = 0.05 + 0.95 * pow(1.0 - max(dot(-D, N), 0.0), 5.0);
        float smudge = 0.9 + 0.1 * fract(sin(dot(floor(p.xy * vec2(vCell.z, vCell.w) * 3.0), vec2(12.9, 78.2))) * 4375.0);
        vec3 outc = inside * (1.0 - F) * smudge + sky * (F * 0.8 + 0.09);
        gl_FragColor = vec4(outc, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  mat.onBeforeRender = (renderer, scene, camera, geometry, object) => {
    mat.uniforms.uCamObj.value.copy(camera.position).applyMatrix4(_inv.copy(object.matrixWorld).invert());
  };
  return mat;
}
const _inv = new THREE.Matrix4();

// Awning canvas: four stripe patterns side by side (u 0-0.25, 0.25-0.5, ...), each across in u
function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  const styles = [['#7d1a17', '#efe6d2'], ['#1f4f3a', '#ece4cc'], ['#25466e', '#f1ece0'], ['#a0521c', '#f0dfb8']];
  styles.forEach(([a, b], i) => {
    for (let s = 0; s < 16; s++) { g.fillStyle = s % 2 ? b : a; g.fillRect(i * 256 + s * 16, 0, 16, 64); }
  });
  const img = g.getImageData(0, 0, 1024, 64), d = img.data; // the weave and sun-fading
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------------- batches
const GLASS_ATTR = ['aCell', 'aRoom'];
export class Batch {
  constructor() { this.parts = new Map(); }

  // geometry in the building's frame, `m` its matrix into the block's frame; `color` a THREE.Color
  // or [r, g, b]; glass panes carry their room (see glassMaterial)
  add(key, geo, m, color = 0xffffff, room = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (m) g.applyMatrix4(m);
    const c = color.isColor ? color : Array.isArray(color) ? new THREE.Color(...color) : new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (key === 'glass') {
      const cell = new Float32Array(n * 4), rm = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { cell.set(room.cell, i * 4); rm.set(room.room, i * 4); }
      g.setAttribute('aCell', new THREE.BufferAttribute(cell, 4));
      g.setAttribute('aRoom', new THREE.BufferAttribute(rm, 4));
    }
    (this.parts.get(key) ?? this.parts.set(key, []).get(key)).push(g);
    return g;
  }

  // one mesh per material
  build(mats, { shadows = true } = {}) {
    const group = new THREE.Group();
    for (const [key, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      if (!geo) { console.warn('city: could not merge', key); continue; }
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.name = `city_${key}`;
      mesh.castShadow = shadows && key !== 'glass' && key !== 'lamp';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
export { GLASS_ATTR };
