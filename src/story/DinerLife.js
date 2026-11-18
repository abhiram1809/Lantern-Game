import * as THREE from 'three';
import { wait, tween, ease } from '../engine/Time.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLOOR = 0.15, TABLE = FLOOR + 0.645, COUNTER = 1.05, SHELF = 1.39; // (the booth's table top, measured on the model)
const HURRY = 1.35; // Rosie's pace on Hal's order (1.05 for the others)
const _a = new THREE.Vector3(), _m = new THREE.Matrix4();
const rnd = (a, b) => a + Math.random() * (b - a);

// Rosie's Diner at work (2026-11-18; the user: "they're just sitting there, no one is serving them",
// "the waitress is just going back and forth in the counter, she's not someone that answers to you").
// Rosie runs the floor: she takes orders at the booths and the counter (her notepad out), puts the
// ticket up at the pass, brings the plates Dot puts up when the bell goes, tops up coffee at the
// counter, clears tables people have left, and wipes the counter when there's nothing else; she says
// hello when Hal comes in, stops to talk when he speaks to her, and comes to wherever he sits to take
// his order (`ui.pick`: coffee, the patty melt and the cherry, or nothing). Dot cooks the tickets on
// the griddle and plates them up on the pass. Customers come in off the street (a walker turns in at
// the door), sit, order, eat (fork to mouth, the food going down), leave money, and go back out to
// the pavement; others come in. All of it in the room's own frame (Interiors.js's measures), turned to
// the world.
//
// Rosie's routes: behind the counter along her lane (out at either end of it), the floor by the aisle
// between the booths and the stools, the pass between the back bar's two runs.

export class DinerLife {
  constructor(life) {
    this.life = life;
    const { block } = life;
    this.r = block.ctx.rooms.find((x) => x.name === 'diner');
    this.origin = block.group.position;
    this.door = block.ctx.doors.find((d) => d.room === 'diner');
    this.customers = [];
    this.tickets = [];
    this.ready = [];
    this.clear = [];
    this.t = 0;
    this.nextArrival = 20;
    const r = this.r, { x0, x1, z0, ca, cb, cz, kz, lane } = r;
    this.inv = new THREE.Matrix4().copy(r.M).invert();
    // the seats: booths down the front windows (A by the wall Hal sits on, B across the table), the two
    // down the side windows, the thirteen stools; each with where to sit, where to stand to get in,
    // where its plate goes and where Rosie stands to serve it
    const S = (this.seats = {});
    for (let i = 0; i < 7; i++) {
      const x = x0 + 1.9 + i * 2.15;
      for (const [k, s] of [['A', -1], ['B', 1]]) {
        S[`booth${i}${k}`] = { id: `booth${i}${k}`, table: `booth${i}`, at: this.W(x + s * 0.76, z0 - 0.95), face: this.Y(-s, 0), sit: 0.47,
          approach: this.W(x + s * 0.7, z0 - 2.1), plate: this.W(x + s * 0.17, z0 - 1.05, TABLE), serve: this.W(x + s * 0.25, z0 - 2.2), serveFace: this.Y(0, 1) };
      }
    }
    for (let j = 0; j < 2; j++) {
      const z = z0 - 4.7 - j * 2.15, bx = x1 - 0.95;
      for (const [k, s] of [['A', -1], ['B', 1]]) {
        S[`side${j}${k}`] = { id: `side${j}${k}`, table: `side${j}`, at: this.W(bx, z + s * 0.76), face: this.Y(0, -s), sit: 0.47,
          approach: this.W(x1 - 2.1, z + s * 0.7), plate: this.W(bx - 0.05, z + s * 0.17, TABLE), serve: this.W(x1 - 2.05, z + s * 0.25), serveFace: this.Y(1, 0) };
      }
    }
    for (let k = 0; k < 13; k++) {
      const x = ca + 0.55 + k * ((cb - ca - 1.1) / 12);
      S[`stool${k}`] = { id: `stool${k}`, table: `stool${k}`, at: this.W(x, cz + 0.42), face: this.Y(0, -1), sit: 0.78, stool: true,
        approach: this.W(x, cz + 1.05), plate: this.W(x, cz - 0.18, COUNTER), serve: this.W(x, cz - 0.86), serveFace: this.Y(0, 1), lane: true };
    }
    // Hal's seats are the spots (Interiors' `seat`s): matched to these by place
    for (const sp of block.ctx.spots) if (sp.kind === 'seat') {
      const s = Object.values(S).find((q) => q.at.distanceTo(sp.at) < 0.15);
      if (s) { s.spot = sp; sp.seat = s; }
    }
    this.laneZ = lane;
    this.slots = [x0 + 9.6, x0 + 10.7, x0 + 11.8];
    this.slotUsed = [null, null, null];
  }

  // the room's frame to the world (y above the floor's 0), and a direction in it as a world yaw
  W(x, z, y = FLOOR) { return V(x, y, z).applyMatrix4(this.r.M).add(this.origin); }
  Y(dx, dz) { _a.set(dx, 0, dz).transformDirection(this.r.M); return Math.atan2(_a.x, _a.z); }
  L(w) { return _a.copy(w).sub(this.origin).applyMatrix4(this.inv).clone(); }
  inside(at) {
    const r = this.r, l = this.L(at);
    return l.x > r.x0 && l.x < r.x1 && l.z < r.z0 && l.z > r.z1 && at.y < 3;
  }

