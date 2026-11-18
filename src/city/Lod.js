// Drawing by distance: what's too far from the camera to matter isn't drawn (the user, 2026-11-18:
// "once Hal goes 200-300 meters away from the place there is no need to render everything"). Each
// object has a distance it's drawn within; it comes back as the camera returns. Checked a few times a
// second, and at once after a cut. Only drawing is affected: bodies, colliders and Smash's items stay as
// they are (a prop knocked about out of sight still lands where it should).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _p = new THREE.Vector3(), _m = new THREE.Matrix4();

// One mesh per material for everything drawn under `root` (in root's frame): a downloaded prop is
// often dozens of small parts (a parked car 54, a power pole's insulators 19), each its own draw call.
// Hidden parts are left out; a part with several materials is kept as it is.
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), keep = [];
  root.traverseVisible((m) => {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh) return;
    if (Array.isArray(m.material)) { keep.push(m); return; }
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    const e = groups.get(m.material) ?? groups.set(m.material, { geos: [], cast: false }).get(m.material);
    e.geos.push(g);
    e.cast ||= m.castShadow;
  });
  const out = new THREE.Group();
  for (const [mat, { geos, cast }] of groups) {
    const names = ['position', 'normal', 'uv'].filter((n) => geos.every((g) => g.attributes[n]));
    for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const m of keep) { const c = m.clone(); c.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld)); c.matrixAutoUpdate = true; out.add(c); }
  return out;
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
  // draw calls, not 54), made again if the car has been knocked about since. `item` is its Smash item.
  // (its parts go under one group that's switched as a whole: switching the parts themselves would
  // bring back a pane Smash had shattered)
  addCar(car, dist, item, { near = 15, shadow = 120 } = {}) {
    const detail = new THREE.Group();
    detail.name = 'detail';
    for (const c of [...car.children]) detail.add(c);
    car.add(detail);
    this.items.push({ object: car, d: dist, moves: true, on: true, sd: shadow, cast: true, car: { near, item, proxy: null, detail, far: false, health: item?.health } });
  }

  update(dt, camera) {
    this.t += dt;
    const cam = camera.position, jumped = cam.distanceToSquared(this.last) > 2500; // a cut, or a jump across the valley
    if (this.t < 0.2 && !jumped) return;
    this.t = 0;
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
    const c = it.car, far = c.far ? d > c.near * 0.9 : d > c.near;
    // dented or burnt while it showed its copy: the copy is made again
    if (far && c.far && c.item && c.item.health !== c.health) c.far = false;
    if (far === c.far) return;
    c.far = far;
    if (far) {
      const hurt = c.item && c.item.health !== c.health;
      if (!c.proxy || hurt) {
        if (c.proxy) { it.object.remove(c.proxy); c.proxy.traverse((m) => m.geometry?.dispose()); c.proxy = null; }
        c.detail.visible = true;
        c.proxy = mergeByMaterial(c.detail);
        c.health = c.item?.health;
        it.object.add(c.proxy); // (merged in the detail group's frame, which is the car's)
      }
      c.detail.visible = false;
      c.proxy.visible = true;
      c.proxy.traverse((m) => { if (m.isMesh) m.castShadow = it.cast; });
    } else {
      c.detail.visible = true;
      if (c.proxy) c.proxy.visible = false;
    }
  }
}
