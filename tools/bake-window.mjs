// The baked window faces (tools/bake-window.js, saved by the dev server's /__shot) to the game's JPEGs:
//   node tools/bake-window.mjs <shot dir>   → public/textures/views/hal_window_{px,nx,py,ny,pz,nz}.jpg
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/bake-window.mjs <shot dir>'); process.exit(1); }
const out = 'public/textures/views';
mkdirSync(out, { recursive: true });
for (const f of ['px', 'nx', 'py', 'ny', 'pz', 'nz']) {
  const to = join(out, `hal_window_${f}.jpg`);
  await sharp(join(dir, `window_${f}.png`)).jpeg({ quality: 86, mozjpeg: true }).toFile(to);
  console.log(to);
}
