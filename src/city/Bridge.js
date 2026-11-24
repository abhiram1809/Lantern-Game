import * as THREE from 'three';
import { BRIDGE, BAY_NORTH, BAY_SOUTH, nearest } from './Layout.js';
import { Acc, Col, sweep, boxAt, column, colBox, profile } from './Highway.js';

// The Coast Bay Bridge (the map rework, 2026-11-24: city/Layout.js BRIDGE): the road from the field carried over
// the bay, a cable-stayed bridge in white and pale grey, two A-frame towers 112 m tall, the stays fanned from their
// heads to both edges of the deck, the deck climbing from the shores in a long crest over the main span. Four
// lanes (the road's two, and a lane more each way on the bridge, gained and dropped on the approaches), walkways
// either side behind a barrier, a railing at the edge; lamps along both walkways, a string of lights along the
// deck's edges and the stays lit at night, the towers floodlit, red lights at their heads. On land at both ends a
// causeway between retaining walls; over the water, piers in the side spans and none in the main span. In the lot's
// frame, the road at x 6 (Ferris.js's, cut where the bridge carries it).
//
// The deck's profile is gentler than Layout's bridgeDeckAt (which climbs at up to 13%): 7.5% at most, a sag at
// either end, a crest over the main span, 26 m at its middle (z -1370) and about 18 m at the towers; it's `deckAt`.

export const X = BRIDGE.x, Z0 = BRIDGE.z0, Z1 = BRIDGE.z1, TOWERS = BRIDGE.towers, TOWER_H = BRIDGE.towerH, HALF = BRIDGE.half;
const MID = (TOWERS[0] + TOWERS[1]) / 2;
// the profile by u = -z (south is +u): the road's height on the deck
const PROFILE = [[-Z0, 0.02], [990, 1.9], [1050, 6.3], [1150, 13.8], [1250, 20.5], [1330, 25.2], [-MID, 26.0], [1410, 25.2], [1490, 20.6], [1590, 13.4], [1700, 5.2], [1760, 1.7], [-Z1, 0.02]];
const PY = profile(PROFILE);
export const deckAt = (z) => (z > Z0 || z < Z1 ? 0 : PY(-z));
// the road's half width on the deck (narrowing at the north end to the boulevard's kerb, at the south to the road's)
const ROAD = 8.4;
const roadHalf = (u) => ROAD - 2.0 * (1 - smooth(-Z0, -Z0 + 60, u)) - 3.0 * smooth(-Z1 - 60, -Z1, u);
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// the girder's depth: a shallow slab near the shores, the steel box of the spans
const depthAt = (y) => Math.min(3.2, Math.max(0.9, 0.9 + (y - 3) * 0.22));
// where the deck's on land or a causeway (walls down into the ground or the water), where it's on piers
const shoreN = nearest(BAY_NORTH, X, -990), shoreS = nearest(BAY_SOUTH, X, -1750);
const SHORE = { n: -(BAY_NORTH[shoreN.i].z), s: -(BAY_SOUTH[shoreS.i].z) }; // (u of the water's edge, each shore)
const FILL = { n: 1022, s: 1734 }; // (the causeways' ends, out a little way into the bay)
const PIERS = [1075, 1140, 1600, 1668];
const LANE = { inner: 2.0, outer: 5.6 };

// whether (x, z) is on the bridge's deck, and its height there (for landing on it, or anything that asks)
export function onBridge(x, z) {
  if (z > Z0 || z < Z1 || Math.abs(x - X) > HALF) return null;
  return deckAt(z) + (Math.abs(x - X) > roadHalf(-z) + 0.45 ? 0.15 : 0);
}
// its centre line as built, as Highway.js's highwayCentrelines (north to south, the deck's height, its half width)
export function bridgeCentreline(step = 8) {
  const n = Math.ceil((Z0 - Z1) / step), pts = [];
  for (let i = 0; i <= n; i++) { const u = -Z0 + ((Z0 - Z1) * i) / n; pts.push({ x: X, y: +PY(u).toFixed(2), z: -u }); }
  return { id: 'bridge', kind: 'bridge', closed: false, pts, half: pts.map(() => [HALF, HALF]), lanes: 2, towers: TOWERS.map((z) => ({ x: X, z, h: TOWER_H })) };
}
// the lanes on it for the traffic, as Highway.js's: the road's two lanes run straight on across it (northbound
// x 4, southbound x 8); the outer lanes are the bridge's own, gained after the approach and dropped before the end
export function bridgeLanes() {
  const lane = (id, o, u0, u1, step = 8) => {
    const n = Math.ceil(Math.abs(u1 - u0) / step), pts = [];
    for (let i = 0; i <= n; i++) { const u = u0 + ((u1 - u0) * i) / n; pts.push({ x: X + o, y: +PY(u).toFixed(2), z: -u }); }
    return { id, road: 'bridge', kind: 'bridge', pts, next: [], from: [], speed: 22 };
  };
  const out = [
    lane('bridge:sb:1', LANE.inner, -Z0, -Z1), lane('bridge:nb:1', -LANE.inner, -Z1, -Z0),
    lane('bridge:sb:2', LANE.outer, 1010, 1745), lane('bridge:nb:2', -LANE.outer, 1745, 1010),
  ];
  out[2].from = ['bridge:sb:1']; out[2].next = ['bridge:sb:1']; out[3].from = ['bridge:nb:1']; out[3].next = ['bridge:nb:1'];
  return out;
}

