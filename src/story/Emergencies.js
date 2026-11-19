// The city's emergencies (the open world the user agreed: "emergencies to answer (robberies, thugs,
// crashes, fires...)"): every few hours of the clock something happens on Hal's block, the ring hears
// it (its alert, a marker on the HUD), and Green Lantern answers it or he doesn't. Three so far:
// - a hold-up at Coast Liquor: a man with a revolver on Ray, who turns it on Green Lantern (two shots,
//   each aimed a moment first: the shield takes them), then runs for it;
// - a mugging in the west alley: two men and a woman against the wall; one squares up to him (a
//   wind-up, then a lunge and a punch), the other runs;
// - a crash at the crossing: a car through the red into another, steam from its engine, the driver
//   trapped behind a jammed door (E: tear it off), and the car catching fire if nobody comes.
// Answered: XP and the city's goodwill (story/Life.js), and the police (a cruiser, its lights, two
// officers who cuff whoever's down and take them) or an ambulance after. Ignored, or got away: the
// city notices. Everyone in one is one of CityLife's people (their animation, their talk, their
// capsule), marked `actor` so the street's own routines (a fright, talk) leave them alone.
import * as THREE from 'three';
import { wait, onFrame } from '../engine/Time.js';
import { POSES, still, makePose } from '../characters/Poses.js';
import { loadPeople, createPerson } from '../characters/People.js';
import { prop, loadProps } from '../props/Props.js';
import { Fire } from '../fx/Particles.js';
import { makeCar } from '../props/Car.js';
import { LOT } from '../scenes/Ferris.js';
import { curve, LANES } from '../city/Traffic.js';
import { waitFor } from '../engine/Time.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L = (x, z, y = 0) => V(x + LOT.x, y, z + LOT.z); // (the block's frame to the world)
const CAST = { trapped: 'female-adult-15', fireA: 'fire-male-02', fireB: 'fire-male-05', robber: 'male-adult-18', thugA: 'male-adult-09', thugB: 'male-adult-18', victim: 'female-adult-13', driver: 'male-adult-03', copA: 'police-male-01', copB: 'police-female-01', medic: 'medical-female-01' };
const KINDS = ['robbery', 'mugging', 'fire', 'crash'];
const REWARD = { robbery: [70, 6], mugging: [60, 5], crash: [60, 6], fire: [80, 8] };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);

export class Emergencies {
  constructor(story, f) {
    Object.assign(this, { story, f });
    this.active = null;
    this.nextAt = null; // (the clock's hour of the next)
    this.n = 0;
    this.fx = [];
  }
  get cl() { return this.story.cityLife; }

  // ---------------------------------------------------------------- when
  update(dt) {
    const story = this.story, dc = story.dayCycle;
    for (const e of this.fx) e.t += dt;
    for (const F of this.fires ?? []) F.update(dt, story.engine.time, story.engine.camera, story.engine.renderer);
    this.fx = this.fx.filter((e) => { if (e.t > e.life) { e.done(); return false; } e.tick?.(e.t / e.life); return true; });
    if (!dc || !this.cl?.started) return;
    const now = dc.day * 24 + dc.hour;
    this.nextAt ??= now + rnd(0.6, 1.4); // (the first a minute or three in)
    if (this.active) { this.active.t += dt; this.active.tick?.(dt); return; }
    if (now < this.nextAt || !story.roaming || story.current !== this.f || story.busy || story.driving) return;
    this.nextAt = now + rnd(2.2, 4.5);
    this.start(KINDS[this.n++ % KINDS.length]).catch((e) => { console.warn('emergency', e); this.end(null); });
  }

  async start(kind) {
    const story = this.story, powers = story.powers;
    const ids = Object.values(CAST), gl = await loadPeople(ids);
    await loadProps(['revolver', 'policecar', 'ambulance', 'policeline']);
    this.gltf = Object.fromEntries(ids.map((id, i) => [id, gl[i]]));
    this.active = { kind, t: 0, actors: [], props: [], cars: [] };
    await this[kind](this.active);
    // the ring hears it: its alert, the marker (Carol's Part Seven one back after)
    const a = this.active;
    this.markerWas = powers.markerTarget;
    powers.markerTarget = { pos: a.where.clone().setY(a.where.y + 2.2), label: a.label };
    story.ringSay?.(a.alert);
    story.audio.ringChime?.();
    story.ui.toast(`${a.label} · the ring heard it`);
  }

