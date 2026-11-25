// What the shops sell, on their shelves (the user, 2026-11-24: "make the interactable shops even more interactive.
// Get some more assets for products like bread, chips"): downloaded products (CREDITS.md; tools/build-props.mjs,
// tools/prep-products.mjs), each stocked the way a store does it, in facings: a run of the same thing side by side,
// two or three deep, stacked where it's short. The fit-outs (city/Interiors.js, city/Shops.js) place them with
// `stockRow` as the block's built; what's drawn:
//   - far off, or before the products have loaded, each one as the plain labelled box or can the shelves always
//     had (two instanced draws for the whole block, as before)
//   - with the camera in a shop or at its window, its stock as itself: one batched draw a material
//     (city/Lod.js BatchSet), no shadows; the products load the first time the camera comes near a shop
//   - knocked off (Hal running or flying into a shelf, the ring's constructs, a blow, a car through the window,
//     another item falling into it): from then a body of its own (props/Smash.js 'loose', its real weight), drawn as
//     itself while it moves and back in the batch where it comes to rest; a bottle that lands hard breaks
//   - taken (story/Shopping.js): out of the batch and into his hand.
import * as THREE from 'three';
import { loadProps, prop as propCopy } from '../props/Props.js';
import { BatchSet } from './Lod.js';
import { goodsTexture } from './Signs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HALF_PI = Math.PI / 2;
const seeded = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ----------------------------------------------------------------------------------------- the products
// prop: the model (public/models/props), part: its piece of a kit (a mesh's name or an ancestor's), h: its height on
// the shelf (it's scaled to it), size: [w, h, d] as it stands (for stocking before the models have loaded; checked
// against the model's when they have), rot: turned in its own frame first (a tool laid flat), squash: scaled
// unevenly (a crisp bag's air let out to shelf depth). name / short: for Hal's prompts and the till; kind: 'food'
// (eaten on the spot or kept), 'drink', 'grocery' (kept: a can wants an opener, an onion a kitchen), 'thing';
// heal: what eating it does; mass (kg); glass: it breaks if it lands hard; carry: 'palm' (on his hand) or 'both'.
export const PRODUCTS = {
  // packaged food
  chipsA: { prop: 'snackbags', part: /^package_01/, h: 0.28, size: [0.18, 0.28, 0.08], name: 'a bag of chips', short: 'chips', price: 0.35, kind: 'food', heal: 4, mass: 0.1, carry: 'palm', lie: true, shape: 'box' },
  chipsB: { prop: 'snackbags', part: /^package_02/, h: 0.28, size: [0.18, 0.28, 0.08], name: 'a bag of chips', short: 'chips', price: 0.35, kind: 'food', heal: 4, mass: 0.1, carry: 'palm', lie: true, shape: 'box' },
  chipsC: { prop: 'snackbags', part: /^package_03/, h: 0.28, size: [0.18, 0.28, 0.08], name: 'a bag of chips', short: 'chips', price: 0.35, kind: 'food', heal: 4, mass: 0.1, carry: 'palm', lie: true, shape: 'box' },
  tortilla: { prop: 'chipbag', h: 0.26, squash: [1, 1, 0.55], size: [0.21, 0.26, 0.1], name: 'a bag of tortilla chips', short: 'tortilla chips', price: 0.89, kind: 'food', heal: 6, mass: 0.2, carry: 'palm', lie: true, shape: 'box' },
  cereal: { prop: 'cereal', h: 0.30, size: [0.21, 0.30, 0.07], name: 'a box of cereal', short: 'cereal', price: 2.49, kind: 'food', heal: 8, mass: 0.4, carry: 'palm', lie: true, shape: 'box' },
  candyMilk: { prop: 'candybars', part: /pCube19_phong2/, h: 0.012, size: [0.14, 0.012, 0.05], fitW: true, name: 'a candy bar', short: 'candy bar', price: 0.35, kind: 'food', heal: 4, mass: 0.05, carry: 'palm', shape: 'box', flat: true },
  candyDark: { prop: 'candybars', part: /pCube18_phong3/, h: 0.027, size: [0.14, 0.027, 0.055], fitW: true, name: 'a dark chocolate bar', short: 'chocolate', price: 0.45, kind: 'food', heal: 4, mass: 0.05, carry: 'palm', shape: 'box', flat: true },
  candyToffee: { prop: 'candybars', part: /pCube20_phong4/, h: 0.012, size: [0.14, 0.012, 0.05], fitW: true, name: 'a toffee bar', short: 'toffee', price: 0.35, kind: 'food', heal: 4, mass: 0.05, carry: 'palm', shape: 'box', flat: true },
  milk: { prop: 'groceries', part: /_milk$/, h: 0.24, size: [0.10, 0.24, 0.07], name: 'a carton of milk', short: 'milk', price: 0.89, kind: 'drink', heal: 6, mass: 1.0, carry: 'palm', lie: true, shape: 'box' },
  tomatoes: { prop: 'groceries', part: /_tomatoes$/, h: 0.12, size: [0.11, 0.12, 0.11], name: 'a can of tomatoes', short: 'tomatoes', price: 0.69, kind: 'grocery', heal: 0, mass: 0.45, carry: 'palm', shape: 'can' },
  beans: { prop: 'groceries', part: /_beans$/, h: 0.13, size: [0.08, 0.13, 0.08], name: 'a can of beans', short: 'beans', price: 0.59, kind: 'grocery', heal: 0, mass: 0.45, carry: 'palm', shape: 'can' },
  sardines: { prop: 'groceries', part: /_sardines$/, h: 0.03, size: [0.13, 0.03, 0.08], name: 'a tin of sardines', short: 'sardines', price: 0.99, kind: 'grocery', heal: 0, mass: 0.13, carry: 'palm', shape: 'box', flat: true },
  cigarettes: { prop: 'cigarettes', h: 0.095, size: [0.052, 0.095, 0.027], name: 'a pack of cigarettes', short: 'cigarettes', price: 1.75, kind: 'thing', mass: 0.03, carry: 'palm', shape: 'box' },
  // drinks
  soda1: { prop: 'sodacans', part: /^Soda_1_/, h: 0.122, size: [0.066, 0.122, 0.066], name: 'a can of soda', short: 'soda', price: 0.60, kind: 'drink', heal: 3, mass: 0.37, carry: 'palm', shape: 'can' },
  soda2: { prop: 'sodacans', part: /^Soda_2_/, h: 0.122, size: [0.066, 0.122, 0.066], name: 'a can of soda', short: 'soda', price: 0.60, kind: 'drink', heal: 3, mass: 0.37, carry: 'palm', shape: 'can' },
  soda3: { prop: 'sodacans', part: /^Soda_3_/, h: 0.122, size: [0.066, 0.122, 0.066], name: 'a can of soda', short: 'soda', price: 0.60, kind: 'drink', heal: 3, mass: 0.37, carry: 'palm', shape: 'can' },
  soda4: { prop: 'sodacans', part: /^Soda_4_/, h: 0.122, size: [0.066, 0.122, 0.066], name: 'a can of soda', short: 'soda', price: 0.60, kind: 'drink', heal: 3, mass: 0.37, carry: 'palm', shape: 'can' },
  soda5: { prop: 'sodacans', part: /^Soda_5_/, h: 0.122, size: [0.066, 0.122, 0.066], name: 'a can of soda', short: 'soda', price: 0.60, kind: 'drink', heal: 3, mass: 0.37, carry: 'palm', shape: 'can' },
  dietsoda: { prop: 'dietsoda', h: 0.122, size: [0.066, 0.122, 0.066], name: 'a diet soda', short: 'diet soda', price: 0.60, kind: 'drink', heal: 2, mass: 0.37, carry: 'palm', shape: 'can' },
  beercan: { prop: 'beercan', h: 0.157, size: [0.064, 0.157, 0.064], name: 'a tall can of beer', short: 'beer', price: 0.99, kind: 'drink', heal: 0, beer: true, mass: 0.5, carry: 'palm', shape: 'can' },
  beer: { prop: 'beerbottle', h: 0.23, size: [0.064, 0.23, 0.065], name: 'a bottle of beer', short: 'beer', price: 0.85, kind: 'drink', heal: 0, beer: true, mass: 0.55, carry: 'palm', lie: true, glass: true, shape: 'can' },
  wineRed: { prop: 'wine', part: /^Circle(_\d)?$/, h: 0.30, size: [0.075, 0.30, 0.075], name: 'a bottle of wine', short: 'wine', price: 5.99, kind: 'thing', mass: 1.3, carry: 'palm', lie: true, glass: true, shape: 'can' },
  wineWhite: { prop: 'wine', part: /^Circle005/, h: 0.31, size: [0.075, 0.31, 0.075], name: 'a bottle of white wine', short: 'wine', price: 5.49, kind: 'thing', mass: 1.3, carry: 'palm', lie: true, glass: true, shape: 'can' },
  wineRose: { prop: 'wine', part: /^Circle008/, h: 0.30, size: [0.08, 0.30, 0.08], name: 'a bottle of rosé', short: 'rosé', price: 4.99, kind: 'thing', mass: 1.3, carry: 'palm', lie: true, glass: true, shape: 'can' },
  wineGreen: { prop: 'wine', part: /^Circle012/, h: 0.30, size: [0.08, 0.30, 0.08], name: 'a bottle of wine', short: 'wine', price: 6.49, kind: 'thing', mass: 1.3, carry: 'palm', lie: true, glass: true, shape: 'can' },
  whiskey: { prop: 'liquor', part: /Material002/, h: 0.29, size: [0.12, 0.29, 0.12], name: 'a bottle of whiskey', short: 'whiskey', price: 9.99, kind: 'thing', mass: 1.2, carry: 'palm', lie: true, glass: true, shape: 'box' },
  rum: { prop: 'liquor', part: /Material001/, h: 0.29, size: [0.095, 0.29, 0.095], name: 'a bottle of rum', short: 'rum', price: 8.49, kind: 'thing', mass: 1.2, carry: 'palm', lie: true, glass: true, shape: 'box' },
  gin: { prop: 'liquor', part: /Material003/, h: 0.30, size: [0.123, 0.30, 0.123], name: 'a bottle of gin', short: 'gin', price: 7.99, kind: 'thing', mass: 1.2, carry: 'palm', lie: true, glass: true, shape: 'can' },
  port: { prop: 'port', h: 0.30, size: [0.11, 0.30, 0.11], name: 'a bottle of port', short: 'port', price: 7.99, kind: 'thing', mass: 1.3, carry: 'palm', lie: true, glass: true, shape: 'can' },
  glass: { prop: 'tumbler', h: 0.14, size: [0.09, 0.14, 0.09], name: 'a glass', short: 'glass', price: 0, kind: 'thing', mass: 0.3, carry: 'palm', glass: true, shape: 'can', clear: true },
  glassDown: { prop: 'tumbler', h: 0.14, rot: [Math.PI, 0, 0], size: [0.09, 0.14, 0.09], name: 'a glass', short: 'glass', price: 0, kind: 'thing', mass: 0.3, carry: 'palm', glass: true, shape: 'can', clear: true },
  // baked
  concha: { prop: 'breads', part: /^Bread_Roll_Bread/, h: 0.05, size: [0.094, 0.05, 0.094], name: 'a concha', short: 'concha', price: 0.60, kind: 'food', heal: 8, mass: 0.08, carry: 'palm', shape: 'box' },
  bagel: { prop: 'breads', part: /^Sweet_Bread_Roll/, h: 0.04, size: [0.125, 0.04, 0.14], name: 'a sesame bagel', short: 'bagel', price: 0.35, kind: 'food', heal: 6, mass: 0.09, carry: 'palm', shape: 'box' },
  roll: { prop: 'breads', part: /^Bread_Roll_2/, h: 0.045, size: [0.10, 0.045, 0.10], name: 'a bolillo', short: 'roll', price: 0.25, kind: 'food', heal: 5, mass: 0.07, carry: 'palm', shape: 'box' },
  nutbread: { prop: 'breads', part: /^Nut_Bread/, h: 0.08, size: [0.15, 0.08, 0.085], name: 'a loaf of seeded bread', short: 'seeded loaf', price: 1.49, kind: 'grocery', heal: 15, mass: 0.5, carry: 'palm', shape: 'box' },
  loaf: { prop: 'breads', part: /^Loaf_of_Bread001/, h: 0.10, size: [0.20, 0.10, 0.18], name: 'a loaf of bread', short: 'bread', price: 1.29, kind: 'grocery', heal: 15, mass: 0.5, carry: 'both', shape: 'box' },
  boule: { prop: 'breads', part: /^Loaf_of_Bread_Loaf/, h: 0.095, size: [0.30, 0.095, 0.185], name: 'a country loaf', short: 'country loaf', price: 1.79, kind: 'grocery', heal: 15, mass: 0.7, carry: 'both', shape: 'box' },
  raisin: { prop: 'breads', part: /^Raisin_Bread/, h: 0.05, size: [0.078, 0.05, 0.082], name: 'a raisin bun', short: 'raisin bun', price: 0.45, kind: 'food', heal: 6, mass: 0.07, carry: 'palm', shape: 'box' },
  cupcake: { prop: 'breads', part: /^Spiced_Cupcake/, h: 0.05, size: [0.065, 0.05, 0.065], name: 'a spice cupcake', short: 'cupcake', price: 0.65, kind: 'food', heal: 6, mass: 0.06, carry: 'palm', shape: 'can' },
  brioche: { prop: 'breads', part: /^Chocolate_Brioche/, h: 0.043, size: [0.12, 0.043, 0.075], name: 'a chocolate brioche', short: 'brioche', price: 0.85, kind: 'food', heal: 8, mass: 0.08, carry: 'palm', shape: 'box' },
  croissant: { prop: 'croissant', h: 0.05, size: [0.16, 0.05, 0.06], name: 'a croissant', short: 'croissant', price: 1.25, kind: 'food', heal: 10, mass: 0.06, carry: 'palm', shape: 'box' },
  bun: { prop: 'buns', part: /_02$/, h: 0.06, size: [0.11, 0.06, 0.11], name: 'a bun', short: 'bun', price: 0.25, kind: 'food', heal: 5, mass: 0.06, carry: 'palm', shape: 'can' },
  donut: { prop: 'donut', h: 0.03, size: [0.095, 0.03, 0.095], name: 'a glazed donut', short: 'donut', price: 0.45, kind: 'food', heal: 8, mass: 0.06, carry: 'palm', shape: 'can' },
  donutChoc: { prop: 'donut', h: 0.03, size: [0.095, 0.03, 0.095], tint: [0.42, 0.27, 0.18], name: 'a chocolate donut', short: 'donut', price: 0.50, kind: 'food', heal: 8, mass: 0.06, carry: 'palm', shape: 'can' },
  muffin: { prop: 'muffin', h: 0.075, size: [0.09, 0.075, 0.09], name: 'a blueberry muffin', short: 'muffin', price: 0.85, kind: 'food', heal: 8, mass: 0.1, carry: 'palm', shape: 'can' },
  // produce
  apple: { prop: 'produce', part: /^Apple/, h: 0.075, size: [0.07, 0.075, 0.07], name: 'an apple', short: 'apple', price: 0.20, kind: 'food', heal: 5, mass: 0.18, carry: 'palm', shape: 'can' },
  pear: { prop: 'produce', part: /^Red_Pear/, h: 0.11, size: [0.065, 0.11, 0.065], name: 'a pear', short: 'pear', price: 0.25, kind: 'food', heal: 5, mass: 0.18, carry: 'palm', shape: 'can' },
  peach: { prop: 'produce', part: /^Peach/, h: 0.07, size: [0.07, 0.07, 0.07], name: 'a peach', short: 'peach', price: 0.25, kind: 'food', heal: 5, mass: 0.15, carry: 'palm', shape: 'can' },
  mandarin: { prop: 'produce', part: /^Mandarin/, h: 0.06, size: [0.08, 0.06, 0.08], name: 'a tangerine', short: 'tangerine', price: 0.20, kind: 'food', heal: 4, mass: 0.1, carry: 'palm', shape: 'can' },
  potato: { prop: 'produce', part: /^Potato/, h: 0.065, size: [0.08, 0.065, 0.09], name: 'a potato', short: 'potato', price: 0.15, kind: 'grocery', heal: 0, mass: 0.2, carry: 'palm', shape: 'can' },
  russet: { prop: 'produce', part: /^Russet/, h: 0.048, size: [0.06, 0.048, 0.107], name: 'a russet potato', short: 'potato', price: 0.15, kind: 'grocery', heal: 0, mass: 0.2, carry: 'palm', shape: 'can' },
  chili: { prop: 'produce', part: /^Red_Pepper/, h: 0.033, size: [0.10, 0.033, 0.07], name: 'a chili', short: 'chili', price: 0.10, kind: 'grocery', heal: 0, mass: 0.02, carry: 'palm', shape: 'box' },
  pepper: { prop: 'produce', part: /^Red_Bell/, h: 0.084, size: [0.076, 0.084, 0.08], name: 'a bell pepper', short: 'pepper', price: 0.50, kind: 'grocery', heal: 0, mass: 0.15, carry: 'palm', shape: 'can' },
  broccoli: { prop: 'produce', part: /^Broccoli/, h: 0.2, size: [0.17, 0.2, 0.17], name: 'a head of broccoli', short: 'broccoli', price: 0.79, kind: 'grocery', heal: 0, mass: 0.4, carry: 'both', shape: 'can' },
  cabbage: { prop: 'produce', part: /^Cabbage/, h: 0.12, size: [0.17, 0.12, 0.175], name: 'a cabbage', short: 'cabbage', price: 0.69, kind: 'grocery', heal: 0, mass: 0.9, carry: 'both', shape: 'can' },
  carrot: { prop: 'produce', part: /^Carrot/, h: 0.029, size: [0.12, 0.029, 0.17], name: 'a carrot', short: 'carrot', price: 0.10, kind: 'food', heal: 3, mass: 0.06, carry: 'palm', shape: 'box' },
  watermelon: { prop: 'melons', part: /^Watermelon/, h: 0.21, size: [0.35, 0.21, 0.33], name: 'a watermelon', short: 'watermelon', price: 2.99, kind: 'grocery', heal: 0, mass: 4, carry: 'both', shape: 'can' },
  pomegranate: { prop: 'melons', part: /^Pomegranate/, h: 0.08, size: [0.11, 0.08, 0.11], name: 'a pomegranate', short: 'pomegranate', price: 0.99, kind: 'food', heal: 5, mass: 0.25, carry: 'palm', shape: 'can' },
  bananas: { prop: 'bananas', h: 0.17, size: [0.13, 0.17, 0.21], name: 'a bunch of bananas', short: 'bananas', price: 0.59, kind: 'food', heal: 8, mass: 0.8, carry: 'both', shape: 'box' },
  lemon: { prop: 'lemon', h: 0.09, size: [0.065, 0.09, 0.065], name: 'a lemon', short: 'lemon', price: 0.15, kind: 'grocery', heal: 0, mass: 0.1, carry: 'palm', shape: 'can' },
  onion: { prop: 'onion', h: 0.085, size: [0.072, 0.085, 0.07], name: 'an onion', short: 'onion', price: 0.20, kind: 'grocery', heal: 0, mass: 0.15, carry: 'palm', shape: 'can' },
  // the pharmacy
  pills: { prop: 'painpills', h: 0.10, size: [0.055, 0.10, 0.055], name: 'a bottle of aspirin', short: 'aspirin', price: 1.89, kind: 'thing', heal: 40, pill: true, mass: 0.12, carry: 'palm', shape: 'can' },
  paracetamol: { prop: 'medbox', h: 0.075, size: [0.13, 0.075, 0.029], name: 'a box of paracetamol', short: 'paracetamol', price: 2.49, kind: 'thing', heal: 40, pill: true, mass: 0.05, carry: 'palm', shape: 'box' },
  medtape: { prop: 'medtape', h: 0.025, size: [0.045, 0.025, 0.045], name: 'a roll of medical tape', short: 'medical tape', price: 0.99, kind: 'thing', mass: 0.03, carry: 'palm', shape: 'can' },
  freshener: { prop: 'toiletries', part: /^AirFreshener/, h: 0.21, size: [0.05, 0.21, 0.05], name: 'a can of air freshener', short: 'air freshener', price: 1.49, kind: 'thing', mass: 0.3, carry: 'palm', lie: true, shape: 'can' },
  soap: { prop: 'toiletries', part: /^Soap/, h: 0.19, size: [0.08, 0.19, 0.07], name: 'a bottle of hand soap', short: 'soap', price: 1.19, kind: 'thing', mass: 0.35, carry: 'palm', lie: true, shape: 'can' },
  mouthwash: { prop: 'toiletries', part: /^Mouthwash/, h: 0.23, size: [0.06, 0.23, 0.09], name: 'a bottle of mouthwash', short: 'mouthwash', price: 2.29, kind: 'thing', mass: 0.6, carry: 'palm', lie: true, shape: 'box' },
  shaving: { prop: 'toiletries', part: /^ShavingCream/, h: 0.17, size: [0.07, 0.17, 0.07], name: 'a can of shaving cream', short: 'shaving cream', price: 1.79, kind: 'thing', mass: 0.3, carry: 'palm', lie: true, shape: 'can' },
  tp: { prop: 'toiletries', part: /^ToiletPaper/, h: 0.26, rot: [0, HALF_PI, 0], size: [0.49, 0.26, 0.26], name: 'a twelve-pack of toilet paper', short: 'toilet paper', price: 3.49, kind: 'thing', mass: 1.2, carry: 'both', shape: 'box' },
  // parts, hardware, cleaning
  motoroil: { prop: 'motoroil', h: 0.19, size: [0.144, 0.19, 0.075], name: 'a can of motor oil', short: 'motor oil', price: 1.29, kind: 'thing', mass: 1.0, carry: 'palm', lie: true, shape: 'box', oil: true },
  lube: { prop: 'lube', h: 0.165, size: [0.067, 0.165, 0.065], name: 'a can of PH-40', short: 'PH-40', price: 2.49, kind: 'thing', mass: 0.4, carry: 'palm', lie: true, shape: 'can' },
  spraypaint: { prop: 'spraypaint', h: 0.229, size: [0.066, 0.229, 0.066], name: 'a can of spray paint', short: 'spray paint', price: 2.99, kind: 'thing', mass: 0.4, carry: 'palm', lie: true, shape: 'can' },
  ducttape: { prop: 'ducttape', h: 0.048, size: [0.135, 0.048, 0.135], name: 'a roll of duct tape', short: 'duct tape', price: 1.79, kind: 'thing', mass: 0.3, carry: 'palm', shape: 'can', tape: true },
  pliers: { prop: 'pliers', h: 0.018, rot: [-HALF_PI, HALF_PI, 0, 'YXZ'], size: [0.18, 0.018, 0.055], name: 'a pair of pliers', short: 'pliers', price: 4.99, kind: 'thing', mass: 0.25, carry: 'palm', shape: 'box', flat: true },
  screwdriver: { prop: 'screwdriver', h: 0.027, rot: [-HALF_PI, HALF_PI, 0, 'YXZ'], size: [0.21, 0.027, 0.027], name: 'a screwdriver', short: 'screwdriver', price: 2.49, kind: 'thing', mass: 0.12, carry: 'palm', shape: 'box', flat: true },
  tapemeasure: { prop: 'tapemeasure', h: 0.073, size: [0.041, 0.073, 0.169], name: 'a tape measure', short: 'tape measure', price: 5.99, kind: 'thing', mass: 0.3, carry: 'palm', shape: 'box' },
  cleaner: { prop: 'cleaner', h: 0.32, size: [0.157, 0.32, 0.117], name: 'a jug of all-purpose cleaner', short: 'cleaner', price: 2.29, kind: 'thing', mass: 1.6, carry: 'both', shape: 'box' },
  bleach: { prop: 'bleach', h: 0.294, size: [0.088, 0.294, 0.061], name: 'a bottle of bleach', short: 'bleach', price: 1.19, kind: 'thing', mass: 1.0, carry: 'palm', lie: true, shape: 'box' },
  multiclean: { prop: 'multiclean', h: 0.229, size: [0.088, 0.229, 0.09], name: 'a bottle of multi-cleaner', short: 'multi-cleaner', price: 1.99, kind: 'thing', mass: 0.8, carry: 'palm', lie: true, shape: 'can' },
  drain: { prop: 'drain', h: 0.179, size: [0.165, 0.179, 0.056], name: 'a bottle of drain cleaner', short: 'drain cleaner', price: 3.49, kind: 'thing', mass: 1.0, carry: 'palm', lie: true, shape: 'box' },
};
for (const [key, p] of Object.entries(PRODUCTS)) p.key = key;
export const STOCK_PROPS = [...new Set(Object.values(PRODUCTS).map((p) => p.prop))];

