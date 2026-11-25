// Shopping in Hal's block (the user, 2026-11-24: "make the interactable shops even more interactive"): what's on the
// shelves (city/Stock.js) taken off them by hand. E at a shelf takes what he's looking at ("Take a bag of chips ·
// $0.35"): he reaches for it (a cooler's through its door) and carries it, on his palm in front of him or, a bigger
// thing, in both hands. At the counter the one who works there rings it up; then it's eaten there and then or kept
// (story/Inventory.js). E by the shelf it came from puts it back. Walking out with it: they call after him, and
// remember it next time. Knocking the stock about: they say so, and a broken bottle is his.
import * as THREE from 'three';
import { wait, tween, ease, onFrame } from '../engine/Time.js';
import { money } from './Life.js';
import { PRODUCTS } from '../city/Stock.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// what they say, by voice (lines.js): Ray at Coast Liquor has his own
const SAY = {
  stop: { clerk: 'clerkStop', townm1: 'stopM1', townm2: 'stopM2', townm3: 'stopM3', townf1: 'stopF1', townf2: 'stopF2', townf3: 'stopF3' },
  warn: { clerk: 'clerkWarn', townm1: 'warnM1', townm2: 'warnM2', townm3: 'warnM3', townf1: 'warnF1', townf2: 'warnF2', townf3: 'warnF3' },
  knock: { clerk: 'clerkKnock', townm1: 'knockM1', townm2: 'knockM2', townm3: 'knockM3', townf1: 'knockF1', townf2: 'knockF2', townf3: 'knockF3' },
  broke: { clerk: 'clerkBreak', townm1: 'breakM1', townm2: 'breakM2', townm3: 'breakM3', townf1: 'breakF1', townf2: 'breakF2', townf3: 'breakF3' },
  owed: { clerk: 'clerkOwed', townm1: 'owedM1', townm2: 'owedM2', townm3: 'owedM3', townf1: 'owedF1', townf2: 'owedF2', townf3: 'owedF3' },
  thanks: { clerk: 'clerkThanks', townm1: 'thxM1', townm2: 'thxM2', townm3: 'thxM3', townf1: 'thxF1', townf2: 'thxF2', townf3: 'thxF3' },
  short: { clerk: 'clerkShort', townm1: 'shortM1', townm2: 'shortM2', townm3: 'shortM3', townf1: 'shortF1', townf2: 'shortF2', townf3: 'shortF3' },
  gl: { clerk: 'clerkGFree', townm1: 'shopGLm', townm2: 'shopGLm', townm3: 'shopGLm', townf1: 'shopGLf', townf2: 'shopGLf', townf3: 'shopGLf' },
};
// a menu's food over a counter (city/Shops.js SHOPS `sell`) that's also in the case: handed over as itself
const OVER_COUNTER = [[/donut/i, (n) => (/chocolate/i.test(n) ? 'donutChoc' : 'donut')], [/muffin/i, 'muffin'], [/croissant/i, 'croissant'], [/pan dulce/i, 'concha'], [/bolillo/i, 'roll'], [/brioche/i, 'brioche'], [/soda/i, 'soda1'], [/candy/i, 'candyMilk'], [/aspirin/i, 'pills']];
export const caseItem = (name) => { for (const [re, k] of OVER_COUNTER) if (re.test(name)) return typeof k === 'function' ? k(name) : k; return null; };

export class Shopping {
  constructor(story, f) {
    Object.assign(this, { story, f });
    this.stock = f.block?.ctx?.stockRun ?? null;
    this.hands = { R: null, L: null }; // { it, o, P, paid, room, both }
    this.owed = new Map(); // room -> what he walked out with, or broke (this session)
    this.said = new Map(); // room -> when they last said something
    this.aimed = null;
    if (!this.stock) return;
    const st = this.stock;
    st.player = story.player;
    st.powers = story.powers;
    st.onKnock = (it) => this.knocked(it);
    st.onBreak = (it) => this.broke(it);
    // the shelves' one prompt, wherever he's looking: take it, or (carrying something from here) put it back
    const self = this, far = V(0, -500, 0);
    this.it = f.interact({ radius: 1.35, label: '', action: () => this.act() });
    Object.defineProperty(this.it, 'position', { get: () => self.promptAt ?? far, set() {} });
    Object.defineProperty(this.it, 'look', { get: () => self.promptAt ?? null, set() {} });
    Object.defineProperty(this.it, 'enabled', { get: () => !!self.promptAt, set() {} });
    Object.defineProperty(this.it, 'label', { get: () => self.promptLabel ?? '', set() {} });
  }

