// Software rasterizer for checking rigs without a browser: renders front/side/back views,
// optionally re-posed with linear blend skinning.
import * as THREE from 'three';
import sharp from 'sharp';

const BONE_COLORS = [
  [0.9, 0.9, 0.9], [0.7, 0.7, 0.2], [0.9, 0.6, 0.1], [0.5, 0.3, 0.9], [1, 0.3, 0.6],
  [0.1, 0.6, 1], [0.1, 0.9, 0.9], [0.2, 1, 0.5], [1, 0.2, 0.2], [1, 0.5, 0.4], [0.8, 0.1, 0.4],
  [0.3, 0.4, 1], [0.5, 0.6, 1], [0.7, 0.8, 1], [0.2, 0.7, 0.2], [0.4, 0.8, 0.3], [0.7, 1, 0.5],
];

export function boneColors(skinIndex, skinWeight) {
  const n = skinIndex.length / 4, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    const c = BONE_COLORS[skinIndex[i * 4 + k]], w = skinWeight[i * 4 + k];
    out[i * 3] += c[0] * w; out[i * 3 + 1] += c[1] * w; out[i * 3 + 2] += c[2] * w;
  }
  return out;
}

export async function textureColors(uv, imageBytes) {
  const { data, info } = await sharp(Buffer.from(imageBytes)).raw().toBuffer({ resolveWithObject: true });
  const n = uv.length / 2, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor(uv[i * 2] * info.width)));
    const y = Math.min(info.height - 1, Math.max(0, Math.floor(uv[i * 2 + 1] * info.height)));
    const t = (y * info.width + x) * info.channels;
    out[i * 3] = data[t] / 255; out[i * 3 + 1] = data[t + 1] / 255; out[i * 3 + 2] = data[t + 2] / 255;
  }
  return out;
}

// pose: { boneName: THREE.Quaternion (local, relative to bind) }
export function skinPositions(pos, skinIndex, skinWeight, joints, pose) {
  const world = joints.map(() => new THREE.Matrix4());
  const byName = Object.fromEntries(joints.map((j, i) => [j.name, i]));
  joints.forEach((j, i) => {
    const p = j.parent ? joints[byName[j.parent]].pos : [0, 0, 0];
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(j.pos[0] - p[0], j.pos[1] - p[1], j.pos[2] - p[2]),
      pose[j.name] ?? new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    world[i] = j.parent ? world[byName[j.parent]].clone().multiply(local) : local;
  });
  const skin = world.map((w, i) => w.clone().multiply(new THREE.Matrix4().makeTranslation(-joints[i].pos[0], -joints[i].pos[1], -joints[i].pos[2])));
  const out = new Float32Array(pos.length), v = new THREE.Vector3(), acc = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (let i = 0; i < pos.length / 3; i++) {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = skinWeight[i * 4 + k];
      if (w > 0) acc.addScaledVector(tmp.copy(v).applyMatrix4(skin[skinIndex[i * 4 + k]]), w);
    }
    out[i * 3] = acc.x; out[i * 3 + 1] = acc.y; out[i * 3 + 2] = acc.z;
  }
  return { positions: out, jointWorld: world.map((w) => new THREE.Vector3().setFromMatrixPosition(w)) };
}

