// Game-time scheduling: per-frame tasks, waits and tweens that all advance with the game loop.
const tasks = new Set();

export const ease = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

export function tick(dt) {
  for (const task of [...tasks]) task(dt);
}

export function onFrame(fn) {
  tasks.add(fn);
  return () => tasks.delete(fn);
}

export function wait(seconds) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const task = (dt) => {
      elapsed += dt;
      if (elapsed >= seconds) { tasks.delete(task); resolve(); }
    };
    tasks.add(task);
  });
}

export function tween(duration, fn, easing = ease.inOut) {
  return new Promise((resolve) => {
    let elapsed = 0;
    fn(0);
    const task = (dt) => {
      elapsed = Math.min(duration, elapsed + dt);
      fn(easing(elapsed / duration));
      if (elapsed >= duration) { tasks.delete(task); resolve(); }
    };
    tasks.add(task);
  });
}

export function waitFor(predicate) {
  return new Promise((resolve) => {
    const task = () => {
      if (predicate()) { tasks.delete(task); resolve(); }
    };
    tasks.add(task);
  });
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
