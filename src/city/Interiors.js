// Inside the shops you can walk into (2026-11-18, the user: "building not interactable yet"): Rosie's
// Diner and Coast Liquor. Built in the building's frame (its front along +x, the room behind it toward
// -z), into the block's Batch where it's fixed, the downloaded furniture through `ctx.objects`, the
// goods on the shelves as instanced boxes and cans with printed labels. Each room records its seats and
// things to use (`ctx.spots`), its lights (`ctx.roomLights`, on only when the camera is near) and its
// sound (`ctx.rooms`); the story (Roam) gives them their actions.
import * as THREE from 'three';
import { prop } from '../props/Props.js';
import { box } from './Building.js';
import { goodsTexture } from './Signs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const FLOOR = 0.15; // a shop's floor: the pavement's height, a step up from the road

// everything below in the building's frame M; `at(x, y, z)` into the block's
export function kit(ctx, M) {
  const add = (key, g, color) => ctx.batch.add(key, g, M, color);
  const at = (x, y, z) => V(x, y, z).applyMatrix4(M);
  const yawOf = new THREE.Euler().setFromRotationMatrix(M).y;
  const put = (name, x, y, z, yaw = 0, kind = name, scale = 1) => {
    const o = prop(name);
    o.scale.multiplyScalar(scale);
    o.position.copy(at(x, y, z));
    o.rotation.y = yawOf + yaw;
    ctx.objects.push({ o, kind });
    return o;
  };
  // a fitting built from boxes is solid too: a collider the same size (the counters, the back bar, the
  // kitchen wall; without them he walked through the counter into the kitchen)
  const q = new THREE.Quaternion().setFromRotationMatrix(M);
  const solid = (x0, y0, z0, x1, y1, z1, stuff = 'metal') => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q, stuff });
  return { add, at, put, yawOf, solid };
}

// the room's shell inside the building's: the floor up to the pavement, walls lined, the ceiling
export function shell(ctx, M, { x0, x1, z0, z1, ceil, floorKey = 'checker', floorColor = 0xffffff, wall = 0xefe8d8, dado = null, dadoH = 1.1, ceilColor = 0xf2f0ea, openL = [], openR = [] }) {
  const { add } = kit(ctx, M);
  add(floorKey, box(x0, 0, z1, x1, FLOOR, z0), floorColor);
  add('paint', box(x0, ceil, z1, x1, ceil + 0.06, z0), ceilColor);
  // each wall's face, set in 2 cm; a dado 5 mm proud of it and a chrome rail on its top (n: the way
  // into the room). (The dado came out flat on the face for a wall facing -x, the right one, and
  // flickered with it on the diner's corner pier: each is measured from the face now.)
  const lining = (a0, b0, a1, b1, nx, nz) => {
    add('paint', box(a0, FLOOR, b0, a1, ceil, b1), wall);
    if (!dado) return;
    const out = (lo, hi, n, d) => (n > 0 ? [hi, hi + d] : n < 0 ? [lo - d, lo] : [lo, hi]); // (face to d into the room)
    for (const [d, y0, y1, key, color] of [[0.005, FLOOR, FLOOR + dadoH, 'paint', dado], [0.025, FLOOR + dadoH - 0.02, FLOOR + dadoH + 0.025, 'metal', 0xd8dde2]]) {
      const [xa, xb] = out(a0, a1, nx, d), [za, zb] = out(b0, b1, nz, d);
      add(key, box(xa, y0, za, xb, y1, zb), color);
    }
  };
  // a side wall with shop windows in it is lined only where there's wall (lined over, the windows were
  // a white wall from inside, and the dado lay on the window's kick plate and flickered with it)
  const along = (open) => {
    const gaps = open.map(([a, b]) => [Math.min(a, b) - 0.3, Math.max(a, b) + 0.3]).sort((p, q) => p[0] - q[0]);
    const out = [];
    let z = z1;
    for (const [a, b] of gaps) { if (a > z + 0.05) out.push([z, Math.min(a, z0)]); z = Math.max(z, b); }
    if (z0 > z + 0.05) out.push([z, z0]);
    return out;
  };
  lining(x0, z1, x1, z1 + 0.02, 0, 1); // the back
  for (const [a, b] of along(openL)) lining(x0, a, x0 + 0.02, b, 1, 0); // the left
  for (const [a, b] of along(openR)) lining(x1 - 0.02, a, x1, b, -1, 0); // the right
  // a cove between the back wall and the ceiling
  add('paint', box(x0, ceil - 0.08, z1 + 0.02, x1, ceil, z1 + 0.06), 0xffffff);
}

// the booths' laminate and vinyl satin, not glossy: the sun in through the windows made their tables a
// white blaze in the bloom
function satin(o) {
  o.traverse((m) => {
    if (!m.isMesh) return;
    for (const mt of [m.material].flat()) {
      mt.roughness = Math.max(mt.roughness, 0.58);
      mt.envMapIntensity = Math.min(mt.envMapIntensity ?? 1, 0.5);
      // (the download has its table top and vinyl as metal: the sun mirrored off them; only the chrome is)
      if (/table|chair/i.test(mt.name)) mt.metalness = 0.04;
    }
  });
  return o;
}

