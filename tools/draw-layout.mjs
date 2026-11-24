// Draws Coast City's layout (src/city/Layout.js) as a map, the way the game's map shows the ground (facing north,
// the sea on the right): the water, the beach, the hills in bands of height, the grid's blocks as Layout.js lets
// them be built, Hal's blocks, Highway 1, the bridge, the pier and the names. For checking a change to the layout
// before the city's built on it.
//   node tools/draw-layout.mjs [out.png] [metres a pixel, 3.4]
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import {
  coastAt, BAY_NORTH, BAY_SOUTH, RIVER, PORT, MARINA, BRIDGE, HIGHWAY, HILLS, HILL_ROADS, OBSERVATORY, LABELS, GRID, PARKS,
  heightAt, blockAt, waterAt, hillPlots,
} from '../src/city/Layout.js';
import { planCell, boxesOf, cityCells } from '../src/city/Plan.js';

const out = process.argv[2] ?? 'layout.png', mpp = Number(process.argv[3] ?? 3.4);
// the whole city, or (with a centre and a size after the scale) a close-up of part of it
const [cx, cz, span] = process.argv.slice(4).map(Number);
const VIEW = span ? { xl: cx + span / 2, xr: cx - span / 2, zt: cz + span * 0.4, zb: cz - span * 0.4 } : { xl: 2300, xr: -2350, zt: 3350, zb: -2150 }; // (x at the left edge and the right: the map's mirrored)
const W = Math.round((VIEW.xl - VIEW.xr) / mpp), H = Math.round((VIEW.zt - VIEW.zb) / mpp);
const X = (x) => ((VIEW.xl - x) / mpp).toFixed(1), Y = (z) => ((VIEW.zt - z) / mpp).toFixed(1);
const M = (m) => (m / mpp).toFixed(1);
const path = (pts, close = true) => `M${pts.map((p) => `${X(p.x)},${Y(p.z)}`).join('L')}${close ? 'Z' : ''}`;
const C = {
  land: '#2b3127', mainland: '#2e3428', block: '#3a4148', blockCore: '#424a53', downtown: '#4b5560', town: '#46505a', suburb: '#5a4a40', industrial: '#3d4247',
  port: '#43494f', street: '#6d757e', park: '#2f6040', cem: '#3d5a44', sea: '#173a5e', bay: '#1a4268', river: '#1f4a70', beach: '#a08f62', hal: '#7dffc8',
  highway: '#e6a33c', casing: '#5a3c12', bridge: '#d8dde2', pier: '#9a8a6a', text: '#f2f0e6', water: '#8fb6d8',
};
const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
svg.push(`<rect width="${W}" height="${H}" fill="${C.mainland}"/>`);

// the sea: everything west of the coast (on the right)
const coast = [];
for (let z = VIEW.zb - 200; z <= VIEW.zt + 200; z += 10) coast.push({ x: coastAt(z), z });
svg.push(`<path d="${path([...coast, { x: VIEW.xr - 400, z: VIEW.zt + 200 }, { x: VIEW.xr - 400, z: VIEW.zb - 200 }])}" fill="${C.sea}"/>`);
// the bay, the river, the basins
svg.push(`<path d="${path([...BAY_NORTH, ...[...BAY_SOUTH].reverse()])}" fill="${C.bay}"/>`);
const left = [], right = [];
for (let i = 0; i < RIVER.length; i++) {
  const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, w = RIVER[i].w / 2;
  left.push({ x: RIVER[i].x - (dz / L) * w, z: RIVER[i].z + (dx / L) * w }); right.push({ x: RIVER[i].x + (dz / L) * w, z: RIVER[i].z - (dx / L) * w });
}
svg.push(`<path d="${path([...left, ...right.reverse()])}" fill="${C.river}"/>`);
svg.push(`<path d="${path(PORT.basin)}" fill="${C.sea}"/>`);
for (const q of PORT.slips) svg.push(`<rect x="${X(q.x1)}" y="${Y(q.z1)}" width="${M(q.x1 - q.x0)}" height="${M(q.z1 - q.z0)}" fill="${C.sea}"/>`);
svg.push(`<path d="${path(MARINA.basin)}" fill="${C.bay}"/>`);
// the beach: from the promenade out to the sea's edge
const sand = [];
for (let z = -760; z <= 2280; z += 10) sand.push({ x: -1133, z });
svg.push(`<path d="${path([...sand, ...[...sand].reverse().map((p) => ({ x: Math.min(-1133, coastAt(p.z) - 2), z: p.z }))])}" fill="${C.beach}"/>`);

