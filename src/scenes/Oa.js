import * as THREE from 'three';
import { Physics, RAPIER } from '../engine/Physics.js';
import { NOISE_GLSL } from '../fx/Sky.js';
import { glowTexture } from '../fx/Textures.js';
import { Particles } from '../fx/Particles.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHall } from './Hall.js';

// Oa: Kilowog's training ground, a disc of dark stone with the Corps' hex lines inlaid in light,
// floating high above the city. The Central Power Battery, a lantern hundreds of metres tall,
// stands on the horizon; a ringed giant hangs in the sky; Lanterns streak overhead.
export const RANGE_RADIUS = 42;
export const KILOWOG_SPOT = new THREE.Vector3(0, 1.2, -RANGE_RADIUS + 6.5);
export const HAL_START = new THREE.Vector3(0, 0, -27.5);
export const BATTERY = new THREE.Vector3(-90, 15, -560); // the centre of the Central Battery's globe
export const PADS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  return new THREE.Vector3(Math.sin(a) * 27, 0, Math.cos(a) * 27);
});

// A convex prism collider, laid out like THREE.CylinderGeometry (vertex i at angle i/sides·2π + rot).
// Rapier's rounded cylinders let the character controller sink into their flat tops (Hal stood
// 0.33 m deep in the deck with his knees bent), so everything walked on or against is a hull.
function hullPrism(sides, top, bottom, h, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    pts.push(s * top, h / 2, c * top, s * bottom, -h / 2, c * bottom);
  }
  return RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
}