// a light in the room, and its fitting: a warm pendant over the diner's counter, a tube in a store's troffer
function light(ctx, M, x, y, z, { color = 0xffe2b8, power = 14, reach = 13 } = {}) {
  const pl = new THREE.PointLight(color, 0, reach, 2);
  pl.position.copy(V(x, y, z).applyMatrix4(M));
  ctx.roomLights.push({ light: pl, power });
  return pl;
}

// ------------------------------------------------------------------------------------- the diner
// Rosie's: booths down both windows, the jukebox, a counter of chrome stools, the back bar (the coffee
// machine, the warmers and their pots, the pie case), the menu boards, the pass to the kitchen and its
// order wheel, the restrooms, pendant lamps over the counter
export { shopRoom } from './Shops.js';

export function diner(ctx, M, r) {
  const { add, put, yawOf, solid } = kit(ctx, M);
  const { x0, x1, z0, z1 } = r, ceil = 3.5;
  shell(ctx, M, { ...r, ceil, floorKey: 'checker', wall: 0xf1ead8, dado: 0xa51d1a, dadoH: 1.05 });
  // booths along the front windows, back to back, their tables' ends to the glass
  for (let i = 0; i < 7; i++) {
    const x = x0 + 1.9 + i * 2.15;
    satin(put('booth', x, FLOOR, z0 - 0.95));
    ctx.spots.push({ kind: 'seat', label: 'Sit in the booth', at: V(x - 0.76, FLOOR, z0 - 0.95).applyMatrix4(M), approach: V(x - 0.7, FLOOR, z0 - 2.1).applyMatrix4(M), face: yawOf + Math.PI / 2, sit: 0.47, room: 'diner' });
    condiments(ctx, M, x, FLOOR + 0.645, z0 - 0.62); // (the booth's table top, measured: 64.5 cm up)
    ctx.posts.push({ who: 'diner', room: 'diner', at: V(x + 0.76, FLOOR, z0 - 0.95).applyMatrix4(M), face: yawOf - Math.PI / 2, sit: 0.47, seat: true });
  }
  // and down the side windows, back from the door (the first stood square in front of it: you walked
  // in and into its end)
  for (let i = 0; i < 2; i++) {
    const z = z0 - 4.7 - i * 2.15;
    satin(put('booth', x1 - 0.95, FLOOR, z, Math.PI / 2));
    ctx.spots.push({ kind: 'seat', label: 'Sit in the booth', at: V(x1 - 0.95, FLOOR, z - 0.76).applyMatrix4(M), approach: V(x1 - 2.1, FLOOR, z - 0.7).applyMatrix4(M), face: yawOf, sit: 0.47, room: 'diner', side: true });
  }
  put('jukebox', x0 + 0.62, FLOOR, z0 - 2.9, Math.PI / 2);
  ctx.spots.push({ kind: 'jukebox', label: 'Play the jukebox', at: V(x0 + 1.35, FLOOR, z0 - 2.9).applyMatrix4(M), look: V(x0 + 0.62, FLOOR + 1.2, z0 - 2.9).applyMatrix4(M), room: 'diner' });
  // the counter: red below a chrome band, a laminate top with a chrome edge, a foot rail
  const ca = x0 + 3.2, cb = x0 + 17.2, cz = z0 - 6.0, cd = 0.62, ch = 1.05;
  // in two runs, with a gate between them in front of the pass for Rosie (round either end, every trip
  // to a booth was 25 to 35 s): between the seventh stool and the eighth, solid to Hal
  const ga = x0 + 10.39, gb = x0 + 11.09;
  for (const [a, b] of [[ca, ga], [gb, cb]]) {
    const ea = a === ca ? 0.06 : 0, eb = b === cb ? 0.06 : 0; // (the top's overhang, not into the gate)
    add('paint', box(a, FLOOR, cz - cd, b, ch - 0.05, cz - 0.08), 0xa51d1a);
    solid(a - ea, FLOOR, cz - cd - 0.02, b + eb, ch, cz + 0.05);
    add('metal', box(a - 0.02 * ea / 0.06, FLOOR + 0.06, cz - 0.1, b + 0.02 * eb / 0.06, FLOOR + 0.12, cz - 0.07), 0x2a2a2a); // the kick
    for (const y of [0.55, 0.62]) add('metal', box(a - ea / 6, FLOOR + y, cz - 0.085, b + eb / 6, FLOOR + y + 0.03, cz - 0.07), 0xd8dde2);
    add('paint', box(a - ea, ch - 0.05, cz - cd - 0.02, b + eb, ch, cz + 0.05), 0xe8e2d4);
    add('metal', box(a - ea - 0.01, ch - 0.065, cz + 0.03, b + eb + 0.01, ch + 0.005, cz + 0.06), 0xd8dde2);
    add('metal', new THREE.CylinderGeometry(0.025, 0.025, b - a, 10).rotateZ(Math.PI / 2).translate((a + b) / 2, FLOOR + 0.26, cz + 0.12), 0xc8ccd0);
    // the gate's side of each run: a chrome edge down it
    const e = a === ca ? b : a, s = a === ca ? 1 : -1;
    add('metal', box(Math.min(e, e + s * 0.015), FLOOR, cz - cd - 0.02, Math.max(e, e + s * 0.015), ch, cz + 0.05), 0xd8dde2);
  }
  gate(ctx, M, ga, gb, cz - cd / 2, ch - 0.12);
  solid(ga, FLOOR, cz - cd, gb, FLOOR + 0.95, cz + 0.02);
  for (let i = 0; i < 13; i++) {
    const x = ca + 0.55 + i * ((cb - ca - 1.1) / 12);
    put('stool', x, FLOOR, cz + 0.42);
    ctx.spots.push({ kind: 'seat', label: 'Sit at the counter', at: V(x, FLOOR, cz + 0.42).applyMatrix4(M), approach: V(x, FLOOR, cz + 1.05).applyMatrix4(M), look: V(x, FLOOR + 1.1, cz - 0.3).applyMatrix4(M), face: yawOf + Math.PI, sit: 0.78, stool: true, room: 'diner' });
    if (i % 2 === 0) condiments(ctx, M, x + (i === 6 ? -0.3 : 0.3), ch, cz - 0.25); // (the seventh's this side of the gate)
    else add('paint', box(x - 0.13, ch, cz - 0.42, x + 0.13, ch + 0.004, cz - 0.08), 0xf6f2e8); // a place mat
  }
  // the back bar: steel cabinets, the coffee machine, warmers and pots, a pie case, cups stacked
  const bz = z0 - 8.0;
  // where the people who work here stand (story/CityLife.js): Rosie behind the counter, walking its
  // length to whoever sits down; the cook on the line in the kitchen, turning to the pass
  ctx.posts.push({ who: 'rosie', room: 'diner', at: V(ca + 6.5, FLOOR, cz - 1.3).applyMatrix4(M), beat: [V(ca + 0.8, FLOOR, cz - 1.3).applyMatrix4(M), V(cb - 0.8, FLOOR, cz - 1.3).applyMatrix4(M)], face: yawOf });
  // in two runs, the pass between them (Rosie steps up to it for the plates Dot puts up)
  for (const [a, b] of [[x0 + 2.0, x0 + 8.6], [x0 + 12.8, x0 + 18.6]]) {
    add('metal', box(a, FLOOR, bz - 0.7, b, FLOOR + 0.92, bz), 0xb9bec4);
    solid(a - 0.02, FLOOR, bz - 0.72, b + 0.02, FLOOR + 0.96, bz + 0.02);
    add('metal', box(a - 0.02, FLOOR + 0.92, bz - 0.72, b + 0.02, FLOOR + 0.96, bz + 0.02), 0xd8dde2);
  }
  put('espresso', x0 + 4.2, FLOOR + 0.96, bz - 0.36, 0);
  for (const x of [x0 + 7.0, x0 + 7.45, x0 + 7.9]) { // coffee pots on their warmers
    add('dark', new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16).translate(x, FLOOR + 0.97, bz - 0.35), 0x1a1a1a);
    add('clearGlass', new THREE.CylinderGeometry(0.075, 0.09, 0.18, 14).translate(x, FLOOR + 1.07, bz - 0.35), 0xffffff);
    add('dark', new THREE.CylinderGeometry(0.07, 0.085, 0.1, 14).translate(x, FLOOR + 1.03, bz - 0.35), 0x2a160c); // the coffee in it
    add('dark', box(x + 0.08, FLOOR + 1.04, bz - 0.37, x + 0.11, FLOOR + 1.14, bz - 0.33), 0x111111);
  }
  pieCase(ctx, M, x0 + 14.4, FLOOR + 0.96, bz - 0.38);
  for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) add('paint', new THREE.CylinderGeometry(0.045, 0.035, 0.09, 10).translate(x0 + 17.0 + k * 0.13, FLOOR + 1.01 + j * 0.085, bz - 0.3), 0xf6f2ea); // cups
  // the kitchen wall: the pass (its steel shelf, the heat lamps, the order wheel), the menu boards
  const kz = z0 - 8.9;
  const kw = (a, b, ya, yb) => { add('paint', box(a, ya, kz - 0.18, b, yb, kz), 0xf1ead8); solid(a, ya, kz - 0.18, b, yb, kz, 'stone'); };
  kw(x0, x0 + 8.8, FLOOR, ceil); kw(x0 + 12.6, x1, FLOOR, ceil); kw(x0 + 8.8, x0 + 12.6, FLOOR, FLOOR + 1.2); kw(x0 + 8.8, x0 + 12.6, FLOOR + 2.05, ceil);
  add('paint', box(x0, FLOOR, kz, x1, FLOOR + 1.05, kz + 0.02), 0xa51d1a);
  add('metal', box(x0 + 8.8, FLOOR + 1.2, kz - 0.45, x0 + 12.6, FLOOR + 1.24, kz + 0.25), 0xd8dde2);
  for (const x of [x0 + 9.5, x0 + 10.7, x0 + 11.9]) add('glow', box(x - 0.25, FLOOR + 1.95, kz - 0.1, x + 0.25, FLOOR + 2.0, kz + 0.05), 0xff8a40);
  add('metal', new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20).rotateX(Math.PI / 2).translate(x0 + 10.7, FLOOR + 2.2, kz + 0.06), 0xc8ccd0); // the wheel
  menuBoards(ctx, M, x0 + 3.0, x0 + 18.0, FLOOR + 2.35, kz + 0.03);
  kitchen(ctx, M, { x0, x1, z0: kz - 0.18, z1, ceil });
  ctx.posts.push({ who: 'cook', room: 'diner', at: V(x0 + 10.2, FLOOR, kz - 1.05).applyMatrix4(M), beat: [V(x0 + 9.4, FLOOR, kz - 1.05).applyMatrix4(M), V(x0 + 11.6, FLOOR, kz - 1.05).applyMatrix4(M)], face: yawOf + Math.PI, pass: yawOf });
  // the restrooms, at the back on the left
  // (the men's room: somewhere out of sight to change, Roam.blockRoam)
  ctx.spots.push({ kind: 'restroom', label: 'Go into the restroom', at: V(x0 + 1.0, FLOOR, kz + 0.75).applyMatrix4(M), look: V(x0 + 1.0, FLOOR + 1.5, kz).applyMatrix4(M), face: yawOf + Math.PI, room: 'diner' });
  for (const [x, t] of [[x0 + 1.0, 'GUYS'], [x0 + 2.4, 'DOLLS']]) {
    add('paint', box(x - 0.45, FLOOR, kz + 0.02, x + 0.45, FLOOR + 2.1, kz + 0.06), 0x6a3a24);
    add('metal', box(x + 0.28, FLOOR + 1.0, kz + 0.06, x + 0.34, FLOOR + 1.05, kz + 0.1), 0xb08d4a);
    ctx.labels.push({ M, u0: x - 0.3, u1: x + 0.3, y0: FLOOR + 1.55, h: 0.22, z: kz + 0.065, sign: { text: t, style: 'board', bg: '#1d1d1d', fg: '#ffe08a', font: 'condensed', wear: 0.1 } });
  }
  // pendant lamps over the counter, warm; tubes over the booths
  for (let i = 0; i < 6; i++) {
    const x = ca + 1.1 + i * 2.35;
    add('metal', new THREE.CylinderGeometry(0.008, 0.008, 0.9, 6).translate(x, ceil - 0.45, cz - 0.3), 0x333333);
    add('paint', new THREE.ConeGeometry(0.2, 0.18, 18, 1, true).translate(x, ceil - 0.95, cz - 0.3), 0xa51d1a);
    add('glow', new THREE.SphereGeometry(0.07, 12, 8).translate(x, ceil - 1.0, cz - 0.3), 0xffd9a0);
  }
  for (let i = 0; i < 5; i++) add('glow', box(x0 + 2.5 + i * 3.3 - 0.6, ceil - 0.03, z0 - 1.35, x0 + 2.5 + i * 3.3 + 0.6, ceil - 0.01, z0 - 1.15), 0xffffff);
  // one real light per room (three.js lights every surface in the scene with every point light, near
  // or not): the fittings and the scene's own light do the rest
  light(ctx, M, x0 + 11.0, ceil - 1.2, z0 - 4.0, { color: 0xffe4c0, power: 7, reach: 16 }); // (lower: up by the ceiling it made a hot spot)
  // (from the aisle: by the stools it was nearer than the stool he'd stepped up to, and E read the menu)
  ctx.spots.push({ kind: 'menu', label: 'Read the menu', at: V(x0 + 10.7, FLOOR, z0 - 3.4).applyMatrix4(M), look: V(x0 + 10.7, FLOOR + 2.7, kz).applyMatrix4(M), room: 'diner' });
  // its measures, for the people who work it (story/DinerLife.js): the counter, Rosie's lane behind it,
  // the back bar, the pass, the aisle between the booths and the stools
  ctx.rooms.push({ name: 'diner', M, x0, x1, z0, z1, ca, cb, cz, bz, kz, lane: cz - 1.3, aisle: z0 - 3.25, pass: [x0 + 8.8, x0 + 12.6], gate: (ga + gb) / 2, ceil });
}

