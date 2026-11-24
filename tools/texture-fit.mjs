// Textures sized to how they're seen, then GPU-compressed (tools/build-props.mjs, tools/build-people.mjs,
// tools/fetch-textures.mjs). Each is capped at the size its thing needs on screen (`cap`), then brought down to
// the smallest power-of-two fraction of that which still rebuilds it: shrunk, scaled back up the way the GPU
// magnifies (bilinear), and compared with the capped image tile by tile. A flat map (a uniform metal-roughness,
// a normal map with nothing on it, a plain paint colour) comes down to a few texels; text, edges and grain keep
// their size, since a 16-texel tile with any of them in it misses by more than the tolerance.
//
// Written as KTX2, UASTC (Basis Universal's `basisu`, Apache-2.0: `brew install basis_universal`), mipmapped
// and zstd-packed. On the GPU it's ASTC 4×4 or BC7 (one byte a texel, a quarter of RGBA8) and near-lossless:
// a face's colour map rebuilds at 51.7 dB, against 40.3 dB for the WebP the game used before (q88) and 37.8 dB
// for Basis's smaller ETC1S mode. Lossy WebP also halves the colour channels' resolution (YUV 4:2:0), which on a
// metal-roughness map smears the metal mask across small parts: a police car's chrome handles had lost their
// metal (26.7 dB, errors to 158 levels; 47.8 dB now). The files are about three times a WebP's. The game reads
// them with three's KTX2Loader (src/engine/Ktx2.js).
//
//   await doc.transform(fitTextures({ cap: (slot, texture) => 1024 }))
//   slot: 'color', 'normal', 'mr' (metal-roughness, occlusion), 'emissive' or 'other' (the texture's first use)
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KHRTextureBasisu, EXTTextureWebP } from '@gltf-transform/extensions';
import { listTextureSlots } from '@gltf-transform/functions';

// the error allowed, in 8-bit levels: the worst 16×16 tile's mean, and the whole image's mean (the worst channel
// at each texel, weighted by alpha: what's cut away doesn't count, the alpha itself does)
export const TOLERANCE = {
  color: { tile: 3, mean: 0.75 },
  emissive: { tile: 3, mean: 0.75 },
  normal: { tile: 4, mean: 1 },
  mr: { tile: 5, mean: 1.25 },
  other: { tile: 3, mean: 0.75 },
};
const TILE = 16, SMALLEST = 4; // (4: a compressed block)

export const slotOf = (names) => {
  const n = names.join(' ');
  if (/baseColor|diffuse/i.test(n)) return 'color';
  if (/normal/i.test(n)) return 'normal';
  if (/emissive/i.test(n)) return 'emissive';
  if (/metallicRoughness|occlusion|specularGlossiness|roughness/i.test(n)) return 'mr';
  return 'other';
};
const raw = (buf, w, h) => sharp(buf, { raw: { width: w, height: h, channels: 4 } });
const resize = (buf, w, h, to, kernel = 'lanczos3') => raw(buf, w, h).resize(to[0], to[1], { kernel, fit: 'fill' }).raw().toBuffer();

// how far `b` is from `a` (both w×h RGBA): the worst tile's mean and the overall mean
function error(a, b, w, h) {
  const tx = Math.ceil(w / TILE), ty = Math.ceil(h / TILE), sum = new Float64Array(tx * ty), cnt = new Uint32Array(tx * ty);
  let total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // (the worst channel: a metal-roughness map's one used channel isn't watered down by the others)
    const i = (y * w + x) * 4, k = a[i + 3] / 255;
    const e = Math.max(Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) * k, Math.abs(a[i + 3] - b[i + 3]));
    const t = ((y / TILE) | 0) * tx + ((x / TILE) | 0);
    sum[t] += e; cnt[t]++; total += e;
  }
  let tile = 0;
  for (let t = 0; t < sum.length; t++) tile = Math.max(tile, sum[t] / cnt[t]);
  return { tile, mean: total / (w * h) };
}

