import * as THREE from 'three';
import { createCharacter, JAW } from './Characters.js';
import { Animator } from './Rig.js';
import { MocapClip } from './Mocap.js';
import { BodyLanguage } from './BodyLanguage.js';
import { buildRobe } from './Robe.js';
import { growHair } from './HairCards.js';

// A Guardian of the Universe, derived from Abin Sur's scan (an old, deeply lined alien face, which
// suits them): blue skin, the skull swollen into the great domed cranium, a fringe of white hair
// above and behind the ears with the crown bald, white brows, dark eyes; the head enlarged on a thin
// neck and the whole figure scaled to about 1.3 m. The scan's suit is cut away below the neck and a
// red robe built round the body instead (Robe.js), in the pose they keep: hands joined in front,
// each in the other's sleeve. Painted in the bind pose's object space, like Sinestro (the same
// landmarks: chin 1.665, mouth 1.72, nose 1.75 to 1.79, brow ridge 1.83, crown 1.96). `rig.gu` holds
// the tunable values.
const GUARDIAN_COMMON = /* glsl */ `
  varying vec3 vComb;
  float gA(vec3 p) { return abs(atan(p.x, p.z - uHeadZ)); }
  // the fringe: a band round the back of the head from a rounded point at each temple, over the
  // ears, widening down to the nape behind. Its edges at angle a (0 at the face, pi behind):
  float gT(float a) { return clamp((a - uHairA0) / (3.1416 - uHairA0), 0.0, 1.0); }
  vec2 gBand(float a) {
    float t = gT(a);
    float top = mix(uHairTopS, uHairTopB, smoothstep(0.3, 1.0, t));
    float low = mix(uHairLowS, uNapeY, smoothstep(0.35, 0.85, t));
    float c = (top + low) * 0.5, h = (top - low) * 0.5 * sqrt(smoothstep(0.0, 0.22, t));
    return vec2(c - h, c + h);
  }
  float gHair(vec3 p, float fz) {
    float a = gA(p) + fz * 6.0;
    vec2 b = gBand(a);
    return step(uHairA0, a) * smoothstep(b.x, b.x + 0.008, p.y + fz) * (1.0 - smoothstep(b.y - 0.008, b.y, p.y - fz));
  }
  // the hair's mass standing off the scalp: fullest midway up the band and behind
  float gThick(vec3 p) {
    float a = gA(p);
    vec2 b = gBand(a);
    float m = clamp(1.0 - pow(abs((p.y - (b.x + b.y) * 0.5) / max((b.y - b.x) * 0.5, 1e-3)), 2.0), 0.0, 1.0);
    return gHair(p, 0.0) * uHairT * (0.3 + 0.7 * m) * (0.5 + 0.5 * smoothstep(0.1, 0.6, gT(a)));
  }
`;
const GUARDIAN_VERTEX = /* glsl */ `
  // the great cranium: up and out above the brow, most at the crown (from the skull's centre, by
  // position only, so the scan's seams stay closed)
  float gUp = smoothstep(uDomeY0, 1.97, position.y);
  transformed += normalize(position - vec3(0.0, uDomeCY, uHeadZ)) * uDome * gUp;
  transformed.y += uDomeLift * gUp * gUp;
  transformed.x *= 1.0 + uDomeWide * smoothstep(uDomeY0, 1.93, position.y);
  transformed += normalize(position - vec3(0.0, 1.80, uHeadZ)) * gThick(position);
  // the whole head larger, on a thin neck
  float gS = mix(1.0, uHeadScale, smoothstep(uNeckY0, uNeckY1, position.y));
  transformed = uPivot + (transformed - uPivot) * gS;
  vComb = normalize(normalMatrix * mix(vec3(0.0, -0.15, -1.0), vec3(0.0, -1.0, -0.15), smoothstep(2.0, 2.8, gA(position))));
  // what the robe doesn't cover: the head, the neck inside the collar, the hands
  vKeep = 1.0;
  #ifdef USE_SKINNING
    vec4 gW = skinWeight;
    vKeep = dot(gW, vec4(equal(skinIndex, vec4(4.0)))) + dot(gW, vec4(equal(skinIndex, vec4(3.0)))) * step(1.6, position.y)
      + (dot(gW, vec4(equal(skinIndex, vec4(7.0)))) * uHandL + dot(gW, vec4(equal(skinIndex, vec4(10.0)))) * uHandR);
  #endif
`;
const GUARDIAN_GLSL = /* glsl */ `
  vec3 sp = vDPos;
  if (vKeep < 0.5) discard;
  vec3 sc = diffuseColor.rgb;
  float sAng = gA(sp);
  float sx = abs(sp.x);
  float sLum = dot(sc, vec3(0.299, 0.587, 0.114));
  // blue skin over all that's left, the scan's own shading kept
  vec3 sBlue = uSkin * pow(max(sLum, 1e-4) / uSkinLum, uSkinGamma);
  sBlue *= mix(vec3(1.0), uSkinTop, smoothstep(1.84, 1.95, sp.y)); // paler up the dome
  sc = sBlue;
  // the eyes: dark, deep under the brow, with a wet glint
  float sEu = sx - uEyeX, sEv = sp.y - uEyeY - sEu * uEyeTilt;
  float sEf = smoothstep(0.03, 0.05, sp.z - uHeadZ) * step(sAng, 1.0);
  float sLid = uEyeH * max(1.0 - (sEu * sEu) / (uEyeW * uEyeW), 0.0);
  float sIn = (1.0 - smoothstep(sLid - 0.0007, sLid + 0.0005, abs(sEv))) * step(abs(sEu), uEyeW) * sEf;
  float sIrisD = length(vec2(sEu - uIrisX, sEv * 0.9));
  vec3 sEyeCol = mix(vec3(0.5, 0.52, 0.6), uIrisCol, smoothstep(uIrisR + 0.0008, uIrisR - 0.0004, sIrisD));
  sEyeCol = mix(sEyeCol, vec3(0.004), smoothstep(uIrisR * 0.5, uIrisR * 0.35, sIrisD));
  sEyeCol *= 0.5 + 0.5 * smoothstep(uEyeW, uEyeW * 0.3, abs(sEu));
  sc = mix(sc, sEyeCol, sIn);
  float sLash = (1.0 - smoothstep(0.0006, 0.0016, abs(sEv - sLid - 0.0004))) * smoothstep(uEyeW * 1.05, uEyeW * 0.4, abs(sEu)) * sEf;
  sc = mix(sc, uSkin * 0.25, sLash);
  float sWet = sIn;
  // the hair's mass (loose strands lie over it as cards): white combed strands, greyer in the
  // clumps' shadows, the edge broken into single hairs
  float sFuzz = (dNoise(sp * 900.0) - 0.5) * 0.006 + (dNoise(sp * 140.0) - 0.5) * 0.006;
  float sHair = gHair(sp, sFuzz);
  float sSide = pow(sin(min(sAng, 3.1416)), 2.0);
  float sAcross = mix(sp.x, sp.y * 1.3, sSide);
  float sAlong = mix(sp.z * 70.0 + sp.y * 60.0, sp.z * 70.0, sSide);
  float sFine = 1.0 - smoothstep(0.4, 1.2, fwidth(sAcross * 1500.0));
  float sStr = mix(0.5, dNoise(vec3(sAcross * 1500.0, sAlong, 0.0)), sFine) * 0.5 + dNoise(vec3(sAcross * 300.0, sAlong * 0.25, 3.0)) * 0.5;
  sc = mix(sc, uHairCol * mix(0.42, 0.95, smoothstep(0.25, 0.8, sStr)), sHair);
  // brows: white and thick, a little drooping at their ends, with a frown line between
  float sFace = smoothstep(0.02, 0.04, sp.z - uHeadZ) * step(sAng, 1.0);
  float sBt = clamp((sx - 0.006) / 0.046, 0.0, 1.0);
  float sBrowY = uBrowY + sBt * uBrowRise - uBrowDroop * smoothstep(0.6, 1.0, sBt);
  float sBrowW = uBrowW * (1.25 - 0.55 * sBt);
  float sBrowN = (dNoise(sp * vec3(260.0, 2600.0, 260.0)) - 0.5) * 0.004;
  float sBrow = (1.0 - smoothstep(sBrowW * 0.4, sBrowW, abs(sp.y - sBrowY + sBrowN))) * smoothstep(0.004, 0.009, sx) * (1.0 - smoothstep(0.048, 0.056, sx)) * sFace;
  float sBrowS = mix(0.5, dNoise(vec3(sx * 3000.0, sp.y * 400.0, 5.0)), 1.0 - smoothstep(0.4, 1.2, fwidth(sx * 3000.0)));
  sc = mix(sc, uHairCol * (0.55 + 0.45 * sBrowS), sBrow);
  float sFrown = (1.0 - smoothstep(0.0005, 0.0013, abs(sx - 0.0045 - (sp.y - uBrowY) * 0.15))) * smoothstep(uBrowY, uBrowY + 0.004, sp.y) * (1.0 - smoothstep(uBrowY + 0.015, uBrowY + 0.022, sp.y));
  sc = mix(sc, sc * 0.55, sFrown * sFace);
  float sHairAll = max(sHair, sBrow);
  sc = mix(sc, vec3(1.0, 0.0, 1.0), uDebug * (1.0 - smoothstep(0.0, 0.001, abs(sp.y - uDebugY))));
  diffuseColor.rgb = sc;
`;