// the counter's gate: a red half door, chrome along its top, on a hinge at `a`; it swings as Rosie comes
// through (HalsBlock's doors, `staff`: not for Hal, who can't pass it)
function gate(ctx, M, a, b, z, h) {
  const red = ctx.gateRed ??= new THREE.MeshStandardMaterial({ color: 0xa51d1a, roughness: 0.55, metalness: 0.04 });
  const chrome = ctx.gateChrome ??= new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.8 });
  const W = b - a - 0.02, leaf = new THREE.Group();
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; leaf.add(m); };
  part(new THREE.BoxGeometry(W, h - 0.08, 0.04).translate(W / 2 + 0.01, FLOOR + 0.04 + (h - 0.08) / 2, 0), red);
  part(new THREE.BoxGeometry(W, 0.04, 0.06).translate(W / 2 + 0.01, FLOOR + h - 0.02, 0), chrome);
  for (const y of [0.55, 0.62]) part(new THREE.BoxGeometry(W, 0.03, 0.05).translate(W / 2 + 0.01, FLOOR + y, 0), chrome);
  const pivot = new THREE.Group();
  pivot.position.copy(V(a, 0, z).applyMatrix4(M));
  pivot.quaternion.setFromRotationMatrix(M);
  pivot.add(leaf);
  ctx.doors.push({ pivot, q0: pivot.quaternion.clone(), at: V((a + b) / 2, 1.0, z).applyMatrix4(M), inside: V((a + b) / 2, 0, z - 1.0).applyMatrix4(M), open: 0, dir: 1, room: 'diner', staff: true });
}

