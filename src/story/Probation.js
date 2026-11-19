import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame, clamp } from '../engine/Time.js';
import { ProbationSave, ExileSave } from '../engine/Save.js';
import { Prisoner } from './Prisoner.js';
import { legTo, legLengths } from './Coast.js';
import { voyage } from './Voyage.js';
import { POSES, still, makePose } from '../characters/Poses.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { createRing, createKorugarian, createKatma } from '../characters/Characters.js';
import { createPilot } from '../characters/FlightSuit.js';
import { createShaft } from '../fx/GreenLight.js';
import { constructMesh, CONSTRUCTS } from '../powers/Constructs.js';
import { DroneSwarm } from '../enemies/Drones.js';
import { Bedroom } from '../scenes/Bedroom.js';
import { CAROL_SPOT, CAR_SPOT, HAL_BAY, GATE, LOT, JET_SPOT, FERRIS_PROPS, RUNWAY_Z } from '../scenes/Ferris.js';
import { HALL, DAIS_TOP } from '../scenes/Hall.js';
import { Korugar, ARRIVAL as KOR_ARRIVAL, PEDESTAL_TOP, CROWD_FRONT, MARKET, QUARTER, HIDEOUT, PRISON, CELLS } from '../scenes/Korugar.js';
import { loadProps } from '../props/Props.js';
import { Drive } from '../vehicles/Drive.js';
import { Jet, FT, KT } from '../vehicles/Jet.js';
import { VehicleHud } from '../ui/VehicleHud.js';
import { StreetLife } from './KorugarLife.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the test flight: the runway's east end, where he starts his roll, and the tower he buzzes
const ROLL = V(720, 0, RUNWAY_Z), TOWER = V(-128, 0, -16);
// the cockpit, in the jet's frame (Ferris.freeJet's pivot; measured on the F22: the seat's pan about
// 0.12 m under the pivot, 5.1 m ahead of it, the rudder pedals at 5.85, the side stick on the right
// console, the throttle on the left)
const COCKPIT = { seat: V(0, -0.12, 5.12), floor: -0.5, pedals: V(0, -0.42, 5.86), stick: V(-0.25, -0.06, 5.52), throttle: V(0.26, -0.02, 5.36) };

// Part Five, "Probation": Hal's first shift as Carol's pilot and his first field training as
// Sinestro's apprentice, after Emerald Dawn II and what Geoff Johns kept of it (the user's outline,
// 2026-11-12). Tuesday: the rent he still owes, the drive in (his car, driven: Vehicles/Drive.js),
// Carol paying the landlord against his probation hours, the prototype's test flight (flown:
// Vehicles/Jet.js), Sinestro collecting him at dusk on the apron, in front of Carol, who finds out
// who he is. Korugar: the capital cheering Sinestro; the staff; the market, where the ring hears
// what people mutter after they've smiled; a man taken for laughing; Katma Tui and the resistance;
// the cells barred with Sinestro's light; his drones; the confrontation; Hal's report to the
// Guardians. Ours, not the comics': the rent and the advance, the test card, Carol finding out at the
// pickup (later in the comics), the market's whispers, the drones' raid.
export class Probation extends Prisoner {
  get save() { return ProbationSave; }

  constructor(opts) {
    super(opts);
    this.vhud = new VehicleHud();
  }

  steps() {
    return {
      rent: () => this.rent(),
      commute: () => this.commute(),
      advance: () => this.advance(),
      testflight: () => this.testFlight(),
      pickup: () => this.pickup(),
      korugar: () => this.korugarArrival(),
      patrol: () => this.patrol(),
      rebels: () => this.rebels(),
      report: () => this.report(),
    };
  }