// what each kind of shelf carries (a mix of products, by key; a shelf's runs cycle through it)
export const MIX = {
  snacks: ['chipsA', 'chipsB', 'tortilla', 'chipsC', 'cereal'],
  pantry: ['tomatoes', 'beans', 'sardines', 'beans', 'tomatoes'],
  bread: ['loaf', 'nutbread', 'loaf', 'boule'],
  cleaning: ['cleaner', 'bleach', 'multiclean', 'drain'],
  household: ['tp', 'soap', 'freshener', 'mouthwash', 'shaving'],
  candy: ['candyMilk', 'candyDark', 'candyToffee'],
  drinks: ['soda1', 'soda2', 'soda3', 'dietsoda', 'soda4', 'soda5'],
  beer: ['beercan', 'beer', 'beercan'],
  cooler: ['soda1', 'beercan', 'soda2', 'dietsoda', 'soda3', 'beer', 'soda4', 'milk', 'soda5'],
  dairy: ['milk', 'milk', 'soda1', 'soda3'],
  wine: ['wineRed', 'wineWhite', 'wineGreen', 'wineRose'],
  liquor: ['whiskey', 'gin', 'port', 'rum', 'wineRed', 'whiskey', 'wineGreen', 'gin', 'rum', 'port'],
  pharmacy: ['pills', 'paracetamol', 'medtape', 'paracetamol', 'pills'],
  toiletries: ['soap', 'mouthwash', 'shaving', 'freshener'],
  auto: ['motoroil', 'lube', 'spraypaint', 'motoroil', 'multiclean'],
  autolow: ['motoroil', 'cleaner', 'drain', 'motoroil'],
  tools: ['ducttape', 'pliers', 'screwdriver', 'tapemeasure', 'ducttape'],
  paint: ['spraypaint', 'lube', 'spraypaint', 'bleach'],
  donuts: ['donut', 'donutChoc', 'donut', 'muffin'],
  pastry: ['concha', 'brioche', 'raisin', 'concha', 'roll'],
  bakeryTop: ['croissant', 'cupcake', 'bagel'],
  bakeryBack: ['boule', 'loaf', 'nutbread', 'bun', 'bagel'],
  cafe: ['croissant', 'muffin', 'brioche', 'cupcake'],
};

