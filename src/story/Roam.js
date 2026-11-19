import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { Exile, CAROL_IN, HANGAR_MOUTH } from './Exile.js';
import { Corps } from './Corps.js';
import { voyage } from './Voyage.js';
import { StreetLife } from './KorugarLife.js';
import { POWER_KEYS } from './Story.js';
import { POSES, still, makePose } from '../characters/Poses.js';
import { createKatma } from '../characters/Characters.js';
import { loadProps } from '../props/Props.js';
import { LOT } from '../scenes/Ferris.js';
import { Bedroom } from '../scenes/Bedroom.js';
import { CityLife } from './CityLife.js';
import { createSky } from '../fx/Sky.js';
import { DayCycle } from '../scenes/DayCycle.js';
import { LifeSave } from '../engine/Save.js';
import { Life, STATS, MAX_STAT, SHIFT_PAY, money } from './Life.js';
import { Traffic } from '../city/Traffic.js';
import { Emergencies } from './Emergencies.js';
import { Pressure } from './Pressure.js';
import { ARRIVAL as LAKE_ARRIVAL, SHIP } from '../scenes/CrashSite.js';
import { HAL_START } from '../scenes/Oa.js';
import { HALL } from '../scenes/Hall.js';
import { ARRIVAL as KOR_ARRIVAL, TAVERN } from '../scenes/Korugar.js';
import { YSMAULT_PROPS, LANDING as YS_LANDING } from '../scenes/Ysmault.js';
import { QWARD_PROPS, RIFT_AT, AMBUSH } from '../scenes/Qward.js';
import { Thunderers, loadThunderers } from '../enemies/Thunderers.js';
import { Drive } from '../vehicles/Drive.js';
import { constructMesh, keyGeometry } from '../powers/Constructs.js';
import { createShaft } from '../fx/GreenLight.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _air = new THREE.Vector3();

// Where free roam goes. `world` is the ring's (the voyage's route); `jump` is how high Hal must fly
// for the ring to open the star chart there (over the city's towers in the valley, over Korugar's).
const PLACES = {
  ferris: { world: 'earth', name: 'Ferris Aircraft', sub: 'The field · Hangar Two, where Part Seven starts', jump: 110 },
  coast: { world: 'earth', name: 'Coast City', sub: 'Hal’s street and the boulevard', jump: 110 },
  lake: { world: 'earth', name: 'The lake', sub: 'Abin Sur’s ship', jump: 26 },
  oa: { world: 'oa', name: 'Oa', sub: 'Sector 0 · Kilowog’s range, the Guardians’ hall', jump: 30 },
  korugar: { world: 'korugar', name: 'Korugar', sub: 'Sector 1417 · the capital, after Sinestro', jump: 75 },
  ysmault: { world: 'ysmault', name: 'Ysmault', sub: 'Sector 666 · Atrocitus in his chains', jump: 36 },
  qward: { world: 'qward', name: 'Qward', sub: 'The antimatter universe · the Thunderers', jump: 45 },
  home: { world: 'earth', name: 'Hal’s apartment', sub: 'Up the stairs, behind the lot', jump: Infinity }, // (indoors: no star chart; not on the travel menu)
};
const CHART_NOTES = {
  earth: 'Home. Coast City, Ferris Aircraft, the lake where Abin Sur fell.',
  korugar: 'Sinestro’s world. His statue is down; Katma Tui keeps it now.',
  ysmault: 'The dead world of the Inversions. Atrocitus, back in his chains.',
};
const EARTH = ['coast', 'ferris', 'lake'], AWAY = ['oa', 'korugar', 'ysmault', 'qward'];
const AIRLESS = new Set(['oa', 'ysmault', 'qward']);
// a shopkeeper's thanks by their voice (Roam.shopBuy)
const THANKS = { townm1: 'thxM1', townm2: 'thxM2', townm3: 'thxM3', townf1: 'thxF1', townf2: 'thxF2', townf3: 'thxF3' };
const TAKES = { wash: 0.75, haircut: 0.5, shave: 0.3, press: 1.0, movie: 2.0, workout: 1.0 }; // (hours: what a purchase takes)
const SECTORS = { oa: 'SECTOR 0', korugar: 'SECTOR 1417', ysmault: 'SECTOR 666', qward: 'QWARD' }; // (off Earth the clock's place shows where he is) // (no air for a man out of the uniform; Korugar has its people's)
const CIVILIAN_KEYS = '<b>T</b> Green Lantern &nbsp; <b>L</b> lantern &nbsp; <b>M</b> travel';
const LANTERN_KEYS = `${POWER_KEYS} &nbsp; <b>T</b> Hal Jordan &nbsp; <b>M</b> travel &nbsp; <b>E</b> high up: star chart`;

// Free roam, after Part Six (the user's call, 2026-11-17, and their notes the same day: "I really
// can't travel in space as a Green Lantern", "I should be able to change into Hal Jordan, and use my
// car", "make keys with my ring"). Everywhere the story has been, open:
// - Earth: the valley (Ferris Aircraft and Coast City on one desert floor, the road between them) and
//   the lake. Hal's car in his space by the hangars: as Hal he makes a key with the ring (unless it's
//   out of charge), gets in, drives it anywhere, gets out where he stops.
// - Oa (Kilowog's range for another round, the Guardians in their hall, the Battery topping the ring
//   up), Korugar (its streets after Sinestro, Katma Tui by his fallen statue), Ysmault (Atrocitus in
//   his chains), Qward (the Thunderers, as many waves as he calls).
// The star chart (E, flying high anywhere) sets a course to another world: the voyage, or a breach to
// Qward and back. M is the ring's travel menu, the same places by name. T changes: the suit sweeping
// off into his clothes, or back on (it needs charge). L sets the lantern down, or puts it away, on any
// world; beside it, E recharges the ring (the whole oath when it's low).
export class Roam extends Exile {
  steps() { return { ...super.steps(), world: () => this.openWorld() }; }

  update(dt, t, real) {
    super.update(dt, t, real);
    if (!this.roaming) return;
    const free = this.player.control && !this.busy && !this.menuOpen && !this.chart.isOpen && !this.powers.wheelState && !this.lanternMoving;
    if (free && this.input.hit('KeyM')) { this.input.consume?.('KeyM'); this.travelMenu(); }
    else if (free && this.input.hit('KeyT')) { this.input.consume?.('KeyT'); this.changeClothes(); }
    else if (free && this.life && this.input.hit('KeyK')) { this.input.consume?.('KeyK'); this.ringStats(); }
    if (dt > 0) this.roamTick?.(dt);
    // in sight or out of it, on Earth's streets (he changes only where no one can see him)
    const earth = this.current === this.ferrisScene && this.cityLife?.started && !this.driving;
    this.ui.watching(earth && this.player.control ? this.watchers().length : null);
    if (dt > 0) this.updateAir(dt);
    this.updateDay(dt);
  }

  // ---------------------------------------------------------------- the day
  // Earth's clock runs wherever he is (scenes/DayCycle.js); the valley shows it when he's there
  updateDay(dt) {
    const dc = this.dayCycle;
    if (!dc || !this.roaming) return;
    if (dt > 0) dc.tick(dt);
    const here = this.current === this.ferrisScene, cam = this.engine.camera;
    if (here) { dc.apply(cam); dc.update(dt, cam); } else dc.quiet();
    // the rent coming due, and late (a day's turning over)
    if (this.life && dc.day !== this.dayShown) {
      if (this.dayShown != null) {
        const st = this.life.rentState(dc.day);
        if (st.late > 0) this.ui.toast(`The rent is ${st.late} day${st.late > 1 ? 's' : ''} late · ${money(st.owed)} to Sal${st.late > 4 ? ' before he changes the lock' : ''}`);
        else if (st.soon) this.ui.toast(`The rent is due ${st.due === dc.day ? 'today' : 'tomorrow'} · ${money(st.owed)}, at the flat`);
      }
      this.dayShown = dc.day;
    }
    const world = PLACES[this.roam?.where]?.world;
    const text = world && world !== 'earth' ? SECTORS[world] : dc.clock;
    if (text !== this.clockShown) { this.clockShown = text; this.ui.clock(text); }
  }

