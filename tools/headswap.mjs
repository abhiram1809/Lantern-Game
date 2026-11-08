// Head transplant for casual Hal: the casual scan's face is poor, the suit scan's is good but
// masked. This cuts the suit head off at the neck, removes the mask (relaxes the sculpted plate into
// a skin surface, repaints mask, lids and baked glow with nearby skin, paints eyes and brows), and
// grafts it onto the casual body with the neck ring fitted to the body's neck.
//
// The suit's UV atlas scatters the face over many islands, so all painting works in 3D: every texel
// the head covers is given its surface position, and colours are gathered from 3D neighbours.
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d);
  return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), u), mix(c(0, 1, 0), c(1, 1, 0), u), v), mix(mix(c(0, 0, 1), c(1, 0, 1), u), mix(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

export function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, mx > 0 ? d / mx : 0, mx];
}
// How strongly a colour is the mask's / glow's green (0 = untouched skin or hair).
export const greenWeight = ([h, s, v]) => smooth(44, 66, h) * (1 - smooth(195, 215, h)) * smooth(0.04, 0.14, s) * smooth(0.03, 0.09, v);
const isSkinSample = ([h, s, v]) => (h < 42 || h > 340) && s > 0.12 && s < 0.65 && v > 0.3 && v < 0.97;
const isHair = ([h, s, v]) => h > 8 && h < 55 && v < 0.42 && s > 0.2;
// the suit's eyeballs glow white-to-green; warm skin highlights must not count
const isEyeball = ([h, s, v], minV) => v > minV && (s < 0.12 || (h > 58 && h < 200));

export async function decodeImage(bytes, sizeOf) {
  let s = sharp(Buffer.from(bytes)).removeAlpha();
  if (sizeOf) s = s.resize(sizeOf.w, sizeOf.h);
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export function encodeImage(img, mime) {
  const s = sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } });
  return mime === 'image/png' ? s.png().toBuffer() : s.jpeg({ quality: 93 }).toBuffer();
}

// Narrowest horizontal slice of the neck: returns its height, centre and extents.
export function findNeck(pos, H, from = 0.78, to = 0.93) {
  const n = pos.length / 3;
  let best = null;
  for (let y = from * H; y <= to * H; y += 0.002 * H) {
    let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity, c = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(pos[i * 3 + 1] - y) > 0.0025 * H || Math.abs(pos[i * 3]) > 0.1 * H) continue;
      const x = pos[i * 3], z = pos[i * 3 + 2];
      mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z);
      c++;
    }
    if (c < 20) continue;
    const w = mxx - mnx;
    if (!best || w < best.w) best = { y, w, d: mxz - mnz, cx: (mnx + mxx) / 2, cz: (mnz + mxz) / 2 };
  }
  return best;
}

// Keep triangles passing `keep(a, b, c)`, compacting the vertex arrays.
export function subset(mesh, keep) {
  const { pos, nrm, uv, idx } = mesh;
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const out = [];
  let m = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (!keep(a, b, c)) continue;
    for (const v of [a, b, c]) { if (remap[v] < 0) remap[v] = m++; out.push(remap[v]); }
  }
  const P = new Float32Array(m * 3), N = new Float32Array(m * 3), T = new Float32Array(m * 2);
  for (let i = 0; i < remap.length; i++) {
    const j = remap[i];
    if (j < 0) continue;
    P.set(pos.subarray(i * 3, i * 3 + 3), j * 3);
    N.set(nrm.subarray(i * 3, i * 3 + 3), j * 3);
    T.set(uv.subarray(i * 2, i * 2 + 2), j * 2);
  }
  return { pos: P, nrm: N, uv: T, idx: Uint32Array.from(out) };
}

// Vertices that share a position (UV seams) get one canonical id, so geometry edits stay welded.
function weld(pos) {
  const n = pos.length / 3, map = new Map(), canon = new Uint32Array(n), reps = [];
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
    let c = map.get(k);
    if (c === undefined) { c = reps.length; map.set(k, c); reps.push(i); }
    canon[i] = c;
  }
  return { canon, reps };
}