  // ---------------------------------------------------------------- the way round the room
  zone(l) {
    const { ca, cb, cz, bz, kz } = this.r;
    if (l.z < kz) return 'kitchen';
    if (l.z < cz - 0.7 && l.z > kz && l.x > ca - 0.3 && l.x < cb + 0.3) return 'lane';
    return 'floor';
  }
  // world points from here to there (both world): along Rosie's lane, out at its nearer end, by the aisle
  route(from, to) {
    const a = this.L(from), b = this.L(to), za = this.zone(a), zb = this.zone(b), r = this.r, lz = this.laneZ, AZ = r.aisle;
    const pts = [];
    const lanePt = (x) => V(x, 0, lz);
    if (za === 'lane' && zb === 'lane') {
      if (Math.abs(a.z - lz) > 0.15) pts.push(V(a.x, 0, lz));
      pts.push(lanePt(b.x), b);
    } else if (za === 'lane' || zb === 'lane') {
      const inLane = za === 'lane' ? a : b, onFloor = za === 'lane' ? b : a;
      // out at the counter's nearer end, or through its gate (in front of the pass)
      const exits = [r.ca - 0.75, r.cb + 0.75, ...(r.gate != null ? [r.gate] : [])];
      const ex = exits.reduce((m, x) => (Math.abs(inLane.x - x) + Math.abs(onFloor.x - x) < Math.abs(inLane.x - m) + Math.abs(onFloor.x - m) ? x : m));
      const lanePart = [V(inLane.x, 0, lz), lanePt(ex)], floorPart = [V(ex, 0, r.cz + 1.15), V(ex, 0, AZ), V(onFloor.x, 0, AZ)];
      if (za === 'lane') pts.push(...lanePart, ...floorPart, b);
      else pts.push(V(a.x, 0, AZ), ...floorPart.reverse(), ...lanePart.reverse(), b);
    } else {
      pts.push(V(a.x, 0, AZ), V(b.x, 0, AZ), b);
    }
    // to the world, dropping steps that go nowhere
    const out = [];
    let prev = a;
    for (const l of pts) {
      if (Math.hypot(l.x - prev.x, l.z - prev.z) < 0.08) continue;
      out.push(this.W(l.x, l.z));
      prev = l;
    }
    return out;
  }
  goTo(p, to, face = null, speed = 1.05) { return this.life.go(p, this.route(p.pos, to), { speed, face }); }

  // ---------------------------------------------------------------- the people
  get rosie() { return (this._rosie ??= this.life.byTag('rosie')); }
  get cook() { return (this._cook ??= this.life.byTag('cook')); }

  start() {
    const rosie = this.rosie, cook = this.cook;
    if (rosie) { rosie.state = 'hold'; this.rosieLoop(); }
    if (cook) { cook.state = 'hold'; this.cookLoop(); }
  }

  // a customer already in their seat (at the start), with a meal in front of them if they're eating
  seatCustomer(p, seatId, { phase = 'wait', food = null } = {}) {
    const s = this.seats[seatId];
    if (!s) return;
    p.pos.copy(s.at);
    p.yaw = s.face;
    p.rig.root.rotation.y = s.face;
    p.sit = s.sit;
    p.stool = !!s.stool;
    p.home.copy(s.at);
    this.life.seatPose(p);
    s.taken = p;
    if (s.spot) s.spot.taken = true;
    const c = { p, seat: s, phase, since: this.t - rnd(0, 20), bites: 0 };
    if (food) {
      c.plate = meal(food);
      c.plate.position.copy(s.plate);
      c.plate.rotation.y = s.face + Math.PI;
      this.life.f.scene.add(c.plate);
      c.food = food;
      c.bites = Math.floor(rnd(0, 6));
      shrink(c.plate, c.bites / 14);
    }
    this.customers.push(c);
    return c;
  }

  // ---------------------------------------------------------------- Rosie
  async rosieLoop() {
    while (!this.disposed) {
      const task = this.nextTask();
      try {
        if (task) await task();
        else await this.wipe();
      } catch (e) { console.warn('rosie', e); await wait(1); }
    }
  }

  nextTask() {
    const hal = this.customers.find((c) => c.hal);
    if (hal && hal.phase === 'wait') return () => this.takeOrder(hal);
    const plate = this.ready.find((o) => o.c.hal) ?? this.ready[0]; // (his first: he's the one waiting at the keyboard)
    if (plate) return () => this.serve(plate);
    const waiting = this.customers.find((c) => !c.hal && c.phase === 'wait' && this.t - c.since > 4);
    if (waiting) return () => this.takeOrder(waiting);
    const dirty = this.clear[0];
    if (dirty) return () => this.clearTable(dirty);
    const cup = this.customers.find((c) => c.seat.stool && c.phase === 'eating' && c.food === 'coffee' && this.t - (c.refilled ?? c.since) > 70);
    if (cup) return () => this.refill(cup);
    return null;
  }

  // nothing to do: along the counter with a cloth (her hand wiping in circles), an eye on the room
  async wipe() {
    const rosie = this.rosie, r = this.r;
    const x = rnd(r.ca + 0.8, r.cb - 0.8);
    await this.goTo(rosie, this.W(x, r.cz - 0.86), this.Y(0, 1), 0.8);
    const c = this.W(x, r.cz - 0.35, COUNTER + 0.03), t0 = this.t, at = V(0, 0, 0);
    rosie.anim.reach('R', () => at.copy(c).add(_a.set(Math.cos((this.t - t0) * 5) * 0.12, 0, Math.sin((this.t - t0) * 5) * 0.08)), { weight: 1, rate: 4 });
    rosie.anim.lean.pitch = 0.18;
    const until = this.t + rnd(3, 6);
    while (this.t < until && !this.nextTask()) await wait(0.25);
    rosie.anim.reach('R', null);
    rosie.anim.lean.pitch = 0;
  }

