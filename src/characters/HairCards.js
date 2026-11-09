import * as THREE from 'three';

// Hair as cards, the way games draw it: narrow ribbons grown from the scalp of a skinned scan,
// combed along a direction field, standing a little off the head for volume, each carrying a few
// alpha-cut strands. Grown in the scan's bind pose (through `deform`, the vertex stage's reshaping
// of the head, so they sit on the head as drawn) and skinned rigidly to one bone. Lit with normals
// pointing out from the skull, so the mass shades like a volume rather than flat paper.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export function growHair(mesh, {
  bone, mask, deform = (p) => p.clone(), centre, comb, count = 1200,
  length = [0.03, 0.05], width = 0.007, lift = [0.002, 0.012], hug = Infinity, segments = 6, curl = 0.25,
  color = new THREE.Color(0.9, 0.9, 0.92), root = 0.55,
}) {
  const g = mesh.geometry, pa = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const P = (i) => V(pa.getX(i), pa.getY(i), pa.getZ(i));
  const onBone = (i) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); if (x > w) { w = x; b = si.getComponent(i, k); } } return b === bone; };
  const c = deform(centre);
  // the drawn scalp, for keeping strands on it: its vertices (reshaped) and normals in a grid of
  // 1 cm cells, searched for the nearest
  const NA = g.attributes.normal, CELL = 0.01, grid = new Map(), verts = [];
  const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
  for (let i = 0; i < pa.count; i++) {
    if (!onBone(i)) continue;
    const q = deform(P(i)), n = V(NA.getX(i), NA.getY(i), NA.getZ(i)).normalize();
    const k = key(q.x, q.y, q.z);
    (grid.get(k) ?? grid.set(k, []).get(k)).push(verts.length);
    verts.push({ q, n });
  }
  const nearest = (p) => {
    for (let R = 1; R <= 4; R++) {
      let best = null, bd = Infinity;
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
      for (let x = cx - R; x <= cx + R; x++) for (let y = cy - R; y <= cy + R; y++) for (let z = cz - R; z <= cz + R; z++) {
        for (const i of grid.get(`${x},${y},${z}`) ?? []) { const d = verts[i].q.distanceToSquared(p); if (d < bd) { bd = d; best = verts[i]; } }
      }
      if (best) return best;
    }
    return null;
  };
  // between `l` and `l + hug` off the scalp: combed hair lies on the head, it doesn't stand out
  const keepOut = (p, l) => {
    const s = nearest(p);
    if (!s) return p;
    const h = p.clone().sub(s.q).dot(s.n);
    if (h < l) p.addScaledVector(s.n, l - h);
    else if (h > l + hug) p.addScaledVector(s.n, l + hug - h);
    return p;
  };

  // roots: scattered over the scalp's triangles where the mask says hair grows, by area
  const tris = [], areas = [];
  let total = 0;
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), d = idx.getX(t + 2);
    if (!onBone(a) || !onBone(b) || !onBone(d)) continue;
    const pa0 = P(a), pb = P(b), pd = P(d);
    const m = mask(pa0.clone().add(pb).add(pd).multiplyScalar(1 / 3));
    if (m < 0.05) continue;
    const area = pb.clone().sub(pa0).cross(pd.clone().sub(pa0)).length() * 0.5 * m;
    tris.push([pa0, pb, pd]);
    total += area;
    areas.push(total);
  }
  const pos = [], nrm = [], uv = [], rnd = [], ind = [];
  let made = 0;
  for (let n = 0; n < count * 3 && made < count && tris.length; n++) {
    const x = rand() * total;
    let lo = 0, hi = areas.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (areas[m] < x) lo = m + 1; else hi = m; }
    const [a, b, d] = tris[lo];
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const p = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(d.clone().sub(a), v);
    if (rand() > mask(p)) continue;
    made++;
    const L = length[0] + (length[1] - length[0]) * rand(), wd = width * (0.7 + 0.6 * rand()), r0 = rand();
    // grow the strand in the drawn space: along the comb, laid over the scalp
    const pts = [keepOut(deform(p), lift[0])];
    const dir0 = comb(p).normalize(), wob = (rand() - 0.5) * 2 * curl;
    for (let k = 1; k <= segments; k++) {
      const s = k / segments, q = pts[k - 1], out = q.clone().sub(c).normalize();
      const d = dir0.clone().applyAxisAngle(out, wob * s).sub(out.clone().multiplyScalar(dir0.dot(out))).normalize();
      pts.push(keepOut(q.clone().addScaledVector(d, L / segments), lift[0] + (lift[1] - lift[0]) * Math.pow(s, 0.8)));
    }
    const base = pos.length / 3;
    for (let k = 0; k <= segments; k++) {
      const s = k / segments, q = pts[k], out = q.clone().sub(c).normalize();
      const t = (k < segments ? pts[k + 1].clone().sub(q) : q.clone().sub(pts[k - 1])).normalize();
      const side = t.clone().cross(out).normalize().multiplyScalar(wd * (1 - 0.6 * s) * 0.5);
      for (const sg of [-1, 1]) {
        const e = q.clone().addScaledVector(side, sg);
        pos.push(e.x, e.y, e.z);
        nrm.push(out.x, out.y, out.z);
        uv.push(sg < 0 ? 0 : 1, s);
        rnd.push(r0);
      }
      if (k < segments) { const i = base + k * 2; ind.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('hairUv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('hairRnd', new THREE.Float32BufferAttribute(rnd, 1));
  const n = pos.length / 3;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bone : 0)), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  geo.setIndex(ind);
  const mat = hairMaterial(color, root);
  const hair = new THREE.SkinnedMesh(geo, mat);
  hair.frustumCulled = false;
  hair.castShadow = false;
  hair.receiveShadow = true;
  mesh.parent.add(hair);
  hair.bind(mesh.skeleton, mesh.bindMatrix);
  return hair;
}

function hairMaterial(color, root) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.48, side: THREE.DoubleSide, alphaTest: 0.35, alphaToCoverage: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 hairUv;\nattribute float hairRnd;\nvarying vec2 vH;\nvarying float vR;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = hairUv; vR = hairRnd;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vH;\nvarying float vR;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        // a few strands across the card, each ending at its own length
        float hA = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float cx = (fi + 0.5) / 6.0 + (fract(vR * 37.0 * (fi + 1.0)) - 0.5) * 0.12;
          float w = 0.075 * (1.0 - 0.5 * vH.y);
          float len = 0.65 + 0.35 * fract(vR * 13.0 * (fi + 3.0));
          hA = max(hA, (1.0 - smoothstep(w * 0.45, w, abs(vH.x - cx))) * (1.0 - smoothstep(len - 0.2, len, vH.y)));
        }
        diffuseColor.a = hA;
        // darker at the roots and between clumps; each card a slightly different white
        diffuseColor.rgb *= mix(${root.toFixed(3)}, 1.0, smoothstep(0.0, 0.45, vH.y)) * (0.82 + 0.18 * vR);`);
  };
  mat.customProgramCacheKey = () => `gl-hair-${root}`;
  return mat;
}
