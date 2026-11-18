// A Coast City building, made from a description: walls with real openings (their reveals, frames,
// sills and glass with rooms behind), shop fronts (kick plates, mullions, transoms, doors, signs,
// awnings, barrel-tile pent roofs, shutters, neon in the window), entries, balconies, belt courses
// and cornices, copings and mission gables, pilasters, streamline bands, downpipes, and a roof with its
// clutter or a tiled hip. Everything goes into the block's Batch (Kit.js); the props it places (window
// AC units, condensers, dishes) come back in `ctx.objects`.
//
// The building's frame: its front along +x from its front-left corner, facing +z, the body behind
// (z from -d to 0), y up. A wall's own frame: u along it, v up, its face toward +z.
import * as THREE from 'three';
import { prop } from '../props/Props.js';
import { drawSign, FONT_OF } from './Signs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _up = V(0, 1, 0);
const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const ry = (a) => new THREE.Matrix4().makeRotationY(a);
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));

// UVs in metres by the face's direction (boxes, cylinders: anything not built with its own UVs)
export function metreUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    else if (ax >= az) { uv[i * 2] = p.getZ(i); uv[i * 2 + 1] = p.getY(i); }
    else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
// a box by its extents in a frame
export function box(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return metreUV(g);
}
function cyl(r, h, x, y0, z, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(x, y0 + h / 2, z);
  return metreUV(g);
}

// an opening's outline (in the wall's u, v), counter-clockwise: a rectangle, or arched over the top
function outline({ u, v, w, h, arch = 0 }, inset = 0) {
  const pts = [], x0 = u + inset, x1 = u + w - inset, y0 = v + inset, y1 = v + h - inset;
  if (!arch) return [V(x0, y0, 0), V(x1, y0, 0), V(x1, y1, 0), V(x0, y1, 0)];
  const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, rise = Math.min(arch, r), spring = y1 - rise;
  pts.push(V(x0, y0, 0), V(x1, y0, 0), V(x1, spring, 0));
  // a segmental arch (rise up to the half width: a full semicircle)
  const R = (r * r + rise * rise) / (2 * rise), cy = spring + rise - R, a0 = Math.atan2(spring - cy, r);
  for (let i = 1; i < 12; i++) { const a = a0 + (Math.PI - 2 * a0) * (i / 12); pts.push(V(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0)); }
  pts.push(V(x0, spring, 0));
  return pts;
}
const toPath = (pts, Kind = THREE.Path) => { const p = new Kind(); p.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y); p.closePath(); return p; };

// a frame round an opening: its outline less the outline inset by `fw`, `depth` deep, its face at z
function frameRing(o, fw, depth, z) {
  const shape = toPath(outline(o), THREE.Shape);
  shape.holes.push(toPath(outline(o, fw).reverse()));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z - depth);
  return g;
}
function pane(o, inset, z) {
  const g = new THREE.ShapeGeometry(toPath(outline(o, inset), THREE.Shape));
  g.translate(0, 0, z);
  return g;
}

// ------------------------------------------------------------------------------------- walls
// One wall: a slab `t` thick with its openings cut through, and what fills them. F takes the
// wall's frame into the block's. spec: { len, top (or `profile`: points along the top from u 0 to
// len), t, mat, color, openings: [...], trim, frame, coping, belt, cornice }
function wall(ctx, F, s) {
  const { batch } = ctx, t = s.t ?? 0.3;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(s.len, 0);
  const prof = s.profile ?? [V(s.len, s.top, 0), V(0, s.top, 0)];
  for (const p of prof) shape.lineTo(p.x, p.y);
  shape.closePath();
  for (const o of s.openings ?? []) shape.holes.push(toPath(outline(o).reverse()));
  const slab = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  slab.translate(0, 0, -t);
  shadeReveals(batch.add(s.mat, slab, F, s.color), slab);
  for (const o of s.openings ?? []) fill(ctx, F, s, o, t);
  // horizontal lines: a belt over the ground floor, a cornice under the parapet, the coping on top
  const trim = s.trim ?? 0xd9d2c2;
  if (s.belt) batch.add('concrete', box(-0.02, s.belt - 0.07, 0, s.len + 0.02, s.belt + 0.07, 0.07), F, trim);
  if (s.cornice) {
    batch.add('concrete', box(-0.04, s.cornice - 0.12, 0, s.len + 0.04, s.cornice + 0.08, 0.14), F, trim);
    batch.add('concrete', box(-0.02, s.cornice - 0.26, 0, s.len + 0.02, s.cornice - 0.12, 0.07), F, trim);
  }
  coping(ctx, F, prof, s, t);
  for (const b of s.bands ?? []) batch.add('metal', box(0, b - 0.025, 0, s.len, b + 0.025, 0.06), F, s.bandColor ?? 0xc9ccd0);
}

// the reveals (an opening's sides, the slab's edges) a shade darker: less sky reaches into them
function shadeReveals(g, local) {
  const n = local.attributes.normal, c = g.attributes.color;
  for (let i = 0; i < n.count; i++) if (Math.abs(n.getZ(i)) < 0.5) c.setXYZ(i, c.getX(i) * 0.84, c.getY(i) * 0.84, c.getZ(i) * 0.84);
}
// a flat pane of glass facing +z (the room shader needs a face's normal to be horizontal)
function quad(u0, v0, u1, v1, z) { const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0); g.translate((u0 + u1) / 2, (v0 + v1) / 2, z); return g; }

// The coping along a wall's top, following its profile: a concrete cap, or barrel tiles
function coping(ctx, F, prof, s, t) {
  if (s.coping === 'none') return;
  const pts = prof.map((p) => V(p.x, p.y, 0)).reverse();
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const ang = Math.atan2(dy, dx);
    const g = s.coping === 'tile' ? barrels(L + 0.04, t + 0.24, 0.035) : box(0, 0, -t - 0.06, L + 0.04, 0.07, 0.06);
    if (s.coping === 'tile') g.translate(0, 0, 0.12);
    const m = mul(F, tr(a.x - 0.02 * Math.cos(ang), a.y + 0.002, 0), new THREE.Matrix4().makeRotationZ(ang));
    ctx.batch.add(s.coping === 'tile' ? 'tile' : 'concrete', g, m, s.coping === 'tile' ? 0xffffff : s.trim ?? 0xd9d2c2);
  }
}

