// Coast City's lie of the land, built (the map rework, 2026-11-24). City/Layout.js's shapes (the sea, the bay, the
// river, the port's basin and slips, the marina, the hills) baked once into grids: how far each point is from the
// water (a signed distance, negative in it) and which water is nearest, what kind of shore that makes (a beach, a
// bank, a quay), where the city's ground is and where the desert's, how exposed the water is to the swell, and from
// those the ground's height everywhere in and round the city: the hills (kept level under the grid's streets and
// blocks), the beach going down under the sea, the banks, the beds under the water. The city's ground and the desert
// (Ground.js, Ferris.js) and the water (Water.js) read the grids in their shaders, the physics samples the heights
// (Ferris.roadGround), the quay walls are traced along the shore (Water.js).
//
// In the lot's frame (Plan.js), as Layout.js: x east, z north; the world is this plus (0, 0, LOT_Z).
import * as THREE from 'three';
import { coastAt, BAY_NORTH, BAY_SOUTH, RIVER, PORT, MARINA, HILLS, ROAD_HALF, groundAt, hillRoads, smooth } from './Layout.js';
import { LOT_Z } from './Plan.js';
import { runSteps } from '../engine/Slice.js';

// The water's surface: a metre and a half under the streets (the quays stand that far out of it, the beach goes
// down to it). Everything that floats or splashes wants this, not 0.
export const WATER_Y = -1.5;
// the shores' kinds
export const BEACH = 1, BANK = 2, QUAY = 3;
const SEA = 1, BAY = 2, RIV = 3, PRT = 4, MAR = 5;
// the grids: near the city every 2 m (its shores exact, to a few centimetres), out to the far coasts every 12.5 m
const R_FINE = 32, R_COARSE = 254;
export const FINE = { x0: -1900, z0: -2000, step: 2, nx: 1925, nz: 2600 }; // (to x 1950, z 3200)
export const COARSE = { x0: -8500, z0: -5500, step: 12.5, nx: 1040, nz: 1040 }; // (to x 4500, z 7500)
// a beach's slope from dry sand down to the water, a bank's
export const W_BEACH = 22, W_BANK = 12;

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the world's far coast, past the city's stretch (Layout.js's, in the lot's frame)
export const farCoast = (z) => { const w = z + LOT_Z; return -6800 + 650 * Math.sin(w / 2300) + 320 * Math.sin(w / 770 + 1.3) + 140 * Math.sin(w / 260); };

// The river as the layout has it, and on (the layout's ends at the valley's edge, 5.4 km up: here it goes on
// narrowing toward the ranges, so from the air it comes down out of them rather than stopping in the desert)
const P = (x, z, w) => ({ x, z, w });
const RIVER_ON = [...RIVER, ...smooth([P(3200, 5400, 76), P(3420, 6000, 66), P(3600, 6600, 54), P(3720, 7200, 40)], 10).slice(1)];
// the shipyards' slips (Layout.js's run down into the basin)
const SLIPS = PORT.slips;
// The bay and the port's basin run on out under the sea a way (their ends in the layout are lines across open water,
// where the sea's own edge runs too: the two together read as a shoal across the bay's mouth and the port's)
const BAY_OUT = [{ x: -2600, z: -880 }, ...BAY_NORTH, ...[...BAY_SOUTH].reverse(), { x: -2600, z: -1880 }];
const BASIN_OUT = [{ x: -2300, z: 2268 }, ...PORT.basin.filter((p) => p.x > -1590), { x: -2300, z: 2888 }];
// the marina's mouth (Layout.js's basin runs out into the bay: this keeps it open whatever the shore's line does)
const MARINA_MOUTH = { x0: -952, x1: -488, z0: -1070, z1: -950 };

