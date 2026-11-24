// Port Haven (the map rework, 2026-11-24: city/Layout.js PORT): the container terminal on the basin's four quays,
// the yards between the highway and the basin, the breakwater with its light, and the shipyards' halls and slips on
// the basin's north side. Everything here is downloaded (CREDITS.md) and placed: ship-to-shore cranes on the quays'
// edges with their booms out over the water, forty-foot boxes stacked in the yards and on the quays (one instanced
// draw a colour near, one far, every box's shadow in one more), a container ship, a general cargo ship and a tanker
// tied up at the quays, a tug, double bitts along the edges, floodlight masts (their lamps lit at night, no point
// lights), the breakwater's armour stone and its lighthouse, and a ship being fitted out in the middle slip.
// Touchable throughout (props/Smash.js): the boxes' stacks and the ships' hulls are solid, the top box of a stack
// near Hal can be knocked off it, the bitts and masts are fixed until a hard blow.
//
// In the lot's frame, as Layout.js (world = lot + (0, 0, LOT_Z)). Built after its props have loaded
// (city/Waterfront.js loads them while the rest of the city builds): `yield* buildPort(ctx)`.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { prop, piece } from '../props/Props.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mergeByMaterial, flatCopy } from './Lod.js';
import { Batch } from './Kit.js';
import { box } from './Building.js';
import { PORT, waterAt } from './Layout.js';
import { cityCells, planCell, boxesOf, LOT_Z, seeded } from './Plan.js';

export const PORT_PROPS = ['sts_crane', 'box40', 'cargoship', 'boxship', 'tanker', 'harbourtug', 'lighthouse', 'bitt', 'floodmast', 'rocks', 'lifering'];
// the water's surface (the basins', the bay's, the sea's: Terrain.js lays it): the ships float to it
import { WATER_Y } from './Terrain.js';
export { WATER_Y };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ORIGIN = V(0, 0, LOT_Z);
const _q = new THREE.Quaternion(), _Y = V(0, 1, 0), _m = new THREE.Matrix4(), _v = V(0, 0, 0), _s = V(1, 1, 1);
export const at = (x, y, z, yaw = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(_Y, yaw), typeof s === 'number' ? V(s, s, s) : s);

// ------------------------------------------------------------------------------------------------ the helpers
// (shared with city/Playland.js and city/Marina.js)

// A template's meshes in its own frame: [{ geo, mat, M, cast }]
export function partsOf(o) {
  o.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), out = [];
  o.traverseVisible((m) => { if (m.isMesh && !m.isSkinnedMesh && !Array.isArray(m.material)) out.push({ geo: m.geometry, mat: m.material, M: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), cast: m.castShadow }); });
  return out;
}
// A template's box in its own frame (for its collider)
export function boundsOf(o) {
  o.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), b = new THREE.Box3(), t = new THREE.Box3();
  o.traverseVisible((m) => { if (!m.isMesh) return; m.geometry.computeBoundingBox(); b.union(t.copy(m.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld))); });
  return b;
}

// A geometry simplified to about `ratio` of its triangles, within `error` (of its size: a far copy can be rougher
// than city/Lod.js's 1%, which a textured model's seams held at its full count), its UVs and normals kept. Cached
// by the source geometry.
const _simple = new Map();
export function simpler(geo, ratio, error = 0.05) {
  const key = `${geo.uuid}|${ratio}|${error}`;
  if (_simple.has(key)) return _simple.get(key);
  let out = geo;
  // (welded first: a merged copy is a triangle soup, which no edge collapse can touch)
  if (!geo.index) geo = mergeVertices(geo, 1e-4);
  if (MeshoptSimplifier.supported && (geo.index ? geo.index.count : geo.attributes.position.count) >= 60) {
    const P = geo.attributes.position, n = P.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i); }
    const raw = geo.index ? Uint32Array.from(geo.index.array) : Uint32Array.from({ length: n - (n % 3) }, (_, i) => i), index = raw.length % 3 ? raw.subarray(0, raw.length - (raw.length % 3)) : raw;
    const target = Math.min(index.length - index.length % 3, Math.max(3, Math.floor((index.length / 3) * ratio) * 3));
    const [idx] = MeshoptSimplifier.simplify(index, pos, 3, target, error);
    if (idx.length < index.length) { out = geo.clone(); out.setIndex(new THREE.BufferAttribute(idx, 1)); }
  }
  _simple.set(key, out);
  return out;
}
// A far copy's parts: each part welded by position alone (a hard-edged model's faces share no vertices otherwise, and
// its texture's seams hold the rest: a crane's girders wouldn't simplify at all), simplified hard, its normals worked
// out again, in a plain material of the part's colour (a textured one's: `colours` by its material's name, else a
// grey). Seen from hundreds of metres, it's the same thing. Cached by the part's geometry.
const _rough = new Map(), _roughMat = new Map();
export function roughGeo(src, ratio, error) {
  const key = `${src.uuid}|${ratio}|${error}`;
  let geo = _rough.get(key);
  if (geo) return geo;
  const P = src.attributes.position, n = P.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = P.getX(i); a[i * 3 + 1] = P.getY(i); a[i * 3 + 2] = P.getZ(i); }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  if (src.index) g.setIndex(src.index.clone());
  g = mergeVertices(g.index ? g.toNonIndexed() : g, 1e-3);
  geo = simpler(g, ratio, error).clone();
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  _rough.set(key, geo);
  return geo;
}
export function roughParts(parts, { ratio = 0.06, error = 0.06, colours = {} } = {}) {
  return parts.map((p) => {
    const geo = roughGeo(p.geo, ratio, error);
    const name = p.mat.name ?? '', hit = Object.entries(colours).find(([re]) => new RegExp(re, 'i').test(name));
    const col = hit ? hit[1] : p.mat.map ? 0x9a9a9a : p.mat.color?.getHex() ?? 0x9a9a9a, mk = `${col}|${p.mat.emissive?.getHex?.() ?? 0}`;
    const mat = _roughMat.get(mk) ?? _roughMat.set(mk, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.15, name: 'far' })).get(mk);
    return { ...p, geo, mat, cast: false };
  });
}

