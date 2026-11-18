// Hal's block: the boulevard from his lot to the crossing, both sides (the first piece of Coast City
// built to the open world's standard, 2026-11-18). Seventeen buildings from the kit (Building.js),
// shops along the street and flats over them; the street: pavements with their joints, kerbs painted
// red where you can't park, parking on both sides with meters and parked cars, the centre line,
// crosswalks, drains and manholes; palms, lamps, hydrants, newspaper boxes, a mailbox, a payphone, a
// bus stop; the alleys behind (bins, a dumpster, power lines, back doors, a fire escape). Day or night
// (`setNight`): windows lit room by room, the signs and neon on, the lamps' light on the pavements.
//
// The block's frame is the lot's (LOT in Ferris.js): the boulevard's traffic lanes x 2..10 as
// before, a parking lane each side (kerbs at x -0.4 and 12.4), pavements 5.5 m to the fronts at x
// -5.9 and 17.9, from z -24 (the lot) to the cross street at z -210.
import * as THREE from 'three';
import { prop, piece } from '../props/Props.js';
import { makeCar } from '../props/Car.js';
import { RAPIER } from '../engine/Physics.js';
import { pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Batch, cityMaterials, cityU } from './Kit.js';
import { building, box, decal, label } from './Building.js';
import { flatten } from './Lod.js';
import { diner, market, stockShelves } from './Interiors.js';
import { SignAtlas, neonTexture, muralTexture, ghostTexture } from './Signs.js';

// How far the block's things are drawn (city/Lod.js): the walls, roofs, glass and signs from anywhere
// (from the air they're the town), the trim and the street's small things only near
export const DRAW = { detail: 300, street: 260, small: 160, far: Infinity };
const FAR_KEYS = new Set(['stucco', 'pbrick', 'brick', 'roofing', 'roofTile', 'glass', 'sign', 'signLit', 'pavement', 'roadpaint']);
const STREET = new Set(['car', 'palm', 'lamp', 'busstop', 'dumpster']);
const ROOM = new Set(['interior', 'booth', 'stool', 'jukebox', 'espresso', 'cooler', 'wallshelf', 'atm', 'magrack', 'oldregister']); // inside: seen through the glass
const KEEP_PARTS = new Set(['vending', 'busstop']); // (their glass shatters pane by pane)

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _o = new THREE.Vector3(), _w = new THREE.Vector3(), _v2 = new THREE.Vector3();
export const BLOCK = { z0: -24, z1: -199, cross: -210, kerbW: -0.4, kerbE: 12.4, frontW: -5.9, frontE: 17.9, pave: 0.14 };
export const BLOCK_PROPS = ['ac_units', 'ac_window', 'newsbox', 'meter', 'mailbox', 'payphone', 'vending', 'dish', 'neon_palm', 'neon_oil', 'fireescape',
  'elecboxes', 'cabinet', 'wheelie', 'parkbench', 'propane', 'powerpole', 'planter', 'barberpole', 'cart',
  'booth', 'stool', 'jukebox', 'espresso', 'napkins', 'ketchup', 'wallshelf', 'cooler', 'atm', 'magrack', 'oldregister']; // (the last line: inside the diner and the store)
const KIT = { lamp: /low_poly012_/, hydrant: /low_poly002_/, dumpster: /low_poly006_/, bin: /low_poly001_/ };

