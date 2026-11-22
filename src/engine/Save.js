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

// Part Two, "The Corps": the summons at the lake, the flight to Oa, Kilowog's range, Sinestro, the
// Guardians, and home. Oa keeps no Earth time, so the clock shows the place. The story runs to
// `homeward` and ends there (Part Three follows); `range` and `earth` are free flight (Oa and Earth,
// the star map between them), reached from the end card or by travelling.
export const CORPS_CHECKPOINTS = [
  { id: 'summons', label: 'The summons', clock: '10:31 PM' },
  { id: 'voyage', label: 'Hyperluminal', clock: 'DEEP SPACE' },
  { id: 'oa', label: 'Kilowog’s range', clock: 'OA · SECTOR 0' },
  { id: 'livefire', label: 'Live fire', clock: 'OA · SECTOR 0' },
  { id: 'sinestro', label: 'Sinestro', clock: 'OA · SECTOR 0' },
  { id: 'duel', label: 'Sparring', clock: 'OA · SECTOR 0' },
  { id: 'guardians', label: 'The Guardians', clock: 'OA · THE CITADEL' },
  { id: 'homeward', label: 'Sector 2814', clock: 'OA · THE CITADEL' },
  { id: 'range', label: 'The training ground', clock: 'OA · SECTOR 0' },
  { id: 'earth', label: 'Home: Sector 2814', clock: '11:48 PM' },
];

// Part Three, "Coast City": the morning after, on Earth. Hal overslept the test flight he flew
// home from Oa to make; rent is late; the drive out to Ferris Aircraft, where Carol fires him. That
// afternoon the test goes ahead without him and the jet goes down: Green Lantern's first time in
// public (Secret Origin), Carol meets him, Hector Hammond attacks, Sinestro ends it; dusk at his
// father's grave.
export const COAST_CHECKPOINTS = [
  { id: 'morning', label: 'The morning after', clock: '9:41 AM' },
  { id: 'drive', label: 'Running late', clock: '9:58 AM' },
  { id: 'ferris', label: 'Ferris Aircraft', clock: '10:23 AM' },
  { id: 'carol', label: 'Carol', clock: '10:26 AM' },
  { id: 'after', label: 'Out of work', clock: '10:44 AM' },
  { id: 'wreck', label: 'Earlier that morning', clock: '5:12 AM' },
  { id: 'test', label: 'The test', clock: '2:01 PM' },
  { id: 'catch', label: 'Green Lantern', clock: '2:03 PM' },
  { id: 'hector', label: 'Hector Hammond', clock: '2:11 PM' },
  { id: 'grave', label: 'Martin Jordan', clock: '6:48 PM' },
];

// Part Four, "The Prisoner": the second half of Secret Origin. Carol takes Hal back as her pilot;
// at night, at Abin Sur's wreck, Sinestro shows him the empty prisoner cell; downtown, the two of
// them against Atrocitus (his device drains their rings; the lantern from the pocket dimension;
// the excavator); Ysmault, and his prophecy; the Guardians' verdict on Oa.
export const PRISONER_CHECKPOINTS = [
  { id: 'pilot', label: 'His pilot', clock: '8:52 AM' },
  { id: 'cell', label: 'The empty cell', clock: '10:40 PM' },
  { id: 'site', label: 'Atrocitus', clock: '11:58 PM' },
  { id: 'ysmault', label: 'Ysmault', clock: 'YSMAULT · SECTOR 666' },
  { id: 'trial', label: 'The verdict', clock: 'OA · THE CITADEL' },
];

// Part Five, "Probation": Hal's first shift as Carol's pilot (the rent, the drive in, an advance on
// his pay, the prototype's test flight, flown), Sinestro collecting him for field training at dusk
// (and Carol finding out); Korugar, where the crowds cheer Sinestro out of fear; the resistance, Katma
// Tui; Hal's report to the Guardians.
export const PROBATION_CHECKPOINTS = [
  { id: 'rent', label: 'The rent', clock: '7:10 AM' },
  { id: 'commute', label: 'The drive in', clock: '7:34 AM' },
  { id: 'advance', label: 'An advance', clock: '8:02 AM' },
  { id: 'testflight', label: 'First shift', clock: '9:30 AM' },
  { id: 'pickup', label: 'Field training', clock: '6:44 PM' },
  { id: 'korugar', label: 'Korugar', clock: 'KORUGAR · SECTOR 1417' },
  { id: 'patrol', label: 'Order', clock: 'KORUGAR · SECTOR 1417' },
  { id: 'rebels', label: 'The resistance', clock: 'KORUGAR · SECTOR 1417' },
  { id: 'report', label: 'The report', clock: 'OA · THE CITADEL' },
];

