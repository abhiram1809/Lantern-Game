import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { SapphireSave, ExileSave } from '../engine/Save.js';
import { Roam } from './Roam.js';
import { CAROL_IN, HANGAR_MOUTH } from './Exile.js';
import { loadProps } from '../props/Props.js';
import { FERRIS_PROPS, LOT, coastX } from '../scenes/Ferris.js';
import { createRing, createSapphire } from '../characters/Characters.js';
import { makePose, still } from '../characters/Poses.js';
import { glowTexture } from '../fx/Textures.js';
import { createShaft } from '../fx/GreenLight.js';
import { sliced } from '../engine/Slice.js';
import { StarSapphire, YIELD_AT } from '../enemies/StarSapphire.js';
import { RAPIER } from '../engine/Physics.js';

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
const LEAN_HAL = V(-1471.15, DECK, RAIL_Z + 0.4), LEAN_CAROL = V(-1469.95, DECK, RAIL_Z + 0.36);
// sitting at a table: upright, forearms forward on it
const DINING = makePose({
  hy: -0.29, sx: 0.04, cx: 0.06, nx: 0.02,
  lLx: -1.42, kL: 1.45, lRx: -1.5, kR: 1.55, lLz: 0.06, lRz: -0.06,
  aL: [0.22, -0.72, 0.62], eL: 1.25, aR: [-0.22, -0.72, 0.62], eR: 1.25,
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
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps(FERRIS_PROPS, (k) => ui.loadStage('props', k));
    await this.setupFerrisAsync(); // (in slices, under the loading screen)
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0);
    this.learn('hammer', false);
    this.learn('staff', false);
    if (id === 'pier' || id === 'strike' || id === 'hold') await this.prepPier();
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

  // (how far on the town's lamps and lit rooms are: part on at dusk, all on by night)
  pierLamps(mode) {
    const f = this.ferrisScene, k = mode === 'dusk' ? [0.3, 0.3, 0.55] : [1, 1, 1];
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
      ca.play(still(LEANING, 0.6), 0);
      // (her hands a stance: just past the top rail, in her frame: 0.56 m in front of her root, 1.14 up)
      cb.stances.rail ??= { L: [0.11, RAIL_TOP - DECK + 0.05, RAIL_Z + 0.36 - (RAIL_Z - 0.2)], R: [-0.11, RAIL_TOP - DECK + 0.05, RAIL_Z + 0.36 - (RAIL_Z - 0.2)], poleL: [0.3, -1, -0.2], poleR: [-0.3, -1, -0.2] };
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
  makeGem(at) {
    const f = this.ferrisScene, tex = (this.gemTex ??= glowTexture('rgba(255,255,255,1)', 'rgba(170,80,255,0.4)'));
    const mk = () => { const m = new THREE.SpriteMaterial({ map: tex, color: 0xb36bff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); const sp = new THREE.Sprite(m); f.scene.add(sp); return sp; };
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
      dispose: () => { tick(); for (const sp of [head, ...trail]) { f.scene.remove(sp); sp.material.dispose(); } },
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
    await wait(1.0);
    await ui.fade(1, 1.6);
    const pick = await ui.screen({ kicker: 'Part Seven · Sapphire', title: 'ZAMARON', subtitle: 'Part Seven so far', body: 'The Zamarons have taken Carol to a world the ring has never charted, to be their queen. Hal is going after her. The rest of Part Seven is still to come.', buttons: ['Free roam', 'Quit to title'] });
    if (pick === 0) { ExileSave.resumeAfterReload('world'); await new Promise(() => {}); return; }
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
