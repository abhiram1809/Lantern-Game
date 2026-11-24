// The marina (the map rework, 2026-11-24: city/Layout.js MARINA): a basin let into the bay's shore below Old Town.
// Timber pontoons on their floats: a walkway along the basin's head, joined to the quay by gangways, and five docks
// out from it (Layout.js MARINA.docks), each with its finger berths and a T-head at its end; cleats along the
// edges, piles holding it all in place. The boats tied up in the berths, riding the swell: motor cruisers and
// sailboats (sails down: they're tied up), a few big motor yachts on the T-heads. The harbour master's hut on the
// quay with its board. Downloaded (CREDITS.md) but the pontoons; everything solid (Smash), the boats too.
import * as THREE from 'three';
import { prop, piece } from '../props/Props.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeByMaterial, flatten } from './Lod.js';
import { Batch } from './Kit.js';
import { box, label } from './Building.js';
import { MARINA } from './Layout.js';
import { seeded } from './Plan.js';
import { Placed, partsOf, boundsOf, solidOf, at, ORIGIN, WATER_Y, simpler, roughParts } from './Port.js';

export const MARINA_PROPS = ['cruiser', 'sailboat', 'superyacht', 'harbourhut', 'cleat', 'bitt', 'lifering', 'parkbench', 'cityprops'];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1), _p = V(0, 0, 0), _Y = V(0, 1, 0);
const DECK = WATER_Y + 0.5, HEAD = -752; // (the pontoons' deck, floating half a metre up; the walkway along the basin's head)

