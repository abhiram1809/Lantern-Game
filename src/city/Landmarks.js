import * as THREE from 'three';
import { Batch } from './Kit.js';
import { box } from './Building.js';
import { pbrMaterial } from '../fx/Textures.js';
import { CITY, STREET_Z, FREEWAY, CHANNEL, streetX, K_MIN, K_MAX, LOT_Z } from './Plan.js';

// What makes a city besides its blocks (the user, 2026-11-19: "a flyover or a bridge or something like
// that"): the Coast Freeway, a viaduct down the street at z 1070 on piers in its middle, a ramp up off
// Ocean Avenue at its west end and down to the desert road at its east; and the flood channel, the Los
// Angeles River's kind, concrete banks down to a bed with a trickle of water, railed along its top, a
// bridge where every east-west street crosses it with deco pylons at its corners. Built once with the
// city (Stream.steps), in the lot's frame, every part of it solid.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = V(0, 0, LOT_Z);
const PAVE = 0.14;
const _q = new THREE.Quaternion(), _Z = V(0, 0, 1), _Y = V(0, 1, 0);

// the deck's height along it: up the west ramp, level across the city, down the east ramp
export const deckY = (x) => {
  const F = FREEWAY;
  if (x <= F.west || x >= F.east) return 0;
  if (x < F.westTop) return (F.deck * (x - F.west)) / (F.westTop - F.west);
  if (x > F.eastTop) return (F.deck * (F.east - x)) / (F.east - F.eastTop);
  return F.deck;
};

// a sign over the freeway: green, white letters (a canvas of its own)
function signMesh(lines, w = 9, h = 2.6) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round((1024 * h) / w);
  const g = c.getContext('2d');
  g.fillStyle = '#106a3a'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#f2f4f0'; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#f2f4f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => { g.font = `700 ${i === 0 ? 96 : 64}px "Arial Narrow", Arial, sans-serif`; g.fillText(t, c.width / 2, (c.height * (i + 0.7)) / (lines.length + 0.4)); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.06 }));
  m.castShadow = false;
  return m;
}

