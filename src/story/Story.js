import * as THREE from 'three';
import { wait, tween, ease, waitFor, onFrame } from '../engine/Time.js';
import { CameraDirector } from '../engine/CameraDirector.js';
import { RAPIER } from '../engine/Physics.js';
import { Save, CorpsSave, allUnlocks } from '../engine/Save.js';
import { Player } from '../characters/Player.js';
import { Animator } from '../characters/Rig.js';
import { MocapClip } from '../characters/Mocap.js';
import { POSES, still, asleep, makePose, blendInto } from '../characters/Poses.js';
import { createHal, createAbinSur, createRing, createLantern, JAW } from '../characters/Characters.js';
import { Bedroom, BED } from '../scenes/Bedroom.js';
import { Dream } from '../scenes/Dream.js';
import { Hyperspace } from '../scenes/Hyperspace.js';
import { CrashSite, ABIN_SPOT, ABIN_YAW, LANTERN_SPOT, ARRIVAL, WATER_LEVEL, terrainHeight } from '../scenes/CrashSite.js';
import { GreenOrb, createBubble, createShaft } from '../fx/GreenLight.js';
import { Particles, Fire } from '../fx/Particles.js';
import { Rift } from '../fx/Rift.js';
import { RingPowers } from '../powers/RingPowers.js';
import { PowerHud } from '../ui/PowerHud.js';
import { LINES } from './lines.js';
import { loadProps } from '../props/Props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ORB_SPOT = V(0.55, 1.5, -0.75);
// how wide each character opens their mouth on a full syllable (uJaw; 1 is about 2 cm)
const MOUTH_GAIN = { hal: 0.55, abin: 0.4, dad: 0.5, kilowog: 0.95, sinestro: 0.42, guardian: 0.34, carol: 0.5 };
const SEATED = makePose({ ...POSES.sitEdge, sx: 0.05, nx: -0.1, kx: -0.15, ky: 0.05 });
export const STARTER_CONSTRUCTS = ['fist', 'shield', 'wall'];
export const POWER_KEYS = '<b>4</b> constructs (time stops) &nbsp; <b>Click</b> use &nbsp; <b>Q</b> holster &nbsp; <b>Space</b> ×2 fly / drop &nbsp; <b>C</b> descend &nbsp; <b>L</b> lantern';

// A part's checkpoints as a menu; resolves with an id, or null for Back.
export async function chapterMenu(show, save) {
  const data = save.load();
  const buttons = save.checkpoints.map((c, i) => ({ label: `${i + 1}. ${c.label}`, sub: c.clock, disabled: !data.reached.includes(c.id) && c.id !== save.first }));
  const pick = await show({ kicker: save.label, title: 'CHAPTERS', stack: true, buttons: [...buttons, 'Back'] });
  return pick < save.checkpoints.length ? save.checkpoints[pick].id : null;
}

// Part One, and the shared plumbing every part builds on (see Corps.js for Part Two): the frame
// update, interactions, pause menu, dialogue, ring powers, checkpoints.
export class Story {
  get save() { return Save; }