  // to the table, the notepad out; the order (Hal's by the menu); the ticket up at the pass
  async takeOrder(c) {
    const rosie = this.rosie, life = this.life, story = life.story;
    c.phase = 'asking';
    await this.goTo(rosie, c.seat.serve, c.seat.serveFace, c.hal ? HURRY : undefined);
    if (!this.customers.includes(c)) return;
    pad(rosie, true);
    life.look(rosie, c.hal ? life.halHead() : life.headOf(c.p), 0.8);
    let food;
    if (c.hal) {
      await life.say(rosie, story.civilian ? 'rosieAsk' : 'rosieAskG');
      const pick = story.ui.pick('Rosie’s', story.civilian ? ['Just coffee', 'Patty melt and the cherry pie', 'Nothing, thanks'] : ['Coffee, black', 'Whatever’s good', 'Just resting a minute']);
      this.halPick = pick;
      const i = await Promise.race([pick, wait(14).then(() => -1)]);
      pick.cancel();
      this.halPick = null;
      if (!this.customers.includes(c)) { pad(rosie, false); return; }
      const civ = story.civilian;
      if (i >= 0) await story.say(civ ? ['halOrd1', 'halOrd2', 'halOrd3'][i] : ['glOrd1', 'glOrd2', 'glOrd3'][i], { skip: false });
      food = i === 0 ? 'coffee' : i === 1 ? (civ ? 'melt+pie' : 'melt') : null;
      await life.say(rosie, i === 1 ? (civ ? 'rosieOk2' : 'rosieOkG2') : i === 0 ? 'rosieOk1' : 'rosieOk3');
      if (i === 1) life.murmur(this.cook, 'cookHeard');
    } else {
      food = ORDER[c.p.voice]?.food ?? 'melt';
      await life.murmur(c.p, ORDER[c.p.voice]?.line ?? 'coM2');
      await life.murmur(rosie, Math.random() < 0.5 ? 'roOk1' : 'roOk2');
    }
    pad(rosie, false);
    life.look(rosie, null);
    if (!food) { c.phase = 'sitting'; return; }
    c.phase = 'ordered';
    c.order = food;
    if (food === 'coffee') { await this.bringCoffee(c); return; }
    // up to the pass with the ticket
    const x = this.slots[1];
    await this.goTo(rosie, this.W(x, this.r.kz + 0.6), this.Y(0, -1), c.hal ? HURRY : undefined);
    rosie.anim.reach('R', this.W(x + 0.25, this.r.kz + 0.1, SHELF + 0.1), { weight: 1, rate: 4 });
    await wait(0.6);
    const slip = ticket();
    slip.position.copy(this.W(x + 0.3, this.r.kz + 0.15, SHELF + 0.002));
    life.f.scene.add(slip);
    rosie.anim.reach('R', null);
    if (!c.hal && Math.random() < 0.5) life.murmur(rosie, 'roOk3');
    this.tickets[c.hal ? 'unshift' : 'push']({ c, food, slip });
    // Hal's she waits for at the pass, facing the room, and takes straight out (off on her rounds
    // meanwhile, she brought it a minute and more later)
    if (c.hal) {
      life.hold(rosie, this.Y(0, 1));
      while (!this.disposed && this.customers.includes(c) && !this.ready.some((o) => o.c === c)) await wait(0.25);
    }
  }

  // coffee: a mug and the pot from the back bar, to his place
  async bringCoffee(c) {
    const rosie = this.rosie, life = this.life, r = this.r;
    // a mug from whichever end of the back bar is nearer them: by the pots on their warmers, or the stack
    const sx = this.L(c.seat.serve).x, cx = Math.abs(sx - (r.x0 + 7.45)) < Math.abs(sx - (r.x0 + 17.0)) ? r.x0 + 7.45 : r.x0 + 17.0;
    await this.goTo(rosie, this.W(cx, r.cz - 1.75), this.Y(0, -1), c.hal ? HURRY : undefined);
    rosie.anim.reach('R', this.W(cx + 0.1, r.bz - 0.3, FLOOR + 1.0), { weight: 1, rate: 4 });
    await wait(0.5);
    rosie.anim.reach('R', null);
    const m = meal('coffee');
    life.carry(rosie, m, { lift: 0.045 });
    await this.setDown(c, m);
    await life.say(rosie, c.hal ? (life.story.civilian ? 'rosiePour1' : 'rosieG3') : 'roServe1').catch(() => {});
  }

