import * as THREE from 'three';
import { HIGHWAY, RIVER, waterAt, nearest } from './Layout.js';
import { streetSegments, NS, EW } from './Plan.js';

// Highway 1 (the map rework, 2026-11-24: city/Layout.js HIGHWAY): the elevated freeway round the city on piers
// down the middles of the streets it follows, its corners swept wide across the blocks left open for them, and its
// two spurs east over the river to the valley. Two carriageways of two lanes, a median barrier, parapets, lamps
// on the median, sign gantries before each exit. Ramps: a diamond at the road from the field (the boulevard runs
// under the south leg, x 6), one at Downtown (the west leg, the street at z 1070), one at Port Haven (the north
// leg, the street at x -314); each ramp is the carriageway's outer lane peeling off inside the deck's own width (an
// exit-only lane: the deck narrows to one lane each way over the diamond), so nothing comes over the blocks. The
// spurs leave the east side: a flyover off the inner carriageway over the loop, the other way in merging onto the
// outer one; each crosses the river on a steel arch. In the lot's frame (Ferris.js LOT), y up.
//
// The data here (the lines, their heights, the lanes) is plain geometry, no scene: `highwayLanes()` is for the
// traffic, `highwayRoads()` for anything else that wants the shapes. The building (`buildHighway`) is driven by
// city/Landmarks.js with the city's materials. Shared with the Bay Bridge (city/Bridge.js): Path, Acc, sweep.

export const DECK = HIGHWAY.deck; // 11.5: the road's surface on the deck
export const HALF = HIGHWAY.half; // 9.4: the deck's half width
const CUT = 5.0; // the through deck's edge where its outer lane has gone to a ramp
const MED = 0.3; // the median barrier's half width at its foot
const RAMP_O = 7.2, RAMP_W = 2.2; // a diamond's ramp: its middle off the line, its half width (5.0 to 9.4)
const LANE_IN = 2.8, LANE_OUT = 6.4; // the lanes' middles off the line
const CONN_W = 2.2; // a connector's half width (one lane), and with two lanes
const CONN_W2 = 4.55;
const GIRDER = 2.1; // the box girder's depth under the road
const SOFFIT = DECK - GIRDER; // 9.4: where the piers' caps meet it
const LAMP_EVERY = 50;
const NEAR = 460; // (a chunk within this of the camera is drawn itself; beyond, its part of the one far copy)
export const SPEED = { main: 27, ramp: 15, connector: 22 }; // (m/s: 100, 55 and 80 km/h)

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------------ paths
// A polyline sampled finely (a few metres), its length along it `s`, a smooth tangent anywhere.
export class Path {
  constructor(pts, closed = false) {
    this.pts = pts; this.closed = closed;
    const n = pts.length, S = (this.S = new Float64Array(n + 1));
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1], b = pts[i % n];
      S[i] = S[i - 1] + (i < n || closed ? Math.hypot(b.x - a.x, b.z - a.z) : 0);
    }
    this.len = closed ? S[n] : S[n - 1];
    // a tangent at each point: the mean of the segments either side
    this.T = pts.map((p, i) => {
      const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      return { x: dx / L, z: dz / L };
    });
  }
  wrap(s) { return this.closed ? ((s % this.len) + this.len) % this.len : clamp(s, 0, this.len); }
  // the place at s: x, z, the unit tangent (tx, tz) and the right of it (rx, rz: x east, z north, y up, as three.js
  // has it, the right of a heading d is (-d.z, d.x))
  at(s, o = {}) {
    s = this.wrap(s);
    const S = this.S, n = this.pts.length;
    let lo = 0, hi = this.closed ? n : n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const i = lo, j = (i + 1) % n, L = S[i + 1] - S[i] || 1, t = clamp((s - S[i]) / L, 0, 1);
    const a = this.pts[i], b = this.pts[j], ta = this.T[i], tb = this.T[j];
    o.x = lerp(a.x, b.x, t); o.z = lerp(a.z, b.z, t);
    let tx = lerp(ta.x, tb.x, t), tz = lerp(ta.z, tb.z, t);
    const k = Math.hypot(tx, tz) || 1;
    o.tx = tx / k; o.tz = tz / k; o.rx = -o.tz; o.rz = o.tx; o.s = s;
    return o;
  }
  // the point `o` metres to the right of s
  side(s, off, out = {}) { this.at(s, out); out.x += out.rx * off; out.z += out.rz * off; return out; }
  // the nearest place on it to (x, z): { s, d (signed: + to the right) }
  project(x, z) {
    const n = nearest(this.closed ? [...this.pts, this.pts[0]] : this.pts, x, z);
    const p = this.at(n.s);
    return { s: n.s, d: (x - p.x) * p.rx + (z - p.z) * p.rz };
  }
}
// dense points along a centripetal Catmull-Rom through `pts` (no overshoot where the points are spaced unevenly:
// Layout's uniform one loops at the loop's corners)
export function spline(pts, step = 3) {
  const out = [], n = pts.length;
  const P = (i) => pts[clamp(i, 0, n - 1)];
  for (let i = 0; i + 1 < n; i++) {
    const p0 = i === 0 ? { x: 2 * P(0).x - P(1).x, z: 2 * P(0).z - P(1).z } : P(i - 1), p1 = P(i), p2 = P(i + 1);
    const p3 = i + 2 >= n ? { x: 2 * P(n - 1).x - P(n - 2).x, z: 2 * P(n - 1).z - P(n - 2).z } : P(i + 2);
    const d = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.z - a.z)));
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    const k = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / step));
    for (let j = 0; j < k; j++) {
      const t = lerp(t1, t2, j / k), f = (key) => {
        const A1 = ((t1 - t) * p0[key] + (t - t0) * p1[key]) / (t1 - t0), A2 = ((t2 - t) * p1[key] + (t - t1) * p2[key]) / (t2 - t1), A3 = ((t3 - t) * p2[key] + (t - t2) * p3[key]) / (t3 - t2);
        const B1 = ((t2 - t) * A1 + (t - t0) * A2) / (t2 - t0), B2 = ((t3 - t) * A2 + (t - t1) * A3) / (t3 - t1);
        return ((t2 - t) * B1 + (t - t1) * B2) / (t2 - t1);
      };
      out.push({ x: f('x'), z: f('z') });
    }
  }
  out.push({ ...P(n - 1) });
  return out;
}
// a height along a road: a monotone cubic through [s, y] points (Fritsch-Carlson: no overshoot), level past the ends
export function profile(pts) {
  const n = pts.length, s = pts.map((p) => p[0]), y = pts.map((p) => p[1]);
  if (n === 1) return () => y[0];
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i + 1 < n; i++) d.push((y[i + 1] - y[i]) / (s[i + 1] - s[i]));
  // (Fritsch-Butland: a weighted harmonic mean of the slopes either side, h0 and h1 the intervals)
  for (let i = 1; i + 1 < n; i++) {
    const h0 = s[i] - s[i - 1], h1 = s[i + 1] - s[i];
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  m[0] = pts[0][2] ?? 0; m[n - 1] = pts[n - 1][2] ?? 0; // (the ends level unless a slope's given)
  const f = (x) => {
    if (x <= s[0]) return y[0];
    if (x >= s[n - 1]) return y[n - 1];
    let i = 0; while (s[i + 1] < x) i++;
    const h = s[i + 1] - s[i], t = (x - s[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  };
  f.grade = (x) => (f(x + 0.5) - f(x - 0.5));
  return f;
}

// ------------------------------------------------------------------------------------------------ the loop
// Layout's loopLine exactly (its legs down the middles of the streets, its corners arcs of 320 m: within a metre of
// it, the arcs sampled finer), starting where the road from the field runs under it (x 6, the south leg) heading
// east, so s 0 is the interchange, and running east, north up the east leg, west, south: its right is the city's
// inside.
const HX = { w: -954, e: 1286 }, HZ = { s: -615, n: 2070 }, HR = 320;
function loopPoints() {
  const pts = [];
  const line = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), k = Math.ceil(L / 4); for (let i = 0; i < k; i++) pts.push({ x: lerp(x0, x1, i / k), z: lerp(z0, z1, i / k) }); };
  const arc = (cx, cz, a0, a1) => { const k = Math.ceil((Math.abs(a1 - a0) * HR) / 2); for (let i = 0; i < k; i++) { const a = lerp(a0, a1, i / k); pts.push({ x: cx + HR * Math.cos(a), z: cz + HR * Math.sin(a) }); } };
  line(6, HZ.s, HX.e - HR, HZ.s);
  arc(HX.e - HR, HZ.s + HR, -Math.PI / 2, 0);
  line(HX.e, HZ.s + HR, HX.e, HZ.n - HR);
  arc(HX.e - HR, HZ.n - HR, 0, Math.PI / 2);
  line(HX.e - HR, HZ.n, HX.w + HR, HZ.n);
  arc(HX.w + HR, HZ.n - HR, Math.PI / 2, Math.PI);
  line(HX.w, HZ.n - HR, HX.w, HZ.s + HR);
  arc(HX.w + HR, HZ.s + HR, Math.PI, Math.PI * 1.5);
  line(HX.w + HR, HZ.s, 6, HZ.s);
  return pts;
}
// where the loop's legs are: s at the start of each piece (for placing things by street)
const LEG = (() => {
  const a = Math.PI * HR / 2, L = [960, a, 2045, a, 1600, a, 2045, a, 640];
  const at = [0]; for (const l of L) at.push(at.at(-1) + l);
  return { south: [at[0], at[1]], se: [at[1], at[2]], east: [at[2], at[3]], ne: [at[3], at[4]], north: [at[4], at[5]], nw: [at[5], at[6]], west: [at[6], at[7]], sw: [at[7], at[8]], south2: [at[8], at[9]], len: at[9] };
})();
// s on the loop of a place along a leg
const onSouth = (x) => (x >= 6 ? x - 6 : LEG.south2[0] + (x - (HX.w + HR)));
const onEast = (z) => LEG.east[0] + (z - (HZ.s + HR));
const onNorth = (x) => LEG.north[0] + (HX.e - HR - x);
const onWest = (z) => LEG.west[0] + (HZ.n - HR - z);

