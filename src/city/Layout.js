// Coast City's lie of the land (the map rework, 2026-11-24: the user's "GTA-style Coast City peninsula", their
// reference map "not a hard goal, but a reference"). One place for the shape of the city, which everything that
// builds or draws it reads: the sea's edge, the bay to the south with a bridge over it on the road from the field,
// the river down the city's east side, the port's basin in the north and the marina in the south-west, the
// districts, Highway 1's loop and the hills.
//
// In the lot's frame (LOT in Ferris.js), as Plan.js: x east, z north, so the sea is west and the river east.
// The map draws the ground as the player sees it (facing north, east is on the left: CityMap.js), which puts the
// sea on the right, where the user's reference has it.
//
// What stays where it was, so the story keeps its places: Hal's two blocks and his lot (city/HalsBlock.js) at the
// lot, the street grid round them (Plan.js: streets every 80 m north-south and every 200 m east-west), the beach's
// line and Ocean Avenue by the pier, the pier itself (Part Seven's chapters stand on it), the memorial park south
// of town, and the straight road south to the field (the bay is crossed by a bridge on it).
//
// Pure data and geometry, no three.js: the tools draw it too (tools/draw-layout.mjs).

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// a smooth curve through points (Catmull-Rom), sampled every `step` metres or so; `closed` for a loop
export function smooth(pts, step = 12, closed = false) {
  const n = pts.length, out = [];
  const at = (i) => pts[closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const len = Math.hypot(p2.x - p1.x, p2.z - p1.z), k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const o = { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) };
      for (const key of Object.keys(p1)) if (key !== 'x' && key !== 'z') o[key] = lerp(p1[key], p2[key], t);
      out.push(o);
    }
  }
  if (!closed) out.push({ ...pts[n - 1] });
  return out;
}
const P = (x, z, extra) => ({ x, z, ...extra });

export function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
// the nearest point of a polyline: its distance, where along it (s, metres), and the sample there
export function nearest(line, x, z) {
  let best = { d: Infinity, s: 0, i: 0, t: 0 }, s = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < best.d) best = { d, s: s + Math.sqrt(L2) * t, i, t };
    s += Math.sqrt(L2);
  }
  return best;
}
const sampleAt = (line, n) => { const a = line[n.i], b = line[n.i + 1] ?? a, o = {}; for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k] ?? a[k], n.t); return o; };
export const lengthOf = (line) => { let s = 0; for (let i = 0; i + 1 < line.length; i++) s += Math.hypot(line[i + 1].x - line[i].x, line[i + 1].z - line[i].z); return s; };

// ------------------------------------------------------------------------------------------------ the sea
// The sea's edge down the city's west side, x as a function of z: by the pier exactly the beach Ocean Avenue has
// always had (Plan.js shoreX: the promenade, the lifeguard towers and the pier stand on it), north of it the sand
// running out into a wide point where the amusements are, then in again to the port's mouth, past the breakwater,
// and on up the coast. South of the city the bay comes in (below) and the mainland's coast swings back west.
export const shoreX = (z) => -1205 + 26 * Math.sin(z / 330) + 11 * Math.sin(z / 103 + 1.0);
const COAST_PTS = [
  P(-1720, -2600), P(-1560, -2200), P(-1430, -1900), P(-1330, -1700), // the mainland's headland at the bay's mouth
  P(-1180, -960), P(-1196, -760), // the city's south-west corner (the bay's in between: BAY)
  ...[-560, -360, -160, 40, 240, 440, 640, 840, 1000].map((z) => P(shoreX(z), z)),
  P(-1250, 1140), P(-1420, 1300), P(-1620, 1500), P(-1700, 1720), P(-1650, 1930), P(-1540, 2120), // the Point
  P(-1560, 2260), // the port's mouth (the basin: PORT)
  P(-1640, 2900), P(-1690, 3300), P(-1760, 3800), P(-1900, 4300),
];
const COAST_LINE = smooth(COAST_PTS, 10);
// the world's far coast (Plan.js coastX, the field's frame) this is spliced into, past the ends of the line above
const FAR = (z) => -6800 + 650 * Math.sin(z / 2300) + 320 * Math.sin(z / 770 + 1.3) + 140 * Math.sin(z / 260);
const LOT_Z = 6000;
export function coastAt(z) {
  const L = COAST_LINE, z0 = L[0].z, z1 = L[L.length - 1].z;
  let x;
  // (beyond its ends the line runs on as it was heading, so there's no kink where it meets the far coast)
  if (z <= z0) { const a = L[0], b = L[8]; x = a.x + ((b.x - a.x) / (b.z - a.z)) * (z - a.z); }
  else if (z >= z1) { const a = L[L.length - 9], b = L[L.length - 1]; x = b.x + ((b.x - a.x) / (b.z - a.z)) * (z - b.z); }
  else { let i = 0; while (L[i + 1].z < z) i++; const a = L[i], b = L[i + 1]; x = lerp(a.x, b.x, (z - a.z) / (b.z - a.z || 1)); }
  // out to the far coast beyond the city's stretch (2 km to blend, either end)
  const k = ss(z0 - 2600, z0, z) * (1 - ss(z1, z1 + 2600, z));
  return lerp(FAR(z + LOT_Z), x, k);
}

