import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { ExileSave, RoamSave } from '../engine/Save.js';
import { Probation } from './Probation.js';
import { voyage } from './Voyage.js';
import { POSES, still } from '../characters/Poses.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { createKorugarian, createKatma, createRing, yellowLantern } from '../characters/Characters.js';
import { createBubble } from '../fx/GreenLight.js';
import { glowTexture } from '../fx/Textures.js';
import { FERRIS_PROPS } from '../scenes/Ferris.js';
import { HALL, DAIS_TOP } from '../scenes/Hall.js';
import { BALCONY, FORECOURT, PEDESTAL_TOP, CROWD_FRONT } from '../scenes/Korugar.js';
import { loadProps } from '../props/Props.js';
import { Qward, QWARD_PROPS, RIFT_AT, FORGE, AMBUSH, LANDING } from '../scenes/Qward.js';
import { BATTERY } from '../scenes/Oa.js';
import { Thunderers, loadThunderers } from '../enemies/Thunderers.js';
import { createGuardian } from '../characters/Guardian.js';
import { constructMesh, shieldGeometry, fearLight } from '../powers/Constructs.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
// Hangar Two at dawn: where Carol waits, by the second airframe, and where Hal comes in from the apron
export const CAROL_IN = V(3.2, 0, 19.5), HANGAR_MOUTH = V(0.5, 0, 4);

// Part Six, "Exile" (the user's arc, 2026-11-12: the trial, Qward, Sinestro as the Yellow Lantern,
// Katma given the ring; its first three beats built 2026-11-16). Wednesday at first light: Carol
// waiting in Hangar Two, the morning after she found out (ours). Korugar: Sinestro on his palace
// balcony over a packed forecourt, who has refused the Guardians' summons; Hal comes for him, Katma
// Tui calls him afraid in front of his city, and he goes to Oa of his own accord, sure of them
// (ours). The Hall: his trial, Hal's and Katma's testimony, his ring taken and his banishment through
// a rift into the antimatter universe, Qward (Emerald Dawn II); the ring choosing Katma Tui for
// Sector 1417 (the comics; her uniform from her scan).
export class Exile extends Probation {
  get save() { return ExileSave; }

