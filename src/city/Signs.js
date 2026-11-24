// Coast City's lettering, painted on canvas: shop signs packed into pages (painted boards, and lightboxes that
// glow at night), window neon, the mural facing Hal's lot and a ghost sign.
import * as THREE from 'three';
import { ktx2 } from '../engine/Ktx2.js';

const FONTS = {
  serif: '"Didot", "Bodoni 72", "Georgia", serif',
  slab: '"Rockwell", "American Typewriter", "Courier New", serif',
  sans: '"Futura", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
  condensed: '"Avenir Next Condensed", "Helvetica Neue", "Arial Narrow", sans-serif',
  script: '"Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive',
  deco: '"Copperplate", "Futura", "Gill Sans", sans-serif',
};

export const FONT_OF = (f) => FONTS[f] ?? f ?? FONTS.serif;

// The signs' pages (2048², mipmapped), on the GPU only: each sign is drawn on a canvas of its own and copied into
// its place (a page was a canvas uploaded whole, 16 MB, for every sign put on it), packed by max rects, the lightboxes
// and the painted boards on the same pages (each page has a material of each in `mats`: `sign` and `signLit`, then
// `sign2` and `signLit2`, …; the lit ones in `litMats`, for the night). A sign is drawn once and found again by its
// key. With `recycle` (the streamed city), the blocks using each sign are counted (`sign(…, uses)` as a block is
// built, `release(uses)` as it's put away): a page none of whose signs is in use is cleared and filled again, and a
// sign wanted again from a page that's mostly out of use is drawn anew on the current one, so the pages hold the
// signs of the blocks that are built, not of every block passed (they grew to 43 pages, 962 MB, over 80 blocks).
// `flush()` once the signs are in: the pages' mipmaps, made again. A full page is sealed (`seal`: the streamed city's
// as the next is begun, the others' once they're built, `sealAll()`) and compressed in a worker (SignWorker.js) to
// UASTC, as the props are: 5.6 MB on the GPU instead of 22.4, and no more signs go on it. Only the page being filled
// stays RGBA; if the encoder can't be had, they all do (as with `localStorage.gl_signs_rgba = '1'`, to compare).
export class SignPages {
  constructor(renderer, mats, { size = 2048, glow = 0.1, recycle = false, compress = localStorage.gl_signs_rgba !== '1' } = {}) {
    Object.assign(this, { renderer, mats, size, glow, recycle, compress });
    this.pages = []; this.litMats = []; this.cache = new Map();
    this.g = document.createElement('canvas').getContext('2d'); // (for measuring)
    this.src = new THREE.Texture(); // (each sign's canvas, as copyTextureToTexture takes it)
    this.at = new THREE.Vector2();
    this.page = this.addPage();
  }
  addPage() {
    const n = this.pages.length + 1, sfx = n > 1 ? n : '';
    const p = { n, t: this.texture(n), used: 0, live: 0, entries: [], dirty: false, sealed: false, gen: 0, free: [{ x: 0, y: 0, w: this.size, h: this.size }] };
    // (cloned from the first page's: a page made at night is lit as the others are)
    const [paint, lit] = this.pages.length ? [this.mats.sign.clone(), this.litMats[0].clone()]
      : [new THREE.MeshStandardMaterial({ roughness: 0.72, alphaTest: 0.4 }), // (letters painted on a wall: only the letters)
        new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: this.glow, roughness: 0.4 })];
    paint.map = lit.map = lit.emissiveMap = p.t;
    p.paint = `sign${sfx}`; p.lit = `signLit${sfx}`;
    this.mats[p.paint] = paint; this.mats[p.lit] = lit;
    p.mats = [paint, lit];
    this.litMats.push(lit);
    this.pages.push(p);
    return p;
  }
  // a page's texture: storage only (WebGL clears it), filled sign by sign
  texture(n) {
    const S = this.size, t = new THREE.DataTexture(null, S, S);
    Object.assign(t, { name: `sign page ${n}`, colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, mipmapsAutoUpdate: false, flipY: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, anisotropy: 8, needsUpdate: true });
    t.source.dataReady = false;
    return t;
  }
  // the sign `ck` (drawn by `draw(g, w, h)` at w × h texels if it isn't yet): its material's key and uv rect
  sign(ck, w, h, lit, draw, uses = null) {
    let e = this.cache.get(ck);
    if (!e || (this.recycle && e.page !== this.page && e.page.live < e.page.used / 2)) e = this.place(ck, Math.ceil(w), Math.ceil(h), draw);
    if (uses) { if (e.refs++ === 0) e.page.live += e.area; uses.push(e); }
    return { key: lit ? e.page.lit : e.page.paint, ...e.uv };
  }
  release(uses) {
    for (const e of uses) if (--e.refs === 0) e.page.live -= e.area;
    uses.length = 0;
  }
  place(ck, w, h, draw) {
    // the current page (2 texels between signs), or the first with room (not when recycling: a page then holds the
    // signs of blocks built about the same time, which go out of use together), or a page none of whose signs is in
    // use, cleared, or a new one
    let at = !this.page.sealed && this.fit(this.page, w + 2, h + 2);
    for (const p of this.pages) {
      if (at || this.recycle) break;
      if (p !== this.page && !p.sealed && (at = this.fit(p, w + 2, h + 2))) this.page = p;
    }
    if (!at) {
      if (this.recycle) this.seal(this.page);
      const free = this.recycle && this.pages.find((p) => p.live === 0);
      this.page = free ? this.clear(free) : this.addPage();
      at = this.fit(this.page, w + 2, h + 2);
      if (!at) console.warn('sign too big for a page', ck, w, h);
    }
    const p = this.page, S = this.size, { x, y } = at;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    draw(g, w, h);
    this.src.image = c;
    this.renderer.copyTextureToTexture(this.src, p.t, null, this.at.set(x, S - y - h)); // (rows from the bottom: flipY)
    p.dirty = true;
    const e = { ck, page: p, area: (w + 2) * (h + 2), refs: 0, uv: { u0: x / S, v0: 1 - (y + h) / S, u1: (x + w) / S, v1: 1 - y / S },
      // (its pixels, kept for compressing the page: the page itself is on the GPU only)
      part: this.compress ? { x, y, w, h, data: g.getImageData(0, 0, w, h).data.buffer } : null };
    p.used += e.area;
    p.entries.push(e);
    this.cache.set(ck, e);
    return e;
  }
  // a page none of whose signs is in use, emptied (a new texture: the old one's freed)
  clear(p) {
    for (const e of p.entries) if (this.cache.get(e.ck) === e) this.cache.delete(e.ck);
    this.use(p, this.texture(p.n));
    Object.assign(p, { used: 0, live: 0, entries: [], dirty: false, sealed: false, gen: p.gen + 1, free: [{ x: 0, y: 0, w: this.size, h: this.size }] });
    return p;
  }
  // a page's texture changed (the old one freed)
  use(p, t) {
    p.t.dispose();
    p.t = t;
    for (const m of p.mats) { m.map = t; if (m.emissiveMap) m.emissiveMap = t; }
  }
  // a full page: no more signs go on it, and it's compressed (the compressed one put in when it's ready, unless the
  // page has been cleared meanwhile)
  seal(p) {
    if (p.sealed || !p.entries.length || !this.compress) return;
    p.sealed = true;
    const gen = p.gen, parts = p.entries.map((e) => e.part).filter(Boolean);
    for (const e of p.entries) e.part = null;
    const stale = () => p.gen !== gen; // (cleared meanwhile: not worth finishing)
    encodePage(this.size, parts, stale)
      .then((buf) => buf && new Promise((done, fail) => ktx2.parse(buf, done, fail)))
      .then((t) => {
        if (!t) return;
        if (stale()) { t.dispose(); return; }
        Object.assign(t, { name: p.t.name, anisotropy: 8 });
        this.use(p, t);
      })
      .catch((err) => console.warn(`sign page ${p.n} left uncompressed:`, err?.message ?? err));
  }
  sealAll() { for (const p of this.pages) this.seal(p); }
  // max rects, best short side: the free rect a w × h one fills most snugly (canvas rows, down from the top), or
  // null; the free rects it overlaps split round it, and any inside another dropped
  fit(p, w, h) {
    let best = null, bs = Infinity, bl = Infinity;
    for (const r of p.free) {
      if (r.w < w || r.h < h) continue;
      const s = Math.min(r.w - w, r.h - h), l = Math.max(r.w - w, r.h - h);
      if (s < bs || (s === bs && l < bl)) { best = r; bs = s; bl = l; }
    }
    if (!best) return null;
    const { x, y } = best, x1 = x + w, y1 = y + h, next = [];
    for (const r of p.free) {
      if (r.x >= x1 || r.x + r.w <= x || r.y >= y1 || r.y + r.h <= y) { next.push(r); continue; }
      if (r.x < x) next.push({ x: r.x, y: r.y, w: x - r.x, h: r.h });
      if (r.x + r.w > x1) next.push({ x: x1, y: r.y, w: r.x + r.w - x1, h: r.h });
      if (r.y < y) next.push({ x: r.x, y: r.y, w: r.w, h: y - r.y });
      if (r.y + r.h > y1) next.push({ x: r.x, y: y1, w: r.w, h: r.y + r.h - y1 });
    }
    const inside = (a, b) => b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h;
    p.free = next.filter((a, i) => !next.some((b, j) => j !== i && inside(a, b) && (j < i || !inside(b, a)))); // (of two the same, the first kept)
    return { x, y };
  }
  // the pages' mipmaps, made again where signs went in
  flush() {
    const r = this.renderer, gl = r.getContext();
    for (const p of this.pages) {
      if (!p.dirty) continue;
      p.dirty = false;
      if (p.t.isCompressedTexture) continue; // (compressed already: its mipmaps came with it)
      r.state.bindTexture(gl.TEXTURE_2D, r.properties.get(p.t).__webglTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    r.state.unbindTexture();
  }
}

// The encoders: a worker each (two on a machine of eight cores or more), each holding 160 MB while it's up, so
// they're put away once there's been nothing to compress for half a minute. A page's signs go to one with their
// places, and come back a KTX2 file; a page cleared before its turn comes isn't done at all (null), or the queue
// fills with pages thrown away when the city's streamed fast.
const coder = { pool: [], queue: [], off: false, idle: 0 };
function encodePage(size, parts, stale) {
  return new Promise((resolve, reject) => {
    coder.queue.push({ size, parts, stale, resolve, reject });
    pump();
  });
}
function pump() {
  clearTimeout(coder.idle);
  if (coder.off) { for (const j of coder.queue.splice(0)) j.reject(new Error('no encoder')); return; }
  const most = (navigator.hardwareConcurrency ?? 2) >= 8 ? 2 : 1;
  for (const j of coder.queue.filter((q) => q.stale())) { coder.queue.splice(coder.queue.indexOf(j), 1); j.resolve(null); }
  while (coder.queue.length) {
    let w = coder.pool.find((x) => !x.job);
    if (!w && coder.pool.length < most) w = worker();
    if (!w) break;
    const j = (w.job = coder.queue.shift());
    w.postMessage({ size: j.size, parts: j.parts }, j.parts.map((q) => q.data));
  }
  if (coder.pool.every((x) => !x.job)) coder.idle = setTimeout(() => { for (const x of coder.pool.splice(0)) x.terminate(); }, 30000);
}
function worker() {
  const w = new Worker(new URL('./SignWorker.js', import.meta.url));
  w.job = null;
  w.onmessage = ({ data }) => {
    const j = w.job;
    w.job = null;
    if (data.ktx2) j.resolve(data.ktx2); else j.reject(new Error(data.error));
    pump();
  };
  // (it couldn't start: the encoder's missing, or the browser won't run it; the pages stay as they are)
  w.onerror = (ev) => {
    ev.preventDefault();
    coder.off = true;
    w.job?.reject(new Error(ev.message || 'the encoder failed to start'));
    w.terminate();
    coder.pool.splice(coder.pool.indexOf(w), 1);
    pump();
  };
  coder.pool.push(w);
  return w;
}

// Fit text to a box: the biggest size up to `max` that fits the width
function fit(g, text, font, maxW, max) {
  let s = max;
  g.font = `${font.weight ?? 700} ${s}px ${font.face}`;
  while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = `${font.weight ?? 700} ${s}px ${font.face}`; }
  return s;
}