// Barrel tiles as a surface: rows of half-round caps across `w`, `d` deep (toward -z), each `lift`
// proud: a real silhouette at the eaves and along a coping, the tile texture over it
function barrels(w, d, lift, pitch = 0.24) {
  const nx = Math.max(2, Math.round(w / pitch) * 6), nz = 2;
  const g = new THREE.PlaneGeometry(w, d, nx, nz).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2;
    p.setY(i, lift * Math.abs(Math.sin((Math.PI * x) / pitch)));
    p.setX(i, x);
    p.setZ(i, p.getZ(i) - d / 2);
  }
  g.computeVertexNormals();
  return metreUV(g);
}

// ---------------------------------------------------------------------------------- openings
function fill(ctx, F, s, o, t) {
  if (o.kind === 'shop') return storefront(ctx, F, s, o, t);
  if (o.kind === 'door') return entry(ctx, F, s, o, t);
  return window_(ctx, F, s, o, t);
}

function roomFor(F, uc, vbase, roomW, roomH, depth, kind, lit) {
  const c = V(uc, vbase, 0).applyMatrix4(F);
  const N = V(0, 0, 1).transformDirection(F), T = new THREE.Vector3().crossVectors(_up, N).normalize();
  return { cell: [c.dot(T) - roomW / 2, c.y, roomW, roomH], room: [depth, Math.random() * 100, kind, lit] };
}

function window_(ctx, F, s, o, t) {
  const { batch } = ctx, z = -t * 0.42, frame = o.frame ?? s.frame ?? 0xe8e4da;
  batch.add('paint', frameRing(o, 0.065, 0.07, z), F, frame);
  const room = roomFor(F, o.u + o.w / 2, o.floor ?? o.v - 0.9, Math.max(o.w + 1.6, 3.2), o.roomH ?? 3.1, 4.2, o.room ?? 0, o.lit ?? 0.45);
  batch.add('glass', pane(o, 0.06, z - 0.035), F, 0xffffff, room);
  // a double-hung window: the meeting rail, and a mullion down a wide one
  if (!o.arch || o.h > o.w * 1.2) batch.add('paint', box(o.u + 0.06, o.v + o.h * 0.5 - 0.03, z - 0.05, o.u + o.w - 0.06, o.v + o.h * 0.5 + 0.03, z), F, frame);
  if (o.w > 1.5) batch.add('paint', box(o.u + o.w / 2 - 0.03, o.v + 0.06, z - 0.05, o.u + o.w / 2 + 0.03, o.v + o.h - 0.06, z), F, frame);
  if (o.sill !== false) batch.add('concrete', box(o.u - 0.07, o.v - 0.07, -0.12, o.u + o.w + 0.07, o.v, 0.06), F, s.trim ?? 0xd9d2c2);
  if (o.lintel) batch.add('concrete', box(o.u - 0.1, o.v + o.h, -0.02, o.u + o.w + 0.1, o.v + o.h + 0.2, 0.04), F, s.trim ?? 0xd9d2c2);
  // iron bars over a ground-floor window (rejas), set into the reveal
  if (o.bars) {
    const n = Math.max(3, Math.round(o.w / 0.13)), iron = 0x1d1c1b;
    for (let i = 1; i < n; i++) { const u = o.u + (o.w * i) / n; batch.add('iron', box(u - 0.009, o.v + 0.02, -0.06, u + 0.009, o.v + o.h - 0.02, -0.04), F, iron); }
    for (const y of [o.v + 0.12, o.v + o.h * 0.5, o.v + o.h - 0.1]) batch.add('iron', box(o.u + 0.02, y - 0.012, -0.065, o.u + o.w - 0.02, y + 0.012, -0.035), F, iron);
  }
  // a window AC unit in its lower sash, sticking out over the street
  if (o.ac && ctx.props) {
    const ac = prop('ac_window');
    ac.position.set(o.u + o.w / 2, o.v + 0.05, z + 0.04);
    ac.applyMatrix4(F);
    ac.rotation.setFromRotationMatrix(F);
    ac.rotation.y += Math.PI; // its front (the grille) out of the wall
    ctx.objects.push({ o: ac, kind: 'ac' });
  }
}

