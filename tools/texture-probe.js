// Page helper (dev server): what the textures on the GPU cost, and whose they are. Import it at the title (before
// Continue): it watches every texture the renderer uploads and tags each image with the file it came from.
//   const t = await import('/tools/texture-probe.js');
//   await t.toCoast();                // Continue into free roam (`/?r=1#world`), then to Hal's street
//   t.table()                         // by owner: images, MB, sizes; then the biggest images
//   t.table({ by: 'file' })           // by file (each prop, each person, each surface)
//   t.keep('baseline'); t.compare(['baseline', 'after'])   // kept in localStorage `gl_tex` across reloads
// One row per upload (clones share their source's upload, as the renderer does: one per source and sampling
// parameters). Memory as the GPU holds it: uncompressed RGBA8 is 4 bytes a texel, a third more with mips;
// compressed formats are their mips' own sizes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const seen = new Set(), from = new WeakMap(); // every texture the renderer has set up; source → the file it came from
const add = THREE.EventDispatcher.prototype.addEventListener;
if (!add.__probe) {
  // (WebGLTextures.initTexture listens for 'dispose' on each texture it uploads: the one hook it offers)
  THREE.EventDispatcher.prototype.addEventListener = function (type, fn) {
    if (type === 'dispose' && this.isTexture) seen.add(this);
    return add.call(this, type, fn);
  };
  THREE.EventDispatcher.prototype.addEventListener.__probe = true;
  const tag = (t, url) => { if (t?.isTexture && !from.has(t.source)) from.set(t.source, url); };
  const textures = (m) => Object.values(m).filter((v) => v?.isTexture);
  const gltf = GLTFLoader.prototype.load;
  GLTFLoader.prototype.load = function (url, onLoad, ...rest) {
    return gltf.call(this, url, (g) => {
      g.scene.traverse((o) => { for (const m of [o.material].flat()) if (m) for (const t of textures(m)) tag(t, url); });
      onLoad(g);
    }, ...rest);
  };
  const image = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function (url, ...rest) { const t = image.call(this, url, ...rest); tag(t, url); return t; };
}

const CARS = ['phoenix', 'fairheaven', 'negotiator', 'sialia', 'fairheaven_sw', 'policecar', 'ambulance'];
function owner(file, t) {
  if (!file && /^sign page/.test(t.name)) return 'signs (painted in code)';
  if (!file) return t.isCanvasTexture ? 'canvas (painted in code)' : t.isDataTexture || t.isData3DTexture || t.isDataArrayTexture ? 'data (made in code)' : t.isCompressedTexture ? 'compressed (untagged)' : 'image (untagged)';
  if (file.includes('/models/people/')) return 'people';
  const prop = file.match(/\/models\/props\/([^/.]+)/)?.[1];
  if (prop) return CARS.includes(prop) ? 'cars' : 'props';
  if (file.includes('/textures/pbr/')) return 'surfaces (Poly Haven)';
  if (/\/models\/[^/]+\.glb/.test(file)) return 'scans';
  return file.split('/').slice(0, -1).join('/') || file;
}
const BPP = { [THREE.UnsignedByteType]: 1, [THREE.ByteType]: 1, [THREE.HalfFloatType]: 2, [THREE.FloatType]: 4, [THREE.UnsignedShortType]: 2, [THREE.ShortType]: 2, [THREE.UnsignedIntType]: 4, [THREE.IntType]: 4 };
const CHANNELS = { [THREE.RGBAFormat]: 4, [THREE.RGBFormat ?? -1]: 3, [THREE.RGFormat]: 2, [THREE.RedFormat]: 1, [THREE.AlphaFormat]: 1, [THREE.DepthFormat]: 1, [THREE.RGBAIntegerFormat]: 4, [THREE.RGIntegerFormat]: 2, [THREE.RedIntegerFormat]: 1 };
function bytes(t) {
  const img = t.image, faces = t.isCubeTexture ? 6 : 1;
  if (t.isCompressedTexture) return (t.mipmaps ?? []).reduce((s, m) => s + (m.data?.byteLength ?? 0), 0) * faces;
  const w = img?.width ?? 0, h = img?.height ?? 0, d = img?.depth ?? 1;
  const texel = t.isDataTexture || t.isData3DTexture || t.isDataArrayTexture ? (CHANNELS[t.format] ?? 4) * (BPP[t.type] ?? 1) : 4;
  const mips = t.generateMipmaps && t.minFilter !== THREE.NearestFilter && t.minFilter !== THREE.LinearFilter ? 4 / 3 : 1;
  return w * h * d * texel * mips * faces;
}

