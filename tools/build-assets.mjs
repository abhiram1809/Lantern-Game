// Turns the raw Tripo scans into game-ready, auto-rigged GLBs in public/models:
// orient (Y-up, facing +Z), scale, simplify, rig with a procedural humanoid skeleton, and shrink the
// textures. Optional per-model `keepSide` splits a two-figure sheet (Kilowog), `rig` passes landmark
// overrides to autoRig (Kilowog), and `head` transplants another scan's head (headswap.mjs; only the
// older casual scan used it, kept commented out below). A model with `merge` is not one scan but a
// set of parts (Star Sapphire Carol: 50 meshes): they're joined into one mesh with a primitive for each
// material, each material's share cut down to its own ratio, then rigged like the rest.
//
//   node tools/build-assets.mjs            build everything
//   ONLY=abin_sur node tools/...           build one model
//   DEBUG_DIR=/some/dir node tools/...     also write rig preview PNGs
import { NodeIO, Document } from '@gltf-transform/core';
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
  // Carol Ferris (the user's model, 2026-11-10), for Part Three. Another two-figure sheet along z
  // (each figure about 0.59 of the sheet's height, in an A-pose): keep the z > 0 one, facing +X.
  // Her long hair hides the neck, so the narrowest slice lands at her mouth: the neck is given. She
  // stands in an A-pose (hands at 0.32 H out, the bag at her hip), so the arm axis band is moved in.
  { name: 'carol', src: 'assets/raw/Carol.glb', keepSide: 1, facing: 1, tris: 90000, height: 1.7, rig: { neckMid: 0.86, armLo: 0.13, armTipIn: 0.05, armMinY: 0.6 } },
  // Star Sapphire Carol (the user's model, 2026-11-20), for Part Seven: her scan's face and hair (the
  // same geometry as `carol`, 58k triangles) with a suit, hands and armour made as 50 separate parts
  // (187k triangles in all, A-pose, 1.74 m, already facing +Z, so no `facing`). `merge` says how hard
  // each material is cut, by name: the face and the suit stay close to whole, the armour (shin guards,
  // pauldrons, the chest star) goes to about a third, and anything small is left as it is. About 110k.
  // The emissive strengths (up to 4.9) and the three lights are left behind with the extensions: the
  // bloom turns anything over about 1.5 into a blob. Rigged as Carol is (long hair hides the neck).
  // The armour is kept whole (at a third its thin plates came out as jagged shards: the user's "the
  // hand... looks messy", 2026-11-21) and each piece of it rides one bone (`rigid`): blended between
  // the forearm and the hand like skin, a vambrace bent and tore at the wrist. About 168k.
  {
    name: 'sapphire', src: 'assets/raw/Star_Sapphire_Carol.glb', merge: { ratios: [[/^Carol/, 0.82], [/^Suit/, 0.8]], rest: 1, keepBelow: 1500 }, height: 1.7,
    rigid: /^(Hardware|Power|Gem|Star|Tiara)/,
    // The arm joints are given (measured on the suit's own cross-sections, shoulder to fingertip): fitted, the
    // armour on her forearms and the hair behind her shoulders pulled the arm's axis back, the shoulders landed
    // 30 and 67 cm behind her and the elbows 13 and 32, so the upper arms were weighted to the chest and the
    // forearms swung about a point behind her back: her arms hung off her in every pose.
    rig: { neckMid: 0.86, arms: [[0.177, 1.335, -0.05], [0.337, 1.142, -0.072], [0.471, 1.023, -0.026]] },
  },
  // Hector Hammond (the user's model, 2026-11-11), for the end of Part Three: one figure in a
  // T-pose, facing +X, lab coat, glasses. His skull swells in the shader (createHammond).
  { name: 'hammond', src: 'assets/raw/Hector.glb', facing: 1, tris: 90000, height: 1.78 },
  // Atrocitus (the user's model, 2026-11-11), for Part Four: one figure in an A-pose, facing +X,
  // crimson, in dark armour. Like Kilowog his head sits low between the shoulders (the narrowest
  // slice is above his chin), and pauldrons reach 0.58 m out over arms that only clear the torso
  // below 1.55 m: the arm axis is fitted under them, and his forearms are short (measured on the
  // scan: elbow about 0.6, 1.38; wrist 0.71, 1.15; fingers curled under the widest point).
  {
    name: 'atrocitus', src: 'assets/raw/Atrocitus.glb', facing: 1, tris: 90000, height: 2.25,
    rig: { neckMid: 0.858, jawBack: 0.07, neckBack: -0.08, headFill: true, neckColumn: true, shoulder: [0.147, 0.782], armRadius: 1.5, armLo: 0.178, armTipIn: 0.04, armMinY: 0.47, armMaxY: 0.693, elbowK: 0.58, wristK: 0.86 },
  },
  // Katma Tui (the user's model, 2026-11-12), for Part Five: one figure in an A-pose, facing +X, in
  // a Lantern's uniform (recoloured to the resistance's in the shader until she's given the ring),
  // pink Korugarian skin, short black hair. The A-pose arm band, as Carol's; the shoulders given (fitted
  // from her arms, they landed 0.3 m behind her back, one of them high).
  // Korugar's crowd (Part Five): Abin Sur's scan again, cut down to 1,500 triangles, for the hundreds
  // packed round the plaza behind the full figures (posed and baked once at runtime, then instanced:
  // Korugar.buildCrowdFill).
  { name: 'kor_crowd', src: 'assets/raw/Abin.glb', facing: 1, tris: 1500, height: 1.9 },
  // Qward's Thunderers (the user's sheet, 2026-11-17, for Part Six): four separate figures in one file,
  // each facing +X, in bronze war gear: an archer with a bow, a winged soldier, a brute with a mace, a
  // woman. `figure` picks one by its z on the sheet; heights keep the sheet's own proportions.
  // The archer is crouched with his bow drawn and the winged one floats with his wings spread, so
  // their arm joints are given (measured on a GRID render) and the bow, wings and flail are bound
  // whole to one bone. The winged one's height is to the top of his head, not his wings.
  {
    name: 'thunder_archer', src: 'assets/raw/Thunderers.glb', figure: -0.35, facing: 1, tris: 60000, height: 1.9,
    rig: {
      legX: 0.3,
      arms: { L: [[0.22, 1.4], [0.43, 1.17], [0.2, 1.12]], R: [[-0.17, 1.38], [-0.17, 1.12], [-0.01, 0.9, 0.26]] }, // (the bow hand's column there runs through his hips: its depth given)
      bind: [
        { bone: 'hand_R', box: [-0.9, 0.72, -0.6, -0.42, 1.02, 0.6] },
        { bone: 'hand_R', box: [0.42, 0.82, -0.6, 0.95, 1.12, 0.6] },
        { bone: 'hand_R', box: [-0.42, 0.78, 0.2, 0.42, 0.95, 0.6] },
        { bone: 'chest', box: [-0.55, 1.35, -0.7, -0.06, 1.98, -0.06] }, // the quiver
      ],
    },
  },
  {
    name: 'thunder_winged', src: 'assets/raw/Thunderers.glb', figure: -0.12, facing: 1, tris: 70000, height: 1.9, headTop: 0.142,
    rig: {
      arms: [[0.228, 1.563], [0.481, 1.359], [0.625, 1.251]],
      bind: [
        { bone: 'chest', box: [-1.5, 1.142, -0.7, 1.5, 1.684, -0.048] },
        { bone: 'chest', box: [-1.5, 1.684, -0.7, -0.168, 2.6, -0.048] },
        { bone: 'chest', box: [0.168, 1.684, -0.7, 1.5, 2.6, -0.048] },
      ],
    },
  },
  {
    name: 'thunder_brute', src: 'assets/raw/Thunderers.glb', figure: 0.157, facing: 1, tris: 60000, height: 2.1,
    rig: { arms: [[0.27, 1.62], [0.49, 1.3], [0.57, 1.06]], bind: [{ bone: 'hand_R', box: [-0.85, 0.2, -0.5, -0.44, 0.98, 0.5] }, { bone: 'hand_R', box: [-0.85, 0.2, -0.5, -0.34, 0.56, 0.5] }] },
  },
  { name: 'thunder_woman', src: 'assets/raw/Thunderers.glb', figure: 0.4, facing: 1, tris: 60000, height: 1.85, rig: { arms: [[0.19, 1.42], [0.35, 1.21], [0.42, 1.03]] } },
  { name: 'katma', src: 'assets/raw/Katma-tui.glb', facing: 1, tris: 90000, height: 1.76, rig: { armLo: 0.13, armTipIn: 0.05, armMinY: 0.6, shoulder: [0.1, 0.812] } },
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