// ------------------------------------------------------------------------------------------------ distance fields
// A grid's sample (i, j) is at the middle of its cell: x0 + (i + 0.5) step.
const boxSdf = (b, x, z) => {
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, qx = Math.abs(x - cx) - (b.x1 - b.x0) / 2, qz = Math.abs(z - cz) - (b.z1 - b.z0) / 2;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
};
function gridWindow(G, x0, z0, x1, z1) {
  const i0 = Math.max(0, Math.floor((x0 - G.x0) / G.step - 0.5)), i1 = Math.min(G.nx - 1, Math.ceil((x1 - G.x0) / G.step - 0.5));
  const j0 = Math.max(0, Math.floor((z0 - G.z0) / G.step - 0.5)), j1 = Math.min(G.nz - 1, Math.ceil((z1 - G.z0) / G.step - 0.5));
  return { i0, i1, j0, j1, w: Math.max(0, i1 - i0 + 1), h: Math.max(0, j1 - j0 + 1) };
}
const bounds = (pts, pad) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } return { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad }; };
// each segment's distance written into T (a window's own buffer) where it's nearer than what's there, out to R
function splat(G, win, T, pts, closed, R) {
  const n = pts.length, s = G.step;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = pts[k], b = pts[(k + 1) % n], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
    const w = gridWindow(G, Math.min(a.x, b.x) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.z, b.z) + R);
    const ia = Math.max(w.i0, win.i0), ib = Math.min(w.i1, win.i1), ja = Math.max(w.j0, win.j0), jb = Math.min(w.j1, win.j1);
    for (let j = ja; j <= jb; j++) {
      const z = G.z0 + (j + 0.5) * s, row = (j - win.j0) * win.w - win.i0;
      for (let i = ia; i <= ib; i++) {
        const x = G.x0 + (i + 0.5) * s;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = a.x + dx * t - x, ez = a.z + dz * t - z, d = Math.sqrt(ex * ex + ez * ez);
        if (d < T[row + i]) T[row + i] = d;
      }
    }
  }
}
// which of a window's samples are inside a polygon (a scanline fill: exact)
function fillPoly(G, win, poly) {
  const inside = new Uint8Array(win.w * win.h), n = poly.length, xs = [];
  for (let j = win.j0; j <= win.j1; j++) {
    const z = G.z0 + (j + 0.5) * G.step;
    xs.length = 0;
    for (let k = 0; k < n; k++) { const a = poly[k], b = poly[(k + 1) % n]; if ((a.z > z) !== (b.z > z)) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z)); }
    xs.sort((p, q) => p - q);
    const row = (j - win.j0) * win.w;
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const ia = Math.max(win.i0, Math.ceil((xs[q] - G.x0) / G.step - 0.5)), ib = Math.min(win.i1, Math.floor((xs[q + 1] - G.x0) / G.step - 0.5));
      for (let i = ia; i <= ib; i++) inside[row + i - win.i0] = 1;
    }
  }
  return inside;
}
// a shape's signed field over its window folded into the grid's: the nearer water (the lower value) wins
function fold(G, out, win, S, id) {
  const { D, id: I } = out;
  for (let j = 0; j < win.h; j++) for (let i = 0; i < win.w; i++) {
    const g = (j + win.j0) * G.nx + i + win.i0, v = S[j * win.w + i];
    if (v < D[g]) { D[g] = v; I[g] = id; }
  }
}
function polygonField(G, R, poly) {
  const b = bounds(poly, R), w = gridWindow(G, b.x0, b.z0, b.x1, b.z1);
  const T = new Float32Array(w.w * w.h).fill(R);
  splat(G, w, T, poly, true, R);
  const inside = fillPoly(G, w, poly);
  for (let k = 0; k < T.length; k++) if (inside[k]) T[k] = -T[k];
  return { w, T };
}

