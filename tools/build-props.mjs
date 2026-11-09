// Turns downloaded props (assets/props/*.glb, CC-BY models from Sketchfab by way of Objaverse) into
// game-ready GLBs in public/models/props: turned to face +Z, scaled to real metres, standing on
// y = 0 (or centred), unwanted parts removed, textures shrunk to WebP. The node hierarchy is kept,
// so named parts (a car's doors and wheels, a fridge's door) can still be moved at runtime.
// It also writes CREDITS.md from the list below: CC-BY needs the title, the author, the source and
// the licence named, and changes noted.
//
//   node tools/build-props.mjs            build everything
//   ONLY=phoenix node tools/...           build one
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, prune, dedup, metalRough, weld, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const ONLY = process.env.ONLY;
const BY = 'CC BY 4.0';

// forward: the way the raw model's front faces (an axis, or a yaw in radians that turns it to +Z). Size by length (along the front after turning),
// height, or a plain scale. origin 'ground' stands it on y = 0; 'centre' centres it (hand props).
// drop: parts to remove (node names). opaque: materials that were exported as blended for no reason.
// simplify: the share of triangles to keep, for heavy scans.
export const PROPS = [
  // Hal's car: the '71 muscle car, its paint a plain material the game fades and patches with primer
  { name: 'phoenix', src: 'assets/props/phoenix.glb', forward: '+z', length: 4.9, tex: 2048,
    title: "Phoenix 455 '71 - Low poly model", author: 'Daniel Zhabotinsky', uid: '955edc733c6d44fabc0ad7c246a15896' },
  // the cars in the lots, by the same artist
  { name: 'fairheaven', src: 'assets/props/fairheaven.glb', forward: '-x', length: 4.98,
    title: "Fairheaven LT '80 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'e2678da920cc4be68dbc193727919ffb' },
  { name: 'negotiator', src: 'assets/props/negotiator.glb', forward: '+x', length: 5.1,
    title: "Negotiator '80 - Low poly model", author: 'Daniel Zhabotinsky', uid: '892b2684fb37442299bfad9222cf331c' },
  { name: 'sialia', src: 'assets/props/sialia.glb', forward: '-x', length: 4.25,
    title: "Sialia SW '68 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'eea2291a90f04a4b860c9e74be14f2d6' },
  { name: 'fairheaven_sw', src: 'assets/props/fairheaven_sw.glb', forward: '-x', length: 5.0,
    title: "Fairheaven SW '84 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'aa0becb6e854422596cac6b21bf79787' },
  // Ferris Aircraft's prototype on the apron
  // (it lies 39 degrees off its axis in the file: the yaw from the main gear to the nose wheel)
  { name: 'prototype', src: 'assets/props/f22.glb', forward: Math.atan2(4.19, 5.21), length: 18.9, tex: 2048,
    title: 'F22', author: 'manilov.ap', uid: '01b4128f65094d899e10c659e60f0858' },
  // Hal's phone (the maker's logo removed; the game draws its own screen)
  { name: 'phone', src: 'assets/props/phone.glb', forward: '-z', height: 0.1608, origin: 'centre', drop: /Apple[ _]?Logo/i,
    title: 'Apple iPhone 13 Pro Max', author: 'DatSketch', uid: '4328dea00e47497dbeac73c556121bc9' },
  // the lot behind Hal's building
  { name: 'palms', src: 'assets/props/palms.glb', forward: '+z', height: 10.5,
    title: 'Palm Trees', author: 'ElectroNick', uid: '20f8a8d5054b4191afb7cf3270dbd586' },
  // Hal's building, behind the lot
  { name: 'apartment', src: 'assets/props/apartment.glb', forward: '+z', height: 11.2,
    title: 'Apartment Complex Building', author: 'jimbogies', uid: 'fa7c256f511946fea3cd819e0f492741' },
  // on the apron and in the hangars
  { name: 'stand', src: 'assets/props/stand.glb', forward: '+z', height: 2.27,
    title: 'Hangar | Midpoly | Access stand', author: 'sauti', uid: '46b3d3077d304c5695ef4ceef7685970' },
  { name: 'fueltruck', src: 'assets/props/fueltruck.glb', forward: '-z', length: 8.4,
    title: 'Airport Fuel Truck', author: 'Nguyentuannghia 64', uid: '15a96ac34ece464480a9b8620dc3a3d3' },
  { name: 'tug', src: 'assets/props/tug.glb', forward: '+x', length: 3.3, simplify: 0.2,
    title: 'Airport Tug', author: 'flightmaster177', uid: '388e668f8143432fb82c1268e1f9ab81' },
  { name: 'cones', src: 'assets/props/cones.glb', forward: '+z', scale: 1,
    title: 'Traffic Cones', author: 'NotAnotherApocalypticCo.', uid: 'e03b1d2dfdc0416bb8324d15573ea60c' },
  { name: 'forklift', src: 'assets/props/forklift.glb', forward: '+z', length: 3.3,
    title: 'Forklift low poly', author: 'Ricardo Sanchez', uid: '8ab650b3982243f8b661142de50f79c9' },
  { name: 'toolbox', src: 'assets/props/toolbox.glb', forward: '+z', height: 1.02,
    title: 'Industrial Toolbox', author: 'LuddePudde', uid: '5037b5bea4bf4bd7bf53d581d478bd90' },
  { name: 'drums', src: 'assets/props/drums.glb', forward: '+z', scale: 1,
    title: 'Oil Drums', author: 'Oliver Triplett', uid: 'f98003d19cd247f8aa4daad50c28512a' },
];

const YAW = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await mkdir('public/models/props', { recursive: true });

for (const p of PROPS) {
  if (ONLY && !ONLY.split(',').includes(p.name)) continue;
  const doc = await io.read(p.src);
  const root = doc.getRoot(), scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (p.drop) for (const n of root.listNodes()) if (p.drop.test(n.getName())) n.dispose();
  if (p.opaque) for (const m of root.listMaterials()) m.setAlphaMode('OPAQUE');
  // one root node carries the correction, so the model's own parts keep their pivots
  const top = doc.createNode(p.name);
  for (const c of scene.listChildren()) { scene.removeChild(c); top.addChild(c); }
  scene.addChild(top);
  const yaw = typeof p.forward === 'number' ? p.forward : YAW[p.forward];
  top.setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]);
  let b = getBounds(scene);
  const size = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
  const s = p.scale ?? (p.length ? p.length / size[2] : p.height / size[1]);
  top.setScale([s, s, s]);
  b = getBounds(scene);
  const c = [0, 1, 2].map((i) => (b.max[i] + b.min[i]) / 2);
  top.setTranslation([-c[0], p.origin === 'centre' ? -c[1] : -b.min[1], -c[2]]);
  b = getBounds(scene);
  const tex = p.tex ?? 1024;
  if (p.simplify) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: p.simplify, error: 0.002 }));
  await doc.transform(
    metalRough(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 85 }),
    prune(),
  );
  await io.write(`public/models/props/${p.name}.glb`, doc);
  console.log(`${p.name}: ${[0, 1, 2].map((i) => (b.max[i] - b.min[i]).toFixed(2)).join(' x ')} m`);
}

// the credits, from the same list
const lines = PROPS.map((p) => `- **${p.title}** by ${p.author}, [sketchfab.com/3d-models/${p.uid}](https://sketchfab.com/3d-models/${p.uid}), licensed [${BY}](https://creativecommons.org/licenses/by/4.0/). Used as \`${p.name}\`; reoriented, rescaled, textures recompressed${p.drop ? ', parts removed' : ''}${p.simplify ? ', simplified' : ''}${p.opaque ? ', materials made opaque' : ''}.`);
await writeFile('CREDITS.md', `# Credits

The game's code is MIT (see \`LICENSE\`). These third-party 3D models are not: each keeps its own
licence. They come from [Sketchfab](https://sketchfab.com) by way of the
[Objaverse](https://huggingface.co/datasets/allenai/objaverse) dataset. The originals are in
\`assets/props/\`; \`npm run props\` (\`tools/build-props.mjs\`) builds the game's copies in
\`public/models/props/\`, and writes this file.

## Props

${lines.join('\n')}

## Animation

- Mixamo clips (\`assets/mocap/\`, \`public/anims/\`), from the three.js examples, under Mixamo's terms.
`);
console.log('wrote CREDITS.md');
