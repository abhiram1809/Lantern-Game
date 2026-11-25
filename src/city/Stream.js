// Coast City round Hal's blocks, streamed (2026-11-19): the plan's thousand blocks (Plan.js) are each
// built from the kit when the camera comes within reach of them (the core's 330 m, the rest 270, a
// block with a tower in it from a kilometre), a few milliseconds a frame, nearest first, and put away
// again behind it; the rest of the city is shaded boxes in their places (one instanced mesh: windows,
// storeys, roofs, lit rooms at night), each hidden while its block is built. Its ground and sea
// (Ground.js), the waterfront (Waterfront.js), the materials and the signs are made once and shared.
//
// A built block: its buildings (Building.js, Tower.js) merged by material, the walls, roofs, glass and
// signs drawn from anywhere in reach and the trim within 210 m; its pavements, kerbs and gutters; lamps,
// palms, hydrants and the core's signals at the corners, drawn instanced (their posts snap: Smash puts
// the real one back in its place); colliders for every mass, parapet and pavement; the lamps' pools of
// light at night. No interiors or people: those are Hal's blocks'. (Parked cars in the houses' drives: Homes.js.)
//
// The map rework (2026-11-24, city/Layout.js): Suburbia's houses stand on their own lots (city/Homes.js, the
// residential streets' rework the same day: Spanish Revival, Craftsman, ranch and postwar houses, dingbats and
// bungalow courts, their gardens, fences, drives, garages and cars, the alleys' power lines); Coast Park is one park across its 24 blocks and downtown's squares are
// paved plazas (city/Parks.js); the hills' houses, roads and observatory are city/Hills.js; every tree is in one
// field (Parks.js TreeField). Where the layout's ground rises under a block (the hills' foot: Layout.js groundAt)
// its buildings stand on plinths at the ground's height and its pavements follow the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { piece } from '../props/Props.js';
import { RAPIER } from '../engine/Physics.js';
import { pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Batch, Sink, cityMaterials, cityU } from './Kit.js';
import { building, box, label } from './Building.js';
import { planLots, yard, garage, dingbat, homeExtras, alleyLine, mailboxKit, treeOf } from './Homes.js';
import { makeCar } from '../props/Car.js';
import { tower } from './Tower.js';
import { SignPages } from './Signs.js';
import { CityIndex, seeded, streetX, EW, DOWNTOWN, LOT_Z, PIER, boxesOf } from './Plan.js';
import { groundAt } from './Layout.js';
import { underRamp } from './Highway.js';
import { cityGround } from './Ground.js';
import { buildWaterfront } from './Waterfront.js';
import { buildLandmarks } from './Landmarks.js';
import { Occlusion } from '../engine/Occlusion.js';
import { greenMaterials, TreeField, buildCoastParkGround, coastParkCell, plaza, drape, ribbon } from './Parks.js';
import { Hills } from './Hills.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = V(0, 0, LOT_Z);
const FAR = new Set(['stucco', 'pbrick', 'brick', 'siding', 'roofing', 'roofTile', 'shake', 'glass', 'pavement', 'lawn', 'gravel', 'pavers', 'hedge', 'water', 'pool', 'spray']);
const PAVE = 0.14, LAWN = 0.11;
const FLAT = /^(lawn|pavement|pool|water|gravel|pavers)$/;
// the street kit's pieces (Ferris.js's KIT), their scale on the street
const PIECES = {
  lamp: ['cityprops', /low_poly012_/, 1.8], mast: ['cityprops', /low_poly_metal_street_props_0$/, 1], signal: ['cityprops', /low_poly011_/, 1],
  hydrant: ['cityprops', /low_poly002_/, 1], palm0: ['palms', /^Palm_tree_001/, 1], palm1: ['palms', /^Palm_tree_002/, 1],
  bench: ['parkbench', /Object_2/, 1], newsbox: ['newsbox', /./, 1], bin: ['cityprops', /low_poly001_/, 1],
  can: ['cityprops', /low_poly007_/, 1], // (a house's trash can out at the kerb: Homes.js; the mailbox is built there)
};
// how they're touched (props/Smash.js): the posts snap, the palms are fixed at the trunk
const TOUCH = {
  lamp: { kind: 'breaks', mass: 45, strong: 14, r: 0.14, h: 6.5 }, mast: { kind: 'breaks', mass: 160, strong: 30, r: 0.18, h: 6.5 },
  signal: { kind: 'breaks', mass: 60, strong: 16, r: 0.14, h: 4.5 }, hydrant: { kind: 'breaks', mass: 70, strong: 12, r: 0.2, h: 0.8 },
  palm0: { kind: 'solid', r: 0.28, h: 7 }, palm1: { kind: 'solid', r: 0.28, h: 7 },
  bench: { kind: 'solid', stuff: 'wood', box: new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.3), new THREE.Vector3(0.9, 0.85, 0.3)) }, // (bolted down on the promenade)
  newsbox: { kind: 'breaks', mass: 45, strong: 6, box: new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.22), new THREE.Vector3(0.25, 1.1, 0.22)) },
  bin: { kind: 'breaks', mass: 30, strong: 5, r: 0.3, h: 1.0 },
  can: { kind: 'breaks', mass: 14, strong: 2, r: 0.28, h: 0.9 }, mailbox: { kind: 'breaks', mass: 12, strong: 3, box: new THREE.Box3(new THREE.Vector3(-0.12, 0, -0.25), new THREE.Vector3(0.12, 1.28, 0.25)) },
};
const PALM = { palm0: 0, palm1: 1 }; // (the palm field's kinds)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _p = V(0, 0, 0), _Y = V(0, 1, 0);
function freeArray() { this.array = null; }
const rectDist = (c, x, z) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1));
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const range = (rnd, a, b) => a + rnd() * (b - a);

// The built blocks' merged walls, glass, roofs, signs and night light, one BatchedMesh for each material: a block's pieces are a
// geometry and an instance each in their material's (the instance's matrix the identity: the blocks are all built
// in the lot's frame, so even the glass's own shader draws them right), hidden and shown as the block is (behind
// others, its night), deleted when it's put away; the batches start small, grow as they need and are compacted
// when what's been deleted is most of them. (The trim isn't batched: a batch keeps a copy of all it holds in
// memory, and the barrel tiles alone are 150 k vertices a block. Its meshes free theirs once they're uploaded.) Culled piece by piece against the camera and the sun's
// shadow box (a few hundred pieces: cheap), so a block's walls cast only where the shadows are drawn.
// (a batch is drawn only while some copy in it is shown, and culled whole by a sphere round those (`refresh`, as
// they change): every one was a draw in each pass, drawing nothing once its copies were culled, 46 of the 51 in
// Hal's street, 11 of 16 in its shadows)
const _bb = new THREE.Box3();
class CityBatches {
  constructor(root) { this.root = root; this.map = new Map(); this.dirty = new Set(); }
  add(key, material, geo, castShadow) {
    let b = this.map.get(key);
    const nv = geo.attributes.position.count, ni = geo.index ? geo.index.count : 0;
    if (!b) {
      const mesh = new THREE.BatchedMesh(16, Math.max(nv * 3, 1 << 11), ni ? Math.max(ni * 3, 1 << 12) : 0, material);
      mesh.name = `cityBatch ${key}`;
      mesh.position.copy(ORIGIN);
      mesh.perObjectFrustumCulled = true;
      mesh.sortObjects = !material.transparent; // (front to back: what's behind is rejected before it's shaded)
      mesh.boundingSphere = new THREE.Sphere();
      mesh.visible = false;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      b = { mesh, dead: 0, on: new Set() };
      this.map.set(key, b);
    }
    if (!geo.boundingBox) geo.computeBoundingBox();
    const m = b.mesh;
    // room for it: compacted first if much of it's been deleted, else grown
    if (m._nextVertexStart + nv > m._maxVertexCount || (ni && m._nextIndexStart + ni > m._maxIndexCount)) {
      if (b.dead > 0) { m.optimize(); b.dead = 0; }
      if (m._nextVertexStart + nv > m._maxVertexCount || (ni && m._nextIndexStart + ni > m._maxIndexCount)) {
        m.setGeometrySize(Math.max(Math.ceil(m._maxVertexCount * 1.5), m._nextVertexStart + nv), ni ? Math.max(Math.ceil(m._maxIndexCount * 1.5), m._nextIndexStart + ni) : 0);
      }
    }
    if (m.instanceCount >= m.maxInstanceCount) m.setInstanceCount(m.maxInstanceCount * 2);
    const gid = m.addGeometry(geo), iid = m.addInstance(gid);
    m.setVisibleAt(iid, false);
    return { b, gid, iid, nv, on: false, box: geo.boundingBox.clone() };
  }
  show(h, on) {
    if (h.on === on) return;
    h.on = on;
    h.b.mesh.setVisibleAt(h.iid, on);
    if (on) h.b.on.add(h); else h.b.on.delete(h);
    this.dirty.add(h.b);
  }
  remove(h) {
    const m = h.b.mesh;
    m.deleteInstance(h.iid);
    m.deleteGeometry(h.gid);
    h.b.dead += h.nv;
    if (h.b.on.delete(h)) this.dirty.add(h.b);
  }
  // (before the frame's drawn: CityStream.update, and after the occlusion's answers, which show and hide blocks)
  refresh() {
    for (const b of this.dirty) {
      b.mesh.visible = b.on.size > 0;
      if (!b.on.size) continue;
      _bb.makeEmpty();
      for (const h of b.on) _bb.union(h.box);
      _bb.getBoundingSphere(b.mesh.boundingSphere);
    }
    this.dirty.clear();
  }
}