// a door: wood or steel on the street, glazed onto a balcony; its frame, a transom over it, a lamp
function entry(ctx, F, s, o, t) {
  const { batch } = ctx, z = -t * 0.55, col = o.color ?? 0x5a3a22, b = o.v;
  batch.add('paint', frameRing(o, 0.08, 0.1, z + 0.02), F, o.frame ?? s.trim ?? 0xd9d2c2);
  const dh = Math.min(o.h - (o.arch ? o.w * 0.5 : 0) - 0.08, 2.2);
  const leaf = { u: o.u + 0.08, w: o.w - 0.16 };
  if (o.balcony) { // French doors: two glazed leaves
    const room = roomFor(F, o.u + o.w / 2, o.floor ?? b, 3.6, 3.1, 4.2, 0, 0.5);
    batch.add('glass', quad(leaf.u + 0.06, b + 0.12, leaf.u + leaf.w - 0.06, b + dh - 0.06, z - 0.045), F, 0xffffff, room);
    for (const [a0, a1] of [[leaf.u, leaf.u + 0.07], [leaf.u + leaf.w / 2 - 0.035, leaf.u + leaf.w / 2 + 0.035], [leaf.u + leaf.w - 0.07, leaf.u + leaf.w]]) batch.add('paint', box(a0, b, z - 0.06, a1, b + dh, z - 0.02), F, o.frame ?? s.frame ?? 0xe8e4da);
    batch.add('paint', box(leaf.u, b, z - 0.06, leaf.u + leaf.w, b + 0.12, z - 0.02), F, o.frame ?? s.frame ?? 0xe8e4da);
    return;
  }
  batch.add(o.steel ? 'metal' : 'paint', box(leaf.u, b + 0.02, z - 0.06, leaf.u + leaf.w, b + dh, z - 0.02), F, col);
  if (!o.steel) { // two raised panels and a little window, a brass knob
    for (const [a, c] of [[0.15, 0.9], [1.05, 1.55]]) batch.add('paint', box(leaf.u + 0.12, b + a, z - 0.02, leaf.u + leaf.w - 0.12, b + c, z), F, new THREE.Color(col).multiplyScalar(0.85));
    batch.add('glass', quad(leaf.u + 0.2, b + 1.68, leaf.u + leaf.w - 0.2, b + dh - 0.12, z - 0.017), F, 0xffffff, roomFor(F, leaf.u + leaf.w / 2, b, 2, 3, 3, 0, 0.6));
    batch.add('metal', box(leaf.u + leaf.w - 0.16, b + 1.0, z - 0.01, leaf.u + leaf.w - 0.1, b + 1.06, z + 0.04), F, 0xb08d4a);
  } else batch.add('metal', box(leaf.u + leaf.w - 0.22, b + 0.98, z - 0.02, leaf.u + leaf.w - 0.1, b + 1.02, z + 0.05), F, 0x9a9a9a);
  if (o.h - dh > 0.25) batch.add('glass', pane({ ...o, v: b + dh + 0.06, h: o.h - dh - 0.06 }, 0.08, z - 0.04), F, 0xffffff, roomFor(F, o.u + o.w / 2, b, 3, 3, 4, 0, 0.7));
  batch.add('concrete', box(o.u, b, -t, o.u + o.w, b + 0.03, 0.12), F, 0xb9b2a6); // the step
  if (o.lamp !== false) { // a lamp over it, lit at night
    const y = b + o.h + 0.25;
    batch.add('metal', box(o.u + o.w / 2 - 0.09, y - 0.02, 0, o.u + o.w / 2 + 0.09, y + 0.22, 0.06), F, 0x2b2620);
    batch.add('lamp', box(o.u + o.w / 2 - 0.06, y + 0.02, 0.06, o.u + o.w / 2 + 0.06, y + 0.18, 0.15), F, 0xfff0cc);
    ctx.lamps.push({ at: V(o.u + o.w / 2, y + 0.1, 0.3).applyMatrix4(F), k: 0.5 });
  }
}

// A shop front: the opening glazed from a kick plate up, mullions and a transom, a door, the sign
// board over it, and whatever it wears: an awning, a tiled pent roof, a shutter, neon in the window
function storefront(ctx, F, s, o, t) {
  const { batch } = ctx, z = -0.26, fr = o.frame ?? 0x3b3027, kickH = o.kickH ?? 0.45, trans = Math.min(2.45, o.h - 0.5);
  const u0 = o.u, u1 = o.u + o.w, top = o.h;
  // the kick plate, the recess floor
  batch.add(o.kick ?? 'patio', box(u0, 0, z - 0.02, u1, kickH, z + 0.05), F, o.kickColor ?? 0xffffff);
  batch.add(o.kick === 'checker' ? 'checker' : 'patio', box(u0, 0, -t, u1, 0.15, 0.02), F, 0xffffff); // (level with the pavement, 14 cm)
  // panels: the door at one end (or in the middle), glass between mullions about 1.6 m apart
  const dw = 1.0, du = o.door === 'left' ? u0 + 0.1 : o.door === 'centre' ? (u0 + u1 - dw) / 2 : u1 - dw - 0.1;
  const cuts = [u0, du, du + dw, u1].sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a < 0.05) continue;
    if (Math.abs(a - du) < 1e-6) { spans.push({ a, b, door: true }); continue; }
    const n = Math.max(1, Math.round((b - a) / 1.7));
    for (let k = 0; k < n; k++) spans.push({ a: a + ((b - a) * k) / n, b: a + ((b - a) * (k + 1)) / n });
  }
  // a shop you can see into has clear glass (its room is real: Interiors.js); one you can walk into, a
  // door that swings
  const see = o.interior || o.clear, gk = see ? 'clearGlass' : 'glass';
  const room = see ? null : roomFor(F, (u0 + u1) / 2, 0, o.w + 0.4, o.roomH ?? 3.8, o.depth ?? 7, o.room ?? 1, o.lit ?? 0.95);
  const bar = (a0, v0, a1, v1, d = 0.07) => batch.add('metal', box(a0, v0, z - d, a1, v1, z + 0.01), F, fr);
  for (const sp of spans) {
    if (sp.door && o.interior) {
      o.doorSpan = [sp.a, sp.b];
      door(ctx, F, sp.a, sp.b, trans, z, fr, du - u0 < u1 - du - dw ? 1 : -1, o.interior);
      bar(sp.a - 0.02, 0, sp.a + 0.01, trans, 0.09); bar(sp.b - 0.01, 0, sp.b + 0.02, trans, 0.09); // its jambs
    } else if (sp.door) {
      batch.add(gk, quad(sp.a + 0.07, 0.12, sp.b - 0.07, trans - 0.07, z - 0.045), F, 0xffffff, room);
      bar(sp.a, 0.0, sp.a + 0.08, trans, 0.09); bar(sp.b - 0.08, 0, sp.b, trans, 0.09);
      bar(sp.a, 0.0, sp.b, 0.14, 0.09); bar(sp.a, trans - 0.09, sp.b, trans, 0.09);
      batch.add('metal', box(sp.a + 0.12, 1.0, z + 0.01, sp.b - 0.12, 1.05, z + 0.06), F, 0xb9b4a8); // the push bar
    } else batch.add(gk, quad(sp.a, kickH, sp.b, trans, z - 0.045), F, 0xffffff, room);
    batch.add(gk, quad(sp.a, trans, sp.b, top, z - 0.045), F, 0xffffff, room); // the transom
    bar(sp.a - 0.035, kickH, sp.a + 0.035, top); bar(sp.b - 0.035, kickH, sp.b + 0.035, top);
  }
  bar(u0, kickH - 0.04, u1, kickH + 0.04);
  bar(u0, trans - 0.04, u1, trans + 0.04);
  bar(u0, top - 0.08, u1, top);
  // the sign board over the opening
  if (o.pent) pent(ctx, F, s, u0 - 0.35, u1 + 0.35, top + 0.3);
  if (o.sign) sign(ctx, F, s, o, u0, u1, o.pent ? top + 0.5 : top);
  if (o.awning != null) awning(ctx, F, o, u0 - 0.15, u1 + 0.15, top + 0.08);
  if (o.shutter != null) { // its housing just inside the head, and the shutter part way down
    batch.add('metal', box(u0, top - 0.32, -0.2, u1, top - 0.02, -0.02), F, 0x6a6e66);
    const drop = o.shutter;
    if (drop > 0.05) batch.add('shutter', box(u0 + 0.05, top - 0.32 - drop, -0.13, u1 - 0.05, top - 0.32, -0.11), F, o.shutterColor ?? 0x9aa39a);
  }
  if (o.neon) ctx.neon.push({ text: o.neon, color: o.neonColor, at: V(o.neonAt ?? u0 + 0.9, 1.75, z + 0.05).applyMatrix4(F), F });
  ctx.shops.push({ name: o.sign?.text, F, u0, u1, z: 0 });
}

