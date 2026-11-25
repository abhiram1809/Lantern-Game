// Coast City's houses on their lots (the residential streets' rework, 2026-11-24: the user's "the neighborhood area
// of Hal Jordan's home needs change ... design the neighborhood to be extremely suitable for that area"). A Southern
// California beach town's streets as they'd stand in the late seventies, built over sixty years: Spanish Revival
// bungalows of the twenties (stucco, barrel-tile roofs, an arched picture window, an arched porch, iron at the
// windows), Craftsman bungalows (lap siding, a low front gable on brackets, the porch on tapered columns and brick
// piers, shakes), the postwar stucco boxes, the fifties' ranch houses (long and low, a shallow gable of shakes or a
// flat roof of white rock, the picture window, a brick planter, the two-car garage in front), and the apartments
// that filled lots in after them: two-storey stucco "dingbats" over their carports, a name in script across the
// front, and the bungalow courts, small cottages round a garden walk.
//
// Each block face has a style that leads it (a street was built a few at a time) and others among it; a corner lot
// turns its garage onto the side street; garages by the house, at the back of a long drive (two strips of concrete on
// the older lots), or onto the alley. The lots: lawns, hedges, low walls, picket fences and split rails, board fences
// between the back yards, a mailbox by the drive, cans out at the kerb, a car in some drives, the trees the town
// plants (palms, jacarandas in flower, ficus, a eucalyptus out back, citrus), porch lights at night; down the alleys
// the power poles and their wires. Everything a block's: into its Batch by material (Kit.js), its colliders into
// ctx.solids / pads / hulls, the small things the kit's (Stream.js placeKit: they snap and tumble), the cars Smash's.
//
// The frames: a lot's (`F`) has u along the street from the face's start, v in from the front line (as -z), y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, metreUV, hipRoof, gableRoof, wall, label } from './Building.js';
import { seeded } from './Plan.js';
import { groundAt } from './Layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _Y = V(0, 1, 0);
const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const ry = (a) => new THREE.Matrix4().makeRotationY(a);
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const range = (rnd, a, b) => a + rnd() * (b - a);
const weighted = (rnd, table) => {
  let t = 0; for (const k in table) t += table[k];
  let r = rnd() * t; for (const k in table) { r -= table[k]; if (r <= 0) return k; }
  return Object.keys(table)[0];
};
export const PAVE = 0.14, LAWN = 0.11;
// Many small pieces of one colour as one part of a block's batch (pickets, balusters, boards, wires): each part is
// handled on its own when a block's merged, and a material's mesh holds 600 at most (Stream.js), so a street of
// picket fences was a dozen draws of paint; bundled, it's one. `add` boxes (or any indexed geometry) in the frame
// they'll be added in, then `to(batch, key, F, color)`.
function bundle() {
  const list = [];
  return {
    add(g) { list.push(g.index ? g : g); return this; },
    geo() {
      if (!list.length) return null;
      const geo = list.length === 1 ? list[0] : mergeGeometries(list.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }), false);
      list.length = 0;
      return geo;
    },
    to(batch, key, F, color) { const geo = this.geo(); if (geo) batch.add(key, geo, F, color); },
  };
}

// ------------------------------------------------------------------------------------------------ the palettes
// (sRGB; the walls' textures lift them: Kit.js)
const PAL = {
  // limewash whites, creams, a warm sand, a pale rose; dark stained wood; the tiles' own reds, some weathered browner
  spanish: { walls: [0xf4efe4, 0xf2e8d2, 0xefe0c0, 0xebd6b0, 0xf1dcc4, 0xeed3c6, 0xf3ecd9, 0xe8dac4, 0xf6f1e6, 0xf0e4c8],
    trim: [0x4a3324, 0x3b2a1e, 0x2f4f4a, 0x5a3a22, 0x4a3324], doors: [0x5a3a22, 0x4a2e1c, 0x2f5a5a, 0x7a3a24, 0x2f4a6a, 0x4a2e1c],
    roof: [0xffffff, 0xf2dccc, 0xe8c6b2, 0xf8e6d6, 0xdcbca8, 0xffffff] },
  // the Craftsmen's earth colours: sage, olive, brown, ochre, slate, a deep green, cream, barn red, mustard
  craftsman: { walls: [0x9aa882, 0x8a8660, 0x8a6a50, 0xc9a262, 0x7a90a0, 0x667c62, 0xe6dcc0, 0x9a4c3c, 0xc0a468, 0xa8ae9e, 0x7a6a56, 0xb8b090],
    trim: [0xf0e8d2, 0xf6f2e6, 0x4a3324, 0xe8dcc0, 0x2f3a2a, 0xf0e8d2], doors: [0x6a3a22, 0x4a2e1c, 0x8a3a2a, 0x2f4a3a, 0x5a3a22],
    roof: [0xa89a88, 0x9a9a96, 0x8a7a68, 0xb4ac9c, 0x7e8476, 0x9a8c7c] },
  // the fifties' and sixties': mint, aqua, butter yellow, salmon, beige, white, powder blue, harvest gold, sand
  ranch: { walls: [0xd6e8dc, 0xc8e4e0, 0xf3e7b8, 0xf2ccb8, 0xe8dcc4, 0xf3f0e8, 0xd2dfeb, 0xe9cf98, 0xdccaa8, 0xf0e2c8, 0xe0e4d4, 0xf6efe0],
    trim: [0xf4f1ea, 0xf4f1ea, 0x4a3324, 0x3a3a38, 0xe8e0d0], doors: [0x2f8a8a, 0xd0782a, 0xd8a830, 0xa8321f, 0x2f4f7a, 0x5a3a22, 0xf2efe6, 0x3a6a4a],
    roof: [0xa89a88, 0x9c9a94, 0xb8ac98, 0x8a8278, 0xa8a49a] },
  // the postwar stucco boxes (the town's houses as they were)
  minimal: { walls: [0xead9bb, 0xe6b9a2, 0xecdcae, 0xf1e9d6, 0xf0cf7c, 0xd9d2c4, 0xc4dbd0, 0xf3f0e8, 0xf3c4d0, 0xb6cde0, 0xe8c2a4, 0xf0e2b6, 0xcfe3d4, 0xf2d0b4, 0xdfe8e4, 0xbfe3e0, 0xd8e8f5],
    trim: [0xf4f1ea, 0xece4d2, 0x5a4030, 0x2f4a3a, 0x8a5a3a, 0x3a4a6a, 0xf4f1ea], doors: [0x8a3a2a, 0x2f4a3a, 0x3a5a7a, 0xf2efe6, 0x6a4a2a, 0x1f3d5a, 0xb05a2a, 0x5a2a3a],
    roof: [0xffffff, 0xf2dccc, 0xe8c6b2] },
  dingbat: { walls: [0xf4f1ea, 0xeef2f0, 0xf6e9bc, 0xf3d6dc, 0xd8e6f2, 0xe6f0e4, 0xf2e4cc], accent: [0x2f8a8a, 0xd0567a, 0x3a6fb0, 0xc89a30, 0x6a4a9a, 0xb8322a, 0x2f6f4a] },
};
const STAIN = [0x8a6a4a, 0x7a6450, 0x9a8468, 0x6a5040, 0x8c7a66, 0xa08a6e]; // (board fences: redwood, weathered grey-brown)
const CARS = ['fairheaven', 'negotiator', 'sialia', 'fairheaven_sw'];
// (the late seventies' paints: brown, harvest gold, avocado, maroon, cream, baby blue, white, silver, burnt orange, navy)
const CAR_PAINT = [0x5a3a24, 0xc49a3a, 0x6a6e3a, 0x6a1f1c, 0xe2ddd0, 0x8aa8c8, 0xf0eee8, 0xa8aaa8, 0xb4582a, 0x1f2a4a, 0x2b4a3b, 0x8e8a7c, 0x7a2a2a];
const COURTS = ['VILLA ROSA', 'CASA LINDA', 'EL PATIO', 'LAS FLORES', 'MIRAMAR COURT', 'SAN MARCOS', 'LA PALOMA', 'CASA BLANCA'];
const DINGBATS = ['The Capri', 'Kona Kai', 'The Satellite', 'Sea Breeze', 'The Driftwood', 'Tahiti', 'The Starlite', 'Bel Air', 'The Waikiki', 'Casa Del Sol', 'The Riviera', 'Shore Haven'];

// the parkways' trees by street: the tall palms (the most), jacarandas, ficus, magnolias, sweetgums
const STREET_TREES = ['palm', 'jacaranda', 'palm', 'ficus', 'palm', 'magnolia', 'jacaranda', 'palm', 'liquidambar'];
export { treeOf };
// the lot widths (along the street) each style takes
const WIDTHS = { spanish: [13, 14, 14, 15, 16], craftsman: [12, 13, 14, 14, 15], ranch: [18, 19, 20, 21, 22], minimal: [15, 16, 17, 18], dingbat: [16, 17, 18], court: [24, 26, 27] };
// which styles a block's houses come in, by where it is: the older streets toward Old Town, the fifties' tracts east
// and south, the apartments nearer the boulevard and the shops
function styleMix(c) {
  const x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2;
  if (z < -615) return { ranch: 50, spanish: 16, minimal: 16, craftsman: 5, dingbat: 7, court: 3 }; // (Bayside, by the bay)
  if (z > 1470) return { spanish: 36, craftsman: 20, ranch: 22, minimal: 10, dingbat: 6, court: 4 }; // (Coast Heights)
  const old = 1 - Math.min(1, Math.max(0, (x + 150) / 650)); // (1 by Old Town, 0 out east)
  const nearBlvd = Math.abs(x - 6) < 180 ? 1 : 0;
  return { spanish: 20 + 18 * old, craftsman: 5 + 24 * old, ranch: 14 + 36 * (1 - old), minimal: 12, dingbat: 3 + 4 * nearBlvd, court: 2 + 4 * old };
}

// ------------------------------------------------------------------------------------------------ the plan
// A face of a block as lots, `deep` metres in from its front line (its back on the alley, or on Hal's blocks' wall:
// `alley` false), each with the specs of what's built on it (Building.js's, and this file's `garage` / `dingbat`)
export function planLots(c, side, { deep, alley = true } = {}) {
  const west = side === 'west', len = c.z1 - c.z0, yaw = west ? -Math.PI / 2 : Math.PI / 2;
  const rnd = seeded((c.seed ^ (west ? 0x51f3a : 0x7a21c)) >>> 0);
  const O = west ? { x: c.x0, z: c.z0 } : { x: c.x1, z: c.z1 }, A = west ? { x: 0, z: 1 } : { x: 0, z: -1 }, N = west ? { x: 1, z: 0 } : { x: -1, z: 0 };
  // (a face's start is its south end on a block's west side, its north end on the east: the side streets there)
  const ends = { start: west ? c.south : c.north, end: west ? c.north : c.south };
  const mix = styleMix(c), lead = weighted(rnd, mix);
  // the street's trees in its parkways: one kind down a street's length (the city planted them a street at a time)
  const k = west ? c.j : c.j + 1, streetTree = STREET_TREES[(((k * 7 + 3) % STREET_TREES.length) + STREET_TREES.length) % STREET_TREES.length];
  const spans = [];
  for (let u = 0; u < len - 0.5;) {
    let style = rnd() < 0.55 ? lead : weighted(rnd, mix), w = pick(rnd, WIDTHS[style]);
    if (len - u - w < 12) w = len - u; // (the last takes what's left)
    spans.push({ u0: u, w, style });
    u += w;
  }
  return spans.map((sp, i) => {
    const corner = i === 0 ? 'start' : i === spans.length - 1 ? 'end' : null;
    // (no court on a corner, nor on a lot too narrow for one; a lot left wide by the last span: its style's widest)
    if (sp.style === 'court' && (corner || sp.w < 22)) sp.style = 'spanish';
    if (sp.style === 'dingbat' && sp.w > 22) sp.style = 'ranch';
    const lot = { side, west, yaw, O, A, N, deep, alley, u0: sp.u0, w: sp.w, corner, sideStreet: corner ? !!ends[corner] : false, style: sp.style, seed: Math.floor(rnd() * 1e6), pw: k === 0 ? 5.5 : 5 };
    planLot(c, lot);
    // where its drive crosses the parkway, its street tree, the lamp on its line (Stream.js street, along the kerb)
    const zOf = (u) => lotPoint(lot, u, 0).z, dr = lot.drive && !lot.drive.side ? lot.drive : null;
    if (dr) { lot.driveZ = zOf((dr.ua + dr.ub) / 2); lot.driveW = dr.ub - dr.ua; }
    if (lot.style === 'dingbat') { lot.driveZ = zOf(lot.hu0 + lot.hw / 2); lot.driveW = lot.hw - 0.4; } // (its carports open across the front)
    const low = dr && dr.u < lot.u0 + lot.w / 2;
    lot.kerbZ = zOf(lot.style === 'dingbat' ? lot.u0 + lot.w - 1.2 : dr ? (low ? lot.u0 + lot.w * 0.7 : lot.u0 + lot.w * 0.3) : lot.u0 + lot.w * 0.5);
    lot.lineZ = zOf(low ? lot.u0 + lot.w - 0.6 : lot.u0 + 0.6);
    lot.kerbTree = lot.style === 'court' ? 'palm' : streetTree;
    lot.kerbPalm = lot.style === 'dingbat' ? false : rnd() < 0.82;
    // (on rising ground: the lot's terrace at the highest ground under it, all of it on that)
    let hi = 0;
    for (let uu = lot.u0; uu <= lot.u0 + lot.w + 0.01; uu += lot.w / 4) for (let vv = 0; vv <= deep + 0.01; vv += deep / 4) { const p = lotPoint(lot, uu, vv); hi = Math.max(hi, groundAt(p.x, p.z)); }
    lot.y = c.relief > 0.05 ? hi : 0;
    for (const s of lot.specs) s.at.y = lot.y;
    return lot;
  });
}
const lotPoint = (L, u, v) => ({ x: L.O.x + L.A.x * u + L.N.x * v, y: 0, z: L.O.z + L.A.z * u + L.N.z * v });
// a spec's `at` and `yaw` for a building whose front-left corner is at (u, v), turned `theta` from facing the street
const placed = (L, u, v, theta = 0) => ({ at: lotPoint(L, u, v), yaw: L.yaw + theta });