// Copies of a shape drawn instanced between two distances from the camera (city/Lod.js InstanceSet, with a near
// edge: a far tier starts where the near one stops), a shadow-only copy within `shadow`; checked when the camera's
// moved a few metres. `list`: [{ M, pos (world), gone }].
export class TierSet {
  constructor(parent, geo, mat, list, { min = 0, max, shadow = 0, cast = true }) {
    Object.assign(this, { list, min, max, sd: cast ? shadow : 0 });
    this.main = new THREE.InstancedMesh(geo, mat, list.length);
    this.main.castShadow = false;
    this.main.receiveShadow = true;
    parent.add(this.main);
    if (this.sd > 0) {
      this.shade = new THREE.InstancedMesh(geo, mat, list.length);
      this.shade.castShadow = true;
      this.shade.layers.set(1);
      parent.add(this.shade);
    }
    for (const m of [this.main, this.shade]) if (m) { m.count = 0; m.visible = false; m.matrixAutoUpdate = false; m.updateMatrixWorld(true); }
    this.at = V(1e9, 0, 0);
    this.dirty = true;
  }
  update(cam) {
    if (!this.dirty && cam.distanceToSquared(this.at) < 9) return;
    this.dirty = false;
    this.at.copy(cam);
    const a2 = this.min * this.min, b2 = this.max * this.max, s2 = this.sd * this.sd;
    let a = 0, b = 0;
    for (const e of this.list) {
      if (e.gone) continue;
      const d = e.pos.distanceToSquared(cam);
      if (d >= a2 && d < b2) this.main.setMatrixAt(a++, e.M);
      if (this.shade && d < s2) this.shade.setMatrixAt(b++, e.M);
    }
    for (const [m, k] of [[this.main, a], [this.shade, b]]) {
      if (!m) continue;
      m.count = k;
      m.visible = k > 0;
      if (!k) continue;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }
}

// Props placed many times and never moved till they're struck: their parts merged by material (city/Lod.js), drawn
// instanced (each copy within its distance, a shadow-only copy within its shadow distance, and with `far` a copy
// simplified to `far.ratio` from there out to `far.dist`), each copy a Smash stand-in where it stands (no meshes:
// its collider), and when one's knocked loose (`breaks`) its own copy is put in its place, moving with its body,
// and taken out of the instanced ones.
export class Placed {
  constructor(f, group) { Object.assign(this, { f, group, kinds: new Map(), sets: [], items: [], built: false }); }
  // `template`: an Object3D standing at its origin, facing +z; `touch`: { kind: 'solid' | 'breaks', box (local), mass,
  // strong, stuff } (null: not touched, for what's out of reach)
  // (`flat`: a model painted in plain colours, no textures: all its parts one mesh, its colours in its vertices)
  kind(key, template, { dist = 250, shadow = 60, touch = null, far = null, flat = false } = {}) {
    const parts = partsOf(flat ? flatCopy(template, new Set(), { simplify: 1 }) : mergeByMaterial(template));
    const k = { template, parts, far, lists: null, farLists: null, dist, shadow, touch, n: 0 };
    k.lists = parts.map(() => []);
    if (far) { k.farParts = roughParts(parts, far); k.farLists = parts.map(() => []); }
    k.box = touch?.box ?? boundsOf(template);
    this.kinds.set(key, k);
    return k;
  }
  // a copy at M (the lot's frame; uniform scale only), touched as its kind is unless `touch` says otherwise
  put(key, M, touch) {
    const k = this.kinds.get(key), entries = [];
    _v.setFromMatrixPosition(M);
    const pos = _v.clone().add(ORIGIN);
    k.parts.forEach((p, i) => {
      const e = { M: new THREE.Matrix4().multiplyMatrices(M, p.M), pos, gone: false, set: null };
      k.lists[i].push(e); entries.push(e);
      if (k.farLists) { const g = { M: e.M, pos, gone: false, set: null }; k.farLists[i].push(g); entries.push(g); }
    });
    k.n++;
    const T = touch === undefined ? k.touch : touch;
    if (T) this.stand(k, M, T, entries);
    return entries;
  }
  stand(k, M, T, entries) {
    const smash = this.f.smash, o = new THREE.Object3D();
    M.decompose(o.position, o.quaternion, _s);
    o.position.add(ORIGIN);
    const s = _s.x, bx = (T.box ?? k.box).clone();
    bx.min.multiplyScalar(s); bx.max.multiplyScalar(s);
    const onBreak = T.kind === 'breaks' ? (item) => {
      const real = k.template.clone();
      real.scale.setScalar(s);
      o.add(real);
      o.matrixAutoUpdate = o.matrixWorldAutoUpdate = true;
      for (const e of entries) { e.gone = true; if (e.set) e.set.dirty = true; }
      this.f.lod?.add(o, k.dist, { moves: true, shadow: k.shadow });
      T.onBreak?.(item, o);
    } : null;
    const it = T.kind === 'breaks' ? smash.add(o, { kind: 'breaks', mass: T.mass ?? 50, strong: T.strong ?? 10, shrink: 1, glass: false, box: bx, stuff: T.stuff ?? 'metal', onBreak })
      : smash.add(o, { kind: 'solid', stuff: T.stuff ?? 'metal', shrink: 1, box: bx, glass: false });
    o.updateMatrixWorld(true);
    o.matrixAutoUpdate = o.matrixWorldAutoUpdate = false; // (until it's knocked loose: then its body moves it)
    if (it) this.items.push(it);
    return it;
  }
  finish() {
    for (const k of this.kinds.values()) {
      k.parts.forEach((p, i) => {
        if (!k.lists[i].length) return;
        const set = new TierSet(this.group, p.geo, p.mat, k.lists[i], { max: k.dist, shadow: k.shadow, cast: p.cast });
        for (const e of k.lists[i]) e.set = set;
        this.sets.push(set);
      });
      if (k.farParts) k.farParts.forEach((p, i) => {
        if (!k.farLists[i].length) return;
        const set = new TierSet(this.group, p.geo, p.mat, k.farLists[i], { min: k.dist, max: k.far.dist, shadow: 0, cast: false });
        for (const e of k.farLists[i]) e.set = set;
        this.sets.push(set);
      });
    }
    this.built = true;
  }
  update(cam) { for (const s of this.sets) s.update(cam); }
}

// Single big things (a ship, a ride) drawn by distance: within `near` as themselves (their parts merged by
// material, but what moves: `keep`), from there to `far` as a simplified copy, beyond it not at all; casting shadows
// within `shadow`. Checked a few times a second, and at once after a cut. (Not through city/Lod.js: one system only
// sets these objects' `visible`.)
export class Tiers {
  constructor(f) { Object.assign(this, { f, list: [], t: 1, last: V(1e9, 0, 0) }); }
  add(o, { near = 600, far = 4000, shadow = 300, ratio = 0.12, error = 0.05, keep = null, merge = true, flat = false } = {}) {
    o.updateMatrixWorld(true);
    // its still parts merged by material (a downloaded model of many parts: a draw call each)
    if (merge) {
      const moving = [];
      if (keep) o.traverse((m) => { if (m !== o && keep(m)) moving.push(m); });
      const vis = moving.map((m) => m.visible);
      for (const m of moving) m.visible = false;
      const merged = flat ? flatCopy(o, new Set(), { simplify: 1 }) : mergeByMaterial(o);
      const old = [];
      o.traverse((m) => { if (m.isMesh && !moving.some((k) => k === m || k.getObjectById?.(m.id))) old.push(m); });
      for (const m of old) m.removeFromParent();
      moving.forEach((m, i) => { m.visible = vis[i]; });
      o.add(merged);
      o.updateMatrixWorld(true);
    }
    let lo = null;
    if (far > near) {
      lo = new THREE.Group();
      const parts = partsOf(o);
      for (const p of parts) { const m = new THREE.Mesh(simpler(p.geo, ratio, error), p.mat); m.matrixAutoUpdate = false; m.matrix.copy(p.M); m.castShadow = false; m.receiveShadow = true; lo.add(m); }
      lo.position.copy(o.position); lo.quaternion.copy(o.quaternion); lo.scale.copy(o.scale);
      lo.visible = false;
      o.parent.add(lo);
      lo.updateMatrixWorld(true);
    }
    const box = new THREE.Box3().setFromObject(o);
    const it = { o, lo, near, far, shadow, box, on: null, cast: null };
    this.list.push(it);
    return it;
  }
  update(cam, dt) {
    this.t += dt;
    const jumped = cam.distanceToSquared(this.last) > 2500;
    if (this.t < 0.25 && !jumped) return;
    this.t = 0;
    this.last.copy(cam);
    for (const it of this.list) {
      const d = it.box.distanceToPoint(cam), tier = d < it.near ? 0 : d < it.far ? 1 : 2;
      if (tier !== it.on) {
        it.on = tier;
        it.o.visible = tier === 0 || (!it.lo && tier === 1);
        if (it.lo) it.lo.visible = tier === 1;
      }
      const cast = d < it.shadow;
      if (cast !== it.cast) { it.cast = cast; it.o.traverse((m) => { if (m.isMesh) m.castShadow = cast && m.userData.noCast !== true; }); }
    }
  }
}

// A hidden mesh for colliders (Smash.solid with `mesh`: its own triangles; not drawn, but "visible" so Smash's
// box of it counts it)
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
export function solidOf(f, geos, stuff = 'metal') {
  const g = new THREE.Group();
  for (const geo of geos) g.add(new THREE.Mesh(geo, HIDDEN));
  f.scene.add(g);
  return f.smash.solid(g, { stuff, mesh: true });
}
// The convex hull of points (world space) as a geometry, for solidOf
export const hullOf = (pts) => (pts.length >= 4 ? new ConvexGeometry(pts) : null);

// A ship's colliders: its hull below the deck as one convex piece (so its deck is flat and walkable), what stands
// on the deck as convex pieces a slice of its length each. `o`: the ship placed (world), `deck`: its deck's height
// in its own frame. Its points sampled (a few thousand), all in the world.
export function shipSolid(f, o, deck, { slice = 8, stuff = 'metal' } = {}) {
  o.updateMatrixWorld(true);
  const below = [], above = new Map(), inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), p = V(0, 0, 0), l = V(0, 0, 0);
  let n = 0;
  o.traverse((m) => { if (m.isMesh) n += m.geometry.attributes.position.count; });
  const step = Math.max(1, Math.floor(n / 6000));
  o.traverse((m) => {
    if (!m.isMesh) return;
    const P = m.geometry.attributes.position;
    for (let i = 0; i < P.count; i += step) {
      p.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m.matrixWorld);
      l.copy(p).applyMatrix4(inv);
      if (l.y <= deck + 0.05) below.push(p.clone());
      else { const k = Math.floor(l.z / slice); (above.get(k) ?? above.set(k, []).get(k)).push(p.clone()); }
    }
  });
  // (the hull's top cut flat at the deck: its points at the deck's height where they're below it)
  const geos = [hullOf(below)];
  for (const pts of above.values()) if (pts.length > 12) geos.push(hullOf(pts));
  return solidOf(f, geos.filter(Boolean), stuff);
}

