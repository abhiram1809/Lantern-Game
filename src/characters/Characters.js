import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Rig } from './Rig.js';
import { MocapSource } from './Mocap.js';

export async function loadCharacters(manager) {
  const loader = new GLTFLoader(manager);
  const [casual, lantern, abin, xbot, kilowog, carol] = await Promise.all([
    loader.loadAsync('/models/hal_casual.glb'),
    loader.loadAsync('/models/hal_lantern.glb'),
    loader.loadAsync('/models/abin_sur.glb'),
    loader.loadAsync('/anims/xbot.glb'),
    loader.loadAsync('/models/kilowog.glb').catch(() => null), // Part Two; optional until built
    loader.loadAsync('/models/carol.glb').catch(() => null), // Part Three
  ]);
  for (const g of [casual, lantern, abin, kilowog, carol]) {
    if (!g) continue;
    g.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const m = o.material;
      // Tripo packs occlusion into the red channel of the ORM texture.
      if (m.metalnessMap) { m.aoMap = m.metalnessMap; m.aoMapIntensity = 0.85; }
      m.envMapIntensity = 0.6;
    });
  }
  return { casual, lantern, abin, kilowog, carol, mocap: new MocapSource(xbot) };
}

// Adds suit glow, a sweep dissolve for the transformation, a tint, and an optional hidden bone.
// Pass `u` to share one set of uniforms across all of a character's meshes.
export function makeUniforms({ glow = 0, hideBone = -1, roughMin = 0 } = {}) {
  return {
    uRoughMin: { value: roughMin },
    uDissolve: { value: 0 }, uDissolveOn: { value: 0 }, uDissolveSign: { value: 1 },
    uGlow: { value: glow }, uTint: { value: new THREE.Color(1, 1, 1) },
    uEdgeColor: { value: new THREE.Color(0.5, 4, 1.4) }, uHideBone: { value: hideBone },
  };
}

export function patchMaterial(mat, { glow = 0, hideBone = -1, u = makeUniforms({ glow, hideBone }) } = {}) {
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;\nvarying float vHide;\nuniform float uHideBone;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vDPos = position;
        vHide = 0.0;
        #ifdef USE_SKINNING
          vHide = dot(skinWeight, vec4(equal(skinIndex, vec4(uHideBone))));
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDPos; varying float vHide;
        uniform float uDissolve, uDissolveOn, uDissolveSign, uGlow, uRoughMin;
        uniform vec3 uEdgeColor, uTint;
        float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float dNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vHide > 0.5) discard;
        diffuseColor.rgb *= uTint;
        float dEdge = 0.0;
        if (uDissolveOn > 0.5) {
          float field = vDPos.y / 1.9 * 0.6 + (dNoise(vDPos * 11.0) * 0.6 + dNoise(vDPos * 31.0) * 0.4) * 0.4;
          float gap = uDissolveSign > 0.0 ? field - uDissolve : uDissolve - field;
          if (gap < 0.0) discard;
          dEdge = 1.0 - smoothstep(0.0, 0.05, gap);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor = max(roughnessFactor, uRoughMin);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_MAP
          vec3 gc = texture2D(map, vMapUv).rgb;
          float gm = smoothstep(0.08, 0.3, gc.g - max(gc.r, gc.b) * 1.1) * smoothstep(0.3, 0.65, gc.g);
          totalEmissiveRadiance += vec3(0.25, 1.0, 0.45) * gm * uGlow;
        #endif
        totalEmissiveRadiance += uEdgeColor * dEdge;`);
  };
  mat.customProgramCacheKey = () => `gl-patch-${hideBone >= 0}`;
  return u;
}

// A character from one of the rigged scans, with its own skeleton and shared material uniforms.
export function createCharacter(gltf, { glow = 0, roughMin = 0 } = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  const u = makeUniforms({ glow, roughMin });
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.material = o.material.clone();
    patchMaterial(o.material, { u });
  });
  const rig = new Rig(root);
  rig.u = u;
  return rig;
}

export const createHal = (gltf, opts) => createCharacter(gltf, opts);

// Abin Sur, from his own scan: the suit's green panels glow faintly until he dies.
export const createAbinSur = (gltf) => createCharacter(gltf, { glow: 0.32 });

// Kilowog, the Corps' drill sergeant, from his own scan.
export const createKilowog = (gltf) => createCharacter(gltf, { glow: 0.6, roughMin: 0.45 });

// Carol Ferris, from her own scan (Part Three). Matte like casual Hal: skin and cotton. Her scan's
// normal map is broken over the skin (pale rims round the face, white flecks on the lips and
// nostrils, whichever way its green channel is read), so on skin-coloured texels the surface's own
// normal is used; the hair and clothes keep the map's detail.
export function createCarol(gltf) {
  const rig = createCharacter(gltf, { roughMin: 0.55 });
  for (const m of rig.meshes) {
    const mat = m.material, base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      base(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 cc = diffuseColor.rgb;
        float cSkin = smoothstep(0.02, 0.08, cc.r - cc.b) * smoothstep(0.08, 0.2, cc.r) * smoothstep(0.0, 0.04, cc.g - cc.b * 0.8);
        normal = normalize(mix(normal, nonPerturbedNormal, cSkin));`);
    };
    mat.customProgramCacheKey = () => 'gl-carol';
  }
  return rig;
}

