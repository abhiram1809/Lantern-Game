import * as THREE from 'three';
import { onFrame } from '../engine/Time.js';
import { HALS_LOT, LOT_Z, PIER, PROMENADE, NS, EW, streetX, cityCells, streetSegments, planCell, boxesOf } from '../city/Plan.js';
import {
  coastAt, BAY_NORTH, BAY_SOUTH, RIVER, PORT, MARINA, BRIDGE, HIGHWAY, HILLS, OBSERVATORY, LABELS, PARKS, MEMORIAL, ROAD_HALF,
  heightAt, waterAt, districtAt, parkAt, hillRoads, hillHouses, highwayDistance, inPoly,
} from '../city/Layout.js';

// The map of Coast City (the user, 2026-11-19: "a map on top left, just like GTA, so that I can browse through the
// city"; the map rework, 2026-11-24: the peninsula of city/Layout.js, "clean navigation icons/markers"). A radar in
// the top-left corner that turns with the camera, and the whole map (N, or the phone's Maps) to browse: north up,
// pan and zoom, a waypoint set where the crosshair is.
//
// Both are drawn from the city's layout and plan as they're built (city/Layout.js, city/Plan.js): the sea, the bay,
// the river and the basins with their shallows, the beach, the hills in shaded relief with their roads and houses,
// the grid's streets and blocks by district (each building's footprint close up), the parks, Highway 1, the Bay
// Bridge, the pier and its wheel, the port's quays and cranes, Hal's blocks and his lot, the road south to Ferris
// Aircraft's runway and hangars. That much doesn't change, so it's painted once into tiles (256 px, at six scales
// from half a metre a pixel to sixteen), kept in a small cache and drawn turned and scaled; each frame only the
// names, the icons and Hal go on top. On the icons: the places people go (from the people who work in them), the
// landmarks, his home, his car, the city's emergency, the HUD's marker and the waypoint, and the way to the waypoint
// along the streets (Roads, below).
//
// The world's x runs east and z north with the view mirrored from a compass's (facing north, east is on the left),
// so the map is the ground turned half a turn: what's left on screen is left here, and the sea is on the right.
// Painting works in the lot's frame (LOT_Z, as Layout.js and Plan.js); the map's own axes are u = -x, v = -z.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = {
  land: '#2a302b', desert: '#2d312a', sea: '#173a5c', shallow: '#21507a', shore: '#3d77a3', foam: 'rgba(170,205,230,0.55)', sand: '#a3926a',
  street: '#6c747d', pave: '#5d656d', road: '#7f878f', lane: 'rgba(226,230,234,0.5)', park: '#2f6040', parkLine: '#3f7650', plaza: '#55665a',
  cem: '#3d5a46', grave: '#5c7a63', highway: '#e3a03c', casing: '#5a3c12', divider: '#8a5f22', bridge: '#d8dde2', bridgeEdge: '#7b8790', tower: '#f6f7f8',
  pier: '#9a8a6a', pierEdge: '#5e5240', quay: '#4b5258', breakwater: '#5d646b', shed: '#7b848c', crane: '#e0682c', yard: '#525c65', dock: '#8b9196',
  runway: '#1b1e21', apron: '#4d545b', hangar: '#7b848d', lot: '#4c545c', home: '#d9c9a5', halRoof: '#b8a88b', obs: '#d8d2c0', dome: '#f1efe8', shadow: 'rgba(12,16,20,0.55)',
};
// the blocks' ground by district (between the buildings), and as a whole when they're too small for buildings
const GROUND = { downtown: '#434c57', midtown: '#41484f', town: '#443f3b', waterfront: '#48414a', suburbia: '#403b36', industrial: '#3a3f44', port: '#3b4147', ring: '#3e4349' };
const FAR = { downtown: '#5b6877', midtown: '#5a5a58', town: '#64594c', waterfront: '#6b5d5c', suburbia: '#5b4740', industrial: '#4b5258', port: '#4d545b', ring: '#555452' };
const ROOF = { tower: '#8fa8bc', midrise: '#9c968c', town: '#b8a88b', deco: '#cdb7a8', house: '#b5573a', home: '#a3967f', shop: '#b8a88b', shed: '#7d868e' };
const CONTAINERS = ['#b8503a', '#3f6f9a', '#c9a23a', '#4f8a5a', '#8a8f94', '#a04a6a'];

// Where some things are that Layout.js doesn't name (they should move into it): Playland on the Point (as
// tools/draw-layout.mjs pins it), the port's anchor on its south quay, the pier's wheel (city/Waterfront.js: at the
// head, 34 m in from its end, its axle east-west), and Ferris Aircraft's field (scenes/Ferris.js, in the world's
// frame: the runway along x at RUNWAY_Z, the taxiway, the apron, the three hangars, the staff lot, the tower).
const PLAYLAND = { x: -1450, z: 1640 };
const PORT_PIN = { x: -280, z: 2330 };
const WHEEL = { x: PIER.x1 + 125 - 34, z: PIER.z - 6, r: 15 };
const FIELD = { road: 80, runway: [-900, 900, -172.5, -127.5], taxi: [-10, 10, -127.5, -75], apron: [-100, 100, -75, 8], staff: [-40, 70, 40, 84], hangars: [-62, 0, 62], hangar: { w: 54, z0: 8, z1: 38 }, tower: [-134, -122, -22, -10] };
// Hal's two blocks (city/HalsBlock.js WEST, EAST, WEST2, EAST2): each building's z, width along the street and depth.
// West of the boulevard the fronts are at x -5.9 and run south from z; east, at x 17.9 and run north from z.
const HALS_WEST = [[-24, 20, 18], [-44, 12, 16], [-56, 24, 20], [-80, 16, 18], [-96, 16, 14], [-112, 28, 22], [-140, 20, 18], [-160, 16, 16], [-176, 23, 16],
  [-221, 18, 20], [-239, 36, 24], [-275, 12, 14], [-287, 16, 18], [-303, 28, 20], [-331, 18, 18], [-349, 30, 26], [-379, 17, 16]];
const HALS_EAST = [[-48, 24, 20], [-60, 12, 14], [-84, 24, 18], [-100, 16, 16], [-130, 30, 20], [-150, 20, 16], [-176, 26, 18], [-199, 23, 18],
  [-237, 16, 16], [-249, 12, 15], [-321, 72, 26], [-341, 20, 18], [-367, 26, 20], [-396, 29, 22]];
const APARTMENT = [-24.3, 24.3, 14, 38]; // (his building, on the lot: Ferris.js buildApartmentLot)

// places people go: who works there (CityLife's people), the icon and its colour
const PLACES = [
  ['Rosie', 'diner', '#ff8a5c', 'Rosie’s Diner'], ['Ray', 'liquor', '#d7c25a', 'Coast Liquor'], ['Gus', 'bar', '#e0a64a', 'The Blue Marlin'],
  ['The desk sergeant', 'police', '#6aa8ff', '14th Precinct'], ['The triage nurse', 'hospital', '#ff6a6a', 'St. Mary’s'], ['The usher', 'cinema', '#c88bff', 'The Palms'],
  ['The teller', 'bank', '#7de0a0', 'Savings & Loan'], ['The receptionist', 'office', '#9fd8ff', 'Ferris offices'], ['The trainer', 'gym', '#ffb36b', 'Iron Beach gym'],
];
// the landmarks, in the lot's frame (Ferris Aircraft in the world's: its z is less LOT_Z)
const LANDMARKS = [
  { icon: 'plane', col: '#9fd8ff', name: 'Ferris Aircraft', x: 0, z: 22 - LOT_Z },
  { icon: 'coaster', col: '#ff8ac8', name: 'Playland', x: PLAYLAND.x, z: PLAYLAND.z },
  { icon: 'wheel', col: '#ffd76a', name: 'The Pier', x: -1480, z: PIER.z },
  { icon: 'observatory', col: '#e8e2b8', name: 'Observatory', x: OBSERVATORY.x, z: OBSERVATORY.z },
  { icon: 'memorial', col: '#b8c8b0', name: 'Memorial Park', x: (MEMORIAL.x0 + MEMORIAL.x1) / 2, z: (MEMORIAL.z0 + MEMORIAL.z1) / 2 },
  { icon: 'anchor', col: '#8fc4e8', name: 'Port Haven', x: PORT_PIN.x, z: PORT_PIN.z },
];
const HOME = { icon: 'home', col: '#7dffc8', name: 'Home', x: 0, z: 10 };
// Highway 1's shields, round the loop and on the spurs out to the valley
const SHIELDS = [[-954, 700], [1286, 1560], [-300, 2070], [640, -615], [2350, 1915], [2480, -890]];

// the tiles: six scales, metres a pixel; a tile's 256 px with 2 px of its neighbours round it (so a tile drawn turned
// has no seam)
const LEVELS = [0.5, 1, 2, 4, 8, 16];
const T = 256, PAD = 2, TS = T + 2 * PAD, MAX_TILES = 72; // (72 of them 19 MB: the radar's need a dozen; the whole map holds more while it's open)
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h ?? w; return c; };
const bboxOf = (pts, pad = 0) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } return { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad }; };
const meets = (a, b) => a.x1 > b.x0 && a.x0 < b.x1 && a.z1 > b.z0 && a.z0 < b.z1;

