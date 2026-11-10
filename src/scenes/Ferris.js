import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Physics } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { Particles } from '../fx/Particles.js';
import { noiseTexture, pbrMaterial } from '../fx/Textures.js';
import { prop, piece, meshes, boundsIn } from '../props/Props.js';
import { makeCar } from '../props/Car.js';

// Ferris Aircraft, mid-morning: the airfield in the desert outside Coast City where Martin Jordan
// flew (the dream's airfield, in daylight, twenty years on). North to south: the runway, a taxiway,
// the apron with the prototype parked on it, three hangars with their doors open onto the apron, the
// staff lot behind them, the gate, and the access road running south to the highway. Far down the
// road, out of sight, the lot behind Hal's apartment building, where his car is parked.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _d = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export const JET_SPOT = V(14, 0, -26); // the prototype on the apron, nose to the east
export const CAROL_SPOT = V(19.5, 0, -20.5);
export const CAR_SPOT = V(36, 0, 54); // Hal's space in the staff lot, nose to the north
export const GATE = V(4, 0, 112);
export const LOT = V(0, 0, 6000); // behind the apartment building (Hal's car)
const RUNWAY_Z = -150;
const HANGARS = [{ x: -62, n: '1' }, { x: 0, n: '2' }, { x: 62, n: '3' }];
const HANGAR = { w: 54, d: 30, h: 15, z0: 8 }; // doors on the north face (z0), facing the apron
// the downloaded models the scene uses (src/props, CREDITS.md): load them before build()
export const FERRIS_PROPS = ['phoenix', 'fairheaven', 'negotiator', 'sialia', 'fairheaven_sw', 'prototype', 'palms', 'apartment', 'stand', 'fueltruck', 'tug', 'cones', 'toolbox', 'drums', 'forklift',
  'office1', 'office2', 'office3', 'office4', 'office5', 'office6', 'cityprops', 'busstop', 'billboard', 'booth'];
// the street kit's pieces (cityprops), by part name
export const KIT = {
  mast: /low_poly_metal_street_props_0$/, signal: /low_poly011_/, lamp: /low_poly012_/, sign: /low_poly008_/, stop: /low_poly005_/,
  hydrant: /low_poly002_/, bin: /low_poly001_/, can: /low_poly007_/, dumpster: /low_poly006_/,
};
const PALMS = [/^Palm_tree_001/, /^Palm_tree_002/]; // the two trees in the palms model
export const BOULEVARD = { x0: 2, x1: 10, z0: -24, z1: -440, cross: -210 }; // in the lot's frame (LOT): the road out of town

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, repeat) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
};
// A flat patch of ground (w across x, d along z), cut into tiles no bigger than `tile` metres. One
// pair of triangles kilometres across loses its depth to float error where it's clipped at the
// near plane: the desert came up through the asphalt laid 3 cm over it, and swapped with it from
// frame to frame (the flicker on the roads and lots).
const flat = (w, d, tile = 25) => new THREE.PlaneGeometry(w, d, Math.ceil(w / tile), Math.ceil(d / tile)).rotateX(-Math.PI / 2);

