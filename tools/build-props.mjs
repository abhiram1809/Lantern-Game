// Turns downloaded props (assets/props/*.glb, CC-BY models from Sketchfab by way of Objaverse) into
// game-ready GLBs in public/models/props: turned to face +Z, scaled to real metres, standing on
// y = 0 (or centred), unwanted parts removed, textures shrunk to WebP. The node hierarchy is kept,
// so named parts (a car's doors and wheels, a fridge's door) can still be moved at runtime.
// It also writes CREDITS.md from the list below: CC-BY needs the title, the author, the source and
// the licence named, and changes noted.
//
//   node tools/build-props.mjs            build everything
//   ONLY=phoenix node tools/...           build one
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, metalRough, weld, simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { TEXTURES } from './fetch-textures.mjs';
import { fitTextures, neededSize, fitted } from './texture-fit.mjs';

const ONLY = process.env.ONLY;
const BY = 'CC BY 4.0';

// forward: the way the raw model's front faces (an axis, or a yaw in radians that turns it to +Z); pitch
// turns it about x first. Size by length (along the front after turning),
// height, or a plain scale. origin 'ground' stands it on y = 0; 'centre' centres it (hand props).
// drop: parts to remove (node names). opaque: materials that were exported as blended for no reason.
// simplify: the share of triangles to keep, for heavy scans. tex: the largest texture size (512 for props
// only ever seen small or far off; the default 1024); near: the closest the camera comes, in metres (2 by
// default): a map bigger than one texel to a pixel there is brought down to that (tools/texture-fit.mjs).
export const PROPS = [
  // Hal's car: the '71 muscle car, its paint a plain material the game fades and patches with primer
  { name: 'phoenix', src: 'assets/props/phoenix.glb', forward: '+z', length: 4.9, tex: 2048,
    title: "Phoenix 455 '71 - Low poly model", author: 'Daniel Zhabotinsky', uid: '955edc733c6d44fabc0ad7c246a15896' },
  // the cars in the lots, by the same artist
  { name: 'fairheaven', src: 'assets/props/fairheaven.glb', forward: '-x', length: 4.98,
    title: "Fairheaven LT '80 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'e2678da920cc4be68dbc193727919ffb' },
  { name: 'negotiator', src: 'assets/props/negotiator.glb', forward: '+x', length: 5.1,
    title: "Negotiator '80 - Low poly model", author: 'Daniel Zhabotinsky', uid: '892b2684fb37442299bfad9222cf331c' },
  { name: 'sialia', src: 'assets/props/sialia.glb', forward: '-x', length: 4.25,
    title: "Sialia SW '68 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'eea2291a90f04a4b860c9e74be14f2d6' },
  { name: 'fairheaven_sw', src: 'assets/props/fairheaven_sw.glb', forward: '-x', length: 5.0,
    title: "Fairheaven SW '84 - Low poly model", author: 'Daniel Zhabotinsky', uid: 'aa0becb6e854422596cac6b21bf79787' },
  // the city's emergencies (story/Emergencies.js): the police, the paramedics, a robber's gun, the
  // police line, the news helicopter over a city that's turned against Green Lantern
  { name: 'policecar', src: 'assets/props/policecar.glb', forward: '-x', length: 4.98,
    title: "Fairheaven LT '80 Cop Cruiser - Low poly model", author: 'Daniel Zhabotinsky', uid: '61766c1e6e1e4b2b803c174f33433a74' },
  { name: 'ambulance', src: 'assets/props/ambulance.glb', forward: '-x', length: 5.7, tex: 1024,
    title: "Shvan '92 Ambulance - Low poly model", author: 'Daniel Zhabotinsky', uid: '2856dd3c61f940909dced9a5c0379484' },
  { name: 'revolver', src: 'assets/props/revolver.glb', forward: '+z', length: 0.17, drop: /^Bullet/, tex: 512, // (anchored: its parent is "Gun_and_Bullets")
    title: '.38 Snub Nose Revolver', author: 'Ashe52', uid: 'ec633e69247e4ab29c8a38783027e8fb' },
  { name: 'policeline', src: 'assets/props/policeline.glb', forward: '+z', height: 0.95, tex: 512,
    title: 'Police Crowd Barrier', author: 'zurovsky7', uid: '8d112420532b48b8b5a11a4b8f33106f' },
  { name: 'helicopter', tris: 20000, error: 0.005, src: 'assets/props/helicopter.glb', forward: '+x', length: 10.7, tex: 1024,
    title: 'Helicopter', author: 'surveytown', uid: '5052016c9a3b4f3c82c206974aba3fbf' },
  // Ferris Aircraft's prototype on the apron
  // (it lies 39 degrees off its axis in the file: the yaw from the main gear to the nose wheel)
  { name: 'prototype', src: 'assets/props/f22.glb', forward: Math.atan2(4.19, 5.21), length: 18.9, tex: 2048,
    title: 'F22', author: 'manilov.ap', uid: '01b4128f65094d899e10c659e60f0858' },
  // Hal's phone (the maker's logo removed; the game draws its own screen)
  { name: 'phone', tris: 7000, error: 0.005, src: 'assets/props/phone.glb', forward: '-z', height: 0.1608, origin: 'centre', drop: /Apple[ _]?Logo/i,
    title: 'Apple iPhone 13 Pro Max', author: 'DatSketch', uid: '4328dea00e47497dbeac73c556121bc9' },
  // the lot behind Hal's building
  { name: 'palms', tris: 14000, error: 0.006, src: 'assets/props/palms.glb', forward: '+z', height: 10.5,
    title: 'Palm Trees', author: 'ElectroNick', uid: '20f8a8d5054b4191afb7cf3270dbd586' },
  // Hal's building, behind the lot
  { name: 'apartment', src: 'assets/props/apartment.glb', forward: '+z', height: 11.2, tex: 512,
    title: 'Apartment Complex Building', author: 'jimbogies', uid: 'fa7c256f511946fea3cd819e0f492741' },
  // Coast City: downtown and the street (six office blocks by one artist, in centimetres), the kit
  // of street furniture (traffic lights, lamps, hydrants, bins, a dumpster, a stop sign), a bus
  // shelter, a billboard
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ name: `office${i}`, src: `assets/props/office${i}.glb`, forward: '+z', scale: 0.01,
    title: i === 3 ? 'Mid rise wall to wall office building' : 'Low rise wall to wall office building', author: 'aitortilla01',
    uid: ['1f341f8261af4fb6a0dc910c2aae37a6', 'dcf171dca9174000a0fa8d44660253d0', '4d2c3f3450ef4e849056b88b49873ce2', '2dd3bdd5e0724eb1b1025a922fa754cf', 'be7583ca46f5411d8921ac85d8c33f3f', '6488ad5edd1d454884b3fe030f5f04b1'][i - 1] })),
  { name: 'cityprops', src: 'assets/props/cityprops.glb', forward: '+z', scale: 1, origin: 'keep',
    title: 'Street and City Props Dumpster Traffic Light', author: 'Spookyghostboo', uid: '27a6775c51e44bfda8e1ac8725eb3e9e' },
  { name: 'busstop', src: 'assets/props/busstop.glb', forward: '+z', height: 2.6,
    title: 'Bus Stop - low', author: 'Milionna', uid: '977fe8fc309548299cbc537f382e1a03' },
  { name: 'billboard', tris: 6000, error: 0.01, src: 'assets/props/billboard.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Billboard00 - Street Kitbash Collection', author: 'experiment_studio', uid: 'b66e0cf58c8d4f86bc2acd24c61c2d0b' },
  // Hal's kitchenette
  { name: 'fridge', src: 'assets/props/fridge.glb', forward: '+z', height: 1.52, opaque: true,
    title: 'Old Fridge', author: 'sergeilihandristov', uid: '6b2862c241754f5d81690e8664e41091' },
  { name: 'coffee', tris: 5000, error: 0.01, src: 'assets/props/coffee.glb', forward: '+z', height: 0.36, tex: 512,
    title: 'Coffee Maker', author: 'Ryan_Nein', uid: '383923d4412f4b66937d9c1779a9a0a2' },
  // the jet Martin Jordan flew, in the dream
  { name: 'f104', src: 'assets/props/f104.glb', forward: '+z', length: 16.7, tex: 512,
    title: 'F-104 Starfighter', author: 'Mikhail_Zelenov', uid: '96e60f2f463b4b1c8822079f1b2e21eb' },
  // on the apron and in the hangars
  { name: 'booth', src: 'assets/props/booth.glb', forward: '+z', scale: 1,
    title: 'Security Booth / Cabina de seguridad', author: 'claudio', uid: 'b15e6647ee434bcea57b2d965d3a1b30' },
  { name: 'stand', src: 'assets/props/stand.glb', forward: '+z', height: 2.27, tex: 512,
    title: 'Hangar | Midpoly | Access stand', author: 'sauti', uid: '46b3d3077d304c5695ef4ceef7685970' },
  { name: 'fueltruck', src: 'assets/props/fueltruck.glb', forward: '-z', length: 8.4,
    title: 'Airport Fuel Truck', author: 'Nguyentuannghia 64', uid: '15a96ac34ece464480a9b8620dc3a3d3' },
  { name: 'tug', tris: 9000, error: 0.01, src: 'assets/props/tug.glb', forward: '+x', length: 3.3,
    title: 'Airport Tug', author: 'flightmaster177', uid: '388e668f8143432fb82c1268e1f9ab81' },
  { name: 'cones', src: 'assets/props/cones.glb', forward: '+z', scale: 1,
    title: 'Traffic Cones', author: 'NotAnotherApocalypticCo.', uid: 'e03b1d2dfdc0416bb8324d15573ea60c' },
  { name: 'forklift', src: 'assets/props/forklift.glb', forward: '+z', length: 3.3,
    title: 'Forklift low poly', author: 'Ricardo Sanchez', uid: '8ab650b3982243f8b661142de50f79c9' },
  { name: 'toolbox', src: 'assets/props/toolbox.glb', forward: '+z', height: 1.02, tex: 512,
    title: 'Industrial Toolbox', author: 'LuddePudde', uid: '5037b5bea4bf4bd7bf53d581d478bd90' },
  { name: 'drums', src: 'assets/props/drums.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Oil Drums', author: 'Oliver Triplett', uid: 'f98003d19cd247f8aa4daad50c28512a' },
  // the Air Force's night at the lake (Part Three: Hector Hammond at the wreck)
  { name: 'm35', src: 'assets/props/m35.glb', forward: '+z', length: 6.78, tex: 1024,
    title: 'Military Truck 1/2 Ton', author: 'Arion Digital', uid: '5d19c751b12849eeb390d637b2b686a1' },
  { name: 'lighttower', src: 'assets/props/lighttower.glb', forward: '+z', length: 3.8, tex: 512,
    title: 'Light Tower', author: 'krambulini', uid: '9addea6a4129438b83a1fc3ed4a784ec' },
  // Martin Jordan's grave: the memorial park on the edge of Coast City
  { name: 'tombstones', src: 'assets/props/tombstones.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Tombstones', author: 'LucasPresoto', uid: '4f1a26f1cef2403d8aafddccbf5fafc3' },
  { name: 'cemgate', src: 'assets/props/cemgate.glb', forward: '+z', scale: 1, tex: 1024,
    title: 'Graveyard Entrance', author: 'Reydara', uid: 'e0aa0d480159465fa26795c26546a3b6' },
  { name: 'ironfence', src: 'assets/props/ironfence.glb', forward: '+z', scale: 1, tex: 512,
    title: 'CC0 - Iron Fence', author: 'plaggy', uid: '9c5ad29c104c48e69a1227927655d489' },
  { name: 'cypress', tris: 9000, error: 0.01, src: 'assets/props/cypress.glb', forward: '+z', height: 6.5, tex: 512,
    title: 'Cypress tree', author: 'ElectroNick', uid: '249d8cb553a8469e9d645713f8e96ed1' },
  { name: 'bench', src: 'assets/props/bench.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Granite Bench', author: 'YouniqueĪdeaStudio', uid: '424c3679dcdd44d380da36a82f5dc382' },
  // Part Four: the building site downtown where Atrocitus is found
  { name: 'excavator', src: 'assets/props/excavator.glb', forward: '+z', length: 9.4, tex: 1024,
    title: 'Excavator Animation', author: 'tori1243', uid: '940258497f9f4eba9710bb359a9e777e' },
  { name: 'girders', src: 'assets/props/girders.glb', forward: '+z', scale: 0.01, tex: 512,
    title: 'Steel Girder Kit', author: 'Dumokan Art', uid: '506c9743618f4d4aa28c24fbcf720036' },
  { name: 'crane', src: 'assets/props/crane.glb', forward: '+z', scale: 1, simplify: 0.35, tex: 512,
    title: 'Liebherr tower crane', author: 'Cem Alagozlu', uid: '0f8befc223734608a5d54aad4904951f' },
  { name: 'chainlink', src: 'assets/props/chainlink.glb', forward: '+x', height: 2.3, tex: 512,
    title: 'Modular Chain Link Fence Set', author: 'FrodoUndead', uid: 'bd85a8005ff0403cab2f1e9845016b8f' },
  { name: 'container', src: 'assets/props/container.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Classic Shipping Container (Free/Gameready)', author: 'Sebastian Webster', uid: '772f4be391a245f699c54e6cf157c58d' },
  { name: 'barriers', src: 'assets/props/barriers.glb', forward: '+z', scale: 0.3, tex: 512,
    title: 'Road Barrier Collection', author: 'Miguel Teixeira', uid: 'bbc824137db540cabcccb0091fcd3222' },
  { name: 'roadclosed', src: 'assets/props/roadclosed.glb', forward: '+z', height: 1.5, tex: 512,
    title: 'Road barrier "ROAD CLOSED"', author: 'TCJ', uid: 'a991c728eedb4f11b675f47039512151' },
  { name: 'mixer', src: 'assets/props/mixer.glb', forward: '+z', height: 1.35, drop: /^Circle$/, tex: 512,
    title: 'Concrete Mixer', author: 'gorzi', uid: '7e282605bdc74e15bcd02edd4b84637c' },
  { name: 'pipe', src: 'assets/props/pipe.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Concrete pipe (Game ready)', author: 'PT34', uid: '92d1cbc20e8c440aad9be60586d5efa6' },
  { name: 'bricks', src: 'assets/props/bricks.glb', forward: '+z', scale: 0.6, tex: 512,
    title: 'Stack Of Bricks (Game Ready / 2K PBR)', author: 'Meerschaum Digital', uid: '1a9092ab6cb243d990fddad116f04825' },
  { name: 'portapotty', src: 'assets/props/portapotty.glb', forward: '+z', height: 2.3, tex: 512,
    title: 'Porta-potty', author: 'save_screen', uid: 'eb7025cc094746c4a44fec4cdcb1f55b' },
  { name: 'pipepallets', src: 'assets/props/pipepallets.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Pipes on pallets', author: 'Monsta3D', uid: 'd355399809554fc8b63a8c358602cb66' },
  // Part Four: Ysmault, the prison world of Sector 666
  { name: 'cliff', src: 'assets/props/cliff.glb', forward: '+z', scale: 0.01, tex: 1024,
    title: 'Desert Cliff 6', author: 'WireframeArt', uid: 'ed2e9c7e976e4768868481e4a5c63f6f' },
  { name: 'obelisks', src: 'assets/props/obelisks.glb', forward: '+z', height: 9, tex: 1024,
    title: 'Rock Obelisks - Obelisks', author: 'Olivier Dupras', uid: 'c0d5d872d4ec48b5b794f1fae4cb697a' },
  { name: 'chain', src: 'assets/props/chain.glb', forward: '+z', height: 4, tex: 512,
    title: 'Iron chain', author: 'dabori', uid: '6d079f01c7c142e0be54d7f2d33b33e6' },
  { name: 'shackles', src: 'assets/props/shackles.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Rusted Chain Shackles', author: 'SangeetBlaze', uid: '924c7cc2ee074e57a81cc82b58e0ac6f' },
  { name: 'rocks', src: 'assets/props/rocks.glb', forward: '+z', scale: 0.01, tex: 512,
    title: 'Assorted Rock Pack', author: 'HenryBoadle', uid: '30592fd5e15640acaebeac8b2eb7a176' },
  // Coast City's street and its buildings' details (src/city)
  { name: 'ac_units', src: 'assets/props/ac_units.glb', forward: '+z', scale: 0.0257, drop: /_AC1_/, tex: 512,
    title: 'AC Units', author: 'caboose3d', uid: '45891324537a48a4804c3500415d7fb1' },
  { name: 'ac_window', tris: 900, error: 0.02, src: 'assets/props/ac_window.glb', forward: '+z', scale: 1, tex: 512,
    title: 'Window AC Unit-Freepoly.org', author: 'blackrray', uid: 'ef88c605671549fcb5c1d10a8a68460a' },
  { name: 'newsbox', tris: 2000, error: 0.02, src: 'assets/props/newsbox.glb', forward: '+z', height: 1.11, tex: 512,
    title: 'Day 026: News Paper Box', author: 'uttamg911', uid: 'ba846281a00547d19c7daf6ce8949ffc' },
  { name: 'meter', tris: 1200, error: 0.02, src: 'assets/props/meter.glb', forward: '+z', height: 1.5, tex: 512,
    title: 'Parking Meter', author: 'ArcherSterling', uid: 'a1932b57521c4aa1b0148d1e6ad6b7aa' },
  { name: 'mailbox', src: 'assets/props/mailbox.glb', forward: '+z', height: 1.25, tex: 512,
    title: 'US Mailbox', author: 'yrdoes', uid: '3376b03ebf1d45ea99fbb6ff350489da' },
  { name: 'payphone', src: 'assets/props/payphone.glb', forward: '+z', height: 0.55, tex: 512,
    title: 'Payphone', author: 'n.tendetnik', uid: 'f5ba356c10624413ac881513175adbfd' },
  { name: 'vending', tris: 2500, error: 0.01, src: 'assets/props/vending.glb', forward: '+z', height: 1.83, tex: 512,
    title: 'Early 90s Vending Machine', author: 'gregthorburn', uid: '94c002a46f7f4ac498b294e69e4e62cf' },
  { name: 'dish', src: 'assets/props/dish.glb', forward: '+z', height: 0.85, tex: 512,
    title: 'Rusty House Satellite Dish', author: 'TomasKiniulis', uid: '929f056abe02416da19d7b1aa805d235' },
  { name: 'neon_palm', tris: 3500, error: 0.008, src: 'assets/props/neon_palm.glb', pitch: -Math.PI / 2, forward: '-z', height: 1.1, tex: 512,
    title: 'Neon Palm Tree Sign', author: 'kirkieb2', uid: 'f8366d37c75b4a92b784ffbb72f3900a' },
  { name: 'neon_oil', src: 'assets/props/neon_oil.glb', forward: '+z', height: 0.5, origin: 'centre', tex: 512,
    title: 'Wilstone Oil Neon', author: 'skudgee', uid: 'c5827592d8e9416d8821e9bebf10f17f' },
  { name: 'fireescape', tris: 9000, error: 0.005, src: 'assets/props/fireescape.glb', forward: '+z', scale: 0.01, tex: 1024,
    title: 'Fire Escape', author: 'KnightFallows', uid: '8b33ab96b91a45b1bdaa81b3effd7970' },
  { name: 'elecboxes', src: 'assets/props/elecboxes.glb', forward: '+x', scale: 1, tex: 512,
    title: 'Electrical Boxes', author: 'outlier_spa', uid: 'e5a058d5210448e5b2640cdb3fbcb163' },
  { name: 'cabinet', src: 'assets/props/cabinet.glb', forward: '+z', height: 1.4, tex: 512,
    title: 'Electrical box - FREE', author: 'Mathieu.Godard', uid: '383a234d6d80421fbe67080048cbbc70' },
  { name: 'wheelie', src: 'assets/props/wheelie.glb', forward: '+z', height: 1.07, tex: 512,
    title: 'Trash Can', author: 'longtail', uid: 'f61aeec14ff441abb0f6add5485a2e90' },
  { name: 'parkbench', tris: 2500, error: 0.01, src: 'assets/props/parkbench.glb', forward: '+z', scale: 0.15, tex: 512,
    title: 'Bench', author: 'sparkb', uid: '07fb4d364c0c4555a14c86e915542378' },
  { name: 'propane', tris: 2500, error: 0.01, src: 'assets/props/propane.glb', forward: '+z', scale: 0.027, drop: /CRTank|^Leg\d|pCube[5-8]_Metal|pCylinder[78]_Metal/, tex: 512,
    title: 'Propane Tanks', author: 'caboose3d', uid: 'c2fe560433dd408691b8ec5ab2695d51' },
  { name: 'powerpole', tris: 9000, error: 0.004, src: 'assets/props/powerpole.glb', forward: '+z', height: 9.5, tex: 512, // (simplified, its wires went)
    title: 'Electricity Pole', author: 'Helindu', uid: '7cb81ca1f1f045889cf5917b9ead7817' },
  { name: 'planter', src: 'assets/props/planter.glb', forward: '+z', height: 0.8, tex: 512,
    title: 'Potted Plant, Mediterranean flowering, low poly', author: 'dudecon', uid: 'b8950690664342a497154a8ad2787566' },
  { name: 'barberpole', tris: 1500, error: 0.01, src: 'assets/props/barberpole.glb', forward: '+z', height: 0.75, tex: 512,
    title: 'Barbers Pole', author: 'HPrendering', uid: 'e5eb506d8d5c4cd5a775028a4a3e1d58' },
  { name: 'cart', src: 'assets/props/cart.glb', forward: '+z', height: 1.0, tex: 512,
    title: 'Shopping Cart', author: 'adrianxy', uid: 'b96f896453b240ae804d0399f1faf027' },
  // Part Seven: the hot dog stand on the pier's head, packing up at one in the morning
  { name: 'hotdog', src: 'assets/props/hotdog.glb', forward: '+z', height: 2.97, tex: 1024, // (modelled at 0.68 of a real one: its counter was 65 cm high)
    title: 'New York Hot Dog Cart', author: 'outlier_spa', uid: 'd363905ab6db442789acf06e031e2b21' },
  { name: 'dog', src: 'assets/props/dog.glb', forward: '+x', length: 0.19, tex: 512,
    title: 'Hotdog lowpoly (7k tris) 3D scan', author: 'Xeverian', uid: '091345bcc34f4e95a85843e551eadbe7' },
  // Part Seven's sting: the preparation room under the Hand family's funeral home (scenes/Mortuary.js)
  { name: 'autopsy', src: 'assets/props/autopsy.glb', forward: '+z', scale: 1, tex: 1024,
    title: 'Autopsy Lab - Assets', author: 'Evan Petrov', uid: '5ceaaa4482a84774b9922366cfb228e7' },
  { name: 'fluoro', src: 'assets/props/fluoro.glb', forward: '+z', length: 1.22, tex: 512,
    title: 'Old Fluorescent Light', author: 'andrej.lit', uid: 'd01f22878869428192044f7ff297090a' },
  { name: 'desklamp', src: 'assets/props/desklamp.glb', forward: '+z', height: 0.46, tex: 512,
    title: 'Vintage Electric Desk Lamp', author: 'Oleksandr Tserkovniy', uid: '9f8471ec5e3a460b8384e43cca716ae7' },
  // inside Rosie's Diner and Coast Liquor (src/city/Interiors.js)
  { name: 'booth', src: 'assets/props/booth.glb', forward: '+z', height: 1.1, tex: 1024,
    title: 'Diner Booth', author: 'izrafan', uid: '00110b996d944a658db8f24c6ccf36ec' },
  { name: 'stool', src: 'assets/props/stool.glb', forward: '+z', height: 0.76, tex: 512,
    title: 'Diner Stool', author: 'MickChambers', uid: '861c5e689ac2483f8083003d2dc64b16' },
  { name: 'jukebox', src: 'assets/props/jukebox.glb', forward: '+z', height: 1.55, tex: 1024,
    title: 'Jukebox', author: 'I_Live', uid: '127cd1a00ca143af9db9cf4e58ddd956' },
  { name: 'espresso', tris: 4000, error: 0.01, src: 'assets/props/espresso.glb', forward: '+z', height: 0.55, tex: 512,
    title: 'Commercial Coffee Machine', author: 'mreslan', uid: 'bab05bc7805d4b0dbc2cdcbb48441956' },
  { name: 'napkins', src: 'assets/props/napkins.glb', forward: '+z', height: 0.16, tex: 256,
    title: 'Diner Napkin Dispenser', author: 'MickChambers', uid: '1ecc2a062c8b47b791480efb697e4d12' },
  { name: 'ketchup', src: 'assets/props/ketchup.glb', forward: '+z', height: 0.2, tex: 256,
    title: 'Condiment Bottle', author: 'legobus5', uid: 'f1b71bc8830d4774a224a3cb472313d0' },
  { name: 'wallshelf', tris: 3000, error: 0.01, src: 'assets/props/wallshelf.glb', forward: '+z', height: 2.0, tex: 1024,
    title: 'Store Wall Shelving', author: 'jimbogies', uid: '4aeb9d62cde942a9804172af11321d2c' },
  { name: 'cooler', src: 'assets/props/cooler.glb', forward: '+z', height: 1.95, tex: 512,
    title: 'Low Poly Gas Station Fridge', author: 'LB_Models', uid: 'f146f66f8bc84829895e05de6895f0dc' },
  { name: 'atm', tris: 1800, error: 0.01, src: 'assets/props/atm.glb', forward: '+z', height: 1.6, tex: 1024,
    title: 'ATM Machine', author: 'oscarherry3d', uid: '22ca75eb5e0d4ee0a02c5b5100a55006' },
  { name: 'magrack', src: 'assets/props/magrack.glb', forward: '+z', height: 1.15, tex: 1024,
    title: 'Magazine Rack Full of Geo Articles', author: 'Brendan_489', uid: '53f55fbd5c0b4c1cbc219bb717b6819e' },
  { name: 'oldregister', tris: 1500, error: 0.015, src: 'assets/props/oldregister.glb', forward: '+z', height: 0.42, tex: 1024,
    title: 'Old Cash Register_PBR', author: 'Li.Wenzhao', uid: 'cfdc8b3756fa4bb4b7c26d8ac92fd1bc' },
  // Zamaron (Part Seven): the violet crystal's world (scenes/Zamaron.js re-skins the crystals in its own light)
  { name: 'crystal_cluster', src: 'assets/props/crystal_cluster.glb', forward: '+z', height: 6, tex: 512,
    title: 'Crystal Cluster', author: 'WhiteWinterprison', uid: 'e920cf6b57d642a3a03c76c847031f1f' },
  { name: 'crystal_giant', src: 'assets/props/crystal_giant.glb', forward: '+z', height: 10.7, tex: 1024,
    title: 'Giant crystal formation', author: 'chrisconn', uid: 'e2e2be20c11545fb801659bd2c8ecee6' },
  { name: 'crystal_formation', src: 'assets/props/crystal_formation.glb', forward: '+z', height: 2.2, tex: 512,
    title: 'Crystal Formation', author: 'jbeedle252', uid: 'b70726824a0d44c0bd4f5e98be299651' },
  { name: 'crystal_rocks', src: 'assets/props/crystal_rocks.glb', forward: '+z', height: 1.2, tex: 1024,
    title: 'Crystals', author: 'AlexOlTroi', uid: '9cfd21f096254bc08cbbb410d4798eb0' },
  { name: 'amethyst', tris: 24000, error: 0.004, src: 'assets/props/amethyst.glb', forward: '+z', height: 4, tex: 1024,
    title: 'Amethyst crystal', author: 'panomedia', uid: '671adaa900014ca88993fa81c27f7e5e' },
  { name: 'crystal_shard', src: 'assets/props/crystal_shard.glb', forward: '+z', height: 3, tex: 1024,
    title: 'Purple Crystal', author: 'emmashanks', uid: 'd4f635c56cea426bac50263a5bd740af' },
  { name: 'stibnite', tris: 16000, error: 0.004, src: 'assets/props/stibnite.glb', forward: '+z', height: 3, tex: 1024,
    title: 'Stibnite (antimony)', author: 'NaRoCreations', uid: '79b0a78e32fc4d65accbc5fc60d077d6' },
  { name: 'plant_glow', src: 'assets/props/plant_glow.glb', forward: '+z', height: 1.4, tex: 512,
    title: 'Alien Plant (Cydrakoniss)', author: 'Blake_Stahlbaum', uid: 'd940adfc452146efacc2cbb63fa2c01d' },
  { name: 'plant_bulbs', src: 'assets/props/plant_bulbs.glb', forward: '+z', height: 3.5, tex: 512, drop: /^(pot|dirt)/,
    title: 'Alien Plant', author: 'green364', uid: '142addd0188c49e18e6d836fb9dfe813' },
  // the Predator, love's entity (enemies/Predator.js gives it its violet): a wyvern rigged with its own
  // skeleton and clips, kept whole (the rig's control widgets dropped); fifteen metres, nose to tail
  { name: 'predator', src: 'assets/props/predator.glb', forward: '+z', length: 15, tex: 1024, drop: /Shape|^Circle_0$/,
    title: 'Prowler Dragon Variant Rig', author: 'DM-913 (SuperKapoo913)', uid: '7ee71aaf323d426bbbdf28d73d55bbd9' },
];

