import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { createAtrocitus } from '../characters/Characters.js';
import { Particles } from '../fx/Particles.js';
import { glowTexture } from '../fx/Textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const HEALTH = 900;
const CHEST = 1.6; // his chest's height (he's 2.25 m)
const WALK = 2.1, PRESS = 1.35; // his walk, and his walk on through gunfire behind his arms
const CHARGE = { wind: 0.85, quick: 0.45, track: 0.5, speed: 11, time: 1.25, damage: 26, reach: 1.8, stun: 1.8 };
const BEAM = { speed: 19, damage: 20, pick: 12, reach: 1.6 };
const BLOOD = { count: 7, speed: 16, damage: 6, burn: 4.5, dps: 9 };
const SLAM = { wind: 0.75, quick: 0.45, reach: 9.5, speed: 17, damage: 20, near: 4 };
const POISE = 90; // damage inside one of his attacks that rocks him out of it: more than the gun alone (his answers can't be)
const COMMITTED = new Set(['charge', 'blood', 'slam']); // (and a beam once it's off the ground)
const EXPOSE = 1.8; // a parried charge throws him wide open this long (his own beam or blood back in his face, less)
const LANDS = { exposed: 1.35, reeling: 1, side: 1, open: 0.6, turned: 0.15 }; // how much of a blow gets through (see `stance`)

