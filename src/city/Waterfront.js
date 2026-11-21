// Coast City's waterfront (2026-11-19): Ocean Avenue's promenade the length of the city, its sea wall,
// palms, lamps and benches facing the water; the beach below it with a lifeguard tower every 300 m; and
// the pier: a ramp up off the promenade over the sand, the deck out on its piles, railings and lamps,
// the bait shop and the arcade, and at its head the seafood house and the Ferris wheel turning.
// Built once with the city (Stream.js), in the lot's frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { woodTexture } from '../fx/Textures.js';
import { Batch } from './Kit.js';
import { building, box, label } from './Building.js';
import { CITY, PROMENADE, PIER, shoreX, streetX, NS, LOT_Z } from './Plan.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORIGIN = V(0, 0, LOT_Z);
const PAVE = 0.14;
const _q = new THREE.Quaternion(), _Y = V(0, 1, 0);

export function* buildWaterfront(stream) {
  const f = stream.f, mats = stream.mats, P = f.physics;
  const batch = new Batch(), I = new THREE.Matrix4(), places = [], bodies = [], items = [], lamps = [];
  const ctx = { batch, mats, signs: stream.signs, rnd: mulberry(3121), props: false, objects: [], lamps, neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [], decals: {}, doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [] };
  const rnd = ctx.rnd;
  const solid = (x0, y0, z0, x1, y1, z1) => bodies.push(P.fixedBox(V((x0 + x1) / 2 + ORIGIN.x, (y0 + y1) / 2, (z0 + z1) / 2 + ORIGIN.z), V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2)));
  const put = (k, x, y, z, yaw, s = 1) => places.push({ k, M: new THREE.Matrix4().compose(V(x, y, z), _q.setFromAxisAngle(_Y, yaw), V(s, s, s)), s });
  const { x0: wx, x1: kx } = PROMENADE, z0 = CITY.z0 - 6, z1 = CITY.z1 + 6;
  // ---- the promenade: its paving in 100 m pieces (a box kilometres long sinks the walker), the kerb on
  // Ocean Avenue, the sea wall to sit on, gaps in it down to the sand
  for (let z = z0; z < z1; z += 100) {
    const za = z, zb = Math.min(z1, z + 100);
    batch.add('pavement', box(wx, 0, za, kx, PAVE, zb), I, 0xffffff);
    solid(wx, 0, za, kx, PAVE, zb);
    batch.add('concrete', box(kx - 0.09, 0, za, kx + 0.09, PAVE + 0.005, zb), I, 0xc9c3b8);
    batch.add('roadpaint', box(kx, 0, za, kx + 0.46, 0.02, zb), I, 0x77736d);
  }
  for (let z = z0; z < z1; z += 160) {
    const a = z + 2.2, b = Math.min(z1, z + 160 - 2.2), mid = (a + b) / 2;
    if (Math.abs(mid - PIER.z) < 90) { // (the pier's ramp goes over it)
      for (const [s0, s1] of [[a, PIER.z - PIER.w / 2 - 1], [PIER.z + PIER.w / 2 + 1, b]]) if (s1 - s0 > 1) { batch.add('concrete', box(wx - 0.45, 0, s0, wx, 0.9, s1), I, 0xd8d0c0); batch.add('concrete', box(wx - 0.5, 0.9, s0, wx + 0.05, 0.98, s1), I, 0xe6e0d4); solid(wx - 0.45, 0, s0, wx, 0.98, s1); }
      continue;
    }
    batch.add('concrete', box(wx - 0.45, 0, a, wx, 0.9, b), I, 0xd8d0c0);
    batch.add('concrete', box(wx - 0.5, 0.9, a, wx + 0.05, 0.98, b), I, 0xe6e0d4); // its cap
    solid(wx - 0.45, 0, a, wx, 0.98, b);
  }
  // palms down the promenade, lamps on Ocean Avenue's side, benches facing the sea
  for (let z = z0 + 8, n = 0; z < z1 - 8; z += 16, n++) {
    if (Math.abs(z - PIER.z) < PIER.w / 2 + 3) continue;
    put(n % 2 ? 'palm0' : 'palm1', wx + 3.2, PAVE, z, rnd() * 6, 0.66 + rnd() * 0.16);
    batch.add('iron', box(wx + 3.2 - 0.62, PAVE, z - 0.62, wx + 3.2 + 0.62, PAVE + 0.025, z + 0.62), I, 0x2a2622);
    if (n % 2 === 0) {
      put('lamp', kx - 0.5, PAVE, z + 8, Math.PI / 2);
      const head = V(kx - 0.5 + 0.95 * 1.8, PAVE + 3.45 * 1.8, z + 8);
      lamps.push({ at: head, street: true });
    }
    if (n % 3 === 1) put('bench', wx + 1.3, PAVE, z + 4, -Math.PI / 2);
  }
  yield;
  // ---- lifeguard towers on the sand, painted as the city's are
  const colours = [0x6fb5c8, 0xf2d26a, 0xe88a7a, 0x9ad0a8, 0xf2efe6];
  for (let z = z0 + 150, n = 1; z < z1 - 60; z += 300, n++) {
    if (Math.abs(z - PIER.z) < 60) continue;
    const x = (shoreX(z) + wx) / 2 - 4, c = colours[n % colours.length];
    const M = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)); // (facing the sea)
    for (const [px, pz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) batch.add('paint', box(px - 0.09, 0, pz - 0.09, px + 0.09, 1.6, pz + 0.09), M, 0xe8e4dc);
    batch.add('paint', box(-1.6, 1.6, -1.4, 1.6, 1.75, 1.6), M, 0xd8d2c6); // its deck
    batch.add('paint', box(-1.3, 1.75, -1.1, 1.3, 3.9, 1.1), M, c); // the hut
    batch.add('glass', quad(-1.0, 2.5, 1.0, 3.6, 1.11), M, 0xffffff, roomOf(M, 0, 1.75, 1.11, 2, 2.2, rnd));
    batch.add('paint', box(-1.6, 3.9, -1.5, 1.6, 4.05, 1.5), M, 0xf2efe6); // the roof
    batch.add('paint', box(-0.5, 0, 1.6, 0.5, 0.12, 5.2).applyMatrix4(new THREE.Matrix4().makeRotationX(0.42)).translate(0, 2.4, 0), M, 0xd8d2c6); // the ramp down to the sand
    label(ctx, M, -1.1, 1.1, 3.95 - 0.55, 0.45, { text: `${n}`, style: 'letters', fg: '#c0201b', font: 'condensed', wear: 0.1 }, 1.115);
    const w = V(x, 0, z).add(ORIGIN);
    bodies.push(P.fixedBox(V(w.x, 2.85, w.z), V(1.3, 1.1, 1.3)));
    bodies.push(P.fixedBox(V(w.x, 1.67, w.z), V(1.6, 0.08, 1.6)));
  }
  yield;
  // ---- the pier: a ramp over the sand, the deck on piles, the head where it widens
  const { z: pz, x0: px0, x1: px1, w: pw, deck } = PIER, rampEnd = px0 - 52, headAt = px1 + 125, hw = 22;
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture({ base: '#8f7050', planks: 10, repeat: [1 / 5, 1 / 5] }), roughness: 0.86 });
  mats.deck = wood;
  const deckY = (x) => (x > rampEnd ? PAVE + ((px0 - x) / (px0 - rampEnd)) * (deck - PAVE) : deck);
  // the ramp as one sloped slab, and its collider
  const len = Math.hypot(px0 - rampEnd, deck - PAVE), ang = Math.atan2(deck - PAVE, px0 - rampEnd);
  const RM = new THREE.Matrix4().makeTranslation((px0 + rampEnd) / 2, (deck + PAVE) / 2 - 0.12, pz).multiply(new THREE.Matrix4().makeRotationZ(-ang));
  batch.add('deck', box(-len / 2, -0.12, -pw / 2, len / 2, 0.12, pw / 2), RM, 0xffffff);
  bodies.push(P.fixedBox(V((px0 + rampEnd) / 2 + ORIGIN.x, (deck + PAVE) / 2 - 0.12, pz + ORIGIN.z), V(len / 2, 0.12, pw / 2), _q.setFromAxisAngle(V(0, 0, 1), -ang).clone()));
  // the deck (the main run and the head), its fascia
  for (const [a, b, w2] of [[rampEnd, headAt, pw / 2], [headAt, px1, hw]]) {
    batch.add('deck', box(b, deck - 0.3, pz - w2, a, deck, pz + w2), I, 0xffffff);
    batch.add('paint', box(b, deck - 0.75, pz - w2 - 0.05, a, deck - 0.3, pz + w2 + 0.05), I, 0x5a4634);
    for (let x = b; x < a; x += 60) solid(x, deck - 0.3, pz - w2, Math.min(a, x + 60), deck, pz + w2);
  }
  // the piles, in rows across it every 6 m, braced
  const pile = new THREE.CylinderGeometry(0.24, 0.28, 1, 8).translate(0, 0.5, 0), pm = new THREE.MeshStandardMaterial({ color: 0x4a3f36, roughness: 0.9 });
  const pts = [];
  for (let x = px0 - 4; x > px1 + 1; x -= 6) {
    const w2 = x < headAt ? hw : pw / 2, y = deckY(x) - 0.3;
    for (let zz = -w2 + 0.6; zz <= w2 - 0.6 + 1e-3; zz += (2 * w2 - 1.2) / Math.max(2, Math.round((2 * w2 - 1.2) / 5))) pts.push([x, zz, y]);
    if (y > 1.5) batch.add('paint', box(x - 0.08, y - 1.2, pz - w2 + 0.4, x + 0.08, y - 0.9, pz + w2 - 0.4), I, 0x4a3f36); // a brace across
  }
  const piles = new THREE.InstancedMesh(pile, pm, pts.length);
  pts.forEach(([x, zz, y], i) => piles.setMatrixAt(i, new THREE.Matrix4().compose(V(x, -4, pz + zz), _q.identity(), V(1, y + 4, 1))));
  piles.computeBoundingSphere();
  piles.castShadow = true;
  piles.receiveShadow = true;
  // railings: posts, a top rail and a middle one, either side (and round the head)
  // (a weathered white: brilliant white under the night's lamps, the bloom drew the far rail as a neon line)
  const RAIL_PAINT = 0xc9c3b5;
  const rail = (xa, za, xb, zb, ya, yb) => {
    const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 2.4));
    for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n, z = za + ((zb - za) * i) / n, y = ya + ((yb - ya) * i) / n; batch.add('paint', box(x - 0.07, y, z - 0.07, x + 0.07, y + 1.1, z + 0.07), I, RAIL_PAINT); }
    const seg = new THREE.Matrix4().makeTranslation((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2).multiply(new THREE.Matrix4().makeRotationY(-Math.atan2(zb - za, xb - xa))).multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(yb - ya, L)));
    for (const h of [1.05, 0.55]) batch.add('paint', box(-L / 2, h - 0.04, -0.05, L / 2, h + 0.04, 0.05), seg, RAIL_PAINT);
    const c = V((xa + xb) / 2, (ya + yb) / 2 + 0.6, (za + zb) / 2).add(ORIGIN);
    bodies.push(P.fixedBox(c, V(L / 2, 0.6, 0.06), _q.setFromAxisAngle(_Y, -Math.atan2(zb - za, xb - xa)).clone()));
  };
  for (const s of [-1, 1]) {
    rail(px0 - 1.2, pz + s * pw / 2, rampEnd, pz + s * pw / 2, deckY(px0 - 1.2), deck);
    rail(rampEnd, pz + s * pw / 2, headAt, pz + s * pw / 2, deck, deck);
    rail(headAt, pz + s * pw / 2, headAt, pz + s * hw, deck, deck);
    rail(headAt, pz + s * hw, px1, pz + s * hw, deck, deck);
  }
  rail(px1, pz - hw, px1, pz + hw, deck, deck);
  // lamps along it
  for (let x = rampEnd - 8; x > px1 + 6; x -= 22) for (const s of [-1, 1]) {
    const w2 = x < headAt ? hw : pw / 2;
    put('lamp', x, deck, pz + s * (w2 - 0.6), s > 0 ? Math.PI : 0, 1.3);
    const head = V(x, deck + 3.45 * 1.3, pz + s * (w2 - 0.6) - s * 0.95 * 1.3);
    lamps.push({ at: head, street: true });
  }
  yield;
  // its buildings: the bait shop and the arcade on the run, the seafood house across the end of the head
  const bld = (spec) => building(ctx, { t: 0.25, coping: 'cap', ...spec, at: V(spec.at.x, deck, spec.at.z) });
  bld({ at: { x: px0 - 126, z: pz - pw / 2 + 0.4 + 5.5 }, yaw: 0, w: 11, d: 5.5, floors: 1, gh: 3.8, parapet: 0.8, color: 0xbfe3e0, trim: 0x2f6f7a, frame: 0x2f6f7a, back: false, sides: { L: 'windows', R: 'windows' },
    shops: [{ x0: 0.4, x1: 10.6, sign: { text: 'Bait & Tackle', sub: 'Live Bait · Rods · Ice · Cold Drinks', style: 'board', bg: '#2f6f7a', fg: '#ffffff', accent: '#f2d26a', font: 'script', h: 0.8 }, awning: 2, door: 'left', frame: 0x2f6f7a, kick: 'paint', kickColor: 0x2f6f7a }] });
  bld({ at: { x: headAt - 4, z: pz + hw - 0.4 - 8 }, yaw: Math.PI, w: 22, d: 8, floors: 1, gh: 4.4, parapet: 1.2, color: 0xf6e7b0, trim: 0xd0567a, frame: 0xd0567a, back: false, sides: { L: 'windows', R: 'windows' },
    bands: [4.3, 4.5, 4.7], bandColor: 0xd0567a,
    shops: [{ x0: 0.4, x1: 21.6, sign: { text: 'PLAYLAND', sub: 'Arcade · Skee-Ball · Prizes', style: 'lightbox', bg: '#2a0f3c', fg: '#ffd23f', accent: '#ff5a9a', font: 'deco', h: 0.95 }, neon: 'OPEN', door: 'centre', frame: 0xd0567a, kick: 'checker', lit: 1 }] });
  const sea = bld({ at: { x: px1 + 1 + 16, z: pz + hw - 3 }, yaw: Math.PI / 2, w: 2 * hw - 6, d: 16, floors: 2, gh: 4.4, fh: 3.2, parapet: 1.4, color: 0xf4f0e6, trim: 0x2f6f7a, frame: 0x2f6f7a, cornice: true, belt: true,
    bays: 10, win: { w: 1.8, h: 1.7, sill: 0.7 }, sides: { L: 'windows', R: 'windows' }, back: true,
    shops: [{ x0: 4, x1: 34, sign: { text: 'The Crab Shack', sub: 'Seafood · Cocktails · Since 1946', style: 'board', bg: '#1d3b5a', fg: '#f3e8cf', accent: '#e8b04a', font: 'script', h: 1.05 }, awning: 2, door: 'centre', frame: 0x2f6f7a, kick: 'paint', kickColor: 0x1d3b5a }] });
  label(ctx, sea.M, 8, 30, sea.H + 0.2, 1.0, { text: 'THE CRAB SHACK', style: 'lightbox', bg: '#ffffff', fg: '#c0201b', accent: '#1d3b5a', font: 'deco', wear: 0.1 });
  for (const s of ctx.solids) bodies.push(P.fixedBox(s.c.clone().add(ORIGIN), s.half, s.q));
  for (const s of ctx.parapets) bodies.push(P.fixedBox(s.c.clone().add(ORIGIN), s.half, s.q));
  yield;
  // (its paint an old white: under its own bulbs and the pier's lamps a bright white burned out in the bloom)
  const WHEEL_PAINT = 0xcdc9c0;
  // ---- the Ferris wheel at the head: two rims on spokes, sixteen cars hanging between them, on A-frame
  // legs; it turns, the cars keeping level
  const wc = V(headAt - 34, deck + 18, pz - 6), R = 15;
  const legs = new Batch();
  for (const s of [-1, 1]) for (const dz of [-5, 5]) {
    const foot = V(wc.x + s * 3.2, deck, wc.z + dz * 0.9), hub = V(wc.x + s * 1.4, wc.y, wc.z), L = foot.distanceTo(hub); // (its axle east-west: the beach sees the whole round of it)
    const M = new THREE.Matrix4().lookAt(foot, hub, _Y).setPosition(foot.clone().add(hub).multiplyScalar(0.5));
    legs.add('metal', new THREE.BoxGeometry(0.5, 0.5, L), M, WHEEL_PAINT);
    bodies.push(P.fixedBox(foot.clone().add(hub).multiplyScalar(0.5).add(ORIGIN), V(0.3, 0.3, L / 2), new THREE.Quaternion().setFromRotationMatrix(M)));
  }
  legs.add('metal', new THREE.CylinderGeometry(0.6, 0.6, 3.6, 12).rotateZ(Math.PI / 2).translate(wc.x, wc.y, wc.z), I, 0xd8d8d4);
  const wheel = new Batch(), WM = new THREE.Matrix4();
  for (const s of [-1, 1]) {
    wheel.add('metal', new THREE.TorusGeometry(R, 0.16, 6, 96).translate(0, 0, s * 1.2), WM, WHEEL_PAINT);
    wheel.add('metal', new THREE.TorusGeometry(R * 0.55, 0.1, 6, 64).translate(0, 0, s * 1.2), WM, WHEEL_PAINT);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      wheel.add('metal', new THREE.BoxGeometry(0.12, R, 0.12).translate(0, R / 2, s * 1.2).applyMatrix4(new THREE.Matrix4().makeRotationZ(a)), WM, WHEEL_PAINT);
    }
  }
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; wheel.add('lamp', new THREE.SphereGeometry(0.16, 6, 4).translate(Math.cos(a) * R, Math.sin(a) * R, 0), WM, 0xfff0cc); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; wheel.add('metal', new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6).rotateX(Math.PI / 2).translate(Math.cos(a) * R, Math.sin(a) * R, 0), WM, 0xd8d8d4); }
  const legGroup = legs.build(mats, { cell: 4000 });
  const wheelGroup = new THREE.Group();
  wheelGroup.position.copy(wc);
  wheelGroup.rotation.y = Math.PI / 2; // (its rims either side of the axle: spun about the axle in its own frame)
  wheelGroup.add(wheel.build(mats, { cell: 4000 }));
  // the cars: each its own pivot on the rim, turned back each frame to hang level
  const cars = [], carCols = [0xd0567a, 0x3a6fb0, 0xf2d26a, 0x2f8a8a];
  for (let i = 0; i < 16; i++) {
    const b = new Batch(), a = (i / 16) * Math.PI * 2;
    b.add('paint', box(-1.0, -2.2, -0.95, 1.0, -0.9, 0.95), I, carCols[i % 4]);
    b.add('paint', box(-1.1, -0.95, -1.0, 1.1, -0.8, 1.0), I, 0xf2efe6);
    b.add('metal', box(-0.04, -0.9, -0.04, 0.04, 0, 0.04), I, 0xd8d8d4);
    const car = b.build(mats, { cell: 4000 });
    car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheelGroup.add(car);
    cars.push(car);
  }
  yield;
  // ---- all of it into the city, touchable
  const g = new THREE.Group();
  g.name = 'waterfront';
  g.position.copy(ORIGIN);
  g.add(batch.build(mats, { cell: 400 }), piles, legGroup, wheelGroup);
  const kit = new THREE.Group();
  g.add(kit);
  stream.placeKit(places, kit, items);
  // night: the lamps' pools on the promenade and the pier
  const night = new THREE.Group();
  const pools = lamps.map((l) => new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(l.at.x, (l.at.y > 8 ? deck : PAVE) + 0.02, l.at.z));
  if (pools.length) night.add(new THREE.Mesh(mergeGeometries(pools, false), stream.pool));
  night.visible = false;
  g.add(night);
  stream.root.add(g);
  g.updateMatrixWorld(true);
  return {
    group: g,
    update(dt) {
      const k = (wheelGroup.rotation.z -= dt * 0.045);
      for (const c of cars) c.rotation.z = -k;
    },
    setNight(k) { night.visible = k > 0.01; },
  };
}

const quad = (u0, v0, u1, v1, z) => new THREE.PlaneGeometry(u1 - u0, v1 - v0).translate((u0 + u1) / 2, (v0 + v1) / 2, z);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a pane's room for the kit's glass (as Building.js's): its cell along the pane's tangent
function roomOf(M, uc, vb, z, w, h, rnd) {
  const c = V(uc, vb, z).applyMatrix4(M), N = V(0, 0, 1).transformDirection(M), T = new THREE.Vector3().crossVectors(_Y, N).normalize();
  return { cell: [c.dot(T) - w / 2, c.y, w, h], room: [2.2, rnd() * 100, 0, 0.2] };
}
void streetX; void NS;
