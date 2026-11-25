// The view from Hal's window in Las Palmas, baked (2026-11-24): what Part Three's morning in the flat shows through
// its window, where the city isn't built yet (free roam draws it live: story/Roam.js windowView). Run in the page,
// in free roam in Coast City, on the dev server:
//   await (await import('/tools/bake-window.js')).bake()            // 9:41 AM, his car in its bay
// It saves the cube's six faces to $SHOT_DIR as window_px.png ... window_nz.png; then
//   node tools/bake-window.mjs $SHOT_DIR       // → public/textures/views/hal_window_*.jpg
// The faces are the cube render target's own (as `readRenderTargetPixels` gives them, first row first), so loaded
// back as a CubeTexture they sample the same way the live cube does (scenes/Bedroom.js setView).
import * as THREE from 'three';
import { LOT } from '/src/scenes/Ferris.js';
import { WINDOW } from '/src/city/HalsHome.js';

const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const GAIN = 4; // (scenes/Bedroom.js BAKED_GAIN)

export async function bake({ hour = 9 + 41 / 60, size = 768 } = {}) {
  const g = window.__game, s = g.story, e = g.engine, f = s.ferrisScene, r = e.renderer;
  if (!f) throw new Error('in Coast City first');
  e.paused = true;
  // the morning, his car nose in to its bay (Part Three's: he walks out to it)
  s.dayCycle?.setHour(hour);
  s.dayCycle?.apply(e.camera);
  if (f.car && f.lotCarSpot) { f.car.position.copy(f.lotCarSpot); f.car.rotation.set(0, 0, 0); f.car.updateMatrixWorld(true); }
  await e.advance(0.5);
  const at = LOT.clone().add(WINDOW.at);
  const look = new THREE.PerspectiveCamera(90, 1, 0.15, 5000);
  look.position.copy(at);
  look.lookAt(at.clone().add(WINDOW.out));
  look.updateMatrixWorld(true);
  const occ = f.scene.userData.occlusion;
  if (occ) for (const it of occ.items) occ.show(it, true);
  f.update(0, e.time, look, r);
  // drawn as the live cube is (half floats, linear), then each face read back, a quarter as bright (the sky and the
  // lamps go past white: Bedroom multiplies it back, `BAKED_GAIN`) and sRGB-encoded into bytes
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cube = new THREE.CubeCamera(0.15, 5000, rt);
  cube.position.copy(at);
  cube.updateMatrixWorld(true);
  cube.update(r, f.scene);
  const half = new Uint16Array(size * size * 4), c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
  const enc = (v) => { v = Math.max(0, v / GAIN); v = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.min(255, Math.round(v * 255)); };
  for (let i = 0; i < 6; i++) {
    r.readRenderTargetPixels(rt, 0, 0, size, size, half, i);
    for (let k = 0; k < size * size; k++) {
      d[k * 4] = enc(THREE.DataUtils.fromHalfFloat(half[k * 4]));
      d[k * 4 + 1] = enc(THREE.DataUtils.fromHalfFloat(half[k * 4 + 1]));
      d[k * 4 + 2] = enc(THREE.DataUtils.fromHalfFloat(half[k * 4 + 2]));
      d[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    await fetch(`/__shot?name=window_${FACES[i]}`, { method: 'POST', body: c.toDataURL('image/png') });
  }
  rt.dispose();
  return FACES.map((n) => `window_${n}.png`);
}
