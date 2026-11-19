// Coast City's people (2026-11-18): Microsoft's Rocketbox avatars (MIT; the GLB copy on Hugging Face,
// codepawl/rocketbox-avatars-glb) moved onto our skeleton, so the mocap, the IK, the look-at and the
// poses drive them as they drive the scans. Each source file is a 3ds Max Biped in centimetres with
// its own bone orientations; ours is metres, feet at y 0, facing +Z, every bone's rest rotation the
// identity (only translations), as autorig.mjs writes. So the figure is skinned into its bind pose,
// turned to face +Z and set on the ground, and the Biped's 80 weights are folded onto our 17 bones,
// keeping the fingers (fifteen a hand, for hands that hold and close) and the eyes (to look with).
// Of the 175 face blendshapes, seven are kept: the jaw for speech, the blinks, a smile, a pucker and
// the inner brows. Textures come down to what a passer-by needs (the face's colour at 1024).
//
//   node tools/build-people.mjs            every person in PEOPLE (assets/people/<id>.glb → public/models/people/)
//   ONLY=female-adult-02 node tools/...    one
//   FETCH=1 node tools/...                 download the sources that are missing first
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, writeFile, access } from 'node:fs/promises';

// who's in the city: id → role (the role is only a note for whoever places them)
export const PEOPLE = {
  'female-adult-02': 'Rosie, the diner\'s owner (white blouse, skirt)',
  'chef-female-01': 'the diner\'s cook',
  'male-adult-14': 'Ray, the liquor store\'s clerk',
  'female-adult-01': 'passer-by', 'female-adult-05': 'passer-by', 'female-adult-07': 'passer-by', 'female-adult-08': 'passer-by',
  'female-adult-13': 'passer-by', 'female-adult-15': 'passer-by', 'female-adult-17': 'passer-by', 'female-party-02': 'passer-by',
  'male-adult-01': 'passer-by', 'male-adult-02': 'passer-by', 'male-adult-04': 'passer-by', 'male-adult-06': 'passer-by',
  'male-adult-08': 'passer-by', 'male-adult-11': 'passer-by', 'male-adult-12': 'passer-by', 'male-adult-13': 'passer-by',
  'male-adult-16': 'passer-by', 'male-adult-17': 'passer-by', 'male-adult-20': 'passer-by',
  'business-male-02': 'passer-by (suit)', 'business-female-03': 'passer-by (suit)', 'delivery-male-01': 'passer-by (delivery)',
  'construction-male-07': 'passer-by (roadworks)', 'male-child-01': 'a boy', 'female-child-01': 'a girl',
  // the city's emergencies (story/Emergencies.js): who causes them, and who comes after Green Lantern
  'male-adult-03': 'a robber, a thug', 'male-adult-09': 'a thug', 'male-adult-18': 'a thug',
  'police-male-01': 'a police officer', 'police-male-03': 'a police officer', 'police-female-01': 'a police officer',
  'fire-male-02': 'a firefighter', 'fire-male-05': 'a firefighter', 'medical-female-01': 'a paramedic',
  // the block south of the crossing (city/Shops.js): the station's sergeant and an officer at his desk,
  // the hospital's nurse and doctor, the bar's barman and two regulars, the shops' keepers, passers-by
  'police-male-02': 'the desk sergeant', 'medical-female-02': 'the ER\'s triage nurse', 'medical-male-01': 'a doctor',
  'medical-male-02': 'an orderly', 'male-adult-05': 'the barman', 'male-adult-15': 'a regular at the bar', 'female-adult-09': 'a regular at the bar',
  'female-adult-03': 'the cinema\'s usher', 'male-adult-07': 'Tony, the pizzaiolo', 'female-adult-04': 'the travel agent',
  'female-adult-06': 'the thrift shop\'s volunteer', 'male-adult-10': 'the bookseller', 'business-male-01': 'the TV salesman',
  'female-adult-10': 'the dry cleaner', 'business-female-01': 'the bail bondswoman', 'female-adult-11': 'Belle, the hairdresser',
  'female-adult-12': 'the market\'s cashier', 'male-adult-19': 'the gym\'s trainer', 'female-adult-14': 'passer-by', 'male-adult-21': 'passer-by',
  'business-female-02': 'passer-by (suit)', 'business-male-03': 'passer-by (suit)', 'construction-male-01': 'passer-by (work clothes)',
};

