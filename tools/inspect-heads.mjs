// Debug: close-up renders of the head of each figure in the raw scans (full scan detail, no
// decimation), to judge face quality.   node tools/inspect-heads.mjs <out-dir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { renderViews, textureColors } from './debug-render.mjs';

const out = process.argv[2];
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// [file, figure side (sign of z) or 0 for single-figure scans, which way that figure faces (+1 = +X)]
const FIGURES = [['assets/raw/hal_a.glb', -1, -1, 'casual_zneg'], ['assets/raw/hal_a.glb', 1, 1, 'casual_zpos'], ['assets/raw/hal_b.glb', 0, 1, 'lantern']];

for (const [file, side, facing, name] of FIGURES) {
  const doc = await io.read(file);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const P = prim.getAttribute('POSITION'), T = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices().getArray();
  const n = P.getCount(), e3 = [0, 0, 0], e2 = [0, 0];
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    P.getElement(i, e3);
    // orient Y-up, facing +Z (same mapping as build-assets)
    const [x, y, z] = e3;
    pos.set(facing > 0 ? [-z, y, x] : [z, y, -x], i * 3);
    T.getElement(i, e2); uv.set(e2, i * 2);
  }
  // keep this figure, then its top 13% (head and neck)
  let minY = Infinity, maxY = -Infinity;
  // original z = -x' for figures facing +X, +x' for figures facing -X
  const keep = (v) => side === 0 || Math.sign(facing > 0 ? -pos[v * 3] : pos[v * 3]) === side;
  for (let i = 0; i < n; i++) if (keep(i)) { minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1]); }
  const cut = maxY - (maxY - minY) * 0.13;
  const tris = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (keep(a) && pos[a * 3 + 1] > cut && pos[b * 3 + 1] > cut && pos[c * 3 + 1] > cut) tris.push(a, b, c);
  }
  const colors = await textureColors(uv, prim.getMaterial().getBaseColorTexture().getImage());
  await renderViews({ pos, idx: Uint32Array.from(tris), colors, file: `${out}/head_${name}.png`, size: 600 });
  console.log(name, tris.length / 3, 'head tris');
}