function condiments(ctx, M, x, y, z) {
  const { put } = kit(ctx, M);
  put('napkins', x - 0.06, y, z, 0, 'small');
  put('ketchup', x + 0.06, y, z + 0.02, 0, 'small');
  ctx.batch.add('clearGlass', new THREE.CylinderGeometry(0.03, 0.03, 0.11, 10).translate(x + 0.13, y + 0.055, z), M, 0xffffff); // the sugar
  ctx.batch.add('metal', new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10).translate(x + 0.13, y + 0.12, z), M, 0xd8dde2);
}

// a glass case of pies on the back bar, its tiers and the pies on them
function pieCase(ctx, M, x, y, z) {
  const { add } = kit(ctx, M);
  add('metal', box(x - 0.6, y, z - 0.25, x + 0.6, y + 0.04, z + 0.25), 0xd8dde2);
  add('clearGlass', box(x - 0.6, y + 0.04, z - 0.25, x + 0.6, y + 0.7, z + 0.25), 0xffffff);
  add('metal', box(x - 0.6, y + 0.7, z - 0.25, x + 0.6, y + 0.73, z + 0.25), 0xd8dde2);
  for (const ty of [0.05, 0.36]) {
    add('clearGlass', box(x - 0.56, y + ty, z - 0.22, x + 0.56, y + ty + 0.01, z + 0.22), 0xffffff);
    for (const px of [-0.35, 0, 0.35]) {
      const c = [0xc9873d, 0x8a2a2a, 0xe6d27a][Math.floor(Math.random() * 3)];
      add('paint', new THREE.CylinderGeometry(0.14, 0.13, 0.06, 18).translate(x + px, y + ty + 0.04, z), 0xd9a35a); // the crust
      add('paint', new THREE.CylinderGeometry(0.125, 0.125, 0.02, 18).translate(x + px, y + ty + 0.075, z), c);
    }
  }
}

