// Cuts the wall posters out of the bedroom reference (assets/ref/4.webp), flattens their
// perspective and evens out the baked-in lighting, for use as textures in the bedroom scene.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Corners in source pixels: top-left, top-right, bottom-right, bottom-left.
const POSTERS = [
  ['airforce', [[357, 45], [578, 78], [580, 403], [360, 400]]],
  ['jets', [[747, 148], [942, 168], [942, 340], [747, 330]]],
  ['testpilot', [[665, 330], [782, 338], [782, 547], [667, 547]]],
  ['flightseat', [[828, 363], [926, 368], [926, 542], [830, 538]]],
  ['sidewall', [[1043, 225], [1160, 215], [1160, 433], [1043, 435]]],
  ['squadron', [[172, 120], [300, 133], [300, 290], [175, 282]]],
  ['whitejet', [[247, 316], [345, 320], [348, 460], [250, 460]]],
];

const { data, info } = await sharp('assets/ref/4.webp').removeAlpha().raw().toBuffer({ resolveWithObject: true });
const sample = (x, y, c) => {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (xx, yy) => data[(Math.min(info.height - 1, yy) * info.width + Math.min(info.width - 1, xx)) * 3 + c];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
};
await mkdir('public/textures/posters', { recursive: true });
for (const [name, [tl, tr, br, bl]] of POSTERS) {
  const w = Math.round(((tr[0] - tl[0]) + (br[0] - bl[0])) / 2 * 2.2);
  const h = Math.round(((bl[1] - tl[1]) + (br[1] - tr[1])) / 2 * 2.2);
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h;
    const sx = (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0];
    const sy = (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1];
    for (let c = 0; c < 3; c++) out[(y * w + x) * 3 + c] = sample(sx, sy, c);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).normalise({ lower: 1, upper: 99 }).modulate({ saturation: 1.1 }).jpeg({ quality: 85 }).toFile(`public/textures/posters/${name}.jpg`);
  console.log(name, w, h);
}
