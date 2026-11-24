// The Hills (the map rework, 2026-11-24: city/Layout.js HILLS): the ground rising north-east of Suburbia to the
// observatory's summit 118 m up, its winding roads (Layout.js hillRoads: Ridge Drive along the top, the climbs from
// Suburbia, from the east and from Coast Park), the houses on their terraces either side of them (Layout.js
// hillHouses: each cut level into the slope at its plot's height, facing its road), and the slopes' oaks and scrub.
//
// What's here: the roads' asphalt, shoulders and lines (always drawn: seen from all over the city); the observatory on
// the summit (a domed, Griffith-like building on its terrace over the city, the car park at the road's end behind
// it, the monument on its lawn: always drawn, floodlit at night); and, streamed by 200 m squares as the blocks are
// (Stream.js), each house as the kit builds one (Building.js: hip roofs of terracotta, or a modern flat roof) with
// what its terrace has: the retaining walls where it's cut into the slope, a deck out over the slope where it falls
// away, a pool on some, a garage and its drive where the road's near its level, else a parking bay by the road and
// the steps up or down, the lawn and the bushes; the roads' kerbs, guard rails on the downhill side where the slope
// drops away, and street lamps (their light emissive and their pools at night, no point lights); the trees' trunks.
// Far off, each house is a box and a roof (the city's far materials: nothing new to compile).
//
// The ground itself (its mesh from Layout.groundAt, its collider) is the terrain's (city/Relief.js, Terrain.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial } from '../fx/Textures.js';
import { Batch } from './Kit.js';
import { building, box, metreUV } from './Building.js';
import { hillHouses, hillRoads, groundAt, heightAt, nearest, ROAD_HALF, OBSERVATORY, HILLS, districtAt, highwayDistance, waterAt } from './Layout.js';
import { seeded, LOT_Z } from './Plan.js';
import { ribbon, cyl, lathe } from './Parks.js';
import { fixedCompound } from './Stream.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = V(0, 0, LOT_Z);
const I = new THREE.Matrix4();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(1, 1, 1), _p = V(0, 0, 0), _Y = V(0, 1, 0);
const CH = 200, REACH = 330;
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const range = (rnd, a, b) => a + rnd() * (b - a);
const FAR_KEYS = new Set(['stucco', 'pbrick', 'brick', 'roofing', 'roofTile', 'glass', 'pavement', 'lawn', 'gravel', 'pavers', 'hedge', 'water', 'pool', 'asphalt', 'concrete', 'obsWall', 'copper']);
const HUES = [0xf4f0e6, 0xf2ede2, 0xece4d2, 0xf3e6cc, 0xe8dcc4, 0xf5f2ea, 0xe6d6bc, 0xdcd8d0, 0xf0d8c0, 0xe8e0d8, 0xd8e4e2, 0xf2e2d2];

// a polyline moved `d` to its left (keeping each point's y)
function offset(line, d) {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    return { x: p.x - (dz / L) * d, z: p.z + (dx / L) * d, y: p.y };
  });
}
// a strip swept along a polyline: across it from offset o0 at height h0 to o1 at h1 (above each point's y)
function sweep(line, o0, h0, o1, h1) {
  const a = offset(line, o0), b = offset(line, o1), pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < line.length; i++) {
    if (i) s += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
    pos.push(a[i].x, a[i].y + h0, a[i].z, b[i].x, b[i].y + h1, b[i].z);
    uv.push(s, h0, s, h1 + Math.abs(o1 - o0));
  }
  for (let i = 0; i + 1 < line.length; i++) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const both = (g) => { const b = g.clone(); const ix = b.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; b.computeVertexNormals(); return [g, b]; };

export class Hills {
  constructor(stream) {
    this.s = stream;
    this.f = stream.f;
    this.root = new THREE.Group();
    this.root.name = 'hills';
    stream.root.add(this.root);
    this.chunks = new Map();
    this.queue = [];
    this.job = null;
    this.t = 1;
    this.night = 0;
  }