// Atrocitus, downtown (Part Four): the last of Ysmault's Five Inversions, out of Abin Sur's cell and
// strong enough to break a Lantern with his hands. On foot and heavy (a kinematic body the ring's
// constructs hit but don't shove), he comes on at a walk and picks from four things, each with a
// tell: a charge (he drops his head and a red line runs out along the ground; he comes in a straight
// rush, and a wall or a held shield in his way stops him dead and stuns him, which is the opening);
// a steel beam off the site's floor, lifted overhead and thrown (the shield or a wall stops it); his
// blood, the Inversions' magic, drawn from his palm and flung in a fan of burning drops that leave
// fires on the ground; and close in, both fists into the ground, a shockwave that only flight gets
// over. His health is the bar across the top; the story ends the fight from it.
//
// He reads Hal (`think`, `hit`), and the fight is block, then strike. Between his attacks his
// gauntlets are up (`stance`): the gatling rings off them (he covers the moment the barrels spin up
// at him and walks on through it, and held on him it's answered), and a hook is turned (a fraction
// gets through) and answered at once, armoured: the slam, a quick charge, his blood. What opens him:
// a charge stopped by a wall, or by Hal's shield (held, a short stagger; raised just as he hits, a
// parry, `RingPowers.guardHit`, and he's wide open, `exposed`); a beam or his blood met by a parry
// goes back into him and does the same, less. Inside an attack (a beam overhead, his blood drawn,
// the slam) a lesser blow gets through, and damage enough rocks him out of it (a beam held overhead
// comes down on him). And Sinestro: his spikes turn Atrocitus on him, and his side is open.
export class Atrocitus {
  constructor({ scene, physics, powers, player, audio, director, engine, mocap, characters, ground = () => 0, center = V(0, 0, 0), radius = 30, blocks = [], loose = [] }) {
    Object.assign(this, { scene, physics, powers, player, audio, director, engine, ground, center, radius, blocks, loose });
    const rig = (this.rig = createAtrocitus(characters.atrocitus));
    scene.add(rig.root);
    this.anim = new Animator(rig);
    this.loco = new Locomotion(mocap);
    this.loco.scale = rig.hipsHeight / mocap.hipsHeight;
    this.loco.relax = { elbow: 0.3, wrist: 0.5, adduct: 0 };
    this.anim.play(this.loco, 0);
    this.anim.look.maxYaw = 0.6;
    this.anim.lookAt(() => player.rig.bonePosition('head', _look), 0.5);
    this.anim.feet.ground = ground;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.state = 'stand'; // stand | fight | script
    this.action = null;
    this.cool = 2;
    this.stun = 0;
    this.globs = [];
    this.burns = [];
    this.waves = [];
    this.onQuip = this.onHurtHal = null;
    this.clock = 0;
    this.poise = 0; // damage taken in the current attack
    this.threat = false; // the gatling spinning, aimed at him
    this.distract = 0; // turned on Sinestro (his spikes): facing `distractYaw`
    this.exposed = 0; // thrown wide open by a parry
    this.moved = new THREE.Vector3();

    // a capsule for the ring to hit, moved with him
    const world = physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    this.col = world.createCollider(RAPIER.ColliderDesc.capsule(0.7, 0.62), this.rb);
    this.tg = { body: this.rb, collider: this.col, position: new THREE.Vector3(), radius: 0.9, health: HEALTH, maxHealth: HEALTH, alive: true, hit: (a, p, d, k) => this.hit(a, p, d, k), openState: () => this.openState() };
    physics.dynamics.push({ body: this.rb, mesh: new THREE.Object3D() }); // (the fist's and the hammer's impacts look for targets there)

    // the tells and the blood: a red line along the ground, the slam's ring, the drops and fires
    const red = new THREE.Color(2.6, 0.25, 0.12);
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: red, map: lineTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.line.renderOrder = 23;
    scene.add(this.line);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.22, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.renderOrder = 23;
    scene.add(this.ring);
    this.fx = new Particles(900, { additive: true, drag: 1.1, turbulence: 0.9 });
    scene.add(this.fx.points);
    this.dropGeo = new THREE.SphereGeometry(0.07, 10, 8).scale(1, 1, 1.8); // drawn out along its flight
    this.dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.06, 0.02) });
    this.burnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.3, 0.08), map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.32)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.handLight = new THREE.PointLight(0xff2a10, 0, 6, 2);
    scene.add(this.handLight);
  }

  get position() { return this.rig.root.position; }
  get health() { return this.tg.health / this.tg.maxHealth; }

  place(at, yaw = this.yaw) {
    this.rig.root.position.copy(at);
    this.rig.root.position.y = this.ground(at.x, at.z);
    this.yaw = yaw;
    this.rig.root.rotation.y = yaw;
    this.vel.set(0, 0, 0);
    this.syncBody(true);
  }

  engage() {
    this.state = 'fight';
    this.powers.addTarget(this.tg);
    this.cool = 1.2;
  }

  // out of the fight (the story takes him): whatever he was doing stops
  disengage() {
    this.state = 'script';
    this.endAction();
    this.vel.set(0, 0, 0);
    this.powers.removeTarget(this.tg);
  }

  // in an attack (he can't cover then), and the parts of one the gun gets through: the tell and the
  // follow-through, not the rush itself (head down behind his arms) or the slam's blow
  committed() { const a = this.action; return !!a && (COMMITTED.has(a.kind) || (a.kind === 'beam' && a.phase !== 'fetch')); }
  open() { const s = this.stance(); return s !== 'turned'; }

  // How a blow from Hal would land on him now: 'exposed' (a parry threw him open), 'reeling' (stunned
  // or rocked), 'side' (turned on Sinestro), 'open' (inside an attack, or Hal behind him), 'turned'
  // (his gauntlets up: between attacks, head down in a charge, the slam's blow, an answer).
  stance() {
    if (this.exposed > 0) return 'exposed';
    if (this.stun > 0) return 'reeling';
    if (this.distract > 0) return 'side';
    const a = this.action, hal = this.player.position;
    let s = 'open';
    if (!a || a.kind === 'cover' || a.armour) s = 'turned';
    else if (a.kind === 'beam') s = a.phase === 'fetch' ? 'turned' : 'open';
    else if (a.kind === 'charge') s = a.phase === 'skid' ? 'open' : 'turned';
    else if (a.kind === 'slam') s = a.phase === 'down' && a.t < 0.3 ? 'turned' : 'open';
    // (from behind him his arms are no use, but his answers don't stop for anything)
    if (s === 'turned' && !a?.armour && Math.sin(this.yaw) * (hal.x - this.position.x) + Math.cos(this.yaw) * (hal.z - this.position.z) < -0.15 * Math.hypot(hal.x - this.position.x, hal.z - this.position.z)) s = 'open';
    return s;
  }
  // for the target bracket: wide open, open, or neither
  openState() { const s = this.state === 'fight' ? this.stance() : 'turned'; return s === 'exposed' ? 'exposed' : s === 'turned' ? null : 'open'; }

  hit(amount, point, dir, kind = 'hit') {
    if (this.state !== 'fight' || !this.tg.alive) return 0;
    if (kind === 'spike') {
      // Sinestro's spikes barely mark him, but they turn him: he rounds on Sinestro, his side to Hal
      if (!this.committed() && this.stun <= 0 && this.distract <= 0 && dir && Math.random() < 0.55) {
        if (this.action?.kind === 'cover' || this.action?.kind === 'beam') this.endAction(0.8);
        this.distract = 1.6;
        this.distractYaw = Math.atan2(-dir.x, -dir.z);
        this.roar(0.5);
        this.onQuip?.('distract');
      }
      return this.hurt(amount * 0.35);
    }
    if (kind === 'explosion') return this.hurt(amount * 0.5); // (a car going up beside him: no guard for that)
    const how = this.stance(), blow = kind === 'hook' || kind === 'hammer' || kind === 'sword', hud = this.powers.hud;
    if (how === 'turned') {
      // it rings off his gauntlets
      this.deflect(point, blow);
      if (kind === 'gatling') { if (!this.action) this.begin('cover'); return 0; }
      if (!blow) return 0;
      amount *= LANDS.turned;
      hud.callout('Turned', 'turned');
      this.answer();
    } else {
      amount *= LANDS[how];
      if (how === 'reeling' && this.crashed > 0) amount *= 1.25; // reeling from a charge stopped dead: wide open
      if (kind === 'gatling') amount *= 0.4; // (his hide takes most of it)
      if (how === 'exposed' && blow) hud.callout('Counter', 'counter');
    }
    this.hurt(amount);
    // inside an attack, enough of it rocks him out (a beam held up comes down on him)
    if (how === 'open' && this.committed() && !this.action.armour && (this.poise += amount) >= POISE && this.clock > (this.steady ?? 0)) {
      const a = this.action, held = a.kind === 'beam' && a.beam?.state === 'held';
      this.endAction(0.8);
      this.poise = 0;
      this.stun = held ? 1.6 : 0.7;
      this.steady = this.clock + this.stun + 1.6;
      if (held) { this.hurt(20); this.audio.impact(1.3); this.director.shake(0.35, 0.4); }
      this.anim.gesture('shake', 1, 0.5);
      this.onQuip?.('rocked');
    }
    if (this.distract > 0 && (this.poise += amount * 0.5) > 25) this.distract = 0; // (back on Hal)
    return amount;
  }

  hurt(amount) {
    this.tg.health = Math.max(1, this.tg.health - amount);
    if (amount > 30) this.onQuip?.('hurt');
    this.flinch = Math.min(1, (this.flinch ?? 0) + amount / 60);
    return amount;
  }

  // a blow turned: he answers it (armoured), unless he's already coming
  answer() {
    const a = this.action;
    if ((a && a.kind !== 'cover' && !(a.kind === 'beam' && a.phase === 'fetch')) || this.clock < (this.answered ?? 0)) return;
    this.answered = this.clock + 1.4;
    this.brace();
  }

  // thrown wide open: stopped dead and rocked back, a long moment before he gathers himself
  expose(dur = EXPOSE) {
    this.endAction(0.5);
    // (a step back, away from Hal)
    const hal = this.player.position;
    this.vel.set(this.position.x - hal.x, 0, this.position.z - hal.z).setLength(3.2);
    this.exposed = Math.max(this.exposed, dur);
    this.stun = Math.max(this.stun, dur);
    this.poise = 0;
    this.flinch = 1;
    this.anim.gesture('shake', 1.4, 0.6);
    this.roar(0.7);
  }

  // bullets off his gauntlets: red sparks and a ring of metal, not too often (a blow: a dull clank)
  deflect(point, heavy = false) {
    if (!point) return;
    if (heavy && this.clock - (this.lastClank ?? -1) > 0.1) { this.lastClank = this.clock; this.audio.turned(1.3); this.anim.gesture('beat', 0.4, 0.4); }
    this.fx.emit(5, (q, v) => { q[0] = point.x; q[1] = point.y; q[2] = point.z; v[0] = (Math.random() - 0.5) * 5; v[1] = Math.random() * 3; v[2] = (Math.random() - 0.5) * 5; }, { life: 0.3, size: [0.06, 0], color: [[3, 1.2, 0.4, 1], [0.6, 0.1, 0.03, 0]] });
    if (this.clock - (this.lastPing ?? -1) > 0.09) {
      this.lastPing = this.clock;
      this.audio.tone({ type: 'triangle', freq: 1900 + Math.random() * 600, to: 1200, attack: 0.002, peak: 0.025, dur: 0.07, wet: 0.2 });
    }
  }

  // braced for the next hook (a red glow), then straight back at Hal
  brace() {
    this.endAction(0);
    this.roar(1);
    this.director.shake(0.3, 0.4);
    this.handLight.intensity = 8;
    const hal = this.player.position, d = Math.hypot(hal.x - this.position.x, hal.z - this.position.z);
    if (d < SLAM.near + 0.6) this.begin('slam', { quick: true, armour: true });
    else if (d < 18 && this.clearLine(hal)) this.begin('charge', { quick: true, armour: true });
    else this.begin('blood', { quick: true, armour: true });
    this.onQuip?.('brace');
  }

  // ---------------------------------------------------------------------------------- update
  update(dt, t) {
    if (dt <= 0) return;
    const root = this.rig.root, P = this.player;
    this.clock += dt;
    this.distract = Math.max(0, this.distract - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.exposed = Math.max(0, this.exposed - dt);
    this.crashed = Math.max(0, (this.crashed ?? 0) - dt);
    this.flinch = Math.max(0, (this.flinch ?? 0) - dt * 2.5);
    if (this.state === 'fight') this.think(dt);
    // moving: walking to Hal, or the rush; inside the site, round its columns
    const p = root.position;
    this.moved.copy(p);
    p.addScaledVector(this.vel, dt);
    _a.set(p.x - this.center.x, 0, p.z - this.center.z);
    if (_a.length() > this.radius) { _a.setLength(this.radius); p.x = this.center.x + _a.x; p.z = this.center.z + _a.z; }
    for (const b of this.blocks) {
      if (b.body) { const t = b.body.translation(); b.x = t.x; b.z = t.z; } // (a car, a container: wherever it's been knocked to)
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), r = b.r + 0.75;
      if (d < r) { p.x = b.x + (dx / (d || 1)) * r; p.z = b.z + (dz / (d || 1)) * r; }
    }
    p.y = damp(p.y, this.ground(p.x, p.z), 12, dt);
    // how far he really went (held up against something, his legs stop: no walking on the spot)
    const went = Math.hypot(p.x - this.moved.x, p.z - this.moved.z) / dt;
    // facing: Hal in the fight (or Sinestro, turned on him), unless a rush has locked his line; out of
    // it, the way he walks
    const hs0 = Math.hypot(this.vel.x, this.vel.z);
    const fight = this.state === 'fight' ? (this.distract > 0 ? this.distractYaw : Math.atan2(P.position.x - p.x, P.position.z - p.z)) : null;
    const want = this.action?.lock ?? fight ?? (hs0 > 0.2 ? Math.atan2(this.vel.x, this.vel.z) : this.faceYaw ?? this.yaw);
    const turn = this.action?.kind === 'charge' && this.action.phase === 'rush' ? 0 : 3.2;
    this.yaw = wrap(this.yaw + clamp(wrap(want - this.yaw), -turn * dt, turn * dt));
    root.rotation.y = this.yaw;
    this.syncBody();
    this.tg.position.copy(p).y += CHEST - 0.1;
    // the body: the gait from his speed; leaning into a rush, rocked back by a stun or a big hit
    const hs = Math.min(went, Math.hypot(this.vel.x, this.vel.z) + 0.2);
    this.loco.speed = damp(this.loco.speed, hs, 8, dt);
    this.loco.direction = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw) < -0.3 ? -1 : 1; // (stepping back)
    const lean = this.anim.lean;
    const pitch = (this.action?.lean ?? 0) + hs * 0.018 - this.stun * 0.12 - this.flinch * 0.18 - Math.min(1, this.exposed * 1.5) * 0.25;
    lean.pitch = damp(lean.pitch, clamp(pitch, -0.55, 0.55), 6, dt);
    // thrown open: his arms flung wide, head back, until he gathers himself
    if (this.exposed > 0 || this.reeled) {
      this.reeled = this.exposed > 0;
      if (!this.action) this.anim.armSpread = 0.6 * Math.min(1, this.exposed * 2);
    }
    this.updateBeamHeld(dt);
    this.updateGlobs(dt, t);
    this.updateBurns(dt, t);
    this.updateWaves(dt);
    this.fx.update(dt, t, this.engine.camera, this.engine.renderer);
    this.anim.update(dt);
    this.handLight.intensity = damp(this.handLight.intensity, this.action?.glow ?? 0, 8, dt);
    if (this.handLight.intensity > 0.01) this.rig.bonePosition('hand_R', this.handLight.position);
  }

  syncBody(teleport = false) {
    const p = this.rig.root.position, at = { x: p.x, y: p.y + 1.3, z: p.z };
    if (teleport) this.rb.setTranslation(at, true);
    else this.rb.setNextKinematicTranslation(at);
  }

  // A point in his body frame (metres, +Z ahead), in the world.
  local(x, y, z, out) {
    return out.set(x, y, z).applyAxisAngle(_up, this.yaw).add(this.rig.root.position);
  }

  think(dt) {
    const P = this.player, me = this.position, hal = P.position, R = this.powers;
    const d = Math.hypot(hal.x - me.x, hal.z - me.z), up = hal.y - this.ground(hal.x, hal.z);
    // the barrels spinning up at him: he covers, now (unless he's in the middle of something)
    const gat = R.gatling, threat = (this.threat = !!(gat && !gat.ending && gat.firing && gat.spin > 0.25 && R.aim.target === this.tg));
    if (threat && !this.committed() && this.stun <= 0 && this.distract <= 0 && this.action?.kind !== 'cover') this.begin('cover'); // (not over his own answer)
    // Hal behind his shield a while: he won't run into it, he walks in under it and slams
    this.shielded = R.shield && !R.shield.ending ? (this.shielded ?? 0) + dt : 0;
    const turtle = this.shielded > 1.2;
    if (this.action) { this.runAction(dt, d); return; }
    if (this.stun > 0 || this.distract > 0) { this.vel.multiplyScalar(Math.max(0, 1 - dt * (this.exposed > 0 ? 3 : 6))); return; }
    this.poise = 0;
    // walking in on him, round what's in the way
    _a.set(hal.x - me.x, 0, hal.z - me.z).normalize();
    const pace = d > 6 || (turtle && d > SLAM.near - 0.8) ? WALK : d > 3.2 ? WALK * 0.5 : 0;
    this.vel.lerp(this.avoid(_a.multiplyScalar(pace)), Math.min(1, dt * 3));
    this.cool -= dt;
    // Hal busy at his lantern (recharging): he doesn't wait
    if (!P.control && this.cool > 0.3) this.cool = 0.3;
    if (this.cool > 0) return;
    const r = Math.random(), line = up < 1.2 && this.clearLine(hal);
    if (d < SLAM.near && up < 2) this.begin('slam');
    else if (turtle && up < 2) this.cool = 0.2;
    else if (!P.control && d > 4 && d < 22 && line) this.begin('charge');
    else if (d > 6 && d < 18 && line && r < 0.45) this.begin('charge');
    else if (r < 0.75 && this.nearestBeam()) this.begin('beam');
    else this.begin('blood');
  }

  // A wanted velocity turned aside round the blocks ahead of him (columns, the machine, the crane).
  avoid(v) {
    const p = this.position, sp = Math.hypot(v.x, v.z);
    if (sp < 0.05) return v;
    const fx = v.x / sp, fz = v.z / sp;
    let sx = 0;
    for (const b of this.blocks) {
      const dx = b.x - p.x, dz = b.z - p.z, ahead = dx * fx + dz * fz;
      if (ahead < -0.5 || ahead > 5) continue;
      const lat = dz * fx - dx * fz, need = b.r + 1.1; // (+: the block is on his right)
      if (Math.abs(lat) > need) continue;
      sx += (lat >= 0 ? -1 : 1) * (1 - Math.abs(lat) / need) * (1 - Math.max(0, ahead) / 6) * 1.8;
    }
    if (!sx) return v;
    v.set(fx - fz * sx, 0, fz + fx * sx).setLength(sp); // ((-fz, fx) is his right: sx > 0 steers right)
    return v;
  }

  begin(kind, opts = {}) {
    if (this.action) this.endAction(0);
    const a = (this.action = { kind, phase: 'wind', t: 0, lean: 0, glow: 0, ...opts });
    const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); }; // (each target its own vector)
    this.poise = 0;
    if (kind === 'cover') {
      // his forearms up and crossed before his face, head down behind them
      this.anim.reach('R', R(0.16, 1.98, 0.5), { pole: V(-1, -0.6, -0.2), rate: 14 });
      this.anim.reach('L', R(-0.14, 1.84, 0.55), { pole: V(1, -0.6, -0.2), rate: 14 });
      a.lean = 0.16;
      a.held = 0;
      if (this.clock - (this.lastCoverQuip ?? -30) > 25) { this.lastCoverQuip = this.clock; this.onQuip?.('cover'); }
    } else if (kind === 'charge') {
      a.lock = this.yaw;
      this.vel.set(0, 0, 0);
      this.anim.armSpread = 0.45;
      this.roar(0.9);
      this.onQuip?.('charge');
    } else if (kind === 'beam') {
      a.beam = this.nearestBeam();
      a.beam.claimed = true;
      a.phase = 'fetch';
    } else if (kind === 'blood') {
      this.vel.set(0, 0, 0);
      this.anim.reach('R', R(-0.3, 1.85, 0.42), { pole: V(-1, -0.4, -0.3), rate: 6 });
      this.anim.reach('L', R(0.05, 1.7, 0.5), { pole: V(1, -0.4, -0.3), rate: 6 });
      a.glow = 4;
      this.audio.tone({ type: 'sawtooth', freq: 120, to: 70, attack: 0.3, peak: 0.06, dur: 0.8, wet: 0.5 });
      this.audio.burst({ type: 'bandpass', from: 2400, to: 600, q: 1.2, attack: 0.25, peak: 0.12, dur: 0.6, wet: 0.3 });
    } else if (kind === 'slam') {
      this.vel.set(0, 0, 0);
      this.anim.reach('R', R(-0.32, 2.55, 0.18), { pole: V(-1, -0.2, -0.4), rate: 7 });
      this.anim.reach('L', R(0.32, 2.55, 0.18), { pole: V(1, -0.2, -0.4), rate: 7 });
      a.lean = -0.12;
      this.roar(0.6);
    }
  }

  endAction(cool = 1.4) {
    const a = this.action;
    this.action = null;
    this.cool = cool;
    this.anim.armSpread = 0;
    this.anim.reach('R', null, { rate: 4 });
    this.anim.reach('L', null, { rate: 4 });
    this.line.material.opacity = 0;
    if (a?.beam && a.beam.state === 'held') this.dropBeam(a.beam);
    if (a?.beam) a.beam.claimed = false;
  }

  runAction(dt, d) {
    const a = this.action, P = this.player, me = this.position;
    a.t += dt;
    if (a.kind === 'cover') {
      // on toward Hal behind his arms; held on him long enough, it's answered
      _b.set(P.position.x - me.x, 0, P.position.z - me.z);
      this.vel.lerp(this.avoid(d > 3.4 ? _b.setLength(PRESS) : _b.set(0, 0, 0)), Math.min(1, dt * 4));
      // (how long the gun has been held on his guard, and since it stopped)
      if (this.threat) { a.fire = (a.fire ?? 0) + dt; a.held = 0; } else a.held += dt;
      const up = P.position.y - this.ground(P.position.x, P.position.z);
      if (a.fire > 1.0 || (a.fire > 0.3 && d < SLAM.near + 0.5)) {
        this.onQuip?.('answer');
        if (d < SLAM.near + 0.5 && up < 2) this.begin('slam', { quick: true, armour: true });
        else if (d > 4 && d < 18 && up < 1.2 && this.clearLine(P.position)) this.begin('charge', { quick: true, armour: true });
        else this.begin('blood', { quick: true, armour: true });
      } else if (a.held > 0.45) this.endAction(0.4 + Math.random() * 0.4);
      return;
    }
    if (a.kind === 'charge') {
      // (his line follows Hal for the start of the tell, then sets)
      if (a.phase === 'wind' && !a.quick && a.t < CHARGE.track) {
        const lead = Math.min(0.5, d / CHARGE.speed);
        _b.set(P.position.x + Math.sin(P.heading) * P.speed * lead - me.x, 0, P.position.z + Math.cos(P.heading) * P.speed * lead - me.z);
        a.lock = wrap(a.lock + clamp(wrap(Math.atan2(_b.x, _b.z) - a.lock), -2.5 * dt, 2.5 * dt));
      }
      const dir = _a.set(Math.sin(a.lock), 0, Math.cos(a.lock));
      if (a.phase === 'wind') {
        // head down, the line runs out along the ground ahead of him
        a.lean = 0.38 * Math.min(1, a.t / 0.4);
        const k = Math.min(1, a.t / 0.5);
        this.line.position.copy(me).addScaledVector(dir, 0.8).y += 0.04;
        this.line.rotation.y = a.lock;
        this.line.scale.set(1.3, 1, CHARGE.speed * CHARGE.time * k);
        this.line.material.opacity = 0.75 * (0.6 + 0.4 * Math.sin(a.t * 22));
        if (a.t > (a.quick ? CHARGE.quick : CHARGE.wind)) { a.phase = 'rush'; a.t = 0; this.audio.whoosh(0.8, 0.9); this.audio.rumble(1.0, 0.4); }
      } else if (a.phase === 'rush') {
        this.line.material.opacity = Math.max(0, this.line.material.opacity - dt * 3);
        this.vel.copy(dir).multiplyScalar(CHARGE.speed);
        a.lean = 0.45;
        if (Math.random() < dt * 14) this.powers.dustFx(me, 2, 1.2);
        // anything solid ahead: a wall or the shield stops him dead
        const from = _b.set(me.x, me.y + 1.2, me.z), step = CHARGE.speed * dt + 0.9;
        const hit = this.physics.world.castRay(new RAPIER.Ray(from, dir), step, true, undefined, undefined, this.col, undefined, (c) => c.handle !== P.collider?.handle && !this.powers.bounds?.has(c.handle));
        // a fence panel, a lamp post, anything that breaks: he goes through it
        const prop = hit && this.physics.smash?.ofCollider(hit.collider);
        if (prop && prop.kind === 'breaks') { this.physics.smash.blow(prop, 40, from.clone().addScaledVector(dir, hit.timeOfImpact), dir, 'crash'); return; }
        const sh = this.powers.shield;
        const blocked = hit && (hit.collider.parent()?.isKinematic() || hit.collider.parent()?.isFixed()) && hit.timeOfImpact < step;
        if (blocked || (sh && sh.blocks?.(from) && P.position.distanceTo(me) < CHARGE.reach + 0.4)) {
          const at = from.clone().addScaledVector(dir, hit ? hit.timeOfImpact : 0.8);
          let what = sh && (hit?.collider === sh.col || !hit) ? 'shield' : this.powers.walls?.some((w) => w.col === hit?.collider || w.collider === hit?.collider) ? 'wall' : 'solid';
          if (what === 'shield') what = this.powers.guardHit(from, at) ?? 'block'; // (raised just as he hits: a parry)
          this.crash(what, at, dir);
          return;
        }
        // through Hal
        if (!a.struck && P.position.distanceTo(me) < CHARGE.reach && P.position.y - me.y < 1.6) {
          a.struck = true;
          const dealt = this.powers.damage(CHARGE.damage * (a.armour ? 1.3 : 1), _c.set(me.x, me.y + 1.2, me.z));
          if (dealt > 0) { P.dash(_d.copy(dir).addScaledVector(_up, 0.15).normalize(), 10, 0.28); this.onHurtHal?.('charge'); this.director.shake(0.5, 0.4); this.audio.impact(1.4); }
        }
        if (a.t > CHARGE.time) { a.phase = 'skid'; a.t = 0; }
      } else if (a.phase === 'skid') {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
        a.lean = 0.2;
        if (a.t > 0.6) this.endAction(1.0 + Math.random() * 0.8);
      }
    } else if (a.kind === 'beam') {
      const b = a.beam;
      if (a.phase === 'fetch') {
        // to the nearest point along the beam (not its middle: he'd walk into its end and shove it)
        const near = this.alongBeam(b, _c);
        _a.set(near.x - me.x, 0, near.z - me.z);
        const far = _a.length();
        a.lock = Math.atan2(_a.x, _a.z);
        // (to arm's length and no closer: he's kinematic, and walking into it shoves it away)
        if (far > BEAM.reach) this.vel.lerp(this.avoid(_a.normalize().multiplyScalar(WALK * 1.3)), Math.min(1, dt * 4));
        else { this.vel.set(0, 0, 0); a.phase = 'lift'; a.t = 0; this.grabBeam(b); return; }
        // can't get to it: leave it a while
        if (a.t > 3.5 || b.state !== 'loose') { b.skipUntil = this.clock + 8; this.endAction(0.4); }
      } else if (a.phase === 'lift') {
        a.lock = undefined;
        b.lift = Math.min(1, a.t / 0.7);
        if (a.t > 0.7) { a.phase = 'hold'; a.t = 0; this.roar(0.5); }
      } else if (a.phase === 'hold') {
        // overhead, shaking with the weight: the tell
        if (a.t > 0.75) { this.throwBeam(b); a.phase = 'after'; a.t = 0; }
      } else if (a.phase === 'after') {
        if (a.t > 0.5) this.endAction(0.8 + Math.random() * 0.8);
      }
    } else if (a.kind === 'blood') {
      if (a.phase === 'wind') {
        // his palm opened, the blood drawn and lit
        if (Math.random() < dt * 30) {
          this.rig.bonePosition('hand_R', _c);
          this.fx.emit(1, (q, v) => { q[0] = _c.x; q[1] = _c.y; q[2] = _c.z; v[0] = (Math.random() - 0.5) * 0.4; v[1] = -0.5 - Math.random(); v[2] = (Math.random() - 0.5) * 0.4; }, { life: 0.6, size: [0.07, 0.02], color: [[3, 0.4, 0.15, 1], [0.6, 0.05, 0.02, 0]] });
        }
        if (a.t > (a.quick ? 0.4 : 0.75)) {
          a.phase = 'fling'; a.t = 0;
          const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
          this.anim.reach('R', R(-0.1, 1.75, 0.75), { pole: V(-1, -0.3, 0), rate: 16 });
          this.anim.reach('L', null, { rate: 5 });
          this.audio.whoosh(0.45, 0.7);
        }
      } else if (a.phase === 'fling') {
        a.glow = 6;
        if (!a.thrown && a.t > 0.12) { a.thrown = true; this.fling(); }
        if (a.t > 0.6) this.endAction(1.0 + Math.random() * 0.7);
      }
    } else if (a.kind === 'slam') {
      if (a.phase === 'wind' && a.t > (a.quick ? SLAM.quick : SLAM.wind)) {
        a.phase = 'down'; a.t = 0;
        const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
        this.anim.reach('R', R(-0.28, 0.55, 0.8), { pole: V(-1, 0.3, -0.3), rate: 22 });
        this.anim.reach('L', R(0.28, 0.55, 0.8), { pole: V(1, 0.3, -0.3), rate: 22 });
        a.lean = 0.55;
      } else if (a.phase === 'down' && a.t > 0.16 && !a.landed) {
        a.landed = true;
        const at = this.local(0, 0, 0.9, new THREE.Vector3());
        at.y = this.ground(at.x, at.z);
        this.waves.push({ at, r: 0.5, hit: false });
        this.audio.explosion(0.5);
        this.audio.rumble(0.9, 0.6);
        this.director.shake(0.55, 0.5);
        this.powers.dustFx(at, 36, 4);
        this.physics.burst(at, 7, 7, 3, 0.6);
      } else if (a.phase === 'down' && a.t > 0.8) this.endAction(1.2 + Math.random() * 0.6);
    }
  }

  // Stopped dead by something: a wall, and he reels, open; the shield held, it holds but Hal is
  // shoved back and Atrocitus only staggers; the shield raised as he hits (a parry), he's wide open.
  crash(what, at, dir) {
    this.vel.set(0, 0, 0);
    this.endAction(0.5);
    this.director.shake(what === 'block' ? 0.4 : 0.6, 0.5);
    this.audio.impact(what === 'block' ? 1.1 : 1.6);
    this.powers.sparks.emit(50, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = (Math.random() - 0.5) * 6; }, { life: 0.6, size: [0.08, 0], color: [[1.5, 5, 2, 1], [0.2, 1.2, 0.4, 0]] });
    if (what === 'parry') { this.expose(); this.onQuip?.('stunned'); return; }
    if (what === 'block') {
      this.stun = 0.7;
      this.player.dash(_d.copy(dir).setY(0).normalize(), 7, 0.22);
      this.anim.gesture('shake', 0.8, 0.4);
      return;
    }
    this.stun = this.crashed = what === 'solid' ? 1.2 : CHARGE.stun;
    this.anim.gesture('shake', 1.2, 0.5);
    this.onQuip?.(what === 'solid' ? 'solid' : 'stunned');
  }

  clearLine(to) {
    _a.set(to.x - this.position.x, 0, to.z - this.position.z);
    const d = _a.length();
    _b.copy(this.position).y += 1.2;
    const hit = this.physics.world.castRay(new RAPIER.Ray(_b, _a.divideScalar(d)), d, true, undefined, undefined, this.col, undefined, (c) => c.handle !== this.player.collider?.handle && !this.powers.bounds?.has(c.handle) && !c.parent()?.isDynamic());
    return !hit;
  }

  roar(peak = 0.8) {
    this.audio.tone({ type: 'sawtooth', freq: 82, to: 48, attack: 0.08, peak: 0.1 * peak, dur: 0.95, wet: 0.35 });
    this.audio.tone({ type: 'square', freq: 61, to: 40, attack: 0.1, peak: 0.05 * peak, dur: 0.9, wet: 0.35, detune: 18 });
    this.audio.burst({ buffer: this.audio.brownBuf, type: 'lowpass', from: 700, to: 160, attack: 0.06, peak: 0.45 * peak, dur: 0.9, wet: 0.3 });
  }

  // ---------------------------------------------------------------------------------- the beams
  nearestBeam() {
    let best = null, bd = BEAM.pick;
    for (const b of this.loose) {
      if (b.state !== 'loose' || b.claimed || (b.skipUntil ?? 0) > this.clock) continue;
      // (one lying against a column or the machine he can't reach)
      if (this.blocks.some((k) => Math.hypot(b.mesh.position.x - k.x, b.mesh.position.z - k.z) < k.r + 1.0)) continue;
      const v = b.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > 1) continue;
      const d = b.mesh.position.distanceTo(this.position);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // the point along a beam's length nearest him (its axis, at ground level)
  alongBeam(b, out) {
    _d.set(0, 0, 1).applyQuaternion(b.mesh.quaternion).setY(0).normalize();
    const bp = b.mesh.position, s = clamp((this.position.x - bp.x) * _d.x + (this.position.z - bp.z) * _d.z, -b.half.z * 0.8, b.half.z * 0.8);
    return out.set(bp.x + _d.x * s, 0, bp.z + _d.z * s);
  }

  grabBeam(b) {
    b.state = 'held';
    b.lift = 0;
    b.from = b.mesh.position.clone();
    b.fromQ = b.mesh.quaternion.clone();
    b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.audio.burst({ type: 'bandpass', from: 500, to: 260, q: 4, peak: 0.3, dur: 0.4, wet: 0.3 });
    const R = (x, y, z) => { const o = new THREE.Vector3(); return () => this.local(x, y, z, o); };
    this.anim.reach('R', R(-0.36, 2.5, 0.2), { pole: V(-1, -0.2, -0.4), rate: 5 });
    this.anim.reach('L', R(0.36, 2.5, 0.2), { pole: V(1, -0.2, -0.4), rate: 5 });
  }

  // held across his shoulders, over his head: its middle between his hands
  updateBeamHeld(dt) {
    const b = this.action?.beam;
    if (!b || b.state !== 'held') return;
    const k = 1 - (1 - b.lift) ** 3, shake = this.action.phase === 'hold' ? 1 : 0;
    this.local(0, 2.62, 0.15, _c);
    _c.x += Math.sin(this.engine.time * 37) * 0.02 * shake; _c.y += Math.sin(this.engine.time * 29) * 0.025 * shake;
    _q.setFromAxisAngle(_up, this.yaw + Math.PI / 2);
    b.mesh.position.lerpVectors(b.from, _c, k);
    b.mesh.quaternion.slerpQuaternions(b.fromQ, _q, k);
    b.body.setNextKinematicTranslation(b.mesh.position);
    b.body.setNextKinematicRotation(b.mesh.quaternion);
    void dt;
  }

  throwBeam(b) {
    const P = this.player, p = b.mesh.position;
    const target = P.rig.bonePosition('chest', new THREE.Vector3());
    const T = clamp(p.distanceTo(target) / BEAM.speed, 0.3, 1.6);
    if (P.flying) target.addScaledVector(P.vel, T * 0.8);
    else target.add(_a.set(Math.sin(P.heading) * P.speed, 0, Math.cos(P.heading) * P.speed).multiplyScalar(T * 0.8));
    const v = target.sub(p).divideScalar(T);
    v.y += 0.5 * 9.81 * T;
    b.state = 'thrown';
    b.t = 0;
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.body.setAngvel({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 2 }, true);
    this.anim.reach('R', null, { rate: 8 });
    this.anim.reach('L', null, { rate: 8 });
    this.audio.whoosh(0.6, 0.9);
    this.watchBeam(b);
  }

  dropBeam(b) {
    b.state = 'loose';
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  }

  // A thrown beam hurts what it hits at speed, then lies where it fell, to be thrown again. Met by
  // Hal's shield it's stopped; met by a parry it goes back at him.
  watchBeam(b) {
    const P = this.player;
    b.back = false;
    b.update = (dt) => {
      b.t += dt;
      const lv = b.body.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z), sh = this.powers.shield;
      _a.set(0, 0, 1).applyQuaternion(b.mesh.quaternion);
      if (b.back && !b.struck) {
        // back into him
        _b.subVectors(this.tg.position, b.mesh.position);
        _d.copy(b.mesh.position).addScaledVector(_a, clamp(_b.dot(_a), -b.half.z, b.half.z));
        if (_d.distanceTo(this.tg.position) < 1.3) { b.struck = true; this.backAtHim(_d, 30, 1.5); }
      } else if (sp > 5 && !b.struck && sh && !sh.ending) {
        _b.subVectors(sh.center, b.mesh.position);
        _d.copy(b.mesh.position).addScaledVector(_a, clamp(_b.dot(_a), -b.half.z, b.half.z));
        if (_d.distanceTo(sh.center) < 1.15) {
          const g = this.powers.guardHit(_c.copy(_d).addScaledVector(_b.normalize(), -0.6), _d);
          if (g) b.struck = true;
          if (g === 'parry') this.batBack(b);
        }
      }
      if (sp > 5 && !b.struck && !b.back) {
        const chest = P.rig.bonePosition('chest', _c);
        // nearest point of the beam's axis to his chest
        _a.set(0, 0, 1).applyQuaternion(b.mesh.quaternion);
        _b.subVectors(chest, b.mesh.position);
        const s = clamp(_b.dot(_a), -b.half.z, b.half.z);
        _d.copy(b.mesh.position).addScaledVector(_a, s);
        if (_d.distanceTo(chest) < 0.75) {
          b.struck = true;
          const dealt = this.powers.damage(BEAM.damage, _d.clone());
          if (dealt > 0) { this.onHurtHal?.('beam'); this.audio.impact(1.2); }
          else this.audio.clash?.();
        }
      }
      if (b.t > 0.5 && sp < 2) { b.state = 'loose'; b.struck = false; b.back = false; b.update = null; }
    };
  }

  // a parried beam flung back at his chest
  batBack(b) {
    const p = b.mesh.position, target = this.tg.position, T = clamp(p.distanceTo(target) / 16, 0.25, 0.8);
    const v = _c.subVectors(target, p).divideScalar(T);
    v.y += 0.5 * 9.81 * T;
    b.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.back = true;
    b.struck = false;
    b.t = 0;
  }

  // his own beam or blood back in his face: it hurts, and it throws him open
  backAtHim(at, damage, dur) {
    if (this.state !== 'fight') return;
    this.powers.dealDamage({ alive: true, hit: (a) => this.hurt(a) }, damage, at.clone());
    this.audio.impact(1.2);
    this.director.shake(0.3, 0.3);
    if (this.exposed <= 0) { this.expose(dur); this.onQuip?.('stunned'); }
  }

  // ---------------------------------------------------------------------------------- the blood
  fling() {
    const P = this.player, hand = this.rig.bonePosition('hand_R', new THREE.Vector3());
    const aim = P.rig.bonePosition('chest', new THREE.Vector3());
    const T = hand.distanceTo(aim) / BLOOD.speed;
    if (P.flying) aim.addScaledVector(P.vel, T * 0.7);
    const base = _a.subVectors(aim, hand).normalize();
    for (let i = 0; i < BLOOD.count; i++) {
      const spread = ((i / (BLOOD.count - 1)) - 0.5) * 0.7 + (Math.random() - 0.5) * 0.06;
      const dir = base.clone().applyAxisAngle(_up, spread);
      dir.y += 0.08 + Math.random() * 0.06;
      const m = new THREE.Mesh(this.dropGeo, this.dropMat);
      m.position.copy(hand);
      this.scene.add(m);
      this.globs.push({ mesh: m, pos: m.position, prev: hand.clone(), vel: dir.normalize().multiplyScalar(BLOOD.speed * (0.92 + Math.random() * 0.16)), life: 0 });
    }
    this.audio.burst({ type: 'bandpass', from: 1500, to: 400, q: 1.5, peak: 0.25, dur: 0.35, wet: 0.3 });
  }

  updateGlobs(dt) {
    const P = this.powers, world = this.physics.world, player = this.player;
    this.globs = this.globs.filter((g) => {
      g.life += dt;
      g.prev.copy(g.pos);
      if (g.back) g.vel.lerp(_c.subVectors(this.tg.position, g.pos).setLength(BLOOD.speed), Math.min(1, dt * 8));
      else g.vel.y -= 7 * dt;
      g.pos.addScaledVector(g.vel, dt);
      g.mesh.lookAt(_c.copy(g.pos).add(g.vel));
      if (Math.random() < 0.7) this.fx.emit(1, (q, v) => { q[0] = g.pos.x; q[1] = g.pos.y; q[2] = g.pos.z; v[0] = 0; v[1] = 0.3; v[2] = 0; }, { life: 0.35, size: [0.1, 0.02], color: [[1.6, 0.22, 0.06, 0.8], [0.4, 0.04, 0.02, 0]] });
      _a.subVectors(g.pos, g.prev);
      const len = _a.length();
      let done = g.life > 3;
      if (g.back) {
        if (g.pos.distanceTo(this.tg.position) < 0.9) { this.backAtHim(g.pos, BLOOD.damage, 1.2); done = true; }
        else if (g.life > 1.5) done = true;
      } else if (!done && len > 1e-5) {
        const hit = world.castRay(new RAPIER.Ray(g.prev, _a.divideScalar(len)), len, true, undefined, undefined, this.col, undefined, (c) => !P.bounds?.has(c.handle));
        const gy = this.ground(g.pos.x, g.pos.z);
        if (hit || g.pos.y <= gy + 0.02) {
          const at = hit ? g.prev.clone().addScaledVector(_a, hit.timeOfImpact) : g.pos.clone().setY(gy);
          const h = hit?.collider.handle;
          const prop = hit && this.physics.smash?.ofCollider(hit.collider); // (burning blood on a car's paint)
          if (prop) this.physics.smash.blow(prop, 4, at, _c.copy(g.vel).normalize(), 'blood');
          if (P.shield && h === P.shield.col.handle) {
            if (P.guardHit(g.prev, at) === 'parry' && this.state === 'fight') { g.back = true; g.life = 0; g.pos.copy(at); g.vel.negate(); return true; }
            if (!P.shield.blocks(g.prev)) P.shield.ripple(at);
          }
          else if (h !== undefined && h === player.collider?.handle) { if (P.damage(BLOOD.damage, g.prev) > 0) this.onHurtHal?.('blood'); }
          else if (at.y < this.ground(at.x, at.z) + 0.4) this.ignite(at.setY(this.ground(at.x, at.z)));
          this.fx.emit(10, (q, v) => { q[0] = at.x; q[1] = at.y + 0.05; q[2] = at.z; v[0] = (Math.random() - 0.5) * 3; v[1] = Math.random() * 2.5; v[2] = (Math.random() - 0.5) * 3; }, { life: 0.45, size: [0.08, 0], color: [[3, 0.5, 0.15, 1], [0.4, 0.04, 0.02, 0]] });
          done = true;
        }
      }
      if (done) { g.mesh.removeFromParent(); return false; }
      return true;
    });
  }

  // where a drop lands, the ground burns for a few seconds (a hazard for Hal)
  ignite(at) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), this.burnMat.clone());
    m.position.copy(at).y += 0.04;
    m.renderOrder = 22;
    this.scene.add(m);
    const burn = { at, mesh: m, t: 0 };
    burn.hazard = { position: at, radius: 0.85, dps: BLOOD.dps, height: 1.2, active: () => burn.t < BLOOD.burn };
    this.powers.hazards.push(burn.hazard);
    this.burns.push(burn);
  }

  updateBurns(dt) {
    this.burns = this.burns.filter((b) => {
      b.t += dt;
      const k = b.t / BLOOD.burn, fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : Math.min(1, b.t * 4);
      b.mesh.material.opacity = Math.max(0, fade) * (0.75 + 0.25 * Math.sin(b.t * 13 + b.at.x));
      if (Math.random() < dt * 22 * fade) this.fx.emit(1, (q, v) => { q[0] = b.at.x + (Math.random() - 0.5) * 1.2; q[1] = b.at.y + 0.05; q[2] = b.at.z + (Math.random() - 0.5) * 1.2; v[0] = 0; v[1] = 0.9 + Math.random() * 1.1; v[2] = 0; }, { life: 0.7, size: [0.22, 0.04], color: [[2.6, 0.55, 0.12, 0.9], [0.5, 0.06, 0.02, 0]] });
      if (k >= 1) {
        b.mesh.removeFromParent();
        b.mesh.material.dispose();
        this.powers.hazards = this.powers.hazards.filter((h) => h !== b.hazard);
        return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------------- the slam
  updateWaves(dt) {
    const P = this.player;
    for (const w of this.waves) {
      w.r += SLAM.speed * dt;
      const d = Math.hypot(P.position.x - w.at.x, P.position.z - w.at.z), up = P.position.y - this.ground(P.position.x, P.position.z);
      if (!w.hit && w.r >= d && d < SLAM.reach) {
        w.hit = true;
        if (up < 1.4) {
          const dealt = this.powers.damage(SLAM.damage * (1 - (d / SLAM.reach) * 0.4), null);
          if (dealt > 0) { this.onHurtHal?.('slam'); P.dash(_a.set(P.position.x - w.at.x, 0, P.position.z - w.at.z).normalize(), 6, 0.2); }
        }
      }
    }
    this.waves = this.waves.filter((w) => w.r < SLAM.reach + 2);
    const w = this.waves[0];
    this.ring.material.opacity = w ? 0.85 * (1 - w.r / (SLAM.reach + 2)) : 0;
    if (w) { this.ring.position.copy(w.at).y += 0.06; this.ring.scale.set(w.r, 1, w.r); }
    if (w && Math.random() < 0.8) {
      const a = Math.random() * Math.PI * 2;
      this.powers.dustFx(_a.set(w.at.x + Math.cos(a) * w.r, w.at.y, w.at.z + Math.sin(a) * w.r), 1, 1.2);
    }
  }

  dispose() {
    this.endAction();
    for (const g of this.globs) g.mesh.removeFromParent();
    for (const b of this.burns) b.mesh.removeFromParent();
    this.powers.hazards = this.powers.hazards.filter((h) => !this.burns.some((b) => b.hazard === h));
    for (const o of [this.rig.root, this.line, this.ring, this.fx.points, this.handLight]) o.removeFromParent();
    this.powers.removeTarget(this.tg);
    this.physics.dynamics = this.physics.dynamics.filter((d) => d.body !== this.rb);
    if (!this.physics.freed) this.physics.world.removeRigidBody(this.rb);
  }
}

// the charge's line: bright down the middle, soft at the edges, fading out at its far end
function lineTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(0.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 0, 256);
  along.addColorStop(0, 'rgba(0,0,0,0)'); along.addColorStop(0.15, 'rgba(0,0,0,1)'); along.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = along; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _look = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
