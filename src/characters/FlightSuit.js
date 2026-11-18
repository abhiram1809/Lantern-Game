import * as THREE from 'three';
import { createHal, JAW, patchMaterial } from './Characters.js';

// Hal's flight suit (Part Five, his first shift as Ferris Aircraft's test pilot), made over the
// casual scan, which is a T-shirt, jeans and socks. A test pilot's kit, after the US one-piece
// (CWU-27/P) a contractor's pilots wear: a sage coverall with a mandarin collar, a zip from the
// collar to the crotch, slanted zip pockets on the chest, a name tag and a Ferris patch, the flag
// and the company's patch on the shoulders, gathered cuffs; over it the anti-g trousers (a darker
// olive, over the belly, the thighs and the calves, open at the knees, zipped down the outsides), a
// parachute harness (webbing over the shoulders, a chest strap, leg loops, metal fittings), and
// black flying boots.
//
// The coverall is a garment, not paint: a second skinned surface made from the scan's own body
// below the neck (not the hands or the head), smoothed (Taubin, so it doesn't shrink) until the
// T-shirt's hems and the jeans' creases are gone, then pushed out by a thickness that varies over
// the body (loose sleeves and legs, close at the cuffs and collar, the anti-g layer thicker), and
// never less than a few millimetres outside the skin it covers. It is bound to the same skeleton
// with the same weights, so it moves with him; the scan's body under it is discarded in its shader,
// so nothing can come through. The details are painted in the bind pose's object space (vDPos:
// metres, facing +Z, the T-pose's arms along X), measured on the scan: neck 1.543, shoulders ±0.183
// at 1.44, elbows ±0.49, wrists ±0.74, hips 0.878, knees 0.522, ankles 0.092.
//
// The helmet (`rig.helmet`, hidden until he puts it on) is a rigid shell on the head bone, after
// an HGU-55/P: a smooth dome, ear cups, a visor housing and a gold visor (`helmetVisor(k)`); the
// hair under it is discarded while it's on.
//
// createPilot(casualGltf) is a whole Hal in the kit (his own rig, so the casual one stays as it is):
// swap it in with player.setRig, as the Lantern suit is.

const SUIT_COVER = /* glsl */ `
  float suitCover = 1.0;
  #ifdef USE_SKINNING
    // everything but the head, the hands, and the neck above the collar
    suitCover = 1.0 - dot(skinWeight, vec4(equal(skinIndex, vec4(4.0)))) - dot(skinWeight, vec4(equal(skinIndex, vec4(7.0))))
      - dot(skinWeight, vec4(equal(skinIndex, vec4(10.0)))) - step(1.517, position.y) * dot(skinWeight, vec4(equal(skinIndex, vec4(3.0))));
  #endif
  vCover = suitCover;
`;

// the helmet's inside, in the bind pose (the skull's centre and half-sizes): the hair inside it is
// discarded while it's on; the face below the brow stays
const HELMET = { c: [0, 1.718, -0.012], r: [0.118, 0.13, 0.142], brow: 1.668, face: 0.045 };
const HELMET_GLSL = /* glsl */ `
  bool inHelmet(vec3 p) {
    vec3 d = (p - vec3(${HELMET.c.join(', ')})) / vec3(${HELMET.r.map((r) => r * 1.04).join(', ')});
    bool face = p.z > ${HELMET.face.toFixed(3)} && p.y < ${HELMET.brow.toFixed(3)};
    return dot(d, d) < 1.0 && !face && p.y > 1.58;
  }
`;

// The base scan in the kit: hidden where the coverall covers it, and its hair under the helmet.
function coverBase(mat, su) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base(sh, r);
    Object.assign(sh.uniforms, su);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCover;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>\n${SUIT_COVER}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vCover;\nuniform float uSuitOn, uHelmetOn;\n${HELMET_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uSuitOn > 0.5 && vCover > 0.62 && !(abs(vDPos.x) > 0.703 && vDPos.y > 1.2) && vDPos.y < 1.53) discard;
        if (uHelmetOn > 0.5 && inHelmet(vDPos)) discard;`);
  };
  mat.customProgramCacheKey = () => 'gl-pilot-base';
}

// ------------------------------------------------------------------------------- the coverall's look
const SUIT_COMMON = /* glsl */ `
  uniform sampler2D uPatches;
  float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // distance from p to the segment ab
  float sSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
  // a line w wide, anti-aliased over a pixel
  float sLine(float d, float w) { d = abs(d); float f = fwidth(d) + 1e-5; return 1.0 - smoothstep(w * 0.5 - f, w * 0.5 + f, d); }
  float sBox(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
  vec3 perturbSuit(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
    vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)), vSigmaY = normalize(dFdy(surf_pos.xyz)), vN = surf_norm;
    vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
    float fDet = dot(vSigmaX, R1) * faceDirection;
    vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
    return normalize(abs(fDet) * surf_norm - vGrad);
  }
