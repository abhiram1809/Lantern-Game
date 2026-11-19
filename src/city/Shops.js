// The rest of the block's shops to walk into (the open world the user agreed: "shops and a diner",
// interiors and their staff): each fitted out for its trade from the same kit as Rosie's and Coast
// Liquor (city/Interiors.js), a counter on the far side from the door with someone behind it, what
// there is to buy or do there (`ctx.spots` kind 'buy': story/Roam.js `shopBuy`), its sign over the
// back wall, the room's light one shared lamp that goes to whichever shop the camera's in (three.js
// lights every surface with every point light: eighteen more would have cost every frame).
import * as THREE from 'three';
import { box } from './Building.js';
import { kit, shell, gondola, shelfRow, FLOOR } from './Interiors.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POSTER = [0xd0603a, 0x3a7ab0, 0xe8c050, 0x5a9a6a, 0xa04a7a, 0x2a4a6a];
const span = (a, b) => [Math.min(a, b), Math.max(a, b)];
// a seeded random per room (the block's own sequence is the street's: drawing on it here would move
// Hal's block's parked cars)
const seeded = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// props from the block's own set, against the far side wall (facing into the room) or on the counter
const wallSpot = (R, along) => [R.doorLeft ? R.x1 - 0.5 : R.x0 + 0.5, R.cz + along, R.doorLeft ? -Math.PI / 2 : Math.PI / 2];
const byWall = (name, along = 1.3) => (ctx, R) => { const [x, z, yaw] = wallSpot(R, along); R.K.put(name, x, FLOOR, z, yaw); }; // (Smash gives it its own body: a box of ours as well would overlap it)
const both = (...fns) => (ctx, R) => fns.forEach((f) => f(ctx, R));
const onCounter = (name, at = 0.75) => (ctx, R) => R.K.put(name, R.cb - at, FLOOR + 1.0, R.cz - 0.3, Math.PI);
const plant = (along) => (ctx, R) => { const [x, z] = wallSpot(R, along); R.K.put('planter', x, FLOOR, z, 0, 'plant'); };

// each trade: its floor and walls, who works there (a Rocketbox person, their voice, what they say),
// what it sells (name, price, what it does: food heals, the clinic heals all, the laundromat and the
// barber take time), its sign, and how it's fitted out
export const SHOPS = {
  laundromat: { floor: 'checker', fc: 0xd9dee2, wall: 0xdcecee, staff: { id: 'female-adult-07', voice: 'townf3', label: 'The attendant', lines: ['shopLaund1', 'shopLaund2'] }, sell: [['Wash and dry a load', 1.5, 'wash']], board: ['WASH 75¢ · DRY 75¢', 'Attendant on duty · No dyeing'], fit: laundromat, extra: byWall('vending', 2.0) },
  barber: { floor: 'checker', fc: 0xffffff, wall: 0xe8efe6, dado: 0x2f5a3a, staff: { id: 'male-adult-20', voice: 'townm2', label: 'Ortega', lines: ['shopBarb1', 'shopBarb2'] }, sell: [['A haircut', 5, 'haircut'], ['A shave', 3, 'shave']], board: ['CUTS $5 · SHAVES $3', 'Walk-ins welcome'], fit: barber },
  takeout: { floor: 'patio', fc: 0xc9b8a2, wall: 0xf1e2c8, dado: 0x9a2a1e, staff: { id: 'male-adult-11', voice: 'townm1', label: 'Mr. Chen', lines: ['shopTake1', 'shopTake2'] }, sell: [['Chow mein', 2.95, 'food:25'], ['Egg rolls', 1.25, 'food:10']], board: ['CHOW MEIN · FRIED RICE · EGG ROLLS', 'Lucky Dragon · To go'], fit: eatery, extra: byWall('cooler') },
  pawn: { floor: 'concrete', fc: 0x9a958c, wall: 0xd8d2c2, staff: { id: 'male-adult-17', voice: 'townm3', label: 'The pawnbroker', lines: ['shopPawn1', 'shopPawn2'] }, sell: [], board: ['WE BUY GOLD · LOANS', 'Guitars · Tools · Jewelry · TVs'], fit: pawn },
  taqueria: { floor: 'patio', fc: 0xc49a74, wall: 0xf3d88a, dado: 0x2a7a5a, staff: { id: 'male-adult-13', voice: 'townm1', label: 'Mendoza', lines: ['shopTaco1', 'shopTaco2'] }, sell: [['Two tacos al pastor', 1.8, 'food:20'], ['A burrito', 2.75, 'food:30'], ['Horchata', 0.9, 'food:5']], board: ['TACOS · BURRITOS · TORTAS', 'Horchata · Jamaica · Agua fresca'], fit: eatery, extra: byWall('cooler') },
  bank: { floor: 'facadeTiles', fc: 0xd8d0c0, wall: 0xe8e2d6, dado: 0x6a4a32, staff: { id: 'business-female-03', voice: 'townf1', label: 'The teller', lines: ['shopBank1', 'shopBank2'] }, sell: [['Check your balance', 0, 'balance']], board: ['COAST CITY SAVINGS & LOAN', 'Since 1931 · Member FDIC'], fit: bank, ownCounter: true, extra: both(byWall('atm', 2.6), plant(1.2)) },
  pharmacy: { floor: 'checker', fc: 0xeef0f0, wall: 0xf2f4f2, staff: { id: 'female-adult-17', voice: 'townf2', label: 'The pharmacist', lines: ['shopPharm1', 'shopPharm2'] }, sell: [['Aspirin', 1.89, 'food:40'], ['Chewing gum', 0.25, 'food:0']], board: ['PRESCRIPTIONS', 'Pharmacist on duty'], fit: aisles, extra: byWall('magrack', 1.6) },
  autoparts: { floor: 'concrete', fc: 0x8e8a84, wall: 0xe0e2e4, staff: { id: 'male-adult-01', voice: 'townm2', label: 'The counterman', lines: ['shopAuto1', 'shopAuto2'] }, sell: [['A quart of motor oil', 1.29, 'oil']], board: ['PARTS · BATTERIES · BRAKES', 'Ask about our warranty'], fit: aisles },
  donuts: { floor: 'checker', fc: 0xf6e8ee, wall: 0xf8dce6, dado: 0xd0587a, staff: { id: 'female-party-02', voice: 'townf3', label: 'Sunny', lines: ['shopDonut1', 'shopDonut2'] }, sell: [['A glazed donut', 0.45, 'food:8'], ['A coffee', 0.5, 'food:4']], board: ['DONUTS · CRULLERS · COFFEE', 'Open 24 hours'], fit: eatery, extra: both(byWall('cooler'), onCounter('espresso', 0.6)), cases: true },
  records: { floor: 'checker', fc: 0x3a3a3c, wall: 0x2e3440, staff: { id: 'male-adult-06', voice: 'townm3', label: 'The record clerk', lines: ['shopRec1', 'shopRec2'] }, sell: [['An LP', 6.99, 'record'], ['A cassette', 4.49, 'record']], board: ['RIALTO RECORDS', 'New · Used · Imports'], fit: records },
  checks: { floor: 'concrete', fc: 0xa8a49c, wall: 0xe2e6e0, staff: { id: 'male-adult-08', voice: 'townm1', label: 'The clerk', lines: ['shopCheck1', 'shopCheck2'] }, sell: [], board: ['CHECKS CASHED · MONEY ORDERS', 'No ID, no cash'], fit: bank },
  florist: { floor: 'patio', fc: 0xb8a48c, wall: 0xf1efe4, dado: 0x4a6a3a, staff: { id: 'female-adult-08', voice: 'townf1', label: 'Elena', lines: ['shopFlor1', 'shopFlor2'] }, sell: [['A dozen roses', 4.5, 'flowers'], ['A carnation', 0.5, 'flowers']], board: ['FLORES ELENA', 'Weddings · Funerals · Just because'], fit: florist, extra: byWall('cooler', 1.6) },
  cafe: { floor: 'facadeTiles', fc: 0xc8b49a, wall: 0xf0e2cc, dado: 0x6a3a2a, staff: { id: 'female-adult-15', voice: 'townf2', label: 'The waitress', lines: ['shopCafe1', 'shopCafe2'] }, sell: [['An espresso', 1, 'food:6'], ['A croissant', 1.25, 'food:10']], board: ['CAFÉ MARISOL', 'Espresso · Pastries · Breakfast'], fit: eatery, extra: both(onCounter('espresso', 0.6), plant(1.4)) },
  bakery: { floor: 'patio', fc: 0xd2b48c, wall: 0xf5e6c8, dado: 0xa0522d, staff: { id: 'female-adult-05', voice: 'townf3', label: 'The baker', lines: ['shopBake1', 'shopBake2'] }, sell: [['Pan dulce', 0.6, 'food:8'], ['A bolillo', 0.25, 'food:5']], board: ['PANADERÍA LA ESTRELLA', 'Pan dulce · Bolillos · Pasteles'], fit: eatery, extra: plant(1.2), cases: true },
  hardware: { floor: 'concrete', fc: 0x9a948a, wall: 0xe6e0d0, staff: { id: 'male-adult-04', voice: 'townm3', label: 'The hardware man', lines: ['shopHard1', 'shopHard2'] }, sell: [['A roll of duct tape', 1.79, 'tape']], board: ['PACIFIC HARDWARE', 'Paint · Plumbing · Keys cut'], fit: aisles },
  clinic: { floor: 'checker', fc: 0xe8eef0, wall: 0xeef4f6, staff: { id: 'medical-female-01', voice: 'townf1', label: 'The nurse', lines: ['shopClin1', 'shopClin2'] }, sell: [['See the nurse', 12, 'heal']], board: ['CLÍNICA FAMILIAR DEL MAR', 'Médico · Dental · Walk-ins welcome'], fit: clinic, ownCounter: true, extra: both(plant(1.0), byWall('magrack', 3.2)) },
  pho: { floor: 'checker', fc: 0xe4dcc8, wall: 0xf0e6c4, dado: 0xa8321f, staff: { id: 'male-adult-16', voice: 'townm2', label: 'Mr. Nguyen', lines: ['shopPho1', 'shopPho2'] }, sell: [['A bowl of phở', 3.5, 'food:35'], ['A bánh mì', 1.75, 'food:20']], board: ['PHỞ · BÁNH MÌ · CÀ PHÊ', 'Phở Saigon'], fit: eatery, extra: byWall('cooler') },
  cellular: { floor: 'facadeTiles', fc: 0xd0d4d8, wall: 0xeef0f2, staff: { id: 'business-male-02', voice: 'townm1', label: 'The salesman', lines: ['shopCell1', 'shopCell2'] }, sell: [], board: ['COAST CELLULAR', 'The future is portable'], fit: cellular },
  // the block over the crossing (city/HalsBlock.js WEST2, EAST2)
  bar: { floor: 'patio', fc: 0x8a6a52, wall: 0x2a3a4a, dado: 0x4a2a1a, staff: { id: 'male-adult-05', voice: 'townm3', label: 'Gus', lines: ['shopBar1', 'shopBar2', 'shopBar3'] }, sell: [['A cold beer', 1.25, 'drink'], ['A whiskey', 2.5, 'drink'], ['A ginger ale', 0.5, 'food:4']], board: ['THE BLUE MARLIN', 'Cocktails · Pool · Since 1948'], fit: bar, ownCounter: true, posters: false,
    regulars: [{ id: 'male-adult-15', voice: 'townm1', label: 'A man at the bar', lines: ['barRegM1', 'barRegM2'], stool: 2 }, { id: 'female-adult-09', voice: 'townf2', label: 'A woman at the bar', lines: ['barRegF1', 'barRegF2'], stool: 6 }] },
  police: { floor: 'checker', fc: 0xd8d4c8, wall: 0xe6e4d8, dado: 0x5a6a5a, staff: { id: 'police-male-02', voice: 'townm2', label: 'The desk sergeant', lines: ['shopCop1', 'shopCop2', 'shopCop3'] }, sell: [], board: ['COAST CITY P.D.', '14th Precinct · Serving Coast City since 1912'], fit: station, ownCounter: true, deep: true,
    regulars: [{ id: 'police-male-03', voice: 'townm1', label: 'An officer', lines: ['shopCopDesk1', 'shopCopDesk2'], desk: 1 }] },
  hospital: { floor: 'checker', fc: 0xeef2f2, wall: 0xe8f0f0, dado: 0x7a9aa8, staff: { id: 'medical-female-02', voice: 'townf3', label: 'The triage nurse', lines: ['shopER1', 'shopER2'] }, sell: [['See a doctor', 30, 'heal']], board: ['ST. MARY’S EMERGENCY', 'Triage · Walk-ins · 24 Hours'], fit: er, ownCounter: true,
    regulars: [{ id: 'medical-male-01', voice: 'townm2', label: 'The doctor', lines: ['shopDoc1', 'shopDoc2'], walks: true }] },
  cinema: { floor: 'checker', fc: 0x2a1a1a, wall: 0x6a1a22, dado: 0x2a1010, staff: { id: 'female-adult-03', voice: 'townf3', label: 'The usher', lines: ['shopCine1', 'shopCine2'] }, sell: [['A ticket for the matinee', 2.5, 'movie'], ['Popcorn', 0.75, 'food:8']], board: ['THE PALMS', 'Air Conditioned · Matinees Daily'], fit: lobby, back: false, posters: false },
  pizza: { floor: 'checker', fc: 0xf2efe6, wall: 0xf3ead6, dado: 0x2f6b45, staff: { id: 'male-adult-07', voice: 'townm1', label: 'Tony', lines: ['shopPizza1', 'shopPizza2'] }, sell: [['A slice', 0.75, 'food:12'], ['A whole pie', 5.5, 'food:60'], ['A soda', 0.4, 'food:3']], board: ['TONY’S PIZZA', 'New York style · By the slice'], fit: eatery, back: false, extra: both(oven, byWall('cooler')) },
  travel: { floor: 'patio', fc: 0xd8c8b0, wall: 0xe6f2f4, dado: 0x1d6f8a, staff: { id: 'female-adult-04', voice: 'townf1', label: 'The travel agent', lines: ['shopTravel1', 'shopTravel2'], desk: 0 }, sell: [], board: ['SEA BREEZE TRAVEL', 'Air · Sea · Package Tours'], fit: desks, ownCounter: true, extra: byWall('magrack', 1.4),
    posters: ['ALOHA · HAWAII', 'ACAPULCO', 'PARIS IN SPRING'] },
  thrift: { floor: 'concrete', fc: 0xa8a090, wall: 0xe8e0cc, staff: { id: 'female-adult-06', voice: 'townf2', label: 'The volunteer', lines: ['shopThrift1', 'shopThrift2'] }, sell: [['A leather jacket', 3, 'jacket'], ['A paperback', 0.25, 'book']], board: ['SECOND CHANCE THRIFT', 'Everything donated · Everything helps'], fit: racks },
  cleaners: { floor: 'checker', fc: 0xe8ecee, wall: 0xeef2f4, staff: { id: 'female-adult-10', voice: 'townf1', label: 'The dry cleaner', lines: ['shopClean1', 'shopClean2'] }, sell: [['Press your suit', 2.5, 'press']], board: ['BAYSIDE CLEANERS', 'In by 9 · Out by 5'], fit: conveyor, back: false },
  bail: { floor: 'concrete', fc: 0x9a968c, wall: 0xe6e2c8, staff: { id: 'business-female-01', voice: 'townf3', label: 'The bondswoman', lines: ['shopBail1', 'shopBail2'], desk: 0 }, sell: [], board: ['A-1 BAIL BONDS', 'Fast · Confidential · 24 hours'], fit: desks, ownCounter: true,
    posters: ['WE POST BAIL', 'NO COLLATERAL? ASK', 'OPEN 24 HOURS'] },
  books: { floor: 'patio', fc: 0xb89a74, wall: 0xf0e6d0, dado: 0x2a3a2a, staff: { id: 'male-adult-10', voice: 'townm3', label: 'The bookseller', lines: ['shopBook1', 'shopBook2'] }, sell: [['A paperback', 1.95, 'book'], ['A road map of California', 0.75, 'book']], board: ['PACIFIC BOOKS', 'New · Used · Rare · Maps'], fit: bookcases, posters: false },
  tv: { floor: 'facadeTiles', fc: 0xc8ccd0, wall: 0xe8ecf0, staff: { id: 'business-male-01', voice: 'townm1', label: 'The salesman', lines: ['shopTV1', 'shopTV2'] }, sell: [['A transistor radio', 9.95, 'radio']], board: ['STARLIGHT TV & RADIO', 'Sales · Service · Rentals'], fit: tvs, posters: false },
  salon: { floor: 'checker', fc: 0xf8eef0, wall: 0xf6e4ea, dado: 0x8a4a5a, staff: { id: 'female-adult-11', voice: 'townf2', label: 'Belle', lines: ['shopSalon1', 'shopSalon2'] }, sell: [['A trim', 3, 'haircut']], board: ['BELLE’S BEAUTY SALON', 'Cuts · Sets · Perms'], fit: both(barber, dryers) },
  gym: { floor: 'concrete', fc: 0x3a3a3c, wall: 0xd8dcd8, dado: 0x2a2a2a, staff: { id: 'male-adult-19', voice: 'townm3', label: 'The trainer', lines: ['shopGym1', 'shopGym2'] }, sell: [['A workout', 2, 'workout']], board: ['IRON BEACH GYM', 'Members · Day passes · Boxing'], fit: gym, posters: false },
  grocer: { floor: 'checker', fc: 0xe8ece6, wall: 0xeef2ea, dado: 0x2a6a4a, staff: { id: 'female-adult-12', voice: 'townf3', label: 'The cashier', lines: ['shopGrocer1', 'shopGrocer2'] }, sell: [['A bag of groceries', 6.5, 'food:40'], ['An apple', 0.2, 'food:5']], board: ['OCEAN MARKET', 'Fresh produce daily'], fit: grocer },
};


