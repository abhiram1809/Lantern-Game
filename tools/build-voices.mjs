#!/usr/bin/env node
// Pre-renders every spoken line in src/story/lines.js to public/voices/<key>.mp3, plus
// public/voices/manifest.json with word timings and a mouth-openness track for lip sync.
//
// TTS: Kokoro-82M (hexgrad, Apache-2.0), ONNX export with per-phoneme durations
// (onnx-community/Kokoro-82M-v1.0-ONNX-timestamped), run on the CPU through kokoro-js and
// onnxruntime-node. Text goes through espeak-ng (the `phonemizer` package, WASM) with our own
// lexicon for the names espeak gets wrong. Each character is a Kokoro base voice shifted to a
// target pitch (formants by resampling, pitch by TD-PSOLA) and run through its own effects chain;
// all of it offline, so the game only plays files.
//
//   npm run voices                       render what changed (text, voice settings or pipeline)
//   ONLY=kwIntro1,sin2 npm run voices    just these lines        WHO=carol,tom   just these speakers
//   FORCE=1                              re-render everything that matches the filters
//   SURVEY=1                             measure the median F0 of every English Kokoro voice
//   HF_CACHE=dir                         where the model is cached (default ~/.cache/lantern-voices)
//   DTYPE=fp32|q8                        model precision (default fp32, the reference weights; fast enough on a CPU)
//
// Alien lines (`alien: true`) are skipped: the game voices those with its synthetic buzz.
//
// manifest.json: { version: 1, lines: { key: { who, text (as in lines.js), file: 'voices/<key>.mp3',
//   dur (s), end (s, where the voice stops and any reverb tail begins), words: [[charIndex, s], ...],
//   mouth: base64 Uint8Array, 60 frames/s, 0-255 } } }. Loudness: speech RMS -19 dBFS, peaks <= -1 dBFS.
// build.json (not used by the game): per-line hashes for incremental builds, the pitch calibration,
// and a summary of each character for tools/voices.html (the audition page on the dev server).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'voices');
const LINES_FILE = path.join(ROOT, 'src', 'story', 'lines.js');
const SR = 24000;
const VERSION = 2; // bump after a pipeline change that should re-render every line
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX-timestamped';
const DTYPE = process.env.DTYPE || 'fp32';
const PHONES = process.env.PHONES || 'espeak'; // 'espeak' (raw IPA, as kokoro-js does) or 'misaki' (one symbol per diphthong; no better by ASR)
const FFMPEG = process.env.FFMPEG || (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');
const BITRATE = '48k';
const FPS = 60; // mouth track frames per second
const FRAME = 600; // samples per Kokoro duration frame (24 kHz / 40)

// ---------------------------------------------------------------------------------------------
// Characters. voice: a Kokoro voice or a blend { mix: [[voice, weight], ...] }. speed: final
// speaking rate (1 = Kokoro's own). f0: target median pitch (Hz) of the main voice. formant:
// resampling factor (< 1 lowers formants and pitch together: a bigger head and chest); the rest of
// the pitch change is TD-PSOLA, which keeps the formants. level: dB offset after loudness
// normalisation (negative only). fx: the effects chain, run on the pitched dry voice (see runFx).
// tail: seconds of reverb tail kept after the last word.
const CHARACTERS = {
  hal: {
    desc: 'Hal Jordan: young American test pilot, warm, wry, confident',
    voice: 'am_michael', speed: 1.0, f0: 115, formant: 0.96,
    fx: [['hp', 70], ['lowshelf', 160, 1.5], ['peak', 3200, 1.5, 1], ['comp', { thr: -18, ratio: 2.5 }]],
  },
  thought: {
    desc: 'Hal’s inner voice: close, soft, no room',
    base: 'hal', speed: 0.97, f0: 112,
    fx: [['hp', 60], ['lowshelf', 200, 2.5], ['lp', 5200, 0.6], ['highshelf', 3500, -3], ['comp', { thr: -22, ratio: 2.5 }]],
    level: -5,
  },
  sinestro: {
    desc: 'Sinestro: British, measured, cold, aristocratic menace',
    voice: 'bm_george', speed: 0.92, f0: 100, formant: 0.9,
    fx: [['hp', 60], ['lowshelf', 150, 2], ['peak', 2800, 2, 1.2], ['highshelf', 7000, -2], ['comp', { thr: -20, ratio: 3 }],
      ['reverb', { rt: 0.5, pre: 0.012, wet: 0.06, damp: 0.4 }]],
    tail: 0.25,
  },
  kilowog: {
    desc: 'Kilowog: huge alien drill sergeant, monstrous',
    voice: { mix: [['am_onyx', 0.6], ['am_fenrir', 0.4]] }, speed: 0.96, f0: 65, formant: 0.78,
    fx: [['hp', 35], ['octave', 0.5, 0.33, 0], ['growl', 34, 0.28], ['sat', 2.6, 0.55], ['lowshelf', 140, 5],
      ['peak', 2400, 4, 1.1], ['peak', 600, -2, 1], ['comp', { thr: -20, ratio: 4, att: 0.003, rel: 0.09 }],
      ['reverb', { rt: 0.7, pre: 0.01, wet: 0.08, damp: 0.35 }]],
    tail: 0.3,
  },
  guardian: {
    desc: 'The Guardians: ancient, calm, many-voiced',
    voice: 'bm_fable', speed: 0.88, f0: 120, formant: 0.96,
    fx: [['hp', 50], ['octave', 0.5, 0.2, 0.006], ['octave', 1.012, 0.3, 0.013], ['octave', 0.988, 0.24, 0.021],
      ['lowshelf', 180, 2], ['highshelf', 6000, -3], ['comp', { thr: -20, ratio: 2.5 }],
      ['reverb', { rt: 3.0, pre: 0.035, wet: 0.24, damp: 0.45, er: 0.2 }]],
    tail: 0.9,
  },
  carol: {
    desc: 'Carol Ferris: American executive, confident, clipped when angry',
    voice: 'af_heart', speed: 1.04, f0: 195, formant: 1.0,
    fx: [['hp', 90], ['peak', 3500, 1.5, 1], ['comp', { thr: -18, ratio: 3 }]],
  },
  abin: {
    desc: 'Abin Sur: dying alien Lantern, deep, gentle, tired, breathy',
    voice: 'bm_lewis', speed: 0.86, f0: 90, formant: 0.93,
    fx: [['hp', 50], ['breath', -19, 1400, 7000], ['lowshelf', 160, 2], ['lp', 7000], ['comp', { thr: -20, ratio: 2.5 }],
      ['reverb', { rt: 1.1, pre: 0.02, wet: 0.08, damp: 0.4 }]],
    tail: 0.4,
  },
  light: {
    desc: 'The ring’s summoning light: ethereal, androgynous, airy',
    voice: { mix: [['af_nicole', 0.55], ['am_michael', 0.45]] }, speed: 0.86, f0: 155, formant: 1.02,
    fx: [['hp', 110], ['breath', -17, 2500, 9000], ['octave', 2, 0.1, 0.004], ['octave', 1.006, 0.35, 0.017],
      ['highshelf', 5000, 2], ['comp', { thr: -20, ratio: 2.5 }],
      ['reverb', { rt: 3.6, pre: 0.04, wet: 0.36, damp: 0.6, er: 0.15 }]],
    tail: 0.9,
  },
  ring: {
    desc: 'The ring’s readout: cool synthetic female, band-limited, faintly metallic',
    voice: 'bf_emma', speed: 1.02, f0: 0, formant: 1.0,
    fx: [['hp', 260], ['lp', 7200], ['comb', 2.6, 0.35, 0.22], ['peak', 2600, 2, 1], ['comp', { thr: -22, ratio: 4 }],
      ['reverb', { rt: 0.35, pre: 0.006, wet: 0.08, damp: 0.5 }]],
    tail: 0.2,
  },
  dad: {
    desc: 'Martin Jordan: warm older American man (in a dream)',
    voice: { mix: [['am_michael', 0.5], ['am_onyx', 0.5]] }, speed: 0.95, f0: 105, formant: 0.97,
    fx: [['hp', 60], ['lowshelf', 160, 2], ['lp', 7500], ['comp', { thr: -20, ratio: 2.5 }],
      ['reverb', { rt: 1.4, pre: 0.02, wet: 0.14, damp: 0.5 }]],
    tail: 0.5,
  },
  kid: {
    desc: 'Hal aged eight (in a dream)',
    voice: 'af_bella', speed: 1.03, f0: 260, formant: 1.15,
    fx: [['hp', 120], ['lp', 8000], ['comp', { thr: -20, ratio: 2.5 }], ['reverb', { rt: 1.4, pre: 0.02, wet: 0.14, damp: 0.5 }]],
    tail: 0.5,
  },
  tom: {
    desc: 'Tom Kalmaku: friendly mechanic, quick',
    voice: 'am_eric', speed: 1.0, f0: 125, formant: 1.0, // am_puck slurred "Hal, it's Tom" at speed
    fx: [['hp', 70], ['comp', { thr: -18, ratio: 2.5 }]],
  },
  landlord: {
    desc: 'Sal Delgado: older gruff American landlord',
    voice: 'am_echo', speed: 0.95, f0: 100, formant: 0.94,
    fx: [['hp', 70], ['sat', 1.8, 0.25], ['lowshelf', 180, 2], ['comp', { thr: -18, ratio: 3 }]],
  },
  hammond: {
    desc: 'Hector Hammond: American scientist, soft-spoken, precise, quietly unhinged',
    voice: 'am_adam', speed: 0.93, f0: 108, formant: 1.0,
    fx: [['hp', 80], ['peak', 2600, 2, 1.5], ['highshelf', 6500, -2], ['comp', { thr: -20, ratio: 3 }],
      ['reverb', { rt: 0.9, pre: 0.015, wet: 0.09, damp: 0.45 }]],
    tail: 0.3,
  },
  pilot: {
    desc: 'Viper One-One: an Air Force test pilot on the radio, strained',
    voice: 'am_onyx', speed: 1.05, f0: 108, formant: 1.0,
    fx: [['hp', 90], ['comp', { thr: -18, ratio: 3 }]],
  },
  tech: {
    desc: 'An Air Force technician at the wreck, nervous',
    voice: 'am_liam', speed: 1.02, f0: 122, formant: 1.0,
    fx: [['hp', 80], ['comp', { thr: -18, ratio: 2.5 }], ['reverb', { rt: 0.8, pre: 0.01, wet: 0.08, damp: 0.5 }]],
  },
  tech2: {
    desc: 'A second technician (his thoughts, overheard)',
    voice: 'am_fenrir', speed: 1.0, f0: 110, formant: 0.98,
    fx: [['hp', 80], ['lp', 6000], ['comp', { thr: -20, ratio: 2.5 }], ['reverb', { rt: 1.2, pre: 0.02, wet: 0.14, damp: 0.5 }]],
    level: -3,
  },
};
// On top of the speaker's chain for style: 'phone' (voicemail on speaker): telephone band.
const PHONE_FX = [['hp', 300, 0.9], ['hp', 300, 0.6], ['lp', 3400, 0.9], ['lp', 3400, 0.6], ['peak', 1800, 4, 1],
  ['comp', { thr: -26, ratio: 4, att: 0.004, rel: 0.12 }], ['sat', 1.6, 0.3]];
// Per-line overrides.
const LINE_TWEAKS = {
  carol6: { speed: 1.08 }, carol7: { speed: 1.1 }, carol4: { speed: 0.98 },
  kid3: { speed: 1.0 },
  kwKill3: { speed: 1.04 }, kwShield: { speed: 1.04 }, kwCover: { speed: 1.04 },
};
const CALIBRATION = [
  'I have been flying for most of my life, and I have never seen anything like this.',
  'Where were you last night? Tell me the truth, and tell me now.',
];
const PAUSE = { ellipsis: 0.42, lead: 0.32 }; // seconds added at a mid-line "…" / before a line that opens with one

// ---------------------------------------------------------------------------------------------
// Pronunciation. RESPELL swaps a word for other words before espeak; LEXICON gives IPA directly
// ([US, GB]). Keys are lower case, with straight apostrophes; a possessive ’s is handled.
const RESPELL = {
  '2814': 'twenty-eight fourteen',
  mr: 'mister', mrs: 'missus', dr: 'doctor',
};
const ABBR = new Set(['mr', 'mrs', 'dr']); // their full stop isn't a sentence end
const LEXICON = {
  sinestro: ['sɪnˈɛstɹoʊ', 'sɪnˈɛstɹəʊ'], // espeak: "SINE-stro"
  abin: ['ˈeɪbɪn', 'ˈeɪbɪn'], // AY-bin
  sur: ['sˈɜːɹ', 'sˈɜː'],
  ungara: ['ʊŋɡˈɑːɹə', 'ʊŋɡˈɑːɹə'],
  oa: ['ˈoʊə', 'ˈəʊə'], // OH-uh (espeak agrees; pinned so it can't drift)
  kilowog: ['kˈɪləwˌɑːɡ', 'kˈɪləwˌɒɡ'],
  poozer: ['pˈuːzɚ', 'pˈuːzə'],
  kalmaku: ['kælmˈɑːkuː', 'kalmˈɑːkuː'],
  hal: ['hˈæl', 'hˈæl'], // British voices said "How" with espeak's GB vowel
  hmph: ['hˈʌmf', 'hˈʌmf'], // espeak spells these out
  hm: ['hˈm', 'hˈm'],
  wh: ['wˈʌ', 'wˈʌ'],
  "'em": ['əm', 'əm'],
  ow: ['ˈaʊ', 'ˈaʊ'], // espeak: "oh"
};

// ---------------------------------------------------------------------------------------------
// Text → phonemes, keeping which word each phoneme belongs to (for word timings).

const WORD_RE = /(?<![A-Za-z])['’][A-Za-z]+|[A-Za-z0-9]+(?:['’][A-Za-z]+)*(?:-[A-Za-z0-9]+)*/g;
const PUNCT_RE = /[;:,.!?—…"()]/;

function normSep(s) {
  return s.replace(/\.\.\./g, '…').replace(/[“”]/g, '"').replace(/[‘’]/g, '').replace(/[^;:,.!?—…"()\s]/g, '').replace(/\s+/g, ' ');
}

// Words and the punctuation between them.
function parse(text) {
  const items = [];
  let last = 0, lead = false;
  const sep = (s, first) => {
    let n = normSep(s);
    if (first) {
      if (/^\s*…/.test(n)) { lead = true; n = n.replace(/^\s*…\s*/, ''); }
      n = n.replace(/^\s+/, '');
    }
    if (PUNCT_RE.test(n)) items.push({ type: 'punct', text: n });
    else if (n.length && items.length) items.push({ type: 'space' });
  };
  for (const m of text.matchAll(WORD_RE)) {
    sep(text.slice(last, m.index), last === 0);
    items.push({ type: 'word', ci: m.index, raw: m[0] });
    last = m.index + m[0].length;
  }
  sep(text.slice(last), last === 0);
  // abbreviations: drop the full stop
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i], b = items[i + 1];
    if (a.type === 'word' && ABBR.has(a.raw.toLowerCase()) && b.type === 'punct' && b.text.startsWith('.')) {
      b.text = b.text.slice(1);
      if (!PUNCT_RE.test(b.text)) items[i + 1] = { type: 'space' };
    }
  }
  while (items.length && items.at(-1).type === 'space') items.pop();
  return { items, lead };
}

function spokenForm(raw, british) {
  const w = raw.replace(/’/g, "'");
  const key = w.toLowerCase();
  const lex = (k) => LEXICON[k]?.[british ? 1 : 0];
  if (lex(key)) return { ipa: lex(key) };
  if (key.endsWith("'s") && lex(key.slice(0, -2))) return { ipa: lex(key.slice(0, -2)) + 'z' };
  if (RESPELL[key]) return { text: RESPELL[key] };
  if (/^[A-Z]{2,}$/.test(w)) return { text: w[0] + w.slice(1).toLowerCase() }; // "DAD" is a word, not letters
  return { text: w };
}

let _espeak = null;
async function espeak(text, lang) {
  _espeak ??= (await import('phonemizer')).phonemize;
  let ps = (await _espeak(text, lang)).join(' ');
  // kokoro-js's post-processing of espeak output
  ps = ps.replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ').replace(/ z(?=\s|$)/g, 'z');
  if (lang === 'en-us') ps = ps.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return ps.trim().split(/\s+/).filter(Boolean);
}

// espeak IPA → the phone set Kokoro v1.0 was trained on for English (misaki: one symbol per
// diphthong and affricate; US English without length marks).
function toMisaki(g, british) {
  g = g.replace(/dʒ/g, 'ʤ').replace(/tʃ/g, 'ʧ').replace(/eɪ/g, 'A').replace(/aɪ/g, 'I').replace(/aʊ/g, 'W')
    .replace(/ɔɪ/g, 'Y').replace(/ɐ/g, 'ə');
  if (british) g = g.replace(/əʊ/g, 'Q').replace(/eə/g, 'ɛː');
  else g = g.replace(/oʊ/g, 'O').replace(/ɚ/g, 'əɹ').replace(/ɜːɹ/g, 'ɜɹ').replace(/ɜː/g, 'ɜɹ').replace(/ɪə/g, 'iə').replace(/ː/g, '').replace(/o/g, 'ɔ');
  return g;
}

// Labels for the characters of `out` from the labelled sequence `ref` (edit-distance alignment).
function alignLabels(out, ref, refLab) {
  const n = out.length, m = ref.length, d = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (out[i - 1] === ref[j - 1] ? 0 : 1));
  const lab = new Array(n).fill(-1);
  for (let i = n, j = m; i > 0;) {
    if (j > 0 && d[i][j] === d[i - 1][j - 1] + (out[i - 1] === ref[j - 1] ? 0 : 1)) { lab[--i] = refLab[--j]; }
    else if (j > 0 && d[i][j] === d[i][j - 1] + 1) j--;
    else { lab[--i] = refLab[Math.max(0, j - 1)] ?? refLab[0]; }
  }
  return lab;
}

