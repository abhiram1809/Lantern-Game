// Page helper for Part Seven's Predator fight (dev server only):
//   const b = await import('/tools/predator-bot.js');
//   await b.toFight();                        // from `#predator`: Continue, the opening stepped through, the fight
//   await b.fight(60, { mode: 'player' });    // a scripted player; mode 'player' | 'hookSpam' | 'turtle' | 'idle'
//   await b.spawn();                          // (from `#zamaron` with control: a Predator on the plaza, nothing else)
//   await b.poses('p_');                      // close shots of its layers, one by one
// It steps the game in fixed frames and yields by message (a hidden pane throttles timers to one a second).
import { yieldNow } from './story-monitor.js';

const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
export const stats = { t: 0, clicks: 0, parries: 0, blocks: 0, hits: 0, dealt: 0, taken: 0, lines: [], log: [] };

async function steps(secs, until) {
  const g = window.__game;
  for (let i = 0; i < Math.round(secs * 30); i++) {
    g.engine.frame(1 / 30, false);
    stats.t += 1 / 30;
    if (i % 5 === 0) await yieldNow();
    if (until?.()) return true;
  }
  return false;
}

// from the title at `#zamaron` (or `#predator`): Continue, then stepped on until the player has control there
export async function boot() {
  const g = window.__game;
  for (let i = 0; i < 100 && !document.querySelector('#screen.show button'); i++) await new Promise((r) => setTimeout(r, 200));
  document.querySelector('#screen.show button')?.click();
  for (let i = 0; i < 20000 && !(g.story?.zam && g.story.current === g.story.zam && g.story.player.control); i++) {
    if (g.engine && !g.ui.loading) g.engine.advance(1 / 30);
    await yieldNow();
  }
  g.engine.paused = true;
  return !!g.story?.player?.control;
}

// a Predator on Zamaron's plaza, with Hal there in front of it (the chapter's own is `story.pred`)
export async function spawn({ engage = false } = {}) {
  const g = window.__game, s = g.story, z = s.zam, THREE = await import('three');
  const { Predator, loadPredator } = await import('/src/enemies/Predator.js');
  const gl = await loadPredator();
  const foe = new Predator({ scene: z.scene, physics: z.physics, powers: s.powers, player: s.player, audio: s.audio, director: s.director, engine: g.engine, gltf: gl, ground: (x, q) => z.ground(x, q), centre: new THREE.Vector3(0, 6, -150), radius: 24, avoid: [{ x: 0, z: -182, r: 11 }] });
  foe.root.position.set(0, 6, -152);
  z.updaters.push((dt, t) => foe.update(dt, t));
  // (the chapter's own set-down runs first, its flash and all: anywhere past the garden's mouth starts it)
  if (s.checkpointId === 'zamaron' && !s.zamSetDown) {
    s.zamSetDown = true;
    s.player.place(new THREE.Vector3(0, 20, 150), Math.PI);
    g.engine.paused = true;
    await steps(1);
    await steps(25, () => s.player.control && g.engine.gradeUniforms.uFlash.value < 0.01);
  }
  s.player.place(new THREE.Vector3(0, 6, -138), Math.PI);
  s.powers.enabled.flight = true;
  if (engage) foe.engage();
  g.engine.paused = true;
  await steps(0.5);
  return (window.foe = foe);
}