  constructor({ engine, ui, input, audio, voice, assets }) {
    Object.assign(this, { engine, ui, input, audio, voice, assets });
    this.mocap = assets.characters.mocap;
    this.director = new CameraDirector(engine.camera);
    this.player = new Player({ input, audio, director: this.director, mocap: this.mocap });
    this.hal = createHal(assets.characters.casual, { roughMin: 0.62, jaw: JAW.casual }); // skin and cotton, not wax
    this.player.setRig(this.hal);
    this.hud = new PowerHud();
    this.powers = new RingPowers({ engine, input, audio, voice, hud: this.hud, player: this.player, director: this.director });
    this.powers.onDeath = () => this.collapse();
    this.current = null;
    this.focus = null;
    this.loops = [];
    input.onLockLost = () => this.pause();
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        if (this.paused) this.resume(); else this.pause();
      }
    });
  }

  // ---------------------------------------------------------------- frame + plumbing
  update(dt, t, real = dt) {
    const { engine } = this;
    if (this.input.hit('KeyV')) {
      this.voice.enabled = !this.voice.enabled;
      this.voice.cancel();
      Save.setting('voice', this.voice.enabled);
      this.ui.toast(this.voice.enabled ? 'Voices on' : 'Voices off');
    }
    if (this.playerActive) this.player.update(dt);
    this.updateMouths(real);
    if (this.lanternReady && this.player.control && !this.player.inputBlocked && !this.busy && !this.lanternMoving && this.input.hit('KeyL')) this.toggleLantern();
    this.powers.update(dt, real);
    if (dt > 0) this.current?.update(dt, t, engine.camera, engine.renderer); // frozen while time is stopped
    this.updateInteractions();
    this.director.update(dt, t);
  }

  // Lip sync: the speaker's jaw follows the voice's mouth curve (each character opening it by their
  // own amount); everyone else's mouth closes.
  updateMouths(dt) {
    const v = this.voice, speaker = v.who ? this.mouthOf(v.who) : null;
    for (const rig of this.mouths ??= new Set()) if (rig !== speaker) rig.u.uJaw.value = Math.max(0, rig.u.uJaw.value - dt * 8);
    if (!speaker?.u?.uJawOn.value) return;
    this.mouths.add(speaker);
    const target = v.mouth * (MOUTH_GAIN[v.who] ?? 0.5), j = speaker.u.uJaw;
    j.value += (target - j.value) * Math.min(1, dt * (target > j.value ? 38 : 22));
  }

  // Whose face speaks a line (null: an offscreen voice, the ring, thoughts).
  mouthOf(who) {
    if (this.speakingRig) return this.speakingRig; // a line performed by a character (Story.perform)
    if (who === 'hal') return this.player.rig;
    if (who === 'abin') return this.abin ?? this.bierAbin;
    if (who === 'dad') return this.dad;
    return null;
  }

  updateInteractions() {
    const list = this.player.control && this.current?.interactables;
    let best = null, bd = Infinity;
    if (list && !this.busy && !this.player.flying) {
      const p = this.player.position;
      for (const it of list) {
        if (!it.enabled) continue;
        const d = Math.hypot(p.x - it.position.x, p.z - it.position.z);
        if (d < it.radius && d < bd) { best = it; bd = d; }
      }
    }
    if (best !== this.focus) {
      this.focus = best;
      this.ui.prompt(best?.key, best?.label);
      // Hal glances at whatever he could interact with
      if (this.player.control) this.player.lookAt(best?.look ?? null, 0.55);
    }
    if (best && this.input.hit('KeyE')) {
      this.busy = true;
      this.ui.prompt();
      this.focus = null;
      Promise.resolve(best.action()).finally(() => (this.busy = false));
    }
  }

  show(sceneObj) {
    this.current = sceneObj;
    this.engine.setScene(sceneObj.scene);
    const u = sceneObj.scene.userData, cam = this.engine.camera;
    this.engine.renderer.toneMappingExposure = u.exposure ?? 1;
    // space needs a far reach; everything else keeps the close near plane
    cam.near = u.near ?? 0.03;
    cam.far = u.far ?? 900;
    cam.updateProjectionMatrix();
  }

  ambience(...handles) {
    for (const h of this.loops) h.stop(2.5);
    this.loops = handles;
  }

  giveControl(objective) {
    this.ui.cinematic(false);
    this.director.mode = 'follow';
    this.player.control = true;
    this.player.autoAnim = true;
    this.input.setLook(true);
    this.ui.controls(true);
    if (objective) this.ui.objective(objective);
  }

  takeControl() {
    this.powers.closeWheel();
    this.player.control = false;
    this.input.setLook(false);
    this.ui.controls(false);
    this.ui.prompt();
    this.ui.cinematic(true);
  }

  say(key, extra) { return this.ui.say({ ...LINES[key], ...extra }); }

  // A line performed by a character's BodyLanguage: beats of the head throughout, and gestures cued
  // to words (from the voice's word boundaries, or the line's pace when the voice is silent).
  // `cues` are [word, gesture name or function].
  async perform(body, key, cues = [], extra = {}) {
    const text = LINES[key].text.toLowerCase();
    const at = cues.map(([word, name]) => ({ i: Math.max(0, text.indexOf(word.toLowerCase())), name, done: false }));
    const fire = (c) => {
      if (c.done) return;
      c.done = true;
      if (typeof c.name === 'function') c.name(); else body.play(c.name);
    };
    let heard = false, t = 0;
    const stop = onFrame((dt) => { t += dt; if (!heard) for (const c of at) if (t >= 0.15 + c.i / 14) fire(c); });
    body.talk(true);
    this.speakingRig = body.rig; // whose mouth moves (see mouthOf)
    try {
      await this.say(key, { ...extra, onWord: (ci) => { heard = true; for (const c of at) if (ci >= c.i) fire(c); } });
    } finally {
      stop();
      body.talk(false);
      if (this.speakingRig === body.rig) this.speakingRig = null;
    }
  }
  async lines(...keys) { for (const k of keys) await this.say(k); }
  // A line Hal says while the player keeps control (clicks and Space don't skip it).
  bark(key) { return this.say(key, { skip: false }); }
  ringSay(key) { return this.powers.say(LINES[key].text); }

  // ---------------------------------------------------------------- pause menu
  async pause() {
    if (this.paused || !this.started || document.querySelector('#screen.show')) return;
    this.powers.closeWheel();
    this.paused = true;
    this.engine.paused = true;
    this.audio.ctx?.suspend();
    this.voice.pause();
    const wasLook = this.input.lookEnabled;
    const cp = this.save.info(this.checkpointId);
    for (;;) {
      const pick = await this.ui.pauseMenu({
        kicker: 'Paused', title: 'GREEN LANTERN', stack: true,
        buttons: ['Resume', { label: 'Restart checkpoint', sub: cp.label }, 'Chapters', { label: `Voices: ${this.voice.enabled ? 'on' : 'off'}` }, 'Quit to title'],
        small: 'Progress saves automatically at each checkpoint',
      });
      if (pick === 0 || !this.paused) break;
      if (pick === 1) return this.save.resumeAfterReload(this.checkpointId);
      if (pick === 2) { const id = await this.chapterSelect(this.ui.pauseMenu.bind(this.ui)); if (id) return this.save.resumeAfterReload(id); continue; }
      if (pick === 3) { this.voice.enabled = !this.voice.enabled; this.voice.cancel(); Save.setting('voice', this.voice.enabled); continue; }
      if (pick === 4) { location.hash = ''; location.reload(); return; }
    }
    this.resume(wasLook);
  }

  resume(look = this.input.lookEnabled) {
    if (!this.paused) return;
    this.paused = false;
    this.engine.paused = false;
    this.ui.closePause();
    this.audio.ctx?.resume();
    this.voice.resume();
    this.input.setLook(look && this.player.control);
  }

  // Menu of this part's checkpoints reached so far; resolves with an id or null (back).
  chapterSelect(show = this.ui.screen.bind(this.ui)) { return chapterMenu(show, this.save); }

  checkpoint(id) {
    this.checkpointId = id;
    this.save.checkpoint(id);
    if (id !== this.save.first || this.save !== Save) this.ui.checkpoint(this.save.info(id).label);
  }

  // ---------------------------------------------------------------- flow
  // Each step saves a checkpoint when reached; `prepare` rebuilds the state a step expects when
  // the game is resumed from it.
  async run(start = 'home') {
    this.started = true;
    this.voice.enabled = Save.setting('voice') !== false;
    this.ui.chapter(this.save.label);
    const steps = this.steps();
    const list = this.save.checkpoints;
    let i = Math.max(0, this.save.index(start));
    await this.prepare(list[i].id);
    for (; i < list.length; i++) {
      this.checkpoint(list[i].id);
      await steps[list[i].id]();
    }
  }

  steps() {
    return {
      home: () => this.home(),
      bedroom: () => this.bedroomRoam(),
      light: () => this.light(),
      question: () => this.question(),
      crash: () => this.crashArrival(),
      abin: () => this.meetAbin(),
      lantern: () => this.takeLantern(),
      powers: () => this.ringTraining(),
      free: () => this.explore(),
    };
  }

  async prepare(id) {
    await loadProps(['fridge', 'coffee', 'f104']); // the kitchenette's fridge and coffee maker, the dream's jet
    const { ui, player } = this;
    ui.clock(this.save.info(id).clock);
    if (['home', 'bedroom', 'light', 'question'].includes(id)) this.setupBedroom();
    if (id === 'bedroom') {
      player.place(V(-1.3, 0, 1.35), Math.PI);
      this.director.mode = 'follow';
      player.camYaw = 0.3;
      await ui.fade(0, 1.2);
    }
    if (id === 'light' || id === 'question') this.putInBed(id === 'light' ? 0.4 : 0);
    if (id === 'question') await this.setupQuestion();
    if (['abin', 'lantern', 'powers', 'free'].includes(id)) {
      this.setupCrash();
      const approach = V(ARRIVAL.x - ABIN_SPOT.x, 0, ARRIVAL.z - ABIN_SPOT.z).normalize();
      const at = ABIN_SPOT.clone().addScaledVector(approach, id === 'abin' ? 3.4 : 2.2);
      at.y = terrainHeight(at.x, at.z);
      player.spawn(this.site.physics, this.site.scene, at, Math.atan2(-approach.x, -approach.z));
      player.surface = 'mud';
      player.setTired(0.15);
      player.camDist = 3.0;
      if (id !== 'abin') this.abinDead();
      if (id === 'lantern') { this.attachRing(this.ring, this.hal); this.powers.ring = this.ring; this.powers.setCharge(12); }
      if (id === 'powers' || id === 'free') { this.putOnSuit(); this.empower(id === 'free'); this.pocketLantern(); }
      this.director.mode = 'follow';
      await ui.fade(0, 1.2);
    }
  }

  // ---------------------------------------------------------------- Chapter 1: home
  setupBedroom() {
    if (this.bedroom) return this.bedroom;
    const room = (this.bedroom = new Bedroom(this).build());
    this.show(room);
    this.playerActive = true;
    this.inBed = false;
    const { player } = this;
    player.setTired(0.6);
    player.spawn(room.physics, room.scene, V(-4.0, 0, 2.82), Math.PI / 2);
    player.camDist = 2.1;
    player.surface = 'wood';
    player.ground = () => 0;
    this.ambience(this.audio.rain(0.16), this.audio.roomTone(0.05), this.audio.pad([110, 164.8, 220], 0.035, { cutoff: 450 }));
    room.setClock('9:47');
    room.interact({ position: V(1.25, 0, -1.25), radius: 0.9, look: V(1.3, 0.92, -1.86), label: 'Look at the photo', action: () => this.lines('photo1', 'photo2') });
    room.interact({ position: V(0.35, 0, -1.3), radius: 0.7, look: V(0.1, 1.55, -2), label: 'Look at the posters', action: () => this.say('posters') });
    room.interact({ position: V(1.85, 0, -0.35), radius: 0.9, look: V(2.4, 1.5, -0.35), label: 'Look outside', action: async () => { room.lightning(1); setTimeout(() => this.audio.thunder(1), 900); await this.say('window'); } });
    room.interact({ position: V(-3.4, 0, 3.1), radius: 0.8, look: V(-3.4, 0.83, 3.32), label: 'Drop your keys', action: async () => { this.audio.tick(); await this.say('keys'); } });
    // ambient lightning + thunder
    let next = 6;
    this.lightningOff = onFrame((dt) => {
      next -= dt;
      if (next > 0 || this.current !== room) return;
      next = 12 + Math.random() * 16;
      const s = 0.6 + Math.random() * 0.6;
      room.lightning(s);
      setTimeout(() => this.audio.thunder(s * 0.8), 700 + Math.random() * 1800);
    });
    return room;
  }

  async home() {
    const { ui, player, director } = this;
    director.cut(V(-4.4, 1.65, 3.3), V(-3.3, 1.35, 2.8), 55);
    this.audio.door();
    ui.cinematic(true);
    await ui.fade(0, 2.2);
    director.move(V(-4.45, 1.7, 3.05), V(-1.5, 1.3, 2.82), 3.5);
    await player.walkTo(V(-3.1, 0, 2.82), 1.0);
    player.lookAt(V(-1.3, 1.5, 1.8), 0.7); // toward the bedroom door
    await this.lines('home1', 'home2');
    player.lookAt(null);
    this.giveControl('Head to your bedroom');
    await waitFor(() => player.position.z < 1.7);
  }

  async bedroomRoam() {
    const { ui, player } = this;
    const room = this.bedroom;
    if (!player.control) this.giveControl();
    ui.objective('Get some rest');
    room.setClock('9:51');
    ui.clock('9:51 PM');
    await new Promise((resolve) => {
      room.interact({ position: V(-0.2, 0, -0.75), radius: 1.0, look: V(-1.1, 0.6, -0.8), label: 'Lie down', action: () => resolve() });
    });
    await this.nap();
  }

  // ---------------------------------------------------------------- the nap and the dream
  // Lying in bed: rolled about the body's long axis, then settled so the lowest part of the body
  // rests on the mattress (works for any roll or knee position).
  layInBed(roll = 0) {
    const o = this.player.object;
    o.rotation.set(-Math.PI / 2, roll, 0, 'XYZ');
    o.position.x = -1.12;
    o.position.z = 0.0;
    if (!this.inBed) { o.position.y = BED.top + 0.12; this.inBed = true; }
    const caps = this.bedroom.bodyCapsules?.();
    if (!caps) return;
    let low = Infinity;
    for (const c of caps) low = Math.min(low, c.a.y - c.r, c.b.y - c.r);
    o.position.y += (BED.top + 0.01 - low) * 0.5;
  }

  bedCapsules() {
    const rig = this.hal;
    const cap = (a, b, r, extend = 0, arm = false) => {
      const pa = rig.bonePosition(a, new THREE.Vector3()), pb = rig.bonePosition(b, new THREE.Vector3());
      if (extend) pb.addScaledVector(pb.clone().sub(pa).normalize(), extend);
      return { a: pa, b: pb, r, arm };
    };
    // the feet: lying on his back his toes point up, past the drape round the ankle
    const toe = (side) => {
      const f = rig.bonePosition(`foot_${side}`, new THREE.Vector3());
      const tip = new THREE.Vector3(0, -0.45, 1).normalize().multiplyScalar(0.19).applyQuaternion(rig.bones[`foot_${side}`].getWorldQuaternion(new THREE.Quaternion())).add(f);
      return { a: f, b: tip, r: 0.06, arm: false };
    };
    // arms rest on top of the blanket (as in the concept art), so they only count for settling
    return [
      { ...cap('hips', 'chest', 0.17), torso: true }, { ...cap('chest', 'neck', 0.17), torso: true }, cap('thigh_L', 'shin_L', 0.09), cap('shin_L', 'foot_L', 0.07, 0.15),
      cap('thigh_R', 'shin_R', 0.09), cap('shin_R', 'foot_R', 0.07, 0.15), cap('foot_L', 'foot_L', 0.13), cap('foot_R', 'foot_R', 0.13),
      toe('L'), toe('R'),
      cap('upperArm_L', 'foreArm_L', 0.055, 0, true), cap('foreArm_L', 'hand_L', 0.05, 0.12, true),
      cap('upperArm_R', 'foreArm_R', 0.055, 0, true), cap('foreArm_R', 'hand_R', 0.05, 0.12, true),
    ];
  }

  // Out of bed in stages, the way people get up: rolled toward the open edge (on his left side,
  // facing it), up on that elbow (turned about the hips, so the legs stay on the mattress), the
  // blanket thrown back toward the wall with a sweep of the other arm, then the legs swung off the
  // edge as the body comes upright, and settled on the edge at `to`, facing +x. `whilePropped` runs
  // on the elbow (a look at the clock); `pace` < 1 is a startled wake; `sweep: false` keeps the
  // right arm free (to shield his eyes).
  async getUpFromBed({ to, seat = SEATED, pace = 1, whilePropped = null, sweep = true }) {
    const { player } = this, room = this.bedroom, o = player.object, rig = this.hal, anim = player.animator, sleep = this.sleep;
    const r0 = sleep.roll;
    await tween(1.0 * pace, (k) => (sleep.roll = r0 + (0.85 - r0) * k), ease.inOut);
    this.rollUpdater?.();
    this.rollUpdater = null;
    // up on the left elbow, the hand flat on the mattress in front of his chest: a sideways bend of
    // the spine (he lies on his side), so the legs stay where they are
    const lying = blendInto(makePose(), POSES.lieBack, POSES.lieSideL, 0.85);
    const propped = makePose({ ...lying, sz: 0.32, cz: 0.26, nz: 0.12, nx: -0.05 });
    const st = { k: 0 };
    anim.play((out) => blendInto(out, lying, propped, st.k), 0.25);
    const hips = rig.bonePosition('hips', new THREE.Vector3());
    anim.reach('L', new THREE.Vector3(hips.x + 0.22, BED.top + 0.06, hips.z - 0.42), { pole: new THREE.Vector3(0.3, -1, -0.6), rate: 4 });
    await tween(1.0 * pace, (k) => { st.k = k; room.blanketWaist = k; }, ease.inOut); // it slides off his shoulders
    if (whilePropped) await whilePropped();
    // the blanket back toward the wall
    if (sweep) anim.reach('R', new THREE.Vector3(BED.x0 + 0.4, BED.top + 0.25, hips.z + 0.1), { pole: new THREE.Vector3(-0.6, 0.4, -1), rate: 6 });
    this.audio.whoosh?.(0.5, 0.12);
    await tween(0.9 * pace, (k) => (room.blanketOff = k), ease.inOut);
    if (sweep) anim.reach('R', null);
    anim.reach('L', null);
    // up to sitting, facing the foot of the bed with the legs still along it (the thighs flexing as
    // the body rises, so the legs stay put); the turn is about his hips
    const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const longSit = makePose({ ...seat, sx: 0.28, cx: 0.1, lLx: -1.52, kL: 0.15, lRx: -1.55, kR: 0.2, lLz: 0.05, lRz: -0.05, fL: 0.4, fR: 0.4,
      aL: [0.45, -0.8, -0.35], eL: 0.15, aR: [-0.45, -0.8, -0.35], eR: 0.15 });
    const pose = makePose(), local = new THREE.Vector3();
    const around = (hp, gen, k) => { gen(pose, k); local.set(pose.hx, rig.hipsHeight + pose.hy, pose.hz).applyQuaternion(o.quaternion); o.position.copy(hp).sub(local); };
    const q2 = o.quaternion.clone(), h0 = rig.bonePosition('hips', new THREE.Vector3());
    const hA = h0.clone().setY(Math.max(h0.y, BED.top + 0.1)); // sitting on the mattress
    const up = (out, k) => blendInto(out, propped, longSit, ease.inOut(k));
    st.k = 0;
    anim.play((out) => up(out, st.k), 0.2);
    await tween(1.2 * pace, (k) => {
      st.k = k;
      o.quaternion.slerpQuaternions(q2, qA, ease.inOut(k));
      around(h0.clone().lerp(hA, ease.inOut(k)), up, k);
    }, ease.linear);
    // then round on his hips to the edge, the legs sweeping off it, the knees bending once they're
    // clear of the mattress, onto the edge at `to`
    const q3 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    const h1 = to.clone().setY(to.y + rig.hipsHeight + seat.hy);
    const round = (out, k) => {
      blendInto(out, longSit, seat, ease.inOut(k));
      const kn = ease.inOut(THREE.MathUtils.smoothstep(k, 0.5, 1));
      out.kL = longSit.kL + (seat.kL - longSit.kL) * kn;
      out.kR = longSit.kR + (seat.kR - longSit.kR) * kn;
      out.lLx = longSit.lLx + (seat.lLx - longSit.lLx) * kn;
      out.lRx = longSit.lRx + (seat.lRx - longSit.lRx) * kn;
      return out;
    };
    st.k = 0;
    anim.play((out) => round(out, st.k), 0.1);
    await tween(1.3 * pace, (k) => {
      st.k = k;
      o.quaternion.slerpQuaternions(qA, q3, ease.inOut(k));
      around(hA.clone().lerp(h1, ease.inOut(k)), round, k);
    }, ease.linear);
    room.bodyCapsules = null;
    anim.play(still(seat, 1.4), 0.6);
  }

  // Both palms dragged slowly down over his face, still half asleep.
  async rubFace(dur = 1.5) {
    const rig = this.hal, anim = this.player.animator, head = new THREE.Vector3(), q = new THREE.Quaternion(), st = { k: 0 };
    const at = (s) => () => {
      rig.bonePosition('head', head);
      rig.bones.head.getWorldQuaternion(q);
      return new THREE.Vector3(0.05 * s, -0.02 - 0.08 * st.k, 0.15 - 0.02 * st.k).applyQuaternion(q).add(head);
    };
    anim.reach('L', at(1), { pole: new THREE.Vector3(0.6, -1, 0.2), rate: 5 });
    anim.reach('R', at(-1), { pole: new THREE.Vector3(-0.6, -1, 0.2), rate: 5 });
    await wait(0.5);
    await tween(dur, (k) => (st.k = k), ease.inOut);
    anim.reach('L', null);
    anim.reach('R', null);
    await wait(0.3);
  }

  putInBed(unrest = 0) {
    const { player } = this;
    const room = this.bedroom;
    this.takeControl();
    player.autoAnim = false;
    player.speed = 0;
    player.lookAt(null);
    const sleep = (this.sleep = { roll: 0, unrest });
    player.animator.play(asleep(sleep), 0);
    room.bodyCapsules = () => this.bedCapsules();
    room.blanketOff = 0;
    room.blanketWaist = 0;
    this.rollUpdater?.();
    this.rollUpdater = onFrame(() => this.layInBed(sleep.roll * 1.25));
    room.lampLight.intensity = 0;
    room.lampFill.intensity = 0;
    room.lamp.bulb.material.color.setRGB(0.3, 0.25, 0.2);
    room.hemi.intensity = 0.12;
    room.setClock('10:00');
    return sleep;
  }

  async nap() {
    const { ui, director, audio } = this;
    const room = this.bedroom;
    this.takeControl();
    ui.objective(null);
    await ui.fade(1, 1.1);
    audio.tick();
    const sleep = this.putInBed(0);
    room.setClock('9:52');
    ui.clock('9:52 PM');
    // the concept-art composition: from the door corner, bed left, window right
    director.cut(V(-1.95, 1.62, 1.75), V(-0.2, 0.85, -1.0), 58);
    await ui.fade(0, 2.5);
    director.move(V(-1.7, 1.5, 1.2), V(-0.4, 0.8, -1.1), 9, ease.inOut);
    await tween(4, (k) => (sleep.unrest = 0.35 * k));
    await tween(1.6, (k) => (sleep.roll = -k), ease.inOut);
    await wait(1.5);
    await this.dreamFragment(1);
    // back in bed, restless
    room.setClock('9:57');
    ui.clock('9:57 PM');
    director.cut(V(-0.15, 1.15, 0.4), V(-1.1, 0.8, -1.3), 45);
    this.show(room);
    this.engine.gradeUniforms.uDream.value = 0;
    sleep.unrest = 0.8;
    await ui.fade(0, 1.2);
    audio.heartbeat();
    await tween(1.2, (k) => (sleep.roll = -1 + k * 1.3));
    await wait(0.6);
    await tween(1.0, (k) => (sleep.roll = 0.3 + 0.7 * k));
    audio.heartbeat();
    await wait(1.4);
    await this.dreamFragment(2);
    this.show(room);
    this.engine.gradeUniforms.uDream.value = 0;
    director.cut(V(-0.3, 1.2, -0.2), V(-1.1, 0.75, -1.5), 42);
    sleep.unrest = 1;
    await ui.fade(0, 0.5);
    audio.heartbeat();
    await tween(0.8, (k) => (sleep.roll = 1 - k));
    await wait(0.8);
    sleep.unrest = 0.4;
    room.setClock('10:00');
    ui.clock('10:00 PM');
    audio.tick();
    room.lightning(1.2);
    audio.thunder(1);
  }

  async dreamFragment(n) {
    const { ui, director, audio } = this;
    await ui.fade(1, 1.2);
    if (!this.dream) {
      const d = (this.dream = new Dream(this).build());
      const dad = (this.dad = createHal(this.assets.characters.casual, { roughMin: 0.62, jaw: JAW.casual }));
      dad.u.uTint.value.setRGB(0.95, 0.9, 0.78);
      dad.root.position.set(-5, 0, -13);
      dad.root.rotation.y = 0.37;
      d.scene.add(dad.root);
      this.dadAnim = new Animator(dad);
      this.dadAnim.play(new MocapClip(this.mocap, 'idle', { timeScale: 0.9 }), 0);
      this.dadAnim.lookAt(V(0, 1.1, 0), 0.8); // at young Hal
      d.updaters.push((dt) => this.dadAnim.update(dt));
    }
    const d = this.dream;
    this.show(d);
    this.engine.gradeUniforms.uDream.value = 1;
    const prevAmb = this.loops;
    const wind = audio.wind(0.1);
    if (n === 1) {
      director.cut(V(0, 1.1, 0), V(-5, 1.35, -13), 38);
      await ui.fade(0, 1.6);
      audio.musicBox([659, 587, 523, 587, 659, 784, 659, 0, 587, 523, 494, 523, 587]);
      // wave: the hand swings side to side above the shoulder
      const dad = this.dad, wave = new THREE.Vector3();
      this.dadAnim.reach('R', () => {
        dad.bonePosition('upperArm_R', wave);
        const yaw = dad.root.rotation.y, side = Math.sin(this.engine.time * 6.5) * 0.09;
        return wave.add(V(Math.cos(yaw) * (-0.18 + side), 0.36, -Math.sin(yaw) * (-0.18 + side)).add(V(Math.sin(yaw) * 0.12, 0, Math.cos(yaw) * 0.12)));
      }, { pole: V(-0.8, -0.3, -0.4) });
      await this.lines('dad1', 'kid1', 'dad2');
      this.dadAnim.reach('R', null);
      await wait(0.6);
    } else {
      this.dad.root.visible = false;
      const jet = d.jet;
      const path = new THREE.CatmullRomCurve3([V(-40, 1.1, -34), V(10, 1.1, -34), V(60, 5, -36), V(110, 30, -60), V(150, 52, -130), V(175, 38, -215), V(160, 2, -300)]);
      const pivot = new THREE.Group();
      pivot.position.copy(path.getPointAt(0)); // (not on the camera for its first frame)
      pivot.lookAt(path.getPointAt(0.01));
      d.scene.add(pivot);
      pivot.add(jet);
      jet.position.copy(jet.userData.offset ?? V(0, 0, 0));
      jet.rotation.set(0, -Math.PI / 2, 0);
      jet.userData.flame.material.opacity = 0.9;
      director.cut(V(0, 1.1, 0), V(-30, 2, -34), 45);
      await ui.fade(0, 1.2);
      audio.jet(9, 0.55);
      const follow = onFrame(() => director.look.lerp(pivot.position, 0.12));
      await tween(10, (k) => {
        const p = path.getPointAt(k), q = path.getPointAt(Math.min(1, k + 0.01));
        pivot.position.copy(p);
        pivot.lookAt(q);
        pivot.rotateZ(Math.sin(k * Math.PI * 2) * 0.5 + (k > 0.75 ? (k - 0.75) * 4 : 0));
        jet.userData.flame.material.opacity = k > 0.72 ? (Math.random() < 0.5 ? 0.9 : 0) : 0.9;
        director.fov = 45 - k * 20;
      }, ease.in);
      pivot.visible = false;
      follow();
      director.move(V(0, 1.1, 0), V(160, 25, -300), 1.2, ease.out, 30);
      d.crash.intensity = 1;
      this.engine.gradeUniforms.uFlash.value = 0.6;
      tween(1.2, (k) => (this.engine.gradeUniforms.uFlash.value = 0.6 * (1 - k)));
      setTimeout(() => audio.explosion(0.5), 1100);
      await wait(1.6);
      await this.say('kid2');
      await this.say('kid3');
      await this.say('halMemory');
      await wait(0.6);
    }
    wind.stop(1);
    await ui.fade(1, 1.4);
    this.loops = prevAmb;
  }

  // ---------------------------------------------------------------- Chapter 2: the light
  // Seated: hands come to rest just above the knees.
  handsOnKnees(on, sides = ['L', 'R']) {
    const rig = this.hal;
    for (const side of sides) {
      const p = new THREE.Vector3(), q = new THREE.Quaternion();
      this.player.animator.reach(side, on ? () => {
        rig.bones[`shin_${side}`].getWorldPosition(p);
        rig.bones.hips.getWorldQuaternion(q);
        return p.add(V(side === 'L' ? -0.03 : 0.03, 0.075, -0.06).applyQuaternion(q));
      } : null, { pole: V(side === 'L' ? 0.6 : -0.6, -0.3, -0.7) });
    }
  }

  // Shielding the eyes: the right hand in front of the brow, elbow out to the side.
  shieldEyes(on) {
    const rig = this.hal, p = new THREE.Vector3(), q = new THREE.Quaternion();
    this.player.animator.reach('R', on ? () => {
      rig.bones.head.getWorldPosition(p);
      rig.bones.chest.getWorldQuaternion(q);
      return p.add(V(-0.03, 0.06, 0.17).applyQuaternion(q));
    } : null, { pole: V(-0.9, -0.2, 0.1) });
  }

  async light() {
    const { ui, director, audio, player } = this;
    const room = this.bedroom;
    director.cut(V(-1.95, 1.62, 1.75), V(0.2, 1.0, -0.9), 60);
    await ui.fade(0, 1.4);

    // the meteor crosses the window (concept art shot): aimed through the glass from this camera,
    // upper right to lower left
    const met = room.meteor;
    met.visible = true;
    const cam = V(-1.95, 1.62, 1.75);
    const through = (p, dist) => cam.clone().add(p.clone().sub(cam).normalize().multiplyScalar(dist));
    const from = through(V(2.2, 2.4, 0.75), 80), to = through(V(2.2, 1.05, -1.15), 60);
    audio.whoosh(3, 0.4);
    await tween(2.6, (k) => {
      met.position.lerpVectors(from, to, k);
      room.meteorTrail.emit(6, (p, v) => {
        p[0] = met.position.x + (Math.random() - 0.5); p[1] = met.position.y + (Math.random() - 0.5); p[2] = met.position.z + (Math.random() - 0.5);
        v[0] = (Math.random() - 0.5) * 2; v[1] = Math.random(); v[2] = (Math.random() - 0.5) * 2;
      }, { life: 1.6, size: [2.2, 0.3], color: Math.random() < 0.5 ? [[1.5, 4, 2, 1], [0.2, 1, 0.4, 0]] : [[4, 1.6, 0.4, 1], [1, 0.2, 0, 0]] });
      room.greenFill.intensity = Math.sin(k * Math.PI) * 25;
      room.glassU.uGreen.value = Math.sin(k * Math.PI);
    }, ease.linear);
    met.visible = false;
    room.greenFill.intensity = 0;
    room.glassU.uGreen.value = 0;
    this.sleep.unrest = 0.7;
    await wait(1.2);

    // the light enters the room
    const orb = this.addOrb();
    const shaft = createShaft({ from: V(2.6, 2.0, -0.35), to: V(-0.9, 0.4, -0.8), radiusFrom: 0.7, radiusTo: 1.4 });
    room.scene.add(shaft);
    room.updaters.push((dt, t) => (shaft.userData.uniforms.uTime.value = t));
    const shimmer = (this.shimmer = audio.shimmer());
    shimmer.level(0.18, 2);
    director.move(V(-1.6, 1.55, 1.3), V(0.6, 1.3, -0.6), 4);
    await tween(2.5, (k) => {
      orb.intensity = k;
      orb.group.position.lerpVectors(V(4.5, 1.6, -0.35), ORB_SPOT, ease.inOut(k));
      room.glassU.uGreen.value = k;
      room.greenFill.intensity = 3 * k;
      shaft.userData.uniforms.uOpacity.value = 0.3 * k;
    }, ease.linear);
    audio.whoosh(1.4, 0.7);
    room.physics.burst(ORB_SPOT, 3.2, 4.5, 1.6, 1.2);
    for (const c of room.curtains) { c.wind.set(-4.5, 1, 0); c.gust = 1.6; }
    room.hemi.color.setRGB(0.4, 1, 0.6);
    director.shake(0.25, 1);

    // Hal wakes with a start: up on his elbow into the light, a hand up against it, then onto the
    // edge of the bed (quicker than a morning)
    this.sleep.unrest = 1;
    await wait(0.6);
    player.lookAt(ORB_SPOT, 0.6);
    director.move(V(0.55, 1.25, 0.45), V(-0.45, 1.0, -0.95), 2.2, ease.out, 50);
    await this.getUpFromBed({
      to: V(-0.5, 0, -0.9), seat: makePose({ ...POSES.sitEdge, sx: -0.08, cx: -0.1, kx: -0.1, ky: 0.2 }), pace: 0.6, sweep: false,
      whilePropped: async () => { this.shieldEyes(true); await wait(0.5); },
    });
    this.handsOnKnees(true, ['L']);
    await wait(1.0);
    for (const c of room.curtains) { c.wind.set(-2, 0.4, 0); c.gust = 0.8; }
    this.shieldEyes(false);
    this.handsOnKnees(true);
    player.lookAt(ORB_SPOT, 1);
    player.animator.play(still(SEATED, 1.2), 1.4);
    await this.lines('light1', 'hal1', 'light2', 'light3');
    director.move(V(0.2, 1.35, 0.25), V(-0.45, 1.3, -0.9), 3, ease.inOut, 40);
  }

  addOrb() {
    const room = this.bedroom;
    const orb = (this.orb = new GreenOrb({ scale: 0.8, lightIntensity: 5, lightRange: 8 }));
    orb.addTo(room.scene);
    orb.group.position.set(4.5, 1.6, -0.35);
    room.updaters.push((dt, t) => orb.update(dt, t, this.engine.camera, this.engine.renderer));
    return orb;
  }

  // Resuming at the question: Hal already sitting up, the light hovering in front of him.
  async setupQuestion() {
    const { player, director } = this;
    const room = this.bedroom;
    this.rollUpdater?.();
    room.bodyCapsules = null;
    player.object.rotation.set(0, Math.PI / 2, 0);
    player.object.position.set(-0.5, 0, -0.9);
    player.animator.play(still(SEATED, 1.2), 0);
    this.handsOnKnees(true);
    player.lookAt(ORB_SPOT, 1);
    const orb = this.addOrb();
    orb.group.position.copy(ORB_SPOT);
    orb.intensity = 1;
    room.glassU.uGreen.value = 1;
    room.greenFill.intensity = 3;
    room.hemi.color.setRGB(0.4, 1, 0.6);
    for (const c of room.curtains) { c.wind.set(-2, 0.4, 0); c.gust = 0.8; }
    this.shimmer = this.audio.shimmer();
    this.shimmer.level(0.18, 2);
    director.cut(V(0.2, 1.35, 0.25), V(-0.45, 1.3, -0.9), 40);
    await this.ui.fade(0, 1.2);
  }

  async question() {
    const { ui, player } = this;
    await this.say('light4');
    for (;;) {
      const answer = await ui.choice('ARE YOU AFRAID?', ['YES', 'NO']);
      if (answer === 1) break;
      Save.update((d) => d.stats.fears++);
      await this.fearFailure();
    }
    player.animator.gesture('shake', 1.2);
    await this.lines('halNo', 'light5');
    await this.levitate();
  }

  async fearFailure() {
    const { ui, audio, director, player } = this;
    const room = this.bedroom, orb = this.orb;
    player.animator.gesture('nod', 1.1, 0.7);
    await this.say('halYes');
    await this.say('lightYes');
    audio.failure();
    this.shimmer.level(0, 2);
    player.lookAt(V(2.4, 1.6, -0.35), 0.8); // watching it leave
    director.move(V(-1.6, 1.55, 1.3), V(0.6, 1.3, -0.6), 3);
    await tween(2.8, (k) => {
      orb.intensity = 1 - k;
      orb.group.position.lerpVectors(ORB_SPOT, V(4.5, 1.8, -0.35), ease.in(k));
      room.greenFill.intensity = 3 * (1 - k);
      room.glassU.uGreen.value = 1 - k;
    });
    room.hemi.color.set(0x6a7a99);
    const pick = await ui.screen({
      kicker: 'The light moves on',
      title: 'NOT YET',
      body: 'Fear still has its hold on Hal. The ring will keep searching the stars for someone who can overcome it.',
      buttons: ['Face it again', 'Restart chapter'],
    });
    if (pick === 1) return Save.resumeAfterReload('light');
    this.shimmer.level(0.18, 2);
    room.hemi.color.setRGB(0.4, 1, 0.6);
    player.lookAt(ORB_SPOT, 1);
    director.move(V(0.2, 1.35, 0.25), V(-0.45, 1.3, -0.9), 2.5, ease.inOut, 40);
    await tween(2, (k) => {
      orb.intensity = k;
      orb.group.position.lerpVectors(V(4.5, 1.8, -0.35), ORB_SPOT, ease.out(k));
      room.greenFill.intensity = 3 * k;
      room.glassU.uGreen.value = k;
    });
    await this.say('lightAgain');
  }

  async levitate() {
    const { audio, director, player } = this;
    const room = this.bedroom;
    const bubble = (this.bubble = createBubble(1.15));
    room.scene.add(bubble);
    const o = player.object;
    room.updaters.push((dt, t) => {
      bubble.userData.uniforms.uTime.value = t;
      bubble.position.copy(o.position).y += 1.0;
    });
    audio.riser(4.5, 0.4);
    room.physics.setGravityScale(-0.04);
    room.physics.burst(o.position.clone().setY(0), 0.6, 4, 1.2, 0.6);
    player.animator.play(still(POSES.float, 1.5), 1.8);
    this.handsOnKnees(false);
    player.lookAt(null);
    director.move(V(1.2, 0.9, 0.9), V(-0.45, 1.5, -0.9), 4.5, ease.inOut, 52);
    const p0 = o.position.clone(), q0 = o.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 - 0.4, 0));
    await tween(4.5, (k) => {
      bubble.userData.uniforms.uOpacity.value = Math.min(1, k * 2);
      o.position.set(p0.x + 0.25 * k, p0.y + 0.45 * k, p0.z);
      o.quaternion.slerpQuaternions(q0, q1, k);
      this.orb.intensity = 1 + k * 1.5;
    });
    this.shimmer.level(0.35, 1);
    audio.whoosh(1.5, 0.8);
    await tween(0.9, (k) => (this.engine.gradeUniforms.uFlash.value = k), ease.in);
    this.lightningOff();
    await this.tunnel();
  }

  // The light carries Hal through hyperspace (styled after the space-flight reference video).
  async tunnel() {
    const { audio, director, player, engine } = this;
    const grade = engine.gradeUniforms;
    const hs = new Hyperspace();
    this.show(hs);
    const o = player.object;
    hs.scene.add(o);
    // head-first and leaning into the flight, hips at the origin, travelling toward -z
    o.rotation.set(1.15, Math.PI, 0, 'YXZ');
    o.position.set(0, 0, 0);
    player.animator.play(still(POSES.carried, 0.6), 0.8);
    player.animator.update(0);
    o.position.sub(this.hal.bonePosition('hips', new THREE.Vector3()));
    hs.anchor.set(0, 0, 0);
    hs.scene.add(this.bubble);
    this.bubble.position.set(0, 0, 0);
    this.bubble.userData.uniforms.uOpacity.value = 0.25;
    const bu = this.bubble.userData.uniforms;
    const hsUpdate = hs.update.bind(hs);
    hs.update = (dt, t, camera, renderer) => { hsUpdate(dt, t, camera, renderer); bu.uTime.value = t; };
    const aberration = grade.uAberration.value;

    // Shot 1: three-quarter front on Hal's face, stars beginning to stretch.
    director.cut(V(-1.5, 0.45, -2.6), V(0, 0.35, -0.9), 50);
    hs.warp = 0.05;
    audio.whoosh(2.4, 0.45);
    audio.burst({ buffer: audio.brownBuf, from: 180, to: 70, attack: 0.6, peak: 0.45, dur: 6, wet: 0.4, rate: 0.6 });
    const fadeIn = tween(0.6, (k) => (grade.uFlash.value = 1 - k));
    // the bubble from the bedroom dissolves into the light as he picks up speed
    await tween(2.2, (k) => {
      hs.warp = 0.05 + 0.3 * k * k;
      bu.uOpacity.value = 0.25 * (1 - k);
      director.pos.set(-1.5 + k * 0.4, 0.45 + k * 0.1, -2.6 + k * 0.5);
    }, ease.linear);
    this.bubble.visible = false;
    await fadeIn;

    // The jump: full hyperspeed, cut behind him with the streaks radiating from the core.
    audio.whoosh(1.6, 0.85);
    audio.riser(3.2, 0.35);
    director.cut(V(0.25, 0.75, 2.5), V(0, 0.25, -30), 62);
    director.shake(0.12, 3.4);
    await tween(3.3, (k) => {
      hs.warp = 0.35 + 0.65 * Math.min(1, k * 4);
      director.fov = 62 + 14 * Math.min(1, k * 3);
      grade.uAberration.value = aberration + 0.006 * hs.warp;
      director.pos.set(0.25 + Math.sin(k * 5) * 0.12, 0.75 + Math.sin(k * 3.3) * 0.06, 2.5 - k * 0.35);
    }, ease.linear);

    // Arrival: the core blooms into the cut to the lake.
    audio.whoosh(1, 0.7);
    await tween(0.7, (k) => {
      hs.burst = k * k;
      hs.warp = 1 - k * 0.6;
      grade.uFlash.value = k * k;
    }, ease.linear);
    grade.uAberration.value = aberration;
    this.shimmer?.stop(3);
  }

  // ---------------------------------------------------------------- Chapter 3: the crash site
  // The lake shore, built once. `body: false` leaves Abin Sur out (the Corps has taken him home by
  // the time Hal flies back from Oa). The ring starts on Abin Sur's hand unless Hal already wears it.
  setupCrash({ body = true } = {}) {
    if (this.site) return this.site;
    this.bedroom?.dispose();
    this.lightningOff?.();
    const site = (this.site = new CrashSite(this).build());

    // Abin Sur, the lantern and the ring
    const ring = (this.ring ??= createRing());
    if (body) {
      const abin = (this.abin = createAbinSur(this.assets.characters.abin));
      abin.root.position.copy(ABIN_SPOT);
      abin.root.rotation.y = ABIN_YAW;
      site.scene.add(abin.root);
      const abinAnim = (this.abinAnim = new Animator(abin));
      abinAnim.play(still(POSES.sitGround, 1.8), 0);
      abinAnim.overlay = (p, t) => { p.kx += Math.sin(t * 0.6) * 0.04; p.cx += Math.sin(t * 2.6) * 0.012; };
      site.updaters.push((dt) => abinAnim.update(dt));
      this.abinBody = site.physics.fixedCollider(RAPIER.ColliderDesc.capsule(0.35, 0.35), { x: ABIN_SPOT.x + Math.sin(ABIN_YAW) * 0.45, y: ABIN_SPOT.y + 0.4, z: ABIN_SPOT.z + Math.cos(ABIN_YAW) * 0.45 });
      this.abinLight = new THREE.PointLight(0x55ff88, 1.1, 3, 2);
      abin.bones.chest.add(this.abinLight);
      this.abinLight.position.set(0, 0.1, 0.25);
      if (!ring.parent) this.attachRing(ring, abin);
    }
    this.lantern ??= createLantern();
    this.lantern.rotation.y = 0.4;
    this.placeLantern(site, LANTERN_SPOT);
    this.trail = new Particles(400, { additive: true, drag: 1.5, turbulence: 1.5 });
    site.scene.add(this.trail.points);
    site.updaters.push((dt, t) => this.trail.update(dt, t, this.engine.camera, this.engine.renderer));
    site.updaters.push(() => {
      site.water.userData.setLight(4, this.ring.getWorldPosition(_rp), _green, this.ringGlow ?? 0.6);
      site.water.userData.setLight(5, this.lantern.position, _green, this.lanternScene === site ? 1.2 : 0);
    });
    this.enterCrash();
    return site;
  }

  // Make the lake shore the current scene: Hal's ground, its sounds, and the powers bound to it.
  enterCrash() {
    const { audio, site } = this;
    this.show(site);
    this.playerActive = true;
    this.player.ground = terrainHeight;
    this.player.surface = 'mud';
    this.ambience(audio.water(0.1), audio.wind(0.06), audio.crickets(0.025), audio.fire(0.22), audio.pad([73.4, 110, 146.8], 0.035, { cutoff: 380 }));
    this.powers.attach({ scene: site.scene, physics: site.physics, ground: terrainHeight, bounds: site.bounds, canLand: (x, z) => site.canLand(x, z), solid: (x, y, z) => site.inTrees(x, y, z), center: V(0, 0, 8), radius: 72 });
    for (const f of site.fires) this.powers.hazards.push({ position: f.position, radius: f.radius + 0.25, height: f.height + 0.5, dps: 24 });
    this.powers.regen = 0;
    return site;
  }

  async crashArrival() {
    const { ui, director, audio, player } = this;
    const site = this.setupCrash();
    ui.cinematic(true);
    // Hal arrives inside the light
    player.object.removeFromParent();
    site.scene.add(player.object);
    player.autoAnim = false;
    const o = player.object;
    o.rotation.set(0, Math.atan2(ABIN_SPOT.x - ARRIVAL.x, ABIN_SPOT.z - ARRIVAL.z), 0);
    o.position.copy(ARRIVAL).y += 7;
    const bubble = (this.bubble ??= createBubble(1.15));
    site.scene.add(bubble);
    bubble.visible = true;
    bubble.userData.uniforms.uOpacity.value = 1;
    site.updaters.push((dt, t) => { bubble.userData.uniforms.uTime.value = t; bubble.position.copy(o.position).y += 1.0; });
    player.animator.play(still(POSES.float, 1.5), 0);
    director.cut(V(-12, 2.2, 14.5), V(-4, 3.5, 6), 50);
    this.engine.gradeUniforms.uFlash.value = 0;
    await ui.fade(0, 0.4);
    audio.whoosh(4, 0.4);
    director.move(V(-11, 1.6, 13), V(-3.5, 1.2, 6), 4.5);
    await tween(4.5, (k) => (o.position.y = ARRIVAL.y + 7 * (1 - k)), ease.out);
    player.animator.play(still(POSES.kneel, 1.5), 0.25);
    audio.step('mud');
    await tween(0.6, (k) => (bubble.userData.uniforms.uOpacity.value = 1 - k));
    bubble.visible = false;
    await wait(1.2);
    // the wreck goes up again; he rises and looks toward it
    site.explode();
    audio.explosion(1);
    director.shake(0.9, 1.4);
    player.surface = 'mud';
    player.setTired(0.15);
    player.camDist = 3.0;
    player.spawn(site.physics, site.scene, ARRIVAL, o.rotation.y);
    player.autoAnim = true;
    player.lookAt(ABIN_SPOT.clone().add(V(0, 1, 0)), 0.8);
    await wait(1.4);
    await this.lines('arrive1', 'arrive2');
    player.lookAt(null);
    this.giveControl('Reach the wreckage');
    await waitFor(() => player.position.distanceTo(ABIN_SPOT) < 3.6);
  }

  attachRing(ring, rig) {
    const hand = rig.bones.hand_R, fore = rig.arm.R.fore;
    hand.add(ring);
    const s = 1 / rig.root.scale.x;
    ring.position.copy(fore).multiplyScalar(0.088 * s);
    ring.quaternion.setFromUnitVectors(V(0, 0, 1), fore);
    ring.scale.setScalar(1.25 * s);
  }

  headOf(rig) {
    const p = new THREE.Vector3();
    return () => rig.bonePosition('head', p);
  }

  async meetAbin() {
    const { ui, director, audio, player } = this;
    const abin = this.abin, abinAnim = this.abinAnim, ring = this.ring;
    this.takeControl();
    ui.objective(null);
    // stop ~2 m from Abin along the line Hal approached on
    const toHal = V(player.position.x - ABIN_SPOT.x, 0, player.position.z - ABIN_SPOT.z).normalize();
    const stand = ABIN_SPOT.clone().addScaledVector(toHal, 2.1);
    stand.y = terrainHeight(stand.x, stand.z);
    player.lookAt(this.headOf(abin), 1);
    await player.walkTo(stand, 1.1);
    stand.copy(player.position);
    player.turnTo(Math.atan2(-toHal.x, -toHal.z));
    abinAnim.lookAt(this.headOf(this.hal), 0.9);
    // over Hal's right shoulder toward Abin, like the concept art
    const side = V(toHal.z, 0, -toHal.x);
    director.move(stand.clone().addScaledVector(toHal, 1.6).addScaledVector(side, 0.75).setY(stand.y + 1.65), ABIN_SPOT.clone().setY(ABIN_SPOT.y + 0.7), 2.2, ease.inOut, 48);
    await wait(1);
    await this.say('abin1');
    await this.say('halHurt');
    await this.say('abin2');
    player.animator.gesture('shake', 1.3, 0.8);
    await this.say('halConfused');

    // Abin holds out his hand toward Hal; the ring lifts off it and floats across
    const chest = abin.bonePosition('chest', new THREE.Vector3());
    const offer = chest.clone().addScaledVector(toHal, 0.5).add(V(0, -0.02, 0));
    abinAnim.reach('R', offer, { pole: V(-0.6, -0.8, -0.2) });
    await wait(1.6);
    const start = ring.getWorldPosition(new THREE.Vector3());
    ring.removeFromParent();
    this.site.scene.add(ring);
    ring.position.copy(start);
    ring.scale.setScalar(2.4);
    const halFront = player.position.clone().addScaledVector(toHal.clone().negate(), 0.55).setY(player.position.y + 1.3);
    const path = new THREE.CatmullRomCurve3([start, start.clone().lerp(halFront, 0.5).add(V(0, 0.7, 0)), halFront]);
    audio.ringChime();
    this.ringGlow = 2;
    const trailOff = onFrame(() => {
      const p0 = ring.position;
      this.trail.emit(3, (p, v) => {
        p[0] = p0.x + (Math.random() - 0.5) * 0.05; p[1] = p0.y + (Math.random() - 0.5) * 0.05; p[2] = p0.z + (Math.random() - 0.5) * 0.05;
        v[0] = (Math.random() - 0.5) * 0.3; v[1] = (Math.random() - 0.5) * 0.3; v[2] = (Math.random() - 0.5) * 0.3;
      }, { life: 1.6, size: [0.05, 0.005], color: [[0.8, 4, 1.6, 1], [0.1, 1.2, 0.4, 0]] });
    });
    player.lookAt(ring.position, 1);
    abinAnim.lookAt(ring.position, 0.7);
    director.move(player.position.clone().addScaledVector(toHal, 1.3).addScaledVector(side, 0.9).setY(player.position.y + 1.6), halFront.clone().lerp(ABIN_SPOT, 0.35), 3.2, ease.inOut, 46);
    await tween(3.2, (k) => {
      ring.position.copy(path.getPointAt(k));
      ring.rotation.y += 0.05;
      ring.rotation.x = Math.sin(k * 6) * 0.4;
    });
    abinAnim.reach('R', null);
    const hover = onFrame(() => { ring.position.y = halFront.y + Math.sin(this.engine.time * 2) * 0.03; ring.rotation.y += 0.02; });
    ui.prompt('E', 'Reach for the ring');
    await waitFor(() => this.input.hit('KeyE', 'Click'));
    ui.prompt();
    // his hand goes to the ring (IK), and the ring settles onto his finger
    player.animator.reach('R', () => ring.position, { pole: V(-0.5, -0.8, -0.3) });
    await wait(1.0);
    hover();
    const from = ring.position.clone();
    await tween(0.5, (k) => {
      const hand = this.hal.bonePosition('hand_R', _rp);
      ring.position.lerpVectors(from, hand, k);
      ring.scale.setScalar(2.4 - k * 1.15);
    }, ease.in);
    trailOff();
    this.attachRing(ring, this.hal);
    this.powers.ring = ring;
    this.powers.setCharge(12); // Abin Sur's ring arrives nearly spent
    audio.ringChime();
    audio.whoosh(1, 0.5);
    ui.flash(1.4, 0.8);
    this.engine.gradeUniforms.uFlash.value = 0.5;
    tween(1.2, (k) => (this.engine.gradeUniforms.uFlash.value = 0.5 * (1 - k)));
    // he brings the hand up to look at the ring
    const view = new THREE.Vector3(), q = new THREE.Quaternion();
    player.animator.reach('R', () => {
      this.hal.bones.head.getWorldPosition(view);
      this.hal.bones.chest.getWorldQuaternion(q);
      return view.add(V(-0.05, -0.16, 0.34).applyQuaternion(q));
    }, { pole: V(-0.7, -0.7, 0) });
    const ringPos = new THREE.Vector3();
    player.lookAt(() => ring.getWorldPosition(ringPos), 1);
    this.ringGlow = 1;

    // the ring translates: the earlier alien line decodes in place
    await ui.say({ ...LINES.abin1, keep: true, hold: 0.6, voice: false });
    await ui.decode(LINES.abin1.text);
    await wait(1.2);
    ui.hideSubtitle();
    player.animator.reach('R', null);
    player.lookAt(this.headOf(abin), 1);
    abinAnim.lookAt(this.headOf(this.hal), 0.9);
    director.move(stand.clone().addScaledVector(toHal, 1.4).addScaledVector(side, -0.8).setY(stand.y + 1.5), ABIN_SPOT.clone().setY(ABIN_SPOT.y + 0.75), 3, ease.inOut, 42);
    await this.lines('abin3', 'halChose');
    abinAnim.gesture('nod', 1.2, 0.6);
    await this.lines('abin4', 'abin5', 'abin6');
    // Abin Sur dies
    abinAnim.lookAt(null);
    abinAnim.play(still(POSES.dead, 0), 3);
    audio.tone({ freq: 98, to: 82, attack: 1, peak: 0.12, dur: 5, wet: 0.8 });
    await tween(3, (k) => {
      this.abinLight.intensity = 1.1 * (1 - k);
      abin.u.uGlow.value = 0.32 * (1 - k * 0.85);
      abin.u.uTint.value.setScalar(1 - 0.18 * k);
    });
    await this.lines('halStay', 'halGone');
  }

  // The Corps has carried Abin Sur home (Part Two, back on Earth).
  removeAbin() {
    if (!this.abin) return;
    this.abin.root.removeFromParent();
    this.site.physics.world.removeRigidBody(this.abinBody);
    this.abin = null;
  }

  abinDead() {
    this.abinAnim.play(still(POSES.dead, 0), 0);
    this.abinAnim.overlay = null;
    this.abinLight.intensity = 0;
    this.abin.u.uGlow.value = 0.05;
    this.abin.u.uTint.value.setScalar(0.82);
    this.ring.removeFromParent();
  }

  async takeLantern() {
    const { player, powers } = this;
    player.lookAt(null);
    if (!this.ring.parent || this.ring.parent === this.site.scene) this.attachRing(this.ring, this.hal);
    powers.ring = this.ring;
    // the ring's interface comes up: Hal's vitals, and a nearly empty charge
    powers.enabled.hud = true;
    powers.setCharge(Math.min(powers.charge, 12));
    this.hud.show(true);
    this.giveControl('Take the lantern');
    player.camDist = 2.6;
    this.ringSay('ringBond');
    powers.markerTarget = { pos: LANTERN_SPOT.clone().add(V(0, 0.6, 0)), label: 'Power battery' };
    let it;
    await new Promise((resolve) => (it = this.site.interact({ position: LANTERN_SPOT, radius: 1.5, look: LANTERN_SPOT.clone().add(V(0, 0.3, 0)), label: 'Take the lantern', action: () => resolve() })));
    it.enabled = false;
    powers.markerTarget = null;
    await this.transform();
    await this.learnPocket();
  }

  // Straight after the first charge: the ring shows Hal where a Lantern keeps the power battery.
  async learnPocket() {
    const { hud } = this;
    this.lanternReady = true;
    this.lanternSpots(this.site);
    this.giveControl('Put the lantern away');
    this.player.camDist = 2.8;
    await wait(0.6);
    this.ringSay('ringPocket');
    hud.tutorial({ kicker: 'Power battery', n: 1, of: 1, title: 'Pocket dimension', html: 'Press <kbd>L</kbd> to keep the lantern in the ring’s pocket dimension. Press <kbd>L</kbd> again to set it down wherever you stand.<br><span class="dim">Beside it, <kbd>E</kbd> recharges the ring.</span>' });
    await waitFor(() => this.lanternStowed && !this.lanternMoving);
    hud.tutorialDone();
    this.audio.bell(880, 0.07, 1.2);
    await wait(1.0);
    await this.bark('halPocket');
    hud.tutorial(null);
    await wait(0.6);
  }

  putOnSuit() {
    const suit = (this.suit ??= createHal(this.assets.characters.lantern, { glow: 1.4, jaw: JAW.lantern }));
    this.player.setRig(suit);
    this.attachRing(this.ring, suit);
    this.powers.ring = this.ring;
    this.powers.suited = true;
    this.player.setTired(0);
    this.player.speedScale = 1.3;
  }

  // The charged ring: starter constructs unlocked, HUD up, full charge; flight too unless the
  // training is about to introduce it.
  empower(flight = true) {
    const { powers } = this;
    for (const id of [...STARTER_CONSTRUCTS, ...allUnlocks()]) powers.unlocked.add(id);
    this.save.update((d) => (d.unlocks = [...powers.unlocked]));
    Object.assign(powers.enabled, { hud: true, constructs: true, flight });
    powers.suited = true;
    powers.setCharge(100);
    this.hud.show(true);
    this.ui.powerKeys = POWER_KEYS;
  }

  async transform() {
    const { ui, director, audio, player } = this;
    const site = this.site, lantern = this.lantern;
    this.takeControl();
    ui.objective(null);
    const toLantern = V(LANTERN_SPOT.x - player.position.x, 0, LANTERN_SPOT.z - player.position.z);
    const yaw = Math.atan2(toLantern.x, toLantern.z);
    player.turnTo(yaw);
    player.lookAt(LANTERN_SPOT.clone().add(V(0, 0.25, 0)), 1);
    // ring hand reaches out toward the lantern
    const shoulder = new THREE.Vector3();
    player.animator.reach('R', () => {
      this.hal.bonePosition('upperArm_R', shoulder);
      return shoulder.add(LANTERN_SPOT.clone().add(V(0, 0.5, 0)).sub(shoulder).normalize().multiplyScalar(0.62));
    }, { pole: V(-0.4, -0.85, -0.3) });
    const c = player.position.clone();
    director.move(c.clone().add(V(Math.sin(yaw + 1.9) * 2.6, 1.3, Math.cos(yaw + 1.9) * 2.6)), c.clone().add(V(0, 1.2, 0)).lerp(LANTERN_SPOT, 0.3), 2.5, ease.inOut, 45);
    await wait(1.4);
    // lantern beam to the ring
    const ringPos = this.ring.getWorldPosition(new THREE.Vector3());
    const beamFrom = LANTERN_SPOT.clone().add(V(0, 0.25, 0));
    const beam = createShaft({ from: beamFrom, to: ringPos, radiusFrom: 0.04, radiusTo: 0.08, color: new THREE.Color(0.5, 2.5, 1.0) });
    site.scene.add(beam);
    audio.riser(4, 0.5);
    const swell = audio.pad([146.8, 220, 293.7, 370], 0, { cutoff: 1400, fadeIn: 1 });
    swell.level(0.07, 3);
    await tween(2, (k) => {
      beam.userData.uniforms.uOpacity.value = k * 2;
      lantern.userData.light.intensity = 1.2 + k * 6;
      lantern.userData.glass.material.emissiveIntensity = 2.2 + k * 4;
      this.ringGlow = 1 + k * 3;
    });
    // The oath. Each line pours more of the lantern's light into the ring: 12% to 100%.
    this.hud.ringhud.classList.add('force');
    // low, from beyond the lantern: the lantern in the foreground, Hal's face lit by it, slowly closing in
    const toHal = c.clone().sub(LANTERN_SPOT).setY(0).normalize(), across = V(toHal.z, 0, -toHal.x);
    const oathCam = (back, side, up) => LANTERN_SPOT.clone().addScaledVector(toHal, -back).addScaledVector(across, side).setY(LANTERN_SPOT.y + up);
    director.cut(oathCam(1.3, 0.9, 0.5), c.clone().add(V(0, 1.4, 0)), 42);
    director.move(oathCam(0.7, 0.75, 0.62), c.clone().add(V(0, 1.5, 0)), 11, ease.inOut, 36);
    const oath = ['oath1', 'oath2', 'oath3', 'oath4'];
    for (let i = 0; i < oath.length; i++) {
      const from = this.powers.charge, to = 12 + (88 * (i + 1)) / oath.length;
      audio.tone({ freq: [293.7, 370, 440, 587.3][i], peak: 0.06, dur: 2.4, wet: 0.7 });
      const fill = tween(2.2, (k) => {
        this.powers.setCharge(from + (to - from) * k);
        const glow = (i + k) / oath.length;
        lantern.userData.light.intensity = 7.2 + glow * 8;
        lantern.userData.glass.material.emissiveIntensity = 6.2 + glow * 5;
        beam.userData.uniforms.uOpacity.value = 2 + glow * 1.5;
        this.ringGlow = 4 + glow * 3;
      });
      await this.say(oath[i], { hold: i === oath.length - 1 ? 1.0 : 0.25 });
      await fill;
    }
    audio.ringChime();
    this.ringSay('ringFull');
    for (const id of STARTER_CONSTRUCTS) this.powers.unlocked.add(id);
    Save.update((d) => (d.unlocks = [...new Set([...(d.unlocks ?? []), ...STARTER_CONSTRUCTS])]));
    await wait(0.6);
    this.hud.ringhud.classList.remove('force');

    // the suit: casual Hal sweeps away as the Lantern uniform sweeps in (both bodies, one motion)
    const suit = (this.suit = createHal(this.assets.characters.lantern, { glow: 1.4, jaw: JAW.lantern }));
    player.mount(suit);
    player.animator.addRig(suit);
    const uOld = this.hal.u, uNew = suit.u;
    uOld.uDissolveOn.value = 1; uOld.uDissolveSign.value = 1;
    uNew.uDissolveOn.value = 1; uNew.uDissolveSign.value = -1;
    const orb = new GreenOrb({ scale: 2.2, lightIntensity: 30, lightRange: 10 });
    orb.addTo(site.scene);
    orb.group.position.copy(player.position).y += 1.0;
    site.updaters.push((dt, t) => orb.update(dt, t, this.engine.camera, this.engine.renderer));
    audio.whoosh(2.5, 0.7);
    ui.flash(1.6, 0.6);
    player.animator.reach('R', null);
    player.lookAt(null);
    director.orbit(player.position, 3, 1.2, yaw + 1.9, yaw + 1.9 + Math.PI * 1.6, 6.5, V(0, 1.1, 0));
    await tween(4.5, (k) => {
      orb.intensity = Math.sin(k * Math.PI) * 1.2;
      uOld.uDissolve.value = -0.1 + k * 1.25;
      uNew.uDissolve.value = -0.1 + k * 1.25;
      beam.userData.uniforms.uOpacity.value = 2 * (1 - k);
    }, ease.inOut);
    uNew.uDissolveOn.value = 0;
    beam.removeFromParent();
    this.ring.removeFromParent();
    player.setRig(suit);
    this.attachRing(this.ring, suit);
    this.powers.suited = true;
    player.autoAnim = false;
    player.animator.play(still(POSES.heroStand, 1), 1.2);
    audio.ringChime();
    audio.bell(293.7, 0.2, 5);
    await wait(2.4);
    await this.say('halWhoa');
    swell.stop(5);
    player.setTired(0);
    player.speedScale = 1.3;
    player.autoAnim = true;
  }

  // ---------------------------------------------------------------- Chapter 4: the ring's power
  // A short training at Abin Sur's side: the construct wheel, the fist, the shield against the
  // wreck's core going up, the wall, then flight and landing. Each step waits for the player.
  async ringTraining() {
    const { player, powers, hud, audio } = this;
    this.empower(false);
    this.giveControl('Learn what the ring can do');
    player.camDist = 2.8;
    const of = 6;
    const step = (n, title, html) => hud.tutorial({ n, of, title, html });
    const done = async () => { hud.tutorialDone(); audio.bell(880, 0.07, 1.2); await wait(1.3); };
    this.ringSay('ringOnline');
    await wait(2.5);

    // 1. the wheel (players who got there first skip ahead)
    step(1, 'Construct wheel', 'Press <kbd>4</kbd> to open the construct wheel. Time stops while it is open.');
    await waitFor(() => powers.wheelState || powers.selected === 'fist');
    step(1, 'Construct wheel', 'Move the mouse onto the <b>Fist</b> and click to choose it.<br><span class="dim">Locked shapes open up as your will grows.</span>');
    await waitFor(() => powers.selected === 'fist' && !powers.wheelState);
    await done();

    // 2. strike: a burning hull plate comes down beside Abin Sur
    const plate = this.throwPlate();
    await wait(1.6);
    this.ringSay('ringDebris');
    step(2, 'Strike', 'The ghost shows where the fist will land. Aim at the burning plate and <kbd>Click</kbd>.<br><span class="dim">Scroll to change the range. Fists reach 14 m.</span>');
    powers.markerTarget = { pos: plate.mesh.position, label: 'Burning debris' };
    await waitFor(() => plate.rested);
    await waitFor(() => plate.mesh.position.distanceTo(plate.rest) > 2.5);
    powers.markerTarget = null;
    await done();
    this.bark('halPunch');

    // 3. shield: the wreck's power core goes up
    const core = V(6.3, 1.0, -2.8);
    this.ringSay('ringCore');
    await wait(2);
    step(3, 'Shield', 'Open the wheel with <kbd>4</kbd> and choose the <b>Shield</b>.');
    powers.markerTarget = { pos: core, label: 'Power core' };
    await Promise.race([waitFor(() => powers.selected === 'shield' && !powers.wheelState), wait(30)]);
    step(3, 'Shield', 'Face the wreck and <b>hold</b> <kbd>Click</kbd> to raise the shield.');
    await Promise.race([waitFor(() => powers.shield?.form > 0.9), wait(12)]);
    this.ringSay('ringBreach');
    const hurt = await this.coreBreach(core);
    powers.markerTarget = null;
    await wait(1.2);
    if (hurt < 1) { this.ringSay('ringHeld'); this.bark('halShield'); } else { this.ringSay('ringHurt'); this.bark('halHit'); }
    await wait(1.2);
    await done();

    // 4. wall
    const walls = powers.stats.walls;
    step(4, 'Wall', 'Choose the <b>Wall</b>, aim at the ground and <kbd>Click</kbd> to raise it.<br><span class="dim">Walls stand for 20 seconds. The player and debris collide with them.</span>');
    await waitFor(() => powers.stats.walls > walls || powers.walls.some((w) => !w.ending));
    this.ringSay('ringWall');
    await wait(1.5);
    await done();

    // 5. flight
    powers.enabled.flight = true;
    this.ringSay('ringFlight');
    step(5, 'Flight', 'Double-tap <kbd>Space</kbd> to fly.');
    await waitFor(() => player.flying);
    step(5, 'Flight', '<kbd>W</kbd> fly where you look &nbsp;<kbd>Space</kbd> climb &nbsp;<kbd>C</kbd> descend &nbsp;<kbd>Shift</kbd> boost.<br>Climb above the treeline.');
    await waitFor(() => player.position.y > 14);
    this.bark('halFly');
    await done();

    // 6. landing
    step(6, 'Landing', 'Fly down until you touch the ground, or double-tap <kbd>Space</kbd> to drop. Land beside Abin Sur.');
    powers.markerTarget = { pos: ABIN_SPOT.clone().add(V(0, 0.9, 0)), label: 'Abin Sur' };
    await waitFor(() => !player.flying && player.grounded);
    powers.markerTarget = null;
    await done();
    hud.tutorial(null);
    this.lanternSpots(this.site);
    this.ringSay('ringDone');
    await wait(6);

    const pick = await this.ui.screen({
      emblem: true,
      kicker: 'Part One complete',
      title: 'GREEN LANTERN',
      subtitle: 'Awakening',
      body: 'Sector 2814 has a new guardian. Abin Sur’s ring chose a man without fear. What Hal does with it is another story.',
      buttons: ['Explore as Green Lantern', { label: 'Part Two: The Corps', sub: 'The summons' }, 'Play again'],
    });
    if (pick === 1) { CorpsSave.resumeAfterReload(CorpsSave.first); return new Promise(() => {}); }
    if (pick === 2) { Save.newGame(); location.hash = ''; location.reload(); }
  }

  // A burning hull plate flung from the wreck to land beside Abin Sur. Its fire rides along, burns
  // Hal if he stands in it, and goes out if the plate ends up in the lake.
  throwPlate() {
    const site = this.site, audio = this.audio;
    // open ground near Abin Sur, clear of the hull, about 4.5 m from wherever Hal is standing
    const from = V(6.0, 1.6, -2.4), hal = this.player.position, ship = V(6.2, 0, -2.9);
    let to = null, best = Infinity;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) for (const r of [2.6, 3.4]) {
      const c = ABIN_SPOT.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (terrainHeight(c.x, c.z) < 0.08 || Math.hypot(c.x - ship.x, c.z - ship.z) < 3.4 || c.distanceTo(LANTERN_SPOT) < 1.5) continue;
      const score = Math.abs(Math.hypot(c.x - hal.x, c.z - hal.z) - 4.5);
      if (score < best) { best = score; to = c; }
    }
    to ??= ABIN_SPOT.clone().add(V(-1.3, 0, 1.25));
    to.y = terrainHeight(to.x, to.z) + 0.25;
    const T = 0.9;
    const vel = { x: (to.x - from.x) / T, y: (to.y - from.y + 4.905 * T * T) / T, z: (to.z - from.z) / T };
    site.explode(V(6.2, 0.8, -2.6), 2.5);
    audio.explosion(0.45);
    this.director.shake(0.3, 0.6);
    const plate = site.spawnDebris(from, { size: [0.75, 0.09, 0.55], velocity: vel, spin: 3, density: 260 });
    const fire = new Fire(plate.mesh.position, { radius: 0.32, height: 0.65, rate: 50 });
    site.scene.add(fire.group);
    const state = { ...plate, fire, rested: false, rest: new THREE.Vector3(), t: 0, out: false };
    this.powers.hazards.push({ position: fire.position, radius: 0.75, height: 1.2, dps: 20, active: () => fire.intensity > 0.3 });
    site.updaters.push((dt, t) => {
      state.t += dt;
      fire.position.copy(plate.mesh.position);
      fire.light.position.copy(plate.mesh.position).y += 0.35;
      fire.update(dt, t, this.engine.camera, this.engine.renderer);
      const lv = plate.body.linvel();
      if (!state.rested && state.t > 1.2 && (Math.hypot(lv.x, lv.y, lv.z) < 0.25 || state.t > 4)) { state.rested = true; state.rest.copy(plate.mesh.position); }
      // doused in the lake
      if (!state.out && plate.mesh.position.y < WATER_LEVEL + 0.02) {
        state.out = true;
        this.powers.splashFx(plate.mesh.position, 0.8);
        audio.burst({ type: 'highpass', from: 3000, peak: 0.25, dur: 1.4, wet: 0.3 });
      }
      if (state.out) { fire.intensity = Math.max(0, fire.intensity - dt * 2); plate.mat.emissiveIntensity = Math.max(0.05, plate.mat.emissiveIntensity - dt * 0.8); }
      else fire.intensity = Math.max(fire.intensity, 0.8);
    });
    return state;
  }

  // The power core blows: a shockwave, then burning chunks hurled at Hal. A shield facing the wreck
  // stops both (the chunks physically bounce off it). Returns the damage Hal took.
  async coreBreach(core) {
    const { site, powers, audio, director, player, engine } = this;
    site.shipGlow.emissiveIntensity = 4;
    audio.riser(1.4, 0.35);
    director.shake(0.15, 1.4);
    await wait(1.4);
    const h0 = powers.health;
    site.explode(core, 6);
    audio.explosion(1.1);
    director.shake(0.9, 1.2);
    engine.gradeUniforms.uFlash.value = 0.35;
    tween(0.8, (k) => (engine.gradeUniforms.uFlash.value = 0.35 * (1 - k)));
    powers.damage(16, core);
    const target = player.position.clone().add(V(0, 1.1, 0));
    const chunks = [];
    for (let i = 0; i < 7; i++) {
      const from = core.clone().add(V((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2));
      const aim = target.clone().add(V((Math.random() - 0.5) * 0.9, (Math.random() - 0.3) * 0.7, (Math.random() - 0.5) * 0.9));
      const T = 0.45 + Math.random() * 0.25;
      const vel = { x: (aim.x - from.x) / T, y: (aim.y - from.y + 4.905 * T * T) / T, z: (aim.z - from.z) / T };
      chunks.push({ ...site.spawnDebris(from, { size: [0.22 + Math.random() * 0.12, 0.08, 0.18], velocity: vel, spin: 8, density: 700 }), hit: false });
    }
    const center = new THREE.Vector3();
    const stop = onFrame(() => {
      center.copy(player.position).y += 1.0;
      for (const c of chunks) {
        if (c.hit || c.mesh.position.distanceTo(center) > 0.85) continue;
        const v = c.body.linvel();
        if (Math.hypot(v.x, v.y, v.z) < 3) continue;
        c.hit = true;
        powers.damage(8, c.mesh.position);
      }
    });
    await wait(2.2);
    stop();
    return h0 - powers.health;
  }

  // ---------------------------------------------------------------- the lantern and the pocket dimension
  // A Lantern keeps the power battery in the ring's pocket dimension between charges. L puts it
  // away (from wherever it stands) or sets it down in front of Hal; beside it, E recharges the ring,
  // or puts it away once the ring is full. Works in whichever scene the powers are attached to.
  lanternSpots(sceneObj = this.current) {
    if (!sceneObj?.interact || sceneObj.lanternSpots) return;
    this.lanternSpot ??= LANTERN_SPOT.clone();
    this.lanternLook ??= this.lanternSpot.clone().add(V(0, 0.3, 0));
    const here = () => this.lanternReady && !this.lanternStowed && !this.lanternMoving && this.lanternScene === sceneObj;
    const def = { position: this.lanternSpot, radius: 1.5, look: this.lanternLook };
    const recharge = sceneObj.interact({ ...def, label: 'Recharge the ring', action: () => this.recharge() });
    Object.defineProperty(recharge, 'enabled', { get: () => here() && this.powers.charge < 99.5 });
    const stow = sceneObj.interact({ ...def, label: 'Put the lantern away', action: () => this.stowLantern() });
    Object.defineProperty(stow, 'enabled', { get: () => here() && this.powers.charge >= 99.5 });
    sceneObj.lanternSpots = [recharge, stow];
  }

  // Stand the lantern at a spot in a scene (no effect), with a small collider so Hal walks round it.
  placeLantern(sceneObj, spot) {
    const l = (this.lantern ??= createLantern());
    this.removeLanternBody();
    (this.lanternSpot ??= new THREE.Vector3()).copy(spot);
    (this.lanternLook ??= new THREE.Vector3()).copy(spot).y += 0.3;
    sceneObj.scene.add(l);
    l.position.copy(spot);
    l.scale.setScalar(1);
    this.lanternScene = sceneObj;
    this.lanternStowed = false;
    this.lanternBody = sceneObj.physics.fixedCollider(RAPIER.ColliderDesc.cylinder(0.24, 0.14), { x: spot.x, y: spot.y + 0.24, z: spot.z });
    this.lanternWorld = sceneObj.physics;
  }

  removeLanternBody() {
    if (this.lanternBody) this.lanternWorld.world.removeRigidBody(this.lanternBody);
    this.lanternBody = null;
  }

  // The lantern is already in the pocket dimension (a checkpoint after the first charge, or travel).
  pocketLantern() {
    this.lanternReady = true;
    this.removeLanternBody();
    this.lantern?.removeFromParent();
    this.lanternStowed = true;
    this.lanternScene = null;
  }

  toggleLantern() {
    const { player, powers } = this;
    if (!this.lanternStowed) {
      // too far off to see: the ring simply recalls it
      if (this.lanternScene !== this.current || player.position.distanceTo(this.lantern.position) > 30) { this.pocketLantern(); this.audio.ringBlip(); this.ringSay('ringStowed'); return; }
      return this.stowLantern();
    }
    if (player.flying || !player.grounded) { powers.say('Land to set the lantern down.', { voice: false }); return; }
    const spot = player.position.clone().add(V(Math.sin(player.yaw) * 1.25, 0, Math.cos(player.yaw) * 1.25));
    if (!player.air?.canLand(spot.x, spot.z)) { this.audio.denied(); powers.say('No footing for the lantern here.', { voice: false }); return; }
    spot.y = powers.ground(spot.x, spot.z);
    return this.summonLantern(spot);
  }

  // The ring hand reaches toward a world point (null lets it go).
  ringReach(point, dist = 0.62) {
    const rig = this.player.rig, sh = new THREE.Vector3(), aim = point?.clone();
    this.player.animator.reach('R', aim ? () => { rig.bonePosition('upperArm_R', sh); return sh.add(_rq.copy(aim).sub(sh).normalize().multiplyScalar(dist)); } : null, { pole: V(-0.4, -0.85, -0.3), rate: 7 });
  }

  openRift(sceneObj, at, radius, flow) {
    const { engine } = this;
    const rift = new Rift(radius).addTo(sceneObj.scene);
    rift.group.position.copy(at);
    rift.flow = flow;
    const stop = onFrame((dt) => rift.update(dt, engine.time, engine.camera, engine.renderer));
    rift.close = async () => { rift.open = 0; await wait(0.8); stop(); rift.dispose(); }; // let the last motes die out
    return rift;
  }

  // Into the pocket dimension: the ring hand reaches out, a rift tears open above the lantern, and
  // the lantern lifts, turns and shrinks into it before it seals with a flash.
  async stowLantern() {
    if (this.lanternStowed || this.lanternMoving) return;
    const { audio, powers } = this, l = this.lantern, sceneObj = this.lanternScene;
    this.lanternMoving = true;
    const from = l.position.clone(), mouth = from.clone().add(V(0, 0.95, 0));
    const rift = this.openRift(sceneObj, mouth, 0.42, 1);
    this.ringReach(mouth, 0.9);
    audio.rift(true);
    await tween(0.35, (k) => (rift.open = k), ease.out);
    this.removeLanternBody();
    const spin = l.rotation.y, glass = l.userData.glass.material;
    await tween(0.8, (k) => {
      const e = ease.inOut(k);
      l.position.lerpVectors(from, mouth, e);
      l.position.y += Math.sin(k * Math.PI) * 0.12;
      l.rotation.y = spin + e * 5;
      l.scale.setScalar(1 - 0.9 * ease.in(k));
      l.userData.light.intensity = 1.2 + k * 5;
      glass.emissiveIntensity = 2.2 + k * 4;
    }, ease.linear);
    l.removeFromParent();
    l.userData.light.intensity = 1.2;
    glass.emissiveIntensity = 2.2;
    powers.flash.position.copy(mouth);
    powers.flash.intensity = 14;
    audio.rift(false);
    await tween(0.22, (k) => (rift.open = 1 - k), ease.in);
    rift.close();
    this.ringReach(null);
    this.lanternStowed = true;
    this.lanternScene = null;
    this.lanternMoving = false;
  }

  // Out of the pocket dimension: a rift opens at chest height in front of Hal and the lantern drops
  // out of it, growing to full size as it settles onto the ground.
  async summonLantern(spot) {
    const { audio, powers } = this, sceneObj = this.current, l = (this.lantern ??= createLantern());
    this.lanternMoving = true;
    const mouth = spot.clone().add(V(0, 0.95, 0));
    const rift = this.openRift(sceneObj, mouth, 0.42, -1);
    this.ringReach(mouth, 0.9);
    audio.rift(true);
    await tween(0.3, (k) => (rift.open = k), ease.out);
    sceneObj.scene.add(l);
    const base = this.player.yaw + 0.4, glass = l.userData.glass.material;
    await tween(0.75, (k) => {
      l.position.lerpVectors(mouth, spot, ease.inOut(k));
      l.scale.setScalar(0.1 + 0.9 * ease.out(k));
      l.rotation.y = base + (1 - ease.out(k)) * 5;
      l.userData.light.intensity = 6 - k * 4.8;
      glass.emissiveIntensity = 6 - k * 3.8;
    }, ease.linear);
    this.placeLantern(sceneObj, spot);
    powers.dustFx(spot, 10, 0.8);
    audio.step(this.player.surface);
    audio.rift(false);
    await tween(0.25, (k) => (rift.open = 1 - k), ease.in);
    rift.close();
    this.ringReach(null);
    this.lanternMoving = false;
  }

  async recharge() {
    const { player, powers, audio, lantern } = this;
    const spot = this.lanternSpot.clone();
    this.takeControl();
    const yaw = Math.atan2(spot.x - player.position.x, spot.z - player.position.z);
    player.turnTo(yaw);
    player.lookAt(spot.clone().add(V(0, 0.25, 0)), 1);
    const shoulder = new THREE.Vector3(), rig = player.rig;
    player.animator.reach('R', () => {
      rig.bonePosition('upperArm_R', shoulder);
      return shoulder.add(spot.clone().add(V(0, 0.5, 0)).sub(shoulder).normalize().multiplyScalar(0.62));
    }, { pole: V(-0.4, -0.85, -0.3) });
    const c = player.position.clone();
    this.director.move(c.clone().add(V(Math.sin(yaw + 1.9) * 2.6, 1.4, Math.cos(yaw + 1.9) * 2.6)), c.clone().add(V(0, 1.2, 0)).lerp(spot, 0.35), 1.6, ease.inOut, 45);
    await wait(0.8);
    const beam = createShaft({ from: spot.clone().add(V(0, 0.25, 0)), to: this.ring.getWorldPosition(new THREE.Vector3()), radiusFrom: 0.04, radiusTo: 0.07, color: new THREE.Color(0.5, 2.5, 1.0) });
    this.current.scene.add(beam);
    audio.riser(2.2, 0.35);
    const from = powers.charge;
    this.hud.ringhud.classList.add('force');
    const fill = tween(2.4, (k) => {
      powers.setCharge(from + (100 - from) * k);
      beam.userData.uniforms.uOpacity.value = Math.sin(k * Math.PI) * 2.5;
      lantern.userData.light.intensity = 1.2 + Math.sin(k * Math.PI) * 8;
      this.ringGlow = 1 + Math.sin(k * Math.PI) * 4;
    });
    await this.say('recharge', { hold: 0.6 });
    await fill;
    beam.removeFromParent();
    audio.ringChime();
    this.hud.ringhud.classList.remove('force');
    player.animator.reach('R', null);
    player.lookAt(null);
    this.ringSay('ringRecharged');
    this.giveControl();
  }

  // Health ran out: the light fades, and the checkpoint restarts.
  async collapse() {
    const { player, ui } = this;
    this.takeControl();
    player.stopFlying(true);
    player.autoAnim = false;
    player.animator.play(still(POSES.kneel, 1.6), 0.5);
    this.hud.tutorial(null);
    await ui.fade(1, 1.6);
    await ui.screen({ kicker: 'Hal is down', title: 'THE LIGHT FADES', body: 'Even the ring can only do so much. Keep a shield between you and the fire.', buttons: ['Restart checkpoint'] });
    this.save.resumeAfterReload(this.checkpointId);
  }

  async explore() {
    this.empower(true);
    this.lanternSpots(this.site);
    this.giveControl('Explore the crash site');
    await new Promise(() => {}); // free roam until the player quits from the pause menu
  }
}

const _rp = new THREE.Vector3(), _rq = new THREE.Vector3();
const _green = new THREE.Color(0.3, 1, 0.5);
