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
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { piece } from '../props/Props.js';
import { RAPIER } from '../engine/Physics.js';
import { pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Batch, cityMaterials, cityU } from './Kit.js';
import { building, box, label } from './Building.js';
import { tower } from './Tower.js';
import { SignAtlas } from './Signs.js';
import { CityIndex, seeded, streetX, EW, DOWNTOWN, LOT_Z, PIER } from './Plan.js';
import { cityGround } from './Ground.js';
import { buildWaterfront } from './Waterfront.js';
import { buildLandmarks } from './Landmarks.js';
import { broadleaf, foliageMaterial, forest } from '../fx/Trees.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = V(0, 0, LOT_Z);
const FAR = new Set(['stucco', 'pbrick', 'brick', 'roofing', 'roofTile', 'glass', 'pavement']);
const PAVE = 0.14;
// the street kit's pieces (Ferris.js's KIT), their scale on the street
const PIECES = {
  lamp: ['cityprops', /low_poly012_/, 1.8], mast: ['cityprops', /low_poly_metal_street_props_0$/, 1], signal: ['cityprops', /low_poly011_/, 1],
  hydrant: ['cityprops', /low_poly002_/, 1], palm0: ['palms', /^Palm_tree_001/, 1], palm1: ['palms', /^Palm_tree_002/, 1],
  bench: ['parkbench', /Object_2/, 1],
};
// how they're touched (props/Smash.js): the posts snap, the palms are fixed at the trunk
const TOUCH = {
  lamp: { kind: 'breaks', mass: 45, strong: 14, r: 0.14, h: 6.5 }, mast: { kind: 'breaks', mass: 160, strong: 30, r: 0.18, h: 6.5 },
  signal: { kind: 'breaks', mass: 60, strong: 16, r: 0.14, h: 4.5 }, hydrant: { kind: 'breaks', mass: 70, strong: 12, r: 0.2, h: 0.8 },
  palm0: { kind: 'solid', r: 0.28, h: 7 }, palm1: { kind: 'solid', r: 0.28, h: 7 },
  bench: { kind: 'solid', stuff: 'wood', box: new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.3), new THREE.Vector3(0.9, 0.85, 0.3)) }, // (bolted down on the promenade)
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _p = V(0, 0, 0), _Y = V(0, 1, 0);
function freeArray() { this.array = null; }
const rectDist = (c, x, z) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1));

