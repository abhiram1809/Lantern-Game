import * as THREE from 'three';

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

const finish = (c, { repeat = [1, 1], color = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
};

// Blotchy value noise: plaster, carpet, mud.
export function noiseTexture({ size = 512, base = '#888', spots = 1800, spread = 22, alpha = 0.06, light = '#fff', dark = '#000', repeat = [1, 1], fine = 0.08 } = {}) {
  const [c, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < spots; i++) {
    g.globalAlpha = alpha * Math.random();
    g.fillStyle = Math.random() < 0.5 ? light : dark;
    const r = Math.random() * spread + 2, x = Math.random() * size, y = Math.random() * size;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.beginPath();
      g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const img = g.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * fine;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 1;
  return finish(c, { repeat });
}

export function woodTexture({ base = '#7a5534', repeat = [1, 1], planks = 0 } = {}) {
  const size = 512;
  const [c, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 1) {
    const v = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 6) * 0.5 + 0.5;
    g.fillStyle = `rgba(40,22,10,${0.05 + v * 0.16})`;
    g.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(30,15,5,${Math.random() * 0.18})`;
    g.lineWidth = Math.random() * 2;
    const y = Math.random() * size;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(size * 0.3, y + rnd(-8, 8), size * 0.6, y + rnd(-8, 8), size, y + rnd(-3, 3));
    g.stroke();
  }
  if (planks) {
    g.fillStyle = 'rgba(15,8,3,0.65)';
    for (let k = 0; k <= planks; k++) g.fillRect(0, (k * size) / planks - 1, size, 2);
  }
  return finish(c, { repeat });
}
const rnd = (a, b) => a + Math.random() * (b - a);

export function fabricTexture({ base = '#556', repeat = [4, 4], weave = 0.08, blotches = 400 } = {}) {
  const size = 256;
  const [c, g] = canvas(size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 4) {
    g.fillStyle = `rgba(255,255,255,${weave})`;
    g.fillRect(i, 0, 1, size);
    g.fillStyle = `rgba(0,0,0,${weave})`;
    g.fillRect(0, i, size, 1);
  }
  for (let i = 0; i < blotches; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * size, Math.random() * size, rnd(10, 60), rnd(10, 60));
  }
  return finish(c, { repeat });
}

export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(120,255,170,0.35)') {
  const [c, g] = canvas(256);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.25, mid);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return finish(c);
}

// Red seven-segment-style alarm clock face.
export class ClockFace {
  constructor() {
    [this.canvas, this.g] = canvas(256, 96);
    this.texture = finish(this.canvas);
    this.set('9:47');
  }
  set(text, pm = true) {
    const g = this.g;
    g.fillStyle = '#060202';
    g.fillRect(0, 0, 256, 96);
    g.font = 'bold 70px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#2a0404';
    g.fillText('88:88', 122, 52);
    g.shadowColor = '#ff2a1a';
    g.shadowBlur = 14;
    g.fillStyle = '#ff3b24';
    g.fillText(text.padStart(5, ' '), 122, 52);
    g.shadowBlur = 0;
    g.font = 'bold 16px sans-serif';
    g.fillText(pm ? 'PM' : 'AM', 236, 22);
    this.texture.needsUpdate = true;
  }
}

// Faded photo of Martin Jordan beside his jet, for the frame on Hal's desk.
export function photoTexture() {
  const [c, g] = canvas(256, 320);
  const sky = g.createLinearGradient(0, 0, 0, 320);
  sky.addColorStop(0, '#c9a77a');
  sky.addColorStop(0.65, '#e6cfa6');
  sky.addColorStop(0.66, '#8c7656');
  sky.addColorStop(1, '#5e4c36');
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#3d3226';
  g.beginPath(); // jet
  g.moveTo(20, 185); g.lineTo(200, 175); g.lineTo(240, 182); g.lineTo(200, 192); g.lineTo(30, 198); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(90, 186); g.lineTo(150, 186); g.lineTo(110, 215); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(30, 186); g.lineTo(48, 150); g.lineTo(58, 186); g.closePath(); g.fill();
  g.fillStyle = '#2c241b'; // pilot
  g.beginPath(); g.arc(178, 200, 11, 0, Math.PI * 2); g.fill();
  g.fillRect(166, 210, 24, 50);
  g.fillRect(168, 258, 8, 40); g.fillRect(180, 258, 8, 40);
  g.fillRect(188, 212, 22, 7);
  const v = g.createRadialGradient(128, 160, 60, 128, 160, 190);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(40,20,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 320);
  return finish(c);
}
