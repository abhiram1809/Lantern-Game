import * as THREE from 'three';
import { Physics, RAPIER } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { glowTexture, pbrMaterial } from '../fx/Textures.js';
import { prop, piece, meshes, boundsIn, hasProp } from '../props/Props.js';
import { makeCar } from '../props/Car.js';
import { toGlyphs } from '../ui/UI.js';
import { KIT } from './Ferris.js';

// Downtown Coast City at midnight (Part Four): a tower going up on a fenced lot between two streets,
// its first five storeys a skeleton of steel, a tower crane over it, an excavator by the spoil heap,
// floodlights on the site's corners, the office blocks round it lit here and there. Atrocitus has
// set his machine up in the middle of the lot. North is -Z; the lot runs x -30..30, z -26..22, the
// streets along its south and east sides.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const LOT = { x0: -30, x1: 30, z0: -26, z1: 22 };
export const DEVICE = V(-2, 0, 4); // his machine, in the middle of the lot
export const EXCAVATOR = { at: V(15, 0, -8), yaw: -Math.PI / 2 }; // facing west, across the lot
export const ARENA = { center: V(0, 0, 0), radius: 24 };
export const SITE_IN = V(4, 0, 18); // where Hal lands, inside the gate
const FRAME = { x0: -26, z0: -22, nx: 6, nz: 4, bay: 4, storey: 4, levels: 5 }; // column lines and storeys
export const SITE_PROPS = ['excavator', 'girders', 'crane', 'chainlink', 'container', 'barriers', 'roadclosed', 'mixer', 'pipe', 'bricks', 'portapotty', 'pipepallets', 'lighttower',
  'office1', 'office2', 'office3', 'office4', 'office5', 'office6', 'cityprops', 'negotiator', 'fairheaven', 'sialia'];

// the kit's girders stand up +Y with their depth along Z: a floor beam lies along X or Z with its
// web upright (the kit's Z up)
const ALONG_X = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
const ALONG_Z = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(-1, 0, 0), V(0, 0, 1), V(0, 1, 0)));

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const flat = (w, d, tile = 25) => new THREE.PlaneGeometry(w, d, Math.ceil(w / tile), Math.ceil(d / tile)).rotateX(-Math.PI / 2);