export function shopRoom(ctx, M, r) {
  const T = SHOPS[r.kind];
  if (!T) return;
  const K = kit(ctx, M), { x0, x1, z0 } = r, ceil = Math.min(r.ceil ?? 3.4, 3.6);
  shell(ctx, M, { ...r, ceil, floorKey: T.floor, floorColor: T.fc, wall: T.wall, dado: T.dado ?? null, dadoH: 1.0 });
  // a shop of the building's whole depth was a hall of empty floor: the shop's part stops at 10 m,
  // a wall across with the back room's door in it ("employees only")
  let z1 = r.z1;
  if (!T.deep && z0 - z1 > 11.5) { // (the precinct keeps its depth: its bull pen and the cell behind the desk)
    z1 = z0 - 10.5;
    K.add('paint', box(x0, FLOOR, z1 - 0.12, x1, ceil, z1), T.wall);
    K.solid(x0, FLOOR, z1 - 0.12, x1, ceil, z1, 'stone');
    if (T.dado) K.add('paint', box(x0, FLOOR, z1, x1, FLOOR + 1.0, z1 + 0.005), T.dado);
  }
  const w = x1 - x0, d = z0 - z1, mid = (x0 + x1) / 2;
  // the door's side, and the counter across the back on the other
  const [da, db] = r.door ?? [x1 - 1.3, x1 - 0.3], dc = (da + db) / 2, doorLeft = dc < mid;
  const cz = z1 + Math.min(2.4, d * 0.32), ca = doorLeft ? Math.max(mid - 0.5, x0 + 1.2) : x0 + 0.8, cb = doorLeft ? x1 - 0.8 : Math.min(mid + 0.5, x1 - 1.2);
  const room = { K, M, r: { ...r, z1 }, T, x0, x1, z0, z1, w, d, mid, ceil, dc, doorLeft, cz, ca, cb, aisle: [Math.min(da, db) - 0.7, Math.max(da, db) + 0.7], rnd: seeded(Math.round(x0 * 977 + z1 * 131) + r.kind.length * 7919) };
  if (!T.ownCounter) counter(ctx, room, { back: T.back !== false });
  T.fit(ctx, room);
  const { ca: pa, cb: pb } = room; // (the bank's and the clinic's counters are their own)
  // the back room's door behind the counter's end, posters on the side walls
  const bd = room.doorLeft ? x0 + 1.2 : x1 - 1.2;
  K.add('paint', box(bd - 0.48, FLOOR, z1 + 0.01, bd + 0.48, FLOOR + 2.1, z1 + 0.05), 0x6a5a48);
  K.add('metal', box(bd + 0.3, FLOOR + 1.0, z1 + 0.05, bd + 0.36, FLOOR + 1.06, z1 + 0.09), 0xc8b070);
  ctx.labels.push({ M, u0: bd - 0.3, u1: bd + 0.3, y0: FLOOR + 1.6, h: 0.16, z: z1 + 0.055, sign: { text: 'EMPLOYEES ONLY', style: 'board', bg: '#e8e2d4', fg: '#7a1a1a', font: 'condensed', wear: 0.1 } });
  if (T.posters === undefined) for (const [k, z] of [z0 - 2.2, z0 - 5.0, z0 - 7.8].entries()) {
    if (z < z1 + 1.5) break;
    const wx = room.doorLeft ? x1 - 0.03 : x0 + 0.03, sg = room.doorLeft ? -1 : 1;
    K.add('dark', box(Math.min(wx, wx + sg * 0.03), FLOOR + 1.45, z - 0.42, Math.max(wx, wx + sg * 0.03), FLOOR + 2.25, z + 0.42), 0x2a2420);
    K.add('paint', box(Math.min(wx + sg * 0.03, wx + sg * 0.035), FLOOR + 1.5, z - 0.37, Math.max(wx + sg * 0.03, wx + sg * 0.035), FLOOR + 2.2, z + 0.37), POSTER[(k + r.kind.length) % POSTER.length]);
  }
  T.extra?.(ctx, room);
  // the sign over the back wall, lit
  ctx.labels.push({ M, u0: mid - Math.min(3.2, w * 0.36), u1: mid + Math.min(3.2, w * 0.36), y0: Math.min(ceil - 0.9, 2.3), h: 0.62, z: z1 + 0.06, sign: { text: T.board[0], sub: T.board[1], style: 'lightbox', bg: '#1d1d1d', fg: '#ffe9a8', accent: '#ffffff', font: 'condensed', wear: 0.12 }, lit: true });
  // ceiling fixtures (tubes), and the shared lamp's place in this room
  for (let x = x0 + 1.6; x < x1 - 1; x += 3.2) for (let z = z0 - 1.6; z > z1 + 1; z -= 3.4) { K.add('metal', box(x - 0.7, ceil - 0.05, z - 0.12, x + 0.7, ceil - 0.01, z + 0.12), 0xe8e8e4); K.add('glow', box(x - 0.62, ceil - 0.055, z - 0.07, x + 0.62, ceil - 0.05, z + 0.07), 0xfff4e0); }
  (ctx.shopLights ??= []).push({ M, at: V(mid, ceil - 0.7, (z0 + z1) / 2), x0, x1, z0, z1: r.z1, ceil });
  // who works there, behind the counter; where you buy
  // (or where the fitting put them: the bar's barman behind his bar, the sergeant behind his desk)
  const post = room.post ?? { at: V((pa + pb) / 2, FLOOR, cz - 1.0), beat: [V(pa + 0.6, FLOOR, cz - 1.0), V(pb - 0.6, FLOOR, cz - 1.0)], yaw: 0 };
  if (T.staff) ctx.posts.push({ who: `shop:${r.kind}`, room: r.kind, staff: T.staff, at: post.at.applyMatrix4(M), beat: post.beat?.map((b) => b.applyMatrix4(M)), face: K.yawOf + (post.yaw ?? 0), sit: post.sit });
  const buy = room.buy ?? { at: V((pa + pb) / 2, FLOOR, cz + 0.75), look: V((pa + pb) / 2, FLOOR + 1.1, cz - 0.3) };
  if (T.sell.length) ctx.spots.push({ kind: 'buy', shop: r.kind, sell: T.sell, label: `Buy something · ${r.name ?? 'the counter'}`, at: buy.at.applyMatrix4(M), look: buy.look.applyMatrix4(M), room: r.kind });
}

