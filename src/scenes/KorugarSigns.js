import * as THREE from 'three';
import { createSinestro } from '../characters/Characters.js';
import { toGlyphs } from '../ui/UI.js';
import { glowTexture } from '../fx/Textures.js';

// Korugar's capital as its ruler would have it (the user, 2026-11-17: "basically like a New York
// Times Square, but for Sinestro"): his face and his slogans on screens stacked up the towers round
// the plaza and down the Avenue of Order, a ticker running round a tower, neon blade signs over the
// streets, and traffic in lanes between the towers.
//
// The screens show eight channels (`CHANNELS`), each a small canvas redrawn eight times a second and
// shared by every screen tuned to it, one instanced quad per channel: his portrait (his own figure,
// rendered once into a picture: `renderPortrait`), the slogans, the emblem, the "report disorder"
// notices, a saluting crowd, the news, the count of the years of order, his statue. Their colours are
// kept under the bloom's threshold, and the canvases are mipmapped, so nothing on them crawls with
// distance.

const GLYPH_FONT = '"Noto Sans Runic", "Segoe UI Symbol", sans-serif';
const W = 512, H = 256; // a channel's canvas (screens are 2:1)
const SLOGANS = ['ORDER IS PEACE', 'FEAR IS ORDER', 'THE LANTERN WATCHES', 'OBEY AND BE SAFE', 'SINESTRO PROTECTS'];
const NEWS = ['NO CRIME IN THE CAPITAL', 'MARKET QUOTAS MET', 'THE QUARTER IS QUIET', 'CURFEW AT DUSK', 'REPORT LAUGHTER', 'GLORY TO THE LANTERN'];
export const CHANNELS = ['portrait', 'slogan', 'emblem', 'wanted', 'salute', 'news', 'count', 'statue'];

