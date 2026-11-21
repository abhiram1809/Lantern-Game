import * as THREE from 'three';
import { Physics, RAPIER } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { glowTexture } from '../fx/Textures.js';
import { prop, hasProp } from '../props/Props.js';
import { Smash } from '../props/Smash.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { violetCrystal, keptCrystal, litScan, crystalTime } from '../fx/Crystal.js';

// Zamaron (Part Seven): the Zamarons' world, past the charts. From the comics: a world of the violet
// crystal (in the 2008 run it grew there from the remains of two lovers), the Zamarons and their Star
// Sapphires, the ones the Sapphires love kept in crystal. Ours: how it looks. A valley under a long rose
// evening, its floor pale quartz, ringed by cliffs of amethyst (real geodes, scanned, grown to a hundred
// metres); north up the valley:
//   the garden   the Kept, a dozen crystals either side of a path, each holding someone loved, asleep
//                standing, lit from the plinth; Star Sapphires come to tend them
//   the court    a round of pale stone where the path meets the way on, a fountain of their light
//   the citadel  a stair up to a plaza ringed by spires of crystal nearly a hundred metres tall; over its
//                middle, turning, their battery: a crystal the size of a house, its light going up
// North is -Z. Everything is touchable (props/Smash.js): the small crystals break, the rest is solid.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ZAMARON_PROPS = ['crystal_cluster', 'crystal_giant', 'crystal_formation', 'crystal_rocks', 'amethyst', 'crystal_shard', 'stibnite', 'plant_glow', 'plant_bulbs'];
export const ARRIVE = V(0, 62, 250); // where Hal comes down out of the sky, flying north (in through the valley's open south)
export const LANDING = V(0, 0, 122); // the garden's mouth, where their light sets him down
export const COURT = V(0, 0, 2); // the round court, the fountain at its middle
export const STAIR = [-88, -112]; // the stair's foot and head (z)
const STEPS = 24, RISE = 0.25, RUN = (STAIR[0] - STAIR[1]) / STEPS;
export const PLAZA = V(0, 6, -156), PLAZA_R = 38; // the citadel's floor
export const BATTERY = PLAZA.clone().add(V(0, 36, 0));
export const THRONE = PLAZA.clone().add(V(0, 0, -26)); // the dais on the plaza's north side
export const GATE = V(0, 6, STAIR[1] - 3); // the stair's head, between the gate crystals
// the Kept: six either side of the garden's path, facing it
export const KEPT = [98, 82, 66, 50, 34, 18].flatMap((z, i) => [-1, 1].map((s) => ({ at: V(s * 7.6, 0.5, z - (s > 0 ? 4 : 0)), yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, side: s, i: i * 2 + (s > 0 ? 1 : 0) })));
const PLINTH = 0.5;

let seed = 41;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The valley floor: low dunes of quartz, flattened along the garden, the court, the way on and round the
// citadel, rising to the rim's hills
export function zamaronHeight(x, z) {
  let h = 1.4 * Math.sin(x * 0.019 + z * 0.011) + 0.9 * Math.sin(z * 0.031 - x * 0.016 + 1.3) + 0.5 * Math.sin(x * 0.067 + 2.1) * Math.sin(z * 0.053);
  const r = Math.hypot(x, z + 40);
  h += smooth(250, 560, r) * 70 + smooth(420, 700, r) * 40;
  // (the way: flat within 14 m of the path from the garden's mouth to the stair, and round the citadel)
  const lane = z < 150 && z > -100 ? 1 - smooth(14, 44, Math.abs(x)) : 0;
  const cit = 1 - smooth(PLAZA_R + 10, PLAZA_R + 60, Math.hypot(x - PLAZA.x, z - PLAZA.z));
  return h * (1 - Math.max(lane, cit));
}

