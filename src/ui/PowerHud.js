import { CONSTRUCTS, KINDS } from '../powers/Constructs.js';

// The ring's interface: vitals (health) bottom-left, ring charge and the armed construct
// bottom-right (laid out after the combat reference video), the ring's text readout, reticle,
// a world marker, the training panel and the construct wheel.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const g = (body) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICONS = {
  fist: g('<rect x="10" y="12" width="7.4" height="14" rx="3.6"/><rect x="17.4" y="9.5" width="7.4" height="16.5" rx="3.6"/><rect x="24.8" y="10.5" width="7.4" height="15.5" rx="3.6"/><rect x="32.2" y="13" width="6.6" height="13" rx="3.2"/><path d="M10 22v7c0 8 6 12 13 12h3c7 0 12.8-4.5 12.8-12v-4"/><path d="M9.5 27.5H22a3.6 3.6 0 0 1 0 7.2h-6"/>'),
  gatling: g('<rect x="5" y="14" width="23" height="4.2" rx="2.1"/><rect x="5" y="20.4" width="23" height="4.2" rx="2.1"/><rect x="5" y="26.8" width="23" height="4.2" rx="2.1"/><rect x="27" y="11.5" width="11" height="22" rx="3"/><path d="M38 19h5M31 33.5l-2.5 7h6.5l1.5-7"/>'),
  sword: g('<path d="M37 7h4v4L22.5 29.5l-4-4z"/><path d="M14.5 22.5l11 11"/><path d="M17.5 30.5l-7 7"/><circle cx="8.6" cy="39.4" r="2.3"/>'),
  staff: g('<path d="M9.5 38.5l29-29"/><path d="M6 35l7 7M35 6l7 7"/><path d="M20 28l-2-2M30 18l-2-2"/>'),
  hammer: g('<rect x="11" y="8" width="26" height="11" rx="2.2"/><path d="M24 19v18"/><rect x="20.5" y="36" width="7" height="6" rx="1.6"/>'),
  axe: g('<path d="M16 41L31 8"/><path d="M27.5 12.5c5.5-5 13.5-3.5 15 3.2c1.2 5.4-3 10.3-9.4 10.8z"/>'),
  wall: g('<rect x="5.5" y="11" width="37" height="26" rx="2"/><path d="M5.5 19.7h37M5.5 28.3h37M17 11v8.7M31 11v8.7M11 19.7v8.6M24 19.7v8.6M37 19.7v8.6M17 28.3V37M31 28.3V37"/>'),
  shield: g('<path d="M24 5.5c5 2.2 10 3.2 15.5 3.2v12.5c0 10.5-7 16.6-15.5 21.3C15.5 37.8 8.5 31.7 8.5 21.2V8.7C14 8.7 19 7.7 24 5.5z"/><circle cx="24" cy="21" r="5"/><path d="M15 16.5h18M15 25.5h18"/>'),
  lock: g('<rect x="14.5" y="22" width="19" height="15" rx="2.6"/><path d="M18.5 22v-5a5.5 5.5 0 0 1 11 0v5"/><path d="M24 28v3"/>'),
};
const CROSS = '<svg viewBox="0 0 40 40"><path d="M20 3l14.7 8.5v17L20 37 5.3 28.5v-17z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 12h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="currentColor"/></svg>';
const EMBLEM = '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10.5" fill="none" stroke="currentColor" stroke-width="4.4"/><path d="M5 12.5h38M5 35.5h38" stroke="currentColor" stroke-width="4.4"/></svg>';