// ----------------------------------------------------------------------------------------- stocking a shelf
// A shelf's run of stock in a room's frame M: along x from a to b (`along: 'x'`, its front at z, the goods behind it
// toward -z if `face` is +1) or along z from a down to b (`along: 'z'`, its front at x, behind it toward -x for face +1:
// a gondola's side). y: the shelf's top; depth: how deep it is; H: the clear height over it. Runs of each product in
// turn from `mix`, a run `span` wide, as deep as the shelf takes, stacked where they're short (`stack`). phys: it can be
// knocked off (it stands on a shelf with a collider under it); take: Hal can pick it up (a cooler's, a crate's: not
// behind the counter or the glass). door: a cooler's glass, along z = door (Hal reaches for it, not through it).
export function stockRow(ctx, M, { room, along = 'x', a, b, y, at, face = 1, depth = 0.3, H = 0.3, mix, phys = true, take = true, stack = true, span = [0.2, 0.5], seed = 1, gap = 0.008, deep = 2, miss = 0.06, fill = null, door = null }) {
  const out = (ctx.stock ??= []), rnd = seeded(seed * 7919 + Math.round(Math.abs(a) * 131 + Math.abs(y) * 977 + Math.abs(at) * 31));
  const list = MIX[mix] ?? mix, len = Math.abs(b - a), dir = Math.sign(b - a) || 1;
  const yaw = along === 'x' ? (face > 0 ? 0 : Math.PI) : (face > 0 ? HALF_PI : -HALF_PI);
  let u = 0.01, k = Math.floor(rnd() * list.length), skips = 0;
  while (u < len - 0.02 && skips < list.length) {
    const P = PRODUCTS[list[k++ % list.length]], [w, h, d] = P.size;
    // (too tall for the shelf, or too wide for what's left of it: the next in the mix, till none fits)
    if (h > H - 0.01 || u + w > len - 0.01) { skips++; continue; }
    skips = 0;
    // (a run a hand or two wide, whatever its width: a shelf of pill bottles was four hundred of them; two deep at the
    // front, the way a store faces its shelves, stacked two high where it's short)
    let n = fill ?? Math.max(1, Math.round((span[0] + rnd() * (span[1] - span[0])) / (w + gap)));
    n = Math.max(1, Math.min(n, Math.floor((len - 0.01 - u + gap) / (w + gap))));
    const rows = Math.max(1, Math.min(deep, Math.floor((depth - 0.01) / (d + 0.004)))), layers = stack && h < H * 0.42 && (P.flat || (P.shape === 'can' && P.kind === 'grocery') || P.tape) ? 2 : 1; // (cans and flat things stacked; bottles and boxes stand in rows)
    for (let i = 0; i < n; i++) {
      const c = u + i * (w + gap) + w / 2;
      for (let r = 0; r < rows; r++) for (let l = 0; l < layers; l++) {
        if (r === 0 && l === layers - 1 && rnd() < miss) continue; // (one sold off the front)
        const jit = (rnd() - 0.5) * 0.004, back = 0.005 + r * (d + 0.004) + d / 2 + (rnd() - 0.5) * 0.004;
        const s = a + dir * (c + jit), off = face * back;
        const [x, z] = along === 'x' ? [s, at - off] : [at - off, s];
        const it = { key: P.key, room, M, x, y: y + l * (h + 0.001), z, yaw: yaw + (rnd() - 0.5) * (P.shape === 'can' ? 1.2 : 0.05), phys, take, door, row: r, out: along === 'x' ? [0, face] : [face, 0] };
        if (l > 0 && out.at(-1)?.under !== undefined) (out.at(-1).overs = [it]);
        it.under = l > 0 ? out.at(-1) : null;
        out.push(it);
      }
    }
    u += n * (w + gap) + 0.02 + rnd() * 0.02;
  }
}