function planLot(c, L) {
  const rnd = seeded(L.seed), style = L.style, P = PAL[style] ?? PAL.minimal, { u0, w, deep } = L;
  L.specs = [];
  if (style === 'dingbat') return planDingbat(L, rnd);
  if (style === 'court') return planCourt(L, rnd);
  const color = pick(rnd, P.walls), trim = pick(rnd, P.trim), door = pick(rnd, P.doors);
  const old = style === 'spanish' || style === 'craftsman';
  // the garage: beside the house ('front'), at the back of a long drive ('back'), onto the alley, onto the side street
  // (a corner's), a carport, or none (the car at the kerb)
  let g;
  if (L.sideStreet && rnd() < 0.62) g = 'side';
  else if (style === 'ranch') g = rnd() < 0.68 ? 'front' : rnd() < 0.7 ? 'carport' : 'none';
  else if (style === 'minimal') g = pick(rnd, ['front', 'front', 'back', 'carport', 'back', 'none']);
  else g = L.alley && rnd() < 0.38 ? 'alley' : rnd() < 0.72 ? 'back' : rnd() < 0.5 ? 'front' : 'none';
  // (the drive along the side away from a corner's side street)
  let gSide = rnd() < 0.5 ? 0 : 1;
  if (L.corner === 'start') gSide = 1; else if (L.corner === 'end') gSide = 0;
  L.gSide = gSide;
  const edge = 0.9, along = g === 'front' || g === 'back' || g === 'carport';
  const twoCar = g === 'front' ? (style === 'ranch' ? rnd() < 0.75 : rnd() < 0.35) : g === 'alley' ? w > 13 && rnd() < 0.5 : g === 'side' ? rnd() < 0.5 : false;
  const gW = twoCar ? 6.2 : 3.7, gD = 6.6;
  const driveW = g === 'front' ? gW - 0.7 : 2.9;
  // the house's run along the street
  const sideL = L.corner === 'start' && L.sideStreet ? 2.6 : 1.4, sideR = L.corner === 'end' && L.sideStreet ? 2.6 : 1.4;
  let hu0, hw;
  if (g === 'front') { // (the garage beside it: a ranch's touching it, under the same roof line; the older houses' a step apart)
    const gap = style === 'ranch' || style === 'minimal' ? 0 : 1.2;
    hw = w - edge - gW - gap - (gSide ? sideL : sideR);
    hu0 = gSide ? u0 + sideL : u0 + edge + gW + gap;
  } else if (along) { // (the drive past it)
    hw = w - edge - driveW - 0.6 - (gSide ? sideL : sideR);
    hu0 = gSide ? u0 + sideL : u0 + edge + driveW + 0.6;
  } else { hw = w - sideL - sideR; hu0 = u0 + sideL; }
  // (a garage at the back of the drive stands beside the house's back corner: the house kept clear of it by its eaves)
  const overhang = { spanish: 0.4, craftsman: 0.8, ranch: 0.9, minimal: 0.5 }[style];
  if (g === 'back') {
    const need = 0.35 + 0.35 + overhang; // (the garage's wall out past the drive, the house's eave, a gap)
    if (gSide) hw -= need; else { hu0 += need; hw -= need; }
  }
  const maxW = { spanish: 12.5, craftsman: 11, ranch: 16.5, minimal: 13 }[style];
  if (hw > maxW) { const slack = hw - maxW; hw = maxW; hu0 += g === 'front' && gSide ? slack : g === 'front' ? 0 : slack * (along ? (gSide ? 0 : 1) : 0.5); }
  const setback = { spanish: range(rnd, 5.8, 7.4), craftsman: range(rnd, 6.6, 8.0), ranch: range(rnd, 7.4, 9.0), minimal: range(rnd, 5.8, 7.6) }[style];
  let hd = { spanish: range(rnd, 10, 12.4), craftsman: range(rnd, 11.2, 13.2), ranch: range(rnd, 8.8, 10.4), minimal: range(rnd, 9.6, 11.8) }[style];
  // (room behind it: for a garage on the alley or the side street, and a back yard)
  const backRoom = g === 'alley' ? gD + 2.2 : g === 'side' ? gW + 2.0 : 3.5;
  hd = Math.min(hd, deep - setback - backRoom);
  L.setback = setback; L.hu0 = hu0; L.hw = hw; L.hd = hd; L.g = g;
  // its door, windows and roof by its style
  const H = { spanish: 3.2, craftsman: 3.1, ranch: 2.8, minimal: 3.1 }[style];
  const house = { kind: 'building', lot: true, home: true, back: true, ...placed(L, hu0, setback), w: hw, d: hd, floors: 1, gh: H, fh: 2.9, parapet: 0,
    color, trim, frame: pick(rnd, [0xf4f1ea, 0xf4f1ea, trim]), bars: false, ac: 0.06, style, sides: { L: 'windows', R: 'windows' }, win: { w: 1.15, h: 1.35, sill: 0.95 } };
  // (a garage touching it: no windows on that side)
  if (g === 'front' && (style === 'ranch' || style === 'minimal')) house.sides[gSide ? 'R' : 'L'] = 'party';
  let doorU;
  const win = [];
  if (style === 'spanish') {
    // the roof: a gable along the front, a hip, or flat behind a parapet with a mission gable over the middle
    const r = rnd();
    Object.assign(house, r < 0.5 ? { roof: 'gable', ridge: 'x', pitch: range(rnd, 0.32, 0.4), eave: 0.32, rake: 0.18, roofMat: 'roofTile' }
      : r < 0.78 ? { roof: 'hip', pitch: range(rnd, 0.34, 0.42), eave: 0.35, roofMat: 'roofTile' }
        : { parapet: range(rnd, 0.7, 1.0), coping: 'tile', gable: rnd() < 0.6 ? { width: range(rnd, 0.42, 0.58), rise: range(rnd, 0.9, 1.3) } : undefined, rooftop: { condensers: 0, dish: false, aerial: true }, flatColor: 0x8a847a });
    house.roofColor = pick(rnd, P.roof);
    house.fascia = 0x4a3324;
    // the arched picture window (three lights), a smaller arched or square one, the door arched in its own reveal
    const picL = gSide ? hw * 0.3 : hw * 0.68;
    doorU = gSide ? hw * range(rnd, 0.66, 0.78) : hw * range(rnd, 0.22, 0.34);
    win.push({ u: picL, w: range(rnd, 2.0, 2.5), h: 1.95, v: 0.7, arch: 1.0, pic: true, bars: false });
    const other = gSide ? hw * 0.9 : hw * 0.1;
    if (Math.abs(other - doorU) > 1.6 && hw > 9) win.push({ u: other, w: 0.9, h: 1.4, v: 1.0, arch: rnd() < 0.5 ? 0.45 : 0, bars: rnd() < 0.5 });
    house.entries = [{ x: doorU, v: 0.27, w: 1.15, h: 2.4, arch: 0.58, color: door, frame: trim }]; // (its sill at the front step's top)
    house.win = { w: 1.0, h: 1.3, sill: 1.0, arch: rnd() < 0.35 ? 0.4 : 0 };
    house.bars = rnd() < 0.3;
    // a front gable wing on some (an L), the picture window in it
    if (house.roof === 'gable' && hw > 9.5 && rnd() < 0.55) L.wing = { u: gSide ? 0.2 : hw - 5.4, w: 5.2, out: range(rnd, 2.2, 3.0) };
    house.chimney = rnd() < 0.55 ? { side: gSide ? -1 : 1, stucco: true } : undefined;
    house.vents = house.roof === 'gable';
    // an arched porch before the door on some (not with a wing: the wing's the front's own projection)
    if (!L.wing && rnd() < 0.45) { L.porch = { kind: 'arch', w: 2.5, d: 1.6 }; house.entries[0].lamp = false; }
  } else if (style === 'craftsman') {
    Object.assign(house, { wall: 'siding', roof: 'gable', ridge: 'z', pitch: range(rnd, 0.42, 0.52), eave: 0.75, rake: 0.6, roofMat: 'shake', roofColor: pick(rnd, P.roof), fascia: trim });
    doorU = gSide ? hw * 0.62 : hw * 0.38;
    // the windows in threes, their upper sashes in lights
    // (the house up on its crawlspace: its door at the porch floor, its sills over the porch rail)
    for (const s of [-1, 1]) { const cu = doorU + s * hw * 0.27; for (const k of [-1, 0, 1]) win.push({ u: cu + k * 0.98, w: 0.86, h: 1.45, v: 1.12, lites: 3, bars: false }); }
    house.entries = [{ x: doorU, v: 0.55, w: 1.05, h: 2.15, color: door, frame: trim, lamp: false }];
    house.win = { w: 0.95, h: 1.45, sill: 0.95 };
    house.chimney = rnd() < 0.6 ? { side: gSide ? -1 : 1, brick: true } : undefined;
    house.gableVent = true;
    L.porch = { kind: 'craftsman', w: Math.min(hw - 0.6, range(rnd, 6.5, 9.5)), d: 2.6 };
  } else if (style === 'ranch') {
    const r = rnd();
    Object.assign(house, r < 0.58 ? { roof: 'gable', ridge: 'x', pitch: range(rnd, 0.2, 0.27), eave: 0.85, rake: 0.55 } : r < 0.82 ? { roof: 'hip', pitch: range(rnd, 0.24, 0.3), eave: 0.75 } : { roof: 'slab', eave: 0.9 });
    // (shakes, or barrel tiles, or the sixties' white rock on a low roof)
    const rm = rnd();
    house.roofMat = house.roof === 'slab' || rm > 0.8 ? 'roofing' : rm < 0.6 ? 'shake' : 'roofTile';
    house.roofColor = house.roofMat === 'roofing' ? 0xd8d4cc : house.roofMat === 'shake' ? pick(rnd, P.roof) : pick(rnd, PAL.spanish.roof);
    house.fascia = pick(rnd, [0xf4f1ea, 0x4a3324, trim]);
    if (rnd() < 0.3) house.wall = 'siding';
    doorU = gSide ? hw * 0.34 : hw * 0.66;
    // the picture window, the bedrooms' high windows along the other end
    const picU = gSide ? hw * 0.62 : hw * 0.36;
    win.push({ u: picU, w: range(rnd, 2.8, 3.5), h: 1.5, v: 0.82, pic: true, bars: false });
    const n = hw > 13 ? 2 : 1;
    for (let k = 0; k < n; k++) { const u = gSide ? hw * (0.12 + 0.12 * k) : hw * (0.88 - 0.12 * k); if (Math.abs(u - doorU) > 1.4 && Math.abs(u - picU) > 2.4) win.push({ u, w: 1.5, h: 0.95, v: 1.3, bars: false }); }
    house.entries = [{ x: doorU, v: 0.25, w: 1.0, h: 2.05, color: door, frame: trim }];
    house.win = { w: 1.4, h: 0.95, sill: 1.3 };
    house.wainscot = rnd() < 0.5 ? { h: 0.75, mat: rnd() < 0.7 ? 'brick' : 'stucco', color: rnd() < 0.7 ? 0xffffff : 0xd8cfc0, skip: [doorU] } : undefined;
    house.chimney = rnd() < 0.45 ? { side: gSide ? 1 : -1, brick: true, low: true } : undefined;
    L.porch = rnd() < 0.45 ? { kind: 'ranch', u0: Math.max(0.4, doorU - range(rnd, 1.6, 2.6)), u1: Math.min(hw - 0.4, doorU + range(rnd, 1.6, 3.2)), d: 1.9 } : null;
    L.planter = !house.wainscot && rnd() < 0.5;
  } else {
    // the postwar box: a hip or a gable, tiles or shakes, the door in the middle third, plain windows
    Object.assign(house, rnd() < 0.7 ? { roof: 'hip', pitch: range(rnd, 0.36, 0.48), eave: 0.45 } : { roof: 'gable', ridge: 'x', pitch: range(rnd, 0.36, 0.45), eave: 0.45, rake: 0.3 });
    house.roofMat = rnd() < 0.6 ? 'roofTile' : 'shake';
    house.roofColor = house.roofMat === 'shake' ? pick(rnd, PAL.craftsman.roof) : pick(rnd, P.roof);
    doorU = gSide ? hw * range(rnd, 0.55, 0.7) : hw * range(rnd, 0.3, 0.45);
    const bays = Math.max(2, Math.round(hw / 3.1));
    for (let k = 0; k < bays; k++) { const u = (hw * (k + 0.5)) / bays; if (Math.abs(u - doorU) > 1.5) win.push({ u, w: 1.3, h: 1.3, v: 0.95 }); }
    house.entries = [{ x: doorU, v: 0.27, w: 1.1, h: 2.15, color: door }];
    house.win = { w: 1.3, h: 1.3, sill: 0.95 };
    house.bars = rnd() < 0.12;
    house.chimney = rnd() < 0.35 ? { side: gSide ? -1 : 1, brick: rnd() < 0.5 } : undefined;
    L.porch = rnd() < 0.4 ? { kind: 'hood' } : null;
    L.shutters = rnd() < 0.35 ? pick(rnd, [0x2f4a3a, 0x3a4a6a, 0x5a3a2a, 0xf4f1ea]) : null;
  }
  house.groundWindows = win;
  house.bays = 1;
  L.doorU = doorU; L.house = house;
  L.specs.push(house);
  // the wing forward of a Spanish house's front: its own little front-gabled box, the picture window in it
  if (L.wing) {
    const W = L.wing, hwg = W.w;
    // (its roof runs back until its ridge is under the house's front slope: from there the house's roof covers it,
    // the two meeting in valleys, as an L's do)
    const pw = house.pitch + 0.08, into = ((hwg / 2) * pw) / house.pitch + 0.4;
    const wing = { kind: 'building', lot: true, home: true, back: false, ...placed(L, hu0 + W.u, setback - W.out), w: hwg, d: W.out + into, floors: 1, gh: house.gh, parapet: 0,
      color, trim, frame: house.frame, roof: 'gable', ridge: 'z', pitch: pw, eave: 0.3, rake: 0.18, roofMat: 'roofTile', roofColor: house.roofColor, fascia: house.fascia,
      sides: { L: 'party', R: 'party' }, win: house.win, groundWindows: [{ u: hwg / 2, w: 2.1, h: 1.95, v: 0.7, arch: 1.0, pic: true, bars: false }], style, wingOf: house, vents: true };
    // (the house's own picture window moves off the wing's span, behind it)
    house.groundWindows = win.filter((o) => o.u < W.u - 0.8 || o.u > W.u + W.w + 0.8);
    if (!house.groundWindows.some((o) => o.pic)) house.groundWindows.push({ u: W.u > hw / 2 ? W.u - 1.6 : W.u + W.w + 1.6, w: 1.0, h: 1.4, v: 1.0, arch: 0.45 });
    L.specs.push(wing);
  }
  // the garage, by where it goes
  if (g === 'front' || g === 'back' || g === 'alley' || g === 'side') {
    let gu, gv, theta = 0;
    if (g === 'front') { gu = gSide ? u0 + w - edge - gW : u0 + edge; gv = style === 'ranch' ? Math.max(5.6, setback - range(rnd, 0, 1.6)) : Math.max(5.6, setback + (rnd() < 0.5 ? -1.0 : 0.6)); }
    else if (g === 'back') { gu = gSide ? u0 + w - edge - gW + 0.35 : u0 + edge - 0.35; gv = deep - gD - 0.8; }
    else if (g === 'alley') { gu = gSide ? u0 + w - 1.0 : u0 + 1.0 + gW; gv = deep - 0.35; theta = Math.PI; } // (`at`: its front-left corner, seen from the alley)
    else { // the side street's: the door onto it, at the lot's back corner
      const vb = deep - 0.8;
      if (L.corner === 'start') { gu = u0 + 5.6; gv = vb; theta = -Math.PI / 2; }
      else { gu = u0 + w - 5.6; gv = vb - gW; theta = Math.PI / 2; }
    }
    const roofed = house.roof === 'slab' ? { roof: 'slab', eave: 0.5, roofColor: house.roofColor, fascia: house.fascia }
      : house.roof === 'gable' || style === 'craftsman' ? { roof: 'gable', ridge: g === 'side' ? 'x' : style === 'craftsman' ? 'z' : 'x', pitch: Math.min(0.42, house.pitch ?? 0.36), eave: 0.35, rake: 0.25, roofMat: house.roofMat ?? 'roofTile', roofColor: house.roofColor, fascia: house.fascia }
        : { roof: 'hip', pitch: Math.min(0.36, house.pitch ?? 0.32), eave: 0.4, roofMat: house.roofMat ?? 'roofTile', roofColor: house.roofColor, fascia: house.fascia };
    if (!house.roof) Object.assign(roofed, { roof: undefined, parapet: 0.45, coping: 'tile' }); // (a flat Spanish house's: a parapet and tiles)
    const gs = { kind: 'garage', lot: true, ...placed(L, gu, gv, theta), w: gW, d: gD, gh: style === 'ranch' ? house.gh : 2.85, floors: 1, ...roofed, wall: house.wall, color,
      trim: house.trim, door: pick(rnd, style === 'craftsman' ? [0x8a6a4a, 0x6a5040, 0xe8dcc0] : [0xf2efe6, 0xe8e0d0, 0x8a6a4a, 0xf2efe6, 0x6a5a4a]), doorKind: style === 'craftsman' || style === 'spanish' ? 'carriage' : 'panel' };
    L.specs.push(gs);
    L.garage = { u: gu, v: gv, w: gW, d: gD, theta, spec: gs, hoop: g === 'front' && rnd() < 0.18 };
  }
  // the drive: its run (u along, v in), two strips on most of the older lots
  if (along || g === 'side') {
    const strips = old && g !== 'side' && rnd() < 0.6;
    if (g === 'side') {
      const gg = L.garage, a = L.corner === 'start' ? u0 : gg.u, b = L.corner === 'start' ? gg.u : u0 + w, v0 = L.corner === 'start' ? gg.v - gW + 0.35 : gg.v + 0.35;
      L.drive = { ua: a, ub: b, va: v0, vb: v0 + gW - 0.7, side: true };
    } else {
      const du = g === 'front' ? L.garage.u + gW / 2 : gSide ? u0 + w - edge - driveW / 2 : u0 + edge + driveW / 2;
      const v1 = g === 'front' || g === 'back' ? L.garage.v : setback + hd - 0.5;
      L.drive = { ua: du - driveW / 2, ub: du + driveW / 2, va: 0, vb: v1, strips, u: du };
    }
  }
  // a carport: a flat roof on posts over the drive beside the house
  if (g === 'carport') L.carport = { u0: L.drive.ua - 0.15, u1: L.drive.ub + 0.15, v0: setback + 0.6, v1: setback + 6.4 };
  // a car in some drives (and under some carports), parked nose in
  const room = L.drive && (L.drive.side ? L.drive.ub - L.drive.ua : L.drive.vb - L.drive.va);
  if (L.drive && room > 6.2 && rnd() < (g === 'carport' ? 0.4 : 0.24)) {
    const model = pick(rnd, CARS), paint = pick(rnd, CAR_PAINT);
    if (L.drive.side) {
      const u = L.corner === 'start' ? L.drive.ub - 3.0 : L.drive.ua + 3.0, v = (L.drive.va + L.drive.vb) / 2;
      L.car = { u, v, theta: L.corner === 'start' ? Math.PI / 2 : -Math.PI / 2, model, paint }; // (nose in, toward the garage)
    } else {
      const v = g === 'carport' ? (L.carport.v0 + L.carport.v1) / 2 : Math.max(2.9, L.drive.vb - 3.1);
      L.car = { u: L.drive.u, v, theta: Math.PI + (rnd() - 0.5) * 0.04, model, paint };
    }
  }
  // the garden
  L.front = pick(rnd, {
    spanish: ['open', 'open', 'wall', 'wall', 'hedge', 'iron'], craftsman: ['open', 'open', 'picket', 'picket', 'hedge', 'brick'],
    ranch: ['open', 'open', 'open', 'rail', 'rail', 'hedge', 'brick'], minimal: ['open', 'picket', 'hedge', 'wall', 'open', 'rail'] }[style]);
  L.wallColor = rnd() < 0.6 ? color : 0xf2ede2;
  L.fence = rnd() < (style === 'ranch' ? 0.45 : 0.25) ? 'block' : 'wood';
  L.stain = pick(rnd, STAIN);
  L.tree = pick(rnd, { spanish: ['palm', 'palm2', 'citrus', 'jacaranda', 'none', 'olive'], craftsman: ['oak', 'oak', 'magnolia', 'jacaranda', 'none'],
    ranch: ['jacaranda', 'ficus', 'palm2', 'none', 'citrus', 'liquidambar', 'palm'], minimal: ['palm', 'citrus', 'oak', 'none', 'jacaranda'] }[style]);
  L.backTree = pick(rnd, ['avocado', 'citrus', 'eucalyptus', 'none', 'oak', 'none']);
  L.cypress = style === 'spanish' && rnd() < 0.25;
  L.shrubs = 2 + Math.floor(rnd() * 4);
  L.bloom = rnd() < 0.5 ? pick(rnd, [[2.3, 0.55, 1.6], [2.5, 0.62, 0.6], [2.1, 1.7, 0.45], [2.4, 0.9, 1.9]]) : null;
  L.pool = deep - (setback + hd) > 7 && g !== 'alley' && g !== 'side' && rnd() < 0.35;
  L.mailbox = style !== 'spanish' || rnd() < 0.5; // (the old houses' are in the porch wall)
  L.cans = L.drive && !L.drive.side && rnd() < 0.3;
  L.lawn = pick(rnd, [[1.32, 1.36, 1.06], [1.45, 1.38, 0.96], [1.2, 1.3, 1.02], [1.7, 1.45, 0.86], [1.36, 1.4, 1.1]]); // (watered, some drier)
}