// a seeded random, so the block comes out the same every time
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// The buildings, north to south. West side: fronts at x -5.9 facing the street (east), each from `z`
// south for `w`; east side: fronts at x 17.9 facing west, each from `z` (its south end) north for `w`.
// In a building's own frame its front runs along x from its left (L) corner: west, the north end; east, the south.
const WEST = [
  { name: 'laundromat', z: -24, w: 20, d: 18, floors: 2, gh: 4.2, fh: 3.1, color: 0xead9bb, trim: 0xd8c8a8, frame: 0xf2efe6, belt: true, ac: 0.45, sides: { L: 'party' },
    shops: [{ x0: 0.4, x1: 13.6, room: 1, sign: { text: 'Suds & Duds', sub: 'Coin Laundry · Wash & Fold · Open 6 to 11', style: 'lightbox', bg: '#2a6fb0', fg: '#ffffff', accent: '#ffd23f', font: 'script', h: 0.95 }, neon: 'OPEN', door: 'right', frame: 0xc7ccd0 }],
    entries: [{ x: 16.2, w: 1.5, h: 2.8, arch: 0.75, color: 0x2f4a3a }] },
  { name: 'barber', z: -44, w: 12, d: 16, floors: 1, gh: 4.6, parapet: 1.0, gable: { width: 0.56, rise: 1.45 }, coping: 'tile', color: 0xe6b9a2, trim: 0xefe2d0,
    shops: [{ x0: 0.4, x1: 11.6, pent: true, sign: { text: 'Ortega’s', sub: 'Barber Shop · Est. 1962', style: 'board', bg: '#24443a', fg: '#f3e8cf', accent: '#d9b25c', font: 'script' }, kick: 'patio', frame: 0x2a3d34, door: 'left', neon: 'OPEN', neonAt: 9.4 }] },
  { name: 'bayview', z: -56, w: 24, d: 20, floors: 3, gh: 4.3, fh: 3.1, color: 0xecdcae, trim: 0xf3ecd8, frame: 0x2f4a3a, belt: true, cornice: true, ac: 0.35, balconies: [1, 2], balconyBays: [1, 5], bays: 7,
    shops: [
      { x0: 0.4, x1: 9.0, awning: 0, sign: { text: 'Lucky Dragon', sub: 'Chinese Food · To Go', style: 'lightbox', bg: '#b3221c', fg: '#ffd76a', accent: '#ffd76a', font: 'serif' }, neon: 'OPEN', frame: 0x3a2a1c },
      { x0: 15.0, x1: 23.6, shutter: 0.9, lit: 0.35, sign: { text: 'PACIFIC PAWN', sub: 'Loans · Gold · Guitars · Tools', style: 'board', bg: '#f2c12e', fg: '#1d1d1d', accent: '#a5281e', font: 'condensed' }, frame: 0x222222 },
    ],
    entries: [{ x: 12.0, w: 1.9, h: 3.1, arch: 0.95, color: 0x3a2a1c }] },
  { name: 'liquor', z: -80, w: 16, d: 18, floors: 2, gh: 4.2, fh: 3.2, wall: 'pbrick', color: 0xf1e9d6, trim: 0xe2d6bc, frame: 0x3b3027, cornice: true, ac: 0.4, sides: { R: 'party', Rghost: true },
    shops: [{ x0: 0.4, x1: 15.6, interior: 'market', ceil: 3.0, kick: 'paint', kickColor: 0x2d2a27, sign: { text: 'COAST LIQUOR', sub: 'Market · Cold Beer · Lotto · Ice', style: 'lightbox', bg: '#f4f1ea', fg: '#c0201b', accent: '#1f3d7a', font: 'condensed' }, neon: 'OPEN', door: 'left', frame: 0x222222 }] },
  { name: 'taqueria', z: -96, w: 16, d: 14, floors: 1, gh: 4.4, parapet: 0.95, coping: 'tile', color: 0xf0cf7c, trim: 0xb4532a, billboard: true,
    shops: [{ x0: 0.4, x1: 15.6, awning: 1, sign: { text: 'Mendoza’s', sub: 'Tacos · Burritos · Tortas · Aguas Frescas', style: 'board', bg: '#b4532a', fg: '#fff3d6', accent: '#2f6b45', font: 'script' }, neon: 'ABIERTO', kick: 'patio', frame: 0x4a3324, door: 'centre' }] },
  { name: 'bank', z: -112, w: 28, d: 22, floors: 2, gh: 5.2, fh: 3.6, parapet: 1.2, color: 0xd9d2c4, trim: 0xe6e0d4, frame: 0x4a3d2c, cornice: true, bays: 4, win: { w: 1.6, h: 2.2, sill: 0.8 },
    deco: { at: [0.3, 5.2, 8.6, 19.4, 22.8, 27.7], w: 0.6, up: 0.8 }, groundWindows: [2.8, 25.2], groundRoom: 2, bars: false,
    shops: [{ x0: 9.0, x1: 19.0, room: 2, kick: 'facadeTiles', frame: 0x5a4630, door: 'centre', h: 3.9, sign: { text: 'COAST CITY SAVINGS & LOAN', style: 'letters', bg: '#d9d2c4', fg: '#3b3228', font: 'deco', wear: 0.2, h: 0.62, inset: 0.15 } }] },
  { name: 'pharmacy', z: -140, w: 20, d: 18, floors: 2, gh: 4.3, fh: 3.1, color: 0xc4dbd0, trim: 0xeef0ea, frame: 0xf2f2ee, belt: true, ac: 0.3,
    shops: [{ x0: 0.4, x1: 19.6, room: 1, sign: { text: 'Sunset Pharmacy', sub: 'Prescriptions · Cosmetics · One-Hour Photo', style: 'lightbox', bg: '#127a74', fg: '#ffffff', accent: '#ffcf5a', font: 'sans' }, door: 'centre', frame: 0xc7ccd0 }] },
  { name: 'autoparts', z: -160, w: 16, d: 16, floors: 1, gh: 4.8, parapet: 1.0, color: 0xdad4ca, trim: 0x2a4f8a, oilSign: true,
    shops: [{ x0: 0.4, x1: 15.6, shutter: 0.0, sign: { text: 'GARCIA AUTO PARTS', sub: 'Batteries · Brakes · Wipers · Oil', style: 'board', bg: '#1f4f9a', fg: '#ffffff', accent: '#f2c12e', font: 'condensed' }, door: 'right', frame: 0x222222, kick: 'paint', kickColor: 0x1f4f9a }] },
  { name: 'diner', z: -176, w: 23, d: 16, floors: 1, gh: 4.6, parapet: 1.5, color: 0xf3f0e8, trim: 0xd6d9dc, bands: [4.1, 4.3, 4.5], bandColor: 0xd8dde2, coping: 'cap', sides: { R: 'front' },
    shops: [{ x0: 0.4, x1: 22.6, interior: 'diner', ceil: 3.5, kick: 'checker', frame: 0xc8ccd0, door: 'right', h: 3.3, neon: 'OPEN', sign: { text: 'Rosie’s', sub: 'Diner · Breakfast All Day', style: 'lightbox', bg: '#c4161c', fg: '#ffffff', accent: '#ffe08a', font: 'script', h: 1.0 } }],
    shopsR: [{ x0: 0.6, x1: 11.0, clear: true, kick: 'checker', frame: 0xc8ccd0, door: 'left', h: 3.3 }] },
];
const EAST = [
  { name: 'casalinda', z: -48, w: 24, d: 20, floors: 2, gh: 3.7, fh: 3.1, roof: 'hip', color: 0xf5f0e6, trim: 0x8a5a3a, frame: 0x4a3324, win: { w: 1.1, h: 1.5, arch: 0.35, sill: 0.85 },
    bays: 7, balconies: [1], balconyBays: [2, 4], ac: 0.15, groundWindows: [2.6, 6.2, 17.8, 21.4], bars: true, sides: { R: 'windows' },
    entries: [{ x: 12.0, w: 2.2, h: 3.05, arch: 1.1, color: 0x3a2a1c }], label: { text: 'CASA LINDA', sub: 'Apartments', style: 'letters', bg: '#f5f0e6', fg: '#6b4128', font: 'serif', wear: 0.2 } },
  { name: 'donuts', z: -60, w: 12, d: 14, floors: 1, gh: 4.3, parapet: 0.9, color: 0xf3c4d0, trim: 0x8a4a2a, neonPalm: true,
    shops: [{ x0: 0.4, x1: 11.6, awning: 3, room: 1, sign: { text: 'Sunny’s Donuts', sub: 'Fresh All Night · Coffee', style: 'lightbox', bg: '#fbe7ee', fg: '#8a3b1e', accent: '#e0457b', font: 'script' }, neon: 'OPEN 24', door: 'left', frame: 0xc7ccd0 }] },
  { name: 'records', z: -84, w: 24, d: 18, floors: 2, gh: 4.2, fh: 3.1, color: 0xb6cde0, trim: 0xf1f1ec, frame: 0xf1f1ec, belt: true, ac: 0.45, bays: 7,
    shops: [
      { x0: 0.4, x1: 11.6, awning: 2, sign: { text: 'RIALTO RECORDS', sub: 'New · Used · Vinyl · Tapes', style: 'board', bg: '#1b1b1b', fg: '#ff8a2a', accent: '#f2e6c8', font: 'slab' }, frame: 0x1b1b1b },
      { x0: 12.4, x1: 23.6, shutter: 0.55, lit: 0.6, sign: { text: 'CHECKS CASHED', sub: 'Money Orders · Bills Paid · Wire', style: 'lightbox', bg: '#f7d21e', fg: '#141414', accent: '#c0201b', font: 'condensed' }, neon: 'OPEN', frame: 0x222222 },
    ] },
  { name: 'flores', z: -100, w: 16, d: 16, floors: 2, gh: 4.2, fh: 3.2, wall: 'brick', color: 0xffffff, trim: 0xe0d6c2, frame: 0x2f4a3a, cornice: true, ac: 0.3,
    shops: [{ x0: 0.4, x1: 15.6, awning: 1, sign: { text: 'Flores Elena', sub: 'Flowers for Every Occasion', style: 'board', bg: '#2f5a3e', fg: '#fbf1d8', accent: '#e0a2b8', font: 'script' }, frame: 0x2f4a3a, kick: 'patio', planters: true }] },
  { name: 'marisol', z: -130, w: 30, d: 20, floors: 3, gh: 4.4, fh: 3.1, color: 0xe8c2a4, trim: 0xf4ece0, frame: 0xf4ece0, cornice: true, belt: true, ac: 0.4, bays: 9, blade: 'HOTEL MARISOL',
    shops: [
      { x0: 0.4, x1: 12.8, awning: 0, sign: { text: 'Café Marisol', sub: 'Espresso · Pan Dulce · Since 1971', style: 'board', bg: '#5a2a1e', fg: '#f6e7c8', accent: '#e8b04a', font: 'serif' }, frame: 0x3a2a1c, kick: 'checker' },
      { x0: 17.2, x1: 29.6, awning: 3, sign: { text: 'Panadería La Estrella', sub: 'Pan · Pasteles · Tamales', style: 'board', bg: '#f6e2b0', fg: '#8a2a1a', accent: '#2f5a3e', font: 'serif' }, frame: 0x3a2a1c, kick: 'patio' },
    ],
    entries: [{ x: 15.0, w: 2.2, h: 3.2, arch: 1.1, color: 0x2a1e16 }] },
  { name: 'hardware', z: -150, w: 20, d: 16, floors: 1, gh: 4.6, parapet: 1.0, gable: { width: 0.5, rise: 1.3 }, coping: 'tile', color: 0xead9bf, trim: 0xf2ead8,
    shops: [{ x0: 0.4, x1: 19.6, pent: true, sign: { text: 'PACIFIC HARDWARE', sub: 'Paint · Keys Cut · Garden', style: 'board', bg: '#a7321f', fg: '#fff6e0', accent: '#f2c12e', font: 'slab' }, kick: 'patio', frame: 0x2a2420, door: 'centre' }] },
  { name: 'clinica', z: -176, w: 26, d: 18, floors: 2, gh: 4.3, fh: 3.2, color: 0xe2e5e8, trim: 0x2f5f8a, frame: 0xe8ebee, belt: true, ac: 0.25, bays: 8,
    shops: [{ x0: 0.4, x1: 25.6, room: 2, sign: { text: 'Clínica Familiar del Mar', sub: 'Médico · Dental · Walk-ins Welcome', style: 'lightbox', bg: '#ffffff', fg: '#1f5a8a', accent: '#c0201b', font: 'sans' }, door: 'centre', frame: 0xc7ccd0 }] },
  { name: 'pho', z: -199, w: 23, d: 18, floors: 2, gh: 4.3, fh: 3.1, color: 0xf0e2b6, trim: 0xa8321f, frame: 0xf3eee0, cornice: true, ac: 0.4, sides: { L: 'windows' },
    shops: [{ x0: 0.4, x1: 13.0, awning: 0, sign: { text: 'Phở Saigon', sub: 'Noodle House · Bánh Mì', style: 'lightbox', bg: '#a8321f', fg: '#fff1c8', accent: '#ffd23f', font: 'sans' }, neon: 'OPEN', frame: 0x2a2420 },
      { x0: 13.8, x1: 22.6, shutter: 0.3, sign: { text: 'Coast Cellular', sub: 'Phones · Repairs · Prepaid', style: 'lightbox', bg: '#20262e', fg: '#41d1ff', accent: '#ffffff', font: 'sans' }, frame: 0x222222 }],
    shopsL: [{ x0: 2.0, x1: 9.6, room: 1, frame: 0x2a2420, door: 'left' }] },
];