function buildField(G, R) {
  const n = G.nx * G.nz, out = { D: new Float32Array(n).fill(R), id: new Uint8Array(n) };
  const X1 = G.x0 + G.nx * G.step, Z1 = G.z0 + G.nz * G.step;
  // the sea: west of the coast (sampled finely enough to be its polyline), its distance to that line
  {
    const zs = [], dz = Math.min(4, G.step);
    for (let z = G.z0 - R - 4; z <= Z1 + R + 4; z += dz) zs.push({ x: coastAt(z), z });
    const b = bounds(zs, R), w = gridWindow(G, G.x0 - 1, G.z0 - 1, Math.min(X1, b.x1), Z1 + 1);
    const T = new Float32Array(w.w * w.h).fill(R);
    splat(G, w, T, zs, false, R);
    for (let j = 0; j < w.h; j++) {
      const z = G.z0 + (j + w.j0 + 0.5) * G.step, c = coastAt(z);
      for (let i = 0; i < w.w; i++) if (G.x0 + (i + w.i0 + 0.5) * G.step < c) T[j * w.w + i] = -T[j * w.w + i];
    }
    fold(G, out, w, T, SEA);
  }
  // the bay
  { const f = polygonField(G, R, BAY_OUT); fold(G, out, f.w, f.T, BAY); }
  // the river: its distance from the middle less half its width there
  {
    const b = bounds(RIVER_ON, R + 80), w = gridWindow(G, b.x0, b.z0, b.x1, b.z1);
    const T = new Float32Array(w.w * w.h).fill(R), s = G.step;
    for (let k = 0; k + 1 < RIVER_ON.length; k++) {
      const a = RIVER_ON[k], c = RIVER_ON[k + 1], dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz || 1e-9, rr = Math.max(a.w, c.w) / 2 + R;
      const v = gridWindow(G, Math.min(a.x, c.x) - rr, Math.min(a.z, c.z) - rr, Math.max(a.x, c.x) + rr, Math.max(a.z, c.z) + rr);
      const ia = Math.max(v.i0, w.i0), ib = Math.min(v.i1, w.i1), ja = Math.max(v.j0, w.j0), jb = Math.min(v.j1, w.j1);
      for (let j = ja; j <= jb; j++) {
        const z = G.z0 + (j + 0.5) * s, row = (j - w.j0) * w.w - w.i0;
        for (let i = ia; i <= ib; i++) {
          const x = G.x0 + (i + 0.5) * s;
          let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z) - (a.w + (c.w - a.w) * t) / 2;
          if (d < T[row + i]) T[row + i] = d;
        }
      }
    }
    fold(G, out, w, T, RIV);
  }
  // the port: its basin, less the container quays out into it, and the shipyards' slips
  {
    const f = polygonField(G, R, BASIN_OUT), w = f.w, T = f.T;
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const x = G.x0 + (i + w.i0 + 0.5) * G.step, z = G.z0 + (j + w.j0 + 0.5) * G.step, k = j * w.w + i;
      let v = T[k];
      for (const q of PORT.quays) v = Math.max(v, -boxSdf(q, x, z));
      for (const q of SLIPS) v = Math.min(v, boxSdf(q, x, z));
      T[k] = Math.max(-R, Math.min(R, v));
    }
    // (the slips run on north of the basin's window)
    const sb = { x0: Math.min(...SLIPS.map((q) => q.x0)) - R, x1: Math.max(...SLIPS.map((q) => q.x1)) + R, z0: 2800, z1: Math.max(...SLIPS.map((q) => q.z1)) + R };
    const sw = gridWindow(G, sb.x0, sb.z0, sb.x1, sb.z1), ST = new Float32Array(sw.w * sw.h);
    for (let j = 0; j < sw.h; j++) for (let i = 0; i < sw.w; i++) {
      const x = G.x0 + (i + sw.i0 + 0.5) * G.step, z = G.z0 + (j + sw.j0 + 0.5) * G.step;
      let v = R;
      for (const q of SLIPS) v = Math.min(v, boxSdf(q, x, z));
      ST[j * sw.w + i] = Math.max(-R, v);
    }
    fold(G, out, w, T, PRT);
    fold(G, out, sw, ST, PRT);
  }
  // the marina, its mouth open to the bay
  {
    const f = polygonField(G, R, MARINA.basin), w = f.w, T = f.T;
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) {
      const x = G.x0 + (i + w.i0 + 0.5) * G.step, z = G.z0 + (j + w.j0 + 0.5) * G.step, k = j * w.w + i;
      T[k] = Math.max(-R, Math.min(T[k], boxSdf(MARINA_MOUTH, x, z)));
    }
    fold(G, out, w, T, MAR);
  }
  for (let k = 0; k < n; k++) out.D[k] = Math.max(-R, Math.min(R, out.D[k]));
  return out;
}