// A dingbat: two storeys of stucco over its carports, its stair up the side to the walkway, a name across the front
// in script and a starburst beside it, the flat roof's lip out over the front
function planDingbat(L, rnd) {
  const { u0, w, deep } = L, P = PAL.dingbat;
  const setback = range(rnd, 2.2, 3.2), d = Math.min(deep - setback - 3.5, range(rnd, 16, 18)), bw = w - 3.4, bu = u0 + 0.9;
  const color = pick(rnd, P.walls), accent = pick(rnd, P.accent);
  const bays = Math.max(3, Math.floor(bw / 2.9));
  const s = { kind: 'dingbat', lot: true, ...placed(L, bu, setback), w: bw, d, gh: 2.75, upper: 3.0, floors: 2, color, accent, trim: 0xf4f1ea, frame: pick(rnd, [0xd8dcdc, 0x2a2a2a, 0xf4f1ea]),
    bays, name: pick(rnd, DINGBATS), font: pick(rnd, ['script', 'script', 'deco']), stair: 'right', seed: Math.floor(rnd() * 1e6), parapet: 0.45, roofColor: 0xa8a49a };
  L.setback = setback; L.hu0 = bu; L.hw = bw; L.hd = d; L.g = 'carports'; L.house = s; L.doorU = bw - 0.8;
  L.specs.push(s);
  // its cars under it, most bays taken
  L.cars = [];
  for (let i = 0; i < bays; i++) if (rnd() < 0.36) L.cars.push({ u: bu + (bw * (i + 0.5)) / bays, v: setback + 2.8 + (rnd() - 0.5) * 0.3, theta: Math.PI + (rnd() - 0.5) * 0.03, model: pick(rnd, CARS), paint: pick(rnd, CAR_PAINT) });
  L.front = 'apron';
  L.fence = 'block'; L.wallColor = 0xe8e2d6; L.stain = pick(rnd, STAIN);
  L.tree = rnd() < 0.6 ? 'palm2' : 'none'; L.backTree = 'none'; L.shrubs = 0;
  L.lawn = [1.3, 1.34, 1.04];
  L.mailbox = false;
}

// A bungalow court: two rows of little Spanish cottages facing each other across a garden walk, a wall along the
// street with an arched gateway and the court's name over it
function planCourt(L, rnd) {
  const { u0, w, deep } = L, P = PAL.spanish;
  const cd = 6.0, row = 3, gap = 0.9, cw = Math.min(6.6, (deep - 3.4 - (row - 1) * gap) / row);
  const color = pick(rnd, P.walls), trim = pick(rnd, P.trim), roofColor = pick(rnd, P.roof), flat = rnd() < 0.4;
  L.setback = 1.2; L.hu0 = u0 + 1.0; L.hw = w - 2; L.hd = deep - 2.5; L.g = 'none';
  L.cottages = [];
  for (const s of [0, 1]) for (let k = 0; k < row; k++) {
    const vA = 2.6 + k * (cw + gap), vB = vA + cw;
    // (the west row faces +u across the walk, the east row -u: each one's front-left corner as it faces)
    const p = s === 0 ? placed(L, u0 + 1.0 + cd, vA, Math.PI / 2) : placed(L, u0 + w - 1.0 - cd, vB, -Math.PI / 2);
    const doorX = cw * (k % 2 ? 0.32 : 0.68);
    const spec = { kind: 'building', lot: true, home: true, back: true, ...p, w: cw, d: cd, floors: 1, gh: 3.0, parapet: 0, color: k % 2 && rnd() < 0.5 ? pick(rnd, P.walls) : color, trim,
      frame: 0xf4f1ea, style: 'spanish', sides: { L: 'windows', R: 'windows' }, win: { w: 0.95, h: 1.25, sill: 1.05, arch: 0.4 },
      entries: [{ x: doorX, v: 0.12, w: 1.0, h: 2.35, arch: 0.5, color: pick(rnd, P.doors), frame: trim }], groundWindows: [{ u: doorX > cw / 2 ? cw * 0.26 : cw * 0.74, w: 1.5, h: 1.6, v: 0.85, arch: 0.75, pic: true }],
      ...(flat ? { parapet: 0.6, coping: 'tile', rooftop: { condensers: 0, dish: false, aerial: rnd() < 0.5 } } : { roof: rnd() < 0.5 ? 'hip' : 'gable', ridge: 'x', pitch: 0.36, eave: 0.3, rake: 0.18, roofMat: 'roofTile', roofColor }), fascia: 0x4a3324, bays: 1 };
    L.specs.push(spec);
    L.cottages.push({ spec, s, vA, vB, doorX });
  }
  L.court = { walk: [u0 + 1.0 + cd + 0.4, u0 + w - 1.0 - cd - 0.4], name: pick(rnd, COURTS), color, trim };
  L.front = 'court'; L.fence = 'block'; L.wallColor = color; L.stain = pick(rnd, STAIN);
  L.tree = 'none'; L.backTree = 'none'; L.shrubs = 0; L.mailbox = false;
  L.lawn = [1.3, 1.36, 1.04];
}

