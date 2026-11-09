import * as THREE from 'three';

// A Guardian's robe, built as cloth round a rigged scan in the pose it will stand in (hands joined
// in front, in the sleeves) and skinned to its skeleton from that pose: a gown draped from the
// shoulders over the upper arms and falling in folds to the floor, sleeves from the elbows to wide
// cuffs over the hands, and the high collar behind the head. Measured from the posed scan, so it fits
// the body it is given; small movements (breath, a turned head, a gesture) bend it with the bones.
// Shading is procedural, from the robe's own rest position (`vRp`): no UVs to seam.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PART = { gown: 0, sleeve: 1, collar: 2, band: 3 };

// rows of points → one indexed surface, with skin weights and a trim mask per point
class Cloth {
  constructor() { this.p = []; this.si = []; this.sw = []; this.tp = []; this.idx = []; }

  // `rows`: arrays of { p, w: [[bone, weight], ...], trim } of equal length. Faces are wound so
  // that `out(point)` (a direction away from the body) is their front.
  surface(rows, { closed = true, part, out }) {
    const base = this.p.length / 3, cols = rows[0].length;
    for (const row of rows) for (const q of row) {
      this.p.push(q.p.x, q.p.y, q.p.z);
      const w = q.w.filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = w.reduce((s, x) => s + x[1], 0);
      for (let k = 0; k < 4; k++) { this.si.push(w[k]?.[0] ?? 0); this.sw.push(w[k] ? w[k][1] / sum : 0); }
      this.tp.push(q.trim ?? 0, part);
    }
    const tris = [];
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < cols - (closed ? 0 : 1); c++) {
      const c2 = (c + 1) % cols;
      const a = base + r * cols + c, b = base + r * cols + c2, d = base + (r + 1) * cols + c, e = base + (r + 1) * cols + c2;
      tris.push(a, d, b, b, d, e);
    }
    // wind so the faces look away from the body (judged on a quad near the middle)
    const at = (i) => V(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
    const q = (Math.floor((rows.length - 1) / 2) * (cols - (closed ? 0 : 1)) + Math.floor(cols / 3)) * 6;
    const n = at(tris[q + 1]).sub(at(tris[q])).cross(at(tris[q + 2]).sub(at(tris[q])));
    if (n.dot(out(at(tris[q]))) < 0) for (let i = 0; i < tris.length; i += 3) [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
    this.idx.push(...tris);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('trimPart', new THREE.Float32BufferAttribute(this.tp, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

// 2D convex hull (monotone chain) of [x, z] points, counter-clockwise
function hull2d(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// distance from (cx, cz) to the hull's edge along the direction (sin a, cos a)
function hullRadius(h, cx, cz, a) {
  const dx = Math.sin(a), dz = Math.cos(a);
  let best = 0;
  for (let i = 0; i < h.length; i++) {
    const [x1, z1] = h[i], [x2, z2] = h[(i + 1) % h.length];
    const ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - cx) * ez - (z1 - cz) * ex) / den, s = ((x1 - cx) * dz - (z1 - cz) * dx) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.max(best, t);
  }
  return best;
}
const smooth = (a, passes, k, closed = true) => {
  for (let p = 0; p < passes; p++) {
    const b = a.slice();
    for (let i = 0; i < a.length; i++) {
      let s = 0, n = 0;
      for (let j = -k; j <= k; j++) { const m = closed ? (i + j + a.length) % a.length : i + j; if (m >= 0 && m < a.length) { s += b[m]; n++; } }
      a[i] = s / n;
    }
  }
  return a;
};
const sstep = THREE.MathUtils.smoothstep;

// `head` describes the head's reshaping in the vertex shader (scale about a pivot), so the collar
// clears the head as it is drawn, not as scanned.
export function buildRobe(rig, { color = '#8e1512', trim = '#4a0909', emblem = null, head = { scale: 1, pivot: V(0, 1.64, 0) } } = {}) {
  const mesh = rig.meshes[0], bones = mesh.skeleton.bones;
  const bi = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  rig.root.updateMatrixWorld(true);
  const B = Object.fromEntries(bones.map((b) => [b.name, b.getWorldPosition(V(0, 0, 0))]));
  // the scan as it stands (skinned on the CPU), each vertex with the bone that holds it most
  const pa = mesh.geometry.attributes.position, sw = mesh.geometry.attributes.skinWeight, si = mesh.geometry.attributes.skinIndex;
  const v = V(0, 0, 0), body = [];
  // the gown is measured on the torso alone: the arms have their own sleeves
  const cut = new Set(['upperArm_L', 'foreArm_L', 'hand_L', 'upperArm_R', 'foreArm_R', 'hand_R', 'head'].map((n) => bi[n]));
  const armPts = { L: [], R: [] };
  for (let i = 0; i < pa.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    if (best === bi.upperArm_L || best === bi.foreArm_L) armPts.L.push(mesh.getVertexPosition(i, V(0, 0, 0)));
    if (best === bi.upperArm_R || best === bi.foreArm_R) armPts.R.push(mesh.getVertexPosition(i, V(0, 0, 0)));
    if (cut.has(best)) continue;
    mesh.getVertexPosition(i, v);
    body.push([v.x, v.y, v.z]);
  }
  const cloth = new Cloth();
  const N = 96;

  // ---- the gown: at each height, the convex hull of the body there (torso and upper arms, the
  // forearms left out: they come forward out of it), loosened; below the widest point the cloth
  // falls, never drawn back in, and from the hips it opens into a bell to the floor
  const hipY = B.hips.y, yS = (B.upperArm_L.y + B.upperArm_R.y) / 2 + 0.03, yN = B.neck.y + 0.012;
  const hullAt = (y, h = 0.011, maxR = Infinity) => {
    const pts = [];
    for (const p of body) if (Math.abs(p[1] - y) < h && Math.hypot(p[0], p[2] - B.neck.z) < maxR) pts.push([p[0], p[2]]);
    if (pts.length < 12) return null;
    const hl = hull2d(pts);
    let z0 = Infinity, z1 = -Infinity;
    for (const q of hl) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
    const cz = (z0 + z1) / 2;
    return { cz, r: Array.from({ length: N }, (_, i) => hullRadius(hl, 0, cz, (i / N) * Math.PI * 2)) };
  };
  const ys = [];
  for (let y = yS; y > 0.014; y -= 0.018) ys.push(y);
  ys.push(0.012);
  const hem = { rx: 0.42, rz: 0.36 };
  const rows = [];
  let prev = null, cz = B.chest.z;
  const loose = (y) => 0.02 + 0.012 * sstep(yS - y, 0.02, 0.12);
  // under the arms the gown follows the ribs; from there down the cloth only falls (an A-line)
  const yArm = B.chest.y + 0.03, shX = (Math.abs(B.upperArm_L.x) + Math.abs(B.upperArm_R.x)) / 2 + 0.005;
  ys.forEach((y) => {
    const m = y > hipY - 0.04 ? hullAt(y) : null;
    if (m) cz = THREE.MathUtils.lerp(cz, m.cz, 0.5);
    let r = m ? m.r.map((x) => x + loose(y)) : prev.slice();
    // above the armpits, narrower than the scan (its suit's shoulder armour): the sleeves carry the
    // shoulders, and nothing of the scan shows under the robe anyway
    if (m && y > yArm) r = r.map((x, i) => { const a = (i / N) * Math.PI * 2; return Math.min(x, 1 / Math.hypot(Math.sin(a) / shX, Math.cos(a) / 0.5)); });
    if (prev && y < yArm && rows[rows.length - 1].y < yArm) r = r.map((x, i) => Math.max(x, prev[i] * 1.0025));
    // the bell
    const t = THREE.MathUtils.clamp((hipY - y) / hipY, 0, 1);
    if (t > 0) r = r.map((x, i) => { const a = (i / N) * Math.PI * 2, bell = 1 / Math.hypot(Math.sin(a) / hem.rx, Math.cos(a) / hem.rz); return Math.max(x, THREE.MathUtils.lerp(x, bell, Math.pow(t, 1.1))); });
    smooth(r, 2, 2);
    prev = r;
    rows.push({ y, r: r.slice(), cz });
  });
  // the yoke: from the neck over the shoulders, an arc out and down to the shoulder line (sloping
  // off the neck, then falling to meet the sleeves' caps)
  const neck = hullAt(yN, 0.012, 0.11) ?? { cz: B.neck.z, r: new Array(N).fill(0.06) };
  const rN = smooth(neck.r.map((x) => x + 0.014), 2, 3), r0 = rows[0].r, K = 10, yoke = [];
  for (let k = 0; k < K; k++) {
    const th = (k / K) * Math.PI * 0.5, y = yS + (yN - yS) * Math.pow(Math.cos(th), 1.5);
    const r = rN.map((x, i) => x + (r0[i] - x) * Math.sin(th));
    yoke.push({ y, r: smooth(r, 1, 2), cz: THREE.MathUtils.lerp(neck.cz, rows[0].cz, Math.sin(th)), yoke: true });
  }
  rows.unshift(...yoke);
  // soften the profile down the body (cloth has no corners)
  for (let i = 0; i < N; i++) {
    const col = smooth(rows.map((q) => q.r[i]), 2, 1, false);
    rows.forEach((q, k) => (q.r[i] = k < 2 ? q.r[i] : col[k]));
  }
  // folds hang from the shoulders and the arms; deeper toward the hem. Their phase drifts with
  // height so they don't run like a column's fluting.
  const gown = rows.map((q, k) => {
    const fold = sstep(yS - 0.1 - q.y, 0, 0.9) * 0.03 + (q.yoke ? 0 : 0.003);
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      const f = Math.sin(a * 8 + 1.7 + q.y * 1.5) * 0.55 + Math.sin(a * 13 + q.y * 2.6 + 0.4) * 0.3 + Math.sin(a * 21 - q.y * 4.0) * 0.15;
      const rr = q.r[i] + f * fold * (0.6 + 0.4 * Math.cos(a) ** 2); // fuller folds front and back
      const y = q.y + (k === rows.length - 1 ? Math.sin(a * 8 + 1.7) * 0.006 : 0); // an uneven hem
      const w = q.y > B.chest.y ? [[bi.chest, 1]] : q.y > B.spine.y ? [[bi.chest, (q.y - B.spine.y) / (B.chest.y - B.spine.y)], [bi.spine, (B.chest.y - q.y) / (B.chest.y - B.spine.y)]] : q.y > hipY ? [[bi.spine, (q.y - hipY) / (B.spine.y - hipY)], [bi.hips, (B.spine.y - q.y) / (B.spine.y - hipY)]] : [[bi.hips, 1]];
      return { p: V(Math.sin(a) * rr, y, q.cz + Math.cos(a) * rr), w, trim: k >= rows.length - 3 || k < 2 ? 1 : 0 };
    });
  });
  // its edge at the neck, turned in
  const lip = rows[0].r.map((x, i) => {
    const a = (i / N) * Math.PI * 2;
    return { p: V(Math.sin(a) * (x - 0.006), rows[0].y + 0.006, rows[0].cz + Math.cos(a) * (x - 0.006)), w: [[bi.chest, 1]], trim: 1 };
  });
  const rowAt = (y) => rows.reduce((b, q) => (Math.abs(q.y - y) < Math.abs(b.y - y) ? q : b), rows[0]);
  cloth.surface([lip, ...gown], { part: PART.gown, out: (p) => V(p.x, 0, p.z - rowAt(p.y).cz) });

  // ---- sleeves: the whole arm, from a rounded cap over the shoulder, past the elbow, to a wide
  // bell cuff that hangs below the forearm, its lip turned back inside
  for (const s of ['L', 'R']) {
    const sh = B[`upperArm_${s}`], el = B[`foreArm_${s}`], wr = B[`hand_${s}`];
    const fore = wr.clone().sub(el).normalize();
    const path = new THREE.CatmullRomCurve3([sh.clone().add(V(0, 0.015, 0)), sh.clone().lerp(el, 0.5), el, el.clone().lerp(wr, 0.5), wr, wr.clone().addScaledVector(fore, 0.07)], false, 'centripetal');
    const total = path.getLength(), sEl = sh.distanceTo(el) / total, sWr = (sh.distanceTo(el) + el.distanceTo(wr)) / total;
    const pts = armPts[s], M = 48, srows = [];
    // the arm's thickness along its length (from the posed scan), loosened
    const armR = (c, t) => {
      let r = 0.045;
      for (const q of pts) {
        const d = q.clone().sub(c), along = d.dot(t);
        if (Math.abs(along) < 0.015) r = Math.max(r, Math.sqrt(Math.max(0, d.lengthSq() - along * along)));
      }
      return Math.min(r, 0.07);
    };
    const ring = (c, t, r, sag, u, back = 0) => {
      const U = V(0, 1, 0).sub(t.clone().multiplyScalar(t.y)).normalize(), F = U.clone().cross(t);
      const kU = THREE.MathUtils.clamp((sEl + 0.05 - u) / 0.1, 0, 1); // upper arm → forearm across the elbow
      const w = u < 0.1 ? [[bi[`upperArm_${s}`], 0.55 + u * 4.5], [bi.chest, 0.45 - u * 4.5]] : [[bi[`upperArm_${s}`], kU], [bi[`foreArm_${s}`], 1 - kU]];
      return Array.from({ length: M }, (_, i) => {
        const a = (i / M) * Math.PI * 2;
        const f = Math.sin(a * 5 + u * 9) * 0.004 * (0.4 + sag * 20);
        const down = sag * Math.max(0, -Math.cos(a)) ** 1.5; // the cloth hangs from the arm
        return { p: c.clone().addScaledVector(U, Math.cos(a) * (r + f - back) - down).addScaledVector(F, Math.sin(a) * (r + f - back)), w, trim: u > sWr + 0.02 ? 1 : 0 };
      });
    };
    // the cap: a dome over the top of the shoulder, closing the tube
    const t0 = path.getTangentAt(0), r0 = armR(sh, t0) + 0.022;
    for (const k of [0.25, 0.6, 0.85]) srows.push(ring(sh.clone().addScaledVector(t0, -r0 * Math.cos(k * Math.PI * 0.5) * 0.9), t0, r0 * Math.sin(k * Math.PI * 0.5) + 0.002, 0, 0));
    for (let k = 0; k <= 30; k++) {
      const u = k / 30, c = path.getPointAt(u), t = path.getTangentAt(u);
      const bell = sstep(u, sEl + 0.06, 1.0);
      srows.push(ring(c, t, armR(c, t) * (1 - bell) + 0.045 * bell + 0.022 + bell * 0.075, bell * 0.07, u));
    }
    const tE = path.getTangentAt(1), cE = path.getPointAt(1);
    srows.push(ring(cE.clone().addScaledVector(tE, 0.004), tE, 0.142, 0.07, 1.01, 0.01), ring(cE.clone().addScaledVector(tE, -0.03), tE, 0.142, 0.07, 1.01, 0.016));
    const axis = path.getSpacedPoints(40);
    cloth.surface(srows, { part: PART.sleeve, out: (p) => p.clone().sub(axis.reduce((b, q) => (q.distanceTo(p) < b.distanceTo(p) ? q : b))) });
  }

  // ---- the collar: standing up behind the head and flaring back, open at the front
  {
    const ny = yN - 0.03, ccz = rows[0].cz - 0.015, C = 48, a0 = Math.PI * 0.36, a1 = Math.PI * 1.64;
    const hs = head.scale, crow = [];
    for (let k = 0; k <= 12; k++) {
      const v = k / 12, y = ny - 0.01 + v * 0.17 * hs;
      const r = (0.1 + v * 0.03) * Math.max(1, hs * 0.92) + v * v * 0.05;
      crow.push(Array.from({ length: C }, (_, i) => {
        const a = a0 + (i / (C - 1)) * (a1 - a0), e = Math.sin((i / (C - 1)) * Math.PI);
        // its edges come down toward the front, so it opens round the jaw
        const yy = y - (1 - e) * v * 0.08;
        return { p: V(Math.sin(a) * r, yy, ccz + Math.cos(a) * r * 0.92), w: [[bi.chest, 1]], trim: k >= 11 || i < 2 || i > C - 3 ? 1 : 0 };
      }));
    }
    cloth.surface(crow, { closed: false, part: PART.collar, out: (p) => V(p.x, 0, p.z - ccz) });
  }

  const geo = cloth.geometry();
  const front = rows.reduce((m, q) => (q.y < B.chest.y + 0.1 && q.y > B.chest.y ? Math.max(m, q.cz + q.r[0]) : m), 0);
  const mat = robeMaterial({ color, trim, emblem, embY: B.chest.y + 0.06, embZ: front - 0.06 });
  const robe = new THREE.SkinnedMesh(geo, mat);
  robe.castShadow = robe.receiveShadow = true;
  robe.frustumCulled = false;
  robe.name = 'robe';
  rig.root.add(robe);
  robe.bind(new THREE.Skeleton(bones)); // bound in this pose
  return robe;
}

function robeMaterial({ color, trim, emblem, embY, embZ }) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(1.0, 0.5, 0.45), side: THREE.DoubleSide });
  const u = (mat.userData.u = {
    uTrim: { value: new THREE.Color(trim) }, uEmblem: { value: emblem }, uEmbY: { value: embY }, uEmbZ: { value: embZ }, uEmbR: { value: 0.1 },
    uDissolve: { value: 0 }, uDissolveOn: { value: 0 }, uEdgeColor: { value: new THREE.Color(0.5, 4, 1.4) },
  });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 trimPart;\nvarying vec3 vRp;\nvarying vec2 vTp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRp = position; vTp = trimPart;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRp; varying vec2 vTp;
        uniform vec3 uTrim, uEdgeColor; uniform sampler2D uEmblem; uniform float uEmbY, uEmbZ, uEmbR, uDissolve, uDissolveOn;
        float rHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float rNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(rHash(i), rHash(i + vec3(1,0,0)), f.x), mix(rHash(i + vec3(0,1,0)), rHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(rHash(i + vec3(0,0,1)), rHash(i + vec3(1,0,1)), f.x), mix(rHash(i + vec3(0,1,1)), rHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // the weave, and the cloth's slow unevenness (detail finer than a pixel fades to its average)
        float rW = mix(0.5, rNoise(vRp * vec3(700.0, 220.0, 700.0)), 1.0 - smoothstep(0.3, 1.0, fwidth(vRp.y * 220.0)));
        diffuseColor.rgb *= 0.88 + 0.12 * rW;
        diffuseColor.rgb *= 0.88 + 0.24 * rNoise(vRp * 9.0);
        // trim at the hems, cuffs and the collar's edge
        diffuseColor.rgb = mix(diffuseColor.rgb, uTrim, vTp.x);
        if (!gl_FrontFacing) diffuseColor.rgb *= 0.4; // the inside, in its own shadow
        // the Corps emblem on the chest
        if (vTp.y < 0.5 && vRp.z > uEmbZ) {
          vec2 eu = (vRp.xy - vec2(0.0, uEmbY)) / uEmbR * 0.5 + 0.5;
          if (eu.x > 0.0 && eu.x < 1.0 && eu.y > 0.0 && eu.y < 1.0) {
            vec4 e = texture2D(uEmblem, eu);
            diffuseColor.rgb = mix(diffuseColor.rgb, e.rgb, e.a);
          }
        }
        float rEdge = 0.0;
        if (uDissolveOn > 0.5) {
          float field = vRp.y / 1.9 * 0.6 + rNoise(vRp * 11.0) * 0.4;
          if (field < uDissolve) discard;
          rEdge = 1.0 - smoothstep(0.0, 0.05, field - uDissolve);
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n        totalEmissiveRadiance += uEdgeColor * rEdge;');
  };
  mat.customProgramCacheKey = () => 'gl-robe';
  return mat;
}