// A heap of loose produce in a crate (or a bin): the crate's floor a plane in the room's frame, `c` its centre at
// height y, w × d across, tilted `tilt` (forward, toward the room: `yaw` the way the crate faces), filled with one
// kind, two layers.
export function stockHeap(ctx, M, { room, key, c, y, w, d, yaw = 0, tilt = 0, seed = 1, layers = 2, take = true }) {
  const out = (ctx.stock ??= []), P = PRODUCTS[key], rnd = seeded(seed * 104729 + Math.round(c.x * 97 + c.z * 61));
  const [pw, ph, pd] = P.size, step = Math.max(pw, pd) * 0.98, nx = Math.max(1, Math.floor(w / step)), nz = Math.max(1, Math.floor(d / step));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), at = V(0, 0, 0);
  for (let l = 0; l < layers; l++) for (let i = 0; i < nx - l; i++) for (let j = 0; j < nz - l; j++) {
    if (l > 0 && rnd() > 0.45) continue; // (a heap, not a second floor of it)
    const lx = (i - (nx - l - 1) / 2) * step + (rnd() - 0.5) * step * 0.15, lz = (j - (nz - l - 1) / 2) * step + (rnd() - 0.5) * step * 0.15;
    at.set(lx, l * ph * 0.62, lz).applyQuaternion(q);
    out.push({ key, room, M, x: c.x + at.x, y: y + at.y, z: c.z + at.z, yaw: rnd() * Math.PI * 2, tilt: q, phys: false, take, heap: { layer: l, step } });
  }
}