`;
const SUIT_COLOR = /* glsl */ `
  vec3 p = vDPos;
  float ax = abs(p.x);
  // the cuffs and the collar cut clean (the coverall's edge triangles follow the scan's and frayed)
  if ((ax > 0.712 && p.y > 1.2) || p.y > 1.538) discard;
  float side = sign(p.x + 1e-6); // +1 his left
  float arm = smoothstep(0.205, 0.235, ax) * step(1.22, p.y);
  float leg = (1.0 - arm) * (1.0 - smoothstep(0.88, 0.95, p.y));
  float torso = (1.0 - arm) * (1.0 - leg);
  // round each limb, the angle about its axis (0 at the front, +-pi/2 at the sides)
  float legX = side * 0.12;
  float legA = atan(p.x - legX, p.z - 0.0);
  float armA = atan(p.y - 1.41, p.z + 0.05); // 0 up (outside, in the T-pose), +-pi front and back
  float torA = atan(p.x, p.z - 0.0);
  vec3 sage = vec3(0.15, 0.162, 0.118), olive = vec3(0.088, 0.094, 0.064), web = vec3(0.07, 0.072, 0.06);
  vec3 col = sage;
  float rough = 0.9, metal = 0.0, h = 0.0;
  // the weave: a fine twill, faded to its average where it's finer than a pixel
  float tw = fract((p.x + p.y + p.z) * 520.0);
  float twF = 1.0 - smoothstep(0.3, 0.9, fwidth((p.x + p.y + p.z) * 520.0));
  col *= 1.0 + 0.035 * (tw - 0.5) * twF;
  h += 0.15 * (tw - 0.5) * twF;
  // seams: the yoke across the shoulders, down the sides, under the sleeves, the legs' outsides and
  // insides; a darker stitched line, a slight ridge
  float seam = 0.0;
  seam = max(seam, torso * sLine(p.y - 1.395, 0.003) * step(0.06, ax));
  seam = max(seam, torso * sLine(abs(abs(torA) - 1.5708), 0.025));
  seam = max(seam, arm * sLine(abs(abs(armA) - 3.1416), 0.07));
  seam = max(seam, leg * sLine(abs(abs(legA) - 1.5708), 0.05));
  col = mix(col, col * 0.62, seam);
  h += seam * 0.6;
  // the collar: up the neck to its edge, folded at its foot
  float collar = smoothstep(1.49, 1.5, p.y);
  col = mix(col, col * 0.7, sLine(p.y - 1.5, 0.0025) * collar + sLine(p.y - 1.531, 0.002));
  // the zip, collar to crotch, front and centre: metal teeth and a pull
  float front = smoothstep(-0.01, 0.03, p.z);
  float zip = torso * front * (1.0 - smoothstep(0.0045, 0.0065, ax)) * step(0.865, p.y) * step(p.y, 1.525);
  float teeth = step(0.5, fract(p.y * 330.0 + step(0.0, p.x) * 0.5));
  vec3 brass = vec3(0.26, 0.24, 0.2);
  col = mix(col, mix(brass * 0.5, brass, teeth), zip);
  metal = max(metal, zip * 0.85); rough = mix(rough, 0.4, zip);
  float pull = torso * front * (1.0 - step(0.0, sBox(p.xy, vec2(0.0, 1.488), vec2(0.006, 0.012))));
  col = mix(col, brass * 1.2, pull); metal = max(metal, pull); rough = mix(rough, 0.35, pull);
  // the chest pockets: stitched outlines, a slanted zip across each top
  vec2 cq = vec2(ax, p.y);
  float pocket = torso * front * sLine(abs(sBox(cq, vec2(0.097, 1.285), vec2(0.058, 0.062))), 0.0025);
  float pzip = torso * front * sLine(sSeg(cq, vec2(0.045, 1.338), vec2(0.15, 1.312)), 0.006);
  col = mix(col, col * 0.6, pocket);
  col = mix(col, brass * 0.7, pzip); metal = max(metal, pzip * 0.8);
  h += pocket * 0.5 + pzip * 0.8;
  // patches (the atlas: name tag, Ferris roundel, flag, Ferris wings): the name tag on his left
  // breast, the wings on his right, the flag on his left shoulder, the roundel on his right
  vec4 pt = vec4(0.0);
  vec2 tu = (vec2(p.x, p.y) - vec2(0.152, 1.405)) / vec2(0.078, 0.04) + 0.5;
  if (torso * front > 0.5 && all(greaterThan(tu, vec2(0.0))) && all(lessThan(tu, vec2(1.0)))) pt = texture2D(uPatches, vec2(tu.x * 0.5, 1.0 - (1.0 - tu.y) * 0.5));
  vec2 wu = (vec2(p.x, p.y) - vec2(-0.152, 1.405)) / vec2(0.078, 0.04) + 0.5;
  if (torso * front > 0.5 && all(greaterThan(wu, vec2(0.0))) && all(lessThan(wu, vec2(1.0)))) pt = texture2D(uPatches, vec2(wu.x * 0.5, 0.5 - (1.0 - wu.y) * 0.5));
  float up = step(1.43, p.y) * arm;
  vec2 fu = (vec2(p.x, -p.z) - vec2(0.275, 0.035)) / vec2(0.075, 0.045) + 0.5;
  if (up > 0.5 && all(greaterThan(fu, vec2(0.0))) && all(lessThan(fu, vec2(1.0)))) pt = texture2D(uPatches, vec2(0.75 + fu.x * 0.25, 1.0 - (1.0 - fu.y) * 0.265));
  vec2 ru = (vec2(-p.x, p.z) - vec2(0.275, -0.035)) / vec2(0.07, 0.07) + 0.5;
  if (up > 0.5 && all(greaterThan(ru, vec2(0.0))) && all(lessThan(ru, vec2(1.0)))) pt = texture2D(uPatches, vec2(0.5 + ru.x * 0.25, 1.0 - (1.0 - ru.y) * 0.5));
  col = mix(col, pt.rgb, pt.a);
  rough = mix(rough, 0.7, pt.a);
  h += pt.a * 0.9;
  // the cuffs: gathered at the wrists, a velcro tab over each
  float cuff = arm * smoothstep(0.66, 0.67, ax);
  col = mix(col, col * 0.85, cuff);
  float tab = arm * (1.0 - step(0.0, sBox(vec2(ax, armA), vec2(0.69, 0.3), vec2(0.018, 0.5))));
  col = mix(col, col * 0.72, tab); h += tab;
  // the anti-g trousers: the belly, the thighs and the calves, open at the knees (front and back),
  // a zip down each leg's outside, lacing at the back of the calf
  float belly = torso * smoothstep(0.92, 0.93, p.y) * (1.0 - smoothstep(1.1, 1.11, p.y));
  float knee = (1.0 - smoothstep(0.585, 0.6, p.y)) * smoothstep(0.455, 0.47, p.y) * step(abs(legA), 1.0);
  float pop = (1.0 - smoothstep(0.585, 0.6, p.y)) * smoothstep(0.455, 0.47, p.y) * step(2.2, abs(legA));
  float gLeg = leg * smoothstep(0.28, 0.29, p.y) * (1.0 - smoothstep(0.9, 0.91, p.y)) * (1.0 - knee) * (1.0 - pop);
  float gsuit = max(belly, gLeg);
  col = mix(col, olive * (1.0 + 0.05 * (tw - 0.5) * twF), gsuit);
  float gzip = gLeg * sLine(abs(legA) - 1.5708 * 1.0, 0.04) * step(0.0, side * (p.x - legX));
  col = mix(col, brass * 0.55, gzip * gsuit); metal = max(metal, gzip * 0.7);
  float lace = gLeg * step(2.7, abs(legA)) * step(p.y, 0.46) * step(0.5, fract(p.y * 90.0)) * sLine(abs(fract(legA * 3.0) - 0.5), 0.3);
  col = mix(col, web, lace);
  // its edges, bound with tape
  float gEdge = (sLine(p.y - 0.925, 0.006) + sLine(p.y - 1.105, 0.006)) * torso + (sLine(p.y - 0.29, 0.006) + sLine(p.y - 0.465, 0.006) + sLine(p.y - 0.59, 0.006)) * leg;
  col = mix(col, olive * 0.6, min(gEdge, 1.0)); h += min(gEdge, 1.0) * 0.8;
  // the harness: webbing over each shoulder (a band where the plane x = s(y) cuts the torso, so it
  // runs up the front, over the top and down the back), a chest strap and buckle, leg loops, and
  // the metal fittings the parachute's risers clip to
  float sx = 0.067 + 0.025 * smoothstep(1.3, 1.5, p.y);
  float strap = torso * sLine(ax - sx, 0.042) * step(0.87, p.y) * step(p.y, 1.56);
  float chestStrap = torso * front * sLine(p.y - 1.245, 0.038) * step(ax, 0.1);
  float loop = leg * sLine(p.y - (0.81 + 0.035 * smoothstep(0.0, -0.08, p.z)), 0.04);
  float harness = max(max(strap, chestStrap), loop);
  float wTw = step(0.5, fract((p.y + p.x) * 400.0)) * twF;
  // (its edges in shadow: it's thick webbing on top of the cloth)
  float sEdge = torso * (sLine(abs(ax - sx) - 0.019, 0.004) * step(0.87, p.y) * step(p.y, 1.56)) + torso * front * sLine(abs(p.y - 1.245) - 0.017, 0.004) * step(ax, 0.1) + leg * sLine(abs(p.y - (0.81 + 0.035 * smoothstep(0.0, -0.08, p.z))) - 0.018, 0.004);
  col = mix(col, web * (0.92 + 0.08 * wTw), harness);
  col *= 1.0 - 0.45 * min(sEdge, 1.0);
  rough = mix(rough, 0.8, harness);
  h += harness * 1.4;
  float koch = torso * front * (1.0 - step(0.0, sBox(vec2(ax, p.y), vec2(0.075, 1.345), vec2(0.022, 0.026))));
  float buckle = torso * front * (1.0 - step(0.0, sBox(p.xy, vec2(0.0, 1.245), vec2(0.026, 0.021))));
  float fit = max(koch, buckle);
  // (dark, worn steel: bright metal under the desert sky read as white stickers)
  vec3 steel = vec3(0.2, 0.205, 0.21);
  float slot = koch * (1.0 - step(0.0, sBox(vec2(ax, p.y), vec2(0.075, 1.345), vec2(0.011, 0.012)))) + buckle * (1.0 - step(0.0, sBox(p.xy, vec2(0.0, 1.245), vec2(0.016, 0.008))));
  col = mix(col, mix(steel, web * 0.6, slot), fit);
  metal = max(metal, fit * (1.0 - slot) * 0.8); rough = mix(rough, 0.5, fit); h += fit * 2.0 - slot * 1.5;
  // boots: black leather to mid-calf, laced up the front, a rubber sole, the toe capped
  float boot = leg * (1.0 - smoothstep(0.27, 0.275, p.y));
  vec3 leather = vec3(0.022, 0.02, 0.019);
  float bootLace = boot * step(0.09, p.y) * step(abs(legA), 0.32) * step(0.5, fract(p.y * 70.0 + abs(legA) * 2.0));
  float sole = boot * (1.0 - smoothstep(0.024, 0.028, p.y));
  float toe = boot * smoothstep(0.075, 0.1, p.z) * step(p.y, 0.09);
  col = mix(col, leather * (1.0 + 0.6 * toe), boot);
  col = mix(col, vec3(0.06, 0.055, 0.05), bootLace);
  col = mix(col, vec3(0.05, 0.048, 0.045), sole);
  rough = mix(rough, mix(0.5, 0.85, sole), boot); h += bootLace * 0.8;
  // creases: bunched at the elbows and the cuffs, round the waist, behind the knees and at the ankles,
  // where cloth folds when the joints bend; uneven, so they read as cloth
  float fN = sHash(floor(p.xz * 37.0)) * 0.6;
  float fold = 0.0;
  fold += arm * smoothstep(0.42, 0.46, ax) * (1.0 - smoothstep(0.54, 0.58, ax)) * sin(ax * 290.0 + sin(armA * 3.0) * 2.0 + fN);
  fold += arm * smoothstep(0.6, 0.63, ax) * (1.0 - smoothstep(0.67, 0.69, ax)) * sin(ax * 420.0 + sin(armA * 5.0) * 1.5);
  fold += torso * smoothstep(0.96, 0.99, p.y) * (1.0 - smoothstep(1.06, 1.1, p.y)) * sin(p.y * 260.0 + sin(torA * 4.0) * 1.8) * 0.7;
  fold += leg * step(2.0, abs(legA)) * smoothstep(0.44, 0.48, p.y) * (1.0 - smoothstep(0.58, 0.62, p.y)) * sin(p.y * 300.0 + legA * 2.0);
  fold += leg * smoothstep(0.27, 0.29, p.y) * (1.0 - smoothstep(0.34, 0.37, p.y)) * sin(p.y * 380.0 + sin(legA * 3.0) * 2.0) * 0.6;
  h += fold * 0.9 * (1.0 - harness) * (1.0 - boot);
  col *= 1.0 - 0.06 * fold * (1.0 - boot);
  // grime: a little darker toward the hems and where hands go, worn paler at the knees
  col *= 0.94 + 0.06 * sHash(floor(p.xy * 140.0));
  col *= mix(1.0, 1.12, knee * 0.6);
  // the inside of the sleeves and the collar
  if (!gl_FrontFacing) col *= 0.3;
  diffuseColor.rgb = col;
  float suitH = h;
  float suitRough = rough, suitMetal = metal;