// A shop's door: an aluminium-framed glass leaf on a hinge at `a` (dir 1) or `b` (dir -1), swinging in;
// its own object (HalsBlock opens it as Hal comes up to it), recorded in `ctx.doors`
function door(ctx, F, a, b, h, z, color, dir, room) {
  const mats = ctx.doorMats ??= new Map();
  const metal = mats.get(color) ?? mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.75 })).get(color);
  const W = b - a, leaf = new THREE.Group();
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; leaf.add(m); return m; };
  const bx = (x0, y0, x1, y1, d = 0.045) => new THREE.BoxGeometry(x1 - x0, y1 - y0, d).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  part(bx(0, 0.0, 0.08, h), metal); part(bx(W - 0.08, 0, W, h), metal);
  part(bx(0.08, 0, W - 0.08, 0.14), metal); part(bx(0.08, h - 0.09, W - 0.08, h), metal);
  part(new THREE.PlaneGeometry(W - 0.16, h - 0.23).translate(W / 2, (0.14 + h - 0.09) / 2, 0), ctx.mats.clearGlass);
  for (const side of [-1, 1]) part(bx(0.12, 0.98, W - 0.16, 1.04, 0.03).translate(0, 0, side * 0.05), ctx.mats.metal); // push bars
  if (dir < 0) leaf.rotation.y = Math.PI; // (hung from `b`, reaching back toward `a`)
  const pivot = new THREE.Group();
  const p = V(dir > 0 ? a : b, 0, z - 0.045).applyMatrix4(F);
  pivot.position.copy(p);
  pivot.quaternion.setFromRotationMatrix(F);
  pivot.add(leaf);
  ctx.doors.push({ pivot, q0: pivot.quaternion.clone(), at: V((a + b) / 2, 1.0, z).applyMatrix4(F), inside: V((a + b) / 2, 0, z - 1.0).applyMatrix4(F), open: 0, dir, room });
}

function sign(ctx, F, s, o, u0, u1, top) {
  const sg = o.sign, h = Math.min(sg.h ?? THREE.MathUtils.clamp((u1 - u0) * 0.075, 0.8, 1.15), (s.gh ?? 4.3) - top - 0.3);
  let a0 = u0 + (sg.inset ?? 0.1), a1 = u1 - (sg.inset ?? 0.1);
  // a board no wider than its lettering wants (a 15 m board with a 3 m name in the middle reads empty)
  if (sg.style !== 'letters' && !sg.full) {
    const g = ctx.signs.painted.g, px = 160;
    g.font = `${sg.weight ?? 700} ${h * (sg.sub ? 0.56 : 0.7) * px}px ${FONT_OF(sg.font)}`;
    const want = g.measureText(sg.text).width / px * 1.25 + 1.0;
    if (want < a1 - a0) { const c = (a0 + a1) / 2, half = Math.max(want, (a1 - a0) * 0.42) / 2; a0 = c - half; a1 = c + half; }
  }
  label(ctx, F, a0, a1, top + 0.14, h, sg);
}

// Lettering on a wall: a board (or lightbox) standing off it with the sign on its face, or just the
// letters painted on. u0..u1 along the wall, from y0 up `h`.
export function label(ctx, F, a0, a1, y0, h, sg, out = 0) {
  const y1 = y0 + h, lit = sg.style === 'lightbox' || sg.style === 'neon', atlas = lit ? ctx.signs.lit : ctx.signs.painted;
  const px = 160; // texels per metre
  const r = atlas.add((a1 - a0) * px, h * px, (g, w, hh) => drawSign(g, w, hh, sg));
  const depth = sg.style === 'letters' ? 0.005 : 0.08;
  if (sg.style !== 'letters') ctx.batch.add('paint', box(a0 - 0.03, y0 - 0.03, out, a1 + 0.03, y1 + 0.03, out + depth), F, sg.edge ?? 0x2a2420);
  const face = new THREE.PlaneGeometry(a1 - a0, h);
  face.translate((a0 + a1) / 2, (y0 + y1) / 2, out + depth + 0.003);
  const uv = face.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
  ctx.batch.add(lit ? 'signLit' : 'sign', face, F, 0xffffff);
}

