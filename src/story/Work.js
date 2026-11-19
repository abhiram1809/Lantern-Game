import * as THREE from 'three';
import { wait, waitFor, tween, onFrame, clamp } from '../engine/Time.js';
import { JET_SPOT, RUNWAY_Z } from '../scenes/Ferris.js';
import { Jet, FT } from '../vehicles/Jet.js';
import { money } from './Life.js';

// Hal's work at Ferris in free roam (the user, 2026-11-19: "during daytime, allow him to take test
// flights, for which he gets paid whatever test pilots are paid... he can clock in anywhere between 9
// to 5, so he has a flexible shift"). The time clock by the shop office in Hangar Two: in as Hal
// between nine and five, out when he likes (or at five, or when he leaves the field), paid for the
// hours on it at a test pilot's rate: $62 an hour (Salary.com's US average for an experimental test
// pilot, 2026; the user guessed $250). On the clock, the prototype on the apron takes him up for a
// short card (Part Five's, cut down: off the ground, eight thousand feet or seven g or both, down on
// runway 27 and stopped).
export const PAY_HOUR = 62, SHIFT_FROM = 9, SHIFT_TO = 17;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// the clock on the shop office's front wall, beside its door (Ferris.js: Hangar Two, the office 22 m
// long at x -5..17, its face at z 33.25)
const CLOCK = V(12.4, 0, 33.25), CLOCK_STAND = V(12.4, 0, 32.3);
const ROLL = V(720, 0, RUNWAY_Z); // (the runway's east end: rolling west, as in Part Five)
const _e = V(0, 0, 0), _u = V(0, 0, 0), _f = V(0, 0, 0);

// a punch clock and its rack of cards, on the wall
function buildClock() {
  const g = new THREE.Group();
  const grey = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.55, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.3 });
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#f1ede2'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill();
  c.strokeStyle = '#222'; c.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); c.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); c.stroke(); }
  c.lineWidth = 4; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 22, 64 - 18); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 - 8, 64 - 44); c.stroke();
  const face = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.4 });
  face.map.colorSpace = THREE.SRGBColorSpace;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.2), grey);
  box.position.set(0, 1.45, 0.1);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), face);
  dial.position.set(0, 1.55, 0.201);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), dark);
  slot.position.set(0, 1.33, 0.205);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.05), dark);
  rack.position.set(-0.46, 1.42, 0.03);
  g.add(box, dial, slot, rack);
  const card = new THREE.MeshStandardMaterial({ color: 0xe8dfc4, roughness: 0.9 });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.17, 0.004), card);
    m.position.set(-0.6 + k * 0.14, 1.66 - r * 0.15, 0.06);
    g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