// ------------------------------------------------------------------------------------------------ the house's extras
// What a house wears outside its walls and roof (Stream.buildCell, after building()): its chimney, a ranch's brick
// wainscot, the vents in a gable, shutters, a TV aerial on the roof. In its own frame (`M`, building()'s).
export function homeExtras(ctx, b, s) {
  const { batch } = ctx, M = b.M, H = b.H, q = new THREE.Quaternion().setFromRotationMatrix(M);
  const solid = (x0, y0, z0, x1, y1, z1, stuff = 'stone') => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q, stuff });
  const pitch = s.pitch ?? 0.42, ridgeH = s.roof === 'hip' ? H + 0.05 + ((s.d + 2 * (s.eave ?? 0.45)) / 2) * pitch : s.roof === 'gable' ? H + (s.ridge === 'z' ? s.w : s.d) / 2 * pitch + 0.16 : H + 0.3;
  if (s.chimney) {
    const c = s.chimney, u = c.side < 0 ? -0.55 : s.w + 0.55, z0 = -s.d * 0.5 - 0.6, z1 = z0 + 1.2;
    const top = c.low ? H + 1.3 : ridgeH + 0.55, key = c.brick ? 'brick' : 'stucco', col = c.brick ? 0xffffff : s.color;
    batch.add(key, box(u - 0.5, -0.1, z0, u + 0.5, H - 0.6, z1), M, col);
    batch.add(key, box(u - 0.32, H - 0.6, z0 + 0.25, u + 0.32, top, z1 - 0.25), M, col);
    batch.add('concrete', box(u - 0.5, H - 0.68, z0 - 0.02, u + 0.5, H - 0.6, z1 + 0.02), M, 0x9a948a); // (its shoulder)
    if (c.stucco) { // a Spanish chimney's cap: a little tiled hood on posts
      batch.add('stucco', box(u - 0.4, top, z0 + 0.17, u + 0.4, top + 0.08, z1 - 0.17), M, col);
      for (const [a, b2] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) batch.add('stucco', box(u + a - 0.06, top + 0.08, (z0 + z1) / 2 + b2 * 0.7 - 0.06, u + a + 0.06, top + 0.38, (z0 + z1) / 2 + b2 * 0.7 + 0.06), M, col);
      batch.add('roofTile', box(u - 0.45, top + 0.38, z0 + 0.1, u + 0.45, top + 0.48, z1 - 0.1), M, s.roofColor ?? 0xffffff);
    } else batch.add('concrete', box(u - 0.4, top, z0 + 0.17, u + 0.4, top + 0.1, z1 - 0.17), M, 0x8a847c);
    solid(u - 0.5, -0.1, z0, u + 0.5, H - 0.6, z1);
    solid(u - 0.32, H - 0.6, z0 + 0.25, u + 0.32, top, z1 - 0.25);
  }
  // a ranch's wainscot along its front: brick (or a stucco band), a cap, open at the door
  if (s.wainscot) {
    const W = s.wainscot, cuts = [...(s.entries ?? []).map((e) => [e.x - e.w / 2 - 0.12, e.x + e.w / 2 + 0.12])].sort((a, b2) => a[0] - b2[0]);
    let u = -0.02;
    const run = (a, b2) => { if (b2 - a < 0.2) return; batch.add(W.mat, box(a, 0, 0, b2, W.h, 0.1), M, W.color); batch.add('concrete', box(a - 0.02, W.h, -0.01, b2 + 0.02, W.h + 0.05, 0.14), M, 0xd8d0c2); };
    for (const [a, b2] of cuts) { run(u, a); u = Math.max(u, b2); }
    run(u, s.w + 0.02);
  }
  // the vents high in a gable: a louvred rectangle under a front gable, three clay pipes in a Spanish one
  if (s.gableVent && s.roof === 'gable' && s.ridge === 'z') {
    const yV = H + (s.w / 2) * pitch * 0.45;
    batch.add('paint', box(s.w / 2 - 0.45, yV - 0.25, 0, s.w / 2 + 0.45, yV + 0.25, 0.05), M, s.trim ?? 0xf0e8d2);
    for (let k = 0; k < 5; k++) batch.add('paint', box(s.w / 2 - 0.36, yV - 0.19 + k * 0.085, 0.03, s.w / 2 + 0.36, yV - 0.16 + k * 0.085, 0.07), M, 0x2a2520);
    // the brackets under the rakes (the knee braces a Craftsman's gable sits on)
    const e = s.rake ?? 0.6;
    for (const x of [0.05, s.w - 0.05]) for (const zz of [-0.2, -s.d + 0.2]) {
      batch.add('paint', box(x - 0.06, H - 0.35, zz - 0.06, x + 0.06, H, zz + 0.06).translate(0, 0, 0), M, s.fascia ?? 0x4a3324);
      batch.add('paint', box(x < s.w / 2 ? x - e + 0.05 : x, H - 0.08, zz - 0.05, x < s.w / 2 ? x : x + e - 0.05, H + 0.02, zz + 0.05), M, s.fascia ?? 0x4a3324);
    }
  }
  if (s.vents && s.roof === 'gable') { // (three clay pipes laid through the gable's wall, their mouths just proud of it)
    const pipe = () => new THREE.CylinderGeometry(0.075, 0.075, 0.34, 8, 1, true);
    if (s.ridge === 'z') { const yV = H + (s.w / 2) * pitch * 0.45; for (const k of [-1, 0, 1]) batch.add('roofTile', metreUV(pipe().rotateX(Math.PI / 2).translate(s.w / 2 + k * 0.2, yV - Math.abs(k) * 0.12, -0.1)), M, s.roofColor ?? 0xffffff); }
    else for (const x of [0.1, s.w - 0.1]) { const yV = H + (s.d / 2) * pitch * 0.45; for (const k of [-1, 0, 1]) batch.add('roofTile', metreUV(pipe().rotateZ(Math.PI / 2).translate(x + (x < 1 ? -0.2 : 0.2), yV - Math.abs(k) * 0.12, -s.d / 2 + k * 0.2)), M, s.roofColor ?? 0xffffff); }
  }
  // shutters either side of the front windows (a postwar box's)
  if (s.shutters) for (const g of s.groundWindows ?? []) {
    const o = typeof g === 'number' ? { u: g, w: s.win.w, h: s.win.h, v: 0.95 } : g;
    const B = bundle();
    for (const side of [-1, 1]) {
      const x = o.u + side * (o.w / 2 + 0.28);
      batch.add('paint', box(x - 0.24, o.v ?? 0.95, 0.0, x + 0.24, (o.v ?? 0.95) + Math.min(o.h, s.gh - 1.3), 0.05), M, s.shutters);
      for (let k = 1; k < 6; k++) B.add(box(x - 0.2, (o.v ?? 0.95) + (k * Math.min(o.h, s.gh - 1.3)) / 6 - 0.012, 0.05, x + 0.2, (o.v ?? 0.95) + (k * Math.min(o.h, s.gh - 1.3)) / 6 + 0.012, 0.065));
    }
    B.to(batch, 'paint', M, new THREE.Color(s.shutters).multiplyScalar(0.8));
  }
  // the TV aerial on its mast, on most houses
  if (!s.wingOf && (s.aerial ?? true) && s.roof !== 'slab' && ctx.rnd() < 0.7) {
    const u = s.w * (0.2 + ctx.rnd() * 0.6), z = s.roof === 'gable' && s.ridge !== 'z' ? -s.d / 2 : -s.d * 0.62, y0 = roofY(s, H, u, z) - 0.25; // (its foot in the roof)
    const B = bundle().add(cyl(0.022, 2.6, u, y0, z, 6));
    for (let k = 0; k < 5; k++) B.add(box(u - 0.012, y0 + 1.9 + k * 0.12, z - 0.7 + k * 0.06, u + 0.012, y0 + 1.915 + k * 0.12, z + 0.7 - k * 0.06));
    B.to(batch, 'metal', M, 0x9a9a96);
  }
}

// the height of a house's roof over (u, z) in its frame (its top surface: building()'s hip and gable roofs; a flat
// roof's deck)
function roofY(s, H, u, z) {
  const p = s.pitch ?? 0.42, d = -z;
  if (s.roof === 'hip') { const o = s.eave ?? 0.45; return H + 0.05 + p * Math.min(u + o, s.w + o - u, d + o, s.d + o - d); }
  if (s.roof === 'gable') return H + 0.16 + p * (s.ridge === 'z' ? Math.min(u, s.w - u) : Math.min(d, s.d - d));
  return H + 0.03;
}

// ------------------------------------------------------------------------------------------------ the garages
// A garage (Stream.buildCell, as the kit builds the house): its walls (the house's stucco or siding), the door in its
// opening (painted panels, or a carriage door's boards), a lamp beside it, the house's roof over it. The kit's
// building frame: its front along +x from `at`, facing +z, its body behind.
export function garage(ctx, s) {
  const M = new THREE.Matrix4().makeTranslation(s.at.x, s.at.y ?? 0, s.at.z).multiply(new THREE.Matrix4().makeRotationY(s.yaw));
  const { batch } = ctx, w = s.w, d = s.d, h = s.gh, t = 0.25, dh = 2.25, pier = Math.min(0.35, (w - 2.6) / 2 + 0.1), mat = s.wall ?? 'stucco';
  const par = s.roof ? 0 : s.parapet ?? 0, top = h + par;
  batch.add(mat, box(0, 0, -t, pier, top, 0), M, s.color);
  batch.add(mat, box(w - pier, 0, -t, w, top, 0), M, s.color);
  batch.add(mat, box(pier, dh, -t, w - pier, top, 0), M, s.color);
  // (the side walls rise to a gable along the front)
  if (s.roof === 'gable' && s.ridge !== 'z') {
    const p = s.pitch ?? 0.36, side = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(d - t, 0), new THREE.Vector2(d - t, h), new THREE.Vector2((d - t) / 2, h + ((d - t) / 2) * p), new THREE.Vector2(0, h)]);
    for (const x of [0, w - t]) { // (the shape's x runs back from the front, its extrusion across the wall's thickness)
      const g = new THREE.ExtrudeGeometry(side, { depth: t, bevelEnabled: false, curveSegments: 1 });
      g.rotateY(Math.PI / 2).translate(x, 0, -t);
      batch.add(mat, metreUV(g), M, s.color);
    }
  } else {
    batch.add(mat, box(0, 0, -d, t, top, -t), M, s.color);
    batch.add(mat, box(w - t, 0, -d, w, top, -t), M, s.color);
  }
  if (s.roof === 'gable' && s.ridge === 'z') { // (the front and back walls rise to it)
    const p = s.pitch ?? 0.36, tri = new THREE.Shape([new THREE.Vector2(0, h), new THREE.Vector2(w, h), new THREE.Vector2(w / 2, h + (w / 2) * p)]);
    for (const z of [0, -d + t]) { const g = new THREE.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, z - t); batch.add(mat, metreUV(g), M, s.color); }
  }
  batch.add(mat, box(t, 0, -d, w - t, top, -d + t), M, s.color);
  // the door
  const col = s.door ?? 0xf2efe6, groove = new THREE.Color(col).multiplyScalar(0.62);
  batch.add('paint', box(pier, 0.02, -t + 0.04, w - pier, dh, -t + 0.08), M, col);
  if (s.doorKind === 'carriage') { // boards, a cross brace in each leaf, and its row of little windows
    const n = Math.round((w - 2 * pier) / 0.16), Bg = bundle(), Bb = bundle();
    for (let k = 1; k < n; k++) { const u = pier + (k * (w - 2 * pier)) / n; Bg.add(box(u - 0.008, 0.05, -t + 0.08, u + 0.008, dh - 0.03, -t + 0.083)); }
    Bg.to(batch, 'paint', M, groove);
    const leaves = w > 5 ? 4 : 2, lw = (w - 2 * pier) / leaves;
    for (let k = 0; k < leaves; k++) {
      const a = pier + k * lw;
      for (const y of [0.25, dh - 0.55]) Bb.add(box(a + 0.06, y, -t + 0.08, a + lw - 0.06, y + 0.1, -t + 0.1));
      const brace = new THREE.BoxGeometry(Math.hypot(lw - 0.2, dh - 1.0), 0.09, 0.02);
      brace.rotateZ(Math.atan2(dh - 1.0, lw - 0.2) * (k % 2 ? 1 : -1)).translate(a + lw / 2, 0.3 + (dh - 0.85) / 2, -t + 0.095);
      Bb.add(metreUV(brace));
      batch.add('glass', new THREE.PlaneGeometry(lw - 0.3, 0.32).translate(a + lw / 2, dh - 0.28, -t + 0.085), M, 0xffffff, roomOf(M, a + lw / 2, 0, lw, dh));
    }
    Bb.to(batch, 'paint', M, new THREE.Color(col).multiplyScalar(0.85));
  } else { // painted panels in four bands, a groove between each, a handle
    const Bg = bundle();
    for (let k = 1; k < 4; k++) Bg.add(box(pier + 0.02, 0.02 + (k * (dh - 0.02)) / 4 - 0.02, -t + 0.08, w - pier - 0.02, 0.02 + (k * (dh - 0.02)) / 4 + 0.015, -t + 0.085));
    for (let k = 1; k < Math.round((w - 2 * pier) / 1.2); k++) { const u = pier + (k * (w - 2 * pier)) / Math.round((w - 2 * pier) / 1.2); Bg.add(box(u - 0.012, 0.05, -t + 0.08, u + 0.012, dh - 0.03, -t + 0.085)); }
    Bg.to(batch, 'paint', M, groove);
  }
  batch.add('metal', box(w / 2 - 0.15, 0.42, -t + 0.08, w / 2 + 0.15, 0.47, -t + 0.12), M, 0x8a8a86);
  batch.add('paint', box(pier - 0.06, 0, -0.02, pier, dh + 0.06, 0.03), M, s.trim);
  batch.add('paint', box(w - pier, 0, -0.02, w - pier + 0.06, dh + 0.06, 0.03), M, s.trim);
  batch.add('paint', box(pier - 0.06, dh, -0.02, w - pier + 0.06, dh + 0.08, 0.03), M, s.trim);
  batch.add('metal', box(w - pier + 0.12, 1.9, 0, w - pier + 0.26, 2.12, 0.08), M, 0x2b2620);
  batch.add('lamp', box(w - pier + 0.14, 1.93, 0.08, w - pier + 0.24, 2.08, 0.14), M, 0xfff0cc);
  ctx.lamps.push({ at: V(w - pier + 0.19, 2.0, 0.4).applyMatrix4(M), k: 0.4, porch: true, y: (s.at.y ?? 0) + LAWN });
  // the roof
  const cover = { mat: s.roofMat, color: s.roofColor, o: s.eave, fascia: s.fascia };
  if (s.roof === 'gable') gableRoof(ctx, M, w, d, h, s.pitch ?? 0.36, { ...cover, ridge: s.ridge, rake: s.rake });
  else if (s.roof === 'slab') {
    const o = s.eave ?? 0.5, th = 0.26;
    batch.add('paint', box(-o, h, -d - o, w + o, h + th, o), M, s.fascia ?? 0xf2efe6);
    batch.add('roofing', box(-o + 0.05, h + th, -d - o + 0.05, w + o - 0.05, h + th + 0.02, o - 0.05), M, s.roofColor ?? 0xd8d4cc);
  } else if (s.roof === 'hip') hipRoof(ctx, M, w, d, h, s.pitch ?? 0.32, cover);
  else { // flat behind a parapet: the roofing, its tiled coping
    batch.add('roofing', box(t, h - 0.2, -d + t, w - t, h + 0.03, -t), M, 0x55524e);
    for (const [x0, z0, x1, z1] of [[0, -0.3, w, 0], [0, -d, w, -d + 0.3], [0, -d, 0.3, 0], [w - 0.3, -d, w, 0]]) batch.add('tile', box(x0 - 0.04, top, z0 - 0.04, x1 + 0.04, top + 0.07, z1 + 0.04), M, 0xffffff);
  }
  ctx.solids.push({ c: V(w / 2, top / 2, -d / 2).applyMatrix4(M), half: V(w / 2, top / 2, d / 2), q: new THREE.Quaternion().setFromRotationMatrix(M) });
}
// a room behind a pane on a building's +x side (a dingbat's walkway window)
function sideRoom(M, x, floorY, z) {
  const c = V(x, floorY, z).applyMatrix4(M), N = V(1, 0, 0).transformDirection(M), T = new THREE.Vector3().crossVectors(_Y, N).normalize();
  return { cell: [c.dot(T) - 1.0, c.y, 2.0, 2.9], room: [3.4, Math.random() * 100, 0, 0.45] };
}
function roomOf(F, uc, vbase, roomW, roomH) {
  const c = V(uc, vbase, 0).applyMatrix4(F);
  const N = V(0, 0, 1).transformDirection(F), T = new THREE.Vector3().crossVectors(_Y, N).normalize();
  return { cell: [c.dot(T) - roomW / 2, c.y, roomW, roomH], room: [3.5, Math.random() * 100, 1, 0.15] };
}