// ------------------------------------------------------------------------------------------------ the plan
// The diamonds: where a street crosses under the loop, an exit and an entrance on each carriageway. `s` the
// crossing on the loop, `kerb` its road's half width, `u` how far each way the ramps reach (where they leave the
// deck), the exits' names for the signs, each carriageway's (`in`: the inner, travelling with s).
const DIAMONDS = [
  { id: 'field', s: 0, kerb: 6.4, front: 11.9, cross: 'ns', names: { in: ['Bay Bridge', 'Ferris Field'], out: ['Bay Bridge', 'Ferris Field'] }, exit: 3 },
  { id: 'downtown', s: onWest(1070), kerb: EW.kerb, front: EW.front, cross: 'ew', names: { in: ['Downtown', 'Civic Plaza'], out: ['Downtown', 'Ocean Avenue'] }, exit: 8 },
  { id: 'port', s: onNorth(-314), kerb: NS.kerb, front: NS.front, cross: 'ns', names: { in: ['Port Haven', 'Midtown'], out: ['Port Haven', 'Shipyards'] }, exit: 11 },
];
const RAMP_U = 230; // a ramp's length from the crossing to where it leaves the deck
// a ramp's height by its distance from the crossing: down on the pavement at the corner (the road's kerb, then its
// pavement) and up over the next street across (80 m on: the grid's north-south streets) high enough to drive
// under, to the deck. 9% at its steepest.
const rampY = (kerb, front) => profile([[kerb, 0.03], [kerb + 1.4, 0.17], [front + 1.5, 0.22], [24, 1.05], [40, 2.5], [57, 4.0], [73, 5.45], [90, 6.75], [130, 9.0], [175, 10.75], [RAMP_U, DECK]]);