// Sinestro of Korugar, derived from Abin Sur's scan (a long, severe alien face, no mask, a tall lean
// body in the Corps uniform), matched to a comic reference the user chose (2026-11-09): warm
// coral-red skin, more orange up the forehead; black hair slicked back from a sharp widow's peak,
// the temples deeply receded, given volume by pushing the scalp out (thicker at the crown and the
// back) and combed grooves in the shading so its sheen streaks along the strands; heavy dark brows
// low over the nose and slanting up to the temples, with frown creases between (the scowl); glowing
// yellow irises in the scan's narrow eyes; a thin moustache whose ends turn down at the mouth's
// corners. The uniform stays green, a shade darker than Abin Sur's. Worked in the bind pose's
// object space (metres, the scan 1.96 m tall, facing +Z), from the scan's front profile (chin 1.665,
// mouth 1.72, nose 1.75 to 1.79, brow ridge 1.83, crown 1.96). `rig.su` holds the tunable values.
const SINESTRO_COMMON = /* glsl */ `
  varying vec3 vComb;
  // the hairline's height round the head: the widow's peak in front, receding temples, down to the
  // nape behind the ears
  float sinLine(vec3 p) {
    float sx = abs(p.x), a = abs(atan(p.x, p.z - uHeadZ));
    float front = uPeakY + uPeakSlope * sx - uTemple * smoothstep(0.03, 0.07, sx);
    float back = mix(uSideY, uNapeY, smoothstep(1.7, 2.9, a));
    return mix(front, back, smoothstep(0.85, 1.3, a));
  }
  // how far the hair stands off the scalp: thin at the hairline and low on the sides, fuller over the
  // crown and at the back, where slicked hair gathers
  float sinThick(vec3 p) {
    float a = abs(atan(p.x, p.z - uHeadZ));
    float ramp = smoothstep(sinLine(p), sinLine(p) + uHairRamp, p.y) * smoothstep(1.69, 1.71, p.y);
    float t = uHairT * (0.5 + 0.5 * smoothstep(1.85, 1.94, p.y)) + uHairBack * smoothstep(1.4, 2.6, a) * smoothstep(1.8, 1.9, p.y) * (1.0 - smoothstep(1.92, 1.965, p.y));
    return t * ramp;
  }
`;
const SINESTRO_VERTEX = /* glsl */ `
  // a longer, narrower face than Abin Sur's: the head pulled in from the sides, blended out down
  // the neck (the painted features use the original positions, so they move with it)
  transformed.x *= 1.0 - uNarrow * smoothstep(1.62, 1.7, position.y);
  // a thinner nose: pinched in from the sides where it stands out from the face (bridge to nostrils)
  float sNose = smoothstep(0.075, 0.098, position.z - uHeadZ) * smoothstep(1.742, 1.752, position.y) * (1.0 - smoothstep(1.81, 1.826, position.y)) * (1.0 - smoothstep(0.022, 0.036, abs(position.x)));
  transformed.x *= 1.0 - uNoseThin * sNose;
  // the hair stands out from the skull's centre rather than along the normal: the scan's seams have duplicated
  // vertices with different normals, and pushing those apart opens cracks in the scalp
  transformed += normalize(position - vec3(0.0, 1.80, uHeadZ)) * sinThick(position);
  // combed straight back over the top and sides, then down the back of the head to the nape
  float sA = abs(atan(position.x, position.z - uHeadZ));
  vComb = normalize(normalMatrix * mix(vec3(0.0, -0.12, -1.0), vec3(0.0, -1.0, -0.2), smoothstep(1.9, 2.7, sA) * (1.0 - smoothstep(1.93, 1.965, position.y))));
`;
const SINESTRO_GLSL = /* glsl */ `
  vec3 sp = vDPos;
  vec3 sc = diffuseColor.rgb;
  float sHead = smoothstep(1.665, 1.69, sp.y);
  float sAng = abs(atan(sp.x, sp.z - uHeadZ)); // 0 at the face, pi at the back of the head
  float sx = abs(sp.x);
  // skin: everything on the head that isn't uniform (Abin Sur's pink has bluish shading in it), and
  // the pink of the hands; recoloured with its shading kept. The eyes keep their own colour.
  float sLum = dot(sc, vec3(0.299, 0.587, 0.114));
  float sSat = (max(sc.r, max(sc.g, sc.b)) - min(sc.r, min(sc.g, sc.b))) / max(max(sc.r, max(sc.g, sc.b)), 1e-3);
  float sGreen = smoothstep(0.012, 0.05, sc.g - max(sc.r, sc.b));
  // (behind, the collar rises to the jaw: only take the head from higher up there)
  float sNeckY = mix(1.665, 1.725, smoothstep(1.2, 2.2, sAng));
  float sSkin = max(smoothstep(0.012, 0.06, sc.r - max(sc.g, sc.b)), smoothstep(sNeckY, sNeckY + 0.02, sp.y) * (1.0 - sGreen));
  vec3 sKor = uSkin * pow(max(sLum, 1e-4) / uSkinLum, uSkinGamma);
  sKor *= mix(vec3(1.0), vec3(1.1, 1.35, 1.2), smoothstep(1.82, 1.9, sp.y) * smoothstep(0.02, 0.06, sp.z - uHeadZ)); // more orange up the forehead
  sc = mix(sc * uSuit, sKor, sSkin);
  // the eyes: the scan has narrow slits with a blank wet glint. Keep the squint (it suits him) and
  // paint into it an almond with a dark iris, a crisp upper lash line, a hint of white at the
  // corners; the muddy sockets round them lighten toward the skin.
  float sEu = sx - uEyeX, sEv = sp.y - uEyeY - sEu * uEyeTilt;
  float sEf = smoothstep(0.03, 0.05, sp.z - uHeadZ) * step(sAng, 1.0);
  float sLid = uEyeH * max(1.0 - (sEu * sEu) / (uEyeW * uEyeW), 0.0);
  float sIn = (1.0 - smoothstep(sLid - 0.0007, sLid + 0.0005, abs(sEv - 0.0006 * sign(sEv)))) * step(abs(sEu), uEyeW) * sEf;
  float sSock = (1.0 - smoothstep(0.0, 1.0, length(vec2(sEu / (uEyeW * 1.9), sEv / (uEyeH * 4.5))))) * sEf;
  sc = mix(sc, uSkin * 0.9, sSock * uSocket * sSkin);
  float sIrisD = length(vec2(sEu - uIrisX, sEv * 0.9));
  float sIris = smoothstep(uIrisR + 0.0008, uIrisR - 0.0004, sIrisD);
  vec3 sEyeCol = mix(vec3(0.42, 0.36, 0.35), uIrisCol * (0.75 + 0.25 * smoothstep(uIrisR, 0.0, sIrisD)), sIris);
  float sPupil = smoothstep(uIrisR * 0.42, uIrisR * 0.3, sIrisD);
  sEyeCol = mix(sEyeCol, vec3(0.003), sPupil);
  sEyeCol *= 0.55 + 0.45 * smoothstep(uEyeW, uEyeW * 0.3, abs(sEu)); // shadowed in the corners
  sc = mix(sc, sEyeCol, sIn);
  float sLash = (1.0 - smoothstep(0.0006, 0.0016, abs(sEv - sLid - 0.0004))) * smoothstep(uEyeW * 1.05, uEyeW * 0.4, abs(sEu)) * step(0.0, sEv) * sEf;
  float sLow = (1.0 - smoothstep(0.0004, 0.0011, abs(sEv + sLid + 0.0002))) * smoothstep(uEyeW, uEyeW * 0.5, abs(sEu)) * sEf;
  sc = mix(sc, vec3(0.012, 0.004, 0.006), max(sLash, sLow * 0.6));
  float sWet = sIn; // the eye itself is glossy: it catches the light
  float sGlow = sIn * sIris * (1.0 - sPupil); // his irises glow yellow
  sc = mix(sc, vec3(1.0, 0.0, 1.0), uEyeDebug * (1.0 - smoothstep(0.0, 0.0006, abs(abs(sEv) - sLid))) * step(abs(sEu), uEyeW) * sEf);
  // hair; the edge breaks up into single hairs rather than a painted line
  float sFuzz = (dNoise(sp * 900.0) - 0.5) * 0.006 + (dNoise(sp * 140.0) - 0.5) * 0.004;
  float sHair = smoothstep(sinLine(sp) - 0.003, sinLine(sp) + 0.006, sp.y + sFuzz) * sHead;
  // across the strands: they run front to back over the top and along the sides, and down the back
  float sSide = pow(sin(min(sAng, 3.1416)), 2.0) * (1.0 - smoothstep(1.9, 1.95, sp.y));
  float sAcross = mix(sp.x, sp.y * 1.3, sSide);
  float sAlong = mix(sp.z * 70.0 + sp.y * 60.0, sp.z * 70.0, sSide);
  // detail finer than a pixel fades to its average instead of aliasing into grain
  float sFine = 1.0 - smoothstep(0.4, 1.2, fwidth(sAcross * 1800.0));
  float sStr = mix(0.5, dNoise(vec3(sAcross * 1800.0, sAlong, 0.0)), sFine) * 0.45 + dNoise(vec3(sAcross * 520.0, sAlong * 0.35, 3.0)) * 0.55;
  sc = mix(sc, mix(vec3(0.003, 0.003, 0.005), vec3(0.03, 0.028, 0.038), smoothstep(0.35, 0.95, sStr)), sHair);
  // hollow cheeks under the cheekbones
  float sCheek = smoothstep(0.035, 0.05, sx) * (1.0 - smoothstep(0.06, 0.075, sx)) * smoothstep(1.71, 1.735, sp.y) * (1.0 - smoothstep(1.765, 1.785, sp.y)) * smoothstep(0.03, 0.05, sp.z - uHeadZ);
  sc *= 1.0 - 0.35 * sCheek * sSkin;
  // brows: heavy and dark, low and close over the nose, slanting up to the temples (the scowl),
  // with frown creases between them
  float sFace = smoothstep(0.02, 0.04, sp.z - uHeadZ) * step(sAng, 1.0);
  float sHairy = 0.75 + 0.25 * dNoise(sp * 2400.0);
  float sBt = clamp((sx - 0.007) / 0.043, 0.0, 1.0);
  float sBrowY = uBrowY + (sx - 0.007) * uBrowRise - 0.004 * smoothstep(0.8, 1.0, sBt);
  float sBrowW = uBrowW * (1.2 - 0.75 * sBt);
  float sBrow = (1.0 - smoothstep(sBrowW * 0.45, sBrowW, abs(sp.y - sBrowY))) * smoothstep(0.004, 0.009, sx) * (1.0 - smoothstep(0.046, 0.052, sx));
  float sFrown = (1.0 - smoothstep(0.0005, 0.0013, abs(sx - 0.0045 - (sp.y - uBrowY) * 0.15))) * smoothstep(uBrowY, uBrowY + 0.004, sp.y) * (1.0 - smoothstep(uBrowY + 0.015, uBrowY + 0.022, sp.y));
  sc = mix(sc, sc * 0.45, sFrown * sFace);
  // the pencil moustache: a fine line along the upper lip, dipping with it at the corners, thinnest
  // under the nose and tapering to points
  float sMouY = uMouY - uMouDrop * smoothstep(0.01, 0.031, sx);
  float sMouW = uMouW * (0.65 + 0.35 * smoothstep(0.0, 0.007, sx)) * (1.0 - smoothstep(0.02, 0.032, sx));
  float sMou = (1.0 - smoothstep(sMouW * 0.35, sMouW, abs(sp.y - sMouY))) * step(sx, 0.032);
  sc = mix(sc, vec3(0.004, 0.003, 0.005), max(sBrow, sMou) * sHairy * sFace);
  diffuseColor.rgb = sc;
`;
// combed grooves: tip the normal across the strands so highlights break into streaks along them
const SINESTRO_NORMAL = /* glsl */ `
  if (sHair > 0.01) {
    // the scan's normal map belongs to a bald scalp (its UV seam shows as stitches under dark hair)
    normal = normalize(mix(normal, nonPerturbedNormal, sHair));
    vec3 sCv = normalize(vComb - normal * dot(vComb, normal));
    vec3 sAc = normalize(cross(normal, sCv));
    // irregular: the comb's teeth wander, and the hair lies in clumps
    // (calmer over the crown, where the strands from every side meet)
    float sCrown = 1.0 - 0.75 * smoothstep(1.925, 1.958, sp.y);
    float sG = sCrown * sin(sAcross * 900.0 + dNoise(vec3(sAcross * 200.0, sAlong * 0.4, 1.0)) * 3.0) * (0.35 + 0.65 * dNoise(vec3(sAcross * 160.0, sAlong * 0.2, 7.0))) * (1.0 - smoothstep(0.4, 1.2, fwidth(sAcross * 900.0))) + (sStr - 0.5) * 1.1;
    normal = normalize(normal + sAc * sG * uGroove * sHair);
  }
`;

