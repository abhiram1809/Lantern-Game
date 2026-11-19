// Drawing by distance: what's too far from the camera to matter isn't drawn (the user, 2026-11-18:
// "once Hal goes 200-300 meters away from the place there is no need to render everything"). Each
// object has a distance it's drawn within; it comes back as the camera returns. Checked a few times a
// second, and at once after a cut. Only drawing is affected: bodies, colliders and Smash's items stay as
// they are (a prop knocked about out of sight still lands where it should).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';

let simplifier = false;
MeshoptSimplifier.ready.then(() => (simplifier = MeshoptSimplifier.supported));

const _p = new THREE.Vector3(), _m = new THREE.Matrix4();

// One mesh per material for everything drawn under `root` (in root's frame): a downloaded prop is
// often dozens of small parts (a parked car 54, a power pole's insulators 19), each its own draw call.
// Hidden parts are left out; a part with several materials is kept as it is.
// The merged geometry is shared: every prop put together the same way (the same parts, where they
// are, which of its materials each wears) gets the one copy, each instance with its own materials
// (sixty parking meters each made a copy of their own: 400 MB of geometry in the block). `simplify`
// (a share of the triangles to keep, for a car seen from far off) runs meshoptimizer on the copy.
const shared = new Map(); // signature → { slots: [{ geo, slot }], refs }
export function mergeByMaterial(root, { simplify = 0 } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = [], keep = [];
  root.traverseVisible((m) => {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh) return;
    if (Array.isArray(m.material)) keep.push(m); else parts.push(m);
  });
  // its materials in the order they're met, and the signature: each part, its material's place, where it is
  const mats = [], slotOf = new Map(), cast = [];
  let sig = `${simplify}|`;
  for (const m of parts) {
    if (!slotOf.has(m.material)) { slotOf.set(m.material, mats.length); mats.push(m.material); cast.push(false); }
    const k = slotOf.get(m.material);
    cast[k] ||= m.castShadow;
    _m.multiplyMatrices(inv, m.matrixWorld);
    sig += `${m.geometry.uuid}:${k}:${_m.elements.map((v) => v.toFixed(3)).join(',')};`;
  }
  let entry = shared.get(sig);
  if (!entry) {
    const groups = mats.map(() => []);
    for (const m of parts) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      groups[slotOf.get(m.material)].push(g);
    }
    const slots = [];
    groups.forEach((geos, slot) => {
      const names = ['position', 'normal', 'uv'].filter((n) => geos.every((g) => g.attributes[n]));
      for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
      let geo = mergeGeometries(geos, false);
      if (!geo) return;
      if (simplify && simplifier) geo = simplified(geo, simplify);
      geo.computeBoundingSphere();
      slots.push({ geo, slot });
    });
    entry = { slots, refs: 0 };
    shared.set(sig, entry);
  }
  entry.refs++;
  const out = new THREE.Group();
  out.userData.sig = sig;
  for (const { geo, slot } of entry.slots) {
    const mesh = new THREE.Mesh(geo, mats[slot]);
    mesh.castShadow = cast[slot];
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const m of keep) { const c = m.clone(); c.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld)); c.matrixAutoUpdate = true; out.add(c); }
  return out;
}
// done with a merged copy: its geometry goes once nothing else uses it
export function releaseMerged(group) {
  const entry = shared.get(group?.userData.sig);
  if (!entry || --entry.refs > 0) return;
  for (const { geo } of entry.slots) geo.dispose();
  shared.delete(group.userData.sig);
}
// a share of a mesh's triangles (welded first: the merge leaves every triangle its own corners; the
// simplifier keeps the seams where normals or UVs part)
function simplified(geo, ratio) {
  const welded = mergeVertices(geo, 1e-4), pos = welded.attributes.position.array, index = welded.index.array;
  const target = Math.max(3, Math.floor((index.length / 3) * ratio) * 3);
  const [out] = MeshoptSimplifier.simplify(index instanceof Uint32Array ? index : new Uint32Array(index), pos, 3, target, 0.01);
  if (out.length >= index.length) return welded;
  welded.setIndex(new THREE.BufferAttribute(out, 1));
  return welded;
}

// a prop that never comes apart drawn as its merged self
export function flatten(root) {
  if (root.isMesh) return root; // (one mesh already)
  const merged = mergeByMaterial(root);
  for (const c of [...root.children]) root.remove(c);
  root.add(merged);
  return root;
}