// The spurs' junctions, built by hand round the river: the flyover off the inner carriageway (it leaves on the
// city's side, climbs beside the deck and crosses over it), and the merge onto the outer carriageway (it comes in
// alongside the deck's outer edge), both meeting the spur on the river's near bank, where its deck begins.
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const loop = new Path(loopPoints(), true);
  const spurs = HIGHWAY.spurs.map((line) => new Path(spline(line, 4)));
  // where each spur's deck begins: its line on the river's near bank, 6 m short of the water
  const bank = (path, from) => { for (let s = from; s < path.len; s += 2) { const p = path.at(s); if (waterAt(p.x, p.z) === 'river') return s - 6; } return from; };
  const J = [
    { id: 'ne', spur: spurs[0], s0: bank(spurs[0], 60), name: 'North Valley' },
    { id: 'se', spur: spurs[1], s0: bank(spurs[1], 60), name: 'South Valley' },
  ];
  const roads = [];
  // ---- the loop's own deck, its outer lanes cut where the diamonds' ramps have them: [a, b, the road that takes
  // the lane at the cut's upstream end, the one that gives it back downstream] (the inner side's travel is with s,
  // the outer side's against it)
  const cutR = [], cutL = [];
  for (const D of DIAMONDS) { cutR.push([D.s - RAMP_U, D.s + RAMP_U, `${D.id}:in:off`, `${D.id}:in:on`]); cutL.push([D.s - RAMP_U, D.s + RAMP_U, `${D.id}:out:off`, `${D.id}:out:on`]); }
  roads.push({ id: 'loop', kind: 'dual', path: loop, s0: 0, s1: loop.len, closed: true, y: () => DECK, cutR, cutL, gapR: [], gapL: [] });
  const loopRoad = roads[0];
  // ---- the diamonds' ramps (each in its direction of travel: its right is the deck's outside)
  for (const D of DIAMONDS) {
    const Y = rampY(D.kerb, D.front);
    // u from the crossing (- before it along s, + after); the ramp's middle 7.2 m off the line (+ right, the inner side)
    const ramp = (id, side, u0, u1) => {
      const dir = Math.sign(u1 - u0), n = Math.ceil(Math.abs(u1 - u0) / 3), pts = [];
      for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n); pts.push(loop.side(D.s + u, side * RAMP_O, {})); }
      const p = new Path(pts.map(({ x, z }) => ({ x, z })));
      const off = /off/.test(id);
      roads.push({ id: `${D.id}:${id}`, kind: 'ramp', diamond: D, path: p, s0: 0, s1: p.len, y: (s) => Y(Math.abs(u0 + dir * s)), off, side, dirSign: dir,
        terminal: off ? p.len : 0, u0, u1 });
    };
    // the inner carriageway (with s): off before the crossing, on after it; the outer (against s): off after, on before
    ramp('in:off', 1, -RAMP_U, -D.kerb);
    ramp('in:on', 1, D.kerb, RAMP_U);
    ramp('out:off', -1, RAMP_U, D.kerb);
    ramp('out:on', -1, -D.kerb, -RAMP_U);
  }
  // ---- the spurs' junctions
  const offLine = (s0, s1, o, step = 6) => { const out = [], n = Math.ceil(Math.abs(s1 - s0) / step); for (let i = 0; i <= n; i++) { const q = loop.side(lerp(s0, s1, i / n), o, {}); out.push({ x: q.x, z: q.z }); } return out; };
  // (a profile's points kept in order: one too close behind another is dropped)
  const sorted = (pts) => { const out = []; for (const p of pts) if (!out.length || p[0] > out.at(-1)[0] + 5) out.push(p); return out; };
  for (const j of J) {
    const sp = j.spur;
    // the spur's halves where its deck begins: outbound on its right (away from the city), inbound on its left
    const outEnd = [], inEnd = [];
    for (let s = j.s0 - 70; s <= j.s0 + 0.01; s += 10) { const a = sp.side(s, 4.85, {}), b = sp.side(s, -4.85, {}); outEnd.push({ x: a.x, z: a.z }); inEnd.push({ x: b.x, z: b.z }); }
    const inStart = inEnd.slice().reverse();
    let fly, merge, flyY, flyAttach, mergeAttach;
    if (j.id === 'ne') {
      // the flyover: off the inner (northbound, west) carriageway at z 1150 onto a lane alongside (the Hills' foot, open
      // ground), climbing north beside the deck, over it at 20 m round z 1450 heading north-east, down to the spur's
      // outbound half on the bank
      j.divert = onEast(1110); j.merge = onEast(1330);
      fly = [...offLine(j.divert, j.divert + 90, HALF + CONN_W, 10), { x: 1272, z: 1290 }, { x: 1270, z: 1345 }, { x: 1284, z: 1405 }, ...outEnd];
      // the merge: from the spur's inbound half south-west, in alongside the outer (southbound, east) carriageway at z 1330
      merge = [...inStart, { x: 1337, z: 1418 }, ...offLine(j.merge, j.merge - 100, -(HALF + CONN_W), 10)];
      flyAttach = { mode: 'outside', at: 'start' }; mergeAttach = { mode: 'outside', at: 'end' };
    } else {
      // the flyover: the inner (eastbound, north) carriageway's outer lane leaves inside the deck's width at x 790 (the
      // street's pavement under it), climbs to 21 m beside the deck, straight on east over the corner as it turns
      // north, along over the north pavement of the street at z -615 and down to the spur's outbound half on the bank
      j.divert = onSouth(790); j.merge = onSouth(900);
      const strip = offLine(j.divert, LEG.south[1], RAMP_O, 6), z = strip.at(-1).z;
      fly = [...strip, ...[1000, 1040, 1080, 1130, 1180, 1230].map((x) => ({ x, z: z - (x - 966) * 0.012 })), ...outEnd];
      // the merge: from the spur's inbound half west, over the south pavement of the street at z -615, onto the
      // outer (westbound) carriageway inside its width where the corner meets the south leg
      const strip2 = offLine(LEG.south[1], j.merge, -RAMP_O, 6), z2 = strip2[0].z;
      merge = [...inStart, ...[1230, 1180, 1120, 1060, 1010].map((x) => ({ x, z: z2 - Math.max(0, x - 1150) * 0.02 })), ...strip2];
      flyAttach = { mode: 'inside', at: 'start' }; mergeAttach = { mode: 'inside', at: 'end' };
      // the deck's outer lanes cut for them: the eastbound's until the flyover is high enough to drive under, the
      // westbound's round the corner's end (its outer lane ends there: the merge's lane takes its place)
      loopRoad.cutR.push([j.divert, j.divert + 102, 'se:fly', null]);
      loopRoad.cutL.push([j.merge, LEG.se[0] + 56, null, 'se:merge']);
    }
    const flyPath = new Path(spline(fly, 3)), mergePath = new Path(spline(merge, 3));
    const L = flyPath.len;
    if (j.id === 'ne') {
      // where it's over the loop's middle (the top of its climb)
      let over = L / 2, prev = null;
      for (let s = 100; s < L - 60; s += 1) { const p = flyPath.at(s), d = loop.project(p.x, p.z).d; if (prev !== null && Math.sign(d) !== Math.sign(prev)) { over = s; break; } prev = d; }
      flyY = profile(sorted([[0, DECK], [92, DECK], [over - 80, 19.3], [over - 22, 20.0], [over + 22, 20.0], [L - 60, DECK], [L, DECK]]));
      j.over = over;
    } else {
      // up from the deck to 21 by the corner, held over it and the merge alongside, down to the bank
      const sAt = (x) => { for (let s = 0; s < L; s += 1) if (flyPath.at(s).x >= x) return s; return L; };
      flyY = profile(sorted([[0, DECK], [165, 21.0], [sAt(1180), 21.0], [L - 60, DECK], [L, DECK]]));
      j.over = sAt(1020);
    }
    roads.push({ id: `${j.id}:fly`, kind: 'conn', junction: j, path: flyPath, s0: 0, s1: L, y: flyY, attach: flyAttach, widen: [L - 70, L - 15], out: true });
    roads.push({ id: `${j.id}:merge`, kind: 'conn', junction: j, path: mergePath, s0: 0, s1: mergePath.len, y: () => DECK, attach: mergeAttach, widen: [70, 15], out: false });
    // the spur itself: its deck from the bank, over the river, out across the valley and down to the ground
    const end = sp.len, Yspur = profile([[j.s0, DECK], [end - 330, DECK], [end - 40, 0.02], [end, 0.02]]);
    roads.push({ id: `${j.id}:spur`, kind: 'dual', path: sp, s0: j.s0, s1: end, y: Yspur, cutR: [], cutL: [], gapR: [], gapL: [], spur: j, ground: end - 40 });
  }
  // the deck's outer parapet open where an outside connector runs alongside it (worked out from where its inner edge
  // touches the deck's edge)
  for (const r of roads) {
    if (r.kind !== 'conn' || r.attach.mode !== 'outside') continue;
    let a = Infinity, b = -Infinity, side = 0, ca = Infinity, cb = -Infinity;
    for (let s = 0; s <= r.path.len; s += 1) {
      const e = r.path.side(s, -CONN_W, {}), q = loop.project(e.x, e.z);
      if (Math.abs(Math.abs(q.d) - HALF) < 0.25 && r.y(s) < DECK + 0.05) { a = Math.min(a, q.s); b = Math.max(b, q.s); side = Math.sign(q.d); ca = Math.min(ca, s); cb = Math.max(cb, s); }
    }
    if (a < b) { (side > 0 ? loopRoad.gapR : loopRoad.gapL).push([a, b]); r.flush = [ca, cb]; }
  }
  PLAN = { loop, roads, DIAMONDS, J, LEG };
  return PLAN;
}
export const highwayRoads = () => plan().roads;
export const highwayLoop = () => plan().loop;
// The centre lines as built, for the map and anything else that draws or follows them: each { id, kind ('loop',
// 'spur', 'ramp', 'connector'), closed, pts [{ x, y, z }] every `step` metres (y the road's surface), half ([left,
// right] at each point: the deck's edges either side of the line, looking along it; the loop's right is the city's
// inside, and either side is 5.0 instead of 9.4 where its outer lane has gone to a ramp),
// lanes (each way for the loop and spurs; one for a ramp, one or two for a connector) }. In the lot's frame. A ramp's
// first or last point is on the crossing street's kerb (city/Highway.js highwayLanes `street` says which).
export function highwayCentrelines(step = 8) {
  const P = plan(), L = P.loop.len, out = [];
  for (const r of P.roads) {
    const n = Math.max(1, Math.ceil((r.s1 - r.s0) / step)), pts = [], half = [];
    const last = r.closed ? n - 1 : n;
    for (let i = 0; i <= last; i++) {
      const s = r.s0 + ((r.s1 - r.s0) * i) / n, p = r.path.at(s);
      pts.push({ x: +p.x.toFixed(2), y: +r.y(s).toFixed(2), z: +p.z.toFixed(2) });
      if (r.kind === 'dual') {
        const LL = r.closed ? L : 0;
        half.push([+(within(s, r.cutL, LL) ? CUT : HALF), +(within(s, r.cutR, LL) ? CUT : HALF)]);
      } else {
        const w = r.widen ? (() => { const [a, b] = r.widen, k = a < b ? ss(a, b, s) : 1 - ss(b, a, s); return lerp(CONN_W, CONN_W2, k); })() : r.kind === 'ramp' ? RAMP_W : CONN_W;
        half.push([w, w]);
      }
    }
    out.push({ id: r.id, kind: r.id === 'loop' ? 'loop' : r.spur ? 'spur' : r.kind === 'ramp' ? 'ramp' : 'connector', closed: !!r.closed, pts, half, lanes: r.kind === 'dual' ? 2 : r.widen ? 2 : 1 });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ lanes
// The lanes for the traffic, in the lot's frame: each { id, road, kind ('main', 'ramp', 'connector'), pts [{ x, y, z }]
// in its direction of travel (every 6 to 10 m), next [ids it runs on into], from [ids that run into it], speed (m/s) }.
// A diamond's ramp has `street` { x, z, heading, crossing, entrance }: where it meets the crossing street's kerb (an
// exit's end, an entrance's start). A lane a connector leaves or joins partway lists it in `branches` / `joins`
// ({ s: metres along the lane, id }). The loop's lane 1 each way runs all the way round (`closed`); its lane 2 is in
// pieces between the cuts (an exit-only lane: the off-ramp takes it, the on-ramp gives it back; round the south-east
// corner the westbound's ends and the spur's merge gives it back). A spur's outbound lanes end at its far end, on
// the ground (`end: 'valley'`), its inbound ones start there.
let LANES = null;
export function highwayLanes() {
  if (LANES) return LANES;
  const P = plan(), loop = P.loop, out = [];
  const sample = (road, off, s0, s1, step = 8) => {
    const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step)), pts = [], o = {};
    for (let i = 0; i <= n; i++) { const s = lerp(s0, s1, i / n); road.path.side(s, off, o); pts.push({ x: +o.x.toFixed(2), y: +road.y(s).toFixed(2), z: +o.z.toFixed(2) }); }
    return pts;
  };
  const L = loop.len, loopRoad = P.roads[0];
  const along = (pts, x, z) => nearest(pts, x, z).s;
  out.push({ id: 'loop:in:1', road: 'loop', kind: 'main', closed: true, pts: sample(loopRoad, LANE_IN, 0, L, 10).slice(0, -1), next: [], from: [], speed: SPEED.main });
  out.push({ id: 'loop:out:1', road: 'loop', kind: 'main', closed: true, pts: sample(loopRoad, -LANE_IN, L, 0, 10).slice(0, -1), next: [], from: [], speed: SPEED.main });
  // the outer lanes, between the cuts on each side (a cut is [a, b, take, give]: on the inner side, travelling with
  // s, its take at a and its give at b; on the outer side, against s, its take at b and its give at a)
  for (const [side, cuts] of [[1, loopRoad.cutR], [-1, loopRoad.cutL]]) {
    const cs = cuts.map(([a, b, take, give]) => ({ a: ((a % L) + L) % L, b: ((b % L) + L) % L, take, give })).sort((p, q) => p.a - q.a);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], d = cs[(i + 1) % cs.length];
      let s0 = c.b, s1 = d.a; if (s1 <= s0) s1 += L;
      if (side > 0) out.push({ id: `loop:in:2:${i}`, road: 'loop', kind: 'main', pts: sample(loopRoad, LANE_OUT, s0, s1, 10), next: d.take ? [d.take] : [], from: c.give ? [c.give] : [], speed: SPEED.main, lo: s0, hi: s1 });
      else out.push({ id: `loop:out:2:${i}`, road: 'loop', kind: 'main', pts: sample(loopRoad, -LANE_OUT, s1, s0, 10), next: c.take ? [c.take] : [], from: d.give ? [d.give] : [], speed: SPEED.main, lo: s0, hi: s1 });
    }
  }
  const lane = (lid) => out.find((l) => l.id === lid);
  const onLoop = (side, s) => out.find((l) => l.lo !== undefined && (side > 0 ? /:in:/ : /:out:/).test(l.id) && ((s >= l.lo && s <= l.hi) || (s + L >= l.lo && s + L <= l.hi)));
  for (const r of P.roads) {
    if (r.kind === 'ramp') {
      const on = !r.off, pts = sample(r, -0.05, 0, r.path.len, 6);
      const e = on ? pts[0] : pts.at(-1), e2 = on ? pts[1] : pts.at(-2);
      // (its heading where it meets the street: into the ramp for an entrance, out of it for an exit)
      const heading = on ? Math.atan2(e2.x - e.x, e2.z - e.z) : Math.atan2(e.x - e2.x, e.z - e2.z);
      out.push({ id: r.id, road: 'loop', kind: 'ramp', pts, next: [], from: [], speed: SPEED.ramp, street: { x: e.x, z: e.z, heading, crossing: r.diamond.id, entrance: on } });
    } else if (r.kind === 'conn') {
      // (alongside the deck the lane comes out of lane 2 over the taper, or goes back into it: not from the
      // taper's nose, where the strip's as yet a hand's width)
      const j = r.junction, n = Math.ceil(r.path.len / 8), pts = [], q = {}, out2 = -(HALF + CONN_W - LANE_OUT);
      for (let i = 0; i <= n; i++) {
        const s = (r.path.len * i) / n;
        let off = 0;
        if (r.attach.mode === 'outside') off = r.attach.at === 'start' ? lerp(out2, 0, ss(0, 75, s)) : lerp(0, out2, ss(r.path.len - 75, r.path.len, s));
        r.path.side(s, off, q);
        pts.push({ x: +q.x.toFixed(2), y: +r.y(s).toFixed(2), z: +q.z.toFixed(2) });
      }
      out.push({ id: r.id, road: j.id, kind: 'connector', pts, next: r.out ? [`${j.id}:spur:out:1`, `${j.id}:spur:out:2`] : [], from: r.out ? [] : [`${j.id}:spur:in:1`, `${j.id}:spur:in:2`], speed: SPEED.connector });
    } else if (r.spur) {
      for (const k of [1, 2]) {
        const o = k === 1 ? LANE_IN : LANE_OUT;
        out.push({ id: `${r.spur.id}:spur:out:${k}`, road: r.id, kind: 'main', pts: sample(r, o, r.s0, r.s1, 10), next: [], from: [], speed: SPEED.main, end: 'valley' });
        out.push({ id: `${r.spur.id}:spur:in:${k}`, road: r.id, kind: 'main', pts: sample(r, -o, r.s1, r.s0, 10), next: [`${r.spur.id}:merge`], from: [], speed: SPEED.main, start: 'valley' });
      }
    }
  }
  // the north-east junction's connectors leave and join lane 2 in its middle (alongside the deck)
  for (const j of P.J) {
    if (j.id !== 'ne') continue;
    const fly = lane(`${j.id}:fly`), merge = lane(`${j.id}:merge`), a = onLoop(1, j.divert), b = onLoop(-1, j.merge);
    if (a) { (a.branches ??= []).push({ s: +along(a.pts, fly.pts[0].x, fly.pts[0].z).toFixed(1), id: fly.id }); fly.from.push(a.id); }
    if (b) { (b.joins ??= []).push({ s: +along(b.pts, merge.pts.at(-1).x, merge.pts.at(-1).z).toFixed(1), id: merge.id }); merge.next.push(b.id); }
  }
  // the links both ways round
  for (const l of out) for (const n of l.next) { const m = lane(n); if (m && !m.from.includes(l.id)) m.from.push(l.id); }
  for (const l of out) for (const f of l.from) { const m = lane(f); if (m && !m.next.includes(l.id)) m.next.push(l.id); }
  for (const l of out) { delete l.lo; delete l.hi; }
  LANES = out;
  return out;
}
// How much room there is under the highway at (x, z): the height of the underside of whatever of it is over that
// spot (a deck's girder, a ramp's slab; 0 where a ramp or a spur's end is down on its fill), Infinity where none of it
// is, `pad` metres round its edges counted in. For whatever stands in the streets under it: a street lamp, a
// signal's mast, a tree, a sign or a walker is only placed where it's lower than this (the diamonds' ramps come down
// over the pavements of the streets the loop runs along: a lamp at a corner came up through one and stopped a car).
// `underRamp(x, z, pad, h)` is the short question: is anything of it lower than `h` metres (7: a street lamp's
// height) over (x, z)?
let CLEAR = null;
function clearIndex() {
  if (CLEAR) return CLEAR;
  const cells = new Map(), o = {};
  for (const r of plan().roads) {
    for (let s = r.s0; s <= r.s1; s += 3) {
      r.path.at(s, o);
      const k = `${Math.floor(o.x / 40)},${Math.floor(o.z / 40)}`;
      (cells.get(k) ?? cells.set(k, []).get(k)).push({ r, s, x: o.x, z: o.z, tx: o.tx, tz: o.tz });
    }
  }
  return (CLEAR = cells);
}
// (`except`: a road's id to leave out: what's on that road asking what's over it)
export function clearanceAt(x, z, pad = 0.5, except = null) {
  const cells = clearIndex(), gx = Math.floor(x / 40), gz = Math.floor(z / 40);
  let best = Infinity;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const e of cells.get(`${gx + i},${gz + j}`) ?? []) {
      if (e.r.id === except) continue;
      const dx = x - e.x, dz = z - e.z, along = dx * e.tx + dz * e.tz;
      if (Math.abs(along) > 1.6) continue; // (the sample beside the spot: within its own 3 m)
      const d = dx * -e.tz + dz * e.tx, r = e.r, y = r.y(e.s + along);
      let under;
      if (r.kind === 'dual') {
        const LL = r.closed ? plan().loop.len : 0, edge = d > 0 ? (within(e.s, r.cutR, LL) ? CUT : HALF) : (within(e.s, r.cutL, LL) ? CUT : HALF);
        if (Math.abs(d) > edge + pad) continue;
        under = y < 3 ? 0 : y - (Math.abs(d) < 4.6 ? GIRDER : 1.0);
      } else {
        const w = r.kind === 'ramp' ? RAMP_W : r.widen ? CONN_W2 : CONN_W;
        if (Math.abs(d) > w + pad) continue;
        under = y < 3 ? 0 : y - 1.15;
      }
      best = Math.min(best, under);
    }
  }
  return best;
}
export const underRamp = (x, z, pad = 0.5, h = 7) => clearanceAt(x, z, pad) < h;
// the road's surface on the highway at (x, z) (the highest deck there, a flyover over the loop), null off it: where
// Hal can land over water (a spur's arch over the river), with the bridge's city/Bridge.js `onBridge`. Lot frame.
export function highwayDeckAt(x, z) {
  const cells = clearIndex(), gx = Math.floor(x / 40), gz = Math.floor(z / 40);
  let top = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const e of cells.get(`${gx + i},${gz + j}`) ?? []) {
      const dx = x - e.x, dz = z - e.z, along = dx * e.tx + dz * e.tz;
      if (Math.abs(along) > 1.6) continue;
      const d = dx * -e.tz + dz * e.tx, r = e.r;
      const w = r.kind === 'dual' ? HALF : r.kind === 'ramp' ? RAMP_W : r.widen ? CONN_W2 : CONN_W;
      if (Math.abs(d) > w) continue;
      const y = r.y(e.s + along);
      if (top === null || y > top) top = y;
    }
  }
  return top;
}

