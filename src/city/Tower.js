// Downtown's towers (2026-11-19): a glass lobby between stone piers under a canopy, then floor on floor
// of curtain wall (spandrel bands at the slabs, mullions up the bays, and behind each pane an office:
// the kit's glass, Kit.js, with its rooms lit or dark at night), set back once or twice on the way up,
// and a crown: a flat roof with its plant room, stepped deco shoulders, or a radio mast. Into the
// block's Batch, as the buildings are (Building.js); its colliders, one box a tier, into ctx.solids.
//
// The frame is a building's: the front along +x from its front-left corner, facing +z, the body
// behind (z from -d to 0). spec: { at, yaw, w, d, floors, fh, lobby, tiers: [{ from, inset }], crown,
// glass, stone, mullion, name }
import * as THREE from 'three';
import { box, label } from './Building.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _up = V(0, 1, 0);
const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const ry = (a) => new THREE.Matrix4().makeRotationY(a);
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));
const quad = (u0, v0, u1, v1, z) => new THREE.PlaneGeometry(u1 - u0, v1 - v0).translate((u0 + u1) / 2, (v0 + v1) / 2, z);
const cyl = (r, h, x, y0, z, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg).translate(x, y0 + h / 2, z);

// a pane's room (as Building.js's roomFor): its cell along the pane's tangent in the block's frame
function room(F, uc, vbase, w, h, depth, kind, lit, rnd) {
  const c = V(uc, vbase, 0).applyMatrix4(F);
  const N = V(0, 0, 1).transformDirection(F), T = new THREE.Vector3().crossVectors(_up, N).normalize();
  return { cell: [c.dot(T) - w / 2, c.y, w, h], room: [depth, rnd() * 100, kind, lit] };
}