`;

// The patches: name tag (top left), Ferris wings (bottom left), Ferris roundel (top right of
// centre), flag (top right), on one canvas.
function patchAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 512);
  const stitch = (x, y, w, h, r, col) => { g.save(); g.strokeStyle = col; g.lineWidth = 3; g.setLineDash([9, 6]); g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke(); g.restore(); };
  // name tag: brown leather, his name in gold, wings, the company's line under it
  const leather = (x, y, w, h) => {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#4a3020'); gr.addColorStop(1, '#3a2518');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill();
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,200' : '0,0,0'},${Math.random() * 0.06})`; g.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2); }
    stitch(x + 12, y + 12, w - 24, h - 24, 14, 'rgba(200,170,120,0.55)');
  };
  leather(8, 8, 496, 240);
  g.fillStyle = '#d8b462';
  g.textAlign = 'center';
  g.font = 'bold 74px "Arial Black", Arial, sans-serif';
  g.fillText('HAL JORDAN', 256, 138);
  g.font = 'bold 30px Arial, sans-serif';
  g.fillText('FERRIS AIRCRAFT · TEST PILOT', 256, 198);
  // wings over the name
  g.strokeStyle = '#d8b462'; g.lineWidth = 5;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(256 + s * 30, 56 + i * 6); g.quadraticCurveTo(256 + s * (90 + i * 25), 36 + i * 9, 256 + s * (150 - i * 18), 50 + i * 10); g.stroke(); }
  g.beginPath(); g.arc(256, 58, 13, 0, 7); g.fillStyle = '#d8b462'; g.fill();
  // Ferris wings: navy, a gold jet climbing through the company's name
  g.fillStyle = '#1c2742'; g.beginPath(); g.roundRect(8, 264, 496, 240, 22); g.fill();
  stitch(20, 276, 472, 216, 14, 'rgba(216,180,98,0.7)');
  g.fillStyle = '#d8b462';
  g.font = 'bold 86px "Arial Black", Arial, sans-serif';
  g.fillText('FERRIS', 256, 410);
  g.beginPath(); g.moveTo(120, 335); g.lineTo(392, 300); g.lineTo(140, 352); g.closePath(); g.fill();
  g.font = 'bold 28px Arial, sans-serif';
  g.fillText('AIRCRAFT · COAST CITY', 256, 462);
  // the roundel: a navy disc, a gold ring with the name round it, a delta jet in the middle
  const cx = 640, cy = 128;
  g.fillStyle = '#d8b462'; g.beginPath(); g.arc(cx, cy, 122, 0, 7); g.fill();
  g.fillStyle = '#1c2742'; g.beginPath(); g.arc(cx, cy, 112, 0, 7); g.fill();
  g.fillStyle = '#8a1e1a'; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill();
  g.fillStyle = '#e9e4d8'; g.beginPath(); g.moveTo(cx, cy - 56); g.lineTo(cx + 40, cy + 40); g.lineTo(cx, cy + 22); g.lineTo(cx - 40, cy + 40); g.closePath(); g.fill();
  g.fillStyle = '#d8b462'; g.font = 'bold 24px Arial, sans-serif';
  const ring = (text, start, dir) => {
    for (let i = 0; i < text.length; i++) {
      const a = start + dir * i * 0.2;
      g.save(); g.translate(cx + Math.cos(a) * 91, cy + Math.sin(a) * 91); g.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); g.fillText(text[i], 0, 8); g.restore();
    }
  };
  ring('FERRIS', -Math.PI / 2 - 0.5, 1);
  ring('AIRCRAFT', Math.PI / 2 + 0.7, -1);
  // the flag
  const fx = 774, fy = 6, fw = 244, fh = 128;
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#e8e4dc' : '#9a2b2b'; g.fillRect(fx, fy + (i * fh) / 13, fw, fh / 13 + 1); }
  g.fillStyle = '#26315a'; g.fillRect(fx, fy, fw * 0.4, fh * 7 / 13);
  g.fillStyle = '#e8e4dc';
  for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { g.beginPath(); g.arc(fx + 9 + k * 16 + (r % 2 ? 8 : 0), fy + 7 + r * 7.4, 2.2, 0, 7); g.fill(); }
  // (the flag's patch is olive-drab subdued round its edge, as a uniform patch is)
  g.strokeStyle = '#4b5034'; g.lineWidth = 8; g.strokeRect(fx + 4, fy + 4, fw - 8, fh - 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------------------- the coverall's shape
// How far the cloth stands off the body (bind space): loose in the sleeves and the legs, close at
// the cuffs, the collar and the boots; the anti-g layer and the harness on top.
function thickness(x, y, z) {
  const ax = Math.abs(x), ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const arm = ss(0.205, 0.235, ax) * (y > 1.22 ? 1 : 0), leg = (1 - arm) * (1 - ss(0.88, 0.95, y));
  let t = 0.011;
  t += arm * (0.006 + 0.008 * ss(0.3, 0.55, ax) - 0.01 * ss(0.62, 0.7, ax));
  t += leg * 0.008;
  const knee = y > 0.465 && y < 0.59;
  if (leg > 0.5 && y > 0.29 && y < 0.9 && !knee) t += 0.007; // the anti-g layer
  if ((1 - arm) * (1 - leg) > 0.5 && y > 0.925 && y < 1.105) t += 0.006;
  if (leg > 0.5 && y < 0.275) t = 0.008 + 0.004 * ss(0.05, 0.2, y); // boots
  if (y > 1.49) t = 0.008; // the collar
  return t;
}

function buildCoverall(base) {
  const geo = base.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const n = pos.count;
  // how much of each vertex the suit covers (as SUIT_COVER in the shader)
  const cover = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let c = 1;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(i, k), w = sw.getComponent(i, k);
      if (b === 4 || b === 7 || b === 10 || (b === 3 && pos.getY(i) >= 1.517)) c -= w;
    }
    cover[i] = c;
  }
  // weld by position (the scan's UV seams duplicate vertices)
  const key = (i) => `${Math.round(pos.getX(i) * 4000)},${Math.round(pos.getY(i) * 4000)},${Math.round(pos.getZ(i) * 4000)}`;
  const canon = new Int32Array(n), ids = new Map(), reps = [];
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let c = ids.get(k);
    if (c === undefined) { c = reps.length; ids.set(k, c); reps.push(i); }
    canon[i] = c;
  }
  const m = reps.length;
  // the coverall's triangles: any that the suit reaches (a little past where the body is hidden, so
  // its edges overlap the skin)
  const idx = geo.index.array, tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (Math.max(cover[a], cover[b], cover[c]) > 0.4) tris.push(a, b, c);
  }
  // neighbours among welded vertices, and which are on the coverall's rim
  const nb = Array.from({ length: m }, () => new Set());
  const edgeCount = new Map();
  for (let t = 0; t < tris.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const u = canon[tris[t + e]], v = canon[tris[t + ((e + 1) % 3)]];
      nb[u].add(v); nb[v].add(u);
      const ek = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeCount.set(ek, (edgeCount.get(ek) ?? 0) + 1);
    }
  }
  const rim = new Uint8Array(m);
  for (const [ek, cnt] of edgeCount) if (cnt === 1) { const [u, v] = ek.split('_').map(Number); rim[u] = rim[v] = 1; }
  const used = new Uint8Array(m);
  for (const i of tris) used[canon[i]] = 1;
  // Taubin smoothing (a shrinking pass and an inflating one, alternately): the hems and creases go,
  // the volume stays
  let P = new Float32Array(m * 3), Q = new Float32Array(m * 3);
  for (let c = 0; c < m; c++) { P[c * 3] = pos.getX(reps[c]); P[c * 3 + 1] = pos.getY(reps[c]); P[c * 3 + 2] = pos.getZ(reps[c]); }
  const orig = P.slice();
  const nbs = nb.map((s) => [...s]);
  for (let it = 0; it < 24; it++) {
    const lam = it % 2 ? -0.53 : 0.5;
    for (let c = 0; c < m; c++) {
      const l = nbs[c];
      if (!used[c] || rim[c] || !l.length) { Q[c * 3] = P[c * 3]; Q[c * 3 + 1] = P[c * 3 + 1]; Q[c * 3 + 2] = P[c * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const j of l) { sx += P[j * 3]; sy += P[j * 3 + 1]; sz += P[j * 3 + 2]; }
      const k = 1 / l.length;
      Q[c * 3] = P[c * 3] + lam * (sx * k - P[c * 3]);
      Q[c * 3 + 1] = P[c * 3 + 1] + lam * (sy * k - P[c * 3 + 1]);
      Q[c * 3 + 2] = P[c * 3 + 2] + lam * (sz * k - P[c * 3 + 2]);
    }
    [P, Q] = [Q, P];
  }
  // normals of the smoothed surface (area-weighted), per welded vertex
  const N = new Float32Array(m * 3), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), cr = new THREE.Vector3();
  for (let t = 0; t < tris.length; t += 3) {
    const a = canon[tris[t]], b = canon[tris[t + 1]], c = canon[tris[t + 2]];
    va.fromArray(P, a * 3); vb.fromArray(P, b * 3); vc.fromArray(P, c * 3);
    cr.crossVectors(vb.sub(va), vc.sub(va));
    for (const v of [a, b, c]) { N[v * 3] += cr.x; N[v * 3 + 1] += cr.y; N[v * 3 + 2] += cr.z; }
  }
  // push it out: its thickness, and always a few millimetres clear of the skin underneath
  const S = new Float32Array(m * 3), nv = new THREE.Vector3(), d = new THREE.Vector3();
  for (let c = 0; c < m; c++) {
    if (!used[c]) continue;
    nv.fromArray(N, c * 3).normalize();
    if (!Number.isFinite(nv.x)) nv.fromArray([nrm.getX(reps[c]), nrm.getY(reps[c]), nrm.getZ(reps[c])]);
    const x = P[c * 3], y = P[c * 3 + 1], z = P[c * 3 + 2];
    d.set(orig[c * 3] - x, orig[c * 3 + 1] - y, orig[c * 3 + 2] - z);
    const t = Math.max(thickness(x, y, z), d.dot(nv) + 0.005);
    S[c * 3] = x + nv.x * t; S[c * 3 + 1] = y + nv.y * t; S[c * 3 + 2] = z + nv.z * t;
    N[c * 3] = nv.x; N[c * 3 + 1] = nv.y; N[c * 3 + 2] = nv.z;
  }
  // the coverall's own vertices (one per scan vertex it uses: they keep their UVs and weights)
  const map = new Int32Array(n).fill(-1), list = [];
  for (const i of tris) if (map[i] < 0) { map[i] = list.length; list.push(i); }
  const k = list.length, op = new Float32Array(k * 3), on = new Float32Array(k * 3), ou = new Float32Array(k * 2), osi = new Uint16Array(k * 4), osw = new Float32Array(k * 4), ob = new Float32Array(k * 3);
  const uv = geo.attributes.uv;
  for (let j = 0; j < k; j++) {
    const i = list[j], c = canon[i];
    op.set([S[c * 3], S[c * 3 + 1], S[c * 3 + 2]], j * 3);
    on.set([N[c * 3], N[c * 3 + 1], N[c * 3 + 2]], j * 3);
    ob.set([P[c * 3], P[c * 3 + 1], P[c * 3 + 2]], j * 3);
    ou.set([uv.getX(i), uv.getY(i)], j * 2);
    for (let q = 0; q < 4; q++) { osi[j * 4 + q] = si.getComponent(i, q); osw[j * 4 + q] = sw.getComponent(i, q); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(op, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(on, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(ou, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(osi, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(osw, 4));
  g.setIndex(tris.map((i) => map[i]));
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------------------- the helmet
// In the head bone's frame at bind (the head bone sits at 1.616, the skull's centre above it).
function buildHelmet() {
  const group = new THREE.Group();
  const [cx, cy, cz] = HELMET.c, [rx, ry, rz] = HELMET.r.map((r) => r * 1.12);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x6e7254, roughness: 0.55, metalness: 0.05 });
  // the dome: an ellipsoid, open over the face (in front below the brow) and under the chin line
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const p = geo.attributes.position;
  const keep = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * rx, y = p.getY(i) * ry, z = p.getZ(i) * rz;
    p.setXYZ(i, x + cx, y + cy, z + cz);
    // (the face opening: an oval round the eyes, nose and mouth)
    const fy = (y + cy - 1.6) / 0.085, fx = x / 0.085;
    const face = z > 0 && fx * fx + Math.max(0, fy) * fy * 0.6 + Math.min(0, fy) * fy * 0.2 < 1;
    keep.push(!(face || y + cy < 1.565 - 0.035 * Math.max(0, -z / rz) || (z > 0.02 && y + cy < 1.63)));
  }
  const ix = geo.index.array, ni = [];
  for (let t = 0; t < ix.length; t += 3) if (keep[ix[t]] && keep[ix[t + 1]] && keep[ix[t + 2]]) ni.push(ix[t], ix[t + 1], ix[t + 2]);
  geo.setIndex(ni);
  geo.computeVertexNormals();
  const dome = new THREE.Mesh(geo, shellMat);
  shellMat.side = THREE.DoubleSide;
  group.add(dome);
  // ear cups, a visor housing across the brow, the visor
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1e1a, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), shellMat);
    cup.scale.set(0.45, 1, 1.05);
    cup.position.set(cx + s * rx * 0.97, cy - 0.065, cz - 0.01);
    group.add(cup);
  }
  const housing = new THREE.Mesh(new THREE.TorusGeometry(rz * 0.98, 0.012, 8, 40, Math.PI * 0.62), dark);
  housing.rotation.set(Math.PI / 2 + 0.38, 0, Math.PI * 0.19);
  housing.position.set(cx, cy + 0.005, cz);
  housing.scale.set(rx / rz, 1, 1);
  group.add(housing);
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x9a7a2c, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.82, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  const vg = new THREE.SphereGeometry(1, 40, 20, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.24);
  const visor = new THREE.Mesh(vg, visorMat);
  visor.scale.set(rx * 1.05, ry * 1.08, rz * 1.06);
  visor.position.set(cx, cy - 0.01, cz);
  visor.rotation.y = -Math.PI / 2;
  group.add(visor);
  group.userData.visor = visor;
  group.userData.visorUp = visor.rotation.x;
  for (const o of group.children) { o.castShadow = true; o.receiveShadow = true; }
  return group;
}