// combed grooves: the scan's scalp normals replaced by the hair's, tipped across the strands
const GUARDIAN_NORMAL = /* glsl */ `
  if (sHair > 0.01) {
    normal = normalize(mix(normal, nonPerturbedNormal, sHair));
    vec3 sCv = normalize(vComb - normal * dot(vComb, normal));
    vec3 sAc = normalize(cross(normal, sCv));
    float sG = sin(sAcross * 600.0 + dNoise(vec3(sAcross * 140.0, sAlong * 0.4, 1.0)) * 4.0) * (0.35 + 0.65 * dNoise(vec3(sAcross * 110.0, sAlong * 0.2, 7.0))) * (1.0 - smoothstep(0.4, 1.2, fwidth(sAcross * 600.0))) + (sStr - 0.5) * 1.2;
    normal = normalize(normal + sAc * sG * 0.35 * sHair);
  }
`;

// the Corps emblem as the robes wear it: a white disc with the lantern sign in green
function robeEmblem(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), h = size / 2;
  g.fillStyle = '#e9ece6';
  g.beginPath(); g.arc(h, h, size * 0.48, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = size * 0.035;
  g.beginPath(); g.arc(h, h, size * 0.45, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = g.fillStyle = '#138a3a';
  g.lineWidth = size * 0.075;
  g.beginPath(); g.arc(h, h, size * 0.2, 0, Math.PI * 2); g.stroke();
  g.fillRect(size * 0.2, size * 0.27, size * 0.6, size * 0.065);
  g.fillRect(size * 0.2, size * 0.665, size * 0.6, size * 0.065);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Their body language, in the scan's metres (shoulders at ±0.2, 1.55; arms about 0.6 m): at rest
// the hands are joined in front, each in the other's sleeve; a speaker lifts one open hand.
export const GUARDIAN_STANCES = {
  sleeves: { L: [-0.02, 1.16, 0.22], R: [0.02, 1.18, 0.245], poleL: [1, -0.3, -0.7], poleR: [-1, -0.3, -0.7] },
};
export const GUARDIAN_GESTURES = {
  // one hand raised, open, toward the listener: the council speaks
  decree: { dur: 2.4, rate: 4, poleL: [1, -0.5, -0.3], L: [[0.6, [0.16, 1.38, 0.34]], [1.9, [0.17, 1.4, 0.33]]], head: [[0.5, 'chin', 1.2, 0.5]] },
  // a small open hand, down and out: "it is done", "go"
  release: { dur: 1.8, rate: 4, poleL: [1, -0.5, -0.3], L: [[0.5, [0.24, 1.2, 0.3]], [1.3, [0.26, 1.18, 0.29]]] },
};

const sstep = (e0, e1, x) => THREE.MathUtils.smoothstep(x, e0, e1);
const mix = THREE.MathUtils.lerp;

// The vertex stage's reshaping of the head, and the hair and brow masks, in JS (for the cards).
function headShape(gu) {
  const u = Object.fromEntries(Object.entries(gu).map(([k, v]) => [k, v.value]));
  const gA = (p) => Math.abs(Math.atan2(p.x, p.z - u.uHeadZ));
  const gT = (a) => THREE.MathUtils.clamp((a - u.uHairA0) / (Math.PI - u.uHairA0), 0, 1);
  const band = (a) => {
    const t = gT(a), top = mix(u.uHairTopS, u.uHairTopB, sstep(0.3, 1, t)), low = mix(u.uHairLowS, u.uNapeY, sstep(0.35, 0.85, t));
    const c = (top + low) / 2, h = ((top - low) / 2) * Math.sqrt(sstep(0, 0.22, t));
    return [c - h, c + h];
  };
  const hair = (p) => { const a = gA(p), [lo, hi] = band(a); return (a >= u.uHairA0 ? 1 : 0) * sstep(lo, lo + 0.008, p.y) * (1 - sstep(hi - 0.008, hi, p.y)); };
  const thick = (p) => {
    const a = gA(p), [lo, hi] = band(a);
    const m = THREE.MathUtils.clamp(1 - Math.abs((p.y - (lo + hi) / 2) / Math.max((hi - lo) / 2, 1e-3)) ** 2, 0, 1);
    return hair(p) * u.uHairT * (0.3 + 0.7 * m) * (0.5 + 0.5 * sstep(0.1, 0.6, gT(a)));
  };
  const brow = (p) => {
    const sx = Math.abs(p.x), bt = THREE.MathUtils.clamp((sx - 0.006) / 0.046, 0, 1);
    const y = u.uBrowY + bt * u.uBrowRise - u.uBrowDroop * sstep(0.6, 1, bt), w = u.uBrowW * (1.25 - 0.55 * bt);
    return (1 - sstep(w * 0.4, w, Math.abs(p.y - y))) * sstep(0.004, 0.009, sx) * (1 - sstep(0.048, 0.056, sx)) * sstep(0.02, 0.04, p.z - u.uHeadZ) * (gA(p) < 1 ? 1 : 0);
  };

  const deform = (p) => {
    const up = sstep(u.uDomeY0, 1.97, p.y), q = p.clone();
    q.addScaledVector(p.clone().sub(new THREE.Vector3(0, u.uDomeCY, u.uHeadZ)).normalize(), u.uDome * up);
    q.y += u.uDomeLift * up * up;
    q.x *= 1 + u.uDomeWide * sstep(u.uDomeY0, 1.93, p.y);
    q.addScaledVector(p.clone().sub(new THREE.Vector3(0, 1.8, u.uHeadZ)).normalize(), thick(p));
    const s = mix(1, u.uHeadScale, sstep(u.uNeckY0, u.uNeckY1, p.y));
    return q.sub(u.uPivot).multiplyScalar(s).add(u.uPivot);
  };
  return { u, gA, deform, hair, brow };
}

export function createGuardian(abinGltf, mocap, { robe = '#8e1512', seed = 0, hairCount = 2200 } = {}) {
  // the jaw's hinge where the head-scaling puts it (the jaw turns after the head is reshaped)
  const jS = 1.58, jP = 1.64, jaw = { ...JAW.abin, hinge: [jP + (JAW.abin.hinge[0] - jP) * jS, JAW.abin.hinge[1] * jS] };
  const rig = createCharacter(abinGltf, { glow: 0, jaw });
  const gu = (rig.gu = {
    uSkin: { value: new THREE.Color(0.2, 0.36, 0.78) }, uSkinTop: { value: new THREE.Color(1.08, 1.06, 1.02) }, uSkinLum: { value: 0.3 }, uSkinGamma: { value: 0.8 },
    uHeadZ: { value: 0.033 },
    uDome: { value: 0.022 }, uDomeY0: { value: 1.83 }, uDomeCY: { value: 1.83 }, uDomeLift: { value: 0.04 }, uDomeWide: { value: 0.07 },
    uHeadScale: { value: 1.58 }, uNeckY0: { value: 1.6 }, uNeckY1: { value: 1.68 }, uPivot: { value: new THREE.Vector3(0, 1.64, 0) },
    uHairTopS: { value: 1.895 }, uHairTopB: { value: 1.93 }, uHairLowS: { value: 1.845 }, uNapeY: { value: 1.72 }, uHairA0: { value: 1.12 },
    uHairCol: { value: new THREE.Color(0.86, 0.88, 0.92) }, uHairT: { value: 0.013 },
    uEyeX: { value: 0.031 }, uEyeY: { value: 1.806 }, uEyeW: { value: 0.0125 }, uEyeH: { value: 0.0032 }, uEyeTilt: { value: 0.1 },
    uIrisX: { value: -0.001 }, uIrisR: { value: 0.0058 }, uIrisCol: { value: new THREE.Color(0.06, 0.08, 0.14) },
    uBrowY: { value: 1.823 }, uBrowRise: { value: 0.006 }, uBrowDroop: { value: 0.006 }, uBrowW: { value: 0.0085 },
    uHandL: { value: 0 }, uHandR: { value: 0 }, // hands out of the sleeves
    uDebug: { value: 0 }, uDebugY: { value: 1.8 },
  });
  // no two alike: the fringe higher or lower, the dome taller, the skin a shade apart
  if (seed) {
    const r = (k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
    gu.uHairTopS.value += r(1) * 0.02; gu.uHairTopB.value += r(2) * 0.024; gu.uHairLowS.value += r(3) * 0.008;
    gu.uHeadScale.value += r(4) * 0.08; gu.uDomeLift.value += r(5) * 0.02; gu.uBrowDroop.value += r(6) * 0.006;
    gu.uSkin.value.offsetHSL(r(7) * 0.03, r(8) * 0.1, r(9) * 0.04);
  }
  const decl = Object.keys(gu).map((k) => `uniform ${gu[k].value.isColor || gu[k].value.isVector3 ? 'vec3' : 'float'} ${k};`).join('\n');
  for (const m of rig.meshes) {
    const mat = m.material, base = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      base(sh, r);
      Object.assign(sh.uniforms, gu);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${decl}\nvarying float vKeep;\n${GUARDIAN_COMMON}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GUARDIAN_VERTEX}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${decl}\nvarying float vKeep;\n${GUARDIAN_COMMON}`)
        .replace('diffuseColor.rgb *= uTint;', `${GUARDIAN_GLSL}\n        diffuseColor.rgb *= uTint;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GUARDIAN_NORMAL}`)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n        metalnessFactor = 0.0;')
        .replace('roughnessFactor = max(roughnessFactor, uRoughMin);', 'roughnessFactor = mix(mix(max(roughnessFactor, 0.6), 0.55, sHairAll), 0.4, sWet);');
    };
    mat.customProgramCacheKey = () => 'gl-guardian';
  }
  // stand them as they will stand, then dress them
  const anim = (rig.anim = new Animator(rig));
  anim.play(new MocapClip(mocap, 'idle', { timeScale: 0.45 }), 0);
  const bl = (rig.bl = new BodyLanguage(rig, anim, { gestures: GUARDIAN_GESTURES, stances: GUARDIAN_STANCES, scale: 1, shift: null }));
  bl.stance('sleeves');
  for (let i = 0; i < 75; i++) { bl.update(1 / 30); anim.update(1 / 30); }
  rig.robe = buildRobe(rig, { color: robe, emblem: robeEmblem(), head: { scale: gu.uHeadScale.value, pivot: gu.uPivot.value } });
  // the fringe: combed back over the ears, down behind them; standing off the head, fullest midway
  const hs = headShape(gu), V = (x, y, z) => new THREE.Vector3(x, y, z), mesh = rig.meshes[0];
  rig.hair = growHair(mesh, {
    bone: 4, mask: hs.hair, deform: hs.deform, centre: V(0, 1.8, hs.u.uHeadZ), count: hairCount,
    comb: (p) => V(Math.sign(p.x) * 0.15, -0.25, -1).lerp(V(0, -1, -0.2), sstep(2.0, 2.8, hs.gA(p))),
    length: [0.03, 0.06], width: 0.007, lift: [0.0, 0.007], hug: 0.006, color: hs.u.uHairCol.clone(), root: 0.55,
  });
  // the brows: short and wiry, growing out from the nose, a few longer ones
  rig.brows = growHair(mesh, {
    bone: 4, mask: hs.brow, deform: hs.deform, centre: V(0, 1.8, hs.u.uHeadZ), count: 700,
    comb: (p) => V(Math.sign(p.x), 0.18 * (1 - sstep(0.01, 0.03, Math.abs(p.x))) - 0.05, 0.25),
    length: [0.006, 0.014], width: 0.0035, lift: [0.001, 0.004], segments: 3, curl: 0.4, color: hs.u.uHairCol.clone(), root: 0.75,
  });
  rig.root.scale.setScalar(0.62); // about 1.3 m to the top of the dome
  return rig;
}