const STAFF = ['female-adult-02', 'chef-female-01', 'male-adult-14'];

// Biped bone → ours (everything not named goes to the nearest of ours up its chain)
const BIP = 'Bip01 ';
const MAIN = {
  Pelvis: 'hips', Spine: 'spine', Spine1: 'spine', Spine2: 'chest', Neck: 'neck', Head: 'head',
  'L Clavicle': 'chest', 'L UpperArm': 'upperArm_L', 'L Forearm': 'foreArm_L', 'L Hand': 'hand_L',
  'R Clavicle': 'chest', 'R UpperArm': 'upperArm_R', 'R Forearm': 'foreArm_R', 'R Hand': 'hand_R',
  'L Thigh': 'thigh_L', 'L Calf': 'shin_L', 'L Foot': 'foot_L', 'L Toe0': 'foot_L',
  'R Thigh': 'thigh_R', 'R Calf': 'shin_R', 'R Foot': 'foot_R', 'R Toe0': 'foot_R',
  LEye: 'eye_L', REye: 'eye_R',
};
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
for (const s of ['L', 'R']) for (let f = 0; f < 5; f++) for (let k = 0; k < 3; k++) MAIN[`${s} Finger${f}${k ? k : ''}`] = `${FINGERS[f]}${k + 1}_${s}`;
// where each of ours sits (the Biped joint) and its parent
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_L', 'foreArm_L', 'hand_L', 'upperArm_R', 'foreArm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];
const AT = { hips: 'Pelvis', spine: 'Spine', chest: 'Spine2', neck: 'Neck', head: 'Head', eye_L: 'LEye', eye_R: 'REye' };
const PARENT = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', eye_L: 'head', eye_R: 'head',
  upperArm_L: 'chest', foreArm_L: 'upperArm_L', hand_L: 'foreArm_L', upperArm_R: 'chest', foreArm_R: 'upperArm_R', hand_R: 'foreArm_R',
  thigh_L: 'hips', shin_L: 'thigh_L', foot_L: 'shin_L', thigh_R: 'hips', shin_R: 'thigh_R', foot_R: 'shin_R',
};
for (const s of ['L', 'R']) {
  Object.assign(AT, { [`upperArm_${s}`]: `${s} UpperArm`, [`foreArm_${s}`]: `${s} Forearm`, [`hand_${s}`]: `${s} Hand`, [`thigh_${s}`]: `${s} Thigh`, [`shin_${s}`]: `${s} Calf`, [`foot_${s}`]: `${s} Foot` });
  for (let f = 0; f < 5; f++) for (let k = 0; k < 3; k++) {
    const n = `${FINGERS[f]}${k + 1}_${s}`;
    AT[n] = `${s} Finger${f}${k ? k : ''}`;
    PARENT[n] = k ? `${FINGERS[f]}${k}_${s}` : `hand_${s}`;
  }
}
const EXTRA = Object.keys(PARENT).filter((n) => !ORDER.includes(n));
const JOINTS = [...ORDER, ...EXTRA];
const KEEP_SHAPES = ['AK_25_JawOpen', 'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight', 'AK_38_MouthPucker', 'AK_03_BrowInnerUp'];
const SHAPE_NAMES = ['jawOpen', 'blinkL', 'blinkR', 'smileL', 'smileR', 'pucker', 'browUp'];

// column-major 4×4 helpers
const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const xform = (m, x, y, z, w = 1) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await mkdir('public/models/people', { recursive: true });
await mkdir('assets/people', { recursive: true });

const ids = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(PEOPLE);
const exists = (f) => access(f).then(() => true, () => false);
const meta = {};

