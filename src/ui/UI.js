import { wait, waitFor, tween, onFrame, ease } from '../engine/Time.js';

// Alien script: a fixed letter-for-glyph cipher, so translating the ring's text is literal decoding.
const GLYPHS = [...'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ◆◇'];
export const toGlyphs = (s) => [...s].map((c) => {
  const k = c.toLowerCase().charCodeAt(0) - 97;
  if (k >= 0 && k < 26) return GLYPHS[k];
  return /\s/.test(c) ? c : '·';
}).join('');
const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SPEAKERS = { hal: 'Hal Jordan', abin: 'Abin Sur', light: '', dad: 'Martin Jordan', kid: 'Young Hal', thought: '', kilowog: 'Kilowog', sinestro: 'Sinestro', guardian: 'The Guardians', carol: 'Carol Ferris', sapphire: 'Star Sapphire', zamaron: 'The Zamarons', warden: 'A Star Sapphire', warden2: 'A Star Sapphire', keeper: 'A Star Sapphire', keeper2: 'A Star Sapphire', tom: 'Tom Kalmaku', landlord: 'Sal Delgado', pilot: 'Viper One-One', hammond: 'Hector Hammond', tech: 'Air Force technician', tech2: 'Air Force technician', atrocitus: 'Atrocitus', katma: 'Katma Tui', radio: 'KCST 1040', caller: 'Caller', korugar: 'Korugarian', korugarf: 'Korugarian', guard: 'A guard', crowd: 'The crowd', weaponer: 'A Weaponer of Qward', rosie: 'Rosie', cook: 'Dot', clerk: 'Ray', townm1: 'A passer-by', townm2: 'A passer-by', townm3: 'A passer-by', townf1: 'A passer-by', townf2: 'A passer-by', townf3: 'A passer-by', citykid: 'A kid' };
const ADVANCE = ['Space', 'Enter', 'Click', 'KeyE'];
// what the loading screen says while it waits (the controls and what there is to find)
const LOAD_TIPS = [
  '<b>4</b> opens the construct wheel; time stops while it’s open.',
  'Hold <b>F</b> or the right button to guard. Raised just as a blow lands, it parries.',
  'Double-tap <b>Space</b> to fly. <b>Shift</b> boosts, <b>C</b> comes down.',
  '<b>T</b> changes between Hal Jordan and Green Lantern, where nobody can see him.',
  '<b>L</b> brings the lantern from wherever it is. Below a quarter of a charge, say the oath.',
  'Fly high and press <b>E</b> for the ring’s star chart. <b>M</b> is the same places by name.',
  'Rosie’s Diner is open all night. The patty melt is $5.25 with the pie.',
  'Ferris pays $120 a shift. Sal wants the rent on Mondays.',
  'What Green Lantern breaks in town, the town remembers.',
  'Hal’s car is in his space by the hangars. The ring makes the key.',
  'The pier’s Ferris wheel turns all night. The beach runs the length of the city.',
];

export class UI {
  constructor({ input, audio, voice }) {
    Object.assign(this, { input, audio, voice });
    const $ = (s) => document.querySelector(s);
    this.el = {
      body: document.body, loading: $('#loading'), fill: $('#loading .fill'), fade: $('#fade'), flash: $('#flash'),
      chapter: $('#chapter'), objective: $('#objective'), clock: $('#clock'), prompt: $('#prompt'), controls: $('#controls'),
      sub: $('#subtitle'), speaker: $('#subtitle .speaker'), text: $('#subtitle .text'),
      over: $('#overheard'), overSpeaker: $('#overheard .speaker'), overText: $('#overheard .text'),
      watched: $('#watched'), watchedLabel: $('#watched .label'), life: $('#life'),
      pick: $('#pick'), pickTitle: $('#pick .title'), pickOptions: $('#pick .options'),
      choice: $('#choice'), question: $('#choice .question'), options: $('#choice .options'), keys: $('#choice .keys'),
      screen: $('#screen'), letterbox: $('#letterbox'), frame: $('#frame'), hud: $('#hud'),
      pause: $('#pause'), checkpoint: $('#checkpoint'),
    };
    this.fadeLevel = 1;
  }

