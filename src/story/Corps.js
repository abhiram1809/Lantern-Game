import * as THREE from 'three';
import { wait, waitFor, ease } from '../engine/Time.js';
import { CorpsSave } from '../engine/Save.js';
import { Story } from './Story.js';
import { Animator } from '../characters/Rig.js';
import { MocapClip } from '../characters/Mocap.js';
import { createAbinSur, createKilowog, createRing } from '../characters/Characters.js';
import { Oa, KILOWOG_SPOT, HAL_START, PADS, RANGE_RADIUS, BATTERY } from '../scenes/Oa.js';
import { DroneSwarm } from '../enemies/Drones.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const KICKER = 'Kilowog’s range';

// Part Two, "The Corps": Oa. Kilowog's range, in three checkpoints: target drones for the fist,
// then the gatling and a live-fire drill against drones that shoot back, then the range left open
// for more rounds. Everything else (powers, pause, dialogue, collapse) comes from Story.
export class Corps extends Story {
  get save() { return CorpsSave; }

  steps() {
    return {
      oa: () => this.targets(),
      livefire: () => this.liveFire(),
      range: () => this.openRange(),
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    ui.clock(this.save.info(id).clock);
    this.setupOa();
    this.empower(true);
    if (id !== 'oa') this.learn('gatling', false);
    player.place(HAL_START, Math.PI);
    player.camYaw = 0;
    player.camPitch = 0.16;
    this.director.mode = 'follow';
    if (id !== 'oa') await ui.fade(0, 1.2);
  }

  setupOa() {
    if (this.oa) return this.oa;
    const { player, powers, audio } = this;
    const oa = (this.oa = new Oa(this).build());
    this.show(oa);
    this.playerActive = true;
    this.ring = createRing();
    this.putOnSuit();
    player.spawn(oa.physics, oa.scene, HAL_START, Math.PI);
    player.ground = (x, z) => oa.ground(x, z);
    player.surface = 'stone';
    player.camDist = 3.2;
    powers.attach({
      scene: oa.scene, physics: oa.physics, ground: (x, z) => oa.ground(x, z), bounds: oa.bounds, canLand: (x, z) => oa.canLand(x, z),
      floor: (x, z) => (Math.hypot(x, z) < RANGE_RADIUS + 0.4 ? 0 : -60), center: V(0, 0, 0), radius: 150, ceiling: 120,
    });
    powers.regen = 1.5; // the Central Battery keeps every ring on Oa topped up
    const swarm = (this.swarm = new DroneSwarm({ scene: oa.scene, physics: oa.physics, powers, player, audio, director: this.director, arena: RANGE_RADIUS, blocks: oa.blocks }));
    oa.updaters.push((dt, t) => swarm.update(dt, t));
    swarm.onKill = () => this.onKill();
    swarm.onPlayerHit = () => this.onPlayerHit();
    this.ambience(audio.wind(0.05), audio.roomTone(0.03), audio.pad([65.4, 98, 130.8, 196], 0.03, { cutoff: 520 }));
    this.addKilowog();
    return oa;
  }

  // Kilowog on his podium at the north edge, idling and keeping an eye on Hal. Until his scan is
  // built, a broadened Abin Sur stands in.
  addKilowog() {
    const gl = this.assets.characters.kilowog;
    const kw = (this.kilowog = gl ? createKilowog(gl) : createAbinSur(this.assets.characters.abin));
    if (!gl) { kw.root.scale.set(1.3, 1.22, 1.3); kw.u.uTint.value.setRGB(0.86, 0.82, 0.84); }
    kw.root.position.copy(KILOWOG_SPOT);
    kw.root.rotation.y = 0; // facing the range
    this.oa.scene.add(kw.root);
    const anim = (this.kwAnim = new Animator(kw));
    anim.play(new MocapClip(this.mocap, 'idle', { timeScale: 0.8 }), 0);
    anim.armSpread = gl ? 0.17 : 0; // his hands would rest inside the thigh armour
    anim.look.maxYaw = 0.6; // a short neck: keep head turns gentle
    anim.lookAt(this.headOf(this.player.rig), 0.6);
    this.oa.updaters.push((dt) => anim.update(dt));
  }

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
    const head = this.kilowog.bonePosition('head', V(0, 0, 0));
    return this.director.move(head.clone().add(V(-1.6, -0.25, 3.6)), head.clone().add(V(0, -0.15, 0)), duration, ease.inOut, 38);
  }
  twoShot(duration = 1.8) {
    const c = this.player.position.clone(), head = this.kilowog.bonePosition('head', V(0, 0, 0));
    const back = c.clone().sub(head).setY(0).normalize(), right = V(back.z, 0, -back.x);
    const halHead = c.clone().setY(c.y + 1.7);
    return this.director.move(c.clone().addScaledVector(back, 4).addScaledVector(right, 1.3).setY(c.y + 2.1), halHead.lerp(head, 0.45), duration, ease.inOut, 48);
  }

  // Kilowog's ring arm points out over the range while he talks.
  point(on) {
    const kw = this.kilowog, sh = V(0, 0, 0);
    this.kwAnim.reach('R', on ? () => { kw.bonePosition('upperArm_R', sh); return sh.add(V(0.35, -0.12, 0.85).normalize().multiplyScalar(0.95)); } : null, { pole: V(-0.6, -0.7, -0.3), rate: 6 });
  }

  // Kilowog's commentary while you fight: now and then, never on top of himself.
  quip(key, chance = 1) {
    const now = performance.now();
    if (this.quipping || now - (this.lastQuip ?? 0) < 6000 || Math.random() > chance) return;
    this.quipping = true;
    this.lastQuip = now;
    this.kwAnim.gesture('nod', 0.9, 0.5);
    this.bark(key).finally(() => (this.quipping = false));
  }

