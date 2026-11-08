// Debug: textured renders of a built model's primitives.
//   node tools/inspect-model.mjs public/models/hal_casual.glb <out-dir> [primitive index] [min y]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { renderViews } from './debug-render.mjs';

const [file, out, primArg, minYArg] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const prims = doc.getRoot().listMeshes()[0].listPrimitives();
const name = file.split('/').pop().replace('.glb', '');
for (const [pi, prim] of prims.entries()) {
  if (primArg !== undefined && primArg !== 'all' && Number(primArg) !== pi) continue;
  const pos = prim.getAttribute('POSITION').getArray(), uv = prim.getAttribute('TEXCOORD_0').getArray(), I = prim.getIndices().getArray();
  const minY = minYArg ? Number(minYArg) : -Infinity;
  const idx = [];
  for (let t = 0; t < I.length; t += 3) if ([I[t], I[t + 1], I[t + 2]].every((v) => pos[v * 3 + 1] > minY)) idx.push(I[t], I[t + 1], I[t + 2]);
  const { data, info } = await sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await renderViews({ pos, idx: Uint32Array.from(idx), uv, texture: { data, w: info.width, h: info.height }, file: `${out}/${name}_p${pi}.png`, size: 640, views: ['front', 'three', 'side'] });
  console.log(`${name} primitive ${pi}: ${idx.length / 3} tris`);
}
