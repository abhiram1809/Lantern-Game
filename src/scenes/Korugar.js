import * as THREE from 'three';
import { Physics, RAPIER } from '../engine/Physics.js';
import { tween, ease, onFrame, waitFor } from '../engine/Time.js';
import { bakeStatue, StatueFall, STATUE_SCALE } from './Statue.js';
import { createSky } from '../fx/Sky.js';
import { noiseTexture, pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Fire } from '../fx/Particles.js';
import { Broadcast, ScreenWall, renderPortrait, tickerBand, bladeSign, SkyTraffic, ringLane, runLane, CHANNELS } from './KorugarSigns.js';
import { Smash } from '../props/Smash.js';
import { createSinestro, createCharacter } from '../characters/Characters.js';
import { makePose } from '../characters/Poses.js';
import { toGlyphs } from '../ui/UI.js';

// Korugar's capital, Sector 1417 (Part Five): the city Sinestro keeps in order. A hazed amber
// afternoon under a big white-gold sun. At its heart the Plaza of Order, round a colossal stone
// Sinestro on a pedestal cut with the city's oath in Korugarian script; north from it the Avenue of
// Order between black stone towers hung with his banners, up to his palace (its balcony is where
// the city is addressed); east the market street; south the old quarter's narrow lanes, the
// resistance's courtyard off them, and at their end the Halls of Correction, the prison, its cells
// barred with light. Built here, not downloaded (alien architecture: nothing in the libraries
// fits); the towers are one instanced kit with a world-space stone shader (slit windows lit amber,
// bronze bands, dark basalt), so the city stays cheap.
//
// Coordinates: y up, the plaza's centre at the origin, north is -z.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PLAZA_R = 44;
export const STATUE = V(0, 0, 0);
export const PEDESTAL_TOP = 6.2; // where Sinestro stands to address them
export const ARRIVAL = V(0, 0, 24); // where Hal comes down, facing the statue
const TOES = V(0, PEDESTAL_TOP, 1.0), _X = V(1, 0, 0); // the line the statue tips over: his toes, on the pedestal's top
export const PALACE = V(0, 0, -238);
export const BALCONY = V(0, 15.4, -212.3); // where he stands at its rail (the first tier's roof is at 14, its face at z -213)
export const FORECOURT = V(0, 0, -203); // below it, at the head of the avenue's lane through the crowd (Part Six)
export const MARKET = { x0: 44, x1: 176, w: 9 }; // east, along z = 0
export const QUARTER = [V(0, 0, 44), V(0, 0, 78), V(-10, 0, 98), V(-10, 0, 140), V(0, 0, 160)]; // the old quarter's lane, south
export const HIDEOUT = V(-26, 0, 120); // the resistance's courtyard, west off the lane
export const PRISON = V(0, 0, 196); // the Halls of Correction's yard
export const CELLS = [-12, -6, 0, 6, 12].map((x) => V(x, 0, 212)); // the cells along its north wall
// the Broken Chain, the old quarter's tavern, east of the lane across from the courtyard: its room
// inside (x0..x1, z0..z1), the door in its west wall, the bar along the east (buildTavern)
export const TAVERN = { z: 123, x0: -4.4, x1: 9.4, z0: 117.6, z1: 128.4, door: [121.7, 123.7], ceil: 3.5, h: 6.6 };
// the plaza's crowd: front ranks (where the story stands its full figures) facing the statue
export const CROWD_FRONT = Array.from({ length: 16 }, (_, i) => {
  const a = Math.PI * (0.18 + (i / 15) * 0.64) + (i % 2) * 0.02, r = 15.5 + (i % 3) * 1.4;
  return V(Math.cos(a) * r, 0, Math.sin(a) * r);
});

let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const flat = (w, d, tile = 20) => new THREE.PlaneGeometry(w, d, Math.ceil(w / tile), Math.ceil(d / tile)).rotateX(-Math.PI / 2);