// ------------------------------------------------------------------------------------------------ the dingbat
// Two storeys over carports: the upper one (building(), lifted) and under it the carports' posts, the ceiling over
// them, the enclosed back (the lobby and the laundry), the stair up its side to the walkway, the name across the
// front and a starburst; its far box stands on the ground (Plan.js boxesOf)
export function dingbat(ctx, s, building) {
  const { batch } = ctx, y0 = s.at.y ?? 0, M = new THREE.Matrix4().makeTranslation(s.at.x, y0, s.at.z).multiply(new THREE.Matrix4().makeRotationY(s.yaw));
  const q = new THREE.Quaternion().setFromRotationMatrix(M), w = s.w, d = s.d, gh = s.gh, rear = 6.0;
  const solid = (x0, ya, z0, x1, yb, z1) => ctx.solids.push({ c: V((x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(Math.abs(x1 - x0) / 2, Math.abs(yb - ya) / 2, Math.abs(z1 - z0) / 2), q, stuff: 'stone' });
  // the upper floor: its windows in pairs, a sliding door to each flat's little balcony at the back
  const n = s.bays, upper = { kind: 'building', at: V(s.at.x, y0 + gh, s.at.z), yaw: s.yaw, w, d, floors: 2, gh: 0.02, fh: s.upper, parapet: s.parapet, coping: 'cap', wall: 'stucco', color: s.color, trim: s.trim, frame: s.frame,
    win: { w: 1.6, h: 1.25, sill: 0.95 }, bays: n, sides: { L: 'windows', R: 'party' }, back: true, home: true, ac: 0.35, rooftop: { condensers: 1, dish: false, aerial: true }, flatColor: s.roofColor };
  const b = building(ctx, upper), roofTop = gh + b.H + s.parapet;
  // its underside over the carports, the lip of the roof out over the front
  batch.add('paint', box(0.02, gh - 0.02, -d + rear, w - 0.02, gh + 0.02, -0.02), M, 0xe8e2d6);
  batch.add('paint', box(-0.15, roofTop - 0.02, -0.5, w + 0.15, roofTop + 0.14, 0.45), M, s.trim);
  // the flats' doors off the walkway along the stair's side (the side wall blank behind them), a window between
  for (const [z1, kind] of [[-5.5, 'door'], [-9.5, 'door'], [-7.6, 'win'], [-13.2, 'door']]) {
    if (-z1 > d - 0.8) continue;
    if (kind === 'door') { batch.add('paint', box(w, gh + 0.04, z1 - 0.5, w + 0.05, gh + 2.12, z1 + 0.5), M, pick(ctx.rnd, [0x2f6f7a, 0xc8a040, 0x8a3a2a, 0x3a5a7a])); batch.add('metal', box(w + 0.05, gh + 1.0, z1 + 0.32, w + 0.09, gh + 1.06, z1 + 0.4), M, 0xb08d4a); }
    else batch.add('glass', new THREE.PlaneGeometry(1.0, 0.8).rotateY(Math.PI / 2).translate(w + 0.02, gh + 1.55, z1), M, 0xffffff, sideRoom(M, w + 0.02, gh + 0.02, z1));
  }
  // the walkway along that side: its slab on brackets, the iron rail
  const wz0 = -5.25, wz1 = -Math.min(d - 0.4, 14.2);
  batch.add('concrete', box(w, gh - 0.12, wz1, w + 1.2, gh + 0.02, wz0), M, 0xd2cabc);
  ctx.pads.push({ c: V(w + 0.6, gh - 0.05, (wz0 + wz1) / 2).applyMatrix4(M), half: V(0.6, 0.07, (wz0 - wz1) / 2) });
  const Bi = bundle();
  for (let zz = wz0; zz >= wz1; zz -= 0.12) Bi.add(box(w + 1.16, gh + 0.02, zz - 0.01, w + 1.18, gh + 0.98, zz + 0.01));
  Bi.add(box(w + 1.15, gh + 0.95, wz1, w + 1.19, gh + 0.99, wz0));
  ctx.solids.push({ c: V(w + 1.17, gh + 0.5, (wz0 + wz1) / 2).applyMatrix4(M), half: V(0.03, 0.5, (wz0 - wz1) / 2), q, stuff: 'metal' });
  // the carports' posts along the front (square stucco columns) and the beam over them
  const Bp = bundle();
  for (let i = 0; i <= n; i++) { const u = Math.min(w - 0.2, Math.max(0.2, (w * i) / n)); Bp.add(box(u - 0.17, 0, -0.34, u + 0.17, gh, 0)); solid(u - 0.17, 0, -0.34, u + 0.17, gh, 0); }
  Bp.to(batch, 'stucco', M, s.color);
  batch.add('stucco', box(0, gh - 0.45, -0.34, w, gh, 0.02), M, s.color);
  // the sides' walls under the upper floor (from the back to a post's depth), the enclosed back with its doors
  batch.add('stucco', box(0, 0, -d + rear, 0.25, gh, -0.34), M, s.color);
  batch.add('stucco', box(w - 0.25, 0, -d + rear, w, gh, -0.34), M, s.color);
  wall(ctx, mul(M, tr(0, 0, -d + rear)), { len: w, top: gh, t: 0.25, mat: 'stucco', color: s.color, trim: s.trim, coping: 'none', openings: [
    { kind: 'door', u: w * 0.25 - 0.5, v: 0, w: 1.0, h: 2.15, color: 0x5d6a5e, frame: s.trim }, { kind: 'door', u: w * 0.62 - 0.5, v: 0, w: 1.0, h: 2.15, color: 0x8a6a4a, frame: s.trim },
    { kind: 'win', u: w * 0.85 - 0.45, v: 1.3, w: 0.9, h: 0.7, floor: 0, roomH: gh, room: 0, lit: 0.4 }] });
  batch.add('stucco', box(0, 0, -d, w, gh, -d + rear - 0.25), M, s.color);
  solid(0, 0, -d, w, gh, -d + rear);
  // the stair up the side: its steps on a stringer, the iron rail, the landing at the walkway's end
  const sx0 = w + 0.15, sx1 = w + 1.25, steps = 15, run = 0.27, z0 = -1.2;
  const Bs = bundle();
  for (let k = 0; k < steps; k++) {
    const y = ((k + 1) * (gh + 0.02)) / steps, zz = z0 - k * run;
    Bs.add(box(sx0, y - 0.05, zz - run, sx1, y, zz));
    ctx.pads.push({ c: V((sx0 + sx1) / 2, y / 2, zz - run / 2).applyMatrix4(M), half: V((sx1 - sx0) / 2, y / 2, run / 2) });
  }
  const zTop = z0 - steps * run, rise = Math.atan2(gh, steps * run);
  const stringer = new THREE.BoxGeometry(0.08, 0.28, Math.hypot(steps * run, gh)).rotateX(rise).translate(0, 0, 0);
  for (const x of [sx0 + 0.04, sx1 - 0.04]) batch.add('paint', metreUV(stringer.clone().translate(x, gh / 2 - 0.12, (z0 + zTop) / 2)), M, s.trim);
  Bs.to(batch, 'concrete', M, 0xd2cabc);
  for (let k = 0; k <= steps; k += 1) { const y = (k * gh) / steps, zz = z0 - k * run; Bi.add(box(sx1 - 0.03, y, zz - 0.012, sx1 - 0.008, y + 0.95, zz + 0.012)); }
  const rail = new THREE.BoxGeometry(0.03, 0.03, Math.hypot(steps * run, gh)).rotateX(rise);
  Bi.add(metreUV(rail.translate(sx1 - 0.02, gh / 2 + 0.95, (z0 + zTop) / 2)));
  Bi.to(batch, 'iron', M, 0x1d1c1b);
  // the name in script across the front over the windows, the starburst beside it
  const nameW = Math.min(w * 0.55, 6.5), ny = gh + 0.02 + 0.97 + 1.25 + 0.1;
  label(ctx, M, w * 0.06, w * 0.06 + nameW, ny, Math.min(0.85, roofTop - ny - 0.12), { text: s.name, style: 'letters', fg: `#${s.accent.toString(16).padStart(6, '0')}`, font: s.font, wear: 0.15 }, 0.02);
  const cx = w * 0.86, cy = (ny + roofTop) / 2, ac = s.accent;
  const Br = bundle();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI, len = k % 2 ? 0.32 : 0.5, g = new THREE.BoxGeometry(len * 2, 0.04, 0.03).rotateZ(a).translate(cx, cy, 0.04);
    Br.add(metreUV(g));
  }
  Br.to(batch, 'metal', M, ac);
  batch.add('metal', metreUV(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12).rotateX(Math.PI / 2).translate(cx, cy, 0.07)), M, 0xd8b04a);
  // a lamp under the carports at each end, lit at night
  for (const u of [0.6, w - 0.6]) { batch.add('lamp', box(u - 0.12, gh - 0.1, -1.6, u + 0.12, gh - 0.02, -1.36), M, 0xfff0cc); ctx.lamps.push({ at: V(u, gh - 0.3, -1.5).applyMatrix4(M), k: 0.5, porch: true, y: y0 + PAVE }); }
}