// the boards over the back bar: what's served and what it costs
function menuBoards(ctx, M, a, b, y, z) {
  const items = [
    ['BREAKFAST ALL DAY', 'Two Eggs Any Style $2.95 · Short Stack $2.25 · Huevos Rancheros $3.75'],
    ['BURGERS & MELTS', 'Rosie Burger $3.50 · Patty Melt $3.75 · Chili Cheese Fries $2.50'],
    ['PIE · SHAKES · COFFEE', 'Pie of the Day $1.95 · Malted Shake $1.85 · Bottomless Coffee 75¢'],
  ];
  const w = (b - a) / 3;
  items.forEach(([title, sub], i) => ctx.labels.push({ M, u0: a + i * w + 0.1, u1: a + (i + 1) * w - 0.1, y0: y, h: 0.85, z, sign: { text: title, sub, style: 'lightbox', bg: '#1b1b1b', fg: '#ffe08a', accent: '#ffffff', font: 'condensed', wear: 0.15 }, lit: true }));
}

// what shows of the kitchen through the pass: the grill and its hood, the steel counters, a fridge
function kitchen(ctx, M, { x0, x1, z0, z1, ceil }) {
  const { add, solid } = kit(ctx, M);
  solid(x0 + 8.4, FLOOR, z0 - 2.4, x0 + 13.0, FLOOR + 0.96, z0 - 1.6); // the line
  solid(x0 + 14.0, FLOOR, z1 + 0.05, x0 + 15.4, FLOOR + 2.1, z1 + 0.85); // the fridge
  add('paint', box(x0, FLOOR, z1, x1, FLOOR + 0.005, z0), 0x9a9a92);
  add('metal', box(x0 + 8.4, FLOOR, z0 - 2.4, x0 + 13.0, FLOOR + 0.92, z0 - 1.6), 0xb9bec4); // the line
  add('dark', box(x0 + 9.0, FLOOR + 0.92, z0 - 2.35, x0 + 11.0, FLOOR + 0.96, z0 - 1.65), 0x1a1a1a); // the griddle
  add('metal', box(x0 + 8.6, ceil - 0.9, z0 - 2.6, x0 + 12.8, ceil - 0.2, z0 - 1.4), 0xa9aeb4); // the hood
  add('paint', box(x0 + 0.2, FLOOR, z1 + 0.02, x1 - 0.2, ceil, z1 + 0.05), 0xdcdcd4); // white tile, the far wall
  add('metal', box(x0 + 14.0, FLOOR, z1 + 0.05, x0 + 15.4, FLOOR + 2.1, z1 + 0.85), 0xc8ccd0); // the fridge
}

