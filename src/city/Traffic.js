// Traffic on Hal's block (the open world the user agreed: "traffic, pedestrians, emergencies"): cars
// on the boulevard and the cross street, keeping right, through the crossing on the lights or turning
// there; up the block into Hal's lot to park, or out of it; in and out at the far ends, where nobody
// sees them come or go. Each is one of Smash's cars driven kinematically (props/Smash.js): hit by the
// ring or by something thrown, it's left to physics (dented, burning) and leaves the traffic. They keep
// their distance from the car ahead, stop for the lights, for Hal and for the people crossing, slow
// for the turns, honk at him if he stands in the road, and light their lamps at night.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { makeCar } from '../props/Car.js';
import { streetX, STREET_Z, streetSegments } from './Plan.js';
import { HIGHWAY, BRIDGE, waterAt, nearest } from './Layout.js';
import { highwayLanes } from './Highway.js';
import { deckAt } from './Bridge.js';

// The rest of the city (the map rework, 2026-11-24: city/Layout.js, the streets as built: city/Plan.js
// streetSegments): a road network of the streets that exist, the road from the field over the Bay Bridge and
// Highway 1's loop on its deck. Cars on it near the camera, keeping right 2.2 m off a street's middle, stopping at
// each crossing's line on its lights (each crossing's own phase, so they don't all change at once), straight on or
// turning onto a street that's there (a T-junction has no way on across it); their way worked out a street at a
// time ahead of them, so they never come to the end of it in sight; in and out where nobody sees. Hal's blocks'
// streets are the traffic above's: the city's cars come into them at the three crossings round them (the boulevard
// at the street at z -415, the cross street at the streets at x -74 and 86) and go on as the block's, and the
// block's leave by them into the city.
const LANE = 2.2, GSTOP = 10.5, CYCLE = 36;
const ROAD_LANE = 2.0, ROAD_END = -5880; // (the road from the field, Ferris.js: x 2..10, its lanes at x 4 and 8, from the field's gate)
const SPEED = { street: 10.5, road: 15, fast: 25, slow: 20 };
const SPAWN = { street: 260, hwy: 380 }; // (how far from the camera the city's cars are put down, at most)
// the road's height: on the bridge its deck's (city/Layout.js; the bridge's builder may give a gentler profile)
const deckY = (z) => deckAt(z); // (the bridge's deck as built: city/Bridge.js)
// a crossing's id, for its lights (and for the people's crosswalks: story/CityLife.js)
export const crossingId = (k, s) => k * 97 + s;
const ROW = (z) => STREET_Z.indexOf(z), kOf = (x) => Math.round((x - 6) / 80);

// the lanes, in the lot's frame (Ferris.js LOT): the boulevard's x (northbound +z, southbound -z),
// the cross street's z (eastbound +x, westbound -x), the stop lines, the far ends
const NB = 4.0, SB = 8.0, CROSS = -210, EB = CROSS + 2.2, WB = CROSS - 2.2;
const STOP = { NB: -223.4, SB: -196.6, EB: -6.5, WB: 18.5 }; // (each car's middle: its nose short of the stop bar, off the crosswalk)
const SOUTH = -470, WEST = -165, EAST = 165, LOT_IN = -26; // (where the emergencies' cars come in: story/Emergencies.js, Pressure.js)
// where the block's streets meet the city's: the far sides of the crossings round it, each a stop line of the city's
const EDGE = { S: -415 + GSTOP, W: streetX(-1) + GSTOP, E: streetX(1) - GSTOP };
const BAYS = [1.6, 4.8, -4.8]; // free spaces in Hal's lot (its row at z 4.8, noses to +z)
const MODELS = ['fairheaven', 'negotiator', 'sialia', 'fairheaven_sw'];
const PAINTS = [0x5b6f7c, 0x9a3a2c, 0xd8d2c2, 0x2f3e2c, 0x24262c, 0xa88a52, 0x6c4a6a, 0x3a5a8a, 0xc9b98a, 0x7a2224];
const CRUISE = SPEED.street, ACCEL = 2.2, BRAKE = 4.5, LATERAL = 2.4, LENGTH = 4.9;
// the lights at the crossing: the boulevard's green, amber, both red; the cross street's
const PHASES = [['NS', 18], ['NSa', 3], ['red', 1.5], ['EW', 14], ['EWa', 3], ['red', 1.5]];
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0);

// a path: points (x, z, y) with their running length (along the ground); `at(s)` the place, heading and
// pitch there; `append` takes the way on (a car's is worked out ahead of it a stretch at a time)
class Path {
  constructor(pts) {
    this.p = [];
    this.len = [];
    this.total = 0;
    this.i = 1;
    this.append(pts);
  }
  append(pts) {
    for (const q of pts) {
      const p = [q[0], q[1], q[2] ?? 0], l = this.p[this.p.length - 1];
      if (l) { const d = Math.hypot(p[0] - l[0], p[1] - l[1]); if (d < 0.05) continue; this.total += d; }
      this.p.push(p);
      this.len.push(this.total);
    }
    return this;
  }
  at(s, out) {
    if (this.p.length < 2) { const a = this.p[0] ?? [0, 0, 0]; out.x = a[0]; out.z = a[1]; out.y = a[2]; out.yaw ??= 0; out.pitch = 0; return out; }
    s = Math.max(0, Math.min(this.total, s));
    let i = Math.min(Math.max(1, this.i), this.p.length - 1);
    while (i < this.p.length - 1 && this.len[i] < s) i++;
    while (i > 1 && this.len[i - 1] > s) i--;
    this.i = i;
    const a = this.p[i - 1], b = this.p[i], L = Math.max(1e-6, this.len[i] - this.len[i - 1]), k = (s - this.len[i - 1]) / L;
    out.x = a[0] + (b[0] - a[0]) * k;
    out.z = a[1] + (b[1] - a[1]) * k;
    out.y = a[2] + (b[2] - a[2]) * k;
    out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    out.pitch = Math.atan2(b[2] - a[2], L);
    return out;
  }
}
// a curve from a's heading to b's (a cubic, sampled), for the turns and the bays
export function curve(a, da, b, db, n = 12) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.55, out = [];
  const p1 = [a[0] + da[0] * L, a[1] + da[1] * L], p2 = [b[0] - db[0] * L, b[1] - db[1] * L];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * b[1]]);
  }
  return out;
}
const N = [0, 1], S = [0, -1], E = [1, 0], W = [-1, 0];
export const LANES = { NB, SB, EB, WB, CROSS, STOP, SOUTH, WEST, EAST, N, S, E, W };
// the ways into the crossing (to its stop line) and out of it, and how each pair joins
const IN = { NB: { from: [NB, EDGE.S], to: [NB, STOP.NB], dir: N }, SB: { from: [SB, -8], to: [SB, STOP.SB], dir: S }, EB: { from: [EDGE.W, EB], to: [STOP.EB, EB], dir: E }, WB: { from: [EDGE.E, WB], to: [STOP.WB, WB], dir: W } };
const OUT = { N: { from: [NB, STOP.SB], to: [NB, LOT_IN], dir: N }, S: { from: [SB, STOP.NB], to: [SB, EDGE.S], dir: S }, E: { from: [STOP.WB, EB], to: [EDGE.E, EB], dir: E }, W: { from: [STOP.EB, WB], to: [EDGE.W, WB], dir: W } };
const GROUP = { NB: 'NS', SB: 'NS', EB: 'EW', WB: 'EW' };
// which way each approach can leave (never back the way it came); the block's own stretch is weighted
const EXITS = { NB: [['N', 3], ['W', 1], ['E', 1]], SB: [['S', 3], ['E', 1], ['W', 1]], EB: [['E', 2], ['N', 2], ['S', 1]], WB: [['W', 2], ['N', 2], ['S', 1]] };
const ENTRIES = [['NB', 3], ['SB', 3], ['EB', 2], ['WB', 2]];
const STRAIGHT = { NB: 'N', SB: 'S', EB: 'E', WB: 'W' };
// the crossings round the block, where its ways in begin and its ways out end (the city's traffic beyond)
const BOUND = { NB: [0, -415], EB: [-1, CROSS], WB: [1, CROSS], S: [0, -415], W: [-1, CROSS], E: [1, CROSS] };
const pickW = (list) => { let r = Math.random() * list.reduce((n, [, w]) => n + w, 0); for (const [k, w] of list) if ((r -= w) <= 0) return k; return list[0][0]; };