// the uploads now on the GPU: one row each
export function list() {
  const P = window.__game.engine.renderer.properties, rows = new Map();
  for (const t of seen) {
    const p = P.get(t);
    if (!p.__webglInit || !p.__webglTexture) { if (!p.__webglInit) seen.delete(t); continue; }
    if (rows.has(p.__webglTexture)) { rows.get(p.__webglTexture).uses++; continue; }
    const img = t.image, file = from.get(t.source) ?? (typeof img?.src === 'string' && !img.src.startsWith('data:') ? new URL(img.src, location.href).pathname : null);
    rows.set(p.__webglTexture, {
      file, owner: owner(file, t), name: t.name, w: img?.width ?? 0, h: img?.height ?? 0, bytes: bytes(t), uses: 1,
      kind: t.isCompressedTexture ? 'compressed' : t.isCanvasTexture ? 'canvas' : t.isDataTexture ? 'data' : 'image', source: t.source,
    });
  }
  return [...rows.values()];
}

const MB = (b) => Math.round(b / 1e5) / 10;
// a summary: the total, the images by size, and rows grouped by `by` ('owner' or 'file'), biggest first
export function summary({ by = 'owner' } = {}) {
  const all = list(), groups = new Map(), sizes = {};
  for (const r of all) {
    const k = by === 'file' ? (r.file?.replace(/^.*\/(models|textures)\//, '') ?? `${r.owner}: ${r.name || '(no name)'}`) : r.owner;
    const g = groups.get(k) ?? { key: k, images: 0, bytes: 0, sizes: {} };
    const s = Math.max(r.w, r.h);
    g.images++; g.bytes += r.bytes; g.sizes[s] = (g.sizes[s] ?? 0) + 1;
    groups.set(k, g);
    sizes[s] = (sizes[s] ?? 0) + 1;
  }
  return {
    images: all.length, sources: new Set(all.map((r) => r.source)).size, mb: MB(all.reduce((s, r) => s + r.bytes, 0)),
    rendererCount: window.__game.engine.renderer.info.memory.textures, sizes,
    groups: [...groups.values()].sort((a, b) => b.bytes - a.bytes).map((g) => ({ ...g, mb: MB(g.bytes) })),
  };
}

// the same, as text lines
export function table({ by = 'owner', top = 30 } = {}) {
  const s = summary({ by });
  const sz = (o) => Object.entries(o).sort((a, b) => b[0] - a[0]).map(([k, n]) => `${n}×${k}`).join(' ');
  return [`${s.images} uploads (${s.sources} sources; the renderer counts ${s.rendererCount} with its targets), ${s.mb} MB · ${sz(s.sizes)}`,
    ...s.groups.slice(0, top).map((g) => `${String(g.mb).padStart(7)} MB ${String(g.images).padStart(4)}  ${g.key.padEnd(28)} ${sz(g.sizes)}`)].join('\n');
}

// kept by label in localStorage, for a run after a rebuild and a reload
export function keep(label) {
  const all = JSON.parse(localStorage.gl_tex ?? '{}'), s = summary(), f = summary({ by: 'file' });
  all[label] = { images: s.images, mb: s.mb, sizes: s.sizes, owners: Object.fromEntries(s.groups.map((g) => [g.key, [g.images, g.mb]])), files: Object.fromEntries(f.groups.map((g) => [g.key, [g.images, g.mb]])) };
  localStorage.gl_tex = JSON.stringify(all);
  return all[label];
}
export function compare(labels, { by = 'owners' } = {}) {
  const all = JSON.parse(localStorage.gl_tex ?? '{}'), runs = labels.map((l) => all[l] ?? {});
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r[by] ?? {})))].sort((a, b) => (runs[0][by]?.[b]?.[1] ?? 0) - (runs[0][by]?.[a]?.[1] ?? 0));
  const cell = (r, k) => (r[by]?.[k] ? `${r[by][k][1]} MB/${r[by][k][0]}` : '–');
  return [`${labels.join(' -> ')}`, `  ${'total'.padEnd(28)} ${runs.map((r) => `${r.mb} MB/${r.images}`).join('  ->  ')}`,
    ...keys.map((k) => `  ${k.padEnd(28)} ${runs.map((r) => cell(r, k)).join('  ->  ')}`)].join('\n');
}

// From the title (`/?r=1#world`): Continue into free roam, travel to Hal's street, let the city stream in and
// draw a few frames (what's uploaded is what's been drawn); the engine left paused
export async function toCoast({ settle = 8 } = {}) {
  const b = await import('./sapphire-end-bot.js');
  const s = await b.boot('world');
  if (s.roam.where !== 'coast') s.goTo('coast');
  await b.until(() => s.roam.where === 'coast' && !s.busy && s.player.control && s.player.rb && !/Space|Hyperspace/.test(s.current?.constructor?.name ?? ''), 60);
  await b.steps(settle);
  s.engine.paused = true;
  return s;
}