// ----------------------------------------------------------------------------------------- the block's stock
// Made once the block's fit-outs have placed everything (city/HalsBlock.js): the stand-ins at once, the products
// when the camera first comes near a shop. `ctx.goods` (the scratchers, the shops without stock of their own) stay
// the plain boxes they were.
// an item's turn where it was stocked (the block's frame): its room's, its own, a crate's tilt
const UP = V(0, 1, 0), _hq = new THREE.Quaternion();
const home = (it, out) => (it.tilt ? out.setFromAxisAngle(UP, it.my).multiply(it.tilt).multiply(_hq.setFromAxisAngle(UP, it.yaw)) : out.setFromAxisAngle(UP, it.my + it.yaw));
const NEAR = 4.5, FAR = 5.5; // (the camera within this of a shop's room: its stock as itself; FAR to let it go)
// and within the room, each item as itself within LOD of the camera, its stand-in beyond (a shop holds a thousand and
// more: at eight metres a can is a few pixels, and its label on the stand-in reads the same)
const LOD = 7.5, LOD_OUT = 8.2;
const _v = V(0, 0, 0), _w = V(0, 0, 0), _n = V(0, 0, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1);

export class Stock {
  constructor(ctx, group, { physics = null, smash = null } = {}) {
    Object.assign(this, { ctx, group, physics, smash });
    this.items = ctx.stock ?? [];
    this.rooms = new Map();
    for (const [key, r] of Object.entries(ctx.stockRooms ?? {})) this.rooms.set(key, { key, ...r, inv: r.M.clone().invert(), near: false, items: [] });
    group.updateMatrixWorld(true);
    this.origin = group.position.clone();
    const yaws = new Map();
    for (const [i, it] of this.items.entries()) {
      it.i = i;
      if (!yaws.has(it.M)) yaws.set(it.M, new THREE.Euler().setFromRotationMatrix(it.M).y);
      it.P = PRODUCTS[it.key];
      it.local = V(it.x, it.y, it.z).applyMatrix4(it.M); // (the block's frame: the batches')
      it.world = it.local.clone().add(this.origin);
      it.my = yaws.get(it.M);
      it.q = home(it, new THREE.Quaternion());
      it.state = 'shelf'; // 'shelf' (where it was stocked), 'free' (a body of its own), 'held', 'gone'
      this.rooms.get(it.room)?.items.push(it);
    }
    // a heap's top layer lies on the one under it: what's under can't be taken (or knocked) till what's on it has gone
    const tops = this.items.filter((it) => it.heap?.layer > 0);
    for (const it of this.items) if (it.heap?.layer === 0) it.overs = tops.filter((o) => o.M === it.M && Math.hypot(o.local.x - it.local.x, o.local.z - it.local.z) < it.heap.step * 0.9);
    // the stand-ins: the products as the boxes and cans of the goods atlas
    this.standIns = standIns(this.items, ctx.goods ?? [], group);
    this.loaded = false;
    this.sets = [];
    this.free = new Set();
    this.grid = new Map();
    for (const it of this.items) if (it.phys || it.take) this.cell(it.local, true).push(it);
    this.hooks();
  }