  // to the seat with what she's carrying; leaning over, it goes down in front of them
  async setDown(c, mesh) {
    const rosie = this.rosie, life = this.life;
    await this.goTo(rosie, c.seat.serve, c.seat.serveFace, c.hal ? HURRY : undefined);
    if (!this.customers.includes(c)) { life.put(rosie, rosie.pos.clone().setY(-50)); mesh.removeFromParent(); return; }
    rosie.anim.reach('R', c.seat.plate.clone().add(V(0, 0.08, 0)), { weight: 1, rate: 4, pole: V(0.6, -1, -0.3) });
    for (let i = 0; i < 10; i++) { rosie.anim.lean.pitch = 0.3 * (i / 9); await wait(1 / 15); }
    await wait(0.2);
    const placed = life.put(rosie, c.seat.plate);
    if (placed) placed.rotation.y = c.seat.face + Math.PI;
    life.story.audio.burst({ type: 'bandpass', from: 2400, q: 3, peak: 0.05, dur: 0.05, wet: 0.05 });
    rosie.anim.reach('R', null);
    for (let i = 0; i < 8; i++) { rosie.anim.lean.pitch = 0.3 * (1 - i / 7); await wait(1 / 15); }
    rosie.anim.lean.pitch = 0;
    if (c.plate) c.extra = c.plate; // (the coffee goes to one side; what's eaten is the meal)
    c.plate = placed;
    c.phase = 'eating';
    c.food = c.order;
    c.since = this.t;
  }

  // a plate Dot put up: from the pass to the table
  async serve(order) {
    const rosie = this.rosie, life = this.life, c = order.c;
    this.ready.splice(this.ready.indexOf(order), 1);
    await this.goTo(rosie, this.W(order.x, this.r.kz + 0.6), this.Y(0, -1), c.hal ? HURRY : undefined);
    rosie.anim.reach('R', order.plate.position.clone().add(V(0, 0.06, 0.05)), { weight: 1, rate: 4 });
    await wait(0.45);
    rosie.anim.reach('R', null);
    this.slotUsed[order.slot] = null;
    if (!this.customers.includes(c)) { order.plate.removeFromParent(); return; }
    life.carry(rosie, order.plate, { lift: 0.02 });
    await this.setDown(c, order.plate);
    if (c.hal) await life.say(rosie, life.story.civilian ? 'rosieServe' : 'rosieServeG');
    else await life.murmur(rosie, Math.random() < 0.5 ? 'roServe1' : 'roServe2');
  }

  // a table someone's left: the plates up, back to the tub at the end of the back bar
  async clearTable(job) {
    const rosie = this.rosie, life = this.life, r = this.r;
    this.clear.shift();
    await this.goTo(rosie, job.seat.serve, job.seat.serveFace);
    for (const m of job.plates) {
      rosie.anim.reach('R', m.position.clone().add(V(0, 0.05, 0)), { weight: 1, rate: 4 });
      await wait(0.4);
      m.removeFromParent();
    }
    rosie.anim.reach('R', null);
    job.money?.removeFromParent();
    const stack = meal('dirty');
    life.carry(rosie, stack, { lift: 0.02 });
    await this.goTo(rosie, this.W(r.x0 + 16.0, r.cz - 1.75), this.Y(0, -1));
    rosie.anim.reach('R', this.W(r.x0 + 16.0, r.bz - 0.3, FLOOR + 1.0), { weight: 1, rate: 4 });
    await wait(0.5);
    life.put(rosie, this.W(r.x0 + 16.0, r.bz - 0.3, FLOOR + 0.96));
    rosie.anim.reach('R', null);
    wait(8).then(() => stack.removeFromParent());
  }

  // the pot from its warmer, along the counter, a top-up, the pot back
  async refill(c) {
    const rosie = this.rosie, life = this.life, r = this.r;
    c.refilled = this.t;
    await this.goTo(rosie, this.W(r.x0 + 7.45, r.cz - 1.75), this.Y(0, -1));
    rosie.anim.reach('R', this.W(r.x0 + 7.45, r.bz - 0.35, FLOOR + 1.1), { weight: 1, rate: 4 });
    await wait(0.45);
    rosie.anim.reach('R', null);
    const p = pot();
    life.carry(rosie, p, { lift: 0.0, out: 0.04 });
    await this.goTo(rosie, c.seat.serve, c.seat.serveFace);
    if (!c.hal) life.murmur(rosie, 'roRefill');
    rosie.anim.reach('R', c.seat.plate.clone().add(V(0, 0.25, 0.05)), { weight: 1, rate: 4 });
    await wait(0.5);
    life.story.audio.burst({ type: 'bandpass', from: 900, to: 1400, q: 1.2, peak: 0.04, dur: 1.0, wet: 0.1 });
    await wait(1.0);
    life.carryPose(rosie);
    await this.goTo(rosie, this.W(r.x0 + 7.45, r.cz - 1.75), this.Y(0, -1));
    rosie.anim.reach('R', this.W(r.x0 + 7.45, r.bz - 0.35, FLOOR + 1.0), { weight: 1, rate: 4 });
    await wait(0.4);
    life.put(rosie, rosie.pos.clone().setY(-50));
    p.removeFromParent();
    rosie.anim.reach('R', null);
  }

  // Hal speaks to her: she stops where she is, turns to him, and they talk (her line, his, hers)
  async talkTo() {
    const rosie = this.rosie, life = this.life, story = life.story;
    if (!rosie || rosie.talking) return;
    rosie.paused = true;
    const sets = story.civilian ? (life.f.isNight ? ROSIE_NIGHT : ROSIE_TALK) : ROSIE_GL;
    this.talkN = (this.talkN ?? Math.floor(Math.random() * sets.length)) + 1;
    const [a, b, c] = sets[this.talkN % sets.length];
    await life.say(rosie, a);
    await story.say(b, { skip: false });
    await life.say(rosie, c);
    life.look(rosie, null);
    rosie.paused = false;
  }

