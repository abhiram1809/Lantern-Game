// Hal's home (the user, 2026-11-24: "the neighborhood area of Hal Jordan's home needs change... when I look outside
// the window, it does not look like he is in that specific house... design the neighborhood to be extremely suitable
// for that area"): Las Palmas, a 1930s Spanish Revival court of flats at the head of the boulevard, where a downloaded
// red-brick block had stood alone on the lot's asphalt (an East Coast walk-up among the town's stucco and tile). Two
// wings to the lot with the court between them behind its arched gate, and the front range along the street to the
// north; built from the city's kit (Building.js), so it's weathered and lit room by room at night as the block round
// it is, in the block's batches (city/HalsBlock.js calls `homeSteps` with its ctx). Round it: the court's fountain,
// palm and pots, beds of bougainvillea along the wings, the front lawn to the street, the garages down the lot's east
// side, the trash pen, the lot's lights, a wall round it all.
//
// In the lot's frame (LOT, scenes/Ferris.js): x east, z north (the lot is south of the house, the boulevard runs
// south from it). Hal's flat is upstairs in the east wing, its window over the lot and down the boulevard: `WINDOW`,
// where the flat's window looks out from (scenes/Bedroom.js draws the city as it is from there).
import * as THREE from 'three';
import { building, box, label } from './Building.js';
import { prop, piece } from '../props/Props.js';
import { greenMaterials } from './Parks.js';
import { PALM_KINDS } from './Palms.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const I = new THREE.Matrix4();

// the house: its wings' fronts to the lot at z 15, their backs (and the front range's) at 32, the range's front to
// the street at 49; the wings x 6..24 each side of the court; floors of 3.4 and 3.1 m (the flat's floor is 3.4 m
// over the lot, as the bedroom's street was always laid: Bedroom.js)
export const HOME = { front: 15, back: 32, street: 49, court: 6, side: 24, gh: 3.4, fh: 3.1 };
// where he goes in: the west wing's door, the court's gate, the east wing's (Roam.js "Go home")
export const HOME_DOORS = [-15, 0, 15];
// his window: upstairs in the east wing's front, its fourth bay from the east corner (x 11.4), just outside the
// glass at his eye's height; `out` the way it looks (south, over the lot)
// the lot's asphalt (Ferris.buildApartmentLot; city/Ground.js leaves its ground to it) and the trash pen's dumpster
export const HOME_LOT = { x0: -31, x1: 36.4, z0: -17, z1: 13 }, HOME_TRASH = V(-27.6, 0, -16.2);
export const WINDOW = { at: V(11.4, HOME.gh + 1.5, HOME.front - 0.08), out: V(0, 0, -1) };

const STUCCO = 0xf3e9d6, TRIM = 0x7b4a2c, FRAME = 0x3f2a1d, DOOR = 0x4a2d1c, CAP = 0xa65a3a;
const WIN = { w: 1.1, h: 1.5, arch: 0.35, sill: 0.85 };
const COMMON = { floors: 2, gh: HOME.gh, fh: HOME.fh, roof: 'hip', pitch: 0.44, color: STUCCO, trim: TRIM, frame: FRAME, win: WIN, ac: 0.1, bars: true, belt: false };