export class CityStream {
  constructor(f) {
    this.f = f;
    this.index = new CityIndex();
    this.replan(); // (Suburbia's houses on their lots, and the blocks on the hills' foot at the ground's height)
    this.garage = garage; // (the kit's garage, for the hills' houses too: city/Hills.js)
    this.root = new THREE.Group();
    this.root.name = 'city';
    f.scene.add(this.root);
    // (a built block hidden while the buildings in front of it cover it: engine/Occlusion.js)
    this.occlusion = f.scene.userData.occlusion = new Occlusion(f.engine.renderer, f.scene);
    this.batches = new CityBatches(this.root); // (every block's merged pieces, one batch per material: below)
    this.occlusion.after = () => this.batches.refresh();
    this.queue = [];
    this.job = null;
    this.t = 1;
    this.built = 0;
    this.night = 0;
  }

  // made a stage at a time with the rest of the scene (Ferris.steps)
  *steps() {
    const f = this.f;
    // the materials, once for every block (the same programs as Hal's: nothing new to compile)
    const mats = (this.mats = cityMaterials());
    mats.pavement = pbrMaterial('concrete_pavement', { repeat: [1 / 3, 1 / 3], tint: new THREE.Color(1.08, 1.05, 1.0) });
    // the signs: pages shared by every block, a sign drawn once (Building.js's `label` looks it up), its page
    // filled again once no block that's built uses what's on it (Signs.js)
    this.signs = new SignPages(f.engine.renderer, mats, { recycle: true });
    this.litMats = this.signs.litMats;
    mats.roofTile = mats.tile;
    // the green: lawns, paths, pavers, hedges, the pools' and fountains' water (city/Parks.js), and every tree
    greenMaterials(mats);
    mats.pool = mats.water.clone();
    mats.pool.color.set(0x48b8c8);
    mats.pool.onBeforeCompile = mats.water.onBeforeCompile;
    mats.pool.customProgramCacheKey = mats.water.customProgramCacheKey;
    this.waterMat = mats.water;
    this.trees = new TreeField(this.root);
    // the lamps' pools on the pavements and the shops' light spilling out, at night
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)');
    this.pool = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.62, 0.46, 0.28), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
    this.spill = this.pool.clone();
    this.spill.color.setRGB(0.5, 0.45, 0.36);
    this.porchPool = this.pool.clone(); // (a porch light's or a garage lamp's pool: smaller, dimmer, warmer; buildCell)
    this.porchPool.color.setRGB(0.4, 0.27, 0.13);
    // the street kit's pieces, as templates for instancing (each one's parts merged by material: a few draws, not
    // one for every part of the model)
    this.kit = {};
    for (const [k, [name, re]] of Object.entries(PIECES)) {
      let o;
      try { o = piece(name, re, { root: true }); } catch { continue; } // (a prop this scene didn't load)
      o.updateMatrixWorld(true);
      const parts = [];
      o.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, M: m.matrixWorld.clone() }); });
      this.kit[k] = { o, parts: PALM[k] != null ? parts : mergeParts(parts) };
    }
    this.kit.mailbox = mailboxKit(mats.paint); // (the houses' mailboxes on their posts: city/Homes.js)
    yield;
    this.ground = cityGround();
    f.scene.add(this.ground);
    this.buildFar();
    yield;
    // Coast Park's ground, water and trees (always drawn: city/Parks.js)
    this.parkGround = buildCoastParkGround(this);
    yield;
    this.waterfront = yield* buildWaterfront(this);
    this.signs.flush();
    // the freeway, the channel and its bridges (city/Landmarks.js)
    this.landmarks = yield* buildLandmarks(this);
    // the hills: their roads, houses, observatory, trees (city/Hills.js)
    this.hills = new Hills(this);
    yield* this.hills.steps();
  }

  // ---------------------------------------------------------------------------- the plan, as it's built
  replan() { replanCells(this.index); }

  // ---------------------------------------------------------------------------- the far boxes
  // Every building of the plan as a box (a tower's tiers one each), coloured as its walls, its windows
  // and storeys drawn in the shader; a block's are hidden while it's built.
  buildFar() {
    const boxes = this.index.boxes, n = boxes.length;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const info = new Float32Array(n * 4);
    this.show = new Float32Array(n).fill(1);
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
    geo.setAttribute('aShow', new THREE.InstancedBufferAttribute(this.show, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = cityU.uNight;
      sh.uniforms.uSkyHor = cityU.uSkyHor;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 aInfo; attribute float aShow;
        varying vec4 vInfo; varying vec3 vFw; varying vec3 vFn; varying float vTop;`)
        .replace('#include <project_vertex>', `#include <project_vertex>
        vInfo = aInfo;
        vFw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vFn = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
        vTop = (modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 1.0)).y;
        if (aShow < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // (its block is built: off)`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uNight; uniform vec3 uSkyHor;
        varying vec4 vInfo; varying vec3 vFw; varying vec3 vFn; varying float vTop;
        float fH(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        vec3 fLit = vec3(0.0);`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vFn);
          float side = 1.0 - step(0.6, abs(n.y)), kind = mod(vInfo.z, 10.0), gh = vInfo.x, fh = max(vInfo.y, 2.5), base = floor(vInfo.z / 10.0);
          float u = abs(n.x) > abs(n.z) ? vFw.z : vFw.x, y = vFw.y - base;
          float tower = step(1.5, kind) * (1.0 - step(2.5, kind));
          float cw = mix(3.2, 1.6, tower);
          float fu = fract(u / cw), row = y < gh ? -1.0 : floor((y - gh) / fh), fv = y < gh ? y / gh : fract((y - gh) / fh);
          float win;
          if (tower > 0.5) win = step(0.24, fv) * step(fv, 0.88) * step(0.04, fu) * step(fu, 0.96);
          else if (kind > 3.5) win = step(0.3, fv) * step(fv, 0.7) * step(0.32, fu) * step(fu, 0.68); // (a house: its ground floor's windows)
          else if (y < gh) win = (1.0 - step(0.5, kind)) * step(0.1, fv) * step(fv, 0.74) * step(0.06, fu) * step(fu, 0.94);
          else win = step(0.27, fv) * step(fv, 0.75) * step(0.3, fu) * step(fu, 0.7) * (1.0 - step(2.5, kind) * 0.85);
          win *= step(y, vTop - base - (tower > 0.5 ? 2.0 : kind > 3.5 ? 0.3 : 1.2)) * side * step(0.0, y);
          // a pattern under a few pixels is its average (it crawls otherwise as the camera moves)
          float px = max(fwidth(u) / cw, fwidth(y) / fh);
          win = mix(win, mix(0.22, 0.6, tower) * side, smoothstep(0.18, 0.5, px));
          float cell = fH(vec3(floor(u / cw), row, floor(vInfo.w)));
          vec3 glass = mix(vec3(0.17, 0.2, 0.24), uSkyHor * 0.55, 0.35 + 0.25 * tower);
          if (tower > 0.5) glass = mix(diffuseColor.rgb * 0.45, uSkyHor * 0.6, 0.3 + 0.2 * cell);
          vec3 wall = tower > 0.5 ? diffuseColor.rgb * 0.55 : diffuseColor.rgb * 0.74 * (0.88 + 0.12 * fH(vec3(floor(vFw.xz / 9.0), 1.0))); // (a plain colour reads paler than the textured walls it stands in for)
          diffuseColor.rgb = mix(wall, glass, win);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.28), 1.0 - side); // the roofs
          diffuseColor.rgb *= mix(1.0, mix(0.6, 1.0, smoothstep(0.1, 4.0, y)), side); // (the ground's shade up the foot, as the near walls' have it: Kit.js weather)
          diffuseColor.rgb *= mix(1.0, 0.72, side * (1.0 - step(0.0, y))); // (a plinth below the floor: darker stone)
          // lit windows at night: whole floors together (about 23% of them), each warm amber, tungsten or an office's
          // cool white, under the bloom's threshold (the towers went to a white haze in it)
          float fl = fH(vec3(floor(vInfo.w), row, 3.0)), pf = fl < 0.4 ? 0.04 : fl < 0.7 ? 0.15 : fl < 0.9 ? 0.45 : 0.8;
          float tint = fH(vec3(floor(u / cw), row, floor(vInfo.w) + 7.0));
          vec3 litC = tower > 0.5 ? (tint < 0.5 ? vec3(0.78, 0.86, 1.0) : vec3(1.0, 0.82, 0.6)) : (tint < 0.55 ? vec3(1.0, 0.68, 0.38) : tint < 0.92 ? vec3(1.0, 0.8, 0.56) : vec3(0.82, 0.88, 1.0));
          fLit = litC * win * step(cell, pf) * uNight * 0.8;
        }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fLit;');
    };
    mat.customProgramCacheKey = () => 'cityFar';
    const mesh = (this.far = new THREE.InstancedMesh(geo, mat, n));
    const hips = [];
    boxes.forEach((b, i) => {
      const s = b.spec, tower = s.kind === 'tower', hip = s.roof === 'hip' || s.roof === 'gable', y0 = s.at.y ?? 0;
      // (a hip roof's box to its eaves, the roof itself one of `hips`: from the air the suburbs are their tiles)
      const H = hip ? y0 + (s.gh ?? 4.3) + ((s.floors ?? 2) - 1) * (s.fh ?? 3.2) : b.y1;
      _m.compose(_p.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2), _q.identity(), _s.set(b.x1 - b.x0, H - b.y0, b.z1 - b.z0));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, new THREE.Color(tower ? s.glass : s.color ?? 0xe6dcc6));
      const kind = tower ? 2 : s.kind === 'garage' || s.kind === 'dingbat' ? 1 : s.lot ? 4 : (s.gh ?? 4) > 6 ? 3 : s.shops?.length ? 0 : 1; // (a warehouse's one storey is tall)
      info.set([tower ? s.lobby : s.gh ?? 4.3, s.fh ?? 3.2, kind + 10 * Math.round(y0), (i * 7.31) % 977], i * 4);
      b.fi = i;
      if (hip) hips.push({ b, s, H, fi: i });
    });
    mesh.position.copy(ORIGIN);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'cityFar';
    this.root.add(mesh);
    this.buildRoofs(boxes);
    this.buildHips(hips);
  }

  // The far houses' pitched roofs, turned as their houses are (one instanced draw): a hip's ridge short of its ends, a
  // gable's running to them (its ends then the walls' colour: `aRidge`, `aWall`); each the colour its covering reads
  // as from afar (barrel tiles' terracotta, shakes' grey-brown), shaded by its house's tint (the residential streets'
  // rework, 2026-11-24: the suburbs were one orange from the air)
  buildHips(list) {
    const pos = [], ends = [], P = (x, y, z, e) => { pos.push(x, y, z); ends.push(e); }, r = 0.22;
    // a unit roof: the eaves' rectangle at y 0, the ridge along x at y 1 (its ends at ±r, moved out by aRidge)
    const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 0, -0.5], D = [-0.5, 0, -0.5], R0 = [-r, 1, 0], R1 = [r, 1, 0];
    for (const [t, e] of [[[A, B, R1], 0], [[A, R1, R0], 0], [[C, D, R0], 0], [[C, R0, R1], 0], [[B, C, R1], 1], [[D, A, R0], 1]]) for (const p of t) P(...p, e);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
    geo.computeVertexNormals();
    const n = Math.max(1, list.length);
    const show = (this.hipShow = new Float32Array(n).fill(1)), ridge = new Float32Array(n).fill(r), wallC = new Float32Array(n * 3);
    geo.setAttribute('aShow', new THREE.InstancedBufferAttribute(show, 1));
    geo.setAttribute('aRidge', new THREE.InstancedBufferAttribute(ridge, 1));
    geo.setAttribute('aWall', new THREE.InstancedBufferAttribute(wallC, 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShow; attribute float aEnd; attribute float aRidge; attribute vec3 aWall; varying vec3 vWall; varying float vEnd;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (position.y > 0.5) transformed.x = sign(position.x) * aRidge; // (the ridge's ends: a hip's in from the gables, a gable's at them)
          vEnd = aEnd * step(0.45, aRidge); vWall = aWall;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          if (aEnd > 0.5 && aRidge > 0.45) objectNormal = vec3(sign(position.x + 1e-4 * sign(position.z)), 0.0, 0.0); // (a gable's end: upright)`)
        .replace('#include <project_vertex>', '#include <project_vertex>\nif (aShow < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWall; varying float vEnd;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vWall, step(0.5, vEnd));');
    };
    mat.customProgramCacheKey = () => 'cityHips';
    const mesh = (this.hips = new THREE.InstancedMesh(geo, mat, n));
    mesh.count = list.length;
    this.hipOf = new Map();
    const c = new THREE.Color(), wc = new THREE.Color();
    // (what a covering reads as from afar: its texture's average, which its vertex colour tints, Kit.js)
    const FAR_OF = { roofTile: 0xa8543a, shake: 0x6e675e, roofing: 0x8e8a84 };
    list.forEach(({ b, s, H, fi }, i) => {
      const gable = s.roof === 'gable', turned = gable && s.ridge === 'z', e = s.eave ?? (gable ? 0.5 : 0.45), rk = gable ? s.rake ?? 0.35 : e;
      const pitch = s.pitch ?? 0.42, run = (turned ? s.d : s.w) + 2 * rk, span = (turned ? s.w : s.d) + 2 * e;
      const rise = (span / 2) * pitch + (gable ? 0.16 : 0), y = gable ? H - e * pitch + 0.16 : H + 0.05;
      _q.setFromAxisAngle(_Y, s.yaw + (turned ? Math.PI / 2 : 0));
      _m.compose(_p.set((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2), _q, _s.set(run, gable ? rise - 0.16 : rise, span));
      mesh.setMatrixAt(i, _m);
      ridge[i] = gable ? 0.5 : Math.max(0, Math.min(0.5, 0.5 - span / 2 / run)); // (a hip's ridge: its length less its span, of the run)
      c.setHex(FAR_OF[s.roofMat ?? 'roofTile'] ?? FAR_OF.roofTile).multiply(wc.setHex(s.roofColor ?? 0xffffff)).multiplyScalar(0.9 + 0.2 * ((i * 0.618) % 1));
      mesh.setColorAt(i, c);
      wc.setHex(s.color ?? 0xe6dcc6).multiplyScalar(0.74);
      wallC.set([wc.r, wc.g, wc.b], i * 3);
      this.hipOf.set(fi, i);
    });
    mesh.position.copy(ORIGIN);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'cityHips';
    this.root.add(mesh);
  }

  // The far boxes' roofs broken up (the polish pass, 2026-11-23: from the air the city was a field of plain
  // boxes): a stair hut on each building, a water tank on legs on some of the taller, a plant room on each
  // tower and a mast on some of the tallest; one instanced draw, each one hidden with its building's box
  // while its block is built (`farShow`). Only what's a few pixels across from far off: no condensers.
  buildRoofs(boxes) {
    const top = new Map();
    for (const b of boxes) { const t = top.get(b.spec); if (!t || b.y1 > t.y1) top.set(b.spec, b); }
    const list = [], rnd = seeded(0x5eed1);
    for (const b of top.values()) {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, H = b.y1, s = b.spec;
      if (s.roof === 'hip' || s.roof === 'gable' || s.lot) continue; // (a pitched roof: `hips`; a house's flat roof has no stair hut)
      const add = (x, y, z, sx, sy, sz, col) => list.push({ x, y, z, sx, sy, sz, col, fi: b.fi });
      const at = (k) => [cx + (rnd() - 0.5) * (w - k), cz + (rnd() - 0.5) * (d - k)];
      if (s.kind === 'tower') {
        add(cx, H, cz, w * 0.42, 5.2, d * 0.42, 0x85837e);
        if (H > 70 && rnd() < 0.55) add(cx + w * 0.1, H + 5.2, cz - d * 0.08, 0.6, 8 + rnd() * 14, 0.6, 0xb4b8bc);
        continue;
      }
      if (w < 6 || d < 6) continue;
      const [hx, hz] = at(5);
      add(hx, H, hz, 2.2, 2.4, 2.8, 0x8b8a85); // the stair hut
      if ((s.floors ?? 1) >= 4 && rnd() < 0.4) { const [tx, tz] = at(6); add(tx, H, tz, 0.5, 2.3, 0.5, 0x3a3634); add(tx, H + 2.3, tz, 2.5, 2.8, 2.5, 0x6c4e34); }
      if (rnd() < 0.5) { const [ax, az] = at(4); add(ax, H, az, 1.6, 1.0, 1.1, 0xb4b4ae); } // (a big condenser block)
    }
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const show = (this.roofShow = new Float32Array(list.length).fill(1));
    geo.setAttribute('aShow', new THREE.InstancedBufferAttribute(show, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShow;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nif (aShow < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    };
    mat.customProgramCacheKey = () => 'cityRoofs';
    const mesh = (this.roofs = new THREE.InstancedMesh(geo, mat, list.length));
    this.roofOf = new Map(); // a far box's index → its roof pieces'
    list.forEach((r, i) => {
      _m.compose(_p.set(r.x, r.y, r.z), _q.identity(), _s.set(r.sx, r.sy, r.sz));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, new THREE.Color(r.col));
      (this.roofOf.get(r.fi) ?? this.roofOf.set(r.fi, []).get(r.fi)).push(i);
    });
    mesh.position.copy(ORIGIN);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'cityRoofs';
    this.root.add(mesh);
  }
  // The far boxes and their roofs casting shadows (from high up, where the sun's box is hundreds of metres wide:
  // Ferris.spanFor), each as it's shown: a built block's are hidden in the shadow map too.
  farCast(on) {
    if (this.farCasting === on) return;
    this.farCasting = on;
    for (const m of [this.far, this.roofs, this.hips]) {
      if (!m) continue;
      m.customDepthMaterial ??= (() => {
        const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        dm.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShow;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nif (aShow < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
        };
        dm.customProgramCacheKey = () => 'cityFarDepth';
        return dm;
      })();
      m.castShadow = on;
    }
    this.hills?.farCast(on);
  }
  farShow(cell, on) {
    for (const b of cell.boxes) {
      this.show[b.fi] = on ? 1 : 0;
      for (const i of this.roofOf?.get(b.fi) ?? []) this.roofShow[i] = on ? 1 : 0;
      const h = this.hipOf?.get(b.fi);
      if (h != null) this.hipShow[h] = on ? 1 : 0;
    }
    this.far.geometry.attributes.aShow.needsUpdate = true;
    if (this.roofs) this.roofs.geometry.attributes.aShow.needsUpdate = true;
    if (this.hips) this.hips.geometry.attributes.aShow.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------- streaming
  reach(c) { return (c.reach ??= c.specs.some((s) => s.kind === 'tower') ? 950 : c.parkId === 'coast' ? 300 : c.core ? 280 : 220); }
  // `keep` ({ x, z, r }, the lot's frame): blocks within r of that point stay built whatever the camera's
  // distance (Part Seven's pier: the waterfront across the water was the far boxes from the pier's head)
  kept(c) { const k = this.keep; return !!k && rectDist(c, k.x, k.z) < k.r; }

  update(dt, camera) {
    this.t += dt;
    const x = camera.position.x - ORIGIN.x, z = camera.position.z - ORIGIN.z;
    if (this.t > 0.25) { this.t = 0; this.plan(x, z); this.lodCells(x, z, camera); }
    // the build in hand, a few milliseconds a frame (more when he's next to a block that isn't there)
    const t0 = performance.now(), budget = this.urgent ? 9 : 3.5;
    this.frameBreak = false;
    while (this.job || this.queue.length) {
      if (!this.job) { const c = this.queue.shift(); if (c.state !== 'queued') continue; c.state = 'building'; this.job = { c, it: this.buildCell(c) }; }
      if (this.job.it.next().done) { this.job.c.state = 'built'; this.job = null; this.lodCells(x, z, camera); }
      if (this.frameBreak || performance.now() - t0 > budget) break;
    }
    // what's out of reach put away, one a frame (a block's bodies and items: tens of milliseconds at once)
    const gone = this.leaving?.shift();
    if (gone && gone.state === 'built' && gone.d > this.reach(gone) * 1.25 + 40 && !this.kept(gone)) this.disposeCell(gone);
    this.waterfront?.update(dt);
    this.hills?.update(dt, camera, this.frameBreak || performance.now() - t0 > budget);
    this.trees?.update(camera);
    this.batches.refresh();
    // the seafront casts shadows only when the camera's near it (its big merged pieces caught the sun's box from a
    // kilometre off: 141 k shadow triangles in Hal's street)
    const wf = this.waterfront, cast = x < -700;
    if (wf && wf.cast !== cast) { wf.cast = cast; wf.group.traverse((m) => { if (m.isMesh) { m.userData.cast ??= m.castShadow; m.castShadow = cast && m.userData.cast; } }); }
  }

  // which blocks to build, nearest first, and which to put away
  plan(x, z) {
    let near = Infinity;
    for (const c of this.index.cells) {
      const d = (c.d = rectDist(c, x, z)), r = this.kept(c) ? Math.max(this.reach(c), d + 50) : this.reach(c);
      if (!c.state && d < r) { c.state = 'queued'; this.queue.push(c); }
      else if (c.state === 'queued' && d > r * 1.2 + 30) c.state = null;
      else if (c.state === 'built' && d > r * 1.25 + 40 && !(this.leaving ??= []).includes(c)) this.leaving.push(c);
      if (c.state === 'queued' || c.state === 'building') near = Math.min(near, d);
    }
    this.queue = this.queue.filter((c) => c.state === 'queued').sort((a, b) => a.d - b.d);
    this.urgent = near < 90;
  }
  // Every block in reach of (x, z) built now, in slices with the browser let in between (the way in).
  *fill(x, z, r = 200) {
    this.plan(x, z);
    for (const c of [...this.queue]) {
      if (c.d > r || c.state !== 'queued') continue;
      c.state = 'building';
      yield* this.buildCell(c);
      c.state = 'built';
    }
    this.queue = this.queue.filter((c) => c.state === 'queued');
    if (this.hills) yield* this.hills.fill(x, z, r);
  }

  // a built block's tiers by distance: the trim and the kit within 210 m, shadows within 140
  lodCells(x, z) {
    for (const c of this.index.cells) {
      const b = c.built;
      if (!b) continue;
      const d = rectDist(c, x, z);
      // (shadows within 85 m: the sun's box is 120 m across round the player; at 140 they cast from outside it, 441 k
      // shadow triangles in the street at night)
      // (the trim and the street kit within 90 m: further, a sill or a hydrant is a pixel or two, and they were 85 of
      // the street's draw calls)
      const near = b.nearOn ? d < 98 : d < 90, kit = b.kit.visible ? d < 98 : d < 90, cast = d < 85;
      if (near !== b.nearOn) { b.nearOn = near; b.near.visible = near && b.revealed >= b.far.length; }
      if (kit !== b.kit.visible) b.kit.visible = kit;
      if (cast !== b.cast) { b.cast = cast; for (const m of b.casters) m.castShadow = cast; }
    }
  }

  // ---------------------------------------------------------------------------- a block
  *buildCell(c) {
    const f = this.f, rnd = seeded(c.seed ^ 0x5bd1e995);
    const ctx = { batch: new Batch(), mats: this.mats, signs: this.signs, signUses: [], rnd, props: false, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [],
      decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [], beacons: [], trees: [], heights: [], cars: [] };
    // (a block of houses' trim gathered by material and colour: Kit.js Sink; flushed into its batch after the yards)
    if (c.lots) ctx.batch = new Sink(ctx.batch);
    for (const s of c.specs) {
      // (their backs on the alleys blank: windows there were a third of a block's triangles, seen from nowhere)
      const spec = { back: false, ...s, at: V(s.at.x, s.at.y ?? 0, s.at.z), sides: s.sides && { ...s.sides } };
      if (s.kind === 'tower') tower(ctx, spec);
      else if (s.kind === 'garage') garage(ctx, spec);
      else if (s.kind === 'dingbat') dingbat(ctx, spec, building);
      else {
        const b = building(ctx, spec);
        if (s.label) {
          const lw = s.labelW ?? 3.2, y = s.labelTop ? b.H + 0.15 : (s.gh ?? 4.3) + 0.15;
          label(ctx, b.M, s.w / 2 - lw, s.w / 2 + lw, y, 0.7, s.label);
        }
        if (s.plinth > 0.15) plinth(ctx, b.M, s);
        if (s.lot) homeExtras(ctx, b, spec); // (a house's chimney, wainscot, vents, aerial: city/Homes.js)
      }
      yield;
    }
    const places = [], extras = [];
    this.street(ctx, c, places);
    if (c.lots) for (const lot of c.lots) yard(ctx, c, lot, places);
    if (c.lots && !c.half) alleyLine(ctx, c, c.lots); // (the power line down its alley)
    if (c.parkId === 'coast') coastParkCell(this, ctx, c, places);
    else if (c.park === 'plaza') plaza(this, ctx, c, places);
    else if (c.park) this.park(ctx, c, places, extras);
    this.signs.flush(); // (the buildings' signs, and a court's name over its gate)
    if (ctx.batch instanceof Sink) ctx.batch = ctx.batch.flush();
    yield;
    // (one mesh a material, whatever the block's size: with the grid's lines at 0, every block across z 0 or x 0 (the
    // ones round Hal's lot) was two of each, its near trim twice the draws; a mesh at most `chunk` parts, each merge a few milliseconds)
    const merged = yield* ctx.batch.buildSteps(this.mats, { cell: 1e5, at: [-5e4, -5e4], chunk: 600 });
    // its group (the trim, the street kit, the park's trees and hedges) and the rest of its merged pieces in the
    // city's batches, one per material (the perf pass, 2026-11-23: a block's own meshes were seven or eight draw
    // calls each)
    const g = new THREE.Group(), near = new THREE.Group(), kit = new THREE.Group(), extra = new THREE.Group();
    g.name = `block ${c.id}`;
    g.position.copy(ORIGIN);
    g.add(extra, near, kit);
    // (a park's or a plaza's stone and metal are seen from across it: drawn from as far as its walls, as a tower's are)
    const towers = c.specs.some((s) => s.kind === 'tower') || !!c.park, casters = [], far = [], night = [];
    const box3 = new THREE.Box3();
    for (const m of extras) { extra.add(m); if (m.castShadow) casters.push(m); }
    for (const m of [...merged.children]) {
      m.geometry.computeBoundingBox();
      box3.union(m.geometry.boundingBox);
      const key = m.name.replace('city_', '');
      const isFar = FAR.has(key) || key.startsWith('sign') || (towers && /^(metal|concrete|paint|iron|bronze|roadpaint|dark|lamp)$/.test(key));
      // (what lies flat on the ground casts nothing worth a shadow pass: the lawns, pavements and drives, the pools' and
      // fountains' water, the parks' walks; the residential streets' rework, 2026-11-24, paying for its houses' shadows)
      if (isFar) { far.push(this.batches.add(key, m.material, m.geometry, m.castShadow && !FLAT.test(key))); m.geometry.dispose(); continue; }
      // (the trim, sills and cornices cast no shadow: the walls' are theirs)
      for (const a of [...Object.values(m.geometry.attributes), m.geometry.index]) a?.onUpload(freeArray);
      m.castShadow = false;
      near.add(m);
    }
    // the kit, instanced (placeKit)
    const items = [], bodies = [], palms = [], trees = [], cars = [];
    this.placeKit(places, kit, items, casters, palms);
    yield;
    // the trees of its gardens and squares (in the city's tree field), their trunks solid
    for (const t of ctx.trees) {
      trees.push(this.trees.add(t.kind, t.x, t.y, t.z + LOT_Z, t.h, t.w, undefined, t.tint));
      if (t.kind !== 'shrub') { const r = Math.max(0.12, 0.035 * t.w * 0.9); ctx.pads.push({ c: V(t.x, t.y + 1.6, t.z), half: V(r, 1.6, r) }); }
    }
    yield;
    // the colliders: each mass, its parapets, the pavements; a hip roof as its hull (all of them one fixed body's:
    // a suburban block's fences, walls and trees were 500 bodies of their own)
    const P = f.physics;
    bodies.push(fixedCompound(P, ctx));
    // (a pavement on rising ground: its surface as a heightfield)
    for (const h of ctx.heights) bodies.push(P.fixedHeights(h.x1 - h.x0, h.z1 - h.z0, h.nx, h.nz, (x, z) => groundAt(x - ORIGIN.x, z - ORIGIN.z) + h.lift, (h.x0 + h.x1) / 2 + ORIGIN.x, (h.z0 + h.z1) / 2 + ORIGIN.z));
    yield;
    // the cars in the drives and under the carports (props/Car.js): Smash's, drawn by distance as Hal's street's parked
    // ones are (their own parts within 4 m, a merged copy to 16, then the far cars' batch: city/Lod.js); one a step,
    // after the ground they stand on, their colliders' feet on it and asleep till something touches them (made before
    // it, or a little into it, the ground came up under them and every alarm in the street went off)
    for (const k of ctx.cars) {
      let car;
      try { car = makeCar(k.model, { paint: k.paint, dust: 0.25 + rnd() * 0.35 }); } catch { continue; } // (a model this scene didn't load)
      car.position.set(k.x + ORIGIN.x, k.y, k.z + ORIGIN.z);
      car.rotation.y = k.yaw;
      f.scene.add(car);
      // (its collider's foot at its wheels', not shrunk up off the drive: dropped those 2 cm the moment anything woke it,
      // it hit the drive hard enough to set its alarm off)
      const lb = f.smash.localBox(car), top = lb.max.y;
      lb.min.y = (lb.min.y - 0.015 * top) / 0.985;
      const item = f.smash.add(car, { kind: 'car', mass: 1300, shrink: 0.97, box: lb });
      item.body.sleep();
      item.settle = f.smash.clock + 4;
      f.lod?.addCar(car, 260, item, { near: 4, far: 16 });
      // (hidden till the Lod's next look at it puts it in its tier: shown as it was made, all 54 of its parts, a block's
      // cars streamed in together were a thousand draws for a frame or two)
      const li = f.lod?.of.get(car);
      if (li) { li.on = false; car.visible = false; }
      cars.push({ car, item });
      yield;
    }
    // night: the street lamps' pools, the shops' light on the pavement (each block one mesh of each)
    const pools = [], spills = [];
    // (the street lamps' wide pools, and the houses' porch lights' and garage lamps' small ones, dimmer: their
    // vertices' colour)
    const porches = [];
    for (const l of ctx.lamps) {
      if (l.street) pools.push(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(l.at.x, (l.y ?? groundY(c, l.at.x, l.at.z) + PAVE) + 0.01, l.at.z));
      else if (l.porch) porches.push(new THREE.PlaneGeometry(3.6, 3.6).rotateX(-Math.PI / 2).translate(l.at.x, l.y + 0.05, l.at.z));
    }
    for (const s of ctx.shops) {
      const w = s.u1 - s.u0, cc = V((s.u0 + s.u1) / 2, 0, 2.2).applyMatrix4(s.F), N = V(0, 0, 1).transformDirection(s.F);
      spills.push(new THREE.PlaneGeometry(w + 1, 4.5).rotateX(-Math.PI / 2).rotateY(Math.atan2(N.x, N.z)).translate(cc.x, groundY(c, cc.x, cc.z) + PAVE + 0.012, cc.z));
    }
    for (const [list, mat] of [[pools, this.pool], [spills, this.spill], [porches, this.porchPool]]) if (list.length) { const geo = mergeGeometries(list, false); night.push(this.batches.add(`night|${mat.uuid}`, mat, geo, false)); geo.dispose(); }
    // what never moves keeps the matrices it has
    g.updateMatrixWorld(true);
    g.traverse((o) => { o.matrixAutoUpdate = false; });
    g.matrixWorldAutoUpdate = false; // (and three.js doesn't walk it every frame)
    near.visible = kit.visible = false;
    this.root.add(g);
    g.updateMatrixWorld(true);
    box3.union(new THREE.Box3().setFromObject(g)).translate(ORIGIN);
    const b = { group: g, far, near, kit, night, items, bodies, casters, palms, trees, cars, signs: ctx.signUses, occ: null, cast: true, shown: true, nearOn: false, revealed: 0 };
    b.occ = this.occlusion.add(box3, (v) => { b.shown = v; g.visible = v; this.showCell(b); });
    c.built = b;
    // shown a few pieces a frame (each goes to the GPU the frame it's added: a whole block at once was a 60 ms
    // frame), then its boxes put away
    while (b.revealed < far.length) { b.revealed = Math.min(far.length, b.revealed + 3); this.showCell(b); this.frameBreak = true; yield; }
    this.showCell(b);
    near.visible = b.nearOn;
    this.farShow(c, false);
    this.built++;
  }

  // a built block's pieces in the batches shown as it stands: hidden behind others (its group too), its night
  showCell(b) {
    const on = b.shown;
    b.far.forEach((h, i) => this.batches.show(h, on && i < b.revealed));
    for (const h of b.night) this.batches.show(h, on && this.night > 0.01);
  }

  // The street kit's pieces at `places` ({ k, M, s }, M in the lot's frame), instanced: one mesh for
  // each of a piece's parts, all its copies at once, into `group`; each one touchable where it stands
  // (props/Smash.js), a stand-in without meshes, and when a post snaps the real piece is put in its
  // place and its copy taken out of the instanced ones. (`items`: the Smash items made, `casters`: the
  // meshes that cast shadows)
  placeKit(places, group, items, casters = [], palms = []) {
    const f = this.f, byKind = new Map();
    for (const p of places) (byKind.get(p.k) ?? byKind.set(p.k, []).get(p.k)).push(p);
    for (const [k, list] of byKind) {
      const t = this.kit[k], ims = [], palm = PALM[k];
      if (!t) continue;
      // (the palms drawn by the scene's palm field, city/Palms.js: `palms` gets their ids)
      if (palm != null) for (const p of list) palms.push(f.palms.add(palm, _m.makeTranslation(ORIGIN).multiply(p.M)));
      else for (const part of t.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((p, i) => im.setMatrixAt(i, _m.multiplyMatrices(p.M, part.M)));
        im.castShadow = !['hydrant', 'bench', 'newsbox', 'bin', 'can', 'mailbox'].includes(k);
        im.receiveShadow = true;
        im.computeBoundingSphere();
        group.add(im);
        ims.push(im);
        if (im.castShadow) casters.push(im);
      }
      const T = TOUCH[k];
      list.forEach((p, i) => {
        const o = new THREE.Object3D();
        o.position.setFromMatrixPosition(p.M).add(ORIGIN);
        o.quaternion.setFromRotationMatrix(p.M);
        const bx = T.box ?? new THREE.Box3(V(-T.r, 0, -T.r), V(T.r, T.h, T.r));
        const onBreak = T.kind === 'breaks' ? (item, at, dir, kk, sm) => {
          const real = t.o.clone();
          real.scale.setScalar(p.s);
          o.add(real);
          o.matrixAutoUpdate = o.matrixWorldAutoUpdate = true;
          for (const im of ims) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; }
          if (k === 'hydrant') sm.geyser(o.getWorldPosition(V(0, 0, 0)).setY(0.45));
        } : null;
        const it = T.kind === 'solid' ? f.smash.solid(o, { stuff: T.stuff ?? 'wood', shrink: 1, box: bx, glass: false })
          : f.smash.add(o, { kind: 'breaks', mass: T.mass, strong: T.strong, shrink: 1, glass: false, box: bx, onBreak });
        o.updateMatrixWorld(true);
        o.matrixAutoUpdate = o.matrixWorldAutoUpdate = false; // (until a post snaps: then the body moves it)
        if (it) items.push(it);
      });
    }
  }

  disposeCell(c) {
    const b = c.built;
    if (!b) return;
    b.group.removeFromParent();
    for (const h of [...b.far, ...b.night]) this.batches.remove(h);
    b.group.traverse((m) => { if (m.isMesh && !m.isInstancedMesh) m.geometry.dispose(); });
    b.kit.traverse((m) => { if (m.isInstancedMesh) m.dispose(); }); // (their geometry is the prop's, shared)
    const W = this.f.physics.world;
    for (const body of b.bodies) if (W.bodies.contains(body.handle)) W.removeRigidBody(body);
    for (const it of b.items) this.f.smash.remove(it);
    for (const { car, item } of b.cars ?? []) { this.f.lod?.remove(car); this.f.smash.remove(item); }
    for (const id of b.palms) this.f.palms.remove(id);
    for (const id of b.trees) this.trees.remove(id);
    this.signs.release(b.signs);
    this.occlusion.remove(b.occ);
    this.farShow(c, true);
    c.built = null;
    c.state = null;
    this.built--;
  }

  setNight(k) {
    this.night = k;
    this.mats.lamp.emissiveIntensity = k * 1.8;
    for (const m of this.litMats) m.emissiveIntensity = 0.08 + k * 1.1;
    this.pool.opacity = k; this.spill.opacity = k * 0.8; this.porchPool.opacity = k;
    // (the fountains' falling water by night: lit from below in their basins, softly, not the day's white)
    this.mats.spray.color.setRGB(0.87 - k * 0.68, 0.93 - k * 0.72, 0.95 - k * 0.7);
    this.mats.spray.opacity = 0.6 - k * 0.2;
    for (const c of this.index.cells) if (c.built) this.showCell(c.built);
    this.waterfront?.setNight(k);
    this.hills?.setNight(k);
  }

  // whether a point in the world is inside one of the city's buildings (flying into a block that
  // isn't built yet: its colliders aren't there)
  solidAt(x, y, z) { return this.index.solidAt(x - ORIGIN.x, y, z - ORIGIN.z) || !!this.hills?.solidAt(x - ORIGIN.x, y, z - ORIGIN.z); }
  // whether (x, z) in the world is on the pier's deck (somewhere to land, over the sea)
  onPier(x, z) { const lx = x - ORIGIN.x, lz = z - ORIGIN.z; return lx < PIER.x0 && lx > PIER.x1 && Math.abs(lz - PIER.z) < (lx < PIER.x1 + 125 ? 22 : PIER.w / 2); }

  // ---------------------------------------------------------------------------- the street
  // A small park among the houses (city/Plan.js: a block left open). Its grass and paths are the ground's (Ground.js: a path
  // round it inside the hedge, two corner to corner, a ring round the fountain's square); here the hedge
  // with its gaps at the corners, the trees on the lawns (clear of the paths), benches round the ring
  // facing in, lamps, a palm at each corner of the square, and in the middle a fountain. Everything solid.
  park(ctx, c, places, extras) {
    const { batch } = ctx, I = new THREE.Matrix4(), rnd = ctx.rnd;
    const bx0 = streetX(c.j) + 12, bx1 = streetX(c.j + 1) - 12, bz0 = c.z0, bz1 = c.z1;
    const W = bx1 - bx0, H = bz1 - bz0, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, L = Math.hypot(W, H), dg = [W / L, H / L];
    const gy = (x, z) => groundY(c, x, z);
    const onPath = (x, z, m) => {
      const u = x - bx0, v = z - bz0, edge = Math.min(u, W - u, v, H - v), r = Math.hypot(x - cx, z - cz);
      const d1 = Math.abs(u * dg[1] - v * dg[0]), d2 = Math.abs((W - u) * dg[1] - v * dg[0]);
      return edge < 5 + m || r < 11 + m || Math.min(d1, d2) < 1.5 + m;
    };
    const put = (k, x, z, yaw, s = PIECES[k][2]) => { if (!underRamp(x, z, 1)) places.push({ k, M: new THREE.Matrix4().compose(V(x, gy(x, z), z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s)), s }); };
    const pad = (x0, y0, z0, x1, y1, z1) => ctx.pads.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), half: V((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2) });
    // its lawns (the ground's paint under them is a block's: Ground.js), the paths as the ground had them
    for (let x = bx0; x < bx1 - 0.1; x += 28) for (let z = bz0; z < bz1 - 0.1; z += 30) batch.add('lawn', drape(x, z, Math.min(bx1, x + 28), Math.min(bz1, z + 30), 0.04, 4, gy), I, 0xffffff);
    batch.add('gravel', ribbon([{ x: bx0 + 3.8, z: bz0 + 3.8 }, { x: bx1 - 3.8, z: bz0 + 3.8 }, { x: bx1 - 3.8, z: bz1 - 3.8 }, { x: bx0 + 3.8, z: bz1 - 3.8 }, { x: bx0 + 3.8, z: bz0 + 3.8 }], 1.2, 0.07, gy), I, 0xffffff);
    for (const [a, b] of [[[bx0 + 3.8, bz0 + 3.8], [cx - 9.5 * dg[0], cz - 9.5 * dg[1]]], [[bx1 - 3.8, bz1 - 3.8], [cx + 9.5 * dg[0], cz + 9.5 * dg[1]]], [[bx1 - 3.8, bz0 + 3.8], [cx + 9.5 * dg[0], cz - 9.5 * dg[1]]], [[bx0 + 3.8, bz1 - 3.8], [cx - 9.5 * dg[0], cz + 9.5 * dg[1]]]]) {
      batch.add('gravel', ribbon([{ x: a[0], z: a[1] }, { x: b[0], z: b[1] }], 1.2, 0.07, gy), I, 0xffffff);
    }
    const ring = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; ring.push({ x: cx + Math.cos(a) * 9.8, z: cz + Math.sin(a) * 9.8 }); }
    batch.add('pavers', ribbon(ring, 1.2, 0.09, gy), I, 0xffffff);
    // the hedge, a gap at each corner where the paths come in
    const hedge = (x0, z0, x1, z1) => { if (x1 - x0 < 0.5 || z1 - z0 < 0.5) return; const y = gy((x0 + x1) / 2, (z0 + z1) / 2); batch.add('hedge', box(x0, y - 0.2, z0, x1, y + 0.95, z1), I, 0x2f4a22); pad(x0, y - 0.2, z0, x1, y + 0.95, z1); };
    const gap = 7.5;
    hedge(bx0 + gap, bz0 + 0.5, bx1 - gap, bz0 + 1.3); hedge(bx0 + gap, bz1 - 1.3, bx1 - gap, bz1 - 0.5);
    hedge(bx0 + 0.5, bz0 + gap, bx0 + 1.3, bz1 - gap); hedge(bx1 - 1.3, bz0 + gap, bx1 - 0.5, bz1 - gap);
    // the middle: a fountain
    const y = gy(cx, cz);
    const basin = new THREE.LatheGeometry([new THREE.Vector2(5.2, 0), new THREE.Vector2(5.2, 0.55), new THREE.Vector2(4.65, 0.55), new THREE.Vector2(4.65, 0.36)], 40).translate(cx, y, cz);
    batch.add('concrete', basin, I, 0xd9d1c1);
    batch.add('concrete', new THREE.CylinderGeometry(0.42, 0.6, 1.95, 18).translate(cx, y + 0.97, cz), I, 0xd2cab9);
    batch.add('concrete', new THREE.CylinderGeometry(1.75, 0.85, 0.34, 28).translate(cx, y + 2.05, cz), I, 0xd9d1c1);
    batch.add('water', new THREE.CircleGeometry(4.65, 40).rotateX(-Math.PI / 2).translate(cx, y + 0.4, cz), I, 0xffffff);
    batch.add('water', new THREE.CircleGeometry(1.55, 28).rotateX(-Math.PI / 2).translate(cx, y + 2.2, cz), I, 0xffffff);
    batch.add('spray', new THREE.CylinderGeometry(1.7, 2.3, 1.8, 32, 2, true).translate(cx, y + 1.3, cz), I, 0xffffff);
    const pts = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (const yy of [y, y + 0.55]) pts.push(V(cx + Math.cos(a) * 5.2, yy, cz + Math.sin(a) * 5.2)); }
    ctx.hulls.push({ pts });
    pad(cx - 0.5, y, cz - 0.5, cx + 0.5, y + 2.2, cz + 0.5);
    // benches round the ring, lamps on it, palms at the square's corners
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6, x = cx + Math.cos(a) * 12.4, z = cz + Math.sin(a) * 12.4; put('bench', x, z, Math.atan2(cx - x, cz - z)); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, x = cx + Math.cos(a) * 11.9, z = cz + Math.sin(a) * 11.9; put('lamp', x, z, Math.atan2(cx - x, cz - z)); ctx.lamps.push({ at: V(x, gy(x, z) + 6.2, z), k: 1, street: true, y: gy(x, z) + 0.1 }); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; put(i % 2 ? 'palm1' : 'palm0', cx + Math.cos(a) * 7.3, cz + Math.sin(a) * 7.3, rnd() * 6, 0.62 + rnd() * 0.1); }
    // the trees on the lawns, apart, clear of the paths (the tree field's; Stream.buildCell makes their trunks solid)
    const n = 20, spots = [];
    for (let t = 0; t < n * 14 && spots.length < n; t++) {
      const x = bx0 + 2.5 + rnd() * (W - 5), z = bz0 + 2.5 + rnd() * (H - 5);
      if (onPath(x, z, 1.8) || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 6.8)) continue;
      const h = 6.5 + rnd() * 4.5;
      spots.push({ x, z });
      ctx.trees.push({ kind: rnd() < 0.12 ? 'cypress' : 'oak', x, y: gy(x, z), z, h, w: h * (0.75 + rnd() * 0.3) });
    }
    void extras;
  }

  // The pavements round a block out to the kerbs, the kerbs and gutters, and along its streets the
  // lamps and palms (alternating, 15 m apart in the core, 24 out of it), a hydrant every 56 m, and in
  // the core the signals at its corners. (`places`: the kit's pieces, for buildCell to instance)
  // By district (the map rework): downtown's and midtown's corners all have their signals and newspaper boxes;
  // the industrial streets and the port's have lamps and no palms; a suburban street's palms and lamps stand
  // between the houses' drives. Coast Park's blocks have pavements only on the streets round it.
  street(ctx, c, places) {
    const { batch } = ctx, I = new THREE.Matrix4();
    const pw = (k) => (k === 0 ? 5.5 : 5); // (the boulevard's are Hal's blocks' 5.5 m)
    const kW = c.j, kE = c.j + 1, sloped = c.relief > 0.05, gy = (x, z) => groundY(c, x, z);
    const pave = (x0, x1, z0, z1) => {
      if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
      if (sloped) { // (on the hills' foot: following the ground, its edge a skirt down into it, a heightfield to walk on)
        batch.add('pavement', drape(x0, z0, x1, z1, PAVE, 3, gy), I, 0xffffff);
        const nx = Math.max(1, Math.ceil((x1 - x0) / 3)), nz = Math.max(1, Math.ceil((z1 - z0) / 3));
        ctx.heights.push({ x0, x1, z0, z1, nx, nz, lift: PAVE });
        return;
      }
      batch.add('pavement', box(x0, 0, z0, x1, PAVE, z1), I, 0xffffff);
      ctx.pads.push({ c: V((x0 + x1) / 2, PAVE / 2, (z0 + z1) / 2), half: V((x1 - x0) / 2, PAVE / 2, (z1 - z0) / 2) });
    };
    // a kerb along an edge (x = a, or z = a) from b0 to b1, the road on side s; its gutter in front
    const kerb = (alongZ, a, b0, b1, s) => {
      if (b1 - b0 < 0.1) return;
      if (sloped) {
        const line = []; for (let t = b0; t <= b1 + 0.01; t += Math.min(3, b1 - b0)) line.push(alongZ ? { x: a, z: t } : { x: t, z: a });
        batch.add('concrete', ribbon(line, 0.09, PAVE + 0.008, gy, 1), I, 0xc9c3b8);
        return;
      }
      if (alongZ) {
        batch.add('concrete', box(a - 0.09, 0, b0, a + 0.09, PAVE + 0.005, b1), I, 0xc9c3b8);
        batch.add('roadpaint', box(Math.min(a, a + s * 0.46), 0, b0, Math.max(a, a + s * 0.46), 0.02, b1), I, 0x77736d);
      } else {
        batch.add('concrete', box(b0, 0, a - 0.09, b1, PAVE + 0.005, a + 0.09), I, 0xc9c3b8);
        batch.add('roadpaint', box(b0, 0, Math.min(a, a + s * 0.46), b1, 0.02, Math.max(a, a + s * 0.46)), I, 0x77736d);
      }
    };
    // Coast Park's blocks: a street only along the park's own edges (the blocks inside it are one lawn)
    const inPark = (j, r) => this.index.byId.get(`${j},${r}`)?.parkId === 'coast';
    const pk = c.parkId === 'coast';
    const W_ = !pk || !inPark(c.j - 1, c.r), E_ = !pk || !inPark(c.j + 1, c.r), S_ = !pk || !inPark(c.j, c.r - 1), N_ = !pk || !inPark(c.j, c.r + 1);
    const half = c.half, wOn = half !== 'east' && W_ && c.west !== false, eOn = half !== 'west' && E_ && c.east !== false; // (no pavement on a side cut back from the water)
    // (a park's edge pavement runs on across the street it no longer has, to the next block's)
    const zs = c.z0 - (c.south && S_ ? EW.front - EW.kerb : pk ? EW.front : 0), zn = c.z1 + (c.north && N_ ? EW.front - EW.kerb : pk ? EW.front : 0);
    const xw = c.x0 - pw(kW), xe = c.x1 + pw(kE);
    if (wOn) { pave(xw, c.x0, zs, zn); kerb(true, xw, zs, zn, -1); }
    if (eOn) { pave(c.x1, xe, zs, zn); kerb(true, xe, zs, zn, 1); }
    // along the east-west streets: beside Hal's blocks, only out to their own corners (or across his lot's front)
    const span = (row) => {
      if (!half) return [c.x0 - (pk && !W_ ? 12 : 0), c.x1 + (pk && !E_ ? 12 : 0)];
      if (row === 'n' && c.halRow === 'north') return half === 'west' ? [c.x0, streetX(0)] : [streetX(0), c.x1];
      return half === 'west' ? [c.x0, -46] : [60, c.x1];
    };
    if (c.south && S_) { const [a, b] = span('s'); pave(a, b, zs, c.z0); kerb(false, zs, wOn ? xw : a, eOn ? xe : b, -1); }
    if (c.north && N_) { const [a, b] = span('n'); pave(a, b, c.z1, zn); kerb(false, zn, wOn ? xw : a, eOn ? xe : b, 1); }
    // the kit along the north-south streets
    const d = c.district, step = c.core || d === 'downtown' || d === 'midtown' ? 15 : d === 'industrial' || d === 'port' ? 30 : 24;
    const palms = d !== 'industrial' && d !== 'port';
    // (nothing stands up through Highway 1's ramps where they come down over the pavements: city/Highway.js)
    const put = (k, x, z, yaw, s = PIECES[k][2]) => {
      if (underRamp(x, z, 1)) return;
      const M = new THREE.Matrix4().compose(V(x, gy(x, z) + PAVE, z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s));
      places.push({ k, M, s });
    };
    const lamp = (x, z, sgn) => { if (underRamp(x, z, 1)) return; put('lamp', x, z, -sgn * Math.PI / 2); ctx.lamps.push({ at: V(x - sgn * 0.95 * 1.8, gy(x, z) + PAVE + 3.45 * 1.8, z), k: 1, street: true }); };
    const palmAt = (x, z) => {
      put(ctx.rnd() < 0.5 ? 'palm0' : 'palm1', x, z, ctx.rnd() * 6, 0.6 + ctx.rnd() * 0.14);
      batch.add('iron', box(x - 0.62, gy(x, z) + PAVE, z - 0.62, x + 0.62, gy(x, z) + PAVE + 0.025, z + 0.62), I, 0x2a2622); // the tree's grate
    };
    for (const [on, xk, sgn, side] of [[wOn, xw, 1, 'west'], [eOn, xe, -1, 'east']]) {
      if (!on) continue;
      const lots = c.lots?.filter((l) => l.side === side);
      if (lots?.length) {
        // a suburban street: a strip of lawn along the kerb (the parkway) between the drives, a palm on it in front of
        // each house, a lamp at every other lot's line
        if (!sloped) {
          const cuts = lots.filter((l) => l.driveZ != null).map((l) => [l.driveZ - l.driveW / 2 - 0.4, l.driveZ + l.driveW / 2 + 0.4]).sort((a, b) => a[0] - b[0]);
          let z = c.z0 + 0.6;
          const strip = (z0, z1) => { if (z1 - z0 < 1.5) return; const x0 = Math.min(xk + sgn * 0.3, xk + sgn * 2.1), x1 = Math.max(xk + sgn * 0.3, xk + sgn * 2.1); batch.add('lawn', box(x0, PAVE - 0.03, z0, x1, PAVE + 0.012, z1), I, [1.06, 1.03, 0.9]); };
          for (const [a, b] of cuts) { strip(z, a); z = Math.max(z, b); }
          strip(z, c.z1 - 0.6);
        }
        // (the street's trees: its palms, or the jacarandas, ficus, magnolias or sweetgums it was planted with: Homes.js)
        lots.forEach((l, i) => {
          const z = l.kerbZ;
          if (l.kerbPalm && (l.kerbTree === 'palm' || sloped)) put(ctx.rnd() < 0.5 ? 'palm0' : 'palm1', xk + sgn * 1.2, z, ctx.rnd() * 6, 0.58 + ctx.rnd() * 0.14);
          else if (l.kerbPalm) treeOf((kind, x, zz, h, w, tint) => ctx.trees.push({ kind, x, y: PAVE + 0.01, z: zz, h: h * 0.85, w: Math.max(w, h * 0.95), tint }), l.kerbTree, xk + sgn * 1.2, z, ctx.rnd); // (rounder than a garden's: pruned clear of the road)
          if (i % 2 === 0) lamp(xk + sgn * 0.5, l.lineZ, sgn);
        });
      } else {
        let n = Math.floor(ctx.rnd() * 2);
        for (let z = c.z0 + 6; z < c.z1 - 5; z += step, n++) {
          if (n % 2 === 0 && palms) palmAt(xk + sgn * 1.1, z);
          else if (n % 2 === 1 || !palms) lamp(xk + sgn * 0.5, z, sgn);
        }
      }
      for (let z = c.z0 + 14 + ctx.rnd() * 10; z < c.z1 - 8; z += 56) if (!lots?.some((l) => Math.abs(l.driveZ - z) < 3.5)) put('hydrant', xk + sgn * 0.35, z, 0);
    }
    // the signals at its corners (each corner of a crossing is one block's): poles with an arm out over the road, or
    // the lights on a post, in the core and all through downtown and midtown; not at Hal's crossing or his lot
    // (Ferris.js's own); and at the busy corners a newspaper box or two and a litter bin
    if (!c.core && d !== 'downtown' && d !== 'midtown') return;
    const own = (k, z) => k === 0 && (z === -210 || z === 70);
    const zS = c.z0 - EW.front, zN = c.z1 + EW.front;
    const corner = (on, k, zc, x, z, kind, yaw) => { if (on && !own(k, zc)) put(kind, x, z, yaw); };
    corner(c.west && c.north && wOn, kW, zN, xw + 0.6, zn - 0.6, 'mast', Math.PI);
    corner(c.east && c.north && eOn, kE, zN, xe - 0.6, zn - 0.6, 'signal', Math.PI / 2);
    corner(c.west && c.south && wOn, kW, zS, xw + 0.6, zs + 0.6, 'signal', -Math.PI / 2);
    corner(c.east && c.south && eOn, kE, zS, xe - 0.6, zs + 0.6, 'mast', 0);
    if (d === 'downtown' || d === 'midtown') {
      if (wOn && !own(kW, zN)) { put('newsbox', xw + 1.6, zn - 3.2, Math.PI / 2); put('newsbox', xw + 1.6, zn - 3.9, Math.PI / 2); put('bin', xw + 1.2, zn - 5.6, 0); }
      if (eOn && !own(kE, zS)) { put('newsbox', xe - 1.6, zs + 3.2, -Math.PI / 2); put('bin', xe - 1.2, zs + 5.0, 0); }
    }
  }
}