// the hills: bands of 15 m, greener as they climb
for (let z = HILLS.z0 - 300; z < HILLS.z1 + 200; z += 12) for (let x = HILLS.x0 - 420; x < HILLS.x1 + 200; x += 12) {
  const h = heightAt(x + 6, z + 6);
  if (h < 3 || waterAt(x + 6, z + 6)) continue;
  const band = Math.floor(h / 15), g = 0.3 + band * 0.07;
  svg.push(`<rect x="${X(x + 12)}" y="${Y(z + 12)}" width="${M(12.6)}" height="${M(12.6)}" fill="rgb(${Math.round(40 + 30 * g)},${Math.round(70 + 70 * g)},${Math.round(44 + 26 * g)})"/>`);
}

// the grid: its streets as the land between the blocks, the blocks Layout.js allows, and on each the buildings the
// city's generator (Plan.js) puts there, by their footprints
const streetX = (k) => 6 + 80 * k;
const blocks = cityCells(); // (the generator's own blocks: cut back from the water where it comes in, Hal's outer halves)
for (const b of blocks) if (!b.park) svg.push(`<rect x="${X(b.x1 + 12)}" y="${Y(b.z1 + 11)}" width="${M(b.x1 - b.x0 + 24)}" height="${M(b.z1 - b.z0 + 22)}" fill="${C.street}"/>`);
for (const p of PARKS) svg.push(`<rect x="${X(p.x1)}" y="${Y(p.z1)}" width="${M(p.x1 - p.x0)}" height="${M(p.z1 - p.z0)}" fill="${p.plaza ? '#4f6b52' : C.park}" rx="${p.plaza ? 0 : M(20)}"/>`);
for (const b of blocks) if (b.park === 'cemetery') svg.push(`<rect x="${X(b.x1)}" y="${Y(b.z1)}" width="${M(b.x1 - b.x0)}" height="${M(b.z1 - b.z0)}" fill="${C.cem}"/>`);
// roofs by what's there (the district first: a whole block of one kind reads as a district on the map)
const ROOF = { tower: '#8fa8bc', midrise: '#9c968c', town: '#b8a88b', deco: '#cdb7a8', house: '#b5573a', home: '#a3967f', shop: '#b8a88b', shed: '#7d868e', yard: '#55606a' };
const CONTAINERS = ['#b8503a', '#3f6f9a', '#c9a23a', '#4f8a5a', '#8a8f94', '#a04a6a'];
let nb = 0;
for (const b of blocks) {
  if (b.park) continue;
  svg.push(`<rect x="${X(b.x1)}" y="${Y(b.z1)}" width="${M(b.x1 - b.x0)}" height="${M(b.z1 - b.z0)}" fill="${b.district === 'port' ? ROOF.yard : C.block}"/>`);
  if (b.district === 'port') { // a container yard: stacks in rows, a shed at one end
    let k = 0;
    for (let z = b.z0 + 8; z < b.z1 - 30; z += 9) for (let x = b.x0 + 4; x < b.x1 - 4; x += 15) {
      svg.push(`<rect x="${X(x + 12)}" y="${Y(z + 6)}" width="${M(12)}" height="${M(6)}" fill="${CONTAINERS[(k++ * 7 + b.j * 3) % CONTAINERS.length]}"/>`);
    }
    svg.push(`<rect x="${X(b.x1 - 4)}" y="${Y(b.z1 - 4)}" width="${M(b.x1 - b.x0 - 8)}" height="${M(22)}" fill="${ROOF.shed}"/>`);
    nb++;
    continue;
  }
  for (const sp of planCell(b)) for (const bx of boxesOf(sp)) {
    nb++;
    const kind = sp.kind === 'tower' ? 'tower' : sp.bays === 0 && sp.ac === 0 ? 'shed' : sp.roof === 'hip' && sp.floors === 1 ? 'house'
      : b.district === 'waterfront' ? 'deco' : sp.floors > 4 ? 'midrise' : sp.shops?.length ? 'shop' : 'home';
    svg.push(`<rect x="${X(bx.x1)}" y="${Y(bx.z1)}" width="${M(bx.x1 - bx.x0 - 0.6)}" height="${M(bx.z1 - bx.z0 - 0.6)}" fill="${ROOF[kind]}"/>`);
  }
}
for (const q of PORT.sheds) svg.push(`<rect x="${X(q.x1)}" y="${Y(q.z1)}" width="${M(q.x1 - q.x0)}" height="${M(q.z1 - q.z0)}" fill="${ROOF.shed}"/>`);
// Hal's two blocks and his lot (city/HalsBlock.js): his building, the shops either side of the boulevard
svg.push(`<rect x="${X(60)}" y="${Y(59)}" width="${M(106)}" height="${M(463)}" fill="${C.block}"/>`);
for (const [x0, x1] of [[-46, 2], [10, 60]]) for (const [z0, z1] of [[-404, -216], [-204, -24]]) svg.push(`<rect x="${X(x1)}" y="${Y(z1)}" width="${M(x1 - x0)}" height="${M(z1 - z0)}" fill="${ROOF.shop}"/>`);
svg.push(`<rect x="${X(44)}" y="${Y(59)}" width="${M(76)}" height="${M(83)}" fill="#3a4148"/>`);
svg.push(`<rect x="${X(30)}" y="${Y(52)}" width="${M(48)}" height="${M(24)}" fill="#d9c9a5"/>`);
svg.push(`<rect x="${X(10)}" y="${Y(-24)}" width="${M(8)}" height="${M(392)}" fill="${C.street}"/>`);
svg.push(`<rect x="${X(60)}" y="${Y(59)}" width="${M(106)}" height="${M(463)}" fill="none" stroke="${C.hal}" stroke-width="2"/>`);
// the houses on the hills, on their terraces
for (const h of hillPlots()) {
  const c = Math.cos(h.yaw), sn = Math.sin(h.yaw), hw = h.w / 2, hd = h.d / 2;
  const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => ({ x: h.x + u * c + v * sn, z: h.z - u * sn + v * c }));
  svg.push(`<path d="${path(pts)}" fill="${ROOF.house}"/>`);
  nb++;
}