for (const id of ids) {
  const src = `assets/people/${id}.glb`;
  if (!(await exists(src))) {
    if (!process.env.FETCH) { console.log(`${id}: no ${src} (FETCH=1 to download it)`); continue; }
    const r = await fetch(`https://huggingface.co/datasets/codepawl/rocketbox-avatars-glb/resolve/main/objects/${id}/${id}.glb`);
    if (!r.ok) { console.log(`${id}: download failed (${r.status})`); continue; }
    await writeFile(src, Buffer.from(await r.arrayBuffer()));
  }
  const doc = await io.read(src);
  // written plain, as the scans are (the game's loader has no meshopt decoder); the WebP textures
  // come back with textureCompress
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();
  const root = doc.getRoot(), buffer = root.listBuffers()[0];
  const node = root.listNodes().find((n) => n.getMesh() && n.getSkin());
  const skin = node.getSkin(), joints = skin.listJoints(), ibm = skin.getInverseBindMatrices().getArray();
  const W = joints.map((j) => j.getWorldMatrix());
  const BM = joints.map((_, j) => mul(W[j], Array.from(ibm.slice(j * 16, j * 16 + 16)))); // mesh space → world, per joint
  const jname = joints.map((j) => j.getName().replace(BIP, ''));
  const worldOf = (bip) => { const j = jname.indexOf(bip); return [W[j][12], W[j][13], W[j][14]]; };

  // facing: the toes point forward; turn it to +Z
  const fwd = ['L', 'R'].map((s) => { const a = worldOf(`${s} Foot`), b = worldOf(`${s} Toe0`); return [b[0] - a[0], b[2] - a[2]]; });
  const yaw = Math.atan2(fwd[0][0] + fwd[1][0], fwd[0][1] + fwd[1][1]); // the turn that faces it +Z is -yaw
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const R = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  const turn = (p) => xform(R, p[0], p[1], p[2]);

  // each primitive skinned into its bind pose (world), then turned
  const prims = node.getMesh().listPrimitives();
  const baked = prims.map((p) => {
    const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), J = p.getAttribute('JOINTS_0'), Wt = p.getAttribute('WEIGHTS_0');
    const n = P.getCount(), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), mats = [];
    const v = [0, 0, 0], nv = [0, 0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      P.getElement(i, v); N.getElement(i, nv); J.getElement(i, jj); Wt.getElement(i, ww);
      const M = new Array(16).fill(0);
      for (let k = 0; k < 4; k++) if (ww[k] > 0) for (let e = 0; e < 16; e++) M[e] += ww[k] * BM[jj[k]][e];
      const TM = mul(R, M);
      mats.push(TM);
      const q = xform(TM, v[0], v[1], v[2]);
      pos.set(q, i * 3);
      const m = xform(TM, nv[0], nv[1], nv[2], 0), l = Math.hypot(...m) || 1;
      nrm.set([m[0] / l, m[1] / l, m[2] / l], i * 3);
    }
    return { p, pos, nrm, mats, J, Wt, n };
  });
  // on the ground
  let lo = Infinity;
  for (const b of baked) for (let i = 1; i < b.pos.length; i += 3) lo = Math.min(lo, b.pos[i]);
  for (const b of baked) for (let i = 1; i < b.pos.length; i += 3) b.pos[i] -= lo;
  const at = {};
  for (const n of JOINTS) { const w = turn(worldOf(AT[n])); at[n] = [w[0], w[1] - lo, w[2]]; }
  // the character's left on +X, as the scans
  if (at.upperArm_L[0] < at.upperArm_R[0]) console.warn(`${id}: its left arm is on -X`);

  // the weights folded onto ours
  const ourIndex = Object.fromEntries(JOINTS.map((n, i) => [n, i]));
  const mapJoint = jname.map((b) => {
    if (MAIN[b]) return ourIndex[MAIN[b]];
    return ourIndex.head; // the face's bones: the jaw, the lids, the brows, the lips, the tongue
  });
  // a sanity check on the bind pose: every joint should carry the mesh to the same place
  let spread = 0;
  for (let j = 1; j < BM.length; j++) for (let e = 0; e < 16; e++) spread = Math.max(spread, Math.abs(BM[j][e] - BM[0][e]));

  for (const b of baked) {
    const { p, n } = b;
    const joints4 = new Uint16Array(n * 4), weights4 = new Float32Array(n * 4);
    const jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      b.J.getElement(i, jj); b.Wt.getElement(i, ww);
      const acc = new Map();
      for (let k = 0; k < 4; k++) if (ww[k] > 0) { const o = mapJoint[jj[k]]; acc.set(o, (acc.get(o) ?? 0) + ww[k]); }
      const top = [...acc.entries()].sort((a, z) => z[1] - a[1]).slice(0, 4), sum = top.reduce((a, e) => a + e[1], 0) || 1;
      top.forEach(([o, w], k) => { joints4[i * 4 + k] = o; weights4[i * 4 + k] = w / sum; });
    }
    p.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(b.pos).setBuffer(buffer));
    p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(b.nrm).setBuffer(buffer));
    p.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(joints4).setBuffer(buffer));
    p.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(weights4).setBuffer(buffer));
    // the kept shapes, their offsets carried through the same skinning and turn
    const names = node.getMesh().getExtras()?.targetNames ?? [];
    const targets = p.listTargets(), kept = [];
    KEEP_SHAPES.forEach((nm, k) => {
      const t = targets[names.indexOf(nm)];
      const tp = t?.getAttribute('POSITION'), tn = t?.getAttribute('NORMAL');
      const dp = new Float32Array(n * 3), dn = new Float32Array(n * 3), v = [0, 0, 0];
      if (tp) for (let i = 0; i < n; i++) { tp.getElement(i, v); dp.set(xform(b.mats[i], v[0], v[1], v[2], 0), i * 3); }
      if (tn) for (let i = 0; i < n; i++) { tn.getElement(i, v); dn.set(xform(b.mats[i], v[0], v[1], v[2], 0), i * 3); }
      const nt = doc.createPrimitiveTarget(SHAPE_NAMES[k]);
      nt.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(dp).setBuffer(buffer));
      if (tn) nt.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(dn).setBuffer(buffer));
      kept.push(nt);
    });
    for (const t of targets) { p.removeTarget(t); t.dispose(); }
    for (const t of kept) p.addTarget(t);
    // the materials: cloth and skin, not plastic (the source has no roughness maps)
    const m = p.getMaterial();
    m.setRoughnessFactor(0.78).setMetallicFactor(0);
  }
  node.getMesh().setExtras({ targetNames: SHAPE_NAMES }).setWeights(SHAPE_NAMES.map(() => 0));

  // the new skeleton: translations only
  const scene = root.listScenes()[0];
  for (const c of scene.listChildren()) scene.removeChild(c);
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  for (const p of node.listParents()) if (p !== root && p.removeChild) p.removeChild(node);
  scene.addChild(node);
  const nodes = {};
  for (const n of JOINTS) {
    const pp = PARENT[n] ? at[PARENT[n]] : [0, 0, 0], a = at[n];
    nodes[n] = doc.createNode(n).setTranslation([a[0] - pp[0], a[1] - pp[1], a[2] - pp[2]]);
    if (PARENT[n]) nodes[PARENT[n]].addChild(nodes[n]); else scene.addChild(nodes[n]);
  }
  const ibm2 = new Float32Array(16 * JOINTS.length);
  JOINTS.forEach((n, i) => ibm2.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -at[n][0], -at[n][1], -at[n][2], 1], i * 16));
  const skin2 = doc.createSkin('rig').setSkeleton(nodes.hips).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm2).setBuffer(buffer));
  for (const n of JOINTS) skin2.addJoint(nodes[n]);
  node.setSkin(skin2);
  skin.dispose();
  for (const j of joints) j.dispose();
  for (const a of root.listAnimations()) a.dispose();

  let top = 0;
  for (const b of baked) for (let i = 1; i < b.pos.length; i += 3) top = Math.max(top, b.pos[i]);
  meta[id] = { height: +top.toFixed(3), eyes: +at.eye_L[1].toFixed(3), role: PEOPLE[id] ?? '' };

  // the people Hal talks to across a counter at 1024; passers-by smaller (a face at 768 still holds up
  // at talking distance; 25 of them at 1024 would be 400 MB of texture)
  const near = STAFF.includes(id), T = (n) => [n, n];
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /head_color/, resize: T(near ? 1024 : 768), quality: 88 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /body_color/, resize: T(near ? 1024 : 512), quality: 85 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /head_normal/, resize: T(512), quality: 85 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /body_normal/, resize: T(near ? 512 : 256), quality: 85 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /opacity/, resize: T(512), quality: 88 }),
    prune(),
  );
  await io.write(`public/models/people/${id}.glb`, doc);
  console.log(`${id}: ${meta[id].height} m, bind spread ${spread.toExponential(1)}, faced from ${(yaw * 180 / Math.PI).toFixed(0)}°`);
}

// what the game reads to know who exists (heights for placing them)
if (!process.env.ONLY) await writeFile('public/models/people/people.json', JSON.stringify({ source: 'Microsoft Rocketbox Avatar Library (MIT)', people: meta }, null, 1));
