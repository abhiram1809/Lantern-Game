// Progress and settings, kept in localStorage with a cookie mirror (used when localStorage is
// unavailable, e.g. some private-browsing modes). Each part of the story has its own store and
// checkpoint list; settings (voices) live in Part One's store and are shared.
export const CHECKPOINTS = [
  { id: 'home', label: 'Coming home', clock: '9:47 PM' },
  { id: 'bedroom', label: 'Get some rest', clock: '9:51 PM' },
  { id: 'light', label: 'The light', clock: '10:00 PM' },
  { id: 'question', label: 'Are you afraid?', clock: '10:01 PM' },
  { id: 'crash', label: 'The crash site', clock: '10:02 PM' },
  { id: 'abin', label: 'Abin Sur', clock: '10:04 PM' },
  { id: 'lantern', label: 'The lantern', clock: '10:09 PM' },
  { id: 'powers', label: 'The ring’s power', clock: '10:12 PM' },
  { id: 'free', label: 'Green Lantern', clock: '10:20 PM' },
];

// Part Two, "The Corps": Oa. Oa keeps no Earth time, so the clock shows the sector.
export const CORPS_CHECKPOINTS = [
  { id: 'oa', label: 'Kilowog’s range', clock: 'OA · SECTOR 0' },
  { id: 'livefire', label: 'Live fire', clock: 'OA · SECTOR 0' },
  { id: 'range', label: 'The training ground', clock: 'OA · SECTOR 0' },
];

function readCookie(key) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(key, value) {
  document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

// `unlocks` lists the constructs the ring can make (added alongside version 1; older saves get []).
const blank = () => ({ version: 1, checkpoint: null, reached: [], settings: { voice: true }, stats: { fears: 0 }, unlocks: [], savedAt: 0 });

function createSave({ part, key, checkpoints, label, first }) {
  const save = {
    part, key, checkpoints, label, first,
    index: (id) => checkpoints.findIndex((c) => c.id === id),
    info: (id) => checkpoints[Math.max(0, checkpoints.findIndex((c) => c.id === id))],

    load() {
      let raw = null;
      try { raw = localStorage.getItem(key); } catch { /* storage blocked */ }
      raw ??= readCookie(key);
      try {
        const data = raw ? JSON.parse(raw) : null;
        return data?.version === 1 ? { ...blank(), ...data, settings: { ...blank().settings, ...data.settings } } : blank();
      } catch {
        return blank();
      }
    },

    write(data) {
      const raw = JSON.stringify({ ...data, savedAt: Date.now() });
      try { localStorage.setItem(key, raw); } catch { /* storage blocked */ }
      try { writeCookie(key, raw); } catch { /* cookies blocked */ }
    },

    update(fn) {
      const data = this.load();
      fn(data);
      this.write(data);
      return data;
    },

    checkpoint(id) {
      return this.update((d) => {
        d.checkpoint = id;
        if (!d.reached.includes(id)) d.reached.push(id);
      });
    },

    newGame() {
      // keep unlocked chapters and settings, restart the story
      return this.update((d) => { d.checkpoint = first; d.stats = { fears: 0 }; });
    },

    setting(name, value) {
      if (save !== Save) return Save.setting(name, value);
      if (value === undefined) return this.load().settings[name];
      this.update((d) => (d.settings[name] = value));
    },

    // Restart a checkpoint after a page reload (the reload itself is the cleanest scene reset).
    resumeAfterReload(id) {
      try { sessionStorage.setItem(RESUME, JSON.stringify({ part, id })); } catch { /* ignore */ }
      location.hash = '';
      location.reload();
    },
  };
  return save;
}

const RESUME = 'gl_resume';

export const Save = createSave({ part: 'awakening', key: 'gl_awakening_v1', checkpoints: CHECKPOINTS, label: 'Part One · Awakening', first: 'home' });
export const CorpsSave = createSave({ part: 'corps', key: 'gl_corps_v1', checkpoints: CORPS_CHECKPOINTS, label: 'Part Two · The Corps', first: 'oa' });
export const PARTS = { awakening: Save, corps: CorpsSave };

export const checkpointIndex = Save.index;
export const checkpointInfo = Save.info;

// Which part a checkpoint id belongs to (ids are unique across parts).
export const partOf = (id) => (CorpsSave.index(id) >= 0 ? 'corps' : 'awakening');

// The pending restart after a reload, if any: { part, id }.
export function takeResume() {
  try {
    const raw = sessionStorage.getItem(RESUME);
    sessionStorage.removeItem(RESUME);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Constructs unlocked in any part (they carry over).
export const allUnlocks = () => [...new Set([...Save.load().unlocks, ...CorpsSave.load().unlocks])];