// Returns { ps, label (word index per phoneme char, -1 for spaces/punctuation), words, lead, notes }
async function phonemize(text, british) {
  const lang = british ? 'en' : 'en-us';
  const { items, lead } = parse(text);
  const words = [];
  const chars = [], label = [];
  const notes = [];
  const emit = (s, wi) => { for (const c of s) { chars.push(c); label.push(wi); } };
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.type === 'punct') { emit(it.text, -1); i++; continue; }
    if (it.type === 'space') { i++; continue; }
    // a run of words with no punctuation between them
    const run = [];
    while (i < items.length && items[i].type !== 'punct') {
      if (items[i].type === 'word') {
        const w = items[i];
        run.push({ wi: words.length, ...spokenForm(w.raw, british) });
        words.push({ ci: w.ci, raw: w.raw });
      }
      i++;
    }
    const groups = []; // [phonemes, word index per char]
    for (let k = 0; k < run.length;) {
      if (run[k].ipa) { groups.push([run[k].ipa, Array(run[k].ipa.length).fill(run[k].wi)]); k++; continue; }
      const sub = [];
      while (k < run.length && !run[k].ipa) sub.push(run[k++]);
      const out = await espeak(sub.map((w) => w.text).join(' '), lang);
      const counts = sub.map((w) => w.text.split(/\s+/).length);
      if (out.length === counts.reduce((a, b) => a + b, 0)) {
        let o = 0;
        sub.forEach((w, j) => { for (let c = 0; c < counts[j]; c++) { const g = out[o++]; groups.push([g, Array(g.length).fill(w.wi)]); } });
      } else {
        // espeak joined or split words ("does not" → dʌznˌɒt): align the run's phonemes to each
        // word phonemized alone, character by character, and label them from that
        const iso = [], isoLab = [];
        for (const w of sub) for (const c of (await espeak(w.text, lang)).join('')) { iso.push(c); isoLab.push(w.wi); }
        const lab = alignLabels(out.join(''), iso, isoLab);
        let o = 0;
        for (const g of out) { groups.push([g, lab.slice(o, o + g.length)]); o += g.length; }
      }
    }
    groups.forEach(([g, lab], j) => {
      if (j) emit(' ', -1);
      if (PHONES === 'misaki') emit(toMisaki(g, british), lab[0]);
      else for (let c = 0; c < g.length; c++) { chars.push(g[c]); label.push(lab[c]); }
    });
  }
  // trim spaces at the ends
  while (chars.length && chars[0] === ' ') { chars.shift(); label.shift(); }
  while (chars.length && chars.at(-1) === ' ') { chars.pop(); label.pop(); }
  return { ps: chars.join(''), label, words, lead, notes };
}