const YAW = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await mkdir('public/models/props', { recursive: true });

for (const p of PROPS) {
  if (ONLY && !ONLY.split(',').includes(p.name)) continue;
  const doc = await io.read(p.src);
  const root = doc.getRoot(), scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (p.drop) for (const n of root.listNodes()) if (p.drop.test(n.getName())) n.dispose();
  if (p.opaque) for (const m of root.listMaterials()) m.setAlphaMode('OPAQUE');
  // one root node carries the correction, so the model's own parts keep their pivots
  const top = doc.createNode(p.name);
  for (const c of scene.listChildren()) { scene.removeChild(c); top.addChild(c); }
  scene.addChild(top);
  const yaw = typeof p.forward === 'number' ? p.forward : YAW[p.forward];
  // pitch (about x, first): for a model lying on its back in the file (the neon palm)
  const pt = (p.pitch ?? 0) / 2, yw = yaw / 2;
  top.setRotation([Math.cos(yw) * Math.sin(pt), Math.sin(yw) * Math.cos(pt), -Math.sin(yw) * Math.sin(pt), Math.cos(yw) * Math.cos(pt)]);
  let b = getBounds(scene);
  const size = [0, 1, 2].map((i) => b.max[i] - b.min[i]);
  const s = p.scale ?? (p.length ? p.length / size[2] : p.height / size[1]);
  top.setScale([s, s, s]);
  b = getBounds(scene);
  const c = [0, 1, 2].map((i) => (b.max[i] + b.min[i]) / 2);
  if (p.origin !== 'keep') top.setTranslation([-c[0], p.origin === 'centre' ? -c[1] : -b.min[1], -c[2]]);
  b = getBounds(scene);
  const tex = p.tex ?? 1024;
  // simplified to a share (`simplify`) or to about `tris` triangles, within `error` (of each part's size:
  // the default 0.002 kept a newspaper box at 42,000 triangles, a parking meter at 8,700)
  const triCount = () => doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, q) => k + (q.getIndices()?.getCount() ?? q.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const ratio = p.tris ? Math.min(1, p.tris / triCount()) : p.simplify;
  if (ratio && ratio < 1) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: p.error ?? 0.002 }));
  // the textures: each at most `tex`, and no more than a texel to a pixel from `near`; then fitted and
  // GPU-compressed (KTX2, tools/texture-fit.mjs)
  let rows = [];
  await doc.transform(
    metalRough(),
    dedup(),
    prune(),
    fitTextures({ cap: (slot, t) => Math.min(tex, neededSize(t, { near: p.near ?? 2 })), report: (r) => { rows = r; } }),
  );
  const out = `public/models/props/${p.name}.glb`;
  await io.write(out, doc);
  const mb = (await stat(out)).size / 1e6;
  if (mb > 25) throw new Error(`${out} is ${mb.toFixed(1)} MB: over the repo's 25 MB a file (lower its \`tex\`)`);
  console.log(`${p.name}: ${[0, 1, 2].map((i) => (b.max[i] - b.min[i]).toFixed(2)).join(' x ')} m, ${mb.toFixed(1)} MB; ${fitted(rows)}`);
}

