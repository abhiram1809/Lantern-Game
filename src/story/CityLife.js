import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { POSES, still, makePose } from '../characters/Poses.js';
import { loadPeople, createPerson, eyesOf } from '../characters/People.js';
import { LOT } from '../scenes/Ferris.js';
import { wait, onFrame } from '../engine/Time.js';
import { LINES } from './lines.js';
import { DinerLife } from './DinerLife.js';
import { streetX, STREET_Z, K_MIN, K_MAX, FREEWAY, NS, EW } from '../city/Plan.js';
import { breath } from '../engine/Slice.js';

// The rest of the city's people (2026-11-19, the user: "there is no life outside of this block... the
// same everywhere, but more randomized. I don't mind if you reuse stuff"): `roamer`s, the block's walkers'
// models again, out on every pavement of the grid near the camera (city/Plan.js), down the middle of
// each (9.5 m off a north-south street's middle, 8.5 off an east-west one), over the crosswalks at the
// corners, on at each corner or round it; put down where nobody's looking when the camera leaves them,
// half of them home by night. Everything the block's people do they do (talk, stop and look up at him,
// run from a construct, see him change).
const PATH_NS = (NS.kerb + NS.front) / 2, PATH_EW = (EW.kerb + EW.front) / 2;
const XC = []; for (let k = K_MIN; k <= K_MAX; k++) XC.push(streetX(k) - PATH_NS, streetX(k) + PATH_NS);
const ZC = []; for (let i = 1; i < STREET_Z.length; i++) ZC.push(STREET_Z[i] - PATH_EW, STREET_Z[i] + PATH_EW);
XC.sort((a, b) => a - b); ZC.sort((a, b) => a - b);
// a stretch of pavement they may walk (the lot's frame): in the city, not on Hal's blocks (their own
// people) or under the freeway's ramp
const roamOK = (axis, fixed, a, b) => {
  const m = (a + b) / 2, x = axis === 'z' ? fixed : m, z = axis === 'z' ? m : fixed;
  if (x < XC[0] - 1 || x > XC[XC.length - 1] + 1 || z < ZC[0] - 1 || z > ZC[ZC.length - 1] + 1) return false;
  if (x > -48 && x < 64 && z < 64) return false;
  if (Math.abs(z - FREEWAY.z) < 12 && x < FREEWAY.westTop + 12) return false;
  return true;
};
// the ground under a point of the grid's (the lot's frame): the road, or a pavement's 14 cm up
const gridGround = (x, z) => {
  const k = Math.round((x - 6) / 80), dx = Math.abs(x - streetX(k));
  const dz = STREET_Z.reduce((m, sz) => Math.min(m, Math.abs(z - sz)), Infinity);
  return dx < NS.kerb || dz < EW.kerb ? 0 : PAVE;
};
const nextOf = (list, u, dir) => { if (dir > 0) { for (const v of list) if (v > u + 0.01) return v; } else { for (let i = list.length - 1; i >= 0; i--) if (list[i] < u - 0.01) return list[i]; } return null; };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _c = new THREE.Vector3(), _s = new THREE.Vector3(), _sph = new THREE.Sphere();

// Hal's block with people on it (2026-11-18; the user's notes the same day: "they are not that
// intelligent... no one is serving them", "I want to be able to hear whispers", "Hal should not be
// allowed to change into Green Lantern if he's in someone's field of view"). Rocketbox's people
// (characters/People.js) on the mocap.
// - The street: walkers up and down both pavements and over the crosswalk, keeping right, stepping
//   round Hal, slowing behind someone slower, glancing at him as they pass; the loop's open end (the
//   lot, where the pavements stop) is crossed out of sight, as games spawn their pedestrians. People
//   at the bus stop, a man on his phone, two friends outside Sunny's. Some of them go into Rosie's to
//   eat, and come out again (story/DinerLife.js: Rosie's service, Dot's kitchen, the customers).
// - What Hal hears: E beside anyone, they turn to him and say something in their own voice (to Hal
//   Jordan, or to Green Lantern); Rosie talks with him. People near him talk among themselves
//   (`TALKS`, overheard on a channel of their own, as loud as he is close), and whisper about him
//   (Martin Jordan's boy, the Ferris pilot) or about Green Lantern; under their breath as Green Lantern
//   walks by. The jaw moves on the voice.
// - Who sees him (`seenBy`): anyone facing him, within sight of him, with nothing solid between. He
//   changes only where no one can (story/Roam.js).
// - Reactions: Green Lantern flying low, they stop and look up, the kids point, someone calls out; a
//   construct cast near them, the street runs, crouches, then goes back to where it was.
// By night half the walkers and the bus stop's people go home. Far from the camera nobody's drawn.

// block-local (x across, z along the boulevard; the block's origin is LOT)
const PAVE = 0.14, FLOOR = 0.15;
const ground = (x, z) => (x < -0.4 || x > 12.4 ? PAVE : 0) * (z > -206 || (z < -215.5 && z > -404) ? 1 : 0); // (Hal's block, the cross street, the block south of it)
// the walkers' loop: down the west pavement, over the crosswalk at the corner, up the east one (out
// round the bus stop's shelter and the people waiting by it); the last leg, from the east pavement's
// north end back to the west's, is the lot, and is crossed out of sight
const LOOP = [[-3.45, -27], [-3.45, -199], [-2.6, -201.9], [-0.7, -201.9], [12.7, -201.9], [14.6, -201.9], [15.5, -199], [15.5, -131.5], [16.35, -129.5], [16.35, -112], [15.5, -110], [15.5, -27]];
// and the block over the crossing (city/HalsBlock.js WEST2, EAST2): up its east pavement, over the
// crosswalk at the crossing, down the west one (round the bus stop); the leg back over the boulevard at
// its far end crossed out of sight
const LOOP2 = [[15.5, -394], [15.5, -222], [14.6, -218.3], [12.7, -218.3], [-0.7, -218.3], [-2.6, -218.3], [-3.45, -222], [-3.45, -330.5], [-4.3, -332.5], [-4.3, -348], [-3.45, -350], [-3.45, -394]];

// who's where (Rocketbox ids, tools/build-people.mjs), each with a voice and how Hal hears them named
const STAFF = {
  rosie: { id: 'female-adult-02', voice: 'rosie', label: 'Rosie' },
  cook: { id: 'chef-female-01', voice: 'cook', label: 'Dot' },
  clerk: { id: 'male-adult-14', voice: 'clerk', label: 'Ray' },
  shopper: { id: 'female-adult-13', voice: 'townf3', label: 'A woman' },
};
// the diner's first customers (DinerLife seats them): a couple across a booth, a man by the window,
// Dale at the counter with his coffee
const DINERS = [
  { id: 'male-adult-02', voice: 'townm1', label: 'A man', seat: 'booth1A', tag: 'coupleM', phase: 'eating', food: 'melt' },
  { id: 'female-adult-15', voice: 'townf2', label: 'A woman', seat: 'booth1B', tag: 'coupleF', phase: 'eating', food: 'soup' },
  { id: 'business-male-02', voice: 'townm3', label: 'A man', seat: 'booth4B', phase: 'wait' },
  { id: 'delivery-male-01', voice: 'townm2', label: 'A man', seat: 'stool9', tag: 'dale', phase: 'eating', food: 'coffee' },
];
const STANDS = [
  { id: 'male-adult-12', voice: 'townm3', label: 'A man', tag: 'phone', at: [-5.42, -97.3], yaw: Math.PI / 2 - 0.35, does: 'phone' }, // on his phone against Coast Liquor's front, by the payphone
  { id: 'female-adult-08', voice: 'townf2', label: 'A woman', tag: 'mother', at: [14.55, -117.2], yaw: 0.25, does: 'wait', day: true }, // the bus stop: a mother and her two
  { id: 'female-child-01', voice: 'citykid', label: 'A girl', tag: 'girl', at: [14.05, -116.75], yaw: 0.6, does: 'wait', day: true },
  { id: 'male-child-01', voice: 'citykid', label: 'A boy', at: [13.55, -117.45], yaw: -0.4, does: 'wait', day: true },
  { id: 'male-adult-13', voice: 'townm1', label: 'A man', at: [13.32, -120.4], yaw: Math.PI / 2, does: 'sit', sit: 0.46, day: true }, // on the shelter's seat
  { id: 'female-adult-01', voice: 'townf1', label: 'A woman', tag: 'friendA', at: [17.15, -54.35], partner: 'friendB', does: 'chat', day: true }, // two friends outside Sunny's
  { id: 'female-adult-05', voice: 'townf3', label: 'A woman', tag: 'friendB', at: [16.95, -55.5], partner: 'friendA', does: 'chat', day: true },
];
const WALKERS = ['male-adult-01', 'female-adult-07', 'male-adult-04', 'female-adult-17', 'male-adult-06', 'female-party-02', 'male-adult-08',
  'business-female-03', 'male-adult-11', 'male-adult-16', 'construction-male-07', 'male-adult-20', 'male-adult-17'];
