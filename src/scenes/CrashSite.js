import * as THREE from 'three';
import { Physics, RAPIER } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { createWater } from '../fx/Water.js';
import { Fire, Particles } from '../fx/Particles.js';
import { treeKit, foliageMaterial, forest } from '../fx/Trees.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
};
const fbm = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.2;

export const WATER_LEVEL = -0.03;
export const shoreZ = (x) => -4 + 2.5 * Math.sin(x * 0.08) + 0.8 * Math.sin(x * 0.23 + 1.3);
const FURROW = [new THREE.Vector2(19, 3), new THREE.Vector2(7.5, -2.2)];
const segDist = (x, z, a, b) => {
  const abx = b.x - a.x, abz = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.y) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (a.x + abx * t), z - (a.y + abz * t));
};

// Ship placement (nose buried toward the lake, tail toward the furrow).
export const SHIP = { center: new THREE.Vector3(6.2, 0.15, -2.9), axis: new THREE.Vector2(0.79, 0.61).normalize() };
const N = new THREE.Vector2(-SHIP.axis.y, SHIP.axis.x);
const ABIN_XZ = new THREE.Vector2(SHIP.center.x + N.x * 1.45 - SHIP.axis.x * 0.8, SHIP.center.z + N.y * 1.45 - SHIP.axis.y * 0.8);

export function terrainHeight(x, z) {
  const s = z - shoreZ(x);
  let h = -0.85 + 1.1 * ss(-4, 3.5, s) + Math.max(0, s - 3.5) * 0.045 + ss(30, 80, s) * 6;
  h += (fbm(x * 0.25, z * 0.25) - 0.5) * 0.35 * ss(-1, 4, s) + (fbm(x * 1.3, z * 1.3) - 0.5) * 0.06;
  const d = segDist(x, z, FURROW[0], FURROW[1]);
  h += -0.38 * Math.exp(-((d / 1.3) ** 2)) + 0.16 * Math.exp(-(((d - 2) / 0.8) ** 2));
  // a rise of dry ground where Abin Sur dragged himself out against the hull
  h += 0.42 * Math.exp(-((Math.hypot(x - ABIN_XZ.x, z - ABIN_XZ.y) / 2.4) ** 2));
  return h;
}

export const ABIN_SPOT = new THREE.Vector3(ABIN_XZ.x, 0, ABIN_XZ.y);
ABIN_SPOT.y = terrainHeight(ABIN_SPOT.x, ABIN_SPOT.z);
export const ABIN_YAW = Math.atan2(N.x, N.y);
export const LANTERN_SPOT = new THREE.Vector3(ABIN_SPOT.x - SHIP.axis.x * 2.1 + N.x * 0.9, 0, ABIN_SPOT.z - SHIP.axis.y * 2.1 + N.y * 0.9);
LANTERN_SPOT.y = terrainHeight(LANTERN_SPOT.x, LANTERN_SPOT.z) + 0.02;
export const ARRIVAL = new THREE.Vector3(-5, 0, 7.5);
ARRIVAL.y = terrainHeight(ARRIVAL.x, ARRIVAL.z);