export function buildHalsBlock(f, origin, lod = null, drawn = new Set()) {
  const scene = f.scene, physics = f.physics, smash = f.smash, B = BLOCK;
  const g = new THREE.Group();
  g.name = 'halsBlock';
  g.position.copy(origin);
  scene.add(g);
  const rnd = seeded(1958);
  const mats = cityMaterials();
  const signs = { painted: new SignAtlas(2048), lit: new SignAtlas(2048) };
  mats.sign = new THREE.MeshStandardMaterial({ map: signs.painted.texture, roughness: 0.72, alphaTest: 0.4 }); // (letters painted on a wall: only the letters)
  mats.signLit = new THREE.MeshStandardMaterial({ map: signs.lit.texture, emissiveMap: signs.lit.texture, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.4 });
  mats.roofTile = mats.tile;
  const ctx = { batch: new Batch(), mats, signs, rnd, props: true, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [], decals: {},
    doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [] };
  const built = [];
  // ------------------------------------------------------------------ the buildings
  for (const spec of WEST) built.push({ spec, b: building(ctx, { ...spec, at: V(B.frontW, 0, spec.z), yaw: Math.PI / 2 }), side: -1 });
  for (const spec of EAST) built.push({ spec, b: building(ctx, { ...spec, at: V(B.frontE, 0, spec.z), yaw: -Math.PI / 2 }), side: 1 });
  for (const { spec, b, side } of built) dress(ctx, spec, b, side, g);
  // the rooms you can walk into (Interiors.js), their lettering
  for (const r of ctx.inside) (r.kind === 'diner' ? diner : market)(ctx, r.M, r);
  for (const l of ctx.labels) label(ctx, l.M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, l.z)), l.u0, l.u1, l.y0, l.h, l.sign);
  for (const sp of ctx.spots) for (const k of ['at', 'approach', 'look']) sp[k]?.add(origin); // (the story's interactions are in the world)
  for (const p of ctx.posts) { p.at.add(origin); for (const b of p.beat ?? []) b.add(origin); } // (and where its people stand)
  // ------------------------------------------------------------------ the street
  street(ctx, g);
  alleys(ctx, g);
  const city = ctx.batch.build(mats);
  g.add(city);
  // the props the buildings and the street placed: into the block, and touchable
  for (const { o, kind } of ctx.objects) {
    g.add(o);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = kind !== 'decal'; m.receiveShadow = true; } });
    if (!KEEP_PARTS.has(kind)) flatten(o); // one mesh per material (a pole's 19 parts, a condenser's 12)
    const solid = SOLID[kind];
    if (solid) smash.add(o, solid);
  }
  for (const car of ctx.cars ?? []) smash.add(car, { kind: 'car', mass: 1300, shrink: 0.97 });
  // the shops' goods, their doors, the lights in the rooms (on when the camera's near: no recompiles)
  const goods = stockShelves(ctx, g);
  for (const d of ctx.doors) g.add(d.pivot);
  for (const r of ctx.roomLights) g.add(r.light);
  // colliders: each building's mass, its parapets, a hip roof as its hull
  for (const s of ctx.solids) {
    const d = new THREE.Object3D();
    d.position.copy(s.c).add(origin);
    d.quaternion.copy(s.q);
    scene.add(d);
    // exactly its size (Smash shrinks a loose prop's box 6% so neighbours don't start touching; a wall or a
    // floor shrunk so left gaps: a 16 m floor stopped half a metre short of the walls and he sank by them)
    smash.add(d, { kind: 'solid', box: new THREE.Box3(s.half.clone().negate(), s.half), shrink: 1, stuff: s.stuff, glass: false });
  }
  for (const p of ctx.parapets) physics.fixedBox(p.c.clone().add(origin), p.half, p.q);
  for (const p of ctx.pads) physics.fixedBox(p.c.clone().add(origin), p.half); // the pavements, 14 cm up: he walks on them, a car bumps up the kerb
  for (const h of ctx.hulls) {
    const pts = new Float32Array(h.pts.flatMap((p) => [p.x + origin.x, p.y + origin.y, p.z + origin.z]));
    const desc = RAPIER.ColliderDesc.convexHull(pts);
    if (desc) physics.fixedCollider(desc);
  }
  // ------------------------------------------------------------------ night
  const night = nightKit(ctx, g, mats);
  // ------------------------------------------------------------------ drawn by distance
  if (lod) {
    g.updateMatrixWorld(true);
    for (const m of city.children) {
      if (FAR_KEYS.has(m.name.replace('city_', ''))) continue;
      m.geometry.computeBoundingBox();
      lod.add(m, DRAW.detail, { box: m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld) });
    }
    for (const { o, kind } of ctx.objects) {
      const r = new THREE.Box3().setFromObject(o).getSize(V(0, 0, 0)).length() / 2;
      const dist = kind === 'wallshelf' || kind === 'cooler' ? 80 : ROOM.has(kind) ? 120 : kind === 'small' ? 40 : STREET.has(kind) ? DRAW.street : kind === 'decal' && r > 2 ? DRAW.detail : DRAW.small;
      lod.add(o, dist, { moves: true, shadow: STREET.has(kind) || r > 2 ? 160 : ROOM.has(kind) ? 40 : 80 });
      drawn.add(o);
    }
    for (const car of ctx.cars ?? []) { lod.addCar(car, DRAW.street, smash.items.find((i) => i.object === car)); drawn.add(car); }
    for (const m of goods) lod.add(m, 80, { box: new THREE.Box3().setFromObject(m) });
    for (const d of ctx.doors) lod.add(d.pivot, 160);
    lod.add(night.group, DRAW.detail, { box: new THREE.Box3().setFromObject(night.group) });
  }
  return {
    group: g, ctx, mats,
    setNight(k) {
      cityU.uNight.value = k;
      mats.signLit.emissiveIntensity = 0.08 + k * 0.5; // (brighter, a white lightbox clips to white and its letters go)
      mats.lamp.emissiveIntensity = k * 2.2;
      night.set(k);
    },
    // (`hal`: the player's position, set by the story when he's free to walk in: the doors open for him)
    hal: null, onDoor: null, openers: [], staff: [], // (`staff`: Rosie on her way, for the counter's gate)
    update(dt, t, camera) {
      cityU.uTime.value = t;
      const hal = this.hal && _h.copy(this.hal).sub(g.position); // (the doors are in the block's frame)
      for (const d of ctx.doors) {
        // open for Hal, or anyone else coming through (`this.openers`: the people's positions)
        let who = hal && !d.staff && Math.hypot(hal.x - d.at.x, hal.z - d.at.z) < (d.target ? 2.6 : 1.7) && Math.abs(hal.y - d.at.y) < 2.5 ? hal : null; // (`staff`: the counter's gate, not his)
        if (!who) for (const p of d.staff ? this.staff : this.openers) { _o.copy(p).sub(g.position); if (Math.hypot(_o.x - d.at.x, _o.z - d.at.z) < (d.target ? 1.8 : 1.3)) { who = _o; break; } }
        const near = !!who;
        if (near && !d.target) {
          if (!d.staff) this.onDoor?.(d); // (the gate has no bell)
          // it swings away from whoever's coming: in from the street, out from the room (toward him it
          // caught him between its leaf and the wall)
          if (d.open < 0.05) d.away = _w.copy(who).sub(d.at).dot(_v2.copy(d.inside).sub(d.at)) > 0 ? -1 : 1;
        }
        d.target = near ? 1 : 0;
        const k = d.open + (d.target - d.open) * Math.min(1, dt * (d.target ? 4.5 : 2.2));
        if (Math.abs(k - d.open) < 1e-4) continue;
        d.open = k;
        d.pivot.quaternion.copy(d.q0).multiply(_q.setFromAxisAngle(_Y, d.dir * (d.away ?? 1) * k * 1.45));
      }
      if (camera) for (const r of ctx.roomLights) r.light.intensity = r.light.position.distanceToSquared(_c.copy(camera.position).sub(g.position)) < 4900 ? r.power : 0;
    },
  };
}