// --------------------------------------------------------------------------------- the corner store
// Coast Liquor: the counter by the door (the register, scratchers, the cigarette wall behind it, a
// candy rack, the security mirror), three aisles of gondolas stocked to the edges, coolers of drinks
// down the back wall, shelving on the sides, the ATM, the magazine rack, the ice chest
export function market(ctx, M, r) {
  const { add, put, solid } = kit(ctx, M);
  const { x0, x1, z0, z1 } = r, ceil = 3.0;
  shell(ctx, M, { ...r, ceil, floorKey: 'checker', floorColor: 0xb9bdbf, wall: 0xe9ece6, ceilColor: 0xeeeeea });
  const goods = ctx.goods;
  // the drop ceiling's grid and its troffers
  for (let x = x0 + 0.6; x < x1; x += 0.6) add('metal', box(x - 0.01, ceil - 0.012, z1, x + 0.01, ceil, z0), 0xd0d0cc);
  for (let z = z0 - 0.6; z > z1; z -= 0.6) add('metal', box(x0, ceil - 0.012, z - 0.01, x1, ceil, z + 0.01), 0xd0d0cc);
  for (let x = x0 + 2.4; x < x1 - 1; x += 3.6) for (let z = z0 - 2.4; z > z1 + 1; z -= 3.6) {
    add('metal', box(x - 0.62, ceil - 0.03, z - 0.32, x + 0.62, ceil - 0.012, z + 0.32), 0xe8e8e4);
    add('glow', box(x - 0.55, ceil - 0.034, z - 0.25, x + 0.55, ceil - 0.03, z + 0.25), 0xf4f8ff);
  }
  // the counter, right of the door, and what's on it and behind it
  const ca = x0 + 2.5, cb = x0 + 6.4, cz = z0 - 1.9;
  ctx.posts.push({ who: 'clerk', room: 'market', at: V(ca + 1.3, FLOOR, cz - 1.1).applyMatrix4(M), beat: [V(ca + 0.5, FLOOR, cz - 1.1).applyMatrix4(M), V(ca + 2.6, FLOOR, cz - 1.1).applyMatrix4(M)], face: kit(ctx, M).yawOf });
  // a shopper down the first aisle, reading labels, close to the shelf (in the aisle's middle he left
  // Hal no way past)
  ctx.posts.push({ who: 'shopper', room: 'market', at: V(x0 + 8.5, FLOOR, z0 - 7.0).applyMatrix4(M), beat: [V(x0 + 8.5, FLOOR, z0 - 5.6).applyMatrix4(M), V(x0 + 8.5, FLOOR, z1 + 3.6).applyMatrix4(M)], face: kit(ctx, M).yawOf - Math.PI / 2, browse: true });
  add('paint', box(ca, FLOOR, cz - 0.7, cb, FLOOR + 0.98, cz), 0x5a3a24);
  add('paint', box(ca - 0.03, FLOOR + 0.98, cz - 0.73, cb + 0.03, FLOOR + 1.02, cz + 0.03), 0xd6d0c2);
  add('paint', box(cb - 0.7, FLOOR, cz - 2.6, cb, FLOOR + 0.98, cz - 0.7), 0x5a3a24); // its return
  solid(ca - 0.03, FLOOR, cz - 0.73, cb + 0.03, FLOOR + 1.02, cz + 0.03, 'wood');
  solid(cb - 0.7, FLOOR, cz - 2.6, cb, FLOOR + 1.02, cz - 0.7, 'wood');
  put('oldregister', ca + 1.3, FLOOR + 1.02, cz - 0.38, 0);
  add('clearGlass', box(ca + 2.2, FLOOR + 1.02, cz - 0.4, ca + 2.9, FLOOR + 1.3, cz - 0.1), 0xffffff); // the scratchers' case
  goods.push(...shelfRow(ca + 2.24, ca + 2.86, FLOOR + 1.04, cz - 0.25, 0.06, 0.18, 0.01, M, true));
  ctx.labels.push({ M, u0: ca + 0.2, u1: ca + 1.0, y0: FLOOR + 1.02, h: 0.3, z: cz + 0.031, sign: { text: 'LOTTO', sub: 'Scratchers · Super Pick', style: 'lightbox', bg: '#1f4f9a', fg: '#ffd23f', accent: '#ffffff', font: 'condensed', wear: 0.1 }, lit: true });
  // the cigarette wall behind the counter
  const wz = cz - 1.5;
  add('paint', box(ca, FLOOR + 0.98, wz - 0.3, cb - 0.8, FLOOR + 2.4, wz), 0x2a2a2a);
  solid(ca, FLOOR, wz - 0.3, cb - 0.8, FLOOR + 2.4, wz, 'wood');
  for (let k = 0; k < 6; k++) goods.push(...shelfRow(ca + 0.1, cb - 0.9, FLOOR + 1.05 + k * 0.22, wz + 0.02, 0.055, 0.09, 0.006, M, false, 0.06));
  // candy at the counter's front, a security mirror in the far corner
  add('metal', box(ca + 0.1, FLOOR, cz + 0.02, ca + 1.6, FLOOR + 0.75, cz + 0.3), 0x8a8e92);
  solid(ca + 0.1, FLOOR, cz + 0.02, ca + 1.6, FLOOR + 0.75, cz + 0.3);
  for (let k = 0; k < 3; k++) goods.push(...shelfRow(ca + 0.15, ca + 1.55, FLOOR + 0.12 + k * 0.22, cz + 0.28, 0.045, 0.12, 0.004, M, true, 0.12));
  add('metal', new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).translate(x1 - 0.4, ceil - 0.45, z1 + 0.4).applyMatrix4(new THREE.Matrix4()), 0xeeeeee);
  // three aisles of gondolas, from behind the counter to the coolers
  for (const gx of [x0 + 7.7, x0 + 10.3, x0 + 12.9]) gondola(ctx, M, gx, z0 - 4.9, z1 + 3.0);
  // the coolers along the back wall, stocked
  for (let i = 0; i < 6; i++) {
    const x = x0 + 4.4 + i * 1.29;
    put('cooler', x, FLOOR, z1 + 0.45, 0);
    for (const y of [0.42, 0.7, 0.99, 1.24]) goods.push(...cans(x - 0.52, x + 0.52, FLOOR + y, z1 + 0.35, M));
  }
  ctx.labels.push({ M, u0: x0 + 3.8, u1: x0 + 11.8, y0: FLOOR + 2.15, h: 0.45, z: z1 + 0.05, sign: { text: 'COLD BEER · SODA · JUICE', style: 'lightbox', bg: '#c0201b', fg: '#ffffff', font: 'condensed', wear: 0.1 }, lit: true });
  // shelving down both sides
  for (let i = 0; i < 6; i++) { put('wallshelf', x0 + 0.22, FLOOR, z0 - 4.2 - i * 1.6, Math.PI / 2); put('wallshelf', x1 - 0.22, FLOOR, z0 - 4.2 - i * 1.6, -Math.PI / 2); }
  // by the windows: the ATM, the magazines, the ice chest
  put('atm', x1 - 0.7, FLOOR, z0 - 0.65, Math.PI);
  put('magrack', x0 + 11.8, FLOOR, z0 - 0.7, Math.PI);
  add('paint', box(x0 + 8.0, FLOOR, z0 - 1.25, x0 + 9.4, FLOOR + 0.86, z0 - 0.45), 0xf4f4f0);
  solid(x0 + 7.98, FLOOR, z0 - 1.27, x0 + 9.42, FLOOR + 0.9, z0 - 0.43);
  add('metal', box(x0 + 7.98, FLOOR + 0.86, z0 - 1.27, x0 + 9.42, FLOOR + 0.9, z0 - 0.43), 0xc8ccd0);
  ctx.labels.push({ M, u0: x0 + 8.15, u1: x0 + 9.25, y0: FLOOR + 0.3, h: 0.4, z: z0 - 0.448, sign: { text: 'ICE', sub: 'Party Ice · 10 lb', style: 'board', bg: '#ffffff', fg: '#1f6fb0', accent: '#1f6fb0', font: 'condensed', wear: 0.2 } });
  light(ctx, M, x0 + 8.0, ceil - 0.3, z0 - 8.0, { color: 0xf2f6ff, power: 6.5, reach: 15 });
  ctx.spots.push({ kind: 'counter', label: 'Ring the bell', at: V(ca + 1.3, FLOOR, cz + 0.55).applyMatrix4(M), look: V(ca + 1.3, FLOOR + 1.1, cz - 0.4).applyMatrix4(M), room: 'market' });
  ctx.spots.push({ kind: 'cooler', label: 'Look in the cooler', at: V(x0 + 7.0, FLOOR, z1 + 1.6).applyMatrix4(M), look: V(x0 + 7.0, FLOOR + 1.1, z1 + 0.4).applyMatrix4(M), room: 'market' });
  ctx.spots.push({ kind: 'magazines', label: 'Look at the magazines', at: V(x0 + 11.8, FLOOR, z0 - 1.5).applyMatrix4(M), look: V(x0 + 11.8, FLOOR + 0.9, z0 - 0.7).applyMatrix4(M), room: 'market' });
  ctx.rooms.push({ name: 'market', M, x0, x1, z0, z1 });
}