export class Site {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.blocks = []; // { x, z, r }: what Atrocitus walks round
    this.loose = []; // the steel beams lying about, for Atrocitus to throw
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x0b1018, 0.0065);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.12;
    s.userData.exposure = 1.0;
    s.userData.far = 1600;
    s.userData.near = 0.1;
    this.sky = createSky('night', 800);
    s.add(this.sky);
    this.buildLight();
    this.buildGround();
    this.buildFrame();
    this.buildCrane();
    this.buildFence();
    this.buildDressing();
    this.buildExcavator();
    this.buildCity();
    this.buildDevice();
    this.physics.fixedGround(900);
    return this;
  }

  // ------------------------------------------------------------------------------------- light
  // Moonlight, faint and blue; the site's own floodlights do the work: three towers on its corners,
  // aimed in at the middle; and the sodium of the street lamps outside the fence.
  buildLight() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x5a6c8c, 0x1a1612, 0.35));
    const moon = (this.moon = new THREE.DirectionalLight(0xa9bce0, 0.45));
    moon.position.set(-40, 80, -30);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 220 });
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.04;
    s.add(moon, moon.target);
    const aim = V(0, 0.5, 0);
    this.floods = [];
    [[-24, 16, true], [24, 18, false], [26, -22, true]].forEach(([x, z, shadow]) => {
      const yaw = Math.atan2(aim.x - x, aim.z - z);
      if (hasProp('lighttower')) { const t = prop('lighttower'); t.position.set(x, 0, z); t.rotation.y = yaw + Math.PI; s.add(t); this.block(x, z, 1.4, 2.6); }
      const top = V(x, 4.2, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.4) }));
      lamp.position.copy(top);
      lamp.lookAt(aim);
      s.add(lamp);
      const spot = new THREE.SpotLight(0xfff0d8, 420, 60, 0.62, 0.55, 2);
      spot.position.copy(top);
      spot.target.position.copy(aim);
      spot.castShadow = shadow;
      if (shadow) { spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.03; }
      s.add(spot, spot.target);
      this.floods.push(spot);
    });
  }

  // ------------------------------------------------------------------------------------- ground
  buildGround() {
    const s = this.scene, L = LOT;
    const base = new THREE.Mesh(flat(900, 900, 30), pbrMaterial('asphalt_02', { repeat: [150, 150], tint: new THREE.Color(0.7, 0.7, 0.72) }));
    base.receiveShadow = true;
    s.add(base);
    // the lot: churned dirt and gravel, tyre-tracked
    const dirt = new THREE.Mesh(flat(L.x1 - L.x0, L.z1 - L.z0, 12), pbrMaterial('gravelly_sand', { repeat: [(L.x1 - L.x0) / 4, (L.z1 - L.z0) / 4], tint: new THREE.Color(0.62, 0.53, 0.45) }));
    dirt.position.set((L.x0 + L.x1) / 2, 0.02, (L.z0 + L.z1) / 2);
    dirt.receiveShadow = true;
    s.add(dirt);
    // pavements and kerbs along the two streets (south and east), and the far sides
    const pave = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(flat(x1 - x0, z1 - z0, 12), pbrMaterial('concrete_floor_02', { repeat: [(x1 - x0) / 3, (z1 - z0) / 3], tint: new THREE.Color(0.85, 0.83, 0.8) }));
      m.position.set((x0 + x1) / 2, 0.14, (z0 + z1) / 2);
      m.receiveShadow = true;
      s.add(m);
    };
    pave(L.x0 - 3, L.x1 + 3, L.z1, L.z1 + 3.5); // south, the lot's side
    pave(L.x0 - 30, L.x1 + 40, L.z1 + 15, L.z1 + 18.5); // south, across the street
    pave(L.x1, L.x1 + 3.5, L.z0 - 3, L.z1); // east, the lot's side
    pave(L.x1 + 15, L.x1 + 18.5, L.z0 - 40, L.z1 + 15); // east, across the street
    const kerbMat = new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.85 });
    const kerb = (x, z, w, d) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), kerbMat); k.position.set(x, 0.075, z); k.receiveShadow = true; s.add(k); };
    kerb(0, L.z1 + 3.5, L.x1 - L.x0 + 6, 0.2);
    kerb(10, L.z1 + 15, 100, 0.2);
    kerb(L.x1 + 3.5, -2, 0.2, L.z1 - L.z0 + 6);
    kerb(L.x1 + 15, -12, 0.2, 80);
    // the street's lane markings
    const paint = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.5, 0.3), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let x = L.x0 - 20; x < L.x1 + 30; x += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.15).rotateX(-Math.PI / 2), paint); d.position.set(x, 0.01, L.z1 + 9.25); s.add(d); }
    for (let z = L.z0 - 30; z < L.z1 + 10; z += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3).rotateX(-Math.PI / 2), paint); d.position.set(L.x1 + 9.25, 0.01, z); s.add(d); }
    // the spoil heap the excavator's been working, against the north fence
    const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), pbrMaterial('gravelly_sand', { repeat: [6, 6], tint: new THREE.Color(0.45, 0.37, 0.3) }));
    const hp = heap.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < hp.count; i++) { v.fromBufferAttribute(hp, i); const n = 1 + 0.12 * Math.sin(v.x * 5.1 + v.z * 3.3) * Math.sin(v.z * 4.7); hp.setXYZ(i, v.x * n, v.y * (0.9 + 0.2 * n), v.z * n); }
    heap.geometry.computeVertexNormals();
    heap.scale.set(7, 3.2, 5);
    heap.position.set(22, -0.2, -19);
    heap.castShadow = heap.receiveShadow = true;
    s.add(heap);
    this.block(22, -19, 6, 2.6);
    this.physics.fixedBox({ x: 22, y: 1.2, z: -19 }, { x: 5, y: 1.2, z: 3.5 });
  }

  // ------------------------------------------------------------------------------------- steel
  // The tower's frame: H columns on a 4 m grid, I beams between them at every floor, two floors of
  // slab poured, the top storey half-built. Instanced from the girder kit.
  buildFrame() {
    const s = this.scene, F = FRAME;
    const col = this.girder(/SteelGirder_H/), beam = this.girder(/SteelGirder_I/);
    const cols = [], beams = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let lv = 0; lv < F.levels; lv++) {
      for (let i = 0; i < F.nx; i++) for (let j = 0; j < F.nz; j++) {
        if (lv === F.levels - 1 && i > 2) continue; // the top storey only part-way along
        const x = F.x0 + i * F.bay, z = F.z0 + j * F.bay;
        cols.push(m.compose(p.set(x, lv * F.storey, z), q.identity(), sc).clone());
        // beams out to the next column lines, at the top of this storey
        const y = (lv + 1) * F.storey - 0.15;
        if (i < F.nx - 1 && !(lv === F.levels - 1 && i >= 2)) beams.push(m.compose(p.set(x, y, z), ALONG_X, sc).clone());
        if (j < F.nz - 1 && !(lv === F.levels - 1 && i > 2)) beams.push(m.compose(p.set(x, y, z), ALONG_Z, sc).clone());
      }
    }
    const put = (g, list) => {
      const im = new THREE.InstancedMesh(g.geometry, g.material, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm.multiply(g.matrix)));
      im.castShadow = im.receiveShadow = true;
      s.add(im);
      return im;
    };
    put(col, cols);
    put(beam, beams);
    // colliders: each column (Hal walks round them, flies round them) and each floor's beams as a grid of bars
    for (const c of cols) { p.setFromMatrixPosition(c); this.physics.fixedBox({ x: p.x, y: p.y + 2, z: p.z }, { x: 0.16, y: 2, z: 0.16 }); }
    const w = (F.nx - 1) * F.bay, d = (F.nz - 1) * F.bay, cx = F.x0 + w / 2, cz = F.z0 + d / 2;
    for (let lv = 1; lv <= F.levels; lv++) {
      const y = lv * F.storey - 0.15;
      for (let j = 0; j < F.nz; j++) this.physics.fixedBox({ x: cx, y, z: F.z0 + j * F.bay }, { x: w / 2, y: 0.15, z: 0.08 });
      for (let i = 0; i < F.nx; i++) this.physics.fixedBox({ x: F.x0 + i * F.bay, y, z: cz }, { x: 0.08, y: 0.15, z: d / 2 });
    }
    for (let i = 0; i < F.nx; i++) for (let j = 0; j < F.nz; j++) this.blocks.push({ x: F.x0 + i * F.bay, z: F.z0 + j * F.bay, r: 0.3 });
    // the slabs: the ground floor raised, the first two floors poured (with the stair void)
    const slabMat = pbrMaterial('concrete_floor_02', { repeat: [w / 4, d / 4], tint: new THREE.Color(0.78, 0.76, 0.72) });
    for (const [y, t] of [[0.12, 0.24], [F.storey + 0.08, 0.2], [F.storey * 2 + 0.08, 0.2]]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, t, d + 0.6), slabMat);
      slab.position.set(cx, y, cz);
      slab.castShadow = slab.receiveShadow = true;
      s.add(slab);
      this.physics.fixedBox({ x: cx, y, z: cz }, { x: w / 2 + 0.3, y: t / 2, z: d / 2 + 0.3 });
    }
    this.frameBox = { x0: F.x0 - 0.5, x1: F.x0 + w + 0.5, z0: F.z0 - 0.5, z1: F.z0 + d + 0.5, top: F.levels * F.storey };
  }

  // One girder out of the kit, standing up the Y axis from its foot, as geometry plus the offset
  // that puts its foot at the origin (`matrix`), for instancing.
  girder(test) {
    const g = piece('girders', test);
    const mesh = g.children[0];
    return { geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrix.clone() };
  }

  buildCrane() {
    if (!hasProp('crane')) return;
    const c = prop('crane');
    c.position.set(-2, 0, -24);
    c.rotation.y = 2.2; // the jib out over the lot toward the south-east
    this.scene.add(c);
    this.crane = c;
    this.physics.fixedBox({ x: -2, y: 21, z: -24 }, { x: 0.8, y: 21, z: 0.8 });
    this.block(-2, -24, 1.4, 42);
    // its warning lights, up the mast and on the jib's ends (red, blinking)
    this.beacons = [];
    const tip = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), c.rotation.y).add(c.position);
    for (const at of [tip(0, 43.2, 0), tip(0, 36, 41.5), tip(0, 36, -14.5)]) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.32)'), color: new THREE.Color(3, 0.25, 0.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      b.position.copy(at);
      b.scale.setScalar(2.2);
      this.scene.add(b);
      this.beacons.push(b);
    }
  }

  buildFence() {
    if (!hasProp('chainlink')) return;
    const s = this.scene, L = LOT;
    const run = prop('chainlink');
    const len = new THREE.Box3().setFromObject(run).getSize(V(0, 0, 0)).x;
    const side = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0, total = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
      for (let a = 0; a < total - 1; a += len) {
        const b = Math.min(total, a + len), mid = (a + b) / 2;
        const o = prop('chainlink');
        o.position.set(x0 + (dx * mid) / total, 0, z0 + (dz * mid) / total);
        o.rotation.y = yaw;
        o.scale.x = (b - a) / len;
        s.add(o);
      }
      this.physics.fixedBox({ x: (x0 + x1) / 2, y: 1.15, z: (z0 + z1) / 2 }, { x: Math.abs(dx) / 2 + 0.05, y: 1.15, z: Math.abs(dz) / 2 + 0.05 });
    };
    side(L.x0, L.z1, L.x1, L.z1); // south, along the street
    side(L.x1, L.z0, L.x1, L.z1); // east
    side(L.x0, L.z0, L.x1, L.z0); // north
    side(L.x0, L.z0, L.x0, L.z1); // west
  }

  // ------------------------------------------------------------------------------------- dressing
  buildDressing() {
    const s = this.scene;
    const put = (name, x, z, yaw = 0, r = 1.2, h = 2) => {
      if (!hasProp(name)) return null;
      const o = prop(name);
      o.position.set(x, 0, z);
      o.rotation.y = yaw;
      s.add(o);
      const b = new THREE.Box3().setFromObject(o), c = b.getCenter(V(0, 0, 0)), e = b.getSize(V(0, 0, 0)).multiplyScalar(0.5);
      this.physics.fixedBox({ x: c.x, y: e.y, z: c.z }, { x: e.x * 0.95, y: e.y, z: e.z * 0.95 });
      this.block(x, z, r, h);
      return o;
    };
    put('container', 21, 12, Math.PI / 2 + 0.05, 3.2, 2.6);
    put('portapotty', 26.5, 17, -Math.PI / 2, 0.9, 2.3);
    put('portapotty', 26.5, 18.5, -Math.PI / 2 - 0.1, 0.9, 2.3);
    put('mixer', 13, 15, 0.6, 1.1, 1.4);
    put('bricks', 8, 18, 0.2, 1.4, 1.2);
    put('bricks', -24, -2, 1.4, 1.4, 1.2);
    put('pipepallets', -18, 18, 0.05, 3.3, 1.3);
    if (hasProp('pipe')) for (const [x, z, yaw] of [[-26, 10, 0.1], [-26, 11.2, 0.05], [-25.4, 10.6, 0.1]]) {
      const o = prop('pipe');
      o.position.set(x, z === 10.6 ? 0.95 : 0.32, z);
      o.rotation.set(0, yaw + Math.PI / 2, 0);
      s.add(o);
    }
    if (hasProp('pipe')) { this.physics.fixedBox({ x: -25.7, y: 0.6, z: 10.6 }, { x: 1.1, y: 0.6, z: 1.2 }); this.block(-25.7, 10.6, 1.6, 1.2); }
    // a stack of beams waiting to go up, banded, by the frame
    const beam = this.girder(/SteelGirder_I/);
    const stack = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
      const m = new THREE.Matrix4().compose(V(-12 + (i - (5 - row) / 2) * 0.34, 0.15 + row * 0.27, -2), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), V(1, 1, 1));
      stack.push(m.multiply(beam.matrix));
    }
    const st = new THREE.InstancedMesh(beam.geometry, beam.material, stack.length);
    stack.forEach((m, i) => st.setMatrixAt(i, m));
    st.castShadow = st.receiveShadow = true;
    s.add(st);
    this.physics.fixedBox({ x: -12, y: 0.45, z: 0 }, { x: 1.1, y: 0.45, z: 2.1 });
    this.block(-12, 0, 2, 0.9);
    // loose ones, lying where they were dropped off the truck (Atrocitus's to throw)
    for (const [x, z, yaw] of [[-6, -4, 0.3], [6, -2, 1.9], [-14, 10, 1.2], [9, 9, 0.6], [-4, 14, 2.6], [14, 2, 0.1], [-18, -6, 1.6], [2, -8, 2.2]]) this.addLoose(beam, V(x, 0.2, z), yaw);
    // barriers at the gate and along the street
    if (hasProp('barriers')) {
      for (const [x, z, yaw] of [[-10, 26, 0], [-4, 26.2, 0.05], [10, 26, 0]]) {
        const o = piece('barriers', /CementBarrier/);
        o.position.set(x, 0.14, z);
        o.rotation.y = yaw + Math.PI / 2;
        s.add(o);
      }
    }
    if (hasProp('roadclosed')) for (const [x, z] of [[3, 24.6], [-2, 24.4]]) { const o = prop('roadclosed'); o.position.set(x, 0.14, z); o.rotation.y = 0.1; s.add(o); }
  }

  // A steel beam on the ground as a physics body: the ring knocks it about, Atrocitus throws it.
  addLoose(beam, at, yaw) {
    const mesh = new THREE.Mesh(beam.geometry, beam.material);
    mesh.castShadow = mesh.receiveShadow = true;
    // lying along its local Y turned to Z: a group carries the kit's offset, centred on the beam
    const g = new THREE.Group(), inner = new THREE.Group();
    inner.add(mesh);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(beam.matrix);
    inner.rotation.x = Math.PI / 2;
    inner.position.z = -2; // the 4 m beam's middle at the group's origin
    g.add(inner);
    g.position.copy(at);
    g.rotation.y = yaw;
    this.scene.add(g);
    const half = V(0.07, 0.14, 2.0);
    const body = this.physics.dynamic(g, RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), { density: 2.5, damping: 0.05, angularDamping: 0.2, restitution: 0.1 });
    this.loose.push({ mesh: g, body, half, state: 'loose' });
  }

  // ------------------------------------------------------------------------------------- excavator
  // The site's excavator, its parts by name: the house turns on the tracks, the boom, the stick and
  // the bucket each on their own pivots (the model's own hierarchy).
  buildExcavator() {
    if (!hasProp('excavator')) return;
    const x = prop('excavator', { ownMaterials: true });
    x.position.copy(EXCAVATOR.at);
    x.rotation.y = EXCAVATOR.yaw;
    this.scene.add(x);
    const find = (re) => { let f = null; x.traverse((o) => { if (!f && re.test(o.name)) f = o; }); return f; };
    this.digger = { root: x, house: find(/^Body_GEO$/), boom: find(/^arm_01_GEO1$/), stick: find(/^Arm_2_GEO$/), bucket: find(/^shovel_GEO$/), tracks: find(/^Tread_GEO$/) };
    for (const k of ['house', 'boom', 'stick', 'bucket']) if (this.digger[k]) this.digger[k].userData.rest = this.digger[k].quaternion.clone();
    const b = boundsIn(this.scene, meshes(find(/^Tread_GEO$/) ?? x, () => true));
    const c = b.getCenter(V(0, 0, 0)), e = b.getSize(V(0, 0, 0)).multiplyScalar(0.5);
    this.digger.box = this.physics.fixedBox({ x: c.x, y: 1.3, z: c.z }, { x: 1.6, y: 1.3, z: 2.4 });
    this.digger.size = e;
    this.digger.block = this.block(EXCAVATOR.at.x, EXCAVATOR.at.z, 2.8, 3);
  }

  // ------------------------------------------------------------------------------------- the city
  buildCity() {
    const s = this.scene, L = LOT;
    const win = (this.windows = { value: 1 });
    const put = (name, x, z, yaw = 0, sc = 1) => {
      if (!hasProp(name)) return null;
      const o = prop(name, { ownMaterials: true });
      o.position.set(x, 0, z);
      o.rotation.y = yaw;
      o.scale.setScalar(sc);
      o.traverse((m) => { if (m.isMesh) nightWindows(m.material, win); });
      s.add(o);
      return o;
    };
    // across the south street, across the east street, and close on the lot's other two sides
    for (const [name, x, z, yaw] of [['office5', -38, 62, Math.PI], ['office2', 0, 64, Math.PI], ['office4', 40, 60, Math.PI], ['office1', 82, 56, Math.PI],
      ['office6', 66, 12, -Math.PI / 2], ['office3', 70, -38, -Math.PI / 2],
      ['office4', -10, -56, 0], ['office2', 34, -58, 0], ['office5', -60, -40, Math.PI / 2], ['office6', -62, 6, Math.PI / 2]]) put(name, x, z, yaw);
    // downtown's towers behind
    for (const [name, x, z, sc, yaw] of [['office3', -130, -160, 2.2, 0.3], ['office1', -30, -210, 2.0, -0.2], ['office3', 90, -180, 1.9, 1.2], ['office4', 180, -90, 1.7, 0.5], ['office6', -200, -60, 1.3, 0.9], ['office1', 160, 140, 1.6, 2.4]]) put(name, x, z, yaw, sc);
    // street lamps along the kerbs, their heads lit and pools of light under them
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.32)');
    const head = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2.6, 1.7, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pool = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.55, 0.34, 0.14), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
    const lamps = [];
    for (let x = L.x0 - 10; x <= L.x1 + 10; x += 16) lamps.push([x, L.z1 + 4.2, 0], [x + 8, L.z1 + 14.3, Math.PI]);
    for (let z = L.z0 - 6; z <= L.z1; z += 16) lamps.push([L.x1 + 4.2, z, -Math.PI / 2]);
    let lit = 0;
    for (const [x, z, yaw] of lamps) {
      if (hasProp('cityprops')) { const o = piece('cityprops', KIT.lamp, { root: true }); o.position.set(x, 0.14, z); o.rotation.y = yaw; s.add(o); }
      const arm = V(0, 0, 1.6).applyAxisAngle(V(0, 1, 0), yaw);
      const sp = new THREE.Sprite(head);
      sp.position.set(x + arm.x, 7.6, z + arm.z);
      sp.scale.setScalar(1.6);
      s.add(sp);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), pool);
      p.position.set(x + arm.x, 0.16, z + arm.z);
      s.add(p);
      if (lit++ % 3 === 0) { const l = new THREE.PointLight(0xffb066, 30, 18, 2); l.position.set(x + arm.x, 7, z + arm.z); s.add(l); }
    }
    // parked cars along the far kerbs
    for (const [name, x, z, yaw, paint] of [['negotiator', -16, L.z1 + 12.9, Math.PI / 2, 0x3c4a5a], ['fairheaven', 14, L.z1 + 12.9, Math.PI / 2, 0x6b6450], ['sialia', L.x1 + 12.9, -14, Math.PI, 0x5b2420]]) {
      if (!hasProp(name)) continue;
      const car = makeCar(name, { paint, dust: 0.3 });
      car.position.set(x, 0, z);
      car.rotation.y = yaw;
      s.add(car);
    }
  }

  // ------------------------------------------------------------------------------------- his machine
  // What Atrocitus has built out of the cell he broke: its bars, bent into a cage of five spikes
  // round a heart of crystal fed with his blood, in a ring of Ysmault's script burnt into the
  // ground. It drains a Lantern's ring (the story runs that). `pulse` 0..1 drives it.
  buildDevice() {
    const s = this.scene, g = (this.device = new THREE.Group());
    g.position.copy(DEVICE);
    s.add(g);
    const iron = new THREE.MeshStandardMaterial({ color: 0x1a1716, metalness: 0.8, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.35, 10), iron);
    base.position.y = 0.17;
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, curve = new THREE.CatmullRomCurve3([V(Math.cos(a) * 1.15, 0.3, Math.sin(a) * 1.15), V(Math.cos(a) * 1.25, 1.2, Math.sin(a) * 1.25), V(Math.cos(a) * 0.75, 2.2, Math.sin(a) * 0.75), V(Math.cos(a) * 0.18, 2.75, Math.sin(a) * 0.18)]);
      const spike = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 6), iron);
      spike.castShadow = true;
      g.add(spike);
    }
    this.deviceU = { uPulse: { value: 0.3 }, uTime: { value: 0 } };
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: 0x300404, emissive: 0xff2010, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.1, flatShading: true }));
    heart.position.y = 1.35;
    g.add(heart);
    this.heart = heart;
    this.heartLight = new THREE.PointLight(0xff2a12, 25, 14, 2);
    this.heartLight.position.y = 1.4;
    g.add(this.heartLight);
    // the ring of script round it, on the ground
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const x = c.getContext('2d');
    x.translate(512, 512);
    x.strokeStyle = '#ff4020'; x.lineWidth = 6; x.shadowColor = '#ff2010'; x.shadowBlur = 16;
    for (const r of [470, 380]) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
    x.font = `64px ${getComputedStyle(document.documentElement).getPropertyValue('--glyph-font') || 'serif'}`;
    x.fillStyle = '#ff5030'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = toGlyphs('RAGE BLOOD HATE FIRE RAGE BLOOD HATE FIRE').split('');
    words.forEach((ch, i) => { const a = (i / words.length) * Math.PI * 2; x.save(); x.rotate(a); x.fillText(ch, 0, -425); x.restore(); });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.glyphs = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 0.4, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.glyphs.position.y = 0.05;
    g.add(this.glyphs);
    this.physics.fixedBox({ x: DEVICE.x, y: 1.2, z: DEVICE.z }, { x: 1.2, y: 1.2, z: 1.2 });
    this.block(DEVICE.x, DEVICE.z, 1.8, 2.8);
  }

  // Taken (the end of the fight): nothing left but scorched ground and the ring of script fading.
  removeDevice() {
    for (const o of [...this.device.children]) if (o !== this.glyphs) o.removeFromParent();
    this.deviceGone = true;
  }

  // ------------------------------------------------------------------------------------- helpers
  block(x, z, r, h) { const b = { x, z, r, h }; this.blocks.push(b); return b; }

  ground() { return 0; }

  airBounds() {
    return { ground: () => 0, floor: () => 0, canLand: (x, z) => Math.abs(x) < 200 && Math.abs(z) < 200, center: V(0, 0, 0), radius: 160, ceiling: 90 };
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    const near = THREE.MathUtils.clamp((camera.position.y - 4) * 0.01, 0.1, 1);
    if (Math.abs(near - camera.near) > 0.02) { camera.near = near; camera.updateProjectionMatrix(); }
    this.sky.position.copy(camera.position);
    this.sky.userData.uniforms.uTime.value = t;
    for (const [i, b] of (this.beacons ?? []).entries()) b.material.opacity = Math.sin(t * 2.2 + i * 0.7) > 0.2 ? 1 : 0.12;
    if (!this.deviceGone && this.heart) {
      const p = this.deviceU.uPulse.value, beat = 0.6 + 0.4 * Math.pow(Math.max(0, Math.sin(t * (2 + p * 4))), 6);
      this.heart.rotation.y += dt * (0.4 + p * 2);
      this.heart.material.emissiveIntensity = (0.8 + p * 3) * beat;
      this.heartLight.intensity = (14 + p * 60) * beat;
      this.glyphs.material.opacity = 0.45 + p * 0.55 * beat;
    } else if (this.glyphs) this.glyphs.material.opacity = Math.max(0, this.glyphs.material.opacity - dt * 0.15);
    for (const l of this.loose) l.update?.(dt);
    for (const fn of this.updaters) fn(dt, t, camera, renderer);
  }

  dispose() { this.physics.dispose(); }
}