  // The loading screen. At boot it's the bar under the emblem (`loading(p)`, then `loaded()`); after
  // the title it comes back over everything while a part's world is made (the user, 2026-11-19: "add a
  // true loading screen... just don't show users the dark"): `loadStart(title, stages)` with stages
  // [key, label, weight], `loadStage(key, k)` the one under way and how far into it, and it fades out
  // by itself when the scene fades in (`fade`), or with `loadEnd()`. (dev: each stage's start in
  // window.__load, to see where the time goes)
  loading(p) {
    if (this.load) return this.loadStage(this.load.key, p);
    this.el.fill.style.width = `${Math.round(p * 100)}%`;
  }
  loaded() {
    this.el.loading.classList.add('done');
    setTimeout(() => { if (!this.load) this.el.loading.style.display = 'none'; }, 900);
  }
  loadStart(title, stages) {
    const L = this.el.loading;
    this.load = { stages, key: stages[0][0], k: 0, total: stages.reduce((s, x) => s + x[2], 0), t0: performance.now(), shown: 0 };
    L.style.display = '';
    L.style.transition = 'none';
    L.classList.remove('done');
    void L.offsetWidth;
    L.style.transition = '';
    L.querySelector('.title').textContent = title ?? '';
    const tip = LOAD_TIPS[Math.floor(Math.random() * LOAD_TIPS.length)];
    L.querySelector('.tip').innerHTML = tip;
    this.el.fill.style.transition = 'none';
    this.el.fill.style.width = '0%';
    void this.el.fill.offsetWidth;
    this.el.fill.style.transition = '';
    if (import.meta.env.DEV) window.__load = [];
    this.loadStage(this.load.key, 0);
    // (a way in that never fades the scene up or hands over control would leave it up for good: after
    // 15 s without progress it goes)
    clearInterval(this.loadDog);
    this.loadDog = setInterval(() => {
      if (!this.load) { clearInterval(this.loadDog); return; }
      if (performance.now() - this.load.last > 15000) { console.warn('loading screen: no progress for 15 s'); this.loadEnd(); }
    }, 1000);
  }
  loadStage(key, k = 0) {
    const L = this.load;
    if (!L) return;
    const i = L.stages.findIndex((s) => s[0] === key);
    if (i < 0) return;
    L.last = performance.now();
    if (key !== L.key || !L.began) {
      L.began = true;
      if (import.meta.env.DEV) window.__load.push([key, Math.round(performance.now() - L.t0)]);
    }
    L.key = key;
    L.k = Math.min(1, Math.max(0, k));
    const done = L.stages.slice(0, i).reduce((s, x) => s + x[2], 0) + L.stages[i][2] * L.k;
    L.shown = Math.max(L.shown, done / L.total); // (it never goes backwards)
    this.el.fill.style.width = `${(L.shown * 100).toFixed(1)}%`;
    this.el.loading.querySelector('.label').textContent = L.stages[i][1];
  }
  loadEnd() {
    if (!this.load) return;
    if (import.meta.env.DEV) window.__load.push(['end', Math.round(performance.now() - this.load.t0)]);
    this.load = null;
    this.el.fill.style.width = '100%';
    // kept up two frames more: the scene's first draw uploads its geometry (half a second for the
    // valley), and that stall is better under the loading screen than on the scene's first frame
    // (and a second and a half at most, if no frames come: a window that isn't drawn still has the game)
    const finish = () => {
      if (this.load || this.el.loading.classList.contains('done')) return;
      this.el.loading.classList.add('done');
      setTimeout(() => { if (!this.load) this.el.loading.style.display = 'none'; }, 900);
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 1500);
  }

