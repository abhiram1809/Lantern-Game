// Long work done in slices: a generator (each `yield` a place it may stop) run until it has used
// `budget` milliseconds, then the browser let in (a paint, the loading animation, input) before it goes
// on. Building the valley and its town in one go held the page for well over a second.
// (`key`, `onProgress`: how far through it is, for the loading screen: its yields counted against how
// many it took last time, kept in the browser, or `expect` the first time)
// The browser let in between slices: a message to ourselves, not a timer (a timer is held to 4 ms after
// a few in a row, and in a hidden tab to one a second: a player who looked away while it loaded came back
// to it still loading, 85 slices a second apart). React's scheduler yields the same way.
const chan = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null, waiting = [];
if (chan) chan.port1.onmessage = () => waiting.shift()?.();
export const breath = () => new Promise((res) => { if (!chan) { setTimeout(res, 0); return; } waiting.push(res); chan.port2.postMessage(0); });

export async function sliced(steps, budget = 12, { key = null, expect = 200, onProgress = null } = {}) {
  let t = performance.now(), r, n = 0;
  const store = key && `gl_steps_${key}`;
  let total = expect;
  try { total = Number(globalThis.localStorage?.[store]) || expect; } catch { /* no storage: the guess */ }
  while (!(r = steps.next()).done) {
    n++;
    if (performance.now() - t > budget) {
      onProgress?.(Math.min(0.98, n / total));
      await breath();
      t = performance.now();
    }
  }
  if (store) try { globalThis.localStorage[store] = String(n); } catch { /* fine */ }
  onProgress?.(1);
  return r.value;
}

// the same steps run straight through (where whoever asks needs the result now)
export function runSteps(steps) {
  let r;
  while (!(r = steps.next()).done);
  return r.value;
}