// Office windows at night: the glass in a block's texture (bluish, darker than the stone round it)
// lit here and there, a warm lamp or a cold strip light behind one window in four, chosen by the
// window's cell on the façade (1.6 m across, 3.4 m a floor).
function nightWindows(mat, win) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = win;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNW, vNWN;').replace('#include <project_vertex>', '#include <project_vertex>\nvNW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNW, vNWN;\nuniform float uWin;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 wc = diffuseColor.rgb;
        float glass = smoothstep(0.0, 0.035, wc.b - wc.r) * (1.0 - smoothstep(0.3, 0.55, dot(wc, vec3(0.333))));
        vec3 cs = vec3(1.6, 3.4, 1.6), cell = floor(vNW / cs), f = fract(vNW / cs);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        // soft-edged in its cell (along the facade and up it), so a big pane reads as a lit room behind glass
        float across = abs(vNWN.x) > abs(vNWN.z) ? f.z : f.x;
        float room = smoothstep(0.0, 0.3, min(across, 1.0 - across)) * smoothstep(0.05, 0.4, min(f.y, 1.0 - f.y));
        vec3 lamp = h > 0.96 ? vec3(0.55, 0.66, 0.8) : vec3(0.9, 0.62, 0.34);
        totalEmissiveRadiance += lamp * glass * room * step(0.8, h) * (0.45 + 0.4 * fract(h * 17.0)) * uWin;
      }`);
  };
  mat.customProgramCacheKey = () => 'night-windows';
  mat.envMapIntensity = 0.3;
}