// ------------------------------------------------------------------------------------------------ the lot round it
// What a lot has round its house (Stream.buildCell, after the buildings): the lawns, the drive and the walk, the front
// boundary, the side and back fences, the porch, the planting and the trees, the pool, the carport, the mailbox, the
// cans, the car. All in the lot's frame (`F`: u along the street, v in from it as -z). `places`: the kit's pieces.
export function yard(ctx, c, L, places) {
  const { batch } = ctx, rnd = seeded(L.seed ^ 0x9e37), y0 = L.y;
  const F = new THREE.Matrix4().makeTranslation(L.O.x, y0, L.O.z).multiply(new THREE.Matrix4().makeRotationY(L.yaw));
  const q = new THREE.Quaternion().setFromAxisAngle(_Y, L.yaw);
  const add = (key, geo, color) => batch.add(key, geo, F, color);
  const bx = (u0, v0, u1, v1, ya, yb) => box(u0, ya, -v1, u1, yb, -v0); // (u along, v in)
  const solid = (u0, v0, u1, v1, ya, yb, stuff = 'stone') => ctx.solids.push({ c: V((u0 + u1) / 2, (ya + yb) / 2, -(v0 + v1) / 2).applyMatrix4(F), half: V(Math.abs(u1 - u0) / 2, (yb - ya) / 2, Math.abs(v1 - v0) / 2), q, stuff });
  const pad = (u0, v0, u1, v1, yb) => { if (u1 - u0 > 0.05 && v1 - v0 > 0.05) ctx.pads.push({ c: V((u0 + u1) / 2, (yb - 0.3) / 2, -(v0 + v1) / 2).applyMatrix4(F), half: V((u1 - u0) / 2, (yb + 0.3) / 2, (v1 - v0) / 2) }); };
  const toLot = (u, v) => V(u, 0, -v).applyMatrix4(F);
  const plane = (u0, v0, u1, v1, y, key, color = 0xffffff) => { if (u1 - u0 < 0.05 || v1 - v0 < 0.05) return; const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0).rotateX(-Math.PI / 2).translate((u0 + u1) / 2, y, -(v0 + v1) / 2); metreUV(g); add(key, g, color); };
  const ua = L.u0, ub = L.u0 + L.w, D = L.deep, H = L.house, style = L.style;
  const pu = L.hu0 + L.doorU; // (the front door, along the street)
  const tree = (kind, uu, vv, h, w, tint) => { const p = toLot(uu, vv); ctx.trees.push({ kind, x: p.x, y: y0 + LAWN, z: p.z, h, w, tint }); };
  const palm = (uu, vv, s = 0.55 + rnd() * 0.14) => { const p = toLot(uu, vv); places.push({ k: rnd() < 0.5 ? 'palm0' : 'palm1', M: new THREE.Matrix4().compose(V(p.x, y0 + LAWN, p.z), new THREE.Quaternion().setFromAxisAngle(_Y, rnd() * 6), V(s, s, s)), s }); };
  const kit = (k, uu, vv, yaw = 0, s = 1, y = LAWN) => { const p = toLot(uu, vv); places.push({ k, M: new THREE.Matrix4().compose(V(p.x, y0 + y, p.z), new THREE.Quaternion().setFromAxisAngle(_Y, L.yaw + yaw), V(s, s, s)), s }); };

  // ---- the ground: lawn, the paved parts over it (the drive, the walk, the patio), the pool left open
  const pool = L.pool ? { u0: L.hu0 + 0.8, u1: L.hu0 + Math.min(L.hw - 0.8, 9.5), v0: L.setback + L.hd + 2.2, v1: D - 1.4 } : null;
  plane(ua, 0, ub, D, LAWN, 'lawn', L.lawn);
  if (pool) { pad(ua, 0, ub, pool.v0 - 0.4, LAWN); pad(ua, pool.v1 + 0.4, ub, D, LAWN); pad(ua, pool.v0 - 0.4, pool.u0 - 0.4, pool.v1 + 0.4, LAWN); pad(pool.u1 + 0.4, pool.v0 - 0.4, ub, pool.v1 + 0.4, LAWN); }
  else pad(ua, 0, ub, D, LAWN);
  // on rising ground: the terrace's walls down to the ground round it
  if (y0 > 0.01) for (const [u0, v0, u1, v1] of [[ua, 0, ub, 0], [ua, D, ub, D], [ua, 0, ua, D], [ub, 0, ub, D]]) {
    const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / 3));
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n, uA = u0 + (u1 - u0) * a, vA = v0 + (v1 - v0) * a, uB = u0 + (u1 - u0) * b, vB = v0 + (v1 - v0) * b;
      const pm = toLot((uA + uB) / 2, (vA + vB) / 2), g = Math.min(groundAt(pm.x, pm.z), groundAt(toLot(uA, vA).x, toLot(uA, vA).z), groundAt(toLot(uB, vB).x, toLot(uB, vB).z));
      if (y0 - g < 0.12) continue;
      const t = 0.25, alongU = u1 !== u0;
      add('concrete', alongU ? bx(uA, vA - t, uB, vA + t, g - y0 - 0.3, LAWN + 0.06) : bx(uA - t, vA, uA + t, vB, g - y0 - 0.3, LAWN + 0.06), 0xc8bca8);
    }
  }
  const dr = L.drive;
  if (dr) {
    const drC = [1.3, 1.27, 1.2];
    if (dr.strips) for (const s of [-1, 1]) add('pavement', bx(dr.u + s * 0.75 - 0.32, 0, dr.u + s * 0.75 + 0.32, dr.vb, LAWN, LAWN + 0.035), drC); // (two strips, the lawn between)
    else add('pavement', bx(dr.ua, dr.va, dr.ub, dr.vb, LAWN, LAWN + 0.035), drC);
    pad(dr.ua, dr.va, dr.ub, dr.vb, LAWN + 0.035); // (what a car stands on)
  }
  // (a dingbat's carports: concrete from the pavement in under it, back to its enclosed rear; a planter strip beside)
  if (style === 'dingbat') {
    const v1 = L.setback + L.hd - 6.0;
    add('pavement', bx(L.hu0 - 0.25, 0, L.hu0 + L.hw + 0.25, v1, LAWN, LAWN + 0.035), [1.25, 1.22, 1.16]);
    pad(L.hu0 - 0.25, 0, L.hu0 + L.hw + 0.25, v1, LAWN + 0.035);
    add('pavement', bx(L.hu0 + L.hw + 0.25, 0, L.hu0 + L.hw + 1.3, L.setback + 1.2, LAWN, LAWN + 0.03), [1.22, 1.17, 1.08]); // (the walk to its stair)
    for (const x of [L.hu0 + L.hw + 1.7, ub - 0.6]) tree('shrub', x, L.setback * 0.5, 0.9, 1.0);
  }
  // ---- the walk to the front door (or to the porch's steps), the front step
  const porch = L.porch, porchD = porch && porch.kind !== 'hood' ? porch.d : 0;
  const wingOut = L.wing ? L.wing.out : 0;
  if (style !== 'court' && style !== 'dingbat') {
    const vStep = L.setback - porchD;
    // (a ranch's walk comes off its drive along the front; the rest straight out to the pavement)
    if (style === 'ranch' && dr && !dr.side && rnd() < 0.6) {
      const vw = vStep - 1.4, a = Math.min(pu, dr.u), b = Math.max(pu, dr.u);
      add('pavement', bx(a - 0.55, vw - 0.55, b + 0.55, vw + 0.55, LAWN, LAWN + 0.03), [1.22, 1.17, 1.08]);
      add('pavement', bx(pu - 0.55, vw, pu + 0.55, vStep - 0.2, LAWN, LAWN + 0.03), [1.22, 1.17, 1.08]);
    } else add('pavement', bx(pu - 0.6, 0, pu + 0.6, vStep - 0.2, LAWN, LAWN + 0.03), style === 'spanish' ? [1.3, 1.0, 0.8] : [1.22, 1.17, 1.08]);
    if (!porchD) { add('concrete', bx(pu - 0.9, L.setback - 0.6, pu + 0.9, L.setback + 0.05, LAWN, LAWN + 0.16), style === 'spanish' ? 0xb8604a : 0xc8c0b2); pad(pu - 0.9, L.setback - 0.6, pu + 0.9, L.setback, LAWN + 0.16); }
  }
  // ---- the front boundary along the pavement, open at the walk and the drive
  const gaps = [[pu - 0.8, pu + 0.8]];
  if (dr && !dr.side) gaps.push([dr.ua - 0.3, dr.ub + 0.3]);
  if (style === 'dingbat') gaps.push([ua, ub]);
  gaps.sort((a, b) => a[0] - b[0]);
  const runs = []; let u = ua + 0.05;
  for (const [g0, g1] of gaps) { if (g0 > u + 0.3) runs.push([u, g0]); u = Math.max(u, g1); }
  if (ub - 0.05 > u + 0.3) runs.push([u, ub - 0.05]);
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i][1] - runs[i][0] < 2.4) runs.splice(i, 1); // (no stubs between the walk and the drive)
  const fv = 0.35;
  if (style === 'court') courtFront(ctx, L, add, bx, solid, F);
  else for (const [r0, r1] of runs) frontRun(L, r0, r1, fv, add, bx, solid, rnd, (uu, vv) => kit('mailbox', uu, vv));
  // a corner lot's front lawn round onto the side street: the same boundary down its side, to the house's front
  if (L.sideStreet && (L.front === 'hedge' || L.front === 'wall' || L.front === 'picket' || L.front === 'brick')) {
    const uS = L.corner === 'start' ? ua + 0.35 : ub - 0.35;
    frontSide(L, uS, 0.8, L.setback - 0.5, add, bx, solid);
  }
  // ---- the side fences between the back yards (each lot builds the one on its start's line), from the house's
  // front back to the alley, the back fence on the alley; a corner's on the side street a stucco wall
  const fence = (u0, v0, u1, v1, street) => woodFence(L, u0, v0, u1, v1, street, add, bx, solid);
  const vb = L.setback + 1.2;
  const sideOpen = L.g === 'side' ? [L.drive.va - 0.3, L.drive.vb + 0.3] : null; // (the side street's drive comes in through it)
  if (!(L.corner === 'start' && L.sideStreet)) fence(ua, vb, ua, D - 0.1, false);
  if (L.corner === 'start' && L.sideStreet) { if (sideOpen) { fence(ua + 0.1, vb, ua + 0.1, sideOpen[0], true); fence(ua + 0.1, sideOpen[1], ua + 0.1, D - 0.1, true); } else fence(ua + 0.1, vb, ua + 0.1, D - 0.1, true); }
  if (L.corner === 'end' && L.sideStreet) { if (sideOpen) { fence(ub - 0.1, vb, ub - 0.1, sideOpen[0], true); fence(ub - 0.1, sideOpen[1], ub - 0.1, D - 0.1, true); } else fence(ub - 0.1, vb, ub - 0.1, D - 0.1, true); }
  if (L.corner === 'end' && !L.sideStreet) fence(ub, vb, ub, D - 0.1, false);
  if (L.g === 'alley' && L.garage) { // (the back fence either side of the garage on the alley, its apron out to the alley)
    const g0 = L.garage.u - L.garage.w, g1 = L.garage.u;
    if (g0 - ua > 0.5) fence(ua, D - 0.1, g0 - 0.05, D - 0.1, false);
    if (ub - g1 > 0.5) fence(g1 + 0.05, D - 0.1, ub, D - 0.1, false);
  } else if (L.alley || style !== 'court') fence(ua, D - 0.1, ub, D - 0.1, false);
  // a gate across the drive on some (between the front of the house and the back yard)
  if (dr && !dr.side && L.g === 'back' && rnd() < 0.4) {
    const gv = L.setback + 1.2;
    const B = bundle();
    for (let x = dr.ua + 0.1; x < dr.ub - 0.05; x += 0.14) B.add(bx(x - 0.012, gv - 0.012, x + 0.012, gv + 0.012, LAWN, 1.5 + 0.12 * Math.sin(((x - dr.ua) / (dr.ub - dr.ua)) * Math.PI)));
    B.add(bx(dr.ua, gv - 0.02, dr.ub, gv + 0.02, 1.4, 1.45));
    add('iron', B.geo(), 0x1d1c1b);
    solid(dr.ua, gv - 0.03, dr.ub, gv + 0.03, 0, 1.55, 'metal');
  }
  // ---- the porch
  if (porch) porchOf(ctx, L, F, add, bx, solid, pad, rnd);
  // ---- the planting along the front, the trees
  const [pa, pb] = !porch ? [pu - 0.9, pu + 0.9] : porch.kind === 'ranch' ? [L.hu0 + porch.u0, L.hu0 + porch.u1] : porch.kind === 'hood' ? [pu - 1.0, pu + 1.0] : [pu - porch.w / 2, pu + porch.w / 2];
  for (let k = 0; k < L.shrubs; k++) {
    const uu = L.hu0 + 0.8 + ((L.hw - 1.6) * (k + 0.5)) / L.shrubs;
    if (uu > pa - 0.6 && uu < pb + 0.6) continue; // (not on the porch, nor at the door)
    if (L.wing && uu > L.hu0 + L.wing.u - 0.5 && uu < L.hu0 + L.wing.u + L.wing.w + 0.5) { tree('shrub', uu, L.setback - wingOut - 0.9, 0.9 + rnd() * 0.4, 1.1 + rnd() * 0.5, L.bloom && k % 2 === 0 ? L.bloom : undefined); continue; }
    tree('shrub', uu, L.setback - 0.95, 0.9 + rnd() * 0.5, 1.2 + rnd() * 0.6, L.bloom && k % 2 === 0 ? L.bloom : undefined);
  }
  if (L.planter) { // a brick planter under the picture window
    const pw = H.groundWindows.find((o) => o.pic);
    if (pw) {
      const a = L.hu0 + pw.u - pw.w / 2 - 0.3, b = L.hu0 + pw.u + pw.w / 2 + 0.3, v1 = L.setback - 0.02, v0 = v1 - 0.6;
      add('brick', bx(a, v0, b, v1, LAWN - 0.05, 0.55), 0xffffff);
      add('concrete', bx(a - 0.03, v0 - 0.03, b + 0.03, v1, 0.55, 0.6), 0xd8d0c2);
      solid(a, v0, b, v1, 0, 0.6);
      for (let x = a + 0.5; x < b - 0.3; x += 0.9) tree('shrub', x, (v0 + v1) / 2, 0.6 + rnd() * 0.2, 0.7, L.bloom ?? undefined);
    }
  }
  // the front garden's tree, in its corner away from the drive and the walk
  const open = dr && !dr.side ? (dr.u < L.hu0 + L.hw / 2 ? Math.min(ub - 2.2, Math.max(pu + 2.6, L.hu0 + L.hw * 0.75)) : Math.max(ua + 2.2, Math.min(pu - 2.6, L.hu0 + L.hw * 0.25))) : pu < (ua + ub) / 2 ? ub - 2.6 : ua + 2.6;
  const tv = Math.max(1.8, (L.setback - porchD - wingOut) * 0.45);
  const T = L.tree;
  if (T === 'palm') palm(open, tv, 0.62 + rnd() * 0.12);
  else if (T === 'palm2') { palm(open - 0.9, tv, 0.6 + rnd() * 0.1); palm(open + 0.9, tv + 0.4, 0.52 + rnd() * 0.1); } // (a pair, one taller: the sixties' way)
  else if (T !== 'none' && T) treeOf(tree, T, open, tv, rnd);
  if (L.backTree !== 'none' && !pool && L.style !== 'court' && L.style !== 'dingbat') treeOf(tree, L.backTree, L.hu0 + L.hw * (0.25 + rnd() * 0.5), Math.min(D - 2.6, L.setback + L.hd + 3.2), rnd);
  if (L.cypress) for (const dv of [0, 2.4]) tree('cypress', ua + 1.1, L.setback + L.hd * 0.3 + dv, 6 + rnd() * 2, 5.5);
  // ---- a patio behind the house, and the pool with its coping
  if (style !== 'court' && style !== 'dingbat') {
    const pv = L.setback + L.hd;
    if (D - pv > 2.6) add('pavement', bx(L.hu0 + 0.5, pv, L.hu0 + Math.min(L.hw, 6.5), pv + 2.2, LAWN, LAWN + 0.03), 0xd8cfc0);
  }
  if (pool) {
    add('pool', bx(pool.u0, pool.v0, pool.u1, pool.v1, LAWN - 0.04, LAWN - 0.035), 0xffffff);
    add('concrete', bx(pool.u0, pool.v0, pool.u1, pool.v1, -0.05, LAWN - 0.07), 0x6ab0c8); // (its floor, seen through the water)
    for (const [a0, b0, a1, b1] of [[pool.u0 - 0.4, pool.v0 - 0.4, pool.u1 + 0.4, pool.v0], [pool.u0 - 0.4, pool.v1, pool.u1 + 0.4, pool.v1 + 0.4], [pool.u0 - 0.4, pool.v0, pool.u0, pool.v1], [pool.u1, pool.v0, pool.u1 + 0.4, pool.v1]]) {
      add('concrete', bx(a0, b0, a1, b1, LAWN - 0.1, LAWN + 0.08), 0xf0ece2);
      solid(a0, b0, a1, b1, 0, LAWN + 0.08);
    }
  }
  // ---- a carport over the drive: posts and a flat roof
  if (L.carport) {
    const C = L.carport;
    for (const [uu, vv] of [[C.u0, C.v0], [C.u1, C.v0], [C.u0, C.v1], [C.u1, C.v1]]) { add('metal', bx(uu - 0.05, vv - 0.05, uu + 0.05, vv + 0.05, LAWN, 2.45), 0xf2efe6); solid(uu - 0.06, vv - 0.06, uu + 0.06, vv + 0.06, 0, 2.45, 'metal'); }
    add('paint', bx(C.u0 - 0.25, C.v0 - 0.4, C.u1 + 0.25, C.v1 + 0.3, 2.45, 2.62), H.fascia ?? 0xf2efe6);
    add('roofing', bx(C.u0 - 0.2, C.v0 - 0.35, C.u1 + 0.2, C.v1 + 0.25, 2.62, 2.64), H.roofColor ?? 0xd0ccc4);
    ctx.solids.push({ c: V((C.u0 + C.u1) / 2, 2.54, -(C.v0 + C.v1) / 2).applyMatrix4(F), half: V((C.u1 - C.u0) / 2 + 0.25, 0.1, (C.v1 - C.v0) / 2 + 0.35), q });
  }
  // ---- a basketball hoop over a front garage's door
  if (L.garage?.hoop) {
    const g = L.garage, hu = g.u + g.w / 2, hv = g.v - 0.25, hy = (g.spec.gh ?? 2.85) + 0.55;
    add('paint', bx(hu - 0.6, hv - 0.04, hu + 0.6, hv + 0.02, hy, hy + 0.9), 0xf4f4f0);
    add('paint', bx(hu - 0.15, hv - 0.05, hu + 0.15, hv - 0.03, hy + 0.15, hy + 0.42), 0xc0401b);
    const rim = new THREE.TorusGeometry(0.23, 0.012, 4, 16).rotateX(Math.PI / 2).translate(hu, hy + 0.1, -(hv - 0.3));
    add('iron', rim, 0xd0501b);
    add('iron', bx(hu - 0.02, hv - 0.1, hu + 0.02, hv - 0.04, hy + 0.06, hy + 0.14), 0xd0501b);
  }
  // ---- the mailbox on its post out on the parkway by the drive (the kit's: it snaps off), the cans out at the kerb
  // on collection day; on flat ground only (on the hills' foot the parkway's a slope: Stream.js street)
  const kerbV = -(L.pw ?? 5) + 0.62, flatKerb = c.relief <= 0.05;
  if (flatKerb && L.mailbox && dr && !dr.side) kit('mailbox', dr.u + (dr.u < L.hu0 + L.hw / 2 ? 1 : -1) * ((dr.ub - dr.ua) / 2 + 0.75), kerbV + 0.2, 0, 1, PAVE);
  else if (flatKerb && L.mailbox) kit('mailbox', pu + 1.4, kerbV + 0.2, 0, 1, PAVE);
  if (flatKerb && L.cans) {
    const s = dr.u < L.hu0 + L.hw / 2 ? -1 : 1, cu = dr.u + s * ((dr.ub - dr.ua) / 2 + 0.75);
    kit('can', Math.max(ua + 0.5, Math.min(ub - 0.5, cu)), kerbV + 0.25, rnd() * 6, 1, PAVE);
    if (rnd() < 0.6) kit('can', Math.max(ua + 0.5, Math.min(ub - 0.5, cu + s * 0.7)), kerbV + 0.3, rnd() * 6, 1, PAVE);
  }
  // ---- the porch light's pool at night (each house's lamp by its door: building()'s entry)
  if (style !== 'dingbat' && style !== 'court') ctx.lamps.push({ at: toLot(pu, L.setback - porchD - 0.6).setY(y0 + 2.4), k: 0.5, porch: true, y: y0 + LAWN });
  if (style === 'court') for (const cot of L.cottages) { const p = V(cot.doorX, 0, 1.4).applyMatrix4(new THREE.Matrix4().makeTranslation(cot.spec.at.x, y0, cot.spec.at.z).multiply(new THREE.Matrix4().makeRotationY(cot.spec.yaw))); ctx.lamps.push({ at: p.setY(y0 + 2.4), k: 0.4, porch: true, y: y0 + LAWN }); }
  // ---- the cars (made by Stream.buildCell: props/Car.js, Smash's)
  for (const car of L.car ? [L.car] : L.cars ?? []) {
    const p = toLot(car.u, car.v);
    ctx.cars.push({ x: p.x, y: y0 + LAWN + 0.035, z: p.z, yaw: L.yaw + car.theta, model: car.model, paint: car.paint });
  }
}