// His face, for the screens: his own figure lit in a small studio scene and rendered once into a
// picture (a canvas, transparent round him).
export function renderPortrait(engine, abinGltf, size = 512) {
  const renderer = engine.renderer, rig = createSinestro(abinGltf);
  const scene = new THREE.Scene();
  scene.environment = engine.envMap;
  scene.environmentIntensity = 0.3;
  scene.add(rig.root);
  rig.root.updateMatrixWorld(true);
  const head = rig.bonePosition('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.07, 0));
  const key = new THREE.DirectionalLight(0xffd9b0, 2.2);
  key.position.copy(head).add(new THREE.Vector3(-0.8, 0.6, 1.2));
  key.target.position.copy(head);
  const rim = new THREE.DirectionalLight(0xff8a3a, 2.4);
  rim.position.copy(head).add(new THREE.Vector3(0.9, 0.3, -1));
  rim.target.position.copy(head);
  scene.add(key, key.target, rim, rim.target, new THREE.HemisphereLight(0x8a6a78, 0x201010, 0.5));
  const cam = new THREE.PerspectiveCamera(20, 1, 0.05, 10);
  cam.position.copy(head).add(new THREE.Vector3(0.22, 0.02, 0.95));
  cam.lookAt(head.clone().add(new THREE.Vector3(0.02, -0.02, 0)));
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // (rows bottom up)
  g.putImageData(img, 0, 0);
  return c;
}

export class Broadcast {
  constructor({ portrait }) {
    this.portrait = portrait;
    this.channels = CHANNELS.map((name) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return { name, c, g: c.getContext('2d'), tex };
    });
    this.t = 0;
    this.acc = 0;
    this.draw();
  }

  channel(name) { return this.channels[CHANNELS.indexOf(name)]; }

  update(dt) {
    this.t += dt;
    this.acc += dt;
    if (this.acc < 1 / 8) return;
    this.acc = 0;
    this.draw();
  }

  draw() {
    const t = this.t;
    for (const ch of this.channels) {
      const g = ch.g;
      g.save();
      this[`draw_${ch.name}`](g, t);
      g.restore();
      // a frame line round every picture, the broadcaster's bug in the corner
      g.strokeStyle = 'rgba(200,150,70,0.55)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
      g.fillStyle = 'rgba(210,160,80,0.8)'; g.font = `16px ${GLYPH_FONT}`; g.textAlign = 'right';
      g.fillText(toGlyphs('KORUGAR'), W - 14, H - 12);
      ch.tex.needsUpdate = true;
    }
  }

  bg(g, a = '#9a1a16', b = '#2a0605') {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  glyphs(g, text, x, y, size, color = '#ffd27a', align = 'center') {
    g.font = `${size}px ${GLYPH_FONT}`; g.textAlign = align; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(toGlyphs(text), x, y);
  }

  emblem(g, x, y, r, color) {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = r * 0.28;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.fillRect(x - r * 1.7, y - r * 1.25, r * 3.4, r * 0.3); g.fillRect(x - r * 1.7, y + r * 0.95, r * 3.4, r * 0.3);
  }

  // his face, a slow push in and drift, his name under it
  draw_portrait(g, t) {
    this.bg(g, '#b02a18', '#3a0806');
    const s = 1.05 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.21)), px = 40 * Math.sin(t * 0.13);
    const h = H * 1.35 * s;
    g.globalAlpha = 0.95;
    g.drawImage(this.portrait, W * 0.5 - h / 2 + px - 70, H * 0.5 - h * 0.47, h, h);
    g.globalAlpha = 1;
    const gr = g.createLinearGradient(W * 0.5, 0, W, 0);
    gr.addColorStop(0, 'rgba(60,8,6,0)'); gr.addColorStop(1, 'rgba(60,8,6,0.9)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    this.glyphs(g, 'SINESTRO', W * 0.78, H * 0.42, 46);
    this.glyphs(g, 'HE PROTECTS', W * 0.78, H * 0.62, 24, '#f0b860');
  }

  // a slogan at a time, sliding up out of the last
  draw_slogan(g, t) {
    this.bg(g, '#c22a1a', '#4a0a06');
    const i = Math.floor(t / 4) % SLOGANS.length, k = (t % 4) / 4;
    const y = H / 2 + (k < 0.12 ? (1 - k / 0.12) * 40 : 0);
    g.globalAlpha = k < 0.12 ? k / 0.12 : k > 0.9 ? (1 - k) / 0.1 : 1;
    this.glyphs(g, SLOGANS[i], W / 2, y, 52);
    g.globalAlpha = 1;
    g.fillStyle = '#ffd27a'; g.fillRect(W * 0.2, H * 0.78, W * 0.6, 4);
  }

  // the Corps' emblem in his gold, breathing, rays turning behind it
  draw_emblem(g, t) {
    this.bg(g, '#5a0e0a', '#1a0403');
    g.save(); g.translate(W / 2, H / 2); g.rotate(t * 0.08);
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = i % 2 ? 'rgba(230,110,40,0.45)' : 'rgba(160,40,24,0.4)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -40); g.lineTo(W, 40); g.closePath(); g.fill(); }
    g.restore();
    const p = 0.85 + 0.15 * Math.sin(t * 2.2);
    this.emblem(g, W / 2, H / 2, 46 * p, `rgba(${Math.round(255 * p)},${Math.round(205 * p)},110,1)`);
  }

  // faces in a grid, one at a time marked: report disorder
  draw_wanted(g, t) {
    this.bg(g, '#4a0e0c', '#140303');
    const hi = Math.floor(t / 1.2) % 6;
    for (let i = 0; i < 6; i++) {
      const x = 52 + (i % 3) * 92, y = 64 + Math.floor(i / 3) * 104;
      g.fillStyle = i === hi ? '#7a1412' : '#2e1112'; g.fillRect(x - 38, y - 44, 76, 88);
      g.fillStyle = '#0c0405'; g.beginPath(); g.arc(x, y - 10, 18, 0, 7); g.fill(); g.fillRect(x - 26, y + 12, 52, 30);
      if (i === hi) { g.strokeStyle = '#e04a30'; g.lineWidth = 4; g.strokeRect(x - 38, y - 44, 76, 88); }
    }
    this.glyphs(g, 'REPORT', 400, 92, 44, '#e05a3a');
    this.glyphs(g, 'DISORDER', 400, 150, 34, '#d9a250');
  }

  // the plaza saluting, a wave of fists going along the rows
  draw_salute(g, t) {
    this.bg(g, '#e0581c', '#5a1206');
    for (let row = 0; row < 3; row++) for (let i = 0; i < 18; i++) {
      const x = 14 + i * 29 + row * 9, base = H - 18 - row * 34, sc = 1 - row * 0.18;
      const up = Math.max(0, Math.sin(t * 3 - i * 0.45 - row));
      g.fillStyle = `rgba(${20 + row * 14},${8 + row * 6},${8 + row * 6},1)`;
      g.beginPath(); g.arc(x, base - 36 * sc, 8 * sc, 0, 7); g.fill();
      g.fillRect(x - 9 * sc, base - 28 * sc, 18 * sc, 28 * sc);
      g.fillRect(x + 4 * sc, base - 28 * sc - 22 * sc * up, 5 * sc, 22 * sc * up + 4);
    }
    this.glyphs(g, 'ORDER IS PEACE', W / 2, 46, 38);
  }

  // the news: his picture small, the headlines going by under the anchor's line
  draw_news(g, t) {
    this.bg(g, '#8a1a14', '#2a0605');
    g.drawImage(this.portrait, 14, 18, 170, 170);
    g.fillStyle = '#7a1412'; g.fillRect(0, H - 54, W, 54);
    const i = Math.floor(t / 3) % NEWS.length;
    this.glyphs(g, NEWS[i], 196, 66, 26, '#e6c07a', 'left');
    this.glyphs(g, NEWS[(i + 1) % NEWS.length], 196, 112, 20, '#a17c48', 'left');
    g.save(); g.beginPath(); g.rect(0, H - 54, W, 54); g.clip();
    const strip = NEWS.join('   ◆   ');
    g.font = `22px ${GLYPH_FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#f0d49a';
    const shift = (t * 60) % 900;
    g.fillText(toGlyphs(strip), W - shift, H - 27); g.fillText(toGlyphs(strip), W - shift + 900, H - 27);
    g.restore();
  }

  // the years of order, counted
  draw_count(g, t) {
    this.bg(g, '#2a0806', '#8a1c10');
    const days = 2557 + Math.floor(t / 10);
    g.font = '700 96px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd88a';
    g.fillText(days.toLocaleString('en-US'), W / 2, H * 0.44);
    this.glyphs(g, 'DAYS WITHOUT A MURDER', W / 2, H * 0.78, 26, '#b98a46');
  }

  // his statue against a sunburst
  draw_statue(g, t) {
    this.bg(g, '#e06a20', '#6a1406');
    g.save(); g.translate(W / 2, H * 1.05);
    for (let i = 0; i < 20; i++) { g.rotate(Math.PI / 10); g.fillStyle = i % 2 ? 'rgba(255,190,110,0.18)' : 'rgba(255,140,60,0.08)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-30, -W); g.lineTo(30, -W); g.closePath(); g.fill(); }
    g.restore();
    g.fillStyle = '#1a0606';
    const x = W / 2 + 10 * Math.sin(t * 0.3);
    g.fillRect(x - 40, H - 30, 80, 30); g.fillRect(x - 26, H - 52, 52, 22); // the pedestal
    g.beginPath(); g.moveTo(x - 20, H - 52); g.lineTo(x - 26, H - 140); g.quadraticCurveTo(x, H - 160, x + 26, H - 140); g.lineTo(x + 20, H - 52); g.closePath(); g.fill();
    g.beginPath(); g.arc(x, H - 172, 16, 0, 7); g.fill();
    this.glyphs(g, 'SEVEN YEARS OF ORDER', W * 0.78, H * 0.3, 22);
  }
}

// Screens: instanced quads per channel and one instanced bezel. add(channel, at, yaw, w) puts a 2:1
// screen there facing along yaw; build() makes the meshes.
export class ScreenWall {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.list = [];
  }
  add(channel, at, yaw, w) { this.list.push({ channel, at: at.clone(), yaw, w }); }
  build(scene) {
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();
    const bezel = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x141012, roughness: 0.5, metalness: 0.6 }), this.list.length);
    this.list.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      m4.compose(s.at, q, new THREE.Vector3(s.w + 0.5, s.w / 2 + 0.5, 0.35));
      bezel.setMatrixAt(i, m4);
    });
    bezel.castShadow = true;
    scene.add(bezel);
    // the light they throw on the wall round them: a soft warm pool behind each bezel
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,170,110,0.55)', 'rgba(255,120,60,0.22)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), this.list.length);
    this.list.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      fwd.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      m4.compose(s.at.clone().addScaledVector(fwd, -0.12), q, new THREE.Vector3(s.w * 1.9, s.w * 1.15, 1));
      glow.setMatrixAt(i, m4);
    });
    glow.frustumCulled = false;
    glow.renderOrder = 2;
    scene.add(glow);
    for (const name of CHANNELS) {
      const mine = this.list.filter((s) => s.channel === name);
      if (!mine.length) continue;
      const mat = new THREE.MeshBasicMaterial({ map: this.broadcast.channel(name).tex, color: new THREE.Color(1.05, 1.0, 0.98) });
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.5), mat, mine.length);
      mine.forEach((s, i) => {
        q.setFromAxisAngle(up, s.yaw);
        fwd.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
        m4.compose(s.at.clone().addScaledVector(fwd, 0.19), q, new THREE.Vector3(s.w, s.w, 1));
        inst.setMatrixAt(i, m4);
      });
      inst.frustumCulled = false;
      scene.add(inst);
    }
  }
}

// A ticker round a tower: one long strip of glyph headlines, scrolled by its texture's offset (no
// redraw), on the four faces of a box band.
export function tickerBand(scene, { x, z, w, d, yaw, y, h = 2.2 }) {
  const c = document.createElement('canvas');
  c.width = 4096; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#120304'; g.fillRect(0, 0, 4096, 128);
  g.fillStyle = '#7a1412'; g.fillRect(0, 0, 4096, 10); g.fillRect(0, 118, 4096, 10);
  g.font = `64px ${GLYPH_FONT}`; g.textBaseline = 'middle'; g.fillStyle = '#e6b86a';
  let cx = 20;
  while (cx < 4096) for (const n of [...NEWS, ...SLOGANS]) { const s = toGlyphs(n) + '   ◆   '; g.fillText(s, cx, 66); cx += g.measureText(s).width; if (cx > 4096) break; }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  const per = 2 * (w + d), pos = [], uv = [], idx = [];
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  let run = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[i + 1], len = Math.hypot(bx - ax, bz - az), o = pos.length / 3;
    // (pushed out a little from the face, outward from the tower's centre)
    const nx = (ax + bx) / 2, nz = (az + bz) / 2, nl = Math.hypot(nx, nz), ox = (nx / nl) * 0.25, oz = (nz / nl) * 0.25;
    pos.push(ax + ox, -h / 2, az + oz, bx + ox, -h / 2, bz + oz, bx + ox, h / 2, bz + oz, ax + ox, h / 2, az + oz);
    const u0 = (run / per) * (per / 40), u1 = ((run + len) / per) * (per / 40);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    run += len;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.85, 0.85, 0.85), side: THREE.DoubleSide }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  // its frame, top and bottom
  const rail = new THREE.MeshStandardMaterial({ color: 0x241a14, metalness: 0.7, roughness: 0.4 });
  for (const sy of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.18, d + 0.9), rail);
    r.position.set(x, y + sy * (h / 2 + 0.09), z);
    r.rotation.y = yaw;
    scene.add(r);
  }
  return { update: (dt) => { tex.offset.x += dt * 0.06; } };
}

// A neon blade sign: a slab standing out from a facade, its glyphs down both faces. Static (no
// flicker: the user's note on the palace scene).
const NEON = ['#ff8a3a', '#ffcf6a', '#ff4d4d', '#6ae0c8', '#c88aff'];
export const NEON_COLORS = NEON; // (a sign's is NEON[seed % 5]: its streak in the wet street, KorugarWet.js)
const SIGN_WORDS = ['MARKET', 'BREAD', 'ORDER', 'TEA', 'LAMPS', 'CLOTH', 'OBEY', 'METALS', 'SPICE', 'GLORY', 'SAFE', 'WATER'];
export function bladeSign(scene, at, yaw, seed) {
  const word = SIGN_WORDS[seed % SIGN_WORDS.length], col = NEON[seed % NEON.length];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0607'; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = col; g.lineWidth = 6; g.globalAlpha = 0.9; g.strokeRect(10, 10, 108, 492);
  g.globalAlpha = 1;
  g.font = `64px ${GLYPH_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col;
  const glyphs = [...toGlyphs(word)];
  glyphs.forEach((ch, i) => g.fillText(ch, 64, 60 + i * ((420) / Math.max(1, glyphs.length - 1 || 1))));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.9, 0.9, 0.9) });
  const edge = new THREE.MeshStandardMaterial({ color: 0x1a1414, metalness: 0.6, roughness: 0.5 });
  // the slab's broad faces are its sides (it stands out from the wall along yaw)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 1.1), [face, face, edge, edge, edge, edge]);
  mesh.position.copy(at);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), edge);
  arm.position.copy(at).add(new THREE.Vector3(0, 2.2, 0));
  arm.rotation.y = yaw;
  scene.add(arm);
  return mesh;
}