  update(dt, t, real) {
    super.update(dt, t, real);
    this.markerFn?.();
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps([...FERRIS_PROPS, 'phone', 'fridge', 'coffee'], (k) => this.ui.loadStage('props', k));
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0.1);
    this.learn('hammer', false); // (Part Four's: in hand from here on)
    if (id === 'rent') { this.setupFlat(); return; }
    if (['commute', 'advance', 'testflight', 'pickup'].includes(id)) {
      const f = await this.setupFerrisAsync();
      f.car.rotation.y = Math.PI;
      if (id === 'commute') return; // commute() puts him at his car behind his building
      if (id === 'advance') {
        this.enterFerris(CAR_SPOT.clone().add(V(-2.45, 0, 0.45)), Math.PI * 0.9);
        this.director.mode = 'follow';
        await ui.fade(0, 1.2);
      }
      return;
    }
    this.lanternUp();
    if (id === 'patrol' || id === 'rebels') { this.learn('staff', false); this.setupKorugar(); }
  }

  // ---------------------------------------------------------------- shared
  // A world point marked on screen (the ring's HUD is off on Earth: Part Three's grave marker).
  mark(pos, label) {
    if (!pos) { this.markerFn = null; this.hud.setMarker(null); return; }
    const p = new THREE.Vector3();
    this.markerFn = () => {
      const cam = this.engine.camera;
      p.copy(typeof pos === 'function' ? pos() : pos).project(cam);
      const off = p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      const d = cam.position.distanceTo(typeof pos === 'function' ? pos() : pos);
      this.hud.setMarker((clamp(p.x, -0.95, 0.95) * 0.5 + 0.5) * innerWidth, (clamp(-p.y, -0.9, 0.9) * 0.5 + 0.5) * innerHeight, `${label}${d > 6 ? ` · ${Math.round(d)} m` : ''}`, off);
    };
  }

  // Lines over the radio while he drives or flies: one after another, never holding the game up;
  // `hushRadio()` drops the ones still waiting (the scene's over).
  radio(key) {
    const tok = (this.radioTok ??= 0);
    this.radioQ = (this.radioQ ?? Promise.resolve()).then(() => (tok === this.radioTok ? this.say(key, { skip: false }) : null));
    return this.radioQ;
  }
  hushRadio() { this.radioTok = (this.radioTok ?? 0) + 1; this.radioQ = null; }

  // Into the flight suit (Hal's own rig in Ferris's kit, FlightSuit.js); the ring stays on his hand.
  wearFlightSuit() {
    const { player } = this;
    this.pilotRig ??= createPilot(this.assets.characters.casual);
    if (player.rig === this.pilotRig) return;
    player.setRig(this.pilotRig);
    this.ring.removeFromParent();
    this.attachRing(this.ring, this.pilotRig);
    this.hal = this.pilotRig;
    player.setTired(0);
  }

  // ---------------------------------------------------------------- 1. the rent
  // Tuesday, 7:10: up already, the clock radio full of the man in green; Sal Delgado at the door.
  setupFlat() {
    const { player, audio } = this;
    const room = (this.bedroom = new Bedroom(this).build({ morning: true }));
    this.show(room);
    this.playerActive = true;
    this.inBed = false;
    player.spawn(room.physics, room.scene, V(0.55, 0, -0.85), Math.PI * 0.75);
    player.camDist = 2.1;
    player.surface = 'wood';
    player.ground = () => 0;
    room.setClock('7:10');
    this.dayLights(room);
    this.ambience(audio.traffic(0.04), audio.roomTone(0.035));
    let bird = 2;
    onFrame((dt) => { if (this.current === room && (bird -= dt) < 0) { bird = 3 + Math.random() * 7; audio.birdsong(); } });
    return room;
  }

  async rent() {
    const { ui, director, audio, player } = this;
    const room = this.bedroom ?? this.setupFlat();
    this.takeControl();
    ui.objective(null);
    const clock = V(0.02, 0.62, -1.7);
    // the clock radio on the nightstand, and Hal half-dressed by the window, listening
    director.cut(V(-0.7, 0.9, -1.0), clock.clone().add(V(0, 0, 0)), 40);
    player.lookAt(clock, 0.6);
    await ui.fade(0, 2.0);
    director.move(V(-0.9, 1.45, 0.4), V(0.4, 1.1, -1.2), 9, ease.inOut, 46);
    await this.say('radio1');
    await this.say('radio2');
    await this.say('radio3');
    player.animator.gesture('tilt', 0.9, 0.3);
    await this.say('halRadio');
    // Sal, at the front door, down the hall
    await wait(0.4);
    audio.knock(4);
    player.lookAt(V(-4.6, 1.4, 2.8), 0.7);
    director.cut(V(-0.7, 1.6, 2.85), V(-4.5, 1.3, 2.85), 44); // (down the hall to the front door)
    await wait(0.7);
    await this.say('salDoor1');
    await this.halClose(1.0);
    await this.say('halSal1');
    audio.knock(2);
    await this.say('salDoor2');
    player.animator.gesture('shake', 0.9, 0.4);
    await this.say('halSal2');
    player.lookAt(null);
    // the morning's things, and out
    let radioOn = true;
    room.interact({ position: V(-0.2, 0, -1.25), radius: 0.9, look: clock, label: 'Turn off the radio', action: async () => { if (!radioOn) return; radioOn = false; audio.knock(1); await this.say('radioOff'); } });
    room.interact({ position: V(0.1, 0, 2.45), radius: 0.8, look: V(0.22, 1.0, 3.0), label: 'Make coffee', action: () => this.say('coffee') });
    room.interact({ position: V(1.25, 0, -1.25), radius: 0.9, look: V(1.3, 0.92, -1.86), label: 'Look at the photo', action: () => this.say('photoTuesday') });
    room.interact({ position: V(1.85, 0, -0.35), radius: 0.9, look: V(2.4, 1.5, -0.35), label: 'Look outside', action: () => this.say('windowMorning') });
    this.giveControl('Go to work');
    await new Promise((resolve) => {
      room.interact({ position: V(-4.05, 0, 2.82), radius: 0.9, look: V(-4.6, 1.2, 2.82), label: 'Leave for work', action: async () => {
        this.takeControl();
        await this.say('halLeave');
        resolve();
      } });
    });
    audio.door();
    await ui.fade(1, 1.2);
  }

  // ---------------------------------------------------------------- 2. the drive in
  // Out of his building to his car (Coast.getIn), and this time he drives: out of the lot, down the
  // boulevard and out of town; then the last stretch of the desert road, the gate, and his bay.
  async commute() {
    const { ui, director, audio, player, input } = this;
    const f = this.setupFerris(), car = f.car;
    this.show(f);
    this.takeControl();
    ui.objective(null);
    this.ambience(audio.traffic(0.05), audio.wind(0.03));
    f.roadGround();
    f.freeCar();
    car.position.copy(f.lotCarSpot);
    car.rotation.set(0, 0, 0);
    f.focus(f.lotCarSpot);
    await this.getIn(car);
    const animOff = onFrame((dt) => player.animator.update(dt));
    // first try, for once
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    director.move(local(2.3, 1.35, 2.7), local(0.3, 0.98, -0.3), 1.4, ease.inOut, 36);
    await wait(1.0);
    audio.starter(0.9, true);
    await wait(1.1);
    const motor = audio.engine(0.12);
    await this.say('carFirst');
    // his to drive
    const drv = (this.drv = new Drive({ physics: f.physics, car, input, director, audio, hal: this.hal, hud: this.vhud }).start());
    drv.motor = motor;
    drv.snap = true;
    f.updaters.push((dt) => { drv.update(dt); f.focus(car.position); });
    this.playerActive = false;
    drv.enabled = true;
    ui.cinematic(false);
    input.setLook(true);
    ui.controls(false); // (the car's own keys are on its dash)
    this.hud.tutorial({ kicker: 'Driving', title: 'His car', n: 1, of: 1, html: '<b>W</b> drive &nbsp; <b>S</b> brake, reverse &nbsp; <b>A</b> <b>D</b> steer &nbsp; <b>Space</b> handbrake &nbsp; <b>C</b> view (behind, or from his seat) &nbsp; <b>Mouse</b> look round' });
    ui.objective('Drive out of town');
    const townEnd = LOT.clone().add(V(6, 0, -432));
    this.mark(townEnd.clone().setY(1.5), 'The desert road');
    const leftTown = () => car.position.z < townEnd.z || (car.position.distanceTo(LOT) > 650);
    let radioed = false;
    await waitFor(() => {
      if (!radioed && car.position.distanceTo(LOT) > 40) { radioed = true; this.radio('radio4').then(() => this.radio('halDrive1')); }
      return leftTown();
    });
    this.hud.tutorial(null);
    this.mark(null);
    // the desert road: a fade, and the last mile in to the field
    drv.enabled = false;
    drv.throttle = 0.4;
    await ui.fade(1, 0.6);
    const roadX = 4.1;
    drv.place(V(roadX, 0, 1000), Math.PI);
    drv.body.setLinvel({ x: 0, y: 0, z: -24 }, true);
    drv.snap = true;
    drv.view = drv.view === 'first' ? 'first' : 'chase';
    await ui.fade(0, 0.6);
    drv.enabled = true;
    ui.objective('Drive in to Ferris Aircraft and park in your space');
    this.mark(HAL_BAY.clone().setY(1.2), 'Your space');
    // Parked: stopped in the painted space (its middle within 1.2 m of the space's across it, so at
    // most a third of the car over a line; along it, from pulled right in to its tail a little out in
    // the aisle, which takes in CAR_SPOT), square to the lines, nose in or backed in. Stopped close by
    // but not in it, the objective says what's wrong.
    let parked = 0, close = 0, hint = null;
    const bay = onFrame((dt) => {
      const p = car.position;
      // off the road and away into the desert: back on it
      if (Math.abs(p.x - roadX) > 320 && p.z > GATE.z + 40) { drv.place(V(roadX, 0, Math.max(GATE.z + 120, p.z)), Math.PI); drv.snap = true; }
      const inBay = Math.abs(p.x - HAL_BAY.x) < 1.2 && p.z > HAL_BAY.z - 1.8 && p.z < CAR_SPOT.z + 0.4;
      const fwd = Math.atan2(V(0, 0, 1).applyQuaternion(car.quaternion).x, V(0, 0, 1).applyQuaternion(car.quaternion).z);
      const square = Math.abs(wrap(fwd - Math.PI)) < 0.4 || Math.abs(wrap(fwd)) < 0.4;
      const stopped = Math.abs(drv.speed) < 0.4;
      parked = inBay && square && stopped ? parked + dt : 0;
      close = !(inBay && square) && stopped && Math.hypot(p.x - HAL_BAY.x, p.z - HAL_BAY.z) < 9 ? close + dt : 0;
      const want = close > 1.2 ? (inBay ? 'Straighten up between the lines' : 'Park between the lines of your space') : null;
      if (want && want !== hint) ui.objective((hint = want));
    });
    await waitFor(() => parked > 0.6);
    bay();
    this.mark(null);
    drv.enabled = false;
    drv.throttle = 0; drv.brake = 1;
    await wait(0.4);
    this.vhud.hide();
    drv.stop();
    // settled square on its wheels where it stopped
    const heading = Math.atan2(V(0, 0, 1).applyQuaternion(car.quaternion).x, V(0, 0, 1).applyQuaternion(car.quaternion).z);
    car.position.y = 0;
    car.rotation.set(0, heading, 0);
    for (const wh of drv.wheels) wh.pv.position.y = wh.hub.y;
    f.carSolid();
    motor.stop(0.4);
    this.hushRadio();
    this.bark('halPark');
    this.takeControl();
    await this.getOut(car, animOff);
  }

  // ---------------------------------------------------------------- 3. an advance
  // Carol on the apron. The rent: she pays Sal, and his probation pays her back. Then: the card.
  async advance() {
    const { ui, director, player } = this;
    const f = this.setupFerris();
    ui.clock(this.save.info('advance').clock);
    const carol = this.addCarol();
    this.director.mode = 'follow';
    f.follow = (cam) => _p.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).setLength(15).add(player.position);
    this.giveControl('Find Carol on the apron');
    await waitFor(() => Math.hypot(player.position.x - CAROL_SPOT.x, player.position.z - CAROL_SPOT.z) < 6.5);
    f.follow = null;
    this.takeControl();
    const cb = this.cb, ca = this.carolAnim;
    const stand = CAROL_SPOT.clone().add(V(-0.6, 0, 2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    player.turnTo(Math.atan2(CAROL_SPOT.x - stand.x, CAROL_SPOT.z - stand.z));
    if (carol) {
      const from = carol.root.rotation.y, to = Math.atan2(stand.x - CAROL_SPOT.x, stand.z - CAROL_SPOT.z);
      tween(1.2, (k) => (carol.root.rotation.y = from + wrap(to - from) * ease.inOut(k)));
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    }
    f.focus(CAROL_SPOT);
    await this.overHal(1.6);
    await this.say('halAdv1');
    await this.carolClose(1.2);
    await this.carolSay('carolAdv1', [['three', () => ca.gesture('tilt', 1, 0.4)]]);
    await this.halClose(1.0);
    player.animator.gesture('beat', 0.6, 0.4);
    await this.say('halAdv2');
    await this.carolClose(1.2, -1);
    await wait(0.4);
    await this.carolSay('carolAdv2', [['number', 'open']]);
    await this.halClose(0.8, -1);
    await this.say('halAdv3');
    await this.carolClose(1.0, 1, 28);
    await this.carolSay('carolAdv3', [['probation', 'cut'], ['free', () => ca.gesture('chin', 1, 0.4)]]);
    await this.halClose(1.0);
    player.animator.gesture('nod', 1, 0.4);
    await this.say('halAdv4');
    await this.carolClose(0.9, -1, 30);
    await this.carolSay('carolAdv4', [['Tuesday', () => ca.gesture('tilt', 1.1, 0.5)]]);
    await this.overHal(1.4);
    await this.carolSay('carolAdv5', [['prototype', () => cb.pointAt(f.jet.position.clone().setY(2.2), 1.6)], ['home', 'open']]);
    await this.halClose(1.0);
    await this.say('halAdv5');
    await this.carolClose(1.0);
    await this.carolSay('carolAdv6', [['me', 'chest']]);
    await ui.fade(1, 1.4);
  }

  // ---------------------------------------------------------------- 4. first shift: the test flight
  // In the kit, out at the runway's end, into the cockpit. The card: take off, climb to twelve
  // thousand, a five-g turn, Mach 1.2, a low pass over the field, home. Carol in the tower. Flown.
  async testFlight() {
    const { ui, director, audio, player, input, engine } = this;
    const f = this.setupFerris();
    ui.clock(this.save.info('testflight').clock);
    this.takeControl();
    ui.objective(null);
    f.roadGround(); // (the runway's far end is past the walkable patch round the field)
    if (this.carol) this.carol.root.visible = false;
    this.wearFlightSuit();
    const rig = f.freeJet();
    f.gear(true);
    // a clear canopy for the flight we fly (Part Three's was gold: the pilot was nobody we knew)
    for (const m of rig.userData.canopy) Object.assign(m.material, { color: new THREE.Color(0.62, 0.68, 0.66), metalness: 0.2, roughness: 0.05, opacity: 0.32, envMapIntensity: 1.2 });
    const yaw0 = -Math.PI / 2;
    rig.position.set(ROLL.x, rig.userData.hc, ROLL.z);
    rig.quaternion.setFromAxisAngle(UP, yaw0);
    rig.updateMatrixWorld(true);
    // the walk out: Hal in the kit, helmet under his arm, crossing the runway to her
    const walkFrom = ROLL.clone().add(V(-12, 0, 18)), walkTo = ROLL.clone().add(V(-6.5, 0, 4.2));
    this.enterFerris(walkFrom, Math.atan2(walkTo.x - walkFrom.x, walkTo.z - walkFrom.z));
    player.autoAnim = true;
    f.focus(ROLL);
    director.cut(ROLL.clone().add(V(-30, 1.3, 24)), walkFrom.clone().lerp(rig.position, 0.5).setY(1.4), 40);
    await ui.fade(0, 1.4);
    director.move(ROLL.clone().add(V(-26, 1.5, 18)), walkTo.clone().lerp(rig.position, 0.4).setY(1.6), 5.5, ease.inOut, 40);
    await player.walkTo(walkTo, player.walkSpeed);
    player.turnTo(Math.atan2(rig.position.x - walkTo.x, rig.position.z - walkTo.z));
    await wait(0.6);
    await ui.fade(1, 0.8);
    // in the seat, helmet on, visor down
    const seat = this.seatInJet(rig);
    f.flightAir(true);
    engine.camera.far = f.scene.userData.far;
    engine.camera.updateProjectionMatrix();
    const jet = (this.jet = new Jet({ rig, input, director, audio, hud: this.vhud, ground: (x, z) => f.terrainAt(x, z), engine }));
    jet.eye = () => this.pilotRig.bones.head.getWorldPosition(_e).addScaledVector(_u.set(0, 1, 0).applyQuaternion(rig.quaternion), 0.09).addScaledVector(_f.set(0, 0, 1).applyQuaternion(rig.quaternion), 0.05);
    jet.onView = (v) => { this.pilotRig.u.uHideBone.value = v === 'cockpit' ? 4 : -1; this.pilotRig.helmet.visible = v !== 'cockpit'; f.nearMax = v === 'cockpit' ? 0.3 : 2; };
    jet.onGear = (down) => f.gear(down);
    jet.offField = (x, z) => !(Math.abs(z - RUNWAY_Z) < 24 && Math.abs(x) < 820);
    jet.snap = true;
    let crashed = false;
    jet.onCrash = () => { crashed = true; };
    const engineSnd = audio.jetEngine();
    let wasSuper = false, boomT = 0;
    const cone = this.vaporCone(rig);
    const flying = onFrame((dt) => {
      jet.update(dt);
      f.focus(jet.pos);
      seat.update(dt);
      const t = jet.throttle;
      engineSnd.set(jet.view === 'cockpit' ? 0.22 + t * 0.12 : 0.3 + t * 0.25, 0.75 + Math.min(1.25, t) * 0.4);
      // the sound barrier: a boom, and the cone of cloud round the airframe for a moment
      const sup = jet.mach > 1.0;
      if (sup && !wasSuper) { audio.sonicBoom(1.2); director.shake(0.25, 0.6); boomT = 0.7; }
      wasSuper = sup;
      boomT = Math.max(0, boomT - dt);
      cone.material.opacity = boomT * 0.9;
      cone.scale.setScalar(1 + (0.7 - boomT));
      // g on his eyes
      this.vhud.gloc(clamp((jet.g - 6.2) / 3.2, 0, 1) * 0.95);
    });
    try {
      director.mode = 'follow';
      await ui.fade(0, 1.0);
      ui.cinematic(false);
      input.setLook(true);
      ui.controls(false); // (the jet's keys are on its panel)
      jet.enabled = true;
      this.hud.tutorial({ kicker: 'Ferris Two-Seven', title: 'The prototype', n: 1, of: 1, html: '<b>Mouse</b> point where to fly &nbsp; <b>W</b> <b>S</b> throttle (past 100% is afterburner) &nbsp; <b>A</b> <b>D</b> roll &nbsp; <b>Q</b> <b>E</b> rudder &nbsp; <b>G</b> gear &nbsp; <b>B</b> brakes &nbsp; <b>C</b> cockpit view' });
      const card = [
        { text: 'Take off, gear up', done: false },
        { text: 'Climb to 12,000 ft', done: false },
        { text: 'Hold a 5 g turn (3 s)', done: false },
        { text: 'Supersonic: Mach 1.2', done: false },
        { text: 'Low pass over the tower', done: false },
        { text: 'Land on runway 27 and stop', done: false },
      ];
      this.vhud.setCard(card);
      const tick = (i) => { card[i].done = true; this.vhud.setCard(card); audio.ringChime?.(); };
      ui.objective('Fly the test card');
      this.radio('tower1').then(() => this.radio('halTower1'));
      const fail = () => crashed;
      const outOfRange = () => Math.hypot(jet.pos.x, jet.pos.z + 150) > 42000;
      let warned = 0;
      const watch = () => {
        if (outOfRange() && (warned -= 1 / 60) < 0) { warned = 12; this.radio('towerRange'); }
        return fail();
      };
      // 1. off the ground and the gear up
      await waitFor(() => watch() || (!jet.onGround && jet.alt > 40 && !jet.gearDown));
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      tick(0);
      this.radio('tower2');
      // 2. twelve thousand
      await waitFor(() => watch() || jet.alt * FT > 11600);
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      tick(1);
      this.radio('tower3');
      // 3. five g held for three seconds
      let held = 0;
      await waitFor(() => { held = jet.g > 4.8 ? held + 1 / 60 : Math.max(0, held - 2 / 60); return watch() || held > 3; });
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      this.radio('halTower3');
      tick(2);
      this.radio('tower4');
      // 4. Mach 1.2
      await waitFor(() => watch() || jet.mach >= 1.2);
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      tick(3);
      this.radio('tower5').then(() => this.radio('halTower5')).then(() => this.radio('tower6'));
      this.mark(TOWER.clone().setY(30), 'The tower');
      // 5. low and fast past the tower
      await waitFor(() => watch() || (Math.hypot(jet.pos.x - TOWER.x, jet.pos.z - TOWER.z) < 320 && jet.alt * FT < 320 && jet.speed * KT > 380));
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      tick(4);
      this.mark(null);
      this.radio('tower7').then(() => this.radio('halTower7')).then(() => this.radio('tower8'));
      this.mark(V(300, 2, RUNWAY_Z), 'Runway 27');
      // 6. down on the runway, stopped
      let gearNag = 0;
      await waitFor(() => {
        if (!jet.gearDown && jet.alt < 150 && jet.vel.y < -2 && (gearNag -= 1 / 60) < 0) { gearNag = 8; this.radio('towerGear'); }
        return watch() || (jet.onGround && jet.speed < 4 && !jet.offField(jet.pos.x, jet.pos.z));
      });
      if (fail()) return this.jetDown(jet, engineSnd, flying);
      tick(5);
      this.mark(null);
      jet.enabled = false;
      jet.throttle = 0;
      this.hud.tutorial(null);
      ui.objective(null);
      this.hushRadio();
      await this.radio('tower9');
      await wait(1.0);
      await ui.fade(1, 1.4);
    } finally {
      if (!crashed) {
        flying();
        engineSnd.stop(1.2);
        this.vhud.hide();
        this.vhud.setCard(null);
        f.flightAir(false);
        engine.camera.far = f.scene.userData.far;
        engine.camera.updateProjectionMatrix();
        director.up = null;
        f.nearMax = 2;
        seat.release();
      }
    }
  }

  // The jet's gone into the desert (or onto it): the card, and the checkpoint again.
  async jetDown(jet, engineSnd, flying) {
    const { ui, audio, director } = this;
    flying();
    engineSnd.stop(0.2);
    audio.explosion(1.2);
    director.shake(0.6, 1.4);
    this.engine.gradeUniforms.uFlash.value = 0.5;
    tween(0.8, (k) => (this.engine.gradeUniforms.uFlash.value = 0.5 * (1 - k)));
    this.vhud.hide();
    this.vhud.setCard(null);
    this.takeControl();
    this.say('jetCrash', { skip: false });
    await wait(2.2);
    await ui.fade(1, 1.0);
    await ui.screen({ kicker: 'Ferris Two-Seven', title: 'JET LOST', body: 'The prototype went in. Hal walks away from it in the ring’s light, but the test card needs flying.', buttons: ['Try again'] });
    this.save.resumeAfterReload('testflight');
    await new Promise(() => {});
  }

  // A white cone of cloud round the airframe as it goes through the barrier.
  vaporCone(rig) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6, 32, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    rig.add(m);
    return m;
  }

  // Hal in the prototype's seat: out of the world's physics, carried by the airframe, seated by
  // two-bone IK (Coast.legTo: the seat's numbers, not guesses), his hands on the stick and throttle,
  // the helmet on and its visor down. update(dt) runs his animator; release() stands him back up.
  seatInJet(rig) {
    const { player } = this, pilot = this.pilotRig, anim = player.animator, o = player.object;
    player.removeFromPhysics();
    this.playerActive = false;
    player.autoAnim = false;
    player.lookAt(null);
    anim.feet.ground = null;
    rig.attach(o);
    const C = COCKPIT, [a, b] = legLengths(pilot), hipY = C.seat.y - C.floor;
    o.position.set(C.seat.x, C.floor, C.seat.z);
    o.rotation.set(0, 0, 0);
    player.pivot.quaternion.identity();
    const pose = makePose({ hy: hipY - pilot.hipsHeight, sx: -0.32, cx: -0.08, nx: 0.22, lLz: 0.08, lRz: -0.08, aL: [0.3, -0.4, 0.8], eL: 1.0, aR: [-0.3, -0.4, 0.8], eR: 1.0 });
    legTo(pose, 'L', C.pedals.y - C.seat.y, C.pedals.z - C.seat.z, a, b, -0.25);
    legTo(pose, 'R', C.pedals.y - C.seat.y, C.pedals.z - C.seat.z, a, b, -0.25);
    anim.play(still(pose, 0.5), 0);
    const stick = new THREE.Vector3(), thr = new THREE.Vector3();
    anim.reach('R', () => rig.localToWorld(stick.copy(C.stick)), { pole: V(-1, -0.6, -0.4), rate: 30 });
    anim.reach('L', () => rig.localToWorld(thr.copy(C.throttle)), { pole: V(1, -0.6, -0.4), rate: 30 });
    pilot.wearHelmet(true);
    pilot.helmetVisor(1);
    return {
      update: (dt) => anim.update(dt),
      release: () => { anim.reach('R', null, { rate: 30 }); anim.reach('L', null, { rate: 30 }); pilot.wearHelmet(false); pilot.u.uHideBone.value = -1; rig.remove(o); this.standDown(); },
    };
  }

  // ---------------------------------------------------------------- 5. field training: the pickup
  // Dusk on the apron, the prototype back on its wheels. The Air Force signed off; he asks her to
  // dinner. Sinestro comes down out of the sky for him, in front of her, and he has to put the suit
  // on where she can see. She knows him. She falls for him.
  async pickup() {
    const { ui, director, audio, player, powers } = this;
    const f = this.setupFerris();
    ui.clock(this.save.info('pickup').clock);
    this.takeControl();
    f.dusk();
    this.wearFlightSuit();
    this.standDown(); // (on his feet: out of the cockpit's seat)
    f.parkJet(JET_SPOT, Math.PI / 2);
    this.ambience(audio.wind(0.05));
    const carol = this.addCarol();
    const ca = this.carolAnim, cb = this.cb;
    carol.root.visible = true;
    carol.root.position.copy(CAROL_SPOT);
    const stand = CAROL_SPOT.clone().add(V(-0.6, 0, 2.6));
    this.enterFerris(stand, Math.atan2(CAROL_SPOT.x - stand.x, CAROL_SPOT.z - stand.z));
    this.director.mode = 'shot';
    carol.root.rotation.y = Math.atan2(stand.x - CAROL_SPOT.x, stand.z - CAROL_SPOT.z);
    cb.stance('hip');
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    f.focus(CAROL_SPOT);
    await this.overHal(0.01);
    await ui.fade(0, 1.6);
    await this.carolSay('carolPick1', [['signed', 'open'], ['pass', () => ca.gesture('shake', 0.9, 0.25)]]);
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.8, 0.3);
    await this.say('halPick1');
    await this.carolClose(1.2, -1, 30);
    await wait(0.4);
    await this.carolSay('carolPick2');
    await wait(0.5);
    await this.carolSay('carolPick3', [['runway', () => ca.gesture('tilt', 1.2, 0.4)]]);
    // a green light coming down out of the dusk
    const sin = (this.sin = this.addSinestroAt(f));
    const land = stand.clone().add(V(5.5, 0, -1.2)), from = land.clone().add(V(-40, 80, 30));
    const yaw = Math.atan2(stand.x - land.x, stand.z - land.z);
    sin.place(from, yaw);
    sin.anim.play(sin.flyGen, 0);
    sin.flyState.k = 0.8;
    const trail = createShaft({ from, to: from.clone().add(V(0, -1, 0)), radiusFrom: 0.05, radiusTo: 0.5, color: new THREE.Color(0.4, 2.4, 1.0) });
    trail.quaternion.setFromUnitVectors(V(0, -1, 0), land.clone().sub(from).normalize());
    trail.userData.uniforms.uOpacity.value = 2.0;
    f.scene.add(trail);
    ca.lookAt(() => sin.position.clone().add(V(0, 1.6, 0)), 0.7);
    player.lookAt(() => sin.position.clone().add(V(0, 1.6, 0)), 0.8);
    director.cut(stand.clone().add(V(-3.5, 1.4, 3.5)), land.clone().lerp(from, 0.35), 46);
    audio.whoosh(2.2, 0.5);
    const look = new THREE.Vector3();
    await tween(2.2, (k) => {
      const e = 1 - (1 - k) ** 3;
      sin.place(from.clone().lerp(land, e), yaw);
      sin.flyState.k = 0.8 * (1 - k);
      trail.scale.y = from.distanceTo(sin.position) * 0.98;
      look.copy(sin.position).y += 1.2;
      director.look.lerp(look, 0.2);
    }, ease.linear);
    trail.removeFromParent();
    sin.anim.play(sin.standGen, 0.7);
    audio.land(0.5);
    f.focus(land);
    await wait(0.6);
    await this.sinClose(1.3);
    await this.sinSay('sinPick1', [['Jordan', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.carolClose(1.0);
    await this.carolSay('carolPick4', [['Hal', 'open']]);
    await this.halClose(1.0, -1);
    await this.say('halPick2');
    await this.sinClose(1.2, -1);
    await this.sinSay('sinPick2', [['ring', 'ring']]);
    // to her
    player.turnTo(Math.atan2(CAROL_SPOT.x - stand.x, CAROL_SPOT.z - stand.z));
    player.lookAt(() => carol.bonePosition('head', _h), 0.85);
    ca.lookAt(this.headOf(player.rig), 0.8);
    await this.halClose(1.2);
    await this.say('halPick3');
    // a step back from her, and the light: the kit to the suit, where she can see it
    const back = stand.clone().add(V(-0.9, 0, 1.0));
    await player.walkTo(back, player.walkSpeed * 0.7);
    player.turnTo(Math.atan2(CAROL_SPOT.x - back.x, CAROL_SPOT.z - back.z));
    director.cut(CAROL_SPOT.clone().add(V(0.9, 1.55, -0.6)), back.clone().add(V(0, 1.1, 0)), 40);
    this.ringGlow = 4;
    this.engine.gradeUniforms.uFlash.value = 0.16;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.16 * (1 - k)));
    await this.suitUp(1.8);
    this.powerUp();
    player.lookAt(() => carol.bonePosition('head', _h), 0.85);
    await wait(0.6);
    await this.carolClose(1.4, -1, 28);
    await this.carolSay('carolPick5', [['runway', () => ca.gesture('shake', 1.2, 0.35)]]);
    await this.halClose(1.0);
    await this.say('halPick4');
    // she comes to him: a hand flat on his chest
    const toHal = back.clone().sub(CAROL_SPOT).setY(0), near = CAROL_SPOT.clone().addScaledVector(toHal.clone().normalize(), toHal.length() - 0.72);
    const loco = this.carolLoco, c0 = carol.root.position.clone();
    ca.lookAt(this.headOf(player.rig), 0.9);
    await tween(1.1, (k) => { carol.root.position.lerpVectors(c0, near, ease.inOut(k)); loco.speed = Math.sin(k * Math.PI) * 1.1; }, ease.linear);
    loco.speed = 0;
    carol.root.rotation.y = Math.atan2(back.x - near.x, back.z - near.z);
    const chest = new THREE.Vector3();
    ca.reach('R', () => player.rig.bonePosition('chest', chest).add(V(0, 0.08, 0)).addScaledVector(V(Math.sin(carol.root.rotation.y), 0, Math.cos(carol.root.rotation.y)), -0.13), { pole: V(-0.8, -0.6, -0.3), rate: 4 });
    const h0 = carol.bonePosition('head', V(0, 0, 0)), side = V(Math.cos(carol.root.rotation.y), 0, -Math.sin(carol.root.rotation.y));
    director.move(h0.clone().addScaledVector(side, 1.5).add(V(0, 0.0, 0)), h0.clone().lerp(player.rig.bonePosition('head', V(0, 0, 0)), 0.5), 1.6, ease.inOut, 34);
    await wait(1.0);
    await this.carolSay('carolPick6', [['idiot', () => ca.gesture('shake', 1.2, 0.3)]]);
    await wait(0.5);
    await this.carolSay('carolPick7', [['Go', () => ca.gesture('nod', 1, 0.35)], ['done', () => ca.gesture('chin', 1, 0.4)]]);
    ca.reach('R', null, { rate: 3 });
    await this.sinClose(1.0);
    await this.sinSay('sinPick3', [['Korugar', 'present']]);
    // up together, and gone
    player.animator.play(still(POSES.land, 0.5), 0.2);
    await wait(0.4);
    director.cut(back.clone().add(V(4, 1.0, 5)), back.clone().setY(8), 52);
    player.animator.play(player.flightGen, 0.2);
    player.flightState.k = 1;
    sin.anim.play(sin.flyGen, 0.3);
    audio.takeoff();
    this.engine.gradeUniforms.uFlash.value = 0.25;
    tween(0.4, (k) => (this.engine.gradeUniforms.uFlash.value = 0.25 * (1 - k)));
    const p0 = player.object.position.clone(), s0 = sin.position.clone();
    tween(1.8, (k) => { player.object.position.lerpVectors(p0, p0.clone().add(V(0, 140, 0)), ease.in(k)); sin.place(s0.clone().add(V(0, 150 * ease.in(k), 0)), yaw); sin.flyState.k = Math.min(1, k * 2); }, ease.linear);
    await wait(1.1);
    await ui.fade(1, 1.2);
    powers.detach();
    this.hud.show(false);
  }

  // ---------------------------------------------------------------- 6. Korugar
  setupKorugar() {
    if (this.kor) return this.kor;
    this.kor = new Korugar({ engine: this.engine, assets: this.assets }).build();
    return this.kor;
  }

  enterKorugar(at, yaw) {
    const { player, audio, powers } = this, kor = this.kor;
    this.world = 'korugar';
    this.show(kor);
    this.playerActive = true;
    player.spawn(kor.physics, kor.scene, at, yaw);
    player.ground = () => 0;
    player.surface = 'stone';
    player.camDist = 2.8;
    powers.attach({ scene: kor.scene, physics: kor.physics, ...kor.airBounds() });
    powers.regen = 0;
    this.ambience(audio.wind(0.05), audio.pad([55, 82.4, 110], 0.025, { cutoff: 400 }));
  }

  // The plaza's front ranks: men and women of Korugar in the regime's grey, facing the statue (the
  // full figures: the scene's instanced crowd stands behind them). Each has its idle, a little sway,
  // and turns its head; `cheer` raises their fists.
  addCrowd() {
    if (this.crowd) return this.crowd;
    const kor = this.kor, ch = this.assets.characters, list = [];
    CROWD_FRONT.forEach((at, i) => {
      const woman = ch.katma && i % 3 === 1;
      const rig = woman ? createKatma(ch.katma, { citizen: true, seed: i * 7 + 3 }) : createKorugarian(ch.abin, { seed: i * 13 + 5 });
      rig.root.position.copy(at);
      rig.root.rotation.y = Math.atan2(-at.x, -at.z);
      kor.scene.add(rig.root);
      const anim = new Animator(rig), loco = new Locomotion(this.mocap);
      loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
      loco.relax.adduct = 0.1;
      anim.play(loco, 0);
      anim.look.maxYaw = 0.6;
      list.push({ rig, anim, loco, home: at.clone(), phase: Math.random() * 6 });
    });
    kor.updaters.push((dt, t) => { for (const c of list) c.anim.update(dt); });
    return (this.crowd = list);
  }

  // Their fists up, in time with the chant (or down).
  cheer(on) {
    this.kor.setCheer(on);
    for (const c of this.crowd ?? []) {
      const side = c.phase > 3 ? 'R' : 'L', sh = new THREE.Vector3();
      if (on) c.anim.reach(side, () => c.rig.bonePosition(side === 'R' ? 'upperArm_R' : 'upperArm_L', sh).add(V(0, 0.5 + 0.06 * Math.sin(this.engine.time * 5 + c.phase), 0)), { pole: V(side === 'R' ? -1 : 1, 0, -0.5), rate: 6 });
      else c.anim.reach(side, null, { rate: 4 });
    }
  }

  async korugarArrival() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    ui.clock(this.save.info('korugar').clock);
    await voyage(this, { from: 'earth', to: 'korugar', launch: false, long: true });
    this.chartWorlds(['korugar']);
    const kor = this.setupKorugar();
    this.enterKorugar(KOR_ARRIVAL.clone().add(V(0, 0, 40)), Math.PI);
    const crowd = this.addCrowd();
    for (const c of crowd) c.anim.lookAt(() => V(0, PEDESTAL_TOP + 1.6, 0), 0.5);
    const sin = (this.sin = this.addSinestroAt(kor, kor.blocks));
    sin.place(V(0, PEDESTAL_TOP, 2.2), 0);
    sin.bl.lookHome = () => () => V(0, 1.5, 30);
    this.cheer(true);
    // over the city's roofs and down into the plaza
    await this.arriveFlying(V(10, 46, 120), Math.PI, V(-0.5, -5, -11));
    this.ringSay('ringKor');
    powers.markerTarget = { pos: KOR_ARRIVAL.clone().setY(1.5), label: 'Sinestro' };
    this.giveControl('Land in the plaza, below Sinestro’s statue');
    const chant = audio.pad([110, 138.6, 164.8], 0.03, { cutoff: 600 });
    await waitFor(() => !player.flying && player.position.distanceTo(KOR_ARRIVAL) < 12);
    powers.markerTarget = null;
    this.takeControl();
    if (player.position.distanceTo(KOR_ARRIVAL) > 0.6) await player.walkTo(KOR_ARRIVAL, player.walkSpeed);
    player.turnTo(Math.PI);
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.7);
    // the plaza: the chant, his statue, him at its feet
    director.cut(KOR_ARRIVAL.clone().add(V(2.4, 1.7, 4.5)), V(0, PEDESTAL_TOP + 4, 0), 46);
    director.move(KOR_ARRIVAL.clone().add(V(1.8, 1.6, 3.6)), V(0, PEDESTAL_TOP + 6, 0), 5, ease.inOut, 50);
    await this.say('crowd1');
    this.cheer(false);
    sin.anim.gesture('chin', 1.2, 0.4);
    director.cut(V(-6, PEDESTAL_TOP - 2.5, 14), sin.position.clone().add(V(0, 1.7, 0)), 34);
    await this.sinSay('sinKor1', [['thieves', 'dismiss'], ['burning', () => sin.anim.gesture('shake', 1, 0.3)]]);
    director.cut(V(8, PEDESTAL_TOP + 1.2, 10), sin.position.clone().add(V(0, 1.6, 0)), 30);
    await this.sinSay('sinKor2', [['look', 'present'], ['peace', () => sin.anim.gesture('chin', 1.2, 0.5)]]);
    this.cheer(true);
    // the crowd from the pedestal: faces turned up to him
    director.cut(V(0, PEDESTAL_TOP + 3, 2), V(0, 0.8, 24), 52);
    await this.say('crowd2');
    this.cheer(false);
    await this.halClose(1.0);
    await this.say('halKor1');
    // he comes down to Hal
    const meet = KOR_ARRIVAL.clone().add(V(1.8, 0, -1.6));
    sin.anim.play(sin.flyGen, 0.3);
    const s0 = sin.position.clone();
    director.move(KOR_ARRIVAL.clone().add(V(-3, 1.6, 3)), meet.clone().add(V(0, 2, 0)), 1.6, ease.inOut, 46);
    await tween(1.6, (k) => { sin.place(s0.clone().lerp(meet, ease.inOut(k)).add(V(0, Math.sin(k * Math.PI) * 1.5, 0)), Math.atan2(KOR_ARRIVAL.x - meet.x, KOR_ARRIVAL.z - meet.z)); sin.flyState.k = Math.sin(k * Math.PI) * 0.4; }, ease.linear);
    sin.anim.play(sin.standGen, 0.5);
    sin.yaw = Math.atan2(KOR_ARRIVAL.x - meet.x, KOR_ARRIVAL.z - meet.z);
    sin.place(meet, sin.yaw);
    sin.bl.lookHome = () => this.headOf(player.rig);
    player.turnTo(Math.atan2(meet.x - KOR_ARRIVAL.x, meet.z - KOR_ARRIVAL.z));
    await this.sinClose(1.2);
    await this.sinSay('sinKor3', [['murder', () => sin.anim.gesture('beat', 0.6, 0.5)]]);
    await this.halClose(1.0);
    await this.say('halKor2');
    await this.sinClose(1.1, -1);
    await this.sinSay('sinKor4', [['Lantern', 'present']]);
    chant.stop(3);
    await ui.fade(1, 1.2);
  }

  // ---------------------------------------------------------------- 7. order
  // The staff, on the plaza: Sinestro's lesson. Then his market, where everyone smiles and the ring
  // hears what they say once he's past. Then a man taken away for laughing.
  async patrol() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    const kor = this.setupKorugar();
    ui.clock(this.save.info('patrol').clock);
    const at = KOR_ARRIVAL.clone();
    this.enterKorugar(at, Math.PI);
    this.addCrowd();
    const sin = (this.sin ??= this.addSinestroAt(kor, kor.blocks));
    const meet = at.clone().add(V(1.8, 0, -1.6));
    sin.yaw = Math.atan2(at.x - meet.x, at.z - meet.z);
    sin.place(meet, sin.yaw);
    sin.anim.play(sin.standGen, 0);
    sin.bl.lookHome = () => this.headOf(player.rig);
    this.takeControl();
    player.place(at, Math.atan2(meet.x - at.x, meet.z - at.z));
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.75);
    await this.sinClose(0.01);
    await ui.fade(0, 1.2);
    await this.sinSay('sinStaff1', [['fist', 'dismiss'], ['staff', 'present']]);
    this.learn('staff', false);
    this.ringGlow = 3;
    audio.ringChime();
    this.ringSay('ringStaff');
    await this.sinClose(1.0, -1);
    await this.sinSay('sinStaff2');
    // the drones: Korugar's own, set to training, hanging in front of the statue
    const swarm = (this.swarm = new DroneSwarm({ scene: kor.scene, physics: kor.physics, powers, player, audio, director, arena: 400, blocks: kor.blocks.map((b) => ({ ...b, h: 60 })) }));
    kor.updaters.push((dt, t) => swarm.update(dt, t));
    for (let i = 0; i < 4; i++) swarm.spawn(V(-6 + i * 4, 1.6, 12 + (i % 2) * 2.5), 'target');
    this.hud.tutorial({ kicker: 'Sinestro', title: 'The staff', n: 1, of: 1, html: '<b>4</b> the wheel, then the <b>Staff</b> &nbsp; <b>Click</b> sweep (in rhythm: the combo)' });
    this.giveControl(`Sweep the drones down with the staff (0 of 4)`);
    await waitFor(() => { const left = swarm.alive.length; ui.objective(`Sweep the drones down with the staff (${4 - left} of 4)`); return left === 0; });
    this.hud.tutorial(null);
    this.takeControl();
    await this.touchDown(); // (Sinestro talks to him on his feet, not hovering)
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.75);
    await this.sinClose(1.2);
    await this.sinSay('sinStaff3', [['market', () => sin.bl.pointAt(V(80, 2, 0), 1.6)]]);
    sin.place(V(0, -40, 0), 0); // (off to his palace)
    // the market street: the stallholders and the people buying, the four who speak to him
    const people = this.marketPeople();
    // and the city about its business round him: people up and down the avenue and the market,
    // guards at the avenue's mouth (KorugarLife: E to talk to any of them)
    this.streets ??= new StreetLife(this, kor, { era: 'sinestro', walkers: { avenue: 4, market: 3 }, guards: [{ at: V(-4.6, 0, -47), yaw: 0 }, { at: V(4.6, 0, -47), yaw: 0 }] });
    let heard = 0;
    const thoughts = ['halKv1', 'halKv2', 'halKv3', 'halKv4'];
    for (const p of people.talkers) {
      kor.interact({ position: p.at, radius: 2.4, look: p.head(), label: 'Speak to them', action: async () => {
        if (p.done) return;
        p.done = true;
        p.held = true;
        p.it.enabled = false;
        this.takeControl();
        powers.markerTarget = null;
        player.lookAt(p.head, 0.85);
        p.anim.lookAt(this.headOf(player.rig), 0.7);
        const f = V(Math.sin(p.rig.root.rotation.y), 0, Math.cos(p.rig.root.rotation.y)), r = V(f.z, 0, -f.x), hd = p.head();
        director.move(hd.clone().addScaledVector(f, 1.8).addScaledVector(r, 0.5), hd.clone(), 1.0, ease.inOut, 34);
        await wait(0.6);
        this.speakingRig = p.rig;
        p.anim.gesture('nod', 1, 0.35);
        await this.say(p.lines[0]);
        this.speakingRig = null;
        // he turns away, and over his shoulder the ring hears what they say next
        p.anim.lookAt(null);
        p.anim.gesture('shake', 1.2, 0.2);
        director.move(hd.clone().addScaledVector(f, 3.2).addScaledVector(r, -1.6).add(V(0, 0.2, 0)), hd.clone(), 1.2, ease.inOut, 40);
        this.ringGlow = 2;
        await this.say(p.lines[1]);
        await this.say(thoughts[heard]);
        heard++;
        p.held = false;
        player.lookAt(null);
        if (heard < people.talkers.length) this.giveControl(`Walk the market (${heard} of ${people.talkers.length})`);
        nextMark();
      } });
      p.it = kor.interactables.at(-1);
    }
    const nextMark = () => { const p = people.talkers.find((q) => !q.done); powers.markerTarget = p ? { pos: p.head().clone().add(V(0, 0.4, 0)), label: 'Listen' } : null; };
    nextMark();
    this.giveControl(`Walk the market (0 of ${people.talkers.length})`);
    await waitFor(() => heard >= people.talkers.length && !this.busy);
    powers.markerTarget = null;
    this.takeControl();
    await this.arrest(people);
    await ui.fade(1, 1.2);
  }

  // The market's people: four who speak to him (at stalls), the rest buying and selling. They step
  // back out of his way when he comes close, and look down.
  marketPeople() {
    const kor = this.kor, ch = this.assets.characters, M = MARKET, all = [];
    const add = (rig, at, yaw) => {
      rig.root.position.copy(at);
      rig.root.rotation.y = yaw;
      kor.scene.add(rig.root);
      const anim = new Animator(rig), loco = new Locomotion(this.mocap);
      loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
      loco.relax.adduct = 0.1;
      anim.play(loco, 0);
      anim.look.maxYaw = 0.6;
      const h = new THREE.Vector3();
      const p = { rig, anim, loco, at: at.clone(), home: at.clone(), yaw, head: () => rig.bonePosition('head', h) };
      all.push(p);
      return p;
    };
    const lines = [['kv1a', 'kv1b'], ['kv2a', 'kv2b'], ['kv3a', 'kv3b'], ['kv4a', 'kv4b']];
    const talkers = [
      add(createKorugarian(ch.abin, { seed: 101 }), V(M.x0 + 14, 0, -M.w + 3.2), 0),
      add(ch.katma ? createKatma(ch.katma, { citizen: true, seed: 55 }) : createKorugarian(ch.abin, { seed: 77 }), V(M.x0 + 33, 0, M.w - 3.2), Math.PI),
      add(createKorugarian(ch.abin, { seed: 303 }), V(M.x0 + 52, 0, -M.w + 3.2), 0),
      add(createKorugarian(ch.abin, { seed: 404 }), V(M.x0 + 71, 0, M.w - 3.4), Math.PI),
    ];
    talkers.forEach((p, i) => (p.lines = lines[i]));
    talkers[2].rig.root.scale.multiplyScalar(0.96); // (the old man, a little stooped)
    for (let i = 0; i < 8; i++) {
      const w = ch.katma && i % 3 === 0;
      const rig = w ? createKatma(ch.katma, { citizen: true, seed: 200 + i }) : createKorugarian(ch.abin, { seed: 500 + i * 11 });
      add(rig, V(M.x0 + 8 + i * 10 + Math.random() * 4, 0, (i % 2 ? 1 : -1) * (1 + Math.random() * 3)), Math.random() * 6);
    }
    // a guard by the far stalls, watching the street
    const guard = add(createKorugarian(ch.abin, { seed: 9, guard: true }), V(M.x0 + 92, 0, -2), -Math.PI / 2);
    guard.anim.lookAt(this.headOf(this.player.rig), 0.5);
    // out of his way: back off from him a step or two, eyes down; home again once he's past
    const away = new THREE.Vector3(), step = new THREE.Vector3();
    kor.updaters.push((dt) => {
      const hp = this.player.position;
      for (const p of all) {
        if (p === guard || p.held) { p.anim.update(dt); continue; }
        const r = p.rig.root, d = Math.hypot(r.position.x - hp.x, r.position.z - hp.z);
        const shy = d < 2.8 && this.player.control;
        away.set(r.position.x - hp.x, 0, r.position.z - hp.z).setLength(1.6);
        const want = shy ? _g.copy(p.home).add(away) : p.home;
        step.copy(want).sub(r.position).setY(0);
        const len = step.length();
        if (len > 0.05) r.position.addScaledVector(step.normalize(), Math.min(len, (shy ? 0.9 : 0.7) * dt));
        p.loco.speed = len > 0.05 ? (shy ? 0.9 : 0.7) : 0;
        p.loco.direction = shy ? -1 : 1;
        const face = shy ? Math.atan2(hp.x - r.position.x, hp.z - r.position.z) : len > 0.05 ? Math.atan2(step.x, step.z) : p.yaw;
        r.rotation.y += wrap(face - r.rotation.y) * Math.min(1, dt * 4);
        if (shy && !p.looking) { p.looking = true; p.anim.lookAt(() => p.rig.bonePosition('head', p.eyesDown ??= new THREE.Vector3()).add(V(0, -1, 0.3)), 0.6); }
        else if (!shy && p.looking) { p.looking = false; p.anim.lookAt(null); }
        p.anim.update(dt);
      }
    });
    return { all, talkers, guard };
  }

  // At the market's end: the guard takes a man who laughed. Sinestro, come back, holds him in his
  // light and sends him to the cells; Hal objects.
  async arrest(people) {
    const { director, audio, player, ui } = this, kor = this.kor, sin = this.sin, g = people.guard;
    const victim = people.all.find((p) => !p.lines && p !== g) ?? people.all[0];
    const vAt = g.rig.root.position.clone().add(V(-3, 0, 1.6));
    victim.home.copy(vAt);
    victim.rig.root.position.copy(vAt);
    victim.rig.root.rotation.y = Math.atan2(g.rig.root.position.x - vAt.x, g.rig.root.position.z - vAt.z);
    const mid = vAt.clone().lerp(g.rig.root.position, 0.5);
    if (player.position.distanceTo(mid) > 8) player.place(mid.clone().add(V(-7, 0, 2.5)), Math.atan2(mid.x - (mid.x - 7), 0));
    player.lookAt(() => victim.head(), 0.75);
    director.cut(mid.clone().add(V(-5.5, 1.7, 3.5)), mid.clone().add(V(0, 1.3, 0)), 40);
    g.anim.lookAt(() => victim.head(), 0.8);
    await wait(0.5);
    this.speakingRig = g.rig;
    await this.say('guard1');
    this.speakingRig = victim.rig;
    victim.anim.gesture('shake', 1, 0.5);
    await this.say('korTaken');
    this.speakingRig = null;
    // Sinestro's light round the man: a cage, lifting him
    sin.place(mid.clone().add(V(1.5, 0, -2.8)), Math.atan2(player.position.x - mid.x, player.position.z - mid.z));
    sin.anim.play(sin.standGen, 0);
    const cage = constructMesh(new THREE.CylinderGeometry(0.75, 0.75, 2.2, 8, 1, true).translate(0, 1.1, 0), { uPattern: 1, uScale: 0.18, outline: 0.01 });
    cage.userData.set('uForm', 0);
    cage.position.copy(vAt);
    kor.scene.add(cage);
    audio.constructForm(0.8);
    tween(0.5, (k) => cage.userData.set('uForm', k));
    await this.halClose(1.0, -1);
    await this.say('halTaken1');
    await this.sinClose(1.2);
    await this.sinSay('sinTaken1', [['laughed', () => sin.anim.gesture('chin', 1, 0.4)]]);
    const v0 = vAt.clone(), up = vAt.clone().add(V(0, 26, 60));
    tween(4, (k) => { const p = v0.clone().lerp(up, ease.in(k)); cage.position.copy(p); victim.rig.root.position.copy(p); victim.home.copy(p); }, ease.linear).then(() => { cage.removeFromParent(); victim.rig.root.visible = false; });
    await this.halClose(1.0);
    player.animator.gesture('shake', 1, 0.4);
    await this.say('halTaken2');
    await this.sinClose(1.2, -1);
    await this.sinSay('sinTaken2', [['city', 'present'], ['quarter', () => sin.bl.pointAt(V(0, 2, 90), 1.6)]]);
    sin.anim.play(sin.flyGen, 0.3);
    const s0 = sin.position.clone();
    audio.whoosh(1.4, 0.5);
    await tween(1.6, (k) => { sin.place(s0.clone().add(V(0, 70 * k * k, -40 * k * k)), sin.yaw); sin.flyState.k = Math.min(1, k * 2); }, ease.linear);
    sin.place(V(0, -40, 0), 0);
  }

  // ---------------------------------------------------------------- 8. the resistance
  // The old quarter. A hooded figure leads him into a courtyard: Katma Tui and what's left of the
  // resistance. She shows him the Halls of Correction, its cells barred with Sinestro's light. Then
  // his drones come over the wall, and Hal picks a side.
  async rebels() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    const kor = this.setupKorugar();
    ui.clock(this.save.info('rebels').clock);
    this.enterKorugar(QUARTER[0].clone().add(V(0, 0, -6)), 0);
    await ui.fade(0, 1.2);
    // the lane
    const k = this.assets.characters.katma;
    const katma = (this.katma = k ? this.addKatma(HIDEOUT.clone().add(V(10, 0, -3)), -Math.PI / 2) : null);
    const rebelsAt = [V(-5, 0, -4), V(-6.5, 0, 3.5), V(-2, 0, 5.5)].map((v) => v.add(HIDEOUT));
    const rebels = rebelsAt.map((at, i) => this.addPerson(kor, createKorugarian(this.assets.characters.abin, { seed: 700 + i * 31 }), at, Math.atan2(HIDEOUT.x + 6 - at.x, HIDEOUT.z - at.z)));
    powers.markerTarget = { pos: QUARTER[3].clone().setY(2), label: 'The old quarter' };
    this.giveControl('Patrol the old quarter');
    await waitFor(() => player.position.z > QUARTER[2].z - 6);
    this.bark('halQuarter');
    powers.markerTarget = { pos: HIDEOUT.clone().add(V(10, 2, -3)), label: 'Follow' };
    this.giveControl('Follow the hooded figure');
    await waitFor(() => Math.hypot(player.position.x - (HIDEOUT.x + 10), player.position.z - (HIDEOUT.z - 3)) < 6);
    // she slips into the courtyard; he follows
    if (katma) { katma.anim.lookAt(null); katma.home = HIDEOUT.clone().add(V(-1.5, 0, 0)); }
    powers.markerTarget = { pos: HIDEOUT.clone().setY(2), label: 'The courtyard' };
    await waitFor(() => player.position.distanceTo(HIDEOUT) < 6.5);
    powers.markerTarget = null;
    this.takeControl();
    await this.touchDown(); // (if he flew in after her)
    const stand = HIDEOUT.clone().add(V(3.4, 0, 0));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    // (she's arrived: held where she stands for the talk, turned to him)
    if (katma) { katma.rig.root.position.copy(katma.home); katma.held = true; katma.loco.speed = 0; }
    const kPos = katma?.rig.root.position ?? HIDEOUT;
    player.turnTo(Math.atan2(kPos.x - stand.x, kPos.z - stand.z));
    if (katma) { katma.rig.root.rotation.y = Math.atan2(stand.x - kPos.x, stand.z - kPos.z); katma.anim.lookAt(this.headOf(player.rig), 0.8); player.lookAt(() => katma.head(), 0.8); }
    for (const r of rebels) r.anim.lookAt(this.headOf(player.rig), 0.6);
    kor.focus(HIDEOUT);
    await this.katmaClose(1.2);
    await this.katmaSay('katma1');
    await this.halClose(1.0);
    player.animator.gesture('nod', 0.8, 0.3);
    await this.say('halKatma1');
    await this.katmaClose(1.0, -1);
    await this.katmaSay('katma2');
    await this.katmaClose(1.2, 1, 30);
    await this.katmaSay('katma3', [['cells', () => katma?.anim.gesture('chin', 1, 0.4)]]);
    await this.halClose(1.0, -1);
    await this.say('halKatma2');
    // the Halls of Correction, over their wall: the cells, the bars of his light, the people in them
    await ui.fade(1, 0.6);
    const prisoners = CELLS.map((c, i) => {
      const p = this.addPerson(kor, createKorugarian(this.assets.characters.abin, { seed: 900 + i * 17 }), c.clone().add(V((i % 2 ? 0.6 : -0.5), 0, 4.2)), Math.PI);
      p.anim.play(still(POSES.kneel, 0.8), 0);
      return p;
    });
    director.cut(PRISON.clone().add(V(-16, 15, -8)), CELLS[2].clone().add(V(0, 1.4, 2.4)), 44);
    kor.focus(PRISON.clone().add(V(0, 0, 14)));
    await ui.fade(0, 0.8);
    director.move(PRISON.clone().add(V(-10, 12, 0)), CELLS[2].clone().add(V(0, 1.2, 2.4)), 7, ease.inOut, 38);
    await this.katmaSay('katma4');
    director.cut(CELLS[1].clone().add(V(1.2, 1.4, -2.2)), CELLS[1].clone().add(V(0, 1.1, 2.6)), 34);
    await this.katmaSay('katma5');
    await this.say('halKatma3');
    await ui.fade(1, 0.6);
    for (const p of prisoners) p.rig.root.visible = false;
    kor.focus(HIDEOUT);
    await this.katmaClose(0.01);
    await ui.fade(0, 0.6);
    await this.katmaSay('katma6');
    // the raid: drones over the wall
    audio.alarm?.(0.6, true);
    this.speakingRig = rebels[0].rig;
    rebels[0].anim.gesture('shake', 1, 0.4);
    await this.say('korRebel');
    this.speakingRig = null;
    await this.katmaClose(0.8);
    await this.katmaSay('katma7');
    // into the doorways: to the walls, and down
    for (const [i, r] of rebels.entries()) { r.home = HIDEOUT.clone().add(V(-7.4, 0, -6 + i * 4)); wait(2.2).then(() => { r.held = true; r.anim.play(still(POSES.kneel, 0.6), 0.4); }); }
    if (katma) { katma.held = false; katma.home = HIDEOUT.clone().add(V(-7.2, 0, 5.8)); }
    const swarm = (this.swarm = new DroneSwarm({ scene: kor.scene, physics: kor.physics, powers, player, audio, director, arena: 400, blocks: [] }));
    kor.updaters.push((dt, t) => swarm.update(dt, t));
    powers.healDelay = 5; powers.healRate = 6;
    this.giveControl('Protect the resistance: destroy the drones');
    this.bark('halRaid');
    for (const wave of [3, 4]) {
      for (let i = 0; i < wave; i++) swarm.spawn(HIDEOUT.clone().add(V(-6 + i * 4, 9 + (i % 2) * 2, -12 + (i % 3) * 10)), 'attacker');
      await waitFor(() => swarm.alive.length === 0);
      await wait(1.4);
    }
    this.takeControl();
    powers.healDelay = 4; powers.healRate = 8;
    for (const r of rebels) { r.held = false; r.anim.play(r.loco, 0.6); }
    if (katma) { katma.home = HIDEOUT.clone().add(V(-1.5, 0, 0)); }
    // down out of the air (he's usually flying by the last drone), then back to her; from out over
    // the lane, or landed on a wall or the crates, he's brought back in a cut rather than walked
    // through the walls
    const stand2 = HIDEOUT.clone().add(V(2.2, 0, 0.4));
    const away = () => Math.hypot(player.position.x - stand2.x, player.position.z - stand2.z) > 12;
    if (!away()) await this.touchDown();
    if (away() || Math.abs(player.position.y - stand2.y) > 0.6) {
      powers.holster();
      await ui.fade(1, 0.6);
      player.place(stand2, -Math.PI / 2);
      if (katma) katma.rig.root.position.copy(katma.home);
      await wait(0.3);
      ui.fade(0, 0.8);
    }
    await wait(1.2);
    if (katma) await Promise.race([waitFor(() => katma.rig.root.position.distanceTo(katma.home) < 0.08), wait(6)]);
    await player.walkTo(stand2, player.walkSpeed);
    if (katma) { katma.rig.root.position.copy(katma.home); katma.held = true; katma.loco.speed = 0; player.turnTo(Math.atan2(katma.rig.root.position.x - stand2.x, katma.rig.root.position.z - stand2.z)); katma.rig.root.rotation.y = Math.atan2(stand2.x - katma.rig.root.position.x, stand2.z - katma.rig.root.position.z); }
    await this.katmaClose(1.2);
    await this.katmaSay('katma8');
    await this.halClose(1.0);
    await this.say('halKatma4');
    await wait(0.4);
  }

  // Katma Tui, in the resistance's colours (Characters.createKatma), walking and turning her head.
  addKatma(at, yaw) {
    const rig = createKatma(this.assets.characters.katma);
    return this.addPerson(this.kor, rig, at, yaw);
  }

  // Someone on Korugar: a rig with its idle and walk, eased home (`home`) when it's moved.
  addPerson(kor, rig, at, yaw) {
    rig.root.position.copy(at);
    rig.root.rotation.y = yaw;
    kor.scene.add(rig.root);
    const anim = new Animator(rig), loco = new Locomotion(this.mocap);
    loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
    loco.relax.adduct = 0.1;
    anim.play(loco, 0);
    anim.look.maxYaw = 0.7;
    const h = new THREE.Vector3();
    const p = { rig, anim, loco, home: at.clone(), head: () => rig.bonePosition('head', h) };
    const step = new THREE.Vector3();
    kor.updaters.push((dt) => {
      step.copy(p.home).sub(rig.root.position).setY(0);
      const len = step.length();
      if (len > 0.05 && !p.held) {
        rig.root.position.addScaledVector(step.normalize(), Math.min(len, 1.5 * dt));
        rig.root.rotation.y += wrap(Math.atan2(step.x, step.z) - rig.root.rotation.y) * Math.min(1, dt * 6);
        loco.speed = 1.4;
      } else if (!p.held) loco.speed = 0;
      anim.update(dt);
    });
    return p;
  }

  katmaSay(key, cues = []) {
    const k = this.katma;
    if (!k) return this.say(key);
    this.speakingRig = k.rig;
    let stop = null;
    if (cues.length) { const t0 = this.engine.time; stop = onFrame(() => { for (const c of cues) if (!c.done && this.engine.time - t0 > 0.4) { c.done = true; c[1](); } }); }
    return this.say(key).finally(() => { stop?.(); if (this.speakingRig === k.rig) this.speakingRig = null; });
  }
  katmaClose(duration = 1.4, side = 1, fov = 32) {
    const k = this.katma;
    if (!k) return this.halClose(duration);
    const h = k.head().clone(), yaw = k.rig.root.rotation.y;
    const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 1.7).addScaledVector(r, 0.45 * side).add(V(0, -0.06, 0)), h.clone().add(V(0, -0.04, 0)), duration, ease.inOut, fov);
  }

  // ---------------------------------------------------------------- 9. the report
  // Sinestro comes down into the courtyard. The crux: fear is order; that's a cage. Hal goes to Oa
  // and tells the Guardians. They will hear Sinestro. The end of Part Five.
  async report() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    const kor = this.setupKorugar();
    ui.clock(this.save.info('rebels').clock);
    if (this.current !== kor) {
      this.enterKorugar(HIDEOUT.clone().add(V(2.2, 0, 0.4)), -Math.PI / 2);
      this.katma ??= this.assets.characters.katma ? this.addKatma(HIDEOUT.clone().add(V(-1.5, 0, 0)), Math.PI / 2) : null;
      await ui.fade(0, 1.0);
    }
    this.takeControl();
    const sin = (this.sin ??= this.addSinestroAt(kor, kor.blocks));
    // down out of the evening into the courtyard
    const land = HIDEOUT.clone().add(V(1.2, 0, -4.2)), from = land.clone().add(V(20, 60, -30));
    const yaw = Math.atan2(player.position.x - land.x, player.position.z - land.z);
    sin.place(from, yaw);
    sin.anim.play(sin.flyGen, 0);
    sin.flyState.k = 0.8;
    sin.bl.lookHome = () => this.headOf(player.rig);
    director.cut(HIDEOUT.clone().add(V(6, 1.8, 4)), land.clone().add(V(0, 6, 0)), 46);
    audio.whoosh(1.8, 0.5);
    await tween(1.8, (k) => { sin.place(from.clone().lerp(land, 1 - (1 - k) ** 3), yaw); sin.flyState.k = 0.8 * (1 - k); }, ease.linear);
    sin.anim.play(sin.standGen, 0.6);
    audio.land(0.5);
    sin.yaw = yaw;
    player.turnTo(Math.atan2(land.x - player.position.x, land.z - player.position.z));
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    await wait(0.6);
    await this.sinClose(1.3);
    await this.sinSay('sinRep1', [['traitors', 'dismiss']]);
    await this.halClose(1.0);
    player.animator.gesture('beat', 0.6, 0.5);
    await this.say('halRep1');
    await this.sinClose(1.4, -1);
    await this.sinSay('sinRep2', [['beginning', 'present'], ['afraid', () => sin.anim.gesture('chin', 1.2, 0.5)], ['obey', () => sin.anim.gesture('beat', 0.6, 0.6)]]);
    await this.halClose(1.2, -1);
    player.animator.gesture('shake', 0.9, 0.4);
    await this.say('halRep2');
    await this.sinClose(1.2);
    await this.sinSay('sinRep3', [['Guardians', 'present'], ['thank', () => sin.anim.gesture('tilt', 1, 0.4)]]);
    await this.halClose(1.0);
    await this.say('halRep3');
    // he goes; she speaks
    sin.anim.play(sin.flyGen, 0.3);
    const s0 = sin.position.clone();
    audio.whoosh(1.4, 0.5);
    await tween(1.4, (k) => { sin.place(s0.clone().add(V(0, 60 * k * k, 0)), yaw); sin.flyState.k = Math.min(1, k * 2); }, ease.linear);
    sin.place(V(0, -40, 0), 0);
    if (this.katma) {
      const kp = this.katma.rig.root.position;
      player.turnTo(Math.atan2(kp.x - player.position.x, kp.z - player.position.z));
      this.katma.rig.root.rotation.y = Math.atan2(player.position.x - kp.x, player.position.z - kp.z);
      player.lookAt(() => this.katma.head(), 0.8);
      await this.katmaClose(1.2);
      await this.katmaSay('katma9');
    }
    // up out of the city, and the jump to Oa
    this.ringSay('ringOaJump');
    this.giveControl('Fly up out of the city');
    await waitFor(() => player.flying && player.position.y > 70);
    this.takeControl();
    await voyage(this, { from: 'korugar', to: 'oa' });
    // the hall: the Guardians on their pillars, Hal alone on the dais
    this.setupOa();
    this.addGuardians();
    this.hallActive = true;
    const dais = V(HALL.x, DAIS_TOP, HALL.z);
    this.enterOa(dais, Math.PI);
    ui.clock(this.save.info('report').clock);
    this.takeControl();
    this.standDown();
    const elder = this.elder, gs = this.guardians;
    const elderHead = () => elder.bonePosition('head', _p).add(V(0, 0.08, 0));
    player.lookAt(elderHead, 0.85);
    const choir = audio.pad([98, 146.8, 196, 293.7], 0, { cutoff: 900, fadeIn: 3 });
    choir.level(0.05, 3);
    director.cut(HALL.clone().add(V(2.4, 2.6, 6.8)), HALL.clone().add(V(0, 6.2, -10)), 48);
    tween(0.9, (k) => (this.engine.gradeUniforms.uFlash.value = 1 - k), ease.out);
    director.move(HALL.clone().add(V(1.6, 2.8, 5.4)), HALL.clone().add(V(0, 6.8, -10)), 6, ease.inOut, 44);
    await wait(2.0);
    await this.gSay('gRep1');
    await this.halUp(1.2);
    player.animator.gesture('beat', 0.5, 0.6);
    await this.say('halRep4');
    await this.gClose(gs[1], 1.6, 0.4);
    await this.gSay('gRep2', gs[1], [['seven', () => gs[1].anim.gesture('chin', 1.1, 0.5)]]);
    await this.halUp(1.2, -0.5);
    player.animator.gesture('shake', 0.9, 0.4);
    await this.say('halRep5');
    await this.gClose(elder, 1.6);
    await this.gSay('gRep3', elder, [['law', () => elder.anim.gesture('nod', 1, 0.4)]]);
    await this.gClose(elder, 1.2, -0.3);
    elder.gu.uHandL.value = 1;
    elder.bl.play('decree');
    await this.gSay('gRep4');
    setTimeout(() => (elder.gu.uHandL.value = 0), 1200);
    await this.halUp(1.4);
    await wait(1.2);
    choir.stop(4);
    await ui.fade(1, 2.0);
    this.hallActive = false;
    const pick = await ui.screen({ kicker: 'Part Five · Probation', title: 'PROBATION', subtitle: 'End of Part Five', body: 'Sinestro will stand before the Guardians. On Korugar, Katma Tui is waiting to see what that is worth. In Coast City, Carol knows.', buttons: ['Part Six: Exile', 'Quit to title'] });
    if (pick === 0) { ExileSave.newGame(); ExileSave.resumeAfterReload('dawn'); }
    else { location.hash = ''; location.reload(); }
    await new Promise(() => {});
  }
}

const _h = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3();