// The deck's lit markings as distance fields, drawn anti-aliased (see buildPlatform), laid out over
// the canvas's seams and grooves: hex flagstones 3.2 m to the corner with flat sides to north and
// south, the rings, the spokes between the inner two, the Corps emblem and the six spawn pads.
// Colours are the canvas's, in linear light.
const deckGlow = (R) => /* glsl */ `
  varying vec2 vDeck;
  uniform vec2 uPads[6];
  // a line d from its centre and w wide, its edge smoothed over a pixel; thinner than a pixel, it's
  // drawn a pixel wide and dimmed to match, so it can't break up into crawling dashes
  float deckLine(float d, float w) {
    float px = max(fwidth(d), 1e-4), dw = max(w, px);
    return clamp((dw * 0.5 - d) / px + 0.5, 0.0, 1.0) * (w / dw);
  }
  float deckHash(vec2 c) { c = floor(c * 4.0 + 0.5); return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 deckGlow(vec2 p) {
    const vec3 HEX = vec3(0.061, 1.0, 0.262), LINE = vec3(0.102, 1.0, 0.305), EMBLEM = vec3(0.155, 1.0, 0.402), PAD = vec3(1.0, 0.188, 0.08);
    // the flagstones: the nearer centre of two offset rectangular lattices. About half the stones
    // have a lit outline; a side is lit if either stone beside it is
    const vec2 L = vec2(9.6, 5.5425626), N = vec2(0.8660254, 0.5);
    vec2 a = mod(p, L) - L * 0.5, b = mod(p - L * 0.5, L) - L * 0.5;
    vec2 q = dot(a, a) < dot(b, b) ? a : b, aq = abs(q);
    float slant = dot(aq, N), e = 2.7712813 - max(aq.y, slant);
    vec2 n = aq.y > slant ? vec2(0.0, sign(q.y)) : N * sign(q), c = p - q;
    float lit = max(step(deckHash(c), 0.45), step(deckHash(c + n * 5.5425626), 0.45));
    float hex = deckLine(e, 0.09) * lit;
    hex = mix(hex, 0.023, smoothstep(0.7, 1.6, fwidth(e))); // far off, the sides crowd into a glow
    vec3 col = mix(vec3(0.0), HEX * 0.85, hex);
    // the spokes between the inner rings, then the rings
    float r = length(p), th = atan(p.y, p.x);
    const float ST = 0.2617994;
    float sp = deckLine(abs(r * sin(th - ST * floor(th / ST + 0.5))), 0.08) * clamp(min(r - 14.5, 26.5 - r) / max(fwidth(r), 1e-4) + 0.5, 0.0, 1.0);
    col = mix(col, LINE * 0.5, r > 10.0 ? sp : 0.0); // (atan is undefined at the centre)
    col = mix(col, LINE * 0.7, deckLine(abs(r - 14.0), 0.12));
    col = mix(col, LINE * 0.55, deckLine(abs(r - 27.0), 0.09));
    col = mix(col, LINE * 0.7, deckLine(abs(r - ${(R - 2.2).toFixed(2)}), 0.1));
    col = mix(col, LINE, deckLine(abs(r - ${(R - 0.6).toFixed(2)}), 0.3));
    // the emblem: its ring and two bars
    vec2 bq = abs(vec2(p.x, abs(p.y) - 3.9)) - vec2(8.6, 0.55);
    float bd = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0);
    col = mix(col, EMBLEM * 0.85, max(deckLine(abs(r - 4.6), 1.0), clamp(0.5 - bd / max(fwidth(bd), 1e-4), 0.0, 1.0)));
    for (int i = 0; i < 6; i++) {
      float d = length(p - uPads[i]);
      col = mix(col, PAD * 0.9, max(deckLine(abs(d - 1.6), 0.18), deckLine(abs(d - 0.8), 0.18)));
    }
    return col;
  }
`;

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export class Oa {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.bounds = new Set();
    this.blocks = []; // { x, z, r, h } cover
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x0a121a, 0.0015);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.3;
    s.userData.exposure = 1.15;
    this.time = { value: 0 };
    this.buildSky();
    this.buildPlatform();
    this.buildCover();
    this.buildPodium();
    this.buildCity();
    this.buildBattery();
    this.buildTraffic();
    this.buildProps();
    this.hall = buildHall(this);

    this.hemi = new THREE.HemisphereLight(0x7088a0, 0x12161a, 0.6);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xe8f2ff, 1.9);
    sun.position.set(60, 90, 40);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 220 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    // the battery's light washing across the range from the north
    const rim = new THREE.DirectionalLight(0x44ff88, 0.25);
    rim.position.copy(BATTERY).setY(120).normalize().multiplyScalar(100);
    s.add(rim);
    return this;
  }

  // ------------------------------------------------------------------------------------- sky
  // Deep indigo overhead, a teal-green glow on the horizon toward the battery, nebula, stars and a
  // ringed gas giant drawn analytically (it's far beyond the camera's far plane).
  buildSky() {
    const uniforms = {
      uTime: this.time,
      uPlanet: { value: new THREE.Vector3(0.55, 0.32, 0.77).normalize() },
      uSun: { value: new THREE.Vector3(0.5, 0.75, 0.35).normalize() },
      uBattery: { value: BATTERY.clone().normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uPlanet, uSun, uBattery;
        varying vec3 vDir;
        ${NOISE_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(vec3(0.03, 0.075, 0.11), vec3(0.01, 0.018, 0.05), smoothstep(-0.05, 0.6, h));
          col = mix(col, vec3(0.01, 0.025, 0.03), smoothstep(0.0, -0.4, h));
          // the battery's glow on the horizon
          float b = max(dot(normalize(d.xz), normalize(uBattery.xz)), 0.0);
          col += vec3(0.05, 0.4, 0.18) * pow(b, 8.0) * exp(-abs(h - 0.05) * 7.0) * 0.9;
          // nebula
          vec2 nuv = d.xz / (abs(h) + 0.35) * 1.4;
          float n = fbm(nuv + vec2(3.0, uTime * 0.002)), m = fbm(nuv * 2.3 - 5.0);
          col += vec3(0.04, 0.12, 0.13) * smoothstep(0.45, 0.85, n) * smoothstep(-0.05, 0.3, h);
          col += vec3(0.09, 0.03, 0.12) * smoothstep(0.55, 0.9, m) * smoothstep(0.1, 0.5, h) * 0.8;
          // stars
          if (h > -0.05) {
            vec2 sp = d.xz / (h + 0.3) * 300.0;
            float s = hash12(floor(sp));
            float tw = 0.65 + 0.35 * sin(uTime * 2.0 + s * 70.0);
            col += vec3(0.8, 0.92, 1.0) * step(0.994, s) * tw * smoothstep(0.42, 0.08, length(fract(sp) - 0.5)) * smoothstep(-0.05, 0.2, h);
          }
          // the ringed giant: a lit sphere with bands, and its rings as a tilted ellipse
          float R = 0.17;
          vec3 pc = uPlanet;
          vec3 axis = normalize(vec3(0.25, 1.0, -0.2));
          vec3 ex = normalize(cross(axis, pc)), ey = cross(pc, ex);
          vec2 q = vec2(dot(d, ex), dot(d, ey)) / R;
          float front = dot(d, pc);
          float rr = dot(q, q);
          // rings: plane through the planet centre, normal = axis
          float t = dot(pc - d * front, axis);
          vec2 rq = vec2(dot(d, ex), dot(d, normalize(cross(axis, ex)))) / R;
          float ring = 0.0;
          float rrad = length(vec2(rq.x, rq.y / max(0.18, abs(dot(axis, pc)) + 0.18)));
          ring = smoothstep(1.35, 1.45, rrad) * smoothstep(2.35, 2.2, rrad) * (0.6 + 0.4 * sin(rrad * 40.0)) * step(0.0, front);
          bool behind = rq.y > 0.0;
          if (ring > 0.0 && behind) col = mix(col, vec3(0.55, 0.62, 0.6), ring * 0.55);
          if (rr < 1.0 && front > 0.0) {
            vec3 nrm = normalize(ex * q.x + ey * q.y + pc * -sqrt(1.0 - rr));
            float lit = clamp(dot(-nrm, uSun) * 1.2 + 0.08, 0.0, 1.0);
            float band = sin(dot(-nrm, axis) * 22.0 + vnoise(q * 6.0) * 2.0);
            vec3 pcol = mix(vec3(0.22, 0.38, 0.42), vec3(0.55, 0.6, 0.48), 0.5 + 0.5 * band);
            col = mix(col, pcol * lit + vec3(0.01, 0.03, 0.035), smoothstep(1.0, 0.97, rr));
            col += vec3(0.1, 0.25, 0.3) * pow(rr, 6.0) * lit; // atmosphere at the limb
          }
          if (ring > 0.0 && !behind) col = mix(col, vec3(0.6, 0.68, 0.64), ring * 0.6);
          col += vec3(0.04, 0.09, 0.1) * exp(-max(rr - 1.0, 0.0) * 3.0) * step(0.0, front) * 0.4; // haze
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(860, 48, 24), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  // ------------------------------------------------------------------------------------- range
  buildPlatform() {
    const R = RANGE_RADIUS;
    // the deck's markings: hex lines, concentric rings, the emblem at the centre, spawn pads
    const size = 2048, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d'), k = size / (R * 2), cx = size / 2;
    const e = document.createElement('canvas');
    e.width = e.height = size;
    const ge = e.getContext('2d');
    g.fillStyle = '#1b2125';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 18;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + rnd() * 0.03})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // flagstones: large hex tiles with dark seams, faintly lit
    const hex = 3.2 * k;
    ge.strokeStyle = 'rgba(70,255,140,0.16)';
    ge.lineWidth = 1.5;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 3;
    for (let row = -20; row <= 20; row++) for (let col = -20; col <= 20; col++) {
      const x = cx + col * hex * 1.5, y = cx + row * hex * Math.sqrt(3) + (col % 2 ? hex * Math.sqrt(3) / 2 : 0);
      const path = new Path2D();
      for (let j = 0; j <= 6; j++) { const a = (j / 6) * Math.PI * 2; const px = x + Math.cos(a) * hex, py = y + Math.sin(a) * hex; j ? path.lineTo(px, py) : path.moveTo(px, py); }
      g.fillStyle = `rgba(${18 + rnd() * 14},${24 + rnd() * 14},${28 + rnd() * 14},0.55)`;
      g.fill(path);
      g.stroke(path);
      if (rnd() < 0.45) ge.stroke(path);
    }
    // rings and the outer band
    const ring = (r, w, a) => { ge.strokeStyle = `rgba(90,255,150,${a})`; ge.lineWidth = w * k; ge.beginPath(); ge.arc(cx, cx, r * k, 0, Math.PI * 2); ge.stroke(); };
    ring(R - 0.6, 0.3, 0.8); ring(R - 2.2, 0.08, 0.35); ring(27, 0.07, 0.22); ring(14, 0.1, 0.3);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ge.strokeStyle = 'rgba(90,255,150,0.2)'; ge.lineWidth = 0.07 * k;
      ge.beginPath(); ge.moveTo(cx + Math.cos(a) * 14.5 * k, cx + Math.sin(a) * 14.5 * k); ge.lineTo(cx + Math.cos(a) * 26.5 * k, cx + Math.sin(a) * 26.5 * k); ge.stroke();
    }
    // the Corps emblem
    ge.strokeStyle = 'rgba(110,255,170,0.7)'; ge.lineWidth = 1.0 * k;
    ge.beginPath(); ge.arc(cx, cx, 4.6 * k, 0, Math.PI * 2); ge.stroke();
    ge.fillStyle = 'rgba(110,255,170,0.7)';
    for (const sy of [-1, 1]) ge.fillRect(cx - 8.6 * k, cx + sy * 3.9 * k - 0.55 * k, 17.2 * k, 1.1 * k);
    // spawn pads
    for (const p of PADS) {
      const x = cx + p.x * k, y = cx + p.z * k;
      ge.strokeStyle = 'rgba(255,120,80,0.6)'; ge.lineWidth = 0.18 * k;
      ge.beginPath(); ge.arc(x, y, 1.6 * k, 0, Math.PI * 2); ge.stroke();
      ge.beginPath(); ge.arc(x, y, 0.8 * k, 0, Math.PI * 2); ge.stroke();
    }
    g.globalAlpha = 0.5;
    g.drawImage(e, 0, 0); // the lit lines also read as cut grooves
    g.globalAlpha = 1;
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    // The lit lines themselves are drawn in the shader (deckGlow), not taken from the canvas: lines a
    // texel or two wide stair-stepped and crawled as the camera moved (the floor "flickered"), and a
    // canvas with a transparent background uploads un-premultiplied, so every texel a line touched
    // glowed at full strength. Analytic lines anti-aliased over a pixel hold still at any distance.
    const deckMat = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.55, metalness: 0.25 });
    deckMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPads = { value: PADS.map((p) => new THREE.Vector2(p.x, p.z)) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDeck;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeck = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${deckGlow(R)}`)
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= deckGlow(vDeck);');
    };
    this.deckMat = deckMat;
    const deck = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), deckMat);
    deck.receiveShadow = true;
    // circle UVs run 0..1 across the disc, matching the canvas
    this.scene.add(deck);

    // underside: stepped tiers tapering to a point far below, banded with light
    const prof = [[R, 0], [R + 0.4, -0.3], [R + 0.4, -1.4], [R - 1, -2.2], [R - 2.5, -6], [R - 6, -7], [R - 9, -14], [R - 13, -15], [R - 18, -28], [R - 24, -30], [R - 30, -48], [6, -62], [2, -80], [0, -86]];
    const under = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96), new THREE.MeshStandardMaterial({ color: 0x161c20, roughness: 0.5, metalness: 0.6 }));
    this.scene.add(under);
    for (const [r, y, w] of [[R - 1.6, -1.8, 0.12], [R - 6.5, -7.2, 0.25], [R - 13.5, -15.2, 0.35], [R - 24.5, -30.2, 0.45], [6.5, -62, 0.4]]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 0.9) }));
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      this.scene.add(band);
    }
    // a low lip around the edge with a lit cap, and pylons
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.32, 10, 160), new THREE.MeshStandardMaterial({ color: 0x20282c, roughness: 0.4, metalness: 0.7 }));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.18;
    lip.receiveShadow = lip.castShadow = true;
    this.scene.add(lip);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.05, 6, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 1.1) }));
    cap.rotation.x = Math.PI / 2;
    cap.position.y = 0.5;
    this.scene.add(cap);
    const pylonGeo = new THREE.CylinderGeometry(0.25, 0.7, 9, 6).translate(0, 4.5, 0);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.35, metalness: 0.75 });
    const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.85, 0.38) });
    const seamGeo = new THREE.BoxGeometry(0.06, 7.6, 0.06).translate(0, 4.6, 0);
    const tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3, 1.3) });
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.4)');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.sin(a) * (R - 0.8), z = Math.cos(a) * (R - 0.8);
      if (Math.abs(x) < 4 && z < 0) continue; // leave the podium side open
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(x, 0, z);
      p.rotation.y = a;
      p.castShadow = true;
      this.scene.add(p);
      const seam = new THREE.Mesh(seamGeo, seamMat);
      seam.position.set(x - Math.sin(a) * 0.66, 0, z - Math.cos(a) * 0.66); // on the face toward the range
      seam.rotation.set(Math.atan2(0.42, 9), a, 0, 'YXZ'); // leans in with the taper
      this.scene.add(seam);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), tipMat);
      tip.position.set(x, 9.4, z);
      this.scene.add(tip);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.3, 1, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
      halo.scale.setScalar(3);
      halo.position.copy(tip.position);
      this.scene.add(halo);
      this.physics.fixedCollider(hullPrism(8, 0.5, 0.5, 9), { x, y: 4.5, z });
    }
    // physics: the deck, and an edge wall Hal can't walk through (flight ignores it)
    this.physics.fixedCollider(hullPrism(64, R + 0.6, R + 0.6, 2).setFriction(0.9), { x: 0, y: -1, z: 0 });
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, len = (2 * Math.PI * (R + 0.4)) / 48;
      const b = this.physics.fixedCollider(RAPIER.ColliderDesc.cuboid(len / 2 + 0.1, 1.5, 0.2), { x: Math.sin(a) * (R + 0.4), y: 1.5, z: Math.cos(a) * (R + 0.4) }, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a));
      this.bounds.add(b.collider(0).handle);
    }
  }

  // Hexagonal pillars to fight around, each with a lit seam at the top.
  buildCover() {
    const spots = [[-12, 4, 1.4, 1.6], [13, -2, 1.2, 2.4], [-6, 16, 1.6, 1.3], [8, 15, 1.0, 3.0], [-19, -8, 1.2, 2.2], [20, 10, 1.5, 1.5], [-24, 12, 1.1, 2.8], [2, 26, 1.3, 1.8], [-3, -2, 0.9, 1.1], [24, -14, 1.2, 2.0]];
    const mat = new THREE.MeshStandardMaterial({ color: 0x232b30, roughness: 0.55, metalness: 0.45 });
    const seam = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2, 0.85) });
    for (const [x, z, r, h] of spots) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 6).translate(0, h / 2, 0), mat);
      m.position.set(x, 0, z);
      m.rotation.y = rnd();
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      const top = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, 0.03, 4, 6), seam);
      top.rotation.set(Math.PI / 2, 0, m.rotation.y + Math.PI / 6);
      top.position.set(x, h - 0.12, z);
      this.scene.add(top);
      this.physics.fixedCollider(hullPrism(6, r, r * 1.08, h, m.rotation.y), { x, y: h / 2, z });
      this.blocks.push({ x, z, r, h });
    }
  }

  // Kilowog's post: a raised step at the north edge.
  buildPodium() {
    const p = KILOWOG_SPOT;
    const mat = new THREE.MeshStandardMaterial({ color: 0x252d32, roughness: 0.45, metalness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 1.2, 6).translate(0, 0.6, 0), mat);
    base.position.set(p.x, 0, p.z);
    base.castShadow = base.receiveShadow = true;
    this.scene.add(base);
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.05, 4, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2, 0.85) }));
    ringMesh.rotation.set(Math.PI / 2, 0, Math.PI / 6);
    ringMesh.position.set(p.x, 1.18, p.z);
    this.scene.add(ringMesh);
    this.physics.fixedCollider(hullPrism(6, 3.6, 4.2, 1.2), { x: p.x, y: 0.6, z: p.z });
  }

  // ------------------------------------------------------------------------------------- city
  // Oa's city far below and around the range, instanced from a small kit: setback towers,
  // flared towers with a disc platform near the top, stout crystals and domed halls. Most of it
  // sits below the range (you look down on it); a few tall ones and the citadel frame the horizon.
  buildCity() {
    const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
    const merge = (parts) => mergeGeometries(parts.map(strip));
    const prism = (r0, r1, y0, y1, seg = 8) => new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1).translate(0, (y0 + y1) / 2, 0);
    const kit = {
      setback: merge([prism(1, 0.95, 0, 0.55), prism(0.74, 0.7, 0.55, 0.8), prism(0.5, 0.46, 0.8, 0.94), prism(0.06, 0.02, 0.94, 1.06, 4)]),
      flared: merge([prism(0.5, 0.42, 0, 0.8), prism(1.5, 1.45, 0.8, 0.83, 24), prism(1.3, 0.5, 0.77, 0.8, 24), prism(0.32, 0.28, 0.83, 0.97), new THREE.SphereGeometry(0.3, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.07, 1).translate(0, 0.97, 0), prism(0.03, 0.01, 0.98, 1.06, 4)]),
      crystal: merge([prism(1, 0.86, 0, 0.86, 6), prism(0.86, 0.6, 0.86, 0.93, 6), prism(0.6, 0.12, 0.93, 1.0, 6)]),
      dome: merge([prism(1, 1, 0, 0.3, 24), new THREE.SphereGeometry(0.92, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.3, 0), prism(0.08, 0.04, 0.9, 1.2, 6)]),
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 0.5, metalness: 0.3 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vSeed; varying float vUp;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          #ifdef USE_INSTANCING
            vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vSeed = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
            vUp = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal).y;
          #else
            vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSeed = modelMatrix[3].x * 0.13;
            vUp = normalize(mat3(modelMatrix) * objectNormal).y;
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vSeed; varying float vUp;\nfloat wHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float floorY = floor(vWP.y / 5.5);
          float colI = floor((vWP.x + vWP.z) / 3.2);
          float lit = step(0.74, wHash(vec2(floorY, colI + vSeed * 31.0)));
          float wall = step(abs(vUp), 0.5);
          float win = step(0.45, fract(vWP.y / 5.5)) * step(fract((vWP.x + vWP.z) / 3.2), 0.45) * wall;
          float bandY = step(0.94, fract(vWP.y / 36.0 + vSeed)) * wall;
          vec3 wc = mix(vec3(0.45, 1.0, 0.7), vec3(1.0, 0.92, 0.75), step(0.55, wHash(vec2(colI, floorY))));
          totalEmissiveRadiance += wc * win * lit * 0.8 + vec3(0.2, 1.6, 0.75) * bandY * 1.3;`);
    };
    const place = (geo, n, fn) => {
      const inst = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
      let k = 0;
      for (let i = 0; i < n * 8 && k < n; i++) {
        const spot = fn(i);
        if (!spot) continue;
        pos.set(spot.x, -230, spot.z);
        sc.set(spot.w, spot.h, spot.w);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 3);
        m.compose(pos, q, sc);
        inst.setMatrixAt(k++, m);
      }
      inst.count = k;
      this.scene.add(inst);
    };
    // a ring around the range, clear of the citadel and the battery's line of sight
    const ringSpot = (min, max) => {
      const a = rnd() * Math.PI * 2, d = min + Math.pow(rnd(), 0.8) * (max - min);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (Math.hypot(x - BATTERY.x, z - BATTERY.z) < 150) return null;
      const toB = Math.atan2(BATTERY.x, BATTERY.z), da = Math.abs(Math.atan2(Math.sin(a - toB), Math.cos(a - toB)));
      return { x, z, d, inView: da < 0.25 && d < 520 };
    };
    place(kit.setback, 110, () => { const p = ringSpot(170, 760); if (!p) return null; const tall = rnd() < 0.15 && !p.inView; const h = tall ? 240 + rnd() * 70 : 90 + rnd() * 120; return { ...p, w: h * (0.16 + rnd() * 0.08), h }; });
    place(kit.flared, 70, () => { const p = ringSpot(190, 760); if (!p) return null; const h = p.inView ? 110 + rnd() * 60 : 150 + rnd() * 120; return { ...p, w: h * (0.12 + rnd() * 0.05), h }; });
    place(kit.crystal, 70, () => { const p = ringSpot(160, 700); if (!p) return null; return { ...p, w: 12 + rnd() * 16, h: 70 + rnd() * 110 }; });
    place(kit.dome, 60, () => { const p = ringSpot(150, 700); if (!p) return null; const w = 28 + rnd() * 34; return { ...p, w, h: w * (0.85 + rnd() * 0.2) }; });
    // the citadel: a crown of great flared towers around the battery's base, open toward the range
    // so none stands in front of the lens
    const toRange = Math.atan2(-BATTERY.x, -BATTERY.z), gap = 0.62;
    place(kit.flared, 9, (i) => {
      const a = toRange + gap + (i / 8) * (Math.PI * 2 - 2 * gap), r = 120 + (i % 2) * 30;
      return { x: BATTERY.x + Math.sin(a) * r, z: BATTERY.z + Math.cos(a) * r, w: 20 + (i % 2) * 8, h: 300 + (i % 3) * 60 };
    });
    // a glow of city light far below
    const haze = new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.09, 0.07) }));
    haze.position.y = -230;
    this.scene.add(haze);
  }

  // The Central Power Battery as the comics draw it (Green Lantern Corps, Rebirth on): the Corps'
  // lantern on a colossal scale, its silhouette the emblem. A heavy green metal globe with a great
  // round lens of light in a layered bezel (front and back), a frame ring and C-shaped brackets at its
  // sides; above, a neck, the wide cap (the emblem's top bar) and the handle ring; below, a conical
  // collar on a wide slab (the bottom bar) and stepped octagonal tiers down to the city floor.
  // Built in metres about the globe's centre, with the lens turned to face the range.
  buildBattery() {
    const RG = 75, RL = 54; // globe and lens radius
    const battery = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: 0x1f5c36, roughness: 0.32, metalness: 0.65, emissive: 0x0a3a1c, emissiveIntensity: 0.5, fog: false });
    const trim = new THREE.MeshStandardMaterial({ color: 0x173a25, roughness: 0.4, metalness: 0.75, emissive: 0x06200f, emissiveIntensity: 0.45, fog: false });
    const seam = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 0.75), fog: false });
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); battery.add(m); return m; };
    const lathe = (pts, mat) => add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 72), mat);
    const oct = (top, bottom, y0, y1, mat, open = false) => add(new THREE.CylinderGeometry(top, bottom, y1 - y0, 8, 1, open).rotateY(Math.PI / 8), mat, 0, (y0 + y1) / 2);

    // the globe: a shell open front and back, a gently domed lens of light set in each opening
    const capAngle = Math.asin(RL / RG), zRim = Math.sqrt(RG * RG - RL * RL), RS = 110, dome = Math.asin(RL / RS);
    add(new THREE.SphereGeometry(RG, 72, 48, 0, Math.PI * 2, capAngle, Math.PI - 2 * capAngle).rotateX(Math.PI / 2), shell);
    const lensMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time, uR: { value: RL } },
      vertexShader: 'varying vec3 vP, vN, vV; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime, uR; varying vec3 vP, vN, vV;
        void main() {
          float r = clamp(length(vP.xy) / uR, 0.0, 1.0), a = atan(vP.y, vP.x);
          float core = pow(1.0 - r, 2.2);
          // light turning slowly inside the glass
          float swirl = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - uTime * 0.6) * sin(a * 2.0 - r * 6.0 + uTime * 0.4);
          float f = abs(dot(normalize(vN), normalize(vV)));
          vec3 col = vec3(0.06, 0.72, 0.27) * (0.55 + 0.35 * swirl * (1.0 - core)) + vec3(0.6, 1.3, 0.75) * core * 0.95;
          col *= (0.85 + 0.15 * f) * mix(1.0, 0.55, smoothstep(0.84, 1.0, r));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    for (const side of [1, -1]) {
      add(new THREE.SphereGeometry(RS, 72, 16, 0, Math.PI * 2, 0, dome).rotateX(side * Math.PI / 2), lensMat, 0, 0, side * (zRim - RS * Math.cos(dome)));
      // the bezel: a heavy rim round the glass, a lit line and a stepped ring outside it
      add(new THREE.TorusGeometry(RL + 1.6, 4.6, 16, 112), trim, 0, 0, side * zRim);
      add(new THREE.TorusGeometry(58.5, 0.8, 6, 112), seam, 0, 0, side * (Math.sqrt(RG * RG - 58.5 * 58.5) + 0.4));
      add(new THREE.TorusGeometry(62, 2.2, 10, 112), trim, 0, 0, side * (Math.sqrt(RG * RG - 62 * 62) + 0.8));
    }
    // the frame ring round the globe's sides (where the emblem's circle is), and the side brackets
    add(new THREE.TorusGeometry(RG + 1, 3.2, 12, 128), trim);
    for (const side of [1, -1]) {
      const from = -0.87, to = 1.08, R = RG + 12; // radians round the side, measured from the horizontal
      const arc = add(new THREE.TorusGeometry(R, 3.6, 12, 64, to - from), shell);
      arc.rotation.z = side > 0 ? from : Math.PI - to;
      for (const t of [from, 0.1, to]) {
        const spoke = add(new THREE.BoxGeometry(12, 4.5, 5), trim, side * Math.cos(t) * (RG + 6), Math.sin(t) * (RG + 6), 0);
        spoke.rotation.z = side > 0 ? t : Math.PI - t;
      }
      // the bracket's foot comes down to the slab
      const fx = Math.cos(from) * R, fy = Math.sin(from) * R, leg = new THREE.Vector3(66 - fx, -88 - fy, 0);
      const foot = add(new THREE.CylinderGeometry(3, 3.6, leg.length(), 10), shell, side * (fx + leg.x / 2), fy + leg.y / 2, 0);
      foot.rotation.z = side * Math.atan2(leg.x, -leg.y);
    }
    // above: the neck, the cap (the emblem's top bar) and the handle ring
    lathe([[0, 58], [40, 58], [38, 72], [35, 96], [0, 96]], trim);
    add(new THREE.TorusGeometry(36.4, 2.4, 10, 72).rotateX(Math.PI / 2), shell, 0, 88);
    lathe([[0, 95], [36, 95], [46, 99], [82, 105], [86, 109], [86, 123], [82, 127], [60, 132], [44, 138], [28, 141], [0, 141]], shell);
    add(new THREE.TorusGeometry(86.3, 0.9, 6, 128).rotateX(Math.PI / 2), seam, 0, 116);
    add(new THREE.TorusGeometry(83, 1.8, 8, 128).rotateX(Math.PI / 2), trim, 0, 106);
    add(new THREE.CylinderGeometry(9, 14, 10, 24), trim, 0, 145);
    add(new THREE.TorusGeometry(30, 5, 16, 72), shell, 0, 178);
    add(new THREE.TorusGeometry(30, 1.1, 8, 72), seam, 0, 178, 4.6);
    add(new THREE.TorusGeometry(30, 1.1, 8, 72), seam, 0, 178, -4.6);
    // below: the collar, the slab (the bottom bar) and the stepped base
    lathe([[0, -88], [62, -88], [58, -80], [50, -71], [44, -62], [38, -56]], shell);
    add(new THREE.TorusGeometry(51, 1.8, 8, 72).rotateX(Math.PI / 2), trim, 0, -72);
    oct(88, 94, -100, -88, shell);
    oct(91.3, 91.3, -94.7, -93.3, seam, true);
    oct(72, 74, -118, -100, trim);
    oct(84, 90, -150, -118, shell);
    oct(94, 98, -190, -150, trim);
    oct(100, 100, -240, -190, shell);
    for (const [r, y] of [[84.3, -119], [94.3, -151], [100.3, -191]]) oct(r, r, y - 0.5, y + 0.5, seam, true);
    // lit strips down the corners of the upper tiers
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      for (const [r, y0, y1] of [[87.5, -148, -121], [96.5, -188, -153]]) add(new THREE.BoxGeometry(1.4, y1 - y0, 1.4), seam, Math.sin(a) * r, (y0 + y1) / 2, Math.cos(a) * r);
    }

    battery.position.copy(BATTERY);
    battery.rotation.y = Math.atan2(-BATTERY.x, -BATTERY.z); // the lens faces the range
    this.scene.add(battery);
    // its light on the citadel round it, and the glow off the lens
    const lamp = new THREE.PointLight(0x44ff88, 1.6, 420, 0);
    lamp.position.set(0, 0, RG + 40);
    battery.add(lamp);
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.35)');
    for (const [sc, op] of [[230, 0.2], [520, 0.08]]) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.3, 1, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false }));
      halo.scale.setScalar(sc);
      halo.position.set(0, 0, RG + 6);
      battery.add(halo);
    }
  }

  // Lanterns crossing the sky: green points with trails on long, lazy arcs.
  buildTraffic() {
    this.traffic = new Particles(1400, { additive: true, drag: 0 });
    this.scene.add(this.traffic.points);
    this.flyers = Array.from({ length: 16 }, () => ({
      c: new THREE.Vector3((rnd() - 0.5) * 500, 40 + rnd() * 160, -200 - rnd() * 400),
      r: 120 + rnd() * 260, a: rnd() * 6.3, w: (0.05 + rnd() * 0.08) * (rnd() < 0.5 ? 1 : -1), tilt: (rnd() - 0.5) * 0.4,
    }));
  }

  // Metal training crates to knock around.
  buildProps() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a4246, roughness: 0.4, metalness: 0.8 });
    const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.6, 0.7) });
    for (const [x, z, s] of [[6, -6, 0.9], [7.2, -5.6, 0.6], [-8, -10, 1.1], [-9, -8.6, 0.7], [15, 6, 0.8], [-15, 20, 1], [10, 22, 0.7], [-20, 2, 0.9]]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
      box.position.set(x, s / 2 + 0.01, z);
      box.rotation.y = rnd() * 2;
      box.castShadow = box.receiveShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(s * 1.01, s * 0.06, s * 1.01), edge);
      box.add(strip);
      this.scene.add(box);
      this.physics.dynamicBox(box, { x: s / 2, y: s / 2, z: s / 2 }, { density: 350, friction: 0.7, restitution: 0.15 });
    }
  }

  // the range's deck, or the Guardians' hall
  ground(x, z) { return Math.hypot(x, z) < RANGE_RADIUS + 0.4 ? 0 : this.hall.ground(x, z) ?? -400; }
  canLand(x, z) { return Math.hypot(x, z) < RANGE_RADIUS - 0.8 || this.hall.canLand(x, z); }
  // the lowest Hal may fly: the deck, the hall's floor, or well down among the towers
  floor(x, z) { return Math.hypot(x, z) < RANGE_RADIUS + 0.4 ? 0 : this.hall.ground(x, z) ?? -60; }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    this.time.value = t;
    this.deckMat.emissiveIntensity = 0.5 + Math.sin(t * 0.8) * 0.06;
    // the flyers leave short trails
    for (const f of this.flyers) {
      f.a += f.w * dt;
      const x = f.c.x + Math.cos(f.a) * f.r, z = f.c.z + Math.sin(f.a) * f.r * 0.6;
      // high overhead, and well clear of the range (their trails are metres wide)
      let y = Math.max(70, f.c.y + Math.sin(f.a * 1.7) * 30 + Math.cos(f.a) * f.r * f.tilt);
      const near = Math.hypot(x, z);
      if (near < 140) y = Math.max(y, 140 - near * 0.4);
      this.traffic.emit(2, (p, v) => { p[0] = x; p[1] = y; p[2] = z; v[0] = 0; v[1] = 0; v[2] = 0; }, { life: 1.4, size: [2.6, 0.2], color: [[0.8, 4, 1.6, 1], [0.1, 1, 0.4, 0]] });
    }
    this.traffic.update(dt, t, camera, renderer);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}
