import * as THREE from 'three';
import { onFrame } from '../engine/Time.js';
import { CITY, HALS_LOT, LOT_Z, PIER, FREEWAY, CHANNEL, STREET_Z, streetX, shoreX, coastX, cityCells, K_MIN, K_MAX, NS, EW } from '../city/Plan.js';

// The map of Coast City and the valley (the user, 2026-11-19: "a map on top left, just like GTA, so that
// I can browse through the city"). A radar in the top-left corner that turns with the camera, and the
// whole map (N, or the phone's Maps) to browse: north up, pan and zoom, a waypoint set where the
// crosshair is. Both drawn from the city's plan (city/Plan.js) as it's built: its blocks, streets and
// districts, the parks, the channel and its bridges, the freeway, the beach and the pier; Hal's blocks
// and his lot, the road south to the field, Ferris Aircraft's runway and hangars; and on top the places
// people go (from the people who work in them), his home, his car, the city's emergency, the HUD's
// marker. The world's x runs east and z north with the view mirrored from a compass's (facing north,
// east is on the left), so the map is the ground turned half a turn: what's left on screen is left here.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COL = {
  desert: '#24292d', city: '#626a73', block: '#323940', blockCore: '#363e46', downtown: '#3d4650', hal: '#3f4a55',
  park: '#2f6040', parkPath: '#4a7a56', sea: '#163353', beach: '#857a5c', channel: '#2a4f6a', freeway: '#c79a55', road: '#5d656e',
  runway: '#1a1d20', apron: '#4b5259', hangar: '#7a838c', lot: '#4c545c',
};
// places people go: who works there (CityLife's people), the icon and its colour
const PLACES = [
  ['Rosie', 'R', '#ff8a5c', 'Rosie’s Diner'], ['Ray', 'L', '#d7c25a', 'Coast Liquor'], ['Gus', 'B', '#e0a64a', 'The Blue Marlin'],
  ['The desk sergeant', 'P', '#6aa8ff', '14th Precinct'], ['The triage nurse', '+', '#ff6a6a', 'St. Mary’s'], ['The usher', 'C', '#c88bff', 'The Palms'],
  ['The teller', '$', '#7de0a0', 'Savings & Loan'], ['The receptionist', 'F', '#9fd8ff', 'Ferris offices'], ['The trainer', 'G', '#ffb36b', 'Iron Beach gym'],
];