// ---------------------------------------------------------------------------------------------
// Kokoro

let tts = null, Tensor = null, vocab = null;
const styles = new Map();

async function loadModel() {
  if (tts) return;
  const tf = await import('@huggingface/transformers');
  tf.env.cacheDir = process.env.HF_CACHE || path.join(os.homedir(), '.cache', 'lantern-voices');
  Tensor = tf.Tensor;
  const { KokoroTTS } = await import('kokoro-js');
  const t0 = performance.now();
  tts = await KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: 'cpu' });
  vocab = tts.tokenizer.model.tokens_to_ids;
  console.log(`model ${MODEL} (${DTYPE}) loaded in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

function voiceFile(name) {
  if (!/^[a-z]{2}_[a-z]+$/.test(name)) throw new Error(`bad voice name ${name}`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.resolve('kokoro-js'))), '..', 'voices');
  return new Float32Array(fs.readFileSync(path.join(dir, `${name}.bin`)).buffer.slice(0));
}

function styleOf(voice) {
  const key = JSON.stringify(voice);
  if (styles.has(key)) return styles.get(key);
  let s;
  if (typeof voice === 'string') s = voiceFile(voice);
  else {
    const parts = voice.mix.map(([v, w]) => [voiceFile(v), w]);
    const tot = parts.reduce((a, [, w]) => a + w, 0);
    s = new Float32Array(parts[0][0].length);
    for (const [v, w] of parts) for (let i = 0; i < s.length; i++) s[i] += (v[i] * w) / tot;
  }
  styles.set(key, s);
  return s;
}

const isBritish = (voice) => (typeof voice === 'string' ? voice : voice.mix[0][0])[0] === 'b';

// Returns { wave: Float32Array, tok: [{ start, end, ch, wi }] (samples), words, lead, ps, notes }
async function synth(text, voice, speed) {
  await loadModel();
  const p = await phonemize(text, isBritish(voice));
  const ids = [0], lab = [-2], chs = [''];
  [...p.ps].forEach((c, i) => {
    const id = vocab.get(c);
    if (id === undefined) { p.notes.push(`dropped phoneme "${c}"`); return; }
    ids.push(id); lab.push(p.label[i]); chs.push(c);
  });
  ids.push(0); lab.push(-2); chs.push('');
  if (ids.length > 512) throw new Error(`line too long for one pass (${ids.length} tokens)`);
  const style = styleOf(voice), n = Math.min(Math.max(ids.length - 2, 0), 509);
  const out = await tts.model({
    input_ids: new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    style: new Tensor('float32', style.slice(256 * n, 256 * n + 256), [1, 256]),
    speed: new Tensor('float32', [speed], [1]),
  });
  const wave = new Float32Array(out.waveform.data);
  const dur = Array.from(out.durations.data, (d) => Math.max(1, Math.round(Number(d))));
  const tok = [];
  let s = 0;
  dur.forEach((d, i) => { tok.push({ start: s, end: s + d * FRAME, ch: chs[i], wi: lab[i] }); s += d * FRAME; });
  return { wave, tok, words: p.words, lead: p.lead, ps: p.ps, notes: p.notes };
}

// ---------------------------------------------------------------------------------------------
// DSP

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function biquad(x, type, f0, Q = Math.SQRT1_2, gainDb = 0) {
  const A = Math.pow(10, gainDb / 40), w = (2 * Math.PI * Math.min(f0, SR * 0.49)) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'bandpass') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
  else {
    const s = 2 * Math.sqrt(A) * al, sg = type === 'lowshelf' ? 1 : -1;
    b0 = A * ((A + 1) - sg * (A - 1) * cs + s); b1 = sg * 2 * A * ((A - 1) - sg * (A + 1) * cs); b2 = A * ((A + 1) - sg * (A - 1) * cs - s);
    a0 = (A + 1) + sg * (A - 1) * cs + s; a1 = -sg * 2 * ((A - 1) + sg * (A + 1) * cs); a2 = (A + 1) + sg * (A - 1) * cs - s;
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}

// out[n] = x(n·f), windowed-sinc interpolation, band-limited when f > 1.
function resample(x, f) {
  if (f === 1) return x;
  const n = Math.floor(x.length / f), out = new Float32Array(n);
  const fc = Math.min(1, 1 / f) * 0.94, half = Math.ceil(10 / fc);
  for (let i = 0; i < n; i++) {
    const p = i * f, c = Math.floor(p);
    let s = 0;
    for (let k = Math.max(0, c - half + 1), e = Math.min(x.length - 1, c + half); k <= e; k++) {
      const d = p - k, t = d * fc;
      s += x[k] * (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * (0.5 + 0.5 * Math.cos((Math.PI * d) / half));
    }
    out[i] = s * fc;
  }
  return out;
}

function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function convolve(x, h) {
  const m = x.length + h.length - 1;
  let n = 1;
  while (n < m) n <<= 1;
  const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
  ar.set(x); br.set(h);
  fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < n; i++) { const r = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; }
  fft(ar, ai, true);
  return Float32Array.from(ar.subarray(0, m));
}

// Synthetic room: exponentially decaying noise, the highs dying faster (damp), a few early taps.
function impulse({ rt = 1.5, pre = 0.02, damp = 0.5, er = 0.3, seed = 7 }) {
  const rnd = mulberry32(seed), p0 = Math.round(pre * SR), n = p0 + Math.round(rt * 1.1 * SR);
  const noise = new Float32Array(n);
  for (let i = p0; i < n; i++) noise[i] = rnd() * 2 - 1;
  const lo = biquad(noise, 'lowpass', 2200), hi = biquad(noise, 'highpass', 2200);
  const ir = new Float32Array(n);
  for (let i = p0; i < n; i++) {
    const t = (i - p0) / SR, fade = Math.min(1, t / 0.008);
    ir[i] = fade * (lo[i] * Math.exp((-6.91 * t) / rt) + hi[i] * Math.exp((-6.91 * t) / (rt * damp)));
  }
  let e = 0;
  for (let i = 0; i < n; i++) e += ir[i] * ir[i];
  const g = 1 / Math.sqrt(e || 1);
  for (let i = 0; i < n; i++) ir[i] *= g;
  for (let k = 0; k < 6; k++) ir[p0 + Math.round((0.003 + rnd() * 0.03) * SR)] += (rnd() < 0.5 ? -1 : 1) * er * (1 - k / 8);
  return ir;
}

function follow(x, att, rel) {
  const a = Math.exp(-1 / (att * SR)), r = Math.exp(-1 / (rel * SR)), y = new Float32Array(x.length);
  let e = 0;
  for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); e = v > e ? a * e + (1 - a) * v : r * e + (1 - r) * v; y[i] = e; }
  return y;
}

function compress(x, { thr = -20, ratio = 3, att = 0.005, rel = 0.08, knee = 6 }) {
  const env = follow(x, att, rel), y = new Float32Array(x.length), k = 1 - 1 / ratio;
  for (let i = 0; i < x.length; i++) {
    const over = 20 * Math.log10(env[i] + 1e-9) - thr;
    const gr = over <= -knee / 2 ? 0 : over >= knee / 2 ? over * k : (k * (over + knee / 2) ** 2) / (2 * knee);
    y[i] = x[i] * Math.pow(10, -gr / 20);
  }
  return y;
}

// Brick-wall limiter with look-ahead (the gain reaches the ceiling at every peak).
function limit(x, ceil) {
  const n = x.length, la = Math.round(0.004 * SR), g = new Float32Array(n), h = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = Math.min(1, ceil / (Math.abs(x[i]) + 1e-12));
  for (let i = 0; i < n; i++) { let m = 1; for (let j = Math.max(0, i - la), e = Math.min(n - 1, i + la); j <= e; j++) if (g[j] < m) m = g[j]; h[i] = m; }
  const y = new Float32Array(n), r = Math.exp(-1 / (0.06 * SR)), w = la >> 1;
  let e = 1, acc = 0;
  for (let i = 0; i < Math.min(n, w); i++) acc += h[i];
  for (let i = 0; i < n; i++) {
    if (i + w < n) acc += h[i + w];
    if (i - w - 1 >= 0) acc -= h[i - w - 1];
    const cnt = Math.min(n - 1, i + w) - Math.max(0, i - w) + 1;
    const v = Math.min(acc / cnt, h[i]);
    e = v < e ? v : r * e + (1 - r) * v;
    y[i] = x[i] * e;
  }
  return y;
}

function peakOf(x) { let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; }
function scale(x, g) { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * g; return y; }
function mixInto(a, b, g, delay = 0) {
  const d = Math.round(delay * SR), y = new Float32Array(Math.max(a.length, b.length + d));
  y.set(a);
  for (let i = 0; i < b.length; i++) y[i + d] += b[i] * g;
  return y;
}

// RMS per frame of `hop` seconds
function frameRms(x, hop = 0.01) {
  const h = Math.round(hop * SR), n = Math.ceil(x.length / h), r = new Float32Array(n);
  for (let f = 0; f < n; f++) { let s = 0, c = 0; for (let i = f * h; i < Math.min(x.length, (f + 1) * h); i++) { s += x[i] * x[i]; c++; } r[f] = Math.sqrt(s / Math.max(1, c)); }
  return r;
}

// YIN pitch track (on a 12 kHz copy). Returns { f0: Float32Array (0 = unvoiced), hop: seconds }.
function pitchTrack(x, { fmin = 45, fmax = 520, hop = 0.005, thr = 0.15 } = {}) {
  const y = resample(x, 2), r = SR / 2;
  const W = Math.round(0.025 * r), tmin = Math.max(2, Math.floor(r / fmax)), tmax = Math.ceil(r / fmin), h = Math.round(hop * r);
  const nF = Math.max(0, Math.floor((y.length - W - tmax) / h));
  const f0 = new Float32Array(Math.ceil(x.length / (hop * SR)) + 1), rms = new Float32Array(nF);
  let maxR = 0;
  for (let f = 0; f < nF; f++) { let s = 0; const o = f * h; for (let j = 0; j < W; j++) s += y[o + j] * y[o + j]; rms[f] = Math.sqrt(s / W); maxR = Math.max(maxR, rms[f]); }
  const d = new Float64Array(tmax + 2);
  for (let f = 0; f < nF; f++) {
    if (rms[f] < maxR * 0.03) continue;
    const o = f * h;
    let run = 0, best = -1;
    for (let t = 1; t <= tmax + 1; t++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = y[o + j] - y[o + j + t]; s += v * v; }
      run += s;
      d[t] = run > 0 ? (s * t) / run : 1;
    }
    for (let t = tmin; t <= tmax; t++) {
      if (d[t] < thr) { while (t + 1 <= tmax && d[t + 1] < d[t]) t++; best = t; break; }
    }
    if (best < 0) continue;
    const a = d[best - 1], b = d[best], c = d[best + 1], den = a - 2 * b + c;
    const tt = best + (den > 0 ? (0.5 * (a - c)) / den : 0);
    // frame f covers y[o .. o+W): its centre in output-hop units
    const centre = (o + W / 2) / r, idx = Math.round(centre / hop);
    if (idx < f0.length) f0[idx] = r / tt;
  }
  // fill the one-hop gaps the centre offset leaves, median-smooth, drop short voiced islands
  const out = new Float32Array(f0.length);
  for (let i = 0; i < f0.length; i++) {
    const w = [];
    for (let j = Math.max(0, i - 2); j <= Math.min(f0.length - 1, i + 2); j++) if (f0[j] > 0) w.push(f0[j]);
    if (f0[i] > 0 || (w.length >= 3)) { w.sort((p, q) => p - q); out[i] = w[w.length >> 1]; }
  }
  for (let i = 0; i < out.length;) {
    if (!out[i]) { i++; continue; }
    let j = i;
    while (j < out.length && out[j]) j++;
    if (j - i < 4) out.fill(0, i, j);
    i = j;
  }
  return { f0: out, hop };
}

function median(a) { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[s.length >> 1]; }
function voicedF0(track) { return Array.from(track.f0).filter((v) => v > 0); }

// TD-PSOLA pitch shift by `beta` (formants and timing kept).
function psola(x, track, beta) {
  if (Math.abs(beta - 1) < 0.003) return x;
  const N = x.length, hopN = track.hop * SR, f0 = track.f0, UV = Math.round(0.005 * SR);
  const fAt = (p) => { const i = Math.round(p / hopN); return i >= 0 && i < f0.length ? f0[i] : 0; };
  const lp = biquad(biquad(x, 'lowpass', 900), 'lowpass', 900);
  // transients (plosive bursts, voicing onsets) are copied as they are: PSOLA drops or doubles
  // whole pitch periods, and a dropped one took the "b" of "beware" with it
  const H = Math.round(0.005 * SR), eF = frameRms(x, 0.005), trans = new Uint8Array(eF.length);
  for (let i = 2; i < eF.length; i++) {
    if (20 * Math.log10((eF[i] + 1e-7) / (eF[i - 2] + 1e-7)) > 8) for (let j = Math.max(0, i - 2); j <= Math.min(eF.length - 1, i + 3); j++) trans[j] = 1;
  }
  const pos = [], per = [], vo = [];
  let t = 0, prevV = false;
  while (t < N) {
    const f = trans[Math.floor(t / H)] ? 0 : fAt(t);
    if (f > 0) {
      const T = SR / f, a = prevV ? t - 0.2 * T : t, b = prevV ? t + 0.2 * T : t + T;
      let best = Math.round(t), bv = -Infinity;
      for (let k = Math.max(0, Math.floor(a)); k < Math.min(N, Math.ceil(b)); k++) if (lp[k] > bv) { bv = lp[k]; best = k; }
      if (pos.length && best <= pos.at(-1)) best = pos.at(-1) + Math.round(T);
      pos.push(best); per.push(T); vo.push(true);
      t = best + T; prevV = true;
    } else {
      pos.push(Math.round(t)); per.push(UV); vo.push(false);
      t += UV; prevV = false;
    }
  }
  const out = new Float32Array(N);
  let ts = pos[0] ?? 0, k = 0;
  while (ts < N && pos.length) {
    while (k + 1 < pos.length && Math.abs(pos[k + 1] - ts) < Math.abs(pos[k] - ts)) k++;
    const c = pos[k], T = per[k], L = Math.max(2, Math.round(T)), o = Math.round(ts);
    for (let j = -L; j <= L; j++) {
      const si = c + j, di = o + j;
      if (si >= 0 && si < N && di >= 0 && di < N) out[di] += x[si] * (0.5 + 0.5 * Math.cos((Math.PI * j) / L));
    }
    ts += vo[k] ? T / beta : T;
  }
  return out;
}

// The effects chain. Steps: ['hp'|'lp', f, q], ['peak', f, dB, q], ['lowshelf'|'highshelf', f, dB],
// ['comp', opts], ['sat', drive, mix], ['breath', dB, lo, hi] (noise riding the voice's envelope),
// ['octave', ratio, gain, delay] (a PSOLA copy layered in: 0.5 = an octave down, 1.012 = detuned),
// ['growl', hz, depth] (amplitude roughness from low-passed noise), ['comb', ms, feedback, mix],
// ['reverb', { rt, pre, damp, er, wet }].
function runFx(x, steps, rnd) {
  let y = x, track = null;
  const trackOfInput = () => (track ??= pitchTrack(x));
  for (const [op, ...a] of steps) {
    if (op === 'hp') y = biquad(y, 'highpass', a[0], a[1] ?? Math.SQRT1_2);
    else if (op === 'lp') y = biquad(y, 'lowpass', a[0], a[1] ?? Math.SQRT1_2);
    else if (op === 'peak') y = biquad(y, 'peak', a[0], a[2] ?? 1, a[1]);
    else if (op === 'lowshelf' || op === 'highshelf') y = biquad(y, op, a[0], Math.SQRT1_2, a[1]);
    else if (op === 'comp') y = compress(y, a[0]);
    else if (op === 'sat') {
      const [drive, mix] = a, p = peakOf(y) || 1, z = new Float32Array(y.length), td = Math.tanh(drive);
      for (let i = 0; i < y.length; i++) { const v = y[i] / p; z[i] = p * ((1 - mix) * v + (mix * Math.tanh(drive * v)) / td); }
      y = z;
    } else if (op === 'breath') {
      const [db, lo, hi] = a, env = follow(y, 0.015, 0.06), n = new Float32Array(y.length);
      for (let i = 0; i < n.length; i++) n[i] = (rnd() * 2 - 1) * env[i];
      const b = biquad(biquad(n, 'highpass', lo), 'lowpass', hi);
      y = mixInto(y, b, Math.pow(10, db / 20) * 3);
    } else if (op === 'octave') {
      const [ratio, gain, delay] = a;
      y = mixInto(y, psola(x, trackOfInput(), ratio), gain, delay); // a layer of the chain's input voice
    } else if (op === 'growl') {
      const [hz, depth] = a, n = new Float32Array(y.length);
      for (let i = 0; i < n.length; i++) n[i] = rnd() * 2 - 1;
      const m = biquad(biquad(n, 'lowpass', hz, 0.9), 'lowpass', hz, 0.9), p = peakOf(m) || 1, z = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) z[i] = y[i] * (1 + (depth * m[i]) / p);
      y = z;
    } else if (op === 'comb') {
      const [ms, fb, mix] = a, D = Math.round((ms / 1000) * SR), c = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) c[i] = y[i] + (i >= D ? fb * c[i - D] : 0);
      y = mixInto(scale(y, 1 - mix), c, mix * (1 - fb));
    } else if (op === 'reverb') {
      const o = a[0];
      y = mixInto(scale(y, 1 - o.wet), convolve(y, impulse(o)), o.wet);
    } else throw new Error(`unknown fx ${op}`);
  }
  return y;
}

// ---------------------------------------------------------------------------------------------
// Line rendering

function settingsOf(who) {
  const c = CHARACTERS[who];
  if (!c) throw new Error(`no voice settings for "${who}"`);
  if (!c.base) return { ...c };
  const b = CHARACTERS[c.base];
  return { ...b, ...c, fx: c.fx ?? b.fx, base: undefined };
}

const calib = {}; // who → { base: unshifted median F0, beta: the PSOLA ratio that lands it on target }
const rawCache = new Map();
async function synthCached(text, voice, speed) {
  const k = JSON.stringify([text, voice, speed]);
  if (!rawCache.has(k)) rawCache.set(k, await synth(text, voice, speed));
  return rawCache.get(k);
}

// The pitch shift is set so that the character's own lines land on its target (median of the
// per-line medians): measure them formant-shifted, shift by the estimate, measure again and
// correct once. Kept in build.json, so adding or editing a line later doesn't move everyone
// else's pitch; redone when the voice, speed, formant, target or model changes.
function calibKey(who) {
  const s = settingsOf(who);
  return `${who}:${hash({ v: s.voice, k: kspeed(s, 1), fm: s.formant || 1, f0: s.f0, MODEL, DTYPE, PHONES, LEXICON, c: 2 }).slice(0, 12)}`;
}
async function calibrate(who, cache, lines) {
  const s = settingsOf(who), fm = s.formant || 1, key = calibKey(who);
  if (cache[key]) return (calib[who] = cache[key]);
  const ys = [];
  for (const [k, l] of lines) ys.push(resample((await synthCached(l.text, s.voice, kspeed(s, LINE_TWEAKS[k]?.speed ?? 1))).wave, fm));
  const tracks = ys.map((y) => pitchTrack(y));
  const lineMed = (tr) => { const f = voicedF0(tr); return f.length > 10 ? median(f) : 0; };
  const m0 = median(tracks.map(lineMed).filter(Boolean));
  let beta = 1;
  if (s.f0 > 0 && m0 > 0) {
    beta = s.f0 / m0;
    const m1 = median(ys.map((y, i) => lineMed(pitchTrack(psola(y, tracks[i], beta)))).filter(Boolean));
    if (m1 > 0) beta *= s.f0 / m1;
  }
  return (calib[who] = cache[key] = { base: Math.round((m0 / fm) * 10) / 10, beta: Math.round(beta * 10000) / 10000 });
}
const kspeed = (s, tweak) => (s.speed * tweak) / (s.formant || 1);

async function render(key, line) {
  const s = settingsOf(line.who), tw = LINE_TWEAKS[key] ?? {};
  const fm = s.formant || 1;
  const raw = await synthCached(line.text, s.voice, kspeed(s, tw.speed ?? 1));
  // longer pauses at a mid-line ellipsis: cut at the quietest point of its token and add silence
  const ins = [];
  raw.tok.forEach((t, i) => {
    if (t.ch !== '…' || !raw.tok.slice(i + 1).some((u) => u.wi >= 0)) return;
    const e = frameRms(raw.wave.subarray(t.start, t.end), 0.005);
    let m = 0;
    for (let j = 1; j < e.length; j++) if (e[j] < e[m]) m = j;
    ins.push({ at: t.start + Math.round((m + 0.5) * 0.005 * SR), len: Math.round(PAUSE.ellipsis * SR) });
  });
  let x = raw.wave;
  if (ins.length) {
    const F = Math.round(0.008 * SR), xs = Float32Array.from(x), tot = ins.reduce((a, b) => a + b.len, 0);
    for (const p of ins) for (let j = 0; j < F; j++) {
      if (p.at - 1 - j >= 0) xs[p.at - 1 - j] *= j / F;
      if (p.at + j < xs.length) xs[p.at + j] *= j / F;
    }
    const y = new Float32Array(x.length + tot);
    let src = 0, dst = 0;
    for (const p of ins) { y.set(xs.subarray(src, p.at), dst); dst += p.at - src + p.len; src = p.at; }
    y.set(xs.subarray(src), dst);
    x = y;
  }
  const mapIns = (smp) => smp + ins.filter((p) => p.at <= smp).reduce((a, b) => a + b.len, 0);

  // pitch: formants by resampling, the rest by PSOLA
  let y = resample(x, fm);
  const beta = calib[line.who]?.beta ?? 1;
  if (beta !== 1) y = psola(y, pitchTrack(y), beta);
  const dryPeak = peakOf(y) || 1;
  const dry = scale(y, 0.5 / dryPeak);

  const rnd = mulberry32(parseInt(hash(key).slice(0, 8), 16));
  let wet = runFx(dry, s.fx ?? [], rnd);
  if (line.style === 'phone') wet = runFx(wet, PHONE_FX, rnd);

  // loudness: active-speech RMS to -19 dBFS, peaks limited to -1 dBFS, then the character's level
  const fr = frameRms(wet), mx = Math.max(...fr);
  const act = Array.from(fr).filter((v) => v > mx * 0.1);
  const rms = Math.sqrt(act.reduce((a, v) => a + v * v, 0) / Math.max(1, act.length));
  wet = limit(scale(wet, Math.pow(10, -19 / 20) / (rms || 1)), Math.pow(10, -1 / 20));
  if (s.level) wet = scale(wet, Math.pow(10, s.level / 20));

  // trim: from just before the first sound of the dry voice to the end of the tail
  const dfr = frameRms(dry), dmx = Math.max(...dfr), thr = dmx * Math.pow(10, -50 / 20);
  let a = dfr.findIndex((v) => v > thr), b = dfr.length - 1 - [...dfr].reverse().findIndex((v) => v > thr);
  if (a < 0) { a = 0; b = dfr.length - 1; }
  const start = Math.max(0, Math.round((a - 3) * 0.01 * SR));
  const wfr = frameRms(wet), wmx = Math.max(...wfr);
  let wend = wfr.length - 1;
  while (wend > b && wfr[wend] < wmx * Math.pow(10, -48 / 20)) wend--;
  const end = Math.min(wet.length, Math.round(Math.min(wend + 1, b + 6 + (s.tail ?? 0.06) * 100) * 0.01 * SR));
  const lead = raw.lead ? Math.round(PAUSE.lead * SR) : 0;
  const pcm = new Float32Array(lead + end - start);
  pcm.set(wet.subarray(start, end), lead);
  // fade in 4 ms; fade out 30 ms, or the last half of a reverb tail (never into the speech)
  const endSmp = Math.min(pcm.length, Math.round((b + 1) * 0.01 * SR) - start + lead);
  const fin = Math.round(0.004 * SR);
  const fout = Math.max(Math.round(0.03 * SR), Math.min(Math.round((s.tail ?? 0) * 0.5 * SR), pcm.length - endSmp));
  for (let i = 0; i < fin; i++) pcm[lead + i] *= i / fin;
  for (let i = 0; i < Math.min(fout, pcm.length); i++) pcm[pcm.length - 1 - i] *= (i / fout) ** 1.5;
  const speechEnd = Math.round((endSmp / SR) * 1000) / 1000;

  // word start times
  const toFinal = (smp) => (mapIns(smp) / fm - start + lead) / SR;
  const words = raw.words.map((w, wi) => {
    const t = raw.tok.find((u) => u.wi === wi);
    return [w.ci, t ? toFinal(t.start) : null];
  });
  for (let i = 0; i < words.length; i++) if (words[i][1] === null) words[i][1] = i ? words[i - 1][1] : 0;
  let prev = 0;
  for (const w of words) { w[1] = Math.round(Math.max(prev, Math.max(0, w[1])) * 1000) / 1000; prev = w[1]; }

  // mouth openness, 60 fps, from the dry voice's speech band
  const band = follow(biquad(biquad(biquad(dry, 'highpass', 200), 'lowpass', 4000), 'lowpass', 4000), 0.03, 0.08);
  const nM = Math.ceil((pcm.length / SR) * FPS), env = new Float32Array(nM);
  for (let f = 0; f < nM; f++) {
    const smp = start + Math.round(((f + 0.5) / FPS + 0.025) * SR) - lead; // 25 ms ahead: mouths lead the sound
    env[f] = smp >= 0 && smp < band.length ? band[smp] : 0;
  }
  const emx = Math.max(...env) || 1;
  const loud = Array.from(env).filter((v) => v > emx * 0.15).sort((p, q) => p - q);
  const p95 = loud[Math.floor(loud.length * 0.95)] || emx, floor = p95 * 0.08;
  const mouth = Uint8Array.from(env, (v) => Math.max(0, Math.min(255, Math.round(((v - floor) / (p95 - floor)) * 220))));

  return {
    pcm, words, mouth, speechEnd, ps: raw.ps, notes: raw.notes,
    f0dry: Math.round(median(voicedF0(pitchTrack(dry))) * 10) / 10,
    f0wet: Math.round(median(voicedF0(pitchTrack(pcm))) * 10) / 10,
    f0raw: Math.round(median(voicedF0(pitchTrack(raw.wave))) * 10) / 10,
    beta: Math.round(beta * 1000) / 1000,
  };
}

function encode(pcm, file) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
      '-c:a', 'libmp3lame', '-b:a', BITRATE, '-ar', String(SR), '-ac', '1', file]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg: ${err}`))));
    p.stdin.end(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  });
}