  get holding() { return Object.values(this.hands).filter(Boolean).filter((h, i, a) => a.indexOf(h) === i); }
  unpaid(room = null) { return this.holding.filter((h) => !h.paid && (!room || h.room === room)); }
  free(side) { return !this.hands[side]; }

  // ---------------------------------------------------------------- each frame (Roam.update)
  update(dt) {
    const s = this.story, st = this.stock, pl = s.player;
    if (!st || s.current !== this.f) { if (this.holding.length) this.letGo(); return; }
    // in the air, in the car, changed, sat down: what's in his hands is put away (kept if it's his) or set down
    if (this.holding.length && (pl.flying || s.driving || s.seated || this.civilian !== s.civilian)) this.letGo();
    this.civilian = s.civilian;
    for (const h of this.holding) if (h.both) this.carryBoth(h);
    // what he's looking at
    const cam = s.engine.camera, chest = pl.rig ? pl.rig.bonePosition('chest', this._chest ??= V(0, 0, 0)) : pl.position;
    const dir = cam.getWorldDirection(this._dir ??= V(0, 0, 0));
    const can = pl.control && !s.busy && !pl.flying && !s.driving && !this.acting;
    const it = can ? st.aim(chest, cam.position, dir) : null;
    // (taking, if he's a hand for it; else putting back what he took here, standing where he took it; else his hands
    // are full)
    let at = null, label = null;
    const back = can ? this.holding.find((h) => !h.paid && h.it.home && Math.hypot(pl.position.x - h.it.home.x, pl.position.z - h.it.home.z) < 1.0) : null;
    if (it && this.handsFor(it.P)) {
      const price = this.priceIn(it.room, it.P);
      at = st.centre(it, this._at ??= V(0, 0, 0));
      label = `Take ${it.P.name}${price ? ` · ${s.civilian ? money(price) : 'on the house'}` : ''}`;
    } else if (back) { at = back.it.home; label = `Put back ${back.P.name}`; }
    else if (it) { at = st.centre(it, this._at ??= V(0, 0, 0)); label = 'Hands full · pay for it, or put it back'; }
    this.aimed = it && this.handsFor(it.P) ? it : null;
    this.putBackOf = this.aimed ? null : back;
    this.full = !!it && !this.aimed && !back;
    this.promptAt = at;
    if (label !== this.promptLabel) {
      this.promptLabel = label;
      if (s.focus === this.it) s.ui.prompt(this.it.key, label); // (the prompt shows a new item without leaving the old)
    }
    // walking out with what he hasn't paid for
    this.watchDoor();
  }

  // the price in this shop (the bar's glasses aren't for sale; the case's are bought at the counter)
  priceIn(room, P) { return P.price ?? 0; }
  // a hand (or two) free for it
  handsFor(P) { return P.carry === 'both' ? this.free('R') && this.free('L') : this.free('R') || this.free('L'); }

  async act() {
    if (this.aimed) return this.take(this.aimed);
    if (this.putBackOf) return this.putBack(this.putBackOf);
    if (this.full) return this.story.bark('halHandsFull');
  }

