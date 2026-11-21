// Page helper for checking a chapter without watching it (dev server only):
//   const m = await import('/tools/story-monitor.js'); m.run('pier', 'pier_');
// then poll `window.M` (done, t, lines, flags, shots). It clicks the checkpoint card's Continue, steps
// the game in fixed 1/30 s frames without drawing (a hidden pane throttles timers to one a second, so it
// yields by message, not by timeout), records every line said (`M.lines`), flags any bone of Hal, Carol
// or Star Sapphire that moves faster than a body can (`M.flags`: a pop, a snap, a teleport inside a
// shot), and saves a capture `lag` seconds into every line (`__game.shot`) to `SHOT_DIR`.
// The engine is left paused (`__game.engine.paused`), so only these steps move the game: with the pane in
// view the game's own loop ran on beside them, a line came at a different time each run, and by the time a
// second call looked at a pose the story had moved on. `onFrame(M, s)` may set `M.done` to stop at a moment.
const ch = new MessageChannel();
let res = null;
ch.port1.onmessage = () => { const r = res; res = null; r?.(); };
export const yieldNow = () => new Promise((r) => { res = r; ch.port2.postMessage(0); });

export function run(step, prefix, { maxT = 240, lag = 1.3, every = 0, max = 48, onFrame } = {}) {
  const M = (window.M = { done: false, t: 0, flags: [], lines: [], shots: 0, err: null, pend: [] });
  (async () => {
    try {
      const g = window.__game;
      while (!document.querySelector('#screen.show button') && !g.story) await new Promise((r) => setTimeout(r, 300));
      document.querySelector('#screen.show button')?.click();
      while (!g.story || g.story.checkpointId !== step) await new Promise((r) => setTimeout(r, 300));
      const s = g.story, p = s.player, ui = s.ui, say0 = ui.say.__raw ?? ui.say.bind(ui);
      g.engine.paused = true;
      ui.say = (o) => { M.lines.push(`${M.t.toFixed(1)} ${o.who}: ${String(o.text).slice(0, 46)}`); M.pend.push(M.t + lag); return say0(o); };
      ui.say.__raw = say0; // (a second run on the same page wraps the game's own, not the first run's)
      const bones = ['head', 'hand_L', 'hand_R', 'foot_L', 'foot_R', 'hips'], prev = {};
      let started = false;
      for (let i = 0; i < 30 * maxT && !M.done; i++) {
        g.engine.frame(1 / 30, false);
        if (i % 5 === 0) await yieldNow();
        if (!started) { if (document.querySelector('#loading')?.className !== 'done') continue; started = true; }
        M.t += 1 / 30;
        onFrame?.(M, s);
        for (const [name, rig] of [['hal', p.rig], ['carol', s.carol], ['sap', s.sap]]) {
          if (!rig || rig.root?.visible === false || !rig.root?.parent) continue;
          if (name === 'carol' && s.sap?.root.parent && s.carol.meshes?.[0]?.visible === false) continue;
          for (const b of bones) {
            const v = rig.bonePosition(b).clone(), key = name + b, q = prev[key];
            if (q) { const sp = v.distanceTo(q) * 30; if (sp > (b === 'hips' ? 4 : 7)) M.flags.push(`${M.t.toFixed(2)} ${name}.${b} ${sp.toFixed(1)} m/s`); }
            prev[key] = v;
          }
        }
        if (M.pend.length && M.t >= M.pend[0] && M.shots < max) { M.pend.shift(); await g.shot(prefix + String(M.shots++).padStart(2, '0'), 1 / 30); }
        if (every && i % Math.round(every * 30) === 0 && M.shots < max) await g.shot(prefix + String(M.shots++).padStart(2, '0'), 1 / 30);
        if (s.checkpointId !== step || document.querySelector('#screen.show')) { M.lines.push(`${M.t.toFixed(1)} -> ${s.checkpointId}${document.querySelector('#screen.show') ? ' (a card)' : ''}`); break; }
      }
    } catch (e) { M.err = String(e.stack || e); }
    M.done = true;
  })();
  return M;
}

// Close-ups of a figure from cameras of its own, without stepping the game (the game's camera is put back
// after): `await around('sap_', rig)` saves the whole figure from the front, three-quarter, side and back
// (`<prefix>body0..3`) and each hand from in front, outside and behind (`<prefix>handL0..2`, `handR0..2`).
// For looking at arms, hands and deformation in whatever pose the story has the figure in.
export async function around(prefix, rig, { dist = 2.7, fov = 40, hands = true, lift = 0.25 } = {}) {
  const g = window.__game, cam = g.engine.camera, THREE = await import('three');
  const keep = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
  rig.root.updateWorldMatrix(true, true);
  const fwd = new THREE.Vector3(0, 0, 1).transformDirection(rig.root.matrixWorld).setY(0).normalize();
  const turned = (a) => fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  const snap = async (name, at, from, f) => {
    cam.position.copy(from); cam.fov = f; cam.updateProjectionMatrix(); cam.up.set(0, 1, 0); cam.lookAt(at);
    g.engine.composer.render(0);
    await fetch(`/__shot?name=${prefix}${name}`, { method: 'POST', body: g.engine.renderer.domElement.toDataURL('image/png') });
  };
  const mid = rig.bonePosition('hips').clone(); mid.y += lift;
  const out = [];
  for (const [k, a] of [0, 0.8, Math.PI / 2, Math.PI].entries()) { await snap(`body${k}`, mid, mid.clone().addScaledVector(turned(a), dist), fov); out.push(`${prefix}body${k}`); }
  if (hands) for (const side of ['L', 'R']) {
    const h = rig.bonePosition(`hand_${side}`).clone().lerp(rig.bonePosition(`foreArm_${side}`), 0.35), s = side === 'L' ? 1 : -1;
    for (const [k, a] of [0, s * Math.PI / 2, Math.PI].entries()) { await snap(`hand${side}${k}`, h, h.clone().addScaledVector(turned(a), 0.85).add(new THREE.Vector3(0, 0.12, 0)), 36); out.push(`${prefix}hand${side}${k}`); }
  }
  cam.position.copy(keep.p); cam.quaternion.copy(keep.q); cam.fov = keep.fov; cam.updateProjectionMatrix();
  return out;
}
