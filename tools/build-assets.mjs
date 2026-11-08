// Turns the raw Tripo scans into game-ready, auto-rigged GLBs in public/models:
// orient (Y-up, facing +Z), scale, simplify, rig with a procedural humanoid skeleton, and shrink the
// textures. Optional per-model `keepSide` splits a two-figure sheet (Kilowog), `rig` passes landmark
// overrides to autoRig (Kilowog), and `head` transplants another scan's head (headswap.mjs; only the
// older casual scan used it, kept commented out below).
//
//   node tools/build-assets.mjs            build everything
//   ONLY=abin_sur node tools/...           build one model
//   DEBUG_DIR=/some/dir node tools/...     also write rig preview PNGs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { autoRig } from './autorig.mjs';
import { transplantHead, decodeImage } from './headswap.mjs';
import { renderViews, boneColors, textureColors, skinPositions } from './debug-render.mjs';

const DEBUG_DIR = process.env.DEBUG_DIR;
const ONLY = process.env.ONLY;

const MODELS = [
  { name: 'hal_casual', src: 'assets/raw/Hal-Improved.glb', facing: 1, tris: 100000, height: 1.83 },
  // Older casual sheet (two figures; z < 0 faces -X), with the suit scan's head transplanted:
  // { name: 'hal_casual', src: 'assets/raw/hal_a.glb', keepSide: -1, tris: 80000, height: 1.83, head: { src: 'assets/raw/hal_b.glb', facing: 1, tris: 36000 } },
  { name: 'hal_lantern', src: 'assets/raw/hal_b.glb', facing: 1, tris: 90000, height: 1.83 },
  { name: 'abin_sur', src: 'assets/raw/Abin.glb', facing: 1, tris: 90000, height: 1.96 },
  // Two figures side by side along z (front-sheet and back-sheet generations). Keep the z > 0 one:
  // it faces +X, has the ring on his right hand and the pinker skin. His proportions are far from
  // human (no visible neck, an armour collar rising behind the head, shoulders under big
  // pauldrons), so the rig gets landmark overrides (autorig.mjs RIG_DEFAULTS), measured on the scan.
  {
    name: 'kilowog', src: 'assets/raw/Kilowog.glb', keepSide: 1, facing: 1, tris: 90000, height: 2.4,
    rig: { neckMid: 0.858, jawBack: 0.07, neckBack: -0.08, headFill: true, neckColumn: true, shoulder: [0.18, 0.74], armMinX: 0.12, armRadius: 1.6, legX: 0.2, hipX: 0.083, knee: 0.27 },
  },
];

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await mkdir('public/models', { recursive: true });

async function readScan(file, opts, height) {
  const doc = await io.read(file);
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  const buffer = doc.getRoot().listBuffers()[0];
  const meshNode = doc.getRoot().listNodes().find((nd) => nd.getMesh());
  const prim = meshNode.getMesh().listPrimitives()[0];
  normalizeGeometry(doc, buffer, prim, opts, height);
  return { doc, buffer, meshNode, prim };
}

const arrays = (prim) => ({
  pos: prim.getAttribute('POSITION').getArray().slice(),
  nrm: prim.getAttribute('NORMAL').getArray().slice(),
  uv: prim.getAttribute('TEXCOORD_0').getArray().slice(),
  idx: prim.getIndices().getArray().slice(),
});

function setArrays(doc, buffer, prim, m) {
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer));
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.nrm).setBuffer(buffer));
  prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(m.uv).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(m.idx).setBuffer(buffer));
}