  // ---------------------------------------------------------------- taking
  async take(it) {
    const s = this.story, st = this.stock, pl = s.player, anim = pl.animator, P = it.P;
    if (!pl.rig) return;
    this.acting = true;
    const both = P.carry === 'both', side = both ? 'R' : this.free('R') ? 'R' : 'L';
    // turned to it, the hand out to it (a cooler's: to its door, which opens; never through the glass)
    const c = st.centre(it, V(0, 0, 0)), reachAt = c.clone();
    if (it.door != null) reachAt.copy(V(it.x, it.y + P.size[1] * 0.5, it.door).applyMatrix4(it.M).add(st.origin));
    pl.turnTo(Math.atan2(c.x - pl.position.x, c.z - pl.position.z), 7);
    pl.lookAt(c, 0.8);
    const hold = { it, P, room: it.room, paid: !s.civilian || !P.price, both, side, home: null };
    if (it.state === 'shelf') it.home = pl.position.clone();
    const reach = (sd, at) => anim.reach(sd, () => at, { weight: 1, rate: 9, pole: V(sd === 'R' ? 0.5 : -0.5, -0.9, -0.3) });
    if (both) { reach('R', reachAt.clone().addScaledVector(this.right(), 0.08)); reach('L', reachAt.clone().addScaledVector(this.right(), -0.08)); }
    else reach(side, reachAt);
    if (it.door != null) { await wait(0.22); s.audio.tone?.({ type: 'triangle', freq: 220, to: 160, peak: 0.03, dur: 0.12 }); }
    await wait(0.32);
    const o = st.take(it);
    if (!o) { this.acting = false; this.rest(side, both); return; }
    hold.o = o;
    s.current.scene.add(o);
    if (both) { this.hands.R = this.hands.L = hold; this.carryBoth(hold); }
    else { this.hands[side] = hold; this.onPalm(hold, side); }
    s.audio.clatter?.(0.12);
    this.rest(side, both);
    pl.lookAt(null);
    await wait(0.25);
    this.acting = false;
    this.hint();
  }
  // the prompt of what to do with it, once a visit
  hint() {
    if (this.hinted || !this.story.civilian) return;
    this.hinted = true;
    this.story.ui.toast('Pay at the counter · or E at the shelf to put it back');
  }

  right() { const y = this.story.player.yaw ?? this.story.player.object.rotation.y; return V(Math.cos(y), 0, -Math.sin(y)); }
  fwd() { const y = this.story.player.yaw ?? this.story.player.object.rotation.y; return V(Math.sin(y), 0, Math.cos(y)); }

