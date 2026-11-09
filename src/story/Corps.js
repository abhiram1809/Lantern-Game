import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame, damp } from '../engine/Time.js';
import { CorpsSave, CoastSave, allWorlds } from '../engine/Save.js';
import { Story } from './Story.js';
import { voyage } from './Voyage.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { POSES, still, makePose } from '../characters/Poses.js';
import { createAbinSur, createKilowog, createRing } from '../characters/Characters.js';
import { createGuardian } from '../characters/Guardian.js';
import { createShaft } from '../fx/GreenLight.js';
import { Oa, KILOWOG_SPOT, HAL_START, PADS, RANGE_RADIUS, BATTERY } from '../scenes/Oa.js';
import { HALL, HALL_PILLARS, BIER, DAIS_TOP } from '../scenes/Hall.js';
import { Particles } from '../fx/Particles.js';
import { ABIN_SPOT, ARRIVAL, terrainHeight } from '../scenes/CrashSite.js';
import { DroneSwarm } from '../enemies/Drones.js';
import { Sinestro } from '../enemies/Sinestro.js';
import { TravelHud, StarMap } from '../ui/TravelHud.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KICKER = 'Kilowog’s range';
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// how high Hal must fly before the ring will make the jump
const JUMP_HEIGHT = { earth: 26, oa: 30 };
// where Sinestro comes down, on Hal's right as he faces Kilowog's podium
const SIN_SPOT = V(5.2, 0, -25.4);
// Abin Sur lying in state: on his back, arms at his sides
const LAID_OUT = makePose({ aL: [0.1, -1, -0.04], aR: [-0.1, -1, -0.04], eL: 0.12, eR: 0.12, fL: 0.35, fR: 0.35, kx: -0.04 });
// in the Guardians' hall: Sinestro beside the bier, facing the dais
const SIN_HALL = V(HALL.x + 2.6, HALL.y, BIER.z + 1.1);

