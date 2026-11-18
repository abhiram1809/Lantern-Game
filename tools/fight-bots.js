// Scripted players for the boss fights, for testing (in the page on the dev server: `const B = await import("/tools/fight-bots.js")`; see CLAUDE.md, Testing in the browser). Not shipped.
const g = window.__game;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function clickContinue() {
  for (let i = 0; i < 60; i++) {
    const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continue' && b.offsetParent);
    if (b) { b.click(); return true; }
    await sleep(200);
  }
  return false;
}

export function setupT() {
  const s = g.story, p = s.player, cv = g.engine.renderer.domElement, pw = s.powers;
  const T = (window.T = {
    aim(t) { const pp = p.position; p.camYaw = Math.atan2(pp.x - t.x, pp.z - t.z); p.camPitch = -Math.atan2(t.y - pp.y - 1.4, Math.hypot(t.x - pp.x, t.z - pp.z)) + 0.1; },
    down() { cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); },
    up() { window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); },
    guard(on) { window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: 'KeyF' })); },
    async click() { this.down(); await g.engine.advance(1 / 30); this.up(); },
    log: [],
  });
  if (!pw.__wrapped) {
    pw.__wrapped = true;
    const orig = pw.dealDamage.bind(pw);
    pw.dealDamage = (t, amt, pt, dir, kind) => {
      const b = s.atro?.state === 'fight' ? s.atro : s.sin;
      const st = b?.stance?.() ?? '-';
      const d = orig(t, amt, pt, dir, kind);
      T.log.push([kind, Math.round(amt), d, st]);
      return d;
    };
  }
  return T;
}

// the opponent being fought
const foe = () => (g.story.atro?.state === 'fight' ? g.story.atro : g.story.sin);

// One run: `mode` is 'hookSpam' (a click every `every` frames, the real charge), 'gunSpam' (the gun
// held down), 'blocker' (waits; raises the guard on a tell, `late` for a parry, early for a plain
// block; then the hooks while he's open) or 'turtle' (the guard held all the time).
export async function run(secs, mode, opts = {}) {
  const s = g.story, p = s.player, pw = s.powers, T = window.T, b = foe();
  const atro = b === s.atro;
  b.endAction?.(1);
  b.stagger = 0; b.stun = 0; b.exposed = 0; b.distract = 0; b.steady = 0; b.answered = 0;
  b.tg.health = b.tg.maxHealth;
  pw.setCharge(100);
  await g.engine.advance(0.4);
  const took = [], od = pw.damage.bind(pw);
  pw.damage = (amt, from, kind) => { const d = od(amt, from, kind); if (d > 0) took.push([Math.round(d), b.action?.kind ?? '-']); return d; };
  T.log = [];
  const p0 = pw.stats.parries ?? 0, b0 = pw.stats.blocks;
  let guarding = false, firing = false, punish = 0, lastHook = -99, f = 0, openSince = -1;
  const guard = (on) => { if (on !== guarding) { T.guard(on); guarding = on; } };
  for (f = 0; f < secs * 30; f++) {
    pw.health = pw.maxHealth;
    if (opts.fullCharge) pw.setCharge(100);
    b.tg.health = Math.max(b.tg.health, b.tg.maxHealth * 0.62);
    T.aim(b.tg.position);
    const a = b.action, d = Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z), st = b.stance();
    if (mode === 'hookSpam') { if (f % (opts.every ?? 24) === 0 && pw.charge >= 13) await T.click(); }
    else if (mode === 'gunSpam') { if (!firing) { T.down(); firing = true; } }
    else if (mode === 'turtle') guard(true);
    else if (mode === 'blocker') {
      // the tells
      let threat = false, early = false;
      if (!atro) {
        if (a?.kind === 'lunge') { early = true; threat = (a.phase === 'dash' && d < (opts.late ? 3.2 : 9)) || a.phase === 'cut'; }
        if (a?.kind === 'volley') { early = true; threat = a.phase === 'fire' || (!opts.late && a.phase === 'wind'); }
        if (a?.kind === 'slam' && a.phase === 'wind' && a.t > 0.4 && !a.moved) { a.moved = true; p.place(p.position.clone().add(new p.position.constructor(3.5, 0, 0)), p.yaw); }
      } else {
        if (a?.kind === 'charge') { early = true; threat = a.phase === 'rush' && d < (opts.late ? 5 : 30); }
        if (a?.kind === 'beam') { early = a.phase === 'hold'; threat = (a.phase === 'hold' && a.t > (opts.late ? 0.62 : 0.1)) || a.phase === 'after'; }
        if (a?.kind === 'blood') { early = true; threat = a.phase === 'fling' || (a.phase === 'wind' && a.t > (opts.late ? 0.3 : 0)); }
        if (a?.kind === 'slam' && a.phase === 'wind' && !a.moved) { a.moved = true; p.place(p.position.clone().add(new p.position.constructor(6, 0, 4)), p.yaw); }
      }
      const open = st === 'exposed' || st === 'reeling' || (opts.greedy && st === 'open');
      if (!open) openSince = -1; else if (openSince < 0) openSince = f;
      // (a person's reaction: a quarter second before the first hook)
      if (open && f - openSince >= (opts.react ?? 8) && f - lastHook > 9 && pw.charge >= 13) { guard(false); await T.click(); lastHook = f; punish++; }
      else guard(threat || (!opts.late && early));
    }
    await g.engine.advance(1 / 30);
  }
  if (firing) T.up();
  guard(false);
  pw.damage = od;
  await g.engine.advance(0.5);
  const byStance = {};
  for (const [k, , d, st] of T.log) byStance[`${k}@${st}`] = Math.round((byStance[`${k}@${st}`] ?? 0) + d);
  return { mode, late: !!opts.late, secs, dealt: Math.round(T.log.reduce((x, l) => x + l[2], 0)), hits: T.log.length, byStance, took: took.reduce((x, t) => x + t[0], 0), tookBy: took.reduce((m, t) => ((m[t[1]] = (m[t[1]] ?? 0) + t[0]), m), {}), parries: (pw.stats.parries ?? 0) - p0, blocks: pw.stats.blocks - b0, chargeLeft: Math.round(pw.charge) };
}

export async function setupDuel() {
  await clickContinue();
  for (let i = 0; i < 160 && !(g.story?.sin?.state === 'duel' && g.story.player.control); i++) { await sleep(80); await g.engine.advance(0.5); }
  setupT();
  g.story.powers.maxHealth = 1e6;
}

export async function setupSite() {
  await clickContinue();
  for (let i = 0; i < 100 && !(g.story?.current?.constructor?.name === 'Site' && g.story.player.control); i++) { await sleep(150); await g.engine.advance(0.3); }
  const s = g.story, p = s.player, V3 = p.position.constructor;
  p.stopFlying?.();
  p.place(new V3(4, 0, 19), Math.PI);
  await g.engine.advance(1);
  for (let i = 0; i < 140 && !(s.atro?.state === 'fight' && p.control); i++) await g.engine.advance(0.5);
  setupT();
  s.powers.maxHealth = 1e6;
  // (Sinestro off: his spikes would turn Atrocitus and muddle the numbers)
  s.sin.cool = 1e9;
  s.sin.state = 'stand';
}

export async function placeAtro() {
  const s = g.story, p = s.player, V3 = p.position.constructor;
  s.atro.place(new V3(6, 0, -2), 0);
  p.place(new V3(6, 0, 8), Math.PI);
  await g.engine.advance(0.3);
}