// how the props are touched (props/Smash.js): window AC units and dishes can be knocked off the
// walls and roofs, planters and bins go flying, the condensers are heavy
const SOLID = {
  ac: { kind: 'breaks', mass: 45, strong: 7, glass: false },
  ac_units: { kind: 'breaks', mass: 120, strong: 14, glass: false },
  dish: { kind: 'breaks', mass: 12, strong: 4, glass: false },
  plant: { mass: 25, stuff: 'stone', glass: false },
  meter: { kind: 'breaks', mass: 30, strong: 8, glass: false },
  newsbox: { mass: 45, glass: false },
  mailbox: { kind: 'breaks', mass: 80, strong: 14, glass: false },
  vending: { mass: 280, glass: true },
  propane: { kind: 'breaks', mass: 160, strong: 16, glass: false },
  wheelie: { mass: 22, stuff: 'plastic', glass: false },
  dumpster: { mass: 420, glass: false },
  cart: { mass: 15, glass: false },
  cabinet: { kind: 'breaks', mass: 200, strong: 20, glass: false },
  bench: { mass: 60, stuff: 'wood', glass: false },
  busstop: { kind: 'breaks', mass: 380, strong: 30 },
  palm: { kind: 'solid', stuff: 'wood', shrink: 1, glass: false, box: new THREE.Box3(V(-0.28, 0, -0.28), V(0.28, 7, 0.28)) },
  lamp: { kind: 'breaks', mass: 45, strong: 14, shrink: 1, glass: false, box: new THREE.Box3(V(-0.14, 0, -0.14), V(0.14, 6.5, 0.14)) },
  hydrant: { kind: 'breaks', mass: 70, strong: 12, glass: false, onBreak: (item, at, dir, k, sm) => sm.geyser(item.object.getWorldPosition(V(0, 0, 0)).setY(0.45)) },
  // inside: the fixed furniture fixed, what can be knocked over loose
  booth: { kind: 'solid', stuff: 'wood', glass: false }, stool: { kind: 'solid', glass: false, shrink: 0.7 }, cooler: { kind: 'solid', glass: false },
  wallshelf: { kind: 'solid', glass: false }, atm: { kind: 'solid', glass: false },
  jukebox: { mass: 160, stuff: 'wood', glass: false }, espresso: { mass: 35, glass: false }, magrack: { mass: 15, glass: false }, oldregister: { mass: 18, glass: false },
};