export function createPilot(casual) {
  const rig = createHal(casual, { roughMin: 0.62, jaw: JAW.casual });
  const base = rig.meshes[0];
  const su = { uSuitOn: { value: 1 }, uHelmetOn: { value: 0 }, uPatches: { value: patchAtlas() } };
  rig.su = su;
  coverBase(base.material, su);
  const geo = buildCoverall(base);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, normalMap: base.material.normalMap, aoMap: base.material.aoMap, aoMapIntensity: 0.7 });
  mat.normalScale = new THREE.Vector2(0.55, 0.55);
  patchMaterial(mat, { u: rig.u });
  const pbase = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    pbase(sh, r);
    Object.assign(sh.uniforms, su);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${SUIT_COMMON}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${SUIT_COLOR}`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n        metalnessFactor = suitMetal;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor = suitRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = perturbSuit(-vViewPosition, normal, vec2(dFdx(suitH), dFdy(suitH)) * 0.0012, faceDirection);`);
  };
  mat.customProgramCacheKey = () => 'gl-flightsuit';
  const shell = new THREE.SkinnedMesh(geo, mat);
  shell.name = 'flightsuit';
  shell.bind(base.skeleton, base.bindMatrix);
  shell.frustumCulled = false;
  shell.castShadow = shell.receiveShadow = true;
  base.parent.add(shell);
  shell.position.copy(base.position); shell.quaternion.copy(base.quaternion); shell.scale.copy(base.scale);
  rig.meshes.push(shell);
  // the helmet, on the head bone (in its frame at bind)
  const helmet = buildHelmet(), head = rig.bones.head;
  rig.root.updateMatrixWorld(true);
  const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(base.matrixWorld);
  helmet.applyMatrix4(toHead);
  head.add(helmet);
  helmet.visible = false;
  rig.helmet = helmet;
  rig.wearHelmet = (on) => { helmet.visible = on; su.uHelmetOn.value = on ? 1 : 0; };
  rig.helmetVisor = (k) => { const v = helmet.userData.visor; v.rotation.x = helmet.userData.visorUp - (1 - k) * 0.55; };
  return rig;
}