// Part Six, "Exile": first light at Ferris (Carol, who knows now), Sinestro brought in from his
// palace on Korugar, and his trial on Oa: his ring taken, his banishment to Qward, Katma Tui chosen.
export const EXILE_CHECKPOINTS = [
  { id: 'dawn', label: 'Coming back', clock: '5:48 AM' },
  { id: 'palace', label: 'Bringing him in', clock: 'KORUGAR · SECTOR 1417' },
  { id: 'tribunal', label: 'The trial', clock: 'OA · THE CITADEL' },
  { id: 'firstnight', label: 'Her first night', clock: 'KORUGAR · 11:40 PM' },
  { id: 'qward', label: 'Qward', clock: 'QWARD · THE ANTIMATTER UNIVERSE' },
  { id: 'yellow', label: 'The yellow light', clock: 'KORUGAR · 1:15 AM' },
];

// Free roam: not a part's chapter but the game's open world, opened by Part Six's end and carried on by every
// part after it (each ending goes back to it, with whatever that part added: Zamaron, after Part Seven). Its own
// store, so the title, the pause menu and Continue call it free roam, not the part that opened it.
export const ROAM_CHECKPOINTS = [
  { id: 'world', label: 'Free roam', clock: 'SECTOR 2814' },
];

// Part Seven, "Sapphire": Hal asks Carol to dinner and she sets her terms, the pier at night, and a
// violet light out of the sky that has been looking for someone who loves like she does (Green
// Lantern #16, 1962; Johns' "Mystery of the Star Sapphire", 2007). More follow it: the fight over
// Coast City, the Zamarons' world and their queen, the Predator, the way home and the pier finished;
// then the sting: William Hand, and what Atrocitus left behind.
export const SAPPHIRE_CHECKPOINTS = [
  { id: 'ask', label: 'Dinner', clock: '8:40 AM' },
  { id: 'pier', label: 'The pier', clock: '7:12 PM' },
  { id: 'strike', label: 'The violet light', clock: '8:47 PM' },
  { id: 'hold', label: 'The gem’s hold', clock: '8:58 PM' },
  { id: 'trail', label: 'The wake', clock: 'DEEP SPACE · UNCHARTED' },
  { id: 'zamaron', label: 'Zamaron', clock: 'ZAMARON · UNCHARTED' },
  { id: 'queen', label: 'The queen', clock: 'ZAMARON · THE CITADEL' },
  { id: 'predator', label: 'The Predator', clock: 'ZAMARON · THE CITADEL' },
  { id: 'return', label: 'The way home', clock: 'SECTOR 2814' },
  { id: 'wheel', label: 'The wheel', clock: '12:58 AM' },
  { id: 'hangar', label: 'The morning after', clock: '9:04 AM' },
  { id: 'hand', label: 'Black Hand', clock: '2:12 AM' },
];