// what goes with each building on the street and on its walls
function dress(ctx, spec, b, side, g) {
  const add = (o, kind) => { ctx.objects.push({ o, kind }); return o; };
  const at = (u, y, z) => b.front(u, y, z);
  const yawOut = side < 0 ? Math.PI / 2 : -Math.PI / 2; // a prop's +z out of the front, toward the street
  const put = (name, u, y, z, kind = name, yaw = yawOut) => { const o = prop(name); o.position.copy(at(u, y, z)); o.rotation.y = yaw; return add(o, kind); };
  const Mfront = b.M;
  if (spec.label) label(ctx, Mfront, spec.w / 2 - 3.2, spec.w / 2 + 3.2, spec.gh + 0.15, 0.7, spec.label);
  switch (spec.name) {
    case 'laundromat': {
      // the mural on the north wall, facing Hal's lot
      const FL = Mfront.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -spec.d)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
      decal(ctx, FL, { u0: 1.4, u1: spec.d - 1.0, v0: 0.55, v1: spec.gh + spec.fh + 0.95 - 0.3, texture: muralTexture(), key: 'mural' });
      break;
    }
    case 'barber': put('barberpole', 1.15, 1.7, 0.16, 'decal'); break;
    case 'liquor': {
      put('vending', 15.0, 0.14, 0.55, 'vending');
      put('propane', 8.6, 0.14, 0.6, 'propane'); // (3.9 m long: at 2.4 it stood across the door, at 0.5 to 1.5)
      put('payphone', 15.85, 1.15, 0.1, 'decal');
      put('newsbox', 13.6, 0.14, 0.5, 'newsbox', yawOut + 0.2);
      // a ghost sign high on its south wall, over the taqueria's roof
      const FR = Mfront.clone().multiply(new THREE.Matrix4().makeTranslation(spec.w, 0, -0.3)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      decal(ctx, FR, { u0: 3.0, u1: 13.0, v0: 5.6, v1: 7.9, texture: ghostTexture(['CRANDALL', 'HOTEL', 'ROOMS · BATHS · BY THE WEEK']), opacity: 0.78, key: 'ghost' });
      break;
    }
    case 'taqueria': {
      // the billboard on its roof, over the street (it stood in the lot before)
      const bb = prop('billboard');
      bb.position.copy(at(spec.w / 2, spec.gh, -spec.d / 2));
      bb.rotation.y = yawOut;
      bb.scale.setScalar(1.15);
      add(bb, 'decal');
      break;
    }
    case 'autoparts': put('neon_oil', 0.75, 3.75, 0.1, 'decal'); break;
    case 'donuts': put('neon_palm', 8.2, 1.15, -0.2, 'decal'); break;
    case 'flores': for (const u of [1.2, 2.2, 13.8, 14.8]) put('planter', u, 0.14, 0.45, 'plant', rnd01() * 6); break;
    case 'marisol': blade(ctx, Mfront, spec); break;
    case 'diner': label(ctx, Mfront, spec.w - 9.5, spec.w - 0.6, b.top + 0.12, 1.5, { text: 'ROSIE’S', sub: 'Diner · Open 24 Hours', style: 'lightbox', bg: '#c4161c', fg: '#fff6e6', accent: '#ffe08a', font: 'script', wear: 0.25 }); break;
    default: break;
  }
  // some walls carry their meters, conduit and a back-door lamp
  if (spec.d > 15) put('elecboxes', spec.w - 2.5, 0.1, -spec.d - 0.02, 'decal', yawOut + Math.PI);
  void g;
}
let _r = seeded(77);
const rnd01 = () => _r();

