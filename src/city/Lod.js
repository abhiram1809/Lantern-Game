// Drawing by distance: what's too far from the camera to matter isn't drawn (the user, 2026-11-18:
// "once Hal goes 200-300 meters away from the place there is no need to render everything"). Each
// object has a distance it's drawn within; it comes back as the camera returns. Checked a few times a
// second, and at once after a cut. Only drawing is affected: bodies, colliders and Smash's items stay as
// they are (a prop knocked about out of sight still lands where it should).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { averageColour } from '../engine/Ktx2.js';

let simplifier = false;
MeshoptSimplifier.ready.then(() => (simplifier = MeshoptSimplifier.supported));

const _p = new THREE.Vector3(), _m = new THREE.Matrix4();
const PROXIES = ['proxy', 'lowProxy', 'flatProxy']; // (a car's copies, tiers 1 to 3)

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
// A car far off as one mesh (2026-11-23: the street's cars were 400 of its 1,300 draw calls): every part
// but its lamps welded together and simplified to a fifth, each part's colour in its vertices (its
// material's, times its texture's average), under one material all of them share; its lamps (`keep`) kept
// as they are, since they light at night. Shared like a merged copy by everything that matches it.
const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, name: 'farCar' });
const averages = new WeakMap(), _c = new THREE.Color();
export function average(tex) {
  if (!tex?.image) return null;
  if (averages.has(tex)) return averages.get(tex);
  if (tex.isCompressedTexture) { // (the KTX2 ones: engine/Ktx2.js, kept once it's in)
    const c = averageColour(tex);
    if (c || tex.mipmaps?.length) averages.set(tex, c);
    return c;
  }
  let c = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 8;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(tex.image, 0, 0, 8, 8);
    const d = g.getImageData(0, 0, 8, 8).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (n) c = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
  } catch { /* an image the canvas can't read: its material's colour alone */ }
  averages.set(tex, c);
  return c;
}
export function flatCopy(root, keep = new Set(), { simplify = 0.2, material = flatMat } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = [], kept = [];
  root.traverseVisible((m) => {
    if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh) return;
    (keep.has(m) || Array.isArray(m.material) ? kept : parts).push(m);
  });
  const colour = (mat) => {
    _c.copy(mat.color ?? _c.setRGB(1, 1, 1));
    const a = average(mat.map);
    if (a) _c.multiply(a);
    if (mat.transparent) _c.multiplyScalar(0.3); // (glass: the dark of the car's inside)
    return _c;
  };
  let sig = `flat${simplify}|`;
  for (const m of parts) sig += `${m.geometry.uuid}:${colour(m.material).getHexString()}:${_m.multiplyMatrices(inv, m.matrixWorld).elements.map((v) => v.toFixed(3)).join(',')};`;
  let entry = shared.get(sig);
  if (!entry) {
    const geos = parts.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
      g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      const k = colour(m.material), n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    let geo = geos.length ? mergeGeometries(geos, false) : null;
    if (geo && simplifier) geo = simplified(geo, simplify);
    geo?.computeBoundingSphere();
    entry = { slots: geo ? [{ geo }] : [], refs: 0 };
    shared.set(sig, entry);
  }
  entry.refs++;
  const out = new THREE.Group();
  out.userData.sig = sig;
  for (const { geo } of entry.slots) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
  }
  // its lamps, one mesh for each of their materials (what Traffic lights at night is the material)
  const byMat = new Map();
  for (const m of kept) {
    if (Array.isArray(m.material)) { const c = m.clone(); c.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld)); c.matrixAutoUpdate = true; out.add(c); continue; }
    (byMat.get(m.material) ?? byMat.set(m.material, []).get(m.material)).push(m);
  }
  for (const [mat, list] of byMat) {
    const geos = list.map((m) => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
    const names = ['position', 'normal', 'uv'].filter((n) => geos.every((g) => g.attributes[n]));
    for (const g of geos) for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.own = true; // (made for this copy alone: released with it)
    out.add(mesh);
  }
  return out;
}

