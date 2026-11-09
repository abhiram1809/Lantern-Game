import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame, damp } from '../engine/Time.js';
import { CorpsSave, allWorlds } from '../engine/Save.js';
import { Story } from './Story.js';
import { LINES } from './lines.js';
import { voyage } from './Voyage.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { POSES, still } from '../characters/Poses.js';
import { createAbinSur, createKilowog, createRing } from '../characters/Characters.js';
import { createShaft } from '../fx/GreenLight.js';
import { Oa, KILOWOG_SPOT, HAL_START, PADS, RANGE_RADIUS, BATTERY } from '../scenes/Oa.js';
import { ABIN_SPOT, ARRIVAL, terrainHeight } from '../scenes/CrashSite.js';
import { DroneSwarm } from '../enemies/Drones.js';
import { TravelHud, StarMap } from '../ui/TravelHud.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KICKER = 'Kilowog’s range';
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// how high Hal must fly before the ring will make the jump
const JUMP_HEIGHT = { earth: 26, oa: 30 };

// Part Two, "The Corps". At the lake the Guardians summon Hal; he climbs out of the sky and the ring
// carries him across the universe to Oa (Voyage.js), down onto Kilowog's range. There: target drones
// for the fist, then the gatling and a live-fire drill against drones that shoot back, then the
// range left open, with hyperspace routes charted between Oa and Earth (the star map, E high in
// flight). Everything else (powers, the lantern, pause, dialogue, collapse) comes from Story.
export class Corps extends Story {
  get save() { return CorpsSave; }

  constructor(opts) {
    super(opts);
    this.travelHud = new TravelHud();
    this.chart = new StarMap(this.input, this.audio);
  }