// ------------------------------------------------------------------------------------------------ Highway 1's lanes
// THE ONE PLACE THEY COME FROM: `LANE_SOURCE`. City/Highway.js (the deck's builder) exports the lanes of the deck as
// it's built, ramps and all (its `highwayLanes()`): once it's in, `import { highwayLanes } from './Highway.js'` and
// set LANE_SOURCE to it (and `deckY` above to city/Bridge.js's `deckAt`). The shape (Highway.js's): each lane
// { id, pts: [{ x, y, z }] (or [x, z, y]) the way it runs, next: [ids it runs on into], speed, closed? (round and
// round), branches? / joins? [{ s, id }] (a lane that leaves it or joins it partway), street? { x, z, heading,
// entrance } (a ramp's end at a crossing's kerb: an exit's, or an entrance's start) }; `roadNetwork` makes the graph.
// Until then, worked out here from city/Layout.js HIGHWAY (`fallbackLanes`): the loop's two carriageways either side
// of its middle, two lanes each (the inside one fast), the spurs' the same, and the spurs' lanes into town merging
// onto the loop's outer (clockwise) carriageway; no ramps, nothing leaves the loop.
const LANE_SOURCE = () => highwayLanes(); // (city/Highway.js: the deck's lanes and ramps as built)
export function fallbackLanes() {
  const H = HIGHWAY, y = H.deck, out = [], loop = H.loopLine; // (its corners' arcs and straight legs, a point every 12 m)
  const side = (line, off, closed) => line.map((p, i) => {
    const n = line.length, a = line[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = line[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    return [p.x - (dz / L) * off, p.z + (dx / L) * off, y];
  });
  const LANES2 = [[2.6, SPEED.fast, 'in'], [6.2, SPEED.slow, 'out']];
  // the loop's lanes, cut into pieces (each runs on into the next): at its corners, and on the outer clockwise
  // lane where the spurs' traffic joins it
  const rev = [...loop].reverse();
  const joins = []; // { lane: the spur's lane, at: index on the clockwise outer lane }
  const cwOuter = side(rev, 6.2, true);
  const nearestI = (line, x, z) => { let b = 0, bd = Infinity; line.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  // the spurs: out of town and into it; into town, both lanes onto the loop's outer clockwise lane, 50 m on from
  // the nearest point of it (where they're clear of its deck: 16 m from its middle)
  H.spurs.forEach((sp, si) => {
    for (const [off, speed, which] of LANES2) {
      const o = side(sp, off, false), first = o.findIndex((p) => nearest(loop, p[0], p[1]).d > 16);
      out.push({ id: `spur${si}-out-${which}`, pts: o.slice(Math.max(0, first)), next: [], speed, end: 'valley', start: 'loop' });
      const iL = side([...sp].reverse(), off, false);
      let last = iL.length - 1;
      while (last > 1 && nearest(loop, iL[last][0], iL[last][1]).d < 16) last--;
      const end = iL[last], pe = iL[Math.max(0, last - 1)], d0 = norm2(end[0] - pe[0], end[1] - pe[1]), n0 = nearestI(cwOuter, end[0], end[1]);
      // (where it joins: on along the loop from the nearest point of it till the way across is a gentle one, a
      // slip road's angle off both its own heading and the loop's)
      let at = (n0 + 4) % cwOuter.length;
      for (let k = 2; k < 40; k++) {
        const i = (n0 + k) % cwOuter.length, t = cwOuter[i], tn = cwOuter[(i + 1) % cwOuter.length], ch = norm2(t[0] - end[0], t[1] - end[1]), dl = norm2(tn[0] - t[0], tn[1] - t[1]);
        if (Math.hypot(t[0] - end[0], t[1] - end[1]) > 60 && ch[0] * d0[0] + ch[1] * d0[1] > 0.8 && ch[0] * dl[0] + ch[1] * dl[1] > 0.8) { at = i; break; }
      }
      const lane = { id: `spur${si}-in-${which}`, pts: iL.slice(0, last + 1), next: [], speed, start: 'valley' };
      const t = cwOuter[at], tn = cwOuter[(at + 1) % cwOuter.length], d1 = norm2(tn[0] - t[0], tn[1] - t[1]);
      // (a short handle off the spur, a long one onto the loop: it eases in without swinging over the lane beside)
      const ch = Math.hypot(t[0] - end[0], t[1] - end[1]), a1 = [end[0] + d0[0] * ch * 0.25, end[1] + d0[1] * ch * 0.25], a2 = [t[0] - d1[0] * ch * 0.6, t[1] - d1[1] * ch * 0.6];
      for (let i = 1; i <= 12; i++) {
        const s = i / 12, u = 1 - s, b = (k) => u * u * u * end[k] + 3 * u * u * s * a1[k] + 3 * u * s * s * a2[k] + s * s * s * t[k];
        lane.pts.push([b(0), b(1), y]);
      }
      out.push(lane);
      joins.push({ lane, at });
    }
  });
  for (const [dir, line] of [['ccw', loop], ['cw', rev]]) {
    for (const [off, speed, which] of LANES2) {
      const L = dir === 'cw' && which === 'out' ? cwOuter : side(line, off, true), n = L.length;
      const cuts = new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4)]);
      if (dir === 'cw' && which === 'out') for (const j of joins) cuts.add(j.at);
      const cs = [...cuts].sort((a, b) => a - b), ids = cs.map((c) => `loop-${dir}-${which}-${c}`);
      cs.forEach((c, i) => {
        const c1 = cs[(i + 1) % cs.length], pts = [];
        for (let j = c; j !== c1; j = (j + 1) % n) pts.push(L[j]);
        pts.push(L[c1]);
        out.push({ id: ids[i], pts, next: [ids[(i + 1) % ids.length]], speed });
      });
      if (dir === 'cw' && which === 'out') for (const j of joins) j.lane.next = [ids[cs.indexOf(j.at)]];
    }
  }
  return out;
}
function norm2(x, z) { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; }