// the credits, from the same list
const lines = PROPS.map((p) => `- **${p.title}** by ${p.author}, [sketchfab.com/3d-models/${p.uid}](https://sketchfab.com/3d-models/${p.uid}), licensed [${BY}](https://creativecommons.org/licenses/by/4.0/). Used as \`${p.name}\`; reoriented, rescaled, textures recompressed${p.drop ? ', parts removed' : ''}${p.simplify || p.tris ? ', simplified' : ''}${p.opaque ? ', materials made opaque' : ''}.`);
await writeFile('CREDITS.md', `# Credits

The game's code is MIT (see \`LICENSE\`). These third-party 3D models are not: each keeps its own
licence. They come from [Sketchfab](https://sketchfab.com) by way of the
[Objaverse](https://huggingface.co/datasets/allenai/objaverse) dataset. The originals are in
\`assets/props/\`; \`npm run props\` (\`tools/build-props.mjs\`) builds the game's copies in
\`public/models/props/\`, and writes this file.

## Props

${lines.join('\n')}

## Textures

${TEXTURES.map((t) => `- **${t.id}** from [Poly Haven](https://polyhaven.com/a/${t.id}), [CC0](https://creativecommons.org/publicdomain/zero/1.0/): ${t.use}. Fitted and converted to KTX2 at 1K or less (\`public/textures/pbr/\`, \`tools/fetch-textures.mjs\`).`).join('\n')}

## Voices

Every spoken line is pre-rendered (\`public/voices/\`, \`npm run voices\`, \`tools/build-voices.mjs\`) with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) by hexgrad, licensed
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), using the ONNX export
[onnx-community/Kokoro-82M-v1.0-ONNX-timestamped](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped)
(Apache-2.0) through [kokoro-js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) (Apache-2.0).
Each character's voice is a Kokoro voice shifted in pitch and processed for the part.

## People

Coast City's people (\`public/models/people/\`, \`tools/build-people.mjs\`) are from the
[Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), Copyright (c)
2020 Microsoft, released under the [MIT License](https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md)
(its text is in \`assets/people/LICENSE-Rocketbox.md\`), taken from the GLB conversion
[codepawl/rocketbox-avatars-glb](https://huggingface.co/datasets/codepawl/rocketbox-avatars-glb) on Hugging
Face. Gonzalez-Franco et al., *The Rocketbox library and the utility of freely available rigged avatars*,
Frontiers in Virtual Reality 2020, doi:10.3389/frvir.2020.561558. Changed: moved onto the game's skeleton
(the Biped's weights folded onto it, the fingers and eyes kept), seven of the face blendshapes kept,
textures resized.

## Animation

- Mixamo clips (\`assets/mocap/\`, \`public/anims/\`), from the three.js examples, under Mixamo's terms.

## Software

- The shop signs are compressed in the browser (\`src/city/SignWorker.js\`) by the prebuilt WebAssembly encoder
  of [Basis Universal](https://github.com/BinomialLLC/basis_universal) 2.50 (\`public/basis/basis_encoder.js\`,
  \`basis_encoder.wasm\`), unmodified, licensed [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) (its
  \`LICENSE\` and \`NOTICE\` are beside it): Basis Universal™ Supercompressed GPU Texture Compression Library,
  Copyright © 2016–2026 Binomial LLC. "Basis Universal" is a trademark of Binomial LLC.
`);
console.log('wrote CREDITS.md');