  steps() {
    return {
      summons: () => this.summons(),
      voyage: () => this.flyToOa(),
      oa: () => this.targets(),
      livefire: () => this.liveFire(),
      range: () => this.openRange(),
      earth: () => this.home(),
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    ui.clock(this.save.info(id).clock);
    this.ring ??= createRing();
    if (id === 'summons' || id === 'earth') {
      this.setupCrash({ body: id === 'summons' });
      this.world = 'earth';
      if (this.abin) this.abinDead();
      this.putOnSuit();
      this.empower(true);
      this.pocketLantern();
      this.lanternSpots(this.site);
      // the summons: standing over Abin Sur, where the training ended
      const approach = V(ARRIVAL.x - ABIN_SPOT.x, 0, ARRIVAL.z - ABIN_SPOT.z).normalize();
      const at = id === 'summons' ? ABIN_SPOT.clone().addScaledVector(approach, 2.2) : ARRIVAL.clone();
      at.y = terrainHeight(at.x, at.z);
      player.spawn(this.site.physics, this.site.scene, at, Math.atan2(ABIN_SPOT.x - at.x, ABIN_SPOT.z - at.z));
      player.camDist = 3.0;
      this.director.mode = 'follow';
      if (id === 'earth') { this.removeAbin(); this.travel = 'chart'; }
      await ui.fade(0, 1.2);
      return;
    }
    this.putOnSuit();
    this.empower(true);
    this.pocketLantern();
    if (id === 'voyage') return; // starts in orbit
    this.setupOa();
    this.enterOa();
    if (id !== 'oa') this.learn('gatling', false);
    if (id === 'range') this.travel = 'chart';
    player.camYaw = 0;
    player.camPitch = 0.16;
    this.director.mode = 'follow';
    if (id !== 'oa') await ui.fade(0, 1.2);
  }

  update(dt, t, real) {
    super.update(dt, t, real);
    this.chart.update();
  }

  // ---------------------------------------------------------------- Oa
  setupOa() {
    if (this.oa) return this.oa;
    const { player, powers, audio } = this;
    const oa = (this.oa = new Oa(this).build());
    const swarm = (this.swarm = new DroneSwarm({ scene: oa.scene, physics: oa.physics, powers, player, audio, director: this.director, arena: RANGE_RADIUS, blocks: oa.blocks }));
    oa.updaters.push((dt, t) => swarm.update(dt, t));
    swarm.onKill = () => this.onKill();
    swarm.onPlayerHit = () => this.onPlayerHit();
    this.addKilowog();
    return oa;
  }

  // Make the range the current scene: Hal on the deck (or at `at`), the powers bound to it.
  enterOa(at = HAL_START, yaw = Math.PI) {
    const { player, powers, audio, oa } = this;
    this.world = 'oa';
    this.show(oa);
    this.playerActive = true;
    player.spawn(oa.physics, oa.scene, at, yaw);
    player.ground = (x, z) => oa.ground(x, z);
    player.surface = 'stone';
    player.camDist = 3.2;
    powers.attach({
      scene: oa.scene, physics: oa.physics, ground: (x, z) => oa.ground(x, z), bounds: oa.bounds, canLand: (x, z) => oa.canLand(x, z),
      floor: (x, z) => (Math.hypot(x, z) < RANGE_RADIUS + 0.4 ? 0 : -60), center: V(0, 0, 0), radius: 150, ceiling: 120,
    });
    powers.regen = 1.5; // the Central Battery keeps every ring on Oa topped up
    this.lanternSpots(oa);
    this.ambience(audio.wind(0.05), audio.roomTone(0.03), audio.pad([65.4, 98, 130.8, 196], 0.03, { cutoff: 520 }));
  }

  // Kilowog on his podium at the north edge. He keeps his feet, but turns to face Hal with a few
  // shuffling steps when Hal walks round him, and talks with his hands (BodyLanguage). Until his
  // scan is built, a broadened Abin Sur stands in.
  addKilowog() {
    const gl = this.assets.characters.kilowog;
    const kw = (this.kilowog = gl ? createKilowog(gl) : createAbinSur(this.assets.characters.abin));
    if (!gl) { kw.root.scale.set(1.3, 1.22, 1.3); kw.u.uTint.value.setRGB(0.86, 0.82, 0.84); }
    kw.root.position.copy(KILOWOG_SPOT);
    kw.root.rotation.y = 0; // facing the range
    this.oa.scene.add(kw.root);
    const anim = (this.kwAnim = new Animator(kw));
    const loco = (this.kwLoco = new Locomotion(this.mocap));
    loco.scale = kw.hipsHeight / this.mocap.hipsHeight;
    anim.play(loco, 0);
    anim.armSpread = gl ? 0.17 : 0; // his hands would rest inside the thigh armour
    anim.look.maxYaw = 0.6; // a short neck: keep head turns gentle
    const halHead = this.headOf(this.player.rig);
    anim.lookAt(halHead, 0.6);
    const body = (this.kw = new BodyLanguage(kw, anim, { lookHome: () => halHead }));
    body.stance('hips');
    this.oa.updaters.push((dt) => { this.kwTurn(dt); body.update(dt); anim.update(dt); });
  }

  // Turn to keep Hal in front of him: past about 35° he steps round (the walk at a shuffle).
  kwTurn(dt) {
    const kw = this.kilowog.root, p = this.player.position;
    const want = Math.atan2(p.x - kw.position.x, p.z - kw.position.z), diff = wrap(want - kw.rotation.y);
    const d = Math.hypot(p.x - kw.position.x, p.z - kw.position.z);
    if (!this.kwTurning && Math.abs(diff) > 0.62 && d > 2 && d < 36) this.kwTurning = true;
    if (this.kwTurning && Math.abs(diff) < 0.08) this.kwTurning = false;
    if (this.kwTurning) kw.rotation.y = wrap(kw.rotation.y + Math.sign(diff) * Math.min(Math.abs(diff), 1.1 * dt));
    this.kwLoco.speed = damp(this.kwLoco.speed, this.kwTurning ? 0.5 : 0, 6, dt);
  }

  // A line of Kilowog's, performed: beats of the head throughout, and gestures cued to words
  // (from the voice's word boundaries, or the line's pace when the voice is silent).
  async kwSay(key, cues = [], extra = {}) {
    const text = LINES[key].text.toLowerCase(), body = this.kw;
    const at = cues.map(([word, name]) => ({ i: Math.max(0, text.indexOf(word.toLowerCase())), name, done: false }));
    const fire = (c) => {
      if (c.done) return;
      c.done = true;
      if (typeof c.name === 'function') c.name(); else body.play(c.name);
    };
    let heard = false, t = 0;
    const stop = onFrame((dt) => { t += dt; if (!heard) for (const c of at) if (t >= 0.15 + c.i / 14) fire(c); });
    body.talk(true);
    try {
      await this.say(key, { ...extra, onWord: (ci) => { heard = true; for (const c of at) if (ci >= c.i) fire(c); } });
    } finally {
      stop();
      body.talk(false);
    }
  }
  kwBark(key, cues) { return this.kwSay(key, cues, { skip: false }); }

  // Kilowog points: at a world point (or function), for a while.
  kwPoint(target, hold = 1.8) { return () => this.kw.pointAt(target, hold); }

  // A construct pattern Kilowog teaches: unlocked now and in the save.
  learn(id, announce = true) {
    this.powers.unlocked.add(id);
    this.save.update((d) => (d.unlocks = [...new Set([...(d.unlocks ?? []), id])]));
    if (announce) { this.ringSay('ringGatling'); this.audio.ringChime(); }
  }

  kick(n, title, html) { this.hud.tutorial({ kicker: KICKER, n, of: 3, title, html }); }

  // Cameras for Kilowog's lines: a close shot from his front left, and a two-shot over Hal's
  // right shoulder.
  kwClose(duration = 1.6) {
    const head = this.kilowog.bonePosition('head', V(0, 0, 0)), yaw = this.kilowog.root.rotation.y;
    const off = V(-1.6, -0.25, 3.6).applyAxisAngle(V(0, 1, 0), yaw);
    return this.director.move(head.clone().add(off), head.clone().add(V(0, -0.15, 0)), duration, ease.inOut, 38);
  }
  twoShot(duration = 1.8) {
    const c = this.player.position.clone(), head = this.kilowog.bonePosition('head', V(0, 0, 0));
    const back = c.clone().sub(head).setY(0).normalize(), right = V(back.z, 0, -back.x);
    const halHead = c.clone().setY(c.y + 1.7);
    return this.director.move(c.clone().addScaledVector(back, 4).addScaledVector(right, 1.3).setY(c.y + 2.1), halHead.lerp(head, 0.45), duration, ease.inOut, 48);
  }
  // a point out over the range, in front of Kilowog
  overRange(x = 6, y = 2.5, z = 14) { return KILOWOG_SPOT.clone().add(V(x, y, z)); }

  // Kilowog's commentary while you fight: now and then, never on top of himself.
  quip(key, chance = 1, cues = []) {
    const now = performance.now();
    if (this.quipping || now - (this.lastQuip ?? 0) < 6000 || Math.random() > chance) return;
    this.quipping = true;
    this.lastQuip = now;
    this.kwBark(key, cues).finally(() => (this.quipping = false));
  }

  onKill() {
    if (!this.drilling) return;
    const k = Math.floor(Math.random() * 3);
    this.quip(['kwKill1', 'kwKill2', 'kwKill3'][k], 0.45, [['', k === 2 ? 'beckon' : 'pump']]);
  }

  onPlayerHit() {
    if (!this.drilling) return;
    if (!this.warnedShield) { this.warnedShield = true; this.quip('kwShield', 1, [['shield', 'fist']]); }
    else if (this.powers.health < 45) this.quip('kwCover', 0.6, [['behind', 'sweep']]);
  }

  // A wave: drones rise from the pads in turn. Resolves when all are down.
  async wave(kind, count, gap = 0.6) {
    const pads = [...PADS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const p = pads[i % pads.length];
      this.swarm.spawn(V(p.x, kind === 'target' ? 2.4 + (i % 2) * 0.8 : 3.5, p.z), kind);
      await wait(gap);
    }
    await waitFor(() => this.swarm.alive.length === 0);
  }

  // ---------------------------------------------------------------- 1. the summons (the lake)
  async summons() {
    const { ui, director, player, powers, audio } = this;
    this.takeControl();
    const c = player.position.clone();
    // by Abin Sur's body, from the side: the two of them, the wreck and the lake behind
    const abinHead = ABIN_SPOT.clone().add(V(0, 0.7, 0));
    const fwd = V(Math.sin(player.yaw), 0, Math.cos(player.yaw)), right = V(fwd.z, 0, -fwd.x);
    const mid = c.clone().lerp(ABIN_SPOT, 0.5);
    player.lookAt(abinHead, 0.8);
    director.cut(mid.clone().addScaledVector(right, -3.6).add(V(0, 1.5, 0)), mid.clone().add(V(0, 0.95, 0)), 44);
    await ui.fade(0, 2);
    director.move(mid.clone().addScaledVector(right, -3.1).add(V(0, 1.4, 0)), mid.clone().add(V(0, 1.0, 0)), 6, ease.inOut, 42);
    await wait(0.8);
    audio.ringChime();
    this.ringGlow = 5;
    this.ringSay('ringSummons');
    await wait(2.6);
    // the Guardians speak through the ring; he raises it to look
    const sh = new THREE.Vector3(), rig = player.rig;
    // the fist comes up in front of his right shoulder, ring toward his eyes
    const halRight = V(-fwd.z, 0, fwd.x);
    player.animator.reach('R', () => { rig.bonePosition('chest', sh); return sh.addScaledVector(fwd, 0.4).addScaledVector(halRight, 0.16).add(V(0, 0.2, 0)); }, { pole: V(-0.7, -0.7, -0.1), rate: 4 });
    player.lookAt(() => this.ring.getWorldPosition(sh), 0.9);
    const head = c.clone().add(V(0, 1.65, 0));
    director.move(head.clone().addScaledVector(fwd, 1.6).addScaledVector(right, -0.5).add(V(0, -0.1, 0)), head.clone().add(V(0, -0.15, 0)), 2.2, ease.inOut, 36);
    const shimmer = audio.pad([196, 293.7, 392], 0, { cutoff: 1200, fadeIn: 1.5 });
    shimmer.level(0.04, 2);
    await this.lines('guardian1', 'guardian2');
    shimmer.stop(3);
    player.animator.reach('R', null);
    player.lookAt(null);
    await this.say('halWhere');
    this.ringSay('ringCourse');
    await wait(1.2);
    // one last look at Abin Sur, over Hal's shoulder
    player.lookAt(abinHead, 0.9);
    director.move(c.clone().addScaledVector(fwd, -1.5).addScaledVector(right, -0.55).add(V(0, 1.8, 0)), abinHead.clone().add(V(0, 0.1, 0)), 2.4, ease.inOut, 40);
    await this.say('halAbin', { hold: 1.2 });
    player.lookAt(null);
    this.ringGlow = 0.6;
    // up into the sky
    this.travel = 'oa';
    this.giveControl('Fly up into the night sky');
    this.hud.tutorial({ kicker: 'Hyperspace', n: 1, of: 1, title: 'Leave Earth', html: 'Double-tap <kbd>Space</kbd> to fly, then climb high above the trees.<br>High enough, press <kbd>E</kbd> to make the jump.' });
    powers.markerTarget = { pos: V(0, 60, -40), label: 'Climb' };
    await waitFor(() => this.travelReady());
    powers.markerTarget = null;
    this.hud.tutorialDone();
    this.ringSay('ringClimb');
    await new Promise((resolve) => (this.onJump = resolve));
    this.hud.tutorial(null);
  }

  // ---------------------------------------------------------------- 2. the voyage
  async flyToOa() {
    const resumed = !this.site || this.current !== this.site;
    this.travel = null;
    this.pocketLantern();
    await voyage(this, { from: 'earth', to: 'oa', long: true, launch: !resumed });
  }

  // ---------------------------------------------------------------- 3. Oa: the arrival and the targets
  async targets() {
    const { ui, director, player, powers, swarm } = this;
    this.takeControl();
    this.setupOa();
    this.travel = null;
    const fromSpace = this.engine.gradeUniforms.uFlash.value > 0.5;
    this.enterOa();
    if (!fromSpace) { director.cut(V(8, 5, 10), V(BATTERY.x * 0.2, 40, BATTERY.z * 0.2), 48); await ui.fade(0, 1.6); }
    await this.descendToRange(fromSpace);
    this.ringSay('ringOa');
    const kwHead = this.kilowog.bonePosition('head', V(0, 0, 0));
    player.lookAt(kwHead, 0.9);
    await this.twoShot(2.2);
    await this.kwClose(1.4);
    await this.kwSay('kwIntro1', [['so', 'open'], ['human', () => this.kwAnim.gesture('shake', 0.9, 0.6)]]);
    await this.twoShot(1.2);
    await this.say('halIntro');
    await this.kwClose(1.2);
    await this.kwSay('kwIntro2', [['kilowog', 'chest'], ['every rookie', 'sweep'], ['wash', 'dismiss'], ['poozer', this.kwPoint(() => this.headOf(player.rig)(), 1.6)]]);
    await this.twoShot(1.2);
    player.animator.gesture('shake', 1.0, 0.5);
    await this.say('halPoozer');
    this.kwAnim.gesture('nod', 1, 0.7);
    await this.kwSay('kwIntro3', [['new', 'shrug'], ['mine', 'chest'], ['targets', this.kwPoint(this.overRange(), 1.8)], ['break', 'fist']]);
    player.lookAt(null);
    this.giveControl('Destroy the target drones');
    this.kick(1, 'Targets', 'Five drones are rising from the pads. Open the wheel (<kbd>4</kbd>), choose the <b>Fist</b> and <kbd>Click</kbd> to strike.<br><span class="dim">Aim near a drone and the reticle locks on. The battery recharges your ring here.</span>');
    await this.wave('target', 5, 0.35);
    this.hud.tutorialDone();
    await wait(1.2);
    await this.kwBark('kwTargetsDone', [['hmph', () => this.kwAnim.gesture('shake', 0.8, 0.5)], ['fight', 'dismiss']]);
    swarm.clear();
    powers.holster();
  }

  // Down onto the range out of the sky: a streak of green over the city, slowing over the deck, and
  // the hard landing in front of Kilowog, who watches him come in.
  async descendToRange(fromSpace) {
    const { player, director, audio, engine, powers } = this;
    const grade = engine.gradeUniforms;
    const land = HAL_START.clone(), from = V(46, 150, 120);
    this.playerActive = false;
    player.autoAnim = false;
    player.flightState.k = 1;
    player.animator.play(player.flightGen, 0);
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object;
    // over Kilowog's shoulder on his podium, looking up the sky Hal falls out of
    director.cut(V(1.5, 3.7, -38.6), from.clone().lerp(land, 0.3), 50);
    if (fromSpace) tween(0.8, (k) => (grade.uFlash.value = 1 - k), ease.out);
    const trail = createShaft({ from, to: from.clone().add(V(0, -1, 0)), radiusFrom: 0.05, radiusTo: 0.6, color: new THREE.Color(0.4, 2.4, 1.0) });
    this.oa.scene.add(trail);
    trail.quaternion.setFromUnitVectors(V(0, -1, 0), land.clone().sub(from).normalize());
    trail.userData.uniforms.uOpacity.value = 2.2;
    audio.whoosh(2.6, 0.6);
    const dir = land.clone().sub(from).normalize(), yaw = Math.atan2(dir.x, dir.z), turn = wrap(Math.PI - yaw), look = new THREE.Vector3();
    await tween(2.4, (k) => {
      const e = ease.out(k);
      o.position.lerpVectors(from, land, e);
      o.position.y += Math.sin(k * Math.PI) * 4;
      // head first along the dive, swinging feet first for the touch-down
      const pitch = THREE.MathUtils.lerp(2.2, 0, ease.inOut(Math.max(0, (k - 0.55) / 0.45)));
      o.rotation.set(0, yaw + turn * ease.inOut(k), 0);
      player.pivot.quaternion.setFromAxisAngle(V(1, 0, 0), pitch);
      trail.scale.y = from.distanceTo(o.position) * 0.98;
      look.copy(o.position).y += 1;
      director.look.lerp(look, 0.25);
    }, ease.linear);
    trail.removeFromParent();
    trail.geometry.dispose();
    trail.material.dispose();
    animStop();
    player.pivot.quaternion.identity();
    player.place(land, Math.PI);
    this.playerActive = true;
    player.animator.play(still(POSES.land, 0.6), 0.08);
    powers.landFx(14, false);
    this.kwAnim.gesture('chin', 1.4, 0.8);
    await wait(1.3);
    player.autoAnim = true;
    player.animator.play(player.loco, 0.8);
    await wait(0.6);
  }

  // ---------------------------------------------------------------- 4. live fire
  async liveFire() {
    const { director, player, powers, swarm } = this;
    this.takeControl();
    const kwHead = this.kilowog.bonePosition('head', V(0, 0, 0)), c = player.position.clone();
    player.turnTo(Math.atan2(kwHead.x - c.x, kwHead.z - c.z));
    player.lookAt(kwHead, 0.9);
    await this.kwClose(2.2);
    await this.kwSay('kwFire1', [['fists', 'fist'], ['bar', 'dismiss'], ['out there', this.kwPoint(this.overRange(-8, 9, 20), 1.6)], ['punched', () => this.kwAnim.gesture('shake', 0.8, 0.4)]]);
    await this.kwSay('kwFire2', [['reach', 'open'], ['cannon', 'shrug'], ['if you can see', 'temple'], ['the ring', 'fist']]);
    await this.twoShot(1.6);
    await this.say('halCannon');
    this.learn('gatling');
    player.lookAt(null);
    this.giveControl('Survive the live-fire drill');
    this.kick(2, 'Gatling', 'Open the wheel and choose the <b>Gatling</b>. <b>Hold</b> <kbd>Click</kbd>: the barrels spin up, then it fires where you aim.');
    await Promise.race([waitFor(() => powers.selected === 'gatling' && !powers.wheelState), wait(30)]);
    this.kick(3, 'Live fire', 'These drones shoot back. Watch for the red aim line, then block with the <b>Shield</b>, duck behind a pillar, raise a <b>Wall</b> or keep moving.<br><span class="dim">Fly with <kbd>Space</kbd> ×2 to get above them.</span>');
    this.drilling = true;
    await this.kwBark('kwLive', [['live', this.kwPoint(this.overRange(0, 3, 22), 1.4)], ['bite', 'fist']]);
    await this.wave('attacker', 3, 0.8);
    await wait(1.5);
    await this.kwBark('kwWave', [['again', 'beckon']]);
    await this.wave('attacker', 5, 0.7);
    this.drilling = false;
    this.hud.tutorialDone();
    await wait(1.4);
    this.hud.tutorial(null);
    await this.kwBark('kwDone', [['not bad', () => this.kwAnim.gesture('nod', 1, 0.6)], ['poozer', 'shrug']]);
    await this.bark('halTake');
    swarm.clear();
  }

  // ---------------------------------------------------------------- 5. the open range
  async openRange() {
    const { ui } = this;
    await wait(0.5);
    if (!this.save.load().reached.includes('earth') && !this.rangeCard) {
      this.rangeCard = true;
      const pick = await ui.screen({
        emblem: true,
        kicker: 'Part Two · The Corps',
        title: 'KILOWOG’S RANGE',
        subtitle: 'To be continued',
        body: 'Hal has learned to fight back. Sinestro has been watching from the edge of the range, and he has his own lessons in mind.\n\nUntil then the range is open, and the ring knows the way home.',
        buttons: ['Keep training', 'Quit to title'],
      });
      if (pick === 1) { location.hash = ''; location.reload(); return; }
    }
    this.giveControl('Train on the range');
    const fresh = !this.save.load().worlds.includes('earth');
    this.chartWorlds(['earth', 'oa']);
    this.travel = 'chart';
    await this.kwBark('kwRange', [['the range', 'sweep'], ['come see me', 'beckon']]);
    if (fresh) {
      await wait(0.6);
      await this.kwBark('kwEarth', [['poozer', 'open'], ['the ring', this.kwPoint(V(20, 80, 30), 1.6)]]);
      this.ringSay('ringRoutes');
    }
    this.addDrillStart();
    await new Promise(() => {}); // the range stays open until the player quits from the pause menu
  }

  // Kilowog starts another round when asked.
  addDrillStart() {
    if (this.drillSpot) return;
    const it = (this.drillSpot = this.oa.interact({ position: KILOWOG_SPOT.clone().setY(0).add(V(0, 0, 4.6)), radius: 2.2, look: KILOWOG_SPOT.clone().add(V(0, 2.1, 0)), label: 'Ask Kilowog for another round', action: async () => {
      it.enabled = false;
      this.kwAnim.gesture('nod', 1, 0.6);
      await this.kwBark('kwWave', [['again', 'beckon']]);
      this.drilling = true;
      await this.wave('attacker', 4 + Math.floor(Math.random() * 3), 0.7);
      this.drilling = false;
      this.quip('kwDone', 1, [['poozer', 'shrug']]);
      it.enabled = true;
    } }));
  }

  // ---------------------------------------------------------------- 6. home: back on Earth
  async home() {
    this.travel = 'chart';
    this.giveControl('Home: Sector 2814');
    await new Promise(() => {}); // free roam; the star map goes back to Oa
  }

  // ---------------------------------------------------------------- hyperspace travel
  chartWorlds(ids) {
    this.save.update((d) => (d.worlds = [...new Set([...(d.worlds ?? []), ...ids])]));
  }

  // Flying high enough for the ring to make the jump.
  travelReady() {
    const { player, powers } = this;
    if (!this.travel || !player.control || !player.flying || this.busy || powers.wheelState || this.chart.isOpen || this.drilling || this.lanternMoving) return false;
    return player.position.y > JUMP_HEIGHT[this.world];
  }

  updateInteractions() {
    const ready = this.travelReady();
    if (ready !== this.jumpPrompt) {
      this.jumpPrompt = ready;
      this.ui.prompt(ready ? 'E' : null, ready ? (this.travel === 'oa' ? 'Make the jump to Oa' : 'Enter hyperspace') : null);
    }
    if (ready) {
      if (this.input.hit('KeyE')) {
        this.input.consume('KeyE'); // or the star map would take this press as its confirm
        this.jumpPrompt = false;
        this.ui.prompt();
        if (this.travel === 'oa') { this.onJump?.(); this.onJump = null; } else this.openChart();
      }
      return;
    }
    if (this.travel && this.player.control && this.player.flying && !this.busy && this.input.hit('KeyE')) this.ringSay('ringHigher');
    super.updateInteractions();
  }

  async openChart() {
    const { powers, player } = this;
    this.busy = true;
    powers.freeze = true;
    player.inputBlocked = true;
    const id = await this.chart.open({ charted: [...new Set(['earth', 'oa', ...allWorlds()])], here: this.world });
    powers.freeze = false;
    player.inputBlocked = false;
    this.busy = false;
    if (id) await this.travelTo(id);
  }

  async pause() {
    this.chart.close(null);
    return super.pause();
  }

  // A trip between charted worlds: the short voyage, then Hal arrives in flight above the place.
  async travelTo(id) {
    const from = this.world;
    this.busy = true;
    if (!this.lanternStowed) this.pocketLantern();
    try {
      await voyage(this, { from, to: id });
      if (id === 'oa') await this.arriveOa(); else await this.arriveEarth();
    } finally {
      this.busy = false;
    }
  }

  // Into a scene from space, flying: a flash clears on Hal coming down out of the sky.
  async arriveFlying(at, yaw, vel) {
    const { player, engine } = this;
    player.spawn(this.current.physics, this.current.scene, at, yaw);
    player.airborne(vel);
    player.autoAnim = true;
    player.camYaw = yaw + Math.PI;
    player.camPitch = 0.3;
    this.director.mode = 'follow';
    this.ui.cinematic(false);
    tween(0.9, (k) => (engine.gradeUniforms.uFlash.value = 1 - k), ease.out);
    this.audio.arrive();
  }

  async arriveOa() {
    this.setupOa();
    this.enterOa();
    this.addDrillStart();
    await this.arriveFlying(V(18, 70, 46), Math.PI + 0.35, V(-3, -6, -10));
    this.checkpoint('range');
    this.ui.clock(this.save.info('range').clock);
    this.giveControl('Train on the range');
    await wait(2.5);
    this.quip('kwBack', 1, [['back', 'beckon']]);
  }

  async arriveEarth() {
    if (!this.site) this.setupCrash({ body: false }); else this.enterCrash();
    this.world = 'earth';
    const first = !!this.abin;
    this.removeAbin();
    this.lanternSpots(this.site);
    await this.arriveFlying(V(-14, 48, 34), Math.PI * 0.85, V(2, -5, -7));
    this.checkpoint('earth');
    this.ui.clock(this.save.info('earth').clock);
    this.giveControl('Home: Sector 2814');
    await wait(1.8);
    this.bark('halHome');
    if (first || !this.toldAbin) { this.toldAbin = true; await wait(3); this.ringSay('ringAbin'); }
  }
}