// a double-sided gondola along z: its base and back panel, four shelves a side with price strips, the
// goods on them, an end cap facing the front
export function gondola(ctx, M, x, za, zb) {
  const { add, solid } = kit(ctx, M), goods = ctx.goods, h = 1.55;
  solid(x - 0.48, FLOOR, zb, x + 0.48, FLOOR + h + 0.05, za);
  add('metal', box(x - 0.48, FLOOR, zb, x + 0.48, FLOOR + 0.12, za), 0xe4e4e0);
  add('metal', box(x - 0.025, FLOOR + 0.12, zb, x + 0.025, FLOOR + h, za), 0xd8d8d2);
  for (const y of [0.12, 0.5, 0.88, 1.26]) for (const s of [-1, 1]) {
    add('metal', box(Math.min(x, x + s * 0.46), FLOOR + y, zb, Math.max(x, x + s * 0.46), FLOOR + y + 0.025, za), 0xe4e4e0);
    add('paint', box(x + s * 0.46 - 0.004, FLOOR + y - 0.03, zb, x + s * 0.464, FLOOR + y + 0.025, za), 0xe23a2a); // the price strip
    goods.push(...shelfRowZ(za - 0.05, zb + 0.05, FLOOR + y + 0.025, x + s * 0.24, s, M));
  }
  add('metal', box(x - 0.48, FLOOR + h, zb, x + 0.48, FLOOR + h + 0.05, za), 0xc8c8c2);
}