// The cars far off, all of a model in one instanced draw (the perf pass, 2026-11-23: each car clones its own
// materials, so the street's parked cars were 385 draw calls and its traffic 208). A model's shape is merged and
// simplified once, every colour in its vertices but the paint's (`aPaint` marks it: each car's own colour per
// instance) and its lamps flagged front or back (`aLamp`: lit per car from its lamps' materials, so headlights,
// brake lights and alarms still show). Each frame the cars at their far tier are written in.
const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, name: 'farCars' });
farMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPaint; attribute float aLamp; attribute vec2 aLit; varying vec3 vLampEm;')
    .replace('#include <color_vertex>', `vColor = vec4(1.0); // (r187's vColor is a vec4)
      vColor.rgb *= color.rgb;
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aPaint);
      #endif
      vLampEm = aLamp > 1.5 ? vec3(1.0, 0.08, 0.04) * aLit.y : aLamp > 0.5 ? vec3(1.0, 0.9, 0.72) * aLit.x : vec3(0.0);`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLampEm;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vLampEm;');
};
farMat.customProgramCacheKey = () => 'farCars';
const _w = new THREE.Vector3();
const LO_FAR = 90; // (metres: past it a far car is its lighter copy)
class FarCars {
  // (`casting`: the cars within their shadow distance, near or far: their shadows from their model's shape, a
  // shadow-only copy per model, not from their own parts, 75 shadow draws and 168 k triangles in the street)
  constructor(scene) { this.scene = scene; this.models = new Map(); this.of = new Map(); this.casting = new Set(); }
  shadow(it, on) { if (on) this.casting.add(it); else this.casting.delete(it); }
  modelFor(it) { if (it.farModel === undefined) it.farModel = this.model(it); return it.farModel; }
  // a car's model: its shape merged (in the car's frame), keyed by what it's made of
  model(it) {
    const root = it.car.detail, car = it.object, paint = car.userData.paint, lamps = new Set(it.car.item?.lamps ?? []);
    car.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(car.matrixWorld).invert(), parts = [];
    // (its parts as they are, whether its detail group is shown just now or not: a pane Smash shattered stays out)
    for (const ch of root.children) ch.traverseVisible((m) => { if (m.isMesh && !m.isSkinnedMesh && !m.isInstancedMesh && !Array.isArray(m.material)) parts.push(m); });
    if (!parts.length) return null;
    const col = (m) => {
      if (m.material === paint) return _c.setRGB(1, 1, 1);
      _c.copy(m.material.color ?? _c.setRGB(1, 1, 1));
      const a = average(m.material.map);
      if (a) _c.multiply(a);
      if (m.material.transparent) _c.multiplyScalar(lamps.has(m) ? 0.6 : 0.3);
      return _c;
    };
    // (by its model and its parts as they stand, not their geometry: each car owns its geometry, to be dented, so
    // no two matched and every far car was a draw of its own; a dent doesn't show from 24 m)
    // (nor where its parts stand: its wheels turn and steer, no two cars' alike)
    let sig = `far|${car.userData.model ?? ''}|`;
    for (const m of parts) sig += `${m.name}:${m.material === paint ? 'P' : col(m).getHexString()};`;
    let model = this.models.get(sig);
    if (model) return model;
    const geos = parts.map((m) => {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
      g.applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld));
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count, k = col(m), c = new Float32Array(n * 3), pt = new Float32Array(n), lp = new Float32Array(n);
      g.computeBoundingBox();
      const front = lamps.has(m) ? (g.boundingBox.min.z + g.boundingBox.max.z > 0 ? 1 : 2) : 0;
      for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; pt[i] = m.material === paint ? 1 : 0; lp[i] = front; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      g.setAttribute('aPaint', new THREE.BufferAttribute(pt, 1));
      g.setAttribute('aLamp', new THREE.BufferAttribute(lp, 1));
      return g;
    });
    let geo = mergeGeometries(geos, false);
    if (geo && simplifier) geo = simplified(geo, 0.3);
    if (!geo) return null;
    geo.computeBoundingSphere();
    // (and past LO_FAR a far lighter copy of it: a car 90 m off is a few dozen pixels, and the residential streets'
    // parked cars (city/Homes.js) put sixty more of them in Hal's street's view at ten thousand triangles each)
    let lo = simplifier ? simplified(geo, 0.08, 0.04) : null;
    if (lo) lo.computeBoundingSphere();
    model = { sig, geo, lo, cars: new Set(), mesh: null, cap: 0 };
    this.models.set(sig, model);
    return model;
  }
  grow(model, cap) {
    for (const m of [model.mesh, model.shade, model.loMesh]) if (m) { m.removeFromParent(); m.dispose(); }
    const inst = (src, lit) => {
      const geo = new THREE.BufferGeometry();
      for (const [n, a] of Object.entries(src.attributes)) geo.setAttribute(n, a);
      geo.setIndex(src.index);
      geo.boundingSphere = src.boundingSphere;
      geo.setAttribute('aLit', lit);
      const mesh = new THREE.InstancedMesh(geo, farMat, cap);
      mesh.setColorAt(0, _c.setRGB(1, 1, 1));
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      return mesh;
    };
    model.lit = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    const mesh = (model.mesh = inst(model.geo, model.lit));
    if (model.lo) { model.loLit = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); model.loMesh = inst(model.lo, model.loLit); this.scene.add(model.loMesh); }
    const shade = (model.shade = new THREE.InstancedMesh(model.geo, farMat, cap));
    shade.frustumCulled = false;
    shade.castShadow = true;
    shade.layers.set(1); // (the sun's shadow camera sees it, the camera doesn't)
    shade.count = 0;
    model.cap = cap;
    this.scene.add(mesh, shade);
  }
  // (true, or 'built' when its model had to be made: the only costly part)
  show(it) {
    if (this.of.has(it)) return true;
    const had = this.models.size, model = this.modelFor(it);
    if (!model) return false;
    model.cars.add(it);
    this.of.set(it, model);
    if (model.cars.size > model.cap) this.grow(model, Math.max(8, model.cap * 2));
    return this.models.size > had ? 'built' : true;
  }
  hide(it, hurt = false) { if (hurt) it.farModel = undefined; const model = this.of.get(it); if (!model) return; model.cars.delete(it); this.of.delete(it); }
  // every frame: where each far car is, its paint, its lamps
  update() {
    // the shadows: every casting car's model, its copy where the car is
    for (const model of this.models.values()) model.sn = 0;
    for (const it of this.casting) {
      const o = it.object;
      if (!o.visible || !o.parent) continue;
      const model = this.modelFor(it);
      if (!model) continue;
      if (!model.shade || model.sn >= model.cap) this.grow(model, Math.max(8, (model.cap || 4) * 2));
      o.updateWorldMatrix(true, false);
      model.shade.setMatrixAt(model.sn++, o.matrixWorld);
    }
    for (const model of this.models.values()) {
      if (!model.shade) continue;
      model.shade.count = model.sn;
      model.shade.visible = model.sn > 0;
      if (model.sn) model.shade.instanceMatrix.needsUpdate = true;
    }
    const cam = this.cam;
    for (const model of this.models.values()) {
      const mesh = model.mesh;
      if (!mesh) continue;
      let n = 0, m = 0;
      for (const it of model.cars) {
        const o = it.object;
        if (!o.visible || !o.parent) continue;
        o.updateWorldMatrix(true, false);
        // (near enough, the far copy; beyond LO_FAR, the lighter one)
        const lo = model.loMesh && cam && _w.setFromMatrixPosition(o.matrixWorld).distanceToSquared(cam) > LO_FAR * LO_FAR;
        const into = lo ? model.loMesh : mesh, k = lo ? m++ : n++;
        into.setMatrixAt(k, o.matrixWorld);
        into.setColorAt(k, o.userData.paint?.color ?? _c.setRGB(0.6, 0.6, 0.6));
        let head = 0, tail = 0;
        for (const l of it.car.item?.lamps ?? []) {
          if (!l.visible || !l.material.emissive) continue;
          const e = l.material.emissiveIntensity * (l.material.emissive.r + l.material.emissive.g) * 0.5;
          if (e <= 0) continue; // (a parked car's dark lamps: not looked for, every frame, every car)
          l.getWorldPosition(_w);
          if (o.worldToLocal(_w).z > 0) head = Math.max(head, e); else tail = Math.max(tail, e);
        }
        (lo ? model.loLit : model.lit).setXY(k, head, tail);
      }
      for (const [into, count, lit] of [[mesh, n, model.lit], [model.loMesh, m, model.loLit]]) {
        if (!into) continue;
        into.count = count;
        into.visible = count > 0;
        if (!count) continue;
        into.instanceMatrix.needsUpdate = true;
        if (into.instanceColor) into.instanceColor.needsUpdate = true;
        lit.needsUpdate = true;
      }
    }
  }
}

