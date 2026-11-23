import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { SapphireSave, RoamSave } from '../engine/Save.js';
import { Roam } from './Roam.js';
import { CAROL_IN, HANGAR_MOUTH } from './Exile.js';
import { loadProps, prop, hasProp } from '../props/Props.js';
import { FERRIS_PROPS, LOT, coastX } from '../scenes/Ferris.js';
import { createRing, createSapphire, createStarSapphire, createKorugarian, createKatma, createAgapo, createWilliamHand } from '../characters/Characters.js';
import { makePose, still, POSES } from '../characters/Poses.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { loadPeople, createPerson } from '../characters/People.js';
import { launchOut } from './Voyage.js';
import { Space, ZAMARON } from '../scenes/Space.js';
import { Wake, WAKE_PROPS, LOCK, WEAK, SHARDS, VEIL } from '../scenes/Wake.js';
import { Zamaron, ZAMARON_PROPS, ARRIVE, LANDING, COURT, STAIR, PLAZA, BATTERY, THRONE, GATE } from '../scenes/Zamaron.js';
import { glowTexture } from '../fx/Textures.js';
import { createShaft } from '../fx/GreenLight.js';
import { sliced, breath } from '../engine/Slice.js';
import { StarSapphire, SapphireAlly, YIELD_AT, sapFlight } from '../enemies/StarSapphire.js';
import { Predator, loadPredator, PRED } from '../enemies/Predator.js';
import { RAPIER } from '../engine/Physics.js';
import { Mortuary, MORTUARY_PROPS, ROOM, TABLE as MORT_TABLE, TABLE_TOP as MORT_TABLE_TOP, HAND_AT as MORT_HAND_AT, STAIRS as MORT_STAIRS } from '../scenes/Mortuary.js';
import { constructMesh } from '../powers/Constructs.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const _h = new THREE.Vector3(), _r = new THREE.Vector3();
// the second airframe in Hangar Two, where Carol works: her eyes are on its cockpit (Part Six's dawn)
const AIRFRAME = V(-6, 0, 25), COCKPIT = V(-6, 2.2, 25);
// the pier's head (city/Waterfront.js: the deck 4.2 m up, the Ferris wheel at x -1454, the Crab Shack
// across the end), in the world: she comes along the deck from the east, they stand either side of
// a metre and a half of planking by the south rail, he facing east and she west, the wheel behind her and the sea
// behind him
const DECK = 4.2;
const RAIL_Z = LOT.z + 350, RAIL_TOP = DECK + 1.09; // the head's south rail (PIER.z 372 less its 22 m half width)
const PIER_HAL = V(-1470.5, DECK, LOT.z + 352.4), PIER_CAROL = V(-1468.85, DECK, LOT.z + 352.4), PIER_FROM = V(-1447, DECK, LOT.z + 352.4);
// dinner: a table for two on the deck in front of the Crab Shack, he on its west side and she on its east
// (over his shoulder the wheel and the lit front behind her; over hers the Crab Shack's windows)
const TABLE = V(-1505, DECK, LOT.z + 357), SEAT_Y = 0.47;
const SEAT_HAL = TABLE.clone().add(V(-0.64, 0, 0)), SEAT_CAROL = TABLE.clone().add(V(0.64, 0, 0));
// after it, at the rail: side by side looking out to sea (south), she on his left
const LEAN_HAL = V(-1471.15, DECK, RAIL_Z + 0.4), LEAN_CAROL = V(-1469.95, DECK, RAIL_Z + 0.3);
// sitting at a table: upright, forearms forward on it
const DINING = makePose({
  hy: -0.29, sx: 0.04, cx: 0.06, nx: 0.02,
  lLx: -1.42, kL: 1.45, lRx: -1.5, kR: 1.55, lLz: 0.06, lRz: -0.06,
  aL: [0.22, -0.72, 0.62], eL: 1.25, aR: [-0.22, -0.72, 0.62], eR: 1.25,
});
// Carol at the same rail: she's 23 cm shorter, so less bent over it (Hal's lean put her shoulders level with
// the rail and her arms went out straight to reach it); her hands on it, the elbows out to her sides
const CAROL_LEANING = makePose({
  sx: 0.2, cx: 0.16, nx: -0.2, kx: -0.12,
  lRx: 0.08, kR: 0.14, lRz: -0.03, fR: 0.08,
  aL: [0.3, -0.5, 0.8], eL: 1.5, aR: [-0.3, -0.5, 0.8], eR: 1.5,
});
// leaning on a rail: hips back, the back bent over it, the head up to the sea; the forearms on the top rail
// (the hands just past it by IK, the elbows down onto it)
const LEANING = makePose({
  sx: 0.42, cx: 0.38, nx: -0.38, kx: -0.22,
  lRx: 0.12, kR: 0.2, lRz: -0.04, fR: 0.1,
  aL: [0.2, -0.4, 0.9], eL: 1.4, aR: [-0.2, -0.4, 0.9], eR: 1.4,
});
// the fight: she waits out over the water west of the pier's head, and keeps within ARENA's 62 m of it
// (the open sea behind her from the pier, the wheel and the lit waterfront behind her from the west);
// she comes down at the end where she stood at dinner, on the sea side of him (`LAND`, `LAND_HAL`: the pier's
// west end is the Crab Shack's wall, and a camera in the gap beside it looks at plaster)
const SAP_WAIT = V(-1596, 34, LOT.z + 330), ARENA = V(-1556, 0, LOT.z + 338);
const LAND = PIER_HAL.clone(), LAND_HAL = PIER_CAROL.clone();
// the Predator's fight on the citadel's plaza: Hal and Carol toward its south side (the gate behind them, the
// battery and the dais ahead), it comes down on the plaza's middle, between them and the dais
// the queen's place in her light: over the dais's front, off its middle (Carol is over the middle, and comes down
// past it to him)
const QUEEN_AT = THRONE.clone().add(V(2.8, 1.6, 4.0));
const PRED_HAL = PLAZA.clone().add(V(0, 0, 22)), PRED_CAROL = PRED_HAL.clone().add(V(-2.3, 0, 0.6)), PRED_AT = PLAZA.clone().add(V(0, 0, -2));
// floating, her arms open and her head back: the light holding her (parameter pose, as the voyage's)
const RAPTURE = makePose({
  sx: -0.06, cx: -0.12, nx: -0.28, kx: -0.22,
  aL: [0.7, -0.8, 0.12], eL: 0.25, aR: [-0.7, -0.8, 0.12], eR: 0.25,
  lLx: -0.05, kL: 0.1, lRx: 0.05, kR: 0.22, fL: 0.85, fR: 0.85,
});

// Part Seven, "Sapphire" (the user's pick, 2026-11-20, from my pitch of the 19th; the part's name is
// mine). The comics' Carol Ferris is chosen by the Zamarons and becomes Star Sapphire (Green Lantern
// #16, 1962; Geoff Johns's "Mystery of the Star Sapphire", Green Lantern vol. 4 #18-20, 2007): a violet
// gem comes looking for a woman who loves hard enough, and takes her. Ours: he asks her to dinner and she
// sets her terms; the pier at night, the ring quiet in his pocket; and the violet light.
// Black Hand, who took Atrocitus's machine from the building site, is this part's sting and Part Eight's story.
export class Sapphire extends Roam {
  get save() { return SapphireSave; }

  steps() {
    return {
      ask: () => this.ask(),
      pier: () => this.pier(),
      strike: () => this.strike(),
      hold: () => this.hold(),
      trail: () => this.followWake(),
      zamaron: () => this.toZamaron(),
      queen: () => this.queenOfZamaron(),
      predator: () => this.predatorFight(),
      return: () => this.flyHome(),
      wheel: () => this.pierAtMidnight(),
      hangar: () => this.morningAfter(),
      hand: () => this.blackHand(),
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    // (off Earth: no valley to build, only the place itself, which its chapter builds)
    const away = id === 'trail' || id === 'zamaron' || id === 'queen' || id === 'predator', room = id === 'hand';
    await loadProps(away ? (id === 'trail' ? WAKE_PROPS : ZAMARON_PROPS) : room ? MORTUARY_PROPS : FERRIS_PROPS, (k) => ui.loadStage('props', k));
    if (!away && !room) await this.setupFerrisAsync(); // (in slices, under the loading screen)
    else this.engine.gradeUniforms.uFlash.value = 1; // (each begins out of the flash of arriving)
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0);
    this.learn('hammer', false);
    this.learn('staff', false);
    if (id === 'pier' || id === 'strike' || id === 'hold' || id === 'return' || id === 'wheel') await this.prepPier();
  }

  // The pier: the city's blocks round its head built, and the night's materials compiled (under the loading
  // screen: the way in's when the part starts here, or a short one of its own when `ask` plays on into it).
  async prepPier() {
    const { ui } = this, f = this.ferrisScene, at = PIER_HAL.clone();
    if (this.pierReady) return;
    this.pierReady = true;
    // (the waterfront across the water too: from the pier's head it's 280 to 360 m off, the far boxes' distance)
    if (f.city) {
      f.city.keep = { x: at.x, z: at.z - LOT.z, r: 470 };
      await sliced(f.city.fill(at.x, at.z - LOT.z, 470), 24, { key: 'fill_pier2', expect: 900, onProgress: (k) => ui.loadStage('city', k) });
    }
    // (put back to the hour it is by then: the far pieces compile after the chapter's begun, and a fixed "dusk"
    // here left the night's lamps and lit rooms at dusk's third all through `strike` and `hold`)
    await this.warmUp(f.scene, () => { this.pierLamps('night'); return () => this.pierLamps(this.pierMode ?? 'dusk'); }, [f.scene], (k) => ui.loadStage('shaders', k), { near: at, radius: 400 });
  }

