import * as THREE from 'three';
import { STATS, levelOf, money } from '../story/Life.js';
import { APPS } from './Phone.js';
import { prop, hasProp, loadProps } from '../props/Props.js';
import { PARTS } from '../engine/Save.js';

// Hal's inventory (the user, 2026-11-24, with their sketch: "I for inventory... we can keep a lot of stuff in our
// inventory. Phone is there by default... ring is there by default... the keys to the car... it will be a layover
// and will pause time just like 4"). Over the scene with the world stopped behind it (the wheel's way: the ring's
// `freeze`, its focus grade). As the sketch lays it out:
// - Hal and his clothes: a portrait of him as he stands (drawn by the game's own renderer; drag it to turn him)
// - the ring's pocket: what the ring keeps out of this world (the lantern when it's put away, keepsakes from the
//   worlds he's been to)
// - the ring: its charge, his level, the points to spend (K)
// - Life (the sketch's "Condition"): a grade each for himself (sleep, food, hurt), his car, him and Carol, and why
// - Stats: what the city thinks, his XP, what he's made and flown and driven and broken, the ring's numbers
// - his phone: its apps, opened from here
// - what he carries: his keys, his wallet, his phone, and whatever he's bought and kept (story/Inventory.js's)
// Keys: I or Esc closes; a click picks a thing, and its actions show under the grid.

const SLOTS_POCKET = 16, SLOTS_CARRY = 12;
const STUDIO = new THREE.Color(0.012, 0.03, 0.02); // (the portrait's backdrop, linear: a deep green-black)
const ICON = {
  keys: '<svg viewBox="0 0 48 48"><circle cx="15" cy="16" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M21 21l15 15m-5-5l4-4m-1 9l4-4" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="26" y="5" width="9" height="16" rx="3" fill="currentColor" opacity="0.55"/></svg>',
  wallet: '<svg viewBox="0 0 48 48"><rect x="6" y="13" width="36" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M30 21h12v8H30a4 4 0 010-8z" fill="currentColor" opacity="0.6"/><path d="M10 13l22-6 3 6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  phone: '<svg viewBox="0 0 48 48"><rect x="14" y="5" width="20" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 9h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="38" r="1.8" fill="currentColor"/></svg>',
  ring: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="31" rx="12" ry="12" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="16" y="6" width="16" height="15" rx="4" fill="currentColor" opacity="0.85"/><circle cx="24" cy="13.5" r="4.2" fill="#062" stroke="#bfffd4" stroke-width="1.5"/></svg>',
  lantern: '<svg viewBox="0 0 48 48"><path d="M17 6h14M14 10h20l-2 6H16z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 16h16v18H16z" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="2.5"/><path d="M14 34h20l-3 7H17z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="25" r="4.5" fill="none" stroke="#dfffe9" stroke-width="2"/></svg>',
  crystal: '<svg viewBox="0 0 48 48"><path d="M24 4l9 12-9 28-9-28z" fill="currentColor" opacity="0.5" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 16h18" stroke="currentColor" stroke-width="2"/></svg>',
  shard: '<svg viewBox="0 0 48 48"><path d="M10 38L26 6l12 10-10 26z" fill="currentColor" opacity="0.45" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  food: '<svg viewBox="0 0 48 48"><path d="M8 26h32a16 14 0 01-32 0z" fill="currentColor" opacity="0.45" stroke="currentColor" stroke-width="2.5"/><path d="M16 18c0-4 4-4 4-8m4 8c0-4 4-4 4-8m4 8c0-4 4-4 4-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  drink: '<svg viewBox="0 0 48 48"><path d="M14 10h20l-3 32H17z" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 20h16" stroke="currentColor" stroke-width="2"/></svg>',
  thing: '<svg viewBox="0 0 48 48"><rect x="9" y="13" width="30" height="24" rx="3" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="2.5"/><path d="M9 21h30M24 13v8" stroke="currentColor" stroke-width="2"/></svg>',
};
// keepsakes the ring keeps, from what the story's been through (`reached`: a checkpoint any part's save has)
const KEEPSAKES = [
  { at: 'ysmault', id: 'redshard', name: 'A shard of Ysmault', sub: 'Red crystal from the prison world. It’s warm. It shouldn’t be.', icon: 'shard', tint: '#ff6a5a' },
  { at: 'qward', id: 'qwardbolt', name: 'A Weaponer’s bolt', sub: 'Spent. Qward’s yellow still in the metal.', icon: 'shard', tint: '#ffd24a' },
  { at: 'zamaron', id: 'violet', name: 'A violet crystal', sub: 'From the Zamarons’ valley. It hums when Carol’s near.', icon: 'crystal', tint: '#c27bff' },
  { at: 'korugar', id: 'korbadge', name: 'A Korugarian patrol badge', sub: 'Katma Tui’s spare. She said bring it back.', icon: 'thing', tint: '#ff9a7a' },
];

