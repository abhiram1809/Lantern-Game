// All sound is synthesised with WebAudio, so the game ships without audio files.
export class AudioBank {
  init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.lowpass = this.filter('lowpass', 20000, 0.7, comp); // muffles everything while time is stopped
    this.master = this.gain(0.85, this.lowpass);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2, 2.6);
    this.reverb.connect(this.gain(0.4, this.master));
    this.noiseBuf = this.makeNoise(3, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.crackleBuf = this.makeCrackle(4);
    this.cricketBuf = this.makeCrickets(5);
  }

  get t() { return this.ctx.currentTime; }

  gain(value, dest) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (dest) g.connect(dest);
    return g;
  }

  // An output that also feeds the shared reverb.
  out(level = 1, wet = 0.3) {
    const g = this.gain(level, this.master);
    if (wet > 0) g.connect(this.gain(wet, this.reverb));
    return g;
  }

  filter(type, freq, q = 0.7, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  }

  makeNoise(seconds, kind) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
    }
    return buf;
  }

  makeCrackle(seconds) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.04;
    for (let k = 0; k < seconds * 38; k++) {
      const at = Math.floor(Math.random() * len), amp = 0.2 + Math.random() * 0.8, dec = 40 + Math.random() * 300;
      for (let j = 0; j < 900 && at + j < len; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / dec);
    }
    return buf;
  }

  makeCrickets(seconds) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const f = 4300 + ch * 260;
      for (let t = Math.random() * 0.3; t < seconds - 0.3; t += 0.45 + Math.random() * 0.5) {
        for (let p = 0; p < 3; p++) {
          const s0 = Math.floor((t + p * 0.045) * sr);
          for (let j = 0; j < 0.028 * sr; j++) d[s0 + j] += Math.sin((2 * Math.PI * f * j) / sr) * Math.sin((Math.PI * j) / (0.028 * sr)) * 0.25;
        }
      }
    }
    return buf;
  }

  impulse(seconds, decay) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  source(buffer, loop = false, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    s.playbackRate.value = rate;
    if (loop) s.loopStart = Math.random() * buffer.duration * 0.5;
    return s;
  }

  // Looping bed: returns a handle with a smoothly changeable level.
  loop(buffer, chain, level, { rate = 1, fadeIn = 2, wet = 0.15 } = {}) {
    if (!this.ctx) return nullLoop;
    const out = this.out(0, wet);
    const src = this.source(buffer, true, rate);
    let head = src;
    for (const node of chain) { head.connect(node); head = node; }
    head.connect(out);
    src.start(this.t, Math.random() * buffer.duration * 0.5);
    out.gain.setTargetAtTime(level, this.t, fadeIn / 3);
    return {
      level: (v, time = 1) => out.gain.setTargetAtTime(v, this.t, time / 3),
      stop: (fade = 1.5) => {
        out.gain.setTargetAtTime(0, this.t, fade / 3);
        src.stop(this.t + fade + 0.5);
      },
      nodes: chain,
    };
  }

  // --- Ambiences --------------------------------------------------------------------------
  rain(level = 0.22) {
    if (!this.ctx) return nullLoop;
    return this.loop(this.noiseBuf, [this.filter('highpass', 500), this.filter('lowpass', 5200)], level, { wet: 0.05 });
  }
  roomTone(level = 0.08) { return this.loop(this.brownBuf, [this.filter('lowpass', 180)], level, { wet: 0 }); }
  wind(level = 0.08) {
    const h = this.loop(this.brownBuf, [this.filter('bandpass', 420, 0.6)], level, { rate: 0.7 });
    if (this.ctx) {
      const lfo = this.ctx.createOscillator(), depth = this.gain(260);
      lfo.frequency.value = 0.07;
      lfo.connect(depth).connect(h.nodes[0].frequency);
      lfo.start();
    }
    return h;
  }
  fire(level = 0.3) { return this.loop(this.crackleBuf, [this.filter('bandpass', 1500, 0.4)], level, { wet: 0.1 }); }
  crickets(level = 0.05) { return this.loop(this.cricketBuf, [this.filter('highpass', 2500)], level, { wet: 0.3 }); }
  water(level = 0.12) {
    const h = this.loop(this.brownBuf, [this.filter('lowpass', 650)], level, { rate: 1.3 });
    if (this.ctx) {
      const lfo = this.ctx.createOscillator(), depth = this.gain(300);
      lfo.frequency.value = 0.18;
      lfo.connect(depth).connect(h.nodes[0].frequency);
      lfo.start();
    }
    return h;
  }

  // A morning outside an apartment: distant traffic, and now and then a bird.
  traffic(level = 0.05) { return this.loop(this.brownBuf, [this.filter('lowpass', 260), this.filter('highpass', 40)], level, { rate: 0.8, wet: 0.2 }); }
  birdsong() {
    if (!this.ctx) return;
    const f = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone({ freq: f * (1 + (Math.random() - 0.5) * 0.15), to: f * (1.2 + Math.random() * 0.4), peak: 0.012, dur: 0.07 + Math.random() * 0.06, wet: 0.5, delay: i * (0.11 + Math.random() * 0.05) });
  }

  // An old car's engine: a lumpy idle that rises with speed. set(rpm 0..1); stop().
  engine(level = 0.12) {
    if (!this.ctx) return { set() {}, stop() {} };
    const t = this.t, out = this.out(0, 0.15);
    const lp = this.filter('lowpass', 420, 1.2, out);
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = 38; o2.frequency.value = 19;
    const lumpy = this.ctx.createOscillator(), lumpGain = this.gain(5);
    lumpy.frequency.value = 3.1;
    lumpy.connect(lumpGain).connect(o.frequency);
    o.connect(this.gain(0.6, lp)); o2.connect(this.gain(0.3, lp));
    const rumble = this.source(this.brownBuf, true);
    rumble.connect(this.filter('lowpass', 160, 0.7, this.gain(0.8, lp)));
    for (const x of [o, o2, lumpy, rumble]) x.start(t);
    out.gain.setTargetAtTime(level, t, 0.15);
    return {
      set: (rpm) => {
        o.frequency.setTargetAtTime(38 + rpm * 70, this.t, 0.3);
        o2.frequency.setTargetAtTime(19 + rpm * 35, this.t, 0.3);
        lp.frequency.setTargetAtTime(420 + rpm * 900, this.t, 0.3);
        lumpGain.gain.setTargetAtTime(5 * (1 - rpm), this.t, 0.3);
      },
      stop: (fade = 0.6) => { out.gain.setTargetAtTime(0, this.t, fade / 3); for (const x of [o, o2, lumpy, rumble]) x.stop(this.t + fade + 0.5); },
    };
  }
  // the starter motor turning over; `catches` ends in a cough as the engine fires
  starter(dur = 1.4, catches = false) {
    if (!this.ctx) return;
    for (let i = 0; i < dur * 7; i++) this.burst({ buffer: this.brownBuf, type: 'bandpass', from: 220, q: 2, peak: 0.25, dur: 0.1, wet: 0.1, delay: i / 7 });
    this.tone({ type: 'sawtooth', freq: 140, to: 120, peak: 0.04, dur, wet: 0.1 });
    if (catches) this.burst({ buffer: this.brownBuf, from: 500, to: 80, peak: 0.6, dur: 0.6, wet: 0.2, delay: dur });
    else this.burst({ buffer: this.brownBuf, from: 300, to: 100, peak: 0.25, dur: 0.3, wet: 0.2, delay: dur });
  }
  carDoor() {
    this.burst({ buffer: this.brownBuf, from: 500, to: 140, peak: 0.55, dur: 0.35, wet: 0.2 });
    this.tone({ type: 'triangle', freq: 110, to: 60, peak: 0.2, dur: 0.25, wet: 0.1 });
  }
  // a phone buzzing on a wooden nightstand
  buzz(times = 2) {
    for (let i = 0; i < times; i++) {
      this.tone({ type: 'square', freq: 160, peak: 0.05, dur: 0.38, wet: 0.05, delay: i * 0.6 });
      this.burst({ buffer: this.brownBuf, type: 'bandpass', from: 170, q: 6, peak: 0.12, dur: 0.38, wet: 0.05, delay: i * 0.6 });
    }
  }
  voicemail() { this.tone({ type: 'sine', freq: 880, peak: 0.05, dur: 0.18, wet: 0.1 }); }
  paper() { this.burst({ type: 'highpass', from: 3000, to: 1500, peak: 0.12, dur: 0.25, wet: 0.1 }); }
  fridge(open = true) {
    this.burst({ buffer: this.brownBuf, from: open ? 600 : 300, to: 120, peak: 0.3, dur: 0.25, wet: 0.1 });
    if (open) return this.loop(this.brownBuf, [this.filter('bandpass', 120, 4)], 0.04, { fadeIn: 0.3, wet: 0 });
  }

  // --- One-shots --------------------------------------------------------------------------
  burst({ buffer, type = 'lowpass', from = 800, to, q = 0.7, attack = 0.005, peak = 0.5, dur = 0.3, wet = 0.2, rate = 1, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const out = this.out(0, wet);
    const f = this.filter(type, from, q, out);
    if (to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const src = this.source(buffer ?? this.noiseBuf, false, rate);
    src.connect(f);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random() * Math.max(0, src.buffer.duration / rate - dur - 0.2));
    src.stop(t + dur + 0.1);
  }

  tone({ type = 'sine', freq = 440, to, attack = 0.01, peak = 0.2, dur = 0.5, wet = 0.3, delay = 0, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const out = this.out(0, wet);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(out);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  step(surface = 'wood') {
    const f = { wood: 900, carpet: 420, gravel: 2400, mud: 500, stone: 1300 }[surface] ?? 800;
    this.burst({ from: f * (0.85 + Math.random() * 0.3), peak: surface === 'gravel' ? 0.16 : 0.22, dur: surface === 'gravel' ? 0.16 : 0.09, wet: 0.05 });
    if (surface === 'wood') this.tone({ freq: 90 + Math.random() * 20, peak: 0.12, dur: 0.08, wet: 0 });
  }
  tick() { this.burst({ type: 'bandpass', from: 3200, q: 4, peak: 0.12, dur: 0.03, wet: 0.05 }); }
  door() {
    this.burst({ buffer: this.brownBuf, from: 300, to: 120, peak: 0.6, dur: 0.5, wet: 0.3 });
    this.tone({ type: 'triangle', freq: 70, to: 45, peak: 0.25, dur: 0.4, wet: 0.2 });
  }
  thunder(strength = 1) {
    this.burst({ buffer: this.brownBuf, from: 900, to: 90, attack: 0.08, peak: 0.9 * strength, dur: 4.5, wet: 0.6, rate: 0.6 });
    this.burst({ buffer: this.brownBuf, from: 300, to: 60, attack: 0.6, peak: 0.6 * strength, dur: 5, wet: 0.5, rate: 0.5, delay: 0.5 });
  }
  heartbeat() {
    this.tone({ freq: 62, to: 40, peak: 0.55, dur: 0.18, wet: 0.1 });
    this.tone({ freq: 55, to: 38, peak: 0.4, dur: 0.2, wet: 0.1, delay: 0.24 });
  }
  whoosh(dur = 1.3, peak = 0.5) {
    if (!this.ctx) return;
    const t = this.t, out = this.out(0, 0.3), f = this.filter('bandpass', 300, 1.2, out);
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);
    const s = this.source(this.noiseBuf);
    s.connect(f);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + dur * 0.5);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t);
    s.stop(t + dur + 0.1);
  }
  explosion(scale = 1) {
    this.burst({ from: 2400, to: 140, attack: 0.01, peak: 0.9 * scale, dur: 2.6, wet: 0.5 });
    this.burst({ buffer: this.brownBuf, from: 500, to: 60, attack: 0.02, peak: 1 * scale, dur: 3.5, wet: 0.6 });
    this.tone({ freq: 58, to: 26, peak: 0.7 * scale, dur: 1.6, wet: 0.2 });
    this.burst({ buffer: this.crackleBuf, type: 'bandpass', from: 2000, peak: 0.5 * scale, dur: 2.4, wet: 0.3, delay: 0.2 });
  }
  jet(dur = 6, peak = 0.5) {
    if (!this.ctx) return;
    const t = this.t, out = this.out(0, 0.4);
    const f = this.filter('bandpass', 500, 0.6, out);
    f.frequency.setValueAtTime(380, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5);
    f.frequency.exponentialRampToValueAtTime(420, t + dur);
    const s = this.source(this.noiseBuf, true);
    s.connect(f);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(230, t + dur * 0.5);
    o.frequency.exponentialRampToValueAtTime(110, t + dur);
    o.connect(this.filter('lowpass', 500, 0.7, this.gain(0.25, out)));
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
    out.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.start(t); o.start(t);
    s.stop(t + dur + 0.1); o.stop(t + dur + 0.1);
  }
  bell(freq = 660, peak = 0.18, dur = 2.5, delay = 0) {
    [1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone({ freq: freq * m, peak: peak / (i + 1), dur: dur / (1 + i * 0.6), wet: 0.6, delay }));
  }
  ringChime() {
    this.bell(784, 0.22, 3);
    this.bell(1175, 0.14, 3.5, 0.12);
    this.bell(1568, 0.1, 4, 0.24);
  }
  failure() {
    this.tone({ type: 'sawtooth', freq: 130, to: 48, attack: 0.3, peak: 0.25, dur: 3.5, wet: 0.6 });
    this.tone({ type: 'sine', freq: 65, to: 32, attack: 0.2, peak: 0.4, dur: 3.5, wet: 0.4 });
  }
  riser(dur = 3, peak = 0.5) {
    if (!this.ctx) return;
    const t = this.t, out = this.out(0, 0.5), f = this.filter('highpass', 200, 2, out);
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const s = this.source(this.noiseBuf);
    s.connect(f);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(peak, t + dur);
    out.gain.linearRampToValueAtTime(0, t + dur + 0.15);
    s.start(t);
    s.stop(t + dur + 0.3);
  }

  // --- Ring powers ------------------------------------------------------------------------
  // The ring's pocket dimension tearing open (or sealing shut).
  rift(open = true) {
    this.burst({ type: 'bandpass', from: open ? 260 : 2600, to: open ? 2600 : 220, q: 1.4, attack: open ? 0.12 : 0.02, peak: 0.2, dur: 0.55, wet: 0.6 });
    this.tone({ type: 'sine', freq: open ? 70 : 180, to: open ? 210 : 55, attack: 0.03, peak: 0.14, dur: 0.6, wet: 0.5 });
    this.tone({ type: 'triangle', freq: open ? 1320 : 990, to: open ? 1980 : 660, attack: 0.02, peak: 0.03, dur: 0.5, wet: 0.7 });
  }
  // The sword: a low hum while it's in hand (louder mid-swing), a whoosh per cut, the bite of a hit
  // and the ring of two blades meeting.
  swordHum() {
    if (!this.ctx) return { set() {}, stop() {} };
    const t = this.t, out = this.out(0, 0.25);
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o.type = 'sawtooth'; o2.type = 'sine';
    o.frequency.value = 92; o2.frequency.value = 184.5;
    const lp = this.filter('lowpass', 700, 2, out);
    o.connect(this.gain(0.25, lp)); o2.connect(this.gain(0.5, lp));
    o.start(t); o2.start(t);
    return {
      set: (k) => { out.gain.setTargetAtTime(0.012 + 0.03 * k, this.t, 0.06); lp.frequency.setTargetAtTime(600 + 1400 * k, this.t, 0.06); },
      stop: (fade = 0.3) => { out.gain.setTargetAtTime(0, this.t, fade / 3); o.stop(this.t + fade + 0.2); o2.stop(this.t + fade + 0.2); },
    };
  }
  swordSwing(scale = 1) {
    this.burst({ type: 'bandpass', from: 500, to: 2600, q: 1.6, attack: 0.05, peak: 0.22 * scale, dur: 0.28, wet: 0.2 });
    this.tone({ type: 'sawtooth', freq: 180, to: 420, attack: 0.03, peak: 0.03 * scale, dur: 0.25, wet: 0.3 });
  }
  swordHit(scale = 1) {
    this.burst({ type: 'highpass', from: 2400, to: 900, attack: 0.003, peak: 0.3 * scale, dur: 0.22, wet: 0.25 });
    this.burst({ buffer: this.brownBuf, from: 600, to: 120, peak: 0.4 * scale, dur: 0.3, wet: 0.2 });
    this.tone({ type: 'triangle', freq: 980, to: 620, peak: 0.06 * scale, dur: 0.3, wet: 0.4 });
  }
  clash() {
    [1480, 2210, 3170].forEach((f, i) => this.tone({ type: 'triangle', freq: f, to: f * 0.97, attack: 0.002, peak: 0.09 / (i + 1), dur: 0.9, wet: 0.6 }));
    this.burst({ type: 'highpass', from: 4000, attack: 0.002, peak: 0.25, dur: 0.15, wet: 0.3 });
  }
  // Punching out of the sky: a deep boom under a tearing roar.
  sonicBoom(scale = 1) {
    this.burst({ buffer: this.brownBuf, from: 700, to: 50, attack: 0.005, peak: 0.95 * scale, dur: 2.4, wet: 0.5 });
    this.tone({ freq: 48, to: 24, peak: 0.6 * scale, dur: 1.4, wet: 0.2 });
    this.burst({ type: 'highpass', from: 1800, to: 400, attack: 0.002, peak: 0.25 * scale, dur: 0.6, wet: 0.3 });
  }
  // Dropping out of hyperspace: a falling sweep and a soft thump.
  arrive() {
    this.burst({ type: 'bandpass', from: 5200, to: 240, q: 1.1, attack: 0.01, peak: 0.3, dur: 1.2, wet: 0.6 });
    this.tone({ freq: 110, to: 40, peak: 0.3, dur: 1.1, wet: 0.4 });
  }
  // Muffle the world (construct wheel open, time stopped) or bring it back.
  muffle(on) {
    if (!this.ctx) return;
    this.lowpass.frequency.setTargetAtTime(on ? 700 : 20000, this.t, on ? 0.05 : 0.12);
    if (on) {
      this.tone({ type: 'sine', freq: 520, to: 90, attack: 0.01, peak: 0.16, dur: 0.45, wet: 0.5 });
      this.burst({ type: 'bandpass', from: 2600, to: 300, q: 1.5, peak: 0.12, dur: 0.35, wet: 0.4 });
    } else this.tone({ type: 'sine', freq: 140, to: 620, attack: 0.02, peak: 0.1, dur: 0.3, wet: 0.4 });
  }
  ringBlip() {
    this.tone({ type: 'triangle', freq: 1318, peak: 0.07, dur: 0.12, wet: 0.3 });
    this.tone({ type: 'triangle', freq: 1760, peak: 0.06, dur: 0.16, wet: 0.3, delay: 0.08 });
  }
  wheelTick() { this.tone({ type: 'triangle', freq: 2400, peak: 0.035, dur: 0.05, wet: 0.1 }); }
  denied() {
    this.tone({ type: 'square', freq: 150, peak: 0.07, dur: 0.12, wet: 0.1 });
    this.tone({ type: 'square', freq: 110, peak: 0.07, dur: 0.18, wet: 0.1, delay: 0.1 });
  }
  // The crackle of light taking shape.
  constructForm(size = 1) {
    this.burst({ type: 'highpass', from: 3000, to: 9000, attack: 0.01, peak: 0.16 * size, dur: 0.35, wet: 0.4 });
    this.burst({ buffer: this.crackleBuf, type: 'bandpass', from: 4200, q: 0.8, peak: 0.35 * size, dur: 0.3, wet: 0.3 });
    this.tone({ type: 'sawtooth', freq: 220, to: 660, attack: 0.02, peak: 0.05 * size, dur: 0.3, wet: 0.5 });
    this.tone({ type: 'sine', freq: 880, to: 1760, attack: 0.01, peak: 0.06 * size, dur: 0.25, wet: 0.5 });
  }
  punch() {
    this.burst({ type: 'bandpass', from: 600, to: 2400, q: 1.1, attack: 0.04, peak: 0.35, dur: 0.28, wet: 0.2 });
    this.tone({ type: 'sawtooth', freq: 180, to: 90, attack: 0.02, peak: 0.06, dur: 0.25, wet: 0.3 });
  }
  impact(scale = 1) {
    this.tone({ freq: 95, to: 38, attack: 0.003, peak: 0.75 * scale, dur: 0.45, wet: 0.25 });
    this.burst({ buffer: this.brownBuf, from: 1400, to: 120, attack: 0.003, peak: 0.8 * scale, dur: 0.6, wet: 0.35 });
    this.burst({ type: 'bandpass', from: 3200, to: 900, q: 0.9, attack: 0.002, peak: 0.3 * scale, dur: 0.22, wet: 0.2 });
    this.bell(1046, 0.05 * scale, 0.8);
  }
  splash(scale = 1) {
    this.burst({ type: 'bandpass', from: 1800, to: 500, q: 0.6, attack: 0.01, peak: 0.45 * scale, dur: 0.9, wet: 0.3 });
    this.burst({ buffer: this.brownBuf, from: 500, to: 120, peak: 0.4 * scale, dur: 0.7, wet: 0.3, delay: 0.05 });
  }
  shieldUp() {
    this.constructForm(0.8);
    this.tone({ type: 'triangle', freq: 330, to: 440, attack: 0.05, peak: 0.08, dur: 0.5, wet: 0.5 });
  }
  shieldHit(scale = 1) {
    this.bell(587, 0.12 * scale, 1.2);
    this.burst({ type: 'bandpass', from: 2400, to: 700, q: 2, peak: 0.25 * scale, dur: 0.3, wet: 0.3 });
    this.tone({ freq: 120, to: 60, peak: 0.3 * scale, dur: 0.3, wet: 0.2 });
  }
  wallRise() {
    this.constructForm(1);
    this.burst({ buffer: this.brownBuf, from: 220, to: 900, attack: 0.1, peak: 0.55, dur: 0.6, wet: 0.3 });
    this.tone({ freq: 60, to: 110, attack: 0.1, peak: 0.35, dur: 0.55, wet: 0.2 });
  }
  dissolve() { this.burst({ type: 'highpass', from: 6000, to: 2500, attack: 0.05, peak: 0.08, dur: 0.6, wet: 0.5 }); }
  takeoff() {
    this.whoosh(1.1, 0.55);
    this.burst({ buffer: this.brownBuf, from: 600, to: 90, attack: 0.005, peak: 0.6, dur: 0.6, wet: 0.3 });
    this.tone({ type: 'sine', freq: 180, to: 520, attack: 0.03, peak: 0.12, dur: 0.6, wet: 0.5 });
  }
  land(scale = 1) {
    this.burst({ buffer: this.brownBuf, from: 700, to: 80, attack: 0.003, peak: 0.55 * scale, dur: 0.5, wet: 0.25 });
    this.tone({ freq: 80, to: 35, peak: 0.45 * scale, dur: 0.35, wet: 0.15 });
  }
  hurt() {
    this.tone({ freq: 70, to: 40, peak: 0.45, dur: 0.25, wet: 0.1 });
    this.burst({ type: 'bandpass', from: 900, to: 300, q: 1, peak: 0.25, dur: 0.2, wet: 0.1 });
  }
  // Rushing air in flight: set(speed 0..1) opens the filter and raises the level.
  airflow() {
    if (!this.ctx) return { set() {}, stop() {} };
    const h = this.loop(this.noiseBuf, [this.filter('bandpass', 400, 0.7)], 0, { fadeIn: 0.5, wet: 0.1 });
    const f = h.nodes[0];
    return {
      set: (k) => { h.level(0.03 + 0.22 * k, 0.4); f.frequency.setTargetAtTime(300 + 2200 * k, this.t, 0.15); },
      stop: (fade = 0.8) => h.stop(fade),
    };
  }
  // Gatling: a whine that rises with the barrels' spin (set 0..1), and each round's crack.
  spin() {
    if (!this.ctx) return { set() {}, stop() {} };
    const t = this.t, out = this.out(0, 0.2);
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o.type = 'sawtooth'; o2.type = 'triangle';
    o.frequency.value = 60; o2.frequency.value = 120;
    const lp = this.filter('lowpass', 600, 1.5, out);
    o.connect(this.gain(0.3, lp)); o2.connect(this.gain(0.4, lp));
    o.start(t); o2.start(t);
    return {
      set: (k) => {
        o.frequency.setTargetAtTime(60 + 240 * k, this.t, 0.05);
        o2.frequency.setTargetAtTime(120 + 520 * k, this.t, 0.05);
        lp.frequency.setTargetAtTime(500 + 2500 * k, this.t, 0.05);
        out.gain.setTargetAtTime(0.012 + 0.05 * k, this.t, 0.05);
      },
      stop: (fade = 0.4) => { out.gain.setTargetAtTime(0, this.t, fade / 3); o.stop(this.t + fade + 0.2); o2.stop(this.t + fade + 0.2); },
    };
  }
  gatShot() {
    this.burst({ type: 'bandpass', from: 2600 + Math.random() * 600, to: 700, q: 1.2, attack: 0.001, peak: 0.16, dur: 0.07, wet: 0.08 });
    this.tone({ type: 'square', freq: 220 + Math.random() * 40, to: 90, attack: 0.001, peak: 0.035, dur: 0.06, wet: 0.05 });
  }
  hitTick() { this.tone({ type: 'triangle', freq: 1800, to: 1200, peak: 0.03, dur: 0.05, wet: 0.05 }); }
  // Training drones
  droneSpawn() {
    this.tone({ type: 'sine', freq: 180, to: 520, attack: 0.05, peak: 0.08, dur: 0.6, wet: 0.4 });
    this.burst({ type: 'highpass', from: 2000, to: 6000, peak: 0.06, dur: 0.5, wet: 0.3 });
  }
  droneCharge() { this.tone({ type: 'sawtooth', freq: 300, to: 1400, attack: 0.6, peak: 0.035, dur: 0.75, wet: 0.3 }); }
  droneShot() {
    this.tone({ type: 'square', freq: 880, to: 220, attack: 0.002, peak: 0.05, dur: 0.12, wet: 0.2 });
    this.burst({ type: 'bandpass', from: 1500, to: 400, q: 2, peak: 0.08, dur: 0.1, wet: 0.2 });
  }
  droneDown() {
    this.tone({ type: 'sawtooth', freq: 400, to: 60, attack: 0.01, peak: 0.07, dur: 1.2, wet: 0.3 });
    this.burst({ buffer: this.crackleBuf, type: 'bandpass', from: 3000, peak: 0.2, dur: 0.8, wet: 0.2 });
  }
  whiz() { this.burst({ type: 'bandpass', from: 1200, to: 3800, q: 3, attack: 0.04, peak: 0.12, dur: 0.18, wet: 0.1 }); }

  // Low energy hum while a construct is held.
  hum() {
    if (!this.ctx) return nullLoop;
    const t = this.t, out = this.out(0, 0.3);
    const oscs = [110, 220.5, 331].map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.connect(this.gain(0.4 / (i + 1), out));
      o.start(t);
      return o;
    });
    out.gain.setTargetAtTime(0.09, t, 0.05);
    return { level: (v) => out.gain.setTargetAtTime(v, this.t, 0.05), stop: (fade = 0.25) => { out.gain.setTargetAtTime(0, this.t, fade / 3); oscs.forEach((o) => o.stop(this.t + fade + 0.3)); } };
  }

  // Shimmering presence of the green light. Returns a handle with level().
  shimmer() {
    if (!this.ctx) return nullLoop;
    const t = this.t, out = this.out(0, 0.7);
    const trem = this.ctx.createOscillator(), tremDepth = this.gain(0.35);
    trem.frequency.value = 5.5;
    const amp = this.gain(0.65, out);
    trem.connect(tremDepth).connect(amp.gain);
    trem.start();
    const oscs = [220, 329.6, 440, 554.4, 659.3].map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(this.gain(0.12 / (1 + i * 0.3), amp));
      o.start(t);
      return o;
    });
    const sparkle = this.source(this.noiseBuf, true);
    sparkle.connect(this.filter('highpass', 7000, 0.7, this.gain(0.08, amp)));
    sparkle.start(t);
    return {
      level: (v, time = 1) => out.gain.setTargetAtTime(v, this.t, time / 3),
      stop: (fade = 2) => {
        out.gain.setTargetAtTime(0, this.t, fade / 3);
        const end = this.t + fade + 0.5;
        oscs.forEach((o) => o.stop(end)); sparkle.stop(end); trem.stop(end);
      },
    };
  }

  // Sustained chord pad. notes in Hz.
  pad(notes, level = 0.12, { cutoff = 700, fadeIn = 4, wet = 0.6 } = {}) {
    if (!this.ctx) return nullLoop;
    const t = this.t, out = this.out(0, wet);
    const lp = this.filter('lowpass', cutoff, 0.8, out);
    const lfo = this.ctx.createOscillator(), depth = this.gain(cutoff * 0.4);
    lfo.frequency.value = 0.08;
    lfo.connect(depth).connect(lp.frequency);
    lfo.start(t);
    const oscs = [];
    for (const f of notes) for (const d of [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(this.gain(1 / notes.length / 2, lp));
      o.start(t);
      oscs.push(o);
    }
    out.gain.setTargetAtTime(level, t, fadeIn / 3);
    return {
      level: (v, time = 2) => out.gain.setTargetAtTime(v, this.t, time / 3),
      stop: (fade = 3) => {
        out.gain.setTargetAtTime(0, this.t, fade / 3);
        oscs.forEach((o) => o.stop(this.t + fade + 1));
        lfo.stop(this.t + fade + 1);
      },
    };
  }

  musicBox(notes, step = 0.42, peak = 0.09) {
    notes.forEach((f, i) => { if (f) this.tone({ type: 'triangle', freq: f, peak, dur: 1.6, wet: 0.8, delay: i * step }); });
    return notes.length * step;
  }

  // Alien speech: formant-filtered buzz with a ring-modulated edge. Returns its duration.
  alienVoice(text, { pitch = 1 } = {}) {
    if (!this.ctx) return 0;
    const syllables = Math.max(3, Math.round(text.replace(/\s+/g, '').length / 3.2));
    const out = this.out(0.5, 0.35);
    const ring = this.ctx.createGain();
    const rm = this.ctx.createOscillator();
    rm.frequency.value = 38;
    rm.connect(ring.gain);
    ring.gain.value = 0.6;
    ring.connect(out);
    let t = this.t + 0.05;
    const start = t;
    rm.start(t);
    for (let i = 0; i < syllables; i++) {
      const d = 0.11 + Math.random() * 0.13;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const base = (88 + Math.random() * 30) * pitch;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.35), t + d);
      const f1 = this.filter('bandpass', 280 + Math.random() * 520, 6);
      const f2 = this.filter('bandpass', 900 + Math.random() * 1500, 9);
      const env = this.gain(0);
      o.connect(f1).connect(env);
      o.connect(f2).connect(env);
      env.connect(ring);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.025);
      env.gain.linearRampToValueAtTime(0.0, t + d);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d + (Math.random() < 0.22 ? 0.16 : 0.03);
    }
    rm.stop(t + 0.1);
    return t - start;
  }
}

const nullLoop = { level() {}, stop() {}, nodes: [] };