export function tower(ctx, s) {
  const { batch, rnd } = ctx;
  const M = mul(tr(s.at.x, s.at.y ?? 0, s.at.z), ry(s.yaw));
  const fh = s.fh ?? 3.8, lobby = s.lobby ?? 6.5, floors = s.floors, H = lobby + (floors - 1) * fh;
  const glassTint = new THREE.Color(s.glass ?? 0x6f8a96), mull = s.mullion ?? 0xc9ccd0, stone = s.stone ?? 0xd9d2c4;
  const spandrel = new THREE.Color(s.glass ?? 0x6f8a96).multiplyScalar(0.55);
  const q = new THREE.Quaternion().setFromRotationMatrix(M);
  const solid = (x0, y0, z0, x1, y1, z1) => ctx.solids.push({ c: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(M), half: V(Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2), q, stuff: 'stone' });
  const yOf = (f) => (f <= 0 ? 0 : lobby + (f - 1) * fh); // the bottom of floor f (0 the lobby)
  // the four faces of a box inset i: each as a wall's frame (u along it, v up, out of it +z) and its length
  const faces = (i) => [
    { F: mul(M, tr(i, 0, -i)), L: s.w - 2 * i, front: true },
    { F: mul(M, tr(s.w - i, 0, -i), ry(Math.PI / 2)), L: s.d - 2 * i },
    { F: mul(M, tr(s.w - i, 0, -s.d + i), ry(Math.PI)), L: s.w - 2 * i },
    { F: mul(M, tr(i, 0, -s.d + i), ry(-Math.PI / 2)), L: s.d - 2 * i },
  ];
  // ---- the tiers: floor from..to at inset i
  const tiers = [], marks = [...(s.tiers ?? []), { from: floors, inset: 0 }];
  let from = 0, inset = 0;
  for (const t of marks) { tiers.push({ f0: from, f1: t.from, i: inset }); from = t.from; inset += t.inset; }
  for (const [ti, t] of tiers.entries()) {
    const y0 = yOf(t.f0), y1 = t.f1 >= floors ? H : yOf(t.f1);
    for (const { F, L, front } of faces(t.i)) {
      const n = Math.max(2, Math.round(L / 1.6)), bw = L / n;
      // the lobby, glass between stone piers, a band of stone over it (the bottom tier only)
      if (ti === 0) {
        const np = Math.max(2, Math.round(L / 6.2)), pw = L / np;
        for (let k = 0; k <= np; k++) batch.add('concrete', box(k * pw - 0.45, 0, -0.1, k * pw + 0.45, lobby, 0.28), F, stone);
        for (let k = 0; k < np; k++) {
          const a = k * pw + 0.45, b = (k + 1) * pw - 0.45, mid = lobby * 0.58;
          batch.add('glass', quad(a, 0.15, b, mid, -0.05), F, 0xffffff, room(F, (a + b) / 2, 0, b - a, lobby - 0.8, 9, 2, 0.9, rnd));
          batch.add('glass', quad(a, mid + 0.12, b, lobby - 0.75, -0.05), F, 0xffffff, room(F, (a + b) / 2, 0, b - a, lobby - 0.8, 9, 2, 0.9, rnd));
          batch.add('metal', box(a, mid, -0.08, b, mid + 0.12, 0.02), F, mull);
          for (let u = a + (b - a) / 3; u < b - 0.2; u += (b - a) / 3) batch.add('metal', box(u - 0.04, 0.15, -0.08, u + 0.04, lobby - 0.75, 0.0), F, mull);
        }
        batch.add('concrete', box(-0.1, lobby - 0.8, -0.05, L + 0.1, lobby + 0.25, 0.32), F, stone);
        if (front) {
          // the entrance canopy, and the name over it
          const c = L / 2;
          batch.add('metal', box(c - 5, 4.6, 0, c + 5, 4.95, 3.4), F, 0x3a3c40);
          batch.add('lamp', box(c - 4.6, 4.55, 0.4, c + 4.6, 4.6, 3.0), F, 0xfff0cc);
          if (s.name) label(ctx, F, c - Math.min(9, L / 2 - 1), c + Math.min(9, L / 2 - 1), lobby - 0.72, 0.62, { text: s.name, style: 'letters', fg: '#e8e2d0', font: 'deco', wear: 0.05 }, 0.33);
          ctx.lamps.push({ at: V(c, 4.4, 2).applyMatrix4(F), k: 0.8 });
        }
      }
      // the curtain wall: a spandrel at each slab, glass in each bay with its office behind
      const fA = Math.max(1, t.f0), fB = t.f1;
      for (let f = fA; f < fB; f++) {
        const yb = yOf(f), yt = yb + fh;
        batch.add('metal', box(-0.02, yb - 0.5, -0.02, L + 0.02, yb + 0.38, 0.06), F, spandrel);
        for (let k = 0; k < n; k++) {
          const a = k * bw + 0.04, b = (k + 1) * bw - 0.04;
          batch.add('glass', quad(a, yb + 0.38, b, yt - 0.5, -0.04), F, glassTint, room(F, (a + b) / 2, yb, bw, fh, 7, 4, 0.2, rnd));
        }
      }
      // the mullions up the bays (the corners heavier), from the lobby's band or the setback to the top
      const ym = Math.max(y0, lobby + 0.25), yTop = y1 + (t.f1 >= floors ? 1.3 : 0.9);
      for (let k = 0; k <= n; k++) {
        const edge = k === 0 || k === n, hw = edge ? 0.16 : 0.045;
        batch.add('metal', box(k * bw - hw, ym, -0.03, k * bw + hw, yTop, edge ? 0.16 : 0.12), F, mull);
      }
      // the parapet round the tier's roof
      batch.add('metal', box(-0.05, y1 - 0.5, -0.03, L + 0.05, yTop, 0.08), F, spandrel);
    }
    // its roof (under the tier above, or the top's)
    const i = t.i;
    batch.add('roofing', box(i + 0.2, y1 - 0.25, -s.d + i + 0.2, s.w - i - 0.2, y1 + 0.05, -i - 0.2), M, 0x4f4c48);
    solid(i, y0, -s.d + i, s.w - i, y1 + 1.2, -i);
  }
  // ---- the crown
  const top = tiers.at(-1), i = top.i, cw = s.w - 2 * i, cd = s.d - 2 * i, cx = s.w / 2, cz = -s.d / 2;
  const plant = (w, d, h, y, col) => { batch.add('concrete', box(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2), M, col); solid(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2); };
  if (s.crown === 'stepped') {
    // deco shoulders: two smaller tiers of stone, fins up their faces, the top one lit at night
    let w = cw * 0.7, d = cd * 0.7, y = H;
    for (let k = 0; k < 2; k++) {
      const h = 6 - k * 1.5;
      plant(w, d, h, y, stone);
      for (const [sx, sz, L, along] of [[0, d / 2, w, 'x'], [0, -d / 2, w, 'x'], [w / 2, 0, d, 'z'], [-w / 2, 0, d, 'z']]) {
        const nf = Math.max(3, Math.round(L / 2.2));
        for (let f = 1; f < nf; f++) {
          const o = -L / 2 + (L * f) / nf;
          const [x0, z0] = along === 'x' ? [cx + o, cz + sz] : [cx + sx, cz + o];
          batch.add('concrete', box(x0 - (along === 'x' ? 0.12 : 0.18), y + 0.4, z0 - (along === 'z' ? 0.12 : 0.18), x0 + (along === 'x' ? 0.12 : 0.18), y + h + 0.3, z0 + (along === 'z' ? 0.12 : 0.18)), M, stone);
        }
      }
      y += h; w *= 0.66; d *= 0.66;
    }
    batch.add('lamp', box(cx - w / 2, y, cz - d / 2, cx + w / 2, y + 0.4, cz + d / 2), M, 0xfff0cc);
  } else {
    // the plant room, its louvres, the window-cleaning rails, vents; a mast on some
    const pw = Math.max(8, cw * 0.42), pd = Math.max(8, cd * 0.42);
    plant(pw, pd, 5.2, H, new THREE.Color(stone).multiplyScalar(0.85));
    for (let y = H + 0.8; y < H + 4.6; y += 0.32) batch.add('metal', box(cx - pw / 2 + 0.6, y, cz + pd / 2, cx + pw / 2 - 0.6, y + 0.06, cz + pd / 2 + 0.12), M, 0x6a6e70);
    for (let k = 0; k < 6; k++) {
      const x = cx + (rnd() - 0.5) * (cw - 4), z = cz + (rnd() - 0.5) * (cd - 4);
      if (Math.abs(x - cx) < pw / 2 + 1 && Math.abs(z - cz) < pd / 2 + 1) continue;
      batch.add('metal', box(x - 0.8, H, z - 0.6, x + 0.8, H + 1.4, z + 0.6), M, 0x8a8c8e);
    }
    if (s.crown === 'mast') {
      batch.add('metal', cyl(0.35, 26, cx, H + 5.2, cz, 8), M, 0xb8bcc0);
      batch.add('metal', cyl(0.12, 12, cx, H + 31, cz, 6), M, 0xd04030);
      batch.add('lamp', cyl(0.3, 0.6, cx, H + 43, cz, 8), M, 0xff4030);
      ctx.beacons?.push(V(cx, H + 43.3, cz).applyMatrix4(M));
    }
  }
  return { M, H, top: H + 6, front: (u, v = 0, z = 0) => V(u, v, z).applyMatrix4(M), q };
}
