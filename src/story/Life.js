// Hal's life in free roam (the open world the user agreed, 2026-11-18): his money, tight (Ferris pays
// him by the shift, the rent goes out each week, coffee and food cost, rescues don't pay); his XP,
// mostly from the story's chapters and some from what he does in the city, a point to spend on the
// ring's six stats with every level; and what Coast City thinks of Green Lantern (public opinion,
// instead of a wanted level). Kept in the open world's own store (engine/Save.js LifeSave) beside the
// clock; the HUD's panel under the clock shows it.
import { LifeSave, PARTS } from '../engine/Save.js';

// the ring's stats: what a point does (powers.mods, the player, the ring's health), at most ten each
export const STATS = {
  efficiency: { name: 'Efficiency', what: 'Every construct costs 4% less charge' },
  power: { name: 'Power', what: 'Constructs hit 6% harder' },
  willpower: { name: 'Willpower', what: 'Flight drains 6% less, and the ring tops itself up a little' },
  endurance: { name: 'Endurance', what: '+12 health, and he heals faster' },
  flight: { name: 'Flight', what: 'He flies 5% faster' },
  focus: { name: 'Focus', what: 'A longer window to parry, a wider aim assist' },
};
export const MAX_STAT = 10;
// XP to go from level n to n + 1: 100, 150, 200...
const STEP = (n) => 100 + 50 * (n - 1);
export const levelOf = (xp) => { let n = 1, need = STEP(1); while (xp >= need) { xp -= need; n++; need = STEP(n); } return { level: n, into: xp, need }; };
const CHAPTER_XP = 60; // each of the story's chapters played (the user: XP mostly from the main missions)
const FREE = new Set(['free', 'range', 'earth', 'world']); // (free roam's checkpoints aren't chapters)

export const RENT = 75, RENT_EVERY = 7, SHIFT_PAY = 120;
export const money = (v) => `$${v.toFixed(2)}`;

export class Life {
  constructor(story) {
    this.story = story;
    const d = LifeSave.load();
    // the first time: his wallet as the story left it, and the XP of every chapter he's played
    if (d.money == null) {
      Object.assign(d, { money: 38.5, tab: 0, rentDue: (d.day ?? 1) + RENT_EVERY, xp: 0, points: 0, stats: Object.fromEntries(Object.keys(STATS).map((k) => [k, 0])), opinion: 35, worked: 0 });
      const chapters = Object.values(PARTS).reduce((n, p) => n + p.load().reached.filter((id) => !FREE.has(id)).length, 0);
      d.xp = chapters * CHAPTER_XP;
      d.points = levelOf(d.xp).level - 1;
      LifeSave.write(d);
    }
    this.d = d;
  }

  get level() { return levelOf(this.d.xp).level; }
  save() { LifeSave.update((s) => { for (const k of ['money', 'tab', 'rentDue', 'xp', 'points', 'stats', 'opinion', 'worked', 'lateNoted', 'ledger', 'events']) s[k] = this.d[k]; }); }