  cellKey(p) { return `${Math.floor(p.x / 0.5)},${Math.floor(p.z / 0.5)}`; }
  cell(p, make = false) { const k = this.cellKey(p); let c = this.grid.get(k); if (!c && make) this.grid.set(k, (c = [])); return c; }
  // the shelved items within r of p (the block's frame)
  near(p, r, out = [], flat = false) {
    out.length = 0;
    const x0 = Math.floor((p.x - r) / 0.5), x1 = Math.floor((p.x + r) / 0.5), z0 = Math.floor((p.z - r) / 0.5), z1 = Math.floor((p.z + r) / 0.5);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const c = this.grid.get(`${x},${z}`); if (c) for (const it of c) if ((flat ? (it.local.x - p.x) ** 2 + (it.local.z - p.z) ** 2 : it.local.distanceToSquared(p)) < r * r) out.push(it); }
    return out;
  }

  // ---------------------------------------------------------------------- the products, loaded and batched
  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await loadProps(STOCK_PROPS);
      const shapes = new Map();
      for (const key of new Set(this.items.map((it) => it.key))) shapes.set(key, shapeOf(PRODUCTS[key]));
      this.shapes = shapes;
      // one batch a material, every copy of every part that wears it
      const groups = new Map(), byMat = new Map();
      for (const it of this.items) {
        const S = shapes.get(it.key);
        it.parts = [];
        this.matrix(it, _m);
        for (const part of S.parts) {
          const gk = `${part.geo.uuid}|${part.mat.uuid}`;
          let g = groups.get(gk);
          if (!g) {
            groups.set(gk, (g = { geo: part.geo, mat: part.mat, list: [], dist: 60, shadow: 0, cast: false }));
            (byMat.get(part.mat) ?? byMat.set(part.mat, []).get(part.mat)).push(g);
          }
          const e = { M: new THREE.Matrix4().multiplyMatrices(_m, part.L), pos: it.world.clone(), gone: true, set: null, color: it.P.tint ? new THREE.Color(...it.P.tint) : null, part };
          g.list.push(e);
          it.parts.push(e);
        }
      }
      for (const [mat, list] of byMat) {
        const set = new BatchSet(this.group, mat, list);
        for (const g of list) for (const e of g.list) e.set = set;
        set.mesh.name = `stock_${mat.name || 'product'}`;
        set.mesh.userData.kind = 'stock';
        this.sets.push(set);
      }
      this.loaded = true;
      for (const R of this.rooms.values()) if (R.near) this.show(R, true);
    })().catch((e) => { console.warn('the shops\' stock:', e); this.loading = null; });
    return this.loading;
  }

  // an item's place in the block's frame (where it was stocked, or its body's, or set)
  matrix(it, out) {
    return out.compose(it.local, it.q, _s.set(1, 1, 1));
  }

  // a room's stock as itself (or the stand-ins)
  show(R, on) {
    R.near = on;
    if (this.loaded && this.cam) this.lod(R, this.cam);
    if (this.loaded) for (const it of R.items) this.drawn(it);
    this.standIns.hideRoom(R.key, on && this.loaded);
  }
  // whether an item's copy in the batch is drawn: on the shelf (in a room that's near, within LOD), or come to rest
  // where it fell
  drawn(it) {
    const R = this.rooms.get(it.room), show = it.state === 'shelf' ? !!R?.near && !!it.close : it.state === 'free' && !!it.rest;
    for (const e of it.parts ?? []) if (e.gone === show) { e.gone = !show; e.set.dirty = true; }
  }
  // which of a near room's items are within LOD of the camera (block frame `cam`): true if any changed
  lod(R, cam) {
    let changed = false;
    for (const it of R.items) {
      const d2 = it.local.distanceToSquared(cam), close = it.close ? d2 < LOD_OUT * LOD_OUT : d2 < LOD * LOD;
      if (close !== !!it.close) { it.close = close; changed = true; if (this.loaded) this.drawn(it); }
    }
    return changed;
  }
  // a copy moved in the batch: its parts to the item's place
  place(it) {
    if (!it.parts) return;
    this.matrix(it, _m);
    for (const e of it.parts) { e.M.multiplyMatrices(_m, e.part.L); e.pos.copy(it.local).add(this.origin); e.set.move(e, e.M); e.set.dirty = true; }
  }

  // ---------------------------------------------------------------------- each frame
  update(camera, dt = 0) {
    if (!camera) return;
    _v.copy(camera.position).sub(this.origin);
    let anyNear = false;
    for (const R of this.rooms.values()) {
      _w.copy(_v).applyMatrix4(R.inv);
      const d = Math.hypot(Math.max(R.x0 - _w.x, 0, _w.x - R.x1), Math.max(_w.z - R.z0, 0, R.z1 - _w.z), Math.max(_w.y - (R.ceil + 0.5), 0));
      const near = R.near ? d < FAR : d < NEAR;
      if (near !== R.near) this.show(R, near);
      anyNear ||= near;
    }
    if (anyNear && !this.loaded) this.load();
    if (!this.loaded) return;
    // (the near rooms' items as themselves or their stand-ins, again each metre the camera moves)
    if (!this.cam || this.cam.distanceToSquared(_v) > 1) {
      (this.cam ??= V(0, 0, 0)).copy(_v);
      let changed = false;
      for (const R of this.rooms.values()) if (R.near) changed = this.lod(R, this.cam) || changed;
      if (changed) this.standIns.refresh();
    }
    for (const set of this.sets) set.update(camera.position);
    if (dt > 0) this.settle();
    if (anyNear && dt > 0) this.disturbers(dt);
  }

  // knocked-off items: drawn as themselves while they move, back in the batch where they come to rest
  settle() {
    for (const it of this.free) {
      const b = it.item?.body;
      if (!b || !this.physics.world.bodies.contains(b.handle)) { this.free.delete(it); continue; }
      const sleeping = b.isSleeping();
      if (sleeping && !it.rest) {
        const t = b.translation(), r = b.rotation();
        it.local.set(t.x, t.y, t.z).sub(this.origin).add(_w.copy(it.lift).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).negate());
        it.q.set(r.x, r.y, r.z, r.w);
        it.world.copy(it.local).add(this.origin);
        it.rest = true;
        this.place(it);
        this.drawn(it);
        it.object.visible = false;
      } else if (!sleeping && it.rest) {
        it.rest = false;
        it.object.visible = true;
        this.drawn(it);
      }
    }
  }

  // ---------------------------------------------------------------------- knocked off
  // What disturbs the shelves each frame: Hal running or flying into them, anything moving (a car, a thrown crate,
  // what's already falling), the ring's constructs (each's shape as a sphere). The ring's blows and blasts arrive
  // through Smash (hooks, below).
  disturbers(dt) {
    const pl = this.player, found = this._found ??= [];
    if (pl?.position) {
      const p = _v.copy(pl.position).sub(this.origin), last = (this._lastHal ??= p.clone());
      const vel = (this._halVel ??= V(0, 0, 0)).copy(p).sub(last).multiplyScalar(1 / Math.max(dt, 1e-3));
      last.copy(p);
      // running (or flying) into the shelving, or leaning on it (walking into it a moment: the capsule stops at the
      // shelf's edge, so a walk into it is a push): what's in front of him goes over
      const speed = Math.hypot(vel.x, vel.z) + (pl.flying ? Math.abs(vel.y) : 0), fast = pl.flying ? speed > 1.2 : speed > 2.6;
      const m = pl.control && !pl.flying ? pl.input?.moveAxis?.() : null, pushing = m && Math.hypot(m.x, m.z) > 0.5 && speed < 0.5;
      this._push = pushing ? (this._push ?? 0) + dt : Math.min(0, (this._push ?? 0) + dt);
      const face = _n.set(Math.sin(pl.yaw ?? 0), 0, Math.cos(pl.yaw ?? 0));
      const push = this._push > 0.35, dirOf = fast ? _w.copy(vel).setY(0).normalize() : face;
      if ((fast && speed < 40) || push) {
        if (push) this._push = -0.8; // (a shove, then a moment before the next)
        // (the front of the shelf he's against, a body's width of it: the shelf jolts and what's at its edge comes off
        // toward him, off the front; at a run more of it, harder, scattered)
        const width = push ? 0.3 : 0.5, rows = push ? 0 : 1, hit = [];
        for (const it of this.near(p, 0.85, found, true)) {
          if (it.state !== 'shelf' || !it.phys || (it.row ?? 0) > rows || it.local.y > p.y + 1.85 || it.local.y < p.y - 0.4) continue;
          const dx = it.local.x - p.x, dz = it.local.z - p.z, r = Math.hypot(dx, dz), along = dx * dirOf.x + dz * dirOf.z;
          if (r > 0.32 + 0.24 + Math.max(it.P.size[0], it.P.size[2]) / 2 || along < 0.1 || Math.abs(dx * dirOf.z - dz * dirOf.x) > width) continue;
          if (push && (it.local.y < p.y + 0.55 || it.local.y > p.y + 1.6)) continue; // (leaning: what's at his chest and hips)
          hit.push([r, it]);
        }
        // (the nearest few: a jolt, not the shelf cleared)
        for (const [, it] of hit.sort((a, b) => a[0] - b[0]).slice(0, push ? 5 : 14)) {
          const k = push ? 0.7 + Math.random() * 0.6 : 1.2 + Math.min(1.5, speed * 0.2) + Math.random();
          this.knock(it, _w.copy(dirOf).multiplyScalar(-k).add(V(dirOf.z, 0, -dirOf.x).multiplyScalar((Math.random() - 0.5) * k)).setY(0.2 + Math.random() * 0.3));
        }
      }
    }
    // bodies on the move
    // (only what it's really run into: the point of its box nearest the item inside the item's box; and with the weight
    // to move it: a falling bag knocked the next along, that one the next, and a push took half the shop down)
    for (const e of this.physics?.dynamics ?? []) {
      const b = e.body;
      if (b.isSleeping() || !e.item) continue;
      const own = this._mine.get(e.item);
      if (own && (own.gen ?? 0) >= 2) continue; // (a knocked thing knocks another, that one one more: no further)
      const lv = b.linvel(), sp = Math.hypot(lv.x, lv.y, lv.z);
      if (sp < 1.5) continue;
      const t = b.translation();
      _v.set(t.x, t.y, t.z).sub(this.origin);
      const r = Math.min(3, (e.radius ?? 0.4));
      for (const it of this.near(_v, r + 0.3, found)) {
        if (it.state !== 'shelf' || !it.phys || it.item === e.item || e.item.mass * sp < 0.5 * it.P.mass + 0.1) continue;
        const [w, h, d] = it.P.size;
        _w.copy(it.local).add(this.origin);
        _w.y += h / 2;
        this.smash.nearest(e.item, _w, _n);
        _n.sub(_w).applyQuaternion(_q.copy(it.q).invert()); // (in the item's own frame)
        if (Math.abs(_n.x) > w / 2 - 0.003 || Math.abs(_n.y) > h / 2 - 0.003 || Math.abs(_n.z) > d / 2 - 0.003) continue;
        if ((it.local.x + this.origin.x - t.x) * lv.x + (it.local.y + h / 2 - _v.y) * lv.y + (it.local.z + this.origin.z - t.z) * lv.z <= 0) continue; // (going into it, not off it)
        const got = this.knock(it, _w.set(lv.x, lv.y, lv.z).multiplyScalar(0.6));
        if (got) got.gen = (own?.gen ?? 0) + 1;
      }
    }
    // the ring's constructs
    for (const c of this.powers?.live ?? []) {
      const m = c.mesh ?? c.group;
      if (!m?.visible || !m.parent) continue;
      const g = m.children?.[0]?.geometry ?? m.geometry;
      if (!g) continue;
      g.boundingSphere ?? g.computeBoundingSphere();
      m.updateWorldMatrix(true, false);
      const sc = m.matrixWorld.getMaxScaleOnAxis(), r = g.boundingSphere.radius * sc;
      if (r > 3) continue; // (a wall, a shockwave's ring: the blows land through Smash)
      _v.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld).sub(this.origin);
      const prev = (c._stockAt ??= _v.clone()), push = _w.copy(_v).sub(prev).multiplyScalar(1 / Math.max(dt, 1e-3));
      prev.copy(_v);
      for (const it of this.near(_v, r + 0.15, found)) {
        if (it.state !== 'shelf' || !it.phys) continue;
        _n.copy(it.local).y += it.P.size[1] / 2;
        if (_n.distanceTo(_v) > r + 0.08) continue;
        const away = _n.clone().sub(_v).normalize().multiplyScalar(2.5).addScaledVector(push, 0.5);
        this.knock(it, away.setY(Math.max(away.y, 0.6)));
      }
    }
  }

  // the ring's blows and blasts (and a car's crash into the shelving) heard through Smash: what's shelved near
  // where it landed comes off
  hooks() {
    const S = this.smash;
    if (!S || S._stockHooked) return;
    S._stockHooked = true;
    const blow = S.blow.bind(S), blast = S.blast.bind(S);
    const mine = (this._mine = new Map());
    S.blow = (item, strength, at, dir, kind) => {
      const own = mine.get(item);
      if (own && own.P.glass && strength >= 7 && own.state === 'free') { this.shatter(own, at); return true; }
      if (this.loaded && at && strength >= 2) this.blowAt(at, dir, strength, item);
      return blow(item, strength, at, dir, kind);
    };
    S.blast = (center, radius, strength, except) => {
      if (this.loaded) this.blowAt(center, null, strength, null, radius);
      return blast(center, radius, strength, except);
    };
  }
  blowAt(at, dir, strength, struck = null, radius = null) {
    const p = _v.copy(at).sub(this.origin), r = radius ?? Math.min(1.1, 0.18 + strength * 0.025), found = [];
    this.near(p, r + 0.2, found);
    for (const it of found) {
      if (it.state !== 'shelf' || !it.phys || it.item === struck) continue;
      const c = it.local.clone(); c.y += it.P.size[1] / 2;
      const d = c.distanceTo(p);
      if (d > r) continue;
      const k = 1 - d / (r + 0.01);
      const v = dir ? dir.clone().multiplyScalar(1.5 + strength * 0.12 * k) : c.sub(p).normalize().multiplyScalar(2 + strength * 0.2 * k);
      this.knock(it, v.setY(Math.max(v.y, 0.8 * k)));
    }
  }

  // an item off the shelf: a body of its own at its place, going `vel`; drawn as itself till it rests
  knock(it, vel = null) {
    if (!this.loaded || !this.smash || it.state !== 'shelf') return null;
    if (this.free.size > 260) return null; // (a whole shop's stock in the air: enough)
    const o = this.objectOf(it);
    o.position.copy(it.world);
    o.quaternion.copy(it.q);
    this.group.parent.add(o);
    const [w, h, d] = it.P.size;
    const box = new THREE.Box3(V(-w / 2, 0, -d / 2), V(w / 2, h, d / 2));
    const item = this.smash.add(o, { kind: 'loose', mass: it.P.mass, box, shrink: 0.92, stuff: 'plastic', glass: false, friction: 0.6, restitution: it.P.glass ? 0.05 : 0.15 });
    it.item = item;
    it.object = o;
    it.lift = V(0, 0, 0); // (the body's origin is the item's base: where it was stocked)
    it.state = 'free';
    it.rest = false;
    it.gen = 0;
    this._mine.set(item, it);
    this.free.add(it);
    this.drawn(it);
    this.standIns.refresh();
    if (vel) {
      const m = it.P.mass;
      item.body.applyImpulse({ x: vel.x * m, y: vel.y * m, z: vel.z * m }, true);
      item.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 0.02, y: (Math.random() - 0.5) * m * 0.02, z: (Math.random() - 0.5) * m * 0.02 }, true);
    }
    for (const o of it.overs ?? []) if (o.state === 'shelf') this.knock(o, vel ? vel.clone().multiplyScalar(0.6) : null); // (what was stacked on it)
    this.onKnock?.(it);
    return it;
  }

  // its meshes as an object of its own (the batch's geometry and materials)
  objectOf(it) {
    const g = new THREE.Group(), S = this.shapes.get(it.key);
    for (const p of S.parts) {
      let mat = p.mat;
      if (it.P.tint) mat = (S.tinted ??= new Map()).get(p.mat) ?? S.tinted.set(p.mat, Object.assign(p.mat.clone(), { color: new THREE.Color(...it.P.tint) })).get(p.mat);
      const m = new THREE.Mesh(p.geo, mat);
      m.matrixAutoUpdate = false;
      m.matrix.copy(p.L);
      m.castShadow = false;
      m.receiveShadow = true;
      g.add(m);
    }
    g.userData.kind = 'stock';
    g.name = it.key;
    return g;
  }

  // a bottle landing hard: gone in a shower of glass and a splash
  shatter(it, at) {
    const S = this.smash, c = it.object.getWorldPosition(V(0, 0, 0)).setY(it.object.position.y + it.P.size[1] * 0.4);
    S.bits.emit(40, (q, v) => { q[0] = c.x + (Math.random() - 0.5) * 0.08; q[1] = c.y; q[2] = c.z + (Math.random() - 0.5) * 0.08; v[0] = (Math.random() - 0.5) * 2.4; v[1] = Math.random() * 1.6; v[2] = (Math.random() - 0.5) * 2.4; }, { life: 1.2, size: [0.02, 0.012], color: [[0.7, 0.8, 0.75, 0.9], [0.5, 0.6, 0.55, 0]] });
    const wet = it.P.beer ? [0.75, 0.55, 0.2, 0.7] : /wine/i.test(it.key) ? [0.35, 0.05, 0.08, 0.7] : [0.7, 0.55, 0.3, 0.6];
    S.bits.emit(26, (q, v) => { q[0] = c.x; q[1] = c.y; q[2] = c.z; v[0] = (Math.random() - 0.5) * 1.6; v[1] = Math.random() * 1.2; v[2] = (Math.random() - 0.5) * 1.6; }, { life: 0.9, size: [0.03, 0.01], color: [wet, [wet[0] * 0.6, wet[1] * 0.6, wet[2] * 0.6, 0]] });
    S.sound('glass', c, 0.9);
    this.drop(it);
    it.state = 'gone';
    this.drawn(it);
    this.standIns.refresh();
    this.onBreak?.(it, at);
  }

  // ---------------------------------------------------------------------- taken
  // Out of the shelf (or off the floor) and into the story's hands: its object, for his hand
  take(it) {
    if (!this.loaded || it.state === 'held' || it.state === 'gone') return null;
    let o = it.object;
    if (it.state === 'free') this.drop(it);
    o ??= this.objectOf(it);
    o.visible = true;
    it.state = 'held';
    it.rest = false;
    this.drawn(it);
    this.standIns.refresh();
    return o;
  }
  // a free item's body put away (its object kept)
  drop(it) {
    if (it.item) { this._mine.delete(it.item); this.smash.remove(it.item); it.item = null; }
    this.free.delete(it);
  }
  // back where it was stocked (Hal putting it back)
  restock(it) {
    if (it.state !== 'held') return;
    it.object?.removeFromParent();
    it.object = null;
    it.local.set(it.x, it.y, it.z).applyMatrix4(it.M);
    it.world.copy(it.local).add(this.origin);
    home(it, it.q);
    it.state = 'shelf';
    this.place(it);
    this.drawn(it);
    this.standIns.refresh();
  }
  // let go of in the world: a body of its own from where it is (dropped, set down)
  release(it, pos, q, vel = null) {
    if (it.state !== 'held') return;
    it.object?.removeFromParent();
    it.object = null;
    it.local.copy(pos).sub(this.origin);
    it.world.copy(pos);
    it.q.copy(q);
    it.state = 'shelf'; // (so knock() takes it: it's never shelved again where it was)
    this.knock(it, vel);
  }
  // eaten, kept, gone for good
  consume(it) {
    if (it.state === 'free') this.drop(it);
    it.object?.removeFromParent();
    it.object = null;
    it.state = 'gone';
    this.drawn(it);
    this.standIns.refresh();
  }

  // The item Hal's looking at, within his reach: on the camera's line, the nearest along it, in front of him
  // (`hal`: his chest, world; `from`, `dir`: the camera's ray)
  aim(hal, from, dir, reach = 1.25) {
    if (!this.loaded) return null;
    const p = _v.copy(hal).sub(this.origin), found = this.near(p, reach + 0.4, this._aimFound ??= [], true);
    for (const it of this.free) if (it.rest && it.local.distanceTo(p) < reach + 0.6) found.push(it);
    let best = null, bt = Infinity;
    const c = V(0, 0, 0);
    for (const it of found) {
      if (!it.take || (it.state !== 'shelf' && !(it.state === 'free' && it.rest))) continue;
      if (it.state === 'shelf' && it.overs?.some((o) => o.state === 'shelf')) continue; // (the top of a stack first)
      c.copy(it.local).add(this.origin);
      c.y += it.P.size[1] * 0.5;
      if (Math.hypot(c.x - hal.x, c.z - hal.z) > reach || c.y > hal.y + 0.75 || c.y < hal.y - 1.45) continue;
      const t = _w.copy(c).sub(from).dot(dir);
      if (t < 0.2) continue;
      const off = _w.copy(from).addScaledVector(dir, t).distanceTo(c), r = Math.max(0.05, Math.max(...it.P.size) * 0.55);
      if (off > r + 0.06) continue;
      const score = t + off * 3; // (the first one the line meets; off the line, a little further)
      if (score < bt) { bt = score; best = it; }
    }
    return best;
  }
  // where an item is (world): its centre
  centre(it, out = V(0, 0, 0)) { return out.copy(it.local).add(this.origin).setY(it.world.y + it.P.size[1] * 0.5); }
  roomOf(world) {
    _v.copy(world).sub(this.origin);
    for (const R of this.rooms.values()) { _w.copy(_v).applyMatrix4(R.inv); if (_w.x > R.x0 && _w.x < R.x1 && _w.z < R.z0 && _w.z > R.z1) return R; }
    return null;
  }
}

