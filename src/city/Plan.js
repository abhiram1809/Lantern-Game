// Coast City laid out (2026-11-19, the open world: the user's "four kilometres", a dense core of a
// kilometre and a half round Hal's blocks, downtown and the waterfront, and the rest of the city round it
// built to be seen from the street and the air). In the lot's frame (LOT in Ferris.js): x east, z north
// (the field is 6 km south down the road), y up.
//
// Streets: north-south ones every 80 m (x = 6 + 80k: the boulevard is k = 0, Ocean Avenue along the beach
// k = -14), east-west ones every 200 m (z = 70 + 200n) and Hal's cross street at z -210. A block between
// them is 56 m across: two rows of lots back to back with a 6 m alley between, each lot's building facing
// its street, the corner ones turning the corner with shops or windows down their sides. Downtown the
// blocks are whole plots: towers on plazas, the old masonry office blocks between them.
//
// Everything here is description (buildings as the kit's specs, Building.js and Tower.js): Stream.js
// builds a block when the camera comes near it and puts it away when it goes, and draws the rest as
// shaded boxes.

// The city's shape (the map rework, 2026-11-24) is city/Layout.js: the sea, the bay, the river, the port, the
// districts, Highway 1 and the hills. The grid's streets are as they were (Hal's blocks stand on them), running now
// from the bay's shore to the shipyards and from Ocean Avenue to the river, and there are blocks only where the
// layout has the land for them.
import { GRID, DOWNTOWN_CORE, MEMORIAL, blockAt, districtAt, waterAt } from './Layout.js';

// the city's extent (the ground's): the beach's Point out to x -1700, the river's bank, the bay's shore, the shipyards
export const CITY = { x0: -1800, x1: 1420, z0: -1000, z1: 3100 };
export const CORE = { x0: -1240, x1: 300, z0: -1000, z1: 1060 };
export const K_MIN = GRID.kMin, K_MAX = GRID.kMax;
export const streetX = (k) => 6 + 80 * k;
export const STREET_Z = GRID.rows;
const ROW_EDGES = STREET_Z;
// a street's half widths: the kerb from its middle, and the pavement's outer edge (where the fronts stand)
export const NS = { kerb: 7, front: 12 }, EW = { kerb: 6, front: 11 };
const frontOf = (k) => (k === 0 ? 11.9 : NS.front); // (the boulevard's are Hal's blocks': -5.9 and 17.9)
// Hal's lot and his building, at the head of the boulevard: nothing's built there
export const HALS_LOT = { x0: -32, x1: 44, z0: -24, z1: 59 };
export const DOWNTOWN = { x: DOWNTOWN_CORE.x, z: DOWNTOWN_CORE.z };

// the shore, the line where the sand meets the sea: a long, gentle curve of beach
export const shoreX = (z) => -1205 + 26 * Math.sin(z / 330) + 11 * Math.sin(z / 103 + 1.0);
export const SHORE_GLSL = (z) => `(-1205.0 + 26.0 * sin(${z} / 330.0) + 11.0 * sin(${z} / 103.0 + 1.0))`;
// The coast in the world's frame (the field's): the long Pacific shore west of the desert, and Coast
// City's bay, where it comes in to the city's beach (the shore above) for the four kilometres of town
// and a few either side, sweeping back out beyond. (Ferris.js's airspace, its sea and the desert's edge)
export const LOT_Z = 6000;
const COAST_BASE = (z) => -6800 + 650 * Math.sin(z / 2300) + 320 * Math.sin(z / 770 + 1.3) + 140 * Math.sin(z / 260);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BAY = (z) => ss(2400, 5000, z) * (1 - ss(10200, 12800, z));
export const coastX = (z) => COAST_BASE(z) + (shoreX(z - LOT_Z) - COAST_BASE(z)) * BAY(z);
export const COAST_GLSL = (z) => `mix(-6800.0 + 650.0 * sin(${z} / 2300.0) + 320.0 * sin(${z} / 770.0 + 1.3) + 140.0 * sin(${z} / 260.0), ${SHORE_GLSL(`(${z} - ${LOT_Z.toFixed(1)})`)}, smoothstep(2400.0, 5000.0, ${z}) * (1.0 - smoothstep(10200.0, 12800.0, ${z})))`;
// Ocean Avenue's promenade, from its kerb west to the sea wall; the pier out from it
export const PROMENADE = { x0: -1133, x1: streetX(-14) - NS.kerb };
export const PIER = { z: 372, x0: -1133, x1: -1545, w: 14, deck: 4.2 };
// a seeded random, so the city comes out the same every time
export function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const range = (rnd, a, b) => a + rnd() * (b - a);

// what a point of the city is, as the blocks have it ('downtown', 'suburbia', 'town', 'waterfront', ...)
export function district(x, z) {
  const d = districtAt(x, z);
  return d ? ({ oldtown: 'town', marina: 'town', southshore: 'suburbia', heights: 'suburbia', north: 'industrial' })[d.id] ?? d.id : null;
}
export const inCore = (x, z) => x >= CORE.x0 && x < CORE.x1 && z >= CORE.z0 && z < CORE.z1;

