import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { CoastSave, PrisonerSave } from '../engine/Save.js';
import { Story } from './Story.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { POSES, still, makePose, blendInto, copyPose } from '../characters/Poses.js';
import { solveTwoBone } from '../characters/IK.js';
import { createCarol, createRing, createHal, createHammond, createLightFigure, JAW } from '../characters/Characters.js';
import { MocapClip } from '../characters/Mocap.js';
import { Hammond } from '../enemies/Hammond.js';
import { Sinestro } from '../enemies/Sinestro.js';
import { createShaft } from '../fx/GreenLight.js';
import { SHIP, ABIN_SPOT, terrainHeight } from '../scenes/CrashSite.js';
import { constructMesh, handGeometry, createBeam } from '../powers/Constructs.js';
import { Particles } from '../fx/Particles.js';
import { Bedroom } from '../scenes/Bedroom.js';
import { Ferris, CAROL_SPOT, CAR_SPOT, GATE, LOT, FERRIS_PROPS, RUNWAY_Z, CEMETERY, GRAVE, CEMETERY_PROPS } from '../scenes/Ferris.js';
import { loadProps, prop, meshes, hasProp } from '../props/Props.js';
import { planDrive, timeLeg, rollCar } from '../props/Car.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const SEATED = makePose({ ...POSES.sitEdge, sx: 0.05, nx: -0.1, kx: -0.15, ky: 0.05 });