// a product's model, scaled and stood on its base at its centre, facing +z: its meshes' geometry and materials (the
// prop's, shared) and each's matrix in the product's frame
export function shapeOf(P) {
  const src = propCopy(P.prop);
  src.updateMatrixWorld(true);
  const meshes = [];
  const named = (o, re) => { for (let n = o; n && n !== src.parent; n = n.parent) if (re.test(n.name)) return true; return false; };
  src.traverse((o) => { if (o.isMesh && (!P.part || named(o, P.part))) meshes.push(o); });
  if (!meshes.length) throw new Error(`product ${P.key}: nothing in ${P.prop} matches ${P.part}`);
  const O = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(P.rot ?? [0, 0, 0])));
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const m of meshes) { m.geometry.boundingBox ?? m.geometry.computeBoundingBox(); box.union(b.copy(m.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(O, m.matrixWorld))); }
  const size = box.getSize(V(0, 0, 0)), c = box.getCenter(V(0, 0, 0)), k = P.fitW ? P.size[0] / size.x : P.h / size.y, sq = P.squash ?? [1, 1, 1]; // (a flat thing by its length: a bar's thickness is a millimetre or two)
  const S = new THREE.Matrix4().makeScale(k * sq[0], k * sq[1], k * sq[2]).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)).multiply(O);
  const parts = meshes.map((m) => ({ geo: m.geometry, mat: m.material, L: S.clone().multiply(m.matrixWorld) }));
  const dims = [size.x * k * sq[0], size.y * k * sq[1], size.z * k * sq[2]];
  if (import.meta.env?.DEV && (Math.abs(dims[0] - P.size[0]) > 0.03 + P.size[0] * 0.25 || Math.abs(dims[2] - P.size[2]) > 0.03 + P.size[2] * 0.25)) console.warn(`product ${P.key}: model ${dims.map((v) => v.toFixed(3)).join(' × ')} m, stocked as ${P.size.join(' × ')}`);
  return { parts, dims };
}