// the size one image needs: [w, h] at most `cap` on its long side, halved while it still rebuilds within `tol`.
// `rgba`: the image at that size (the reference), `alpha`: whether any of it is see-through
export async function fitImage(image, cap, tol) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let w = info.width, h = info.height, ref = data;
  const k = Math.min(1, cap / Math.max(w, h));
  if (k < 1) { const to = [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; ref = await resize(ref, w, h, to); [w, h] = to; }
  let best = [w, h], miss = null, rgba = ref;
  for (let d = 2; Math.min(w, h) / d >= SMALLEST; d *= 2) {
    const to = [Math.round(w / d), Math.round(h / d)];
    const small = await resize(ref, w, h, to);
    const e = error(ref, await resize(small, to[0], to[1], [w, h], 'linear'), w, h);
    if (e.tile > tol.tile || e.mean > tol.mean) { miss = e; break; }
    best = to; rgba = small;
  }
  let alpha = false;
  for (let i = 3; i < rgba.length && !alpha; i += 4) alpha = rgba[i] < 255;
  return { from: [info.width, info.height], to: best, capped: [w, h], miss, rgba, alpha };
}

// one image (w×h RGBA) to KTX2: UASTC with mips, the colour space and metrics by slot. `flipY`: rows bottom
// first, for a texture loaded outside glTF (three flips those at upload, as TextureLoader's `flipY`, and can't
// flip a compressed one: unflipped, a normal map's green turns round and the bumps light from below)
const run = promisify(execFile);
let scratch = null;
export async function encodeKtx2(rgba, [w, h], slot, alpha, { flipY = false } = {}) {
  scratch ??= await mkdtemp(join(tmpdir(), 'gl-ktx2-'));
  const n = Math.random().toString(36).slice(2), png = join(scratch, `${n}.png`), out = join(scratch, `${n}.ktx2`);
  await (alpha ? raw(rgba, w, h) : raw(rgba, w, h).removeAlpha()).png({ compressionLevel: 1 }).toFile(png);
  const space = slot === 'normal' ? ['-normal_map'] : slot === 'color' || slot === 'emissive' ? ['-srgb'] : ['-linear'];
  try {
    await run('basisu', ['-ktx2', '-uastc', '-uastc_level', '2', '-mipmap', '-ktx2_zstandard_level', '19', ...space, ...(flipY ? ['-y_flip'] : []), '-file', png, '-output_file', out], { maxBuffer: 1 << 26 });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error('basisu is missing: brew install basis_universal');
    throw e;
  }
  const buf = await readFile(out);
  await rm(png); await rm(out);
  return new Uint8Array(buf);
}

// A map that's one colour all over (within two levels) is no map: its colour goes into the material's factors and
// a flat normal map goes, as gltf-transform's prune does for exactly solid ones (it can't read KTX2, and a map
// resized or recompressed is seldom exactly solid). Returns whether the texture is used still.
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function fold(t, rgba) {
  const lo = [255, 255, 255, 255], hi = [0, 0, 0, 0], sum = [0, 0, 0, 0];
  for (let i = 0; i < rgba.length; i += 4) for (let c = 0; c < 4; c++) { const v = rgba[i + c]; lo[c] = Math.min(lo[c], v); hi[c] = Math.max(hi[c], v); sum[c] += v; }
  if (hi.some((h, c) => h - lo[c] > 2)) return true;
  const v = sum.map((s) => s / (rgba.length / 4) / 255), near = (a, b) => Math.abs(a - b) <= 2 / 255;
  for (const m of t.listParents().filter((p) => p.propertyType === 'Material')) {
    if (m.getBaseColorTexture() === t) { const f = m.getBaseColorFactor(); m.setBaseColorFactor([f[0] * linear(v[0]), f[1] * linear(v[1]), f[2] * linear(v[2]), f[3] * v[3]]).setBaseColorTexture(null); }
    if (m.getEmissiveTexture() === t) { const f = m.getEmissiveFactor(); m.setEmissiveFactor([f[0] * linear(v[0]), f[1] * linear(v[1]), f[2] * linear(v[2])]).setEmissiveTexture(null); }
    const ao = m.getOcclusionTexture() === t;
    if (m.getMetallicRoughnessTexture() === t && (!ao || near(v[0], 1))) m.setRoughnessFactor(m.getRoughnessFactor() * v[1]).setMetallicFactor(m.getMetallicFactor() * v[2]).setMetallicRoughnessTexture(null);
    if (ao && near(v[0], 1) && m.getMetallicRoughnessTexture() !== t) m.setOcclusionTexture(null);
    if (m.getNormalTexture() === t && near(v[0], 0.5) && near(v[1], 0.5) && near(v[2], 1)) m.setNormalTexture(null);
  }
  if (t.listParents().some((p) => p.propertyType === 'Material')) return true;
  t.dispose();
  return false;
}

