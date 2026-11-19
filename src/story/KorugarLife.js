import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { POSES, still } from '../characters/Poses.js';
import { createKorugarian, createKatma } from '../characters/Characters.js';
import { MARKET } from '../scenes/Korugar.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Korugar's streets with people in them (the user, 2026-11-17: "make the NPCs more interactable"):
// walkers on loops down the Avenue of Order, along the market street and round the plaza, and guards
// at their posts. Each is a full figure with a body you can't walk through (a kinematic capsule the
// camera ignores). E beside one: they stop, turn to him and say something (one of their pool, never
// the same twice running); while Sinestro rules, the ring then hears what they mutter after. They
// react to him: under Sinestro they back away from the ring and look down; once he's gone they look
// him in the face. Fly low over them and they look up; throw a construct near them and they run, then
// crouch where they stopped. `era`: 'sinestro' (Part Five's patrol) or 'after' (the open world).

// what they say: [line, mutter heard by the ring after (or null)], by who's speaking and when
const TALK = {
  sinestro: {
    man: [['korS1', 'korS1m'], ['korS2', 'korS2m'], ['korS3', null], ['korS4', 'korS4m'], ['korS7', null]],
    woman: [['korS5', 'korS5m'], ['korS6', null], ['korS8', 'korS8m']],
    guard: [['korG1', null], ['korG2', null]],
  },
  after: {
    man: [['korA1', 'korA1m'], ['korA2', null], ['korA3', null], ['korA5', null], ['korA7', null]],
    woman: [['korA4', null], ['korA6', null], ['korA8', null]],
    guard: [['korG3', null], ['korG4', null]],
  },
};

// a closed loop of points: at(s, p, d) with s in metres along it
function loop(points) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length], len = a.distanceTo(b); segs.push({ a, b, len, at: total }); total += len; }
  return {
    length: total,
    at(s, p, d) {
      s = ((s % total) + total) % total;
      const sg = segs.find((g) => s < g.at + g.len) ?? segs[segs.length - 1];
      const k = (s - sg.at) / sg.len;
      p.lerpVectors(sg.a, sg.b, k);
      d.copy(sg.b).sub(sg.a).normalize();
    },
  };
}
const ring = (r, n = 28) => loop(Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return V(Math.cos(a) * r, 0, Math.sin(a) * r); }));
export const ROUTES = {
  avenue: () => loop([V(-6.4, 0, -40), V(-6.4, 0, -196), V(6.4, 0, -196), V(6.4, 0, -40)]),
  market: () => loop([V(MARKET.x0 + 6, 0, -2.4), V(MARKET.x1 - 8, 0, -2.4), V(MARKET.x1 - 8, 0, 2.4), V(MARKET.x0 + 6, 0, 2.4)]),
  plaza: () => ring(31),
};

export class StreetLife {
  // `posts`: people who keep to a place of their own (the tavern's keeper and his regulars, the market's
  // vendors), each with their own lines (`lines`, in turn) and how Hal hears them named
  constructor(story, kor, { era = 'sinestro', walkers = { avenue: 5, market: 3 }, guards = [], posts = [] } = {}) {
    Object.assign(this, { story, kor, era });
    this.people = [];
    this.recent = [];
    const ch = story.assets.characters;
    let seed = 0;
    for (const [route, n] of Object.entries(walkers)) {
      const path = ROUTES[route]();
      for (let i = 0; i < n; i++) {
        const woman = ch.katma && seed % 3 === 1;
        const rig = woman ? createKatma(ch.katma, { citizen: true, seed: 1200 + seed * 7 }) : createKorugarian(ch.abin, { seed: 1300 + seed * 11 });
        this.add(rig, woman ? 'woman' : 'man', { path, s: (i / n) * path.length + seed * 3.1, dir: seed % 2 ? 1 : -1, side: ((seed % 3) - 1) * 0.45, speed: 1.1 + ((seed * 37) % 10) * 0.04 });
        seed++;
      }
    }
    for (const g of guards) this.add(createKorugarian(ch.abin, { seed: 1500 + seed++ * 5, guard: true }), 'guard', { post: g.at.clone(), yaw: g.yaw });
    for (const q of posts) {
      const woman = q.kind === 'woman' && ch.katma;
      const rig = woman ? createKatma(ch.katma, { citizen: true, seed: 1700 + seed * 7 }) : createKorugarian(ch.abin, { seed: 1800 + seed * 11 });
      seed++;
      this.add(rig, woman ? 'woman' : 'man', { post: q.at.clone(), yaw: q.yaw, lines: q.lines, tag: q.tag, label: q.label });
    }
    this.watch = { onCast: () => this.scare() };
    story.powers.watchers.add(this.watch);
    kor.updaters.push((dt) => this.update(dt));
  }

