import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp, tween, wait } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { MocapClip } from '../characters/Mocap.js';
import { flight } from '../characters/Poses.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { createSinestro } from '../characters/Characters.js';
import { Blade, constructMesh, fistGeometry, shieldGeometry, swordGeometry, fearLight, shapeOf, FEAR } from '../powers/Constructs.js';
import { prop, hasProp } from '../props/Props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PIVOT = 1.0; // the body pitches and banks about this height, as Hal's does
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// His own gestures and stances, in his body frame and metres (shoulders at ±0.2, 1.55; arms 0.6 m).
// He stands with his hands clasped behind his back, and fights with the left one kept there.
const GESTURES = {
  present: { dur: 1.3, rate: 6, poleR: [-0.8, -0.6, -0.2], R: [[0.3, [-0.3, 1.25, 0.36]], [1.0, [-0.31, 1.27, 0.34]]], lean: [[0.3, 0.03, 0], [1.0, 0.01, 0]] },
  ring: { dur: 1.6, rate: 6, poleR: [-0.9, -0.5, -0.1], R: [[0.35, [-0.1, 1.43, 0.33]], [1.3, [-0.1, 1.45, 0.32]]], head: [[0.3, 'chin', 1.0, 0.5]] },
  dismiss: { dur: 0.9, rate: 10, poleR: [-1, -0.5, -0.3], R: [[0.15, [-0.14, 1.3, 0.34]], [0.32, [-0.44, 1.2, 0.16]], [0.6, [-0.46, 1.18, 0.14]]], head: [[0.15, 'shake', 0.6, 0.4]] },
};
const STANCES = {
  behind: { L: [0.06, 1.06, -0.27], R: [-0.06, 1.08, -0.27], poleL: [0.9, -0.1, -0.7], poleR: [-0.9, -0.1, -0.7] },
  oneBehind: { L: [0.06, 1.06, -0.27], poleL: [0.9, -0.1, -0.7] },
};
// his cut: blade raised over his right shoulder, then across and down
const CUT = {
  wind: [[-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]],
  keys: [[0, [-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]], [0.12, [0.06, 1.2, 0.44], [0.75, -0.35, 0.55]], [0.3, [0.1, 1.12, 0.38], [0.6, -0.3, 0.75]]],
};
// the lesson: the blade held up before his face, raised over his shoulder, cut across the air
const DEMO = [[0, [-0.12, 1.47, 0.36], [0.02, 1, 0.12]], [0.5, [-0.12, 1.48, 0.36], [0.02, 1, 0.14]], [0.72, [-0.28, 1.78, -0.02], [-0.25, 0.55, -0.8]], [0.86, [0.06, 1.2, 0.44], [0.75, -0.35, 0.55]], [1.2, [0.1, 1.12, 0.38], [0.6, -0.3, 0.75]]];
const SPIKE = { speed: 32, damage: 8, count: 5 };
const LUNGE = { wind: 0.55, quick: 0.28, damage: 22, range: 11 };
const POISE = 70; // damage inside one of his attacks that breaks him out of it: more than the gun alone (his answers can't be)
const HEALTH = 520, YIELD = 0.35; // he calls it off at 35%
const COMMITTED = new Set(['lunge', 'volley', 'slam', 'dodge', 'fearJet']); // (while these run he can't guard)
const EXPOSE = 1.5; // a parried blow throws him wide open this long
const LANDS = { exposed: 1.35, reeling: 1, open: 0.6, turned: 0.15 }; // how much of a blow gets through (see `stance`)

