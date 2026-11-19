// The Ferris Aircraft offices (the open world's interiors: "the Ferris offices"), built from the city's
// kit where the field's office box stood: two storeys of white stucco and ribbon windows with the
// company's red band, its name across the end facing the runway, the front and its doors to the staff
// lot. Inside, the lobby: terrazzo, a reception desk with the receptionist behind it, models of the
// company's jets under glass, the wall of its test pilots (Carl Ferris, Martin Jordan...), a sofa by the
// windows; the offices beyond it are staff only. One light, on while the camera's near.
import * as THREE from 'three';
import { prop, hasProp } from '../props/Props.js';
import { Batch, cityMaterials } from './Kit.js';
import { building, box, label } from './Building.js';
import { kit, shell, FLOOR } from './Interiors.js';
import { SignAtlas } from './Signs.js';
import { swingDoors, SOLID } from './HalsBlock.js';
import { flatten } from './Lod.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _in = new THREE.Vector3();

// the front faces west, onto the staff lot (yaw -90°: the front runs north to south from `at`, the
// body east of it); its north end, toward the runway, carries the name
const SPEC = { name: 'ferris', w: 22, d: 24, floors: 2, gh: 4.6, fh: 3.6, parapet: 1.0, color: 0xf2f0ea, trim: 0xe8e6e0, frame: 0x2a2e32, bands: [4.35, 4.55], bandColor: 0xa3191b,
  bays: 7, win: { w: 2.3, h: 1.8, sill: 0.8 }, ac: 0.1, sides: { R: 'windows' }, back: false,
  shops: [{ x0: 0.4, x1: 21.6, interior: 'ferris', ceil: 3.8, h: 3.4, door: 'centre', frame: 0x2a2e32, kick: 'facadeTiles', sign: { text: 'FERRIS AIRCRAFT', sub: 'Since 1946', style: 'letters', bg: '#f2f0ea', fg: '#a3191b', font: 'condensed', wear: 0.05, h: 0.8 } }] };
const PILOTS = [['CARL FERRIS', '1946'], ['MARTIN JORDAN', '1959'], ['R. KOWALSKI', '1964'], ['D. OKAFOR', '1971']];

export function buildFerrisOffice(f, at = V(83, 0, 51)) {
  const g = new THREE.Group();
  g.name = 'ferrisOffice';
  f.scene.add(g);
  const mats = cityMaterials();
  const signs = { painted: new SignAtlas(1024), lit: new SignAtlas(1024) };
  mats.sign = new THREE.MeshStandardMaterial({ map: signs.painted.texture, roughness: 0.72, alphaTest: 0.4 });
  mats.signLit = new THREE.MeshStandardMaterial({ map: signs.lit.texture, emissiveMap: signs.lit.texture, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.4 });
  mats.roofTile = mats.tile;
  let s0 = 1964;
  const ctx = { batch: new Batch(), mats, signs, rnd: () => ((s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296), props: true, objects: [], lamps: [], neon: [], shops: [], solids: [], parapets: [], hulls: [], pads: [], decals: {},
    doors: [], inside: [], spots: [], posts: [], roomLights: [], rooms: [], labels: [], goods: [] };
  const b = building(ctx, { ...SPEC, at, yaw: -Math.PI / 2 });
  // the name across the north end, in the company's red
  const FL = b.M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -SPEC.d)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  label(ctx, FL, 2.5, SPEC.d - 2.5, 5.0, 3.0, { text: 'FERRIS', style: 'letters', bg: '#f2f0ea', fg: '#a3191b', font: 'condensed', wear: 0.05 });
  const r = ctx.inside[0];
  if (r) lobby(ctx, r.M, r);
  for (const l of ctx.labels) label(ctx, l.M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, l.z)), l.u0, l.u1, l.y0, l.h, l.sign);
  g.add(ctx.batch.build(mats));
  for (const { o, kind } of ctx.objects) {
    g.add(o);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = kind !== 'decal'; m.receiveShadow = true; } });
    if (SOLID[kind]) f.smash.add(o, SOLID[kind]);
  }
  // colliders exactly their size (see HalsBlock), the parapets to stand on the roof
  for (const sd of ctx.solids) {
    const d = new THREE.Object3D();
    d.position.copy(sd.c);
    d.quaternion.copy(sd.q);
    f.scene.add(d);
    f.smash.add(d, { kind: 'solid', box: new THREE.Box3(sd.half.clone().negate(), sd.half), shrink: 1, stuff: sd.stuff, glass: false });
  }
  for (const p of ctx.parapets) f.physics.fixedBox(p.c, p.half, p.q);
  for (const d of ctx.doors) { flatten(d.pivot); g.add(d.pivot); }
  // its light, a source in the scene's pool (city/Lamps.js)
  const light = new THREE.Object3D();
  if (r) light.position.copy(V((r.x0 + r.x1) / 2, r.ceil - 0.6, r.z0 - 6).applyMatrix4(r.M));
  g.add(light);
  const src = f.lamps?.add(light, { color: 0xfff4e6, power: 0, reach: 18 });
  const inv = r?.M.clone().invert();
  return {
    group: g, ctx, spots: ctx.spots, posts: ctx.posts,
    hal: null, openers: [], onDoor: null,
    indoors(p) {
      if (!r) return false;
      _in.copy(p).applyMatrix4(inv);
      return _in.x > r.x0 && _in.x < r.x1 && _in.z < r.z0 && _in.z > r.z1 && _in.y < r.ceil + 0.2;
    },
    setNight(k) { for (const m of [mats.signLit]) m.emissiveIntensity = 0.1 + k * 0.4; },
    update(dt, t, camera) {
      swingDoors(ctx.doors, g.position, dt, this);
      if (camera && src) src.power = light.position.distanceTo(camera.position) < 40 ? 6 : 0;
    },
  };
}