// Triangles as a geometry, each turned to face away from `inside` (a roof's, a hull's: whichever way they were listed)
export function facing(tris, inside) {
  const out = [], n = V(0, 0, 0), e1 = V(0, 0, 0), e2 = V(0, 0, 0), c = V(0, 0, 0);
  for (const [a, b, d] of tris) {
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a));
    c.copy(a).add(b).add(d).multiplyScalar(1 / 3).sub(inside);
    const [p, q, r] = n.dot(c) >= 0 ? [a, b, d] : [a, d, b];
    out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

// A geometry less its triangles wholly below `y` (in its own frame)
export function withoutBelow(geo, y) {
  const P = geo.attributes.position, I = geo.index, keep = [];
  const n = I ? I.count : P.count, ix = (k) => (I ? I.getX(k) : k);
  for (let k = 0; k < n; k += 3) if (P.getY(ix(k)) >= y || P.getY(ix(k + 1)) >= y || P.getY(ix(k + 2)) >= y) keep.push(ix(k), ix(k + 1), ix(k + 2));
  const g = geo.clone();
  g.setIndex(keep);
  return g;
}

// Hide every mesh of `o` beyond `dist` from the camera, and its shadow beyond `shadow` (city/Lod.js)
export const byDistance = (f, o, dist, shadow = Infinity) => {
  o.updateMatrixWorld(true);
  f.lod?.add(o, dist, { box: new THREE.Box3().setFromObject(o), shadow });
};

// ------------------------------------------------------------------------------------------------ the boxes
// Forty-foot boxes by the thousand: each stack's boxes drawn near as the downloaded box (its seven colours each an
// instanced mesh) and far as a box of twelve triangles wearing the same texture (its faces' UVs fitted to the
// model's own: from 30 m it's the same box), all their shadows from one shadow-only instanced box; each stack
// solid (Smash), and within reach of the camera its top box can be knocked off (fixed till a hard blow, then 3.8
// tonnes loose, drawn as itself).
const NEAR = 34, TOUCH_IN = 70, TOUCH_OUT = 95;
export const BOX = { w: 2.46, h: 2.62, l: 12.33 };
// A box's far copy: a box of its size, each face's UVs fitted (least squares) to those of the model's triangles
// that face the same way on that side, so it wears the model's own texture.
function farBox(geo) {
  const P = geo.attributes.position, U = geo.attributes.uv, I = geo.index;
  geo.computeBoundingBox();
  const b = geo.boundingBox, out = new THREE.BoxGeometry(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z).translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  if (!U) return out;
  const tri = I ? I.count / 3 : P.count / 3, ia = (t, k) => (I ? I.getX(t * 3 + k) : t * 3 + k);
  const a = V(0, 0, 0), bb = V(0, 0, 0), c = V(0, 0, 0), n = V(0, 0, 0);
  const faces = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]; // (BoxGeometry's order: +x -x +y -y +z -z)
  const fits = faces.map(([ax, sg]) => {
    const ext = sg > 0 ? b.max.getComponent(ax) : b.min.getComponent(ax), [sa, ta] = [0, 1, 2].filter((q) => q !== ax);
    const rows = [];
    for (let t = 0; t < tri; t++) {
      a.fromBufferAttribute(P, ia(t, 0)); bb.fromBufferAttribute(P, ia(t, 1)); c.fromBufferAttribute(P, ia(t, 2));
      n.subVectors(bb, a).cross(c.clone().sub(a)).normalize();
      if (n.getComponent(ax) * sg < 0.95) continue;
      if (Math.abs((a.getComponent(ax) + bb.getComponent(ax) + c.getComponent(ax)) / 3 - ext) > 0.09) continue;
      for (let k = 0; k < 3; k++) { const i = ia(t, k); a.fromBufferAttribute(P, i); rows.push([a.getComponent(sa), a.getComponent(ta), U.getX(i), U.getY(i)]); }
    }
    if (rows.length < 6) return null;
    // u = p·s + q·t + r (and v): the normal equations of a plane fit
    const solve = (col) => {
      let ss = 0, st = 0, s1 = 0, tt = 0, t1 = 0, n1 = 0, su = 0, tu = 0, u1 = 0;
      for (const r of rows) { ss += r[0] * r[0]; st += r[0] * r[1]; s1 += r[0]; tt += r[1] * r[1]; t1 += r[1]; n1++; su += r[0] * r[col]; tu += r[1] * r[col]; u1 += r[col]; }
      const A = new THREE.Matrix3().set(ss, st, s1, st, tt, t1, s1, t1, n1);
      if (Math.abs(A.determinant()) < 1e-9) return null;
      const x = V(su, tu, u1).applyMatrix3(A.clone().invert());
      return x;
    };
    const fu = solve(2), fv = solve(3);
    return fu && fv ? { sa, ta, fu, fv } : null;
  });
  const OP = out.attributes.position, OU = out.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const fit = fits[f];
    if (!fit) continue;
    for (let i = f * 4; i < f * 4 + 4; i++) {
      a.fromBufferAttribute(OP, i);
      const s = a.getComponent(fit.sa), t = a.getComponent(fit.ta);
      OU.setXY(i, fit.fu.x * s + fit.fu.y * t + fit.fu.z, fit.fv.x * s + fit.fv.y * t + fit.fv.z);
    }
  }
  return out;
}

