// What Hal has on him in free roam (the user, 2026-11-24: "if I get a roll at the Chinese food shop I should be able to
// keep it in my inventory; duct tape from the hardware shop, same"). What he buys is added (story/Shopping.js: off a
// shelf, or over a counter) and kept with free roam's life (engine/Save.js LifeSave, `inventory`) till it's used up;
// the same things stack. The screen (ui/Inventory.js, I) shows it and adds his own (phone, ring, keys, wallet). The
// model, on the story as `story.inventory`:
//   .list()                 [{ id, key, name, sub, kind, prop, food, count, pocket, price, from }]
//                           kind: 'food', 'drink', 'medicine' (they heal: `food`), 'grocery' (for the kitchen),
//                           'tool' (parts, hardware, cleaning), 'thing'; prop: its props/Props.js model (city/Stock.js
//                           PRODUCTS), for a thumbnail; pocket: false (all of it carried)
//   .add({ key, name?, kind?, heal?, price?, from? }, n = 1)   in (a product's `key` fills in the rest); the stack
//   .remove(idOrItem, n = 1), .has(key), .count(key), .get(id)
//   .use(idOrItem)          eat it, drink it, take it: in his hands where the shop's models are (story/Shopping.js),
//                           the health, the bark; a tool he turns over (a bark). { ok, line, item }
//   .hold(idOrItem)         out of his pockets into his hand (Hal's block: Shopping), one of the stack
//   .drop(idOrItem)         left where he stands (a body of its own there, in Hal's block), one of the stack
//   .onChange(fn)           fn(list) after each change; returns the unsubscribe
import { LifeSave } from '../engine/Save.js';
import { PRODUCTS } from '../city/Stock.js';
import { money } from './Life.js';

const MAX = 40; // (stacks: the save's cookie mirror holds a few kilobytes)
// where things came from, for the line under each (the rooms of city/Shops.js and city/Interiors.js)
const FROM = { market: 'Coast Liquor', grocer: 'Ocean Market', pharmacy: 'the pharmacy', autoparts: 'the parts store', hardware: 'Pacific Hardware', bakery: 'La Estrella', donuts: 'Sunny’s', cafe: 'Café Marisol', bar: 'the Blue Marlin', takeout: 'Lucky Dragon', taqueria: 'Mendoza’s', pho: 'Phở Saigon', laundromat: 'the laundromat', barber: 'Ortega’s', salon: 'Belle’s', florist: 'Flores Elena', records: 'Rialto Records', books: 'Pacific Books', tv: 'Starlight TV', thrift: 'Second Chance Thrift', cinema: 'the Palms', pizza: 'Tony’s' };
const TOOL = /motoroil|lube|spraypaint|ducttape|pliers|screwdriver|tapemeasure|cleaner|bleach|multiclean|drain|medtape/;

export class Inventory {
  constructor(story) {
    this.story = story;
    // (a stack a thing; an older save's one-a-piece items folded into stacks)
    this.stacks = [];
    for (const it of LifeSave.load().inventory ?? []) if (it?.key && it.name) this.put(it, it.count ?? 1, false);
    this.listeners = new Set();
  }

  list() { return this.stacks.map((s) => this.view(s)); }
  get(id) { const s = this.stacks.find((x) => x.id === id || x.key === id); return s ? this.view(s) : null; }
  has(key) { return this.stacks.some((s) => s.key === key && s.count > 0); }
  count(key) { return this.stacks.find((s) => s.key === key)?.count ?? 0; }
  get full() { return this.stacks.length >= MAX; }

  // what the screen shows of a stack
  view(s) {
    const P = PRODUCTS[s.key], kind = s.kind, food = kind === 'food' || kind === 'drink' || kind === 'medicine' ? s.heal ?? 0 : 0;
    const what = kind === 'food' ? `Eat it${food ? `: +${food} health` : ''}` : kind === 'drink' ? `Drink it${food ? `: +${food} health` : ''}` : kind === 'medicine' ? `Take it: +${food} health`
      : kind === 'grocery' ? 'For the kitchen' : kind === 'tool' ? 'Might come in handy' : 'His';
    const sub = [what, s.from ? `from ${FROM[s.from] ?? s.from}` : null, s.price ? money(s.price) : null].filter(Boolean).join(' · ');
    return { id: s.id, key: s.key, name: s.name, sub, kind, prop: P?.prop ?? null, food, count: s.count, pocket: false, price: s.price, from: s.from };
  }