// The lobby (the room's frame: x along the front, z into the building from z0)
function lobby(ctx, M, r) {
  const K = kit(ctx, M), { x0, x1, z0 } = r, ceil = Math.min(r.ceil, 3.8), mid = (x0 + x1) / 2;
  const z1 = z0 - 12; // (the lobby's part: the offices behind its back wall)
  shell(ctx, M, { ...r, z1, ceil, floorKey: 'facadeTiles', floorColor: 0xe8e4dc, wall: 0xf4f2ee, dado: 0xa3191b, dadoH: 0.12 });
  K.add('paint', box(x0, FLOOR, z1 - 0.15, x1, ceil, z1), 0xf4f2ee);
  K.solid(x0, FLOOR, r.z1, x1, ceil, z1, 'stone'); // (the offices: the rest of the floor, solid)
  // the door through to them, staff only
  const od = x1 - 2.2;
  K.add('paint', box(od - 0.5, FLOOR, z1 + 0.01, od + 0.5, FLOOR + 2.15, z1 + 0.05), 0x5a6068);
  ctx.labels.push({ M, u0: od - 0.55, u1: od + 0.55, y0: FLOOR + 2.3, h: 0.22, z: z1 + 0.06, sign: { text: 'OFFICES · STAFF ONLY', style: 'board', bg: '#f2f0ea', fg: '#a3191b', font: 'condensed', wear: 0.05 } });
  // the company's board on the back wall behind the desk
  ctx.labels.push({ M, u0: mid - 3.6, u1: mid + 3.6, y0: FLOOR + 1.6, h: 1.4, z: z1 + 0.06, sign: { text: 'FERRIS AIRCRAFT', sub: 'Coast City · Building tomorrow’s aircraft today', style: 'lightbox', bg: '#a3191b', fg: '#ffffff', accent: '#f2f0ea', font: 'condensed', wear: 0.05 }, lit: true });
  // the reception desk, its red front, the receptionist behind it
  const dz = z1 + 3.4;
  K.add('paint', box(mid - 2.6, FLOOR, dz - 0.7, mid + 2.6, FLOOR + 1.05, dz), 0xf2f0ea);
  K.add('paint', box(mid - 2.62, FLOOR + 0.12, dz - 0.005, mid + 2.62, FLOOR + 0.95, dz + 0.01), 0xa3191b);
  K.add('dark', box(mid - 2.65, FLOOR + 1.05, dz - 0.75, mid + 2.65, FLOOR + 1.1, dz + 0.04), 0x2a2e32);
  K.solid(mid - 2.65, FLOOR, dz - 0.75, mid + 2.65, FLOOR + 1.1, dz + 0.04, 'wood');
  K.add('dark', box(mid + 0.8, FLOOR + 1.1, dz - 0.5, mid + 1.1, FLOOR + 1.18, dz - 0.25), 0x141414); // the phone
  K.add('paint', box(mid - 1.2, FLOOR + 1.1, dz - 0.55, mid - 0.6, FLOOR + 1.112, dz - 0.15), 0xf2efe6); // the visitors' book
  ctx.posts.push({ who: 'ferris:reception', room: 'ferris', staff: { id: 'business-female-03', voice: 'townf1', label: 'The receptionist', lines: ['ferrisRec1', 'ferrisRec2', 'ferrisRec3'] }, at: V(mid, FLOOR, dz - 1.2).applyMatrix4(M), beat: [V(mid - 1.8, FLOOR, dz - 1.2).applyMatrix4(M), V(mid + 1.8, FLOOR, dz - 1.2).applyMatrix4(M)], face: K.yawOf });
  // the company's jets in miniature, under glass on their plinths
  const models = [['prototype', 0.026, Math.PI / 2], ['f104', 0.03, -Math.PI / 2]].filter(([n]) => hasProp(n));
  for (const [i, [name, sc, yaw]] of models.entries()) {
    const x = i ? x1 - 3.0 : x0 + 3.0, z = z0 - 4.0;
    K.add('paint', box(x - 0.55, FLOOR, z - 0.55, x + 0.55, FLOOR + 0.95, z + 0.55), 0x2a2e32);
    K.add('clearGlass', box(x - 0.5, FLOOR + 0.95, z - 0.5, x + 0.5, FLOOR + 1.6, z + 0.5), 0xffffff);
    K.add('metal', box(x - 0.52, FLOOR + 1.6, z - 0.52, x + 0.52, FLOOR + 1.63, z + 0.52), 0xc8ccd0);
    K.solid(x - 0.55, FLOOR, z - 0.55, x + 0.55, FLOOR + 1.63, z + 0.55, 'metal');
    // (centred on its plinth by its bounds: the prototype's origin isn't its middle)
    const m = K.put(name, x, FLOOR + 1.12, z, yaw, 'decal', sc), want = V(x, FLOOR + 0.98, z).applyMatrix4(M);
    m.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(V(0, 0, 0));
    m.position.add(V(want.x - c.x, want.y - bb.min.y, want.z - c.z));
    m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    ctx.labels.push({ M, u0: x - 0.4, u1: x + 0.4, y0: FLOOR + 0.6, h: 0.14, z: z + 0.56, sign: { text: i ? 'F-104 STARFIGHTER' : 'FERRIS PROTOTYPE', style: 'board', bg: '#2a2e32', fg: '#f2f0ea', font: 'condensed', wear: 0.02 } });
  }
  // the test pilots' wall on the north side: their name over a row of portraits
  const wx = x0 + 0.02, F = M.clone().multiply(new THREE.Matrix4().makeTranslation(wx, 0, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const za = z0 - 2.0, step = 1.6;
  ctx.labels.push({ M: F, u0: -(za - 0.4), u1: -(za - step * PILOTS.length + 0.6), y0: FLOOR + 2.35, h: 0.32, z: 0, sign: { text: 'FERRIS TEST PILOTS', style: 'letters', bg: '#f4f2ee', fg: '#2a2e32', font: 'condensed', wear: 0.05 } });
  PILOTS.forEach(([name, year], k) => {
    const z = za - k * step;
    // (a portrait: a dark frame, the pilot's name and year)
    ctx.labels.push({ M: F, u0: -z - 0.5, u1: -z + 0.5, y0: FLOOR + 1.2, h: 0.95, z: 0, sign: { text: name, sub: year, style: 'board', bg: '#3a3e44', fg: '#e8e2d4', accent: '#c8a050', font: 'serif', wear: 0.15 } });
  });
  const mz = za - step; // Martin Jordan's
  ctx.spots.push({ kind: 'look', line: 'halMartinPhoto', label: 'Look at the photograph', at: V(x0 + 1.2, FLOOR, mz).applyMatrix4(M), look: V(x0, FLOOR + 1.6, mz).applyMatrix4(M) });
  // a sofa and its table by the front windows, plants
  const sx = x1 - 1.0, sz0 = z0 - 1.2, sz1 = z0 - 3.6;
  K.add('paint', box(sx - 0.45, FLOOR, sz1, sx + 0.45, FLOOR + 0.42, sz0), 0x3a4a5a);
  K.add('paint', box(sx + 0.25, FLOOR + 0.42, sz1, sx + 0.45, FLOOR + 0.85, sz0), 0x3a4a5a);
  K.solid(sx - 0.45, FLOOR, sz1, sx + 0.45, FLOOR + 0.85, sz0, 'wood');
  K.add('paint', box(sx - 1.55, FLOOR + 0.4, sz1 + 0.4, sx - 0.85, FLOOR + 0.44, sz0 - 0.4), 0x5a3a24);
  K.solid(sx - 1.55, FLOOR, sz1 + 0.4, sx - 0.85, FLOOR + 0.44, sz0 - 0.4, 'wood');
  for (let i = 0; i < 3; i++) K.add('paint', box(sx - 1.45 + i * 0.18, FLOOR + 0.44, sz1 + 1.0 + i * 0.1, sx - 1.25 + i * 0.18, FLOOR + 0.455, sz1 + 1.28 + i * 0.1), [0xd8b040, 0x3a6ab0, 0xc0403a][i]);
  ctx.spots.push({ kind: 'look', line: 'halFerrisMags', label: 'The magazines', at: V(sx - 1.2, FLOOR, sz0 + 0.3).applyMatrix4(M), look: V(sx - 1.2, FLOOR + 0.45, (sz0 + sz1) / 2).applyMatrix4(M) });
  for (const [x, z] of [[x0 + 0.6, z0 - 0.8], [x1 - 0.6, z1 + 0.8]]) K.put('planter', x, FLOOR, z, 0, 'plant');
  // the lights in the ceiling
  for (let x = x0 + 2.2; x < x1 - 1.5; x += 3.6) for (let z = z0 - 2; z > z1 + 1.2; z -= 3.4) { K.add('metal', box(x - 0.7, ceil - 0.05, z - 0.14, x + 0.7, ceil - 0.01, z + 0.14), 0xe8e8e4); K.add('glow', box(x - 0.62, ceil - 0.055, z - 0.09, x + 0.62, ceil - 0.05, z + 0.09), 0xfff6e8); }
}