// the hotel's blade sign: a tall box out from the corner of the front, HOTEL down it in neon
function blade(ctx, M, spec) {
  const u = spec.w - 0.9, y0 = spec.gh + 0.6, h = 5.6, out = 1.3;
  const F = M.clone().multiply(new THREE.Matrix4().makeTranslation(u, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  ctx.batch.add('paint', box(0.06, y0, -0.18, out, y0 + h, 0.18), F, 0x7a1e1a);
  for (const sgn of [1, -1]) {
    const Fs = F.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, sgn * 0.18)).multiply(new THREE.Matrix4().makeRotationY(sgn > 0 ? 0 : Math.PI));
    const a0 = sgn > 0 ? 0.12 : -out + 0.06, a1 = sgn > 0 ? out - 0.06 : -0.12;
    label(ctx, Fs, a0, a1, y0 + 0.15, h - 0.3, { text: 'HOTEL', style: 'neon', vertical: true, bg: '#2a0f0c', fg: '#ff5a3c', font: 'condensed', wear: 0.1 }, 0.001);
  }
  ctx.batch.add('iron', box(0, y0 + 0.4, -0.04, 0.2, y0 + 0.48, 0.04), F, 0x222222);
  ctx.batch.add('iron', box(0, y0 + h - 0.5, -0.04, 0.2, y0 + h - 0.42, 0.04), F, 0x222222);
}