// Traffic: skycars in lanes between the towers, well above the streets (rings round the plaza, runs
// along the avenue), each a dark hull with a white lamp ahead and a red one behind.
export class SkyTraffic {
  constructor(scene, lanes, count = 46) {
    const hull = new THREE.CapsuleGeometry(0.9, 2.6, 4, 10).rotateX(Math.PI / 2).scale(1.2, 0.6, 1);
    const fin = new THREE.BoxGeometry(3.2, 0.12, 0.9).translate(0, 0.1, -0.9);
    this.hulls = new THREE.InstancedMesh(hull, new THREE.MeshStandardMaterial({ color: 0x2a2328, metalness: 0.7, roughness: 0.35 }), count);
    this.fins = new THREE.InstancedMesh(fin, new THREE.MeshStandardMaterial({ color: 0x4a2a18, metalness: 0.8, roughness: 0.4 }), count);
    this.heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.18, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.25, 1.1) }), count);
    this.tails = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.16, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.12, 0.08) }), count);
    for (const m of [this.hulls, this.fins, this.heads, this.tails]) { m.frustumCulled = false; scene.add(m); }
    this.cars = Array.from({ length: count }, (_, i) => ({ lane: lanes[i % lanes.length], s: Math.random(), v: 14 + Math.random() * 9 }));
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.d = new THREE.Vector3(); this.o = new THREE.Vector3();
    this.update(0);
  }
  update(dt) {
    const { m4, q, p, d, o } = this, one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
    this.cars.forEach((c, i) => {
      c.s = (c.s + (dt * c.v) / c.lane.length) % 1;
      c.lane.at(c.s, p, d);
      q.setFromAxisAngle(Y, Math.atan2(d.x, d.z));
      m4.compose(p, q, one);
      this.hulls.setMatrixAt(i, m4); this.fins.setMatrixAt(i, m4);
      m4.compose(o.copy(d).multiplyScalar(2.15).add(p), q, one); this.heads.setMatrixAt(i, m4);
      m4.compose(o.copy(d).multiplyScalar(-2.15).add(p), q, one); this.tails.setMatrixAt(i, m4);
    });
    for (const m of [this.hulls, this.fins, this.heads, this.tails]) m.instanceMatrix.needsUpdate = true;
  }
}

// A lane: a circle (r, y, direction) or a straight run there and back.
export const ringLane = (r, y, dir = 1) => ({ length: Math.PI * 2 * r, at: (s, p, d) => { const a = dir * s * Math.PI * 2; p.set(Math.cos(a) * r, y, Math.sin(a) * r); d.set(-Math.sin(a) * dir, 0, Math.cos(a) * dir); } });
export const runLane = (a, b) => {
  const len = a.distanceTo(b);
  return { length: len * 2, at: (s, p, d) => {
    const there = s < 0.5, k = there ? s * 2 : (s - 0.5) * 2;
    const from = there ? a : b, to = there ? b : a;
    p.lerpVectors(from, to, k);
    d.copy(to).sub(from).normalize();
    // (back the other way on a lane two metres over and four up)
    if (!there) p.add(new THREE.Vector3(d.z, 0, -d.x).multiplyScalar(2)).add(new THREE.Vector3(0, 4, 0));
  } };
};