// ------------------------------------------------------------------------------------------------ the ground's shapes
// Worked out once from the layout: the water's outlines and the shores along them (the stretches with land on one
// side: where the sea runs into the bay there's no shore), the river's banks, the beach, the relief of the hills.
class Geo {
  constructor() {
    // the coast, from the field's latitude to past the shipyards (Layout.js coastAt: the far coast beyond)
    this.coast = [];
    for (let z = -7800; z <= 7000; z += z > -3400 && z < 4800 ? 10 : 60) this.coast.push({ x: coastAt(z), z });
    this.bay = [...BAY_NORTH, ...[...BAY_SOUTH].reverse()];
    this.bayBox = bboxOf(this.bay, 40);
    // the river, on past its last point (out of the layout, to the valley's hills), narrowing
    const R = RIVER.map((p) => ({ ...p })), a = R[R.length - 2], b = R[R.length - 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 200; s <= 5200; s += 200) R.push({ x: b.x + ((b.x - a.x) / L) * s + 120 * Math.sin(s / 900), z: b.z + ((b.z - a.z) / L) * s, w: b.w - (b.w - 46) * (s / 5200), beyond: true });
    const left = [], right = [];
    for (let i = 0; i < R.length; i++) {
      const p = R[Math.max(0, i - 1)], q = R[Math.min(R.length - 1, i + 1)], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, w = R[i].w / 2;
      left.push({ x: R[i].x - (dz / l) * w, z: R[i].z + (dx / l) * w, beyond: R[i].beyond }); right.push({ x: R[i].x + (dz / l) * w, z: R[i].z - (dx / l) * w, beyond: R[i].beyond });
    }
    this.river = [...left, ...[...right].reverse()];
    this.riverBox = bboxOf(this.river, 40);
    this.portBox = bboxOf(PORT.basin, 40);
    this.marinaBox = bboxOf(MARINA.basin, 40);
    // the beach: the sand from the promenade out under the sea's edge (the water's drawn over it)
    const sand = [];
    for (let z = -760; z <= 2280; z += 10) sand.push({ x: PROMENADE.x0, z });
    this.sand = [...sand, ...[...sand].reverse().map((p) => ({ x: Math.min(PROMENADE.x0, coastAt(p.z) - 40), z: p.z }))];
    this.sandBox = bboxOf(this.sand);
    // the shores
    const quayLines = [...PORT.quays, ...PORT.slips].map((q) => [{ x: q.x0, z: q.z0 }, { x: q.x0, z: q.z1 }, { x: q.x1, z: q.z1 }, { x: q.x1, z: q.z0 }, { x: q.x0, z: q.z0 }].flatMap((p, i, a) => (i ? dense(a[i - 1], p, 8) : [p])));
    this.shores = [
      ...runs(this.coast.filter((p) => p.z > -3400 && p.z < 4800)), ...runs(BAY_NORTH), ...runs(BAY_SOUTH),
      // (the river's banks: a shore wherever what's beyond the bank isn't the bay or the sea; waterAt's own test for
      // the river is a search along all of it, 30 µs a point)
      ...runs(left.filter((p) => !p.beyond), (x, z) => x < coastAt(z) || inPoly(this.bay, x, z)), ...runs(right.filter((p) => !p.beyond), (x, z) => x < coastAt(z) || inPoly(this.bay, x, z)),
      left.filter((p) => p.beyond), right.filter((p) => p.beyond),
      ...runs([...PORT.basin, PORT.basin[0]]), ...runs(MARINA.basin), ...quayLines.flatMap((l) => runs(l)),
      // (the coast beyond the city's stretch has no water east of it to test against: all of it's a shore)
      this.coast.filter((p) => p.z <= -3400), this.coast.filter((p) => p.z >= 4800),
    ].filter((r) => r.length > 1).map((pts) => ({ pts, box: bboxOf(pts, 100) }));
    // Highway 1, and its spurs drawn on out to the valley (fading: the layout ends them at the river's far side)
    // Highway 1's loop exactly: its legs straight down the streets, its corners arcs (Layout.js loopLine is a uniform
    // Catmull-Rom through the corners' points, which doubles back on itself for 160 m at each end of each corner),
    // and the spurs joined to it where they leave it
    this.loop = exactLoop(HIGHWAY.loop) ?? HIGHWAY.loopLine;
    this.spurs = HIGHWAY.spurs.map((sp) => { const n = nearestOn(this.loop, sp[0].x, sp[0].z); return n.d > 4 ? [{ x: n.x, z: n.z }, ...sp] : sp; });
    this.spurEnds = HIGHWAY.spurs.map((s) => { const p = s[s.length - 2], q = s[s.length - 1], l = Math.hypot(q.x - p.x, q.z - p.z); return { x: q.x, z: q.z, dx: (q.x - p.x) / l, dz: (q.z - p.z) / l }; });
    this.highwayBox = bboxOf(HIGHWAY.lines.flat(), 40);
    this.cells = cityCells();
    this.segs = streetSegments();
    this.boxes = new Map();
    this.hillRoads = hillRoads().map((r) => ({ pts: r, box: bboxOf(r, 12) }));
    this.houses = hillHouses().map((h) => {
      const c = Math.cos(h.yaw), sn = Math.sin(h.yaw), hw = h.w / 2, hd = h.d / 2;
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => ({ x: h.x + u * c + v * sn, z: h.z - u * sn + v * c }));
    });
    this.relief = null;
  }

  // The hills in relief (Layout.js heightAt), in the map's own orientation (columns west, rows south): a tint by
  // height and a hillshade lit from the map's top left, the north-east, its slopes exaggerated twice to read.
  reliefMaps() {
    if (this.relief) return this.relief;
    const step = 5, x0 = HILLS.x0 - 480, x1 = HILLS.x1 + 220, z0 = HILLS.z0 - 380, z1 = HILLS.z1 + 220;
    const cols = Math.ceil((x1 - x0) / step), rows = Math.ceil((z1 - z0) / step);
    const h = new Float32Array((cols + 2) * (rows + 2));
    for (let r = -1; r <= rows; r++) for (let c = -1; c <= cols; c++) h[(r + 1) * (cols + 2) + c + 1] = heightAt(x1 - (c + 0.5) * step, z1 - (r + 0.5) * step);
    const at = (c, r) => h[(r + 1) * (cols + 2) + c + 1];
    const tint = canvas(cols, rows), shade = canvas(cols, rows);
    const ti = tint.getContext('2d').createImageData(cols, rows), si = shade.getContext('2d').createImageData(cols, rows);
    const land = hexRGB(C.land), lo = hexRGB('#344a39'), hi = hexRGB('#5d7a57');
    const l = [0.55, 1, 0.55], ln = Math.hypot(...l), L = l.map((v) => v / ln), flat = L[1];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const y = at(c, r), i = (r * cols + c) * 4;
      // (columns run west, so the east slope is dh/dx = (h[c-1] - h[c+1]) / 2 step; rows run south)
      const gx = ((at(c - 1, r) - at(c + 1, r)) / (2 * step)) * 1.6, gz = ((at(c, r - 1) - at(c, r + 1)) / (2 * step)) * 1.6;
      const nl = Math.hypot(gx, 1, gz), s = ((-gx * L[0] + L[1] - gz * L[2]) / nl) / flat - 1;
      const t = Math.min(1, y / 120), col = mixRGB(mixRGB(land, lo, ss(0, 0.18, t)), hi, ss(0.12, 1, t));
      const td = ti.data, sd = si.data;
      td[i] = col[0]; td[i + 1] = col[1]; td[i + 2] = col[2]; td[i + 3] = 255 * ss(0.4, 5, y);
      if (s < 0) { sd[i] = 6; sd[i + 1] = 12; sd[i + 2] = 8; sd[i + 3] = Math.min(105, -s * 240); } else { sd[i] = 236; sd[i + 1] = 244; sd[i + 2] = 214; sd[i + 3] = Math.min(42, s * 150); }
    }
    tint.getContext('2d').putImageData(ti, 0, 0);
    shade.getContext('2d').putImageData(si, 0, 0);
    return (this.relief = { tint, shade, x0, x1, z0, z1, box: { x0, x1, z0, z1 } });
  }

  // a block's buildings, as footprints with what their roofs are (the stream's index has them already, if it's built)
  footprints(cell) {
    let out = this.boxes.get(cell.id);
    if (out) return out;
    const boxes = cell.boxes ?? planCell(cell).flatMap((sp) => boxesOf(sp).map((b) => Object.assign(b, { spec: sp })));
    // (a tower's tiers stand on its lower ones, in order up from the base: each a little lighter, so its setbacks show)
    let last = null, tier = 0;
    out = boxes.map((bx) => {
      const sp = bx.spec;
      tier = sp === last ? tier + 1 : 0;
      last = sp;
      const kind = sp.kind === 'tower' ? 'tower' : sp.bays === 0 && sp.ac === 0 ? 'shed' : sp.roof === 'hip' && sp.floors === 1 ? 'house'
        : cell.district === 'waterfront' ? 'deco' : sp.floors > 4 ? 'midrise' : sp.shops?.length ? 'shop' : 'home';
      const col = tier ? `rgb(${mixRGB(hexRGB(ROOF[kind]), [236, 242, 246], Math.min(0.6, tier * 0.3)).map(Math.round).join(',')})` : ROOF[kind];
      return { x0: bx.x0, x1: bx.x1, z0: bx.z0, z1: bx.z1, h: bx.y1, col };
    });
    this.boxes.set(cell.id, out);
    return out;
  }
}
// the loop through its four corners' points (each an arc of 11), the arcs sampled every 2 degrees; null if it isn't that
function exactLoop(pts) {
  if (pts.length % 11) return null;
  const out = [];
  for (let c = 0; c < pts.length; c += 11) {
    const a = pts[c], m = pts[c + 5], b = pts[c + 10];
    // the circle through the three: its middle where the chords' perpendiculars meet
    const d = 2 * (a.x * (m.z - b.z) + m.x * (b.z - a.z) + b.x * (a.z - m.z));
    if (Math.abs(d) < 1e-6) return null;
    const A = a.x * a.x + a.z * a.z, M = m.x * m.x + m.z * m.z, B = b.x * b.x + b.z * b.z;
    const cx = (A * (m.z - b.z) + M * (b.z - a.z) + B * (a.z - m.z)) / d, cz = (A * (b.x - m.x) + M * (a.x - b.x) + B * (m.x - a.x)) / d;
    const r = Math.hypot(a.x - cx, a.z - cz), a0 = Math.atan2(a.z - cz, a.x - cx);
    let a1 = Math.atan2(b.z - cz, b.x - cx), am = Math.atan2(m.z - cz, m.x - cx);
    const wrap = (t) => { while (t < a0 - Math.PI) t += 2 * Math.PI; while (t > a0 + Math.PI) t -= 2 * Math.PI; return t; };
    am = wrap(am); a1 = wrap(a1);
    if ((am - a0) * (a1 - am) < 0) a1 += a1 < a0 ? 2 * Math.PI : -2 * Math.PI;
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.035));
    for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; out.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t) }); }
  }
  out.push({ ...out[0] });
  return out;
}
function nearestOn(line, x, z) {
  let best = { d: Infinity, x, z };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b.x - a.x, dz = b.z - a.z, t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { d, x: px, z: pz };
  }
  return best;
}
// a polyline's stretches that are shores: water on one side of it, land on the other
// (`beyond`: for a bank, whether the far side of it is water: the river's side always is)
function runs(line, beyond = null) {
  const out = [];
  let run = null;
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], p = line[i];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    const shore = beyond ? !(beyond(p.x + nx * 9, p.z + nz * 9) && beyond(p.x - nx * 9, p.z - nz * 9))
      : !waterAt(p.x + nx * 9, p.z + nz * 9) !== !waterAt(p.x - nx * 9, p.z - nz * 9);
    if (shore) (run ??= []).push(p);
    else if (run) { out.push(run); run = null; }
  }
  if (run) out.push(run);
  return out;
}
const dense = (a, b, step) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step)); return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 1)) / n, z: a.z + ((b.z - a.z) * (i + 1)) / n })); };