// A model made of parts (see `merge` above): every part's triangles into world space, joined by
// material, each material cut to its own ratio (`decimate`), then scaled to HEIGHT with its feet on y = 0
// and its pelvis on the origin, as `normalizeGeometry` does for a scan. The originals are dropped.
async function readMerged(file, opts, H) {
  const doc = await io.read(file);
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  const root = doc.getRoot(), buffer = root.listBuffers()[0], scene = root.listScenes()[0];
  const groups = new Map();
  const parts = root.listNodes().filter((nd) => nd.getMesh());
  for (const node of parts) {
    const M = node.getWorldMatrix();
    for (const p of node.getMesh().listPrimitives()) {
      const mat = p.getMaterial();
      const g = groups.get(mat) ?? groups.set(mat, { pos: [], nrm: [], uv: [], idx: [], n: 0 }).get(mat);
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), T = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
      if (!N) throw new Error(`${node.getName()} has no normals`);
      const e3 = [0, 0, 0], e2 = [0, 0];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, e3);
        g.pos.push(M[0] * e3[0] + M[4] * e3[1] + M[8] * e3[2] + M[12], M[1] * e3[0] + M[5] * e3[1] + M[9] * e3[2] + M[13], M[2] * e3[0] + M[6] * e3[1] + M[10] * e3[2] + M[14]);
        N.getElement(i, e3);
        const nx = M[0] * e3[0] + M[4] * e3[1] + M[8] * e3[2], ny = M[1] * e3[0] + M[5] * e3[1] + M[9] * e3[2], nz = M[2] * e3[0] + M[6] * e3[1] + M[10] * e3[2], nl = Math.hypot(nx, ny, nz) || 1;
        g.nrm.push(nx / nl, ny / nl, nz / nl);
        if (T) { T.getElement(i, e2); g.uv.push(e2[0], e2[1]); } else g.uv.push(0, 0); // (the armour has none)
      }
      const count = I ? I.getCount() : P.getCount();
      for (let k = 0; k < count; k++) g.idx.push((I ? I.getScalar(k) : k) + g.n);
      g.n += P.getCount();
    }
  }
  const total = [...groups.values()].reduce((a, g) => a + g.idx.length / 3, 0);
  for (const [mat, g] of groups) {
    const name = mat.getName(), tris = g.idx.length / 3;
    const ratio = tris < opts.merge.keepBelow ? 1 : (opts.merge.ratios.find(([re]) => re.test(name))?.[1] ?? opts.merge.rest);
    const m = await decimate({ pos: Float32Array.from(g.pos), nrm: Float32Array.from(g.nrm), uv: Float32Array.from(g.uv), idx: Uint32Array.from(g.idx) }, ratio);
    Object.assign(g, m);
    console.log(`  ${name.padEnd(46)} ${String(tris).padStart(6)} -> ${String(m.idx.length / 3).padStart(6)}`);
  }
  // scale and centre the whole figure, not each material
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const g of groups.values()) for (let i = 0; i < g.pos.length; i += 3) { minY = Math.min(minY, g.pos[i + 1]); maxY = Math.max(maxY, g.pos[i + 1]); minX = Math.min(minX, g.pos[i]); maxX = Math.max(maxX, g.pos[i]); }
  const s = H / (maxY - minY), cx = (minX + maxX) / 2;
  let zs = 0, zc = 0;
  for (const g of groups.values()) for (let i = 0; i < g.pos.length; i += 3) {
    const h = (g.pos[i + 1] - minY) / (maxY - minY);
    if (h > 0.45 && h < 0.6 && Math.abs(g.pos[i] - cx) < 0.1 * (maxY - minY)) { zs += g.pos[i + 2]; zc++; }
  }
  const cz = zs / zc;
  for (const g of groups.values()) for (let i = 0; i < g.pos.length; i += 3) {
    g.pos[i] = (g.pos[i] - cx) * s; g.pos[i + 1] = (g.pos[i + 1] - minY) * s; g.pos[i + 2] = (g.pos[i + 2] - cz) * s;
  }
  // the parts out, one mesh in
  for (const node of parts) node.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  const mesh = doc.createMesh(opts.name), meshNode = doc.createNode(opts.name).setMesh(mesh);
  scene.addChild(meshNode);
  const prims = [];
  for (const [mat, g] of groups) {
    const prim = doc.createPrimitive().setMaterial(mat);
    setArrays(doc, buffer, prim, g);
    mesh.addPrimitive(prim);
    prims.push(prim);
  }
  console.log(`${opts.name}: ${total} -> ${prims.reduce((a, p) => a + p.getIndices().getCount() / 3, 0)} tris in ${prims.length} materials`);
  return { doc, buffer, meshNode, prims };
}

