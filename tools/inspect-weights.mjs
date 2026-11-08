// Debug: head close-up of a built model coloured by skin weight (red = head bone, blue = neck,
// green = chest), to check the head/neck split.   node tools/inspect-weights.mjs <glb> <out.png> [min y]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { renderViews } from './debug-render.mjs';

const [file, out, minYArg] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray(), J = prim.getAttribute('JOINTS_0').getArray(), W = prim.getAttribute('WEIGHTS_0').getArray(), I = prim.getIndices().getArray();
const n = pos.length / 3, colors = new Float32Array(n * 3);
for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
  const j = J[i * 4 + k], w = W[i * 4 + k];
  if (j === 4) colors[i * 3] += w; else if (j === 3) colors[i * 3 + 2] += w; else if (j === 2) colors[i * 3 + 1] += w;
}
const minY = Number(minYArg ?? 1.45), idx = [];
for (let t = 0; t < I.length; t += 3) if ([I[t], I[t + 1], I[t + 2]].every((v) => pos[v * 3 + 1] > minY)) idx.push(I[t], I[t + 1], I[t + 2]);
await renderViews({ pos, idx: Uint32Array.from(idx), colors, file: out, size: 520, views: ['front', 'three', 'side'] });