// the three ranges as the kit's specs. A wing faces south (yaw π: its front runs west from `at`), the front range
// north (yaw 0: east from `at`); each goes back from its front by `d`.
export const HOME_SPECS = [
  { ...COMMON, name: 'home_w', at: V(-HOME.court, 0, HOME.front), yaw: Math.PI, w: HOME.side - HOME.court, d: HOME.back - HOME.front, bays: 5,
    balconies: [1], balconyBays: [0, 4], groundWindows: [2.2, 5.6, 12.4, 15.8], sides: { L: 'windows', R: 'windows' }, home: true, // (home: the sides' ground floor has its windows, the court's walls with them)
    entries: [{ x: 9, w: 1.9, h: 2.9, arch: 0.95, color: DOOR }] },
  { ...COMMON, name: 'home_e', at: V(HOME.side, 0, HOME.front), yaw: Math.PI, w: HOME.side - HOME.court, d: HOME.back - HOME.front, bays: 5,
    balconies: [1], balconyBays: [0, 4], groundWindows: [2.2, 5.6, 12.4, 15.8], sides: { L: 'windows', R: 'windows' }, home: true, // (home: the sides' ground floor has its windows, the court's walls with them)
    entries: [{ x: 9, w: 1.9, h: 2.9, arch: 0.95, color: DOOR }] },
  { ...COMMON, name: 'home_n', at: V(-HOME.side, 0, HOME.street), yaw: 0, w: HOME.side * 2, d: HOME.street - HOME.back, bays: 13,
    balconies: [1], balconyBays: [2, 4, 8, 10], groundWindows: [3.7, 7.4, 11.1, 14.8, 18.5, 29.5, 33.2, 36.9, 40.6, 44.3], sides: { L: 'windows', R: 'windows' },
    entries: [{ x: 24, w: 2.4, h: 3.1, arch: 1.2, color: DOOR }],
    label: { text: 'LAS PALMAS', sub: 'Apartments · 1931', style: 'letters', bg: '#f3e9d6', fg: '#6b3a22', font: 'serif', wear: 0.25 } },
];