  // ---------------------------------------------------------------------------- made once
  *steps() {
    const s = this.s, mats = s.mats;
    mats.asphalt = pbrMaterial('asphalt_02', { repeat: [1 / 4, 1 / 4], tint: new THREE.Color(0.86, 0.84, 0.82) });
    Object.assign(mats.asphalt, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    // the observatory's walls (white plaster, floodlit at night) and its domes (copper gone green)
    mats.obsWall = pbrMaterial('white_plaster_02', { repeat: [1 / 3, 1 / 3], tint: new THREE.Color(1.3, 1.26, 1.18) });
    Object.assign(mats.obsWall, { vertexColors: true, emissive: new THREE.Color(1, 0.93, 0.8), emissiveIntensity: 0 });
    // (floodlit from below at night: brightest at the foot of each wall, falling off up it, the terrace's own
    // walls the brightest of all; uFlood is the terrace's height)
    this.flood = { value: 118 };
    mats.obsWall.onBeforeCompile = (sh) => {
      sh.uniforms.uFlood = this.flood;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vObsY;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_BATCHING
          vObsY = (modelMatrix * batchingMatrix * vec4(transformed, 1.0)).y;
        #else
          vObsY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uFlood; varying float vObsY;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float h = vObsY - uFlood; totalEmissiveRadiance *= h < 0.0 ? 0.55 + 0.45 * smoothstep(-8.0, 0.0, h) : mix(1.0, 0.18, smoothstep(0.0, 16.0, h)); }`);
    };
    mats.obsWall.customProgramCacheKey = () => 'obsWall';
    mats.copper = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x4f6e64, roughness: 0.42, metalness: 0.55, emissive: new THREE.Color(0.6, 0.75, 0.7), emissiveIntensity: 0 });
    this.roads = hillRoads();
    this.plan();
    yield;
    this.buildRoads();
    yield;
    this.buildObservatory();
    yield;
    this.buildTrees();
    yield;
    this.buildFar();
  }

  // Every house's plan (its kit spec and what its terrace has), every road's kerbs, rails and lamps, each filed in
  // its 200 m square
  plan() {
    const chunk = (x, z) => { const k = `${Math.floor(x / CH)},${Math.floor(z / CH)}`; let c = this.chunks.get(k); if (!c) { const gx = Math.floor(x / CH), gz = Math.floor(z / CH); c = { id: k, x0: gx * CH, x1: gx * CH + CH, z0: gz * CH, z1: gz * CH + CH, houses: [], roads: [], trunks: [], state: null, built: null }; this.chunks.set(k, c); } return c; };
    this.chunkAt = chunk;
    this.houses = hillHouses().map((p) => {
      const rnd = seeded(p.seed), c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
      const L = (lx, lz) => ({ x: p.x + lx * c + lz * sn, z: p.z - lx * sn + lz * c });
      // its road: the nearest, and where on it
      let road = null, best = Infinity;
      for (const r of this.roads) { const n = nearest(r, p.x, p.z); if (n.d < best) { best = n.d; road = { line: r, n }; } }
      const ry = road.line[road.n.i].y + (road.line[road.n.i + 1]?.y - road.line[road.n.i].y || 0) * road.n.t;
      const dy = p.y - ry, modern = rnd() < 0.3, floors = rnd() < 0.45 ? 2 : 1;
      const garage = Math.abs(dy) < 2.2 ? { w: rnd() < 0.5 ? 6.0 : 3.7 } : null;
      const hw = garage ? p.w - garage.w - 0.3 : p.w, doorX = -p.w / 2 + hw * range(rnd, 0.3, 0.6);
      const color = modern ? pick(rnd, [0xf6f4ee, 0xf2efe8, 0xe9e6de]) : pick(rnd, HUES), door = pick(rnd, [0x6a4a2a, 0x3a2a1c, 0x2f4a3a, 0x8a3a2a, 0x1f3d5a]);
      const H = 3.2 + (floors - 1) * 3.0;
      const bays = Math.max(2, Math.round(hw / 3.1)), gwin = [];
      for (let k = 0; k < bays; k++) { const u = (hw * (k + 0.5)) / bays; if (Math.abs(u - (doorX + p.w / 2)) > 1.5) gwin.push(u); }
      const at = L(-p.w / 2, p.d / 2);
      const spec = { kind: 'building', at: { x: at.x, y: p.y, z: at.z }, yaw: p.yaw, w: hw, d: p.d, floors, gh: 3.2, fh: 3.0, home: true, back: true,
        roof: modern ? undefined : 'hip', pitch: range(rnd, 0.32, 0.45), parapet: modern ? 0.9 : 0, coping: 'cap', color, trim: modern ? 0xe4e2dc : pick(rnd, [0xf4f1ea, 0x5a4030, 0x2f4a3a, 0xece4d2]),
        frame: modern ? 0x2a2a2a : pick(rnd, [0xf4f1ea, 0x3a3027]), win: modern ? { w: 2.2, h: 2.0, sill: 0.5 } : { w: 1.3, h: 1.35, sill: 0.95 }, groundWindows: gwin, bars: false, ac: 0.05,
        bays: Math.max(2, Math.round((hw - 1) / (modern ? 3.4 : 3.2))), entries: [{ x: doorX + p.w / 2, w: modern ? 1.3 : 1.1, h: 2.3, color: door }], sides: { L: 'windows', R: 'windows' },
        balconies: floors > 1 && rnd() < 0.5 ? [1] : undefined, balconyBays: [1, Math.max(1, Math.round((hw - 1) / 3.2) - 2)] };
      const gspec = garage && (() => { const g = L(p.w / 2 - garage.w, p.d / 2); return { kind: 'garage', at: { x: g.x, y: p.y, z: g.z }, yaw: p.yaw, w: garage.w, d: 6.6, gh: 2.85, floors: 1, roof: modern ? undefined : 'hip', pitch: 0.32, color, trim: spec.trim, door: pick(rnd, [0xf2efe6, 0x8a6a4a, 0x6a5a4a]) }; })();
      // which of its sides are cut into the slope (the ground beyond higher) and which fall away
      const nat = (lx, lz) => { const q = L(lx, lz); return heightAt(q.x, q.z) - p.y; };
      const tw = p.w / 2 + 3, td = p.d / 2 + 4;
      const sides = { back: nat(0, -td - 5.5), left: nat(-tw - 5.5, 0), right: nat(tw + 5.5, 0), front: nat(0, td + 5.5) };
      const fall = Object.entries(sides).filter(([k]) => k !== 'front').sort((a, b) => a[1] - b[1])[0];
      const house = { p, L, rnd, spec, gspec, road, ry, dy, modern, floors, H, hw, doorX, garage, tw, td, sides,
        deck: fall[1] < -2.2 && rnd() < 0.75 ? fall[0] : null, pool: rnd() < 0.3, seed: p.seed,
        box: { w: p.w, d: p.d, y0: p.y, y1: p.y + H + (modern ? 0.9 : ((p.d + 0.9) / 2) * spec.pitch) } };
      // where its steps (and its drive) come out on the road: the guard rail leaves a gap there
      const out = (lx) => { for (let lz = p.d / 2 + 0.2; lz < p.d / 2 + 22; lz += 0.5) { const w = L(lx, lz); if (nearest(road.line, w.x, w.z).d < ROAD_HALF + 1.4) return w; } return null; };
      house.gates = [out(doorX), garage ? out(p.w / 2 - garage.w / 2) : null].filter(Boolean);
      chunk(p.x, p.z).houses.push(house);
      return house;
    });
    // the roads' kerbs, rails and lamps, in pieces of about 40 m, each in the square its middle's in
    this.roads.forEach((r, ri) => {
      for (let i = 0; i + 1 < r.length; i += 4) {
        const seg = r.slice(i, Math.min(r.length, i + 5)), mid = seg[Math.floor(seg.length / 2)];
        chunk(mid.x, mid.z).roads.push({ ri, i, seg });
      }
    });
  }

  // ---------------------------------------------------------------------------- the roads (always drawn)
  buildRoads() {
    const s = this.s, B = s.batches, mats = s.mats, list = { asphalt: [], gravel: [], roadpaint: [] };
    this.roads.forEach((r, ri) => {
      const lift = 0.06 + ri * 0.004; // (where two meet, one's a few millimetres over the other)
      // its asphalt in pieces of about 80 m (so the camera leaves out what it can't see), the shoulders' gravel
      for (let i = 0; i + 1 < r.length; i += 8) {
        const seg = r.slice(i, Math.min(r.length, i + 9));
        list.asphalt.push(ribbon(seg, ROAD_HALF, lift, null, 2));
        for (const sd of [-1, 1]) list.gravel.push(ribbon(offset(seg, sd * (ROAD_HALF + 0.9)), 0.9, lift - 0.02, null, 1));
        // the lines: a double yellow down the middle, a white edge line each side (not across the junctions' ends)
        const paint = (d, hw, col) => { const g = ribbon(offset(seg, d), hw, lift + 0.012, null, 1); this.tint(g, col); list.roadpaint.push(g); };
        paint(-0.13, 0.055, 0xd8a02a); paint(0.13, 0.055, 0xd8a02a);
        paint(-(ROAD_HALF - 0.35), 0.06, 0xe4e2dc); paint(ROAD_HALF - 0.35, 0.06, 0xe4e2dc);
      }
    });
    this.roadHandles = [];
    for (const [key, geos] of Object.entries(list)) for (const g0 of geos) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      const h = B.add(key, mats[key], g, false); B.show(h, true); this.roadHandles.push(h);
    }
  }
  tint(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }

  // ---------------------------------------------------------------------------- the observatory (always there)
  // On the summit, facing down over Coast Park to downtown and the sea: a terrace on a tall retaining wall, its
  // balustrade along the edge; the building's long front across it, a great dome over the rotunda in the middle and
  // a smaller one at each end, pilastered wings between, the entrance under a portico; the lawn before it and the
  // monument's obelisk on its axis; the car park behind it at the road's end.
  buildObservatory() {
    const s = this.s, ctx = this.ctxFor(seeded(0x0b5e)), { batch } = ctx;
    const O = OBSERVATORY, face = Math.atan2(970 - O.z, -600 - O.x); // (toward downtown)
    const fx = Math.cos(face), fz = Math.sin(face);
    // (the building stands 32 m toward the city from the summit's point, clear of the roads behind it)
    const X = O.x + fx * 32, Z = O.z + fz * 32, yaw = Math.atan2(fx, fz);
    const M = new THREE.Matrix4().makeTranslation(X, 0, Z).multiply(new THREE.Matrix4().makeRotationY(yaw)); // (local +z toward the city)
    const W = (lx, lz) => V(lx, 0, lz).applyMatrix4(M);
    // the terrace: as high as the ground under it reaches, from 26 m behind the building's line to 46 m before it
    const T = { x0: -46, x1: 46, z0: -26, z1: 46 };
    let top = 0;
    for (let lx = T.x0; lx <= T.x1; lx += 4) for (let lz = T.z0; lz <= T.z1; lz += 4) { const p = W(lx, lz); top = Math.max(top, groundAt(p.x, p.z)); }
    top += 0.2;
    this.obsY = top;
    this.flood.value = top;
    const add = (key, geo, color = 0xffffff) => batch.add(key, geo, M, color);
    const solid = (x0, y0, z0, x1, y1, z1) => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), q: new THREE.Quaternion().setFromRotationMatrix(M) });
    // the terrace's top (pavers at the front and round the building, lawn before it) and its walls down to the ground
    add('pavers', box(T.x0, top - 0.6, T.z0, T.x1, top, T.z1), 0xf2ece0);
    ctx.pads.push({ c: V(0, top - 0.3, (T.z0 + T.z1) / 2).applyMatrix4(M), half: V((T.x1 - T.x0) / 2, 0.3, (T.z1 - T.z0) / 2), q: new THREE.Quaternion().setFromRotationMatrix(M) });
    const lawn = new THREE.PlaneGeometry(52, 22).rotateX(-Math.PI / 2).translate(0, top + 0.03, 27); metreUV(lawn); add('lawn', lawn);
    const edge = (x0, z0, x1, z1, rail) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 4));
      for (let k = 0; k < n; k++) {
        const a = k / n, b = (k + 1) / n, ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
        const g = Math.min(...[[ax, az], [bx, bz], [(ax + bx) / 2, (az + bz) / 2]].map(([u, v]) => { const p = W(u, v); return groundAt(p.x, p.z); })) - 0.5;
        const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), t = 0.5;
        const g0 = alongX ? box(Math.min(ax, bx), g - top, az - t, Math.max(ax, bx), 0, az + t) : box(ax - t, g - top, Math.min(az, bz), ax + t, 0, Math.max(az, bz));
        batch.add('obsWall', g0.translate(0, top, 0), M, 0xc9bfae);
        // a pilaster at each bay's end, the wall's cornice
        const px = ax, pz = az, pg = alongX ? box(px - 0.45, g - top, pz - 0.75, px + 0.45, -0.25, pz + 0.75) : box(px - 0.75, g - top, pz - 0.45, px + 0.75, -0.25, pz + 0.45);
        batch.add('obsWall', pg.translate(0, top, 0), M, 0xddd5c6);
        const cg = alongX ? box(Math.min(ax, bx), -0.35, az - 0.62, Math.max(ax, bx), -0.05, az + 0.62) : box(ax - 0.62, -0.35, Math.min(az, bz), ax + 0.62, -0.05, Math.max(az, bz));
        batch.add('obsWall', cg.translate(0, top, 0), M, 0xe4dccb);
        if (rail) {
          const r0 = alongX ? box(Math.min(ax, bx), top, az - 0.22, Math.max(ax, bx), top + 0.2, az + 0.22) : box(ax - 0.22, top, Math.min(az, bz), ax + 0.22, top + 0.2, Math.max(az, bz));
          const r1 = alongX ? box(Math.min(ax, bx), top + 0.9, az - 0.25, Math.max(ax, bx), top + 1.05, az + 0.25) : box(ax - 0.25, top + 0.9, Math.min(az, bz), ax + 0.25, top + 1.05, Math.max(az, bz));
          batch.add('obsWall', r0, M, 0xf2ede2); batch.add('obsWall', r1, M, 0xf2ede2);
          for (let q = 0.25; q < 1; q += 0.125) { const ux = ax + (bx - ax) * q, uz = az + (bz - az) * q; batch.add('obsWall', lathe([[0.01, 0], [0.11, 0], [0.13, 0.12], [0.07, 0.3], [0.12, 0.55], [0.06, 0.66], [0.1, 0.7], [0.01, 0.7]], ux, top + 0.2, uz, 8), M, 0xf2ede2); }
          if (alongX) solid(Math.min(ax, bx), top, az - 0.25, Math.max(ax, bx), top + 1.05, az + 0.25); else solid(ax - 0.25, top, Math.min(az, bz), ax + 0.25, top + 1.05, Math.max(az, bz));
        }
      }
    };
    edge(T.x0, T.z1, T.x1, T.z1, true); edge(T.x0, T.z0 + 22, T.x0, T.z1, true); edge(T.x1, T.z0 + 22, T.x1, T.z1, true);
    edge(T.x0, T.z0, T.x0, T.z0 + 22, false); edge(T.x1, T.z0, T.x1, T.z0 + 22, false); edge(T.x0, T.z0, -14, T.z0, false); edge(14, T.z0, T.x1, T.z0, false);
    // coin binoculars along the front balustrade
    for (const lx of [-30, -12, 12, 30]) { add('metal', cyl(0.06, 0.08, 1.0, lx, top, T.z1 - 1.0, 8), 0x3a4a3a); add('metal', box(lx - 0.22, top + 1.0, T.z1 - 1.18, lx + 0.22, top + 1.25, T.z1 - 0.82), 0x3a4a3a); solid(lx - 0.15, top, T.z1 - 1.15, lx + 0.15, top + 1.25, T.z1 - 0.85); }
    // the building: the rotunda and its dome, the wings, the end towers and their domes, the portico
    const y = top, wall = 0xf2ede2, trim = 0xe2dccd;
    add('obsWall', cyl(10.5, 10.5, 1.0, 0, y, 0, 48), trim); // (its base course)
    add('obsWall', cyl(9.8, 9.8, 11.5, 0, y + 1.0, 0, 48), wall);
    add('obsWall', cyl(10.4, 10.4, 0.6, 0, y + 12.5, 0, 48), trim); // the cornice
    add('obsWall', cyl(9.6, 9.6, 2.2, 0, y + 13.1, 0, 48), wall); // the drum
    add('copper', new THREE.SphereGeometry(9.7, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y + 15.3, 0));
    add('copper', cyl(0.6, 0.9, 1.2, 0, y + 15.3 + 9.6, 0, 16)); add('copper', new THREE.SphereGeometry(0.55, 12, 8).translate(0, y + 15.3 + 11, 0));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add('obsWall', box(-0.35, y + 1, -0.25, 0.35, y + 12.5, 0.25).rotateY(Math.PI / 2 - a).translate(Math.cos(a) * 9.85, 0, Math.sin(a) * 9.85), wall); } // pilasters round the rotunda
    for (const sd of [-1, 1]) {
      // the wing from the rotunda to the tower: a long block with tall windows between pilasters
      const x0 = sd > 0 ? 8 : -26, x1 = sd > 0 ? 26 : -8;
      add('obsWall', box(x0, y, -6.5, x1, y + 9, 6.5), wall);
      add('obsWall', box(x0 - 0.2, y + 9, -6.8, x1 + 0.2, y + 9.6, 6.8), trim);
      add('obsWall', box(x0, y, -6.7, x1, y + 1.0, 6.7), trim);
      for (let k = 0; k < 6; k++) {
        const ux = x0 + 1.5 + k * ((x1 - x0 - 3) / 5);
        add('obsWall', box(ux - 0.45, y + 1, 6.5, ux + 0.45, y + 9, 6.85), wall);
        if (k < 5) { const wx = ux + (x1 - x0 - 3) / 10; add('dark', box(wx - 0.9, y + 2.2, 6.48, wx + 0.9, y + 7.6, 6.52), 0x2a3440); add('obsWall', box(wx - 1.05, y + 7.6, 6.48, wx + 1.05, y + 8.0, 6.62), trim); }
      }
      // the end tower and its dome (the telescopes')
      const tx = sd * 31;
      add('obsWall', cyl(5.2, 5.2, 1.0, tx, y, 0, 32), trim);
      add('obsWall', cyl(4.8, 4.8, 11, tx, y + 1, 0, 32), wall);
      add('obsWall', cyl(5.2, 5.2, 0.5, tx, y + 12, 0, 32), trim);
      add('copper', new THREE.SphereGeometry(4.75, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).translate(tx, y + 12.5, 0));
      add('dark', new THREE.SphereGeometry(4.8, 3, 12, Math.PI / 2 - 0.11, 0.22, 0, Math.PI / 2).translate(tx, y + 12.5, 0), 0x1c2224); // (the slit in the dome)
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add('obsWall', box(-0.28, y + 1, -0.2, 0.28, y + 12, 0.2).rotateY(Math.PI / 2 - a).translate(tx + Math.cos(a) * 4.85, 0, Math.sin(a) * 4.85), wall); }
      ctx.hulls.push({ pts: Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [V(tx + Math.cos(a) * 5.2, y, Math.sin(a) * 5.2), V(tx + Math.cos(a) * 4.8, y + 12.5, Math.sin(a) * 4.8)]; }).flat().concat([V(tx, y + 17.3, 0)]).map((v) => v.applyMatrix4(M)) });
      solid(x0, y, -6.8, x1, y + 9.6, 6.8);
    }
    ctx.hulls.push({ pts: Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [V(Math.cos(a) * 10.5, y, Math.sin(a) * 10.5), V(Math.cos(a) * 9.7, y + 15.3, Math.sin(a) * 9.7), V(Math.cos(a) * 6.5, y + 22.5, Math.sin(a) * 6.5)]; }).flat().concat([V(0, y + 25.2, 0)]).map((v) => v.applyMatrix4(M)) });
    // the portico before the rotunda: a stepped base, square columns, the entablature with the name over the doors
    add('obsWall', box(-7.5, y, 8.5, 7.5, y + 0.6, 14.5), trim);
    for (let k = 0; k < 3; k++) add('obsWall', box(-7.5 - k * 0.5, y - 0.6 + k * 0.2, 14.5 + k * 0.45, 7.5 + k * 0.5, y + 0.6 - (k + 1) * 0.2 + 0.2, 14.95 + k * 0.45), trim);
    for (const lx of [-6, -2, 2, 6]) { add('obsWall', box(lx - 0.55, y + 0.6, 13, lx + 0.55, y + 9.2, 14.1), wall); solid(lx - 0.55, y + 0.6, 13, lx + 0.55, y + 9.2, 14.1); }
    add('obsWall', box(-7.6, y + 9.2, 8.5, 7.6, y + 11.2, 14.4), trim);
    add('obsWall', box(-7.0, y + 0.6, 8.5, 7.0, y + 9.2, 9.8), wall);
    add('dark', box(-1.6, y + 0.6, 9.78, 1.6, y + 4.6, 9.84), 0x3a2a1c);
    add('bronze', box(-1.75, y + 4.6, 9.78, 1.75, y + 4.8, 9.86), 0xffffff);
    for (const lx of [-4.3, 4.3]) add('dark', box(lx - 0.8, y + 2.2, 9.78, lx + 0.8, y + 7.4, 9.84), 0x2a3440);
    solid(-7.6, y + 9.2, 8.5, 7.6, y + 11.2, 14.4); solid(-7.0, y, 8.5, 7.0, y + 9.2, 9.8);
    // the monument on the lawn's axis: a stepped base and an obelisk
    for (let k = 0; k < 3; k++) add('obsWall', box(-3 + k * 0.7, y + k * 0.4, 30 - 3 + k * 0.7, 3 - k * 0.7, y + (k + 1) * 0.4, 30 + 3 - k * 0.7), trim);
    add('obsWall', new THREE.CylinderGeometry(0.55, 0.95, 11, 4).rotateY(Math.PI / 4).translate(0, y + 1.2 + 5.5, 30), wall);
    add('copper', new THREE.ConeGeometry(0.75, 1.1, 4).rotateY(Math.PI / 4).translate(0, y + 1.2 + 11.55, 30));
    solid(-3, y, 27, 3, y + 1.2, 33); solid(-0.8, y + 1.2, 29.2, 0.8, y + 12, 30.8);
    // the car park behind, out to the road's end: asphalt on the ground, its bays' lines
    const back = [];
    for (let lz = T.z0 - 2; lz > T.z0 - 34; lz -= 4) back.push(W(0, lz));
    batch.add('asphalt', ribbon(back.map((p) => ({ x: p.x, z: p.z })), 24, 0.05, groundAt, 6), I, 0xffffff);
    for (let k = -5; k <= 5; k++) { const a = W(k * 2.6, T.z0 - 6), b = W(k * 2.6, T.z0 - 11); const g = ribbon([{ x: a.x, z: a.z }, { x: b.x, z: b.z }], 0.06, 0.07, groundAt, 1); batch.add('roadpaint', g, I, 0xe8e6e0); }
    // benches and lamps on the terrace
    const places = [];
    const put = (k, lx, lz, ry2, sc) => { const p = W(lx, lz); places.push({ k, M: new THREE.Matrix4().compose(V(p.x, top, p.z), _q.setFromAxisAngle(_Y, yaw + ry2), _s.setScalar(sc ?? (k === 'lamp' ? 1.8 : 1))), s: sc ?? (k === 'lamp' ? 1.8 : 1) }); };
    for (const lx of [-38, -22, 22, 38]) put('bench', lx, T.z1 - 2.2, Math.PI);
    for (const lx of [-40, -20, 20, 40]) { put('lamp', lx, T.z1 - 1.2, Math.PI); ctx.lamps.push({ at: W(lx, T.z1 - 2.9).setY(top), y: top + 0.02 }); }
    for (const lx of [-16, 16]) for (const lz of [18, 38]) { put('lamp', lx, lz, lx > 0 ? -Math.PI / 2 : Math.PI / 2); ctx.lamps.push({ at: W(lx, lz).setY(top), y: top + 0.02 }); }
    this.obs = this.finish(ctx, places, { always: true });
    this.obsBox = { M, inv: M.clone().invert(), top, T };
  }

  // a build context (as Stream.buildCell's: what the kit fills in)
  ctxFor(rnd) {
    return { batch: new Batch(), mats: this.s.mats, signs: this.s.signs, signUses: [], rnd, props: false, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [],
      decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [], beacons: [], trees: [] };
  }

  // A context's pieces into the city's batches (all of them: the hills are seen from across the city), its kit
  // instanced, its colliders made, its lamps' pools for the night
  finish(ctx, places, { always = false } = {}) {
    const s = this.s, f = this.f, P = f.physics, out = { far: [], near: null, night: [], bodies: [], items: [], palms: [], group: new THREE.Group(), casters: [] };
    const merged = ctx.batch.build(s.mats, { cell: 4000, chunk: 350 });
    for (const m of [...merged.children]) {
      const key = m.name.replace('city_', '');
      const cast = m.castShadow && key !== 'pavers' && key !== 'lawn' && key !== 'asphalt';
      out.far.push(s.batches.add(key, m.material, m.geometry, cast));
      m.geometry.dispose();
    }
    for (const h of out.far) s.batches.show(h, true);
    out.group.position.copy(ORIGIN);
    this.root.add(out.group);
    s.placeKit(places, out.group, out.items, out.casters, out.palms);
    out.group.updateMatrixWorld(true);
    out.group.traverse((o) => { o.matrixAutoUpdate = false; });
    out.bodies.push(fixedCompound(P, ctx)); // (one fixed body, every box and hull a collider on it: Stream.js)
    for (const t of ctx.trees) out.trees = [...(out.trees ?? []), s.trees.add(t.kind, t.x, t.y, t.z + LOT_Z, t.h, t.w)];
    const pools = ctx.lamps.filter((l) => l.y != null).map((l) => new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2).translate(l.at.x, l.y + 0.03, l.at.z));
    if (pools.length) { const g = mergeGeometries(pools, false); out.night.push(s.batches.add(`night|${s.pool.uuid}`, s.pool, g, false)); g.dispose(); }
    for (const h of out.night) s.batches.show(h, this.night > 0.01);
    out.always = always;
    return out;
  }
  disposeBuilt(b) {
    const s = this.s, W = this.f.physics.world;
    for (const h of [...b.far, ...b.night]) s.batches.remove(h);
    b.group.removeFromParent();
    b.group.traverse((m) => { if (m.isInstancedMesh) m.dispose(); });
    for (const body of b.bodies) if (W.bodies.contains(body.handle)) W.removeRigidBody(body);
    for (const it of b.items) this.f.smash.remove(it);
    for (const id of b.palms) this.f.palms.remove(id);
    for (const id of b.trees ?? []) s.trees.remove(id);
  }

  // ---------------------------------------------------------------------------- the slopes' trees
  // Oaks in loose clumps and the chaparral's scrub between, over the hills where nothing's built: clear of the
  // roads, the terraces, the observatory, the park (its own) and the city's blocks; the oaks' trunks solid with
  // the square they're in
  buildTrees() {
    const s = this.s, rnd = seeded(0x41115), st = 17;
    const near = (x, z) => this.houses.some((h) => Math.hypot(h.p.x - x, h.p.z - z) < Math.max(h.p.w, h.p.d) / 2 + 8);
    const noise = (x, z) => (Math.sin(x * 0.011 + 1.3) * Math.sin(z * 0.013 + 0.4) + Math.sin(x * 0.031 + z * 0.023) * 0.5 + Math.sin(z * 0.047 - x * 0.019) * 0.3) * 0.5 + 0.5;
    let n = 0;
    for (let x = HILLS.x0 - 100; x < HILLS.x1 + 40; x += st) for (let z = HILLS.z0 - 40; z < HILLS.z1 + 40; z += st) {
      const px = x + (rnd() - 0.5) * st * 0.9, pz = z + (rnd() - 0.5) * st * 0.9, h0 = heightAt(px, pz);
      if (h0 < 2.5 || waterAt(px, pz)) continue;
      if (districtAt(px, pz)?.id !== 'hills') continue;
      if (this.roads.some((r) => nearest(r, px, pz).d < ROAD_HALF + 6)) continue;
      if (Math.hypot(px - OBSERVATORY.x, pz - OBSERVATORY.z) < 85 || highwayDistance(px, pz) < 16 || near(px, pz)) continue;
      const k = noise(px, pz), y = groundAt(px, pz) - 0.1;
      if (k > 0.5 && rnd() < 0.9) {
        const h = 7 + rnd() * 7, kind = rnd() < 0.07 ? 'cypress' : 'oak';
        s.trees.add(kind, px, y, pz + LOT_Z, kind === 'cypress' ? h + 2 : h, kind === 'cypress' ? 6 : h * (0.8 + rnd() * 0.4));
        this.chunkAt(px, pz).trunks.push({ x: px, y, z: pz, r: 0.035 * h * 0.85 });
        n++;
        // and a bush or two at its foot
        if (rnd() < 0.6) { const a = rnd() * 6.28, d = 3 + rnd() * 3; s.trees.add('scrub', px + Math.cos(a) * d, groundAt(px + Math.cos(a) * d, pz + Math.sin(a) * d) - 0.1, pz + Math.sin(a) * d + LOT_Z, 1.2 + rnd(), 2.5 + rnd() * 1.5); }
      } else if (k > 0.18 && rnd() < 0.85) {
        for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) { const qx = px + (rnd() - 0.5) * 8, qz = pz + (rnd() - 0.5) * 8; s.trees.add('scrub', qx, groundAt(qx, qz) - 0.1, qz + LOT_Z, 1.0 + rnd() * 1.2, 2.2 + rnd() * 2.2); }
      }
    }
    this.treeCount = n;
  }

  // ---------------------------------------------------------------------------- far off
  // Each house a box and (most) a roof, in the city's far materials (Stream.js buildFar), hidden while its square's built
  buildFar() {
    const s = this.s, list = this.houses, n = list.length;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), info = new Float32Array(n * 4);
    this.show = new Float32Array(n).fill(1);
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
    geo.setAttribute('aShow', new THREE.InstancedBufferAttribute(this.show, 1));
    const far = (this.far = new THREE.InstancedMesh(geo, s.far.material, n));
    const hipGeo = new THREE.BufferGeometry();
    hipGeo.setAttribute('position', s.hips.geometry.attributes.position);
    hipGeo.setAttribute('normal', s.hips.geometry.attributes.normal);
    this.hipShow = new Float32Array(n).fill(1);
    hipGeo.setAttribute('aShow', new THREE.InstancedBufferAttribute(this.hipShow, 1));
    const hips = (this.hips = new THREE.InstancedMesh(hipGeo, s.hips.material, n));
    const c = new THREE.Color();
    let nh = 0;
    list.forEach((h, i) => {
      const p = h.p, H = h.H;
      _q.setFromAxisAngle(_Y, p.yaw);
      _m.compose(_p.set(p.x, p.y - 0.6, p.z), _q, _s.set(p.w, H + (h.modern ? 0.9 : 0) + 0.6, p.d));
      far.setMatrixAt(i, _m);
      far.setColorAt(i, c.setHex(h.spec.color));
      info.set([3.8, 3.0, 4 + 10 * Math.round(p.y - 0.6), (i * 7.31) % 977], i * 4);
      h.fi = i;
      if (!h.modern) {
        const w = p.w + 0.9, d = p.d + 0.9;
        _m.compose(_p.set(p.x, p.y + H + 0.05, p.z), _q, _s.set(w, (d / 2) * h.spec.pitch, d));
        hips.setMatrixAt(nh, _m); hips.setColorAt(nh, c.setHex(0xa8543a).multiplyScalar(0.85 + 0.3 * ((i * 0.618) % 1)));
        h.hi = nh++;
      }
    });
    hips.count = nh;
    for (const m of [far, hips]) { m.position.copy(ORIGIN); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; this.root.add(m); }
    far.name = 'hillsFar'; hips.name = 'hillsHips';
  }
  farShow(ch, on) {
    for (const h of ch.houses) { this.show[h.fi] = on ? 1 : 0; if (h.hi != null) this.hipShow[h.hi] = on ? 1 : 0; }
    this.far.geometry.attributes.aShow.needsUpdate = true;
    this.hips.geometry.attributes.aShow.needsUpdate = true;
  }
  farCast(on) {
    for (const m of [this.far, this.hips]) if (m) { m.customDepthMaterial = this.s.far.customDepthMaterial; m.castShadow = on && !!m.customDepthMaterial; }
  }

  // ---------------------------------------------------------------------------- streaming
  update(dt, camera, busy) {
    this.t += dt;
    const x = camera.position.x - ORIGIN.x, z = camera.position.z - ORIGIN.z;
    if (this.t > 0.3) { this.t = 0; this.plan2(x, z); }
    const t0 = performance.now();
    while (!busy && (this.job || this.queue.length)) {
      if (!this.job) { const c = this.queue.shift(); if (c.state !== 'queued') continue; c.state = 'building'; this.job = { c, it: this.buildChunk(c) }; }
      if (this.job.it.next().done) { this.job.c.state = 'built'; this.job = null; }
      if (performance.now() - t0 > 3) break;
    }
    const gone = this.leaving?.shift();
    if (gone && gone.state === 'built' && gone.d > REACH * 1.25 + 40) this.disposeChunk(gone);
  }
  plan2(x, z) {
    for (const c of this.chunks.values()) {
      const d = (c.d = Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1)));
      if (!c.state && d < REACH) { c.state = 'queued'; this.queue.push(c); }
      else if (c.state === 'queued' && d > REACH * 1.2 + 30) c.state = null;
      else if (c.state === 'built' && d > REACH * 1.25 + 40 && !(this.leaving ??= []).includes(c)) this.leaving.push(c);
    }
    this.queue = this.queue.filter((c) => c.state === 'queued').sort((a, b) => a.d - b.d);
  }
  *fill(x, z, r = 200) {
    this.plan2(x, z);
    for (const c of [...this.queue]) { if (c.d > r || c.state !== 'queued') continue; c.state = 'building'; yield* this.buildChunk(c); c.state = 'built'; }
    this.queue = this.queue.filter((c) => c.state === 'queued');
  }
  disposeChunk(c) { if (!c.built) return; this.disposeBuilt(c.built); this.farShow(c, true); c.built = null; c.state = null; }

  // One square: its houses and their terraces, its roads' kerbs, rails and lamps, its trees' trunks
  *buildChunk(c) {
    const ctx = this.ctxFor(seeded(c.x0 * 31 + c.z0 * 17 + 5)), places = [];
    for (const h of c.houses) {
      building(ctx, { ...h.spec, at: V(h.spec.at.x, h.spec.at.y, h.spec.at.z), sides: { ...h.spec.sides } });
      if (h.gspec) this.s.garage(ctx, { ...h.gspec, at: V(h.gspec.at.x, h.gspec.at.y, h.gspec.at.z) });
      this.terrace(ctx, h, places);
      yield;
    }
    for (const r of c.roads) this.roadside(ctx, r, places);
    for (const t of c.trunks) ctx.pads.push({ c: V(t.x, t.y + 1.8, t.z), half: V(t.r, 1.8, t.r) });
    yield;
    c.built = this.finish(ctx, places);
    this.farShow(c, false);
    yield;
  }

  // A house's terrace: the lawn on it, the garage's drive or the parking bay and the steps to the road, a front
  // patio over the slope, the retaining walls where it's cut in, a deck out where it falls away, a pool, bushes
  terrace(ctx, h, places) {
    const { batch } = ctx, p = h.p, rnd = seeded(h.seed ^ 0x77), y = p.y;
    const M = new THREE.Matrix4().makeTranslation(p.x, y, p.z).multiply(new THREE.Matrix4().makeRotationY(p.yaw));
    const q = new THREE.Quaternion().setFromAxisAngle(_Y, p.yaw);
    const add = (key, geo, color = 0xffffff) => batch.add(key, geo, M, color);
    const solid = (x0, y0, z0, x1, y1, z1) => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), q });
    const W = (lx, lz) => V(lx, 0, lz).applyMatrix4(M); // (y is the terrace's: callers want x, z)
    const g = (lx, lz) => { const w = W(lx, lz); return groundAt(w.x, w.z) - y; }; // the ground relative to the terrace
    const tw = h.tw, td = h.td, hd = p.d / 2;
    // the lawn on the terrace behind and beside the house
    const lawn = new THREE.PlaneGeometry(tw * 2, td * 2 - 4).rotateX(-Math.PI / 2).translate(0, 0.05, -2); metreUV(lawn); add('lawn', lawn, 0xf4f4e8);
    ctx.pads.push({ c: V(0, -0.2, -2).applyMatrix4(M), half: V(tw, 0.25, td - 2), q });
    // the retaining walls where the slope rises beyond the terrace: stepped blocks 2 m deep, each as high as the
    // ground 2 m out (so the bank meets its top), on the back and the sides
    const cut = (ax, az, bx, bz, ox, oz) => { // (from a to b along the edge, `o` outward)
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3));
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, top = Math.max(g(mx + ox * 2, mz + oz * 2), g(x0 + ox * 2, z0 + oz * 2), g(x1 + ox * 2, z1 + oz * 2));
        if (top < 0.45) continue;
        const hgt = Math.min(top, 7) + 0.05, gx0 = Math.min(x0, x1, x0 + ox * 2), gx1 = Math.max(x0, x1, x1 + ox * 2), gz0 = Math.min(z0, z1, z0 + oz * 2), gz1 = Math.max(z0, z1, z1 + oz * 2);
        add('concrete', box(gx0, -0.3, gz0, gx1, hgt, gz1), k % 2 ? 0xcfc3ad : 0xc8bca6);
        add('concrete', box(gx0 - (ox ? 0 : 0.05), hgt, gz0 - (oz ? 0 : 0.05), gx1 + (ox ? 0 : 0.05), hgt + 0.08, gz1 + (oz ? 0 : 0.05)), 0xddd4c2); // its cap
        solid(gx0, -0.3, gz0, gx1, hgt + 0.08, gz1);
      }
    };
    const fallsAway = (side) => h.sides[side] < -1.2;
    if (!fallsAway('back')) cut(-tw, -td, tw, -td, 0, -1);
    if (!fallsAway('left')) cut(-tw, -td, -tw, hd + 1.5, -1, 0);
    if (!fallsAway('right')) cut(tw, -td, tw, hd + 1.5, 1, 0);
    // a low wall or a railing along the edges that fall away
    const rail = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const r = box(-L / 2, 0.05, -0.12, L / 2, 0.5, 0.12).rotateY(yaw).translate(mx, 0, mz);
      add('stucco', r, h.spec.color);
      add('concrete', box(-L / 2 - 0.02, 0.5, -0.16, L / 2 + 0.02, 0.58, 0.16).rotateY(yaw).translate(mx, 0, mz), 0xe8e2d6);
      for (let k = 0; k <= L / 0.15; k++) { const t = k / Math.max(1, Math.floor(L / 0.15)); add('iron', box(-0.012, 0.58, -0.012, 0.012, 1.05, 0.012).translate(ax + (bx - ax) * t, 0, az + (bz - az) * t), 0x1d1c1b); }
      add('iron', box(-L / 2, 1.02, -0.025, L / 2, 1.06, 0.025).rotateY(yaw).translate(mx, 0, mz), 0x1d1c1b);
      ctx.solids.push({ c: V(mx, 0.55, mz).applyMatrix4(M), half: V(L / 2, 0.55, 0.15), q: new THREE.Quaternion().setFromAxisAngle(_Y, p.yaw + yaw) });
    };
    // the deck out over the slope on the side that falls away most: timber on posts down to the ground
    const deck = h.deck;
    if (deck) {
      const dd = 4.2, span = deck === 'back' ? [-tw + 1, Math.min(tw - 1, -tw + 1 + 12)] : [-td + 1, Math.min(hd, -td + 1 + 10)];
      const rect = deck === 'back' ? [span[0], -td - dd, span[1], -td] : deck === 'left' ? [-tw - dd, span[0], -tw, span[1]] : [tw, span[0], tw + dd, span[1]];
      const [x0, z0, x1, z1] = rect;
      add('paint', box(x0, -0.05, z0, x1, 0.08, z1), 0x8a6a4a);
      for (let lx = x0 + 0.15; lx < x1; lx += Math.max(0.6, (x1 - x0) / 8)) for (let lz = z0 + 0.15; lz < z1; lz += Math.max(0.6, (z1 - z0) / 4)) {
        if (lx > x0 + 0.5 && lx < x1 - 0.5 && lz > z0 + 0.5 && lz < z1 - 0.5) continue;
        const gy = g(lx, lz);
        if (gy < -0.2) add('paint', box(lx - 0.1, gy - 0.3, lz - 0.1, lx + 0.1, -0.05, lz + 0.1), 0x6a5040);
      }
      ctx.pads.push({ c: V((x0 + x1) / 2, 0.0, (z0 + z1) / 2).applyMatrix4(M), half: V((x1 - x0) / 2, 0.08, (z1 - z0) / 2), q });
      // its railing on the open sides
      const dark = 0x5a4030;
      const posts = (ax, az, bx, bz) => {
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.4)), yaw = Math.atan2(-(bz - az), bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
        for (let k = 0; k <= n; k++) { const t = k / n; add('paint', box(-0.05, 0.08, -0.05, 0.05, 1.05, 0.05).translate(ax + (bx - ax) * t, 0, az + (bz - az) * t), dark); }
        add('paint', box(-L / 2, 0.98, -0.06, L / 2, 1.08, 0.06).rotateY(yaw).translate(mx, 0, mz), dark);
        for (const hh of [0.4, 0.7]) add('metal', box(-L / 2, hh, -0.008, L / 2, hh + 0.012, 0.008).rotateY(yaw).translate(mx, 0, mz), 0xb0b4b8); // (cable rails)
        ctx.solids.push({ c: V(mx, 0.6, mz).applyMatrix4(M), half: V(L / 2, 0.5, 0.06), q: new THREE.Quaternion().setFromAxisAngle(_Y, p.yaw + yaw) });
      };
      if (deck === 'back') { posts(x0, z0, x1, z0); posts(x0, z0, x0, z1); posts(x1, z0, x1, z1); }
      else if (deck === 'left') { posts(x0, z0, x0, z1); posts(x0, z0, x1, z0); posts(x0, z1, x1, z1); }
      else { posts(x1, z0, x1, z1); posts(x0, z0, x1, z0); posts(x0, z1, x1, z1); }
    }
    // the edges that fall away (and have no deck) get the low wall and railing
    if (fallsAway('back') && deck !== 'back') rail(-tw, -td, tw, -td);
    if (fallsAway('left') && deck !== 'left') rail(-tw, -td, -tw, hd);
    if (fallsAway('right') && deck !== 'right') rail(tw, -td, tw, hd);
    // a pool on the terrace behind the house, its coping, a pair of loungers' slabs
    if (h.pool) {
      const x0 = -tw + 1.2, x1 = Math.min(tw - 1.2, x0 + 8.5), z0 = -td + 0.6, z1 = Math.min(-hd - 0.8, z0 + 3.4);
      if (z1 - z0 > 2.4) {
        add('pool', box(x0, 0.0, z0, x1, 0.02, z1));
        add('concrete', box(x0, -0.3, z0, x1, -0.1, z1), 0x6ab0c8);
        for (const [a0, b0, a1, b1] of [[x0 - 0.4, z0 - 0.4, x1 + 0.4, z0], [x0 - 0.4, z1, x1 + 0.4, z1 + 0.4], [x0 - 0.4, z0, x0, z1], [x1, z0, x1 + 0.4, z1]]) { add('concrete', box(a0, -0.1, b0, a1, 0.12, b1), 0xf0ece2); solid(a0, -0.1, b0, a1, 0.12, b1); }
      }
    }
    // the front: the garage's drive down or up to the road, or a bay by the road and the steps to the door
    const toRoad = (lx) => { // points from the house's front out to the road's edge, along local +z
      const pts = []; for (let lz = hd + 0.2; lz < hd + 22; lz += 1) { const w = W(lx, lz); pts.push({ x: w.x, z: w.z }); if (nearest(h.road.line, w.x, w.z).d < ROAD_HALF + 0.3) break; }
      return pts;
    };
    if (h.gspec) {
      const lx = p.w / 2 - h.garage.w / 2, pts = toRoad(lx);
      if (pts.length > 1) batch.add('pavement', ribbon(pts, h.garage.w / 2 - 0.35, 0.07, groundAt, 2), I, 0xe0dace);
    } else {
      // the parking bay beside the road
      const r = h.road, n = r.n, a = r.line[n.i], b = r.line[n.i + 1] ?? a, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      const side = Math.sign((p.x - a.x) * -dz + (p.z - a.z) * dx) || 1;
      const bay = []; for (let t = -4; t <= 4; t += 2) { const cx = a.x + (dx / L) * t - (dz / L) * side * (ROAD_HALF + 1.6), cz = a.z + (dz / L) * t + (dx / L) * side * (ROAD_HALF + 1.6); bay.push({ x: cx, z: cz, y: h.ry }); }
      batch.add('asphalt', ribbon(bay, 1.4, 0.075, groundAt, 1), I, 0xd8d6d2);
    }
    // the steps from the road to the front door, following the slope, a handrail up one side
    const dl = h.doorX, path = toRoad(dl);
    if (path.length > 1) {
      const first = path[0], last = path.at(-1), rise = groundAt(last.x, last.z) - y, run = Math.hypot(last.x - first.x, last.z - first.z);
      if (Math.abs(rise) < run * 0.12) batch.add('pavers', ribbon(path, 0.7, 0.08, groundAt, 1), I, 0xe0d6c6);
      else {
        const n = Math.max(2, Math.round(Math.abs(rise) / 0.18)), yaw = p.yaw;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, sx = first.x + (last.x - first.x) * t, sz = first.z + (last.z - first.z) * t, ty = y + rise * (k + 1) / n, by = Math.min(groundAt(sx, sz), ty) - 0.35;
          const tread = run / n + 0.04;
          batch.add('concrete', box(-0.65, by, -tread / 2, 0.65, ty, tread / 2).rotateY(yaw).translate(sx, 0, sz), I, k % 2 ? 0xd6cebe : 0xd0c8b8);
        }
        // the handrail along the nosings
        const rl = []; for (let k = 0; k <= n; k++) { const t = k / n; rl.push({ x: first.x + (last.x - first.x) * t + Math.cos(yaw) * 0.6, z: first.z + (last.z - first.z) * t - Math.sin(yaw) * 0.6, y: y + rise * t + 0.95 }); }
        batch.add('iron', ribbon(rl, 0.03, 0, null, 1), I, 0x1d1c1b);
        for (let k = 0; k <= n; k += Math.max(1, Math.round(n / 4))) { const t = k / n; const x = first.x + (last.x - first.x) * t + Math.cos(yaw) * 0.6, z = first.z + (last.z - first.z) * t - Math.sin(yaw) * 0.6, ty = y + rise * t; batch.add('iron', box(x - 0.02, ty, z - 0.02, x + 0.02, ty + 0.95, z + 0.02), I, 0x1d1c1b); }
      }
    }
    // the patio before the door (where the front's at the terrace's level), its low wall on the slope's side
    if (Math.abs(g(0, hd + 2.5)) < 0.6) add('pavers', box(-p.w / 2, -0.2, hd, p.w / 2 - (h.garage ? h.garage.w : 0), 0.08, hd + 2.6), 0xe8e0d2);
    // bushes along the house's front, a tree or two on the terrace
    const tree = (kind, lx, lz, hh, ww) => { const w = W(lx, lz); ctx.trees.push({ kind, x: w.x, y: y + 0.05, z: w.z, h: hh, w: ww }); };
    for (let k = 0; k < 4; k++) { const lx = -p.w / 2 + 0.8 + (h.hw - 1.6) * (k + 0.5) / 4; if (Math.abs(lx - dl) < 1.3) continue; tree('shrub', lx, hd + 0.9, 0.9 + rnd() * 0.5, 1.2 + rnd() * 0.6); }
    if (rnd() < 0.55) tree(rnd() < 0.3 ? 'cypress' : 'oak', (rnd() < 0.5 ? -1 : 1) * (tw - 1.6), -td + 1.8, 5 + rnd() * 3, 4.5 + rnd() * 2);
    if (rnd() < 0.4) { const lx = (rnd() < 0.5 ? -1 : 1) * (tw - 1.2), w = W(lx, hd + 1.5), s = 0.55 + rnd() * 0.1; places.push({ k: rnd() < 0.5 ? 'palm0' : 'palm1', M: new THREE.Matrix4().compose(V(w.x, groundAt(w.x, w.z), w.z), _q.setFromAxisAngle(_Y, rnd() * 6), _s.setScalar(s)), s }); }
  }

  // A stretch of road's kerbs, its guard rail where the slope falls away beside it, a lamp on it
  roadside(ctx, r, places) {
    const { batch } = ctx, seg = r.seg, line = this.roads[r.ri];
    const lift = 0.06 + r.ri * 0.004;
    // (where it meets the city's streets, at its ends on the flat, no kerbs across the junction)
    const atEnd = (i) => i < 2 || i > line.length - 3;
    for (const sd of [-1, 1]) {
      // how far the ground falls beside it, 10 m out (the rail's side)
      const drop = (q, a) => { const b = seg[Math.min(seg.length - 1, a + 1)], c = seg[Math.max(0, a - 1)], dx = b.x - c.x, dz = b.z - c.z, L = Math.hypot(dx, dz) || 1; const x = q.x - (dz / L) * sd * 10, z = q.z + (dx / L) * sd * 10; return q.y - heightAt(x, z); };
      const steep = seg.map((q, a) => drop(q, a) > 1.6);
      const o = sd * (ROAD_HALF + 0.12);
      // the kerb: its face and its top
      const runs = []; let cur = [];
      seg.forEach((q, a) => { if (atEnd(r.i + a)) { if (cur.length > 1) runs.push(cur); cur = []; return; } cur.push(q); });
      if (cur.length > 1) runs.push(cur);
      for (const run of runs) {
        const face = sweep(run, sd * ROAD_HALF, lift - 0.04, sd * ROAD_HALF, lift + 0.14), topS = sweep(run, sd * ROAD_HALF, lift + 0.14, sd * (ROAD_HALF + 0.22), lift + 0.14);
        for (const gg of [...both(face), ...both(topS)]) batch.add('concrete', gg, I, 0xcfc8bb);
      }
      void o;
      // the guard rail: posts every 2 m and the beam, where it's steep
      const rails = []; cur = [];
      seg.forEach((q, a) => { if (steep[a] && !atEnd(r.i + a)) cur.push(q); else { if (cur.length > 1) rails.push(cur); cur = []; } });
      if (cur.length > 1) rails.push(cur);
      // (cut where a house's steps or drive come out on the road, the run resampled every 2 m to cut it cleanly)
      const gates = this.houses.filter((h) => Math.hypot(h.p.x - seg[0].x, h.p.z - seg[0].z) < 90).flatMap((h) => h.gates);
      const cutRuns = [];
      for (const run of rails) {
        let cur2 = [];
        for (let k = 0; k + 1 < run.length; k++) {
          const a = run[k], b = run[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 2));
          for (let j = 0; j < n; j++) {
            const t = j / n, q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t };
            const dx = b.x - a.x, dz = b.z - a.z, ox = q.x - (dz / L) * sd * (ROAD_HALF + 1.2), oz = q.z + (dx / L) * sd * (ROAD_HALF + 1.2);
            if (gates.some((g) => Math.hypot(g.x - ox, g.z - oz) < 2.4)) { if (cur2.length > 1) cutRuns.push(cur2); cur2 = []; } else cur2.push(q);
          }
        }
        cur2.push(run.at(-1));
        if (cur2.length > 1) cutRuns.push(cur2);
      }
      for (const run of cutRuns) {
        const off = offset(run, sd * (ROAD_HALF + 1.2));
        for (const gg of [...both(sweep(run, sd * (ROAD_HALF + 1.15), lift + 0.48, sd * (ROAD_HALF + 1.15), lift + 0.82))]) batch.add('metal', gg, I, 0xb4b8b8);
        for (const gg of both(sweep(run, sd * (ROAD_HALF + 1.15), lift + 0.82, sd * (ROAD_HALF + 1.25), lift + 0.82))) batch.add('metal', gg, I, 0x9aa0a0);
        let next = 0;
        for (let k = 0; k + 1 < off.length; k++) {
          const a = off[k], b = off[k + 1], L = Math.hypot(b.x - a.x, b.z - a.z) || 1e-3;
          let t = next;
          for (; t < L; t += 2) { const x = a.x + (b.x - a.x) * (t / L), z = a.z + (b.z - a.z) * (t / L), yy = a.y + (b.y - a.y) * (t / L) + lift; batch.add('metal', box(x - 0.06, yy - 0.6, z - 0.06, x + 0.06, yy + 0.78, z + 0.06), I, 0x8a8e8e); }
          next = t - L;
          const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
          ctx.solids.push({ c: V((a.x + b.x) / 2, (a.y + b.y) / 2 + lift + 0.4, (a.z + b.z) / 2), half: V(L / 2, 0.45, 0.12), q: new THREE.Quaternion().setFromAxisAngle(_Y, yaw) });
        }
      }
    }
    // a lamp on the uphill side, one a stretch (every 40 m or so), its pool on the road at night
    const mid = seg[Math.floor(seg.length / 2)], nx = seg[Math.min(seg.length - 1, Math.floor(seg.length / 2) + 1)], dx = nx.x - mid.x, dz = nx.z - mid.z, L = Math.hypot(dx, dz) || 1;
    if (!atEnd(r.i + Math.floor(seg.length / 2)) && ((r.i / 4) % 1 === 0)) {
      const sd = heightAt(mid.x - (dz / L) * 10, mid.z + (dx / L) * 10) > heightAt(mid.x + (dz / L) * 10, mid.z - (dx / L) * 10) ? 1 : -1;
      const x = mid.x - (dz / L) * sd * (ROAD_HALF + 0.7), z = mid.z + (dx / L) * sd * (ROAD_HALF + 0.7);
      const yaw = Math.atan2((dz / L) * sd, -(dx / L) * sd); // (the arm out over the road)
      places.push({ k: 'lamp', M: new THREE.Matrix4().compose(V(x, mid.y + lift + 0.14, z), _q.setFromAxisAngle(_Y, yaw), _s.setScalar(1.8)), s: 1.8 });
      ctx.lamps.push({ at: V(x + Math.sin(yaw) * 1.7, 0, z + Math.cos(yaw) * 1.7), y: mid.y + lift + 0.02 });
    }
    void line;
  }

  setNight(k) {
    this.night = k;
    if (this.s.mats.obsWall) { this.s.mats.obsWall.emissiveIntensity = k * 0.34; this.s.mats.copper.emissiveIntensity = k * 0.05; }
    const B = this.s.batches;
    for (const b of [this.obs, ...[...this.chunks.values()].map((c) => c.built)]) if (b) for (const h of b.night) B.show(h, k > 0.01);
  }

  // whether a point (the lot's frame) is inside a house or the observatory (flying into a square not built yet)
  solidAt(x, y, z) {
    const c = this.chunks.get(`${Math.floor(x / CH)},${Math.floor(z / CH)}`);
    if (c) for (const h of c.houses) {
      const p = h.p, dx = x - p.x, dz = z - p.z, cs = Math.cos(p.yaw), sn = Math.sin(p.yaw), lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < p.w / 2 + 0.6 && Math.abs(lz) < p.d / 2 + 0.6 && y > h.box.y0 - 0.6 && y < h.box.y1 + 0.6) return true;
    }
    const o = this.obsBox;
    if (o && Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z) < 90) {
      const l = V(x, y, z).applyMatrix4(o.inv);
      if (Math.abs(l.x) < 36 && Math.abs(l.z) < 15 && y > o.top - 1 && y < o.top + 26) return true;
    }
    return false;
  }
}