// One material's triangles cut to `ratio` of themselves: welded and simplified in a document of their
// own (the transform works on a whole document, and each material wants its own ratio).
async function decimate(m, ratio) {
  if (ratio >= 1) return m;
  const d = new Document(), b = d.createBuffer();
  const prim = d.createPrimitive();
  setArrays(d, b, prim, m);
  d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(prim)));
  await d.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
  return { pos: prim.getAttribute('POSITION').getArray().slice(), nrm: prim.getAttribute('NORMAL').getArray().slice(), uv: prim.getAttribute('TEXCOORD_0').getArray().slice(), idx: prim.getIndices().getArray().slice() };
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
  let doc, buffer, meshNode, prims;
  if (model.merge) {
    ({ doc, buffer, meshNode, prims } = await readMerged(model.src, model, H));
  } else {
    const scan = await readScan(model.src, model, H);
    ({ doc, buffer, meshNode } = scan);
    const prim = scan.prim;
    meshNode.setName(model.name);
    const trisBefore = prim.getIndices().getCount() / 3;
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: model.tris / trisBefore, error: 0.01 }));
    console.log(`${model.name}: ${trisBefore} -> ${prim.getIndices().getCount() / 3} tris`);
    prims = [prim];
  }
  const prim = prims[0];

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
  // GRID=dir: render the figure front and side with a 10 cm grid, to measure landmarks for `rig`
  if (process.env.DUMP) { const fs = await import('node:fs'); fs.writeFileSync(process.env.DUMP, Buffer.from(pos.buffer)); continue; }
  if (process.env.GRID) { await gridRender(model, prims, pos, Uint32Array.from(idx)); continue; }
  const rig = autoRig(pos, Uint32Array.from(idx), H, model.rig);
  console.log('  landmarks', Object.fromEntries(Object.entries(rig.landmarks).map(([k, v]) => [k, +v.toFixed(3)])));
  if (model.rigid) rigidPieces(prims, parts, rig, model.rigid);
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