// its layers one at a time, held, from the side (and their lowest point over the floor)
export async function poses(prefix = 'p_', foe = window.foe ?? window.__game.story.pred) {
  const g = window.__game, d = g.story.director, THREE = await import('three'), pose = foe.body.pose;
  const was = foe.action;
  foe.action = { kind: 'test', phase: 'x', t: 0 };
  const zero = { rear: 0, lunge: 0, aimYaw: 0, aimPitch: 0, jaw: 0, tailLift: 0, tailSweep: 0, wings: 0, flap: 0, shake: 0 };
  const tests = [['neutral', {}], ['rearjaw', { rear: 1, jaw: 1 }], ['lunge', { lunge: 1, jaw: 0.8 }], ['tailup', { tailLift: 1 }], ['tailsweep', { tailSweep: 1 }], ['wings', { wings: 1 }], ['aim', { aimYaw: 0.8, aimPitch: -0.4 }]];
  const out = {};
  g.engine.gradeUniforms.uFlash.value = 0; // (the arrival's flash, still up, washed the shots out)
  for (const [n, o] of tests) {
    Object.assign(pose, zero, o);
    foe.body.update(0);
    const c = foe.root.position, y = foe.yaw, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), l = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
    d.cut(c.clone().addScaledVector(l, 12).addScaledVector(f, 3).add(new THREE.Vector3(0, 3.2, 0)), c.clone().addScaledVector(f, 2.5).add(new THREE.Vector3(0, 1.8, 0)), 50);
    g.engine.frame(1 / 240, false);
    Object.assign(pose, zero, o);
    foe.body.update(0);
    await g.shot(prefix + n, 0);
    out[n] = +lowest(foe).toFixed(2);
  }
  foe.action = was;
  return out;
}

// the skin's lowest point over the ground under it
export function lowest(foe = window.foe) {
  let sm = null;
  foe.root.traverse((o) => { if (o.isSkinnedMesh && /Main/.test(o.material.name)) sm = o; });
  foe.root.updateMatrixWorld(true);
  sm.skeleton.update();
  const v = sm.position.clone();
  let m = Infinity;
  for (let k = 0; k < sm.geometry.attributes.position.count; k += 3) { sm.getVertexPosition(k, v); v.applyMatrix4(sm.matrixWorld); m = Math.min(m, v.y); }
  return m - foe.ground(foe.root.position.x, foe.root.position.z);
}