// A shop sign. style 'board' (a painted board with a border), 'lightbox' (a lit panel), 'letters'
// (painted straight on the wall's colour), 'neon' (tubes on a dark backing).
export function drawSign(g, w, h, { text, sub = '', style = 'board', bg = '#1d3b2a', fg = '#f2e6c8', accent = null, font = 'serif', weight = 700, wear = 0.5, vertical = false }) {
  const face = FONTS[font] ?? font;
  if (style !== 'letters') { g.fillStyle = bg; g.fillRect(0, 0, w, h); } // (letters on a wall: the wall shows round them)
  if (style === 'board' || style === 'lightbox') {
    const b = Math.max(4, h * 0.06);
    g.strokeStyle = accent ?? fg;
    g.lineWidth = b * 0.5;
    g.strokeRect(b, b, w - 2 * b, h - 2 * b);
  }
  if (style === 'lightbox') { // a glow from inside the panel, brightest in the middle
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0.0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (vertical) { // a blade sign: the letters one under another
    const n = text.length, step = h / (n + 0.4), size = Math.min(w * 0.78, step * 0.86);
    g.font = `${weight} ${size}px ${face}`;
    for (let i = 0; i < n; i++) {
      const y = step * (i + 0.7);
      if (style === 'neon') { g.shadowColor = fg; g.shadowBlur = size * 0.25; g.strokeStyle = fg; g.lineWidth = Math.max(2, size * 0.08); g.strokeText(text[i], w / 2, y); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(text[i], w / 2, y); }
      else { g.fillStyle = fg; g.fillText(text[i], w / 2, y); }
    }
    return;
  }
  const main = sub ? h * 0.56 : h * 0.7;
  const s = fit(g, text, { face, weight }, w * 0.9, main);
  const y = sub ? h * 0.4 : h * 0.53;
  if (style === 'neon') {
    g.shadowColor = fg; g.shadowBlur = h * 0.12;
    g.strokeStyle = fg; g.lineWidth = Math.max(2, s * 0.07);
    g.strokeText(text, w / 2, y);
    g.shadowBlur = h * 0.05; g.fillStyle = '#fff'; g.globalAlpha = 0.5; g.fillText(text, w / 2, y); g.globalAlpha = 1;
    g.shadowBlur = 0;
  } else {
    if (style !== 'letters') { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(text, w / 2 + s * 0.04, y + s * 0.05); }
    g.fillStyle = fg;
    g.fillText(text, w / 2, y);
  }
  if (sub) {
    fit(g, sub.toUpperCase(), { face: FONTS.sans, weight: 600 }, Math.min(w * 0.82, s * sub.length * 0.5), h * 0.17);
    g.fillStyle = accent ?? fg;
    g.fillText(sub.toUpperCase(), w / 2, h * 0.79);
  }
  // sun, salt air and years: faded, flecked, a few chips out of the paint (read where the sign is: the pixels
  // ignore the canvas's transform, and a page's corner was worn again for every sign put on it), the same each time
  // the sign's drawn (seeded by its words and size)
  if (wear > 0) {
    const { e: ox, f: oy } = g.getTransform(), img = g.getImageData(ox, oy, w, h), d = img.data;
    let s = 2166136261; // (FNV-1a of its words, then mulberry32)
    for (const c of `${text}|${sub}|${w}|${h}`) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const n = rnd();
      const fade = wear * 0.16;
      d[i] = d[i] * (1 - fade) + 235 * fade; d[i + 1] = d[i + 1] * (1 - fade) + 225 * fade; d[i + 2] = d[i + 2] * (1 - fade) + 205 * fade;
      if (n < wear * 0.004) { d[i] *= 0.55; d[i + 1] *= 0.55; d[i + 2] *= 0.55; }
      const k = (rnd() - 0.5) * 14 * wear; d[i] += k; d[i + 1] += k; d[i + 2] += k;
    }
    g.putImageData(img, ox, oy);
  }
}