  // ---------------------------------------------------------------- no air
  // Out of the uniform on a world with no air for him (the user: on Oa or Ysmault he "suffocates,
  // badly"; Qward too): a breath held, then the colour draining and the edges closing in, his heart
  // racing, his health going faster and faster (gone in about seven seconds), his hands at his throat,
  // his legs going. T forms the uniform, the ring's life support; if he goes down, the ring forms it on
  // him at the last (`collapse`).
  updateAir(dt) {
    const { player, powers, engine, audio } = this, g = engine.gradeUniforms;
    const choking = this.roaming && this.civilian && AIRLESS.has(PLACES[this.roam?.where]?.world) && !powers.dead && this.current !== this.flat;
    const c = this.choke;
    if (choking && !c) {
      this.choke = { t: 0, beat: 0.6, said: 0 };
      this.ringSay('ringNoAir');
      this.hud.vitals.classList.add('show');
      const throat = (side) => { const at = V(0, 0, 0); return () => { const y = player.yaw; player.rig.bonePosition('neck', at); return at.add(_air.set(Math.sin(y) * 0.11 + Math.cos(y) * side * 0.04, -0.03, Math.cos(y) * 0.11 - Math.sin(y) * side * 0.04)); }; };
      this.chokeHands = [throat(1), throat(-1)]; // (each its own vector: the animator reads both before it solves either)
    }
    if (!this.choke) return;
    const k = this.choke;
    if (choking) {
      k.t += dt;
      // the held breath, then a drain that grows: about 7.5 s from the first breath to the last
      if (k.t > 1.5) { powers.health = Math.max(0, powers.health - (5 + 4 * (k.t - 1.5)) * dt); powers.lastHurt = 0; }
      if (k.t > 1.2 && k.said < 1) { k.said = 1; this.bark('halNoAir1'); }
      if (k.t > 4.2 && k.said < 2) { k.said = 2; this.bark('halNoAir2'); }
      if (k.t > 0.8 && !k.hands && player.control) { k.hands = true; player.animator.reach('L', this.chokeHands[0], { weight: 0.9, rate: 5 }); player.animator.reach('R', this.chokeHands[1], { weight: 0.9, rate: 5 }); }
      // his heart: faster as it goes, the red at the edges with every beat
      if ((k.beat -= dt) < 0) { k.beat = THREE.MathUtils.lerp(0.95, 0.38, Math.min(1, k.t / 7)); audio.heartbeat(); powers.hurtFx = Math.min(0.85, powers.hurtFx + 0.12 + 0.05 * k.t); }
      player.hamper = THREE.MathUtils.lerp(1, 0.25, Math.min(1, k.t / 6));
      g.uChoke.value = Math.min(1, k.t / 7);
      if (powers.health <= 0) { powers.dead = true; powers.onDeath?.(); }
    } else {
      // breathing again: the colour back over a second or two
      g.uChoke.value = Math.max(0, g.uChoke.value - dt * 0.7);
      if (k.hands) { k.hands = false; player.animator.reach('L', null, { rate: 4 }); player.animator.reach('R', null, { rate: 4 }); }
      player.hamper = 1;
      if (!k.back && !powers.dead && k.t > 2 && !this.civilian) { k.back = true; wait(1.4).then(() => this.bark('halNoAirBack')); }
      if (g.uChoke.value <= 0) { this.choke = null; if (this.civilian) this.hud.vitals.classList.remove('show'); }
    }
  }

  // ---------------------------------------------------------------- his secret
  // Who can see him now (story/CityLife.js `seenBy`): on Earth he changes only where nobody can (the
  // user, 2026-11-18: "he needs to go somewhere secret in order to change"): an alley, a roof, his flat,
  // the diner's restroom.
  watchers() {
    if (this.current !== this.ferrisScene || !this.cityLife?.started) return [];
    return this.cityLife.seenBy();
  }
  refuseSeen() {
    this.audio.denied();
    this.seenN = (this.seenN ?? 0) + 1;
    this.bark(['halSeen1', 'halSeen2', 'halSeen3'][this.seenN % 3]);
    this.ui.toast('Someone can see you. Get out of sight to change.');
  }

  // The diner's restroom: in, the door shut, changed, out
  async restroom(sp) {
    const { player, ui, audio, powers } = this;
    if (this.civilian && powers.charge < 2) { audio.denied(); this.ringSay('ringSuitLow'); this.bark('halSuitFail'); return; }
    this.busy = true;
    this.takeControl();
    try {
      await player.walkTo(sp.at, player.walkSpeed);
      player.turnTo(sp.face);
      audio.door();
      await ui.fade(1, 0.5);
      player.object.visible = false;
      if (this.civilian) await this.becomeLantern(); else await this.becomeHal();
      await wait(0.4);
      if (this.civilian === false && Math.random() < 0.5) this.bark('halRestroom');
      audio.door();
      player.object.visible = true;
      await ui.fade(0, 0.5);
    } finally {
      this.busy = false;
      this.giveControl(this.roamObjective());
    }
  }

  // ---------------------------------------------------------------- the open world
  async openWorld() {
    const { ui } = this;
    this.lanternUp();
    ui.clock(this.save.info('world').clock);
    this.chartWorlds(['earth', 'oa', 'korugar', 'ysmault', 'qward']);
    this.roam = { where: null, lastEarth: 'ferris' };
    this.civilian = false;
    this.life = new Life(this);
    this.life.apply();
    await this.enterPlace('ferris');
    ui.fade(0, 1.0);
    this.roaming = true;
    this.giveControl(this.roamObjective());
    this.roamKeys();
    this.hud.tutorial({ kicker: 'Free roam', title: 'The universe is open', n: 1, of: 1, html: '<b>E</b> flying high: the star chart (Oa, Korugar, Ysmault, Qward) &nbsp; <b>M</b> travel by name &nbsp; <b>T</b> Hal Jordan / Green Lantern &nbsp; <b>L</b> the lantern, to recharge &nbsp; Hal’s car is in his space by the hangars' });
    wait(14).then(() => this.hud.tutorial(null));
    await new Promise(() => {});
  }

  roamObjective() {
    const w = this.roam?.where, P = PLACES[w];
    if (!P) return 'Free roam';
    const extra = { ferris: 'Part Seven: Carol, in Hangar Two', coast: 'Part Seven: Carol, at Ferris', oa: 'Kilowog has another round', ysmault: 'Atrocitus, at his obelisk', qward: 'Call the Thunderers at the circle', korugar: 'Katma Tui, by the statue', lake: 'Abin Sur’s ship' }[w];
    return `Free roam · ${P.name}${extra ? ` · ${extra}` : ''}`;
  }

  // The keys line under the controls: what Hal can do as he is now.
  roamKeys() {
    this.ui.powerKeys = this.civilian ? CIVILIAN_KEYS : LANTERN_KEYS;
    if (this.player.control) this.ui.controls(true);
  }

  // The ring's state for who he is now: in the suit, everything; in his clothes, only the ring's charge
  // (the key and the lantern still work; no flight, no constructs).
  powersFor() {
    const { powers } = this;
    Object.assign(powers.enabled, { hud: true, constructs: !this.civilian, flight: !this.civilian });
    powers.suited = !this.civilian;
    this.hud.show(true);
    this.hud.vitals.classList.toggle('show', !this.civilian);
    this.roamKeys();
    this.life?.hud();
  }

  // ---------------------------------------------------------------- the ring's stats
  // K: what the ring has learned of him (his level, the XP to the next) and the points to spend on
  // its six stats (story/Life.js)
  async ringStats() {
    const { life, ui } = this;
    this.menuOpen = true;
    this.takeControl();
    this.powers.holster?.();
    for (;;) {
      const s = life.d.stats, ids = Object.keys(STATS), lv = life.level;
      const pick = await ui.screen({ kicker: `The ring · Level ${lv}`, title: 'WILL', body: life.d.points > 0 ? `${life.d.points === 1 ? 'A point' : `${life.d.points} points`} to spend. What should the ring make of him?` : 'No points to spend. Every level brings one: the story’s chapters, Kilowog’s rounds, Qward’s waves, the city’s emergencies.', stack: true,
        buttons: [...ids.map((k) => ({ label: `${STATS[k].name} · ${s[k]}/${MAX_STAT}`, sub: STATS[k].what })), 'Done'] });
      if (pick >= ids.length) break;
      if (!life.raise(ids[pick])) this.audio.denied(); else this.audio.ringChime();
    }
    this.menuOpen = false;
    this.giveControl(this.roamObjective());
  }

  // ---------------------------------------------------------------- travel
  async travelMenu() {
    this.menuOpen = true;
    this.takeControl();
    this.powers.holster?.();
    const here = this.roam.where;
    const opts = [...EARTH, ...AWAY].filter((id) => id !== here);
    const pick = await this.ui.screen({ kicker: 'The ring', title: 'TRAVEL', body: this.civilian ? 'Where to? Off Earth, the ring forms the uniform first.' : 'Where to? (Or fly high and press E for the star chart.)', stack: true, buttons: [...opts.map((id) => ({ label: PLACES[id].name, sub: PLACES[id].sub })), 'Stay here'] });
    this.menuOpen = false;
    if (pick < opts.length) await this.goTo(opts[pick]);
    else this.giveControl(this.roamObjective());
  }

  // Flying high enough for the ring to open the star chart.
  jumpReady() {
    const { player, powers } = this, P = PLACES[this.roam?.where];
    if (!this.roaming || !P || this.civilian || !player.control || !player.flying || this.busy || this.menuOpen || powers.wheelState || this.chart.isOpen || this.lanternMoving) return false;
    return player.position.y > P.jump;
  }

  updateInteractions() {
    const ready = this.jumpReady();
    if (ready !== this.jumpPrompt) {
      this.jumpPrompt = ready;
      this.ui.prompt(ready ? 'E' : null, ready ? 'Star chart' : null);
    }
    if (ready) {
      if (this.input.hit('KeyE')) {
        this.input.consume('KeyE'); // (or the chart would take this press as its confirm)
        this.jumpPrompt = false;
        this.ui.prompt();
        this.openRoamChart();
      }
      return;
    }
    // E in flight with nothing near: the ring says how to make the jump
    if (this.roaming && !this.civilian && this.player.control && this.player.flying && !this.busy && this.input.hit('KeyE')) this.ringSay('ringHigher');
    super.updateInteractions();
  }

  async openRoamChart() {
    const { powers, player } = this;
    this.busy = true;
    powers.freeze = true;
    player.inputBlocked = true;
    const id = await this.chart.open({ charted: ['earth', 'oa', 'korugar', 'ysmault', 'qward'], here: PLACES[this.roam.where].world, notes: CHART_NOTES });
    powers.freeze = false;
    player.inputBlocked = false;
    this.busy = false;
    if (id) await this.goTo(id === 'earth' ? this.roam.lastEarth : id);
  }