// Two-bone IK in a sitting leg's plane: the thigh, knee and foot angles that put the ankle `dy`
// below and `dz` ahead of the hip joint with the knee bent up (a: thigh, b: shin). `toe` is the
// foot's pitch (negative: toes up). Sitting poses are solved for the seat they sit on, so the feet
// land on the car's floor instead of going through it.
function legTo(p, side, dy, dz, a, b, toe = -0.15) {
  const d = Math.min(Math.hypot(dy, dz), a + b - 0.002), psi = Math.atan2(-dz, -dy);
  const phi = psi - Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const ky = -a * Math.cos(phi), kz = -a * Math.sin(phi); // the knee, from the hip
  const shin = Math.atan2(-(dz - kz), -(dy - ky));
  p[`l${side}x`] = phi;
  p[`k${side}`] = shin - phi;
  p[`f${side}`] = toe - shin;
  return p;
}
const legLengths = (rig) => {
  const w = (n) => rig.bonePosition(n, new THREE.Vector3());
  return [w('thigh_L').distanceTo(w('shin_L')), w('shin_L').distanceTo(w('foot_L'))];
};
// At the wheel: low in the bucket seat and leaned back, knees up either side of the column, feet on
// the pedals. The car's headroom (0.86 m from cushion to headliner) is less than Hal's sitting height,
// so he sits sunk and reclined like a tall man in a low coupe: a little more upright and the top of
// his head came out through the roof. The hands are put on the rim by the arm IK (driveHands).
function drivingPose(rig, car) {
  const { seat, pedals } = car.userData, [a, b] = legLengths(rig), hipY = seat.y - 0.08;
  const p = makePose({ hy: hipY - rig.hipsHeight, sx: -0.44, cx: -0.1, nx: 0.25, kx: 0.18, lLz: 0.12, lRz: -0.05,
    aL: [0.3, -0.35, 0.85], eL: 0.9, aR: [-0.3, -0.35, 0.85], eR: 0.9 });
  legTo(p, 'L', pedals.y - hipY, pedals.z - seat.z - 0.05, a, b, -0.3);
  return legTo(p, 'R', pedals.y - hipY, pedals.z - seat.z + 0.02, a, b, -0.12);
}
// Getting out: turned to the open door, knees up to clear the sill, then feet on the ground outside.
function swingPose(rig, car) {
  const [a, b] = legLengths(rig), p = makePose({ hy: car.userData.seat.y - rig.hipsHeight, sx: -0.05, lLz: 0.06, lRz: -0.06, aL: [0.35, -0.8, 0.4], eL: 0.6, aR: [-0.35, -0.8, 0.4], eR: 0.6 });
  legTo(p, 'L', -0.08, 0.62, a, b, 0);
  return legTo(p, 'R', -0.1, 0.6, a, b, 0);
}
function outPose(rig, car) {
  const { seat } = car.userData, [a, b] = legLengths(rig);
  const p = makePose({ hy: seat.y - rig.hipsHeight, sx: 0.28, cx: 0.08, nx: 0.05, lLz: 0.08, lRz: -0.08, aL: [0.25, -0.7, 0.6], eL: 0.7, aR: [-0.25, -0.7, 0.6], eR: 0.7 });
  legTo(p, 'L', 0.08 - seat.y, 0.5, a, b, 0);
  return legTo(p, 'R', 0.08 - seat.y, 0.46, a, b, 0);
}
// Sitting on the trunk lid, thighs out over the bumper, the shins hanging in front of it, slumped.
function trunkPose(rig, hipY) {
  const [a, b] = legLengths(rig), p = makePose({ hy: hipY - rig.hipsHeight, sx: 0.2, cx: 0.12, nx: 0.12, kx: 0.06, lLz: 0.1, lRz: -0.12 });
  legTo(p, 'L', -0.4, 0.44, a, b, 0.25);
  return legTo(p, 'R', -0.42, 0.38, a, b, 0.3);
}
// A keyed move: each key sets some channels (numbers or arrays) at its time `t`, the others holding
// their last values; in between they follow monotone cubic curves, so a value held from one key to
// the next stays put (a planted foot doesn't slide) and nothing overshoots its keys. Returns
// (t, out) => out with every channel at time t.
function keyed(keys) {
  const full = [];
  for (const key of keys) full.push({ ...full.at(-1), ...key });
  const T = full.map((key) => key.t), last = T.length - 1;
  const chans = Object.keys(full[0]).filter((n) => n !== 't').map((name) => {
    const arr = Array.isArray(full[0][name]);
    const series = (arr ? full[0][name] : [0]).map((_, j) => {
      const v = full.map((key) => (arr ? key[name][j] : key[name]));
      const m = v.map((_, i) => {
        if (i === 0 || i === last) return 0;
        const d0 = (v[i] - v[i - 1]) / (T[i] - T[i - 1]), d1 = (v[i + 1] - v[i]) / (T[i + 1] - T[i]);
        return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1);
      });
      return { v, m };
    });
    return { name, arr, series };
  });
  return (t, out = {}) => {
    let i = 0;
    while (i < last - 1 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i], u = THREE.MathUtils.clamp((t - T[i]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
    const a = 2 * u3 - 3 * u2 + 1, b = (u3 - 2 * u2 + u) * h, c = 3 * u2 - 2 * u3, d = (u3 - u2) * h;
    for (const { name, arr, series } of chans) {
      const val = series.map(({ v, m }) => a * v[i] + b * m[i] + c * v[i + 1] + d * m[i + 1]);
      if (arr) { const o = (out[name] ??= []); for (let j = 0; j < val.length; j++) o[j] = val[j]; } else out[name] = val[0];
    }
    return out;
  };
}

// Carol's body language, in her scan's metres (1.7 m; shoulders at ±0.17, 1.29; arms about 0.55 m):
// her left hand on her hip while she listens, the right one making her points.
const CAROL_STANCES = { hip: { L: [0.2, 0.98, 0.03], poleL: [1, 0, -0.6] } };
const CAROL_GESTURES = {
  // a hand out, palm up: "then explain", "where were you?"
  open: { dur: 1.4, rate: 7, poleR: [-0.8, -0.7, -0.2], R: [[0.35, [-0.2, 1.08, 0.36]], [1.1, [-0.21, 1.1, 0.35]]], lean: [[0.3, 0.05, 0], [1.1, 0.02, 0]], head: [[0.3, 'tilt', 0.8, 0.4]] },
  // the flat of the hand, down and across: "you're done"
  cut: { dur: 1.1, rate: 10, poleR: [-1, -0.5, -0.3], R: [[0.2, [-0.08, 1.18, 0.38]], [0.45, [-0.36, 1.05, 0.3]], [0.9, [-0.37, 1.04, 0.29]]], head: [[0.25, 'beat', 0.4, 0.8]] },
  // a hand up, palm out: "don't"
  stop: { dur: 1.5, rate: 9, poleR: [-1, -0.6, -0.2], R: [[0.25, [-0.12, 1.32, 0.38]], [1.2, [-0.12, 1.33, 0.37]]], head: [[0.2, 'shake', 0.7, 0.35]] },
  // a hand to her chest: "I covered for you"
  chest: { dur: 1.4, rate: 7, poleR: [-1, -0.4, -0.3], R: [[0.3, [-0.03, 1.27, 0.17]], [1.1, [-0.03, 1.26, 0.18]]], lean: [[0.3, -0.03, 0.08], [1.1, 0, 0]] },
};

// Part Three, "Coast City": the morning after. Hal wakes at 9:41 in daylight, to four voicemails
// (the landlord, Tom twice, Carol); the apartment's other news (an empty fridge, red-ink bills, a
// rent notice under the door); his car, which takes three tries; the desert road to Ferris
// Aircraft; Carol on the apron beside the prototype he was meant to fly at nine. She fires him.
// The ring stays on his finger but its powers stay out of it: a civilian morning.
export class Coast extends Story {
  get save() { return CoastSave; }

  steps() {
    return {
      morning: () => this.morning(),
      drive: () => this.drive(),
      ferris: () => this.ferris(),
      carol: () => this.carolScene(),
      after: () => this.after(),
      wreck: () => this.wreck(),
      test: () => this.test(),
      catch: () => this.catchJet(),
      hector: () => this.hector(),
      grave: () => this.grave(),
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps([...FERRIS_PROPS, 'phone', 'fridge', 'coffee', 'f104', 'm35', 'lighttower', ...CEMETERY_PROPS]);
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0.45);
    if (id === 'morning') { this.setupApartment(); return; }
    this.setupFerris();
    if (id === 'drive') return; // starts in the car
    this.ferrisScene.car.rotation.y = Math.PI; // parked nose to the hangars, as he left it
    if (id === 'test') { this.readyJet(); return; } // test() puts him by his car
    if (id === 'wreck' || id === 'grave') return; // each sets its own scene
    if (id === 'hector') {
      // in the suit on the runway beside the jet he set down, Carol a few steps off
      this.putOnSuit();
      const f = this.ferrisScene;
      f.parkJet(SET_DOWN.clone().setY(0), Math.PI / 2);
      const at = SET_DOWN.clone().setY(0).add(V(3, 0, 9.5));
      this.enterFerris(at, Math.PI);
      const carol = this.addCarol();
      if (carol) { carol.root.position.copy(at).add(V(0.8, 0, 2.8)); carol.root.rotation.y = Math.atan2(at.x - carol.root.position.x, at.z - carol.root.position.z); this.cb.stance('hip'); }
      this.powerUp();
      this.director.mode = 'follow';
      await ui.fade(0, 1.0);
      return;
    }
    if (id === 'catch') {
      // in the suit, in the air over the hangars, the jet coming round to the north-west
      this.putOnSuit();
      this.enterFerris(GAP.clone(), Math.PI);
      this.readyJet();
      this.flyJet(SPIN_T - 3);
      this.addCarol();
      this.powerUp();
      player.place(V(31, 36, -12), Math.PI);
      player.airborne(V(-2, 3, -9));
      this.director.mode = 'follow';
      await ui.fade(0, 1.0);
      return;
    }
    // in the staff lot by his car, or on the apron with Carol
    // (the car is turned round, so its driver's side, +x in its own frame, is -x here)
    const at = { ferris: CAR_SPOT.clone().add(V(-2.45, 0, 0.45)), carol: CAROL_SPOT.clone().add(V(-0.4, 0, 3.4)), after: CAR_SPOT.clone().add(V(-2.45, 0, 0.45)) }[id];
    this.enterFerris(at, id === 'carol' ? Math.PI : Math.PI * 0.9);
    if (id === 'carol') this.addCarol();
    this.director.mode = 'follow';
    await ui.fade(0, 1.2);
  }

  // ---------------------------------------------------------------- the apartment, by day
  setupApartment() {
    const { player, audio } = this;
    const room = (this.bedroom = new Bedroom(this).build({ morning: true }));
    this.show(room);
    this.playerActive = true;
    this.inBed = false;
    player.spawn(room.physics, room.scene, V(-1.3, 0, 1.35), Math.PI);
    player.camDist = 2.1;
    player.surface = 'wood';
    player.ground = () => 0;
    room.setClock('9:41');
    this.ambience(audio.traffic(0.04), audio.roomTone(0.035));
    let bird = 2;
    onFrame((dt) => { if (this.current === room && (bird -= dt) < 0) { bird = 3 + Math.random() * 7; audio.birdsong(); } });
    // the phone on the nightstand, the mail on the hall table, the notice under the door
    const phone = (this.phone = buildPhone());
    phone.position.set(-0.13, 0.5555, -1.56);
    phone.rotation.y = 0.4;
    room.scene.add(phone);
    room.scene.add(buildMail(V(-3.42, 0.826, 3.3)));
    const notice = (this.notice = buildNotice());
    notice.position.set(-4.3, 0.003, 2.72);
    notice.rotation.y = 0.5;
    room.scene.add(notice);
    // the things worth a look on the way out
    room.interact({ position: V(1.25, 0, -1.25), radius: 0.9, look: V(1.3, 0.92, -1.86), label: 'Look at the photo', action: () => this.say('photoMorning') });
    room.interact({ position: V(1.85, 0, -0.35), radius: 0.9, look: V(2.4, 1.5, -0.35), label: 'Look outside', action: () => this.say('windowMorning') });
    room.interact({ position: V(0.8, 0, 2.35), radius: 0.8, look: V(0.8, 1.0, 3.0), label: 'Check the fridge', action: () => this.checkFridge() });
    room.interact({ position: V(-3.4, 0, 3.0), radius: 0.8, look: V(-3.4, 0.83, 3.3), label: 'Look at the mail', action: async () => { this.audio.paper(); await this.lines('bills1', 'bills2'); } });
    this.noticeSpot = room.interact({ position: V(-3.95, 0, 2.72), radius: 0.7, look: V(-4.3, 0.05, 2.72), label: 'Pick up the notice', action: () => this.readNotice() });
    return room;
  }

  // putInBed darkens the room for the night; this puts the morning back
  dayLights(room) {
    room.hemi.intensity = 0.55;
    room.hemi.color.setHex(0xc4d6ea);
  }

  async checkFridge() {
    const room = this.bedroom, hum = this.audio.fridge(true);
    await room.openFridge(true, tween);
    await this.say('fridge');
    await room.openFridge(false, tween);
    hum?.stop(0.3);
    this.audio.fridge(false);
  }

  async readNotice() {
    if (this.noticeRead) return;
    this.noticeRead = true;
    this.noticeSpot.enabled = false;
    const { director, player } = this;
    this.takeControl();
    player.lookAt(this.notice.position, 0.9);
    const p = this.notice.position;
    director.move(p.clone().add(V(0.5, 0.75, 0.35)), p.clone(), 1.0, ease.inOut, 40);
    await wait(0.9);
    this.audio.paper();
    await this.say('notice');
    this.notice.visible = false; // into his pocket
    player.lookAt(null);
    this.giveControl('Get to Ferris Aircraft');
  }

  // A prop held flat in the palm (the scans have no finger bones): parented to the hand bone and
  // eased onto the palm's surface (Rig.palm), and each frame, after the arm IK, the wrist turned so
  // the prop's face (+Y of its own frame) looks at his eyes with its top up.
  holdInHand(obj, side) {
    const rig = this.hal, anim = this.player.animator, hand = rig.bones[`hand_${side}`], palm = rig.palm(side);
    hand.attach(obj); // where it is, for now
    const Y = palm.normal, Z = palm.along.clone().negate(), X = new THREE.Vector3().crossVectors(Y, Z);
    const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const p1 = palm.centre.clone().addScaledVector(Y, palm.surface + 0.0045);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    tween(0.35, (k) => { obj.position.lerpVectors(p0, p1, k); obj.quaternion.slerpQuaternions(q0, q1, k); }, ease.inOut);
    const w = { k: 0 };
    tween(0.7, (k) => (w.k = k), ease.inOut);
    const Lt = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(palm.along, palm.normal), palm.along, palm.normal).transpose();
    const N = new THREE.Vector3(), A = new THREE.Vector3(), C = new THREE.Vector3(), eye = new THREE.Vector3(), at = new THREE.Vector3();
    const m = new THREE.Matrix4(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
    anim.post = () => {
      rig.bonePosition('head', eye).y += 0.07;
      obj.getWorldPosition(at);
      N.subVectors(eye, at).normalize(); // the palm's normal, to the eyes
      A.set(0, 1, 0).addScaledVector(N, -N.y).normalize(); // the fingers, up
      C.crossVectors(A, N);
      qw.setFromRotationMatrix(m.makeBasis(C, A, N).multiply(Lt));
      hand.parent.getWorldQuaternion(qp).invert();
      hand.quaternion.slerp(qp.multiply(qw), w.k);
      hand.updateMatrixWorld(true);
    };
    return { release: () => { anim.post = null; } };
  }

  // The phone: buzzing on the nightstand, its screen lit.
  buzzPhone(times = 2) {
    this.audio.buzz(times);
    const p0 = this.phone.position.clone(), r0 = this.phone.rotation.y;
    this.phone.userData.screen.material.color.setScalar(1.0);
    return tween(times * 0.6, (k) => {
      const on = (k * times * 0.6) % 0.6 < 0.38;
      this.phone.position.set(p0.x + (on ? (Math.random() - 0.5) * 0.003 : 0), p0.y, p0.z + (on ? (Math.random() - 0.5) * 0.003 : 0));
      this.phone.rotation.y = r0 + (on ? (Math.random() - 0.5) * 0.02 : 0) + k * 0.05;
    }, ease.linear);
  }

  async morning() {
    const { ui, director, audio, player } = this;
    const room = this.bedroom;
    this.takeControl();
    const sleep = this.putInBed(0.25);
    this.dayLights(room);
    room.setClock('9:41');
    ui.clock('9:41 AM');
    ui.objective(null);
    // the concept-art composition again, in daylight
    director.cut(V(-1.95, 1.62, 1.75), V(-0.2, 0.85, -1.0), 58);
    await ui.fade(0, 2.5);
    director.move(V(-1.7, 1.5, 1.25), V(-0.35, 0.8, -1.15), 9, ease.inOut);
    await wait(1.6);
    await this.buzzPhone(2);
    await tween(1.6, (k) => (sleep.unrest = 0.25 + k * 0.6));
    await wait(0.8);
    await this.buzzPhone(3);
    // awake in stages: rolled to the edge, up on an elbow to squint at the clock, the blanket thrown
    // back, the legs off the edge, sitting; then both hands down over his face
    const clock = V(0.02, 0.62, -1.7);
    director.move(V(0.7, 1.25, -0.2), V(-0.5, 0.85, -1.15), 3.2, ease.inOut, 46);
    await this.getUpFromBed({
      to: V(-0.5, 0, -1.15),
      whilePropped: async () => {
        player.lookAt(clock, 0.9);
        await wait(0.5);
        await this.say('halLate1');
        await wait(0.2);
      },
    });
    director.move(V(0.6, 1.3, -0.35), V(-0.45, 1.05, -1.15), 1.4, ease.inOut, 46);
    player.lookAt(null);
    await this.rubFace();
    this.handsOnKnees(true);
    player.lookAt(clock, 0.7);
    player.animator.gesture('shake', 0.9, 0.5);
    await this.say('halLate2');
    // the phone: picked up, on speaker, four voicemails
    const phone = this.phone, chest = new THREE.Vector3(), rig = this.hal;
    this.handsOnKnees(false, ['L']);
    // the hand down onto the phone, then up with it, flat in the palm, the screen turned to his eyes
    player.animator.reach('L', phone.position.clone().add(V(0, 0.075, 0)), { pole: V(0.8, -0.5, -0.4), rate: 5 });
    player.lookAt(phone.position, 0.8);
    await wait(0.85);
    const grip = this.holdInHand(phone, 'L');
    const fwd = V(1, 0, 0);
    player.animator.reach('L', () => rig.bonePosition('chest', chest).addScaledVector(fwd, 0.3).add(V(0, 0.1, -0.03)), { pole: V(0.6, -0.9, -0.4), rate: 4 });
    player.lookAt(() => phone.getWorldPosition(_h2), 0.85);
    director.move(V(0.45, 1.35, -0.75), V(-0.35, 1.15, -1.1), 2, ease.inOut, 40);
    await wait(0.8);
    await this.say('halCalls');
    phone.userData.screen.material.color.setScalar(0.85);
    for (const key of ['vmLandlord', 'vmTom1', 'vmTom2', 'vmCarol']) {
      audio.voicemail();
      await wait(0.5);
      if (key === 'vmTom2') director.move(V(0.75, 1.25, -1.35), V(-0.45, 1.25, -1.1), 3, ease.inOut, 36);
      await this.say(key);
    }
    player.lookAt(null);
    await wait(0.4);
    player.animator.gesture('nod', 1.2, 0.3);
    await this.say('halMorning');
    // pocketed; up off the bed
    grip.release();
    phone.visible = false;
    player.animator.reach('L', null);
    this.handsOnKnees(false);
    player.autoAnim = true;
    player.animator.play(player.loco, 0.9);
    const p2 = V(-0.05, 0, -1.1);
    const o = player.object, p1 = o.position.clone();
    await tween(0.9, (k) => o.position.lerpVectors(p1, p2, k), ease.inOut);
    player.place(p2, Math.PI / 2);
    this.giveControl('Get to Ferris Aircraft');
    // out of the front door (the notice first, if he walked past it)
    await new Promise((resolve) => {
      room.interact({ position: V(-4.05, 0, 2.82), radius: 0.9, look: V(-4.6, 1.2, 2.82), label: 'Leave for work', action: async () => {
        if (!this.noticeRead) await this.readNotice();
        this.takeControl();
        await this.say('halDoor');
        resolve();
      } });
    });
    audio.door();
    await ui.fade(1, 1.2);
  }

  // ---------------------------------------------------------------- Ferris, and the road there
  setupFerris() {
    if (this.ferrisScene) return this.ferrisScene;
    this.bedroom?.dispose();
    this.bedroom = null;
    return (this.ferrisScene = new Ferris(this).build());
  }

  enterFerris(at, yaw) {
    const { player, audio } = this, f = this.ferrisScene;
    this.show(f);
    this.playerActive = true;
    player.spawn(f.physics, f.scene, at, yaw);
    player.ground = () => 0;
    player.surface = 'stone';
    player.camDist = 2.6;
    f.focus(at);
    this.ambience(audio.wind(0.05), audio.traffic(0.015));
  }

  // Hal's car, out of its bay behind his building, up the road to the field and into the lot.
  async drive() {
    const { ui, director, audio, player } = this;
    const f = this.setupFerris(), car = f.car;
    this.show(f);
    this.takeControl();
    ui.objective(null);
    this.ambience(audio.traffic(0.05), audio.wind(0.03));
    const placeCar = (p, yaw) => { car.position.copy(p); car.rotation.y = yaw; };
    placeCar(f.lotCarSpot, 0);
    f.focus(f.lotCarSpot);
    const local = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), car.rotation.y).add(car.position);
    // out of his building's door and into the car (out of the physics: the car carries him)
    await this.getIn(car);
    const animOff = onFrame((dt) => player.animator.update(dt));
    // turning it over: twice nothing, then it catches (through the windscreen, from the driver's side)
    director.move(local(2.3, 1.35, 2.7), local(0.3, 0.98, -0.3), 1.6, ease.inOut, 36);
    await wait(1.4);
    const shake = (dur, amt) => tween(dur, () => (car.position.y = (Math.random() - 0.5) * amt), ease.linear).then(() => (car.position.y = 0));
    for (const [d, key] of [[1.3, 'car1'], [1.7, 'car2']]) {
      audio.starter(d, false);
      await shake(d, 0.012);
      await wait(0.5);
      await this.say(key);
    }
    audio.starter(1.0, true);
    await shake(1.0, 0.012);
    const motor = audio.engine(0.12);
    this.motor = motor;
    const ex = car.userData.exhaust;
    const puff = (n, k = 1) => f.exhaust.emit(n, (p, v) => {
      const q = local(ex.x, ex.y, ex.z);
      p[0] = q.x; p[1] = q.y; p[2] = q.z;
      v[0] = (Math.random() - 0.5) * 0.6; v[1] = 0.3 + Math.random() * 0.4; v[2] = (Math.random() - 0.5) * 0.6;
    }, { life: 2.4, size: [0.3 * k, 1.4 * k], color: [[0.35, 0.35, 0.36, 0.55], [0.55, 0.55, 0.56, 0]] });
    puff(40, 1.3);
    await shake(0.6, 0.02);
    await this.say('car3');
    // out of the bay: backed out with the tail swung round toward the dumpster, a stop to change
    // gear, then forward round onto the boulevard (it turns about its rear axle, never sliding or
    // swinging to a new heading; planDrive). 1 m straight back, 1.7 rad on a 5.2 m radius, the wheel
    // straightened for the last 0.8 m; 6.8 m on, round on 6.5 m to face the road, which puts it on the
    // boulevard's lane (x 4.1)
    // (a cut: a crane move out from the windscreen passed through the car as it backed into it)
    director.cut(LOT.clone().add(V(-15, 3.4, -16)), LOT.clone().add(V(-3, 0.8, 1)), 44);
    director.move(LOT.clone().add(V(-14, 3.1, -15)), LOT.clone().add(V(-4, 0.8, -1)), 5.5, ease.inOut, 44);
    const [backOut, away] = planDrive(car, { at: car.position.clone(), yaw: 0, legs: [
      { dir: -1, segs: [{ len: 1 }, { len: 5.2 * 1.7, k: -1 / 5.2 }, { len: 0.8 }] },
      { dir: 1, segs: [{ len: 6.76 }, { len: 6.5 * 1.442, k: 1 / 6.5 }, { len: 22 }] },
    ] });
    motor.set(0.2);
    const back = timeLeg(backOut, { limit: [[0, 2.4], [backOut.len, 2.4]], accel: 1.4, brake: 1.6 });
    await this.roll(car, backOut, back, 0, back.T, () => Math.random() < 0.3 && puff(1, 0.6));
    await wait(0.5);
    motor.set(0.5);
    const off = timeLeg(away, { limit: [[0, 3.5], [8, 4.5], [16, 6.5], [away.len, 11]], v1: 11, accel: 2.4 });
    const watch = new THREE.Vector3();
    await this.roll(car, away, off, 0, off.T, () => {
      if (Math.random() < 0.4) puff(1, 0.5);
      watch.copy(car.position).y += 0.8;
      director.look.lerp(watch, 0.08);
    });
    // out through town: down the boulevard from the kerb, under the palms and the office blocks,
    // through the lights at the crossing
    const town = (x, z) => LOT.clone().add(V(x, 0, z));
    await ui.fade(1, 0.35);
    motor.set(0.6);
    placeCar(town(4.1, -95), Math.PI);
    // one shadow box over the whole shot, held still (chasing the car swept its edge up the street)
    f.shadowSpan(85);
    f.focus(town(6, -125));
    director.cut(town(11.8, -170).setY(1.15), town(4.1, -60).setY(1.0), 38);
    await ui.fade(0, 0.35);
    const look0 = new THREE.Vector3();
    const wheels = car.userData.wheels, spin = (d) => wheels.forEach((w) => (w.rotation.x += d / 0.33));
    for (const w of car.userData.front) w.rotation.y = 0;
    await tween(7, (k) => {
      const z = -95 - k * 105; // town speed, about 50 km/h
      placeCar(town(4.1, z), Math.PI);
      spin(105 / 7 / 60);
      look0.copy(car.position).y += 0.9;
      director.look.lerp(look0, 0.12);
    }, ease.linear);
    f.shadowSpan();
    // the desert road: a low shot from the verge as he goes by, then the long view
    await ui.fade(1, 0.5);
    motor.set(0.85);
    const roadAt = (z) => V(6 - 1.9, 0, z);
    placeCar(roadAt(2600), Math.PI);
    f.focus(roadAt(2580));
    director.cut(roadAt(2552).add(V(-4.2, 0.55, 0)), roadAt(2600).add(V(0, 0.8, 0)), 38);
    await ui.fade(0, 0.5);
    const look = new THREE.Vector3();
    await tween(4.2, (k) => {
      const z = 2600 - k * 95;
      placeCar(roadAt(z), Math.PI);
      spin(95 / 4.2 / 60);
      look.copy(car.position).y += 0.8;
      director.look.lerp(look, 0.2);
      f.focus(car.position);
    }, ease.linear);
    this.say('halDrive');
    director.cut(roadAt(1900).add(V(-60, 14, -40)), roadAt(1950), 30);
    await tween(5, (k) => {
      const z = 2000 - k * 120;
      placeCar(roadAt(z), Math.PI);
      spin(120 / 5 / 60);
      look.copy(car.position);
      director.look.lerp(look, 0.3);
      f.focus(car.position);
    }, ease.linear);
    // the gate, and into the lot: up the road braking for the gate, round off it into the aisle
    // between the rows, along to his bay and nose first into it. The rear axle's path is worked back
    // from the bay: 2.5 m straight in, a quarter turn on 5 m off the aisle, the aisle, a quarter turn
    // on 6 m off the road's lane
    await ui.fade(1, 0.5);
    const ax = -car.userData.axle.rear, lane = roadAt(0).x, aisle = CAR_SPOT.z + ax + 2.5 + 5, from = 170, turn = from - (aisle + 6);
    const [park] = planDrive(car, { at: V(lane, 0, from - ax), yaw: Math.PI, legs: [{ dir: 1, segs: [
      { len: turn }, { len: 3 * Math.PI, k: -1 / 6 }, { len: CAR_SPOT.x - 5 - (lane + 6) }, { len: 2.5 * Math.PI, k: 1 / 5 }, { len: 2.5 },
    ] }] });
    const s3 = turn + 3 * Math.PI + CAR_SPOT.x - 5 - (lane + 6);
    const pull = timeLeg(park, { v0: 16, limit: [[0, 16], [45, 7], [60, 6], [turn - 4, 5.5], [turn, 5], [s3 - 3, 3.8], [s3, 3], [s3 + 7.8, 1.8], [park.len, 1.4]], accel: 1.5, brake: 2.2 });
    rollCar(car, park, 0, 0);
    f.shadowSpan(80); // the booth by the camera, the road in and the lot, all in one still box
    f.focus(V(12, 0, 125));
    director.cut(GATE.clone().add(V(-5, 1.7, -13)), roadAt(200).add(V(0, 1, 0)), 40); // in through the gap, clear of the booth
    await ui.fade(0, 0.5);
    const rev = (t) => motor.set(0.12 + 0.02 * (pull.s(t + 0.1) - pull.s(t)) * 10);
    // through the gate, past the booth
    await this.roll(car, park, pull, 0, pull.time(75), (s, t) => {
      rev(t);
      look.copy(car.position).y += 0.8;
      director.look.lerp(look, 0.12);
    });
    // in the lot (a moment later): from above his bay on the hangar side, round off the road, along
    // the aisle and in, nose first toward us
    director.cut(V(33, 4.2, 45.5), V(8, 1, 66), 44);
    await this.roll(car, park, pull, pull.time(94), pull.T, (s, t) => {
      rev(t);
      look.copy(car.position).y += 0.7;
      director.look.lerp(look, 0.1);
    });
    for (const w of car.userData.front) w.rotation.y = 0;
    placeCar(CAR_SPOT, Math.PI);
    f.shadowSpan();
    f.focus(CAR_SPOT);
    motor.stop(0.4);
    this.motor = null;
    await wait(0.6);
    await this.getOut(car, animOff);
  }

  // Part of a planned leg (Car.js planDrive) driven from time t0 to t1 of its timing (timeLeg);
  // each(s, t) runs every frame.
  async roll(car, leg, run, t0, t1, each) {
    let s = run.s(t0);
    rollCar(car, leg, s, s);
    await tween(t1 - t0, (k) => {
      const t = t0 + k * (t1 - t0);
      s = rollCar(car, leg, run.s(t), s);
      each?.(s, t);
    }, ease.linear);
  }

  // His hands on the rim (or off it): the arm IK holds them there while the car moves.
  driveHands(car, on) {
    const anim = this.player.animator, ud = car.userData;
    if (!on) { anim.reach('L', null); anim.reach('R', null); return; }
    anim.reach('L', () => car.localToWorld(ud.rim('L', 10)), { pole: V(0.9, -1, -0.2), rate: 8 });
    anim.reach('R', () => car.localToWorld(ud.rim('R', 2)), { pole: V(-0.9, -1, -0.2), rate: 8 });
  }

  // Into the car the way a driver gets into a low coupe (leg first): from his building's door to the
  // car, the door pulled open by its edge (standing clear of its swing), then beside the seat facing
  // the front, a hand up on the roof rail, the right leg lifted in over the sill, ducking under the
  // rail as he lowers himself in onto the seat (the right hand onto the wheel, the outside foot
  // pivoting closer), the left leg brought in after him, settled back, and the door pulled shut.
  async getIn(car) {
    const { player, audio, director, ui } = this, ud = car.userData, rig = this.hal, anim = player.animator, o = player.object;
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    const door = ud.door, b = rig.bones;
    ud.openDoor(0);
    this.enterFerris(LOT.clone().add(V(0.4, 0, 13.2)), Math.PI);
    player.autoAnim = true;
    director.cut(local(5.6, 2.0, -4.6), local(0.9, 0.95, 0.6), 44);
    await ui.fade(0, 1.4);
    await player.walkTo(local(2.45, 0, -0.45), player.walkSpeed);
    player.turnTo(car.rotation.y - 0.44);
    await wait(0.45);
    const tip = V(0.03, 0.3, -1.34);
    anim.reach('R', () => door.localToWorld(tip.clone()), { pole: V(-1, -0.6, -0.3), rate: 7 });
    await wait(0.35);
    audio.carDoor();
    await tween(0.8, (k) => ud.openDoor(ease.inOut(k)));
    anim.reach('R', null);
    // into the gap between the door and the car, beside the seat, facing the front
    director.move(local(3.0, 1.55, -2.5), local(0.85, 0.85, -0.2), 2.4, ease.inOut, 40);
    await player.walkTo(local(1.3, 0, -0.3), player.walkSpeed * 0.7);
    player.turnTo(car.rotation.y - 0.25);
    await wait(0.5);
    player.removeFromPhysics();
    this.playerActive = false;
    player.autoAnim = false;
    player.lookAt(null);
    anim.feet.ground = null;
    const yaw0 = wrap(o.rotation.y - car.rotation.y);
    car.attach(o);
    o.rotation.set(0, yaw0, 0);
    o.position.y = 0;
    player.pivot.quaternion.identity();
    // where his feet are now, and where they end up at the wheel (pose A, measured on the rig); the
    // left hand rests on his thigh until it goes for the door
    const A = makePose({ ...drivingPose(rig, car), aL: [0.16, -0.8, 0.55], eL: 0.55 });
    const feet = () => ['L', 'R'].map((s) => {
      const p = car.worldToLocal(b[`foot_${s}`].getWorldPosition(V(0, 0, 0)));
      const fwd = V(0, 0, 1).applyQuaternion(b[`foot_${s}`].getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(car.quaternion.clone().invert());
      return { p: p.toArray(), h: Math.atan2(fwd.x, fwd.z), pitch: Math.asin(THREE.MathUtils.clamp(-fwd.y, -1, 1)) };
    });
    rig.root.updateMatrixWorld(true);
    const [l0, r0] = feet();
    const saved = { p: o.position.clone(), y: o.rotation.y };
    o.position.set(ud.seat.x, 0, ud.seat.z);
    o.rotation.set(0, 0, 0);
    rig.apply(A);
    rig.root.updateMatrixWorld(true);
    const [lA, rA] = feet();
    o.position.copy(saved.p);
    o.rotation.set(0, saved.y, 0);
    rig.applyQ(anim.states[0].cur);
    const S = ud.seat, x0 = saved.p.x, z0 = saved.p.z, wheel = ud.rim('R', 12).toArray(), rail = [0.69, 1.2, -0.3];
    // the move, in the car's frame: p is where he stands (under the pelvis), hy the pelvis height,
    // fL / fR the ankles (hL / hR their headings, pL / pR toes down), rh the right hand (rw its weight)
    const move = keyed([
      { t: 0, p: [x0, z0], yaw: yaw0, hy: rig.hipsHeight, sx: 0.03, sy: 0, sz: 0, cx: 0, nx: 0.06, kx: 0, ky: 0, aL: [0.14, -1, 0.05], eL: 0.2,
        fL: l0.p, hL: l0.h, pL: l0.pitch, fR: r0.p, hR: r0.h, pR: r0.pitch, ik: 1, rh: rail, rw: 0 },
      // the weight onto the left leg, a hand up on the roof rail, a look down into the footwell
      { t: 0.55, p: [x0 + 0.03, z0 + 0.01], hy: 0.85, sx: 0.12, sz: 0.05, nx: 0.16, kx: 0.18, ky: -0.3, rw: 1 },
      // the right knee up, the foot over the sill
      { t: 1.1, hy: 0.83, sx: 0.24, sz: 0.12, nx: 0.24, fR: [0.97, 0.5, -0.2], hR: -0.45, pR: 0.15 },
      // down onto the floor inside, his weight still outside
      { t: 1.6, p: [x0 - 0.03, z0], hy: 0.78, sx: 0.4, sy: -0.25, sz: 0.12, nx: 0.32, kx: 0.15, ky: -0.2, aL: [0.3, -0.9, 0.25], eL: 0.4, fR: [0.64, 0.36, -0.05], hR: -0.15, pR: 0 },
      // ducking while still outside (the rail is at 1.2 m), the outside foot pivoting in toward the sill
      { t: 1.95, p: [x0 - 0.05, z0 - 0.08], hy: 0.66, sx: 0.66, sy: -0.5, sz: 0.2, cx: 0.15, nx: 0.52, kx: 0.32, fL: [l0.p[0] - 0.12, 0.16, l0.p[2] + 0.1], hL: l0.h + 0.35 },
      // under the rail, his head leaning in toward the middle of the car where the roof is highest,
      // lowering himself in over the seat's edge; the hand onto the wheel
      { t: 2.3, p: [0.8, -0.4], yaw: -0.05, hy: 0.58, sx: 0.56, sy: -0.36, sz: 0.42, cx: 0.15, nx: 0.48, kx: 0.28, ky: -0.1, fL: [1.12, 0.09, -0.12], hL: 0.5, pL: 0, fR: [0.55, 0.36, 0.15], hR: -0.05, rh: wheel },
      // sat on the cushion, turned a little to the door, the left leg still out, still leaning in
      // (there is no room to sit up straight)
      { t: 2.9, p: [0.46, -0.36], yaw: 0.15, hy: 0.44, sx: 0.3, sy: -0.05, sz: 0.5, cx: 0.05, nx: 0.34, kx: 0.2, ky: 0.05, aL: [0.12, -0.75, 0.6], eL: 0.7, fR: [0.47, 0.36, 0.25] },
      // the left knee up and over the sill, leaning back into the seat
      { t: 3.5, p: [0.42, -0.36], yaw: 0.05, hy: 0.39, sx: -0.2, sy: 0, sz: 0.4, cx: 0, nx: 0.3, kx: 0.22, ky: 0.2, fL: [0.92, 0.52, 0.05], hL: 0.3, pL: 0.2 },
      // in under the wheel, settled back into the seat
      { t: 4.1, p: [S.x, S.z], yaw: 0, hy: A.hy + rig.hipsHeight, sx: A.sx, sz: 0, cx: A.cx, nx: A.nx, kx: A.kx, ky: A.ky, aL: A.aL, eL: A.eL, fL: lA.p, hL: lA.h, pL: lA.pitch, fR: rA.p, hR: rA.h, pR: rA.pitch },
      { t: 4.5, ik: 0 },
    ]);
    const k = move(0);
    let clock = 0;
    anim.play((out, _t, dt) => {
      move((clock += dt), k);
      copyPose(out, A); // A's legs under the IK, and its right arm under the reach
      out.hy = k.hy - rig.hipsHeight;
      for (const n of ['sx', 'sy', 'sz', 'cx', 'nx', 'kx', 'ky', 'eL']) out[n] = k[n];
      for (let i = 0; i < 3; i++) out.aL[i] = k.aL[i];
      o.position.set(k.p[0], 0, k.p[1]);
      o.rotation.y = k.yaw;
      anim.arms.R.weight = k.rw;
      return out;
    }, 0.35);
    anim.reach('R', () => car.localToWorld(_rh.fromArray(k.rh)), { pole: V(-1, -0.3, -0.4), rate: 9 });
    // the feet on their keyed spots (car frame), flat at their headings, the knees over the feet
    anim.post = (r) => {
      if (r !== rig || k.ik < 1e-3) return;
      for (const s of ['L', 'R']) {
        const h = k[`h${s}`] + car.rotation.y;
        solveTwoBone(b[`thigh_${s}`], b[`shin_${s}`], b[`foot_${s}`], car.localToWorld(_rh.fromArray(k[`f${s}`])), _pole.set(Math.sin(h), 0.6, Math.cos(h)), k.ik);
        _qa.setFromEuler(_eu.set(k[`p${s}`], h, 0, 'YXZ'));
        b[`shin_${s}`].getWorldQuaternion(_qb);
        b[`foot_${s}`].quaternion.slerp(_qb.invert().multiply(_qa), k.ik);
      }
    };
    // (out of the player's update now: the body moves only while something runs its animator; the
    // old version had nothing running it, and he slid into the seat standing bolt upright)
    const animOff = onFrame((dt) => anim.update(dt));
    await wait(4.55);
    anim.post = null;
    anim.play(still(A, 0.6), 0.3);
    // the door pulled shut by its handle
    const handle = V(-0.14, 0.24, -0.86);
    anim.reach('L', () => door.localToWorld(handle.clone()), { pole: V(1, -0.6, -0.4), rate: 6 });
    await wait(0.4);
    await tween(0.45, (e) => ud.openDoor(1 - ease.in(e)), ease.linear);
    audio.carDoor();
    anim.reach('L', null);
    await wait(0.3);
    this.driveHands(car, true);
    animOff(); // the drive runs it from here
  }

  // Out of the car, the way people get out of a low coupe: a hand to the door handle and the door
  // pushed open, a turn in the seat to put the feet out over the sill, up and clear of the frame,
  // a step back, and the door swung shut behind him.
  async getOut(car, animOff) {
    const { player, audio, director } = this, o = player.object, ud = car.userData, rig = this.hal, anim = player.animator;
    const local = (x, y, z) => car.localToWorld(V(x, y, z));
    // the front quarter on the driver's side: the door opens toward the camera
    director.cut(local(3.4, 1.45, 3.2), local(0.8, 0.95, -0.35), 38);
    this.driveHands(car, false);
    const door = ud.door, handle = V(-0.14, 0.24, -0.86); // on the door card, in the hinge's frame
    anim.reach('L', () => door.localToWorld(handle.clone()), { pole: V(1, -0.6, -0.4), rate: 6 });
    await wait(0.7);
    audio.carDoor();
    await tween(0.45, (k) => ud.openDoor(0.3 * ease.inOut(k)));
    anim.reach('L', null);
    tween(0.7, (k) => ud.openDoor(0.3 + 0.7 * ease.out(k)));
    // turn in the seat to face the door, knees up over the sill, feet down outside
    const seat = ud.seat, A = drivingPose(rig, car), B = swingPose(rig, car), C = outPose(rig, car);
    const st = { k: 0 };
    const p0 = o.position.clone();
    anim.play((out) => { const k = st.k; return k < 0.5 ? blendInto(out, A, B, k * 2) : blendInto(out, B, C, (k - 0.5) * 2); }, 0.2);
    await tween(1.3, (k) => {
      st.k = ease.inOut(k);
      o.rotation.y = (Math.PI / 2) * ease.inOut(Math.min(1, k * 1.25));
      o.position.set(p0.x + 0.26 * ease.inOut(k), 0, p0.z);
    });
    await wait(0.15);
    // up, the head ducked under the roof's edge, and clear of the frame
    anim.play(player.loco, 0.9);
    player.loco.speed = 0;
    const p1 = o.position.clone();
    await tween(1.1, (k) => o.position.set(p1.x + (1.26 - p1.x) * ease.inOut(k), 0, p1.z), ease.linear);
    animOff();
    const out = car.localToWorld(V(1.26, 0, seat.z)), yawOut = car.rotation.y + Math.PI / 2;
    car.remove(o);
    this.enterFerris(out, yawOut);
    player.autoAnim = true;
    // out past the door's tip (clear of its swing), then the tip pulled across and let go
    await player.walkTo(local(2.45, 0, -0.45), player.walkSpeed * 0.8);
    player.turnTo(car.rotation.y - 0.44);
    await wait(0.45);
    const tip = V(0.03, 0.3, -1.34); // the top of the door's rear edge, in the hinge's frame
    anim.reach('R', () => door.localToWorld(tip.clone()), { pole: V(-1, -0.6, -0.3), rate: 7 });
    await wait(0.4);
    await tween(0.5, (k) => ud.openDoor(1 - 0.45 * ease.inOut(k)));
    anim.reach('R', null);
    await tween(0.32, (k) => ud.openDoor(0.55 * (1 - ease.in(k))), ease.linear);
    audio.carDoor();
    director.shake?.(0.05, 0.15);
    await wait(0.6);
  }

  // Across to the apron on foot; Carol is waiting by the prototype.
  async ferris() {
    const { player } = this;
    this.addCarol();
    // the shadow box goes with him (in whole texels), centred a little ahead of him along the view
    this.ferrisScene.follow = (cam) => {
      const ahead = _fw.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0);
      return ahead.lengthSq() > 1e-4 ? ahead.setLength(15).add(player.position) : ahead.copy(player.position);
    };
    this.giveControl('Find Carol on the apron, by the prototype');
    let thought = false;
    await waitFor(() => {
      if (!thought && player.position.z < 26) { thought = true; this.bark('halFerris'); }
      return Math.hypot(player.position.x - CAROL_SPOT.x, player.position.z - CAROL_SPOT.z) < 6.5;
    });
  }

  // Carol, standing by the jet, the clipboard of a scrubbed test at her side.
  addCarol() {
    if (this.carol) return this.carol;
    const f = this.ferrisScene, gl = this.assets.characters.carol;
    if (!gl) return null;
    const c = (this.carol = createCarol(gl));
    c.root.position.copy(CAROL_SPOT);
    c.root.rotation.y = Math.atan2(CAR_SPOT.x - CAROL_SPOT.x, CAR_SPOT.z - CAROL_SPOT.z); // watching the lot
    f.scene.add(c.root);
    const anim = (this.carolAnim = new Animator(c));
    const loco = (this.carolLoco = new Locomotion(this.mocap));
    loco.scale = c.hipsHeight / this.mocap.hipsHeight;
    loco.relax.adduct = 0.1; // (her scan's A-pose holds the arms out from her sides)
    anim.play(loco, 0);
    anim.look.maxYaw = 0.8;
    const halHead = this.headOf(this.player.rig);
    anim.lookAt(halHead, 0.5);
    const body = (this.cb = new BodyLanguage(c, anim, { lookHome: () => halHead(), gestures: CAROL_GESTURES, stances: CAROL_STANCES, scale: 1, reach: 0.55, shift: null }));
    body.stance('hip');
    f.updaters.push((dt) => { body.update(dt); anim.update(dt); });
    return c;
  }
  carolSay(key, cues, extra) { return this.perform(this.cb, key, cues, extra); }

  // Close on Carol, from Hal's side; and the two of them, over his shoulder.
  carolClose(duration = 1.4, side = 1, fov = 32) {
    const c = this.carol, h = c.bonePosition('head', V(0, 0, 0)), yaw = c.root.rotation.y;
    const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 1.7).addScaledVector(r, 0.45 * side).add(V(0, -0.06, 0)), h.clone().add(V(0, -0.04, 0)), duration, ease.inOut, fov);
  }
  halClose(duration = 1.4, side = 1) {
    const p = this.player.position, yaw = this.player.yaw, h = V(p.x, p.y + 1.66, p.z);
    const f = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 1.6).addScaledVector(r, -0.45 * side).add(V(0, -0.05, 0)), h.clone(), duration, ease.inOut, 34);
  }
  overHal(duration = 1.6) {
    const c = this.player.position.clone(), head = this.carol.bonePosition('head', V(0, 0, 0));
    const back = c.clone().sub(head).setY(0).normalize(), right = V(back.z, 0, -back.x);
    return this.director.move(c.clone().addScaledVector(back, 1.9).addScaledVector(right, 0.75).setY(c.y + 1.8), c.clone().setY(1.55).lerp(head, 0.6), duration, ease.inOut, 38);
  }

  async carolScene() {
    const { player, director, audio } = this;
    const carol = this.addCarol(), cb = this.cb, ca = this.carolAnim;
    this.takeControl();
    // face to face, a couple of metres apart
    const stand = CAROL_SPOT.clone().add(V(-0.6, 0, 2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    const toCarol = Math.atan2(CAROL_SPOT.x - stand.x, CAROL_SPOT.z - stand.z);
    player.turnTo(toCarol);
    const turn = { from: carol.root.rotation.y, to: Math.atan2(stand.x - CAROL_SPOT.x, stand.z - CAROL_SPOT.z) };
    tween(1.2, (k) => (carol.root.rotation.y = turn.from + wrap(turn.to - turn.from) * ease.inOut(k)));
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    this.ferrisScene.follow = null;
    this.ferrisScene.focus(CAROL_SPOT);
    this.ambience(audio.wind(0.05));
    await this.overHal(2.0);
    await this.carolSay('carol1', [['late', () => ca.gesture('chin', 1.2, 0.5)]]);
    await this.halClose(1.2);
    await this.say('halCarol1');
    await this.carolClose(1.2);
    await this.carolSay('carol2', [['explain', 'open'], ['runway', () => cb.pointAt(V(0, 1, -150), 1.8)], ['empty', () => ca.gesture('shake', 1, 0.35)]]);
    await this.carolSay('carol3', [['where', 'open']]);
    await this.halClose(1.3, -1);
    await wait(0.8);
    player.animator.gesture('beat', 0.6, 0.4);
    await this.say('halCarol2');
    await this.carolClose(1.0, -1, 28);
    await wait(0.5);
    await this.carolSay('carol4', [['can', () => ca.gesture('tilt', 1.0, 0.5)]]);
    await wait(0.4);
    await this.overHal(1.6);
    await this.carolSay('carol5', [['father', 'chest'], ['covered', 'chest'], ['air show', 'open'], ['every time', () => ca.gesture('shake', 1.1, 0.4)]]);
    await this.halClose(1.2);
    player.animator.gesture('nod', 1.0, 0.4);
    await this.say('halCarol3');
    await this.carolClose(1.4, 1, 30);
    await this.carolSay('carol6', [['grounded', 'cut'], ['done', () => ca.gesture('beat', 0.5, 0.7)]]);
    await this.halClose(1.0);
    await this.say('halCarol4');
    await this.carolClose(0.8, -1);
    await this.carolSay('carol7', [['don', 'stop']]);
    // she walks back toward the hangar; over his shoulder, he watches her go
    player.lookAt(() => carol.bonePosition('head', _h), 0.6);
    ca.lookAt(null);
    const dest = V(4, 0, 6), yaw0 = carol.root.rotation.y, yaw1 = Math.atan2(dest.x - CAROL_SPOT.x, dest.z - CAROL_SPOT.z);
    const away = stand.clone().sub(CAROL_SPOT).setY(0).normalize();
    director.move(stand.clone().addScaledVector(away, 1.8).add(V(0.7, 1.75, 0)), CAROL_SPOT.clone().setY(1.3), 1.6, ease.inOut, 40);
    const loco = this.carolLoco, watch = new THREE.Vector3();
    await tween(0.8, (k) => (carol.root.rotation.y = yaw0 + wrap(yaw1 - yaw0) * ease.inOut(k)));
    const from = carol.root.position.clone(), dir = dest.clone().sub(from).normalize();
    await tween(6, (k) => {
      loco.speed = Math.min(1.2, k * 6);
      carol.root.position.copy(from).addScaledVector(dir, 7.2 * k);
      watch.copy(carol.root.position).y += 1.3;
      director.look.lerp(watch, 0.08);
    }, ease.linear);
    player.lookAt(null);
  }

  // At his car, sitting on the trunk, looking out at the desert and the road he came in on.
  async after() {
    const { ui, director, player } = this;
    await ui.fade(1, 1.2);
    this.takeControl();
    if (this.carol) this.carol.root.visible = false;
    const f = this.ferrisScene;
    // the car is parked nose to the hangars; he perches on the back edge of its trunk lid, facing
    // south down the road, his hands on the lid either side of him
    const car = f.car, tail = car.userData.tail, hipY = tail.y + 0.09;
    const seat = car.localToWorld(V(0, 0, tail.z + 0.2)); // the hips on the lid, the knees past the bumper
    player.removeFromPhysics();
    this.playerActive = false;
    player.autoAnim = false;
    player.object.position.copy(seat);
    player.object.rotation.set(0, car.rotation.y + Math.PI, 0);
    player.pivot.quaternion.identity();
    player.animator.play(still(trunkPose(this.hal, hipY), 1.2), 0);
    for (const [side, x] of [['L', 0.3], ['R', -0.3]]) {
      const at = car.localToWorld(V(-x * 1.25, tail.y + 0.06, tail.z + 0.32));
      player.animator.reach(side, at, { pole: V(side === 'L' ? 1 : -1, 0.2, -1), rate: 6 });
    }
    const animOff = onFrame((dt) => player.animator.update(dt));
    f.focus(seat);
    ui.clock(this.save.info('after').clock);
    seat.y = hipY;
    const head = seat.clone().add(V(0, 0.72, 0));
    director.cut(head.clone().add(V(-1.4, -0.25, 2.6)), head.clone().add(V(0, -0.1, 0)), 40);
    await ui.fade(0, 1.6);
    director.move(head.clone().add(V(-1.1, -0.2, 2.1)), head.clone().add(V(0, -0.1, 0)), 8, ease.inOut, 36);
    await wait(1.4);
    this.ringGlow = 3;
    this.audio.ringChime();
    await this.say('ringAfter', { name: 'The ring' });
    player.lookAt(this.ring.getWorldPosition(V(0, 0, 0)), 0.7);
    await this.say('halAfter1');
    player.lookAt(seat.clone().add(V(-8, 2, 200)), 0.6);
    // from behind: him small on the car, the road away south, the mesas
    director.cut(seat.clone().add(V(-2.4, 1.7, -6)), seat.clone().add(V(3, 0.6, 40)), 46);
    await wait(0.6);
    await this.say('halAfter2');
    await this.say('halAfter3', { hold: 1.4 });
    // the afternoon: he's still there. Tom rings from the hangar.
    await ui.fade(1, 1.4);
    ui.clock('1:52 PM');
    await wait(0.6);
    director.cut(head.clone().add(V(1.5, -0.3, 1.9)), head.clone().add(V(0, -0.15, 0)), 38);
    await ui.fade(0, 1.4);
    const phone = (this.phone = buildPhone({ call: 'Tom Kalmaku' }));
    const rig = this.hal, chest = new THREE.Vector3(), fwd = V(Math.sin(player.object.rotation.y), 0, Math.cos(player.object.rotation.y));
    this.audio.buzz(2);
    await wait(0.9);
    // out of his pocket, flat in the palm, the screen to his eyes (on speaker)
    rig.bonePosition('thigh_L', phone.position).addScaledVector(fwd, 0.08);
    f.scene.add(phone);
    phone.visible = false;
    player.animator.reach('L', () => rig.bonePosition('thigh_L', chest).addScaledVector(fwd, 0.12), { pole: V(0.8, -0.4, -0.5), rate: 6 });
    await wait(0.5);
    phone.visible = true;
    const grip = this.holdInHand(phone, 'L');
    player.animator.reach('L', () => rig.bonePosition('chest', chest).addScaledVector(fwd, 0.32).add(V(0, 0.08, 0)), { pole: V(0.6, -0.9, -0.4), rate: 4 });
    player.lookAt(() => phone.getWorldPosition(_h2), 0.85);
    phone.userData.screen.material.color.setScalar(0.85);
    director.move(head.clone().add(V(1.0, -0.2, 1.3)), head.clone().add(V(0, -0.25, 0.1)), 4, ease.inOut, 34);
    await wait(0.6);
    await this.say('tomCall1');
    await this.say('halCall1');
    await this.say('tomCall2');
    player.animator.gesture('shake', 0.9, 0.3);
    await this.say('halCall2');
    await this.say('tomCall3');
    grip.release();
    phone.visible = false;
    player.animator.reach('L', null);
    // over his shoulder, past the hangars: the runway, where the prototype is being towed out
    player.lookAt(seat.clone().add(V(0, 1.4, -60)), 0.5);
    director.cut(head.clone().add(V(0.8, 0.35, 2.2)), V(30, 6, -150), 44);
    await this.say('halCall3', { hold: 1.0 });
    animOff();
    await ui.fade(1, 1.2);
  }

  // ---------------------------------------------------------------- 2 PM: the test
  // The prototype, off the apron and out at the runway's east end, ready to roll (its colliders
  // gone from the apron); its smoke and the sound of it.
  readyJet() {
    const f = this.ferrisScene, rig = f.freeJet();
    jetAt(0, rig.position, rig.quaternion);
    rig.position.y += rig.userData.hc;
    f.gear(true);
    if (this.jetUpdate) return rig;
    this.jetT = 0;
    this.jetLive = false;
    this.jetCentre = new THREE.Vector3().copy(rig.position);
    const smoke = (this.smoke = new Particles(1800, { additive: false, puffy: true, drag: 0.35, turbulence: 0.8 }));
    const fire = (this.fire = new Particles(500, { additive: true, drag: 1.2, turbulence: 0.4 }));
    f.scene.add(smoke.points, fire.points);
    const noz = new THREE.Vector3(), back = new THREE.Vector3(), prev = rig.position.clone(), vel = new THREE.Vector3();
    let emit = 0, lastSpin = 0;
    this.jetUpdate = (dt, t) => {
      const { camera, renderer } = this.engine;
      if (this.jetLive) {
        this.jetT += dt * (this.jetRate ?? 1);
        jetAt(this.jetT, rig.position, rig.quaternion);
        rig.position.y += rig.userData.hc;
        if (this.jetT > 6.5 && this.jetT < 7) f.gear(false); // gear up after the climb's begun
        if (this.jetT > SPIN_T && rig.position.y < rig.userData.hc + 5) this.jetLive = false, this.jetCrashed = true;
      }
      if (dt > 0) vel.subVectors(rig.position, prev).divideScalar(dt);
      prev.copy(rig.position);
      this.jetCentre.copy(rig.position);
      // the left engine burning after the flameout: fire at the nozzle, black smoke streaming back
      if (this.jetBurning) {
        rig.localToWorld(noz.copy(rig.userData.nozzles.L));
        back.set(0, 0, -1).applyQuaternion(rig.quaternion);
        emit += dt * (this.jetLive ? 90 : 40);
        const n = Math.floor(emit);
        emit -= n;
        smoke.emit(n, (p, v) => {
          p[0] = noz.x + (Math.random() - 0.5) * 0.6; p[1] = noz.y + (Math.random() - 0.5) * 0.6; p[2] = noz.z + (Math.random() - 0.5) * 0.6;
          v[0] = vel.x * 0.15 + back.x * 4 + (Math.random() - 0.5) * 1.5; v[1] = vel.y * 0.15 + 0.6 + Math.random(); v[2] = vel.z * 0.15 + back.z * 4 + (Math.random() - 0.5) * 1.5;
        }, { life: 6, lifeJitter: 0.4, size: [1.4, 9], color: [[0.09, 0.085, 0.08, 0.8], [0.32, 0.3, 0.28, 0]] });
        fire.emit(Math.max(1, Math.round(n * 0.7)), (p, v) => {
          p[0] = noz.x; p[1] = noz.y; p[2] = noz.z;
          v[0] = vel.x * 0.85 + back.x * 6 + (Math.random() - 0.5) * 2; v[1] = vel.y * 0.85 + (Math.random() - 0.5) * 2; v[2] = vel.z * 0.85 + back.z * 6 + (Math.random() - 0.5) * 2;
        }, { life: 0.3, size: [1.6, 0.3], color: [[3.2, 1.3, 0.35, 1], [1.2, 0.25, 0.05, 0]] });
      }
      smoke.update(dt, t, camera, renderer);
      fire.update(dt, t, camera, renderer);
      if (this.jetSound) {
        const d = camera.position.distanceTo(rig.position);
        const wob = this.jetBurning ? 0.82 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 2.1) : 1;
        this.jetSound.set(this.jetQuiet ? 0 : 0.55 * Math.min(1, 70 / Math.max(d, 1)) * (this.jetBurning ? 0.75 : 1), wob * (0.85 + Math.min(0.35, vel.length() / 220)));
      }
      void lastSpin;
    };
    f.updaters.push((dt, t) => this.jetUpdate(dt, t));
    return rig;
  }

  // Set the prototype's clock running from `t` (s from its take-off roll); past FLAME_T it burns.
  flyJet(t = 0) {
    this.jetT = t;
    this.jetLive = true;
    this.jetBurning = t > FLAME_T;
    this.ferrisScene.gear(t < 6.5);
    this.jetSound ??= this.audio.jetEngine();
  }

  // The ring's powers at Ferris for the afternoon: flight over the field, the HUD, full charge
  // (constructs off: there's nothing to fight yet).
  powerUp() {
    const f = this.ferrisScene;
    this.powers.attach({ scene: f.scene, physics: f.physics, ...f.airBounds() });
    this.empower(true);
    this.powers.enabled.constructs = false;
  }

  // Clothes to the suit, in the ring's light: the uniform sweeps up over him and the mask forms
  // (the reverse of Corps.backThroughWindow).
  async suitUp(dur = 1.8) {
    const { player, audio } = this, hal = this.hal;
    const suit = (this.suit ??= createHal(this.assets.characters.lantern, { glow: 1.4, jaw: JAW.lantern }));
    player.mount(suit);
    player.animator.addRig(suit);
    hal.u.uDissolveOn.value = 1; hal.u.uDissolveSign.value = 1;
    suit.u.uDissolveOn.value = 1; suit.u.uDissolveSign.value = -1;
    audio.dissolve();
    audio.whoosh(dur, 0.35);
    await tween(dur, (k) => { hal.u.uDissolve.value = -0.1 + k * 1.25; suit.u.uDissolve.value = -0.1 + k * 1.25; }, ease.inOut);
    hal.u.uDissolveOn.value = 0;
    suit.u.uDissolveOn.value = 0;
    hal.u.uDissolve.value = 0;
    this.ring.removeFromParent();
    player.setRig(suit);
    this.attachRing(this.ring, suit);
    this.powers.ring = this.ring;
    this.powers.suited = true;
    player.setTired(0);
    player.speedScale = 1.3;
  }

  // He walks round to the gap between Hangars Two and Three to watch; the prototype rolls and
  // climbs out to the west, the left engine goes, the ring hears the pilot's mayday. Into the gap,
  // out of sight, and up in the suit.
  async test() {
    const { ui, director, audio, player } = this;
    const f = this.ferrisScene, rig = this.readyJet();
    ui.clock(this.save.info('test').clock);
    const carol = this.addCarol();
    if (carol) {
      carol.root.visible = true;
      carol.root.position.copy(CAROL_SPOT);
      carol.root.rotation.y = Math.PI * 0.92; // watching the runway
      this.carolAnim.lookAt(() => rig.position, 0.6);
    }
    player.lookAt(null);
    player.animator.reach('L', null);
    player.animator.reach('R', null);
    this.enterFerris(CAR_SPOT.clone().add(V(-2.45, 0, -1.6)), Math.PI);
    player.autoAnim = true;
    player.animator.play(player.loco, 0.4);
    f.follow = (cam) => _fw.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).setLength(15).add(player.position);
    this.director.mode = 'follow';
    await ui.fade(0, 1.2);
    this.giveControl('Watch the test from between the hangars');
    await waitFor(() => Math.hypot(player.position.x - GAP.x, player.position.z - GAP.z) < 4);
    this.takeControl();
    f.follow = null;
    if (player.position.distanceTo(GAP) > 0.5) await player.walkTo(GAP, player.walkSpeed);
    player.turnTo(Math.PI * 1.08);
    player.lookAt(() => rig.position, 0.6);
    // the roll: over his shoulder, the jet coming in from the east along the runway
    f.shadowSpan(70);
    f.focus(GAP.clone().add(V(0, 0, -40)));
    this.flyJet(0);
    const look = new THREE.Vector3(), track = (k = 0.08) => { look.copy(rig.position).y += 1; director.look.lerp(look, k); };
    director.cut(GAP.clone().add(V(-1.5, 1.7, 2.8)), V(95, 5, RUNWAY_Z), 42);
    const t1 = onFrame(() => track(0.05));
    await waitFor(() => this.jetT > 5.2);
    t1();
    // low by the runway's edge: it lifts off past the camera
    director.cut(V(-75, 1.2, RUNWAY_Z + 26), rig.position.clone(), 30);
    const t2 = onFrame(() => track(0.2));
    await waitFor(() => this.jetT > 8.4);
    t2();
    // Carol on the apron, and the jet climbing away beyond her
    if (carol) {
      // over her shoulder: she turns with it as it climbs away
      const toJet = rig.position.clone().sub(CAROL_SPOT).setY(0).normalize(), side = V(-toJet.z, 0, toJet.x);
      director.cut(CAROL_SPOT.clone().addScaledVector(toJet, -2.3).addScaledVector(side, 0.75).setY(1.62), rig.position.clone(), 40);
      const t3 = onFrame(() => {
        track(0.08);
        const want = Math.atan2(rig.position.x - CAROL_SPOT.x, rig.position.z - CAROL_SPOT.z);
        carol.root.rotation.y += wrap(want - carol.root.rotation.y) * 0.03;
      });
      this.bark('halTest');
      await waitFor(() => this.jetT > FLAME_T - 0.8);
      t3();
    } else await waitFor(() => this.jetT > FLAME_T - 0.8);
    // a long lens from the gap: the engine lets go
    director.cut(GAP.clone().add(V(0.5, 1.7, 1.4)), rig.position.clone(), 8);
    const t4 = onFrame(() => track(0.3));
    await waitFor(() => this.jetT > FLAME_T);
    this.flameout();
    await wait(2.2);
    t4();
    this.jetRate = 0.3; // (off screen from here to the launch: it comes round slowly, so he's in time)
    // the ring hears the radio
    director.cut(GAP.clone().add(V(-0.9, 1.62, -1.5)), GAP.clone().add(V(0, 1.6, 0)), 34);
    player.lookAt(this.ring.getWorldPosition(V(0, 0, 0)), 0.6);
    this.ringGlow = 3;
    audio.ringChime();
    await this.say('ringDistress', { name: 'The ring' });
    player.lookAt(() => rig.position, 0.8);
    await this.say('pilotMayday');
    player.animator.gesture('beat', 0.6, 0.5);
    await this.say('halNotToday');
    // back into the gap, out of sight of the apron, and into the suit
    const hide = GAP.clone().add(V(0, 0, 16));
    director.cut(GAP.clone().add(V(-2.6, 1.5, 22)), GAP.clone().add(V(0, 1.2, 12)), 46);
    await player.walkTo(hide, player.runSpeed);
    player.turnTo(Math.PI);
    player.lookAt(null);
    director.cut(hide.clone().add(V(1.4, 1.5, -2.6)), hide.clone().add(V(0, 1.15, 0)), 40);
    director.move(hide.clone().add(V(1.1, 1.45, -2.2)), hide.clone().add(V(0, 1.1, 0)), 3, ease.inOut, 38);
    await wait(0.4);
    this.ringGlow = 4;
    this.engine.gradeUniforms.uFlash.value = 0.16;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.16 * (1 - k)));
    await this.suitUp(1.8);
    this.powerUp();
    // and up, out of the gap
    player.autoAnim = false;
    player.animator.play(still(POSES.land, 0.5), 0.25);
    await wait(0.45);
    director.cut(hide.clone().add(V(-3.5, 1.0, 5)), hide.clone().add(V(0, 6, 0)), 52);
    player.autoAnim = true;
    player.takeOff();
    player.vel.set(0, 24, -6);
    await wait(1.2);
  }

  // In the air: get under the falling jet before it hits the desert.
  async catchJet() {
    const { player, powers } = this;
    const f = this.ferrisScene;
    if (!this.jetLive) this.flyJet(SPIN_T - 3);
    this.jetRate = 1;
    player.boostScale = 1.7;
    powers.markerTarget = { pos: this.jetCentre, label: 'The jet' };
    this.jetCrashed = false;
    // the view turned to it, so the player sees where it's going down
    const toJet = this.jetCentre.clone().sub(player.position).normalize();
    player.camYaw = Math.atan2(-toJet.x, -toJet.z);
    player.camPitch = THREE.MathUtils.clamp(-Math.asin(toJet.y), -1.1, 1.2);
    this.giveControl('Catch the jet before it hits the ground');
    this.hud.tutorial({ kicker: 'Green Lantern', title: 'Get under it', n: 1, of: 2, html: '<b>Shift</b> fly faster &nbsp; <b>Space</b> / <b>C</b> climb, dive' });
    f.follow = () => player.position;
    await waitFor(() => this.jetCrashed || player.rig.bonePosition('chest', _h).distanceTo(this.jetCentre) < 26);
    if (this.jetCrashed) return this.jetLost('crashed');
    player.boostScale = 1;
    const ok = await this.theCatch();
    if (!ok) return this.jetLost('dropped');
    await this.meetCarolGL();
  }

  // The left engine lets go: a ball of fire at the nozzle, then it burns and trails smoke. The bang
  // reaches the field a second or so later (it's half a kilometre off).
  flameout() {
    const rig = this.ferrisScene.jetRig, p = rig.localToWorld(rig.userData.nozzles.L.clone());
    this.jetBurning = true;
    this.fire.emit(36, (q, v) => {
      q[0] = p.x; q[1] = p.y; q[2] = p.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * 2 - 1, r = Math.sqrt(1 - b * b), sp = 3 + Math.random() * 6;
      v[0] = Math.cos(a) * r * sp; v[1] = b * sp; v[2] = Math.sin(a) * r * sp;
    }, { life: 0.9, size: [9, 3], color: [[3.6, 1.5, 0.35, 1], [0.9, 0.18, 0.04, 0]] });
    this.smoke.emit(40, (q, v) => {
      q[0] = p.x + (Math.random() - 0.5) * 3; q[1] = p.y + (Math.random() - 0.5) * 3; q[2] = p.z + (Math.random() - 0.5) * 3;
      v[0] = (Math.random() - 0.5) * 4; v[1] = (Math.random() - 0.5) * 4; v[2] = (Math.random() - 0.5) * 4;
    }, { life: 5, size: [5, 14], color: [[0.07, 0.065, 0.06, 0.85], [0.3, 0.28, 0.27, 0]] });
    const d = this.engine.camera.position.distanceTo(p);
    wait(d / 343).then(() => this.audio.flameout(Math.min(1, 0.3 + 250 / d)));
  }

  // The hand of light the ring makes to catch the jet: an open palm under the fuselage, fingers
  // curled up round the nose; the tether from Hal's ring to its wrist, its glow on the jet's belly.
  buildJetHand() {
    const s = this.ferrisScene.scene, g = new THREE.Group();
    const mesh = constructMesh(handGeometry(), { uPattern: 1, uScale: 0.17, uFadeZ: new THREE.Vector2(-1.15, -0.45), outline: 0.02 });
    g.add(mesh);
    g.scale.setScalar(HAND.scale);
    g.visible = false;
    const beam = createBeam(0.05), light = new THREE.PointLight(0x55ff88, 0, 45, 1.6);
    beam.visible = false;
    s.add(g, beam, light);
    return { g, beam, light, set: mesh.userData.set, wrist: new THREE.Vector3() };
  }

  // Everything in the carry from the jet's centre J, its heading and velocity: the jet level on the
  // palm (tipping a little the way it's carried), the hand under it, and Hal off its left side and
  // below, his ring fist raised to the hand's wrist, the tether between them.
  placeCarry(J, yaw, vel, form = 1, t = 0) {
    const { player } = this, f = this.ferrisScene, rig = f.jetRig, hand = this.jetHand;
    const fwd = _cf.set(Math.sin(yaw), 0, Math.cos(yaw)), right = _cr.set(-fwd.z, 0, fwd.x);
    const tipF = THREE.MathUtils.clamp(vel.dot(fwd) * 0.012 - vel.y * 0.01, -0.12, 0.12), tipR = THREE.MathUtils.clamp(vel.dot(right) * 0.02, -0.14, 0.14);
    _ce.set(tipF, yaw, -tipR, 'YXZ');
    rig.position.copy(J);
    rig.quaternion.setFromEuler(_ce);
    hand.g.quaternion.copy(rig.quaternion);
    hand.g.position.copy(J).addScaledVector(_cu.set(0, 1, 0).applyQuaternion(rig.quaternion), -(rig.userData.belly + HAND.palm * HAND.scale - 0.06));
    hand.g.updateMatrixWorld(true);
    hand.g.localToWorld(hand.wrist.copy(HAND.wrist));
    hand.set('uForm', form);
    hand.set('uTime', t);
    hand.light.position.copy(J).y -= rig.userData.belly + 1.2;
    hand.light.intensity = 30 * form;
    // Hal: to the jet's left and below, coming up level with it near the ground
    const alt = J.y - rig.userData.hc;
    const at = _ch.copy(J).addScaledVector(right, -HAND.side).setY(Math.max(1.2, J.y - THREE.MathUtils.lerp(2, 9, THREE.MathUtils.clamp(alt / 40, 0, 1))));
    player.object.position.copy(at).y -= 1; // (the pivot is a metre up)
    player.object.rotation.y = Math.atan2(hand.wrist.x - at.x, hand.wrist.z - at.z);
    this.ring.getWorldPosition(_cb);
    hand.beam.userData.span(_cb, hand.wrist);
    hand.beam.userData.u.uOpacity.value = form * 1.6;
    hand.beam.userData.u.uTime.value = t;
    return alt;
  }

  // The catch: up under the jet, the ring arm raised, the hand forms beneath it; the jet drops into
  // it still spinning and its weight drives them both down until the ring holds it. Then the player
  // carries it down to the field: hold the click to keep the hand, steer, C to come down, before
  // the charge gives out. Resolves true once it's on its wheels, false if it's dropped.
  async theCatch() {
    const { player, director, audio, powers, engine, input } = this;
    const f = this.ferrisScene, rig = f.jetRig;
    this.takeControl();
    powers.markerTarget = null;
    this.hud.tutorial(null);
    this.hud.ringhud.classList.add('force');
    f.follow = null;
    f.shadowSpan(40);
    // out of the flight controller: from here the script flies him
    this.playerActive = false;
    player.flying = false;
    player.autoAnim = false;
    player.animator.play(still(POSES.hover, 0.6), 0.3);
    const animOff = onFrame((dt) => player.animator.update(dt));
    const hand = (this.jetHand ??= this.buildJetHand());
    hand.g.visible = hand.beam.visible = true;
    const sh = new THREE.Vector3();
    player.animator.reach('R', () => {
      player.rig.bonePosition('upperArm_R', sh);
      return sh.add(_ca.copy(hand.wrist).sub(sh).normalize().multiplyScalar(0.7));
    }, { pole: V(-0.5, -0.8, -0.2), rate: 9 });
    player.lookAt(() => rig.position, 0.8);
    // the swoop: the jet still falling and turning, Hal sweeping in under it, the hand forming
    const J = new THREE.Vector3(), vel = new THREE.Vector3(), from = player.position.clone().add(V(0, 1, 0)), fwd = new THREE.Vector3();
    const yawOf = () => { fwd.set(0, 0, 1).applyQuaternion(rig.quaternion); return Math.atan2(fwd.x, fwd.z); };
    audio.constructForm?.();
    audio.whoosh(1.0, 0.5);
    const look = new THREE.Vector3();
    director.cut(rig.position.clone().add(V(14, -16, 22)), rig.position.clone(), 50);
    await tween(0.9, (k) => {
      J.copy(rig.position);
      const yaw = yawOf();
      const target = this.placeCarry(J, yaw, vel.set(0, -SPIN.sink, 0), ease.out(k), engine.time);
      void target;
      // he comes in from where he was, not from beside it
      _ch.copy(player.object.position).y += 1;
      player.object.position.copy(from).lerp(_ch, ease.inOut(k)).y -= 1;
      look.copy(J).lerp(player.position, 0.3);
      director.look.lerp(look, 0.3);
    }, ease.linear);
    // the weight comes onto it
    this.jetLive = false;
    J.copy(rig.position);
    let yaw = yawOf(), spin = this.jetT > SPIN_T ? SPIN.rate * Math.min(1, (this.jetT - SPIN_T) / 3) : 0, vy = -SPIN.sink;
    powers.hitStop = 0.14;
    director.shake(0.7, 1.2);
    audio.strain(2.6, 0.4);
    audio.impact?.(1);
    const c0 = powers.charge;
    tween(0.8, (k) => powers.setCharge(c0 - 26 * k));
    this.say('ringMass', { name: 'The ring' });
    // below it, looking up: the jet in the hand, Hal beside it straining
    director.cut(J.clone().add(V(-13, -21, 17)), J.clone().add(V(0, -3, 0)), 50);
    await tween(1.8, (k, dt = 1 / 60) => {
      const e = Math.exp(-k * 3.2);
      J.y += vy * (1 / 60) * e;
      yaw += spin * (1 / 60) * e;
      this.placeCarry(J, yaw, vel.set(0, vy * e, 0), 1, engine.time);
      look.copy(J).y -= 3;
      director.look.lerp(look, 0.1);
    }, ease.linear);
    await this.say('halHold');
    // the carry
    const result = await this.carry(J, yaw);
    animOff();
    player.animator.reach('R', null);
    player.lookAt(null);
    this.hud.ringhud.classList.remove('force');
    return result;
  }

  // Bring it down, steered from behind Hal (the mouse turns the view): hold the click or the hand
  // fails, C to come down, WASD to move it over the field; it's heavy (slow to start and stop), it
  // flares by itself near the ground, and the ring won't set it down outside the field.
  carry(J, yaw) {
    const { player, director, input, powers, engine, ui } = this;
    const f = this.ferrisScene, rig = f.jetRig, hand = this.jetHand;
    this.giveControl('Set the jet down on the runway');
    powers.markerTarget = { pos: SET_DOWN, label: 'Set it down' };
    this.hud.tutorial({ kicker: 'Green Lantern', title: 'Bring it down', n: 2, of: 2, html: '<b>Hold click</b> keep the hand &nbsp; <b>WASD</b> move &nbsp; <b>C</b> down' });
    const vel = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3(), cam = new THREE.Vector3();
    const toHal = player.position.clone().sub(J).setY(0).normalize();
    let camYaw = Math.atan2(toHal.x, toHal.z) - 0.5, slip = 0, warnedField = false, warnedSlip = false, gear = f.jetRig.userData.gearDown;
    return new Promise((resolve) => {
      const stop = onFrame((dt) => {
        if (dt <= 0) return;
        camYaw -= input.look.dx * 0.0024;
        const held = input.down('Mouse0') && powers.charge > 0;
        slip = held ? Math.max(0, slip - dt * 2) : slip + dt;
        if (!held && slip > 0.15 && !warnedSlip) { warnedSlip = true; this.say('ringSlip', { name: 'The ring', skip: false }); }
        const { x, z } = input.moveAxis();
        const cf = _cf.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)), cr = _cr.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
        want.set(0, 0, 0).addScaledVector(cf, z).addScaledVector(cr, x);
        if (want.lengthSq() > 1) want.normalize();
        want.multiplyScalar(8);
        // near the ground it flares; outside the field the ring holds it up
        const alt = J.y - rig.userData.hc, onField = canSetDown(J.x, J.z);
        want.y = input.down('KeyC') ? -4.5 - alt * 0.06 : input.down('Space') ? 1.2 : -0.5; // (faster down from high up)
        if (alt < 7) want.y = Math.max(want.y, -0.35 - alt * 0.25);
        if (!onField && alt < 14) {
          want.y = Math.max(want.y, 0);
          if (!warnedField) { warnedField = true; this.say('ringField', { name: 'The ring', skip: false }); }
        }
        const acc = 2.6 * dt;
        vel.x += THREE.MathUtils.clamp(want.x - vel.x, -acc, acc);
        vel.z += THREE.MathUtils.clamp(want.z - vel.z, -acc, acc);
        vel.y += THREE.MathUtils.clamp(want.y - vel.y, -acc * 1.4, acc * 1.4);
        if (slip > 0) vel.y -= 9.8 * dt * Math.min(1, slip * 1.5); // the hand flickering: the jet sinking out of it
        J.addScaledVector(vel, dt);
        // the hand brings it round to the runway's heading as it comes down
        const along = Math.abs(wrap(yaw - Math.PI / 2)) < Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2;
        yaw += wrap(along - yaw) * Math.min(1, dt * 0.6);
        if (held) powers.setCharge(powers.charge - dt * 2);
        const form = held ? 1 : Math.max(0, 1 - slip * 0.7) * (0.75 + 0.25 * Math.sin(engine.time * 40));
        const a = this.placeCarry(J, yaw, vel, form, engine.time);
        if (!gear && a < 60) { gear = true; f.gear(true); this.say('pilotGear', { skip: false }); }
        // the camera behind Hal, looking past him at the jet
        look.copy(J).lerp(player.position, 0.35);
        cam.set(Math.sin(camYaw), 0.32, Math.cos(camYaw)).normalize().multiplyScalar(30).add(look);
        cam.y = Math.max(cam.y, 2.2);
        director.pos.lerp(cam, 1 - Math.exp(-dt * 5));
        director.look.lerp(look, 1 - Math.exp(-dt * 8));
        const done = a < 0.25 && onField, dropped = slip > 1.1 || (a < -0.5);
        if (!done && !dropped) return;
        stop();
        this.takeControl();
        powers.markerTarget = null;
        this.hud.tutorial(null);
        resolve(done ? this.setDown(J, yaw) : false);
      });
      director.mode = 'shot';
      void ui;
    });
  }

  // On its wheels: the hand lets go a foot off the runway and opens away into the light; the jet
  // settles on its gear; Hal comes down beside it.
  async setDown(J, yaw0) {
    const { player, director, audio, powers } = this;
    const f = this.ferrisScene, rig = f.jetRig, hand = this.jetHand;
    const yaw = Math.abs(wrap(yaw0 - Math.PI / 2)) < Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2; // square to the runway
    const y0 = J.y, ground = rig.userData.hc;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), left = V(fwd.z, 0, -fwd.x);
    // low on the runway off its nose, as it settles
    director.cut(J.clone().addScaledVector(left, 16).addScaledVector(fwd, 15).setY(1.1), J.clone().setY(2.2), 44);
    this.jetBurning = false;
    audio.land(0.9);
    director.shake(0.25, 0.5);
    await tween(0.45, (k) => {
      J.y = THREE.MathUtils.lerp(y0, ground, k * k);
      rig.position.copy(J);
      rig.quaternion.setFromAxisAngle(_cu.set(0, 1, 0), yaw);
      hand.set('uForm', 1 - k);
      hand.beam.userData.u.uOpacity.value = 1.6 * (1 - k);
      hand.light.intensity = 30 * (1 - k);
    });
    hand.g.visible = hand.beam.visible = false;
    hand.light.intensity = 0;
    powers.dustFx(J.clone().setY(0.1), 30, 3);
    f.parkJet(J, yaw);
    // Hal down beside the cockpit, on the runway: on its south side (toward the apron), clear of the wing
    const land = J.clone().addScaledVector(left, left.z < 0 ? -9.5 : 9.5).addScaledVector(fwd, 3).setY(0);
    director.move(J.clone().addScaledVector(left, 15).addScaledVector(fwd, 12).setY(1.4), land.clone().lerp(J, 0.3).setY(1.6), 2.4, ease.inOut, 40);
    const from = player.object.position.clone();
    player.animator.play(still(POSES.hover, 0.5), 0.3);
    await tween(1.1, (k) => {
      player.object.position.lerpVectors(from, land, ease.inOut(k));
      player.object.rotation.y = Math.atan2(J.x - land.x, J.z - land.z);
    });
    player.spawn(f.physics, f.scene, land, Math.atan2(J.x - land.x, J.z - land.z));
    this.playerActive = true;
    player.animator.play(still(POSES.land, 0.6), 0.1);
    powers.landFx(8, false);
    await wait(1.0);
    player.autoAnim = true;
    player.animator.play(player.loco, 0.8);
    return true;
  }

  // It got away: the jet hits the desert (or slides out of the failing hand first). Try again.
  async jetLost(kind) {
    const { ui, director, audio, powers, player } = this;
    const f = this.ferrisScene, rig = f.jetRig;
    this.takeControl();
    powers.markerTarget = null;
    this.hud.tutorial(null);
    this.jetLive = false;
    if (this.jetHand) this.jetHand.g.visible = this.jetHand.beam.visible = false;
    const J = rig.position.clone(), vel = V(0, -8, 0);
    director.cut(player.position.clone().add(V(0, 2, 0)).lerp(J, 0.1), J.clone(), 46);
    if (kind === 'dropped') {
      await tween(Math.sqrt(Math.max(0, J.y - rig.userData.hc) / 8) + 0.3, (k, dt = 1 / 60) => {
        vel.y -= 9.8 / 60;
        rig.position.addScaledVector(vel, 1 / 60);
        rig.position.y = Math.max(rig.position.y, rig.userData.hc);
        director.look.lerp(rig.position, 0.2);
      }, ease.linear);
    }
    const G = rig.position.clone().setY(1);
    audio.explosion(1.1);
    director.shake(0.5, 1.5);
    this.fire.emit(160, (q, v) => {
      q[0] = G.x + (Math.random() - 0.5) * 8; q[1] = G.y; q[2] = G.z + (Math.random() - 0.5) * 8;
      v[0] = (Math.random() - 0.5) * 14; v[1] = 4 + Math.random() * 16; v[2] = (Math.random() - 0.5) * 14;
    }, { life: 1.6, size: [6, 1], color: [[4, 1.8, 0.5, 1], [1, 0.2, 0.05, 0]] });
    this.smoke.emit(120, (q, v) => {
      q[0] = G.x + (Math.random() - 0.5) * 10; q[1] = G.y + Math.random() * 4; q[2] = G.z + (Math.random() - 0.5) * 10;
      v[0] = (Math.random() - 0.5) * 3; v[1] = 3 + Math.random() * 6; v[2] = (Math.random() - 0.5) * 3;
    }, { life: 8, size: [5, 16], color: [[0.08, 0.07, 0.07, 0.9], [0.3, 0.28, 0.27, 0]] });
    rig.visible = false;
    this.jetQuiet = true;
    await wait(2.4);
    await ui.fade(1, 1.4);
    await ui.screen({
      kicker: 'Viper One-One', title: kind === 'crashed' ? 'TOO LATE' : 'IT SLIPPED',
      body: kind === 'crashed' ? 'Get under the jet before it reaches the ground. Hold Shift to fly faster.' : 'The hand only holds while the ring does: keep the click held all the way down.',
      buttons: ['Try again'],
    });
    this.save.resumeAfterReload(this.checkpointId);
  }

  // Carol runs out to the runway. Green Lantern, masked, beside the jet he just caught; she doesn't
  // know him. They have a moment.
  async meetCarolGL() {
    const { player, director } = this;
    const f = this.ferrisScene, carol = this.addCarol();
    await this.say('pilotDown');
    if (!carol) return;
    const ca = this.carolAnim, cb = this.cb, loco = this.carolLoco;
    ca.lookAt(null);
    // across the apron at a run
    const halP = player.position.clone(), toward = halP.clone().sub(CAROL_SPOT).setY(0).normalize();
    const runFrom = CAROL_SPOT.clone(), runYaw = Math.atan2(toward.x, toward.z);
    carol.root.position.copy(runFrom);
    carol.root.rotation.y = runYaw;
    director.cut(runFrom.clone().addScaledVector(toward, 9).add(V(3, 1.4, 0)), runFrom.clone().setY(1.2), 46);
    const watch = new THREE.Vector3();
    await tween(2.6, (k) => {
      loco.speed = Math.min(3.2, k * 9);
      carol.root.position.copy(runFrom).addScaledVector(toward, 3.2 * 2.6 * k * 0.8);
      watch.copy(carol.root.position).y += 1.2;
      director.look.lerp(watch, 0.2);
    }, ease.linear);
    // ...and there: a few metres from him, out of breath
    const stand = halP.clone().addScaledVector(toward, -3.0);
    carol.root.position.copy(stand).addScaledVector(toward, -2.2);
    const toHal = Math.atan2(halP.x - stand.x, halP.z - stand.z);
    carol.root.rotation.y = toHal;
    player.turnTo(Math.atan2(stand.x - halP.x, stand.z - halP.z));
    player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    director.cut(halP.clone().addScaledVector(toward, 1.2).add(V(2.6, 1.7, 0)), stand.clone().setY(1.4), 40);
    const p0 = carol.root.position.clone();
    await tween(0.9, (k) => { loco.speed = 2.6 * (1 - k); carol.root.position.lerpVectors(p0, stand, ease.out(k)); });
    loco.speed = 0;
    ca.lookAt(this.headOf(player.rig), 0.6);
    f.focus(stand);
    await this.overHal(1.4);
    await this.carolSay('carolGL1', [['who', () => ca.gesture('tilt', 1, 0.5)]]);
    await this.halClose(1.2);
    await this.say('halGL1');
    await this.carolClose(1.2);
    await this.carolSay('carolGL2', [['caught', 'open'], ['hand', () => ca.gesture('shake', 0.9, 0.3)]]);
    await this.halClose(0.9, -1);
    player.animator.gesture('tilt', 0.9, 0.4);
    await this.say('halGL2');
    await this.carolClose(1.6, -1, 28);
    await wait(0.6);
    await this.carolSay('carolGL3', [['met', () => ca.gesture('tilt', 1.2, -0.6)]]);
    await this.halClose(1.0);
    await wait(0.4);
    await this.say('halGL3');
    await wait(0.8);
  }

  // A line spoken by someone without a BodyLanguage (Hector): their mouth moves with it.
  async sayAs(rig, key, extra) {
    this.speakingRig = rig;
    try { await this.say(key, extra); } finally { if (this.speakingRig === rig) this.speakingRig = null; }
  }

  // ---------------------------------------------------------------- 5 AM: the wreck
  // Earlier that morning, at the lake: Abin Sur's ship under the Air Force's floodlights, an M35 by
  // the trees, the fires burnt down to embers. Hector Hammond, the general's son, alone at its hull:
  // he wakes something in it, and its exhaust takes him full in the face. He can hear what the men
  // round him are thinking.
  async wreck() {
    const { ui, director, audio, engine } = this;
    const site = this.setupCrash({ body: false });
    this.pocketLantern();
    this.powers.detach();
    this.hud.show(false);
    this.playerActive = false;
    this.takeControl();
    this.show(site);
    ui.clock(this.save.info('wreck').clock);
    site.fireRest = 0.03; // the fires burnt down to embers by now
    for (const fire of site.fires) fire.intensity = 0.03;
    const gen = audio.engine(0.04);
    gen.set(0.55);
    this.ambience(audio.water(0.08), audio.wind(0.05), audio.crickets(0.03));
    this.airForceNight(site);
    // Hector where Abin Sur sat, against the hull, facing it (n: out from the hull, ax: along it)
    const ax = V(SHIP.axis.x, 0, SHIP.axis.y), n = V(-SHIP.axis.y, 0, SHIP.axis.x);
    const at = ABIN_SPOT.clone().addScaledVector(n, 0.45);
    at.y = terrainHeight(at.x, at.z);
    const hec = (this.hecWreck = createHammond(this.assets.characters.hammond));
    hec.root.position.copy(at);
    hec.root.rotation.y = Math.atan2(-n.x, -n.z);
    site.scene.add(hec.root);
    const anim = new Animator(hec);
    anim.play(new MocapClip(this.mocap, 'idle', { timeScale: 0.7 }), 0);
    site.updaters.push((dt) => anim.update(dt));
    const head = () => hec.face(V(0, 0, 0));
    // the lights and the lake, from up the shore by the truck
    director.cut(V(2.5, 3.4, 14), SHIP.center.clone().add(V(0, 0.6, 0)), 44);
    await ui.fade(0, 2.0);
    director.move(V(3.5, 2.6, 10.5), at.clone().add(V(0, 1.0, 0)), 7, ease.inOut, 40);
    await wait(2.5);
    await this.say('techWreck1');
    // close on him, at the hull: a hand on a panel that has started to glow
    const h0 = head();
    director.cut(h0.clone().addScaledVector(ax, 1.5).addScaledVector(n, 0.9).add(V(0, -0.1, 0)), h0.clone().addScaledVector(n, -0.3), 36);
    const panel = at.clone().addScaledVector(n, -0.8).setY(at.y + 1.2);
    anim.reach('R', panel, { pole: V(-0.8, -0.6, -0.2), rate: 3 });
    await this.sayAs(hec, 'hecWreck1');
    await wait(0.6);
    // the ship wakes, and breathes out at him
    tween(1.1, (k) => (site.glowBoost = 3 * k));
    audio.riser?.(1.2, 0.25);
    await wait(1.1);
    const vent = panel.clone().addScaledVector(n, -0.2);
    this.exhaustBurst(site, vent, n);
    tween(1.5, (k) => (site.glowBoost = 3 * (1 - k)));
    audio.explosion(0.35);
    audio.psychic(0.8);
    engine.gradeUniforms.uFlash.value = 0.7;
    engine.gradeUniforms.uFlashColor?.value.setRGB(0.75, 1, 0.85);
    tween(0.9, (k) => (engine.gradeUniforms.uFlash.value = 0.7 * (1 - k)));
    director.shake(0.5, 0.8);
    anim.reach('R', null, { rate: 8 });
    // thrown back off his feet, onto his knees, his hands to his head
    const back = at.clone().addScaledVector(n, 1.3);
    await tween(0.5, (k) => hec.root.position.lerpVectors(at, back, ease.out(k)));
    anim.play(still(POSES.kneel, 1.4), 0.25);
    anim.reach('L', temple(hec, 'L', () => hec.root.rotation.y), { pole: V(1, -0.3, -0.2), rate: 6 });
    anim.reach('R', temple(hec, 'R', () => hec.root.rotation.y), { pole: V(-1, -0.3, -0.2), rate: 6 });
    await this.say('techWreck2');
    // what he hears now: their thoughts, the world swimming (his face, from the hull's side)
    const h1 = hec.face(V(0, 0, 0));
    director.cut(h1.clone().addScaledVector(n, -1.0).addScaledVector(ax, 0.35).add(V(0, 0.06, 0)), h1.clone().add(V(0, -0.03, 0)), 32);
    tween(3, (k) => { hec.setSwell(0.12 * k); hec.hu.uThrob.value = k; });
    tween(1.5, (k) => (engine.gradeUniforms.uDream.value = 0.5 * k));
    await this.say('techThought1');
    await this.say('techThought2');
    anim.reach('L', null, { rate: 3 });
    anim.reach('R', null, { rate: 3 });
    anim.lookAt(V(-6, 1.7, 10), 0.8);
    await wait(0.8);
    director.move(h1.clone().addScaledVector(n, -0.8).addScaledVector(ax, 0.2).add(V(0, 0.05, 0)), h1.clone().add(V(0, -0.03, 0)), 2.5, ease.inOut, 26);
    await this.sayAs(hec, 'hecWreck2', { hold: 1.2 });
    await ui.fade(1, 1.6);
    engine.gradeUniforms.uDream.value = 0;
    gen.stop(1);
    hec.root.removeFromParent();
  }

  // The Air Force at the lake, overnight: a truck up the shore, two trailer light towers with their
  // lamps on the wreck (one casts the shadows).
  airForceNight(site) {
    const s = site.scene, h = terrainHeight;
    const at = (o, x, z, yaw) => { o.position.set(x, h(x, z), z); o.rotation.y = yaw; s.add(o); return o; };
    if (hasProp('m35')) at(prop('m35'), -9, 9.5, -2.3);
    const aim = SHIP.center.clone().add(V(0, 0.8, 0));
    [[15, 2, true], [-3, 3.5, false]].forEach(([x, z, shadow]) => {
      const yaw = Math.atan2(aim.x - x, aim.z - z);
      if (hasProp('lighttower')) at(prop('lighttower'), x, z, yaw + Math.PI);
      const top = V(x, h(x, z) + 4.2, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.8, 3.4) }));
      lamp.position.copy(top);
      lamp.lookAt(aim);
      s.add(lamp);
      const spot = new THREE.SpotLight(0xfff1dc, 240, 45, 0.6, 0.6, 2);
      spot.position.copy(top);
      spot.target.position.copy(aim);
      spot.castShadow = shadow;
      if (shadow) { spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; }
      s.add(spot, spot.target);
    });
  }

  // The ship's breath: a gout of pale green light and vapour out of a vent at whoever's in front of it.
  exhaustBurst(site, at, dir) {
    const p = (this.vapour ??= (() => { const v = new Particles(500, { additive: true, drag: 1.4, turbulence: 1.2 }); site.scene.add(v.points); site.updaters.push((dt, t) => v.update(dt, t, this.engine.camera, this.engine.renderer)); return v; })());
    p.emit(320, (q, v) => {
      q[0] = at.x; q[1] = at.y; q[2] = at.z;
      const sp = 3 + Math.random() * 7;
      v[0] = dir.x * sp + (Math.random() - 0.5) * 2.5; v[1] = (Math.random() - 0.3) * 2; v[2] = dir.z * sp + (Math.random() - 0.5) * 2.5;
    }, { life: 1.1, size: [0.18, 0.7], color: [[1.2, 3.2, 1.9, 0.9], [0.2, 0.6, 0.35, 0]] });
    const light = new THREE.PointLight(0x9fffc0, 40, 12, 2);
    light.position.copy(at);
    site.scene.add(light);
    // and a cone of it, straight out of the vent
    const shaft = createShaft({ from: at.clone(), to: at.clone().addScaledVector(dir, 3.2), radiusFrom: 0.12, radiusTo: 1.1, color: new THREE.Color(0.6, 2.2, 1.2) });
    shaft.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
    site.scene.add(shaft);
    tween(1.2, (k) => { light.intensity = 40 * (1 - k); shaft.userData.uniforms.uOpacity.value = 2.2 * (1 - k) ** 2; }).then(() => { light.removeFromParent(); shaft.removeFromParent(); });
  }

  // ---------------------------------------------------------------- 2:11 PM: Hector Hammond
  // Hector, built for the fight at Ferris (enemies/Hammond.js), standing where he'll walk out from.
  addHammond() {
    if (this.hec) return this.hec;
    const f = this.ferrisScene, { powers, player, audio, director, engine } = this;
    const hec = (this.hec = new Hammond({ scene: f.scene, physics: f.physics, powers, player, audio, director, engine, mocap: this.mocap, gltf: this.assets.characters.hammond }));
    hec.rig.setSwell(0.38); // hours on from the lake
    f.updaters.push((dt, t) => hec.update(dt, t));
    return hec;
  }

  // The shriek, and he walks out of the heat off the runway; he knows Carol, he hears Hal under the
  // mask, he made the jet fall. Then the fight: break his shell while he throws the runway at you,
  // and keep what he throws at Carol off her.
  async hector() {
    const { ui, director, audio, player, powers, engine } = this;
    const f = this.ferrisScene, carol = this.addCarol(), grade = engine.gradeUniforms;
    ui.clock(this.save.info('hector').clock);
    this.takeControl();
    const hec = this.addHammond();
    const hal = player.position.clone(), cp = carol ? carol.root.position.clone() : hal.clone().add(V(0, 0, 3));
    // he comes down the runway from the open side, away from the jet (never under its wing)
    const away = V(Math.sign(hal.x - f.jetRig.position.x) || 1, 0, 0), side = V(-away.z, 0, away.x);
    const from = hal.clone().addScaledVector(away, 34), to = hal.clone().addScaledVector(away, 15);
    hec.place(from, Math.atan2(-away.x, -away.z));
    // the shriek: inside their heads
    audio.psychic(1.3);
    director.shake(0.4, 0.9);
    tween(1.6, (k) => (grade.uDream.value = 0.5 * Math.sin(k * Math.PI)));
    const halYaw = () => player.yaw, carolYaw = () => carol.root.rotation.y;
    player.animator.reach('L', temple(player.rig, 'L', halYaw), { pole: V(1, -0.3, -0.2), rate: 8 });
    player.animator.reach('R', temple(player.rig, 'R', halYaw), { pole: V(-1, -0.3, -0.2), rate: 8 });
    if (carol) { this.carolAnim.reach('L', temple(carol, 'L', carolYaw), { pole: V(1, -0.3, -0.2), rate: 8 }); this.carolAnim.reach('R', temple(carol, 'R', carolYaw), { pole: V(-1, -0.3, -0.2), rate: 8 }); }
    director.cut(hal.clone().addScaledVector(side, 3.2).addScaledVector(away, -2.2).setY(1.5), hal.clone().lerp(cp, 0.5).setY(1.3), 42);
    await wait(1.6);
    player.animator.reach('L', null, { rate: 4 });
    player.animator.reach('R', null, { rate: 4 });
    if (carol) { this.carolAnim.reach('L', null, { rate: 4 }); this.carolAnim.reach('R', null, { rate: 4 }); }
    // down the runway, out of the shimmer, walking
    player.turnTo(Math.atan2(away.x, away.z));
    player.lookAt(() => hec.rig.face(_h), 0.8);
    if (carol) this.carolAnim.lookAt(() => hec.rig.face(_h), 0.7);
    const walk = new Locomotion(this.mocap);
    walk.scale = hec.rig.hipsHeight / this.mocap.hipsHeight;
    walk.relax.adduct = 0.1;
    hec.anim.play(walk, 0.3);
    director.cut(hal.clone().addScaledVector(away, -2.6).addScaledVector(side, 1.0).setY(1.75), to.clone().setY(1.5), 40);
    await tween(5.5, (k) => {
      walk.speed = 1.1;
      hec.place(from.clone().lerp(to, k), Math.atan2(-away.x, -away.z));
    }, ease.linear);
    walk.speed = 0;
    hec.anim.play(new MocapClip(this.mocap, 'idle', { timeScale: 0.8 }), 0.5);
    // (a step further back as the head grows, so all of it's in the frame)
    const hecClose = (d = 1.6, sideK = 0.5) => { const hh = hec.rig.face(V(0, 0, 0)), k = hec.rig.headScale(); return director.move(hh.clone().addScaledVector(away, -d * k).addScaledVector(side, sideK * k).add(V(0, -0.08, 0)), hh.clone().add(V(0, 0.03 * k, 0)), 1.2, ease.inOut, 32); };
    if (carol) hec.anim.lookAt(() => carol.bonePosition('head', _h2), 0.7);
    await hecClose(1.8, -0.5);
    await this.sayAs(hec.rig, 'hecArrive1');
    hec.anim.lookAt(() => player.rig.bonePosition('head', _h2), 0.7);
    await this.sayAs(hec.rig, 'hecArrive2');
    await this.halClose(1.0);
    await this.say('halHec1');
    await hecClose(1.5, 0.45);
    await this.sayAs(hec.rig, 'hecArrive3');
    await this.sayAs(hec.rig, 'hecArrive4');
    await this.halClose(0.8, -1);
    await this.say('halHec2');
    await hecClose(1.3, -0.3);
    await this.sayAs(hec.rig, 'hecArrive5');
    // and she's thrown down by it
    audio.psychic(1);
    director.shake(0.3, 0.6);
    if (carol) this.knockCarolDown(carol, away);
    // the fight
    this.carolHit = false;
    hec.carol = carol ? { position: () => carol.root.position } : null;
    hec.onCarolHit = () => { this.carolHit = true; };
    let quipT = 0;
    hec.onHurtHal = (kind) => { if (engine.time - quipT > 9) { quipT = engine.time; this.sayAs(hec.rig, kind === 'wave' ? 'hecWave' : Math.random() < 0.5 ? 'hecQ1' : 'hecQ2', { skip: false }); } };
    hec.onQuip = (kind) => { if (kind === 'hurt' && engine.time - quipT > 9) { quipT = engine.time; this.sayAs(hec.rig, 'hecHurt', { skip: false }); } };
    let broken = false;
    hec.onBreak = () => { broken = true; };
    // when he means to throw at her, the ring says so and marks her
    hec.onAimCarol = (on) => {
      powers.markerTarget = on && carol ? { pos: carol.root.position.clone().setY(1), label: 'Protect Carol' } : null;
      if (on) this.ringSay('ringCarol');
    };
    powers.enabled.constructs = true;
    hec.engage();
    this.hud.boss('Hector Hammond', 1, 0.45);
    const bar = onFrame(() => this.hud.boss('Hector Hammond', hec.strength, 0.45));
    f.follow = () => player.position;
    this.giveControl('Break Hammond’s shield. Keep what he throws off Carol.');
    this.hud.tutorial({ kicker: 'Hector Hammond', title: 'Break his shield', n: 1, of: 1, html: '<b>4</b> constructs &nbsp; a <b>shield</b> or <b>wall</b> between Carol and what he throws' });
    this.ringSay('ringProtect');
    await waitFor(() => broken || this.carolHit);
    bar();
    powers.markerTarget = null;
    if (this.carolHit) return this.carolLost();
    await this.mindAttack(hec, carol);
    await this.sinestroOnEarth(hec, carol);
  }

  // Carol, down on one knee and her hand to her head, where Hammond's push left her.
  knockCarolDown(carol, away) {
    const ca = this.carolAnim;
    const p0 = carol.root.position.clone(), p1 = p0.clone().addScaledVector(away, -0.8);
    tween(0.5, (k) => carol.root.position.lerpVectors(p0, p1, ease.out(k)));
    ca.play(still(POSES.kneel, 1.2), 0.3);
    this.cb.stance(null);
    ca.reach('R', temple(carol, 'R', () => carol.root.rotation.y), { pole: V(-1, -0.4, -0.2), rate: 5 });
    ca.lookAt(null);
  }

  // Something he threw hit her. Try again.
  async carolLost() {
    const { ui } = this;
    this.takeControl();
    this.hud.boss(null);
    this.hud.tutorial(null);
    this.hec.fighting = false;
    await wait(0.6);
    await ui.fade(1, 1.2);
    await ui.screen({ kicker: 'Carol Ferris', title: 'CAROL!', body: 'Some of what he throws is meant for her. Get a shield, a wall or a fist between them.', buttons: ['Try again'] });
    this.save.resumeAfterReload(this.checkpointId);
  }

  // His shell gone, he goes for Hal's mind instead (Secret Origin): pulls him out of the air onto his
  // knees, and the field goes the colour of the dream; the F-104 comes down across the sky again.
  // He finds the boy at the fence, the father, the name.
  async mindAttack(hec, carol) {
    const { director, audio, player, powers, engine } = this;
    const f = this.ferrisScene, grade = engine.gradeUniforms;
    this.takeControl();
    this.hud.boss(null);
    this.hud.tutorial(null);
    powers.clearConstructs();
    powers.enabled.constructs = false;
    this.playerActive = false;
    player.flying = false;
    player.autoAnim = false;
    const animOff = onFrame((dt) => player.animator.update(dt));
    const toHal = player.position.clone().sub(hec.position).setY(0).normalize(), side = V(-toHal.z, 0, toHal.x);
    const kneel = hec.position.clone().addScaledVector(toHal, 5.5).setY(0), from = player.object.position.clone();
    audio.psychic(1.2);
    player.animator.play(still(from.y > 0.6 ? POSES.hover : POSES.land, 0.5), 0.2);
    director.cut(kneel.clone().addScaledVector(side, 6).addScaledVector(toHal, 3).setY(2.4), kneel.clone().setY(1.2), 46);
    await tween(Math.min(1.6, 0.5 + from.distanceTo(kneel) / 20), (k) => {
      player.object.position.lerpVectors(from, kneel, ease.in(k));
      player.object.rotation.y = Math.atan2(-toHal.x, -toHal.z);
      _h.copy(player.object.position).y += 1.1;
      director.look.lerp(_h, 0.3);
    });
    player.place(kneel, Math.atan2(-toHal.x, -toHal.z));
    audio.land(0.9);
    powers.dustFx(kneel, 20, 2);
    player.animator.play(still(POSES.kneel, 1.2), 0.15);
    player.animator.reach('L', temple(player.rig, 'L', () => player.yaw), { pole: V(1, -0.3, -0.2), rate: 6 });
    player.animator.reach('R', temple(player.rig, 'R', () => player.yaw), { pole: V(-1, -0.3, -0.2), rate: 6 });
    hec.anim.reach('R', temple(hec.rig, 'R', () => hec.yaw), { pole: V(-1, -0.3, -0.2), rate: 6 });
    // the field goes to sepia, swimming: the dream's look
    const sw0 = hec.rig.hu.uSwell.value;
    tween(2.2, (k) => { grade.uDream.value = 0.85 * k; hec.rig.hu.uThrob.value = 1; hec.rig.setSwell(Math.max(sw0, 0.6 + 0.08 * k)); });
    // over Hector's shoulder: Hal on his knees, the sky beyond him
    const hh = hec.rig.face(V(0, 0, 0));
    director.cut(hh.clone().addScaledVector(toHal, -1.6 * hec.rig.headScale()).addScaledVector(side, 0.6).add(V(0, 0.1, 0)), kneel.clone().setY(1.0), 38);
    await this.sayAs(hec.rig, 'hecMind1');
    // the memory: a Starfighter coming down across the same sky, twenty years ago
    const jet = hasProp('f104') ? prop('f104') : null;
    if (jet) {
      f.scene.add(jet);
      const smoke = (this.memorySmoke ??= (() => {
        const p = new Particles(600, { additive: false, puffy: true, drag: 0.35, turbulence: 0.8 });
        f.scene.add(p.points);
        f.updaters.push((dt, t) => p.update(dt, t, engine.camera, engine.renderer));
        return p;
      })());
      const a = kneel.clone().addScaledVector(side, -150).addScaledVector(toHal, 200).setY(95), b = kneel.clone().addScaledVector(side, 110).addScaledVector(toHal, 250).setY(3);
      const dir = b.clone().sub(a).normalize();
      director.cut(kneel.clone().addScaledVector(toHal, -2.2).addScaledVector(side, -0.8).setY(1.0), kneel.clone().addScaledVector(toHal, 30).setY(18), 50);
      const look = new THREE.Vector3();
      audio.jet(4.5, 0.25);
      await tween(4.2, (k) => {
        jet.position.lerpVectors(a, b, k * k);
        jet.quaternion.setFromUnitVectors(_cu.set(0, 0, 1), dir);
        jet.rotateZ(k * 3);
        smoke.emit(3, (q, v) => { q[0] = jet.position.x; q[1] = jet.position.y; q[2] = jet.position.z; v[0] = (Math.random() - 0.5); v[1] = Math.random(); v[2] = (Math.random() - 0.5); }, { life: 5, size: [3, 12], color: [[0.1, 0.09, 0.08, 0.75], [0.3, 0.28, 0.27, 0]] });
        look.copy(jet.position).lerp(kneel, 0.5);
        director.look.lerp(look, 0.04);
      }, ease.linear);
      audio.explosion(0.45);
      grade.uFlash.value = 0.5;
      tween(0.8, (k) => (grade.uFlash.value = 0.5 * (1 - k)));
      jet.removeFromParent();
    }
    // close on Hal, and the name
    const hd = player.rig.bonePosition('head', V(0, 0, 0));
    director.cut(hd.clone().addScaledVector(toHal, -1.3).addScaledVector(side, 0.4), hd.clone(), 32);
    await this.sayAs(hec.rig, 'hecMind2');
    director.move(hd.clone().addScaledVector(toHal, -0.95).addScaledVector(side, 0.25), hd.clone(), 2.2, ease.inOut, 28);
    await this.sayAs(hec.rig, 'hecMind3', { hold: 0.5 });
    await this.say('halMind');
    animOff();
    this.mindAnimOff = onFrame((dt) => player.animator.update(dt));
  }

  // Out of the sky: Sinestro's fist comes down on Hammond, then Sinestro himself, sent to look into
  // Abin Sur's death (Secret Origin). Abin Sur's ship carried a prisoner; the cell is empty. The
  // Air Force is on its way across the field: Hal goes before Carol comes round.
  async sinestroOnEarth(hec, carol) {
    const { director, audio, player, powers, engine } = this;
    const f = this.ferrisScene, grade = engine.gradeUniforms;
    const sin = (this.sin ??= new Sinestro({ scene: f.scene, physics: f.physics, powers, player, audio, director, mocap: this.mocap, abin: this.assets.characters.abin, ring: createRing(), attachRing: (r, rig) => this.attachRing(r, rig) }));
    f.updaters.push((dt, t) => sin.update(dt, t));
    sin.place(V(0, -40, 0), 0);
    const toHal = player.position.clone().sub(hec.position).setY(0).normalize(), side = V(-toHal.z, 0, toHal.x);
    // the fist, from nowhere
    const fist = sin.fist, at = hec.position.clone();
    fist.visible = true;
    fist.quaternion.setFromUnitVectors(_cu.set(0, 0, 1), V(0, -1, 0));
    director.cut(at.clone().addScaledVector(toHal, 9).addScaledVector(side, 5).setY(2), at.clone().setY(3), 50);
    audio.whoosh(0.7, 0.8);
    await tween(0.55, (k) => { fist.userData.set('uForm', Math.min(1, k * 2)); fist.position.copy(at).y += 14 - 12.6 * ease.in(k); });
    audio.explosion(0.6);
    director.shake(0.8, 0.8);
    powers.dustFx(at, 40, 4);
    f.physics.burst(at, 6, 6, 3, 1);
    // Hammond, flat on his back
    hec.anim.reach('R', null, { rate: 8 });
    const h0 = hec.position.clone(), h1 = h0.clone().addScaledVector(toHal, -2.2);
    tween(0.5, (k) => { hec.rig.root.position.lerpVectors(h0, h1, ease.out(k)); hec.rig.root.rotation.x = -Math.PI / 2 * ease.out(k); hec.rig.root.position.y = 0.12 * k; });
    hec.update = (dt) => hec.anim.update(dt); // out cold: no more of him
    hec.rig.hu.uThrob.value = 0;
    hec.shell.visible = false;
    if (hec.ringMesh) hec.ringMesh.visible = false;
    tween(1.0, (k) => { grade.uDream.value = 0.85 * (1 - k); fist.userData.set('uForm', 1 - k); }).then(() => (fist.visible = false));
    this.mindAnimOff?.();
    player.animator.reach('L', null, { rate: 3 });
    player.animator.reach('R', null, { rate: 3 });
    const animOff = onFrame((dt) => player.animator.update(dt));
    this.speakingRig = sin.rig;
    await this.say('sinFerris1');
    this.speakingRig = null;
    // and down after it: a streak of green out of the sky, landing beside Hal
    const land = player.position.clone().addScaledVector(side, 4.5).addScaledVector(toHal, -1.5).setY(0);
    const from = land.clone().add(V(-30, 70, 40)), yaw = Math.atan2(player.position.x - land.x, player.position.z - land.z);
    sin.place(from, yaw);
    sin.anim.play(sin.flyGen, 0);
    sin.flyState.k = 0.8;
    const trail = createShaft({ from, to: from.clone().add(V(0, -1, 0)), radiusFrom: 0.05, radiusTo: 0.5, color: new THREE.Color(0.4, 2.4, 1.0) });
    trail.quaternion.setFromUnitVectors(V(0, -1, 0), land.clone().sub(from).normalize());
    trail.userData.uniforms.uOpacity.value = 2.0;
    f.scene.add(trail);
    director.cut(player.position.clone().addScaledVector(toHal, 3).addScaledVector(side, -2).setY(1.4), land.clone().lerp(from, 0.3), 46);
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
    powers.dustFx(land, 14, 1.2);
    // Hal gets up off his knees
    player.animator.play(still(POSES.stand, 1), 0.9);
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    await wait(0.8);
    const sinClose = (d = 1.7, s = 0.5) => { const hh = sin.rig.bonePosition('head', V(0, 0, 0)), fw = V(Math.sin(yaw), 0, Math.cos(yaw)), r = V(fw.z, 0, -fw.x); return director.move(hh.clone().addScaledVector(fw, d).addScaledVector(r, s).add(V(0, -0.05, 0)), hh.clone(), 1.2, ease.inOut, 32); };
    await sinClose(1.8, 0.5);
    await this.perform(sin.bl, 'sinFerris2', [['ganthet', 'present'], ['knees', () => sin.anim.gesture('chin', 1.2, 0.5)]]);
    await this.halClose(1.0, -1);
    await this.say('halSin1');
    await sinClose(1.5, -0.4);
    await this.perform(sin.bl, 'sinFerris3', [['watching', () => sin.anim.gesture('nod', 0.8, 0.4)]]);
    await wait(0.4);
    await this.perform(sin.bl, 'sinFerris4', [['prison', 'ring'], ['empty', () => sin.anim.gesture('beat', 0.6, 0.6)]]);
    await this.halClose(1.0);
    await this.say('halSin2');
    audio.siren(10, 0.05);
    await sinClose(1.3, 0.3);
    await this.perform(sin.bl, 'sinFerris5', [['hates', () => sin.anim.gesture('chin', 1, 0.5)], ['coming', 'dismiss']]);
    // he goes up and away; Carol stirring; Hal goes too
    sin.anim.play(sin.flyGen, 0.4);
    const up = sin.position.clone(), sky = up.clone().add(V(40, 160, -60));
    audio.whoosh(1.6, 0.5);
    director.move(player.position.clone().addScaledVector(toHal, 4).setY(1.2), up.clone().add(V(0, 8, 0)), 2.0, ease.inOut, 50);
    await tween(2.0, (k) => { sin.place(up.clone().lerp(sky, ease.in(k)), yaw); sin.flyState.k = Math.min(1, k * 2); }, ease.linear);
    sin.place(V(0, -40, 0), 0);
    if (carol) {
      const ca = this.carolAnim;
      ca.reach('R', null, { rate: 3 });
      ca.play(this.carolLoco, 1.2);
      this.cb.stance('hip');
      ca.lookAt(() => player.rig.bonePosition('head', _h), 0.6);
      player.lookAt(() => carol.bonePosition('head', _h2), 0.7);
      const cHead = carol.bonePosition('head', V(0, 0, 0));
      director.cut(cHead.clone().add(V(1.6, 0.0, 1.6)), cHead.clone(), 34);
      await wait(1.8);
    }
    // up, and gone, before anyone sees which way
    player.animator.play(still(POSES.land, 0.5), 0.2);
    await wait(0.4);
    director.cut(player.position.clone().addScaledVector(side, 6).setY(1.0), player.position.clone().setY(6), 52);
    player.animator.play(player.flightGen, 0.2);
    player.flightState.k = 1;
    this.engine.gradeUniforms.uFlash.value = 0.25;
    tween(0.4, (k) => (this.engine.gradeUniforms.uFlash.value = 0.25 * (1 - k)));
    audio.takeoff();
    const p0 = player.object.position.clone(), p1 = p0.clone().add(V(0, 120, 0));
    tween(1.6, (k) => player.object.position.lerpVectors(p0, p1, ease.in(k)), ease.linear);
    await wait(1.0);
    await this.ui.fade(1, 1.2);
    animOff();
    this.powers.detach();
    this.hud.show(false);
  }

  // ---------------------------------------------------------------- 6:48 PM: his father's grave
  // The memorial park on the edge of town at dusk. Hal (out of the suit) at Martin Jordan's stone;
  // the ring makes his father out of its light, who waves the way he did from the airfield.
  async grave() {
    const { ui, director, audio, player, powers, engine } = this;
    const f = this.setupFerris();
    f.dusk();
    f.cemetery();
    ui.clock(this.save.info('grave').clock);
    this.takeControl();
    // hours later, in his own clothes again
    if (player.rig !== this.hal) {
      this.ring.removeFromParent();
      player.setRig(this.hal);
      this.attachRing(this.ring, this.hal);
      powers.suited = false;
    }
    player.setTired(0.5);
    player.speedScale = 1;
    powers.detach();
    Object.assign(powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    // his car on the drive by the gate
    const C = CEMETERY, car = f.car;
    car.position.copy(C).add(V(-40, 0, -3.2));
    car.rotation.y = Math.PI / 2;
    f.carBox?.setTranslation({ x: car.position.x, y: 0.65, z: car.position.z }, true);
    f.carBox?.setRotation(new THREE.Quaternion().setFromAxisAngle(_cu.set(0, 1, 0), Math.PI / 2), true);
    const start = C.clone().add(V(-37, 0, -0.5));
    this.enterFerris(start, Math.PI / 2);
    this.ambience(audio.wind(0.04), audio.crickets(0.02));
    f.shadowSpan(60);
    f.focus(C.clone().add(V(-10, 0, 0)));
    player.autoAnim = true;
    player.animator.play(player.loco, 0);
    // the gate, and the park beyond it, the sun going down over the desert
    director.cut(C.clone().add(V(-46, 1.4, 6)), C.clone().add(V(-30, 2.2, -1)), 42);
    await ui.fade(0, 2.2);
    director.move(C.clone().add(V(-44, 1.5, 4.5)), C.clone().add(V(-28, 2.0, -0.5)), 6, ease.inOut, 40);
    await wait(2.5);
    const graveAt = C.clone().add(GRAVE), stand = graveAt.clone().add(V(1.95, 0, 0.1)); // (the kneel puts a knee 0.6 m ahead)
    f.follow = () => player.position;
    this.director.mode = 'follow';
    this.giveControl('Visit your father’s grave, at the end of the path');
    this.bark('halGraveWay');
    // a marker on his stone while the player looks for it (the ring's HUD is off: drawn here)
    const mark = graveAt.clone().setY(1.3), scr = new THREE.Vector3();
    const markOff = onFrame(() => {
      if (!player.control) { this.hud.setMarker(null); return; }
      scr.copy(mark).project(engine.camera);
      const behind = scr.z > 1;
      let x = behind ? -scr.x : scr.x, y = behind ? -scr.y : scr.y;
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
      if (off) { const k = 1 / Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86, 1e-3); x *= k; y *= k; }
      const d = player.position.distanceTo(graveAt);
      this.hud.setMarker((x * 0.5 + 0.5) * innerWidth, (-y * 0.5 + 0.5) * innerHeight, `Martin Jordan${d > 4 ? ` · ${Math.round(d)} m` : ''}`, off);
    });
    await new Promise((resolve) => {
      // (generous: anywhere round it, or on the path beside it)
      f.interact({ position: graveAt.clone().add(V(0.4, 0, -1.5)), radius: 4.6, look: graveAt.clone().setY(0.7), label: 'Your father', action: () => { this.takeControl(); resolve(); } });
    });
    markOff();
    this.hud.setMarker(null);
    f.interactables.length = 0;
    f.follow = null;
    f.focus(graveAt);
    // round to the front of the stone (it faces east, away from the gate), not through it
    if (player.position.x < graveAt.x + 0.6) await player.walkTo(graveAt.clone().add(V(1.5, 0, -1.4)), player.walkSpeed * 0.8);
    if (player.position.distanceTo(stand) > 0.4) await player.walkTo(stand, player.walkSpeed * 0.8);
    player.turnTo(-Math.PI / 2);
    player.lookAt(graveAt.clone().setY(0.6), 0.8);
    await wait(0.8);
    // down on one knee in front of it, the sun behind the stone
    player.autoAnim = false;
    player.animator.play(still(POSES.kneel, 1.2), 0.9);
    director.cut(stand.clone().add(V(2.6, 1.3, 1.6)), graveAt.clone().setY(0.7), 40);
    director.move(stand.clone().add(V(2.2, 1.2, 1.2)), graveAt.clone().setY(0.65), 8, ease.inOut, 38);
    await wait(1.6);
    await this.say('halGrave1');
    // the name
    director.cut(graveAt.clone().add(V(0.95, 0.62, 0.12)), graveAt.clone().setY(0.56), 30);
    await wait(1.2);
    const hd = () => player.rig.bonePosition('head', V(0, 0, 0));
    director.cut(hd().add(V(-1.0, 0.0, 0.55)), hd(), 32);
    await this.say('halGrave2');
    player.animator.gesture('shake', 1.0, 0.3);
    await wait(0.6);
    await this.say('halGrave3');
    // the ring answers what he's thinking of: his father, out of its light, beside the stone
    const martin = (this.martin = createLightFigure(this.assets.characters.casual, { jaw: JAW.casual }));
    const mAt = graveAt.clone().add(V(0.35, 0, -1.3)); // beside the stone, clear of the cypress behind it
    martin.root.position.copy(mAt);
    martin.root.rotation.y = Math.atan2(stand.x - mAt.x, stand.z - mAt.z);
    f.scene.add(martin.root);
    const ma = new Animator(martin);
    ma.play(new MocapClip(this.mocap, 'idle', { timeScale: 0.7 }), 0);
    const mLook = new THREE.Vector3();
    ma.lookAt(() => player.rig.bonePosition('head', mLook), 0.6);
    f.updaters.push((dt) => ma.update(dt));
    const mu = martin.u;
    mu.uDissolveOn.value = 1;
    mu.uDissolveSign.value = -1;
    mu.uDissolve.value = -0.1;
    const glow = new THREE.PointLight(0x55ff88, 0, 6, 2);
    glow.position.copy(mAt).y += 1.2;
    f.scene.add(glow);
    this.ringGlow = 3;
    audio.ringChime();
    audio.riser?.(2.6, 0.2);
    director.cut(stand.clone().add(V(1.6, 1.4, 2.4)), mAt.clone().setY(1.2), 40);
    player.lookAt(() => martin.bonePosition('head', _h2), 0.6);
    await tween(2.8, (k) => { mu.uDissolve.value = -0.1 + 1.25 * k; glow.intensity = 3 * k; }, ease.inOut);
    mu.uDissolveOn.value = 0;
    await wait(0.8);
    // Hal up off his knee, face to face with him
    player.animator.play(still(POSES.stand, 1), 1.2);
    await wait(1.0);
    // over Hal's shoulder, his father in front of him
    const mHead = martin.bonePosition('head', V(0, 0, 0)), hh = hd(), toM = mHead.clone().sub(hh).setY(0).normalize(), rgt = V(-toM.z, 0, toM.x);
    director.cut(hh.clone().addScaledVector(toM, -1.1).addScaledVector(rgt, 0.55).add(V(0, 0.08, 0)), mHead.clone().add(V(0, -0.05, 0)), 34);
    await this.say('halGrave4');
    ma.gesture('tilt', 1.2, 0.5);
    await wait(0.6);
    await this.halClose(1.0);
    await this.say('halGrave5');
    // the wave from the airfield, twenty years ago
    const shoulder = new THREE.Vector3(), up = V(0, 1, 0), wave = { a: 0 }, hand = new THREE.Vector3();
    ma.reach('R', () => {
      martin.bonePosition('upperArm_R', shoulder);
      return shoulder.add(hand.set(-0.22 + 0.13 * Math.sin(wave.a), 0.56, 0.16).applyAxisAngle(up, martin.root.rotation.y));
    }, { pole: V(-1, -0.2, -0.3), rate: 4 });
    director.cut(stand.clone().add(V(-0.4, 1.5, 2.6)), mAt.clone().lerp(stand, 0.5).setY(1.4), 42);
    await wait(0.9);
    await tween(2.4, (k) => (wave.a = k * Math.PI * 6), ease.linear);
    ma.reach('R', null, { rate: 3 });
    ma.gesture('nod', 1.2, 0.4);
    await wait(1.0);
    // and he's gone back into the light
    mu.uDissolveOn.value = 1;
    mu.uDissolveSign.value = 1;
    const motes = new Particles(200, { additive: true, drag: 0.6, turbulence: 0.6, gravity: -0.4 });
    f.scene.add(motes.points);
    f.updaters.push((dt, t) => motes.update(dt, t, engine.camera, engine.renderer));
    await tween(2.4, (k) => {
      mu.uDissolve.value = -0.1 + 1.25 * k;
      glow.intensity = 3 * (1 - k);
      motes.emit(2, (q, v) => { q[0] = mAt.x + (Math.random() - 0.5) * 0.5; q[1] = mAt.y + 1.9 * k; q[2] = mAt.z + (Math.random() - 0.5) * 0.5; v[0] = (Math.random() - 0.5) * 0.3; v[1] = 0.4 + Math.random() * 0.6; v[2] = (Math.random() - 0.5) * 0.3; }, { life: 2, size: [0.06, 0], color: [[0.8, 4, 1.6, 1], [0.1, 1, 0.4, 0]] });
    }, ease.inOut);
    martin.root.removeFromParent();
    glow.removeFromParent();
    this.ringGlow = 0.6;
    await wait(0.8);
    // toward the sunset, and the city
    player.lookAt(C.clone().add(V(-200, 20, 200)), 0.6);
    director.cut(stand.clone().add(V(-6, 1.2, -5)), stand.clone().setY(1.5), 46);
    director.move(stand.clone().add(V(-8, 2.2, -7)), stand.clone().setY(1.6), 7, ease.inOut, 44);
    await wait(1.2);
    await this.say('halGrave6', { hold: 1.6 });
    await ui.fade(1, 2.4);
    const pick = await this.ui.screen({
      emblem: true,
      kicker: 'Part Three · Coast City',
      title: 'FIRST LIGHT',
      subtitle: 'End of Part Three',
      body: 'Fired, two months behind on the rent, and Green Lantern in front of everyone at Ferris. Hector Hammond knows his name.\n\nAnd whatever broke out of Abin Sur’s ship is still out there.',
      buttons: [{ label: 'Part Four: The Prisoner', sub: 'His pilot' }, 'Quit to title'],
    });
    if (pick === 0) { PrisonerSave.resumeAfterReload(PrisonerSave.first); await new Promise(() => {}); }
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  }
}
const _h = new THREE.Vector3(), _h2 = new THREE.Vector3(), _fw = new THREE.Vector3(), _rh = new THREE.Vector3(), _pole = new THREE.Vector3();
const _cf = new THREE.Vector3(), _cr = new THREE.Vector3(), _cu = new THREE.Vector3(), _ch = new THREE.Vector3(), _cb = new THREE.Vector3(), _ca = new THREE.Vector3(), _ce = new THREE.Euler();

