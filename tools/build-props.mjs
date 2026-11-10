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
import { TEXTURES } from './fetch-textures.mjs';

const ONLY = process.env.ONLY;
const BY = 'CC BY 4.0';

// forward: the way the raw model's front faces (an axis, or a yaw in radians that turns it to +Z). Size by length (along the front after turning),
// height, or a plain scale. origin 'ground' stands it on y = 0; 'centre' centres it (hand props).
// drop: parts to remove (node names). opaque: materials that were exported as blended for no reason.
// simplify: the share of triangles to keep, for heavy scans. tex: the texture size (512 for props
// only ever seen small or far off; the default 1024).
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
  { name: 'apartment', src: 'assets/props/apartment.glb', forward: '+z', height: 11.2, tex: 512,
    title: 'Apartment Complex Building', author: 'jimbogies', uid: 'fa7c256f511946fea3cd819e0f492741' },
  // Coast City: downtown and the street (six office blocks by one artist, in centimetres), the kit
  // of street furniture (traffic lights, lamps, hydrants, bins, a dumpster, a stop sign), a bus
  // shelter, a billboard
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ name: `office${i}`, src: `assets/props/office${i}.glb`, forward: '+z', scale: 0.01,
    title: i === 3 ? 'Mid rise wall to wall office building' : 'Low rise wall to wall office building', author: 'aitortilla01',
    uid: ['1f341f8261af4fb6a0dc910c2aae37a6', 'dcf171dca9174000a0fa8d44660253d0', '4d2c3f3450ef4e849056b88b49873ce2', '2dd3bdd5e0724eb1b1025a922fa754cf', 'be7583ca46f5411d8921ac85d8c33f3f', '6488ad5edd1d454884b3fe030f5f04b1'][i - 1] })),
  { name: 'cityprops', src: 'assets/props/cityprops.glb', forward: '+z', scale: 1, origin: 'keep',
    title: 'Street and City Props Dumpster Traffic Light', author: 'Spookyghostboo', uid: '27a6775c51e44bfda8e1ac8725eb3e9e' },
  { name: 'busstop', src: 'assets/props/busstop.glb', forward: '+z', height: 2.6,
    title: 'Bus Stop - low', author: 'Milionna', uid: '977fe8fc309548299cbc537f382e1a03' },
  { name: 'billboard', src: 'assets/props/billboard.glb', forward: '+z', scale: 1, tex: 512, simplify: 0.3,
    title: 'Billboard00 - Street Kitbash Collection', author: 'experiment_studio', uid: 'b66e0cf58c8d4f86bc2acd24c61c2d0b' },
  // Hal's kitchenette
  { name: 'fridge', src: 'assets/props/fridge.glb', forward: '+z', height: 1.52, opaque: true,
    title: 'Old Fridge', author: 'sergeilihandristov', uid: '6b2862c241754f5d81690e8664e41091' },
  { name: 'coffee', src: 'assets/props/coffee.glb', forward: '+z', height: 0.36, tex: 512,
    title: 'Coffee Maker', author: 'Ryan_Nein', uid: '383923d4412f4b66937d9c1779a9a0a2' },
  // the jet Martin Jordan flew, in the dream
  { name: 'f104', src: 'assets/props/f104.glb', forward: '+z', length: 16.7, tex: 512,
    title: 'F-104 Starfighter', author: 'Mikhail_Zelenov', uid: '96e60f2f463b4b1c8822079f1b2e21eb' },
  // on the apron and in the hangars
  { name: 'booth', src: 'assets/props/booth.glb', forward: '+z', scale: 1,
    title: 'Security Booth / Cabina de seguridad', author: 'claudio', uid: 'b15e6647ee434bcea57b2d965d3a1b30' },
  { name: 'stand', src: 'assets/props/stand.glb', forward: '+z', height: 2.27, tex: 512,
    title: 'Hangar | Midpoly | Access stand', author: 'sauti', uid: '46b3d3077d304c5695ef4ceef7685970' },
  { name: 'fueltruck', src: 'assets/props/fueltruck.glb', forward: '-z', length: 8.4,
    title: 'Airport Fuel Truck', author: 'Nguyentuannghia 64', uid: '15a96ac34ece464480a9b8620dc3a3d3' },
  { name: 'tug', src: 'assets/props/tug.glb', forward: '+x', length: 3.3, simplify: 0.2,
    title: 'Airport Tug', author: 'flightmaster177', uid: '388e668f8143432fb82c1268e1f9ab81' },
  { name: 'cones', src: 'assets/props/cones.glb', forward: '+z', scale: 1,
    title: 'Traffic Cones', author: 'NotAnotherApocalypticCo.', uid: 'e03b1d2dfdc0416bb8324d15573ea60c' },
  { name: 'forklift', src: 'assets/props/forklift.glb', forward: '+z', length: 3.3,
    title: 'Forklift low poly', author: 'Ricardo Sanchez', uid: '8ab650b3982243f8b661142de50f79c9' },
  { name: 'toolbox', src: 'assets/props/toolbox.glb', forward: '+z', height: 1.02, tex: 512,
    title: 'Industrial Toolbox', author: 'LuddePudde', uid: '5037b5bea4bf4bd7bf53d581d478bd90' },
  { name: 'drums', src: 'assets/props/drums.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Oil Drums', author: 'Oliver Triplett', uid: 'f98003d19cd247f8aa4daad50c28512a' },
  // the Air Force's night at the lake (Part Three: Hector Hammond at the wreck)
  { name: 'm35', src: 'assets/props/m35.glb', forward: '+z', length: 6.78, tex: 1024,
    title: 'Military Truck 1/2 Ton', author: 'Arion Digital', uid: '5d19c751b12849eeb390d637b2b686a1' },
  { name: 'lighttower', src: 'assets/props/lighttower.glb', forward: '+z', length: 3.8, tex: 512,
    title: 'Light Tower', author: 'krambulini', uid: '9addea6a4129438b83a1fc3ed4a784ec' },
  // Martin Jordan's grave: the memorial park on the edge of Coast City
  { name: 'tombstones', src: 'assets/props/tombstones.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Tombstones', author: 'LucasPresoto', uid: '4f1a26f1cef2403d8aafddccbf5fafc3' },
  { name: 'cemgate', src: 'assets/props/cemgate.glb', forward: '+z', scale: 1, tex: 1024,
    title: 'Graveyard Entrance', author: 'Reydara', uid: 'e0aa0d480159465fa26795c26546a3b6' },
  { name: 'ironfence', src: 'assets/props/ironfence.glb', forward: '+z', scale: 1, tex: 512,
    title: 'CC0 - Iron Fence', author: 'plaggy', uid: '9c5ad29c104c48e69a1227927655d489' },
  { name: 'cypress', src: 'assets/props/cypress.glb', forward: '+z', height: 6.5, tex: 512,
    title: 'Cypress tree', author: 'ElectroNick', uid: '249d8cb553a8469e9d645713f8e96ed1' },
  { name: 'bench', src: 'assets/props/bench.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Granite Bench', author: 'YouniqueĪdeaStudio', uid: '424c3679dcdd44d380da36a82f5dc382' },
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
  if (p.origin !== 'keep') top.setTranslation([-c[0], p.origin === 'centre' ? -c[1] : -b.min[1], -c[2]]);
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

## Textures

${TEXTURES.map((t) => `- **${t.id}** from [Poly Haven](https://polyhaven.com/a/${t.id}), [CC0](https://creativecommons.org/publicdomain/zero/1.0/): ${t.use}. Converted to WebP at 1K (\`public/textures/pbr/\`, \`tools/fetch-textures.mjs\`).`).join('\n')}

## Voices

Every spoken line is pre-rendered (\`public/voices/\`, \`npm run voices\`, \`tools/build-voices.mjs\`) with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad, licensed
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), using the ONNX export
[onnx-community/Kokoro-82M-v1.0-ONNX-timestamped](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped)
(Apache-2.0) through [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) (Apache-2.0).
Each character's voice is a Kokoro voice shifted in pitch and processed for the part.

## Animation

- Mixamo clips (\`assets/mocap/\`, \`public/anims/\`), from the three.js examples, under Mixamo's terms.
`);
console.log('wrote CREDITS.md');