// The bay: between the city's south shore and the mainland's, from the sea east to past the river's mouth. The
// road from the field crosses it on the bridge (BRIDGE). Its shores as polylines, west to east.
export const BAY_NORTH = smooth([P(-1300, -900), P(-1150, -990), P(-900, -1012), P(-600, -1000), P(-300, -1004), P(6, -992), P(350, -1006), P(700, -986),
  P(1050, -1010), P(1380, -995), P(1620, -1010), P(1800, -1080)], 10);
export const BAY_SOUTH = smooth([P(-1500, -1880), P(-1100, -1790), P(-700, -1760), P(-300, -1745), P(6, -1752), P(400, -1726), P(800, -1748),
  P(1200, -1770), P(1600, -1735), P(1850, -1600), P(1900, -1300), P(1800, -1080)], 10);
const BAY_POLY = [...BAY_NORTH, ...[...BAY_SOUTH].reverse()];

// The river: down the city's east side from the hills of the valley to the bay, a hundred metres across (where the
// old flood channel's column of blocks was). Its middle and width, south to north.
export const RIVER = smooth([P(1520, -1060, { w: 150 }), P(1480, -700, { w: 116 }), P(1530, -300, { w: 104 }), P(1470, 200, { w: 100 }), P(1515, 700, { w: 96 }),
  P(1455, 1200, { w: 96 }), P(1500, 1700, { w: 96 }), P(1580, 2200, { w: 94 }), P(1770, 2700, { w: 90 }), P(2060, 3200, { w: 88 }), P(2420, 3800, { w: 84 }),
  P(2800, 4500, { w: 80 }), P(3200, 5400, { w: 76 })], 10);

// Port Haven: the harbour basin in the north, open to the sea past the breakwater's end, the container quays'
// fingers out into it from the south quay; the shipyards' slips along its north side.
export const PORT = {
  basin: smooth([P(-1600, 2270), P(-1250, 2300), P(-700, 2312), P(-150, 2330), P(220, 2400), P(300, 2600), P(230, 2800), P(-200, 2872), P(-800, 2884), P(-1300, 2872), P(-1640, 2880)], 12),
  quays: [-1150, -800, -450, -100].map((x) => ({ x0: x - 28, x1: x + 28, z0: 2300, z1: 2580 })), // (land: the ships tie up along their sides)
  breakwater: smooth([P(-1300, 2900), P(-1500, 2840), P(-1700, 2700), P(-1790, 2560)], 10),
  slips: [-1100, -850, -600].map((x) => ({ x0: x - 22, x1: x + 22, z0: 2854, z1: 3040 })), // (water: the shipyards' building slips, from inside the basin)
  cranes: [-1150, -800, -450, -100].flatMap((x) => [{ x: x - 32, z: 2400 }, { x: x - 32, z: 2500 }, { x: x + 32, z: 2450 }, { x: x + 32, z: 2540 }]),
  // the shipyards' halls beside the slips, and a gantry over each slip
  sheds: [{ x0: -1250, x1: -1130, z0: 2905, z1: 3060 }, { x0: -1070, x1: -880, z0: 2905, z1: 3000 }, { x0: -820, x1: -630, z0: 2905, z1: 3060 }, { x0: -570, x1: -420, z0: 2905, z1: 2990 }],
};
// The marina: a basin let into the south shore below Old Town, its mouth on the bay
export const MARINA = {
  basin: smooth([P(-960, -1070), P(-955, -900), P(-950, -800), P(-880, -730), P(-560, -730), P(-490, -800), P(-485, -900), P(-480, -1070)], 8), // (its mouth running out into the bay)
  docks: [-880, -800, -720, -640, -560].map((x) => ({ x, z0: -990, z1: -760 })),
};