// ---------------------------------------------------------------------------------- the street
function street(ctx, g) {
  const B = BLOCK, { batch, objects } = ctx;
  const add = (o, kind) => { objects.push({ o, kind }); return o; };
  const I = new THREE.Matrix4();
  // pavements: slabs to the fronts, their joints the texture's; the kerb's face below their edge
  const pave = (x0, x1, z0, z1) => {
    batch.add('pavement', box(x0, 0, z1, x1, B.pave, z0), I, 0xffffff);
    ctx.pads.push({ c: V((x0 + x1) / 2, B.pave / 2, (z0 + z1) / 2), half: V(Math.abs(x1 - x0) / 2, B.pave / 2, Math.abs(z0 - z1) / 2) });
  };
  ctx.mats.pavement ??= pbrMaterial('concrete_pavement', { repeat: [1 / 3, 1 / 3], tint: new THREE.Color(1.08, 1.05, 1.0) });
  pave(B.frontW, B.kerbW, B.z0, -204);
  pave(B.kerbE, B.frontE, B.z0, -204);
  pave(-46, B.frontW, -199, -204); // along the cross street, round the corners
  pave(B.frontE, 60, -199, -204);
  // the kerbs: a concrete edge, painted red where you mustn't stop, a gutter in front of them
  const red = [], kerbs = [];
  const hyd = { W: [-66, -128, -170], E: [-72, -138, -186] };
  const bus = [-110, -130]; // the east side's stop
  for (const [side, x] of [['W', B.kerbW], ['E', B.kerbE]]) {
    const s = side === 'W' ? 1 : -1; // toward the road
    const spans = [[B.z0, -190, false], [-190, -204, true]];
    for (const z of hyd[side]) spans.push([z + 3.5, z - 3.5, true]);
    if (side === 'E') spans.push([bus[0], bus[1], true]);
    // the kerb itself, then the red over it
    batch.add('concrete', box(x - s * 0.18, 0, -204, x + s * 0.01, B.pave + 0.005, B.z0), I, 0xc9c3b8);
    for (const [z0, z1, isRed] of spans) if (isRed) batch.add('roadpaint', box(x - s * 0.185, 0.02, z1, x + s * 0.014, B.pave + 0.009, z0), I, 0xb8322a);
    batch.add('concrete', box(x + s * 0.01, 0.0, -204, x + s * 0.46, 0.012, B.z0), I, 0x77736d); // the gutter (a shade lighter than the asphalt, not white)
    red.push(...spans.filter((sp) => sp[2]));
    kerbs.push({ side, x, s, spans });
  }
  // the road's paint: the double yellow down the middle, the parking lanes' lines and their T's,
  // the stop bar and crosswalks at the crossing
  const line = (x0, z0, x1, z1, col = 0xd4d0c6, y = 0.018) => batch.add('roadpaint', box(x0, 0, z1, x1, y, z0), I, col);
  line(5.88, B.z0 - 6, 5.98, -199.5, 0xd2a63a); line(6.02, B.z0 - 6, 6.12, -199.5, 0xd2a63a);
  line(1.95, B.z0 - 6, 2.05, -199.5); line(9.95, B.z0 - 6, 10.05, -199.5);
  line(6.2, -199.0, 10.0, -199.5); // the stop bar, southbound
  for (let x = -0.2; x < 12.3; x += 0.95) line(x, -200.4, x + 0.5, -203.4); // the crosswalk over the boulevard
  for (let z = -204.4; z > -215.8; z -= 0.95) { line(-3.9, z, -0.9, z - 0.5); line(12.9, z, 15.9, z - 0.5); } // over the cross street
  // parking: spaces 6.4 m long, a T at each end; cars in about two in three; a meter at each
  const cars = ['fairheaven', 'negotiator', 'sialia', 'fairheaven_sw'], paints = [0x2b4a6b, 0x8e8a7c, 0x6b1f1c, 0xc9c3b4, 0x3c4a3c, 0x1d1f24, 0xb5a27a, 0x5a6670, 0xe2ddd0, 0x7a5a2a];
  const free = (side, z) => !red.some(([a, b]) => z < a + 2.6 && z > b - 2.6) && z < B.z0 - 8 && !(side === 'E' && z < -162 && z > -180);
  let ci = 0;
  for (const { side, x, s } of kerbs) {
    const lane = x + s * 1.2;
    for (let z = B.z0 - 10; z > -192; z -= 6.4) {
      if (!free(side, z)) continue;
      line(Math.min(x + s * 1.7, x + s * 2.4), z + 3.25, Math.max(x + s * 1.7, x + s * 2.4), z + 3.15); // the T at the space's end
      const meter = prop('meter');
      meter.position.set(x - s * 0.45, B.pave, z + 2.6);
      meter.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      add(meter, 'meter');
      if (ctx.rnd() < 0.68) {
        const car = makeCar(cars[ci % cars.length], { paint: paints[(ci * 7) % paints.length], dust: 0.2 + ctx.rnd() * 0.4 });
        car.position.set(lane + (ctx.rnd() - 0.5) * 0.15, 0, z + (ctx.rnd() - 0.5) * 0.5);
        car.rotation.y = (side === 'W' ? 0 : Math.PI) + (ctx.rnd() - 0.5) * 0.03;
        g.add(car);
        ctx.cars ??= [];
        ctx.cars.push(car);
        ci++;
      }
    }
  }
  // drains in the kerb, manholes in the road
  for (const { x, s } of kerbs) for (const z of [-52, -146]) {
    batch.add('dark', box(x - s * 0.02, 0.03, z - 0.7, x + s * 0.016, 0.11, z + 0.7), I, 0x0d0d0c); // the drain's mouth in the kerb
    batch.add('iron', box(x + s * 0.05, 0.0, z - 0.45, x + s * 0.42, 0.016, z + 0.45), I, 0x3a3734);
  }
  for (const z of [-40, -118, -184]) batch.add('iron', new THREE.CylinderGeometry(0.34, 0.34, 0.018, 20).translate(4.0, 0.006, z), I, 0x3d3a36);
  // palms and lamps along the kerbs, hydrants at their red kerbs
  const glowM = ctx.mats.lamp;
  for (const { side, x, s } of kerbs) {
    for (let z = B.z0 - 16, n = 0; z > -196; z -= 15, n++) {
      if (n % 2 === 0) {
        const p = piece('palms', n % 4 === 0 ? /^Palm_tree_001/ : /^Palm_tree_002/, { root: true });
        p.position.set(x - s * 1.1, B.pave, z);
        p.rotation.y = ctx.rnd() * 6;
        p.scale.setScalar(0.62 + ctx.rnd() * 0.12);
        add(p, 'palm');
        batch.add('iron', box(x - s * 1.1 - 0.62, B.pave, z - 0.62, x - s * 1.1 + 0.62, B.pave + 0.012, z + 0.62), I, 0x2a2622); // the tree grate
      } else {
        // the kit's lamp is 3.9 m with its arm along +z: scaled to a street light, its arm out over the road
        const l = piece('cityprops', KIT.lamp, { root: true });
        l.position.set(x - s * 0.5, B.pave, z);
        l.rotation.y = s * Math.PI / 2;
        l.scale.setScalar(1.8);
        add(l, 'lamp');
        ctx.lamps.push({ at: V(x - s * 0.5 + s * 0.95 * 1.8, B.pave + 3.45 * 1.8, z), k: 1, street: true, glow: glowM });
      }
    }
    for (const z of hyd[side]) {
      const h = piece('cityprops', KIT.hydrant, { root: true });
      h.position.set(x - s * 0.35, B.pave, z);
      add(h, 'hydrant');
    }
  }
  // the corner: newspaper boxes, the mailbox, a cabinet; the bus stop and its bench
  for (const [i, dz] of [[0, 0], [1, 0.85], [2, 1.7]]) { const n = prop('newsbox'); n.position.set(-1.4, B.pave, -194 + dz); n.rotation.y = Math.PI / 2 + (ctx.rnd() - 0.5) * 0.3; add(n, 'newsbox'); void i; }
  const mb = prop('mailbox'); mb.position.set(-1.3, B.pave, -190.2); mb.rotation.y = Math.PI / 2; add(mb, 'mailbox');
  const cab = prop('cabinet'); cab.position.set(B.frontE - 0.4, B.pave, -60.6); cab.rotation.y = -Math.PI / 2; add(cab, 'cabinet');
  const stop = prop('busstop'); stop.position.set(B.kerbE + 1.4, B.pave, -120); stop.rotation.y = 0; add(stop, 'busstop'); // (along the kerb: the pavement's walked past it)
  const bench = piece('parkbench', /Object_2/); bench.position.set(B.kerbE + 2.2, B.pave, -126.5); bench.rotation.y = -Math.PI / 2; add(bench, 'bench');
  const can = piece('parkbench', /Object_3/); can.position.set(B.kerbE + 1.0, B.pave, -128.4); add(can, 'bench');
}