const SECTOR = 360 / CONSTRUCTS.length;
const polar = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
const arcPath = (r1, r2, a0, a1) => {
  const [x0, y0] = polar(r2, a0), [x1, y1] = polar(r2, a1), [x2, y2] = polar(r1, a1), [x3, y3] = polar(r1, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0}A${r2} ${r2} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r1} ${r1} 0 ${large} 0 ${x3} ${y3}Z`;
};

export class PowerHud {
  constructor(root = document.getElementById('ui')) {
    const el = (id, cls, html = '') => {
      const d = document.createElement('div');
      d.id = id;
      if (cls) d.className = cls;
      d.innerHTML = html;
      root.insertBefore(d, root.querySelector('#fade'));
      return d;
    };
    this.vitals = el('vitals', '', `<div class="hex">${CROSS}</div><div class="col"><div class="who">Hal Jordan</div><div class="bar health"><i class="lag"></i><i class="fill"></i></div><div class="num">100</div></div>`);
    this.ringhud = el('ringhud', '', `<div class="emblem">${EMBLEM}</div><div class="charge"><div class="pct">12<span>%</span></div><div class="bar"><i class="fill"></i><i class="ticks"></i></div><div class="lbl">Ring charge</div></div><div class="star"></div><div class="armed"><div class="icon"></div><div class="name"></div><div class="keys"></div></div>`);
    this.msg = el('ringmsg');
    this.reticle = el('reticle', '', '<i class="ring"></i><i class="dot"></i><span class="range"></span>');
    this.marker = el('marker', '', '<i></i><span></span>');
    this.tut = el('tutorial');
    this.target = el('target', '', '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><div class="hp"><i></i></div>');
    this.dmg = el('dmg');
    this.dmgPool = Array.from({ length: 24 }, () => { const d = document.createElement('div'); this.dmg.appendChild(d); return d; });
    this.dmgNext = 0;
    this.dmgLast = new WeakMap();
    this.wheel = el('wheel');
    this.health = { shown: -1, lag: 100, lagHold: 0 };
    this.chargeShown = -1;
    this.buildWheel();
  }

  show(on) {
    this.vitals.classList.toggle('show', on);
    this.ringhud.classList.toggle('show', on);
    document.body.classList.toggle('powers', on);
  }

  // ------------------------------------------------------------------------ vitals and charge
  setHealth(value, max = 100, real = 0) {
    const h = this.health, pct = Math.max(0, Math.min(1, value / max));
    // the classic trailing "damage" chunk: holds briefly, then drains down to the new value
    if (pct < h.lag / 100 - 0.001 && h.lagHold <= 0 && h.shown > pct) h.lagHold = 0.55;
    h.lagHold -= real;
    if (h.lagHold <= 0) h.lag = Math.max(pct * 100, h.lag - real * 60);
    if (pct * 100 > h.lag) h.lag = pct * 100;
    if (Math.abs(h.shown - pct) > 0.001 || h.lagHold > -1) {
      this.vitals.querySelector('.fill').style.width = `${pct * 100}%`;
      this.vitals.querySelector('.lag').style.width = `${h.lag}%`;
      this.vitals.querySelector('.num').textContent = Math.ceil(value);
      this.vitals.classList.toggle('low', pct < 0.3);
      h.shown = pct;
    }
  }

  setCharge(pct) {
    const v = Math.round(pct);
    if (v === this.chargeShown) return;
    this.chargeShown = v;
    this.ringhud.querySelector('.pct').innerHTML = `${v}<span>%</span>`;
    this.ringhud.querySelector('.bar .fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
    this.ringhud.classList.toggle('low', pct < 20);
  }

  hurt() {
    this.vitals.classList.remove('hit');
    void this.vitals.offsetWidth;
    this.vitals.classList.add('hit');
  }

  setArmed(info, keys = '') {
    const a = this.ringhud.querySelector('.armed');
    a.classList.toggle('on', !!info);
    if (!info) return;
    a.querySelector('.icon').innerHTML = ICONS[info.id];
    a.querySelector('.name').innerHTML = `${esc(info.name)} <span>${info.cost}%${info.drain ? ' +' + info.drain + '/s' : ''}</span>`;
    a.querySelector('.keys').innerHTML = keys;
  }

  // ------------------------------------------------------------------------ ring readout
  // A line typed out under the objective; fades after a while.
  ringMessage(text, hold = 4.5) {
    const m = this.msg;
    clearInterval(this.msgTimer);
    clearTimeout(this.msgHide);
    m.innerHTML = '<span class="tag">Ring</span><span class="t"></span>';
    m.classList.add('show');
    const t = m.querySelector('.t'), chars = [...text];
    let i = 0;
    this.msgTimer = setInterval(() => {
      t.textContent = chars.slice(0, ++i).join('');
      if (i >= chars.length) clearInterval(this.msgTimer);
    }, 22);
    this.msgHide = setTimeout(() => m.classList.remove('show'), (hold + chars.length * 0.022) * 1000);
  }

  // ------------------------------------------------------------------------ aim + markers
  setReticle(state) {
    const r = this.reticle;
    r.classList.toggle('show', !!state);
    if (!state) return;
    r.classList.toggle('bad', !state.valid);
    r.querySelector('.range').textContent = state.label ?? '';
  }

  // A diamond over a world point (screen x/y in px), or null to hide.
  setMarker(x, y, label = '', behind = false) {
    const m = this.marker;
    if (x === null) { m.classList.remove('show'); return; }
    m.classList.add('show');
    m.classList.toggle('edge', behind);
    m.style.transform = `translate(${x}px, ${y}px)`;
    m.querySelector('span').textContent = label;
  }

  // Brackets around a target with its health bar above, or null to hide.
  setTarget(state) {
    const t = this.target;
    t.classList.toggle('show', !!state);
    if (!state) return;
    t.classList.toggle('locked', state.locked);
    const s = Math.round(state.size);
    t.style.transform = `translate(${state.x - s / 2}px, ${state.y - s / 2}px)`;
    t.style.width = t.style.height = `${s}px`;
    t.querySelector('.hp i').style.width = `${Math.max(0, state.health) * 100}%`;
  }

  // A number popping up where a construct struck. Rapid hits on the same target add up into one
  // number (the way the gatling's rounds read in the reference HUD).
  damageNumber(x, y, amount, kill = false, key = null) {
    const now = performance.now();
    let rec = key && this.dmgLast.get(key);
    if (!rec || now - rec.at > 420 || kill) {
      rec = { el: this.dmgPool[this.dmgNext++ % this.dmgPool.length], total: 0, dx: (Math.random() - 0.5) * 30 };
      if (key) this.dmgLast.set(key, rec);
    }
    rec.at = now;
    rec.total += amount;
    const d = rec.el;
    d.textContent = rec.total;
    d.className = '';
    void d.offsetWidth;
    d.className = kill ? 'pop kill' : 'pop';
    d.style.left = `${x + rec.dx}px`;
    d.style.top = `${y}px`;
  }

  // ------------------------------------------------------------------------ training panel
  tutorial(step) {
    const t = this.tut;
    document.body.classList.toggle('training', !!step);
    if (!step) { t.classList.remove('show'); return; }
    const same = t.dataset.title === step.title;
    t.dataset.title = step.title;
    t.innerHTML = `<div class="kicker">${esc(step.kicker ?? 'Ring training')}<span>${step.n} / ${step.of}</span></div><div class="title">${esc(step.title)}</div><div class="body">${step.html}</div>`;
    if (!same) { t.classList.remove('show'); void t.offsetWidth; }
    t.classList.add('show');
    t.classList.remove('done');
  }
  tutorialDone() { this.tut.classList.add('done'); }

  // ------------------------------------------------------------------------ construct wheel
  buildWheel() {
    const R1 = 118, R2 = 226;
    let svg = '<svg class="dial" viewBox="-270 -270 540 540">';
    svg += `<defs><radialGradient id="wglow"><stop offset="0.55" stop-color="rgba(93,255,149,0)"/><stop offset="1" stop-color="rgba(93,255,149,0.10)"/></radialGradient></defs>`;
    svg += `<circle r="${R2 + 2}" fill="url(#wglow)"/>`;
    CONSTRUCTS.forEach((c, i) => {
      const a = i * SECTOR;
      svg += `<path class="sector k-${c.kind}" data-i="${i}" d="${arcPath(R1, R2, a - SECTOR / 2 + 1.4, a + SECTOR / 2 - 1.4)}"/>`;
    });
    // category bands outside the sectors
    const bands = {};
    CONSTRUCTS.forEach((c, i) => { (bands[c.kind] ??= []).push(i); });
    for (const [kind, idx] of Object.entries(bands)) {
      const a0 = Math.min(...idx) * SECTOR - SECTOR / 2 + 1.4, a1 = Math.max(...idx) * SECTOR + SECTOR / 2 - 1.4;
      svg += `<path class="band k-${kind}" d="${arcPath(R2 + 9, R2 + 13, a0, a1)}"/>`;
      const mid = (a0 + a1) / 2, [lx, ly] = polar(R2 + 30, mid);
      const rot = mid > 90 && mid < 270 ? mid - 180 : mid;
      svg += `<text class="bandlbl k-${kind}" x="${lx}" y="${ly}" transform="rotate(${rot} ${lx} ${ly})">${KINDS[kind].toUpperCase()}</text>`;
    }
    svg += `<circle class="hub" r="${R1 - 12}"/><path class="needle" d="M0 ${-(R1 - 16)}l-9 14h18z"/></svg>`;
    let items = '';
    CONSTRUCTS.forEach((c, i) => {
      const [x, y] = polar((R1 + R2) / 2, i * SECTOR);
      items += `<div class="item k-${c.kind}" data-i="${i}" style="left:calc(50% + ${(x / 540) * 100}%);top:calc(50% + ${(y / 540) * 100}%)"><div class="ic">${ICONS[c.id]}</div><div class="nm">${esc(c.name)}</div><div class="lk">${ICONS.lock}</div></div>`;
    });
    this.wheel.innerHTML = `<div class="dialwrap">${svg}${items}<div class="info"></div></div><div class="hint"><b>Mouse</b> choose &nbsp; <b>Click</b> select &nbsp; <b>4</b> / <b>Right-click</b> close</div>`;
    this.sectors = [...this.wheel.querySelectorAll('.sector')];
    this.items = [...this.wheel.querySelectorAll('.item')];
    this.needle = this.wheel.querySelector('.needle');
    this.info = this.wheel.querySelector('.info');
  }

  openWheel(unlocked, selected, charge) {
    this.wheelState = { unlocked, charge };
    CONSTRUCTS.forEach((c, i) => {
      const locked = !unlocked.has(c.id);
      this.sectors[i].classList.toggle('locked', locked);
      this.items[i].classList.toggle('locked', locked);
      this.sectors[i].classList.toggle('current', c.id === selected);
      this.items[i].classList.toggle('current', c.id === selected);
    });
    this.wheel.classList.add('show');
    document.body.classList.add('wheel');
    this.hoverWheel(CONSTRUCTS.findIndex((c) => c.id === selected), null);
  }

  closeWheel() { this.wheel.classList.remove('show'); document.body.classList.remove('wheel'); }

  hoverWheel(i, cursor) {
    if (cursor) {
      const deg = (Math.atan2(cursor.x, -cursor.y) * 180) / Math.PI;
      this.needle.setAttribute('transform', `rotate(${deg})`);
      this.needle.classList.toggle('on', cursor.length() > 28);
    } else this.needle.classList.remove('on');
    if (i === this.hovered) return;
    this.hovered = i;
    this.sectors.forEach((s, k) => s.classList.toggle('hover', k === i));
    this.items.forEach((s, k) => s.classList.toggle('hover', k === i));
    const c = CONSTRUCTS[i];
    if (!c) { this.info.innerHTML = '<div class="nm">Constructs</div><div class="ds">Point at a construct</div>'; return; }
    const locked = !this.wheelState.unlocked.has(c.id);
    const cost = locked ? 'Locked' : `${c.cost}% charge${c.drain ? ` + ${c.drain}%/s` : ''}`;
    this.info.innerHTML = `<div class="kd k-${c.kind}">${KINDS[c.kind]}</div><div class="nm">${esc(c.name)}</div><div class="cs${locked ? ' lockd' : ''}">${cost}</div><div class="ds">${esc(locked ? 'Your will is not yet strong enough to hold this shape.' : c.desc)}</div>`;
  }

  denyWheel(i) {
    const it = this.items[i];
    if (!it) return;
    it.classList.remove('deny');
    void it.offsetWidth;
    it.classList.add('deny');
  }
}
