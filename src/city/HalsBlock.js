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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prop, piece } from '../props/Props.js';
import { makeCar } from '../props/Car.js';
import { RAPIER } from '../engine/Physics.js';
import { pbrMaterial, glowTexture } from '../fx/Textures.js';
import { Batch, cityMaterials, cityU } from './Kit.js';
import { building, box, decal, label } from './Building.js';
import { flatten, InstanceSet, BatchSet } from './Lod.js';
import { runSteps } from '../engine/Slice.js';
import { diner, market, shopRoom, stockShelves, kit } from './Interiors.js';
import { SignPages, neonTexture, muralTexture, ghostTexture } from './Signs.js';
import { PALM_KINDS } from './Palms.js';

// How far the block's things are drawn (city/Lod.js): the walls, roofs, glass and signs from anywhere
// (from the air they're the town), the trim and the street's small things only near
export const DRAW = { detail: 220, street: 200, small: 55, far: Infinity }; // (small: 90 drew every meter and bin down the street) // (from the street the block's 380 m long: at 160 m a parking meter is a few pixels)
const FAR_KEYS = new Set(['stucco', 'pbrick', 'brick', 'roofing', 'roofTile', 'glass', 'sign', 'signLit', 'pavement', 'roadpaint']);
const STREET = new Set(['car', 'palm', 'lamp', 'busstop', 'dumpster']);
const ROOM = new Set(['interior', 'booth', 'stool', 'jukebox', 'espresso', 'cooler', 'wallshelf', 'atm', 'magrack', 'oldregister']); // inside: seen through the glass
const KEEP_PARTS = new Set(['vending', 'busstop']); // (their glass shatters pane by pane)
const STILL = new Set(['palm', 'decal', 'booth', 'stool', 'cooler', 'wallshelf', 'atm']); // (fixed for good: drawn instanced)
// (the rest of what's touchable, drawn instanced too until something moves it: then shown as itself, its copy
// taken out; not what keeps its parts for its glass, nor the cars)
const UNTIL_MOVED = (kind) => !STILL.has(kind) && !KEEP_PARTS.has(kind) && kind !== 'car';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BAR = new THREE.Color(0xb8bcc0), _dm = new THREE.Matrix4(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _o = new THREE.Vector3(), _w = new THREE.Vector3(), _v2 = new THREE.Vector3(), _in = new THREE.Vector3();
export const BLOCK = { z0: -24, z1: -199, cross: -210, kerbW: -0.4, kerbE: 12.4, frontW: -5.9, frontE: 17.9, pave: 0.14 };
export const BLOCK_PROPS = ['ac_units', 'ac_window', 'newsbox', 'meter', 'mailbox', 'payphone', 'vending', 'dish', 'neon_palm', 'neon_oil', 'fireescape',
  'elecboxes', 'cabinet', 'wheelie', 'parkbench', 'propane', 'powerpole', 'planter', 'barberpole', 'cart',
  'booth', 'stool', 'jukebox', 'espresso', 'napkins', 'ketchup', 'wallshelf', 'cooler', 'atm', 'magrack', 'oldregister', // (inside the diner and the store)
  'policecar', 'ambulance']; // (the precinct's cruisers and the emergency room's ambulance at their kerbs)
const KIT = { lamp: /low_poly012_/, hydrant: /low_poly002_/, dumpster: /low_poly006_/, bin: /low_poly001_/ };

// a seeded random, so the block comes out the same every time
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// The buildings, north to south. West side: fronts at x -5.9 facing the street (east), each from `z`
// south for `w`; east side: fronts at x 17.9 facing west, each from `z` (its south end) north for `w`.
// In a building's own frame its front runs along x from its left (L) corner: west, the north end; east, the south.
const WEST = [
  { name: 'laundromat', z: -24, w: 20, d: 18, floors: 2, gh: 4.2, fh: 3.1, color: 0xead9bb, trim: 0xd8c8a8, frame: 0xf2efe6, belt: true, ac: 0.45, sides: { L: 'party' },
    shops: [{ x0: 0.4, x1: 13.6, room: 1, interior: 'laundromat', sign: { text: 'Suds & Duds', sub: 'Coin Laundry · Wash & Fold · Open 6 to 11', style: 'lightbox', bg: '#2a6fb0', fg: '#ffffff', accent: '#ffd23f', font: 'script', h: 0.95 }, neon: 'OPEN', door: 'right', frame: 0xc7ccd0 }],
    entries: [{ x: 16.2, w: 1.5, h: 2.8, arch: 0.75, color: 0x2f4a3a }] },
  { name: 'barber', z: -44, w: 12, d: 16, floors: 1, gh: 4.6, parapet: 1.0, gable: { width: 0.56, rise: 1.45 }, coping: 'tile', color: 0xe6b9a2, trim: 0xefe2d0,
    shops: [{ x0: 0.4, x1: 11.6, pent: true, interior: 'barber', sign: { text: 'Ortega’s', sub: 'Barber Shop · Est. 1962', style: 'board', bg: '#24443a', fg: '#f3e8cf', accent: '#d9b25c', font: 'script' }, kick: 'patio', frame: 0x2a3d34, door: 'left', neon: 'OPEN', neonAt: 9.4 }] },
  { name: 'bayview', z: -56, w: 24, d: 20, floors: 3, gh: 4.3, fh: 3.1, color: 0xecdcae, trim: 0xf3ecd8, frame: 0x2f4a3a, belt: true, cornice: true, ac: 0.35, balconies: [1, 2], balconyBays: [1, 5], bays: 7,
    shops: [
      { x0: 0.4, x1: 9.0, awning: 0, interior: 'takeout', sign: { text: 'Lucky Dragon', sub: 'Chinese Food · To Go', style: 'lightbox', bg: '#b3221c', fg: '#ffd76a', accent: '#ffd76a', font: 'serif' }, neon: 'OPEN', frame: 0x3a2a1c },
      { x0: 15.0, x1: 23.6, shutter: 0.9, lit: 0.35, interior: 'pawn', sign: { text: 'PACIFIC PAWN', sub: 'Loans · Gold · Guitars · Tools', style: 'board', bg: '#f2c12e', fg: '#1d1d1d', accent: '#a5281e', font: 'condensed' }, frame: 0x222222 },
    ],
    entries: [{ x: 12.0, w: 1.9, h: 3.1, arch: 0.95, color: 0x3a2a1c }] },
  { name: 'liquor', z: -80, w: 16, d: 18, floors: 2, gh: 4.2, fh: 3.2, wall: 'pbrick', color: 0xf1e9d6, trim: 0xe2d6bc, frame: 0x3b3027, cornice: true, ac: 0.4, sides: { R: 'party', Rghost: true },
    shops: [{ x0: 0.4, x1: 15.6, interior: 'market', ceil: 3.0, kick: 'paint', kickColor: 0x2d2a27, sign: { text: 'COAST LIQUOR', sub: 'Market · Cold Beer · Lotto · Ice', style: 'lightbox', bg: '#f4f1ea', fg: '#c0201b', accent: '#1f3d7a', font: 'condensed' }, neon: 'OPEN', door: 'left', frame: 0x222222 }] },
  { name: 'taqueria', z: -96, w: 16, d: 14, floors: 1, gh: 4.4, parapet: 0.95, coping: 'tile', color: 0xf0cf7c, trim: 0xb4532a, billboard: true,
    shops: [{ x0: 0.4, x1: 15.6, awning: 1, interior: 'taqueria', sign: { text: 'Mendoza’s', sub: 'Tacos · Burritos · Tortas · Aguas Frescas', style: 'board', bg: '#b4532a', fg: '#fff3d6', accent: '#2f6b45', font: 'script' }, neon: 'ABIERTO', kick: 'patio', frame: 0x4a3324, door: 'centre' }] },
  { name: 'bank', z: -112, w: 28, d: 22, floors: 2, gh: 5.2, fh: 3.6, parapet: 1.2, color: 0xd9d2c4, trim: 0xe6e0d4, frame: 0x4a3d2c, cornice: true, bays: 4, win: { w: 1.6, h: 2.2, sill: 0.8 },
    deco: { at: [0.3, 5.2, 8.6, 19.4, 22.8, 27.7], w: 0.6, up: 0.8 }, groundWindows: [2.8, 25.2], groundRoom: 2, bars: false,
    shops: [{ x0: 9.0, x1: 19.0, room: 2, kick: 'facadeTiles', frame: 0x5a4630, door: 'centre', h: 3.9, interior: 'bank', sign: { text: 'COAST CITY SAVINGS & LOAN', style: 'letters', bg: '#d9d2c4', fg: '#3b3228', font: 'deco', wear: 0.2, h: 0.62, inset: 0.15 } }] },
  { name: 'pharmacy', z: -140, w: 20, d: 18, floors: 2, gh: 4.3, fh: 3.1, color: 0xc4dbd0, trim: 0xeef0ea, frame: 0xf2f2ee, belt: true, ac: 0.3,
    shops: [{ x0: 0.4, x1: 19.6, room: 1, interior: 'pharmacy', sign: { text: 'Sunset Pharmacy', sub: 'Prescriptions · Cosmetics · One-Hour Photo', style: 'lightbox', bg: '#127a74', fg: '#ffffff', accent: '#ffcf5a', font: 'sans' }, door: 'centre', frame: 0xc7ccd0 }] },
  { name: 'autoparts', z: -160, w: 16, d: 16, floors: 1, gh: 4.8, parapet: 1.0, color: 0xdad4ca, trim: 0x2a4f8a, oilSign: true,
    shops: [{ x0: 0.4, x1: 15.6, shutter: 0.0, interior: 'autoparts', sign: { text: 'GARCIA AUTO PARTS', sub: 'Batteries · Brakes · Wipers · Oil', style: 'board', bg: '#1f4f9a', fg: '#ffffff', accent: '#f2c12e', font: 'condensed' }, door: 'right', frame: 0x222222, kick: 'paint', kickColor: 0x1f4f9a }] },
  { name: 'diner', z: -176, w: 23, d: 16, floors: 1, gh: 4.6, parapet: 1.5, color: 0xf3f0e8, trim: 0xd6d9dc, bands: [4.1, 4.3, 4.5], bandColor: 0xd8dde2, coping: 'cap', sides: { R: 'front' },
    shops: [{ x0: 0.4, x1: 22.6, interior: 'diner', ceil: 3.5, kick: 'checker', frame: 0xc8ccd0, door: 'right', h: 3.3, neon: 'OPEN', sign: { text: 'Rosie’s', sub: 'Diner · Breakfast All Day', style: 'lightbox', bg: '#c4161c', fg: '#ffffff', accent: '#ffe08a', font: 'script', h: 1.0 } }],
    shopsR: [{ x0: 0.6, x1: 11.0, clear: true, kick: 'checker', frame: 0xc8ccd0, door: 'left', h: 3.3 }] },
];
const EAST = [
  { name: 'casalinda', z: -48, w: 24, d: 20, floors: 2, gh: 3.7, fh: 3.1, roof: 'hip', color: 0xf5f0e6, trim: 0x8a5a3a, frame: 0x4a3324, win: { w: 1.1, h: 1.5, arch: 0.35, sill: 0.85 },
    bays: 7, balconies: [1], balconyBays: [2, 4], ac: 0.15, groundWindows: [2.6, 6.2, 17.8, 21.4], bars: true, sides: { R: 'windows' },
    entries: [{ x: 12.0, w: 2.2, h: 3.05, arch: 1.1, color: 0x3a2a1c }], label: { text: 'CASA LINDA', sub: 'Apartments', style: 'letters', bg: '#f5f0e6', fg: '#6b4128', font: 'serif', wear: 0.2 } },
  { name: 'donuts', z: -60, w: 12, d: 14, floors: 1, gh: 4.3, parapet: 0.9, color: 0xf3c4d0, trim: 0x8a4a2a, neonPalm: true,
    shops: [{ x0: 0.4, x1: 11.6, awning: 3, room: 1, interior: 'donuts', sign: { text: 'Sunny’s Donuts', sub: 'Fresh All Night · Coffee', style: 'lightbox', bg: '#fbe7ee', fg: '#8a3b1e', accent: '#e0457b', font: 'script' }, neon: 'OPEN 24', door: 'left', frame: 0xc7ccd0 }] },
  { name: 'records', z: -84, w: 24, d: 18, floors: 2, gh: 4.2, fh: 3.1, color: 0xb6cde0, trim: 0xf1f1ec, frame: 0xf1f1ec, belt: true, ac: 0.45, bays: 7,
    shops: [
      { x0: 0.4, x1: 11.6, awning: 2, interior: 'records', sign: { text: 'RIALTO RECORDS', sub: 'New · Used · Vinyl · Tapes', style: 'board', bg: '#1b1b1b', fg: '#ff8a2a', accent: '#f2e6c8', font: 'slab' }, frame: 0x1b1b1b },
      { x0: 12.4, x1: 23.6, shutter: 0.55, lit: 0.6, interior: 'checks', sign: { text: 'CHECKS CASHED', sub: 'Money Orders · Bills Paid · Wire', style: 'lightbox', bg: '#f7d21e', fg: '#141414', accent: '#c0201b', font: 'condensed' }, neon: 'OPEN', frame: 0x222222 },
    ] },
  { name: 'flores', z: -100, w: 16, d: 16, floors: 2, gh: 4.2, fh: 3.2, wall: 'brick', color: 0xffffff, trim: 0xe0d6c2, frame: 0x2f4a3a, cornice: true, ac: 0.3,
    shops: [{ x0: 0.4, x1: 15.6, awning: 1, interior: 'florist', sign: { text: 'Flores Elena', sub: 'Flowers for Every Occasion', style: 'board', bg: '#2f5a3e', fg: '#fbf1d8', accent: '#e0a2b8', font: 'script' }, frame: 0x2f4a3a, kick: 'patio', planters: true }] },
  { name: 'marisol', z: -130, w: 30, d: 20, floors: 3, gh: 4.4, fh: 3.1, color: 0xe8c2a4, trim: 0xf4ece0, frame: 0xf4ece0, cornice: true, belt: true, ac: 0.4, bays: 9, blade: 'HOTEL MARISOL',
    shops: [
      { x0: 0.4, x1: 12.8, awning: 0, interior: 'cafe', sign: { text: 'Café Marisol', sub: 'Espresso · Pan Dulce · Since 1971', style: 'board', bg: '#5a2a1e', fg: '#f6e7c8', accent: '#e8b04a', font: 'serif' }, frame: 0x3a2a1c, kick: 'checker' },
      { x0: 17.2, x1: 29.6, awning: 3, interior: 'bakery', sign: { text: 'Panadería La Estrella', sub: 'Pan · Pasteles · Tamales', style: 'board', bg: '#f6e2b0', fg: '#8a2a1a', accent: '#2f5a3e', font: 'serif' }, frame: 0x3a2a1c, kick: 'patio' },
    ],
    entries: [{ x: 15.0, w: 2.2, h: 3.2, arch: 1.1, color: 0x2a1e16 }] },
  { name: 'hardware', z: -150, w: 20, d: 16, floors: 1, gh: 4.6, parapet: 1.0, gable: { width: 0.5, rise: 1.3 }, coping: 'tile', color: 0xead9bf, trim: 0xf2ead8,
    shops: [{ x0: 0.4, x1: 19.6, pent: true, interior: 'hardware', sign: { text: 'PACIFIC HARDWARE', sub: 'Paint · Keys Cut · Garden', style: 'board', bg: '#a7321f', fg: '#fff6e0', accent: '#f2c12e', font: 'slab' }, kick: 'patio', frame: 0x2a2420, door: 'centre' }] },
  { name: 'clinica', z: -176, w: 26, d: 18, floors: 2, gh: 4.3, fh: 3.2, color: 0xe2e5e8, trim: 0x2f5f8a, frame: 0xe8ebee, belt: true, ac: 0.25, bays: 8,
    shops: [{ x0: 0.4, x1: 25.6, room: 2, interior: 'clinic', sign: { text: 'Clínica Familiar del Mar', sub: 'Médico · Dental · Walk-ins Welcome', style: 'lightbox', bg: '#ffffff', fg: '#1f5a8a', accent: '#c0201b', font: 'sans' }, door: 'centre', frame: 0xc7ccd0 }] },
  { name: 'pho', z: -199, w: 23, d: 18, floors: 2, gh: 4.3, fh: 3.1, color: 0xf0e2b6, trim: 0xa8321f, frame: 0xf3eee0, cornice: true, ac: 0.4, sides: { L: 'windows' },
    shops: [{ x0: 0.4, x1: 13.0, awning: 0, interior: 'pho', sign: { text: 'Phở Saigon', sub: 'Noodle House · Bánh Mì', style: 'lightbox', bg: '#a8321f', fg: '#fff1c8', accent: '#ffd23f', font: 'sans' }, neon: 'OPEN', frame: 0x2a2420 },
      { x0: 13.8, x1: 22.6, shutter: 0.3, interior: 'cellular', sign: { text: 'Coast Cellular', sub: 'Phones · Repairs · Prepaid', style: 'lightbox', bg: '#20262e', fg: '#41d1ff', accent: '#ffffff', font: 'sans' }, frame: 0x222222 }],
    shopsL: [{ x0: 2.0, x1: 9.6, room: 1, frame: 0x2a2420, door: 'left' }] },
];

// The next block south, over the crossing (2026-11-19: the open world's interiors, "the police
// station, a hospital and a bar"): the same street, the Blue Marlin on the corner, the 14th Precinct,
// St. Mary's across from it with its emergency room, the Palms picture house, and the shops between.
// West side from the cross street (z -221) south; east side the same way, each `z` its south end.
const WEST2 = [
  { name: 'marlin', z: -221, w: 18, d: 20, floors: 2, gh: 4.4, fh: 3.1, wall: 'brick', color: 0xffffff, trim: 0x2b2b2b, frame: 0x1e2a3a, cornice: true, ac: 0.3, sides: { L: 'windows' },
    shops: [{ x0: 0.4, x1: 17.6, interior: 'bar', ceil: 3.6, kick: 'paint', kickColor: 0x1e2a3a, door: 'left', frame: 0x1e2a3a, lit: 0.4, neon: 'COCKTAILS', neonAt: 12.5, sign: { text: 'The Blue Marlin', sub: 'Cocktails · Cold Beer · Pool', style: 'lightbox', bg: '#16324f', fg: '#7fd4ff', accent: '#ffffff', font: 'script' } }] },
  { name: 'precinct', z: -239, w: 36, d: 24, floors: 2, gh: 5.4, fh: 3.8, parapet: 1.3, color: 0xe3d7bd, trim: 0xefe6d2, frame: 0x34383a, cornice: true, belt: true, bays: 9, win: { w: 1.4, h: 2.0, sill: 0.8 },
    deco: { at: [0.3, 8.0, 12.0, 24.0, 28.0, 35.7], w: 0.7, up: 1.0 }, groundWindows: [2, 6, 30, 34], groundRoom: 2, bars: true, labelW: 6.5,
    shops: [{ x0: 12.4, x1: 23.6, room: 2, interior: 'police', ceil: 4.2, kick: 'facadeTiles', frame: 0x34383a, door: 'centre', h: 4.0, sign: { text: '14TH PRECINCT', style: 'letters', bg: '#e3d7bd', fg: '#26324a', font: 'deco', wear: 0.15, h: 0.55, inset: 0.15 } }],
    label: { text: 'COAST CITY POLICE DEPARTMENT', style: 'letters', bg: '#e3d7bd', fg: '#26324a', font: 'deco', wear: 0.15 } },
  { name: 'travel', z: -275, w: 12, d: 14, floors: 1, gh: 4.4, parapet: 0.9, color: 0xbfe0e6, trim: 0xf4f1ea,
    shops: [{ x0: 0.4, x1: 11.6, awning: 2, interior: 'travel', door: 'right', frame: 0xf4f1ea, sign: { text: 'Sea Breeze Travel', sub: 'Hawaii · Mexico · Europe · Cruises', style: 'board', bg: '#1d6f8a', fg: '#ffffff', accent: '#ffd23f', font: 'script' } }] },
  { name: 'thrift', z: -287, w: 16, d: 18, floors: 2, gh: 4.2, fh: 3.1, wall: 'pbrick', color: 0xe8d9c4, trim: 0xd6c8b0, frame: 0x3b3027, cornice: true, ac: 0.35,
    shops: [{ x0: 0.4, x1: 15.6, room: 1, interior: 'thrift', door: 'centre', frame: 0x3b3027, kick: 'paint', kickColor: 0x6a2a22, sign: { text: 'SECOND CHANCE', sub: 'Thrift · Furniture · Clothing · Books', style: 'board', bg: '#f0e6d0', fg: '#6a2a22', accent: '#2f5a3e', font: 'slab' } }] },
  { name: 'coronado', z: -303, w: 28, d: 20, floors: 4, gh: 4.3, fh: 3.0, color: 0xf2e6d0, trim: 0x2f6f7a, frame: 0x2f6f7a, belt: true, cornice: true, ac: 0.3, bays: 8, balconies: [1, 2, 3], balconyBays: [1, 6],
    shops: [
      { x0: 0.4, x1: 11.6, awning: 1, interior: 'cleaners', sign: { text: 'Bayside Cleaners', sub: 'One-Hour Service · Alterations', style: 'lightbox', bg: '#ffffff', fg: '#1f5a8a', accent: '#c0201b', font: 'sans' }, neon: 'OPEN', frame: 0xc7ccd0 },
      { x0: 16.4, x1: 27.6, shutter: 0.6, lit: 0.5, interior: 'bail', sign: { text: 'A-1 BAIL BONDS', sub: '24 Hours · Se Habla Español', style: 'lightbox', bg: '#f7d21e', fg: '#141414', accent: '#c0201b', font: 'condensed' }, neon: 'OPEN 24', frame: 0x222222 },
    ],
    entries: [{ x: 14.0, w: 2.2, h: 3.1, arch: 1.1, color: 0x22403f }], label: { text: 'THE CORONADO', sub: 'Apartments', style: 'letters', bg: '#f2e6d0', fg: '#2f6f7a', font: 'deco', wear: 0.2 } },
  { name: 'books', z: -331, w: 18, d: 18, floors: 2, gh: 4.3, fh: 3.1, color: 0xd9c9a3, trim: 0x5a3a24, frame: 0x3a2a1c, cornice: true, ac: 0.3,
    shops: [{ x0: 0.4, x1: 17.6, awning: 0, interior: 'books', door: 'left', frame: 0x3a2a1c, kick: 'paint', kickColor: 0x3a2a1c, sign: { text: 'Pacific Books', sub: 'New · Used · Rare · Maps', style: 'board', bg: '#2a3a2a', fg: '#f3e8cf', accent: '#d9b25c', font: 'serif' } }] },
  { name: 'palms', z: -349, w: 30, d: 26, floors: 2, gh: 6.0, fh: 4.4, parapet: 1.6, color: 0xf2d9b8, trim: 0xb8322a, frame: 0x6a2a22, bands: [6.6, 6.85, 7.1], bandColor: 0xb8322a, bays: 6, win: { w: 1.0, h: 2.2, sill: 1.0 },
    skip: [2, 3], marquee: true,
    shops: [{ x0: 9.0, x1: 21.0, interior: 'cinema', ceil: 4.2, kick: 'facadeTiles', frame: 0xb08d4a, door: 'centre', h: 3.6, sign: { text: 'THE PALMS', style: 'neon', bg: '#2a0f0c', fg: '#ff5a3c', font: 'deco', h: 0.6 } }] },
  { name: 'tonys', z: -379, w: 17, d: 16, floors: 2, gh: 4.3, fh: 3.1, color: 0xf3ead6, trim: 0x2f6b45, frame: 0x2f6b45, ac: 0.4, belt: true,
    shops: [{ x0: 0.4, x1: 16.6, awning: 3, interior: 'pizza', door: 'centre', frame: 0x2f6b45, kick: 'checker', neon: 'PIZZA', sign: { text: 'Tony’s Pizza', sub: 'By the Slice · Pies · Calzones', style: 'board', bg: '#2f6b45', fg: '#ffffff', accent: '#c0201b', font: 'script' } }] },
];
const EAST2 = [
  { name: 'starlight', z: -237, w: 16, d: 16, floors: 1, gh: 4.6, parapet: 1.0, color: 0xd8dde6, trim: 0x3a4a8a, sides: { R: 'windows' }, bands: [4.2, 4.4], bandColor: 0x3a4a8a,
    shops: [{ x0: 0.4, x1: 15.6, interior: 'tv', door: 'left', frame: 0xc7ccd0, sign: { text: 'STARLIGHT', sub: 'TV · Radio · Hi-Fi · Repairs', style: 'lightbox', bg: '#1a2050', fg: '#ffe066', accent: '#7fd4ff', font: 'deco' }, neon: 'OPEN' }] },
  { name: 'salon', z: -249, w: 12, d: 15, floors: 1, gh: 4.4, parapet: 0.9, gable: { width: 0.6, rise: 1.2 }, coping: 'tile', color: 0xf3cfd8, trim: 0xf6efe6,
    shops: [{ x0: 0.4, x1: 11.6, pent: true, interior: 'salon', door: 'right', frame: 0x8a4a5a, kick: 'patio', sign: { text: 'Belle’s', sub: 'Beauty Salon · Walk-ins', style: 'board', bg: '#8a4a5a', fg: '#fff1f4', accent: '#f0c0cc', font: 'script' } }] },
  { name: 'stmarys', z: -321, w: 72, d: 26, floors: 4, gh: 4.8, fh: 3.4, parapet: 1.2, color: 0xeee8dc, trim: 0xf6f2ea, frame: 0x6a7a84, cornice: true, belt: true, bays: 20, win: { w: 1.5, h: 1.7, sill: 0.9 }, ac: 0.08,
    groundWindows: [1.8, 5.4, 9.0, 12.6, 16.2, 19.8, 52.2, 55.8, 59.4, 63.0, 66.6, 70.2], groundRoom: 2, bars: false, hospital: true,
    shops: [{ x0: 26.0, x1: 46.0, room: 2, interior: 'hospital', ceil: 3.9, kick: 'facadeTiles', frame: 0x6a7a84, door: 'centre', h: 3.6, sign: { text: 'EMERGENCY', style: 'lightbox', bg: '#c0201b', fg: '#ffffff', accent: '#ffffff', font: 'sans', h: 0.75 } }] },
  { name: 'gym', z: -341, w: 20, d: 18, floors: 2, gh: 4.6, fh: 3.2, wall: 'pbrick', color: 0xd8dcd8, trim: 0x2a2a2a, frame: 0x2a2a2a, cornice: true, ac: 0.5,
    shops: [{ x0: 0.4, x1: 19.6, room: 1, interior: 'gym', door: 'right', frame: 0x222222, kick: 'paint', kickColor: 0x2a2a2a, sign: { text: 'IRON BEACH GYM', sub: 'Boxing · Weights · Since 1959', style: 'board', bg: '#1d1d1d', fg: '#f2c12e', accent: '#c0201b', font: 'condensed' } }] },
  { name: 'delmar', z: -367, w: 26, d: 20, floors: 3, gh: 3.8, fh: 3.1, roof: 'hip', color: 0xf5efe2, trim: 0x7a4a2a, frame: 0x4a3324, win: { w: 1.1, h: 1.5, arch: 0.35, sill: 0.85 },
    bays: 7, balconies: [1, 2], balconyBays: [1, 5], ac: 0.2, groundWindows: [2.4, 6.0, 20.0, 23.6], bars: true,
    entries: [{ x: 13.0, w: 2.2, h: 3.05, arch: 1.1, color: 0x3a2a1c }], label: { text: 'DEL MAR COURT', sub: 'Apartments', style: 'letters', bg: '#f5efe2', fg: '#6b4128', font: 'serif', wear: 0.2 } },
  { name: 'oceanmkt', z: -396, w: 29, d: 22, floors: 1, gh: 5.0, parapet: 1.2, color: 0xe6efe0, trim: 0x2a6a4a, sides: { L: 'windows' },
    shops: [{ x0: 0.4, x1: 28.6, interior: 'grocer', ceil: 3.8, kick: 'paint', kickColor: 0x2a6a4a, door: 'right', frame: 0xc7ccd0, sign: { text: 'OCEAN MARKET', sub: 'Groceries · Produce · Meats · Liquor', style: 'lightbox', bg: '#2a6a4a', fg: '#ffffff', accent: '#ffd23f', font: 'condensed' }, neon: 'OPEN' }] },
];

// Each stretch's street, in the block's frame from the north end to the south: its pavements' run,
// the pavement round the corners along the cross street, the kerbs painted red (the crossing, the
// zones kept for the police and the ambulances), the hydrants, the bus stop, the parking's run, the
// lane lines', the stop bar and the crosswalk at the crossing, drains, manholes, the palms and lamps,
// the corner's boxes. And the alleys behind.
const STREETS = {
  hals: { n: -24, s: -204, corner: [-199, -204], red: [[-190, -204]], hyd: { W: [-66, -128, -170], E: [-72, -138, -186] }, bus: { side: 'E', z: [-110, -130], at: -120 },
    noPark: [['E', -162, -180]], park: [-34, -192], paint: [-30, -199.5], stop: [6.2, 10.0, -199.0, -199.5], walk: [-200.4, -203.4], crossWalks: true,
    drains: [-52, -146], manholes: [-40, -118, -184], trees: [-40, -196], news: [-194, 1], mailbox: -190.2, cabinet: ['E', -60.6] },
  south: { n: -216, s: -404, corner: [-216, -221], red: [[-216, -228], [-392, -404]], hyd: { W: [-236, -300, -366], E: [-244, -310, -352] }, bus: { side: 'W', z: [-331, -349], at: -340 },
    zones: [{ side: 'W', z: [-244, -270], cars: ['policecar', 'policecar', 'policecar'] }, { side: 'E', z: [-276, -296], cars: ['ambulance'] }],
    noPark: [], park: [-232, -392], paint: [-220.4, -404], stop: [2.0, 5.8, -220.6, -221.1], walk: [-216.8, -219.8], endKerb: true,
    drains: [-250, -358], manholes: [-232, -300, -372], trees: [-232, -398], news: [-224, -1], mailbox: -228.2, cabinet: ['E', -356] },
};
const ALLEYS = {
  hals: { z: [-26, -199], poles: -36, bins: [-40, -88, -122, -150, -184], dumpsters: [-66, -160], cart: [-31.8, -104], escape: -68 },
  south: { z: [-223, -396], poles: -233, bins: [-236, -290, -330, -372], dumpsters: [-262, -350], escape: -317 },
};

export function buildHalsBlock(f, origin, lod = null, drawn = new Set()) { return runSteps(blockSteps(f, origin, lod, drawn)); }

// the same, a step at a time (each `yield` somewhere it may stop for the browser: engine/Slice.js)
export function* blockSteps(f, origin, lod = null, drawn = new Set()) {
  const scene = f.scene, physics = f.physics, smash = f.smash, B = BLOCK;
  const g = new THREE.Group();
  g.name = 'halsBlock';
  g.position.copy(origin);
  scene.add(g);
  const rnd = seeded(1958), rndS = seeded(1977); // (each block its own: the second leaves Hal's as it was)
  const mats = cityMaterials();
  // the signs' pages, and a material of each kind for each (Signs.js: two blocks' signs fill more than one)
  const signs = new SignPages(f.engine.renderer, mats), litMats = signs.litMats;
  mats.roofTile = mats.tile;
  const ctx = { batch: new Batch(), mats, signs, rnd, props: true, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [], decals: {},
    doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [] };
  const built = [];
  // ------------------------------------------------------------------ the buildings
  for (const [west, east, r] of [[WEST, EAST, rnd], [WEST2, EAST2, rndS]]) { // (and the block over the crossing)
    ctx.rnd = r;
    for (const spec of west) { built.push({ spec, b: building(ctx, { ...spec, at: V(B.frontW, 0, spec.z), yaw: Math.PI / 2 }), side: -1 }); yield; }
    for (const spec of east) { built.push({ spec, b: building(ctx, { ...spec, at: V(B.frontE, 0, spec.z), yaw: -Math.PI / 2 }), side: 1 }); yield; }
  }
  ctx.rnd = rnd;
  for (const { spec, b, side } of built) dress(ctx, spec, b, side, g);
  // the rooms you can walk into (Interiors.js), their lettering
  for (const r of ctx.inside) { (r.kind === 'diner' ? diner : r.kind === 'market' ? market : shopRoom)(ctx, r.M, r); yield; }
  for (const l of ctx.labels) label(ctx, l.M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, l.z)), l.u0, l.u1, l.y0, l.h, l.sign);
  signs.flush();
  for (const sp of ctx.spots) for (const k of ['at', 'approach', 'look']) sp[k]?.add(origin); // (the story's interactions are in the world)
  for (const p of ctx.posts) { p.at.add(origin); for (const b of p.beat ?? []) b.add(origin); } // (and where its people stand)
  // ------------------------------------------------------------------ the street
  yield;
  street(ctx, g, STREETS.hals);
  alleys(ctx, g, ALLEYS.hals);
  yield;
  ctx.rnd = rndS;
  street(ctx, g, STREETS.south);
  alleys(ctx, g, ALLEYS.south);
  ctx.rnd = rnd;
  yield;
  // (600 m cells, not 80: a material's whole stretch one draw; the street's 1,086 draw calls were a quarter
  // these, forty materials in eight cells; the perf pass, 2026-11-23)
  const city = yield* ctx.batch.buildSteps(mats, { cell: 600 });
  g.add(city);
  // the props the buildings and the street placed: into the block, and touchable
  for (const [i, { o, kind }] of ctx.objects.entries()) {
    g.add(o);
    o.userData.kind = kind; // (what it is: tools/perf-probe.js counts draws by it)
    o.traverse((m) => { if (m.isMesh) { m.castShadow = kind !== 'decal'; m.receiveShadow = true; } });
    if (!KEEP_PARTS.has(kind)) flatten(o); // one mesh per material (a pole's 19 parts, a condenser's 12)
    const solid = SOLID[kind];
    if (solid) smash.add(o, solid);
    if (i % 16 === 15) yield;
  }
  yield;
  for (const car of ctx.cars ?? []) smash.add(car, { kind: 'car', mass: 1300, shrink: 0.97 });
  // the other shops' shared lamp: a source in the scene's pool (city/Lamps.js), moved to the shop the
  // camera's in or nearest
  const shopLamp = new THREE.Object3D();
  g.add(shopLamp);
  const shopSrc = f.lamps?.add(shopLamp, { color: 0xfff0dc, power: 0, reach: 14 });
  // the shops' goods, their doors, the lights in the rooms (on when the camera's near: no recompiles)
  const goods = stockShelves(ctx, g);
  for (const d of ctx.doors) { flatten(d.pivot); d.pivot.traverse((m) => { if (m.isMesh) m.castShadow = false; }); g.add(d.pivot); } // (a door was a dozen boxes: a draw call each; then batched, below)
  // the diner's and the store's lights, sources in the pool (their PointLights only say where)
  for (const r of ctx.roomLights) { const mk = new THREE.Object3D(); mk.position.copy(r.light.position); g.add(mk); r.src = f.lamps?.add(mk, { color: r.light.color, power: 0, reach: r.light.distance }); }
  // colliders: each building's mass, its parapets, a hip roof as its hull
  const solidStandIns = [];
  for (const [i, s] of ctx.solids.entries()) {
    if (i % 64 === 63) yield;
    const d = new THREE.Object3D();
    solidStandIns.push(d);
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
  const night = nightKit(ctx, g, mats, f.lamps);
  const instSets = []; // (the instanced props, each copy within its distance: city/Lod.js InstanceSet)
  // ------------------------------------------------------------------ drawn by distance
  if (lod) {
    g.updateMatrixWorld(true);
    for (const m of city.children) {
      if (FAR_KEYS.has(m.name.replace('city_', '').replace(/(sign|signLit)\d+$/, '$1'))) continue; // (a sign atlas's later pages too)
      m.geometry.computeBoundingBox();
      lod.add(m, DRAW.detail, { box: m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld) });
    }
    // The props that never move (the palms, the shops' fixed furniture, the poles, signs and neon on the
    // walls) drawn instanced: one mesh for each of their shapes and materials in each cell, all the
    // copies at once (a draw call each was most of what was left); their colliders and Smash's items
    // stay where they are, without meshes.
    const inst = new Map(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), _ic = V(0, 0, 0);
    const itemOf = new Map(smash.items.map((it) => [it.object, it]));
    // a prop's meshes into the instanced sets (`ref`: the prop, for when it's moved)
    const instance = (o, dist, shadow, ref = null) => {
      o.updateMatrixWorld(true);
      const parts = [];
      o.traverseVisible((m) => { if (m.isMesh && !m.isSkinnedMesh && !m.isInstancedMesh && !Array.isArray(m.material)) parts.push(m); });
      const out = [];
      for (const m of parts) {
        const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        _ic.setFromMatrixPosition(M);
        const key = `${m.geometry.uuid}|${m.material.uuid}|${Math.floor(_ic.x / 600)},${Math.floor(_ic.z / 600)}|${dist}|${shadow}`;
        const e = inst.get(key) ?? inst.set(key, { geo: m.geometry, mat: m.material, list: [], dist, shadow, cast: m.castShadow }).get(key);
        const entry = { M, pos: new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), gone: false, set: null };
        e.list.push(entry);
        out.push({ entry, e });
      }
      return { parts, out };
    };
    for (const { o, kind } of ctx.objects) {
      const r = new THREE.Box3().setFromObject(o).getSize(V(0, 0, 0)).length() / 2;
      const dist = kind === 'wallshelf' || kind === 'cooler' ? 45 : ROOM.has(kind) ? 50 : kind === 'small' ? 35 : STREET.has(kind) ? DRAW.street : kind === 'decal' && r > 2 ? DRAW.detail : DRAW.small;
      // (shadows only near: the shadow map draws every caster again, and was half the frame)
      // (none from what's small or indoors: the sun hardly reaches it, and each was a draw call more)
      const shadow = STREET.has(kind) || r > 2 ? 70 : ROOM.has(kind) || kind === 'small' || kind === 'wallshelf' || kind === 'cooler' ? 0 : kind === 'plant' ? 15 : 35;
      drawn.add(o);
      if (kind === 'palm' && f.palms) { // (drawn by the scene's palm field: city/Palms.js)
        o.updateMatrixWorld(true);
        f.palms.add(o.userData.palm, o.matrixWorld);
        for (const m of [...o.children]) m.removeFromParent();
        continue;
      }
      if (STILL.has(kind)) {
        for (const m of instance(o, dist, shadow).parts) m.removeFromParent();
        continue;
      }
      const item = itemOf.get(o);
      if (item && UNTIL_MOVED(kind)) {
        // drawn instanced until it's moved: then itself again, drawn by distance as the rest
        const { out } = instance(o, dist, shadow, o);
        o.visible = false;
        smash.watch(item, () => {
          for (const { entry, e } of out) { entry.gone = true; e.set.dirty = true; }
          o.visible = true;
          lod.add(o, dist, { moves: true, shadow });
        });
        continue;
      }
      lod.add(o, dist, { moves: true, shadow });
    }
    // the doors' merged parts in the batches too, moved there as they swing (update): a door's four were a draw
    // call each, 28 in Hal's street; the frames one material, each copy its own colour
    const frames = new Set(ctx.doorMats?.values()), doorMetal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.75 });
    for (const d of ctx.doors) {
      d.pivot.updateMatrixWorld(true);
      const pinv = new THREE.Matrix4().copy(d.pivot.matrixWorld).invert();
      d.parts = [];
      d.pivot.traverse((m) => {
        if (!m.isMesh || Array.isArray(m.material)) return;
        // (the push bars wore the kit's metal, coloured in its vertices, and had no colours: drawn black)
        const bars = m.material.vertexColors && !m.geometry.attributes.color, mat = frames.has(m.material) || bars ? doorMetal : m.material, key = `door|${m.geometry.uuid}|${mat.uuid}`;
        const e = inst.get(key) ?? inst.set(key, { geo: m.geometry, mat, list: [], dist: 60, shadow: 0, cast: false }).get(key);
        const entry = { M: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), pos: new THREE.Vector3().setFromMatrixPosition(m.matrixWorld), gone: false, set: null, color: bars ? BAR : mat === doorMetal ? m.material.color : null };
        e.list.push(entry);
        d.parts.push({ entry, e, rel: new THREE.Matrix4().multiplyMatrices(pinv, m.matrixWorld) });
      });
      for (const c of [...d.pivot.children]) d.pivot.remove(c);
    }
    // (one batch per material, all its shapes: city/Lod.js BatchSet; a shader of its own (the glass with its rooms)
    // instanced as before)
    const byMat = new Map();
    for (const e of inst.values()) (byMat.get(e.mat) ?? byMat.set(e.mat, []).get(e.mat)).push(e);
    for (const [mat, list] of byMat) {
      if (mat.isShaderMaterial || Array.isArray(mat)) {
        for (const e of list) { e.set = new InstanceSet(g, e.geo, e.mat, e.list, { dist: e.dist, shadow: e.shadow, cast: e.cast }); instSets.push(e.set); }
        continue;
      }
      const set = new BatchSet(g, mat, list);
      for (const e of list) e.set = set;
      instSets.push(set);
    }
    // (a parked car its own 54 parts only within 4 m: its merged copy is made again when it's dented or
    // a pane goes, and it doesn't move; traffic keeps its spinning wheels to 15 m)
    for (const car of ctx.cars ?? []) { lod.addCar(car, DRAW.street, smash.items.find((i) => i.object === car), { near: 4, far: 16 }); drawn.add(car); }
    for (const m of goods) { m.castShadow = false; lod.add(m, 50, { box: new THREE.Box3().setFromObject(m), shadow: 0 }); } // (shelves of goods cast no shadow worth drawing)
    lod.add(night.group, DRAW.detail, { box: new THREE.Box3().setFromObject(night.group) });
  }
  // what never moves keeps the matrices it has (three.js works out every object's every frame: 22,000
  // of them cost 4 ms): the buildings' cells, the night's planes, the instanced props, the colliders' stand-ins
  const still = (o) => { o.updateMatrixWorld(true); o.traverse((c) => { c.matrixAutoUpdate = false; }); o.matrixWorldAutoUpdate = false; };
  still(city);
  still(night.group);
  for (const c of g.children) if (c.isInstancedMesh) still(c);
  for (const d of solidStandIns) still(d);
  signs.flush(); // (any lettered since)
  signs.sealAll(); // (all its signs are in: compressed)
  return {
    group: g, ctx, mats,
    setNight(k) {
      cityU.uNight.value = k;
      for (const m of litMats) m.emissiveIntensity = 0.08 + k * 1.1; // (brighter still, a white lightbox clips to white and its letters go)
      mats.lamp.emissiveIntensity = k * 1.8; // (sodium: Kit.js lamp)
      night.set(k);
    },
    // (`hal`: the player's position, set by the story when he's free to walk in: the doors open for him)
    hal: null, onDoor: null, openers: [], staff: [], // (`staff`: Rosie on her way, for the counter's gate)
    // whether a world point is inside one of the rooms you can walk into (no rain falls there)
    indoors(at) {
      for (const r of [...ctx.rooms, ...(ctx.shopLights ?? [])]) { // (the diner and the store, and every other shop)
        _in.copy(at).sub(g.position).applyMatrix4(r.inv ??= r.M.clone().invert());
        if (_in.x > r.x0 && _in.x < r.x1 && _in.z < r.z0 && _in.z > r.z1 && _in.y < (r.ceil ?? 3.2) + 0.2) return true;
      }
      return false;
    },
    update(dt, t, camera) {
      cityU.uTime.value = t;
      if (camera) for (const set of instSets) set.update(camera.position);
      swingDoors(ctx.doors, g.position, dt, this);
      for (const d of ctx.doors) {
        if (!d.parts || d.drawn === d.open) continue;
        d.drawn = d.open;
        d.pivot.updateMatrix(); // (a child of the block's group: its matrix is its place in the batches' frame)
        for (const p of d.parts) p.e.set?.move(p.entry, _dm.multiplyMatrices(d.pivot.matrix, p.rel));
      }
      if (camera) for (const r of ctx.roomLights) if (r.src) r.src.power = r.light.position.distanceToSquared(_c.copy(camera.position).sub(g.position)) < 4900 ? r.power : 0;
      // the other shops' one lamp (city/Shops.js), in whichever the camera's in or nearest to (inside 18 m)
      if (camera && ctx.shopLights?.length) {
        _c.copy(camera.position).sub(g.position);
        let best = null, bd = 18;
        for (const L of ctx.shopLights) {
          _in.copy(_c).applyMatrix4(L.inv ??= L.M.clone().invert());
          const dd = Math.hypot(Math.max(L.x0 - _in.x, 0, _in.x - L.x1), Math.max(_in.z - L.z0, 0, L.z1 - _in.z));
          if (dd < bd) { bd = dd; best = L; }
        }
        if (shopSrc) shopSrc.power = best ? 3.6 * Math.min(1, 1.6 - bd / 11) : 0;
        if (best) shopLamp.position.copy(best.pos ??= best.at.clone().applyMatrix4(best.M));
      }
    },
  };
}