// the alleys behind both sides: their walls, bins and a dumpster, a power line overhead, a fire escape
function alleys(ctx, g) {
  const { batch, objects } = ctx, I = new THREE.Matrix4();
  const add = (o, kind) => { objects.push({ o, kind }); return o; };
  for (const [x, s] of [[-34, -1], [46, 1]]) {
    // the back wall of the next block's lots, block concrete, a coping on it
    batch.add('concrete', box(x - 0.12, 0, -199, x + 0.12, 2.1, -26), I, 0xb7b0a4);
    batch.add('concrete', box(x - 0.16, 2.1, -199, x + 0.16, 2.2, -26), I, 0xc9c2b6);
    ctx.solids.push({ c: V(x, 1.1, -112.5), half: V(0.14, 1.1, 86.5), q: new THREE.Quaternion(), stuff: 'stone' });
    // power line: a pole every 23.8 m along the alley, the wires sagging between
    for (let zc = -36, k = 0; zc - 11.9 > -199; zc -= 23.82, k++) {
      const p = prop('powerpole');
      p.position.set(x + s * 0.9, 0, zc);
      p.rotation.y = Math.PI / 2;
      // its north pole is the last span's south one
      if (k > 0) p.traverse((m) => { if (m.isMesh && /^(Cylinder001|Cube00[345]|Sphere00[4-7])_/.test(m.name)) m.visible = false; });
      add(p, 'decal');
      for (const pz of k > 0 ? [zc - 11.91] : [zc + 11.91, zc - 11.91]) ctx.solids.push({ c: V(x + s * 0.9, 4.75, pz), half: V(0.14, 4.75, 0.14), q: new THREE.Quaternion(), stuff: 'wood' });
    }
    // bins and a dumpster behind the shops, a shopping cart left by the wall
    for (const z of [-40, -88, -122, -150, -184]) {
      const w = piece('wheelie', [/Green/, /Blue/, /Black/, /Grey/][Math.floor(ctx.rnd() * 4)]);
      w.position.set(x - s * 1.0, 0, z);
      w.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      add(w, 'wheelie');
      const w2 = piece('wheelie', /Blue/);
      w2.position.set(x - s * 1.0, 0, z - 0.75);
      w2.rotation.y = w.rotation.y + 0.15;
      add(w2, 'wheelie');
    }
    for (const z of [-66, -160]) { const d = piece('cityprops', KIT.dumpster, { root: true }); d.position.set(x - s * 1.6, 0, z); d.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; add(d, 'dumpster'); }
  }
  const cart = prop('cart'); cart.position.set(-31.8, 0, -104); cart.rotation.y = 2.4; add(cart, 'cart');
  // the fire escape down the back of the Bayview
  const fe = prop('fireescape'); fe.position.set(BLOCK.frontW - 20, 0, -68); fe.rotation.y = -Math.PI / 2; add(fe, 'decal');
}

// ---------------------------------------------------------------------------------- night
// The lamps' pools of light on the pavements, a few real lights, the light from the shop windows
// across the pavement, the window neon; all faded in with `set(k)`
function nightKit(ctx, block, mats) {
  // (two groups: the outer one drawn by distance, the inner one only at night: by day the pools and
  // halos are at nothing, and still cost a draw call each)
  const group = new THREE.Group(), g = new THREE.Group();
  group.add(g);
  block.add(group);
  g.visible = false;
  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)');
  const pool = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.62, 0.46, 0.28), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const spill = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.5, 0.45, 0.36), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const halo = new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.6, 1.15, 0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const lights = [];
  let n = 0;
  for (const l of ctx.lamps) {
    if (!l.street) continue;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), pool);
    p.position.set(l.at.x, BLOCK.pave + 0.01, l.at.z);
    g.add(p);
    const sp = new THREE.Sprite(halo);
    sp.position.copy(l.at);
    sp.scale.setScalar(0.9);
    g.add(sp);
    if (n++ % 3 === 0) { const pl = new THREE.PointLight(0xffc98a, 0, 20, 2); pl.position.copy(l.at).add(V(0, -0.6, 0)); g.add(pl); lights.push(pl); }
  }
  for (const s of ctx.shops) {
    const w = s.u1 - s.u0, p = new THREE.Mesh(new THREE.PlaneGeometry(w + 1, 4.5).rotateX(-Math.PI / 2), spill);
    const c = V((s.u0 + s.u1) / 2, 0, 2.2).applyMatrix4(s.F);
    p.position.set(c.x, BLOCK.pave + 0.012, c.z);
    const N = V(0, 0, 1).transformDirection(s.F);
    p.rotation.y = Math.atan2(N.x, N.z);
    g.add(p);
  }
  const neonMats = [];
  for (const nn of ctx.neon) {
    const m = new THREE.MeshBasicMaterial({ map: neonTexture(nn.text, nn.color ?? '#ff3b3b', '#3bb8ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.5, 0.5, 0.5) });
    neonMats.push(m);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), m);
    p.position.copy(nn.at);
    p.rotation.setFromRotationMatrix(nn.F);
    g.add(p);
  }
  // the neon props: their tubes glow
  const tubes = [];
  for (const { o, kind } of ctx.objects) if (kind === 'decal') o.traverse((m) => {
    if (!m.isMesh || !/neon|Sonata|wire/i.test(`${m.material?.name}`)) return;
    m.material = m.material.clone();
    m.material.emissive = (m.material.color ?? new THREE.Color(1, 1, 1)).clone();
    tubes.push(m.material);
  });
  return {
    group,
    set(k) {
      g.visible = k > 0.01;
      pool.opacity = k; spill.opacity = k * 0.8; halo.opacity = k;
      for (const l of lights) l.intensity = k * 26;
      for (const m of neonMats) m.color.setScalar(0.35 + k * 0.9);
      for (const m of tubes) m.emissiveIntensity = 0.4 + k * 1.6;
    },
  };
}