// Boats riding the swell: each kind's parts (merged by material) one instanced mesh, its copies within 130 m of the
// camera as the model, out to 450 m as a copy simplified to a quarter or so (its textures' seams hold it there), and
// out to 1.6 km as one rough shape in the boat's colour; only the nearest cast shadows. Every copy's matrix worked
// out from its mooring, a slow heave, roll and pitch of its own (each frame while the camera's near).
const NEAR_BOAT = 100, FAR_BOAT = 260, LAST_BOAT = 1600;
const HULL = { cruiser: 0xe9e9e6, sailboat: 0x6e5038, superyacht: 0xeeeeea };
// the boats' textured materials' colours, for their far copies
const BOAT_COLOURS = { chrome: 0xb8bcc0, glass: 0x2a3a48, leather: 0xefefea, wire: 0x8a8a8a, lambert15: 0x6e5038, '02___': 0xf0f0ee, '04___': 0x1d3566, Default: 0xe8e8e6 };
// a kind's whole shape as one rough mesh in one colour: welded by position alone (no seams to hold it), simplified hard
function roughOf(parts, colour) {
  const geos = parts.map((p) => { const g = new THREE.BufferGeometry(); const P = p.geo.attributes.position, n = P.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = P.getX(i); a[i * 3 + 1] = P.getY(i); a[i * 3 + 2] = P.getZ(i); } g.setAttribute('position', new THREE.BufferAttribute(a, 3)); if (p.geo.index) g.setIndex(p.geo.index.clone()); g.applyMatrix4(p.M); return g.index ? g.toNonIndexed() : g; });
  const merged = mergeVertices(mergeGeometries(geos, false), 1e-3);
  const geo = simpler(merged, 0.03, 0.12);
  const out = geo.clone();
  out.computeVertexNormals();
  return [{ geo: out, mat: new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5, metalness: 0.1 }), M: new THREE.Matrix4(), cast: false }];
}
class Fleet {
  constructor(group, kinds) {
    this.group = group;
    this.kinds = new Map();
    for (const [key, o] of Object.entries(kinds)) {
      const near = partsOf(mergeByMaterial(o));
      // (the big yachts, five of them, keep their textures out to 900 m: rough, they read as clouds on the water)
      const big = key === 'superyacht';
      this.kinds.set(key, { near, far: big ? near.map((p) => ({ ...p, geo: simpler(p.geo, 0.3, 0.02), cast: false })) : roughParts(near, { ratio: 0.12, error: 0.025, colours: BOAT_COLOURS }), rough: roughOf(near, HULL[key] ?? 0xdddddd), farTo: big ? 900 * 900 : null, list: [], meshes: [] });
    }
  }
  add(key, x, z, yaw, draught) {
    const k = this.kinds.get(key), r = Math.random;
    const b = { x, z, yaw, y: WATER_Y - draught, ph: r() * 6.3, roll: 0.012 + r() * 0.02, rate: 0.5 + r() * 0.35, M: new THREE.Matrix4(), pos: V(x, 0, z).add(ORIGIN) };
    k.list.push(b);
    return b;
  }
  finish() {
    // (a sphere round all the moorings, in the group's frame)
    const pts = [...this.kinds.values()].flatMap((k) => k.list.map((b) => V(b.x, b.y, b.z)));
    this.sphere = new THREE.Sphere().setFromPoints(pts);
    this.sphere.radius += 30;
    for (const k of this.kinds.values()) {
      if (!k.list.length) continue;
      for (const [tier, parts] of [[0, k.near], [1, k.far], [2, k.rough]]) for (const p of parts) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, k.list.length);
        im.castShadow = tier === 0 && p.cast;
        im.receiveShadow = true;
        im.matrixAutoUpdate = false;
        im.count = 0;
        im.boundingSphere = this.sphere; // (the marina's: the copies move, the meshes stay culled as one)
        this.group.add(im);
        k.meshes.push({ im, M: p.M, tier });
      }
    }
    this.pose(0, V(1e9, 0, 0));
  }
  pose(t, cam) {
    const n2 = NEAR_BOAT * NEAR_BOAT, f2 = FAR_BOAT * FAR_BOAT, l2 = LAST_BOAT * LAST_BOAT;
    for (const k of this.kinds.values()) {
      for (const b of k.list) {
        const heave = Math.sin(t * b.rate + b.ph) * 0.06, roll = Math.sin(t * b.rate * 0.8 + b.ph * 1.3) * b.roll, pitch = Math.sin(t * b.rate * 0.6 + b.ph) * b.roll * 0.4;
        b.M.compose(_p.set(b.x, b.y + heave, b.z), _q.setFromEuler(_e.set(pitch, b.yaw, roll, 'YXZ')), _s);
        const d = b.pos.distanceToSquared(cam);
        b.tier = d < n2 ? 0 : d < (k.farTo ?? f2) ? 1 : d < l2 ? 2 : 3;
      }
      for (const { im, M, tier } of k.meshes) {
        let i = 0;
        for (const b of k.list) if (b.tier === tier) im.setMatrixAt(i++, _m.multiplyMatrices(b.M, M));
        im.count = i;
        im.visible = i > 0;
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

export function* buildMarina(ctx) {
  const { f, mats } = ctx, P = f.physics;
  const root = new THREE.Group();
  root.name = 'marina';
  root.position.copy(ORIGIN);
  ctx.root.add(root);
  const rnd = seeded(4401), batch = new Batch(), placed = new Placed(f, root);
  const sctx = { batch, mats, signs: ctx.signs, signUses: [], rnd };
  const solid = (x0, y0, z0, x1, y1, z1) => P.fixedBox(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).add(ORIGIN), V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2));
  const out = { root, placed };
  placed.kind('cleat', prop('cleat'), { dist: 70, shadow: 0, touch: null });
  placed.kind('ring', prop('lifering'), { dist: 90, shadow: 0, touch: { kind: 'breaks', mass: 2.5, strong: 2, stuff: 'plastic' } });
  const piles = [];

  // a pontoon from (x0, z0) to (x1, z1) (axis-aligned): its deck of boards on a float, a rubbing strake round it,
  // cleats along its edges every `every` metres, a pile at its ends
  const pontoon = (x0, z0, x1, z1, { every = 6, cleats = true } = {}) => {
    batch.add('deck', box(x0, DECK - 0.1, z0, x1, DECK, z1), null, new THREE.Color().setScalar(0.92 + rnd() * 0.08));
    batch.add('concrete', box(x0 + 0.1, WATER_Y - 0.35, z0 + 0.1, x1 - 0.1, DECK - 0.1, z1 - 0.1), null, 0x8c8a84); // (the float)
    batch.add('paint', box(x0 - 0.06, DECK - 0.28, z0 - 0.06, x1 + 0.06, DECK - 0.12, z1 + 0.06), null, 0x3d3a36); // (the strake)
    solid(x0, WATER_Y - 0.35, z0, x1, DECK, z1);
    const along = x1 - x0 > z1 - z0, len = along ? x1 - x0 : z1 - z0;
    if (cleats) for (let s = 1.5; s < len - 1; s += every) for (const side of [0, 1]) {
      const x = along ? x0 + s : side ? x1 - 0.2 : x0 + 0.2, z = along ? (side ? z1 - 0.2 : z0 + 0.2) : z0 + s;
      placed.put('cleat', at(x, DECK, z, along ? Math.PI / 2 : 0));
    }
    for (const [x, z] of [[x0 - 0.3, z0 - 0.3], [x1 + 0.3, z1 + 0.3]]) piles.push([x, z]);
  };

  // ---- the walkway along the head of the basin, the gangways up to the quay
  const xs = MARINA.docks.map((d) => d.x), wx0 = Math.min(...xs) - 22, wx1 = Math.max(...xs) + 22;
  pontoon(wx0, HEAD - 1.6, wx1, HEAD + 1.6, { every: 9 });
  for (const gx of [xs[1] + 40, xs[3] + 40]) {
    // a hinged gangway from the quay's edge down to the walkway
    const zq = -731.5, zp = HEAD + 1.6, len = zq - zp, ang = Math.atan2(DECK - 0.05, len);
    const M = new THREE.Matrix4().makeTranslation(gx, (DECK + 0.05) / 2, (zq + zp) / 2).multiply(new THREE.Matrix4().makeRotationX(ang));
    batch.add('metal', box(-1.1, -0.06, -len / 2 - 0.2, 1.1, 0.06, len / 2 + 0.2), M, 0x9a9ea2);
    for (const sx of [-1.1, 1.1]) batch.add('metal', box(sx - 0.03, 0.06, -len / 2, sx + 0.03, 1.05, len / 2), M, 0xb0b4b8);
    P.fixedBox(V(gx, (DECK + 0.05) / 2, (zq + zp) / 2).add(ORIGIN), V(1.1, 0.06, len / 2 + 0.2), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), ang));
  }
  yield;

  // ---- the docks: each out from the walkway, finger berths either side, a T-head at its end
  const fleet = new Fleet(root, { cruiser: prop('cruiser'), sailboat: prop('sailboat'), superyacht: prop('superyacht') });
  const bodies = [];
  const bnd = {};
  const boatSolid = (key, x, z, yaw, y) => {
    const b = (bnd[key] ??= boundsOf(prop(key)));
    const o = new THREE.Object3D();
    o.position.set(x, y, z).add(ORIGIN);
    o.quaternion.setFromAxisAngle(_Y, yaw);
    const it = f.smash.add(o, { kind: 'solid', stuff: key === 'sailboat' ? 'wood' : 'plastic', shrink: 0.98, glass: false, box: new THREE.Box3(V(b.min.x * 0.9, b.min.y, b.min.z * 0.92), V(b.max.x * 0.9, Math.min(b.max.y, key === 'sailboat' ? 2.4 : b.max.y * 0.8), b.max.z * 0.92)) });
    o.updateMatrixWorld(true);
    o.matrixAutoUpdate = o.matrixWorldAutoUpdate = false;
    bodies.push(it);
  };
  const BOATS = { cruiser: { draught: 0.55, beam: 2.5, len: 10.5 }, sailboat: { draught: 1.35, beam: 4.1, len: 15 }, superyacht: { draught: 2.1, beam: 8.2, len: 40 } };
  for (const d of MARINA.docks) {
    const w = 2.4, x0 = d.x - w / 2, x1 = d.x + w / 2;
    pontoon(x0, d.z0 + 2, x1, HEAD - 1.6, { every: 12, cleats: false });
    // the T-head
    pontoon(d.x - 24, d.z0 - 1.2, d.x + 24, d.z0 + 2);
    // the berths: fingers out from the dock every 6.5 m each side, a boat between each pair
    for (const side of [-1, 1]) {
      let z = HEAD - 6;
      while (z > d.z0 + 14) {
        const fx0 = side < 0 ? x0 - 11 : x1, fx1 = side < 0 ? x0 : x1 + 11;
        pontoon(fx0, z - 0.45, fx1, z + 0.45, { every: 5 });
        const berthZ = z - 4.3;
        if (berthZ < d.z0 + 14) break;
        if (rnd() < 0.74) {
          const kind = rnd() < 0.62 ? 'cruiser' : 'sailboat', B = BOATS[kind];
          // stern to the dock: its bow pointing out along the finger (+z of the model is its bow)
          const yaw = side < 0 ? -Math.PI / 2 : Math.PI / 2, bx = (side < 0 ? x0 - 0.8 : x1 + 0.8) + side * (B.len / 2), bz = berthZ + (rnd() - 0.5) * 0.4;
          fleet.add(kind, bx, bz, yaw + (rnd() - 0.5) * 0.05, B.draught);
          boatSolid(kind, bx, bz, yaw, WATER_Y - B.draught);
        }
        z -= 8.6;
      }
    }
    // a big yacht along each T-head's outer side, on most of them
    if (rnd() < 0.75) {
      const B = BOATS.superyacht, bz = d.z0 - 1.2 - 0.9 - B.beam / 2, yaw = rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      fleet.add('superyacht', d.x, bz, yaw, B.draught);
      boatSolid('superyacht', d.x, bz, yaw, WATER_Y - B.draught);
    }
    // life rings on the T-head
    placed.put('ring', at(d.x - 20, DECK + 0.4, d.z0 + 1.7, 0));
    yield;
  }
  // the piles, a steel tube at each pontoon's ends, instanced
  {
    const geo = new THREE.CylinderGeometry(0.22, 0.22, 1, 10).translate(0, 0.5, 0), mat = new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.6, metalness: 0.4 });
    const im = new THREE.InstancedMesh(geo, mat, piles.length);
    piles.forEach(([x, z], i) => { im.setMatrixAt(i, _m.compose(_p.set(x, -3, z), _q.identity(), _s.set(1, DECK + 4.4, 1))); P.fixedBox(V(x, DECK / 2, z).add(ORIGIN), V(0.22, DECK / 2 + 0.7, 0.22)); });
    _s.set(1, 1, 1);
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    root.add(im);
  }
  yield;

  // ---- the harbour master's hut on the quay at the walkway's middle, facing the basin, its board over the door;
  // benches along the quay's edge, lamps
  {
    const hx = (wx0 + wx1) / 2 - 12, hz = -716;
    const o = prop('harbourhut');
    o.position.set(hx, 0, hz).add(ORIGIN);
    o.rotation.y = Math.PI / 2; // (its long side along the quay, its deck to the water)
    f.scene.add(o);
    o.updateMatrixWorld(true);
    flatten(o);
    f.lod?.add(o, 700, { shadow: 120 });
    f.smash.solid(o, { stuff: 'wood', mesh: true });
    const F = new THREE.Matrix4().makeTranslation(hx - 4.4, 0, hz - 3.1).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    label(sctx, F, -3.2, 3.2, 3.45, 0.7, { text: 'HARBOR MASTER', sub: 'Coast City Marina · Slips · Fuel · VHF 16', style: 'board', bg: '#1d3b5a', fg: '#f3e8cf', accent: '#e8b04a', font: 'condensed', wear: 0.2 }, 0.02);
    batch.add('paint', box(hx - 4.4 - 3.3, 3.35, hz - 3.25, hx - 4.4 + 3.3, 4.25, hz - 3.12), null, 0x1d3b5a);
  }
  placed.kind('bench', piece('parkbench', /Object_2/), { dist: 120, shadow: 20, touch: { kind: 'solid', stuff: 'wood' } });
  const lampT = piece('cityprops', /low_poly012_/, { root: true });
  lampT.scale.setScalar(1.8);
  const lampG = new THREE.Group(); lampG.add(lampT);
  placed.kind('lamp', lampG, { dist: 600, shadow: 60, touch: { kind: 'breaks', mass: 45, strong: 14, stuff: 'metal', box: new THREE.Box3(V(-0.14, 0, -0.14), V(0.14, 6.5, 0.14)) } });
  placed.kind('bitt', prop('bitt'), { dist: 160, shadow: 30, touch: { kind: 'solid', stuff: 'metal' } });
  for (let x = wx0 + 6; x < wx1 - 4; x += 14) {
    placed.put('bitt', at(x, 0, -731.2, Math.PI / 2, 0.6));
    if (Math.round(x) % 28 < 14) placed.put('bench', at(x + 7, 0, -727.5, Math.PI));
    else placed.put('lamp', at(x + 7, 0, -728.5, -Math.PI / 2));
  }
  yield;

  root.add(batch.build(mats, { cell: 600 })); // (the docks one draw a material: in 120 m cells they were 24 of the street's draws from a kilometre off)
  placed.finish();
  fleet.finish();
  root.updateMatrixWorld(true);
  const centre = V((wx0 + wx1) / 2, 0, -870).add(ORIGIN);
  out.update = (dt, cam, t) => {
    placed.update(cam);
    out.tt = (out.tt ?? 9) + dt;
    if (cam.distanceTo(centre) < 450 || out.tt > 2) { fleet.pose(t, cam); out.tt = 0; }
  };
  out.fleet = fleet;
  void solidOf;
  return out;
}