// a tree of the town's by its name: the tree field's shapes (city/Parks.js), tinted
function treeOf(tree, T, uu, vv, rnd) {
  const s = 0.8 + rnd() * 0.4;
  if (T === 'jacaranda') tree('oak', uu, vv, 6.2 * s, 6.6 * s, [2.5 + rnd() * 0.3, 1.3, 5.4 + rnd() * 0.8]); // (in flower: its lavender, a blue-violet)
  else if (T === 'ficus') tree('oak', uu, vv, 6.8 * s, 7.2 * s, [0.62, 0.78, 0.6]);
  else if (T === 'magnolia') tree('oak', uu, vv, 7.4 * s, 5.6 * s, [0.55, 0.72, 0.62]);
  else if (T === 'citrus') tree('oak', uu, vv, 3.2 * s, 3.4 * s, [0.6, 0.85, 0.5]);
  else if (T === 'olive') tree('oak', uu, vv, 4.2 * s, 4.8 * s, [1.25, 1.15, 1.2]);
  else if (T === 'avocado') tree('oak', uu, vv, 7.5 * s, 7.8 * s, [0.6, 0.75, 0.5]);
  else if (T === 'eucalyptus') tree('oak', uu, vv, 13 * s, 7 * s, [1.25, 1.18, 1.35]);
  else if (T === 'liquidambar') tree('oak', uu, vv, 8.5 * s, 5.2 * s, [1.5, 0.95, 0.5]);
  else tree('oak', uu, vv, 5.4 * s, 5.0 * s);
}

// A run of the front boundary: a low stucco wall with a tile cap, a hedge, a picket fence, a low brick wall, a
// ranch's split rail, a wall with iron railings
function frontRun(L, r0, r1, fv, add, bx, solid, rnd, mailbox) {
  const f = L.front;
  if (f === 'hedge') { add('hedge', bx(r0, fv - 0.35, r1, fv + 0.35, LAWN, 0.95), 0x2c4a22); solid(r0, fv - 0.35, r1, fv + 0.35, 0, 0.95); }
  else if (f === 'wall' || f === 'iron') {
    const h = f === 'iron' ? 0.45 : 0.7;
    add('stucco', bx(r0, fv - 0.15, r1, fv + 0.15, -0.2, h), L.wallColor);
    add(f === 'iron' ? 'concrete' : 'tile', bx(r0 - 0.03, fv - 0.21, r1 + 0.03, fv + 0.21, h, h + 0.07), f === 'iron' ? 0xe8e2d6 : 0xffffff);
    if (f === 'iron') {
      const B = bundle();
      for (let x = r0 + 0.08; x < r1 - 0.05; x += 0.14) B.add(bx(x - 0.012, fv - 0.012, x + 0.012, fv + 0.012, h + 0.07, h + 0.95));
      B.add(bx(r0, fv - 0.02, r1, fv + 0.02, h + 0.9, h + 0.95));
      add('iron', B.geo(), 0x1d1c1b);
    }
    // (its piers at the ends, taller, at the walk)
    for (const x of [r0, r1]) { add('stucco', bx(x - 0.22, fv - 0.22, x + 0.22, fv + 0.22, -0.2, h + 0.3), L.wallColor); add('tile', bx(x - 0.26, fv - 0.26, x + 0.26, fv + 0.26, h + 0.3, h + 0.37), 0xffffff); }
    solid(r0, fv - 0.2, r1, fv + 0.2, 0, f === 'iron' ? h + 0.95 : h + 0.37);
  } else if (f === 'brick') {
    add('brick', bx(r0, fv - 0.17, r1, fv + 0.17, -0.2, 0.55), 0xffffff);
    add('concrete', bx(r0 - 0.03, fv - 0.2, r1 + 0.03, fv + 0.2, 0.55, 0.61), 0xd8d0c2);
    solid(r0, fv - 0.2, r1, fv + 0.2, 0, 0.61);
  } else if (f === 'picket') {
    const B = bundle();
    for (let x = r0 + 0.06; x < r1 - 0.03; x += 0.16) B.add(bx(x - 0.035, fv - 0.012, x + 0.035, fv + 0.012, LAWN, 0.92 + 0.04 * Math.abs(Math.sin(x * 9.7))));
    for (const h of [0.3, 0.72]) B.add(bx(r0, fv + 0.012, r1, fv + 0.04, h, h + 0.07));
    for (let x = r0; x <= r1 + 0.01; x += Math.max(1.8, (r1 - r0) / Math.max(1, Math.round((r1 - r0) / 2.4)))) B.add(bx(x - 0.045, fv - 0.0, x + 0.045, fv + 0.09, LAWN, 1.0));
    add('paint', B.geo(), 0xf4f1ea);
    solid(r0, fv - 0.05, r1, fv + 0.05, 0, 0.95, 'wood');
  } else if (f === 'rail') { // a split rail: posts, two rails between
    const n = Math.max(1, Math.round((r1 - r0) / 2.4)), B = bundle();
    for (let k = 0; k <= n; k++) { const x = r0 + ((r1 - r0) * k) / n; B.add(bx(x - 0.07, fv - 0.07, x + 0.07, fv + 0.07, -0.2, 0.95)); }
    for (const h of [0.4, 0.78]) B.add(bx(r0, fv - 0.045, r1, fv + 0.045, h, h + 0.1));
    add('siding', B.geo(), 0xb0a088);
    solid(r0, fv - 0.07, r1, fv + 0.07, 0, 0.95, 'wood');
  }
  void rnd; void mailbox;
}
// the same boundary down a corner lot's side street, from the front to the house
function frontSide(L, uS, v0, v1, add, bx, solid) {
  if (v1 - v0 < 1) return;
  const f = L.front;
  if (f === 'hedge') { add('hedge', bx(uS - 0.35, v0, uS + 0.35, v1, LAWN, 0.95), 0x2c4a22); solid(uS - 0.35, v0, uS + 0.35, v1, 0, 0.95); }
  else if (f === 'wall') { add('stucco', bx(uS - 0.15, v0, uS + 0.15, v1, -0.2, 0.7), L.wallColor); add('tile', bx(uS - 0.21, v0 - 0.03, uS + 0.21, v1 + 0.03, 0.7, 0.77), 0xffffff); solid(uS - 0.2, v0, uS + 0.2, v1, 0, 0.77); }
  else if (f === 'brick') { add('brick', bx(uS - 0.17, v0, uS + 0.17, v1, -0.2, 0.55), 0xffffff); add('concrete', bx(uS - 0.2, v0 - 0.03, uS + 0.2, v1 + 0.03, 0.55, 0.61), 0xd8d0c2); solid(uS - 0.2, v0, uS + 0.2, v1, 0, 0.61); }
  else if (f === 'picket') {
    const B = bundle();
    for (let z = v0 + 0.06; z < v1 - 0.03; z += 0.16) B.add(bx(uS - 0.012, z - 0.035, uS + 0.012, z + 0.035, LAWN, 0.92 + 0.04 * Math.abs(Math.sin(z * 9.7))));
    for (const h of [0.3, 0.72]) B.add(bx(uS + 0.012, v0, uS + 0.04, v1, h, h + 0.07));
    add('paint', B.geo(), 0xf4f1ea);
    solid(uS - 0.05, v0, uS + 0.05, v1, 0, 0.95, 'wood');
  }
}
// A board fence on a lot line (its boards the siding's planks turned upright, stained; posts and rails on the
// lot's own side), or a block wall; on a side street, stucco
function woodFence(L, u0, v0, u1, v1, street, add, bx, solid) {
  const h = street ? 1.8 : 1.75, alongU = Math.abs(u1 - u0) > Math.abs(v1 - v0);
  if (Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0)) < 0.3) return;
  if (street || L.fence === 'block') {
    add('stucco', alongU ? bx(u0, v0 - 0.1, u1, v0 + 0.1, -0.2, h) : bx(u0 - 0.1, v0, u0 + 0.1, v1, -0.2, h), street ? L.wallColor : 0xe2dccf);
    add('concrete', alongU ? bx(u0, v0 - 0.13, u1, v0 + 0.13, h, h + 0.06) : bx(u0 - 0.13, v0, u0 + 0.13, v1, h, h + 0.06), 0xd8d2c4);
  } else {
    const g = alongU ? bx(u0, v0 - 0.035, u1, v0 + 0.035, -0.1, h) : bx(u0 - 0.035, v0, u0 + 0.035, v1, -0.1, h);
    uprightBoards(g);
    add('siding', g, L.stain);
    const len = alongU ? u1 - u0 : v1 - v0, n = Math.max(1, Math.round(len / 2.4)), dark = new THREE.Color(L.stain).multiplyScalar(0.78), B = bundle();
    for (let k = 0; k <= n; k++) { const t = k / n, uu = u0 + (u1 - u0) * t, vv = v0 + (v1 - v0) * t; B.add(bx(uu - 0.05, vv - 0.05, uu + 0.05, vv + 0.05, -0.2, h + 0.06)); }
    for (const hh of [0.3, h - 0.32]) B.add(alongU ? bx(u0, v0 + 0.035, u1, v0 + 0.08, hh, hh + 0.09) : bx(u0 + 0.035, v0, u0 + 0.08, v1, hh, hh + 0.09));
    add('siding', B.geo(), dark);
  }
  if (alongU) solid(u0, v0 - 0.1, u1, v0 + 0.1, 0, h, street || L.fence === 'block' ? 'stone' : 'wood'); else solid(u0 - 0.1, v0, u0 + 0.1, v1, 0, h, street || L.fence === 'block' ? 'stone' : 'wood');
}
// a box's UVs turned on its faces, so the siding's planks stand upright: a fence's boards
function uprightBoards(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, b, a); }
  return g;
}

// A bungalow court's front: its wall along the pavement either side of an arched gateway with the court's name over
// it, the walk in through it down the middle between the cottages' little lawns, a fountain halfway, palms
function courtFront(ctx, L, add, bx, solid, F) {
  const C = L.court, ua = L.u0, ub = L.u0 + L.w, mid = (C.walk[0] + C.walk[1]) / 2, gw = 1.8, h = 1.2, v = 0.35;
  for (const [a, b] of [[ua + 0.05, mid - gw / 2 - 0.5], [mid + gw / 2 + 0.5, ub - 0.05]]) {
    add('stucco', bx(a, v - 0.15, b, v + 0.15, -0.2, h), C.color);
    add('tile', bx(a - 0.03, v - 0.21, b + 0.03, v + 0.21, h, h + 0.07), 0xffffff);
    solid(a, v - 0.2, b, v + 0.2, 0, h + 0.07);
  }
  // the gateway: two piers and the arch over the walk (a wall with its opening arched)
  const gF = F.clone().multiply(new THREE.Matrix4().makeTranslation(mid - gw / 2 - 0.5, 0, -v + 0.15));
  wall(ctx, gF, { len: gw + 1.0, top: 3.1, t: 0.3, mat: 'stucco', color: C.color, trim: C.trim, coping: 'tile', tileSeg: 3, openings: [{ kind: 'arch', u: 0.5, v: 0, w: gw, h: 2.7, arch: gw / 2, empty: true }] });
  for (const x of [mid - gw / 2 - 0.5, mid + gw / 2]) solid(x, v - 0.15, x + 0.5, v + 0.15, 0, 3.1);
  label(ctx, gF, 0.12, gw + 0.88, 2.73, 0.3, { text: C.name, style: 'letters', fg: '#3b2a1e', font: 'deco', wear: 0.25 }, 0); // (over the arch, under the coping)
  // the walk, the fountain, the palms either side of it
  add('pavers', bx(mid - 1.0, 0, mid + 1.0, L.deep - 1.2, LAWN, LAWN + 0.04), [1.25, 1.05, 0.9]);
  const fz = L.deep * 0.5, y = LAWN;
  add('concrete', new THREE.CylinderGeometry(1.2, 1.25, 0.45, 20).translate(mid, y + 0.22, -fz), 0xd9d1c1);
  add('pool', new THREE.CircleGeometry(1.05, 20).rotateX(-Math.PI / 2).translate(mid, y + 0.42, -fz), 0xffffff);
  add('concrete', new THREE.CylinderGeometry(0.12, 0.18, 1.1, 10).translate(mid, y + 0.55, -fz), 0xd2cab9);
  solid(mid - 1.2, fz - 1.2, mid + 1.2, fz + 1.2, 0, 0.45);
  for (const vv of [fz - 3.2, fz + 3.2]) for (const s of [-1, 1]) ctx.trees.push({ kind: 'shrub', ...(() => { const p = V(mid + s * 1.5, 0, -vv).applyMatrix4(F); return { x: p.x, y: L.y + LAWN, z: p.z }; })(), h: 1.0, w: 1.1, tint: [2.3, 0.55, 1.6] });
}