// Where a hand goes for both hands to the head (pain, a psychic blow): the wrist level with the
// ear and out from it, the fingers over the temple. Each closure has its own vectors: the arm IK
// asks for both hands' targets before it solves either, and a shared scratch vector put both
// hands on the same side.
function temple(rig, side, yaw) {
  const p = new THREE.Vector3(), o = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), s = side === 'L' ? 1 : -1;
  // (Hector's head grows: beside his eyes, out past it)
  if (rig.face) return () => rig.face(p).add(o.set(s * (rig.headWidth() + 0.05), 0, -0.02).applyAxisAngle(up, yaw()));
  return () => rig.bonePosition('head', p).add(o.set(s * 0.17, 0.07, -0.02).applyAxisAngle(up, yaw()));
}

// ---------------------------------------------------------------- the prototype's last flight
// Where Hal watches from: the mouth of the gap between Hangars Two and Three, onto the apron.
const GAP = V(31, 0, 6);
// The flight, by time (s) from its take-off roll: west along the runway past the hangars, lifting
// off opposite the gap where Hal stands, a climb out to the west; at FLAME_T the left engine lets
// go; a wide turn north and back east, holding what height it can; at SPIN_T it stalls into a flat
// spin over the desert north of the runway and comes down turning, drifting toward the field (a
// spinning jet is slow over the ground: Hal can get under it).
const FLIGHT = [
  [0, V(350, 0, RUNWAY_Z)], [5, V(37, 0, RUNWAY_Z)], [9, V(-235, 48, RUNWAY_Z - 4)], [12, V(-470, 120, RUNWAY_Z - 14)],
  [16, V(-600, 150, RUNWAY_Z - 105)], [20, V(-505, 168, RUNWAY_Z - 205)], [24, V(-310, 174, RUNWAY_Z - 215)], [28, V(-120, 176, RUNWAY_Z - 180)],
];
const FLAME_T = 12, SPIN_T = 28;
const SPIN = { rate: 1.7, sink: 6.5, drift: V(3.5, 0, 2.5), glide: 48 };
const flightPath = new THREE.CatmullRomCurve3(FLIGHT.map(([, p]) => p), false, 'centripetal');
const _jd = new THREE.Vector3(), _jd2 = new THREE.Vector3(), _je = new THREE.Euler();
function flightU(t) {
  let i = 0;
  while (i < FLIGHT.length - 2 && t > FLIGHT[i + 1][0]) i++;
  return (i + THREE.MathUtils.clamp((t - FLIGHT[i][0]) / (FLIGHT[i + 1][0] - FLIGHT[i][0]), 0, 1)) / (FLIGHT.length - 1);
}
// The jet's pivot at time t (its middle; the caller adds the height of its wheels on the runway):
// position into `pos`, orientation (nose along local +Z) into `quat`.
function jetAt(t, pos, quat) {
  if (t < SPIN_T) {
    const u = flightU(t);
    flightPath.getPoint(u, pos);
    flightPath.getTangent(u, _jd);
    if (t < 5) { pos.y = 0; _jd.y = 0; _jd.normalize(); } // on its wheels
    // banked into the turn by how fast the heading is turning; wallowing once the engine's gone
    flightPath.getTangent(flightU(t + 0.25), _jd2);
    const turn = Math.atan2(_jd.x * _jd2.z - _jd.z * _jd2.x, _jd.x * _jd2.x + _jd.z * _jd2.z) / 0.25;
    const yaw = Math.atan2(_jd.x, _jd.z), pitch = Math.asin(THREE.MathUtils.clamp(_jd.y, -1, 1));
    const bank = THREE.MathUtils.clamp(turn * 1.6, -1.1, 1.1) + (t > FLAME_T ? Math.sin(t * 2.3) * 0.14 * Math.min(1, (t - FLAME_T) / 2) : 0);
    quat.setFromEuler(_je.set(-pitch, yaw, bank, 'YXZ'));
    return;
  }
  const s = t - SPIN_T, P0 = FLIGHT.at(-1)[1];
  flightPath.getTangent(1, _jd);
  const yaw0 = Math.atan2(_jd.x, _jd.z);
  _jd.setY(0).normalize();
  // its way bleeding off along the old heading, the drift, and the sink building up
  pos.copy(P0).addScaledVector(_jd, SPIN.glide * 1.6 * (1 - Math.exp(-s / 1.6))).addScaledVector(SPIN.drift, s);
  pos.y = P0.y - SPIN.sink * (s - 2 * (1 - Math.exp(-s / 2)));
  const yaw = yaw0 + SPIN.rate * (s - 2.2 * (1 - Math.exp(-s / 2.2)));
  const nose = 0.3 * (1 - Math.exp(-s / 1.2));
  quat.setFromEuler(_je.set(nose, yaw, 0.16 * Math.sin(s * 1.7) * Math.min(1, s / 2), 'YXZ'));
}
// The hand that catches it (in its own units: handGeometry): its scale, the palm's top above its
// origin, its wrist, and how far out to the jet's left Hal holds it from.
const HAND = { scale: 6.4, palm: 0.14, wrist: V(0, 0.05, -0.62), side: 12 };
// Where it may be set down: the runway, the taxiway, and the apron's open west end.
const SET_DOWN = V(-40, 1, RUNWAY_Z);
const canSetDown = (x, z) => (Math.abs(z - RUNWAY_Z) < 21 && Math.abs(x) < 800) || (x > -100 && x < -12 && z > -128 && z < -2);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();

