// Spoken lines through the browser's speech synthesiser, with a voice profile per character.
const PROFILES = {
  hal: { prefer: ['Aaron', 'Evan', 'Nathan', 'Tom', 'Alex', 'Google US English', 'Microsoft Guy'], rate: 1.02, pitch: 0.95 },
  abin: { prefer: ['Daniel', 'Arthur', 'Reed', 'Rocko', 'Google UK English Male', 'Microsoft George', 'Fred'], rate: 0.8, pitch: 0.5 },
  light: { prefer: ['Whisper', 'Samantha', 'Google UK English Female', 'Microsoft Zira'], rate: 0.78, pitch: 0.7 },
  dad: { prefer: ['Ralph', 'Fred', 'Daniel', 'Alex', 'Google US English'], rate: 0.95, pitch: 0.8 },
  kid: { prefer: ['Junior', 'Samantha', 'Google US English'], rate: 1.05, pitch: 1.7 },
  kilowog: { prefer: ['Fred', 'Ralph', 'Rocko', 'Grandpa', 'Daniel', 'Google UK English Male', 'Microsoft David'], rate: 0.92, pitch: 0.42 },
  ring: { prefer: ['Karen', 'Moira', 'Samantha', 'Google UK English Female', 'Microsoft Hazel', 'Microsoft Zira'], rate: 1.05, pitch: 0.55 },
  guardian: { prefer: ['Daniel', 'Arthur', 'Google UK English Male', 'Microsoft George', 'Fred'], rate: 0.76, pitch: 0.62 },
};

export class Voice {
  constructor() {
    this.supported = 'speechSynthesis' in window;
    this.enabled = this.supported;
    this.voices = [];
    if (this.supported) {
      const load = () => (this.voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')));
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  pick(profile) {
    for (const name of profile.prefer) {
      const v = this.voices.find((x) => x.name.startsWith(name));
      if (v) return v;
    }
    return this.voices[0];
  }

  // Resolves when the line finishes (or after a time-based fallback if the engine stays silent).
  // onWord(charIndex) follows the engine's word boundaries, where it reports them.
  speak(text, who = 'hal', onWord) {
    if (!this.enabled || !this.voices.length) return Promise.resolve();
    const profile = PROFILES[who] ?? PROFILES.hal;
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text.replace(/…/g, '...'));
      u.voice = this.pick(profile);
      u.rate = profile.rate;
      u.pitch = profile.pitch;
      u.volume = 0.95;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      if (onWord) u.onboundary = (e) => { if (e.name !== 'sentence') onWord(e.charIndex); };
      u.onerror = finish;
      setTimeout(finish, 1500 + text.length * 95);
      speechSynthesis.speak(u);
    });
  }

  cancel() { if (this.supported) speechSynthesis.cancel(); }
}
