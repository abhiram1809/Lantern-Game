// Page helper (dev server): z-fighting and crawling lines in a view (CLAUDE.md's flicker test). The frame drawn twice
// with the camera moved `nudge` metres (0.0005 for z-fighting, whole areas flipping; 0.03 for crawling lines),
// the pixels that changed by more than `tol` counted, and their picture saved (`<name>_diff.png`, white where they
// changed) beside the frame itself.
//   const F = await import('/tools/flicker.js'); await F.test('fl_street', { eye: [...], at: [...] })
import { stage } from './look-shots.js';

const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
export async function test(name, view, { nudge = 0.0005, tol = 40, hour = 10.5 } = {}) {
  const G = window.__game, r = G.engine.renderer, cam = G.engine.camera, gl = r.getContext();
  G.story.dayCycle?.setHour(hour);
  await stage(view, 1.5);
  G.engine.paused = true;
  for (let i = 0; i < 6; i++) { G.engine.composer.render(0); await tick(); }
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
  const grab = (into) => { G.engine.composer.render(0); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, into); };
  grab(a);
  const save = r.domElement.toDataURL('image/png');
  const d = cam.getWorldDirection(cam.position.clone()), side = d.clone().cross(cam.up).normalize();
  cam.position.addScaledVector(side, nudge); cam.updateMatrixWorld();
  grab(b);
  cam.position.addScaledVector(side, -nudge); cam.updateMatrixWorld();
  let n = 0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const k = i * 4, dv = Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]);
    const y = h - 1 - Math.floor(i / w), x = i % w, o = (y * w + x) * 4;
    const on = dv > tol;
    if (on) n++;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = on ? 255 : a[k] * 0.25; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  await fetch(`/__shot?name=${name}`, { method: 'POST', body: save });
  await fetch(`/__shot?name=${name}_diff`, { method: 'POST', body: c.toDataURL('image/png') });
  return { changed: n, share: +(n / (w * h)).toFixed(5) };
}
