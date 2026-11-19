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
    const it = f.interact({ position: CLOCK_STAND, radius: 2.2, look: CLOCK.clone().setY(1.5), label: 'Clock in', action: () => (this.work ? this.clockOut() : this.clockIn()) });
    Object.defineProperty(it, 'label', { get: () => {
      if (this.work) return `Clock out · ${money(this.earned())} so far`;
      if (!this.civilian) return 'The time clock (Hal’s, not Green Lantern’s)';
      return open() ? `Clock in · $${PAY_HOUR} an hour` : 'The time clock · shifts are 9 to 5';
    } });
    // the prototype: on the clock, up for a card; off it in the hours, clocked in and up in one go; else
    // why not (its spot was under the wing, inside the airframe's colliders, and only showed once he was
    // clocked in: the user couldn't work at all). On the apron south of it, clear of the wing.
    const jet = f.interact({ position: JET_SPOT.clone().add(V(-2, 0, 9.6)), radius: 3.4, look: JET_SPOT.clone().setY(1.6), label: 'Fly a test card', action: () => this.atPrototype() });
    Object.defineProperty(jet, 'enabled', { get: () => !this.player.flying && !this.driving && !this.flyingCard });
    Object.defineProperty(jet, 'label', { get: () => {
      if (!this.civilian) return 'The prototype · Hal flies it, 9 to 5';
      if (this.work) return 'Fly a test card';
      return open() ? `Clock in and fly a test card · $${PAY_HOUR} an hour` : 'The prototype · test flights 9 to 5';
    } });
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

  // E at the prototype: clocked in first if he isn't, then up
  async atPrototype() {
    const h = this.dayCycle?.hour ?? 0;
    if (!this.civilian) { await this.bark('halClockGL'); return; }
    if (!this.work) {
      if (h < SHIFT_FROM || h >= SHIFT_TO) { await this.bark(h < SHIFT_FROM ? 'halClockEarly' : 'halClockLate'); return; }
      await this.clockIn({ quiet: true });
    }
    await this.testCard();
  },

  async clockIn({ quiet = false } = {}) {
    const { ui, audio } = this, dc = this.dayCycle;
    const h = dc?.hour ?? 0;
    if (!this.civilian) { this.bark('halClockGL'); return; }
    if (h < SHIFT_FROM || h >= SHIFT_TO) { await this.bark(h < SHIFT_FROM ? 'halClockEarly' : 'halClockLate'); return; }
    this.work = { day: dc.day, hour: h };
    audio.clunk?.() ?? audio.door?.();
    ui.toast(`Clocked in · ${dc.clock} · $${PAY_HOUR} an hour`);
    if (quiet) return;
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
    // the card: off the ground, then eight thousand feet, or seven g, or both, then home. Each step ticked
    // is a checkpoint (the user, 2026-11-19: "checkpoint every part of the flight... bring Hal back to that
    // position"; a crash had ended the card with Carol shouting): crash and the jet's put back where the
    // last step was ticked, flying as it was, and the step's flown again. The landing's from a lined-up
    // final approach (his own, once he's flown onto one).
    const r = Math.random(), alt = r < 0.7, g7 = r > 0.4;
    const snap = () => ({ pos: jet.pos.clone(), vel: jet.vel.clone(), quat: jet.quat.clone(), w: jet.w.clone(), throttle: jet.throttle, gear: jet.gearDown, onGround: jet.onGround, aim: { ...jet.aim } });
    // the final approach the landing restarts from without one of his own: 4 km out on runway 27's line,
    // 690 ft up on a three-degree path, 165 kt, gear down, nose a little up
    const approach = () => {
      const x = 4800, z = RUNWAY_Z, h = 210, p = 0.07, yaw = -Math.PI / 2;
      return { pos: V(x, f.terrainAt(x, z) + jet.hc + h, z), vel: V(-85, -4.4, 0), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-p, yaw, 0, 'YXZ')), w: V(0, 0, 0), throttle: 0.42, gear: true, onGround: false, aim: { yaw, pitch: -0.052 } };
    };
    let held = 0, gearNag = 0, finalCp = null;
    const steps = [{ text: 'Take off, gear up', until: () => !jet.onGround && jet.alt > 40 && !jet.gearDown }];
    if (alt) steps.push({ text: 'Climb to 8,000 ft', start: () => this.radio('towerJobAlt'), until: () => jet.alt * FT > 7900, done: () => this.radio('towerJobAltOk') });
    if (g7) steps.push({ text: 'Pull 7 g (2 s)', start: () => { held = 0; this.radio('towerJobG'); }, until: () => { held = jet.g > 6.8 ? held + 1 / 60 : Math.max(0, held - 2 / 60); return held > 2; }, done: () => this.radio('towerJobGOk') });
    steps.push({ text: 'Land on runway 27 and stop', landing: true,
      start: () => { this.radio('towerJobHome'); this.mark(V(300, 2, RUNWAY_Z), 'Runway 27'); },
      until: () => {
        if (!jet.gearDown && jet.alt < 150 && jet.vel.y < -2 && (gearNag -= 1 / 60) < 0) { gearNag = 8; this.radio('towerGear'); }
        // on final: lined up east of the runway, low, gear down, heading west (the checkpoint from here on)
        if (!finalCp && jet.gearDown && !jet.onGround && jet.pos.x > 1100 && jet.pos.x < 7000 && Math.abs(jet.pos.z - RUNWAY_Z) < 200 && jet.alt * FT < 2500 && jet.alt * FT > 250 && jet.vel.x < -40) {
          finalCp = snap();
          ui.toast('Checkpoint · on final for runway 27');
        }
        return jet.onGround && jet.speed < 4 && !jet.offField(jet.pos.x, jet.pos.z);
      } });
    const card = steps.map((st) => ({ text: st.text, done: false }));
    const tick = (i) => { card[i].done = true; this.vhud.setCard(card); audio.ringChime?.(); };
    // back to a checkpoint: a cut through black, the jet as it was there
    const reset = async (st, label) => {
      jet.enabled = false;
      await ui.fade(1, 0.4);
      jet.pos.copy(st.pos); jet.vel.copy(st.vel); jet.quat.copy(st.quat); jet.w.copy(st.w);
      jet.throttle = st.throttle;
      jet.brake = 0;
      if (jet.gearDown !== st.gear) { jet.gearDown = st.gear; jet.onGear?.(st.gear); }
      jet.onGround = st.onGround;
      jet.aim.yaw = st.aim.yaw; jet.aim.pitch = st.aim.pitch;
      jet.crashed = false;
      jet.snap = true;
      jet.place?.();
      crashed = false;
      ui.toast(`Checkpoint · ${label}`);
      await wait(0.35);
      await ui.fade(0, 0.6);
      jet.enabled = true;
    };
    let ok = false, quit = false;
    try {
      director.mode = 'follow';
      await ui.fade(0, 1.0);
      ui.cinematic(false);
      input.setLook(true);
      ui.controls(false);
      this.busy = false;
      jet.enabled = true;
      this.hud.tutorial({ kicker: 'Ferris Two-Seven', title: 'A test card', n: 1, of: 1, html: '<b>Mouse</b> point where to fly &nbsp; <b>W</b> <b>S</b> throttle &nbsp; <b>A</b> <b>D</b> roll &nbsp; <b>Q</b> <b>E</b> rudder &nbsp; <b>G</b> gear &nbsp; <b>B</b> brakes &nbsp; <b>C</b> cockpit view &nbsp; a crash goes back to the last checkpoint' });
      this.vhud.setCard(card);
      ui.objective('Fly the test card');
      this.radio('towerJob1').then(() => this.radio('halTower1'));
      let warned = 0, cp = snap(), cpName = 'on the runway';
      for (let i = 0; i < steps.length && !quit; i++) {
        const st = steps[i];
        st.start?.();
        for (let tries = 0; ; tries++) {
          await waitFor(() => {
            if (Math.hypot(jet.pos.x, jet.pos.z + 150) > 42000 && (warned -= 1 / 60) < 0) { warned = 12; this.radio('towerRange'); }
            return crashed || st.until();
          });
          if (!crashed) break;
          // a crash: again from the checkpoint (or, after a few, the choice to call it a day)
          if (tries >= 2) {
            const pick = ui.pick('The prototype', ['Again, from the checkpoint', 'Call it a day']);
            if ((await pick) === 1) { quit = true; break; }
          }
          if (st.landing) await reset(finalCp ?? approach(), finalCp ? 'on final for runway 27' : 'the approach to runway 27');
          else { await reset(cp, cpName); st.start?.(); }
        }
        if (quit) break;
        tick(i);
        st.done?.();
        cp = snap();
        cpName = st.text.toLowerCase();
      }
      if (!quit) {
        ok = true;
        jet.enabled = false;
        jet.throttle = 0;
        this.hushRadio();
        await this.radio('towerJobDone');
        await wait(0.8);
      }
    } finally {
      flying();
      engineSnd.stop(1.2);
      this.hushRadio();
      this.takeControl();
      this.busy = true;
      await ui.fade(1, 1.2);
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
      // out of the kit, back in his own clothes, on the apron south of the airframe (where its prompt is:
      // clear ground; put down under its wing, inside its colliders, he was stuck there, suit or not)
      this.ring.removeFromParent();
      player.setRig(this.casualRig);
      this.hal = this.casualRig;
      this.attachRing(this.ring, this.casualRig);
      this.powers.ring = this.ring;
      const at = JET_SPOT.clone().add(V(-2, 0, 9.6));
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
      if (quit) ui.toast('Card left for tomorrow · still on the clock');
      else if (ok) { this.life?.gain(25, 'a test card flown'); ui.toast(`Card flown · on the clock since ${clockOf(this.work?.hour)}`); }
    }
  },
};

const clockOf = (h) => { if (h == null) return ''; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