// Part Two, "The Corps". At the lake the Guardians summon Hal; he climbs out of the sky and the ring
// carries him across the universe to Oa (Voyage.js), down onto Kilowog's range. There: target drones
// for the fist, then the gatling and a live-fire drill against drones that shoot back; then
// Sinestro arrives, teaches the sword and spars with Hal (enemies/Sinestro.js); then the Guardians
// call him to their hall (scenes/Hall.js), lay Abin Sur to rest and give him Sector 2814, and he
// flies home, in through his bedroom window before dawn. After that the range is open, with
// hyperspace routes charted between Oa and Earth (the star map, E high in flight).
// Everything else (powers, the lantern, pause, dialogue, collapse) comes from Story.
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
      sinestro: () => this.sinestroArrives(),
      duel: () => this.duel(),
      guardians: () => this.guardiansCall(),
      homeward: () => this.homeward(),
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
    if (['duel', 'guardians', 'homeward', 'range'].includes(id)) this.learn('sword', false);
    if (id === 'duel') this.addSinestro().place(SIN_SPOT, -2.2);
    if (id === 'homeward') {
      // standing on the dais, the hall empty now
      this.enterOa(V(HALL.x, DAIS_TOP, HALL.z), Math.PI);
      this.addGuardians();
      this.hallActive = true;
      const sin = this.addSinestro();
      sin.place(SIN_HALL, Math.atan2(HALL.x - SIN_HALL.x, HALL.z - SIN_HALL.z));
      player.camYaw = 0;
      player.camPitch = 0.2;
      this.director.mode = 'follow';
      await ui.fade(0, 1.2);
      return;
    }
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
      floor: (x, z) => oa.floor(x, z), center: V(-30, 0, -70), radius: 200, ceiling: 120,
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

  // A line of Kilowog's, performed (Story.perform): head beats, gestures cued to its words.
  kwSay(key, cues = [], extra = {}) { return this.perform(this.kw, key, cues, extra); }
  kwBark(key, cues) { return this.kwSay(key, cues, { skip: false }); }
  sinSay(key, cues, extra) { return this.perform(this.sin.bl, key, cues, extra); }

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
  twoShot(duration = 1.8, other = this.kilowog) {
    const c = this.player.position.clone(), head = other.bonePosition('head', V(0, 0, 0));
    const back = c.clone().sub(head).setY(0).normalize(), right = V(back.z, 0, -back.x);
    const halHead = c.clone().setY(c.y + 1.7);
    return this.director.move(c.clone().addScaledVector(back, 4).addScaledVector(right, 1.3).setY(c.y + 2.1), halHead.lerp(head, 0.45), duration, ease.inOut, 48);
  }
  // a point out over the range, in front of Kilowog
  overRange(x = 6, y = 2.5, z = 14) { return KILOWOG_SPOT.clone().add(V(x, y, z)); }

  // Kilowog's commentary while you fight: now and then, never on top of himself.
  // (Sinestro's too, during the sparring: pass his body language)
  quip(key, chance = 1, cues = [], body = this.kw) {
    const now = performance.now();
    if (this.quipping || now - (this.lastQuip ?? 0) < 6000 || Math.random() > chance) return;
    this.quipping = true;
    this.lastQuip = now;
    this.perform(body, key, cues, { skip: false }).finally(() => (this.quipping = false));
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

  // ---------------------------------------------------------------- 5. Sinestro
  // Sinestro of Korugar, built once; he stands (or fights) on the range.
  addSinestro() {
    if (this.sin) return this.sin;
    const { oa, powers, player, audio, director } = this;
    const sin = (this.sin = new Sinestro({ scene: oa.scene, physics: oa.physics, powers, player, audio, director, mocap: this.mocap, abin: this.assets.characters.abin, ring: createRing(), attachRing: (r, rig) => this.attachRing(r, rig), arena: RANGE_RADIUS, blocks: oa.blocks }));
    oa.updaters.push((dt, t) => sin.update(dt, t));
    sin.onQuip = (kind) => {
      if (kind === 'parried') this.quip('sinParry', 1, [['quick', () => sin.anim.gesture('nod', 0.7, 0.4)]], sin.bl);
      else if (kind === 'slam') this.quip('sinSlam', 0.7, [], sin.bl);
      else if (kind === 'hurt') this.quip('sinHurt', 0.5, [], sin.bl);
    };
    sin.onHurtHal = () => this.quip(this.powers.shield ? 'sinQ1' : ['sinQ1', 'sinQ2', 'sinQ3'][Math.floor(Math.random() * 3)], 0.4, [], sin.bl);
    return sin;
  }

  // He comes down out of the sky beside Kilowog's podium, sizes Hal up, and teaches the sword.
  async sinestroArrives() {
    const { director, player, audio } = this;
    this.takeControl();
    this.swarm.clear();
    const sin = this.addSinestro();
    const from = V(46, 48, 8), land = SIN_SPOT.clone(), yaw = Math.atan2(player.position.x - land.x, player.position.z - land.z);
    sin.place(from, yaw);
    sin.anim.play(sin.flyGen, 0);
    sin.flyState.k = 0.6;
    const halHead = player.position.clone().setY(1.7);
    player.lookAt(() => sin.rig.bonePosition('head', _sh), 0.8);
    this.kwAnim.lookAt(() => sin.rig.bonePosition('head', _sh), 0.6);
    // from behind Hal, the streak coming in over the deck
    director.cut(player.position.clone().add(V(-1.6, 1.9, 3.2)), land.clone().lerp(from, 0.4).setY(6), 46);
    audio.whoosh(2.4, 0.5);
    const look = new THREE.Vector3();
    await tween(2.6, (k) => {
      const e = 1 - (1 - k) ** 3;
      sin.object.position.lerpVectors(from, land, e).y += Math.sin(k * Math.PI) * 3;
      sin.place(sin.object.position, yaw);
      sin.flyState.k = 0.6 * (1 - k);
      look.copy(sin.object.position).y += 1.2;
      director.look.lerp(look, 0.2);
    }, ease.linear);
    sin.anim.play(sin.standGen, 0.7);
    audio.land(0.4);
    this.powers.dustFx(land, 12, 1);
    await wait(0.6);
    await this.kwSay('kwSinestro', [['sinestro', () => this.kwAnim.gesture('nod', 0.9, 0.6)]]);
    const sinHead = () => sin.rig.bonePosition('head', _sh2);
    const close = (dur, side = 1) => { const h = sinHead().clone(), f = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), r = V(f.z, 0, -f.x); return director.move(h.clone().addScaledVector(f, 2.2).addScaledVector(r, 0.8 * side).add(V(0, -0.15, 0)), h.clone().add(V(0, -0.1, 0)), dur, ease.inOut, 36); };
    await close(1.4);
    await this.sinSay('sin1', [['so', () => sin.anim.gesture('chin', 1.2, 0.6)]]);
    await this.sinSay('sin2', [['friend', () => sin.anim.gesture('beat', 0.5, 0.6)], ['brawler', 'dismiss']]);
    await this.twoShot(1.2, sin.rig);
    player.animator.gesture('tilt', 0.9, 0.5);
    await this.say('halSin');
    await close(1.2, -1);
    await this.sinSay('sin3', [['crude', () => sin.anim.gesture('shake', 0.8, 0.4)], ['watch', 'ring']]);
    // the demonstration: a blade from nothing, a cut through the air, gone again
    await sin.demo();
    this.learn('sword', false);
    this.ringSay('ringSword');
    audio.ringChime();
    await this.sinSay('sin4', [['cut', 'present']]);
    player.lookAt(null);
    this.giveControl('Cut down the target drones');
    this.hud.tutorial({ kicker: 'Sinestro', n: 1, of: 2, title: 'Sword', html: 'Open the wheel (<kbd>4</kbd>) and choose the <b>Sword</b>. <kbd>Click</kbd> to cut; click again in rhythm for a three-cut combo, the last one heavy.<br><span class="dim">Aim at a drone and the first cut lunges at it.</span>' });
    await this.wave('target', 4, 0.35);
    this.hud.tutorialDone();
    await wait(1.0);
    await this.sinSay('sinDrones', [['now', 'present']], { skip: false });
    this.hud.tutorial(null);
    this.swarm.clear();
  }

  // ---------------------------------------------------------------- 6. the sparring
  async duel() {
    const { player, hud, powers } = this;
    const sin = this.addSinestro();
    this.takeControl();
    player.lookAt(() => sin.rig.bonePosition('head', _sh), 0.8);
    await this.twoShot(1.6, sin.rig);
    await this.sinSay('sinDuel', [['defend', () => sin.anim.gesture('chin', 1, 0.6)]]);
    player.lookAt(null);
    powers.setCharge(100);
    powers.health = powers.maxHealth;
    sin.tg.health = sin.tg.maxHealth;
    sin.engage();
    this.giveControl('Spar with Sinestro');
    hud.tutorial({ kicker: 'Sinestro', n: 2, of: 2, title: 'Sparring', html: 'Read his tells. A <b>raised blade</b>: he lunges; block with the <b>Shield</b>, or cut into it with the <b>Sword</b> to parry. <b>Spikes</b> forming: a volley. A <b>ring</b> on the ground: get out from under it.<br><span class="dim">He guards against the gatling. Bring him to the mark and he will call it.</span>' });
    hud.boss('Sinestro', 1, 0.35);
    const bar = onFrame(() => hud.boss('Sinestro', sin.health, 0.35));
    await new Promise((resolve) => (sin.onYield = resolve));
    bar();
    hud.boss(null);
    hud.tutorialDone();
    await wait(0.8);
    hud.tutorial(null);
    this.takeControl();
    powers.holster();
    if (player.flying) player.stopFlying(true);
    await wait(1.4);
    sin.disengage();
    const p = sin.object.position;
    sin.place(V(p.x, 0, p.z), sin.yaw);
    player.lookAt(() => sin.rig.bonePosition('head', _sh), 0.8);
    const c = player.position.clone(), toSin = V(p.x - c.x, 0, p.z - c.z);
    if (toSin.length() > 4) player.walkTo(V(p.x, 0, p.z).addScaledVector(toSin.normalize(), -2.6), player.walkSpeed);
    this.twoShot(1.6, sin.rig);
    await this.sinSay('sinEnd1', [['enough', 'dismiss']]);
    await this.twoShot(1.4, sin.rig);
    await this.sinSay('sinEnd2', [['lose', () => sin.anim.gesture('chin', 1, 0.5)]]);
    await this.say('halFearless');
    await this.sinSay('sinEnd3', [['wise', 'present']]);
    // he leaves the way he came
    sin.anim.play(sin.flyGen, 0.4);
    this.audio.whoosh(2, 0.5);
    const from = sin.object.position.clone();
    tween(2.2, (k) => { sin.place(from.clone().add(V(-8 * k * k, 40 * k * k, -30 * k * k)), sin.yaw); sin.flyState.k = k; }, ease.linear).then(() => (sin.object.visible = false));
    await wait(1.0);
    await this.kwClose(1.2);
    await this.kwSay('kwLikes', [['poozer', 'shrug']]);
    player.lookAt(null);
  }

  // ---------------------------------------------------------------- 7. the Guardians
  // Seven of them, one on each pillar of their hall, the eldest in the middle. Built when first
  // needed (each is the scan, its robe and its hair); they only move while Hal is at the hall.
  addGuardians() {
    if (this.guardians) return this.guardians;
    const { oa } = this, halHead = this.headOf(this.player.rig);
    this.guardians = HALL_PILLARS.map((p, i) => {
      const g = createGuardian(this.assets.characters.abin, this.mocap, { seed: i === 3 ? 0 : i + 1, hairCount: i === 3 ? 2200 : 1500 });
      g.root.position.set(p.x, p.top, p.z);
      g.root.rotation.y = p.yaw;
      oa.scene.add(g.root);
      g.anim.lookAt(halHead, 0.45);
      return g;
    });
    this.elder = this.guardians[3];
    oa.updaters.push((dt) => {
      if (!this.hallActive) return;
      for (const g of this.guardians) { g.bl.update(dt); g.anim.update(dt); }
    });
    return this.guardians;
  }

  // Abin Sur on his bier of light, carried home from Earth.
  addBier() {
    if (this.bierAbin) return this.bierAbin;
    const abin = (this.bierAbin = createAbinSur(this.assets.characters.abin));
    abin.u.uGlow.value = 0.05;
    abin.u.uTint.value.setScalar(0.85);
    const anim = new Animator(abin);
    anim.play(still(LAID_OUT, 0), 0);
    anim.update(0.016);
    // on his back across the slab, head to the west
    const holder = (this.bierHolder = new THREE.Group());
    holder.position.set(BIER.x, this.oa.hall.slabTop, BIER.z);
    holder.rotation.y = Math.PI / 2;
    abin.root.rotation.x = -Math.PI / 2;
    abin.root.position.set(0, 0.13, 0.98);
    holder.add(abin.root);
    this.oa.scene.add(holder);
    this.oa.updaters.push((dt) => { if (this.hallActive && abin.root.visible) anim.update(dt); });
    return abin;
  }

  // A Guardian's line: the speaker's head and hands keep time, the others still.
  gSay(key, g = this.elder, cues = []) { return this.perform(g.bl, key, cues); }

  // Up at a Guardian on his pillar, from a little below and in front.
  gClose(g = this.elder, duration = 1.6, side = 0, fov = 27) {
    const h = g.bonePosition('head', V(0, 0, 0)).add(V(0, 0.08, 0)), yaw = g.root.rotation.y;
    const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 1.9).addScaledVector(r, side).add(V(0, -0.45, 0)), h.clone().add(V(0, -0.06, 0)), duration, ease.inOut, fov);
  }
  // Hal on the dais, looking up, from in front and below his eyeline
  halUp(duration = 1.4, side = 0.5) {
    const c = this.player.position, h = V(c.x, c.y + 1.66, c.z);
    return this.director.move(h.clone().add(V(side, -0.35, -1.7)), h.clone().add(V(0, 0.08, 0)), duration, ease.inOut, 34);
  }
  sinClose(duration = 1.3, side = 1) {
    const sin = this.sin, h = sin.rig.bonePosition('head', V(0, 0, 0)), f = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 2.2).addScaledVector(r, 0.8 * side).add(V(0, -0.15, 0)), h.clone().add(V(0, -0.1, 0)), duration, ease.inOut, 36);
  }

  // Kilowog sends him; he flies to the hall himself; the Guardians are waiting.
  async guardiansCall() {
    const { player, powers, audio } = this;
    this.takeControl();
    this.swarm.clear();
    const sin = this.addSinestro();
    this.addGuardians();
    this.addBier();
    // Sinestro has gone ahead of him: by the bier when Hal comes in
    sin.disengage?.();
    sin.object.visible = true;
    sin.anim.play(sin.standGen, 0);
    sin.place(SIN_HALL, Math.atan2(HALL.x - SIN_HALL.x, HALL.z - SIN_HALL.z));
    const kwHead = this.kilowog.bonePosition('head', V(0, 0, 0));
    player.lookAt(kwHead, 0.9);
    await this.kwClose(1.4);
    await this.kwSay('kwGuardians', [['guardians', () => this.kwAnim.gesture('nod', 0.9, 0.6)], ['hall', this.kwPoint(HALL.clone().add(V(0, 10, 0)), 2.2)], ['look bad', 'dismiss']]);
    player.lookAt(null);
    audio.ringChime();
    this.ringGlow = 4;
    this.ringSay('ringHall');
    this.giveControl('Fly to the Hall of the Guardians');
    powers.markerTarget = { pos: HALL.clone().add(V(0, 3, 0)), label: 'The Guardians' };
    this.hallActive = true;
    await waitFor(() => Math.hypot(player.position.x - HALL.x, player.position.z - HALL.z) < 8 && player.position.y < HALL.y + 14);
    powers.markerTarget = null;
    this.ringGlow = 0.6;
    await this.landInHall();
    await this.council();
  }

  // Onto the dais, facing the pillars: a glide in if he's flying, a walk if he's on his feet.
  async landInHall() {
    const { player, powers } = this;
    this.takeControl();
    powers.holster();
    const land = V(HALL.x, DAIS_TOP, HALL.z);
    if (!player.flying) { await player.walkTo(land, player.walkSpeed); player.turnTo(Math.PI); await wait(0.6); return; }
    this.playerActive = false;
    player.flying = false;
    player.autoAnim = false;
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object, from = o.position.clone(), yaw0 = o.rotation.y;
    this.director.move(land.clone().add(V(3.2, 1.5, 6.5)), land.clone().add(V(0, 1.2, 0)), 2.0, ease.inOut, 46);
    await tween(1.8, (k) => {
      const e = ease.inOut(k);
      o.position.lerpVectors(from, land, e);
      o.position.y += Math.sin(k * Math.PI) * 0.6;
      o.rotation.set(0, yaw0 + wrap(Math.PI - yaw0) * e, 0);
      player.pivot.quaternion.slerp(new THREE.Quaternion(), 0.12);
    }, ease.linear);
    animStop();
    player.pivot.quaternion.identity();
    player.place(land, Math.PI);
    this.playerActive = true;
    player.animator.play(still(POSES.land, 0.6), 0.1);
    powers.landFx(6, true);
    await wait(1.0);
    player.autoAnim = true;
    player.animator.play(player.loco, 0.8);
    await wait(0.5);
  }

  // Before the Guardians: their judgement, Sinestro's objection, Abin Sur laid to rest, Sector 2814.
  async council() {
    const { player, director, audio } = this;
    const elder = this.elder, sin = this.sin, gs = this.guardians;
    const elderHead = () => elder.bonePosition('head', _sh3).add(V(0, 0.08, 0));
    // the hall from behind Hal: the crescent of Guardians, the battery beyond
    director.cut(HALL.clone().add(V(2.6, 2.4, 6.4)), HALL.clone().add(V(0, 6.2, -10)), 48);
    director.move(HALL.clone().add(V(1.8, 2.7, 5.2)), HALL.clone().add(V(0, 6.8, -10)), 7, ease.inOut, 44);
    const choir = audio.pad([98, 146.8, 196, 293.7], 0, { cutoff: 900, fadeIn: 3 });
    choir.level(0.05, 3);
    player.lookAt(elderHead, 0.85);
    sin.bl.lookHome = () => this.headOf(player.rig)();
    await wait(2.2);
    await this.gSay('gHall1');
    await this.gClose(elder, 2.0);
    await this.gSay('gHall2', elder, [['ring', () => elder.anim.gesture('nod', 1, 0.4)]]);
    await this.halUp(1.2);
    await wait(0.4);
    await this.gClose(gs[1], 1.4, 0.4);
    await this.gSay('gHall3', gs[1], [['fear', () => gs[1].anim.gesture('chin', 1.1, 0.5)]]);
    // Sinestro steps in
    await this.sinClose(1.3);
    await this.sinSay('sinHall1', [['earned', () => sin.anim.gesture('chin', 1.2, 0.5)], ['nearest', 'dismiss']]);
    await this.gClose(elder, 1.4, -0.4);
    await this.gSay('gHall4', elder, [['sinestro', () => elder.anim.gesture('shake', 1.1, 0.35)], ['overcome', () => elder.anim.gesture('nod', 1, 0.4)]]);
    await this.halUp(1.2, -0.4);
    player.animator.gesture('beat', 0.5, 0.6);
    await this.say('halHall1');
    await this.gClose(elder, 1.3);
    await this.gSay('gHall5');
    await this.rite();
    // the charge
    await this.gClose(elder, 2.2, 0.2, 28);
    elder.gu.uHandL.value = 1;
    elder.bl.play('decree');
    await this.gSay('gHall6');
    audio.ringChime();
    this.ringGlow = 5;
    this.ringSay('ring2814');
    await wait(1.6);
    setTimeout(() => (elder.gu.uHandL.value = 0), 1200);
    this.ringGlow = 0.6;
    await this.twoShot(1.4, sin.rig);
    await this.sinSay('sinHall2', [['watching', () => sin.anim.gesture('chin', 1, 0.5)]]);
    player.animator.gesture('tilt', 0.8, 0.4);
    await this.say('halHall2');
    choir.stop(4);
    player.lookAt(null);
  }

  // Abin Sur goes into the light: the Guardians lift their hands, his body sweeps away from the feet
  // up, and the light that was him rises from the bier and streams away toward the Central Battery.
  async rite() {
    const { director, audio, oa } = this;
    const abin = this.bierAbin, gs = this.guardians;
    const top = this.oa.hall.slabTop;
    // from the far side of the bier from Sinestro: Abin Sur, the Guardians' hands raised above
    director.cut(BIER.clone().add(V(-3.9, 1.7, 3.3)), BIER.clone().add(V(0, 1.6, -2)), 46);
    await wait(0.6);
    for (const g of gs) { g.gu.uHandL.value = 1; g.bl.play('decree'); }
    setTimeout(() => { for (const g of gs) g.gu.uHandL.value = 0; }, 3600);
    audio.riser(5, 0.35);
    const hum = audio.pad([196, 246.9, 293.7, 392], 0, { cutoff: 1600, fadeIn: 2 });
    hum.level(0.06, 2);
    await wait(1.0);
    const motes = new Particles(1600, { additive: true, drag: 0.15, turbulence: 0.6 });
    oa.scene.add(motes.points);
    const toBattery = BATTERY.clone().sub(BIER).normalize();
    const stopMotes = onFrame((dt, t) => motes.update(dt, t, this.engine.camera, this.engine.renderer));
    abin.u.uDissolveOn.value = 1;
    abin.u.uDissolveSign.value = 1;
    abin.u.uEdgeColor.value.setRGB(0.6, 4, 1.6);
    this.gSay('gRite');
    director.move(BIER.clone().add(V(-2.6, 1.35, 2.5)), BIER.clone().add(V(0, 1.15, 0)), 6, ease.inOut, 42);
    await tween(6, (k) => {
      abin.u.uDissolve.value = -0.05 + k * 1.15;
      // motes rise from where the light is taking him, feet to head
      const front = BIER.x + 0.98 - 1.96 * THREE.MathUtils.clamp((k * 1.15 - 0.15) / 0.75, 0, 1);
      motes.emit(6, (p, v) => {
        p[0] = front + (Math.random() - 0.5) * 0.3; p[1] = top + 0.1 + Math.random() * 0.22; p[2] = BIER.z + (Math.random() - 0.5) * 0.45;
        v[0] = toBattery.x * 0.5 + (Math.random() - 0.5) * 0.3; v[1] = 1.1 + Math.random() * 1.2; v[2] = toBattery.z * 0.5 + (Math.random() - 0.5) * 0.3;
      }, { life: 3.5, size: [0.09, 0.02], color: [[0.7, 3.2, 1.5, 1], [0.15, 1.2, 0.5, 0]] });
    }, ease.linear);
    abin.root.visible = false;
    // the light he was, gathering and going home
    // the stream going away over the pillars toward the battery's glow
    director.move(BIER.clone().add(V(-1.2, 1.8, 6.5)), BIER.clone().add(toBattery.clone().multiplyScalar(40)).setY(top + 14), 4, ease.inOut, 50);
    await tween(4, (k) => {
      motes.emit(10, (p, v) => {
        p[0] = BIER.x + (Math.random() - 0.5) * 1.6; p[1] = top + Math.random() * 0.4; p[2] = BIER.z + (Math.random() - 0.5) * 0.5;
        const sp = 4 + Math.random() * 4;
        v[0] = toBattery.x * sp * 0.6; v[1] = sp; v[2] = toBattery.z * sp * 0.6;
      }, { life: 5, size: [0.12, 0.03], color: [[0.7, 3.4, 1.6, 1 - k * 0.6], [0.1, 1, 0.4, 0]] });
    }, ease.linear);
    hum.stop(4);
    await this.sinClose(1.2, -1);
    this.sin.anim.gesture('nod', 1.6, 0.9); // a bow of the head
    await this.sinSay('sinFarewell');
    await wait(0.8);
    setTimeout(() => { stopMotes(); motes.points.removeFromParent(); }, 6000);
  }

  // ---------------------------------------------------------------- 8. home
  // Up out of the hall and the jump; the voyage home; Coast City before dawn, still raining: in at
  // his bedroom window, the suit gone, asleep. Then the end of Part Two.
  async homeward() {
    const { powers } = this;
    this.travel = 'home';
    this.ringSay('ringHome');
    this.giveControl('Fly up and make the jump home');
    powers.markerTarget = { pos: HALL.clone().add(V(0, 40, 0)), label: 'Climb' };
    await waitFor(() => this.travelReady());
    powers.markerTarget = null;
    await new Promise((resolve) => (this.onJump = resolve));
    this.travel = null;
    this.hallActive = false;
    this.pocketLantern();
    await voyage(this, { from: 'oa', to: 'earth' });
    await this.backThroughWindow();
    const pick = await this.ui.screen({
      emblem: true,
      kicker: 'Part Two · The Corps',
      title: 'SECTOR 2814',
      subtitle: 'Part Two complete',
      body: 'Hal Jordan is a Green Lantern of the Corps, sworn to guard Sector 2814.\n\nHe also has a job, a landlord, and a test flight at nine.',
      buttons: ['Part Three: Coast City', 'Free flight (Oa and Earth)', 'Quit to title'],
      stack: true,
    });
    if (pick === 0) CoastSave.resumeAfterReload(CoastSave.first);
    else if (pick === 1) this.save.resumeAfterReload('earth');
    else { location.hash = ''; location.reload(); }
    await new Promise(() => {});
  }

  // His bedroom at a quarter past four: a green glow at the rain-streaked window, the curtains
  // thrown back, and he is standing in the room. The suit sweeps away into his clothes; he makes it
  // to the bed.
  async backThroughWindow() {
    const { ui, player, director, audio, engine } = this;
    const grade = engine.gradeUniforms;
    this.powers.detach();
    this.hud.show(false);
    const room = this.setupBedroom();
    this.world = 'earth';
    room.setClock('4:16');
    ui.clock('4:16 AM');
    ui.objective(null);
    this.takeControl();
    // Hal is still in the suit; casual Hal (this.hal) waits under it for the dissolve
    const at = V(1.55, 0, -0.35);
    player.spawn(room.physics, room.scene, at, -Math.PI / 2);
    player.setRig(this.suit);
    this.attachRing(this.ring, this.suit);
    this.playerActive = true;
    player.autoAnim = false;
    player.animator.play(still(POSES.land, 0.4), 0);
    player.object.visible = false;
    director.cut(V(-1.2, 1.45, 1.2), V(2.2, 1.3, -0.45), 48);
    tween(0.6, (k) => (grade.uFlash.value = 1 - k));
    // the green light outside the glass, the curtains blown in
    for (const c of room.curtains) { c.wind.set(-2.2, 0.5, 0); c.gust = 0.9; }
    audio.whoosh(1.6, 0.4);
    await tween(1.0, (k) => { room.greenFill.intensity = 30 * Math.sin(k * Math.PI * 0.5); room.glassU.uGreen.value = k; });
    player.object.visible = true;
    audio.land(0.25);
    await tween(1.4, (k) => { room.greenFill.intensity = 30 * (1 - k) + 2; room.glassU.uGreen.value = 1 - k; });
    for (const c of room.curtains) { c.wind.set(0, 0, 0); c.gust = 0.15; }
    player.animator.play(still(POSES.stand, 1), 0.8);
    await wait(0.6);
    // the suit goes: his clothes sweep back in over him
    director.move(V(0.2, 1.4, 0.6), at.clone().add(V(0, 1.2, 0)), 2.5, ease.inOut, 42);
    const suit = this.suit, hal = this.hal;
    player.mount(hal);
    player.animator.addRig(hal);
    hal.u.uDissolveOn.value = 1; hal.u.uDissolveSign.value = -1;
    suit.u.uDissolveOn.value = 1; suit.u.uDissolveSign.value = 1;
    audio.dissolve();
    audio.whoosh(2, 0.3);
    await tween(2.6, (k) => { hal.u.uDissolve.value = -0.1 + k * 1.25; suit.u.uDissolve.value = -0.1 + k * 1.25; room.greenFill.intensity = 2 * (1 - k); }, ease.inOut);
    hal.u.uDissolveOn.value = 0;
    suit.u.uDissolveOn.value = 0;
    suit.u.uDissolve.value = 0;
    this.ring.removeFromParent();
    player.setRig(hal);
    this.attachRing(this.ring, hal);
    this.powers.suited = false;
    player.setTired(0.6);
    player.speedScale = 1;
    player.animator.play(player.loco, 0.6);
    player.autoAnim = true;
    await this.say('halBack');
    // to the bed, and out like a light
    director.move(V(-1.9, 1.6, 1.6), V(-0.6, 0.7, -0.6), 3, ease.inOut, 50);
    await player.walkTo(V(-0.2, 0, -0.75), 1.0);
    await ui.fade(1, 1.0);
    audio.tick();
    this.putInBed(0.3);
    room.setClock('4:19');
    ui.clock('4:19 AM');
    director.cut(V(-1.95, 1.62, 1.75), V(-0.2, 0.85, -1.0), 58);
    await ui.fade(0, 1.6);
    director.move(V(-1.75, 1.55, 1.35), V(-0.4, 0.8, -1.1), 6, ease.inOut);
    await wait(3.5);
    await ui.fade(1, 2);
  }

  // ---------------------------------------------------------------- 9. the open range
  async openRange() {
    await wait(0.5);
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

  // ---------------------------------------------------------------- 10. back on Earth (free flight)
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
      this.ui.prompt(ready ? 'E' : null, ready ? ({ oa: 'Make the jump to Oa', home: 'Make the jump home' }[this.travel] ?? 'Enter hyperspace') : null);
    }
    if (ready) {
      if (this.input.hit('KeyE')) {
        this.input.consume('KeyE'); // or the star map would take this press as its confirm
        this.jumpPrompt = false;
        this.ui.prompt();
        if (this.travel === 'oa' || this.travel === 'home') { this.onJump?.(); this.onJump = null; } else this.openChart();
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
const _sh = new THREE.Vector3(), _sh2 = new THREE.Vector3(), _sh3 = new THREE.Vector3();