// The doors of rooms to walk into (the block's, the Ferris offices'), each opening for Hal (`by.hal`)
// or anyone else coming through (`by.openers`, the people's positions; a staff door, the counter's
// gate, only for `by.staff`), and shutting behind them. `origin`: where the doors' frame is.
export function swingDoors(doors, origin, dt, by) {
  const hal = by.hal && _h.copy(by.hal).sub(origin);
  for (const d of doors) {
    let who = hal && !d.staff && Math.hypot(hal.x - d.at.x, hal.z - d.at.z) < (d.target ? 2.6 : 1.7) && Math.abs(hal.y - d.at.y) < 2.5 ? hal : null;
    if (!who) for (const p of (d.staff ? by.staff : by.openers) ?? []) { _o.copy(p).sub(origin); if (Math.hypot(_o.x - d.at.x, _o.z - d.at.z) < (d.target ? 1.8 : 1.3)) { who = _o; break; } }
    const near = !!who;
    if (near && !d.target) {
      if (!d.staff) by.onDoor?.(d); // (the gate has no bell)
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
}

// how the props are touched (props/Smash.js): window AC units and dishes can be knocked off the
// walls and roofs, planters and bins go flying, the condensers are heavy
export const SOLID = {
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
  const lw = spec.labelW ?? 3.2;
  if (spec.label) label(ctx, Mfront, spec.w / 2 - lw, spec.w / 2 + lw, spec.gh + 0.15, 0.7, spec.label);
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
    case 'precinct': {
      // the blue lamps either side of the door, on their brackets
      const K = kit(ctx, Mfront);
      for (const u of [15.4, 20.6]) {
        K.add('iron', box(u - 0.04, 2.95, 0, u + 0.04, 3.02, 0.42), 0x2a2a2a);
        K.add('glow', new THREE.SphereGeometry(0.2, 14, 10).translate(u, 2.82, 0.42), 0x4a7aff);
        K.add('iron', new THREE.CylinderGeometry(0.06, 0.08, 0.08, 10).translate(u, 3.04, 0.42), 0x2a2a2a);
      }
      break;
    }
    case 'stmarys': {
      // its name on the roof, lit; the emergency room's canopy out over the pavement on two columns
      label(ctx, Mfront, spec.w / 2 - 11, spec.w / 2 + 11, b.top + 0.12, 1.5, { text: 'ST. MARY’S MEDICAL CENTER', style: 'lightbox', bg: '#ffffff', fg: '#1f4f8a', accent: '#c0201b', font: 'sans', wear: 0.1 });
      // (over the EMERGENCY sign, its columns out by the kerb, clear of the people walking)
      const K = kit(ctx, Mfront), u0 = 30.5, u1 = 42.5, out = 5.0, y0 = 4.55, y1 = 4.9;
      K.add('concrete', box(u0, y0, 0, u1, y1, out), 0xe8e4dc);
      K.add('paint', box(u0 - 0.01, y0, out, u1 + 0.01, y1, out + 0.02), 0xc0201b);
      K.solid(u0, y0, 0, u1, y1, out, 'stone');
      for (const u of [u0 + 0.4, u1 - 0.4]) { K.add('paint', box(u - 0.14, BLOCK.pave, out - 0.46, u + 0.14, y0, out - 0.18), 0xe8e4dc); K.solid(u - 0.14, BLOCK.pave, out - 0.46, u + 0.14, y0, out - 0.18, 'stone'); }
      for (let u = u0 + 1.5; u < u1 - 1; u += 3) K.add('glow', box(u - 0.5, y0 - 0.02, 1.4, u + 0.5, y0, 3.2), 0xf4f6ff);
      break;
    }
    case 'palms': marquee(ctx, Mfront, spec); blade(ctx, Mfront, spec, { u: spec.w / 2 + 0.2, text: 'PALMS', y0: 6.0, h: 5.4 }); break;
    case 'diner': label(ctx, Mfront, spec.w - 9.5, spec.w - 0.6, b.top + 0.12, 1.5, { text: 'ROSIE’S', sub: 'Diner · Open 24 Hours', style: 'lightbox', bg: '#c4161c', fg: '#fff6e6', accent: '#ffe08a', font: 'script', wear: 0.25 }); break;
    default: break;
  }
  // some walls carry their meters, conduit and a back-door lamp
  if (spec.d > 15) put('elecboxes', spec.w - 2.5, 0.1, -spec.d - 0.02, 'decal', yawOut + Math.PI);
  void g;
}
let _r = seeded(77);
const rnd01 = () => _r();

// a blade sign: a tall box out from the front (the hotel's at its corner), HOTEL down it in neon
function blade(ctx, M, spec, { u = spec.w - 0.9, text = 'HOTEL', y0 = spec.gh + 0.6, h = 5.6, out = 1.3 } = {}) {
  const F = M.clone().multiply(new THREE.Matrix4().makeTranslation(u, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  ctx.batch.add('paint', box(0.06, y0, -0.18, out, y0 + h, 0.18), F, 0x7a1e1a);
  for (const sgn of [1, -1]) {
    const Fs = F.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, sgn * 0.18)).multiply(new THREE.Matrix4().makeRotationY(sgn > 0 ? 0 : Math.PI));
    const a0 = sgn > 0 ? 0.12 : -out + 0.06, a1 = sgn > 0 ? out - 0.06 : -0.12;
    label(ctx, Fs, a0, a1, y0 + 0.15, h - 0.3, { text, style: 'neon', vertical: true, bg: '#2a0f0c', fg: '#ff5a3c', font: 'condensed', wear: 0.1 }, 0.001);
  }
  ctx.batch.add('iron', box(0, y0 + 0.4, -0.04, 0.2, y0 + 0.48, 0.04), F, 0x222222);
  ctx.batch.add('iron', box(0, y0 + h - 0.5, -0.04, 0.2, y0 + h - 0.42, 0.04), F, 0x222222);
}

// the picture house's marquee: a box out over the door, this week's pictures on its letter boards
// (front and ends), bulbs along its edges and under it (lit at night with the street's lamps)
function marquee(ctx, M, spec) {
  const u0 = spec.w / 2 - 8, u1 = spec.w / 2 + 8, y0 = 4.15, y1 = 5.55, out = 3.2, K = kit(ctx, M);
  K.add('paint', box(u0, y0, 0, u1, y1, out), 0xb8322a);
  K.solid(u0, y0, 0, u1, y1, out, 'stone');
  const board = { style: 'board', bg: '#f4f1e8', fg: '#141414', font: 'condensed', wear: 0.08 };
  label(ctx, M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, out + 0.006)), u0 + 0.35, u1 - 0.35, y0 + 0.22, y1 - y0 - 0.44, { ...board, text: 'THE LONG HORIZON · STARFALL', sub: 'MIDNIGHT ON THE PIER · SAT MATINEE 2PM' }, 0.001);
  for (const [u, sg] of [[u0, -1], [u1, 1]]) {
    const S = M.clone().multiply(new THREE.Matrix4().makeTranslation(u + sg * 0.006, 0, out / 2)).multiply(new THREE.Matrix4().makeRotationY(sg * Math.PI / 2));
    label(ctx, S, -out / 2 + 0.25, out / 2 - 0.25, y0 + 0.22, y1 - y0 - 0.44, { ...board, text: 'PALMS' }, 0.001);
  }
  for (let u = u0 + 0.18; u < u1; u += 0.32) for (const y of [y0 + 0.09, y1 - 0.09]) K.add('lamp', new THREE.SphereGeometry(0.045, 6, 4).translate(u, y, out + 0.05), 0xfff0c8);
  for (let u = u0 + 0.7; u < u1 - 0.4; u += 0.9) for (let z = 0.6; z < out - 0.3; z += 0.9) K.add('glow', box(u - 0.07, y0 - 0.02, z - 0.07, u + 0.07, y0, z + 0.07), 0xfff0c8);
}