// `colors` are per-vertex; pass `uv` + `texture` ({ data, w, h }, RGB) to texture per pixel instead.
export async function renderViews({ pos, idx, colors, uv, texture, joints = [], file, size = 520, views: viewNames }) {
  // view: screen-x axis, screen-y axis, toward-viewer axis
  const ALL = {
    front: { sx: [1, 0, 0], sy: [0, 1, 0], dz: [0, 0, 1] },
    side: { sx: [0, 0, -1], sy: [0, 1, 0], dz: [1, 0, 0] }, // from +X
    back: { sx: [-1, 0, 0], sy: [0, 1, 0], dz: [0, 0, -1] },
    three: { sx: [0.8, 0, -0.6], sy: [0, 1, 0], dz: [0.6, 0, 0.8] }, // three-quarter front
  };
  const views = (viewNames ?? ['front', 'side', 'back']).map((n) => ALL[n]);
  // frame the vertices the triangles actually use, so a subset (e.g. just the head) fills the view
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < idx.length; t++) {
    const i = idx[t] * 3;
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]); }
  }
  const c = mn.map((v, k) => (v + mx[k]) / 2);
  const ext = Math.max(...mx.map((v, k) => v - mn[k]));
  const scale = (size * 0.92) / ext;
  const tiles = [];
  for (const vw of views) {
    const img = Buffer.alloc(size * size * 3, 34);
    const zb = new Float32Array(size * size).fill(-Infinity);
    const proj = (i) => {
      const x = pos[i * 3] - c[0], y = pos[i * 3 + 1] - c[1], z = pos[i * 3 + 2] - c[2];
      return [size / 2 + (x * vw.sx[0] + y * vw.sx[1] + z * vw.sx[2]) * scale,
        size / 2 - (x * vw.sy[0] + y * vw.sy[1] + z * vw.sy[2]) * scale,
        x * vw.dz[0] + y * vw.dz[1] + z * vw.dz[2]];
    };
    for (let t = 0; t < idx.length; t += 3) {
      const ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
      const a = proj(ia), b = proj(ib), d = proj(ic);
      const area = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      if (Math.abs(area) < 1e-9) continue;
      // face normal in world space for lambert shading
      const e1 = [pos[ib * 3] - pos[ia * 3], pos[ib * 3 + 1] - pos[ia * 3 + 1], pos[ib * 3 + 2] - pos[ia * 3 + 2]];
      const e2 = [pos[ic * 3] - pos[ia * 3], pos[ic * 3 + 1] - pos[ia * 3 + 1], pos[ic * 3 + 2] - pos[ia * 3 + 2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      const facing = Math.abs((nx * vw.dz[0] + ny * vw.dz[1] + nz * vw.dz[2]) / nl);
      // soft key light from upper front-left, plus fill
      const key = Math.max(0, (nx * -0.35 + ny * 0.45 + nz * 0.82) / nl * (vw.dz[2] >= 0 ? 1 : -1));
      const shade = texture ? 0.32 + 0.5 * facing + 0.3 * key : 0.35 + 0.65 * facing;
      const col = texture ? null : [0, 1, 2].map((k) => Math.min(255, ((colors[ia * 3 + k] + colors[ib * 3 + k] + colors[ic * 3 + k]) / 3) * shade * 255));
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], d[0]))), x1 = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], d[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], d[1]))), y1 = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], d[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (d[1] - py) - (b[1] - py) * (d[0] - px)) / area;
        const w1 = ((d[0] - px) * (a[1] - py) - (d[1] - py) * (a[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * d[2];
        const k = y * size + x;
        if (z <= zb[k]) continue;
        zb[k] = z;
        if (texture) {
          const u = w0 * uv[ia * 2] + w1 * uv[ib * 2] + w2 * uv[ic * 2], v = w0 * uv[ia * 2 + 1] + w1 * uv[ib * 2 + 1] + w2 * uv[ic * 2 + 1];
          const tx = Math.min(texture.w - 1, Math.max(0, Math.floor(u * texture.w))), ty = Math.min(texture.h - 1, Math.max(0, Math.floor(v * texture.h)));
          const t = (ty * texture.w + tx) * 3;
          for (let c = 0; c < 3; c++) img[k * 3 + c] = Math.min(255, texture.data[t + c] * shade);
        } else {
          img[k * 3] = col[0]; img[k * 3 + 1] = col[1]; img[k * 3 + 2] = col[2];
        }
      }
    }
    for (const j of joints) {
      const x = j[0] - c[0], y = j[1] - c[1], z = j[2] - c[2];
      const px = Math.round(size / 2 + (x * vw.sx[0] + y * vw.sx[1] + z * vw.sx[2]) * scale);
      const py = Math.round(size / 2 - (x * vw.sy[0] + y * vw.sy[1] + z * vw.sy[2]) * scale);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = px + dx, Y = py + dy;
        if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
        const k = Y * size + X;
        img[k * 3] = 255; img[k * 3 + 1] = 30; img[k * 3 + 2] = 30;
      }
    }
    tiles.push({ input: await sharp(img, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer(), left: tiles.length * size, top: 0 });
  }
  await sharp({ create: { width: size * tiles.length, height: size, channels: 3, background: '#222' } }).composite(tiles).png().toFile(file);
}
