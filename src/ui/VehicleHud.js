// The readouts of Hal's day job (Part Five): the car's dash (speed and gear, bottom right), and the
// jet's: a flight panel under the view in the chase camera, and in the cockpit the head-up display
// drawn over the canvas the way a fighter's HUD is (green symbology: a heading tape across the top,
// airspeed on the left, altitude on the right, a pitch ladder that rolls with the horizon, the
// flight-path marker where it's going and a water-line where the nose is). With either view, the
// mouse-aim circle (where the player is pointing it) and the nose cross (where it points now); and the
// test card, the flight's list of manoeuvres, ticked off as they're flown.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const G = 'rgba(93, 255, 149, 0.92)', GS = 'rgba(93, 255, 149, 0.35)';

export class VehicleHud {
  constructor(root = document.getElementById('ui')) {
    const el = (id, html = '', tag = 'div') => {
      const d = document.createElement(tag);
      d.id = id;
      d.innerHTML = html;
      root.insertBefore(d, root.querySelector('#fade'));
      return d;
    };
    this.dash = el('dash', '<div class="spd"><b>0</b><span>MPH</span></div><div class="gear">D</div><div class="keys"></div>');
    this.panel = el('jetpanel', '<div class="cells"></div><div class="thr"><i></i></div><div class="keys"></div>');
    this.card = el('testcard', '<div class="k">Test card</div><ol></ol>');
    this.canvas = el('jethud', '', 'canvas');
    this.glocEl = el('gloc');
    this.g = this.canvas.getContext('2d');
    this.mode = null;
  }

  // g-force on the eyes: the edges of the view greying in (and the middle going) as the g builds
  gloc(k) { this.glocEl.style.opacity = Math.max(0, Math.min(1, k)).toFixed(3); }

  hide() {
    this.mode = null;
    this.gloc(0);
    this.dash.classList.remove('show');
    this.panel.classList.remove('show');
    this.card.classList.remove('show');
    this.canvas.classList.remove('show');
  }

  drive({ mph, gear, view }) {
    if (this.mode !== 'drive') {
      this.hide();
      this.mode = 'drive';
      this.dash.classList.add('show');
      this.dash.querySelector('.keys').innerHTML = '<kbd>W</kbd><kbd>S</kbd> drive, brake &nbsp; <kbd>A</kbd><kbd>D</kbd> steer &nbsp; <kbd>Space</kbd> handbrake &nbsp; <kbd>C</kbd> view';
    }
    this.dash.querySelector('.spd b').textContent = Math.round(mph);
    this.dash.querySelector('.gear').textContent = gear;
    this.dash.classList.toggle('first', view === 'first');
  }

  // The test card: [{ text, done }], the current item highlighted.
  setCard(items) {
    if (!items) { this.card.classList.remove('show'); return; }
    this.card.classList.add('show');
    const next = items.findIndex((i) => !i.done);
    this.card.querySelector('ol').innerHTML = items.map((it, i) => `<li class="${it.done ? 'done' : i === next ? 'now' : ''}">${esc(it.text)}</li>`).join('');
  }

  jet(s) {
    if (this.mode !== 'jet') {
      this.dash.classList.remove('show');
      this.mode = 'jet';
      this.panel.querySelector('.keys').innerHTML = '<kbd>Mouse</kbd> fly &nbsp; <kbd>W</kbd><kbd>S</kbd> throttle &nbsp; <kbd>A</kbd><kbd>D</kbd> roll &nbsp; <kbd>Q</kbd><kbd>E</kbd> rudder &nbsp; <kbd>G</kbd> gear &nbsp; <kbd>B</kbd> brakes &nbsp; <kbd>C</kbd> view';
    }
    const cockpit = s.view === 'cockpit';
    this.panel.classList.toggle('show', !cockpit);
    this.canvas.classList.add('show');
    if (!cockpit) {
      const cell = (k, v, warn) => `<div class="${warn ? 'warn' : ''}"><span>${k}</span><b>${v}</b></div>`;
      this.panel.querySelector('.cells').innerHTML = [
        cell('KIAS', Math.round(s.kias), s.stall), cell('MACH', s.mach.toFixed(2)), cell('ALT', `${Math.round(s.alt / 10) * 10}`), cell('V/S', `${s.vs > 0 ? '+' : ''}${Math.round(s.vs / 10) * 10}`),
        cell('G', s.g.toFixed(1), s.g > 7), cell('HDG', String(Math.round(s.heading)).padStart(3, '0')), cell('GEAR', s.gear ? 'DOWN' : 'UP'), cell(s.brake ? 'BRAKE' : 'AB', s.brake ? 'ON' : s.ab ? 'ON' : 'OFF'),
      ].join('');
      this.panel.querySelector('.thr i').style.height = `${Math.round(s.throttle * 100)}%`;
      this.panel.classList.toggle('ab', s.ab);
    }
    this.draw(s, cockpit);
  }

