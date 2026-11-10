// Spoken lines. Each line has a pre-rendered clip (public/voices, from a neural TTS model per
// character: tools/build-voices.mjs), played through WebAudio with its word timings and a mouth
// curve for the lip sync. A line with no clip (or before the manifest loads) falls back to the
// browser's speech synthesiser, with a voice profile per character.
const PROFILES = {
  hal: { prefer: ['Aaron', 'Evan', 'Nathan', 'Tom', 'Alex', 'Google US English', 'Microsoft Guy'], rate: 1.02, pitch: 0.95 },
  abin: { prefer: ['Daniel', 'Arthur', 'Reed', 'Rocko', 'Google UK English Male', 'Microsoft George', 'Fred'], rate: 0.8, pitch: 0.5 },
  light: { prefer: ['Whisper', 'Samantha', 'Google UK English Female', 'Microsoft Zira'], rate: 0.78, pitch: 0.7 },
  dad: { prefer: ['Ralph', 'Fred', 'Daniel', 'Alex', 'Google US English'], rate: 0.95, pitch: 0.8 },
  kid: { prefer: ['Junior', 'Samantha', 'Google US English'], rate: 1.05, pitch: 1.7 },
  kilowog: { prefer: ['Fred', 'Ralph', 'Rocko', 'Grandpa', 'Daniel', 'Google UK English Male', 'Microsoft David'], rate: 0.92, pitch: 0.42 },
  ring: { prefer: ['Karen', 'Moira', 'Samantha', 'Google UK English Female', 'Microsoft Hazel', 'Microsoft Zira'], rate: 1.05, pitch: 0.55 },
  guardian: { prefer: ['Daniel', 'Arthur', 'Google UK English Male', 'Microsoft George', 'Fred'], rate: 0.76, pitch: 0.62 },
  sinestro: { prefer: ['Arthur', 'Daniel', 'Oliver', 'Google UK English Male', 'Microsoft George'], rate: 0.88, pitch: 0.72 },
  carol: { prefer: ['Samantha', 'Allison', 'Ava', 'Susan', 'Google US English', 'Microsoft Aria', 'Microsoft Zira'], rate: 1.0, pitch: 1.05 },
  tom: { prefer: ['Alex', 'Tom', 'Evan', 'Google US English', 'Microsoft Guy'], rate: 1.12, pitch: 1.1 },
  landlord: { prefer: ['Ralph', 'Fred', 'Bruce', 'Google UK English Male', 'Microsoft David'], rate: 0.95, pitch: 0.7 },
};
const MOUTH_RATE = 60; // mouth curve frames per second, in the manifest