export class CrashSite {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.fires = [];
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x0b1018, 0.011);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.22;
    s.userData.exposure = 1.3;
    this.sky = createSky('night');
    s.add(this.sky);
    const su = this.sky.userData.uniforms;
    this.buildTerrain();
    this.water = createWater({ sunDir: su.uSunDir.value, skyTop: new THREE.Color(0x0b1220), skyHorizon: new THREE.Color(0x2a3446) });
    this.water.position.y = -0.03;
    s.add(this.water);
    this.buildFarShore();
    this.buildRocksAndGrass();
    this.buildShip();
    this.buildDebris();
    this.buildBounds();

    this.hemi = new THREE.HemisphereLight(0x5a6c90, 0x120e0a, 0.45);
    s.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xaab8dd, 1.3);
    moon.position.copy(su.uSunDir.value).multiplyScalar(40).add(new THREE.Vector3(2, 0, 2));
    moon.target.position.set(2, 0, 2);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 5, far: 90 });
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.04;
    s.add(moon, moon.target);
    this.moon = moon;

    const fireSpots = [
      [new THREE.Vector3(5.0, 0.95, -3.7), { radius: 0.45, height: 1.2 }],
      [new THREE.Vector3(8.3, 0, -1.2), { radius: 0.5, height: 1.0 }],
      [new THREE.Vector3(2.6, 0, -4.4), { radius: 0.3, height: 0.6, smoke: false }],
      [new THREE.Vector3(11.5, 0, 0.9), { radius: 0.35, height: 0.7, smoke: false }],
    ];
    for (const [p, o] of fireSpots) {
      if (p.y === 0) p.y = terrainHeight(p.x, p.z) + 0.02;
      const f = new Fire(p, o);
      s.add(f.group);
      this.fires.push(f);
    }
    this.sparks = new Particles(160, { additive: true, gravity: -9.8, drag: 0.2 });
    s.add(this.sparks.points);
    this.sparkPoint = new THREE.Vector3(7.3, 1.4, -2.0);
    return this;
  }

  buildTerrain() {
    const size = 140, seg = 200;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    geo.translate(0, 0, 25);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3), wet = new Float32Array(pos.count);
    const mud = new THREE.Color(0x231a13), grass = new THREE.Color(0x1d2814), dryGrass = new THREE.Color(0x2e3320), rock = new THREE.Color(0x2a2a2a), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const sh = z - shoreZ(x);
      const n = fbm(x * 0.4, z * 0.4);
      c.copy(mud).lerp(grass, ss(1.5, 4.5, sh + (n - 0.5) * 3));
      c.lerp(dryGrass, ss(0.55, 0.8, fbm(x * 0.1 + 9, z * 0.1)) * ss(3, 6, sh) * 0.6);
      c.lerp(rock, ss(0.62, 0.75, fbm(x * 0.7 + 3, z * 0.7)) * 0.6);
      const fd = segDist(x, z, FURROW[0], FURROW[1]);
      c.lerp(new THREE.Color(0x150f0b), Math.exp(-((fd / 1.8) ** 2)) * 0.85);
      colors.set([c.r, c.g, c.b], i * 3);
      wet[i] = 1 - ss(-0.2, 2.8, sh + (n - 0.5) * 1.5) + Math.exp(-((fd / 1.4) ** 2)) * 0.3;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aWet', new THREE.BufferAttribute(wet, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWet; varying float vWet;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = aWet;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWet;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, clamp(vWet, 0.0, 1.0));\ndiffuseColor.rgb *= mix(1.0, 0.6, clamp(vWet, 0.0, 1.0));');
    };
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.terrain = terrain;

    // Physics: a coarser trimesh over the playable area.
    const pg = new THREE.PlaneGeometry(64, 52, 96, 78).rotateX(-Math.PI / 2);
    pg.translate(2, 0, 6);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) pp.setY(i, terrainHeight(pp.getX(i), pp.getZ(i)));
    this.physics.fixedTrimesh(new THREE.Mesh(pg));
  }

  // The far shore: low wooded hills whose skyline is the tree line itself, plus forest inland
  // behind the player and framing both ends of the bay.
  buildFarShore() {
    const kit = treeKit();
    this.treeTime = { value: 0 };
    const mat = foliageMaterial(this.treeTime);
    const hill = (x, zl) => Math.max(0, (1 - (zl + 30) / 60) * (2.5 + fbm(x * 0.012, 3) * 6.5) - 0.8);
    const geo = new THREE.PlaneGeometry(760, 60, 152, 12).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hill(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x07090a, roughness: 1 }));
    ground.position.set(0, -0.5, -165);
    this.scene.add(ground);

    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
    const groups = { far0: [], far1: [], leafFar: [], near0: [], near1: [], near2: [], mid0: [], mid1: [], leaf: [] };
    // far shore: several staggered rows, taller toward the back so the canopy steps up
    for (let i = 0; i < 2600; i++) {
      const x = -380 + rnd() * 760, zl = -28 + rnd() * 52;
      const back = 1 - (zl + 28) / 52;
      const h = 9 + rnd() * 9 + back * 5;
      const spot = { x, y: hill(x, zl) - 0.6, z: -165 + zl, h, w: h * (0.85 + rnd() * 0.35) };
      (rnd() < 0.18 ? groups.leafFar : rnd() < 0.5 ? groups.far0 : groups.far1).push(spot);
    }
    // inland behind the player, and stands at both ends of the bay
    const place = (x, z, h, nearish) => {
      const spot = { x, y: terrainHeight(x, z) - 0.15, z, h, w: h * (0.85 + rnd() * 0.3) };
      if (rnd() < 0.22) { spot.w = h * (1.2 + rnd() * 0.5); groups.leaf.push(spot); return; }
      const v = Math.floor(rnd() * (nearish ? 3 : 2));
      groups[nearish ? `near${v}` : `mid${v}`].push(spot);
    };
    for (let i = 0; i < 420; i++) {
      const a = 0.05 * Math.PI + rnd() * 0.9 * Math.PI, d = 30 + rnd() * 48;
      const x = Math.cos(a) * d * 1.35, z = 8 + Math.sin(a) * d;
      if (Math.abs(x) < 31 && z < 29) continue; // keep the playable shore open
      place(x, z, 8 + rnd() * 9, d < 48);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 90; i++) {
      const x = side * (33 + rnd() * 45), z = shoreZ(x) + 2.5 + rnd() * 26;
      place(x, z, 7 + rnd() * 8, Math.abs(x) < 50);
    }
    const geos = { far0: kit.far[0], far1: kit.far[1], leafFar: kit.leaf[0], near0: kit.near[0], near1: kit.near[1], near2: kit.near[2], mid0: kit.mid[0], mid1: kit.mid[1], leaf: kit.leaf[1] };
    for (const [k, spots] of Object.entries(groups)) if (spots.length) this.scene.add(forest(geos[k], mat, spots));
  }

  buildRocksAndGrass() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2e2d2b, roughness: 0.55, metalness: 0.05 });
    const base = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(1, 3));
    const bp = base.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i);
      const n = fbm(v.x * 1.6 + 5, v.z * 1.6 + v.y * 1.3) * 0.75 + fbm(v.x * 5 + v.y * 3, v.z * 5) * 0.25;
      v.multiplyScalar(0.62 + n * 0.75);
      v.x *= 1.15;
      v.y *= 0.58;
      if (v.y > 0.35) v.y = 0.35 + (v.y - 0.35) * 0.4; // flattened, weathered tops
      bp.setXYZ(i, v.x, v.y, v.z);
    }
    base.computeVertexNormals();
    const rocks = [];
    const spots = [[-16, 11, 1.4], [-15.5, 6.5, 0.9], [-8, 13, 0.6], [-3, 2, 0.5], [1, 0.5, 0.35], [-14, 2, 0.8], [13, -1.5, 0.7], [3.5, -0.5, 0.45], [-2, 5, 0.3], [9, 2.5, 0.5], [14.5, 3.5, 1.1], [-6, -1, 0.6]];
    for (let i = 0; i < 40; i++) {
      const x = -18 + Math.random() * 36, z = shoreZ(x) + Math.random() * 6 - 0.5;
      // keep the walk from the arrival point to the wreck clear
      if (segDist(x, z, new THREE.Vector2(ARRIVAL.x, ARRIVAL.z), new THREE.Vector2(ABIN_SPOT.x, ABIN_SPOT.z)) < 1.6) continue;
      spots.push([x, z, 0.12 + Math.random() * 0.35]);
    }
    const inst = new THREE.InstancedMesh(base, rockMat, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, z, r], i) => {
      if (Math.hypot(x - ABIN_SPOT.x, z - ABIN_SPOT.z) < 1.5) z += 3;
      const y = terrainHeight(x, z) + r * 0.15;
      q.setFromEuler(new THREE.Euler(Math.random() * 0.4, Math.random() * 6, Math.random() * 0.4));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, r, r));
      inst.setMatrixAt(i, m);
      if (r > 0.25) this.physics.fixedCollider(RAPIER.ColliderDesc.ball(r * 0.6), { x, y, z });
      rocks.push([x, z]);
    });
    inst.castShadow = inst.receiveShadow = true;
    this.scene.add(inst);

    // grass tufts
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = 20 + Math.random() * 88, w = 2 + Math.random() * 3, top = 10 + Math.random() * 50;
      const grad = g.createLinearGradient(0, 128, 0, top);
      grad.addColorStop(0, '#1f2a12'); grad.addColorStop(1, '#5d6b38');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x - w, 128); g.quadraticCurveTo(x + (Math.random() - 0.5) * 30, top + 30, x + (Math.random() - 0.5) * 20, top); g.lineTo(x + w, 128); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const tuft = new THREE.PlaneGeometry(0.6, 0.45);
    tuft.translate(0, 0.22, 0);
    const tuft2 = tuft.clone().rotateY(Math.PI / 2);
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute([...tuft.attributes.position.array, ...tuft2.attributes.position.array], 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(tuft.attributes.position.count * 2).fill([0, 1, 0]).flat(), 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute([...tuft.attributes.uv.array, ...tuft2.attributes.uv.array], 2));
    merged.setIndex([...tuft.index.array, ...Array.from(tuft2.index.array, (k) => k + tuft.attributes.position.count)]);
    const grassMat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
    const grassInst = new THREE.InstancedMesh(merged, grassMat, 900);
    let n = 0;
    for (let i = 0; i < 4000 && n < 900; i++) {
      const x = -26 + Math.random() * 52, z = -6 + Math.random() * 30;
      const sh = z - shoreZ(x);
      if (sh < 1.2 + Math.random() * 2 || segDist(x, z, FURROW[0], FURROW[1]) < 2.2) continue;
      const k = 0.6 + Math.random() * 0.9;
      q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
      m.compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.02, z), q, new THREE.Vector3(k, k, k));
      grassInst.setMatrixAt(n++, m);
    }
    grassInst.count = n;
    grassInst.receiveShadow = true;
    this.scene.add(grassInst);
  }

  buildShip() {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2b2a2e, metalness: 0.85, roughness: 0.38 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a1f24, metalness: 0.6, roughness: 0.4 });
    const hotMat = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a14, emissiveIntensity: 2.5 });
    const ship = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const r = Math.sin(Math.PI * Math.pow(t, 0.7)) * 1.15 * (1 - 0.25 * t);
      prof.push(new THREE.Vector2(Math.max(0.02, r), t * 7.4 - 3.7));
    }
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), hullMat);
    hull.rotation.z = Math.PI / 2; // long axis along -x..+x (nose at +x end is t=1: narrow)
    hull.scale.set(1, 1, 0.85);
    ship.add(hull);
    for (const off of [-0.6, 0.3, 1.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0 - Math.abs(off) * 0.12, 0.035, 8, 40), trimMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = off;
      ring.scale.set(1, 1, 0.85);
      ship.add(ring);
    }
    // torn open cockpit: dark interior + shattered canopy frame
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, side: THREE.DoubleSide }));
    cockpit.scale.set(1.6, 0.55, 0.9);
    cockpit.position.set(0.5, 0.72, 0.18);
    cockpit.rotation.x = 0.35;
    ship.add(cockpit);
    for (let i = 0; i < 5; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7 + Math.random() * 0.4, 0.04), hullMat);
      shard.position.set(-0.5 + i * 0.45, 1.05, 0.55 + Math.random() * 0.2);
      shard.rotation.set(0.6 + Math.random() * 0.5, 0, (Math.random() - 0.5) * 0.6);
      ship.add(shard);
    }
    const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: 0x002a10, emissive: 0x33ff77, emissiveIntensity: 1.4 }));
    glowStrip.position.set(0.4, 0.45, 0.92);
    ship.add(glowStrip);
    this.shipGlow = glowStrip.material;
    // tall swept tail fin and a broken wing
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.lineTo(-2.2, 3.4); finShape.lineTo(-2.9, 3.4); finShape.lineTo(-2.4, 0); finShape.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }), hullMat);
    fin.position.set(-1.6, 0.55, -0.06);
    ship.add(fin);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.8, 0); wingShape.lineTo(-1.6, 2.6); wingShape.lineTo(-2.3, 2.4); wingShape.lineTo(-1.8, 0); wingShape.closePath();
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.1, bevelEnabled: false }), hullMat);
    wing.rotation.x = -Math.PI / 2 + 0.35;
    wing.position.set(-0.6, -0.1, -0.7);
    ship.add(wing);
    // glowing tears in the hull
    for (const [x, y, z, w] of [[1.4, 0.3, 0.85, 0.5], [-1.0, 0.8, -0.6, 0.35], [-2.1, 0.2, 0.7, 0.3]]) {
      const tear = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), hotMat);
      tear.position.set(x, y, z);
      tear.rotation.z = Math.random() - 0.5;
      ship.add(tear);
    }
    ship.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // orient: long axis along SHIP.axis, nose (+x local) toward the lake, tilted and dug in
    const yaw = Math.atan2(-SHIP.axis.y, SHIP.axis.x);
    ship.rotation.set(0.28, yaw + Math.PI, -0.12, 'YXZ');
    ship.position.copy(SHIP.center);
    this.scene.add(ship);
    this.ship = ship;
    // colliders: a capsule along the hull, a box for the fin
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(SHIP.axis.x, 0, SHIP.axis.y));
    this.physics.fixedCollider(RAPIER.ColliderDesc.capsule(2.4, 1.0), { x: SHIP.center.x, y: SHIP.center.y + 0.3, z: SHIP.center.z }, q);
    const tail = new THREE.Vector3(SHIP.center.x + SHIP.axis.x * 2.6, 1.6, SHIP.center.z + SHIP.axis.y * 2.6);
    this.physics.fixedCollider(RAPIER.ColliderDesc.cuboid(0.15, 1.6, 1.2), tail, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }

  buildDebris() {
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0x2c2b30, metalness: 0.85, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x4a1b20, metalness: 0.6, roughness: 0.45 }),
    ];
    this.hotDebris = [];
    for (let i = 0; i < 26; i++) {
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const p = geo.attributes.position, v = new THREE.Vector3();
      const sx = 0.15 + Math.random() * 0.5, sy = 0.04 + Math.random() * 0.12, sz = 0.12 + Math.random() * 0.35;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k);
        p.setXYZ(k, v.x * sx * (0.7 + Math.random() * 0.6), v.y * sy, v.z * sz * (0.7 + Math.random() * 0.6));
      }
      geo.computeVertexNormals();
      const hot = i % 5 === 0;
      const mat = hot ? new THREE.MeshStandardMaterial({ color: 0x1e1c1d, metalness: 0.7, roughness: 0.55, emissive: 0x8a1e04, emissiveIntensity: 0.45 }) : mats[i % 2];
      const mesh = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2, d = 1.8 + Math.random() * 6;
      const x = SHIP.center.x + Math.cos(a) * d, z = SHIP.center.z + Math.sin(a) * d * 0.8 + 1;
      mesh.position.set(x, terrainHeight(x, z) + 0.3 + Math.random() * 0.3, z);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      const pts = Float32Array.from(geo.attributes.position.array);
      this.physics.dynamic(mesh, RAPIER.ColliderDesc.convexHull(pts), { density: 900, angularDamping: 0.6, damping: 0.2, friction: 0.9 });
      if (hot) this.hotDebris.push(mat);
    }
  }

  buildBounds() {
    // Keep Hal out of deep water and inside the playable shore. The handles let aiming and flight
    // pass through these invisible walls.
    this.bounds = new Set();
    for (let x = -30; x <= 30; x += 1.5) {
      const z = shoreZ(x) - 1.6, z2 = shoreZ(x + 1.5) - 1.6;
      const yaw = Math.atan2(-(z2 - z), 1.5);
      const b = this.physics.fixedCollider(RAPIER.ColliderDesc.cuboid(0.9, 2, 0.2), { x: x + 0.75, y: 0.5, z: (z + z2) / 2 }, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      this.bounds.add(b.collider(0).handle);
    }
    for (const [x, z, hx, hz] of [[-30, 10, 0.3, 20], [30, 10, 0.3, 20], [0, 28, 30, 0.3]]) this.bounds.add(this.physics.fixedBox({ x, y: 1, z }, { x: hx, y: 3, z: hz }).collider(0).handle);
  }

  // The forest around the shore, as a solid block below the canopy (the trees have no colliders;
  // flight treats this as a wall so Hal goes over the treeline, not through it).
  inTrees(x, y, z) {
    const land = z > shoreZ(x) + 2;
    return land && (Math.abs(x) > 32 || z > 29.5) && y < terrainHeight(x, z) + 15;
  }

  // Where Hal can stand: inside the bounds and above the waterline.
  canLand(x, z) {
    return Math.abs(x) < 29 && z < 27.3 && z > shoreZ(x) - 1.2 && terrainHeight(x, z) > -0.25;
  }

  // A torn piece of hull as a physics body, optionally glowing hot; `velocity` throws it.
  spawnDebris(position, { size = [0.5, 0.1, 0.4], velocity, spin = 4, hot = true, density = 600 } = {}) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      p.setXYZ(k, v.x * size[0] * (0.75 + Math.random() * 0.5), v.y * size[1], v.z * size[2] * (0.75 + Math.random() * 0.5));
    }
    geo.computeVertexNormals();
    const mat = hot
      ? new THREE.MeshStandardMaterial({ color: 0x1e1c1d, metalness: 0.7, roughness: 0.5, emissive: 0xff4a10, emissiveIntensity: 0.55 })
      : new THREE.MeshStandardMaterial({ color: 0x2c2b30, metalness: 0.85, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    mesh.castShadow = mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.physics.dynamic(mesh, RAPIER.ColliderDesc.convexHull(Float32Array.from(geo.attributes.position.array)), { density, angularDamping: 0.5, damping: 0.15, friction: 0.9, restitution: 0.15 });
    if (velocity) {
      body.setLinvel(velocity, true);
      body.setAngvel({ x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin }, true);
    }
    if (hot) this.hotDebris.push(mat);
    return { body, mesh, mat };
  }

  // Secondary blast from the wreck: debris flies, fires flare.
  explode(center = new THREE.Vector3(6.5, 0.6, -3), strength = 7) {
    this.physics.burst(center, strength, 9, 4.5, 2);
    for (const f of this.fires) f.intensity = 2.5;
    this.sparks.emit(120, (p, v) => {
      p[0] = center.x; p[1] = center.y + 0.5; p[2] = center.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2;
      v[0] = Math.cos(a) * 6 * Math.cos(e); v[1] = 3 + Math.random() * 7; v[2] = Math.sin(a) * 6 * Math.cos(e);
    }, { life: 2.2, size: [0.06, 0.02], color: [[5, 2.2, 0.6, 1], [2, 0.4, 0.05, 0]] });
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    this.sky.userData.uniforms.uTime.value = t;
    this.treeTime.value = t;
    const wu = this.water.userData;
    wu.uniforms.uTime.value = t;
    this.fires.forEach((f, i) => {
      f.intensity += ((this.fireRest ?? 1) - f.intensity) * dt * 0.6; // (fireRest: lower, hours on)
      f.update(dt, t, camera, renderer);
      wu.setLight(i, f.light.position, _fire, f.light.intensity * 0.16);
    });
    if (Math.random() < dt * 0.7) {
      const c = this.sparkPoint;
      this.sparks.emit(14, (p, v) => {
        p[0] = c.x; p[1] = c.y; p[2] = c.z;
        v[0] = (Math.random() - 0.5) * 2.5; v[1] = Math.random() * 2.5; v[2] = (Math.random() - 0.5) * 2.5;
      }, { life: 0.9, size: [0.03, 0.01], color: [[4, 3, 1.5, 1], [3, 0.8, 0.2, 0]] });
    }
    this.sparks.update(dt, t, camera, renderer);
    this.shipGlow.emissiveIntensity = 1.2 + Math.sin(t * 9) * 0.3 + (Math.random() < 0.03 ? -1 : 0) + (this.glowBoost ?? 0);
    for (const m of this.hotDebris) m.emissiveIntensity = Math.max(0.08, m.emissiveIntensity - dt * 0.01);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}
const _fire = new THREE.Color(1, 0.45, 0.12);
