// Dev helper for looking at Coast City's people in the page (like fight-bots.js):
//   const T = await import('/tools/people-test.js'); await T.stand(['female-adult-02']); await T.faces('name');
import * as P from '/src/characters/People.js';
import { Animator } from '/src/characters/Rig.js';
import { Locomotion } from '/src/characters/Mocap.js';

const g = () => window.__game, V = () => g().story.player.position.constructor;
export const people = [];

// stand them in a row 3 m in front of Hal, facing him
export async function stand(ids, { gap = 1.1, dz = 3 } = {}) {
  const s = g().story, gl = await P.loadPeople(ids);
  if (!s.current.__peopleTest) { s.current.__peopleTest = true; s.current.updaters.push((dt) => { for (const p of people) { p.anim.update(dt); p.per.update(dt); } }); }
  gl.forEach((gltf, i) => {
    const per = P.createPerson(gltf, { seed: i + 1 });
    s.current.scene.add(per.rig.root);
    const anim = new Animator(per.rig), loco = new Locomotion(s.mocap);
    loco.scale = per.rig.hipsHeight / s.mocap.hipsHeight;
    anim.play(loco, 0);
    per.rig.root.position.set(s.player.position.x + (i - (ids.length - 1) / 2) * gap, 0, s.player.position.z + dz);
    per.rig.root.rotation.y = Math.PI;
    people.push({ id: ids[i], per, anim, loco });
  });
  s.player.control = false;
  await g().engine.advance(0.4);
  return people;
}

export function clear() { for (const p of people) p.per.rig.root.removeFromParent(); people.length = 0; }

// front, three-quarter and profile of one face, and the whole figure
export async function faces(p, name) {
  const v = V(), d = g().story.director, r = p.per.rig, e = r.bonePosition('head', new v());
  const at = (x, y, z) => e.clone().add(new v(x, y, z));
  d.cut(at(0, 0.08, -0.55), at(0, 0.07, 0), 30); await g().shot(`${name}_face`, 1 / 30);
  d.cut(at(0.42, 0.08, -0.38), at(0, 0.06, 0), 30); await g().shot(`${name}_three`, 1 / 30);
  d.cut(at(0.6, 0.06, 0), at(0, 0.06, 0), 30); await g().shot(`${name}_profile`, 1 / 30);
  const hips = r.bonePosition('hips', new v());
  d.cut(hips.clone().add(new v(0.5, 0.3, -2.8)), hips.clone().add(new v(0, 0.1, 0)), 40); await g().shot(`${name}_full`, 1 / 30);
}

export async function hands(p, name) {
  const v = V(), d = g().story.director, r = p.per.rig;
  const h = r.bonePosition('hand_R', new v()), f = r.bonePosition('middle3_R', new v()), c = h.clone().lerp(f, 0.5);
  d.cut(c.clone().add(new v(0.4, 0.08, -0.32)), c, 28);
  for (const grip of ['relaxed', 'hold', 'fist']) { p.per.setGrip('R', grip); await g().shot(`${name}_${grip}`, 1 / 30); }
  d.cut(c.clone().add(new v(0.05, 0.05, -0.45)), c, 28);
  await g().shot(`${name}_fist_front`, 1 / 30);
  p.per.setGrip('R', 'relaxed');
}

// from the title (a #world save) into free roam on Hal's block, with its people loaded
export async function enterCoast() {
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 500)); if (document.querySelector('#screen.show button')) break; }
  document.querySelector('#screen.show button')?.click();
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); if (g().story?.current && g().story.player?.control) break; }
  const s = g().story;
  s.goTo('coast');
  for (let i = 0; i < 80; i++) { await g().engine.advance(0.25); if (s.player.control && s.roam?.where === 'coast') break; }
  for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 250)); if (s.cityLife?.started) break; }
  return s;
}

// Hal onto a stool at the counter (index), stepped through Rosie's serving
export async function counter(i = 4, shots = 'pour') {
  const s = g().story, v = V(), d = s.director;
  const sp = s.current.block.ctx.spots.filter((p) => p.stool)[i];
  s.player.control = true;
  s.player.place?.(sp.approach.clone().add(new v(1.2, 0, 0)), 0);
  await g().engine.advance(0.5);
  s.sit(sp);
  const ro = s.cityLife.people.find((p) => p.kind === 'rosie');
  const cam = () => d.cut(sp.at.clone().add(new v(-2.2, 1.5, 1.6)), sp.at.clone().lerp(ro.pos, 0.5).add(new v(0, 1.1, 0)), 45);
  for (let k = 0; k < 6; k++) { await g().engine.advance(k ? 1 : 3); cam(); await g().shot(`${shots}${k}`, 1 / 30); }
  return { sp, ro };
}