export class Voice {
  constructor() {
    this.supported = 'speechSynthesis' in window;
    this.enabled = true;
    this.voices = [];
    this.audio = null; // the AudioBank (its context and master bus), set by main
    this.clips = new Map(); // `${who}|${text}` → manifest entry (mouth decoded)
    this.buffers = new Map(); // file → Promise<AudioBuffer>
    this.who = null; // who is speaking now
    this.mouth = 0; // how open their mouth is now, 0..1
    this.current = null;
    if (this.supported) {
      const load = () => (this.voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')));
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
    }
    fetch('/voices/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (!m) return;
      for (const line of Object.values(m.lines)) {
        const raw = atob(line.mouth ?? ''), mouth = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) mouth[i] = raw.charCodeAt(i);
        this.clips.set(`${line.who}|${line.text}`, { ...line, mouth });
      }
    }).catch(() => {});
  }

  has(text, who) { return this.clips.has(`${who}|${text}`); }

  pick(profile) {
    for (const name of profile.prefer) {
      const v = this.voices.find((x) => x.name.startsWith(name));
      if (v) return v;
    }
    return this.voices[0];
  }

  // Fetch and decode a line's clip ahead of time (the next lines of a scene).
  preload(text, who) {
    const c = this.clips.get(`${who}|${text}`);
    if (c && this.audio?.ctx) this.buffer(c.file);
  }

  buffer(file) {
    const url = file.startsWith('/') ? file : `/voices/${file.replace(/^voices\//, '')}`;
    if (!this.buffers.has(url)) this.buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => this.audio.ctx.decodeAudioData(b)).catch(() => null));
    return this.buffers.get(url);
  }

  // Resolves when the line finishes. onWord(charIndex) follows the words as they're spoken.
  speak(text, who = 'hal', onWord) {
    if (!this.enabled) return Promise.resolve();
    const clip = this.clips.get(`${who}|${text}`);
    if (clip && this.audio?.ctx) return this.play(clip, who, onWord);
    if (who === 'thought' || !this.supported || !this.voices.length) return Promise.resolve();
    return this.synth(text, who, onWord);
  }

  async play(clip, who, onWord) {
    this.cancel();
    const token = (this.current = { who });
    const buf = await this.buffer(clip.file);
    if (!buf || this.current !== token) return;
    const ctx = this.audio.ctx, src = ctx.createBufferSource(), out = ctx.createGain();
    src.buffer = buf;
    out.gain.value = 1;
    src.connect(out).connect(this.audio.master);
    token.src = src;
    token.out = out;
    this.who = who;
    // the line is over when the speech is (`end`); a reverb or echo tail rings on under the next line
    const t0 = ctx.currentTime + 0.02, w0 = performance.now() + 20, words = clip.words ?? [], mouth = clip.mouth;
    const over = Math.min(buf.duration, (clip.end ?? buf.duration) + 0.12);
    src.start(t0);
    let w = 0, ran = ctx.state === 'running';
    return new Promise((resolve) => {
      const tick = () => {
        if (this.current !== token) { resolve(); return; }
        if (this.held) { requestAnimationFrame(tick); return; } // paused: the context is suspended too
        // the clip's clock; wall-clock time if the context has never run (no gesture yet), so a line
        // can never hold a scene up. Once it has run, its clock stands still while it's suspended
        // (a pause, or the moment a resume takes)
        if (ctx.state === 'running') ran = true;
        const t = ran ? ctx.currentTime - t0 : (performance.now() - w0) / 1000;
        // advance outside the call: `onWord?.(words[w++][0])` skips its arguments, w++ included,
        // when there is no listener, and the loop never ends
        while (w < words.length && words[w][1] <= t) { const c = words[w++][0]; onWord?.(c); }
        const f = Math.floor(t * MOUTH_RATE);
        this.mouth = f >= 0 && f < mouth.length ? mouth[f] / 255 : 0;
        if (t >= over) { this.end(token); resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // The browser's synthesiser: no mouth curve, so the mouth flaps at a syllable rate while it speaks.
  synth(text, who, onWord) {
    const profile = PROFILES[who] ?? PROFILES.hal;
    this.cancel();
    const token = (this.current = { who });
    this.who = who;
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text.replace(/…/g, '...'));
      u.voice = this.pick(profile);
      u.rate = profile.rate;
      u.pitch = profile.pitch;
      u.volume = 0.95;
      let done = false;
      const start = performance.now();
      const flap = () => {
        if (done || this.current !== token) return;
        const s = (performance.now() - start) / 1000;
        this.mouth = Math.max(0, Math.sin(s * 2 * Math.PI * 4.2)) * (0.6 + 0.4 * Math.sin(s * 7.3));
        requestAnimationFrame(flap);
      };
      requestAnimationFrame(flap);
      const finish = () => { if (!done) { done = true; this.end(token); resolve(); } };
      u.onend = finish;
      if (onWord) u.onboundary = (e) => { if (e.name !== 'sentence') onWord(e.charIndex); };
      u.onerror = finish;
      setTimeout(finish, 1500 + text.length * 95);
      speechSynthesis.speak(u);
    });
  }

  end(token) {
    if (this.current !== token) return;
    this.current = null;
    this.who = null;
    this.mouth = 0;
  }

  cancel() {
    const c = this.current;
    if (c?.src) {
      // a short fade, not a click
      const now = this.audio.ctx.currentTime;
      c.out.gain.setTargetAtTime(0, now, 0.015);
      try { c.src.stop(now + 0.08); } catch { /* already stopped */ }
    }
    if (c) this.end(c);
    if (this.supported) speechSynthesis.cancel();
  }

  pause() {
    this.held = true;
    if (this.supported) speechSynthesis.pause();
    if (this.current?.src) this.audio.ctx.suspend();
  }

  resume() {
    this.held = false;
    if (this.supported) speechSynthesis.resume();
    this.audio?.ctx?.resume();
  }
}