  // the end of one: answered (true), got away or went wrong (false), or cut short (null)
  end(answered) {
    const story = this.story, a = this.active;
    if (!a || a.over) return;
    a.over = true;
    story.powers.markerTarget = this.markerWas ?? null;
    if (answered === true) {
      const [xp, op] = REWARD[a.kind];
      story.life?.gain(xp, `${a.label}, answered`);
      story.life?.opine(op, `${a.label}: Green Lantern was there`);
      story.ringSay?.('ringResolved');
      story.life?.note?.(a.label, true);
    } else if (answered === false) {
      story.life?.opine(-3, a.failWhy ?? 'nobody came');
      story.life?.note?.(a.label, false);
    }
    // the scene stays until nobody's looking, then it's cleared away
    const clear = () => {
      for (const p of a.actors) this.remove(p);
      for (const o of a.props) { const it = this.f.smash.items.find((i) => i.object === o); if (it) this.f.smash.remove(it); else o.removeFromParent(); } // (the door's a Smash item: its body too)
      a.cleared = true;
      for (const r of a.dispatched ?? []) this.story.traffic?.dismiss(r);
      for (const c of a.cars) this.removeCar(c);
      a.tickOff?.();
      if (this.active === a) this.active = null;
    };
    const t0 = a.t;
    a.tick = () => { if (a.t - t0 > 25 && this.unseen(a.where, 40)) clear(); };
  }

  unseen(at, far = 70) {
    const cam = this.story.engine.camera, fr = this.cl.frustum;
    return at.distanceTo(cam.position) > far || !fr.containsPoint(_a.copy(at).setY(at.y + 1));
  }

  // ---------------------------------------------------------------- the people in them
  actor(role, at, yaw, { voice = 'townm1', label = 'A man', health = 0, onDown = null } = {}) {
    const per = createPerson(this.gltf[CAST[role]], { seed: 50 + this.n * 7 + role.length });
    const p = this.cl.add(per, { kind: 'actor', voice, label, home: at.clone(), yaw, state: 'hold', radius: 1.6 });
    p.actor = true;
    p.mute = role !== 'victim' && role !== 'driver';
    p.speed = 1.2;
    if (health) {
      const tg = (p.tg = { body: p.rb, collider: p.rb.collider(0), position: V(0, 0, 0), radius: 0.55, health, maxHealth: health, alive: true,
        hit: (amount, point, dir, kind) => this.hit(p, amount, dir, kind), openState: () => (p.tell ? 'open' : null) });
      p.dyn = { body: p.rb, mesh: new THREE.Object3D() };
      this.f.physics.dynamics.push(p.dyn); // (the ring's impacts only find bodies listed there)
      this.story.powers.addTarget(tg);
      p.onDown = onDown;
      const stop = onFrame(() => { if (!p.tg) { stop(); return; } tg.position.set(p.pos.x, p.pos.y + 1.0, p.pos.z); });
    }
    this.active.actors.push(p);
    return p;
  }
  remove(p) {
    const cl = this.cl;
    if (p.tg) { this.story.powers.removeTarget(p.tg); p.tg = null; }
    if (p.dyn) { const i = this.f.physics.dynamics.indexOf(p.dyn); if (i >= 0) this.f.physics.dynamics.splice(i, 1); }
    if (p.gun) p.gun.removeFromParent();
    cl.remove(p);
  }
  // struck by the ring: they reel, and enough of it puts them down
  hit(p, amount, dir, kind) {
    const tg = p.tg;
    if (!tg?.alive) return 0;
    const dealt = Math.min(tg.health, amount);
    tg.health -= dealt;
    p.tell = 0;
    p.stagger = 0.6;
    if (dir) p.pos.addScaledVector(_a.copy(dir).setY(0).normalize(), kind === 'hammer' ? 1.6 : 0.7);
    this.story.audio.punch?.();
    if (tg.health <= 0) this.down(p);
    return dealt;
  }
  down(p) {
    p.tg.alive = false;
    p.downed = true;
    p.state = 'hold';
    p.route = null;
    p.anim.reach('R', null);
    p.anim.reach('L', null);
    this.cl.look(p, null);
    if (p.gun) { const g = p.gun; g.removeFromParent(); g.position.copy(p.pos).add(V(0.5, 0.02, 0.3)); g.rotation.set(Math.PI / 2, 0, rnd(0, 6)); this.f.scene.add(g); this.active?.props.push(g); p.gun = null; }
    p.anim.play(still(makePose({ ...POSES.kneel }), 0.5), 0.35);
    p.onDown?.(p);
  }
  // hands behind the back (an officer has him)
  cuff(p) {
    const r = p.rig, at = (s) => { const v = V(0, 0, 0); return () => { const y = r.root.rotation.y; r.bonePosition('hips', v); return v.add(_b.set(-Math.sin(y) * 0.22 + Math.cos(y) * s * 0.06, 0.05, -Math.cos(y) * 0.22 - Math.sin(y) * s * 0.06)); }; };
    p.anim.play(p.loco, 0.5);
    p.anim.reach('L', at(1), { weight: 1, rate: 4, pole: V(0, -0.4, -1) });
    p.anim.reach('R', at(-1), { weight: 1, rate: 4, pole: V(0, -0.4, -1) });
  }