// ------------------------------------------------------------------------------------------------ painting a tile
// `g` in the lot's frame (metres), `b` the tile's bounds, `m` its metres a pixel
function paintTile(g, b, m, geo, water) {
  const px = (n) => n * m; // (n pixels, in metres)
  const W = (w, min = 1) => Math.max(w, px(min)); // (a width in metres, at least `min` pixels)
  const rect = (x0, z0, x1, z1, col) => {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    if (x1 < b.x0 || x0 > b.x1 || z1 < b.z0 || z0 > b.z1) return;
    g.fillStyle = col; g.fillRect(x0, z0, x1 - x0, z1 - z0);
  };
  const poly = (pts) => { g.beginPath(); g.moveTo(pts[0].x, pts[0].z); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].z); };
  const line = (pts, w, col, cap = 'round') => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; poly(pts); g.stroke(); };
  const fine = m <= 1, close = m <= 2, far = m >= 8, farthest = m >= 16;

  // the land, the desert round the city
  g.fillStyle = C.land;
  g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
  // the hills' rise (tinted by height; the shading goes on over the roads and the houses, below)
  const relief = meets(b, geo.relief?.box ?? HILLS_BOX) ? geo.reliefMaps() : null;
  if (relief) image(g, relief.tint, relief);
  // the beach's sand, out under the sea (the water's drawn over its far edge)
  if (meets(b, geo.sandBox)) { g.fillStyle = C.sand; poly(geo.sand); g.fill(); }

  // the water: the sea, the bay, the river, the port's basin and slips, the marina; shallows lighter along the shores,
  // a line of foam at the edge. Painted on its own canvas so the shallows land only on water.
  const w = water.getContext('2d');
  w.setTransform(1, 0, 0, 1, 0, 0);
  w.clearRect(0, 0, TS, TS);
  w.setTransform(g.getTransform());
  w.fillStyle = C.sea;
  let wet = false;
  const fillW = (pts) => { w.beginPath(); w.moveTo(pts[0].x, pts[0].z); for (let i = 1; i < pts.length; i++) w.lineTo(pts[i].x, pts[i].z); w.fill(); wet = true; };
  const span = geo.coast.filter((p) => p.z > b.z0 - 80 && p.z < b.z1 + 80);
  if (span.length && span.some((p) => p.x > b.x0)) fillW([...span, { x: -40000, z: span[span.length - 1].z }, { x: -40000, z: span[0].z }]);
  if (meets(b, geo.bayBox)) fillW(geo.bay);
  if (meets(b, geo.riverBox)) fillW(geo.river);
  if (meets(b, geo.portBox)) { fillW(PORT.basin); for (const q of PORT.slips) { w.fillRect(q.x0, q.z0, q.x1 - q.x0, q.z1 - q.z0); } }
  if (meets(b, geo.marinaBox)) fillW(MARINA.basin);
  if (wet) {
    w.globalCompositeOperation = 'source-atop';
    w.lineCap = w.lineJoin = 'round';
    for (const [width, col, alpha] of [[130, C.shallow, 0.32], [48, C.shallow, 0.5], [16, C.shore, 0.45], [px(1.4), C.foam, 1]]) {
      w.strokeStyle = col; w.globalAlpha = alpha; w.lineWidth = width;
      for (const s of geo.shores) {
        if (!meets(b, s.box)) continue;
        w.beginPath(); w.moveTo(s.pts[0].x, s.pts[0].z); for (let i = 1; i < s.pts.length; i++) w.lineTo(s.pts[i].x, s.pts[i].z); w.stroke();
      }
    }
    w.globalAlpha = 1;
    w.globalCompositeOperation = 'source-over';
    const t = g.getTransform();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(water, 0, 0);
    g.setTransform(t);
  }

  // the port: the container quays out into the basin, the breakwater, the shipyards' sheds; the marina's docks
  if (meets(b, geo.portBox)) {
    for (const q of PORT.quays) rect(q.x0, q.z0, q.x1, q.z1, C.quay);
    line(PORT.breakwater, W(14, 1.5), C.breakwater);
  }
  for (const q of PORT.sheds) rect(q.x0, q.z0, q.x1, q.z1, C.shed);
  if (meets(b, geo.marinaBox) && m <= 4) for (const d of MARINA.docks) {
    rect(d.x - W(2, 1) , d.z0, d.x + W(2, 1), d.z1, C.dock);
    if (fine) for (let z = d.z0 + 10; z < d.z1 - 4; z += 12) rect(d.x - 9, z - 0.8, d.x + 9, z + 0.8, C.dock); // (the fingers either side)
  }

  // the streets (Plan.js streetSegments: only where there's a block beside them), the carriageway lighter close up
  if (!farthest) {
    const segs = geo.segs;
    for (const [half, col] of fine ? [[1, C.pave], [0, C.road]] : [[1, C.street]]) {
      g.fillStyle = col;
      for (const s of segs) {
        const ns = s.ns, hw = half ? (ns ? NS.front : EW.front) : (ns ? NS.kerb : EW.kerb), ext = ns ? EW.front : NS.front;
        const x0 = ns ? s.x - hw : s.x0 - ext, x1 = ns ? s.x + hw : s.x1 + ext, z0 = ns ? s.z0 - ext : s.z - hw, z1 = ns ? s.z1 + ext : s.z + hw;
        if (x1 < b.x0 || x0 > b.x1 || z1 < b.z0 || z0 > b.z1) continue;
        const grow = far ? px(0.4) : 0;
        g.fillRect(x0 - grow, z0 - grow, x1 - x0 + 2 * grow, z1 - z0 + 2 * grow);
      }
    }
  }
  // the road in from the field, over the bay on the bridge (drawn below) to the boulevard's foot
  rect(BRIDGE.x - W(6, 1.2), FIELD.road - LOT_Z, BRIDGE.x + W(6, 1.2), BRIDGE.z1, fine ? C.pave : C.street);
  if (fine) rect(BRIDGE.x - 4, FIELD.road - LOT_Z, BRIDGE.x + 4, BRIDGE.z1, C.road);
  rect(BRIDGE.x - W(12, 1.2), BRIDGE.z0, BRIDGE.x + W(12, 1.2), -930, fine ? C.pave : C.street);

  // the blocks by district, each building's footprint (with a little shade to its south-west by its height) close up
  for (const c of geo.cells) {
    if (c.park) continue;
    const grow = farthest ? 12 : 0;
    if (c.x1 + grow < b.x0 || c.x0 - grow > b.x1 || c.z1 + grow < b.z0 || c.z0 - grow > b.z1) continue;
    if (c.district === 'port') { yard(g, c, m, rect); continue; }
    rect(c.x0 - grow, c.z0 - grow, c.x1 + grow, c.z1 + grow, m >= 4 ? FAR[c.district] ?? FAR.ring : GROUND[c.district] ?? GROUND.ring);
    if (!close) continue;
    const fp = geo.footprints(c);
    g.fillStyle = C.shadow;
    for (const f of fp) { const o = Math.min(7, 0.4 + f.h * 0.035); g.fillRect(f.x0 - o, f.z0 - o, f.x1 - f.x0, f.z1 - f.z0); }
    for (const f of fp) { g.fillStyle = f.col; g.fillRect(f.x0 + 0.3, f.z0 + 0.3, f.x1 - f.x0 - 0.6, f.z1 - f.z0 - 0.6); }
  }
  // the parks: Coast Park and the squares (Layout.js PARKS), the little parks among the houses, the memorial park
  for (const p of PARKS) {
    if (p.x1 < b.x0 || p.x0 > b.x1 || p.z1 < b.z0 || p.z0 > b.z1) continue;
    g.fillStyle = p.plaza ? C.plaza : C.park;
    g.beginPath(); g.roundRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0, p.plaza ? 2 : 18); g.fill();
    if (!close) continue;
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    if (p.plaza) { // (paving round a fountain, lawns at the corners)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rect(cx + sx * 6, cz + sz * 8, cx + sx * ((p.x1 - p.x0) / 2 - 5), cz + sz * ((p.z1 - p.z0) / 2 - 6), C.park);
      g.fillStyle = '#7ea9c4'; g.beginPath(); g.arc(cx, cz, 5, 0, 7); g.fill();
    } else { // (its paths: a loop and the walks across it)
      g.strokeStyle = C.parkLine; g.lineWidth = W(3, 1);
      g.beginPath(); g.ellipse(cx, cz, (p.x1 - p.x0) * 0.33, (p.z1 - p.z0) * 0.36, 0, 0, 7); g.stroke();
      line([{ x: p.x0 + 10, z: p.z0 + 10 }, { x: p.x1 - 10, z: p.z1 - 10 }], W(3, 1), C.parkLine);
      line([{ x: p.x1 - 10, z: p.z0 + 10 }, { x: p.x0 + 10, z: p.z1 - 10 }], W(3, 1), C.parkLine);
      g.fillStyle = '#3d6f8a'; g.beginPath(); g.ellipse(cx - 70, cz + 120, 46, 30, 0.4, 0, 7); g.fill(); // (the pond)
    }
  }
  for (const c of geo.cells) {
    if (c.park !== 'park' || c.x1 < b.x0 || c.x0 > b.x1 || c.z1 < b.z0 || c.z0 > b.z1) continue;
    g.fillStyle = C.park; g.beginPath(); g.roundRect(c.x0, c.z0, c.x1 - c.x0, c.z1 - c.z0, 6); g.fill();
    if (close) { line([{ x: c.x0 + 4, z: c.z0 + 4 }, { x: c.x1 - 4, z: c.z1 - 4 }], W(2.2, 1), C.parkLine); line([{ x: c.x1 - 4, z: c.z0 + 4 }, { x: c.x0 + 4, z: c.z1 - 4 }], W(2.2, 1), C.parkLine); }
  }
  {
    const M = MEMORIAL;
    rect(M.x0, M.z0, M.x1, M.z1, C.cem);
    if (close) { // (the drive in from the road, the rows of stones round the lawn)
      rect(M.x0, -853, M.x0 + 100, -847, C.street);
      for (let x = 124; x < 178; x += 5) for (let z = -870; z < -830; z += 6) rect(x, z, x + 2.4, z + 1.2, C.grave);
    }
  }

  // Hal's two blocks and his lot (city/HalsBlock.js), his building on it
  if (b.x1 > -60 && b.x0 < 60 && b.z1 > -420 && b.z0 < 70) {
    for (const [z0, z1] of [[-199, -24], [-404, -221]]) { rect(-34, z0, -5.9, z1, GROUND.town); rect(17.9, z0, 46, z1, GROUND.town); }
    rect(HALS_LOT.x0, HALS_LOT.z0, HALS_LOT.x1, HALS_LOT.z1, C.lot);
    if (close) {
      g.fillStyle = C.shadow;
      for (const [z, w, d] of HALS_WEST) g.fillRect(-5.9 - d - 0.6, z - w - 0.6, d, w);
      for (const [z, w, d] of HALS_EAST) g.fillRect(17.9 - 0.6, z - 0.6, d, w);
      g.fillStyle = C.halRoof;
      for (const [z, w, d] of HALS_WEST) g.fillRect(-5.9 - d + 0.3, z - w + 0.3, d - 0.6, w - 0.6);
      for (const [z, w, d] of HALS_EAST) g.fillRect(17.9 + 0.3, z + 0.3, d - 0.6, w - 0.6);
      if (fine) for (let x = -18; x <= 18; x += 3.2) rect(x - 0.08, 2.5, x + 0.08, 7.5, '#8a9096'); // (the bays)
    }
    rect(APARTMENT[0], APARTMENT[2], APARTMENT[1], APARTMENT[3], C.home);
  }

  // the hills: the roads, the houses on their terraces, the observatory on the summit; then the hills' shading
  if (meets(b, HILLS_BOX)) {
    for (const r of geo.hillRoads) if (meets(b, r.box)) line(r.pts, W(ROAD_HALF * 2 + 1.5, 1.2), fine ? C.road : C.street);
    if (close) { g.fillStyle = ROOF.house; for (const h of geo.houses) { if (h[0].x < b.x0 - 20 || h[0].x > b.x1 + 20 || h[0].z < b.z0 - 20 || h[0].z > b.z1 + 20) continue; poly(h); g.fill(); } }
    g.fillStyle = C.obs; g.beginPath(); g.arc(OBSERVATORY.x, OBSERVATORY.z, 26, 0, 7); g.fill();
    if (close) { g.fillStyle = C.dome; g.beginPath(); g.arc(OBSERVATORY.x, OBSERVATORY.z + 4, 9, 0, 7); g.fill(); g.fillStyle = '#a9a293'; g.fillRect(OBSERVATORY.x - 14, OBSERVATORY.z - 16, 28, 8); }
  }
  if (relief) image(g, relief.shade, relief);

  // the cranes on the quays
  if (close && meets(b, geo.portBox)) for (const c of PORT.cranes) { rect(c.x - 6, c.z - 14, c.x + 6, c.z + 14, C.crane); if (fine) rect(c.x - 20, c.z - 1.5, c.x + 20, c.z + 1.5, '#b8542a'); }

  // the pier out from the promenade, its head and the wheel on it (from above, a bar across: its axle runs east-west)
  if (b.x0 < PIER.x0 + 20 && b.x1 > PIER.x1 - 20 && b.z0 < PIER.z + 40 && b.z1 > PIER.z - 40) {
    const head = PIER.x1 + 125;
    rect(PIER.x1 - px(0.8), PIER.z - 22 - px(0.8), head + px(0.8), PIER.z + 22 + px(0.8), C.pierEdge);
    rect(head, PIER.z - PIER.w / 2 - px(0.8), PIER.x0, PIER.z + PIER.w / 2 + px(0.8), C.pierEdge);
    rect(PIER.x1, PIER.z - 22, head, PIER.z + 22, C.pier);
    rect(head - 1, PIER.z - W(PIER.w / 2, 1), PIER.x0, PIER.z + W(PIER.w / 2, 1), C.pier);
    if (close) { rect(WHEEL.x - 1.6, WHEEL.z - WHEEL.r, WHEEL.x + 1.6, WHEEL.z + WHEEL.r, '#e9e4d8'); g.fillStyle = '#ffd76a'; g.beginPath(); g.arc(WHEEL.x, WHEEL.z, 2.4, 0, 7); g.fill(); }
  }

  // Ferris Aircraft: the runway, the taxiway and the apron, the hangars, the staff lot, the tower (the world's frame)
  if (b.z0 < 400 - LOT_Z && b.z1 > -400 - LOT_Z) {
    const F = (r, col) => rect(r[0], r[2] - LOT_Z, r[1], r[3] - LOT_Z, col);
    F(FIELD.runway, C.runway); F(FIELD.taxi, C.apron); F(FIELD.apron, C.apron); F(FIELD.staff, C.apron);
    if (close) {
      const z = (FIELD.runway[2] + FIELD.runway[3]) / 2 - LOT_Z;
      for (let x = -860; x < 860; x += 40) rect(x, z - 0.5, x + 22, z + 0.5, '#d8d4c8'); // (the centre line)
      for (const sx of [-1, 1]) for (let k = -4; k <= 4; k++) rect(sx * 880 - 15, z + k * 4.5 - 1, sx * 880 + 15, z + k * 4.5 + 1, '#d8d4c8'); // (the thresholds)
    }
    for (const hx of FIELD.hangars) rect(hx - FIELD.hangar.w / 2, FIELD.hangar.z0 - LOT_Z, hx + FIELD.hangar.w / 2, FIELD.hangar.z1 - LOT_Z, C.hangar);
    F(FIELD.tower, '#b9c0c6');
  }

  // Highway 1 on its piers: the casing, the deck, close up its lanes; the spurs fade out on to the valley
  if (meets(b, geo.highwayBox) || b.x1 > 3000) {
    const hw = HIGHWAY.half * 2;
    for (const [w, col] of [[W(hw + 5, 3.2), C.casing], [W(hw, 2.2), C.highway]]) {
      line(geo.loop, w, col);
      for (const s of geo.spurs) line(s, w, col, 'butt');
      for (const e of geo.spurEnds) {
        const L = 2600, gr = g.createLinearGradient(e.x, e.z, e.x + e.dx * L, e.z + e.dz * L);
        gr.addColorStop(0, col); gr.addColorStop(1, col === C.casing ? 'rgba(90,60,18,0)' : 'rgba(227,160,60,0)');
        g.strokeStyle = gr; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.moveTo(e.x, e.z); g.lineTo(e.x + e.dx * L, e.z + e.dz * L); g.stroke();
      }
    }
    if (fine) {
      line(geo.loop, 0.8, C.divider);
      for (const s of geo.spurs) line(s, 0.8, C.divider, 'butt');
    }
  }

  // the Bay Bridge: its deck over the water, its two towers, close up the stays fanned from them
  if (b.x0 < BRIDGE.x + 40 && b.x1 > BRIDGE.x - 40 && b.z0 < BRIDGE.z0 && b.z1 > BRIDGE.z1) {
    const B = BRIDGE, hw = W(B.half, 1.5);
    rect(B.x - hw - px(0.8), B.z1, B.x + hw + px(0.8), B.z0, C.bridgeEdge);
    rect(B.x - hw, B.z1, B.x + hw, B.z0, C.bridge);
    if (fine) { rect(B.x - 0.3, B.z1, B.x + 0.3, B.z0, '#9aa4ac'); }
    if (close) for (const t of B.towers) for (const s of [-1, 1]) for (let k = 1; k <= 7; k++) for (const e of [-1, 1]) line([{ x: B.x + e * 8, z: t }, { x: B.x + e * (B.half - 1), z: t + s * k * 24 }], px(0.6), 'rgba(110,122,132,0.8)', 'butt');
    for (const t of B.towers) rect(B.x - 22, t - 5, B.x + 22, t + 5, C.tower);
  }
}
const HILLS_BOX = { x0: HILLS.x0 - 480, x1: HILLS.x1 + 220, z0: HILLS.z0 - 380, z1: HILLS.z1 + 220 };
// a raster in the map's orientation over its rectangle in the lot's frame
function image(g, img, r) {
  g.save();
  g.scale(-1, -1); // (now in the map's own axes: u = -x, v = -z)
  g.imageSmoothingEnabled = true;
  g.drawImage(img, -r.x1, -r.z1, r.x1 - r.x0, r.z1 - r.z0);
  g.restore();
}
// a container yard: stacks in rows, the shed at its north end
function yard(g, c, m, rect) {
  rect(c.x0, c.z0, c.x1, c.z1, m >= 4 ? '#5a5e62' : C.yard);
  if (m > 2) return;
  let k = 0;
  for (let z = c.z0 + 8; z < c.z1 - 30; z += 9) for (let x = c.x0 + 4; x < c.x1 - 15; x += 15) rect(x, z, x + 12, z + 6, CONTAINERS[(k++ * 7 + c.j * 3) % CONTAINERS.length]);
  rect(c.x0 + 4, c.z1 - 26, c.x1 - 4, c.z1 - 4, C.shed);
}