  // ---------------------------------------------------------------- money
  // (each in and out kept for the phone's bank, the last forty)
  record(amount, why) {
    const dc = this.story.dayCycle;
    (this.d.ledger ??= []).unshift({ day: dc?.day ?? 1, hour: dc?.hour ?? 0, amount, why });
    this.d.ledger.length = Math.min(this.d.ledger.length, 40);
  }
  // what happened in town, for the phone's paper (the emergencies and what came of them)
  note(text, good = true) {
    const dc = this.story.dayCycle;
    (this.d.events ??= []).unshift({ day: dc?.day ?? 1, hour: dc?.hour ?? 0, text, good });
    this.d.events.length = Math.min(this.d.events.length, 12);
    this.save();
  }
  pay(amount, why) {
    this.record(amount, why);
    this.d.money += amount;
    this.save();
    this.story.ui.toast(`+${money(amount)} · ${why}`);
    this.hud();
  }
  // false (and nothing spent) if he hasn't got it
  spend(amount, why) {
    if (this.d.money + 1e-6 < amount) return false;
    this.record(-amount, why ?? 'cash');
    this.d.money -= amount;
    this.save();
    if (why) this.story.ui.toast(`−${money(amount)} · ${why}`);
    this.hud();
    return true;
  }
  // the rent: due every week; late, it's noted (and Sal won't wait for ever)
  rentState(day) {
    const late = day - this.d.rentDue;
    return { due: this.d.rentDue, late: Math.max(0, late), owed: RENT + Math.max(0, late) * 5, soon: late >= -1 };
  }
  payRent(day) {
    const st = this.rentState(day);
    if (!this.spend(st.owed, 'the rent, to Sal')) return false;
    this.d.rentDue += RENT_EVERY * Math.max(1, Math.ceil((day - this.d.rentDue + 1) / RENT_EVERY));
    this.d.lateNoted = 0;
    this.save();
    return true;
  }

  // ---------------------------------------------------------------- XP and the stats
  gain(xp, why) {
    const before = this.level;
    this.d.xp += xp;
    const after = this.level;
    if (after > before) this.d.points += after - before;
    this.save();
    this.story.ui.toast(after > before ? `LEVEL ${after} · ${after - before > 1 ? `${after - before} points` : 'a point'} for the ring (K)` : `+${xp} XP · ${why}`);
    if (after > before) this.story.audio?.ringChime?.();
    this.hud();
  }
  raise(stat) {
    if (this.d.points < 1 || this.d.stats[stat] >= MAX_STAT) return false;
    this.d.points--;
    this.d.stats[stat]++;
    this.save();
    this.apply();
    this.hud();
    return true;
  }
  // the stats into the ring and the player
  apply() {
    const s = this.d.stats, { powers, player } = this.story;
    Object.assign(powers.mods, { cost: 1 - 0.04 * s.efficiency, damage: 1 + 0.06 * s.power, drain: 1 - 0.06 * s.willpower, parry: 0.03 * s.focus, aim: 1 + 0.08 * s.focus });
    const was = powers.maxHealth;
    powers.maxHealth = 100 + 12 * s.endurance;
    powers.health = Math.min(powers.maxHealth, powers.health + Math.max(0, powers.maxHealth - was));
    powers.healBoost = 1 + 0.08 * s.endurance;
    powers.trickle = 0.01 * s.willpower; // (charge a second, out of a fight)
    player.flyScale = 1 + 0.05 * s.flight;
  }

  // ---------------------------------------------------------------- what the city thinks
  // the city's opinion moved; small moves add up before they're shown (a toast each two points or so)
  opine(delta, why) {
    const o = this.d.opinion, n = Math.max(-100, Math.min(100, o + delta));
    this.d.opinion = n;
    this.moved = (this.moved ?? 0) + (n - o);
    if (why && Math.abs(this.moved) >= 2) { this.story.ui.toast(`Public opinion ${this.moved > 0 ? '▲' : '▼'} · ${why}`); this.moved = 0; }
    if (Math.round(n) !== Math.round(o)) { this.save(); this.hud(); }
  }
  get opinion() { return this.d.opinion; }
  // how the city sees Green Lantern, in a word
  get mood() { const o = this.d.opinion; return o > 60 ? 'Beloved' : o > 25 ? 'Trusted' : o > -10 ? 'Unsure' : o > -45 ? 'Wary' : o > -75 ? 'Feared' : 'Hunted'; }

  // the panel under the clock: his money, his level, and as Green Lantern what the city thinks
  hud() {
    const { level, into, need } = levelOf(this.d.xp);
    this.story.ui.life?.({ money: money(this.d.money), level, xp: into / need, points: this.d.points, opinion: this.story.civilian ? null : Math.round(this.d.opinion), mood: this.mood, tab: this.d.tab });
  }
}