const C = (hex) => new THREE.Color(hex);
const COL = {
  white: C(0xeceae4), pale: C(0xdedcd6), tower: C(0xe8e6e0), steel: C(0xe4e3df), soffit: C(0xc9c8c3), barrier: C(0xd9d5cc), walk: C(0xc8c3b8),
  rail: C(0xd8d9d6), asphalt: C(0xffffff), yellow: C(0xe0b63a), paintW: C(0xf0eee6), stay: C(0xf2f2ee), cap: C(0xb9b4aa), stone: C(0x6e6a64), red: C(0xff2a1a), lamp: C(0xf4efe2),
};

// stations along the deck, every `step` metres of u (south), its frame heading south (the right is -x... the
// southbound's right is +x: Highway.js's frame, the heading (0, -1): right = (1, 0))
function stations(u0, u1, step) {
  const out = [], n = Math.max(1, Math.ceil((u1 - u0) / step));
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    out.push({ s: u, u, x: X, z: -u, y: PY(u), tx: 0, tz: -1, rx: 1, rz: 0, h: roadHalf(u), d: depthAt(PY(u)) });
  }
  return out;
}

export function* buildBridge(ctx) {
  const group = new THREE.Group();
  group.name = 'baybridge';
  const A = { concrete: new Acc(), steel: new Acc(), asphalt: new Acc(), paint: new Acc(), stays: new Acc(), lamp: new Acc(), pool: new Acc(), red: new Acc(), flood: new Acc(), sign: new Acc() };
  const col = new Col();
  const U0 = -Z0, U1 = -Z1;
  // stations: closer where it climbs and crests, and at every place the section changes (the causeways' ends)
  const st = [];
  for (const t of stations(U0, U1, 6)) st.push(t);
  const split = (a, b) => st.filter((t) => t.u >= a - 1e-6 && t.u <= b + 1e-6);
  // ---- the road, the barriers, the walkways, the railing's kerb
  sweep(A.asphalt, st, (t) => [[-t.h, 0], [t.h, 0]], COL.asphalt, { col });
  for (const side of [1, -1]) {
    const bar = side > 0 ? (t) => [[t.h, 0], [t.h + 0.08, 0.25], [t.h + 0.2, 0.95], [t.h + 0.45, 0.95], [t.h + 0.45, 0.15]] : (t) => [[-t.h - 0.45, 0.15], [-t.h - 0.45, 0.95], [-t.h - 0.2, 0.95], [-t.h - 0.08, 0.25], [-t.h, 0]];
    sweep(A.concrete, st, bar, COL.barrier, { col, cap0: true, cap1: true });
    // the walkway, a step up behind the barrier, to the railing's kerb at the edge
    const walk = side > 0 ? (t) => [[t.h + 0.45, 0.15], [10.45, 0.15], [10.45, 0.32], [11.0, 0.32], [11.0, 0]] : (t) => [[-11.0, 0], [-11.0, 0.32], [-10.45, 0.32], [-10.45, 0.15], [-t.h - 0.45, 0.15]];
    sweep(A.concrete, st, walk, COL.walk, { col });
  }
  // ---- the girder: the steel box over the water (its fairings sloping in under the walkways), walls down into the
  // ground and the water on the causeways
  for (const [a, b, fill] of [[U0, FILL.n, true], [FILL.n, FILL.s, false], [FILL.s, U1, true]]) {
    const run = split(a, b);
    if (fill) {
      for (const side of [1, -1]) sweep(A.concrete, run, side > 0 ? (t) => [[11, 0], [11, -t.y - 4]] : (t) => [[-11, -t.y - 4], [-11, 0]], COL.pale, { col });
      // the riprap where the causeway's in the water: dark stone sloping out from the walls' feet
      for (const side of [1, -1]) {
        const wet = run.filter((t) => (a === U0 ? t.u > SHORE.n - 8 : t.u < SHORE.s + 8));
        if (wet.length > 1) sweep(A.concrete, wet, side > 0 ? (t) => [[11, 1.0 - t.y], [15.5, -3.5 - t.y]] : (t) => [[-15.5, -3.5 - t.y], [-11, 1.0 - t.y]], COL.stone);
      }
    } else {
      sweep(A.steel, run, (t) => [[11, 0], [11, -0.55], [9.2, -t.d], [-9.2, -t.d], [-11, -0.55], [-11, 0]], COL.steel, { col });
      // its cross frames' lines under it, a darker band along its belly
      sweep(A.steel, run, (t) => [[3.0, -t.d - 0.01], [-3.0, -t.d - 0.01]], COL.soffit);
    }
  }
  yield;
  // ---- the lines: double yellow down the middle, white between the lanes (only where there are two each way), white
  // at the edges; the outer lanes' tapers, hatched
  const line = (run, f, w, c) => sweep(A.paint, run, (t) => { const o = f(t); return [[o - w / 2, 0.012], [o + w / 2, 0.012]]; }, c);
  for (const side of [1, -1]) {
    line(st, () => side * 0.17, 0.12, COL.yellow);
    line(st, (t) => side * (t.h - 0.75), 0.15, COL.paintW);
    for (let u = 1012; u + 3 <= 1742; u += 12) line(split(u, u + 3).length > 1 ? split(u, u + 3) : stations(u, u + 3, 3), () => side * 3.8, 0.13, COL.paintW);
  }
  yield;
  // ---- the towers: two legs from a pile cap in the bay, leaning in to meet over the road; the head above them, where
  // the stays are anchored; a strut under the deck between the legs
  const towerCol = [];
  for (const tz of TOWERS) {
    const tu = -tz, dy = PY(tu);
    // the pile cap and its fender
    boxAt(A.concrete, X, -1.5, tz, 24, 2.6, 7.5, 0, COL.cap, { col });
    boxAt(A.concrete, X, 1.45, tz, 22.5, 0.35, 6.4, 0, COL.pale, { col });
    for (const side of [1, -1]) {
      // the leg: from its foot 19 m out to the head's width at 92 m, its section narrowing as it rises
      const base = { x: X + side * 19, y: 1.8 }, top = { x: X + side * 1.6, y: 92 };
      const n = 12, ring = (k) => { const w = 2.0 - 0.6 * k, d = 3.0 - 0.8 * k; return [[-w, d], [w, d], [w, -d], [-w, -d], [-w, d]]; };
      const leg = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = base.x + (top.x - base.x) * k, y = base.y + (top.y - base.y) * k;
        // (its own frame: along it upward, its right across it; a leg's section is in x and z)
        leg.push({ s: k, x, y, z: tz, k, tx: 0, tz: 1, rx: 1, rz: 0 });
      }
      // swept as a prism along the leg: each ring a rectangle in (across, along) at its height
      legPrism(A.concrete, leg, ring, COL.tower, col);
      // floodlit at night: the wash of light up the leg's outer face, and its inner one (over the road)
      legStrip(A.flood, leg, side);
      legStrip(A.flood, leg, -side, true);
      towerCol.push({ base, top, tz });
    }
    // the head: from where the legs meet to the top, its anchors on its north and south faces
    column(A.concrete, X, tz, 90.5, TOWER_H, 2.4, 3.4, 0, COL.tower, { col, sides: 16, round: 0.2 });
    boxAt(A.concrete, X, TOWER_H + 0.35, tz, 2.0, 0.35, 3.0, 0, COL.pale, { col });
    // a crown: a slim spire over the head, and the red lights
    column(A.steel, X, tz, TOWER_H + 0.7, TOWER_H + 7.5, 0.18, 0.18, 0, COL.white, { sides: 8, round: 1 });
    boxAt(A.red, X, TOWER_H + 7.7, tz, 0.3, 0.25, 0.3, 0, COL.red);
    for (const side of [1, -1]) for (const y of [48, 70]) { const x = X + side * (19 - 17.4 * (y - 1.8) / 90.2) + side * 2.0; boxAt(A.red, x + side * 0.05, y, tz, 0.15, 0.25, 0.25, 0, COL.red); }
    // the strut under the deck between the legs, the deck's bearings on it
    const sy = dy - depthAt(dy) - 1.6;
    const sx = 19 - 17.4 * ((sy - 1.8) / 90.2);
    boxAt(A.concrete, X, sy, tz, sx - 0.5, 1.6, 2.6, 0, COL.tower, { col });
    yield;
  }
  // ---- the stays: from each tower's head to both edges of the deck, a dozen each way, the farthest anchored highest
  for (const tz of TOWERS) {
    const tu = -tz;
    for (const dir of [1, -1]) for (const side of [1, -1]) for (let k = 0; k < 12; k++) {
      const u = tu + dir * (24 + 12 * k);
      // (from the deck's edge to the head's face toward it: the south face for the stays to the south)
      const a = new THREE.Vector3(X + side * 10.7, PY(u) + 0.35, -u), b = new THREE.Vector3(X + side * 1.15, 95.5 + k * 1.3, tz - dir * 2.6);
      stay(A.stays, col, a, b, 0.1 + 0.006 * k);
      // its anchor sleeve at the deck's edge
      const d = b.clone().sub(a).normalize();
      stay(A.steel, null, a, a.clone().addScaledVector(d, 2.2), 0.24 + 0.006 * k, COL.white);
    }
  }
  yield;
  // ---- the side spans' piers: two columns, a cap beam under the girder; a pile cap each in the water
  for (const pu of PIERS) {
    const y = PY(pu) - depthAt(PY(pu)), z = -pu;
    boxAt(A.concrete, X, -1.2, z, 12, 2.0, 4.2, 0, COL.cap, { col });
    for (const side of [1, -1]) column(A.concrete, X + side * 6.2, z, 0.8, y - 1.4, 1.5, 1.5, 0, COL.tower, { col, sides: 16, round: 0.35 });
    boxAt(A.concrete, X, y - 0.7, z, 9.6, 0.7, 1.9, 0, COL.tower, { col });
  }
  // the abutments at the ends: a wall across under the deck's end, its wing walls
  for (const [u, dir] of [[U0, 1], [U1, -1]]) {
    const z = -u;
    boxAt(A.concrete, X, -2.0, z - dir * 0.6, 11.4, 2.05, 0.6, 0, COL.pale, { col });
    for (const side of [1, -1]) boxAt(A.concrete, X + side * 11.3, 0.25, z + dir * 0.4, 0.3, 0.45, 2.2, 0, COL.pale, { col });
  }
  yield;
  // ---- the railing at the edges: posts every 2 m, a top rail and two below it
  for (const side of [1, -1]) {
    const x = X + side * 10.7;
    for (const [y, h] of [[1.38, 0.05], [0.95, 0.025], [0.62, 0.025]]) sweep(A.steel, st, () => [[side * 10.7 - 0.05, y + h], [side * 10.7 + 0.05, y + h], [side * 10.7 + 0.05, y - h], [side * 10.7 - 0.05, y - h], [side * 10.7 - 0.05, y + h]], COL.rail);
    for (let u = U0 + 1; u < U1; u += 2) boxAt(A.steel, x, PY(u) + 0.32 + 0.55, -u, 0.04, 0.55, 0.04, 0, COL.rail);
    // (the railing's collider: a wall to 1.4 m)
    const wall = stations(U0, U1, 12);
    railCol(col, wall, side * 10.7);
  }
  yield;
  // ---- the lights: lamps along both walkways every 36 m (staggered), arms over the road; the string of lights along
  // the deck's edges; pools of light under the lamps
  for (const side of [1, -1]) {
    for (let u = U0 + 30 + (side > 0 ? 0 : 18); u < U1 - 20; u += 36) {
      const t = stations(u, u, 1)[0], x = X + side * (t.h + 0.8), y = t.y + 0.15;
      column(A.steel, x, -u, y, y + 10.5, 0.11, 0.11, 0, COL.rail, { sides: 8, round: 1 });
      boxAt(A.steel, x - side * 1.2, y + 10.35, -u, 1.25, 0.05, 0.05, 0, COL.rail);
      boxAt(A.lamp, x - side * 2.45, y + 10.25, -u, 0.6, 0.09, 0.3, 0, COL.lamp);
      pool(A.pool, x - side * 2.6, t.y + 0.03, -u, 8);
      colBox(col, x, y + 5.25, -u, 0.12, 5.25, 0.12, 0);
    }
    // (a line of light along the fascia, under the walkway's edge: the bridge drawn on the night)
    const edge = split(FILL.n, FILL.s);
    sweep(A.lamp, edge, () => (side > 0 ? [[11.04, -0.22], [11.04, -0.34]] : [[-11.04, -0.34], [-11.04, -0.22]]), COL.lamp);
  }
  // ---- the gantries at each end: the bridge's name, and where the road goes
  const signs = [];
  for (const [u, side, id] of [[U0 + 40, 1, 'bridge:south'], [U1 - 40, -1, 'bridge:north']]) {
    const y = PY(u), z = -u;
    for (const e of [0.3, ROAD + 0.2]) { column(A.steel, X + side * e, z, y, y + 8.6, 0.2, 0.2, 0, COL.rail, { col, sides: 10, round: 1 }); }
    for (const yy of [8.45, 5.25]) boxAt(A.steel, X + side * (ROAD / 2 + 0.25), y + yy, z, ROAD / 2 + 0.3, 0.08, 0.08, 0, COL.rail);
    const rect = ctx.signRects?.get(id);
    // (southbound's sign faces north, toward the traffic coming; northbound's faces south)
    if (rect) signFace(A.sign, X + side * (ROAD / 2 + 0.25), y + 6.85, z + side * 0.3, side > 0 ? 0 : Math.PI, 7.8, 3.3, rect);
    signs.push(id);
  }
  yield;

  // ---- into meshes, and the collider
  const M = ctx.mats;
  for (const [key, acc] of Object.entries(A)) {
    const geo = acc.geometry();
    if (!geo) continue;
    const m = new THREE.Mesh(geo, M[key]);
    m.name = `bridge_${key}`;
    m.castShadow = ['concrete', 'steel', 'stays'].includes(key);
    m.receiveShadow = !['pool', 'red', 'flood', 'lamp', 'sign'].includes(key);
    if (key === 'pool') m.renderOrder = 2;
    group.add(m);
  }
  const body = ctx.trimesh?.(new Float32Array(col.p), new Uint32Array(col.i));
  return { group, body, tris: col.i.length / 3, signs };
}