// Sinestro, sparring with Hal on Kilowog's range. Out of the fight he stands (mocap idle, hands
// behind his back) and talks with his ring hand (BodyLanguage). In the fight he flies (a dynamic
// body steered by a damped spring, like the drones, so fists knock him about and he recovers):
// he keeps his distance, circling, and picks from a lunge with a blade (telegraphed: the blade
// raised and flaring), a volley of light spikes, and below 60% health a giant fist dropped on a
// marked spot. Hal's shield blocks his blade and spikes; a sword cut meeting his parries it and
// staggers him. At 35% he yields.
//
// He reads Hal (`think`, `hit`, `onCast`), and a fight with him is block, then strike. Between his
// attacks, behind his raised blade and through his answers, his guard is up (`stance`): the gun
// meets it at once, and a hook or a cut is turned (a fraction gets through) and answered, a quick
// armoured lunge or a volley. He slips hooks too, the likelier the more Hal throws. What opens him:
// Hal's shield meeting his blade or his spikes, and above all a parry (the shield raised just as
// the blow lands, `RingPowers.guardHit`), which throws him wide open for a moment (`exposed`: blows
// land a third as hard again; parried spikes fly back into him); a sword cut meeting his does the
// same. His volley and his slam are open to a lesser blow, and damage enough inside one breaks him
// out of it. A held shield he works round to its side, or drops the fist on.
export class Sinestro {
  constructor({ scene, physics, powers, player, audio, director, mocap, abin, ring, attachRing, arena = 40, blocks = [], health = HEALTH, yieldAt = YIELD, centre = null }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, arena, blocks, yieldAt });
    this.centre = centre ?? new THREE.Vector3(); // (the middle of the arena)
    this.sparkCol = [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]];
    const rig = (this.rig = createSinestro(abin));
    this.object = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = PIVOT;
    this.object.add(this.pivot);
    this.pivot.add(rig.root);
    rig.root.position.y = -PIVOT;
    scene.add(this.object);
    attachRing(ring, rig);
    this.ring = ring;
    this.anim = new Animator(rig);
    this.standGen = new MocapClip(mocap, 'idle', { timeScale: 0.7 });
    this.flyState = { k: 0 };
    this.flyGen = flight(this.flyState);
    this.anim.play(this.standGen, 0);
    this.anim.look.maxYaw = 0.75;
    const halHead = () => player.rig.bonePosition('head', _look);
    this.anim.lookAt(halHead, 0.6);
    this.bl = new BodyLanguage(rig, this.anim, { gestures: GESTURES, stances: STANCES, scale: 1, reach: 0.55, lookHome: () => halHead, shift: ['behind', 'oneBehind'] });
    this.bl.stance('behind');
    this.yaw = 0;
    this.body = { pitch: 0, roll: 0 };
    this.state = 'stand'; // stand | duel | yield
    this.vel = new THREE.Vector3();
    this.goal = new THREE.Vector3();

    // physics: a capsule the constructs can hit (and shove), steered toward where he wants to be
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, -50, 0).setGravityScale(0).setLinearDamping(1.2).lockRotations().setCcdEnabled(true));
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.33).setDensity(200).setRestitution(0.2), this.rb);
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() });
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: 0.5, health, maxHealth: health, alive: true, hit: (a, p, d, k) => this.hit(a, p, d, k), parry: (from) => this.parry(from), openState: () => this.openState() };

    // constructs: his blade, his shield, the spikes, the giant fist
    this.blade = new Blade(scene, swordGeometry());
    this.blade.form = 0;
    this.shield = constructMesh(shieldGeometry().scale(0.8, 0.8, 0.8), { uPattern: 1, uScale: 0.13, uEmblem: 1, outline: 0.015 });
    this.shield.userData.set('uForm', 0);
    scene.add(this.shield);
    this.spikeGeo = new THREE.OctahedronGeometry(1, 0).scale(0.1, 0.1, 0.6);
    this.spikes = [];
    this.fist = constructMesh(fistGeometry().scale(2.3, 2.3, 2.3), { uPattern: 1, uScale: 0.3, outline: 0.03 });
    this.fist.userData.set('uForm', 0);
    this.fist.visible = false;
    scene.add(this.fist);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.mark.renderOrder = 23;
    scene.add(this.mark);
    this.light = new THREE.PointLight(0x55ff88, 0, 5, 2);
    scene.add(this.light);
    this.hand = new THREE.Vector3();
    this.handTarget = new THREE.Vector3();
    this.bladeDir = new THREE.Vector3(0, 1, 0);
    this.bladeEdge = new THREE.Vector3(1, 0, 0);
    this.action = null;
    this.cool = 1.6;
    this.stagger = 0;
    this.exposed = 0; // thrown wide open by a parry
    this.orbit = 0;
    this.orbitDir = 1;
    this.clock = 0;
    this.poise = 0; // damage taken in the current attack
    this.threat = false; // the gatling spinning, aimed at him
    this.reads = { hooks: [], shield: 0 }; // what Hal has been doing
    this.onQuip = this.onYield = this.onHurtHal = null;
    this.foe = null; // fighting beside Hal: { position (his feet), collider, hit(amount, point) }
  }

  get position() { return this.object.position; }
  get health() { return this.tg.health / this.tg.maxHealth; }

  // stand at a spot (out of the fight), facing a yaw
  place(at, yaw) {
    this.object.position.copy(at);
    this.yaw = yaw;
    this.object.rotation.set(0, yaw, 0);
    this.rb.setTranslation({ x: at.x, y: at.y + PIVOT, z: at.z }, true);
    this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  // The sword lesson, standing: a blade from nothing, held up, a cut through the air, then gone.
  async demo() {
    this.demoing = true;
    this.bl.hold('R', true);
    this.anim.reach('R', () => this.handTarget, { pole: V(-0.8, -0.55, -0.35), rate: 9 });
    this.audio.constructForm(0.8);
    let swung = false;
    await tween(1.2, (k) => {
      const t = k * 1.2;
      const [h, d] = sampleKeys(DEMO, t);
      this.setHand(h, d);
      this.blade.form = Math.min(1, t / 0.35);
      if (!swung && t > 0.72) { swung = true; this.audio.swordSwing(1.3); }
    }, (x) => x);
    await wait(0.4);
    await tween(0.3, (k) => (this.blade.form = 1 - k));
    this.audio.dissolve();
    this.bl.hold('R', false);
    this.demoing = false;
  }

  // The yellow light (Part Six, after Qward): his constructs, sparks and ring light turned to fear's,
  // and a construct of his own for Hal: the F-104 that killed Hal's father, diving at him (`fearJet`).
  turnYellow() {
    this.yellow = true;
    for (const g of [this.shield, this.fist, this.blade.mesh]) fearLight(g);
    this.mark.material.color.setRGB(2.4, 1.5, 0.2);
    this.light.color.set(FEAR.light);
    this.sparkCol = FEAR.spark;
    if (hasProp('f104') && !this.jet) {
      this.jet = fearLight(constructMesh(shapeOf(prop('f104'), 14), { uPattern: 1, uScale: 0.5, outline: 0.05 }));
      this.jet.visible = false;
      this.scene.add(this.jet);
    }
  }

  // into the fight: flying, a target for Hal's constructs
  engage() {
    this.state = 'duel';
    this.anim.play(this.flyGen, 0.5);
    this.bl.stance('oneBehind');
    this.powers.addTarget(this.tg);
    this.powers.watchers.add(this);
    const p = this.object.position;
    this.rb.setTranslation({ x: p.x, y: p.y + PIVOT, z: p.z }, true);
    this.cool = 1.2;
  }

  // On Hal's side (Atrocitus, Part Four): flying round the foe and firing volleys at him.
  ally(foe) {
    this.foe = foe;
    this.state = 'ally';
    this.anim.play(this.flyGen, 0.5);
    this.bl.stance('oneBehind');
    const p = this.object.position;
    this.rb.setTranslation({ x: p.x, y: p.y + PIVOT, z: p.z }, true);
    this.cool = 2.5;
  }

  // what he's facing and aiming at: Hal when they spar, the foe when they fight together
  aimAt(out) {
    if (this.state === 'ally' && this.foe) return out.copy(this.foe.position).setY(this.foe.position.y + 1.5);
    return out.copy(this.player.position).setY(this.player.position.y + 1.15);
  }

  // out of the fight: constructs away, back to his feet
  disengage() {
    this.state = 'stand';
    this.endAction();
    this.powers.removeTarget(this.tg);
    this.powers.watchers.delete(this);
    this.anim.play(this.standGen, 0.6);
    this.bl.stance('behind');
  }

  // committed to an attack, he can't guard (`committed`); the gun gets through in the tell and the
  // recovery, or while he reels (`open`), not while he's coming at Hal blade first
  committed() { return COMMITTED.has(this.action?.kind); }
  open() { return this.stance() !== 'turned' && this.stance() !== 'miss'; }

  // How a blow would land on him now: 'exposed' (a parry threw him open), 'reeling', 'open' (in his
  // volley or his slam, or the moment after a cut), 'turned' (his guard is up: between attacks,
  // behind his raised blade, through an answer) or 'miss' (slipping it).
  stance() {
    if (this.exposed > 0) return 'exposed';
    if (this.stagger > 0) return 'reeling';
    const a = this.action;
    if (!a || a.kind === 'guard' || a.armour) return 'turned';
    if (a.kind === 'dodge') return 'miss';
    if (a.kind === 'lunge') return a.phase === 'recover' ? 'open' : 'turned';
    return 'open';
  }
  // for the target bracket: wide open, open, or neither
  openState() { const s = this.state === 'duel' ? this.stance() : 'turned'; return s === 'exposed' ? 'exposed' : s === 'reeling' || s === 'open' ? 'open' : null; }

  hit(amount, point, dir, kind = 'hit') {
    if (this.state !== 'duel' || !this.tg.alive) return 0;
    if (kind === 'explosion') { this.tg.health = Math.max(0, this.tg.health - amount * 0.5); if (this.tg.health <= this.tg.maxHealth * this.yieldAt) this.yieldFight(); return amount * 0.5; }
    const how = this.stance(), blow = kind === 'hook' || kind === 'sword' || kind === 'hammer', hud = this.powers.hud;
    if (how === 'miss') return 0;
    if (how === 'turned') {
      // his guard (or his blade) takes it
      this.block(point, blow);
      if (kind === 'gatling') { if (!this.action) this.begin('guard'); return 0; }
      if (!blow) return 0;
      amount *= LANDS.turned;
      hud.callout('Turned', 'turned');
      this.answer();
    } else {
      amount *= LANDS[how];
      if (kind === 'gatling') amount *= 0.5; // (his aura takes the edge off the gun)
      if (how === 'exposed' && blow) hud.callout('Counter', 'counter');
    }
    this.tg.health = Math.max(0, this.tg.health - amount);
    // inside an attack: enough of it breaks him out (the reward for reading his tells)
    if (how === 'open' && this.committed() && (this.poise += amount) >= POISE && this.clock > (this.steady ?? 0)) {
      this.endAction();
      this.poise = 0;
      this.stagger = Math.max(this.stagger, 0.6);
      this.steady = this.clock + 2.1;
      this.cool = 0.6;
      this.onQuip?.('hurt');
    }
    if (amount > 30) this.onQuip?.('hurt');
    if (this.tg.health <= this.tg.maxHealth * this.yieldAt) this.yieldFight();
    return amount;
  }

  // a blow turned: he answers it at once (his blade, already raised, comes straight on; else a quick
  // armoured lunge, or a volley from further off), but not twice over
  answer() {
    const a = this.action;
    if (a?.kind === 'lunge' && a.phase === 'wind') { a.t = 9; return; }
    if ((a && a.kind !== 'guard') || this.clock < (this.answered ?? 0)) return;
    this.answered = this.clock + 1.2;
    this.riposte();
  }

  // thrown wide open: rocked back, his blade gone, a moment before he recovers
  expose(at, dur = EXPOSE) {
    this.endAction();
    this.exposed = Math.max(this.exposed, dur);
    this.stagger = Math.max(this.stagger, dur);
    this.poise = 0;
    this.cool = 0.5;
    const away = _b.subVectors(this.object.position, this.player.position).setY(0).normalize(), m = this.rb.mass();
    this.rb.applyImpulse({ x: away.x * 4 * m, y: 1.2 * m, z: away.z * 4 * m }, true);
    this.anim.gesture('shake', 1, 0.5);
    if (at) this.powers.sparks.emit(40, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 6; }, { life: 0.5, size: [0.07, 0], color: this.sparkCol });
  }

  // the guard turns it: the shield flashes where it was hit
  block(point, heavy = false) {
    if (this.clock - (this.lastBlock ?? -1) > 0.07) { this.audio.shieldHit(0.4); if (heavy) this.audio.turned(1); }
    this.lastBlock = this.clock;
    this.guard = Math.max(this.guard ?? 0, 0.7);
    this.shield.userData.set('uHit', 1);
    if (point) this.shield.userData.u.uHitPos.value.copy(point);
  }

  // a blow turned: his blade meets it and he cuts back before Hal's next lands (from close in), or
  // spikes straight back (from further off)
  riposte() {
    this.audio.clash();
    this.powers.sparks.emit(26, (q, v) => { q[0] = this.tg.position.x; q[1] = this.tg.position.y + 0.2; q[2] = this.tg.position.z; v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 5; }, { life: 0.4, size: [0.06, 0], color: this.sparkCol });
    this.powers.hitStop = 0.06;
    const d = this.object.position.distanceTo(this.player.position);
    this.begin(d < LUNGE.range ? 'lunge' : 'volley', { quick: true, armour: true });
    this.onQuip?.('riposte');
  }

  // what Hal just cast at him: a hook or the hammer, slipped if he can (likelier the more Hal throws
  // them); a hook into his guard he takes (it breaks it)
  onCast(id, data) {
    if (this.state !== 'duel' || this.action || this.stagger > 0 || this.guard > 0.3) return;
    if (id !== 'fist' && id !== 'hammer') return;
    const me = this.tg.position, hal = this.player.position;
    if (id === 'fist') {
      this.reads.hooks = this.reads.hooks.filter((t) => this.clock - t < 5);
      this.reads.hooks.push(this.clock);
      const r = Math.hypot(me.x - hal.x, me.z - hal.z);
      if (data.target !== this.tg && Math.abs(r - data.radius) > 2.5) return; // (not at him)
    } else if (data.target !== this.tg && data.at.distanceTo(me) > 5) return;
    const chance = id === 'hammer' ? 0.75 : Math.min(0.85, 0.3 + 0.2 * (this.reads.hooks.length - 1));
    if (Math.random() < chance) { this.begin('dodge', { from: id }); this.onQuip?.('dodge'); }
  }

  // Hal's sword meeting his blade mid-cut: the blades ring, he reels
  parry() {
    if (this.action?.kind !== 'lunge' || this.action.phase !== 'cut') return false;
    this.clash();
    return true;
  }

  // (a parry by the sword: the blades ring, and he's thrown open as by the shield's)
  clash() {
    this.audio.clash();
    this.audio.parry();
    this.director.shake(0.25, 0.3);
    this.powers.hitStop = 0.14;
    this.powers.hud.callout('Parry', 'parry');
    this.expose(this.blade.tip.clone());
    this.onQuip?.('parried');
  }

  yieldFight() {
    if (this.state !== 'duel') return;
    this.state = 'yield';
    this.endAction();
    this.powers.removeTarget(this.tg);
    this.powers.watchers.delete(this);
    this.onYield?.();
  }

  endAction() {
    const a = this.action;
    this.action = null;
    if (a?.kind === 'lunge' || a?.kind === 'guard') this.bl.hold('R', false);
    if (a?.kind === 'volley' || a?.kind === 'slam' || a?.kind === 'fearJet') this.anim.reach('R', null, { rate: 5 });
    if (this.jet) this.jet.visible = false;
    a?.snd?.stop(0.8);
    if (a?.kind === 'volley') for (const sp of a.made) if (!sp.flying) sp.mesh.removeFromParent();
    this.mark.material.opacity = 0;
    this.fist.visible = false;
  }

  // ------------------------------------------------------------------------------------ update
  update(dt, t) {
    if (dt <= 0) return;
    this.clock += dt;
    const p = this.rb.translation();
    if (this.state === 'stand') {
      this.rb.setTranslation({ x: this.object.position.x, y: this.object.position.y + PIVOT, z: this.object.position.z }, true);
      this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      this.object.position.set(p.x, p.y - PIVOT, p.z);
      this.fly(dt);
    }
    this.tg.position.set(this.object.position.x, this.object.position.y + 1.25, this.object.position.z);
    if (this.state === 'duel') this.think(dt, t);
    else if (this.state === 'ally') this.thinkAlly(dt);
    this.updateConstructs(dt, t);
    this.updateSpikes(dt);
    this.bl.update(dt);
    this.anim.update(dt);
  }

  // where he wants to be, and flying there
  fly(dt) {
    const ally = this.state === 'ally' && this.foe, hal = ally ? this.foe.position : this.player.position, me = this.object.position;
    this.stagger = Math.max(0, this.stagger - dt);
    this.exposed = Math.max(0, this.exposed - dt);
    if (this.state === 'duel' && this.exposed > 0) this.goal.copy(me).setY(Math.max(me.y, 0.4)); // (hanging where the blow left him)
    else if (ally && !this.action?.moves) {
      // high and wide of him, never still
      this.orbit += this.orbitDir * dt * 0.35;
      if (Math.random() < dt * 0.1) this.orbitDir *= -1;
      this.goal.set(hal.x + Math.sin(this.orbit) * 9, hal.y + 3.6 + Math.sin(this.orbit * 2.3) * 0.8, hal.z + Math.cos(this.orbit) * 9);
    } else if (this.state === 'duel' && !this.action?.moves) {
      // circling at his preferred range, at Hal's height when Hal flies, else hovering over the deck
      // (round to the side of a held shield, fast)
      const flank = this.reads.shield > 0.5;
      if (flank) { _b.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw)); _c.subVectors(me, hal).setY(0); this.orbitDir = _b.x * _c.z - _b.z * _c.x > 0 ? -1 : 1; } // (the way that takes him off its face)
      this.orbit += this.orbitDir * dt * (flank ? 1.6 : 0.55);
      if (!flank && Math.random() < dt * 0.12) this.orbitDir *= -1;
      const r = this.action?.kind === 'guard' ? 7.5 : 6.5;
      this.goal.set(hal.x + Math.sin(this.orbit) * r, 0, hal.z + Math.cos(this.orbit) * r);
      this.goal.y = this.player.flying ? hal.y + 0.6 : 0.4;
    } else if (this.state === 'yield') this.goal.set(me.x, 0.25, me.z);
    // inside the deck, clear of the pillars
    const cx = this.centre.x, cz = this.centre.z, rr = Math.hypot(this.goal.x - cx, this.goal.z - cz), lim = this.arena - 4;
    if (rr > lim) { this.goal.x = cx + (this.goal.x - cx) * lim / rr; this.goal.z = cz + (this.goal.z - cz) * lim / rr; }
    for (const b of this.blocks) {
      const dx = this.goal.x - b.x, dz = this.goal.z - b.z, d = Math.hypot(dx, dz);
      if (d < b.r + 1.6 && this.goal.y < b.h + 0.5) { this.goal.x = b.x + (dx / (d || 1)) * (b.r + 1.6); this.goal.z = b.z + (dz / (d || 1)) * (b.r + 1.6); }
    }
    if (this.goal.y < 0.25) this.goal.y = 0.25;
    // a damped spring toward the goal; weaker while he reels
    const lv = this.rb.linvel(), maxV = this.action?.dash ? 17 : 8;
    _a.subVectors(this.goal, me).multiplyScalar(this.action?.dash ? 6 : 2.2);
    if (_a.length() > maxV) _a.setLength(maxV);
    const grip = this.stagger > 0 ? 1.2 : this.action?.dash ? 12 : 4;
    this.vel.set(lv.x, lv.y, lv.z).lerp(_a, Math.min(1, grip * dt));
    this.rb.setLinvel({ x: this.vel.x, y: this.vel.y, z: this.vel.z }, true);
    // facing Hal; leaning into his flight, rocked back while he reels
    const want = Math.atan2(hal.x - me.x, hal.z - me.z);
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -6 * dt, 6 * dt));
    this.object.rotation.set(0, this.yaw, 0);
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw), side = -this.vel.x * Math.cos(this.yaw) + this.vel.z * Math.sin(this.yaw);
    this.body.pitch = damp(this.body.pitch, clamp(0.05 + fwd * 0.03, -0.25, 0.5) - Math.min(this.stagger, 0.9) * 0.4, 5, dt);
    this.body.roll = damp(this.body.roll, clamp(side * 0.025, -0.35, 0.35), 5, dt);
    this.pivot.quaternion.copy(_qa.setFromAxisAngle(_Z, this.body.roll)).multiply(_qb.setFromAxisAngle(_X, this.body.pitch));
    this.flyState.k = damp(this.flyState.k, smooth(5, 14, this.vel.length()) * 0.6, 4, dt);
  }

  // beside Hal: a volley at the foe every few seconds
  thinkAlly(dt) {
    if (this.action) { this.runAction(dt); return; }
    this.cool -= dt;
    if (this.cool <= 0) this.begin('volley');
  }

  // the fight: read Hal, then pick an attack
  think(dt) {
    const P = this.powers, player = this.player, hal = player.position, d = this.object.position.distanceTo(hal);
    // the barrels spinning up at him: his guard, now (unless he's in the middle of something)
    const gat = P.gatling, threat = (this.threat = !!(gat && !gat.ending && gat.firing && gat.spin > 0.25 && P.aim.target === this.tg));
    if (threat && !this.committed() && this.stagger <= 0 && this.action?.kind !== 'guard') this.begin('guard');
    // Hal hiding behind his shield
    const was = this.reads.shield;
    this.reads.shield = P.shield && !P.shield.ending ? this.reads.shield + dt : 0;
    if (was < 0.8 && this.reads.shield >= 0.8) this.onQuip?.('flank');
    if (this.action) { this.runAction(dt); return; }
    if (this.stagger > 0) return;
    this.poise = 0;
    this.cool -= dt * (P.charge < 15 ? 2 : 1); // (the ring nearly out: he doesn't let up)
    if (this.cool > 0) return;
    const phase2 = this.health < 0.62, r = Math.random();
    // a held shield: from its side (he circles faster to get there), or the fist from above
    if (this.reads.shield > 0.8) {
      _b.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      _c.subVectors(this.object.position, hal).setY(0).normalize();
      if (_b.dot(_c) > 0.45) { if (phase2 || this.reads.shield > 2.5) this.begin('slam'); else this.cool = 0.25; return; }
    }
    if (this.jet && (phase2 ? r < 0.3 : r < 0.12) && this.clock - (this.lastJet ?? -99) > 9) this.begin('fearJet');
    else if (phase2 && r < 0.25) this.begin('slam');
    else if (d < LUNGE.range && r < 0.65) this.begin('lunge');
    else this.begin('volley');
  }

  begin(kind, opts = {}) {
    if (this.action) this.endAction();
    this.action = { kind, t: 0, phase: 'wind', ...opts };
    const a = this.action;
    this.poise = 0;
    if (kind === 'dodge') {
      // away from Hal and up, out of the arc or from under the hammer
      const hal = this.player.position, me = this.object.position;
      const away = _b.subVectors(me, hal).setY(0).normalize(), side = _c.set(-away.z, 0, away.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
      a.to = me.clone().addScaledVector(away, 4.2).addScaledVector(side, 2.2);
      a.to.y = Math.max(me.y + 1.8, (this.player.flying ? hal.y : 0) + 2.2);
      a.dash = a.moves = true;
      this.audio.whoosh(0.5, 0.7);
    } else if (kind === 'lunge') {
      this.bl.hold('R', true);
      this.anim.reach('R', () => this.handTarget, { pole: V(-0.8, -0.55, -0.35), rate: 16 });
      this.audio.constructForm(0.6);
      this.audio.tone({ type: 'sawtooth', freq: 160, to: 520, attack: 0.4, peak: 0.04, dur: 0.55, wet: 0.4 });
    } else if (kind === 'volley') {
      this.pointAt(true);
      this.audio.constructForm(0.5);
      a.made = [];
      a.fired = 0;
    } else if (kind === 'guard') {
      this.bl.hold('R', true);
      this.anim.reach('R', () => this.handTarget, { pole: V(-0.7, -0.6, -0.3), rate: 18 });
      this.audio.shieldUp();
      a.held = a.fire = 0;
    } else if (kind === 'slam') {
      this.pointAt(true);
      a.at = this.player.position.clone();
      this.onQuip?.('slam');
    } else if (kind === 'fearJet') {
      // high off to one side of Hal, nose on him; the engine's scream before you see it
      this.pointAt(true);
      this.lastJet = this.clock;
      // (beyond him, off to one side: where the camera, watching him, can see it form)
      const hal = this.player.position, toward = _b.subVectors(this.object.position, hal).setY(0).normalize();
      a.from = hal.clone().addScaledVector(toward.applyAxisAngle(_Y, (Math.random() < 0.5 ? -1 : 1) * 0.4), 36).setY(hal.y + 16);
      a.at = hal.clone();
      a.snd = this.audio.jetEngine?.();
      a.snd?.set(0.5, 1.25);
      this.audio.tone({ type: 'sawtooth', freq: 90, to: 640, attack: 1.2, peak: 0.05, dur: 1.5, wet: 0.5 });
      this.onQuip?.('fear');
    }
  }

  pointAt(on) {
    const sh = new THREE.Vector3(), out = new THREE.Vector3();
    this.anim.reach('R', on ? () => { this.rig.bonePosition('upperArm_R', sh); return this.aimAt(out).sub(sh).normalize().multiplyScalar(0.56).add(sh); } : null, { pole: V(-0.6, -0.7, -0.3), rate: 9 });
  }

  runAction(dt) {
    const a = this.action, hal = this.player.position, me = this.object.position, P = this.powers;
    a.t += dt;
    if (a.kind === 'lunge') {
      if (a.phase === 'wind') {
        // the blade forms over his shoulder and flares: the tell
        this.setHand(CUT.wind[0], CUT.wind[1]);
        this.blade.form = Math.min(1, a.t / 0.3);
        a.moves = false;
        if (a.t > (a.quick ? LUNGE.quick : LUNGE.wind)) { a.phase = 'dash'; a.t = 0; a.dash = true; a.moves = true; this.audio.whoosh(0.6, 0.5); }
      } else if (a.phase === 'dash') {
        this.goal.copy(hal).addScaledVector(_a.subVectors(me, hal).setY(0).normalize(), 1.3).setY(this.player.flying ? hal.y : 0.3);
        if (me.distanceTo(hal) < 2.0 || a.t > 0.65) { a.phase = 'cut'; a.t = 0; a.dash = false; this.audio.swordSwing(1.2); }
      } else if (a.phase === 'cut') {
        const [h, d] = sampleKeys(CUT.keys, a.t);
        this.setHand(h, d);
        if (!a.struck && a.t > 0.11) {
          a.struck = true;
          if (me.distanceTo(hal) < 2.4) {
            // Hal's sword mid-cut parries; his shield blocks (raised just in time, parries); else
            // the blade lands (an answer harder)
            if (P.sword?.cutting) { this.clash(); return; }
            const from = this.blade.tip.clone(), guard = P.guardHit(me, from);
            if (guard === 'parry') { this.audio.clash(); this.expose(from); this.onQuip?.('parried'); return; }
            if (guard === 'block') {
              // the blade glances off; he's carried past, a beat to recover
              this.audio.clash();
              this.endAction();
              this.stagger = 0.6;
              this.cool = 0.5;
              const away = _b.subVectors(me, hal).setY(0).normalize(), m = this.rb.mass();
              this.rb.applyImpulse({ x: away.x * 3 * m, y: 0.5 * m, z: away.z * 3 * m }, true);
              return;
            }
            P.damage(LUNGE.damage * (a.armour ? 1.3 : 1), me); this.audio.swordHit(1); this.onHurtHal?.();
          }
        }
        if (a.t > 0.3) { a.phase = 'recover'; a.t = 0; }
      } else if (a.phase === 'recover') {
        this.blade.form = Math.max(0, 1 - a.t / 0.3);
        if (a.t > 0.45) {
          // still on top of him: a second cut, quick
          const again = !a.second && me.distanceTo(hal) < 3.2 && Math.random() < 0.4;
          this.endAction();
          if (again) this.begin('lunge', { quick: true, second: true });
          else this.cool = 0.7 + Math.random() * 0.8;
        }
      }
    } else if (a.kind === 'volley') {
      // spikes of light take shape in an arc behind him, then fly at Hal one after another
      if (a.phase === 'wind') {
        while (a.made.length < SPIKE.count && a.t > a.made.length * 0.08) {
          const m = constructMesh(this.spikeGeo, { uPattern: 0, outline: 0.012 });
          if (this.yellow) fearLight(m);
          m.userData.set('uForm', 0);
          this.scene.add(m);
          a.made.push({ mesh: m, t: 0, slot: a.made.length });
        }
        if (a.t > (a.quick ? 0.32 : 0.6)) { a.phase = 'fire'; a.t = 0; }
      } else if (a.phase === 'fire') {
        while (a.fired < a.made.length && a.t > a.fired * (a.quick ? 0.09 : 0.14)) this.launch(a.made[a.fired++]);
        if (a.fired >= a.made.length && a.t > 0.5) { this.endAction(); this.cool = this.state === 'ally' ? 3 + Math.random() * 2.5 : 0.8 + Math.random() * 0.8; }
      }
      for (const s of a.made) if (!s.flying) this.holdSpike(s, dt);
    } else if (a.kind === 'guard') {
      // held while the gun is on him; held on him long enough, it's answered
      this.setHand([-0.06, 1.36, 0.42], [0, 1, 0]);
      this.guard = Math.min(1, (this.guard ?? 0) + dt * 10);
      if (this.threat) { a.fire += dt; a.held = 0; } else a.held += dt;
      if (a.fire > 0.75) {
        const d = me.distanceTo(hal);
        this.endAction();
        this.begin(d < LUNGE.range ? 'lunge' : 'volley', { quick: true, armour: true });
        this.onQuip?.('counter');
      } else if (a.held > 0.4) { this.endAction(); this.cool = 0.35 + Math.random() * 0.4; }
    } else if (a.kind === 'dodge') {
      this.goal.copy(a.to);
      if (a.t > 0.42) {
        // out of it, and back at him while he's still in the follow-through
        this.endAction();
        const d = me.distanceTo(hal);
        if (Math.random() < 0.6) this.begin(d < LUNGE.range ? 'lunge' : 'volley', { quick: true });
        else this.cool = 0.4;
      }
    } else if (a.kind === 'fearJet') {
      // it forms where he points (1.3 s, the line it will fly marked on the ground), then dives
      // through where Hal was, on into the ground: a shield meets it (raised as it arrives, a parry:
      // it breaks up and he's thrown open); in its way, it hits hard
      const jet = this.jet;
      if (a.phase === 'wind') {
        a.at.lerp(_a.copy(hal), Math.min(1, dt * 2.5));
        jet.visible = true;
        jet.userData.set('uForm', Math.min(1, a.t / 0.8));
        jet.position.copy(a.from);
        jet.quaternion.setFromUnitVectors(_Zf, _a.subVectors(a.at, a.from).normalize());
        this.mark.position.copy(a.at).setY(this.player.flying ? hal.y : 0.05);
        this.mark.material.opacity = Math.min(0.9, a.t) * (0.6 + 0.4 * Math.sin(a.t * 18));
        if (a.t > 1.3) { a.phase = 'dive'; a.t = 0; a.dir = _a.subVectors(a.at, a.from).normalize().clone(); a.len = a.from.distanceTo(a.at); this.audio.whoosh(0.8, 1); }
      } else if (a.phase === 'dive') {
        const speed = 70, s0 = (a.t - dt) * speed, s1 = a.t * speed;
        jet.position.copy(a.from).addScaledVector(a.dir, s1);
        // swept from last frame to this one: did it pass through Hal?
        _b.copy(a.from).addScaledVector(a.dir, s0);
        _c.subVectors(hal, _b).setY(_c.y + 1.0);
        const along = clamp(_c.dot(a.dir), 0, s1 - s0), miss = _c.addScaledVector(a.dir, -along).length();
        if (!a.struck && miss < 3.2 && s1 > a.len - 6) {
          a.struck = true;
          const guard = P.guardHit(jet.position, jet.position.clone());
          if (guard === 'parry') { this.audio.explosion(0.5); P.dustFx(jet.position.clone(), 30, 3); this.expose(jet.position.clone()); this.onQuip?.('parried'); return; }
          if (guard === 'block') { P.damage(6, jet.position); this.audio.explosion(0.45); this.director.shake(0.5, 0.4); }
          else { P.damage(30, jet.position); this.player.dash?.(a.dir.clone().setY(0).normalize(), 6, 0.3); this.onHurtHal?.(); this.director.shake(0.9, 0.6); }
        }
        if (s1 >= a.len + 4 || jet.position.y < 0.3) {
          a.phase = 'recover'; a.t = 0;
          const at = jet.position.clone().setY(Math.max(0, jet.position.y));
          this.audio.explosion(0.6);
          this.director.shake(0.6, 0.5);
          P.dustFx(at, 50, 5);
          this.physics.burst(at, 7, 6, 3, 1);
          if (!a.struck && Math.hypot(hal.x - at.x, hal.z - at.z) < 4 && Math.abs(hal.y - at.y) < 3) { P.damage(18, at); this.onHurtHal?.(); }
        }
      } else if (a.phase === 'recover') {
        this.mark.material.opacity = Math.max(0, 0.9 - a.t * 3);
        jet.userData.set('uForm', Math.max(0, 1 - a.t / 0.35));
        if (a.t > 0.6) { this.endAction(); this.cool = 1.4 + Math.random(); }
      }
    } else if (a.kind === 'slam') {
      // he marks the spot under Hal, then a giant fist comes down on it
      if (a.phase === 'wind') {
        a.at.lerp(_a.copy(hal), Math.min(1, dt * 3));
        a.at.y = this.player.flying ? hal.y : 0;
        this.mark.position.copy(a.at).y += 0.05;
        this.mark.material.opacity = Math.min(0.9, a.t * 1.5) * (0.6 + 0.4 * Math.sin(a.t * 18));
        this.fist.visible = true;
        this.fist.userData.set('uForm', Math.min(1, a.t / 0.5));
        this.fist.position.copy(a.at).y += 9;
        this.fist.quaternion.setFromUnitVectors(_Zf, _down);
        if (a.t > 1.0) { a.phase = 'drop'; a.t = 0; this.audio.whoosh(0.5, 0.8); }
      } else if (a.phase === 'drop') {
        this.fist.position.copy(a.at).y += 9 * (1 - Math.min(1, a.t / 0.18)) + 1.2;
        if (a.t >= 0.18) {
          a.phase = 'recover'; a.t = 0;
          this.audio.explosion(0.55);
          this.director.shake(0.7, 0.6);
          P.dustFx(a.at, 40, 4);
          this.physics.burst(a.at, 6, 5, 3, 1);
          const dh = Math.hypot(hal.x - a.at.x, hal.z - a.at.z);
          if (dh < 3.1 && Math.abs(hal.y - a.at.y) < 2.5) { P.damage(22, a.at.clone().setY(a.at.y + 3)); this.onHurtHal?.(); }
        }
      } else if (a.phase === 'recover') {
        this.mark.material.opacity = Math.max(0, 0.9 - a.t * 3);
        this.fist.userData.set('uForm', Math.max(0, 1 - a.t / 0.4));
        if (a.t > 0.6) { this.endAction(); this.cool = 1.6 + Math.random(); }
      }
    }
  }

  // the right hand at a point and the blade's direction, in his own frame
  setHand(h, d) {
    const root = this.rig.root;
    root.updateMatrixWorld(true);
    this.handTarget.set(h[0], h[1], h[2]).applyMatrix4(root.matrixWorld);
    root.getWorldQuaternion(_qa);
    _b.copy(this.bladeDir);
    this.bladeDir.set(d[0], d[1], d[2]).normalize().applyQuaternion(_qa);
    _b.subVectors(this.bladeDir, _b);
    if (_b.lengthSq() > 1e-6) this.bladeEdge.lerp(_b.normalize(), 0.5);
  }

  holdSpike(s, dt) {
    s.t += dt;
    s.mesh.userData.set('uForm', Math.min(1, s.t / 0.25));
    const me = this.object.position, k = (s.slot / (SPIKE.count - 1) - 0.5) * 2.2;
    const back = _a.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = _b.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    s.mesh.position.copy(me).addScaledVector(back, 0.5).addScaledVector(right, k * 0.9).y += 1.9 + Math.cos(k) * 0.35;
    s.mesh.lookAt(this.aimAt(_c));
  }

  launch(s) {
    const p = this.player, from = s.mesh.position.clone(), lead = from.distanceTo(p.position) / SPIKE.speed;
    const aim = this.aimAt(new THREE.Vector3());
    s.foe = this.state === 'ally' ? this.foe : null;
    if (s.foe) aim.addScaledVector(s.foe.vel ?? _a.set(0, 0, 0), lead * 0.7);
    else if (p.flying) aim.addScaledVector(p.vel, lead * 0.7);
    else aim.add(_a.set(Math.sin(p.heading) * p.speed, 0, Math.cos(p.heading) * p.speed).multiplyScalar(lead * 0.7));
    s.flying = true;
    s.vel = aim.sub(from).normalize().multiplyScalar(SPIKE.speed);
    s.pos = from;
    s.prev = from.clone();
    s.life = 0;
    this.spikes.push(s);
    this.audio.tone({ type: 'triangle', freq: 900, to: 300, attack: 0.005, peak: 0.05, dur: 0.18, wet: 0.3 });
  }

  updateSpikes(dt) {
    const P = this.powers, world = this.physics.world, player = this.player;
    this.spikes = this.spikes.filter((s) => {
      s.life += dt;
      s.prev.copy(s.pos);
      if (s.back) s.vel.lerp(_a.subVectors(this.tg.position, s.pos).setLength(SPIKE.speed), Math.min(1, dt * 8)); // (homing back on him)
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      s.mesh.lookAt(_a.copy(s.pos).add(s.vel));
      _a.subVectors(s.pos, s.prev);
      const len = _a.length();
      let done = s.life > 2.5;
      if (s.back) {
        // parried: back into him
        if (s.pos.distanceTo(this.tg.position) < 0.9) { this.spiked(s.pos); done = true; }
        else if (s.life > 1.2) done = true;
      } else if (!done && len > 1e-5) {
        // (fired at the foe, they pass Hal and his shield by)
        const hit = world.castRay(new RAPIER.Ray(s.prev, _a.divideScalar(len)), len, true, undefined, undefined, this.col, undefined, (c) => !P.bounds?.has(c.handle) && !(s.foe && (c.handle === player.collider?.handle || c.handle === P.shield?.col.handle)));
        if (hit) {
          const at = s.prev.clone().addScaledVector(_a, hit.timeOfImpact), h = hit.collider.handle;
          const prop = this.physics.smash?.ofCollider(hit.collider); // (a car, a lamp post: it marks it)
          if (prop) this.physics.smash.blow(prop, 5, at, _c.copy(s.vel).normalize(), 'spike');
          if (s.foe) { if (h === s.foe.collider?.handle) s.foe.hit(SPIKE.damage, at, _c.copy(s.vel).normalize()); }
          else if (P.shield && h === P.shield.col.handle) {
            if (P.guardHit(s.prev, at) === 'parry' && this.state === 'duel') {
              s.back = true; s.life = 0;
              s.pos.copy(at); s.vel.negate();
              return true;
            }
            if (!P.shield.blocks(s.prev)) P.shield.ripple(at);
          }
          else if (h === player.collider?.handle) { P.damage(SPIKE.damage, s.prev); this.onHurtHal?.(); }
          P.sparks.emit(14, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 4; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 4; }, { life: 0.35, size: [0.05, 0], color: this.sparkCol });
          done = true;
        }
      }
      if (done) { s.mesh.removeFromParent(); return false; }
      return true;
    });
  }

  // his own spike, parried back into him: it bites, and the first throws him open
  spiked(at) {
    if (this.state !== 'duel') return;
    this.powers.dealDamage({ alive: true, hit: (a) => { this.tg.health = Math.max(0, this.tg.health - a); return a; } }, 10, at);
    this.audio.swordHit(0.7);
    this.powers.sparks.emit(18, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 5; }, { life: 0.4, size: [0.06, 0], color: this.sparkCol });
    if (this.exposed <= 0) { this.expose(null, 1.5); this.onQuip?.('parried'); }
    if (this.tg.health <= this.tg.maxHealth * this.yieldAt) this.yieldFight();
  }

  updateConstructs(dt, t) {
    // the blade in his right hand (forming, held, dissolving)
    if (this.blade.form > 0.001) {
      this.rig.bonePosition('hand_R', this.hand);
      this.rig.bonePosition('foreArm_R', _c);
      this.hand.addScaledVector(_c.subVectors(this.hand, _c).normalize(), 0.075);
      this.blade.place(this.hand, this.bladeDir, this.bladeEdge);
    }
    if (this.action?.kind !== 'lunge' && !this.demoing) this.blade.form = Math.max(0, this.blade.form - dt * 3.5); // (put away when a cut is cut short)
    this.blade.mesh.visible = this.blade.form > 0.001;
    this.blade.update(dt, t);
    // the shield before his ring fist
    // (the guard stays up through the start of an answer to the gun)
    const a = this.action, keep = a?.armour && a.phase !== 'cut' && a.phase !== 'recover';
    if (a?.kind !== 'guard' && !keep) this.guard = Math.max(0, (this.guard ?? 0) - dt * 4);
    this.shield.visible = this.guard > 0.01;
    if (this.shield.visible) {
      this.rig.bonePosition('hand_R', this.hand);
      const fwd = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.shield.position.copy(this.hand).addScaledVector(fwd, 0.35);
      this.shield.quaternion.setFromUnitVectors(_Zf, fwd);
      this.shield.userData.set('uForm', this.guard);
      this.shield.userData.set('uTime', t);
      const u = this.shield.userData.u;
      u.uHit.value = Math.max(0, u.uHit.value - dt * 2.5);
      this.shield.userData.ou.uHit.value = u.uHit.value;
    }
    this.fist.userData.set('uTime', t);
    // (held a hand's breadth off his body: on the ring itself, a hand brought to his chest put the
    // light a centimetre from the glossy suit, and the bloom made a green ball of it)
    const ringAt = this.ring.getWorldPosition(_lc);
    _c.copy(ringAt).sub(this.rig.bonePosition('chest', _lc2)).setY(0);
    if (_c.lengthSq() < 1e-6) _c.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.light.position.copy(ringAt).addScaledVector(_c.normalize(), 0.22);
    // (out of a fight, off: a point light at his ring hand, a hand's breadth from his glossy suit,
    // bloomed into a green ball in every close shot; kept in the scene at 0, as toggling a light
    // recompiles every material)
    this.light.intensity = damp(this.light.intensity, this.action ? 3 : 0, 6, dt);
  }

  dispose() {
    this.endAction();
    this.powers.watchers.delete(this);
    for (const s of this.spikes) s.mesh.removeFromParent();
    this.blade.dispose();
    for (const o of [this.object, this.shield, this.fist, this.mark, this.light, this.jet]) o?.removeFromParent();
    this.powers.removeTarget(this.tg);
    this.physics.world.removeRigidBody(this.rb);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
  }
}

function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, h0, d0] = keys[i], [t1, h1, d1] = keys[i + 1];
    if (t < t1) {
      const k = (t - t0) / (t1 - t0), e = k * k * (3 - 2 * k);
      return [h0.map((v, j) => v + (h1[j] - v) * e), d0.map((v, j) => v + (d1[j] - v) * e)];
    }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _look = new THREE.Vector3(), _lc = new THREE.Vector3(), _lc2 = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0), _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1), _Zf = new THREE.Vector3(0, 0, 1), _down = new THREE.Vector3(0, -1, 0);