export class CityStream {
  constructor(f) {
    this.f = f;
    this.index = new CityIndex();
    this.root = new THREE.Group();
    this.root.name = 'city';
    f.scene.add(this.root);
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
    // the signs: two atlases shared by every block, a sign drawn once (Building.js's `label` looks it up)
    const signs = (this.signs = { painted: new SignAtlas(2048), lit: new SignAtlas(2048), cache: new Map() });
    mats.sign = new THREE.MeshStandardMaterial({ map: signs.painted.texture, roughness: 0.72, alphaTest: 0.4 });
    mats.signLit = new THREE.MeshStandardMaterial({ map: signs.lit.texture, emissiveMap: signs.lit.texture, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.4 });
    signs.painted.key = 'sign'; signs.lit.key = 'signLit';
    this.litMats = [mats.signLit];
    let page = 1;
    signs.more = (lit) => {
      const a = new SignAtlas(2048), m = (lit ? mats.signLit : mats.sign).clone();
      a.key = `${lit ? 'signLit' : 'sign'}${++page}`;
      m.map = a.texture;
      if (lit) { m.emissiveMap = a.texture; this.litMats.push(m); }
      mats[a.key] = m;
      signs[lit ? 'lit' : 'painted'] = a;
      return a;
    };
    mats.roofTile = mats.tile;
    // the parks' hedges, trees and water (Stream.park)
    mats.hedge = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    this.trees = [broadleaf({ s: 8 }), broadleaf({ s: 9 })];
    this.treeMat = foliageMaterial(cityU.uTime);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3a6a72, roughness: 0.05, metalness: 0, envMapIntensity: 1.2 });
    // the lamps' pools on the pavements and the shops' light spilling out, at night
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)');
    this.pool = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.62, 0.46, 0.28), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
    this.spill = this.pool.clone();
    this.spill.color.setRGB(0.5, 0.45, 0.36);
    // the street kit's pieces, as templates for instancing
    this.kit = {};
    for (const [k, [name, re]] of Object.entries(PIECES)) {
      const o = piece(name, re, { root: true });
      o.updateMatrixWorld(true);
      const parts = [];
      o.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, M: m.matrixWorld.clone() }); });
      this.kit[k] = { o, parts };
    }
    yield;
    this.ground = cityGround();
    f.scene.add(this.ground);
    this.buildFar();
    yield;
    this.waterfront = yield* buildWaterfront(this);
    // the freeway, the channel and its bridges (city/Landmarks.js)
    this.landmarks = yield* buildLandmarks(this);
  }

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
          float side = 1.0 - step(0.6, abs(n.y)), kind = vInfo.z, gh = vInfo.x, fh = max(vInfo.y, 2.5);
          float u = abs(n.x) > abs(n.z) ? vFw.z : vFw.x, y = vFw.y;
          float tower = step(1.5, kind) * (1.0 - step(2.5, kind));
          float cw = mix(3.2, 1.6, tower);
          float fu = fract(u / cw), row = y < gh ? -1.0 : floor((y - gh) / fh), fv = y < gh ? y / gh : fract((y - gh) / fh);
          float win;
          if (tower > 0.5) win = step(0.24, fv) * step(fv, 0.88) * step(0.04, fu) * step(fu, 0.96);
          else if (y < gh) win = (1.0 - step(0.5, kind)) * step(0.1, fv) * step(fv, 0.74) * step(0.06, fu) * step(fu, 0.94);
          else win = step(0.27, fv) * step(fv, 0.75) * step(0.3, fu) * step(fu, 0.7) * (1.0 - step(2.5, kind) * 0.85);
          win *= step(y, vTop - (tower > 0.5 ? 2.0 : 1.2)) * side;
          // a pattern under a few pixels is its average (it crawls otherwise as the camera moves)
          float px = max(fwidth(u) / cw, fwidth(y) / fh);
          win = mix(win, mix(0.22, 0.6, tower) * side, smoothstep(0.18, 0.5, px));
          float cell = fH(vec3(floor(u / cw), row, floor(vInfo.w)));
          vec3 glass = mix(vec3(0.17, 0.2, 0.24), uSkyHor * 0.55, 0.35 + 0.25 * tower);
          if (tower > 0.5) glass = mix(diffuseColor.rgb * 0.45, uSkyHor * 0.6, 0.3 + 0.2 * cell);
          vec3 wall = tower > 0.5 ? diffuseColor.rgb * 0.55 : diffuseColor.rgb * 0.74 * (0.88 + 0.12 * fH(vec3(floor(vFw.xz / 9.0), 1.0))); // (a plain colour reads paler than the textured walls it stands in for)
          diffuseColor.rgb = mix(wall, glass, win);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.28), 1.0 - side); // the roofs
          diffuseColor.rgb *= mix(1.0, 0.82, step(y, 0.9) * side); // (grime at the foot)
          fLit = vec3(1.0, 0.78, 0.5) * win * step(cell, 0.34) * uNight * 1.3;
        }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fLit;');
    };
    mat.customProgramCacheKey = () => 'cityFar';
    const mesh = (this.far = new THREE.InstancedMesh(geo, mat, n));
    boxes.forEach((b, i) => {
      _m.compose(_p.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2), _q.identity(), _s.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0));
      mesh.setMatrixAt(i, _m);
      const s = b.spec, tower = s.kind === 'tower';
      mesh.setColorAt(i, new THREE.Color(tower ? s.glass : s.color ?? 0xe6dcc6));
      const kind = tower ? 2 : (s.gh ?? 4) > 6 ? 3 : s.shops?.length ? 0 : 1; // (a warehouse's one storey is tall)
      info.set([tower ? s.lobby : s.gh ?? 4.3, s.fh ?? 3.2, kind, (i * 7.31) % 977], i * 4);
      b.fi = i;
    });
    mesh.position.copy(ORIGIN);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'cityFar';
    this.root.add(mesh);
  }
  farShow(cell, on) {
    for (const b of cell.boxes) this.show[b.fi] = on ? 1 : 0;
    this.far.geometry.attributes.aShow.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------- streaming
  reach(c) { return (c.reach ??= c.specs.some((s) => s.kind === 'tower') ? 950 : c.core ? 280 : 220); }

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
    if (gone && gone.state === 'built' && gone.d > this.reach(gone) * 1.25 + 40) this.disposeCell(gone);
    this.waterfront?.update(dt);
  }

  // which blocks to build, nearest first, and which to put away
  plan(x, z) {
    let near = Infinity;
    for (const c of this.index.cells) {
      const d = (c.d = rectDist(c, x, z)), r = this.reach(c);
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
  }

  // a built block's tiers by distance: the trim and the kit within 210 m, shadows within 140
  lodCells(x, z) {
    for (const c of this.index.cells) {
      const b = c.built;
      if (!b) continue;
      const d = rectDist(c, x, z);
      const near = b.near.visible ? d < 230 : d < 210, kit = b.kit.visible ? d < 185 : d < 165, cast = d < 140;
      if (near !== b.near.visible) b.near.visible = near;
      if (kit !== b.kit.visible) b.kit.visible = kit;
      if (cast !== b.cast) { b.cast = cast; for (const m of b.casters) m.castShadow = cast; }
    }
  }

  // ---------------------------------------------------------------------------- a block
  *buildCell(c) {
    const f = this.f, rnd = seeded(c.seed ^ 0x5bd1e995);
    const ctx = { batch: new Batch(), mats: this.mats, signs: this.signs, rnd, props: false, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [],
      decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [], beacons: [] };
    for (const s of c.specs) {
      // (their backs on the alleys blank: windows there were a third of a block's triangles, seen from nowhere)
      const spec = { back: false, ...s, at: V(s.at.x, 0, s.at.z), sides: s.sides && { ...s.sides } };
      if (s.kind === 'tower') tower(ctx, spec);
      else {
        const b = building(ctx, spec);
        if (s.label) {
          const lw = s.labelW ?? 3.2, y = s.labelTop ? b.H + 0.15 : (s.gh ?? 4.3) + 0.15;
          label(ctx, b.M, s.w / 2 - lw, s.w / 2 + lw, y, 0.7, s.label);
        }
      }
      yield;
    }
    const places = [], extras = [];
    this.street(ctx, c, places);
    if (c.park) this.park(ctx, c, places, extras);
    yield;
    const merged = yield* ctx.batch.buildSteps(this.mats, { cell: 4000, chunk: 350 });
    // its groups: what's drawn from anywhere in reach, the trim, the street kit, the night's light
    const g = new THREE.Group(), far = new THREE.Group(), near = new THREE.Group(), kit = new THREE.Group(), night = new THREE.Group();
    g.name = `block ${c.id}`;
    g.position.copy(ORIGIN);
    g.add(far, near, kit, night);
    const towers = c.specs.some((s) => s.kind === 'tower'), casters = [];
    for (const m of extras) { far.add(m); if (m.castShadow) casters.push(m); }
    for (const m of [...merged.children]) {
      // once on the GPU its arrays aren't needed here (a block's were 16 MB of the page's memory): nothing
      // reads them back (the colliders are boxes, the rays Rapier's), and its bounds are worked out already
      for (const a of [...Object.values(m.geometry.attributes), m.geometry.index]) a?.onUpload(freeArray);
      const key = m.name.replace('city_', '');
      (FAR.has(key) || key.startsWith('sign') || (towers && (key === 'metal' || key === 'concrete')) ? far : near).add(m);
      if (m.castShadow) casters.push(m);
    }
    // the kit, instanced (placeKit)
    const items = [], bodies = [];
    this.placeKit(places, kit, items, casters);
    yield;
    // the colliders: each mass, its parapets, the pavements; a hip roof as its hull
    const P = f.physics;
    for (const s of ctx.solids) bodies.push(P.fixedBox(s.c.clone().add(ORIGIN), s.half, s.q));
    for (const s of ctx.parapets) bodies.push(P.fixedBox(s.c.clone().add(ORIGIN), s.half, s.q));
    for (const s of ctx.pads) bodies.push(P.fixedBox(s.c.clone().add(ORIGIN), s.half));
    for (const h of ctx.hulls) {
      const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(h.pts.flatMap((p) => [p.x + ORIGIN.x, p.y, p.z + ORIGIN.z])));
      if (desc) bodies.push(P.fixedCollider(desc));
    }
    yield;
    // night: the street lamps' pools, the shops' light on the pavement (each block one mesh of each)
    const pools = [], spills = [];
    for (const l of ctx.lamps) if (l.street) pools.push(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(l.at.x, PAVE + 0.01, l.at.z));
    for (const s of ctx.shops) {
      const w = s.u1 - s.u0, cc = V((s.u0 + s.u1) / 2, 0, 2.2).applyMatrix4(s.F), N = V(0, 0, 1).transformDirection(s.F);
      spills.push(new THREE.PlaneGeometry(w + 1, 4.5).rotateX(-Math.PI / 2).rotateY(Math.atan2(N.x, N.z)).translate(cc.x, PAVE + 0.012, cc.z));
    }
    for (const [list, mat] of [[pools, this.pool], [spills, this.spill]]) if (list.length) night.add(new THREE.Mesh(mergeGeometries(list, false), mat));
    night.visible = this.night > 0.01;
    // what never moves keeps the matrices it has
    g.updateMatrixWorld(true);
    g.traverse((o) => { o.matrixAutoUpdate = false; });
    g.matrixWorldAutoUpdate = false; // (and three.js doesn't walk it every frame)
    near.visible = false; kit.visible = false;
    // shown a few meshes a frame (each is uploaded to the GPU the first frame it's drawn: a whole block at
    // once was a 60 ms frame), then its boxes put away
    const reveal = [...far.children];
    for (const m of reveal) m.visible = false;
    this.root.add(g);
    c.built = { group: g, far, near, kit, night, items, bodies, casters, cast: true };
    for (let i = 0; i < reveal.length; i += 3) {
      for (const m of reveal.slice(i, i + 3)) m.visible = true;
      this.frameBreak = true;
      yield;
    }
    this.farShow(c, false);
    this.built++;
  }

  // The street kit's pieces at `places` ({ k, M, s }, M in the lot's frame), instanced: one mesh for
  // each of a piece's parts, all its copies at once, into `group`; each one touchable where it stands
  // (props/Smash.js), a stand-in without meshes, and when a post snaps the real piece is put in its
  // place and its copy taken out of the instanced ones. (`items`: the Smash items made, `casters`: the
  // meshes that cast shadows)
  placeKit(places, group, items, casters = []) {
    const f = this.f, byKind = new Map();
    for (const p of places) (byKind.get(p.k) ?? byKind.set(p.k, []).get(p.k)).push(p);
    for (const [k, list] of byKind) {
      const t = this.kit[k], ims = [];
      for (const part of t.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((p, i) => im.setMatrixAt(i, _m.multiplyMatrices(p.M, part.M)));
        im.castShadow = k !== 'hydrant' && k !== 'bench';
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
    for (const grp of [b.far, b.near, b.night]) grp.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    b.kit.traverse((m) => { if (m.isInstancedMesh) m.dispose(); }); // (their geometry is the prop's, shared)
    const W = this.f.physics.world;
    for (const body of b.bodies) if (W.bodies.contains(body.handle)) W.removeRigidBody(body);
    for (const it of b.items) this.f.smash.remove(it);
    this.farShow(c, true);
    c.built = null;
    c.state = null;
    this.built--;
  }

  setNight(k) {
    this.night = k;
    this.mats.lamp.emissiveIntensity = k * 2.2;
    for (const m of this.litMats) m.emissiveIntensity = 0.08 + k * 0.5;
    this.pool.opacity = k; this.spill.opacity = k * 0.8;
    for (const c of this.index.cells) if (c.built) c.built.night.visible = k > 0.01;
    this.waterfront?.setNight(k);
  }

  // whether a point in the world is inside one of the city's buildings (flying into a block that
  // isn't built yet: its colliders aren't there)
  solidAt(x, y, z) { return this.index.solidAt(x - ORIGIN.x, y, z - ORIGIN.z); }
  // whether (x, z) in the world is on the pier's deck (somewhere to land, over the sea)
  onPier(x, z) { const lx = x - ORIGIN.x, lz = z - ORIGIN.z; return lx < PIER.x0 && lx > PIER.x1 && Math.abs(lz - PIER.z) < (lx < PIER.x1 + 125 ? 22 : PIER.w / 2); }

  // ---------------------------------------------------------------------------- the street
  // A park (city/Plan.js: a block left open). Its grass and paths are the ground's (Ground.js: a path
  // round it inside the hedge, two corner to corner, a ring round the fountain's square); here the hedge
  // with its gaps at the corners, the trees on the lawns (clear of the paths), benches round the ring
  // facing in, lamps, a palm at each corner of the square, and in the middle a fountain, or in the big
  // park a reflecting pool. Everything solid.
  park(ctx, c, places, extras) {
    const { batch } = ctx, I = new THREE.Matrix4(), rnd = ctx.rnd;
    const bx0 = streetX(c.j) + 12, bx1 = streetX(c.j + 1) - 12, bz0 = c.z0, bz1 = c.z1;
    const W = bx1 - bx0, H = bz1 - bz0, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, L = Math.hypot(W, H), dg = [W / L, H / L];
    const onPath = (x, z, m) => {
      const u = x - bx0, v = z - bz0, edge = Math.min(u, W - u, v, H - v), r = Math.hypot(x - cx, z - cz);
      const d1 = Math.abs(u * dg[1] - v * dg[0]), d2 = Math.abs((W - u) * dg[1] - v * dg[0]);
      return edge < 5 + m || r < 11 + m || Math.min(d1, d2) < 1.5 + m;
    };
    const put = (k, x, z, yaw, s = PIECES[k][2]) => places.push({ k, M: new THREE.Matrix4().compose(V(x, 0, z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s)), s });
    const pad = (x0, y0, z0, x1, y1, z1) => ctx.pads.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), half: V((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2) });
    // the hedge, a gap at each corner where the paths come in
    const hedge = (x0, z0, x1, z1) => { if (x1 - x0 < 0.5 || z1 - z0 < 0.5) return; batch.add('hedge', box(x0, 0, z0, x1, 0.95, z1), I, 0x26401c); pad(x0, 0, z0, x1, 0.95, z1); };
    const gap = 7.5;
    hedge(bx0 + gap, bz0 + 0.5, bx1 - gap, bz0 + 1.3); hedge(bx0 + gap, bz1 - 1.3, bx1 - gap, bz1 - 0.5);
    hedge(bx0 + 0.5, bz0 + gap, bx0 + 1.3, bz1 - gap); hedge(bx1 - 1.3, bz0 + gap, bx1 - 0.5, bz1 - gap);
    // the middle: a fountain, or the big park's pool
    const water = [];
    if (c.park === 'big') {
      const hx = 4.5, hz = 7;
      for (const [x0, z0, x1, z1] of [[-hx - 0.4, -hz - 0.4, hx + 0.4, -hz], [-hx - 0.4, hz, hx + 0.4, hz + 0.4], [-hx - 0.4, -hz, -hx, hz], [hx, -hz, hx + 0.4, hz]]) batch.add('concrete', box(cx + x0, 0, cz + z0, cx + x1, 0.5, cz + z1), I, 0xdcd4c4);
      water.push(new THREE.PlaneGeometry(hx * 2, hz * 2).rotateX(-Math.PI / 2).translate(cx, 0.38, cz));
      pad(cx - hx - 0.4, 0, cz - hz - 0.4, cx + hx + 0.4, 0.55, cz + hz + 0.4);
    } else {
      const basin = new THREE.LatheGeometry([new THREE.Vector2(4.65, 0.36), new THREE.Vector2(4.65, 0.55), new THREE.Vector2(5.2, 0.55), new THREE.Vector2(5.2, 0)], 40).translate(cx, 0, cz);
      batch.add('concrete', basin, I, 0xd9d1c1);
      batch.add('concrete', new THREE.CylinderGeometry(0.42, 0.6, 1.95, 18).translate(cx, 0.97, cz), I, 0xd2cab9);
      batch.add('concrete', new THREE.CylinderGeometry(1.75, 0.85, 0.34, 28).translate(cx, 2.05, cz), I, 0xd9d1c1);
      water.push(new THREE.CircleGeometry(4.65, 40).rotateX(-Math.PI / 2).translate(cx, 0.4, cz), new THREE.CircleGeometry(1.55, 28).rotateX(-Math.PI / 2).translate(cx, 2.2, cz));
      const pts = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (const y of [0, 0.55]) pts.push(V(cx + Math.cos(a) * 5.2, y, cz + Math.sin(a) * 5.2)); }
      ctx.hulls.push({ pts });
      pad(cx - 0.5, 0, cz - 0.5, cx + 0.5, 2.2, cz + 0.5);
    }
    if (water.length) { const m = new THREE.Mesh(mergeGeometries(water, false), this.waterMat); m.receiveShadow = true; extras.push(m); }
    // benches round the ring, lamps on it, palms at the square's corners
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6, x = cx + Math.cos(a) * 12.4, z = cz + Math.sin(a) * 12.4; put('bench', x, z, Math.atan2(cx - x, cz - z)); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, x = cx + Math.cos(a) * 11.9, z = cz + Math.sin(a) * 11.9; put('lamp', x, z, Math.atan2(cx - x, cz - z) + Math.PI / 2); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; put(i % 2 ? 'palm1' : 'palm0', cx + Math.cos(a) * 7.3, cz + Math.sin(a) * 7.3, rnd() * 6, 0.62 + rnd() * 0.1); }
    // the trees on the lawns, apart, clear of the paths; each trunk solid
    const spots = [[], []], n = c.park === 'big' ? 30 : 20;
    let made = 0;
    for (let t = 0; t < n * 14 && made < n; t++) {
      const x = bx0 + 2.5 + rnd() * (W - 5), z = bz0 + 2.5 + rnd() * (H - 5);
      if (onPath(x, z, 1.8) || spots.some((l) => l.some((s) => Math.hypot(s.x - x, s.z - z) < 6.8))) continue;
      const h = 6.5 + rnd() * 4.5;
      spots[made % 2].push({ x, y: 0, z, h, w: h * (0.75 + rnd() * 0.3) });
      pad(x - 0.3, 0, z - 0.3, x + 0.3, 3.2, z + 0.3);
      made++;
    }
    spots.forEach((list, i) => {
      if (!list.length) return;
      const m = forest(this.trees[i], this.treeMat, list, { shadows: true });
      m.frustumCulled = true;
      m.computeBoundingSphere?.();
      extras.push(m);
    });
  }

  // The pavements round a block out to the kerbs, the kerbs and gutters, and along its streets the
  // lamps and palms (alternating, 15 m apart in the core, 24 out of it), a hydrant every 56 m, and in
  // the core the signals at its corners. (`places`: the kit's pieces, for buildCell to instance)
  street(ctx, c, places) {
    const { batch } = ctx, I = new THREE.Matrix4();
    const pw = (k) => (k === 0 ? 5.5 : 5); // (the boulevard's are Hal's blocks' 5.5 m)
    const kW = c.j, kE = c.j + 1;
    const pave = (x0, x1, z0, z1) => {
      if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
      batch.add('pavement', box(x0, 0, z0, x1, PAVE, z1), I, 0xffffff);
      ctx.pads.push({ c: V((x0 + x1) / 2, PAVE / 2, (z0 + z1) / 2), half: V((x1 - x0) / 2, PAVE / 2, (z1 - z0) / 2) });
    };
    // a kerb along an edge (x = a, or z = a) from b0 to b1, the road on side s; its gutter in front
    const kerb = (alongZ, a, b0, b1, s) => {
      if (b1 - b0 < 0.1) return;
      if (alongZ) {
        batch.add('concrete', box(a - 0.09, 0, b0, a + 0.09, PAVE + 0.005, b1), I, 0xc9c3b8);
        batch.add('roadpaint', box(Math.min(a, a + s * 0.46), 0, b0, Math.max(a, a + s * 0.46), 0.02, b1), I, 0x77736d);
      } else {
        batch.add('concrete', box(b0, 0, a - 0.09, b1, PAVE + 0.005, a + 0.09), I, 0xc9c3b8);
        batch.add('roadpaint', box(b0, 0, Math.min(a, a + s * 0.46), b1, 0.02, Math.max(a, a + s * 0.46)), I, 0x77736d);
      }
    };
    const half = c.half, wOn = half !== 'east', eOn = half !== 'west';
    const zs = c.z0 - (c.south ? EW.front - EW.kerb : 0), zn = c.z1 + (c.north ? EW.front - EW.kerb : 0);
    const xw = c.x0 - pw(kW), xe = c.x1 + pw(kE);
    if (wOn) { pave(xw, c.x0, zs, zn); kerb(true, xw, zs, zn, -1); }
    if (eOn) { pave(c.x1, xe, zs, zn); kerb(true, xe, zs, zn, 1); }
    // along the east-west streets: beside Hal's blocks, only out to their own corners (or across his lot's front)
    const span = (row) => {
      if (!half) return [c.x0, c.x1];
      if (row === 'n' && c.r === 1) return half === 'west' ? [c.x0, streetX(0)] : [streetX(0), c.x1];
      return half === 'west' ? [c.x0, -46] : [60, c.x1];
    };
    if (c.south) { const [a, b] = span('s'); pave(a, b, zs, c.z0); kerb(false, zs, wOn ? xw : a, eOn ? xe : b, -1); }
    if (c.north) { const [a, b] = span('n'); pave(a, b, c.z1, zn); kerb(false, zn, wOn ? xw : a, eOn ? xe : b, 1); }
    // the kit along the north-south streets
    const step = c.core ? 15 : 24, put = (k, x, z, yaw, s = PIECES[k][2]) => {
      const M = new THREE.Matrix4().compose(V(x, PAVE, z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(s));
      places.push({ k, M, s });
    };
    for (const [on, xk, sgn, k] of [[wOn, xw, 1, kW], [eOn, xe, -1, kE]]) {
      if (!on) continue;
      let n = Math.floor(ctx.rnd() * 2);
      for (let z = c.z0 + 6; z < c.z1 - 5; z += step, n++) {
        if (n % 2 === 0) {
          put(ctx.rnd() < 0.5 ? 'palm0' : 'palm1', xk + sgn * 1.1, z, ctx.rnd() * 6, 0.6 + ctx.rnd() * 0.14);
          batch.add('iron', box(xk + sgn * 1.1 - 0.62, PAVE, z - 0.62, xk + sgn * 1.1 + 0.62, PAVE + 0.025, z + 0.62), I, 0x2a2622); // the tree's grate
        } else {
          put('lamp', xk + sgn * 0.5, z, -sgn * Math.PI / 2);
          ctx.lamps.push({ at: V(xk + sgn * 0.5 - sgn * 0.95 * 1.8, PAVE + 3.45 * 1.8, z), k: 1, street: true }); // (its head: the pool of light under it at night)
        }
      }
      for (let z = c.z0 + 14 + ctx.rnd() * 10; z < c.z1 - 8; z += 56) put('hydrant', xk + sgn * 0.35, z, 0);
      void k;
    }
    // the core's signals at its corners (each corner of a crossing is one block's): poles with an arm
    // out over the road, or the lights on a post; not at Hal's crossing or his lot (Ferris.js's own)
    if (!c.core) return;
    const own = (k, z) => k === 0 && (z === -210 || z === 70);
    const zS = c.z0 - EW.front, zN = c.z1 + EW.front;
    const corner = (on, k, zc, x, z, kind, yaw) => { if (on && !own(k, zc)) put(kind, x, z, yaw); };
    corner(c.west && c.north && wOn, kW, zN, xw + 0.6, zn - 0.6, 'mast', Math.PI);
    corner(c.east && c.north && eOn, kE, zN, xe - 0.6, zn - 0.6, 'signal', Math.PI / 2);
    corner(c.west && c.south && wOn, kW, zS, xw + 0.6, zs + 0.6, 'signal', -Math.PI / 2);
    corner(c.east && c.south && eOn, kE, zS, xe - 0.6, zs + 0.6, 'mast', 0);
  }
}

export { DOWNTOWN };
