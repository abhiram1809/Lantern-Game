import * as THREE from 'three';
import { onFrame } from '../engine/Time.js';
import { money } from '../story/Life.js';
import { PAY_HOUR } from '../story/Work.js';
import { photoTexture } from '../fx/Textures.js';

// Hal's phone (the user, 2026-11-19: "press G when he's on ground to open up his phone... What Up,
// some other version of WhatsApp... his messages with Tom, Carol, and whoever he knows in the comics...
// photos... 5 6 apps"). A DOM phone over the scene while Hal holds the real one (Coast's prop, in his
// left hand, the screen to his eyes). Six apps: What Up (his messages: Carol, Tom, his mother, Jim and
// Jack, Sal, and Oa, where nothing's delivered), Photos (pictures taken in the game's own scenes, by
// its own renderer, the first time the album's opened), Maps (the city's map: ui/CityMap.js), the
// Savings & Loan (his money, the rent, the ledger), the Herald (what Coast City's reading: Green
// Lantern by the city's mood, what he answered), Weather. Keys: the arrows or WASD, E or Enter opens,
// Q or Backspace goes back, G puts it away; with the mouse free, a click.
const APPS = [
  { id: 'whatup', name: 'What Up', icon: '✉', bg: 'linear-gradient(160deg,#3ddc84,#128c5e)' },
  { id: 'photos', name: 'Photos', icon: '❀', bg: 'linear-gradient(160deg,#ffb36b,#e5486c)' },
  { id: 'maps', name: 'Maps', icon: '⌖', bg: 'linear-gradient(160deg,#7fd3ff,#3a7bd5)' },
  { id: 'bank', name: 'Coast S&L', icon: '$', bg: 'linear-gradient(160deg,#e6c66b,#8a6a1f)' },
  { id: 'herald', name: 'Herald', icon: 'H', bg: 'linear-gradient(160deg,#f2f2f2,#9a9a9a)' },
  { id: 'weather', name: 'Weather', icon: '☀', bg: 'linear-gradient(160deg,#ffd76b,#4aa3df)' },
];

// his people: who they are to him, and what's on the thread (h: Hal's, else theirs). `live(phone)`
// adds a line from now, when there is one.
const THREADS = [
  { id: 'carol', name: 'Carol Ferris', sub: 'Ferris Aircraft', av: '#c0435a', msgs: [
    ['Test card for tomorrow is on your desk. Read it this time.'],
    ['h', 'I always read it.'],
    ['You read the first line and the number at the bottom.'],
    ['h', 'Those are the important parts.'],
    ['Flexible shift means any time from nine to five. It does not mean noon.'],
  ], live: (p) => (p.story.work ? 'Saw your card on the clock. Don’t break my airplane.' : null) },
  { id: 'tom', name: 'Tom Kalmaku', sub: 'Ferris · mechanic', av: '#d9822b', msgs: [
    ['Did you SEE the news? A guy in green caught a jet. CAUGHT it.'],
    ['h', 'Probably a weather balloon.'],
    ['A weather balloon caught a jet?'],
    ['You were at the field that afternoon. You saw nothing?'],
    ['h', 'I was busy.'],
    ['Busy. Sure. Blue Marlin on Friday, you’re buying.'],
    ['h', 'I’m always buying.'],
  ], live: (p) => { const o = p.story.life?.opinion ?? 35; return o < -10 ? 'Have you seen what people are saying about the green guy now? Rough.' : o > 60 ? 'They put the green guy on a T-shirt. I bought two.' : null; } },
  { id: 'mom', name: 'Mom', sub: 'Jessica Jordan', av: '#7b6bd6', msgs: [
    ['Are you eating? Real food. Not diner pie.'],
    ['h', 'Pie has fruit in it.'],
    ['Call your brothers. Jim says you never call.'],
    ['Your father would be proud of you, Harold. Flying again.'],
    ['h', 'Thanks, Mom.'],
  ] },
  { id: 'jim', name: 'Jim', sub: 'brother', av: '#3a8fb7', msgs: [
    ['Mom says Ferris took you back. Try to keep it this time.'],
    ['h', 'Love you too, Jim.'],
    ['Sue says come for dinner Sunday. Bring nobody. Or somebody. Just come.'],
  ] },
  { id: 'jack', name: 'Jack', sub: 'brother', av: '#556070', msgs: [
    ['Need a lawyer yet? Asking for a brother who keeps getting fired.'],
    ['h', 'Rehired. There’s a difference.'],
    ['Billable hours say there isn’t.'],
  ] },
  { id: 'sal', name: 'Sal Delgado', sub: 'landlord', av: '#8a6a4a', msgs: [
    ['Rent’s weekly, Jordan. Cash or check. No IOUs, no sob stories.'],
  ], live: (p) => {
    const st = p.story.life?.rentState(p.story.dayCycle?.day ?? 1);
    if (!st) return null;
    if (st.late > 0) return `You’re ${st.late} day${st.late > 1 ? 's' : ''} late. ${money(st.owed)} now. I’m counting.`;
    const left = st.due - (p.story.dayCycle?.day ?? 1);
    return left <= 1 ? `Rent’s due ${left <= 0 ? 'today' : 'tomorrow'}. ${money(st.owed)}. Don’t make me knock.` : `Got the rent. Next one’s in ${left} days.`;
  } },
  { id: 'oa', name: 'Oa', sub: 'Sector 0 · the Guardians', av: '#2f8f4e', oa: true, msgs: [
    ['h', 'Hello? Guardians? Is this how you reach your Lantern?'],
    ['h', 'Testing. Testing. Kilowog, if you can read this, I owe you nothing.'],
    ['h', 'Fine. I’ll use the ring.'],
  ] },
];