// someone who's there besides the staff (a regular on a stool, an officer at his desk, the doctor on
// his rounds): their place in the room's frame, sitting (`sit`, the seat's height) or walking a beat
function regular(ctx, R, reg, { at, yaw = 0, sit, stool, beat }) {
  ctx.posts.push({ who: `shop:${R.r.kind}:${reg.id}`, room: R.r.kind, staff: reg, at: at.applyMatrix4(R.M), beat: beat?.map((b) => b.applyMatrix4(R.M)), face: R.K.yawOf + yaw, sit, stool });
}
// a picture on a side wall (x: the wall's face, sg: into the room), lettered: a poster, a notice board
function picture(ctx, R, x, sg, z, y, w, h, sign) {
  const F = R.M.clone().multiply(new THREE.Matrix4().makeTranslation(x + sg * 0.02, 0, z)).multiply(new THREE.Matrix4().makeRotationY(sg > 0 ? Math.PI / 2 : -Math.PI / 2));
  ctx.labels.push({ M: F, u0: -w / 2, u1: w / 2, y0: FLOOR + y, h, z: 0, sign });
}

// the counter: a cabinet and its top across the back, the register on it, solid
function counter(ctx, R, { color = 0x6a4a32, top = 0xe8e2d4, h = 1.0, register = true, back = true } = {}) {
  const { K, cz, ca, cb } = R;
  K.add('paint', box(ca, FLOOR, cz - 0.62, cb, FLOOR + h - 0.04, cz), color);
  K.add('paint', box(ca - 0.03, FLOOR + h - 0.04, cz - 0.65, cb + 0.03, FLOOR + h, cz + 0.03), top);
  K.solid(ca - 0.03, FLOOR, cz - 0.65, cb + 0.03, FLOOR + h, cz + 0.03, 'wood');
  if (register) K.put('oldregister', ca + 0.5, FLOOR + h, cz - 0.32, Math.PI);
  // the back wall behind it: shelving with stock
  if (!back) return;
  const { M, z1 } = R;
  K.add('paint', box(ca, FLOOR, z1 + 0.02, cb, FLOOR + 2.0, z1 + 0.42), 0x8a6a4a);
  K.solid(ca, FLOOR, z1 + 0.02, cb, FLOOR + 2.0, z1 + 0.42, 'wood');
  for (const y of [0.9, 1.3, 1.7]) { K.add('paint', box(ca, FLOOR + y, z1 + 0.02, cb, FLOOR + y + 0.03, z1 + 0.46), 0xb08a5a); ctx.goods.push(...shelfRow(ca + 0.1, cb - 0.1, FLOOR + y + 0.03, z1 + 0.44, 0.06, 0.18, 0.012, M, true, 0.2)); }
}

// tables with chairs over the front of the room, clear of the way in from the door
function tables(ctx, R, n) {
  const { K, x0, x1, z0, cz, aisle } = R;
  const spots = [];
  for (let z = z0 - 1.5; z > cz + 1.7; z -= 2.2) for (let x = x0 + 1.3; x < x1 - 1.0; x += 2.3) if (x + 0.9 < aisle[0] || x - 0.9 > aisle[1]) spots.push([x, z]);
  for (const [x, z] of spots.slice(0, n)) {
    K.add('paint', new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20).translate(x, FLOOR + 0.74, z), 0x8a5a34); // (wood: a white top under the lamp bloomed to a blob)
    if (R.T.fit === eatery) { K.put('napkins', x - 0.08, FLOOR + 0.76, z, 0, 'small'); K.put('ketchup', x + 0.1, FLOOR + 0.76, z + 0.05, 0, 'small'); }
    K.add('metal', new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8).translate(x, FLOOR + 0.37, z), 0x9a9a9a);
    K.add('metal', new THREE.CylinderGeometry(0.22, 0.24, 0.03, 12).translate(x, FLOOR + 0.015, z), 0x7a7a7a);
    K.solid(x - 0.42, FLOOR, z - 0.42, x + 0.42, FLOOR + 0.76, z + 0.42, 'wood');
    for (const [dx, dz] of [[0.62, 0], [-0.62, 0]]) chair(ctx, R, x + dx, z + dz, dx > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
}
function chair(ctx, R, x, z, yaw) {
  const { K } = R, c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  K.add('paint', box(x - 0.2, FLOOR + 0.44, z - 0.2, x + 0.2, FLOOR + 0.48, z + 0.2), 0x7a2a22);
  const [bx, bz] = at(0, -0.19);
  K.add('paint', new THREE.BoxGeometry(0.4, 0.42, 0.04).rotateY(yaw).translate(bx, FLOOR + 0.7, bz), 0x7a2a22);
  for (const [lx, lz] of [[0.17, 0.17], [-0.17, 0.17], [0.17, -0.17], [-0.17, -0.17]]) { const [px, pz] = at(lx, lz); K.add('metal', new THREE.CylinderGeometry(0.015, 0.015, 0.44, 6).translate(px, FLOOR + 0.22, pz), 0x6a6a6a); }
}

// ---------------------------------------------------------------- the trades
function eatery(ctx, R) {
  tables(ctx, R, 6);
  // a glass case on the counter (the donuts, the bakery's bread), or a menu of photos over it
  const { K, ca, cb, cz, M, T } = R;
  if (T.cases) {
    K.add('clearGlass', box(ca + 0.9, FLOOR + 1.0, cz - 0.55, cb - 0.2, FLOOR + 1.45, cz - 0.05), 0xffffff);
    const tint = R.r.kind === 'donuts' ? [0xd9a35a, 0xc0607a, 0x6a3a22, 0xf0e0c0] : [0xc89a5a, 0xe0b878, 0xa8743a, 0xf0d098];
    for (let x = ca + 1.05; x < cb - 0.3; x += 0.2) for (const [y, zz] of [[1.05, -0.4], [1.25, -0.25]]) K.add('paint', new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12).translate(x, FLOOR + y, cz + zz), tint[Math.floor(Math.abs(x * 13 + y * 7)) % 4]);
  } else if (T.back !== false) { // (on the back shelving's front: without it, Tony's oven, they'd float)
    for (let x = ca + 0.9, i = 0; x < cb - 0.6; x += 0.9, i++) K.add('paint', box(x - 0.36, FLOOR + 2.45, R.z1 + 0.43, x + 0.36, FLOOR + 2.95, R.z1 + 0.46), [0xd8a050, 0xc85a3a, 0x8aa05a, 0xe0c080][i % 4]);
  }
  void M;
}

function laundromat(ctx, R) {
  const { K, x0, x1, z0, cz, doorLeft } = R;
  // washers down the side wall away from the door, dryers stacked on the other
  const row = (x, face) => {
    for (let z = z0 - 1.0; z > cz + 1.0; z -= 0.78) {
      K.add('paint', box(x - 0.34, FLOOR, z - 0.36, x + 0.34, FLOOR + 0.88, z + 0.36), 0xf2f2ee);
      K.add('dark', new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20).rotateZ(Math.PI / 2).translate(x + face * 0.345, FLOOR + 0.5, z), 0x203038);
      K.add('metal', new THREE.TorusGeometry(0.21, 0.025, 6, 20).rotateY(Math.PI / 2).translate(x + face * 0.35, FLOOR + 0.5, z), 0xc8ccd0);
      K.add('paint', box(x - 0.34, FLOOR + 0.88, z - 0.36, x + 0.34, FLOOR + 1.02, z + 0.36), 0xd8dce0);
      K.solid(x - 0.34, FLOOR, z - 0.36, x + 0.34, FLOOR + 1.02, z + 0.36, 'metal');
    }
  };
  if (doorLeft) row(x1 - 0.5, -1); else row(x0 + 0.5, 1);
  // a folding table down the middle
  const tx = doorLeft ? x1 - 2.2 : x0 + 2.2;
  K.add('paint', box(tx - 0.4, FLOOR + 0.82, cz + 1.4, tx + 0.4, FLOOR + 0.86, z0 - 1.4), 0xe8e2d4);
  K.add('metal', box(tx - 0.3, FLOOR, cz + 1.5, tx + 0.3, FLOOR + 0.82, z0 - 1.5), 0x9a9a9a);
  K.solid(tx - 0.4, FLOOR, cz + 1.4, tx + 0.4, FLOOR + 0.86, z0 - 1.4, 'wood');
}

function barber(ctx, R) {
  const { K, x0, x1, z0, cz, doorLeft, M } = R;
  // two chairs facing the side wall's mirrors, waiting chairs under the front window
  const wx = doorLeft ? x1 - 0.12 : x0 + 0.12, sgn = doorLeft ? -1 : 1, cx = wx + sgn * 1.4;
  for (const [i, z] of [z0 - 1.8, z0 - 3.8].entries()) {
    if (z < cz + 1.2) continue;
    K.add('metal', new THREE.CylinderGeometry(0.28, 0.32, 0.12, 16).translate(cx, FLOOR + 0.06, z), 0xc8ccd0);
    K.add('metal', new THREE.CylinderGeometry(0.08, 0.08, 0.38, 10).translate(cx, FLOOR + 0.3, z), 0xc8ccd0);
    K.add('paint', box(cx - 0.3, FLOOR + 0.5, z - 0.28, cx + 0.3, FLOOR + 0.62, z + 0.28), 0x8a1a1a);
    K.add('paint', box(cx - sgn * 0.26 - 0.06, FLOOR + 0.62, z - 0.28, cx - sgn * 0.26 + 0.06, FLOOR + 1.3, z + 0.28), 0x8a1a1a);
    for (const s of [-1, 1]) K.add('metal', box(cx - 0.28, FLOOR + 0.78, z + s * 0.3 - 0.03, cx + 0.22, FLOOR + 0.82, z + s * 0.3 + 0.03), 0xd8dde2);
    K.solid(cx - 0.34, FLOOR, z - 0.34, cx + 0.34, FLOOR + 1.3, z + 0.34, 'metal');
    // the mirror and its shelf of tonics
    K.add('metal', box(Math.min(wx, wx + sgn * 0.03), FLOOR + 1.0, z - 0.55, Math.max(wx, wx + sgn * 0.03), FLOOR + 2.1, z + 0.55), 0xd8dde2);
    K.add('clearGlass', box(Math.min(wx + sgn * 0.03, wx + sgn * 0.04), FLOOR + 1.05, z - 0.5, Math.max(wx + sgn * 0.03, wx + sgn * 0.04), FLOOR + 2.05, z + 0.5), 0xbfd4e0);
    K.add('paint', box(Math.min(wx, wx + sgn * 0.3), FLOOR + 0.92, z - 0.55, Math.max(wx, wx + sgn * 0.3), FLOOR + 0.96, z + 0.55), 0xe8e2d4);
    for (let k = 0; k < 4; k++) K.add('clearGlass', new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8).translate(wx + sgn * 0.15, FLOOR + 1.04, z - 0.3 + k * 0.2), [0x5a9a6a, 0x9a5a3a, 0x3a6a9a, 0xd8c070][k]);
    void i;
  }
  void M;
}

function pawn(ctx, R) {
  const { K, x0, x1, z0, cz, aisle } = R;
  // glass cases down the room, guitars on the wall
  for (let z = z0 - 1.2; z > cz + 1.4; z -= 1.6) {
    for (const x of [x0 + 0.9, x1 - 0.9]) {
      if (x + 0.6 > aisle[0] && x - 0.6 < aisle[1]) continue;
      K.add('paint', box(x - 0.45, FLOOR, z - 0.6, x + 0.45, FLOOR + 0.6, z + 0.6), 0x4a3a2a);
      K.add('clearGlass', box(x - 0.45, FLOOR + 0.6, z - 0.6, x + 0.45, FLOOR + 1.0, z + 0.6), 0xffffff);
      for (let k = 0; k < 5; k++) K.add('metal', box(x - 0.3 + (k % 3) * 0.25, FLOOR + 0.62, z - 0.45 + k * 0.2, x - 0.18 + (k % 3) * 0.25, FLOOR + 0.66, z - 0.33 + k * 0.2), [0xd8b84a, 0xc0c4c8, 0x2a2a2a][k % 3]);
      K.solid(x - 0.45, FLOOR, z - 0.6, x + 0.45, FLOOR + 1.0, z + 0.6, 'metal');
    }
  }
}