// The kind of shore a point of land is on, from the water nearest it and where it is: Coast City Beach the length
// of Ocean Avenue down to the bay; quays round the port, the marina, the river through town and the bay's city
// shore (a sea wall), except below the memorial park, where the bluff comes down to the water as a bank; banks
// everywhere else (the mainland's shores, the river up the valley).
export function shoreKind(id, x, z) {
  if (id === PRT || id === MAR) return QUAY;
  if (id === RIV) return z < 2300 ? QUAY : BANK;
  if (id === BAY) return z > -1300 && x < 1600 && (x < -330 || x > 720) ? QUAY : BANK;
  if (id === SEA) return z > -985 && z < 2262 ? BEACH : BANK;
  return BANK;
}

// ------------------------------------------------------------------------------------------------ the baked grids
let T = null;
export const terrainReady = () => !!T;
// built a stage at a time (city/Slice.js), or all at once by the first that needs it
export function* bakeTerrain() {
  if (T) return T;
  const t = {};
  const fine = buildField(FINE, R_FINE);
  yield;
  t.fineD = fine.D; // (Float32: the quay walls are traced on it, then it's let go: freeFine)
  t.fineId = fine.id;
  t.fineU8 = new Uint8Array(fine.D.length);
  for (let k = 0; k < fine.D.length; k++) t.fineU8[k] = Math.max(0, Math.min(255, Math.round(128 + fine.D[k] * 4)));
  yield;
  const coarse = buildField(COARSE, R_COARSE);
  t.coarseD = coarse.D;
  t.coarseId = coarse.id;
  yield;
  t.coarse = coarseChannels(coarse);
  yield;
  t.bed = roadBedGrid();
  T = t;
  return t;
}
const terrain = () => T ?? runSteps(bakeTerrain());
export const freeFine = () => { if (T) T.fineD = null; };
export const fineField = () => terrain().fineD; // (null once the walls are traced)

// The coarse grid's texture: R the distance (2 m a step, ±254), G how open the water is to the swell (the sea's 1,
// the bay's a third, the river's and the basins' none: blurred across their mouths), B the city's ground (1) or the
// desert's (0), soft at its edge.
function coarseChannels({ D, id }) {
  const G = COARSE, n = G.nx * G.nz, rgba = new Uint8Array(n * 4);
  const exp = new Float32Array(n), zone = new Float32Array(n);
  for (let k = 0; k < n; k++) exp[k] = D[k] < 0 ? (id[k] === SEA ? 1 : id[k] === BAY ? 0.35 : 0) : 0;
  // the city's ground: between the sea and the river's middle, from the bay's middle north to past the shipyards
  const top = 3250, mid = RIVER_ON.filter((p) => p.z <= top);
  const zp = [{ x: -2400, z: -1360 }, { x: 1560, z: -1360 }, ...mid.map((p) => ({ x: p.x, z: p.z })), { x: mid[mid.length - 1].x, z: top }, { x: -2400, z: top }];
  const win = gridWindow(G, -2500, -1400, 2600, top + 20), inside = fillPoly(G, win, zp);
  for (let j = 0; j < win.h; j++) for (let i = 0; i < win.w; i++) if (inside[j * win.w + i]) zone[(j + win.j0) * G.nx + i + win.i0] = 1;
  blur(exp, G.nx, G.nz, 12, 3); // (over 400 m or so: the bay opens into the sea, it doesn't stop at a line)
  blur(zone, G.nx, G.nz, 1, 2);
  for (let k = 0; k < n; k++) {
    rgba[k * 4] = Math.max(0, Math.min(255, Math.round(128 + D[k] / 2)));
    rgba[k * 4 + 1] = Math.round(exp[k] * 255);
    rgba[k * 4 + 2] = Math.round(zone[k] * 255);
    rgba[k * 4 + 3] = 255;
  }
  return { rgba, zone };
}
function blur(a, nx, nz, r, passes) {
  const tmp = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < nz; j++) { let s = 0; const o = j * nx; for (let i = -r; i <= r; i++) s += a[o + Math.max(0, Math.min(nx - 1, i))]; for (let i = 0; i < nx; i++) { tmp[o + i] = s / (2 * r + 1); s += a[o + Math.min(nx - 1, i + r + 1)] - a[o + Math.max(0, i - r)]; } }
    for (let i = 0; i < nx; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[Math.max(0, Math.min(nz - 1, j)) * nx + i]; for (let j = 0; j < nz; j++) { a[j * nx + i] = s / (2 * r + 1); s += tmp[Math.min(nz - 1, j + r + 1) * nx + i] - tmp[Math.max(0, j - r) * nx + i]; } }
  }
}

