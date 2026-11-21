// Page helper for Part Seven's fight (dev server only), from `#hold`:
//   const b = await import('/tools/sapphire-bot.js'); await b.toFight(); await b.fight(40, { shots: 'f_', every: 1.5 });
// `toFight` clicks the card's Continue, waits for the chapter, puts Hal 26 m from her in the air and steps
// her talk to the fight. `fight` plays a player who keeps the camera on her (as a mouse would), raises the
// guard as her shards come in or she dives (a parry), holds her in the bubble when he can and hooks her in
// her openings; `stats` and `M` (lines said) say how it went. `noGuard`/`noBubble` turn those off. It steps
// the game in fixed frames and yields by message (a hidden pane throttles timers to one a second).
// `until(foe, story)` stops it at a moment (a tell, a pose) to look at her there: `around()` in story-monitor.js.
import { yieldNow } from './story-monitor.js';

const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
export const stats = { t: 0, clicks: 0, bubbles: 0, parries: 0, blocks: 0, lines: [] };

export async function toFight() {
  const g = window.__game;
  while (!document.querySelector('#screen.show button') && !g.story) await new Promise((r) => setTimeout(r, 300));
  document.querySelector('#screen.show button')?.click();
  while (!g.story?.sapFoe) await new Promise((r) => setTimeout(r, 300));
  const s = g.story, p = s.player, foe = s.sapFoe;
  g.engine.paused = true; // (only these steps move the game: the same fight each run, pane in view or not)
  const say0 = s.ui.say.bind(s.ui);
  s.ui.say = (o) => { stats.lines.push(`${stats.t.toFixed(1)} ${o.who}: ${String(o.text).slice(0, 40)}`); return say0(o); };
  // (long waits: with only these steps moving the game, the opening on the pier takes its whole length; put
  // beside her before the chapter had handed over control, Hal wasn't flying and fell into the sea for ever)
  for (let i = 0; i < 30 * 240 && !p.control; i++) { g.engine.frame(1 / 30, false); if (i % 5 === 0) await yieldNow(); }
  if (!p.control) throw new Error('toFight: the chapter never handed over control');
  p.place(foe.tg.position.clone().set(foe.tg.position.x + 24, foe.tg.position.y - 4, foe.tg.position.z + 5), -Math.PI / 2);
  p.takeOff();
  for (let i = 0; i < 30 * 240 && !(p.control && foe.state === 'duel'); i++) { if (!p.flying) p.takeOff(); g.engine.frame(1 / 30, false); if (i % 5 === 0) await yieldNow(); }
  const gh = s.powers.guardHit.bind(s.powers);
  s.powers.guardHit = (a, b) => { const r = gh(a, b); if (r === 'parry') stats.parries++; if (r === 'block') stats.blocks++; return r; };
  return { control: p.control, state: foe.state };
}

export async function fight(secs, { noGuard = false, noBubble = false, shots = null, every = 1.5, keepAlive = false, until = null } = {}) {
  const g = window.__game, s = g.story, p = s.player, P = s.powers, foe = s.sapFoe, canvas = g.engine.renderer.domElement;
  const click = () => { canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); };
  const aim = () => { const f = foe.tg.position.clone().sub(p.position); p.camYaw = Math.atan2(f.x, f.z) + Math.PI; p.camPitch = Math.max(-0.9, Math.min(0.9, -Math.atan2(f.y - 0.6, Math.hypot(f.x, f.z)))); };
  let guardUntil = -1, down = false, clickAt = -1, armed = P.selected ?? 'fist', n = 0, nextShot = stats.t + every;
  const end = stats.t + secs;
  while (stats.t < end && (foe.state === 'duel' || foe.state === 'pause') && !until?.(foe, s)) {
    if (keepAlive) P.health = Math.max(P.health, 60);
    if (p.control) {
      aim();
      const near = foe.shards.some((q) => !q.back && q.pos.distanceTo(p.position) < 7.5 && q.vel.dot(p.position.clone().sub(q.pos)) > 0);
      const dash = foe.action?.kind === 'embrace' && foe.action.phase === 'dash';
      if (!noGuard && (near || dash) && !down && stats.t > guardUntil) { key('KeyF', true); down = true; guardUntil = stats.t + 0.9; }
      if (down && stats.t > guardUntil - 0.35) { key('KeyF', false); down = false; }
      const open = foe.exposed > 0 || foe.heldT >= 0, d = foe.object.position.distanceTo(p.position);
      if (!down) {
        if (open) { if (armed !== 'fist') { P.choose(0); armed = 'fist'; } if (stats.t > clickAt) { click(); clickAt = stats.t + 0.45; stats.clicks++; } }
        else if (!noBubble && foe.state === 'duel' && foe.trapCool <= 0 && foe.heldT < 0 && !foe.action && P.charge > 35 && d < 30) { if (armed !== 'bubble') { P.choose(6); armed = 'bubble'; } if (stats.t > clickAt) { click(); clickAt = stats.t + 1.2; stats.bubbles++; } }
      }
    }
    g.engine.frame(1 / 30, false);
    stats.t += 1 / 30;
    if (Math.round(stats.t * 30) % 5 === 0) await yieldNow();
    if (shots && stats.t >= nextShot) { nextShot += every; await g.shot(shots + String(n++).padStart(2, '0'), 1 / 30); }
  }
  if (down) key('KeyF', false);
  return { t: +stats.t.toFixed(1), state: foe.state, gem: +foe.health.toFixed(2), hurt: +foe.hurt.toFixed(1), hal: Math.round(P.health), charge: Math.round(P.charge), ...stats, lines: stats.lines.slice(-8) };
}