  steps() {
    return {
      dawn: () => this.dawn(),
      palace: () => this.bringHimIn(),
      tribunal: () => this.tribunal(),
      firstnight: () => this.firstNight(),
      qward: () => this.qward(),
      yellow: () => this.yellowLight(),
      world: () => this.openWorld(),
    };
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps(FERRIS_PROPS, (k) => this.ui.loadStage('props', k));
    if (id === 'dawn') await this.setupFerrisAsync(); // (in slices, under the loading screen)
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0);
    this.learn('hammer', false);
    this.learn('staff', false);
    this.lanternUp();
  }

  // ---------------------------------------------------------------- 1. coming back
  // First light over the field. He flies in from Korugar and Oa and lands at Hangar Two, where the
  // work lights are still on; the suit goes; Carol has been there all night. What she knows now, and
  // what it costs her. The ring: the Guardians want Sinestro brought in. He suits up in front of her.
  async dawn() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    const f = this.setupFerris();
    f.dawn();
    ui.clock(this.save.info('dawn').clock);
    this.takeControl();
    ui.objective(null);
    const carol = this.addCarol(), ca = this.carolAnim, cb = this.cb;
    // (her back to the door, looking the second airframe over)
    if (carol) {
      carol.root.position.copy(CAROL_IN);
      carol.root.rotation.y = yawTo(CAROL_IN, V(-6, 0, 25));
      ca.lookAt(V(-6, 2.2, 25), 0.5);
      cb.lookHome = () => () => V(-6, 2.2, 25);
    }
    this.enterFerris(V(0, 0, -30), Math.PI);
    this.ambience(audio.wind(0.06));
    this.powerUp();
    f.focus(V(0, 0, 12));
    // in from the east, low over the desert, the sun behind him
    const from = V(230, 70, -70);
    await this.arriveFlying(from, yawTo(from, V(0, 0, 0)), V(-10, -3.5, 3));
    ui.fade(0, 0.8);
    powers.markerTarget = { pos: V(0, 4, 9), label: 'Hangar Two' };
    this.giveControl('Land at Hangar Two');
    wait(2.5).then(() => this.bark('halDawn0'));
    await waitFor(() => !player.flying && Math.hypot(player.position.x - HANGAR_MOUTH.x, player.position.z - HANGAR_MOUTH.z - 6) < 16);
    powers.markerTarget = null;
    this.takeControl();
    await this.touchDown();
    // the suit back into his clothes, on the apron where nobody's looking
    director.cut(player.position.clone().add(V(3.2, 1.5, -3.4)), player.position.clone().add(V(0, 1.1, 0)), 40);
    this.ringGlow = 3;
    await this.suitOff(1.6);
    this.ringGlow = 0.6;
    powers.detach();
    Object.assign(powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    this.giveControl('Carol’s in Hangar Two');
    await waitFor(() => player.position.distanceTo(CAROL_IN) < 4.6);
    this.takeControl();
    const stand = CAROL_IN.clone().add(V(-0.5, 0, -2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    player.turnTo(yawTo(stand, CAROL_IN));
    f.focus(CAROL_IN);
    if (carol) {
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
      cb.lookHome = () => this.headOf(player.rig);
      ca.lookAt(this.headOf(player.rig), 0.6);
    }
    // she doesn't turn round straight away
    await this.overHal(1.6);
    await this.carolSay('carolDawn1');
    if (carol) { const y0 = carol.root.rotation.y, y1 = yawTo(CAROL_IN, stand); await tween(1.1, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k))); }
    await this.halClose(1.0);
    await this.say('halDawn1');
    await this.carolClose(1.2);
    await this.carolSay('carolDawn2', [['cockpit', () => cb.pointAt(V(-6, 2.4, 25), 1.4)], ['lied', () => ca.gesture('tilt', 1.1, 0.4)]]);
    await this.halClose(0.9, -1);
    player.animator.gesture('shake', 0.8, 0.3);
    await this.say('halDawn2');
    await this.carolClose(1.0, -1, 30);
    await this.carolSay('carolDawn3', [['runway', 'open'], ['piece', () => ca.gesture('beat', 0.6, 0.5)], ['Hammond', () => ca.gesture('shake', 1, 0.3)]]);
    await this.halClose(1.0);
    player.animator.gesture('nod', 0.9, 0.35);
    await this.say('halDawn3');
    await this.overHal(1.2);
    await this.carolSay('carolDawn4');
    await this.halClose(0.8, -1);
    await this.say('halDawn4');
    await this.carolClose(1.0);
    await this.carolSay('carolDawn5', [['moustache', () => ca.gesture('tilt', 1, -0.4)]]);
    await this.halClose(1.0);
    await this.say('halDawn5');
    await this.carolClose(0.8, -1, 30);
    await this.carolSay('carolDawn6');
    await this.halClose(0.9, -1);
    player.animator.gesture('tilt', 0.8, 0.35);
    await this.say('halDawn6');
    await this.carolClose(0.9, 1, 30);
    await this.carolSay('carolDawn7', [['course', () => ca.gesture('shake', 1.2, 0.25)]]);
    // a step to him
    if (carol) {
      const loco = this.carolLoco, c0 = carol.root.position.clone(), near = c0.clone().lerp(stand, 0.45);
      await tween(1.0, (k) => { carol.root.position.lerpVectors(c0, near, ease.inOut(k)); loco.speed = Math.sin(k * Math.PI) * 1.0; }, ease.linear);
      loco.speed = 0;
    }
    await this.carolClose(1.4, -1, 28);
    await this.carolSay('carolDawn8', [['field', 'chest'], ['swore', () => ca.gesture('shake', 1.1, 0.25)]]);
    await this.halClose(0.8);
    await this.say('halDawn7');
    await this.carolClose(0.8);
    await this.carolSay('carolDawn9', [['Don', 'stop'], ['planet', () => ca.gesture('tilt', 1, 0.4)]]);
    await this.halClose(0.9, -1);
    player.animator.gesture('tilt', 0.7, 0.3);
    await this.say('halDawn8');
    await this.carolClose(1.0, 1, 28);
    await this.carolSay('carolDawn10', [['no', () => ca.gesture('chin', 1, 0.35)]]);
    // the ring: the Guardians
    const ringAt = () => this.ring.getWorldPosition(_r);
    audio.ringChime();
    this.ringGlow = 4;
    player.lookAt(ringAt, 0.7);
    if (carol) ca.lookAt(ringAt, 0.7);
    { const fw = V(Math.sin(player.yaw), 0, Math.cos(player.yaw)), sd = V(fw.z, 0, -fw.x); director.move(stand.clone().addScaledVector(fw, 1.7).addScaledVector(sd, -0.7).add(V(0, 1.25, 0)), stand.clone().addScaledVector(sd, -0.12).add(V(0, 1.12, 0)), 1.2, ease.inOut, 38); }
    await wait(0.6);
    await this.say('gCall');
    this.ringGlow = 0.6;
    if (carol) { player.lookAt(() => carol.bonePosition('head', _h), 0.8); ca.lookAt(this.headOf(player.rig), 0.7); }
    await this.carolClose(1.0, -1);
    await this.carolSay('carolDawn11');
    await this.halClose(0.9);
    await this.say('halDawn9');
    await this.carolClose(1.0);
    await this.carolSay('carolDawn12', [['Go', () => ca.gesture('nod', 1, 0.3)], ['flu', 'open']]);
    await this.halClose(0.8, -1);
    await this.say('halDawn10');
    await this.carolClose(1.0, 1, 28);
    await this.carolSay('carolDawn13', [['Jordan', () => ca.gesture('tilt', 1, 0.4)]]);
    // out onto the apron (a cut: the two of them coming out of the hangar's mouth together), and the
    // suit, where she can see it this time
    const out = HANGAR_MOUTH.clone(), cTo = V(2.2, 0, 8.6);
    await ui.fade(1, 0.5);
    player.lookAt(null);
    player.place(out.clone().add(V(0.3, 0, 3.2)), Math.PI);
    if (carol) { carol.root.position.copy(cTo).add(V(0.2, 0, 2.6)); carol.root.rotation.y = Math.PI; ca.lookAt(null); }
    director.cut(out.clone().add(V(-3.2, 1.5, -4.6)), out.clone().add(V(0.8, 1.3, 3.5)), 42);
    ui.fade(0, 0.5);
    const walks = [player.walkTo(out, player.walkSpeed)];
    if (carol) {
      const loco = this.carolLoco, c0 = carol.root.position.clone();
      walks.push(tween(c0.distanceTo(cTo) / 1.1, (k) => { carol.root.position.lerpVectors(c0, cTo, k); loco.speed = 1.1; }, ease.linear).then(() => (loco.speed = 0)));
    }
    await Promise.all(walks);
    player.turnTo(yawTo(out, cTo));
    if (carol) {
      const y0 = carol.root.rotation.y, y1 = yawTo(cTo, out);
      await tween(0.6, (k) => (carol.root.rotation.y = y0 + wrap(y1 - y0) * ease.inOut(k)));
      ca.lookAt(this.headOf(player.rig), 0.8);
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    }
    { const back = cTo.clone().sub(out).setY(0).normalize(), sd = V(back.z, 0, -back.x); director.cut(cTo.clone().addScaledVector(back, 1.2).addScaledVector(sd, 0.55).add(V(0, 1.55, 0)), out.clone().add(V(0, 1.1, 0)), 40); }
    await wait(0.5);
    this.ringGlow = 4;
    this.engine.gradeUniforms.uFlash.value = 0.14;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.14 * (1 - k)));
    await this.suitUp(1.8);
    this.powerUp();
    this.ringGlow = 0.6;
    await wait(0.6);
    this.ringSay('ringKorJump');
    powers.markerTarget = null;
    this.giveControl('Fly up and make the jump to Korugar');
    await waitFor(() => player.flying && player.position.y > 60);
    this.takeControl();
    audio.sonicBoom?.(0.6);
    await tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = k));
  }

  // ---------------------------------------------------------------- 2. bringing him in
  // The capital again, the Palace of Order: its forecourt packed below his balcony. He's telling them
  // what Oa wants of him. Hal lands in the lane through the crowd; Katma Tui comes out of it and calls
  // him afraid of a summons, where all of them can hear. He comes down, and goes, of his own accord.
  async bringHimIn() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    ui.clock(this.save.info('palace').clock);
    await voyage(this, { from: 'earth', to: 'korugar', launch: false });
    const kor = this.setupKorugar();
    kor.fillForecourt();
    this.enterKorugar(FORECOURT.clone().add(V(0, 0, 40)), Math.PI);
    kor.focus(FORECOURT);
    kor.setCheer(true);
    const ch = this.assets.characters;
    // the front of the crowd along the lane, faces to the balcony; guards before the portal
    const front = [];
    [-205.5, -201.5, -197.5, -193.5, -189.5, -185.5].forEach((z, i) => {
      for (const sx of [-1, 1]) {
        const woman = ch.katma && (i + (sx > 0 ? 1 : 0)) % 3 === 1;
        const at = V(sx * (3.0 + (i % 2) * 0.35), 0, z + (sx > 0 ? 1.2 : 0));
        const rig = woman ? createKatma(ch.katma, { citizen: true, seed: 300 + i * 7 + sx }) : createKorugarian(ch.abin, { seed: 600 + i * 13 + (sx > 0 ? 5 : 0) });
        const p = this.addPerson(kor, rig, at, yawTo(at, BALCONY));
        p.anim.lookAt(() => V(0, BALCONY.y + 1.6, BALCONY.z), 0.5);
        front.push(p);
      }
    });
    const guards = [-7, -4.3, 4.3, 7].map((x, i) => {
      const p = this.addPerson(kor, createKorugarian(ch.abin, { seed: 41 + i * 9, guard: true }), V(x, 0, -209.6), 0);
      p.anim.lookAt(() => player.rig.bonePosition('head', _g), 0.5);
      return p;
    });
    const katma = (this.katma = ch.katma ? this.addKatma(V(-3.1, 0, -195.5), yawTo(V(-3.1, 0, -195.5), BALCONY)) : null);
    if (katma) katma.anim.lookAt(() => V(0, BALCONY.y + 1.6, BALCONY.z), 0.5);
    const sin = (this.sin = this.addSinestroAt(kor, kor.blocks));
    sin.place(BALCONY, 0);
    sin.bl.lookHome = () => () => V(0, 1.6, -186);
    const chant = audio.pad([110, 138.6, 164.8], 0.03, { cutoff: 600 });
    // in over the avenue's roofs
    await this.arriveFlying(V(0, 42, -100), Math.PI, V(0, -2.5, -11));
    this.ringSay('ringPalace');
    wait(1.2).then(() => this.say('sinPal0', { skip: false }));
    powers.markerTarget = { pos: FORECOURT.clone().setY(1.5), label: 'Sinestro' };
    this.giveControl('Land in the forecourt, below Sinestro’s balcony');
    await waitFor(() => !player.flying && Math.hypot(player.position.x - FORECOURT.x, player.position.z - FORECOURT.z) < 9);
    powers.markerTarget = null;
    this.takeControl();
    await this.touchDown();
    if (player.position.distanceTo(FORECOURT) > 0.6) await player.walkTo(FORECOURT, player.walkSpeed);
    player.turnTo(Math.PI);
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.75);
    // the forecourt goes quiet; heads turn
    kor.setCheer(false);
    chant.level?.(0.008, 2);
    for (const p of front) p.anim.lookAt(this.headOf(player.rig), 0.55);
    sin.bl.lookHome = () => this.headOf(player.rig);
    // (cameras keep to the lane: the crowd stands either side of |x| 2.7)
    director.cut(V(1.2, 1.5, -186), BALCONY.clone().add(V(0, 1.0, 0)), 34);
    director.move(V(0.9, 1.6, -189), BALCONY.clone().add(V(0, 1.3, 0)), 5, ease.inOut, 30);
    await wait(0.8);
    await this.sinSay('sinPal1', [['messenger', 'present'], ['Earthman', () => sin.anim.gesture('chin', 1.1, 0.5)], ['fetch', 'dismiss']]);
    await this.halClose(1.0);
    await this.say('halPal1');
    await this.sinClose(1.2);
    await this.sinSay('sinPal2', [['world', 'present']]);
    await this.halClose(0.9, -1);
    player.animator.gesture('tilt', 0.8, 0.3);
    await this.say('halPal2');
    await this.sinClose(0.9, -1);
    await this.sinSay('sinPal3', [['other', () => sin.anim.gesture('tilt', 1, 0.4)]]);
    await this.halClose(0.8);
    await this.say('halPal3');
    // his guards come off the portal at Hal; a hand stops them
    for (const [i, g] of guards.entries()) g.home = g.home.clone().add(V(i < 2 ? 1.2 : -1.2, 0, 2.2));
    director.cut(V(-1.7, 1.6, -199.5), V(0, 1.2, -208.5), 40);
    await wait(1.0);
    await this.sinSay('sinPal4', [['Stand', 'dismiss']]);
    for (const g of guards) { g.held = true; g.loco.speed = 0; }
    // Katma, out of the crowd
    if (katma) {
      katma.anim.lookAt(() => sin.rig.bonePosition('head', _k), 0.7);
      katma.home = FORECOURT.clone().add(V(-1.7, 0, 0.9));
      director.cut(FORECOURT.clone().add(V(1.2, 1.5, 4.4)), V(-2.4, 1.4, -195), 40);
      await Promise.race([waitFor(() => katma.rig.root.position.distanceTo(katma.home) < 0.1), wait(8)]);
      katma.held = true;
      katma.loco.speed = 0;
      katma.rig.root.rotation.y = Math.PI;
      await this.katmaClose(1.0);
    }
    await this.katmaSay('katmaPal1');
    // the whole forecourt hears it
    director.cut(BALCONY.clone().add(V(-2.2, 2.2, -1.6)), V(0, 1.2, -192), 40);
    sin.bl.lookHome = () => () => (katma ? katma.head() : FORECOURT);
    await wait(1.4);
    await this.sinClose(1.2);
    await this.sinSay('sinPal5', [['Katma', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.sinClose(1.1, -1);
    sin.bl.lookHome = () => () => V(0, 1.6, -186);
    await this.sinSay('sinPal6', [['watch', 'present'], ['nothing', () => sin.anim.gesture('beat', 0.6, 0.6)]]);
    // down from the balcony to them: straight up off it, out over the rail, and down (a cubic through
    // points worked out to keep his feet above the rail's top as he crosses it; a straight line took
    // him through the rail and the balcony's slab), the camera following him from the lane
    const meet = FORECOURT.clone().add(V(0.9, 0, -2.6));
    const s0 = sin.position.clone(), yaw1 = yawTo(meet, FORECOURT);
    const c1 = s0.clone().add(V(0, 4.1, -0.3)), c2 = V(meet.x * 0.45, 14, meet.z - 1.4);
    const bez = (t, out) => { const u = 1 - t; return out.set(0, 0, 0).addScaledVector(s0, u * u * u).addScaledVector(c1, 3 * u * u * t).addScaledVector(c2, 3 * u * t * t).addScaledVector(meet, t * t * t); };
    sin.anim.play(sin.flyGen, 0.25);
    director.cut(V(-1.5, 1.6, -195.5), s0.clone().add(V(0, 1.4, 0)), 44);
    audio.whoosh(2.2, 0.4);
    const at = new THREE.Vector3(), aim = new THREE.Vector3();
    await tween(2.6, (k) => {
      const t = ease.inOut(k);
      bez(t, at);
      sin.place(at, wrap(yaw1 * ease.inOut(Math.min(1, k * 1.4))));
      sin.flyState.k = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.45;
      director.look.lerp(aim.copy(at).add(V(0, 1.2, 0)), 0.18);
    }, ease.linear);
    audio.land(0.4);
    sin.anim.play(sin.standGen, 0.5);
    sin.yaw = yaw1;
    sin.place(meet, yaw1);
    sin.bl.lookHome = () => this.headOf(player.rig);
    player.turnTo(yawTo(FORECOURT, meet));
    await this.sinClose(1.2);
    await this.sinSay('sinPal7', [['listen', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.halClose(1.0);
    await this.say('halPal4');
    await this.sinClose(1.0, -1);
    await this.sinSay('sinPal8', [['disorder', 'dismiss']]);
    // he goes up first; she can't follow
    sin.anim.play(sin.flyGen, 0.3);
    const s1 = sin.position.clone();
    audio.whoosh(1.4, 0.5);
    tween(1.6, (k) => { sin.place(s1.clone().add(V(0, 40 * k * k, 0)), sin.yaw); sin.flyState.k = Math.min(1, k * 2); }, ease.linear);
    if (katma) {
      player.turnTo(yawTo(FORECOURT, katma.rig.root.position));
      katma.rig.root.rotation.y = yawTo(katma.rig.root.position, FORECOURT);
      katma.anim.lookAt(this.headOf(player.rig), 0.8);
      player.lookAt(() => katma.head(), 0.8);
    }
    await this.katmaClose(1.2);
    await this.katmaSay('katmaPal2');
    await this.halClose(0.9);
    await this.say('halPal5');
    // the ring's light round her, and up
    const kp = katma ? katma.rig.root.position : FORECOURT.clone().add(V(-1.7, 0, 0.9));
    const bubble = createBubble(1.15);
    bubble.position.copy(kp).add(V(0, 0.95, 0));
    kor.scene.add(bubble);
    const bu = bubble.userData.uniforms;
    const bubbleT = onFrame((dt) => { bu.uTime.value += dt; if (katma) bubble.position.copy(katma.rig.root.position).add(V(0, 0.95, 0)); });
    audio.constructForm(0.8);
    this.ringGlow = 3;
    director.cut(kp.clone().add(V(2.4, 1.4, 3.2)), kp.clone().add(V(0, 1.2, 0)), 40);
    const ky = kp.y;
    await tween(0.8, (k) => (bu.uOpacity.value = k * 0.9));
    if (katma) katma.anim.play(still(POSES.float, 0.6), 0.8);
    await tween(0.9, (k) => (kp.y = ky + 0.32 * ease.inOut(k)));
    await wait(0.8);
    player.animator.play(still(POSES.land, 0.5), 0.2);
    await wait(0.4);
    director.cut(V(1.3, 0.9, -194.5), FORECOURT.clone().setY(7), 54);
    player.animator.play(player.flightGen, 0.2);
    player.flightState.k = 1;
    audio.takeoff();
    const p0 = player.object.position.clone(), k0 = kp.clone();
    tween(2.0, (k) => { player.object.position.lerpVectors(p0, p0.clone().add(V(0, 120, 0)), ease.in(k)); if (katma) katma.rig.root.position.lerpVectors(k0, k0.clone().add(V(0, 118, 0)), ease.in(k)); }, ease.linear);
    for (const p of front) p.anim.lookAt(() => V(0, 40, -203), 0.6);
    await wait(1.3);
    chant.stop(2);
    await tween(0.6, (k) => (this.engine.gradeUniforms.uFlash.value = k));
    // she comes along, in the light, at his side (carried with him through the voyage)
    bubbleT();
    if (katma) {
      player.object.add(katma.rig.root, bubble);
      katma.rig.root.position.set(1.9, 0.2, 0.9);
      katma.rig.root.rotation.set(0, 0, 0);
      bubble.position.set(1.9, 1.15, 0.9);
    }
    await voyage(this, { from: 'korugar', to: 'oa', launch: false });
    katma?.rig.root.removeFromParent();
    bubble.removeFromParent();
  }

  // ---------------------------------------------------------------- 3. the trial
  // The Hall of the Guardians. Sinestro alone on the dais before them, Hal and Katma behind him. The
  // charge; his defence; their testimony. His ring taken and his uniform's light gone out of it; his
  // banishment, through a rift into the antimatter universe. The ring chooses Katma Tui.
  async tribunal() {
    const { ui, director, audio, player } = this;
    this.lanternUp();
    const oa = this.setupOa();
    this.addGuardians();
    this.hallActive = true;
    const C = V(HALL.x, DAIS_TOP, HALL.z);
    const halAt = C.clone().add(V(2.3, 0, 1.3)), katAt = C.clone().add(V(-2.3, 0, 1.3)), sinAt = C.clone().add(V(0, 0, -0.5));
    this.enterOa(halAt, Math.PI);
    ui.clock(this.save.info('tribunal').clock);
    this.takeControl();
    this.standDown();
    const sin = (this.sin = this.addSinestroAt(this.oa));
    sin.place(sinAt, Math.PI);
    const katma = (this.katma = this.addHallKatma(katAt, Math.PI));
    const elder = this.elder, gs = this.guardians;
    const elderHead = () => elder.bonePosition('head', _p).add(V(0, 0.08, 0));
    player.lookAt(elderHead, 0.8);
    sin.bl.lookHome = () => elderHead;
    katma?.anim.lookAt(elderHead, 0.7);
    const choir = audio.pad([98, 146.8, 196, 293.7], 0, { cutoff: 900, fadeIn: 3 });
    choir.level(0.05, 3);
    director.cut(HALL.clone().add(V(1.8, 2.6, 7.6)), HALL.clone().add(V(0, 5.6, -10)), 48);
    tween(0.9, (k) => (this.engine.gradeUniforms.uFlash.value = 1 - k), ease.out);
    ui.fade(0, 0.6);
    director.move(HALL.clone().add(V(1.2, 2.9, 6.2)), HALL.clone().add(V(0, 6.4, -10)), 7, ease.inOut, 44);
    await wait(2.4);
    // the charge
    await this.gClose(elder, 1.8);
    await this.gSay('gTri1', elder, [['accused', () => elder.anim.gesture('nod', 1, 0.4)]]);
    await this.gClose(gs[1], 1.4, 0.4);
    await this.gSay('gTri2', gs[1]);
    // his defence
    await this.sinClose(1.3);
    await this.sinSay('sinTri1', [['war', 'present'], ['seven', () => sin.anim.gesture('beat', 0.6, 0.5)], ['Name', () => sin.anim.gesture('chin', 1.1, 0.5)]]);
    await this.sinClose(1.1, -1);
    await this.sinSay('sinTri2', [['order', 'ring'], ['detail', 'dismiss']]);
    // the witnesses
    await this.gClose(elder, 1.4, -0.3);
    await this.gSay('gTri3');
    player.lookAt(elderHead, 0.85);
    await this.halUp(1.2);
    player.animator.gesture('beat', 0.5, 0.5);
    await this.say('halTri1');
    await this.halUp(0.9, -0.5);
    await this.say('halTri2');
    await this.gClose(gs[5], 1.4, -0.4);
    await this.gSay('gTri4', gs[5], [['Katma', () => gs[5].anim.gesture('chin', 1, 0.4)]]);
    await this.katmaClose(1.2, 1, 32);
    await this.katmaSay('katmaTri1');
    await this.katmaClose(0.9, -1, 30);
    await this.katmaSay('katmaTri2');
    // he turns on her
    sin.bl.lookHome = () => () => katma?.head() ?? katAt;
    const s0 = sin.yaw, s1 = yawTo(sinAt, katAt);
    tween(0.8, (k) => { sin.yaw = s0 + wrap(s1 - s0) * ease.inOut(k); sin.place(sinAt, sin.yaw); });
    katma?.anim.lookAt(() => sin.rig.bonePosition('head', _k), 0.8);
    await wait(0.4);
    await this.sinClose(1.1);
    await this.sinSay('sinTri3', [['Ungrateful', 'dismiss']]);
    await this.katmaClose(0.9);
    await this.katmaSay('katmaTri3');
    // the verdict
    tween(0.8, (k) => { sin.yaw = s1 + wrap(Math.PI - s1) * ease.inOut(k); sin.place(sinAt, sin.yaw); });
    sin.bl.lookHome = () => elderHead;
    katma?.anim.lookAt(elderHead, 0.7);
    director.cut(C.clone().add(V(0, 1.4, 4.2)), HALL.clone().add(V(0, 6.6, -10.8)), 40);
    await wait(1.6);
    await this.gClose(elder, 1.8, 0, 26);
    await this.gSay('gTri5');
    elder.gu.uHandL.value = 1;
    elder.bl.play('decree');
    await this.gSay('gTri6');
    setTimeout(() => (elder.gu.uHandL.value = 0), 1400);
    await this.ringTaken(sin, sinAt, elderHead);
    // banished
    await this.gClose(elder, 1.4, 0.3, 28);
    for (const g of gs) { g.gu.uHandL.value = 1; g.bl.play('decree'); }
    setTimeout(() => { for (const g of gs) g.gu.uHandL.value = 0; }, 3600);
    await this.gSay('gTri7');
    await this.banish(sin, sinAt, choir);
    // the ring chooses
    await this.ringChooses(katma, katAt);
    await this.gClose(elder, 1.6, -0.2, 28);
    elder.gu.uHandL.value = 1;
    elder.bl.play('decree');
    await this.gSay('gTri8');
    setTimeout(() => (elder.gu.uHandL.value = 0), 1200);
    // the two of them
    player.turnTo(yawTo(halAt, katAt));
    if (katma) { katma.setYaw(yawTo(katAt, halAt)); katma.anim.lookAt(this.headOf(player.rig), 0.8); player.lookAt(() => katma.head(), 0.8); }
    await this.katmaClose(1.4, 1, 32);
    await this.katmaSay('katmaTri5');
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.7, 0.3);
    await this.say('halTri4');
    await this.katmaClose(1.0, -1, 30);
    await this.katmaSay('katmaTri6');
    director.move(C.clone().add(V(0, 1.7, 5.8)), C.clone().add(V(0, 1.4, 1.3)), 4, ease.inOut, 40);
    await wait(2.2);
    choir.stop(4);
    await ui.fade(1, 2.0);
    this.hallActive = false;
    katma?.rebel.root.removeFromParent();
    katma?.lantern.root.removeFromParent();
    // (on into her first night)
  }

  // ---------------------------------------------------------------- 4. her first night
  // Korugar, that night. The plaza full again, and quiet: they've come to see whether it's true.
  // Katma speaks the oath under his statue; Hal shows her a first construct ("think about what it's
  // for"); the people want him down, and the two of them pull the statue off its pedestal with chains
  // of light (the player holds the click: the pull). It falls; they cheer, and it isn't fear. Then
  // the sky tears: the Weaponers' Thunderers, through from Qward, after the ring. When they're beaten
  // the breach is still open: Sinestro is on the other side of it.
  async firstNight() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    ui.clock(this.save.info('firstnight').clock);
    await loadThunderers();
    const kor = this.setupKorugar();
    kor.night(true);
    for (const m of [kor.forecourt?.down, kor.forecourt?.up]) if (m) m.visible = false;
    kor.setCheer(false);
    const halAt = V(-4.6, 0, 12.5), katAt = V(4.6, 0, 12.5);
    this.enterKorugar(halAt, yawTo(halAt, V(0, 0, 0)));
    this.ambience(audio.wind(0.04), audio.pad([55, 82.4, 110], 0.02, { cutoff: 380 }));
    kor.focus(V(0, 0, 8));
    this.takeControl();
    // the front ranks, with a lane left where he'll fall
    const ch = this.assets.characters, front = [];
    CROWD_FRONT.forEach((at, i) => {
      if (Math.abs(at.x) < 5.5) return;
      const woman = ch.katma && i % 3 === 1;
      const rig = woman ? createKatma(ch.katma, { citizen: true, seed: i * 7 + 3 }) : createKorugarian(ch.abin, { seed: i * 13 + 5 });
      const p = this.addPerson(kor, rig, at, yawTo(at, V(0, 0, 0)));
      p.anim.lookAt(() => V(0, 14, 0), 0.4);
      front.push(p);
    });
    const katma = (this.katma = this.addPerson(kor, createKatma(ch.katma, { uniform: true }), katAt, yawTo(katAt, V(0, 0, 0))));
    katma.held = true;
    const kRing = createRing();
    this.attachRing(kRing, katma.rig);
    // over the city by night, down onto the plaza
    // (down the old quarter's street, the one gap in the plaza's towers, and in over the crowd)
    director.cut(V(0, 34, 66), V(0, 9, 0), 46);
    await ui.fade(0, 1.4);
    director.move(V(4, 5.5, 27), V(0, 8, 0), 6, ease.inOut, 44);
    await wait(4.2);
    player.lookAt(() => katma.head(), 0.8);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    player.turnTo(yawTo(halAt, katAt));
    katma.rig.root.rotation.y = yawTo(katAt, halAt);
    await this.katmaClose(1.2, 1, 34);
    await this.katmaSay('katmaN1');
    await this.halClose(1.0);
    await this.say('halN1');
    // the oath, under him, her ring hand up
    katma.rig.root.rotation.y = yawTo(katAt, V(0, 0, 0));
    katma.anim.lookAt(() => V(0, 16, 0), 0.6);
    player.lookAt(() => katma.head(), 0.6);
    const sh = new THREE.Vector3();
    // (the ring hand held out to him at her shoulder's height, as Hal's was for his oath: an open hand
    // raised upright reads badly, the scans having no fingers to close)
    // (held short of a straight arm, steady in her frame: a straight elbow swings on the slightest sway)
    this.steadyHand(katma, 'R', V(0.02, 0.07, 0.43), { dur: 1.0, pole: V(-0.5, -1, -0.15) });
    for (const p of front) p.anim.lookAt(() => katma.head(), 0.5);
    const glow = this.ringLight(kRing);
    // (from in front of her and below, her raised hand and the statue over her)
    const kf = V(-katAt.x, 0, -katAt.z).normalize(), ks = V(kf.z, 0, -kf.x);
    director.cut(katAt.clone().addScaledVector(kf, 2.6).addScaledVector(ks, -0.8).add(V(0, 1.05, 0)), katAt.clone().add(V(0, 1.85, 0)), 40);
    for (const [i, key] of ['katmaOath1', 'katmaOath2', 'katmaOath3', 'katmaOath4'].entries()) {
      glow.set(0.6 + i * 0.6);
      if (i === 2) director.move(katAt.clone().addScaledVector(kf, 3.6).addScaledVector(ks, 0.6).add(V(0, 0.8, 0)), katAt.clone().add(V(0, 2.1, 0)), 4, ease.inOut, 44);
      await this.katmaSay(key);
    }
    audio.ringChime();
    this.engine.gradeUniforms.uFlash.value = 0.18;
    tween(0.7, (k) => (this.engine.gradeUniforms.uFlash.value = 0.18 * (1 - k)));
    const g0 = katma.rig.u.uGlow.value;
    tween(1.2, (k) => (katma.rig.u.uGlow.value = g0 + Math.sin(k * Math.PI) * 1.2));
    katma.anim.reach('R', null, { rate: 3 });
    glow.set(0.4);
    await wait(1.0);
    // a first construct: what it's for
    katma.rig.root.rotation.y = yawTo(katAt, halAt);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    player.lookAt(() => katma.head(), 0.8);
    await this.halClose(1.0, -1);
    await this.say('halN2');
    await this.katmaClose(1.0, -1, 32);
    await this.katmaSay('katmaN2');
    katma.rig.root.rotation.y = yawTo(katAt, V(0, 0, 30));
    const shield = constructMesh(shieldGeometry().scale(0.9, 0.9, 0.9), { uPattern: 1, uScale: 0.13, uEmblem: 1, outline: 0.015 });
    shield.userData.set('uForm', 0);
    kor.scene.add(shield);
    const kFwd = () => _d.set(Math.sin(katma.rig.root.rotation.y), 0, Math.cos(katma.rig.root.rotation.y));
    this.steadyHand(katma, 'R', V(0.03, -0.06, 0.42), { dur: 0.6, pole: V(-0.5, -1, -0.3) });
    const hold = onFrame((dt) => { katma.rig.bonePosition('hand_R', shield.position).addScaledVector(kFwd(), 0.35); shield.quaternion.setFromUnitVectors(_Zf, kFwd()); shield.userData.set('uTime', this.engine.time); });
    { const f = kFwd().clone(), sd = V(f.z, 0, -f.x); director.cut(katAt.clone().addScaledVector(f, 3.3).addScaledVector(sd, 1.9).add(V(0, 1.45, 0)), katAt.clone().addScaledVector(f, 0.45).add(V(0, 1.3, 0)), 40); }
    audio.constructForm(0.7);
    // it doesn't take at first: it flickers out and back, then holds
    await tween(2.2, (k) => shield.userData.set('uForm', Math.min(1, k * 1.3) * (k < 0.7 ? 0.55 + 0.45 * Math.abs(Math.sin(k * 26)) : 1)), ease.linear);
    await this.katmaSay('katmaN3');
    await this.halClose(0.9);
    await this.say('halN3');
    await tween(0.5, (k) => shield.userData.set('uForm', 1 - k));
    hold();
    shield.removeFromParent();
    katma.anim.reach('R', null, { rate: 3 });
    // the crowd: bring him down
    kor.setCheer(true);
    this.cheerFront(front, true);
    director.cut(V(0, 2.2, 23), V(0, 11, 0), 44);
    await this.say('crowdN1');
    katma.rig.root.rotation.y = yawTo(katAt, halAt);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    await this.katmaClose(1.0, 1, 32);
    await this.katmaSay('katmaN4');
    await this.halClose(0.8);
    await this.say('halN4');
    kor.setCheer(false);
    this.cheerFront(front, false);
    await this.pullStatue(katma, halAt, katAt);
    // down: the people
    kor.setCheer(true);
    this.cheerFront(front, true);
    const roar = audio.pad([164.8, 220, 277.2], 0, { cutoff: 1400, fadeIn: 0.5 });
    roar.level(0.03, 0.6);
    director.cut(V(-9, 2.0, 26), V(0, 1.5, 8), 46);
    director.move(V(-6, 2.4, 22), V(0, 2.0, 6), 5, ease.inOut, 42);
    await wait(2.6);
    player.lookAt(() => katma.head(), 0.8);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    katma.rig.root.rotation.y = yawTo(katAt, halAt);
    player.turnTo(yawTo(halAt, katAt));
    await this.katmaClose(1.2, 1, 32);
    await this.katmaSay('katmaN5');
    await this.halClose(1.0, -1);
    await this.say('halN5');
    roar.level(0, 3);
    // the sky tears
    const mouth = V(0, 26, -6);
    const hum = audio.pad([46.2, 69.3, 92.5], 0, { cutoff: 260, fadeIn: 1.5 });
    hum.level(0.07, 1.5);
    const rift = (this.korRift = this.openRift(kor, mouth, 7, 1, { palette: 'antimatter' }));
    audio.rift(true);
    audio.thunder?.(0.6);
    director.cut(V(2, 1.6, 20), mouth.clone().add(V(0, -2, 0)), 52);
    kor.setCheer(false);
    this.cheerFront(front, false);
    for (const p of front) p.anim.lookAt(() => mouth, 0.7);
    await tween(2.2, (k) => (rift.open = ease.out(k)), ease.linear);
    this.ringSay('ringRift');
    await wait(1.0);
    await this.katmaClose(1.0, 1, 32);
    await this.katmaSay('katmaN6');
    await this.halClose(0.8);
    await this.say('halN6');
    // (a cut: the plaza cleared, Katma at its edge holding a dome of light over the people)
    await ui.fade(1, 0.4);
    for (const p of front) p.rig.root.visible = false;
    for (const m of [kor.crowdDown, kor.crowdUp]) if (m) m.visible = false;
    katma.home = V(0, 0, 39); // (at the mouth of the old quarter's street, the people sheltering behind her)
    katma.rig.root.position.copy(katma.home);
    katma.rig.root.rotation.y = 0;
    katma.anim.reach('R', () => katma.rig.bonePosition('upperArm_R', sh).add(V(0, 0.5, 0.25)), { pole: V(-1, 0, -0.3), rate: 4 });
    const dome = constructMesh(new THREE.SphereGeometry(7, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), { uPattern: 1, uScale: 0.5, outline: 0.02 });
    dome.userData.set('uOpacity', 0.35);
    dome.position.set(0, 0, 47);
    kor.scene.add(dome);
    // Hal out on the open side of the plaza, facing where they'll come through
    const fightAt = V(-13, 0, 15), fightYaw = yawTo(fightAt, V(-22, 0, -4));
    player.place(fightAt, fightYaw);
    player.camYaw = fightYaw + Math.PI;
    player.camPitch = 0.2;
    director.mode = 'follow';
    ui.fade(0, 0.4);
    const T = (this.thunder = new Thunderers({ scene: kor.scene, physics: kor.physics, powers, player, audio, director, mocap: this.mocap, centre: V(0, 0, 0), radius: 34, blocks: [{ x: 0, z: 0, r: 9.6, h: 6.2 }, ...(kor.fallenBlocks ?? FALLEN)] }));
    const tick = (dt) => { T.update(dt); dome.userData.set('uTime', this.engine.time); };
    kor.updaters.push(tick);
    powers.setCharge(100);
    powers.health = powers.maxHealth;
    Object.assign(powers, { healDelay: 6, healRate: 4 });
    this.giveControl('Drive the Thunderers back');
    this.hud.tutorial({ kicker: 'Qward', title: 'Thunderers', n: 1, of: 1, html: 'Each shows you its attack before it comes. The <b>brute</b> raises his flail; the <b>caster</b> lights a bolt in her hand; the <b>archer</b>’s arrow glints; the <b>winged</b> one shrieks and rises before it dives. <b>Shield</b> (<kbd>Right-click</kbd>) as it lands to parry: a parried bolt flies back.' });
    wait(10).then(() => this.hud.tutorial(null));
    // (round Hal, ten to sixteen metres off, clear of the pedestal and the statue)
    const round = (da, r, y = 0) => { const h = player.position; let a = player.yaw + da; for (let i = 0; i < 12; i++, a += 0.5) { const p = V(h.x + Math.sin(a) * r, y, h.z + Math.cos(a) * r); if (Math.hypot(p.x, p.z) > 11 && Math.hypot(p.x, p.z) < 32 && (kor.fallenBlocks ?? FALLEN).every((b) => Math.hypot(p.x - b.x, p.z - b.z) > b.r + 1.5)) return p; } return V(h.x + 10, y, h.z); };
    await this.thunderWave(T, [['brute', round(-0.3, 11)], ['caster', round(0.5, 15)], ['brute', round(0.25, 12)], ['caster', round(-0.8, 16)]], 'Drive the Thunderers back');
    this.bark('katmaN7');
    await this.thunderWave(T, [['archer', V(-2.6, 6.2, 1.6)], ['archer', V(2.8, 6.2, 1.2)], ['winged', round(0.6, 12, 7)], ['winged', round(-0.6, 13, 8)], ['brute', round(0, 13)]], 'Drive the Thunderers back');
    Object.assign(powers, { healDelay: 4, healRate: 8 });
    this.takeControl();
    await this.touchDown();
    // the breach, still open over them
    katma.anim.reach('R', null, { rate: 3 });
    tween(0.6, (k) => dome.userData.set('uForm', 1 - k)).then(() => dome.removeFromParent());
    katma.home = player.position.clone().add(V(2.2, 0, 1.6));
    await Promise.race([waitFor(() => katma.rig.root.position.distanceTo(katma.home) < 0.15), wait(6)]);
    katma.rig.root.rotation.y = yawTo(katma.rig.root.position, player.position);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    player.turnTo(yawTo(player.position, katma.rig.root.position));
    player.lookAt(() => katma.head(), 0.8);
    await this.katmaClose(1.2, 1, 32);
    await this.katmaSay('katmaN8');
    await this.halClose(1.0);
    await this.say('halN7');
    await this.katmaClose(1.0, -1, 30);
    await this.katmaSay('katmaN9');
    await this.halClose(0.8, -1);
    await this.say('halN8');
    powers.markerTarget = { pos: mouth, label: 'The breach' };
    this.giveControl('Fly into the breach');
    await waitFor(() => player.position.distanceTo(mouth) < 7.5);
    powers.markerTarget = null;
    this.takeControl();
    hum.stop(1.5);
    audio.whoosh(1.4, 0.6);
    await tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = k));
    this.engine.gradeUniforms.uFlashColor.value.setRGB(1.2, 0.7, 1.8);
    T.clear();
    kor.updaters.splice(kor.updaters.indexOf(tick), 1);
    rift.close();
  }

  // The front ranks' fists up (or down).
  cheerFront(front, on) {
    for (const c of front) {
      const sh = new THREE.Vector3(), side = c.rig.root.position.x > 0 ? 'L' : 'R';
      if (on) c.anim.reach(side, () => c.rig.bonePosition(side === 'R' ? 'upperArm_R' : 'upperArm_L', sh).add(V(0, 0.5 + 0.05 * Math.sin(this.engine.time * 5 + sh.x), 0)), { pole: V(side === 'R' ? -1 : 1, 0, -0.5), rate: 6 });
      else c.anim.reach(side, null, { rate: 4 });
    }
  }

  // One wave of them, spaced out as they come through; done when they're all down.
  async thunderWave(T, spawns, label) {
    for (const [kind, at] of spawns) { T.spawn(kind, at); await wait(0.45); }
    await waitFor(() => { this.ui.objective(`${label} · ${T.alive} left`); return T.alive === 0; });
  }

  // The pull: a chain of light from each of their ring hands to his shoulders. Held click pulls (the
  // statue tips on his toes, her pulling with him); let go and he settles back. When he's past the
  // point, he goes.
  async pullStatue(katma, halAt, katAt) {
    const { director, audio, player, powers, ui, input } = this, kor = this.kor, srig = kor.statueRig;
    const fig = srig?.root;
    if (!fig) return;
    const shL = new THREE.Vector3(), shR = new THREE.Vector3(), sh = new THREE.Vector3(), sh2 = new THREE.Vector3();
    const target = (rig, to, out) => rig.bonePosition('upperArm_R', out).add(_e.copy(to).sub(out).normalize().multiplyScalar(0.6));
    const ht = new THREE.Vector3(), kt = new THREE.Vector3();
    player.animator.reach('R', () => target(player.rig, srig.bonePosition('upperArm_R', shR), ht), { pole: V(-0.6, -0.8, -0.3), rate: 5 });
    katma.anim.reach('R', () => target(katma.rig, srig.bonePosition('upperArm_L', shL), kt), { pole: V(-0.6, -0.8, -0.3), rate: 5 });
    player.lookAt(() => srig.bonePosition('head', sh), 0.7);
    katma.anim.lookAt(() => srig.bonePosition('head', sh2), 0.7);
    player.turnTo(yawTo(halAt, V(0, 0, 0)));
    katma.rig.root.rotation.y = yawTo(katAt, V(0, 0, 0));
    const chainA = this.lightChain(kor.scene, 24), chainB = this.lightChain(kor.scene, 24);
    const hp = new THREE.Vector3(), kp = new THREE.Vector3();
    const place = onFrame(() => {
      chainA.span(player.rig.bonePosition('hand_R', hp), srig.bonePosition('upperArm_R', shR));
      chainB.span(katma.rig.bonePosition('hand_R', kp), srig.bonePosition('upperArm_L', shL));
      chainA.time(this.engine.time); chainB.time(this.engine.time);
    });
    audio.constructForm(0.8);
    await tween(0.6, (k) => { chainA.form(k); chainB.form(k); });
    director.cut(V(0.6, 1.4, 21), V(0, 9.5, 1), 52);
    this.hud.tutorial({ kicker: 'Katma Tui', title: 'Bring him down', n: 1, of: 1, html: 'Hold <kbd>Click</kbd> to pull. Let go and he settles back.' });
    ui.objective('Pull the statue down with her');
    let k = 0, said = 0, strainAt = 0;
    await new Promise((resolve) => {
      const stop = onFrame((dt) => {
        const pulling = input.down('Mouse0') || this.autoPull;
        k = Math.max(0, Math.min(1, k + (pulling ? 0.2 : -0.3) * dt));
        kor.statueTilt(k);
        powers.setCharge(powers.charge - (pulling ? 0.8 : 0) * dt);
        if (pulling) { director.shake(0.04, 0.1); if (this.engine.time > strainAt) { audio.strain(1.4, 0.22); strainAt = this.engine.time + 1.3; } }
        if (said === 0 && k > 0.3) { said = 1; this.bark('halPull1'); }
        if (said === 1 && k > 0.62) { said = 2; this.bark('katmaPull1'); }
        if (k >= 1) { stop(); resolve(); }
      });
    });
    this.hud.tutorial(null);
    ui.objective(null);
    // past the point: he goes
    audio.rumble?.(2.4, 0.5);
    director.cut(V(-24, 4.5, 15), V(0, 4.5, 9), 54);
    tween(0.4, (k) => { chainA.form(1 - k); chainB.form(1 - k); }).then(() => { place(); chainA.dispose(); chainB.dispose(); });
    player.animator.reach('R', null, { rate: 4 });
    katma.anim.reach('R', null, { rate: 4 });
    // he goes: the ankles crack, he topples off the pedestal under his own weight, the head breaks off
    // as it nears the plaza and rolls on, and the body comes down in a cloud of dust and stone
    await kor.statueFall({ onEvent: (name, d) => {
      if (name === 'crack') { audio.crunch?.(1.2); audio.snap?.(1); director.shake(0.12, 0.3); powers.dustFx(V(0, PEDESTAL_TOP + 0.4, 0.4), 16, 1.6); }
      if (name === 'head') { audio.crunch?.(1.4); powers.dustFx(d.at.clone().setY(0.5), 24, 2.5); }
      if (name === 'impact') {
        audio.explosion(0.6 + 0.35 * d.k);
        director.shake(0.5 + 0.5 * d.k, 0.9);
        for (let i = 0; i < 6; i++) powers.dustFx(d.at.clone().add(V((Math.random() - 0.5) * 3, 0.4, (i - 2.5) * 2.4)), 34, 3.5);
        kor.physics.burst(d.at, 7, 9, 3, 1);
        this.statueRubble(kor, d.at);
      }
    } });
    // where his head came to rest, and the two of them looking at it
    const head = kor.statueRig.bonePosition('head', V(0, 0, 0));
    player.lookAt(head, 0.6);
    katma.anim.lookAt(head, 0.6);
    await wait(0.8);
    player.lookAt(null);
    katma.anim.lookAt(null);
    await wait(0.6);
  }

  // stone broken off him as he lands: loose chunks across the plaza
  statueRubble(kor, at = V(0, 0, 12)) {
    const mat = new THREE.MeshStandardMaterial({ color: kor.isNight ? 0x3c3934 : 0x8e867a, roughness: 0.8 });
    for (let i = 0; i < 16; i++) {
      const s = V(0.25 + Math.random() * 0.5, 0.2 + Math.random() * 0.4, 0.25 + Math.random() * 0.5);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0).scale(s.x, s.y, s.z), mat);
      m.position.set(at.x + (Math.random() - 0.5) * 4, 1.2 + Math.random(), at.z + (Math.random() - 0.5) * 13);
      m.castShadow = true;
      kor.scene.add(m);
      const b = kor.physics.dynamicBox(m, s.clone().multiplyScalar(0.8), { density: 2.4 });
      b.setLinvel({ x: (Math.random() - 0.5) * 9, y: 3 + Math.random() * 5, z: (Math.random() - 0.3) * 6 }, true);
    }
  }

  // A chain of light: links along Y, laid between two points (`span`), formed in and out (`form`).
  lightChain(scene, links) {
    const parts = [];
    for (let i = 0; i < links; i++) {
      const t = new THREE.TorusGeometry(0.11, 0.03, 6, 14).scale(1, 1.55, 1);
      if (i % 2) t.rotateY(Math.PI / 2);
      parts.push(t.translate(0, i * 0.27 + 0.13, 0));
    }
    const geo = mergeGeometries(parts), len0 = links * 0.27;
    const mesh = constructMesh(geo, { uPattern: 0, outline: 0.012 });
    mesh.userData.set('uForm', 0);
    scene.add(mesh);
    const d = new THREE.Vector3();
    return {
      mesh,
      span(a, b) { d.subVectors(b, a); mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(_Y, d.clone().normalize()); mesh.scale.set(1, d.length() / len0, 1); },
      form(k) { mesh.userData.set('uForm', k); },
      time(t) { mesh.userData.set('uTime', t); },
      dispose() { mesh.removeFromParent(); },
    };
  }

  // ---------------------------------------------------------------- 5. Qward
  // Through the breach, into the antimatter universe: a plain of black glass under a dead sun. North
  // toward the yellow light, past the Thunderers on the way, to the Weaponers' forge: there they give
  // Sinestro the yellow ring, and he takes the colour of fear. He sees Hal, knocks him down, and goes
  // up the forge's column of light into a breach of his own: Korugar.
  setupQward() {
    if (this.qw) return this.qw;
    this.qw = new Qward({ engine: this.engine }).build();
    return this.qw;
  }

  enterQward(at, yaw) {
    const { player, audio, powers } = this, q = this.qw;
    this.world = 'qward';
    this.show(q);
    this.playerActive = true;
    player.spawn(q.physics, q.scene, at, yaw);
    player.ground = () => 0;
    player.surface = 'stone';
    powers.attach({ scene: q.scene, physics: q.physics, ...q.airBounds() });
    powers.regen = 0;
    this.ambience(audio.wind(0.07), audio.pad([41.2, 49, 61.7], 0.03, { cutoff: 300 }));
  }

  async qward() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    await loadProps(QWARD_PROPS);
    await loadThunderers();
    const q = this.setupQward();
    ui.clock(this.save.info('qward').clock);
    this.enterQward(RIFT_AT, Math.PI);
    this.engine.gradeUniforms.uFlashColor.value.setRGB(1.2, 0.7, 1.8);
    const rift = this.openRift(q, RIFT_AT.clone().add(V(0, 0, 3)), 6, 1, { palette: 'antimatter' });
    rift.open = 1;
    await this.arriveFlying(RIFT_AT, Math.PI, V(0, -2, -12));
    wait(1.6).then(async () => { await tween(1.2, (k) => (rift.open = 1 - k)); rift.close(); });
    wait(1.0).then(() => this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    ui.fade(0, 0.6);
    this.ringSay('ringQ1');
    wait(3.5).then(() => this.bark('halQ1'));
    powers.markerTarget = { pos: FORGE.clone().setY(4), label: 'Sinestro' };
    this.giveControl('Follow the yellow light north');
    // the Thunderers wait by the pillars
    const T = (this.thunder = new Thunderers({ scene: q.scene, physics: q.physics, powers, player, audio, director, mocap: this.mocap, centre: AMBUSH, radius: 60, blocks: q.blocks }));
    q.updaters.push((dt) => T.update(dt));
    await waitFor(() => player.position.z < AMBUSH.z + 55);
    this.ringSay('ringAmbush');
    q.focus(AMBUSH);
    Object.assign(powers, { healDelay: 6, healRate: 4 });
    await this.thunderWave(T, [['archer', q.perchTops[0]], ['archer', q.perchTops[1]], ['winged', AMBUSH.clone().add(V(-10, 9, 6))], ['caster', AMBUSH.clone().add(V(-6, 0, -8))], ['caster', AMBUSH.clone().add(V(8, 0, -4))], ['brute', AMBUSH.clone().add(V(0, 0, 4))], ['winged', AMBUSH.clone().add(V(12, 10, -10))]], 'Get past the Thunderers');
    Object.assign(powers, { healDelay: 4, healRate: 8 });
    ui.objective('Follow the yellow light north');
    q.focus(FORGE);
    wait(1.5).then(() => this.bark('halQ2'));
    await waitFor(() => player.position.distanceTo(FORGE) < 46);
    powers.markerTarget = null;
    this.takeControl();
    powers.holster?.();
    // at the forge's edge, unseen
    await ui.fade(1, 0.5);
    player.stopFlying?.(true);
    player.place(LANDING.clone().add(V(-3, 0, 6)), Math.PI);
    await this.forge(q);
  }

  async forge(q) {
    const { ui, director, audio, player, powers } = this, F = FORGE, ch = this.assets.characters;
    // the Weaponers round the crucible, Sinestro before it, drained, ringless
    const wps = [[0, -6.4], [-5.2, -3.6], [5.2, -3.6]].map(([x, z], i) => {
      const g = createGuardian(ch.abin, this.mocap, { weaponer: true, seed: 20 + i * 3 });
      g.root.position.copy(F).add(V(x, 0, z));
      g.root.rotation.y = yawTo(g.root.position, F.clone().add(V(0, 0, 7.4)));
      q.scene.add(g.root);
      return g;
    });
    const wTick = (dt) => { for (const g of wps) { g.bl.update(dt); g.anim.update(dt); } };
    q.updaters.push(wTick);
    const sin = (this.sin = this.addSinestroAt(q, q.blocks));
    const sinAt = F.clone().add(V(0, 0, 7.4)); // (far enough off the crucible that a close shot of him isn't inside it)
    sin.place(sinAt, Math.PI);
    sin.ring.visible = false;
    this.drainSuit(sin.rig, 1);
    sin.bl.lookHome = () => () => wps[0].bonePosition('head', _p);
    for (const g of wps) g.anim.lookAt(() => sin.rig.bonePosition('head', _k), 0.5);
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.6);
    const choir = audio.pad([49, 58.3, 73.4], 0, { cutoff: 500, fadeIn: 2 });
    choir.level(0.05, 2);
    director.cut(F.clone().add(V(9, 2.2, 18)), F.clone().add(V(0, 3, 0)), 46);
    await ui.fade(0, 0.8);
    director.move(F.clone().add(V(6, 2.4, 13)), F.clone().add(V(0, 2.4, 0)), 6, ease.inOut, 42);
    await wait(1.4);
    await this.gClose(wps[0], 1.6, 0.3, 30);
    await this.gSay('wpn1', wps[0], [['waited', () => wps[0].anim.gesture('nod', 1, 0.3)]]);
    await this.sinClose(1.2);
    await this.sinSay('sinQw1', [['what', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.gClose(wps[1], 1.4, -0.3, 30);
    wps[1].gu.uHandL.value = 1;
    wps[1].bl.play('decree');
    await this.gSay('wpn2', wps[1], [['older', () => wps[1].anim.gesture('beat', 0.6, 0.5)]]);
    setTimeout(() => (wps[1].gu.uHandL.value = 0), 1200);
    // the ring, out of the molten light
    const ring = sin.ring;
    q.scene.attach(ring);
    fearRing(ring);
    ring.visible = true;
    const glow = fearGlow(ring);
    const from = F.clone().setY(2.4), hover = sinAt.clone().add(V(0, 1.75, -0.9));
    ring.position.copy(from);
    director.cut(F.clone().add(V(4.2, 2.8, 6.4)), F.clone().setY(3.4), 36);
    q.forgeU.uHeat.value = 1.4;
    audio.riser?.(2.4, 0.3);
    await tween(1.8, (k) => { ring.position.lerpVectors(from, from.clone().setY(4.2), ease.out(k)); ring.rotation.y += 0.06; glow.set(0.5 + k * 1.5); });
    await this.gClose(wps[0], 1.2, -0.2, 30);
    for (const g of wps) { g.gu.uHandL.value = 1; g.bl.play('decree'); }
    setTimeout(() => { for (const g of wps) g.gu.uHandL.value = 0; }, 2400);
    await this.gSay('wpn3', wps[0]);
    // to his hand
    const fwd = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), sh = new THREE.Vector3();
    sin.bl.hold('R', true);
    sin.anim.reach('R', () => sin.rig.bonePosition('upperArm_R', sh).addScaledVector(fwd, 0.5).add(V(0, -0.05, 0)), { pole: V(-0.6, -0.8, 0).applyAxisAngle(_Y, sin.yaw), rate: 2.5 });
    director.cut(sinAt.clone().addScaledVector(fwd, 2.4).add(V(-1.0, 1.5, 0)), sinAt.clone().addScaledVector(fwd, 0.5).add(V(0, 1.35, 0)), 34);
    const r0 = ring.position.clone(), hand = new THREE.Vector3();
    await tween(1.4, (k) => { sin.rig.bones.hand_R.getWorldPosition(hand); ring.position.lerpVectors(r0, hand, ease.inOut(k)); ring.rotation.y += 0.08; });
    glow.set(0.6);
    this.attachRing(ring, sin.rig);
    audio.ringChime();
    await this.sinClose(1.0);
    await this.sinSay('sinQw2', [['never', () => sin.anim.gesture('beat', 0.6, 0.5)]]);
    sin.anim.reach('R', null, { rate: 3 });
    sin.bl.hold('R', false);
    // the colour of fear, up him from his feet
    director.cut(sinAt.clone().addScaledVector(fwd, 4.2).add(V(1.4, 1.2, 0)), sinAt.clone().add(V(0, 1.0, 0)), 40);
    audio.dissolve();
    audio.whoosh(2.0, 0.35);
    this.engine.gradeUniforms.uFlashColor.value.setRGB(1.8, 1.3, 0.3);
    this.engine.gradeUniforms.uFlash.value = 0.15;
    tween(0.6, (k) => (this.engine.gradeUniforms.uFlash.value = 0.15 * (1 - k)));
    await tween(2.4, (k) => { yellowLantern(sin.rig, ease.inOut(k)); this.drainSuit(sin.rig, 1 - k); }, ease.linear);
    sin.turnYellow();
    sin.rig.su.uEyeGlow.value = 1.4;
    sin.rig.u.uGlow.value = 0.7;
    director.move(sinAt.clone().addScaledVector(fwd, 3.0).add(V(0.8, 1.6, 0)), sinAt.clone().add(V(0, 1.55, 0)), 2.2, ease.inOut, 36);
    sin.anim.gesture('chin', 1.2, 0.5);
    await this.sinSay('sinQw3', [['throat', () => sin.anim.gesture('beat', 0.6, 0.5)]]);
    // Hal, at the edge
    choir.level(0.02, 1);
    director.cut(player.position.clone().add(V(1.0, 1.65, 1.8)), player.position.clone().add(V(0, 1.6, -3)), 40);
    await player.walkTo(LANDING.clone().add(V(-1.5, 0, 1)), player.walkSpeed);
    await this.halClose(0.9);
    await this.say('halQ3');
    // he turns
    const sy = sin.yaw, s1 = yawTo(sinAt, player.position);
    await tween(0.8, (k) => { sin.yaw = sy + wrap(s1 - sy) * ease.inOut(k); sin.place(sinAt, sin.yaw); });
    sin.bl.lookHome = () => this.headOf(player.rig);
    await this.sinClose(1.1);
    await this.sinSay('sinQw4', [['Brave', () => sin.anim.gesture('tilt', 1, 0.4)], ['stupid', 'dismiss']]);
    // a fist of the yellow light, and Hal on his back
    sin.fist.visible = true;
    sin.fist.userData.set('uForm', 1);
    const a = sinAt.clone().add(V(0, 1.6, 0)), b = player.position.clone().add(V(0, 1.2, 0));
    director.cut(player.position.clone().add(V(4.5, 2.2, 3.5)), a.clone().lerp(b, 0.5), 50);
    audio.whoosh(0.6, 0.8);
    await tween(0.35, (k) => { sin.fist.position.lerpVectors(a, b, k); sin.fist.quaternion.setFromUnitVectors(_Zf, b.clone().sub(a).normalize()); }, ease.in);
    audio.explosion(0.6);
    director.shake(0.8, 0.6);
    this.engine.gradeUniforms.uFlash.value = 0.25;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.25 * (1 - k)));
    player.animator.play(still(POSES.kneel, 0.6), 0.15);
    const p0 = player.object.position.clone(), p1 = p0.clone().add(b.clone().sub(a).setY(0).normalize().multiplyScalar(3));
    tween(0.4, (k) => player.object.position.lerpVectors(p0, p1, ease.out(k)));
    tween(0.5, (k) => sin.fist.userData.set('uForm', 1 - k)).then(() => (sin.fist.visible = false));
    await wait(0.9);
    await this.sinClose(1.0, -1);
    await this.sinSay('sinQw5', [['mine', () => sin.anim.gesture('chin', 1, 0.4)]]);
    // up the column, into a breach of his own
    const top = F.clone().setY(46);
    const out = this.openRift(q, top, 6, 1, { palette: 'antimatter' });
    audio.rift(true);
    sin.anim.play(sin.flyGen, 0.3);
    director.cut(F.clone().add(V(10, 3, 20)), F.clone().setY(18), 56);
    tween(1.2, (k) => (out.open = ease.out(k)));
    const sp = sin.position.clone();
    audio.whoosh(2.0, 0.5);
    await tween(2.2, (k) => { sin.place(sp.clone().lerp(top, ease.in(k)), sin.yaw); sin.flyState.k = Math.min(1, k * 2); director.look.lerp(sin.position.clone().add(V(0, 1, 0)), 0.15); }, ease.linear);
    sin.object.visible = false;
    sin.place(V(0, -80, 0), 0);
    this.standDown();
    choir.stop(2);
    this.ringSay('ringQ3');
    powers.markerTarget = { pos: top, label: 'The breach' };
    this.giveControl('Follow Sinestro through the breach');
    await waitFor(() => player.position.distanceTo(top) < 8);
    powers.markerTarget = null;
    this.takeControl();
    audio.whoosh(1.4, 0.6);
    this.engine.gradeUniforms.uFlashColor.value.setRGB(1.2, 0.7, 1.8);
    await tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = k));
    out.close();
    q.updaters.splice(q.updaters.indexOf(wTick), 1);
    for (const g of wps) g.root.removeFromParent();
    this.thunder?.clear();
  }

  // the light gone out of his uniform (k 1), as on the dais when the ring was taken, or back (k 0)
  drainSuit(rig, k) {
    rig.suitFull ??= { glow: rig.u.uGlow.value, suit: rig.su.uSuit.value.clone(), rough: rig.u.uRoughMin.value, lit: rig.meshes.map((m) => m.material.emissiveIntensity) };
    const f = rig.suitFull;
    rig.u.uGlow.value = f.glow * (1 - k);
    rig.su.uSuit.value.copy(f.suit).multiplyScalar(1 - 0.45 * k);
    rig.meshes.forEach((m, i) => (m.material.emissiveIntensity = f.lit[i] * (1 - 0.9 * k)));
    rig.u.uRoughMin.value = f.rough + (0.85 - f.rough) * k;
  }

  // ---------------------------------------------------------------- 6. the yellow light
  // Korugar, an hour on. The plaza empty round the fallen statue; Katma alone there when he comes
  // down out of the dark in yellow. He strikes her down. Hal through the breach after him; the fight
  // (his fear made into light: the F-104 that killed Hal's father, diving at him). Halfway, he cages
  // Hal and asks him what the light asked him the first night: are you afraid? No is a lie he can
  // taste. Yes, and I fly anyway: the ring's answer, and the cage breaks. Beaten, he tears his way
  // back into the dark: it isn't over. On Oa, something stirs in the Central Battery.
  async yellowLight() {
    const { ui, director, audio, player, powers, hud } = this;
    this.lanternUp();
    await loadProps(['f104']);
    const kor = this.setupKorugar();
    kor.night(true);
    kor.fallen();
    for (const m of [kor.crowdDown, kor.crowdUp, kor.forecourt?.down, kor.forecourt?.up]) if (m) m.visible = false;
    ui.clock(this.save.info('yellow').clock);
    const halAt = V(-3, 0, 24);
    this.enterKorugar(halAt, Math.PI);
    this.takeControl();
    this.ambience(audio.wind(0.05), audio.pad([51.9, 61.7, 77.8], 0.025, { cutoff: 320 }));
    const ch = this.assets.characters;
    const katAt = V(3.5, 0, 12);
    const katma = (this.katma = this.addPerson(kor, createKatma(ch.katma, { uniform: true }), katAt, Math.PI));
    katma.held = true;
    this.attachRing(createRing(), katma.rig);
    const sin = (this.sin = this.addSinestroAt(kor, [...kor.blocks, { x: 0, z: 0, r: 9.6, h: 6.2 }], { health: 680, yieldAt: 0.3, arena: 30 }));
    yellowLantern(sin.rig, 1);
    fearRing(sin.ring);
    sin.turnYellow();
    sin.rig.su.uEyeGlow.value = 1.4;
    sin.rig.u.uGlow.value = 0.7;
    const sinAt = V(0, 8.2, 1.5);
    sin.place(sinAt, 0);
    sin.anim.play(sin.flyGen, 0);
    sin.flyState.k = 0;
    sin.bl.lookHome = () => () => katma.head();
    katma.anim.lookAt(() => sin.rig.bonePosition('head', _k), 0.8);
    katma.rig.root.rotation.y = yawTo(katAt, sinAt);
    player.place(V(0, -40, 60), Math.PI); // (out of sight until he comes through)
    director.cut(V(6, 3.0, 22), V(0, 7, 2), 44);
    // (out of the breach's flash, played on from Qward: nothing else fades it)
    const g = this.engine.gradeUniforms, f0 = g.uFlash.value;
    tween(1.0, (k) => (g.uFlash.value = f0 * (1 - k))).then(() => g.uFlashColor.value.setRGB(0.55, 1.6, 0.75));
    await ui.fade(0, 1.2);
    director.move(V(4.5, 2.2, 17), V(1, 6, 4), 5, ease.inOut, 40);
    await this.sinClose(1.4);
    await this.sinSay('sinY1', [['Look', 'present'], ['afraid', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.katmaClose(1.0, 1, 32);
    await this.katmaSay('katmaY1');
    await this.sinClose(1.0, -1);
    await this.sinSay('sinY2');
    // his light, and she's down
    sin.fist.visible = true;
    sin.fist.userData.set('uForm', 1);
    const fa = sinAt.clone().add(V(0, 1.4, 0)), fb = katAt.clone().add(V(0, 1.1, 0));
    director.cut(katAt.clone().add(V(-5, 1.8, 5)), fa.clone().lerp(fb, 0.6), 48);
    audio.whoosh(0.6, 0.8);
    await tween(0.3, (k) => { sin.fist.position.lerpVectors(fa, fb, k); sin.fist.quaternion.setFromUnitVectors(_Zf, fb.clone().sub(fa).normalize()); }, ease.in);
    audio.explosion(0.5);
    director.shake(0.6, 0.5);
    katma.anim.play(still(POSES.kneel, 0.5), 0.15);
    katma.anim.lookAt(null);
    const k0 = katma.rig.root.position.clone();
    tween(0.45, (k) => katma.rig.root.position.lerpVectors(k0, k0.clone().add(V(0.6, 0, 3.4)), ease.out(k)));
    tween(0.5, (k) => sin.fist.userData.set('uForm', 1 - k)).then(() => (sin.fist.visible = false));
    await wait(0.9);
    // Hal, out of the dark over the plaza
    const mouth = V(0, 30, 42);
    const rift = this.openRift(kor, mouth, 6, 1, { palette: 'antimatter' });
    rift.open = 1;
    audio.rift(true);
    this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    player.place(halAt, Math.PI);
    director.cut(halAt.clone().add(V(2.5, 1.4, -4.5)), halAt.clone().add(V(0, 1.2, 0)), 46);
    player.animator.play(still(POSES.land, 0.5), 0.05);
    audio.land(0.6);
    powers.dustFx?.(halAt.clone(), 26, 2.4);
    wait(1.0).then(async () => { await tween(1, (k) => (rift.open = 1 - k)); rift.close(); });
    await wait(0.7);
    this.standDown();
    sin.bl.lookHome = () => this.headOf(player.rig);
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    await this.halClose(1.0);
    await this.say('halY1');
    await this.sinClose(1.2);
    await this.sinSay('sinY3', [['will', 'ring'], ['feel', () => sin.anim.gesture('beat', 0.6, 0.5)]]);
    // the fight
    player.lookAt(null);
    powers.setCharge(100);
    powers.health = powers.maxHealth;
    sin.engage();
    Object.assign(powers, { healDelay: 7, healRate: 3 });
    sin.onQuip = (kind) => {
      if (kind === 'fear') this.quip('sinYq3', 0.9, [], sin.bl);
      else if (kind === 'slam') this.quip('sinYq1', 0.6, [], sin.bl);
      else if (kind === 'parried' || kind === 'dodge') this.quip(['sinYq2', 'sinYq4'][Math.floor(Math.random() * 2)], 0.3, [], sin.bl);
    };
    sin.onHurtHal = () => this.quip('sinYq2', 0.25, [], sin.bl);
    this.giveControl('Stop Sinestro');
    hud.tutorial({ kicker: 'The Yellow Lantern', n: 1, of: 1, title: 'Sinestro', html: 'His fight is the one you learned on the range, in yellow: <b>block, then strike</b>. A <b>jet</b> forming in the sky is his fear made into light: it dives through the ring marked on the ground. Shield it as it arrives, or get out of its way.' });
    wait(10).then(() => hud.tutorial(null));
    hud.boss('Sinestro', 1, 0.3);
    const bar = onFrame(() => hud.boss('Sinestro', sin.health, 0.3));
    await waitFor(() => sin.health < 0.62 && !sin.committed());
    await this.afraid(sin);
    sin.engage();
    this.giveControl('Stop Sinestro');
    await new Promise((resolve) => (sin.onYield = resolve));
    Object.assign(powers, { healDelay: 4, healRate: 8 });
    bar();
    hud.boss(null);
    this.takeControl();
    powers.holster();
    await this.touchDown();
    // beaten; back into the dark (out in the open first, away from the pedestal and the statue, so
    // the shots of him going aren't through them)
    sin.disengage();
    const hp0 = player.position.clone(), out0 = hp0.clone().sub(V(0, 0, 10)).setY(0);
    if (out0.length() < 1) out0.set(1, 0, 0);
    out0.normalize();
    const sp = hp0.clone().addScaledVector(out0, 6).setY(0);
    if (sp.length() > 26) sp.setLength(26); // (on the plaza's dark stone, not out on the pale street)
    { const s0 = sin.position.clone(); sin.anim.play(sin.flyGen, 0.3); await tween(1.0, (k) => sin.place(s0.clone().lerp(sp, ease.inOut(k)), sin.yaw)); }
    sin.place(sp, yawTo(sp, player.position));
    sin.anim.play(sin.flyGen, 0.4);
    sin.flyState.k = 0;
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    player.turnTo(yawTo(player.position, sp));
    await this.sinClose(1.2);
    await this.sinSay('sinY7', [['waits', () => sin.anim.gesture('chin', 1, 0.4)]]);
    const fwd = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), back = sp.clone().addScaledVector(fwd, -2).add(V(0, 1.4, 0));
    const out = this.openRift(kor, back, 2.2, 1, { palette: 'antimatter' });
    audio.rift(true);
    { const side = V(fwd.z, 0, -fwd.x), a = sp.clone().addScaledVector(fwd, 4.5).addScaledVector(side, 2.5), b = sp.clone().addScaledVector(fwd, 4.5).addScaledVector(side, -2.5); director.cut((a.distanceTo(V(0, 0, 10)) > b.distanceTo(V(0, 0, 10)) ? a : b).add(V(0, 1.5, 0)), back, 44); }
    await tween(1.0, (k) => (out.open = ease.out(k)));
    const u = sin.rig.u, a = sin.position.clone();
    u.uEdgeColor.value.setRGB(3, 2, 0.4);
    u.uDissolveOn.value = 1;
    u.uDissolveSign.value = -1;
    audio.whoosh(2, 0.4);
    await tween(1.8, (k) => { sin.place(a.clone().lerp(back.clone().addScaledVector(fwd, -0.5), ease.in(k)), sin.yaw); u.uDissolve.value = 1.1 - k * 1.2; }, ease.linear);
    sin.object.visible = false;
    sin.place(V(0, -60, 0), 0);
    await tween(0.7, (k) => (out.open = 1 - k));
    out.close();
    // Katma, up again, and over to him
    katma.anim.play(katma.loco, 0.6);
    katma.held = false;
    katma.home = player.position.clone().add(V(2.0, 0, 1.4));
    { const hp = player.position, kp = katma.rig.root.position, mid = hp.clone().lerp(kp, 0.5), d = kp.clone().sub(hp).setY(0).normalize(), sd = V(d.z, 0, -d.x);
      const a = mid.clone().addScaledVector(sd, 6), b = mid.clone().addScaledVector(sd, -6); // (the side away from the statue)
      director.cut((a.distanceTo(V(0, 0, 10)) > b.distanceTo(V(0, 0, 10)) ? a : b).add(V(0, 1.7, 0)), mid.clone().add(V(0, 1.2, 0)), 46); }
    await Promise.race([waitFor(() => katma.rig.root.position.distanceTo(katma.home) < 0.15), wait(7)]);
    katma.held = true;
    katma.rig.root.rotation.y = yawTo(katma.rig.root.position, player.position);
    katma.anim.lookAt(this.headOf(player.rig), 0.7);
    player.turnTo(yawTo(player.position, katma.rig.root.position));
    player.lookAt(() => katma.head(), 0.8);
    await this.katmaClose(1.2, 1, 32);
    await this.katmaSay('katmaY2');
    await this.halClose(1.0);
    await this.say('halY4');
    await ui.fade(1, 1.6);
    await this.sting();
    const pick = await ui.screen({ kicker: 'Part Six · Exile', title: 'THE YELLOW LIGHT', subtitle: 'Part Six complete', body: 'Sinestro has the Weaponers’ ring, and somewhere in the dark he is waiting. Katma Tui holds Korugar. The ring is yours to take anywhere.', buttons: ['Free roam', 'Quit to title'] });
    if (pick === 0) { RoamSave.resumeAfterReload('world'); await new Promise(() => {}); return; } // (free roam: its own, not this part's)
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  }

  // Halfway: the cage, and the question.
  async afraid(sin) {
    const { ui, director, audio, player, powers } = this;
    this.takeControl();
    powers.holster();
    sin.disengage();
    await this.touchDown();
    const hp = player.position.clone();
    const yawS = yawTo(hp, sin.position.clone().setY(0)), fw = V(Math.sin(yawS), 0, Math.cos(yawS));
    const sAt = hp.clone().addScaledVector(fw, 4.2);
    sin.place(sAt, yawTo(sAt, hp));
    sin.anim.play(sin.standGen, 0.5);
    player.turnTo(yawS);
    // bars of yellow light round him, from the ground up
    const cage = this.cage();
    cage.position.copy(hp);
    this.kor.scene.add(cage);
    audio.constructForm(1.0);
    audio.shieldUp?.();
    director.cut(hp.clone().addScaledVector(fw, -3.2).add(V(1.4, 1.8, 0)), hp.clone().addScaledVector(fw, 2).add(V(0, 1.4, 0)), 44);
    await tween(0.9, (k) => cage.userData.set('uForm', k));
    const cageT = onFrame(() => cage.userData.set('uTime', this.engine.time));
    // his fear in the sky behind Sinestro: the jet, falling, as it fell twenty years ago
    const jet = sin.jet;
    let fall = null;
    if (jet) {
      jet.visible = true;
      jet.userData.set('uForm', 1);
      const j0 = sAt.clone().addScaledVector(fw, 70).add(V(-30, 50, 0));
      fall = onFrame((dt) => { j0.addScaledVector(_e.set(0.6, -0.5, 0), dt * 18); jet.position.copy(j0); jet.rotation.set(0.5, 1.2, this.engine.time * 1.5); });
    }
    tween(1.5, (k) => (this.engine.gradeUniforms.uDream.value = 0.55 * k));
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    sin.bl.lookHome = () => this.headOf(player.rig);
    await this.sinClose(1.2);
    await this.sinSay('sinY4', [['first', () => sin.anim.gesture('tilt', 1, 0.3)]]);
    await this.sinClose(1.4, -1);
    // (Hal's own shots from inside the bars: from outside, they stand across his face)
    const inCage = (side, d = 1.0) => director.move(hp.clone().addScaledVector(fw, 0.95).addScaledVector(V(fw.z, 0, -fw.x), 0.28 * side).add(V(0, 1.58, 0)), hp.clone().add(V(0, 1.62, 0)), d, ease.inOut, 38);
    for (let first = true; ; first = false) {
      await this.sinSay(first ? 'sinY5' : 'sinYAgain');
      director.cut(hp.clone().addScaledVector(fw, 0.9).add(V(0.15, 1.6, 0)), hp.clone().add(V(0, 1.62, 0)), 34);
      const answer = await ui.choice('ARE YOU AFRAID?', ['YES', 'NO']);
      if (answer === 0) break;
      // a lie: the bars close on him
      await this.sinSay('sinYNo');
      audio.strain(1.4, 0.35);
      director.shake(0.5, 0.6);
      player.animator.play(still(POSES.kneel, 0.6), 0.3);
      await tween(0.7, (k) => cage.scale.set(1 - 0.3 * Math.sin(k * Math.PI), 1, 1 - 0.3 * Math.sin(k * Math.PI)));
      powers.damage(12);
      await wait(0.8);
      this.standDown();
      await this.sinClose(1.0, -1);
    }
    // the truth, and the ring's answer
    await inCage(1);
    player.animator.gesture('nod', 1.0, 0.4);
    await this.say('halY2');
    await inCage(-1, 1.2);
    await this.say('halY3');
    this.ringGlow = 6;
    audio.ringChime();
    audio.riser?.(1.4, 0.3);
    tween(0.8, (k) => (this.engine.gradeUniforms.uDream.value = 0.55 * (1 - k)));
    this.engine.gradeUniforms.uFlashColor.value.setRGB(0.55, 1.6, 0.75);
    this.engine.gradeUniforms.uFlash.value = 0.6;
    tween(0.8, (k) => (this.engine.gradeUniforms.uFlash.value = 0.6 * (1 - k)));
    director.cut(hp.clone().addScaledVector(fw, -5).add(V(2, 2.4, 0)), hp.clone().add(V(0, 1.4, 0)), 48);
    audio.explosion(0.5);
    director.shake(0.7, 0.5);
    this.kor.physics.burst(hp, 5, 6, 2, 0.5);
    powers.dustFx(hp.clone(), 40, 4);
    if (jet) { fall?.(); jet.visible = false; }
    tween(0.4, (k) => cage.userData.set('uForm', 1 - k)).then(() => { cageT(); cage.removeFromParent(); });
    // (knocked back off his feet by it)
    const s0 = sin.position.clone(), s1 = s0.clone().addScaledVector(fw, 4);
    tween(0.5, (k) => sin.place(s0.clone().lerp(s1, ease.out(k)), sin.yaw));
    this.ringSay('ringY');
    powers.setCharge(100);
    powers.health = powers.maxHealth;
    await wait(0.9);
    this.ringGlow = 0.6;
    await this.sinClose(1.0);
    await this.sinSay('sinY6');
  }

  // a cage of the yellow light, Hal's height, open to the camera between its bars
  cage() {
    const parts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6).translate(Math.sin(a) * 1.35, 1.35, Math.cos(a) * 1.35));
    }
    for (const y of [0.06, 2.62]) parts.push(new THREE.TorusGeometry(1.35, 0.06, 6, 48).rotateX(Math.PI / 2).translate(0, y, 0));
    const m = fearLight(constructMesh(mergeGeometries(parts), { uPattern: 0, outline: 0.012 }));
    m.userData.set('uForm', 0);
    return m;
  }

  // On Oa, after: the Central Battery's light, and inside it something moving. (Parallax: the user's
  // call, 2026-11-17, a hint in this part, the model later: a shape in the light and two eyes.)
  async sting() {
    const { director, audio, ui } = this;
    const oa = this.setupOa();
    this.playerActive = false;
    this.show(oa);
    // (the exposure down while the Battery fills the frame: at the scene's own, its light clips to white
    // and nothing in front of it reads)
    const renderer = this.engine.renderer, exp0 = renderer.toneMappingExposure;
    renderer.toneMappingExposure = exp0 * 0.42;
    // (the lens is 54 m across, set about 60 m out from the globe's centre toward the range: from far
    // enough off that it doesn't fill the frame, or the bloom whites it out)
    const toRange = V(0, 0, 0).sub(BATTERY).setY(0).normalize(), sideways = V(toRange.z, 0, -toRange.x);
    const lens = BATTERY.clone().addScaledVector(toRange, 62);
    const shape = parallaxShadow();
    shape.scale.setScalar(2.6);
    shape.position.copy(lens).addScaledVector(toRange, 6).addScaledVector(sideways, -50).add(V(0, -6, 0));
    shape.lookAt(shape.position.clone().add(toRange));
    oa.scene.add(shape);
    director.cut(lens.clone().addScaledVector(toRange, 330).add(V(0, 14, 0)), lens, 26);
    const hum = audio.pad([36.7, 43.7, 55], 0, { cutoff: 220, fadeIn: 2 });
    hum.level(0.06, 2);
    await ui.fade(0, 1.4);
    director.move(lens.clone().addScaledVector(toRange, 280).add(V(0, 10, 0)), lens, 12, ease.inOut, 25);
    this.say('gSting1', { name: 'The Guardians' });
    const p0 = shape.position.clone(), eyes = shape.userData.eyes;
    await tween(7.0, (k) => { shape.position.copy(p0).addScaledVector(sideways, 85 * k).add(V(0, 4 * Math.sin(k * 3), 0)); shape.userData.opacity(Math.sin(Math.min(1, k * 1.15) * Math.PI)); }, ease.linear);
    await this.say('gSting2', { name: 'The Guardians' });
    // the eyes, opening, looking out of the light
    eyes.position.copy(lens).addScaledVector(toRange, 8).add(V(0, 2, 0));
    eyes.scale.setScalar(6);
    oa.scene.add(eyes);
    audio.heartbeat?.(0.6);
    await tween(2.0, (k) => eyes.userData.open(k));
    this.ringSay('ringSting');
    await wait(2.4);
    await tween(0.6, (k) => eyes.userData.open(1 - k));
    hum.stop(2);
    await ui.fade(1, 1.4);
    renderer.toneMappingExposure = exp0;
    shape.removeFromParent();
    eyes.removeFromParent();
  }

  // A hand raised to a spot in someone's own frame (metres from the rest pose's shoulder: +x their
  // left, +y up, +z ahead), along an eased path from where it is now, then held there still. Tied to
  // the body's root, not to the shoulder bone (the idle's sway moved the hand with it), and short of a
  // straight arm (near full reach a two-bone elbow swings on the least change). `pole` is in their frame.
  steadyHand(p, side, offset, { dur = 0.8, pole = V(-0.4, -1, -0.2) } = {}) {
    const root = () => (p.rebel ?? p.rig).root, rest = p.rig.restPos[`upperArm_${side}`];
    const start = root().worldToLocal(p.rig.bonePosition(`hand_${side}`, V(0, 0, 0)));
    const end = rest.clone().add(offset), cur = start.clone(), out = V(0, 0, 0);
    const poleW = pole.clone().applyAxisAngle(_Y, root().rotation.y);
    p.anim.reach(side, () => root().localToWorld(out.copy(cur)), { pole: poleW, rate: 16 });
    return tween(dur, (k) => cur.lerpVectors(start, end, ease.inOut(k)), ease.linear);
  }

  // Someone to talk to who stays put (Katma on Korugar): their lines in turn.
  addTalker(kor, rig, at, yaw, lines) {
    const p = this.addPerson(kor, rig, at, yaw);
    p.held = true;
    let i = 0;
    kor.interact({ position: at, radius: 2.4, look: at.clone().setY(1.6), label: 'Talk', action: async () => {
      p.anim.lookAt(this.headOf(this.player.rig), 0.8);
      p.rig.root.rotation.y = Math.atan2(this.player.position.x - at.x, this.player.position.z - at.z);
      this.speakingRig = p.rig;
      await this.say(lines[i++ % lines.length], { skip: false });
      this.speakingRig = null;
    } });
    return p;
  }

  // Katma Tui in the Hall: in the resistance's colours, and (hidden until the ring comes to her) in
  // the uniform it gives her, the same body on one animator. Built like Probation.addPerson, but the
  // body she wears can change (`wear`); her head and her rig follow it.
  addHallKatma(at, yaw) {
    const gl = this.assets.characters.katma;
    if (!gl) return null;
    const oa = this.oa, rebel = createKatma(gl), lantern = createKatma(gl, { uniform: true });
    for (const r of [rebel, lantern]) { r.root.position.copy(at); r.root.rotation.y = yaw; oa.scene.add(r.root); }
    lantern.root.visible = false;
    const anim = new Animator(rebel), loco = new Locomotion(this.mocap);
    loco.scale = rebel.hipsHeight / this.mocap.hipsHeight;
    loco.relax.adduct = 0.1;
    anim.play(loco, 0);
    anim.look.maxYaw = 0.7;
    anim.addRig(lantern);
    const h = new THREE.Vector3();
    const k = { rig: rebel, rebel, lantern, anim, loco, held: true, home: at.clone(), head: () => k.rig.bonePosition('head', h), setYaw: (y) => { rebel.root.rotation.y = lantern.root.rotation.y = y; } };
    // (both bodies stand where the first one stands: turn her by `rebel.root`)
    oa.updaters.push((dt) => { if (!this.hallActive) return; lantern.root.position.copy(rebel.root.position); lantern.root.rotation.copy(rebel.root.rotation); anim.update(dt); });
    return k;
  }

  // The ring taken: it flares and draws his hand out toward the Guardians, slides off his finger and
  // hangs in the air before him; the light goes out of his uniform.
  async ringTaken(sin, sinAt, elderHead) {
    const { director, audio } = this, oa = this.oa, ring = sin.ring;
    const fwd = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), side = V(fwd.z, 0, -fwd.x);
    const shoulder = new THREE.Vector3(), out = new THREE.Vector3();
    sin.bl.hold('R', true);
    sin.anim.reach('R', () => sin.rig.bonePosition('upperArm_R', shoulder).addScaledVector(fwd, 0.58).add(V(0, 0.12, 0)), { pole: V(-0.6, -0.8, 0).applyAxisAngle(V(0, 1, 0), sin.yaw), rate: 2.2 });
    const glow = (this.takenGlow = this.ringLight(ring));
    director.cut(sinAt.clone().addScaledVector(side, -2.0).addScaledVector(fwd, 1.4).add(V(0, 1.6, 0)), sinAt.clone().addScaledVector(fwd, 0.5).add(V(0, 1.45, 0)), 34);
    audio.riser?.(2.4, 0.3);
    await tween(1.6, (k) => { for (const m of ring.userData.materials) m.emissiveIntensity = 1.6 + k * 4; glow.set(0.4 + k * 1.2); });
    await this.sinSay('sinTri4', [['given', () => sin.anim.gesture('shake', 1, 0.4)]]);
    // off the finger, and out before him
    const from = ring.getWorldPosition(new THREE.Vector3()), hover = sinAt.clone().addScaledVector(fwd, 1.0).add(V(0, 1.75, 0));
    oa.scene.attach(ring);
    audio.constructForm?.(0.6);
    sin.anim.reach('R', null, { rate: 3 });
    sin.bl.hold('R', false);
    director.move(hover.clone().addScaledVector(fwd, 0.9).addScaledVector(side, 0.25).add(V(0, 0.05, 0)), hover.clone().addScaledVector(fwd, -0.4), 1.8, ease.inOut, 30);
    await tween(1.4, (k) => { ring.position.lerpVectors(from, hover, ease.inOut(k)); ring.rotation.y += 0.05; });
    this.ringHover = onFrame((dt) => { ring.rotation.y += dt * 1.2; ring.position.y = hover.y + Math.sin(this.engine.time * 2) * 0.02; });
    // the light leaves him
    // (the scan's own lit panels too: its emissive, his materials being his own clones)
    const g0 = sin.rig.u.uGlow.value, e0 = sin.rig.su.uEyeGlow.value, suit0 = sin.rig.su.uSuit.value.clone();
    const lit = sin.rig.meshes.map((m) => [m.material, m.material.emissiveIntensity]), r0 = sin.rig.u.uRoughMin.value;
    tween(2.0, (k) => {
      sin.rig.u.uGlow.value = g0 * (1 - k);
      sin.rig.su.uEyeGlow.value = e0 * (1 - 0.5 * k);
      sin.rig.su.uSuit.value.copy(suit0).multiplyScalar(1 - 0.45 * k);
      for (const [m, e] of lit) m.emissiveIntensity = e * (1 - 0.9 * k);
      sin.rig.u.uRoughMin.value = r0 + (0.85 - r0) * k; // (and the sheen goes out of it)
    });
    await wait(0.6);
    await this.sinClose(1.2, -1);
    sin.anim.gesture('beat', 0.8, 0.6);
    await this.sinSay('sinTri5');
  }

  // A small light that travels with the ring (its own glow is a few millimetres across). set(k).
  ringLight(ring) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.5, 2.2, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.scale.setScalar(0.12);
    const light = new THREE.PointLight(0x55ff88, 0, 3, 2);
    ring.add(sprite, light);
    const s = 1 / Math.max(1e-3, ring.scale.x);
    return { set: (k) => { sprite.scale.setScalar(0.1 * k * s); light.intensity = k * 0.5; }, sprite, light };
  }

  // Through the dark: a rift into the antimatter universe tears open behind him, and takes him.
  async banish(sin, sinAt, choir) {
    const { director, audio } = this, oa = this.oa;
    const fwd = V(Math.sin(sin.yaw), 0, Math.cos(sin.yaw)), mouth = sinAt.clone().addScaledVector(fwd, -1.9).add(V(0, 1.35, 0));
    choir.level(0.02, 2);
    const hum = audio.pad([46.2, 69.3, 92.5], 0, { cutoff: 260, fadeIn: 1.5 });
    hum.level(0.07, 1.5);
    const rift = this.openRift(oa, mouth, 2.1, 1, { palette: 'antimatter' });
    // (from in front of him: Sinestro, the tear behind him, Hal and Katma either side of it)
    director.cut(sinAt.clone().addScaledVector(fwd, 4.6).add(V(0.4, 1.5, 0)), sinAt.clone().addScaledVector(fwd, -1.0).add(V(0, 1.35, 0)), 46);
    audio.rift(true);
    await tween(1.6, (k) => (rift.open = ease.out(k)), ease.linear);
    sin.bl.lookHome = () => this.headOf(this.player.rig);
    await wait(0.5);
    await this.sinClose(1.1);
    await this.sinSay('sinTri6', [['dark', () => sin.anim.gesture('chin', 1.1, 0.5)], ['not', () => sin.anim.gesture('beat', 0.6, 0.6)]]);
    // drawn back into it, dissolving at the edge of the dark
    director.cut(sinAt.clone().addScaledVector(fwd, 5.4).add(V(-1.2, 1.4, 0)), mouth.clone().addScaledVector(fwd, 0.4), 44);
    const u = sin.rig.u, a = sin.position.clone(), b = mouth.clone().addScaledVector(fwd, -0.3).add(V(0, -0.9, 0));
    u.uEdgeColor.value.setRGB(2.2, 1.6, 3.2);
    u.uDissolveOn.value = 1;
    u.uDissolveSign.value = -1;
    sin.anim.play(sin.flyGen, 0.6);
    audio.whoosh(2.4, 0.4);
    await tween(2.4, (k) => {
      const e = ease.in(k);
      sin.place(a.clone().lerp(b, e), sin.yaw);
      sin.flyState.k = 0.25 * k;
      u.uDissolve.value = 1.1 - k * 1.2;
      rift.flow = 1 + k * 2;
    }, ease.linear);
    sin.object.visible = false;
    sin.place(V(0, -60, 0), 0);
    await wait(0.4);
    audio.parry?.();
    this.engine.gradeUniforms.uFlash.value = 0.2;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.2 * (1 - k)));
    await tween(0.9, (k) => (rift.open = 1 - ease.in(k)), ease.linear);
    rift.close();
    hum.stop(2);
    choir.level(0.05, 3);
    await wait(1.0);
  }

  // Its own choice: the ring speaks, and goes to her; her hand comes up to meet it; the light sweeps
  // up over her and she's in the uniform.
  async ringChooses(katma, katAt) {
    const { director, audio } = this, ring = this.sin.ring;
    this.ringHover?.();
    const glow = this.takenGlow ?? this.ringLight(ring);
    glow.set(1.4);
    const from = ring.position.clone();
    { const kh0 = katma ? katma.head() : katAt.clone().setY(katAt.y + 1.6), away = from.clone().sub(kh0).normalize(), sd = V(away.z, 0, -away.x); director.cut(from.clone().addScaledVector(away, 1.1).addScaledVector(sd, 0.35).add(V(0, 0.08, 0)), from.clone().lerp(kh0, 0.45), 36); }
    await this.say('ringKatma', { name: 'The ring' });
    if (!katma) return;
    const toRing = from.clone().sub(katAt).setY(0).normalize();
    const yaw = Math.atan2(toRing.x, toRing.z);
    const y0 = katma.rebel.root.rotation.y;
    katma.anim.lookAt(() => ring.getWorldPosition(_r), 0.85);
    this.player.lookAt(() => ring.getWorldPosition(_r2), 0.7);
    // she turns to it first, then holds her hand out to it (the user: her hand was "shaky": it rose on
    // a slow creep while she was still turning, almost at full stretch, tied to her swaying shoulder):
    // in front of her at the height of her ribs, the elbow bent and down by her side, steady
    await tween(0.8, (k) => katma.setYaw(y0 + wrap(yaw - y0) * ease.inOut(k)));
    const kh = katma.head().clone();
    director.cut(kh.clone().addScaledVector(toRing, 1.9).add(V(0.6, -0.3, 0)).addScaledVector(V(toRing.z, 0, -toRing.x), 0.7), kh.clone().add(V(0, -0.35, 0)).addScaledVector(toRing, 0.2), 38);
    await this.steadyHand(katma, 'R', V(0.02, -0.24, 0.39), { dur: 0.9, pole: V(-0.35, -1, -0.25) });
    await wait(0.3);
    audio.whoosh(1.0, 0.3);
    // to the finger it goes on (where attachRing puts it), the last of the way slowing onto it
    const hb = katma.rig.bones.hand_R, finger = new THREE.Vector3(), fOff = katma.rig.arm.R.fore.clone().multiplyScalar(0.088 / katma.rig.root.scale.x);
    const q0 = ring.quaternion.clone(), qEnd = new THREE.Quaternion();
    await tween(1.4, (k) => {
      hb.localToWorld(finger.copy(fOff));
      const e = ease.inOut(k);
      ring.position.lerpVectors(from, finger, e).add(V(0, Math.sin(k * Math.PI) * 0.22, 0));
      hb.getWorldQuaternion(qEnd).multiply(_qr.setFromUnitVectors(_Zf, katma.rig.arm.R.fore));
      ring.quaternion.slerpQuaternions(q0, qEnd, ease.in(k));
      ring.rotateZ((1 - k) * 0.25);
    }, ease.linear);
    glow.set(0.5);
    ring.remove(glow.sprite, glow.light);
    this.attachRing(ring, katma.rebel);
    audio.ringChime();
    // the uniform, up from her feet
    const r = katma.rebel, l = katma.lantern;
    l.root.visible = true;
    r.u.uDissolveOn.value = 1; r.u.uDissolveSign.value = 1;
    l.u.uDissolveOn.value = 1; l.u.uDissolveSign.value = -1;
    audio.dissolve();
    audio.whoosh(1.8, 0.35);
    this.engine.gradeUniforms.uFlash.value = 0.12;
    tween(0.5, (k) => (this.engine.gradeUniforms.uFlash.value = 0.12 * (1 - k)));
    director.move(kh.clone().addScaledVector(toRing, 2.9).add(V(0, -0.5, 0)), kh.clone().add(V(0, -0.65, 0)), 1.9, ease.inOut, 40);
    await tween(1.8, (k) => { r.u.uDissolve.value = -0.1 + k * 1.25; l.u.uDissolve.value = -0.1 + k * 1.25; }, ease.inOut);
    l.u.uDissolveOn.value = 0;
    r.root.visible = false;
    r.u.uDissolveOn.value = 0;
    ring.removeFromParent();
    this.attachRing(ring, l);
    katma.rig = l;
    // she brings the hand in to look at the ring on it, then lets it down
    katma.anim.lookAt(() => l.bones.hand_R.getWorldPosition(_r).add(V(0, 0.06, 0)), 0.7);
    await this.steadyHand(katma, 'R', V(0.1, -0.12, 0.28), { dur: 0.8, pole: V(-0.4, -1, -0.2) });
    await wait(0.6);
    katma.anim.reach('R', null, { rate: 2.5 });
    await wait(0.4);
    await this.katmaClose(1.2, 1, 30);
    await this.katmaSay('katmaTri4');
    this.player.lookAt(() => katma.head(), 0.8);
    await this.halClose(1.0);
    await this.say('halTri3');
    katma.anim.lookAt(() => this.elder.bonePosition('head', _p).add(V(0, 0.08, 0)), 0.7);
    const yb = r.root.rotation.y;
    tween(0.8, (k) => katma.setYaw(yb + wrap(Math.PI - yb) * ease.inOut(k)));
  }
}