// a small neon window sign ("OPEN", a beer-sign style word): glowing tubes on black, for an additive plane
export function neonTexture(text, color = '#ff3b3b', ring = '#3bb8ff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128);
  g.lineJoin = 'round';
  const tube = (draw, col) => { g.shadowColor = col; g.shadowBlur = 18; g.strokeStyle = col; g.lineWidth = 7; draw(); g.shadowBlur = 6; g.strokeStyle = '#fff'; g.lineWidth = 2.2; draw(); };
  tube(() => { g.beginPath(); g.roundRect(14, 14, 228, 100, 46); g.stroke(); }, ring);
  g.font = `700 58px ${FONTS.sans}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  tube(() => g.strokeText(text, 128, 66), color);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The mural on the laundromat's side, facing Hal's lot: a postcard of the town, painted in the
// eighties and touched up since, the sun striped, palms against it, the sea, the name in block capitals.
export function muralTexture() {
  const W = 2048, H = 1024, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#2f2a6b'); sky.addColorStop(0.45, '#d5517a'); sky.addColorStop(0.8, '#f59a52'); sky.addColorStop(1, '#ffd27a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.62);
  // the sun, striped as it sets
  g.save();
  g.beginPath(); g.arc(W * 0.62, H * 0.6, H * 0.26, Math.PI, 0); g.clip();
  const sun = g.createLinearGradient(0, H * 0.34, 0, H * 0.6);
  sun.addColorStop(0, '#fff1a8'); sun.addColorStop(1, '#ff7a3c');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e3567a';
  for (let i = 0; i < 6; i++) g.fillRect(0, H * (0.46 + i * 0.026), W, H * (0.006 + i * 0.0025));
  g.restore();
  // the sea, and the light on it
  const sea = g.createLinearGradient(0, H * 0.62, 0, H);
  sea.addColorStop(0, '#2b4f8c'); sea.addColorStop(1, '#122c55');
  g.fillStyle = sea; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.strokeStyle = 'rgba(255,190,120,0.75)';
  for (let i = 0; i < 26; i++) { const y = H * (0.64 + i * 0.013), w = (26 - i) * 9; g.lineWidth = 3; g.beginPath(); g.moveTo(W * 0.62 - w, y); g.lineTo(W * 0.62 + w, y); g.stroke(); }
  // palms: trunks curving up, fronds as arcs
  const palm = (x, h, lean) => {
    g.strokeStyle = '#1b1430'; g.fillStyle = '#1b1430'; g.lineCap = 'round';
    g.lineWidth = 22; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.4, H - h * 0.5, x + lean, H - h); g.stroke();
    const tx = x + lean, ty = H - h;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.05 + i * 0.11), r = 150 + (i % 3) * 30;
      g.lineWidth = 10; g.beginPath(); g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * r * 0.6, ty + Math.sin(a) * r * 0.6 - 40, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.5 + 60);
      g.stroke();
    }
  };
  palm(W * 0.12, H * 0.78, 60); palm(W * 0.22, H * 0.62, -40); palm(W * 0.9, H * 0.72, -70);
  // the lettering
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `400 ${H * 0.12}px ${FONTS.script}`;
  g.fillStyle = '#fff6dc';
  g.fillText('Greetings from', W * 0.5, H * 0.2);
  g.font = `900 ${H * 0.27}px ${FONTS.condensed}`;
  g.lineJoin = 'round';
  g.lineWidth = 26; g.strokeStyle = '#1b1430'; g.strokeText('COAST CITY', W * 0.5, H * 0.5);
  const lt = g.createLinearGradient(0, H * 0.27, 0, H * 0.5);
  lt.addColorStop(0, '#5fe0d0'); lt.addColorStop(0.55, '#2d9bc4'); lt.addColorStop(1, '#f2d36b');
  g.fillStyle = lt; g.fillText('COAST CITY', W * 0.5, H * 0.5);
  g.lineWidth = 5; g.strokeStyle = '#fff6dc'; g.strokeText('COAST CITY', W * 0.5, H * 0.5);
  g.font = `600 ${H * 0.035}px ${FONTS.sans}`;
  g.fillStyle = 'rgba(255,246,220,0.8)';
  g.fillText('PAINTED BY THE KIDS OF 5TH STREET · 1986 · RESTORED 2009', W * 0.5, H * 0.97);
  wearPaint(g, W, H, 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A ghost sign: an old painted advert on brick, mostly gone (an alpha mask over the wall)
export function ghostTexture(lines = ['CRANDALL', 'HOTEL', 'ROOMS · BATHS · BY THE WEEK']) {
  const W = 1024, H = 768, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(232,222,196,0.0)'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(236,226,200,1)';
  g.fillRect(40, 40, W - 80, H - 80);
  g.fillStyle = 'rgba(120,40,30,1)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 210px ${FONTS.condensed}`; g.fillText(lines[0], W / 2, 210);
  g.font = `900 170px ${FONTS.serif}`; g.fillText(lines[1], W / 2, 420);
  g.font = `700 58px ${FONTS.sans}`; g.fillText(lines[2], W / 2, 600);
  // most of the paint has weathered off between the bricks
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const n = Math.sin(x * 0.021 + Math.sin(y * 0.013) * 3) * 0.5 + Math.sin(y * 0.047 + x * 0.007) * 0.3 + Math.random() * 0.6;
    d[i + 3] = d[i + 3] * Math.max(0, Math.min(1, 0.25 + n * 0.45));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wearPaint(g, W, H, k) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = Math.random();
    const f = k * 0.14;
    d[i] = d[i] * (1 - f) + 230 * f; d[i + 1] = d[i + 1] * (1 - f) + 220 * f; d[i + 2] = d[i + 2] * (1 - f) + 200 * f;
    if (n < 0.0015 * k) { d[i] = d[i + 1] = d[i + 2] = 215; }
  }
  g.putImageData(img, 0, 0);
}

