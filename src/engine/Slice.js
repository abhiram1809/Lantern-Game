// Long work done in slices: a generator (each `yield` a place it may stop) run until it has used
// `budget` milliseconds, then the browser let in (a paint, the loading animation, input) before it goes
// on. Building the valley and its town in one go held the page for well over a second.
export async function sliced(steps, budget = 12) {
  let t = performance.now(), r;
  while (!(r = steps.next()).done) {
    if (performance.now() - t > budget) {
      await new Promise((res) => setTimeout(res, 0));
      t = performance.now();
    }
  }
  return r.value;
}

// the same steps run straight through (where whoever asks needs the result now)
export function runSteps(steps) {
  let r;
  while (!(r = steps.next()).done);
  return r.value;
}