const _h = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3(), _r2 = new THREE.Vector3(), _g = new THREE.Vector3(), _k = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0), _Zf = new THREE.Vector3(0, 0, 1), _qr = new THREE.Quaternion();
// the fallen statue, to walk and fly round (Korugar.fallen: face down from z 5.6 to 19.6)
const FALLEN = [{ x: 0, z: 8, r: 2.4 }, { x: 0, z: 12.5, r: 2.4 }, { x: 0, z: 17, r: 2.4 }];

// A Lantern's ring in the yellow light: the Weaponers' ring for Sinestro (the same shape: ours).
function fearRing(ring) {
  const [metal, face] = ring.userData.materials;
  metal.color.set(0xffc230); metal.emissive.set(0xffa010);
  face.emissive.set(0xffd060);
  return ring;
}
// a glow that travels with it (its own is a few millimetres across)
function fearGlow(ring) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(undefined, 'rgba(255,255,255,0.3)'), color: new THREE.Color(2.4, 1.6, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const light = new THREE.PointLight(0xffb030, 0, 4, 2);
  ring.add(sprite, light);
  const s = 1 / Math.max(1e-3, ring.scale.x);
  return { set: (k) => { sprite.scale.setScalar(0.12 * k * s); light.intensity = k * 0.8; }, sprite, light };
}