// the transform: every texture in the document fitted and written as KTX2; `report(rows)` gets what was done
export function fitTextures({ cap = () => 1024, tolerance = TOLERANCE, report = null } = {}) {
  return async (doc) => {
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    const rows = [];
    for (const t of doc.getRoot().listTextures()) {
      const img = t.getImage();
      if (!img) continue;
      const slot = slotOf(listTextureSlots(t));
      const f = await fitImage(img, cap(slot, t), tolerance[slot]);
      if (!fold(t, f.rgba)) { rows.push({ name: t.getName() || t.getURI(), slot, from: f.from, to: [0, 0], folded: true, bytes: 0 }); continue; }
      t.setImage(await encodeKtx2(f.rgba, f.to, slot, f.alpha)).setMimeType('image/ktx2');
      if (t.getURI()) t.setURI(t.getURI().replace(/\.\w+$/, '.ktx2'));
      rows.push({ name: t.getName() || t.getURI(), slot, from: f.from, to: f.to, miss: f.miss, bytes: t.getImage().byteLength });
    }
    for (const e of doc.getRoot().listExtensionsUsed()) if (e instanceof EXTTextureWebP) e.dispose();
    report?.(rows);
  };
}

// How big a texture needs to be for its thing seen from `near` metres: one texel to a pixel of a frame `height`
// pixels tall through the game's lens (55° up and down). Each triangle using it asks for (pixels a metre there)
// × √(its area / its area in UV); the answer is what 90% of the surface (by area) is satisfied with, rounded
// up to a power of two. Use it as a ceiling over a cap: a small thing's parts each with a 1024 map of their own
// (a cash register's keys) come down, a big thing's atlas keeps its cap.
export function neededSize(texture, { near = 2, height = 1440, fov = 55 } = {}) {
  const perM = height / (2 * near * Math.tan((fov / 2) * Math.PI / 180));
  const asks = [];
  for (const mat of texture.listParents().filter((p) => p.propertyType === 'Material')) {
    for (const prim of mat.listParents().filter((p) => p.propertyType === 'Primitive')) {
      const P = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0');
      if (!P || !UV) continue;
      const I = prim.getIndices(), n = I ? I.getCount() : P.getCount();
      for (const mesh of prim.listParents().filter((p) => p.propertyType === 'Mesh')) for (const node of mesh.listParents().filter((p) => p.propertyType === 'Node')) {
        const m = node.getWorldMatrix(), a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], ua = [0, 0], ub = [0, 0], uc = [0, 0];
        const at = (i, o) => { P.getElement(i, o); const [x, y, z] = o; o[0] = m[0] * x + m[4] * y + m[8] * z; o[1] = m[1] * x + m[5] * y + m[9] * z; o[2] = m[2] * x + m[6] * y + m[10] * z; };
        for (let t = 0; t + 2 < n; t += 3) {
          const i0 = I ? I.getScalar(t) : t, i1 = I ? I.getScalar(t + 1) : t + 1, i2 = I ? I.getScalar(t + 2) : t + 2;
          at(i0, a); at(i1, b); at(i2, c); UV.getElement(i0, ua); UV.getElement(i1, ub); UV.getElement(i2, uc);
          const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], f = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const world = Math.hypot(e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]) / 2;
          const uv = Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1])) / 2;
          if (world > 1e-10 && uv > 1e-12) asks.push([perM * Math.sqrt(world / uv), world]);
        }
      }
    }
  }
  if (!asks.length) return Infinity;
  asks.sort((x, y) => x[0] - y[0]);
  const total = asks.reduce((s, x) => s + x[1], 0);
  let acc = 0, need = asks.at(-1)[0];
  for (const [ask, w] of asks) if ((acc += w) >= total * 0.9) { need = ask; break; }
  return 2 ** Math.ceil(Math.log2(Math.max(need, SMALLEST)));
}

// GPU bytes: RGBA8 with mips, and the one-byte-a-texel blocks the KTX2 files become
export const gpuBytes = ([w, h], bpp = 4) => w * h * bpp * 4 / 3;

// a build's summary line from its rows
export const fitted = (rows) => {
  const was = rows.reduce((s, r) => s + gpuBytes(r.from), 0), now = rows.reduce((s, r) => s + gpuBytes(r.to, 1), 0);
  return `${rows.length} textures, ${(was / 1e6).toFixed(1)} → ${(now / 1e6).toFixed(1)} MB on the GPU (${rows.map((r) => `${r.slot[0]}${r.to[0]}`).join(' ')})`;
};