// a canvas awning: sloping out from the wall over the glass, its valance, its sides, the frame's front pipe
function awning(ctx, F, o, u0, u1, y) {
  const style = o.awning, out = o.awningOut ?? 1.25, drop = 0.62, val = 0.26, { batch } = ctx;
  const stripeU = 0.25 / 16 / 0.3; // one stripe of the canvas texture every 0.3 m
  for (let a = u0; a < u1 - 0.01; a += 4.6) {
    const b = Math.min(u1, a + 4.6), du = (b - a) * stripeU;
    const slope = new THREE.BufferGeometry().setFromPoints([V(a, y, 0), V(b, y, 0), V(b, y - drop, out), V(a, y, 0), V(b, y - drop, out), V(a, y - drop, out)]);
    slope.setAttribute('uv', new THREE.Float32BufferAttribute([style * 0.25, 1, style * 0.25 + du, 1, style * 0.25 + du, 0, style * 0.25, 1, style * 0.25 + du, 0, style * 0.25, 0], 2));
    slope.computeVertexNormals();
    batch.add('canvas', slope, F, 0xffffff);
    const v = new THREE.BufferGeometry().setFromPoints([V(a, y - drop, out), V(b, y - drop, out), V(b, y - drop - val, out), V(a, y - drop, out), V(b, y - drop - val, out), V(a, y - drop - val, out)]);
    v.setAttribute('uv', new THREE.Float32BufferAttribute([style * 0.25, 1, style * 0.25 + du, 1, style * 0.25 + du, 0.6, style * 0.25, 1, style * 0.25 + du, 0.6, style * 0.25, 0.6], 2));
    v.computeVertexNormals();
    batch.add('canvas', v, F, 0xf0ece4);
  }
  for (const u of [u0, u1]) {
    const side = new THREE.BufferGeometry().setFromPoints([V(u, y, 0), V(u, y - drop, out), V(u, y - drop, 0.02)]);
    side.setAttribute('uv', new THREE.Float32BufferAttribute([style * 0.25, 1, style * 0.25 + 0.01, 0.5, style * 0.25, 0.5], 2));
    side.computeVertexNormals();
    batch.add('canvas', side, F, 0xd8d0c4);
    batch.add('iron', box(u - 0.012, y - drop - 0.01, 0, u + 0.012, y - drop + 0.012, out), F, 0x26241f); // the arm
  }
  batch.add('iron', box(u0, y - drop - 0.02, out - 0.02, u1, y - drop + 0.01, out + 0.01), F, 0x26241f);
}

// a barrel-tile pent roof on timber brackets over a shop front (the mission style's)
function pent(ctx, F, s, u0, u1, y) {
  const out = 0.85, fall = 0.32, w = u1 - u0, { batch } = ctx;
  const g = barrels(w, Math.hypot(out, fall), 0.045);
  g.rotateX(-Math.atan2(fall, out)); // sloping down and out from the wall
  g.translate(u0, y, 0);
  // barrels() runs toward -z: turn it out of the wall
  const m = mul(F, tr(u0 + w / 2, 0, 0), ry(Math.PI), tr(-(u0 + w / 2), 0, 0));
  batch.add('tile', g, m, 0xffffff);
  batch.add('paint', box(u0, y - fall - 0.02, 0, u1, y - 0.04, 0.02).translate(0, 0, 0), F, 0x4a3324); // the board along the wall
  batch.add('paint', box(u0, y - fall - 0.06, out - 0.04, u1, y - fall + 0.02, out + 0.02), F, 0x4a3324); // the fascia
  for (let u = u0 + 0.2; u < u1; u += 1.4) batch.add('paint', box(u - 0.05, y - fall - 0.28, 0, u + 0.05, y - fall - 0.04, out - 0.1), F, 0x3f2b1e);
  // its soffit, so it isn't open to the sky from underneath
  const sof = new THREE.PlaneGeometry(w, out).rotateX(Math.PI / 2);
  sof.translate(u0 + w / 2, y - fall * 0.6 - 0.03, out / 2);
  batch.add('paint', metreUV(sof), F, 0x5a4030);
}