function bank(ctx, R) {
  const { K, x0, x1, z1, cz, mid, M } = R;
  // the tellers' counter right across the back, glass over it to the ceiling's height, two windows
  const ca = x0 + 0.8, cb = x1 - 0.8;
  K.add('paint', box(ca, FLOOR, cz - 0.62, cb, FLOOR + 1.1, cz), 0x5a3a24);
  K.add('paint', box(ca - 0.03, FLOOR + 1.1, cz - 0.65, cb + 0.03, FLOOR + 1.14, cz + 0.05), 0x2a2420);
  for (let x = ca; x <= cb + 0.01; x += (cb - ca) / 4) K.add('metal', box(x - 0.025, FLOOR + 1.14, cz - 0.32, x + 0.025, FLOOR + 2.4, cz - 0.28), 0xb08d4a);
  K.add('clearGlass', box(ca, FLOOR + 1.3, cz - 0.31, cb, FLOOR + 2.4, cz - 0.29), 0xd8e8f0);
  K.solid(ca - 0.03, FLOOR, cz - 0.65, cb + 0.03, FLOOR + 2.4, cz + 0.05, 'wood');
  // a writing desk and a bench for the line
  K.add('paint', box(mid - 0.9, FLOOR, cz + 2.2, mid + 0.9, FLOOR + 1.05, cz + 2.7), 0x5a3a24);
  K.solid(mid - 0.9, FLOOR, cz + 2.2, mid + 0.9, FLOOR + 1.05, cz + 2.7, 'wood');
  R.ca = ca; R.cb = cb;
  void z1; void M;
}

function aisles(ctx, R) {
  const { x0, x1, z0, cz, aisle, M } = R;
  // gondolas from the front to the counter, clear of the door's line
  for (let x = x0 + 1.6; x < x1 - 1.4; x += 2.4) if (x + 0.6 < aisle[0] || x - 0.6 > aisle[1]) gondola(ctx, M, x, z0 - 1.6, Math.max(cz + 1.5, z0 - 1.6 - 6));
}

function records(ctx, R) {
  const { K, x0, x1, z0, cz, aisle } = R;
  // bins of records on low tables, sleeves leaning in them, posters on the walls
  for (let z = z0 - 1.4; z > cz + 1.5; z -= 1.7) for (let x = x0 + 1.2; x < x1 - 1.0; x += 2.0) {
    if (x + 0.7 > aisle[0] && x - 0.7 < aisle[1]) continue;
    K.add('paint', box(x - 0.6, FLOOR, z - 0.35, x + 0.6, FLOOR + 0.8, z + 0.35), 0x5a4030);
    K.solid(x - 0.6, FLOOR, z - 0.35, x + 0.6, FLOOR + 0.8, z + 0.35, 'wood');
    for (let k = 0; k < 9; k++) K.add('paint', new THREE.BoxGeometry(0.31, 0.31, 0.01).rotateX(-0.35).translate(x - 0.48 + k * 0.12, FLOOR + 0.92, z), [0xd04a3a, 0x2a5aa0, 0xe8c040, 0x1a1a1a, 0x8a3aa0, 0xf0f0e8][k % 6]);
  }
  for (let x = x0 + 1; x < x1 - 1; x += 1.4) K.add('paint', box(x - 0.42, 1.6, R.z0 - 0.04, x + 0.42, 2.3, R.z0 - 0.02), [0xe85a3a, 0x3a8ad0, 0xf0d040, 0x6a3aa0][Math.floor(x) % 4]);
}

function florist(ctx, R) {
  const { K, x0, x1, z0, cz, aisle } = R;
  // tiered stands of buckets along the walls, flowers in every one
  const colours = [0xd02a3a, 0xf0e8f0, 0xf0c030, 0xe070a0, 0x8a4ad0, 0xf08030];
  for (const x of [x0 + 0.6, x1 - 0.6]) {
    if (x + 0.5 > aisle[0] && x - 0.5 < aisle[1]) continue;
    for (let z = z0 - 0.9; z > cz + 1.0; z -= 0.55) for (const [k, y] of [0.25, 0.6].entries()) {
      const bx = x + (x < (x0 + x1) / 2 ? 1 : -1) * k * 0.3;
      K.add('metal', new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12).translate(bx, FLOOR + y, z), 0x8a9098);
      K.add('paint', new THREE.SphereGeometry(0.17, 10, 8).scale(1, 0.75, 1).translate(bx, FLOOR + y + 0.33, z), colours[Math.floor(Math.abs(z * 5 + k * 3)) % colours.length]);
    }
    K.solid(x - 0.5, FLOOR, cz + 0.8, x + 0.5, FLOOR + 0.9, z0 - 0.6, 'metal');
  }
  // and a table of them in the middle, clear of the way in
  const tx = R.doorLeft ? R.mid + 1.2 : R.mid - 1.2, tz = (z0 + cz) / 2;
  K.add('paint', box(tx - 0.8, FLOOR, tz - 0.6, tx + 0.8, FLOOR + 0.75, tz + 0.6), 0x6a4a32);
  K.solid(tx - 0.8, FLOOR, tz - 0.6, tx + 0.8, FLOOR + 0.75, tz + 0.6, 'wood');
  for (let i = 0; i < 6; i++) {
    const bx = tx - 0.55 + (i % 3) * 0.55, bz = tz - 0.28 + Math.floor(i / 3) * 0.56;
    K.add('metal', new THREE.CylinderGeometry(0.14, 0.11, 0.28, 12).translate(bx, FLOOR + 0.89, bz), 0x8a9098);
    K.add('paint', new THREE.SphereGeometry(0.18, 10, 8).scale(1, 0.8, 1).translate(bx, FLOOR + 1.12, bz), colours[(i * 2) % colours.length]);
  }
}

function clinic(ctx, R) {
  const { K, x0, x1, z0, cz, mid, aisle } = R;
  // reception across the back, rows of waiting chairs facing it
  const ca = Math.max(x0 + 0.8, mid - 2.4), cb = Math.min(x1 - 0.8, mid + 2.4);
  R.ca = ca; R.cb = cb;
  counter(ctx, R, { color: 0xd8e4ea, top: 0xffffff, h: 1.05 });
  for (let row = 0, z = cz + 2.4; row < 3 && z < z0 - 1.4; row++, z += 1.5) for (let k = 0, x = mid - 2.1; k < 7; k++, x += 0.6) if (x + 0.3 < aisle[0] || x - 0.3 > aisle[1]) chair(ctx, R, x, z, Math.PI);
}

function cellular(ctx, R) {
  const { K, mid, z0, cz } = R;
  // a display table of the new phones (the size of a brick)
  const z = (z0 + cz) / 2;
  K.add('paint', box(mid - 1.2, FLOOR, z - 0.5, mid + 1.2, FLOOR + 0.85, z + 0.5), 0x2a2e34);
  K.solid(mid - 1.2, FLOOR, z - 0.5, mid + 1.2, FLOOR + 0.85, z + 0.5, 'wood');
  for (let k = 0; k < 6; k++) K.add('dark', box(mid - 1.0 + k * 0.38, FLOOR + 0.85, z - 0.06, mid - 0.92 + k * 0.38, FLOOR + 1.08, z + 0.02), 0x1a1a1a);
}