// The house and its grounds into the block (`ctx`: HalsBlock's, its batch in the lot's frame): a step at a time
export function* homeSteps(ctx) {
  const { batch } = ctx, mats = ctx.mats;
  if (!mats.lawn) greenMaterials(mats); // (the lawn, the hedges, the fountain's water: the block's own from here)
  const add = (o, kind) => { ctx.objects.push({ o, kind }); return o; };
  const solid = (x0, y0, z0, x1, y1, z1, stuff = 'stone') => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q: new THREE.Quaternion(), stuff });
  const pad = (x0, y0, z0, x1, y1, z1) => ctx.pads.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2) });
  ctx.homeTrees = [];
  // (a tree for the city's tree field, Ferris: its trunk's collider here, as the streamed city's are)
  const tree = (kind, x, z, h, w, tint) => {
    ctx.homeTrees.push({ kind, x, y: 0, z, h, w, tint });
    if (kind !== 'shrub') { const r = Math.max(0.12, 0.035 * w * 0.9); ctx.pads.push({ c: V(x, 1.6, z), half: V(r, 1.6, r) }); }
  };
  const palm = (x, y, z, sc, kind = 1) => { const p = piece('palms', PALM_KINDS[kind], { root: true }); p.userData.palm = kind; p.position.set(x, y, z); p.rotation.y = ctx.rnd() * 6; p.scale.setScalar(sc); add(p, 'palm'); };

  // ---- the house
  const built = HOME_SPECS.map((s) => ({ s, b: building(ctx, s) }));
  for (const { s, b } of built) if (s.label) label(ctx, b.M, s.w / 2 - 3.4, s.w / 2 + 3.4, s.gh + 0.12, 0.62, s.label);
  yield;

  // ---- the court: its gate to the lot (a wall across between the wings, an arch in a raised middle, the name over
  // it), its floor of tiles, the fountain in the middle, a palm, pots, a bench, the residents' mailboxes
  const C = HOME.court, F = HOME.front;
  const gate = new THREE.Shape();
  gate.moveTo(-C, 0); gate.lineTo(-1.3, 0); gate.lineTo(-1.3, 2.25);
  gate.absarc(0, 2.25, 1.3, Math.PI, 0, true);
  gate.lineTo(1.3, 0); gate.lineTo(C, 0); gate.lineTo(C, 2.7); gate.lineTo(2.4, 2.7); gate.lineTo(2.4, 3.55);
  gate.quadraticCurveTo(0, 4.55, -2.4, 3.55); gate.lineTo(-2.4, 2.7); gate.lineTo(-C, 2.7); gate.closePath();
  const gw = new THREE.ExtrudeGeometry(gate, { depth: 0.42, bevelEnabled: false, curveSegments: 18 }).translate(0, 0, F - 0.21);
  batch.add('stucco', gw, I, STUCCO);
  for (const [a, b] of [[-C, -2.4], [2.4, C]]) batch.add('concrete', box(a, 2.7, F - 0.28, b, 2.8, F + 0.28), I, CAP); // (its coping)
  batch.add('concrete', box(-1.42, 0, F - 0.26, 1.42, 0.12, F + 0.26), I, 0xd8cdb8); // the threshold, the court's floor's height
  solid(-C, 0, F - 0.21, -1.3, 2.7, F + 0.21); solid(1.3, 0, F - 0.21, C, 2.7, F + 0.21); solid(-2.4, 3.3, F - 0.21, 2.4, 3.9, F + 0.21);
  label(ctx, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, F - 0.215), -1.5, 1.5, 3.62, 0.38, { text: 'LAS PALMAS', style: 'letters', bg: '#f3e9d6', fg: '#6b3a22', font: 'serif', wear: 0.3 });
  // the lantern over the arch, lit at night
  batch.add('iron', box(-0.03, 3.32, F - 0.55, 0.03, 3.38, F - 0.2), I, 0x1f1d1b);
  batch.add('lamp', box(-0.12, 2.98, F - 0.66, 0.12, 3.3, F - 0.44), I, 0xffe2b0);
  ctx.lamps.push({ at: V(0, 3.1, F - 0.55), k: 0.35, glow: mats.lamp });
  // the court's floor: terracotta tiles, a step up from the lot (he walks it: a pad)
  batch.add('patio', box(-C, 0, F + 0.21, C, 0.12, HOME.back), I, 0x9a8878); // (the tiles' own terracotta, faded: full strength it read as a red sheet)
  pad(-C, 0, F + 0.21, C, 0.12, HOME.back);
  // the fountain: a tiled octagonal basin, its bowl on a column, water in both
  const fz = (F + HOME.back) / 2 + 0.6, ring = (r0, r1, y0, y1, seg = 8) => new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, true).translate(0, (y0 + y1) / 2, fz);
  batch.add('facadeTiles', ring(1.7, 1.7, 0.12, 0.62), I, 0x2f6a8a);
  const inner = ring(1.58, 1.58, 0.12, 0.6).scale(-1, 1, 1); inner.deleteAttribute('normal'); // (turned inside out: its normals from the turned faces)
  batch.add('stucco', inner, I, STUCCO);
  batch.add('concrete', new THREE.CylinderGeometry(1.8, 1.8, 0.1, 8).translate(0, 0.66, fz), I, CAP); // (the basin's rim)
  batch.add('water', new THREE.CylinderGeometry(1.56, 1.56, 0.02, 24).translate(0, 0.5, fz), I, 0xffffff);
  batch.add('stucco', new THREE.CylinderGeometry(0.16, 0.24, 0.9, 10).translate(0, 0.95, fz), I, STUCCO);
  batch.add('stucco', new THREE.LatheGeometry([[0.12, 0], [0.55, 0.12], [0.78, 0.3], [0.8, 0.36], [0.74, 0.36]].map(([a, b]) => new THREE.Vector2(a, b)), 20).translate(0, 1.38, fz), I, STUCCO);
  batch.add('water', new THREE.CylinderGeometry(0.72, 0.72, 0.02, 20).translate(0, 1.71, fz), I, 0xffffff);
  solid(-1.75, 0.12, fz - 1.75, 1.75, 0.66, fz + 1.75);
  ctx.fountain = V(0, 1.75, fz); // (its sound and spray: Ferris)
  // beds down the court's sides, a kerb's height, shrubs and bougainvillea in them against the walls
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -C : C - 1.0, x1 = sx < 0 ? -C + 1.0 : C, z0 = F + 1.9, z1 = HOME.back - 0.3;
    batch.add('lawn', box(x0, 0.12, z0, x1, 0.3, z1), I, 0xb8a27a);
    batch.add('concrete', box(sx < 0 ? x1 - 0.12 : x0, 0.12, z0, sx < 0 ? x1 : x0 + 0.12, 0.34, z1), I, 0xd6cdbd);
    batch.add('concrete', box(x0, 0.12, z0, x1, 0.34, z0 + 0.12), I, 0xd6cdbd);
    pad(x0, 0.12, z0, x1, 0.34, z1);
    for (let z = z0 + 0.9; z < z1 - 0.6; z += 2.1 + ctx.rnd() * 0.6) tree('shrub', sx * (C - 0.5), z, 1.3 + ctx.rnd() * 0.9, 1.1 + ctx.rnd() * 0.4, ctx.rnd() < 0.4 ? [2.3, 0.55, 1.6] : undefined);
  }
  // two palms in the court's north corners, pots, a bench to sit by the fountain
  palm(-3.9, 0.12, HOME.back - 2.6, 0.74, 0); palm(3.6, 0.12, HOME.back - 2.2, 0.66, 1);
  for (const [x, z] of [[-5.3, F + 1.0], [5.3, F + 1.0], [5.3, HOME.back - 1.0], [-5.3, fz]]) { const p = prop('planter'); p.position.set(x, 0.12, z); p.rotation.y = ctx.rnd() * 6; add(p, 'plant'); }
  const bench = prop('parkbench'); bench.position.set(4.2, 0.12, fz + 0.4); bench.rotation.y = -Math.PI / 2; add(bench, 'bench');
  // the mailboxes, a bank of brass doors on the gate's inside face east of the arch
  batch.add('paint', box(2.0, 1.05, F + 0.21, 3.6, 1.75, F + 0.36), I, 0x5a3a24);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) batch.add('metal', box(2.06 + i * 0.385, 1.1 + j * 0.31, F + 0.36, 2.4 + i * 0.385, 1.36 + j * 0.31, F + 0.38), I, 0xb89a52);
  yield;

  // ---- the beds along the wings to the lot: kerbed, raised a kerb's height, bougainvillea against the walls, the
  // walks up to the two doors (and their stoops)
  const kerb = 0xd6cdbd, bedZ = [F - 2.4, F];
  for (const sx of [-1, 1]) {
    const walk = [sx * 15 - 0.95, sx * 15 + 0.95].sort((a, b) => a - b), [a, b] = sx < 0 ? [-HOME.side, -C - 0.2] : [C + 0.2, HOME.side];
    for (const [u0, u1] of [[a, walk[0]], [walk[1], b]]) {
      batch.add('lawn', box(u0 + 0.12, 0, bedZ[0] + 0.12, u1 - 0.12, 0.13, bedZ[1]), I, 0xc8b48a); // (the bed's soil and its groundcover)
      batch.add('concrete', box(u0, 0, bedZ[0], u1, 0.16, bedZ[0] + 0.12), I, kerb);
      for (const u of [u0, u1 - 0.12]) batch.add('concrete', box(u, 0, bedZ[0], u + 0.12, 0.16, bedZ[1]), I, kerb);
      pad(u0, 0, bedZ[0], u1, 0.16, bedZ[1]);
      for (let x = u0 + 1.2; x < u1 - 0.8; x += 2.3 + ctx.rnd() * 0.8) tree('shrub', x, F - 0.9, 1.5 + ctx.rnd() * 0.7, 1.4 + ctx.rnd() * 0.5, ctx.rnd() < 0.7 ? [2.3, 0.55, 1.6] : [2.5, 0.62, 0.6]); // (bougainvillea: magenta, and coral)
    }
    // the walk and the stoop: two steps up to the door
    batch.add('concrete', box(walk[0], 0, bedZ[0], walk[1], 0.08, F - 0.9), I, 0xcfc6b4);
    batch.add('patio', box(walk[0] - 0.2, 0, F - 0.9, walk[1] + 0.2, 0.16, F - 0.45), I, 0xc98a62);
    batch.add('patio', box(walk[0] - 0.2, 0, F - 0.45, walk[1] + 0.2, 0.32, F), I, 0xc98a62);
    pad(walk[0] - 0.2, 0, F - 0.9, walk[1] + 0.2, 0.16, F - 0.45); pad(walk[0] - 0.2, 0, F - 0.45, walk[1] + 0.2, 0.32, F);
    // the porch light by each door
    const lx = sx * 15 + 1.35;
    batch.add('iron', box(lx - 0.1, 2.25, F - 0.16, lx + 0.1, 2.6, F - 0.02), I, 0x1f1d1b);
    batch.add('lamp', box(lx - 0.08, 2.28, F - 0.18, lx + 0.08, 2.56, F - 0.06), I, 0xffe2b0);
    ctx.lamps.push({ at: V(lx, 2.4, F - 0.35), k: 0.25, glow: mats.lamp });
  }
  yield;

  // ---- the front lawn to the street (z 49 to the pavement at 59): a walk up to the front door, a low wall along the
  // pavement with its gate, two palms, hedges along the house
  const S = HOME.street, P = 58.8;
  for (const [a, b] of [[-HOME.side, -1.2], [1.2, HOME.side]]) {
    batch.add('lawn', box(a, 0.0, S + 1.4, b, 0.13, P - 0.5), I, 0xffffff);
    pad(a, 0, S + 1.4, b, 0.13, P - 0.5);
    batch.add('hedge', box(a + 0.3, 0.13, S + 0.3, b - 0.3, 1.0, S + 1.2), I, 0x2f4a22);
    solid(a + 0.3, 0.13, S + 0.3, b - 0.3, 1.0, S + 1.2, 'wood');
  }
  batch.add('pavers', box(-1.2, 0, S, 1.2, 0.1, P), I, 0xe0d2b8);
  pad(-1.2, 0, S, 1.2, 0.1, P);
  for (const [a, b] of [[-HOME.side - 0.2, -1.6], [1.6, HOME.side + 0.2]]) {
    batch.add('stucco', box(a, 0, P - 0.5, b, 0.75, P - 0.2), I, STUCCO);
    batch.add('concrete', box(a - 0.04, 0.75, P - 0.54, b + 0.04, 0.83, P - 0.16), I, CAP);
    solid(a, 0, P - 0.5, b, 0.85, P - 0.2);
  }
  for (const x of [-1.6, 1.6]) { batch.add('stucco', box(x - 0.25, 0, P - 0.6, x + 0.25, 1.35, P - 0.1), I, STUCCO); batch.add('concrete', box(x - 0.3, 1.35, P - 0.65, x + 0.3, 1.43, P - 0.05), I, CAP); }
  palm(-12, 0.13, P - 4.2, 0.95, 1); palm(13.5, 0.13, P - 3.6, 0.88, 0);
  tree('oak', 19, P - 5, 6.5, 6);
  yield;

  // ---- the side yards between the house and the walls: grass, and gravel by the garages for the bins
  for (const [x0, z0, x1, z1] of [[-31.0, HOME.front - 2.4, -HOME.side - 0.05, P - 0.5], [HOME.side + 0.05, HOME.front - 2.4, 43.0, P - 0.5]]) {
    batch.add('lawn', box(x0, 0, z0, x1, 0.13, z1), I, 0xffffff);
    pad(x0, 0, z0, x1, 0.13, z1);
  }
  batch.add('gravel', box(36.4, 0, -0.2, 43.0, 0.06, HOME.front - 2.4), I, 0xffffff);
  // ---- the lot's edges: a stucco wall round the property west and east, the garages down the east side, the trash
  // pen in the south-west corner, two lights on poles over the bays
  for (const [x, z0, z1] of [[-31.2, -22, S + 9.8], [43.2, -22, S + 9.8]]) {
    batch.add('stucco', box(x - 0.18, 0, z0, x + 0.18, 1.7, z1), I, 0xeadfc8);
    batch.add('concrete', box(x - 0.24, 1.7, z0, x + 0.24, 1.78, z1), I, CAP);
    solid(x - 0.18, 0, z0, x + 0.18, 1.82, z1);
    for (let z = z0 + 0.3; z < z1; z += 6.2) batch.add('stucco', box(x - 0.28, 0, z - 0.25, x + 0.28, 1.95, z + 0.25), I, 0xeadfc8);
  }
  // the garages: six doors in a stucco range facing the lot, a flat roof with its tile-capped parapet
  const GX = 36.4, GD = 6.6, g0 = -20, gn = 6, gb = 3.3; // (its line, depth, south end, doors, a door's bay)
  batch.add('stucco', box(GX, 0, g0, GX + GD, 3.0, g0 + gn * gb), I, 0xeadfc8);
  batch.add('roofing', box(GX - 0.3, 3.0, g0 - 0.3, GX + GD + 0.1, 3.12, g0 + gn * gb + 0.3), I, 0x9a948a);
  batch.add('concrete', box(GX - 0.36, 3.0, g0 - 0.36, GX - 0.2, 3.24, g0 + gn * gb + 0.36), I, CAP);
  for (let i = 0; i < gn; i++) {
    const z = g0 + i * gb + 0.35, dz = gb - 0.7;
    batch.add('shutter', box(GX - 0.02, 0, z, GX + 0.02, 2.35, z + dz), I, [0xc8bfae, 0x8a9a8a, 0xb8a88e, 0x9aa6b0][i % 4]);
    batch.add('paint', box(GX - 0.06, 2.35, z - 0.08, GX + 0.02, 2.47, z + dz + 0.08), I, TRIM);
    batch.add('dark', box(GX - 0.05, 0.9, z + dz / 2 - 0.12, GX - 0.02, 0.96, z + dz / 2 + 0.12), I, 0x2a2622); // its handle
  }
  solid(GX, 0, g0, GX + GD, 3.2, g0 + gn * gb);
  // the trash pen: three stucco walls round the building's dumpster, by the lot's south-west corner
  const TX = HOME_TRASH.x, TZ = HOME_TRASH.z + 0.2;
  for (const [a, b, c, d] of [[TX - 2.2, TZ - 1.6, TX + 2.2, TZ - 1.35], [TX - 2.2, TZ - 1.6, TX - 1.95, TZ + 1.6], [TX + 1.95, TZ - 1.6, TX + 2.2, TZ + 1.6]]) {
    batch.add('stucco', box(a, 0, b, c, 1.6, d), I, 0xeadfc8);
    batch.add('concrete', box(a - 0.04, 1.6, b - 0.04, c + 0.04, 1.68, d + 0.04), I, CAP);
    solid(a, 0, b, c, 1.7, d);
  }
  // the lot's two lights over the bays (the kit's street lamp on its pole, its arm out over the cars)
  for (const [x, z, yaw] of [[-20, 9.5, Math.PI], [20, 9.5, Math.PI]]) {
    const l = piece('cityprops', /low_poly012_/, { root: true });
    l.position.set(x, 0, z);
    l.rotation.y = yaw;
    l.scale.setScalar(1.5);
    add(l, 'lamp');
    ctx.lamps.push({ at: V(x + Math.sin(yaw) * 0.95 * 1.5, 3.45 * 1.5, z + Math.cos(yaw) * 0.95 * 1.5), k: 0.8, street: true, glow: mats.lamp });
  }
  // the neighbours' and the residents' things about the lot: a basketball hoop on the garages, wheelie bins by them
  batch.add('metal', box(GX - 0.05, 2.9, -2.6, GX + 0.05, 3.9, -1.4), I, 0xe8e8e4); // the backboard
  batch.add('metal', new THREE.TorusGeometry(0.23, 0.012, 6, 18).rotateX(Math.PI / 2).translate(GX - 0.32, 3.05, -2.0), I, 0xd8501e);
  for (const z of [g0 + gn * gb + 1.2, g0 + gn * gb + 2.1]) { const w = prop('wheelie'); w.position.set(GX + 1.2, 0, z); w.rotation.y = -Math.PI / 2 + (ctx.rnd() - 0.5) * 0.4; add(w, 'wheelie'); }
  tree('oak', 39.5, 30, 7.5, 7); tree('oak', -27.5, 30, 6.8, 6.5); tree('cypress', -28.5, 5, 9, 2.6); tree('cypress', -28.5, -4, 8.5, 2.5);
}

