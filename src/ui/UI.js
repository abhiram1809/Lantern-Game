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

const SPEAKERS = { hal: 'Hal Jordan', abin: 'Abin Sur', light: '', dad: 'Martin Jordan', kid: 'Young Hal', thought: '', kilowog: 'Kilowog', sinestro: 'Sinestro', guardian: 'The Guardians', carol: 'Carol Ferris', tom: 'Tom Kalmaku', landlord: 'Sal Delgado', pilot: 'Viper One-One', hammond: 'Hector Hammond', tech: 'Air Force technician', tech2: 'Air Force technician' };
const ADVANCE = ['Space', 'Enter', 'Click', 'KeyE'];

export class UI {
  constructor({ input, audio, voice }) {
    Object.assign(this, { input, audio, voice });
    const $ = (s) => document.querySelector(s);
    this.el = {
      body: document.body, loading: $('#loading'), fill: $('#loading .fill'), fade: $('#fade'), flash: $('#flash'),
      chapter: $('#chapter'), objective: $('#objective'), clock: $('#clock'), prompt: $('#prompt'), controls: $('#controls'),
      sub: $('#subtitle'), speaker: $('#subtitle .speaker'), text: $('#subtitle .text'),
      choice: $('#choice'), question: $('#choice .question'), options: $('#choice .options'), keys: $('#choice .keys'),
      screen: $('#screen'), letterbox: $('#letterbox'), frame: $('#frame'), hud: $('#hud'),
      pause: $('#pause'), checkpoint: $('#checkpoint'),
    };
    this.fadeLevel = 1;
  }

  loading(p) { this.el.fill.style.width = `${Math.round(p * 100)}%`; }
  loaded() {
    this.el.loading.classList.add('done');
    setTimeout(() => this.el.loading.remove(), 900);
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
  screen(opts) { return this.card(this.el.screen, opts); }

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