// ------------------------------------------------------------------------------------------------ the network
// Crossings (nodes) and the lanes between them (edges, one way each: `pts` from the far side of the crossing it
// leaves to the stop line of the one it comes to). Hal's blocks' streets are left out (the block's traffic above);
// its ways in and out stand in for them at the crossings round it (`into`, `outOf`), so a street there still has
// a way on. Streets whose lanes would be over the water are left out, and then any that would lead only to them
// (a car never comes to a dead end: there's always a way on that isn't back).
let ROADS = null;
export function roadNetwork() {
  if (ROADS) return ROADS;
  const nodes = new Map(), edges = [], buckets = new Map();
  const node = (id, x, z, o = {}) => { let n = nodes.get(id); if (!n) nodes.set(id, (n = { id, x, z, out: [], in: [], links: 0, ...o })); return n; };
  const gnode = (k, s) => node(`${k},${s}`, streetX(k), STREET_Z[s], { k, s, ix: crossingId(k, s) });
  const file = (e) => {
    const seen = new Set();
    for (let s = 0; s <= e.len; s += 25) {
      const q = pointAt(e, s), key = Math.floor(q[0] / 100) * 10007 + Math.floor(q[1] / 100);
      if (seen.has(key)) continue;
      seen.add(key);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { street: [], hwy: [] }));
      b[e.net === 'hwy' ? 'hwy' : 'street'].push(e);
    }
  };
  const add = (e) => {
    e.id = edges.length;
    e.cum = [0];
    for (let i = 1; i < e.pts.length; i++) e.cum.push(e.cum[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
    e.len = e.cum[e.cum.length - 1];
    e.start = e.pts[0];
    e.end = e.pts[e.pts.length - 1];
    e.a?.out.push(e);
    e.b?.in.push(e);
    edges.push(e);
    if (!e.virtual) file(e);
    return e;
  };
  // the streets: dry lanes only (a car's width either side of each lane's line)
  const owned = (g) => (g.ns && g.k === 0 && g.z0 >= -415 && g.z1 <= 70) || (g.ew && g.z === CROSS && g.x0 >= streetX(-1) && g.x1 <= streetX(1));
  const wet = (a, b) => {
    const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z), L = Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
    for (let u = GSTOP; u <= L - GSTOP; u += 8) for (const o of [-3.2, -1.2, 1.2, 3.2]) if (waterAt(a.x + dx * u - dz * o, a.z + dz * u + dx * o)) return true;
    return false;
  };
  const links = [];
  for (const g of streetSegments()) {
    if (owned(g)) continue;
    const a = g.ns ? gnode(g.k, ROW(g.z0)) : gnode(kOf(g.x0), g.s), b = g.ns ? gnode(g.k, ROW(g.z1)) : gnode(kOf(g.x1), g.s);
    if (!wet(a, b)) links.push({ a, b });
  }
  // the road from the field: from the city's south edge (the boulevard at the street at z -935) over the bridge
  const city = gnode(0, ROW(-935)), field = node('field', 6, ROAD_END, { end: true });
  links.push({ a: city, b: field, road: true });
  // what leads nowhere, pruned (the block's ways in and out count as streets at their crossings; the road's far
  // end is where its cars come and go)
  const bound = {};
  for (const [key, [k, z]] of Object.entries(BOUND)) bound[key] = nodes.get(`${k},${ROW(z)}`);
  for (const l of links) { l.a.links++; l.b.links++; }
  for (const n of new Set(Object.values(bound))) if (n) n.links++;
  field.links = 99;
  for (let changed = true; changed;) {
    changed = false;
    for (const l of links) if (!l.dead && (l.a.links < 2 || l.b.links < 2)) { l.dead = true; l.a.links--; l.b.links--; changed = true; }
  }
  for (const l of links) {
    if (l.dead) continue;
    if (l.road) {
      // (points every 10 m where the bridge climbs, its deck's height; straight elsewhere)
      // (only on south of where it starts: the stop line's south of the bridge's end, and points behind it sent the
      // lane back north 15 m, the cars meeting nose to nose)
      const zs = [city.z - GSTOP];
      for (let z = Math.min(BRIDGE.z0, city.z - GSTOP) - 10; z >= BRIDGE.z1 - 10; z -= 10) zs.push(z);
      zs.push(ROAD_END);
      const sb = add({ a: city, b: field, pts: zs.map((z) => [6 + ROAD_LANE, z, deckY(z)]), d0: S, d1: S, group: 'NS', speed: SPEED.road, net: 'road' });
      const nb = add({ a: field, b: city, pts: [...zs].reverse().map((z) => [6 - ROAD_LANE, z, deckY(z)]), d0: N, d1: N, group: 'NS', speed: SPEED.road, net: 'road' });
      sb.rev = nb; nb.rev = sb;
      continue;
    }
    const pair = [];
    for (const [a, b] of [[l.a, l.b], [l.b, l.a]]) {
      const dx = Math.sign(b.x - a.x), dz = Math.sign(b.z - a.z), rx = -dz, rz = dx;
      pair.push(add({ a, b, pts: [[a.x + dx * GSTOP + rx * LANE, a.z + dz * GSTOP + rz * LANE, 0], [b.x - dx * GSTOP + rx * LANE, b.z - dz * GSTOP + rz * LANE, 0]], d0: [dx, dz], d1: [dx, dz], group: dx === 0 ? 'NS' : 'EW', speed: SPEED.street, net: 'street' }));
    }
    pair[0].rev = pair[1]; pair[1].rev = pair[0];
  }
  // Hal's block's ways in and out, at the crossings round it
  const into = {}, outOf = {};
  for (const entry of ['NB', 'EB', 'WB']) {
    const n = bound[entry];
    if (!n?.links) continue;
    const a = IN[entry];
    into[entry] = add({ a: n, b: null, virtual: entry, pts: [[a.from[0], a.from[1], 0]], d0: a.dir, d1: a.dir, net: 'street', speed: SPEED.street });
  }
  for (const exit of ['S', 'W', 'E']) {
    const n = bound[exit];
    if (!n?.links) continue;
    const o = OUT[exit];
    outOf[exit] = add({ a: null, b: n, virtual: exit, pts: [[o.to[0], o.to[1], 0]], d0: o.dir, d1: o.dir, group: exit === 'S' ? 'NS' : 'EW', net: 'street', speed: SPEED.street });
  }
  const pairs = { NB: 'S', EB: 'W', WB: 'E' };
  for (const [i, o] of Object.entries(pairs)) if (into[i] && outOf[o]) { into[i].rev = outOf[o]; outOf[o].rev = into[i]; }
  highwayEdges(LANE_SOURCE(), { node, add, nodes });
  // the lights: at every crossing of three ways or more (a ramp's way in counts)
  for (const n of nodes.values()) n.light = n.k != null && n.out.length >= 3;
  return (ROADS = { nodes, edges, buckets, into, outOf });
}