// Hal's phone (a downloaded model, CREDITS.md) with the morning's lock screen drawn on it. The group
// lies flat, screen up; its child is the phone itself (long axis +Y, screen +Z), so in the group's
// frame the screen faces +Y and the phone's top points -Z.
function buildPhone({ call = null } = {}) {
  const g = new THREE.Group(), ph = prop('phone', { ownMaterials: true });
  ph.rotation.x = -Math.PI / 2;
  g.add(ph);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 552;
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 552);
  sky.addColorStop(0, '#1d2a3c'); sky.addColorStop(1, '#0a0e15');
  x.fillStyle = sky; x.fillRect(0, 0, 256, 552);
  x.fillStyle = '#e9eef3'; x.textAlign = 'center';
  if (call) {
    // a call on speaker: the caller, the timer, the buttons
    x.font = '400 14px Arial, sans-serif'; x.fillStyle = '#9fb0c0'; x.fillText('mobile', 128, 104);
    x.font = '300 30px Arial, sans-serif'; x.fillStyle = '#e9eef3'; x.fillText(call, 128, 140);
    x.font = '400 15px Arial, sans-serif'; x.fillStyle = '#c9d4de'; x.fillText('00:14', 128, 166);
    [['mute', 0], ['keypad', 1], ['speaker', 2]].forEach(([name, i]) => {
      const cx = 58 + i * 70, on = name === 'speaker';
      x.fillStyle = on ? '#e9eef3' : 'rgba(210,225,240,0.18)'; x.beginPath(); x.arc(cx, 300, 26, 0, 7); x.fill();
      x.fillStyle = '#c9d4de'; x.font = '400 11px Arial, sans-serif'; x.fillText(name, cx, 344);
    });
    x.fillStyle = '#e5483c'; x.beginPath(); x.arc(128, 448, 30, 0, 7); x.fill();
  } else {
    x.font = '500 15px Arial, sans-serif'; x.fillText('Thursday, November 10', 128, 92);
    x.font = '200 76px Arial, sans-serif'; x.fillText('9:41', 128, 168);
    const card = (y, head, line, col) => {
      x.fillStyle = 'rgba(210,225,240,0.16)'; x.beginPath(); x.roundRect(14, y, 228, 62, 14); x.fill();
      x.textAlign = 'left'; x.fillStyle = col; x.font = '700 13px Arial, sans-serif'; x.fillText(head, 28, y + 25);
      x.fillStyle = '#c9d4de'; x.font = '400 12px Arial, sans-serif'; x.fillText(line, 28, y + 46);
    };
    card(214, 'PHONE', '4 missed calls  ·  Tom, Carol, Sal', '#ff6a5c');
    card(284, 'VOICEMAIL', '4 new voicemails', '#e9eef3');
    card(354, 'ALARM', '7:00 AM  ·  dismissed', '#e9eef3');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // the cover glass barely there (it mirrored the room over the screen), the frame satin
  for (const m of meshes(ph, (n) => /Screen_Glass/.test(n))) Object.assign(m.material, { opacity: 0.12, envMapIntensity: 0.15, roughness: 0.05 });
  for (const m of meshes(ph, (n) => /Frame|Button|Antenna|Circle/.test(n))) m.material.roughness = Math.max(m.material.roughness, 0.42);
  const screen = meshes(ph, (n) => /Wallpaper/.test(n))[0];
  screen.material = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.25, 0.25, 0.25), side: THREE.DoubleSide }); // (its face points into the phone)
  g.userData.screen = screen;
  return g;
}