  add(rig, kind, opts) {
    const { kor, story } = this, phys = kor.physics;
    kor.scene.add(rig.root);
    const anim = new Animator(rig), loco = new Locomotion(story.mocap);
    loco.scale = rig.hipsHeight / story.mocap.hipsHeight;
    loco.relax.adduct = 0.1;
    anim.play(loco, 0);
    anim.look.maxYaw = 0.7;
    // a body to bump into (kinematic: it goes where they walk), which the camera looks through
    const rb = phys.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    const col = phys.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.88, 0), rb);
    story.player.camIgnore.add(col.handle);
    const p = { rig, anim, loco, kind, rb, state: opts.post ? 'post' : 'walk', t: 0, yaw: opts.yaw ?? 0, head: new THREE.Vector3(), ...opts };
    p.pos = rig.root.position;
    if (p.post) { p.pos.copy(p.post); rig.root.rotation.y = p.yaw; }
    else { p.path.at(p.s, p.pos, _d); p.yaw = Math.atan2(_d.x * p.dir, _d.z * p.dir); }
    p.it = kor.interact({ position: p.pos, radius: 1.9, look: p.head, label: p.label ? `Talk · ${p.label}` : 'Talk', action: () => this.talk(p) });
    this.people.push(p);
    return p;
  }

  // a line from their pool, not one heard just now
  pick(kind) {
    const pool = TALK[this.era][kind] ?? TALK[this.era].man;
    const fresh = pool.filter((l) => !this.recent.includes(l[0]));
    const line = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    this.recent.push(line[0]);
    if (this.recent.length > 4) this.recent.shift();
    return line;
  }

  async talk(p) {
    const { story } = this, player = story.player;
    if (p.state === 'flee' || p.state === 'cower') return;
    const [line, mutter] = p.lines ? [p.lines[(p.lineN = ((p.lineN ?? -1) + 1)) % p.lines.length], null] : this.pick(p.kind);
    p.state = 'talk';
    p.loco.speed = 0;
    p.anim.lookAt(story.headOf(player.rig), 0.8);
    p.faceTo = Math.atan2(player.position.x - p.pos.x, player.position.z - p.pos.z);
    story.speakingRig = p.rig;
    if (this.era === 'sinestro' && p.kind !== 'guard') p.anim.gesture('nod', 0.8, 0.35);
    await story.say(line, { skip: false });
    if (story.speakingRig === p.rig) story.speakingRig = null;
    if (mutter) {
      // he turns away; what they say once he's past
      p.anim.lookAt(null);
      p.faceTo = p.yaw + Math.PI * 0.6;
      p.anim.gesture('shake', 1.1, 0.2);
      story.ringGlow = 2;
      await story.say(mutter, { skip: false });
      story.ringGlow = 0.6;
    }
    p.anim.lookAt(null);
    p.faceTo = null;
    p.state = p.post ? 'post' : 'walk';
  }

  // a construct thrown near them: everyone within thirty metres runs from him
  scare() {
    const hp = this.story.player.position;
    for (const p of this.people) {
      if (p.kind === 'guard' || p.pos.distanceTo(hp) > 30) continue;
      p.state = 'flee';
      p.t = 2.6 + Math.random() * 1.2;
      p.anim.lookAt(this.story.headOf(this.story.player.rig), 0.6);
    }
  }

  update(dt) {
    const player = this.story.player, hp = player.position;
    for (const p of this.people) {
      const r = p.rig.root;
      let speed = 0, want = null;
      const d = Math.hypot(p.pos.x - hp.x, p.pos.z - hp.z);
      if (p.state === 'walk') {
        // under Sinestro they step out of the way of the ring and look down; after, they only slow
        const shy = this.era === 'sinestro' && d < 2.6 && player.control && !player.flying;
        if (shy) {
          _a.set(p.pos.x - hp.x, 0, p.pos.z - hp.z).setLength(1.0 * dt);
          p.pos.add(_a);
          want = Math.atan2(hp.x - p.pos.x, hp.z - p.pos.z);
          speed = 0.7;
          p.loco.direction = -1;
          if (!p.looking) { p.looking = true; p.anim.lookAt(() => p.rig.bonePosition('head', _e).add(V(0, -1, 0.3)), 0.6); }
        } else {
          p.loco.direction = 1;
          if (p.looking) { p.looking = false; p.anim.lookAt(null); }
          speed = d < 2.2 ? p.speed * 0.4 : p.speed;
          p.s += speed * dt * p.dir;
          p.path.at(p.s, _p, _d);
          _d.multiplyScalar(p.dir);
          _p.add(_a.set(_d.z, 0, -_d.x).multiplyScalar(p.side));
          // ease toward the path (they may have stepped off it)
          _a.copy(_p).sub(p.pos).setY(0);
          p.pos.addScaledVector(_a, Math.min(1, dt * 3));
          want = Math.atan2(_d.x, _d.z);
          // Hal flying low over them: they look up
          if (player.flying && d < 12 && hp.y > p.pos.y + 3) p.anim.lookAt(this.story.headOf(player.rig), 0.6);
          else if (!p.looking && p.wasUp) p.anim.lookAt(null);
          p.wasUp = player.flying && d < 12;
        }
      } else if (p.state === 'post') {
        want = p.yaw;
        if (d < 6 && player.control) p.anim.lookAt(this.story.headOf(player.rig), 0.5); else p.anim.lookAt(null);
      } else if (p.state === 'talk') {
        want = p.faceTo;
      } else if (p.state === 'flee') {
        _a.set(p.pos.x - hp.x, 0, p.pos.z - hp.z).normalize();
        p.pos.addScaledVector(_a, 3.2 * dt);
        want = Math.atan2(_a.x, _a.z);
        speed = 3.2;
        if ((p.t -= dt) < 0) { p.state = 'cower'; p.t = 3.5; p.anim.play(still(POSES.kneel, 0.5), 0.4); }
      } else if (p.state === 'cower') {
        if ((p.t -= dt) < 0) { p.state = p.post ? 'post' : 'walk'; p.anim.play(p.loco, 0.6); p.anim.lookAt(null); }
      }
      if (want != null) r.rotation.y += wrap(want - r.rotation.y) * Math.min(1, dt * 5);
      p.loco.speed = speed;
      p.it.enabled = p.state === 'walk' || p.state === 'post';
      p.anim.update(dt);
      p.rig.bonePosition('head', p.head);
      p.rb.setNextKinematicTranslation({ x: p.pos.x, y: p.pos.y, z: p.pos.z });
    }
  }

  dispose() {
    this.story.powers.watchers.delete(this.watch);
    for (const p of this.people) {
      p.rig.root.removeFromParent();
      this.kor.physics.world.removeRigidBody(p.rb);
      const i = this.kor.interactables.indexOf(p.it);
      if (i >= 0) this.kor.interactables.splice(i, 1);
    }
    this.people = [];
  }
}

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