const NEWS_STATIC = [
  ['Ferris prototype saved over its own runway', 'Witnesses describe a “hand of green light”. Ferris Aircraft calls the test a success.'],
  ['Downtown site: crews find the machine gone', 'Police say the device at the tower site was taken before dawn. No arrests.'],
  ['Who is the man in green?', 'Readers write in: angel, alien, Air Force secret. Our columnist votes for publicity stunt.'],
  ['Coronado Theatre holds over its summer pictures', 'The Palms, too. Popcorn still 35 cents.'],
  ['Pier’s Ferris wheel back after repairs', 'Rides till midnight weekends.'],
];

const WEATHER_NAME = { clear: 'Sunny', haze: 'Marine layer', overcast: 'Overcast', rain: 'Rain' };
const WEATHER_ICON = { clear: '☀', haze: '≋', overcast: '☁', rain: '☂' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clockText = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };

export class Phone {
  constructor(story) {
    this.story = story;
    this.open = false;
    this.view = null;
    this.stack = [];
    this.sel = 0;
    this.photos = null;
    const el = (this.el = document.createElement('div'));
    el.id = 'phone';
    el.innerHTML = `<div class="device"><div class="notch"></div><div class="status"><span class="t"></span><span class="s">▂▄▆ ◔ 82%</span></div><div class="screen"></div><div class="bar"></div></div><div class="hint"><b>↑↓←→</b> / <b>WASD</b> &nbsp; <b>E</b> open &nbsp; <b>Q</b> back &nbsp; <b>G</b> put away</div>`;
    document.getElementById('ui')?.appendChild(el) ?? document.body.appendChild(el);
    this.screen = el.querySelector('.screen');
    this.clock = el.querySelector('.status .t');
    this.screen.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) { this.sel = Number(b.dataset.i); this.activate(); }
      if (e.target.closest('[data-back]')) this.back();
    });
  }

  // ---------------------------------------------------------------- open and close
  show() {
    if (this.open) return;
    this.open = true;
    this.stack = [];
    this.go({ kind: 'home' });
    this.el.classList.add('show');
    this.story.audio?.bell?.(1320, 0.03, 0.4);
    this.stop = onFrame(() => this.keys());
    this.tick = setInterval(() => this.status(), 1000);
    this.status();
  }
  hide() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.stop?.();
    clearInterval(this.tick);
    this.story.cityMap?.closeFull?.();
    this.onHide?.();
  }
  status() {
    const dc = this.story.dayCycle;
    this.clock.textContent = dc ? clockText(dc.hour) : '9:41';
  }

  // ---------------------------------------------------------------- keys
  keys() {
    const { input } = this.story, hit = (...c) => { if (input.hit(...c)) { input.consume(...c); return true; } return false; };
    if (hit('KeyG')) { this.hide(); return; }
    if (this.story.cityMap?.fullOpen) return; // (the map takes the keys while it's up: ui/CityMap.js)
    const v = this.view, n = v.items?.length ?? 0, cols = v.cols ?? 1;
    if (hit('ArrowUp', 'KeyW')) this.move(-cols);
    else if (hit('ArrowDown', 'KeyS')) this.move(cols);
    else if (hit('ArrowLeft', 'KeyA')) this.move(v.kind === 'photo' ? -1 : cols > 1 ? -1 : 0);
    else if (hit('ArrowRight', 'KeyD')) this.move(v.kind === 'photo' ? 1 : cols > 1 ? 1 : 0);
    else if (hit('KeyE', 'Enter', 'Space')) this.activate();
    else if (hit('KeyQ', 'Backspace')) this.back();
    for (let i = 0; i < Math.min(9, n); i++) if (v.kind === 'home' && hit(`Digit${i + 1}`)) { this.sel = i; this.activate(); }
  }
  move(d) {
    const v = this.view;
    if (v.kind === 'photo') { const n = this.photos?.length ?? 0; if (n) { v.i = (v.i + d + n) % n; this.render(); } return; }
    const n = v.items?.length ?? 0;
    if (!n || !d) return;
    this.sel = Math.max(0, Math.min(n - 1, this.sel + d));
    this.render();
    this.screen.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }
  activate() { const it = this.view.items?.[this.sel]; it?.open?.(); }
  go(view) {
    if (this.view) this.stack.push({ view: this.view, sel: this.sel });
    this.view = view;
    this.sel = view.sel ?? 0;
    this.build(view);
    this.render();
    this.screen.scrollTop = 0;
  }
  back() {
    const prev = this.stack.pop();
    if (!prev) { this.hide(); return; }
    this.view = prev.view;
    this.sel = prev.sel;
    this.build(this.view);
    this.render();
  }

  // ---------------------------------------------------------------- the views
  build(v) {
    if (v.kind === 'home') { v.cols = 3; v.items = APPS.map((a) => ({ ...a, open: () => this.app(a.id) })); }
    if (v.kind === 'threads') v.items = THREADS.map((t) => ({ ...t, open: () => this.go({ kind: 'thread', t }) }));
    if (v.kind === 'photos') { v.cols = 2; v.items = (this.photos ?? []).map((p, i) => ({ ...p, open: () => this.go({ kind: 'photo', i }) })); }
  }
  app(id) {
    if (id === 'whatup') this.go({ kind: 'threads' });
    else if (id === 'photos') { this.go({ kind: 'photos' }); if (!this.photos) this.develop(); }
    else if (id === 'maps') { this.go({ kind: 'maps' }); this.story.cityMap?.openFull?.(() => this.back()); }
    else this.go({ kind: id });
  }
  render() {
    const v = this.view, S = this.screen;
    const head = (title, sub = '') => `<div class="head"><span class="back" data-back>‹</span><b>${esc(title)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</div>`;
    if (v.kind === 'home') {
      const dc = this.story.dayCycle, w = dc?.weather ?? 'clear';
      S.innerHTML = `<div class="wall"><div class="big">${dc ? clockText(dc.hour) : '9:41'}</div><div class="date">${esc(this.dateText())}</div><div class="wx">${WEATHER_ICON[w] ?? '☀'} ${esc(WEATHER_NAME[w] ?? 'Sunny')} · ${this.temp()}°</div></div>
        <div class="apps">${v.items.map((a, i) => `<div class="app ${i === this.sel ? 'sel' : ''}" data-i="${i}"><span class="ic" style="background:${a.bg}">${a.icon}</span><span class="nm">${esc(a.name)}</span></div>`).join('')}</div>`;
    } else if (v.kind === 'threads') {
      S.innerHTML = head('What Up', 'messages') + `<div class="list">${v.items.map((t, i) => { const last = this.lastOf(t); return `<div class="row ${i === this.sel ? 'sel' : ''}" data-i="${i}"><span class="av" style="background:${t.av}">${esc(t.name[0])}</span><span class="tx"><b>${esc(t.name)}</b><i>${esc(last)}</i></span></div>`; }).join('')}</div>`;
    } else if (v.kind === 'thread') {
      const t = v.t, msgs = [...t.msgs], live = t.live?.(this);
      if (live) msgs.push([live]);
      S.innerHTML = head(t.name, t.sub) + `<div class="chat">${msgs.map((m) => { const mine = m[0] === 'h' && m.length > 1, text = mine ? m[1] : m[0]; return `<div class="msg ${mine ? 'me' : 'them'}">${esc(text)}${mine && t.oa ? '<em>Not delivered</em>' : ''}</div>`; }).join('')}${t.oa ? '<div class="sys">No service in Sector 2814. The ring hears you; the phone doesn’t.</div>' : ''}</div>`;
      requestAnimationFrame(() => { const c = S.querySelector('.chat'); if (c) S.scrollTop = S.scrollHeight; });
    } else if (v.kind === 'photos') {
      S.innerHTML = head('Photos', this.photos ? `${this.photos.length} pictures` : 'developing…') + (this.photos ? `<div class="grid">${v.items.map((p, i) => `<div class="ph ${i === this.sel ? 'sel' : ''}" data-i="${i}" style="background-image:url(${p.url})"></div>`).join('')}</div>` : '<div class="wait">Loading your pictures…</div>');
    } else if (v.kind === 'photo') {
      const p = this.photos[v.i];
      S.innerHTML = head('Photos', `${v.i + 1} of ${this.photos.length}`) + `<div class="full"><img src="${p.url}"><div class="cap">${esc(p.cap)}</div><div class="nav">‹ A &nbsp; D ›</div></div>`;
    } else if (v.kind === 'maps') {
      S.innerHTML = head('Maps', 'Coast City') + '<div class="wait">The map is open. Q to come back.</div>';
    } else if (v.kind === 'bank') {
      const L = this.story.life, d = L?.d, st = L?.rentState(this.story.dayCycle?.day ?? 1), w = this.story.work;
      const rows = (d?.ledger ?? []).slice(0, 14).map((e) => `<div class="led"><span>Day ${e.day} · ${clockText(e.hour)}</span><i>${esc(e.why)}</i><b class="${e.amount >= 0 ? 'in' : 'out'}">${e.amount >= 0 ? '+' : '−'}${money(Math.abs(e.amount))}</b></div>`).join('');
      S.innerHTML = head('Coast Savings & Loan', 'checking · H. JORDAN') + `<div class="bank"><div class="bal"><i>Balance</i><b>${d ? money(d.money) : '$—'}</b>${d?.tab > 0 ? `<em>Owed at Rosie’s: ${money(d.tab)}</em>` : ''}</div>
        <div class="card2"><span>Rent to Sal Delgado</span><b>${st ? (st.late ? `${money(st.owed)} · ${st.late} day${st.late > 1 ? 's' : ''} late` : `${money(st.owed)} · day ${st.due}`) : '—'}</b></div>
        <div class="card2"><span>Ferris Aircraft · test flying</span><b>${w ? `on the clock · ${money(this.story.earned?.() ?? 0)}` : `$${PAY_HOUR}/hour · 9 to 5`}</b></div>
        <div class="lh">Recent</div>${rows || '<div class="wait">Nothing yet.</div>'}</div>`;
    } else if (v.kind === 'herald') {
      const L = this.story.life, o = L?.opinion ?? 35, mood = L?.mood ?? 'Trusted';
      const lead = o > 60 ? ['CITY LOVES ITS LANTERN', 'Kids in green capes on every block; a councilman wants a statue.'] : o > 25 ? ['GREEN LANTERN: THE CITY’S QUIET FRIEND', 'Another week, another rescue. Polls say most of Coast City trusts him.'] : o > -10 ? ['HERO OR HAZARD?', 'The man in green divides the city. Our letters page is full.'] : o > -45 ? ['DAMAGE MOUNTS IN GREEN LANTERN’S WAKE', 'Shopkeepers count the cost. “Who pays for this?”'] : ['CITY HALL: GROUND THE GREEN MENACE', 'Police lines, helicopters, and an Air Force spokesman who won’t say no.'];
      const ev = (L?.d.events ?? []).slice(0, 6).map((e) => `<div class="art small"><b>${esc(e.good ? `${e.text}: Green Lantern answers` : `${e.text}: no one came`)}</b><i>Day ${e.day}, ${clockText(e.hour)}.</i></div>`).join('');
      S.innerHTML = head('Coast City Herald', `Green Lantern: ${mood}`) + `<div class="paper"><div class="mast">THE COAST CITY HERALD</div><div class="art lead"><b>${esc(lead[0])}</b><i>${esc(lead[1])}</i></div>${ev}${NEWS_STATIC.map(([h, t]) => `<div class="art small"><b>${esc(h)}</b><i>${esc(t)}</i></div>`).join('')}</div>`;
    } else if (v.kind === 'weather') {
      const dc = this.story.dayCycle, w = dc?.weather ?? 'clear', h0 = dc?.hour ?? 12;
      const hours = Array.from({ length: 8 }, (_, i) => { const h = (h0 + i * 2) % 24, ww = i < 2 ? w : this.later(i); return `<div class="hr"><span>${clockText(Math.floor(h))}</span><b>${WEATHER_ICON[ww]}</b><i>${this.temp(h)}°</i></div>`; }).join('');
      S.innerHTML = head('Weather', 'Coast City, CA') + `<div class="wxa"><div class="now"><b>${this.temp()}°</b><span>${WEATHER_ICON[w]} ${esc(WEATHER_NAME[w])}</span><i>High ${this.temp(15)}° · Low ${this.temp(5)}°</i></div><div class="hours">${hours}</div><div class="note">${esc(w === 'haze' ? 'The marine layer burns off by noon. Usually.' : w === 'rain' ? 'Rain in Southern California. Drive like it’s a movie.' : w === 'overcast' ? 'Grey off the ocean. Good flying, flat light.' : 'Clear and dry. Good flying weather out at the field.')}</div></div>`;
    }
  }

  lastOf(t) { const live = t.live?.(this); const m = live ? [live] : t.msgs[t.msgs.length - 1]; return (m.length > 1 ? `You: ${m[1]}` : m[0]).slice(0, 46); }
  dateText() { const d = this.story.dayCycle?.day ?? 1; return `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(d + 3) % 7]} · day ${d}`; }
  temp(h = this.story.dayCycle?.hour ?? 13) {
    const w = this.story.dayCycle?.weather ?? 'clear', base = { clear: 22, haze: 18, overcast: 17, rain: 15 }[w] ?? 20;
    return Math.round(base + 6 * Math.sin(((h - 9) / 24) * Math.PI * 2));
  }
  later(i) { const d = this.story.dayCycle?.day ?? 1, r = Math.abs(Math.sin(d * 12.9898 + i * 78.233)) % 1; return r < 0.62 ? 'clear' : r < 0.8 ? 'haze' : r < 0.94 ? 'overcast' : 'rain'; }

  // ---------------------------------------------------------------- the album
  // Pictures taken in the game's own world, by its own renderer, one a frame: Hal in the flight suit
  // by the prototype, at the Blue Marlin with a beer, his Phoenix, the pier, Carol at work, the jet on
  // the apron; and his father's old photograph, from the frame by his bed.
  async develop() {
    if (this.developing) return;
    this.developing = true;
    const shots = this.story.photoShots?.() ?? [];
    const out = [];
    const dad = photoTexture();
    out.push({ url: dad.image.toDataURL('image/jpeg', 0.85), cap: 'Dad, by his jet. The one Mom keeps on the fridge too.' });
    for (const s of shots) {
      const url = await this.snap(s).catch((e) => { console.warn('photo', e); return null; });
      if (url) out.push({ url, cap: s.cap });
    }
    this.photos = out;
    this.developing = false;
    if (this.view?.kind === 'photos') { this.build(this.view); this.render(); }
  }
  // one picture: its set-up placed, rendered into a corner of the canvas inside a frame of the game (so
  // the composer draws over it before anyone sees it), copied out, put back
  snap(s) {
    const { engine } = this.story;
    return new Promise((resolve, reject) => {
      const stop = onFrame(() => {
        stop();
        let undo = null;
        try {
          const r = engine.renderer, W = 512, H = 384, pr = r.getPixelRatio();
          const cam = new THREE.PerspectiveCamera(s.fov ?? 45, W / H, 0.1, 4000);
          cam.position.copy(s.from);
          cam.lookAt(s.at);
          cam.updateMatrixWorld(true);
          undo = s.prepare?.(cam);
          const vp = new THREE.Vector4();
          r.getViewport(vp);
          r.setRenderTarget(null);
          r.setViewport(0, 0, W / pr, H / pr);
          r.render(s.scene, cam);
          const c = document.createElement('canvas');
          c.width = W; c.height = H;
          const g = c.getContext('2d');
          g.drawImage(r.domElement, 0, r.domElement.height - H, W, H, 0, 0, W, H);
          r.setViewport(vp);
          // a phone camera's look: a touch warm, the corners a little dark
          const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
          v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
          g.fillStyle = v; g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(255,200,140,0.05)'; g.fillRect(0, 0, W, H);
          resolve(c.toDataURL('image/jpeg', 0.86));
        } catch (e) { reject(e); } finally { undo?.(); }
      });
    });
  }
}
