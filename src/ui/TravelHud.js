// The ring's travel interface, after the 93604faf space-flight reference: a flight readout
// bottom-left during a voyage (velocity arc, mode, route, distance) and a destination card on arrival,
// plus the star chart: a galaxy map where the player sets a course for a charted world.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Worlds the ring can take Hal to. `at` is the spot on the chart (-1..1, Oa at the centre of the
// universe); locked ones show as uncharted until the story reaches them.
export const WORLDS = [
  { id: 'oa', name: 'Oa', sector: 'Sector 0', note: 'Home of the Guardians and the Central Power Battery. Kilowog’s range.', at: [0, 0] },
  { id: 'earth', name: 'Earth', sector: 'Sector 2814', note: 'Home. The lake where Abin Sur fell, outside Coast City.', at: [0.6, 0.34] },
  { id: 'korugar', name: 'Korugar', sector: 'Sector 1417', note: 'Uncharted.', at: [-0.52, 0.28] },
  { id: 'ysmault', name: 'Ysmault', sector: 'Sector 666', note: 'Uncharted.', at: [0.16, -0.7] },
  { id: 'mogo', name: 'Mogo', sector: 'Sector 2261', note: 'Uncharted.', at: [-0.6, -0.42] },
];
export const worldInfo = (id) => WORLDS.find((w) => w.id === id);

export class TravelHud {
  constructor(root = document.getElementById('ui')) {
    const el = (id, html = '') => {
      const d = document.createElement('div');
      d.id = id;
      d.innerHTML = html;
      root.insertBefore(d, root.querySelector('#fade'));
      return d;
    };
    const R = 46, C = 2 * Math.PI * R;
    this.arcLen = C * 0.75;
    this.panel = el('travel', `
      <div class="gauge"><svg viewBox="0 0 120 120">
        <circle class="track" cx="60" cy="60" r="${R}" stroke-dasharray="${this.arcLen} ${C}" transform="rotate(135 60 60)"/>
        <circle class="arc" cx="60" cy="60" r="${R}" stroke-dasharray="0 ${C}" transform="rotate(135 60 60)"/>
        <circle class="inner" cx="60" cy="60" r="31"/>
        <path class="cross" d="M60 36v48M36 60h48"/>
        <circle class="blip" cx="60" cy="60" r="3.2"/>
      </svg><div class="spd"></div></div>
      <div class="info"><div class="mode"></div><div class="rows"></div><div class="wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`);
    this.card = el('arrival', '<div class="k"></div><div class="n"></div><div class="s"></div>');
    this.arc = this.panel.querySelector('.arc');
    this.C = C;
  }

  show(on) {
    this.panel.classList.toggle('show', on);
    if (!on) this.card.classList.remove('show');
  }

