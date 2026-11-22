// Page helper for the end of Part Seven (dev server only): steps the game in fixed frames and plays the parts
// that need a player, so each chapter can be run through without watching it.
//   const b = await import('/tools/sapphire-end-bot.js');
//   await b.boot('queen');              // from `/?r=1#queen`: Continue, stepped until the chapter's begun
//   await b.until(() => cond, 120);      // step until cond() (or the seconds run out); lines said go to b.lines
//   await b.cross();                     // the queen's crossing: walk to the dais, the shield up for each wave
//   await b.hold();                      // Carol's hold: keep him in the ring, hold on
//   await b.race({ boost: true });       // the race to the pier
//   await b.press('KeyE');               // one press (an interaction)
// `b.shotAt(name)` saves the current frame (`__game.shot`).
import { yieldNow } from './story-monitor.js';

export const lines = [];
// with `opts.shots` a prefix, a frame saved a beat into every line said (`<prefix><n>_<key>.png` in SHOT_DIR)
export const opts = { shots: null, lag: 1.2 };
const pending = [];
let shotN = 0;
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
const g = () => window.__game;

export async function steps(secs, until, each) {
  const G = g();
  for (let i = 0; i < Math.round(secs * 30); i++) {
    each?.();
    G.engine.frame(1 / 30, false);
    if (pending.length && G.engine.time >= pending[0].at) { const p = pending.shift(); G.engine.frame(0); await G.shot(p.name, 0); }
    if (i % 4 === 0) await yieldNow();
    if (until?.()) return true;
  }
  return false;
}
export const until = (cond, secs = 60, each) => steps(secs, cond, each);

export async function press(code, hold = 0.1) {
  key(code, true);
  await steps(hold);
  key(code, false);
  await steps(0.1);
}

export async function boot(id) {
  const G = g();
  for (let i = 0; i < 100 && !document.querySelector('#screen.show button'); i++) await new Promise((r) => setTimeout(r, 200));
  document.querySelector('#screen.show button')?.click();
  for (let i = 0; i < 4000 && !(G.story && G.story.checkpointId === id); i++) await new Promise((r) => setTimeout(r, 50));
  G.engine.paused = true;
  const ui = G.story.ui;
  if (!ui.say.__logged) {
    const raw = ui.say.bind(ui);
    ui.say = (o) => {
      lines.push(`${(G.engine.time ?? 0).toFixed(1)} ${o.who}: ${o.text}`);
      if (opts.shots) pending.push({ at: G.engine.time + opts.lag, name: `${opts.shots}${String(shotN++).padStart(2, '0')}_${(o.who ?? '').slice(0, 6)}` });
      return raw(o);
    };
    ui.say.__logged = true;
  }
  // through the loading screen (it doesn't draw, and waits on the network)
  for (let i = 0; i < 6000 && ui.load; i++) { G.engine.advance?.(1 / 30); await yieldNow(); }
  return G.story;
}

export async function shotAt(name) { const G = g(); G.engine.frame(0); await G.shot(name, 0); }

// The crossing: W toward the dais, the guard (F) raised as each wave is a few frames off him, down once it's past.
export async function cross(secs = 120, { miss = 0 } = {}) {
  const s = g().story, p = s.player;
  for (let i = 0; i < 300 && !(s.crossState && p.control); i++) await steps(0.1);
  let up = false, n = 0;
  const done = await steps(secs, () => !s.crossState?.waves || (!p.control && s.crossState && s.crossState.dist() < 9.5), () => {
    const cs = s.crossState;
    if (!cs || !p.control) { if (up) { key('KeyF', false); up = false; } return; }
    p.camYaw = Math.PI * 2; // (looking north, up the plaza)
    key('KeyW', true);
    const d = cs.dist(), near = cs.waves.filter((w) => !w.done && w.r < d).map((w) => (d - w.r) / 15);
    const soon = near.length && Math.min(...near) < 0.22;
    if (soon && !up) { n++; if (n > miss) { key('KeyF', true); up = true; } }
    if (!soon && up && !near.some((t) => t < 0.4)) { key('KeyF', false); up = false; }
  });
  key('KeyW', false);
  key('KeyF', false);
  return done;
}

// Carol's hold: steer the view back to him with the keys and hold Space while he's in the ring
export async function hold(secs = 60) {
  const s = g().story;
  for (let i = 0; i < 600 && !s.holdState; i++) await steps(0.1);
  const st = s.holdState;
  const ks = ['KeyA', 'KeyD', 'KeyW', 'KeyS'];
  const done = await steps(secs, () => st.k >= 1, () => {
    for (const k of ks) key(k, false);
    if (st.ay > 0.02) key('KeyD', true); else if (st.ay < -0.02) key('KeyA', true);
    if (st.ap > 0.02) key('KeyS', true); else if (st.ap < -0.02) key('KeyW', true);
    key('Space', Math.hypot(st.ay, st.ap) < 0.08);
  });
  for (const k of [...ks, 'Space']) key(k, false);
  return done;
}

// The race: aimed at the pier, flying, boosting (or not)
export async function race({ boost = true, secs = 80 } = {}) {
  const s = g().story, p = s.player, THREE = s.player.position.constructor;
  for (let i = 0; i < 300 && !p.control; i++) await steps(0.1);
  const goal = new THREE(-1469.7, 6.4, s.player.position.z < 0 ? 0 : 0);
  const done = await steps(secs, () => !p.control, () => {
    const m = s.powers.markerTarget?.pos;
    if (!m) return;
    const d = m.clone().sub(p.position);
    p.camYaw = Math.atan2(-d.x, -d.z);
    p.camPitch = Math.max(-0.5, Math.min(0.5, Math.atan2(d.y, Math.hypot(d.x, d.z)) * -1 + 0.1));
    key('KeyW', true);
    key('ShiftLeft', boost);
  });
  key('KeyW', false);
  key('ShiftLeft', false);
  void goal;
  return done;
}

// walk Hal to a point (teleported, for a test) and press E there
export async function useAt(pos) {
  const s = g().story;
  s.player.place(pos.clone(), s.player.yaw);
  await steps(0.4);
  await press('KeyE');
}
