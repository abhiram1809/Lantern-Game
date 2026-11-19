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

// the lanes, in the lot's frame (Ferris.js LOT): the boulevard's x (northbound +z, southbound -z),
// the cross street's z (eastbound +x, westbound -x), the stop lines, the far ends
const NB = 4.0, SB = 8.0, CROSS = -210, EB = CROSS + 2.2, WB = CROSS - 2.2;
const STOP = { NB: -223.4, SB: -196.6, EB: -6.5, WB: 18.5 }; // (each car's middle: its nose short of the stop bar, off the crosswalk)
const SOUTH = -470, WEST = -165, EAST = 165, LOT_IN = -26;
const BAYS = [1.6, 4.8, -4.8]; // free spaces in Hal's lot (its row at z 4.8, noses to +z)
const MODELS = ['fairheaven', 'negotiator', 'sialia', 'fairheaven_sw'];
const PAINTS = [0x5b6f7c, 0x9a3a2c, 0xd8d2c2, 0x2f3e2c, 0x24262c, 0xa88a52, 0x6c4a6a, 0x3a5a8a, 0xc9b98a, 0x7a2224];
const CRUISE = 10.5, ACCEL = 2.2, BRAKE = 4.5, LATERAL = 2.4, LENGTH = 4.9;
// the lights at the crossing: the boulevard's green, amber, both red; the cross street's
const PHASES = [['NS', 18], ['NSa', 3], ['red', 1.5], ['EW', 14], ['EWa', 3], ['red', 1.5]];
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0);