// Copies of one shape and material drawn instanced, each within its own distance of the camera (the perf pass: a
// block's instanced props were one mesh for all of a 500 m street, 920 k triangles drawn from anywhere in it), and
// its shadow from a second, shadow-only copy (layer 1: the sun's shadow camera sees it, the camera doesn't) of those
// within `shadow`. `list`: [{ M (in `parent`'s frame), pos (world), gone }]; one `gone` is left out from then on.
export class InstanceSet {
  constructor(parent, geo, mat, list, { dist, shadow = 0, cast = true }) {
    Object.assign(this, { list, dist, sd: cast ? shadow : 0 });
    const n = list.length;
    this.main = new THREE.InstancedMesh(geo, mat, n);
    this.main.castShadow = false;
    this.main.receiveShadow = true;
    parent.add(this.main);
    if (this.sd > 0) {
      this.shade = new THREE.InstancedMesh(geo, mat, n);
      this.shade.castShadow = true;
      this.shade.layers.set(1);
      parent.add(this.shade);
    }
    for (const m of [this.main, this.shade]) if (m) { m.count = 0; m.visible = false; m.matrixAutoUpdate = false; m.updateMatrixWorld(true); }
    this.at = new THREE.Vector3(1e9, 0, 0);
    this.dirty = true;
  }
  update(cam) {
    if (!this.dirty && cam.distanceToSquared(this.at) < 4) return;
    this.dirty = false;
    this.at.copy(cam);
    const d2 = this.dist * this.dist, s2 = this.sd * this.sd;
    let a = 0, b = 0;
    for (const e of this.list) {
      if (e.gone) continue;
      const d = e.pos.distanceToSquared(cam);
      if (d < d2) this.main.setMatrixAt(a++, e.M);
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

// Many shapes that share a material drawn in one call (the perf pass, 2026-11-23: Hal's block's props were 182
// instanced meshes, one for each shape and material, 89 of them in the street's view; three.js's BatchedMesh draws
// them all with one multi-draw). `groups`: [{ geo, list: [{ M, pos, gone }], dist, shadow, cast }]; each copy shown
// within its group's distance (checked when the camera's moved a couple of metres, not culled per copy each frame:
// thirteen thousand of them), the batch casting shadows if any group does.
const _plain = new Map();
function plainGeometry(geo) {
  let out = _plain.get(geo);
  if (out) return out;
  out = new THREE.BufferGeometry();
  const P = geo.attributes.position, n = P.count, N = geo.attributes.normal, U = geo.attributes.uv;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i);
    if (N) { nor[i * 3] = N.getX(i); nor[i * 3 + 1] = N.getY(i); nor[i * 3 + 2] = N.getZ(i); }
    if (U) { uv[i * 2] = U.getX(i); uv[i * 2 + 1] = U.getY(i); }
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (!N) out.computeVertexNormals();
  const idx = geo.index ? Uint32Array.from({ length: geo.index.count }, (_, i) => geo.index.getX(i)) : Uint32Array.from({ length: n }, (_, i) => i);
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  _plain.set(geo, out);
  return out;
}
export class BatchSet {
  constructor(parent, material, groups) {
    this.groups = groups;
    let inst = 0, verts = 0, idx = 0;
    for (const g of groups) { g.plain = plainGeometry(g.geo); inst += g.list.length; verts += g.plain.attributes.position.count; idx += g.plain.index.count; }
    const make = () => {
      const bm = new THREE.BatchedMesh(inst, verts, idx, material);
      bm.perObjectFrustumCulled = false;
      bm.sortObjects = false;
      bm.frustumCulled = false;
      return bm;
    };
    // the batch, and its shadows from a second, shadow-only one (layer 1) of the copies within their shadow distance
    const bm = (this.mesh = make()), casting = groups.filter((g) => g.cast && g.shadow > 0);
    bm.castShadow = false;
    bm.receiveShadow = true;
    const sh = (this.shade = casting.length ? make() : null);
    if (sh) { sh.castShadow = true; sh.layers.set(1); }
    for (const g of groups) {
      const id = bm.addGeometry(g.plain), sid = sh && casting.includes(g) ? sh.addGeometry(g.plain) : -1;
      for (const e of g.list) {
        e.iid = bm.addInstance(id);
        bm.setMatrixAt(e.iid, e.M);
        if (e.color) bm.setColorAt(e.iid, e.color); // (a copy's own colour over its material's white: the doors' frames)
        bm.setVisibleAt(e.iid, false);
        e.shown = false;
        if (sid >= 0) { e.sid = sh.addInstance(sid); sh.setMatrixAt(e.sid, e.M); sh.setVisibleAt(e.sid, false); e.cast = false; }
      }
    }
    for (const m of [bm, sh]) if (m) { parent.add(m); m.updateMatrixWorld(true); m.matrixAutoUpdate = false; }
    this.at = new THREE.Vector3(1e9, 0, 0);
    this.dirty = true;
  }
  update(cam) {
    if (!this.dirty && cam.distanceToSquared(this.at) < 4) return;
    this.dirty = false;
    this.at.copy(cam);
    let any = false, anyCast = false;
    for (const g of this.groups) {
      const d2 = g.dist * g.dist, s2 = g.shadow * g.shadow;
      for (const e of g.list) {
        const d = e.gone ? Infinity : e.pos.distanceToSquared(cam), v = d < d2;
        if (v !== e.shown) { e.shown = v; this.mesh.setVisibleAt(e.iid, v); }
        any ||= v;
        if (e.sid !== undefined) { const c = d < s2; if (c !== e.cast) { e.cast = c; this.shade.setVisibleAt(e.sid, c); } anyCast ||= c; }
      }
    }
    this.mesh.visible = any;
    if (this.shade) this.shade.visible = anyCast;
  }
  // a copy moved (a door swinging): M in the batch's frame
  move(e, M) {
    e.M.copy(M);
    this.mesh.setMatrixAt(e.iid, M);
    if (e.sid !== undefined) this.shade.setMatrixAt(e.sid, M);
  }
}

// done with a merged copy: its geometry goes once nothing else uses it
export function releaseMerged(group) {
  group?.traverse((m) => { if (m.userData.own) m.geometry.dispose(); });
  const entry = shared.get(group?.userData.sig);
  if (!entry || --entry.refs > 0) return;
  for (const { geo } of entry.slots) geo.dispose();
  shared.delete(group.userData.sig);
}
// a share of a mesh's triangles (welded first: the merge leaves every triangle its own corners; the
// simplifier keeps the seams where normals or UVs part)
function simplified(geo, ratio, error = 0.01) {
  const welded = mergeVertices(geo, 1e-4), pos = welded.attributes.position.array, index = welded.index.array;
  const target = Math.max(3, Math.floor((index.length / 3) * ratio) * 3);
  const [out] = MeshoptSimplifier.simplify(index instanceof Uint32Array ? index : new Uint32Array(index), pos, 3, target, error);
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
  // (`scene`: where the far cars' batches go, FarCars)
  constructor(scene = null) {
    this.items = [];
    this.farCars = scene ? new FarCars(scene) : null;
    this.of = new Map(); // object → its item
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
    this.of.set(object, this.items[this.items.length - 1]);
  }

  // Something else showed or hid it (Traffic, taking a car out of its pool or putting it back: a car sent
  // off 300 m away stayed drawn whole, its 69 parts, as the check only acted when its own answer changed):
  // the next check sets it again. (`userData.away`: put away, not drawn at any distance)
  recheck(object) { const it = this.of.get(object); if (it) it.on = null; }

  // A car: within `near` its own parts (doors, glass, wheels, dents); beyond, a merged copy (10 or so
  // draw calls, not 54), beyond `low` a copy simplified to a third of its triangles, and beyond `far` one
  // mesh coloured in its vertices and its lamps (flatCopy: two or three); all made again if the car has
  // been knocked about since, and shared with every car of its model that hasn't. `item` is its Smash
  // item. (its parts go under one group that's switched as a whole: switching the parts themselves would
  // bring back a pane Smash had shattered)
  addCar(car, dist, item, { near = 15, low = 45, far = 24, shadow = 35 } = {}) {
    const detail = new THREE.Group();
    detail.name = 'detail';
    for (const c of [...car.children]) detail.add(c);
    car.add(detail);
    this.items.push({ object: car, d: dist, moves: true, on: true, sd: shadow, cast: true, car: { near, low, far, item, proxy: null, lowProxy: null, flatProxy: null, detail, tier: 0, health: item?.health } });
    this.of.set(car, this.items[this.items.length - 1]);
  }

  // Something drawn by distance put away for good (a streamed block's parked car, its block going: Stream.js
  // disposeCell): out of the checks, out of the far cars' batch and their shadows, its copies released
  remove(object) {
    const it = this.of.get(object);
    if (!it) return;
    this.of.delete(object);
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
    if (!it.car) return;
    this.farCars?.hide(it);
    this.farCars?.shadow(it, false);
    for (const k of PROXIES) if (it.car[k]) { object.remove(it.car[k]); releaseMerged(it.car[k]); it.car[k] = null; }
  }

  update(dt, camera) {
    this.t += dt;
    const cam = camera.position, jumped = cam.distanceToSquared(this.last) > 2500; // a cut, or a jump across the valley
    if (this.farCars) this.farCars.cam = cam; // (its far cars' tiers: FarCars.update)
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
      const on = !it.object.userData.away && (it.on ? d < it.d * 1.1 : d < it.d);
      if (on !== it.on) { it.on = on; it.object.visible = on; }
      if (!on) { if (it.car) { this.farCars?.hide(it); this.farCars?.shadow(it, false); } continue; }
      shown++;
      const cast = d < it.sd;
      if (it.car && this.farCars) {
        // (a car's shadow from its model's shape in the batch: its own parts cast none)
        if (it.cast !== 'batch') { it.cast = 'batch'; it.object.traverse((m) => { if (m.isMesh) m.castShadow = false; }); }
        this.farCars.shadow(it, cast);
      } else if (cast !== it.cast) { it.cast = cast; it.object.traverse((m) => { if (m.isMesh) m.castShadow = cast; }); }
      if (it.car) this.carDetail(it, d);
    }
    this.shown = shown;
  }

  carDetail(it, d) {
    const c = it.car, back = (k) => (c.tier >= k ? 0.9 : 1);
    // 0 its parts, 1 the merged copy, 2 the simplified one, 3 the flat one (a tenth's margin back toward the nearer)
    const tier = d > c.far * back(3) ? 3 : d > c.low * back(2) ? 2 : d > c.near * back(1) ? 1 : 0;
    // dented or burnt while it showed a copy: the copies are made again
    const hurt = c.item && c.item.health !== c.health;
    if (tier === c.tier && !(hurt && tier > 0)) return;
    if (hurt) {
      this.farCars?.hide(it, true); // (its far shape made again too)
      for (const k of PROXIES) if (c[k]) { it.object.remove(c[k]); releaseMerged(c[k]); c[k] = null; }
      c.health = c.item.health;
    }
    c.tier = tier;
    // the far tier in the batch: only a model made for the first time counts against the check's copies
    if (tier === 3 && this.farCars) {
      if (!this.farCars.of.has(it)) {
        if (this.merges >= 2 && !this.farCars.models.size) { c.tier = -1; return; }
        const r = this.farCars.show(it);
        if (r === 'built') this.merges++;
      }
      if (this.farCars.of.has(it)) {
        c.detail.visible = false;
        for (const o of PROXIES) if (c[o]) c[o].visible = false;
        return;
      }
    }
    this.farCars?.hide(it);
    const k = PROXIES[tier - 1];
    if (k && !c[k]) {
      if (this.merges++ >= 2) { c.tier = -1; return; } // (its turn comes at a later check)
      c.detail.visible = true; // (copied from its parts as they are)
      for (const o of PROXIES) if (c[o]) c[o].visible = false;
      c[k] = tier === 3 ? flatCopy(c.detail, new Set(c.item?.lamps)) : mergeByMaterial(c.detail, { simplify: tier === 2 ? 0.33 : 0 });
      it.object.add(c[k]); // (in the detail group's frame, which is the car's)
    }
    c.detail.visible = !k;
    for (const o of PROXIES) if (c[o]) c[o].visible = o === k;
    if (k) c[k].traverse((m) => { if (m.isMesh) m.castShadow = this.farCars ? false : it.cast; });
  }
}