// One fixed body for everything a block (or a square of the hills) has to walk on and into: each box and hull its
// own collider on it, in the lot's frame (`ctx` as the kit fills it in)
export function fixedCompound(P, ctx) {
  const W = P.world, body = W.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const cuboid = (s) => {
    const d = RAPIER.ColliderDesc.cuboid(s.half.x, s.half.y, s.half.z).setTranslation(s.c.x + ORIGIN.x, s.c.y, s.c.z + ORIGIN.z).setFriction(0.8);
    if (s.q) d.setRotation(s.q);
    W.createCollider(d, body);
  };
  for (const s of ctx.solids) cuboid(s);
  for (const s of ctx.parapets) cuboid(s);
  for (const s of ctx.pads) cuboid(s);
  for (const h of ctx.hulls) {
    const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(h.pts.flatMap((p) => [p.x + ORIGIN.x, p.y, p.z + ORIGIN.z])));
    if (desc) W.createCollider(desc.setFriction(0.8), body);
  }
  return body;
}

// ------------------------------------------------------------------------------------------------ the plan, as it's built
// Suburbia's houses on their lots (city/Homes.js planLots: every face of its blocks that isn't shops, the outer
// halves beside Hal's blocks too, their backs on his alley's wall), each block's buildings at the ground's height where
// the hills' foot comes under it, and the index's boxes worked out again from what's built. Exported for whatever else
// draws the city's buildings (the map: CityMap.js), so it draws them where they stand: `replanCells(new CityIndex())`.
export function replanCells(I) {
  if (I.replanned) return I;
  I.replanned = true;
  for (const c of I.cells) {
    c.relief = relief(c);
    if (c.district === 'suburbia' && !c.park) {
      const keep = [], lots = [];
      // (beside Hal's blocks a lot is a little deeper, out to his alley's wall: HalsBlock.js alleys, at x -34 and 46)
      const deep = c.half ? 26.5 : Math.min(25, (c.x1 - c.x0 - 6) / 2);
      for (const side of ['west', 'east']) {
        const list = c.specs.filter((s) => (side === 'west' ? s.yaw < 0 : s.yaw > 0));
        if (list.length && !list.some((s) => s.shops?.length) && (!c.half || c.half === side)) lots.push(...planLots(c, side, { deep, alley: !c.half }));
        else keep.push(...list);
      }
      if (lots.length) { c.lots = lots; c.specs = [...keep, ...lots.flatMap((l) => l.specs)]; }
    }
    // on rising ground: each building at the highest ground under it, a plinth below (a lot's are its terrace's)
    if (c.relief > 0.05) for (const s of c.specs) if (!s.lot) { const fp = footprint(s); s.at.y = fp.max; s.plinth = fp.max - fp.min; }
  }
  I.boxes = [];
  I.grid = new Map();
  for (const c of I.cells) {
    c.boxes = [];
    for (const s of c.specs) for (const b of boxesOf(s)) { const y = s.at.y ?? 0; b.y0 += y - (s.plinth ?? 0); b.y1 += y; b.spec = s; b.cell = c; c.boxes.push(b); I.boxes.push(b); I.file(b); }
  }
  return I;
}