export function* buildLandmarks(stream) {
  const f = stream.f, P = f.physics, mats = stream.mats;
  mats.deck ??= Object.assign(pbrMaterial('asphalt_02', { repeat: [1 / 6, 1 / 6], tint: new THREE.Color(0.86, 0.84, 0.82) }), { vertexColors: true });
  const batch = new Batch(), I = new THREE.Matrix4(), bodies = [];
  const solid = (x0, y0, z0, x1, y1, z1) => bodies.push(P.fixedBox(V((x0 + x1) / 2 + ORIGIN.x, (y0 + y1) / 2, (z0 + z1) / 2 + ORIGIN.z), V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2)));
  // a box `len` long along a stretch from (xa, ya) to (xb, yb) at z, its top `top` above the line
  const slab = (key, xa, ya, xb, yb, z, w, thick, top, color, collide = false) => {
    const len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
    const geo = new THREE.BoxGeometry(len + 0.02, thick, w).translate(0, top - thick / 2, 0);
    _q.setFromAxisAngle(_Z, ang);
    const M = new THREE.Matrix4().compose(V((xa + xb) / 2, (ya + yb) / 2, z), _q, V(1, 1, 1));
    batch.add(key, geo, M, color);
    if (collide) {
      const c = V(0, top - thick / 2, 0).applyMatrix4(M).add(ORIGIN);
      bodies.push(P.fixedBox(c, V(len / 2 + 0.01, thick / 2, w / 2), _q.clone()));
    }
  };

  // ---------------------------------------------------------------- the freeway
  const F = FREEWAY, z = F.z, hw = F.half, STEP = 20;
  const nearStreet = (x) => { const k = Math.round((x - 6) / 80); return Math.abs(x - streetX(k)) < 15; };
  for (let xa = F.west; xa < F.east; xa += STEP) {
    const xb = Math.min(F.east, xa + STEP), ya = deckY(xa), yb = deckY(xb);
    // the deck (its slab, solid), the road on it, the barriers at its edges and down its middle
    slab('concrete', xa, ya, xb, yb, z, hw * 2, 1.25, -0.04, 0xb9b3a8, true);
    slab('deck', xa, ya, xb, yb, z, hw * 2 - 0.9, 0.05, 0.01, 0xffffff);
    for (const s of [-1, 1]) slab('concrete', xa, ya, xb, yb, z + s * (hw - 0.25), 0.5, 0.9, 0.88, 0xd2ccc0, true);
    slab('concrete', xa, ya, xb, yb, z, 0.6, 0.85, 0.83, 0xd2ccc0, true);
    // the lanes' lines: dashed between the lanes, solid at the edges (paint on the road)
    for (const s of [-1, 1]) {
      slab('roadpaint', xa, ya, xb, yb, z + s * (hw - 1.15), 0.14, 0.02, 0.035, 0xe8e4d8);
      slab('roadpaint', xa, ya, xb, yb, z + s * 0.75, 0.12, 0.02, 0.035, 0xd8b23a);
      for (let d = 0; d < STEP; d += 12) {
        const x0 = xa + d, x1 = Math.min(xb, x0 + 3.2), y0 = deckY(x0), y1 = deckY(x1);
        slab('roadpaint', x0, y0, x1, y1, z + s * 4.4, 0.13, 0.02, 0.036, 0xe8e4d8);
      }
    }
    if (xa % 40 === 0) yield;
  }
  // its piers down the street's middle, a bent cap under the deck on each (not in the crossings)
  for (let x = F.west + 60; x < F.east - 40; x += 38) {
    const y = deckY(x);
    if (y < 3.2 || nearStreet(x)) continue;
    const h = y - 1.25 - 1.3;
    batch.add('concrete', new THREE.CylinderGeometry(0.95, 1.1, h, 18).translate(x, h / 2, z), I, 0xc2bcb0);
    batch.add('concrete', box(x - 1.2, h, z - hw + 0.6, x + 1.2, h + 1.32, z + hw - 0.6), I, 0xbcb6aa);
    solid(x - 1.0, 0, z - 1.0, x + 1.0, h, z + 1.0);
  }
  // its lamps on the median, every 60 m: a mast, an arm out over each carriageway
  for (let x = F.westTop + 30; x < F.eastTop; x += 60) {
    const y = deckY(x) + 0.85;
    batch.add('iron', box(x - 0.13, y, z - 0.13, x + 0.13, y + 9, z + 0.13), I, 0x55585c);
    for (const s of [-1, 1]) {
      batch.add('iron', box(x - 0.07, y + 8.7, z + (s > 0 ? 0 : -3.4), x + 0.07, y + 8.86, z + (s > 0 ? 3.4 : 0)), I, 0x55585c);
      batch.add('concrete', box(x - 0.32, y + 8.55, z + s * 3.4 - 0.18, x + 0.32, y + 8.72, z + s * 3.4 + 0.18), I, 0xf4efe2);
    }
  }
  yield;
  // its signs: on gantries over the carriageways at three places
  const signs = new THREE.Group();
  const gantry = (x, east, west) => {
    const y = deckY(x);
    for (const s of [-1, 1]) batch.add('iron', box(x - 0.18, y, z + s * (hw - 0.3) - 0.18, x + 0.18, y + 7.6, z + s * (hw - 0.3) + 0.18), I, 0x8a8e92);
    batch.add('iron', box(x - 0.25, y + 7.2, z - hw + 0.2, x + 0.25, y + 7.7, z + hw - 0.2), I, 0x8a8e92);
    // each carriageway's sign faces the traffic coming (eastbound on the +z side: Traffic.js's lanes)
    const a = signMesh(east), b = signMesh(west);
    a.position.set(x - 0.3, y + 5.9, z + hw / 2);
    a.rotation.y = -Math.PI / 2;
    b.position.set(x + 0.3, y + 5.9, z - hw / 2);
    b.rotation.y = Math.PI / 2;
    signs.add(a, b);
  };
  gantry(-560, ['DOWNTOWN', 'NEXT EXIT · 1/2 MILE'], ['OCEAN AVE · BEACH', 'PIER · 1 MILE']);
  gantry(1100, ['DESERT RD · FERRIS FIELD', 'EAST · 2 MILES'], ['DOWNTOWN', 'COAST CITY · WEST']);
  gantry(2600, ['DESERT HWY · EAST', 'NEXT SERVICES 40 MI'], ['COAST CITY', 'ALL EXITS']);
  // past the city's edge, the road on over the desert
  batch.add('deck', box(F.east - 2, 0.005, z - hw + 0.4, F.east + 900, 0.03, z + hw - 0.4), I, 0xffffff);
  yield;

  // ---------------------------------------------------------------- the channel
  const C = CHANNEL, z0 = CITY.z0, z1 = CITY.z1;
  const bank = (xa, xb, ya, yb, za, zb) => {
    const len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
    const geo = new THREE.BoxGeometry(len, 0.35, zb - za).translate(0, -0.175, 0);
    const M = new THREE.Matrix4().compose(V((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2), _q.setFromAxisAngle(_Z, ang), V(1, 1, 1));
    batch.add('concrete', geo, M, 0xc8c1b4);
  };
  for (let za = z0; za < z1; za += 200) {
    const zb = Math.min(z1, za + 200);
    bank(C.x0, C.bed0, 0, -C.depth, za, zb);
    bank(C.bed1, C.x1, -C.depth, 0, za, zb);
    batch.add('concrete', box(C.bed0, -C.depth - 0.35, za, C.bed1, -C.depth, zb), I, 0xb4ad9f);
    batch.add('concrete', box(C.bed0 + 6, -C.depth, za, C.bed1 - 6, -C.depth + 0.04, zb), I, 0x8f8c80); // (the low-flow strip, stained)
  }
  // its ends closed, concrete walls
  for (const zz of [z0, z1]) batch.add('concrete', box(C.x0, -C.depth - 0.4, zz - 0.3, C.x1, 0.02, zz + 0.3), I, 0xbcb5a8);
  // the water: a trickle down the middle
  const water = new THREE.Mesh(new THREE.PlaneGeometry(C.bed1 - C.bed0 - 14, z1 - z0, 1, Math.ceil((z1 - z0) / 100)).rotateX(-Math.PI / 2).translate((C.bed0 + C.bed1) / 2, -C.depth + 0.07, (z0 + z1) / 2),
    new THREE.MeshStandardMaterial({ color: 0x31565c, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.86, envMapIntensity: 1.1 }));
  water.receiveShadow = true;
  // the bridges, and the railings along its top between them
  const streets = STREET_Z.filter((s) => s > z0 && s < z1);
  const gaps = [z0, ...streets.flatMap((s) => [s - 11, s + 11]), z1];
  for (let i = 0; i + 1 < gaps.length; i += 2) {
    const ra = gaps[i] + 0.3, rb = gaps[i + 1] - 0.3;
    if (rb - ra < 2) continue;
    for (const x of [C.x0 - 0.3, C.x1 + 0.3]) {
      for (let zz = ra; zz <= rb; zz += 2.5) batch.add('iron', box(x - 0.04, 0, zz - 0.04, x + 0.04, 1.05, zz + 0.04), I, 0x4c5054);
      batch.add('iron', box(x - 0.035, 1.0, ra, x + 0.035, 1.07, rb), I, 0x4c5054);
      batch.add('iron', box(x - 0.025, 0.55, ra, x + 0.025, 0.6, rb), I, 0x4c5054);
      solid(x - 0.06, 0, ra, x + 0.06, 1.1, rb);
    }
  }
  for (const s of streets) {
    // the deck under the street's road and pavements (its top just under the painted ground), its edges
    batch.add('concrete', box(C.x0 - 2, -1.35, s - 11, C.x1 + 2, -0.03, s + 11), I, 0xc4bdb0);
    solid(C.x0 - 2, -1.35, s - 11, C.x1 + 2, -0.03, s + 11);
    // parapets on the pavements' outer edges, with deco pylons at the corners, a lamp on each
    for (const e of [-1, 1]) {
      const zp = s + e * 10.75;
      batch.add('concrete', box(C.x0, PAVE, zp - 0.17, C.x1, PAVE + 1.0, zp + 0.17), I, 0xe2dbcd);
      batch.add('concrete', box(C.x0, PAVE + 1.0, zp - 0.24, C.x1, PAVE + 1.1, zp + 0.24), I, 0xd4ccbd);
      solid(C.x0, 0, zp - 0.17, C.x1, PAVE + 1.1, zp + 0.17);
      for (const x of [C.x0 - 0.6, C.x1 + 0.6]) {
        batch.add('concrete', box(x - 0.6, 0, zp - 0.6, x + 0.6, 2.4, zp + 0.6), I, 0xe8e0d0);
        batch.add('concrete', box(x - 0.72, 2.4, zp - 0.72, x + 0.72, 2.62, zp + 0.72), I, 0xd6cebe);
        batch.add('iron', box(x - 0.06, 2.62, zp - 0.06, x + 0.06, 4.2, zp + 0.06), I, 0x2e2f31);
        batch.add('concrete', box(x - 0.22, 4.2, zp - 0.22, x + 0.22, 4.62, zp + 0.22), I, 0xf6f0e0);
        solid(x - 0.6, 0, zp - 0.6, x + 0.6, 2.62, zp + 0.6);
      }
    }
    // the fascia's lettering band along each face (a darker course)
    for (const e of [-1, 1]) batch.add('concrete', box(C.x0, -1.0, s + e * 11 - 0.05 * e - 0.05, C.x1, -0.55, s + e * 11 - 0.05 * e + 0.05), I, 0xa9a294);
  }
  yield;

  // ---------------------------------------------------------------- into the city
  const g = new THREE.Group();
  g.name = 'landmarks';
  g.position.copy(ORIGIN);
  g.add(batch.build(mats, { cell: 400 }), signs, water);
  g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; if (o !== water && o.parent !== signs) o.castShadow = true; } });
  g.updateMatrixWorld(true);
  g.traverse((o) => { o.matrixAutoUpdate = false; });
  stream.root.add(g);
  return { group: g, bodies };
}

void K_MIN; void K_MAX; void _Y;
