import * as THREE from 'three';
import { wait, tween, ease, onFrame } from '../engine/Time.js';
import { POSES, still } from '../characters/Poses.js';
import { Space } from '../scenes/Space.js';
import { Hyperspace } from '../scenes/Hyperspace.js';
import { createShaft } from '../fx/GreenLight.js';
import { worldInfo } from '../ui/TravelHud.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SECTOR = { earth: '2814', oa: '0' };
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// A flight between worlds, as a cutscene in four parts (after the 93604faf space-flight reference):
//   launch    Hal punches up out of the sky he is flying in, trailing light, with a sonic boom
//   departure high orbit over the world he is leaving, the ring plotting the course
//   transit   hyperluminal: the streak tunnel, the flight readout counting down the distance
//   approach  the destination from orbit, then a dive into it
// It ends on a full green flash; the caller then brings Hal down into the destination scene.
// `long` is the story's first flight (more shots and lines); travel later is the short cut.
// `launch: false` starts in orbit (resuming the 'voyage' checkpoint).
export async function voyage(story, { from, to, long = false, launch = true }) {
  const { player, director, audio, engine, powers } = story;
  const grade = engine.gradeUniforms, hud = story.travelHud;
  const dest = worldInfo(to);
  story.takeControl();
  story.ui.objective(null);
  story.hud.tutorial(null);
  story.playerActive = false; // the cutscene owns Hal's body from here
  player.flying = false;
  player.autoAnim = false;
  player.lookAt(null);
  player.animator.reach('R', null);
  player.animator.reach('L', null);
  player.animator.lean.pitch = player.animator.lean.roll = player.animator.twist = 0;
  player.animator.feet.ground = null;
  player.pivot.quaternion.identity();
  player.pivot.position.y = 1;
  const animStop = onFrame((dt) => player.animator.update(dt));
  const o = player.object;
  try {
    if (launch) await launchOut(story);
    else { grade.uFlash.value = 1; story.ui.fade(0, 0.01); }
    powers.detach();
    player.removeFromPhysics();

    // ------------------------------------------------------------------ departure, in orbit
    const space = (story.space ??= new Space());
    space.show(from);
    space.earth.position.set(0, 0, 0);
    space.oa.position.set(0, 0, 0);
    space.oa.rotation.y = from === 'oa' ? Math.PI : 0; // leaving Oa, the planet is behind him
    story.show(space);
    space.scene.add(o);
    o.position.set(0, 0, 0);
    o.rotation.set(0, Math.PI, 0, 'YXZ');
    space.anchor = o.position;
    player.animator.play(still(POSES.hover, 0.5), 0.6);
    space.drift.set(0, 0, 0);
    hud.set({ mode: 'SUBLIGHT', speed: 0.08, rows: [['Route', `Sector ${SECTOR[from]} → Sector ${SECTOR[to]}`], ['Destination', dest.name], ['Distance', long ? '—' : 'plotting…']] });
    hud.show(true);
    const away = V(0, 0.35, -1).normalize(); // the way out, away from the planet
    const fadeIn = tween(0.9, (k) => (grade.uFlash.value = 1 - k), ease.out);
    audio.whoosh(2.2, 0.35);
    if (from === 'earth') {
      // over the night side: behind his shoulder, looking past him down the curve of the world
      director.cut(V(1.5, 1.7, 2.9), V(-1.4, -3.6, -9), 54);
      director.move(V(1.15, 1.5, 2.3), V(-1.4, -4.0, -9), long ? 5 : 2.6, ease.inOut, 52);
      player.lookAt(V(-2, -6, -8), 0.7);
      await fadeIn;
      if (long) {
        await wait(0.9);
        await story.say('halEarth', { hold: 0.6 });
        // the ring plots the course: his ring hand out toward the stars, the light gathering on it
        director.cut(V(-1.7, 1.75, -2.4), V(0, 1.5, -0.2), 40);
        director.move(V(-1.45, 1.7, -2.1), V(0, 1.55, -0.3), 4.2, ease.inOut, 38);
      } else await wait(0.6);
    } else {
      // Oa below and behind: up and away from the city-world
      director.cut(V(-1.6, 2.6, -3.4), V(0.4, 0, 6), 52);
      director.move(V(-1.3, 2.3, -2.8), V(0.4, -0.5, 6), 2.6, ease.inOut, 50);
      player.lookAt(V(0, -6, 4), 0.6);
      await fadeIn;
      await wait(0.4);
    }
    player.lookAt(null);
    const sh = new THREE.Vector3(), aim = V(0, 1.7, -4);
    player.animator.reach('R', () => { player.rig.bonePosition('upperArm_R', sh); return sh.add(aim.clone().sub(sh).normalize().multiplyScalar(0.62)); }, { pole: V(-0.4, -0.85, -0.3), rate: 4 });
    story.ringGlow = 6;
    audio.riser(long ? 3 : 1.6, 0.3);
    story.ringSay('ringOrbit');
    hud.set({ mode: 'COURSE LOCKED', rows: [['Route', `Sector ${SECTOR[from]} → Sector ${SECTOR[to]}`], ['Destination', dest.name], ['Distance', '18.6 MLY']], speed: 0.2 });
    await wait(long ? 3.0 : 1.2);

    // he tips forward into the flight and goes: the world falls away behind him
    director.cut(V(0.35, 1.9, 3.3), V(0, 1.2, -12), 56);
    player.animator.reach('R', null, { rate: 4 });
    player.flightState.k = 1;
    player.animator.play(player.flightGen, 0.5);
    const world = from === 'earth' ? space.earth : space.oa;
    audio.whoosh(1.8, 0.8);
    await tween(1.6, (k) => {
      o.rotation.set(1.45 * ease.inOut(Math.min(1, k * 1.6)), Math.PI, 0, 'YXZ');
      world.position.addScaledVector(away, -k * k * 6);
      space.drift.copy(away).multiplyScalar(k * k * 60);
      director.fov = 56 + 16 * k * k;
      hud.set({ speed: 0.2 + 0.4 * k });
    }, ease.linear);
    audio.whoosh(1.2, 0.9);
    await tween(0.35, (k) => (grade.uFlash.value = k * k), ease.linear);
    story.ringGlow = 0.6;

    // ------------------------------------------------------------------ hyperluminal transit
    const hs = new Hyperspace();
    story.show(hs);
    hs.scene.add(o);
    o.rotation.set(1.45, Math.PI, 0, 'YXZ');
    o.position.set(0, 0, 0);
    player.animator.update(0);
    o.position.sub(player.rig.bonePosition('hips', new THREE.Vector3()));
    hs.anchor.set(0, 0, 0);
    hs.warp = 0.9;
    hud.set({ mode: 'HYPERLUMINAL SPEED', speed: 1 });
    story.ringSay('ringJump');
    audio.burst({ buffer: audio.brownBuf, from: 220, to: 70, attack: 0.3, peak: 0.45, dur: long ? 8 : 4.5, wet: 0.4, rate: 0.6 });
    const total = 18.6e6, dur = long ? 7.2 : 3.6;
    let elapsed = 0;
    const count = onFrame((dt) => {
      elapsed += dt;
      const left = total * Math.max(0, 1 - elapsed / dur);
      hud.set({ rows: [['Velocity', '4.1 × 10⁶ c'], ['Destination', `${dest.name} · Sector ${SECTOR[to]}`], ['Distance', left > 1e5 ? `${(left / 1e6).toFixed(2)} MLY` : `${fmt(left)} LY`]] });
    });
    // close behind him, the streaks radiating from the vanishing point
    director.cut(V(0.2, 0.62, 2.0), V(0, 0.2, -30), 60);
    director.shake(0.08, dur);
    const fade2 = tween(0.5, (k) => (grade.uFlash.value = 1 - k), ease.out);
    await tween(long ? 3.4 : dur - 0.7, (k) => {
      hs.warp = 0.9 + 0.1 * k;
      director.fov = 60 + 8 * Math.min(1, k * 2);
      director.pos.set(0.2 + Math.sin(k * 6) * 0.1, 0.62 + Math.sin(k * 3.7) * 0.05, 2.0 - k * 0.25);
    }, ease.linear);
    await fade2;
    if (long) {
      // alongside him: the light streaming off his body
      director.cut(V(2.3, 0.35, -0.5), V(0, 0.1, -1.0), 48);
      const line = story.say('halFast', { hold: 0.5 });
      await tween(3.1, (k) => director.pos.set(2.3 - k * 0.35, 0.35 + Math.sin(k * 4) * 0.05, -0.5 - k * 0.6), ease.inOut);
      await line;
    }
    // the core blooms: dropping out of hyperspace
    audio.arrive();
    await tween(0.7, (k) => { hs.burst = k * k; hs.warp = 1 - k * 0.6; grade.uFlash.value = k * k; }, ease.linear);
    count();
    o.removeFromParent(); // keep Hal out of the transit scene's disposal
    hs.dispose();

    // ------------------------------------------------------------------ orbital approach
    space.show(to);
    space.earth.position.set(0, 0, 0);
    space.oa.position.set(0, 0, 0);
    space.oa.rotation.y = 0;
    story.show(space);
    space.scene.add(o);
    o.position.set(0, 0, 0);
    o.rotation.set(1.2, Math.PI, 0, 'YXZ');
    space.drift.set(0, 0, -30);
    player.flightState.k = 1;
    hud.set({ mode: 'ORBITAL APPROACH', speed: 0.35, rows: [['Destination', dest.name], ['Sector', SECTOR[to]], ['Status', to === 'oa' ? 'Central Battery in range' : 'Atmosphere: breathable']] });
    story.ringSay('ringApproach');
    const target = to === 'oa' ? V(0, -50, -760) : V(-12, -25, -60);
    if (to === 'earth') {
      // arriving over the night side, the planet's curve ahead of him
      space.earth.position.set(0, 40, -120);
      director.cut(V(-1.4, 1.6, 3.4), V(0, -8, -60), 54);
    } else director.cut(V(-1.5, 1.5, 3.6), target, 50);
    const fade3 = tween(0.9, (k) => (grade.uFlash.value = 1 - k), ease.out);
    player.animator.play(still(POSES.hover, 0.4), 1.6);
    await tween(long ? 2.2 : 1.6, (k) => {
      o.rotation.set(1.2 * (1 - ease.inOut(k)) + 0.15, Math.PI, 0, 'YXZ');
      space.drift.set(0, 0, -30 * (1 - k));
      director.pos.z = 3.6 - k * 0.5;
    }, ease.linear);
    await fade3;
    hud.arrive(dest);
    if (long) await story.say('halOa', { hold: 0.5 });
    else await wait(0.8);
    // the dive: head first toward the planet, the planet swelling to fill the view
    player.animator.play(player.flightGen, 0.4);
    director.cut(V(0.3, 1.9, 3.0), target, 52);
    audio.whoosh(1.6, 0.8);
    const planet = to === 'oa' ? space.oa : space.earth, p0 = planet.position.clone();
    await tween(1.5, (k) => {
      o.rotation.set(0.15 + 1.6 * ease.inOut(Math.min(1, k * 2)), Math.PI, 0, 'YXZ');
      planet.position.copy(p0).addScaledVector(V(0, 0.08, 1), k * k * (to === 'oa' ? 420 : 50));
      space.drift.set(0, -20 * k, -60 * k);
      director.fov = 52 + 20 * k * k;
    }, ease.linear);
    await tween(0.35, (k) => (grade.uFlash.value = k), ease.in);
  } finally {
    animStop();
    hud.show(false);
    director.fov = 55;
    player.animator.reach('R', null);
  }
}