// ------------------------------------------------------------------------------------------------ ground under a block
// How much the layout's ground rises under a block and its pavements (0 on the flat: most of the city)
function relief(c) {
  let hi = 0;
  for (let x = c.x0 - 13; x <= c.x1 + 13; x += 6) for (let z = c.z0 - 12; z <= c.z1 + 12; z += 6) hi = Math.max(hi, groundAt(x, z));
  return hi;
}
const groundY = (c, x, z) => (c.relief > 0.05 ? groundAt(x, z) : 0);
// the ground under a spec's footprint: its highest and lowest
function footprint(s) {
  const yaw = s.yaw, ax = Math.cos(yaw), az = -Math.sin(yaw), nx = -Math.sin(yaw), nz = -Math.cos(yaw); // (along its front, and in behind it)
  let max = 0, min = Infinity;
  for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) {
    const u = (s.w * i) / 4, v = (s.d * k) / 4, g = groundAt(s.at.x + ax * u + nx * v, s.at.z + az * u + nz * v);
    max = Math.max(max, g); min = Math.min(min, g);
  }
  return { max, min };
}
// a building's plinth on falling ground: stone from below the lowest ground up to its floor
function plinth(ctx, M, s) {
  ctx.batch.add('concrete', box(-0.08, -s.plinth - 0.4, -s.d - 0.08, s.w + 0.08, 0.02, 0.08), M, 0xb8ae9c);
  ctx.solids.push({ c: V(s.w / 2, -s.plinth / 2 - 0.2, -s.d / 2).applyMatrix4(M), half: V(s.w / 2 + 0.08, s.plinth / 2 + 0.2, s.d / 2 + 0.08), q: new THREE.Quaternion().setFromRotationMatrix(M) });
}

// a kit piece's parts merged by material (in the piece's frame): a few instanced draws a piece, not one a part
function mergeParts(parts) {
  const byMat = new Map();
  for (const p of parts) (byMat.get(p.mat) ?? byMat.set(p.mat, []).get(p.mat)).push(p);
  const out = [];
  for (const [mat, list] of byMat) {
    if (list.length === 1) { out.push(list[0]); continue; }
    const geos = list.map((p) => { const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(p.M); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    const geo = mergeGeometries(geos, false);
    if (geo) out.push({ geo, mat, M: new THREE.Matrix4() });
    else out.push(...list);
  }
  return out;
}

export { DOWNTOWN };
