// Playland on the Point, and the beach's furniture (the map rework, 2026-11-24: city/Layout.js, the beach widening
// into a point round (-1450, 1600)). The amusement park every Californian beach town had: a boardwalk deck on the
// sand, its gate on Ocean Avenue's promenade with the ticket booths under a lit sign, the midway down its middle
// (game booths and food carts either side, strings of bulbs over it), the looping coaster along its north side,
// the carousel turning and the bumper cars to the south, the food court by the sea end. All of it downloaded
// (CREDITS.md) but the deck, the gate and the bulbs; lit at night (its bulbs, the rides' lights, a few of the
// scene's pooled lamps). On the beach: parasols and deck chairs in clusters down the sand.
//
// The pier's arcade is called Playland too (city/Waterfront.js): the same family's, on the pier since before the
// park was built on the Point (Part Seven's chapters are staged on the pier and its wheel; nothing here touches it).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prop, piece } from '../props/Props.js';
import { ktx2 } from '../engine/Ktx2.js';
import { assetUrl } from '../engine/Assets.js';
import { Batch } from './Kit.js';
import { box, label, building } from './Building.js';
import { coastAt } from './Layout.js';
import { PROMENADE, PIER, seeded } from './Plan.js';
import { Placed, Tiers, partsOf, solidOf, at, ORIGIN, boundsOf } from './Port.js';

export const PLAYLAND_PROPS = ['coaster', 'carousel', 'bumpercars', 'ticketbooth', 'gamebooth', 'foodcart', 'icecream', 'hotdog', 'parasol', 'deckchair', 'parkbench', 'cityprops'];
// the park's deck, its gate on the promenade, the midway's line
export const PLAYLAND = { x0: -1442, x1: -1215, z0: 1598, z1: 1835, gateZ: 1700, deck: 0.32 };
// where its big things stand on the deck: the coaster's middle, the arcade north of the midway, the casino's
// ballroom along the south edge
const COASTER = { x: -1366, z: 1790 };
const ARCADE = { x0: -1290, x1: -1228, z0: 1722, z1: 1750 };
const CASINO = { x0: -1345, x1: -1242, z0: 1603, z1: 1631 };
// the family coaster and the kiddie coaster in the south-west corner, the food court beside them
const FAMILY = { x: -1412, z: 1645 }, KIDDIE = { x: -1414, z: 1671 }, COURT = { x: -1364, z: 1656 };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _Y = V(0, 1, 0);

// The two rides whose trains run (their own clips, which props/Props.js doesn't keep): loaded with the shore's props
// (city/Waterfront.js waits for these too)
const RIDES = {};
export function preloadRides() {
  const loader = new GLTFLoader().setKTX2Loader(ktx2);
  return Promise.all(['familycoaster', 'kiddiecoaster'].map((n) => loader.loadAsync(assetUrl(`models/props/${n}.glb`)).then((g) => { RIDES[n] = g; })));
}

// Bulbs: one instanced mesh of small spheres, each its colour, unlit by day and glowing at night (a basic
// material: its colour is the light, turned up past one for the bloom)
export class Bulbs {
  constructor(group, list, r = 0.09) {
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), this.mat, list.length);
    const c = new THREE.Color();
    list.forEach((b, i) => { this.mesh.setMatrixAt(i, _m.makeTranslation(b.x, b.y, b.z)); this.mesh.setColorAt(i, c.set(b.c ?? 0xffe6b0)); });
    this.mesh.computeBoundingSphere();
    this.mesh.castShadow = false;
    group.add(this.mesh);
    this.setNight(0);
  }
  setNight(k) { this.mat.color.setScalar(0.45 + k * 2.6); }
}
// bulbs along a sagging string from a to b (n of them)
const string = (a, b, n, sag, colours, out) => {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t), z: a.z + (b.z - a.z) * t, c: colours[i % colours.length] });
  }
};
const FAIR = [0xffd9a0, 0xff6a5a, 0x7ab8ff, 0xffe066, 0xffd9a0, 0x8ff0a8];