const WALKERS2 = ['female-adult-14', 'male-adult-21', 'business-female-02', 'construction-male-01', 'business-male-03', 'medical-male-02'];

// what they say when he talks to them: by voice, to Hal in his clothes (`hal`) or to Green Lantern (`gl`)
const TALK = {
  townm1: { hal: ['cityM1a', 'cityM1b', 'cityM1c', 'cityM1d'], gl: ['cityGM1', 'cityGM4'] },
  townm2: { hal: ['cityM2a', 'cityM2b', 'cityM2c', 'cityM2d'], gl: ['cityGM2', 'cityGM5'] },
  townm3: { hal: ['cityM3a', 'cityM3b', 'cityM3c'], gl: ['cityGM3', 'cityGM6'] },
  townf1: { hal: ['cityF1a', 'cityF1b', 'cityF1c'], gl: ['cityGF1', 'cityGF4'] },
  townf2: { hal: ['cityF2a', 'cityF2b', 'cityF2c'], gl: ['cityGF2', 'cityGF5'] },
  townf3: { hal: ['cityF3a', 'cityF3b', 'cityF3c'], gl: ['cityGF3', 'cityGF6'] },
  citykid: { hal: ['cityK1', 'cityK2'], gl: ['cityGK1', 'cityGK2'] },
  cook: { hal: ['cook1', 'cook2'], gl: ['cookG1'] },
  clerk: { hal: ['clerk1', 'clerk2', 'clerk3', 'clerk4'], gl: ['clerkG1', 'clerkG2'] },
};
// what people near him say among themselves: who's in it (tags), when it can happen, and the
// exchanges (member index, line): out loud (`ambient`), whispered about Hal Jordan (`hal`), or about
// Green Lantern (`gl`)
const TALKS = [
  { members: ['coupleM', 'coupleF'],
    ambient: [[[0, 'ovCa1'], [1, 'ovCa2'], [0, 'ovCa3']], [[1, 'ovCb1'], [0, 'ovCb2'], [1, 'ovCb3']], [[0, 'ovCc1'], [1, 'ovCc2']]],
    hal: [[[1, 'ovCh1'], [0, 'ovCh2'], [1, 'ovCh3']], [[0, 'ovCi1'], [1, 'ovCi2']]],
    gl: [[[1, 'ovCg1'], [0, 'ovCg2'], [1, 'ovCg3']], [[0, 'ovCj1'], [1, 'ovCj2']]] },
  { members: ['friendA', 'friendB'],
    ambient: [[[0, 'ovFa1'], [1, 'ovFa2'], [0, 'ovFa3']], [[1, 'ovFb1'], [0, 'ovFb2'], [1, 'ovFb3']], [[0, 'ovFc1'], [1, 'ovFc2'], [0, 'ovFc3']]],
    hal: [[[0, 'ovFh1'], [1, 'ovFh2'], [0, 'ovFh3']]],
    gl: [[[1, 'ovFg1'], [0, 'ovFg2']], [[0, 'ovFj1'], [1, 'ovFj2']]] },
  { members: ['mother', 'girl'],
    ambient: [[[1, 'ovBa1'], [0, 'ovBa2'], [1, 'ovBa3'], [0, 'ovBa4']], [[1, 'ovBb1'], [0, 'ovBb2'], [1, 'ovBb3']]],
    hal: [[[1, 'ovBh1'], [0, 'ovBh2']]],
    gl: [[[1, 'ovBg1'], [0, 'ovBg2']]] },
  { members: ['rosie', 'dale'], near: 2.8,
    ambient: [[[0, 'ovRa1'], [1, 'ovRa2'], [0, 'ovRa3']], [[1, 'ovRb1'], [0, 'ovRb2']], [[1, 'ovRc1'], [0, 'ovRc2']]],
    hal: [[[1, 'ovRh1'], [0, 'ovRh2']]],
    gl: [[[1, 'ovRg1'], [0, 'ovRg2']]] },
  { members: ['clerk', 'shopper'], near: 7,
    ambient: [[[1, 'ovYa1'], [0, 'ovYa2']], [[0, 'ovYb1'], [1, 'ovYb2'], [0, 'ovYb3']]],
    gl: [[[1, 'ovYg1'], [0, 'ovYg2']]] },
  { members: ['phone'],
    ambient: [[[0, 'ovPa']], [[0, 'ovPb']], [[0, 'ovPc']]],
    gl: [[[0, 'ovPg']]] },
];
// under their breath, as Green Lantern walks by
// asking Hal to let them by (`excuse`; Rosie has her own)
const EXCUSE = { townm1: 'byM1', townm2: 'byM2', townm3: 'byM3', townf1: 'byF1', townf2: 'byF2', townf3: 'byF3', citykid: 'byK', cook: 'byCook' };
// and as the city's mood about him has it (story/Life.js's opinion): adoring, or turned against him
const TALK_GOOD = { townm1: 'cityGoodM1', townm2: 'cityGoodM2', townm3: 'cityGoodM3', townf1: 'cityGoodF1', townf2: 'cityGoodF2', townf3: 'cityGoodF3', citykid: 'cityGoodK' };
const TALK_BAD = { townm1: 'cityBadM1', townm2: 'cityBadM2', townm3: 'cityBadM3', townf1: 'cityBadF1', townf2: 'cityBadF2', townf3: 'cityBadF3', citykid: 'cityBadK' };
const MURMUR_GOOD = { townm1: ['muGoodM1'], townm2: ['muGoodM2'], townm3: ['muGoodM3'], townf1: ['muGoodF1'], townf2: ['muGoodF2'], townf3: ['muGoodF3'], citykid: ['muGoodK'] };
const MURMUR_BAD = { townm1: ['muBadM1'], townm2: ['muBadM2'], townm3: ['muBadM3'], townf1: ['muBadF1'], townf2: ['muBadF2'], townf3: ['muBadF3'], citykid: ['muBadK'] };
const MURMUR = { townm1: ['muM1a', 'muM1b'], townm2: ['muM2a'], townm3: ['muM3a'], townf1: ['muF1a'], townf2: ['muF2a'], townf3: ['muF3a'], citykid: ['muKa'] };

// a closed loop of points (block-local x, z): at(s, p, d) with s in metres along it; `hop` is the
// closing leg (the lot)
function loop(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = V(points[i][0], 0, points[i][1]), b = V(points[(i + 1) % points.length][0], 0, points[(i + 1) % points.length][1]);
    segs.push({ a, b, len: a.distanceTo(b), at: total });
    total += a.distanceTo(b);
  }
  return {
    length: total, hop: segs[segs.length - 1],
    wrap: (s) => ((s % total) + total) % total,
    at(s, p, d) {
      s = ((s % total) + total) % total;
      const sg = segs.find((g) => s < g.at + g.len) ?? segs[segs.length - 1];
      p.lerpVectors(sg.a, sg.b, (s - sg.at) / sg.len);
      d.copy(sg.b).sub(sg.a).normalize();
      return sg;
    },
  };
}

export class CityLife {
  constructor(story, f) {
    Object.assign(this, { story, f, block: f.block });
    this.people = [];
    this.recent = [];
    this.loops = [loop(LOOP), loop(LOOP2)];
    this.loop = this.loops[0];
    this.frustum = new THREE.Frustum();
    this.projM = new THREE.Matrix4();
    this.t = 0;
    this.talkT = 0;
    this.nextTalk = 4;
    this.seen = [];
    this.seenT = 0;
  }