// ------------------------------------------------------------------------------------------------ land and water
export function riverAt(x, z) {
  if (x < 1200 || z < -1300) return null;
  const n = nearest(RIVER, x, z), w = sampleAt(RIVER, n).w;
  return n.d < w / 2 ? { d: n.d, w } : null;
}
export function waterAt(x, z) {
  if (x < coastAt(z)) return 'sea';
  if (z < -850 && z > -1950 && inPoly(BAY_POLY, x, z)) return 'bay';
  if (riverAt(x, z)) return 'river';
  if (z > 2200 && z < 3100) {
    if (inPoly(PORT.basin, x, z) && !PORT.quays.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) return 'port';
    if (PORT.slips.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1)) return 'port';
  }
  if (z < -700 && z > -1080 && inPoly(MARINA.basin, x, z)) return 'marina';
  return null;
}
export const landAt = (x, z) => !waterAt(x, z);
// the distance to the nearest water, out to `max` metres (a coarse ring search: for keeping things off the shore)
export function shoreDistance(x, z, max = 60) {
  if (waterAt(x, z)) return 0;
  for (let r = 6; r <= max; r += 6) for (let a = 0; a < 12; a++) if (waterAt(x + r * Math.cos(a * 0.5236), z + r * Math.sin(a * 0.5236))) return r;
  return max;
}

// ------------------------------------------------------------------------------------------------ the bridge
// The bridge over the bay on the road from the field (Ferris.js: the road at x 6): cable-stayed, two A-frame
// towers, the deck climbing from the shores to clear the boats. In the lot's frame.
export const BRIDGE = { x: 6, z0: -940, z1: -1820, towers: [-1210, -1530], deck: 26, towerH: 112, half: 11 };
// the road's height on it (0 off it): the deck as Bridge.js builds it (u = -z: 8% at most, about 18 m at the towers,
// 26 m mid-span); Bridge.js deckAt is the same line splined
const BRIDGE_PROFILE = [[940, 0.02], [990, 1.9], [1050, 6.3], [1150, 13.8], [1250, 20.5], [1330, 25.2], [1370, 26.0], [1410, 25.2], [1490, 20.6], [1590, 13.4], [1700, 5.2], [1760, 1.7], [1820, 0.02]];
export function bridgeDeckAt(z) {
  const u = -z, P = BRIDGE_PROFILE;
  if (u < P[0][0] || u > P[P.length - 1][0]) return 0;
  let i = 0; while (P[i + 1][0] < u) i++;
  const t = (u - P[i][0]) / (P[i + 1][0] - P[i][0]);
  return P[i][1] + (P[i + 1][1] - P[i][1]) * t;
}