  // ---------------------------------------------------------------- 1. dinner
  // A morning in Hangar Two, a few days on from the trial. Carol is working on the second airframe
  // and hasn't looked up. He asks again (he asked in Part Four and she said she doesn't date employees;
  // in Part Six she said "that's me not saying no"); she sets her terms: after five he isn't her pilot,
  // the pier at seven, the ring quiet in his pocket, and he tells her first if he's called away. She
  // doesn't see what he doesn't either: a violet light, in the dark of the cockpit, once.
  async ask() {
    const { ui, director, audio, player } = this;
    const f = this.setupFerris(), cock = this.cockpitOf(f);
    ui.clock(this.save.info('ask').clock);
    this.takeControl();
    ui.objective(null);
    const carol = this.addCarol(), ca = this.carolAnim, cb = this.cb;
    if (carol) {
      carol.root.position.copy(CAROL_IN);
      carol.root.rotation.y = yawTo(CAROL_IN, AIRFRAME);
      ca.lookAt(cock, 0.5);
      cb.lookHome = () => () => cock;
    }
    this.enterFerris(HANGAR_MOUTH.clone().add(V(0, 0, -9)), 0);
    this.ambience(audio.wind(0.03));
    f.focus(V(0, 0, 12));
    await ui.fade(0, 0.9);
    this.giveControl('Carol’s in Hangar Two');
    wait(1.6).then(() => this.bark('halAsk0'));
    await waitFor(() => player.position.distanceTo(CAROL_IN) < 4.6);
    this.takeControl();
    const stand = CAROL_IN.clone().add(V(-0.5, 0, -2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    player.turnTo(yawTo(stand, CAROL_IN));
    f.focus(CAROL_IN);
    if (carol) {
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
      ca.lookAt(this.headOf(player.rig), 0.6);
      cb.lookHome = () => this.headOf(player.rig);
    }
    // she doesn't turn round straight away
    await this.overHal(1.6);
    await this.carolSay('carolAsk1');
    if (carol) { const y0 = carol.root.rotation.y, y1 = yawTo(CAROL_IN, stand); await tween(1.0, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k))); }
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.8, 0.3);
    await this.say('halAsk1');
    await this.carolClose(1.1);
    await this.carolSay('carolAsk2', [['sky', () => ca.gesture('tilt', 1, 0.4)]]);
    await this.halClose(1.0, -1);
    await this.say('halAsk2');
    await this.carolClose(1.2, -1, 30);
    await this.carolSay('carolAsk3', [['employees', 'stop']]);
    await this.halClose(0.9);
    player.animator.gesture('shake', 0.8, 0.25);
    await this.say('halAsk3');
    await this.carolClose(1.1, 1, 30);
    await this.carolSay('carolAsk4', [['five', () => ca.gesture('nod', 0.9, 0.25)], ['record', () => ca.gesture('tilt', 1, 0.4)]]);
    await this.halClose(0.8, -1);
    player.animator.gesture('nod', 0.8, 0.35);
    await this.say('halAsk4');
    await this.carolClose(1.0);
    await this.carolSay('carolAsk5', [['table', 'open']]);
    await this.halClose(0.9);
    await this.say('halAsk5');
    await this.carolClose(1.0, -1, 30);
    await this.carolSay('carolAsk6', [['glow', () => ca.gesture('shake', 1.1, 0.25)]]);
    // the ring: he looks at it
    const ringAt = () => this.ring.getWorldPosition(_r);
    await this.halClose(0.9, -1);
    player.lookAt(ringAt, 0.7);
    await this.say('halAsk6');
    await this.carolClose(1.0);
    await this.carolSay('carolAsk7', [['pocket', 'open']]);
    // it goes quiet
    this.ringGlow = 2.4;
    await wait(0.5);
    this.ringGlow = 0.15;
    if (carol) player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    await this.halClose(1.0);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halAsk7');
    await this.carolClose(1.2, 1, 28);
    await this.carolSay('carolAsk8', [['first', 'stop'], ['waiting', 'chest']]);
    await this.halClose(1.0, -1);
    await this.say('halAsk8');
    await this.carolClose(1.0);
    await this.carolSay('carolAsk9', [['Go', () => ca.gesture('chin', 1, 0.35)]]);
    // he goes
    if (carol) { ca.lookAt(cock, 0.5); cb.lookHome = () => () => cock; }
    player.lookAt(null);
    director.cut(CAROL_IN.clone().add(V(-2.4, 1.45, -3.4)), HANGAR_MOUTH.clone().add(V(0, 1.3, 1)), 38);
    const out = HANGAR_MOUTH.clone().add(V(0, 0, -2.5));
    const leave = player.walkTo(out, player.walkSpeed);
    await wait(0.8);
    this.say('halAsk9', { skip: false });
    await leave;
    // and Carol, alone with the airframe, back at her work; over her shoulder, a light in the cockpit
    // that isn't any of the hangar's
    if (carol) {
      const y0 = carol.root.rotation.y, y1 = yawTo(CAROL_IN, AIRFRAME);
      await tween(0.9, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k)));
      const c = carol.bonePosition('head', _h).clone(), to = cock.clone().sub(c).setY(0).normalize(), side = V(to.z, 0, -to.x);
      director.cut(c.clone().addScaledVector(to, -1.5).addScaledVector(side, 0.55).add(V(0, 0.15, 0)), cock.clone().lerp(c, 0.18).add(V(0, -0.15, 0)), 34);
    }
    await wait(1.4);
    this.violetGlint(cock);
    await wait(1.3);
    await this.carolSay('carolAsk10');
    await wait(1.2);
    await ui.fade(1, 1.2);
  }

  // Over Hal's shoulder at Carol, as Coast's, from the floor he's actually on (the pier's deck is 4.2 m up)
  overHal(duration = 1.6) {
    const c = this.player.position.clone(), head = this.carol.bonePosition('head', V(0, 0, 0));
    const back = c.clone().sub(head).setY(0).normalize(), right = V(back.z, 0, -back.x);
    return this.director.move(c.clone().addScaledVector(back, 1.9).addScaledVector(right, 0.75).setY(c.y + 1.8), V(c.x, c.y + 1.55, c.z).lerp(head, 0.6), duration, ease.inOut, 38);
  }

  // ---------------------------------------------------------------- 2. the pier
  // The sky and the lights of the waterfront at this hour: the dusk when he's waiting, the night after dinner.
  pierSet(mode) {
    const f = this.ferrisScene;
    this.pierMode = mode;
    if (mode === 'dusk') f.dusk(); else f.night();
    this.pierLamps(mode);
  }

  // (how far on the town's lamps and lit rooms are: part on at dusk, all on by night, off by day)
  pierLamps(mode) {
    const f = this.ferrisScene, k = mode === 'dusk' ? [0.3, 0.3, 0.55] : mode === 'day' ? [0, 0, 0] : [1, 1, 1];
    f.block?.setNight(k[0]); f.office?.setNight(k[1]); f.city?.setNight(k[2]);
  }

  // The pier's head with the two of them on it (the chapter's own scene: `strike` can start from here too).
  stagePier(mode) {
    const { player, audio, ui } = this, f = this.setupFerris();
    this.pierSet(mode);
    this.enterFerris(PIER_HAL.clone().add(V(0, 0.05, 0)), Math.PI / 2);
    player.ground = (x, z) => (f.city?.onPier(x, z) ? DECK : 0); // (the foot IK's floor: the deck, not the sand)
    f.focus(PIER_HAL);
    this.ambience(audio.wind(0.04), audio.traffic(0.006));
    const carol = this.addCarol();
    if (carol) {
      carol.root.position.copy(PIER_CAROL);
      carol.root.rotation.y = -Math.PI / 2;
      this.carolAnim.lookAt(this.headOf(player.rig), 0.6);
      this.cb.lookHome = () => this.headOf(player.rig);
    }
    // the table outside the Crab Shack, set at dusk and eaten at by night (a chapter from its own checkpoint
    // after dinner finds it so)
    const d = this.buildDinner();
    if (mode !== 'dusk') { d.served.visible = true; d.lit(true); d.solid(); }
    this.pierStaged = true;
    ui.objective(null);
  }

  // Seven o'clock, the pier, the light going. He's early; she comes along the deck from the east in what she
  // wore to work ("this is the dress code"); dinner at the Crab Shack, off the page; after it, at the rail
  // under the wheel, what each of them is afraid of (ours). Then the ring, which was meant to be quiet.
  async pier() {
    const { ui, director, audio, player } = this;
    const f = this.setupFerris();
    this.takeControl();
    if (!this.pierReady) { ui.loadStart('Part Seven · The pier', [['city', 'Building the waterfront', 3], ['shaders', 'Getting the light right', 3]]); await this.prepPier(); }
    this.stagePier('dusk');
    const carol = this.carol, ca = this.carolAnim, cb = this.cb, loco = this.carolLoco;
    player.turnTo(-Math.PI / 2); // (he waits facing the sea)
    if (carol) { carol.root.position.copy(PIER_FROM); ca.lookAt(null); }
    // the waterfront at dusk: the whole of it, then closer
    director.cut(V(-1420, 8.6, LOT.z + 341), V(-1466, 9, LOT.z + 357), 44);
    await ui.fade(0, 1.4);
    director.move(V(-1438, 6.6, LOT.z + 344), V(-1467, 7, LOT.z + 356), 7, ease.inOut, 40);
    await wait(1.2);
    this.bark('halPier1');
    await wait(3.4);
    // along the deck to him: the camera by Hal's shoulder looking back at her
    director.cut(PIER_HAL.clone().add(V(-0.9, 1.75, -1.6)), V(-1452, DECK + 1.3, LOT.z + 354.4), 38);
    if (carol) {
      ca.lookAt(this.headOf(player.rig), 0.5);
      const d = PIER_FROM.distanceTo(PIER_CAROL), walk = tween(d / 1.45, (k) => { carol.root.position.lerpVectors(PIER_FROM, PIER_CAROL, k); loco.speed = 1.45 * Math.min(1, k * 8, (1 - k) * 7); }, ease.linear).then(() => (loco.speed = 0));
      await wait(d / 1.45 - 3);
      player.turnTo(Math.PI / 2);
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
      await walk;
    }
    // the first words, then the two of them in profile from the rail side, the wheel over them
    cb.stance('hip');
    await this.overHal(1.6);
    await this.carolSay('carolPier1', [['worry', () => ca.gesture('tilt', 1, 0.35)]]);
    await this.pierTwoShot(1.2);
    await this.say('halPier2');
    await this.carolClose(1.1);
    cb.stance(null);
    await this.carolSay('carolPier2', [['dress', 'open'], ['tie', () => ca.gesture('shake', 1, 0.25)]]);
    await this.halClose(0.9, -1);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halPier3');
    await this.pierTwoShot(1.0, 0.6);
    await this.carolSay('carolPier3', [['push', 'stop']]);
    // dinner at the table outside the Crab Shack, the night come down
    await ui.fade(1, 0.9);
    this.pierSet('night');
    ui.clock('8:34 PM');
    await this.dinner();
    // and after it, at the rail
    await this.railTalk();
  }

  // The pier's two of them in profile from the rail side (the sea behind the camera, the deck and the wheel
  // behind them); `near` brings the camera in.
  pierTwoShot(dur = 1.4, near = 0) {
    const a = this.player.position, b = this.carol.root.position, m = a.clone().lerp(b, 0.5);
    const across = V(b.x - a.x, 0, b.z - a.z).normalize(), side = V(-across.z, 0, across.x);
    if (side.z < 0) side.negate(); // (the camera on the deck's side, the sea and the sky behind them)
    return this.director.move(m.clone().addScaledVector(side, 3.5 - near).addScaledVector(across, -0.3).add(V(0, 1.5, 0)), m.clone().add(V(0, 1.4, 0)), dur, ease.inOut, 38);
  }

  // Close on someone's face from in front of where their body faces (`yaw`), from the head bone: seated or
  // standing (Coast's close-ups take a standing head's height)
  faceShot(rig, yaw, { dist = 1.5, side = 1, up = -0.03, fov = 32, dur = 1.2 } = {}) {
    const h = rig.bonePosition('head', V(0, 0, 0)), f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, dist).addScaledVector(r, 0.42 * side).add(V(0, up, 0)), h.clone().add(V(0, -0.03, 0)), dur, ease.inOut, fov);
  }

  // The table for two on the deck (built once; the plates and the candle's light once they're at it): a round
  // top under a cloth, a candle in a glass, two plates of the catch of the day, two glasses, the bottle, two
  // bistro chairs. Solid once they've left it (sat at, a chair's box would push the capsule off it).
  buildDinner() {
    const f = this.ferrisScene;
    if (this.dinnerSet) return this.dinnerSet;
    const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    const wood = M(0x6b4528, { roughness: 0.55 }), iron = M(0x1f2224, { roughness: 0.4, metalness: 0.7 }), cloth = M(0xc9b79c, { roughness: 0.9 });
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    // the table: a pedestal, a round top, the cloth over it to a hand's depth
    add(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 20), iron, 0, 0.015, 0);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.71, 10), iron, 0, 0.37, 0);
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32), wood, 0, 0.725, 0);
    add(new THREE.CylinderGeometry(0.445, 0.445, 0.005, 40), cloth, 0, 0.743, 0);
    add(new THREE.CylinderGeometry(0.445, 0.455, 0.16, 40, 1, true), cloth, 0, 0.665, 0).material.side = THREE.DoubleSide;
    // a chair each, its back away from the table
    for (const [sx, ry] of [[-1, Math.PI / 2], [1, -Math.PI / 2]]) { // (its back, at local -z, away from the table)
      const c = new THREE.Group();
      c.position.set(sx * 0.64, 0, 0);
      c.rotation.y = ry;
      const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; c.add(m); return m; };
      part(new THREE.CylinderGeometry(0.21, 0.2, 0.035, 24), wood, 0, SEAT_Y - 0.018, 0);
      for (const [lx, lz] of [[0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14]]) part(new THREE.CylinderGeometry(0.012, 0.012, SEAT_Y - 0.03, 6), iron, lx, (SEAT_Y - 0.03) / 2, lz);
      for (const lx of [0.15, -0.15]) part(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6), iron, lx, SEAT_Y + 0.22, -0.19);
      part(new THREE.BoxGeometry(0.34, 0.12, 0.02), wood, 0, SEAT_Y + 0.38, -0.2);
      g.add(c);
    }
    // the candle in its glass, with a flame and a little light of its own
    const glass = M(0xffd9a0, { roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false });
    add(new THREE.CylinderGeometry(0.035, 0.032, 0.1, 18), glass, 0, 0.8, 0.0);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), M(0xf1e8d6, { roughness: 0.8 }), 0, 0.775, 0);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,170,80,0.45)'), color: 0xffc27a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    flame.position.set(0, 0.825, 0);
    flame.scale.set(0.03, 0.045, 1);
    g.add(flame);
    // the plates, the glasses, the bottle (laid when they're served)
    const served = new THREE.Group();
    const plate = M(0xe9e3d8, { roughness: 0.35 }), fish = M(0xc68a4c, { roughness: 0.7 }), lemon = M(0xf0cf45, { roughness: 0.6 }), greens = M(0x4f7c35, { roughness: 0.8 });
    const wine = M(0x4a0d18, { roughness: 0.2, transparent: true, opacity: 0.85 }), bottle = M(0x123018, { roughness: 0.25, metalness: 0.1 });
    const put = (geo, mat, x, y, z, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.castShadow = true; served.add(m); return m; };
    for (const sx of [-1, 1]) {
      const px = sx * 0.24;
      put(new THREE.CylinderGeometry(0.13, 0.1, 0.016, 28), plate, px, 0.754, 0.02);
      put(new THREE.CapsuleGeometry(0.026, 0.11, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.55, 1), fish, px - sx * 0.01, 0.775, 0.03, 0.3 * sx);
      put(new THREE.SphereGeometry(0.02, 10, 8, 0, Math.PI), lemon, px + sx * 0.06, 0.772, -0.04, 0.8);
      for (let k = 0; k < 4; k++) put(new THREE.SphereGeometry(0.017, 8, 6), greens, px - sx * 0.05 + k * 0.012, 0.77, -0.05 + (k % 2) * 0.02);
      // a wine glass, its foot, stem and bowl, a little wine in it
      const gx = px - sx * 0.02, gz = 0.2;
      put(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 16), glass, gx, 0.748, gz);
      put(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8), glass, gx, 0.79, gz);
      put(new THREE.LatheGeometry([V(0, 0, 0), V(0.024, 0.01, 0), V(0.036, 0.05, 0), V(0.033, 0.09, 0)].map((v) => new THREE.Vector2(v.x, v.y)), 18), glass, gx, 0.835, gz).material.side = THREE.DoubleSide;
      put(new THREE.CylinderGeometry(0.031, 0.024, 0.03, 16), wine, gx, 0.86, gz);
    }
    put(new THREE.CylinderGeometry(0.036, 0.037, 0.2, 16), bottle, 0.02, 0.85, -0.2);
    put(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 12), bottle, 0.02, 0.99, -0.2);
    served.visible = false;
    g.add(served);
    g.position.copy(TABLE);
    f.scene.add(g);
    const lit = (on) => {
      flame.material.opacity = on ? 0.7 : 0;
      if (on && !this.candleSrc) { const mark = new THREE.Object3D(); mark.position.set(0, 0.86, 0); g.add(mark); this.candleSrc = f.lamps.add(mark, { color: 0xffa860, power: 0.9, reach: 3 }); }
      if (this.candleSrc) this.candleSrc.power = on ? 0.9 : 0;
    };
    const flicker = onFrame((dt) => { if (flame.material.opacity > 0) { const t = performance.now() / 1000; flame.scale.set(0.03 + Math.sin(t * 13) * 0.003, 0.045 + Math.sin(t * 9.1) * 0.005, 1); if (this.candleSrc) this.candleSrc.power = 0.85 + Math.sin(t * 11) * 0.08; } });
    let solid = false;
    const set = (this.dinnerSet = {
      group: g, served, lit, flicker,
      solid: () => {
        if (solid) return;
        solid = true;
        f.physics.fixedBox(TABLE.clone().add(V(0, 0.38, 0)), V(0.44, 0.38, 0.44));
        for (const sx of [-1, 1]) f.physics.fixedBox(TABLE.clone().add(V(sx * 0.66, 0.4, 0)), V(0.2, 0.4, 0.2));
      },
    });
    return set;
  }

  // Sitting at the table: Hal on the west chair, Carol on the east (their hips on the seat, as Roam.sit's)
  seatHal() {
    const { player } = this;
    player.lookAt(null);
    player.autoAnim = false; // (or the player's own update plays the walk over the seat)
    player.place(SEAT_HAL.clone(), Math.PI / 2);
    player.animator.play(still(makePose({ ...DINING, hy: SEAT_Y + 0.06 - (player.rig?.hipsHeight ?? 0.98) })), 0);
  }
  seatCarol() {
    const carol = this.carol, ca = this.carolAnim, cb = this.cb;
    // her hands on the cloth, as a stance of hers (a gesture, a point at the bench, comes back to it): in her own
    // frame, the table's edge 0.33 m in front of her
    cb.stances.table ??= { L: [0.15, 0.775, 0.33], R: [-0.15, 0.775, 0.33], poleL: [0.6, -1, -0.4], poleR: [-0.6, -1, -0.4] };
    cb.stance('table');
    ca.arms.L.w = ca.arms.R.w = 1; // (there already, under the black)
    carol.root.position.copy(SEAT_CAROL);
    carol.root.rotation.y = -Math.PI / 2;
    ca.play(still(makePose({ ...DINING, hy: SEAT_Y + 0.06 - carol.hipsHeight })), 0);
  }

  // Dinner: the two of them at the table, the candle lit, the plates half eaten; her father and the wheel
  async dinner() {
    const { ui, director, player } = this, carol = this.carol, ca = this.carolAnim, cb = this.cb;
    const d = this.buildDinner(), f = this.ferrisScene;
    d.served.visible = true;
    d.lit(true);
    f.focus(TABLE);
    this.seatHal();
    if (carol) this.seatCarol();
    // their hands on the cloth either side of the plates (by IK: the seated pose's hover over the candle)
    const onTable = (dx, dz) => { const v = TABLE.clone().add(V(dx, 0.775, dz)); return () => v; };
    player.animator.reach('L', onTable(-0.31, -0.16), { rate: 30, pole: V(0.6, -1, -0.4) });
    player.animator.reach('R', onTable(-0.31, 0.16), { rate: 30, pole: V(-0.6, -1, -0.4) });
    const halHead = () => player.rig.bonePosition('head', _h), carolHead = () => carol.bonePosition('head', _r);
    player.lookAt(carolHead, 0.8);
    ca.lookAt(this.headOf(player.rig), 0.65);
    cb.lookHome = () => this.headOf(player.rig);
    // the table from the deck's south side, the Crab Shack's lit front behind it, then in closer
    director.cut(TABLE.clone().add(V(3.4, 1.55, -3.3)), TABLE.clone().add(V(0, 0.95, 0.2)), 44);
    await wait(0.3);
    ui.fade(0, 1.4);
    director.move(TABLE.clone().add(V(2.3, 1.4, -2.3)), TABLE.clone().add(V(0, 0.95, 0.15)), 4, ease.inOut, 40);
    await wait(2.6);
    await this.faceShot(carol, -Math.PI / 2, { dist: 1.75, side: 1, fov: 30, dur: 1.2 });
    await this.carolSay('carolPier4', [['bench', () => cb.pointAt(V(-1434, DECK + 0.6, LOT.z + 357), 1.4)], ['planes', () => ca.gesture('tilt', 1, 0.3)]]);
    await this.faceShot(player.rig, Math.PI / 2, { dist: 1.75, side: -1, fov: 31, dur: 1.0 });
    await this.say('halPier4');
    await this.faceShot(carol, -Math.PI / 2, { dist: 1.75, side: -1, fov: 29, dur: 1.0 });
    await this.carolSay('carolPier5', [['tourists', () => ca.gesture('shake', 1, 0.25)]]);
    // over her shoulder at him, the wheel turning behind
    director.move(carolHead().clone().add(V(0.5, 0.14, 0.34)), halHead().clone().add(V(0, -0.05, 0)), 1.1, ease.inOut, 34);
    await wait(0.9);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halPier5');
    // the table left, the candle burning on it
    await ui.fade(1, 0.8);
  }

  // After dinner, at the rail, side by side looking out to sea: what it's like up there, what each is afraid of.
  async railTalk() {
    const { ui, director, player, audio } = this, carol = this.carol, ca = this.carolAnim, cb = this.cb, f = this.ferrisScene;
    this.buildDinner().solid();
    f.focus(LEAN_HAL);
    // both of them leaning on the top rail (the hands on it by IK, the back bent over it; facing south, a
    // left hand is to the west)
    const railPt = (x, out) => out.set(x, RAIL_TOP + 0.05, RAIL_Z - 0.2);
    const hl = V(0, 0, 0), hr = V(0, 0, 0);
    player.autoAnim = false;
    player.place(LEAN_HAL.clone(), Math.PI);
    player.animator.play(still(LEANING, 0.6), 0);
    player.animator.reach('L', () => railPt(LEAN_HAL.x - 0.12, hl), { rate: 30, pole: V(0.3, -1, -0.2) });
    player.animator.reach('R', () => railPt(LEAN_HAL.x + 0.12, hr), { rate: 30, pole: V(-0.3, -1, -0.2) });
    if (carol) {
      carol.root.position.copy(LEAN_CAROL);
      carol.root.rotation.y = Math.PI;
      ca.play(still(CAROL_LEANING, 0.6), 0);
      // (her hands a stance, on the top rail, in her frame, within easy reach: at nearly an arm's length the
      // elbow had no settled place and the arm went out straight, sideways over the rail)
      const fwd = LEAN_CAROL.z - (RAIL_Z - 0.2), up = RAIL_TOP - DECK + 0.04;
      cb.stances.rail = { L: [0.08, up, fwd], R: [-0.08, up, fwd], poleL: [0.9, -0.5, 0.1], poleR: [-0.9, -0.5, 0.1] };
      cb.stance('rail');
      ca.arms.L.w = ca.arms.R.w = 1;
    }
    const sea = V(-1470.5, DECK + 2, RAIL_Z - 60);
    player.lookAt(() => sea, 0.5);
    ca.lookAt(() => sea, 0.5);
    cb.lookHome = () => () => sea;
    const halHead = () => player.rig.bonePosition('head', V(0, 0, 0)), carolHead = () => carol.bonePosition('head', V(0, 0, 0));
    const toHim = () => { ca.lookAt(this.headOf(player.rig), 0.75); cb.lookHome = () => this.headOf(player.rig); };
    const toHer = () => player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    // their backs to the camera, the moon on the water past them
    director.cut(V(-1470.55, DECK + 2.4, RAIL_Z + 6.8), V(-1470.55, DECK + 0.6, RAIL_Z - 12), 46);
    ui.fade(0, 1.6);
    director.move(V(-1470.55, DECK + 1.9, RAIL_Z + 3.8), V(-1470.55, DECK + 0.9, RAIL_Z - 12), 6, ease.inOut, 42);
    await wait(3.4);
    // in profile from along the rail: her nearer, him past her
    director.cut(V(-1467.6, DECK + 1.5, RAIL_Z - 1.6), V(-1470.55, DECK + 1.3, RAIL_Z + 0.35), 36);
    await wait(0.6);
    await this.carolSay('carolPier6', [['Hal', toHim]]);
    // him from over the water, the lit pier behind him
    toHer();
    const front = (head, dx) => director.move(V(head.x + dx * 2.2, head.y - 0.04, RAIL_Z - 1.0), head.clone().add(V(-dx * 0.2, -0.03, 0)), 1.1, ease.inOut, 31);
    await front(halHead(), -0.42);
    await this.say('halPier6');
    await front(carolHead(), 0.42);
    await this.carolSay('carolPier7', [['field', () => ca.gesture('chin', 1, 0.3)]]);
    player.lookAt(() => sea, 0.5);
    await front(halHead(), -0.36);
    await this.say('halPier7');
    // the two of them from along the rail again; she leans her head toward him
    director.move(V(-1467.9, DECK + 1.45, RAIL_Z - 1.4), V(-1470.55, DECK + 1.3, RAIL_Z + 0.35), 1.4, ease.inOut, 35);
    toHim();
    await wait(0.8);
    await this.carolSay('carolPier8', [['needed', () => ca.gesture('nod', 1, 0.3)]]);
    toHer();
    await front(halHead(), -0.42);
    await this.say('halPier8');
    await front(carolHead(), 0.4);
    await this.carolSay('carolPier9', [['this', () => ca.gesture('tilt', 1.2, 0.35)]]);
    await front(halHead(), -0.3);
    player.animator.gesture('nod', 1.0, 0.25);
    await this.say('halPier9');
    // a moment: the two of them at the rail, the wheel lit over the deck behind them
    director.move(V(-1474.8, DECK + 1.7, RAIL_Z - 2.6), V(-1470.4, DECK + 1.3, RAIL_Z + 0.6), 4.5, ease.inOut, 38);
    await wait(2.8);
    // the ring, which was meant to be quiet: he straightens up off the rail and looks at it
    const ringAt = () => this.ring.getWorldPosition(_r);
    player.animator.reach('L', null, { rate: 4 });
    player.animator.reach('R', null, { rate: 4 });
    player.animator.play(player.loco, 0.7);
    player.autoAnim = true;
    this.ringGlow = 3.2;
    audio.ringChime?.();
    this.faceShot(player.rig, player.yaw, { dist: 1.35, side: -1, up: -0.1, fov: 36, dur: 1.2 });
    player.lookAt(ringAt, 0.7);
    await this.say('ringPier1', { name: 'The ring' });
    this.ringGlow = 1.4;
    // and the two of them step back from the rail onto the deck, looking up at the sky out west
    const skyW = V(-1560, 40, LOT.z + 340);
    player.lookAt(() => skyW, 0.8);
    if (carol) {
      cb.stance(null);
      ca.play(this.carolLoco, 0.6);
      ca.lookAt(() => skyW, 0.7);
      cb.lookHome = () => () => skyW;
    }
    director.move(V(-1469.4, DECK + 1.55, LOT.z + 356.4), V(-1469.6, DECK + 1.45, LOT.z + 351.3), 1.4, ease.inOut, 40);
    const back = player.walkTo(PIER_HAL.clone(), player.walkSpeed);
    if (carol) {
      const from = LEAN_CAROL.clone(), loco = this.carolLoco, y0 = carol.root.rotation.y, y1 = yawTo(LEAN_CAROL, PIER_CAROL);
      await tween(0.5, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k)));
      const d0 = from.distanceTo(PIER_CAROL);
      await tween(d0 / 1.1, (k) => { carol.root.position.lerpVectors(from, PIER_CAROL, k); loco.speed = 1.1 * Math.min(1, k * 6, (1 - k) * 6); }, ease.linear);
      loco.speed = 0;
      const y2 = carol.root.rotation.y;
      tween(0.6, (k) => (carol.root.rotation.y = y2 + wrap(-Math.PI / 2 - y2) * ease.inOut(k)));
    }
    await back;
    player.turnTo(Math.PI / 2);
    await this.halClose(1.0);
    await this.say('halPier10');
    toHim();
    await this.carolClose(1.0, -1, 30);
    await this.carolSay('carolPier10', [['first', 'stop']]);
    await this.halClose(0.9);
    await this.say('halPier11');
  }

  // ---------------------------------------------------------------- 3. the violet light
  // A star over the sea that isn't one; it comes in low and fast across the water and into her. The gem
  // finds the one it's been looking for (Green Lantern #16, 1962: the Zamarons choose Carol Ferris; in #18
  // Johns has the gem go from woman to woman first). What she wears when it's done is the user's model.
  async strike() {
    const { ui, director, audio, player, engine } = this;
    const f = this.setupFerris();
    this.takeControl();
    if (!this.pierStaged) this.stagePier('night');
    const carol = this.carol, ca = this.carolAnim, cb = this.cb;
    if (!carol) return;
    const g = engine.gradeUniforms;
    const SKY = V(-1620, 150, LOT.z + 318), BREAST = PIER_CAROL.clone().add(V(0, 1.3, 0));
    ca.lookAt(() => SKY, 0.7);
    player.lookAt(() => SKY, 0.8);
    // the sky first, over their shoulders from behind them: a point of violet over the water, growing
    director.cut(PIER_CAROL.clone().add(V(4.6, 1.5, 1.9)), V(-1540, 34, LOT.z + 334), 56);
    await ui.fade(0, 0.8);
    const far = V(-1900, 260, LOT.z + 292), near = V(-1640, 110, LOT.z + 326);
    const gem = this.makeGem(far);
    audio.rumble?.(0.4);
    await tween(2.6, (k) => { gem.head.position.lerpVectors(far, near, k * k); gem.set(1); gem.scale(14 + 26 * k); }, ease.linear);
    // down!
    director.cut(PIER_HAL.clone().add(V(2.4, 1.6, -2.2)), PIER_HAL.clone().add(V(0, 1.55, 0)), 34);
    const sayDown = this.say('halStrike1', { skip: false });
    player.animator.gesture('beat', 0.6, 0.6);
    await wait(0.35);
    director.cut(PIER_HAL.clone().add(V(4.5, 1.2, -3.8)), PIER_CAROL.clone().add(V(-6, 4.5, 0)), 54);
    // in over the sea, into her
    await this.sendGem(gem, near, BREAST, 0.65);
    // the flash; he's thrown back; she isn't touched, she's lifted
    const sapLight = this.addSapphireLight();
    g.uFlashColor.value.setRGB(1.5, 0.55, 2.0);
    g.uFlash.value = 0.9;
    audio.sonicBoom?.(0.7);
    const hal0 = player.position.clone(), back = hal0.clone().add(V(-1.2, 0, 0));
    tween(0.4, (k) => player.place(hal0.clone().lerp(back, ease.out(k)).add(V(0, 0.05, 0)), Math.PI / 2), ease.linear);
    tween(0.7, (k) => (g.uFlash.value = 0.9 * (1 - k) ** 2), ease.linear).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    ca.lookAt(null);
    cb.stance(null);
    ca.play(still(RAPTURE), 0.9);
    // (a column of light, thin and dim enough to see her through: at full it whited the whole frame out)
    const shaft = createShaft({ from: PIER_CAROL.clone().add(V(0, 0.05, 0)), to: PIER_CAROL.clone().add(V(0, 70, 0)), radiusFrom: 0.8, radiusTo: 1.2, color: new THREE.Color(0.45, 0.16, 0.85) });
    f.scene.add(shaft);
    tween(1.2, (k) => (shaft.userData.uniforms.uOpacity.value = 0.4 * k), ease.out);
    tween(2.2, (k) => (carol.root.position.y = DECK + 1.5 * ease.out(k)), ease.linear);
    // her, from the sea side, the lights of the city behind her and the sky; the light going over her
    director.cut(PIER_CAROL.clone().add(V(6.2, 0.35, 1.8)), PIER_CAROL.clone().add(V(0, 2.5, 0)), 42);
    director.move(PIER_CAROL.clone().add(V(5.0, 0.6, 1.4)), PIER_CAROL.clone().add(V(0, 2.8, 0)), 3.4, ease.inOut, 40);
    await wait(0.5);
    await this.sapphireUp(2.6);
    this.sap.eyeGlow(1);
    sapLight.power = 22;
    sayDown.catch?.(() => {});
    await this.sapphireLines(shaft, sapLight);
  }

  // The comet's flight, and the light it throws on the pier as it comes.
  makeGem(at, scene = this.ferrisScene.scene) {
    const tex = (this.gemTex ??= glowTexture('rgba(255,255,255,1)', 'rgba(170,80,255,0.4)'));
    const mk = () => { const m = new THREE.SpriteMaterial({ map: tex, color: 0xb36bff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); const sp = new THREE.Sprite(m); scene.add(sp); return sp; };
    const head = mk(), trail = Array.from({ length: 16 }, mk), hist = [];
    head.position.copy(at);
    const tick = onFrame(() => {
      hist.unshift(head.position.clone());
      hist.length = Math.min(hist.length, 80);
      trail.forEach((sp, i) => { const p = hist[Math.min(hist.length - 1, 2 + i * 3)]; if (p) sp.position.copy(p); sp.scale.setScalar(head.scale.x * (1 - i / 22)); sp.material.opacity = head.material.opacity * (1 - i / 17) * 0.8; });
    });
    return {
      head,
      set: (op) => (head.material.opacity = op),
      scale: (v) => head.scale.setScalar(v),
      dispose: () => { tick(); for (const sp of [head, ...trail]) { sp.removeFromParent(); sp.material.dispose(); } },
    };
  }

  async sendGem(gem, from, to, dur) {
    const f = this.ferrisScene, { audio } = this;
    const mark = new THREE.Object3D();
    f.scene.add(mark);
    const src = f.lamps.add(mark, { color: 0xb36bff, power: 90, reach: 70 });
    audio.whoosh?.(dur, 0.5);
    await tween(dur, (k) => { gem.head.position.lerpVectors(from, to, k ** 1.6); mark.position.copy(gem.head.position); gem.scale(8 - 3 * k); gem.set(1); }, ease.linear);
    gem.dispose();
    f.scene.remove(mark);
    f.lamps.sources.splice(f.lamps.sources.indexOf(src), 1);
  }

  // The violet light that stays on her afterwards: a source in the lamp pool, over her head.
  addSapphireLight() {
    const f = this.ferrisScene, mark = new THREE.Object3D();
    mark.position.copy(PIER_CAROL).add(V(0, 2.4, 0));
    f.scene.add(mark);
    const src = f.lamps.add(mark, { color: 0xb36bff, power: 36, reach: 26 });
    src.mark = mark;
    return src;
  }

  // The clothes she came in, swept off her from the feet up in violet light as the suit forms (the way
  // the ring's suit forms on Hal: Coast.suitUp), the hair and the face hers all the same.
  async sapphireUp(dur = 2.4) {
    const { audio } = this, carol = this.carol, ca = this.carolAnim;
    const sap = (this.sap ??= createSapphire(this.assets.characters.sapphire));
    carol.root.add(sap.root);
    ca.addRig(sap);
    const u = carol.u, su = sap.u;
    for (const x of [u, su]) x.uEdgeColor.value.setRGB(2.6, 0.7, 3.4);
    u.uDissolveOn.value = 1; u.uDissolveSign.value = 1;
    su.uDissolveOn.value = 1; su.uDissolveSign.value = -1;
    sap.glowUp(2.6);
    audio.dissolve?.();
    audio.whoosh?.(dur, 0.35);
    await tween(dur, (k) => { u.uDissolve.value = -0.1 + k * 1.25; su.uDissolve.value = -0.1 + k * 1.25; }, ease.inOut);
    u.uDissolveOn.value = 0; su.uDissolveOn.value = 0;
    for (const m of carol.meshes) m.visible = false; // (she's in her own now)
    this.cb.rig = sap; // (the mouth that speaks)
    tween(2.5, (k) => sap.glowUp(2.6 - 1.6 * k), ease.out);
  }

  // What she says and what the light says, and Hal; and she goes.
  async sapphireLines(shaft, light) {
    const { ui, director, audio, player } = this, carol = this.carol, g = this.engine.gradeUniforms;
    const sap = this.sap;
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    // the gem speaks first, she's low in the frame over the planks, the sea and the city behind
    director.move(PIER_CAROL.clone().add(V(4.4, 0.5, 1.1)), PIER_CAROL.clone().add(V(0, 2.9, 0)), 2.6, ease.inOut, 38);
    await wait(0.5);
    await this.carolSay('sapStrike1');
    await this.halClose(1.0);
    await this.say('halStrike2');
    await this.carolClose(1.4, 1, 30);
    await this.carolSay('carolStrike1');
    await this.carolClose(1.2, -1, 28);
    await this.carolSay('sapStrike2');
    await this.carolClose(1.2, 1, 26);
    await this.carolSay('carolStrike2');
    // she goes: up the column of light and out over the sea, the camera on Hal's shoulder following her
    const from = carol.root.position.clone(), to = V(-1700, 135, LOT.z + 322);
    audio.whoosh?.(3, 0.6);
    g.uFlashColor.value.setRGB(1.5, 0.55, 2.0);
    g.uFlash.value = 0.3;
    tween(0.9, (k) => (g.uFlash.value = 0.3 * (1 - k)), ease.out).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    director.cut(player.position.clone().add(V(-1.4, 1.2, 2.2)), from.clone().add(V(0, 1.4, 0)), 46);
    const dir = to.clone().sub(from).normalize();
    carol.root.rotation.y = Math.atan2(dir.x, dir.z);
    const follow = onFrame(() => director.look.copy(carol.root.position));
    await tween(3.4, (k) => { const e = k * k; carol.root.position.lerpVectors(from, to, e); sap.glowUp(1 + 1.2 * k); shaft.userData.uniforms.uOpacity.value = 0.4 * (1 - k); }, ease.linear);
    follow();
    sap.eyeGlow(0);
    carol.root.visible = false;
    shaft.removeFromParent();
    light.power = 0;
    light.mark.removeFromParent();
    this.ferrisScene.lamps.sources.splice(this.ferrisScene.lamps.sources.indexOf(light), 1);
    // and the pier, with one man on it
    player.lookAt(null);
    director.cut(PIER_HAL.clone().add(V(-3.2, 1.3, 1.8)), PIER_HAL.clone().add(V(0, 1.4, 0)), 38);
    await wait(1.4);
    await this.say('ringStrike1', { name: 'The ring' });
    await this.say('halStrike3');
    await wait(0.6); // (and on into `hold`: the ring finds her again)
  }

  // Carol in the Sapphire's suit at once (a chapter that starts with her already changed: `hold` from its own
  // checkpoint), as `sapphireUp` leaves her
  sapphireOn() {
    const carol = this.carol, ca = this.carolAnim;
    if (!this.sap) this.sap = createSapphire(this.assets.characters.sapphire);
    const sap = this.sap;
    if (sap.root.parent !== carol.root) { carol.root.add(sap.root); ca.addRig(sap); }
    for (const m of carol.meshes) m.visible = false;
    sap.u.uDissolveOn.value = 0;
    this.cb.rig = sap;
    return sap;
  }

  // ---------------------------------------------------------------- 4. the gem's hold
  // The ring finds her again, holding over the water west of the pier; he suits up and goes after her. The
  // fight is with the gem, not with Carol (ours): her light guards her body, and blows that land on it hurt
  // her. What there is to hit is the gem: her shards parried back into it, her dive parried, or the bubble
  // round her (the gem open while it holds). At a quarter of its hold she comes down on the pier, herself for
  // a moment; then the Zamarons' light from above takes her up through a breach (the Zamarons choosing Carol
  // for their queen: Green Lantern #16, 1962). The ring names the world it comes from: Zamaron.
  async hold() {
    const { ui, director, audio, player, powers, hud } = this;
    const f = this.setupFerris();
    this.takeControl();
    ui.objective(null);
    if (!this.pierStaged) {
      if (!this.pierReady) { ui.loadStart('Part Seven · The gem’s hold', [['city', 'Building the waterfront', 3], ['shaders', 'Getting the light right', 3]]); await this.prepPier(); }
      this.stagePier('night');
    }
    ui.clock(this.save.info('hold').clock);
    const carol = this.carol, ca = this.carolAnim;
    if (!carol) return;
    const sap = this.sapphireOn();
    // she's out over the water, waiting, lit; turned to the pier
    carol.root.visible = true;
    carol.root.position.copy(SAP_WAIT);
    carol.root.rotation.set(0, yawTo(SAP_WAIT, PIER_HAL), 0);
    this.cb.stance(null);
    ca.lookAt(this.headOf(player.rig), 0.5);
    sap.glowUp(1);
    sap.eyeGlow(1);
    const foe = (this.sapFoe = new StarSapphire({ scene: f.scene, physics: f.physics, powers, player, audio, director, root: carol.root, anim: ca, rig: sap, centre: ARENA, radius: 62 }));
    foe.yaw = carol.root.rotation.y;
    const tick = (this.sapTick = (dt, t) => foe.update(dt, t));
    f.updaters.push(tick);
    const glow = new THREE.Object3D();
    glow.position.set(0, 2.2, 0);
    foe.object.add(glow);
    const light = f.lamps.add(glow, { color: 0xb36bff, power: 30, reach: 24 });
    // Hal on the pier, where she left him
    if (player.position.distanceTo(PIER_HAL) > 3) player.place(PIER_HAL.clone().add(V(0, 0.05, 0)), -Math.PI / 2);
    player.turnTo(-Math.PI / 2);
    player.lookAt(() => foe.tg.position, 0.6);
    director.cut(PIER_HAL.clone().add(V(2.6, 1.55, 1.6)), PIER_HAL.clone().add(V(-8, 1.8, -1)), 40);
    await ui.fade(0, 0.8);
    this.ringGlow = 2.4;
    audio.ringChime?.();
    await this.say('ringHold1', { name: 'The ring' });
    this.ringGlow = 1.2;
    await this.halClose(1.0);
    await this.say('halHold1');
    // the suit, there on the pier (nobody left on it to see)
    director.move(PIER_HAL.clone().add(V(-3.2, 1.4, 2.4)), PIER_HAL.clone().add(V(0, 1.1, 0)), 2.2, ease.inOut, 40);
    await this.suitUp(1.6);
    this.empower(true);
    for (const id of ['gatling', 'sword', 'hammer', 'staff', 'bubble']) this.learn(id, false);
    this.pocketLantern();
    const f0 = f;
    powers.attach({ scene: f.scene, physics: f.physics, ground: (x, z) => (f0.city?.onPier(x, z) ? DECK : 0), floor: (x, z) => (f0.city?.onPier(x, z) ? DECK : 0.6),
      canLand: (x, z) => !!f0.city?.onPier(x, z) || x > coastX(z) + 1, solid: f.city ? (x, y, z) => f0.city.solidAt(x, y, z) : undefined, center: ARENA.clone(), radius: 230, ceiling: 140 });
    powers.regen = 1.1; // (no battery out here, only his will: a ring run dry in the middle of this fight would leave nothing to do)
    powers.trappable = (body, point, origin, dir) => this.sapTrap(origin, dir);
    player.boostScale = 1.6;
    player.lookAt(null);
    // out to her
    powers.markerTarget = { pos: foe.tg.position, label: 'Carol' };
    this.giveControl('Go after Carol');
    wait(1.2).then(() => this.bark('halHold2'));
    await waitFor(() => player.position.distanceTo(foe.tg.position) < 30);
    powers.markerTarget = null;
    // she turns to him and talks (the camera on her, from beside him)
    this.takeControl();
    powers.holster();
    const toHer = foe.tg.position.clone().sub(player.position).setY(0).normalize();
    if (!player.flying) player.takeOff();
    const hover = player.position.clone();
    const holdHal = onFrame(() => { if (player.flying && player.vel) player.vel.multiplyScalar(0.85); });
    player.turnTo(Math.atan2(toHer.x, toHer.z));
    await this.sapClose(1.4);
    await this.carolSay('sapHold1', [['love', 'open']]);
    await this.halOver(1.0, hover);
    await this.say('halHold3');
    await this.sapClose(1.1, -1);
    await this.carolSay('sapHold2', [['sky', () => ca.gesture('chin', 1, 0.35)]]);
    await this.halOver(1.0, hover, -1);
    await this.say('halHold4');
    await this.sapClose(0.9);
    await this.carolSay('sapHold3');
    holdHal();
    // the fight
    hud.tutorial({ kicker: 'Star Sapphire', n: 1, of: 1, title: 'The gem’s hold', html: 'Her light guards her body: <b>blows that land on her hurt Carol</b>. What you can break is the <b>gem</b>.<br>Raise the shield (<kbd>Right-click</kbd> or <kbd>F</kbd>) <b>just as her shards arrive</b> to send them back into it, or just as she dives at you: she is thrown open. Or hold her in the <b>bubble</b> (<kbd>4</kbd>): while it holds, the gem is open.<br><span class="dim">A <b>ring of light</b> under you: a cage. Move out of it, or break its bars with two hooks.</span>' });
    hud.boss('Star Sapphire', 1, YIELD_AT);
    const bar = onFrame(() => hud.boss('Star Sapphire', foe.health, YIELD_AT));
    Object.assign(powers, { healDelay: 7, healRate: 3 });
    this.sapBarks(foe);
    powers.choose(0); // (the fist in his hand: a click is a hook, the shield on the guard key whatever he's holding)
    player.shoulder = 0.85; // (the camera over his shoulder: square behind him, he hid her in the middle of the screen)
    foe.engage();
    this.giveControl('Break the gem’s hold on Carol');
    wait(2.5).then(() => this.ringSay('ringHoldTip1'));
    const lost = new Promise((resolve) => (foe.onHurtCarol = () => resolve('lost')));
    const yielded = new Promise((resolve) => (foe.onYield = () => resolve('yield')));
    // the one time Carol's own voice gets through, at half
    foe.onMoment = async () => {
      this.takeControl();
      powers.holster();
      const at = player.position.clone();
      // she drifts in to him first (the shots are close; a camera cut in on her old place would lose her)
      await Promise.race([waitFor(() => foe.object.position.distanceTo(player.position) < 4.2), wait(3.5)]);
      await Promise.race([waitFor(() => foe.vel.length() < 0.7), wait(2.5)]); // (and still)
      // her own light low while it's Carol who speaks, up again when the gem answers
      const sap = this.sap, glow = (from, to, d) => tween(d, (k) => sap.glowUp(from + (to - from) * k), ease.inOut);
      glow(1, 0.3, 0.8);
      sap.eyeGlow(0.25);
      await this.sapClose(1.0);
      ca.reach('R', null);
      await this.carolSay('carolHold1');
      await this.halOver(0.9, at);
      await this.say('halHold5');
      await this.sapClose(0.9, -1);
      glow(0.3, 2.0, 0.5);
      sap.eyeGlow(1);
      await this.carolSay('sapHold4');
      glow(2.0, 1, 0.6);
      this.giveControl('Break the gem’s hold on Carol');
      this.ringSay('ringHoldTip2');
      foe.resume();
    };
    const end = await Promise.race([lost, yielded]);
    bar();
    hud.boss(null);
    hud.tutorialDone?.();
    hud.tutorial(null);
    Object.assign(powers, { healDelay: 4, healRate: 8, regen: 0 });
    player.shoulder = 0.34;
    if (end === 'lost') { foe.disengage(); await this.carolHurt(); return; }
    await this.sapDown(foe, light);
    await this.zamarons(foe, light);
  }

  // what the bubble finds: her, when she's near the aim's line
  sapTrap(origin, dir) {
    const foe = this.sapFoe;
    if (!foe || foe.state !== 'duel' || !origin || !dir) return null;
    const c = _r.subVectors(foe.tg.position, origin), t = c.dot(dir);
    if (t < 0.5 || t > 60) return null;
    return c.addScaledVector(dir, -t).length() < 2.2 + t * 0.03 ? foe.trap() : null;
  }

  // her lines in the fight, and Carol's when he hurts her; the ring's warnings as she's hurt
  sapBarks(foe) {
    let warned = 0, lastHit = 0;
    const one = (key, gap = 5) => {
      const now = performance.now();
      if (this.sapBarking || now - (this.lastSapBark ?? 0) < gap * 1000) return;
      this.sapBarking = true;
      this.lastSapBark = now;
      this.perform(this.cb, key, [], { skip: false }).finally(() => (this.sapBarking = false));
    };
    foe.onQuip = (what) => {
      if (what === 'hurt') {
        one('carolQHurt', 3);
        if (foe.hurt > 40 && warned < 1) { warned = 1; this.ringSay('ringHoldHurt1'); }
        if (foe.hurt > 70 && warned < 2) { warned = 2; this.ringSay('ringHoldHurt2'); }
      } else if (what === 'held') one('carolQHeld', 2);
      else if (what === 'cage') one('sapQCage');
      else if (what === 'broke') one('sapQBroke');
      else if (what === 'parried') one('sapQParried', 7);
    };
    foe.onHurtHal = () => { if (performance.now() - lastHit > 9000 && Math.random() < 0.5) { lastHit = performance.now(); one(Math.random() < 0.5 ? 'sapQHit1' : 'sapQHit2'); } };
  }

  // Close on her in the air, from beside Hal; and back over his shoulder at her
  sapClose(duration = 1.2, side = 1) {
    const foe = this.sapFoe, h = this.sap.bonePosition('head', V(0, 0, 0)), yaw = foe.yaw;
    const fw = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(fw.z, 0, -fw.x);
    return this.director.move(h.clone().addScaledVector(fw, 2.4).addScaledVector(r, 0.9 * side).add(V(0, -0.1, 0)), h.clone().add(V(0, -0.08, 0)), duration, ease.inOut, 34);
  }
  halOver(duration = 1.0, at = this.player.position, side = 1) {
    const h = this.sap.bonePosition('head', V(0, 0, 0)), c = at.clone().add(V(0, 1.55, 0));
    const back = c.clone().sub(h).setY(0).normalize(), right = V(back.z, 0, -back.x);
    return this.director.move(c.clone().addScaledVector(back, 2.2).addScaledVector(right, 0.8 * side).add(V(0, 0.25, 0)), c.clone().lerp(h, 0.55), duration, ease.inOut, 40);
  }

  // He hurt her: try again.
  async carolHurt() {
    const { ui } = this;
    this.takeControl();
    await wait(0.6);
    await ui.fade(1, 1.2);
    await ui.screen({ kicker: 'Carol Ferris', title: 'CAROL!', body: 'Every blow that lands on her body lands on her. Send her shards back into the gem, parry her dive, or hold her in the bubble and strike the gem while it holds.', buttons: ['Try again'] });
    this.save.resumeAfterReload(this.checkpointId);
    await new Promise(() => {});
  }

  // At a quarter of its hold she comes down on the end of the pier, the light in her low; Hal lands in front
  // of her, and for a moment it's her.
  async sapDown(foe, light) {
    const { ui, director, player, audio } = this, carol = this.carol, ca = this.carolAnim, sap = this.sap;
    this.takeControl();
    this.powers.holster();
    foe.disengage();
    foe.state = 'yield';
    const from = foe.object.position.clone();
    // Hal's on the pier already, where she'll land (he'd have fallen into the sea off its end, landing from out there)
    player.lookAt(null);
    player.place(LAND_HAL.clone().add(V(0, 0.05, 0)), yawTo(LAND_HAL, LAND));
    player.lookAt(() => foe.tg.position, 0.7);
    director.cut(LAND_HAL.clone().add(V(4.2, 1.5, 2.4)), from.clone().add(V(0, 1, 0)), 40);
    const follow = onFrame(() => director.look.copy(foe.object.position).add(V(0, 1.1, 0)));
    audio.whoosh?.(3.6, 0.4);
    sap.glowUp(0.6);
    // (steered down by hand, the body's spring off)
    foe.rb.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    await tween(3.8, (k) => { const e = ease.inOut(k); _h.lerpVectors(from, LAND, e); _h.y += Math.sin(Math.PI * e) * 2; foe.rb.setNextKinematicTranslation({ x: _h.x, y: _h.y + 1, z: _h.z }); }, ease.linear);
    follow();
    // her body back out of the fight's pivot, standing on the planks, sagging
    foe.release(this.ferrisScene.scene);
    carol.root.position.copy(LAND);
    carol.root.rotation.set(0, yawTo(LAND, LAND_HAL), 0);
    ca.play(this.carolLoco, 0.8);
    this.carolLoco.speed = 0;
    ca.gesture('nod', 1.4, 0.5);
    this.cb.stance(null);
    ca.lookAt(this.headOf(player.rig), 0.6);
    this.cb.lookHome = () => this.headOf(player.rig);
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    await this.overHal(0.1);
    await wait(0.6);
    await this.carolClose(1.2, 1, 30);
    await this.carolSay('carolHold2', [['part', 'chest']]);
    await this.halClose(1.0);
    await this.say('halHold6');
  }

  // The Zamarons' light: a column from far above, their voice, and she's drawn up it into a breach. The ring
  // reads where it came from.
  async zamarons(foe, light) {
    const { ui, director, audio, player, engine } = this, carol = this.carol, ca = this.carolAnim, sap = this.sap;
    const f = this.ferrisScene, g = engine.gradeUniforms;
    const top = LAND.clone().add(V(0, 76, 0)), mouth = LAND.clone().add(V(0, 54, 0));
    audio.rumble?.(0.5);
    // the warning, and the sky opening over the pier: a breach high above and a column coming down out of it
    player.lookAt(() => top, 0.8);
    ca.lookAt(() => top, 0.7);
    director.cut(LAND_HAL.clone().add(V(3.4, 0.7, 2.4)), LAND.clone().add(V(0, 24, 0)), 62);
    director.move(LAND_HAL.clone().add(V(3.4, 0.7, 2.4)), LAND.clone().add(V(0, 46, 0)), 5, ease.inOut, 62);
    const rift = this.openRift(f, mouth, 10, 1, { palette: 'love' });
    tween(2.6, (k) => (rift.open = k), ease.out);
    const shaft = createShaft({ from: LAND.clone().add(V(0, 0.05, 0)), to: mouth, radiusFrom: 1.0, radiusTo: 1.8, color: new THREE.Color(0.6, 0.14, 0.7) });
    f.scene.add(shaft);
    tween(2.2, (k) => (shaft.userData.uniforms.uOpacity.value = 0.45 * k), ease.out);
    light.power = 40;
    g.uFlashColor.value.setRGB(1.6, 0.5, 1.6);
    g.uFlash.value = 0.35;
    tween(1.0, (k) => (g.uFlash.value = 0.35 * (1 - k)), ease.out).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    await this.say('ringHold2', { name: 'The ring' });
    await wait(0.6);
    // the two of them, the light over them
    director.cut(LAND_HAL.clone().add(V(4.4, 0.8, 3.0)), LAND.clone().add(V(0, 6, 0)), 54);
    await this.say('zamHold1');
    await this.say('zamHold2');
    // she's lifted; he reaches
    ca.play(still(RAPTURE), 1.2);
    sap.glowUp(2.2);
    const from = carol.root.position.clone();
    player.animator.reach('R', () => carol.bonePosition('hand_R', _r), { rate: 6, pole: V(-0.4, -0.85, -0.3) });
    const rise = tween(4.6, (k) => { carol.root.position.lerpVectors(from, mouth, k * k); }, ease.linear);
    await wait(0.9);
    this.say('carolHold3', { skip: false });
    // the camera on the planks, tipped back to follow her up the light into the breach
    director.cut(LAND_HAL.clone().add(V(2.4, 0.5, 1.6)), carol.root.position.clone().add(V(0, 1, 0)), 56);
    const track = onFrame(() => director.look.copy(carol.root.position).add(V(0, 1, 0)));
    await rise;
    track();
    player.animator.reach('R', null, { rate: 3 });
    carol.root.visible = false;
    sap.eyeGlow(0);
    g.uFlashColor.value.setRGB(1.6, 0.5, 1.6);
    g.uFlash.value = 0.6;
    audio.sonicBoom?.(0.5);
    tween(0.9, (k) => (g.uFlash.value = 0.6 * (1 - k) ** 2), ease.linear).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    tween(1.2, (k) => { shaft.userData.uniforms.uOpacity.value = 0.45 * (1 - k); }, ease.out).then(() => shaft.removeFromParent());
    rift.close();
    light.power = 0;
    f.lamps.sources.splice(f.lamps.sources.indexOf(light), 1);
    this.sapFoe = null;
    f.updaters.splice(f.updaters.indexOf(this.sapTick), 1);
    foe.dispose();
    // and the pier, with one man on it, again
    player.lookAt(null);
    await wait(1.2);
    director.cut(LAND_HAL.clone().add(V(-3, 1.3, 2.2)), LAND_HAL.clone().add(V(0, 1.4, 0)), 38);
    this.ringGlow = 2.2;
    await this.say('ringHold3', { name: 'The ring' });
    this.ringGlow = 1.2;
    await this.halClose(1.1);
    await this.say('halHold7');
    await wait(0.6);
    // (on into the wake: `followWake`, from the pier)
  }
  // ---------------------------------------------------------------- 5. the wake
  // Out after her (ours). From the pier: up out of the night and into orbit, the ring finding the
  // breach's wake; then the wake itself, flown: a stream of violet light out past the charted stars that
  // the ring can hold only while he stays on it (off it, it fades; too far, and the ring takes him back
  // to where it last held it). Its stretches: open space; the shards (the breach's light gone solid);
  // the veil, a nebula where the ring marks the way. On the way the ring finds the one record of the
  // world it leads to (the comics': the Zamarons are the women of Oa, who left the Guardians). At its
  // end, Zamaron from orbit, and the dive.
  async followWake() {
    const { ui, player, powers, engine } = this;
    const g = engine.gradeUniforms;
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('trail').clock);
    this.lanternUp();
    for (const id of ['hammer', 'staff', 'bubble']) this.learn(id, false);
    if (this.current && this.current === this.ferrisScene) await this.offWorld();
    else g.uFlash.value = 1;
    await loadProps(WAKE_PROPS, (k) => ui.loadStage('props', k));
    const w = (this.wakeScene ??= new Wake({ engine }).build());
    w.progress = 0;
    w.near = 0;
    this.show(w);
    this.world = 'space';
    this.ambience(this.audio.wind(0.03), this.audio.pad([46.2, 55, 69.3], 0.03, { cutoff: 420 }));
    const start = w.at(0.004), dir = w.tangent(0.004).clone(), yaw = Math.atan2(dir.x, dir.z);
    player.spawn(w.physics, w.scene, start, yaw);
    powers.attach({ scene: w.scene, physics: w.physics, ...w.airBounds() });
    powers.regen = 1.2;
    player.boostScale = 2.6;
    player.topScale = 1.7;
    await this.warmUp(w.scene, null, [w.scene], (k) => ui.loadStage('shaders', k));
    this.playerActive = true;
    await this.arriveFlying(start, yaw, dir.clone().multiplyScalar(16));
    ui.fade(0, 0.5);
    wait(1.0).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75)); // (the breach's violet, put back once the flash is out)
    const hud = this.travelHud;
    hud.set({ mode: 'TRACKING THE WAKE', speed: 0.3, rows: [['Wake', 'Held'], ['Source', 'Uncharted'], ['Distance', '—']] });
    hud.panel.classList.add('high');
    hud.show(true);
    this.giveControl('Follow the violet wake');
    await this.wakeRun(w);
    hud.show(false);
    hud.panel.classList.remove('high');
    player.boostScale = 1;
    player.topScale = 1;
    await this.zamApproach();
  }

  // Up from the pier into orbit over the night side, the ring plotting where the light went, then away
  // (Voyage.js's departure, cut short: the course is the wake's, not a charted one)
  async offWorld() {
    const { player, director, audio, engine, powers } = this, g = engine.gradeUniforms;
    this.playerActive = false;
    if (!player.flying && player.rb) player.place(player.position.clone(), player.yaw);
    player.flying = false;
    player.autoAnim = false;
    player.lookAt(null);
    player.animator.reach('R', null);
    player.animator.reach('L', null);
    player.animator.lean.pitch = player.animator.lean.roll = player.animator.twist = 0;
    player.animator.feet.ground = null;
    player.pivot.quaternion.identity();
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object;
    try {
      await launchOut(this);
      powers.detach();
      player.removeFromPhysics();
      const space = (this.space ??= new Space());
      space.show('earth');
      for (const p of [space.earth, space.oa, space.ysmault, space.korugar, space.zamaron]) p.position.set(0, 0, 0);
      this.show(space);
      space.scene.add(o);
      o.position.set(0, 0, 0);
      o.rotation.set(0, Math.PI, 0, 'YXZ');
      space.anchor = o.position;
      player.animator.play(still(POSES.hover, 0.5), 0.6);
      space.drift.set(0, 0, 0);
      director.cut(V(1.5, 1.7, 2.9), V(-1.4, -3.6, -9), 54);
      director.move(V(1.15, 1.5, 2.3), V(-1.4, -4.0, -9), 5, ease.inOut, 52);
      player.lookAt(V(-2, -6, -8), 0.7);
      audio.whoosh(2.2, 0.35);
      await tween(0.9, (k) => (g.uFlash.value = 1 - k), ease.out);
      await wait(0.6);
      // his ring hand out, the light gathering on it, a violet thread found in the dark ahead
      director.cut(V(-1.7, 1.75, -2.4), V(0, 1.5, -0.2), 40);
      director.move(V(-1.45, 1.7, -2.1), V(0, 1.55, -0.3), 4.2, ease.inOut, 38);
      player.lookAt(null);
      const sh = V(0, 0, 0), aim = V(0, 1.7, -4);
      player.animator.reach('R', () => { player.rig.bonePosition('upperArm_R', sh); return sh.add(aim.clone().sub(sh).normalize().multiplyScalar(0.62)); }, { pole: V(-0.4, -0.85, -0.3), rate: 4 });
      this.ringGlow = 6;
      audio.riser(3, 0.3);
      await this.say('ringTrail0', { name: 'The ring' });
      await this.say('halTrail0');
      // and away
      director.cut(V(0.35, 1.9, 3.3), V(0, 1.2, -12), 56);
      player.animator.reach('R', null, { rate: 4 });
      player.flightState.k = 1;
      player.animator.play(player.flightGen, 0.5);
      audio.whoosh(1.8, 0.8);
      const away = V(0, 0.35, -1).normalize();
      await tween(1.6, (k) => {
        o.rotation.set(1.45 * ease.inOut(Math.min(1, k * 1.6)), Math.PI, 0, 'YXZ');
        space.earth.position.addScaledVector(away, -k * k * 6);
        space.drift.copy(away).multiplyScalar(k * k * 60);
        director.fov = 56 + 16 * k * k;
      }, ease.linear);
      audio.whoosh(1.2, 0.9);
      g.uFlashColor.value.setRGB(1.3, 0.6, 1.7);
      await tween(0.35, (k) => (g.uFlash.value = k * k), ease.linear);
      this.ringGlow = 0.6;
      o.removeFromParent(); // (Hal out of the orbit scene before the next takes him)
    } finally {
      animStop();
      director.fov = 55;
      player.animator.reach('R', null);
    }
  }

  // The wake, flown, until he reaches its end. Locked on, it shines and the readout counts down; drifting
  // off it fades, and the ring says so; lost (off it for a few seconds, or far off it at once) the ring
  // brings him back to it. The ring's pings mark the way through the veil.
  async wakeRun(w) {
    const { player, powers } = this, hud = this.travelHud;
    let lostT = 0, warnT = 4, pingT = 0, ping = -1, losing = false, shown = '';
    const LY = 61.4;
    const chat = this.wakeChat(w);
    const tick = onFrame((dt) => {
      if (losing || !player.control) return;
      if (!player.flying) player.airborne(V(0, 0, 0)); // (nowhere to land out here: he never stops flying)
      w.track(player.position);
      const off = w.off;
      const lock = off < LOCK ? 1 : off < WEAK ? 1 - ((off - LOCK) / (WEAK - LOCK)) * 0.75 : 0.12;
      const u = w.wakeU.uLock;
      u.value += (lock - u.value) * Math.min(1, dt * 4);
      warnT -= dt;
      if (off > WEAK) lostT += dt; else lostT = Math.max(0, lostT - dt * 2);
      if (off > LOCK + 8 && warnT <= 0) { this.ringSay('ringTrailWeak'); warnT = 9; }
      if (lostT > 3.2 || off > 170) { losing = true; this.loseWake(w).finally(() => { losing = false; lostT = 0; warnT = 5; }); return; }
      // the ring's pings through the veil: a pulse running on ahead along it
      if (w.veil > 0.3) {
        pingT -= dt;
        if (pingT <= 0) { pingT = 2.8; ping = w.progress * w.length; this.audio.ringChime?.(); }
        if (ping >= 0) { ping += dt * 190; if (ping > w.progress * w.length + 300) ping = -1; }
      } else ping = -1;
      w.wakeU.uPing.value = ping;
      // the readout
      const state = off < LOCK ? 'Held' : off < WEAK ? 'Fading' : 'Losing it';
      const left = (LY * (1 - w.progress)).toFixed(1);
      const rows = `${state}|${left}`;
      if (rows !== shown) {
        shown = rows;
        hud.set({ rows: [['Wake', state], ['Source', 'Uncharted'], ['Distance', `${left} LY`]], speed: 0.25 + 0.5 * Math.min(1, player.vel.length() / 70) });
      }
    });
    try {
      await waitFor(() => w.progress > 0.975);
    } finally {
      tick();
      chat.stop();
    }
    this.takeControl();
    powers.holster?.();
    this.ringSay('ringTrailEnd');
  }

  // what's said on the way, as he reaches each part of it (stopped when the wake ends)
  wakeChat(w) {
    let stopped = false;
    const at = (k) => waitFor(() => stopped || w.progress > k);
    (async () => {
      await at(0.03);
      await wait(1.5);
      if (stopped) return;
      this.hud.tutorial?.({ kicker: 'The wake', n: 1, of: 1, title: 'Stay on it', html: 'Fly <b>inside the violet light</b>: off it, it fades; too far off, the ring loses it and takes you back.<br><kbd>Shift</kbd> boosts. <kbd>Space</kbd> and <kbd>C</kbd> climb and dive.' });
      await at(0.12);
      if (stopped) return;
      this.hud.tutorial?.(null);
      await this.ringSay('ringTrailWho1');
      await wait(0.4);
      if (stopped) return;
      await this.bark('halTrailWho1');
      await this.ringSay('ringTrailWho2');
      await wait(0.3);
      if (stopped) return;
      await this.bark('halTrailWho2');
      await at(SHARDS[0] - 0.02);
      if (stopped) return;
      this.ringSay('ringTrailShards');
      await at(SHARDS[0] + 0.12);
      if (stopped) return;
      await this.bark('halTrail2');
      await at(VEIL[0] - 0.01);
      if (stopped) return;
      this.ringSay('ringTrailVeil');
      await at(VEIL[0] + 0.15);
      if (stopped) return;
      await this.bark('halTrail3');
    })().catch(console.warn);
    return { stop: () => { stopped = true; this.hud.tutorial?.(null); } };
  }

  // the ring takes him back to where it last held the wake
  async loseWake(w) {
    const { player, ui } = this;
    this.takeControl();
    this.ringSay('ringTrailLost');
    await ui.fade(1, 0.45);
    const k = Math.max(0.004, w.progress - 0.006), p = w.at(k), dir = w.tangent(k).clone(), yaw = Math.atan2(dir.x, dir.z);
    w.near = Math.round(k * 2047);
    player.place(p, yaw);
    player.airborne(dir.multiplyScalar(10));
    player.camYaw = yaw + Math.PI;
    player.camPitch = 0.2;
    this.director.mode = 'follow';
    await wait(0.3);
    await ui.fade(0, 0.5);
    this.giveControl('Follow the violet wake');
  }

  // Out of the veil, the wake running on into a world: Zamaron from orbit, the ring's reading of it, the dive
  async zamApproach() {
    const { player, director, audio, engine, powers } = this, g = engine.gradeUniforms, hud = this.travelHud;
    g.uFlashColor.value.setRGB(1.3, 0.6, 1.7);
    await tween(0.5, (k) => (g.uFlash.value = k * k), ease.linear);
    this.playerActive = false;
    player.flying = false;
    player.autoAnim = false;
    player.lookAt(null);
    player.animator.lean.pitch = player.animator.lean.roll = player.animator.twist = 0;
    player.animator.feet.ground = null;
    player.pivot.quaternion.identity();
    player.pivot.position.y = 1;
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object;
    try {
      powers.detach();
      player.removeFromPhysics();
      const space = (this.space ??= new Space());
      space.show('zamaron');
      for (const p of [space.earth, space.oa, space.ysmault, space.korugar, space.zamaron]) p.position.set(0, 0, 0);
      this.show(space);
      space.scene.add(o);
      o.position.set(0, 0, 0);
      o.rotation.set(1.2, Math.PI, 0, 'YXZ');
      space.anchor = o.position;
      space.drift.set(0, 0, -30);
      player.flightState.k = 1;
      hud.set({ mode: 'ORBITAL APPROACH', speed: 0.35, rows: [['Destination', 'Zamaron'], ['Sector', 'Uncharted'], ['Status', 'Atmosphere: breathable']] });
      hud.show(true);
      const target = ZAMARON.center.clone().add(V(0, 40, 0));
      director.cut(V(-1.5, 1.5, 3.6), target, 50);
      const fade = tween(0.9, (k) => (g.uFlash.value = 1 - k), ease.out);
      player.animator.play(still(POSES.hover, 0.4), 1.6);
      await tween(2.4, (k) => {
        o.rotation.set(1.2 * (1 - ease.inOut(k)) + 0.15, Math.PI, 0, 'YXZ');
        space.drift.set(0, 0, -30 * (1 - k));
        director.pos.z = 3.6 - k * 0.5;
      }, ease.linear);
      await fade;
      hud.arrive({ name: 'Zamaron', sector: 'Uncharted' });
      await this.say('ringZam1', { name: 'The ring' });
      await this.say('halZam0');
      player.animator.play(player.flightGen, 0.4);
      director.cut(V(0.3, 1.9, 3.0), target, 52);
      audio.whoosh(1.6, 0.8);
      const planet = space.zamaron, p0 = planet.position.clone();
      await tween(1.5, (k) => {
        o.rotation.set(0.15 + 1.6 * ease.inOut(Math.min(1, k * 2)), Math.PI, 0, 'YXZ');
        planet.position.copy(p0).addScaledVector(V(0, 0.08, 1), k * k * 380);
        space.drift.set(0, -20 * k, -60 * k);
        director.fov = 52 + 20 * k * k;
      }, ease.linear);
      await tween(0.35, (k) => (g.uFlash.value = k), ease.in);
      o.removeFromParent();
    } finally {
      animStop();
      hud.show(false);
      director.fov = 55;
    }
  }

  // ---------------------------------------------------------------- 6. Zamaron
  // Down out of a rose evening into the valley (ours, the place; the comics', what's in it). The ring
  // finds Carol under the great crystal to the north, but their light holds the air over the citadel and
  // sets him down at the garden's mouth: on foot, then, through the Kept, the ones the Star Sapphires
  // love, asleep standing in crystal (the ring reads them; two Sapphires tend theirs, and answer him).
  // At the court two of them meet him and walk him to the citadel's stair; from its head, Carol, in their
  // light over the queen's dais. The queen is the next chapter (the user is making Aga'po).
  async toZamaron() {
    const { ui, director, audio, player, powers } = this;
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('zamaron').clock);
    this.lanternUp();
    for (const id of ['hammer', 'staff', 'bubble']) this.learn(id, false);
    await loadProps(ZAMARON_PROPS, (k) => ui.loadStage('props', k));
    const z = await this.setupZamaron();
    this.enterZamaron(ARRIVE, Math.PI);
    await this.warmUp(z.scene, null, [z.scene], (k) => ui.loadStage('shaders', k), { near: LANDING, radius: 260 });
    await this.arriveFlying(ARRIVE, Math.PI, V(0, -5, -14));
    ui.fade(0, 0.6);
    wait(1.0).then(() => this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    powers.markerTarget = { pos: BATTERY.clone(), label: 'Carol' };
    this.giveControl('Find Carol');
    wait(1.6).then(() => this.ringSay('ringZam2'));
    wait(6.5).then(() => { if (player.control) this.bark('halZam1'); });
    // their light won't let him over the citadel: it sets him down at the garden's mouth
    await waitFor(() => player.position.z < LANDING.z + 46);
    await this.setDown();
    // the garden, on foot
    powers.markerTarget = { pos: COURT.clone().add(V(0, 1.5, 0)), label: 'Carol' };
    this.giveControl('Find Carol');
    (async () => {
      await waitFor(() => player.position.z < 96);
      await this.bark('halZam3');
      await this.ringSay('ringZam4');
      await wait(0.4);
      await this.bark('halZam4');
    })().catch(console.warn);
    await waitFor(() => player.position.distanceTo(COURT) < 13 && !this.busy);
    powers.markerTarget = null;
    await this.wardens(z);
    await this.zamEnd();
  }

  // The Zamarons as free roam has them (Roam.zamSapphires), and the story's: the queen out of sight till she comes
  // down (`queen`), and Carol, over the dais in the citadel, in their light.
  zamSapphires(z) {
    super.zamSapphires(z);
    const gl = this.assets.characters.sapphire;
    if (this.queen) { this.queen.rig.root.visible = false; this.queen.hover = false; }
    if (!gl) return;
    // Carol, over the dais, in their light: her head back, her arms open
    const c = (this.zamCarol = createSapphire(gl));
    c.root.position.copy(THRONE).add(V(0, 1.2 + 2.4, 0));
    c.root.rotation.y = 0;
    z.scene.add(c.root);
    const ca = (this.zamCarolAnim = new Animator(c));
    ca.play(still(RAPTURE), 0);
    c.glowUp(1.15);
    c.eyeGlow(1);
    z.updaters.push((dt, t) => { ca.update(dt); if (!this.zamCarolFree) c.root.position.y = THRONE.y + 3.6 + Math.sin(t * 0.7) * 0.12; }); // (free: the fight's)
    const shaft = (this.zamShaft = createShaft({ from: THRONE.clone().add(V(0, 1.2, 0)), to: BATTERY.clone().add(V(0, -8, 0)), radiusFrom: 1.4, radiusTo: 2.4, color: new THREE.Color(0.6, 0.14, 0.7) }));
    shaft.userData.uniforms.uOpacity.value = 0.16;
    z.scene.add(shaft);
  }

  // Their light sets him down at the garden's mouth: a pulse out of the battery, the air thick with it, and
  // he's on the quartz, on his feet
  async setDown() {
    const { ui, director, audio, player, powers, engine } = this, g = engine.gradeUniforms;
    this.takeControl();
    powers.holster?.();
    powers.markerTarget = null;
    g.uFlashColor.value.setRGB(1.4, 0.5, 1.7);
    audio.rumble?.(0.4);
    audio.whoosh(1.6, 0.6);
    await tween(0.5, (k) => (g.uFlash.value = 0.7 * k * k), ease.linear);
    await ui.fade(1, 0.3);
    player.place(LANDING.clone(), Math.PI);
    player.lookAt(null);
    powers.enabled.flight = false;
    director.cut(LANDING.clone().add(V(2.6, 1.3, -3.4)), LANDING.clone().add(V(0, 1.1, 0)), 42);
    g.uFlash.value = 0;
    g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    player.animator.play(still(POSES.land, 0.25), 0.05);
    await ui.fade(0, 0.5);
    await wait(0.5);
    player.animator.play(player.locomotion ?? player.groundGen ?? still(POSES.stand), 0.6);
    player.autoAnim = true;
    director.move(LANDING.clone().add(V(-2.2, 1.6, -3.0)), BATTERY.clone().add(V(0, -10, 0)), 3, ease.inOut, 46);
    player.lookAt(BATTERY.clone(), 0.7);
    await this.say('ringZam3', { name: 'The ring' });
    await this.halClose(0.9);
    await this.say('halZam2');
    player.lookAt(null);
  }

  // At the court: the two wardens; they walk him to the stair, and up it
  async wardens(z) {
    const { director, player } = this;
    const [a, b] = this.wardensAt ?? [];
    if (!a) return;
    this.takeControl();
    const head = () => player.rig.bonePosition('head', V(0, 0, 0));
    for (const w of [a, b]) w.anim.lookAt(head, 0.7);
    // he walks the last of the way in to them
    const stand = COURT.clone().add(V(0, 0, -4.6));
    player.walkTo(stand, 1.4);
    director.cut(COURT.clone().add(V(5.6, 1.7, 1.6)), COURT.clone().add(V(0, 1.4, -7.4)), 40);
    await Promise.race([waitFor(() => player.position.distanceTo(stand) < 0.5), wait(6)]);
    player.turnTo(0 + Math.PI);
    player.lookAt(() => a.rig.bonePosition('head', V(0, 0, 0)), 0.8);
    await this.npcClose(a.rig, 1.2);
    await this.perform(a.body, 'ward1', [['long', 'open']]);
    await this.halClose(0.9);
    await this.say('halWard1');
    player.lookAt(() => b.rig.bonePosition('head', V(0, 0, 0)), 0.8);
    await this.npcClose(b.rig, 1.1, -1);
    await this.perform(b.body, 'ward2', [['chosen', 'open']]);
    await this.halClose(0.9, -1);
    await this.say('halWard2');
    player.lookAt(() => a.rig.bonePosition('head', V(0, 0, 0)), 0.8);
    await this.npcClose(a.rig, 1.0);
    await this.perform(a.body, 'ward3');
    // up the way to the stair, and up it: they go ahead, he follows (two shots: the climb, and its head).
    // Each walker is placed at once (in the dark, before the picture comes up) and moves with the gait's
    // own speed, easing in and out, so her feet don't slide
    const walk = (w, from, to, speed) => {
      w.rig.root.position.copy(from);
      w.rig.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      Object.assign(w.anim.feet, { ground: (x, zz) => z.ground(x, zz), offL: 0, offR: 0, drop: 0 }); // (what the feet had where she was is no use here)
      const e = 0.125, along = (k) => (k < e ? (k * k) / (2 * e) : k > 1 - e ? 1 - e - ((1 - k) ** 2) / (2 * e) : k - e / 2) / (1 - e);
      return tween(from.distanceTo(to) / speed / (1 - e), (k) => {
        const p = w.rig.root.position.lerpVectors(from, to, along(k));
        p.y = z.ramp(p.x, p.z);
        w.loco.speed = speed * Math.min(1, k / e, (1 - k) / e);
      }, ease.linear).then(() => (w.loco.speed = 0));
    };
    const s0 = STAIR[0], gz = GATE.z;
    player.lookAt(V(0, PLAZA.y + 3, gz), 0.55); // (up the stair, to the citadel: not back at where they stood)
    for (const w of [a, b]) w.anim.lookAt(null);
    await this.ui.fade(1, 0.6);
    player.place(V(0.3, 0, s0 + 7.5), Math.PI);
    director.cut(V(5.4, 1.2, s0 + 9), V(0, 2.4, s0 - 4), 44);
    director.move(V(4.6, 2.4, s0 + 3), V(0, 4.8, s0 - 12), 7, ease.inOut, 44);
    const up = [walk(a, V(-1.4, 0, s0 + 3.5), V(-1.4, 0, s0 - 5), 1.3), walk(b, V(1.4, 0, s0 + 3.2), V(1.4, 0, s0 - 5.2), 1.3)];
    await this.ui.fade(0, 0.6);
    await wait(0.3);
    player.walkTo(V(0.3, 0, s0 - 1.5), 1.3);
    await Promise.all(up);
    // the head of it: they wait either side of the gate, turned in to him, and watch him come up between them
    await this.ui.fade(1, 0.5);
    for (const [w, x] of [[a, -3.4], [b, 3.4]]) {
      w.rig.root.position.set(x, PLAZA.y, gz - 0.6);
      w.rig.root.rotation.y = Math.atan2(-x * 0.4, 1); // (turned in a little, to him)
      Object.assign(w.anim.feet, { ground: (xx, zz) => z.ground(xx, zz), offL: 0, offR: 0, drop: 0 });
      w.anim.lookAt(() => player.rig.bonePosition('head', V(0, 0, 0)), 0.6);
    }
    player.place(V(0, z.ramp(0, STAIR[1] + 4), STAIR[1] + 4), Math.PI);
    player.lookAt(() => this.zamCarol.bonePosition('head', V(0, 0, 0)), 0.5);
    director.cut(V(-2.6, PLAZA.y + 1.5, gz - 5.5), V(0, PLAZA.y + 0.8, STAIR[1] + 3), 44);
    await this.ui.fade(0, 0.5);
    player.walkTo(V(0, PLAZA.y, gz + 0.4), 1.25);
    await Promise.race([waitFor(() => player.position.z < gz + 0.9), wait(6)]);
  }

  // From the stair's head: across the plaza, Carol in their light over the dais, and the ring's word on her;
  // close on her; and the warden's. The queen is next.
  async zamEnd() {
    const { ui, director, player } = this;
    const c = this.zamCarol, face = () => c.bonePosition('head', V(0, 0, 0));
    player.turnTo(Math.PI);
    player.lookAt(face, 0.8);
    // behind him at the gate: the plaza, the battery over it, and far off at its end, her
    director.cut(GATE.clone().add(V(0.9, 2.3, 5.2)), THRONE.clone().add(V(0, 5, 0)), 50);
    director.move(GATE.clone().add(V(0.7, 2.1, 3.8)), THRONE.clone().add(V(0, 4.6, 0)), 4, ease.inOut, 46);
    await wait(2.2);
    // close on her, from below: her head back in the light, her eyes lit
    const h = face();
    director.cut(h.clone().add(V(0.9, -0.75, 2.1)), h.clone().add(V(0, -0.04, 0)), 30);
    director.move(h.clone().add(V(0.7, -0.6, 1.7)), h.clone().add(V(0, -0.02, 0)), 5, ease.inOut, 28);
    await this.say('ringZam5', { name: 'The ring' });
    await this.halClose(0.8);
    await this.say('halZam5');
    const b = this.wardensAt[1];
    b.anim.lookAt(() => player.rig.bonePosition('head', V(0, 0, 0)), 0.7);
    await this.npcClose(b.rig, 0.9, -1);
    await this.perform(b.body, 'ward4');
    await wait(0.8);
    await ui.fade(1, 1.2); // (and on into `queen`, in the dark)
  }

  // ---------------------------------------------------------------- 7. the queen
  // (Ours, round the comics' Zamarons, who choose Carol Ferris to be their queen.) Aga'po comes down out of the
  // battery's light onto the dais and lets him try: her light comes across the plaza in waves, and he crosses
  // it on foot, the shield up as each one reaches him (a wave that catches him throws him back and the crystal
  // climbs him). At the dais's foot she seals him in crystal, one of the Kept; and Carol, alone in the gem's
  // noise, holds on to one voice (the player, as her: keep him in sight, hold on) and comes down and frees him.
  async queenOfZamaron() {
    const { ui, director, audio, player, powers, engine } = this, g = engine.gradeUniforms;
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('queen').clock);
    this.lanternUp();
    for (const id of ['hammer', 'staff', 'bubble']) this.learn(id, false);
    await loadProps(ZAMARON_PROPS, (k) => ui.loadStage('props', k));
    const z = await this.setupZamaron();
    const fresh = this.current !== z;
    if (fresh) {
      this.enterZamaron(GATE.clone().add(V(0, 0, 0.4)), Math.PI);
      await this.warmUp(z.scene, null, [z.scene], (k) => ui.loadStage('shaders', k), { near: PLAZA, radius: 220 });
      g.uFlash.value = 0;
      g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    }
    powers.enabled.flight = false; // (their light holds the air over the citadel: ringZam3)
    powers.choose(0);
    const q = this.queen, c = this.zamCarol, ca = this.zamCarolAnim;
    // where it stands: him at the stair's head between the wardens, Carol over the dais, and the queen not yet
    player.place(GATE.clone().add(V(0, 0, 0.4)), Math.PI);
    player.lookAt(() => c.bonePosition('head', _h), 0.6);
    const [w1, w2] = this.wardensAt;
    for (const [w, x] of [[w1, -3.4], [w2, 3.4]]) {
      w.rig.root.position.set(x, PLAZA.y, GATE.z - 0.6);
      w.rig.root.rotation.y = Math.PI + x * 0.06;
      Object.assign(w.anim.feet, { ground: (xx, zz) => z.ground(xx, zz), offL: 0, offR: 0, drop: 0 });
      w.anim.lookAt(() => q.rig.bonePosition('head', _r), 0.5);
    }
    if (this.zamShaft) this.zamShaft.visible = true;
    // she comes down out of the battery's light onto the dais
    q.rig.root.visible = true;
    q.rig.root.position.copy(BATTERY).add(V(0, -6, 0));
    q.rig.root.rotation.y = 0;
    q.hover = true;
    q.rig.glowUp(2.4);
    director.cut(GATE.clone().add(V(2.6, 1.4, 4.2)), BATTERY.clone().add(V(0, -6, 0)), 50);
    await ui.fade(0, 1.0);
    audio.shimmer?.(1.2);
    audio.rumble?.(2.5, 0.25);
    const down = QUEEN_AT.clone();
    const from = q.rig.root.position.clone();
    director.move(GATE.clone().add(V(1.6, 1.6, 2.6)), down.clone().add(V(0, 1.4, 0)), 5.2, ease.inOut, 44);
    await tween(5.0, (k) => { q.rig.root.position.lerpVectors(from, down, ease.inOut(k)); q.rig.glowUp(2.4 - 1.4 * k); }, ease.linear);
    q.base = down.y;
    // close on her; and him
    q.anim.lookAt(this.headOf(player.rig), 0.6);
    player.lookAt(() => q.rig.bonePosition('head', _r), 0.7);
    for (const w of [w1, w2]) w.anim.lookAt(this.headOf(player.rig), 0.5);
    await this.queenClose(1.4, 1, 6, 26);
    await this.perform(q.body, 'agQ1', [['one', 'open']]);
    await this.halClose(1.0);
    await this.say('halQn1');
    await this.queenClose(1.0, -1, 5, 28);
    await this.perform(q.body, 'agQ2', [['kept', 'open'], ['found', () => q.anim.gesture('nod', 1, 0.3)]]);
    await this.halClose(0.9, -1);
    await this.say('halQn2');
    await this.queenClose(0.9, 1, 4.6, 26);
    await this.perform(q.body, 'agQ3', [['window', () => q.anim.gesture('tilt', 1, 0.35)]]);
    await this.halClose(0.9);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halQn3');
    await this.queenClose(1.0, -1, 5.4, 30);
    await this.perform(q.body, 'agQ4', [['take', 'open']]);
    // across her light, on foot
    await this.queenCrossing(z);
    await this.queenSeal(z);
    await this.carolHolds(z);
    await this.carolFrees(z);
  }

  // the queen from in front, at her eyes' height, `dist` off, from her west always (`side` only how far: from her
  // east, from below, the battery's light shone off the crystal wall behind the dais as a white sun beside her)
  queenClose(duration = 1.2, side = 1, dist = 5, fov = 28) {
    const q = this.queen.rig, h = q.bonePosition('head', V(0, 0, 0)).add(V(0, 0.1, 0));
    return this.director.move(h.clone().add(V(side > 0 ? -1.1 : -1.7, -0.12, dist)), h.clone().add(V(0, -0.12, 0)), duration, ease.inOut, fov);
  }

  // The crossing: waves of her light out from the dais across the plaza, a beat apart and closer together as he
  // nears. Each wave, met with the shield, holds (raised just as it reaches him, it breaks round him: a parry);
  // one that catches him throws him back and the crystal climbs him; four, and it throws him back to the gate.
  async queenCrossing(z) {
    const { ui, player, powers, hud, audio, director } = this, q = this.queen;
    const GOAL = 8.8, START = THRONE.distanceTo(GATE);
    const crystal = this.crossCrystal(z);
    const waves = [];
    const waveMat = () => new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uK; varying vec2 vU;
        void main(){ float a = pow(1.0 - vU.y, 2.2) * (0.55 + 0.45 * sin(vU.x * 180.0)); gl_FragColor = vec4(vec3(0.85, 0.26, 1.15) * a * uK, 1.0); }`,
    });
    const band = new THREE.CylinderGeometry(1, 1, 2.2, 96, 1, true).translate(0, 1.1, 0);
    const ringGeo = new THREE.RingGeometry(0.97, 1.0, 96).rotateX(-Math.PI / 2);
    const spawn = () => {
      const m = waveMat(), mesh = new THREE.Mesh(band, m), ring = new THREE.Mesh(ringGeo, m);
      mesh.renderOrder = ring.renderOrder = 21;
      const gp = new THREE.Group();
      gp.add(mesh, ring);
      gp.position.set(THRONE.x, PLAZA.y + 0.03, THRONE.z);
      z.scene.add(gp);
      const w = { gp, m, r: 6.4, done: false };
      waves.push(w);
      audio.whoosh?.(1.1, 0.25);
      return w;
    };
    const dist = () => Math.hypot(player.position.x - THRONE.x, player.position.z - THRONE.z);
    let held = 0, nextAt = 2.2, clock = 0, said = new Set(), fails = 0, tell = 0, stopped = false, failing = false;
    this.crossState = { waves, dist: () => dist(), get held() { return held; }, get fails() { return fails; } }; // (for tools/sapphire-end-bot.js)
    const once = (key, fn) => { if (said.has(key)) return; said.add(key); fn(key); };
    hud.tutorial({ kicker: 'The queen', n: 1, of: 1, title: 'Cross her light', html: 'Walk to the dais. Her light comes across the plaza in <b>waves</b>: <b>raise the shield</b> (<kbd>Right-click</kbd> or <kbd>F</kbd>) as each one reaches you. Raised <b>just as it arrives</b>, it breaks round you; held up too long, it still pushes you back.<br><span class="dim">A wave that catches you throws you back, and their crystal takes hold.</span>' });
    powers.markerTarget = { pos: THRONE.clone().add(V(0, 4.2, 0)), label: 'Carol' };
    this.giveControl('Reach Carol');
    wait(1.2).then(() => this.ringSay('ringQn1'));
    await new Promise((resolve) => {
      const stop = onFrame((dt) => {
        if (this.paused) return;
        clock += dt;
        const d = dist(), k = 1 - Math.min(1, Math.max(0, (d - GOAL) / (START - GOAL)));
        // the tell: her hands come up and her light gathers on the dais, then it goes
        if (clock > nextAt - 0.75 && tell === 0) { tell = 1; q.body.play('open'); q.rig.glowUp(2.2); audio.shimmer?.(0.4); }
        if (clock > nextAt) {
          tell = 0;
          q.rig.glowUp(1);
          spawn();
          // a second close behind it, now and then, once he's well in (a held shield takes both; a parry needs two)
          if (k > 0.35 && Math.random() < 0.35 + 0.3 * k) wait(0.7).then(() => { if (!stopped) spawn(); });
          nextAt = clock + 3.0 - 1.1 * k + Math.random() * 0.5;
        }
        for (const w of waves) {
          const r0 = w.r;
          w.r += dt * 15;
          w.gp.scale.set(w.r, 1, w.r);
          w.m.uniforms.uK.value = Math.min(1, (w.r - 6.4) / 3) * Math.max(0, 1 - (w.r - 26) / 22);
          if (!w.done && !failing && r0 < d && w.r >= d) {
            w.done = true;
            const toHal = V(player.position.x - THRONE.x, 0, player.position.z - THRONE.z).normalize();
            const at = player.rig.bonePosition('chest', V(0, 0, 0)).addScaledVector(toHal, -0.4);
            const res = powers.guardHit(at.clone().addScaledVector(toHal, -1.5), at);
            if (res === 'parry') {
              once('halQw2p', () => {});
            } else if (res === 'block') {
              player.dash?.(toHal.clone(), 3.2, 0.25);
            } else {
              player.dash?.(toHal.clone(), 9, 0.4);
              director.shake(0.35, 0.35);
              audio.impact?.(0.6);
              held = Math.min(1, held + 0.27);
              crystal.set(held);
              once('ringQnHeld', (key) => this.ringSay(key));
            }
          }
        }
        for (let i = waves.length - 1; i >= 0; i--) if (waves[i].r > 48) { waves[i].gp.removeFromParent(); waves[i].m.dispose(); waves.splice(i, 1); }
        held = Math.max(0, held - dt * 0.035);
        crystal.set(held);
        crystal.follow(player.position);
        // what's said on the way, once each
        if (k > 0.2) once('agQw1', (key) => this.perform(q.body, key, [], { skip: false }));
        if (k > 0.42) once('halQw1', (key) => this.bark(key));
        if (k > 0.55) once('agQw2', (key) => this.perform(q.body, key, [], { skip: false }));
        if (k > 0.7) once('sapQw1', (key) => this.say(key, { skip: false }));
        if (k > 0.8) once('agQw3', (key) => this.perform(q.body, key, [], { skip: false }));
        if (k > 0.9) once('halQw2', (key) => this.bark(key));
        // four waves taken: thrown back to the gate (the crystal shatters off him)
        if (held >= 0.999 && !failing) {
          held = 0;
          fails++;
          failing = true;
          (async () => {
            this.takeControl();
            audio.glass?.(0.9);
            crystal.set(0);
            this.perform(q.body, 'agQwFail', [], { skip: false });
            await ui.fade(1, 0.5);
            for (const w of waves) w.r = 99;
            player.place(GATE.clone().add(V(0, 0, 0.4)), Math.PI);
            player.lookAt(null);
            clock = 0; nextAt = 2.6; said.delete('ringQnBack');
            await ui.fade(0, 0.5);
            this.giveControl('Reach Carol');
            this.ringSay('ringQnBack');
            failing = false;
          })().catch(console.warn);
        }
        if (d < GOAL && !failing) { stopped = true; stop(); resolve(); }
      });
    });
    for (const w of waves) { w.gp.removeFromParent(); w.m.dispose(); }
    band.dispose();
    ringGeo.dispose();
    hud.tutorialDone?.();
    hud.tutorial(null);
    powers.markerTarget = null;
    this.crystalOnHal = crystal;
    this.crossFails = fails;
  }

  // Their crystal on him, rising from his feet: `set(k)` 0 none .. 1 to his collarbones, `seal()` all of him.
  crossCrystal(z) {
    const g = new THREE.Group();
    let c = null;
    if (hasProp('crystal_shard')) {
      c = prop('crystal_shard');
      c.traverse((m) => { if (m.isMesh) { m.material = z.keptMat; m.castShadow = false; m.renderOrder = 2; } });
      c.position.y = -0.85;
      g.add(c);
    }
    g.visible = false;
    z.scene.add(g);
    let k = 0;
    const apply = () => {
      g.visible = k > 0.01;
      // (the Kept's crystal is 1.24 tall-scaled over a 3 m shard: at 1 it closes over the head)
      g.scale.set(0.82 + 0.2 * k, Math.max(0.01, 1.24 * k), 0.82 + 0.2 * k);
    };
    return {
      group: g,
      set(v) { k = v * 0.8; apply(); },
      seal(v) { k = v; apply(); },
      follow(p) { g.position.set(p.x, p.y, p.z); },
      remove() { g.removeFromParent(); },
    };
  }

  // At the dais's foot: Carol, and the queen's answer: the crystal closes over him, one of the Kept.
  async queenSeal(z) {
    const { director, player, audio, engine } = this, g = engine.gradeUniforms, q = this.queen, c = this.zamCarol, ca = this.zamCarolAnim;
    this.takeControl();
    const crystal = this.crystalOnHal;
    const stand = THRONE.clone().add(V(0, 0, 8.6));
    stand.y = z.ground(stand.x, stand.z);
    if (player.position.distanceTo(stand) > 0.6) { player.walkTo(stand, 1.6); await Promise.race([waitFor(() => player.position.distanceTo(stand) < 0.5), wait(3)]); }
    player.turnTo(Math.PI);
    const cHead = () => c.bonePosition('head', _h);
    player.lookAt(cHead, 0.8);
    // up at her, from behind him
    director.cut(stand.clone().add(V(-1.2, 1.2, 3.2)), cHead().clone().add(V(0, -0.4, 0)), 44);
    await wait(0.6);
    await this.say('halQn4');
    // her, from below: her head comes down a little from the light, her eyes on him
    ca.lookAt(this.headOf(player.rig), 0.4);
    const h = cHead().clone();
    director.cut(h.clone().add(V(0.6, -1.4, 2.6)), h.clone(), 30);
    director.move(h.clone().add(V(0.5, -1.2, 2.2)), h.clone(), 3, ease.inOut, 28);
    await this.say('sapQn1');
    await this.queenClose(1.0, 1, 4.4, 28);
    await this.perform(q.body, 'agQ5', [['stay', 'open']]);
    // the crystal: up from his feet and over him, his hand out to her
    const sh = V(0, 0, 0);
    player.autoAnim = false;
    player.animator.reach('R', () => { player.rig.bonePosition('upperArm_R', sh); return sh.add(cHead().clone().sub(sh).normalize().multiplyScalar(0.6)); }, { pole: V(-0.4, -0.85, -0.3), rate: 3 });
    crystal.follow(stand);
    director.cut(stand.clone().add(V(-2.4, 1.5, 3.4)), stand.clone().add(V(0, 1.3, 0)), 40);
    audio.glass?.(0.5);
    audio.shimmer?.(1.6);
    const k0 = Math.max(0.05, crystal.group.scale.y / 1.24);
    const say = wait(1.0).then(() => this.say('halQn5', { skip: false }));
    await tween(2.4, (k) => crystal.seal(k0 + (1 - k0) * ease.inOut(k)), ease.linear);
    await say;
    g.uFlashColor.value.setRGB(1.2, 0.5, 1.6);
    tween(0.8, (k) => (g.uFlash.value = 0.35 * (1 - k)), ease.out).then(() => { g.uFlash.value = 0; g.uFlashColor.value.setRGB(0.55, 1.6, 0.75); });
    this.ringGlow = 0.4;
    await this.say('ringQn2', { name: 'The ring' });
    // (frozen in it: the animator holds where it is)
    player.animator.freeze = true;
    await wait(0.8);
  }

  // Carol, in the gem's noise: over her shoulder, him in the crystal below, the view pulled away from him and
  // the whispers of everyone she can feel; the player keeps him in the ring and holds on.
  async carolHolds(z) {
    const { ui, director, input, hud, engine, audio } = this, g = engine.gradeUniforms, c = this.zamCarol;
    const halAt = this.player.rig.bonePosition('head', V(0, 0, 0)).clone();
    const head = () => c.bonePosition('head', _h);
    const cam = () => head().clone().add(V(0.5, 0.6, -1.55));
    // the view: the direction to him, turned by how far the gem has pulled it (yaw, pitch)
    // (its state on the story while it lasts: tools/sapphire-end-bot.js plays it)
    const st = (this.holdState = { ay: 0.2, ap: 0.12, k: 0 });
    let t = 0, still = 0, phase = 0, next = 2.5, w = 0, quietTill = 0;
    const WH = ['gemW1', 'gemW2', 'gemW3', 'gemW4', 'gemW5'];
    const aim = () => {
      const from = cam(), d = halAt.clone().sub(from).normalize();
      d.applyAxisAngle(V(0, 1, 0), st.ay); // (+ay: to the left)
      const right = V(-d.z, 0, d.x).normalize();
      d.applyAxisAngle(right, st.ap); // (+ap: up)
      return { from, at: from.clone().addScaledVector(d, 10) };
    };
    // the ring at the middle of the frame, filling as she holds on
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;pointer-events:none;z-index:6;opacity:0;transition:opacity .6s';
    el.innerHTML = '<svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,190,255,.35)" stroke-width="2"/><circle id="hk" cx="60" cy="60" r="52" fill="none" stroke="rgba(255,150,255,.95)" stroke-width="4" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7" transform="rotate(-90 60 60)"/></svg>';
    document.body.appendChild(el);
    const arc = el.querySelector('#hk');
    // into her: the light, and her
    await ui.fade(1, 0.6);
    const v = aim();
    director.cut(v.from, v.at, 36);
    g.uFlashColor.value.setRGB(1.1, 0.45, 1.5);
    g.uFlash.value = 0.08;
    await ui.fade(0, 0.8);
    el.style.opacity = '1';
    hud.tutorial({ kicker: 'Carol', n: 1, of: 1, title: 'One voice', html: 'The gem pulls her eyes away from him. <b>Keep Hal inside the ring</b> (move the mouse, or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>) and <b>hold on</b> (hold the <kbd>left button</kbd> or <kbd>Space</kbd>).' });
    ui.cinematic(false);
    this.freeLook = true;
    input.setLook(true);
    ui.objective('Hold on to him');
    await new Promise((resolve) => {
      const stop = onFrame((dt, tt, real) => {
        if (this.paused) return;
        t += dt;
        // the pull: a slow wander, stronger as she gets closer, and up toward the battery's light
        const s = 0.22 + 0.5 * st.k;
        st.ay += (Math.sin(t * 0.61) * 0.7 + Math.sin(t * 1.37 + 1.3) * 0.5) * s * dt;
        st.ap += (Math.sin(t * 0.47 + 0.6) * 0.6 + 0.35) * s * dt * 0.8;
        const look = input.lookEnabled ? input.look : input.mouse, ax = input.moveAxis();
        st.ay -= look.dx * 0.0021 + ax.x * 0.9 * dt;
        st.ap -= look.dy * 0.0021 - ax.z * 0.9 * dt;
        st.ay = Math.max(-0.7, Math.min(0.7, st.ay));
        st.ap = Math.max(-0.45, Math.min(0.6, st.ap));
        const off = Math.hypot(st.ay, st.ap), inside = off < 0.085, hold = input.down('Mouse0') || input.down('Space');
        // (a thought of hers takes its time: she doesn't get past the next one till it's said)
        const cap = t < quietTill ? [0.33, 0.66, 0.92, 1][phase] - 0.005 : 1;
        if (inside && hold) { st.k = Math.min(cap, st.k + dt / 8); still = 0; } else { st.k = Math.max(0, st.k - dt / 11); still += dt; }
        const k = st.k;
        arc.setAttribute('stroke-dashoffset', String(326.7 * (1 - k)));
        arc.style.stroke = inside ? 'rgba(255,150,255,.95)' : 'rgba(255,150,255,.45)';
        const v2 = aim();
        director.cut(v2.from, v2.at, 36 - 4 * k);
        g.uFlash.value = 0.08 * (1 - k) + 0.03 * Math.sin(t * 2.1);
        // the whispers, and her own thoughts as she gets hold of him
        if (t > next && w < WH.length) { this.say(WH[w++], { skip: false }); next = t + 3.6 + Math.random(); }
        if (k > 0.33 && phase === 0) { phase = 1; this.say('carolTh1', { skip: false }); quietTill = t + 2.2; next = Math.max(next, t + 3.2); }
        if (k > 0.66 && phase === 1) { phase = 2; this.say('carolTh2', { skip: false }); quietTill = t + 3.4; next = Math.max(next, t + 4.2); }
        if (k > 0.92 && phase === 2) { phase = 3; this.say('carolTh3', { skip: false }); quietTill = t + 2.4; next = t + 99; }
        if (still > 14 && phase < 3) { still = 0; this.say('carolTh5', { skip: false }); }
        if (k >= 1) { stop(); resolve(); }
      });
    });
    this.freeLook = false;
    input.setLook(false);
    ui.objective(null);
    hud.tutorialDone?.();
    hud.tutorial(null);
    ui.cinematic(true);
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 800);
    audio.ringChime?.();
    await this.say('carolTh4');
  }

  // She comes down out of the light, herself; her hand on the crystal and it breaks; to the queen.
  async carolFrees(z) {
    const { director, player, audio, engine } = this, g = engine.gradeUniforms, q = this.queen, c = this.zamCarol, ca = this.zamCarolAnim;
    const stand = player.position.clone();
    // the light round her breaks up; the gem's light steadies in her
    g.uFlashColor.value.setRGB(1.4, 0.55, 1.8);
    g.uFlash.value = 0.55;
    audio.sonicBoom?.(0.4);
    tween(1.0, (k) => (g.uFlash.value = 0.55 * (1 - k) ** 2), ease.linear).then(() => { g.uFlash.value = 0; g.uFlashColor.value.setRGB(0.55, 1.6, 0.75); });
    if (this.zamShaft) tween(1.2, (k) => (this.zamShaft.userData.uniforms.uOpacity.value = 0.16 * (1 - k)), ease.inOut).then(() => (this.zamShaft.visible = false));
    this.zamCarolFree = true;
    c.eyeGlow(0.3);
    ca.play(still(POSES.hover), 1.0);
    // down to him: in front of the crystal, on the dais's side
    const land = stand.clone().add(V(-0.75, 0, -1.25));
    land.y = z.ground(land.x, land.z);
    const cFrom = c.root.position.clone();
    director.cut(stand.clone().add(V(3.6, 1.5, 1.6)), stand.clone().lerp(cFrom, 0.5).add(V(0, 0.8, 0)), 46);
    director.move(stand.clone().add(V(3.0, 1.5, 0.8)), land.clone().add(V(0, 1.2, 0)), 3.0, ease.inOut, 42);
    await tween(2.8, (k) => { c.root.position.lerpVectors(cFrom, land, ease.inOut(k)); c.root.rotation.y = yawTo(c.root.position, stand); }, ease.linear);
    ca.play(still(POSES.stand), 0.6);
    ca.feet.ground = (x, q2) => z.ground(x, q2);
    // her hand on the crystal; it breaks
    const touch = stand.clone().add(V(-0.4, 1.35, -0.45));
    ca.reach('R', () => touch, { rate: 3, pole: V(-0.4, -0.85, -0.3) });
    director.cut(land.clone().add(V(1.7, 1.45, 1.6)), touch.clone().lerp(c.bonePosition('head', _h), 0.4), 36);
    c.glowUp(1.8);
    audio.shimmer?.(0.8);
    await wait(1.4);
    audio.glass?.(1.3);
    director.shake(0.25, 0.4);
    const crystal = this.crystalOnHal;
    await tween(0.35, (k) => { crystal.group.scale.multiplyScalar(1 + k * 0.06); crystal.group.traverse((m) => { if (m.isMesh) m.visible = k < 0.7; }); }, ease.linear);
    crystal.remove();
    this.crystalOnHal = null;
    this.powers.sparks?.emit(90, (p, vv) => {
      p[0] = stand.x + (Math.random() - 0.5) * 1.2; p[1] = stand.y + Math.random() * 2.2; p[2] = stand.z + (Math.random() - 0.5) * 1.2;
      vv[0] = (Math.random() - 0.5) * 6; vv[1] = Math.random() * 3; vv[2] = (Math.random() - 0.5) * 6;
    }, { life: 0.9, size: [0.07, 0], color: [[2.4, 1.0, 3.0, 1], [0.6, 0.2, 1.0, 0]] });
    c.glowUp(1);
    ca.reach('R', null, { rate: 3 });
    // him out of it, down on a knee, and up
    player.animator.freeze = false;
    player.animator.reach('R', null, { rate: 4 });
    player.animator.play(still(POSES.land, 0.25), 0.1);
    this.ringGlow = 0.6;
    await wait(0.9);
    player.animator.play(player.locomotion ?? player.groundGen ?? still(POSES.stand), 0.8);
    player.autoAnim = true;
    player.lookAt(() => c.bonePosition('head', _h), 0.8);
    player.turnTo(yawTo(stand, land));
    ca.lookAt(this.headOf(player.rig), 0.7);
    const cb = (this.zamCarolBody ??= new BodyLanguage(c, ca, { lookHome: null, scale: 1, reach: 0.55, shift: null, gestures: undefined }));
    const cbTick = (dt) => cb.update(dt);
    z.updaters.push(cbTick);
    await wait(0.6);
    await this.npcClose(c, 1.0, 1, 30, yawTo(land, stand));
    await this.perform(cb, 'carolQn1', [['me', () => ca.gesture('nod', 1, 0.35)]]);
    await this.halClose(0.9);
    await this.say('halQn6');
    await this.npcClose(c, 0.9, -1, 30, yawTo(land, stand));
    await this.perform(cb, 'carolQn2', [['quiet', () => ca.gesture('tilt', 1, 0.35)]]);
    // to the queen
    const qHead = () => q.rig.bonePosition('head', _r);
    ca.lookAt(qHead, 0.7);
    player.lookAt(qHead, 0.6);
    const cy0 = c.root.rotation.y, cy1 = yawTo(land, THRONE);
    await tween(0.8, (k) => (c.root.rotation.y = cy0 + wrap(cy1 - cy0) * ease.inOut(k)));
    director.move(land.clone().add(V(1.1, 1.5, 2.2)), qHead().clone().lerp(c.bonePosition('head', _h), 0.55), 1.4, ease.inOut, 40);
    await this.perform(cb, 'carolQn3', [['queen', 'stop']]);
    await this.queenClose(1.0, 1, 4.2, 28);
    await this.perform(q.body, 'agQ6');
    await this.npcClose(c, 1.0, 1, 30, cy1);
    await this.perform(cb, 'carolQn4');
    // and over them all, the battery: something in it moved when she took the gem back
    z.updaters = z.updaters.filter((u) => u !== cbTick);
    tween(2.5, (k) => (z.unrest = 0.6 * k), ease.inOut);
    audio.rumble?.(2.5, 0.35);
    q.anim.lookAt(BATTERY.clone(), 0.6);
    director.move(land.clone().add(V(-3, 1.4, 6)), BATTERY.clone().add(V(0, -8, 0)), 2.8, ease.inOut, 50);
    await wait(1.4);
    await this.perform(q.body, 'agQ7', [['light', () => q.anim.gesture('tilt', 1, 0.3)]]);
    await wait(0.6);
    await this.ui.fade(1, 1.0);
  }

  // ---------------------------------------------------------------- 8. the Predator
  // (Ours, round the comics' Predator: the violet light's entity, love with nothing else in it, which has
  // had Carol before.) After the queen, the gem hers: the battery stutters, and what the Zamarons have kept
  // in its light comes out of it, the thing that was speaking to her through the gem all along. On the
  // plaza with Carol beside him (`SapphireAlly`): block, then strike (`Predator`), and her crystal holds it
  // when his parry throws it open; in the air it reaches for her. At a fifth of it, it comes down, she
  // holds it, and the battery's light takes it back up.
  async predatorFight() {
    const { ui, director, audio, player, powers, hud, engine } = this, g = engine.gradeUniforms;
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('predator').clock);
    this.lanternUp();
    for (const id of ['hammer', 'staff']) this.learn(id, false);
    await loadProps(ZAMARON_PROPS, (k) => ui.loadStage('props', k));
    const z = await this.setupZamaron();
    ui.loadStage('creature', 0.3);
    const gl = await loadPredator();
    ui.loadStage('creature', 1);
    this.enterZamaron(PRED_HAL.clone(), Math.PI);
    powers.enabled.flight = true;
    powers.trappable = null; // (too big for the bubble)
    // Carol at his side: herself, the gem hers
    const c = this.zamCarol, ca = this.zamCarolAnim;
    this.zamCarolFree = true;
    if (this.zamShaft) this.zamShaft.visible = false;
    c.root.position.copy(PRED_CAROL);
    c.root.rotation.set(0, Math.PI, 0);
    ca.play(still(POSES.stand), 0);
    ca.feet.ground = (x, q) => z.ground(x, q);
    c.eyeGlow(0.3);
    c.glowUp(1);
    const cb = (this.zamCarolBody ??= new BodyLanguage(c, ca, { lookHome: null, scale: 1, reach: 0.55, shift: null, gestures: undefined }));
    const cbTick = (dt) => cb.update(dt);
    z.updaters.push(cbTick);
    // the wardens at the stair's head, watching the battery
    const [w1, w2] = this.wardensAt;
    for (const [w, x] of [[w1, -3.4], [w2, 3.4]]) {
      w.rig.root.position.set(x, PLAZA.y, GATE.z - 0.6);
      w.rig.root.rotation.y = Math.PI + x * 0.06;
      Object.assign(w.anim.feet, { ground: (xx, q) => z.ground(xx, q), offL: 0, offR: 0, drop: 0 });
      w.anim.lookAt(() => BATTERY, 0.5);
    }
    // the queen over the dais, watching it
    const q = this.queen;
    if (q) {
      q.rig.root.visible = true;
      q.rig.root.position.copy(QUEEN_AT);
      q.rig.root.rotation.y = 0;
      q.base = q.rig.root.position.y;
      q.hover = true;
      q.rig.glowUp(1);
      q.anim.lookAt(() => BATTERY, 0.5);
    }
    // the Predator, in the battery's light (small, inside the crystal, till it comes out)
    const foe = (this.pred = new Predator({ scene: z.scene, physics: z.physics, powers, player, audio, director, engine, gltf: gl, ground: (x, q) => z.ground(x, q), centre: PRED_AT.clone().add(V(0, 0, 4)), radius: 33, avoid: [{ x: THRONE.x, z: THRONE.z, r: 12 }] })); // (33: out to the stair's head, where he stood out of its reach)
    foe.scripted = true;
    foe.state = 'script';
    foe.root.position.copy(BATTERY);
    foe.root.scale.setScalar(0.25);
    const foeTick = (dt, t) => foe.update(dt, t);
    z.updaters.push(foeTick);
    player.lookAt(BATTERY.clone(), 0.5);
    ca.lookAt(BATTERY.clone(), 0.5);
    await this.warmUp(z.scene, null, [z.scene], (k) => ui.loadStage('shaders', k), { near: PLAZA, radius: 220 });
    g.uFlash.value = 0;
    g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);

    // the battery, stuttering
    // (behind the two of them, then tilting up past them to it: from behind him it's 50 degrees up, no frame
    // holds both)
    director.cut(PRED_HAL.clone().add(V(-1.1, 1.3, 5.4)), PRED_HAL.clone().add(V(-1.1, 2.2, -20)), 54);
    director.move(PRED_HAL.clone().add(V(-1.0, 1.0, 4.4)), BATTERY.clone().add(V(0, -6, 0)), 5.5, ease.inOut, 54);
    await ui.fade(0, 1.0);
    tween(4, (k) => (z.unrest = k), ease.inOut);
    audio.rumble?.(3, 0.3);
    this.ringGlow = 2.2;
    audio.ringChime?.();
    await this.say('ringPred1', { name: 'The ring' });
    this.ringGlow = 1.2;
    await this.npcClose(c, 1.2);
    await this.perform(cb, 'carolPred1', [['feel', () => ca.gesture('nod', 1, 0.35)]]); // (her 'chest' on this rig put the hand up by her head)
    w1.anim.lookAt(this.headOf(player.rig), 0.6);
    await this.npcClose(w1.rig, 1.1);
    await this.perform(w1.body, 'ward5');
    await this.npcClose(w2.rig, 1.0, -1);
    await this.perform(w2.body, 'ward6');
    await this.predEmerge(foe, z);
    // the two of them
    player.lookAt(() => foe.parts[0].tg.position, 0.6);
    ca.lookAt(() => foe.parts[0].tg.position, 0.6);
    await this.halClose(1.0);
    await this.say('halPred1');
    await this.npcClose(c, 0.9, -1);
    await this.perform(cb, 'carolPred2');
    player.lookAt(null);
    for (const w of [w1, w2]) w.anim.lookAt(() => foe.parts[1].tg.position, 0.5);

    // the fight
    hud.tutorial({ kicker: 'The Predator', n: 1, of: 1, title: 'Love’s entity', html: 'Its hide turns most blows. Each attack has a tell: <b>raise the shield</b> (<kbd>Right-click</kbd> or <kbd>F</kbd>) <b>just as it strikes</b> and it’s thrown open: <b>Carol pins it</b>, and your blows land.<br>Behind it, the <b>tail</b>: fly over it or get clear. A shield <b>held</b> too long, its <b>wings</b> tear away.<br><span class="dim">In the air it reaches for Carol: get between them with the shield up, or break its head off her.</span>' });
    hud.boss('The Predator', 1, PRED.yieldAt);
    const bar = onFrame(() => hud.boss('The Predator', foe.fraction, PRED.yieldAt));
    Object.assign(powers, { healDelay: 6, healRate: 4 });
    powers.regen = 1.0;
    z.updaters = z.updaters.filter((u) => u !== cbTick); // (her body language goes on in the ally's flight)
    const ally = (this.predAlly = new SapphireAlly({ scene: z.scene, powers, player, audio, rig: c, anim: ca, centre: PRED_AT.clone().add(V(0, 0, 4)), radius: 30, ground: (x, q) => z.ground(x, q) }));
    foe.ally = ally;
    const allyTick = (dt, t) => { ally.update(dt, t); cb.update(dt); };
    z.updaters.push(allyTick);
    this.predBarks(foe, ally);
    player.camDist = 3.4; // (back off it a little: at 2.3 m a fifteen-metre creature was a wall)
    player.shoulder = 0.6;
    powers.choose(0);
    foe.scripted = false;
    foe.engage();
    ally.start(foe);
    const gate = this.gateLight(z, true); // (the wardens close the stair behind them: on foot, no way out of it)
    this.giveControl('Drive the Predator back into its light');
    wait(2.5).then(() => this.ringSay('ringPred2'));
    await new Promise((resolve) => (foe.onYield = resolve));
    bar();
    hud.boss(null);
    hud.tutorialDone?.();
    hud.tutorial(null);
    Object.assign(powers, { healDelay: 4, healRate: 8, regen: 0 });
    player.camDist = 2.3;
    player.shoulder = 0.34;
    gate.open();
    await this.predEnd(foe, ally, z, [foeTick, allyTick]);
  }

  // A wall of their light across the stair's head, between the gate's crystals: shimmering, solid
  gateLight(z, on) {
    const w = 15, h = 9, at = V(0, PLAZA.y, GATE.z + 1.6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime, uK; varying vec2 vU;
        void main(){ float s = 0.55 + 0.45 * sin(vU.x * 40.0 + uTime * 2.0) * sin(vU.y * 23.0 - uTime * 1.3);
          float edge = smoothstep(0.0, 0.08, vU.y) * (1.0 - smoothstep(0.55, 1.0, vU.y)) * smoothstep(0.0, 0.04, vU.x) * smoothstep(0.0, 0.04, 1.0 - vU.x);
          gl_FragColor = vec4(vec3(0.85, 0.25, 1.1) * s * edge * uK * 0.42, 1.0); }`,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat);
    wall.position.copy(at);
    wall.renderOrder = 22;
    z.scene.add(wall);
    const body = z.physics.fixedBox({ x: at.x, y: at.y + h / 2, z: at.z }, { x: w / 2, y: h / 2, z: 0.25 });
    this.player.camIgnore?.add(body.collider(0).handle); // (the camera goes through it: it's light)
    const tick = (dt, t) => { mat.uniforms.uTime.value = t; };
    z.updaters.push(tick);
    this.audio.shimmer?.(0.6);
    tween(0.8, (k) => (mat.uniforms.uK.value = k), ease.inOut);
    return {
      open: () => {
        tween(0.8, (k) => (mat.uniforms.uK.value = 1 - k), ease.inOut).then(() => { wall.removeFromParent(); z.updaters = z.updaters.filter((u) => u !== tick); });
        z.physics.world.removeRigidBody(body);
      },
    };
  }

  // Out of the battery: a surge, the light cracking, and it comes out of it small and grows as it leaves the
  // light, gliding round the citadel and down onto the plaza before them; it lands and roars.
  async predEmerge(foe, z) {
    const { director, audio, engine } = this, g = engine.gradeUniforms;
    director.cut(PRED_HAL.clone().add(V(-5.5, 1.0, 7)), BATTERY.clone(), 52);
    director.move(PRED_HAL.clone().add(V(-6.5, 1.2, 8)), BATTERY.clone().add(V(0, -2, 0)), 1.4, ease.inOut, 54);
    await wait(1.2);
    z.surge = 1;
    audio.glass?.(1.2);
    audio.explosion?.(0.5);
    director.shake(0.4, 0.8);
    g.uFlashColor.value.setRGB(1.4, 0.4, 1.6);
    tween(0.9, (k) => (g.uFlash.value = 0.55 * (1 - k)), ease.out).then(() => { g.uFlash.value = 0; g.uFlashColor.value.setRGB(0.55, 1.6, 0.75); });
    foe.body.play('glide', { fade: 0 });
    foe.roar(1.2, 0.8);
    // round the citadel and down onto the plaza, the camera on it
    const path = new THREE.CatmullRomCurve3([BATTERY.clone(), BATTERY.clone().add(V(16, -9, 12)), PLAZA.clone().add(V(26, 13, -2)), PLAZA.clone().add(V(14, 6, 14)), PRED_AT.clone().add(V(3, 2.5, 4))]);
    const look = onFrame(() => director.look.lerp(foe.parts[1].tg.position, 0.12));
    let hovering = false;
    await tween(4.6, (k) => {
      const p = path.getPointAt(k), q = path.getPointAt(Math.min(1, k + 0.01));
      foe.root.position.copy(p);
      foe.yaw = Math.atan2(q.x - p.x, q.z - p.z);
      foe.root.scale.setScalar(0.25 + 0.75 * Math.min(1, k * 2.2));
      if (k > 0.72 && !hovering) { hovering = true; foe.body.play('hover', { fade: 0.6 }); }
    }, ease.inOut);
    // down
    foe.body.play('land', { fade: 0.35, loop: false });
    const from = foe.root.position.clone(), y0 = foe.yaw, y1 = yawTo(PRED_AT, PRED_HAL);
    director.move(PRED_HAL.clone().add(V(-4.5, 1.1, 3)), PRED_AT.clone().add(V(0, 2.4, 0)), 1.2, ease.inOut, 50);
    await tween(1.1, (k) => { foe.root.position.lerpVectors(from, PRED_AT, k); foe.yaw = y0 + wrap(y1 - y0) * k; }, ease.inOut);
    look();
    audio.impact?.(1.6);
    audio.rumble?.(0.9, 0.6);
    director.shake(0.6, 0.6);
    await wait(0.7);
    // the roar, low and close, before them
    foe.scripted = false;
    foe.faceYaw = y1;
    const roar = { kind: 'script' };
    foe.action = roar; // (holds the layers to what's set here)
    const pose = foe.body.pose;
    foe.head(_h);
    director.cut(_h.clone().add(V(Math.sin(y1) * 5 + 2.2, -0.6, Math.cos(y1) * 5)), _h.clone().add(V(0, 0.5, 0)), 42);
    foe.roar(1.4, 0.75);
    await tween(1.8, (k) => { const e = Math.sin(Math.PI * Math.min(1, k * 1.3)); pose.rear = 1.3 * e; pose.jaw = e; pose.wings = 0.8 * e; foe.body.glow(1 + e); }, ease.linear);
    foe.action = null;
    foe.body.glow(1);
  }

  // its tells' warnings, once each; Carol's calls
  predBarks(foe, ally) {
    const said = new Set();
    let last = 0;
    const carol = (key, gap = 4) => {
      const now = performance.now();
      if (this.predBarking || now - last < gap * 1000) return;
      this.predBarking = true;
      last = now;
      this.perform(this.zamCarolBody, key, [], { skip: false }).finally(() => (this.predBarking = false));
    };
    const ring = (key) => { if (said.has(key)) return; said.add(key); this.ringSay(key); };
    const hal = (key) => { if (said.has(key)) return; said.add(key); this.bark(key); };
    foe.onQuip = (what) => {
      if (what === 'tail') ring('ringQTail');
      else if (what === 'gust' && this.powers.shield) ring('ringQGust');
      else if (what === 'dive') ring('ringQDive');
      else if (what === 'parried') hal('halQParry');
    };
    foe.onHurtHal = (what) => { if (what === 'bite') hal('halQBit'); };
    foe.onPhase = (ph) => { if (ph === 'air') { ring('ringQAir'); wait(2.4).then(() => carol('carolQAir', 0)); } };
    foe.onTether = (what) => { if (what === 'start') wait(0.8).then(() => ring('ringQTether')); else if (what === 'drank') this.ringSay('ringQDrank'); };
    ally.onQuip = (what) => {
      if (what === 'pin') carol(Math.random() < 0.5 ? 'carolQPin' : 'carolQPin2', 3);
      else if (what === 'held') carol('carolQBeam', 0);
      else if (what === 'free') carol('carolQFree', 2);
      else if (what === 'up') carol('carolQUp', 2);
    };
  }

  // A fifth of it left: it comes down on the plaza, Carol's crystal on it; the battery's light comes down for
  // it and takes it back up; the seal holds; and her, beside him.
  async predEnd(foe, ally, z, ticks) {
    const { ui, director, audio, player, engine } = this, g = engine.gradeUniforms, c = this.zamCarol, ca = this.zamCarolAnim;
    this.takeControl();
    if (foe.flying) foe.crash();
    foe.endAction();
    foe.state = 'script';
    await Promise.race([waitFor(() => !foe.flying && foe.root.position.y - foe.ground(foe.root.position.x, foe.root.position.z) < 0.3), wait(2.5)]);
    foe.scripted = true;
    foe.action = { kind: 'script' };
    Object.assign(foe.body.pose, { rear: -0.4, jaw: 0.4, wings: 0, tailLift: 0, lunge: 0 });
    foe.body.pose.shake = 0.6;
    ally.holdDown();
    await this.touchDown();
    // Hal before it, a little way off; it down under her chains
    const at = foe.root.position.clone(), toHal = V(Math.sin(foe.yaw), 0, Math.cos(foe.yaw));
    const stand = at.clone().addScaledVector(toHal, 13);
    stand.y = z.ground(stand.x, stand.z);
    player.place(stand, yawTo(stand, at));
    player.lookAt(() => foe.parts[0].tg.position, 0.6);
    director.cut(stand.clone().add(V(Math.cos(foe.yaw) * 5, 2.2, 0)).addScaledVector(toHal, 3), at.clone().add(V(0, 2, 0)), 48);
    await wait(1.2);
    await this.npcClose(c, 1.0, 1, 32, ally.yaw); // (her rig is in the ally's frame: its own turn is nothing)
    await this.perform(this.zamCarolBody, 'carolPred3');
    await this.halClose(0.9);
    await this.say('halPred3');
    // the light comes down for it
    const shaft = createShaft({ from: BATTERY.clone().add(V(0, -8, 0)), to: at.clone(), radiusFrom: 2.4, radiusTo: 7, color: new THREE.Color(0.7, 0.16, 0.85) });
    z.scene.add(shaft);
    audio.rift?.(0.7);
    tween(1.2, (k) => (shaft.userData.uniforms.uOpacity.value = 0.45 * k), ease.inOut);
    const [w1] = this.wardensAt;
    await this.npcClose(w1.rig, 1.0);
    await this.perform(w1.body, 'ward7');
    // up into it
    director.cut(stand.clone().add(V(-Math.cos(foe.yaw) * 4, 1.1, 0)).addScaledVector(toHal, 4), at.clone().lerp(BATTERY, 0.4), 56);
    const look = onFrame(() => director.look.lerp(foe.parts[1].tg.position, 0.08));
    foe.body.play('hover', { fade: 0.8 });
    audio.whoosh?.(3, 0.5);
    audio.rumble?.(3.5, 0.5);
    const from = foe.root.position.clone();
    await tween(4.2, (k) => {
      foe.root.position.lerpVectors(from, BATTERY, k * k);
      foe.root.scale.setScalar(1 - 0.8 * k);
      foe.body.glow(1 + k * 2.5);
      shaft.userData.uniforms.uOpacity.value = 0.45 + 0.3 * k;
      if (k > 0.35 && ally.state === 'hold') { ally.stop(); ally.state = 'script'; }
    }, ease.inOut);
    look();
    z.surge = 1;
    audio.glass?.(1.1);
    audio.explosion?.(0.4);
    director.shake(0.35, 0.6);
    g.uFlashColor.value.setRGB(1.4, 0.4, 1.6);
    await tween(0.9, (k) => (g.uFlash.value = 0.6 * (1 - k)), ease.out);
    g.uFlash.value = 0;
    g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    foe.root.visible = false;
    tween(2.5, (k) => { shaft.userData.uniforms.uOpacity.value = 0.75 * (1 - k); z.unrest = 1 - k; }, ease.inOut).then(() => shaft.removeFromParent());
    this.ringGlow = 2.2;
    audio.ringChime?.();
    await this.say('ringPred3', { name: 'The ring' });
    this.ringGlow = 1.2;
    // she comes down beside him
    z.updaters = z.updaters.filter((u) => !ticks.includes(u));
    foe.dispose();
    this.pred = null;
    ally.release(z.scene);
    const land = stand.clone().add(V(Math.cos(player.yaw) * 1.6, 0, -Math.sin(player.yaw) * 1.6));
    land.y = z.ground(land.x, land.z);
    const cFrom = c.root.position.clone();
    ca.play(still(POSES.stand), 1.2);
    const cbTick = (dt) => this.zamCarolBody.update(dt);
    z.updaters.push(cbTick);
    player.lookAt(() => c.bonePosition('head', _r), 0.7);
    director.move(stand.clone().add(V(0, 1.6, 0)).addScaledVector(V(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)), 3).add(V(Math.cos(player.yaw) * 1.2, 0, -Math.sin(player.yaw) * 1.2)), land.clone().add(V(0, 1.4, 0)), 2.6, ease.inOut, 40);
    await tween(2.4, (k) => { c.root.position.lerpVectors(cFrom, land, k); c.root.rotation.y = yawTo(c.root.position, player.position); }, ease.inOut);
    ca.lookAt(this.headOf(player.rig), 0.7);
    player.turnTo(yawTo(player.position, land));
    await wait(0.6);
    await this.npcClose(c, 1.0, 1, 30);
    await this.perform(this.zamCarolBody, 'carolPred4', [['wanted', () => ca.gesture('tilt', 1, 0.4)]]);
    await this.halClose(0.9);
    await this.say('halPred4');
    await this.npcClose(c, 0.9, -1, 30);
    await this.perform(this.zamCarolBody, 'carolPred5', [['time', () => ca.gesture('nod', 1, 0.4)]]);
    await wait(0.8);
    z.updaters = z.updaters.filter((u) => u !== cbTick);
    await this.queenFarewell(z, stand, land);
  }

  // (Ours.) The queen comes over the plaza to them: the gem is Carol's now, and goes from her chest into a ring on
  // her hand; Carol asks for the Kept to be asked whether they'd stay; the ring charts the world; and the two of
  // them go up out of the valley, the wardens and the queen watching.
  async queenFarewell(z, stand, land) {
    const { director, player, audio, engine } = this, g = engine.gradeUniforms, q = this.queen, c = this.zamCarol, ca = this.zamCarolAnim;
    const cb = this.zamCarolBody, cbTick = (dt) => cb.update(dt);
    z.updaters.push(cbTick);
    const mid = stand.clone().lerp(land, 0.5);
    if (q) {
      // over from the dais, low, to them
      const to = mid.clone().add(V(Math.sin(player.yaw) * 3.6, 0.6, Math.cos(player.yaw) * 3.6));
      const from = q.rig.root.position.clone();
      q.hover = false;
      q.anim.lookAt(() => mid.clone().add(V(0, 1.6, 0)), 0.6);
      director.move(mid.clone().add(V(-Math.sin(player.yaw) * 4.5, 1.8, -Math.cos(player.yaw) * 4.5)).add(V(Math.cos(player.yaw) * 2, 0, -Math.sin(player.yaw) * 2)), to.clone().add(V(0, 1.4, 0)), 4.2, ease.inOut, 44);
      await tween(4.0, (k) => { q.rig.root.position.lerpVectors(from, to, ease.inOut(k)); q.rig.root.rotation.y = yawTo(q.rig.root.position, mid); }, ease.linear);
      q.base = to.y;
      q.hover = true;
      const qHead = () => q.rig.bonePosition('head', _r);
      player.lookAt(qHead, 0.7);
      ca.lookAt(qHead, 0.7);
      player.turnTo(yawTo(stand, to));
      const cy0 = c.root.rotation.y, cy1 = yawTo(land, to);
      tween(0.8, (k) => (c.root.rotation.y = cy0 + wrap(cy1 - cy0) * ease.inOut(k)));
      await this.npcClose(q.rig, 1.1, 1, 28, q.rig.root.rotation.y, 0.13);
      await this.perform(q.body, 'agF1', [['kept', 'open']]);
      // she looks at him for that
      ca.lookAt(this.headOf(player.rig), 0.8);
      await this.npcClose(c, 0.9, -1, 30, cy1);
      await this.perform(cb, 'carolF1', [['Two', () => ca.gesture('tilt', 1, 0.3)]]);
      ca.lookAt(qHead, 0.7);
      await this.npcClose(q.rig, 1.0, -1, 28, q.rig.root.rotation.y, 0.13);
      // the gem: out of her chest, into a ring on her right hand
      const chest = () => c.bonePosition('chest', _h).clone().add(V(0, 0.08, 0)), hand = () => c.bonePosition('hand_R', _h).clone();
      const say = this.perform(q.body, 'agF2', [['yours', 'open']]);
      await wait(2.2);
      director.move(land.clone().add(V(Math.sin(cy1) * 1.5 + Math.cos(cy1) * 0.6, 1.3, Math.cos(cy1) * 1.5 - Math.sin(cy1) * 0.6)), chest().lerp(hand(), 0.5), 1.4, ease.inOut, 34);
      ca.reach('R', () => chest().add(V(Math.sin(cy1) * 0.38, -0.25, Math.cos(cy1) * 0.38)), { rate: 3, pole: V(-0.4, -0.85, -0.3) });
      await wait(1.0);
      const mote = this.makeGem(chest(), z.scene);
      mote.set(1);
      mote.scale(0.7);
      audio.shimmer?.(0.9);
      await tween(1.1, (k) => { mote.head.position.lerpVectors(chest(), hand(), ease.inOut(k)); mote.scale(0.7 - 0.4 * k); }, ease.linear);
      mote.dispose();
      const ring = (this.carolRing ??= this.violetRing());
      ring.removeFromParent();
      this.attachRing(ring, c);
      audio.ringChime?.();
      g.uFlashColor.value.setRGB(1.2, 0.5, 1.6);
      tween(0.6, (k) => (g.uFlash.value = 0.18 * (1 - k)), ease.out).then(() => { g.uFlash.value = 0; g.uFlashColor.value.setRGB(0.55, 1.6, 0.75); });
      await wait(0.7);
      ca.reach('R', null, { rate: 3 });
      await say;
      // the Kept
      await this.npcClose(c, 1.0, 1, 30, cy1);
      await this.perform(cb, 'carolF2', [['garden', () => ca.gesture('chin', 1, 0.3)]]);
      await this.npcClose(q.rig, 0.9, 1, 28, q.rig.root.rotation.y, 0.13);
      await this.perform(q.body, 'agF3');
      await this.npcClose(c, 1.0, -1, 30, cy1);
      await this.perform(cb, 'carolF3', [['Every', 'stop'], ['home', 'open']]);
      await this.npcClose(q.rig, 1.1, -1, 28, q.rig.root.rotation.y, 0.13);
      await wait(0.6);
      await this.perform(q.body, 'agF4', [['asked', () => q.anim.gesture('nod', 1, 0.35)]]);
    }
    // the ring: the world, on its charts
    this.ringGlow = 2.4;
    audio.ringChime?.();
    this.save.update((d) => { d.worlds = [...new Set([...(d.worlds ?? []), 'zamaron'])]; });
    await this.halClose(1.0);
    await this.say('ringF1', { name: 'The ring' });
    this.ringGlow = 1.2;
    player.lookAt(() => c.bonePosition('head', _h), 0.8);
    await this.say('halF1');
    ca.lookAt(this.headOf(player.rig), 0.8);
    { const y0 = c.root.rotation.y, y1 = yawTo(c.root.position, player.position); await tween(0.7, (k) => (c.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k))); }
    await this.npcClose(c, 1.0, 1, 30, c.root.rotation.y);
    await this.perform(cb, 'carolF4');
    await this.halClose(0.9, -1);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halF2');
    z.updaters = z.updaters.filter((u) => u !== cbTick);
    await this.liftOff(z, stand, land);
  }

  // Up out of the valley, the two of them, side by side; from the plaza, the queen and the wardens watching
  async liftOff(z, stand, land) {
    const { director, player, audio, engine, powers } = this, g = engine.gradeUniforms, c = this.zamCarol, ca = this.zamCarolAnim, q = this.queen;
    this.playerActive = false;
    player.lookAt(null);
    ca.lookAt(null);
    player.animator.feet.ground = null;
    ca.feet.ground = null;
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object, p0 = o.position.clone(), c0 = c.root.position.clone();
    const yaw = player.yaw;
    o.rotation.set(0, yaw, 0);
    player.animator.play(still(POSES.hover, 0.4), 0.3);
    ca.play(still(POSES.hover), 0.5);
    for (const w of this.wardensAt) w.anim.lookAt(() => o.position.clone().add(V(0, 1.4, 0)), 0.6);
    if (q) q.anim.lookAt(() => o.position.clone().add(V(0, 1.4, 0)), 0.6);
    // from behind the queen, low: the two of them going up into the violet sky
    const cam = (q ? q.rig.root.position.clone() : p0.clone()).add(V(0, -0.2, 0)).lerp(p0, -0.25).add(V(1.4, 0.4, 0));
    director.cut(cam, p0.clone().lerp(c0, 0.5).add(V(0, 1.4, 0)), 50);
    audio.riser(1.2, 0.35);
    this.ringGlow = 3;
    c.glowUp(1.6);
    await wait(0.9);
    powers.takeoffFx?.();
    audio.whoosh(2.4, 0.6);
    const look = V(0, 0, 0);
    await tween(3.2, (k) => {
      const h = 60 * k * k;
      o.position.set(p0.x, p0.y + h, p0.z);
      c.root.position.set(c0.x, c0.y + h * 0.98 + Math.sin(k * 7) * 0.05, c0.z);
      look.copy(o.position).lerp(c.root.position, 0.5).add(V(0, 1.2, 0));
      director.look.lerp(look, 0.3);
      director.fov = 50 - 8 * k;
      if (k > 0.25) { player.animator.play(still(POSES.flyFast, 0.3), 0.4); }
    }, ease.linear);
    await tween(0.5, (k) => (g.uFlash.value = k * k), ease.linear);
    animStop();
    director.fov = 55;
    c.glowUp(1);
  }

  // Carol's ring: the Zamarons' violet, the gem set in it
  violetRing() {
    const r = createRing();
    const [metal, face] = r.userData.materials;
    metal.color.setRGB(0.62, 0.25, 0.95); metal.emissive.setRGB(0.5, 0.12, 0.85); metal.emissiveIntensity = 1.2;
    face.map = null; face.emissiveMap = null; face.color.setRGB(0.9, 0.5, 1); face.emissive.setRGB(0.75, 0.3, 1.0); face.emissiveIntensity = 1.4;
    face.needsUpdate = true;
    return r;
  }

  // ---------------------------------------------------------------- 9. the way home
  // (Ours.) Over Earth's night side out of the dark, side by side: what she sees up here, and her idea of a race
  // (the last one to the pier pays). Down over the sea west of Coast City at twenty to one, low over the water
  // to the pier's head, whoever's first; and on the deck, the light goes off both of them: the clothes they had
  // dinner in.
  async flyHome() {
    const { ui, director, audio, player, powers, engine } = this, g = engine.gradeUniforms;
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('return').clock);
    // (played on from Zamaron, the valley and the waterfront aren't built yet: under a loading screen)
    if (!this.ferrisScene || !this.pierReady) {
      ui.loadStart('Part Seven · The way home', [['props', 'Loading Coast City', 3], ['scene', 'Building the valley', 4], ['city', 'Building the waterfront', 3], ['shaders', 'Getting the light right', 3]]);
      await loadProps(FERRIS_PROPS, (k) => ui.loadStage('props', k));
      await this.setupFerrisAsync();
      await this.prepPier();
    }
    const f = this.ferrisScene;
    this.lanternUp();
    for (const id of ['hammer', 'staff', 'bubble']) this.learn(id, false);
    this.pierSet('night');
    this.pierWheel(false);
    ui.clock('12:40 AM');
    // Carol, in her light, her clothes under it for the pier; the gem in its ring on her hand
    const carol = this.addCarol(), ca = this.carolAnim;
    if (!carol) return;
    const sap = this.sapphireOn();
    sap.eyeGlow(0.3);
    sap.glowUp(1);
    carol.root.visible = true;
    const ring = (this.carolRing ??= this.violetRing());
    ring.removeFromParent();
    this.attachRing(ring, sap);
    const fly = (this.carolFly = { k: 0 });
    ca.play(sapFlight(fly), 0);
    ca.lookAt(null);
    ca.feet.ground = null;
    // (her root on a pivot at her hips, to lean into the flight: turned about the feet, she'd swing)
    const pivot = (this.carolPivot ??= new THREE.Group());
    f.scene.add(pivot);
    pivot.add(carol.root);
    carol.root.position.set(0, -carol.hipsHeight, 0);
    carol.root.rotation.set(0, 0, 0);
    // ---- over the night side
    await this.homeOrbit(pivot);
    // ---- over the sea, west of the city
    const START = V(-2140, 70, LOT.z + 364), FINISH = V(-1469.7, DECK + 2.2, LOT.z + 352.4);
    this.show(f);
    this.world = 'earth';
    f.scene.add(pivot);
    this.playerActive = true;
    powers.attach({ scene: f.scene, physics: f.physics, ground: (x, z) => (f.city?.onPier(x, z) ? DECK : 0), floor: (x, z) => (f.city?.onPier(x, z) ? DECK : 0.6),
      canLand: (x, z) => !!f.city?.onPier(x, z) || x > coastX(z) + 1, solid: f.city ? (x, y, z) => f.city.solidAt(x, y, z) : undefined, center: V(-1800, 0, LOT.z + 360), radius: 560, ceiling: 220 });
    f.focus(FINISH);
    this.ambience(audio.wind(0.06), audio.traffic(0.004));
    player.boostScale = 1.8;
    await this.arriveFlying(START, Math.PI / 2, V(16, -2, 0));
    player.animator.play(player.flightGen, 0.2);
    const path = new THREE.CatmullRomCurve3([START.clone().add(V(4, 0, 5)), V(-1960, 52, LOT.z + 372), V(-1720, 32, LOT.z + 366), V(-1560, 12, LOT.z + 356), V(-1500, DECK + 3, LOT.z + 353), PIER_CAROL.clone().add(V(0, 0.05, 0))]);
    const L = path.getLength();
    let s = 0, v = 6, done = null, t = 0;
    const place = () => {
      const u = Math.min(1, s / L), p = path.getPointAt(u), q = path.getPointAt(Math.min(1, u + 0.004));
      pivot.position.copy(p).add(V(0, carol.hipsHeight, 0));
      const d = q.sub(p);
      if (d.lengthSq() > 1e-6) pivot.rotation.set(-Math.atan2(d.y, Math.hypot(d.x, d.z)) * 0.6 + fly.k * 1.2, Math.atan2(d.x, d.z), 0, 'YXZ');
    };
    place();
    ui.fade(0, 0.4);
    powers.markerTarget = { pos: FINISH, label: 'The pier' };
    this.giveControl('Race her to the pier');
    this.hud.tutorial({ kicker: 'The way home', n: 1, of: 1, title: 'Last one pays', html: 'Race Carol to the pier: <b>Shift</b> to boost, the mouse to steer. Land on the pier’s head by the wheel.' });
    this.ringSay('ringR1');
    const said = new Set(), once = (k, fn) => { if (!said.has(k)) { said.add(k); fn(k); } };
    await new Promise((resolve) => {
      const stop = onFrame((dt) => {
        if (this.paused) return;
        t += dt;
        // her speed: away quick, a cruise he has to boost to beat, slowing to come down on the deck
        const left = L - s, want = left < 60 ? Math.max(5, left * 0.35) : t < 2.5 ? 18 : 27 + 3 * Math.sin(t * 0.4);
        v += (want - v) * Math.min(1, dt * 1.6);
        s = Math.min(L, s + v * dt);
        fly.k += ((left < 60 ? 0 : 1) - fly.k) * Math.min(1, dt * 1.5);
        place();
        const halLeft = player.position.distanceTo(FINISH), herLeft = left;
        if (t > 3.5) once('carolRq1', (k) => this.perform(this.cb, k, [], { skip: false }));
        if (t > 9 && herLeft < halLeft) once('halRq1', (k) => this.bark(k));
        if (t > 14 && herLeft < halLeft) once('carolRq2', (k) => this.perform(this.cb, k, [], { skip: false }));
        if (t > 19 && halLeft - herLeft > 120) once('carolRq3', (k) => this.perform(this.cb, k, [], { skip: false }));
        // whoever's first: him within reach of the deck by the wheel, or her down on it
        if (!done && (halLeft < 22 || (player.grounded && f.city?.onPier(player.position.x, player.position.z)))) done = 'hal';
        if (!done && s >= L - 0.5) done = 'carol';
        if (done) { stop(); resolve(); }
      });
    });
    this.hud.tutorialDone?.();
    this.hud.tutorial(null);
    powers.markerTarget = null;
    this.takeControl();
    this.raceWon = done === 'hal';
    // both of them down on the deck: in the dark, where they stood before dinner
    await ui.fade(1, 0.5);
    player.stopFlying?.(true);
    player.boostScale = 1;
    player.place(PIER_HAL.clone().add(V(0, 0.05, 0)), Math.PI / 2);
    player.ground = (x, z) => (f.city?.onPier(x, z) ? DECK : 0);
    pivot.remove(carol.root);
    f.scene.add(carol.root);
    carol.root.position.copy(PIER_CAROL);
    carol.root.rotation.set(0, -Math.PI / 2, 0);
    ca.play(this.carolLoco, 0);
    ca.feet.ground = (x, z) => (f.city?.onPier(x, z) ? DECK : 0);
    f.focus(PIER_HAL);
    await wait(0.4);
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    ca.lookAt(this.headOf(player.rig), 0.7);
    this.cb.lookHome = () => this.headOf(player.rig);
    director.cut(PIER_HAL.clone().add(V(-0.9, 1.75, -1.6)), PIER_CAROL.clone().add(V(0, 1.45, 0)), 38);
    await ui.fade(0, 0.6);
    if (this.raceWon) {
      await this.carolClose(1.0);
      await this.carolSay('carolRw1', [['off', () => this.carolAnim.gesture('shake', 1, 0.25)]]);
      await this.halClose(0.9);
      await this.say('halRw1');
    } else {
      await this.carolClose(1.0);
      await this.carolSay('carolRl1', [['Pay', 'open']]);
      await this.halClose(0.9);
      player.animator.gesture('shake', 0.8, 0.25);
      await this.say('halRl1');
    }
    // the light off them both: the suit into his clothes, hers into what she wore to dinner
    director.move(PIER_HAL.clone().lerp(PIER_CAROL, 0.5).add(V(0.2, 1.55, 3.6)), PIER_HAL.clone().lerp(PIER_CAROL, 0.5).add(V(0, 1.1, 0)), 1.4, ease.inOut, 40);
    await Promise.all([this.suitOff(1.6), this.sapphireDown(1.8)]);
    ring.removeFromParent();
    this.attachRing(ring, carol);
    await this.halClose(1.0);
    await this.say('halR3');
    await this.carolClose(1.0, -1, 30);
    await this.carolSay('carolR4', [['push', 'stop']]);
    await wait(0.4); // (and on into `wheel`)
  }

  // Over Earth's night side, the two of them: what she sees, and the race; then the dive.
  async homeOrbit(pivot) {
    const { director, audio, player, powers, engine } = this, g = engine.gradeUniforms, carol = this.carol, ca = this.carolAnim;
    this.playerActive = false;
    if (player.rb) player.removeFromPhysics();
    powers.detach();
    player.flying = false;
    player.autoAnim = false;
    player.lookAt(null);
    player.animator.reach('R', null);
    player.animator.reach('L', null);
    player.animator.lean.pitch = player.animator.lean.roll = player.animator.twist = 0;
    player.animator.feet.ground = null;
    player.pivot.quaternion.identity();
    const animStop = onFrame((dt) => player.animator.update(dt));
    const carolTick = onFrame((dt) => { this.cb.update(dt); ca.update(dt); }); // (the field's updaters, hers among them, only run while it's shown)
    const o = player.object;
    try {
      const space = (this.space ??= new Space());
      space.show('earth');
      for (const p of [space.earth, space.oa, space.ysmault, space.korugar, space.zamaron]) p.position.set(0, 0, 0);
      space.earth.position.set(0, 40, -120); // (the night side's curve ahead and below, as the voyage arrives)
      this.show(space);
      space.scene.add(o, pivot);
      o.position.set(0, 0, 0);
      o.rotation.set(0.12, Math.PI, 0, 'YXZ');
      space.anchor = o.position;
      space.drift.set(0, 0, -6);
      pivot.position.set(1.5, 0.95, 0.4);
      pivot.rotation.set(0.1, Math.PI - 0.12, 0, 'YXZ');
      this.carolFly.k = 0;
      player.animator.play(still(POSES.hover, 0.5), 0);
      director.cut(V(-2.4, 1.9, 4.2), V(0.6, -6, -60), 52);
      this.ui.loadEnd(); // (the first picture of the chapter: the loading screen goes, the flash fades it up)
      g.uFlash.value = 1;
      audio.arrive?.();
      await tween(1.0, (k) => (g.uFlash.value = 1 - k), ease.out);
      g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
      director.move(V(-1.9, 1.7, 3.4), V(0.6, -7, -60), 6, ease.inOut, 50);
      await wait(1.6);
      // her, looking down at it
      ca.lookAt(V(0, -40, -100), 0.6);
      const head = () => carol.bonePosition('head', _h);
      director.cut(head().clone().add(V(-0.5, 0.1, -1.4)), head().clone(), 32);
      director.move(head().clone().add(V(-0.45, 0.05, -1.25)), head().clone(), 4, ease.inOut, 30);
      await this.carolSay('carolR1');
      player.lookAt(() => carol.bonePosition('head', _h), 0.7);
      director.cut(V(0.6, 1.7, -1.6), V(0, 1.6, 0), 32);
      await this.say('halR1');
      ca.lookAt(() => player.rig.bonePosition('head', _r), 0.7);
      director.cut(head().clone().add(V(-0.6, 0.05, -1.3)), head().clone(), 30);
      await this.carolSay('carolR2', [['pays', () => ca.gesture('tilt', 1, 0.3)]]);
      director.cut(V(0.55, 1.7, -1.5), V(0, 1.6, 0), 32);
      await this.say('halR2');
      director.cut(head().clone().add(V(-0.55, 0.05, -1.3)), head().clone(), 30);
      await this.carolSay('carolR3');
      // the dive: head first at the planet, her a length ahead
      player.lookAt(null);
      ca.lookAt(null);
      player.flightState.k = 1;
      player.animator.play(player.flightGen, 0.4);
      director.cut(V(0.3, 1.9, 3.0), V(-12, -25, -60), 52);
      audio.whoosh(1.6, 0.8);
      const p0 = space.earth.position.clone(), c0 = pivot.position.clone();
      await tween(1.6, (k) => {
        o.rotation.set(0.12 + 1.6 * ease.inOut(Math.min(1, k * 2)), Math.PI, 0, 'YXZ');
        this.carolFly.k = Math.min(1, k * 2);
        pivot.position.copy(c0).add(V(0, -2.5 * k * k, -8 * k * k));
        pivot.rotation.set(0.1 + 1.3 * ease.inOut(Math.min(1, k * 2)), Math.PI - 0.12, 0, 'YXZ');
        space.earth.position.copy(p0).addScaledVector(V(0, 0.08, 1), k * k * 50);
        space.drift.set(0, -20 * k, -60 * k);
        director.fov = 52 + 20 * k * k;
      }, ease.linear);
      await tween(0.35, (k) => (g.uFlash.value = k), ease.in);
    } finally {
      animStop();
      carolTick();
      director.fov = 55;
      o.removeFromParent();
      pivot.removeFromParent();
      player.autoAnim = true;
    }
  }

  // Her violet light going off her, from the head down, into the clothes she came in (sapphireUp backwards).
  async sapphireDown(dur = 1.8) {
    const { audio } = this, carol = this.carol, sap = this.sap;
    if (!sap || sap.root.parent !== carol.root) return;
    const u = carol.u, su = sap.u;
    for (const m of carol.meshes) m.visible = true;
    for (const x of [u, su]) x.uEdgeColor.value.setRGB(2.6, 0.7, 3.4);
    u.uDissolveOn.value = 1; u.uDissolveSign.value = -1;
    su.uDissolveOn.value = 1; su.uDissolveSign.value = 1;
    sap.glowUp(2);
    audio.dissolve?.();
    await tween(dur, (k) => { u.uDissolve.value = -0.1 + k * 1.25; su.uDissolve.value = -0.1 + k * 1.25; }, ease.inOut);
    u.uDissolveOn.value = 0; su.uDissolveOn.value = 0;
    u.uDissolve.value = 0;
    this.carolAnim.removeRig?.(sap);
    sap.root.removeFromParent();
    this.cb.rig = carol;
    sap.glowUp(1);
  }

  // The pier's wheel: turning with its bulbs lit (the evening), or stopped and dark for the night
  pierWheel(on) {
    const w = this.ferrisScene?.city?.waterfront?.wheel;
    if (!w) return null;
    w.speed = on ? 0.045 : 0;
    w.lit = on ? 1 : 0;
    return w;
  }

  // ---------------------------------------------------------------- 10. the wheel
  // (Ours.) The pier's head at one in the morning: the table cleared, the wheel stopped and dark, the hot dog man
  // packing up. Two dogs and a pickle; her father's bench, and the rings quiet; and the wheel, which nobody's
  // there to run: the one construct she allows all night turns it, and they ride it to the top.
  async pierAtMidnight() {
    const { ui, director, audio, player, powers } = this;
    const f = this.setupFerris();
    this.takeControl();
    ui.objective(null);
    ui.clock(this.save.info('wheel').clock);
    if (!this.pierReady) { ui.loadStart('Part Seven · The pier', [['city', 'Building the waterfront', 3], ['shaders', 'Getting the light right', 3]]); await this.prepPier(); }
    await loadProps(['hotdog', 'dog']);
    const played = this.current === f && !!this.carol?.root.parent;
    if (!played) this.stagePier('night');
    else this.pierSet('night');
    ui.clock('12:58 AM');
    const carol = this.carol, ca = this.carolAnim, cb = this.cb;
    if (!carol) return;
    if (this.sap?.root.parent === carol.root) { this.carolAnim.removeRig?.(this.sap); this.sap.root.removeFromParent(); this.cb.rig = carol; }
    for (const m of carol.meshes) m.visible = true;
    carol.root.visible = true;
    const ring = (this.carolRing ??= this.violetRing());
    if (ring.parent !== carol.bones.hand_R) { ring.removeFromParent(); this.attachRing(ring, carol); }
    if (player.rig === this.suit) { this.player.setRig(this.hal); this.attachRing(this.ring, this.hal); powers.suited = false; player.speedScale = 1; }
    Object.assign(powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.ground = (x, z) => (f.city?.onPier(x, z) ? DECK : 0);
    ca.feet.ground = (x, z) => (f.city?.onPier(x, z) ? DECK : 0);
    // the table cleared, the wheel stopped and dark (a car at its foot), the stand by the wheel
    const d = this.buildDinner();
    d.served.visible = false;
    d.lit(false);
    d.solid();
    const wheel = this.pierWheel(false);
    if (wheel) { wheel.group.rotation.z = 0; for (const c of wheel.cars) c.rotation.z = 0; }
    const stand = this.hotdogStand();
    this.ambience(audio.wind(0.05), audio.traffic(0.004));
    // where they stood before dinner; the pier dark past them, the wheel's shape against the sky
    if (!played) { player.place(PIER_HAL.clone().add(V(0, 0.05, 0)), Math.PI / 2); carol.root.position.copy(PIER_CAROL); carol.root.rotation.y = -Math.PI / 2; }
    ca.play(this.carolLoco, 0);
    cb.stance(null);
    director.cut(V(-1430, DECK + 2.6, LOT.z + 345), V(-1458, DECK + 7, LOT.z + 368), 46);
    await ui.fade(0, 1.2);
    director.move(V(-1436, DECK + 2.2, LOT.z + 347), V(-1460, DECK + 4, LOT.z + 372), 5, ease.inOut, 44);
    await wait(1.4);
    // ---- the stand
    const follow = this.carolFollow();
    powers.markerTarget = { pos: stand.counter.clone().add(V(0, 0.6, 0)), label: 'The hot dog stand' };
    this.giveControl('Get something to eat');
    await new Promise((resolve) => { const it = f.interact({ position: stand.counter, radius: 2.2, look: stand.counter.clone().add(V(0, 0.3, 0)), label: 'Two hot dogs', action: async () => { it.enabled = false; await this.atTheStand(stand, follow); resolve(); } }); });
    // ---- the bench
    const BENCH = V(-1434, DECK, LOT.z + 355), seatHal = BENCH.clone().add(V(-0.42, 0, 0.04)), seatCarol = BENCH.clone().add(V(0.42, 0, 0.04));
    powers.markerTarget = { pos: BENCH.clone().add(V(0, 0.9, 0)), label: 'Her father’s bench' };
    this.giveControl('Sit with Carol');
    await new Promise((resolve) => { const it = f.interact({ position: BENCH.clone().add(V(0, 0, -0.9)), radius: 1.8, look: BENCH.clone().add(V(0, 0.5, 0)), label: 'Sit down', action: async () => { it.enabled = false; await this.onTheBench(seatHal, seatCarol, follow); resolve(); } }); });
    // ---- the wheel
    const base = wheel ? wheel.centre.clone().setY(DECK).add(V(2.4, 0, -4.6)) : BENCH.clone();
    follow.on = true;
    powers.markerTarget = { pos: base.clone().add(V(0, 1.5, 0)), label: 'The wheel' };
    this.giveControl('Turn the wheel');
    await new Promise((resolve) => { const it = f.interact({ position: base, radius: 2.4, look: wheel?.centre.clone() ?? base, label: 'Turn the wheel', action: async () => { it.enabled = false; await this.turnTheWheel(wheel, follow); resolve(); } }); });
    follow.stop();
  }

  // Hands resting on the thighs of a seated figure, by IK (a seated pose alone left them floating over the lap): the
  // wrist on top of each thigh nearer the hip than the knee, clear of it (the bone runs through its middle), a
  // little to the outside. Nearer the knee was out of reach for Carol's arms (43 cm, shoulder to wrist): straight,
  // they put her hands into her thighs at the hips. `off` takes them away again.
  handsOnLap(anim, rig, off = false) {
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      if (off) { anim.reach(side, null, { rate: 4 }); continue; }
      const t = V(0, 0, 0), a = V(0, 0, 0), b = V(0, 0, 0), out = V(0, 0, 0), sh = V(0, 0, 0), el = V(0, 0, 0), wr = V(0, 0, 0);
      // (as far down the thigh as the arm reaches easily: its length from the bones, 88% of it)
      rig.bonePosition(`upperArm_${side}`, sh); rig.bonePosition(`foreArm_${side}`, el); rig.bonePosition(`hand_${side}`, wr);
      const arm = sh.distanceTo(el) + el.distanceTo(wr);
      anim.reach(side, () => {
        rig.bonePosition(`thigh_${side}`, a);
        rig.bonePosition(`shin_${side}`, b);
        rig.bonePosition(`upperArm_${side}`, sh);
        out.set(sx, 0, 0).transformDirection(rig.root.matrixWorld);
        for (let k = 0.68; k >= 0.3; k -= 0.04) {
          t.copy(a).lerp(b, k).add(V(0, 0.15, 0)).addScaledVector(out, 0.02);
          if (t.distanceTo(sh) <= arm * 0.88) break;
        }
        return t;
      }, { rate: 6, pole: V(sx * 0.8, -0.3, -0.5) });
    }
  }

  // The stand: a cart under two umbrellas by the wheel's north legs, and its man, packing up (a Rocketbox man,
  // his voice the `vendor`'s). `counter` is where Hal stands to buy.
  hotdogStand() {
    if (this.stand) return this.stand;
    const f = this.ferrisScene, at = V(-1463, DECK, LOT.z + 381);
    const st = (this.stand = { at, counter: at.clone().add(V(0, 0, -1.05)), vendor: null });
    if (hasProp('hotdog')) {
      const cart = prop('hotdog');
      cart.position.copy(at);
      cart.rotation.y = Math.PI / 2; // (its long sides north and south: the deck's side to buy at, his to work it from)
      cart.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      f.scene.add(cart);
      f.smash.solid(cart, { stuff: 'metal' });
      st.cart = cart;
    }
    // its bulb, under the umbrellas: the one warm light left on the head
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.8, 0.55) }));
    bulb.position.copy(at).add(V(0.3, 2.05, 0));
    f.scene.add(bulb);
    st.light = f.lamps?.add(bulb, { color: 0xffc888, power: 6, reach: 9 });
    (async () => {
      const [gl] = await loadPeople(['male-adult-21']);
      if (!gl) return;
      const person = createPerson(gl, { seed: 9 });
      const rig = person.rig;
      rig.root.position.copy(at).add(V(0.2, 0, 0.95));
      rig.root.rotation.y = Math.PI;
      f.scene.add(rig.root);
      const anim = new Animator(rig), loco = new Locomotion(this.mocap);
      loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
      anim.play(loco, 0);
      anim.look.maxYaw = 0.8;
      const body = new BodyLanguage(rig, anim, { lookHome: null, scale: 1, reach: 0.55, shift: null, gestures: undefined });
      // wiping the counter down, slowly
      const wipe = V(0, 0, 0);
      anim.reach('R', () => wipe.copy(at).add(V(0.1 + Math.sin(this.engine.time * 1.3) * 0.25, 0.97, 0.42)), { rate: 4, pole: V(-0.5, -0.8, -0.2) });
      f.updaters.push((dt) => { body.update(dt); anim.update(dt); });
      st.vendor = { rig, anim, body, loco };
    })().catch(console.warn);
    return st;
  }

  // Carol a step behind his left shoulder wherever he walks (`on` false: she stays where she is)
  carolFollow() {
    const carol = this.carol, loco = this.carolLoco, player = this.player, f = this.ferrisScene;
    const ctl = { on: true, stop: null };
    const want = V(0, 0, 0);
    ctl.stop = onFrame((dt) => {
      if (!ctl.on || this.paused) { if (!ctl.on) loco.speed = 0; return; }
      const yaw = player.yaw, P = player.position;
      want.set(P.x + Math.cos(yaw) * 1.0 - Math.sin(yaw) * 0.5, carol.root.position.y, P.z - Math.sin(yaw) * 1.0 - Math.cos(yaw) * 0.5);
      const d = want.clone().sub(carol.root.position).setY(0), dist = d.length();
      if (dist > 0.6) {
        const sp = Math.min(1.6, dist * 0.9);
        carol.root.position.addScaledVector(d.normalize(), sp * dt);
        const y1 = Math.atan2(d.x, d.z), y0 = carol.root.rotation.y;
        carol.root.rotation.y = y0 + wrap(y1 - y0) * Math.min(1, dt * 5);
        loco.speed = sp;
      } else {
        loco.speed = Math.max(0, loco.speed - dt * 3);
        const y0 = carol.root.rotation.y;
        carol.root.rotation.y = y0 + wrap(yaw - y0) * Math.min(1, dt * 2);
      }
      carol.root.position.y = f.city?.onPier(carol.root.position.x, carol.root.position.z) ? DECK : carol.root.position.y;
    });
    return ctl;
  }

  async atTheStand(stand, follow) {
    const { director, player } = this, carol = this.carol, ca = this.carolAnim, cb = this.cb;
    this.takeControl();
    this.powers.markerTarget = null;
    follow.on = false;
    const at = stand.counter.clone();
    if (player.position.distanceTo(at) > 0.5) { player.walkTo(at, 1.3); await Promise.race([waitFor(() => player.position.distanceTo(at) < 0.4), wait(3)]); }
    player.turnTo(0);
    // her beside him
    const cAt = at.clone().add(V(1.0, 0, -0.35));
    const c0 = carol.root.position.clone();
    tween(Math.max(0.4, c0.distanceTo(cAt) / 1.2), (k) => { carol.root.position.lerpVectors(c0, cAt, k); this.carolLoco.speed = 1.2 * Math.min(1, k * 6, (1 - k) * 6); }, ease.linear).then(() => { this.carolLoco.speed = 0; carol.root.rotation.y = yawTo(cAt, stand.at); });
    const v = stand.vendor;
    const vHead = () => v?.rig.bonePosition('head', _r) ?? stand.at.clone().add(V(0, 1.7, 1));
    player.lookAt(vHead, 0.8);
    ca.lookAt(vHead, 0.6);
    v?.anim.lookAt(this.headOf(player.rig), 0.7);
    v?.anim.reach('R', null, { rate: 3 });
    director.cut(at.clone().add(V(-2.2, 1.45, -2.4)), stand.at.clone().add(V(0, 1.35, 0.3)), 42);
    await wait(0.8);
    // (the cameras off the cart's ends: from the deck its umbrellas' poles stand in front of whoever's behind it)
    const vClose = (side, dur = 1.0) => { const h = vHead().clone(); return director.move(h.clone().add(V(side * 1.9, -0.04, -0.75)), h.clone().add(V(0, -0.04, 0)), dur, ease.inOut, 30); };
    const two = (dur = 1.0) => { const m = player.position.clone().lerp(carol.root.position, 0.5); return director.move(m.clone().add(V(2.3, 1.55, -2.6)), m.clone().add(V(0, 1.45, 0.2)), dur, ease.inOut, 34); };
    const hClose = (side, dur = 0.9) => { const h = player.rig.bonePosition('head', V(0, 0, 0)); return director.move(h.clone().add(V(side * 1.8, -0.04, 0.75)), h.clone().add(V(0, -0.04, 0)), dur, ease.inOut, 30); };
    if (v) { await vClose(-1); await this.perform(v.body, 'vend1', [['dogs', 'open']]); } else await this.say('vend1');
    await hClose(-1);
    await this.say('halV1');
    if (v) { await vClose(1, 0.9); await this.perform(v.body, 'vend2'); } else await this.say('vend2');
    await hClose(1);
    player.animator.gesture('tilt', 0.8, 0.3);
    await this.say('halV2');
    ca.lookAt(this.headOf(player.rig), 0.7);
    await two(0.9);
    await this.carolSay('carolV1', [['paying', () => ca.gesture('nod', 1, 0.3)]]);
    // the dogs: one in his hand, one in hers
    const dogs = (this.dogs ??= [0, 1].map(() => (hasProp('dog') ? prop('dog') : new THREE.Group())));
    const hold = (dog, rig) => { const hnd = rig.bones.hand_R; hnd.add(dog); const sc = 1 / rig.root.scale.x; dog.position.copy(rig.arm.R.fore).multiplyScalar(0.07 * sc).add(V(0, -0.03 * sc, 0)); dog.quaternion.setFromUnitVectors(V(0, 0, 1), V(1, 0, 0)); dog.scale.setScalar(sc); };
    if (v) { await vClose(-1, 0.8); this.perform(v.body, 'vend3'); await wait(1.2); }
    hold(dogs[0], player.rig);
    hold(dogs[1], carol);
    v?.anim.lookAt(null);
    if (v) { const wipe = V(0, 0, 0); v.anim.reach('R', () => wipe.copy(stand.at).add(V(0.1 + Math.sin(this.engine.time * 1.3) * 0.25, 0.97, 0.42)), { rate: 3, pole: V(-0.5, -0.8, -0.2) }); }
    player.lookAt(null);
    ca.lookAt(this.headOf(player.rig), 0.6);
    follow.on = true;
  }

  // On the bench, side by side looking out to sea: the first half of dinner, the quiet, the rings; the wheel
  async onTheBench(seatHal, seatCarol, follow) {
    const { director, player } = this, carol = this.carol, ca = this.carolAnim, cb = this.cb;
    this.takeControl();
    this.powers.markerTarget = null;
    follow.on = false;
    await this.ui.fade(1, 0.5);
    // (hands on their thighs, the dogs on their knees)
    const BENCH_SIT = (hips) => still(makePose({ hy: 0.44 + 0.06 - hips, sx: 0.06, cx: 0.04, nx: -0.02, lLx: -1.56, kL: 1.5, lRx: -1.58, kR: 1.52, lLz: 0.08, lRz: -0.08, aL: [0.2, -0.75, 0.65], eL: 0.7, aR: [-0.2, -0.75, 0.65], eR: 0.7 }));
    // (the dogs eaten on the way over: their hands free on the bench)
    for (const dog of this.dogs ?? []) dog.removeFromParent();
    player.lookAt(null);
    player.autoAnim = false;
    player.place(seatHal.clone(), Math.PI);
    player.animator.play(BENCH_SIT(player.rig.hipsHeight), 0);
    this.handsOnLap(player.animator, player.rig);
    carol.root.position.copy(seatCarol);
    carol.root.rotation.y = Math.PI;
    this.carolLoco.speed = 0;
    cb.stance(null);
    ca.play(BENCH_SIT(carol.hipsHeight), 0);
    this.handsOnLap(ca, carol);
    const sea = V(-1434, DECK + 2, LOT.z + 290);
    player.lookAt(() => sea, 0.5);
    ca.lookAt(() => sea, 0.5);
    cb.lookHome = () => () => sea;
    const toHim = () => { ca.lookAt(this.headOf(player.rig), 0.75); cb.lookHome = () => this.headOf(player.rig); };
    const toHer = () => player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    const front = (rig, dx) => { const h = rig.bonePosition('head', V(0, 0, 0)); return director.move(h.clone().add(V(dx * 0.5, -0.05, -1.6)), h.clone().add(V(0, -0.03, 0)), 1.1, ease.inOut, 31); };
    // from behind them first: the two of them, the sea and the moon
    director.cut(seatHal.clone().lerp(seatCarol, 0.5).add(V(0.4, 1.9, 4.2)), seatHal.clone().lerp(seatCarol, 0.5).add(V(0, 0.8, -12)), 44);
    await this.ui.fade(0, 0.9);
    director.move(seatHal.clone().lerp(seatCarol, 0.5).add(V(0.3, 1.6, 3.0)), seatHal.clone().lerp(seatCarol, 0.5).add(V(0, 0.9, -12)), 5, ease.inOut, 42);
    await wait(2.4);
    await front(carol, 1);
    await this.carolSay('carolW1', [['first', () => ca.gesture('tilt', 1, 0.3)]]);
    toHer();
    await front(player.rig, -1);
    await this.say('halW1');
    toHim();
    await front(carol, 1);
    await this.carolSay('carolW2', [['me', () => ca.gesture('nod', 1, 0.3)]]);
    await front(player.rig, -1);
    await this.say('halW2');
    ca.lookAt(() => sea, 0.6);
    await front(carol, 0.6);
    await this.carolSay('carolW3');
    // the rings
    toHim();
    await this.carolSay('carolW4', [['ring', () => ca.gesture('tilt', 1, 0.3)]]);
    const ringAt = () => this.ring.getWorldPosition(_r);
    player.lookAt(ringAt, 0.7);
    await front(player.rig, -1);
    this.ringGlow = 1.6;
    await this.say('halW3');
    this.ringGlow = 0.15;
    const cr = this.carolRing?.userData.materials;
    await front(carol, 1);
    await this.carolSay('carolW5');
    if (cr) tween(0.8, (k) => { cr[0].emissiveIntensity = 1.2 * (1 - 0.85 * k); cr[1].emissiveIntensity = 1.4 * (1 - 0.85 * k); });
    toHer();
    // the wheel, over her shoulder: stopped, dark
    const wc = this.ferrisScene.city?.waterfront?.wheel?.centre ?? V(-1454, 22, LOT.z + 366);
    ca.lookAt(() => wc, 0.7);
    director.move(seatCarol.clone().add(V(1.3, 1.25, -1.1)), wc.clone().add(V(0, -4, 0)), 1.8, ease.inOut, 44);
    await wait(0.6);
    await this.carolSay('carolW6');
    toHim();
    await front(player.rig, -1);
    await this.say('halW4');
    await front(carol, 1);
    await this.carolSay('carolW7', [['nobody', () => ca.gesture('shake', 1, 0.25)]]);
    await front(player.rig, -0.6);
    await this.say('halW5');
    await front(carol, 1);
    await wait(0.5);
    await this.carolSay('carolW8', [['one', () => ca.gesture('nod', 1, 0.3)]]);
    // up, the two of them
    await this.ui.fade(1, 0.4);
    this.handsOnLap(player.animator, player.rig, true);
    this.handsOnLap(ca, carol, true);
    player.lookAt(null);
    player.place(seatHal.clone().add(V(0, 0, -0.75)), Math.PI);
    player.animator.play(player.locomotion ?? player.groundGen ?? still(POSES.stand), 0);
    player.autoAnim = true;
    carol.root.position.copy(seatCarol).add(V(0, 0, -0.75));
    ca.play(this.carolLoco, 0);
    cb.lookHome = () => this.headOf(player.rig);
    ca.lookAt(this.headOf(player.rig), 0.6);
    director.mode = 'follow';
    await this.ui.fade(0, 0.4);
    this.bark('halW6');
  }

  // The ring's light up to the wheel's hub: a gear of it there, meshed with the axle; the bulbs come on round the
  // rim; it brings a car down to them, they get in, and it takes them up, to the top, and holds them there.
  async turnTheWheel(wheel, follow) {
    const { director, player, audio, engine, ui } = this, g = engine.gradeUniforms, carol = this.carol, ca = this.carolAnim, cb = this.cb, f = this.ferrisScene;
    this.takeControl();
    this.powers.markerTarget = null;
    follow.on = false;
    if (!wheel) return;
    const hub = wheel.centre.clone(), base = player.position.clone();
    player.turnTo(yawTo(base, hub));
    player.lookAt(() => hub, 0.7);
    ca.lookAt(() => hub, 0.6);
    // his ring hand up at it
    const sh = V(0, 0, 0);
    player.animator.reach('R', () => { player.rig.bonePosition('upperArm_R', sh); return sh.add(hub.clone().sub(sh).normalize().multiplyScalar(0.62)); }, { pole: V(-0.4, -0.85, -0.3), rate: 4 });
    director.cut(base.clone().add(V(2.2, 1.0, 2.6)), hub.clone().add(V(0, -6, 0)), 50);
    this.ringGlow = 4;
    audio.riser?.(1.4, 0.3);
    await wait(1.0);
    // the gear: a wheel of green light round the hub, its teeth in the spokes
    const gear = this.wheelGear(hub);
    f.scene.add(gear.group);
    audio.constructForm?.();
    await tween(0.9, (k) => gear.form(k), ease.out);
    this.ringGlow = 2.2;
    // it turns: the bulbs come on, a few at a time round the rim
    director.move(hub.clone().setY(DECK).add(V(11.5, 1.4, -2.5)), hub.clone(), 3, ease.inOut, 54); // (from the east, the wheel's face: clear of its legs)
    let lit = 0;
    // (its bulbs at a little over half: a ride in among them at full, each was a sun in the bloom)
    const spin = onFrame((dt) => { gear.group.rotation.x = wheel.group.rotation.z; lit = Math.min(0.55, lit + dt * 0.3); wheel.lit = lit; });
    // half a turn, slow to start, to bring the car at the top down to them (car 4: at the top when the wheel's at 0)
    const k0 = wheel.group.rotation.z, k1 = k0 - Math.PI;
    await tween(6.5, (k) => { const r = k0 + (k1 - k0) * ease.inOut(k); wheel.group.rotation.z = r; for (const c of wheel.cars) c.rotation.z = -r; }, ease.linear);
    // the car at the bottom: the one whose angle plus the wheel's turn is straight down
    const car = wheel.cars.reduce((best, c) => (c.getWorldPosition(_r).y < best.getWorldPosition(_h).y ? c : best), wheel.cars[0]);
    this.ringGlow = 1.2;
    player.animator.reach('R', null, { rate: 3 });
    player.lookAt(null);
    // in: seated side by side on its bench, facing the city, him on its north end
    await ui.fade(1, 0.5);
    this.playerActive = false;
    player.removeFromPhysics();
    const animStop = onFrame((dt) => player.animator.update(dt));
    const o = player.object;
    // (sat up a little forward, thighs level on the seat, shins down to the floor; the hands on the thighs by IK)
    const SEAT_POSE = (hips, extra = {}) => makePose({ hy: 0.46 + 0.06 - hips, sx: 0.06, cx: 0.04, nx: -0.04, lLx: -1.56, kL: 1.5, lRx: -1.58, kR: 1.52, lLz: 0.07, lRz: -0.07, aL: [0.2, -0.75, 0.65], eL: 0.7, aR: [-0.2, -0.75, 0.65], eR: 0.7, ...extra });
    const SEAT = (hips) => still(SEAT_POSE(hips));
    car.add(o);
    o.position.set(-0.42, wheel.floor, wheel.seat.z);
    o.rotation.set(0, 0, 0);
    player.pivot.quaternion.identity();
    player.animator.feet.ground = null;
    player.animator.play(SEAT(player.rig.hipsHeight), 0);
    this.handsOnLap(player.animator, player.rig);
    car.add(carol.root);
    carol.root.position.set(0.42, wheel.floor, wheel.seat.z);
    carol.root.rotation.set(0, 0, 0);
    ca.feet.ground = null;
    ca.play(SEAT(carol.hipsHeight), 0);
    cb.stance(null);
    this.handsOnLap(ca, carol);
    // (riders face the car's +z: east, the city)
    const city = V(-900, 30, LOT.z + 366);
    player.lookAt(() => city, 0.4);
    ca.lookAt(() => city, 0.4);
    cb.lookHome = () => () => city;
    const mid = () => car.localToWorld(V(0, wheel.seat.y + 0.9, wheel.seat.z));
    // up: from the deck, looking up at them going
    director.cut(hub.clone().setY(DECK).add(V(9, 1.5, -1)), mid(), 50); // (from the deck east of it: under it the cars swing through)
    await ui.fade(0, 0.6);
    const look = onFrame(() => director.look.lerp(mid(), 0.2));
    const r0 = wheel.group.rotation.z, r1 = r0 - Math.PI;
    const ride = tween(16, (k) => { const r = r0 + (r1 - r0) * ease.inOut(k); wheel.group.rotation.z = r; for (const c of wheel.cars) c.rotation.z = -r; }, ease.linear);
    await wait(4);
    // alongside them, the city's lights coming up behind
    look();
    const beside = onFrame(() => { const m = mid(); director.pos.copy(m).add(V(4.0, 0.5, 3.2)); director.look.copy(m); });
    director.fov = 38;
    await wait(5.5);
    beside();
    await ride;
    spin();
    // the top: the two of them in profile against the city, from out over the sea
    const top = mid();
    director.cut(top.clone().add(V(3.4, 0.25, 1.5)), top.clone().add(V(0, -0.15, 0)), 36);
    director.move(top.clone().add(V(2.9, 0.2, 1.2)), top.clone().add(V(0, -0.15, 0)), 8, ease.inOut, 34);
    await wait(2.4);
    // a plane's lights, far off over the water, going in to land
    const plane = this.farPlane(top);
    ca.lookAt(() => plane.position, 0.6);
    await this.carolSay('carolW9', [['Dad', () => ca.gesture('tilt', 1, 0.3)]]);
    player.lookAt(() => plane.position, 0.6);
    await this.say('halW7');
    await wait(1.0);
    ca.lookAt(this.headOf(player.rig), 0.7);
    const hHead = () => player.rig.bonePosition('head', _h), cHead = () => carol.bonePosition('head', _r);
    director.move(cHead().clone().add(V(1.45, -0.05, -0.45)), cHead().clone(), 1.4, ease.inOut, 30);
    await this.carolSay('carolW10', [['true', () => ca.gesture('nod', 1, 0.25)], ['afraid', () => ca.gesture('tilt', 1, 0.3)]]);
    player.lookAt(cHead, 0.8);
    director.move(hHead().clone().add(V(1.45, -0.05, 0.45)), hHead().clone(), 1.2, ease.inOut, 30);
    await this.say('halW8');
    director.move(cHead().clone().add(V(1.45, -0.05, -0.45)), cHead().clone(), 1.0, ease.inOut, 30);
    await this.carolSay('carolW11');
    // she leans in to him; and away, the wheel lit over the water, the city behind
    ca.play(still(SEAT_POSE(carol.hipsHeight, { sz: 0.12, cz: 0.06, kz: 0.22 })), 1.6);
    const w = top.clone();
    director.cut(w.clone().add(V(-6, 0.6, -1.5)), w.clone(), 36);
    await tween(9, (k) => { const e = ease.inOut(k); director.pos.copy(w).add(V(-6 - 140 * e, 0.6 - 10 * e, -1.5 - 30 * e)); director.look.copy(w).add(V(0, -14 * e, 0)); director.fov = 36 + 8 * e; }, ease.linear);
    await ui.fade(1, 1.6);
    // (their hands off their laps again: left on, Hal walked into the hangar next morning with his arms pulled to his thighs)
    this.handsOnLap(player.animator, player.rig, true);
    this.handsOnLap(ca, carol, true);
    animStop();
    plane.removeFromParent();
    gear.dispose();
    director.fov = 55;
  }

  // A gear of green light on the wheel's hub, square to its axle (east-west): its rim, its teeth, its spokes
  wheelGear(hub) {
    const parts = [new THREE.TorusGeometry(2.4, 0.16, 8, 48)];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push(new THREE.BoxGeometry(0.34, 0.5, 0.3).translate(0, 2.6, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(a))); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(new THREE.BoxGeometry(0.12, 2.3, 0.12).translate(0, 1.2, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(a))); }
    parts.push(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 20).rotateX(Math.PI / 2));
    const geo = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
    const mesh = constructMesh(geo, { outline: 0.03 });
    const group = new THREE.Group();
    mesh.rotation.y = Math.PI / 2; // (its face east-west, along the axle)
    group.add(mesh);
    group.position.copy(hub).add(V(2.3, 0, 0));
    return {
      group,
      form: (k) => { group.scale.setScalar(Math.max(0.01, k)); mesh.userData.set('uOpacity', 0.85 * k); },
      dispose: () => { group.removeFromParent(); geo.dispose(); },
    };
  }

  // a plane's lights a long way off over the sea, red and white blinking, on a line in toward the airport
  farPlane(near) {
    const f = this.ferrisScene, g = new THREE.Group();
    const tex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.2)');
    const mk = (c) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); sp.scale.setScalar(5); g.add(sp); return sp; };
    const red = mk(0xff3030), white = mk(0xffffff);
    red.position.set(-9, 0, 0); white.position.set(9, 0, 0);
    const from = near.clone().add(V(-900, 120, -1300)), to = near.clone().add(V(-500, 60, 1500));
    g.position.copy(from);
    f.scene.add(g);
    let t = 0;
    const stop = onFrame((dt) => { t += dt; g.position.lerpVectors(from, to, Math.min(1, t / 60)); white.material.opacity = t % 1.2 < 0.12 ? 1 : 0.05; red.material.opacity = 0.6 + 0.4 * Math.sin(t * 3); });
    g.userData.stop = stop;
    const rm = g.removeFromParent.bind(g);
    g.removeFromParent = () => { stop(); return rm(); };
    return g;
  }

  // ---------------------------------------------------------------- 11. the morning after
  // (Ours.) Hangar Two, the morning after: she's back at the second airframe as if nothing happened, the violet
  // ring on her hand. She doesn't date employees. So he's fired. Seven o'clock; he's rehired Monday.
  async morningAfter() {
    const { ui, director, audio, player, powers } = this;
    this.takeControl();
    ui.objective(null);
    if (!this.ferrisScene) { ui.loadStart('Part Seven · The morning after', [['props', 'Loading Coast City', 3], ['scene', 'Building the valley', 4], ['shaders', 'Getting the light right', 2]]); await loadProps(FERRIS_PROPS, (k) => ui.loadStage('props', k)); await this.setupFerrisAsync(); }
    const f = this.setupFerris(), cock = this.cockpitOf(f);
    ui.clock(this.save.info('hangar').clock);
    f.day?.();
    this.pierMode = 'day';
    this.pierLamps('day');
    this.pierWheel(true);
    if (player.rig === this.suit) { player.setRig(this.hal); this.attachRing(this.ring, this.hal); powers.suited = false; player.speedScale = 1; }
    Object.assign(powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    for (const dog of this.dogs ?? []) dog.removeFromParent();
    // (whatever the night left on their arms, off: a seat's or a rail's IK)
    for (const side of ['L', 'R']) player.animator.reach(side, null, { rate: 30 });
    player.animator.freeze = false;
    player.pivot.quaternion.identity();
    const carol = this.addCarol(), ca = this.carolAnim, cb = this.cb;
    if (carol) {
      for (const side of ['L', 'R']) ca.reach(side, null, { rate: 30 });
      if (carol.root.parent !== f.scene) f.scene.add(carol.root);
      carol.root.visible = true;
      for (const m of carol.meshes) m.visible = true;
      carol.root.position.copy(CAROL_IN);
      carol.root.rotation.set(0, yawTo(CAROL_IN, AIRFRAME), 0);
      ca.play(this.carolLoco, 0);
      ca.feet.ground = () => 0;
      ca.lookAt(cock, 0.5);
      cb.lookHome = () => () => cock;
      cb.stance('hip');
      const ring = (this.carolRing ??= this.violetRing());
      if (ring.parent !== carol.bones.hand_R) { ring.removeFromParent(); this.attachRing(ring, carol); }
      const cr = ring.userData.materials;
      cr[0].emissiveIntensity = 0.35; cr[1].emissiveIntensity = 0.45; // (quiet: daylight, a ring)
    }
    this.enterFerris(HANGAR_MOUTH.clone().add(V(0, 0, -9)), 0);
    this.ambience(audio.wind(0.03));
    f.focus(V(0, 0, 12));
    await ui.fade(0, 0.9);
    this.giveControl('Carol’s in Hangar Two');
    await waitFor(() => player.position.distanceTo(CAROL_IN) < 4.6);
    this.takeControl();
    const stand = CAROL_IN.clone().add(V(-0.5, 0, -2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    player.turnTo(yawTo(stand, CAROL_IN));
    f.focus(CAROL_IN);
    if (!carol) return;
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    ca.lookAt(this.headOf(player.rig), 0.6);
    cb.lookHome = () => this.headOf(player.rig);
    await this.overHal(1.6);
    await this.carolSay('carolAsk1');
    { const y0 = carol.root.rotation.y, y1 = yawTo(CAROL_IN, stand); await tween(1.0, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k))); }
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.8, 0.3);
    await this.say('halAsk1');
    await this.carolClose(1.1);
    cb.stance(null);
    await this.carolSay('carolM1');
    await this.halClose(0.9, -1);
    await this.say('halM1');
    await this.carolClose(1.1, -1, 30);
    await this.carolSay('carolM2', [['thinking', () => ca.gesture('tilt', 1, 0.3)], ['employees', 'stop']]);
    await this.halClose(0.9);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halM2');
    await this.carolClose(1.0, 1, 30);
    await this.carolSay('carolM3', [['fired', () => ca.gesture('nod', 1, 0.3)]]);
    await this.halClose(0.8, -1);
    await this.say('halM3');
    await this.carolClose(1.1, 1, 28);
    await this.carolSay('carolM4', [['Seven', 'open'], ['Monday', () => ca.gesture('chin', 1, 0.3)]]);
    await this.halClose(0.9);
    player.animator.gesture('nod', 0.8, 0.35);
    await this.say('halM4');
    // he goes; and her, back at her work, the ring on her hand catching the light from the hangar door
    ca.lookAt(cock, 0.5);
    cb.lookHome = () => () => cock;
    player.lookAt(null);
    director.cut(CAROL_IN.clone().add(V(-2.4, 1.45, -3.4)), HANGAR_MOUTH.clone().add(V(0, 1.3, 1)), 38);
    const out = HANGAR_MOUTH.clone().add(V(0, 0, -2.5));
    const leave = player.walkTo(out, player.walkSpeed);
    await leave;
    { const y0 = carol.root.rotation.y, y1 = yawTo(CAROL_IN, AIRFRAME); await tween(0.9, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k))); }
    const handAt = () => carol.bonePosition('hand_R', _r);
    const held = V(0, 0, 0);
    ca.reach('R', () => held.copy(carol.bonePosition('chest', _h)).add(V(Math.sin(carol.root.rotation.y) * 0.4, -0.02, Math.cos(carol.root.rotation.y) * 0.4)), { rate: 2.5, pole: V(-0.4, -0.85, -0.3) });
    ca.lookAt(handAt, 0.85);
    const c = carol.bonePosition('head', _h).clone(), to = V(Math.sin(carol.root.rotation.y), 0, Math.cos(carol.root.rotation.y)), side = V(to.z, 0, -to.x);
    director.cut(c.clone().addScaledVector(to, 1.4).addScaledVector(side, 0.45).add(V(0, -0.28, 0)), c.clone().add(V(0, -0.3, 0)), 38);
    await wait(1.2);
    const cr = this.carolRing.userData.materials;
    audio.ringChime?.();
    await tween(1.6, (k) => { const e = Math.sin(Math.PI * k); cr[0].emissiveIntensity = 0.35 + 1.4 * e; cr[1].emissiveIntensity = 0.45 + 1.6 * e; }, ease.linear);
    await this.carolSay('carolAsk10');
    ca.reach('R', null, { rate: 2 });
    await wait(1.0);
    await ui.fade(1, 1.2);
  }

  // ---------------------------------------------------------------- 12. Black Hand
  // The sting (Secret Origin's William Hand picks up the weapon Atrocitus left behind; his family's mortuary is the
  // comics'; the room and what he says are ours): two in the morning under the Hand family's funeral home, the
  // heart of Atrocitus's machine on the steel table, and it drinks the room's lamps one at a time, until the only
  // light left is on his hand. His father calls down the stairs. Then the end of Part Seven.
  async blackHand() {
    const { ui, director, audio, player, engine } = this, g = engine.gradeUniforms;
    this.takeControl();
    ui.objective(null);
    ui.clock('COAST CITY · 2:12 AM');
    await loadProps(MORTUARY_PROPS, (k) => ui.loadStage('props', k));
    ui.loadStage('scene', 0.3);
    const m = (this.mortuary ??= new Mortuary({ engine }).build());
    ui.loadStage('scene', 1);
    this.show(m);
    this.world = 'earth';
    this.playerActive = false;
    player.spawn(m.physics, m.scene, V(0, 0, -30), 0);
    player.object.visible = false;
    this.ambience(audio.hum?.(0.03) ?? audio.wind(0.005));
    // him, at the table, over it; his hands on its edge
    const gl = this.assets.characters.hand;
    let hand = null, ha = null, hb = null;
    if (gl) {
      hand = createWilliamHand(gl);
      hand.root.position.copy(MORT_HAND_AT);
      hand.root.rotation.y = -Math.PI / 2; // (facing west, over the table)
      m.scene.add(hand.root);
      hand.root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.twin; o.receiveShadow = true; } }); // (a scan's shadow is its twin's: characters/Rig.js)
      ha = new Animator(hand);
      const loco = new Locomotion(this.mocap);
      loco.scale = hand.hipsHeight / this.mocap.hipsHeight;
      loco.relax.adduct = 0.08;
      ha.look.maxYaw = 0.8;
      hb = new BodyLanguage(hand, ha, { lookHome: null, scale: 1, reach: 0.55, shift: null, gestures: undefined });
      this.william = { rig: hand, anim: ha, body: hb, loco };
      // leaning over the table on his hands, its edge under them, his head down to the heart (standing straight, his
      // arms reached down to a table at his thighs). Facing west his left is north: +z
      ha.play(still(makePose({ sx: 0.3, cx: 0.2, nx: 0.12, kx: 0.14, lLx: 0.04, lRx: 0.06, kL: 0.04, kR: 0.06, lLz: 0.03, lRz: -0.03 }), 0.6), 0);
      const L = V(0, 0, 0), R = V(0, 0, 0);
      ha.reach('L', () => L.set(MORT_HAND_AT.x - 0.5, MORT_TABLE_TOP + 0.03, MORT_HAND_AT.z + 0.27), { rate: 30, pole: V(0.7, -0.6, -0.4) });
      ha.reach('R', () => R.set(MORT_HAND_AT.x - 0.5, MORT_TABLE_TOP + 0.03, MORT_HAND_AT.z - 0.27), { rate: 30, pole: V(-0.7, -0.6, -0.4) });
      ha.lookAt(() => m.heart.position, 0.7);
      m.updaters.push((dt) => { hb.update(dt); ha.update(dt); });
    }
    await this.warmUp(m.scene, null, [m.scene], (k) => ui.loadStage('shaders', k));
    g.uFlash.value = 0;
    g.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    const face = () => hand?.bonePosition('head', _h) ?? MORT_HAND_AT.clone().add(V(0, 1.6, 0));
    // the room from the door: the hum, the drawers, the table under its lights, him over it
    director.cut(MORT_STAIRS.clone().add(V(-0.3, 1.85, -0.5)), MORT_TABLE.clone().add(V(0, 0.9, 0)), 50);
    await ui.fade(0, 1.6);
    director.move(MORT_STAIRS.clone().add(V(-0.7, 1.75, -1.2)), MORT_TABLE.clone().add(V(-0.2, 1.0, 0)), 6, ease.inOut, 46);
    await wait(3.2);
    // the heart, between his hands
    director.cut(m.heart.position.clone().add(V(-0.55, 0.32, 0.5)), m.heart.position.clone(), 30);
    director.move(m.heart.position.clone().add(V(-0.42, 0.26, 0.4)), m.heart.position.clone(), 4, ease.inOut, 28);
    await wait(1.8);
    // him, from across the table
    const across = () => { const h = face(); return director.move(h.clone().add(V(-1.3, 0.04, -0.4)), h.clone().add(V(0, -0.06, 0)), 1.2, ease.inOut, 30); };
    await across();
    if (hb) await this.perform(hb, 'handW1', [['paper', () => ha.gesture('tilt', 1, 0.25)]]); else await this.say('handW1');
    // the drawers, over his shoulder
    ha?.lookAt(() => V(ROOM.x1 - 0.5, 1.2, 0.1), 0.6);
    director.move(face().clone().add(V(-0.85, 0.1, 0.55)), V(ROOM.x1 - 0.5, 1.1, 0.1), 1.4, ease.inOut, 40);
    if (hb) await this.perform(hb, 'handW2'); else await this.say('handW2');
    ha?.lookAt(() => m.heart.position, 0.7);
    // it wakes: a beat in it, and the first light goes, drawn down into it
    const drink = async (i, dur = 1.6) => {
      const l = m.lamps[i];
      audio.buzz?.(0.4);
      // the flicker
      await tween(0.9, (k) => m.setLamp(i, Math.sin(k * 40) > 0.2 ? 1 - 0.4 * k : 0.15), ease.linear);
      // its light in a stream down into the heart
      const motes = this.lightStream(m, l.at, m.heart.position, dur);
      await tween(dur, (k) => { m.setLamp(i, (1 - k) * 0.6); m.drink(Math.min(1, (m.drunk ?? 0) + 0.004)); }, ease.inOut);
      m.setLamp(i, 0);
      await motes;
      audio.heartbeat?.(0.5);
      m.heartLight.intensity = 3.2;
      tween(0.8, (k) => (m.heartLight.intensity = 3.2 - 1.6 * k), ease.out);
    };
    director.cut(m.heart.position.clone().add(V(-0.9, -0.05, -0.9)), m.lamps[0].at.clone().lerp(m.heart.position, 0.35), 44);
    audio.heartbeat?.(0.3);
    await drink(0);
    m.drink(0.35);
    await across();
    if (hb) await this.perform(hb, 'handW3', [['like', () => ha.gesture('tilt', 1, 0.3)]]); else await this.say('handW3');
    // the second, the room half dark
    director.cut(MORT_TABLE.clone().add(V(-2.4, 1.6, 2.2)), MORT_TABLE.clone().add(V(0, 1.2, 0)), 46);
    await drink(1, 1.4);
    m.drink(0.7);
    await across();
    if (hb) await this.perform(hb, 'handW4'); else await this.say('handW4');
    // the desk lamp, last
    director.cut(m.heart.position.clone().add(V(-1.2, 0.6, 1.7)), m.lamps[2].at.clone().lerp(m.heart.position, 0.5), 44);
    await drink(2, 1.2);
    m.drink(1);
    // he takes it up: in his right hand, palm up, the only light in the room; up off the table, his left hand
    // from its edge
    if (ha) {
      const held = V(0, 0, 0);
      ha.reach('R', () => held.copy(m.heart.position).add(V(0.02, 0.03, 0)), { rate: 3, pole: V(-0.7, -0.6, -0.4) });
      await wait(1.0);
      const cup = this.palmUp(hand, ha, 'R', 0.08);
      const w0 = m.heart.position.clone(), to = V(0, 0, 0);
      await tween(0.5, (k) => { cup.at(to); m.heart.position.lerpVectors(w0, to, ease.inOut(k)); }, ease.linear);
      cup.hold(m.heart);
      ha.reach('L', null, { rate: 3 });
      ha.play(this.william.loco, 1.2);
      const up = V(0, 0, 0);
      ha.reach('R', () => up.copy(MORT_HAND_AT).add(V(-0.34, 1.12, -0.12)), { rate: 2, pole: V(-0.7, -0.7, -0.3) });
      ha.lookAt(() => m.heart.getWorldPosition(_r), 0.8);
    }
    m.heartLight.intensity = 1.4;
    await wait(0.6);
    // his face, from below, by it
    const lowFace = () => { const h = face(); return director.move(h.clone().add(V(-0.85, -0.42, 0.3)), h.clone(), 1.6, ease.inOut, 32); };
    await lowFace();
    await wait(1.4);
    // upstairs, the door: his father
    m.stairLight.material.color.setRGB(1.1, 0.85, 0.5);
    audio.door?.(0.3);
    await this.say('handDad1');
    m.stairLight.material.color.setRGB(0.55, 0.42, 0.26);
    ha?.lookAt(() => MORT_STAIRS.clone().add(V(0, 1.8, 0)), 0.5);
    if (hb) await this.perform(hb, 'handW5'); else await this.say('handW5');
    ha?.lookAt(() => m.heart.getWorldPosition(_r), 0.8);
    await wait(0.8);
    { const hp = m.heart.getWorldPosition(V(0, 0, 0)); director.move(hp.clone().lerp(face(), 0.5).add(V(-1.15, -0.05, 0.4)), hp.clone().lerp(face(), 0.5), 2.4, ease.inOut, 30); }
    if (hb) await this.perform(hb, 'handW6'); else await this.say('handW6');
    // and out: the last of it, black
    await tween(1.4, (k) => { m.heartLight.intensity = 1.4 * (1 - k); m.heartGlow.material.opacity = 0.5 * (1 - k); }, ease.inOut);
    await ui.fade(1, 0.6);
    await wait(1.2);
    await this.partSevenEnd();
  }

  // A hand turned palm up (after its arm's IK, each frame: Coast.holdInHand's way, the scans having no finger bones),
  // fingers along where the body faces; `at(out)` is the world point `lift` above the palm, `hold(obj)` sets obj
  // there in the hand
  palmUp(rig, anim, side, lift) {
    const hand = rig.bones[`hand_${side}`], palm = rig.palm(side);
    const Lt = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(palm.along, palm.normal), palm.along, palm.normal).transpose();
    const N = V(0, 1, 0), A = V(0, 0, 0), C = V(0, 0, 0), mm = new THREE.Matrix4(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
    const w = { k: 0 };
    tween(0.4, (k) => (w.k = k), ease.inOut);
    anim.post = () => {
      const yaw = rig.root.rotation.y;
      A.set(Math.sin(yaw), 0, Math.cos(yaw)).addScaledVector(V(Math.cos(yaw), 0, -Math.sin(yaw)), side === 'R' ? 0.35 : -0.35).normalize(); // (fingers forward, a little in)
      C.crossVectors(A, N);
      qw.setFromRotationMatrix(mm.makeBasis(C, A, N).multiply(Lt));
      hand.parent.getWorldQuaternion(qp).invert();
      hand.quaternion.slerp(qp.multiply(qw), w.k);
      hand.updateMatrixWorld(true);
    };
    // (Rig.palm's normal points out of the palm, so the palm's face is `surface` along it)
    return {
      at: (out) => out.copy(palm.centre).addScaledVector(palm.normal, palm.surface + lift).applyMatrix4(hand.matrixWorld),
      hold: (obj) => { hand.add(obj); obj.position.copy(palm.centre).addScaledVector(palm.normal, palm.surface + lift); obj.quaternion.identity(); obj.scale.setScalar(1 / rig.root.scale.x); },
      release: () => { anim.post = null; },
    };
  }

  // the light out of a lamp, a stream of motes down into the heart
  lightStream(m, from, to, dur) {
    const tex = (this.moteTex ??= glowTexture('rgba(255,255,255,1)', 'rgba(220,230,255,0.3)'));
    const motes = Array.from({ length: 22 }, (_, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xeef2ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      sp.scale.setScalar(0.06);
      m.scene.add(sp);
      return { sp, d: i / 22, wob: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.25) };
    });
    return tween(dur + 0.6, (k) => {
      for (const o of motes) {
        const u = Math.min(1, Math.max(0, k * 1.6 - o.d * 0.6));
        o.sp.position.lerpVectors(from, to, u * u).addScaledVector(o.wob, Math.sin(Math.PI * u));
        o.sp.material.opacity = Math.sin(Math.PI * u) * 0.9;
        o.sp.material.color.setRGB(0.93 + 0.07 * (1 - u), 0.95 - 0.7 * u, 1 - 0.75 * u);
      }
    }, ease.linear).then(() => { for (const o of motes) { o.sp.removeFromParent(); o.sp.material.dispose(); } });
  }

  // The end of Part Seven (Part Eight, Black Hand's, is still to come)
  async partSevenEnd() {
    const { ui } = this;
    const pick = await ui.screen({ kicker: 'Part Seven · Sapphire', title: 'THE END', subtitle: 'of Part Seven', body: 'Carol came home herself, the gem hers, and nobody’s queen. Zamaron is on the star chart now. And under a funeral home in Coast City, William Hand has found a use for what Atrocitus left behind. Part Eight, his story, is still to come.', buttons: ['Free roam', 'Quit to title'] });
    if (pick === 0) { RoamSave.resumeAfterReload('world'); await new Promise(() => {}); return; }
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  }

  // The second airframe's cockpit, found on its hidden canopy (the airframe's own pose is the scene's:
  // Ferris.js), so the glint and her eyes' line go where the open cockpit is
  cockpitOf(f) {
    let at = null;
    f.scene.traverse((o) => { if (!at && o.isMesh && !o.visible && /Cabin_Glass/.test(o.name)) { o.updateWorldMatrix(true, false); at = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()); } });
    return at ?? COCKPIT.clone();
  }

  // A point of violet light in the dark of a cockpit, there and gone: the gem, a long way off, looking.
  async violetGlint(at) {
    const { audio } = this, f = this.ferrisScene;
    const mat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(170,80,255,0.35)'), color: 0xb36bff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const sp = new THREE.Sprite(mat); // (drawn over the access stand that stands in the cockpit's way, from where the camera is)
    sp.renderOrder = 10;
    sp.position.copy(at);
    sp.scale.setScalar(1.6);
    f.scene.add(sp);
    audio.ringChime?.();
    await tween(1.8, (k) => { mat.opacity = Math.sin(Math.PI * k) ** 2; sp.scale.setScalar(1.6 + 1.2 * k); }, ease.linear);
    f.scene.remove(sp);
    mat.map.dispose();
    mat.dispose();
  }
}