// the quays and the breakwater, the marina's docks
for (const q of PORT.quays) svg.push(`<rect x="${X(q.x1)}" y="${Y(q.z1)}" width="${M(q.x1 - q.x0)}" height="${M(q.z1 - q.z0)}" fill="${C.port}"/>`);
svg.push(`<path d="${path(PORT.breakwater, false)}" fill="none" stroke="${C.street}" stroke-width="${M(14)}" stroke-linecap="round"/>`);
for (const c of PORT.cranes) svg.push(`<rect x="${X(c.x + 6)}" y="${Y(c.z + 14)}" width="${M(12)}" height="${M(28)}" fill="#d9632a"/>`);
for (const d of MARINA.docks) svg.push(`<line x1="${X(d.x)}" y1="${Y(d.z0)}" x2="${X(d.x)}" y2="${Y(d.z1)}" stroke="${C.street}" stroke-width="${M(4)}"/>`);
// the hills' roads
for (const r of HILL_ROADS) svg.push(`<path d="${path(r, false)}" fill="none" stroke="${C.street}" stroke-width="${M(12)}" stroke-linejoin="round" stroke-linecap="round"/>`);
svg.push(`<circle cx="${X(OBSERVATORY.x)}" cy="${Y(OBSERVATORY.z)}" r="${M(26)}" fill="#d8d2c0"/>`);

// the road to the field, and the bridge on it
svg.push(`<line x1="${X(BRIDGE.x)}" y1="${Y(BRIDGE.z1)}" x2="${X(BRIDGE.x)}" y2="${H}" stroke="${C.street}" stroke-width="${M(14)}"/>`);
svg.push(`<line x1="${X(BRIDGE.x)}" y1="${Y(BRIDGE.z0)}" x2="${X(BRIDGE.x)}" y2="${Y(-404)}" stroke="${C.street}" stroke-width="${M(14)}"/>`);
svg.push(`<line x1="${X(BRIDGE.x)}" y1="${Y(BRIDGE.z0)}" x2="${X(BRIDGE.x)}" y2="${Y(BRIDGE.z1)}" stroke="${C.bridge}" stroke-width="${M(22)}"/>`);
for (const t of BRIDGE.towers) {
  svg.push(`<rect x="${X(BRIDGE.x + 22)}" y="${Y(t + 6)}" width="${M(44)}" height="${M(12)}" fill="#ffffff"/>`);
  for (const s of [-1, 1]) for (let k = 1; k <= 6; k++) { // (the stays, fanned along the deck)
    svg.push(`<line x1="${X(BRIDGE.x)}" y1="${Y(t)}" x2="${X(BRIDGE.x)}" y2="${Y(t + s * k * 26)}" stroke="#bfc6cc" stroke-width="1"/>`);
  }
}
// Highway 1: casing, then the deck
for (const [w, col] of [[HIGHWAY.half * 2 + 6, C.casing], [HIGHWAY.half * 2, C.highway]]) {
  svg.push(`<path d="${path(HIGHWAY.loopLine)}" fill="none" stroke="${col}" stroke-width="${M(w)}" stroke-linejoin="round"/>`);
  for (const s of HIGHWAY.spurs) svg.push(`<path d="${path(s, false)}" fill="none" stroke="${col}" stroke-width="${M(w)}" stroke-linejoin="round"/>`);
}
// the pier and its wheel
svg.push(`<rect x="${X(-1133)}" y="${Y(372 + 7)}" width="${M(412)}" height="${M(14)}" fill="${C.pier}"/>`);
svg.push(`<rect x="${X(-1420)}" y="${Y(372 + 22)}" width="${M(125)}" height="${M(44)}" fill="${C.pier}"/>`);
svg.push(`<circle cx="${X(-1454)}" cy="${Y(366)}" r="${M(15)}" fill="none" stroke="#ffd76a" stroke-width="2"/>`);