function neighbours(idx, canon, m) {
  const sets = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const a = canon[idx[t]], b = canon[idx[t + 1]], c = canon[idx[t + 2]];
    sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b);
  }
  return sets.map((s) => Uint32Array.from(s));
}

export function computeNormals(mesh) {
  const { pos, idx } = mesh;
  const { canon, reps } = weld(pos);
  const acc = new Float32Array(reps.length * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const k = canon[v] * 3; acc[k] += nx; acc[k + 1] += ny; acc[k + 2] += nz; }
  }
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) {
    const k = canon[i] * 3, l = Math.hypot(acc[k], acc[k + 1], acc[k + 2]) || 1;
    nrm[i * 3] = acc[k] / l; nrm[i * 3 + 1] = acc[k + 1] / l; nrm[i * 3 + 2] = acc[k + 2] / l;
  }
  mesh.nrm = nrm;
}

const texel = (img, u, v) => {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor(u * img.w))), y = Math.min(img.h - 1, Math.max(0, Math.floor(v * img.h)));
  const k = (y * img.w + x) * 3;
  return [img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255];
};

// Grid of 3D points for radius queries.
class PointGrid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  add(x, y, z, item) {
    const k = `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)},${Math.floor(z / this.cell)}`;
    let a = this.map.get(k);
    if (!a) this.map.set(k, (a = []));
    a.push(x, y, z, item);
  }
  // calls fn(item, distanceSquared) for points within r
  near(x, y, z, r, fn) {
    const c = this.cell, n = Math.ceil(r / c), cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c), r2 = r * r;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
      const a = this.map.get(`${cx + i},${cy + j},${cz + k}`);
      if (!a) continue;
      for (let q = 0; q < a.length; q += 4) {
        const d2 = (a[q] - x) ** 2 + (a[q + 1] - y) ** 2 + (a[q + 2] - z) ** 2;
        if (d2 <= r2) fn(a[q + 3], d2);
      }
    }
  }
}

// Texels covered by the mesh's triangles, with their 3D position and an interpolated per-vertex weight.
function rasterize(mesh, img, weight) {
  const { pos, uv, idx } = mesh, W = img.w, H = img.h;
  const texels = [], P = [], wts = [];
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    const U = v.map((i) => uv[i * 2] * W - 0.5), V = v.map((i) => uv[i * 2 + 1] * H - 0.5);
    const x0 = Math.max(0, Math.floor(Math.min(...U))), x1 = Math.min(W - 1, Math.ceil(Math.max(...U)));
    const y0 = Math.max(0, Math.floor(Math.min(...V))), y1 = Math.min(H - 1, Math.ceil(Math.max(...V)));
    const area = (U[1] - U[0]) * (V[2] - V[0]) - (U[2] - U[0]) * (V[1] - V[0]);
    if (Math.abs(area) < 1e-12) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const b1 = ((x - U[0]) * (V[2] - V[0]) - (U[2] - U[0]) * (y - V[0])) / area;
      const b2 = ((U[1] - U[0]) * (y - V[0]) - (x - U[0]) * (V[1] - V[0])) / area;
      const b0 = 1 - b1 - b2;
      if (b0 < -0.02 || b1 < -0.02 || b2 < -0.02) continue;
      texels.push(y * W + x);
      for (let k = 0; k < 3; k++) P.push(b0 * pos[v[0] * 3 + k] + b1 * pos[v[1] * 3 + k] + b2 * pos[v[2] * 3 + k]);
      wts.push(b0 * weight[v[0]] + b1 * weight[v[1]] + b2 * weight[v[2]]);
    }
  }
  return { texel: Int32Array.from(texels), P: Float32Array.from(P), w: Float32Array.from(wts) };
}