function normalizeGeometry(doc, buffer, prim, { keepSide, facing, figure, headTop }, HEIGHT) {
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
  // Or one figure of a sheet of separate meshes (the Thunderers: four, whose wings and bows overlap
  // in z): the connected piece whose bounds' centre is nearest `figure` (its z on the sheet).
  if (figure !== undefined) tri = pickFigure(pos, srcIdx, figure);
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
  // `headTop` (the sheet's own units): where the figure's head ends, for one with wings above it
  if (headTop !== undefined) maxY = headTop;
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

function pickFigure(pos, idx, z) {
  const n = pos.length / 3, key = new Map(), w = new Int32Array(n), par = new Int32Array(n).map((_, i) => i);
  for (let i = 0; i < n; i++) {
    const k = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`;
    if (!key.has(k)) key.set(k, i);
    w[i] = key.get(k);
  }
  const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const r = f(w[idx[t]]); par[f(w[idx[t + 1]])] = r; par[f(w[idx[t + 2]])] = r; }
  const box = new Map();
  for (let i = 0; i < n; i++) {
    const r = f(w[i]), b = box.get(r) ?? { lo: Infinity, hi: -Infinity, n: 0 };
    b.lo = Math.min(b.lo, pos[i * 3 + 2]); b.hi = Math.max(b.hi, pos[i * 3 + 2]); b.n++;
    box.set(r, b);
  }
  // pieces of more than 1% of the sheet are figures; the rest (loose bits) go with the nearest one
  const big = [...box.entries()].filter(([, b]) => b.n > n * 0.01);
  const [root] = big.reduce((a, c) => (Math.abs((c[1].lo + c[1].hi) / 2 - z) < Math.abs((a[1].lo + a[1].hi) / 2 - z) ? c : a));
  return idx.filter((_, k) => f(w[idx[k - (k % 3)]]) === root);
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

// Hard-surface parts move as pieces, not as skin: every connected piece of a `rigid` material (welded by
// position, and joined to any piece whose bounds it sits inside, as a lit inlay sits in its plate) is
// weighted wholly to the bone that carries most of it.
function rigidPieces(prims, parts, rig, re) {
  const J = rig.skinIndex, W = rig.skinWeight, verts = [], local = new Map(), byPos = new Map();
  let off = 0;
  prims.forEach((prim, k) => {
    const n = parts[k].pos.length / 3;
    if (re.test(prim.getMaterial()?.getName() ?? '')) for (let i = 0; i < n; i++) { local.set(off + i, verts.length); verts.push({ g: off + i, k, i }); }
    off += n;
  });
  const up = Int32Array.from(verts, (_, i) => i);
  const find = (a) => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) up[b] = a; };
  off = 0;
  prims.forEach((prim, k) => {
    const n = parts[k].pos.length / 3, P = parts[k].pos, I = parts[k].idx;
    if (re.test(prim.getMaterial()?.getName() ?? '')) {
      for (let t = 0; t < I.length; t += 3) { join(local.get(off + I[t]), local.get(off + I[t + 1])); join(local.get(off + I[t]), local.get(off + I[t + 2])); }
      for (let i = 0; i < n; i++) {
        const key = `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
        const at = byPos.get(key);
        if (at === undefined) byPos.set(key, local.get(off + i)); else join(at, local.get(off + i));
      }
    }
    off += n;
  });
  const boxOf = (list) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const v of list) for (let c = 0; c < 3; c++) { const x = parts[v.k].pos[v.i * 3 + c]; lo[c] = Math.min(lo[c], x); hi[c] = Math.max(hi[c], x); }
    return { lo, hi, vol: (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]) };
  };
  const pieces = () => { const m = new Map(); verts.forEach((v, i) => { const r = find(i); (m.get(r) ?? m.set(r, []).get(r)).push(v); }); return m; };
  // an inlay inside its plate's bounds goes with the plate
  const first = [...pieces().entries()].map(([r, list]) => ({ r, ...boxOf(list) })).sort((a, b) => b.vol - a.vol);
  const pad = 0.004;
  for (let s = first.length - 1; s > 0; s--) {
    const a = first[s];
    for (let b = 0; b < s; b++) {
      const B = first[b];
      if ([0, 1, 2].every((c) => a.lo[c] >= B.lo[c] - pad && a.hi[c] <= B.hi[c] + pad)) { join(B.r, a.r); break; }
    }
  }
  let count = 0;
  for (const list of pieces().values()) {
    const acc = new Float32Array(rig.joints.length);
    for (const v of list) for (let c = 0; c < 4; c++) acc[J[v.g * 4 + c]] += W[v.g * 4 + c];
    let best = 0;
    for (let j = 1; j < acc.length; j++) if (acc[j] > acc[best]) best = j;
    for (const v of list) { J.set([best, 0, 0, 0], v.g * 4); W.set([1, 0, 0, 0], v.g * 4); }
    count++;
  }
  console.log(`  rigid: ${verts.length} vertices in ${count} pieces, each on one bone`);
}