// the names
const esc = (s) => s.replace(/&/g, '&amp;');
for (const l of LABELS) {
  const fs = Math.round(11 * l.size * (3.4 / mpp)), col = l.kind === 'water' ? C.water : l.kind === 'park' ? '#9fe0a8' : l.kind === 'road' ? C.highway : C.text;
  const tr = l.turn ? ` transform="rotate(-90 ${X(l.x)} ${Y(l.z)})"` : '';
  svg.push(`<text x="${X(l.x)}" y="${Y(l.z)}" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${fs}" letter-spacing="${(fs * 0.08).toFixed(1)}" fill="${col}" text-anchor="middle" dominant-baseline="middle" stroke="#000" stroke-opacity="0.55" stroke-width="${(fs / 7).toFixed(1)}" paint-order="stroke"${tr}>${esc(l.text)}</text>`);
}
const pin = (x, z, glyph, col, name, dx = 14) => {
  if (Number(X(x)) < 0 || Number(X(x)) > W) return;
  svg.push(`<circle cx="${X(x)}" cy="${Y(z)}" r="9" fill="${col}" stroke="#000" stroke-width="1.5"/>`);
  svg.push(`<text x="${X(x)}" y="${Y(z)}" font-family="Helvetica Neue, Arial" font-weight="800" font-size="11" fill="#000" text-anchor="middle" dominant-baseline="central">${glyph}</text>`);
  if (name) svg.push(`<text x="${(Number(X(x)) + dx).toFixed(1)}" y="${Y(z)}" font-family="Helvetica Neue, Arial" font-weight="700" font-size="12" fill="${C.text}" dominant-baseline="middle" stroke="#000" stroke-opacity="0.6" stroke-width="2.5" paint-order="stroke">${esc(name)}</text>`);
};
pin(6, 20, '⌂', C.hal, 'Home');
pin(-1480, 372, '◎', '#ffd76a', 'Pier', 14);
pin(150, -850, '✝', '#b8c8b0', 'Memorial Park');
pin(OBSERVATORY.x, OBSERVATORY.z, '★', '#e8e2b8', 'Observatory');
pin(-1450, 1640, '∞', '#ff8ac8', 'Playland');
svg.push(`<text x="${X(BRIDGE.x) - 16}" y="${Number(Y((BRIDGE.towers[0] + BRIDGE.towers[1]) / 2))}" font-family="Helvetica Neue, Arial" font-weight="700" font-size="12" fill="${C.text}" text-anchor="end" dominant-baseline="middle" stroke="#000" stroke-opacity="0.6" stroke-width="2.5" paint-order="stroke">Bay Bridge</text>`);
if (!span) svg.push(`<text x="${X(BRIDGE.x)}" y="${H - 14}" font-family="Helvetica Neue, Arial" font-weight="700" font-size="13" fill="#9fd8ff" text-anchor="middle">↓ Ferris Aircraft, 4.2 km</text>`);
// the compass and a scale
svg.push(`<g transform="translate(${W - 60},60)"><circle r="26" fill="#000" fill-opacity="0.45"/><path d="M0,-22 L7,4 L0,0 L-7,4 Z" fill="#f2f0e6"/><text y="17" font-family="Helvetica Neue, Arial" font-weight="800" font-size="12" fill="#f2f0e6" text-anchor="middle">N</text></g>`);
svg.push(`<g transform="translate(24,${H - 30})"><rect width="${M(1000)}" height="6" fill="#f2f0e6"/><text y="-6" font-family="Helvetica Neue, Arial" font-weight="700" font-size="12" fill="#f2f0e6">1 km</text></g>`);
svg.push('</svg>');

const text = svg.join('\n');
writeFileSync(out.replace(/\.png$/, '.svg'), text);
await sharp(Buffer.from(text)).png().toFile(out);
console.log(`${out}: ${W}×${H}, ${blocks.length} blocks (${blocks.filter((b) => b.park).length} open), ${nb} buildings`);