  // ---------------------------------------------------------------- Dot
  async cookLoop() {
    const cook = this.cook, life = this.life, r = this.r;
    const line = this.W(r.x0 + 10.0, r.kz - 1.05), lineFace = this.Y(0, -1);
    while (!this.disposed) {
      try {
        const tk = this.tickets.shift();
        if (!tk) {
          // between orders: at the line, scraping the griddle, an eye on the pass now and then
          await life.go(cook, [line], { speed: 0.8, face: lineFace });
          cook.anim.reach('R', this.W(r.x0 + 10.0 + Math.sin(this.t) * 0.3, r.kz - 1.98, FLOOR + 1.0), { weight: 0.8, rate: 3 });
          await wait(rnd(2, 4));
          cook.anim.reach('R', null);
          if (Math.random() < 0.4) { life.hold(cook, this.Y(0, 1)); await wait(rnd(1.5, 2.5)); }
          continue;
        }
        // the ticket off the pass, onto the griddle
        const x = this.slots[1];
        await life.go(cook, [this.W(x, r.kz - 0.55)], { speed: 0.9, face: this.Y(0, 1) });
        cook.anim.reach('R', tk.slip.position.clone(), { weight: 1, rate: 4 });
        await wait(0.5);
        tk.slip.removeFromParent();
        cook.anim.reach('R', null);
        await life.go(cook, [line], { speed: 0.9, face: lineFace });
        const until = this.t + (tk.c.hal ? rnd(6, 8) : rnd(10, 16));
        let side = 0;
        while (this.t < until) {
          side ^= 1;
          cook.anim.reach(side ? 'R' : 'L', this.W(r.x0 + 10.0 + (side ? 0.35 : -0.35) + rnd(-0.1, 0.1), r.kz - 1.98, FLOOR + 1.0), { weight: 1, rate: 5 });
          if (this.inside(life.story.player.position)) life.story.audio.burst({ type: 'highpass', from: 3000, to: 1800, peak: 0.025, dur: 0.6, wet: 0.05 }); // (the griddle)
          await wait(0.7);
        }
        cook.anim.reach('R', null);
        cook.anim.reach('L', null);
        // plated, up on the pass, the bell
        const plate = meal(tk.food);
        life.carry(cook, plate, { lift: 0.02 });
        const slot = Math.max(0, this.slotUsed.findIndex((s) => !s));
        const sx = this.slots[slot];
        this.slotUsed[slot] = tk;
        await life.go(cook, [this.W(sx, r.kz - 0.55)], { speed: 0.9, face: this.Y(0, 1) });
        cook.anim.reach('R', this.W(sx, r.kz - 0.05, SHELF + 0.08), { weight: 1, rate: 4 });
        await wait(0.5);
        const placed = life.put(cook, this.W(sx, r.kz - 0.05, SHELF));
        cook.anim.reach('R', null);
        life.story.audio.bell(2093, 0.1, 1.2);
        life.murmur(cook, 'cookUp');
        this.ready.push({ c: tk.c, food: tk.food, plate: placed, x: sx, slot });
      } catch (e) { console.warn('dot', e); await wait(1); }
    }
  }

  // ---------------------------------------------------------------- Hal at a table
  halSits(sp) {
    const s = sp.seat;
    if (!s) return;
    s.taken = 'hal';
    this.customers.push({ hal: true, seat: s, phase: 'wait', since: this.t });
    // busy with someone else: she lets him know she's seen him
    const rosie = this.rosie;
    if (rosie && rosie.state === 'route' && !rosie.talking) wait(1.2).then(() => { if (this.customers.some((c) => c.hal && c.phase === 'wait')) this.life.say(rosie, this.life.story.civilian ? 'rosieWait' : 'rosieWaitG'); });
  }
  halStands(sp) {
    const i = this.customers.findIndex((c) => c.hal);
    if (i < 0) return;
    const c = this.customers[i];
    this.customers.splice(i, 1);
    this.halPick?.cancel();
    this.tickets = this.tickets.filter((t) => t.c !== c);
    const plates = [c.plate, c.extra].filter(Boolean);
    if (plates.length) this.clear.push({ seat: c.seat, plates });
    if (c.seat) c.seat.taken = null;
    this.life.story.player.animator.reach('R', null);
  }

  // ---------------------------------------------------------------- each frame
  update(dt) {
    const life = this.life, story = life.story, hp = story.player.position;
    this.t += dt;
    // Hal comes in: she says hello from wherever she is (and the room looks up)
    const inside = this.inside(hp);
    if (inside && !this.halIn && this.rosie?.active && !this.rosie.talking && story.player.control && this.t - (this.hiT ?? -99) > 60) {
      this.hiT = this.t;
      const key = story.civilian ? (life.f.isNight ? 'rosieHiEve' : 'rosie1') : 'rosieHiG';
      wait(0.6).then(() => life.say(this.rosie, key));
      for (const c of this.customers) if (!c.hal) { life.look(c.p, life.halHead(), 0.6); wait(rnd(1.5, 3)).then(() => life.look(c.p, c.p.partner ? life.headOf(c.p.partner) : null, 0.6)); }
      if (!story.civilian) wait(2.5).then(() => life.murmur(this.cook, 'cookG1'));
    }
    this.halIn = inside;
    // the customers: eating, done, out
    for (const c of [...this.customers]) {
      if (c.hal) { this.halEats(c); continue; }
      if (c.phase === 'eating') this.eat(c, dt);
      if (c.phase === 'done' && this.t > c.leaveAt) this.leave(c).catch((e) => console.warn('diner leaving', e));
    }
    // someone off the street comes in (fewer by night)
    if (this.t > this.nextArrival) {
      const n = this.customers.filter((c) => !c.hal).length;
      // (nobody passing the door just now: look again soon)
      this.nextArrival = this.t + (n < 5 && !this.arrive() ? 6 : rnd(25, 45) * (life.f.isNight ? 1.8 : 1) * (n < 2 ? 0.5 : 1));
    }
  }

