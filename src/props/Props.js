import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Downloaded models (see CREDITS.md), built by tools/build-props.mjs into public/models/props:
// each faces +Z in metres, standing on y = 0. A part loads the set it needs first
// (`await loadProps(names)`); `prop(name)` then hands out copies, synchronously.
const loader = new GLTFLoader();
const pending = new Map(), ready = new Map();

export function loadProps(names) {
  return Promise.all(names.map((n) => {
    if (!pending.has(n)) pending.set(n, loader.loadAsync(`/models/props/${n}.glb`).then((g) => { prepare(g.scene); ready.set(n, g.scene); }));
    return pending.get(n);
  }));
}

export const hasProp = (name) => ready.has(name);

// A copy of a loaded prop. Meshes and materials are shared with the other copies unless
// `ownMaterials` (when this copy will be recoloured).
export function prop(name, { ownMaterials = false } = {}) {
  const src = ready.get(name);
  if (!src) throw new Error(`prop "${name}" is not loaded`);
  const o = src.clone(true);
  if (ownMaterials) {
    const copies = new Map();
    o.traverse((m) => { if (m.isMesh) m.material = copies.get(m.material) ?? copies.set(m.material, m.material.clone()).get(m.material); });
  }
  return o;
}

// Every mesh under `root` whose name passes `test`.
export function meshes(root, test) {
  const out = [];
  root.traverse((o) => { if (o.isMesh && test(o.name)) out.push(o); });
  return out;
}

// Bounds of some meshes in `space`'s frame.
export function boundsIn(space, list) {
  space.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert(), b = new THREE.Box3(), m = new THREE.Box3();
  for (const o of list) {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.union(m.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
  }
  return b;
}

// Re-parent `list` under a new group at `at` (in `space`'s frame), keeping where they are: a pivot
// for a part that turns about its own hub or hinge.
export function pivot(space, list, at) {
  const p = new THREE.Group();
  p.position.copy(at);
  space.add(p);
  space.updateMatrixWorld(true);
  for (const o of list) p.attach(o);
  return p;
}

// One part of a prop kit as an object of its own, standing at its origin (the centre of its base):
// a cone out of a pack, a lamp post out of a street kit. Shares the kit's meshes and materials.
export function piece(name, test) {
  const kit = prop(name);
  kit.updateMatrixWorld(true);
  const src = meshes(kit, (n) => test.test(n));
  const b = boundsIn(kit, src), c = b.getCenter(new THREE.Vector3());
  const g = new THREE.Group(), at = new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z);
  for (const m of src) {
    const o = new THREE.Mesh(m.geometry, m.material);
    o.castShadow = m.castShadow;
    o.receiveShadow = true;
    o.matrixAutoUpdate = false;
    o.matrix.copy(at).multiply(m.matrixWorld);
    g.add(o);
  }
  return g;
}

function prepare(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // leaves exported as blended (sorted per object, no depth: the palms popped in front of each
    // other as the car went by) are cut-outs instead, their edges smoothed by the MSAA
    for (const m of mats) if (m.transparent && m.map && /frond|leaf|leaves|foliage/i.test(m.name)) Object.assign(m, { transparent: false, depthWrite: true, alphaTest: 0.5, alphaToCoverage: true });
    const clear = mats.some((m) => m.transparent);
    o.castShadow = !clear;
    o.receiveShadow = true;
    for (const m of mats) {
      // Sketchfab exports often carry mirror-smooth glass, lenses and badges (roughness 0): under the
      // desert sun their highlights reach thousands and the bloom turns every edge into a white line
      if (!m.roughnessMap) m.roughness = Math.max(m.roughness, m.transparent ? 0.12 : 0.2);
      if (m.transparent) m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.6);
      if (m.transparent) m.depthWrite = false; // glass: sorted, never hiding what's behind it
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m[k]) m[k].anisotropy = 8;
    }
  });
}