export class Boxes {
  constructor(f, group) {
    Object.assign(this, { f, group, stacks: [], variants: [], at: V(1e9, 0, 0), t: 1, active: new Set(), n: 0 });
    // the seven painted boxes of the pack, each its own texture (the downloaded file's plain ones: Object_20 to 32)
    for (const id of [20, 22, 24, 26, 28, 30, 32]) {
      const o = piece('box40', new RegExp(`^Object_${id}$`));
      const parts = partsOf(o);
      if (!parts.length) continue;
      const near = parts[0], far = farBox(near.geo.clone().applyMatrix4(near.M));
      this.variants.push({ template: o, near, far, list: [] });
    }
  }
  // a stack of `n` boxes at (x, z) in the lot's frame, its length along `yaw` (0: along z), from height y
  stack(x, z, yaw, n, y = 0, { touch = true, rnd = Math.random } = {}) {
    const st = { x, z, yaw, n, y, boxes: [], item: null, low: null, top: null, broken: false, touch };
    for (let i = 0; i < n; i++) {
      const v = this.variants[Math.floor(rnd() * this.variants.length) % this.variants.length];
      // (a few centimetres off true each: a yard's stacks are never quite square)
      const M = at(x + (rnd() - 0.5) * 0.12, y + i * BOX.h, z + (rnd() - 0.5) * 0.12, yaw + (rnd() - 0.5) * 0.012 + (rnd() < 0.5 ? 0 : Math.PI));
      const e = { M, pos: V(x, y + i * BOX.h, z).add(ORIGIN), v, near: false, gone: false, i: v.list.length };
      v.list.push(e);
      st.boxes.push(e);
    }
    this.stacks.push(st);
    this.n += n;
    return st;
  }
  // its collider as a Smash stand-in: boxes `from` to `to` of the stack, solid or breaking
  standIn(st, from, to, kind = 'solid') {
    const o = new THREE.Object3D();
    o.position.set(st.x, st.y + from * BOX.h, st.z).add(ORIGIN);
    o.quaternion.setFromAxisAngle(_Y, st.yaw);
    const bx = new THREE.Box3(V(-BOX.w / 2, 0, -BOX.l / 2), V(BOX.w / 2, (to - from) * BOX.h, BOX.l / 2));
    const smash = this.f.smash;
    let it;
    if (kind === 'breaks') {
      const e = st.boxes[from];
      it = smash.add(o, { kind: 'breaks', mass: 3800, strong: 26, shrink: 0.99, glass: false, box: bx, stuff: 'metal', friction: 0.6,
        onBreak: () => {
          const real = e.v.template.clone();
          // (the box's own pose within the stand-in: its half turn, if it has one)
          const q = new THREE.Quaternion(); e.M.decompose(_v, q, _s);
          real.quaternion.copy(o.quaternion).invert().multiply(q);
          o.add(real);
          o.matrixAutoUpdate = o.matrixWorldAutoUpdate = true;
          e.gone = true;
          st.broken = true;
          this.dirty = true;
          this.f.lod?.add(o, 400, { moves: true, shadow: 80 });
        } });
    } else it = smash.add(o, { kind: 'solid', stuff: 'metal', shrink: 1, box: bx, glass: false });
    o.updateMatrixWorld(true);
    o.matrixAutoUpdate = o.matrixWorldAutoUpdate = false;
    return it;
  }
  // everything into instanced meshes, and every stack solid; in slices (`yield`)
  *finish() {
    const g = this.group;
    for (const v of this.variants) {
      const n = v.list.length;
      if (!n) continue;
      v.far = new THREE.InstancedMesh(v.far, v.near.mat, n);
      v.nearMesh = new THREE.InstancedMesh(v.near.geo, v.near.mat, n);
      v.nearMesh.count = 0;
      v.nearMesh.visible = false;
      for (const m of [v.far, v.nearMesh]) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.frustumCulled = m === v.nearMesh; g.add(m); }
      v.list.forEach((e, i) => v.far.setMatrixAt(i, e.M));
      v.far.computeBoundingSphere();
      v.far.frustumCulled = true;
    }
    // every box's shadow: a plain box each, seen only by the shadow cameras (layer 1)
    const all = this.variants.flatMap((v) => v.list);
    this.shade = new THREE.InstancedMesh(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.l).translate(0, BOX.h / 2, 0), new THREE.MeshStandardMaterial({ color: 0x777777 }), all.length);
    all.forEach((e, i) => { this.shade.setMatrixAt(i, e.M); e.si = i; });
    this.shade.castShadow = true;
    this.shade.layers.set(1);
    this.shade.matrixAutoUpdate = false;
    this.shade.computeBoundingSphere();
    g.add(this.shade);
    g.updateMatrixWorld(true);
    let k = 0;
    for (const st of this.stacks) {
      if (st.touch) st.item = this.standIn(st, 0, st.n);
      if (++k % 150 === 0) yield;
    }
  }
  // which boxes are near (their own model) and far (the box), and which stacks' tops can be knocked off
  update(cam, dt) {
    this.t += dt;
    if (this.t < 0.2 && !this.dirty) return;
    this.t = 0;
    const moved = this.at.distanceToSquared(cam) > 9;
    if (!moved && !this.dirty) return;
    if (moved) this.at.copy(cam);
    this.dirty = false;
    const n2 = NEAR * NEAR;
    for (const v of this.variants) {
      if (!v.far) continue;
      let k = 0, changed = false;
      for (const e of v.list) {
        const near = !e.gone && e.pos.distanceToSquared(cam) < n2;
        if (near) v.nearMesh.setMatrixAt(k++, e.M);
        const farOn = !near && !e.gone;
        if (e.farOn !== farOn) { e.farOn = farOn; v.far.setMatrixAt(e.i, farOn ? e.M : _m.makeScale(0, 0, 0)); changed = true; }
        if (e.gone && !e.shadeGone) { e.shadeGone = true; this.shade.setMatrixAt(e.si, _m.makeScale(0, 0, 0)); this.shade.instanceMatrix.needsUpdate = true; }
      }
      if (changed) v.far.instanceMatrix.needsUpdate = true;
      v.nearMesh.count = k;
      v.nearMesh.visible = k > 0;
      if (k) { v.nearMesh.instanceMatrix.needsUpdate = true; v.nearMesh.computeBoundingSphere(); }
    }
    // the tops within reach: the stack's collider split, the top box breakable
    const lx = cam.x - ORIGIN.x, lz = cam.z - ORIGIN.z, ly = cam.y, smash = this.f.smash;
    for (const st of this.stacks) {
      if (!st.touch || st.n < 1) continue;
      const d = Math.hypot(st.x - lx, st.z - lz, Math.max(0, ly - 60) * 0.5);
      if (!st.active && d < TOUCH_IN && !st.broken) {
        st.active = true;
        smash.remove(st.item);
        st.item = null;
        st.low = st.n > 1 ? this.standIn(st, 0, st.n - 1) : null;
        st.top = this.standIn(st, st.n - 1, st.n, 'breaks');
      } else if (st.active && d > TOUCH_OUT && !st.broken) {
        st.active = false;
        smash.remove(st.low); smash.remove(st.top);
        st.low = st.top = null;
        st.item = this.standIn(st, 0, st.n);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ Port Haven
export function* buildPort(ctx) {
  const { f, mats } = ctx, P = f.physics;
  const root = new THREE.Group();
  root.name = 'port';
  root.position.copy(ORIGIN);
  ctx.root.add(root);
  const rnd = seeded(2027), batch = new Batch();
  const placed = new Placed(f, root), tiers = new Tiers(f);
  const boxes = new Boxes(f, root);
  const solid = (x0, y0, z0, x1, y1, z1, q) => P.fixedBox(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).add(ORIGIN), V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q);
  const out = { root, placed, boxes, ships: [], lit: [], beacons: [], update: null };
  const masts = [];

  // ---- the kinds placed many times
  placed.kind('bitt', prop('bitt'), { dist: 160, shadow: 30, touch: { kind: 'solid', stuff: 'metal' } });
  // (the masts: galvanised poles, dark lamp housings, the lamps' faces lit at night)
  const mast = prop('floodmast', { ownMaterials: true });
  mast.traverse((m) => {
    if (!m.isMesh) return;
    const n = m.material.name, M = m.material;
    if (/^Material$/.test(n)) Object.assign(M, { roughness: 0.5, metalness: 0.6 }).color.setHex(0x9a9ea2);
    else if (/Material\.001/.test(n)) Object.assign(M, { roughness: 0.6, metalness: 0.3 }).color.setHex(0x2e3134);
    else if (/Material\.004/.test(n)) Object.assign(M, { roughness: 0.25, metalness: 0 }).color.setHex(0xe8e6df);
    // (its housings were 15,600 triangles each, six of them: welded and simplified, the same shape)
    m.geometry = roughGeo(m.geometry, 0.08, 0.004);
  });
  placed.kind('mast', mast, { dist: 220, shadow: 160, far: { dist: 2600, ratio: 0.04, error: 0.05 }, touch: { kind: 'breaks', mass: 2200, strong: 60, stuff: 'metal', box: new THREE.Box3(V(-0.5, 0, -0.5), V(0.5, 30, 0.5)) } });
  placed.kind('ring', prop('lifering'), { dist: 90, shadow: 0, touch: { kind: 'breaks', mass: 2.5, strong: 2, stuff: 'plastic' } });
  // the masts' lamps: lit at night (their own lamp material, its emissive)
  const mastLamps = new Set();
  placed.kinds.get('mast').parts.forEach((p) => { if (/Material\.004/.test(p.mat.name)) mastLamps.add(p.mat); });
  for (const m of mastLamps) { m.emissive = new THREE.Color(1, 0.86, 0.62); m.emissiveIntensity = 0; out.lit.push({ mat: m, on: 2.2 }); }
  yield;

  // ---- the cranes: on each quay's edges, the waterside legs 2.5 m in from the edge, the boom out over the basin
  // (the model's boom runs to -z; squeezed to 0.85 across and 0.78 along it: as downloaded its legs stood 48 m
  // apart, wider than half a quay)
  const crane = prop('sts_crane', { ownMaterials: true });
  crane.traverse((m) => {
    if (!m.isMesh) return;
    const n = m.material.name;
    if (/^Paint_Rusted$/.test(n)) m.material.color.setHex(0xc8552e); // (the port's orange: the map draws the cranes so)
    else if (/Paint_Rusted\.001/.test(n)) m.material.color.setHex(0xe2ddd3);
    else if (/Material\.002/.test(n)) m.material.color.setHex(0x3a3d40);
    m.material.roughness = Math.max(0.55, m.material.roughness);
    m.material.metalness = Math.min(0.35, m.material.metalness);
    // (it stood on lorry tyres, a car's rims two metres high: a quay crane runs on rails, in bogies of small steel
    // wheels. The tyres taken out, the bogies built under its legs: below)
    if (/^Wheel$/.test(n)) m.geometry = withoutBelow(m.geometry, 3.3);
    if (m.name === 'Object_8') m.visible = false; // (the tyres' black mudguards)
  });
  const CS = V(0.85, 1, 0.78), LEG = { water: -4 * 0.78, land: 44 * 0.78, tip: -47 * 0.78 };
  placed.kind('crane', crane, { dist: 450, shadow: 260, touch: null, far: { dist: 3200, ratio: 0.08, error: 0.03, colours: { Wheel: 0x8a8d90 } } });
  // a bogie: its frame, eight steel wheels down each side on the rail, buffers at its ends
  {
    const b = new Batch(), I = new THREE.Matrix4();
    b.add('metal', box(-4.6, 0.55, -0.8, 4.6, 1.9, 0.8), I, 0x3a3d40);
    b.add('metal', box(-1.6, 1.9, -0.7, 1.6, 2.6, 0.7), I, 0x3a3d40);
    b.add('metal', box(-0.9, 2.6, -0.62, 0.9, 5.9, 0.62), I, 0x3a3d40); // (the equaliser up to the leg's sill)
    b.add('paint', box(-1.3, 5.9, -0.9, 1.3, 6.3, 0.9), I, 0xc8552e);
    for (let i = 0; i < 8; i++) for (const sz of [-0.55, 0.55]) b.add('iron', new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14).rotateX(Math.PI / 2).translate(-3.85 + i * 1.1, 0.48, sz), I, 0x55585a);
    for (const sx of [-1, 1]) b.add('paint', box(sx * 4.6 - 0.2, 0.7, -0.45, sx * 4.6 + 0.2, 1.5, 0.45), I, 0xd8b23a);
    const g = b.build(mats, { cell: 4000 });
    placed.kind('bogie', g, { dist: 700, shadow: 60, touch: null });
  }
  const quayOf = (x) => PORT.quays.find((q) => x > q.x0 - 10 && x < q.x1 + 10);
  for (const c of PORT.cranes) {
    const q = quayOf(c.x), west = c.x < (q.x0 + q.x1) / 2;
    const yaw = west ? Math.PI / 2 : -Math.PI / 2, cx = west ? q.x0 + 2.5 - LEG.water : q.x1 - 2.5 + LEG.water;
    const M = new THREE.Matrix4().compose(V(cx, 0, c.z), _q.setFromAxisAngle(_Y, yaw).clone(), CS);
    placed.put('crane', M, null);
    // its bogies under its four legs, on their rails (the rails along the quay: below)
    for (const lz of [LEG.water, LEG.land]) for (const dz of [-12.8, 12.8]) placed.put('bogie', at(cx + (west ? 1 : -1) * lz, 0, c.z + dz, Math.PI / 2));
    // its colliders: the four legs, the portal's sill beams, the girder and boom, the machinery house
    const sgn = west ? 1 : -1, wx = (lz) => cx + sgn * lz; // (the model's z to the lot's x)
    for (const lz of [LEG.water, LEG.land]) for (const dz of [-14.5, 14.5]) solid(wx(lz) - 1.1, 0, c.z + dz - 1.6, wx(lz) + 1.1, 38, c.z + dz + 1.6);
    for (const dz of [-14.5, 14.5]) solid(Math.min(wx(LEG.water), wx(LEG.land)), 0.4, c.z + dz - 1.7, Math.max(wx(LEG.water), wx(LEG.land)), 2.6, c.z + dz + 1.7);
    solid(Math.min(wx(LEG.tip), wx(LEG.land + 3)), 36.5, c.z - 8, Math.max(wx(LEG.tip), wx(LEG.land + 3)), 39.5, c.z + 8);
    // a red light on its boom's tip and on its top, for the aircraft (lit at night, blinking: update)
    out.beacons.push(V(wx(LEG.tip + 0.6), 40.2, c.z), V(wx(LEG.land - 2), 42.6, c.z));
  }
  yield;

  // ---- the quays: the cranes' rails, bitts along both edges, the boxes stacked down the middle, masts, life rings
  for (const q of PORT.quays) {
    for (const x of [q.x0 + 2.5, q.x0 + 2.5 - LEG.water + LEG.land, q.x1 - 2.5, q.x1 - 2.5 + LEG.water - LEG.land]) {
      batch.add('iron', box(x - 0.09, 0, q.z0 + 3, x + 0.09, 0.16, q.z1 - 3), null, 0x6a6c6e);
      batch.add('concrete', box(x - 0.45, 0, q.z0 + 3, x + 0.45, 0.04, q.z1 - 3), null, 0x8e8a84);
    }
    for (const [x, yaw] of [[q.x0 + 0.9, 0], [q.x1 - 0.9, Math.PI]]) {
      for (let z = q.z0 + 14; z < q.z1 - 4; z += 22) placed.put('bitt', at(x, 0, z, yaw));
      for (let z = q.z0 + 40; z < q.z1; z += 90) {
        // a life ring in its holder on a post, back from the edge
        const px = x + (yaw ? -1.6 : 1.6);
        batch.add('paint', box(px - 0.06, 0, z + 11 - 0.06, px + 0.06, 1.5, z + 11 + 0.06), null, 0xd8b23a);
        batch.add('paint', box(px - 0.04, 1.15, z + 11 - 0.42, px + 0.04, 1.22, z + 11 + 0.42), null, 0xd8b23a);
        placed.put('ring', at(px + (yaw ? -0.11 : 0.11), 0.78, z + 11, yaw ? -Math.PI / 2 : Math.PI / 2));
      }
    }
    // across the quay's end too
    for (let x = q.x0 + 6; x < q.x1 - 4; x += 22) placed.put('bitt', at(x, 0, q.z1 - 0.9, Math.PI / 2));
    // the boxes waiting for the ships: rows along the quay's middle, lanes between
    const cx = (q.x0 + q.x1) / 2;
    for (let z = q.z0 + 30; z < q.z1 - 26; z += 15.5) {
      if (rnd() < 0.18) continue;
      for (let k = -2; k <= 2; k++) {
        if (rnd() < 0.15) continue;
        boxes.stack(cx + k * (BOX.w + 0.3), z, 0, 1 + Math.floor(rnd() * 3.4), 0, { rnd });
      }
    }
    for (const z of [q.z0 + 70, q.z1 - 40]) { const x = cx + (rnd() < 0.5 ? -9 : 9); placed.put('mast', at(x, 0, z, rnd() * 6)); masts.push([x, z]); }
  }
  yield;

  // ---- the yards: the 'port' blocks between the highway and the basin (Plan.js), stacks in blocks of six rows,
  // four boxes' lengths across, lanes between; the north 30 m of each left to its gate and shed (the map's)
  // (stacks only where the block's plan puts no building: Plan.js planCell; a yard's gate and shed stand at its
  // north end, as the map draws them)
  for (const c of cityCells()) {
    if (c.district !== 'port') continue;
    const r = seeded(c.seed), built = planCell(c).flatMap(boxesOf);
    const clear = (x, z, hx, hz) => !built.some((b) => x + hx > b.x0 - 1.5 && x - hx < b.x1 + 1.5 && z + hz > b.z0 - 1.5 && z - hz < b.z1 + 1.5);
    const x0 = c.x0 + 2.6, rows = 6, rowW = BOX.w + 0.32, blockD = rows * rowW + 6.4;
    let z = c.z0 + 8;
    while (z + rows * rowW < c.z1 - 30) {
      for (let col = 0; col < 4; col++) {
        const x = x0 + BOX.l / 2 + col * (BOX.l + 0.45);
        if (x + BOX.l / 2 > c.x1 - 2) break;
        for (let row = 0; row < rows; row++) {
          if (r() < 0.07) continue; // (a gap: a stack lifted out)
          const h = r(), n = h < 0.12 ? 1 : h < 0.35 ? 2 : h < 0.75 ? 3 : h < 0.93 ? 4 : 5, sz = z + row * rowW + BOX.w / 2;
          if (!clear(x, sz, BOX.l / 2, BOX.w / 2)) continue;
          boxes.stack(x, sz, Math.PI / 2, n, 0, { rnd: r });
        }
      }
      z += blockD;
    }
    // a mast at the yard's middle
    { const x = c.cx + (r() < 0.5 ? -26 : 26); if (clear(x, c.cz + 10, 1, 1)) { placed.put('mast', at(x, 0, c.cz + 10, r() * 6)); masts.push([x, c.cz + 10]); } }
  }
  yield;

  // ---- the ships at the quays: the general cargo ship, the container ship (its bays loaded: below) and the tanker
  // (each floating to the water at its draught; its hull and what's on its deck solid)
  const moor = (name, q, side, draught, z, { deck, yawExtra = 0 } = {}) => {
    const o = prop(name);
    const b = boundsOf(o), half = (b.max.x - b.min.x) / 2;
    const x = side < 0 ? q.x0 - 1.6 - half : q.x1 + 1.6 + half;
    o.position.set(x, WATER_Y - draught, z).add(ORIGIN);
    o.rotation.y = (side < 0 ? 0 : Math.PI) + yawExtra; // (bow north at the west side, south at the east)
    f.scene.add(o);
    o.updateMatrixWorld(true);
    o.traverse((m) => { m.matrixAutoUpdate = false; });
    const item = shipSolid(f, o, deck);
    tiers.add(o, { near: 700, far: 4200, shadow: 500, ratio: 0.08, flat: name === 'tanker' });
    out.ships.push({ o, item, name });
    return o;
  };
  const Q = PORT.quays;
  moor('cargoship', Q[0], -1, 6.2, 2450, { deck: 13.6 });
  const boxship = moor('boxship', Q[1], 1, 11.5, 2446, { deck: 23.4 });
  moor('tanker', Q[3], -1, 8.6, 2452, { deck: 11.3 });
  yield;
  // the container ship's bays: on its hatch covers between the lashing bridges, thirteen boxes across, two to six high
  {
    const deck = 23.4, M0 = boxship.matrixWorld.clone(), skip = (z) => (z > 22 && z < 38) || (z > -90 && z < -78);
    const pos = V(0, 0, 0), qy = new THREE.Quaternion();
    for (let z = -74; z < 92; z += BOX.l + 1.75) {
      if (skip(z)) continue;
      const across = z > 66 ? 9 : 13, high = z > 66 ? 2 : 3;
      for (let k = 0; k < across; k++) {
        const lx = (k - (across - 1) / 2) * (BOX.w + 0.08);
        const n = high + Math.floor(rnd() * (z > 66 ? 2 : 4));
        pos.set(lx, deck, z).applyMatrix4(M0).sub(ORIGIN);
        qy.setFromRotationMatrix(M0);
        const yaw = new THREE.Euler().setFromQuaternion(qy, 'YXZ').y;
        boxes.stack(pos.x, pos.z, yaw, n, pos.y, { touch: true, rnd });
      }
    }
  }
  yield;

  // ---- a tug, tied up at the quays' root by the basin's south side
  {
    const o = prop('harbourtug');
    o.position.set(-610, WATER_Y - 4.2, 2316).add(ORIGIN);
    o.rotation.y = -Math.PI / 2;
    f.scene.add(o);
    o.updateMatrixWorld(true);
    const item = shipSolid(f, o, 7.4, { slice: 4 });
    tiers.add(o, { near: 450, far: 2500, shadow: 250, ratio: 0.1 });
    out.ships.push({ o, item, name: 'tug', bob: { y: o.position.y, ph: 0.7 } });
  }
  yield;

  // ---- the breakwater: a concrete crown on a rubble mound, its wave wall on the seaward side, armour stone down
  // both flanks; the lighthouse on a round head at its end
  {
    const line = PORT.breakwater, W = 12, crown = 3.2;
    const rocks = [piece('rocks', /^Object_9$/), piece('rocks', /^Object_8$/), piece('rocks', /^Object_3$/)];
    const rockKinds = rocks.map((o, i) => { const key = `rock${i}`; placed.kind(key, o, { dist: 220, shadow: 70, touch: null, far: { dist: 900, ratio: 0.08, error: 0.06, colours: { Stingray: 0x8a8278 } } }); return key; });
    let s = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
      const M = at((a.x + b.x) / 2, 0, (a.z + b.z) / 2, yaw);
      batch.add('concrete', box(-W / 2, -6, -L / 2 - 0.3, W / 2, crown, L / 2 + 0.3), M, 0xb9b3a8);
      batch.add('concrete', box(-W / 2 + 0.2, crown, -L / 2 - 0.3, -W / 2 + 1.0, crown + 1.6, L / 2 + 0.3), M, 0xc9c2b4); // (the wave wall, seaward: west)
      batch.add('roadpaint', box(1.2, crown, -L / 2, 1.45, crown + 0.02, L / 2), M, 0xd8c35a);
      const q = _q.setFromAxisAngle(_Y, yaw).clone();
      P.fixedBox(V((a.x + b.x) / 2, crown / 2 - 3, (a.z + b.z) / 2).add(ORIGIN), V(W / 2, crown / 2 + 3, L / 2 + 0.2), q);
      P.fixedBox(V(0, 0, 0).set(-W / 2 + 0.6, crown + 0.8, 0).applyQuaternion(q).add(V((a.x + b.x) / 2, 0, (a.z + b.z) / 2)).add(ORIGIN), V(0.4, 0.8, L / 2 + 0.2), q);
      // armour stone, both flanks, a boulder every 2.6 m, tumbled
      for (let t = 0; t < L; t += 2.6) {
        for (const side of [-1, 1]) {
          const u = side * (W / 2 + 1.2 + rnd() * 2.2), z = -L / 2 + t + rnd() * 1.4, y = -0.8 + rnd() * 1.6;
          const p = V(u, 0, z).applyQuaternion(q).add(V((a.x + b.x) / 2, 0, (a.z + b.z) / 2));
          const k = rockKinds[Math.floor(rnd() * rockKinds.length)];
          const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * 6.3, rnd() * 0.6));
          placed.put(k, at(p.x, y, p.z, 0, 1.5 + rnd() * 1.1).multiply(R), null);
        }
      }
      s += L;
    }
    // the head: a round concrete platform, the light on it
    const e = line[line.length - 1];
    batch.add('concrete', new THREE.CylinderGeometry(11, 13, crown + 6, 28).translate(e.x, crown / 2 - 3, e.z), null, 0xb9b3a8);
    const lh = prop('lighthouse');
    lh.position.set(e.x, crown, e.z).add(ORIGIN);
    f.scene.add(lh);
    lh.updateMatrixWorld(true);
    tiers.add(lh, { near: 900, far: 5000, shadow: 200, ratio: 0.2 });
    out.lighthouse = { o: lh, at: V(e.x, crown + 15.8, e.z).add(ORIGIN) };
    solidOf(f, [new THREE.CylinderGeometry(2.8, 2.8, 12, 16).translate(e.x + ORIGIN.x, crown + 6, e.z + ORIGIN.z), new THREE.CylinderGeometry(1.5, 1.5, 5, 12).translate(e.x + ORIGIN.x, crown + 14.5, e.z + ORIGIN.z), new THREE.CylinderGeometry(12, 12, crown + 6, 20).translate(e.x + ORIGIN.x, crown / 2 - 3, e.z + ORIGIN.z)], 'stone');
    // the lantern's beam: a turning cone of light at night (update)
    // (a shader of its own: bright at the lantern and fading along it, soft at its edges (the more of the cone the
    // eye looks through, the brighter), and faded out round the camera: from inside the cone it's no wall of light)
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(1, 0.93, 0.76) } },
      vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vD;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vAlong = position.x / 260.0; vN = normalize(mat3(modelMatrix) * normal);
          vV = cameraPosition - w.xyz; vD = length(vV); vV /= vD; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uK; uniform vec3 uCol; varying float vAlong; varying vec3 vN; varying vec3 vV; varying float vD;
        void main() { float edge = pow(1.0 - abs(dot(normalize(vN), vV)), 2.5); float along = pow(max(0.0, 1.0 - vAlong), 2.2);
          float nearCam = smoothstep(8.0, 60.0, vD); gl_FragColor = vec4(uCol * uK * 0.22 * (1.0 - edge) * along * nearCam, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beamGeo = new THREE.ConeGeometry(14, 260, 32, 1, true).translate(0, -130, 0).rotateZ(Math.PI / 2);
    const beam = new THREE.Group();
    beam.position.copy(out.lighthouse.at).sub(ORIGIN);
    for (const s2 of [0, Math.PI]) { const m = new THREE.Mesh(beamGeo, beamMat); m.rotation.y = s2; beam.add(m); }
    beam.visible = false;
    root.add(beam);
    out.beam = { group: beam, mat: beamMat };
    beam.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
    void s;
  }
  yield;

  // ---- the shipyards: the halls beside the slips, a gantry over each slip, and in the middle one a tanker's hull
  // being fitted out (in primer, scaffolded)
  const hallWin = [];
  for (const h of PORT.sheds) {
    const w = h.x1 - h.x0, d = h.z1 - h.z0, H = 24 + (w > 150 ? 6 : 0), cx = (h.x0 + h.x1) / 2;
    batch.add('shutter', box(h.x0, 0, h.z0, h.x1, H, h.z1), null, 0xd4dadd); // (corrugated cladding)
    for (const [z0, z1] of [[h.z0 - 0.12, h.z0], [h.z1, h.z1 + 0.12]]) for (let x = h.x0 + 6; x < h.x1 - 2; x += 12) batch.add('paint', box(x - 0.3, 0, z0, x + 0.3, H, z1), null, 0x3f5a6e); // (its frame's columns)
    batch.add('paint', box(h.x0 - 0.15, H - 0.8, h.z0 - 0.15, h.x1 + 0.15, H, h.z1 + 0.15), null, 0x3f5a6e); // (the eaves)
    batch.add('concrete', box(h.x0 - 0.3, 0, h.z0 - 0.3, h.x1 + 0.3, 1.2, h.z1 + 0.3), null, 0xb0aaa0); // (its plinth)
    // a pitched roof, its ridge along the hall
    const rise = 6, mid = V(cx, H, (h.z0 + h.z1) / 2), A = V(h.x0, H, h.z0), B = V(h.x1, H, h.z0), C = V(h.x1, H, h.z1), D = V(h.x0, H, h.z1), R0 = V(cx, H + rise, h.z0), R1 = V(cx, H + rise, h.z1);
    batch.add('roofing', facing([[A, R0, R1], [A, R1, D], [B, C, R1], [B, R1, R0], [A, B, R0], [D, R1, C]], mid), null, 0x8a8f8c);
    // the doors: on the side facing the slip (the hall's east or west), a tall dark opening and its frame
    const slipSide = PORT.slips.find((s) => Math.abs(s.x0 - h.x1) < 40) ? 1 : -1, dx = slipSide > 0 ? h.x1 : h.x0;
    batch.add('dark', box(dx - 0.05, 1.2, h.z0 + 14, dx + 0.05 * slipSide + 0.2 * slipSide, H - 4, h.z0 + 14 + Math.min(60, d - 28)), null, 0x2a2c2e);
    batch.add('paint', box(dx - 0.4, H - 4, h.z0 + 12, dx + 0.4 * slipSide, H - 2.6, h.z0 + 16 + Math.min(60, d - 28)), null, 0xc8552e);
    // a strip of windows high up, lit at night
    for (const z of [h.z0 - 0.06, h.z1 + 0.06]) hallWin.push(box(h.x0 + 4, H - 6, z - 0.02, h.x1 - 4, H - 4.4, z + 0.02));
    solid(h.x0, 0, h.z0, h.x1, H, h.z1);
    solid(h.x0, H, h.z0, h.x1, H + rise * 0.6, h.z1);
  }
  for (const s of PORT.slips) {
    // the gantry: two legs either side of the slip, a box girder across it, 40 m up
    const z = s.z0 + 60, gy = 40;
    for (const x of [s.x0 - 3, s.x1 + 3]) { batch.add('metal', box(x - 1.4, 0, z - 1.4, x + 1.4, gy, z + 1.4), null, 0xd9b23a); solid(x - 1.4, 0, z - 1.4, x + 1.4, gy, z + 1.4); }
    batch.add('metal', box(s.x0 - 5, gy, z - 2.2, s.x1 + 5, gy + 4.5, z + 2.2), null, 0xd9b23a);
    batch.add('metal', box(s.x0 + 8, gy - 3, z - 3, s.x0 + 16, gy, z + 3), null, 0x3a3d40); // (its trolley)
    solid(s.x0 - 5, gy, z - 2.2, s.x1 + 5, gy + 4.5, z + 2.2);
    // the slip's walls: a concrete coping either side
    for (const x of [s.x0 - 1, s.x1 + 1]) batch.add('concrete', box(x - 1, -2, s.z0, x + 1, 0.4, s.z1), null, 0xb7b1a6);
  }
  {
    const s = PORT.slips[1], o = prop('tanker', { ownMaterials: true });
    o.traverse((m) => {
      if (!m.isMesh) return;
      const c = m.material.color, l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      m.material.color.setRGB(...(l > 0.5 ? [0.55, 0.56, 0.55] : [0.42, 0.16, 0.11])); // (red-oxide primer, grey where it'll be white)
      m.material.roughness = 0.85;
    });
    o.scale.setScalar(0.74);
    o.position.set((s.x0 + s.x1) / 2, WATER_Y - 6, (s.z0 + s.z1) / 2 + 6).add(ORIGIN);
    o.rotation.y = Math.PI; // (its bow to the basin)
    f.scene.add(o);
    o.updateMatrixWorld(true);
    const item = shipSolid(f, o, 11.3);
    tiers.add(o, { near: 700, far: 3500, shadow: 400, ratio: 0.1, flat: true });
    out.ships.push({ o, item, name: 'fitting' });
    // scaffolding up its sides: towers of tubes and boards
    const bx = (s.x0 + s.x1) / 2, half = 8.6;
    for (let z = s.z0 + 18; z < s.z1 - 14; z += 9) for (const side of [-1, 1]) {
      const x = bx + side * (half + 1.6);
      for (const dz of [-1.2, 1.2]) for (const dx of [-0.6, 0.6]) batch.add('metal', box(x + dx - 0.05, -2, z + dz - 0.05, x + dx + 0.05, 13, z + dz + 0.05), null, 0x9a9ea2);
      for (let y = 1; y < 13; y += 2) batch.add('roofing', box(x - 0.7, y, z - 1.4, x + 0.7, y + 0.06, z + 1.4), null, 0x7a6248);
    }
  }
  yield;

  // the masts' light on the ground at night: a pool round each (the city's lamp pools' material, city/Stream.js)
  if (ctx.stream?.pool && masts.length) {
    const pools = masts.map(([x, z]) => new THREE.PlaneGeometry(56, 56).rotateX(-Math.PI / 2).translate(x, 0.06, z));
    const m = new THREE.Mesh(mergeGeometries(pools, false), ctx.stream.pool);
    m.renderOrder = 1;
    m.visible = false;
    root.add(m);
    out.pools = m;
  }
  // the halls' high windows: dark glass by day, lit from inside at night (the night shift)
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.2, metalness: 0.1, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const m = new THREE.Mesh(mergeGeometries(hallWin.map((g) => g.index ? g.toNonIndexed() : g), false), mat);
    m.castShadow = false;
    root.add(m);
    out.lit.push({ mat, on: 1.6 });
  }
  // ---- all of it in
  root.add(batch.build(mats, { cell: 600 })); // (the quays and yards in 600 m cells: from across the city each 200 m one was a draw a material)
  placed.finish();
  yield* boxes.finish();
  // the beacons: small red lamps, one instanced mesh, lit at night
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.4 });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), mat, out.beacons.length);
    out.beacons.forEach((p, i) => im.setMatrixAt(i, _m.makeTranslation(p.x, p.y, p.z)));
    im.computeBoundingSphere();
    root.add(im);
    out.beaconMat = mat;
  }
  root.updateMatrixWorld(true);
  out.night = 0;
  out.update = (dt, cam, t) => {
    placed.update(cam);
    tiers.update(cam, dt);
    boxes.update(cam, dt);
    // the lighthouse's beam turning (a sweep every 10 s), the beacons slow-blinking
    if (out.beam.group.visible) out.beam.group.rotation.y = t * 0.63;
    out.beaconMat.emissiveIntensity = out.night * (Math.sin(t * 2.1) > 0.2 ? 3 : 0.15);
    // the tug riding the swell where it's tied
    for (const s of out.ships) if (s.bob) { s.o.position.y = s.bob.y + Math.sin(t * 0.7 + s.bob.ph) * 0.12; s.o.rotation.z = Math.sin(t * 0.55) * 0.012; }
  };
  out.setNight = (k) => {
    out.night = k;
    for (const l of out.lit) l.mat.emissiveIntensity = k * l.on;
    out.beam.group.visible = k > 0.05;
    if (out.pools) out.pools.visible = k > 0.01;
    out.beam.mat.uniforms.uK.value = k;
  };
  void waterAt;
  return out;
}