// How far each point of the hills is from a hill road's middle (Layout.hillRoads), out to 14 m: the drawn ground sinks
// a little under the roads' beds, so the roads' own surfaces (city/Hills.js, a few centimetres up) never go under it
// where its triangles cut across a bed's edge (more for the far levels, whose triangles are bigger)
// And the road's own height there (its middle's, at the point nearest): Layout.groundAt blends a point toward every
// stretch of a road within 12 m, so on a climbing road it stands up to 60 cm off the road's surface (which city/Hills.js
// lays on the road's own heights); here the ground comes to the road at the road's height.
const BED = { x0: 96, z0: 430, step: 2, nx: 600, nz: 824 }; // (to x 1296, z 2078)
function roadBedGrid() {
  const G = BED, n = G.nx * G.nz, T = new Float32Array(n).fill(14), Y = new Float32Array(n), R = 14;
  for (const road of hillRoads()) for (let k = 0; k + 1 < road.length; k++) {
    const a = road[k], b = road[k + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
    const w = gridWindow(G, Math.min(a.x, b.x) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.z, b.z) + R);
    for (let j = w.j0; j <= w.j1; j++) for (let i = w.i0; i <= w.i1; i++) {
      const x = G.x0 + (i + 0.5) * G.step, z = G.z0 + (j + 0.5) * G.step;
      let t = ((x - a.x) * dx + (z - a.z) * dz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z), g = j * G.nx + i;
      if (d < T[g]) { T[g] = d; Y[g] = a.y + (b.y - a.y) * t; }
    }
  }
  // (out past the beds the heights are the nearest's, so a blend across a cell's edge stays near the road's)
  return { T, Y };
}