export class Lod {
  constructor() {
    this.items = [];
    this.t = 1;
    this.last = new THREE.Vector3(1e9, 1e9, 1e9);
    this.shown = 0;
  }

  // within `dist` of the camera the object is drawn; `box` (world space) measures to a big object's
  // nearest point instead of its origin; `moves`, for a loose prop, re-reads its position each check
  // (`shadow`: within it, it casts shadows; `proxy`: a car, drawn merged beyond `near`)
  add(object, dist, { box = null, moves = false, shadow = Infinity } = {}) {
    if (!object) return;
    const pos = box ? null : object.getWorldPosition(new THREE.Vector3());
    this.items.push({ object, d: dist, box, pos, moves, on: true, sd: shadow, cast: true });
  }

  // A car: within `near` its own parts (doors, glass, wheels, dents); beyond, a merged copy (10 or so
  // draw calls, not 54), and beyond `low` a copy simplified to a third of its triangles; both made again
  // if the car has been knocked about since, and shared with every car of its model that hasn't. `item`
  // is its Smash item. (its parts go under one group that's switched as a whole: switching the parts
  // themselves would bring back a pane Smash had shattered)
  addCar(car, dist, item, { near = 15, low = 45, shadow = 35 } = {}) {
    const detail = new THREE.Group();
    detail.name = 'detail';
    for (const c of [...car.children]) detail.add(c);
    car.add(detail);
    this.items.push({ object: car, d: dist, moves: true, on: true, sd: shadow, cast: true, car: { near, low, item, proxy: null, lowProxy: null, detail, tier: 0, health: item?.health } });
  }

  update(dt, camera) {
    this.t += dt;
    const cam = camera.position, jumped = cam.distanceToSquared(this.last) > 2500; // a cut, or a jump across the valley
    if (this.t < 0.2 && !jumped) return;
    this.t = 0;
    this.merges = 0; // (a car's copies made two a check at most: the first check made sixty, one frame)
    this.last.copy(cam);
    let shown = 0;
    for (const it of this.items) {
      let d;
      if (it.box) d = it.box.distanceToPoint(cam);
      else d = (it.moves ? it.object.getWorldPosition(_p) : it.pos).distanceTo(cam);
      // a tenth more to put it away than to bring it back: hovering at the edge doesn't flicker it
      const on = it.on ? d < it.d * 1.1 : d < it.d;
      if (on !== it.on) { it.on = on; it.object.visible = on; }
      if (!on) continue;
      shown++;
      const cast = d < it.sd;
      if (cast !== it.cast) { it.cast = cast; it.object.traverse((m) => { if (m.isMesh) m.castShadow = cast; }); }
      if (it.car) this.carDetail(it, d);
    }
    this.shown = shown;
  }

  carDetail(it, d) {
    const c = it.car;
    // 0 its parts, 1 the merged copy, 2 the simplified one (a tenth's margin back toward the nearer)
    const tier = d > c.low * (c.tier === 2 ? 0.9 : 1) ? 2 : d > c.near * (c.tier >= 1 ? 0.9 : 1) ? 1 : 0;
    // dented or burnt while it showed a copy: the copies are made again
    const hurt = c.item && c.item.health !== c.health;
    if (tier === c.tier && !(hurt && tier > 0)) return;
    if (hurt) {
      for (const k of ['proxy', 'lowProxy']) if (c[k]) { it.object.remove(c[k]); releaseMerged(c[k]); c[k] = null; }
      c.health = c.item.health;
    }
    c.tier = tier;
    if (tier > 0) {
      const k = tier === 2 ? 'lowProxy' : 'proxy';
      if (!c[k]) {
        if (this.merges++ >= 2) { c.tier = -1; return; } // (its turn comes at a later check)
        c.detail.visible = true;
        for (const o of [c.proxy, c.lowProxy]) if (o) o.visible = false;
        c[k] = mergeByMaterial(c.detail, { simplify: tier === 2 ? 0.33 : 0 });
        it.object.add(c[k]); // (merged in the detail group's frame, which is the car's)
      }
      c.detail.visible = false;
      c[k].visible = true;
      c[k].traverse((m) => { if (m.isMesh) m.castShadow = it.cast; });
      const other = tier === 2 ? c.proxy : c.lowProxy;
      if (other) other.visible = false;
    } else {
      c.detail.visible = true;
      for (const o of [c.proxy, c.lowProxy]) if (o) o.visible = false;
    }
  }
}