export class CityMap {
  constructor(story) {
    this.story = story;
    this.cells = cityCells();
    this.mpp = 1.2; // (metres a pixel on the radar)
    this.t = 0;
    // the radar
    const mini = (this.mini = document.createElement('div'));
    mini.id = 'minimap';
    mini.innerHTML = '<canvas></canvas><span class="n">N</span><span class="where"></span>';
    document.getElementById('hud').appendChild(mini);
    this.mc = mini.querySelector('canvas');
    this.where = mini.querySelector('.where');
    this.north = mini.querySelector('.n');
    // the whole map
    const full = (this.full = document.createElement('div'));
    full.id = 'citymap';
    full.innerHTML = `<canvas></canvas><div class="cross"></div><div class="side"><b>COAST CITY</b><i>and the valley</i><div class="legend"></div></div><div class="keys"><b>WASD</b> pan &nbsp; <b>Q</b> <b>E</b> or wheel zoom &nbsp; <b>Enter</b> or click: waypoint &nbsp; <b>Backspace</b> clear it &nbsp; <b>N</b> close</div><div class="look"></div>`;
    document.getElementById('ui').appendChild(full);
    this.fc = full.querySelector('canvas');
    this.look = full.querySelector('.look');
    full.querySelector('.legend').innerHTML = [['⌂', '#7dffc8', 'Home'], ...PLACES.map((p) => [p[1], p[2], p[3]]), ['✈', '#9fd8ff', 'Ferris Aircraft'], ['▣', '#e8e2b8', 'His car'], ['!', '#ff5a4a', 'Emergency'], ['◆', '#7dffc8', 'Waypoint']]
      .map(([g, c, n]) => `<div><span style="background:${c}">${g}</span>${n}</div>`).join('');
    this.fc.addEventListener('wheel', (e) => { if (this.fullOpen) { this.zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2); e.preventDefault(); } }, { passive: false });
    this.fc.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY, cx: this.fv.x, cz: this.fv.z, moved: 0 }; });
    window.addEventListener('mousemove', (e) => {
      if (!this.drag || !this.fullOpen) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
      this.fv.x = this.drag.cx + dx * this.fv.mpp; this.fv.z = this.drag.cz + dy * this.fv.mpp; // (the map's turned half a turn)
      this.drawFull();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.drag && this.fullOpen && this.drag.moved < 4) { const r = this.fc.getBoundingClientRect(); const w = this.fromScreen(e.clientX - r.left, e.clientY - r.top, this.fv); this.setWaypoint(w.x, w.z); }
      this.drag = null;
    });
  }

  // ---------------------------------------------------------------- the radar, each frame
  get here() { const s = this.story; return s.driving && s.ferrisScene?.car ? s.ferrisScene.car.position : s.player.position; }
  update(dt) {
    const s = this.story, on = !!s.roaming && s.current === s.ferrisScene && !!s.ferrisScene && s.player.rig != null && !s.flyingCard;
    this.mini.classList.toggle('show', on);
    document.getElementById('hud').classList.toggle('mapped', on);
    if (this.waypoint && Math.hypot(this.here.x - this.waypoint.x, this.here.z - this.waypoint.z) < 18) this.clearWaypoint(true);
    if (!on) return;
    this.t += dt;
    // further out the faster he goes and the higher he is
    const p = this.here, sp = s.driving ? Math.hypot(s.drive?.speed ?? 10, 0) : s.player.flying ? Math.hypot(s.player.velocity?.x ?? 0, s.player.velocity?.z ?? 0) : 0;
    const want = s.player.flying ? Math.min(7, 1.6 + p.y / 30 + sp / 12) : s.driving ? 2.4 : 1.15;
    this.mpp += (want - this.mpp) * Math.min(1, dt * 2);
    if (this.t < 1 / 20) return;
    this.t = 0;
    const cam = s.engine.camera, d = cam.getWorldDirection(_d);
    const psi = Math.atan2(d.x, d.z);
    const rot = -Math.PI / 2 - Math.atan2(-Math.cos(psi), -Math.sin(psi));
    const c = this.mc, W = (c.width = c.clientWidth * 2 || 400), H = (c.height = c.clientHeight * 2 || 400);
    const g = c.getContext('2d');
    this.draw(g, W, H, { x: p.x, z: p.z, mpp: this.mpp / 2, rot }, false);
    // the north mark on the rim, where north (+z, up on a map that isn't turned) is now
    const r = (c.clientWidth / 2) * 0.84;
    this.north.style.transform = `translate(${Math.sin(rot) * r}px, ${-Math.cos(rot) * r}px)`;
    this.where.textContent = this.placeName(p.x, p.z);
  }

  placeName(x, z) {
    const lz = z - LOT_Z;
    if (lz < CITY.z0 - 300) return lz < -5700 ? 'Ferris Aircraft' : 'The road to the field';
    if (x < shoreX(lz) - 5) return 'The bay';
    if (Math.abs(lz - PIER.z) < PIER.w && x < PIER.x0 && x > PIER.x1) return 'The pier';
    if (x > HALS_LOT.x0 - 40 && x < HALS_LOT.x1 + 40 && lz < HALS_LOT.z1 && lz > CITY.z0) return 'Hal’s block';
    const cell = this.cells.find((c) => x > c.x0 - NS.front && x < c.x1 + NS.front && lz > c.z0 - EW.front && lz < c.z1 + EW.front);
    if (!cell) return 'Coast City';
    if (cell.channel) return 'The channel';
    if (cell.park) return cell.park === 'big' ? 'Mission Park' : 'A park';
    return { waterfront: 'The waterfront', downtown: 'Downtown', midtown: 'Midtown', town: 'Coast City', ring: 'Coast City', industrial: 'The industrial east' }[cell.district] ?? 'Coast City';
  }

  // ---------------------------------------------------------------- drawing
  // view: { x, z (the centre), mpp (metres a pixel), rot }
  toScreen(x, z, v, W, H) {
    const dx = (x - v.x) / v.mpp, dz = (z - v.z) / v.mpp; // (half a turn: -x right, -z down)
    const u = -dx, w = -dz, c = Math.cos(v.rot ?? 0), s = Math.sin(v.rot ?? 0);
    return [W / 2 + u * c - w * s, H / 2 + u * s + w * c];
  }
  fromScreen(sx, sy, v) {
    const W = this.fc.clientWidth, H = this.fc.clientHeight;
    return { x: v.x - (sx - W / 2) * v.mpp, z: v.z - (sy - H / 2) * v.mpp };
  }
  draw(g, W, H, v, full) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.desert;
    g.fillRect(0, 0, W, H);
    // the world's frame: turned, mirrored half a turn, scaled
    g.setTransform(1, 0, 0, 1, W / 2, H / 2);
    g.rotate(v.rot ?? 0);
    g.scale(-1 / v.mpp, -1 / v.mpp);
    g.translate(-v.x, -v.z);
    const reach = Math.hypot(W, H) * 0.5 * v.mpp + 60;
    const near = (x0, z0, x1, z1) => x1 > v.x - reach && x0 < v.x + reach && z1 > v.z - reach && z0 < v.z + reach;
    const rect = (x0, z0, x1, z1, col) => { if (!near(x0, z0, x1, z1)) return; g.fillStyle = col; g.fillRect(x0, z0, x1 - x0, z1 - z0); };
    const Z = LOT_Z;
    // the sea, west of the coast all the way along
    g.fillStyle = COL.sea;
    g.beginPath();
    const z0 = v.z - reach, z1 = v.z + reach, step = Math.max(20, reach / 60);
    g.moveTo(-20000, z0);
    for (let z = z0; z <= z1; z += step) g.lineTo(coastX(z), z);
    g.lineTo(coastX(z1), z1);
    g.lineTo(-20000, z1);
    g.fill();
    // the city's streets (the whole city's ground) and its blocks over them
    rect(CITY.x0, CITY.z0 + Z, CITY.x1, CITY.z1 + Z, COL.city);
    // the beach, from the shore to the promenade
    g.fillStyle = COL.beach;
    g.beginPath();
    g.moveTo(streetX(-14) - NS.front, CITY.z0 + Z);
    for (let z = CITY.z0; z <= CITY.z1; z += 40) g.lineTo(shoreX(z), z + Z);
    g.lineTo(streetX(-14) - NS.front, CITY.z1 + Z);
    g.fill();
    for (const c of this.cells) {
      if (!near(c.x0, c.z0 + Z, c.x1, c.z1 + Z)) continue;
      if (c.channel) { g.fillStyle = COL.channel; g.fillRect(CHANNEL.x0, c.z0 + Z - EW.front, CHANNEL.x1 - CHANNEL.x0, c.z1 - c.z0 + 2 * EW.front); continue; }
      g.fillStyle = c.park ? COL.park : c.district === 'downtown' ? COL.downtown : c.core ? COL.blockCore : COL.block;
      g.fillRect(c.x0, c.z0 + Z, c.x1 - c.x0, c.z1 - c.z0);
      if (c.park && v.mpp < 3) { g.strokeStyle = COL.parkPath; g.lineWidth = 2.2; g.beginPath(); g.moveTo(c.x0 + 4, c.z0 + Z + 4); g.lineTo(c.x1 - 4, c.z1 + Z - 4); g.moveTo(c.x1 - 4, c.z0 + Z + 4); g.lineTo(c.x0 + 4, c.z1 + Z - 4); g.stroke(); }
    }
    // the bridges over the channel (the streets' road across it)
    for (const sz of STREET_Z) rect(CHANNEL.x0 - 2, sz - EW.front + Z, CHANNEL.x1 + 2, sz + EW.front + Z, COL.city);
    // Hal's blocks either side of the boulevard, and his lot with his building in it
    for (const [x0, x1] of [[-32, -5.9], [17.9, 44]]) { rect(x0, CITY.z0 + Z, x1, -210 - 11 + Z, COL.hal); rect(x0, -210 + 11 + Z, x1, -24 + Z, COL.hal); }
    rect(HALS_LOT.x0, HALS_LOT.z0 + Z, HALS_LOT.x1, HALS_LOT.z1 + Z, COL.lot);
    rect(-24.3, 14 + Z, 24.3, 38 + Z, '#7b6f66');
    // the pier, out from the promenade
    rect(PIER.x1, PIER.z - PIER.w / 2 + Z, PIER.x0, PIER.z + PIER.w / 2 + Z, '#8f7a5a');
    rect(PIER.x1 + 100, PIER.z - 22 + Z, PIER.x1 + 150, PIER.z + 22 + Z, '#8f7a5a');
    // the freeway, its ramp down to Ocean Avenue, and its way out east to the desert road
    g.strokeStyle = COL.freeway;
    g.lineWidth = FREEWAY.half * 2;
    g.beginPath(); g.moveTo(FREEWAY.west, FREEWAY.z + Z); g.lineTo(FREEWAY.east + 2600, FREEWAY.z + Z); g.stroke();
    g.strokeStyle = '#8a6a36'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(FREEWAY.west, FREEWAY.z + Z); g.lineTo(FREEWAY.east + 2600, FREEWAY.z + Z); g.stroke();
    // the road south from the lot to the field, and Ferris Aircraft
    rect(-2, -6000, 14, CITY.z0 + Z, COL.road);
    rect(-820, -150 - 23, 820, -150 + 23, COL.runway);
    rect(-760, -60, 760, -40, COL.apron);
    rect(-110, -40, 110, 8, COL.apron);
    for (const hx of [-62, 0, 62]) rect(hx - 27, 8, hx + 27, 38, COL.hangar);
    rect(-134, -22, -122, -10, '#b9c0c6');
    // labels and the places on top, upright whatever the turn
    g.setTransform(1, 0, 0, 1, 0, 0);
    const label = (x, z, text, size, col = 'rgba(230,240,235,0.85)') => {
      const [sx, sy] = this.toScreen(x, z, v, W, H);
      if (sx < -200 || sy < -40 || sx > W + 200 || sy > H + 40) return;
      g.font = `600 ${size}px "Rajdhani", "Segoe UI", Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(text, sx + 1, sy + 1);
      g.fillStyle = col; g.fillText(text, sx, sy);
    };
    const k = full ? 1 : 2; // (the radar's canvas is drawn at twice its size)
    if (full) {
      const big = v.mpp < 2.5;
      label(-560, 660 + Z, 'DOWNTOWN', 15 * k);
      label(-560, 1300 + Z, 'MIDTOWN', 12 * k);
      label(-1300, 1800 + Z, 'THE BAY', 14 * k, 'rgba(150,190,230,0.8)');
      label(-1080, 2600 + Z, 'WATERFRONT', 11 * k);
      label(2300, 600 + Z, 'INDUSTRIAL', 12 * k);
      label(1000, 2600 + Z, 'COAST CITY', 16 * k);
      label(CHANNEL.x0 + 25, 2200 + Z, 'THE CHANNEL', 10 * k, 'rgba(160,200,230,0.85)');
      label(600, FREEWAY.z + Z + 26, 'COAST FREEWAY', 10 * k, 'rgba(240,210,150,0.9)');
      label(200, 1400 + Z, 'MISSION PARK', 10 * k, 'rgba(150,230,170,0.9)');
      label(0, -110, 'FERRIS AIRCRAFT', 13 * k);
      label(6, -2800, 'THE ROAD TO THE FIELD', 10 * k);
      if (big) label(-1300, PIER.z + Z + 20, 'THE PIER', 10 * k);
    }
    // the places, then him
    const icon = (x, z, glyph, col, r = 7) => {
      const [sx, sy] = this.toScreen(x, z, v, W, H);
      const R = r * k, m = full ? 6 : 10;
      const cx = Math.min(W - m - R, Math.max(m + R, sx)), cy = Math.min(H - m - R, Math.max(m + R, sy)); // (held at the rim when it's off the radar)
      if (!full && (cx !== sx || cy !== sy) && glyph !== '!' && glyph !== '◆') return;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(cx, cy + 1.5, R + 1.5, 0, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
      g.fillStyle = '#10161a'; g.font = `800 ${R * 1.25}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, cx, cy + 0.5);
    };
    const s = this.story, people = s.cityLife?.people ?? [];
    for (const [who, glyph, col] of PLACES) { const p = people.find((q) => q.label === who); if (p) icon(p.home.x, p.home.z, glyph, col); }
    icon(0, Z + 10, '⌂', '#7dffc8', 8);
    icon(0, 22, '✈', '#9fd8ff', 8);
    if (s.ferrisScene?.car && !s.driving) icon(s.ferrisScene.car.position.x, s.ferrisScene.car.position.z, '▣', '#e8e2b8', 6);
    const em = s.emergencies?.active;
    if (em?.where && !em.over) icon(em.where.x, em.where.z, '!', '#ff5a4a', 8 + Math.sin(performance.now() / 160) * 1.5);
    const mt = s.powers?.markerTarget;
    if (mt?.pos && mt !== this.wpMarker) icon(mt.pos.x, mt.pos.z, '•', '#ffe27a', 6);
    if (this.waypoint) icon(this.waypoint.x, this.waypoint.z, '◆', '#7dffc8', 7);
    // him: an arrow the way he faces
    const p = this.here, [hx, hy] = this.toScreen(p.x, p.z, v, W, H);
    const yaw = s.driving && s.ferrisScene?.car ? s.ferrisScene.car.rotation.y : s.player.yaw ?? 0;
    const fx = p.x + Math.sin(yaw) * 10, fz = p.z + Math.cos(yaw) * 10, [ax, ay] = this.toScreen(fx, fz, v, W, H);
    const ang = Math.atan2(ay - hy, ax - hx), L = 11 * k;
    g.save(); g.translate(hx, hy); g.rotate(ang);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(L + 2, 1.5); g.lineTo(-L * 0.7, -L * 0.75); g.lineTo(-L * 0.35, 1.5); g.lineTo(-L * 0.7, L * 0.75 + 3); g.fill();
    g.fillStyle = s.civilian ? '#f4f7f6' : '#7dffc8'; g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.7, -L * 0.75); g.lineTo(-L * 0.35, 0); g.lineTo(-L * 0.7, L * 0.75); g.closePath(); g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------- the whole map
  get fullOpen() { return !!this.isFull; }
  openFull(onBack = null) {
    if (this.isFull) return;
    const s = this.story;
    this.isFull = true;
    this.onBack = onBack;
    const p = this.here;
    this.fv = { x: p.x, z: p.z, mpp: 3.2, rot: 0 };
    this.full.classList.add('show');
    s.input.setLook?.(false); // (the mouse free, to drag and click)
    this.hadControl = s.player.control;
    s.player.control = false;
    s.menuOpen = true;
    this.drawFull();
    this.stop = onFrame((dt) => this.fullKeys(dt));
  }
  closeFull() {
    if (!this.isFull) return;
    const s = this.story;
    this.isFull = false;
    this.full.classList.remove('show');
    this.stop?.();
    s.input.setLook?.(true);
    if (!s.phoneUI?.open) { s.menuOpen = false; s.player.control = this.hadControl && !s.busy; }
    const back = this.onBack;
    this.onBack = null;
    back?.();
  }
  fullKeys(dt) {
    const { input } = this.story, f = this.fv, real = Math.min(0.05, dt || 1 / 60);
    const hit = (...c) => { if (input.hit(...c)) { input.consume(...c); return true; } return false; };
    if (hit('KeyN')) { this.closeFull(); return; }
    if (this.onBack && hit('KeyQ', 'KeyG')) { this.closeFull(); return; }
    let moved = false;
    const pan = 520 * f.mpp * real;
    if (input.down('KeyW') || input.down('ArrowUp')) { f.z += pan; moved = true; } // (up the screen is north, +z)
    if (input.down('KeyS') || input.down('ArrowDown')) { f.z -= pan; moved = true; }
    if (input.down('KeyA') || input.down('ArrowLeft')) { f.x += pan; moved = true; } // (left on the map is +x: the view's left)
    if (input.down('KeyD') || input.down('ArrowRight')) { f.x -= pan; moved = true; }
    if (!this.onBack && input.down('KeyQ')) { this.zoom(1 + real * 2.2, false); moved = true; }
    if (input.down('KeyE')) { this.zoom(1 / (1 + real * 2.2), false); moved = true; }
    if (hit('Enter', 'Space')) { this.setWaypoint(f.x, f.z); moved = true; }
    if (hit('Backspace')) { this.clearWaypoint(); moved = true; }
    f.x = Math.max(-3000, Math.min(4500, f.x));
    f.z = Math.max(-1500, Math.min(10500, f.z));
    if (moved || (this.t2 = (this.t2 ?? 0) + real) > 0.25) { this.t2 = 0; this.drawFull(); }
  }
  zoom(k, draw = true) { this.fv.mpp = Math.max(0.6, Math.min(14, this.fv.mpp * k)); if (draw) this.drawFull(); }
  drawFull() {
    const c = this.fc, W = (c.width = c.clientWidth), H = (c.height = c.clientHeight);
    this.draw(c.getContext('2d'), W, H, this.fv, true);
    this.look.textContent = `${this.placeName(this.fv.x, this.fv.z)}${this.waypoint ? ' · waypoint set' : ''}`;
  }

  setWaypoint(x, z) {
    const s = this.story;
    if (!this.waypoint) this.prevMarker = s.powers.markerTarget; // (Carol's, say: back when the waypoint goes)
    this.waypoint = V(x, 0, z);
    this.wpMarker = { pos: V(x, 3, z), label: `Waypoint · ${this.placeName(x, z)}` };
    if (!s.emergencies?.active || s.emergencies.active.over) s.powers.markerTarget = this.wpMarker;
    s.audio?.bell?.(1046, 0.04, 0.5);
    if (this.isFull) this.drawFull();
  }
  clearWaypoint(arrived = false) {
    const s = this.story;
    if (s.powers.markerTarget === this.wpMarker) s.powers.markerTarget = this.prevMarker ?? null;
    this.prevMarker = null;
    this.waypoint = null;
    this.wpMarker = null;
    if (arrived) s.ui.toast?.('Waypoint reached');
  }
}

const _d = new THREE.Vector3();
