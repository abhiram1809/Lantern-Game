// Reduces the Mixamo-rigged three.js example characters (assets/mocap) to just their skeleton and
// the animation channels of the bones our retargeting reads, for public/anims.
//   node tools/strip-mocap.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { mkdir } from 'node:fs/promises';

const KEEP = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End',
  ...['Left', 'Right'].flatMap((s) => ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'HandMiddle1', 'UpLeg', 'Leg', 'Foot', 'ToeBase'].map((b) => s + b))]
  .map((b) => `mixamorig:${b}`));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await mkdir('public/anims', { recursive: true });
for (const name of ['Xbot', 'Soldier']) {
  const doc = await io.read(`assets/mocap/${name}.glb`);
  const root = doc.getRoot();
  for (const node of root.listNodes()) { node.setMesh(null); node.setSkin(null); }
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const target = ch.getTargetNode();
      if (!target || !KEEP.has(target.getName())) { ch.getSampler()?.dispose(); ch.dispose(); }
    }
  }
  await doc.transform(prune({ keepLeaves: true }));
  await io.write(`public/anims/${name.toLowerCase()}.glb`, doc);
  console.log(name, root.listAnimations().map((a) => `${a.getName()}(${a.listChannels().length})`).join(' '));
}
