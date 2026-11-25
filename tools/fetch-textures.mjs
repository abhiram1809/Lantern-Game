// The surface textures (CC0, Poly Haven): colour, normal (OpenGL convention) and roughness at 1K, for the
// hand-built surfaces (hangar walls, the apron, roads, the desert floor, stucco). The sources are kept in
// assets/textures/pbr/<id>/ (downloaded once: the ones there are the WebPs the game has always shown; Poly
// Haven's files have changed since, the asphalt's normal map a third stronger, and it glittered in the sun);
// each is fitted and GPU-compressed into public/textures/pbr/<id>/<name>.ktx2 (tools/texture-fit.mjs: a flat
// roughness comes down, the grain stays). tools/build-props.mjs credits them in CREDITS.md.
//
//   node tools/fetch-textures.mjs            the ones not built yet (downloading any source that's missing)
//   FORCE=1 node tools/fetch-textures.mjs    all of them again (ONLY=asphalt_02,… some)
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { fitImage, encodeKtx2, TOLERANCE } from './texture-fit.mjs';

export const TEXTURES = [
  { id: 'corrugated_iron_02', use: 'the hangars’ walls and roofs' },
  { id: 'concrete_floor_02', use: 'the apron, the lots and the pavements' },
  { id: 'asphalt_02', use: 'the roads and the runway' },
  { id: 'gravelly_sand', use: 'the desert floor' },
  { id: 'white_plaster_02', use: 'stucco walls (the control tower, the office)' },
  // Coast City's buildings and streets (src/city)
  { id: 'painted_plaster_wall', use: 'Coast City: stucco walls' },
  { id: 'clay_roof_tiles_02', use: 'Coast City: barrel tile roofs, copings and pent roofs' },
  { id: 'painted_metal_shutter', use: 'Coast City: roll-down shop shutters' },
  { id: 'painted_worn_brick', use: 'Coast City: painted brick walls' },
  { id: 'red_brick_plaster_patch_02', use: 'Coast City: old brick walls' },
  { id: 'concrete_pavement', use: 'Coast City: pavements' },
  { id: 'patio_tiles', use: 'Coast City: terracotta tiling at shop doors' },
  { id: 'rectangular_facade_tiles', use: 'Coast City: the bank front' },
  { id: 'floor_tiles_06', use: 'Coast City: the diner’s checkered tiles' },
  { id: 'brown_planks_05', use: 'Coast City: the houses’ painted lap siding (Rob Tuytel)' },
  { id: 'roof_slates_02', use: 'Coast City: the houses’ cedar shake roofs (Rob Tuytel)' },
];
const MAPS = { diff: ['Diffuse'], nor: ['nor_gl'], rough: ['Rough', 'rough'] };
const SLOT = { diff: 'color', nor: 'normal', rough: 'mr' };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { existsSync } = await import('node:fs');
  for (const { id } of TEXTURES) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(id)) continue;
    if (!process.env.FORCE && existsSync(`public/textures/pbr/${id}/diff.ktx2`)) continue;
    const dir = `assets/textures/pbr/${id}`;
    await mkdir(dir, { recursive: true });
    await mkdir(`public/textures/pbr/${id}`, { recursive: true });
    const have = await readdir(dir);
    let files = null;
    const sizes = [];
    for (const [name, keys] of Object.entries(MAPS)) {
      let src = have.find((f) => f.startsWith(`${name}.`));
      if (!src) {
        files ??= await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
        const key = keys.find((k) => files[k]), fmt = files[key]?.['1k']?.jpg ? 'jpg' : 'png';
        const url = files[key]?.['1k']?.[fmt]?.url;
        if (!url) { console.log(`${id}: no ${name}`); continue; }
        src = `${name}.${fmt}`;
        await writeFile(`${dir}/${src}`, Buffer.from(await (await fetch(url)).arrayBuffer()));
      }
      const f = await fitImage(await readFile(`${dir}/${src}`), 1024, TOLERANCE[SLOT[name]]);
      await writeFile(`public/textures/pbr/${id}/${name}.ktx2`, await encodeKtx2(f.rgba, f.to, SLOT[name], f.alpha, { flipY: true }));
      sizes.push(`${name} ${f.to.join('×')}`);
    }
    console.log(`${id}: ${sizes.join(', ')}`);
  }
}