function readCookie(key) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(key, value) {
  document.cookie = `${key}=${encodeURIComponent(value)}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
}

// `unlocks` lists the constructs the ring can make, `worlds` the planets charted for hyperspace
// travel (both added alongside version 1; older saves get []).
const blank = () => ({ version: 1, checkpoint: null, reached: [], settings: { voice: true }, stats: { fears: 0 }, unlocks: [], worlds: [], savedAt: 0 });

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
        d.playedAt = Date.now();
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
export const CorpsSave = createSave({ part: 'corps', key: 'gl_corps_v1', checkpoints: CORPS_CHECKPOINTS, label: 'Part Two · The Corps', first: 'summons' });
export const CoastSave = createSave({ part: 'coast', key: 'gl_coast_v1', checkpoints: COAST_CHECKPOINTS, label: 'Part Three · Coast City', first: 'morning' });
export const PrisonerSave = createSave({ part: 'prisoner', key: 'gl_prisoner_v1', checkpoints: PRISONER_CHECKPOINTS, label: 'Part Four · The Prisoner', first: 'pilot' });
export const ProbationSave = createSave({ part: 'probation', key: 'gl_probation_v1', checkpoints: PROBATION_CHECKPOINTS, label: 'Part Five · Probation', first: 'rent' });
export const ExileSave = createSave({ part: 'exile', key: 'gl_exile_v1', checkpoints: EXILE_CHECKPOINTS, label: 'Part Six · Exile', first: 'dawn' });
export const SapphireSave = createSave({ part: 'sapphire', key: 'gl_sapphire_v1', checkpoints: SAPPHIRE_CHECKPOINTS, label: 'Part Seven · Sapphire', first: 'ask' });
export const RoamSave = createSave({ part: 'roam', key: 'gl_roam_v1', checkpoints: ROAM_CHECKPOINTS, label: 'Free roam', first: 'world' });
export const PARTS = { awakening: Save, corps: CorpsSave, coast: CoastSave, prisoner: PrisonerSave, probation: ProbationSave, exile: ExileSave, sapphire: SapphireSave, roam: RoamSave };

// Free roam is open once Part Six is finished.
export const freeRoamOpen = () => ExileSave.load().reached.includes('yellow') || RoamSave.load().reached.length > 0;
// Saves from when free roam was Part Six's last checkpoint (`world` in its store): over to free roam's own.
export function moveFreeRoam() {
  const ex = ExileSave.load();
  if (ex.checkpoint !== 'world') return;
  RoamSave.update((d) => { d.checkpoint = 'world'; d.playedAt = ex.playedAt ?? Date.now(); if (!d.reached.includes('world')) d.reached.push('world'); d.unlocks = [...new Set([...d.unlocks, ...ex.unlocks])]; });
  ExileSave.update((d) => { d.checkpoint = 'yellow'; d.reached = d.reached.filter((r) => r !== 'world'); d.playedAt = (ex.playedAt ?? 1) - 1; });
}

export const checkpointIndex = Save.index;
export const checkpointInfo = Save.info;

// Which part a checkpoint id belongs to (ids are unique across parts).
export const partOf = (id) => Object.values(PARTS).find((p) => p !== Save && p.index(id) >= 0)?.part ?? 'awakening';

// The checkpoint played last in any part: { part, id, save }, or null before the first. `playedAt`
// is set by checkpoints only: `savedAt` moves with settings too, and the settings live in Part One's
// store. Saves from before it fall back to `savedAt` (Part One's to 0); a tie goes to the later part.
export function latestCheckpoint() {
  let best = null, bestAt = -1;
  for (const p of Object.values(PARTS)) {
    const d = p.load();
    if (!d.checkpoint || (p === Save && d.checkpoint === 'home' && !d.playedAt)) continue;
    const at = d.playedAt || (p === Save ? 0 : d.savedAt);
    if (at >= bestAt) { best = { part: p.part, id: d.checkpoint, save: p }; bestAt = at; }
  }
  return best;
}

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
export const allUnlocks = () => [...new Set(Object.values(PARTS).flatMap((p) => p.load().unlocks))];
// Planets charted for travel in any part.
export const allWorlds = () => [...new Set(Object.values(PARTS).flatMap((p) => p.load().worlds))];

// The open world's own state (free roam on Earth: the clock and the weather, and what the later
// systems add to it), in a store of its own beside the parts': it isn't a checkpoint, and it carries
// on whichever part the player was last in. `update(fn)` reads, changes and writes it.
const LIFE_KEY = 'gl_life_v1';
const lifeBlank = () => ({ version: 1, hour: 9.5, day: 1, weather: 'clear', weatherNext: 13 });
export const LifeSave = {
  load() {
    let raw = null;
    try { raw = localStorage.getItem(LIFE_KEY); } catch { /* storage blocked */ }
    raw ??= readCookie(LIFE_KEY);
    try {
      const d = raw ? JSON.parse(raw) : null;
      return d?.version === 1 ? { ...lifeBlank(), ...d } : lifeBlank();
    } catch {
      return lifeBlank();
    }
  },
  write(d) {
    const raw = JSON.stringify(d);
    try { localStorage.setItem(LIFE_KEY, raw); } catch { /* storage blocked */ }
    try { writeCookie(LIFE_KEY, raw); } catch { /* cookies blocked */ }
  },
  update(fn) { const d = this.load(); fn(d); this.write(d); return d; },
};