// ---------------------------------------------------------------------------------- the building
// spec: { at, yaw, w, d, floors, gh, fh, parapet, wall ('stucco' | 'pbrick' | 'brick'), color, trim,
//   frame, coping, gable, roof ('flat' | 'hip'), bays, win: { w, h, sill, arch }, shops: [{ x0, x1,
//   sign, awning, pent, shutter, neon, kick, frame, door, room, lit }], entries: [{ x, w, h, arch }],
//   balconies: [floor numbers], bars, ac, sides: { L, R: 'party' | 'windows' }, back, deco, bands,
//   belt, cornice, rooftop, seed }
export function building(ctx, s) {
  const M = mul(tr(s.at.x, s.at.y ?? 0, s.at.z), ry(s.yaw));
  const t = s.t ?? 0.3, gh = s.gh ?? 4.3, fh = s.fh ?? 3.2, floors = s.floors ?? 2;
  const H = gh + (floors - 1) * fh, hip = s.roof === 'hip', par = hip ? 0 : s.parapet ?? 0.95, top = H + par;
  const mat = s.wall ?? 'stucco', color = s.color ?? 0xe6dcc6, trim = s.trim ?? 0xe4dccb;
  const rnd = ctx.rnd;
  const common = { t, mat, color, trim, frame: s.frame, gh, coping: hip ? 'none' : s.coping ?? 'cap' };
  // ---- the front
  const openings = [];
  for (const sh of s.shops ?? []) openings.push({ kind: 'shop', u: sh.x0 + 0.28, v: 0, w: sh.x1 - sh.x0 - 0.56, h: sh.h ?? Math.min(gh - 1.05, 3.25), ...sh });
  for (const e of s.entries ?? []) openings.push({ kind: 'door', u: e.x - e.w / 2, v: 0, w: e.w, h: e.h ?? 2.6, ...e });
  const win = { w: 1.25, h: 1.6, sill: 0.85, ...s.win };
  const bays = s.bays ?? Math.max(1, Math.round((s.w - 1.0) / 3.1));
  const bayU = (i) => (s.w * (i + 0.5)) / bays;
  for (let f = 1; f < floors; f++) {
    const base = gh + (f - 1) * fh;
    for (let i = 0; i < bays; i++) {
      if ((s.skip ?? []).includes(i)) continue;
      const balc = (s.balconies ?? []).includes(f) && (s.balconyBays ?? [i]).includes(i);
      if (balc) {
        openings.push({ kind: 'door', u: bayU(i) - 0.65, v: 0.02 + base, w: 1.3, h: 2.25, floor: base, lamp: false, color: 0x7a5534, steel: false, balcony: true });
        balcony(ctx, mul(M), bayU(i), base, s);
      } else openings.push({ kind: 'win', u: bayU(i) - win.w / 2, v: base + win.sill, w: win.w, h: win.h, arch: win.arch, floor: base, roomH: fh, ac: rnd() < (s.ac ?? 0.2), lintel: mat !== 'stucco' });
    }
  }
  // ground-floor windows of a building with no shops (barred, as the old courts' are)
  for (const g of s.groundWindows ?? []) openings.push({ kind: 'win', u: g - win.w / 2, v: 0.95, w: win.w, h: Math.min(win.h, gh - 1.6), arch: win.arch, floor: 0, roomH: gh, bars: s.bars ?? true, ac: false, room: s.groundRoom ?? 0, lit: s.groundRoom ? 0.3 : 0.45 });
  const profile = s.gable ? gableProfile(s.w, top, s.gable) : null;
  wall(ctx, M, { ...common, len: s.w, top, profile, openings, belt: s.belt ? gh : null, cornice: s.cornice ? H : null, bands: s.bands, bandColor: s.bandColor });
  // fix the doors that open onto balconies: their glass and frame came with `entry`; the door leaf is glazed
  // ---- the sides (from the back to just behind the front) and the back
  const sideW = (L) => {
    const kind = L ? s.sides?.L ?? 'party' : s.sides?.R ?? 'party', len = s.d - t;
    const op = [];
    if (kind === 'windows' || kind === 'front') for (let f = 1; f < floors; f++) {
      const base = gh + (f - 1) * fh, n = Math.max(1, Math.round(len / 4.2));
      for (let i = 0; i < n; i++) { const u = (len * (i + 0.5)) / n; if (u > len - 1.2) continue; op.push({ kind: 'win', u: u - win.w / 2, v: base + win.sill, w: win.w, h: win.h, arch: win.arch, floor: base, roomH: fh, ac: rnd() < 0.25, lintel: mat !== 'stucco' }); }
    }
    for (const sh of (L ? s.shopsL : s.shopsR) ?? []) op.push({ kind: 'shop', u: sh.x0 + 0.28, v: 0, w: sh.x1 - sh.x0 - 0.56, h: sh.h ?? Math.min(gh - 1.05, 3.25), ...sh });
    return { kind, op };
  };
  const L = sideW(true), R = sideW(false);
  const FL = mul(M, tr(0, 0, -s.d), ry(-Math.PI / 2)), FR = mul(M, tr(s.w, 0, -t), ry(Math.PI / 2));
  // a side wall's u runs from the back (L) or the front (R); flip the right side's shops' u so both read front to back
  wall(ctx, FL, { ...common, len: s.d - t, top: s.sides?.Ltop ?? top, openings: L.op.map((o) => (o.kind === 'shop' ? { ...o, u: s.d - t - o.u - o.w } : o)), coping: common.coping });
  wall(ctx, FR, { ...common, len: s.d - t, top: s.sides?.Rtop ?? top, openings: R.op, coping: common.coping });
  const FB = mul(M, tr(s.w - t, 0, -s.d), ry(Math.PI));
  const back = [];
  if (s.back !== false) {
    const bw = s.w - 2 * t;
    for (let f = 1; f < floors; f++) {
      const base = gh + (f - 1) * fh, n = Math.max(1, Math.round(bw / 3.6));
      for (let i = 0; i < n; i++) back.push({ kind: 'win', u: (bw * (i + 0.5)) / n - 0.55, v: base + 1.0, w: 1.1, h: 1.3, floor: base, roomH: fh, ac: rnd() < 0.35, lintel: mat !== 'stucco', sill: true });
    }
    const doors = Math.max(1, (s.shops?.length ?? 0) + (s.entries?.length ?? 0) > 1 ? 2 : 1);
    for (let i = 0; i < doors; i++) back.push({ kind: 'door', u: (bw * (i + 0.5)) / doors - 0.5, v: 0, w: 1.0, h: 2.2, steel: true, color: 0x5d6a5e });
    for (let i = 0; i < Math.max(1, Math.round(bw / 7)); i++) back.push({ kind: 'win', u: (bw * (i + 0.25)) / Math.max(1, Math.round(bw / 7)) + 1.4, v: 1.6, w: 0.8, h: 0.9, floor: 0, roomH: gh, bars: true, room: 1, lit: 0.3 });
  }
  wall(ctx, FB, { ...common, len: s.w - 2 * t, top, openings: back.filter((o) => o.u > 0.2 && o.u + o.w < s.w - 2 * t - 0.2) });
  // ---- the roof
  if (hip) hipRoof(ctx, M, s.w, s.d, H, s.pitch ?? 0.42);
  else flatRoof(ctx, M, s, H, t, top);
  // deco pilasters, standing proud of the front and up past the parapet
  if (s.deco) for (const u of s.deco.at) {
    const pw = s.deco.w ?? 0.55, up = s.deco.up ?? 0.7;
    ctx.batch.add(mat, box(u - pw / 2, 0, -0.02, u + pw / 2, top + up, 0.16), M, s.deco.color ?? color);
    for (const k of [-1, 0, 1]) ctx.batch.add(mat, box(u + k * pw * 0.28 - 0.035, gh + 0.2, 0.16, u + k * pw * 0.28 + 0.035, top + up - 0.35, 0.2), M, s.deco.color ?? color); // fluting
    ctx.batch.add('concrete', box(u - pw / 2 - 0.05, top + up, -0.07, u + pw / 2 + 0.05, top + up + 0.1, 0.22), M, trim);
  }
  // a downpipe from a scupper down the back corner, its shoe at the ground
  for (const u of [0.35, s.w - 0.35]) {
    const p = V(u, 0, -s.d - 0.06);
    ctx.batch.add('metal', cyl(0.045, H - 0.2, p.x, 0.15, p.z), M, 0x8c8a84);
    ctx.batch.add('metal', box(u - 0.09, H - 0.3, -s.d - 0.14, u + 0.09, H - 0.05, -s.d), M, 0x7c7a74);
  }
  // the collider: the mass to the roof, the parapets round it (he can stand on a flat roof)
  const q = new THREE.Quaternion().setFromRotationMatrix(M);
  const solid = (x0, y0, z0, x1, y1, z1) => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q, stuff: 'stone' });
  const inside = openings.filter((o) => o.kind === 'shop' && o.interior && o.doorSpan).sort((a, b) => a.x0 - b.x0);
  if (!inside.length) solid(0, 0, -s.d, s.w, H, 0);
  else {
    // a shop to walk into: its walls (the front either side of the door and over it, the back, the
    // sides), its floor level with the pavement, its ceiling; the rest of the ground floor solid
    const ceil = inside[0].ceil ?? gh - 0.35;
    solid(0, ceil, -s.d, s.w, H, 0);
    let x = 0;
    for (const o of inside) {
      const a = o.x0 < 0.6 ? 0 : o.x0, b = o.x1 > s.w - 0.6 ? s.w : o.x1, [da, db] = o.doorSpan;
      if (a - x > 0.05) solid(x, 0, -s.d, a, ceil, 0);
      solid(a, 0, -t, da, ceil, 0); solid(db, 0, -t, b, ceil, 0); solid(da, 2.35, -t, db, ceil, 0);
      solid(a, 0, -s.d, b, ceil, -s.d + t);
      solid(a, 0, -s.d, a + (a === 0 ? t : 0.12), ceil, 0);
      solid(b - (b === s.w ? t : 0.12), 0, -s.d, b, ceil, 0);
      solid(a, 0, -s.d + t, b, 0.15, -t);
      solid(da, 0, -t, db, 0.15, 0.02); // the threshold, level with the floor (without it a 15 cm trench across the doorway caught his feet)
      // the side walls' shop windows the room reaches (its linings stop at them): spans of the room's z
      const sideOpen = (shops, reach) => (reach ? (shops ?? []).map((sh) => [-t - sh.x0, -t - sh.x1]) : []);
      ctx.inside.push({ M, kind: o.interior, x0: a + (a === 0 ? t : 0.12), x1: b - (b === s.w ? t : 0.12), z0: -t, z1: -s.d + t, ceil,
        openR: sideOpen(s.shopsR, b === s.w), openL: sideOpen(s.shopsL?.map((sh) => ({ x0: s.d - t - sh.x1, x1: s.d - t - sh.x0 })), a === 0) });
      x = b;
    }
    if (s.w - x > 0.05) solid(x, 0, -s.d, s.w, ceil, 0);
  }
  if (!hip && par > 0.2) for (const [x0, z0, x1, z1] of [[0, -t, s.w, 0], [0, -s.d, s.w, -s.d + t], [0, -s.d, t, 0], [s.w - t, -s.d, s.w, 0]]) {
    ctx.parapets.push({ c: V((x0 + x1) / 2, H + par / 2, (z0 + z1) / 2).applyMatrix4(M), half: V((x1 - x0) / 2, par / 2, (z1 - z0) / 2), q });
  }
  return { M, H, top, front: (u, v = 0, z = 0) => V(u, v, z).applyMatrix4(M), q };
}

