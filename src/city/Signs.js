// Coast City's lettering, painted on canvas: shop signs packed into two atlases (painted boards, and
// lightboxes that glow at night), window neon, the mural facing Hal's lot and a ghost sign.
import * as THREE from 'three';

const FONTS = {
  serif: '"Didot", "Bodoni 72", "Georgia", serif',
  slab: '"Rockwell", "American Typewriter", "Courier New", serif',
  sans: '"Futura", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
  condensed: '"Avenir Next Condensed", "Helvetica Neue", "Arial Narrow", sans-serif',
  script: '"Brush Script MT", "Snell Roundhand", "Apple Chancery", cursive',
  deco: '"Copperplate", "Futura", "Gill Sans", sans-serif',
};

export const FONT_OF = (f) => FONTS[f] ?? f ?? FONTS.serif;

// shelf-packed canvas: add(w, h, draw) draws into a w x h cell and returns its uv rect
export class SignAtlas {
  constructor(size = 2048) {
    this.c = document.createElement('canvas');
    this.c.width = this.c.height = size;
    this.g = this.c.getContext('2d');
    this.size = size;
    this.x = 0; this.y = 0; this.row = 0;
    this.texture = new THREE.CanvasTexture(this.c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }
  // whether a sign of this size still goes in (where `add` would put it)
  fits(w, h) {
    w = Math.ceil(w); h = Math.ceil(h);
    return (this.x + w > this.size ? this.y + this.row + 2 : this.y) + h <= this.size;
  }
  add(w, h, draw) {
    w = Math.ceil(w); h = Math.ceil(h);
    if (this.x + w > this.size) { this.x = 0; this.y += this.row + 2; this.row = 0; }
    const x = this.x, y = this.y;
    if (y + h > this.size) console.warn('sign atlas full', w, h);
    this.x += w + 2;
    this.row = Math.max(this.row, h);
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    draw(g, w, h);
    g.restore();
    this.texture.needsUpdate = true;
    const S = this.size;
    return { u0: x / S, v0: 1 - (y + h) / S, u1: (x + w) / S, v1: 1 - y / S };
  }
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
  // sun, salt air and years: faded, flecked, a few chips out of the paint
  if (wear > 0) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const n = Math.random();
      const fade = wear * 0.16;
      d[i] = d[i] * (1 - fade) + 235 * fade; d[i + 1] = d[i + 1] * (1 - fade) + 225 * fade; d[i + 2] = d[i + 2] * (1 - fade) + 205 * fade;
      if (n < wear * 0.004) { d[i] *= 0.55; d[i + 1] *= 0.55; d[i + 2] *= 0.55; }
      const k = (Math.random() - 0.5) * 14 * wear; d[i] += k; d[i + 1] += k; d[i + 2] += k;
    }
    g.putImageData(img, 0, 0);
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
