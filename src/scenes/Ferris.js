import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Physics } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { Particles } from '../fx/Particles.js';
import { noiseTexture } from '../fx/Textures.js';

// Ferris Aircraft, mid-morning: the airfield in the desert outside Coast City where Martin Jordan
// flew (the dream's airfield, in daylight, twenty years on). North to south: the runway, a taxiway,
// the apron with the prototype parked on it, three hangars with their doors open onto the apron, the
// staff lot behind them, the gate, and the access road running south to the highway. Far down the
// road, out of sight, the lot behind Hal's apartment building, where his car is parked.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const JET_SPOT = V(14, 0, -26); // the prototype on the apron, nose to the east
export const CAROL_SPOT = V(19.5, 0, -20.5);
export const CAR_SPOT = V(36, 0, 54); // Hal's space in the staff lot, nose to the north
export const GATE = V(4, 0, 112);
export const LOT = V(0, 0, 6000); // behind the apartment building (Hal's car)
const RUNWAY_Z = -150;
const HANGARS = [{ x: -62, n: '1' }, { x: 0, n: '2' }, { x: 62, n: '3' }];
const HANGAR = { w: 54, d: 30, h: 15, z0: 8 }; // doors on the north face (z0), facing the apron

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
    this.jet = buildPrototype();
    this.jet.position.copy(JET_SPOT);
    this.jet.rotation.y = Math.PI / 2;
    s.add(this.jet);
    this.physics.fixedBox({ x: JET_SPOT.x, y: 1.4, z: JET_SPOT.z }, { x: 7.5, y: 1.4, z: 1.4 });
    this.physics.fixedBox({ x: JET_SPOT.x - 1, y: 0.4, z: JET_SPOT.z }, { x: 3, y: 0.4, z: 5.5 });
    this.buildApronProps();
    this.buildApartmentLot();
    this.car = buildCar({ color: 0x8c2a22 });
    this.car.position.copy(CAR_SPOT);
    s.add(this.car);
    this.carBox = this.physics.fixedBox({ x: CAR_SPOT.x, y: 0.7, z: CAR_SPOT.z }, { x: 0.92, y: 0.7, z: 2.4 });
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

  // keep the sun's shadow box on the action
  focus(at) {
    const d = this.sky.userData.uniforms.uSunDir.value;
    this.sun.target.position.copy(at);
    this.sun.position.copy(at).addScaledVector(d, 120);
    this.sun.target.updateMatrixWorld();
  }

  // ------------------------------------------------------------------------------------- ground
  buildGround() {
    const s = this.scene;
    // desert: pale sand, scrubby patches, tyre-worn dirt near the buildings
    const sand = new THREE.MeshStandardMaterial({ color: 0xbfa17a, roughness: 1 });
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000).rotateX(-Math.PI / 2), sand);
    ground.position.set(0, -0.02, 3000);
    ground.receiveShadow = true;
    s.add(ground);
    // (only the field is walked on; a box kilometres across lets the character controller sink in)
    this.physics.fixedBox({ x: 0, y: -0.5, z: 0 }, { x: 300, y: 0.5, z: 300 });
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
    const concrete = new THREE.MeshStandardMaterial({ map: tex(c, [1, 1]), roughness: 0.85 });
    const slab = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), concrete.clone());
      m.material.map = m.material.map.clone();
      m.material.map.repeat.set((x1 - x0) / 48, (z1 - z0) / 48);
      m.material.map.needsUpdate = true;
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
        l.position.set(x - 1.5, 0.012, z + (z < 60 ? 3 : -3));
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
      if (Math.abs(z - LOT.z) < 120 && Math.abs(x) < 120) continue; // the apartment lot
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
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(45, 1800).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.9 }));
    runway.position.set(0, 0.01, RUNWAY_Z);
    runway.receiveShadow = true;
    s.add(runway);
    // the taxiway joining the apron to the runway, its yellow centre line
    const tz0 = -75, tz1 = RUNWAY_Z + 22.5, tlen = tz0 - tz1;
    const twy = new THREE.Mesh(new THREE.PlaneGeometry(22, tlen).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.9 }));
    twy.position.set(-20, 0.008, (tz0 + tz1) / 2);
    twy.receiveShadow = true;
    s.add(twy);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, tlen).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8b23a }));
    tl.position.set(-20, 0.015, twy.position.z);
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
    const [c, g] = canvas(512, 256);
    g.fillStyle = '#c9c7c0';
    g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 8) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, 0, 3, 256); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 4, 0, 2, 256); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,90,60,${rnd() * 0.12})`; g.fillRect(rnd() * 512, 200 + rnd() * 56, 4 + rnd() * 30, 3 + rnd() * 20); } // grime at the foot
    const ribTex = tex(c);
    ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping;
    const wallMat = (rx, ry) => { const m = new THREE.MeshStandardMaterial({ map: ribTex.clone(), roughness: 0.55, metalness: 0.45 }); m.map.repeat.set(rx, ry); m.map.needsUpdate = true; return m; };
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.6, metalness: 0.5 });
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
      add(new THREE.PlaneGeometry(w - 0.4, d).rotateX(-Math.PI / 2), floorMat, 0, 0.02, d / 2);
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
        // a second airframe inside on jacks, panels off, under work lights
        const shell = buildPrototype({ bare: true });
        shell.position.set(-6, 0, d / 2 + 2);
        shell.rotation.y = Math.PI / 2 + 0.3;
        gx.add(shell);
        for (const x of [-14, 0, 14]) {
          const lamp = new THREE.PointLight(0xfff0d8, 30, 26, 2);
          lamp.position.set(x, h - 2, d / 2);
          gx.add(lamp);
          add(new THREE.BoxGeometry(1.4, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.9) }), x, h - 1.2, d / 2);
        }
        // tool carts and a rolling staircase
        for (const [x, z, r] of [[8, 6, 0.3], [11, 9, -0.2], [-16, 20, 0.6]]) {
          const cart = add(new RoundedBoxGeometry(1.2, 0.9, 0.6, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0xa82a24, roughness: 0.4, metalness: 0.4 }), x, 0.45, z);
          cart.rotation.y = r;
        }
      }
    }
  }

  buildTower() {
    const s = this.scene, g = new THREE.Group();
    g.position.set(-128, 0, -16);
    s.add(g);
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.9 });
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
    const wall = new THREE.MeshStandardMaterial({ color: 0xe2ddd2, roughness: 0.85 });
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
    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, len).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 }));
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
    // the gate: a guard booth, a raised barrier, the company's sign on a low wall
    const booth = new THREE.Group();
    booth.position.copy(GATE).add(V(-6, 0, 0));
    s.add(booth);
    const white = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2b3944, metalness: 0.8, roughness: 0.1 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 3), white); b1.position.y = 1.3; b1.castShadow = true; booth.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1, 3.1), glass); b2.position.y = 1.8; booth.add(b2);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 3.6), white); roof.position.y = 2.7; booth.add(roof);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6, 0.12), new THREE.MeshStandardMaterial({ color: 0xd23a2a }));
    arm.position.set(1.6, 3.9, 0);
    arm.rotation.z = 0.12;
    booth.add(arm);
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
      const mat = new THREE.MeshStandardMaterial({ map: wire.clone(), metalness: 0.6, roughness: 0.45, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide });
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

  // Around the prototype: wheel chocks, a fuel cart, a boarding ladder, cones; it was ready to fly.
  buildApronProps() {
    const s = this.scene, J = JET_SPOT;
    const yellow = new THREE.MeshStandardMaterial({ color: 0xd9a926, roughness: 0.55 });
    const ladder = new THREE.Group();
    ladder.position.set(J.x + 3.4, 0, J.z + 1.6);
    s.add(ladder);
    for (const x of [-0.32, 0.32]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), yellow); r.position.set(x, 1.4, 0); r.rotation.x = 0.35; r.castShadow = true; ladder.add(r); }
    for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.16), yellow); st.position.set(0, 0.25 + i * 0.33, 0.45 - i * 0.12); ladder.add(st); }
    const cone = new THREE.ConeGeometry(0.18, 0.5, 14).translate(0, 0.25, 0);
    const orange = new THREE.MeshStandardMaterial({ color: 0xe0561a, roughness: 0.5 });
    for (const [x, z] of [[-9, 6], [-9, -6], [9, 6], [9, -6]]) { const c = new THREE.Mesh(cone, orange); c.position.set(J.x + x, 0, J.z + z); c.castShadow = true; s.add(c); }
    const cart = new THREE.Group();
    cart.position.set(J.x - 8, 0, J.z + 9);
    cart.rotation.y = 0.4;
    s.add(cart);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.2, 20).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.4, metalness: 0.3 }));
    tank.position.y = 1.35;
    tank.castShadow = true;
    cart.add(tank);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a2c30 }));
    chassis.position.y = 0.55;
    cart.add(chassis);
    for (const [x, z] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); w.position.set(x, 0.35, z); cart.add(w); }
    this.physics.fixedBox({ x: cart.position.x, y: 1, z: cart.position.z }, { x: 1.9, y: 1, z: 1 });
  }

  // The lot behind Hal's building, where the road from the field ends: a three-storey stucco block
  // (on the lot's south side, facing it) with an outside stair, palms, a couple of other cars.
  buildApartmentLot() {
    const s = this.scene, L = LOT;
    const g = new THREE.Group();
    g.position.copy(L);
    s.add(g);
    const stucco = new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#d9c3a3', spots: 900, spread: 30, alpha: 0.06, repeat: [6, 3], fine: 0.1 }), roughness: 0.95 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x7a5a44, roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a44, metalness: 0.8, roughness: 0.12 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(40, 9.6, 14), stucco, 0, 4.8, 16);
    for (let fl = 0; fl < 3; fl++) for (let i = 0; i < 9; i++) {
      add(new THREE.BoxGeometry(1.6, 1.3, 0.1), glass, -16 + i * 4, 1.6 + fl * 3.1, 8.98);
      add(new THREE.BoxGeometry(1.9, 0.12, 0.25), trim, -16 + i * 4, 0.9 + fl * 3.1, 8.9);
    }
    // the walkways and stair up the outside
    for (const y of [3.1, 6.2]) add(new THREE.BoxGeometry(40, 0.2, 1.6), trim, 0, y, 8.1);
    for (let i = 0; i < 14; i++) add(new THREE.BoxGeometry(1.2, 0.18, 0.3), trim, 20.8, 0.2 + i * 0.22, 9 - i * 0.12);
    // asphalt, bays, a dumpster, palms
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(60, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f4c48, roughness: 0.95 }));
    asphalt.position.set(0, 0.015, -2);
    asphalt.receiveShadow = true;
    g.add(asphalt);
    const paint = new THREE.MeshBasicMaterial({ color: 0xdcd6c8 });
    for (let x = -18; x <= 18; x += 3.2) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5).rotateX(-Math.PI / 2), paint); l.position.set(x, 0.02, 5); g.add(l); }
    add(new RoundedBoxGeometry(2.2, 1.4, 1.4, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.6, metalness: 0.4 }), -24, 0.7, 6);
    for (const [x, z, h] of [[-27, -8, 11], [26, -6, 13], [30, 3, 9.5]]) g.add(palm(x, z, h));
    for (const [x, col, r] of [[-11.2, 0x2b4a6b, 0.04], [8, 0xc9c3b4, -0.03]]) {
      const car = buildCar({ color: col, primer: false });
      car.position.set(x, 0, 4.8);
      car.rotation.y = r;
      g.add(car);
    }
    this.lotCarSpot = L.clone().add(V(-1.6, 0, 4.8)); // nose in, toward the building
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
    this.exhaust.update(dt, t, camera, renderer);
    if (this.beacon) this.beacon.visible = Math.sin(t * 3) > 0;
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}

// A palm: a tall leaning trunk, a crown of drooping fronds.
function palm(x, z, h) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const lean = (rnd() - 0.5) * 0.12;
  const curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(lean * h * 0.3, h * 0.5, 0), V(lean * h, h, 0));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 1 }));
  trunk.castShadow = true;
  g.add(trunk);
  const top = curve.getPoint(1);
  const frond = new THREE.MeshStandardMaterial({ color: 0x55703a, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.3;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(1.6, 0.45, 3.4, 0); shape.quadraticCurveTo(1.6, -0.45, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 8);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) { const u = p.getX(j) / 3.4; p.setZ(j, -u * u * 1.6); }
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, frond);
    f.position.copy(top);
    f.rotation.set(-Math.PI / 2 + 0.25, 0, a, 'YXZ');
    f.rotation.y = a;
    f.castShadow = true;
    g.add(f);
  }
  return g;
}

// Ferris's prototype: a single-seat twin-tail jet, lofted from cross-sections (a long chined nose, a
// bubble canopy, side intakes, swept wings, canted fins), in grey primer with the company's red
// stripe. `bare` is the one in the hangar, half-built, without its canopy.
export function buildPrototype({ bare = false } = {}) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: bare ? 0x9ea3a6 : 0x7d858b, metalness: 0.55, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa3191b, metalness: 0.3, roughness: 0.45 });
  // fuselage: stations along x (nose +x) as [x, half-width, half-height, centre y]
  const st = [[8.0, 0.02, 0.02, 1.95], [7.4, 0.22, 0.16, 1.95], [6.2, 0.5, 0.36, 1.98], [4.6, 0.74, 0.55, 2.05], [3.0, 0.95, 0.66, 2.1], [1.0, 1.25, 0.7, 2.05], [-1.5, 1.3, 0.68, 2.0], [-3.8, 1.15, 0.6, 2.0], [-5.6, 0.9, 0.52, 2.0], [-6.6, 0.82, 0.5, 2.0]];
  const R = 28, pos = [], idx = [];
  for (const [x, w, h, cy] of st) for (let i = 0; i < R; i++) {
    const a = (i / R) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    // a chine: flatter sides, a sharp edge where the belly meets the flanks
    const k = Math.sign(c) * Math.pow(Math.abs(c), 0.7), sy = Math.sign(s) * Math.pow(Math.abs(s), s < 0 ? 1.4 : 0.9);
    pos.push(x, cy + sy * h, k * w);
  }
  for (let j = 0; j < st.length - 1; j++) for (let i = 0; i < R; i++) {
    const a = j * R + i, b = j * R + ((i + 1) % R), c2 = (j + 1) * R + i, d = (j + 1) * R + ((i + 1) % R);
    idx.push(a, c2, b, b, c2, d);
  }
  const fus = new THREE.BufferGeometry();
  fus.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fus.setIndex(idx);
  fus.computeVertexNormals();
  const body = new THREE.Mesh(fus, skin);
  g.add(body);
  // the company stripe down the flank
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 0.02), red);
    stripe.position.set(0.5, 2.15, side * 1.27);
    stripe.rotation.y = 0;
    g.add(stripe);
  }
  if (!bare) {
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.85 }));
    canopy.scale.set(2.0, 0.55, 0.48);
    canopy.position.set(3.4, 2.55, 0);
    g.add(canopy);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 6, 20, Math.PI), dark);
    frame.position.set(3.0, 2.55, 0);
    frame.rotation.y = Math.PI / 2;
    g.add(frame);
  }
  // intakes on the flanks, below the canopy
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 0.5), skin);
    intake.position.set(1.2, 1.75, side * 1.25);
    g.add(intake);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.66), dark);
    mouth.position.set(2.51, 1.75, side * 1.25);
    mouth.rotation.y = Math.PI / 2;
    g.add(mouth);
  }
  // wings: a swept trapezoid, thin, with a bevel; a slight droop
  const wing = new THREE.Shape();
  wing.moveTo(2.2, 0); wing.lineTo(-2.4, 4.6); wing.lineTo(-3.6, 4.6); wing.lineTo(-4.6, 0); wing.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, skin);
    w.rotation.x = side * Math.PI / 2;
    w.rotation.z = 0;
    w.position.set(0, 1.85, side * 0.9);
    w.rotateX(side * -0.04);
    g.add(w);
  }
  // twin canted fins and the tailplanes
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(-1.9, 2.5); fin.lineTo(-2.8, 2.5); fin.lineTo(-2.6, 0); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(finGeo, skin);
    f.position.set(-3.6, 2.45, side * 0.7);
    f.rotation.x = side * -0.38;
    g.add(f);
    const tp = new THREE.Mesh(wingGeo, skin);
    tp.scale.set(0.42, 0.42, 1);
    tp.rotation.x = side * Math.PI / 2;
    tp.position.set(-4.6, 1.95, side * 0.75);
    g.add(tp);
  }
  // twin nozzles
  for (const side of [-1, 1]) {
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.9, 20, 1, true).rotateZ(Math.PI / 2), dark);
    nz.position.set(-7.0, 2.0, side * 0.42);
    g.add(nz);
  }
  // landing gear: struts, wheels
  const tyre = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.8 });
  for (const [x, z, r] of [[5.4, 0, 0.32], [-1.6, 1.4, 0.42], [-1.6, -1.4, 0.42]]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), dark);
    strut.position.set(x, 0.9 + r * 0.5, z * 0.8);
    g.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.26, 18).rotateX(Math.PI / 2), tyre);
    wheel.position.set(x, r, z);
    g.add(wheel);
  }
  // the number on the tail
  const [c, gx] = canvas(256, 128);
  gx.fillStyle = '#e9e4d8'; gx.font = '900 84px Arial, sans-serif'; gx.textAlign = 'center'; gx.fillText(bare ? 'X-2' : 'X-1', 128, 96);
  for (const side of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true }));
    n.position.set(-5.2, 3.6, side * (0.7 + 0.44));
    n.rotation.y = side > 0 ? 0 : Math.PI;
    n.rotation.x = side * -0.38;
    g.add(n);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Hal's car: a long, square-shouldered coupe twenty years past its best, faded paint, the driver's
// door in grey primer, a cracked tail light. About 4.8 m, nose to +Z, origin on the ground at its
// centre. `userData.seat` is where the driver sits, `userData.exhaust` the tailpipe.
export function buildCar({ color = 0x8c2a22, primer = true } = {}) {
  const g = new THREE.Group();
  const [c, gx] = canvas(256);
  gx.fillStyle = '#' + new THREE.Color(color).getHexString();
  gx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) { gx.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`; gx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 18, 1 + rnd() * 3); } // sun-faded, swirled
  if (primer) for (let i = 0; i < 14; i++) { gx.fillStyle = `rgba(110,64,40,${0.2 + rnd() * 0.3})`; gx.beginPath(); gx.arc(rnd() * 256, rnd() * 256, 2 + rnd() * 7, 0, 7); gx.fill(); } // rust
  const paintTex = tex(c);
  const paint = new THREE.MeshStandardMaterial({ map: paintTex, metalness: 0.35, roughness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.22 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8ea3b2, metalness: 0.3, roughness: 0.04, transparent: true, opacity: 0.38, envMapIntensity: 1.6 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  // the body: long and low, the hood and trunk lids a touch lower than the beltline
  add(new RoundedBoxGeometry(1.86, 0.6, 4.8, 3, 0.1), paint, 0, 0.62, 0);
  add(new RoundedBoxGeometry(1.8, 0.08, 1.55, 2, 0.03), paint, 0, 0.94, 1.55);
  add(new RoundedBoxGeometry(1.8, 0.08, 1.15, 2, 0.03), paint, 0, 0.94, -1.75);
  // the greenhouse: glass with a body-coloured roof and pillars
  const cabin = new THREE.BoxGeometry(1.62, 0.52, 2.0, 1, 1, 1);
  const cp = cabin.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.9); cp.setZ(i, cp.getZ(i) * 0.72 - 0.08); }
  cabin.computeVertexNormals();
  add(cabin, glass, 0, 1.2, -0.15);
  add(new RoundedBoxGeometry(1.48, 0.06, 1.42, 2, 0.02), paint, 0, 1.47, -0.23);
  for (const sx of [-1, 1]) {
    const a = add(new THREE.BoxGeometry(0.06, 0.6, 0.08), paint, sx * 0.76, 1.2, 0.68); a.rotation.x = -0.75; // A-pillars
    const cP = add(new THREE.BoxGeometry(0.06, 0.6, 0.12), paint, sx * 0.76, 1.2, -0.98); cP.rotation.x = 0.6; // C-pillars
  }
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.035, 4.5), chrome, sx * 0.935, 0.9, 0); // belt line
  // the primer door
  if (primer) add(new THREE.BoxGeometry(0.02, 0.5, 1.1), new THREE.MeshStandardMaterial({ color: 0x8a8c8a, roughness: 0.9 }), 0.935, 0.66, 0.1);
  // bumpers, grille, lights
  add(new RoundedBoxGeometry(1.95, 0.16, 0.16, 2, 0.05), chrome, 0, 0.42, 2.44);
  add(new RoundedBoxGeometry(1.95, 0.16, 0.16, 2, 0.05), chrome, 0, 0.42, -2.44);
  add(new THREE.BoxGeometry(1.2, 0.26, 0.04), black, 0, 0.66, 2.41);
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x222018, metalness: 0.5, roughness: 0.1 }), sx * 0.72, 0.68, 2.42);
    add(new THREE.BoxGeometry(0.36, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: sx > 0 && primer ? 0x5a1410 : 0xa01a14, emissive: 0x220302, roughness: 0.3 }), sx * 0.66, 0.72, -2.42);
  }
  // wheels in dark arches
  for (const [x, z] of [[0.82, 1.5], [-0.82, 1.5], [0.82, -1.5], [-0.82, -1.5]]) {
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), black, x * 1.04, 0.38, z);
    const w = new THREE.Group();
    w.position.set(x, 0.33, z);
    g.add(w);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 22).rotateZ(Math.PI / 2), black);
    tyre.castShadow = true;
    w.add(tyre);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.23, 18).rotateZ(Math.PI / 2), chrome);
    w.add(cap);
    (g.userData.wheels ??= []).push(w);
  }
  // inside: a bench seat and the steering wheel (for the driver's hands)
  add(new THREE.BoxGeometry(1.5, 0.18, 0.55), black, 0, 0.72, -0.35);
  add(new THREE.BoxGeometry(1.5, 0.55, 0.14), black, 0, 1.0, -0.62);
  const wheel = add(new THREE.TorusGeometry(0.19, 0.022, 8, 24), black, 0.38, 1.08, 0.42);
  wheel.rotation.x = -1.1;
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6).rotateZ(Math.PI / 2), chrome, -0.85, 0.32, -2.5); // tailpipe
  g.userData.seat = V(0.38, 0.55, -0.32);
  g.userData.wheel = wheel;
  g.userData.exhaust = V(-0.85, 0.32, -2.58);
  return g;
}