// Highway 1's lanes into the network: each lane cut into pieces (a closed one at its quarters, any at the points
// where another leaves it or joins it), a node where pieces meet (shared by everything that runs into the same
// place: a lane's end and what it runs on into, a connector's start and the point it leaves its lane), a ramp's
// street end tied to the crossing it meets (an exit turning right into the street's lane out of the crossing, giving
// way to what's in it; an entrance taken by a right turn, or straight on, at the crossing), and an end where a lane
// runs off into the valley (its cars go where nobody sees).
function highwayEdges(source, { node, add, nodes }) {
  const lanes = source.map((l) => {
    const P = l.pts.map((q) => (Array.isArray(q) ? [q[0], q[1], q[2] ?? HIGHWAY.deck] : [q.x, q.z, q.y ?? HIGHWAY.deck]));
    if (l.closed) P.push([...P[0]]);
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    return { ...l, P, cum, len: cum[cum.length - 1], next: l.next ?? [] };
  });
  const byId = new Map(lanes.map((l) => [l.id, l]));
  // a lane that stops with nothing on (an outer lane dropped) merges into the one beside it, going the same way, a
  // little on from its end; one that starts from nothing (a lane gained) leaves the one beside it a little before
  // its start (not a ramp's street end, nor the valley's)
  const besideAt = (l, p, d, ahead) => {
    let best = null, bd = 9;
    for (const o of lanes) {
      if (o === l || o.street) continue;
      for (let i = 1; i < o.P.length; i++) {
        const a = o.P[i - 1], b = o.P[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        if ((dx * d[0] + dz * d[1]) / L < 0.85 || Math.abs(a[2] - p[2]) > 2) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L))), dd = Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
        if (dd < bd) { bd = dd; best = { o, s: o.cum[i - 1] + L * t }; }
      }
    }
    if (!best) return null;
    const s = best.s + ahead;
    return best.o.closed ? { o: best.o, s: ((s % best.o.len) + best.o.len) % best.o.len } : s > 1 && s < best.o.len - 1 ? { o: best.o, s } : null;
  };
  const fed = new Set(lanes.flatMap((l) => [...l.next, ...(l.branches ?? []).map((b) => b.id)])), acts = [];
  for (const l of lanes) {
    if (l.closed || l.street) continue;
    const P = l.P, n = P.length;
    if (!l.next.length && !l.end) { const m = besideAt(l, P[n - 1], norm2(P[n - 1][0] - P[n - 2][0], P[n - 1][1] - P[n - 2][1]), 18); if (m) acts.push({ l, m, at: pointOn(m.o, m.s), join: true }); }
    if (!fed.has(l.id) && !l.start) { const m = besideAt(l, P[0], norm2(P[1][0] - P[0][0], P[1][1] - P[0][1]), -18); if (m) acts.push({ l, m, at: pointOn(m.o, m.s), join: false }); }
  }
  for (const { l, m, at, join } of acts) {
    if (join) { l.next = [m.o.id]; (m.o.joins = [...(m.o.joins ?? [])]).push({ s: m.s, id: l.id }); l.P.push(at); }
    else { (m.o.branches = [...(m.o.branches ?? [])]).push({ s: m.s, id: l.id }); l.P.unshift(at); }
  }
  for (const { l } of acts) {
    l.cum = [0];
    for (let i = 1; i < l.P.length; i++) l.cum.push(l.cum[i - 1] + Math.hypot(l.P[i][0] - l.P[i - 1][0], l.P[i][1] - l.P[i - 1][1]));
    l.len = l.cum[l.cum.length - 1];
  }
  // (the places where pieces meet, as tokens joined into one node each: a union-find)
  const parent = new Map(), find = (t) => { while (parent.has(t) && parent.get(t) !== t) t = parent.get(t); return t; }, union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const tok = (l, s) => (!l.closed && s <= 0.01 ? `S:${l.id}` : !l.closed && s >= l.len - 0.01 ? `E:${l.id}` : `C:${l.id}:${(l.closed ? ((s % l.len) + l.len) % l.len : s).toFixed(1)}`);
  for (const l of lanes) {
    const cuts = new Set(l.closed ? [0, 0.25, 0.5, 0.75].map((k) => +(l.len * k).toFixed(1)) : [0, l.len]);
    for (const b of [...(l.branches ?? []), ...(l.joins ?? [])]) cuts.add(+(+b.s).toFixed(1));
    l.cuts = [...cuts].sort((a, b) => a - b);
  }
  for (const l of lanes) {
    for (const id of l.next) {
      const n = byId.get(id);
      if (!n) continue;
      const j = (n.joins ?? []).find((q) => q.id === l.id);
      union(`E:${l.id}`, j ? tok(n, +(+j.s).toFixed(1)) : tok(n, 0));
    }
    for (const b of l.branches ?? []) if (byId.has(b.id)) union(`S:${b.id}`, tok(l, +(+b.s).toFixed(1)));
  }
  const hnode = (t) => node(`hwy:${find(t)}`, 0, 0, { hwy: true });
  const slice = (l, s0, s1) => {
    const at = (s) => { let i = 1; while (i < l.cum.length - 1 && l.cum[i] < s) i++; const a = l.P[i - 1], b = l.P[i], k = (s - l.cum[i - 1]) / Math.max(1e-6, l.cum[i] - l.cum[i - 1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
    const out = [at(s0)];
    for (let i = 0; i < l.cum.length; i++) if (l.cum[i] > s0 + 0.05 && l.cum[i] < s1 - 0.05) out.push(l.P[i]);
    out.push(at(s1));
    return out;
  };
  const gridNear = (x, z) => { let best = null, bd = 30; for (const n of nodes.values()) { if (n.k == null) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } return best; };
  for (const l of lanes) {
    const cs = l.cuts, pieces = [];
    for (let i = 0; i + 1 < cs.length; i++) pieces.push([cs[i], cs[i + 1]]);
    if (l.closed) pieces.push([cs[cs.length - 1], l.len + cs[0]]);
    pieces.forEach(([s0, s1], i) => {
      const pts = l.closed && s1 > l.len ? [...slice(l, s0, l.len), ...slice(l, 0, s1 - l.len).slice(1)] : slice(l, s0, s1);
      if (pts.length < 2) return;
      const first = i === 0 && !l.closed, last = i === pieces.length - 1 && !l.closed;
      let a = hnode(tok(l, s0)), b = last && !l.next.length ? node(`hwy:end:${l.id}`, 0, 0, { hwy: true, end: true }) : hnode(tok(l, s1));
      const e = { a, b, pts, net: 'hwy', speed: l.speed ?? SPEED.slow, group: null, lane: l.id, kind: l.kind };
      // a ramp's ends at the street: tied to the crossing there
      const st = l.street, grid = st && gridNear(st.x, st.z);
      if (grid && first && st.entrance) e.a = grid, e.entry = true;
      if (grid && last && !st.entrance) e.b = grid, e.exit = true;
      const p = e.pts;
      e.d0 = norm2(p[1][0] - p[0][0], p[1][1] - p[0][1]);
      e.d1 = norm2(p[p.length - 1][0] - p[p.length - 2][0], p[p.length - 1][1] - p[p.length - 2][1]);
      [e.a.x, e.a.z] = e.a.k == null ? p[0] : [e.a.x, e.a.z];
      add(e);
    });
  }
  // an exit's way on: the right turn into the street's lane out of its crossing (on the ramp's side)
  for (const n of nodes.values()) for (const e of n.in) {
    if (!e.exit) continue;
    const r = [-e.d1[1], e.d1[0]];
    e.only = n.out.filter((f) => f.net === 'street' && f.d0[0] * r[0] + f.d0[1] * r[1] > 0.9);
  }
}
// along an edge: the point s metres from its start, and its points from there on
function pointAt(e, s) {
  const c = e.cum;
  if (s <= 0) return [...e.pts[0]];
  if (s >= e.len) return [...e.end];
  let i = 1;
  while (c[i] < s) i++;
  const a = e.pts[i - 1], b = e.pts[i], k = (s - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
// a lane's point s metres along it (highwayEdges' lanes: `P`, `cum`)
function pointOn(l, s) {
  let i = 1;
  while (i < l.cum.length - 1 && l.cum[i] < s) i++;
  const a = l.P[i - 1], b = l.P[i], k = (s - l.cum[i - 1]) / Math.max(1e-6, l.cum[i] - l.cum[i - 1]);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
// how far along an edge its nearest point to (x, z) is
function nearestS(e, x, z) {
  let best = 0, bd = Infinity;
  for (let i = 1; i < e.pts.length; i++) {
    const a = e.pts[i - 1], b = e.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)), d = (a[0] + dx * t - x) ** 2 + (a[1] + dz * t - z) ** 2;
    if (d < bd) { bd = d; best = e.cum[i - 1] + (e.cum[i] - e.cum[i - 1]) * t; }
  }
  return best;
}
function sliceFrom(e, s) {
  const out = [pointAt(e, s)];
  for (let i = 1; i < e.pts.length; i++) if (e.cum[i] > s + 0.05) out.push(e.pts[i]);
  return out;
}
// through a crossing from one lane onto the next: straight on across it, or a turn (a highway's lanes run on into
// each other; a ramp's end turns into the street, or off it)
function join(e, f) {
  if (f.net === 'hwy' && e.net === 'hwy') return [];
  if (e.d1[0] * f.d0[0] + e.d1[1] * f.d0[1] > 0.95) return [];
  const a = e.end, b = f.start;
  return curve(a, e.d1, b, f.d0, 10).map((q, i, all) => [q[0], q[1], a[2] + (b[2] - a[2]) * ((i + 1) / all.length)]);
}
const joinOK = (e, f) => {
  const m = (e.joins ??= new Map());
  if (!m.has(f)) m.set(f, !join(e, f).some((q) => waterAt(q[0], q[1])));
  return m.get(f);
};

export class Traffic {
  // f: the Ferris scene (its smash, its physics); story: for Hal, the people, the camera, the sounds
  // (`count` the block's cars, `grid` the rest of the city's near the camera, `highway` how many of those on the
  // highway's deck when it's near)
  constructor(f, story, { count = 10, lot, grid = 0, highway = 6 }) {
    Object.assign(this, { f, story, lot });
    this.gridWant = grid;
    this.hwyWant = Math.min(highway, grid);
    this.roads = roadNetwork();
    this.cars = [];
    this.phase = 0;
    this.phaseT = 0;
    this.bays = new Map(); // bay x → the car in it
    this.made = 0;
    for (let i = 0; i < count + grid + 2; i++) this.cars.push(this.make());
    // the two cars Part Three left waiting at the lights stood in the cross street's lanes (on the wrong
    // side, too): to its kerbs, parked
    for (const it of f.smash.items) {
      if (it.kind !== 'car' || it.traffic) continue;
      const x = it.object.position.x - lot.x, z = it.object.position.z - lot.z;
      if (Math.abs(z - CROSS) < 4 && Math.abs(x - 6) > 9 && Math.abs(x) < 200) {
        const zz = lot.z + CROSS + (x > 0 ? 4.7 : -4.7), yaw = x > 0 ? Math.PI / 2 : -Math.PI / 2;
        it.body.setTranslation({ x: it.object.position.x, y: it.object.position.y, z: zz }, true);
        it.body.setRotation(_q.setFromAxisAngle(_Y, yaw), true);
      }
    }
    this.want = count;
    this.extra = []; // (other cars in the road to stop for: the police, a wreck, an ambulance)
    this.t = 0;
    this.frustum = new THREE.Frustum();
    this.m = new THREE.Matrix4();
  }

  make() {
    const i = this.made++, f = this.f, lot = this.lot;
    const obj = makeCar(MODELS[i % MODELS.length], { paint: PAINTS[(i * 3) % PAINTS.length], dust: 0.15 + Math.random() * 0.25 });
    obj.position.set(lot.x + 300 + (i % 20) * 8, -60, lot.z);
    f.smash.add(obj, { kind: 'car', mass: 1300, shrink: 0.97 });
    const item = f.smash.items[f.smash.items.length - 1];
    item.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    item.traffic = true;
    f.lod?.addCar(obj, 260, item); // (drawn by distance like the parked ones: a car up close is ~54 draw calls)
    this.show(obj, false); // (in the pool, under the ground, till it's sent out)
    this.story.player.camIgnore.add(item.collider.handle); // (the camera doesn't jump in as one passes behind him)
    const lamps = item.lamps.map((m) => { m.updateWorldMatrix(true, false); const p = obj.worldToLocal(m.getWorldPosition(_v.clone())); return { m, front: p.z > 0 }; });
    return { obj, item, lamps, path: null, s: 0, v: 0, state: 'pool', pose: { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 }, blocked: 0, honked: -99, lit: -1, vmul: 0.93 + Math.random() * 0.14 };
  }
  // a car the traffic let go (hit, crashed) towed once nobody's looking, and a new one in its place
  tow(c) {
    this.f.smash.remove(c.item);
    this.cars = this.cars.filter((q) => q !== c);
    this.cars.push(this.make());
  }

  get light() { return PHASES[this.phase][0]; }
  green(group) { const l = this.light; return group === 'NS' ? l === 'NS' : l === 'EW'; }
  amber(group) { const l = this.light; return group === 'NS' ? l === 'NSa' : l === 'EWa'; }

  // the lot's frame to the world's
  W(q) { return [q[0] + this.lot.x, q[1] + this.lot.z, q[2] ?? 0]; }

  // Hal's block: in by an approach, out by an exit (the lot's bays at the north end), the crossing's stop line
  // between: { inPts to the stop line, outPts, the crossing's group, the bay, the exit }
  blockRoute(entry) {
    const a = IN[entry], exit = pickW(this.cordon ? EXITS[entry].filter(([x]) => x !== 'N') : EXITS[entry]), o = OUT[exit];
    const outPts = [...curve(a.to, a.dir, o.from, o.dir, exit === STRAIGHT[entry] ? 2 : 14), o.to];
    let bay = null;
    if (exit === 'N') {
      // into Hal's lot, nose first into a free space (or to its far side, to wait)
      bay = BAYS.find((x) => !this.bays.has(x)) ?? null;
      if (bay != null) outPts.push(...curve(o.to, N, [bay, 3.4], N, 10), [bay, 4.8]);
      else outPts.push([NB - 2, -12]);
    }
    return { inPts: [a.from, a.to], outPts, group: GROUP[entry], bay, exit };
  }
  // a car's way on through the block (its path so far ending where the block's way in begins): over the crossing
  // on its lights and out by a way into the city, or into the lot
  enterBlock(c, entry) {
    const r = this.blockRoute(entry), P = c.path;
    P.append(r.inPts.map((q) => this.W(q)));
    c.stops.push({ s: P.total, group: r.group, main: true });
    P.append(r.outPts.map((q) => this.W(q)));
    c.bay = r.bay;
    if (r.bay != null) this.bays.set(r.bay, c);
    Object.assign(c, { block: true, grid: false, hwy: false, entry, blockEnd: null, tail: 'end' });
    const out = r.exit !== 'N' && this.roads.outOf[r.exit];
    if (out) {
      // (at the crossing beyond: its lights, and the city's streets from there)
      if (out.b.light) c.stops.push({ s: P.total, group: out.group, ix: out.b.ix });
      Object.assign(c, { edge: out, tail: 'grid', blockEnd: P.total });
    }
  }

  // somewhere for a car to come from: out of sight (out of the frustum, or far), and clear
  unseen(x, z, far = 210, y = 0) {
    const cam = this.story.engine.camera;
    _v.set(x, y + 1, z);
    return _v.distanceTo(cam.position) > far || !this.frustum.containsPoint(_v);
  }
  clear(x, z, r = 12, y = 0) { return !this.cars.some((c) => c.state === 'drive' && Math.abs(c.obj.position.y - y) < 4 && Math.hypot(c.obj.position.x - x, c.obj.position.z - z) < r); }

  // a car sent out: its path, its stops and its speeds from the start
  begin(c, path, o = {}) {
    Object.assign(c, { path, s: 0, stops: [], si: 0, zones: [{ s: 0, v: SPEED.street }], zi: 0, edge: null, tail: 'end', block: false, grid: false, hwy: false, bay: null, blockEnd: null,
      state: 'drive', blocked: 0, parkedT: 0, hitSeen: c.item.lastHit, pitch: 0, uid: ++UID, ignore: null, limiter: null, mutualT: 0, stuckT: 0, ...o });
    this.show(c.obj, true);
  }

  // one of the block's: in by one of its ways in, from one to three of the city's streets back where nobody sees
  // it start (or out of the lot)
  spawn(c) {
    const entry = pickW(this.cordon ? ENTRIES.filter(([e]) => e !== 'SB' && e !== 'NB') : ENTRIES), v = this.roads.into[entry];
    if (entry === 'SB' || !v) {
      const p0 = this.W(IN[entry].from);
      if (!this.unseen(p0[0], p0[1]) || !this.clear(p0[0], p0[1])) return false;
      this.begin(c, new Path([]), { v: entry === 'SB' ? 0 : CRUISE * 0.8 }); // (its way, from where it starts: the block's)
      this.enterBlock(c, entry);
      this.place(c, true);
      return true;
    }
    const chain = [];
    for (let at = v, n = 0; n < 3; n++) {
      const opts = at.a.in.filter((e) => e !== at.rev && !e.virtual && e.net === 'street' && joinOK(e, at));
      if (!opts.length) break;
      chain.unshift((at = opts[Math.floor(Math.random() * opts.length)]));
    }
    for (let i = 0; i < chain.length; i++) {
      const e = chain[i], s = e.len * (0.15 + Math.random() * 0.6), q = this.W(pointAt(e, s));
      if (!this.unseen(q[0], q[1]) || !this.clear(q[0], q[1])) continue;
      this.begin(c, new Path(sliceFrom(e, s).map((p) => this.W(p))), { v: CRUISE * 0.8 });
      if (e.b.light) c.stops.push({ s: c.path.total, group: e.group, ix: e.b.ix });
      for (let j = i + 1; j <= chain.length; j++) {
        const g = chain[j] ?? v, prev = chain[j - 1];
        c.path.append(join(prev, g).map((p) => this.W(p)));
        if (g === v) break;
        c.path.append(g.pts.map((p) => this.W(p)));
        if (g.b.light) c.stops.push({ s: c.path.total, group: g.group, ix: g.b.ix });
      }
      this.enterBlock(c, entry);
      this.place(c, true);
      return true;
    }
    return false;
  }
  park(c) { c.state = 'parked'; c.v = 0; }

  // ---------------------------------------------------------------- the city's
  // each crossing's lights: the cycle offset by where it is
  gridLight(ix) {
    const ph = (this.t + (Math.abs(Math.sin(ix * 91.7) * 1e4) % 1) * CYCLE) % CYCLE;
    return ph < 15 ? 'NS' : ph < 18 ? 'NSa' : ph < 19.5 ? 'red' : ph < 32.5 ? 'EW' : ph < 35.5 ? 'EWa' : 'red';
  }
  // whether people on foot may go over a street at the crossing (k, s): its own traffic held there (`street` the
  // one they cross: 'NS', a north-south street). Hal's crossing has its own lights; a corner without lights, any time.
  walkOK(k, s, street) {
    const n = this.roads.nodes.get(`${k},${s}`);
    if (!n?.light) return true;
    const l = this.gridLight(n.ix);
    return street === 'NS' ? l === 'EW' : l === 'NS';
  }
  // the next lane on from the end of `e`: straight on mostly, a turn now and then; never back the way it came,
  // never a turn over the water; into Hal's block less often while it's full
  next(e) {
    const b = e.b;
    if (!b || b.end) return null;
    // (off a ramp: only its right turn; onto one: by a right turn or straight on, never across the oncoming)
    const onto = (f) => !f.entry || e.d1[0] * f.d0[0] + e.d1[1] * f.d0[1] > 0.7 || -e.d1[1] * f.d0[0] + e.d1[0] * f.d0[1] > 0.7;
    const opts = (e.only ?? b.out).filter((f) => f !== e.rev && joinOK(e, f) && onto(f) && !(this.cordon && f.virtual === 'NB'));
    if (!opts.length) return null;
    const busy = this.cars.filter((q) => q.block && q.state !== 'pool' && q.state !== 'free').length > (this.blockWant ?? this.want);
    const w = opts.map((f) => {
      let x = e.d1[0] * f.d0[0] + e.d1[1] * f.d0[1] > 0.7 ? 5 : 1.4;
      if (f.virtual) x *= busy ? 0.3 : 1.2;
      if (f.entry) x = 2; // (up onto the highway now and then)
      if (f.net === 'road' && e.net !== 'road') x = 1.2; // (out of town down the road now and then)
      return x;
    });
    let r = Math.random() * w.reduce((a, x) => a + x, 0);
    for (let i = 0; i < opts.length; i++) if ((r -= w[i]) <= 0) return opts[i];
    return opts[0];
  }
  // a car's way on: through the crossing ahead onto the next lane and along it to the next stop line (into Hal's
  // block, where that's the way); false where there's none
  extend(c) {
    const e = c.edge, f = e && this.next(e);
    if (!f) { c.tail = 'end'; return false; }
    const P = c.path;
    P.append(join(e, f).map((q) => this.W(q)));
    if (f.virtual) { this.enterBlock(c, f.virtual); return true; }
    c.zones.push({ s: P.total, v: f.speed * c.vmul });
    P.append(f.pts.map((q) => this.W(q)));
    this.stopAt(c, f);
    c.edge = f;
    c.hwy = f.net === 'hwy';
    return true;
  }
  // one put down on a lane near the camera, where nobody sees it ('street': the streets and the road; 'hwy')
  gridSpawn(c, net = 'street') {
    const cam = this.story.engine.camera, far = net === 'hwy' ? SPAWN.hwy : SPAWN.street;
    // round the camera, or (more often) round the ground it looks at, where they'll be seen coming
    let lx = cam.position.x - this.lot.x, lz = cam.position.z - this.lot.z;
    if (Math.random() < 0.6) {
      cam.getWorldDirection(_v);
      const t = _v.y < -0.1 ? Math.min(cam.position.y / -_v.y, 600) : 170, h = Math.hypot(_v.x, _v.z) || 1, d = Math.min(220, t * h);
      lx += (_v.x / h) * d; lz += (_v.z / h) * d;
    }
    const list = this.near(net, lx, lz);
    for (let tries = 0; tries < 8 && list.length; tries++) {
      // a lane near there, and a point along it near its nearest (the road is 5 km, a highway's piece 2)
      const e = list[Math.floor(Math.random() * list.length)], mid = nearestS(e, lx, lz);
      const s = Math.max(0, Math.min(e.len - 3, mid + (Math.random() - 0.5) * 2 * Math.min(e.len, far))), q = this.W(pointAt(e, s));
      const d = Math.hypot(q[0] - cam.position.x, q[2] - cam.position.y, q[1] - cam.position.z);
      if (d < 45 || d > far || !this.unseen(q[0], q[1], 120, q[2]) || !this.clear(q[0], q[1], net === 'hwy' ? 34 : 14, q[2])) continue;
      if (e.b?.end && e.len - s < 300) continue; // (not just short of the road's end at the field)
      this.begin(c, new Path(sliceFrom(e, s).map((p) => this.W(p))), { v: e.speed * 0.75, zones: [{ s: 0, v: e.speed * c.vmul }], edge: e, tail: 'grid', grid: true, hwy: net === 'hwy' });
      this.stopAt(c, e);
      this.place(c, true);
      return true;
    }
    return false;
  }
  // where a car's path has just been taken to the end of lane `e`: its stop there (the crossing's lights, or a ramp's
  // end giving way to the street's traffic)
  stopAt(c, e) {
    if (e.exit) c.stops.push({ s: c.path.total, yieldTo: e.only?.[0] ?? null });
    else if (e.b?.light) c.stops.push({ s: c.path.total, group: e.group, ix: e.b.ix });
  }
  // the lanes within reach of the camera ('street' or 'hwy'), gathered once for each 100 m it moves into
  near(net, lx, lz) {
    const gx = Math.floor(lx / 100), gz = Math.floor(lz / 100), cells = net === 'hwy' ? 4 : 3, memo = (this.nearMemo ??= new Map()), key = `${net}:${gx},${gz}`;
    let list = memo.get(key);
    if (list) return list;
    const set = new Set();
    for (let i = -cells; i <= cells; i++) for (let j = -cells; j <= cells; j++) for (const e of this.roads.buckets.get((gx + i) * 10007 + gz + j)?.[net] ?? []) set.add(e);
    if (memo.size > 24) memo.delete(memo.keys().next().value);
    memo.set(key, (list = [...set]));
    return list;
  }
  // whether the highway's deck is near the camera (its traffic only then)
  hwyNear() {
    const cam = this.story.engine.camera, lx = Math.floor((cam.position.x - this.lot.x) / 100), lz = Math.floor((cam.position.z - this.lot.z) / 100);
    if (this.hwyAt?.[0] === lx && this.hwyAt[1] === lz) return this.hwyAt[2];
    let on = false;
    for (let i = -4; i <= 4 && !on; i++) for (let j = -4; j <= 4 && !on; j++) on = !!this.roads.buckets.get((lx + i) * 10007 + lz + j)?.hwy.length;
    this.hwyAt = [lx, lz, on];
    return on;
  }

  // A car sent somewhere (the police, an ambulance: story/Emergencies.js): in along `pts` (the lot's
  // frame) from as near as it can start unseen, through the lights, to stop at the last point and stay
  // ('held') until it's dismissed. Never put down where another car might be: two bodies made one on
  // top of the other were thrown apart and flipped half the street (the user would call it a glitch).
  dispatch(model, pts, { speed = 13, paint = 0x111114, onArrive = null } = {}) {
    const obj = makeCar(model, { paint, dust: 0.1 });
    obj.position.set(this.lot.x + 320, -60, this.lot.z);
    this.f.smash.add(obj, { kind: 'car', mass: 1400, shrink: 0.97 });
    const item = this.f.smash.items[this.f.smash.items.length - 1];
    item.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    item.traffic = true;
    this.f.lod?.addCar(obj, 260, item);
    this.story.player.camIgnore.add(item.collider.handle);
    const path = new Path(pts.map((q) => this.W(q)));
    // where it comes from: back along its way, the nearest point to the end that nobody sees and no car is at
    let s0 = 0;
    for (let s = Math.max(0, path.total - 50); s >= 0; s -= 10) { const q = path.at(s, _p); if (this.unseen(q.x, q.z, 90) && this.clear(q.x, q.z, 10)) { s0 = s; break; } }
    const lamps = item.lamps.map((m) => { m.updateWorldMatrix(true, false); return { m, front: obj.worldToLocal(m.getWorldPosition(_v.clone())).z > 0 }; });
    const c = { obj, item, lamps, path, s: s0, v: speed * 0.8, state: 'drive', pose: { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 }, blocked: 0, honked: -99, lit: -1, stops: [], si: 0, zones: [], zi: 0, tail: 'held',
      bay: null, held: true, cruise: speed, onArrive, hitSeen: item.lastHit, vmul: 1, uid: ++UID };
    this.cars.push(c);
    this.show(obj, true);
    this.place(c, true);
    return c;
  }
  dismiss(c) { c.state = 'free'; this.cars = this.cars.filter((q) => q !== c); }
  retire(c) {
    if (c.bay != null && this.bays.get(c.bay) === c) this.bays.delete(c.bay);
    Object.assign(c, { state: 'pool', bay: null, grid: false, block: false, hwy: false, stops: null, edge: null, tail: 'end' });
    c.item.body.setNextKinematicTranslation({ x: this.lot.x + 300, y: -60, z: this.lot.z });
    this.show(c.obj, false);
  }
  // a car out of the pool or back in it, drawn by distance while it's out (city/Lod.js)
  show(obj, on) {
    obj.userData.away = !on;
    obj.visible = on;
    this.f.lod?.recheck(obj);
  }
  // hit by the ring, or by something: physics has it now
  release(c) {
    if (c.bay != null && this.bays.get(c.bay) === c) this.bays.delete(c.bay);
    c.state = 'free';
    c.block = c.grid = c.hwy = false;
    const b = c.item.body, y = c.pose.yaw;
    b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.setLinvel({ x: Math.sin(y) * c.v, y: 0, z: Math.cos(y) * c.v }, true);
    c.item.traffic = false;
  }

  place(c, snap = false) {
    const p = c.path.at(c.s, c.pose);
    const b = c.item.body;
    // (nose up the bridge's climb, eased: its slope comes in steps of its points)
    c.pitch = snap ? p.pitch : (c.pitch ?? 0) + (p.pitch - (c.pitch ?? 0)) * 0.15;
    _q.setFromAxisAngle(_Y, p.yaw);
    if (Math.abs(c.pitch) > 1e-4) _q.multiply(_qp.setFromAxisAngle(_X, -c.pitch));
    if (snap) { b.setTranslation({ x: p.x, y: p.y, z: p.z }, true); b.setRotation(_q, true); c.obj.position.set(p.x, p.y, p.z); c.obj.quaternion.copy(_q); }
    b.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    b.setNextKinematicRotation(_q);
  }

  update(dt) {
    if (dt <= 0) return;
    const story = this.story, cam = story.engine.camera, hp = story.player.position;
    this.t += dt;
    cam.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    if ((this.phaseT += dt) > PHASES[this.phase][1]) { this.phaseT = 0; this.phase = (this.phase + 1) % PHASES.length; }
    // the boulevard north of the crossing closed (story/Pressure.js's police lines, a cruiser across it): nobody
    // routed up it to the lot or out of it, or in from the south (they queued through the crossing and locked it)
    this.cordon = this.extra.some((o) => !o.userData?.holdR && Math.abs(o.position.x - this.lot.x - 6) < 8 && o.position.z - this.lot.z > -206 && o.position.z - this.lot.z < -20);
    // keep the streets busy (fewer at night); the block's cars only while the camera's within reach of it, the
    // rest of the city's near the camera taking their share when it isn't (the same cars, where he is)
    const night = this.f.isNight, far = Math.hypot(cam.position.x - this.lot.x - 6, cam.position.z - this.lot.z + 200);
    const full = night ? Math.ceil(this.want * 0.5) : this.want, want = Math.round(full * (1 - THREE.MathUtils.smoothstep(far, 450, 800)));
    this.blockWant = want;
    let driving = 0, gridOn = 0, hwyOn = 0;
    for (const c of this.cars) {
      if (c.block && (c.state === 'drive' || c.state === 'parked')) driving++;
      else if (c.grid && c.state === 'drive') { if (c.hwy) hwyOn++; else gridOn++; }
    }
    if (driving < want && (this.spawnT = (this.spawnT ?? 0) - dt) < 0) {
      this.spawnT = 0.7 + Math.random() * 1.2;
      const c = this.cars.find((q) => q.state === 'pool');
      if (c) this.spawn(c);
    }
    // and the rest of the city's near the camera (from the streets, the bridge, the road, not from high up): some
    // of them on the highway when it's near
    const low = cam.position.y < 160;
    const gridWant = low ? (night ? Math.ceil(this.gridWant * 0.5) : this.gridWant) + (full - want) : 0;
    const hwyWant = low && this.hwyNear() ? (night ? Math.ceil(this.hwyWant * 0.5) : this.hwyWant) : 0;
    if (gridOn + hwyOn < gridWant && (this.gridT = (this.gridT ?? 0) - dt) < 0) {
      this.gridT = 0.25;
      const c = this.cars.find((q) => q.state === 'pool');
      if (c) this.gridSpawn(c, hwyOn < hwyWant && (gridOn >= gridWant - hwyWant || Math.random() < 0.5) ? 'hwy' : 'street');
    }
    const lit = night || story.dayCycle?.w.grey > 0.6 ? 1 : 0;
    const people = story.cityLife?.people ?? [];
    for (const c of [...this.cars]) {
      if (c.state === 'free' && !c.held && (c.freeT = (c.freeT ?? 0) + dt) > 45 && this.unseen(c.obj.position.x, c.obj.position.z, 90)) { this.tow(c); continue; }
      if (c.state === 'pool' || c.state === 'free' || c.state === 'held') continue;
      // hit: the ring's or anything's blow (Smash sets lastHit), or caught burning
      if (c.item.lastHit != null && c.item.lastHit !== c.hitSeen) { c.hitSeen = c.item.lastHit; if (c.state === 'drive' || c.item.hurt) { this.release(c); continue; } }
      if (c.trapped) { c.v = 0; this.lamps(c, lit, true); continue; } // (held in the ring's bubble: story/Trap.js)
      if (c.state === 'parked') {
        // gone when nobody's looking (the space free again for the next)
        if ((c.parkedT = (c.parkedT ?? 0) + dt) > 20 && this.unseen(c.obj.position.x, c.obj.position.z, 120)) this.retire(c);
        this.lamps(c, 0, false);
        continue;
      }
      // the way on, worked out ahead of it (a street or two beyond what it can see to stop for)
      for (let n = 0; c.tail === 'grid' && n < 3 && c.path.total - c.s < 50 + c.v * 4; n++) if (!this.extend(c)) break;
      // through Hal's block and out of it: one of the city's now
      if (c.block && c.blockEnd != null && c.s > c.blockEnd) { c.block = false; c.grid = true; c.blockEnd = null; }
      const pose = c.path.at(c.s, c.pose), f = [Math.sin(pose.yaw), Math.cos(pose.yaw)];
      // far off and unseen (out of the frame past where they're put down, or past it by a stretch): back to the pool
      if (c.grid) {
        const dc = Math.hypot(c.obj.position.x - cam.position.x, c.obj.position.z - cam.position.z), r = c.hwy ? SPAWN.hwy : SPAWN.street;
        if (dc > r + 70 || (dc > r + 10 && this.unseen(c.obj.position.x, c.obj.position.z, Infinity, pose.y))) { this.retire(c); continue; }
      }
      // what it may do: its road's speed (slowing for a slower one ahead); slower into the bends ahead; stop for
      // the lights, the car ahead, Hal, and anyone in the road
      const zs = c.zones;
      while (c.zi + 1 < zs.length && zs[c.zi + 1].s <= c.s) c.zi++;
      let v = c.cruise ?? zs[c.zi]?.v ?? CRUISE;
      const nz = zs[c.zi + 1];
      if (nz && nz.v < v) v = Math.min(v, Math.sqrt(nz.v * nz.v + BRAKE * Math.max(0, nz.s - c.s)));
      const far = Math.max(1, c.v / CRUISE);
      for (const ahead of [6 * far, 12 * far, 18 * far]) {
        const q = c.path.at(c.s + ahead, _p), turn = Math.abs(wrap(q.yaw - pose.yaw)) / ahead;
        if (turn > 1e-3) v = Math.min(v, Math.sqrt(LATERAL / turn) + ahead * 0.35);
      }
      if (c.bay != null && c.path.total - c.s < 14) v = Math.min(v, 1.2 + (c.path.total - c.s) * 0.35); // (into the space)
      // the next crossing's line, and its lights (Hal's crossing's own, or the city's)
      while (c.si < c.stops.length && c.stops[c.si].s < c.s - 0.4) c.si++;
      const st = c.stops[c.si];
      if (st && c.s < st.s) {
        let go, amb;
        if (st.yieldTo !== undefined) {
          // (giving way to what's coming along the lane it turns into, up to where it joins it)
          const y = st.yieldTo, q = y ? this.W(y.start) : null;
          go = !q || !this.cars.some((o) => {
            if (o === c || o.state !== 'drive' || Math.abs(o.obj.position.y - q[2]) > 3) return false;
            const rx = o.obj.position.x - q[0], rz = o.obj.position.z - q[1], along = rx * y.d0[0] + rz * y.d0[1];
            return along > -22 && along < 6 && Math.abs(rx * y.d0[1] - rz * y.d0[0]) < 3 && Math.sin(o.pose.yaw) * y.d0[0] + Math.cos(o.pose.yaw) * y.d0[1] > 0.5;
          });
          amb = false;
        } else if (st.main) { go = this.green(st.group); amb = this.amber(st.group); }
        else { const l = this.gridLight(st.ix); go = st.group === 'NS' ? l === 'NS' : l === 'EW'; amb = st.group === 'NS' ? l === 'NSa' : l === 'EWa'; }
        const toLine = st.s - c.s;
        // (and on a green, not into the crossing with no room beyond it: a queue backed through one locked it)
        if (go && toLine < 16) {
          const q = c.path.at(st.s + 24, _p2);
          if (this.cars.some((o) => o !== c && o.state !== 'pool' && o.v < 2 && Math.abs(o.obj.position.y - q.y) < 3 && Math.hypot(o.obj.position.x - q.x, o.obj.position.z - q.z) < 4)) go = amb = false;
        }
        if (!go && !(amb && toLine < (c.v * c.v) / (2 * BRAKE) - 1)) v = Math.min(v, Math.sqrt(2 * BRAKE * Math.max(0, toLine - 0.3)));
      }
      // (one sent somewhere: braking into where it stops)
      if (c.held) v = Math.min(v, 0.6 + Math.sqrt(2 * BRAKE * 0.6 * Math.max(0, c.path.total - c.s)));
      let blockedByHal = false;
      const reach = Math.max(28, (c.v * c.v) / (2 * BRAKE) + 10), y0 = pose.y, toEnd = c.held ? c.path.total - c.s + 2.5 : Infinity;
      let lim = null, limV = Infinity;
      const look = (x, z, len, lat = 1.7, y = y0, who = null) => {
        if (Math.abs(y - y0) > 3) return; // (on the highway's deck over the street, or under it)
        const rx = x - pose.x, rz = z - pose.z, along = rx * f[0] + rz * f[1];
        if (along < 0 || along > reach || along > toEnd) return; // (nor what's past where it's to stop: the cordon's cruiser stopped short for the line it parks at, over the cross street's lane)
        if (Math.abs(rx * f[1] - rz * f[0]) > lat) return;
        const gap = along - len, vv = Math.sqrt(2 * BRAKE * Math.max(0, gap - 1.2));
        v = Math.min(v, vv);
        if (who && vv < limV) { limV = vv; lim = who; }
        return true;
      };
      for (const o of this.cars) if (o !== c && o.state !== 'pool' && o !== c.ignore) look(o.obj.position.x, o.obj.position.z, LENGTH, 1.7, o.obj.position.y, o);
      // two holding each other up (a left turn and the car coming the other way, both in the crossing): after a moment
      // the one sent out first goes on past the other
      c.limiter = limV < 0.5 ? lim : null;
      if (c.limiter && c.limiter.limiter === c && c.v < 0.1) { if ((c.mutualT = (c.mutualT ?? 0) + dt) > 1.5 && (c.uid ?? 0) < (c.limiter.uid ?? 0)) { c.ignore = c.limiter; c.ignoreT = 3; c.mutualT = 0; } } else c.mutualT = 0;
      if (c.ignore && (c.ignoreT -= dt) <= 0) c.ignore = null;
      for (const o of this.extra) if (!(o.userData?.holdR && Math.hypot(o.position.x - pose.x, o.position.z - pose.z) < o.userData.holdR)) look(o.position.x, o.position.z, LENGTH, 2.9, o.position.y); // (a hold on a stretch stops those coming, not those in it; a car across the road is wide)
      if (story.driving && this.f.car) { if (look(this.f.car.position.x, this.f.car.position.z, LENGTH, 1.7, this.f.car.position.y)) blockedByHal = c.v < 0.5; } // (his Phoenix)
      else if (Math.abs(hp.y - y0) < 2.5 && look(hp.x, hp.z, 2.9, 1.7, hp.y)) blockedByHal = c.v < 0.5;
      for (const p of people) if (p.active) look(p.pos.x, p.pos.z, 2.8, 1.7, p.pos.y);
      // speed toward what it may do, within the car's limits
      c.v += Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * (c.hwy ? 1.3 : 1) * dt, v - c.v));
      if (c.v < 0.02) c.v = Math.max(0, c.v);
      const ds = c.v * dt;
      c.s += ds;
      this.place(c);
      for (const w of c.obj.userData.wheels ?? []) w.rotation.x += ds / 0.33;
      // the front wheels steered for the way ahead, eased (read off the path's heading frame by frame,
      // the steering flickered from side to side)
      const turn = wrap(c.path.at(c.s + 2.5, _p).yaw - pose.yaw) / 2.5;
      const steer = Math.max(-0.6, Math.min(0.6, Math.atan((c.obj.userData.axle?.base ?? 2.7) * turn)));
      c.steer = (c.steer ?? 0) + (steer - (c.steer ?? 0)) * Math.min(1, dt * 6);
      for (const w of c.obj.userData.front ?? []) w.rotation.y = c.steer;
      this.lamps(c, lit, v < c.v - 0.5);
      // stood still a long while (behind a cordon, a wreck, a jam) where nobody sees it: away
      c.stuckT = c.v < 0.1 && !c.held ? (c.stuckT ?? 0) + dt : 0;
      if (c.stuckT > 40 && this.unseen(c.obj.position.x, c.obj.position.z, 160, pose.y)) { c.stuckT = 0; this.retire(c); continue; }
      // Hal standing in the road: a horn
      c.blocked = blockedByHal ? c.blocked + dt : 0;
      if (c.blocked > 2 && this.t - c.honked > 5) { c.honked = this.t; story.audio.horn?.(); }
      // a car going by close: its whoosh
      const dc = c.obj.position.distanceTo(cam.position);
      if (dc < 5 && c.v > 7 && !c.passed) { c.passed = true; story.audio.whoosh?.(0.8, 0.04 + c.v * 0.006); } else if (dc > 9) c.passed = false;
      // the end of its way: parked in Hal's lot, or gone where nobody sees
      if (c.s >= c.path.total - 0.05) {
        if (c.held) { c.state = 'held'; c.v = 0; c.onArrive?.(c); }
        else if (c.bay != null) this.park(c);
        else if (this.unseen(c.obj.position.x, c.obj.position.z, 150, pose.y)) this.retire(c);
        else c.v = 0;
      }
    }
  }

  // headlamps and tail lamps at night (brighter tails braking)
  lamps(c, on, braking) {
    const k = on * 10 + (braking ? 1 : 0);
    if (k === c.lit) return;
    c.lit = k;
    for (const { m, front } of c.lamps) {
      if (!m.material.emissive) continue;
      if (front) { m.material.emissive.setRGB(1, 0.9, 0.72); m.material.emissiveIntensity = on ? 2.6 : 0; } // (past the bloom's threshold: halos)
      else { m.material.emissive.setRGB(1, 0.08, 0.04); m.material.emissiveIntensity = (on ? 2.0 : 0) + (braking ? 1.6 : 0); }
    }
  }
}
const _p = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 }, _p2 = { x: 0, z: 0, y: 0, yaw: 0, pitch: 0 };
let UID = 0; // (each car's turn out of the pool, in order: who goes first when two hold each other up)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