export function createSinestro(abinGltf) {
  const rig = createCharacter(abinGltf, { glow: 0.45 });
  const su = (rig.su = {
    uSkin: { value: new THREE.Color(0.86, 0.13, 0.065) }, uSkinLum: { value: 0.3 }, uSkinGamma: { value: 0.75 },
    uEyeX: { value: 0.031 }, uEyeY: { value: 1.806 }, uEyeW: { value: 0.0125 }, uEyeH: { value: 0.0035 }, uEyeTilt: { value: 0.12 },
    uIrisX: { value: -0.001 }, uIrisR: { value: 0.0055 }, uSocket: { value: 0.55 }, uEyeDebug: { value: 0 },
    uIrisCol: { value: new THREE.Color(0.95, 0.62, 0.06) }, uEyeGlow: { value: 0.55 },
    uSuit: { value: new THREE.Color(0.72, 0.84, 0.8) }, uHeadZ: { value: 0.033 },
    uPeakY: { value: 1.897 }, uPeakSlope: { value: 0.95 }, uTemple: { value: 0.0 }, uSideY: { value: 1.862 }, uNapeY: { value: 1.775 },
    uNarrow: { value: 0.08 }, uNoseThin: { value: 0.28 }, uHairT: { value: 0.009 }, uHairBack: { value: 0.007 }, uHairRamp: { value: 0.02 }, uGroove: { value: 0.3 },
    uBrowY: { value: 1.822 }, uBrowRise: { value: 0.36 }, uBrowW: { value: 0.0068 }, uMouY: { value: 1.743 }, uMouW: { value: 0.0058 }, uMouDrop: { value: 0.0085 },
  });
  const decl = Object.keys(su).map((k) => `uniform ${su[k].value.isColor ? 'vec3' : 'float'} ${k};`).join('\n');
  for (const m of rig.meshes) {
    const mat = m.material, base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      base(sh, r);
      Object.assign(sh.uniforms, su);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${decl}\n${SINESTRO_COMMON}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SINESTRO_VERTEX}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${decl}\n${SINESTRO_COMMON}`)
        .replace('diffuseColor.rgb *= uTint;', `${SINESTRO_GLSL}\n        diffuseColor.rgb *= uTint;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${SINESTRO_NORMAL}`)
        .replace('totalEmissiveRadiance += uEdgeColor * dEdge;', 'totalEmissiveRadiance += uEdgeColor * dEdge;\n        totalEmissiveRadiance += uIrisCol * sGlow * uEyeGlow;')
        // the scan's occlusion and metalness belong to a bald scalp: none of it under the hair
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n        metalnessFactor *= 1.0 - sHair;')
        .replace('#include <aomap_fragment>', '#ifdef USE_AOMAP\n        reflectedLight.indirectDiffuse /= mix(1.0, max((texture2D(aoMap, vAoMapUv).r - 1.0) * aoMapIntensity + 1.0, 0.05), sHair);\n        #endif\n        #include <aomap_fragment>')
        // skin matte like casual Hal's, slicked hair with a soft sheen, the uniform as scanned
        .replace('roughnessFactor = max(roughnessFactor, uRoughMin);', 'roughnessFactor = mix(mix(mix(max(roughnessFactor, uRoughMin), max(roughnessFactor, 0.62), sSkin), 0.6, sHair), 0.45, sWet);');
    };
    mat.customProgramCacheKey = () => 'gl-sinestro';
  }
  rig.root.scale.set(0.96, 1, 0.96); // a shade leaner than Abin Sur
  return rig;
}

function emblemTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#062b12';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = g.fillStyle = '#d9ffe4';
  g.lineWidth = size * 0.1;
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.27, 0, Math.PI * 2);
  g.stroke();
  g.fillRect(size * 0.12, size * 0.22, size * 0.76, size * 0.08);
  g.fillRect(size * 0.12, size * 0.7, size * 0.76, size * 0.08);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRing() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x3bff7a, emissive: 0x22ff66, emissiveIntensity: 1.6, metalness: 0.7, roughness: 0.25 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0032, 14, 48), metal);
  group.add(band);
  const emblem = emblemTexture();
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: emblem, emissive: 0x7dffaa, emissiveMap: emblem, emissiveIntensity: 3 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 32), [metal, faceMat, metal]);
  crown.position.y = 0.0125;
  group.add(crown);
  group.userData.materials = [metal, faceMat];
  return group;
}

// The power battery: a lathed lantern body with glowing panes.
export function createLantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, metalness: 0.8, roughness: 0.35, emissive: 0x0a3d18, emissiveIntensity: 0.6 });
  const profile = [
    [0, 0], [0.13, 0], [0.14, 0.02], [0.12, 0.045], [0.1, 0.05], [0.1, 0.07], [0.125, 0.085], [0.125, 0.1],
    [0.1, 0.11], [0.1, 0.33], [0.13, 0.35], [0.13, 0.37], [0.09, 0.4], [0.06, 0.43], [0.06, 0.46], [0.03, 0.47], [0, 0.47],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), metal);
  body.castShadow = true;
  group.add(body);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.21, 6, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9dffc0, emissive: 0x4dff88, emissiveIntensity: 2.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  glass.position.y = 0.22;
  group.add(glass);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.014), metal);
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    bar.position.set(Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1);
    group.add(bar);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 10, 40, Math.PI), metal);
  handle.position.y = 0.47;
  group.add(handle);
  const light = new THREE.PointLight(0x55ff8a, 1.2, 4, 2);
  light.position.y = 0.22;
  group.add(light);
  group.userData = { glass, light };
  return group;
}