  // On his palm, in front of him at the waist, the elbow bent: the item stood on it (a bag or a bar laid on its back),
  // and the hand turned palm up after the arm's IK (`post`)
  onPalm(h, side) {
    const pl = this.story.player, rig = pl.rig, hand = rig.bones[`hand_${side}`], palm = rig.palm(side), P = h.P;
    hand.add(h.o);
    const Y = palm.normal.clone(), Z = palm.along.clone().negate(), X = new THREE.Vector3().crossVectors(Y, Z);
    const Qp = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const R = new THREE.Quaternion();
    if (P.lie) R.setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
    // the item's box turned so, its foot on the palm and its middle over the palm's middle
    const [w, ht, d] = P.size, box = new THREE.Box3(V(-w / 2, 0, -d / 2), V(w / 2, ht, d / 2)).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(R));
    // (a long thing laid along his hand, its end at the heel of it: centred, a bottle ran back over his wrist)
    const c = box.getCenter(V(0, 0, 0)), len = box.max.z - box.min.z, shift = V(-c.x, -box.min.y, -c.z - Math.max(0, len / 2 - 0.07)).applyQuaternion(Qp);
    // (scaled as the hand bone is: the item's in metres in the world)
    const k = 1 / hand.getWorldScale(V(0, 0, 0)).x;
    h.o.scale.setScalar(k);
    h.o.quaternion.copy(Qp).multiply(R);
    h.o.position.copy(palm.centre).addScaledVector(Y, palm.surface + 0.003 * k).addScaledVector(shift, k);
    h.palm = { side, Qp, R, base: h.o.position.clone() };
    this.pose(side);
    this.posts();
  }
  // the carrying arm's target: out in front at the waist, a little to its side
  pose(side) {
    const pl = this.story.player, rig = pl.rig, at = V(0, 0, 0), sg = side === 'R' ? -1 : 1;
    // (out to the side by half what's on it: a cereal box in one hand and a bottle in the other met in the middle)
    const P = this.hands[side]?.P, across = P ? (P.lie ? P.size[0] : Math.max(P.size[0], P.size[2])) : 0.1, out = 0.11 + across / 2;
    pl.animator.reach(side, () => {
      rig.bonePosition('hips', at);
      const y = pl.object.rotation.y, f = V(Math.sin(y), 0, Math.cos(y)), r = V(Math.cos(y), 0, -Math.sin(y));
      return at.addScaledVector(f, 0.3).addScaledVector(r, -sg * out).add(V(0, 0.14, 0));
    }, { weight: 1, rate: 5, pole: V(-sg * 0.5, -1, -0.6) });
  }
  rest(side, both) {
    const anim = this.story.player.animator;
    for (const sd of both ? ['R', 'L'] : [side]) {
      const h = this.hands[sd];
      if (!h) anim.reach(sd, null, { rate: 5 });
      else if (!h.both) this.pose(sd);
    }
  }
  // the hands turned after the IK: a palm up under what's on it; both palms in against a thing held in both
  posts() {
    const pl = this.story.player, anim = pl.animator, rig = pl.rig;
    if (this.post) return;
    const base = anim.post, m = new THREE.Matrix4(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), A = V(0, 0, 0), N = V(0, 0, 0), C = V(0, 0, 0);
    const Lt = {};
    for (const sd of ['R', 'L']) { const p = rig.palm(sd); Lt[sd] = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(p.along, p.normal), p.along, p.normal).transpose(); }
    this.post = (r, dt) => {
      base?.(r, dt);
      const y = pl.object.rotation.y, f = V(Math.sin(y), 0, Math.cos(y)), rt = V(Math.cos(y), 0, -Math.sin(y));
      for (const sd of ['R', 'L']) {
        const h = this.hands[sd];
        if (!h || h.eating) continue;
        const hand = rig.bones[`hand_${sd}`], sg = sd === 'R' ? -1 : 1;
        if (h.both) { N.copy(rt).multiplyScalar(-sg); A.copy(f); } // (palms in: the right hand's faces left)
        else { N.copy(UP); A.copy(f).addScaledVector(rt, -sg * 0.3).normalize(); } // (fingers forward and a little out: what's on each hand points away from the other's)
        C.crossVectors(A, N);
        qw.setFromRotationMatrix(m.makeBasis(C, A, N).multiply(Lt[sd]));
        hand.parent.getWorldQuaternion(qp).invert();
        hand.quaternion.slerp(qp.multiply(qw), Math.min(1, (h.w = Math.min(1, (h.w ?? 0) + dt * 4))));
        hand.updateMatrixWorld(true);
      }
    };
    anim.post = this.post;
    this.unpost = base;
  }
  unposts() {
    if (!this.post || this.holding.length) return;
    const anim = this.story.player.animator;
    if (anim.post === this.post) anim.post = this.unpost ?? null;
    this.post = null;
  }

  // in both hands, in front of his chest: placed each frame, the hands to its sides
  carryBoth(h) {
    const pl = this.story.player, rig = pl.rig, P = h.P, [w, ht, d] = P.size;
    const chest = rig.bonePosition('chest', this._c ??= V(0, 0, 0)), f = this.fwd(), r = this.right();
    h.o.position.copy(chest).addScaledVector(f, 0.24 + d / 2).add(V(0, -0.3 - ht * 0.3, 0));
    h.o.quaternion.setFromAxisAngle(UP, pl.object.rotation.y); // (its label out, the way it was on the shelf)
    h.o.scale.setScalar(1);
    if (!h.armed) {
      h.armed = true;
      const at = (sg) => { const v = V(0, 0, 0); return () => v.copy(h.o.position).add(V(0, ht * 0.5, 0)).addScaledVector(this.right(), sg * (w / 2 + 0.035)); };
      pl.animator.reach('R', at(1), { weight: 1, rate: 6, pole: V(0.6, -1, -0.4) });
      pl.animator.reach('L', at(-1), { weight: 1, rate: 6, pole: V(-0.6, -1, -0.4) });
      this.posts();
    }
    void r;
  }

  // ---------------------------------------------------------------- putting back, letting go
  async putBack(h) {
    const s = this.story, pl = s.player, it = h.it;
    this.acting = true;
    const at = V(it.x, it.y + h.P.size[1] * 0.5, it.z).applyMatrix4(it.M).add(this.stock.origin);
    for (const sd of h.both ? ['R', 'L'] : [h.side]) pl.animator.reach(sd, () => at, { weight: 1, rate: 8 });
    pl.turnTo(Math.atan2(at.x - pl.position.x, at.z - pl.position.z), 7);
    await wait(0.35);
    this.release(h);
    this.stock.restock(it);
    s.audio.clatter?.(0.1);
    await wait(0.15);
    this.acting = false;
  }
  // out of his hands (the object stays with its item)
  release(h) {
    for (const sd of ['R', 'L']) if (this.hands[sd] === h) { this.hands[sd] = null; this.story.player.animator.reach(sd, null, { rate: 5 }); }
    h.o?.removeFromParent();
    this.unposts();
  }
  // His hands emptied (the suit, the car, the sky): what's paid for into his pockets, the rest set down at his feet
  letGo() {
    const s = this.story, st = this.stock;
    for (const h of this.holding) {
      if (h.paid) { this.keep(h); continue; }
      const p = h.o.getWorldPosition(V(0, 0, 0)), q = h.o.getWorldQuaternion(new THREE.Quaternion());
      this.release(h);
      if (s.current === this.f) st.release(h.it, p, q, V(0, -0.3, 0));
      else st.restock(h.it);
    }
  }
  keep(h, silent = false) {
    this.release(h);
    if (!h.temp) this.stock.consume(h.it);
    const item = this.story.inventory?.add({ key: h.P.key, from: h.room });
    if (!silent && item) this.story.ui.toast(`${cap(h.P.short)} · kept`);
    return item;
  }

  // ---------------------------------------------------------------- the counter
  // E at a counter with goods from this shop in his hands: rung up. True if that's what happened (Roam leaves the
  // counter's own menu for when it isn't).
  async checkout(room, keeper) {
    const s = this.story, held = this.unpaid(room), owed = this.owed.get(room) ?? 0;
    if (!held.length && !owed) return false;
    const voice = keeper?.voice ?? 'townm1', say = (what) => (keeper ? this.say(keeper, SAY[what][voice] ?? SAY[what].townm1) : null);
    if (!s.civilian) {
      await say('gl');
      for (const h of held) h.paid = true;
      this.owed.delete(room);
    } else {
      const total = held.reduce((n, h) => n + (h.P.price ?? 0), 0) + owed;
      if (owed) await say('owed');
      if (!s.life?.spend(total, held.length ? held.map((h) => h.P.short).join(', ') : 'what he owed')) { s.audio.denied?.(); await say('short'); return true; }
      s.audio.bell(2400, 0.05, 1.2); // (the register)
      for (const h of held) h.paid = true;
      this.owed.delete(room);
      s.ui.toast(`${money(total)} · ${held.length ? held.map((h) => h.P.short).join(', ') : 'paid up'}`);
      await say('thanks');
    }
    await this.eatOrKeep(held);
    return true;
  }
  // a thing bought over a counter (the menus: a donut out of the case, a bowl of phở) into his hand or his pocket
  async bought(name, heal, kind = 'food') {
    const key = caseItem(name), s = this.story;
    const pick = s.ui.pick(cap(name.replace(/^an? /i, '')), ['Eat it now', 'Keep it']);
    const i = await Promise.race([pick, wait(10).then(() => 1)]);
    pick.cancel();
    // (eaten: only the eating here; the counter's own code heals him and says so, story/Roam.js)
    if (i === 0) { await this.consume({ key: key ?? 'meal', name, kind, heal }, { quiet: true }); return 'eaten'; }
    s.inventory?.add({ key: key ?? `meal:${name.toLowerCase().replace(/\W+/g, '-')}`, name: cap(name.replace(/^an? /i, '')), kind, heal, from: this.inRoom });
    s.ui.toast(`${cap(name.replace(/^an? /i, ''))} · kept`);
    return 'kept';
  }
  // what he's holding, paid for: eaten (drunk) now, or kept
  async eatOrKeep(held) {
    const s = this.story, now = held.filter((h) => h.P.kind === 'food' || h.P.kind === 'drink');
    for (const h of held.filter((x) => !now.includes(x))) this.keep(h);
    if (!now.length) return;
    const what = now.map((h) => h.P.short).join(' and ');
    const pick = s.ui.pick(cap(what), [now.some((h) => h.P.kind === 'food') ? 'Eat it now' : 'Drink it now', 'Keep it']);
    const i = await Promise.race([pick, wait(10).then(() => 1)]);
    pick.cancel();
    for (const h of now) { if (i === 0) await this.consume(h); else this.keep(h); }
  }

  // Eaten, or drunk: brought to his mouth, a bite or two (a can tipped up), gone; what it does for him. `x`: what's in
  // his hand (a hold), or an inventory item (it's in his hand for it, when the shop's models are loaded)
  async consume(x, { quiet = false } = {}) {
    const s = this.story, pl = s.player, st = this.stock;
    const P = PRODUCTS[x.key ?? x.it?.key] ?? x.P ?? null, heal = x.heal ?? P?.heal ?? 0, kind = x.kind ?? P?.kind ?? 'food';
    let h = x.o ? x : null;
    if (!h && P && st?.loaded && pl.rig && st.shapes?.has(P.key) && s.current === this.f && !pl.flying) {
      const it = { key: P.key, P, x: 0, y: 0, z: 0 };
      const o = st.objectOf(it);
      s.current.scene.add(o);
      h = { it, o, P, paid: true, side: this.free('R') ? 'R' : 'L', temp: true };
      if (!this.hands[h.side]) { this.hands[h.side] = h; this.onPalm(h, h.side); await wait(0.3); }
      else { o.removeFromParent(); h = null; }
    }
    if (h && pl.rig) {
      if (h.both) { // (to one hand to eat from)
        this.release(h);
        h.both = false; h.side = 'R';
        s.current.scene.add(h.o);
        this.hands.R = h;
        this.onPalm(h, 'R');
        await wait(0.3);
      }
      const side = h.side ?? 'R', rig = pl.rig, mouth = V(0, 0, 0), sg = side === 'R' ? -1 : 1;
      const drink = kind === 'drink' || P?.pill;
      // (to his chin, not his eyes: what's on his palm comes up under his mouth, as it lies; tipped up about its own
      // middle it floated off his hand)
      pl.animator.reach(side, () => { rig.bonePosition('head', mouth); return mouth.addScaledVector(this.fwd(), 0.2).addScaledVector(this.right(), -sg * 0.04).add(V(0, -0.24, 0)); }, { weight: 1, rate: 5, pole: V(-sg * 0.4, -1, -0.5) });
      pl.lookAt(() => h.o.getWorldPosition(this._eat ??= V(0, 0, 0)), 0.45);
      await wait(0.55);
      const bites = drink ? 1 : 2;
      for (let b = 0; b < bites; b++) {
        if (drink && h.palm) await tween(0.35, (k) => h.o.quaternion.copy(h.palm.Qp).multiply(h.palm.R).premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -1.1 * ease.inOut(k))), ease.linear);
        pl.animator.gesture?.('nod', 0.5, drink ? 0.6 : 0.4); // (a bite: the head down to it)
        await wait(drink ? 0.9 : 0.45);
        if (!drink) { s.audio.tick?.(); h.o.scale.multiplyScalar(0.88); }
        await wait(0.25);
      }
      this.release(h);
      if (h.it?.state && !h.temp) this.stock.consume(h.it);
      pl.lookAt(null);
    }
    if (quiet) return;
    if (s.powers) s.powers.health = Math.min(s.powers.maxHealth, s.powers.health + heal);
    s.bark(P?.pill ? 'halPills' : P?.beer ? 'halBeer' : kind === 'drink' ? 'halSoda' : heal >= 10 ? 'halEat2' : 'halEat1');
  }

  // ---------------------------------------------------------------- from his pockets (story/Inventory.js)
  // one of a stack in his hand, paid for (let go of, it's back in his pocket): only in Hal's block, with the shops'
  // models loaded and a hand free
  holdItem(stack) {
    const s = this.story, pl = s.player, st = this.stock, P = PRODUCTS[stack.key];
    if (!P || !st?.loaded || !st.shapes?.has(P.key) || s.current !== this.f || !pl.rig || pl.flying || s.driving) return false;
    const side = this.free('R') ? 'R' : this.free('L') ? 'L' : null;
    if (!side) return false;
    const it = { key: P.key, P, x: 0, y: 0, z: 0 }, o = st.objectOf(it);
    s.current.scene.add(o);
    const h = { it, o, P, paid: true, side, temp: true, room: stack.from };
    this.hands[side] = h;
    this.onPalm(h, side);
    return true;
  }
  // one of a stack set down at his feet, a body of its own (Hal's block, the models loaded); anywhere else just gone
  dropItem(stack) {
    const s = this.story, st = this.stock, P = PRODUCTS[stack.key];
    if (!P || !st?.loaded || !st.shapes?.has(P.key) || s.current !== this.f || !st.smash) return false;
    const it = { key: P.key, P, x: 0, y: 0, z: 0 }, o = st.objectOf(it), [w, h, d] = P.size;
    o.position.copy(s.player.position).addScaledVector(this.fwd(), 0.45).add(V(0, 0.6, 0));
    o.quaternion.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    s.current.scene.add(o);
    const item = st.smash.add(o, { kind: 'loose', mass: P.mass, box: new THREE.Box3(V(-w / 2, 0, -d / 2), V(w / 2, h, d / 2)), shrink: 0.92, stuff: 'plastic', glass: false, friction: 0.6 });
    item.body.applyImpulse({ x: 0, y: -0.2 * P.mass, z: 0 }, true);
    return true;
  }

  // ---------------------------------------------------------------- the door, the mess
  watchDoor() {
    const s = this.story, pl = s.player, st = this.stock, R = st.roomOf(pl.position), was = this.inRoom;
    this.inRoom = R?.key ?? null;
    for (const room of new Set(this.unpaid().map((h) => h.room))) {
      const Rm = st.rooms.get(room);
      if (!Rm) continue;
      const p = (this._p ??= V(0, 0, 0)).copy(pl.position).sub(st.origin).applyMatrix4(Rm.inv);
      const keeper = this.keeper(room);
      if (R?.key === room && p.z > Rm.z0 - 1.6 && !this.warned?.has(room)) { (this.warned ??= new Set()).add(room); if (keeper && s.civilian) this.say(keeper, SAY.warn[keeper.voice] ?? SAY.warn.townm1); }
      if (R?.key !== room && was === room) this.walkedOut(room, keeper);
    }
    if (!this.inRoom && was) this.warned?.delete(was);
  }
  walkedOut(room, keeper) {
    const s = this.story, held = this.unpaid(room);
    if (!held.length) return;
    if (!s.civilian) { for (const h of held) { h.paid = true; this.keep(h, true); } return; } // (on the house, they said)
    const total = held.reduce((n, h) => n + (h.P.price ?? 0), 0);
    this.owed.set(room, (this.owed.get(room) ?? 0) + total);
    for (const h of held) { h.paid = true; this.keep(h, true); }
    if (keeper) this.say(keeper, SAY.stop[keeper.voice] ?? SAY.stop.townm1, true);
    s.ui.toast(`Walked out with ${held.map((h) => h.P.short).join(' and ')} · ${money(total)} unpaid`);
    wait(4.5).then(() => s.bark('halLifted')).catch(() => {});
  }
  knocked(it) {
    const now = this.story.engine.time, last = this.said.get(it.room) ?? -99;
    if (now - last < 14) return;
    const keeper = this.keeper(it.room);
    if (!keeper || this.story.player.position.distanceTo(keeper.pos) > 16) return;
    this.said.set(it.room, now);
    wait(0.4).then(() => this.say(keeper, SAY.knock[keeper.voice] ?? SAY.knock.townm1, true)).catch(() => {});
  }
  broke(it) {
    const keeper = this.keeper(it.room);
    if (this.story.civilian) this.owed.set(it.room, (this.owed.get(it.room) ?? 0) + (it.P.price ?? 0));
    if (!keeper) return;
    this.said.set(it.room, this.story.engine.time);
    wait(0.5).then(() => this.say(keeper, SAY.broke[keeper.voice] ?? SAY.broke.townm1, true)).catch(() => {});
  }
  // who works there (story/CityLife.js): Ray at Coast Liquor, the shop's own staff elsewhere
  keeper(room) {
    const cl = this.story.cityLife;
    if (!cl?.people) return null;
    return room === 'market' ? cl.people.find((p) => p.kind === 'clerk') ?? null : cl.people.find((p) => p.tag === `shop:${room}`) ?? null;
  }
  // a line from them (`call`: shouted after him: it doesn't wait on the dialogue)
  say(p, key, call = false) {
    const cl = this.story.cityLife;
    if (!cl || !p) return null;
    if (p.talking) { // (mid-line: a shout after him waits for it, a few seconds at most; the rest is dropped)
      if (call) (async () => { for (let i = 0; i < 80 && p.talking; i++) await wait(0.1); if (!p.talking) cl.say(p, key)?.catch?.(() => {}); })().catch(() => {});
      return null;
    }
    const run = cl.say(p, key);
    if (!call) return run;
    run?.catch?.(() => {});
    return null;
  }
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