// ---------------------------------------------------------------- the block over the crossing
// The Blue Marlin: the bar down the far wall, a dozen stools at it and its foot rail, the back bar of
// bottles before a mirror, a pool table under its lamp, two tables by the window, the jukebox, a
// dartboard, beer signs glowing on the walls
function bar(ctx, R) {
  const { K, x0, x1, z0, z1, doorLeft, rnd } = R;
  const sg = doorLeft ? -1 : 1, wall = doorLeft ? x1 : x0, face = wall + sg * 1.6; // (from the bar's wall into the room)
  const za = z0 - 1.5, zb = z1 + 0.9, zm = (za + zb) / 2;
  // the bar: a panelled front, a dark top, the brass rail
  K.add('paint', boxX(face - sg * 0.6, face, FLOOR, FLOOR + 1.04, zb, za), 0x4a2a1a);
  K.add('paint', boxX(face - sg * 0.66, face + sg * 0.06, FLOOR + 1.04, FLOOR + 1.1, zb - 0.05, za + 0.05), 0x1e1410);
  K.solid(...solidX(face - sg * 0.66, face + sg * 0.06, FLOOR, FLOOR + 1.1, zb - 0.05, za + 0.05), 'wood');
  for (let z = za - 0.25; z > zb + 0.1; z -= 0.7) K.add('paint', boxX(face - 0.005 * sg, face + sg * 0.012, FLOOR + 0.2, FLOOR + 0.92, z - 0.28, z + 0.28), 0x5a3420); // (its panels)
  K.add('metal', new THREE.CylinderGeometry(0.025, 0.025, za - zb, 8).rotateX(Math.PI / 2).translate(face + sg * 0.2, FLOOR + 0.24, zm), 0xc8a050);
  // the back bar: a low cabinet, three glass shelves of bottles, a mirror behind them
  K.add('paint', boxX(wall + sg * 0.02, wall + sg * 0.5, FLOOR, FLOOR + 0.95, zb, za), 0x3a2216);
  K.solid(...solidX(wall + sg * 0.02, wall + sg * 0.5, FLOOR, FLOOR + 0.95, zb, za), 'wood');
  K.add('metal', boxX(wall + sg * 0.02, wall + sg * 0.04, FLOOR + 1.1, FLOOR + 2.4, zb + 0.2, za - 0.2), 0x5a6268); // (a smoked mirror: a bright one bloomed to a white wall)
  const bottle = [0x6a3410, 0x1f4a24, 0x9ab0b4, 0x5a1e0e, 0xb88a3a, 0x2a1e44];
  for (const y of [1.15, 1.55, 1.95]) {
    K.add('clearGlass', boxX(wall + sg * 0.05, wall + sg * 0.32, FLOOR + y - 0.015, FLOOR + y, zb + 0.2, za - 0.2), 0xd8e4e8);
    for (let z = za - 0.3; z > zb + 0.3; z -= 0.11 + rnd() * 0.05) {
      const h = 0.24 + rnd() * 0.1, x = wall + sg * (0.14 + rnd() * 0.08);
      K.add('paint', new THREE.CylinderGeometry(0.035, 0.038, h, 8).translate(x, FLOOR + y + h / 2, z), bottle[Math.floor(rnd() * bottle.length)]); // (the clear glass vanished against the mirror)
      K.add('dark', new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6).translate(x, FLOOR + y + h + 0.035, z), 0x1a1a1a);
    }
  }
  // the taps on the bar, the stools
  for (const z of [zm + 0.8, zm, zm - 0.8]) { K.add('metal', boxX(face - sg * 0.5, face - sg * 0.44, FLOOR + 1.1, FLOOR + 1.45, z - 0.03, z + 0.03), 0xd8d0b8); K.add('paint', boxX(face - sg * 0.51, face - sg * 0.43, FLOOR + 1.45, FLOOR + 1.6, z - 0.04, z + 0.04), [0xc0201b, 0x1f4f9a, 0xd8b060][Math.round((z - zm) / 0.8) + 1]); }
  R.stools = [];
  for (let z = za - 0.4; z > zb + 0.3; z -= 0.78) { K.put('stool', face + sg * 0.48, FLOOR, z, 0, 'stool'); R.stools.push(V(face + sg * 0.48, FLOOR, z)); }
  // the pool table, its lamp, the cues on the wall
  const ow = doorLeft ? x0 : x1, og = -sg, px = (ow + face + sg * 1.0) / 2, pz = zb + 2.4; // (ow, og: the door's wall and the way from it into the room)
  K.add('paint', boxX(px - 0.72, px + 0.72, FLOOR + 0.62, FLOOR + 0.78, pz - 1.32, pz + 1.32), 0x3a2216);
  K.add('paint', boxX(px - 0.62, px + 0.62, FLOOR + 0.78, FLOOR + 0.8, pz - 1.22, pz + 1.22), 0x1f6b3a);
  for (const [dx, dz] of [[-0.66, 0], [0.66, 0], [0, -1.27], [0, 1.27]]) K.add('paint', boxX(px + dx - (dz ? 0.62 : 0.06), px + dx + (dz ? 0.62 : 0.06), FLOOR + 0.78, FLOOR + 0.86, pz + dz - (dz ? 0.05 : 1.22), pz + dz + (dz ? 0.05 : 1.22)), 0x4a2a18);
  for (const [dx, dz] of [[-0.6, -1.2], [0.6, -1.2], [-0.6, 1.2], [0.6, 1.2]]) K.add('paint', new THREE.CylinderGeometry(0.07, 0.06, 0.62, 10).translate(px + dx, FLOOR + 0.31, pz + dz), 0x3a2216);
  for (let i = 0; i < 9; i++) K.add('paint', new THREE.SphereGeometry(0.028, 10, 8).translate(px - 0.3 + rnd() * 0.6, FLOOR + 0.828, pz - 0.8 + rnd() * 1.6), [0xf2f0e8, 0xd8b020, 0x1f4f9a, 0xc0201b, 0x5a2a7a, 0xe0702a, 0x2a7a3a, 0x6a1a1a, 0x141414][i]);
  K.solid(px - 0.72, FLOOR, pz - 1.32, px + 0.72, FLOOR + 0.86, pz + 1.32, 'wood');
  K.add('paint', boxX(px - 0.3, px + 0.3, R.ceil - 0.9, R.ceil - 0.78, pz - 0.75, pz + 0.75), 0x1f4a2a);
  K.add('glow', boxX(px - 0.26, px + 0.26, R.ceil - 0.905, R.ceil - 0.9, pz - 0.7, pz + 0.7), 0xfff0cc);
  for (const dz of [-0.5, 0.5]) K.add('metal', new THREE.CylinderGeometry(0.006, 0.006, 0.78, 4).translate(px, R.ceil - 0.39, pz + dz), 0x2a2a2a);
  for (let k = 0; k < 5; k++) K.add('paint', new THREE.CylinderGeometry(0.012, 0.007, 1.45, 6).translate(ow + og * 0.05, FLOOR + 0.85, pz - 0.3 + k * 0.12), 0xc8a070);
  // two tables by the front window, the jukebox and the dartboard on the near wall
  for (const tz of [z0 - 1.6, z0 - 3.6]) {
    const tx = (ow + face + sg * 1.0) / 2 + sg * 0.6;
    if (tx > R.aisle[0] - 0.8 && tx < R.aisle[1] + 0.8) continue;
    K.add('paint', new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18).translate(tx, FLOOR + 0.74, tz), 0x3a2216);
    K.add('metal', new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8).translate(tx, FLOOR + 0.37, tz), 0x2a2a2a);
    K.solid(tx - 0.4, FLOOR, tz - 0.4, tx + 0.4, FLOOR + 0.76, tz + 0.4, 'wood');
    for (const dx of [0.62, -0.62]) chair(ctx, R, tx + dx, tz, dx > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  K.put('jukebox', ow + og * 0.45, FLOOR, (z0 + z1) / 2 + 0.6, og > 0 ? Math.PI / 2 : -Math.PI / 2);
  const dart = ow + og * 0.03;
  K.add('dark', new THREE.CylinderGeometry(0.23, 0.23, 0.04, 20).rotateZ(Math.PI / 2).translate(dart, FLOOR + 1.73, z1 + 1.1), 0x1a1a1a);
  K.add('paint', new THREE.CylinderGeometry(0.17, 0.17, 0.045, 20).rotateZ(Math.PI / 2).translate(dart, FLOOR + 1.73, z1 + 1.1), 0xc8b890);
  K.add('paint', new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10).rotateZ(Math.PI / 2).translate(dart, FLOOR + 1.73, z1 + 1.1), 0xc0201b);
  // beer signs, lit: over the back bar and on the near wall
  K.add('glow', boxX(wall + sg * 0.03, wall + sg * 0.05, FLOOR + 2.55, FLOOR + 2.85, zm - 0.8, zm + 0.8), 0x3a9aff);
  K.add('glow', boxX(wall + sg * 0.03, wall + sg * 0.05, FLOOR + 2.6, FLOOR + 2.8, zm + 1.4, zm + 2.2), 0xff4a3a);
  K.add('glow', boxX(ow + og * 0.03, ow + og * 0.05, FLOOR + 2.1, FLOOR + 2.35, z1 + 3.0, z1 + 4.1), 0xffc03a);
  // Gus behind the bar, the regulars on their stools, Hal's place at it
  R.post = { at: V(wall + sg * 0.95, FLOOR, zm), beat: [V(wall + sg * 0.95, FLOOR, za - 0.5), V(wall + sg * 0.95, FLOOR, zb + 0.5)], yaw: sg * Math.PI / 2 };
  for (const reg of R.T.regulars ?? []) { const st = R.stools[reg.stool]; if (st) regular(ctx, R, reg, { at: st.clone(), yaw: -sg * Math.PI / 2, sit: 0.78, stool: true }); }
  const free = R.stools[4] ?? R.stools[0];
  R.buy = { at: V(face + sg * 1.05, FLOOR, free.z), look: V(face - sg * 0.3, FLOOR + 1.15, free.z) };
}

// the 14th Precinct: benches and the notice board in the lobby, the sergeant's high desk across the
// room (a way through at its end), the flags behind him; the bull pen's desks with their typewriters,
// phones and lamps, the filing cabinets, the coffee; the holding cell's bars in the back corner
function station(ctx, R) {
  const { K, x0, x1, z0, z1, mid, rnd } = R;
  // the lobby's benches, along both walls
  for (const [x, sg] of [[x0, 1], [x1, -1]]) {
    K.add('paint', boxX(x + sg * 0.05, x + sg * 0.5, FLOOR + 0.42, FLOOR + 0.47, z0 - 5.2, z0 - 1.4), 0x6a4a2a);
    K.add('paint', boxX(x + sg * 0.05, x + sg * 0.1, FLOOR + 0.47, FLOOR + 0.95, z0 - 5.2, z0 - 1.4), 0x6a4a2a);
    for (const z of [z0 - 1.5, z0 - 3.3, z0 - 5.1]) K.add('iron', boxX(x + sg * 0.1, x + sg * 0.45, FLOOR, FLOOR + 0.42, z - 0.03, z + 0.03), 0x2a2a2a);
    K.solid(...solidX(x + sg * 0.05, x + sg * 0.5, FLOOR, FLOOR + 0.95, z0 - 5.2, z0 - 1.4), 'wood');
  }
  picture(ctx, R, x0, 1, z0 - 3.3, 1.35, 2.2, 1.0, { text: 'WANTED', sub: 'If you have seen these men call the 14th', style: 'board', bg: '#d8c8a0', fg: '#1a1a1a', accent: '#7a1a1a', font: 'slab', wear: 0.3 });
  picture(ctx, R, x1, -1, z0 - 3.3, 1.4, 1.6, 0.8, { text: 'NOTICE', sub: 'All visitors report to the desk', style: 'board', bg: '#f0ece0', fg: '#26324a', accent: '#7a1a1a', font: 'condensed', wear: 0.2 });
  // the desk: high, across the room from the left wall to a way through at the right
  const dz = z0 - 7.2, da = x0 + 0.6, db = x1 - 1.6;
  K.add('paint', box(da, FLOOR, dz - 0.7, db, FLOOR + 1.2, dz), 0x5a3a24);
  K.add('paint', box(da - 0.04, FLOOR + 1.2, dz - 0.75, db + 0.04, FLOOR + 1.25, dz + 0.06), 0x2a2420);
  for (let x = da + 0.4; x < db - 0.2; x += 0.9) K.add('paint', box(x - 0.36, FLOOR + 0.15, dz - 0.005, x + 0.36, FLOOR + 1.05, dz + 0.012), 0x6a4630);
  K.solid(da - 0.04, FLOOR, dz - 0.75, db + 0.04, FLOOR + 1.25, dz + 0.06, 'wood');
  K.add('metal', new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12).translate(mid - 0.6, FLOOR + 1.275, dz - 0.2), 0xc8a050); // its bell
  K.add('dark', box(mid + 0.4, FLOOR + 1.25, dz - 0.55, mid + 0.65, FLOOR + 1.33, dz - 0.35), 0x1a1a1a); // its phone
  K.add('paint', box(mid - 0.1, FLOOR + 1.25, dz - 0.6, mid + 0.25, FLOOR + 1.262, dz - 0.25), 0xf2efe6); // the blotter's papers
  // the flags behind him
  for (const [i, x] of [[0, x0 + 0.8], [1, x0 + 1.6]].values()) {
    K.add('metal', new THREE.CylinderGeometry(0.02, 0.02, 2.5, 8).translate(x, FLOOR + 1.25, dz - 1.6), 0xc8a050);
    K.add('paint', box(x + 0.02, FLOOR + 1.6, dz - 1.62, x + 0.9, FLOOR + 2.3, dz - 1.58), i ? 0xc8b878 : 0x2a3a6a);
    K.add('paint', box(x + 0.02, FLOOR + 1.6, dz - 1.625, x + 0.9, FLOOR + 1.75, dz - 1.575), i ? 0x6a2a1a : 0xb8322a);
    K.solid(x - 0.1, FLOOR, dz - 1.7, x + 0.1, FLOOR + 2.5, dz - 1.5, 'metal');
  }
  // the bull pen: four desks, each with a typewriter, a phone, a lamp, a chair
  const desks = [];
  for (const dzk of [dz - 3.2, dz - 6.0]) for (const dx of [mid - 2.2, mid + 1.4]) {
    K.add('paint', box(dx - 0.75, FLOOR + 0.72, dzk - 0.4, dx + 0.75, FLOOR + 0.76, dzk + 0.4), 0x6a6a62);
    K.add('paint', box(dx - 0.72, FLOOR, dzk - 0.37, dx - 0.3, FLOOR + 0.72, dzk + 0.37), 0x5a5a54);
    K.solid(dx - 0.75, FLOOR, dzk - 0.4, dx + 0.75, FLOOR + 0.76, dzk + 0.4, 'metal');
    K.add('dark', box(dx - 0.2, FLOOR + 0.76, dzk - 0.05, dx + 0.25, FLOOR + 0.88, dzk + 0.25), 0x2a2a2a);
    K.add('dark', box(dx + 0.4, FLOOR + 0.76, dzk - 0.3, dx + 0.62, FLOOR + 0.84, dzk - 0.12), 0x141414);
    K.add('metal', new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6).translate(dx - 0.55, FLOOR + 0.93, dzk - 0.25), 0x2a2a2a);
    K.add('paint', new THREE.ConeGeometry(0.11, 0.12, 12, 1, true).translate(dx - 0.55, FLOOR + 1.12, dzk - 0.2), 0x2a5a3a);
    K.add('glow', new THREE.CircleGeometry(0.1, 12).rotateX(Math.PI / 2).translate(dx - 0.55, FLOOR + 1.06, dzk - 0.2), 0xfff0cc);
    K.add('paint', box(dx + 0.05, FLOOR + 0.76, dzk - 0.35, dx + 0.35, FLOOR + 0.77, dzk - 0.12), 0xf2efe6);
    chair(ctx, R, dx, dzk + 0.75, Math.PI);
    desks.push(V(dx, FLOOR, dzk + 0.75));
  }
  // filing cabinets down the right wall, the coffee on a table
  for (let z = dz - 2.2; z > z1 + 4.8; z -= 0.55) { K.add('paint', boxX(x1 - 0.05, x1 - 0.72, FLOOR, FLOOR + 1.32, z - 0.25, z + 0.25), 0x8a8e88); for (const y of [0.3, 0.65, 1.0]) K.add('metal', boxX(x1 - 0.72, x1 - 0.74, FLOOR + y, FLOOR + y + 0.04, z - 0.08, z + 0.08), 0xc8ccd0); }
  K.solid(...solidX(x1 - 0.05, x1 - 0.72, FLOOR, FLOOR + 1.32, z1 + 4.6, dz - 1.9), 'metal');
  K.add('paint', boxX(x0 + 0.05, x0 + 0.65, FLOOR, FLOOR + 0.8, dz - 4.0, dz - 5.2), 0x5a3a24);
  K.solid(x0 + 0.05, FLOOR, dz - 5.2, x0 + 0.65, FLOOR + 0.8, dz - 4.0, 'wood');
  K.put('espresso', x0 + 0.35, FLOOR + 0.8, dz - 4.6, Math.PI / 2);
  // the holding cell, across the back left: a bench, the bars and their door
  const cx1 = x0 + 4.6, cz0 = z1 + 3.4;
  K.add('paint', box(x0 + 0.05, FLOOR + 0.42, z1 + 0.05, x0 + 4.4, FLOOR + 0.47, z1 + 0.5), 0x6a6a62);
  K.solid(x0 + 0.05, FLOOR, z1 + 0.05, x0 + 4.4, FLOOR + 0.47, z1 + 0.5, 'metal');
  for (let x = x0 + 0.1; x < cx1; x += 0.14) K.add('iron', new THREE.CylinderGeometry(0.016, 0.016, R.ceil - FLOOR, 6).translate(x, (R.ceil + FLOOR) / 2, cz0), 0x3a3a3a);
  for (let z = cz0; z > z1; z -= 0.14) K.add('iron', new THREE.CylinderGeometry(0.016, 0.016, R.ceil - FLOOR, 6).translate(cx1, (R.ceil + FLOOR) / 2, z), 0x3a3a3a);
  for (const y of [0.15, 1.1, 2.1]) { K.add('iron', box(x0 + 0.05, FLOOR + y, cz0 - 0.03, cx1, FLOOR + y + 0.05, cz0 + 0.03), 0x3a3a3a); K.add('iron', box(cx1 - 0.03, FLOOR + y, z1, cx1 + 0.03, FLOOR + y + 0.05, cz0), 0x3a3a3a); }
  K.solid(x0, FLOOR, cz0 - 0.03, cx1, R.ceil, cz0 + 0.03, 'metal');
  K.solid(cx1 - 0.03, FLOOR, z1, cx1 + 0.03, R.ceil, cz0, 'metal');
  // the sergeant behind his desk; an officer at his typewriter
  R.post = { at: V(mid - 0.4, FLOOR, dz - 1.0), beat: [V(da + 1.0, FLOOR, dz - 1.0), V(db - 0.6, FLOOR, dz - 1.0)], yaw: 0 };
  for (const reg of R.T.regulars ?? []) { const at = desks[reg.desk ?? 0]; if (at) regular(ctx, R, reg, { at: at.clone(), yaw: Math.PI, sit: 0.46 }); }
  void rnd;
}