export class Zamaron {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.time = { value: 0 };
    this.blocks = [];
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x6e3e68, 0.0016);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.22;
    s.userData.exposure = 0.92;
    s.userData.far = 2400;
    s.userData.near = 0.1;
    this.sky = createSky('zamaron', 1100);
    s.add(this.sky);
    const sunDir = (this.sunDir = this.sky.userData.uniforms.uSunDir.value);
    s.add((this.hemi = new THREE.HemisphereLight(0xb880c0, 0x3a2030, 0.5)));
    const key = (this.key = new THREE.DirectionalLight(0xffd8e6, 1.3));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 500 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    s.add(key, key.target);
    this.focus(LANDING);
    this.smash = new Smash(this.physics, s);
    this.crystal = violetCrystal({ glow: 0.5, scale: 0.05 });
    this.darkCrystal = violetCrystal({ color: 0x24122e, deep: 0x0c0412, rim: [0.8, 0.3, 1.0], glow: 0.3, roughness: 0.22, scale: 0.08 });
    this.paleCrystal = violetCrystal({ color: 0xc89ad8, deep: 0x5a2a74, rim: [1.1, 0.6, 1.2], glow: 0.35, roughness: 0.12, scale: 0.06 });
    this.buildGround();
    this.buildMoons(sunDir);
    this.buildCliffs();
    this.buildSpikes();
    this.buildClusters();
    this.buildGarden();
    this.buildCourt();
    this.buildCitadel();
    this.buildFlora();
    this.buildMotes();
    return this;
  }

  // the sun's shadow box, moved to follow (in whole texels: a following box that slides shimmers)
  focus(at) {
    const texel = 120 / 2048, d = this.sunDir;
    const x = Math.round(at.x / texel) * texel, z = Math.round(at.z / texel) * texel;
    this.key.target.position.set(x, at.y, z);
    this.key.position.set(x, at.y, z).addScaledVector(d, 220);
    this.key.target.updateMatrixWorld();
  }

  // the height of what's underfoot: the steps' own tops on the stair (for the feet), the plaza, the valley
  ground(x, z) {
    const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
    if (dp < PLAZA_R + 0.2) return PLAZA.y;
    if (Math.abs(x) < 7 && z < STAIR[0] && z > STAIR[1]) return Math.min(STEPS, Math.ceil((STAIR[0] - z) / RUN - 1e-3)) * RISE;
    if (z <= STAIR[1] && z > STAIR[1] - 10 && Math.abs(x) < 7) return PLAZA.y;
    return zamaronHeight(x, z);
  }

  // the stair as the slope a body rides up (Hal's capsule, a walker's root): the line through its steps'
  // noses, so no tread is ever above the root (the foot IK only lowers the hips; a tread above them bends
  // both knees, a squat), meeting the ground a run short of the first step and the plaza a run short of
  // the last
  ramp(x, z) {
    if (Math.abs(x) < 7 && z < STAIR[0] + RUN && z > STAIR[1]) return Math.min(PLAZA.y, PLAZA.y * (STAIR[0] + RUN - z) / (STAIR[0] - STAIR[1]));
    return this.ground(x, z);
  }

  // -------------------------------------------------------------------------------------- ground
  buildGround() {
    const size = 1800, seg = 300;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, zamaronHeight(P.getX(i), P.getZ(i)));
    geo.computeVertexNormals();
    this.groundMat = quartz();
    const mesh = new THREE.Mesh(geo, this.groundMat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const n = 360;
    this.physics.fixedHeights(size, size, n, n, zamaronHeight);
  }

  // A gas giant low in the west, banded rose and cream, and a small moon by it
  buildMoons(sunDir) {
    const g = (this.moons = new THREE.Group());
    const giant = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir.clone() } }, fog: false,
      vertexShader: 'varying vec3 vN, vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uSun; varying vec3 vN, vP;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        void main(){ vec3 d = normalize(vP); float lat = d.y;
          float band = sin(lat * 22.0 + sin(lat * 7.0 + d.x * 2.0) * 1.4) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.78, 0.5, 0.58), vec3(0.96, 0.86, 0.8), band);
          c = mix(c, vec3(0.5, 0.22, 0.42), smoothstep(0.7, 0.95, sin(lat * 9.0 + 1.0)) * 0.6);
          float lit = max(dot(normalize(vN), uSun), 0.0);
          float rimA = pow(1.0 - abs(normalize(vN).z), 3.0);
          gl_FragColor = vec4(c * (0.06 + 1.1 * lit) + vec3(0.6, 0.3, 0.55) * rimA * 0.1, 1.0); }`,
    }));
    giant.position.set(-640, 260, -700);
    g.add(giant);
    // its ring, edge-on-ish
    const ringGeo = new THREE.RingGeometry(205, 272, 96);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.38, 0.5), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.position.copy(giant.position);
    ring.rotation.set(1.25, 0.2, 0.35);
    g.add(ring);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.86, 0.92), fog: false }));
    moon.position.set(-330, 380, -900);
    g.add(moon);
    this.scene.add(g);
  }

  // ------------------------------------------------------------------------------- the valley's rim
  // Amethyst geodes, the real stone scanned: grown to cliffs round the valley, their violet tips lit
  buildCliffs() {
    if (!hasProp('amethyst')) return;
    let mats = null;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rnd() * 0.25, r = 300 + rnd() * 150;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; // (the valley opens to the south: the way he comes in)
      const x = Math.sin(a) * r, z = -40 + Math.cos(a) * r;
      const c = prop('amethyst');
      mats ??= new Map();
      c.traverse((m) => { if (m.isMesh) { m.material = mats.get(m.material) ?? mats.set(m.material, litScan(m.material, { glow: 0.8 })).get(m.material); m.castShadow = false; m.receiveShadow = true; } });
      const sc = 16 + rnd() * 18;
      c.scale.setScalar(sc);
      c.position.set(x, zamaronHeight(x, z) - sc * 0.6, z);
      c.rotation.set((rnd() - 0.5) * 0.3, a + Math.PI + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.3);
      this.scene.add(c);
      this.smash.solid(c, { stuff: 'stone', mesh: true });
    }
  }

  // stibnite spikes, dark, in stands across the valley's sides: needles of crystal three storeys tall
  buildSpikes() {
    if (!hasProp('stibnite')) return;
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = 70 + rnd() * 190;
      const x = Math.sin(a) * r, z = -40 + Math.cos(a) * r;
      if (Math.abs(x) < 34 && z > -110 && z < 160) continue; // (not on the way)
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA_R + 30) continue;
      const c = prop('stibnite');
      c.traverse((m) => { if (m.isMesh) { m.material = this.darkCrystal; m.castShadow = true; m.receiveShadow = true; } });
      const sc = 4 + rnd() * 5;
      c.scale.setScalar(sc);
      c.position.set(x, zamaronHeight(x, z) - 0.6, z);
      c.rotation.set((rnd() - 0.5) * 0.25, rnd() * 6.28, (rnd() - 0.5) * 0.25);
      this.scene.add(c);
      this.smash.solid(c, { stuff: 'stone', mesh: true });
    }
  }

  // crystal growing out of the quartz everywhere: big stands off the way, small ones by it that break
  buildClusters() {
    const kinds = ['crystal_rocks', 'crystal_formation', 'crystal_cluster'].filter(hasProp);
    if (!kinds.length) return;
    for (let i = 0; i < 90; i++) {
      const near = i < 40;
      const z = near ? 130 - rnd() * 220 : -40 + (rnd() - 0.5) * 520;
      const x = near ? (rnd() < 0.5 ? -1 : 1) * (9 + rnd() * 14) : (rnd() - 0.5) * 520;
      if (!near && Math.abs(x) < 26 && z > -110 && z < 160) continue;
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA_R + 4) continue;
      if (Math.hypot(x - COURT.x, z - COURT.z) < 14) continue;
      if (KEPT.some((k) => Math.hypot(x - k.at.x, z - k.at.z) < 3.5)) continue;
      const kind = kinds[i % kinds.length];
      const c = prop(kind);
      const mat = i % 5 === 0 ? this.paleCrystal : this.crystal;
      c.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = true; m.receiveShadow = true; } });
      const base = { crystal_rocks: 1.2, crystal_formation: 2.2, crystal_cluster: 6 }[kind];
      const want = near ? 0.8 + rnd() * 2.2 : 3 + rnd() * 16;
      c.scale.setScalar(want / base);
      c.position.set(x, zamaronHeight(x, z) - 0.1, z);
      c.rotation.set((rnd() - 0.5) * 0.3, rnd() * 6.28, (rnd() - 0.5) * 0.3);
      this.scene.add(c);
      if (near && want < 2.4) this.smash.add(c, { kind: 'breaks', strong: 14, mass: 120 * want, stuff: 'stone', glass: false });
      else this.smash.solid(c, { stuff: 'stone', mesh: want > 5 });
    }
  }

  // ------------------------------------------------------------------------------------- the garden
  // The path of pale slabs from the garden's mouth to the court, and the Kept either side of it: each a
  // crystal on a plinth, lit from below. The story stands someone in each (`kept[i].hold(figure)`).
  buildGarden() {
    const s = this.scene;
    const slab = new THREE.MeshStandardMaterial({ color: 0xd2bfcd, roughness: 0.5, metalness: 0.02 });
    const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 0.12, 1.9), slab, 140);
    let n = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    // the garden's path and on to the stair: slabs every two metres, a few turned a little
    for (let z = 136; z > STAIR[0] + 1; z -= 2.05) {
      if (Math.hypot(COURT.x, z - COURT.z) < 11) continue; // (the court has its own floor)
      q.setFromAxisAngle(V(0, 1, 0), (rnd() - 0.5) * 0.04);
      m4.compose(V((rnd() - 0.5) * 0.08, 0.03, z), q, V(1, 1, 1));
      slabs.setMatrixAt(n, m4);
      slabs.setColorAt(n++, new THREE.Color().setHSL(0.9 + rnd() * 0.04, 0.12 + rnd() * 0.1, 0.72 + rnd() * 0.1)); // (each stone a little its own)
    }
    slabs.count = n;
    slabs.receiveShadow = true;
    slabs.instanceMatrix.needsUpdate = true;
    if (slabs.instanceColor) slabs.instanceColor.needsUpdate = true;
    s.add(slabs);
    // the plinths and the crystals
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xd8c4d4, roughness: 0.38, metalness: 0.05 });
    const shardMap = hasProp('crystal_shard') ? firstMap(prop('crystal_shard')) : null;
    this.keptMat = keptCrystal({ map: shardMap });
    const glowTex = glowTexture('rgba(255,255,255,1)', 'rgba(200,110,255,0.4)');
    this.kept = KEPT.map((k) => {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, PLINTH, 6), plinthMat);
      plinth.position.copy(k.at).setY(PLINTH / 2);
      plinth.rotation.y = k.yaw;
      plinth.castShadow = plinth.receiveShadow = true;
      s.add(plinth);
      this.smash.solid(plinth, { stuff: 'stone', shrink: 1 });
      let crystal = null;
      if (shardMap || hasProp('crystal_shard')) {
        crystal = prop('crystal_shard');
        crystal.traverse((m) => { if (m.isMesh) { m.material = this.keptMat; m.castShadow = false; m.renderOrder = 2; } });
        crystal.scale.set(1.25, 1.24, 1.25);
        crystal.position.copy(k.at).setY(PLINTH - 0.85);
        crystal.rotation.y = k.yaw + Math.PI / 6;
        s.add(crystal);
      }
      // (a solid round the figure: struck, it sparks and holds)
      const hold = new THREE.Object3D();
      hold.position.copy(k.at).setY(PLINTH);
      s.add(hold);
      const item = this.smash.add(hold, { kind: 'solid', box: new THREE.Box3(V(-0.95, 0, -0.95), V(0.95, 3.0, 0.95)), stuff: 'stone', shrink: 1 });
      item.kept = k;
      // the light from the plinth, up through the crystal
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.9, 0.4, 1.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
      gl.position.copy(k.at).setY(PLINTH + 0.1);
      gl.scale.set(2.6, 1.0, 1);
      s.add(gl);
      this.blocks.push({ x: k.at.x, z: k.at.z, r: 1.6, h: 3.2 });
      return {
        ...k, crystal, item, glow: gl, figure: null,
        // stand someone in it: their feet on the plinth, facing the path
        hold(fig) {
          this.figure = fig;
          fig.root.position.copy(k.at).setY(PLINTH);
          fig.root.rotation.set(0, k.yaw, 0);
          s.add(fig.root);
        },
      };
    });
  }

  // the court: a round floor of the same pale stone, low benches of crystal round it, and the fountain:
  // their light welling up out of a bowl and falling back as motes
  buildCourt() {
    const s = this.scene, C = COURT;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.2, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0xdccad8, roughness: 0.6, metalness: 0.03 }));
    floor.position.copy(C).setY(0.04);
    floor.receiveShadow = true;
    s.add(floor);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xcdb6cc, roughness: 0.55, metalness: 0.06 });
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.8, 0.05], [2.4, 0.5], [2.6, 0.95], [2.45, 1.0], [2.2, 0.7], [0, 0.6]].map(([x, y]) => new THREE.Vector2(x, y)), 48), bowlMat);
    bowl.position.copy(C).setY(0.1);
    bowl.castShadow = bowl.receiveShadow = true;
    s.add(bowl);
    this.physics.fixedCollider(RAPIER.ColliderDesc.cylinder(0.55, 2.55), { x: C.x, y: 0.65, z: C.z });
    this.blocks.push({ x: C.x, z: C.z, r: 2.8, h: 1.2 });
    // the light in it
    const well = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.24, 0.8) }));
    well.position.copy(C).setY(0.92);
    s.add(well);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 4.2, 16, 1, true).translate(0, 2.1, 0), new THREE.ShaderMaterial({
      uniforms: { uTime: this.time }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vU; void main(){ float s = pow(sin(vU.x * 6.2832 * 4.0 + uTime * 3.0 + vU.y * 9.0) * 0.5 + 0.5, 3.0);
        gl_FragColor = vec4(vec3(0.8, 0.3, 1.1) * (0.3 + 0.7 * s) * (1.0 - vU.y) * smoothstep(0.0, 0.1, vU.y) * 0.6, 1.0); }`,
    }));
    jet.position.copy(C).setY(0.9);
    s.add(jet);
    this.fountainLight = new THREE.PointLight(0xc070ff, 16, 20, 1.8);
    this.fountainLight.position.copy(C).setY(2.2);
    s.add(this.fountainLight);
    // benches: low slabs of pale crystal round the court's edge (to sit on, in time)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.46, 0.7), this.paleCrystal);
      b.position.copy(C).add(V(Math.sin(a) * 8.6, 0.23, Math.cos(a) * 8.6));
      b.rotation.y = a;
      b.castShadow = b.receiveShadow = true;
      s.add(b);
      this.smash.solid(b, { stuff: 'stone', shrink: 1 });
    }
  }

  // --------------------------------------------------------------------------------- the citadel
  buildCitadel() {
    const s = this.scene, P = PLAZA;
    const stone = new THREE.MeshStandardMaterial({ color: 0xd2bed0, roughness: 0.62, metalness: 0.04 }); // (polished, the battery's light made a white sun on it)
    // the stair: twenty-four broad steps (drawn), walked as the slope through their noses (a ramp
    // collider: the controller steps only a quarter metre, and the feet find the steps: `ground`)
    for (let i = 0; i < STEPS; i++) {
      const z0 = STAIR[0] - i * RUN, h = (i + 1) * RISE;
      const st = new THREE.Mesh(new THREE.BoxGeometry(14, h, RUN + 0.02), stone);
      st.position.set(0, h / 2, z0 - RUN / 2);
      st.castShadow = st.receiveShadow = true;
      s.add(st);
    }
    const len = Math.hypot(STAIR[0] - STAIR[1], P.y), ang = Math.atan2(P.y, STAIR[0] - STAIR[1]);
    const rq = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), ang), top = V(0, Math.cos(ang), Math.sin(ang));
    const rc = V(0, P.y / 2, (STAIR[0] + STAIR[1]) / 2 + RUN).addScaledVector(top, -0.25); // (a run down: through the noses, as `ramp`)
    this.physics.fixedBox({ x: rc.x, y: rc.y, z: rc.z }, { x: 7, y: 0.25, z: len / 2 + 0.3 }, { x: rq.x, y: rq.y, z: rq.z, w: rq.w });
    // (the stair's sides, solid)
    this.physics.fixedBox({ x: -7.3, y: P.y / 2, z: (STAIR[0] + STAIR[1]) / 2 }, { x: 0.3, y: P.y / 2, z: (STAIR[0] - STAIR[1]) / 2 });
    this.physics.fixedBox({ x: 7.3, y: P.y / 2, z: (STAIR[0] + STAIR[1]) / 2 }, { x: 0.3, y: P.y / 2, z: (STAIR[0] - STAIR[1]) / 2 });
    // a landing at the head of it, up to the plaza's edge
    const landing = new THREE.Mesh(new THREE.BoxGeometry(14, P.y, 10), stone);
    landing.position.set(0, P.y / 2, STAIR[1] - 5);
    landing.castShadow = landing.receiveShadow = true;
    s.add(landing);
    this.physics.fixedBox({ x: 0, y: P.y / 2, z: STAIR[1] - 5 + RUN / 2 }, { x: 7, y: P.y / 2, z: 5 + RUN / 2 }); // (and the top tread, where the ramp meets it)
    // the plaza: a drum of the stone (a prism of 32 sides: walked on as a hull)
    const sides = 32, drum = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R, PLAZA_R + 1.5, P.y, sides), stone);
    drum.position.set(P.x, P.y / 2, P.z);
    drum.castShadow = drum.receiveShadow = true;
    s.add(drum);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pts.push(Math.cos(a) * PLAZA_R, P.y / 2, Math.sin(a) * PLAZA_R, Math.cos(a) * (PLAZA_R + 1.5), -P.y / 2, Math.sin(a) * (PLAZA_R + 1.5));
    }
    this.physics.fixedCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(pts)), { x: P.x, y: P.y / 2, z: P.z });
    // its floor inlaid: a star of violet in the pale stone, under the battery
    const inlay = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R - 1, 64).rotateX(-Math.PI / 2), inlayMaterial(this.time));
    inlay.position.set(P.x, P.y + 0.012, P.z);
    inlay.receiveShadow = true;
    s.add(inlay);
    // its rim: a low parapet of the stone capped with pale crystal, open where the stair comes up (a 6 m
    // drop with nothing at its edge: a blow in the Predator's fight threw Hal off it, out of its reach)
    const segs = 72, R = PLAZA_R - 0.35, w = (2 * Math.PI * R) / segs + 0.08, wallH = 1.05;
    const wall = [], cap = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.22) continue; // (the stair's head, to the south)
      const x = P.x + Math.sin(a) * R, z = P.z + Math.cos(a) * R;
      q.setFromAxisAngle(V(0, 1, 0), a);
      m4.compose(V(x, P.y + wallH / 2, z), q, V(1, 1, 1));
      wall.push(new THREE.BoxGeometry(w, wallH, 0.55).applyMatrix4(m4));
      m4.compose(V(x, P.y + wallH + 0.06, z), q, V(1, 1, 1));
      cap.push(new THREE.BoxGeometry(w, 0.12, 0.68).applyMatrix4(m4));
      this.physics.fixedBox({ x, y: P.y + 0.7, z }, { x: w / 2, y: 0.7, z: 0.3 }, { x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const parapet = new THREE.Mesh(mergeGeometries(wall), stone);
    parapet.castShadow = parapet.receiveShadow = true;
    s.add(parapet);
    const rim = new THREE.Mesh(mergeGeometries(cap), this.paleCrystal);
    rim.receiveShadow = true;
    s.add(rim);
    // the spires round it: the giant crystal and the clusters, leaning out
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
      if (Math.cos(a) > 0.55) continue; // (the stair comes in from the south: nothing in its way, or its view)
      const giant = i % 2 === 0 && hasProp('crystal_giant');
      const c = prop(giant ? 'crystal_giant' : hasProp('crystal_cluster') ? 'crystal_cluster' : 'crystal_giant');
      c.traverse((m) => { if (m.isMesh) { m.material = i % 3 === 0 ? this.paleCrystal : this.crystal; m.castShadow = true; m.receiveShadow = true; } });
      // (the clusters are as wide as they're tall: further out)
      const r = PLAZA_R + (giant ? 9 : 22) + rnd() * 6;
      c.position.set(P.x + Math.sin(a) * r, 0, P.z + Math.cos(a) * r);
      c.scale.setScalar(giant ? 7.5 + rnd() * 2 : 7 + rnd() * 2);
      c.rotation.set(Math.cos(a) * 0.12, a + rnd() * 0.6, -Math.sin(a) * 0.12);
      s.add(c);
      this.smash.solid(c, { stuff: 'stone', mesh: true });
    }
    // the gate: two tall crystals either side of the stair's head
    for (const sx of [-1, 1]) {
      const c = prop(hasProp('crystal_shard') ? 'crystal_shard' : 'crystal_cluster');
      c.traverse((m) => { if (m.isMesh) { m.material = this.paleCrystal; m.castShadow = true; } });
      c.scale.setScalar(3.4);
      c.position.set(sx * 8.6, P.y - 1.2, GATE.z + 1);
      c.rotation.set(0, sx * 0.4, sx * -0.06);
      s.add(c);
      this.smash.solid(c, { stuff: 'stone' });
    }
    // the dais, for the queen: three low tiers
    for (let t = 0; t < 3; t++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(6 - t * 1.6, 6.2 - t * 1.6, 0.4, 40), t === 2 ? this.paleCrystal : stone);
      d.position.copy(THRONE).setY(P.y + 0.2 + t * 0.4);
      d.castShadow = d.receiveShadow = true;
      s.add(d);
      this.physics.fixedCollider(RAPIER.ColliderDesc.cylinder(0.2, 6 - t * 1.6), { x: THRONE.x, y: P.y + 0.2 + t * 0.4, z: THRONE.z });
    }
    this.buildBattery();
  }

  // Their battery: a crystal the size of a house over the plaza, turning, its light beating slow; a column
  // of it up into the sky and a glow round its heart. (In the comics their power is love's light, and
  // its entity is kept by them: `predator` is the story's.)
  buildBattery() {
    const s = this.scene, B = BATTERY;
    const g = (this.battery = new THREE.Group());
    this.batteryMat = violetCrystal({ color: 0x8a3ab0, deep: 0x5a1478, rim: [1.3, 0.55, 1.5], glow: 1.1, roughness: 0.1, scale: 0.035 });
    if (hasProp('crystal_shard')) {
      const c = prop('crystal_shard');
      c.traverse((m) => { if (m.isMesh) { m.material = this.batteryMat; m.castShadow = true; } });
      c.scale.setScalar(6.5);
      c.position.y = -9.75;
      g.add(c);
    }
    g.position.copy(B);
    s.add(g);
    this.physics.fixedCollider(RAPIER.ColliderDesc.capsule(6.5, 4.2), { x: B.x, y: B.y, z: B.z });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(200,90,255,0.35)'), color: new THREE.Color(0.9, 0.4, 1.1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    halo.scale.setScalar(34);
    g.add(halo);
    this.halo = halo;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.5, 700, 24, 1, true).translate(0, 350, 0), new THREE.ShaderMaterial({
      uniforms: { uTime: this.time }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vU; void main(){ float e = pow(sin(vU.x * 6.2832 * 3.0 + uTime * 1.2) * 0.5 + 0.5, 5.0);
        float a = (0.3 + 0.7 * e) * (1.0 - smoothstep(0.0, 1.0, vU.y)) * smoothstep(0.0, 0.02, vU.y);
        gl_FragColor = vec4(vec3(0.75, 0.25, 1.0) * a * 0.32, 1.0); }`,
    }));
    col.position.copy(B).add(V(0, 9, 0));
    s.add(col);
    this.batteryLight = new THREE.PointLight(0xc060ff, 60, 80, 1.8);
    this.batteryLight.position.copy(B).add(V(0, -6, 0));
    s.add(this.batteryLight);
    this.blocks.push({ x: B.x, z: B.z, r: 6, h: B.y + 12 });
  }

  // ---------------------------------------------------------------------------------------- flora
  // Their gardens' flowers along the way (a stem of light rising out of violet petals) and bulb trees
  // (dark trunks, their lamps hanging lit), set back from the path
  buildFlora() {
    const s = this.scene;
    if (hasProp('plant_glow')) {
      for (let i = 0; i < 44; i++) {
        const z = 132 - rnd() * 215, x = (rnd() < 0.5 ? -1 : 1) * (3.4 + rnd() * 9);
        if (KEPT.some((k) => Math.hypot(x - k.at.x, z - k.at.z) < 2.4)) continue;
        if (Math.hypot(x - COURT.x, z - COURT.z) < 12) continue;
        const p = prop('plant_glow');
        p.scale.setScalar(0.6 + rnd() * 0.7);
        p.position.set(x, zamaronHeight(x, z) - 0.04, z);
        p.rotation.y = rnd() * 6.28;
        p.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
        s.add(p);
        this.smash.add(p, { kind: 'breaks', strong: 4, mass: 6, stuff: 'wood', glass: false });
      }
    }
    if (hasProp('plant_bulbs')) {
      const lamp = new THREE.Color(1.3, 0.6, 1.5);
      for (let i = 0; i < 18; i++) {
        const z = 128 - (i / 18) * 210 + rnd() * 6, x = (i % 2 ? -1 : 1) * (15 + rnd() * 8);
        const p = prop('plant_bulbs', { ownMaterials: true });
        p.traverse((m) => {
          if (!m.isMesh) return;
          m.castShadow = true;
          if (/egg/.test(m.name) || /egg/.test(m.material.name)) { m.material.emissive = lamp; m.material.emissiveIntensity = 0.9; m.material.color.set(0xf0c8ff); }
        });
        p.scale.setScalar(1.5 + rnd() * 0.9);
        p.position.set(x, zamaronHeight(x, z) - 0.1, z);
        p.rotation.y = rnd() * 6.28;
        s.add(p);
        this.smash.solid(p, { stuff: 'wood', box: new THREE.Box3(V(-0.3, 0, -0.3), V(0.3, 3.4, 0.3)) });
      }
    }
  }

  // motes of their light drifting up through the air round the camera
  buildMotes() {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 70; pos[i * 3 + 1] = rnd() * 30; pos[i * 3 + 2] = (rnd() - 0.5) * 70; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(V(0, 0, 0), 1e5);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(210,120,255,0.3)'), color: new THREE.Color(1.0, 0.6, 1.2), size: 0.16, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.motes = { pts, pos, n };
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  airBounds() {
    return { ground: (x, z) => this.ground(x, z), floor: (x, z) => this.ground(x, z), canLand: () => true, center: V(0, 0, -40), radius: 420, ceiling: 220 };
  }

  update(dt, t, camera) {
    this.physics.step(dt);
    this.smash.update(dt, t, camera, this.engine.renderer);
    this.time.value = t;
    crystalTime.value = t;
    this.sky.position.copy(camera.position);
    this.sky.userData.uniforms.uTime.value = t;
    this.moons.position.copy(camera.position);
    // the battery turns, and beats
    // (and, with something in it waking, `unrest` 0 to 1: it stutters, flares and goes dark; `surge` a flash)
    const beat = Math.pow(Math.sin(t * 1.1) * 0.5 + 0.5, 3);
    if (this.battery) {
      const un = this.unrest ?? 0, flick = un > 0 ? (Math.sin(t * 23) * Math.sin(t * 7.3) > 0.2 ? 1 : 0.2) : 1;
      const surge = (this.surge = Math.max(0, (this.surge ?? 0) - dt * 1.4));
      this.battery.rotation.y = t * 0.08;
      this.battery.position.y = BATTERY.y + Math.sin(t * 0.4) * 0.6 + (un > 0 ? Math.sin(t * 41) * 0.08 * un : 0);
      this.batteryMat.userData.cu.uCGlow.value = (0.9 + beat * 0.5) * (1 - un * 0.6 + un * 0.9 * flick) + surge * 3;
      this.batteryLight.intensity = (50 + beat * 22) * (1 - un * 0.7 + un * flick) + surge * 140;
      this.halo.material.opacity = Math.min(1, (0.45 + beat * 0.2) * (1 - un * 0.5 + un * 0.6 * flick) + surge * 0.5);
    }
    this.fountainLight.intensity = 14 + Math.sin(t * 2.3) * 2.5;
    // the motes, rising, wrapped round the camera
    const { pos, n, pts } = this.motes, c = camera.position;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += dt * (0.25 + (i % 5) * 0.06);
      pos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.15;
      for (const [k, h] of [[0, 35], [1, 15], [2, 35]]) {
        const d = pos[i * 3 + k] - (k === 1 ? c.y : c.getComponent(k));
        if (d < -h) pos[i * 3 + k] += h * 2; else if (d > h) pos[i * 3 + k] -= h * 2;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}

function firstMap(root) {
  let map = null;
  root.traverse((m) => { if (!map && m.isMesh && m.material.map) map = m.material.map; });
  return map;
}

// The valley floor: pale quartz, rose in its hollows, with a fine glitter and faint violet veins (world
// space lines, a pixel wide at least and fading to their average far off: hard lines crawl)
function quartz() {
  const m = new THREE.MeshStandardMaterial({ color: 0xc2a8b8, roughness: 0.8, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vQz;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vQz = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vQz;
        float zH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float zN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(zH(i), zH(i + vec3(1,0,0)), f.x), mix(zH(i + vec3(0,1,0)), zH(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(zH(i + vec3(0,0,1)), zH(i + vec3(1,0,1)), f.x), mix(zH(i + vec3(0,1,1)), zH(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float zIso(float v, float w) { float fw = max(fwidth(v), 1e-4); float l = 1.0 - smoothstep(w - fw, w + fw, abs(v - 0.5)); return mix(l, 2.0 * w, smoothstep(0.04, 0.2, fw)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float zb = zN(vQz * 0.04) * 0.6 + zN(vQz * 0.17) * 0.3 + zN(vQz * 0.9) * 0.1;
          diffuseColor.rgb *= mix(vec3(0.74, 0.6, 0.72), vec3(1.08, 1.02, 1.04), zb);
          // drifts of violet crystal sand, and the paler quartz between
          float zs = zN(vQz * 0.012 + 7.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.24, 0.5), smoothstep(0.55, 0.75, zs) * 0.55);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.82, 0.86), smoothstep(0.4, 0.2, zs) * 0.35);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 0.75 + 0.35 * zN(vQz * 0.5);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 zp = vQz * 0.035;
          float zv = zIso(zN(zp + zN(zp * 2.1 + 3.0) * 0.8), 0.0018);
          float zg = step(0.985, zH(floor(vQz * 14.0))) * smoothstep(60.0, 5.0, length(vViewPosition)); // (glitter, close by)
          totalEmissiveRadiance += vec3(0.5, 0.16, 0.75) * zv * 0.14 * smoothstep(140.0, 20.0, length(vViewPosition)) + vec3(1.0, 0.8, 1.0) * zg * 0.12;
        }`);
  };
  m.customProgramCacheKey = () => 'zamaron-quartz';
  return m;
}

// the plaza's inlay: an eight-pointed star of violet in the pale stone, its lines faintly lit and pulsing
function inlayMaterial(time) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
        float star = abs(cos(a * 4.0)) * 0.6 + 0.4; float edge = abs(r / 36.0 - star * 0.9);
        float fw = max(fwidth(edge), 1e-4);
        float line = 1.0 - smoothstep(0.004 - fw, 0.004 + fw, edge);
        float ring = 1.0 - smoothstep(0.08 - fwidth(r), 0.08 + fwidth(r), abs(r - 34.5));
        float ring2 = 1.0 - smoothstep(0.06 - fwidth(r), 0.06 + fwidth(r), abs(r - 9.0));
        float pulse = 0.7 + 0.3 * sin(uTime * 1.1 - r * 0.2);
        float k = max(line, max(ring, ring2));
        gl_FragColor = vec4(vec3(0.75, 0.3, 1.0) * pulse, k * 0.8); }`,
  });
}