// A scripted player. 'player': keeps the camera on it, closes to biting range, raises the shield just as a
// blow is coming (a parry), hooks its head while it's open, flies when it does, and in its tether gets in
// between with the shield up. 'hookSpam': hooks, nothing else. 'turtle': shield held, hooks between.
// 'idle': stands there. Returns what it dealt and took, and what it did.
export async function fight(secs, { mode = 'player', shots = null, every = 1.5, keepAlive = false, until = null, foe: f = null } = {}) {
  const g = window.__game, s = g.story, p = s.player, P = s.powers, canvas = g.engine.renderer.domElement;
  const foe = f ?? s.pred ?? window.foe;
  if (!foe.__wrapped) {
    foe.__wrapped = true;
    const h = foe.hit.bind(foe);
    foe.hit = (part, a, pt, d, k) => { const r = h(part, a, pt, d, k); stats.dealt += r; if (r > 0) stats.hits++; stats.log.push(`${stats.t.toFixed(1)} ${part} ${k} ${Math.round(a)}→${Math.round(r)} ${foe.stance()}`); return r; };
    const dm = P.damage.bind(P);
    P.damage = (a, from, k) => { const r = dm(a, from, k); stats.taken += r; return r; };
    const gh = P.guardHit.bind(P);
    P.guardHit = (a, b) => { const r = gh(a, b); if (r === 'parry') stats.parries++; if (r === 'block') stats.blocks++; return r; };
    const ot = foe.onTether;
    foe.onTether = (w) => { stats.log.push(`${stats.t.toFixed(1)} tether ${w}`); return ot?.(w); };
    const bg = foe.begin.bind(foe);
    foe.begin = (kind, o) => { stats.log.push(`${stats.t.toFixed(1)} begin ${kind}${o?.quick ? ' (quick)' : ''}`); return bg(kind, o); };
  }
  const click = () => { canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })); };
  const aimAt = (t) => { const d = t.clone().sub(p.position); p.camYaw = Math.atan2(d.x, d.z) + Math.PI; p.camPitch = Math.max(-0.9, Math.min(0.9, -Math.atan2(d.y - 1.0, Math.hypot(d.x, d.z)))); };
  let guard = false, guardUntil = -1, clickAt = -1, n = 0, nextShot = stats.t + every, mv = null;
  let mvAt = 0;
  const move = (code) => { if (mv === code && (!code || stats.t - mvAt < 0.3)) return; if (mv && mv !== code) key(mv, false); mv = code; mvAt = stats.t; if (code) key(code, true); }; // (held keys re-sent: the input dropped one)
  const end = stats.t + secs;
  while (stats.t < end && foe.state === 'fight' && !until?.(foe, s)) {
    if (keepAlive) P.health = Math.max(P.health, 60);
    if (p.control && mode !== 'idle') {
      const head = foe.parts[0].tg.position, a = foe.action;
      aimAt(foe.stance() === 'exposed' || foe.stance() === 'pinned' ? head : foe.parts[1].tg.position);
      // the shield, at the moment a blow lands
      let coming = false;
      if (mode === 'player' && a) {
        const w = a.kind === 'bite' ? (a.quick ? 0.5 : 0.85) : a.kind === 'tail' ? (a.quick ? 0.5 : 0.8) : 0;
        if (a.phase === 'wind' && w && a.t > w - 0.05) coming = true; // (as the tell ends: the blow lands inside the parry's half second)
        if (a.kind === 'pounce' && a.phase === 'leap' && a.t > 0.3) coming = true;
        if (a.kind === 'dive' && a.phase === 'dive' && foe.parts[0].tg.position.distanceTo(p.position) < 16) coming = true;
        if (a.kind === 'tether' && a.phase === 'hold') coming = true;
      }
      if (mode === 'turtle') coming = true;
      if (coming && !guard && stats.t > guardUntil) { key('KeyF', true); guard = true; guardUntil = stats.t + (mode === 'turtle' ? 99 : 0.7); }
      if (guard && mode !== 'turtle' && stats.t > guardUntil - 0.2 && guardUntil < stats.t + 50) { key('KeyF', false); guard = false; }
      // where to be: before its head on the ground; off its head in the air; in its beam's way. In flight the
      // camera is the steering (W flies where it looks), so it looks where he's going
      const d = Math.hypot(head.x - p.position.x, head.z - p.position.z);
      const holding = a?.kind === 'tether' && a.phase === 'hold';
      const openNow = foe.stance() === 'exposed' || foe.stance() === 'pinned';
      if (foe.flying && !p.flying) p.takeOff();
      let goal = head.clone(), want = openNow ? 2.5 : foe.flying ? 7 : 5;
      if (holding && mode === 'player') { goal = foe.beam.position.clone().lerp(foe.ally.position, 0.55); want = 0.4; }
      if (p.flying) {
        aimAt(goal.clone().add({ x: 0, y: -0.2, z: 0 }));
        const dd = goal.distanceTo(p.position.clone().add({ x: 0, y: 1.2, z: 0 }));
        move(dd > want + 1 ? 'KeyW' : dd < want - 1.5 ? 'KeyS' : null);
        if (!foe.flying && !openNow && dd < 6) p.stopFlying?.();
      } else move(d > want + 1 ? 'KeyW' : d < want - 1.5 ? 'KeyS' : null);
      if (holding && mode === 'player' && !guard) { key('KeyF', true); guard = true; guardUntil = stats.t + 99; }
      if (guard && guardUntil > stats.t + 50 && !holding) { key('KeyF', false); guard = false; guardUntil = -1; }
      // blows: on its head while it's open ('player'), at anything ('hookSpam', 'turtle')
      const open = openNow || (foe.stance() === 'open' && !a);
      if (!guard || mode === 'turtle') {
        const reach = head.distanceTo(p.position.clone().add({ x: 0, y: 1.2, z: 0 }));
        if ((mode === 'player' && open && reach < 6) || ((mode === 'hookSpam' || mode === 'turtle') && reach < 7)) {
          if (stats.t > clickAt) { click(); clickAt = stats.t + 0.4; stats.clicks++; }
        }
      }
    }
    g.engine.frame(1 / 30, false);
    stats.t += 1 / 30;
    if (Math.round(stats.t * 30) % 5 === 0) await yieldNow();
    if (shots && stats.t >= nextShot) { nextShot += every; await g.shot(shots + String(n++).padStart(2, '0'), 1 / 30); }
  }
  move(null);
  if (guard) key('KeyF', false);
  return { t: +stats.t.toFixed(1), state: foe.state, phase: foe.phase, health: +foe.fraction.toFixed(2), hal: Math.round(P.health), dealt: Math.round(stats.dealt), taken: Math.round(stats.taken), parries: stats.parries, blocks: stats.blocks, clicks: stats.clicks, hits: stats.hits, log: stats.log.slice(-14) };
}
export function reset() { Object.assign(stats, { t: 0, clicks: 0, parries: 0, blocks: 0, hits: 0, dealt: 0, taken: 0, lines: [], log: [] }); }