  async start() {
    const ids = [...new Set([...Object.values(STAFF).map((s) => s.id), ...DINERS.map((d) => d.id), ...STANDS.map((s) => s.id), ...WALKERS, ...WALKERS2, ...this.posts().filter((p) => p.staff).map((p) => p.staff.id)])];
    const gl = await loadPeople(ids);
    const byId = Object.fromEntries(ids.map((id, i) => [id, gl[i]]));
    const posts = this.posts();
    let seed = 1;
    const make = (id) => {
      if (!byId[id]) return null;
      const per = createPerson(byId[id], { seed: seed++ });
      const k = 0.96 + ((seed * 37) % 9) * 0.01; // (a few per cent taller or shorter than the scan)
      per.rig.root.scale.setScalar(id.includes('child') ? 1 : k);
      return per;
    };
    // (seventy people made in one go held the page: a breath for the browser every 10 ms of them)
    let bt = performance.now();
    const breathe = async () => { if (performance.now() - bt > 10) { await breath(); bt = performance.now(); } };
    // the staff and the shopper at their posts
    for (const [who, s] of Object.entries(STAFF)) {
      await breathe();
      const post = posts.find((p) => p.who === who), per = make(s.id);
      if (!post || !per) continue;
      this.add(per, { kind: who, tag: who, voice: s.voice, label: s.label, post, home: post.at.clone(), yaw: post.face, state: 'post', inside: true, speed: who === 'shopper' ? 0.6 : 0.95, radius: who === 'shopper' ? 1.7 : 2.4 });
    }
    // the other shops' staff (city/Shops.js: each post brings its person, voice and lines)
    for (const post of posts) {
      if (!post.staff) continue;
      await breathe();
      const per = make(post.staff.id);
      if (!per) continue;
      // (seated, some: the regulars on their stools, the officer at his typewriter, the travel agent)
      // (`remote`: the Ferris offices' receptionist, on the field 6 km from the block: the block's own
      // reach left her undrawn, a voice behind an empty desk)
      this.add(per, { kind: 'shopkeep', tag: post.who, voice: post.staff.voice, label: post.staff.label, lines: post.staff.lines, glLines: post.staff.glLines, remote: post.room === 'ferris', post, home: post.at.clone(), yaw: post.face, state: post.sit != null ? 'seated' : 'post', sit: post.sit, stool: post.stool, inside: true, speed: 0.7, radius: 2.2 });
    }
    // the street: standing, waiting, talking, on the phone
    for (const s of STANDS) {
      await breathe();
      const per = make(s.id);
      if (!per) continue;
      const at = V(s.at[0], 0, s.at[1]);
      at.y = ground(at.x, at.z);
      at.add(LOT);
      this.add(per, { kind: 'stand', tag: s.tag, voice: s.voice, label: s.label, home: at, yaw: s.yaw ?? 0, state: s.does === 'sit' ? 'seated' : 'post', does: s.does, sit: s.sit, day: s.day, radius: 1.7, partnerTag: s.partner });
    }
    for (const p of this.people) if (p.partnerTag) { p.partner = this.byTag(p.partnerTag); if (p.does === 'chat') p.yaw = Math.atan2(p.partner.home.x - p.home.x, p.partner.home.z - p.home.z); }
    // the walkers, spread along each block's loop, half each way
    for (const [k, list] of [WALKERS, WALKERS2].entries()) {
      const lp = this.loops[k], L = lp.length - lp.hop.len;
      for (const [i, id] of list.entries()) {
        await breathe();
        const per = make(id);
        if (!per) continue;
        const voice = id.includes('female') ? ['townf1', 'townf2', 'townf3'][i % 3] : ['townm1', 'townm2', 'townm3'][i % 3];
        this.add(per, { kind: 'walker', loop: lp, voice, label: id.includes('female') ? 'A woman' : 'A man', state: 'walk', s: (i / list.length) * L + (i % 3) * 4, dir: i % 2 ? -1 : 1, lane: 0.22 + ((i * 7) % 5) * 0.07, speed: 1.18 + ((i * 13) % 7) * 0.045, radius: 1.9, night: i % 2 === 0 });
      }
    }
    // the rest of the city's (placed near the camera when it's over the city: roamKeep)
    const ROAM = [...WALKERS, ...WALKERS2];
    for (let i = 0; i < 26; i++) {
      await breathe();
      const id = ROAM[(i * 7) % ROAM.length], per = make(id);
      if (!per) continue;
      const voice = id.includes('female') ? ['townf1', 'townf2', 'townf3'][i % 3] : ['townm1', 'townm2', 'townm3'][i % 3];
      this.add(per, { kind: 'roamer', voice, label: id.includes('female') ? 'A woman' : 'A man', state: 'roam', remote: true, home: V(0, -60, 0), lane: (Math.random() - 0.5) * 2.2, speed: 1.12 + Math.random() * 0.36, radius: 1.9, night: i % 2 === 0 });
    }
    // the diner: its first customers, Rosie's service, Dot's kitchen
    this.diner = new DinerLife(this);
    for (const d of DINERS) {
      await breathe();
      const per = make(d.id);
      if (!per) continue;
      const p = this.add(per, { kind: 'diner', tag: d.tag, voice: d.voice, label: d.label, home: V(0, 0, 0), state: 'seated', inside: true, radius: 1.3, sit: 0.47 });
      this.diner.seatCustomer(p, d.seat, { phase: d.phase, food: d.food });
    }
    const couple = [this.byTag('coupleM'), this.byTag('coupleF')];
    if (couple[0] && couple[1]) { couple[0].partner = couple[1]; couple[1].partner = couple[0]; }
    this.talks = TALKS.map((g) => ({ ...g, people: g.members.map((t) => this.byTag(t)), last: -99 })).filter((g) => g.people.every(Boolean));
    this.watch = { onCast: () => this.scare() };
    this.story.powers.watchers.add(this.watch);
    // their materials compiled before any of them is drawn (each first draw compiled on the spot)
    await this.story.warmUp?.(this.f.scene, null, this.people.map((p) => p.rig.root));
    this.f.updaters.push((dt) => this.update(dt));
    this.diner.start();
    this.started = true;
  }

  byTag(tag) { return this.people.find((p) => p.tag === tag); }
  // everyone's posts: the block's (its shops' staff, the regulars) and the Ferris offices' receptionist
  posts() { return [...this.block.ctx.posts, ...(this.f.office?.posts ?? [])]; }