// ------------------------------------------------------------------------------------------------ meshes
// Geometry gathered by material: positions, normals, uvs (metres), colours; indexed.
export class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.extra = null; }
  get count() { return this.p.length / 3; }
  v(x, y, z, nx, ny, nz, u, w, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.c.push(col.r, col.g, col.b);
    if (this.extra) for (const [k, v] of Object.entries(this.extra)) (this[k] ??= []).push(v);
    return this.p.length / 3 - 1;
  }
  t(a, b, c) { this.i.push(a, b, c); }
  q(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry(extraNames = []) {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    for (const k of extraNames) g.setAttribute(k, new THREE.Float32BufferAttribute(this[k], 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
// collision triangles (world space is the caller's: these are in the lot's frame)
export class Col {
  constructor() { this.p = []; this.i = []; }
  v(x, y, z) { this.p.push(x, y, z); return this.p.length / 3 - 1; }
  q(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  t(a, b, c) { this.i.push(a, b, c); }
}
const _c = new THREE.Color();
const C = (hex) => new THREE.Color(hex);

// A section swept along stations: `st` [{ x, y, z, tx, tz, rx, rz, s, ... }], `sec(st)` the section's points [[o, y]]
// clockwise (o to the right, y up: the top left to right) so each face's normal comes out, the same number at each.
// Each edge of the section is its own strip (hard edges between them, smooth along the road).
export function sweep(acc, st, sec, color, { col = null, cap0 = false, cap1 = false, vScale = 1 } = {}) {
  if (st.length < 2) return;
  const S = st.map(sec), m = S[0].length, cc = color.isColor ? color : _c.set(color);
  const W = st.map((t, i) => S[i].map(([o, y]) => [t.x + t.rx * o, t.y + y, t.z + t.rz * o]));
  // each station's tangent with its slope
  const T = st.map((t, i) => {
    const a = st[Math.max(0, i - 1)], b = st[Math.min(st.length - 1, i + 1)], ds = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return [t.tx, (b.y - a.y) / ds, t.tz];
  });
  let v0 = 0;
  for (let k = 0; k + 1 < m; k++) {
    const base = acc.count;
    let u = 0;
    for (let i = 0; i < st.length; i++) {
      if (i) u += Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y, st[i].z - st[i - 1].z);
      const a = W[i][k], b = W[i][k + 1], E = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = T[i];
      // N = E x T
      let nx = E[1] * t[2] - E[2] * t[1], ny = E[2] * t[0] - E[0] * t[2], nz = E[0] * t[1] - E[1] * t[0];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      const len = Math.hypot(...E);
      acc.v(a[0], a[1], a[2], nx, ny, nz, u, v0 * vScale, cc);
      acc.v(b[0], b[1], b[2], nx, ny, nz, u, (v0 + len) * vScale, cc);
    }
    v0 += Math.hypot(S[0][k + 1][0] - S[0][k][0], S[0][k + 1][1] - S[0][k][1]);
    for (let i = 0; i + 1 < st.length; i++) acc.q(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
  }
  // the ends closed (a parapet's nose, a ramp's foot)
  const cap = (i, flip) => {
    const t = st[i], pts = W[i], n = flip ? [-t.tx, 0, -t.tz] : [t.tx, 0, t.tz], base = acc.count;
    for (const [x, y, z] of pts) acc.v(x, y, z, n[0], n[1], n[2], (x - t.x) * t.rx + (z - t.z) * t.rz, y, cc);
    for (let k = 1; k + 1 < m; k++) flip ? acc.t(base, base + k + 1, base + k) : acc.t(base, base + k, base + k + 1);
  };
  if (cap0) cap(0, true);
  if (cap1) cap(st.length - 1, false);
  if (col) {
    // the same, for the collider: a ring per station (closed when the section is)
    const base = col.p.length / 3;
    for (const ring of W) for (const [x, y, z] of ring) col.v(x, y, z);
    for (let i = 0; i + 1 < st.length; i++) for (let k = 0; k + 1 < m; k++) col.q(base + i * m + k, base + (i + 1) * m + k, base + (i + 1) * m + k + 1, base + i * m + k + 1);
  }
}

// a box turned about y (`yaw` from +z, as three.js has a heading), its middle at (x, y, z), half sizes (hx across,
// hy, hz along); with `taper` its top's half sizes scaled (a cap wider at the top)
export function boxAt(acc, x, y, z, hx, hy, hz, yaw, color, { col = null, bottom = true, top = 1, topScaleX = 1 } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cc = color.isColor ? color : _c.set(color);
  const P = (u, v, w) => { const sx = v > 0 ? topScaleX : 1; return [x + (u * hx * sx) * c + (w * hz) * s, y + v * hy, z - (u * hx * sx) * s + (w * hz) * c]; };
  const faces = [[[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]], [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]]];
  faces.forEach((f, fi) => {
    if (fi === 3 && !bottom) return;
    if (fi === 2 && !top) return;
    const q = f.map((a) => P(...a));
    // (the corners as listed go round each face inward: wound the other way, and the normal turned out)
    const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const L = -(Math.hypot(nx, ny, nz) || 1); nx /= L; ny /= L; nz /= L;
    const base = acc.count;
    q.forEach(([px, py, pz], k) => acc.v(px, py, pz, nx, ny, nz, (k === 1 || k === 2 ? 1 : 0) * (fi < 2 ? hz : hx) * 2, (k >= 2 ? 1 : 0) * hy * 2, cc));
    acc.q(base, base + 3, base + 2, base + 1);
  });
  if (col) {
    const b = col.p.length / 3;
    for (const v of [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]) col.v(...P(...v));
    for (const [a, bb, cc2, d] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) col.q(b + a, b + bb, b + cc2, b + d);
  }
}
// an upright prism of a rounded rectangle (a column): half sizes across (hx) and along (hz) its heading
// (`vScale`: the texture's metres up it per unit of y, for a unit column an instance stretches to its height)
export function column(acc, x, z, y0, y1, hx, hz, yaw, color, { col = null, sides = 16, round = 0.35, vScale = 1 } = {}) {
  const c = Math.cos(yaw), s = Math.sin(yaw), cc = color.isColor ? color : _c.set(color), ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    // a superellipse: squarer with `round` lower
    const e = 2 / (round * 4 + 0.0001), u = Math.sign(ca) * Math.abs(ca) ** (2 / Math.max(2, e)) * hx, w = Math.sign(sa) * Math.abs(sa) ** (2 / Math.max(2, e)) * hz;
    ring.push([x + u * c + w * s, z - u * s + w * c, ca / hx, sa / hz]);
  }
  const base = acc.count;
  let u = 0;
  for (let i = 0; i <= sides; i++) {
    const r = ring[i % sides], pr = ring[(i + sides - 1) % sides];
    if (i) u += Math.hypot(r[0] - pr[0], r[1] - pr[1]);
    let nx = r[2] * c + r[3] * s, nz = -r[2] * s + r[3] * c; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    acc.v(r[0], y0, r[1], nx, 0, nz, u, y0 * vScale, cc); acc.v(r[0], y1, r[1], nx, 0, nz, u, y1 * vScale, cc);
  }
  for (let i = 0; i < sides; i++) acc.q(base + i * 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
  if (col) colBox(col, x, (y0 + y1) / 2, z, hx, (y1 - y0) / 2, hz, yaw);
}
export function colBox(col, x, y, z, hx, hy, hz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), b = col.p.length / 3;
  for (const [u, v, w] of [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]) col.v(x + u * hx * c + w * hz * s, y + v * hy, z - u * hx * s + w * hz * c);
  for (const [a, bb, cc, d] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) col.q(b + a, b + bb, b + cc, b + d);
}

// ------------------------------------------------------------------------------------------------ the signs
// What the gantries say, before each exit and at it, each carriageway's facing its traffic: { id, road, s, side (+1
// the inner carriageway, travelling with s; -1 the outer), lines, sub, exit, arrow }. City/Landmarks.js draws each
// into one canvas and hands back where (`rects`).
let SIGNS = null;
export function highwaySigns() {
  if (SIGNS) return SIGNS;
  const P = plan(), out = [];
  for (const D of P.DIAMONDS) {
    for (const side of [1, -1]) {
      const names = side > 0 ? D.names.in : D.names.out, s0 = D.s - side * RAMP_U;
      out.push({ id: `${D.id}:${side}:adv`, road: 'loop', s: s0 - side * 420, side, lines: names, sub: '1/4 MILE', exit: D.exit, arrow: null });
      out.push({ id: `${D.id}:${side}:exit`, road: 'loop', s: s0 - side * 30, side, lines: names, sub: 'EXIT ONLY', exit: D.exit, arrow: 'down' });
    }
  }
  for (const j of P.J) {
    out.push({ id: `${j.id}:adv`, road: 'loop', s: j.divert - 400, side: 1, lines: [j.name, 'Desert Highway'], sub: '1/4 MILE', exit: j.id === 'ne' ? 6 : 4, arrow: null });
    out.push({ id: `${j.id}:exit`, road: 'loop', s: j.divert - 40, side: 1, lines: [j.name, 'Desert Highway'], sub: 'EAST', exit: j.id === 'ne' ? 6 : 4, arrow: 'right' });
  }
  // the route itself, and where it's going, on the long legs
  const route = [
    [onEast(560), 1, ['Coast Heights', 'Port Haven'], 'NORTH'], [onEast(560), -1, ['Bayside', 'Bay Bridge'], 'SOUTH'],
    [onNorth(560), 1, ['Ocean Avenue', 'Coast City Beach'], 'WEST'], [onNorth(560), -1, ['The Hills', 'North Valley'], 'EAST'],
    [onWest(320), 1, ['Old Town', 'The Marina'], 'SOUTH'], [onWest(320), -1, ['Downtown', 'Midtown'], 'NORTH'],
    [onSouth(-400), 1, ['Suburbia', 'Eastside Industrial'], 'EAST'], [onSouth(-400), -1, ['Old Town', 'Ocean Avenue'], 'WEST'],
  ];
  route.forEach(([s, side, lines, sub], i) => out.push({ id: `route:${i}`, road: 'loop', s, side, lines, sub, exit: null, arrow: null, route: true }));
  SIGNS = out;
  return out;
}

// ------------------------------------------------------------------------------------------------ building it
// Stations along a road: every 24 m where it's straight and level, 12 or 6 on curves, 4 on a ramp or a connector;
// one either side of every place its shape changes (a cut, a gap, the fill), so the change is a step, not a slope.
function stations(r, breaks = []) {
  const out = [], o = {};
  const isDual = r.kind === 'dual';
  const bs = breaks.filter((b) => b > r.s0 + 0.05 && b < r.s1 - 0.05).sort((a, b) => a - b);
  let bi = 0, s = r.s0;
  const push = (s) => { r.path.at(s, o); out.push({ s, x: o.x, z: o.z, y: r.y(s), tx: o.tx, tz: o.tz, rx: o.rx, rz: o.rz }); };
  while (s < r.s1 - 0.01) {
    push(s);
    let step = 4;
    if (isDual) {
      const a = r.path.at(s), b = r.path.at(Math.min(r.path.closed ? s + 12 : r.s1, s + 12)), turn = Math.abs(a.tx * b.tz - a.tz * b.tx);
      const dy = Math.abs(r.y(s + 12) - r.y(s));
      step = turn > 0.004 ? 6 : turn > 0.0012 || dy > 0.05 ? 12 : 24;
    }
    let next = Math.min(r.s1, s + step);
    while (bi < bs.length && bs[bi] <= s + 0.03) bi++;
    if (bi < bs.length && bs[bi] - 0.02 < next) { push(bs[bi] - 0.02); next = bs[bi] + 0.02; bi++; }
    s = next;
  }
  push(r.s1);
  return out;
}
const within = (s, list, L) => list.some(([a, b]) => (s >= a && s <= b) || (L && s + L >= a && s + L <= b) || (L && s - L >= a && s - L <= b));
// runs of stations where `f(st)` gives the same key: [[key, [stations]]]. Every place a key changes has a station
// 2 cm either side of it (stations()), so a run ends at one and the next begins at the other: sharing the station
// between them swept a full-width parapet from the cut's edge across the lane in those 4 cm (a wall across the merge)
// (`share`: for the far copy, whose stations are thinned out past the breaks, so runs meet at a shared one)
function runs(st, f, share = false) {
  const out = [];
  for (const t of st) {
    const k = f(t);
    if (!out.length || out.at(-1)[0] !== k) out.push([k, share && out.length ? [out.at(-1)[1].at(-1), t] : [t]]);
    else out.at(-1)[1].push(t);
  }
  return out;
}

// what's under a pier's foot: a street's road (except, for a pier in the median, the road's own street along it),
// a crossing of two streets, water
let STREETS = null;
function inRoad(x, z, tx = 0, tz = 0, median = false) {
  STREETS ??= streetSegments();
  for (const g of STREETS) {
    if (g.ns) {
      if (Math.abs(x - g.x) < NS.kerb + 1 && z > g.z0 - EW.kerb - 1 && z < g.z1 + EW.kerb + 1) {
        if (median && Math.abs(tz) > 0.95 && Math.abs(x - g.x) < 1.5) continue;
        return true;
      }
    } else if (Math.abs(z - g.z) < EW.kerb + 1 && x > g.x0 - NS.kerb - 1 && x < g.x1 + NS.kerb + 1) {
      if (median && Math.abs(tx) > 0.95 && Math.abs(z - g.z) < 1.5) continue;
      return true;
    }
  }
  return false;
}
function crossing(x, z) {
  STREETS ??= streetSegments();
  let ns = false, ew = false;
  for (const g of STREETS) {
    if (g.ns && Math.abs(x - g.x) < NS.kerb + 3.5 && z > g.z0 - EW.kerb - 3 && z < g.z1 + EW.kerb + 3) ns = true;
    if (g.ew && Math.abs(z - g.z) < EW.kerb + 3.5 && x > g.x0 - NS.kerb - 3 && x < g.x1 + NS.kerb + 3) ew = true;
  }
  return ns && ew;
}
const wet = (x, z, r = 3) => !!(waterAt(x, z) || waterAt(x + r, z) || waterAt(x - r, z) || waterAt(x, z + r) || waterAt(x, z - r));
// where supports go along a road: about every `every` metres, where `ok(s)`; never closer than `min`
function supports(r, ok, { every = 32, min = 20, from = r.s0 + 8, to = r.s1 - 8 } = {}) {
  const out = [];
  let last = from - every;
  for (let s = from; s <= to; s += 2) {
    if (s - last < min || !ok(s)) continue;
    // at the target spacing, or short of it where the next stretch is barred (a street ahead)
    let clear = true; for (let t = s + 2; t <= s + (every - (s - last)) + 2 && t <= to; t += 2) if (!ok(t)) { clear = false; break; }
    if (s - last >= every || !clear) { out.push(s); last = s; }
  }
  return out;
}

const COL = {
  soffit: C(0xc4c7c9), parapet: C(0xdcdddb), median: C(0xd6d7d5), pier: C(0xcbcdce), cap: C(0xc1c3c4),
  white: C(0xf0eee6), yellow: C(0xe0b63a), asphalt: C(0xffffff), steel: C(0x6f8a8c), mast: C(0x8a8f94), cushion: C(0xe8c23a), far: C(0xc9c3b7), farRoad: C(0x5a5752),
};
const _v3 = new THREE.Vector3();

export function* buildHighway(ctx) {
  const P = plan(), loop = P.loop, L = loop.len, roads = P.roads;
  const group = new THREE.Group();
  group.name = 'highway';
  const chunks = [], far = new Acc();
  far.extra = { aChunk: 0 };
  const inst = {}; // instanced pieces, gathered as matrices
  // (each with the chunk it stands in: drawn while that's near, its piers part of the far copy beyond)
  const put = (kind, x, y, z, yaw, sx = 1, sy = 1, sz = 1) => (inst[kind] ??= []).push({ M: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sx, sy, sz)), chunk: chunkAt(null, x, z)?.id ?? 0, x, y, z, yaw, sy });
  const yawOf = (t) => Math.atan2(t.tx, t.tz);
  // (a chunk is a stretch of the loop or a spur and whatever runs beside it: a diamond's ramps, a connector's part
  // alongside, are drawn with the stretch they're beside, not as chunks of their own: four ramps' own chunks put two
  // dozen draws on the street at the field's diamond. Its `shadow`: plain boxes of its piers, masts and posts on
  // layer 1, which only the shadow cameras see, so they cast where the chunk's near and nowhere else.)
  const newChunk = (road) => {
    const c = { id: chunks.length, road: road.id, acc: { concrete: new Acc(), asphalt: new Acc(), paint: new Acc(), metal: new Acc(), pool: new Acc(), sign: new Acc(), shadow: new Acc() }, col: new Col(), box: new THREE.Box3() };
    chunks.push(c);
    far.extra.aChunk = c.id;
    return c;
  };
  const chunkFor = (r, cs) => {
    if (r.kind !== 'dual') {
      const m = cs[cs.length >> 1];
      let best = null, bd = 6;
      for (const c of chunks) { const d = c.box.distanceToPoint(_v3.set(m.x, m.y, m.z)); if (d < bd) { bd = d; best = c; } }
      if (best) { far.extra.aChunk = best.id; return best; }
    }
    return newChunk(r);
  };
  const chunkAt = (road, x, z) => {
    let best = null, bd = Infinity;
    for (const c of chunks) { const d = c.box.distanceToPoint(_v3.set(x, (c.box.min.y + c.box.max.y) / 2, z)); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  // an instanced piece's box: in the chunk's collider, and its shadow-only stand-in
  const solid = (c, x, y, z, hx, hy, hz, yaw) => { colBox(c.col, x, y, z, hx, hy, hz, yaw); boxAt(c.acc.shadow, x, y, z, hx, hy, hz, yaw, COL.pier, { bottom: false }); };
  const roadSt = new Map();

  for (const r of roads) {
    const isDual = r.kind === 'dual';
    // ---- where its shape changes
    const breaks = [];
    if (isDual) for (const list of [r.cutR, r.cutL, r.gapR, r.gapL]) for (const [a, b] of list) breaks.push(a, b, a + L, b + L, a - L, b - L);
    const lowAt = (s) => r.y(s) < 3;
    for (let s = r.s0; s < r.s1 - 1; s += 1) if (lowAt(s) !== lowAt(s + 1)) breaks.push(s + 0.5);
    if (r.flush) breaks.push(...r.flush);
    if (r.widen) breaks.push(...r.widen);
    if (r.kind === 'ramp') breaks.push(Math.abs(Math.abs(r.u0) - (r.diamond.front + 1.5)));
    const st = stations(r, breaks);
    roadSt.set(r, st);
    for (const t of st) {
      t.fill = t.y < 3;
      if (isDual) {
        const LL = r.closed ? L : 0;
        t.cutR = within(t.s, r.cutR, LL); t.cutL = within(t.s, r.cutL, LL); t.gapR = within(t.s, r.gapR, LL); t.gapL = within(t.s, r.gapL, LL);
        t.r = t.cutR ? CUT : HALF; t.l = -(t.cutL ? CUT : HALF);
      } else {
        // its width: one lane, two near the spur; tapered in where it starts or ends alongside the deck
        let w = r.kind === 'ramp' ? RAMP_W : CONN_W;
        if (r.widen) { const [a, b] = r.widen, k = a < b ? ss(a, b, t.s) : 1 - ss(b, a, t.s); w = lerp(CONN_W, CONN_W2, k); }
        let wr = w;
        if (r.attach?.mode === 'outside') { const k = r.attach.at === 'start' ? ss(0, 55, t.s) : 1 - ss(r.path.len - 55, r.path.len, t.s); wr = -w + 2 * w * Math.max(0.03, k); }
        t.l = -w; t.r = wr;
        t.flush = r.flush ? t.s >= r.flush[0] - 0.05 && t.s <= r.flush[1] + 0.05 : false;
        t.foot = r.kind === 'ramp' ? Math.abs(r.u0 + r.dirSign * t.s) < r.diamond.front + 1.5 - 0.01 : false;
      }
    }
    // ---- in chunks of about 320 m
    const parts = [];
    { let a = 0; for (let i = 1; i < st.length; i++) if (st[i].s - st[a].s > 320 || i === st.length - 1) { parts.push(st.slice(a, i + 1)); a = i; } }
    for (const cs of parts) {
      const c = chunkFor(r, cs), A = c.acc, pb = new THREE.Box3();
      for (const t of cs) pb.expandByPoint(_v3.set(t.x, t.y + 12, t.z)).expandByPoint(_v3.set(t.x, 0, t.z));
      c.box.union(pb.expandByScalar(12));
      const girder = isDual
        ? (t) => { const wR = 4.6 + (t.r - 4.6) * 0.35, wL = -4.6 + (t.l + 4.6) * 0.35; return [[t.r, 0], [t.r, -0.6], [wR, -1.0], [4.6, -GIRDER], [-4.6, -GIRDER], [wL, -1.0], [t.l, -0.6], [t.l, 0]]; }
        : (t) => [[t.r, 0], [t.r, -0.5], [t.r - 0.6, -1.15], [t.l + 0.6, -1.15], [t.l, -0.5], [t.l, 0]];
      // the girder, or where it's down near the ground walls to the ground (a fill)
      for (const [fill, run] of runs(cs, (t) => t.fill)) {
        if (run.length < 2) continue;
        if (!fill) sweep(A.concrete, run, girder, COL.soffit, { col: c.col });
        else { sweep(A.concrete, run, (t) => [[t.r, 0], [t.r, -t.y]], COL.soffit, { col: c.col }); sweep(A.concrete, run, (t) => [[t.l, -t.y], [t.l, 0]], COL.soffit, { col: c.col }); }
      }
      const line = (run, f, w, col) => sweep(A.paint, run, (t) => { const o = f(t); return [[o - w / 2, 0.012], [o + w / 2, 0.012]]; }, col);
      if (isDual) {
        // the road between the parapets (out to the edge where a connector's alongside)
        const pin = (t, side) => (side > 0 ? (t.gapR ? 0 : t.cutR ? 0.4 : 0.5) : (t.gapL ? 0 : t.cutL ? 0.4 : 0.5));
        sweep(A.asphalt, cs, (t) => [[t.l + pin(t, -1), 0], [t.r - pin(t, 1), 0]], COL.asphalt, { col: c.col });
        // the parapets, in runs: open where a connector's alongside, thinner along a cut, their ends closed
        for (const side of [1, -1]) {
          const rr = runs(cs, (t) => (side > 0 ? (t.gapR ? 'gap' : t.cutR ? 'cut' : 'full') : (t.gapL ? 'gap' : t.cutL ? 'cut' : 'full')));
          rr.forEach(([key, run], i) => {
            if (key === 'gap' || run.length < 2) return;
            const p = key === 'cut' ? 0.4 : 0.5, cap0 = key === 'cut' || rr[i - 1]?.[0] === 'gap', cap1 = key === 'cut' || rr[i + 1]?.[0] === 'gap';
            const sec = side > 0 ? (t) => [[t.r - p, 0], [t.r - p + 0.08, 0.25], [t.r - 0.25, 1.05], [t.r, 1.05], [t.r, 0]] : (t) => [[t.l, 0], [t.l, 1.05], [t.l + 0.25, 1.05], [t.l + p - 0.08, 0.25], [t.l + p, 0]];
            sweep(A.concrete, run, sec, COL.parapet, { col: c.col, cap0, cap1 });
          });
        }
        sweep(A.concrete, cs, () => [[-MED, 0], [-0.12, 0.3], [-0.09, 0.85], [0.09, 0.85], [0.12, 0.3], [MED, 0]], COL.median, { col: c.col });
        // the lines: yellow by the median, white at the edges (dashed past a connector's lane), dashed between the lanes
        for (const side of [1, -1]) {
          line(cs, () => side * 1.0, 0.13, COL.yellow);
          for (const [key, run] of runs(cs, (t) => ((side > 0 ? t.cutR : t.cutL) ? 'cut' : (side > 0 ? t.gapR : t.gapL) ? 'gap' : 'full'))) {
            if (run.length < 2) continue;
            if (key === 'gap') dashes(A.paint, r, run[0].s, run.at(-1).s, side * 8.3, () => true, 0.25, 6);
            else line(run, () => side * (key === 'cut' ? CUT - 0.55 : 8.2), 0.15, COL.white);
          }
          dashes(A.paint, r, cs[0].s, cs.at(-1).s, side * 4.6, (s) => !within(s, side > 0 ? r.cutR : r.cutL, r.closed ? L : 0));
        }
        farDual(far, cs.filter((t, i) => i % 3 === 0 || i === cs.length - 1));
      } else {
        // a ramp's or a connector's road, its parapets (none on its inner side while it's alongside the deck, none
        // where it crosses the pavement at a diamond's corner), its edge lines and, where it's two lanes, its middle
        const innerOn = (t) => !t.flush && !t.foot, outerOn = (t) => !t.foot;
        sweep(A.asphalt, cs, (t) => [[t.l + (innerOn(t) ? 0.4 : 0), 0], [t.r - (outerOn(t) ? 0.5 : 0), 0]], COL.asphalt, { col: c.col });
        for (const [on, run] of runs(cs, innerOn)) if (on && run.length > 1) sweep(A.concrete, run, (t) => [[t.l, 0], [t.l, 1.05], [t.l + 0.2, 1.05], [t.l + 0.32, 0.25], [t.l + 0.4, 0]], COL.parapet, { col: c.col, cap0: true, cap1: true });
        for (const [on, run] of runs(cs, outerOn)) if (on && run.length > 1) sweep(A.concrete, run, (t) => [[t.r - 0.5, 0], [t.r - 0.42, 0.25], [t.r - 0.25, 1.05], [t.r, 1.05], [t.r, 0]], COL.parapet, { col: c.col, cap0: true, cap1: true });
        for (const [on, run] of runs(cs, (t) => !t.foot)) {
          if (!on || run.length < 2) continue;
          line(run, (t) => t.l + (t.flush ? 0.2 : 0.62), 0.13, COL.yellow);
          line(run, (t) => t.r - 0.62, 0.15, COL.white);
        }
        if (r.widen) dashes(A.paint, r, cs[0].s, cs.at(-1).s, 0, (s) => { const [a, b] = r.widen; return a < b ? s > (a + b) / 2 : s < (a + b) / 2; });
        farSingle(far, cs.filter((t, i) => i % 3 === 0 || i === cs.length - 1));
      }
      // a spur's road on along the ground past its end, into the valley
      if (r.ground && cs.at(-1) === st.at(-1)) {
        const e = st.at(-1), run = [0, 300, 600, 900].map((d) => ({ ...e, s: e.s + d, x: e.x + e.tx * d, z: e.z + e.tz * d, y: 0.02 }));
        sweep(A.asphalt, run, () => [[-HALF, 0], [HALF, 0]], COL.asphalt);
        for (const side of [1, -1]) { line(run, () => side * 1.0, 0.13, COL.yellow); line(run, () => side * 8.2, 0.15, COL.white); }
        c.box.expandByPoint(_v3.set(run.at(-1).x, 0, run.at(-1).z));
      }
      yield;
    }
  }

  // ---- the piers, the lamps, the gantries
  const roadOf = (id) => roads.find((r) => r.id === id);
  const o = {};
  for (const r of roads) {
    const st = roadSt.get(r);
    if (r.kind === 'dual') {
      const river = [];
      if (r.spur) {
        let a = null, b = null;
        for (let s = r.s0; s < r.s1; s += 1) { r.path.at(s, o); if (waterAt(o.x, o.z) === 'river') { a ??= s; b = s; } }
        if (a !== null) { river.push([a - 12, b + 12]); arch(r, a - 12, b + 12); }
      }
      // (a pier where the girder's high enough over the ground, not in a street's road or a crossing, nor the water)
      const ok = (s) => {
        r.path.at(s, o);
        if (r.y(s) < 5 || within(s, river)) return false;
        if (wet(o.x, o.z, 6)) return false;
        return !inRoad(o.x, o.z, o.tx, o.tz, true) && !crossing(o.x, o.z);
      };
      for (const s of supports(r, ok, r.closed ? { from: 0, to: L - 8 } : {})) {
        r.path.at(s, o);
        const h = r.y(s) - GIRDER - 1.7, c = chunkAt(r.id, o.x, o.z);
        put('pierCol', o.x, 0, o.z, yawOf(o), 1, h, 1);
        put('pierCap', o.x, h, o.z, yawOf(o));
        solid(c, o.x, h / 2, o.z, 0.85, h / 2, 1.3, yawOf(o));
        solid(c, o.x, h + 0.85, o.z, 5.4, 0.85, 1.4, yawOf(o));
      }
      // lamps on the median every 50 m (none over the arch: lit by its own)
      for (let s = r.s0 + 20; s < r.s1 - 10; s += LAMP_EVERY) {
        if (within(s, river) || r.y(s) < 2) continue;
        r.path.at(s, o);
        const y = r.y(s) + 0.85, c = chunkAt(r.id, o.x, o.z);
        if (clearanceAt(o.x, o.z, 4.6, r.id) < y + 10.5) continue; // (a flyover over it: the mast came up through its road)
        put('mast2', o.x, y, o.z, yawOf(o));
        for (const side of [1, -1]) {
          const hx = o.x + o.rx * side * 4.4, hz = o.z + o.rz * side * 4.4;
          put('head', hx, y + 9.45, hz, yawOf(o));
          pool(c.acc.pool, hx, r.y(s) + 0.03, hz, 8);
        }
        solid(c, o.x, y + 4.8, o.z, 0.16, 4.8, 0.16, 0);
      }
    } else {
      // a ramp's or a connector's columns, where it's off the ground and not over a road or the water; over the
      // loop's deck, a straddle bent (a column either side of the deck, a beam across)
      const ok = (s) => {
        r.path.at(s, o);
        if (r.y(s) < 3.2 || wet(o.x, o.z, 3)) return false;
        const d = Math.abs(loop.project(o.x, o.z).d);
        if (r.kind === 'conn' && d < HALF + 2.5 && r.y(s) < DECK + 4) return false; // (alongside: carried by the deck's piers)
        if (r.kind === 'conn' && d < HALF + 2.5) return !inRoad(...straddle(o, 1)) && !inRoad(...straddle(o, -1));
        return !inRoad(o.x, o.z);
      };
      for (const s of supports(r, ok, { every: 26, min: 16 })) {
        r.path.at(s, o);
        const y = r.y(s), c = chunkAt(r.id, o.x, o.z), h = y - 1.15;
        if (r.kind === 'conn' && Math.abs(loop.project(o.x, o.z).d) < HALF + 2.5) {
          const q = loop.project(o.x, o.z), lp = loop.at(q.s);
          for (const side of [1, -1]) {
            const bx = lp.x + lp.rx * side * (HALF + 1.6), bz = lp.z + lp.rz * side * (HALF + 1.6);
            put('rampCol', bx, 0, bz, yawOf(lp), 1, h - 1.2, 1);
            solid(c, bx, (h - 1.2) / 2, bz, 0.62, (h - 1.2) / 2, 0.62, yawOf(lp));
          }
          boxAt(c.acc.concrete, lp.x + lp.rx * q.d, h - 0.6, lp.z + lp.rz * q.d, HALF + 2.4, 0.6, 1.0, yawOf(lp), COL.cap, { col: c.col });
          continue;
        }
        put('rampCol', o.x, 0, o.z, yawOf(o), 1, h - 0.9, 1);
        boxAt(c.acc.concrete, o.x, h - 0.45, o.z, Math.max(1.4, CONN_W - 0.3), 0.45, 0.8, yawOf(o), COL.cap, { col: c.col });
        solid(c, o.x, (h - 0.9) / 2, o.z, 0.62, (h - 0.9) / 2, 0.62, yawOf(o));
      }
      // its lamps on the outer parapet every 40 m, one arm over the lane
      for (let s = r.s0 + 14; s < r.s1 - 6; s += 40) {
        if (r.y(s) < 1) continue;
        r.path.at(s, o);
        const t = st.find((q) => q.s >= s) ?? st.at(-1);
        if (t.foot || t.r < 1) continue;
        const e = t.r - 0.25, y = r.y(s) + 1.05, x = o.x + o.rx * e, z = o.z + o.rz * e, c = chunkAt(r.id, o.x, o.z);
        if (clearanceAt(x, z, 3, r.id) < y + 9) continue;
        put('mast1', x, y, z, yawOf(o));
        const hx = o.x + o.rx * (e - 2.3), hz = o.z + o.rz * (e - 2.3);
        put('head', hx, y + 8.4, hz, yawOf(o));
        pool(c.acc.pool, hx, r.y(s) + 0.03, hz, 6.5);
        solid(c, x, y + 4.3, z, 0.12, 4.3, 0.12, 0);
      }
      // a crash cushion in front of the gore's nose where an exit leaves the deck inside its width
      if ((r.kind === 'ramp' && r.off) || (r.attach?.mode === 'inside' && r.attach.at === 'start')) {
        r.path.at(0, o);
        const w = r.kind === 'ramp' ? RAMP_W : CONN_W, x = o.x - o.rx * w - o.tx * 1.7, z = o.z - o.rz * w - o.tz * 1.7, c = chunkAt(r.id, o.x, o.z);
        boxAt(c.acc.metal, x, r.y(0) + 0.45, z, 0.4, 0.45, 1.7, yawOf(o), COL.cushion, { col: c.col });
      }
    }
  }
  yield;
  // the gantries over the carriageways, and their signs (facing the traffic, on the truss's near face)
  for (const g of highwaySigns()) {
    const r = roadOf(g.road);
    // (moved along until nothing's over it: a flyover, a ramp alongside)
    for (const ds of [0, -30, 30, -60, 60, -90]) { const q = r.path.side(g.s + ds, g.side * 4.8, {}); if (clearanceAt(q.x, q.z, 5, r.id) > r.y(g.s + ds) + 9.5) { g.s += ds; break; } }
    const p = r.path.at(g.s), y = r.y(g.s), c = chunkAt(r.id, p.x, p.z);
    put('gantry', p.x, y, p.z, yawOf(p) + (g.side > 0 ? 0 : Math.PI));
    for (const e of [0.55, 9.05]) solid(c, p.x + p.rx * g.side * e, y + 4.3, p.z + p.rz * g.side * e, 0.2, 4.3, 0.2, 0);
    boxAt(c.acc.shadow, p.x + p.rx * g.side * 4.8, y + 6.9, p.z + p.rz * g.side * 4.8, 4.4, 1.7, 0.5, yawOf(p), COL.pier);
    const rect = ctx.signRects?.get(g.id);
    if (rect) {
      const cx = p.x + p.rx * g.side * 4.8 - p.tx * g.side * 0.62, cz = p.z + p.rz * g.side * 4.8 - p.tz * g.side * 0.62;
      signFace(c.acc.sign, cx, y + 6.85, cz, yawOf(p) + (g.side > 0 ? Math.PI : 0), 7.8, 3.3, rect);
    }
  }
  yield;

  // ---- into meshes and colliders
  const M = ctx.mats;
  for (const c of chunks) {
    const g = new THREE.Group();
    g.name = `highway_${c.road}_${c.id}`;
    for (const [key, acc] of Object.entries(c.acc)) {
      const geo = acc.geometry();
      if (!geo) continue;
      const m = new THREE.Mesh(geo, M[key === 'shadow' ? 'concrete' : key]);
      m.name = `highway_${key}`;
      m.castShadow = key === 'concrete' || key === 'metal' || key === 'shadow';
      m.receiveShadow = key !== 'pool' && key !== 'sign' && key !== 'shadow';
      if (key === 'pool') m.renderOrder = 2;
      if (key === 'shadow') m.layers.set(1); // (seen by the shadow cameras only: Engine.js)
      g.add(m);
    }
    c.group = g;
    g.visible = false;
    group.add(g);
    c.body = ctx.trimesh?.(new Float32Array(c.col.p), new Uint32Array(c.col.i));
    c.tris = c.col.i.length / 3;
    c.col = null;
    c.acc = null;
    yield;
  }
  // (their shadows are the near chunks' stand-ins. The lamps' heads always drawn, all of them, lit at night from all
  // over the city; the rest only the near chunks' copies: always drawn, the piers, masts and gantries were seven of
  // the street's draws with the whole highway out of sight behind the houses. Far off, the piers' columns and caps
  // are plain boxes in the far copy)
  const pieces = instancedPieces(), sets = [], FAR_PIER = COL.pier.clone().multiplyScalar(0.62); // (as the concrete's shader darkens it)
  for (const [kind, list] of Object.entries(inst)) {
    const def = pieces[kind];
    const m = new THREE.InstancedMesh(def.geo, M[def.mat], list.length);
    list.forEach((e, i) => m.setMatrixAt(i, e.M));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    m.castShadow = false; m.receiveShadow = true;
    m.name = `highway_${kind}`;
    group.add(m);
    if (kind !== 'head') { m.count = 0; m.visible = false; sets.push({ m, list }); }
    for (const e of list) {
      far.extra.aChunk = e.chunk;
      if (kind === 'pierCol') boxAt(far, e.x, e.sy / 2, e.z, 0.85, e.sy / 2, 1.3, e.yaw, FAR_PIER, { bottom: false });
      else if (kind === 'pierCap') boxAt(far, e.x, e.y + 0.85, e.z, 1.6, 0.85, 0.85, e.yaw, FAR_PIER, { topScaleX: 3.4 });
      else if (kind === 'rampCol') boxAt(far, e.x, e.sy / 2, e.z, 0.62, e.sy / 2, 0.62, e.yaw, FAR_PIER, { bottom: false });
    }
  }
  const nearSets = () => {
    for (const { m, list } of sets) {
      let n = 0;
      for (const e of list) if (chunks[e.chunk].group.visible) m.setMatrixAt(n++, e.M);
      m.count = n;
      m.visible = n > 0;
      m.instanceMatrix.needsUpdate = true;
      if (n) m.computeBoundingSphere();
    }
  };
  // the far copy: one draw for all of it, each chunk's part of it hidden while the chunk itself is drawn
  const fg = far.geometry(['aChunk']);
  const n = Math.max(1, chunks.length), mask = new THREE.DataTexture(new Uint8Array(n * 4), n, 1);
  mask.needsUpdate = true;
  const farMat = M.far;
  farMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNearMask = { value: mask };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float aChunk; uniform sampler2D uNearMask;`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nif (texture2D(uNearMask, vec2((aChunk + 0.5) / ${n}.0, 0.5)).r > 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`);
  };
  farMat.customProgramCacheKey = () => `highwayFar${n}`;
  const farMesh = new THREE.Mesh(fg, farMat);
  farMesh.name = 'highway_far';
  farMesh.castShadow = false; farMesh.receiveShadow = true;
  group.add(farMesh);

  // ---- near and far: within 650 m of the camera a chunk is itself, beyond it its part of the far copy
  const _p = new THREE.Vector3();
  let wait = 1;
  const update = (dt, camera, origin, force = false) => {
    wait += dt;
    if (wait < 0.25 && !force) return;
    wait = 0;
    _p.copy(camera.position).sub(origin);
    let changed = false;
    for (const c of chunks) {
      const d = c.box.distanceToPoint(_p), on = c.group.visible ? d < NEAR + 60 : d < NEAR;
      if (on !== c.group.visible) { c.group.visible = on; mask.image.data[c.id * 4] = on ? 255 : 0; changed = true; }
    }
    if (changed) { mask.needsUpdate = true; nearSets(); }
  };
  return { group, chunks, update, far: farMesh, bodies: chunks.map((c) => c.body).filter(Boolean) };

  // where a straddle bent's columns stand: either side of the loop's deck across from (o.x, o.z)
  function straddle(p, side) { const q = loop.project(p.x, p.z), lp = loop.at(q.s); return [lp.x + lp.rx * side * (HALF + 1.6), lp.z + lp.rz * side * (HALF + 1.6)]; }
  // a spur's crossing of the river: a steel tied arch either side of the deck from bank to bank
  function arch(r, a, b) {
    const mid = r.path.at((a + b) / 2), c = chunkAt(r.id, mid.x, mid.z), A = c.acc, q = {}, rise = Math.min(30, (b - a) * 0.2), n = Math.ceil((b - a) / 4), off = HALF + 0.75;
    for (const side of [1, -1]) {
      const st = [];
      for (let i = 0; i <= n; i++) {
        const s = lerp(a, b, i / n), k = (s - a) / (b - a);
        r.path.at(s, q);
        st.push({ s, x: q.x + q.rx * side * off, z: q.z + q.rz * side * off, y: r.y(s) + rise * 4 * k * (1 - k) + 0.6, tx: q.tx, tz: q.tz, rx: q.rx, rz: q.rz });
      }
      sweep(A.metal, st, () => [[-0.5, 0.75], [0.5, 0.75], [0.5, -0.75], [-0.5, -0.75], [-0.5, 0.75]], COL.steel, { col: c.col, cap0: true, cap1: true });
      sweep(A.metal, st.map((t) => ({ ...t, y: r.y(t.s) })), () => [[-0.5, 0.1], [0.5, 0.1], [0.5, -1.1], [-0.5, -1.1], [-0.5, 0.1]], COL.steel, { col: c.col, cap0: true, cap1: true });
      for (let s = a + 8; s < b - 6; s += 8) {
        const k = (s - a) / (b - a), h = rise * 4 * k * (1 - k);
        if (h < 1.5) continue;
        r.path.at(s, q);
        boxAt(A.metal, q.x + q.rx * side * off, r.y(s) + 0.1 + h / 2, q.z + q.rz * side * off, 0.07, h / 2, 0.07, yawOf(q), COL.steel);
      }
    }
    for (let s = a + 12; s < b - 10; s += 14) {
      const k = (s - a) / (b - a), h = rise * 4 * k * (1 - k);
      if (h < 8) continue;
      r.path.at(s, q);
      boxAt(A.metal, q.x, r.y(s) + h + 0.4, q.z, off, 0.35, 0.35, yawOf(q), COL.steel, { col: c.col });
    }
    for (const s of [a - 2, b + 2]) {
      r.path.at(s, q);
      const h = r.y(s) - GIRDER;
      boxAt(A.concrete, q.x, h / 2, q.z, HALF + 1.4, h / 2, 2.4, yawOf(q), COL.pier, { col: c.col });
    }
  }
}
// dashes along a road at offset o: `len` metres painted every `gap`
function dashes(acc, r, s0, s1, o, ok, w = 0.13, len = 3, gap = 12) {
  const q = {};
  for (let s = Math.ceil(s0 / gap) * gap; s + len <= s1; s += gap) {
    if (!ok(s) || !ok(s + len)) continue;
    const a = r.path.side(s, o, {}), b = r.path.side(s + len, o, q), ya = r.y(s) + 0.013, yb = r.y(s + len) + 0.013, base = acc.count;
    acc.v(a.x - a.rx * w / 2, ya, a.z - a.rz * w / 2, 0, 1, 0, 0, 0, COL.white); acc.v(a.x + a.rx * w / 2, ya, a.z + a.rz * w / 2, 0, 1, 0, 0, 1, COL.white);
    acc.v(b.x + b.rx * w / 2, yb, b.z + b.rz * w / 2, 0, 1, 0, len, 1, COL.white); acc.v(b.x - b.rx * w / 2, yb, b.z - b.rz * w / 2, 0, 1, 0, len, 0, COL.white);
    acc.q(base, base + 1, base + 2, base + 3);
  }
}
// a lamp's pool of light on the road under it (additive, lit at night: the city's `pool` material)
function pool(acc, x, y, z, r) {
  const base = acc.count, w = C(0xffffff);
  acc.v(x - r, y, z - r, 0, 1, 0, 0, 0, w); acc.v(x + r, y, z - r, 0, 1, 0, 1, 0, w); acc.v(x + r, y, z + r, 0, 1, 0, 1, 1, w); acc.v(x - r, y, z + r, 0, 1, 0, 0, 1, w);
  acc.q(base, base + 3, base + 2, base + 1);
}
// a sign's face, facing `yaw` (as three.js turns a heading), its middle at (x, y, z), its picture `rect`
// [u0, v0, u1, v1] of the atlas; its back plain grey
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
// the far copies' sections (the road's dark top at the parapets' height, the sides and the soffit)
function farDual(acc, st) { farCopy(acc, st, (t) => [[t.r, -0.6], [4.6, -GIRDER], [-4.6, -GIRDER], [t.l, -0.6]]); }
function farSingle(acc, st) { farCopy(acc, st, (t) => [[t.r, -1.15], [t.l, -1.15]]); }
function farCopy(acc, st, under) {
  if (st.length < 2) return;
  sweep(acc, st, (t) => [[t.l + 0.3, 1.0], [t.r - 0.3, 1.0]], COL.farRoad);
  for (const [fill, run] of runs(st, (t) => t.fill, true)) {
    if (run.length < 2) continue;
    sweep(acc, run, (t) => [[t.r - 0.3, 1.0], [t.r, 1.05], ...(fill ? [[t.r, -t.y], [t.l, -t.y]] : under(t)), [t.l, 1.05], [t.l + 0.3, 1.0]], COL.far);
  }
}

// The instanced pieces' shapes in their own frame (+z along the road, +x its left: three.js's turn by the road's
// heading), y from their foot
function instancedPieces() {
  const make = (f) => { const a = new Acc(); f(a); return a.geometry(); };
  const bar = (a, x0, y0, z0, x1, y1, z1, hw, col) => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, Lh = Math.hypot(dx, dz) || 1, tx = dx / Lh, tz = dz / Lh;
    const st = [{ s: 0, x: x0, y: y0, z: z0, tx, tz, rx: -tz, rz: tx }, { s: 1, x: x1, y: y1, z: z1, tx, tz, rx: -tz, rz: tx }];
    sweep(a, st, () => [[-hw, hw], [hw, hw], [hw, -hw], [-hw, -hw], [-hw, hw]], col);
    void dy;
  };
  return {
    // a pier's column, a metre tall (scaled to its height): 2.4 across, 1.8 along, rounded
    // (narrow across the street under it, so the lanes either side of the median clear it: 1.7 across, 2.6 along)
    pierCol: { mat: 'concrete', shadow: true, geo: make((a) => column(a, 0, 0, 0, 1, 0.85, 1.3, 0, COL.pier, { sides: 20, round: 0.3, vScale: SOFFIT - 1.7 })) },
    // its hammerhead under the girder: 10.8 m across at the top, 3.2 at its foot, 1.7 deep, the bearings on it
    pierCap: { mat: 'concrete', shadow: true, geo: make((a) => {
      const st = [-1.4, 1.4].map((z) => ({ s: z, x: 0, z, y: 0, tx: 0, tz: 1, rx: -1, rz: 0 }));
      sweep(a, st, () => [[-5.4, 1.7], [5.4, 1.7], [5.4, 1.25], [1.2, 0], [-1.2, 0], [-5.4, 1.25], [-5.4, 1.7]], COL.cap, { cap0: true, cap1: true });
      for (const x of [-3.6, 3.6]) boxAt(a, x, 1.78, 0, 0.45, 0.08, 0.5, 0, C(0x4a4c4e));
    }) },
    rampCol: { mat: 'concrete', shadow: true, geo: make((a) => column(a, 0, 0, 0, 1, 0.62, 0.62, 0, COL.pier, { sides: 16, round: 0.45, vScale: 7 })) },
    // a lamp mast on the median: the pole, an arm out over each carriageway
    mast2: { mat: 'metal', shadow: true, geo: make((a) => {
      column(a, 0, 0, 0, 9.6, 0.13, 0.13, 0, COL.mast, { sides: 8, round: 1 });
      boxAt(a, 0, 0.2, 0, 0.3, 0.2, 0.3, 0, COL.mast);
      for (const side of [1, -1]) bar(a, 0, 9.3, 0, side * 4.25, 9.62, 0, 0.06, COL.mast);
    }) },
    // a lamp mast on a ramp's parapet: one arm over its lane
    mast1: { mat: 'metal', shadow: true, geo: make((a) => {
      column(a, 0, 0, 0, 8.6, 0.11, 0.11, 0, COL.mast, { sides: 8, round: 1 });
      bar(a, 0, 8.3, 0, 2.25, 8.55, 0, 0.05, COL.mast);
    }) },
    // the luminaire: a flat shoebox (lit at night)
    head: { mat: 'lamp', shadow: false, geo: make((a) => { boxAt(a, 0, 0, 0, 0.62, 0.09, 0.32, 0, C(0xf4efe2)); }) },
    // a sign gantry across one carriageway (its right: from the median to the parapet): two posts, a truss, a catwalk
    gantry: { mat: 'metal', shadow: true, geo: make((a) => {
      const g = C(0x9aa0a4);
      for (const e of [0.55, 9.05]) { column(a, -e, 0, 0, 8.6, 0.18, 0.18, 0, g, { sides: 10, round: 1 }); boxAt(a, -e, 0.15, 0, 0.35, 0.15, 0.35, 0, g); }
      for (const [y, z] of [[8.5, 0.45], [8.5, -0.45], [5.25, 0.45], [5.25, -0.45]]) boxAt(a, -4.8, y, z, 4.45, 0.07, 0.07, 0, g);
      for (let x = 0.9, k = 0; x < 8.6; x += 0.82, k++) for (const z of [0.45, -0.45]) bar(a, -x, 5.25, z, -(x + 0.82), 8.5, z, 0.04, g);
      boxAt(a, -4.8, 5.1, 0.95, 4.3, 0.04, 0.4, 0, C(0x7a7e82));
    }) },
  };
}