  // To one of the places: across the valley or to the lake by a fade, to another world by the voyage
  // (or a breach, to Qward and back); then into the place, flying in from its sky when he came from
  // space.
  async goTo(id) {
    const { ui, powers } = this, P = PLACES[id], from = this.roam.where, fromWorld = PLACES[from]?.world;
    if (this.civilian && P.world !== 'earth') {
      if (powers.charge < 2) { this.audio.denied(); this.ringSay('ringSuitLow'); this.giveControl(this.roamObjective()); return; }
      if (this.watchers().length) { this.refuseSeen(); this.giveControl(this.roamObjective()); return; }
      this.takeControl();
      await this.becomeLantern();
    }
    this.busy = true;
    this.takeControl();
    powers.holster?.();
    this.hud.tutorial(null);
    this.leavePlace(from);
    try {
      if (id === 'ysmault') await loadProps(YSMAULT_PROPS);
      if (id === 'qward') { await loadProps(QWARD_PROPS); await loadThunderers(); }
      let sky = false, breach = false;
      if (fromWorld && P.world !== fromWorld) {
        breach = P.world === 'qward' || fromWorld === 'qward';
        if (breach) await this.breach(P.world === 'qward');
        else await voyage(this, { from: fromWorld, to: P.world });
        sky = true;
      } else {
        await ui.fade(1, 0.6);
        sky = id === 'lake' && !this.civilian; // (the lake is another valley: he flies in over it)
      }
      await this.enterPlace(id, { sky, breach });
      if (!sky) ui.fade(0, 0.6);
    } finally {
      this.busy = false;
    }
    this.giveControl(this.roamObjective());
    this.powersFor();
    this.arrived(id, fromWorld !== P.world);
  }

  // What's left behind when he goes: a fight in progress ends, the drill stops.
  leavePlace(id) {
    if (id === 'qward') this.qT?.clear();
    if (id === 'oa') { this.swarm?.clear?.(); this.drilling = false; this.hallActive = false; }
    this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
  }