// St. Mary's emergency room: the triage desk across the back, rows of chairs facing it either side
// of the way in, the television up on the wall, the water cooler, a gurney waiting, the double doors
// through to the treatment rooms
function er(ctx, R) {
  const { K, x0, x1, z0, z1, cz, mid, aisle, ceil } = R;
  R.ca = Math.max(x0 + 0.8, mid - 3.0); R.cb = Math.min(x1 - 0.8, mid + 3.0);
  counter(ctx, R, { color: 0xdfe8ee, top: 0xffffff, h: 1.05, register: false, back: false });
  K.add('dark', box(R.ca + 0.6, FLOOR + 1.05, cz - 0.5, R.ca + 1.05, FLOOR + 1.4, cz - 0.15), 0x2a2e34); // a monitor (a terminal's)
  K.add('glow', box(R.ca + 0.62, FLOOR + 1.1, cz - 0.151, R.ca + 1.03, FLOOR + 1.36, cz - 0.148), 0x6ad8a0);
  for (let row = 0, z = cz + 2.2; row < 4 && z < z0 - 1.2; row++, z += 1.45) for (let k = 0, x = x0 + 1.2; x < x1 - 0.9; k++, x += 0.6) if (x + 0.35 < aisle[0] || x - 0.35 > aisle[1]) chair(ctx, R, x, z, Math.PI);
  // the television high on the far wall, the water cooler, the gurney
  const wall = R.doorLeft ? x1 : x0, sg = R.doorLeft ? -1 : 1;
  K.add('dark', boxX(wall + sg * 0.05, wall + sg * 0.5, ceil - 0.95, ceil - 0.45, cz + 3.6, cz + 4.3), 0x1a1a1a);
  K.add('glow', boxX(wall + sg * 0.5, wall + sg * 0.505, ceil - 0.9, ceil - 0.5, cz + 3.65, cz + 4.25), 0x8ab0d8);
  K.add('paint', boxX(wall + sg * 0.05, wall + sg * 0.4, FLOOR, FLOOR + 0.95, z0 - 1.4, z0 - 1.05), 0xf2f2ee);
  K.add('clearGlass', new THREE.CylinderGeometry(0.14, 0.14, 0.42, 14).translate(wall + sg * 0.22, FLOOR + 1.16, z0 - 1.22), 0x8ab8e0);
  K.solid(...solidX(wall + sg * 0.05, wall + sg * 0.4, FLOOR, FLOOR + 1.4, z0 - 1.4, z0 - 1.05), 'metal');
  const ow = R.doorLeft ? x0 : x1, og = -sg, gz = z1 + 1.4;
  K.add('paint', boxX(ow + og * 0.15, ow + og * 0.8, FLOOR + 0.78, FLOOR + 0.9, gz - 1.0, gz + 1.0), 0xe8eef0);
  K.add('metal', boxX(ow + og * 0.15, ow + og * 0.8, FLOOR + 0.7, FLOOR + 0.78, gz - 1.0, gz + 1.0), 0xc8ccd0);
  for (const [a, b] of [[0.2, -0.9], [0.75, -0.9], [0.2, 0.9], [0.75, 0.9]]) K.add('metal', new THREE.CylinderGeometry(0.015, 0.015, 0.62, 6).translate(ow + og * a, FLOOR + 0.39, gz + b), 0xc8ccd0);
  K.solid(...solidX(ow + og * 0.15, ow + og * 0.8, FLOOR, FLOOR + 0.9, gz - 1.0, gz + 1.0), 'metal');
  // the doors through, behind the desk's end: a pair with their little windows, the sign over them
  const tx = R.cb + 1.6;
  for (const [a, b] of [[tx - 0.8, tx], [tx, tx + 0.8]]) { K.add('paint', box(a + 0.02, FLOOR, z1 + 0.01, b - 0.02, FLOOR + 2.2, z1 + 0.06), 0xd8dde2); K.add('dark', box(a + 0.25, FLOOR + 1.35, z1 + 0.06, b - 0.25, FLOOR + 1.75, z1 + 0.065), 0x3a4a54); }
  ctx.labels.push({ M: R.M, u0: tx - 0.9, u1: tx + 0.9, y0: FLOOR + 2.3, h: 0.3, z: z1 + 0.06, sign: { text: 'TREATMENT · STAFF ONLY', style: 'board', bg: '#f2f2ee', fg: '#c0201b', font: 'condensed', wear: 0.05 } });
  // the doctor on his rounds, between those doors and the desk
  for (const reg of R.T.regulars ?? []) regular(ctx, R, reg, { at: V(tx, FLOOR, z1 + 0.9), yaw: 0, beat: [V(tx, FLOOR, z1 + 0.9), V(R.cb + 0.6, FLOOR, cz + 0.9)] });
}

// the Palms' lobby: the concession counter, the popcorn machine and the candy case on it, red carpet
// to it between brass posts and their ropes, posters of this week's pictures, the doors to the
// two theatres
function lobby(ctx, R) {
  const { K, x0, x1, z0, cz, ca, cb, mid, rnd } = R;
  K.add('paint', box(mid - 1.1, FLOOR, cz + 0.05, mid + 1.1, FLOOR + 0.008, z0 - 0.3), 0x8a1a22); // the carpet
  // the popcorn machine at one end of the counter, the candy case at the other
  const pa = ca + 0.7;
  K.add('paint', box(pa - 0.4, FLOOR + 1.0, cz - 0.55, pa + 0.4, FLOOR + 1.08, cz - 0.05), 0xb8322a);
  K.add('clearGlass', box(pa - 0.38, FLOOR + 1.08, cz - 0.53, pa + 0.38, FLOOR + 1.7, cz - 0.07), 0xffffff);
  K.add('paint', box(pa - 0.38, FLOOR + 1.7, cz - 0.55, pa + 0.38, FLOOR + 1.82, cz - 0.05), 0xb8322a);
  for (let i = 0; i < 60; i++) K.add('paint', box(0, 0, 0, 0.05, 0.04, 0.05).translate(pa - 0.33 + rnd() * 0.62, FLOOR + 1.09 + rnd() * rnd() * 0.3, cz - 0.5 + rnd() * 0.4), 0xf4e2a0);
  const cc = cb - 0.9;
  K.add('clearGlass', box(cc - 0.6, FLOOR + 1.0, cz - 0.5, cc + 0.6, FLOOR + 1.35, cz - 0.05), 0xffffff);
  for (let x = cc - 0.5; x < cc + 0.5; x += 0.13) for (const zz of [-0.4, -0.22]) K.add('paint', box(x, FLOOR + 1.01, cz + zz, x + 0.1, FLOOR + 1.05 + rnd() * 0.05, cz + zz + 0.14), [0xd02a3a, 0xf0c030, 0x3a6ad0, 0x6a3a1a, 0xf0f0e8][Math.floor(rnd() * 5)]);
  // the brass posts and their ropes, along the carpet
  for (const sx of [-1, 1]) {
    const px = mid + sx * 1.35, posts = [cz + 1.4, cz + 3.0, cz + 4.6];
    for (const pz of posts) { K.add('metal', new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8).translate(px, FLOOR + 0.48, pz), 0xc8a050); K.add('metal', new THREE.CylinderGeometry(0.16, 0.18, 0.04, 14).translate(px, FLOOR + 0.02, pz), 0xc8a050); K.add('metal', new THREE.SphereGeometry(0.045, 10, 8).translate(px, FLOOR + 0.98, pz), 0xc8a050); }
    for (let i = 0; i < posts.length - 1; i++) K.add('paint', new THREE.CylinderGeometry(0.022, 0.022, posts[i + 1] - posts[i], 8).rotateX(Math.PI / 2).translate(px, FLOOR + 0.82, (posts[i] + posts[i + 1]) / 2), 0x8a1a22);
  }
  // this week's pictures on the walls, the theatres' doors
  const films = [['THE LONG HORIZON', 'Now showing'], ['STARFALL', 'Now showing'], ['MIDNIGHT ON THE PIER', 'Saturday matinee'], ['ROCKET GIRLS', 'Coming soon']];
  for (const [i, [x, sg]] of [[x0, 1], [x1, -1]].entries()) {
    for (const [k, z] of [z0 - 1.6, z0 - 3.4].entries()) { const [t, sub] = films[i * 2 + k]; picture(ctx, R, x, sg, z, 1.0, 1.0, 1.5, { text: t, sub, style: 'lightbox', bg: ['#1a1a3a', '#3a1a1a', '#1a3a2a', '#2a1a3a'][i * 2 + k], fg: '#ffd23f', accent: '#ffffff', font: 'deco', wear: 0.05 }); }
    const dz = cz + 2.6;
    K.add('paint', boxX(x + sg * 0.01, x + sg * 0.06, FLOOR, FLOOR + 2.3, dz - 0.9, dz + 0.9), 0x6a1a1a);
    for (const dzz of [-0.45, 0.45]) K.add('metal', boxX(x + sg * 0.06, x + sg * 0.08, FLOOR + 1.0, FLOOR + 1.05, dz + dzz - 0.15, dz + dzz + 0.15), 0xc8a050);
    picture(ctx, R, x, sg, dz, 2.45, 1.3, 0.28, { text: `THEATRE ${i + 1}`, style: 'lightbox', bg: '#1a0a0a', fg: '#ffd23f', font: 'deco', wear: 0.05 });
  }
}

