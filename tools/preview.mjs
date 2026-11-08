// Renders quick point-splat previews of a GLB from the 6 axis directions (debug aid).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , input, outPrefix] = process.argv;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const tex = prim.getMaterial().getBaseColorTexture();
const { data: px, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
console.log('tex', info.width, info.height, info.channels, 'verts', pos.length / 3);

const S = 400;
// view: [horizontal axis, vertical axis, depth axis, depth sign]
const views = { 'x+': [2, 1, 0, 1], 'x-': [2, 1, 0, -1], 'y+': [0, 2, 1, 1], 'z+': [0, 1, 2, 1], 'z-': [0, 1, 2, -1], 'y-': [0, 2, 1, -1] };
const tiles = [];
for (const [name, [h, v, d, sgn]] of Object.entries(views)) {
  const img = Buffer.alloc(S * S * 3, 40);
  const zb = new Float32Array(S * S).fill(-Infinity);
  for (let i = 0; i < pos.length / 3; i++) {
    const x = Math.floor((pos[i * 3 + h] * (sgn > 0 ? 1 : -1) + 0.5) * S);
    const y = Math.floor((0.5 - pos[i * 3 + v]) * S);
    const z = pos[i * 3 + d] * sgn;
    if (x < 0 || y < 0 || x >= S || y >= S) continue;
    const k = y * S + x;
    if (z <= zb[k]) continue;
    zb[k] = z;
    const tu = Math.min(info.width - 1, Math.max(0, Math.floor(uv[i * 2] * info.width)));
    const tv = Math.min(info.height - 1, Math.max(0, Math.floor(uv[i * 2 + 1] * info.height)));
    const t = (tv * info.width + tu) * info.channels;
    img[k * 3] = px[t]; img[k * 3 + 1] = px[t + 1]; img[k * 3 + 2] = px[t + 2];
  }
  tiles.push({ input: await sharp(img, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer(), left: tiles.length * S, top: 0 });
  console.log('view', name);
}
await sharp({ create: { width: S * tiles.length, height: S, channels: 3, background: '#222' } }).composite(tiles).png().toFile(`${outPrefix}.png`);