  onKill() { if (this.drilling) this.quip(['kwKill1', 'kwKill2', 'kwKill3'][Math.floor(Math.random() * 3)], 0.45); }

  onPlayerHit() {
    if (!this.drilling) return;
    if (!this.warnedShield) { this.warnedShield = true; this.quip('kwShield'); }
    else if (this.powers.health < 45) this.quip('kwCover', 0.6);
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

  // ---------------------------------------------------------------- 1. targets
  async targets() {
    const { ui, director, player, powers, swarm } = this;
    this.takeControl();
    // Oa: the skyline and the Central Battery, then down to the range and Kilowog
    director.cut(V(8, 5, 10), V(BATTERY.x * 0.2, 40, BATTERY.z * 0.2), 48);
    await ui.fade(0, 2.2);
    this.ringSay('ringOa');
    await director.move(V(-4, 4.5, 6), V(BATTERY.x * 0.15, 30, BATTERY.z * 0.15), 5, ease.inOut, 44);
    const kwHead = this.kilowog.bonePosition('head', V(0, 0, 0));
    player.lookAt(kwHead, 0.9);
    await this.twoShot(2.8);
    await this.kwClose(1.4);
    await this.say('kwIntro1');
    await this.twoShot(1.2);
    await this.say('halIntro');
    await this.kwClose(1.2);
    await this.say('kwIntro2');
    await this.twoShot(1.2);
    player.animator.gesture('shake', 1.0, 0.5);
    await this.say('halPoozer');
    this.kwAnim.gesture('nod', 1, 0.7);
    this.point(true);
    await this.say('kwIntro3');
    this.point(false);
    player.lookAt(null);
    this.giveControl('Destroy the target drones');
    this.kick(1, 'Targets', 'Five drones are rising from the pads. Open the wheel (<kbd>4</kbd>), choose the <b>Fist</b> and <kbd>Click</kbd> to strike.<br><span class="dim">Aim near a drone and the reticle locks on. The battery recharges your ring here.</span>');
    await this.wave('target', 5, 0.35);
    this.hud.tutorialDone();
    await wait(1.2);
    await this.bark('kwTargetsDone');
    swarm.clear();
    powers.holster();
  }

  // ---------------------------------------------------------------- 2. live fire
  async liveFire() {
    const { director, player, powers, swarm } = this;
    this.takeControl();
    const kwHead = this.kilowog.bonePosition('head', V(0, 0, 0)), c = player.position.clone();
    player.turnTo(Math.atan2(kwHead.x - c.x, kwHead.z - c.z));
    player.lookAt(kwHead, 0.9);
    await this.kwClose(2.2);
    await this.say('kwFire1');
    this.kwAnim.gesture('shake', 1.1, 0.5);
    await this.say('kwFire2');
    await this.twoShot(1.6);
    await this.say('halCannon');
    this.learn('gatling');
    player.lookAt(null);
    this.giveControl('Survive the live-fire drill');
    this.kick(2, 'Gatling', 'Open the wheel and choose the <b>Gatling</b>. <b>Hold</b> <kbd>Click</kbd>: the barrels spin up, then it fires where you aim.');
    await Promise.race([waitFor(() => powers.selected === 'gatling' && !powers.wheelState), wait(30)]);
    this.kick(3, 'Live fire', 'These drones shoot back. Watch for the red aim line, then block with the <b>Shield</b>, duck behind a pillar, raise a <b>Wall</b> or keep moving.<br><span class="dim">Fly with <kbd>Space</kbd> ×2 to get above them.</span>');
    this.drilling = true;
    await this.bark('kwLive');
    await this.wave('attacker', 3, 0.8);
    await wait(1.5);
    await this.bark('kwWave');
    await this.wave('attacker', 5, 0.7);
    this.drilling = false;
    this.hud.tutorialDone();
    await wait(1.4);
    this.hud.tutorial(null);
    await this.bark('kwDone');
    await this.bark('halTake');
    swarm.clear();
  }

  // ---------------------------------------------------------------- 3. the open range
  async openRange() {
    const { ui, powers } = this;
    await wait(0.5);
    const pick = await ui.screen({
      emblem: true,
      kicker: 'Part Two · The Corps',
      title: 'KILOWOG’S RANGE',
      subtitle: 'To be continued',
      body: 'Hal has learned to fight back. Sinestro has been watching from the edge of the range, and he has his own lessons in mind.',
      buttons: ['Keep training', 'Quit to title'],
    });
    if (pick === 1) { location.hash = ''; location.reload(); return; }
    this.giveControl('Train on the range');
    await this.bark('kwRange');
    this.addDrillStart();
    await new Promise(() => {}); // the range stays open until the player quits from the pause menu
  }

  // Kilowog starts another round when asked.
  addDrillStart() {
    const it = this.oa.interact({ position: KILOWOG_SPOT.clone().setY(0).add(V(0, 0, 4.6)), radius: 2.2, look: KILOWOG_SPOT.clone().add(V(0, 2.1, 0)), label: 'Ask Kilowog for another round', action: async () => {
      it.enabled = false;
      this.kwAnim.gesture('nod', 1, 0.6);
      await this.bark('kwWave');
      this.drilling = true;
      await this.wave('attacker', 4 + Math.floor(Math.random() * 3), 0.7);
      this.drilling = false;
      this.quip('kwDone');
      it.enabled = true;
    } });
  }
}