  // mode: 'SUBLIGHT', 'HYPERLUMINAL SPEED', 'ORBITAL APPROACH'...; speed 0..1 fills the arc
  set({ mode, rows, speed }) {
    if (mode !== undefined && mode !== this.mode) {
      this.mode = mode;
      const m = this.panel.querySelector('.mode');
      m.textContent = mode;
      m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash');
    }
    if (rows) this.panel.querySelector('.rows').innerHTML = rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    if (speed !== undefined) {
      this.arc.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(1, speed)) * this.arcLen} ${this.C}`);
      this.panel.classList.toggle('hyper', speed > 0.6);
      this.panel.querySelector('.spd').textContent = speed > 0.6 ? 'FTL' : `${Math.round(speed * 100 / 0.6)}%`;
    }
  }

  arrive(world) {
    const c = this.card;
    c.querySelector('.k').textContent = 'Destination reached';
    c.querySelector('.n').textContent = world.name;
    c.querySelector('.s').textContent = world.sector;
    c.classList.remove('show'); void c.offsetWidth;
    c.classList.add('show');
  }
}

// The star chart. open() resolves with a world id, or null when cancelled. While it is open the
// story calls update(real) each frame: with the pointer locked a virtual cursor follows the mouse
// (as in the construct wheel); arrows or A / D step between charted worlds; E or Enter sets the course.
export class StarMap {
  constructor(input, audio, root = document.getElementById('ui')) {
    Object.assign(this, { input, audio });
    const d = (this.el = document.createElement('div'));
    d.id = 'starmap';
    root.insertBefore(d, root.querySelector('#fade'));
  }

  get isOpen() { return !!this.resolve; }

  open({ charted, here }) {
    this.charted = charted;
    this.here = here;
    const list = WORLDS.map((w) => ({ ...w, open: charted.includes(w.id), here: w.id === here }));
    this.list = list;
    this.el.innerHTML = `
      <div class="head"><div class="kicker">Ring · Star chart</div><h1>SET A COURSE</h1></div>
      <div class="body">
        <div class="chart"><canvas width="760" height="760"></canvas><svg class="course" viewBox="-1 -1 2 2" preserveAspectRatio="none"><line x1="0" y1="0" x2="0" y2="0"/></svg>
          ${list.map((w, i) => `<button class="node${w.open ? '' : ' locked'}${w.here ? ' here' : ''}" data-i="${i}" style="left:${50 + w.at[0] * 44}%;top:${50 + w.at[1] * 44}%"><i></i><span>${esc(w.open ? w.name : '???')}</span></button>`).join('')}
          <div class="cursor"></div>
        </div>
        <div class="side">${list.map((w, i) => `<button class="dest${w.open ? '' : ' locked'}${w.here ? ' here' : ''}" data-i="${i}">
            <div class="name">${esc(w.open ? w.name : 'Uncharted')}<span>${esc(w.sector)}</span></div>
            <div class="note">${esc(w.here ? 'You are here.' : w.open ? w.note : 'The ring has no route here yet.')}</div></button>`).join('')}
        </div>
      </div>
      <div class="keys"><b>Click</b> or <b>← →</b> choose &nbsp; <b>E</b> / <b>Enter</b> set course &nbsp; <b>Q</b> / <b>Right-click</b> cancel</div>`;
    this.drawGalaxy(this.el.querySelector('canvas'));
    this.cursor = this.el.querySelector('.cursor');
    this.vx = 0.5; this.vy = 0.5;
    this.el.querySelectorAll('button').forEach((b) => {
      b.addEventListener('mouseenter', () => this.hover(Number(b.dataset.i)));
      b.addEventListener('click', () => this.pick(Number(b.dataset.i)));
    });
    // start on the first charted world that isn't here
    this.sel = -1;
    this.hover(list.findIndex((w) => w.open && !w.here));
    this.el.classList.add('show');
    document.body.classList.add('chart');
    this.audio.muffle(true);
    return new Promise((r) => (this.resolve = r));
  }

  close(result = null) {
    if (!this.resolve) return;
    const r = this.resolve;
    this.resolve = null;
    this.el.classList.remove('show');
    document.body.classList.remove('chart');
    this.audio.muffle(false);
    r(result);
  }

  hover(i) {
    if (i < 0 || i === this.sel) return;
    this.sel = i;
    this.audio.wheelTick();
    this.el.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i));
    const from = this.list.find((w) => w.here)?.at ?? [0, 0], to = this.list[i].at;
    const line = this.el.querySelector('.course line');
    line.setAttribute('x1', from[0] * 0.88); line.setAttribute('y1', from[1] * 0.88);
    line.setAttribute('x2', to[0] * 0.88); line.setAttribute('y2', to[1] * 0.88);
    line.classList.toggle('ok', this.list[i].open && !this.list[i].here);
  }

  pick(i) {
    const w = this.list[i];
    if (!w) return;
    if (!w.open || w.here) {
      this.audio.denied();
      const b = this.el.querySelector(`.dest[data-i="${i}"]`);
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      return;
    }
    this.audio.ringChime();
    this.close(w.id);
  }

  update() {
    if (!this.resolve) return;
    const { input } = this;
    if (input.hit('KeyQ', 'Mouse2', 'Escape')) return this.close(null);
    const step = (input.hit('ArrowRight', 'KeyD', 'ArrowDown', 'KeyS') ? 1 : 0) - (input.hit('ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW') ? 1 : 0);
    if (step) {
      const n = this.list.length;
      let i = this.sel;
      for (let k = 0; k < n; k++) { i = (i + step + n) % n; if (this.list[i].open) break; }
      this.hover(i);
    }
    if (input.hit('KeyE', 'Enter', 'NumpadEnter')) return this.pick(this.sel);
    // a virtual cursor while the pointer is locked (no real cursor to hover with)
    this.cursor.style.display = input.locked ? 'block' : 'none';
    if (!input.locked) return;
    const box = this.el.querySelector('.chart').getBoundingClientRect();
    this.vx = Math.max(0, Math.min(1, this.vx + input.mouse.dx / box.width));
    this.vy = Math.max(0, Math.min(1, this.vy + input.mouse.dy / box.height));
    this.cursor.style.left = `${this.vx * 100}%`;
    this.cursor.style.top = `${this.vy * 100}%`;
    let best = -1, bd = 0.09;
    this.list.forEach((w, i) => { const d = Math.hypot(0.5 + w.at[0] * 0.44 - this.vx, 0.5 + w.at[1] * 0.44 - this.vy); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) this.hover(best);
    if (input.hit('Mouse0') && best >= 0) this.pick(best);
  }

  // A spiral galaxy: a bright core, four winding arms of stars and dust, faint sector rings.
  drawGalaxy(c) {
    const g = c.getContext('2d'), W = c.width, cx = W / 2, R = W * 0.46;
    g.clearRect(0, 0, W, W);
    const core = g.createRadialGradient(cx, cx, 0, cx, cx, R * 0.42);
    core.addColorStop(0, 'rgba(255,250,230,0.95)');
    core.addColorStop(0.15, 'rgba(200,255,220,0.45)');
    core.addColorStop(1, 'rgba(40,120,80,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, W, W);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 9000; i++) {
      const arm = i % 4, r = Math.pow(rnd(), 0.75) * R;
      const a = arm * (Math.PI / 2) + (r / R) * 4.2 + (rnd() - 0.5) * (0.5 + 0.35 * (1 - r / R));
      const x = cx + Math.cos(a) * r, y = cx + Math.sin(a) * r * 0.92;
      const b = 0.25 + 0.75 * (1 - r / R);
      g.fillStyle = rnd() < 0.18 ? `rgba(120,255,170,${b * 0.9})` : `rgba(220,240,255,${b * 0.85})`;
      const s = rnd() < 0.04 ? 2 : 1;
      g.fillRect(x, y, s, s);
    }
    g.strokeStyle = 'rgba(93,255,149,0.12)';
    g.lineWidth = 1;
    for (const k of [0.33, 0.66, 1]) { g.beginPath(); g.ellipse(cx, cx, R * k, R * k * 0.92, 0, 0, Math.PI * 2); g.stroke(); }
  }
}