  // a bite: the fork to the mouth, the food a little lower; coffee in sips. Done after a dozen.
  eat(c, dt) {
    const p = c.p;
    c.next ??= this.t + rnd(2, 5);
    if (this.t < c.next || p.talking || p.state !== 'seated') return;
    c.next = this.t + rnd(3.5, 7);
    const mouth = V(0, 0, 0);
    p.per.setGrip('R', 'hold');
    p.anim.reach('R', () => { p.rig.bonePosition('head', mouth); const y = p.rig.root.rotation.y; return mouth.add(_a.set(Math.sin(y) * 0.12, -0.06, Math.cos(y) * 0.12)); }, { weight: 1, rate: 4.5 });
    wait(0.9).then(() => { p.anim.reach('R', null, { rate: 3 }); p.per.setGrip('R', 'relaxed'); });
    c.bites++;
    if (c.plate) shrink(c.plate, c.bites / 14);
    if (c.bites >= 12 + (c.p.partner ? 2 : 0)) {
      c.phase = 'done';
      c.leaveAt = this.t + rnd(4, 9);
      // a couple leaves together
      const other = p.partner && this.customers.find((o) => o.p === p.partner);
      if (other && other.phase !== 'done') { other.phase = 'done'; other.leaveAt = c.leaveAt; }
    }
  }

  // Hal eats what she brought (while he sits): the same bites
  halEats(c) {
    const player = this.life.story.player;
    if (c.phase !== 'eating' || !this.life.story.seated) return;
    c.next ??= this.t + 2;
    if (this.t < c.next) return;
    c.next = this.t + rnd(4, 6);
    const mouth = V(0, 0, 0);
    player.animator.reach('R', () => { player.rig.bonePosition('head', mouth); const y = player.yaw; return mouth.add(_a.set(Math.sin(y) * 0.13, -0.06, Math.cos(y) * 0.13)); }, { weight: 1, rate: 4 });
    wait(0.9).then(() => player.animator.reach('R', null, { rate: 3 }));
    c.bites = (c.bites ?? 0) + 1;
    if (c.plate) shrink(c.plate, Math.min(1, c.bites / 10));
  }

  // money on the table, up, out the door, and back onto the pavement as a passer-by
  async leave(c) {
    const life = this.life, p = c.p, s = c.seat;
    c.phase = 'leaving';
    const money = bill();
    money.position.copy(s.plate).add(V(0, 0.002, 0)).addScaledVector(_a.set(Math.sin(s.face), 0, Math.cos(s.face)), -0.22);
    life.f.scene.add(money);
    if (Math.random() < 0.6) life.murmur(p, p.voice.startsWith('townf') ? 'coByeF' : 'coByeM');
    await tween(0.6, (k) => p.pos.lerpVectors(s.at, s.approach, ease.inOut(k)));
    p.anim.play(p.loco, 0.4);
    s.taken = null;
    if (s.spot) s.spot.taken = false;
    this.customers.splice(this.customers.indexOf(c), 1);
    this.clear.push({ seat: s, plates: [c.plate, c.extra].filter(Boolean), money });
    const d = this.door, din = d.inside.clone().add(this.origin).setY(FLOOR), dout = d.at.clone().multiplyScalar(2).sub(d.inside).add(this.origin).setY(0.14);
    const curb = dout.clone().add(V(2.0, 0, 0)).setY(0.14); // (out onto the pavement's walking line)
    await life.go(p, [...this.route(p.pos, din), dout, curb], { speed: 1.15 });
    if (Math.random() < 0.5) life.murmur(this.rosie, 'roBye');
    p.kind = 'walker';
    p.inside = false;
    p.state = 'walk';
    p.dir = Math.random() < 0.5 ? 1 : -1;
    p.lane0 = p.lane = 0.3;
    p.speed = 1.25;
    p.night = Math.random() < 0.5;
    life.rejoin(p);
  }

  // a passer-by near the door turns in: in, to a free seat, sat down; she'll come for the order
  arrive() {
    const life = this.life, d = this.door, dout = d.at.clone().multiplyScalar(2).sub(d.inside).add(this.origin).setY(0.14);
    const p = life.people.find((q) => q.kind === 'walker' && q.active && q.state === 'walk' && q.pos.distanceTo(dout) < 36 && Math.abs(q.pos.x - dout.x) < 6 && !q.talking);
    if (!p) return false;
    const free = Object.values(this.seats).filter((s) => !s.taken && !this.clear.some((j) => j.seat.table === s.table) && !Object.values(this.seats).some((o) => o.table === s.table && o.taken));
    if (!free.length) return true;
    const s = free[Math.floor(Math.random() * free.length)];
    s.taken = p;
    if (s.spot) s.spot.taken = true;
    p.kind = 'diner';
    p.inside = true;
    p.sit = s.sit;
    p.stool = !!s.stool;
    const din = d.inside.clone().add(this.origin).setY(FLOOR);
    (async () => {
      await life.go(p, [dout, din, ...this.route(din, s.approach)], { speed: 1.15, face: s.face });
      p.state = 'hold';
      await tween(0.6, (k) => p.pos.lerpVectors(s.approach, s.at, ease.inOut(k)));
      p.home = s.at.clone(); // (a walker had none)
      p.yaw = s.face;
      p.state = 'seated';
      life.seatPose(p);
      this.customers.push({ p, seat: s, phase: 'wait', since: this.t, bites: 0 });
    })().catch((e) => console.warn('diner arrival', e));
    return true;
  }