// a leg's prism: rings of its section (across in x, along in z) at each station's height, the leg leaning in x
function legPrism(acc, leg, ring, color, col) {
  const R = leg.map((t) => ring(t.k).map(([a, d]) => [t.x + a, t.y, t.z + d]));
  const m = R[0].length, base = acc.count, cc = color;
  // each face its own strip, its normal from the leg's lean
  for (let f = 0; f + 1 < m; f++) {
    const b0 = acc.count;
    for (let i = 0; i < leg.length; i++) {
      const p = R[i][f], q = R[i][f + 1], up = i + 1 < leg.length ? R[i + 1][f] : R[i][f], dn = i > 0 ? R[i - 1][f] : R[i][f];
      const E = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], T = [up[0] - dn[0], up[1] - dn[1], up[2] - dn[2]];
      let nx = E[1] * T[2] - E[2] * T[1], ny = E[2] * T[0] - E[0] * T[2], nz = E[0] * T[1] - E[1] * T[0];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      acc.v(p[0], p[1], p[2], nx, ny, nz, f * 4, p[1], cc); acc.v(q[0], q[1], q[2], nx, ny, nz, f * 4 + Math.hypot(...E), q[1], cc);
    }
    for (let i = 0; i + 1 < leg.length; i++) acc.q(b0 + i * 2, b0 + i * 2 + 1, b0 + i * 2 + 3, b0 + i * 2 + 2);
  }
  void base;
  if (col) {
    const b = col.p.length / 3;
    for (const r of R) for (const p of r) col.v(...p);
    for (let i = 0; i + 1 < R.length; i++) for (let f = 0; f + 1 < m; f++) col.q(b + i * m + f, b + i * m + f + 1, b + (i + 1) * m + f + 1, b + (i + 1) * m + f);
  }
}
// a band of light up a leg's face toward `side` (the floodlights' wash, at night; fading as it climbs), the inner
// face's (`inner`) from the deck up
function legStrip(acc, leg, side, inner = false) {
  const b = acc.count;
  for (const t of leg) {
    const hw = 2.0 - 0.6 * t.k, d = 2.6 - 0.7 * t.k, w = C(0xffffff).multiplyScalar(inner ? 0.7 * (1 - t.k * 0.6) : 1 - t.k * 0.45);
    acc.v(t.x + side * (hw + 0.03), t.y, t.z - d, side, 0.2, 0, 0, t.k, w);
    acc.v(t.x + side * (hw + 0.03), t.y, t.z + d, side, 0.2, 0, 1, t.k, w);
  }
  for (let i = 0; i + 1 < leg.length; i++) side > 0 ? acc.q(b + i * 2, b + i * 2 + 2, b + i * 2 + 3, b + i * 2 + 1) : acc.q(b + i * 2, b + i * 2 + 1, b + i * 2 + 3, b + i * 2 + 2);
}
// a stay: a six-sided tube from a to b
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function stay(acc, col, a, b, r, color = COL.stay) {
  const d = _a.copy(b).sub(a), L = d.length(); d.normalize();
  const u = _b.set(0, 1, 0).cross(d).normalize(), v = _c.copy(d).cross(u).normalize();
  const n = 6, base = acc.count;
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * Math.PI * 2, cx = Math.cos(ang), cy = Math.sin(ang);
    const nx = u.x * cx + v.x * cy, ny = u.y * cx + v.y * cy, nz = u.z * cx + v.z * cy;
    acc.v(a.x + nx * r, a.y + ny * r, a.z + nz * r, nx, ny, nz, i / n, 0, color);
    acc.v(b.x + nx * r, b.y + ny * r, b.z + nz * r, nx, ny, nz, i / n, L, color);
  }
  for (let i = 0; i < n; i++) acc.q(base + i * 2, base + i * 2 + 2, base + i * 2 + 3, base + i * 2 + 1);
  if (col) {
    // (a three-sided prism, a little fatter: Hal flying into one stops)
    const cb = col.p.length / 3;
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2, cx = Math.cos(ang) * (r + 0.1), cy = Math.sin(ang) * (r + 0.1);
      col.v(a.x + u.x * cx + v.x * cy, a.y + u.y * cx + v.y * cy, a.z + u.z * cx + v.z * cy);
      col.v(b.x + u.x * cx + v.x * cy, b.y + u.y * cx + v.y * cy, b.z + u.z * cx + v.z * cy);
    }
    for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; col.q(cb + i * 2, cb + j * 2, cb + j * 2 + 1, cb + i * 2 + 1); }
  }
}
// the railing as a wall for the collider
function railCol(col, st, o) {
  const b = col.p.length / 3;
  for (const t of st) { col.v(t.x + o, t.y + 0.3, t.z); col.v(t.x + o, t.y + 1.45, t.z); }
  for (let i = 0; i + 1 < st.length; i++) col.q(b + i * 2, b + i * 2 + 2, b + i * 2 + 3, b + i * 2 + 1);
}
function pool(acc, x, y, z, r) {
  const base = acc.count, w = C(0xffffff);
  acc.v(x - r, y, z - r, 0, 1, 0, 0, 0, w); acc.v(x + r, y, z - r, 0, 1, 0, 1, 0, w); acc.v(x + r, y, z + r, 0, 1, 0, 1, 1, w); acc.v(x - r, y, z + r, 0, 1, 0, 0, 1, w);
  acc.q(base, base + 3, base + 2, base + 1);
}
function signFace(acc, x, y, z, yaw, w, h, [u0, v0, u1, v1]) {
  const c = Math.cos(yaw), s = Math.sin(yaw), nx = s, nz = c, ax = c, az = -s, col = C(0xffffff);
  const P = (u, v) => [x + ax * u * w / 2, y + v * h / 2, z + az * u * w / 2];
  const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const base = acc.count;
  q.forEach(([px, py, pz], i) => acc.v(px, py, pz, nx, 0, nz, uv[i][0], uv[i][1], col));
  acc.q(base, base + 1, base + 2, base + 3);
  const b2 = acc.count, back = C(0x8c9094); // (galvanised: the back of a guide sign)
  q.forEach(([px, py, pz]) => acc.v(px - nx * 0.1, py, pz - nz * 0.1, -nx, 0, -nz, 0.999, 0.999, back));
  acc.q(b2, b2 + 3, b2 + 2, b2 + 1);
}
export const BRIDGE_SIGNS = [
  { id: 'bridge:south', lines: ['Coast Bay Bridge', 'Ferris Field · Desert Rd'], sub: 'SOUTH', exit: null, arrow: null, bridge: true },
  { id: 'bridge:north', lines: ['Coast City', 'Highway 1 · Downtown'], sub: 'NORTH', exit: null, arrow: null, bridge: true },
];