// The same frame with the textures from before and after a rebuild: every live texture that came from one of
// `files` (or from any file, `files` null) swapped for the old build's (served from /_old/: `git archive HEAD
// public/models public/textures | tar -x -C public/_old --strip-components=1`, deleted after), the camera at
// `eye` looking at `at`. Saves `<name>_old.png` and `<name>_new.png` in SHOT_DIR. Old GLB materials are matched
// by name; the old surfaces are their WebPs.
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
const oldGltf = new Map();
export async function ab(name, { eye, at, fov = 55, files = null } = {}) {
  const G = window.__game, r = G.engine.renderer, cam = G.engine.camera, scene = G.story.current.scene;
  const fileOf = (t) => from.get(t.source) ?? (typeof t.image?.src === 'string' ? new URL(t.image.src, location.href).pathname : null);
  const swaps = [];
  const wanted = (f) => f && /\/(models\/(props|people)|textures\/pbr)\//.test(f) && (!files || files.some((x) => f.includes(x)));
  const mats = new Set();
  scene.traverse((o) => { for (const m of [o.material].flat()) if (m && SLOTS.some((k) => wanted(m[k] && fileOf(m[k])))) mats.add(m); });
  for (const m of mats) for (const k of SLOTS) {
    const t = m[k], f = t && fileOf(t);
    if (!wanted(f)) continue;
    let old = null;
    if (f.endsWith('.ktx2')) {
      old = (await new THREE.TextureLoader().loadAsync(`/_old${f.replace(/\.ktx2$/, '.webp')}`)).clone();
      for (const p of ['wrapS', 'wrapT', 'anisotropy', 'colorSpace', 'channel']) old[p] = t[p];
      old.repeat.copy(t.repeat); old.offset.copy(t.offset); old.rotation = t.rotation;
    } else {
      if (!oldGltf.has(f)) oldGltf.set(f, new GLTFLoader().loadAsync(`/_old${f}`));
      const g = await oldGltf.get(f);
      let src = null;
      g.scene.traverse((o) => { for (const om of [o.material].flat()) if (!src && om?.name === m.name && om[k]) src = om[k]; });
      old = src;
    }
    if (old) swaps.push([m, k, t, old]);
  }
  const keep = { fov: cam.fov, p: cam.position.clone(), q: cam.quaternion.clone() };
  cam.fov = fov; cam.position.set(...eye); cam.lookAt(new THREE.Vector3(...at)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const shoot = async (tag) => {
    for (let i = 0; i < 3; i++) G.engine.composer.render(0);
    await fetch(`/__shot?name=${name}_${tag}`, { method: 'POST', body: r.domElement.toDataURL('image/png') });
  };
  for (const [m, k, , old] of swaps) m[k] = old;
  await shoot('old');
  for (const [m, k, t] of swaps) m[k] = t;
  await shoot('new');
  cam.fov = keep.fov; cam.position.copy(keep.p); cam.quaternion.copy(keep.q); cam.updateProjectionMatrix();
  return { swapped: swaps.length, materials: mats.size };
}

// one frame from `eye` looking at `at`, saved as `<name>.png` in SHOT_DIR (the camera put back after)
export async function view(name, { eye, at, fov = 55 } = {}) {
  const G = window.__game, cam = G.engine.camera, keep = { fov: cam.fov, p: cam.position.clone(), q: cam.quaternion.clone() };
  cam.fov = fov; cam.position.set(...eye); cam.lookAt(new THREE.Vector3(...at)); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  for (let i = 0; i < 3; i++) G.engine.composer.render(0);
  await fetch(`/__shot?name=${name}`, { method: 'POST', body: G.engine.renderer.domElement.toDataURL('image/png') });
  cam.fov = keep.fov; cam.position.copy(keep.p); cam.quaternion.copy(keep.q); cam.updateProjectionMatrix();
}

// where to stand for a close look at a person: in front of their face, `dist` metres off
export function faceView(rig, dist = 1.2) {
  const head = rig.bones.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.06, 0));
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
  return { eye: head.clone().addScaledVector(fwd, dist).toArray(), at: head.toArray() };
}

// where to stand for a close look at a prop: its copy in the scene named `name` that's shown and nearest the camera
// (`nth`: the next ones; a prop's root node is its name), `dist` metres off its front (+Z), `yaw` round it, the eye
// `up` above its centre
export function propView(name, { dist = 2, yaw = 0, up = 0.3, nth = 0 } = {}) {
  const scene = window.__game.story.current.scene, found = [];
  const shown = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };
  const cam = window.__game.engine.camera.position;
  scene.traverse((o) => { if (o.name === name && shown(o)) found.push(o); });
  found.sort((a, b) => a.getWorldPosition(new THREE.Vector3()).distanceTo(cam) - b.getWorldPosition(new THREE.Vector3()).distanceTo(cam));
  const o = found[nth];
  if (!o) return null;
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return { eye: c.clone().addScaledVector(fwd, dist).add(new THREE.Vector3(0, up, 0)).toArray(), at: c.toArray(), count: found.length };
}