// Out of the sky: Hal braces, a ring of light bursts round him with a sonic boom, and he rockets
// straight up on a column of light; the shot ends on a flash.
async function launchOut(story) {
  const { player, director, audio, engine, powers } = story;
  const grade = engine.gradeUniforms, o = player.object;
  const p0 = o.position.clone(), yaw = player.yaw;
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), right = V(fwd.z, 0, -fwd.x);
  o.rotation.set(0, yaw, 0);
  player.animator.play(still(POSES.hover, 0.4), 0.3);
  // low, off his right side, looking up at him
  const cam = p0.clone().addScaledVector(right, 2.6).addScaledVector(fwd, 2.3).add(V(0, -1.2, 0));
  director.cut(cam, p0.clone().add(V(0, 1.2, 0)), 48);
  audio.riser(1.0, 0.35);
  story.ringGlow = 4;
  await wait(0.7);
  player.animator.play(still(POSES.flyFast, 0.2), 0.18);
  powers.takeoffFx();
  audio.sonicBoom();
  director.shake(0.5, 0.9);
  grade.uFlash.value = 0.25;
  tween(0.5, (k) => (grade.uFlash.value = 0.25 * (1 - k)));
  const trail = createShaft({ from: p0.clone().add(V(0, 1.2, 0)), to: p0.clone().add(V(0, 2.2, 0)), radiusFrom: 0.05, radiusTo: 0.45, color: new THREE.Color(0.4, 2.4, 1.0) });
  story.current.scene.add(trail);
  trail.userData.uniforms.uOpacity.value = 2;
  const look = new THREE.Vector3();
  await tween(1.5, (k) => {
    const h = 0.5 * 70 * (k * 1.5) ** 2; // 70 m/s²
    o.position.set(p0.x, p0.y + h, p0.z);
    trail.scale.y = Math.max(0.01, h * 0.9);
    look.copy(o.position).y += 1.2;
    director.look.lerp(look, 0.35);
    director.fov = 46 - 10 * k;
  }, ease.linear);
  await tween(0.3, (k) => (grade.uFlash.value = k * k), ease.linear);
  trail.removeFromParent();
  trail.geometry.dispose();
  trail.material.dispose();
}
