import * as THREE from 'three';

// The violet crystal (Part Seven): what the Zamarons' world is grown from, and what the breach's light
// turns into as it cools on the way there. Downloaded crystal shapes re-skinned in it (scenes/Wake.js,
// scenes/Zamaron.js), so every crystal reads as the one stuff:
//   violetCrystal  opaque, faceted, lit from inside: a slow glow drifting through it (world-space noise),
//                  the edges bright where they turn from the eye
//   keptCrystal    the crystal the Star Sapphires keep the ones they love in: clear enough to see a face
//                  through, frosted in drifts, its edges and veins lit
// Per-material numbers are uniforms (one program for each kind, whatever the colour).
const NOISE = /* glsl */ `
  float cH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float cN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(cH(i), cH(i + vec3(1,0,0)), f.x), mix(cH(i + vec3(0,1,0)), cH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(cH(i + vec3(0,0,1)), cH(i + vec3(1,0,1)), f.x), mix(cH(i + vec3(0,1,1)), cH(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
const WORLD_POS = /* glsl */ `
  #ifdef USE_INSTANCING
    vCw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vCw = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif
`;
export const crystalTime = { value: 0 }; // (the scenes step it)

export function violetCrystal({ color = 0x6a2a8e, deep = 0x2a0838, rim = [1.0, 0.42, 1.05], glow = 0.5, roughness = 0.16, scale = 0.12 } = {}) {
  const u = {
    uDeep: { value: new THREE.Color(deep) }, uRim: { value: new THREE.Color(...rim) }, uCGlow: { value: glow }, uCScale: { value: scale }, uCTime: crystalTime,
  };
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08, flatShading: true, envMapIntensity: 1.3 });
  m.userData.cu = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCw;').replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_POS}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vCw;
        uniform vec3 uDeep, uRim; uniform float uCGlow, uCScale, uCTime;
        ${NOISE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 cp = vCw * uCScale;
          float cn = cN(cp + vec3(0.0, uCTime * 0.05, 0.0)) * 0.65 + cN(cp * 3.1 - uCTime * 0.03) * 0.35;
          float cf = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
          // (the faces turned from the light darker, so a cluster keeps its facets under the glow)
          diffuseColor.rgb = mix(diffuseColor.rgb, uDeep, 0.35 * (1.0 - cn));
          totalEmissiveRadiance += (uDeep * 1.6 + uRim * 0.22) * uCGlow * smoothstep(0.3, 0.85, cn) + uRim * cf * uCGlow * 0.55;
        }`);
  };
  m.customProgramCacheKey = () => 'violet-crystal';
  return m;
}

// `map`: the shard model's own texture, its veins (the bright texels) lit in the crystal
export function keptCrystal({ map = null, tint = 0xc89aff, opacity = 0.3 } = {}) {
  const u = { uCTime: crystalTime, uFrost: { value: 0.55 }, uEdge: { value: new THREE.Color(1.1, 0.5, 1.4) }, uBase: { value: opacity } };
  const m = new THREE.MeshStandardMaterial({ color: tint, map, roughness: 0.06, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.6 });
  m.userData.cu = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCw;').replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${WORLD_POS}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vCw;
        uniform float uCTime, uFrost, uBase; uniform vec3 uEdge;
        ${NOISE}`)
      // the map is the veins, not the colour: a pale violet body whatever the texture's purple
      .replace('#include <map_fragment>', `
        float kVein = 0.0;
        #ifdef USE_MAP
          vec3 kt = texture2D(map, vMapUv).rgb;
          kVein = smoothstep(0.35, 0.8, max(kt.r, kt.b) - kt.g * 0.4);
        #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float kF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
        float kFrost = smoothstep(0.45, 0.8, cN(vCw * 2.2 + 3.0) * 0.6 + cN(vCw * 6.0) * 0.4) * uFrost;
        float kPulse = 0.75 + 0.25 * sin(uCTime * 1.3 + vCw.y * 1.7 + vCw.x);
        totalEmissiveRadiance += uEdge * (kF * 0.35 + kVein * 0.22 * kPulse);
        diffuseColor.a = clamp(uBase + kF * 0.5 + kFrost * 0.45 + kVein * 0.15, 0.0, 0.92);`);
  };
  m.customProgramCacheKey = () => 'kept-crystal';
  return m;
}

// A downloaded scan of real crystal kept as it is, its violet texels lit a little from inside (the
// amethyst geodes Zamaron's valley is ringed with)
export function litScan(src, { glow = 0.35, rough = 0.32 } = {}) {
  const m = src.clone();
  m.roughness = Math.max(m.roughness ?? 1, rough);
  m.metalness = 0;
  const u = { uSGlow: { value: glow }, uCTime: crystalTime };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSGlow, uCTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 sc = diffuseColor.rgb;
          float sv = smoothstep(0.04, 0.16, sc.b - sc.g) * smoothstep(0.02, 0.1, sc.r - sc.g);
          totalEmissiveRadiance += vec3(0.55, 0.16, 0.8) * sv * uSGlow;
        }`);
  };
  m.customProgramCacheKey = () => 'lit-scan';
  return m;
}
