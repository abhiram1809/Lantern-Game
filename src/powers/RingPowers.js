import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { damp, clamp } from '../engine/Time.js';
import { Particles } from '../fx/Particles.js';
import { CONSTRUCTS, constructInfo, constructMesh, ghostMesh, fistGeometry, shieldGeometry, wallGeometry, gatlingGeometry, swordGeometry, Blade, WALL, createBeam, surfaceSamples } from './Constructs.js';
import { glowTexture } from '../fx/Textures.js';
import { LINES } from '../story/lines.js';

const WATER = -0.03;
const KEY4 = ['Digit4', 'Numpad4'];
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const FACE = new THREE.Vector3(0, 0, 1);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const KEYS = {
  fist: '<b>Click</b> strike &nbsp; <b>Scroll</b> range &nbsp; <b>Q</b> holster',
  shield: '<b>Hold click</b> raise &nbsp; <b>Q</b> holster',
  wall: '<b>Click</b> place &nbsp; <b>Scroll</b> range &nbsp; <b>Q</b> holster',
  gatling: '<b>Hold click</b> fire &nbsp; <b>Q</b> holster',
  sword: '<b>Click</b> cut (in rhythm: combo) &nbsp; <b>Q</b> holster',
};

// The power ring: charge, the bearer's health, the construct wheel (game time stops while it's
// open), aiming with a hologram preview of the construct, the constructs themselves (physical: they
// shove debris, block it, and the player collides with walls), and the effects of flight.
export class RingPowers {
  constructor({ engine, input, audio, voice, hud, player, director }) {
    Object.assign(this, { engine, input, audio, voice, hud, player, director });
    this.charge = 100;
    this.health = this.maxHealth = 100;
    this.unlocked = new Set();
    this.enabled = { hud: false, constructs: false, flight: false };
    this.suited = false;
    this.selected = null;
    this.wheelState = null;
    this.shield = null;
    this.live = [];
    this.walls = [];
    this.hazards = [];
    this.stats = { strikes: 0, walls: 0, blocks: 0 };
    this.cooldown = 0;
    this.hitStop = 0;
    this.hurtFx = 0;
    this.lastHurt = 99;
    this.armTimer = 0;
    this.reach = null; // range cap set with the scroll wheel
    this.ring = null; // the ring object on Hal's finger
    this.markerTarget = null; // { pos, label }
    this.targets = new Set(); // things constructs can damage: { body, collider, position, radius, health, maxHealth, alive, hit() }
    this.regen = 0; // %/s, near a power source (Oa's Central Battery)
    this.freeze = false; // another ring interface (the star chart) has stopped time
    this.gatling = null;
    this.onImpact = this.onSelect = this.onDeath = null;
    this.geo = { fist: fistGeometry(), shield: shieldGeometry(), wall: wallGeometry() };
    this.samples = Object.fromEntries(Object.entries(this.geo).map(([k, g]) => [k, surfaceSamples(g, 240)]));
    this.geo.gatling = gatlingGeometry();
    this.samples.gatling = surfaceSamples(this.geo.gatling.body, 120);
    this.geo.sword = swordGeometry();
    this.samples.sword = surfaceSamples(this.geo.sword.geo, 80);
    this.sword = null;
    this.ghost = {
      fist: ghostMesh(this.geo.fist, { uPattern: 1, uScale: 0.16, uFadeZ: new THREE.Vector2(-1.5, -0.6) }),
      shield: ghostMesh(this.geo.shield, { uPattern: 1, uScale: 0.13, uEmblem: 1 }),
      wall: ghostMesh(this.geo.wall, { uPattern: 2, uScale: 0.34 }),
    };
    const pathGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 1.7, 1.2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.path.frustumCulled = false;
    this.aim = { active: false, point: new THREE.Vector3(), end: new THREE.Vector3(), dir: new THREE.Vector3(), from: new THREE.Vector3(), travel: new THREE.Vector3(), dist: 0, valid: false, body: null, target: null, water: false, yaw: 0, base: 0 };
    this.aimFilter = (c) => !this.bounds?.has(c.handle) && !this.player.ignore.has(c.handle);
  }

