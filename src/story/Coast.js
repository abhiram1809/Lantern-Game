import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { CoastSave } from '../engine/Save.js';
import { Story } from './Story.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { BodyLanguage } from '../characters/BodyLanguage.js';
import { POSES, still, makePose, blendInto } from '../characters/Poses.js';
import { createCarol, createRing } from '../characters/Characters.js';
import { Bedroom } from '../scenes/Bedroom.js';
import { Ferris, CAROL_SPOT, CAR_SPOT, GATE, LOT, FERRIS_PROPS } from '../scenes/Ferris.js';
import { loadProps, prop, meshes } from '../props/Props.js';

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
// At the wheel: low in the bucket seat and leaned back (the roof is low), knees up either side of
// the column, feet on the pedals. The hands are put on the rim by the arm IK (driveHands).
function drivingPose(rig, car) {
  const { seat, pedals } = car.userData, [a, b] = legLengths(rig), hipY = seat.y - 0.04;
  const p = makePose({ hy: hipY - rig.hipsHeight, sx: -0.34, cx: -0.1, nx: 0.2, kx: 0.18, lLz: 0.12, lRz: -0.05,
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
// blending one held pose into another over a tween

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
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps([...FERRIS_PROPS, 'phone']);
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
    // in the staff lot by his car, or on the apron with Carol
    // (the car is turned round, so its driver's side, +x in its own frame, is -x here)
    const at = { ferris: CAR_SPOT.clone().add(V(-2.45, 0, 0.45)), carol: CAROL_SPOT.clone().add(V(-0.4, 0, 3.4)), after: CAR_SPOT.clone().add(V(-2.45, 0, 0.45)) }[id];
    this.ferrisScene.car.rotation.y = Math.PI; // parked nose to the hangars, as he left it
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
    await tween(1.2, (k) => (sleep.roll = -k * 0.8), ease.inOut);
    // he throws the blanket back and sits up on the edge of the bed, facing the window
    this.rollUpdater();
    room.bodyCapsules = null;
    const o = player.object;
    const q0 = o.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    const p0 = o.position.clone(), p1 = V(-0.5, 0, -1.15);
    player.animator.play(still(SEATED, 1.6), 1.4);
    this.handsOnKnees(true);
    director.move(V(0.6, 1.3, -0.35), V(-0.45, 1.05, -1.15), 1.8, ease.out, 46);
    await tween(1.4, (k) => { o.quaternion.slerpQuaternions(q0, q1, k); o.position.lerpVectors(p0, p1, k); });
    // the clock
    const clock = V(0.02, 0.62, -1.7);
    player.lookAt(clock, 0.9);
    await wait(0.6);
    await this.say('halLate1');
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
    // Hal at the wheel (out of the physics: the car carries him)
    player.removeFromPhysics();
    this.playerActive = false;
    player.autoAnim = false;
    player.lookAt(null);
    car.add(player.object);
    const seat = car.userData.seat;
    player.object.position.set(seat.x, 0, seat.z);
    player.object.rotation.set(0, 0, 0);
    player.pivot.quaternion.identity();
    car.userData.openDoor(0);
    player.animator.play(still(drivingPose(this.hal, car), 0.6), 0);
    this.driveHands(car, true);
    const animOff = onFrame((dt) => player.animator.update(dt));
    const placeCar = (p, yaw) => { car.position.copy(p); car.rotation.y = yaw; };
    placeCar(f.lotCarSpot, 0);
    f.focus(f.lotCarSpot);
    const local = (x, y, z) => V(x, y, z).applyAxisAngle(V(0, 1, 0), car.rotation.y).add(car.position);
    // turning it over: twice nothing, then it catches (through the windscreen, from the driver's side)
    director.cut(local(2.3, 1.35, 2.7), local(0.3, 0.98, -0.3), 36);
    await ui.fade(0, 1.4);
    await wait(0.8);
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
    // out of the bay backwards, round, and away up the road
    const wheels = car.userData.wheels, spin = (d) => wheels.forEach((w) => (w.rotation.x += d / 0.33));
    director.move(LOT.clone().add(V(-10, 2.8, -11)), LOT.clone().add(V(-1.6, 0.8, -1)), 4, ease.inOut, 46);
    const back0 = car.position.clone();
    motor.set(0.2);
    let last = 0;
    await tween(2.4, (k) => { const e = ease.inOut(k), d = 7 * e; placeCar(back0.clone().add(V(0, 0, -d)), e * -0.6); spin(-(d - last)); last = d; if (Math.random() < 0.3) puff(1, 0.6); }, ease.linear);
    const path = new THREE.CatmullRomCurve3([car.position.clone(), LOT.clone().add(V(3, 0, -6)), LOT.clone().add(V(6, 0, -12)), LOT.clone().add(V(6, 0, -60))]);
    motor.set(0.5);
    last = 0;
    await tween(4.5, (k) => {
      const e = k * k, u = Math.min(0.999, e), p = path.getPointAt(u), t = path.getTangentAt(u);
      placeCar(p, Math.atan2(t.x, t.z));
      const d = e * path.getLength();
      spin(d - last);
      last = d;
      if (Math.random() < 0.4) puff(1, 0.5);
    }, ease.linear);
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
    // the gate, and into the lot
    await ui.fade(1, 0.5);
    placeCar(roadAt(260), Math.PI);
    f.focus(GATE);
    director.cut(GATE.clone().add(V(-10, 1.7, -14)), roadAt(200).add(V(0, 1, 0)), 40);
    await ui.fade(0, 0.5);
    motor.set(0.4);
    const inPath = new THREE.CatmullRomCurve3([roadAt(260), roadAt(150), roadAt(96), V(14, 0, 80), V(CAR_SPOT.x, 0, CAR_SPOT.z + 10), CAR_SPOT.clone()]);
    last = 0;
    await tween(10, (k) => {
      const e = ease.out(k), u = Math.min(0.999, e), p = inPath.getPointAt(u), t = inPath.getTangentAt(u);
      placeCar(p, Math.atan2(t.x, t.z));
      const d = e * inPath.getLength();
      spin(d - last);
      last = d;
      motor.set(0.4 * (1 - e));
      look.copy(car.position).y += 0.8;
      director.look.lerp(look, 0.12);
      if (k > 0.5) f.focus(car.position);
    }, ease.linear);
    placeCar(CAR_SPOT, Math.PI);
    motor.stop(0.4);
    this.motor = null;
    await wait(0.6);
    await this.getOut(car, animOff);
  }

  // His hands on the rim (or off it): the arm IK holds them there while the car moves.
  driveHands(car, on) {
    const anim = this.player.animator, ud = car.userData;
    if (!on) { anim.reach('L', null); anim.reach('R', null); return; }
    anim.reach('L', () => car.localToWorld(ud.rim('L', 10)), { pole: V(0.9, -1, -0.2), rate: 8 });
    anim.reach('R', () => car.localToWorld(ud.rim('R', 2)), { pole: V(-0.9, -1, -0.2), rate: 8 });
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
    animOff();
    await this.ui.screen({
      emblem: true,
      kicker: 'Part Three · Coast City',
      title: 'GROUNDED',
      subtitle: 'To be continued',
      body: 'No job, rent due on Friday, and a whole sector of space to guard.\n\nSomewhere out past the ring’s range, something is already on its way to Sector 2814.',
      buttons: ['Quit to title'],
    });
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  }
}
const _h = new THREE.Vector3(), _h2 = new THREE.Vector3();

// Hal's phone (a downloaded model, CREDITS.md) with the morning's lock screen drawn on it. The group
// lies flat, screen up; its child is the phone itself (long axis +Y, screen +Z), so in the group's
// frame the screen faces +Y and the phone's top points -Z.
function buildPhone() {
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