  add(per, opts) {
    const { f, story } = this, rig = per.rig;
    f.scene.add(rig.root);
    rig.root.visible = false; // (shown by `update` when they're near, once their materials are compiled)
    const anim = new Animator(rig), loco = new Locomotion(story.mocap);
    loco.scale = rig.hipsHeight * rig.root.scale.y / story.mocap.hipsHeight;
    loco.relax.adduct = 0.08;
    anim.look.maxYaw = 0.75;
    const p = { per, rig, anim, loco, head: V(0, 0, 0), t: Math.random() * 4, offset: 0, ...opts };
    p.pos = rig.root.position;
    p.lane0 = p.lane;
    if (p.state === 'walk') { const l = V(0, 0, 0); (p.loop ?? this.loop).at(p.s, l, _d); p.pos.copy(l).add(LOT); p.pos.y = ground(l.x, l.z); p.yaw = Math.atan2(_d.x * p.dir, _d.z * p.dir); }
    else p.pos.copy(p.home);
    rig.root.rotation.y = p.yaw ?? 0;
    if (p.state === 'seated') this.seatPose(p);
    else anim.play(loco, 0);
    if (p.does === 'phone') this.onPhone(p);
    // a body to bump into (kinematic, where they are), which the camera looks through
    const rb = f.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.pos.x, p.pos.y - 50, p.pos.z));
    const col = f.physics.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.28).setTranslation(0, 0.86, 0), rb);
    // in no collision pairs at all (an officer walking through a parked car to a suspect shoved it onto
    // the pavement and felled a lamp post): Hal's controller still finds it (its queries don't filter by
    // group), the ring's blows find the actors as targets
    col.setCollisionGroups(0x00020000);
    story.player.camIgnore.add(col.handle);
    (this.capsules ??= new Set()).add(col.handle);
    p.rb = rb;
    const name = { rosie: 'Rosie', cook: 'Dot', clerk: 'Ray' }[p.kind];
    p.it = f.interact({ position: p.pos, radius: p.radius ?? 1.8, look: p.head, label: name ? `Talk to ${name}` : 'Talk', action: () => this.talk(p) });
    this.people.push(p);
    return p;
  }

  // ---------------------------------------------------------------- moving them
  // Along a route of world points, at a walking pace; resolves on arrival (facing `face` if given).
  // A route is paused while they talk (`p.paused`) and kept through a fright.
  go(p, pts, { speed = 1.0, face = null } = {}) {
    if (!pts.length) return Promise.resolve();
    if (p.state === 'seated') p.anim.play(p.loco, 0.4);
    p.state = 'route';
    p.route = pts.map((v) => v.clone());
    p.routeSpeed = speed;
    p.routeFace = face;
    return new Promise((res) => { p.routeDone?.(); p.routeDone = res; });
  }

  // standing still where they are (facing `yaw`), for the diner's work
  hold(p, yaw = null) {
    p.state = 'hold';
    if (yaw != null) p.yaw = yaw;
  }

  seatPose(p) {
    const hy = p.sit + 0.06 - p.rig.hipsHeight * p.rig.root.scale.y;
    p.anim.play(still(makePose({ ...POSES.sitEdge, hy: hy / p.rig.root.scale.y, sx: p.stool ? 0.12 : 0.06, nx: -0.04 }), 1), 0.5);
  }

  // A thing in their right hand (a plate, a mug, the pot), on the palm, kept level after the IK
  carry(p, mesh, { lift = 0.03, out = 0.02 } = {}) {
    const r = p.rig, palm = r.palm('R'), hand = r.bones.hand_R;
    p.per.setGrip('R', 'hold');
    hand.add(mesh);
    mesh.position.copy(palm.centre).addScaledVector(palm.normal, palm.surface + lift).addScaledVector(palm.along, out);
    const wq = new THREE.Quaternion(), base = p.anim.post;
    p.held = mesh;
    p.anim.post = (rig, dt) => { base?.(rig, dt); if (mesh.parent === hand) { hand.getWorldQuaternion(wq); mesh.quaternion.copy(wq.invert()).multiply(_q.setFromAxisAngle(_Y, p.rig.root.rotation.y)); } };
    p.unpost = base;
    this.carryPose(p);
  }
  // carried out in front at the waist, the elbow bent (a plate held down at arm's length read as dropped)
  carryPose(p) {
    const at = V(0, 0, 0);
    p.anim.reach('R', () => {
      const y = p.rig.root.rotation.y;
      p.rig.bonePosition('hips', at);
      return at.add(_c2.set(Math.sin(y) * 0.34 - Math.cos(y) * 0.2, 0.2, Math.cos(y) * 0.34 + Math.sin(y) * 0.2));
    }, { weight: 1, rate: 5, pole: V(0.5, -1, -0.6) });
  }
  put(p, at, scene = this.f.scene) {
    const m = p.held;
    if (!m) return null;
    m.removeFromParent();
    m.position.copy(at);
    m.quaternion.setFromAxisAngle(_Y, p.rig.root.rotation.y);
    scene.add(m);
    p.held = null;
    p.anim.post = p.unpost ?? null;
    p.per.setGrip('R', 'relaxed');
    return m;
  }

  // on the phone: his phone in his right hand (on the palm, the screen to his face), held to his ear:
  // the hand turned so the phone lies along his cheek, its top at the ear (set after the IK, in
  // `post`), and the wrist placed so that it does
  onPhone(p) {
    const r = p.rig, palm = r.palm('R');
    p.per.setGrip('R', 'hold');
    const inHand = palm.centre.clone().addScaledVector(palm.normal, palm.surface + 0.006).addScaledVector(palm.along, 0.02);
    if (!p.phone) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.071, 0.146, 0.008), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.25, metalness: 0.6 }));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.14), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.08, metalness: 0.2 }));
      glass.position.z = 0.0042; // (the screen away from the palm: against his cheek)
      const phone = (p.phone = new THREE.Group());
      phone.add(body, glass);
      const z = palm.normal.clone(), y = palm.along.clone(), x = new THREE.Vector3().crossVectors(y, z).normalize();
      phone.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      phone.position.copy(inHand);
      r.bones.hand_R.add(phone);
    }
    const restB = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(palm.along, palm.normal), palm.along, palm.normal);
    const restInv = restB.clone().invert(), want = new THREE.Quaternion(), pq = new THREE.Quaternion(), M = new THREE.Matrix4();
    const along = new THREE.Vector3(), nrm = new THREE.Vector3(), side = new THREE.Vector3(), up = V(0, 1, 0);
    const fwd = V(0, 0, 0), right = V(0, 0, 0);
    const frame = () => {
      const y = r.root.rotation.y;
      fwd.set(Math.sin(y), 0, Math.cos(y)); right.set(-Math.cos(y), 0, Math.sin(y));
      along.copy(up).multiplyScalar(0.9).addScaledVector(fwd, -0.3).addScaledVector(right, 0.12).normalize();
      nrm.copy(right).negate().addScaledVector(fwd, -0.25);
      nrm.addScaledVector(along, -nrm.dot(along)).normalize();
      side.crossVectors(along, nrm);
      want.setFromRotationMatrix(M.makeBasis(side, along, nrm).multiply(restInv));
    };
    const wrist = V(0, 0, 0), off = V(0, 0, 0);
    p.anim.reach('R', () => {
      frame();
      r.bonePosition('head', wrist).addScaledVector(right, 0.095).addScaledVector(fwd, 0.035).addScaledVector(up, 0.035);
      off.copy(inHand).applyQuaternion(want);
      return wrist.sub(off);
    }, { weight: 1, rate: 3, pole: V(0.7, -1, -0.5) });
    p.anim.post = () => {
      frame();
      const hand = r.bones.hand_R;
      hand.parent.getWorldQuaternion(pq);
      hand.quaternion.copy(pq.invert().multiply(want));
    };
  }

  // ---------------------------------------------------------------- talking to them
  pick(voice) {
    let pool = TALK[voice]?.[this.story.civilian ? 'hal' : 'gl'] ?? TALK.townm1.hal;
    const o = this.story.life?.opinion ?? 35;
    if (!this.story.civilian && o < -10 && TALK_BAD[voice]) pool = [TALK_BAD[voice]];
    else if (!this.story.civilian && o > 60 && TALK_GOOD[voice]) pool = [...pool, TALK_GOOD[voice], TALK_GOOD[voice]];
    const fresh = pool.filter((k) => !this.recent.includes(k));
    const key = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    this.recent.push(key);
    if (this.recent.length > 6) this.recent.shift();
    return key;
  }

  look(p, at, w = 0.8) {
    p.anim.lookAt(at, w);
    p.per.lookEyes(at);
  }

  halHead() { return this._hh ??= (() => { const v = V(0, 0, 0); return () => this.story.player.rig.bonePosition('head', v); })(); }
  headOf(o) { return o._head ??= (() => { const v = V(0, 0, 0); return () => eyesOf(o.rig, v); })(); }

  // A line said to Hal, as the dialogue (its subtitle, the voice, the jaw); they face him while they say it
  async say(p, key) {
    const { story } = this, player = story.player;
    this.stopTalk();
    p.talking = true;
    const paused = p.paused;
    p.paused = true; // (a route waits while they speak)
    this.look(p, this.halHead(), 0.85);
    if (p.state !== 'seated') p.faceTo = Math.atan2(player.position.x - p.pos.x, player.position.z - p.pos.z);
    story.speakingRig = p.rig;
    await story.say(key, { skip: false });
    if (story.speakingRig === p.rig) story.speakingRig = null;
    p.talking = false;
    p.paused = paused;
    p.faceTo = null;
  }

  async talk(p) {
    if (p.state === 'flee' || p.state === 'cower' || p.talking) return; // (E runs this with story.busy already set)
    if (p.kind === 'rosie' && this.diner) { this.diner.talkTo(); return; }
    const { story } = this, was = p.state;
    if (!story.civilian && this.t - (p.metGL ?? -999) > 600) { p.metGL = this.t; story.life?.opine(0.4, 'Green Lantern stopping to talk'); }
    if (p.state === 'walk' || p.state === 'post') p.state = 'talk';
    p.paused = true;
    p.loco.speed = 0;
    p.per.smile = story.civilian ? 0.25 : 0.1;
    if (Math.random() < 0.5) p.anim.gesture('nod', 0.8, 0.3);
    // (a post's own lines are what they say to Hal Jordan; to Green Lantern their `glLines`, or what anyone
    // in town would say to him: the receptionist greeted him by name in the uniform)
    const own = story.civilian ? p.lines : p.glLines;
    await this.say(p, own ? own[(p.lineN = ((p.lineN ?? -1) + 1)) % own.length] : this.pick(p.voice));
    p.per.smile = 0;
    await wait(0.6);
    this.look(p, null);
    p.paused = false;
    if (p.state === 'talk') p.state = was;
  }

  // ---------------------------------------------------------------- what he overhears
  // One line from someone near him, on its own channel (it never takes the dialogue's place), as loud
  // as he is close; their jaw on it. Resolves when it's said, or when he's too far to hear it.
  async murmur(p, key, { talk = false } = {}) {
    const { story } = this, line = LINES[key], whisper = line.style === 'whisper';
    if (!p || !line) return;
    const gainAt = () => {
      const d = p.pos.distanceTo(story.player.position);
      return Math.max(0, Math.min(1, 1 - (d - (whisper ? 1.2 : 2)) / (whisper ? 5 : 8)));
    };
    // out of earshot it's still said (it takes as long), just not heard
    if (gainAt() < 0.03) { await wait(Math.max(1, line.text.length * 0.06)); return; }
    const h = story.voice.murmur(line.text, line.who, { gain: gainAt() }) ?? silent(line.text);
    story.ui.overhear({ name: p.label, text: line.text, whisper });
    this.overLine = key;
    if (talk) this.murmuring = h;
    let done = false;
    h.done.then(() => { done = true; });
    p.anim.gesture(Math.random() < 0.5 ? 'beat' : 'nod', 0.9, whisper ? 0.15 : 0.3);
    await new Promise((res) => {
      const stop = onFrame(() => {
        const g = gainAt();
        h.gain(g);
        p.per.extraJaw = h.mouth() * (whisper ? 0.35 : 0.55);
        if (done || g <= 0.02 || (talk && this.cut)) { if (!done) h.stop(); p.per.extraJaw = 0; stop(); res(); }
      });
    });
    if (talk) this.murmuring = null;
    if (this.overLine === key) story.ui.overhearHide();
  }

  // An exchange among people near him: each line from its speaker; they look at each other, and (a
  // whisper about him) glance at him first
  async playTalk(g, script, about) {
    this.talking = g;
    this.cut = false;
    if (about) for (const p of g.people) { this.look(p, this.halHead(), 0.5); }
    await wait(about ? 0.8 : 0.1);
    for (const p of g.people) if (g.people.length > 1) this.look(p, this.headOf(g.people.find((o) => o !== p)), 0.6);
    for (const [i, key] of script) {
      if (this.cut) break;
      await this.murmur(g.people[i], key, { talk: true });
      await wait(0.25);
    }
    this.story.ui.overhearHide();
    for (const p of g.people) this.look(p, p.partner ? this.headOf(p.partner) : null, 0.6);
    g.last = this.t;
    this.talking = null;
    this.nextTalk = this.t + 5 + Math.random() * 5;
  }
  stopTalk() { if (this.talking || this.murmuring) { this.cut = true; this.story.ui.overhearHide(); } }

  // who near him might start talking, and about what
  updateTalks() {
    const { story } = this, hp = story.player.position, gl = !story.civilian;
    if (this.talking || this.murmuring || this.t < this.nextTalk || (!story.seated && (!story.player.control || story.busy))) return; // (seated, he still hears the room)
    let best = null, bd = Infinity;
    for (const g of this.talks) {
      if (!g.people.every((p) => p.active && !p.talking && p.state !== 'flee' && p.state !== 'cower')) continue;
      if (g.near && g.people[0].pos.distanceTo(g.people[1].pos) > g.near) continue;
      if (this.t - g.last < 40) continue;
      const m = _c.set(0, 0, 0);
      for (const p of g.people) m.add(p.pos);
      m.multiplyScalar(1 / g.people.length);
      const d = Math.hypot(m.x - hp.x, m.z - hp.z);
      if (d < 6.5 && Math.abs(m.y - hp.y) < 3 && d < bd) { best = g; bd = d; }
    }
    if (best) {
      const set = gl && best.gl ? best.gl : !gl && best.hal && bd < 5 && Math.random() < 0.55 ? best.hal : best.ambient;
      const about = set !== best.ambient;
      this.playTalk(best, set[Math.floor(Math.random() * set.length)], about);
      return;
    }
    // Green Lantern walking past people: one says something under their breath
    if (!gl || story.player.flying) return;
    for (const p of this.people) {
      if (!p.active || p.talking || p.kind === 'rosie' || p.kind === 'cook' || !MURMUR[p.voice] || this.t - (p.muT ?? -99) < 45) continue;
      if (Math.hypot(p.pos.x - hp.x, p.pos.z - hp.z) > 3.2 || Math.random() > 0.3) continue;
      p.muT = this.t;
      const o = story.life?.opinion ?? 35;
      const keys = (o < -10 ? MURMUR_BAD : o > 50 ? MURMUR_GOOD : null)?.[p.voice] ?? MURMUR[p.voice];
      this.playTalk({ people: [p], last: 0 }, [[0, keys[Math.floor(Math.random() * keys.length)]]], false);
      return;
    }
  }

  // ---------------------------------------------------------------- who can see him
  // Everyone facing him (within 80 degrees of where they face, and not far above or below their eye
  // line), within sight (40 m by day, 20 by night), with nothing solid between their eyes and him.
  seenBy() {
    if (this.t - this.seenT < 0.2) return this.seen;
    this.seenT = this.t;
    const { story, f } = this, player = story.player, world = f.physics.world;
    const chest = _c.copy(player.position).add(_e.set(0, 1.2, 0)), far = f.isNight ? 20 : 40;
    const skip = (col) => !(this.capsules.has(col.handle) || col.handle === player.collider?.handle || player.ignore?.has?.(col.handle));
    const out = [];
    for (const p of this.people) {
      if (!p.active) continue;
      const eyes = p.head, d = eyes.distanceTo(chest);
      if (d > far || d < 0.05) continue;
      _d.copy(chest).sub(eyes);
      const h = Math.hypot(_d.x, _d.z), facing = p.faceTo ?? p.rig.root.rotation.y;
      if (Math.abs(wrap(Math.atan2(_d.x, _d.z) - facing)) > 1.4 && d > 1.2) continue;
      if (Math.atan2(_d.y, h) > 0.75) continue; // (high above them: people don't look up)
      const ray = new RAPIER.Ray(eyes, _d.normalize());
      const hit = world.castRay(ray, d - 0.35, true, undefined, undefined, undefined, undefined, skip);
      if (hit) continue;
      out.push(p);
    }
    return (this.seen = out);
  }

  // ---------------------------------------------------------------- frights
  // a construct cast near them: the street within thirty metres runs from him; inside they duck
  scare() {
    const hp = this.story.player.position;
    let called = false;
    this.stopTalk();
    if (this.people.some((p) => p.active && p.pos.distanceTo(hp) < 30)) this.story.life?.opine(-0.6, 'people frightened');
    for (const p of this.people) {
      if (!p.active || p.actor || p.pos.distanceTo(hp) > 30 || p.state === 'flee' || p.state === 'cower') continue;
      p.prev = p.state;
      if (p.inside) { p.state = 'cower'; p.t = 4 + Math.random() * 2; if (p.prev !== 'seated') p.anim.play(still(POSES.kneel, 0.5), 0.4); continue; }
      p.state = 'flee';
      p.t = 2.4 + Math.random() * 1.4;
      p.anim.play(p.loco, 0.3);
      this.look(p, this.halHead(), 0.6);
      if (!called && Math.random() < 0.5) { called = true; this.story.bark(Math.random() < 0.5 ? 'cityRun1' : 'cityRun2'); }
    }
  }

  // back as they were before they ran: in their seat, or standing at their post (the phone back to the ear)
  settle(p) {
    if (p.sit != null && p.kind !== 'diner') { p.state = 'seated'; this.seatPose(p); }
    else { p.state = 'post'; if (p.does === 'phone') this.onPhone(p); }
    p.rig.root.rotation.y = p.yaw ?? p.rig.root.rotation.y;
  }

  // ---------------------------------------------------------------- each frame
  update(dt) {
    const { story, f } = this, player = story.player, cam = story.director.camera ?? story.engine.camera, hp = player.position;
    this.t += dt;
    this.frameN = (this.frameN ?? 0) + 1;
    const night = !!f.isNight;
    cam.updateMatrixWorld();
    this.projM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projM);
    const near = cam.position.distanceTo(LOT) < 900; // (the block's within reach of the camera at all)
    const flyingOver = player.flying && !story.civilian;
    this.block.openers.length = 0;
    this.block.staff.length = 0;
    for (const p of this.people) {
      // who's out: by night half the walkers and the bus stop's people go home (not while they're busy),
      // and come out again in the morning; either only out of sight (the clock runs: at dusk they
      // vanished in front of him)
      const goes = p.state === 'route' || p.kind === 'diner' || !night || (p.kind === 'walker' || p.kind === 'roamer' ? p.night : !p.day);
      if (p.kind === 'roamer') this.roamKeep(p, cam);
      const d = Math.hypot(p.pos.x - hp.x, p.pos.z - hp.z), dc = p.pos.distanceTo(cam.position);
      if (p.out === undefined || (goes !== p.out && !(dc < 70 && this.frustum.containsPoint(_s.copy(p.pos).setY(p.pos.y + 1))))) p.out = goes;
      const out = p.out;
      const active = out && (near || p.remote) && dc < (p.inside ? 40 : 110) && (p.kind !== 'roamer' || !!p.rm);
      if (active !== p.active) {
        p.active = active;
        p.rig.root.visible = active;
        p.rig.root.matrixWorldAutoUpdate = active; // (no bones worked out for someone not drawn)
        if (!active) p.rb.setNextKinematicTranslation({ x: p.pos.x, y: -50, z: p.pos.z });
      }
      if (!active && p.state !== 'route') continue;
      const r = p.rig.root;
      let speed = 0, want = null;
      if (p.state === 'walk') ({ speed, want } = this.walk(p, dt, d, flyingOver));
      else if (p.state === 'roam') ({ speed, want } = this.roam(p, dt, d, flyingOver));
      else if (p.state === 'post') ({ speed, want } = this.post(p, dt, d, flyingOver));
      else if (p.state === 'hold') want = p.faceTo ?? p.yaw;
      else if (p.state === 'route') ({ speed, want } = this.follow(p, dt));
      else if (p.state === 'talk') want = p.faceTo ?? p.yaw;
      else if (p.state === 'seated') this.seatedLook(p, d, dt, flyingOver);
      else if (p.state === 'flee') {
        _a.set(p.pos.x - hp.x, 0, p.pos.z - hp.z).normalize();
        p.pos.addScaledVector(_a, 3.3 * dt);
        want = Math.atan2(_a.x, _a.z);
        speed = 3.3;
        if ((p.t -= dt) < 0) { p.state = 'cower'; p.t = 3.5 + Math.random() * 1.5; p.anim.play(still(POSES.kneel, 0.5), 0.4); }
      } else if (p.state === 'cower') {
        if ((p.t -= dt) < 0) {
          this.look(p, null);
          if (p.inside) {
            // inside, back to what they were doing (a diner to their meal, Rosie to her route)
            p.state = p.prev ?? 'post';
            if (p.state === 'seated') this.seatPose(p); else p.anim.play(p.loco, 0.6);
          } else {
            p.anim.play(p.loco, 0.6);
            if (p.kind === 'walker') { p.state = 'walk'; this.rejoin(p); }
            else if (p.kind === 'roamer') { p.state = 'roam'; this.roamRejoin(p); }
            else if (p.pos.distanceTo(p.home) < 0.3) this.settle(p);
            else { p.state = 'return'; p.goal = p.home.clone(); }
          }
        }
      } else if (p.state === 'return') {
        _a.copy(p.goal).sub(p.pos).setY(0);
        const l = _a.length();
        if (l < 0.1) { p.pos.copy(p.home); this.settle(p); }
        else { speed = Math.min(1.3, l * 2 + 0.3); p.pos.addScaledVector(_a.normalize(), speed * dt); want = Math.atan2(_a.x, _a.z); }
      }
      if (p.talking && p.state !== 'seated') want = p.faceTo ?? want;
      if (want != null) r.rotation.y += wrap(want - r.rotation.y) * Math.min(1, dt * 5);
      p.loco.speed = speed;
      p.loco.direction = 1;
      if (p.it) p.it.enabled = !p.mute && active && !p.talking && p.state !== 'flee' && p.state !== 'cower' && !player.flying && (p.kind !== 'diner' || p.state === 'seated');
      if (!active) { p.rb.setNextKinematicTranslation({ x: p.pos.x, y: -50, z: p.pos.z }); continue; }
      // (posed every frame only near the camera; farther, every third, the time made up; out of view
      // and casting no shadow, every eighth: 70 people posed every frame was most of the street's cost)
      p.animDt = (p.animDt ?? 0) + dt;
      const every = !(dc < 22 || this.frustum.intersectsSphere(_sph.set(_s.copy(p.pos).setY(p.pos.y + 1), 1.2))) ? 8 : dc < 35 ? 1 : 3;
      if (every === 1 || (this.frameN + (p.slot ??= this.people.indexOf(p))) % every === 0) { p.anim.update(p.animDt); p.per.update(p.animDt); p.animDt = 0; }
      eyesOf(p.rig, p.head);
      const cast = dc < 22;
      if (cast !== p.cast) { p.cast = cast; for (const m of p.rig.meshes) m.castShadow = cast; }
      p.rb.setNextKinematicTranslation({ x: p.pos.x, y: p.ghost ? -50 : p.pos.y, z: p.pos.z }); // (`ghost`: no body, someone sat inside a car)
      if (p.state === 'route' || p.kind === 'diner') this.block.openers.push(p.pos);
      if (p.state === 'route' && p.kind === 'rosie') this.block.staff.push(p.pos);
    }
    this.diner?.update(dt);
    if ((this.talkT += dt) > 0.25) { this.talkT = 0; this.updateTalks(); }
    // he walked away from what he was overhearing
    if (this.talking && this.talking.people.every((p) => p.pos.distanceTo(hp) > 11)) this.cut = true;
  }

  // along a route: to each point in turn (a step's height eased in), then the facing asked for
  follow(p, dt) {
    if (p.paused) return { speed: 0, want: p.faceTo ?? null };
    const tgt = p.route[0];
    if (!tgt) {
      p.state = 'hold';
      if (p.routeFace != null) p.yaw = p.routeFace;
      const done = p.routeDone;
      p.routeDone = null;
      done?.();
      return { speed: 0, want: p.yaw };
    }
    _a.copy(tgt).sub(p.pos);
    const dy = _a.y;
    _a.y = 0;
    const l = _a.length();
    if (l < 0.06) { p.pos.x = tgt.x; p.pos.z = tgt.z; p.route.shift(); return { speed: p.routeSpeed * 0.5, want: null }; }
    // Hal in their way: they wait for him (their capsule walked into his left him stuck), and after a
    // moment ask him to let them by
    if (!p.barge && this.inWay(p, _a.normalize(), l)) {
      if ((p.waitT = (p.waitT ?? 0) + dt) > 1.2 && this.t - (p.excused ?? -99) > 8) { p.excused = this.t; this.excuse(p); }
      return { speed: 0, want: Math.atan2(_a.x, _a.z) };
    }
    p.waitT = 0;
    const sp = Math.min(p.routeSpeed, l * 2.5 + 0.25);
    p.pos.addScaledVector(_a.normalize(), Math.min(l, sp * dt));
    p.pos.y += dy * Math.min(1, dt * 8);
    return { speed: sp, want: Math.atan2(_a.x, _a.z) };
  }

  // Hal standing on the next stretch of someone's route (`dir` along it, `l` to its next point), close
  // enough that they'd walk into him; not while he sits or flies
  inWay(p, dir, l) {
    const story = this.story, hp = story.player.position;
    if (story.seated || story.player.flying || Math.abs(hp.y - p.pos.y) > 1.2) return false;
    const rx = hp.x - p.pos.x, rz = hp.z - p.pos.z, t = rx * dir.x + rz * dir.z;
    return t > 0 && t < Math.min(l + 0.6, 1.2) && Math.abs(rx * dir.z - rz * dir.x) < 0.6;
  }
  excuse(p) {
    const key = p.kind === 'rosie' ? (this.story.civilian ? (Math.random() < 0.5 ? 'byRosie1' : 'byRosie2') : 'byRosieG') : EXCUSE[p.voice];
    if (!key || p.talking) return;
    this.look(p, this.halHead(), 0.7);
    this.murmur(p, key).then(() => this.look(p, null));
  }

  // along the loop, keeping right, round Hal, behind slower people; at the lot end, the hop
  walk(p, dt, d, flyingOver) {
    const loop = p.loop ?? this.loop, player = this.story.player, hp = player.position, cam = this.story.director.camera ?? this.story.engine.camera;
    if (flyingOver && d < 16 && hp.y > p.pos.y + 3) {
      if (!p.up) {
        p.up = true; p.upT = 2.5 + Math.random() * 2;
        this.look(p, this.halHead(), 0.8);
        if (Math.random() < 0.35) p.anim.reach('R', () => p.rig.bonePosition('upperArm_R', _p).add(_a.copy(hp).sub(_p).normalize().multiplyScalar(0.62)), { weight: 1, rate: 6 });
        if (this.t - (this.calledUp ?? -99) > 12 && Math.random() < 0.5) { this.calledUp = this.t; this.story.bark(['cityUp1', 'cityUp2', 'cityUp3'][Math.floor(Math.random() * 3)]); }
      }
    }
    if (p.up) {
      if ((p.upT -= dt) > 0 && player.flying) return { speed: 0, want: Math.atan2(hp.x - p.pos.x, hp.z - p.pos.z) };
      p.up = false; p.anim.reach('R', null); this.look(p, null);
    }
    if (p.paused) return { speed: 0, want: p.faceTo };
    const l = _p;
    const sg = loop.at(p.s, l, _d);
    // the hop: crossed while nobody's looking (or from far off); someone in view waits, then turns back
    if (sg === loop.hop) {
      const wp = _b.copy(l).add(LOT);
      const seen = this.frustum.containsPoint(wp.setY(1)) && wp.distanceTo(cam.position) < 70;
      if (!seen) {
        p.s = p.dir > 0 ? 0.01 : loop.hop.at - 0.01;
        p.wait = 0;
        loop.at(p.s, l, _d);
        p.pos.set(l.x + LOT.x, ground(l.x, l.z), l.z + LOT.z);
        p.rig.root.rotation.y = Math.atan2(_d.x * p.dir, _d.z * p.dir);
        return { speed: 0, want: null };
      }
      p.wait = (p.wait ?? 0) + dt;
      if (p.wait > 6) { p.dir = -p.dir; p.wait = 0; p.s += p.dir * 0.3; }
      return { speed: 0, want: null };
    }
    const fwd = _d.multiplyScalar(p.dir), right = _a.set(-fwd.z, 0, fwd.x);
    const hx = hp.x - LOT.x, hz = hp.z - LOT.z, rx = hx - l.x, rz = hz - l.z;
    const along = rx * fwd.x + rz * fwd.z, lat = rx * right.x + rz * right.z;
    let target = p.lane0, speed = p.speed;
    if (along > -0.4 && along < 2.4 && Math.abs(lat - p.offset) < 0.9 && !player.flying) {
      target = THREE.MathUtils.clamp(lat > p.offset ? lat - 0.95 : lat + 0.95, -0.95, 0.95);
      speed *= along < 0.9 ? 0.25 : 0.6;
    }
    for (const o of this.people) {
      if (o === p || o.state !== 'walk' || o.dir !== p.dir || !o.active || (o.loop ?? this.loop) !== loop) continue;
      const ahead = loop.wrap((o.s - p.s) * p.dir);
      if (ahead > 0 && ahead < 1.6 && Math.abs(o.offset - p.offset) < 0.6) speed = Math.min(speed, o.speed * (ahead < 0.9 ? 0.6 : 1));
    }
    p.offset += (target - p.offset) * Math.min(1, dt * 2.5);
    p.s = loop.wrap(p.s + speed * dt * p.dir);
    const tx = l.x + right.x * p.offset, tz = l.z + right.z * p.offset;
    _b.set(tx + LOT.x, ground(tx, tz), tz + LOT.z);
    p.pos.x += (_b.x - p.pos.x) * Math.min(1, dt * 4);
    p.pos.z += (_b.z - p.pos.z) * Math.min(1, dt * 4);
    p.pos.y += (_b.y - p.pos.y) * Math.min(1, dt * 10);
    if (d < 4.5 && along > 0.5 && !p.glance) { p.glance = true; this.look(p, this.halHead(), this.story.civilian ? 0.45 : 0.75); }
    else if (p.glance && (d > 5.5 || along < -0.5)) { p.glance = false; this.look(p, null); }
    return { speed, want: Math.atan2(fwd.x, fwd.z) };
  }

  // ---------------------------------------------------------------- the city's roamers
  // one down a stretch of the grid's pavement (`p.rm`: on a north-south one, axis z at x `fixed`; on an
  // east-west one, axis x at z `fixed`; `u` how far along, `to` the next corner)
  roam(p, dt, d, flyingOver) {
    const player = this.story.player, hp = player.position, m = p.rm;
    if (!m) return { speed: 0, want: null };
    if (flyingOver && d < 16 && hp.y > p.pos.y + 3 && !p.up) {
      p.up = true; p.upT = 2.5 + Math.random() * 2;
      this.look(p, this.halHead(), 0.8);
      if (Math.random() < 0.3) p.anim.reach('R', () => p.rig.bonePosition('upperArm_R', _p).add(_a.copy(hp).sub(_p).normalize().multiplyScalar(0.62)), { weight: 1, rate: 6 });
      if (this.t - (this.calledUp ?? -99) > 12 && Math.random() < 0.4) { this.calledUp = this.t; this.story.bark(['cityUp1', 'cityUp2', 'cityUp3'][Math.floor(Math.random() * 3)]); }
    }
    if (p.up) {
      if ((p.upT -= dt) > 0 && player.flying) return { speed: 0, want: Math.atan2(hp.x - p.pos.x, hp.z - p.pos.z) };
      p.up = false; p.anim.reach('R', null); this.look(p, null);
    }
    if (p.paused) return { speed: 0, want: p.faceTo };
    const fx = m.axis === 'x' ? m.dir : 0, fz = m.axis === 'z' ? m.dir : 0, rx = -fz, rz = fx;
    // Hal in the way: round him, slower
    const ox = hp.x - p.pos.x, oz = hp.z - p.pos.z, along = ox * fx + oz * fz, lat = ox * rx + oz * rz;
    let target = p.lane, speed = p.speed;
    if (!player.flying && along > -0.4 && along < 2.4 && Math.abs(lat - p.offset) < 0.9) { target = THREE.MathUtils.clamp(lat > p.offset ? lat - 0.95 : lat + 0.95, -1.8, 1.8); speed *= along < 0.9 ? 0.25 : 0.6; }
    p.offset += (target - p.offset) * Math.min(1, dt * 2.5);
    m.u += m.dir * speed * dt;
    if ((m.dir > 0 && m.u >= m.to) || (m.dir < 0 && m.u <= m.to)) { m.u = m.to; this.roamTurn(p); }
    const n = p.rm, gx = n.axis === 'z' ? n.fixed : n.u, gz = n.axis === 'z' ? n.u : n.fixed;
    const nfx = n.axis === 'x' ? n.dir : 0, nfz = n.axis === 'z' ? n.dir : 0;
    const tx = gx - nfz * p.offset, tz = gz + nfx * p.offset;
    _b.set(tx + LOT.x, gridGround(tx, tz), tz + LOT.z);
    p.pos.x += (_b.x - p.pos.x) * Math.min(1, dt * 4);
    p.pos.z += (_b.z - p.pos.z) * Math.min(1, dt * 4);
    p.pos.y += (_b.y - p.pos.y) * Math.min(1, dt * 10);
    if (d < 4.5 && along > 0.5 && !p.glance) { p.glance = true; this.look(p, this.halHead(), this.story.civilian ? 0.45 : 0.75); }
    else if (p.glance && (d > 5.5 || along < -0.5)) { p.glance = false; this.look(p, null); }
    return { speed, want: Math.atan2(nfx, nfz) };
  }
  // at a corner: on, or round it (not back the way they came unless there's nothing else)
  roamTurn(p) {
    const m = p.rm, cx = m.axis === 'z' ? m.fixed : m.u, cz = m.axis === 'z' ? m.u : m.fixed;
    const opts = [];
    const go = (axis, dir, w) => {
      const list = axis === 'z' ? ZC : XC, u = axis === 'z' ? cz : cx, fixed = axis === 'z' ? cx : cz, to = nextOf(list, u, dir);
      if (to != null && roamOK(axis, fixed, u, to)) opts.push({ axis, dir, fixed, u, to, w });
    };
    go(m.axis, m.dir, 5);
    const other = m.axis === 'z' ? 'x' : 'z';
    go(other, 1, 2.2);
    go(other, -1, 2.2);
    if (!opts.length) go(m.axis, -m.dir, 1);
    if (!opts.length) { p.rm = null; return; }
    let w = Math.random() * opts.reduce((a, o) => a + o.w, 0);
    for (const o of opts) { if ((w -= o.w) <= 0) { Object.assign(m, o); return; } }
    Object.assign(m, opts[0]);
  }
  // Kept near the camera: when it's left them behind (or they've no pavement yet), put down at a corner
  // within reach of it that nobody's looking at, facing on along it.
  roamKeep(p, cam) {
    if (this.frameN % 15 !== (p.slot ?? 0) % 15) return;
    const cx = cam.position.x - LOT.x, cz = cam.position.z - LOT.z;
    if (p.rm) {
      const dc = Math.hypot(p.pos.x - cam.position.x, p.pos.z - cam.position.z);
      if (dc < 140 || this.frustum.containsPoint(_s.copy(p.pos).setY(p.pos.y + 1)) && dc < 220) return;
    }
    if (p.state !== 'roam' || cam.position.y > 140 || cz < ZC[0] - 150 || cz > ZC[ZC.length - 1] + 150) { if (p.rm && p.state === 'roam') { p.rm = null; p.pos.y = -60; } return; }
    for (let tries = 0; tries < 10; tries++) {
      const x = XC[Math.floor(Math.random() * XC.length)], z = ZC[Math.floor(Math.random() * ZC.length)];
      const dd = Math.hypot(x - cx, z - cz);
      if (dd < 25 || dd > 115) { const k = Math.floor(Math.random() * XC.length); void k; continue; }
      _s.set(x + LOT.x, 1, z + LOT.z);
      if (this.frustum.containsPoint(_s) && dd < 70) continue;
      const axis = Math.random() < 0.5 ? 'z' : 'x', dir = Math.random() < 0.5 ? 1 : -1;
      const list = axis === 'z' ? ZC : XC, u = axis === 'z' ? z : x, fixed = axis === 'z' ? x : z, to = nextOf(list, u, dir);
      if (to == null || !roamOK(axis, fixed, u, to)) continue;
      p.rm = { axis, dir, fixed, u, to };
      p.offset = p.lane;
      const gx = axis === 'z' ? fixed : u, gz = axis === 'z' ? u : fixed;
      p.pos.set(gx + LOT.x, gridGround(gx, gz), gz + LOT.z);
      p.rig.root.rotation.y = Math.atan2(axis === 'x' ? dir : 0, axis === 'z' ? dir : 0);
      return;
    }
  }
  // after running: on from the nearest corner's line
  roamRejoin(p) {
    const cx = p.pos.x - LOT.x, cz = p.pos.z - LOT.z;
    const x = XC.reduce((b, v) => (Math.abs(v - cx) < Math.abs(b - cx) ? v : b), XC[0]), z = ZC.reduce((b, v) => (Math.abs(v - cz) < Math.abs(b - cz) ? v : b), ZC[0]);
    const axis = Math.abs(cx - x) < Math.abs(cz - z) ? 'z' : 'x', fixed = axis === 'z' ? x : z, u = axis === 'z' ? cz : cx, dir = Math.random() < 0.5 ? 1 : -1;
    const to = nextOf(axis === 'z' ? ZC : XC, u, dir);
    p.rm = to != null ? { axis, dir, fixed, u, to } : null;
  }

  // back onto the loop at the nearest point (after running, the hop, or coming out of the diner)
  rejoin(p) {
    let best = p.s ?? 0, bd = Infinity;
    const lp = p.loop ?? this.loop;
    for (let s = 0; s < lp.length - lp.hop.len; s += 1) {
      lp.at(s, _p, _d);
      const dd = (_p.x + LOT.x - p.pos.x) ** 2 + (_p.z + LOT.z - p.pos.z) ** 2;
      if (dd < bd) { bd = dd; best = s; }
    }
    p.s = best;
    p.offset = p.lane0 ?? 0.3;
  }

  // at their post: the clerk and the shopper walk their beat with pauses; the street's people stand
  post(p, dt, d, flyingOver) {
    const hp = this.story.player.position;
    let speed = 0, want = p.yaw;
    if (!p.inside) {
      const over = flyingOver && d < 16 && hp.y > p.pos.y + 3;
      if (over !== !!p.up) {
        p.up = over;
        this.look(p, over ? this.halHead() : null, 0.8);
        if (p.does === 'wait' && p.voice === 'citykid') p.anim.reach('R', over ? () => p.rig.bonePosition('upperArm_R', _p).add(_a.copy(hp).sub(_p).normalize().multiplyScalar(0.5)) : null, { weight: 1, rate: 6 });
        if (over && p.voice === 'citykid' && this.t - (this.calledUp ?? -99) > 12) { this.calledUp = this.t; this.story.bark('cityUp3'); }
      }
      if (p.up) return { speed: 0, want: p.does === 'phone' ? p.yaw : Math.atan2(hp.x - p.pos.x, hp.z - p.pos.z) };
    }
    if (p.post?.beat && !p.paused) {
      p.t -= dt;
      if (p.t < 0 && !p.goal) { p.goal = p.post.beat[Math.random() < 0.5 ? 0 : 1].clone().lerp(p.home, Math.random() * 0.6); p.t = 3 + Math.random() * 6; }
      if (p.goal) {
        _a.copy(p.goal).sub(p.pos).setY(0);
        const l = _a.length();
        if (l < 0.08) p.goal = null;
        else if (this.inWay(p, _a.normalize(), l)) { // (Hal in the aisle: they wait, as on a route)
          want = Math.atan2(_a.x, _a.z);
          if ((p.waitT = (p.waitT ?? 0) + dt) > 1.2 && this.t - (p.excused ?? -99) > 8) { p.excused = this.t; this.excuse(p); }
        } else { p.waitT = 0; speed = Math.min(p.speed, l * 2 + 0.15); p.pos.addScaledVector(_a, speed * dt); want = Math.atan2(_a.x, _a.z); }
      }
      if (!p.goal) want = p.post.face;
    }
    const looking = d < (p.inside ? 6 : 3.5) && this.story.player.control;
    if (looking !== p.watching && !p.talking && !this.talking?.people.includes(p)) { p.watching = looking; this.look(p, looking ? this.halHead() : (p.partner ? this.headOf(p.partner) : null), looking ? 0.55 : 0.6); }
    if (p.does === 'chat' && !p.talking) { p.beat = (p.beat ?? Math.random() * 3) - dt; if (p.beat < 0) { p.beat = 1.8 + Math.random() * 2.5; p.anim.gesture(Math.random() < 0.6 ? 'beat' : 'nod', 0.9, 0.4); } }
    return { speed, want };
  }

  seatedLook(p, d, dt, flyingOver) {
    if (this.talking?.people.includes(p) || p.talking) return;
    const looking = (d < 2.5 && this.story.player.control) || (!p.inside && flyingOver && d < 16 && this.story.player.position.y > p.pos.y + 3);
    if (looking !== p.watching) { p.watching = looking; this.look(p, looking ? this.halHead() : p.partner ? this.headOf(p.partner) : null, 0.5); }
  }

  inDiner(at) { return this.diner?.inside(at) ?? false; }

  // ---------------------------------------------------------------- the diner and the store
  seated(sp) { this.diner?.halSits(sp); }
  stood(sp) { this.diner?.halStands(sp); }

  // the store's bell: Ray comes to the register and answers
  bell() {
    const ray = this.people.find((p) => p.kind === 'clerk');
    if (!ray || ray.talking) return null;
    ray.goal = ray.home.clone();
    return this.say(ray, this.story.civilian ? 'clerkBell' : 'clerkGBell');
  }
  // Ray says something at the register (null if he isn't about)
  clerkSay(key) { const ray = this.people.find((p) => p.kind === 'clerk'); return ray && !ray.talking ? this.say(ray, key) : null; }

  // someone gone for good (story/Emergencies.js's people, when their scene is cleared)
  remove(p) {
    p.rig.root.removeFromParent();
    this.capsules.delete(p.rb.collider(0)?.handle);
    this.f.physics.world.removeRigidBody(p.rb);
    const i = this.f.interactables.indexOf(p.it);
    if (i >= 0) this.f.interactables.splice(i, 1);
    this.people = this.people.filter((q) => q !== p);
    this.talks = this.talks.filter((g) => !g.people.includes(p));
  }

  dispose() {
    this.story.powers.watchers.delete(this.watch);
    this.diner?.dispose();
    for (const p of this.people) {
      p.rig.root.removeFromParent();
      this.f.physics.world.removeRigidBody(p.rb);
      const i = this.f.interactables.indexOf(p.it);
      if (i >= 0) this.f.interactables.splice(i, 1);
    }
    this.people = [];
  }
}

const _q = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _c2 = new THREE.Vector3();

// a line with no clip (or the voices off): it takes as long as it would to say, in game time, the jaw
// moving at a talking rate
function silent(text) {
  let t = 0, stopped = false;
  const est = Math.max(1.2, text.length * 0.065);
  const done = new Promise((res) => { const stop = onFrame((dt) => { t += dt; if (stopped || t > est) { stop(); res(); } }); });
  return { done, stop() { stopped = true; }, mouth: () => (stopped ? 0 : Math.max(0, 0.35 + 0.3 * Math.sin(t * 19) * Math.sin(t * 7.3))), gain() {} };
}