for (const model of MODELS) {
  if (ONLY && ONLY !== model.name) continue;
  const t0 = Date.now();
  const H = model.height;
  const { doc, buffer, meshNode, prim } = await readScan(model.src, model, H);
  meshNode.setName(model.name);
  const trisBefore = prim.getIndices().getCount() / 3;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: model.tris / trisBefore, error: 0.01 }));
  console.log(`${model.name}: ${trisBefore} -> ${prim.getIndices().getCount() / 3} tris`);
  const prims = [prim];

  if (model.head) {
    const suit = await readScan(model.head.src, model.head, H);
    const mat = suit.prim.getMaterial();
    const img = (tex) => ({ bytes: tex.getImage(), mime: tex.getMimeType() });
    const swap = await transplantHead({
      body: arrays(prim),
      bodyColor: await decodeImage(prim.getMaterial().getBaseColorTexture().getImage()),
      suit: arrays(suit.prim),
      images: { color: img(mat.getBaseColorTexture()), orm: img(mat.getMetallicRoughnessTexture()), normal: img(mat.getNormalTexture()) },
      H,
      headTris: model.head.tris,
    });
    // the suit head is proportionally smaller than the casual scan's, so restore the full height
    let top = 0;
    for (const m of [swap.body, swap.head]) for (let i = 1; i < m.pos.length; i += 3) top = Math.max(top, m.pos[i]);
    for (const m of [swap.body, swap.head]) for (let i = 0; i < m.pos.length; i++) m.pos[i] *= H / top;
    console.log(`  height ${top.toFixed(3)} -> ${H}`);
    setArrays(doc, buffer, prim, swap.body);
    const tex = (name, { bytes, mime }) => doc.createTexture(name).setImage(bytes).setMimeType(mime);
    const headMat = doc.createMaterial('hal_head')
      .setBaseColorTexture(tex('head_color', swap.images.color))
      .setMetallicRoughnessTexture(tex('head_orm', swap.images.orm))
      .setNormalTexture(tex('head_normal', swap.images.normal))
      .setRoughnessFactor(1).setMetallicFactor(1);
    const headPrim = doc.createPrimitive().setMaterial(headMat);
    setArrays(doc, buffer, headPrim, swap.head);
    meshNode.getMesh().addPrimitive(headPrim);
    prims.push(headPrim);
  }

  // rig all parts together so the skeleton is placed from the whole figure
  const parts = prims.map(arrays);
  const nTotal = parts.reduce((s, p) => s + p.pos.length / 3, 0);
  const pos = new Float32Array(nTotal * 3), idx = [];
  let off = 0;
  for (const p of parts) {
    pos.set(p.pos, off * 3);
    for (const i of p.idx) idx.push(i + off);
    off += p.pos.length / 3;
  }
  const rig = autoRig(pos, Uint32Array.from(idx), H, model.rig);
  console.log('  landmarks', Object.fromEntries(Object.entries(rig.landmarks).map(([k, v]) => [k, +v.toFixed(3)])));
  addSkin(doc, buffer, meshNode, prims, rig);

  if (DEBUG_DIR) await debugRender(model, prims, pos, Uint32Array.from(idx), rig);

  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(baseColor|normal)/, resize: [2048, 2048], quality: 88 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^metallicRoughness/, resize: [1024, 1024], quality: 85 }),
    prune(),
  );
  await io.write(`public/models/${model.name}.glb`, doc);
  console.log(`  wrote public/models/${model.name}.glb in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function normalizeGeometry(doc, buffer, prim, { keepSide, facing }, HEIGHT) {
  const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), T = prim.getAttribute('TEXCOORD_0');
  const srcIdx = prim.getIndices().getArray();
  const count = P.getCount();
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const e3 = [0, 0, 0], e2 = [0, 0];
  for (let i = 0; i < count; i++) {
    P.getElement(i, e3); pos.set(e3, i * 3);
    N.getElement(i, e3); nrm.set(e3, i * 3);
    T.getElement(i, e2); uv.set(e2, i * 2);
  }

  // Keep one figure: triangles on the chosen side of z = 0. That figure faces -X for z < 0, +X for z > 0.
  let tri = srcIdx;
  if (keepSide) {
    tri = srcIdx.filter((_, k) => Math.sign(pos[srcIdx[k - (k % 3)] * 3 + 2]) === keepSide);
    facing = keepSide > 0 ? 1 : -1;
  }
  const remap = new Int32Array(count).fill(-1);
  let m = 0;
  for (const v of tri) if (remap[v] < 0) remap[v] = m++;
  const P2 = new Float32Array(m * 3), N2 = new Float32Array(m * 3), T2 = new Float32Array(m * 2);
  for (let i = 0; i < count; i++) {
    const j = remap[i];
    if (j < 0) continue;
    // Rotate about Y so the figure faces +Z: facing +X maps (x, z) -> (-z, x); facing -X maps (x, z) -> (z, -x).
    const [x, y, z] = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const [nx, ny, nz] = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    P2.set(facing > 0 ? [-z, y, x] : [z, y, -x], j * 3);
    N2.set(facing > 0 ? [-nz, ny, nx] : [nz, ny, -nx], j * 3);
    T2.set([uv[i * 2], uv[i * 2 + 1]], j * 2);
  }

  // Scale to HEIGHT with feet on y = 0, centred on the pelvis.
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < m; i++) {
    minY = Math.min(minY, P2[i * 3 + 1]); maxY = Math.max(maxY, P2[i * 3 + 1]);
    minX = Math.min(minX, P2[i * 3]); maxX = Math.max(maxX, P2[i * 3]);
  }
  const s = HEIGHT / (maxY - minY);
  let zs = 0, zc = 0;
  for (let i = 0; i < m; i++) {
    const h = (P2[i * 3 + 1] - minY) / (maxY - minY);
    if (h > 0.45 && h < 0.6 && Math.abs(P2[i * 3] - (minX + maxX) / 2) < 0.1 * (maxY - minY)) { zs += P2[i * 3 + 2]; zc++; }
  }
  const cx = (minX + maxX) / 2, cz = zs / zc;
  for (let i = 0; i < m; i++) {
    P2[i * 3] = (P2[i * 3] - cx) * s;
    P2[i * 3 + 1] = (P2[i * 3 + 1] - minY) * s;
    P2[i * 3 + 2] = (P2[i * 3 + 2] - cz) * s;
  }

  const I2 = Uint32Array.from(tri, (v) => remap[v]);
  setArrays(doc, buffer, prim, { pos: P2, nrm: N2, uv: T2, idx: I2 });
}

function addSkin(doc, buffer, meshNode, prims, rig) {
  const scene = doc.getRoot().listScenes()[0];
  const nodes = {};
  for (const j of rig.joints) {
    const p = j.parent ? rig.joints.find((k) => k.name === j.parent).pos : [0, 0, 0];
    const node = doc.createNode(j.name).setTranslation([j.pos[0] - p[0], j.pos[1] - p[1], j.pos[2] - p[2]]);
    if (j.parent) nodes[j.parent].addChild(node); else scene.addChild(node);
    nodes[j.name] = node;
  }
  const ibm = new Float32Array(16 * rig.joints.length);
  rig.joints.forEach((j, i) => {
    ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -j.pos[0], -j.pos[1], -j.pos[2], 1], i * 16);
  });
  const skin = doc.createSkin('rig')
    .setSkeleton(nodes.hips)
    .setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  for (const j of rig.joints) skin.addJoint(nodes[j.name]);
  meshNode.setSkin(skin);
  let off = 0;
  for (const prim of prims) {
    const n = prim.getAttribute('POSITION').getCount();
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(rig.skinIndex.slice(off * 4, (off + n) * 4)).setBuffer(buffer));
    prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(rig.skinWeight.slice(off * 4, (off + n) * 4)).setBuffer(buffer));
    off += n;
  }
}

async function debugRender(model, prims, pos, idx, rig) {
  const tex = new Float32Array(pos.length);
  let off = 0;
  for (const prim of prims) {
    const uv = prim.getAttribute('TEXCOORD_0').getArray();
    tex.set(await textureColors(uv, prim.getMaterial().getBaseColorTexture().getImage()), off);
    off += uv.length / 2 * 3;
  }
  const bones = boneColors(rig.skinIndex, rig.skinWeight);
  const jp = rig.joints.map((j) => j.pos);
  await renderViews({ pos, idx, colors: tex, joints: jp, file: `${DEBUG_DIR}/${model.name}_tex.png` });
  await renderViews({ pos, idx, colors: bones, joints: jp, file: `${DEBUG_DIR}/${model.name}_bones.png` });
  // head close-up
  const headY = rig.landmarks.neckMid - 0.06;
  const headIdx = [];
  for (let t = 0; t < idx.length; t += 3) if ([idx[t], idx[t + 1], idx[t + 2]].every((v) => pos[v * 3 + 1] > headY)) headIdx.push(idx[t], idx[t + 1], idx[t + 2]);
  await renderViews({ pos, idx: Uint32Array.from(headIdx), colors: tex, file: `${DEBUG_DIR}/${model.name}_head.png`, size: 600 });

  // A test pose that exercises every chain: arm down / arm forward, knee up, head turn, spine bend.
  const J = Object.fromEntries(rig.joints.map((j) => [j.name, new THREE.Vector3(...j.pos)]));
  const aim = (from, to, target) => new THREE.Quaternion().setFromUnitVectors(J[to].clone().sub(J[from]).normalize(), new THREE.Vector3(...target).normalize());
  const bend = (from, to, angle) => {
    const d = J[to].clone().sub(J[from]).normalize();
    return new THREE.Quaternion().setFromAxisAngle(d.clone().cross(new THREE.Vector3(0, 0, 1)).normalize(), angle);
  };
  const pose = {
    spine: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0)),
    head: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0)),
    upperArm_L: aim('upperArm_L', 'foreArm_L', [0.15, -0.98, 0.1]),
    foreArm_L: bend('foreArm_L', 'hand_L', 0.8),
    upperArm_R: aim('upperArm_R', 'foreArm_R', [-0.15, 0.2, 0.97]),
    thigh_L: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0)),
    shin_L: new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, 0)),
  };
  const posed = skinPositions(pos, rig.skinIndex, rig.skinWeight, rig.joints, pose);
  await renderViews({ pos: posed.positions, idx, colors: tex, joints: posed.jointWorld.map((v) => v.toArray()), file: `${DEBUG_DIR}/${model.name}_posed.png` });
}