export class InventoryUI {
  constructor(story) {
    this.story = story;
    this.open = false;
    this.thumbs = new Map();
    const el = (this.el = document.createElement('div'));
    el.id = 'inventory';
    el.innerHTML = `
      <div class="inv-head"><span class="who">Hal Jordan</span><span class="what">Inventory</span><span class="keys"><b>I</b> or <b>Esc</b> close · time stopped</span></div>
      <div class="inv-body">
        <section class="inv-avatar"><h3>Hal &amp; his clothes</h3><canvas class="portrait" width="300" height="440"></canvas><div class="outfit"></div><div class="hint">drag to turn him</div></section>
        <section class="inv-pocket"><h3>The ring’s pocket</h3><div class="slots" data-grid="pocket"></div></section>
        <section class="inv-ring"><h3>Ring</h3><div class="ringbox"></div></section>
        <section class="inv-life"><h3>Life</h3><div class="rows"></div></section>
        <section class="inv-stats"><h3>Stats</h3><div class="rows"></div></section>
        <section class="inv-phone"><h3>Coast Phone</h3><div class="apps"></div><div class="hint"><b>G</b> takes it out</div></section>
        <section class="inv-carry"><h3>What he carries</h3><div class="slots" data-grid="carry"></div></section>
        <section class="inv-detail"></section>
      </div>`;
    document.getElementById('ui')?.appendChild(el) ?? document.body.appendChild(el);
    this.$ = (s) => el.querySelector(s);
    el.addEventListener('click', (e) => {
      const slot = e.target.closest('[data-slot]');
      if (slot) { this.pick(slot.dataset.grid, Number(slot.dataset.slot)); return; }
      const act = e.target.closest('[data-act]');
      if (act) { this.act(Number(act.dataset.act)); return; }
      const app = e.target.closest('[data-app]');
      if (app) this.openApp(app.dataset.app);
    });
    // drag the portrait to turn him
    const cv = this.$('.portrait');
    cv.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, a: this.turn ?? 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!this.drag) return; this.turn = this.drag.a + (e.clientX - this.drag.x) * 0.012; if (!this.redraw) this.redraw = requestAnimationFrame(() => { this.redraw = 0; this.portrait(); }); });
    cv.addEventListener('pointerup', () => { this.drag = null; });
  }

  // ---------------------------------------------------------------- open and close
  show() {
    if (this.open) return;
    this.open = true;
    this.turn = 0;
    this.sel = null;
    this.render();
    // (the pictures of what he's bought: their models fetched if they aren't in yet, then drawn)
    const want = [...new Set((this.story.inventory?.list?.() ?? []).map((i) => i.prop).filter((p) => p && !hasProp(p)))];
    if (want.length) loadProps(want).then(() => { if (this.open) this.render(); }).catch(() => {});
    this.portrait();
    this.el.classList.add('show');
    this.story.audio?.ringChime?.();
  }
  hide() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.onHide?.();
  }

  // ---------------------------------------------------------------- what's in it
  carried() {
    const s = this.story, life = s.life, inv = s.inventory;
    const fixed = [
      { id: 'keys', name: 'His keys', sub: 'The ’71’s, and his door at Las Palmas', icon: 'keys', fixed: true, acts: [['Where’s the car?', () => this.whereCar()]] },
      { id: 'wallet', name: 'His wallet', sub: life ? `${money(life.d.money)}${life.d.tab ? ` · owes Rosie ${money(life.d.tab)}` : ''} · his Ferris badge, a photo of his father` : 'His Ferris badge, a photo of his father', icon: 'wallet', fixed: true, acts: [['Coast S&L', () => this.openApp('bank')]] },
      { id: 'phone', name: 'Coast Phone', sub: 'What Up, Photos, Maps, the bank, the Herald, the weather', icon: 'phone', fixed: true, acts: [['Take it out', () => this.openApp(null)]] },
    ];
    const own = (inv?.list?.() ?? []).filter((it) => !it.fixed && !it.pocket && !fixed.some((f) => f.id === it.id));
    return [...fixed, ...own];
  }
  pocket() {
    const s = this.story, reached = this.reached();
    const out = [];
    if (s.lanternStowed) out.push({ id: 'lantern', name: 'The power battery', sub: 'His lantern, kept in the ring between worlds. L brings it out.', icon: 'lantern', fixed: true, acts: [['Bring it out', () => { this.hide(); s.toggleLantern?.(); }]] });
    for (const k of KEEPSAKES) if (reached.has(k.at)) out.push({ ...k, fixed: true });
    for (const it of s.inventory?.list?.() ?? []) if (it.pocket) out.push(it);
    return out;
  }
  reached() {
    if (this.reachedSet) return this.reachedSet;
    const set = new Set();
    for (const p of Object.values(PARTS)) for (const id of p.load().reached ?? []) set.add(id);
    return (this.reachedSet = set);
  }

  // ---------------------------------------------------------------- drawing it
  render() {
    const s = this.story, life = s.life, powers = s.powers;
    this.reachedSet = null;
    // the outfit
    this.$('.outfit').innerHTML = s.civilian ? '<b>Flight jacket and jeans</b><span>T: the uniform, where nobody can see</span>' : '<b>The uniform</b><span>T: his clothes, where nobody can see</span>';
    // the two grids
    this.lists = { pocket: this.pocket(), carry: this.carried() };
    for (const [grid, n] of [['pocket', SLOTS_POCKET], ['carry', SLOTS_CARRY]]) {
      const list = this.lists[grid], box = this.$(`[data-grid="${grid}"]`);
      box.innerHTML = Array.from({ length: Math.max(n, list.length) }, (_, i) => {
        const it = list[i];
        if (!it) return `<div class="slot empty"></div>`;
        const on = this.sel?.grid === grid && this.sel.i === i ? ' on' : '';
        const count = it.count > 1 ? `<i>${it.count}</i>` : '';
        return `<div class="slot${on}" data-grid="${grid}" data-slot="${i}" title="${esc(it.name)}">${this.icon(it)}${count}</div>`;
      }).join('');
    }
    // the ring
    const lv = life ? levelOf(life.d.xp) : null;
    this.$('.ringbox').innerHTML = `<div class="ringicon">${ICON.ring}</div><div class="ringtext"><b>${Math.round(powers?.charge ?? 0)}%</b><span>charge</span>${lv ? `<span>Level ${lv.level}${life.d.points ? ` · <em>${life.d.points} point${life.d.points > 1 ? 's' : ''}</em> (K)` : ''}</span>` : ''}</div>`;
    // life
    const c = life?.condition();
    this.$('.inv-life .rows').innerHTML = c ? [['Self', c.self], ['Car', c.car], ['Carol', c.carol]].map(([n, v]) => `<div class="row"><span class="n">${n}</span><span class="g g${v.grade}">${v.grade}</span><span class="v">${esc(v.note)}</span></div>`).join('') : '';
    // stats
    if (life) {
      const st = life.d.stats, km = (m) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`, fly = s.player?.flyScale ?? 1;
      const rows = [
        ['Public opinion', `${Math.round(life.opinion)} · ${life.mood}`],
        ['XP', `${life.d.xp} · level ${lv.level}, ${lv.into}/${lv.need} to the next`],
        ['Constructs (total)', `${life.count('constructs')} made`],
        ['Utility', `focus ${st.focus}, willpower ${st.willpower} of ${10}`],
        ['Attack', `power ${st.power} of 10`],
        ['Defense', `endurance ${st.endurance} of 10 · ${powers?.maxHealth ?? 100} health`],
        ['Flight total', km(life.count('flown'))],
        ['Drive total', km(life.count('driven'))],
        ['Dates', `${life.dates} with Carol`],
        ['Speed (on current XP)', `${(7.5 * fly).toFixed(1)} m/s cruising, ${(19 * fly * (s.player?.boostScale ?? 1)).toFixed(0)} boosting`],
        ['Attack power', `×${(powers?.mods?.damage ?? 1).toFixed(2)} a blow`],
        ['Efficiency', `${Math.round((1 - (powers?.mods?.cost ?? 1)) * 100)}% less charge a construct`],
        ['Public property destroyed', money(life.count('property'))],
      ];
      this.$('.inv-stats .rows').innerHTML = rows.map(([n, v]) => `<div class="row"><span class="n">${n}</span><span class="v">${esc(v)}</span></div>`).join('');
    }
    // the phone's apps
    this.$('.inv-phone .apps').innerHTML = APPS.map((a) => `<button class="app" data-app="${a.id}"><span class="tile" style="background:${a.bg}">${a.icon}</span><span class="name">${esc(a.name)}</span></button>`).join('');
    this.detail();
  }
  icon(it) {
    const th = it.prop ? this.thumb(it.prop) : null;
    if (th) return `<img src="${th}" alt="">`;
    return `<span class="glyph" style="${it.tint ? `color:${it.tint}` : ''}">${ICON[it.icon] ?? ICON[it.kind === 'drink' ? 'drink' : it.kind === 'food' || it.food ? 'food' : 'thing']}</span>`;
  }
  detail() {
    const box = this.$('.inv-detail'), it = this.sel && this.lists[this.sel.grid]?.[this.sel.i];
    if (!it) { box.innerHTML = '<div class="none">Pick something to look at it.</div>'; this.acts = []; return; }
    this.acts = it.acts ?? this.itemActs(it);
    box.innerHTML = `<div class="name">${esc(it.name)}</div><div class="sub">${esc(it.sub ?? '')}</div><div class="acts">${this.acts.map(([label], i) => `<button data-act="${i}">${esc(label)}</button>`).join('')}</div>`;
  }
  // what can be done with one of his own things (story/Inventory.js's model does it)
  itemActs(it) {
    const inv = this.story.inventory;
    if (!inv) return [];
    const out = [];
    const verb = it.kind === 'drink' ? 'Drink it' : it.kind === 'food' ? 'Eat it' : it.kind === 'medicine' ? 'Take it' : it.key === 'motoroil' ? 'Put it in the ’71' : 'Look at it';
    // (out of the screen first: eating's in his hands, in the world's time, which the screen has stopped)
    if (inv.use) out.push([verb, () => { this.hide(); inv.use(it)?.catch?.(console.warn); }]);
    if (inv.hold) out.push(['Hold it', () => { this.hide(); inv.hold(it); }]);
    if (inv.drop && !it.fixed) out.push(['Leave it here', () => { inv.drop(it); this.sel = null; this.render(); }]);
    return out;
  }
  pick(grid, i) { this.sel = this.sel?.grid === grid && this.sel.i === i ? null : { grid, i }; this.story.audio?.bell?.(1760, 0.02, 0.2); this.render(); }
  act(i) { this.acts?.[i]?.[1]?.(); }
  openApp(id) { this.hide(); this.story.openPhone?.().catch?.(console.warn); if (id) requestAnimationFrame(() => this.story.phoneUI?.app?.(id)); }
  whereCar() {
    const s = this.story, f = s.ferrisScene, car = f?.car;
    if (!car) { s.ui.toast('The ’71’s back on Earth.'); return; }
    const at = car.position, here = s.player.position;
    const lot = f.lotCarSpot && at.distanceTo(f.lotCarSpot) < 8, hangar = at.z < 3200;
    s.ui.toast(`The ’71: ${lot ? 'in its bay at Las Palmas' : hangar ? 'in his space by the hangars at Ferris' : 'where he left it in town'} · ${Math.round(at.distanceTo(here))} m`);
  }

  // A portrait of Hal as he stands, by the game's renderer: the camera before him for one frame (the world's stopped),
  // the world round him left out (a studio's dark backdrop, the scene's own lights on him: from in a shop the counter
  // and the walls hid him from any camera that fitted), copied into the panel's canvas; turned by the drag
  portrait() {
    const s = this.story, e = s.engine, p = s.player, cv = this.$('.portrait'), scene = s.current?.scene;
    if (!p?.object || !e?.composer || !scene) return;
    const cam = e.camera, keep = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov, near: cam.near, far: cam.far };
    const at = p.position.clone(), h = (p.rig?.hipsHeight ?? 0.98) / 0.98, yaw = p.object.rotation.y + (this.turn ?? 0);
    const hidden = [];
    for (const c of scene.children) if (c !== p.object && c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
    const bg = scene.background, fog = scene.fog, ao = scene.userData.ao;
    scene.background = STUDIO;
    scene.fog = null;
    scene.userData.ao = 0;
    cam.position.set(at.x + Math.sin(yaw) * 3.1, at.y + 1.05 * h, at.z + Math.cos(yaw) * 3.1);
    cam.fov = 36; cam.near = 0.1; cam.far = 50;
    cam.updateProjectionMatrix();
    cam.lookAt(at.x, at.y + 0.95 * h, at.z);
    cam.updateMatrixWorld();
    e.composer.render(0);
    const src = e.renderer.domElement, W = src.width, H = src.height, ch = H * 0.92, cw = ch * (cv.width / cv.height);
    const x = cv.getContext('2d');
    x.clearRect(0, 0, cv.width, cv.height);
    x.drawImage(src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, cv.width, cv.height);
    for (const c of hidden) c.visible = true;
    scene.background = bg; scene.fog = fog; scene.userData.ao = ao;
    cam.position.copy(keep.p); cam.quaternion.copy(keep.q); cam.fov = keep.fov; cam.near = keep.near; cam.far = keep.far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  // A thing's picture: its model (props/Props.js) drawn once on a studio sweep, kept by name
  thumb(name) {
    if (this.thumbs.has(name)) return this.thumbs.get(name);
    if (!hasProp(name)) return null;
    const r = this.story.engine.renderer, S = 128;
    const T = (this.studio ??= (() => {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445044, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 3, 2.5);
      scene.add(key);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
      const rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
      return { scene, cam, rt, buf: new Uint8Array(S * S * 4) };
    })());
    let url = null;
    try {
      const o = prop(name), b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length() || 1;
      o.position.sub(c);
      T.scene.add(o);
      T.cam.position.set(size * 0.95, size * 0.62, size * 1.25);
      T.cam.lookAt(0, 0, 0);
      T.cam.near = size * 0.05; T.cam.far = size * 10; T.cam.updateProjectionMatrix();
      const keep = r.getRenderTarget(), clear = r.getClearAlpha();
      r.setRenderTarget(T.rt);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(T.scene, T.cam);
      r.readRenderTargetPixels(T.rt, 0, 0, S, S, T.buf);
      r.setRenderTarget(keep);
      r.setClearAlpha(clear);
      T.scene.remove(o);
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const x = cv.getContext('2d'), img = x.createImageData(S, S);
      for (let y = 0; y < S; y++) img.data.set(T.buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); // (the target's rows run bottom first)
      x.putImageData(img, 0, 0);
      url = cv.toDataURL('image/png');
    } catch (err) { console.warn('inventory thumb', name, err); }
    this.thumbs.set(name, url);
    return url;
  }
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