// ------------------------------------------------------------------------------------- the blocks
// Each block: its fronts (x0 west, x1 east, z0 south, z1 north), the streets along its sides, and what it is (as
// Layout.js blockAt has it: a district, or open ground: a park, a plaza). Beside the boulevard by Hal's blocks
// only the outer half is the city's (`half`: the side that's built; `halRow` which of his two blocks): the inner
// half is Hal's (city/HalsBlock.js), or his lot.
let CELLS = null;
export function cityCells() {
  if (CELLS) return CELLS;
  const cells = [];
  for (let j = K_MIN; j < K_MAX; j++) for (let r = 0; r + 1 < ROW_EDGES.length; r++) {
    const z0 = ROW_EDGES[r] + EW.front, z1 = ROW_EDGES[r + 1] - EW.front;
    const x0 = streetX(j) + frontOf(j), x1 = streetX(j + 1) - frontOf(j + 1);
    const b = blockAt(x0, z0, x1, z1);
    if (!b) continue;
    const f = b.fronts ?? { x0, z0, x1, z1 }; // (a block cut back from the water: its side there faces the shore, no street)
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const cell = { id: `${j},${r}`, j, r, x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, cx, cz, south: true, north: true, west: true, east: true,
      district: b.district, core: inCore(cx, cz), seed: (j + 100) * 7919 + r * 104729 + 13 };
    if (b.shore) { cell[b.shore] = false; cell.shore = b.shore; }
    if (b.near !== undefined) cell.near = b.near;
    if (b.park) { cell.park = b.park; cell.parkId = b.parkId; }
    if ((j === -1 || j === 0) && z1 > -420 && z0 < 70) { cell.half = j === -1 ? 'west' : 'east'; cell.halRow = cz > -210 ? 'north' : 'south'; }
    else if (!cell.park && ['suburbia', 'town', 'ring', 'midtown'].includes(cell.district)) {
      // a few small parks among the houses and the shops (a hash: the seeded random's first number runs in stripes)
      const nearHal = Math.abs(j) <= 2 && cz > -700 && cz < 400;
      const h = Math.abs(Math.sin(j * 12.9898 + r * 78.233) * 43758.5453) % 1;
      if (!nearHal && h < 0.045) cell.park = 'park';
    }
    cells.push(cell);
  }
  return (CELLS = cells);
}

