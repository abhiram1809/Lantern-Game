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
// light at night. No interiors, people or parked cars: those are Hal's blocks'.
//
// The map rework (2026-11-24, city/Layout.js): Suburbia's houses stand on their own lots (`planLots`: set back
// behind front gardens, a drive to a garage, low walls, hedges or picket fences, side and back fences, palms, oaks
// and bushes, a pool in some back yards); Coast Park is one park across its 24 blocks and downtown's squares are
// paved plazas (city/Parks.js); the hills' houses, roads and observatory are city/Hills.js; every tree is in one
// field (Parks.js TreeField). Where the layout's ground rises under a block (the hills' foot: Layout.js groundAt)
// its buildings stand on plinths at the ground's height and its pavements follow the ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { piece } from '../props/Props.js';
import { RAPIER } from '../engine/Physics.js';
import { pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Batch, cityMaterials, cityU } from './Kit.js';
import { building, box, label, hipRoof, metreUV } from './Building.js';
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
const FAR = new Set(['stucco', 'pbrick', 'brick', 'roofing', 'roofTile', 'glass', 'pavement', 'lawn', 'gravel', 'pavers', 'hedge', 'water', 'pool', 'spray']);
const PAVE = 0.14, LAWN = 0.11;
// the street kit's pieces (Ferris.js's KIT), their scale on the street
const PIECES = {
  lamp: ['cityprops', /low_poly012_/, 1.8], mast: ['cityprops', /low_poly_metal_street_props_0$/, 1], signal: ['cityprops', /low_poly011_/, 1],
  hydrant: ['cityprops', /low_poly002_/, 1], palm0: ['palms', /^Palm_tree_001/, 1], palm1: ['palms', /^Palm_tree_002/, 1],
  bench: ['parkbench', /Object_2/, 1], newsbox: ['newsbox', /./, 1], bin: ['cityprops', /low_poly001_/, 1],
};
// how they're touched (props/Smash.js): the posts snap, the palms are fixed at the trunk
const TOUCH = {
  lamp: { kind: 'breaks', mass: 45, strong: 14, r: 0.14, h: 6.5 }, mast: { kind: 'breaks', mass: 160, strong: 30, r: 0.18, h: 6.5 },
  signal: { kind: 'breaks', mass: 60, strong: 16, r: 0.14, h: 4.5 }, hydrant: { kind: 'breaks', mass: 70, strong: 12, r: 0.2, h: 0.8 },
  palm0: { kind: 'solid', r: 0.28, h: 7 }, palm1: { kind: 'solid', r: 0.28, h: 7 },
  bench: { kind: 'solid', stuff: 'wood', box: new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.3), new THREE.Vector3(0.9, 0.85, 0.3)) }, // (bolted down on the promenade)
  newsbox: { kind: 'breaks', mass: 45, strong: 6, box: new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.22), new THREE.Vector3(0.25, 1.1, 0.22)) },
  bin: { kind: 'breaks', mass: 30, strong: 5, r: 0.3, h: 1.0 },
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
      const s = b.spec, tower = s.kind === 'tower', hip = s.roof === 'hip', y0 = s.at.y ?? 0;
      // (a hip roof's box to its eaves, the roof itself one of `hips`: from the air the suburbs are their tiles)
      const H = hip ? y0 + (s.gh ?? 4.3) + ((s.floors ?? 2) - 1) * (s.fh ?? 3.2) : b.y1;
      _m.compose(_p.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2), _q.identity(), _s.set(b.x1 - b.x0, H - b.y0, b.z1 - b.z0));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, new THREE.Color(tower ? s.glass : s.color ?? 0xe6dcc6));
      const kind = tower ? 2 : s.kind === 'garage' ? 1 : s.lot ? 4 : (s.gh ?? 4) > 6 ? 3 : s.shops?.length ? 0 : 1; // (a warehouse's one storey is tall)
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

  // The far houses' hip roofs, terracotta, turned as their houses are (one instanced draw)
  buildHips(list) {
    const pos = [], P = (x, y, z) => pos.push(x, y, z), r = 0.22;
    // a unit roof: the eaves' rectangle at y 0, the ridge along x at y 1
    const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 0, -0.5], D = [-0.5, 0, -0.5], R0 = [-r, 1, 0], R1 = [r, 1, 0];
    for (const t of [[A, B, R1], [A, R1, R0], [C, D, R0], [C, R0, R1], [B, C, R1], [D, A, R0]]) for (const p of t) P(...p);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const show = (this.hipShow = new Float32Array(Math.max(1, list.length)).fill(1));
    geo.setAttribute('aShow', new THREE.InstancedBufferAttribute(show, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShow;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nif (aShow < 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    };
    mat.customProgramCacheKey = () => 'cityHips';
    const mesh = (this.hips = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)));
    mesh.count = list.length;
    this.hipOf = new Map();
    const c = new THREE.Color();
    list.forEach(({ b, s, H, fi }, i) => {
      const w = s.w + 0.9, d = s.d + 0.9, rise = (d / 2) * (s.pitch ?? 0.42);
      const along = V(Math.cos(s.yaw), 0, -Math.sin(s.yaw)); // (the front's run)
      _q.setFromAxisAngle(_Y, s.yaw);
      _m.compose(_p.set((b.x0 + b.x1) / 2, H + 0.05, (b.z0 + b.z1) / 2), _q, _s.set(w, rise, d));
      void along;
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, c.setHex(0xa8543a).multiplyScalar(0.85 + 0.3 * ((i * 0.618) % 1)));
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
      if (s.roof === 'hip') continue; // (a tiled roof: `hips`)
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
      decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [], beacons: [], trees: [], heights: [] };
    for (const s of c.specs) {
      // (their backs on the alleys blank: windows there were a third of a block's triangles, seen from nowhere)
      const spec = { back: false, ...s, at: V(s.at.x, s.at.y ?? 0, s.at.z), sides: s.sides && { ...s.sides } };
      if (s.kind === 'tower') tower(ctx, spec);
      else if (s.kind === 'garage') garage(ctx, spec);
      else {
        const b = building(ctx, spec);
        if (s.label) {
          const lw = s.labelW ?? 3.2, y = s.labelTop ? b.H + 0.15 : (s.gh ?? 4.3) + 0.15;
          label(ctx, b.M, s.w / 2 - lw, s.w / 2 + lw, y, 0.7, s.label);
        }
        if (s.plinth > 0.15) plinth(ctx, b.M, s);
        if (s.chimney) chimney(ctx, b.M, s);
      }
      yield;
    }
    this.signs.flush();
    const places = [], extras = [];
    this.street(ctx, c, places);
    if (c.lots) for (const lot of c.lots) yard(ctx, c, lot, places);
    if (c.parkId === 'coast') coastParkCell(this, ctx, c, places);
    else if (c.park === 'plaza') plaza(this, ctx, c, places);
    else if (c.park) this.park(ctx, c, places, extras);
    yield;
    const merged = yield* ctx.batch.buildSteps(this.mats, { cell: 4000, chunk: 350 });
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
      if (isFar) { far.push(this.batches.add(key, m.material, m.geometry, m.castShadow)); m.geometry.dispose(); continue; }
      // (the trim, sills and cornices cast no shadow: the walls' are theirs)
      for (const a of [...Object.values(m.geometry.attributes), m.geometry.index]) a?.onUpload(freeArray);
      m.castShadow = false;
      near.add(m);
    }
    // the kit, instanced (placeKit)
    const items = [], bodies = [], palms = [], trees = [];
    this.placeKit(places, kit, items, casters, palms);
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
    // night: the street lamps' pools, the shops' light on the pavement (each block one mesh of each)
    const pools = [], spills = [];
    for (const l of ctx.lamps) if (l.street) pools.push(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(l.at.x, (l.y ?? groundY(c, l.at.x, l.at.z) + PAVE) + 0.01, l.at.z));
    for (const s of ctx.shops) {
      const w = s.u1 - s.u0, cc = V((s.u0 + s.u1) / 2, 0, 2.2).applyMatrix4(s.F), N = V(0, 0, 1).transformDirection(s.F);
      spills.push(new THREE.PlaneGeometry(w + 1, 4.5).rotateX(-Math.PI / 2).rotateY(Math.atan2(N.x, N.z)).translate(cc.x, groundY(c, cc.x, cc.z) + PAVE + 0.012, cc.z));
    }
    for (const [list, mat] of [[pools, this.pool], [spills, this.spill]]) if (list.length) { const geo = mergeGeometries(list, false); night.push(this.batches.add(`night|${mat.uuid}`, mat, geo, false)); geo.dispose(); }
    // what never moves keeps the matrices it has
    g.updateMatrixWorld(true);
    g.traverse((o) => { o.matrixAutoUpdate = false; });
    g.matrixWorldAutoUpdate = false; // (and three.js doesn't walk it every frame)
    near.visible = kit.visible = false;
    this.root.add(g);
    g.updateMatrixWorld(true);
    box3.union(new THREE.Box3().setFromObject(g)).translate(ORIGIN);
    const b = { group: g, far, near, kit, night, items, bodies, casters, palms, trees, signs: ctx.signUses, occ: null, cast: true, shown: true, nearOn: false, revealed: 0 };
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
        im.castShadow = !['hydrant', 'bench', 'newsbox', 'bin'].includes(k);
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
    this.pool.opacity = k; this.spill.opacity = k * 0.8;
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
          const cuts = lots.map((l) => [l.driveZ - l.driveW / 2 - 0.4, l.driveZ + l.driveW / 2 + 0.4]).sort((a, b) => a[0] - b[0]);
          let z = c.z0 + 0.6;
          const strip = (z0, z1) => { if (z1 - z0 < 1.5) return; const x0 = Math.min(xk + sgn * 0.3, xk + sgn * 2.1), x1 = Math.max(xk + sgn * 0.3, xk + sgn * 2.1); batch.add('lawn', box(x0, PAVE - 0.03, z0, x1, PAVE + 0.012, z1), I, [1.06, 1.03, 0.9]); };
          for (const [a, b] of cuts) { strip(z, a); z = Math.max(z, b); }
          strip(z, c.z1 - 0.6);
        }
        lots.forEach((l, i) => {
          const z = l.kerbZ;
          if (l.kerbPalm) put(ctx.rnd() < 0.5 ? 'palm0' : 'palm1', xk + sgn * 1.2, z, ctx.rnd() * 6, 0.58 + ctx.rnd() * 0.14);
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
// Suburbia's houses on their lots (planLots), each block's buildings at the ground's height where the hills' foot
// comes under it, and the index's boxes worked out again from what's built. Exported for whatever else draws the
// city's buildings (the map: CityMap.js), so it draws them where they stand: `replanCells(new CityIndex())`.
export function replanCells(I) {
  if (I.replanned) return I;
  I.replanned = true;
  for (const c of I.cells) {
    c.relief = relief(c);
    if (c.district === 'suburbia' && !c.half && !c.park) {
      const isHouse = (s) => s.kind === 'building' && s.floors === 1 && s.roof === 'hip' && s.gh === 3.4;
      const keep = [], lots = [];
      for (const side of ['west', 'east']) {
        const list = c.specs.filter((s) => (side === 'west' ? s.yaw < 0 : s.yaw > 0));
        if (list.length && list.every(isHouse)) lots.push(...planLots(c, side));
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
// a chimney up the outside of a house's side wall, through its eaves to above the ridge
function chimney(ctx, M, s) {
  const c = s.chimney, H = s.gh + ((s.floors ?? 1) - 1) * (s.fh ?? 3), top = H + ((s.d + 0.9) / 2) * (s.pitch ?? 0.42) + 0.5;
  const u = c.side < 0 ? -0.55 : s.w + 0.55, z0 = -s.d * 0.5 - 0.6, z1 = z0 + 1.2;
  ctx.batch.add(c.brick ? 'brick' : 'stucco', box(u - 0.5, -0.1, z0, u + 0.5, H - 0.6, z1), M, c.brick ? 0xffffff : s.color);
  ctx.batch.add(c.brick ? 'brick' : 'stucco', box(u - 0.32, H - 0.6, z0 + 0.25, u + 0.32, top, z1 - 0.25), M, c.brick ? 0xffffff : s.color);
  ctx.batch.add('concrete', box(u - 0.4, top, z0 + 0.17, u + 0.4, top + 0.1, z1 - 0.17), M, 0x8a847c);
  ctx.solids.push({ c: V(u, (H - 0.6) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(0.5, (H - 0.5) / 2, 0.6), q: new THREE.Quaternion().setFromRotationMatrix(M) });
}

// ------------------------------------------------------------------------------------------------ Suburbia's lots
// A street of houses as lots, each 15 to 22 m along the street and the block's half deep: the house set back 6 to
// 8 m behind its front garden, a drive along one side to its garage (one car or two, flush with the house or a
// little forward of it) or past it to a carport, the front door off the garden's path. In the face's frame (u
// along the street from the face's start, v in from the front line), worked out once from the block's seed.
const HOUSE = [0xead9bb, 0xe6b9a2, 0xecdcae, 0xf1e9d6, 0xf0cf7c, 0xd9d2c4, 0xc4dbd0, 0xf3f0e8, 0xf5f0e6, 0xf3c4d0, 0xb6cde0, 0xe8c2a4, 0xf0e2b6, 0xcfe3d4, 0xf2d0b4, 0xf4e4c4, 0xdfe8e4,
  0xf3d1dc, 0xbfe3e0, 0xf6e7b0, 0xd8e8f5, 0xe8d5f0, 0xf8d9b8, 0xc9ead1];
const DOORS = [0x8a3a2a, 0x2f4a3a, 0x3a5a7a, 0xf2efe6, 0x6a4a2a, 0x1f3d5a, 0xb05a2a, 0x5a2a3a];
const TRIMS = [0xf4f1ea, 0xece4d2, 0x5a4030, 0x2f4a3a, 0x8a5a3a, 0x3a4a6a, 0xf4f1ea, 0xf4f1ea];
function planLots(c, side) {
  const west = side === 'west', len = c.z1 - c.z0, deep = Math.min(25, (c.x1 - c.x0 - 6) / 2), yaw = west ? -Math.PI / 2 : Math.PI / 2;
  const rnd = seeded((c.seed ^ (west ? 0x51f3a : 0x7a21c)) >>> 0);
  const O = west ? { x: c.x0, z: c.z0 } : { x: c.x1, z: c.z1 }, A = west ? { x: 0, z: 1 } : { x: 0, z: -1 }, N = west ? { x: 1, z: 0 } : { x: -1, z: 0 };
  const at = (u, v) => ({ x: O.x + A.x * u + N.x * v, y: 0, z: O.z + A.z * u + N.z * v });
  const spans = [];
  for (let u = 0; u < len - 0.5;) { let w = pick(rnd, [15, 16, 17, 18, 18, 19, 20, 22]); if (len - u - w < 14) w = len - u; spans.push({ u0: u, w }); u += w; }
  return spans.map(({ u0, w }, i) => {
    const corner = i === 0 ? 'start' : i === spans.length - 1 ? 'end' : null;
    const floors = rnd() < 0.2 ? 2 : 1, setback = range(rnd, 5.8, 8.0);
    const garage = rnd() < 0.82 ? { w: rnd() < 0.45 ? 6.2 : 3.7, d: 6.6 } : null;
    let gSide = rnd() < 0.5 ? 0 : 1; // (which end of the lot the drive's on: away from a corner's side street)
    if (corner === 'start') gSide = 1; else if (corner === 'end') gSide = 0;
    const gW = garage ? garage.w : 3.4, edge = 0.9, sideGap = 1.5;
    const hw = Math.min(15.5, w - gW - edge - sideGap), hd = floors === 2 ? range(rnd, 9.2, 11) : range(rnd, 10.5, 12.8);
    const gu0 = gSide ? u0 + w - edge - gW : u0 + edge, hu0 = gSide ? gu0 - hw : gu0 + gW;
    const gv = garage ? Math.max(4.8, setback + (rnd() < 0.5 ? -1.1 : 0.4)) : setback + hd + 0.5;
    const driveW = garage ? garage.w - 0.7 : 3.0, driveU = gu0 + gW / 2;
    const color = pick(rnd, HOUSE), trim = pick(rnd, TRIMS), door = pick(rnd, DOORS), pitch = range(rnd, 0.34, 0.5);
    const doorU = gSide ? hw * range(rnd, 0.55, 0.72) : hw * range(rnd, 0.28, 0.45);
    const bays = Math.max(2, Math.round(hw / 3.1)), gwin = [];
    for (let k = 0; k < bays; k++) { const u = (hw * (k + 0.5)) / bays; if (Math.abs(u - doorU) > 1.5) gwin.push(u); }
    const specs = [];
    const house = { kind: 'building', lot: true, at: at(hu0, setback), yaw, w: hw, d: hd, floors, gh: 3.1, fh: 2.9, roof: 'hip', pitch, parapet: 0, back: true, home: true,
      color, trim, frame: pick(rnd, [0xf4f1ea, 0xf4f1ea, 0x3a3027, 0xe8ebee]), win: { w: 1.3, h: 1.3, sill: 0.95 }, groundWindows: gwin, bars: rnd() < 0.12, ac: 0.08,
      bays: Math.max(2, Math.round((hw - 1) / 3.2)), entries: [{ x: doorU, w: 1.1, h: 2.3, color: door }], sides: { L: 'windows', R: 'windows' },
      chimney: rnd() < 0.35 ? { side: gSide ? -1 : 1, brick: rnd() < 0.5 } : undefined };
    specs.push(house);
    if (garage) specs.push({ kind: 'garage', lot: true, at: at(gu0, gv), yaw, w: garage.w, d: garage.d, gh: 2.85, floors: 1, roof: 'hip', pitch: 0.32, color, trim, door: pick(rnd, [0xf2efe6, 0xe8e0d0, 0x8a6a4a, 0xf2efe6, 0x6a5a4a]) });
    const lot = { side, west, yaw, O, A, N, deep, u0, w, corner, setback, house, hu0, hw, hd, garage, gu0, gW, gv, driveW, driveU, doorU, specs,
      front: pick(rnd, ['open', 'open', 'hedge', 'wall', 'picket', 'iron', 'wall']), wallColor: rnd() < 0.5 ? color : 0xf2ede2,
      fence: pick(rnd, ['wood', 'wood', 'block']), fenceColor: pick(rnd, [0x8a6a4a, 0x7a6a5a, 0x9a8a72, 0x6a5040]),
      palm: rnd() < 0.42, oak: rnd() < 0.45, backTree: rnd() < 0.55, cypress: rnd() < 0.18, shrubs: 2 + Math.floor(rnd() * 4),
      pool: deep - (setback + hd) > 6.4 && rnd() < 0.4, carport: !garage && rnd() < 0.6, mailbox: rnd() < 0.7, seed: Math.floor(rnd() * 1e6),
      kerbPalm: rnd() < 0.7, porch: rnd() < 0.4 };
    // where its kerb's palm, its lot line's lamp and its drive are along the street (the lot's frame: z)
    const zOf = (u) => at(u, 0).z;
    lot.driveZ = zOf(driveU);
    lot.kerbZ = zOf(gSide ? u0 + Math.min(4, (w - gW) / 2) : u0 + w - Math.min(4, (w - gW) / 2));
    lot.lineZ = zOf(u0 + (gSide ? 0.6 : w - 0.6));
    // (on rising ground: the lot's terrace at the highest ground under it, the house and garage on it)
    let hi = 0; for (let uu = u0; uu <= u0 + w + 0.01; uu += w / 4) for (let vv = 0; vv <= deep + 0.01; vv += deep / 4) { const p = at(uu, vv); hi = Math.max(hi, groundAt(p.x, p.z)); }
    lot.y = c.relief > 0.05 ? hi : 0;
    for (const s of specs) s.at.y = lot.y;
    return lot;
  });
}

// What a lot has round its house (Stream.buildCell, after the buildings): the lawn over it, the drive and the
// garden's path, the front boundary (open, a hedge, a low wall, a picket fence, a low wall with railings), the side
// and back fences, the bushes along the house, a palm or an oak in the front garden, a tree out back, a pool in some
// back yards, a mailbox by the drive. All in the face's frame (`F`: u along the street, v in from it as -z).
function yard(ctx, c, lot, places) {
  const { batch } = ctx, rnd = seeded(lot.seed), y0 = lot.y, L = lot;
  const F = new THREE.Matrix4().makeTranslation(L.O.x, y0, L.O.z).multiply(new THREE.Matrix4().makeRotationY(L.yaw));
  const q = new THREE.Quaternion().setFromAxisAngle(_Y, L.yaw);
  const add = (key, geo, color) => batch.add(key, geo, F, color);
  const bx = (u0, v0, u1, v1, ya, yb) => box(u0, ya, -v1, u1, yb, -v0); // (u along, v in)
  const solid = (u0, v0, u1, v1, ya, yb) => ctx.solids.push({ c: V((u0 + u1) / 2, (ya + yb) / 2, -(v0 + v1) / 2).applyMatrix4(F), half: V((u1 - u0) / 2, (yb - ya) / 2, (v1 - v0) / 2), q });
  const pad = (u0, v0, u1, v1, yb) => { if (u1 - u0 > 0.05 && v1 - v0 > 0.05) ctx.pads.push({ c: V((u0 + u1) / 2, (yb - 0.3) / 2, -(v0 + v1) / 2).applyMatrix4(F), half: V((u1 - u0) / 2, (yb + 0.3) / 2, (v1 - v0) / 2) }); };
  const toLot = (u, v) => V(u, 0, -v).applyMatrix4(F);
  const ua = L.u0, ub = L.u0 + L.w, D = L.deep;
  // the lawn, and the ground walked on (the pool's water is left open)
  const plane = (u0, v0, u1, v1, y, key, color = 0xffffff) => { const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0).rotateX(-Math.PI / 2).translate((u0 + u1) / 2, y, -(v0 + v1) / 2); metreUV(g); add(key, g, color); };
  const lawnTint = [[1, 1, 1], [1.12, 1.02, 0.86], [0.92, 1.0, 0.9], [1.25, 1.06, 0.8], [1.04, 1.04, 0.96]][L.seed % 5]; // (some lusher, some drier)
  plane(ua, 0, ub, D, LAWN, 'lawn', lawnTint);
  const pool = L.pool ? { u0: L.hu0 + 0.8, u1: L.hu0 + Math.min(L.hw - 0.8, 9.5), v0: L.setback + L.hd + 2.2, v1: D - 1.4 } : null;
  if (pool) { pad(ua, 0, ub, pool.v0 - 0.4, LAWN); pad(ua, pool.v1 + 0.4, ub, D, LAWN); pad(ua, pool.v0 - 0.4, pool.u0 - 0.4, pool.v1 + 0.4, LAWN); pad(pool.u1 + 0.4, pool.v0 - 0.4, ub, pool.v1 + 0.4, LAWN); }
  else pad(ua, 0, ub, D, LAWN);
  // on rising ground: the terrace's walls down to the ground round it
  if (y0 > 0.01) for (const [u0, v0, u1, v1] of [[ua, 0, ub, 0], [ua, D, ub, D], [ua, 0, ua, D], [ub, 0, ub, D]]) {
    const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / 3));
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n, uA = u0 + (u1 - u0) * a, vA = v0 + (v1 - v0) * a, uB = u0 + (u1 - u0) * b, vB = v0 + (v1 - v0) * b;
      const pm = toLot((uA + uB) / 2, (vA + vB) / 2), g = Math.min(groundAt(pm.x, pm.z), groundAt(toLot(uA, vA).x, toLot(uA, vA).z), groundAt(toLot(uB, vB).x, toLot(uB, vB).z));
      if (y0 - g < 0.12) continue;
      const t = 0.25, along = u1 !== u0;
      add('concrete', along ? bx(uA, vA - t, uB, vA + t, g - y0 - 0.3, LAWN + 0.06) : bx(uA - t, vA, uA + t, vB, g - y0 - 0.3, LAWN + 0.06), 0xc8bca8);
    }
  }
  // the drive, its apron across the pavement, and the path from the pavement to the front door
  const dv1 = L.garage ? L.gv : L.setback + L.hd + 4;
  add('pavement', bx(L.driveU - L.driveW / 2, 0, L.driveU + L.driveW / 2, dv1, LAWN, LAWN + 0.035), [1.3, 1.27, 1.2]);
  const pu = L.hu0 + L.doorU;
  add('pavement', bx(pu - 0.6, 0, pu + 0.6, L.setback - 0.3, LAWN, LAWN + 0.03), [1.22, 1.17, 1.08]);
  add('concrete', bx(pu - 0.9, L.setback - 0.6, pu + 0.9, L.setback + 0.05, LAWN, LAWN + 0.16), 0xc8c0b2); // the front step
  // the front boundary along the pavement, open at the path and the drive
  const gaps = [[pu - 0.8, pu + 0.8], [L.driveU - L.driveW / 2 - 0.3, L.driveU + L.driveW / 2 + 0.3]].sort((a, b) => a[0] - b[0]);
  const runs = []; let u = ua + 0.05;
  for (const [g0, g1] of gaps) { if (g0 > u + 0.3) runs.push([u, g0]); u = Math.max(u, g1); }
  if (ub - 0.05 > u + 0.3) runs.push([u, ub - 0.05]);
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i][1] - runs[i][0] < 2.4) runs.splice(i, 1); // (no stubs of wall between the path and the drive)
  const fv = 0.35;
  for (const [r0, r1] of runs) {
    if (L.front === 'hedge') { add('hedge', bx(r0, fv - 0.35, r1, fv + 0.35, LAWN, 0.95), 0x2c4a22); solid(r0, fv - 0.35, r1, fv + 0.35, 0, 0.95); }
    else if (L.front === 'wall' || L.front === 'iron') {
      const h = L.front === 'iron' ? 0.45 : 0.8;
      add('stucco', bx(r0, fv - 0.15, r1, fv + 0.15, -0.2, h), L.wallColor);
      add(L.front === 'iron' ? 'concrete' : 'tile', L.front === 'iron' ? bx(r0 - 0.03, fv - 0.2, r1 + 0.03, fv + 0.2, h, h + 0.07) : bx(r0 - 0.03, fv - 0.21, r1 + 0.03, fv + 0.21, h, h + 0.07), L.front === 'iron' ? 0xe8e2d6 : 0xffffff);
      if (L.front === 'iron') {
        for (let x = r0 + 0.08; x < r1 - 0.05; x += 0.14) add('iron', bx(x - 0.012, fv - 0.012, x + 0.012, fv + 0.012, h + 0.07, h + 0.95), 0x1d1c1b);
        add('iron', bx(r0, fv - 0.02, r1, fv + 0.02, h + 0.9, h + 0.95), 0x1d1c1b);
      }
      solid(r0, fv - 0.2, r1, fv + 0.2, 0, L.front === 'iron' ? h + 0.95 : h + 0.07);
    } else if (L.front === 'picket') {
      for (let x = r0 + 0.06; x < r1 - 0.03; x += 0.16) add('paint', bx(x - 0.035, fv - 0.012, x + 0.035, fv + 0.012, LAWN, 0.92 + 0.04 * Math.abs(Math.sin(x * 9.7))), 0xf4f1ea);
      for (const h of [0.3, 0.72]) add('paint', bx(r0, fv + 0.012, r1, fv + 0.04, h, h + 0.07), 0xf4f1ea);
      solid(r0, fv - 0.05, r1, fv + 0.05, 0, 0.95);
    }
  }
  // the side fences between the back yards (each lot builds the one on its start's line; the corners' on the street
  // a stucco wall), from the house's front back to the alley, and the back fence on the alley
  const fence = (u0, v0, u1, v1, street) => {
    const h = street ? 1.8 : 1.75, alongU = Math.abs(u1 - u0) > Math.abs(v1 - v0);
    const g = alongU ? bx(u0, v0 - 0.05, u1, v0 + 0.05, -0.2, h) : bx(u0 - 0.05, v0, u0 + 0.05, v1, -0.2, h);
    if (street || L.fence === 'block') { add('stucco', alongU ? bx(u0, v0 - 0.1, u1, v0 + 0.1, -0.2, h) : bx(u0 - 0.1, v0, u0 + 0.1, v1, -0.2, h), street ? L.wallColor : 0xe2dccf); add('concrete', alongU ? bx(u0, v0 - 0.13, u1, v0 + 0.13, h, h + 0.06) : bx(u0 - 0.13, v0, u0 + 0.13, v1, h, h + 0.06), 0xd8d2c4); }
    else {
      add('paint', g, L.fenceColor);
      const len = alongU ? u1 - u0 : v1 - v0, n = Math.max(1, Math.round(len / 2.4));
      for (let k = 0; k <= n; k++) { const t = k / n, uu = u0 + (u1 - u0) * t, vv = v0 + (v1 - v0) * t; add('paint', bx(uu - 0.06, vv - 0.06, uu + 0.06, vv + 0.06, -0.2, h + 0.08), new THREE.Color(L.fenceColor).multiplyScalar(0.8)); }
      for (const hh of [0.25, h - 0.3]) add('paint', alongU ? bx(u0, v0 + 0.05, u1, v0 + 0.1, hh, hh + 0.09) : bx(u0 + 0.05, v0, u0 + 0.1, v1, hh, hh + 0.09), new THREE.Color(L.fenceColor).multiplyScalar(0.85));
    }
    if (alongU) solid(u0, v0 - 0.1, u1, v0 + 0.1, 0, h); else solid(u0 - 0.1, v0, u0 + 0.1, v1, 0, h);
  };
  const vb = L.setback + 1.2;
  if (L.corner !== 'start' || !c.south) fence(ua, vb, ua, D - 0.1, false);
  if (L.corner === 'start') fence(ua + 0.1, vb, ua + 0.1, D - 0.1, true);
  if (L.corner === 'end') fence(ub - 0.1, vb, ub - 0.1, D - 0.1, true);
  fence(ua, D - 0.1, ub, D - 0.1, false);
  // the garden: bushes along the house's front (not at the door), a palm or an oak, a tree out back, a cypress
  const tree = (kind, uu, vv, h, w, tint) => { const p = toLot(uu, vv); ctx.trees.push({ kind, x: p.x, y: y0 + LAWN, z: p.z, h, w, tint }); };
  // (some of them in flower: bougainvillea's magenta, hibiscus red, a yellow)
  const bloom = rnd() < 0.45 ? pick(rnd, [[2.3, 0.55, 1.6], [2.5, 0.62, 0.6], [2.1, 1.7, 0.45], [2.4, 0.9, 1.9]]) : null;
  for (let k = 0; k < L.shrubs; k++) { const uu = L.hu0 + 0.8 + ((L.hw - 1.6) * (k + 0.5)) / L.shrubs; if (Math.abs(uu - pu) < (L.porch ? 2.0 : 1.3)) continue; tree('shrub', uu, L.setback - 0.95, 0.9 + rnd() * 0.5, 1.2 + rnd() * 0.6, bloom && k % 2 === 0 ? bloom : undefined); }
  // a porch over the front door on some: its slab, two posts, a little tiled roof
  if (L.porch) {
    const v0 = L.setback - 2.1;
    add('concrete', bx(pu - 1.45, v0, pu + 1.45, L.setback, LAWN - 0.05, LAWN + 0.17), 0xd2c8b6);
    for (const s of [-1, 1]) { add('paint', bx(pu + s * 1.3 - 0.08, v0 + 0.12, pu + s * 1.3 + 0.08, v0 + 0.28, LAWN + 0.17, 2.62), L.house.trim); solid(pu + s * 1.3 - 0.08, v0 + 0.12, pu + s * 1.3 + 0.08, v0 + 0.28, 0, 2.62); }
    add('paint', bx(pu - 1.45, v0 + 0.08, pu + 1.45, v0 + 0.32, 2.5, 2.68), L.house.trim);
    hipRoof(ctx, F.clone().multiply(new THREE.Matrix4().makeTranslation(pu - 1.55, 0, -v0)), 3.1, 2.1, 2.68, 0.42);
  }
  const openU = L.driveU < L.hu0 + L.hw / 2 ? ub - 2.2 : ua + 2.2; // (the garden's corner away from the drive)
  if (L.palm) {
    const p = toLot(openU, L.setback * 0.42), s = 0.55 + rnd() * 0.12;
    places.push({ k: rnd() < 0.5 ? 'palm0' : 'palm1', M: new THREE.Matrix4().compose(V(p.x, y0 + LAWN, p.z), _q.setFromAxisAngle(_Y, rnd() * 6), _s.setScalar(s)), s });
  } else if (L.oak) tree('oak', (openU + pu) / 2, L.setback * 0.5, 4.8 + rnd() * 1.8, 4.2 + rnd() * 1.4);
  if (L.backTree && !L.pool) tree('oak', L.hu0 + L.hw * (0.25 + rnd() * 0.5), D - 2.8, 5 + rnd() * 3, 5 + rnd() * 2);
  if (L.cypress) for (const dv of [0, 2.4]) tree('cypress', ua + 1.1, L.setback + L.hd + 1.5 + dv, 6 + rnd() * 2, 5.5);
  // a patio slab behind the house, and the pool: its coping round the water
  const pv = L.setback + L.hd;
  add('pavement', bx(L.hu0 + 0.5, pv, L.hu0 + Math.min(L.hw, 6.5), pv + 2.2, LAWN, LAWN + 0.03), 0xd8cfc0);
  if (pool) {
    add('pool', bx(pool.u0, pool.v0, pool.u1, pool.v1, LAWN - 0.04, LAWN - 0.035), 0xffffff);
    add('concrete', bx(pool.u0, pool.v0, pool.u1, pool.v1, -0.05, LAWN - 0.07), 0x6ab0c8); // (its floor, seen through the water)
    for (const [a0, b0, a1, b1] of [[pool.u0 - 0.4, pool.v0 - 0.4, pool.u1 + 0.4, pool.v0], [pool.u0 - 0.4, pool.v1, pool.u1 + 0.4, pool.v1 + 0.4], [pool.u0 - 0.4, pool.v0, pool.u0, pool.v1], [pool.u1, pool.v0, pool.u1 + 0.4, pool.v1]]) {
      add('concrete', bx(a0, b0, a1, b1, LAWN - 0.1, LAWN + 0.08), 0xf0ece2);
      solid(a0, b0, a1, b1, 0, LAWN + 0.08);
    }
  }
  // a carport over the drive: posts and a flat roof
  if (L.carport) {
    const c0 = L.setback + 1, c1 = c0 + 5.6, a = L.driveU - L.driveW / 2 - 0.1, b = L.driveU + L.driveW / 2 + 0.1;
    for (const [uu, vv] of [[a, c0], [b, c0], [a, c1], [b, c1]]) { add('paint', bx(uu - 0.07, vv - 0.07, uu + 0.07, vv + 0.07, LAWN, 2.45), 0xf2efe6); solid(uu - 0.07, vv - 0.07, uu + 0.07, vv + 0.07, 0, 2.45); }
    add('paint', bx(a - 0.2, c0 - 0.3, b + 0.2, c1 + 0.3, 2.45, 2.6), 0xf2efe6);
    ctx.solids.push({ c: V((a + b) / 2, 2.52, -(c0 + c1) / 2).applyMatrix4(F), half: V((b - a) / 2 + 0.2, 0.08, (c1 - c0) / 2 + 0.3), q });
  }
  // the mailbox on its post by the drive
  if (L.mailbox) {
    const mu = L.driveU + (L.driveU < L.hu0 ? 1 : -1) * (L.driveW / 2 + 0.6);
    add('paint', bx(mu - 0.05, 0.55, mu + 0.05, 0.65, LAWN, 1.0), 0x5a4a3a);
    add('metal', bx(mu - 0.12, 0.42, mu + 0.12, 0.78, 1.0, 1.2), pick(rnd, [0x2a2a2a, 0xe8e8e8, 0x2f4a3a]));
  }
}

// A garage at its house's side (Stream.buildCell, as the kit builds the house): stucco walls, its door a ribbed
// metal up-and-over in its opening, a lamp beside it, a hip roof of the house's tiles. The kit's building frame:
// its front along +x from `at`, facing +z, its body behind.
function garage(ctx, s) {
  const M = new THREE.Matrix4().makeTranslation(s.at.x, s.at.y ?? 0, s.at.z).multiply(new THREE.Matrix4().makeRotationY(s.yaw));
  const { batch } = ctx, w = s.w, d = s.d, h = s.gh, t = 0.25, dh = 2.25, pier = Math.min(0.35, (w - 2.6) / 2 + 0.1);
  batch.add('stucco', box(0, 0, -t, pier, h, 0), M, s.color);
  batch.add('stucco', box(w - pier, 0, -t, w, h, 0), M, s.color);
  batch.add('stucco', box(pier, dh, -t, w - pier, h, 0), M, s.color);
  batch.add('stucco', box(0, 0, -d, t, h, -t), M, s.color);
  batch.add('stucco', box(w - t, 0, -d, w, h, -t), M, s.color);
  batch.add('stucco', box(t, 0, -d, w - t, h, -d + t), M, s.color);
  // the door: painted panels in four bands, a groove between each, a handle
  batch.add('paint', box(pier, 0.02, -t + 0.04, w - pier, dh, -t + 0.08), M, s.door);
  const groove = new THREE.Color(s.door).multiplyScalar(0.62);
  for (let k = 1; k < 4; k++) batch.add('paint', box(pier + 0.02, 0.02 + (k * (dh - 0.02)) / 4 - 0.02, -t + 0.08, w - pier - 0.02, 0.02 + (k * (dh - 0.02)) / 4 + 0.015, -t + 0.085), M, groove);
  for (let k = 1; k < Math.round((w - 2 * pier) / 1.2); k++) { const u = pier + (k * (w - 2 * pier)) / Math.round((w - 2 * pier) / 1.2); batch.add('paint', box(u - 0.012, 0.05, -t + 0.08, u + 0.012, dh - 0.03, -t + 0.085), M, groove); }
  batch.add('metal', box(w / 2 - 0.15, 0.42, -t + 0.08, w / 2 + 0.15, 0.47, -t + 0.12), M, 0x8a8a86);
  batch.add('paint', box(pier - 0.06, 0, -0.02, pier, dh + 0.06, 0.03), M, s.trim);
  batch.add('paint', box(w - pier, 0, -0.02, w - pier + 0.06, dh + 0.06, 0.03), M, s.trim);
  batch.add('paint', box(pier - 0.06, dh, -0.02, w - pier + 0.06, dh + 0.08, 0.03), M, s.trim);
  batch.add('metal', box(w - pier + 0.12, 1.9, 0, w - pier + 0.26, 2.12, 0.08), M, 0x2b2620);
  batch.add('lamp', box(w - pier + 0.14, 1.93, 0.08, w - pier + 0.24, 2.08, 0.14), M, 0xfff0cc);
  hipRoof(ctx, M, w, d, h, s.pitch ?? 0.32);
  ctx.solids.push({ c: V(w / 2, h / 2, -d / 2).applyMatrix4(M), half: V(w / 2, h / 2, d / 2), q: new THREE.Quaternion().setFromRotationMatrix(M) });
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