function hash(v) { return crypto.createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }

// ---------------------------------------------------------------------------------------------

async function survey() {
  await loadModel();
  const names = Object.keys(tts.voices);
  console.log('voice         median F0   p10    p90   (Hz, voiced frames of the calibration sentences at speed 1)');
  for (const v of names) {
    const f = [];
    for (const text of CALIBRATION) f.push(...voicedF0(pitchTrack((await synth(text, v, 1)).wave)));
    f.sort((a, b) => a - b);
    const q = (p) => f[Math.floor(f.length * p)]?.toFixed(0);
    console.log(`${v.padEnd(13)} ${median(f).toFixed(1).padStart(8)}  ${q(0.1).padStart(5)}  ${q(0.9).padStart(5)}   ${tts.voices[v].gender} ${tts.voices[v].overallGrade}`);
  }
}

async function main() {
  if (process.env.SURVEY) return survey();
  const t0 = performance.now();
  const { LINES } = await import(pathToFileURL(LINES_FILE).href + `?t=${Date.now()}`);
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((s) => s.trim())) : null;
  const whoF = process.env.WHO ? new Set(process.env.WHO.split(',').map((s) => s.trim())) : null;
  const filtered = !!(only || whoF);
  const all = Object.entries(LINES).filter(([, l]) => !l.alien);
  for (const [k, l] of all) if (!CHARACTERS[l.who]) throw new Error(`line ${k}: no voice for who "${l.who}"`);
  const todo = all.filter(([k, l]) => (!only || only.has(k)) && (!whoF || whoF.has(l.who)));

  fs.mkdirSync(OUT, { recursive: true });
  const manFile = path.join(OUT, 'manifest.json'), buildFile = path.join(OUT, 'build.json');
  const old = readJson(manFile, { version: 1, lines: {} });
  const build = readJson(buildFile, { calib: {}, lines: {} });
  const lines = {}, stats = {};
  const pending = [];
  let rendered = 0, kept = 0;
  const failed = [];

  for (const [key, line] of all) {
    const inScope = todo.some(([k]) => k === key);
    const s = settingsOf(line.who);
    const h = hash({ VERSION, MODEL, DTYPE, PHONES, who: line.who, text: line.text, style: line.style ?? null, s, tw: LINE_TWEAKS[key] ?? null,
      PAUSE, PHONE: line.style === 'phone' ? PHONE_FX : null, LEXICON, RESPELL }).slice(0, 16);
    const file = path.join(OUT, `${key}.mp3`);
    const prev = old.lines[key], prevB = build.lines[key];
    const fresh = prev && prevB?.hash === h && fs.existsSync(file) && prev.text === line.text && prev.who === line.who;
    if (!inScope || (fresh && !process.env.FORCE)) {
      if (prev && prev.text === line.text && prev.who === line.who) { lines[key] = prev; kept += inScope ? 1 : 0; }
      else if (prev) console.warn(`! ${key}: out of date and not rendered (run without filters)`);
      continue;
    }
    try {
      if (calib[line.who] === undefined) {
        const c = await calibrate(line.who, build.calib, all.filter(([, l]) => l.who === line.who));
        console.log(`calibrated ${line.who}: ${JSON.stringify(s.voice)} at Kokoro speed ${kspeed(s, 1).toFixed(2)}: unshifted ${c.base} Hz, formant ${s.formant || 1}, PSOLA ${c.beta}`);
      }
      const t1 = performance.now();
      const r = await render(key, line);
      pending.push(encode(r.pcm, file));
      if (pending.length >= 4) await Promise.all(pending.splice(0));
      const dur = Math.round((r.pcm.length / SR) * 1000) / 1000;
      lines[key] = { who: line.who, text: line.text, file: `voices/${key}.mp3`, dur, end: r.speechEnd, words: r.words, mouth: Buffer.from(r.mouth).toString('base64') };
      build.lines[key] = { hash: h, ps: r.ps, f0raw: r.f0raw, f0dry: r.f0dry, f0wet: r.f0wet, beta: r.beta, notes: r.notes.length ? r.notes : undefined };
      rendered++;
      console.log(`${key.padEnd(14)} ${line.who.padEnd(9)} ${dur.toFixed(2).padStart(6)} s  F0 ${String(r.f0dry).padStart(5)} Hz  (${((performance.now() - t1) / 1000).toFixed(1)} s)${r.notes.length ? '  ' + r.notes.join('; ') : ''}`);
    } catch (e) {
      failed.push(key);
      console.error(`x ${key}: ${e.stack || e}`);
      if (old.lines[key]) lines[key] = old.lines[key];
    }
  }
  await Promise.all(pending);

  // keep the manifest in lines.js order; drop lines that no longer exist
  const ordered = {};
  for (const [k] of all) if (lines[k]) ordered[k] = lines[k];
  if (!filtered) {
    for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !ordered[f.slice(0, -4)]) { fs.unlinkSync(path.join(OUT, f)); console.log(`removed stale ${f}`); }
    for (const k of Object.keys(build.lines)) if (!ordered[k]) delete build.lines[k];
    const live = new Set(Object.keys(CHARACTERS).map(calibKey));
    for (const k of Object.keys(build.calib)) if (!live.has(k)) delete build.calib[k];
  }
  fs.writeFileSync(manFile, JSON.stringify({ version: 1, lines: ordered }));
  build.characters = Object.fromEntries(Object.keys(CHARACTERS).map((w) => {
    const c = settingsOf(w);
    return [w, { desc: c.desc, voice: c.voice, speed: c.speed, f0: c.f0 || null, formant: c.formant || 1, psola: calib[w]?.beta ?? build.characters?.[w]?.psola ?? null,
      fx: (c.fx ?? []).map((st) => st[0]).join(' → ') }];
  }));
  fs.writeFileSync(buildFile, JSON.stringify(build, null, 1));

  // report
  for (const [k, l] of Object.entries(ordered)) {
    const b = build.lines[k];
    (stats[l.who] ??= { n: 0, dur: 0, dry: [], wet: [] }).n++;
    stats[l.who].dur += l.dur;
    if (b?.f0dry) stats[l.who].dry.push(b.f0dry);
    if (b?.f0wet) stats[l.who].wet.push(b.f0wet);
  }
  console.log('\nwho        lines   audio   target  final F0 (voice / full mix, median of line medians)');
  for (const [who, st] of Object.entries(stats)) {
    const s = settingsOf(who);
    console.log(`${who.padEnd(10)} ${String(st.n).padStart(5)} ${st.dur.toFixed(1).padStart(7)} s ${String(s.f0 || '-').padStart(6)}  ${median(st.dry).toFixed(1).padStart(6)} / ${median(st.wet).toFixed(1)}`);
  }
  let bytes = 0;
  for (const f of fs.readdirSync(OUT)) bytes += fs.statSync(path.join(OUT, f)).size;
  console.log(`\n${rendered} rendered, ${Object.keys(ordered).length} in the manifest, ${(bytes / 1e6).toFixed(2)} MB in public/voices, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  if (failed.length) { console.error(`failed: ${failed.join(', ')}`); process.exitCode = 1; }
}

export { LEXICON, phonemize, synth, pitchTrack, psola, resample, runFx, render, median, voicedF0, CHARACTERS, CALIBRATION, loadModel, settingsOf, calibrate, calib };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
