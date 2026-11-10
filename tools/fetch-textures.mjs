// Downloads the surface textures (CC0, Poly Haven) into public/textures/pbr/<id>/ as WebP: colour,
// normal (OpenGL convention) and roughness at 1K, for the hand-built surfaces (hangar walls, the
// apron, roads, the desert floor, stucco). tools/build-props.mjs credits them in CREDITS.md.
//
//   node tools/fetch-textures.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

export const TEXTURES = [
  { id: 'corrugated_iron_02', use: 'the hangars’ walls and roofs' },
  { id: 'concrete_floor_02', use: 'the apron, the lots and the pavements' },
  { id: 'asphalt_02', use: 'the roads and the runway' },
  { id: 'gravelly_sand', use: 'the desert floor' },
  { id: 'white_plaster_02', use: 'stucco walls (the control tower, the office)' },
];
const MAPS = { diff: ['Diffuse'], nor: ['nor_gl'], rough: ['Rough', 'rough'] };

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const { id } of TEXTURES) {
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
    await mkdir(`public/textures/pbr/${id}`, { recursive: true });
    for (const [name, keys] of Object.entries(MAPS)) {
      const key = keys.find((k) => files[k]);
      const url = files[key]?.['1k']?.jpg?.url ?? files[key]?.['1k']?.png?.url;
      if (!url) { console.log(`${id}: no ${name}`); continue; }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      await sharp(buf).webp({ quality: name === 'nor' ? 90 : 82 }).toFile(`public/textures/pbr/${id}/${name}.webp`);
    }
    console.log(id);
  }
}