  dispose() { this.disposed = true; }
}

// what each voice orders
const ORDER = {
  townm1: { line: 'coM1', food: 'melt' }, townm2: { line: 'coM2', food: 'melt' }, townm3: { line: 'coM3', food: 'stack' },
  townf1: { line: 'coF1', food: 'soup' }, townf2: { line: 'coF2', food: 'tuna' }, townf3: { line: 'coF3', food: 'pie' }, citykid: { line: 'coK1', food: 'shake' },
};
// talking with Rosie: [hers, his, hers]
const ROSIE_TALK = [['rosie2', 'halRc1', 'rosieRc1'], ['rosie3', 'halRc2', 'rosieRc2'], ['rosie4', 'halRc3', 'rosieRc3'], ['rosieRc4a', 'halRc4', 'rosieRc4b'], ['rosie5', 'halRc5', 'rosieRc5']];
const ROSIE_NIGHT = [['rosieNight1', 'halRc6', 'rosieNight2'], ...ROSIE_TALK];
const ROSIE_GL = [['rosieG1', 'glRc1', 'rosieRg1'], ['rosieG2', 'glRc2', 'rosieRg2']];

// ---------------------------------------------------------------- the diner's things
const M = {};
const mat = (key, opts) => (M[key] ??= new THREE.MeshStandardMaterial(opts));
const china = () => mat('china', { color: 0xe9e5dc, roughness: 0.5, envMapIntensity: 0.45 }); // (glossier, the sun on it bloomed white)
function part(g, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }

// a plate (or a mug, a bowl, a glass) with what was ordered on it; `userData.food` is what's eaten
export function meal(kind) {
  const g = new THREE.Group(), food = new THREE.Group();
  g.userData.food = food;
  g.add(food);
  const plate = () => { part(g, new THREE.CylinderGeometry(0.125, 0.09, 0.016, 28), china(), 0, 0.008, 0); part(g, new THREE.TorusGeometry(0.118, 0.006, 6, 28).rotateX(Math.PI / 2), china(), 0, 0.016, 0); };
  const mug = (x = 0, z = 0, into = g) => {
    const cup = part(into, new THREE.CylinderGeometry(0.043, 0.037, 0.095, 18, 1, true), mat('mug', { color: 0xf4f1ea, roughness: 0.35, side: THREE.DoubleSide }), x, 0.0475, z);
    part(into, new THREE.CircleGeometry(0.037, 18).rotateX(Math.PI / 2), cup.material, x, 0.001, z);
    part(into, new THREE.TorusGeometry(0.025, 0.007, 8, 14, Math.PI).rotateZ(-Math.PI / 2), cup.material, x + 0.045, 0.05, z);
    part(food, new THREE.CircleGeometry(0.04, 18).rotateX(-Math.PI / 2), mat('coffee', { color: 0x1c0d06, roughness: 0.15 }), x, 0.08, z);
  };
  const toast = mat('toast', { color: 0xc08a46, roughness: 0.8 }), cheese = mat('cheese', { color: 0xf0b83a, roughness: 0.6 });
  if (kind === 'coffee') { mug(); return g; }
  if (kind === 'dirty') { plate(); part(g, new THREE.CylinderGeometry(0.125, 0.09, 0.016, 28), china(), 0, 0.026, 0); part(g, new THREE.CylinderGeometry(0.125, 0.09, 0.016, 28), china(), 0.01, 0.044, 0.005); return g; }
  if (kind === 'shake') {
    part(g, new THREE.CylinderGeometry(0.045, 0.03, 0.2, 16, 1, true), mat('glassware', { color: 0xddeeff, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0, 0.1, 0);
    part(food, new THREE.CylinderGeometry(0.043, 0.03, 0.17, 16), mat('shake', { color: 0xf4c8d0, roughness: 0.5 }), 0, 0.09, 0);
    part(food, new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('cream', { color: 0xfbf8f2, roughness: 0.6 }), 0, 0.2, 0);
    part(food, new THREE.SphereGeometry(0.012, 10, 8), mat('cherry', { color: 0xb5121b, roughness: 0.25 }), 0, 0.245, 0);
    return g;
  }
  if (kind === 'soup') {
    part(g, new THREE.CylinderGeometry(0.16, 0.12, 0.012, 28), china(), 0, 0.006, 0);
    part(g, new THREE.SphereGeometry(0.075, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('bowl', { color: 0xf6f3ec, roughness: 0.28, side: THREE.DoubleSide }), 0, 0.085, 0);
    part(food, new THREE.CircleGeometry(0.068, 20).rotateX(-Math.PI / 2), mat('soupc', { color: 0xc9762e, roughness: 0.3 }), 0, 0.07, 0);
    return g;
  }
  plate();
  if (kind === 'melt' || kind === 'melt+pie' || kind === 'tuna') {
    for (const [x, z, r] of [[-0.03, 0.0, 0.25], [0.035, -0.02, -0.4]]) {
      const half = new THREE.Group();
      half.position.set(x, 0.016, z); half.rotation.y = r;
      part(half, new THREE.BoxGeometry(0.1, 0.014, 0.085), toast, 0, 0.007, 0);
      part(half, new THREE.BoxGeometry(0.096, 0.012, 0.082), kind === 'tuna' ? mat('tuna', { color: 0xe8dcc0, roughness: 0.7 }) : mat('patty', { color: 0x5a3220, roughness: 0.75 }), 0, 0.02, 0);
      if (kind !== 'tuna') part(half, new THREE.BoxGeometry(0.104, 0.004, 0.088), cheese, 0, 0.028, 0);
      part(half, new THREE.BoxGeometry(0.1, 0.014, 0.085), toast, 0, 0.037, 0);
      food.add(half);
    }
    const fry = mat('fry', { color: 0xe6b44c, roughness: 0.7 });
    for (let i = 0; i < 12; i++) { const f = part(food, new THREE.BoxGeometry(0.009, 0.009, 0.07), fry, 0.05 + Math.cos(i) * 0.02, 0.022 + (i % 3) * 0.006, 0.05 + Math.sin(i * 1.7) * 0.02); f.rotation.y = i * 0.9; }
  }
  if (kind === 'stack') {
    const cake = mat('cake', { color: 0xd49a52, roughness: 0.7 });
    for (let i = 0; i < 3; i++) part(food, new THREE.CylinderGeometry(0.075, 0.075, 0.014, 24), cake, 0, 0.024 + i * 0.015, 0);
    part(food, new THREE.BoxGeometry(0.022, 0.012, 0.022), mat('butter', { color: 0xfff0a8, roughness: 0.4 }), 0, 0.07, 0);
  }
  if (kind === 'pie' || kind === 'melt+pie') {
    const slice = new THREE.Group();
    slice.position.set(kind === 'pie' ? 0 : 0.2, 0, kind === 'pie' ? 0 : 0.04);
    if (kind !== 'pie') part(slice, new THREE.CylinderGeometry(0.085, 0.065, 0.012, 24), china(), 0, 0.006, 0);
    part(slice, new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16, 1, false, 0, Math.PI / 4), mat('crust', { color: 0xd8a35c, roughness: 0.8 }), -0.03, 0.034, -0.03);
    part(slice, new THREE.CylinderGeometry(0.08, 0.08, 0.004, 16, 1, false, 0, Math.PI / 4), mat('cherryf', { color: 0x9e1420, roughness: 0.35 }), -0.03, 0.056, -0.03);
    food.add(slice);
    if (kind === 'pie') mug(0.17, 0.02);
  }
  return g;
}
// what's left of it (k eaten, 0..1)
function shrink(g, k) {
  const f = g.userData.food;
  if (!f) return;
  const s = Math.max(0.05, 1 - k);
  f.scale.set(Math.max(0.35, s), s, Math.max(0.35, s));
  f.visible = k < 0.98;
}
function ticket() {
  return new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.002, 0.11), mat('ticket', { color: 0xfbfbf0, roughness: 0.9 }));
}
function bill() {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(0.155, 0.002, 0.066), mat('bill', { color: 0x8fa883, roughness: 0.9 }), 0, 0.001, 0);
  return g;
}
function pot() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.075, 0.09, 0.18, 16, 1, true), mat('carafe', { color: 0xddeeff, roughness: 0.05, transparent: true, opacity: 0.4, side: THREE.DoubleSide }), 0, 0.09, 0);
  part(g, new THREE.CylinderGeometry(0.07, 0.085, 0.09, 16), mat('coffee', { color: 0x1c0d06, roughness: 0.15 }), 0, 0.05, 0);
  part(g, new THREE.CylinderGeometry(0.05, 0.078, 0.04, 16), mat('lid', { color: 0x1a1a1a, roughness: 0.5 }), 0, 0.2, 0);
  part(g, new THREE.BoxGeometry(0.02, 0.1, 0.03), mat('lid', {}), 0.09, 0.12, 0);
  return g;
}
// her order pad in the left hand, the right hand by it with the pencil
function pad(p, on) {
  if (on) {
    p.pad ??= (() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.105, 0.008), mat('padm', { color: 0xf5f3e6, roughness: 0.9 })); return m; })();
    const palm = p.rig.palm('L');
    p.rig.bones.hand_L.add(p.pad);
    p.pad.position.copy(palm.centre).addScaledVector(palm.normal, palm.surface + 0.006);
    p.per.setGrip('L', 'hold');
    const at = V(0, 0, 0), at2 = V(0, 0, 0);
    const front = (out, side, up) => { const y = p.rig.root.rotation.y; p.rig.bonePosition('chest', out); return out.add(_a.set(Math.sin(y) * 0.32 - Math.cos(y) * side, up, Math.cos(y) * 0.32 + Math.sin(y) * side)); };
    p.anim.reach('L', () => front(at, -0.05, 0.02), { weight: 1, rate: 4 });
    p.anim.reach('R', () => front(at2, 0.04, 0.05), { weight: 1, rate: 4 });
  } else {
    p.pad?.removeFromParent();
    p.per.setGrip('L', 'relaxed');
    p.anim.reach('L', null);
    p.anim.reach('R', null);
  }
}