// a path: points (x, z) with their running length; `at(s)` the place and heading there
class Path {
  constructor(pts) {
    this.p = pts;
    this.len = [0];
    for (let i = 1; i < pts.length; i++) this.len.push(this.len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.total = this.len[this.len.length - 1];
    this.i = 1;
  }
  at(s, out) {
    s = Math.max(0, Math.min(this.total, s));
    let i = Math.min(Math.max(1, this.i), this.p.length - 1);
    while (i < this.p.length - 1 && this.len[i] < s) i++;
    while (i > 1 && this.len[i - 1] > s) i--;
    this.i = i;
    const a = this.p[i - 1], b = this.p[i], k = (s - this.len[i - 1]) / Math.max(1e-6, this.len[i] - this.len[i - 1]);
    out.x = a[0] + (b[0] - a[0]) * k;
    out.z = a[1] + (b[1] - a[1]) * k;
    out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
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
const IN = { NB: { from: [NB, SOUTH], to: [NB, STOP.NB], dir: N }, SB: { from: [SB, -8], to: [SB, STOP.SB], dir: S }, EB: { from: [WEST, EB], to: [STOP.EB, EB], dir: E }, WB: { from: [EAST, WB], to: [STOP.WB, WB], dir: W } };
const OUT = { N: { from: [NB, STOP.SB], to: [NB, LOT_IN], dir: N }, S: { from: [SB, STOP.NB], to: [SB, SOUTH], dir: S }, E: { from: [STOP.WB, EB], to: [EAST, EB], dir: E }, W: { from: [STOP.EB, WB], to: [WEST, WB], dir: W } };
const GROUP = { NB: 'NS', SB: 'NS', EB: 'EW', WB: 'EW' };
// which way each approach can leave (never back the way it came); the block's own stretch is weighted
const EXITS = { NB: [['N', 3], ['W', 1], ['E', 1]], SB: [['S', 3], ['E', 1], ['W', 1]], EB: [['E', 2], ['N', 2], ['S', 1]], WB: [['W', 2], ['N', 2], ['S', 1]] };
const ENTRIES = [['NB', 3], ['SB', 3], ['EB', 2], ['WB', 2]];
const pickW = (list) => { let r = Math.random() * list.reduce((n, [, w]) => n + w, 0); for (const [k, w] of list) if ((r -= w) <= 0) return k; return list[0][0]; };

export class Traffic {
  // f: the Ferris scene (its smash, its physics); story: for Hal, the people, the camera, the sounds
  constructor(f, story, { count = 10, lot }) {
    Object.assign(this, { f, story, lot });
    this.cars = [];
    this.phase = 0;
    this.phaseT = 0;
    this.bays = new Map(); // bay x → the car in it
    this.made = 0;
    for (let i = 0; i < count + 2; i++) this.cars.push(this.make());
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
    this.story.player.camIgnore.add(item.collider.handle); // (the camera doesn't jump in as one passes behind him)
    const lamps = item.lamps.map((m) => { m.updateWorldMatrix(true, false); const p = obj.worldToLocal(m.getWorldPosition(_v.clone())); return { m, front: p.z > 0 }; });
    return { obj, item, lamps, path: null, s: 0, v: 0, state: 'pool', pose: { x: 0, z: 0, yaw: 0 }, blocked: 0, honked: -99, lit: -1 };
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

  // a route: in by an approach, out by an exit (the lot's bays at the north end), with its stop line
  route(entry) {
    const a = IN[entry], exit = pickW(EXITS[entry]), o = OUT[exit];
    const pts = [a.from, a.to];
    const stopS = Math.hypot(a.to[0] - a.from[0], a.to[1] - a.from[1]);
    pts.push(...curve(a.to, a.dir, o.from, o.dir, exit === { NB: 'N', SB: 'S', EB: 'E', WB: 'W' }[entry] ? 2 : 14));
    pts.push(o.to);
    let bay = null;
    if (exit === 'N') {
      // into Hal's lot, nose first into a free space (or to its far side, to wait)
      bay = BAYS.find((x) => !this.bays.has(x));
      if (bay != null) pts.push(...curve(o.to, N, [bay, 3.4], N, 10), [bay, 4.8]);
      else pts.push([NB - 2, -12]);
    }
    return { path: new Path(pts.map(([x, z]) => [x + this.lot.x, z + this.lot.z])), stopS, group: GROUP[entry], bay, entry };
  }

  // somewhere for a car to come from: out of sight (out of the frustum, or far), and clear
  unseen(x, z, far = 210) {
    const cam = this.story.engine.camera;
    _v.set(x, 1, z);
    return _v.distanceTo(cam.position) > far || !this.frustum.containsPoint(_v);
  }
  clear(x, z, r = 12) { return !this.cars.some((c) => c.state === 'drive' && Math.hypot(c.obj.position.x - x, c.obj.position.z - z) < r); }

  spawn(c) {
    const entry = pickW(ENTRIES), r = this.route(entry), p0 = r.path.p[0];
    if (!this.unseen(p0[0], p0[1]) || !this.clear(p0[0], p0[1])) return false;
    if (r.bay != null) this.bays.set(r.bay, c);
    Object.assign(c, { ...r, s: 0, v: entry === 'SB' ? 0 : CRUISE * 0.8, state: 'drive', blocked: 0, parkedT: 0, hitSeen: c.item.lastHit });
    c.obj.visible = true;
    this.place(c, true);
    return true;
  }
  park(c) { c.state = 'parked'; c.v = 0; }

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
    const path = new Path(pts.map(([x, z]) => [x + this.lot.x, z + this.lot.z]));
    // where it comes from: back along its way, the nearest point to the end that nobody sees and no car is at
    let s0 = 0;
    for (let s = Math.max(0, path.total - 50); s >= 0; s -= 10) { const q = path.at(s, _p); if (this.unseen(q.x, q.z, 90) && this.clear(q.x, q.z, 10)) { s0 = s; break; } }
    const lamps = item.lamps.map((m) => { m.updateWorldMatrix(true, false); return { m, front: obj.worldToLocal(m.getWorldPosition(_v.clone())).z > 0 }; });
    const c = { obj, item, lamps, path, s: s0, v: speed * 0.8, state: 'drive', pose: { x: 0, z: 0, yaw: 0 }, blocked: 0, honked: -99, lit: -1, stopS: -1, group: null, bay: null, held: true, cruise: speed, onArrive, hitSeen: item.lastHit };
    this.cars.push(c);
    obj.visible = true;
    this.place(c, true);
    return c;
  }
  dismiss(c) { c.state = 'free'; this.cars = this.cars.filter((q) => q !== c); }
  retire(c) {
    if (c.bay != null && this.bays.get(c.bay) === c) this.bays.delete(c.bay);
    c.state = 'pool';
    c.bay = null;
    c.item.body.setNextKinematicTranslation({ x: this.lot.x + 300, y: -60, z: this.lot.z });
    c.obj.visible = false;
  }
  // hit by the ring, or by something: physics has it now
  release(c) {
    if (c.bay != null && this.bays.get(c.bay) === c) this.bays.delete(c.bay);
    c.state = 'free';
    const b = c.item.body, y = c.pose.yaw;
    b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.setLinvel({ x: Math.sin(y) * c.v, y: 0, z: Math.cos(y) * c.v }, true);
    c.item.traffic = false;
  }

  place(c, snap = false) {
    const p = c.path.at(c.s, c.pose);
    const b = c.item.body;
    _q.setFromAxisAngle(_Y, p.yaw);
    if (snap) { b.setTranslation({ x: p.x, y: 0, z: p.z }, true); b.setRotation(_q, true); c.obj.position.set(p.x, 0, p.z); c.obj.quaternion.copy(_q); }
    b.setNextKinematicTranslation({ x: p.x, y: 0, z: p.z });
    b.setNextKinematicRotation(_q);
  }

  update(dt) {
    if (dt <= 0) return;
    const story = this.story, cam = story.engine.camera, hp = story.player.position;
    this.t += dt;
    cam.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    if ((this.phaseT += dt) > PHASES[this.phase][1]) { this.phaseT = 0; this.phase = (this.phase + 1) % PHASES.length; }
    // keep the streets busy (fewer at night)
    const night = this.f.isNight, want = night ? Math.ceil(this.want * 0.5) : this.want;
    const driving = this.cars.filter((c) => c.state === 'drive' || c.state === 'parked').length;
    if (driving < want && (this.spawnT = (this.spawnT ?? 0) - dt) < 0) {
      this.spawnT = 0.7 + Math.random() * 1.2;
      const c = this.cars.find((q) => q.state === 'pool');
      if (c) this.spawn(c);
    }
    const lit = night || story.dayCycle?.w.grey > 0.6 ? 1 : 0;
    const people = story.cityLife?.people ?? [];
    for (const c of [...this.cars]) {
      if (c.state === 'free' && !c.held && (c.freeT = (c.freeT ?? 0) + dt) > 45 && this.unseen(c.obj.position.x, c.obj.position.z, 90)) { this.tow(c); continue; }
      if (c.state === 'pool' || c.state === 'free' || c.state === 'held') continue;
      // hit: the ring's or anything's blow (Smash sets lastHit), or caught burning
      if (c.item.lastHit != null && c.item.lastHit !== c.hitSeen) { c.hitSeen = c.item.lastHit; if (c.state === 'drive' || c.item.hurt) { this.release(c); continue; } }
      if (c.state === 'parked') {
        // gone when nobody's looking (the space free again for the next)
        if ((c.parkedT = (c.parkedT ?? 0) + dt) > 20 && this.unseen(c.obj.position.x, c.obj.position.z, 120)) this.retire(c);
        this.lamps(c, 0, false);
        continue;
      }
      const pose = c.path.at(c.s, c.pose), f = [Math.sin(pose.yaw), Math.cos(pose.yaw)];
      // what it may do: cruise; slower into the bends ahead; stop for the lights, the car ahead, Hal,
      // and anyone in the road
      let v = c.cruise ?? CRUISE;
      for (const ahead of [6, 12, 18]) {
        const q = c.path.at(c.s + ahead, _p), turn = Math.abs(wrap(q.yaw - pose.yaw)) / ahead;
        if (turn > 1e-3) v = Math.min(v, Math.sqrt(LATERAL / turn) + ahead * 0.35);
      }
      if (c.bay != null && c.path.total - c.s < 14) v = Math.min(v, 1.2 + (c.path.total - c.s) * 0.35); // (into the space)
      if (c.s < c.stopS) {
        const go = this.green(c.group), toLine = c.stopS - c.s;
        if (!go && !(this.amber(c.group) && toLine < (c.v * c.v) / (2 * BRAKE) - 1)) v = Math.min(v, Math.sqrt(2 * BRAKE * Math.max(0, toLine - 0.3)));
      }
      let blockedByHal = false;
      const look = (x, z, len, lat = 1.7) => {
        const rx = x - pose.x, rz = z - pose.z, along = rx * f[0] + rz * f[1];
        if (along < 0 || along > 28) return;
        if (Math.abs(rx * f[1] - rz * f[0]) > lat) return;
        const gap = along - len;
        v = Math.min(v, Math.sqrt(2 * BRAKE * Math.max(0, gap - 1.2)));
        return true;
      };
      for (const o of this.cars) if (o !== c && o.state !== 'pool') look(o.obj.position.x, o.obj.position.z, LENGTH);
      for (const o of this.extra) if (!(o.userData?.holdR && Math.hypot(o.position.x - pose.x, o.position.z - pose.z) < o.userData.holdR)) look(o.position.x, o.position.z, LENGTH, 2.9); // (a hold on a stretch stops those coming, not those in it; a car across the road is wide)
      if (story.driving && this.f.car) { if (look(this.f.car.position.x, this.f.car.position.z, LENGTH)) blockedByHal = c.v < 0.5; } // (his Phoenix)
      else if (Math.abs(hp.y) < 2.5 && look(hp.x, hp.z, 2.9)) blockedByHal = c.v < 0.5;
      for (const p of people) if (p.active) look(p.pos.x, p.pos.z, 2.8);
      // speed toward what it may do, within the car's limits
      c.v += Math.max(-BRAKE * 1.6 * dt, Math.min(ACCEL * dt, v - c.v));
      if (c.v < 0.02) c.v = Math.max(0, c.v);
      const ds = c.v * dt;
      c.s += ds;
      this.place(c);
      for (const w of c.obj.userData.wheels ?? []) w.rotation.x += ds / 0.33;
      const turn = wrap(c.path.at(c.s + 2.5, _p).yaw - pose.yaw) / 2.5;
      for (const w of c.obj.userData.front ?? []) w.rotation.y = Math.atan((c.obj.userData.axle?.base ?? 2.7) * turn);
      this.lamps(c, lit, v < c.v - 0.5);
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
        else if (this.unseen(c.obj.position.x, c.obj.position.z, 150)) this.retire(c);
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
      if (front) { m.material.emissive.setRGB(1, 0.9, 0.72); m.material.emissiveIntensity = on ? 1.8 : 0; }
      else { m.material.emissive.setRGB(1, 0.08, 0.04); m.material.emissiveIntensity = (on ? 1.1 : 0) + (braking ? 1.4 : 0); }
    }
  }
}
const _p = { x: 0, z: 0, yaw: 0 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