export class Ferris {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0xd5dde2, 0.00042);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.4;
    s.userData.exposure = 0.82;
    s.userData.far = 2400;
    s.userData.near = 0.1; // outdoors, no shot is closer: 3x the depth precision of the default 3 cm
    this.sky = createSky('desert', 1500);
    s.add(this.sky);
    this.buildLight();
    this.buildGround();
    this.buildRunway();
    this.buildHangars();
    this.buildTower();
    this.buildOffice();
    this.buildRoad();
    this.buildMesas();
    this.jet = prop('prototype');
    this.jet.position.copy(JET_SPOT);
    this.jet.rotation.y = Math.PI / 2;
    s.add(this.jet);
    this.solid(this.jet, /Fuselage|Wing|Keel|Stabilizer|Nozzle|Gear/);
    this.buildApronProps();
    this.buildStaffLot();
    this.buildApartmentLot();
    this.buildCity();
    // Hal's car: sun-faded maroon, the driver's door in primer
    this.car = makeCar('phoenix', { paint: 0x5a1d19, primer: true, dust: 0.7 });
    this.car.position.copy(CAR_SPOT);
    s.add(this.car);
    this.carBox = this.physics.fixedBox({ x: CAR_SPOT.x, y: 0.65, z: CAR_SPOT.z }, { x: 0.93, y: 0.65, z: 2.45 }); // the body, not the mirrors
    this.exhaust = new Particles(300, { additive: false, puffy: true, drag: 0.8, turbulence: 0.4 });
    s.add(this.exhaust.points);
    return this;
  }

  // ------------------------------------------------------------------------------------- light
  buildLight() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xc6d8ec, 0x8c7458, 0.55);
    s.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffeed6, 2.7));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    this.focus(V(10, 0, -10));
  }

  // Keep the sun's shadow box on the action. The box moves in whole shadow texels across the light:
  // slid smoothly after a moving car, every shadow in it crawled and shimmered along its edges.
  focus(at) {
    const sun = this.sun, cam = sun.shadow.camera, d = _d.copy(this.sky.userData.uniforms.uSunDir.value).normalize();
    const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
    _x.crossVectors(_up, d).normalize(); // the shadow camera's own axes (it looks down -d, up +Y)
    _y.crossVectors(d, _x);
    const snap = (v) => Math.round(v / texel) * texel;
    sun.target.position.copy(_x).multiplyScalar(snap(at.dot(_x))).addScaledVector(_y, snap(at.dot(_y))).addScaledVector(d, at.dot(d));
    sun.position.copy(sun.target.position).addScaledVector(d, 120);
    sun.target.updateMatrixWorld();
  }

  // The shadow box's half-width (45 m by default): wider for a shot whose view is bigger than that,
  // so the box can stay put instead of chasing the car (softer shadows, none popping in at its edge).
  shadowSpan(half = 45) {
    Object.assign(this.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------------------------- ground
  buildGround() {
    const s = this.scene;
    // desert: pale sand, scrubby patches, tyre-worn dirt near the buildings
    const sand = pbrMaterial('gravelly_sand', { repeat: [5300, 5300], tint: new THREE.Color(1.15, 1.08, 1.0), normalScale: 0.8 });
    // large-scale variation, by world position: patches of redder hardpan and pale wash, darker
    // where the scrub grows thick, so the flats don't read as one tiled colour
    sand.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGw = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 vGw;
        float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gH(i), gH(i + vec2(1, 0)), f.x), mix(gH(i + vec2(0, 1)), gH(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        float gA = gN(vGw / 90.0) * 0.6 + gN(vGw / 23.0) * 0.3 + gN(vGw / 6.0) * 0.1;
        float gB = gN(vGw / 41.0 + 7.3);
        diffuseColor.rgb *= mix(vec3(1.08, 1.02, 0.94), vec3(0.86, 0.7, 0.58), smoothstep(0.45, 0.75, gA));
        diffuseColor.rgb *= mix(1.0, 0.82, smoothstep(0.6, 0.85, gB));
        diffuseColor.rgb *= 0.9 + 0.12 * gN(vGw * 1.7) + 0.08 * gN(vGw * 9.0);`);
    };
    const ground = new THREE.Mesh(flat(16000, 16000, 125), sand);
    ground.position.set(0, -0.03, 3000);
    ground.receiveShadow = true;
    s.add(ground);
    // (a heightfield, not a box: Hal sank into a box this size as soon as he walked, and stuck)
    this.physics.fixedGround(600);
    // concrete: the apron, and the lot behind the hangars
    const [c, g] = canvas(1024);
    g.fillStyle = '#aaa69c';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,36,30'},${rnd() * 0.05})`; g.beginPath(); g.arc(rnd() * 1024, rnd() * 1024, 2 + rnd() * 26, 0, 7); g.fill(); }
    // oil stains, and the joints between slabs (a 6 m grid at this scale)
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(30,26,22,${0.05 + rnd() * 0.08})`; g.beginPath(); g.ellipse(rnd() * 1024, rnd() * 1024, 10 + rnd() * 40, 6 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(40,36,32,0.55)';
    g.lineWidth = 2;
    for (let k = 0; k <= 1024; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 1024); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(1024, k); g.stroke(); }
    const canvasTex = tex(c, [1, 1]);
    const slab = (x0, x1, z0, z1) => {
      const map = canvasTex.clone();
      map.repeat.set((x1 - x0) / 48, (z1 - z0) / 48);
      map.needsUpdate = true;
      const m = new THREE.Mesh(flat(x1 - x0, z1 - z0), pbrMaterial('concrete_floor_02', { map, detailRepeat: [(x1 - x0) / 3, (z1 - z0) / 3], roughness: 0.95 }));
      m.position.set((x0 + x1) / 2, 0.005, (z0 + z1) / 2);
      m.receiveShadow = true;
      s.add(m);
    };
    slab(-100, 100, -75, 8);
    slab(-40, 70, 40, 84);
    // the staff lot's painted bays
    const paint = new THREE.MeshBasicMaterial({ color: 0xe8e4da });
    for (let x = -36; x <= 66; x += 3) {
      for (const z of [48, 72]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5).rotateX(-Math.PI / 2), paint);
        l.position.set(x - 1.5, 0.02, z + (z < 60 ? 3 : -3));
        s.add(l);
      }
    }
    // scrub: low grey-green bushes scattered over the desert, thinning near the field
    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    bushGeo.scale(1, 0.55, 1);
    const pos = bushGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + rnd() * 0.4), pos.getY(i) * (0.8 + rnd() * 0.4), pos.getZ(i) * (0.8 + rnd() * 0.4));
    bushGeo.computeVertexNormals();
    const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x7d7f5c, roughness: 1, flatShading: true }), 2400);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < 6000 && n < 2400; i++) {
      const x = (rnd() - 0.5) * 2400, z = -1000 + rnd() * 7400;
      if (x > -160 && x < 160 && z > -200 && z < 130) continue; // the field
      if (Math.abs(x - 6) < 14 && z > 100) continue; // the road
      if (z > LOT.z - 480 && z < LOT.z + 320 && Math.abs(x) < 260) continue; // the lot and the city round it
      const r = 0.3 + rnd() * rnd() * 1.4;
      m4.compose(p.set(x, r * 0.25, z), q.setFromAxisAngle(V(0, 1, 0), rnd() * 6), sc.set(r, r, r));
      bushes.setMatrixAt(n, m4);
      bushes.setColorAt(n, col.setHSL(0.17 + rnd() * 0.06, 0.15 + rnd() * 0.1, 0.32 + rnd() * 0.12));
      n++;
    }
    bushes.count = n;
    bushes.castShadow = true;
    s.add(bushes);
  }

  buildRunway() {
    const s = this.scene;
    const [c, g] = canvas(256, 2048);
    g.fillStyle = '#4a4845';
    g.fillRect(0, 0, 256, 2048);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 2048, 2 + rnd() * 6, 2 + rnd() * 10); }
    // tyre marks down the middle
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(20,18,16,${0.08 + rnd() * 0.12})`; g.fillRect(100 + rnd() * 56, rnd() * 2048, 3 + rnd() * 4, 60 + rnd() * 200); }
    g.fillStyle = '#e6e2d6';
    for (let y = 0; y < 2048; y += 128) g.fillRect(124, y, 8, 64); // centre line
    g.fillRect(8, 0, 4, 2048); g.fillRect(244, 0, 4, 2048); // edges
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(45, 1800, 2, 72).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), pbrMaterial('asphalt_02', { map: tex(c), detailRepeat: [15, 600] }));
    runway.position.set(0, 0.01, RUNWAY_Z);
    runway.receiveShadow = true;
    s.add(runway);
    // the taxiway joining the apron to the runway, its yellow centre line
    const tz0 = -75, tz1 = RUNWAY_Z + 22.5, tlen = tz0 - tz1;
    const twy = new THREE.Mesh(flat(22, tlen), new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.9 }));
    twy.position.set(-20, 0.008, (tz0 + tz1) / 2);
    twy.receiveShadow = true;
    s.add(twy);
    const tl = new THREE.Mesh(flat(0.3, tlen), new THREE.MeshBasicMaterial({ color: 0xd8b23a }));
    tl.position.set(-20, 0.022, twy.position.z);
    s.add(tl);
    // runway edge lights
    const lightGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8);
    const lm = new THREE.InstancedMesh(lightGeo, new THREE.MeshStandardMaterial({ color: 0xd9d4c4, emissive: 0x554422, roughness: 0.4 }), 120);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let x = -880; x <= 880; x += 30) for (const z of [RUNWAY_Z - 24, RUNWAY_Z + 24]) { m4.makeTranslation(x, 0.2, z); lm.setMatrixAt(k++, m4); }
    lm.count = k;
    s.add(lm);
  }

  // Three steel hangars: corrugated walls, a shallow roof, the company name across the front, and
  // the great doors slid open onto the apron. Hangar Two has the work lights on.
  buildHangars() {
    const s = this.scene, { w, d, h, z0 } = HANGAR;
    // corrugated iron (ribs about 11 cm apart, a 1.4 m sheet), painted a pale warm grey
    const wallMat = (rx, ry) => pbrMaterial('corrugated_iron_02', { repeat: [rx * 5, ry * h / 1.4], tint: new THREE.Color(2.3, 2.25, 2.15), metalness: 0.35, roughness: 0.9 });
    const roofMat = pbrMaterial('corrugated_iron_02', { repeat: [d / 1.4, w / 2.8], tint: new THREE.Color(1.6, 1.58, 1.55), metalness: 0.4 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x3d4046, roughness: 0.5, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, metalness: 0.2 }); // the inside of the back wall
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.35, metalness: 0.1 });
    for (const H of HANGARS) {
      const gx = new THREE.Group();
      gx.position.set(H.x, 0, z0);
      s.add(gx);
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; gx.add(m); return m; };
      // back and side walls (the front is open but for its frame)
      add(new THREE.BoxGeometry(w, h, 0.4), wallMat(w / 7, 1), 0, h / 2, d);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.4, h, d), wallMat(d / 7, 1), sx * w / 2, h / 2, d / 2);
      // the roof: two shallow pitches, and the front gable above the door opening
      const rise = 2.6;
      for (const sx of [-1, 1]) {
        const r = add(new THREE.BoxGeometry(Math.hypot(w / 2, rise) + 0.6, 0.35, d + 0.8), roofMat, sx * w / 4, h + rise / 2, d / 2);
        r.rotation.z = -sx * Math.atan2(rise, w / 2);
      }
      const gable = new THREE.Shape();
      gable.moveTo(-w / 2, 0); gable.lineTo(w / 2, 0); gable.lineTo(w / 2, 3); gable.lineTo(0, 3 + rise); gable.lineTo(-w / 2, 3); gable.closePath();
      add(new THREE.ExtrudeGeometry(gable, { depth: 0.4, bevelEnabled: false }), wallMat(w / 7, 0.4), 0, h - 3, -0.2);
      // door frame and the doors slid back behind the side walls
      add(new THREE.BoxGeometry(w + 0.6, 0.8, 0.8), trim, 0, h - 3.2, 0);
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(0.8, h - 3, 0.8), trim, sx * (w / 2 - 0.1), (h - 3) / 2, 0);
        add(new THREE.BoxGeometry(10, h - 3.4, 0.25), wallMat(10 / 7, 1), sx * (w / 2 - 5.6), (h - 3.4) / 2, 0.9);
      }
      // inside: a dark interior, a polished floor, roof trusses
      add(flat(w - 0.4, d), floorMat, 0, 0.02, d / 2);
      add(new THREE.BoxGeometry(w - 1, h - 0.5, 0.1), dark, 0, h / 2, d - 0.3);
      for (let z = 3; z < d; z += 5) add(new THREE.BoxGeometry(w - 1, 0.5, 0.3), trim, 0, h - 0.6, z);
      // the name, and the hangar's number
      const [nc, ng] = canvas(1024, 160);
      ng.clearRect(0, 0, 1024, 160);
      ng.fillStyle = '#a3191b';
      ng.font = '900 96px "Arial Black", Arial, sans-serif';
      ng.textAlign = 'center';
      ng.fillText('FERRIS AIRCRAFT', 512, 110);
      const name = new THREE.Mesh(new THREE.PlaneGeometry(26, 4), new THREE.MeshStandardMaterial({ map: tex(nc), transparent: true, roughness: 0.6 }));
      name.position.set(0, h + 0.4, -0.45);
      name.rotation.y = Math.PI;
      gx.add(name);
      const [kc, kg] = canvas(256);
      kg.fillStyle = '#e8e4da'; kg.beginPath(); kg.arc(128, 128, 120, 0, 7); kg.fill();
      kg.fillStyle = '#23262b'; kg.font = '900 170px Arial, sans-serif'; kg.textAlign = 'center'; kg.fillText(H.n, 128, 188);
      const num = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.MeshStandardMaterial({ map: tex(kc), roughness: 0.6 }));
      num.position.set(w / 2 - 4, h - 1.6, -0.45);
      num.rotation.y = Math.PI;
      gx.add(num);
      // a dark dado round the foot, a red stripe above it, a band of clerestory glass under the eaves
      const band = (y, hh, mat, out = 0.06) => {
        add(new THREE.BoxGeometry(w + out * 2, hh, 0.08), mat, 0, y, d + 0.24);
        for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.08, hh, d + out * 2), mat, sx * (w / 2 + 0.24), y, d / 2);
      };
      band(0.7, 1.4, new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.7, metalness: 0.3 }));
      band(1.55, 0.3, new THREE.MeshStandardMaterial({ color: 0xa3191b, roughness: 0.5 }));
      band(h - 1.4, 1.1, new THREE.MeshStandardMaterial({ color: 0x2a3640, metalness: 0.8, roughness: 0.12 }));
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.5, d + 1.2), trim, sx * (w / 2 + 0.1), h + 0.15, d / 2); // eaves
      for (const sx of [-1, 1]) for (const z of [2, d - 2]) add(new THREE.CylinderGeometry(0.09, 0.09, h, 8), trim, sx * (w / 2 + 0.32), h / 2, z); // downpipes
      // colliders: walls only (walk in under the open front)
      this.physics.fixedBox({ x: H.x, y: h / 2, z: z0 + d }, { x: w / 2, y: h / 2, z: 0.3 });
      for (const sx of [-1, 1]) this.physics.fixedBox({ x: H.x + sx * w / 2, y: h / 2, z: z0 + d / 2 }, { x: 0.3, y: h / 2, z: d / 2 });
      if (H.n === '2') {
        // a second airframe inside, its canopy off, under work lights
        const shell = prop('prototype');
        shell.position.set(-6, 0, d / 2 + 2);
        shell.rotation.y = Math.PI / 2 + 0.3;
        for (const m of meshes(shell, (n) => /Cabin_Glass/.test(n))) m.visible = false;
        gx.add(shell);
        for (const x of [-14, 0, 14]) {
          const lamp = new THREE.PointLight(0xfff0d8, 30, 26, 2);
          lamp.position.set(x, h - 2, d / 2);
          gx.add(lamp);
          add(new THREE.BoxGeometry(1.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.9) }), x, h - 1.2, d / 2);
        }
        // tool chests, drums, the forklift, a work stand at the cockpit
        const place = (name, x, z, r) => { const o = prop(name); o.position.set(x, 0, z); o.rotation.y = r; gx.add(o); return o; };
        place('toolbox', 8, 6, 0.3);
        place('toolbox', 11, 9.5, -0.2 + Math.PI);
        place('drums', -19, 25, 0.6);
        place('forklift', 15, 22, -2.2);
        place('stand', 0.5, d / 2 - 1.2, 0.3);
      }
    }
  }

  buildTower() {
    const s = this.scene, g = new THREE.Group();
    g.position.set(-128, 0, -16);
    s.add(g);
    const concrete = pbrMaterial('white_plaster_02', { repeat: [4, 8], tint: new THREE.Color(1.25, 1.18, 1.08) });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a46, metalness: 0.9, roughness: 0.08 });
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(9, 4, 9), concrete, 2);
    add(new THREE.CylinderGeometry(2.4, 2.8, 22, 8), concrete, 13);
    add(new THREE.CylinderGeometry(5.2, 4.2, 1.2, 8), concrete, 24.4);
    add(new THREE.CylinderGeometry(5.0, 4.4, 3.4, 8, 1, true), glass, 26.6);
    add(new THREE.CylinderGeometry(5.6, 5.6, 0.6, 8), concrete, 28.6);
    add(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0x777777 }), 31.9);
    const beacon = add(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2) }), 35);
    this.beacon = beacon;
    this.physics.fixedBox({ x: -128, y: 13, z: -16 }, { x: 4.5, y: 13, z: 4.5 });
  }

  buildOffice() {
    const s = this.scene, g = new THREE.Group();
    g.position.set(98, 0, 62);
    s.add(g);
    const wall = pbrMaterial('white_plaster_02', { repeat: [10, 3], tint: new THREE.Color(1.3, 1.25, 1.15) });
    const glass = new THREE.MeshStandardMaterial({ color: 0x31414c, metalness: 0.85, roughness: 0.1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 18), wall);
    body.position.y = 4;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    for (const y of [2.2, 6.0]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(32, 1.8, 18.2), glass);
      band.position.y = y;
      g.add(band);
    }
    const [nc, ng] = canvas(1024, 160);
    ng.fillStyle = '#a3191b'; ng.font = '900 110px "Arial Black", Arial, sans-serif'; ng.textAlign = 'center'; ng.fillText('FERRIS', 512, 120);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshStandardMaterial({ map: tex(nc), transparent: true }));
    sign.position.set(0, 8.9, -9.2);
    sign.rotation.y = Math.PI;
    g.add(sign);
    this.physics.fixedBox({ x: 98, y: 4, z: 62 }, { x: 17, y: 4, z: 9 });
  }

  // The access road south to the highway, the gate and its sign, power poles; the road ends at
  // Hal's building far down (out of sight from the field).
  buildRoad() {
    const s = this.scene;
    const [c, g] = canvas(128, 1024);
    g.fillStyle = '#4d4a46'; g.fillRect(0, 0, 128, 1024);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`; g.fillRect(rnd() * 128, rnd() * 1024, 2 + rnd() * 4, 2 + rnd() * 8); }
    g.fillStyle = '#d9b23e'; for (let y = 0; y < 1024; y += 64) g.fillRect(61, y, 6, 34);
    g.fillStyle = '#dcd8cc'; g.fillRect(4, 0, 3, 1024); g.fillRect(121, 0, 3, 1024);
    const roadTex = tex(c);
    roadTex.wrapT = THREE.RepeatWrapping;
    const len = LOT.z - 14 - 80; // to the north edge of the apartment lot
    roadTex.repeat.set(1, len / 40);
    const road = new THREE.Mesh(flat(8, len), pbrMaterial('asphalt_02', { map: roadTex, detailRepeat: [2.7, len / 3] }));
    road.position.set(6, 0.012, 80 + len / 2);
    road.receiveShadow = true;
    s.add(road);
    // power poles down the east side
    const pole = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 });
    const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 10, 6).translate(0, 5, 0), armGeo = new THREE.BoxGeometry(2.2, 0.14, 0.14);
    const n = Math.floor(len / 55);
    const poles = new THREE.InstancedMesh(poleGeo, pole, n), arms = new THREE.InstancedMesh(armGeo, pole, n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(13, 0, 130 + i * 55); poles.setMatrixAt(i, m4); m4.makeTranslation(13, 9.4, 130 + i * 55); arms.setMatrixAt(i, m4); }
    poles.castShadow = true;
    s.add(poles, arms);
    // the gate: a guard booth with its barrier raised, the company's sign on a low wall
    const booth = prop('booth');
    booth.position.copy(GATE).add(V(-6.9, 0, 0.5));
    s.add(booth);
    this.physics.fixedBox({ x: booth.position.x - 1, y: 1.3, z: booth.position.z }, { x: 1.6, y: 1.3, z: 1.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.7 });
    const [sc, sg] = canvas(1024, 256);
    sg.fillStyle = '#ece7dc'; sg.fillRect(0, 0, 1024, 256);
    sg.fillStyle = '#a3191b'; sg.font = '900 112px "Arial Black", Arial, sans-serif'; sg.textAlign = 'center'; sg.fillText('FERRIS AIRCRAFT', 512, 140);
    sg.fillStyle = '#3a3c40'; sg.font = '600 40px Arial, sans-serif'; sg.fillText('EST. 1947  ·  AUTHORIZED PERSONNEL ONLY', 512, 210);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 0.6), white);
    wall.position.set(GATE.x - 16, 1, GATE.z + 6);
    wall.rotation.y = -0.4;
    wall.castShadow = true;
    s.add(wall);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 2.2), new THREE.MeshStandardMaterial({ map: tex(sc), roughness: 0.7 }));
    face.position.set(0, 0.1, 0.31);
    wall.add(face);
    // a chain-link fence along the field's south side, with the gate in it
    // the wire: a diamond mesh, cut out (it fades to a haze where it's finer than a pixel)
    const [wc, wg] = canvas(64);
    wg.clearRect(0, 0, 64, 64);
    wg.strokeStyle = 'rgba(170,174,178,1)';
    wg.lineWidth = 3;
    wg.beginPath(); wg.moveTo(0, 32); wg.lineTo(32, 0); wg.lineTo(64, 32); wg.lineTo(32, 64); wg.closePath(); wg.stroke();
    const wire = tex(wc);
    wire.wrapS = wire.wrapT = THREE.RepeatWrapping;
    for (const [x0, x1] of [[-170, GATE.x - 8], [GATE.x + 6, 170]]) {
      // (alpha to coverage: the wire's cut-out edges are smoothed by the MSAA instead of crawling)
      const mat = new THREE.MeshStandardMaterial({ map: wire.clone(), metalness: 0.6, roughness: 0.45, alphaTest: 0.25, alphaToCoverage: true, side: THREE.DoubleSide });
      mat.map.repeat.set((x1 - x0) / 0.12, 2.2 / 0.12);
      mat.map.needsUpdate = true;
      const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.2), mat);
      f.position.set((x0 + x1) / 2, 1.1, GATE.z - 4);
      s.add(f);
    }
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6);
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x8b8e92, metalness: 0.6 }), 120);
    let k = 0;
    for (let x = -170; x <= 170 && k < 120; x += 3) { if (x > GATE.x - 8 && x < GATE.x + 6) continue; m4.makeTranslation(x, 1.15, GATE.z - 4); posts.setMatrixAt(k++, m4); }
    posts.count = k;
    s.add(posts);
  }

  buildMesas() {
    const s = this.scene;
    const mat = new THREE.MeshStandardMaterial({ color: 0xa8775a, roughness: 1, flatShading: true });
    // on the horizon all round, never near the field or the road
    for (let i = 0, made = 0; i < 200 && made < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 1100 + rnd() * 900;
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 1200;
      if (Math.hypot(x, z) < 1000 || (Math.abs(x - 6) < 500 && z > -200 && z < LOT.z + 300)) continue;
      made++;
      const top = 40 + rnd() * 120, h = 40 + rnd() * 110;
      const geo = new THREE.CylinderGeometry(top, top * (1.4 + rnd() * 0.6), h, 9, 3);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) p.setXYZ(j, p.getX(j) * (0.85 + rnd() * 0.3), p.getY(j), p.getZ(j) * (0.85 + rnd() * 0.3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, h / 2 - 2, z);
      s.add(m);
    }
  }

  // Around the prototype: the access stand at the cockpit, the tug at its nose, the fuel truck, a
  // tool chest and cones; it was ready to fly at nine.
  buildApronProps() {
    const s = this.scene, J = JET_SPOT;
    const place = (name, x, z, r, solid = true) => {
      const o = prop(name);
      o.position.set(J.x + x, 0, J.z + z);
      o.rotation.y = r;
      s.add(o);
      if (solid) { const b = boundsIn(s, meshes(o, () => true)), c = b.getCenter(V(0, 0, 0)), h = b.getSize(V(0, 0, 0)).multiplyScalar(0.5); this.physics.fixedBox({ x: c.x, y: h.y, z: c.z }, { x: h.x * 0.9, y: h.y, z: h.z * 0.9 }); }
      return o;
    };
    // (the jet's nose is east, +x; its right side, the one Carol stands on, is south, +z)
    place('stand', 4.4, 2.3, Math.PI);
    place('tug', 12.6, 0, -Math.PI / 2);
    place('fueltruck', -12, 12.5, 0.35 - Math.PI / 2);
    place('toolbox', 1.5, 4.4, 0.2);
    place('cones', -16, -14, 0.5);
    // cones at the wingtips and the tail: one cone out of the pack, moved to stand at its origin
    const pack = prop('cones');
    pack.updateMatrixWorld(true);
    const src = meshes(pack, (n) => /^Traffic_Cone_2_1001/.test(n))[0];
    const cb = boundsIn(pack, [src]), cc = cb.getCenter(V(0, 0, 0));
    const at = new THREE.Matrix4().makeTranslation(-cc.x, -cb.min.y, -cc.z).multiply(src.matrixWorld);
    for (const [x, z, r] of [[-1.5, 7.6, 0.3], [-1.5, -7.6, 1.2], [-10.6, 0, 2.1]]) {
      const cone = new THREE.Mesh(src.geometry, src.material);
      cone.castShadow = true;
      cone.matrixAutoUpdate = false;
      cone.matrix.makeRotationY(r).setPosition(J.x + x, 0, J.z + z).multiply(at);
      s.add(cone);
    }
  }

  // The staff lot behind the hangars: the day shift's cars nose to the hangars, in the painted bays,
  // the mouth of the aisle off the road left clear (Hal drives in that way: Coast.drive).
  buildStaffLot() {
    const cars = [[18, 51, 'negotiator', 0x8f8a80], [24, 51, 'fairheaven', 0xb9b2a1], [30, 51, 'sialia', 0x3b5b74], [45, 51, 'fairheaven_sw', 0x5b6f52],
      [51, 51, 'negotiator', 0x2c2f35], [15, 69, 'fairheaven', 0x7a1f1c], [27, 69, 'fairheaven_sw', 0xc8c2b2], [39, 69, 'sialia', 0xd6d0c0], [57, 69, 'fairheaven', 0x354c66]];
    for (const [x, z, name, paint] of cars) this.park(name, V(x, 0, z), (z < 60 ? Math.PI : 0) + (rnd() - 0.5) * 0.05, paint);
  }

  // The lot behind Hal's building, where the road from the field ends: the three-storey brick block
  // on the lot's south side, facing it, palms, a dumpster, the neighbours' cars.
  buildApartmentLot() {
    const s = this.scene, L = LOT;
    const g = new THREE.Group();
    g.position.copy(L);
    s.add(g);
    const block = prop('apartment');
    block.position.set(0, 0, 26);
    block.rotation.y = Math.PI;
    g.add(block);
    // asphalt, bays, a dumpster, palms
    const asphalt = new THREE.Mesh(flat(60, 30), new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#4f4c48', spots: 1600, spread: 12, alpha: 0.07, repeat: [8, 4], fine: 0.2 }), roughness: 0.95 }));
    asphalt.position.set(0, 0.015, -2);
    asphalt.receiveShadow = true;
    g.add(asphalt);
    const paint = new THREE.MeshBasicMaterial({ color: 0xdcd6c8 });
    for (let x = -18; x <= 18; x += 3.2) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5).rotateX(-Math.PI / 2), paint); l.position.set(x, 0.027, 5); g.add(l); }
    const bin = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.4, 1.4, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.6, metalness: 0.4 }));
    bin.position.set(-24, 0.7, 9);
    bin.castShadow = bin.receiveShadow = true;
    g.add(bin);
    for (const [x, z, h, r] of [[-27, -8, 11, 0.4], [26, -6, 12.5, 2.2], [31, 4, 9.5, 4.1]]) {
      const p = prop('palms');
      p.position.set(x, 0, z);
      p.rotation.y = r;
      p.scale.setScalar(h / 10.5);
      g.add(p);
    }
    for (const [x, name, col, r] of [[-11.2, 'fairheaven', 0x2b4a6b, 0.04], [8, 'sialia', 0xc9c3b4, -0.03], [14.4, 'negotiator', 0x6d6a5f, 0.02]]) {
      const car = makeCar(name, { paint: col });
      car.position.set(x, 0, 4.8);
      car.rotation.y = r;
      g.add(car);
    }
    this.lotCarSpot = L.clone().add(V(-1.6, 0, 4.8)); // nose in, toward the building
    this.physics.fixedGround(120, 0, 12, L.x, L.z); // he walks out to his car here
  }

  // Coast City round the lot: the boulevard out of town (office blocks on both sides, kerbs and
  // pavements, palms and street lamps, a signalled crossing with a cross street, a bus shelter, a
  // billboard), and downtown's towers behind Hal's building. Seen from the car and from the lot.
  buildCity() {
    const s = this.scene, g = new THREE.Group(), B = BOULEVARD;
    g.position.copy(LOT);
    s.add(g);
    const put = (o, x, z, yaw = 0, sc = 1) => { o.position.set(x, 0, z); o.rotation.y = yaw; o.scale.setScalar(sc); g.add(o); return o; };
    const len = B.z0 - B.z1;
    // pavements, kerbs, the cross street
    const pave = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(flat(x1 - x0, z0 - z1), pbrMaterial('concrete_floor_02', { repeat: [(x1 - x0) / 3, (z0 - z1) / 3], tint: new THREE.Color(1.12, 1.08, 1.03) }));
      m.position.set((x0 + x1) / 2, 0.14, (z0 + z1) / 2);
      m.receiveShadow = true;
      g.add(m);
    };
    for (const [x0, x1] of [[B.x0 - 5.5, B.x0], [B.x1, B.x1 + 5.5]]) {
      pave(x0, x1, B.z0, B.cross + 8);
      pave(x0, x1, B.cross - 8, B.z1);
    }
    const kerbMat = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.85 });
    for (const x of [B.x0, B.x1]) for (const [z0, z1] of [[B.z0, B.cross + 8], [B.cross - 8, B.z1]]) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, z0 - z1), kerbMat);
      k.position.set(x, 0.075, (z0 + z1) / 2);
      g.add(k);
    }
    const cross = new THREE.Mesh(flat(320, 12), pbrMaterial('asphalt_02', { repeat: [60, 2.2] }));
    cross.position.set(6, 0.02, B.cross); // over the boulevard (it was 1 mm under it, and fought it)
    cross.receiveShadow = true;
    g.add(cross);
    const ground = new THREE.Mesh(flat(420, len + 520), pbrMaterial('asphalt_02', { repeat: [70, 160], tint: new THREE.Color(0.85, 0.83, 0.8) }));
    ground.position.set(6, 0, (B.z0 + B.z1) / 2 + 120);
    ground.receiveShadow = true;
    g.add(ground);
    // the blocks: fronts to the street, a few metres of plaza between them
    const blocks = ['office5', 'office2', 'office4', 'office1', 'office6', 'office5', 'office4', 'office2', 'office1', 'office3'];
    for (const side of [-1, 1]) {
      let z = B.z0 - 6, i = side > 0 ? 3 : 0;
      while (z > B.z1 + 20) {
        const name = blocks[i++ % blocks.length], o = prop(name);
        const b = new THREE.Box3().setFromObject(o), w = b.max.x - b.min.x, dep = b.max.z - b.min.z;
        if (z - w < B.cross + 9 && z > B.cross - 9) { z = B.cross - 9; continue; } // leave the crossing clear
        const x = side < 0 ? B.x0 - 5.5 - dep / 2 - 1 : B.x1 + 5.5 + dep / 2 + 1;
        put(o, x, z - w / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2);
        z -= w + 4 + rnd() * 8;
      }
    }
    // the blocks round the lot, so it sits in town and not at the edge of the desert
    for (const [name, x, z, r] of [['office2', -78, 10, Math.PI / 2], ['office5', -70, -50, Math.PI / 2], ['office4', -76, 70, Math.PI / 2], ['office6', 92, 30, -Math.PI / 2], ['office5', 66, -48, -Math.PI / 2], ['office1', 70, 96, -Math.PI / 2], ['office4', -20, 86, Math.PI], ['office2', 40, 70, Math.PI]]) put(prop(name), x, z, r);
    // downtown, behind Hal's building: the towers through the haze
    for (const [name, x, z, sc, r] of [['office3', -120, 190, 2.3, 0.3], ['office1', -40, 260, 2.0, -0.2], ['office3', 70, 230, 1.9, 1.2], ['office4', 150, 170, 1.7, 0.5], ['office6', -210, 120, 1.2, 0.9]]) put(prop(name), x, z, r, sc);
    // street furniture: palms in the verge, lamps at the kerb, hydrants, bins
    for (let z = B.z0 - 10, n = 0; z > B.z1 + 10; z -= 18, n++) {
      if (Math.abs(z - B.cross) < 12) continue;
      for (const side of [-1, 1]) {
        const xk = side < 0 ? B.x0 - 0.9 : B.x1 + 0.9;
        if (n % 2 === 0) {
          // the palms model is two trees 3.5 m apart: stood one by one on their trunks along the kerb
          // (as a pair, turned at random, one could land out on the road in the car's way)
          const yaw = rnd() * 6, sc = 0.62 + rnd() * 0.12;
          put(piece('palms', PALMS[0], { root: true }), xk - side * 0.6, z + side * 4 + 1.8, yaw, sc);
          put(piece('palms', PALMS[1], { root: true }), xk - side * 0.6, z + side * 4 - 1.8, yaw + 2.1, sc * 0.95);
        }
        else put(piece('cityprops', KIT.lamp, { root: true }), xk, z, side < 0 ? 0 : Math.PI);
        if (n % 5 === 2) put(piece('cityprops', rnd() < 0.5 ? KIT.bin : KIT.can, { root: true }), xk + side * 3.6, z + 2); // on the pavement, back from the kerb
        if (n % 7 === 3) put(piece('cityprops', KIT.hydrant, { root: true }), xk + side * 0.1, z - 3);
      }
    }
    // the crossing: signals on the corners, a sign, a car waiting on the cross street
    for (const [x, z, yaw] of [[B.x0 - 1, B.cross + 7, 0], [B.x1 + 1, B.cross - 7, Math.PI]]) put(piece('cityprops', KIT.mast, { root: true }), x, z, yaw);
    for (const [x, z, yaw] of [[B.x1 + 1, B.cross + 7, -Math.PI / 2], [B.x0 - 1, B.cross - 7, Math.PI / 2]]) put(piece('cityprops', KIT.signal, { root: true }), x, z, yaw);
    put(piece('cityprops', KIT.sign, { root: true }), B.x1 + 1.4, B.cross + 8.5, 0.4);
    put(makeCar('negotiator', { paint: 0x6b6f72, dust: 0.25 }), 24, B.cross + 2.2, -Math.PI / 2);
    put(makeCar('fairheaven', { paint: 0x8e8a7c, dust: 0.25 }), -30, B.cross - 2.2, Math.PI / 2);
    put(prop('busstop'), B.x1 + 3.2, -120, -Math.PI / 2);
    put(prop('billboard'), -26, -60, 0.6).scale.setScalar(1.3);
  }

  // Boxes round a placed model's parts (those whose names pass `test`), so Hal walks round its
  // fuselage and under its wings rather than through them.
  solid(obj, test) {
    const parts = meshes(obj, (n) => test.test(n));
    const groups = new Map();
    for (const m of parts) { const k = m.name.replace(/[-_]FACES.*$|_\d+$/, ''); (groups.get(k) ?? groups.set(k, []).get(k)).push(m); }
    for (const list of groups.values()) {
      const b = boundsIn(this.scene, list);
      if (b.max.y - b.min.y < 0.05 && b.max.y > 2.2) continue; // thin and overhead: walk under it
      const c = b.getCenter(V(0, 0, 0)), h = b.getSize(V(0, 0, 0)).multiplyScalar(0.5);
      this.physics.fixedBox({ x: c.x, y: c.y, z: c.z }, { x: Math.max(h.x, 0.05), y: Math.max(h.y, 0.05), z: Math.max(h.z, 0.05) });
    }
  }

  // a parked car, with its collider
  park(name, at, yaw, paint) {
    const car = makeCar(name, { paint, dust: 0.45 + rnd() * 0.3 });
    car.position.copy(at);
    car.rotation.y = yaw;
    this.scene.add(car);
    const b = boundsIn(this.scene, meshes(car, () => true)), c = b.getCenter(V(0, 0, 0)), h = b.getSize(V(0, 0, 0)).multiplyScalar(0.5);
    this.physics.fixedBox({ x: c.x, y: h.y, z: c.z }, { x: h.x * 0.95, y: h.y, z: h.z * 0.97 });
    return car;
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    this.sky.position.copy(camera.position); // the dome goes with the camera (the lot is 6 km away)
    this.sky.userData.uniforms.uTime.value = t;
    if (this.follow) this.focus(this.follow(camera));
    this.exhaust.update(dt, t, camera, renderer);
    if (this.beacon) this.beacon.visible = Math.sin(t * 3) > 0;
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}