// ------------------------------------------------------------------------------------------------ lookups (JS)
function bilinear(G, arr, x, z, scale, offset) {
  const u = (x - G.x0) / G.step - 0.5, v = (z - G.z0) / G.step - 0.5;
  const i = Math.max(0, Math.min(G.nx - 2, Math.floor(u))), j = Math.max(0, Math.min(G.nz - 2, Math.floor(v)));
  const fx = Math.max(0, Math.min(1, u - i)), fz = Math.max(0, Math.min(1, v - j)), k = j * G.nx + i;
  const a = arr[k] + (arr[k + 1] - arr[k]) * fx, b = arr[k + G.nx] + (arr[k + G.nx + 1] - arr[k + G.nx]) * fx;
  return (a + (b - a) * fz - offset) * scale;
}
const inGrid = (G, x, z, m = 0) => x > G.x0 + m && x < G.x0 + G.nx * G.step - m && z > G.z0 + m && z < G.z0 + G.nz * G.step - m;
// metres from the nearest water's edge: positive on land, negative in the water
export function sdfAt(x, z) {
  const t = terrain();
  let d;
  if (inGrid(COARSE, x, z, COARSE.step)) d = bilinear(COARSE, t.coarseD, x, z, 1, 0);
  else d = x - farCoast(z);
  // (near a shore the fine grid's, blended into the coarse's out where the fine one stops)
  if (Math.abs(d) < 60 && inGrid(FINE, x, z, FINE.step)) { const f = bilinear(FINE, t.fineU8, x, z, 0.25, 128); d = f + (d - f) * ss(24, 31, Math.abs(f)); }
  return d;
}
export const isWater = (x, z) => sdfAt(x, z) < 0;
// which water a point's nearest to (the fine grid's, else the coarse's)
function nearestId(x, z) {
  const t = terrain();
  const G = inGrid(FINE, x, z) ? FINE : inGrid(COARSE, x, z) ? COARSE : null;
  if (!G) return SEA;
  const i = Math.max(0, Math.min(G.nx - 1, Math.floor((x - G.x0) / G.step))), j = Math.max(0, Math.min(G.nz - 1, Math.floor((z - G.z0) / G.step)));
  return (G === FINE ? t.fineId : t.coarseId)[j * G.nx + i];
}
export const kindAt = (x, z) => shoreKind(nearestId(x, z), x, z);
// the city's ground (1) or the desert's (0), as the shaders blend it
export function zoneAt(x, z) {
  if (!inGrid(COARSE, x, z, COARSE.step)) return 0;
  return bilinear(COARSE, terrain().coarse.zone, x, z, 1, 0);
}
// how far a point is from the nearest hill road's middle (14 out past the beds), and the road's height there
export function roadBedAt(x, z) {
  if (!inGrid(BED, x, z, BED.step)) return 14;
  return bilinear(BED, terrain().bed.T, x, z, 1, 0);
}
const roadBedY = (x, z) => bilinear(BED, terrain().bed.Y, x, z, 1, 0);
export const inHills = (x, z) => x > HILLS.x0 - 300 && x < HILLS.x1 + 200 && z > HILLS.z0 - 360 && z < HILLS.z1 + 200;
// The hills' height there (Layout.groundAt: their rise, the houses' terraces, the roads' beds; level at the grid's
// edge), the roads' beds at the roads' own heights (`under` metres under them: the drawn ground's a little under the
// road's surface, the far levels more, their triangles being bigger; the collider's on it)
function hillsAt(x, z, under, wide) {
  if (!inHills(x, z)) return 0;
  const h = groundAt(x, z);
  if (!(h > 0)) return 0;
  const d = roadBedAt(x, z);
  if (d >= 13.5) return h;
  const k = 1 - ss(ROAD_HALF + 2.5 + wide, ROAD_HALF + 8 + wide, d);
  return h + (roadBedY(x, z) - under - h) * k;
}
export const hillsY = (x, z) => hillsAt(x, z, -0.04, 0); // (the road's surface is 6 cm up on its heights: city/Hills.js)
// the drawn hills (level: 0 near, 1 and 2 the far detail levels: city/Relief.js)
export const hillsDrawnY = (x, z, level = 0) => hillsAt(x, z, level ? 0.3 : 0.05, level ? 1.2 : 0);
// a shore's ground at `d` metres from the water (negative: under it). `mesh`: the drawn ground, which runs on level a
// little past a quay's edge (the ground's shader cuts it there; the wall stands in front), where the collider's
// drops at the edge (the quay's own boxes hold the last metres: Water.quayColliders)
export function bankY(kind, d, mesh = true) {
  if (d >= 0 || (kind === QUAY && mesh && d >= -1.5)) {
    if (kind === QUAY) return 0;
    if (kind === BEACH) return d >= W_BEACH ? 0 : WATER_Y * (1 - d / W_BEACH) ** 1.3;
    return d >= W_BANK ? 0 : WATER_Y * (1 - d / W_BANK) ** 2;
  }
  // under the water: each shore's own fall (a quay's sheer, a beach's gentle shelf, a bank's slope), all of them
  // going on down to the same bed out from the shore (so the shores' kinds don't step the bed between them)
  const o = -d, near = kind === QUAY ? 4.5 : kind === BEACH ? o * 0.055 : Math.min(4, o * 0.2);
  return WATER_Y - (near + (4 + 4 * ss(60, 400, o) - near) * ss(20, 70, o));
}
// The ground's height in and round the city (the lot's frame): 0 on the level, the hills, the shores going down, the
// beds under the water. `mesh` as for bankY.
export function terrainY(x, z, mesh = true, level = 0) {
  const d = sdfAt(x, z);
  let y = d < 40 ? bankY(kindAt(x, z), d, mesh) : 0;
  if (d > 0) y += mesh ? hillsDrawnY(x, z, level) : hillsY(x, z);
  return y;
}
// The ground's height for whatever stands on it, in the world's frame (Ferris's): never under the water's surface
export const groundW = (x, z) => Math.max(WATER_Y, terrainY(x, z - LOT_Z));