// A porch: a Craftsman's on its piers and tapered columns under its own front gable; a ranch's long shed roof on thin
// iron posts; a postwar box's little hood over the door
function porchOf(ctx, L, F, add, bx, solid, pad, rnd) {
  const P = L.porch, H = L.house, pu = L.hu0 + L.doorU, sb = L.setback;
  if (P.kind === 'craftsman') {
    const a = Math.max(L.hu0 + 0.3, pu - P.w / 2), b = Math.min(L.hu0 + L.hw - 0.3, a + P.w), v0 = sb - P.d, fl = 0.55;
    add('concrete', bx(a, v0, b, sb + 0.05, LAWN - 0.05, fl), 0xbfb5a2); // the porch's floor
    pad(a, v0, b, sb, fl);
    for (let k = 0; k < 2; k++) { const s0 = fl - ((k + 1) * (fl - LAWN)) / 3; add('concrete', bx(pu - 0.9, v0 - (k + 1) * 0.3, pu + 0.9, v0 - k * 0.3, LAWN - 0.05, s0), 0xc8bfae); pad(pu - 0.9, v0 - (k + 1) * 0.3, pu + 0.9, v0 - k * 0.3, s0); }
    // the piers (brick), the tapered columns on them, the beam
    const top = 2.75;
    for (const x of [a + 0.3, b - 0.3]) {
      add('brick', bx(x - 0.3, v0 + 0.05, x + 0.3, v0 + 0.65, fl, fl + 0.9), 0xffffff);
      add('concrete', bx(x - 0.34, v0 + 0.01, x + 0.34, v0 + 0.69, fl + 0.9, fl + 0.96), 0xd0c8b8);
      const col = new THREE.CylinderGeometry(0.15, 0.24, top - fl - 0.96, 4).rotateY(Math.PI / 4).translate(x, fl + 0.96 + (top - fl - 0.96) / 2, -(v0 + 0.35));
      add('paint', metreUV(col), H.trim);
      solid(x - 0.3, v0 + 0.05, x + 0.3, v0 + 0.65, 0, top);
    }
    // a low wall between the piers and the steps (the porch's rail)
    for (const [x0, x1] of [[a + 0.6, pu - 0.95], [pu + 0.95, b - 0.6]]) if (x1 - x0 > 0.3) { add('siding', bx(x0, v0 + 0.25, x1, v0 + 0.45, fl, fl + 0.7), H.color); add('paint', bx(x0 - 0.02, v0 + 0.2, x1 + 0.02, v0 + 0.5, fl + 0.7, fl + 0.76), H.trim); solid(x0, v0 + 0.2, x1, v0 + 0.5, 0, fl + 0.76, 'wood'); }
    add('paint', bx(a, v0 + 0.1, b, v0 + 0.6, top, top + 0.28), H.trim);
    add('lamp', bx(pu - 0.09, sb - 1.0, pu + 0.09, sb - 0.82, top + 0.1, top + 0.22), 0xffe2b0); // (the porch light, in its ceiling)
    // its roof: a lower front gable of the house's shakes
    const pM = F.clone().multiply(new THREE.Matrix4().makeTranslation(a, 0, -v0));
    gableRoof(ctx, pM, b - a, P.d + 0.1, top + 0.28, H.pitch ?? 0.45, { ridge: 'z', mat: 'shake', color: H.roofColor, o: 0.35, rake: 0.4, fascia: H.trim });
    const tri = new THREE.Shape([new THREE.Vector2(0, top + 0.28), new THREE.Vector2(b - a, top + 0.28), new THREE.Vector2((b - a) / 2, top + 0.28 + ((b - a) / 2) * (H.pitch ?? 0.45))]);
    const g = new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -0.1);
    add('siding', metreUV(g.translate(a, 0, -(v0 + 0.05))), H.color); // (the porch gable's face)
    // a porch swing's chains? a pair of chairs: two simple ones by the door
  } else if (P.kind === 'ranch') {
    // (a ranch's porch is under its own wide eave: the slab along the front, slim iron posts with their scrolls up to the
    // eave's underside out near its edge)
    const a = L.hu0 + P.u0, b = L.hu0 + P.u1, v0 = sb - P.d, out = Math.min(0.75, (H.eave ?? 0.8) - 0.12), vp = sb - out;
    const top = H.roof === 'gable' ? H.gh - out * (H.pitch ?? 0.25) : H.roof === 'hip' ? H.gh - 0.11 : H.gh;
    add('concrete', bx(a, v0, b, sb + 0.05, LAWN - 0.05, LAWN + 0.14), 0xcfc6b6);
    pad(a, v0, b, sb, LAWN + 0.14);
    const n = Math.max(2, Math.round((b - a) / 2.6)), B = bundle();
    for (let k = 0; k <= n; k++) {
      const x = a + 0.15 + ((b - a - 0.3) * k) / n;
      B.add(bx(x - 0.035, vp - 0.035, x + 0.035, vp + 0.035, LAWN + 0.14, top));
      solid(x - 0.05, vp - 0.05, x + 0.05, vp + 0.05, 0, top, 'metal');
      for (const yy of [top - 0.55, top - 0.35]) B.add(bx(x - 0.16, vp - 0.012, x + 0.16, vp + 0.012, yy, yy + 0.025)); // (the scrollwork's bars)
      B.add(new THREE.TorusGeometry(0.12, 0.012, 4, 10).translate(x, top - 0.45, -vp));
    }
    add('iron', B.geo(), 0x22211f);
  } else if (P.kind === 'hood') { // a little hip roof on brackets over the door
    const v0 = sb - 1.0;
    add('concrete', bx(pu - 1.0, v0, pu + 1.0, sb + 0.05, LAWN - 0.05, LAWN + 0.17), 0xd2c8b6);
    pad(pu - 1.0, v0, pu + 1.0, sb, LAWN + 0.17);
    const hy = H.gh - 0.15;
    for (const s of [-1, 1]) add('paint', bx(pu + s * 0.85 - 0.05, sb - 0.55, pu + s * 0.85 + 0.05, sb, hy - 0.14, hy), H.trim);
    hipRoof(ctx, F.clone().multiply(new THREE.Matrix4().makeTranslation(pu - 1.0, 0, -(sb - 0.95))), 2.0, 0.95, hy, 0.5, { mat: H.roofMat ?? 'roofTile', color: H.roofColor, o: 0.12, fascia: H.trim });
  } else if (P.kind === 'arch') { // a Spanish porch: an arch on the front and one each side, a little tiled roof
    // (flat, its walls' tiled coping under the house's eave: a pitched one's ridge came up through the eave)
    const a = pu - P.w / 2, b = pu + P.w / 2, v0 = sb - P.d, top = Math.min(2.9, H.gh - 0.32), t = 0.28;
    P.flat = true;
    add('patio', bx(a, v0, b, sb + 0.05, LAWN - 0.05, LAWN + 0.16), 0xffffff); // (its floor of red tiles)
    pad(a, v0, b, sb, LAWN + 0.16);
    const fM = F.clone().multiply(new THREE.Matrix4().makeTranslation(a, 0, -v0));
    wall(ctx, fM, { len: P.w, top, t, mat: 'stucco', color: H.color, trim: H.trim, coping: P.flat ? 'tile' : 'none', tileSeg: 3, openings: [{ kind: 'arch', u: 0.45, v: 0, w: P.w - 0.9, h: 2.45, arch: (P.w - 0.9) / 2, empty: true }] });
    for (const [x, turn] of [[a, -Math.PI / 2], [b, Math.PI / 2]]) {
      const sM = F.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, -(turn < 0 ? sb : v0 + t))).multiply(new THREE.Matrix4().makeRotationY(turn));
      wall(ctx, sM, { len: P.d - t, top, t, mat: 'stucco', color: H.color, trim: H.trim, coping: P.flat ? 'tile' : 'none', tileSeg: 3, openings: [{ kind: 'arch', u: 0.25, v: 0.9, w: P.d - t - 0.5, h: 1.3, arch: (P.d - t - 0.5) / 2, empty: true }] });
    }
    for (const [x0, x1] of [[a, a + 0.45], [b - 0.45, b]]) solid(x0, v0, x1, v0 + t, 0, top);
    for (const x of [a, b - t]) solid(x, v0 + t, x + t, sb, 0, 0.9);
    add('roofing', bx(a + t, v0 + t, b - t, sb, top - 0.25, top - 0.05), 0x55524e);
    add('paint', bx(a + t, v0 + t, b - t, sb, top - 0.27, top - 0.25), 0xe6dfd2); // (its ceiling)
    solid(a, v0, b, sb, top - 0.27, top + 0.07);
    // its lantern hung from the ceiling (the door's own lamp would be in the roof: Homes planLot), lit at night
    const lv = (v0 + t + sb) / 2;
    add('iron', bx(pu - 0.01, lv - 0.01, pu + 0.01, lv + 0.01, top - 0.62, top - 0.27), 0x1d1c1b);
    add('iron', bx(pu - 0.11, lv - 0.11, pu + 0.11, lv + 0.11, top - 0.66, top - 0.62), 0x1d1c1b);
    add('lamp', bx(pu - 0.08, lv - 0.08, pu + 0.08, lv + 0.08, top - 0.92, top - 0.66), 0xffe2b0);
    add('iron', bx(pu - 0.1, lv - 0.1, pu + 0.1, lv + 0.1, top - 0.95, top - 0.92), 0x1d1c1b);
  }
  void rnd;
}

// ------------------------------------------------------------------------------------------------ the alley
// The power line down a block's alley (between its two rows of back yards): a wooden pole every 32 m or so with its
// crossarm, insulators and now and then a transformer, three wires sagging between, and a service drop from the
// nearest pole to each house's back eave. The poles far-drawn (the roofing's grain under a weathered brown), the
// wires near-only; the poles solid.
export function alleyLine(ctx, c, lots) {
  const { batch } = ctx, I = new THREE.Matrix4(), deep = lots[0]?.deep ?? 25;
  const xa = c.x0 + deep, xb = c.x1 - deep;
  if (xb - xa < 3) return;
  const x = xa + 0.55, top = 10.2, arm = 9.4;
  const zs = [];
  for (let z = c.z0 + 9; z < c.z1 - 6; z += 31.5) zs.push(z);
  const wires = [[-1.05, arm + 0.1], [0, arm + 0.1], [1.05, arm + 0.1], [0, arm - 1.1]];
  const Bpole = bundle(), Bins = bundle(), Btr = bundle(), Bw = bundle();
  zs.forEach((z, i) => {
    Bpole.add(metreUV(new THREE.CylinderGeometry(0.11, 0.15, top + 1.2, 7).translate(x, (top - 1.2) / 2, z)));
    Bpole.add(box(x - 1.3, arm - 0.06, z - 0.09, x + 1.3, arm + 0.06, z + 0.09)); // the crossarm, across the alley
    for (const [dx, y] of wires.slice(0, 3)) Bins.add(cyl(0.035, 0.16, x + dx, y - 0.1, z, 6)); // its insulators
    if (i % 3 === 1) { Btr.add(cyl(0.28, 0.9, x - 0.42, arm - 2.2, z, 10)); Btr.add(box(x - 0.2, arm - 1.6, z - 0.05, x - 0.12, arm - 1.2, z + 0.05)); } // a transformer
    ctx.solids.push({ c: V(x, top / 2, z), half: V(0.15, top / 2, 0.15), q: new THREE.Quaternion(), stuff: 'wood' });
  });
  Bpole.to(batch, 'roofing', I, 0x5a4636);
  Bins.to(batch, 'paint', I, 0x8a9a92);
  Btr.to(batch, 'metal', I, 0x8a8c88);
  // (the crossarm runs across the alley: the wires along it, offset in x)
  const sag = (a, b, dip) => {
    const n = 6;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1);
      p0.y -= dip * 4 * t0 * (1 - t0); p1.y -= dip * 4 * t1 * (1 - t1);
      const L = p0.distanceTo(p1), g = new THREE.BoxGeometry(0.022, 0.022, L);
      const m = new THREE.Matrix4().lookAt(p1, p0, _Y);
      g.applyMatrix4(m).translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
      Bw.add(g);
    }
  };
  for (let i = 0; i + 1 < zs.length; i++) for (const [dx, y] of wires) sag(V(x + dx, y, zs[i]), V(x + dx, y, zs[i + 1]), dx === 0 && y < arm ? 0.55 : 0.75);
  // the service drops: from the nearest pole's lower wire to each house's back eave
  for (const L of lots) {
    if (!L.house || L.style === 'court') continue;
    const s = L.house, M = new THREE.Matrix4().makeTranslation(s.at.x, s.at.y ?? 0, s.at.z).multiply(new THREE.Matrix4().makeRotationY(s.yaw));
    const eave = V(s.w * (L.gSide ? 0.25 : 0.75), (s.gh ?? 3) + (s.upper ?? 0) - 0.15, -s.d - 0.1).applyMatrix4(M);
    let best = zs[0]; for (const z of zs) if (Math.abs(z - eave.z) < Math.abs(best - eave.z)) best = z;
    if (best == null || Math.abs(best - eave.z) > 26) continue;
    sag(V(x, arm - 1.1, best), eave, 0.35);
  }
  Bw.to(batch, 'iron', I, 0x1a1a1a); // (every wire down the alley one part)
}

// ------------------------------------------------------------------------------------------------ the kit's mailbox
// A mailbox on its post (the kit's: Stream.js placeKit instances it, and a blow snaps it off): a white post, the
// rounded black box with its little red flag. One mesh in the paint's material, its colours in its vertices.
export function mailboxKit(paint) {
  const parts = [];
  const put = (g, col) => { const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g.index ? g.toNonIndexed() : g); };
  put(new THREE.BoxGeometry(0.09, 1.05, 0.09).translate(0, 0.52, 0), 0xf2efe6);
  put(new THREE.BoxGeometry(0.12, 0.05, 0.5).translate(0, 1.05, 0), 0xf2efe6);
  const tube = new THREE.CylinderGeometry(0.11, 0.11, 0.46, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 1.15, 0);
  put(tube, 0x222222);
  put(new THREE.BoxGeometry(0.22, 0.1, 0.46).translate(0, 1.125, 0), 0x222222);
  put(new THREE.BoxGeometry(0.22, 0.2, 0.012).translate(0, 1.16, 0.232), 0x2a2a2a); // (its door)
  put(new THREE.BoxGeometry(0.01, 0.16, 0.035).translate(0.12, 1.26, -0.05), 0xc0201b); // the flag
  for (const g of parts) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  const geo = mergeAll(parts);
  const o = new THREE.Group();
  const mesh = new THREE.Mesh(geo, paint);
  mesh.castShadow = false; mesh.receiveShadow = true;
  o.add(mesh);
  return { o, parts: [{ geo, mat: paint, M: new THREE.Matrix4() }] };
}
function mergeAll(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}