// ------------------------------------------------------------------------------------------------ Highway 1
// The freeway: a loop on piers round downtown, Old Town, Suburbia and the hills, down the middle of the streets it
// follows (Plan.js streetX / STREET_Z) with its corners swept wide across the blocks, and two spurs across the
// river to the valley. Its deck 11.5 m up (built by Highway.js: its lanes, ramps and junctions as they are).
const HX = { w: -954, e: 1286 }, HZ = { s: -615, n: 2070 }, HR = 320;
const corner = (cx, cz, a0, a1, r, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return P(cx + r * Math.cos(a), cz + r * Math.sin(a)); });
export const HIGHWAY = {
  deck: 11.5, half: 9.4,
  loop: [
    ...corner(HX.e - HR, HZ.s + HR, -Math.PI / 2, 0, HR), // the south-east corner, from the south leg round to the east one
    ...corner(HX.e - HR, HZ.n - HR, 0, Math.PI / 2, HR), // the north-east
    ...corner(HX.w + HR, HZ.n - HR, Math.PI / 2, Math.PI, HR), // the north-west
    ...corner(HX.w + HR, HZ.s + HR, Math.PI, Math.PI * 1.5, HR), // the south-west
  ],
  spurs: [
    smooth([P(HX.e, 1400), P(HX.e + 180, 1600), P(1700, 1780), P(2300, 1900), P(3200, 2000)], 12), // north-east, over the river to the valley
    smooth([P(HX.e - 40, HZ.s + 60), P(1500, -680), P(1900, -720), P(2500, -900), P(3100, -1300)], 12), // south-east, over the river's mouth
  ],
  // where it meets the road from the field (Ferris.js: x 6): ramps down to the road either side
  interchange: { x: 6, z: HZ.s },
};
// (the loop is arcs and straight legs: a spline through the arcs' points overshoots by 160 m where a short step
// meets a long one, so the legs are filled in straight)
function straightLoop(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let j = 0; j < n; j++) out.push(P(lerp(a.x, b.x, j / n), lerp(a.z, b.z, j / n)));
  }
  return out;
}
HIGHWAY.loopLine = straightLoop(HIGHWAY.loop, 12);
HIGHWAY.lines = [HIGHWAY.loopLine, ...HIGHWAY.spurs];
export const highwayDistance = (x, z) => Math.min(...HIGHWAY.lines.map((l) => nearest(l, x, z).d));
// whether the deck (and `pad` either side) comes over a rectangle
export function highwayOver(x0, z0, x1, z1, pad = 2) {
  const r = HIGHWAY.half + pad;
  for (const line of HIGHWAY.lines) for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    for (let t = 0; t <= 1; t += 0.25) {
      const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
      if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ the hills
// The Hills, north-east of Suburbia between downtown's park and the river: ground rising to 120 m with a ridge
// running north, terraces of houses on its winding roads, and Coast Park's green slopes down its west side.
const HILL_BUMPS = [[820, 1320, 380, 118], [1080, 1720, 300, 84], [520, 930, 300, 56], [1120, 900, 250, 62], [380, 1600, 260, 50]];
export const HILLS = { x0: 246, x1: 1286, z0: 470, z1: 2070, feather: 160 };
export function heightAt(x, z) {
  const H = HILLS;
  if (x < H.x0 - H.feather - 300 || x > H.x1 + 200 || z < H.z0 - H.feather - 200 || z > H.z1 + 200) return 0;
  let h = 0;
  for (const [bx, bz, r, top] of HILL_BUMPS) { const d2 = ((x - bx) ** 2 + (z - bz) ** 2) / (r * r); h = Math.max(h, top * Math.exp(-d2 * 1.6)); }
  // nothing above the flat city: the ground comes down to street level at the district's edge, the streets round
  // it (x 246, z 470) and the blocks beyond them flat
  const inX = Math.min(x - (H.x0 + 12), H.x1 - 60 - x), inZ = Math.min(z - (H.z0 + 11), H.z1 - 40 - z);
  return h * ss(0, H.feather, Math.min(inX, inZ));
}
// The hill roads: a ridge road along the top, and climbs up to it from Suburbia and from the east
export const HILL_ROADS = [
  smooth([P(300, 2010), P(520, 1830), P(760, 1700), P(980, 1600), P(1160, 1420), P(1200, 1150), P(1150, 950)], 10), // Ridge Drive
  smooth([P(326, 470), P(420, 620), P(350, 760), P(470, 880), P(640, 940), P(700, 1080), P(860, 1150), P(840, 1330), P(760, 1480), P(780, 1690)], 10), // up from Suburbia
  smooth([P(1046, 470), P(980, 640), P(1100, 760), P(1010, 900), P(1150, 950)], 10), // up from the industrial side
  smooth([P(246, 1270), P(380, 1240), P(470, 1340), P(600, 1300), P(700, 1380), P(840, 1330)], 10), // from the park
];
// the observatory on the summit: the place to see the city from
export const OBSERVATORY = { x: 820, z: 1320 };

// ------------------------------------------------------------------------------------------------ districts
// What each part of the city is. The grid's blocks (Plan.js) keep the streets they always had; which blocks there
// are, and what's built on them, comes from here. Rectangles in streets' terms where the grid runs, first match.
export const DISTRICTS = [
  { id: 'beach', name: 'Coast City Beach', test: (x, z) => x < -1133 && z > -760 && z < 2280 },
  { id: 'waterfront', name: 'Ocean Avenue', test: (x, z) => x < sx(-12) && z > -760 && z < HZ.n },
  { id: 'port', name: 'Port Haven', test: (x, z) => z > HZ.n + 20 && x < 400 },
  { id: 'downtown', name: 'Downtown', test: (x, z) => x < sx(-3) && z > 270 && z < 1670 },
  { id: 'midtown', name: 'Midtown', test: (x, z) => x < sx(-3) && z >= 1670 && z < HZ.n },
  { id: 'marina', name: 'The Marina', test: (x, z) => x < sx(-3) && z < HZ.s },
  { id: 'oldtown', name: 'Old Town', test: (x, z) => x < sx(-3) && z < 270 },
  { id: 'park', name: 'Coast Park', test: (x, z) => x < sx(3) && z > 670 && z < 1470 },
  { id: 'hills', name: 'The Hills', test: (x, z) => x >= sx(3) && x < HX.e && z > 470 && z < HZ.n },
  { id: 'heights', name: 'Coast Heights', test: (x, z) => x < HX.e && z >= 1470 && z < HZ.n }, // (the hills' foot north of the park)
  { id: 'cemetery', name: 'Memorial Park', test: (x, z) => x > MEMORIAL.x0 && x < MEMORIAL.x1 && z > MEMORIAL.z0 && z < MEMORIAL.z1 },
  { id: 'southshore', name: 'Bayside', test: (x, z) => z < HZ.s && x < sx(8) },
  { id: 'suburbia', name: 'Suburbia', test: (x, z) => x < sx(8) && z < (x < sx(3) ? 670 : 470) },
  { id: 'industrial', name: 'Eastside Industrial', test: (x, z) => z < 470 },
  { id: 'north', name: 'North Shore', test: (x, z) => z >= HZ.n },
  { id: 'hills', name: 'The Hills', test: () => true },
];
export const districtAt = (x, z) => (landAt(x, z) ? DISTRICTS.find((d) => d.test(x, z)) : null);

const sx = (k) => 6 + 80 * k; // (Plan.js streetX)

// The memorial park (Ferris.js cemetery(): its lawn at x 118..182, z -876..-824, and its drive in from the road along
// z -850) on the bluff over the bay: one open piece of ground from the road to the street at x 246, no blocks and no
// streets across it (Part Three's grave chapter drives in as it always has)
export const MEMORIAL = { x0: 12, x1: 234, z0: -924, z1: -826 };

// The grid: Plan.js's streets (north-south every 80 m, k -14 by the beach to 17 by the river; east-west every 200 m
// and Hal's cross street at -210), now running on south of Hal's blocks to the bay, and north only to the
// shipyards (past them the coast's bare hills)
export const SOUTH_STREETS = [-935, -815, -615, -415];
export const GRID = { kMin: -14, kMax: 17, rows: [...SOUTH_STREETS, -210, ...Array.from({ length: 16 }, (_, n) => 70 + 200 * n)] };
// downtown's towers gather round here, thinning out to its edges (Plan.js downtown(): `near`)
export const DOWNTOWN_CORE = { x: -600, z: 970, r: 560 };
// Open ground: Coast Park between downtown and the hills (one park across what were six blocks, its lawns climbing
// the hills' foot), and downtown's three squares
const block = (j0, j1, zs, ze) => ({ x0: sx(j0) + 12, x1: sx(j1 + 1) - 12, z0: zs + 11, z1: ze - 11 }); // (blocks j0..j1 between the streets at zs and ze)
export const PARKS = [
  { id: 'coast', name: 'Coast Park', ...block(-3, 2, 670, 1470) },
  { id: 'civic', name: 'Civic Plaza', plaza: true, ...block(-8, -8, 870, 1070) },
  { id: 'pershing', name: 'Pershing Square', plaza: true, ...block(-11, -11, 470, 670) },
  { id: 'harbor', name: 'Harbor Square', plaza: true, ...block(-5, -5, 1270, 1470) },
];
export const parkAt = (x, z) => PARKS.find((p) => x > p.x0 - 1 && x < p.x1 + 1 && z > p.z0 - 1 && z < p.z1 + 1);

// Whether a block of the grid is built, and as what (null: no block there). The block's fronts (x0..x1, z0..z1):
// built only where all of it is on land, clear of the highway's sweeping corners (down a street's middle it's no
// trouble) and the hills (which have their own roads and terraces).
const BLOCK_KIND = { downtown: 'downtown', midtown: 'midtown', oldtown: 'town', waterfront: 'waterfront', suburbia: 'suburbia', southshore: 'suburbia', heights: 'suburbia',
  industrial: 'industrial', marina: 'town', north: 'industrial', port: 'port' };
const blockDry = (x0, z0, x1, z1, e = 8) => {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (const [x, z] of [[x0 - e, z0 - e], [x1 + e, z0 - e], [x0 - e, z1 + e], [x1 + e, z1 + e], [cx, z0 - e], [cx, z1 + e], [x0 - e, cz], [x1 + e, cz]]) if (waterAt(x, z)) return false;
  return true;
};
export function blockAt(x0, z0, x1, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = districtAt(cx, cz);
  if (!d) return null;
  const pk = parkAt(cx, cz);
  if (pk) return { district: 'park', park: pk.plaza ? 'plaza' : 'big', parkId: pk.id };
  if (d.id === 'park') return null; // (Coast Park's edges)
  if (d.id === 'cemetery') return null; // (Ferris.js builds it)
  if (d.id === 'hills' || d.id === 'beach') return null;
  if (d.id === 'north' && cz > 2700) return null; // (past the port's yards the coast's bare hills)
  // all of it on land, and its pavements too (8 m out from its fronts); a block the water comes into is cut back
  // from that side (8 m at a time) while what's left is still a block, and that side has no street but the shore
  let shore = null;
  if (!blockDry(x0, z0, x1, z1)) {
    let best = null;
    for (const side of ['south', 'north', 'west', 'east']) {
      const along = side === 'south' || side === 'north', room = along ? z1 - z0 - 40 : x1 - x0 - 36;
      for (let cut = 8; cut <= room; cut += 8) {
        const t = [x0 + (side === 'west' ? cut : 0), z0 + (side === 'south' ? cut : 0), x1 - (side === 'east' ? cut : 0), z1 - (side === 'north' ? cut : 0)];
        if (blockDry(...t)) { if (!best || cut < best.cut) best = { t, side, cut }; break; }
      }
    }
    if (!best) return null;
    [x0, z0, x1, z1] = best.t;
    shore = best.side;
  }
  // the highway: down a street's middle its deck is over the street, not the block; a block it sweeps across
  // on a corner is left open (its piers stand there)
  if (highwayOver(x0, z0, x1, z1, 0)) return null;
  const out = { district: BLOCK_KIND[d.id] ?? 'ring', name: d.name };
  if (shore) Object.assign(out, { shore, fronts: { x0, z0, x1, z1 } });
  if (out.district === 'downtown') out.near = Math.max(0, Math.min(1, 1 - Math.hypot(cx - DOWNTOWN_CORE.x, cz - DOWNTOWN_CORE.z) / DOWNTOWN_CORE.r));
  return out;
}

// The houses on the hills: lots either side of the hill roads, each on its own terrace cut into the slope, facing
// the road (the hills have no grid). A seeded scatter, the same every time.
export function hillPlots() {
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  HILL_ROADS.forEach((road, ri) => {
    let s = 0;
    for (let i = 0; i + 1 < road.length; i++) {
      const a = road[i], b = road[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      s += L;
      if (s < 22) continue;
      s = 0;
      const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
      for (const side of [-1, 1]) {
        if (rnd() < 0.18) continue;
        const off = 15 + rnd() * 4, x = a.x - dz * off * side, z = a.z + dx * off * side;
        const h = heightAt(x, z);
        if (h < 5 || waterAt(x, z) || Math.hypot(x - OBSERVATORY.x, z - OBSERVATORY.z) < 60) continue;
        if (HILL_ROADS.some((r, rj) => rj !== ri && nearest(r, x, z).d < 16)) continue;
        if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 17)) continue;
        out.push({ x, z, y: h, yaw: Math.atan2(dz * side, -dx * side), w: 11 + rnd() * 5, d: 10 + rnd() * 4, seed: Math.floor(rnd() * 1e6) });
      }
    }
  });
  return out;
}

// ------------------------------------------------------------------------------------------------ the map's names
export const LABELS = [
  { text: 'DOWNTOWN', x: -600, z: 980, size: 3 },
  { text: 'OLD TOWN', x: -600, z: -150, size: 2 },
  { text: 'MIDTOWN', x: -600, z: 1870, size: 1.6 },
  { text: 'SUBURBIA', x: 330, z: -120, size: 2.4 },
  { text: 'THE HILLS', x: 820, z: 1100, size: 2.6 },
  { text: 'COAST PARK', x: 6, z: 1070, size: 1.6, kind: 'park' },
  { text: 'PORT HAVEN', x: -600, z: 2620, size: 2.6 },
  { text: 'SHIPYARDS', x: -850, z: 3150, size: 1.6 },
  { text: 'COAST CITY BEACH', x: -1450, z: 1500, size: 1.8 },
  { text: 'THE MARINA', x: -720, z: -880, size: 1.4 },
  { text: 'EASTSIDE', x: 1000, z: -200, size: 1.8 },
  { text: 'BAYSIDE', x: 400, z: -830, size: 1.3 },
  { text: 'COAST HEIGHTS', x: 0, z: 1770, size: 1.3 },
  { text: 'HIGHWAY 1', x: 1286, z: 700, size: 1.3, kind: 'road', turn: true },
  { text: 'COAST BAY', x: -400, z: -1380, size: 2, kind: 'water' },
  { text: 'COAST RIVER', x: 1590, z: 2420, size: 1.2, kind: 'water', turn: true },
  { text: 'PACIFIC OCEAN', x: -2050, z: 800, size: 2, kind: 'water', turn: true },
];

// ------------------------------------------------------------------------------------------------ the hills, built
// The ground in the hills as it's built (the terrain's mesh and its collider, the houses and the roads all stand on
// this): the hills' rise (heightAt), a level terrace cut for each house (hillPlots: the house at the plot's y), and
// the roads' beds, each road climbing smoothly (its height the hills' averaged along 120 m of it). Cached: call freely.
let HI = null;
function hillIndex() {
  if (HI) return HI;
  const grid = new Map(), put = (gx, gz, v) => { const k = gx * 8192 + gz; (grid.get(k) ?? grid.set(k, []).get(k)).push(v); };
  const roads = HILL_ROADS.map((road) => {
    const h = road.map((q) => heightAt(q.x, q.z));
    return road.map((q, i) => { let t = 0, n = 0; for (let j = Math.max(0, i - 6); j <= Math.min(h.length - 1, i + 6); j++) { t += h[j]; n++; } return { x: q.x, z: q.z, y: t / n }; });
  });
  roads.forEach((road, ri) => { for (let i = 0; i + 1 < road.length; i++) { const a = road[i]; const gx = Math.floor(a.x / 40), gz = Math.floor(a.z / 40); for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) put(gx + u, gz + v, { road: ri, i }); } });
  // the plots: none the road beds would cut through, each terrace at the ground's height under its middle
  const plots = hillPlots().filter((p) => !roads.some((r) => nearest(r, p.x, p.z).d < 13));
  for (const p of plots) { const gx = Math.floor(p.x / 40), gz = Math.floor(p.z / 40); for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) put(gx + u, gz + v, { plot: p }); }
  HI = { grid, roads, plots };
  return HI;
}
export const hillRoads = () => hillIndex().roads; // (each sample { x, z, y }: build the roads along these)
export const hillHouses = () => hillIndex().plots; // (each { x, z, y, yaw, w, d, seed }: a house on its terrace at y, facing its road)
export const ROAD_HALF = 4.2; // (a hill road's half width, and its shoulders 2.5 m more either side)
export function groundAt(x, z) {
  const base = heightAt(x, z);
  if (base <= 0) return 0;
  const { grid, roads } = hillIndex(), list = grid.get(Math.floor(x / 40) * 8192 + Math.floor(z / 40));
  if (!list) return base;
  let h = base, best = Infinity;
  for (const e of list) {
    if (!e.plot) continue;
    const p = e.plot, c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z;
    const u = Math.abs(dx * c - dz * s) - (p.w / 2 + 3), v = Math.abs(dx * s + dz * c) - (p.d / 2 + 4), out = Math.max(u, v, 0);
    if (out < 5 && out < best) { best = out; h = base + (p.y - base) * (1 - ss(0, 5, out)); }
  }
  // each road's nearest stretch only (blending toward every stretch within reach left the ground off a climbing road)
  const near = new Map();
  for (const e of list) {
    if (e.plot) continue;
    const a = roads[e.road][e.i], b = roads[e.road][e.i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / L2)), d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < ROAD_HALF + 8 && d < (near.get(e.road)?.d ?? Infinity)) near.set(e.road, { d, y: a.y + (b.y - a.y) * t });
  }
  for (const { d, y } of near.values()) h += (y - h) * (1 - ss(ROAD_HALF + 2.5, ROAD_HALF + 8, d));
  return h;
}