// ------------------------------------------------------------------------------------------------ for the shaders
let TEX = null;
export function terrainTextures() {
  if (TEX) return TEX;
  const t = terrain();
  const fine = new THREE.DataTexture(t.fineU8, FINE.nx, FINE.nz, THREE.RedFormat, THREE.UnsignedByteType);
  fine.magFilter = THREE.LinearFilter;
  fine.minFilter = THREE.LinearFilter; // (no mips: averaged, a quay's corner would pull back from its wall seen from far off)
  fine.wrapS = fine.wrapT = THREE.ClampToEdgeWrapping;
  fine.generateMipmaps = false;
  fine.needsUpdate = true;
  const coarse = new THREE.DataTexture(t.coarse.rgba, COARSE.nx, COARSE.nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  coarse.magFilter = THREE.LinearFilter;
  coarse.minFilter = THREE.LinearMipmapLinearFilter;
  coarse.generateMipmaps = true;
  coarse.wrapS = coarse.wrapT = THREE.ClampToEdgeWrapping;
  coarse.needsUpdate = true;
  TEX = { fine, coarse, uniforms: { tFine: { value: fine }, tCoarse: { value: coarse } } };
  return TEX;
}
const f1 = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
// GLSL: tSdf(p) the metres from the water's edge (p in the lot's frame), tInfo(p) the coarse grid's channels
// (g: the swell, b: the city's ground), tFar(z) the far coast
export const TERRAIN_GLSL = /* glsl */`
uniform sampler2D tFine, tCoarse;
float tFar(float z) { float w = z + ${f1(LOT_Z)}; return -6800.0 + 650.0 * sin(w / 2300.0) + 320.0 * sin(w / 770.0 + 1.3) + 140.0 * sin(w / 260.0); }
vec2 tCoarseUv(vec2 p) { return (p - vec2(${f1(COARSE.x0)}, ${f1(COARSE.z0)})) / vec2(${f1(COARSE.nx * COARSE.step)}, ${f1(COARSE.nz * COARSE.step)}); }
bool tIn(vec2 u) { return u.x > 0.0005 && u.y > 0.0005 && u.x < 0.9995 && u.y < 0.9995; }
vec4 tInfo(vec2 p) { vec2 u = tCoarseUv(p); return tIn(u) ? texture2D(tCoarse, u) : vec4(0.0, 1.0, 0.0, 1.0); }
float tSdf(vec2 p) {
  vec2 u = tCoarseUv(p);
  float d = tIn(u) ? (texture2D(tCoarse, u).r * 255.0 - 128.0) * 2.0 : p.x - tFar(p.y);
  vec2 f = (p - vec2(${f1(FINE.x0)}, ${f1(FINE.z0)})) / vec2(${f1(FINE.nx * FINE.step)}, ${f1(FINE.nz * FINE.step)});
  if (abs(d) < 60.0 && tIn(f)) { float e = (texture2D(tFine, f).r * 255.0 - 128.0) * 0.25; d = mix(e, d, smoothstep(24.0, 31.0, abs(e))); }
  return d;
}`;
export const WATER_GLSL_Y = WATER_Y.toFixed(3);