export function* buildPlayland(ctx) {
  const { f, mats } = ctx, P = f.physics, L = PLAYLAND;
  const root = new THREE.Group();
  root.name = 'playland';
  root.position.copy(ORIGIN);
  ctx.root.add(root);
  const rnd = seeded(1953), batch = new Batch(), placed = new Placed(f, root), tiers = new Tiers(f), bulbs = [], lit = [], sources = [];
  const sctx = { batch, mats, signs: ctx.signs, signUses: [], rnd };
  const solid = (x0, y0, z0, x1, y1, z1) => P.fixedBox(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).add(ORIGIN), V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2));
  const out = { root, placed, update: null };
  const D = L.deck;

  // ---- the boardwalk: the park's deck in 40 m pieces (each a shade off the last, the boards laid at different
  // times), its edge boards, a rail round it but at the gate; and the walk out to it from the promenade
  const wood = mats.deck;
  for (let x = L.x0; x < L.x1; x += 40) for (let z = L.z0; z < L.z1; z += 40) {
    const x1 = Math.min(L.x1, x + 40), z1 = Math.min(L.z1, z + 40), t = 0.9 + rnd() * 0.12;
    batch.add('deck', box(x, D - 0.12, z, x1, D, z1), null, new THREE.Color(t, t * 0.98, t * 0.95));
    solid(x, D - 0.6, z, x1, D, z1);
  }
  batch.add('paint', box(L.x0 - 0.3, -0.4, L.z0 - 0.3, L.x1 + 0.3, D - 0.12, L.z1 + 0.3), null, 0x5a4634); // (its fascia, down into the sand)
  const walk = { x0: L.x1, x1: PROMENADE.x0 - 0.5, z0: L.gateZ - 7, z1: L.gateZ + 7 };
  batch.add('deck', box(walk.x0, D - 0.12, walk.z0, walk.x1, D, walk.z1), null, 0xe8e0d4);
  solid(walk.x0, D - 0.6, walk.z0, walk.x1, D, walk.z1);
  // (a ramp down from the deck's height to the promenade's paving at its end)
  // rails: posts and two rails, round the deck and down the walk
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.5)), yaw = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) { const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n; batch.add('paint', box(x - 0.06, D, z - 0.06, x + 0.06, D + 1.05, z + 0.06), null, 0xe9e3d6); }
    const M = at((ax + bx) / 2, 0, (az + bz) / 2, yaw);
    for (const h of [1.0, 0.5]) batch.add('paint', box(-0.045, D + h - 0.04, -len / 2, 0.045, D + h + 0.04, len / 2), M, 0xe9e3d6);
    P.fixedBox(V((ax + bx) / 2, D + 0.55, (az + bz) / 2).add(ORIGIN), V(0.06, 0.55, len / 2), new THREE.Quaternion().setFromAxisAngle(_Y, yaw));
  };
  rail(L.x0, L.z0, L.x1, L.z0); rail(L.x0, L.z1, L.x1, L.z1); rail(L.x0, L.z0, L.x0, L.z1);
  rail(L.x1, L.z0, L.x1, walk.z0); rail(L.x1, walk.z1, L.x1, L.z1);
  rail(walk.x0, walk.z0, walk.x1, walk.z0); rail(walk.x0, walk.z1, walk.x1, walk.z1);
  yield;

  // ---- the gate: two striped towers, the arch between them with the sign, a ticket booth each side
  {
    const gx = L.x1 + 6, z0 = walk.z0, z1 = walk.z1, H = 9.5, RED = 0xc8343c, CREAM = 0xf3e6c8;
    for (const z of [z0 - 1.4, z1 + 1.4]) {
      for (let y = 0; y < H; y += 1.2) batch.add('paint', box(gx - 1.3, D + y, z - 1.3, gx + 1.3, D + y + 0.6, z + 1.3), null, RED), batch.add('paint', box(gx - 1.3, D + y + 0.6, z - 1.3, gx + 1.3, D + y + 1.2, z + 1.3), null, CREAM);
      batch.add('paint', box(gx - 1.6, D + H, z - 1.6, gx + 1.6, D + H + 0.4, z + 1.6), null, 0xe0b040);
      batch.add('paint', new THREE.ConeGeometry(1.5, 2.6, 8).translate(gx, D + H + 1.7, z), null, RED);
      solid(gx - 1.3, 0, z - 1.3, gx + 1.3, D + H + 3, z + 1.3);
      // bulbs up its corners
      for (let y = 0.6; y < H; y += 0.7) for (const [dx, dz] of [[-1.35, -1.35], [-1.35, 1.35], [1.35, -1.35], [1.35, 1.35]]) bulbs.push({ x: gx + dx, y: D + y, z: z + dz, c: 0xffe2a8 });
    }
    // the arch's board, its sign facing the promenade (east)
    batch.add('paint', box(gx - 0.5, D + H - 3.2, z0 - 1.4, gx + 0.5, D + H + 0.2, z1 + 1.4), null, 0x2a0f3c);
    const F = new THREE.Matrix4().makeTranslation(gx + 0.5, 0, z1 + 1.2).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
    label(sctx, F, 0, z1 - z0 + 2.4, D + H - 3.0, 2.8, { text: 'PLAYLAND', sub: 'Rides · Games · Since 1928', style: 'lightbox', bg: '#2a0f3c', fg: '#ffd23f', accent: '#ff5a9a', font: 'deco', wear: 0.08 }, 0.02);
    const G = new THREE.Matrix4().makeTranslation(gx - 0.5, 0, z0 - 1.2).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    label(sctx, G, 0, z1 - z0 + 2.4, D + H - 3.0, 2.8, { text: 'COME BACK SOON', style: 'lightbox', bg: '#2a0f3c', fg: '#ffd23f', accent: '#ff5a9a', font: 'deco', wear: 0.08 }, 0.02);
    for (let z = z0 - 1.2; z <= z1 + 1.2; z += 0.6) for (const y of [D + H - 3.3, D + H + 0.3]) bulbs.push({ x: gx + 0.6, y, z, c: 0xffd27a });
    solid(gx - 0.5, D + H - 3.2, z0 - 1.4, gx + 0.5, D + H + 0.2, z1 + 1.4);
    // the ticket booths, inside the gate, their windows facing the walk
    placed.kind('ticket', prop('ticketbooth'), { dist: 220, shadow: 40, touch: { kind: 'solid', stuff: 'wood' } });
    placed.put('ticket', at(L.x1 - 4, D, z0 - 3.2, Math.PI / 2));
    placed.put('ticket', at(L.x1 - 4, D, z1 + 3.2, Math.PI / 2));
  }
  yield;

  // ---- the midway: down the deck's middle, booths and carts either side facing it, strings of bulbs across it
  // between lamp posts
  const mz = L.gateZ;
  placed.kind('game', prop('gamebooth'), { flat: true, dist: 260, shadow: 40, touch: { kind: 'solid', stuff: 'wood' } });
  placed.kind('food', prop('foodcart'), { dist: 180, shadow: 30, touch: { kind: 'breaks', mass: 180, strong: 14, stuff: 'metal' } });
  placed.kind('ice', prop('icecream'), { dist: 160, shadow: 25, touch: { kind: 'breaks', mass: 90, strong: 9, stuff: 'metal' } });
  placed.kind('hotdog', prop('hotdog'), { dist: 200, shadow: 30, touch: { kind: 'breaks', mass: 160, strong: 12, stuff: 'metal' } });
  const lampT = piece('cityprops', /low_poly012_/, { root: true });
  lampT.scale.setScalar(1.8);
  const lampG = new THREE.Group(); lampG.add(lampT);
  placed.kind('lamp', lampG, { dist: 600, shadow: 60, touch: { kind: 'breaks', mass: 45, strong: 14, stuff: 'metal', box: new THREE.Box3(V(-0.14, 0, -0.14), V(0.14, 6.5, 0.14)) } });
  const stalls = ['game', 'game', 'food', 'game', 'hotdog', 'game', 'ice', 'game', 'game', 'food'];
  placed.kind('bin', piece('cityprops', /low_poly001_/, { root: true }), { dist: 120, shadow: 20, touch: { kind: 'breaks', mass: 18, strong: 3, stuff: 'plastic' } });
  let k = 0;
  // (the midway's east half has the arcade behind its north side: its booths start west of it)
  for (let x = L.x1 - 16; x > L.x0 + 20; x -= 7.8, k++) {
    for (const side of [-1, 1]) {
      if (side > 0 && x > ARCADE.x0 - 4) continue;
      if (side < 0 && x < COURT.x - 22) continue; // (the coasters' corner)
      const kind = stalls[(k * 3 + (side > 0 ? 1 : 0)) % stalls.length];
      const z = mz + side * (kind === 'game' ? 9.2 : 8.6), yaw = side > 0 ? Math.PI : 0;
      placed.put(kind, at(x + (rnd() - 0.5) * 0.8, D, z, yaw + (rnd() - 0.5) * 0.06));
    }
    if (k % 3 === 0) for (const side of [-1, 1]) {
      placed.put('lamp', at(x - 3.9, D, mz + side * 6.6, side > 0 ? Math.PI / 2 : -Math.PI / 2));
      placed.put('bin', at(x - 3.9 + 1.1, D, mz + side * 6.9, 0));
      // a string of bulbs across, and one down each side to the next post
      if (side > 0) string(V(x - 3.9, D + 5.6, mz - 6.6), V(x - 3.9, D + 5.6, mz + 6.6), 18, 0.9, FAIR, bulbs);
      const nx = x - 3.9 - 23.4;
      if (nx > L.x0 + 14) string(V(x - 3.9, D + 5.6, mz + side * 6.6), V(nx, D + 5.6, mz + side * 6.6), 30, 0.7, FAIR, bulbs);
      const s = new THREE.Object3D(); s.position.set(x - 3.9, D + 4.5, mz).add(ORIGIN); f.scene.add(s);
      if (side > 0 && k % 6 === 0) sources.push(f.lamps?.add(s, { color: 0xffd8a0, power: 0, reach: 16 }));
    }
  }
  yield;

  // ---- the pavilions (the city's kit, Building.js): the arcade north of the midway by the gate, the old casino's
  // ballroom along the deck's south edge, their signs lit at night
  {
    const bctx = { batch, mats, signs: ctx.signs, signUses: sctx.signUses, rnd, props: false, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [], decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [] };
    const A = ARCADE;
    building(bctx, { t: 0.25, coping: 'cap', at: V(A.x1, D, A.z0), yaw: Math.PI, w: A.x1 - A.x0, d: A.z1 - A.z0, floors: 1, gh: 6.2, parapet: 1.6, color: 0xf6e7b0, trim: 0xd0567a, frame: 0xd0567a,
      back: true, sides: { L: 'windows', R: 'windows' }, bands: [5.9, 6.1, 6.3], bandColor: 0xd0567a, bays: 0,
      shops: [{ x0: 2, x1: 30, sign: { text: 'FUN ZONE ARCADE', sub: 'Pinball · Skee-Ball · Prizes · Photo Booth', style: 'lightbox', bg: '#2a0f3c', fg: '#ffd23f', accent: '#ff5a9a', font: 'deco', h: 1.3 }, neon: 'OPEN', door: 'centre', frame: 0xd0567a, kick: 'checker', lit: 1, h: 4.6 },
        { x0: 32, x1: A.x1 - A.x0 - 2, sign: { text: 'Salt Water Taffy', sub: 'Fudge · Caramel Corn · Cotton Candy', style: 'board', bg: '#f2d26a', fg: '#c0201b', accent: '#2f6f7a', font: 'script', h: 1.0 }, awning: 2.2, door: 'left', frame: 0x2f6f7a, kick: 'paint', kickColor: 0x2f6f7a, lit: 1, h: 3.6 }] });
    const C = CASINO;
    building(bctx, { t: 0.3, coping: 'cap', at: V(C.x0, D, C.z1), yaw: 0, w: C.x1 - C.x0, d: C.z1 - C.z0, floors: 2, gh: 5.4, fh: 4.2, parapet: 1.4, color: 0xf4f0e6, trim: 0x2f6f7a, frame: 0x2f6f7a, cornice: true, belt: true,
      back: true, sides: { L: 'windows', R: 'windows' }, bays: 14, win: { w: 2.2, h: 2.4, sill: 0.6, arch: 1.1 },
      shops: [{ x0: 6, x1: C.x1 - C.x0 - 6, sign: { text: 'THE CASINO', sub: 'Ballroom · Dancing Nightly · Est. 1928', style: 'board', bg: '#1d3b5a', fg: '#f3e8cf', accent: '#e8b04a', font: 'deco', h: 1.2 }, awning: 2.6, door: 'centre', frame: 0x2f6f7a, kick: 'paint', kickColor: 0x1d3b5a, lit: 1, h: 4.2 }] });
    label(bctx, new THREE.Matrix4().makeTranslation(C.x0, D, C.z1), 18, C.x1 - C.x0 - 18, 5.4 + 4.2 + 0.3, 1.4, { text: 'THE CASINO', style: 'neon', fg: '#ff5a9a', accent: '#ffd23f', font: 'deco', wear: 0.05 }, 0.3);
    for (const sl of [...bctx.solids, ...bctx.parapets]) P.fixedBox(sl.c.clone().add(ORIGIN), sl.half, sl.q);
    out.pavilions = bctx;
  }
  yield;

  // ---- the coaster: along the deck's north side, its long axis east-west; every rail and support solid
  {
    const o = prop('coaster');
    o.position.set(COASTER.x, D, COASTER.z).add(ORIGIN);
    o.rotation.y = Math.PI / 2;
    f.scene.add(o);
    o.updateMatrixWorld(true);
    o.traverse((m) => { if (m.isMesh) { m.material.roughness = Math.max(0.45, m.material.roughness); m.material.metalness = Math.min(0.3, m.material.metalness); } });
    tiers.add(o, { near: 900, far: 3600, shadow: 300, ratio: 0.15, flat: true });
    f.smash.solid(o, { stuff: 'metal', mesh: true });
    out.coaster = o;
  }
  yield;

  // ---- the carousel (turning) and the bumper cars (their cars going round), south of the midway
  {
    const o = prop('carousel');
    o.position.set(L.x1 - 34, D, mz - 40).add(ORIGIN);
    f.scene.add(o);
    o.updateMatrixWorld(true);
    tiers.add(o, { near: 900, far: 0, shadow: 120 });
    out.carousel = o;
    const c = o.position.clone().sub(ORIGIN);
    solidOf(f, [new THREE.CylinderGeometry(5.3, 5.4, 0.7, 24).translate(c.x + ORIGIN.x, D + 0.35, c.z + ORIGIN.z), new THREE.CylinderGeometry(1.2, 1.2, 6, 12).translate(c.x + ORIGIN.x, D + 3, c.z + ORIGIN.z), new THREE.CylinderGeometry(5.4, 5.4, 1.4, 24).translate(c.x + ORIGIN.x, D + 6.2, c.z + ORIGIN.z)], 'wood');
    // its bulbs: round the canopy's rim (turning with it: their own group)
    const ring = [];
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push({ x: Math.cos(a) * 5.35, y: 5.55, z: Math.sin(a) * 5.35, c: i % 2 ? 0xffe0a0 : 0xff9a7a }); }
    const turn = new THREE.Group();
    turn.position.copy(o.position);
    f.scene.add(turn);
    out.carouselBulbs = new Bulbs(turn, ring, 0.07);
    out.carouselTurn = turn;
    const s = new THREE.Object3D(); s.position.set(c.x, D + 4, c.z).add(ORIGIN); f.scene.add(s);
    sources.push(f.lamps?.add(s, { color: 0xffc890, power: 0, reach: 18 }));
  }
  {
    const o = prop('bumpercars');
    o.position.set(L.x1 - 80, D, mz - 44).add(ORIGIN);
    f.scene.add(o);
    o.updateMatrixWorld(true);
    // (its floor, its posts and its sign's beam: an arena, walked into)
    const b = boundsOf(o), c = o.position.clone().sub(ORIGIN);
    solid(c.x + b.min.x, D, c.z + b.min.z, c.x + b.max.x, D + 0.6, c.z + b.max.z);
    for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]]) solid(c.x + x - 0.2 + (x < 0 ? 0.6 : -0.6), D, c.z + z - 0.2 + (z < 0 ? 0.6 : -0.6), c.x + x + 0.2 + (x < 0 ? 0.6 : -0.6), D + 5.5, c.z + z + 0.2 + (z < 0 ? 0.6 : -0.6));
    const s = new THREE.Object3D(); s.position.set(c.x, D + 4, c.z).add(ORIGIN); f.scene.add(s);
    sources.push(f.lamps?.add(s, { color: 0xb8d0ff, power: 0, reach: 16 }));
    // the cars: each its own loop round the floor (an ellipse, its own speed and phase), turned the way it goes
    const cars = [];
    o.traverse((m) => { if (/^auto_low/.test(m.name) && m.parent && !/^auto_low/.test(m.parent.name)) cars.push(m); });
    // (the world's axes in each car's parent's frame: the downloaded file's root is turned and scaled)
    out.bumpers = cars.map((m, i) => {
      m.parent.updateMatrixWorld(true);
      const q = m.parent.getWorldQuaternion(new THREE.Quaternion()).invert(), sc = m.parent.getWorldScale(V(1, 1, 1)).x;
      return { m, home: m.position.clone(), q0: m.quaternion.clone(), up: V(0, 1, 0).applyQuaternion(q), ex: V(1, 0, 0).applyQuaternion(q).divideScalar(sc), ez: V(0, 0, 1).applyQuaternion(q).divideScalar(sc),
        ph: i * 1.7, w: 0.35 + (i % 3) * 0.12, rx: 1.0 + (i % 4) * 0.45, rz: 0.7 + (i % 3) * 0.35 };
    });
    out.bumpCar = o;
    tiers.add(o, { near: 800, far: 0, shadow: 120, keep: (m) => { for (let a = m; a && a !== o; a = a.parent) if (/^auto_low/.test(a.name)) return true; return false; } });
  }
  // the family coaster and the kiddie coaster in the corner by the sea: their trains running (their own clips);
  // their tracks solid (not the trains: a collider left where a train set off)
  out.rides = [];
  for (const [name, at2] of [['familycoaster', FAMILY], ['kiddiecoaster', KIDDIE]]) {
    const g = RIDES[name];
    if (!g) continue;
    const o = g.scene;
    o.position.set(at2.x, D, at2.z).add(ORIGIN);
    o.rotation.y = Math.PI / 2;
    f.scene.add(o);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; for (const k of ['map', 'normalMap']) if (m.material[k]) m.material[k].anisotropy = 8; m.material.roughness = Math.max(0.35, m.material.roughness); } });
    o.updateMatrixWorld(true);
    const moving = new Set(g.animations.flatMap((c) => c.tracks.map((t) => t.name.split('.')[0])));
    const still = [];
    o.traverse((m) => {
      if (!m.isMesh) return;
      for (let a = m; a; a = a.parent) if (moving.has(a.name) || /cart/i.test(m.material.name)) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      still.push(geo);
    });
    solidOf(f, still, 'metal');
    tiers.add(o, { near: 1400, far: 0, shadow: 160, keep: (m) => { for (let a = m; a && a !== o; a = a.parent) if (moving.has(a.name)) return true; return /cart/i.test(m.material?.name ?? ''); } });
    const mixer = new THREE.AnimationMixer(o);
    for (const c of g.animations) mixer.clipAction(c).play();
    out.rides.push({ o, mixer, at: o.position.clone() });
  }
  // the food court at the sea end: benches and parasols round the carts
  placed.kind('bench', piece('parkbench', /Object_2/), { dist: 120, shadow: 20, touch: { kind: 'solid', stuff: 'wood' } });
  placed.kind('shade', prop('parasol'), { flat: true, dist: 200, shadow: 30, touch: { kind: 'breaks', mass: 8, strong: 2.5, stuff: 'plastic', box: new THREE.Box3(V(-0.06, 0, -0.06), V(0.06, 2.4, 0.06)) } });
  const fc = COURT;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 9 + (i % 2) * 6;
    placed.put(i % 2 ? 'shade' : 'bench', at(fc.x + Math.cos(a) * r, D, fc.z + Math.sin(a) * r, -a + Math.PI / 2));
  }
  placed.put('hotdog', at(fc.x, D, fc.z, Math.PI / 2));
  placed.put('ice', at(fc.x - 7, D, fc.z + 18, 0.4));
  placed.put('food', at(fc.x + 12, D, fc.z - 20, -2.2));
  placed.put('ice', at(L.x1 - 12, D, mz + 14, Math.PI * 0.8));
  // palms round the deck's edge and on the lawn between the midway and the coaster (the scene's palm field:
  // city/Palms.js; their trunks solid)
  const palmAt = [];
  for (let x = L.x0 + 8; x < L.x1 - 8; x += 26) palmAt.push([x, L.z0 + 4], [x, L.z1 - 4]);
  for (let z = L.z0 + 30; z < L.z1 - 20; z += 30) palmAt.push([L.x0 + 4, z]);
  for (let x = COASTER.x + 70; x < ARCADE.x0 - 8; x += 18) palmAt.push([x, mz + 22]);
  for (const [x, z] of palmAt) {
    if (Math.abs(z - mz) < 12 && x > L.x1 - 20) continue;
    const s = 0.62 + rnd() * 0.16;
    f.palms?.add(rnd() < 0.5 ? 0 : 1, new THREE.Matrix4().makeTranslation(ORIGIN.x, 0, ORIGIN.z).multiply(at(x, D, z, rnd() * 6, s)));
    const o = new THREE.Object3D(); o.position.set(x, D, z).add(ORIGIN);
    f.smash.add(o, { kind: 'solid', stuff: 'wood', shrink: 1, glass: false, box: new THREE.Box3(V(-0.28, 0, -0.28), V(0.28, 7, 0.28)) });
    batch.add('iron', box(x - 0.62, D, z - 0.62, x + 0.62, D + 0.025, z + 0.62), null, 0x2a2622);
  }
  yield;

  // ---- in
  root.add(batch.build(mats, { cell: 300 })); // (one cell: Playland's a block's size, and from the city it was a draw a material for every 80 m)
  placed.finish();
  out.bulbs = new Bulbs(root, bulbs);
  root.updateMatrixWorld(true);
  out.update = (dt, cam) => {
    placed.update(cam);
    tiers.update(cam, dt);
    out.carousel.rotation.y += dt * 0.42;
    out.carouselTurn.rotation.y = out.carousel.rotation.y;
    out.carousel.updateMatrixWorld(true);
    // the coasters' trains, within sight of them
    for (const r of out.rides) if (r.o.visible && cam.distanceTo(r.at) < 600) r.mixer.update(dt);
    // the bumper cars, within sight of them
    if (out.bumpCar.visible) {
      out.bt = (out.bt ?? 0) + dt;
      for (const b of out.bumpers) {
        const a = out.bt * b.w + b.ph;
        b.m.position.copy(b.home).addScaledVector(b.ex, Math.cos(a) * b.rx).addScaledVector(b.ez, Math.sin(a * 1.3) * b.rz);
        b.m.quaternion.setFromAxisAngle(b.up, Math.atan2(-Math.sin(a) * b.rx, Math.cos(a * 1.3) * 1.3 * b.rz)).multiply(b.q0);
      }
      out.bumpCar.updateMatrixWorld(true);
    }
  };
  out.setNight = (k) => {
    out.bulbs.setNight(k);
    out.carouselBulbs.setNight(k);
    for (const s of sources) if (s) s.power = k * 6;
    for (const l of lit) l.mat.emissiveIntensity = k * l.on;
  };
  void partsOf; void PIER;
  return out;
}

