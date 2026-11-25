// Page helper for the shops' stock (dev server only; city/Stock.js, story/Shopping.js): Hal put inside a shop, the
// camera where the player's would be, the stock looked at, taken, paid for, knocked about.
//   const t = await import('/tools/shop-test.js');
//   await t.toShop('market', { u: 0.5, v: 0.4, face: 'back' })   // free roam on Hal's street: into Coast Liquor
//   await t.view([x, y, z], [x, y, z])          // the camera at a room-frame eye, looking at a room-frame point
//   t.stats()                                    // what the stock draws (sets, shown copies, free items)
//   await t.aimAt(item)                          // Hal at arm's length, the camera over his shoulder on the item
//   await t.press('KeyE'); await t.steps(1.5)    // one press, a second and a half of game
//   await t.shot('name')                         // the frame to SHOT_DIR/name.png
import { steps, until } from './sapphire-end-bot.js';
import { yieldNow } from './story-monitor.js';

const g = () => window.__game;
const V = (x, y, z) => new (g().engine.camera.position.constructor)(x, y, z);
export { steps, until };
export const stock = () => g().story.current.block.ctx.stockRun;
export const room = (key) => stock().rooms.get(key);
// a room-frame point (x along its front, y up, z out of the room) in the world
export function world(key, [x, y, z]) { const R = room(key); return V(x, y, z).applyMatrix4(R.M).add(stock().origin); }
export const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
export async function press(code) { key(code, true); await steps(0.1); key(code, false); await steps(0.05); }

// From the title (`/?r=1#world`): free roam, Hal's street at `hour`, Hal into a shop and its stock loaded
export async function go(key = 'market', { hour = 14, u = 0.55, v = 0.3 } = {}) {
  const P = await import('./perf-probe.js');
  await P.toCoast();
  g().story.dayCycle.setHour(hour);
  await toShop(key, { u, v });
  for (let i = 0; i < 60 && !stock().loaded; i++) await steps(0.5);
  return stats();
}
// Hal into a room: at `u`, `v` across it (0..1 of its width from x0, 0..1 of its depth from the front), facing its back
export async function toShop(key, { u = 0.5, v = 0.35, yaw = null } = {}) {
  const s = g().story, R = room(key), x = R.x0 + (R.x1 - R.x0) * u, z = R.z0 - (R.z0 - R.z1) * v;
  const at = world(key, [x, 0.15, z]), back = world(key, [x, 0.15, R.z1]);
  s.player.place(at, yaw ?? Math.atan2(back.x - at.x, back.z - at.z));
  await steps(1.5);
  return at;
}
// the camera put somewhere (room frame), the engine paused there
export async function view(key, eye, look, settle = 0.4) {
  const G = g(), cam = G.engine.camera, e = world(key, eye), l = world(key, look);
  const pose = () => { cam.position.copy(e); cam.lookAt(l); cam.updateMatrixWorld(); };
  await steps(settle, null, pose);
  pose();
  G.story.current.update(0, G.engine.time, cam, G.engine.renderer);
  pose();
  for (let i = 0; i < 4; i++) { G.engine.composer.render(0); await yieldNow(); }
}
export async function shot(name) {
  const G = g();
  G.engine.composer.render(0);
  await fetch(`/__shot?name=${name}`, { method: 'POST', body: G.engine.renderer.domElement.toDataURL('image/png') });
  return name;
}
export function stats() {
  const st = stock();
  return { loaded: st.loaded, sets: st.sets.length, drawn: st.sets.filter((s) => s.mesh.visible).length, shown: st.sets.reduce((n, s) => n + s.groups.reduce((k, gr) => k + gr.list.filter((e) => e.shown).length, 0), 0), free: st.free.size, near: [...st.rooms.values()].filter((r) => r.near).map((r) => r.key) };
}
// items in a room by product
export function items(key, filter = () => true) { return stock().items.filter((it) => it.room === key && filter(it)); }
// Hal stood at arm's length from an item (on its front's side), facing it; his camera steered (the mouse's yaw and
// pitch, Player.updateCamera) so its line runs over his shoulder onto the item
export async function aimAt(it, { dist = 0.8, side = 0 } = {}) {
  const s = g().story, st = stock(), pl = s.player, c = st.centre(it), fwd = V(Math.sin(it.my + it.yaw), 0, Math.cos(it.my + it.yaw));
  const at = c.clone().addScaledVector(fwd, dist).addScaledVector(V(fwd.z, 0, -fwd.x), side).setY(0.15);
  pl.place(at, Math.atan2(-fwd.x, -fwd.z));
  steer(c);
  await steps(0.8, null, () => steer(c));
  return { at, c };
}
// the camera's yaw and pitch for its line through the pivot onto `c`
export function steer(c) {
  const pl = g().story.player;
  for (let k = 0; k < 3; k++) {
    const right = V(Math.cos(pl.camYaw), 0, -Math.sin(pl.camYaw)), pivot = pl.position.clone().add(V(0, pl.pivotHeight, 0)).addScaledVector(right, pl.shoulder ?? 0);
    const d = pivot.sub(c).normalize();
    pl.camYaw = Math.atan2(d.x, d.z);
    pl.camPitch = Math.asin(d.y);
  }
}