// goods along a shelf in x (facing +z), or in z (facing +x or -x): their boxes, sizes and labels
export function shelfRow(a, b, y, z, wMin, hMax, gap, M, small = false, d = 0.2) {
  const out = [];
  for (let u = a; u < b;) {
    const w = wMin + Math.random() * wMin * 1.6, h = (small ? 0.12 : hMax * 0.5) + Math.random() * hMax * 0.5;
    if (u + w > b) break;
    out.push({ M, x: u + w / 2, y: y + h / 2, z: z - d / 2, sx: w, sy: h, sz: d * (0.6 + Math.random() * 0.35), yaw: 0, cell: Math.floor(Math.random() * 64), kind: 'box' });
    u += w + gap;
  }
  return out;
}
export function shelfRowZ(za, zb, y, x, s, M) {
  const out = [];
  for (let z = za; z > zb;) {
    const w = 0.08 + Math.random() * 0.16, h = 0.12 + Math.random() * 0.22, can = Math.random() < 0.3;
    if (z - w < zb) break;
    out.push({ M, x, y: y + h / 2, z: z - w / 2, sx: can ? w * 0.7 : w, sy: h, sz: can ? w * 0.7 : 0.18 + Math.random() * 0.12, yaw: s * Math.PI / 2, cell: Math.floor(Math.random() * 64), kind: can ? 'can' : 'box' });
    z -= w + 0.008;
  }
  return out;
}
function cans(a, b, y, z, M) {
  const out = [];
  for (let u = a; u < b; u += 0.085) for (const dz of [0, -0.1, -0.2]) out.push({ M, x: u + 0.04, y: y + 0.07, z: z + dz, sx: 0.066, sy: Math.random() < 0.4 ? 0.2 : 0.125, sz: 0.066, yaw: 0, cell: 48 + Math.floor(Math.random() * 16), kind: 'can' });
  return out;
}

// The goods, as two instanced meshes (boxes and cans) over one label atlas: each instance's cell of it
export function stockShelves(ctx, group) {
  const tex = goodsTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvMapUv = vMapUv / 8.0 + aCell;\n#endif');
  };
  mat.customProgramCacheKey = () => 'goods';
  const out = [];
  for (const kind of ['box', 'can']) {
    const list = ctx.goods.filter((g) => g.kind === kind);
    if (!list.length) continue;
    const geo = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length), cell = new Float32Array(list.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    const yaws = new Map();
    list.forEach((it, i) => {
      if (!yaws.has(it.M)) yaws.set(it.M, new THREE.Euler().setFromRotationMatrix(it.M).y);
      p.set(it.x, it.y, it.z).applyMatrix4(it.M);
      q.setFromEuler(e.set(0, yaws.get(it.M) + it.yaw, 0));
      m.compose(p, q, sc.set(it.sx, it.sy, it.sz));
      mesh.setMatrixAt(i, m);
      cell[i * 2] = (it.cell % 8) / 8; cell[i * 2 + 1] = Math.floor(it.cell / 8) / 8;
    });
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    out.push(mesh);
  }
  return out;
}