// The labels on the shops' goods: an 8 x 8 atlas of made-up brands (cereal, chips, soap, cans, beer),
// each a coloured box with a band, a name and a little picture
export function goodsTexture() {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), cell = S / 8;
  const names = ['CRUNCHOS', 'SUNNY O\'s', 'TIDEWAY', 'PACIFICA', 'EL SOL', 'BAYSIDE', 'ZESTY', 'GOLDEN', 'MESA', 'OCEANA', 'SURF', 'NOVA', 'RANCHO', 'PALMA', 'CORONET', 'VISTA'];
  const cols = ['#c0201b', '#1f4f9a', '#f2c12e', '#2f8a45', '#e2702a', '#7a2a8a', '#f4f1ea', '#1d1d1d', '#3bb8c8', '#a5281e', '#f2e0b0', '#4a6a2a'];
  let r = 7;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 64; i++) {
    const x = (i % 8) * cell, y = Math.floor(i / 8) * cell, a = cols[Math.floor(rnd() * cols.length)], b = cols[Math.floor(rnd() * cols.length)];
    g.fillStyle = a; g.fillRect(x, y, cell, cell);
    g.fillStyle = b; g.fillRect(x, y + cell * (0.25 + rnd() * 0.2), cell, cell * 0.22);
    g.fillStyle = rnd() < 0.5 ? '#ffffff' : '#1d1d1d';
    g.font = `800 ${cell * 0.17}px ${FONTS.condensed}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(names[Math.floor(rnd() * names.length)], x + cell / 2, y + cell * 0.36 + cell * 0.08);
    g.beginPath(); g.arc(x + cell / 2, y + cell * 0.72, cell * (0.1 + rnd() * 0.08), 0, Math.PI * 2);
    g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fill();
    if (i >= 48) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + cell * 0.08, y, cell * 0.06, cell); } // a can's shine
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