// a mission parapet's curved gable over the middle of the front: up in two ogee shoulders to a crown
function gableProfile(w, top, { width = 0.5, rise = 1.3 } = {}) {
  const gw = w * width, a = (w - gw) / 2, b = a + gw, cx = w / 2, pts = [V(w, top, 0)];
  const curve = new THREE.CurvePath();
  const P = (x, y) => new THREE.Vector2(x, y);
  curve.add(new THREE.LineCurve(P(b, top), P(b, top + rise * 0.35)));
  curve.add(new THREE.QuadraticBezierCurve(P(b, top + rise * 0.35), P(b - gw * 0.1, top + rise * 0.55), P(cx + gw * 0.18, top + rise * 0.78)));
  curve.add(new THREE.QuadraticBezierCurve(P(cx + gw * 0.18, top + rise * 0.78), P(cx + gw * 0.08, top + rise), P(cx, top + rise)));
  curve.add(new THREE.QuadraticBezierCurve(P(cx, top + rise), P(cx - gw * 0.08, top + rise), P(cx - gw * 0.18, top + rise * 0.78)));
  curve.add(new THREE.QuadraticBezierCurve(P(cx - gw * 0.18, top + rise * 0.78), P(a + gw * 0.1, top + rise * 0.55), P(a, top + rise * 0.35)));
  curve.add(new THREE.LineCurve(P(a, top + rise * 0.35), P(a, top)));
  pts.push(V(b, top, 0));
  for (const p of curve.getSpacedPoints(26)) pts.push(V(p.x, p.y, 0));
  pts.push(V(a, top, 0), V(0, top, 0));
  return pts;
}

// a balcony on an upper floor: its slab on two brackets, an iron railing of balusters
function balcony(ctx, M, u, base, s) {
  const w = 2.0, d = 0.9, { batch } = ctx, iron = 0x1f1d1b, trim = s.trim ?? 0xe4dccb;
  batch.add('concrete', box(u - w / 2, base - 0.12, 0, u + w / 2, base + 0.02, d), M, trim);
  for (const k of [-1, 1]) batch.add('concrete', box(u + k * (w / 2 - 0.25) - 0.08, base - 0.45, 0, u + k * (w / 2 - 0.25) + 0.08, base - 0.12, d * 0.7), M, trim);
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 0.11));
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; batch.add('iron', box(x - 0.008, base + 0.02, z - 0.008, x + 0.008, base + 1.0, z + 0.008), M, iron); }
    batch.add('iron', box(Math.min(x0, x1) - 0.02, base + 0.97, Math.min(z0, z1) - 0.02, Math.max(x0, x1) + 0.02, base + 1.03, Math.max(z0, z1) + 0.02), M, iron);
    batch.add('iron', box(Math.min(x0, x1) - 0.01, base + 0.09, Math.min(z0, z1) - 0.01, Math.max(x0, x1) + 0.01, base + 0.12, Math.max(z0, z1) + 0.01), M, iron);
  };
  rail(u - w / 2 + 0.04, d - 0.04, u + w / 2 - 0.04, d - 0.04);
  rail(u - w / 2 + 0.04, 0.02, u - w / 2 + 0.04, d - 0.04);
  rail(u + w / 2 - 0.04, 0.02, u + w / 2 - 0.04, d - 0.04);
  if (s.plants !== false && ctx.rnd() < 0.6 && ctx.props) {
    const p = prop('planter');
    p.scale.setScalar(0.7 + ctx.rnd() * 0.3);
    p.position.set(u + (ctx.rnd() - 0.5) * 1.2, base + 0.02, d * 0.5);
    p.applyMatrix4(M);
    ctx.objects.push({ o: p, kind: 'plant' });
  }
}