  // a revolver in his right hand, its barrel kept on what he aims at (after the IK)
  arm(p) {
    const g = prop('revolver'), hand = p.rig.bones.hand_R, palm = p.rig.palm('R');
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    hand.add(g);
    g.position.copy(palm.centre).addScaledVector(palm.normal, palm.surface + 0.01);
    p.per.setGrip('R', 'hold');
    p.gun = g;
    const base = p.anim.post, wq = new THREE.Quaternion();
    p.anim.post = (rig, dt) => {
      base?.(rig, dt);
      if (!p.gun || !p.aimAt) return;
      // the gun's +z down the line from the hand to the target, its grip down
      hand.getWorldPosition(_a);
      _b.copy(p.aimAt()).sub(_a).normalize();
      _m.lookAt(V(0, 0, 0), _b.clone().negate(), _up);
      wq.setFromRotationMatrix(_m);
      hand.getWorldQuaternion(_q);
      p.gun.quaternion.copy(_q.invert().multiply(wq));
    };
  }
  // the arm out at what he aims at
  aim(p, target) {
    p.aimAt = target;
    const v = V(0, 0, 0);
    p.anim.reach('R', target ? () => { p.rig.bonePosition('upperArm_R', v); return v.add(_b.copy(target()).sub(v).normalize().multiplyScalar(0.58)); } : null, { weight: 1, rate: 7 });
  }
  // a shot: the flash, the crack, the round's streak; the shield takes it, Hal doesn't
  shoot(p, target) {
    const story = this.story, powers = story.powers, from = V(0, 0, 0);
    (p.gun ?? p.rig.bones.hand_R).getWorldPosition(from);
    const to = target().clone();
    story.audio.gatShot?.();
    story.audio.impact?.(0.35);
    const g = powers.guardHit?.(from, to);
    if (!g) powers.damage(story.civilian ? 14 : 7, from, 'shot');
    // the streak and the flash
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 }));
    const flash = new THREE.PointLight(0xffc070, 0, 6, 2);
    flash.position.copy(from);
    this.f.scene.add(line);
    this.fx.push({ t: 0, life: 0.09, tick: (k) => { line.material.opacity = 0.9 * (1 - k); }, done: () => { line.removeFromParent(); geo.dispose(); line.material.dispose(); } });
    void flash;
  }

  // the police: a cruiser to the kerb, its lights going, two officers out to whoever's down
  async police(a, pts, suspects) {
    const story = this.story, tr = story.traffic;
    await wait(rnd(2, 4));
    if (!tr) return;
    story.audio.siren?.(9, 0.05);
    const rec = tr.dispatch('policecar', pts, { speed: 13 });
    a.cars.push(rec.obj);
    a.dispatched = [...(a.dispatched ?? []), rec];
    await waitFor(() => rec.state === 'held' || a.cleared);
    if (a.cleared) return;
    const car = rec.obj, park = car.position.clone(), yaw = rec.pose.yaw;
    // the light bar, red and blue by turns
    const bar = [];
    car.updateMatrixWorld(true);
    car.traverse((m) => { if (m.isMesh && /light|lamp|siren|bar/i.test(m.material?.name ?? '') && m.material.emissive && m.getWorldPosition(_a).y > car.position.y + 1.3) bar.push(m); }); // (the bar on the roof, not the headlamps)
    for (const m of bar) m.material = m.material.clone();
    let k = 0;
    a.tickOff = onFrame(() => { k += 1 / 30; for (const [i, m] of bar.entries()) { const on = Math.floor(k * 4 + i) % 2 === 0; m.material.emissive.setHex(i % 2 ? 0x2a50ff : 0xff2020); m.material.emissiveIntensity = on ? 2.2 : 0.2; } });
    const side = (s) => V(Math.cos(yaw) * s * 1.6 - Math.sin(yaw) * s * 0.8, 0, -Math.sin(yaw) * s * 1.6 - Math.cos(yaw) * s * 0.8).add(park);
    const cops = [this.actor('copA', side(1), yaw, { voice: 'tech', label: 'A police officer' }), this.actor('copB', side(-1), yaw, { voice: 'townf1', label: 'A police officer' })];
    await wait(0.6);
    this.cl.murmur(cops[0], 'copArrive');
    for (const [i, s] of suspects.entries()) {
      const c = cops[i % 2];
      // across the parking lane by a gap between the parked cars, not through one; in by the door to
      // someone down inside (straight to him, she cuffed him through the shop window)
      const gap = this.gap(s.pos, c.pos), door = this.doorTo(s.pos);
      const last = door ? s.pos.clone().add(_b.copy(door.out).sub(s.pos).setY(0).normalize().multiplyScalar(0.8)) : s.pos.clone().add(V(0.7, 0, 0.4));
      await this.cl.go(c, [...(door ? this.gap(door.out, c.pos) : gap), ...(door ? [door.out, door.in] : []), last], { speed: 1.4 });
      c.yaw = Math.atan2(s.pos.x - c.pos.x, s.pos.z - c.pos.z);
      this.cl.hold(c, c.yaw);
      await wait(1.0);
      this.cuff(s);
      s.anim.play(s.loco, 0.4);
    }
    if (!story.civilian && cops[0].pos.distanceTo(story.player.position) < 14) this.cl.murmur(cops[0], 'copThanks');
  }

  // the door of the room someone's in (world points just outside and just in), or null outdoors
  doorTo(at) {
    const b = this.f.block;
    if (!b.indoors(at)) return null;
    let best = null, bd = Infinity;
    for (const d of b.ctx.doors) {
      if (d.staff) continue;
      const w = L(d.at.x, d.at.z, at.y), dist = w.distanceTo(at);
      if (dist < bd) { bd = dist; best = d; }
    }
    if (!best) return null;
    const out = L(best.at.x, best.at.z, at.y), inn = L(best.inside.x, best.inside.z, at.y);
    return { out: out.clone().addScaledVector(_a.copy(out).sub(inn).normalize(), 1.2), in: inn };
  }

  // the way from the road to someone on the pavement past the parked cars: the nearest stretch of the
  // kerb's lane with no car in it (no points if they're on the same side, or no cars there)
  gap(to, from) {
    const lx = to.x - LOT.x < 6 ? 0.8 : 11.2, fx = from.x - LOT.x;
    if ((to.x - LOT.x < 6) === (fx < lx) || Math.abs(fx - lx) < 1) return [];
    const zs = this.f.smash.items.filter((i) => i.kind === 'car' && !i.traffic && Math.abs(i.object.position.x - LOT.x - lx) < 1.4).map((i) => i.object.position.z);
    let best = to.z, bd = Infinity;
    for (let z = to.z - 20; z <= to.z + 20; z += 0.5) if (zs.every((c) => Math.abs(c - z) > 3.4) && Math.abs(z - to.z) < bd) { bd = Math.abs(z - to.z); best = z; }
    return [V(from.x, to.y, best), V(lx + LOT.x, to.y, best), V(lx + LOT.x + (lx < 6 ? -2.2 : 2.2), to.y, best)];
  }

  // ---------------------------------------------------------------- a hold-up at Coast Liquor
  async robbery(a) {
    const cl = this.cl, story = this.story, ray = cl.people.find((p) => p.kind === 'clerk');
    const bell = this.f.block.ctx.spots.find((s) => s.kind === 'counter');
    Object.assign(a, { where: bell.at.clone(), label: 'Robbery · Coast Liquor', alert: 'ringRobbery', failWhy: 'the robber at Coast Liquor got away' });
    const yawToRay = ray ? Math.atan2(ray.home.x - bell.at.x, ray.home.z - bell.at.z) : 0;
    const rob = this.actor('robber', bell.at.clone(), yawToRay, { voice: 'tech2', label: 'The robber', health: 30, onDown: (p) => this.robberDown(a, p) });
    this.arm(rob);
    rob.barge = true; // (running for it, he doesn't wait for anyone)
    const rayHead = ray ? cl.headOf(ray) : null;
    if (ray) { this.aim(rob, rayHead); this.handsUp(ray); ray.paused = true; }
    cl.murmur(rob, 'robDemand');
    a.rob = rob;
    a.phase = 'holding';
    a.tick = (dt) => {
      if (a.over) return;
      const hp = story.player.position, d = rob.pos.distanceTo(hp);
      if (rob.stagger > 0) rob.stagger -= dt;
      if (a.phase === 'holding') {
        if (d < 10 && !story.civilian) { a.phase = 'turned'; a.shots = 2; a.next = 0.6; cl.murmur(rob, 'robSeesGL'); this.aim(rob, cl.halHead()); rob.yaw = Math.atan2(hp.x - rob.pos.x, hp.z - rob.pos.z); cl.hold(rob, rob.yaw); }
        else if (d < 6 && story.civilian && !a.warned) { a.warned = true; cl.murmur(rob, 'robSeesHal'); }
        else if (a.t > 95) this.robberFlees(a, true);
      } else if (a.phase === 'turned') {
        rob.yaw = Math.atan2(hp.x - rob.pos.x, hp.z - rob.pos.z);
        if (rob.stagger > 0) return;
        if ((a.next -= dt) < 0) {
          if (!rob.tell) { rob.tell = 0.7; a.next = 0.7; } // (the aim held: the moment to raise the shield)
          else { rob.tell = 0; this.shoot(rob, cl.halHead()); a.next = 1.1; if (--a.shots <= 0) this.robberFlees(a, false); }
        }
      } else if (a.phase === 'fleeing' && a.t - a.fledAt > 22) {
        if (this.unseen(rob.pos, 30)) { a.phase = 'gone'; this.end(false); }
      }
    };
  }
  handsUp(p) {
    const at = (s) => { const v = V(0, 0, 0); return () => { const y = p.rig.root.rotation.y; p.rig.bonePosition('neck', v); return v.add(_b.set(Math.sin(y) * 0.12 + Math.cos(y) * s * 0.28, 0.32, Math.cos(y) * 0.12 - Math.sin(y) * s * 0.28)); }; };
    p.anim.reach('L', at(1), { weight: 1, rate: 5 });
    p.anim.reach('R', at(-1), { weight: 1, rate: 5 });
    p.handsUp = true;
  }
  handsDown(p) { if (!p?.handsUp) return; p.handsUp = false; p.paused = false; p.anim.reach('L', null); p.anim.reach('R', null); }
  robberFlees(a, unseenGone) {
    const rob = a.rob, door = this.f.block.ctx.doors[0], cl = this.cl;
    if (a.phase === 'fleeing' || rob.downed) return;
    a.phase = 'fleeing';
    a.fledAt = a.t;
    this.aim(rob, null);
    cl.murmur(rob, 'robFlee');
    const out = L(door.at.x, door.at.z).add(V(0, 0, 0));
    const way = [L(door.inside.x, door.inside.z), out, L(-1.5, door.at.z + 4), L(-1.5, -24), L(-14, -14), L(-29, -20)];
    cl.go(rob, way, { speed: 3.4 }).then(() => { if (!rob.downed && !a.over) { a.phase = 'gone'; this.end(false); } });
    this.handsDown(cl.people.find((p) => p.kind === 'clerk'));
    void unseenGone;
  }
  robberDown(a, p) {
    a.phase = 'down';
    this.cl.murmur(p, 'robDown');
    const ray = this.cl.people.find((q) => q.kind === 'clerk');
    this.handsDown(ray);
    a.ok = true;
    this.end(true);
    const zs = p.pos.z - LOT.z - 3, { NB, SOUTH, STOP } = LANES;
    this.police(a, [[NB, SOUTH], [NB, STOP.NB], [NB, STOP.SB], [NB, zs]], [p]);
    if (ray && !this.story.civilian) wait(3).then(() => { if (ray.pos.distanceTo(this.story.player.position) < 12) this.cl.murmur(ray, 'clerkSaved'); });
  }

  // ---------------------------------------------------------------- a mugging in the west alley
  async mugging(a) {
    const cl = this.cl, story = this.story, at = L(-29.6, -136); // (between the bins, clear of the cart)
    Object.assign(a, { where: at.clone(), label: 'Mugging · the west alley', alert: 'ringMugging', failWhy: 'a woman was mugged in the alley' });
    const victim = this.actor('victim', L(-32.4, -136.2), Math.PI / 2, { voice: 'townf2', label: 'A woman' });
    victim.anim.play(still(makePose({ ...POSES.kneel }), 0.6), 0.4);
    const t1 = this.actor('thugA', L(-30.4, -135.4), -Math.PI / 2, { voice: 'townm2', label: 'A man', health: 45, onDown: () => this.thugDown(a) });
    const t2 = this.actor('thugB', L(-30.9, -137.3), -Math.PI / 2 - 0.4, { voice: 'townm1', label: 'A man', health: 40, onDown: () => this.thugDown(a) });
    a.victim = victim; a.thugs = [t1, t2];
    cl.murmur(t1, 'mugThreat');
    wait(2.6).then(() => { if (!a.over && !a.engaged) cl.murmur(victim, 'mugVictim'); });
    a.tick = (dt) => {
      if (a.over) return;
      const hp = story.player.position;
      if (!a.engaged && t1.pos.distanceTo(hp) < 13 && !story.civilian) {
        a.engaged = true;
        cl.murmur(t1, 'mugSeesGL');
        // one squares up to him; the other runs for the cross street
        t1.barge = t2.barge = true;
        cl.go(t2, [L(-29, -150), L(-29, -205), L(-60, -205)], { speed: 3.3 }).then(() => { t2.fled = true; this.thugDown(a); });
        t1.fight = { cool: 0.8 };
      }
      if (a.t > 85 && !a.engaged) { this.end(false); return; }
      // the one who fights: in to arm's reach, a wind-up (the shield's moment), a lunge and a punch
      const F = t1.fight;
      if (F && !t1.downed) {
        if (t1.stagger > 0) { t1.stagger -= dt; return; }
        const d = t1.pos.distanceTo(hp);
        t1.yaw = Math.atan2(hp.x - t1.pos.x, hp.z - t1.pos.z);
        if (!t1.tell && d > 1.5) { if ((F.re = (F.re ?? 0) - dt) < 0) { F.re = 0.3; cl.go(t1, [_a.set(hp.x, t1.pos.y, hp.z).addScaledVector(_b.set(t1.pos.x - hp.x, 0, t1.pos.z - hp.z).normalize(), 1.15).clone()], { speed: 2.6 }); } }
        else if (t1.state === 'route') cl.hold(t1, t1.yaw);
        else t1.faceTo = t1.yaw;
        if ((F.cool -= dt) < 0 && !t1.tell && d < 2.0) { t1.tell = 0.6; const v = V(0, 0, 0); t1.anim.reach('R', () => { t1.rig.bonePosition('upperArm_R', v); return v.add(_b.set(-Math.sin(t1.yaw) * 0.25, 0.25, -Math.cos(t1.yaw) * 0.25)); }, { weight: 1, rate: 8 }); }
        if (t1.tell) {
          t1.tell -= dt;
          if (t1.tell <= 0) {
            t1.tell = 0;
            F.cool = rnd(1.4, 2.2);
            const v = V(0, 0, 0);
            t1.anim.reach('R', () => v.copy(story.player.position).setY(story.player.position.y + 1.35), { weight: 1, rate: 18 });
            wait(0.22).then(() => t1.anim.reach('R', null, { rate: 6 }));
            if (d < 2.4) { // (the lunge closes the last of it)
              t1.pos.addScaledVector(_a.set(hp.x - t1.pos.x, 0, hp.z - t1.pos.z).normalize(), Math.max(0, d - 1.0) * 0.6);
              const g = story.powers.guardHit?.(t1.pos, hp);
              if (g === 'parry') { t1.stagger = 1.2; story.audio.parry?.(); }
              else if (!g) { story.powers.damage(9, t1.pos, 'punch'); story.audio.punch?.(); }
            }
          }
        }
      }
    };
  }
  thugDown(a) {
    if (a.over) return;
    const [t1, t2] = a.thugs;
    if (!(t1.downed || t1.fled) || !(t2.downed || t2.fled)) return;
    a.ok = true;
    this.end(true);
    const v = a.victim;
    v.anim.play(v.loco, 0.5);
    wait(1.2).then(() => { if (v.pos.distanceTo(this.story.player.position) < 14) this.cl.murmur(v, 'mugThanks'); });
    const { EB, WEST, E, N } = LANES, near = a.thugs[0].pos.z - LOT.z;
    this.police(a, [[WEST, EB], [-40, EB], ...curve([-40, EB], E, [-29, -198], N, 12), [-29, Math.min(-112, (near ?? -104) - 8)]], a.thugs.filter((t) => t.downed));
  }

  // ---------------------------------------------------------------- a fire over Lucky Dragon
  // The flats over the takeout (Bayview, three floors) burning: flames and smoke out of the upper
  // windows, a woman on the roof waving; Green Lantern flies up to her, E carries her down; the fire
  // department comes after and the fire dies down. Left alone, they get her down at 100 s.
  async fire(a) {
    const story = this.story, f = this.f, cl = this.cl, roof = 10.5;
    const top = L(-15.9, -68, roof);
    Object.assign(a, { where: top.clone(), label: 'Fire · the flats over Lucky Dragon', alert: 'ringFire', failWhy: 'the fire department got her off the roof' });
    this.fires = [];
    // flames out of four windows, and a column of smoke off the roof (small ones read as sparks)
    for (const [y, z, r, h] of [[5.8, -60, 1.1, 2.4], [5.8, -72, 1.1, 2.4], [8.9, -64, 1.2, 2.6], [8.9, -76, 1.1, 2.4], [roof + 0.4, -70, 2.4, 3.6]]) {
      const F = new Fire(L(z === -70 ? -14 : -6.15, z, y), { radius: r, rate: 150, height: h });
      F.group.remove(F.light); // (a light added mid-play recompiles every material)
      f.scene.add(F.group);
      this.fires.push(F);
    }
    a.fireLoop = story.audio.fire?.(0.0);
    const v = this.actor('trapped', top, Math.PI / 2, { voice: 'townf1', label: 'A woman' });
    v.home.copy(top);
    a.victim = v;
    // waving: an arm up over her head, back and forth
    const wv = V(0, 0, 0);
    v.anim.reach('R', () => { v.rig.bonePosition('neck', wv); return wv.add(_b.set(Math.sin(a.t * 6) * 0.25, 0.45, 0.15)); }, { weight: 1, rate: 6 });
    const it = f.interact({ position: top, radius: 3.2, look: top.clone().setY(roof + 1.4), label: 'Fly her down', action: () => this.carryDown(a) });
    Object.defineProperty(it, 'enabled', { get: () => !a.over && !story.civilian && Math.abs(story.player.position.y - roof) < 4, set() {} });
    a.it = it;
    a.tick = (dt) => {
      if (a.over) return;
      const hp = story.player.position, near = hp.distanceTo(top);
      a.fireLoop?.level?.(Math.max(0, 0.12 * (1 - story.engine.camera.position.distanceTo(top) / 90)), 1);
      if ((a.helpT = (a.helpT ?? 99) + dt) > 8 && near < 60) { a.helpT = 0; cl.murmur(v, 'fireHelp'); }
      if (a.t > 100) { this.end(false); this.douse(a); }
    };
  }
  async carryDown(a) {
    const story = this.story, ui = story.ui, v = a.victim, p = story.player;
    if (a.over) return;
    story.takeControl();
    await ui.fade(1, 0.6);
    // down to the pavement in front, the two of them
    const at = L(-2.6, -66, 0.14);
    v.anim.reach('R', null);
    v.pos.copy(at);
    v.home.copy(at);
    v.yaw = -Math.PI / 2;
    if (p.flying) p.stopFlying(true);
    p.place(at.clone().add(V(0.9, 0, 0.6)), -Math.PI / 2);
    await wait(0.6);
    await ui.fade(0, 0.6);
    story.giveControl(story.roamObjective());
    this.cl.murmur(v, 'fireThanks');
    a.ok = true;
    this.end(true);
    this.douse(a);
  }
  // the fire department: two of them at the front, the flames dying over a quarter of a minute
  async douse(a) {
    await wait(rnd(3, 5));
    const crew = [this.actor('fireA', L(-2.0, -62, 0.14), -Math.PI / 2, { voice: 'townm3', label: 'A firefighter' }), this.actor('fireB', L(-2.2, -70, 0.14), -Math.PI / 2, { voice: 'townm2', label: 'A firefighter' })];
    this.cl.murmur(crew[0], 'fireCrew');
    for (const c of crew) { const v = V(0, 0, 0); c.anim.reach('R', () => { c.rig.bonePosition('upperArm_R', v); return v.add(_b.set(-0.5, 0.32, 0)); }, { weight: 1, rate: 4 }); }
    const fires = [...(this.fires ?? [])];
    for (let k = 0; k < 30; k++) { await wait(0.5); for (const F of fires) F.intensity = (F.intensity ?? 1) * 0.88; }
    for (const F of fires) F.group.removeFromParent();
    this.fires = (this.fires ?? []).filter((F) => !fires.includes(F));
    a.fireLoop?.stop?.(2);
  }

  // ---------------------------------------------------------------- a crash at the crossing
  async crash(a) {
    const story = this.story, f = this.f, cl = this.cl;
    const at = L(4.2, -211.5);
    Object.assign(a, { where: at.clone(), label: 'Crash · the crossing', alert: 'ringCrash', failWhy: 'the driver at the crossing waited for the fire department' });
    // the traffic held off the crossing first, then the wreck put there once it's clear and unseen (made
    // where a car still was, the two were thrown apart across the street)
    const hold = new THREE.Object3D();
    hold.position.copy(at);
    hold.userData.holdR = 14;
    story.traffic?.extra.push(hold);
    const t0 = performance.now();
    await waitFor(() => (story.traffic?.clear(at.x, at.z, 13) ?? true) && (this.unseen(at, 80) || performance.now() - t0 > 60000));
    if (story.traffic) story.traffic.extra = story.traffic.extra.filter((o) => o !== hold);
    // two cars: one through the red into the other's side
    const A = makeCar('negotiator', { paint: 0x6a2420, dust: 0.3 }), B = makeCar('fairheaven', { paint: 0x8e8a7c, dust: 0.3 });
    A.position.copy(at); A.rotation.y = 0.35;
    B.position.copy(at).add(V(-3.6, 0, 1.4)); B.rotation.y = Math.PI / 2 + 0.25;
    for (const c of [A, B]) { f.smash.add(c, { kind: 'car', mass: 1300, shrink: 0.97 }); a.cars.push(c); story.traffic?.extra.push(c); }
    const iA = f.smash.items.find((i) => i.object === A), iB = f.smash.items.find((i) => i.object === B);
    for (let k = 0; k < 3; k++) { f.smash.dent(iA, A.position.clone().add(V(-0.9, 0.6, -0.4 + k * 0.4)), V(1, 0, 0), 22); f.smash.dent(iB, B.position.clone().add(V(0.4 * k - 0.4, 0.6, 2.2)).applyAxisAngle(_up, 0), V(0, 0, -1), 20); }
    iA.alarm = 0; iB.alarm = 0; iB.health = 50; // (its engine steaming)
    // the driver, behind his jammed door
    const seat = A.localToWorld(A.userData.seat.clone());
    const driver = this.actor('driver', V(seat.x, 0, seat.z), A.rotation.y, { voice: 'townm3', label: 'The driver' });
    driver.anim.play(still(makePose({ ...POSES.sitEdge, hy: -0.48, sx: 0.06 }), 1), 0.3);
    driver.inCar = true;
    driver.ghost = true; // (no capsule in the car: it would shove it)
    a.driver = driver; a.car = A; a.carItem = iA;
    const door = A.localToWorld(V(0.95, 0, 0.1));
    const it = f.interact({ position: door, radius: 1.6, look: door.clone().setY(1.0), label: 'Tear the door off', action: () => this.tearDoor(a) });
    Object.defineProperty(it, 'enabled', { get: () => !a.over && !story.civilian && !a.freed, set() {} });
    a.it = it;
    a.tick = (dt) => {
      if (a.over || a.freed) return;
      if (a.t > 6 && !a.helped && (a.helpT = (a.helpT ?? 99) + dt) > 9) { a.helpT = 0; cl.murmur(driver, 'crashHelp'); }
      if (a.t > 75 && !a.burning) { a.burning = true; f.smash.ignite(iA); story.ringSay?.('ringFireCar'); }
      if (a.t > 105) { a.freed = true; this.end(false); driver.pos.copy(door).add(V(1.2, 0, 0)); driver.anim.play(driver.loco, 0.3); }
    };
  }
  async tearDoor(a) {
    const story = this.story, f = this.f, car = a.car, door = car.userData.door;
    if (a.freed) return;
    a.freed = a.helped = true;
    story.player.turnTo(Math.atan2(car.position.x - story.player.position.x, car.position.z - story.player.position.z));
    story.audio.strain?.(1.0, 0.25);
    story.player.animator.reach('R', (door ?? car).getWorldPosition(V(0, 0, 0)).setY(1.0), { weight: 1, rate: 6 });
    await wait(0.9);
    // off its hinge, thrown aside (or, a car with no door of its own, just wrenched open)
    story.audio.crunch?.(1);
    if (door) {
      f.scene.attach(door);
      f.smash.add(door, { mass: 30, stuff: 'metal' });
      const item = f.smash.items.find((i) => i.object === door);
      const out = V(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y));
      item?.body.applyImpulse({ x: out.x * 140, y: 90, z: out.z * 140 }, true);
      a.props.push(door);
    }
    story.player.animator.reach('R', null);
    await wait(0.7);
    // the driver out, onto the kerb
    const d = a.driver, step = car.localToWorld(V(2.2, 0, 0.3));
    d.inCar = false;
    d.ghost = false;
    d.barge = true; // (out of a wreck, he doesn't wait for Hal to step aside)
    d.anim.play(d.loco, 0.5);
    d.pos.copy(car.localToWorld(V(1.3, 0, 0.1)));
    await this.cl.go(d, [step, L(13.4, -205, 0.14)], { speed: 0.8 });
    this.cl.hold(d, Math.PI);
    if (d.pos.distanceTo(story.player.position) < 14) this.cl.murmur(d, 'crashSaved');
    a.ok = true;
    this.end(true);
    this.ambulance(a, d);
  }
  async ambulance(a, d) {
    await wait(rnd(2, 4));
    const tr = this.story.traffic;
    if (!tr) return;
    this.story.audio.siren?.(6, 0.04);
    const rec = tr.dispatch('ambulance', [[LANES.SB, -8], [LANES.SB, -196]], { speed: 12, paint: 0xffffff });
    a.cars.push(rec.obj);
    a.dispatched = [...(a.dispatched ?? []), rec];
    await waitFor(() => rec.state === 'held' || a.cleared);
    if (a.cleared) return;
    const m = this.actor('medic', L(11.2, -198), Math.PI, { voice: 'townf3', label: 'A paramedic' });
    await this.cl.go(m, [d.pos.clone().add(V(-0.8, 0, 0.6))], { speed: 1.5 });
    m.anim.play(still(makePose({ ...POSES.kneel }), 0.6), 0.4);
    this.cl.murmur(m, 'medicArrive');
  }

  removeCar(c) {
    this.f.smash.remove(this.f.smash.items.find((it) => it.object === c));
    c.removeFromParent();
    const t = this.story.traffic;
    if (t) t.extra = t.extra.filter((o) => o !== c);
  }
}