// One of its attacks, shot from beside it every `every` seconds: Hal stood `dist` from its head at `side`
// (radians off its line: 0 in front, 2.4 behind its shoulder), the attack begun, `n` frames.
export async function sequence(kind, { prefix = kind + '_', n = 10, every = 0.13, dist = 6.5, side = 0, cam = [11, 2.6, 5] } = {}) {
  const g = window.__game, s = g.story, foe = window.foe ?? s.pred, d = s.director, THREE = await import('three');
  s.powers.health = 100;
  foe.endAction();
  foe.cool = 99;
  const y = foe.yaw, f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y)), l = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
  const hp = foe.parts[0].tg.position.clone(), dir = f.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), side);
  s.player.place(new THREE.Vector3(hp.x, foe.ground(hp.x, hp.z), hp.z).addScaledVector(dir, dist), Math.atan2(-dir.x, -dir.z));
  for (let i = 0; i < 20; i++) g.engine.frame(1 / 30, false);
  foe.begin(kind);
  const c0 = foe.root.position.clone(), names = [];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < Math.round(every * 30); i++) g.engine.frame(1 / 30, false);
    d.cut(c0.clone().addScaledVector(l, cam[0]).addScaledVector(f, cam[2]).add(new THREE.Vector3(0, cam[1], 0)), c0.clone().addScaledVector(f, cam[2] * 0.9).add(new THREE.Vector3(0, 1.6, 0)), 52);
    g.engine.frame(1 / 240, false);
    const name = prefix + String(k).padStart(2, '0');
    await g.shot(name, 0);
    names.push(`${name}:${foe.action?.phase ?? '-'}`);
  }
  foe.cool = 1;
  return names;
}

// from `#predator`: Continue, then the opening stepped through (a shot every `every` s if `shots`) until the
// fight hands over control
export async function toFight({ shots = null, every = 1.5 } = {}) {
  const g = window.__game;
  for (let i = 0; i < 100 && !document.querySelector('#screen.show button'); i++) await new Promise((r) => setTimeout(r, 200));
  document.querySelector('#screen.show button')?.click();
  for (let i = 0; i < 20000 && !g.story?.pred; i++) { if (g.engine && !g.ui.loading) g.engine.advance(1 / 30); await yieldNow(); }
  const s = g.story;
  g.engine.paused = true;
  const say0 = s.ui.say.bind(s.ui);
  s.ui.say = (o) => { stats.lines.push(`${stats.t.toFixed(1)} ${o.who}: ${String(o.text).slice(0, 50)}`); return say0(o); };
  let n = 0, next = stats.t + every;
  for (let i = 0; i < 30 * 300 && !(s.player.control && s.pred?.state === 'fight'); i++) {
    g.engine.frame(1 / 30, false);
    stats.t += 1 / 30;
    if (i % 5 === 0) await yieldNow();
    if (shots && stats.t >= next) { next += every; await g.shot(shots + String(n++).padStart(2, '0'), 1 / 30); }
  }
  return { control: s.player.control, state: s.pred?.state, t: +stats.t.toFixed(1), lines: stats.lines.slice() };
}