// a flat roof inside its parapets: the roofing, and what stands on it
function flatRoof(ctx, M, s, H, t, top) {
  const { batch, rnd } = ctx;
  batch.add('roofing', box(t, H - 0.2, -s.d + t, s.w - t, H + 0.03, -t), M, 0x55524e);
  // flashing up the inside of the parapets
  batch.add('roofing', box(t, H, -t - 0.02, s.w - t, H + 0.3, -t), M, 0x3d3b38);
  if (!ctx.props) return;
  const place = (name, u, z, yaw = 0, sc = 1) => {
    const o = prop(name);
    o.scale.multiplyScalar(sc);
    o.position.set(u, H + 0.03, z);
    o.rotation.y = yaw;
    o.applyMatrix4(M);
    ctx.objects.push({ o, kind: name });
    return o;
  };
  const roof = s.rooftop ?? {};
  const n = roof.condensers ?? Math.max(1, Math.round(s.w / 12));
  for (let i = 0; i < n; i++) place('ac_units', 1.6 + rnd() * (s.w - 3.2), -2 - rnd() * (s.d - 4), Math.floor(rnd() * 4) * Math.PI / 2);
  if (roof.dish ?? rnd() < 0.5) place('dish', 0.8 + rnd() * 1.5, -s.d + 1.2, Math.PI * (0.7 + rnd() * 0.6));
  // vent stacks and a roof hatch, the plumbing's vents
  for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++) {
    const u = 1 + rnd() * (s.w - 2), z = -1 - rnd() * (s.d - 2), h = 0.35 + rnd() * 0.6, r = 0.05 + rnd() * 0.08;
    batch.add('metal', cyl(r, h, u, H, z, 8), M, 0x8d8b86);
    batch.add('metal', cyl(r * 1.6, 0.05, u, H + h, z, 8), M, 0x77756f);
  }
  const hu = 1.5 + rnd() * (s.w - 3), hz = -s.d * (0.3 + rnd() * 0.4);
  batch.add('paint', box(hu - 0.55, H, hz - 0.55, hu + 0.55, H + 0.55, hz + 0.55), M, 0x8a8f8b);
  if (roof.aerial ?? rnd() < 0.6) { // a TV aerial on a mast
    const u = s.w - 1.2, z = -1.5;
    batch.add('metal', cyl(0.02, 2.4, u, H, z, 6), M, 0x9a9a96);
    for (let k = 0; k < 4; k++) batch.add('metal', box(u - 0.6 + k * 0.05, H + 1.9 + k * 0.14, z - 0.01, u + 0.6 - k * 0.05, H + 1.92 + k * 0.14, z + 0.01), M, 0x9a9a96);
  }
}

// a tiled hip roof over walls that stop at the eaves
function hipRoof(ctx, M, w, d, H, pitch) {
  const o = 0.45, x0 = -o, x1 = w + o, z0 = o, z1 = -d - o, rise = ((d + 2 * o) / 2) * pitch, ry0 = H + 0.05, top = ry0 + rise;
  const inset = (d + 2 * o) / 2, ra = V(x0 + inset, top, (z0 + z1) / 2), rb = V(x1 - inset, top, (z0 + z1) / 2);
  const tris = [
    [V(x0, ry0, z0), V(x1, ry0, z0), rb], [V(x0, ry0, z0), rb, ra], // front
    [V(x1, ry0, z1), V(x0, ry0, z1), ra], [V(x1, ry0, z1), ra, rb], // back
    [V(x1, ry0, z0), V(x1, ry0, z1), rb], [V(x0, ry0, z1), V(x0, ry0, z0), ra], // the hips
  ];
  const pos = [], uv = [];
  for (const tri of tris) {
    const n = new THREE.Vector3().subVectors(tri[1], tri[0]).cross(new THREE.Vector3().subVectors(tri[2], tri[0])).normalize();
    const along = new THREE.Vector3().subVectors(tri[1], tri[0]).setY(0).normalize(), upS = new THREE.Vector3().crossVectors(n, along);
    for (const p of tri) { pos.push(p.x, p.y, p.z); uv.push(p.dot(along), p.dot(upS)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  ctx.batch.add('roofTile', g, M, 0xffffff); // (its own key: a roof stays drawn from afar, the copings' tiles don't)
  // the eaves: fascia boards and the soffit under them
  ctx.batch.add('paint', box(x0, ry0 - 0.16, z1, x1, ry0 + 0.02, z0), M, 0x5a4030);
  ctx.batch.add('tile', barrels(w + 2 * o, 0.3, 0.05).translate(x0, ry0 + 0.01, z0 + 0.02), M, 0xffffff); // the tiles' ends along the front eave
  ctx.hulls.push({ pts: [...tris.flat().map((p) => p.clone().applyMatrix4(M))] });
}

// the sign-painting for a wall: a mural or a ghost sign, laid just off a wall's face
export function decal(ctx, F, { u0, u1, v0, v1, texture, opacity = 1, key }) {
  const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0);
  g.translate((u0 + u1) / 2, (v0 + v1) / 2, 0.012);
  const mat = ctx.decals[key] ??= new THREE.MeshStandardMaterial({ map: texture, transparent: opacity < 1 || key === 'ghost', opacity, roughness: 0.9, depthWrite: key !== 'ghost', polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.applyMatrix4(F);
  mesh.receiveShadow = true;
  ctx.objects.push({ o: mesh, kind: 'decal' });
  return mesh;
}