  chapter(text) { this.el.chapter.textContent = text ?? ''; }
  clock(text) { this.el.clock.textContent = text ?? ''; }
  objective(text) {
    const o = this.el.objective;
    if (!text) { o.classList.remove('show'); return; }
    o.textContent = text;
    o.classList.remove('show');
    void o.offsetWidth;
    o.classList.add('show');
    this.audio.tone({ freq: 880, peak: 0.05, dur: 0.4, wet: 0.5 });
  }
  prompt(key, text) {
    const p = this.el.prompt;
    if (!text) { p.classList.remove('show'); return; }
    p.innerHTML = `${key ? `<kbd>${esc(key)}</kbd>` : ''}${esc(text)}`;
    p.classList.add('show');
  }
  toast(text) {
    this.prompt('', text);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.prompt(), 1600);
  }
  // `powerKeys` (set once the ring is charged) adds a line for constructs and flight.
  controls(show) {
    this.el.controls.innerHTML = show
      ? `<b>WASD</b> move &nbsp; <b>Shift</b> run &nbsp; <b>Mouse</b> look (click to capture)<br>${this.powerKeys ? `${this.powerKeys}<br>` : ''}<b>E</b> interact &nbsp; <b>Space</b> advance dialogue &nbsp; <b>V</b> voice &nbsp; <b>Esc</b> / <b>P</b> pause`
      : '';
  }
  cinematic(on) {
    this.el.letterbox.classList.toggle('on', on);
    this.el.body.classList.toggle('cinematic', on);
    if (on) this.prompt();
  }
  hud(on) {
    this.el.hud.style.opacity = on ? 1 : 0;
    this.el.frame.style.opacity = on ? 1 : 0;
  }

  fade(to, duration = 1) {
    if (to < this.fadeLevel) this.loadEnd(); // (the scene's coming up: the loading screen goes)
    const from = this.fadeLevel;
    return tween(duration, (k) => {
      this.fadeLevel = from + (to - from) * k;
      this.el.fade.style.opacity = this.fadeLevel;
    });
  }
  async flash(duration = 1.2, peak = 1) {
    await tween(0.12, (k) => (this.el.flash.style.opacity = k * peak), ease.out);
    await tween(duration, (k) => (this.el.flash.style.opacity = (1 - k) * peak), ease.inOut);
  }

  // Shows one subtitle line, voices it and waits for it to finish (or for the player to skip).
  // skip: false for lines spoken while the player has control (clicks and Space are theirs then).
  // onWord(charIndex) is called as the voice reaches each word (when the speech engine reports it).
  async say({ who = 'hal', text, alien = false, style, voice = true, hold, keep = false, name, skip = true, onWord }) {
    const { sub, speaker, text: textEl } = this.el;
    sub.className = '';
    if (alien) sub.classList.add('alien');
    if (style) sub.classList.add(style);
    speaker.textContent = name ?? SPEAKERS[who] ?? '';
    const shown = [...(alien ? toGlyphs(text) : text)];
    textEl.textContent = '';
    sub.classList.add('show');

    let presses = 0;
    const stop = onFrame(() => { if (skip && this.input.hit(...ADVANCE)) presses++; });
    let voiceDone = Promise.resolve();
    if (voice && alien) voiceDone = wait(this.audio.alienVoice(text));
    else if (voice && (who !== 'thought' || this.voice.has(text, who))) voiceDone = this.voice.speak(text, who, onWord);

    const rate = alien ? 0.03 : 0.024;
    for (let i = 1; i <= shown.length && presses === 0; i++) {
      textEl.textContent = shown.slice(0, i).join('');
      await wait(rate);
    }
    textEl.textContent = shown.join('');
    const typedPresses = presses;
    const minHold = hold ?? Math.max(1.3, shown.length * 0.04);
    await Promise.race([Promise.all([voiceDone, wait(minHold)]), waitFor(() => presses > typedPresses)]);
    if (presses > typedPresses) this.voice.cancel();
    stop();
    if (!keep) this.hideSubtitle();
    await wait(0.12);
  }

  hideSubtitle() { this.el.sub.classList.remove('show'); }

  // What Hal overhears: people talking among themselves, or whispering. A smaller line of its own above
  // the subtitles, so it never takes the dialogue's place; `whisper` sets it in italics, dimmer.
  overhear({ name = '', text, whisper = false }) {
    const { over, overSpeaker, overText } = this.el;
    over.classList.toggle('whisper', whisper);
    overSpeaker.textContent = name;
    overText.textContent = text;
    over.classList.add('show');
  }
  overhearHide() { this.el.over.classList.remove('show'); }

  // A small menu over the scene (an order at the diner): number keys or a click; the scene keeps going.
  // Resolves with the option's index; `cancel()` on the returned promise closes it unanswered (-1).
  pick(title, options) {
    const { pick, pickTitle, pickOptions } = this.el;
    pickTitle.textContent = title;
    pickOptions.innerHTML = options.map((o, i) => `<button data-i="${i}"><span class="key">${i + 1}</span>${esc(o)}</button>`).join('');
    pick.classList.add('show');
    let stop, done;
    const p = new Promise((resolve) => {
      done = (i) => { stop?.(); pick.classList.remove('show'); if (i >= 0) this.audio.bell(i === 0 ? 880 : 988, 0.05, 0.6); resolve(i); };
      pickOptions.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(Number(b.dataset.i))));
      stop = onFrame(() => { options.forEach((_, i) => { if (this.input.hit(`Digit${i + 1}`)) { this.input.consume?.(`Digit${i + 1}`); done(i); } }); });
    });
    p.cancel = () => done(-1);
    return p;
  }

  // Whether anyone can see him (his secret: he changes only out of sight). n: how many are watching;
  // null hides it
  // free roam's panel under the clock (story/Life.js): his money (and Rosie's tab), his level and the
  // XP into it, points to spend, and as Green Lantern what the city thinks; null hides it
  life(s) {
    const L = this.el.life;
    if (!s) { L.classList.remove('show'); return; }
    L.classList.add('show');
    L.querySelector('.cash b').textContent = s.money;
    L.querySelector('.cash .tab').textContent = s.tab > 0 ? `tab $${s.tab.toFixed(2)}` : '';
    L.querySelector('.n').textContent = `LV ${s.level}`;
    L.querySelector('.bar i').style.width = `${Math.round(s.xp * 100)}%`;
    L.querySelector('.pts').textContent = s.points > 0 ? `${s.points} · K` : '';
    const op = L.querySelector('.op');
    op.textContent = s.opinion == null ? '' : `${s.mood.toUpperCase()} ${s.opinion > 0 ? '+' : ''}${s.opinion}`;
    op.className = `op ${s.opinion == null ? '' : s.opinion >= 25 ? 'good' : s.opinion > -10 ? 'mid' : 'bad'}`;
  }

  watching(n) {
    const w = this.el.watched;
    if (n == null) { w.classList.remove('show'); return; }
    w.classList.add('show');
    w.classList.toggle('seen', n > 0);
    this.el.watchedLabel.textContent = n > 0 ? (n === 1 ? 'SEEN · 1 PERSON' : `SEEN · ${n} PEOPLE`) : 'OUT OF SIGHT';
  }

  // Morph the glyph line on screen into English, character by character.
  async decode(english, duration = 2.2) {
    const { sub, text } = this.el;
    const chars = [...english], glyphs = [...toGlyphs(english)];
    sub.classList.add('show');
    this.audio.riser(duration * 0.8, 0.18);
    await tween(duration, (k) => {
      let html = '';
      chars.forEach((c, i) => {
        const local = (k - (i / chars.length) * 0.7) / 0.3;
        if (local >= 1 || /\s/.test(c)) html += esc(c);
        else html += `<span class="g">${local <= 0 ? glyphs[i] : randomGlyph()}</span>`;
      });
      text.innerHTML = html;
      if (k > 0.5) sub.classList.remove('alien');
    }, ease.linear);
    text.textContent = english;
  }

  choice(question, options) {
    const { choice, question: q, options: box, keys } = this.el;
    q.textContent = question;
    box.innerHTML = '';
    keys.textContent = options.map((o) => `${o[0]} — ${o}`).join('   ·   ');
    choice.classList.add('show');
    this.input.setLook(false);
    return new Promise((resolve) => {
      let stop;
      const pick = (i) => {
        stop();
        choice.classList.remove('show');
        this.audio.bell(i === 0 ? 523 : 659, 0.12, 1.6);
        resolve(i);
      };
      options.forEach((label, i) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', () => pick(i));
        box.appendChild(b);
      });
      stop = onFrame(() => {
        options.forEach((label, i) => { if (this.input.hit(`Key${label[0].toUpperCase()}`)) pick(i); });
      });
    });
  }

  // Full-screen card. Resolves with the index of the button pressed. A button is a label or
  // { label, sub, disabled }; `stack` lays them out as a vertical menu.
  screen(opts) { this.loadEnd(); return this.card(this.el.screen, opts); } // (a card, the error's included: over the scene, not under the loading screen)

  // The pause menu uses its own layer so it can open over anything.
  pauseMenu(opts) { return this.card(this.el.pause, opts); }
  closePause() { this.el.pause.classList.remove('show'); this.el.pause.innerHTML = ''; }

  card(el, { kicker = '', title = '', subtitle = '', body = '', small = '', emblem = false, buttons = ['Continue'], stack = false }) {
    const btn = (b, i) => {
      const o = typeof b === 'string' ? { label: b } : b;
      return `<button data-i="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}</button>`;
    };
    el.innerHTML = `
      ${emblem ? '<div class="emblem-css"></div>' : ''}
      ${kicker ? `<div class="kicker">${kicker}</div>` : ''}
      ${title ? `<h1>${title}</h1>` : ''}
      ${subtitle ? `<h2>${subtitle}</h2>` : ''}
      ${body ? `<p>${body}</p>` : ''}
      <div class="buttons${stack ? ' stack' : ''}">${buttons.map(btn).join('')}</div>
      ${small ? `<div class="small">${small}</div>` : ''}`;
    el.classList.add('show');
    this.input.setLook(false);
    return new Promise((resolve) => {
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        el.classList.remove('show');
        resolve(Number(b.dataset.i));
      }));
      el.querySelector('button:not([disabled])')?.focus();
    });
  }

  // Small "checkpoint saved" notice under the clock.
  checkpoint(label) {
    const c = this.el.checkpoint;
    c.innerHTML = `<span class="disk"></span>Checkpoint · ${esc(label)}`;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
    clearTimeout(this.cpTimer);
    this.cpTimer = setTimeout(() => c.classList.remove('show'), 3200);
  }
}
