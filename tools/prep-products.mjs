// The shops' products (2026-11-24): each download cut down to what the shelves use and written to assets/props as
// the source tools/build-props.mjs builds from (the repo keeps every file under 25 MB: the bakery pack came at
// 31 MB with its 2K maps). From the downloads in DL (Objaverse's GLBs by Sketchfab uid, Poly Haven's glTFs by id,
// tools/build-props.mjs lists each one's source, author and licence):
//   keep / drop   parts kept or removed, by node name
//   straighten    each part turned about its own up axis so its long side lies along x (a kit's pieces were laid at
//                 angles: a candy bar's bounds came out square)
//   thin          the model turned so its thinnest axis is up (the donut lay tilted in its file)
//   tex           its maps no bigger than this (they're fitted again, and compressed, by the build)
//
//   DL=<downloads> node tools/prep-products.mjs          all of them    (ONLY=name,… some)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';

const DL = process.env.DL;
const sf = (uid) => `${DL}/raw/${uid}.glb`, ph = (id) => `${DL}/ph/${id}/${id}.gltf`;
export const PREP = [
  { name: 'snackbags', src: sf('fb44add4533149ab9dc559ec34d1b96c') },
  { name: 'chipbag', src: sf('7116fcdfbc3b4ad0bd578d6728915f84') },
  { name: 'cereal', src: sf('6f11ea9d68f049d7b3ea37d90cc23e90') },
  { name: 'sodacans', src: sf('96aa6a20264848ab9c5be2478594ec44') },
  { name: 'dietsoda', src: sf('fdc6b2fd40974708a07f1717a433e7c1') },
  { name: 'beercan', src: sf('3d0c9c38f10b4e739db811893dbac786') },
  { name: 'beerbottle', src: sf('3afb43308c914f7e9fa7850b2d38b90b'), keep: /^Object_(9|10|11|12)$/ }, // (the clean one of the two)
  { name: 'candybars', src: sf('e46b661ab1744b03b9f89d38d186d5d9'), straighten: true },
  { name: 'breads', src: sf('5fffce6e9a2d4c9b999e0f574d0b05f1'), tex: 512, drop: /^Sliced[ _]Bread|^Sub[ _]Sandwich|^Frosted[ _]Cake/ },
  { name: 'donut', src: sf('630fbf8b6af0481ebde40f2bd35947df'), thin: true },
  { name: 'muffin', src: sf('beac0847c065485b96c383979bad3efe') },
  { name: 'produce', src: sf('9846beef2c6b46caadc4a547a4dcd144'), tex: 512, drop: /^Cut[ _]Yellow|^Decorative[ _]Gourd|^Pumpkin|^Garlic|^Mango/ },
  { name: 'melons', src: sf('105da0b01b414fceb2feac631b0f64e8'), tex: 512, keep: /^(Watermelon|Banana|Pomegranate)/ },
  { name: 'painpills', src: sf('e8ff733b5a184335aac1e59d4c0820e0') },
  { name: 'medbox', src: sf('c071c69e73b0495692703cae47d21611'), keep: /^Curative[ _]case/, straighten: true },
  { name: 'toiletries', src: sf('f00fd952b5c640a1babf70cce5312d79'), drop: /^Shaver/ },
  { name: 'motoroil', src: sf('0b69e10add604138a3abfddc55c2b5be') },
  { name: 'ducttape', src: sf('859dab7e35a549c7a5417d76096252c1') },
  { name: 'liquor', src: sf('99999f032f624e8cb05651f041dbf8eb') },
  { name: 'port', src: sf('34d0475889c945708f070959cbf0df58') },
  { name: 'tumbler', src: sf('0ce3b89790954c499f9dc67f3e3a621f') },
  { name: 'groceries', src: ph('long_life_food') },
  { name: 'cigarettes', src: ph('cigarette_pack') },
  { name: 'croissant', src: ph('croissant') },
  { name: 'buns', src: ph('hamburger_buns') },
  { name: 'wine', src: ph('wine_bottles_01') },
  { name: 'pliers', src: ph('pliers') },
  { name: 'screwdriver', src: ph('screwdriver') },
  { name: 'tapemeasure', src: ph('measuring_tape_01') },
  { name: 'spraypaint', src: ph('spray_paint_bottles'), drop: /dirty/ },
  { name: 'lube', src: ph('lubricant_spray') },
  { name: 'cleaner', src: ph('all_purpose_cleaner') },
  { name: 'bleach', src: ph('bleach_bottle') },
  { name: 'multiclean', src: ph('multi_cleaner_bottle') },
  { name: 'drain', src: ph('drain_cleaner') },
  { name: 'bananas', src: ph('bananas'), keep: /bunch/ },
  { name: 'lemon', src: ph('lemon') },
  { name: 'onion', src: ph('yellow_onion') },
  { name: 'medtape', src: ph('medical_tape') },
];