// ----------------------------------------------------------------------------------------- the stand-ins
// The products as the goods atlas's boxes and cans, and the plain goods the shops without stock still have: two
// instanced meshes over the atlas (each instance's cell of it), the near rooms' products left out.
function standIns(items, goods, group) {
  const mat = new THREE.MeshStandardMaterial({ map: goodsTexture(), roughness: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_INSTANCING\nvMapUv = vMapUv / 8.0 + aCell;\n#endif');
  };
  mat.customProgramCacheKey = () => 'goods';
  const rows = [];
  let cellSeed = 1;
  const rnd = () => ((cellSeed = (cellSeed * 16807) % 2147483647) / 2147483647);
  for (const g of goods) rows.push({ kind: g.kind, M: g.M, x: g.x, y: g.y, z: g.z, sx: g.sx, sy: g.sy, sz: g.sz, yaw: g.yaw, cell: g.cell, room: null });
  for (const it of items) {
    if (it.row >= 1) continue; // (the second row deep is behind the first: from the street, or eight metres off, unseen)
    const [w, h, d] = it.P.size, can = it.P.shape === 'can';
    rows.push({ kind: can ? 'can' : 'box', M: it.M, x: it.x, y: it.y + h / 2, z: it.z, sx: w, sy: h, sz: d, yaw: it.yaw, cell: can ? 48 + Math.floor(rnd() * 16) : Math.floor(rnd() * 48), room: it.room, it, tilt: it.tilt });
  }
  const meshes = [], near = new Set(), _p = V(0, 0, 0), _sc = V(0, 0, 0), _qq = new THREE.Quaternion();
  const yaws = new Map();
  const sets = ['box', 'can'].map((kind) => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return null;
    const geo = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, 8); // (eight sides: twenty thousand cans at twelve were a million triangles)
    const mesh = new THREE.InstancedMesh(geo, mat, list.length), cell = new Float32Array(list.length * 2);
    for (const r of list) {
      if (!yaws.has(r.M)) yaws.set(r.M, new THREE.Euler().setFromRotationMatrix(r.M).y);
      _p.set(r.x, r.y, r.z).applyMatrix4(r.M);
      _qq.setFromAxisAngle(V(0, 1, 0), yaws.get(r.M) + r.yaw);
      r.mat = new THREE.Matrix4().compose(_p.clone(), _qq.clone(), _sc.set(r.sx, r.sy, r.sz));
    }
    const byRoom = new Map(), plain = [];
    for (const r of list) { if (!r.room) plain.push(r); else (byRoom.get(r.room) ?? byRoom.set(r.room, []).get(r.room)).push(r); }
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `goods_${kind}`;
    group.add(mesh);
    meshes.push(mesh);
    let prefix = 0;
    const put = (n, r) => { mesh.setMatrixAt(n, r.mat); cell[n * 2] = (r.cell % 8) / 8; cell[n * 2 + 1] = Math.floor(r.cell / 8) / 8; };
    // (`full`: the far rooms' part too, when which rooms are near has changed)
    const fill = (full) => {
      let n = prefix;
      if (full) {
        n = 0;
        for (const r of plain) put(n++, r);
        for (const [room, rs] of byRoom) if (!near.has(room)) for (const r of rs) if (r.it.state === 'shelf') put(n++, r);
        prefix = n;
      }
      for (const room of near) for (const r of byRoom.get(room) ?? []) if (r.it.state === 'shelf' && !r.it.close) put(n++, r);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      geo.attributes.aCell.needsUpdate = true;
    };
    fill(true);
    mesh.computeBoundingSphere();
    return { fill };
  }).filter(Boolean);
  return {
    meshes,
    // a room near (its items as themselves within LOD) or not
    hideRoom(room, on) { if (on === near.has(room)) return; if (on) near.add(room); else near.delete(room); for (const s of sets) s.fill(true); },
    // the near rooms' stand-ins again (the camera's moved; something's been taken)
    refresh() { for (const s of sets) s.fill(false); },
  };
}
