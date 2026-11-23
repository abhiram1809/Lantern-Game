// Page helper (dev server): the same views at the same hours, saved for comparing the look before and after a
// change (the graphics rework). Free roam must be on (tools/perf-probe.js `toCoast()`), the engine paused.
//   const L = await import('/tools/look-shots.js');
//   await L.coast('before')         // Coast City's views at each hour: `before_street_10.png` … in SHOT_DIR
//   await L.korugar('before')       // after travelling there: the plaza by day and night
// Each view: the camera put where it says, the day cycle at the hour, the scene stepped a little so its
// lamps, streaming and detail levels settle, then one frame drawn.
import { steps } from './sapphire-end-bot.js';

export const COAST_VIEWS = {
  street: { eye: [2, 1.8, 5960], at: [6, 3, 5800] }, // Hal's street, down the boulevard
  downtown: { eye: [-200, 140, 6300], at: [-560, 40, 6660] }, // the towers from over the blocks
  promenade: { eye: [-1124, 1.8, 6290], at: [-1140, 2.5, 6480] }, // along the sea front, the sea on the left
  high: { eye: [400, 320, 5700], at: [-560, 0, 6660] }, // the city from high up, the sea beyond
};
export const HOURS = [10.5, 17.9, 19.7, 23];

// The camera put at a view and the scene settled there (also tools/perf-probe.js's benchmark)
export async function stage({ eye, at }, settle = 1.5) {
  const G = window.__game, s = G.story, f = s.current, cam = G.engine.camera, r = G.engine.renderer;
  // Hal stood on the ground a few metres behind the camera (out of the shot), so the streaming and the lamps
  // come to where it looks from
  const V = cam.position.constructor, back = new V(eye[0] - at[0], 0, eye[2] - at[2]).normalize().multiplyScalar(4);
  s.player.place?.(new V(eye[0] + back.x, 0, eye[2] + back.z));
  const pose = () => { cam.position.set(...eye); cam.lookAt(...at); cam.updateMatrixWorld(); };
  await steps(settle, null, pose);
  pose();
  s.dayCycle?.apply?.(cam);
  f.update(0, G.engine.time, cam, r);
  pose();
}

async function view(name, v, settle = 1.5) {
  const G = window.__game, r = G.engine.renderer;
  await stage(v, settle);
  G.engine.composer.render(0);
  await fetch(`/__shot?name=${name}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
  return name;
}

export async function coast(prefix, { views = COAST_VIEWS, hours = HOURS } = {}) {
  const s = window.__game.story, out = [];
  for (const h of hours) {
    s.dayCycle?.setHour(h);
    s.dayCycle?.setWeather?.('clear', true);
    for (const [k, v] of Object.entries(views)) out.push(await view(`${prefix}_${k}_${Math.round(h)}`, v));
  }
  return out;
}

export async function korugar(prefix) {
  const f = window.__game.story.current, out = [];
  for (const night of [false, true]) {
    f.night?.(night);
    out.push(await view(`${prefix}_korugar_plaza_${night ? 'night' : 'day'}`, { eye: [0, 1.8, -46], at: [0, 8, 30] }));
    out.push(await view(`${prefix}_korugar_avenue_${night ? 'night' : 'day'}`, { eye: [6, 30, -60], at: [0, 10, -220] }));
  }
  f.night?.(false);
  return out;
}

// Hal in the suit close up, from in front and a little to the side, at each hour (where he stands now): how the
// sky's light sits on the suit, his face and the street behind
export async function suit(prefix, hours = [10.5, 17.9, 23]) {
  const G = window.__game, s = G.story, f = s.current, cam = G.engine.camera, r = G.engine.renderer, out = [];
  const V = cam.position.constructor, p = s.player.position.clone(), yaw = s.player.object.rotation.y;
  const fwd = new V(Math.sin(yaw), 0, Math.cos(yaw)), side = new V(fwd.z, 0, -fwd.x);
  for (const h of hours) {
    s.dayCycle?.setHour(h);
    await steps(0.6);
    const eye = p.clone().addScaledVector(fwd, 2.6).addScaledVector(side, 0.9).setY(p.y + 1.6), at = p.clone().setY(p.y + 1.2);
    cam.position.copy(eye); cam.lookAt(at); cam.updateMatrixWorld();
    s.dayCycle?.apply?.(cam);
    f.update(0, G.engine.time, cam, r);
    cam.position.copy(eye); cam.lookAt(at); cam.updateMatrixWorld();
    G.engine.composer.render(0);
    const name = `${prefix}_suit_${Math.round(h)}`;
    await fetch(`/__shot?name=${name}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
    out.push(name);
  }
  return out;
}