// Something in the Battery's light (Parallax, before there's a model of it): a long segmented body
// with legs trailing, in silhouette, and later two eyes. opacity(k), eyes.userData.open(k).
function parallaxShadow() {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0x0a0602, transparent: true, opacity: 0, depthWrite: false, fog: false });
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10).scale(2.6 - i * 0.18, 1.7 - i * 0.12, 3.2), mat);
    seg.position.set(-i * 4.2, Math.sin(i * 0.8) * 1.2, 0);
    g.add(seg);
    if (i % 2 === 0 && i < 8) for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.ConeGeometry(0.35, 9, 6).translate(0, -4.5, 0), mat);
      leg.position.copy(seg.position);
      leg.rotation.set(s * 0.9, 0, -0.5 - i * 0.05);
      g.add(leg);
    }
  }
  g.renderOrder = 30;
  g.traverse((o) => (o.renderOrder = 30));
  g.userData.opacity = (k) => (mat.opacity = k);
  const eyes = new THREE.Group();
  // (on the lens's white-green light an additive glow vanishes: amber over a dark socket, drawn over it)
  const tex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.4)');
  const dark = new THREE.SpriteMaterial({ map: tex, color: 0x000000, depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false });
  const em = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.6, 0.9, 0.05), depthWrite: false, depthTest: false, transparent: true, opacity: 0, fog: false });
  for (const s of [-1, 1]) {
    const d = new THREE.Sprite(dark); d.position.set(s * 3.2, 0, 0); d.scale.set(8, 3.4, 1); d.renderOrder = 31; eyes.add(d);
    const e = new THREE.Sprite(em); e.position.set(s * 3.2, 0, 0.1); e.scale.set(5, 1.2, 1); e.renderOrder = 32; eyes.add(e);
  }
  eyes.userData.open = (k) => { em.opacity = k; dark.opacity = k * 0.85; for (const [i, e] of eyes.children.entries()) e.scale.y = (i % 2 ? 1.2 : 3.4) * (0.15 + k * 0.85); };
  g.userData.eyes = eyes;
  return g;
}