// ------------------------------------------------------------------------------------------------ the tiles
class Tiles {
  constructor() {
    this.geo = null;
    this.cache = new Map(); // (insertion order is use order: the oldest go first)
    this.max = MAX_TILES;
    this.water = canvas(TS);
    this.painted = 0;
    this.ms = 0;
  }
  key(n, i, j) { return `${n}:${i}:${j}`; }
  get(n, i, j) {
    const k = this.key(n, i, j), t = this.cache.get(k);
    if (t) { this.cache.delete(k); this.cache.set(k, t); }
    return t;
  }
  paint(n, i, j) {
    const t0 = performance.now();
    this.geo ??= new Geo();
    const m = LEVELS[n], S = T * m, c = canvas(TS), g = c.getContext('2d');
    // the tile covers u from i S to (i + 1) S, v likewise, and its pad round it; in the lot's frame x = -u, z = -v
    g.setTransform(-1 / m, 0, 0, -1 / m, PAD - i * T, PAD - j * T);
    const b = { x0: -(i + 1) * S - PAD * m, x1: -i * S + PAD * m, z0: -(j + 1) * S - PAD * m, z1: -j * S + PAD * m };
    paintTile(g, b, m, this.geo, this.water);
    this.cache.set(this.key(n, i, j), c);
    this.trim(this.max);
    this.painted++;
    this.ms += performance.now() - t0;
    return c;
  }
  // Draw the ground for a view ({ x, z: the lot's frame; mpp, metres a canvas pixel; rot }), painting what's missing
  // within `budget` ms (nearest the middle first) and showing a coarser tile meanwhile. Returns how many are missing.
  draw(g, W, H, v, budget) {
    // the scale: a tile drawn at half its size to its own (crisp, and the buildings show early); on a screen of two
    // pixels a point, up to half as big again (finer than the eye there, and a quarter of the tiles)
    let n = 0;
    const f = (v.k ?? 1) >= 2 ? 1.5 : 1.05;
    while (n + 1 < LEVELS.length && LEVELS[n + 1] <= v.mpp * f) n++;
    const m = LEVELS[n], S = T * m, rot = v.rot ?? 0, cs = Math.cos(rot), sn = Math.sin(rot);
    const ru = ((Math.abs(cs) * W + Math.abs(sn) * H) / 2) * v.mpp, rv = ((Math.abs(sn) * W + Math.abs(cs) * H) / 2) * v.mpp;
    const uc = -v.x, vc = -v.z;
    const i0 = Math.floor((uc - ru) / S), i1 = Math.floor((uc + ru) / S), j0 = Math.floor((vc - rv) / S), j1 = Math.floor((vc + rv) / S);
    const want = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) want.push({ i, j, d: Math.hypot((i + 0.5) * S - uc, (j + 0.5) * S - vc) });
    const t0 = performance.now(), time = () => performance.now() - t0 < budget;
    want.sort((a, b) => a.d - b.d);
    this.max = Math.max(MAX_TILES, Math.ceil(want.length * 1.25) + 24); // (never fewer than the view needs: they'd go round)
    for (const w of want) w.t = this.get(n, w.i, w.j);
    // where there's nothing yet, not even a coarser tile, one a quarter the size first: the whole view at once,
    // then the detail tile by tile (the whole map's: the radar's few fill in a frame or two)
    if (n + 2 < LEVELS.length && budget > 5) for (const w of want) {
      if (w.t || !time()) continue;
      let up = 1;
      while (up <= 4 && n + up < LEVELS.length && !this.get(n + up, w.i >> up, w.j >> up)) up++;
      if (up > 4 || n + up >= LEVELS.length) this.paint(n + 2, w.i >> 2, w.j >> 2);
    }
    for (const w of want) if (!w.t && (time() || !this.painted)) w.t = this.paint(n, w.i, w.j);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.land;
    g.fillRect(0, 0, W, H);
    g.setTransform(cs / v.mpp, sn / v.mpp, -sn / v.mpp, cs / v.mpp, W / 2, H / 2);
    g.translate(-uc, -vc);
    g.imageSmoothingEnabled = true;
    // where a tile isn't painted yet, the nearest coarser one that is
    const stand = new Map();
    for (const w of want) {
      if (w.t) continue;
      for (let up = 1; up <= 4 && n + up < LEVELS.length; up++) {
        const a = this.get(n + up, w.i >> up, w.j >> up);
        if (a) { stand.set(this.key(n + up, w.i >> up, w.j >> up), { a, n: n + up, i: w.i >> up, j: w.j >> up }); break; }
      }
    }
    for (const s of [...stand.values()].sort((a, b) => b.n - a.n)) this.blit(g, s.a, LEVELS[s.n], s.i, s.j);
    let missing = 0;
    for (const w of want) { if (w.t) this.blit(g, w.t, m, w.i, w.j); else missing++; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return missing;
  }
  trim(n) { while (this.cache.size > n) this.cache.delete(this.cache.keys().next().value); }
  blit(g, c, m, i, j) {
    const S = T * m, o = 1; // (a pixel of the neighbours' over each edge)
    g.drawImage(c, PAD - o, PAD - o, T + 2 * o, T + 2 * o, i * S - o * m, j * S - o * m, S + 2 * o * m, S + 2 * o * m);
  }
}