  // an item in: a product's key fills in the rest from city/Stock.js
  add(item, n = 1) { const s = this.put(item, n); if (s) this.changed(); return s ? this.view(s) : null; }
  put(item, n = 1, check = true) {
    const P = PRODUCTS[item.key] ?? {};
    let s = this.stacks.find((x) => x.key === item.key);
    if (!s) {
      if (check && this.full) return null;
      const kind = P.pill ? 'medicine' : TOOL.test(item.key) ? 'tool' : item.kind && item.kind !== 'thing' ? item.kind : P.kind && P.kind !== 'thing' ? P.kind : 'thing';
      s = { id: item.key, key: item.key, name: item.name ?? cap(P.short ?? P.name ?? 'something'), kind, price: item.price ?? P.price ?? 0, heal: item.heal ?? P.heal ?? 0, from: item.from ?? null, count: 0 };
      this.stacks.push(s);
    }
    s.count += n;
    if (item.from) s.from = item.from;
    return s;
  }
  remove(x, n = 1) {
    const id = typeof x === 'string' ? x : x?.id, s = this.stacks.find((y) => y.id === id || y.key === id);
    if (!s) return false;
    s.count -= n;
    if (s.count <= 0) this.stacks.splice(this.stacks.indexOf(s), 1);
    this.changed();
    return true;
  }
  stackOf(x) { const id = typeof x === 'string' ? x : x?.id; return this.stacks.find((y) => y.id === id || y.key === id) ?? null; }

  // Use it: food, drink and medicine heal him (eaten in his hands where there's a shop's model of it); groceries and
  // tools he only turns over
  async use(x) {
    const s = this.stackOf(x), st = this.story;
    if (!s) return { ok: false, item: null };
    // (the motor oil goes in the '71: the car's grade, story/Life.js)
    if (s.key === 'motoroil' && st.life) { this.remove(s, 1); st.life.oiled(); st.bark?.('halOil'); return { ok: true, item: this.view(s) }; }
    if (s.kind === 'grocery' || s.kind === 'tool' || s.kind === 'thing') { const line = thingLine(s); st.bark?.(line); return { ok: false, line, item: this.view(s) }; }
    this.remove(s, 1);
    if ((s.heal ?? 0) >= 8 || s.kind === 'food') st.life?.fed?.(); // (a meal: the Self grade, story/Life.js)
    if (st.shopping?.consume) await st.shopping.consume({ key: s.key, kind: s.kind === 'medicine' ? 'drink' : s.kind, heal: s.heal, name: s.name });
    else { if (st.powers) st.powers.health = Math.min(st.powers.maxHealth, st.powers.health + (s.heal ?? 0)); st.bark?.(s.kind === 'drink' ? 'halSoda' : 'halEat1'); }
    return { ok: true, item: this.view(s) };
  }
  // in his hand (story/Shopping.js holds it, paid for: let go of, it's back in his pocket)
  hold(x) {
    const s = this.stackOf(x), sh = this.story.shopping;
    if (!s || !sh?.holdItem?.(s)) return false;
    this.remove(s, 1);
    return true;
  }
  // left where he stands
  drop(x) {
    const s = this.stackOf(x);
    if (!s) return false;
    this.story.shopping?.dropItem?.(s);
    this.remove(s, 1);
    return true;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() {
    this.save();
    const list = this.list();
    for (const fn of this.listeners) fn(list);
  }
  save() { LifeSave.update((d) => { d.inventory = this.stacks.map(({ id, key, name, kind, price, heal, from, count }) => ({ id, key, name, kind, price, heal, from, count })); }); }
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// what he says, turning over something that isn't for eating (lines.js)
function thingLine(s) {
  if (s.kind === 'grocery') return 'halGroceries';
  if (/tape/.test(s.key)) return 'halTape';
  if (/oil|lube/.test(s.key)) return 'halOil';
  if (/wine|whiskey|gin|rum|port/.test(s.key)) return 'halBottle';
  if (/cigarettes/.test(s.key)) return 'halCigs';
  return 'halKeepIt';
}
