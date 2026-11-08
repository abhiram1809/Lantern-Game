import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural trees, built at unit height and instanced. Conifers are stacked, drooping branch
// tiers with jagged outlines (so the skyline reads as a forest, not as cones); broadleaf trees are
// lumpy clumped crowns. Both sway gently in the wind.

let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hash = (x) => { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); };

// mergeGeometries needs identical attribute sets: keep position, normal and colour only
function merge(parts) {
  const geo = BufferGeometryUtils.mergeGeometries(parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    return g;
  }));
  if (!geo) throw new Error('tree geometry merge failed');
  return geo;
}

function colored(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(fn(v), i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function trunk(height, radius, segs) {
  const g = new THREE.CylinderGeometry(radius * 0.55, radius, height, segs, 1, true);
  g.translate(0, height / 2, 0);
  return colored(g, (v) => { const k = 0.55 + 0.25 * (v.y / height); return [0.2 * k, 0.15 * k, 0.11 * k]; });
}

// One branch tier: an inner ring hugging the trunk, a mid ring, and a jagged outer ring hanging down.
function tier(yTop, radius, segs, branches, phase, droop) {
  const rings = [[0.05, 0], [0.55, 0.42], [1, 1]];
  const pos = [], col = [], idx = [];
  const cols = segs + 1;
  rings.forEach(([rf, df], ri) => {
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const jag = 0.38 + 0.62 * Math.abs(Math.sin((a * branches) / 2 + phase)) ** 0.5 * (0.65 + 0.7 * hash(s * 7.3 + phase));
      const r = radius * rf * (ri === 2 ? jag : ri === 1 ? 0.92 + 0.08 * jag : 1);
      const y = yTop - radius * droop * df * (ri === 2 ? 0.7 + 0.7 * (1 - jag) + 0.3 * hash(s * 3.7 + phase) : 1);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      const shade = [0.42, 0.7, 0.82][ri] * (0.9 + 0.2 * hash(s + phase * 3));
      col.push(0.05 * shade, 0.085 * shade, 0.06 * shade);
    }
  });
  for (let ri = 0; ri < 2; ri++) for (let s = 0; s < segs; s++) {
    const a = ri * cols + s, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.rotateX((hash(phase * 5.1) - 0.5) * 0.14).rotateZ((hash(phase * 2.3) - 0.5) * 0.14);
  g.translate((hash(phase * 7.7) - 0.5) * radius * 0.12, 0, (hash(phase * 1.9) - 0.5) * radius * 0.12);
  g.computeVertexNormals();
  // soft foliage shading: normals lean outward and up rather than following the facets
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), 0, p.getZ(i)).normalize().multiplyScalar(0.65).add(new THREE.Vector3(0, 0.75, 0)).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

export function conifer({ tiers = 10, segs = 16, slender = 0.3, droop = 0.7, s = 1 } = {}) {
  seed = s * 9973 + 17;
  const parts = [trunk(0.32, 0.028, Math.max(5, segs >> 2))];
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1); // 0 bottom .. 1 top
    const yTop = 0.2 + t * 0.78 + (rand() - 0.5) * 0.02;
    const radius = slender * (1 - t) ** 0.8 * (0.75 + 0.5 * rand()) + 0.02;
    parts.push(tier(yTop, radius, segs, 7 + Math.floor(rand() * 5), rand() * 6.28, droop));
  }
  const tip = new THREE.ConeGeometry(0.03, 0.08, 6, 1, true);
  tip.translate(0, 1.0, 0);
  parts.push(colored(tip, () => [0.09, 0.15, 0.09]));
  return merge(parts);
}

export function broadleaf({ s = 1, lumps = 13 } = {}) {
  seed = s * 7919 + 3;
  const parts = [trunk(0.45, 0.035, 6)];
  for (let i = 0; i < lumps; i++) {
    const g = BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(0.11 + rand() * 0.08, 2));
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      v.multiplyScalar(0.7 + 0.45 * hash(Math.round(v.x * 40) * 13 + Math.round(v.y * 40) * 7 + Math.round(v.z * 40) * 3 + i));
      p.setXYZ(k, v.x, v.y, v.z);
    }
    const a = rand() * Math.PI * 2, r = 0.05 + rand() * 0.2;
    g.translate(Math.cos(a) * r, 0.55 + rand() * 0.38, Math.sin(a) * r);
    g.computeVertexNormals();
    parts.push(colored(g, (v) => { const k = 0.45 + 0.6 * Math.min(1, Math.max(0, (v.y - 0.45) / 0.5)); return [0.05 * k, 0.085 * k, 0.04 * k]; }));
  }
  return merge(parts);
}

// Shared foliage material with a gentle wind sway (more at the top, phased per instance).
export function foliageMaterial(time) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
          float sway = sin(uTime * 0.9 + ip.x * 0.31 + ip.y * 0.17) * 0.5 + sin(uTime * 2.1 + ip.x * 0.7) * 0.2;
          float h = transformed.y * transformed.y;
          transformed.x += sway * 0.035 * h;
          transformed.z += sway * 0.022 * h;
        #endif`);
  };
  return mat;
}

// Instanced forest from a list of placements { x, y, z, h, w?, rot?, tint? }.
export function forest(geometry, material, spots, { shadows = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot ?? hash(i * 3.1) * 6.28);
    const w = s.w ?? s.h;
    m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(w, s.h, w));
    mesh.setMatrixAt(i, m);
    const t = s.tint ?? 0.8 + 0.4 * hash(i * 1.7);
    mesh.setColorAt(i, c.setRGB(t, t * (0.95 + 0.1 * hash(i)), t));
  });
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// A few geometry variants per kind, so neighbouring trees differ.
export function treeKit() {
  return {
    near: [1, 2, 3].map((s) => conifer({ tiers: 16, segs: 22, slender: 0.26 + s * 0.02, s })),
    mid: [4, 5].map((s) => conifer({ tiers: 11, segs: 14, slender: 0.3, s })),
    far: [6, 7].map((s) => conifer({ tiers: 6, segs: 8, slender: 0.32, droop: 0.45, s })),
    leaf: [8, 9].map((s) => broadleaf({ s })),
  };
}