  draw(s, cockpit) {
    const c = this.canvas, dpr = Math.min(devicePixelRatio, 2), W = innerWidth, H = innerHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = this.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineWidth = 1.6;
    g.strokeStyle = G; g.fillStyle = G;
    g.shadowColor = GS; g.shadowBlur = 6;
    g.font = '600 13px "Rajdhani", "Segoe UI", sans-serif';
    // the mouse-aim circle and the nose cross (either view)
    if (s.aim) { g.beginPath(); g.arc(s.aim.x, s.aim.y, 13, 0, 7); g.stroke(); }
    if (s.nose) { g.beginPath(); g.moveTo(s.nose.x - 10, s.nose.y); g.lineTo(s.nose.x + 10, s.nose.y); g.moveTo(s.nose.x, s.nose.y - 10); g.lineTo(s.nose.x, s.nose.y + 10); g.stroke(); }
    if (!cockpit) return;
    // the HUD's glass: what follows is clipped to the combiner, in the middle of the view
    const cx = W / 2, cy = H * 0.47, R = Math.min(W, H) * 0.36;
    g.save();
    g.beginPath(); g.rect(cx - R * 1.1, cy - R, R * 2.2, R * 2); g.clip();
    // pitch ladder: a line every 5 degrees, rolled with the horizon (pixels per degree from the fov)
    const ppd = s.ppd;
    g.save();
    g.translate(s.water?.x ?? cx, s.water?.y ?? cy);
    g.rotate(-s.roll);
    for (let a = -90; a <= 90; a += 5) {
      const y = (s.pitch - a) * ppd;
      if (Math.abs(y) > R * 1.2) continue;
      const w = a === 0 ? R * 1.6 : R * 0.42, gap = R * 0.14;
      g.setLineDash(a < 0 ? [7, 5] : []);
      g.beginPath();
      g.moveTo(-w / 2, y); g.lineTo(-gap, y); g.moveTo(gap, y); g.lineTo(w / 2, y);
      if (a !== 0) { g.moveTo(-w / 2, y); g.lineTo(-w / 2, y + (a > 0 ? 7 : -7)); g.moveTo(w / 2, y); g.lineTo(w / 2, y + (a > 0 ? 7 : -7)); }
      g.stroke();
      if (a !== 0) { g.textAlign = 'right'; g.fillText(String(Math.abs(a)), -w / 2 - 6, y + 4); g.textAlign = 'left'; g.fillText(String(Math.abs(a)), w / 2 + 6, y + 4); }
    }
    g.setLineDash([]);
    g.restore();
    // the water-line (where the nose is) and the flight-path marker (where it's going)
    const wl = s.water ?? { x: cx, y: cy };
    g.beginPath(); g.moveTo(wl.x - 26, wl.y); g.lineTo(wl.x - 12, wl.y); g.lineTo(wl.x - 6, wl.y + 7); g.lineTo(wl.x, wl.y); g.lineTo(wl.x + 6, wl.y + 7); g.lineTo(wl.x + 12, wl.y); g.lineTo(wl.x + 26, wl.y); g.stroke();
    if (s.fpm) {
      const f = s.fpm;
      g.beginPath(); g.arc(f.x, f.y, 7, 0, 7); g.moveTo(f.x - 7, f.y); g.lineTo(f.x - 18, f.y); g.moveTo(f.x + 7, f.y); g.lineTo(f.x + 18, f.y); g.moveTo(f.x, f.y - 7); g.lineTo(f.x, f.y - 14); g.stroke();
    }
    g.restore();
    // heading tape across the top
    const ty = cy - R * 0.92;
    g.textAlign = 'center';
    for (let d = Math.floor(s.heading / 5) * 5 - 30; d <= s.heading + 30; d += 5) {
      const x = cx + (d - s.heading) * 9;
      const big = ((d % 10) + 10) % 10 === 0;
      g.beginPath(); g.moveTo(x, ty); g.lineTo(x, ty + (big ? 10 : 5)); g.stroke();
      if (big) g.fillText(String(((d % 360) + 360) % 360 / 10 | 0).padStart(2, '0'), x, ty - 4);
    }
    g.beginPath(); g.moveTo(cx, ty + 14); g.lineTo(cx - 5, ty + 21); g.lineTo(cx + 5, ty + 21); g.closePath(); g.stroke();
    // airspeed and altitude boxes, either side
    const box = (x, y, text, align) => { g.strokeRect(x - 38, y - 13, 76, 26); g.textAlign = align; g.font = '700 17px "Rajdhani", "Segoe UI", sans-serif'; g.fillText(text, align === 'right' ? x + 32 : x - 32, y + 6); g.font = '600 13px "Rajdhani", "Segoe UI", sans-serif'; };
    box(cx - R * 0.95, cy, String(Math.round(s.kias)), 'right');
    box(cx + R * 0.95, cy, String(Math.round(s.alt)), 'left');
    g.textAlign = 'center';
    g.fillText(`M ${s.mach.toFixed(2)}`, cx - R * 0.95, cy + 32);
    g.fillText(`G ${s.g.toFixed(1)}`, cx - R * 0.95, cy + 50);
    g.fillText(`${s.vs > 0 ? '+' : ''}${Math.round(s.vs)} FPM`, cx + R * 0.95, cy + 32);
    g.fillText(`${Math.round(s.throttle * 100)}%${s.ab ? ' AB' : ''}`, cx + R * 0.95, cy + 50);
    if (s.gear) g.fillText('GEAR', cx - R * 0.95, cy - 30);
    if (s.brake) g.fillText('BRAKE', cx + R * 0.95, cy - 30);
    if (s.warn) { g.font = '700 22px "Rajdhani", "Segoe UI", sans-serif'; g.fillText(s.warn, cx, cy + R * 0.7); }
  }
}