// Tony's oven on the back wall behind the counter: a brick dome, its mouth glowing, a hood over it;
// two pies on the counter
function oven(ctx, R) {
  const { K, z1, cz, mid, ca, cb } = R;
  const ox = R.doorLeft ? cb - 1.1 : ca + 1.1;
  K.add('brick', box(ox - 0.85, FLOOR, z1 + 0.02, ox + 0.85, FLOOR + 1.85, z1 + 1.0), 0xffffff);
  K.add('dark', box(ox - 0.35, FLOOR + 0.95, z1 + 0.99, ox + 0.35, FLOOR + 1.3, z1 + 1.005), 0x1a0d08);
  K.add('glow', box(ox - 0.3, FLOOR + 0.96, z1 + 0.6, ox + 0.3, FLOOR + 1.0, z1 + 0.98), 0xff7a2a);
  K.add('metal', box(ox - 0.95, FLOOR + 2.3, z1 + 0.02, ox + 0.95, FLOOR + 2.7, z1 + 1.1), 0xb8bcc0);
  K.solid(ox - 0.85, FLOOR, z1 + 0.02, ox + 0.85, FLOOR + 1.85, z1 + 1.0, 'stone');
  for (const dx of [-0.6, 0.6]) {
    const px = mid + dx * 0.9;
    K.add('metal', new THREE.CylinderGeometry(0.24, 0.24, 0.01, 20).translate(px, FLOOR + 1.005, cz - 0.32), 0xc8ccd0);
    K.add('paint', new THREE.CylinderGeometry(0.22, 0.22, 0.025, 20).translate(px, FLOOR + 1.02, cz - 0.32), 0xd8a050);
    K.add('paint', new THREE.CylinderGeometry(0.19, 0.19, 0.008, 20).translate(px, FLOOR + 1.037, cz - 0.32), 0xb83a22);
  }
}

// desks across the room, a chair either side (the agent's or the bondswoman's behind the first),
// lettered posters on the walls, a globe on a stand for the travel agent
function desks(ctx, R) {
  const { K, x0, x1, z1, aisle, T } = R;
  const z = z1 + 2.6, spots = [];
  for (let x = x0 + 1.5; x < x1 - 1.2 && spots.length < 3; x += 2.9) if (x + 0.9 < aisle[0] || x - 0.9 > aisle[1]) spots.push(x);
  const seats = [];
  for (const x of spots) {
    K.add('paint', box(x - 0.75, FLOOR + 0.72, z - 0.4, x + 0.75, FLOOR + 0.76, z + 0.4), 0x6a4a32);
    K.add('paint', box(x - 0.72, FLOOR, z - 0.37, x + 0.72, FLOOR + 0.72, z - 0.3), 0x5a3a24);
    K.solid(x - 0.75, FLOOR, z - 0.4, x + 0.75, FLOOR + 0.76, z + 0.4, 'wood');
    K.add('dark', box(x + 0.35, FLOOR + 0.76, z - 0.3, x + 0.57, FLOOR + 0.84, z - 0.12), 0x141414);
    K.add('paint', box(x - 0.4, FLOOR + 0.76, z - 0.1, x - 0.05, FLOOR + 0.775, z + 0.25), 0xf2efe6);
    chair(ctx, R, x, z - 0.72, 0);
    chair(ctx, R, x - 0.35, z + 0.72, Math.PI); chair(ctx, R, x + 0.35, z + 0.72, Math.PI);
    seats.push(V(x, FLOOR, z - 0.72));
  }
  const wall = R.doorLeft ? x1 : x0, sg = R.doorLeft ? -1 : 1, near = R.doorLeft ? x0 : x1;
  (T.posters ?? []).forEach((t, k) => picture(ctx, R, k % 2 ? near : wall, k % 2 ? -sg : sg, R.z0 - 2.2 - Math.floor(k / 2) * 2.6, 1.15, 1.1, 1.4, { text: t, style: 'board', bg: ['#1d6f8a', '#d8602a', '#2a3a5a', '#f7d21e'][k % 4], fg: '#ffffff', accent: '#ffd23f', font: 'deco', wear: 0.1 }));
  if (R.r.kind === 'travel') {
    const gx = wall + sg * 0.8, gz = z1 + 0.9;
    K.add('paint', new THREE.SphereGeometry(0.26, 20, 14).translate(gx, FLOOR + 1.0, gz), 0x3a7ab0);
    K.add('metal', new THREE.TorusGeometry(0.29, 0.012, 6, 24).translate(gx, FLOOR + 1.0, gz), 0xc8a050);
    K.add('paint', new THREE.CylinderGeometry(0.03, 0.18, 0.72, 10).translate(gx, FLOOR + 0.36, gz), 0x5a3a24);
    K.solid(gx - 0.3, FLOOR, gz - 0.3, gx + 0.3, FLOOR + 1.3, gz + 0.3, 'wood');
  }
  // the one who works there at the first desk
  const at = seats[T.staff.desk ?? 0] ?? seats[0];
  if (at) R.post = { at: at.clone(), yaw: 0, sit: 0.46 };
}

// racks of clothes down the room (a rail on two uprights, the garments hanging along it), a shelf of
// odds and ends on the wall
function racks(ctx, R) {
  const { K, x0, x1, z0, cz, aisle, rnd } = R;
  const cloth = [0x2a3a5a, 0x8a2a22, 0xd8c8a0, 0x3a5a3a, 0x6a4a7a, 0xe0e0d8, 0x1a1a1a, 0xc8702a, 0x4a6a8a, 0x8a6a4a];
  for (let z = z0 - 1.6; z > cz + 1.6; z -= 1.7) for (let x = x0 + 1.4; x < x1 - 1.2; x += 2.9) {
    if (x + 1.3 > aisle[0] && x - 1.3 < aisle[1]) continue;
    for (const dx of [-1.15, 1.15]) K.add('metal', new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6).translate(x + dx, FLOOR + 0.75, z), 0xc8ccd0);
    K.add('metal', new THREE.CylinderGeometry(0.015, 0.015, 2.3, 6).rotateZ(Math.PI / 2).translate(x, FLOOR + 1.5, z), 0xc8ccd0);
    for (let u = x - 1.08; u < x + 1.08; u += 0.07 + rnd() * 0.04) {
      const h = 0.7 + rnd() * 0.35;
      K.add('paint', box(u - 0.025, FLOOR + 1.47 - h, z - 0.24, u + 0.025, FLOOR + 1.45, z + 0.24), cloth[Math.floor(rnd() * cloth.length)]);
    }
    K.solid(x - 1.2, FLOOR, z - 0.28, x + 1.2, FLOOR + 1.52, z + 0.28, 'metal');
  }
  const wall = R.doorLeft ? x1 : x0, sg = R.doorLeft ? -1 : 1;
  K.put('wallshelf', wall + sg * 0.35, FLOOR, (z0 + cz) / 2, sg > 0 ? Math.PI / 2 : -Math.PI / 2);
}

// the cleaner's: the counter, and behind it the garments in their bags on the rail
function conveyor(ctx, R) {
  const { K, ca, cb, cz, z1, rnd } = R;
  const z = (cz - 0.65 + z1) / 2 - 0.1;
  K.add('metal', new THREE.CylinderGeometry(0.018, 0.018, cb - ca, 6).rotateZ(Math.PI / 2).translate((ca + cb) / 2, FLOOR + 2.05, z), 0xc8ccd0);
  for (const x of [ca + 0.1, cb - 0.1]) K.add('metal', new THREE.CylinderGeometry(0.02, 0.02, R.ceil - FLOOR - 2.05, 6).translate(x, (R.ceil + FLOOR + 2.05) / 2, z), 0xc8ccd0);
  for (let u = ca + 0.2; u < cb - 0.2; u += 0.09 + rnd() * 0.03) {
    const h = 0.9 + rnd() * 0.3;
    K.add('paint', box(u - 0.03, FLOOR + 2.0 - h, z - 0.26, u + 0.03, FLOOR + 2.0, z + 0.26), [0xd8dde6, 0xe2e4ea, 0xcfd6e0, 0xe8e0d8][Math.floor(rnd() * 4)]);
  }
}

// the bookshop: tall cases down both walls and two free-standing ones in the room, every shelf full
function bookcases(ctx, R) {
  const { K, x0, x1, z0, cz, aisle, rnd } = R;
  const spine = [0x6a1a1a, 0x1a3a5a, 0x2a4a2a, 0xd8c8a0, 0x3a2a1a, 0x8a6a2a, 0x4a2a4a, 0xc8b878, 0x1a1a1a, 0x7a3a1a, 0x5a6a7a];
  const books = (xa, xb, za, zb, along) => {
    for (const y of [0.1, 0.52, 0.94, 1.36, 1.78]) {
      if (along === 'z') for (let z = za; z > zb;) { const w = 0.025 + rnd() * 0.04, h = 0.2 + rnd() * 0.12; K.add('paint', box(xa, FLOOR + y, z - w, xb, FLOOR + y + h, z), spine[Math.floor(rnd() * spine.length)]); z -= w + 0.004; }
      else for (let x = xa; x < xb;) { const w = 0.025 + rnd() * 0.04, h = 0.2 + rnd() * 0.12; K.add('paint', box(x, FLOOR + y, za, x + w, FLOOR + y + h, zb), spine[Math.floor(rnd() * spine.length)]); x += w + 0.004; }
    }
  };
  const za = z0 - 0.9, zb = cz + 1.0;
  for (const [x, sg] of [[x0, 1], [x1, -1]]) {
    const [xa, xb] = span(x + sg * 0.02, x + sg * 0.36);
    K.add('paint', box(xa, FLOOR, zb, xb, FLOOR + 2.2, za), 0x4a2e1c);
    for (const y of [0.08, 0.5, 0.92, 1.34, 1.76, 2.18]) K.add('paint', box(xa, FLOOR + y, zb, xb + (sg < 0 ? 0 : 0.01), FLOOR + y + 0.02, za), 0x5a3a24);
    K.solid(xa, FLOOR, zb, xb, FLOOR + 2.2, za, 'wood');
    const [ba, bb] = span(x + sg * 0.06, x + sg * 0.32);
    books(ba, bb, za - 0.05, zb + 0.05, 'z');
  }
  for (const x of [R.mid - 2.4, R.mid + 2.4]) {
    if (x + 0.4 > aisle[0] && x - 0.4 < aisle[1]) continue;
    const zz0 = z0 - 2.2, zz1 = Math.max(cz + 1.8, z0 - 6.4);
    K.add('paint', box(x - 0.36, FLOOR, zz1, x + 0.36, FLOOR + 1.6, zz0), 0x4a2e1c);
    K.solid(x - 0.36, FLOOR, zz1, x + 0.36, FLOOR + 1.6, zz0, 'wood');
    for (const sx of [-1, 1]) { const [ba, bb] = span(x + sx * 0.36, x + sx * 0.1); for (const y of [0.1, 0.52, 0.94]) { for (let z = zz0 - 0.05; z > zz1 + 0.05;) { const w = 0.025 + rnd() * 0.04, h = 0.2 + rnd() * 0.12; K.add('paint', box(ba, FLOOR + y, z - w, bb, FLOOR + y + h, z), spine[Math.floor(rnd() * spine.length)]); z -= w + 0.004; } } }
  }
}