export async function transplantHead({ body, bodyColor, suit, images, H, headTris = 36000, log = console.log }) {
  const color = await decodeImage(images.color.bytes);
  // texel indices are shared across the maps, so bring them all to the colour map's size
  const orm = await decodeImage(images.orm.bytes, color), nmap = await decodeImage(images.normal.bytes, color);
  const neckB = findNeck(body.pos, H), neckS = findNeck(suit.pos, H);
  const scale = (neckB.w / neckS.w + neckB.d / neckS.d) / 2;
  log(`  neck body y=${neckB.y.toFixed(3)} w=${neckB.w.toFixed(3)}  suit y=${neckS.y.toFixed(3)} w=${neckS.w.toFixed(3)}  scale=${scale.toFixed(3)}`);

  // 1. the suit head, cut a little below its neck (above the collar) so it can overlap the body's neck
  const cutS = neckS.y - 0.012 / scale;
  const sp = suit.pos;
  let head = subset(suit, (a, b, c) => [a, b, c].every((v) => sp[v * 3 + 1] > cutS && Math.abs(sp[v * 3]) < 0.12 * H));
  const simplified = MeshoptSimplifier.simplify(head.idx, head.pos, 3, Math.min(head.idx.length, headTris * 3), 0.002, ['LockBorder']);
  head = subset({ ...head, idx: simplified[0] }, () => true);
  log(`  head: ${head.idx.length / 3} tris`);
  let cx = 0, cz = 0, cn = 0;
  for (let i = 0; i < head.pos.length / 3; i++) if (head.pos[i * 3 + 1] > neckS.y + 0.06) { cx += head.pos[i * 3]; cz += head.pos[i * 3 + 2]; cn++; }
  const center = { x: cx / cn, z: cz / cn };
  const faceFront = (x, y, z) => z > center.z + 0.025 && y > neckS.y + 0.02;

  // 2. relax the sculpted mask plate (and the green lids) into a smooth skin membrane; eyeballs stay
  const nv = head.pos.length / 3;
  const vgw = new Float32Array(nv), vEye = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) {
    const c = hsv(...texel(color, head.uv[i * 2], head.uv[i * 2 + 1]));
    const [x, y, z] = [head.pos[i * 3], head.pos[i * 3 + 1], head.pos[i * 3 + 2]];
    if (!faceFront(x, y, z)) continue;
    vgw[i] = greenWeight(c);
    vEye[i] = isEyeball(c, 0.62) ? 1 : 0;
  }
  const { canon, reps } = weld(head.pos);
  const m = reps.length, nb = neighbours(head.idx, canon, m);
  const movable = new Uint8Array(m), fixedEye = new Uint8Array(m);
  for (let i = 0; i < nv; i++) {
    if (vEye[i]) fixedEye[canon[i]] = 1;
    else if (vgw[i] > 0.35) movable[canon[i]] = 1;
  }
  for (let c = 0; c < m; c++) if (fixedEye[c]) movable[c] = 0;
  for (let ring = 0; ring < 2; ring++) { // take in the bevel at the plate's edge
    const add = [];
    for (let c = 0; c < m; c++) if (!movable[c] && !fixedEye[c] && nb[c].some((o) => movable[o])) add.push(c);
    for (const c of add) movable[c] = 1;
  }
  const P = new Float32Array(m * 3);
  for (let c = 0; c < m; c++) P.set(head.pos.subarray(reps[c] * 3, reps[c] * 3 + 3), c * 3);
  const orig = P.slice();
  const moved = [];
  for (let c = 0; c < m; c++) if (movable[c]) moved.push(c);
  const relax = (iterations) => {
    for (let it = 0; it < iterations; it++) {
      for (const c of moved) {
        const o = nb[c];
        let x = 0, y = 0, z = 0;
        for (let j = 0; j < o.length; j++) { x += P[o[j] * 3]; y += P[o[j] * 3 + 1]; z += P[o[j] * 3 + 2]; }
        P[c * 3] = x / o.length; P[c * 3 + 1] = y / o.length; P[c * 3 + 2] = z / o.length;
      }
    }
  };
  // membrane spanning the plate's edges (forehead, cheeks, eyeballs)
  relax(2500);
  // The plate follows the face's own contours (brow ridge, nose bridge), so away from its edges keep
  // that shape, sunk by the plate's thickness; near the edges blend into the membrane.
  const ringDist = new Int32Array(m).fill(-1), queue = [];
  for (const c of moved) if (nb[c].some((o) => !movable[o])) { ringDist[c] = 0; queue.push(c); }
  for (let q = 0; q < queue.length; q++) for (const o of nb[queue[q]]) if (movable[o] && ringDist[o] < 0) { ringDist[o] = ringDist[queue[q]] + 1; queue.push(o); }
  const vn = new Float32Array(m * 3); // smoothed normals of the original plate
  for (let t = 0; t < head.idx.length; t += 3) {
    const [a, b, c] = [canon[head.idx[t]], canon[head.idx[t + 1]], canon[head.idx[t + 2]]];
    const ux = orig[b * 3] - orig[a * 3], uy = orig[b * 3 + 1] - orig[a * 3 + 1], uz = orig[b * 3 + 2] - orig[a * 3 + 2];
    const wx = orig[c * 3] - orig[a * 3], wy = orig[c * 3 + 1] - orig[a * 3 + 1], wz = orig[c * 3 + 2] - orig[a * 3 + 2];
    const n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) vn[v * 3 + k] += n[k];
  }
  for (let pass = 0; pass < 6; pass++) for (const c of moved) {
    let s = [vn[c * 3], vn[c * 3 + 1], vn[c * 3 + 2]];
    for (const o of nb[c]) for (let k = 0; k < 3; k++) s[k] += vn[o * 3 + k];
    const l = Math.hypot(...s) || 1;
    for (let k = 0; k < 3; k++) vn[c * 3 + k] = s[k] / l;
  }
  const depth = [];
  for (const c of moved) if (ringDist[c] > 4) depth.push((orig[c * 3] - P[c * 3]) * vn[c * 3] + (orig[c * 3 + 1] - P[c * 3 + 1]) * vn[c * 3 + 1] + (orig[c * 3 + 2] - P[c * 3 + 2]) * vn[c * 3 + 2]);
  depth.sort((a, b) => a - b);
  const thick = Math.min(0.0045, Math.max(0.0015, depth[Math.floor(depth.length * 0.25)] ?? 0.003));
  for (const c of moved) {
    const w = smooth(1, 6, ringDist[c]);
    for (let k = 0; k < 3; k++) P[c * 3 + k] = mix(P[c * 3 + k], orig[c * 3 + k] - vn[c * 3 + k] * thick, w);
  }
  relax(25); // soften the plate's faceted bevels
  log(`  mask plate sunk by ${(thick * 1000).toFixed(1)} mm`);
  const movedW = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const c = canon[i];
    if (movable[c]) { head.pos.set(P.subarray(c * 3, c * 3 + 3), i * 3); movedW[i] = 1; }
  }
  computeNormals(head);
  log(`  mask: ${moved.length} vertices relaxed`);

  // 3. per-texel analysis
  const tx = rasterize(head, color, movedW);
  const N = tx.texel.length;
  const HSV = new Float32Array(N * 3), gw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const k = tx.texel[i] * 3;
    const c = hsv(color.data[k] / 255, color.data[k + 1] / 255, color.data[k + 2] / 255);
    HSV.set(c, i * 3);
    gw[i] = faceFront(tx.P[i * 3], tx.P[i * 3 + 1], tx.P[i * 3 + 2]) || c[0] > 60 ? greenWeight(c) : 0;
  }
  const hsvOf = (i) => [HSV[i * 3], HSV[i * 3 + 1], HSV[i * 3 + 2]];

  // eyes: centre from the bright core, extent from the whole glowing eyeball
  const eyeBand = (y) => y > neckS.y + 0.04 && y < neckS.y + 0.14;
  const eyes = [-1, 1].map((side) => {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const x = tx.P[i * 3], y = tx.P[i * 3 + 1], z = tx.P[i * 3 + 2];
      if (Math.sign(x - center.x) !== side || !eyeBand(y) || !faceFront(x, y, z) || !isEyeball(hsvOf(i), 0.72)) continue;
      sx += x; sy += y; sz += z; n++;
    }
    const e = { side, x: sx / n, y: sy / n, z: sz / n };
    // extent: the glowing eyeball fades from white to green; use symmetric percentiles about the core
    const xs = [], ys = [];
    for (let i = 0; i < N; i++) {
      const dx = tx.P[i * 3] - e.x, dy = tx.P[i * 3 + 1] - e.y;
      if (Math.abs(dx) > 0.016 || Math.abs(dy) > 0.008 || tx.P[i * 3 + 2] < e.z - 0.01) continue;
      if (isEyeball(hsvOf(i), 0.5)) { xs.push(Math.abs(dx)); ys.push(Math.abs(dy)); }
    }
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const q = (a, f) => a[Math.floor(f * (a.length - 1))];
    e.hw = Math.min(0.0145, Math.max(0.0115, q(xs, 0.96)));
    e.hh = Math.min(0.006, Math.max(0.0045, q(ys, 0.96)));
    return e;
  });
  log('  eyes', eyes.map((e) => `${e.side > 0 ? 'L' : 'R'} (${e.x.toFixed(3)}, ${e.y.toFixed(3)}) ${(e.hw * 2000).toFixed(1)}x${(e.hh * 2000).toFixed(1)}mm`).join('  '));
  const eyeOf = (x) => eyes[x < center.x ? 0 : 1];
  // almond opening: upper lid higher and rounder than the lower; outer corner slightly lifted
  const almond = (e, dx, dy) => {
    const u = (dx * e.side) / e.hw; // -1 inner corner .. +1 outer corner
    if (Math.abs(u) >= 1) return { inside: false, edge: Infinity, u };
    const lift = 0.12 * e.hh * u;
    const top = e.hh * 1.05 * (1 - u * u) ** 0.62 + lift, bottom = -e.hh * 0.78 * (1 - u * u) ** 0.8 + lift * 0.6;
    return { inside: dy < top && dy > bottom, top, bottom, u, edge: Math.min(Math.abs(dy - top), Math.abs(dy - bottom)), upper: dy > (top + bottom) / 2 };
  };

  // 4. skin samples, hair colour, skin ORM
  const skin = new PointGrid(0.004);
  const ormSum = [0, 0, 0], hairSum = [0, 0, 0];
  let skinN = 0, hairN = 0;
  for (let i = 0; i < N; i++) {
    const k = tx.texel[i] * 3, x = tx.P[i * 3], y = tx.P[i * 3 + 1], z = tx.P[i * 3 + 2], c = hsvOf(i);
    if (isHair(c) && y > neckS.y + 0.12) { for (let j = 0; j < 3; j++) hairSum[j] += color.data[k + j]; hairN++; }
    if (i % 2 || gw[i] > 0.04 || tx.w[i] > 0.001 || !isSkinSample(c)) continue;
    skin.add(x, y, z, i);
    for (let j = 0; j < 3; j++) ormSum[j] += orm.data[k + j];
    skinN++;
  }
  const ormSkin = ormSum.map((s) => s / skinN), brow = hairSum.map((s) => (s / hairN) * 0.62);
  // fallback tone: average clean skin on the front of the face
  const faceTone = [0, 0, 0];
  let ftn = 0;
  for (let i = 0; i < N; i += 7) {
    if (!faceFront(tx.P[i * 3], tx.P[i * 3 + 1], tx.P[i * 3 + 2]) || gw[i] > 0.04 || tx.w[i] > 0.001 || !isSkinSample(hsvOf(i))) continue;
    for (let j = 0; j < 3; j++) faceTone[j] += color.data[tx.texel[i] * 3 + j];
    ftn++;
  }
  for (let j = 0; j < 3; j++) faceTone[j] /= ftn;
  const toneV = Math.max(...faceTone) / 255;
  // texels that the mask plate shadowed (dark, warm, right beside the plate) are repainted too
  const plate = new PointGrid(0.004);
  for (let i = 0; i < N; i += 3) if (gw[i] > 0.5 || tx.w[i] > 0.5) plate.add(tx.P[i * 3], tx.P[i * 3 + 1], tx.P[i * 3 + 2], i);
  const shadowed = (i) => {
    const v = HSV[i * 3 + 2];
    if (v > toneV * 0.8 || isHair(hsvOf(i)) && tx.P[i * 3 + 1] > neckS.y + 0.13) return 0;
    let near = 0;
    plate.near(tx.P[i * 3], tx.P[i * 3 + 1], tx.P[i * 3 + 2], 0.006, () => (near = 1));
    return near * smooth(toneV * 0.8, toneV * 0.55, v);
  };

  // 5. paint
  const out = Buffer.from(color.data);
  const lerpTexel = (img, k, target, t) => { for (let j = 0; j < 3; j++) img[k + j] = mix(img[k + j], target[j], t); };
  let painted = 0;
  for (let i = 0; i < N; i++) {
    const x = tx.P[i * 3], y = tx.P[i * 3 + 1], z = tx.P[i * 3 + 2], k = tx.texel[i] * 3;
    const e = eyeOf(x), dx = x - e.x, dy = y - e.y;
    const nearEye = faceFront(x, y, z) && Math.abs(dx) < e.hw * 1.6 && Math.abs(dy) < e.hh * 3.5 && z > e.z - 0.014;
    const al = nearEye ? almond(e, dx, dy) : { inside: false, edge: Infinity };
    const front = faceFront(x, y, z);
    const repaint = Math.max(gw[i], smooth(0, 0.5, tx.w[i]), front ? shadowed(i) : 0,
      nearEye && !al.inside ? smooth(e.hh * 3.5, e.hh * 2.2, Math.abs(dy)) * smooth(e.hw * 1.6, e.hw * 1.2, Math.abs(dx)) : 0);

    if (al.inside) { // the eye itself
      const R = 0.0057 * (e.hw / 0.0135), ix = dx, iy = dy + 0.0003, r = Math.hypot(ix, iy);
      let c;
      if (r < R * 0.36) c = [0.025, 0.02, 0.018];
      else if (r < R) {
        const t = (r - R * 0.36) / (R * 0.64), fib = 0.82 + 0.36 * hash(Math.floor(Math.atan2(iy, ix) * 22), 7);
        c = [mix(0.46, 0.2, t), mix(0.31, 0.12, t), mix(0.16, 0.065, t)].map((v) => v * fib);
        if (t > 0.86) c = c.map((v) => v * 0.5);
      } else {
        const corner = smooth(0.6, 1, Math.abs(al.u));
        c = [0.9, 0.87, 0.83].map((v) => v * (1 - 0.32 * corner));
      }
      const lid = 1 - 0.42 * smooth(al.top - e.hh * 0.55, al.top, dy); // upper-lid shadow
      c = c.map((v) => v * lid);
      if (Math.hypot(ix - R * 0.32, iy - R * 0.38) < R * 0.13) c = [0.97, 0.97, 0.97];
      lerpTexel(out, k, c.map((v) => v * 255), 1);
      lerpTexel(nmap.data, k, [128, 128, 255], 1);
      lerpTexel(orm.data, k, [255, 40, 0], 1); // wet: low roughness
      painted++;
      continue;
    }

    if (repaint > 0.003) {
      let acc = [0, 0, 0], wsum = 0;
      for (const rad of [0.022, 0.05, 0.09]) {
        const sigma2 = (rad * 0.42) ** 2;
        skin.near(x, y, z, rad, (j, d2) => {
          const w = Math.exp(-d2 / sigma2), kk = tx.texel[j] * 3;
          acc[0] += color.data[kk] * w; acc[1] += color.data[kk + 1] * w; acc[2] += color.data[kk + 2] * w; wsum += w;
        });
        if (wsum > 0.5) break;
      }
      // blend toward the face's average tone so the old plate area doesn't inherit baked shading
      if (wsum <= 1e-3) { acc = faceTone.slice(); wsum = 1; }
      acc = acc.map((v, j) => mix(v / wsum, faceTone[j], 0.35) * wsum);
      {
        const grain = 1 + (noise3(x * 400, y * 400, z * 400) - 0.5) * 0.06 + (noise3(x * 1300, y * 1300, z * 1300) - 0.5) * 0.035;
        lerpTexel(out, k, acc.map((v) => Math.min(255, (v / wsum) * grain)), repaint);
        lerpTexel(orm.data, k, ormSkin, repaint);
        lerpTexel(nmap.data, k, [128, 128, 255], repaint);
        painted++;
      }
    }
    if (!nearEye) continue;

    // lash line around the opening, heavier on the upper lid; lid crease; soft under-eye shadow
    if (al.edge !== Infinity) {
      const width = al.upper ? 0.0011 : 0.0006;
      const lash = (1 - smooth(width * 0.4, width, al.edge)) * (al.upper ? 0.78 : 0.45) * smooth(1, 0.82, Math.abs(al.u));
      lerpTexel(out, k, [38, 26, 20], lash);
      if (al.upper) {
        const crease = Math.exp(-(((dy - al.top - 0.0032) / 0.0011) ** 2)) * smooth(1, 0.5, Math.abs(al.u)) * 0.16;
        for (let j = 0; j < 3; j++) out[k + j] *= 1 - crease;
      } else {
        const under = smooth(0.006, 0.0015, al.bottom - dy) * smooth(0, 0.0012, al.bottom - dy) * 0.09;
        out[k] *= 1 - under; out[k + 1] *= 1 - under * 1.2; out[k + 2] *= 1 - under * 0.8;
      }
    }
    // eyebrow: an arched band of short strokes, full at the inner end, tapering to the tail
    const s = ((dx * e.side) / e.hw + 0.95) / 2.3; // 0 inner .. 1 outer
    if (s > 0 && s < 1) {
      const by = e.hh + 0.0108 + 0.0042 * Math.sin(Math.PI * Math.min(1, s * 1.35)) - 0.0032 * s * s;
      const t = mix(0.0066, 0.0022, s);
      const d = Math.abs(dy - by) / (t / 2);
      if (d < 1.2) {
        const strand = 0.5 + 0.5 * hash(Math.floor(s * 70 + (dy - by) / t * 3), Math.floor((dy - by) / t * 6));
        const a = (1 - smooth(0.5, 1.2, d)) * (0.55 + 0.45 * strand) * smooth(0, 0.07, s) * (1 - smooth(0.8, 1, s)) * 0.92;
        lerpTexel(out, k, brow, a);
      }
    }
  }
  log(`  painted ${painted} texels`);

  // 6. match the face's skin tone to the casual body's neck
  const bodySkin = [0, 0, 0], suitSkin = [0, 0, 0];
  let bn = 0, sn = 0;
  for (let i = 0; i < body.pos.length / 3; i++) {
    const y = body.pos[i * 3 + 1];
    if (y < neckB.y - 0.04 || y > neckB.y) continue;
    const c = texel(bodyColor, body.uv[i * 2], body.uv[i * 2 + 1]);
    if (!isSkinSample(hsv(...c))) continue;
    for (let j = 0; j < 3; j++) bodySkin[j] += c[j] * 255;
    bn++;
  }
  for (let i = 0; i < N; i++) {
    if (!isSkinSample(hsvOf(i)) || gw[i] > 0 || tx.P[i * 3 + 1] > neckS.y + 0.03) continue;
    const k = tx.texel[i] * 3;
    for (let j = 0; j < 3; j++) suitSkin[j] += out[k + j];
    sn++;
  }
  const gain = bodySkin.map((v, j) => (bn && sn ? Math.min(1.25, Math.max(0.8, v / bn / (suitSkin[j] / sn))) : 1));
  log(`  skin gain ${gain.map((g) => g.toFixed(2)).join(' ')} (body samples ${bn}, suit ${sn})`);
  for (let i = 0; i < N; i++) {
    const k = tx.texel[i] * 3, g = isHair(hsvOf(i)) ? 0.4 : 1;
    for (let j = 0; j < 3; j++) out[k + j] = Math.min(255, out[k + j] * (1 + (gain[j] - 1) * g));
  }

  // 7. place it on the body's neck and fit the overlapping neck ring to the body's neck surface
  for (let i = 0; i < nv; i++) {
    head.pos[i * 3] = (head.pos[i * 3] - neckS.cx) * scale + neckB.cx;
    head.pos[i * 3 + 1] = (head.pos[i * 3 + 1] - neckS.y) * scale + neckB.y;
    head.pos[i * 3 + 2] = (head.pos[i * 3 + 2] - neckS.cz) * scale + neckB.cz;
  }
  const BINS = 48, ringR = new Float32Array(BINS), ringN = new Float32Array(BINS);
  for (let i = 0; i < body.pos.length / 3; i++) {
    const y = body.pos[i * 3 + 1];
    if (y < neckB.y - 0.02 || y > neckB.y + 0.002) continue;
    const dx = body.pos[i * 3] - neckB.cx, dz = body.pos[i * 3 + 2] - neckB.cz;
    if (Math.hypot(dx, dz) > neckB.w) continue;
    const b = Math.floor(((Math.atan2(dz, dx) / Math.PI + 1) / 2) * BINS) % BINS;
    ringR[b] = Math.max(ringR[b], Math.hypot(dx, dz)); ringN[b]++;
  }
  for (let i = 0; i < nv; i++) {
    const y = head.pos[i * 3 + 1];
    const w = smooth(neckB.y + 0.02, neckB.y - 0.004, y);
    if (w <= 0) continue;
    const dx = head.pos[i * 3] - neckB.cx, dz = head.pos[i * 3 + 2] - neckB.cz, r = Math.hypot(dx, dz);
    const b = Math.floor(((Math.atan2(dz, dx) / Math.PI + 1) / 2) * BINS) % BINS;
    if (!ringN[b] || r < 1e-4) continue;
    const f = (r + (ringR[b] + 0.0012 - r) * w) / r;
    head.pos[i * 3] = neckB.cx + dx * f; head.pos[i * 3 + 2] = neckB.cz + dz * f;
  }
  computeNormals(head);
  const trimmed = subset(body, (a, b, c) => [a, b, c].every((v) => body.pos[v * 3 + 1] < neckB.y + 0.002));

  // pad colour outward from every UV island so downsampling never blends in the suit texels next door
  const covered = new Uint8Array(color.w * color.h);
  for (let i = 0; i < N; i++) covered[tx.texel[i]] = 1;
  for (const img of [out, orm.data, nmap.data]) padIslands(img, color.w, color.h, covered.slice(), 10);

  return {
    body: trimmed,
    head,
    images: {
      color: { bytes: await encodeImage({ ...color, data: out }, 'image/jpeg'), mime: 'image/jpeg' },
      orm: { bytes: await encodeImage(orm, 'image/jpeg'), mime: 'image/jpeg' },
      normal: { bytes: await encodeImage(nmap, 'image/png'), mime: 'image/png' },
    },
  };
}

// Grow each island's border texels outward `steps` times (classic texture edge padding).
function padIslands(img, W, H, covered, steps) {
  for (let s = 0; s < steps; s++) {
    const grow = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (covered[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X;
        if (!covered[j]) continue;
        r += img[j * 3]; g += img[j * 3 + 1]; b += img[j * 3 + 2]; n++;
      }
      if (n) grow.push(i, r / n, g / n, b / n);
    }
    for (let q = 0; q < grow.length; q += 4) {
      const i = grow[q];
      img[i * 3] = grow[q + 1]; img[i * 3 + 1] = grow[q + 2]; img[i * 3 + 2] = grow[q + 3];
      covered[i] = 1;
    }
  }
}