  // Enter a scene: { scene, physics, ground(x, z), bounds: Set of invisible-wall collider handles,
  // canLand(x, z), solid(x, y, z), center, radius, floor(x, z), ceiling } (the rest bound flight).
  attach({ scene, physics, ground, bounds = new Set(), canLand = () => true, solid = null, center = new THREE.Vector3(), radius = 80, floor = null, ceiling = 48 }) {
    this.detach();
    Object.assign(this, { scene, physics, ground, bounds });
    this.sparks = new Particles(1200, { additive: true, drag: 1.8, turbulence: 0.6 });
    this.trail = new Particles(600, { additive: true, drag: 2.5, turbulence: 0.4 });
    this.dust = new Particles(300, { additive: false, soft: 0.15, puffy: true, drag: 1.6, gravity: 0.25 });
    this.spray = new Particles(500, { additive: true, gravity: -9.8, drag: 0.4 });
    for (const p of [this.sparks, this.trail, this.dust, this.spray]) scene.add(p.points);
    for (const g of Object.values(this.ghost)) { g.visible = false; scene.add(g); }
    scene.add(this.path);
    this.aura = new THREE.PointLight(0x55ff88, 0, 5, 2);
    this.flash = new THREE.PointLight(0x66ffa0, 0, 9, 2);
    scene.add(this.aura, this.flash);
    // gatling tracers: one instanced additive streak mesh
    this.tracers = [];
    this.tracerMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).rotateX(Math.PI / 2).translate(0, 0, -0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.6, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 64);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    scene.add(this.tracerMesh);
    this.muzzleGlow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.5)');
    floor ??= (x, z) => { const h = ground(x, z); return h < WATER + 0.3 ? WATER + 0.45 : h; }; // hover over water
    this.player.air = { floor, canLand, solid, ignoreInFlight: bounds, center, radius, ceiling };
    this.player.onTakeoff = () => this.takeoffFx();
    this.player.onLand = (v, soft) => this.landFx(v, soft);
    this.player.onNoLanding = () => this.say('No ground to land on here.', { voice: false });
  }

  // ------------------------------------------------------------------------------- frame
  // Leave the current scene (travelling, or entering another): held and standing constructs,
  // hazards, targets and the effect layers go with it.
  detach() {
    if (!this.scene) return;
    this.closeWheel();
    this.holster();
    this.clearConstructs();
    this.hazards = [];
    this.targets.clear();
    this.aim.target = null;
    this.markerTarget = null;
    for (const o of [this.sparks.points, this.trail.points, this.dust.points, this.spray.points, ...Object.values(this.ghost), this.path, this.aura, this.flash, this.tracerMesh]) o.removeFromParent();
    this.wind?.set(0);
    this.scene = null;
    // nothing drives time or the grade until the next scene is attached
    this.engine.timeScale = 1;
    this.engine.gradeUniforms.uFocus.value = 0;
    this.engine.gradeUniforms.uHurt.value = 0;
  }

  update(dt, real) {
    if (!this.scene) return;
    const { input, player, engine } = this;
    const t = engine.time;
    // time: the wheel stops it, a strike freezes it for a few frames (hit-stop)
    this.hitStop = Math.max(0, this.hitStop - real);
    const target = this.wheelState || this.freeze ? 0 : this.hitStop > 0 ? 0.03 : 1;
    engine.timeScale = target < engine.timeScale ? target : damp(engine.timeScale, target, 14, real);
    if (engine.timeScale > 0.995) engine.timeScale = 1;
    const grade = engine.gradeUniforms;
    grade.uFocus.value = damp(grade.uFocus.value, this.wheelState || this.freeze ? 1 : 0, 16, real);
    this.hurtFx = Math.max(0, this.hurtFx - real * 1.4);
    grade.uHurt.value = this.hurtFx;

    const acting = player.control;
    if (this.wheelState) { if (acting) this.updateWheel(real); else this.closeWheel(); }
    else if (acting && input.hit(...KEY4)) {
      if (this.enabled.constructs) this.openWheel();
      else if (this.enabled.hud) { this.audio.denied(); this.say(LINES.ringOffline.text); }
    }
    if (acting && !this.wheelState && this.selected && input.hit('KeyQ')) this.holster();

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.armTimer > 0 && (this.armTimer -= dt) <= 0 && !this.shield) player.animator.reach('R', null, { rate: 7 });
    if (this.selected && acting && input.wheel) {
      const [lo, hi] = constructInfo(this.selected).range ?? [0, 0];
      if (hi) this.reach = clamp((this.reach ?? Math.min(hi, this.aim.dist || hi)) + input.wheel * -1.0, lo, hi);
    }
    if (this.regen > 0 && !this.wheelState && this.enabled.constructs) this.charge = Math.min(100, this.charge + this.regen * dt);
    this.updateAim();
    this.updateGhost(t);
    if (acting && !this.wheelState && this.selected) this.updateCast(dt);
    else { this.shield?.release(); if (this.gatling) this.gatling.firing = false; }

    for (const c of this.live) c.update(dt, t);
    this.live = this.live.filter((c) => !c.done || (c.dispose(), false));
    // a held construct up: Hal squares up to where the camera looks and strafes (Player.strafe)
    player.strafe = !!((this.shield && !this.shield.ending) || (this.gatling && !this.gatling.ending) || (this.sword && !this.sword.ending));
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 60);
    for (const p of [this.sparks, this.trail, this.dust, this.spray]) p.update(dt, t, engine.camera, engine.renderer);
    this.updateTracers(dt);

    this.updateFlight(dt);
    this.updateVitals(dt, real);
    this.updateMarker();
    this.updateTargetHud();
    this.hud.setCharge(this.charge);
  }

  // ------------------------------------------------------------------------------- the wheel
  openWheel() {
    this.wheelState = { cursor: new THREE.Vector2(), hover: CONSTRUCTS.findIndex((c) => c.id === this.selected), t: 0 };
    this.player.inputBlocked = true;
    this.shield?.release();
    this.hud.openWheel(this.unlocked, this.selected, this.charge);
    this.audio.muffle(true);
  }

  closeWheel() {
    if (!this.wheelState) return;
    this.wheelState = null;
    this.player.inputBlocked = false;
    this.hud.closeWheel();
    this.audio.muffle(false);
  }

  updateWheel(real) {
    const w = this.wheelState, input = this.input;
    w.t += real;
    // a virtual cursor from mouse motion while the pointer is captured, the real one otherwise
    if (input.locked) {
      w.cursor.x += input.mouse.dx;
      w.cursor.y += input.mouse.dy;
      if (w.cursor.length() > 150) w.cursor.setLength(150);
    } else w.cursor.set(input.mouse.x - innerWidth / 2, input.mouse.y - innerHeight / 2);
    if (w.cursor.length() > 28) {
      const deg = ((Math.atan2(w.cursor.x, -w.cursor.y) * 180) / Math.PI + 360) % 360;
      const i = Math.round(deg / (360 / CONSTRUCTS.length)) % CONSTRUCTS.length;
      if (i !== w.hover) { w.hover = i; this.audio.wheelTick(); }
    }
    this.hud.hoverWheel(w.hover, w.cursor);
    // click to choose; holding 4 and letting go also chooses (the quick weapon-wheel habit)
    if (input.hit('Mouse0') || (input.up(...KEY4) && w.t > 0.35 && w.hover >= 0)) {
      input.consume('Mouse0', 'Click');
      this.choose(w.hover);
    } else if (input.hit('Mouse2', 'KeyQ', ...KEY4)) this.closeWheel();
  }

  choose(i) {
    const c = CONSTRUCTS[i];
    if (!c) { this.closeWheel(); return; }
    if (!this.unlocked.has(c.id)) { this.hud.denyWheel(i); this.audio.denied(); return; }
    this.selected = c.id;
    this.reach = null;
    if (c.id !== 'shield') this.shield?.release();
    if (c.id !== 'gatling') this.gatling?.end();
    if (c.id !== 'sword') this.sword?.end();
    this.closeWheel();
    this.audio.constructForm(0.45);
    this.hud.setArmed(c, KEYS[c.id]);
    this.onSelect?.(c.id);
  }

  holster() {
    this.selected = null;
    this.hud.setArmed(null);
    this.shield?.release();
    this.gatling?.end();
    this.sword?.end();
  }

  // ------------------------------------------------------------------------------- aiming
  // A ray from the camera through the reticle (skipping what's between the camera and Hal), capped
  // to the construct's range measured from Hal's chest; water counts as a surface.
  updateAim() {
    const a = this.aim, info = constructInfo(this.selected), rig = this.player.rig;
    a.active = !!(info && rig && this.physics);
    if (!a.active) return;
    const dir = a.dir.copy(this.director.look).sub(this.director.pos).normalize();
    rig.bonePosition('chest', a.from);
    const origin = _a.copy(this.director.pos);
    origin.addScaledVector(dir, Math.max(0, _b.subVectors(a.from, origin).dot(dir)));
    const [rMin, rMax] = info.range ?? [0, 3];
    const cap = Math.min(this.reach ?? rMax, rMax);
    const hit = this.physics.world.castRay(new RAPIER.Ray(origin, dir), 90, true, undefined, undefined, this.player.collider, undefined, this.aimFilter);
    let toi = hit ? hit.timeOfImpact : Infinity;
    a.water = false;
    a.body = null;
    if (dir.y < -1e-3) { const tw = (WATER - origin.y) / dir.y; if (tw > 0 && tw < toi) { toi = tw; a.water = true; } }
    if (hit && !a.water) { const b = hit.collider.parent(); a.body = b?.isDynamic() ? b : null; }
    a.point.copy(origin).addScaledVector(dir, Number.isFinite(toi) ? toi : cap);
    _c.subVectors(a.point, a.from);
    let d = _c.length();
    if (d > cap) { a.point.copy(a.from).addScaledVector(_c.divideScalar(d), cap); d = cap; a.body = null; a.water = false; }
    if (d < rMin) { a.point.copy(a.from).addScaledVector(_c.normalize(), rMin); d = rMin; }
    a.dist = d;
    // aim assist: a target close to the reticle pulls the aim onto it (attack constructs only)
    a.target = info.kind === 'attack' ? this.assist(origin, dir, rMax) : null;
    if (a.target) {
      a.point.copy(a.target.position);
      a.body = a.target.body;
      a.water = false;
      a.dist = a.point.distanceTo(a.from);
    }
    a.valid = this.charge >= (info.cost ?? 0);
    if (info.id === 'fist') {
      this.ringPos(_d);
      a.travel.subVectors(a.point, _d).normalize();
      a.end.copy(a.point).addScaledVector(a.travel, -0.58); // knuckles meet the surface
    } else if (info.id === 'wall') {
      // stand it on the ground under the aim point, square to Hal, horizontal range limits
      _c.set(a.point.x - a.from.x, 0, a.point.z - a.from.z);
      let hd = _c.length();
      if (hd < 0.01) { _c.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw)); hd = 1; }
      _c.divideScalar(hd);
      hd = clamp(hd, rMin, cap);
      a.point.set(a.from.x + _c.x * hd, 0, a.from.z + _c.z * hd);
      a.yaw = Math.atan2(-_c.x, -_c.z);
      let lo = Infinity, hiG = -Infinity;
      for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const x = a.point.x + Math.cos(a.yaw) * WALL.width * s, z = a.point.z - Math.sin(a.yaw) * WALL.width * s;
        const h = this.ground(x, z);
        lo = Math.min(lo, h);
        hiG = Math.max(hiG, h);
      }
      a.point.y = a.base = lo;
      a.dist = hd;
      a.valid &&= lo > WATER + 0.02 && hiG - lo < 1.4;
    }
  }

  // The target nearest the reticle within a few degrees (wider for small, distant ones), in range
  // and in clear view.
  assist(origin, dir, range) {
    let best = null, bestA = Infinity;
    for (const tg of this.targets) {
      if (!tg.alive) continue;
      _b.subVectors(tg.position, origin);
      const dist = _b.length();
      if (dist < 0.5 || tg.position.distanceTo(this.aim.from) > range + tg.radius) continue;
      const ang = Math.acos(clamp(_b.dot(dir) / dist, -1, 1));
      const lim = Math.max(0.055, Math.atan((tg.radius * 1.6) / dist));
      if (ang > lim || ang >= bestA) continue;
      const hit = this.physics.world.castRay(new RAPIER.Ray(origin, _b.divideScalar(dist)), dist, true, undefined, undefined, this.player.collider, undefined, this.aimFilter);
      if (hit && hit.collider !== tg.collider && hit.timeOfImpact < dist - tg.radius - 0.2) continue;
      best = tg;
      bestA = ang;
    }
    return best;
  }

  addTarget(t) { this.targets.add(t); }
  removeTarget(t) { this.targets.delete(t); if (this.aim.target === t) this.aim.target = null; }
  targetOf(body) { for (const t of this.targets) if (t.body === body) return t; return null; }

  // Damage a target and show the number where it was hit.
  dealDamage(target, amount, point, dir) {
    const dealt = target.hit(Math.round(amount), point, dir);
    if (dealt > 0) {
      this.audio.hitTick();
      _e.copy(point).project(this.engine.camera);
      if (_e.z < 1) this.hud.damageNumber((_e.x * 0.5 + 0.5) * innerWidth, (-_e.y * 0.5 + 0.5) * innerHeight, dealt, !target.alive, target);
    }
    return dealt;
  }

  // Brackets and a health bar on the aimed-at target, or the one nearest the reticle.
  updateTargetHud() {
    const cam = this.engine.camera;
    let tg = this.aim.active ? this.aim.target : null;
    if (!tg && this.player.control && this.targets.size) {
      let bestA = 0.22;
      cam.getWorldDirection(_a);
      for (const t of this.targets) {
        if (!t.alive) continue;
        _b.subVectors(t.position, cam.position);
        const d = _b.length(), ang = Math.acos(clamp(_b.dot(_a) / d, -1, 1));
        if (d < 60 && ang < bestA) { bestA = ang; tg = t; }
      }
    }
    if (!tg || !this.player.control) { this.hud.setTarget(null); return; }
    _a.copy(tg.position).project(cam);
    if (_a.z > 1) { this.hud.setTarget(null); return; }
    const dist = cam.position.distanceTo(tg.position);
    const px = (tg.radius * 1.4 * innerHeight) / (2 * Math.tan((cam.fov * Math.PI) / 360) * dist);
    this.hud.setTarget({ x: (_a.x * 0.5 + 0.5) * innerWidth, y: (-_a.y * 0.5 + 0.5) * innerHeight, size: Math.max(22, px), health: tg.health / tg.maxHealth, locked: tg === this.aim.target });
  }

  updateGhost(t) {
    for (const g of Object.values(this.ghost)) g.visible = false;
    this.path.visible = false;
    const a = this.aim, id = this.selected;
    if (!a.active || this.wheelState || !this.player.control) { this.hud.setReticle(null); return; }
    const g = this.ghost[id];
    if (!g) { this.hud.setReticle({ valid: a.valid, label: `${a.dist.toFixed(1)} m${a.valid ? '' : '  · low charge'}` }); return; }
    g.userData.u.uTime.value = t;
    g.userData.valid(a.valid);
    if (id === 'fist') {
      g.visible = true;
      g.position.copy(a.end);
      g.lookAt(_a.copy(a.end).add(a.travel));
      const p = this.path.geometry.attributes.position;
      this.ringPos(_b);
      p.setXYZ(0, _b.x, _b.y, _b.z);
      _c.copy(a.end).addScaledVector(a.travel, -1.0);
      p.setXYZ(1, _c.x, _c.y, _c.z);
      p.needsUpdate = true;
      this.path.material.color.copy(g.userData.u.uColor.value);
      this.path.visible = true;
    } else if (id === 'wall') {
      g.visible = true;
      g.position.copy(a.point);
      g.rotation.set(0, a.yaw, 0);
    } else if (id === 'shield' && !this.shield) {
      g.visible = true;
      this.shieldPose(g.position, g.quaternion);
    }
    const label = id === 'shield' ? '' : `${a.dist.toFixed(1)} m${a.valid ? '' : this.charge < constructInfo(id).cost ? '  · low charge' : '  · no footing'}`;
    this.hud.setReticle({ valid: a.valid, label });
  }

  // ------------------------------------------------------------------------------- casting
  updateCast() {
    const input = this.input, id = this.selected, info = constructInfo(id), a = this.aim;
    if (id === 'gatling') {
      const held = input.down('Mouse0');
      if (held && !this.gatling && this.cooldown <= 0) {
        if (this.spend(info.cost)) this.live.push((this.gatling = new GatlingConstruct(this)));
        else if (input.hit('Mouse0')) this.lowCharge();
      }
      if (this.gatling) this.gatling.firing = held;
      return;
    }
    if (id === 'sword') {
      // the blade forms on the first click and stays in hand while the sword is armed
      if (input.hit('Mouse0')) {
        if (!this.sword) { if (this.spend(info.cost)) this.live.push((this.sword = new SwordConstruct(this))); else this.lowCharge(); }
        else this.sword.queue();
      }
      return;
    }
    if (id === 'shield') {
      const held = input.down('Mouse0');
      if (held && !this.shield && this.cooldown <= 0 && this.spend(info.cost)) this.raiseShield();
      else if (held && !this.shield && input.hit('Mouse0') && this.charge < info.cost) this.lowCharge();
      if (!held && this.shield && this.shield.t > 0.35) this.shield.release();
      return;
    }
    if (!input.hit('Mouse0') || this.cooldown > 0) return;
    if (!a.valid) { if (this.charge < info.cost) this.lowCharge(); else this.audio.denied(); return; }
    this.spend(info.cost);
    if (id === 'fist') this.strike();
    else if (id === 'wall') this.raiseWall();
  }

  spend(n) {
    if (this.charge < n) return false;
    this.charge -= n;
    if (this.charge < 20 && this.charge + n >= 20) this.say(LINES.ringBelow20.text);
    return true;
  }

  lowCharge() {
    this.audio.denied();
    this.say(LINES.ringLowCharge.text);
  }

  ringPos(out) {
    if (this.ring?.parent) return this.ring.getWorldPosition(out);
    return this.player.rig.bonePosition('hand_R', out);
  }

  // The ring arm thrusts toward a point, Hal turning to face it.
  castArm(target, hold = 0.45) {
    const p = this.player, sh = new THREE.Vector3(), aim = target.clone();
    p.turnTo(Math.atan2(aim.x - p.position.x, aim.z - p.position.z), 14);
    p.animator.reach('R', () => {
      p.rig.bonePosition('upperArm_R', sh);
      return sh.add(_e.copy(aim).sub(sh).normalize().multiplyScalar(0.75));
    }, { pole: new THREE.Vector3(-0.55, -0.75, -0.25), rate: 18 });
    this.armTimer = hold;
  }

  strike() {
    const a = this.aim;
    this.castArm(a.point, 0.5);
    this.cooldown = 0.45;
    this.stats.strikes++;
    this.audio.punch();
    this.live.push(new FistStrike(this, a.end.clone(), a.point.clone(), a.travel.clone(), a.body, a.water));
  }

  raiseWall() {
    const a = this.aim;
    this.castArm(_a.copy(a.point).setY(a.base + 1.2), 0.6);
    this.cooldown = 0.7;
    this.stats.walls++;
    const wall = new WallConstruct(this, a.point.clone(), a.yaw);
    this.live.push(wall);
    this.walls.push(wall);
    if (this.walls.filter((w) => !w.ending).length > 3) this.walls.find((w) => !w.ending).expire();
  }

  raiseShield() {
    this.shield = new HeldShield(this);
    this.live.push(this.shield);
  }

  // Where the held shield sits: in front of Hal's chest, square to where he faces.
  shieldPose(pos, quat) {
    const p = this.player;
    p.rig.bonePosition('chest', pos);
    const yaw = p.yaw;
    _a.set(Math.sin(yaw), 0, Math.cos(yaw));
    pos.addScaledVector(_a, 0.7).y -= 0.1;
    quat.setFromAxisAngle(UP, yaw);
    return _a;
  }

  // Shove dynamic bodies near the line a→b (the fist's path this frame).
  sweep(a, b, r, dir, hits) {
    _a.subVectors(b, a);
    const len2 = Math.max(1e-6, _a.lengthSq());
    for (const { body } of this.physics.dynamics) {
      if (hits.has(body)) continue;
      const t = body.translation();
      _b.set(t.x, t.y, t.z);
      const k = clamp(_c.subVectors(_b, a).dot(_a) / len2);
      _c.copy(a).addScaledVector(_a, k);
      if (_c.distanceTo(_b) > r + (this.targetOf(body)?.radius ?? 0)) continue;
      hits.add(body);
      this.shove(body, dir, _c, 1);
      const tg = this.targetOf(body);
      if (tg) this.dealDamage(tg, 40, _b, dir);
    }
  }

  // An impulse from a blow: heavy things move less (capped impulse), light ones fly.
  shove(body, dir, at, k = 1, power = 14, cap = 700) {
    const J = Math.min(body.mass() * power, cap) * k;
    _d.copy(dir).addScaledVector(UP, 0.35).normalize().multiplyScalar(J);
    body.applyImpulseAtPoint({ x: _d.x, y: _d.y, z: _d.z }, { x: at.x, y: at.y, z: at.z }, true);
  }

  impact(point, dir, { body = null, water = false, hits = new Set(), radius = 2.2 } = {}) {
    this.hitStop = 0.07;
    this.director.shake(0.22, 0.35);
    this.audio.impact(1);
    const struck = [];
    for (const { body: b } of this.physics.dynamics) {
      const t = b.translation();
      const dist = Math.hypot(t.x - point.x, t.y - point.y, t.z - point.z);
      if (hits.has(b)) { struck.push(b); continue; }
      if (b !== body && dist > radius) continue;
      this.shove(b, dir, b === body ? point : t, b === body ? 1.2 : 0.85 * (1 - dist / radius));
      struck.push(b);
      const tg = this.targetOf(b);
      if (tg) this.dealDamage(tg, b === body ? 45 : 30 * (1 - dist / radius) + 8, _b.set(t.x, t.y, t.z), dir);
    }
    this.flash.position.copy(point).addScaledVector(dir, -0.6);
    this.flash.intensity = 10;
    // green shards thrown back off the surface
    this.sparks.emit(70, (p, v) => {
      p[0] = point.x; p[1] = point.y; p[2] = point.z;
      _a.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 7).addScaledVector(dir, -3);
      v[0] = _a.x; v[1] = _a.y + 1.5; v[2] = _a.z;
    }, { life: 0.7, size: [0.09, 0.0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
    if (water) this.splashFx(point, 1);
    else this.dustFx(point, 16, 1.6);
    this.live.push(new Shockwave(this, point, _a.copy(dir).negate(), 1.5, 0.28));
    this.onImpact?.(point, struck);
  }

  // ------------------------------------------------------------------------------- effects
  formSparks(id, mesh, n = 30) {
    const s = this.samples[id];
    mesh.updateMatrixWorld(true);
    this.sparks.emit(n, (p, v) => {
      _a.copy(s[Math.floor(Math.random() * s.length)]).applyMatrix4(mesh.matrixWorld);
      p[0] = _a.x; p[1] = _a.y; p[2] = _a.z;
      v[0] = (Math.random() - 0.5) * 1.2; v[1] = Math.random() * 1.2; v[2] = (Math.random() - 0.5) * 1.2;
    }, { life: 0.45, size: [0.06, 0], color: [[1.5, 6, 2.5, 1], [0.2, 1.5, 0.5, 0]] });
  }

  dustFx(at, n = 20, speed = 1.5) {
    this.dust.emit(n, (p, v) => {
      const a = Math.random() * Math.PI * 2;
      p[0] = at.x + Math.cos(a) * 0.2; p[1] = at.y + 0.05; p[2] = at.z + Math.sin(a) * 0.2;
      v[0] = Math.cos(a) * speed * (0.5 + Math.random()); v[1] = Math.random() * 0.6; v[2] = Math.sin(a) * speed * (0.5 + Math.random());
    }, { life: 1.8, size: [0.35, 1.3], color: [[0.13, 0.11, 0.09, 0.55], [0.1, 0.09, 0.08, 0]] });
  }

  splashFx(at, scale = 1) {
    this.audio.splash(scale);
    this.spray.emit(Math.round(90 * scale), (p, v) => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5 * scale;
      p[0] = at.x + Math.cos(a) * r; p[1] = WATER + 0.02; p[2] = at.z + Math.sin(a) * r;
      v[0] = Math.cos(a) * (0.5 + Math.random() * 2); v[1] = (2 + Math.random() * 4.5) * Math.sqrt(scale); v[2] = Math.sin(a) * (0.5 + Math.random() * 2);
    }, { life: 1.2, size: [0.07, 0.03], color: [[0.5, 0.65, 0.75, 0.7], [0.25, 0.35, 0.45, 0]] });
    this.live.push(new Shockwave(this, _a.set(at.x, WATER + 0.02, at.z), UP, 2.2 * scale, 0.9, new THREE.Color(0.35, 0.5, 0.6)));
  }

  takeoffFx() {
    const p = this.player.position;
    this.audio.takeoff();
    this.director.shake(0.14, 0.4);
    this.physics.burst(p, 2.2, 3.2, 1.4, 0.6);
    this.dustFx(p, 26, 2.4);
    this.live.push(new Shockwave(this, _a.copy(p).setY(p.y + 0.05), UP, 3.4, 0.45));
    this.sparks.emit(40, (q, v) => {
      const a = Math.random() * Math.PI * 2;
      q[0] = p.x + Math.cos(a) * 0.4; q[1] = p.y + 0.1; q[2] = p.z + Math.sin(a) * 0.4;
      v[0] = Math.cos(a) * 2; v[1] = 1 + Math.random() * 3; v[2] = Math.sin(a) * 2;
    }, { life: 0.6, size: [0.07, 0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
  }

  landFx(v, soft) {
    const p = this.player.position;
    if (v > 9) {
      this.audio.land(1);
      this.director.shake(0.35, 0.5);
      this.physics.burst(p, 3, 4, 1.5, 0.8);
      this.dustFx(p, 34, 3);
      this.live.push(new Shockwave(this, _a.copy(p).setY(p.y + 0.05), UP, 4.5, 0.5));
    } else {
      this.audio.land(soft ? 0.35 : 0.5 + v / 20);
      this.dustFx(p, 10, 1.2);
    }
  }

  // ------------------------------------------------------------------------------- flight
  updateFlight(dt) {
    const p = this.player;
    p.canFly = this.enabled.flight && this.charge > 0.5 && !this.wheelState;
    const speed = p.flying ? p.vel.length() : 0;
    this.aura.intensity = damp(this.aura.intensity, p.flying ? 2.6 : 0, 4, dt);
    if (p.rig) this.aura.position.copy(p.rig.bonePosition('chest', _a));
    if (!p.flying) { this.wind?.set(0); return; }
    this.wind ??= this.audio.airflow();
    this.wind.set(smooth(0, 20, speed));
    this.charge = Math.max(0, this.charge - dt * (0.12 + (p.boosting ? 0.35 : 0)));
    if (this.charge <= 0) { p.stopFlying(true); this.say(LINES.ringDepleted.text); }
    // light trailing off the ring fist and the boots
    if (speed > 3 && dt > 0) {
      const n = speed > 12 ? 3 : 1;
      for (const bone of ['hand_R', 'foot_L', 'foot_R']) {
        p.rig.bonePosition(bone, _b);
        this.trail.emit(bone === 'hand_R' ? n + 1 : n, (q, v) => {
          q[0] = _b.x + (Math.random() - 0.5) * 0.06; q[1] = _b.y + (Math.random() - 0.5) * 0.06; q[2] = _b.z + (Math.random() - 0.5) * 0.06;
          v[0] = -p.vel.x * 0.15; v[1] = -p.vel.y * 0.15; v[2] = -p.vel.z * 0.15;
        }, { life: 0.45, size: [bone === 'hand_R' ? 0.07 : 0.045, 0], color: [[0.8, 4, 1.6, 0.9], [0.1, 1, 0.35, 0]] });
      }
    }
  }

  // ------------------------------------------------------------------------------- vitals
  updateVitals(dt, real) {
    if (!this.enabled.hud) return;
    this.lastHurt += dt;
    const p = this.player.position;
    for (const h of this.hazards) {
      if (h.active && !h.active()) continue;
      const c = h.position;
      if (Math.hypot(p.x - c.x, p.z - c.z) < h.radius && p.y < c.y + (h.height ?? 1.3) && p.y > c.y - 0.8) this.damage(h.dps * dt, null, 'fire');
    }
    if (this.lastHurt > 4 && this.health < this.maxHealth && !this.dead) this.health = Math.min(this.maxHealth, this.health + 8 * dt);
    this.hud.setHealth(this.health, this.maxHealth, real);
  }

  // Returns the damage taken. A raised shield facing the source blocks it; the uniform's aura
  // absorbs part of anything else.
  damage(amount, from = null, kind = 'hit') {
    if (!this.enabled.hud || this.dead || amount <= 0) return 0;
    if (from && this.shield?.blocks(from)) { this.shield.ripple(from); this.stats.blocks++; return 0; }
    amount *= this.suited ? 0.55 : 1;
    this.health = Math.max(0, this.health - amount);
    this.lastHurt = 0;
    const now = performance.now();
    if (kind !== 'fire' || now - (this.lastHurtFx ?? 0) > 450) {
      this.lastHurtFx = now;
      this.hurtFx = Math.min(0.85, this.hurtFx + (kind === 'fire' ? 0.3 : 0.2 + amount / 35));
      this.audio.hurt();
      this.hud.hurt();
      if (kind !== 'fire') this.director.shake(0.25, 0.3);
    }
    if (this.health <= 0) { this.dead = true; this.onDeath?.(); }
    return amount;
  }

  // ------------------------------------------------------------------------------- ring voice
  say(text, { voice = true, hold } = {}) {
    const now = performance.now();
    if (this.lastSay === text && now - this.lastSayAt < 4000) return Promise.resolve();
    this.lastSay = text;
    this.lastSayAt = now;
    this.audio.ringBlip();
    this.hud.ringMessage(text, hold);
    return voice ? this.voice.speak(text, 'ring') : Promise.resolve();
  }

  updateMarker() {
    const m = this.markerTarget, cam = this.engine.camera;
    if (!m || !this.player.control) { this.hud.setMarker(null); return; }
    _a.copy(m.pos).project(cam);
    const behind = _a.z > 1;
    let x = _a.x, y = _a.y;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
    if (off) { const s = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86, 1e-3); x *= s; y *= s; }
    const dist = this.player.position.distanceTo(m.pos);
    this.hud.setMarker((x * 0.5 + 0.5) * innerWidth, (-y * 0.5 + 0.5) * innerHeight, `${m.label}${dist > 3 ? ` · ${Math.round(dist)} m` : ''}`, off);
  }

  // A green streak from the muzzle to where a gatling round landed.
  tracer(from, to) {
    if (this.tracers.length >= 64) this.tracers.shift();
    const dir = to.clone().sub(from), len = dir.length();
    this.tracers.push({ from: from.clone(), dir: dir.divideScalar(Math.max(len, 1e-3)), len, t: 0 });
  }

  updateTracers(dt) {
    const SPEED = 220, L = 3.5;
    this.tracers = this.tracers.filter((tr) => (tr.t += dt) * SPEED < tr.len + L);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.tracers.forEach((tr, i) => {
      const head = Math.min(tr.len, tr.t * SPEED), tail = Math.max(0, tr.t * SPEED - L);
      _a.copy(tr.from).addScaledVector(tr.dir, head);
      q.setFromUnitVectors(FACE, tr.dir);
      sc.set(1, 1, Math.max(0.01, head - tail));
      m.compose(_a, q, sc);
      this.tracerMesh.setMatrixAt(i, m);
    });
    this.tracerMesh.count = this.tracers.length;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  // Refill (the lantern), e.g. over a tween.
  setCharge(v) { this.charge = clamp(v, 0, 100); this.hud.setCharge(this.charge); }

  clearConstructs() {
    for (const c of this.live) c.dispose();
    this.live = [];
    this.walls = [];
    this.shield = null;
    this.gatling = null;
    this.sword = null;
    this.player.strafe = false;
    this.player.moveScale = 1;
  }
}

// ------------------------------------------------------------------------------------- constructs
// The fist launches from the ring once the arm has thrust out, grows as it flies, strikes, recoils
// and dissolves; a tether of light runs from the ring to its wrist the whole time.
class FistStrike {
  constructor(P, end, point, dir, body, water) {
    Object.assign(this, { P, end, point, dir, body, water });
    this.mesh = constructMesh(P.geo.fist, { uPattern: 0, uFadeZ: new THREE.Vector2(-1.5, -0.6) });
    this.mesh.visible = false;
    this.mesh.userData.set('uForm', 0);
    this.beam = createBeam(0.03);
    this.beam.visible = false;
    P.scene.add(this.mesh, this.beam);
    this.t = -0.08; // the arm extends first
    this.state = 'wind';
    this.hits = new Set();
    this.prev = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.ring = new THREE.Vector3();
  }

  update(dt, time) {
    const P = this.P, set = this.mesh.userData.set, bu = this.beam.userData.u;
    this.t += dt;
    set('uTime', time);
    bu.uTime.value = time;
    P.ringPos(this.ring);
    if (this.state === 'wind') {
      if (this.t < 0) return;
      this.state = 'fly';
      this.from = this.ring.clone();
      this.dur = Math.max(0.13, this.from.distanceTo(this.end) / 34);
      this.prev.copy(this.from);
      this.mesh.visible = this.beam.visible = true;
      P.audio.constructForm(0.7);
    }
    if (this.state === 'fly') {
      const k = Math.min(1, this.t / this.dur);
      const s = 0.3 + 0.7 * smooth(0, 0.55, k);
      this.pos.lerpVectors(this.from, this.end, k * (0.55 + 0.45 * k));
      this.place(s, (1 - k) * 0.6);
      set('uForm', Math.min(1, this.t / 0.1));
      if (this.t < 0.06) P.formSparks('fist', this.mesh, 12);
      P.sweep(this.prev, this.pos, 0.7 * s, this.dir, this.hits);
      this.prev.copy(this.pos);
      bu.uOpacity.value = 1;
      if (k >= 1) {
        this.state = 'hold';
        this.t = 0;
        P.impact(this.point, this.dir, { body: this.body, water: this.water, hits: this.hits });
      }
    } else if (this.state === 'hold') {
      this.pos.addScaledVector(this.dir, -dt * 1.2);
      this.place(1, 0);
      if (this.t > 0.14) { this.state = 'fade'; this.t = 0; P.audio.dissolve(); }
    } else if (this.state === 'fade') {
      const k = Math.min(1, this.t / 0.32);
      set('uForm', 1 - k);
      this.place(1 + 0.12 * k, 0);
      bu.uOpacity.value = Math.max(0, 1 - k * 1.6);
      if (this.t < 0.1) P.formSparks('fist', this.mesh, 6);
      if (k >= 1) this.done = true;
    }
  }

  place(scale, roll) {
    const m = this.mesh;
    m.position.copy(this.pos);
    m.scale.setScalar(scale);
    m.lookAt(_a.copy(this.pos).add(this.dir));
    m.rotateZ(roll);
    this.beam.userData.span(this.ring, _b.copy(this.pos).addScaledVector(this.dir, -1.0 * scale));
  }

  dispose() {
    this.mesh.removeFromParent();
    this.beam.removeFromParent();
  }
}

// Held in front of Hal while the button is down. A kinematic body, so debris bounces off it; the
// player's controller and camera pass through it.
class HeldShield {
  constructor(P) {
    this.P = P;
    this.mesh = constructMesh(P.geo.shield, { uPattern: 1, uScale: 0.13, uEmblem: 1, outline: 0.018 });
    this.mesh.userData.set('uForm', 0);
    P.scene.add(this.mesh);
    const world = P.physics.world;
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.col = world.createCollider(RAPIER.ColliderDesc.cuboid(0.67, 0.86, 0.1).setRestitution(0.45), this.rb);
    P.player.ignore.add(this.col.handle);
    this.t = 0;
    this.ending = false;
    this.form = 0;
    this.hit = 0;
    this.normal = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.seen = new Map();
    this.hand = new THREE.Vector3();
    P.audio.shieldUp();
    this.hum = P.audio.hum();
    const p = P.player, rig = p.rig;
    p.animator.reach('R', () => {
      rig.bonePosition('chest', this.hand);
      return this.hand.addScaledVector(this.normal, 0.56).addScaledVector(_e.set(-this.normal.z, 0, this.normal.x), 0.1).setY(this.hand.y - 0.06);
    }, { pole: new THREE.Vector3(-0.8, -0.6, -0.1), rate: 16 });
  }

  update(dt, time) {
    const P = this.P, set = this.mesh.userData.set;
    this.t += dt;
    if (this.ending) this.endT += dt;
    this.form = this.ending ? 1 - Math.min(1, this.endT / 0.22) : Math.min(1, this.t / 0.18);
    set('uForm', this.form);
    set('uTime', time);
    this.normal.copy(P.shieldPose(this.center, this.mesh.quaternion));
    this.mesh.position.copy(this.center);
    this.mesh.scale.setScalar(0.7 + 0.3 * this.form);
    this.rb.setNextKinematicTranslation(this.center);
    this.rb.setNextKinematicRotation(this.mesh.quaternion);
    if (this.t < 0.12) P.formSparks('shield', this.mesh, 10);
    // debris striking the face: ripple and a ring
    for (const { body } of P.physics.dynamics) {
      const tr = body.translation();
      _a.set(tr.x - this.center.x, tr.y - this.center.y, tr.z - this.center.z);
      const depth = _a.dot(this.normal);
      if (depth < -0.2 || depth > 0.75) continue;
      _a.addScaledVector(this.normal, -depth);
      if (_a.length() > 0.95) continue;
      const lv = body.linvel(), toward = -(lv.x * this.normal.x + lv.y * this.normal.y + lv.z * this.normal.z);
      const last = this.seen.get(body) ?? -1;
      if (toward > 2 && this.t - last > 0.3) {
        this.seen.set(body, this.t);
        this.ripple(_b.set(tr.x, tr.y, tr.z));
        P.audio.shieldHit(Math.min(1, toward / 10));
        P.stats.blocks++;
      }
    }
    this.hit = Math.max(0, this.hit - dt * 2.4);
    set('uHit', this.hit);
    const drain = constructInfo('shield').drain;
    if (!this.ending) {
      P.charge = Math.max(0, P.charge - drain * dt);
      if (P.charge <= 0) { this.release(); P.say('Charge depleted.'); }
    }
    if (this.ending && this.endT > 0.22) this.done = true;
  }

  blocks(from) { return !this.ending && this.form > 0.5 && _c.subVectors(from, this.center).normalize().dot(this.normal) > 0.15; }

  ripple(at) {
    this.hit = 1;
    this.mesh.userData.u.uHitPos.value.copy(at);
    this.P.sparks.emit(16, (p, v) => {
      p[0] = at.x; p[1] = at.y; p[2] = at.z;
      v[0] = this.normal.x * 2 + (Math.random() - 0.5) * 3; v[1] = Math.random() * 2; v[2] = this.normal.z * 2 + (Math.random() - 0.5) * 3;
    }, { life: 0.4, size: [0.06, 0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
  }

  release() {
    if (this.ending) return;
    this.ending = true;
    this.endT = 0;
    this.hum.stop();
    this.P.audio.dissolve();
    this.P.player.animator.reach('R', null, { rate: 7 });
    this.P.cooldown = 0.25;
  }

  dispose() {
    const P = this.P;
    P.physics.world.removeRigidBody(this.rb);
    P.player.ignore.delete(this.col.handle);
    this.mesh.removeFromParent();
    if (P.shield === this) P.shield = null;
  }
}

// A brick wall that rises out of the ground (a kinematic body, so it lifts what it comes up under),
// holds for its lifetime, then sinks and dissolves.
class WallConstruct {
  constructor(P, base, yaw) {
    this.P = P;
    this.base = base;
    this.mesh = constructMesh(P.geo.wall, { uPattern: 2, uScale: 0.34, outline: 0.025 });
    this.mesh.userData.set('uForm', 0);
    this.mesh.position.copy(base);
    this.mesh.rotation.y = yaw;
    P.scene.add(this.mesh);
    const h = WALL.height + WALL.buried;
    this.rb = P.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(base.x, base.y - WALL.height, base.z).setRotation(this.mesh.quaternion));
    P.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(WALL.width / 2, h / 2, WALL.depth / 2).setTranslation(0, h / 2 - WALL.buried, 0), this.rb);
    this.t = 0;
    this.life = constructInfo('wall').life;
    this.ending = false;
    P.audio.wallRise();
    P.director.shake(0.1, 0.4);
    const along = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (let i = -2; i <= 2; i++) P.dustFx(_a.copy(base).addScaledVector(along, i * 0.9), 5, 1.2);
  }

  expire() { if (!this.ending) { this.ending = true; this.endT = 0; this.P.audio.dissolve(); } }

  update(dt, time) {
    const set = this.mesh.userData.set;
    this.t += dt;
    set('uTime', time);
    let y;
    if (!this.ending) {
      const k = Math.min(1, this.t / 0.42), back = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2; // ease out with a little overshoot
      y = this.base.y - WALL.height * (1 - back);
      set('uForm', Math.min(1, this.t / 0.3));
      if (this.t < 0.3) this.P.formSparks('wall', this.mesh, 8);
      if (this.t > this.life) this.expire();
    } else {
      this.endT += dt;
      const k = Math.min(1, this.endT / 0.7);
      y = this.base.y - WALL.height * 0.35 * k * k;
      set('uForm', 1 - k);
      if (k >= 1) this.done = true;
    }
    this.mesh.position.y = y;
    this.rb.setNextKinematicTranslation({ x: this.base.x, y, z: this.base.z });
  }

  dispose() {
    this.P.physics.world.removeRigidBody(this.rb);
    this.mesh.removeFromParent();
    const i = this.P.walls.indexOf(this);
    if (i >= 0) this.P.walls.splice(i, 1);
  }
}

// The rotary cannon, held at Hal's right hip with both hands on it. Holding the button spins the
// barrels up, then it fires hitscan rounds with tracers at the aim point (aim assist applies), each
// costing a little charge; let go and it spins down, and dissolves after a moment's rest.
class GatlingConstruct {
  constructor(P) {
    this.P = P;
    const G = P.geo.gatling;
    this.G = G;
    this.group = new THREE.Group();
    this.body = constructMesh(G.body, { uPattern: 0, outline: 0.012 });
    this.barrels = constructMesh(G.barrels, { uPattern: 0, outline: 0.01 });
    for (const m of [this.body, this.barrels]) m.userData.set('uForm', 0);
    this.group.add(this.body, this.barrels);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.muzzleGlow, color: new THREE.Color(0.5, 2.2, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flashSprite.position.copy(G.muzzle).z += 0.08;
    this.group.add(this.flashSprite);
    P.scene.add(this.group);
    this.t = 0;
    this.spin = 0;
    this.angle = 0;
    this.idle = 0;
    this.acc = 0;
    this.recoil = 0;
    this.firing = false;
    this.ending = false;
    this.info = constructInfo('gatling');
    this.muzzle = new THREE.Vector3();
    this.hands = { R: new THREE.Vector3(), L: new THREE.Vector3() };
    const p = P.player;
    p.animator.reach('R', () => this.group.localToWorld(this.hands.R.copy(G.grip)), { pole: new THREE.Vector3(-0.8, -0.5, -0.4), rate: 14 });
    p.animator.reach('L', () => this.group.localToWorld(this.hands.L.copy(G.fore)), { pole: new THREE.Vector3(0.7, -0.6, -0.2), rate: 14 });
    P.audio.constructForm(0.7);
    this.whine = P.audio.spin();
    this.place(0);
  }

  // At the hip on Hal's right, pointing at the aim point.
  place(dt) {
    const P = this.P, p = P.player;
    p.rig.bonePosition('chest', _a);
    const yaw = p.yaw;
    const fwd = _b.set(Math.sin(yaw), 0, Math.cos(yaw)), right = _c.set(-Math.cos(yaw), 0, Math.sin(yaw));
    _a.addScaledVector(right, 0.2).addScaledVector(fwd, 0.36).y -= 0.34;
    this.group.position.copy(_a);
    _d.copy(P.aim.active ? P.aim.point : _e.copy(_a).addScaledVector(fwd, 10));
    if (_d.distanceTo(_a) < 1.5) _d.copy(_a).addScaledVector(fwd, 10);
    this.group.lookAt(_d);
    this.group.translateZ(-this.recoil);
  }

  end() {
    if (this.ending) return;
    this.ending = true;
    this.endT = 0;
    this.whine.stop();
    this.P.audio.dissolve();
    const p = this.P.player;
    p.animator.reach('R', null, { rate: 7 });
    p.animator.reach('L', null, { rate: 7 });
    p.moveScale = 1;
  }

  update(dt, time) {
    const P = this.P, p = P.player;
    this.t += dt;
    if (this.ending) this.endT += dt;
    const form = this.ending ? 1 - Math.min(1, this.endT / 0.25) : Math.min(1, this.t / 0.18);
    for (const m of [this.body, this.barrels]) { m.userData.set('uForm', form); m.userData.set('uTime', time); }
    if (this.t < 0.15) P.formSparks('gatling', this.body, 8);
    if (!this.ending) {
      p.moveScale = this.firing ? 0.45 : 0.8;
      this.spin = damp(this.spin, this.firing ? 1 : 0, this.firing ? 5 : 2.2, dt);
      this.whine.set(this.spin);
      if (this.firing && this.spin > 0.7 && form >= 1) {
        this.idle = 0;
        this.acc += dt * this.info.rate;
        while (this.acc >= 1 && !this.ending) { this.acc -= 1; this.shoot(); }
      } else if (!this.firing && (this.idle += dt) > 1.4) this.end();
    } else this.spin = damp(this.spin, 0, 4, dt);
    this.angle += this.spin * 32 * dt;
    this.barrels.rotation.z = this.angle;
    this.recoil = damp(this.recoil, 0, 18, dt);
    this.flashSprite.material.opacity = Math.max(0, this.flashSprite.material.opacity - dt * 30);
    this.place(dt);
    if (this.ending && this.endT > 0.25) this.done = true;
  }

  shoot() {
    const P = this.P;
    if (!P.spend(this.info.perShot)) { P.lowCharge(); this.end(); return; }
    this.group.updateMatrixWorld(true);
    this.group.localToWorld(this.muzzle.copy(this.G.muzzle));
    const aim = P.aim.target ? P.aim.target.position : P.aim.point;
    const dir = _d.subVectors(aim, this.muzzle).normalize();
    dir.x += (Math.random() - 0.5) * 0.022; dir.y += (Math.random() - 0.5) * 0.022; dir.z += (Math.random() - 0.5) * 0.022;
    dir.normalize();
    const range = 60;
    const hit = P.physics.world.castRay(new RAPIER.Ray(this.muzzle, dir), range, true, undefined, undefined, P.player.collider, undefined, P.aimFilter);
    const end = this.muzzle.clone().addScaledVector(dir, hit ? hit.timeOfImpact : range);
    P.tracer(this.muzzle, end);
    if (hit) {
      const body = hit.collider.parent(), tg = body && P.targetOf(body);
      if (tg) P.dealDamage(tg, this.info.damage, end, dir);
      else if (body?.isDynamic()) P.shove(body, dir, end, 1, 2.5, 30);
      if (tg) tg.body.applyImpulse({ x: dir.x * 1.2, y: 0.2, z: dir.z * 1.2 }, true);
      P.sparks.emit(6, (q, v) => {
        q[0] = end.x; q[1] = end.y; q[2] = end.z;
        v[0] = -dir.x * 2 + (Math.random() - 0.5) * 3; v[1] = Math.random() * 2.5; v[2] = -dir.z * 2 + (Math.random() - 0.5) * 3;
      }, { life: 0.3, size: [0.05, 0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
    }
    this.flashSprite.material.opacity = 1;
    this.flashSprite.scale.setScalar(0.28 + Math.random() * 0.2);
    this.recoil = 0.035;
    P.director.shake(0.035, 0.08);
    P.audio.gatShot();
  }

  dispose() {
    this.group.removeFromParent();
    if (this.P.gatling === this) this.P.gatling = null;
  }
}

// A sword of light in the ring hand. A click cuts; clicks in rhythm chain three cuts (a forehand
// diagonal, a backhand, an overhead chop that lands hardest). Each cut is a keyed path for the hand
// in Hal's own frame (x toward his left, y up, z forward), solved with the arm IK, with the blade's
// direction keyed alongside; the blade sweeps between frames, so a fast cut can't skip a target.
// Cutting at a target you aim at within a lunge, Hal throws himself at it.
const SWINGS = [
  { dur: 0.42, hit: [0.1, 0.27], dmg: 24, keys: [[0, [-0.3, 1.38, 0.18], [-0.35, 0.85, 0.35]], [0.09, [-0.36, 1.52, 0.06], [-0.5, 0.8, -0.3]], [0.25, [0.08, 1.04, 0.38], [0.75, -0.4, 0.55]], [0.42, [0.04, 1.06, 0.34], [0.55, -0.25, 0.8]]] },
  { dur: 0.42, hit: [0.09, 0.26], dmg: 24, keys: [[0, [0.04, 1.06, 0.34], [0.55, -0.25, 0.8]], [0.08, [0.12, 1.2, 0.26], [0.85, 0.15, 0.25]], [0.24, [-0.42, 1.18, 0.3], [-0.9, 0.08, 0.45]], [0.42, [-0.36, 1.14, 0.3], [-0.55, 0.35, 0.78]]] },
  { dur: 0.58, hit: [0.22, 0.36], dmg: 38, heavy: true, keys: [[0, [-0.36, 1.14, 0.3], [-0.55, 0.35, 0.78]], [0.16, [-0.16, 1.8, 0.04], [0.0, 0.55, -0.85]], [0.33, [-0.1, 1.08, 0.48], [0.0, -0.5, 0.86]], [0.58, [-0.24, 1.06, 0.36], [0.05, 0.45, 0.9]]] },
];
const GUARD = { hand: [-0.27, 1.06, 0.33], blade: [0.12, 0.62, 0.78] };

class SwordConstruct {
  constructor(P) {
    this.P = P;
    this.blade = new Blade(P.scene, P.geo.sword);
    this.info = constructInfo('sword');
    this.t = 0;
    this.swing = null; // { def, t, hits, n }
    this.combo = 0;
    this.ending = false;
    this.hand = new THREE.Vector3();
    this.dir = new THREE.Vector3(...GUARD.blade);
    this.edge = new THREE.Vector3(1, 0, 0);
    this.prevDir = new THREE.Vector3(...GUARD.blade);
    const p = P.player;
    this.target = new THREE.Vector3();
    p.animator.reach('R', () => this.target, { pole: new THREE.Vector3(-0.8, -0.55, -0.35), rate: 20 });
    P.audio.constructForm(0.6);
    this.humSnd = P.audio.swordHum();
    this.queued = true; // the click that formed it also cuts
  }

  // a click: cut now, or as the next in the combo if one is under way
  queue() { if (!this.ending) this.queued = true; }

  // while a cut is in its hitting part (Sinestro's blade can be parried then)
  get cutting() { return !!this.swing && this.swing.t >= this.swing.def.hit[0] && this.swing.t <= this.swing.def.hit[1]; }

  start() {
    const P = this.P, p = P.player;
    if (!P.spend(this.info.perSwing)) { P.lowCharge(); this.queued = false; return; }
    const n = this.swing && this.swing.t > this.swing.def.dur * 0.45 ? (this.swing.n + 1) % SWINGS.length : this.combo;
    this.swing = { def: SWINGS[n], t: 0, hits: new Set(), n };
    this.combo = (n + 1) % SWINGS.length;
    this.queued = false;
    this.idle = 0;
    P.audio.swordSwing(n === 2 ? 1.3 : 1);
    // lunge at an aimed target that's close but out of reach
    const tg = P.aim.target;
    if (tg?.alive) {
      const d = _a.subVectors(tg.position, p.position), dist = d.length();
      if (dist > 1.7 && dist < this.info.range[1]) p.dash(d.normalize(), (dist - 1.4) / 0.2, 0.2);
    }
  }

  end() {
    if (this.ending) return;
    this.ending = true;
    this.endT = 0;
    this.humSnd.stop();
    this.P.audio.dissolve();
    this.P.player.animator.reach('R', null, { rate: 7 });
  }

  update(dt, time) {
    const P = this.P, p = P.player;
    this.t += dt;
    if (this.ending) this.endT += dt;
    this.blade.form = this.ending ? 1 - Math.min(1, this.endT / 0.25) : Math.min(1, this.t / 0.16);
    if (this.t < 0.14) P.formSparks('sword', this.blade.mesh, 6);
    if (!this.ending) {
      const sw = this.swing;
      if (sw) {
        sw.t += dt;
        // the next cut starts as this one follows through
        if (this.queued && sw.t > sw.def.dur * 0.55) this.start();
        else if (sw.t >= sw.def.dur) { this.swing = null; this.combo = 0; }
      } else if (this.queued && this.t > 0.1) this.start();
      if (!this.swing) this.idle = (this.idle ?? 0) + dt;
    }
    // the hand's path and the blade's direction, in Hal's frame
    const root = p.rig.root;
    root.updateMatrixWorld(true);
    let hand = GUARD.hand, dir = GUARD.blade;
    if (this.swing && !this.ending) [hand, dir] = sampleSwing(this.swing.def.keys, this.swing.t);
    this.target.set(hand[0], hand[1], hand[2]).applyMatrix4(root.matrixWorld);
    this.prevDir.copy(this.dir);
    root.getWorldQuaternion(_q);
    this.dir.set(dir[0], dir[1], dir[2]).normalize().applyQuaternion(_q);
    // the edge leads the cut
    _b.subVectors(this.dir, this.prevDir);
    if (_b.lengthSq() > 1e-6) this.edge.lerp(_b.normalize(), 0.5);
    _c.set(1, 0, 0).applyQuaternion(_q);
    if (!this.swing) this.edge.lerp(_c, 0.1);
    // in the fist: just past the wrist, along the forearm
    p.rig.bonePosition('hand_R', this.hand);
    p.rig.bonePosition('foreArm_R', _d);
    this.hand.addScaledVector(_e.subVectors(this.hand, _d).normalize(), 0.075);
    this.blade.place(this.hand, this.dir, this.edge);
    this.blade.update(dt, time);
    this.humSnd.set(this.swing ? 1 : 0.35);
    if (this.cutting) this.cut();
    if (this.ending && this.endT > 0.25) this.done = true;
  }

  // sweep the blade from where it was to where it is: targets take the cut once per swing, loose
  // things get knocked aside
  cut() {
    const P = this.P, sw = this.swing, bl = this.blade;
    const dmg = sw.def.dmg;
    for (const tg of P.targets) {
      if (!tg.alive || sw.hits.has(tg)) continue;
      let best = Infinity;
      for (let k = 0; k <= 3; k++) {
        const f = k / 3;
        _a.lerpVectors(bl.prevBase, bl.base, f);
        _b.lerpVectors(bl.prevTip, bl.tip, f);
        best = Math.min(best, segDist(tg.position, _a, _b));
      }
      if (best > tg.radius + 0.12) continue;
      sw.hits.add(tg);
      const dir = _c.subVectors(tg.position, P.player.position).setY(0).normalize();
      if (tg.parry?.(P.player.position)) { P.audio.clash(); P.hitStop = 0.08; continue; }
      P.dealDamage(tg, dmg, tg.position, dir);
      tg.body?.applyImpulse({ x: dir.x * (sw.def.heavy ? 9 : 4) * tg.body.mass() * 0.1, y: 0.6, z: dir.z * (sw.def.heavy ? 9 : 4) * tg.body.mass() * 0.1 }, true);
      P.hitStop = sw.def.heavy ? 0.09 : 0.045;
      P.director.shake(sw.def.heavy ? 0.25 : 0.12, 0.25);
      P.audio.swordHit(sw.def.heavy ? 1.3 : 1);
      P.sparks.emit(sw.def.heavy ? 50 : 24, (q, v) => {
        q[0] = tg.position.x; q[1] = tg.position.y; q[2] = tg.position.z;
        v[0] = dir.x * 3 + (Math.random() - 0.5) * 5; v[1] = Math.random() * 4; v[2] = dir.z * 3 + (Math.random() - 0.5) * 5;
      }, { life: 0.45, size: [0.06, 0], color: [[1.2, 5, 2, 1], [0.1, 1.2, 0.4, 0]] });
    }
    for (const { body } of P.physics.dynamics) {
      if (sw.hits.has(body) || P.targetOf(body)) continue;
      const t = body.translation();
      _d.set(t.x, t.y, t.z);
      if (segDist(_d, bl.base, bl.tip) > 0.45) continue;
      sw.hits.add(body);
      P.shove(body, _e.subVectors(_d, P.player.position).setY(0).normalize(), _d, 0.6, 10, 400);
    }
  }

  dispose() {
    this.blade.dispose();
    if (this.P.sword === this) this.P.sword = null;
  }
}

function sampleSwing(keys, t) {
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

// distance from point p to the segment a-b
function segDist(p, a, b) {
  _sd.subVectors(b, a);
  const k = clamp(_se.subVectors(p, a).dot(_sd) / Math.max(1e-6, _sd.lengthSq()));
  return _se.copy(a).addScaledVector(_sd, k).distanceTo(p);
}
const _q = new THREE.Quaternion(), _sd = new THREE.Vector3(), _se = new THREE.Vector3();

// An expanding ring of light (impacts, takeoffs), facing `normal`.
const RING_GEO = new THREE.RingGeometry(0.82, 1, 48);
class Shockwave {
  constructor(P, at, normal, size = 3, life = 0.4, color = new THREE.Color(0.18, 1.1, 0.45)) {
    this.mesh = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.position.copy(at);
    this.mesh.quaternion.setFromUnitVectors(FACE, normal.clone().normalize());
    this.mesh.renderOrder = 24;
    P.scene.add(this.mesh);
    Object.assign(this, { size, life, t: 0 });
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.life);
    this.mesh.scale.setScalar(0.15 + this.size * (1 - (1 - k) ** 3));
    this.mesh.material.opacity = 0.8 * (1 - k) ** 2;
    if (k >= 1) this.done = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.material.dispose(); }
}