// the TV shop: sets on shelves down the walls with their screens on, three in the window facing the
// street, a console set on the floor, radios on a table
function tvs(ctx, R) {
  const { K, x0, x1, z0, cz, rnd } = R;
  const screen = [0x8ab0d8, 0xb8c0c8, 0x7ad0a0, 0xd8b0a0, 0x9aa8e0];
  const set = (x, y, z, sg, big = false) => {
    const w = big ? 0.7 : 0.5, h = big ? 0.55 : 0.4;
    K.add('dark', boxX(x, x + sg * 0.42, y, y + h, z - w / 2, z + w / 2), 0x3a3a3a);
    K.add('glow', boxX(x + sg * 0.42, x + sg * 0.425, y + 0.06, y + h - 0.08, z - w / 2 + 0.06, z + w / 2 - 0.12), screen[Math.floor(rnd() * screen.length)]);
  };
  for (const [x, sg] of [[x0, 1], [x1, -1]]) {
    const near = x === (R.doorLeft ? x0 : x1); // (the door's wall: its shelves start further in)
    const za = z0 - (near ? 2.4 : 1.0), zb = cz + 1.0;
    for (const y of [0.45, 1.05, 1.65]) { K.add('paint', boxX(x + sg * 0.02, x + sg * 0.5, FLOOR + y - 0.04, FLOOR + y, zb, za), 0x6a6a62); for (let z = za - 0.35; z > zb + 0.3; z -= 0.62) set(x + sg * 0.04, FLOOR + y, z, sg); }
    K.solid(...solidX(x + sg * 0.02, x + sg * 0.5, FLOOR, FLOOR + 2.1, zb, za), 'metal');
  }
  // in the window, on a riser, facing out
  const wa = R.doorLeft ? R.aisle[1] + 0.4 : x0 + 0.6, wb = R.doorLeft ? x1 - 0.6 : R.aisle[0] - 0.4;
  K.add('paint', box(wa, FLOOR, z0 - 0.95, wb, FLOOR + 0.45, z0 - 0.15), 0x2a2a2e);
  K.solid(wa, FLOOR, z0 - 0.95, wb, FLOOR + 0.45, z0 - 0.15, 'wood');
  for (let x = wa + 0.45, i = 0; x < wb - 0.3 && i < 4; x += 1.2, i++) {
    K.add('dark', box(x - 0.35, FLOOR + 0.45, z0 - 0.85, x + 0.35, FLOOR + 1.0, z0 - 0.45), 0x3a3a3a);
    K.add('glow', box(x - 0.28, FLOOR + 0.52, z0 - 0.45, x + 0.22, FLOOR + 0.92, z0 - 0.445), screen[i % screen.length]);
  }
  // a console set, radios on a table
  const cx = R.mid + (R.doorLeft ? -1.6 : 1.6), cz2 = (z0 + cz) / 2;
  K.add('paint', box(cx - 0.6, FLOOR, cz2 - 0.25, cx + 0.6, FLOOR + 0.82, cz2 + 0.25), 0x6a4a2a);
  K.add('glow', box(cx - 0.32, FLOOR + 0.4, cz2 + 0.25, cx + 0.2, FLOOR + 0.75, cz2 + 0.255), 0x8ab0d8);
  K.solid(cx - 0.6, FLOOR, cz2 - 0.25, cx + 0.6, FLOOR + 0.82, cz2 + 0.25, 'wood');
}

// the salon's hood dryers along the near wall, a chair under each
function dryers(ctx, R) {
  const { K, z0, cz } = R;
  const wall = R.doorLeft ? R.x0 : R.x1, sg = R.doorLeft ? 1 : -1;
  for (let z = z0 - 3.4; z > cz + 1.0; z -= 1.1) {
    chair(ctx, R, wall + sg * 0.45, z, sg > 0 ? Math.PI / 2 : -Math.PI / 2);
    K.add('metal', new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6).translate(wall + sg * 0.12, FLOOR + 0.55, z), 0xc8ccd0);
    K.add('paint', new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1).translate(wall + sg * 0.38, FLOOR + 1.15, z), 0xf0c0cc);
    K.solid(...solidX(wall + sg * 0.05, wall + sg * 0.7, FLOOR, FLOOR + 1.4, z - 0.3, z + 0.3), 'metal');
  }
}

// Iron Beach: a ring at the back, the heavy bags hanging, benches and a barbell, the dumbbells on
// their rack, mirrors down the wall
function gym(ctx, R) {
  const { K, x0, x1, z0, z1, cz, ceil, aisle } = R;
  const left = !R.doorLeft; // (the ring at the back on the door's side: the desk's across the other half)
  const rx0 = left ? R.mid + 1.2 : x0 + 1.0, rx1 = rx0 + 5.0, rz1 = z1 + 0.6, rz0 = rz1 + 5.0;
  const top = FLOOR + 0.6;
  K.add('paint', box(rx0, FLOOR, rz1, rx1, top - 0.03, rz0), 0x2a4a8a);
  K.add('paint', box(rx0 - 0.1, top - 0.03, rz1 - 0.1, rx1 + 0.1, top, rz0 + 0.1), 0xe8e2d4);
  K.solid(rx0 - 0.1, FLOOR, rz1 - 0.1, rx1 + 0.1, top, rz0 + 0.1, 'wood');
  const corners = [[rx0, rz1], [rx1, rz1], [rx1, rz0], [rx0, rz0]];
  for (const [x, z] of corners) K.add('metal', new THREE.CylinderGeometry(0.06, 0.06, 1.35, 10).translate(x, top + 0.67, z), 0xc8ccd0);
  for (const [k, y] of [0.45, 0.8, 1.15].entries()) for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], len = Math.hypot(bx - ax, bz - az);
    K.add('paint', new THREE.CylinderGeometry(0.02, 0.02, len, 6).rotateZ(Math.PI / 2).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, top + y, (az + bz) / 2), [0xc0201b, 0xf2f0e8, 0x1f4f9a][k]);
  }
  // heavy bags, from chains
  for (const [i, bx] of [R.mid + (left ? -2.0 : 2.0), R.mid + (left ? -4.0 : 4.0)].entries()) {
    const bz = z0 - 2.2 - i * 0.4;
    if (bx < x0 + 0.6 || bx > x1 - 0.6 || (bx > aisle[0] - 0.4 && bx < aisle[1] + 0.4)) continue;
    K.add('paint', new THREE.CylinderGeometry(0.18, 0.17, 1.0, 14).translate(bx, FLOOR + 1.1, bz), 0x8a1a1a);
    K.add('metal', new THREE.CylinderGeometry(0.008, 0.008, ceil - FLOOR - 1.6, 4).translate(bx, (ceil + FLOOR + 1.6) / 2, bz), 0x8a8e92);
    K.solid(bx - 0.18, FLOOR + 0.6, bz - 0.18, bx + 0.18, FLOOR + 1.6, bz + 0.18, 'wood');
  }
  // a bench with its barbell on the uprights, and the plates
  const ex = left ? x0 + 2.2 : x1 - 2.2, ez = (z0 + cz) / 2 + 0.6;
  if (!(ex > aisle[0] - 1.2 && ex < aisle[1] + 1.2)) {
    K.add('paint', box(ex - 0.15, FLOOR + 0.38, ez - 0.6, ex + 0.15, FLOOR + 0.45, ez + 0.6), 0x1a1a1a);
    K.add('metal', box(ex - 0.04, FLOOR, ez - 0.4, ex + 0.04, FLOOR + 0.38, ez + 0.4), 0x3a3a3a);
    for (const dx of [-0.32, 0.32]) K.add('metal', box(ex + dx - 0.03, FLOOR, ez - 0.6, ex + dx + 0.03, FLOOR + 1.05, ez - 0.54), 0x3a3a3a);
    K.add('metal', new THREE.CylinderGeometry(0.014, 0.014, 1.8, 8).rotateZ(Math.PI / 2).translate(ex, FLOOR + 1.07, ez - 0.57), 0xc8ccd0);
    for (const dx of [-0.75, -0.68, 0.68, 0.75]) K.add('dark', new THREE.CylinderGeometry(0.22, 0.22, 0.05, 18).rotateZ(Math.PI / 2).translate(ex + dx, FLOOR + 1.07, ez - 0.57), 0x1a1a1a);
    K.solid(ex - 0.4, FLOOR, ez - 0.65, ex + 0.4, FLOOR + 1.1, ez + 0.6, 'metal');
  }
  // mirrors down the near wall, the dumbbells on their rack below them
  const wall = R.doorLeft ? x1 : x0, sg = R.doorLeft ? -1 : 1;
  K.add('metal', boxX(wall + sg * 0.02, wall + sg * 0.04, FLOOR + 0.6, FLOOR + 2.2, cz + 0.8, z0 - 1.0), 0xd8dde2);
  K.add('paint', boxX(wall + sg * 0.05, wall + sg * 0.55, FLOOR + 0.4, FLOOR + 0.45, cz + 1.2, cz + 4.2), 0x2a2a2a);
  for (let z = cz + 1.35; z < cz + 4.1; z += 0.3) { const r = 0.05 + ((z * 7) % 1) * 0.04; for (const dx of [0.12, 0.42]) K.add('dark', new THREE.CylinderGeometry(r, r, 0.05, 12).rotateX(Math.PI / 2).translate(wall + sg * dx, FLOOR + 0.45 + r, z), 0x1a1a1a); K.add('metal', new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6).rotateZ(Math.PI / 2).translate(wall + sg * 0.27, FLOOR + 0.45 + r, z), 0xc8ccd0); }
  K.solid(...solidX(wall + sg * 0.05, wall + sg * 0.6, FLOOR, FLOOR + 0.6, cz + 1.2, cz + 4.2), 'metal');
}

// Ocean Market: the produce along the far wall in tilted crates, gondolas in from it, coolers across
// the back beside the counter
function grocer(ctx, R) {
  const { K, x0, x1, z0, z1, cz, cb, aisle, M, rnd } = R;
  const wall = R.doorLeft ? x1 : x0, sg = R.doorLeft ? -1 : 1;
  const fruit = [0xc0201b, 0xf08030, 0xf0d040, 0x5a9a3a, 0x8a2a5a, 0xe8c878];
  for (let z = z0 - 1.0; z > cz + 1.2; z -= 0.9) {
    K.add('paint', boxX(wall + sg * 0.05, wall + sg * 0.95, FLOOR, FLOOR + 0.62, z - 0.42, z + 0.42), 0x6a4a2a);
    K.add('paint', new THREE.BoxGeometry(0.85, 0.1, 0.8).rotateZ(-sg * 0.35).translate(wall + sg * 0.5, FLOOR + 0.78, z), 0x8a6a3a);
    const col = fruit[Math.floor(rnd() * fruit.length)];
    for (let i = 0; i < 16; i++) { const u = rnd(), v = rnd() - 0.5; K.add('paint', new THREE.SphereGeometry(0.045, 8, 6).translate(wall + sg * (0.15 + u * 0.7), FLOOR + 0.86 + (1 - u) * 0.28, z + v * 0.7), col); }
  }
  K.solid(...solidX(wall + sg * 0.05, wall + sg * 0.95, FLOOR, FLOOR + 1.0, cz + 0.7, z0 - 0.5), 'wood');
  for (let x = wall + sg * 2.8; sg > 0 ? x < x1 - 1.4 : x > x0 + 1.4; x += sg * 2.4) if (x + 0.6 < aisle[0] || x - 0.6 > aisle[1]) gondola(ctx, M, x, z0 - 1.6, Math.max(cz + 1.5, z0 - 1.6 - 6));
  const [ka, kb] = R.doorLeft ? [x0 + 0.7, R.ca - 0.9] : [cb + 0.9, x1 - 0.7]; // (across the back beside the counter)
  for (let x = ka; x < kb; x += 1.1) { if (x > aisle[0] - 0.5 && x < aisle[1] + 0.5) continue; K.put('cooler', x, FLOOR, z1 + 0.45, 0); }
}

// boxes and solids along x (for the side walls' fittings, whichever side): the x extent in either order
function boxX(xa, xb, y0, y1, za, zb) { const [a, b] = span(xa, xb), [c, d] = span(za, zb); return box(a, y0, c, b, y1, d); }
function solidX(xa, xb, y0, y1, za, zb) { const [a, b] = span(xa, xb), [c, d] = span(za, zb); return [a, y0, c, b, y1, d]; }