// ------------------------------------------------------------------------------------------------ the icons
// A blip: a disc of the place's colour with a dark rim and its pictogram in ink, a shadow under it. Pictograms in a
// unit square (y down), drawn at `r` (the disc's radius) px.
const INK = '#0e1418';
const ICONS = {
  home(g) { g.beginPath(); g.moveTo(-0.85, 0.02); g.lineTo(0, -0.78); g.lineTo(0.85, 0.02); g.lineTo(0.6, 0.02); g.lineTo(0.6, 0.78); g.lineTo(0.16, 0.78); g.lineTo(0.16, 0.3); g.lineTo(-0.16, 0.3); g.lineTo(-0.16, 0.78); g.lineTo(-0.6, 0.78); g.lineTo(-0.6, 0.02); g.closePath(); g.fill(); },
  plane(g) {
    g.beginPath(); g.ellipse(0, 0, 0.14, 0.92, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-0.95, 0.18); g.lineTo(-0.1, -0.28); g.lineTo(0.1, -0.28); g.lineTo(0.95, 0.18); g.lineTo(0.95, 0.34); g.lineTo(0.1, 0.12); g.lineTo(-0.1, 0.12); g.lineTo(-0.95, 0.34); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-0.42, 0.86); g.lineTo(0, 0.6); g.lineTo(0.42, 0.86); g.lineTo(0.42, 0.98); g.lineTo(-0.42, 0.98); g.closePath(); g.fill();
  },
  wheel(g) {
    g.lineWidth = 0.15; g.beginPath(); g.arc(0, -0.12, 0.66, 0, 7); g.stroke();
    g.lineWidth = 0.08; g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.moveTo(0, -0.12); g.lineTo(Math.cos(a) * 0.66, -0.12 + Math.sin(a) * 0.66); } g.stroke();
    g.lineWidth = 0.15; g.beginPath(); g.moveTo(-0.5, 0.95); g.lineTo(0, -0.12); g.lineTo(0.5, 0.95); g.stroke();
    g.beginPath(); g.arc(0, -0.12, 0.17, 0, 7); g.fill();
  },
  coaster(g) { // (Playland: a roller coaster's track over its trestles)
    g.lineWidth = 0.12; g.beginPath(); for (const x of [-0.62, -0.3, 0.1, 0.46, 0.76]) { const y = x < -0.1 ? -0.55 - (x + 0.62) * 0.4 : x < 0.3 ? 0.05 : 0.32; g.moveTo(x, y + 0.1); g.lineTo(x, 0.84); } g.stroke();
    g.lineWidth = 0.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-0.92, 0.72); g.bezierCurveTo(-0.7, -1.2, -0.25, -1.0, -0.05, 0.02); g.bezierCurveTo(0.1, 0.4, 0.3, -0.2, 0.5, 0.1); g.quadraticCurveTo(0.7, 0.36, 0.92, 0.3); g.stroke();
    g.fillRect(-0.95, 0.8, 1.9, 0.14);
  },
  observatory(g) {
    g.beginPath(); g.arc(0, 0.22, 0.72, Math.PI, 0); g.closePath(); g.fill();
    g.fillRect(-0.85, 0.22, 1.7, 0.56);
    g.lineWidth = 0.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.05, -0.05); g.lineTo(0.62, -0.78); g.stroke();
  },
  memorial(g, bg) {
    g.beginPath(); g.moveTo(-0.58, 0.86); g.lineTo(-0.58, -0.28); g.arc(0, -0.28, 0.58, Math.PI, 0); g.lineTo(0.58, 0.86); g.closePath(); g.fill();
    g.fillStyle = bg; g.fillRect(-0.08, -0.58, 0.16, 0.92); g.fillRect(-0.32, -0.32, 0.64, 0.16);
  },
  anchor(g) {
    g.lineWidth = 0.15; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -0.7, 0.17, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(0, -0.52); g.lineTo(0, 0.86); g.moveTo(-0.38, -0.26); g.lineTo(0.38, -0.26); g.stroke();
    g.beginPath(); g.arc(0, 0.12, 0.72, 0.25, Math.PI - 0.25); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.78, 0.02); g.lineTo(s * 0.86, 0.36); g.lineTo(s * 0.56, 0.24); g.closePath(); g.fill(); }
  },
  diner(g) { // (a cup on its saucer, steaming)
    g.beginPath(); g.moveTo(-0.66, -0.18); g.lineTo(0.42, -0.18); g.lineTo(0.3, 0.5); g.quadraticCurveTo(0.26, 0.62, 0.12, 0.62); g.lineTo(-0.4, 0.62); g.quadraticCurveTo(-0.54, 0.62, -0.56, 0.5); g.closePath(); g.fill();
    g.lineWidth = 0.13; g.beginPath(); g.arc(0.44, 0.12, 0.2, -1.3, 1.5); g.stroke();
    g.fillRect(-0.85, 0.72, 1.5, 0.14);
    g.lineWidth = 0.09; g.lineCap = 'round'; g.beginPath(); for (const x of [-0.3, 0.06]) { g.moveTo(x, -0.36); g.quadraticCurveTo(x - 0.14, -0.56, x, -0.74); g.quadraticCurveTo(x + 0.12, -0.86, x, -0.96); } g.stroke();
  },
  liquor(g) {
    g.beginPath(); g.moveTo(-0.12, -0.96); g.lineTo(0.12, -0.96); g.lineTo(0.12, -0.5); g.quadraticCurveTo(0.38, -0.4, 0.38, -0.12); g.lineTo(0.38, 0.9); g.lineTo(-0.38, 0.9);
    g.lineTo(-0.38, -0.12); g.quadraticCurveTo(-0.38, -0.4, -0.12, -0.5); g.closePath(); g.fill();
  },
  bar(g) {
    g.beginPath(); g.moveTo(-0.78, -0.72); g.lineTo(0.78, -0.72); g.lineTo(0, 0.1); g.closePath(); g.fill();
    g.lineWidth = 0.13; g.beginPath(); g.moveTo(0, 0.1); g.lineTo(0, 0.78); g.moveTo(-0.42, 0.84); g.lineTo(0.42, 0.84); g.stroke();
  },
  police(g, bg) {
    g.beginPath(); g.moveTo(0, -0.92); g.lineTo(0.76, -0.6); g.lineTo(0.66, 0.24); g.quadraticCurveTo(0.42, 0.74, 0, 0.96); g.quadraticCurveTo(-0.42, 0.74, -0.66, 0.24); g.lineTo(-0.76, -0.6); g.closePath(); g.fill();
    g.fillStyle = bg; star(g, 0, 0, 0.42, 0.18);
  },
  hospital(g) { g.fillRect(-0.24, -0.78, 0.48, 1.56); g.fillRect(-0.78, -0.24, 1.56, 0.48); },
  cinema(g, bg) { // (a clapperboard)
    g.fillRect(-0.8, -0.12, 1.6, 0.9);
    g.save(); g.translate(-0.8, -0.2); g.rotate(-0.32); g.fillRect(0, -0.34, 1.62, 0.32);
    g.fillStyle = bg; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0.18 + k * 0.4, -0.34); g.lineTo(0.36 + k * 0.4, -0.34); g.lineTo(0.2 + k * 0.4, -0.02); g.lineTo(0.02 + k * 0.4, -0.02); g.fill(); }
    g.restore();
  },
  bank(g) { g.font = '800 1.9px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 0.08); },
  office(g) { // (a briefcase)
    g.lineWidth = 0.13; g.beginPath(); g.roundRect(-0.28, -0.72, 0.56, 0.4, 0.08); g.stroke();
    g.beginPath(); g.roundRect(-0.86, -0.4, 1.72, 1.2, 0.14); g.fill();
  },
  gym(g) {
    g.fillRect(-0.7, -0.08, 1.4, 0.16);
    for (const s of [-1, 1]) { g.fillRect(s * 0.6 - 0.12, -0.46, 0.24, 0.92); g.fillRect(s * 0.84 - 0.07, -0.3, 0.14, 0.6); }
  },
  car(g, bg) { // (from above, nose up)
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.fillRect(x - 0.12, y - 0.2, 0.24, 0.4);
    g.beginPath(); g.roundRect(-0.44, -0.92, 0.88, 1.84, [0.34, 0.34, 0.22, 0.22]); g.fill();
    g.fillStyle = bg; g.beginPath(); g.moveTo(-0.32, -0.3); g.lineTo(0.32, -0.3); g.lineTo(0.26, -0.06); g.lineTo(-0.26, -0.06); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-0.28, 0.5); g.lineTo(0.28, 0.5); g.lineTo(0.32, 0.66); g.lineTo(-0.32, 0.66); g.closePath(); g.fill();
  },
  emergency(g) { g.font = '800 1.75px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 0.1); },
  marker(g) { star(g, 0, 0.04, 0.82, 0.36); },
};
function star(g, x, y, R, r) {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r : R; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  g.closePath(); g.fill();
}
function blip(g, x, y, r, icon, col, k = 1) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(0, 1.2 * k, r + 1.4 * k, 0, 7); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(0, 0, r + 1.1 * k, 0, 7); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.scale(r * 0.6, r * 0.6);
  g.fillStyle = INK; g.strokeStyle = INK;
  ICONS[icon]?.(g, col);
  g.restore();
}
// the waypoint: a pin, its point on the place
function pin(g, x, y, r, col, k = 1) {
  const d = 1.7 * r, a = Math.acos(1 / 1.7);
  const shape = (rr, dy) => { g.beginPath(); g.moveTo(x, y + dy); g.arc(x, y - d + dy, rr, Math.PI / 2 + a, Math.PI / 2 - a + Math.PI * 2, false); g.closePath(); };
  g.fillStyle = 'rgba(0,0,0,0.45)'; shape(r + 1.4 * k, 1.4 * k); g.fill();
  g.fillStyle = INK; shape(r + 1.1 * k, 0); g.fill();
  g.fillStyle = col; shape(r, -0.8 * k); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(x, y - d - 0.8 * k, r * 0.38, 0, 7); g.fill();
}