// ---------------------------------------------------------------------------------- the street
function street(ctx, g, L) {
  const B = BLOCK, { batch, objects } = ctx;
  const add = (o, kind) => { objects.push({ o, kind }); return o; };
  const I = new THREE.Matrix4();
  // pavements: slabs to the fronts, their joints the texture's; the kerb's face below their edge
  const pave = (x0, x1, z0, z1) => {
    batch.add('pavement', box(x0, 0, z1, x1, B.pave, z0), I, 0xffffff);
    ctx.pads.push({ c: V((x0 + x1) / 2, B.pave / 2, (z0 + z1) / 2), half: V(Math.abs(x1 - x0) / 2, B.pave / 2, Math.abs(z0 - z1) / 2) });
  };
  ctx.mats.pavement ??= pbrMaterial('concrete_pavement', { repeat: [1 / 3, 1 / 3], tint: new THREE.Color(1.08, 1.05, 1.0) });
  pave(B.frontW, B.kerbW, L.n, L.s);
  pave(B.kerbE, B.frontE, L.n, L.s);
  pave(-46, B.frontW, L.corner[0], L.corner[1]); // along the cross street, round the corners
  pave(B.frontE, 60, L.corner[0], L.corner[1]);
  // the kerbs: a concrete edge, painted red where you mustn't stop, a gutter in front of them
  const red = [], kerbs = [];
  for (const [side, x] of [['W', B.kerbW], ['E', B.kerbE]]) {
    const s = side === 'W' ? 1 : -1; // toward the road
    const spans = L.red.map(([a, b]) => [a, b, true]);
    for (const z of L.hyd[side]) spans.push([z + 3.5, z - 3.5, true]);
    if (L.bus?.side === side) spans.push([L.bus.z[0], L.bus.z[1], true]);
    for (const zn of L.zones ?? []) if (zn.side === side) spans.push([zn.z[0], zn.z[1], true]);
    // the kerb itself, then the red over it
    batch.add('concrete', box(x - s * 0.18, 0, L.s, x + s * 0.01, B.pave + 0.005, L.n), I, 0xc9c3b8);
    for (const [z0, z1, isRed] of spans) if (isRed) batch.add('roadpaint', box(x - s * 0.185, 0.02, z1, x + s * 0.014, B.pave + 0.009, z0), I, 0xb8322a);
    batch.add('concrete', box(x + s * 0.01, 0.0, L.s, x + s * 0.46, 0.012, L.n), I, 0x77736d); // the gutter (a shade lighter than the asphalt, not white)
    red.push(...spans.filter((sp) => sp[2]));
    kerbs.push({ side, x, s, spans });
  }
  // where the parking lanes end at the old boulevard (its kerbs at x 2 and 10): the pavement out to
  // them, round the end of each lane, its kerb facing south
  if (L.endKerb) for (const [x0, x1] of [[B.kerbW, 2], [10, B.kerbE]]) {
    pave(x0, x1, L.s + 6, L.s);
    batch.add('concrete', box(x0, 0, L.s + 6.18, x1, B.pave + 0.005, L.s + 5.99), I, 0xc9c3b8);
  }
  // the road's paint: the double yellow down the middle, the parking lanes' lines and their T's,
  // the stop bar and crosswalks at the crossing
  const line = (x0, z0, x1, z1, col = 0xd4d0c6, y = 0.018) => batch.add('roadpaint', box(x0, 0, z1, x1, y, z0), I, col);
  const [p0, p1] = L.paint;
  line(5.88, p0, 5.98, p1, 0xd2a63a); line(6.02, p0, 6.12, p1, 0xd2a63a);
  line(1.95, p0, 2.05, p1); line(9.95, p0, 10.05, p1);
  line(L.stop[0], L.stop[2], L.stop[1], L.stop[3]); // the stop bar, the traffic coming into the crossing
  for (let x = -0.2; x < 12.3; x += 0.95) line(x, L.walk[0], x + 0.5, L.walk[1]); // the crosswalk over the boulevard
  if (L.crossWalks) for (let z = -204.4; z > -215.8; z -= 0.95) { line(-3.9, z, -0.9, z - 0.5); line(12.9, z, 15.9, z - 0.5); } // over the cross street
  // parking: spaces 6.4 m long, a T at each end; cars in about two in three; a meter at each
  const cars = ['fairheaven', 'negotiator', 'sialia', 'fairheaven_sw'], paints = [0x2b4a6b, 0x8e8a7c, 0x6b1f1c, 0xc9c3b4, 0x3c4a3c, 0x1d1f24, 0xb5a27a, 0x5a6670, 0xe2ddd0, 0x7a5a2a];
  const free = (side, z) => !red.some(([a, b]) => z < a + 2.6 && z > b - 2.6) && z < L.n - 8 && !(L.noPark ?? []).some(([sd, a, b]) => sd === side && z < a && z > b);
  let ci = 0;
  const parkCar = (car, side, lane, z) => {
    car.position.set(lane + (ctx.rnd() - 0.5) * 0.15, 0, z + (ctx.rnd() - 0.5) * 0.5);
    car.rotation.y = (side === 'W' ? 0 : Math.PI) + (ctx.rnd() - 0.5) * 0.03;
    g.add(car);
    ctx.cars ??= [];
    ctx.cars.push(car);
  };
  for (const { side, x, s } of kerbs) {
    const lane = x + s * 1.2;
    for (let z = L.park[0]; z > L.park[1]; z -= 6.4) {
      if (!free(side, z)) continue;
      line(Math.min(x + s * 1.7, x + s * 2.4), z + 3.25, Math.max(x + s * 1.7, x + s * 2.4), z + 3.15); // the T at the space's end
      const meter = prop('meter');
      meter.position.set(x - s * 0.45, B.pave, z + 2.6);
      meter.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      add(meter, 'meter');
      if (ctx.rnd() < 0.68) {
        parkCar(makeCar(cars[ci % cars.length], { paint: paints[(ci * 7) % paints.length], dust: 0.2 + ctx.rnd() * 0.4 }), side, lane, z);
        ci++;
      }
    }
    // the zones' own: the precinct's cruisers nose to tail, the ambulance at the emergency room's door
    for (const zn of L.zones ?? []) if (zn.side === side) zn.cars.forEach((name, i) => parkCar(makeCar(name, { paint: name === 'ambulance' ? 0xf2f2ee : 0x111114, dust: 0.08 }), side, lane, zn.z[0] - 4 - i * 6.2 - (zn.cars.length === 1 ? 4 : 0)));
  }
  // drains in the kerb, manholes in the road
  for (const { x, s } of kerbs) for (const z of L.drains) {
    batch.add('dark', box(x - s * 0.02, 0.03, z - 0.7, x + s * 0.016, 0.11, z + 0.7), I, 0x0d0d0c); // the drain's mouth in the kerb
    batch.add('iron', box(x + s * 0.05, 0.0, z - 0.45, x + s * 0.42, 0.016, z + 0.45), I, 0x3a3734);
  }
  for (const z of L.manholes) batch.add('iron', new THREE.CylinderGeometry(0.34, 0.34, 0.018, 20).translate(4.0, 0.006, z), I, 0x3d3a36);
  // palms and lamps along the kerbs, hydrants at their red kerbs
  const glowM = ctx.mats.lamp;
  for (const { side, x, s } of kerbs) {
    for (let z = L.trees[0], n = 0; z > L.trees[1]; z -= 15, n++) {
      if (n % 2 === 0) {
        const p = piece('palms', PALM_KINDS[n % 4 === 0 ? 0 : 1], { root: true });
        p.userData.palm = n % 4 === 0 ? 0 : 1;
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
    for (const z of L.hyd[side]) {
      const h = piece('cityprops', KIT.hydrant, { root: true });
      h.position.set(x - s * 0.35, B.pave, z);
      add(h, 'hydrant');
    }
  }
  // the corner: newspaper boxes, the mailbox, a cabinet; the bus stop and its bench
  for (const [i, dz] of [[0, 0], [1, 0.85], [2, 1.7]]) { const n = prop('newsbox'); n.position.set(-1.4, B.pave, L.news[0] + L.news[1] * dz); n.rotation.y = Math.PI / 2 + (ctx.rnd() - 0.5) * 0.3; add(n, 'newsbox'); void i; }
  const mb = prop('mailbox'); mb.position.set(-1.3, B.pave, L.mailbox); mb.rotation.y = Math.PI / 2; add(mb, 'mailbox');
  const [cs, cz] = L.cabinet, cab = prop('cabinet'); cab.position.set(cs === 'E' ? B.frontE - 0.4 : B.frontW + 0.4, B.pave, cz); cab.rotation.y = cs === 'E' ? -Math.PI / 2 : Math.PI / 2; add(cab, 'cabinet');
  // (along the kerb: the pavement's walked past it; on the west side turned the other way, its bench
  // the other way along it)
  const bs = L.bus.side === 'E' ? -1 : 1, bk = L.bus.side === 'E' ? B.kerbE : B.kerbW;
  const stop = prop('busstop'); stop.position.set(bk - bs * 1.4, B.pave, L.bus.at); stop.rotation.y = bs < 0 ? 0 : Math.PI; add(stop, 'busstop');
  const bench = piece('parkbench', /Object_2/); bench.position.set(bk - bs * 2.2, B.pave, L.bus.at + bs * 6.5); bench.rotation.y = bs * Math.PI / 2; add(bench, 'bench');
  const can = piece('parkbench', /Object_3/); can.position.set(bk - bs * 1.0, B.pave, L.bus.at + bs * 8.4); add(can, 'bench');
}

// the alleys behind both sides: their walls, bins and a dumpster, a power line overhead, a fire escape
function alleys(ctx, g, L) {
  const { batch, objects } = ctx, I = new THREE.Matrix4();
  const add = (o, kind) => { objects.push({ o, kind }); return o; };
  const [n, s0] = L.z;
  for (const [x, s] of [[-34, -1], [46, 1]]) {
    // the back wall of the next block's lots, block concrete, a coping on it
    batch.add('concrete', box(x - 0.12, 0, s0, x + 0.12, 2.1, n), I, 0xb7b0a4);
    batch.add('concrete', box(x - 0.16, 2.1, s0, x + 0.16, 2.2, n), I, 0xc9c2b6);
    ctx.solids.push({ c: V(x, 1.1, (n + s0) / 2), half: V(0.14, 1.1, (n - s0) / 2), q: new THREE.Quaternion(), stuff: 'stone' });
    // power line: a pole every 23.8 m along the alley, the wires sagging between
    for (let zc = L.poles, k = 0; zc - 11.9 > s0; zc -= 23.82, k++) {
      const p = prop('powerpole');
      p.position.set(x + s * 0.9, 0, zc);
      p.rotation.y = Math.PI / 2;
      // its north pole is the last span's south one
      if (k > 0) p.traverse((m) => { if (m.isMesh && /^(Cylinder001|Cube00[345]|Sphere00[4-7])_/.test(m.name)) m.visible = false; });
      add(p, 'decal');
      for (const pz of k > 0 ? [zc - 11.91] : [zc + 11.91, zc - 11.91]) ctx.solids.push({ c: V(x + s * 0.9, 4.75, pz), half: V(0.14, 4.75, 0.14), q: new THREE.Quaternion(), stuff: 'wood' });
    }
    // bins and a dumpster behind the shops, a shopping cart left by the wall
    for (const z of L.bins) {
      const w = piece('wheelie', [/Green/, /Blue/, /Black/, /Grey/][Math.floor(ctx.rnd() * 4)]);
      w.position.set(x - s * 1.0, 0, z);
      w.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      add(w, 'wheelie');
      const w2 = piece('wheelie', /Blue/);
      w2.position.set(x - s * 1.0, 0, z - 0.75);
      w2.rotation.y = w.rotation.y + 0.15;
      add(w2, 'wheelie');
    }
    for (const z of L.dumpsters) { const d = piece('cityprops', KIT.dumpster, { root: true }); d.position.set(x - s * 1.6, 0, z); d.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; add(d, 'dumpster'); }
  }
  if (L.cart) { const cart = prop('cart'); cart.position.set(L.cart[0], 0, L.cart[1]); cart.rotation.y = 2.4; add(cart, 'cart'); }
  // the fire escape down the back of the flats (the Bayview, the Coronado)
  const fe = prop('fireescape'); fe.position.set(BLOCK.frontW - 20, 0, L.escape); fe.rotation.y = -Math.PI / 2; add(fe, 'decal');
}

// ---------------------------------------------------------------------------------- night
// lamps' halos: additive quads turned to the camera (one instanced mesh for a block's), fogged
function haloMaterial(map, color) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: map }, uColor: { value: color }, uOpacity: { value: 0 } }]),
    fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mvPosition.xy += position.xy * length(instanceMatrix[0].xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(uColor * t.rgb, t.a * uOpacity);
        #ifdef USE_FOG // (faded by the haze: mixed toward its colour, an added glow would brighten with distance)
          #ifdef FOG_EXP2
            gl_FragColor.a *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            gl_FragColor.a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
      }`,
  });
}

// The lamps' pools of light on the pavements, a few real lights, the light from the shop windows
// across the pavement, the window neon; all faded in with `set(k)`
function nightKit(ctx, block, mats, lamps) {
  // (two groups: the outer one drawn by distance, the inner one only at night: by day the pools and
  // halos are at nothing, and still cost a draw call each)
  const group = new THREE.Group(), g = new THREE.Group();
  group.add(g);
  block.add(group);
  g.visible = false;
  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)');
  const pool = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.62, 0.46, 0.28), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const spill = new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.5, 0.45, 0.36), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  // (a wide, faint warm-sodium glow round each lamp's head, not a white flare: the polish pass, 2026-11-23; all of
  // them one instanced draw, each quad turned to the camera in its shader: a sprite each was a draw call each)
  const halo = haloMaterial(glowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.12)'), new THREE.Color(1.15, 0.62, 0.26));
  const haloAt = [];
  const lights = [];
  let n = 0;
  // (the pools and the shops' spill each one mesh: a plane each was 52 draw calls at night)
  const pools = [], spills = [];
  for (const l of ctx.lamps) {
    if (!l.street) continue;
    pools.push(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(l.at.x, BLOCK.pave + 0.01, l.at.z));
    haloAt.push(l.at.clone());
    // a real light under every third, in the scene's pool (city/Lamps.js): the nearest are lit
    if (n++ % 3 === 0 && lamps) { const mk = new THREE.Object3D(); mk.position.copy(l.at).add(V(0, -0.6, 0)); group.add(mk); lights.push(lamps.add(mk, { color: 0xffc98a, power: 0, reach: 20 })); }
  }
  for (const s of ctx.shops) {
    const w = s.u1 - s.u0, c = V((s.u0 + s.u1) / 2, 0, 2.2).applyMatrix4(s.F), N = V(0, 0, 1).transformDirection(s.F);
    spills.push(new THREE.PlaneGeometry(w + 1, 4.5).rotateX(-Math.PI / 2).rotateY(Math.atan2(N.x, N.z)).translate(c.x, BLOCK.pave + 0.012, c.z));
  }
  for (const [list, mat] of [[pools, pool], [spills, spill]]) if (list.length) g.add(new THREE.Mesh(mergeGeometries(list, false), mat));
  if (haloAt.length) {
    const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), halo, haloAt.length);
    haloAt.forEach((p, i) => halos.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), V(2.6, 2.6, 2.6))));
    halos.frustumCulled = false;
    halos.renderOrder = 3;
    g.add(halos);
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
  // (one glowing copy of each material, shared: a copy for every mesh kept them from being instanced, 36 draws)
  const tubes = [], glowing = new Map();
  for (const { o, kind } of ctx.objects) if (kind === 'decal') o.traverse((m) => {
    if (!m.isMesh || !/neon|Sonata|wire/i.test(`${m.material?.name}`)) return;
    let gm = glowing.get(m.material);
    if (!gm) {
      gm = m.material.clone();
      gm.emissive = (gm.color ?? new THREE.Color(1, 1, 1)).clone();
      glowing.set(m.material, gm);
      tubes.push(gm);
    }
    m.material = gm;
  });
  return {
    group,
    set(k) {
      g.visible = k > 0.01;
      pool.opacity = k; spill.opacity = k * 0.8; halo.uniforms.uOpacity.value = k * 0.42;
      for (const l of lights) l.power = k * 18; // (with a gentler falloff: Ferris's LampPool)
      for (const m of neonMats) m.color.setScalar(0.35 + k * 1.6); // (past the bloom's threshold: its halo)
      for (const m of tubes) m.emissiveIntensity = 0.4 + k * 1.6;
    },
  };
}