export const WORK = {
  // the clock on the wall, and the prototype's "Fly a test card" while he's on it
  addWorkSpots(f) {
    if (this.workIts) return;
    const clock = buildClock();
    clock.position.copy(CLOCK);
    clock.rotation.y = Math.PI; // (facing the hangar's doors)
    f.scene.add(clock);
    const dc = () => this.dayCycle;
    const open = () => { const h = dc()?.hour ?? 0; return h >= SHIFT_FROM && h < SHIFT_TO; };
    const it = f.interact({ position: CLOCK_STAND, radius: 1.6, look: CLOCK.clone().setY(1.5), label: 'Clock in', action: () => (this.work ? this.clockOut() : this.clockIn()) });
    Object.defineProperty(it, 'label', { get: () => {
      if (this.work) return `Clock out · ${money(this.earned())} so far`;
      if (!this.civilian) return 'The time clock (Hal’s, not Green Lantern’s)';
      return open() ? `Clock in · $${PAY_HOUR} an hour` : 'The time clock · shifts are 9 to 5';
    } });
    const jet = f.interact({ position: JET_SPOT.clone().add(V(-2.6, 0, 3.6)), radius: 3, look: JET_SPOT.clone().setY(1.6), label: 'Fly a test card', action: () => this.testCard() });
    Object.defineProperty(jet, 'enabled', { get: () => !!this.work && this.civilian && !this.player.flying && !this.driving });
    this.workIts = [it, jet];
    // the shift's end: five o'clock, or walking (or driving) off the field
    f.updaters.push(() => {
      if (!this.work || this.flyingCard || this.busy) return;
      const h = dc()?.hour ?? 0, p = this.driving ? f.car.position : this.player.position;
      if (h >= SHIFT_TO || h < SHIFT_FROM - 1) this.clockOut({ auto: 'Five o’clock' });
      else if (this.current !== f || Math.hypot(p.x, p.z + 60) > 1600) this.clockOut({ auto: 'Off the field' });
    });
  },

  // hours on the clock so far, and what they come to
  hoursWorked() {
    const d = this.dayCycle, w = this.work;
    if (!d || !w) return 0;
    return Math.max(0, (d.day - w.day) * 24 + d.hour - w.hour);
  },
  earned() { return Math.round(this.hoursWorked() * PAY_HOUR * 100) / 100; },

  async clockIn() {
    const { ui, audio } = this, dc = this.dayCycle;
    const h = dc?.hour ?? 0;
    if (!this.civilian) { this.bark('halClockGL'); return; }
    if (h < SHIFT_FROM || h >= SHIFT_TO) { await this.bark(h < SHIFT_FROM ? 'halClockEarly' : 'halClockLate'); return; }
    this.work = { day: dc.day, hour: h };
    audio.clunk?.() ?? audio.door?.();
    ui.toast(`Clocked in · ${dc.clock} · $${PAY_HOUR} an hour`);
    this.powers.markerTarget = { pos: JET_SPOT.clone().setY(3), label: 'The prototype · a test card' };
    await this.bark('halClockIn');
  },

  async clockOut({ auto = null } = {}) {
    const { ui, life } = this;
    const hours = this.hoursWorked(), pay = this.earned();
    this.work = null;
    if (this.powers.markerTarget?.label?.startsWith('The prototype')) this.powers.markerTarget = null;
    if (life) { life.d.worked = this.dayCycle?.day; life.pay(pay, `${hours.toFixed(1)} hours at Ferris`); if (hours >= 1) life.gain(Math.min(20, Math.round(hours * 2.5)), 'a day at Ferris'); }
    ui.toast(`${auto ? `${auto} · ` : ''}Clocked out · ${hours.toFixed(1)} hours · ${money(pay)}`);
    if (!auto) await this.bark('halClockOut');
  },

  // Up in the prototype for a short card: the walk out skipped (a fade from the apron to the seat at
  // the runway's end), Part Five's flight model and cockpit, Carol on the radio.
  async testCard() {
    const { ui, director, audio, player, input, engine, powers } = this;
    const f = this.ferrisScene;
    if (!this.work || !this.civilian) return;
    this.busy = true;
    this.takeControl();
    powers.holster?.();
    this.flyingCard = true;
    const marker = powers.markerTarget;
    powers.markerTarget = null;
    this.casualRig ??= this.hal;
    await ui.fade(1, 0.8);
    this.wearFlightSuit();
    const rig = f.freeJet();
    f.gear(true);
    for (const m of rig.userData.canopy) Object.assign(m.material, { color: new THREE.Color(0.62, 0.68, 0.66), metalness: 0.2, roughness: 0.05, opacity: 0.32, envMapIntensity: 1.2 });
    rig.position.set(ROLL.x, rig.userData.hc, ROLL.z);
    rig.quaternion.setFromAxisAngle(UP, -Math.PI / 2);
    rig.updateMatrixWorld(true);
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
      const sup = jet.mach > 1.0;
      if (sup && !wasSuper) { audio.sonicBoom(1.2); director.shake(0.25, 0.6); boomT = 0.7; }
      wasSuper = sup;
      boomT = Math.max(0, boomT - dt);
      cone.material.opacity = boomT * 0.9;
      cone.scale.setScalar(1 + (0.7 - boomT));
      this.vhud.gloc(clamp((jet.g - 6.2) / 3.2, 0, 1) * 0.95);
    });
    // the card: off the ground, then eight thousand feet, or seven g, or both, then home
    const r = Math.random(), alt = r < 0.7, g7 = r > 0.4;
    const card = [{ text: 'Take off, gear up', done: false }];
    if (alt) card.push({ text: 'Climb to 8,000 ft', done: false });
    if (g7) card.push({ text: 'Pull 7 g (2 s)', done: false });
    card.push({ text: 'Land on runway 27 and stop', done: false });
    const tick = (i) => { card[i].done = true; this.vhud.setCard(card); audio.ringChime?.(); };
    let ok = false;
    try {
      director.mode = 'follow';
      await ui.fade(0, 1.0);
      ui.cinematic(false);
      input.setLook(true);
      ui.controls(false);
      this.busy = false;
      jet.enabled = true;
      this.hud.tutorial({ kicker: 'Ferris Two-Seven', title: 'A test card', n: 1, of: 1, html: '<b>Mouse</b> point where to fly &nbsp; <b>W</b> <b>S</b> throttle &nbsp; <b>A</b> <b>D</b> roll &nbsp; <b>Q</b> <b>E</b> rudder &nbsp; <b>G</b> gear &nbsp; <b>B</b> brakes &nbsp; <b>C</b> cockpit view' });
      this.vhud.setCard(card);
      ui.objective('Fly the test card');
      this.radio('towerJob1').then(() => this.radio('halTower1'));
      let warned = 0, i = 0;
      const watch = () => {
        if (Math.hypot(jet.pos.x, jet.pos.z + 150) > 42000 && (warned -= 1 / 60) < 0) { warned = 12; this.radio('towerRange'); }
        return crashed;
      };
      await waitFor(() => watch() || (!jet.onGround && jet.alt > 40 && !jet.gearDown));
      if (crashed) return;
      tick(i++);
      if (alt) {
        this.radio('towerJobAlt');
        await waitFor(() => watch() || jet.alt * FT > 7900);
        if (crashed) return;
        tick(i++);
        this.radio('towerJobAltOk');
      }
      if (g7) {
        this.radio('towerJobG');
        let held = 0;
        await waitFor(() => { held = jet.g > 6.8 ? held + 1 / 60 : Math.max(0, held - 2 / 60); return watch() || held > 2; });
        if (crashed) return;
        tick(i++);
        this.radio('towerJobGOk');
      }
      this.radio('towerJobHome');
      this.mark(V(300, 2, RUNWAY_Z), 'Runway 27');
      let gearNag = 0;
      await waitFor(() => {
        if (!jet.gearDown && jet.alt < 150 && jet.vel.y < -2 && (gearNag -= 1 / 60) < 0) { gearNag = 8; this.radio('towerGear'); }
        return watch() || (jet.onGround && jet.speed < 4 && !jet.offField(jet.pos.x, jet.pos.z));
      });
      if (crashed) return;
      tick(i);
      ok = true;
      jet.enabled = false;
      jet.throttle = 0;
      this.hushRadio();
      await this.radio('towerJobDone');
      await wait(0.8);
    } finally {
      flying();
      engineSnd.stop(crashed ? 0.2 : 1.2);
      if (crashed) {
        audio.explosion(1.2);
        director.shake(0.6, 1.4);
        this.say('jetCrash', { skip: false });
        await wait(2.0);
      }
      this.takeControl();
      this.busy = true;
      await ui.fade(1, crashed ? 1.0 : 1.2);
      this.mark(null);
      this.hud.tutorial(null);
      ui.objective(null);
      this.vhud.hide();
      this.vhud.setCard(null);
      this.vhud.gloc(0);
      f.flightAir(false);
      this.airOn = false;
      director.up = null;
      f.nearMax = 2;
      seat.release();
      this.jet = null;
      cone.removeFromParent();
      f.parkJet(JET_SPOT, Math.PI / 2);
      // out of the kit, back in his own clothes, on the apron by the airframe
      this.ring.removeFromParent();
      player.setRig(this.casualRig);
      this.hal = this.casualRig;
      this.attachRing(this.ring, this.casualRig);
      this.powers.ring = this.ring;
      const at = JET_SPOT.clone().add(V(-3.4, 0, 4.2));
      this.enterFerris(at, Math.atan2(JET_SPOT.x - at.x, JET_SPOT.z - at.z));
      this.ferrisRoam(f, 'ferris');
      this.roam.where = 'ferris';
      this.powersFor();
      engine.camera.far = f.scene.userData.far;
      engine.camera.updateProjectionMatrix();
      this.flyingCard = false;
      powers.markerTarget = marker;
      await wait(0.4);
      await ui.fade(0, 1.0);
      this.busy = false;
      this.giveControl(this.roamObjective());
      this.roamKeys?.();
      if (crashed) { ui.toast('The prototype went in · Carol is not pleased'); this.say('carolJetLost', { skip: false }); }
      else if (ok) { this.life?.gain(25, 'a test card flown'); ui.toast(`Card flown · on the clock since ${clockOf(this.work?.hour)}`); }
    }
  },
};

const clockOf = (h) => { if (h == null) return ''; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