  // Into Qward, or out of it, through a breach the ring tears in the air ahead of him (as Sinestro
  // went): a rift of the antimatter's violet opens, he flies into it, and the light closes over him.
  async breach(intoQward) {
    const { player, director, audio, engine, powers } = this, grade = engine.gradeUniforms, o = player.object;
    const yaw = player.yaw, fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), right = V(fwd.z, 0, -fwd.x);
    this.playerActive = false;
    player.flying = false;
    player.autoAnim = false;
    player.lookAt(null);
    player.animator.reach('R', null);
    player.animator.lean.pitch = player.animator.lean.roll = player.animator.twist = 0;
    player.animator.feet.ground = null;
    player.pivot.quaternion.identity();
    const animStop = onFrame((dt) => player.animator.update(dt));
    const p0 = o.position.clone();
    o.rotation.set(0, yaw, 0, 'YXZ');
    player.animator.play(still(POSES.hover, 0.4), 0.3);
    const mouth = p0.clone().addScaledVector(fwd, 11).add(V(0, 2.6, 0));
    const rift = this.openRift(this.current, mouth, 4.2, 1, { palette: 'antimatter' });
    rift.open = 0;
    director.cut(p0.clone().addScaledVector(fwd, -4.2).addScaledVector(right, 1.6).add(V(0, 2.2, 0)), mouth, 50);
    this.ringSay(intoQward ? 'ringBreach' : 'ringBreachHome');
    audio.rift(true);
    audio.riser(1.6, 0.3);
    this.ringGlow = 5;
    await tween(1.2, (k) => { rift.open = k; o.position.y = p0.y + 0.6 * ease.inOut(k); }, ease.out);
    player.animator.play(still(POSES.flyFast, 0.2), 0.3);
    audio.whoosh(1.2, 0.8);
    const start = o.position.clone();
    await tween(1.0, (k) => {
      o.position.lerpVectors(start, mouth, ease.in(k));
      o.rotation.set(1.3 * ease.inOut(Math.min(1, k * 2)), yaw, 0, 'YXZ');
      director.fov = 50 + 14 * k * k;
    }, ease.linear);
    grade.uFlashColor.value.setRGB(1.2, 0.7, 1.8);
    await tween(0.35, (k) => (grade.uFlash.value = k * k), ease.linear);
    audio.rift(false);
    rift.close();
    animStop();
    director.fov = 55;
    this.ringGlow = 0.6;
    powers.detach();
    player.removeFromPhysics();
  }

  // ---------------------------------------------------------------- places
  async enterPlace(id, { sky = false, breach = false } = {}) {
    const { player, powers } = this;
    powers.markerTarget = null;
    this.roamTick = null;
    let air;
    if (id === 'ferris' || id === 'coast') {
      const f = this.setupFerris();
      f.roadGround();
      if (id === 'ferris') this.enterFerris(HANGAR_MOUTH.clone().add(V(0, 0, -6)), 0);
      else this.enterFerris(LOT.clone().add(V(4, 0, -30)), Math.PI);
      this.world = 'earth';
      this.ferrisRoam(f, id);
      air = id === 'ferris' ? [V(0.5, 64, 74), Math.PI, V(0, -4, -9)] : [LOT.clone().add(V(6, 84, -380)), 0, V(0, -4, 9)];
    } else if (id === 'lake') {
      const site = this.setupCrash({ body: false });
      this.enterCrash();
      this.world = 'earth';
      this.removeAbin?.();
      // (enterCrash binds the powers but never put Hal there: the old free roam left him in the
      // valley's world with the lake on screen, and nothing worked)
      const at = LAKE_ARRIVAL.clone();
      player.spawn(site.physics, site.scene, at, Math.atan2(SHIP.center.x - at.x, SHIP.center.z - at.z));
      player.boostScale = 1;
      this.lakeRoam(site);
      air = [V(-16, 26, 30), Math.PI * 0.82, V(3, -4, -8)];
    } else if (id === 'oa') {
      this.setupOa();
      this.enterOa(HAL_START, Math.PI);
      player.boostScale = 1.4;
      this.oaRoam();
      air = [V(18, 70, 46), Math.PI + 0.35, V(-3, -6, -10)];
    } else if (id === 'korugar') {
      const kor = this.setupKorugar();
      kor.night(false);
      kor.fallen(); // (his statue where they pulled it down)
      this.enterKorugar(KOR_ARRIVAL.clone().add(V(0, 0, 30)), Math.PI);
      player.boostScale = 1.4;
      this.korugarRoam(kor);
      air = [V(10, 46, 120), Math.PI, V(-0.5, -5, -11)];
    } else if (id === 'ysmault') {
      const ys = this.setupYsmault();
      this.enterYsmault(YS_LANDING.clone().add(V(0, 0, 18)), Math.PI);
      player.boostScale = 1;
      this.ysmaultRoam(ys);
      air = [V(4, 26, 34), Math.PI, V(-0.5, -5, -9)];
    } else if (id === 'qward') {
      const q = this.setupQward();
      this.enterQward(AMBUSH.clone().add(V(0, 0, 40)), Math.PI);
      player.boostScale = 1.6;
      this.qwardRoam(q);
      air = [RIFT_AT.clone(), Math.PI, V(0, -2, -12)];
    }
    this.roam.where = id;
    if (PLACES[id].world === 'earth') this.roam.lastEarth = id;
    this.powersFor();
    if (!sky) return;
    if (breach) {
      // out of a breach of his own, closing behind him
      const back = air[2].clone().setY(0).normalize().multiplyScalar(-3.5);
      const rift = this.openRift(this.current, air[0].clone().add(back).add(V(0, 1, 0)), 4.2, -1, { palette: 'antimatter' });
      rift.open = 1;
      wait(1.4).then(async () => { await tween(1.2, (k) => (rift.open = 1 - k)); rift.close(); });
      wait(1.0).then(() => this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
      this.audio.rift(true);
      wait(2.4).then(() => this.audio.rift(false));
    }
    await this.arriveFlying(...air);
  }

  // A word on arrival: from the ring, or from whoever is there.
  arrived(id, fromSpace) {
    if (id === 'oa' && fromSpace) wait(2.2).then(() => this.quip('kwBack', 1, [['back', 'beckon']]));
    if (id === 'qward') wait(1.2).then(() => this.ringSay('ringQwardHere'));
    if (id === 'oa') wait(5).then(() => { if (this.roam.where === 'oa' && this.powers.charge < 99) this.ringSay('ringBattery'); });
  }

  // ---------------------------------------------------------------- Earth: the valley
  ferrisRoam(f, id) {
    const { audio, player, powers, engine } = this;
    if (!this.dayCycle) {
      this.dayCycle = new DayCycle(f, LifeSave, { audio, engine });
      // the town's night lights compiled in now: the first dusk otherwise recompiled every material
      // in view as the lamps came on (adding a light does)
      if (f.block) { f.block.setNight(1); engine.renderer.compile(f.scene, engine.camera); f.block.setNight(0); }
      this.dayCycle.apply(engine.camera);
    }
    // the streets' traffic (city/Traffic.js), in free roam only
    if (!this.traffic && f.block) { this.traffic = new Traffic(f, this, { count: 16, lot: LOT }); f.updaters.push((dt) => this.traffic.update(dt)); }
    // and what goes wrong on them, for Green Lantern to answer (story/Emergencies.js)
    if (!this.emergencies && f.block) { this.emergencies = new Emergencies(this, f); f.updaters.push((dt) => this.emergencies.update(dt)); }
    // and what a city that's turned against Green Lantern does about it (story/Pressure.js)
    if (!this.pressure && f.block) { this.pressure = new Pressure(this, f); f.updaters.push((dt) => this.pressure.update(dt)); }
    f.follow = () => (this.driving ? f.car.position : player.position);
    this.ambience(audio.wind(0.05), audio.traffic(id === 'coast' ? 0.05 : 0.015));
    powers.attach({ scene: f.scene, physics: f.physics, ground: () => 0, floor: () => 0, canLand: (x, z) => Math.abs(x) < 4200 && z > -1200 && z < 7600, center: V(0, 0, 3200), radius: 5400, ceiling: 650 });
    powers.regen = 0;
    player.boostScale = 2.4; // (six kilometres from the field to the city)
    // what the ring breaks in town costs him the city's goodwill (story/Life.js): not collisions
    f.smash.onEvent = (ev, item) => {
      if (!this.life || this.civilian || item.lastKind === 'crash' || (item.object?.position.z ?? 0) < 3200) return;
      const n = { break: 1.5, car: 1, burn: 2, explode: 4 }[ev] ?? 0;
      const why = { break: 'city property broken', car: 'a parked car hit', burn: 'a car set burning', explode: 'a car blown up' }[ev];
      if (n) this.life.opine(-n, why);
    };
    this.lanternSpots(f);
    this.carolRoam(f);
    this.addCarSpot(f);
    this.blockRoam(f);
    // high over the valley: the whole test range under him, the coast and the sea out to the horizon
    // (Part Five's airspace), and back to the valley's haze coming down
    this.roamTick = () => {
      if (this.current !== f) return;
      if (!this.driving) this.roam.where = player.position.z > 3200 ? 'coast' : 'ferris';
      const y = this.driving ? 0 : player.position.y, high = this.airOn ? y > 60 : y > 95;
      if (high !== !!this.airOn) {
        this.airOn = high;
        f.flightAir(high);
        engine.camera.far = f.scene.userData.far;
        engine.camera.updateProjectionMatrix();
      }
    };
  }

  // Carol in Hangar Two, Part Seven's hook, marked on the HUD from anywhere in the valley. She talks
  // to whichever of him walks up: Green Lantern or her pilot.
  carolRoam(f) {
    const carol = this.addCarol();
    if (!carol) return;
    carol.root.position.copy(CAROL_IN);
    carol.root.rotation.y = Math.PI;
    const p = V(0, 0, 0), halHead = () => this.player.rig.bonePosition('head', p);
    this.cb.lookHome = () => halHead;
    this.carolAnim.lookAt(halHead, 0.5);
    this.powers.markerTarget = { pos: CAROL_IN.clone().setY(2.4), label: 'Part Seven · Carol' };
    if (this.carolIt) return;
    let gl = 0, hal = 0, told = false;
    this.carolIt = f.interact({ position: CAROL_IN, radius: 2.6, look: CAROL_IN.clone().setY(1.6), label: 'Talk to Carol', action: async () => {
      const { player } = this;
      player.control = false;
      player.turnTo(Math.atan2(CAROL_IN.x - player.position.x, CAROL_IN.z - player.position.z));
      carol.root.rotation.y = Math.atan2(player.position.x - CAROL_IN.x, player.position.z - CAROL_IN.z);
      // as Hal by day she puts him on the schedule (a shift once a day, story/Life.js), else tells him to go home
      const shift = this.civilian && this.shiftOpen(), done = this.civilian && this.life?.d.worked === this.dayCycle?.day;
      const key = this.civilian ? (shift ? 'carolShift0' : done ? 'carolShiftDone' : ['carolRoamHal1', 'carolRoamHal2'][hal++ % 2]) : ['carolRoamGL1', 'carolRoamGL2'][gl++ % 2];
      await this.carolSay(key, [['', 'open']], { skip: false });
      if (!told) {
        told = true;
        this.takeControl();
        await this.ui.screen({ kicker: 'Part Seven', title: 'COMING NEXT', body: 'Carol has something to tell you. Part Seven begins here, in Hangar Two, when it’s written.', buttons: ['Back to free roam'] });
      }
      if (shift && await this.offerShift()) return;
      this.giveControl(this.roamObjective());
    } });
  }

  // A day's flying for Ferris (from seven in the morning until one: the day goes by to four, and his
  // pay with it, less if he came in late); the only money he makes
  shiftOpen() { const dc = this.dayCycle; return !!dc && !!this.life && dc.hour >= 7 && dc.hour < 13 && this.life.d.worked !== dc.day; }
  async offerShift() {
    const { ui, dayCycle: dc, life } = this;
    const pick = ui.pick('Ferris Aircraft', ['Fly the shift (till 4 PM)', 'Not today']);
    const i = await Promise.race([pick, wait(12).then(() => -1)]);
    pick.cancel();
    if (i !== 0) return false;
    this.takeControl();
    await this.bark('halShift');
    await ui.fade(1, 0.9);
    const hours = Math.max(2, 16 - dc.hour), pay = Math.round(SHIFT_PAY * Math.min(1, hours / 8));
    dc.setHour(16);
    dc.apply(this.engine.camera);
    life.d.worked = dc.day;
    await wait(0.8);
    ui.toast(`Four o’clock · ${hours >= 7.5 ? 'a full day’s flying' : `${Math.round(hours)} hours flown`}`);
    await ui.fade(0, 0.9);
    life.pay(pay, hours >= 7.5 ? 'a day’s test flying' : 'a short day’s flying');
    life.gain(15, 'a day at Ferris');
    await this.carolSay(hours >= 7.5 ? 'carolShiftEnd' : 'carolShiftLate', [['', 'open']], { skip: false });
    this.giveControl(this.roamObjective());
    return true;
  }

  // ---------------------------------------------------------------- his car
  // Hal's Phoenix, wherever he left it (his space by the hangars to start with). Walk up to the
  // driver's door: as Hal, the ring makes the key; in the suit, he changes first.
  addCarSpot(f) {
    if (this.carIt) return;
    const car = f.car, door = V(0, 0, 0), look = V(0, 0, 0);
    const place = () => { car.updateMatrixWorld(true); car.localToWorld(door.set(1.75, 0, -0.5)); door.y = 0; car.localToWorld(look.set(0.97, 0.88, -0.56)); };
    place();
    f.updaters.push(place);
    const it = (this.carIt = f.interact({ position: door, radius: 1.7, look, label: 'Unlock the car', action: () => this.takeCar(f) }));
    Object.defineProperty(it, 'enabled', { get: () => this.roaming && !this.driving && !this.player.flying });
    Object.defineProperty(it, 'label', { get: () => (this.civilian ? 'Make a key and take the car' : 'Change, and take the car') });
  }

  async takeCar(f) {
    const { player, director } = this, car = f.car;
    this.takeControl();
    if (!this.civilian) {
      if (this.watchers().length) { this.refuseSeen(); this.giveControl(this.roamObjective()); return; }
      if (player.flying) await this.touchDown();
      await this.becomeHal();
    }
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    await player.walkTo(local(1.62, 0, -0.66), player.walkSpeed);
    player.turnTo(car.rotation.y - Math.PI / 2);
    director.move(local(2.5, 1.5, -1.75), local(0.95, 0.86, -0.5), 1.1, ease.inOut, 34);
    await wait(0.6);
    if (!(await this.ringKey(car))) { this.giveControl(this.roamObjective()); return; }
    f.freeCar();
    await this.getIn(car, { spawn: false });
    await this.driveCar(f);
    this.giveControl(this.roamObjective());
    this.powersFor();
  }

  // The key: his hand comes up, a key of green light forms on his palm (the Corps emblem for its bow),
  // into the lock, a quarter turn and the clunk of the latch, and it's gone. With the ring out of
  // charge, it flickers, sputters and won't hold.
  async ringKey(car) {
    const { player, powers, audio } = this, anim = player.animator;
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    const hole = local(0.972, 0.8, -0.52), out = V(1, 0, 0).applyQuaternion(car.quaternion).setY(0).normalize();
    const g = (this.keyGeo ??= keyGeometry());
    const key = constructMesh(g.geo, { outline: 0.0022 });
    key.userData.set('uForm', 0);
    this.current.scene.add(key);
    const fwd = () => V(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    // on his palm, in front of his chest: the key lying across it, pointing at the door
    const hold = V(0, 0, 0), held = () => hold.copy(player.position).addScaledVector(fwd(), 0.34).add(V(0, 1.12, 0)).addScaledVector(V(fwd().z, 0, -fwd().x), -0.08);
    const handAt = V(0, 0, 0), keyAt = V(0, 0, 0), aim = out.clone().negate();
    let mode = 'palm', t0 = this.engine.time;
    const follow = onFrame(() => {
      if (mode === 'palm') {
        player.rig.bones.hand_R.getWorldPosition(handAt);
        keyAt.copy(handAt).addScaledVector(fwd(), 0.07).add(V(0, 0.035, 0));
        key.position.copy(keyAt);
        key.lookAt(keyAt.clone().add(aim));
        key.rotateZ(Math.PI / 2 + Math.sin((this.engine.time - t0) * 2.2) * 0.08); // (flat on the palm)
      }
      key.userData.set('uTime', this.engine.time);
    });
    anim.reach('R', held, { pole: V(-0.4, -0.9, -0.2), rate: 7 });
    await wait(0.55);
    const ok = powers.charge >= 1;
    audio.constructForm(0.3);
    this.ringGlow = 3;
    if (!ok) {
      // it won't hold: a flicker of the shape, sparks, nothing
      await tween(1.1, (k) => key.userData.set('uForm', Math.max(0, 0.45 * Math.sin(k * 19) * Math.sin(k * 7) * (1 - k))), ease.linear);
      powers.sparks?.emit(14, (p, v) => { p[0] = keyAt.x; p[1] = keyAt.y; p[2] = keyAt.z; v[0] = (Math.random() - 0.5) * 1.2; v[1] = Math.random() * 1.4; v[2] = (Math.random() - 0.5) * 1.2; }, { life: 0.4, size: [0.02, 0], color: [[0.6, 3, 1.2, 1], [0.1, 0.5, 0.2, 0]] });
      audio.denied();
      follow();
      key.removeFromParent();
      anim.reach('R', null, { rate: 5 });
      this.ringGlow = 0.6;
      this.ringSay('ringKeyLow');
      this.bark('halKeyFail'); // (said while he's walking off: control comes straight back)
      return false;
    }
    await tween(0.5, (k) => key.userData.set('uForm', k), ease.out);
    powers.setCharge(powers.charge - 0.5);
    this.ringGlow = 1.4;
    await wait(0.25);
    // to the lock: the key leads, his fingers on its bow
    mode = 'lock';
    const from = key.position.clone(), q0 = key.quaternion.clone();
    const at = (d) => hole.clone().addScaledVector(out, d);
    // (posed the way the palm's key is: +Z at the target, then flat)
    const dummy = new THREE.Object3D();
    dummy.position.copy(at(0.09));
    dummy.lookAt(at(0.09).add(aim));
    dummy.rotateZ(Math.PI / 2);
    const bow = V(0, 0, 0);
    anim.reach('R', () => bow.copy(key.position).addScaledVector(out, 0.05).add(V(0, -0.02, 0)), { pole: V(-0.4, -0.9, -0.2), rate: 10 });
    await tween(0.6, (k) => { key.position.lerpVectors(from, at(0.085), ease.inOut(k)); key.quaternion.slerpQuaternions(q0, dummy.quaternion, ease.inOut(k)); });
    await tween(0.3, (k) => key.position.copy(at(0.085 - 0.07 * ease.in(k))), ease.linear);
    audio.tick();
    // the quarter turn, and the latch
    const qa = key.quaternion.clone();
    await tween(0.28, (k) => { key.quaternion.copy(qa); key.rotateZ(-Math.PI / 2 * ease.inOut(k)); });
    audio.tone({ type: 'square', freq: 140, to: 90, attack: 0.002, peak: 0.08, dur: 0.07, wet: 0.1 });
    audio.tick();
    this.director.shake?.(0.015, 0.1);
    await wait(0.3);
    await tween(0.35, (k) => key.userData.set('uForm', 1 - k), ease.in);
    follow();
    key.removeFromParent();
    anim.reach('R', null, { rate: 6 });
    this.ringGlow = 0.6;
    this.bark(['halKey1', 'halKey2', 'halKey3'][(this.keyN = (this.keyN ?? -1) + 1) % 3]);
    return true;
  }

  // Driving it: anywhere on the valley floor, the boulevard to the field and out over the desert.
  // Stopped, E gets him out; the car stays where it stopped.
  async driveCar(f) {
    const { player, audio, director, input, ui } = this, car = f.car;
    const animOff = onFrame((dt) => player.animator.update(dt));
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    director.move(local(2.3, 1.35, 2.7), local(0.3, 0.98, -0.3), 1.2, ease.inOut, 36);
    await wait(0.7);
    // (it's an old car: now and then it takes a second go)
    const twice = Math.random() < 0.3;
    audio.starter(0.9, !twice);
    if (twice) { await wait(1.3); audio.starter(0.8, true); }
    await wait(1.1);
    const motor = audio.engine(0.12);
    const drv = (this.drv = new Drive({ physics: f.physics, car, input, director, audio, hal: this.hal, hud: this.vhud }).start());
    drv.motor = motor;
    drv.snap = true;
    this.driving = true;
    const tick = (dt) => drv.update(dt);
    f.updaters.push(tick);
    this.playerActive = false;
    drv.enabled = true;
    ui.cinematic(false);
    input.setLook(true);
    ui.controls(false);
    if (!this.toldDrive) {
      this.toldDrive = true;
      this.hud.tutorial({ kicker: 'Driving', title: 'His car', n: 1, of: 1, html: '<b>W</b> drive &nbsp; <b>S</b> brake, reverse &nbsp; <b>A</b> <b>D</b> steer &nbsp; <b>Space</b> handbrake &nbsp; <b>C</b> view &nbsp; <b>E</b> get out (stopped) &nbsp; The road runs from the field to the city' });
      wait(11).then(() => this.hud.tutorial(null));
    }
    ui.objective('Free roam · driving · stop, then E to get out');
    let prompt = null;
    await waitFor(() => {
      const slow = Math.abs(drv.speed) < 1.2;
      if (slow !== prompt) { prompt = slow; ui.prompt(slow ? 'E' : null, slow ? 'Get out' : null); }
      return slow && input.hit('KeyE');
    });
    ui.prompt();
    this.hud.tutorial(null);
    drv.enabled = false;
    drv.throttle = 0; drv.brake = 1;
    await wait(0.4);
    this.vhud.hide();
    drv.stop();
    f.updaters.splice(f.updaters.indexOf(tick), 1);
    // settled square on its wheels where it stopped
    const fw = V(0, 0, 1).applyQuaternion(car.quaternion);
    car.position.y = 0;
    car.rotation.set(0, Math.atan2(fw.x, fw.z), 0);
    for (const wh of drv.wheels) { wh.pv.position.y = wh.hub.y; if (wh.front) wh.pv.rotation.y = 0; }
    car.userData.steer?.(0);
    f.carSolid();
    motor.stop(0.4);
    this.takeControl();
    await this.getOut(car, animOff);
    this.driving = false;
    this.drv = null;
    this.ambience(audio.wind(0.05), audio.traffic(car.position.z > 3200 ? 0.05 : 0.015));
  }

  // ---------------------------------------------------------------- who he is
  async changeClothes() {
    const { player, powers } = this;
    if (this.watchers().length) { this.refuseSeen(); return; }
    if (this.civilian) {
      if (powers.charge < 2) { this.audio.denied(); this.ringSay('ringSuitLow'); this.bark('halSuitFail'); return; }
      this.busy = true;
      try { await this.becomeLantern(); } finally { this.busy = false; }
    } else {
      if (player.flying || !player.grounded) { powers.say('Land first.', { voice: false }); this.audio.denied(); return; }
      this.busy = true;
      try { await this.becomeHal(); } finally { this.busy = false; }
    }
  }

  // The ring hand up before his face, its light flaring: the uniform sweeps off into his clothes, or
  // up over them.
  async becomeHal() {
    const { player, powers } = this;
    powers.holster?.();
    powers.closeWheel?.();
    const had = player.control;
    player.control = false;
    this.ringFlourish();
    await this.suitOff(1.25);
    this.civilian = true;
    player.boostScale = 1;
    this.powersFor();
    player.control = had;
  }

  async becomeLantern() {
    const { player, powers } = this;
    const had = player.control;
    player.control = false;
    this.ringFlourish();
    await this.suitUp(1.25);
    powers.setCharge(powers.charge - 1);
    this.civilian = false;
    this.powersFor();
    player.control = had;
  }

  ringFlourish() {
    const { player, powers, audio } = this, p = V(0, 0, 0);
    const up = () => { const y = player.yaw; return p.copy(player.position).add(V(Math.sin(y) * 0.38 - Math.cos(y) * 0.06, 1.5, Math.cos(y) * 0.38 + Math.sin(y) * 0.06)); };
    player.animator.reach('R', up, { pole: V(-0.6, -0.8, -0.1), rate: 9 });
    audio.riser(0.9, 0.25);
    audio.ringChime();
    this.ringGlow = 5;
    wait(0.35).then(() => { this.ring?.getWorldPosition(powers.flash.position); powers.flash.intensity = 9; });
    wait(1.5).then(() => { player.animator.reach('R', null, { rate: 5 }); this.ringGlow = 0.6; });
  }

  // ---------------------------------------------------------------- the lantern
  // In free roam the oath is the whole oath when the ring is low (the comics' recharge); the short
  // line otherwise.
  async recharge() {
    if (this.drained || !this.roaming || this.powers.charge >= 25) return super.recharge();
    const { player, powers, audio, director } = this, lantern = this.lantern, spot = this.lanternSpot.clone();
    this.takeControl();
    const yaw = Math.atan2(spot.x - player.position.x, spot.z - player.position.z);
    player.turnTo(yaw);
    player.lookAt(spot.clone().add(V(0, 0.3, 0)), 1);
    const shoulder = V(0, 0, 0), rig = () => player.rig;
    player.animator.reach('R', () => { rig().bonePosition('upperArm_R', shoulder); return shoulder.add(spot.clone().add(V(0, 0.5, 0)).sub(shoulder).normalize().multiplyScalar(0.62)); }, { pole: V(-0.4, -0.85, -0.3) });
    const c = player.position.clone(), toHal = c.clone().sub(spot).setY(0).normalize(), across = V(toHal.z, 0, -toHal.x);
    const cam = (back, side, up) => spot.clone().addScaledVector(toHal, -back).addScaledVector(across, side).setY(spot.y + up);
    director.cut(cam(1.3, 0.9, 0.5), c.clone().add(V(0, 1.4, 0)), 42);
    director.move(cam(0.7, 0.75, 0.62), c.clone().add(V(0, 1.5, 0)), 11, ease.inOut, 36);
    await wait(0.6);
    const beam = createShaft({ from: spot.clone().add(V(0, 0.25, 0)), to: this.ring.getWorldPosition(V(0, 0, 0)), radiusFrom: 0.04, radiusTo: 0.07, color: new THREE.Color(0.5, 2.5, 1.0) });
    this.current.scene.add(beam);
    this.hud.ringhud.classList.add('force');
    audio.riser(9, 0.4);
    for (let i = 0; i < 4; i++) {
      const from = powers.charge, to = from + (100 - from) * ((i + 1) / 4);
      audio.tone({ freq: [293.7, 370, 440, 587.3][i], peak: 0.06, dur: 2.4, wet: 0.7 });
      const fill = tween(2.2, (k) => {
        powers.setCharge(from + (to - from) * k);
        const glow = (i + k) / 4;
        lantern.userData.light.intensity = 1.2 + glow * 12;
        beam.userData.uniforms.uOpacity.value = 1.5 + glow * 2;
        this.ringGlow = 1 + glow * 5;
      });
      await this.say(`oath${i + 1}`, { hold: i === 3 ? 0.8 : 0.25, name: i === 3 ? 'Hal Jordan' : undefined });
      await fill;
    }
    beam.removeFromParent();
    lantern.userData.light.intensity = 1.2;
    audio.ringChime();
    this.ringSay('ringFull');
    this.hud.ringhud.classList.remove('force');
    player.animator.reach('R', null);
    player.lookAt(null);
    this.ringGlow = 0.6;
    this.giveControl(this.roamObjective());
  }

  // Down, in free roam: a card, and back on his feet where he is (no checkpoint to restart).
  async collapse() {
    if (!this.roaming) return super.collapse();
    const { player, ui, powers } = this;
    const choked = !!this.choke && this.civilian; // (before the fade: the choke clears as he goes down)
    this.takeControl();
    player.stopFlying(true);
    player.autoAnim = false;
    player.animator.play(still(POSES.kneel, 1.6), 0.5);
    this.hud.tutorial(null);
    this.qT?.clear();
    this.swarm?.clear?.();
    this.drilling = false;
    this.arenaBusy = false;
    await ui.fade(1, 1.6);
    if (choked) { powers.setCharge(Math.max(powers.charge, 3)); await this.becomeLantern(); } // (the ring's life support, at the last)
    await ui.screen(choked
      ? { kicker: 'No air', title: 'SUFFOCATED', body: 'He held on as long as a man can. At the last the ring closed the uniform round him.', buttons: ['Get up'] }
      : { kicker: 'Hal is down', title: 'THE LIGHT FADES', body: 'Not this time. The ring brings him round.', buttons: ['Get up'] });
    powers.dead = false;
    powers.health = powers.maxHealth;
    powers.setCharge(Math.max(powers.charge, 40));
    Object.assign(powers, { healDelay: 4, healRate: 8 });
    player.animator.play(player.loco, 0.4);
    player.autoAnim = true;
    ui.fade(0, 1.2);
    this.giveControl(this.roamObjective());
  }

  // ---------------------------------------------------------------- the lake
  lakeRoam(site) {
    this.lanternSpots(site);
    if (this.lakeIt) return;
    if (this.lanternScene === site) this.pocketLantern(); // (setupCrash stands it by the ship: it's in the pocket dimension now)
    let n = 0;
    const at = SHIP.center.clone().add(V(-4.2, 0, 3.4));
    this.lakeIt = site.interact({ position: at, radius: 3.2, look: SHIP.center.clone().add(V(0, 1.2, 0)), label: 'Abin Sur’s ship', action: async () => {
      this.player.lookAt(SHIP.center.clone().add(V(0, 1, 0)), 1);
      await this.bark(['halLake', 'halLake2'][n++ % 2]);
      this.player.lookAt(null);
    } });
  }

  // ---------------------------------------------------------------- Oa
  // The range (Kilowog starts another round when asked), the Guardians' hall (they speak to him), the
  // Central Battery keeping the ring topped up.
  oaRoam() {
    const { player } = this;
    this.addDrillStart();
    this.addGuardians();
    this.hallActive = false;
    this.roamTick = () => { this.hallActive = Math.hypot(player.position.x - HALL.x, player.position.z - HALL.z) < 48; };
    if (this.guardIt) return;
    let n = 0;
    this.guardIt = this.oa.interact({ position: HALL.clone(), radius: 4.2, look: () => this.elder.bonePosition('head', V(0, 0, 0)), label: 'Speak with the Guardians', action: async () => {
      this.takeControl();
      this.gClose(this.elder, 1.4, 0.4);
      await this.gSay(['gRoam1', 'gRoam2', 'gRoam3'][n++ % 3], this.elder);
      await wait(0.3);
      this.giveControl(this.roamObjective());
    } });
    Object.defineProperty(this.guardIt, 'look', { get: () => this.elder.bonePosition('head', V(0, 0, 0)) });
  }

  // ---------------------------------------------------------------- Korugar
  // No rally now: the plaza's people about their business, Katma Tui by the fallen statue; the old
  // quarter's tavern open, the market's vendors at their stalls (the open world's places "on Korugar
  // once it's freed"). Nothing he takes is paid for: he's the Lantern who freed them.
  korugarRoam(kor) {
    for (const m of [kor.crowdDown, kor.crowdUp, kor.forecourt?.down, kor.forecourt?.up]) if (m) m.visible = false;
    const T = TAVERN, bx = T.x1 - 1.9, bz = (T.z0 + T.z1) / 2;
    // behind three stalls, facing the street (a stall on the north side is turned round)
    const behind = (g) => { const sgn = g.rotation.y ? 1 : -1; return { at: g.position.clone().add(V(0, 0, sgn * 1.25)), yaw: sgn > 0 ? Math.PI : 0, front: g.position.clone().add(V(0, 0, -sgn * 1.15)) }; };
    const stalls = (kor.stalls ?? []).slice(0, 3).map(behind);
    const posts = [
      { at: V(T.x1 - 1.0, 0, bz), yaw: -Math.PI / 2, kind: 'man', tag: 'keeper', label: 'the keeper', lines: ['korTav1', 'korTav2', 'korTav3'] },
      { at: V(bx - 1.0, 0, bz - 2.2), yaw: Math.PI / 2, kind: 'man', label: 'a man at the bar', lines: ['korPatM1', 'korPatM2'] },
      { at: V(T.x0 + 3.6, 0, T.z1 - 2.2), yaw: -2.4, kind: 'woman', label: 'a woman by the hearth', lines: ['korPatF1', 'korPatF2'] },
      ...[['korVenF1', 'woman', 'the fruit seller'], ['korVenM1', 'man', 'the baker'], ['korVenM2', 'man', 'the carver']].map(([line, kind, label], i) => stalls[i] && { ...stalls[i], kind, label, tag: `vendor${i}`, lines: [line, `${line}b`] }).filter(Boolean),
    ];
    this.streetsAfter ??= new StreetLife(this, kor, { era: 'after', walkers: { plaza: 5, avenue: 4, market: 4 }, guards: [{ at: V(-4.6, 0, -47), yaw: 0 }, { at: V(4.6, 0, -47), yaw: 0 }], posts });
    if (!this.korShops) {
      this.korShops = true;
      const give = (tag, title, items, said) => async () => {
        const who = this.streetsAfter.people.find((q) => q.tag === tag);
        const pick = this.ui.pick(title, [...items.map(([n]) => n), 'Nothing, thanks']);
        const i = await Promise.race([pick, wait(12).then(() => -1)]);
        pick.cancel();
        if (i < 0 || i >= items.length) return;
        if (who) { this.speakingRig = who.rig; await this.say(said, { skip: false }); this.speakingRig = null; }
        const [, heal, bark] = items[i];
        this.powers.health = Math.min(this.powers.maxHealth, this.powers.health + heal);
        this.bark(bark);
      };
      kor.interact({ position: V(bx - 1.0, 0, bz + 0.4), radius: 1.1, look: V(bx + 0.3, 1.1, bz), label: 'Have something · The Broken Chain', action: give('keeper', 'The Broken Chain', [['A cup of spiced tea', 12, 'halKorTea'], ['A bowl of stew', 35, 'halKorStew']], 'korTavGive') });
      const wares = [['Fruit from the terraces', 10, 'halEat1'], ['Warm bread', 18, 'halEat2'], ['A carved emblem', 0, 'halKorEmblem']];
      stalls.forEach((st, i) => { const v = posts.find((q) => q.tag === `vendor${i}`); if (v) kor.interact({ position: st.front, radius: 1.0, look: st.at.clone().setY(1.0), label: `Take something · ${v.label}`, action: give(v.tag, v.label, [wares[i]], v.kind === 'woman' ? 'korVenGiveF' : 'korVenGiveM') }); });
    }
    this.korKatma ??= this.addTalker(kor, createKatma(this.assets.characters.katma, { uniform: true }), V(-3.5, 0, 9.5), 0.3, ['katmaW1', 'katmaW2', 'katmaW3']);
    this.lanternSpots(kor);
  }

  // ---------------------------------------------------------------- Ysmault
  ysmaultRoam(ys) {
    this.ysAtro ??= this.chainAtrocitus(ys);
    this.lanternSpots(ys);
    if (this.atroIt) return;
    const a = this.ysAtro, f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)), at = a.rig.root.position.clone().addScaledVector(f, 2.4);
    let n = 0;
    this.atroIt = ys.interact({ position: at, radius: 2.6, look: a.rig.bonePosition('head', V(0, 0, 0)), label: 'Speak to Atrocitus', action: async () => {
      this.takeControl();
      this.atroChainedClose(a, 1.3, 0.6, 38);
      this.speakingRig = a.rig;
      await this.say(['atroY1', 'atroY2', 'atroY3'][n++ % 3], { skip: false });
      this.speakingRig = null;
      this.giveControl(this.roamObjective());
    } });
  }

  // ---------------------------------------------------------------- Qward
  // The plain of black glass; a circle of violet light at the ambush ground. E in it calls the
  // Thunderers: a wave, each one bigger than the last.
  qwardRoam(q) {
    const { powers, player, audio, director } = this;
    this.lanternSpots(q);
    if (this.qT) return;
    const T = (this.qT = new Thunderers({ scene: q.scene, physics: q.physics, powers, player, audio, director, mocap: this.mocap, centre: AMBUSH, radius: 60, blocks: q.blocks }));
    q.updaters.push((dt) => T.update(dt));
    T.onHurtHal = () => {};
    // the circle: a ring of violet light laid on the glass, slowly turning
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.55, 1.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const circle = new THREE.Group();
    circle.add(new THREE.Mesh(new THREE.RingGeometry(3.3, 3.5, 96).rotateX(-Math.PI / 2), mat));
    circle.add(new THREE.Mesh(new THREE.RingGeometry(2.6, 2.66, 96).rotateX(-Math.PI / 2), mat));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, tick = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.7).rotateX(-Math.PI / 2), mat);
      tick.position.set(Math.sin(a) * 3.0, 0, Math.cos(a) * 3.0);
      tick.rotation.y = a;
      circle.add(tick);
    }
    circle.position.copy(AMBUSH).setY(0.03);
    q.scene.add(circle);
    q.updaters.push((dt) => { circle.rotation.y += dt * 0.15; mat.opacity = this.arenaBusy ? 0.15 : 0.45 + 0.15 * Math.sin(this.engine.time * 2); });
    this.arenaWave = 0;
    const it = q.interact({ position: AMBUSH.clone(), radius: 3.4, look: AMBUSH.clone().setY(1), label: 'Call the Thunderers', action: () => this.arenaFight(q) });
    Object.defineProperty(it, 'enabled', { get: () => !this.arenaBusy });
  }

  async arenaFight(q) {
    const { player, powers, ui } = this, T = this.qT, n = ++this.arenaWave;
    this.arenaBusy = true;
    this.ringSay('ringArena');
    this.audio.rift(true);
    wait(1.5).then(() => this.audio.rift(false));
    const order = ['brute', 'caster', 'winged', 'archer', 'brute', 'caster', 'winged', 'archer', 'brute'];
    const count = Math.min(9, 2 + n), yaw = player.yaw, spawns = [];
    let perch = 0;
    for (let i = 0; i < count; i++) {
      const kind = order[i % order.length], a = yaw + (i - (count - 1) / 2) * 0.55, r = kind === 'caster' ? 16 : 13;
      if (kind === 'archer' && perch < q.perchTops.length) { spawns.push([kind, q.perchTops[perch++]]); continue; }
      const at = player.position.clone().add(V(Math.sin(a) * r, kind === 'winged' ? 9 : 0, Math.cos(a) * r));
      if (kind !== 'winged') at.y = 0;
      spawns.push([kind === 'archer' ? 'caster' : kind, at]);
    }
    Object.assign(powers, { healDelay: 6, healRate: 4 });
    await this.thunderWave(T, spawns, `Wave ${n}`);
    Object.assign(powers, { healDelay: 4, healRate: 8 });
    this.arenaBusy = false;
    if (this.roam.where !== 'qward') return;
    ui.objective(this.roamObjective());
    ui.toast(`Wave ${n} beaten`);
    this.life?.gain(30 + 10 * n, `Qward, wave ${n}`);
    this.ringSay('ringArenaClear');
  }

  // ---------------------------------------------------------------- Hal's block: in through the doors
  // The shops' doors open as he walks up to them (a bell as they do); inside, what there is to do
  // (city/Interiors.js `spots`): sit at the counter or in a booth, the jukebox, the menu; the store's
  // bell, its cooler and magazines. His own front door, behind the lot, takes him up to his flat.
  blockRoam(f) {
    const b = f.block;
    if (!b || this.blockIts) return;
    const { audio, player } = this;
    b.hal = player.position;
    b.onDoor = () => { audio.bell(1568, 0.07, 1.6); audio.bell(1975, 0.05, 1.4, 0.09); };
    if (f.office) f.office.hal = player.position; // (the Ferris offices' doors: city/Office.js)
    this.blockIts = [];
    for (const sp of [...b.ctx.spots, ...(f.office?.spots ?? [])]) {
      const act = {
        seat: () => this.sit(sp), jukebox: () => this.jukebox(sp), menu: () => this.bark('halMenuRoam'),
        counter: async () => { audio.bell(2093, 0.16, 1.8); await wait(0.5); if (this.cityLife?.started) { await this.cityLife.bell(); await this.buyAtStore(); } else this.bark('halBell'); },
        cooler: () => this.bark('halCooler'), magazines: () => this.bark('halMags'),
        restroom: () => this.restroom(sp),
        buy: () => this.shopBuy(sp),
        look: () => this.bark(sp.line),
      }[sp.kind];
      // (a seat from where he stands to sit: its bench is past the table's end, out of reach)
      const it = f.interact({ position: sp.kind === 'seat' ? sp.approach ?? sp.at : sp.at, radius: sp.kind === 'seat' ? 0.7 : 1.1, look: sp.look ?? sp.at.clone().setY(sp.at.y + 0.9), label: sp.label, action: act });
      if (sp.kind === 'seat') Object.defineProperty(it, 'enabled', { get: () => !sp.taken, set() {} }); // (someone's eating there)
      if (sp.kind === 'restroom') Object.defineProperty(it, 'label', { get: () => (this.civilian ? 'Change in the restroom' : 'Change back in the restroom') });
      this.blockIts.push(it);
    }
    // its people (story/CityLife.js): loaded while he's already about, they appear when they're ready
    this.cityLife = new CityLife(this, f);
    this.cityLife.start().catch((e) => console.warn('city life', e));
    // home: his building's front door, on the lot
    const door = LOT.clone().add(V(0.4, 0, 12.7));
    this.blockIts.push(f.interact({ position: door, radius: 1.4, look: door.clone().add(V(0, 1.4, 0.8)), label: 'Go up to the apartment', action: () => this.enterFlat() }));
  }

  // At Coast Liquor's register, once Ray's there: a soda, a candy bar or a scratcher (story/Life.js's
  // money; a scratcher now and then wins). Green Lantern's is on the house.
  async buyAtStore() {
    const { ui, life, cityLife: cl } = this;
    if (!life || !cl) return;
    if (!this.civilian) { await cl.clerkSay('clerkGFree'); return; }
    const items = [['A soda', 0.6, 'soda'], ['A candy bar', 0.35, 'candy'], ['A scratcher', 1, 'scratch']];
    const pick = ui.pick('Coast Liquor', [...items.map(([n, p]) => `${n} · ${money(p)}`), 'Nothing, thanks']);
    const i = await Promise.race([pick, wait(12).then(() => -1)]);
    pick.cancel();
    if (i < 0 || i >= items.length) return;
    const [name, price, kind] = items[i];
    if (!life.spend(price, name.replace(/^A /, 'a '))) { this.audio.denied(); await cl.clerkSay('clerkShort'); return; }
    this.audio.bell(2400, 0.05, 1.2); // (the register)
    await cl.clerkSay(kind === 'scratch' ? 'clerkScratch' : 'clerkThanks');
    if (kind !== 'scratch') { this.bark(kind === 'soda' ? 'halSoda' : 'halCandy'); return; }
    // the scratcher: mostly nothing, sometimes his dollar back twice, now and then real money
    await wait(1.4);
    const r = Math.random(), win = r < 0.02 ? 100 : r < 0.1 ? 10 : r < 0.3 ? 2 : 0;
    if (win) { this.audio.ringChime(); life.pay(win, 'a winning scratcher'); this.bark(win >= 10 ? 'halScratchBig' : 'halScratchWin'); }
    else this.bark('halScratchLose');
  }

  // At the other shops' counters (city/Shops.js): what each sells, paid from his money (story/Life.js),
  // and what it does: food heals a little, the clinic all of it, the laundromat and the barber take
  // the time they take. Green Lantern has no wallet: they tell him so.
  async shopBuy(sp) {
    const { ui, life, cityLife: cl, powers, dayCycle: dc } = this;
    if (!life) return;
    const keep = cl?.people.find((p) => p.tag === `shop:${sp.shop}`), female = /f\d$/.test(keep?.voice ?? '');
    if (!this.civilian) { if (keep) await cl.say(keep, female ? 'shopGLf' : 'shopGLm'); return; }
    const pick = ui.pick(sp.label.replace(/^Buy something · /, ''), [...sp.sell.map(([n, p]) => (p ? `${n} · ${money(p)}` : n)), 'Nothing, thanks']);
    const i = await Promise.race([pick, wait(12).then(() => -1)]);
    pick.cancel();
    if (i < 0 || i >= sp.sell.length) return;
    const [name, price, what] = sp.sell[i];
    if (price && !life.spend(price, name.toLowerCase())) { this.audio.denied(); this.bark('halShort'); return; }
    if (price) this.audio.bell(2400, 0.05, 1.2);
    if (keep && what !== 'balance') await cl.say(keep, THANKS[keep.voice] ?? 'thxM1');
    const [kind, n] = what.split(':');
    if (kind === 'food') { powers.health = Math.min(powers.maxHealth, powers.health + Number(n)); this.bark(Number(n) >= 20 ? 'halEat2' : 'halEat1'); }
    else if (kind === 'heal') { powers.health = powers.maxHealth; this.bark('halClinic'); }
    else if (kind === 'balance') { if (keep) await cl.say(keep, 'shopBank3'); ui.toast(`Hal Jordan · checking · ${money(life.d.money)}${life.d.tab ? ` · owes Rosie ${money(life.d.tab)}` : ''}`); }
    else if (TAKES[kind]) {
      // what takes a while: the screen dark for it, the clock on (a load washed, a picture seen, a workout)
      this.takeControl();
      await ui.fade(1, 0.7);
      dc?.setHour(dc.hour + TAKES[kind]);
      if (dc) dc.apply(this.engine.camera);
      if (kind === 'workout') powers.health = powers.maxHealth;
      await wait(0.6);
      await ui.fade(0, 0.7);
      this.giveControl(this.roamObjective());
      this.bark({ wash: 'halWash', press: 'halPress', movie: 'halMovie', workout: 'halWorkout' }[kind] ?? 'halHaircut');
    } else this.bark({ record: 'halRecord', flowers: 'halFlowers', oil: 'halOil', tape: 'halTape', drink: 'halBeer', book: 'halBook', jacket: 'halJacket', radio: 'halRadio' }[kind] ?? 'halEat1');
  }

  // Sit on a stool or a bench: walked up to, turned, lowered onto it; up again on E or a step
  async sit(sp) {
    const { player, ui } = this;
    this.busy = true;
    this.takeControl();
    this.powers.holster?.();
    if (player.flying) await this.touchDown();
    const fwd = V(Math.sin(sp.face), 0, Math.cos(sp.face));
    const from = sp.approach ?? sp.at.clone().addScaledVector(fwd, -0.6);
    await player.walkTo(from, player.walkSpeed);
    player.turnTo(sp.face);
    await wait(0.35);
    const hy = sp.sit + 0.06 - (player.rig?.hipsHeight ?? 0.98);
    player.autoAnim = false; // (or the player's own update plays the walk over it)
    player.animator.play(still(makePose({ ...POSES.sitEdge, hy, sx: sp.stool ? 0.12 : 0.06, nx: -0.04 }), 1.1), 0.7);
    const a = player.position.clone();
    await tween(0.7, (k) => player.place(a.clone().lerp(sp.at, ease.inOut(k)), sp.face), ease.linear);
    this.seated = sp;
    ui.objective('Sitting · E or W to get up');
    this.cityLife?.seated(sp);
    await wait(0.6);
    await waitFor(() => this.input.hit('KeyE') || this.input.hit('KeyW') || this.input.hit('KeyS'));
    this.input.consume?.('KeyE');
    player.animator.play(player.loco, 0.6);
    player.autoAnim = true;
    const b0 = player.position.clone();
    await tween(0.6, (k) => player.place(b0.clone().lerp(from, ease.inOut(k)), sp.face), ease.linear);
    this.seated = null;
    this.cityLife?.stood(sp);
    this.busy = false;
    this.giveControl(this.roamObjective());
  }

  // Rosie's jukebox: a coin, and a slow fifties progression on its bells until he walks away or stops it
  jukebox(sp) {
    if (this.jukeOn) { this.jukeOn = false; return; }
    this.jukeOn = true;
    const { audio, player } = this;
    const N = { G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523 };
    const bars = [['C4', 'E4', 'G4', 'C5'], ['A3', 'C4', 'E4', 'A4'], ['F4', 'A4', 'C5', 'A4'], ['G3', 'B3', 'D4', 'G4']];
    audio.tone({ type: 'triangle', freq: 1800, to: 900, peak: 0.05, dur: 0.12 }); // the coin
    (async () => {
      while (this.jukeOn && player.position.distanceTo(sp.at) < 28) {
        for (const bar of bars) { const notes = [...bar, ...bar].map((n) => N[n]); await wait(audio.musicBox(notes, 0.27, 0.07)); if (!this.jukeOn) break; }
      }
      this.jukeOn = false;
    })();
  }

  // ---------------------------------------------------------------- his flat
  // Up the stairs: the apartment from Part Three, by day or by night as the town is outside; the fridge,
  // the coffee, the photo, the window, the bed (sleeping turns the town's day to night, or back), the
  // front door out to the lot.
  buildFlat() {
    const room = (this.flat = new Bedroom(this).build({ morning: true }));
    this.dayLights(room);
    room.interact({ position: V(-4.05, 0, 2.82), radius: 0.9, look: V(-4.6, 1.2, 2.82), label: 'Go out', action: () => this.exitFlat() });
    // the rent notice by the door, the week it's due (story/Life.js)
    const rent = room.interact({ position: V(-3.2, 0, 2.0), radius: 0.75, look: V(-3.9, 0.05, 2.7), label: 'Pay the rent', action: () => this.payRent() });
    const due = () => (this.life ? this.life.rentState(this.dayCycle?.day ?? 1) : null);
    Object.defineProperty(rent, 'enabled', { get: () => !!due()?.soon, set() {} });
    Object.defineProperty(rent, 'label', { get: () => { const st = due(); return st ? `Pay Sal the rent · ${money(st.owed)}${st.late ? ` · ${st.late} day${st.late > 1 ? 's' : ''} late` : ''}` : 'Pay the rent'; } });
    room.interact({ position: V(0.8, 0, 2.35), radius: 0.8, look: V(0.8, 1.0, 3.0), label: 'Check the fridge', action: () => this.checkFridge() });
    room.interact({ position: V(0.1, 0, 2.45), radius: 0.8, look: V(0.22, 1.0, 3.0), label: 'Make coffee', action: () => this.bark('coffee') });
    room.interact({ position: V(1.25, 0, -1.25), radius: 0.9, look: V(1.3, 0.92, -1.86), label: 'Look at the photo', action: () => this.bark('halHomePhoto') });
    room.interact({ position: V(1.85, 0, -0.35), radius: 0.9, look: V(2.4, 1.5, -0.35), label: 'Look outside', action: () => this.bark('halHomeWindow') });
    const bed = room.interact({ position: V(-0.2, 0, -0.6), radius: 0.9, look: V(-1.1, 0.6, -1.0), label: 'Sleep', action: () => this.sleep() });
    Object.defineProperty(bed, 'label', { get: () => (this.ferrisScene?.isNight ? 'Sleep till morning' : 'Sleep till evening') });
    return room;
  }

  async payRent() {
    const day = this.dayCycle?.day ?? 1, st = this.life.rentState(day);
    if (!this.life.payRent(day)) { this.audio.denied(); this.ui.toast(`The rent is ${money(st.owed)}. He has ${money(this.life.d.money)}.`); await this.bark('halRentShort'); return false; }
    this.audio.paper?.();
    await this.bark('halRentPaid');
    return true;
  }

  async enterFlat() {
    const { player, ui, audio, powers } = this;
    // five days late, Sal changes the lock: paid at the door, or not tonight
    const st = this.life?.rentState(this.dayCycle?.day ?? 1);
    if (st && st.late > 5) {
      await this.bark('halLocked');
      const pick = ui.pick('Sal changed the lock', [`Pay him ${money(st.owed)}`, 'Not now']);
      const i = await Promise.race([pick, wait(12).then(() => -1)]);
      pick.cancel();
      if (i !== 0 || !(await this.payRent())) return;
    }
    this.busy = true;
    this.takeControl();
    powers.holster?.();
    if (player.flying) await this.touchDown();
    this.jukeOn = false;
    audio.door();
    await ui.fade(1, 0.6);
    const room = this.flat ?? this.buildFlat();
    this.bedroom = room; // (checkFridge's)
    this.show(room);
    this.playerActive = true;
    this.inBed = false;
    player.spawn(room.physics, room.scene, V(-3.85, 0, 2.82), Math.PI / 2);
    player.camDist = 2.1;
    player.surface = 'wood';
    player.ground = () => 0;
    this.flatTime(room, !!this.ferrisScene?.isNight);
    this.ambience(audio.traffic(0.03), audio.roomTone(0.035));
    Object.assign(powers.enabled, { flight: false, constructs: false }); // (indoors)
    this.roam.where = 'home';
    this.roamTick = null;
    await ui.fade(0, 0.6);
    this.busy = false;
    this.giveControl(this.roamObjective());
    this.bark('halHome');
  }

  async exitFlat() {
    const { ui, audio } = this;
    this.busy = true;
    this.takeControl();
    audio.door();
    await ui.fade(1, 0.6);
    const f = this.ferrisScene;
    this.enterFerris(LOT.clone().add(V(0.4, 0, 13.2)), Math.PI);
    this.ferrisRoam(f, 'coast');
    this.roam.where = 'coast';
    this.powersFor();
    await ui.fade(0, 0.6);
    this.busy = false;
    this.giveControl(this.roamObjective());
  }

  // The flat by night: the desk lamp and the hall light on, the moon in the window, the night sky out
  // there; by day the morning's light (Bedroom's own day setting)
  flatTime(room, night) {
    room.hemi.intensity = night ? 0.12 : 0.55;
    room.hemi.color.setHex(night ? 0x6a7a99 : 0xc4d6ea);
    room.lampLight.intensity = night ? 6 : 0;
    room.lampFill.intensity = night ? 0.7 : 0;
    room.lamp.bulb.material.color.setRGB(...(night ? [2.6, 2.0, 1.4] : [0.3, 0.25, 0.2]));
    room.moon.color.setHex(night ? 0x8ea8dd : 0xffdcb0);
    room.moon.intensity = night ? 0.7 : 3.2;
    room.hallLight.intensity = night ? 2.2 : 0.25;
    for (const l of room.dayFill ?? []) l.visible = true, l.intensity = night ? 0 : l.userData.day ?? (l.userData.day = l.intensity);
    room.glassU.uDay.value = night ? 0 : 1;
    room.scene.fog.color.setHex(night ? 0x05070a : 0xbac9d6);
    room.sky.removeFromParent();
    room.sky = createSky(night ? 'night' : 'morning');
    room.scene.add(room.sky);
    room.setClock(night ? '11:40' : '8:15', night);
  }

  // Lie down, and the town outside turns over: day to night, or night to morning
  async sleep() {
    const { player, ui } = this;
    this.busy = true;
    this.takeControl();
    this.bark('halSleep');
    await wait(1.2);
    await ui.fade(1, 1.4);
    const f = this.ferrisScene, night = !f.isNight, dc = this.dayCycle;
    if (dc) { dc.setHour(night ? 19.65 : 7.1); dc.apply(this.engine.camera); } else if (night) f.night(); else f.day();
    this.flatTime(this.flat, night);
    player.place(V(-0.2, 0, -0.45), Math.PI);
    await wait(1.0);
    ui.toast?.(night ? `Evening · ${dc?.clock ?? '7:40 PM'}` : `Morning · ${dc?.clock ?? '7:05 AM'}`);
    await ui.fade(0, 1.4);
    this.busy = false;
    this.giveControl(this.roamObjective());
  }

}

// Kilowog's range from Part Two: another round when asked (the drill, his lines, the drones' waves).
for (const name of ['wave', 'kwSay', 'kwBark', 'kwPoint', 'addDrillStart']) Roam.prototype[name] ??= Corps.prototype[name];