// The towers' stone: dark basalt, slit windows (lit amber, some), bronze bands at the floors and the
// crown, per-instance tint. World space, so the pattern runs across the kit's boxes.
const STONE_NIGHT = { value: 0 }; // (night: more windows lit, and brighter)
function stoneMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uKNight = STONE_NIGHT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKw; varying vec3 vKn;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vKw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vKn = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        #else
          vKw = (modelMatrix * vec4(transformed, 1.0)).xyz; vKn = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vKw; varying vec3 vKn; uniform float uKNight;
        float kH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float kN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(kH(i), kH(i + vec2(1, 0)), f.x), mix(kH(i + vec2(0, 1)), kH(i + vec2(1, 1)), f.x), f.y); }
        float kLit = 0.0, kMetal = 0.0;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 kn = normalize(vKn);
        float kSide = 1.0 - step(0.85, abs(kn.y));
        // along the face, and up it
        vec2 kt = normalize(vec2(-kn.z, kn.x) + 1e-5);
        float ku = dot(vKw.xz, kt), kv = vKw.y;
        vec3 kc = vec3(0.105, 0.095, 0.11) * (0.85 + 0.3 * kN(vKw.xz * 0.05 + kv * 0.02));
        kc *= 0.9 + 0.2 * kN(vec2(ku, kv) * 1.3);
        // slit windows: tall and narrow, a floor every 4.2 m, a bay every 2.8 m. Edges anti-aliased over
        // a pixel, and a cell too small to resolve (under a few pixels) drawn as its average: with hard
        // edges every window crawled as the camera moved, and on a curved face they were noise
        vec2 kq = vec2(ku / 2.8, kv / 4.2), kcell = floor(kq), kf = fract(kq), kw = fwidth(kq);
        float kFar = smoothstep(0.12, 0.4, max(kw.x, kw.y));
        vec2 ka = max(kw * 0.75, vec2(1e-4));
        float kx = smoothstep(0.4 - ka.x, 0.4 + ka.x, kf.x) * (1.0 - smoothstep(0.6 - ka.x, 0.6 + ka.x, kf.x));
        float ky = smoothstep(0.2 - ka.y, 0.2 + ka.y, kf.y) * (1.0 - smoothstep(0.88 - ka.y, 0.88 + ka.y, kf.y));
        float kWin = mix(kx * ky, 0.2 * 0.68, kFar) * kSide * step(5.0, kv);
        float kOn = mix(step(0.62 - 0.08 * uKNight, kH(kcell + floor(vKw.xz / 40.0))), 0.38 + 0.08 * uKNight, kFar);
        kc = mix(kc, mix(vec3(0.02, 0.022, 0.03), vec3(1.0, 0.62, 0.28) * 0.35, kOn), kWin);
        kLit = kWin * kOn;
        // bronze bands every three floors, and the reveal under them
        float kbv = kv / 12.6, kbw = fwidth(kbv), kbd = abs(fract(kbv - 0.0125 + 0.5) - 0.5);
        float kBand = mix(1.0 - smoothstep(0.0125 - kbw, 0.0125 + kbw, kbd), 0.025, smoothstep(0.02, 0.06, kbw)) * kSide * step(4.0, kv);
        kc = mix(kc, vec3(0.42, 0.29, 0.13), kBand);
        kMetal = kBand;
        // grime toward the ground
        kc *= mix(0.65, 1.0, smoothstep(0.0, 6.0, kv));
        diffuseColor.rgb = kc;`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n        metalnessFactor = mix(metalnessFactor, 0.85, kMetal);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor = mix(roughnessFactor, 0.38, kMetal);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n        totalEmissiveRadiance += vec3(1.0, 0.55, 0.22) * kLit * (0.9 - 0.25 * uKNight);');
  };
  m.customProgramCacheKey = () => 'korugar-stone';
  return m;
}

// His banner: crimson, bordered black and bronze, a gold disc with his profile above the Lantern
// emblem, and the oath down it in Korugarian script ("Order is peace. Fear is order.").
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  gr.addColorStop(0, '#5e0b0c'); gr.addColorStop(1, '#3a0607');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 1024, 2, 6); }
  g.strokeStyle = '#0e0606'; g.lineWidth = 22; g.strokeRect(11, 11, 234, 1002);
  g.strokeStyle = '#a7782f'; g.lineWidth = 5; g.strokeRect(24, 24, 208, 976);
  // the disc and his profile: the high widow's peak, the long jaw, facing left
  g.fillStyle = '#a7782f'; g.beginPath(); g.arc(128, 230, 92, 0, 7); g.fill();
  g.fillStyle = '#2a0506'; g.beginPath(); g.arc(128, 230, 80, 0, 7); g.fill();
  g.fillStyle = '#c9974a';
  g.beginPath();
  g.moveTo(150, 150); g.quadraticCurveTo(110, 148, 96, 176); g.lineTo(86, 200); g.lineTo(78, 214); g.lineTo(88, 218);
  g.lineTo(86, 236); g.lineTo(80, 248); g.lineTo(90, 252); g.quadraticCurveTo(92, 272, 104, 286); g.lineTo(122, 292);
  g.quadraticCurveTo(140, 300, 150, 300); g.lineTo(168, 310); g.lineTo(172, 270); g.quadraticCurveTo(186, 200, 168, 160); g.closePath(); g.fill();
  g.fillStyle = '#120202'; g.beginPath(); g.moveTo(150, 150); g.quadraticCurveTo(120, 146, 104, 170); g.lineTo(128, 182); g.lineTo(136, 168); g.quadraticCurveTo(160, 176, 168, 160); g.closePath(); g.fill();
  // the emblem: a ring between two bars
  g.strokeStyle = '#6fd18c'; g.fillStyle = '#6fd18c'; g.lineWidth = 16;
  g.beginPath(); g.arc(128, 440, 42, 0, 7); g.stroke();
  g.fillRect(58, 392, 140, 14); g.fillRect(58, 474, 140, 14);
  // the oath, in its script, down the banner
  g.fillStyle = '#c9974a';
  g.textAlign = 'center';
  g.font = '42px "Noto Sans Runic", "Segoe UI Symbol", sans-serif';
  const words = toGlyphs('ORDER IS PEACE FEAR IS ORDER').split(/\s+/);
  words.forEach((w, i) => g.fillText(w, 128, 580 + i * 70));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Korugar {
  constructor({ engine, assets }) {
    this.engine = engine;
    this.assets = assets;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.time = { value: 0 };
    this.cheer = { value: 0 }; // the far crowd's cheering (0 still .. 1 on its toes)
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0xc49a7c, 0.0034);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.35;
    s.userData.exposure = 0.92;
    s.userData.far = 1400;
    s.userData.near = 0.05;
    this.sky = createSky('korugar', 900);
    s.add(this.sky);
    this.smash = new Smash(this.physics, s);
    this.buildLight();
    this.buildGround();
    this.towers = [];
    this.buildCity();
    this.buildStatue();
    this.buildBanners();
    this.buildMarket();
    this.buildQuarter();
    this.buildTavern();
    this.buildPrison();
    this.buildPalace();
    this.buildBroadcast();
    this.buildCrowdFill();
    this.physics.fixedGround(900);
    return this;
  }

  buildLight() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xb8a0c8, 0x5a3e30, 0.6);
    s.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffe2b8, 2.4));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 400 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    s.add(sun, sun.target);
    this.focus(V(0, 0, 0));
    // lamps round the plaza: warm pools at the foot of the towers
    for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) {
      const l = new THREE.PointLight(0xffa35a, 40, 38, 2);
      l.position.set(x, 7, z);
      s.add(l);
    }
  }

  focus(at) {
    const d = this.sky.userData.uniforms.uSunDir.value;
    this.sun.target.position.copy(at);
    this.sun.position.copy(at).addScaledVector(d, 180);
    this.sun.target.updateMatrixWorld();
  }

  buildGround() {
    const s = this.scene;
    // the streets: dark worn stone
    const street = pbrMaterial('concrete_floor_02', { repeat: [220, 220], tint: new THREE.Color(0.42, 0.38, 0.44) });
    const ground = new THREE.Mesh(flat(1100, 1100, 25), street);
    ground.position.y = 0;
    ground.receiveShadow = true;
    s.add(ground);
    // the plaza: polished basalt, rings of bronze, the emblem inlaid at the statue's foot
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#1c181c'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,230' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3); }
    // flagstones: rings and radial joints
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
    for (let r = 60; r < 512; r += 46) { g.beginPath(); g.arc(512, 512, r, 0, 7); g.stroke(); }
    for (let a = 0; a < 48; a++) { const t = (a / 48) * Math.PI * 2; g.beginPath(); g.moveTo(512 + Math.cos(t) * 60, 512 + Math.sin(t) * 60); g.lineTo(512 + Math.cos(t) * 512, 512 + Math.sin(t) * 512); g.stroke(); }
    g.strokeStyle = '#8a6328'; g.lineWidth = 7;
    for (const r of [150, 330, 498]) { g.beginPath(); g.arc(512, 512, r, 0, 7); g.stroke(); }
    // rays from the statue
    g.lineWidth = 4;
    for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; g.beginPath(); g.moveTo(512 + Math.cos(t) * 150, 512 + Math.sin(t) * 150); g.lineTo(512 + Math.cos(t) * 330, 512 + Math.sin(t) * 330); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    s.add(plaza);
  }

  // The towers: plinth, shaft, fins down the street face, a set-back crown, a spire on the tallest.
  buildCity() {
    const s = this.scene, list = [];
    const add = (x, z, w, d, h, yaw = 0) => list.push({ x, z, w, d, h, yaw });
    // round the plaza, between the four streets
    for (let q = 0; q < 4; q++) {
      const a0 = q * Math.PI / 2 + 0.25, a1 = (q + 1) * Math.PI / 2 - 0.25;
      for (let k = 0; k < 4; k++) {
        const a = a0 + (a1 - a0) * (k + 0.5) / 4, r = PLAZA_R + 12 + (k % 2) * 3;
        add(Math.cos(a) * r, Math.sin(a) * r, 16 + rnd() * 6, 14 + rnd() * 6, 34 + rnd() * 40, -a + Math.PI / 2);
      }
    }
    // the Avenue of Order, north: both sides
    for (let z = -64; z > -206; z -= 22 + rnd() * 4) for (const side of [-1, 1]) add(side * (19 + rnd() * 2), z, 18, 18 + rnd() * 3, 40 + rnd() * 46, 0);
    // the market street, east: lower, older
    for (let x = 62; x < 176; x += 19 + rnd() * 3) for (const side of [-1, 1]) add(x, side * (MARKET.w + 9 + rnd() * 2), 16, 14, 16 + rnd() * 18, 0);
    // the west avenue
    for (let x = -62; x > -176; x -= 22 + rnd() * 4) for (const side of [-1, 1]) add(x, side * (19 + rnd() * 2), 18, 18, 30 + rnd() * 40, 0);
    // the old quarter, south: close and low either side of the lane
    for (let z = 58; z < 160; z += 13) for (const side of [-1, 1]) {
      const lx = z < 88 ? 0 : z < 150 ? -10 : 0;
      if (side < 0 && Math.abs(z - HIDEOUT.z) < 14) continue; // the courtyard's opening
      const x = lx + side * (12 + rnd()), h = 12 + rnd() * 10; // (drawn as before, so the rest of the city comes out the same)
      if (side > 0 && z === TAVERN.z) continue; // the Broken Chain stands here (buildTavern)
      add(x, z, 15, 11, h, 0);
    }
    // the skyline behind it all
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 230 + rnd() * 320;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 40 && z < -150 && z > -320) continue; // the palace's view
      add(x, z, 22 + rnd() * 26, 22 + rnd() * 26, 60 + rnd() * 160, rnd() * 3);
    }
    this.towers = list;
    const n = list.length;
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const mat = stoneMaterial();
    const parts = { plinth: new THREE.InstancedMesh(box, mat, n), shaft: new THREE.InstancedMesh(box, mat, n), crown: new THREE.InstancedMesh(box, mat, n), spire: new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0), mat, n), fins: new THREE.InstancedMesh(box, mat, n * 6) };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    let fins = 0;
    list.forEach((b, i) => {
      q.setFromAxisAngle(V(0, 1, 0), b.yaw);
      const at = (y) => V(b.x, y, b.z);
      m4.compose(at(0), q, V(b.w + 2.4, 4.5, b.d + 2.4)); parts.plinth.setMatrixAt(i, m4);
      m4.compose(at(4.5), q, V(b.w, b.h - 4.5, b.d)); parts.shaft.setMatrixAt(i, m4);
      const ch = b.h * (0.12 + rnd() * 0.12);
      m4.compose(at(b.h), q, V(b.w * 0.66, ch, b.d * 0.66)); parts.crown.setMatrixAt(i, m4);
      const sp = b.h > 70 ? 8 + rnd() * 22 : 0.001;
      m4.compose(at(b.h + ch), q, V(b.w * 0.25, sp, b.d * 0.25)); parts.spire.setMatrixAt(i, m4);
      // fins on the two long faces
      for (let k = 0; k < 6 && fins < n * 6; k++) {
        const side = k < 3 ? 1 : -1, u = ((k % 3) - 1) * b.w * 0.33;
        const off = V(u, 0, side * (b.d / 2 + 0.4)).applyQuaternion(q);
        m4.compose(V(b.x + off.x, 4.5, b.z + off.z), q, V(0.9, b.h * (0.82 + rnd() * 0.12) - 4.5, 0.8));
        parts.fins.setMatrixAt(fins++, m4);
      }
      col.setHSL(0.75 + rnd() * 0.15, 0.08 + rnd() * 0.08, 0.85 + rnd() * 0.3);
      for (const p of [parts.plinth, parts.shaft, parts.crown, parts.spire]) p.setColorAt(i, col);
      // solid (its box, turned with it)
      if (Math.hypot(b.x, b.z) < 230) this.physics.fixedBox({ x: b.x, y: b.h / 2, z: b.z }, { x: (b.w + 2.4) / 2, y: b.h / 2, z: (b.d + 2.4) / 2 }, { x: q.x, y: q.y, z: q.z, w: q.w });
    });
    parts.fins.count = fins;
    for (let k = 0; k < fins; k++) parts.fins.setColorAt(k, col.setHSL(0.75, 0.05, 0.7));
    for (const p of Object.values(parts)) { p.castShadow = p.receiveShadow = true; p.frustumCulled = false; s.add(p); }
    this.blocks = list.filter((b) => Math.hypot(b.x, b.z) < 230).map((b) => ({ x: b.x, z: b.z, r: Math.max(b.w, b.d) * 0.6 + 1.5 }));
  }

  // Sinestro in stone, fourteen metres of him on a stepped pedestal, the way he stands: chin up, his
  // hands clasped behind his back, looking down on the plaza. His own figure (Characters.createSinestro),
  // posed once and turned to stone. (An arm raised out over a crowd was the wrong history to call up.)
  buildStatue() {
    const s = this.scene, g = (this.statue = new THREE.Group());
    s.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.78, metalness: 0.02 });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x6e4b22, roughness: 0.62, metalness: 0.6 }); // (rougher: bare once he's down, the low sun in it bloomed white)
    // the pedestal: three steps, a drum with the oath cut round it
    const steps = [[9, 0.8], [7.4, 1.6], [5.8, 2.4]];
    for (const [r, h] of steps) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.4, 0.8, 48), stone); m.position.y = h - 0.4; m.castShadow = m.receiveShadow = true; g.add(m); }
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 256;
    const gx = c.getContext('2d');
    gx.fillStyle = '#7d7468'; gx.fillRect(0, 0, 2048, 256);
    gx.fillStyle = '#3a342e'; gx.font = '120px "Noto Sans Runic", "Segoe UI Symbol", sans-serif'; gx.textAlign = 'center';
    gx.fillText(toGlyphs('ORDER IS PEACE · FEAR IS ORDER · SINESTRO'), 1024, 170);
    const ct = new THREE.CanvasTexture(c);
    ct.colorSpace = THREE.SRGBColorSpace;
    ct.wrapS = THREE.RepeatWrapping;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 3.8, 48, 1, true), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.8 }));
    drum.position.y = 2.4 + 1.9;
    drum.castShadow = drum.receiveShadow = true;
    g.add(drum);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.4, 0.5, 48), bronze);
    cap.position.y = PEDESTAL_TOP - 0.25;
    g.add(cap);
    this.physics.fixedCollider(RAPIER_CYL(4.6, PEDESTAL_TOP / 2), { x: 0, y: PEDESTAL_TOP / 2, z: 0 });
    this.physics.fixedBox({ x: 0, y: 0.8, z: 0 }, { x: 6.4, y: 0.8, z: 6.4 });
    // the figure: posed (his hands clasped behind him), baked into stone and cut at the ankles and
    // the neck (Statue.js), three pieces standing as one until he's brought down
    const abin = this.assets?.characters?.abin;
    if (abin) {
      const stone = new Map();
      const fig = (this.fig = bakeStatue(createSinestro(abin), (m) => {
        if (!stone.has(m)) stone.set(m, new THREE.MeshStandardMaterial({ color: 0x9a9184, roughness: 0.72, metalness: 0.02, normalMap: m.material.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), side: THREE.DoubleSide }));
        return stone.get(m);
      }));
      this.statueRest = V(0, PEDESTAL_TOP, -1.2);
      for (const part of Object.values(fig.parts)) { part.scale.setScalar(STATUE_SCALE); part.position.copy(this.statueRest); g.add(part); }
      // where each joint is now (the pull's chains and looks), through the piece that carries it
      const partOf = (n) => (n === 'head' || n === 'neck' ? fig.parts.head : n.startsWith('foot') ? fig.parts.feet : fig.parts.body);
      this.statueRig = { root: fig.parts.body, bonePosition: (n, out = V(0, 0, 0)) => { const p = partOf(n); p.updateMatrixWorld(); return out.copy(fig.joints[n]).applyMatrix4(p.matrixWorld); } };
      this.statueSolid();
    }
  }

  // The statue's pieces solid where they are (their own triangles): standing, or down on the plaza.
  statueSolid() {
    for (const c of this.statueCols ?? []) this.physics.world.removeRigidBody(c);
    this.statueCols = [];
    for (const part of Object.values(this.fig.parts)) part.traverse((o) => { if (o.isMesh && o.geometry.type === 'BufferGeometry') this.statueCols.push(this.physics.fixedTrimesh(o)); });
  }

  // His banners: down the towers' faces round the plaza and along the avenue, and on tall poles at
  // the plaza's edge, stirring in the wind.
  buildBanners() {
    const s = this.scene, tex = bannerTexture();
    const mat = (this.bannerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
    // (hung flat on a wall: no sway, which carried the swaying ones in and out of the stone)
    this.wallBannerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float bw = (1.0 - uv.y);
          #ifdef USE_INSTANCING
            float bp = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
          #else
            float bp = 0.0;
          #endif
          transformed.z += sin(uTime * 1.6 + bp + uv.y * 4.0) * 0.25 * bw + sin(uTime * 2.7 + bp * 1.7 + uv.x * 3.0) * 0.08 * bw;`);
    };
    mat.customProgramCacheKey = () => 'korugar-banner';
    const geo = new THREE.PlaneGeometry(3.2, 12.8, 4, 16).translate(0, -6.4, 0);
    const spots = [];
    // on the plaza's towers, facing in
    for (const b of this.towers.slice(0, 16)) {
      const toC = V(-b.x, 0, -b.z).normalize();
      spots.push([b.x + toC.x * (b.d / 2 + 1.4), Math.min(b.h - 3, 24), b.z + toC.z * (b.d / 2 + 1.4), Math.atan2(toC.x, toC.z)]);
    }
    // along the avenue, on its facades
    for (let z = -60; z > -200; z -= 22) for (const side of [-1, 1]) spots.push([side * 9.4, 18, z, side > 0 ? -Math.PI / 2 : Math.PI / 2]);
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, y, z, yaw], i) => { q.setFromAxisAngle(V(0, 1, 0), yaw); m4.compose(V(x, y, z), q, V(1, 1, 1)); inst.setMatrixAt(i, m4); });
    inst.castShadow = true;
    inst.frustumCulled = false;
    s.add(inst);
    // poles round the plaza's rim with a banner each (they can be knocked down)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b2a18, metalness: 0.8, roughness: 0.45 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      if (Math.abs(Math.sin(a)) < 0.12 || Math.abs(Math.cos(a)) < 0.12) continue; // the streets' mouths
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 14, 8).translate(0, 7, 0), poleMat);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 13.6, 0), poleMat);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8, 3, 10).translate(0, 9.6, 0.05), mat);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), poleMat);
      top.position.y = 14.2;
      for (const m of [pole, bar, flag, top]) { m.castShadow = true; g.add(m); }
      g.position.set(Math.cos(a) * (PLAZA_R - 2), 0, Math.sin(a) * (PLAZA_R - 2));
      g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
      s.add(g);
      this.smash.add(g, { kind: 'breaks', mass: 120, strong: 16, shrink: 1, glass: false, box: new THREE.Box3(V(-0.18, 0, -0.18), V(0.18, 14, 0.18)) });
    }
  }

  // The market street: stalls under faded awnings, crates, jars; everything on it can be knocked about.
  buildMarket() {
    const s = this.scene, M = MARKET;
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 });
    const cloths = [0x6b4a3a, 0x48505e, 0x5e5236, 0x3e4a42, 0x6a3a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }));
    const clay = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 });
    this.stalls = [];
    for (let x = M.x0 + 8; x < M.x1; x += 9.5) for (const side of [-1, 1]) {
      if (rnd() < 0.2) continue;
      const g = new THREE.Group();
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.4).translate(0, 0.45, 0), wood);
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.4).rotateX(-Math.PI / 2 + 0.35).translate(0, 2.5, 0.2), cloths[Math.floor(rnd() * cloths.length)]);
      for (const px of [-1.75, 1.75]) for (const pz of [-0.9, 0.9]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08).translate(0, 1.3, 0), wood); post.position.set(px, 0, pz); g.add(post); }
      g.add(table, awn);
      for (let k = 0; k < 4; k++) { const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.34, 10).translate(0, 0.17, 0), clay); jar.position.set(-1.2 + k * 0.8, 0.9, (rnd() - 0.5) * 0.6); g.add(jar); }
      g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      g.position.set(x, 0, side * (M.w - 1.6));
      g.rotation.y = side > 0 ? Math.PI : 0;
      s.add(g);
      this.smash.add(g, { kind: 'breaks', mass: 160, strong: 18, stuff: 'wood', glass: false, box: new THREE.Box3(V(-1.7, 0, -0.8), V(1.7, 1.2, 0.8)) });
      this.stalls.push(g);
      // a crate or two beside it
      for (let k = 0; k < 2; k++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8).translate(0, 0.35, 0), wood);
        crate.position.set(x + 2.2 + k * 0.4, 0, side * (M.w - 1.2) + (rnd() - 0.5));
        crate.rotation.y = rnd();
        crate.castShadow = crate.receiveShadow = true;
        s.add(crate);
        this.smash.add(crate, { mass: 30, stuff: 'wood', glass: false });
      }
    }
  }

  // The Broken Chain (the open world's "places like these on Korugar once it's freed"): a tavern of
  // the old quarter, built where a tower stood. Plastered stone, its door to the lane under a board of
  // glyphs and a lamp, two windows lit; inside a bar down the back wall with its jars and bottles, low
  // tables with cushions round them, a hearth, lamps from the beams, and the Corps' emblem on green
  // cloth by the bar now the Lantern is welcome. One light, on while the camera's near.
  buildTavern() {
    const s = this.scene, T = TAVERN, t = 0.4, g = (this.tavern = new THREE.Group());
    s.add(g);
    const plaster = pbrMaterial('painted_plaster_wall', { repeat: [1 / 3, 1 / 3], tint: new THREE.Color(0.7, 0.62, 0.66) });
    const inner = pbrMaterial('painted_plaster_wall', { repeat: [1 / 2.5, 1 / 2.5], tint: new THREE.Color(0.86, 0.72, 0.6) });
    const floor = pbrMaterial('patio_tiles', { repeat: [1 / 1.6, 1 / 1.6], tint: new THREE.Color(0.62, 0.42, 0.36) });
    const wood = new THREE.MeshStandardMaterial({ color: 0x3e2a1e, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1e1612, roughness: 0.9 });
    const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
    const box = (x0, y0, z0, x1, y1, z1, mat, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      if (solid) this.physics.fixedBox({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, { x: (x1 - x0) / 2, y: (y1 - y0) / 2, z: (z1 - z0) / 2 });
      return m;
    };
    const [d0, d1] = T.door, dh = 2.5;
    // the shell: the walls (the door's gap in the west one), the roof, a parapet; inside, the linings,
    // the floor and the ceiling's beams
    box(T.x0 - t, 0, T.z0 - t, T.x0, T.h, d0, plaster); box(T.x0 - t, 0, d1, T.x0, T.h, T.z1 + t, plaster); box(T.x0 - t, dh, d0, T.x0, T.h, d1, plaster);
    box(T.x1, 0, T.z0 - t, T.x1 + t, T.h, T.z1 + t, plaster);
    box(T.x0, 0, T.z0 - t, T.x1, T.h, T.z0, plaster); box(T.x0, 0, T.z1, T.x1, T.h, T.z1 + t, plaster);
    box(T.x0 - t, T.h, T.z0 - t, T.x1 + t, T.h + 0.3, T.z1 + t, plaster);
    for (const [a, b, c, d] of [[T.x0 - t, T.x1 + t, T.z0 - t, T.z0 - t + 0.25], [T.x0 - t, T.x1 + t, T.z1 + t - 0.25, T.z1 + t], [T.x0 - t, T.x0 - t + 0.25, T.z0 - t, T.z1 + t], [T.x1 + t - 0.25, T.x1 + t, T.z0 - t, T.z1 + t]]) box(a, T.h + 0.3, c, b, T.h + 0.9, d, plaster, false);
    box(T.x0 + 0.01, 0, T.z0 + 0.01, T.x1 - 0.01, T.ceil, T.z0 + 0.03, inner, false); box(T.x0 + 0.01, 0, T.z1 - 0.03, T.x1 - 0.01, T.ceil, T.z1 - 0.01, inner, false);
    box(T.x1 - 0.03, 0, T.z0 + 0.03, T.x1 - 0.01, T.ceil, T.z1 - 0.03, inner, false);
    box(T.x0 + 0.01, 0, T.z0 + 0.03, T.x0 + 0.03, T.ceil, d0 - 0.01, inner, false); box(T.x0 + 0.01, 0, d1 + 0.01, T.x0 + 0.03, T.ceil, T.z1 - 0.03, inner, false); box(T.x0 + 0.01, dh, d0, T.x0 + 0.03, T.ceil, d1, inner, false);
    box(T.x0, -0.05, T.z0, T.x1, 0.015, T.z1, floor, false);
    box(T.x0, T.ceil, T.z0, T.x1, T.ceil + 0.12, T.z1, wood, false);
    for (let x = T.x0 + 1.4; x < T.x1 - 0.6; x += 2.2) box(x - 0.12, T.ceil - 0.22, T.z0, x + 0.12, T.ceil, T.z1, wood, false);
    // the door: its frame, a heavy leaf standing open against the inside wall; the windows either side
    box(T.x0 - t - 0.06, 0, d0 - 0.16, T.x0 + 0.04, dh + 0.14, d0, wood, false); box(T.x0 - t - 0.06, 0, d1, T.x0 + 0.04, dh + 0.14, d1 + 0.16, wood, false); box(T.x0 - t - 0.06, dh, d0, T.x0 + 0.04, dh + 0.14, d1, wood, false);
    box(T.x0 + 0.05, 0.02, d1 + 0.05, T.x0 + 1.95, dh - 0.05, d1 + 0.12, wood, false);
    // (the frame behind the lit pane, its bars in front: a frame over the pane hid the light)
    for (const z of [T.z0 + 1.6, T.z1 - 1.6]) { box(T.x0 - t - 0.04, 1.0, z - 0.7, T.x0 - t + 0.01, 2.4, z + 0.7, wood, false); box(T.x0 - t - 0.06, 1.1, z - 0.6, T.x0 - t - 0.05, 2.3, z + 0.6, glow(0xffb060), false); for (const dz of [-0.2, 0.2]) box(T.x0 - t - 0.1, 1.1, z + dz - 0.03, T.x0 - t - 0.07, 2.3, z + dz + 0.03, dark, false); box(T.x0 - t - 0.14, 0.94, z - 0.78, T.x0 - t, 1.0, z + 0.78, wood, false); }
    // its board over the door, in glyphs, and a lamp on a bracket
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const x2 = c.getContext('2d');
    x2.fillStyle = '#2a1a12'; x2.fillRect(0, 0, 512, 128);
    x2.strokeStyle = '#b08a4a'; x2.lineWidth = 6; x2.strokeRect(6, 6, 500, 116);
    x2.fillStyle = '#e8c070'; x2.font = '600 54px serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.fillText(toGlyphs('THE BROKEN CHAIN'), 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    board.position.set(T.x0 - t - 0.06, dh + 0.75, (d0 + d1) / 2);
    board.rotation.y = -Math.PI / 2;
    g.add(board);
    box(T.x0 - t - 0.55, dh + 0.3, d1 + 0.5, T.x0 - t, dh + 0.36, d1 + 0.56, dark, false);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glow(0xffc070));
    lamp.position.set(T.x0 - t - 0.5, dh + 0.1, d1 + 0.53);
    g.add(lamp);
    // the bar down the east wall, the shelves behind it with their jars and bottles
    const bx = T.x1 - 1.9, za = T.z0 + 1.1, zb = T.z1 - 1.1;
    box(bx, 0, za, bx + 0.6, 1.05, zb, wood); box(bx - 0.06, 1.05, za - 0.05, bx + 0.66, 1.1, zb + 0.05, dark, false);
    box(T.x1 - 0.45, 0, za, T.x1 - 0.03, 0.95, zb, wood);
    const jars = [0x8a5a3a, 0x6a3a5a, 0x3a5a4a, 0xa88a4a, 0x5a2a2a];
    const r = ((n) => () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296))(4417);
    for (const y of [1.3, 1.75, 2.2]) {
      box(T.x1 - 0.4, y - 0.03, za, T.x1 - 0.03, y, zb, wood, false);
      for (let z = za + 0.2; z < zb - 0.2; z += 0.16 + r() * 0.08) { const h = 0.18 + r() * 0.16, m = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + r() * 0.03, 0.06 + r() * 0.03, h, 8).translate(T.x1 - 0.22, y + h / 2, z), new THREE.MeshStandardMaterial({ color: jars[Math.floor(r() * jars.length)], roughness: 0.5 })); g.add(m); }
    }
    for (let z = za + 0.5; z < zb - 0.2; z += 0.9) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.72, 12).translate(bx - 0.45, 0.36, z), wood); st.castShadow = true; g.add(st); this.physics.fixedBox({ x: bx - 0.45, y: 0.36, z }, { x: 0.18, y: 0.36, z: 0.18 }); }
    // the Corps' emblem on green cloth by the bar
    box(T.x1 - 0.06, 1.0, T.z1 - 0.9, T.x1 - 0.03, 2.8, T.z1 - 0.15, new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.9 }), false);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 24).rotateY(Math.PI / 2).translate(T.x1 - 0.08, 2.0, T.z1 - 0.52), glow(0x9affb0));
    g.add(ring);
    for (const dy of [0.34, -0.34]) box(T.x1 - 0.09, 2.0 + dy - 0.04, T.z1 - 0.78, T.x1 - 0.07, 2.0 + dy + 0.04, T.z1 - 0.26, glow(0x9affb0), false);
    // low tables with cushions round them, clear of the way in from the door
    for (const [tx, tz] of [[T.x0 + 2.4, T.z0 + 2.2], [T.x0 + 2.4, T.z1 - 2.2], [T.x0 + 5.8, T.z0 + 2.4], [T.x0 + 5.8, T.z1 - 2.4]]) {
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 18).translate(tx, 0.5, tz), wood);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.47, 10).translate(tx, 0.235, tz), wood);
      tb.castShadow = leg.castShadow = true;
      g.add(tb, leg);
      this.physics.fixedBox({ x: tx, y: 0.27, z: tz }, { x: 0.55, y: 0.27, z: 0.55 });
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, cu = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55).translate(tx + Math.cos(a) * 1.0, 0.08, tz + Math.sin(a) * 1.0), new THREE.MeshStandardMaterial({ color: [0x6a2a2a, 0x4a3a6a, 0x6a5a2a, 0x2a4a4a][k], roughness: 0.95 })); cu.receiveShadow = true; g.add(cu); }
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.1, 10).translate(tx + 0.15, 0.58, tz - 0.1), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.6 }));
      g.add(cup);
    }
    // the hearth in the north wall, its fire a glow
    const hx = T.x0 + 4.2;
    box(hx - 1.0, 0, T.z0, hx + 1.0, 1.4, T.z0 + 0.8, new THREE.MeshStandardMaterial({ color: 0x5a4a48, roughness: 0.95 }));
    box(hx - 0.6, 0.15, T.z0 + 0.79, hx + 0.6, 0.85, T.z0 + 0.82, glow(0xff7a30), false);
    // lamps from the beams
    for (const [lx, lz] of [[T.x0 + 2.4, T.z0 + 2.2], [T.x0 + 5.8, T.z1 - 2.4], [bx - 0.4, (za + zb) / 2]]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4).translate(lx, T.ceil - 0.45, lz), dark);
      const shade = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), glow(0xffb868));
      shade.position.set(lx, T.ceil - 1.0, lz);
      g.add(cord, shade);
    }
    this.tavernLight = new THREE.PointLight(0xffb070, 0, 16, 2);
    this.tavernLight.position.set((T.x0 + T.x1) / 2, T.ceil - 0.6, (T.z0 + T.z1) / 2);
    g.add(this.tavernLight);
    this.updaters.push(() => { const cam = this.engine.camera.position; this.tavernLight.intensity = Math.hypot(cam.x - this.tavernLight.position.x, cam.z - this.tavernLight.position.z) < 30 ? 9 : 0; });
  }

  // The old quarter: a lane south from the plaza, low walls and archways over it, the resistance's
  // courtyard off it to the west (crates, a table with their map of the city, candles, a broken
  // banner on the wall).
  buildQuarter() {
    const s = this.scene, wood = new THREE.MeshStandardMaterial({ color: 0x3e2c20, roughness: 0.9 });
    const stone = stoneMaterial();
    // archways over the lane
    for (const z of [70, 112, 150]) {
      const lx = z < 88 ? 0 : z < 150 ? -10 : 0;
      const arch = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 2).translate(0, 7.4, 0), stone);
      arch.position.set(lx, 0, z);
      arch.castShadow = true;
      s.add(arch);
    }
    const H = HIDEOUT, g = (this.hideout = new THREE.Group());
    g.position.copy(H);
    s.add(g);
    // the courtyard's walls (open to the lane on the east)
    for (const [x, z, w, d] of [[-9, 0, 1, 18], [0, -9, 18, 1], [0, 9, 18, 1]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d).translate(0, 4.5, 0), stone);
      wall.position.set(x, 0, z);
      wall.castShadow = wall.receiveShadow = true;
      g.add(wall);
      this.physics.fixedBox({ x: H.x + x, y: 4.5, z: H.z + z }, { x: w / 2, y: 4.5, z: d / 2 });
    }
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.3).translate(0, 0.425, 0), wood);
    table.position.set(-3, 0, 0);
    g.add(table);
    // their map: the city's streets drawn over in chalk, the prison ringed
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const m = c.getContext('2d');
    m.fillStyle = '#c8b694'; m.fillRect(0, 0, 512, 256);
    m.strokeStyle = '#4a3a2a'; m.lineWidth = 3;
    m.beginPath(); m.arc(256, 128, 40, 0, 7); m.stroke();
    for (const [x0, y0, x1, y1] of [[256, 88, 256, 6], [296, 128, 506, 128], [256, 168, 256, 250], [216, 128, 6, 128]]) { m.beginPath(); m.moveTo(x0, y0); m.lineTo(x1, y1); m.stroke(); }
    m.strokeStyle = '#a02a1c'; m.lineWidth = 4; m.beginPath(); m.arc(256, 232, 18, 0, 7); m.stroke();
    m.fillStyle = '#4a3a2a'; m.font = '22px "Noto Sans Runic", sans-serif'; m.fillText(toGlyphs('FREE KORUGAR'), 300, 230);
    const mt = new THREE.CanvasTexture(c);
    mt.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.9 }));
    map.position.set(-3, 0.86, 0);
    g.add(map);
    this.smash.add(table, { kind: 'breaks', mass: 80, strong: 14, stuff: 'wood', glass: false });
    // candles: little flames, and a warm light over the table
    const flame = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)'), color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [x, z] of [[-3.9, -0.4], [-2.2, 0.45], [-6.5, 5.5]]) { const f = new THREE.Sprite(flame); f.scale.setScalar(0.22); f.position.set(x, 1.0, z); g.add(f); }
    const lamp = new THREE.PointLight(0xffa050, 14, 14, 2);
    lamp.position.set(-3, 2.4, 0);
    g.add(lamp);
    for (let k = 0; k < 7; k++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9).translate(0, 0.4, 0), wood);
      crate.position.set(H.x - 6.5 + (k % 3) * 1.1, (k > 3 ? 0.8 : 0), H.z - 6 + Math.floor(k / 3) * 1.1);
      crate.rotation.y = rnd() * 0.4;
      crate.castShadow = crate.receiveShadow = true;
      s.add(crate);
      this.smash.add(crate, { mass: 35, stuff: 'wood', glass: false });
    }
    // the resistance's own sign on the wall: his emblem, torn and crossed out
    const bt = bannerTexture();
    const torn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8.8), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9, color: 0x9a8a80 }));
    torn.position.set(-8.4, 4.8, -2.5);
    torn.rotation.set(0, Math.PI / 2, 0.08);
    g.add(torn);
    const slash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 9), new THREE.MeshBasicMaterial({ color: 0x0c0a08 }));
    slash.position.set(-8.35, 4.8, -2.5);
    slash.rotation.set(0, Math.PI / 2, 0.5);
    g.add(slash);
  }

  // The Halls of Correction: high walls round a yard, the cells along its north wall barred with
  // light (Sinestro's own constructs, standing guard), the gate onto the old quarter.
  buildPrison() {
    const s = this.scene, P = PRISON, stone = stoneMaterial();
    for (const [x, z, w, d, h] of [[0, 26, 44, 3, 16], [-22, 8, 3, 38, 16], [22, 8, 3, 38, 16], [-14, -11, 16, 3, 16], [14, -11, 16, 3, 16]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), stone);
      wall.position.set(P.x + x, 0, P.z + z);
      wall.castShadow = wall.receiveShadow = true;
      s.add(wall);
      this.physics.fixedBox({ x: P.x + x, y: h / 2, z: P.z + z }, { x: w / 2, y: h / 2, z: d / 2 });
    }
    // the cells: alcoves in the north wall, bars of green light
    const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.6, 0.7), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.bars = [];
    for (const c of CELLS) {
      // an alcove: back wall, side walls, a roof, open behind the bars
      for (const [w, h, d, x, y, z] of [[5.6, 4.4, 0.4, 0, 2.2, 6.4], [0.4, 4.4, 4.2, -2.6, 2.2, 4.4], [0.4, 4.4, 4.2, 2.6, 2.2, 4.4], [5.6, 0.4, 4.2, 0, 4.4, 4.4]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
        m.position.set(c.x + x, y, c.z + z);
        m.castShadow = m.receiveShadow = true;
        s.add(m);
      }
      const inner = new THREE.PointLight(0x55ff90, 3, 6, 2);
      inner.position.set(c.x, 3.4, c.z + 4.2);
      s.add(inner);
      for (let k = 0; k < 7; k++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6).translate(0, 1.8, 0), barMat);
        bar.position.set(c.x - 2.1 + k * 0.7, 0, c.z + 2.4);
        s.add(bar);
        this.bars.push(bar);
      }
      this.physics.fixedBox({ x: c.x, y: 1.8, z: c.z + 2.4 }, { x: 2.4, y: 1.8, z: 0.1 });
    }
    const glow = new THREE.PointLight(0x55ff90, 18, 26, 2);
    glow.position.set(P.x, 3, P.z + 14);
    s.add(glow);
  }

  // The capital as Times Square for Sinestro (Part Six, the user's note): screens stacked up the
  // plaza's towers and the avenue's (his face, his slogans: KorugarSigns.js), tickers round two
  // towers, neon blade signs over the market and the avenue, traffic in lanes above it all.
  buildBroadcast() {
    const s = this.scene, ab = this.assets?.characters?.abin;
    if (!ab) return;
    const bc = (this.broadcast = new Broadcast({ portrait: renderPortrait(this.engine, ab) }));
    const wall = new ScreenWall(bc), tickers = [];
    const pick = (i) => CHANNELS[i % CHANNELS.length];
    // round the plaza, on the faces turned to it: a big screen high over the banner on the tall
    // ones, two smaller stacked either side of it (in front of the fins)
    this.towers.slice(0, 16).forEach((b, i) => {
      const toC = V(-b.x, 0, -b.z).normalize(), side = V(toC.z, 0, -toC.x), yaw = Math.atan2(toC.x, toC.z);
      const face = V(b.x, 0, b.z).addScaledVector(toC, b.d / 2 + 1.0);
      // a big one across the face over the banner, a second above it on the tallest
      const bw = b.w - 1.6;
      if (b.h >= 40) wall.add(pick(i), face.clone().setY(25.6 + bw / 4), yaw, bw);
      if (b.h >= 62) wall.add(pick(i + 3), face.clone().setY(27.4 + bw * 0.75), yaw, bw);
      // either side of the banner, two rows
      const sw = b.w / 2 - 2.6, u = 1.9 + sw / 2;
      for (const sx of [-1, 1]) {
        wall.add(pick(i * 3 + (sx > 0 ? 1 : 2)), face.clone().addScaledVector(side, sx * u).setY(10.2 + sw / 4), yaw, sw);
        wall.add(pick(i * 5 + (sx > 0 ? 3 : 4)), face.clone().addScaledVector(side, sx * u).setY(11.0 + sw * 0.75), yaw, sw);
      }
      if (i === 0 || i === 9) tickers.push(tickerBand(s, { x: b.x, z: b.z, w: b.w + 2.0, d: b.d + 2.0, yaw: b.yaw, y: 8.2 }));
    });
    // down the Avenue of Order: two screens high on each tower's face to the street, neon at its foot
    let n = 0;
    for (const b of this.towers) {
      if (!(Math.abs(Math.abs(b.x) - 20) < 2.5 && b.z < -60 && b.z > -210)) continue;
      const sx = Math.sign(b.x), yaw = sx > 0 ? -Math.PI / 2 : Math.PI / 2, fx = b.x - sx * (b.w / 2 + 0.35);
      wall.add(pick(n + 2), V(fx, 22.5, b.z - 4), yaw, 8);
      wall.add(pick(n + 5), V(fx, 27.2, b.z + 3.5), yaw, 8);
      for (const dz of [-6, 6]) bladeSign(s, V(b.x - sx * (b.w / 2 + 0.75), 6.5, b.z + dz), yaw, n * 3 + (dz > 0 ? 1 : 0));
      n++;
    }
    // over the market street, a sign on each building
    let m = 0;
    for (const b of this.towers) {
      if (!(b.x > MARKET.x0 && b.x < MARKET.x1 && Math.abs(Math.abs(b.z) - (MARKET.w + 10)) < 2.5)) continue;
      const sz = Math.sign(b.z);
      bladeSign(s, V(b.x + ((m % 2) ? 3 : -3), 5.8, b.z - sz * (b.d / 2 + 0.75)), sz > 0 ? Math.PI : 0, m + 5);
      m++;
    }
    wall.build(s);
    // traffic: rings above the towers, runs down the open avenue and over the market's low roofs
    const traffic = new SkyTraffic(s, [ringLane(82, 96, 1), ringLane(104, 108, -1), ringLane(128, 102, 1),
      runLane(V(-3.2, 30, -34), V(-3.2, 30, -205)), runLane(V(3.6, 38, -205), V(3.6, 38, -34)), runLane(V(48, 44, 2), V(176, 44, 2))]);
    this.updaters.push((dt) => { bc.update(dt); traffic.update(dt); for (const t of tickers) t.update(dt); });
  }

  // Sinestro's palace at the avenue's end: a stepped mass of black stone. Its front (Part Six: he
  // speaks from it to the forecourt): a bronze-framed portal in the first tier between columns, his
  // banners down the face either side, braziers burning at the foot, and the balcony on the first
  // tier's roof, jutting out over the portal on corbels, a rail along its edge and a lit doorway
  // behind it into the second tier.
  buildPalace() {
    const s = this.scene, P = PALACE, stone = stoneMaterial();
    const bronze = new THREE.MeshStandardMaterial({ color: 0x6e4b22, roughness: 0.62, metalness: 0.6 }); // (rougher: bare once he's down, the low sun in it bloomed white)
        const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; s.add(m); return m; };
    const face = P.z + 25, face2 = P.z + 20; // the first and second tiers' fronts
    // the tiers, the first two with an opening cut in the front (the portal; the balcony's door) and
    // a hall going back from it: the tier built round the hole, the hall a box seen from inside,
    // inset a little so its walls hide the stone's
    const slab = (x0, x1, y0, y1, z0, z1) => add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), stone, P.x + (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const hallIn = new THREE.MeshStandardMaterial({ color: 0x2a201c, roughness: 0.85, side: THREE.BackSide });
    const holes = { 0: { x0: -3.5, x1: 3.5, y0: 0, y1: 10, depth: 14 }, 14: { x0: -2, x1: 2, y0: BALCONY.y, y1: BALCONY.y + 6, depth: 6 } };
    for (const [w, h, d, y] of [[90, 14, 50, 0], [70, 18, 40, 14], [46, 22, 30, 32], [22, 30, 18, 54]]) {
      const H = holes[y], z0 = P.z - d / 2, z1 = P.z + d / 2;
      if (!H) slab(-w / 2, w / 2, y, y + h, z0, z1);
      else {
        slab(-w / 2, H.x0, y, y + h, z0, z1);
        slab(H.x1, w / 2, y, y + h, z0, z1);
        slab(H.x0, H.x1, H.y1, y + h, z0, z1);
        if (H.y0 > y) slab(H.x0, H.x1, y, H.y0, z0, z1);
        slab(H.x0, H.x1, H.y0, H.y1, z0, z1 - H.depth);
        add(new THREE.BoxGeometry(H.x1 - H.x0 - 0.1, H.y1 - H.y0 - 0.1, H.depth), hallIn, P.x + (H.x0 + H.x1) / 2, (H.y0 + H.y1) / 2, z1 - H.depth / 2 + 0.05).castShadow = false;
      }
      this.physics.fixedBox({ x: P.x, y: y + h / 2, z: P.z }, { x: w / 2, y: h / 2, z: d / 2 });
    }
    // the portal: the opening in a stepped bronze frame, onto its dim hall (lamps down it, his
    // banner at its end), a lintel cut with the oath above it
    const farBanner = add(new THREE.PlaneGeometry(3.2, 12.8, 1, 1).translate(0, -6.4, 0), this.wallBannerMat, 0, 9.4, face - 13.9);
    farBanner.scale.set(0.9, 0.62, 1);
    for (const z of [face - 4, face - 10]) {
      const l = new THREE.PointLight(0xff9a50, 14, 9, 2);
      l.position.set(0, 7.5, z);
      s.add(l);
    }
    for (const [w, h, x, y, dz] of [[0.7, 10.6, -3.85, 5.3, 0.3], [0.7, 10.6, 3.85, 5.3, 0.3], [8.4, 0.8, 0, 10.4, 0.3], [1.1, 11.4, -4.6, 5.7, 0.15], [1.1, 11.4, 4.6, 5.7, 0.15], [10.3, 1.0, 0, 11.6, 0.15]]) add(new THREE.BoxGeometry(w, h, dz * 2), bronze, x, y, face + dz);
    const oath = document.createElement('canvas');
    oath.width = 1024; oath.height = 96;
    const og = oath.getContext('2d');
    og.fillStyle = '#2a1c0e'; og.fillRect(0, 0, 1024, 96);
    og.fillStyle = '#d8a55a'; og.font = '600 52px serif'; og.textAlign = 'center'; og.textBaseline = 'middle';
    og.fillText(toGlyphs('ORDER IS PEACE'), 512, 50);
    const ot = new THREE.CanvasTexture(oath);
    ot.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.PlaneGeometry(9.6, 0.9), new THREE.MeshStandardMaterial({ map: ot, roughness: 0.5, metalness: 0.6, emissive: 0x3a2208, emissiveMap: ot, emissiveIntensity: 0.6 }), 0, 11.6, face + 0.33);
    // columns either side of it, bronze at foot and head
    // (the columns in plain basalt, fluted by their facets: the towers' stone put windows on them)
    const colStone = new THREE.MeshStandardMaterial({ color: 0x2a282f, roughness: 0.62, metalness: 0.1, flatShading: true });
    for (const x of [-13, -7.4, 7.4, 13]) {
      add(new THREE.CylinderGeometry(0.75, 0.85, 12.4, 20).translate(0, 6.6, 0), colStone, x, 0, face + 1.6);
      add(new THREE.CylinderGeometry(1.15, 1.15, 0.6, 16), bronze, x, 0.3, face + 1.6);
      add(new THREE.CylinderGeometry(1.25, 0.9, 1.0, 16), bronze, x, 13.3, face + 1.6);
      this.physics.fixedBox({ x, y: 7, z: face + 1.6 }, { x: 0.9, y: 7, z: 0.9 });
    }
    // his banners down the face (the avenue's, longer), swaying
    for (const x of [-19, 19, -26, 26]) {
      const b = add(new THREE.PlaneGeometry(3.2, 12.8, 4, 16).translate(0, -6.4, 0), this.wallBannerMat, x, 13.6, face + 0.12);
      b.scale.set(1.25, 1.0, 1);
    }
    // the braziers: bronze bowls on stone posts, burning
    this.fires = [];
    for (const x of [-4.8, 4.8]) {
      add(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 10).translate(0, 0.75, 0), stone, x, 0, face + 4.5);
      add(new THREE.CylinderGeometry(0.9, 0.45, 0.5, 16).translate(0, 1.75, 0), bronze, x, 0, face + 4.5);
      this.physics.fixedBox({ x, y: 1, z: face + 4.5 }, { x: 0.6, y: 1, z: 0.6 });
      const fire = new Fire(V(x, 1.95, face + 4.5), { radius: 0.45, rate: 60, height: 1.1, embers: true });
      fire.light.distance = 4.2; // (warm on the portal and its columns; further, it glared green off Sinestro's suit)
      s.add(fire.group);
      this.fires.push(fire);
    }
    // the balcony: a bronze-faced slab on the first tier's roof, out over the portal on corbels
    const B = BALCONY, depth = face2 - (face + 1.6), cz = (face2 + face + 1.6) / 2;
    // (plain basalt: the towers' stone paints lit windows across anything, corbels included)
    const basalt = new THREE.MeshStandardMaterial({ color: 0x24232a, roughness: 0.7, metalness: 0.15 });
    add(new THREE.BoxGeometry(14, 1.4, depth).translate(0, -0.7, 0), basalt, B.x, B.y, cz);
    add(new THREE.BoxGeometry(14.2, 0.35, 0.3), bronze, B.x, B.y - 0.2, face + 1.62);
    for (const x of [-5.5, -1.8, 1.8, 5.5]) add(new THREE.BoxGeometry(0.7, 1.6, 1.6).translate(0, -0.8, -0.8), basalt, x, B.y - 1.4, face + 1.6);
    this.physics.fixedBox({ x: B.x, y: B.y - 0.7, z: cz }, { x: 7, y: 0.7, z: depth / 2 });
    // its rail along the front and sides
    for (let x = -6.6; x <= 6.61; x += 0.6) add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6).translate(0, 0.5, 0), bronze, x, B.y, face + 1.45);
    add(new THREE.BoxGeometry(13.4, 0.1, 0.16), bronze, 0, B.y + 1.02, face + 1.45);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.1, depth - 0.2), bronze, sx * 6.7, B.y + 1.02, cz);
    // the doorway behind it (the second tier's opening): lit, a banner at the end of its hall
    const endBanner = add(new THREE.PlaneGeometry(3.2, 12.8, 1, 1).translate(0, -6.4, 0), this.wallBannerMat, 0, B.y + 5.6, face2 - 5.85);
    endBanner.scale.set(0.7, 0.42, 1);
    for (const [w, h, x, y] of [[0.5, 6.6, -2.25, 3.3], [0.5, 6.6, 2.25, 3.3], [5, 0.6, 0, 6.3]]) add(new THREE.BoxGeometry(w, h, 0.5), bronze, x, B.y + y, face2 + 0.25);
    // his banners either side of the door, so the balcony has him against his own colours
    for (const x of [-3.5, 3.5]) {
      const b = add(new THREE.PlaneGeometry(3.2, 12.8, 4, 16).translate(0, -6.4, 0), this.wallBannerMat, x, B.y + 9.5, face2 + 0.1);
      b.scale.set(0.85, 0.72, 1);
    }
    const lamp = new THREE.PointLight(0xffa860, 26, 8.5, 2); // (the hall only: reaching the balcony it glared off his suit)
    lamp.position.set(0, B.y + 4.2, face2 - 2.5);
    s.add(lamp);
    this.updaters.push((dt, t) => { for (const f of this.fires) f.update(dt, t, this.engine.camera, this.engine.renderer); });
  }

  // The forecourt packed for his address (Part Six): the far crowd's baked figures again, up the
  // avenue from the palace, turned to the balcony, a lane left up the middle; two solid blocks so
  // nobody walks (or lands) through them.
  fillForecourt() {
    if (this.forecourt || !this.crowdKit) return this.forecourt;
    const spots = [];
    for (let z = -206.5; z < -150; z += 1.0) for (let x = -8.4; x <= 8.41; x += 0.92) {
      if (Math.abs(x) < 3.9 || rnd() < 0.3) continue; // (the lane, and the story's full figures at its edge)
      spots.push([x + (rnd() - 0.5) * 0.4, z + (rnd() - 0.5) * 0.4, 0.9 + rnd() * 0.14, rnd()]);
    }
    const face = (x, z) => Math.atan2(BALCONY.x - x, BALCONY.z - z);
    const down = this.instanceCrowd(this.crowdKit.down, spots, face), up = this.instanceCrowd(this.crowdKit.up, spots, face);
    up.visible = false;
    for (const sx of [-1, 1]) this.physics.fixedBox({ x: sx * 5.65, y: 4, z: -178 }, { x: 2.95, y: 4, z: 28.6 });
    this.forecourt = { down, up };
    this.setCheer(this.cheer.value > 0.5);
    return this.forecourt;
  }

  // A crowd's figures: one instanced mesh of a baked pose at each [x, z, scale, tint] spot, turned
  // by `face(x, z)` (a yaw) with a little scatter.
  instanceCrowd(geo, spots, face) {
    const inst = new THREE.InstancedMesh(geo, this.crowdKit.mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    spots.forEach(([x, z, k, c], i) => {
      q.setFromAxisAngle(V(0, 1, 0), face(x, z) + (rnd() - 0.5) * 0.3);
      m4.compose(V(x, 0, z), q, V(k, k, k));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i, col.setScalar(0.85 + c * 0.3));
    });
    inst.frustumCulled = false;
    this.scene.add(inst);
    return inst;
  }

  // The far crowd: hundreds more behind the front ranks, packed round the plaza. Each is the
  // low-poly Korugarian (kor_crowd.glb, Abin Sur's scan at 1,500 triangles) posed once and baked to
  // a static mesh, then instanced: standing, or (when the plaza cheers, `cheer`) with a fist up.
  // The regime's grey on them, their skin Korugar's red; a little sway each.
  buildCrowdFill() {
    const s = this.scene, gltf = this.assets?.characters?.korCrowd;
    const spots = [];
    for (let r = 21; r < PLAZA_R - 2.5; r += 1.05) {
      const n = Math.floor((Math.PI * 2 * r) / 0.92);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        if (Math.sin(a) > 0.3 && r < 30) continue; // the front (the full figures stand there) and the way Hal comes in
        if (Math.abs(Math.sin(a)) < 0.16 && Math.cos(a) > 0) continue; // the market's mouth
        if (Math.abs(Math.cos(a)) < 0.14 && Math.sin(a) > 0) continue; // the old quarter's
        if (rnd() < 0.42) continue; // (about 1,600 of them: 2.4 million triangles at most)
        spots.push([Math.cos(a) * r + (rnd() - 0.5) * 0.5, Math.sin(a) * r + (rnd() - 0.5) * 0.5, 0.9 + rnd() * 0.14, rnd()]);
      }
    }
    if (!gltf) return;
    const mat = this.crowdMaterial(gltf);
    const bake = (pose) => {
      const rig = createCharacter(gltf);
      rig.apply(makePose(pose));
      rig.root.updateMatrixWorld(true);
      const parts = [];
      for (const m of rig.meshes) {
        m.skeleton.update();
        const src = m.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3), v = new THREE.Vector3();
        for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', src.attributes.uv);
        g.setIndex(src.index);
        g.computeVertexNormals();
        parts.push(g);
      }
      return parts[0];
    };
    const down = bake({ aL: [0.12, -1, 0.04], eL: 0.15, aR: [-0.12, -1, 0.04], eR: 0.15 });
    const up = bake({ aL: [0.12, -1, 0.04], eL: 0.15, aR: [-0.3, 0.92, 0.25], eR: 0.35, nx: -0.1 });
    this.crowdKit = { down, up, mat };
    const make = (geo) => this.instanceCrowd(geo, spots, (x, z) => Math.atan2(-x, -z));
    this.crowdDown = make(down);
    this.crowdUp = make(up);
    this.crowdUp.visible = false;
  }

  setCheer(on) {
    this.cheer.value = on ? 1 : 0;
    if (this.crowdDown) { this.crowdDown.visible = !on; this.crowdUp.visible = on; }
    if (this.forecourt) { this.forecourt.down.visible = !on; this.forecourt.up.visible = on; }
  }

  // The crowd's look: the scan's texture with its uniform's green turned to the regime's grey and its
  // skin to Korugar's red, swaying a little (and bobbing while they cheer).
  crowdMaterial(gltf) {
    let map = null;
    gltf.scene.traverse((o) => { if (o.isMesh && !map) map = o.material.map; });
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0.05 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.time;
      sh.uniforms.uCheer = this.cheer;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uCheer;').replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float cp = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
          transformed.x += sin(uTime * 1.1 + cp) * 0.025 * transformed.y;
          transformed.y += uCheer * max(0.0, sin(uTime * 5.0 + cp)) * 0.08;
        #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          float green = smoothstep(0.1, 0.3, (c.g - max(c.r, c.b)) / max(c.g, 0.01));
          float skin = smoothstep(0.02, 0.08, c.r - max(c.g, c.b));
          vec3 garb = mix(vec3(0.3, 0.31, 0.36), vec3(0.16, 0.16, 0.19), green) * clamp(0.5 + lum * 2.2, 0.4, 1.3);
          vec3 kor = vec3(0.62, 0.14, 0.09) * clamp(lum * 2.6, 0.2, 1.4);
          diffuseColor.rgb = mix(garb, kor, skin);
        }`);
    };
    mat.customProgramCacheKey = () => 'korugar-crowd2';
    return mat;
  }

  // Night (Part Six: Katma's first night, and the Yellow Lantern's return), or back to day: a violet
  // sky with a moon and stars, the light from the city itself (its windows, his screens, the lamps).
  night(on = true) {
    if (!!this.isNight === on) return;
    this.isNight = on;
    const s = this.scene;
    this.day ??= { fog: s.fog.color.getHex(), density: s.fog.density, hemi: [this.hemi.color.getHex(), this.hemi.groundColor.getHex(), this.hemi.intensity], sun: [this.sun.color.getHex(), this.sun.intensity], env: s.environmentIntensity, exposure: s.userData.exposure };
    s.remove(this.sky);
    this.sky = createSky(on ? 'korugarNight' : 'korugar', 900);
    s.add(this.sky);
    const d = this.day;
    s.fog.color.set(on ? 0x150e1e : d.fog);
    s.fog.density = on ? 0.0036 : d.density;
    this.hemi.color.set(on ? 0x56507e : d.hemi[0]);
    this.hemi.groundColor.set(on ? 0x2c1a1a : d.hemi[1]);
    this.hemi.intensity = on ? 0.42 : d.hemi[2];
    this.sun.color.set(on ? 0xb4bcff : d.sun[0]);
    this.sun.intensity = on ? 0.5 : d.sun[1];
    s.environmentIntensity = on ? 0.14 : d.env;
    s.userData.exposure = on ? 1.1 : d.exposure;
    STONE_NIGHT.value = on ? 1 : 0;
    // the statue’s pale stone, lit only by the lamps and the screens (0.2 in linear terms: about 0.45 of it)
    this.statue?.traverse((o) => { if (!o.isMesh) return; for (const m of [o.material].flat()) { m.userData.day ??= m.color.getHex(); m.color.setHex(m.userData.day).multiplyScalar(on ? 0.2 : 1); } });
    this.focus(this.sun.target.position);
  }

  // The statue brought down (Part Six): k from 0 to 1 tips him forward about his toes on the
  // pedestal's front (the pull, all of him as one); `statueFall()` lets him go: the ankles crack, the
  // feet settle back, and the rest of him topples off the pedestal under its own weight (Statue.js's
  // simulation), the head breaking off as it nears the plaza and rolling on; `fallen()` puts him
  // where that simulation leaves him (free roam, after: the same fall run to its end at once).
  statueTilt(k) {
    const fig = this.fig;
    if (!fig) return;
    const a = 0.3 * k;
    for (const part of Object.values(fig.parts)) {
      part.rotation.set(a, 0, 0);
      part.position.copy(this.statueRest).sub(TOES).applyAxisAngle(_X, a).add(TOES);
    }
  }

  // The simulation from the pose the pull leaves him in. `onEvent(name, data)`: 'crack', 'head',
  // 'impact' ({ at, k }), 'settled'.
  statueSim(onEvent) {
    return new StatueFall(this.fig, {
      pedestal: [[9.2, 0, 0.8], [7.6, 0.8, 1.6], [6.0, 1.6, 2.4], [4.5, 2.4, 5.95], [4.8, 5.95, PEDESTAL_TOP]],
      pivot: TOES, rest: this.statueRest, angle: this.fig.parts.body.rotation.x, scale: STATUE_SCALE,
      onEvent,
    });
  }

  async statueFall({ onEvent } = {}) {
    const fig = this.fig;
    if (!fig) return;
    for (const c of this.statueCols ?? []) this.physics.world.removeRigidBody(c);
    this.statueCols = [];
    const feet = fig.parts.feet, f0 = feet.position.clone(), a0 = feet.rotation.x;
    const sim = (this.sim = this.statueSim((name, data) => {
      // the feet broken off: back down flat on the cap
      if (name === 'crack') tween(0.22, (k) => { feet.rotation.x = a0 * (1 - ease.in(k)); feet.position.lerpVectors(f0, this.statueRest, ease.in(k)); });
      onEvent?.(name, data);
    }));
    const stop = onFrame((dt) => sim.step(dt));
    await waitFor(() => sim.done);
    stop();
    this.laid();
  }

  fallen() {
    if (!this.fig || this.isDown) return;
    this.statueTilt(1);
    const sim = this.statueSim(null);
    sim.settle();
    this.fig.parts.feet.rotation.set(0, 0, 0);
    this.fig.parts.feet.position.copy(this.statueRest);
    this.laid(sim);
  }

  // Down: solid where he lies; the circles to walk round (`fallenBlocks`: along him and his head).
  laid(sim = this.sim) {
    this.isDown = true;
    sim?.dispose();
    this.sim = null;
    this.statueSolid();
    const P = this.fig.parts, j = this.fig.joints, at = (part, n) => j[n].clone().applyMatrix4(part.matrixWorld);
    for (const part of Object.values(P)) part.updateMatrixWorld(true);
    const a = at(P.body, 'foot_L').lerp(at(P.body, 'foot_R'), 0.5), b = at(P.body, 'neck'), h = at(P.head, 'head');
    this.fallenBlocks = [0.15, 0.5, 0.85].map((t) => { const p = a.clone().lerp(b, t); return { x: p.x, z: p.z, r: 2.4 }; });
    this.fallenBlocks.push({ x: h.x, z: h.z, r: 1.6 });
  }

  // Flight over the capital: inside its towers' ring, under the haze.
  airBounds() {
    return { ground: () => 0, floor: () => 0, canLand: (x, z) => Math.hypot(x, z) < 240, center: V(0, 0, 0), radius: 280, ceiling: 160 };
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    this.smash.update(dt, t, camera, renderer);
    this.time.value = t;
    this.sky.position.copy(camera.position);
    this.sky.userData.uniforms.uTime.value = t;
    for (const b of this.bars ?? []) b.material.opacity = 0.7 + 0.15 * Math.sin(t * 9 + b.position.x);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}

// a fixed cylinder's collider (Rapier's own: fine for something that's flown round, not walked on)
function RAPIER_CYL(r, halfH) { return RAPIER.ColliderDesc.cylinder(halfH, r); }