// The streets as they're built: a stretch of street between two crossings runs only where there's a block beside
// it (built, or open ground), not through a park of several blocks or the memorial park, and not out over the water.
// The ground paints these, the traffic drives them, the people walk them, the map draws them. Each
// { ns: true, k, x, z0, z1 } (north-south, between the crossings at z0 and z1) or { ew: true, s, z, x0, x1 }.
let SEGS = null;
export function streetSegments() {
  if (SEGS) return SEGS;
  const at = new Map(cityCells().map((c) => [`${c.j},${c.r}`, c]));
  const cell = (j, r) => at.get(`${j},${r}`);
  // (a block counts for the street along a side only if that side has one: not the side it was cut back from the water)
  const open = (a, b) => (a || b) && !(a && b && a.parkId && a.parkId === b.parkId);
  const memorial = (x, z0, z1) => x > MEMORIAL.x0 && x < MEMORIAL.x1 && z1 > MEMORIAL.z0 && z0 < MEMORIAL.z1;
  const dry = (ax, az, bx, bz) => { for (let t = 0; t <= 1.0001; t += 0.05) if (waterAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false; return true; };
  const segs = [];
  for (let k = K_MIN; k <= K_MAX; k++) for (let r = 0; r + 1 < ROW_EDGES.length; r++) {
    const x = streetX(k), z0 = ROW_EDGES[r], z1 = ROW_EDGES[r + 1];
    const boul = k === 0 && z0 >= -935 && z1 <= 70; // (the boulevard and the road south from it: always there)
    const w = cell(k - 1, r), e = cell(k, r);
    // (the boulevard ends at Hal's lot, at the head of his blocks)
    if (boul) segs.push({ ns: true, k, x, z0, z1: Math.min(z1, HALS_LOT.z0) });
    else if (open(w?.east !== false && w, e?.west !== false && e) && !memorial(x, z0 + EW.front, z1 - EW.front) && dry(x, z0, x, z1)) segs.push({ ns: true, k, x, z0, z1 });
  }
  for (let s = 0; s < ROW_EDGES.length; s++) for (let k = K_MIN; k < K_MAX; k++) {
    const z = ROW_EDGES[s], x0 = streetX(k), x1 = streetX(k + 1), sth = cell(k, s - 1), nth = cell(k, s);
    if (open(sth?.north !== false && sth, nth?.south !== false && nth) && dry(x0, z, x1, z)) segs.push({ ew: true, s, z, x0, x1 });
  }
  return (SEGS = segs);
}

// ------------------------------------------------------------------------------------- the faces
// What fills a block's side, south to north (its west side) or north to south (its east side), as the
// kit's buildings: `at` the front's left corner, `yaw` facing the street. A face's first building's left
// side and its last's right side turn the corners.
export function planCell(cell) {
  if (cell.park) return []; // (open ground: Stream.js lays a park out)
  const rnd = seeded(cell.seed), out = [];
  if (cell.district === 'port') { // a container yard (its stacks are Port.js's): one shed across its north end, by the gate
    const w = 24, spec = style('warehouse', rnd, w, cell.x1 - cell.x0, { L: 'windows', R: 'front' }, cell);
    return [{ ...spec, at: { x: cell.x0, y: 0, z: cell.z1 - w }, yaw: -Math.PI / 2, w, kind: 'building' }];
  }
  const width = cell.x1 - cell.x0;
  if (cell.district === 'downtown' && !cell.half) return downtown(cell, rnd);
  const deep = cell.half ? 26 : Math.min(25, (width - 6) / 2);
  for (const side of cell.half ? [cell.half] : ['west', 'east']) {
    const k = side === 'west' ? cell.j : cell.j + 1;
    out.push(...face(cell, rnd, side, deep, faceKind(cell, k, rnd)));
  }
  return out;
}

function faceKind(cell, k, rnd) {
  const d = cell.district;
  if (d === 'waterfront') return 'deco';
  if (d === 'midtown') return rnd() < 0.55 ? 'midrise' : 'mixed';
  if (d === 'industrial' || d === 'port') return 'warehouse';
  // Suburbia (city/Layout.js): houses on their lots, shops along every fifth street
  if (d === 'suburbia') return Math.abs(k) % 5 === 0 ? 'shops' : rnd() < 0.82 ? 'houses' : 'homes';
  if (d === 'town') return Math.abs(k) % 2 === 0 || rnd() < 0.3 ? 'shops' : 'homes';
  // the ring: shops along every fifth street (its avenues), homes and courts between
  return Math.abs(k) % 5 === 0 ? 'shops' : cell.cz > 2200 && rnd() < 0.6 ? 'houses' : 'homes';
}

function face(cell, rnd, side, deep, kind) {
  const west = side === 'west', len = cell.z1 - cell.z0;
  const startOpen = west ? cell.south : cell.north, endOpen = west ? cell.north : cell.south; // (a street at the face's ends)
  const xf = west ? cell.x0 : cell.x1, yaw = west ? -Math.PI / 2 : Math.PI / 2;
  const list = [];
  let u = 0;
  while (u < len - 0.5) {
    let w = widthFor(kind, rnd);
    if (len - u - w < 9) w = len - u; // (the last one takes what's left)
    const gap = kind === 'houses' && u + w < len - 12 ? range(rnd, 2.5, 4.5) : 0;
    list.push({ u, w: Math.min(w, len - u) });
    u += w + gap;
  }
  return list.map(({ u, w }, i) => {
    const cornerL = i === 0, cornerR = i === list.length - 1;
    const spec = style(kind, rnd, w, Math.min(deep, kind === 'houses' ? 15 : deep), {
      L: cornerL ? (startOpen ? 'front' : 'windows') : kind === 'houses' ? 'windows' : 'party',
      R: cornerR ? (endOpen ? 'front' : 'windows') : kind === 'houses' ? 'windows' : 'party',
    }, cell);
    const z = west ? cell.z0 + u : cell.z1 - u;
    return { ...spec, at: { x: xf, y: 0, z }, yaw, w, kind: spec.kind ?? 'building' };
  });
}

const widthFor = (kind, rnd) => ({
  shops: pick(rnd, [12, 14, 16, 16, 18, 20, 22, 24]), homes: pick(rnd, [16, 20, 22, 24, 26, 28]), houses: pick(rnd, [11, 12, 13, 14]),
  deco: pick(rnd, [18, 22, 24, 28, 30, 34]), midrise: pick(rnd, [20, 24, 28, 32, 36]), mixed: pick(rnd, [16, 18, 20, 24]), warehouse: pick(rnd, [24, 30, 36, 44]),
})[kind] ?? 20;

// ------------------------------------------------------------------------------------- palettes
const STUCCO = [0xead9bb, 0xe6b9a2, 0xecdcae, 0xf1e9d6, 0xf0cf7c, 0xd9d2c4, 0xc4dbd0, 0xdad4ca, 0xf3f0e8, 0xf5f0e6, 0xf3c4d0, 0xb6cde0, 0xe8c2a4,
  0xead9bf, 0xe2e5e8, 0xf0e2b6, 0xd8c7e0, 0xcfe3d4, 0xf2d0b4, 0xe9e1cf, 0xf4e4c4, 0xdfe8e4];
const PASTEL = [0xf3d1dc, 0xbfe3e0, 0xf6e7b0, 0xd8e8f5, 0xf4f0e6, 0xe8d5f0, 0xf8d9b8, 0xc9ead1, 0xf7ecd6];
const ACCENT = [0x2f8a8a, 0xd0567a, 0x3a6fb0, 0xd89a2a, 0x6a4a9a, 0x2f6f7a, 0xb8322a];
const STONE = [0xd9d2c4, 0xe3d7bd, 0xcfc6b6, 0xbfb6a6, 0xe8e0d0, 0xd2c3a8, 0xc9bfae];
const TRIMS = [0xf3ecd8, 0xe2d6bc, 0xefe2d0, 0xd8c8a8, 0xf4ece0, 0x8a5a3a, 0xa8321f, 0x2f5f8a, 0x2a4f8a, 0xb4532a, 0x3a4a8a];
const FRAMES = [0xf2efe6, 0x2f4a3a, 0x3b3027, 0x4a3324, 0xf1f1ec, 0x2a2420, 0xe8ebee, 0x2f6f7a, 0x6a2a22, 0x34383a];
const SHOPFRAMES = [0x222222, 0x3a2a1c, 0xc7ccd0, 0x2a3d34, 0x1e2a3a, 0x4a3324, 0x2f6b45];

// Shop signs (made up: none of them a real business), each drawn once into the city's atlas and used
// wherever its shop comes up again, as chains are
const SIGNS = [
  ['Bay Liquor', 'Beer · Wine · Lotto', 'lightbox', '#f4f1ea', '#c0201b', '#1f3d7a', 'condensed', 'OPEN'],
  ['Golden Wok', 'Chinese Food · To Go', 'lightbox', '#b3221c', '#ffd76a', '#ffd76a', 'serif', 'OPEN'],
  ['Taquería El Sol', 'Tacos · Burritos · Tortas', 'board', '#d0782a', '#fff3d6', '#2f6b45', 'script', 'ABIERTO'],
  ['Pacific Cleaners', 'One-Hour Service', 'lightbox', '#ffffff', '#1f5a8a', '#c0201b', 'sans', 'OPEN'],
  ['Marina Bakery', 'Bread · Cakes · Coffee', 'board', '#f6e2b0', '#8a2a1a', '#2f5a3e', 'serif', null],
  ['Seaside Shoes', 'Repairs While You Wait', 'board', '#24443a', '#f3e8cf', '#d9b25c', 'serif', null],
  ['Del Rey Pharmacy', 'Prescriptions · Photo', 'lightbox', '#127a74', '#ffffff', '#ffcf5a', 'sans', null],
  ['Lucky Star Donuts', 'Open All Night', 'lightbox', '#fbe7ee', '#8a3b1e', '#e0457b', 'script', 'OPEN 24'],
  ['Rex Hardware', 'Paint · Keys · Garden', 'board', '#a7321f', '#fff6e0', '#f2c12e', 'slab', null],
  ['Sunrise Market', 'Groceries · Produce · Deli', 'lightbox', '#2f6b45', '#ffffff', '#ffd23f', 'condensed', 'OPEN'],
  ['Joe’s Barber Shop', 'Haircuts · Shaves', 'board', '#1d3b5a', '#f3e8cf', '#c0201b', 'script', 'OPEN'],
  ['Casa Pepe', 'Mexican Restaurant', 'board', '#2f6b45', '#fff3d6', '#c0201b', 'script', 'ABIERTO'],
  ['Ocean Video', 'Rentals · New Releases', 'lightbox', '#1a2050', '#ffe066', '#ff5a3c', 'condensed', 'OPEN'],
  ['Coast Insurance', 'Auto · Home · Life', 'board', '#f2efe6', '#1f3d7a', '#c0201b', 'serif', null],
  ['Shell Beach Surf', 'Boards · Wax · Rentals', 'board', '#2f8a8a', '#ffffff', '#ffd23f', 'script', null],
  ['Tony’s Deli', 'Sandwiches · Salads', 'board', '#f4f1ea', '#2f6b45', '#c0201b', 'script', 'OPEN'],
  ['Phở Bay', 'Vietnamese Noodles', 'lightbox', '#a8321f', '#fff1c8', '#ffd23f', 'sans', 'OPEN'],
  ['Kim’s Nails', 'Manicure · Pedicure', 'lightbox', '#f3cfd8', '#8a4a5a', '#ffffff', 'script', 'OPEN'],
  ['Westside Books', 'New · Used · Rare', 'board', '#2a3a2a', '#f3e8cf', '#d9b25c', 'serif', null],
  ['Coast Optical', 'Eye Exams · Glasses', 'board', '#ffffff', '#1f4f8a', '#1f4f8a', 'sans', null],
  ['Harbor Bank', 'Savings · Loans', 'board', '#e3d7bd', '#26324a', '#26324a', 'deco', null],
  ['El Toro Carnicería', 'Meats · Groceries', 'board', '#c0201b', '#ffffff', '#ffd23f', 'slab', 'ABIERTO'],
  ['Wash-O-Rama', 'Coin Laundry', 'lightbox', '#2a6fb0', '#ffffff', '#ffd23f', 'script', 'OPEN'],
  ['Bella Pizza', 'By the Slice', 'board', '#2f6b45', '#ffffff', '#c0201b', 'script', 'PIZZA'],
  ['Hollis TV & Radio', 'Sales · Service', 'lightbox', '#1a2050', '#ffe066', '#7fd4ff', 'deco', null],
  ['Ace Pawn', 'Loans · Gold · Tools', 'board', '#f2c12e', '#1d1d1d', '#a5281e', 'condensed', null],
  ['Sea Breeze Café', 'Breakfast · Lunch', 'board', '#5a2a1e', '#f6e7c8', '#e8b04a', 'serif', 'OPEN'],
  ['Mariposa Flowers', 'For Every Occasion', 'board', '#2f5a3e', '#fbf1d8', '#e0a2b8', 'script', null],
  ['Cuts by Carla', 'Salon · Walk-ins', 'board', '#8a4a5a', '#fff1f4', '#f0c0cc', 'script', null],
  ['Palm Tree Motors', 'Used Cars · Financing', 'board', '#ffffff', '#c0201b', '#1f3d7a', 'condensed', null],
  ['Seoul Garden', 'Korean BBQ', 'lightbox', '#20262e', '#ff8a2a', '#ffffff', 'sans', 'OPEN'],
  ['Pacific Records', 'Vinyl · Tapes · CDs', 'board', '#1b1b1b', '#ff8a2a', '#f2e6c8', 'slab', null],
  ['Bayside Dental', 'Family Dentistry', 'lightbox', '#ffffff', '#2f8a8a', '#2f8a8a', 'sans', null],
  ['Corner Café', 'Espresso · Pastries', 'board', '#2a1e16', '#f6e7c8', '#d9b25c', 'script', null],
  ['Mel’s Hot Dogs', 'Chili Dogs · Fries · Shakes', 'lightbox', '#f7d21e', '#c0201b', '#c0201b', 'slab', 'OPEN'],
  ['Thrifty Corner', 'Clothing · Furniture', 'board', '#f0e6d0', '#6a2a22', '#2f5a3e', 'slab', null],
  ['Coast Hobby', 'Models · Trains · Kites', 'board', '#1f4f9a', '#ffffff', '#f2c12e', 'condensed', null],
  ['Royal Tailor', 'Alterations · Suits', 'board', '#1e2a3a', '#e8d9b0', '#d9b25c', 'serif', null],
  ['Ruby’s Bar', 'Cocktails · Pool', 'lightbox', '#16324f', '#7fd4ff', '#ffffff', 'script', 'COCKTAILS'],
  ['Sun Tan Supply', 'Beach · Swim · Sun', 'board', '#f6e7b0', '#d0567a', '#2f8a8a', 'script', null],
  ['Pier Liquors', 'Ice · Beer · Snacks', 'lightbox', '#ffffff', '#1f3d7a', '#c0201b', 'condensed', 'OPEN'],
  ['Los Arcos', 'Panadería · Café', 'board', '#f6e2b0', '#8a2a1a', '#2f5a3e', 'serif', null],
  ['Bay Cyclery', 'Sales · Repairs', 'board', '#2f6f7a', '#ffffff', '#f2c12e', 'sans', null],
  ['Star Jewelers', 'Watches · Repairs', 'board', '#1d1d1d', '#e8c862', '#e8c862', 'deco', null],
].map(([text, sub, style, bg, fg, accent, font, neon]) => ({ text, sub, style, bg, fg, accent, font, neon, h: 0.95 }));
const SIGNS_SEA = [5, 14, 26, 39, 40, 1, 33, 15]; // (along the front: surf, swimwear, cafés)
const APTS = ['THE SEAVIEW', 'CASA DEL MAR', 'LAS PALMAS', 'THE BREAKERS', 'VILLA ROSA', 'SUNSET COURT', 'THE CORAL', 'EL MIRADOR', 'BAYVIEW ARMS',
  'THE MONTEREY', 'CASA BONITA', 'HARBOR COURT', 'THE AVALON', 'LA PLAYA', 'THE ALTAIR', 'SANTA INÉS', 'THE ROYALE', 'MAR VISTA'];
const HOTELS = ['HOTEL DEL PLAYA', 'THE SURFRIDER', 'HOTEL MIRAMAR', 'THE SANDS', 'OCEAN HOUSE', 'THE CAPRI', 'HOTEL PACIFICA', 'THE TIDES'];
const FIRMS = ['PACIFIC TRUST', 'COAST CITY BANK', 'THE HALLORAN BUILDING', 'MERCHANTS EXCHANGE', 'BAY INSURANCE', 'THE CARLISLE', 'WESTERN UNION SAVINGS', 'THE FAIRFAX'];
const WAREHOUSE = ['COAST CITY FREIGHT', 'PACIFIC STEEL CO.', 'BAYSIDE FURNITURE', 'WESTERN CANNERY', 'ACME MACHINE WORKS', 'HARBOR PAPER CO.', 'DEL MAR TILE', 'SUNKIST CRATE CO.'];
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

// shop fronts across a ground floor of width w: one or two, and a door to the flats between them
function shopsFor(rnd, w, { pool = null, entry = false, pentP = 0, awningP = 0.4 } = {}) {
  const n = w > 21 ? 2 : 1, gap = entry ? 2.8 : 0, shops = [], entries = [];
  const span = (w - 0.8 - gap) / n;
  let x = 0.4;
  for (let i = 0; i < n; i++) {
    if (i === 1 && entry) { entries.push({ x: x + gap / 2, w: 1.9, h: 3.0, arch: rnd() < 0.5 ? 0.95 : 0, color: pick(rnd, [0x3a2a1c, 0x2f4a3a, 0x22403f, 0x4a3324]) }); x += gap; }
    const sg = pool ? SIGNS[pick(rnd, pool)] : pick(rnd, SIGNS);
    shops.push({ x0: x, x1: x + span, sign: sg, awning: rnd() < awningP ? Math.floor(rnd() * 4) : undefined, pent: rnd() < pentP, door: pick(rnd, ['left', 'right', 'centre']),
      frame: pick(rnd, SHOPFRAMES), kick: pick(rnd, ['patio', 'paint', 'checker', 'patio']), kickColor: pick(rnd, [0x2d2a27, 0x1f4f9a, 0x6a2a22, 0x2f4a3a]),
      neon: sg.neon && rnd() < 0.45 ? sg.neon : undefined, shutter: rnd() < 0.12 ? range(rnd, 0.2, 0.9) : undefined });
    x += span;
  }
  return { shops, entries };
}
// a corner building's shops round its side, a window or two of them from the front corner back
const sideShops = (rnd, d, sh) => (sh?.length ? [{ x0: 0.6, x1: Math.min(d - 1.2, 10.5), clear: false, kick: sh[0].kick, frame: sh[0].frame, door: 'left', h: 3.1, room: 1 }] : undefined);

// One building's spec by its kind (the kit's vocabulary: Building.js), `sides` its corners' sides
function style(kind, rnd, w, d, sides, cell) {
  const common = { d, color: pick(rnd, STUCCO), trim: pick(rnd, TRIMS), frame: pick(rnd, FRAMES), sides: { L: sides.L, R: sides.R }, ac: 0.3 };
  const corner = (o) => { // shops round a corner that faces a street
    if (sides.L === 'front') o.shopsL = sideShops(rnd, d, o.shops);
    if (sides.R === 'front') o.shopsR = sideShops(rnd, d, o.shops);
    return o;
  };
  switch (kind) {
    case 'shops': {
      const floors = rnd() < 0.5 ? 1 : 2;
      const { shops, entries } = shopsFor(rnd, w, { entry: floors > 1 && w > 15, pentP: floors === 1 ? 0.25 : 0 });
      const gable = floors === 1 && w <= 18 && rnd() < 0.3 ? { width: range(rnd, 0.45, 0.6), rise: range(rnd, 1.1, 1.5) } : undefined;
      return corner({ ...common, floors, gh: range(rnd, 4.3, 4.8), fh: 3.1, parapet: floors === 1 ? range(rnd, 0.9, 1.5) : 0.95, gable, coping: gable || rnd() < 0.3 ? 'tile' : 'cap',
        belt: floors > 1 && rnd() < 0.6, cornice: rnd() < 0.5, wall: rnd() < 0.15 ? 'pbrick' : 'stucco', shops, entries, bays: Math.max(2, Math.round((w - 1) / 3.3)),
        bands: !gable && rnd() < 0.18 ? [3.9, 4.1] : undefined, bandColor: pick(rnd, ACCENT) });
    }
    case 'mixed': {
      const floors = 2 + Math.floor(rnd() * 3);
      const { shops, entries } = shopsFor(rnd, w, { entry: true });
      return corner({ ...common, floors, gh: 4.3, fh: range(rnd, 3.0, 3.2), parapet: 1.0, belt: true, cornice: true, wall: pick(rnd, ['stucco', 'stucco', 'pbrick', 'brick']),
        shops, entries, bays: Math.max(3, Math.round((w - 1) / 3.2)), balconies: rnd() < 0.35 ? [1, 2].filter((f) => f < floors) : undefined, balconyBays: [1, Math.max(2, Math.round((w - 1) / 3.2) - 2)] });
    }
    case 'homes': {
      const floors = rnd() < 0.7 ? 2 : 3, hip = rnd() < 0.4, bays = Math.max(3, Math.round((w - 1) / 3.3));
      const ex = w / 2, gw = [];
      for (let i = 0; i < bays; i++) { const u = (w * (i + 0.5)) / bays; if (Math.abs(u - ex) > 1.9) gw.push(u); }
      return { ...common, floors, gh: range(rnd, 3.6, 3.9), fh: 3.05, roof: hip ? 'hip' : undefined, parapet: hip ? 0 : range(rnd, 0.8, 1.2), coping: rnd() < 0.4 ? 'tile' : 'cap',
        win: { w: range(rnd, 1.05, 1.3), h: range(rnd, 1.4, 1.6), arch: rnd() < 0.3 ? 0.35 : 0, sill: 0.85 }, bays, groundWindows: gw, bars: rnd() < 0.55,
        balconies: rnd() < 0.3 ? [1] : undefined, balconyBays: [1, bays - 2], entries: [{ x: ex, w: 2.2, h: 3.0, arch: rnd() < 0.6 ? 1.1 : 0, color: pick(rnd, [0x3a2a1c, 0x2a1e16, 0x22403f]) }],
        belt: rnd() < 0.3, label: rnd() < 0.6 ? { text: pick(rnd, APTS), sub: 'Apartments', style: 'letters', fg: '#5a3a24', font: pick(rnd, ['serif', 'deco', 'script']), wear: 0.2 } : undefined };
    }
    case 'houses': {
      const bays = Math.max(2, Math.round((w - 1) / 3.6)), gw = [];
      for (let i = 0; i < bays; i++) { const u = (w * (i + 0.5)) / bays; if (Math.abs(u - w * 0.3) > 1.4) gw.push(u); }
      return { ...common, color: pick(rnd, [...STUCCO, ...PASTEL]), floors: 1, gh: 3.4, roof: 'hip', pitch: range(rnd, 0.35, 0.5), parapet: 0, back: true,
        win: { w: 1.2, h: 1.35, sill: 0.9 }, groundWindows: gw, bars: rnd() < 0.3, entries: [{ x: w * 0.3, w: 1.1, h: 2.3, color: pick(rnd, [0x8a3a2a, 0x2f4a3a, 0x3a5a7a, 0xf2efe6]) }] };
    }
    case 'deco': {
      const floors = 3 + Math.floor(rnd() * 4), H = 4.4 + (floors - 1) * 3.1, accent = pick(rnd, ACCENT);
      const sea = cell.district === 'waterfront';
      const { shops, entries } = shopsFor(rnd, w, { entry: true, pool: sea ? SIGNS_SEA : null, awningP: 0.55 });
      const at = [0.3, w - 0.3];
      if (w > 22) at.splice(1, 0, w / 2 - 2.2, w / 2 + 2.2);
      return corner({ ...common, color: pick(rnd, PASTEL), trim: accent, frame: rnd() < 0.5 ? 0xf4f0e6 : accent, floors, gh: 4.4, fh: 3.1, parapet: range(rnd, 1.2, 1.9), coping: 'cap',
        bands: [H + 0.25, H + 0.45, H + 0.65], bandColor: accent, deco: { at, w: 0.6, up: range(rnd, 0.6, 1.4), color: undefined }, belt: true, bays: Math.max(4, Math.round((w - 1) / 3.0)),
        win: { w: 1.4, h: 1.6, sill: 0.8 }, balconies: rnd() < 0.5 ? [2, 3, 4].filter((f) => f < floors) : undefined, balconyBays: [0, Math.max(1, Math.round((w - 1) / 3.0) - 1)],
        shops, entries, label: { text: pick(rnd, rnd() < 0.5 ? HOTELS : APTS), style: 'letters', fg: hex(accent), font: 'deco', wear: 0.1 }, labelW: Math.min(6, w / 2 - 2), labelTop: true });
    }
    case 'midrise': {
      const floors = 5 + Math.floor(rnd() * 8), wall = pick(rnd, ['stucco', 'pbrick', 'brick', 'stucco']);
      const { shops, entries } = shopsFor(rnd, w, { entry: true, awningP: 0.2 });
      return corner({ ...common, color: wall === 'brick' ? 0xffffff : pick(rnd, STONE), trim: pick(rnd, [0xe6e0d4, 0xd8cdb8, 0xefe6d2]), frame: pick(rnd, [0x34383a, 0x3b3027, 0x4a3d2c, 0x2a2420]),
        wall, floors, gh: 5.0, fh: 3.5, parapet: 1.3, belt: true, cornice: true, bays: Math.max(4, Math.round(w / 3.2)), win: { w: 1.4, h: 1.95, sill: 0.8 },
        deco: rnd() < 0.3 ? { at: [0.3, w - 0.3], w: 0.7, up: 1.0 } : undefined, shops, entries, ac: 0.15,
        label: rnd() < 0.5 ? { text: pick(rnd, FIRMS), style: 'letters', fg: '#26324a', font: 'deco', wear: 0.15 } : undefined, labelW: Math.min(7, w / 2 - 2), labelTop: true });
    }
    case 'warehouse': {
      const n = Math.max(1, Math.floor(w / 13)), shops = [];
      for (let i = 0; i < n; i++) { const a = 1.2 + (i * (w - 2.4)) / n; shops.push({ x0: a + 1.2, x1: a + (w - 2.4) / n - 1.2, shutter: range(rnd, 1.6, 3.2), shutterColor: pick(rnd, [0x9aa39a, 0x6a7a8a, 0xa08a6a]), kick: 'paint', kickColor: 0x3a3a38, frame: 0x2a2a28, door: 'left', h: 4.2, room: 1, lit: 0.2 }); }
      return { ...common, color: pick(rnd, [0xd8d0c2, 0xc9c0b0, 0xbdb6aa, 0xd2c8b6]), wall: pick(rnd, ['pbrick', 'brick', 'stucco']), floors: 1, gh: range(rnd, 6.5, 8.0), parapet: 1.1,
        bands: [4.9, 5.0], bandColor: 0x6a6660, shops, bays: 0, ac: 0, label: { text: pick(rnd, WAREHOUSE), style: 'letters', fg: '#3a3430', font: 'condensed', wear: 0.5 }, labelW: Math.min(9, w / 2 - 1.5), labelTop: true };
    }
    default: return { ...common, floors: 2 };
  }
}

// ------------------------------------------------------------------------------------- downtown
// The blocks round downtown's middle: whole plots across the block, a tower on its plaza or two old
// office blocks back to back, south to north.
function downtown(cell, rnd) {
  const out = [], width = cell.x1 - cell.x0, len = cell.z1 - cell.z0;
  const near = cell.near ?? 1 - Math.hypot(cell.cx - DOWNTOWN.x, cell.cz - DOWNTOWN.z) / 300; // 1 at the middle (or as city/Layout.js has it)
  let z = cell.z0;
  while (z < cell.z1 - 20) {
    let L = pick(rnd, [44, 50, 56, 62]);
    if (cell.z1 - z - L < 30) L = cell.z1 - z;
    if (rnd() < 0.35 + near * 0.5) {
      const west = rnd() < 0.5, d = width - range(rnd, 4, 10), w = L - range(rnd, 6, 12);
      const floors = Math.round(14 + near * 26 + rnd() * 14);
      const zs = z + (L - w) / 2, xf = west ? cell.x0 + (width - d) / 2 : cell.x1 - (width - d) / 2;
      out.push({ kind: 'tower', at: { x: xf, y: 0, z: west ? zs : zs + w }, yaw: west ? -Math.PI / 2 : Math.PI / 2, w, d, floors, fh: 3.8, lobby: 6.5,
        tiers: floors > 22 ? [{ from: Math.round(floors * range(rnd, 0.5, 0.7)), inset: range(rnd, 2.5, 4.5) }] : [],
        crown: pick(rnd, ['flat', 'stepped', 'mast', 'flat', 'stepped']), glass: pick(rnd, [0x6f8a96, 0x5d7a70, 0x7d8a9a, 0x8a7d6a, 0x4f6478]),
        stone: pick(rnd, [0xd9d2c4, 0xbfb6a6, 0x9a948a, 0xe3d7bd, 0x4a4846]), mullion: pick(rnd, [0xc9ccd0, 0x3a3c40, 0x8a8f94, 0xb08d4a]),
        name: rnd() < 0.5 ? pick(rnd, FIRMS) : undefined, seed: Math.floor(rnd() * 1e6) });
    } else {
      // two masonry blocks back to back, a corner each way
      for (const side of ['west', 'east']) {
        const west = side === 'west', d = Math.min(26, (width - 4) / 2);
        const sp = style('midrise', rnd, L, d, { L: z === cell.z0 && cell.south ? 'front' : 'party', R: z + L >= cell.z1 - 0.5 && cell.north ? 'front' : 'party' }, cell);
        sp.floors += 3;
        if (!west) [sp.sides.L, sp.sides.R] = [sp.sides.R, sp.sides.L], [sp.shopsL, sp.shopsR] = [sp.shopsR, sp.shopsL];
        out.push({ ...sp, kind: 'building', at: { x: west ? cell.x0 : cell.x1, y: 0, z: west ? z : z + L }, yaw: west ? -Math.PI / 2 : Math.PI / 2, w: L });
      }
    }
    z += L;
  }
  return out;
}

// ------------------------------------------------------------------------------------- footprints
// A spec's boxes in the lot's frame (its mass to the top of its parapet, a tower's tiers one each):
// for the shaded boxes that stand in for it far off, and for flying into one that isn't built yet.
export function boxesOf(s) {
  const west = s.yaw < 0; // (facing west: its front runs north from `at`; facing east, south)
  const foot = (inset, y0, y1) => (west
    ? { x0: s.at.x + inset, x1: s.at.x + s.d - inset, z0: s.at.z + inset, z1: s.at.z + s.w - inset, y0, y1 }
    : { x0: s.at.x - s.d + inset, x1: s.at.x - inset, z0: s.at.z - s.w + inset, z1: s.at.z - inset, y0, y1 });
  if (s.kind === 'tower') {
    const H = s.lobby + (s.floors - 1) * s.fh, out = [];
    let y = 0, inset = 0;
    const tiers = [...(s.tiers ?? []), { from: s.floors, inset: 0 }];
    for (const t of tiers) { const y1 = t.from >= s.floors ? H + 2.2 : s.lobby + (t.from - 1) * s.fh; out.push(foot(inset, y, y1)); y = y1; inset += t.inset; }
    return out;
  }
  const H = (s.gh ?? 4.3) + ((s.floors ?? 2) - 1) * (s.fh ?? 3.2);
  return [foot(0, 0, s.roof === 'hip' ? H + ((s.d + 0.9) / 2) * (s.pitch ?? 0.42) * 0.6 : H + (s.parapet ?? 0.95))];
}

// The whole city's buildings, by block, and a grid of their boxes to look a point up in.
export class CityIndex {
  constructor() {
    this.cells = cityCells();
    this.byId = new Map(this.cells.map((c) => [c.id, c]));
    this.grid = new Map();
    this.boxes = [];
    for (const c of this.cells) {
      c.specs = planCell(c);
      c.boxes = [];
      for (const s of c.specs) for (const b of boxesOf(s)) { b.spec = s; b.cell = c; c.boxes.push(b); this.boxes.push(b); this.file(b); }
    }
  }
  file(b) {
    for (let gx = Math.floor(b.x0 / 40); gx <= Math.floor(b.x1 / 40); gx++) for (let gz = Math.floor(b.z0 / 40); gz <= Math.floor(b.z1 / 40); gz++) {
      const k = gx * 100003 + gz;
      (this.grid.get(k) ?? this.grid.set(k, []).get(k)).push(b);
    }
  }
  // whether (x, y, z) is inside a building (with `pad` metres round it)
  solidAt(x, y, z, pad = 0.6) {
    const list = this.grid.get(Math.floor(x / 40) * 100003 + Math.floor(z / 40));
    if (list) for (const b of list) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y > b.y0 - pad && y < b.y1 + pad) return true;
    return false;
  }
  // the block a point is in (or on the pavement round), or null
  cellAt(x, z) {
    for (const c of this.cells) if (x > c.x0 - NS.front && x < c.x1 + NS.front && z > c.z0 - EW.front && z < c.z1 + EW.front) return c;
    return null;
  }
}