const mat4 = (n) => new THREE.Matrix4().fromArray(n.getWorldMatrix());
// a mesh node's vertices in the world
function points(node) {
  const W = mat4(node), out = [], v = new THREE.Vector3();
  for (const p of node.getMesh().listPrimitives()) {
    const P = p.getAttribute('POSITION');
    for (let i = 0; i < P.getCount(); i++) out.push(v.fromArray(P.getElement(i, [])).applyMatrix4(W).clone());
  }
  return out;
}
// a node given a new world matrix
function setWorld(node, W) {
  const parent = node.getParentNode(), local = parent ? mat4(parent).invert().multiply(W) : W;
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  local.decompose(t, q, s);
  node.setTranslation(t.toArray()).setRotation(q.toArray()).setScale(s.toArray());
}
// the eigenvectors of a symmetric 3×3 (Jacobi)
function eigen(C) {
  const a = C.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
  }
  return [[0, 1, 2].map((i) => a[i][i]), [0, 1, 2].map((j) => new THREE.Vector3(V[0][j], V[1][j], V[2][j]))];
}
const centre = (pts) => pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const p of PREP) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(p.name)) continue;
  const doc = await io.read(p.src), root = doc.getRoot();
  const meshNodes = () => root.listNodes().filter((n) => n.getMesh());
  for (const n of meshNodes()) if ((p.keep && !p.keep.test(n.getName())) || p.drop?.test(n.getName())) n.dispose();
  if (p.straighten) for (const n of meshNodes()) {
    const pts = points(n), c = centre(pts);
    let xx = 0, zz = 0, xz = 0;
    for (const v of pts) { const x = v.x - c.x, z = v.z - c.z; xx += x * x; zz += z * z; xz += x * z; }
    const th = 0.5 * Math.atan2(2 * xz, xx - zz); // the long axis's angle from x
    const R = new THREE.Matrix4().makeTranslation(c.x, 0, c.z).multiply(new THREE.Matrix4().makeRotationY(th)).multiply(new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z));
    setWorld(n, R.multiply(mat4(n)));
  }
  if (p.thin) {
    const pts = meshNodes().flatMap(points), c = centre(pts), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const v of pts) { const d = [v.x - c.x, v.y - c.y, v.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
    const [vals, vecs] = eigen(C), up = vecs[vals.indexOf(Math.min(...vals))];
    if (up.y < 0) up.negate();
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0)));
    for (const n of meshNodes()) setWorld(n, R.clone().multiply(mat4(n)));
  }
  await doc.transform(prune(), dedup());
  // the maps brought down to `tex` (PNG where there's alpha, else JPEG)
  const cap = p.tex ?? 1024;
  for (const t of root.listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const s = sharp(Buffer.from(img)), m = await s.metadata();
    if (Math.max(m.width, m.height) <= cap && t.getMimeType() === 'image/jpeg') continue;
    const k = cap / Math.max(m.width, m.height), w = Math.max(4, Math.round(m.width * Math.min(1, k))), h = Math.max(4, Math.round(m.height * Math.min(1, k)));
    const png = m.hasAlpha && !(await s.clone().stats()).isOpaque; // (an opaque PNG as a JPEG: the produce's maps were 23 MB)
    const out = await s.resize(w, h).toFormat(png ? 'png' : 'jpeg', png ? {} : { quality: 92 }).toBuffer();
    t.setImage(new Uint8Array(out)).setMimeType(png ? 'image/png' : 'image/jpeg').setURI(t.getURI().replace(/\.\w+$/, png ? '.png' : '.jpg'));
  }
  await io.write(`assets/props/${p.name}.glb`, doc);
  const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, q) => k + (q.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  console.log(`${p.name}: ${meshNodes().map((n) => n.getName()).join(', ').slice(0, 160)} · ${tris} tris`);
}