async function gridRender(model, prims, pos, idx) {
  const colors = await textureColors(prims[0].getAttribute('TEXCOORD_0').getArray(), prims[0].getMaterial().getBaseColorTexture().getImage());
  const size = 1100, file = `${process.env.GRID}/${model.name}_grid.png`;
  await renderViews({ pos, idx, colors, file, size, views: ['front', 'side'] });
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const i of idx) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i * 3 + k]); mx[k] = Math.max(mx[k], pos[i * 3 + k]); }
  const c = mn.map((v, k) => (v + mx[k]) / 2), scale = (size * 0.92) / Math.max(...mx.map((v, k) => v - mn[k]));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size}">`;
  for (const [t, ax] of [[0, 0], [1, 2]]) {
    for (let v = -3; v <= 3.001; v += 0.1) {
      const px = t * size + size / 2 + (v - (t ? -c[2] : c[0])) * scale * (t ? 1 : 1);
      const w = Math.abs(v * 2 - Math.round(v * 2)) < 0.01 ? 1.6 : 0.5;
      if (px > t * size && px < (t + 1) * size) svg += `<line x1="${px}" y1="0" x2="${px}" y2="${size}" stroke="cyan" stroke-width="${w}" opacity="0.6"/><text x="${px + 2}" y="12" fill="cyan" font-size="11">${(t ? -v : v).toFixed(1)}</text>`;
    }
    for (let v = 0; v <= 3.001; v += 0.1) {
      const py = size / 2 - (v - c[1]) * scale;
      const w = Math.abs(v * 2 - Math.round(v * 2)) < 0.01 ? 1.6 : 0.5;
      if (py > 0 && py < size) svg += `<line x1="${t * size}" y1="${py}" x2="${(t + 1) * size}" y2="${py}" stroke="yellow" stroke-width="${w}" opacity="0.5"/><text x="${t * size + 2}" y="${py - 2}" fill="yellow" font-size="11">${v.toFixed(1)}</text>`;
    }
  }
  svg += '</svg>';
  const out = await sharp(file).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp(out).toFile(file);
  console.log('  grid', file, 'centre', c.map((v) => v.toFixed(3)));
}

async function debugRender(model, prims, pos, idx, rig) {
  const tex = new Float32Array(pos.length);
  let off = 0;
  for (const prim of prims) {
    const uv = prim.getAttribute('TEXCOORD_0').getArray();
    const map = prim.getMaterial().getBaseColorTexture();
    if (map) tex.set(await textureColors(uv, map.getImage()), off);
    else { const f = prim.getMaterial().getBaseColorFactor(); for (let i = 0; i < uv.length / 2; i++) tex.set([f[0], f[1], f[2]], off + i * 3); } // (the armour: a colour, no texture)
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