// ------------------------------------------------------------------------------------------------ the beach
// Parasols and deck chairs in clusters down the sand: thicker by the pier and in front of Playland, none on the
// stretches between; each knocked over by a blow (light: a parasol 8 kg).
export function* buildBeach(ctx) {
  const { f } = ctx;
  const root = new THREE.Group();
  root.name = 'beach';
  root.position.copy(ORIGIN);
  ctx.root.add(root);
  const rnd = seeded(77), placed = new Placed(f, root);
  placed.kind('chair', prop('deckchair'), { dist: 260, shadow: 30, touch: { kind: 'breaks', mass: 12, strong: 3, stuff: 'wood' } });
  placed.kind('parasol', prop('parasol'), { flat: true, dist: 300, shadow: 35, touch: { kind: 'breaks', mass: 8, strong: 2.5, stuff: 'plastic', box: new THREE.Box3(V(-0.06, 0, -0.06), V(0.06, 2.4, 0.06)) } });
  const spots = [PIER.z - 70, PIER.z + 80, PIER.z + 190, -330, -80, 760, 1050, 1350, 1560, 1700, 1880, 2050];
  for (const z0 of spots) {
    const n = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const z = z0 + (rnd() - 0.5) * 60, shore = coastAt(z), beach = PROMENADE.x0 - shore;
      if (beach < 30) continue;
      // (between the water's edge and the promenade, nearer the water; off Playland's deck)
      const x = shore + 18 + rnd() * Math.min(55, beach - 30);
      if (x > PLAYLAND.x0 - 8 && z > PLAYLAND.z0 - 8 && z < PLAYLAND.z1 + 8) continue;
      placed.put(rnd() < 0.7 ? 'chair' : 'parasol', at(x, 0, z, -Math.PI / 2 + (rnd() - 0.5) * 1.2));
    }
  }
  yield;
  placed.finish();
  return { root, placed, update: (dt, cam) => placed.update(cam) };
}