// ------------------------------------------------------------------------------------------------ the way there
// The streets as a graph: each stretch between two crossings (Plan.js streetSegments), the road to the field over the
// Bay Bridge, the hill roads (Layout.js) joined to each other and to the grid where they meet; the shortest way along
// them from where he is to the waypoint, for the radar and the map to draw while he's on the ground. (Highway 1 isn't
// in it: its ramps are the highway's to say.)
class Roads {
  constructor() {
    const byKey = new Map(), nodes = (this.nodes = []), list = (this.edges = []);
    const node = (x, z) => {
      const k = `${Math.round(x)},${Math.round(z)}`;
      let n = byKey.get(k);
      if (!n) { byKey.set(k, (n = { x, z, edges: [], i: nodes.length })); nodes.push(n); }
      return n;
    };
    const link = (a, b) => { if (a === b) return; const L = Math.hypot(b.x - a.x, b.z - a.z); a.edges.push({ to: b, L }); b.edges.push({ to: a, L }); list.push([a, b]); };
    for (const s of streetSegments()) {
      if (s.ns) {
        // (the boulevard ends at Hal's lot: his building's across the rest of the stretch up to the street at 70)
        const z1 = s.k === 0 && s.z0 < HALS_LOT.z0 && s.z1 > HALS_LOT.z0 ? HALS_LOT.z0 : s.z1;
        link(node(s.x, s.z0), node(s.x, z1));
      } else link(node(s.x0, s.z), node(s.x1, s.z));
    }
    // the boulevard's foot to the field's gate, a node each kilometre or so (the bridge's ends among them)
    let prev = node(BRIDGE.x, -935);
    for (const z of [BRIDGE.z0, BRIDGE.z1, -2800, -3800, -4800, FIELD.road - LOT_Z]) { const n = node(BRIDGE.x, z); link(prev, n); prev = n; }
    // the hill roads, a node every 20 m or so; each end joined to the nearest road it meets
    const grid = [...nodes];
    const hill = hillRoads().map((r) => {
      const out = [];
      for (let i = 0; i < r.length; i += 2) out.push(node(r[i].x, r[i].z));
      if (out[out.length - 1] !== node(r[r.length - 1].x, r[r.length - 1].z)) out.push(node(r[r.length - 1].x, r[r.length - 1].z));
      for (let i = 0; i + 1 < out.length; i++) link(out[i], out[i + 1]);
      return out;
    });
    hill.forEach((road, ri) => {
      for (const end of [road[0], road[road.length - 1]]) {
        let best = null, bd = 90;
        for (const n of grid) { const d = Math.hypot(n.x - end.x, n.z - end.z); if (d < bd) { bd = d; best = n; } }
        hill.forEach((other, oi) => { if (oi !== ri) for (const n of other) { const d = Math.hypot(n.x - end.x, n.z - end.z); if (d < bd) { bd = d; best = n; } } });
        if (best) link(end, best);
      }
    });
  }
  // the nearest point on a road: the stretch it's on, and that point
  onRoad(x, z) {
    let best = null, bd = Infinity;
    for (const [a, b] of this.edges) {
      const dx = b.x - a.x, dz = b.z - a.z, t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const px = a.x + dx * t, pz = a.z + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = { a, b, x: px, z: pz }; }
    }
    return best;
  }
  // the way from (x0, z0) to (x1, z1), in the lot's frame: the points along it (Dijkstra on a binary heap, from the
  // street he's on to the one nearest the waypoint)
  route(x0, z0, x1, z1) {
    const s = this.onRoad(x0, z0), e = this.onRoad(x1, z1);
    if (!s || !e) return null;
    const pts0 = [{ x: x0, z: z0 }, { x: s.x, z: s.z }], end = [{ x: e.x, z: e.z }, { x: x1, z: z1 }];
    if (s.a === e.a && s.b === e.b) return [...pts0, ...end];
    const N = this.nodes.length, dist = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), heap = [];
    const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } }
      return top;
    };
    for (const n of [s.a, s.b]) { dist[n.i] = Math.hypot(n.x - s.x, n.z - s.z); push(n.i, dist[n.i]); }
    const goal = new Map([e.a, e.b].map((n) => [n.i, Math.hypot(n.x - e.x, n.z - e.z)]));
    let best = Infinity, b = null;
    while (heap.length) {
      const [d, i] = pop();
      if (d >= best) break;
      if (goal.has(i) && d + goal.get(i) < best) { best = d + goal.get(i); b = this.nodes[i]; }
      if (d > dist[i]) continue;
      for (const e of this.nodes[i].edges) { const nd = d + e.L; if (nd < dist[e.to.i]) { dist[e.to.i] = nd; from[e.to.i] = i; push(e.to.i, nd); } }
    }
    if (!b) return null;
    const way = [];
    for (let i = b.i; i >= 0; i = from[i]) way.push(this.nodes[i]);
    return [...pts0, ...way.reverse(), ...end];
  }
}