// Envelopes on the hall table, the top one stamped in red.
function buildMail(at) {
  const g = new THREE.Group();
  g.position.copy(at);
  const paper = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.11), i === 2 ? new THREE.MeshStandardMaterial({ color: 0xe8c9c4, roughness: 0.9 }) : paper);
    e.position.set((Math.random() - 0.5) * 0.04, i * 0.0045, (Math.random() - 0.5) * 0.03);
    e.rotation.y = (Math.random() - 0.5) * 0.5;
    g.add(e);
  }
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.025).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb02018 }));
  stamp.position.set(0.02, 0.0275, 0);
  g.add(stamp);
  return g;
}

// The landlord's notice, slipped under the door: a printed sheet, the amount circled.
function buildNotice() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 330;
  const x = c.getContext('2d');
  x.fillStyle = '#f3efe3'; x.fillRect(0, 0, 256, 330);
  x.fillStyle = '#222'; x.font = '700 20px Arial, sans-serif'; x.textAlign = 'center';
  x.fillText('NOTICE TO PAY RENT', 128, 40); x.fillText('OR QUIT', 128, 64);
  x.font = '400 11px Arial, sans-serif';
  for (let i = 0; i < 12; i++) x.fillRect(24, 90 + i * 14, 208 - (i % 3) * 30, 2);
  x.strokeStyle = '#b02018'; x.lineWidth = 3; x.beginPath(); x.ellipse(128, 280, 70, 22, 0, 0, 7); x.stroke();
  x.fillStyle = '#b02018'; x.font = '700 22px Arial, sans-serif'; x.fillText('$2,400.00', 128, 288);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.216, 0.279).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.receiveShadow = true;
  return m;
}