// ------------------------------------------------------------------------------------------------ the map
export class CityMap {
  constructor(story) {
    this.story = story;
    this.tiles = new Tiles();
    this.mpp = 1.2; // (metres a pixel on the radar)
    this.t = 0;
    this.cost = { n: 0, ms: 0, max: 0 }; // (what the radar takes to draw: tools, the ` counter)
    // the ground's shapes and the hills' relief (40 ms between them) worked out when the page has a moment, not on
    // the radar's first frame (if it comes first, it works them out itself)
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 200));
    idle(() => { this.tiles.geo ??= new Geo(); idle(() => this.tiles.geo.reliefMaps(), { timeout: 4000 }); }, { timeout: 3000 });
    // the radar
    const mini = (this.mini = document.createElement('div'));
    mini.id = 'minimap';
    mini.innerHTML = '<canvas></canvas><span class="n">N</span><span class="where"></span>';
    document.getElementById('hud').appendChild(mini);
    this.mc = mini.querySelector('canvas');
    this.where = mini.querySelector('.where');
    this.north = mini.querySelector('.n');
    // the whole map
    const full = (this.full = document.createElement('div'));
    full.id = 'citymap';
    full.innerHTML = `<canvas></canvas><div class="cross"></div><div class="side"><b>COAST CITY</b><i>and the valley</i><div class="legend"></div></div><div class="keys"><b>WASD</b> pan &nbsp; <b>Q</b> <b>E</b> or wheel zoom &nbsp; <b>Enter</b> or click: waypoint &nbsp; <b>Backspace</b> clear it &nbsp; <b>N</b> close</div><div class="look"></div>`;
    document.getElementById('ui').appendChild(full);
    this.fc = full.querySelector('canvas');
    this.look = full.querySelector('.look');
    this.legend(full.querySelector('.legend'));
    this.fc.addEventListener('wheel', (e) => { if (this.fullOpen) { this.zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2); e.preventDefault(); } }, { passive: false });
    this.fc.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.fv.x, cz: this.fv.z, moved: 0 }; });
    window.addEventListener('mousemove', (e) => {
      if (!this.fullOpen) return;
      if (!this.drag) { const r = this.fc.getBoundingClientRect(); this.hover = { x: e.clientX - r.left, y: e.clientY - r.top }; this.dirty = true; return; }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
      this.fv.x = this.drag.cx + dx * this.fv.mpp; this.fv.z = this.drag.cz + dy * this.fv.mpp; // (the map's turned half a turn)
      this.limit();
      this.drawFull();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.drag && this.fullOpen && this.drag.moved < 4) { const r = this.fc.getBoundingClientRect(); const w = this.fromScreen(e.clientX - r.left, e.clientY - r.top, this.fv); this.setWaypoint(w.x, w.z); }
      this.drag = null;
    });
  }

  // the legend: the same blips as on the map
  legend(el) {
    const row = (draw, name) => {
      const d = document.createElement('div'), c = canvas(40);
      draw(c.getContext('2d'));
      d.append(c, name);
      return d;
    };
    const B = (icon, col) => (g) => blip(g, 20, 20, 14, icon, col, 2);
    const head = (t) => { const h = document.createElement('h4'); h.textContent = t; return h; };
    el.append(head('Places'), ...[[HOME.icon, HOME.col, 'Home'], ...PLACES.map((p) => [p[1], p[2], p[3]])].map(([i, c, n]) => row(B(i, c), n)));
    el.append(head('Landmarks'), ...LANDMARKS.map((l) => row(B(l.icon, l.col), l.name)));
    el.append(head('On the move'), row(B('car', '#e8e2b8'), 'His car'), row(B('emergency', '#ff5a4a'), 'Emergency'), row(B('marker', '#ffe27a'), 'Objective'),
      row((g) => pin(g, 20, 33, 11, '#7dffc8', 2), 'Waypoint'), row((g) => this.arrow(g, 20, 20, -Math.PI / 2, 15, false), 'You'));
  }

  // ---------------------------------------------------------------- the radar, each frame
  get here() { const s = this.story; return s.driving && s.ferrisScene?.car ? s.ferrisScene.car.position : s.player.position; }
  update(dt) {
    const s = this.story, on = !!s.roaming && s.current === s.ferrisScene && !!s.ferrisScene && s.player.rig != null && !s.flyingCard;
    this.mini.classList.toggle('show', on);
    document.getElementById('hud').classList.toggle('mapped', on);
    if (this.waypoint && Math.hypot(this.here.x - this.waypoint.x, this.here.z - this.waypoint.z) < 18) this.clearWaypoint(true);
    if (!on || this.isFull) return; // (under the whole map the radar can't be seen)
    this.t += dt;
    // further out the faster he goes and the higher he is
    const p = this.here, sp = s.driving ? Math.hypot(s.drive?.speed ?? 10, 0) : s.player.flying ? Math.hypot(s.player.velocity?.x ?? 0, s.player.velocity?.z ?? 0) : 0;
    const want = s.player.flying ? Math.min(7, 1.6 + p.y / 30 + sp / 12) : s.driving ? 2.4 : 1.15;
    this.mpp += (want - this.mpp) * Math.min(1, dt * 2);
    if (this.t < 1 / 20) return;
    this.t = 0;
    this.drawRadar();
  }
  drawRadar() {
    const t0 = performance.now(), s = this.story, p = this.here;
    const cam = s.engine.camera, d = cam.getWorldDirection(_d);
    const psi = Math.atan2(d.x, d.z);
    const rot = -Math.PI / 2 - Math.atan2(-Math.cos(psi), -Math.sin(psi));
    const c = this.mc, w = (c.clientWidth || 200) * 2, h = (c.clientHeight || 200) * 2;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } // (a canvas resized is a canvas cleared and made again)
    // (the view's middle a little ahead of him, the way the camera looks: more of the radar's what's coming)
    const dl = Math.hypot(d.x, d.z) || 1, ahead = h * 0.12 * (this.mpp / 2);
    this.draw(c.getContext('2d'), w, h, { x: p.x + (d.x / dl) * ahead, z: p.z + (d.z / dl) * ahead, mpp: this.mpp / 2, rot, k: 2 }, false);
    // the north mark on the rim, where north (+z, up on a map that isn't turned) is now
    const r = (c.clientWidth / 2) * 0.84;
    this.north.style.transform = `translate(${Math.sin(rot) * r}px, ${-Math.cos(rot) * r}px)`;
    const name = this.placeName(p.x, p.z, p.y);
    if (name !== this.whereName) this.where.textContent = this.whereName = name;
    const ms = performance.now() - t0, C = this.cost;
    C.n++; C.ms += ms; C.max = Math.max(C.max, ms);
  }

  // Where (x, z) is, in words (the world's frame; `y` to tell the highway's deck from the street under it)
  placeName(x, z, y = 0) {
    const lz = z - LOT_Z;
    if (Math.abs(x) < 1000 && z > -420 && z < 260) return 'Ferris Aircraft';
    if (lz < -1700 && !waterAt(x, lz)) return Math.abs(x - BRIDGE.x) < 160 && lz > FIELD.staff[3] - LOT_Z ? 'The road to the field' : 'The desert';
    if (Math.abs(x - BRIDGE.x) < BRIDGE.half + 6 && lz < BRIDGE.z0 + 10 && lz > BRIDGE.z1 - 10) return 'Bay Bridge';
    if (Math.abs(lz - PIER.z) < 24 && x < PIER.x0 && x > PIER.x1 - 4 && (Math.abs(lz - PIER.z) < PIER.w / 2 + 2 || x < PIER.x1 + 127)) return 'The Pier';
    if (y > HIGHWAY.deck - 4 && y < HIGHWAY.deck + 6 && highwayDistance(x, lz) < HIGHWAY.half + 3) return 'Highway 1';
    const wet = waterAt(x, lz);
    if (wet === 'port' && lz > 2884) return 'The Shipyards';
    if (wet) return { sea: lz > -2600 && lz < 4400 && x > -2600 ? 'Pacific Ocean' : 'The Pacific', bay: 'Coast Bay', river: 'Coast River', port: 'Port Haven', marina: 'The Marina' }[wet] ?? 'Coast City';
    if (x > HALS_LOT.x0 - 40 && x < HALS_LOT.x1 + 40 && lz < HALS_LOT.z1 && lz > -404) return 'Hal’s block';
    if (Math.hypot(x - OBSERVATORY.x, lz - OBSERVATORY.z) < 70) return 'The Observatory';
    if (x > MEMORIAL.x0 && x < MEMORIAL.x1 && lz > MEMORIAL.z0 && lz < MEMORIAL.z1) return 'Memorial Park';
    if (Math.hypot(x - PLAYLAND.x, lz - PLAYLAND.z) < 230) return 'Playland';
    const pk = parkAt(x, lz);
    if (pk) return pk.name;
    const d = districtAt(x, lz);
    if (!d) return 'Coast City';
    if (d.id === 'port' && lz > 2884) return 'The Shipyards';
    if (d.id === 'north' && lz > 2700) return 'North Shore';
    if (d.id === 'industrial' && x > 1400) return 'The valley';
    return d.name;
  }

  // ---------------------------------------------------------------- drawing
  // view: { x, z (the world's frame), mpp (metres a canvas pixel), rot, k (canvas pixels a CSS pixel) }
  toScreen(x, z, v, W, H) {
    const dx = (x - v.x) / v.mpp, dz = (z - v.z) / v.mpp; // (half a turn: -x right, -z down)
    const u = -dx, w = -dz, c = Math.cos(v.rot ?? 0), s = Math.sin(v.rot ?? 0);
    return [W / 2 + u * c - w * s, H / 2 + u * s + w * c];
  }
  fromScreen(sx, sy, v) {
    const W = this.fc.clientWidth, H = this.fc.clientHeight;
    return { x: v.x - (sx - W / 2) * v.mpp, z: v.z - (sy - H / 2) * v.mpp };
  }
  draw(g, W, H, v, full) {
    const k = v.k ?? 1;
    // the ground, from the tiles (the radar's budget small: it's every frame)
    this.missing = this.tiles.draw(g, W, H, { x: v.x, z: v.z - LOT_Z, mpp: v.mpp, rot: v.rot, k }, full ? 14 : 3);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const mppCss = v.mpp * k; // (metres a CSS pixel: what the names and icons go by)
    if (full) this.names(g, W, H, v, k, mppCss);
    // the way to the waypoint along the streets (on the radar while he's on the ground: flying, the pin's enough)
    if (this.waypoint && (full || !this.story.player.flying)) this.drawRoute(g, v, W, H, k);
    // the icons: the places, the landmarks, then what moves; him last
    const s = this.story, people = s.cityLife?.people ?? [];
    const icons = [];
    if (full) this.icons = icons; // (what's on the whole map: for the crosshair's name and the mouse's)
    const at = (x, z, r, edge) => {
      const [sx, sy] = this.toScreen(x, z, v, W, H), R = r * k, m = (full ? 8 : 9) * k;
      const cx = Math.min(W - m - R, Math.max(m + R, sx)), cy = Math.min(H - m - R, Math.max(m + R, sy));
      const off = cx !== sx || cy !== sy;
      if (off && !edge) return null;
      return [edge ? cx : sx, edge ? cy : sy, R];
    };
    const show = (x, z, icon, col, name, r = 7, edge = false) => {
      const q = at(x, z, r, edge);
      if (!q) return;
      blip(g, q[0], q[1], q[2], icon, col, k);
      icons.push({ x: q[0], y: q[1], r: q[2], name });
    };
    const big = full && mppCss < 4.2;
    for (const l of LANDMARKS) {
      show(l.x, l.z + LOT_Z, l.icon, l.col, l.name, full ? 8 : 6.5);
      if (big) this.tag(g, l.x, l.z + LOT_Z, l.name, v, W, H, k, 8);
    }
    // (the places are all in Hal's two blocks: from far out a stack, so smaller as the map goes out, then gone)
    const pr = full ? 7 * Math.min(1, Math.max(0.7, 2.6 / mppCss)) : 6;
    if (!full || mppCss < 4.6) for (const [who, icon, col, name] of PLACES) { const p = people.find((q) => q.label === who); if (p) show(p.home.x, p.home.z, icon, col, name, pr); }
    show(HOME.x, HOME.z + LOT_Z, HOME.icon, HOME.col, 'Home', full ? 8.5 : 7);
    if (big) this.tag(g, HOME.x, HOME.z + LOT_Z, 'Home', v, W, H, k, 8.5);
    const car = s.ferrisScene?.car;
    if (car && !s.driving) show(car.position.x, car.position.z, 'car', '#e8e2b8', 'His car', full ? 6.5 : 5.5, full);
    const mt = s.powers?.markerTarget;
    if (mt?.pos && mt !== this.wpMarker) show(mt.pos.x, mt.pos.z, 'marker', '#ffe27a', mt.label ?? 'Objective', 6.5, true);
    const em = s.emergencies?.active;
    if (em?.where && !em.over) show(em.where.x, em.where.z, 'emergency', '#ff5a4a', em.label ?? 'Emergency', 8 + Math.sin(performance.now() / 160) * 1.2, true);
    if (this.waypoint) {
      const q = at(this.waypoint.x, this.waypoint.z, 7, true);
      pin(g, q[0], q[1] + (q[1] < H / 2 && q[1] < 40 * k ? 12 * k : 0), 6.5 * k, '#7dffc8', k);
      icons.push({ x: q[0], y: q[1] - 11 * k, r: 8 * k, name: this.wpMarker?.label ?? 'Waypoint' });
    }
    // him: an arrow the way he faces (held at the rim on the whole map when he's off it)
    const p = this.here, yaw = s.driving && car ? car.rotation.y : s.player.yaw ?? 0;
    const q = at(p.x, p.z, 8, true), [ax, ay] = this.toScreen(p.x + Math.sin(yaw) * 10, p.z + Math.cos(yaw) * 10, v, W, H), [hx, hy] = this.toScreen(p.x, p.z, v, W, H);
    this.arrow(g, q[0], q[1], Math.atan2(ay - hy, ax - hx), 10.5 * k, s.civilian, k);
    // the name of what's under the mouse (the whole map)
    if (full && this.hover) {
      const hv = icons.filter((i) => Math.hypot(i.x - this.hover.x * k, i.y - this.hover.y * k) < i.r + 3 * k).pop();
      if (hv) this.tip(g, hv.x, hv.y - hv.r - 6 * k, hv.name, k);
    }
    if (full) this.scale(g, W, H, k, mppCss);
  }
  // the route, worked out again when he's moved on from where it was worked out, or the waypoint's moved
  routeNow() {
    const p = this.here, w = this.waypoint, R = this.rt;
    if (!w) return null;
    const now = performance.now();
    if (R && R.w === w && (Math.hypot(p.x - R.x, p.z - R.z) < 12 || now - R.t < 400)) return R.pts;
    this.roads ??= new Roads();
    const pts = Math.hypot(p.x - w.x, p.z - w.z) < 60 ? null : this.roads.route(p.x, p.z - LOT_Z, w.x, w.z - LOT_Z);
    this.rt = { w, x: p.x, z: p.z, t: now, pts };
    return pts;
  }
  drawRoute(g, v, W, H, k) {
    const pts = this.routeNow();
    if (!pts) return;
    g.beginPath();
    pts.forEach((q, i) => { const [x, y] = this.toScreen(q.x, q.z + LOT_Z, v, W, H); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(8,20,16,0.85)'; g.lineWidth = 7 * k; g.stroke();
    g.strokeStyle = '#7dffc8'; g.lineWidth = 3.6 * k; g.stroke();
  }
  arrow(g, x, y, ang, L, civilian, k = 1) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.lineJoin = 'round';
    const shape = () => { g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.72, -L * 0.74); g.lineTo(-L * 0.36, 0); g.lineTo(-L * 0.72, L * 0.74); g.closePath(); };
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.translate(0, 1.4 * k); shape(); g.fill(); g.translate(0, -1.4 * k);
    shape(); g.strokeStyle = INK; g.lineWidth = 2.2 * k; g.stroke();
    g.fillStyle = civilian ? '#f4f7f6' : '#7dffc8'; g.fill();
    g.restore();
  }
  // a name beside an icon, close in
  tag(g, x, z, text, v, W, H, k, r) {
    const [sx, sy] = this.toScreen(x, z, v, W, H);
    if (sx < -100 || sy < -20 || sx > W + 100 || sy > H + 20) return;
    g.font = `700 ${11.5 * k}px Rajdhani, "Segoe UI", Arial, sans-serif`;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(6,10,12,0.8)'; g.lineJoin = 'round';
    g.strokeText(text, sx + (r + 5) * k, sy);
    g.fillStyle = '#eef4ee'; g.fillText(text, sx + (r + 5) * k, sy);
  }
  tip(g, x, y, text, k) {
    g.font = `700 ${12 * k}px Rajdhani, "Segoe UI", Arial, sans-serif`;
    const w = g.measureText(text).width + 14 * k, h = 20 * k;
    g.fillStyle = 'rgba(8,12,16,0.88)'; g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, 5 * k); g.fill();
    g.strokeStyle = 'rgba(125,255,200,0.5)'; g.lineWidth = 1 * k; g.stroke();
    g.fillStyle = '#e8fff4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - h / 2 + 0.5 * k);
  }
  // The names: the districts and the water (Layout.js LABELS) at a size that holds as the map zooms, the smaller
  // ones only as it comes in, the big ones fading once it's in among their streets; Highway 1's shields, the
  // squares, Ocean Avenue, the Bay Bridge, the field and the road to it
  names(g, W, H, v, k, mpp) {
    const zf = Math.min(1.35, Math.max(0.72, (3.2 / mpp) ** 0.32));
    const put = (x, z, text, px, col, { turn = false, italic = false, alpha = 1, spacing = 0.12 } = {}) => {
      const [sx, sy] = this.toScreen(x, z + LOT_Z, v, W, H);
      if (sx < -300 || sy < -300 || sx > W + 300 || sy > H + 300 || alpha <= 0.02) return;
      g.save();
      g.globalAlpha = alpha;
      g.translate(sx, sy);
      if (turn) g.rotate(-Math.PI / 2);
      g.font = `${italic ? 'italic ' : ''}700 ${px * k}px Rajdhani, "Segoe UI", Arial, sans-serif`;
      if ('letterSpacing' in g) g.letterSpacing = `${(px * spacing * k).toFixed(1)}px`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = Math.max(2.5, px * 0.26) * k; g.strokeStyle = 'rgba(6,10,12,0.72)';
      g.strokeText(text, 0, 0);
      g.fillStyle = col; g.fillText(text, 0, 0);
      g.restore();
    };
    const region = mpp > 11; // (from far out the city's one name, and the water's)
    for (const l of LABELS) {
      if (l.kind === 'water' ? mpp > 9 && l.size < 2 : region || (mpp > 7.5 && l.size < 1.7)) continue;
      const px = (8 + 4.4 * l.size) * zf, col = l.kind === 'water' ? '#8fb6d8' : l.kind === 'park' ? '#9fe0a8' : l.kind === 'road' ? '#f0b450' : '#eef2ea';
      const alpha = l.size >= 2.2 ? ss(0.55, 1.6, mpp) * 0.75 + 0.25 : 1;
      if (l.kind === 'road') continue; // (Highway 1 has its shields)
      put(l.x, l.z, l.text, px, col, { turn: l.turn, italic: l.kind === 'water', alpha: l.kind === 'water' ? 0.9 : alpha * 0.95 });
    }
    if (region) put(-150, 1000, 'COAST CITY', 22, '#eef2ea', { spacing: 0.3 });
    if (mpp < 5.5) {
      for (const p of PARKS) if (p.plaza && mpp < 2.2) put((p.x0 + p.x1) / 2, p.z1 + 14, p.name.toUpperCase(), 10.5, '#bfe8c4');
      put(BRIDGE.x - 14 - 9 * mpp, (BRIDGE.towers[0] + BRIDGE.towers[1]) / 2, 'BAY BRIDGE', 11.5 * zf, '#e8edf0', { turn: true });
      if (mpp < 2.4) for (const z of [-300, 600, 1500]) put(streetX(-14) + 0.5, z, 'OCEAN AVENUE', 10, '#d8dde2', { turn: true, spacing: 0.2 });
      put(BRIDGE.x + 34, -3400, 'THE ROAD TO THE FIELD', 11 * zf, '#c9d2da', { turn: true });
    }
    put(0, -110 - LOT_Z, 'FERRIS AIRCRAFT', 12.5 * zf, '#bfe4ff');
    if (mpp < 12) for (const [x, z] of SHIELDS) this.shield(g, ...this.toScreen(x, z + LOT_Z, v, W, H), k);
  }
  shield(g, x, y, k) {
    if (x < -20 || y < -20 || x > g.canvas.width + 20 || y > g.canvas.height + 20) return;
    const w = 9 * k, h = 11 * k;
    g.save(); g.translate(x, y);
    g.beginPath(); g.moveTo(-w, -h); g.lineTo(w, -h); g.lineTo(w, h * 0.2); g.quadraticCurveTo(w, h * 0.9, 0, h * 1.12); g.quadraticCurveTo(-w, h * 0.9, -w, h * 0.2); g.closePath();
    g.fillStyle = '#f4f1e8'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6 * k; g.stroke();
    g.fillStyle = INK; g.font = `800 ${12 * k}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 0, -0.5 * k);
    g.restore();
  }
  // the scale bar, bottom left
  scale(g, W, H, k, mpp) {
    const want = 130 * mpp, nice = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    const len = (nice / mpp) * k, x = 30 * k, y = H - 34 * k;
    g.fillStyle = 'rgba(8,12,16,0.72)'; g.beginPath(); g.roundRect(x - 10 * k, y - 22 * k, len + 20 * k, 34 * k, 6 * k); g.fill();
    g.fillStyle = '#e8fff4'; g.fillRect(x, y, len, 3 * k); g.fillRect(x, y - 4 * k, 1.5 * k, 7 * k); g.fillRect(x + len - 1.5 * k, y - 4 * k, 1.5 * k, 7 * k);
    g.font = `700 ${11 * k}px Rajdhani, "Segoe UI", Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, x, y - 7 * k);
  }

  // ---------------------------------------------------------------- the whole map
  get fullOpen() { return !!this.isFull; }
  openFull(onBack = null) {
    if (this.isFull) return;
    const s = this.story;
    this.isFull = true;
    this.onBack = onBack;
    const p = this.here;
    this.fv = { x: p.x, z: p.z, mpp: 3.2, rot: 0 };
    this.limit();
    this.full.classList.add('show');
    s.input.setLook?.(false); // (the mouse free, to drag and click)
    this.hadControl = s.player.control;
    s.player.control = false;
    s.menuOpen = true;
    this.drawFull();
    this.stop = onFrame((dt) => this.fullKeys(dt));
  }
  closeFull() {
    if (!this.isFull) return;
    const s = this.story;
    this.isFull = false;
    this.hover = null;
    this.tiles.max = MAX_TILES;
    this.tiles.trim(MAX_TILES);
    this.full.classList.remove('show');
    this.stop?.();
    s.input.setLook?.(true);
    if (!s.phoneUI?.open) { s.menuOpen = false; s.player.control = this.hadControl && !s.busy; }
    const back = this.onBack;
    this.onBack = null;
    back?.();
  }
  fullKeys(dt) {
    const { input } = this.story, f = this.fv, real = Math.min(0.05, dt || 1 / 60);
    const hit = (...c) => { if (input.hit(...c)) { input.consume(...c); return true; } return false; };
    if (hit('KeyN')) { this.closeFull(); return; }
    if (this.onBack && hit('KeyQ', 'KeyG')) { this.closeFull(); return; }
    let moved = false;
    const pan = 520 * f.mpp * real;
    if (input.down('KeyW') || input.down('ArrowUp')) { f.z += pan; moved = true; } // (up the screen is north, +z)
    if (input.down('KeyS') || input.down('ArrowDown')) { f.z -= pan; moved = true; }
    if (input.down('KeyA') || input.down('ArrowLeft')) { f.x += pan; moved = true; } // (left on the map is +x: the view's left)
    if (input.down('KeyD') || input.down('ArrowRight')) { f.x -= pan; moved = true; }
    if (!this.onBack && input.down('KeyQ')) { this.zoom(1 + real * 2.2, false); moved = true; }
    if (input.down('KeyE')) { this.zoom(1 / (1 + real * 2.2), false); moved = true; }
    if (hit('Enter', 'Space')) { this.setWaypoint(f.x, f.z); moved = true; }
    if (hit('Backspace')) { this.clearWaypoint(); moved = true; }
    this.limit();
    // (redrawn when it moves, while tiles are still being painted, for the emergency's pulse, and the mouse's hover)
    if (moved || this.missing || this.dirty || (this.t2 = (this.t2 ?? 0) + real) > 0.25) { this.t2 = 0; this.dirty = false; this.drawFull(); }
  }
  // the map's reach: the sea off the beach to the valley past the river, the field to past the shipyards
  limit() { const f = this.fv; f.x = Math.max(-2300, Math.min(2500, f.x)); f.z = Math.max(-300, Math.min(LOT_Z + 3500, f.z)); }
  zoom(k, draw = true) { this.fv.mpp = Math.max(0.6, Math.min(16, this.fv.mpp * k)); if (draw) this.drawFull(); }
  drawFull() {
    const c = this.fc, k = Math.min(2, Math.max(1, window.devicePixelRatio || 1)), w = Math.round(c.clientWidth * k), h = Math.round(c.clientHeight * k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.draw(c.getContext('2d'), w, h, { ...this.fv, mpp: this.fv.mpp / k, k }, true);
    // under the crosshair: an icon's name, or the place's
    const under = this.icons?.find((i) => Math.hypot(i.x - w / 2, i.y - h / 2) < i.r + 4 * k);
    this.look.textContent = `${under ? under.name : this.placeName(this.fv.x, this.fv.z)}${this.waypoint ? ' · waypoint set' : ''}`;
  }

  setWaypoint(x, z) {
    const s = this.story;
    if (!this.waypoint) this.prevMarker = s.powers.markerTarget; // (Carol's, say: back when the waypoint goes)
    this.waypoint = V(x, 0, z);
    this.rt = null;
    this.wpMarker = { pos: V(x, 3, z), label: `Waypoint · ${this.placeName(x, z)}` };
    if (!s.emergencies?.active || s.emergencies.active.over) s.powers.markerTarget = this.wpMarker;
    s.audio?.bell?.(1046, 0.04, 0.5);
    if (this.isFull) this.drawFull();
  }
  clearWaypoint(arrived = false) {
    const s = this.story;
    if (s.powers.markerTarget === this.wpMarker) s.powers.markerTarget = this.prevMarker ?? null;
    this.prevMarker = null;
    this.waypoint = null;
    this.wpMarker = null;
    if (arrived) s.ui.toast?.('Waypoint reached');
  }
}

const _d = new THREE.Vector3();
