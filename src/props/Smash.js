import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { Particles, Fire } from '../fx/Particles.js';

// What a scene is made of, for the ring and everyone else in it. The user's standard (2026-11-11):
// no prop is scenery you pass through; "GTA 5's level of interactability". A scene puts each thing
// it places through here, as one of:
//   solid    fixed: touched, stood on, struck (sparks and dust), never moved (buildings, the frame)
//   loose    a dynamic body with its real weight: shoved, slid, tipped, knocked flying
//   breaks   fixed in place until blows beat its `strong`: then it's loose, with its own break (a
//            fence panel torn off its posts, a lamp post snapped at its foot and its light out, a
//            hydrant sheared off with the water going up)
//   car      loose, with a damage model: dents pushed in where it's hit, the glass shattering, the
//            alarm and the hazard lights, smoke from the engine, then fire, then it goes up (a burst
//            that throws and burns what's near), and the black wreck stays where it lands
// Blows come from the ring (`RingPowers.shove` calls `blow`) and from collisions (Rapier's contact
// force events, `onForce`: a thrown beam, a car into a car, Atrocitus charging through, a wreck
// landing). Effects and sounds go through `fx`, the RingPowers attached to the scene (null while
// the ring is off: things still move, quietly).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const STUFF = { // what flies off it when it's hit, and how it sounds
  metal: { chip: [0.5, 0.5, 0.52], sound: 'crunch' },
  plastic: { chip: [0.75, 0.72, 0.62], sound: 'clatter' },
  wood: { chip: [0.48, 0.36, 0.24], sound: 'clatter' },
  stone: { chip: [0.62, 0.6, 0.56], sound: 'dust' },
};
const CAR = { health: 100, smoke: 55, fire: 22, fuse: 5.5, blast: 7.5 }; // (smoking below 55, burning below 22, up after the fuse)

export class Smash {
  constructor(physics, scene) {
    Object.assign(this, { physics, scene });
    physics.smash = this;
    physics.events ??= new RAPIER.EventQueue(true);
    this.items = [];
    this.byBody = new Map();
    this.byCollider = new Map();
    this.fx = null;
    this.clock = 0;
    this.camera = null;
    // glass, chips and water (falling), smoke (rising, soft), sparks and fireballs (glowing)
    this.bits = new Particles(1400, { additive: false, gravity: -9.8, drag: 0.35 });
    this.smoke = new Particles(500, { additive: false, soft: 0.1, puffy: true, drag: 0.3, turbulence: 0.35, wind: V(0.3, 0.2, 0.1) });
    this.glow = new Particles(700, { additive: true, gravity: -3, drag: 0.8, turbulence: 0.9 });
    this.water = new Particles(1200, { additive: false, soft: 0.14, gravity: -9.8, drag: 0.3, turbulence: 0.5 }); // (a hydrant's spray)
    scene.add(this.bits.points, this.smoke.points, this.glow.points, this.water.points);
    this.live = []; // burning things, geysers: { update(dt, t) -> keep? }
  }

  // ---------------------------------------------------------------------------------- adding
  // `object` stands in the scene (its parent is the scene) on its origin; the body is made at its
  // pose and its collider fitted to its bounds in its own frame (`box` overrides, local), shrunk a
  // little (`shrink`) so neighbours don't start in contact.
  add(object, { kind = 'loose', mass = 100, shrink = 0.94, box = null, stuff = 'metal', strong = 12, give = null, friction = 0.8, restitution = 0.08, onBreak = null, glass = true } = {}) {
    if (object.parent !== this.scene) this.scene.attach(object); // (placed in a group: its body is in world space)
    const b = box ?? this.localBox(object);
    const half = b.getSize(V(0, 0, 0)).multiplyScalar(0.5 * shrink), center = b.getCenter(V(0, 0, 0));
    half.max(V(0.04, 0.04, 0.04));
    const fixed = kind === 'solid' || kind === 'breaks';
    object.updateMatrixWorld(true);
    const p = object.position, q = object.quaternion;
    const desc = (fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.12).setAngularDamping(0.45).setCanSleep(true))
      .setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = this.physics.world.createRigidBody(desc);
    const cd = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z).setFriction(friction).setRestitution(restitution).setMass(mass);
    if (kind !== 'solid') cd.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(Math.max(mass * 25, fixed ? 4000 : 0));
    const collider = this.physics.world.createCollider(cd, body);
    const item = {
      kind, object, body, collider, mass, stuff, half, center, onBreak,
      radius: Math.hypot(half.x, half.y, half.z),
      give: give ?? (mass > 800 ? 6 : mass > 250 ? 3 : 1), // how far past the ring's usual cap a blow shoves it
      health: kind === 'car' ? CAR.health : strong, max: kind === 'car' ? CAR.health : strong,
      glass: glass ? glassOf(object) : [],
      t: 0,
    };
    if (kind === 'car') this.carParts(item);
    this.items.push(item);
    this.byBody.set(body.handle, item);
    this.byCollider.set(collider.handle, item);
    if (kind !== 'solid') this.physics.dynamics.push({ body, mesh: object, radius: item.radius, item });
    return item;
  }

  // A solid: fixed, fitted to its box, or with `mesh` to its own triangles (a building's footprint
  // is rarely its box: office6's reached out over the street).
  solid(object, opts = {}) {
    if (!opts.mesh) return this.add(object, { ...opts, kind: 'solid' });
    if (object.parent !== this.scene) this.scene.attach(object);
    const b = this.localBox(object), item = { kind: 'solid', object, stuff: opts.stuff ?? 'stone', glass: [], half: b.getSize(V(0, 0, 0)).multiplyScalar(0.5), center: b.getCenter(V(0, 0, 0)), mass: 1e9, t: 0 };
    item.radius = item.half.length();
    object.updateMatrixWorld(true);
    object.traverse((m) => {
      if (!m.isMesh) return;
      const body = this.physics.fixedTrimesh(m);
      item.body ??= body;
      this.byCollider.set(body.collider(0).handle, item);
    });
    if (!item.body) return null;
    // (its pose for `nearest`: the box is in the object's frame, so the body stands in for it at the object's pose)
    item.pose = { p: object.position.clone(), q: object.quaternion.clone() };
    this.items.push(item);
    return item;
  }

  of(body) { return body ? this.byBody.get(body.handle) ?? null : null; }
  ofCollider(c) { return c ? this.byCollider.get(c.handle) ?? null : null; }

  // the object's box in its own frame (rotation and position taken off; scale kept)
  localBox(object) {
    const p = object.position.clone(), q = object.quaternion.clone(), parent = object.parent;
    object.position.set(0, 0, 0);
    object.quaternion.identity();
    object.updateMatrixWorld(true);
    const b = new THREE.Box3();
    object.traverseVisible((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox?.();
      if (o.geometry.boundingBox) b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    object.position.copy(p);
    object.quaternion.copy(q);
    object.updateMatrixWorld(true);
    void parent;
    return b;
  }

  // ---------------------------------------------------------------------------------- blows
  // A blow (`strength`: a hook about 18, the hammer 30, one round of the gatling 2.5, a sword cut
  // 6), landing at `at`, going `dir`. Returns false if what was struck stays put (a solid, or a
  // breakable that held).
  // Gone for good (a car towed, a police line taken down): out of the items, the physics step's list
  // (a body removed but left in it was read the next step: Rapier panicked, and every call after was
  // "recursive use of an object"), the world, the scene; its fire too
  remove(item) {
    if (!item) return;
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    const d = this.physics.dynamics, j = d.findIndex((e) => e.body === item.body);
    if (j >= 0) d.splice(j, 1);
    if (item.hazard) item.hazard.active = () => false;
    item.fire?.group.removeFromParent();
    item.fireLoop?.stop?.(0.5);
    if (item.body && this.physics.world.bodies.contains(item.body.handle)) this.physics.world.removeRigidBody(item.body);
    item.object?.removeFromParent();
  }

  blow(item, strength, at, dir, kind = 'blow') {
    if (!item || strength <= 0) return false;
    item.lastHit = this.clock;
    item.lastKind = kind; // (what did it, for `onEvent`: the ring's blows, or a collision's 'bump')
    const fx = this.fx, gun = kind === 'gatling';
    this.chips(item, at, dir, strength);
    if (item.kind === 'solid') { if (!gun) this.sound(item.stuff, at, strength / 18); return false; }
    // glass near the blow goes
    for (const g of item.glass) if (!g.broken && (strength >= 4 || Math.random() < 0.3) && g.box.distanceToPoint(at) < 0.5 + strength * 0.03) this.shatter(item, g);
    if (item.kind === 'breaks') {
      item.health -= strength;
      if (!gun || item.health <= 0) this.sound(item.stuff, at, strength / 18);
      if (item.health > 0) return false;
      this.breakOff(item, at, dir, strength);
      return true;
    }
    if (item.kind === 'car') this.hurtCar(item, strength * 0.7, at, dir, gun); // (a hook about 18 of its 100: four or five set it burning)
    else if (!gun || Math.random() < 0.3) this.sound(item.stuff, at, Math.min(1.2, strength / 14));
    void fx;
    return true;
  }

  // A breakable giving way: loose from here on (it keeps its collider and its weight).
  breakOff(item, at, dir, strength) {
    item.kind = 'loose';
    item.broken = true;
    item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    item.body.setLinearDamping(0.12);
    item.body.setAngularDamping(0.4);
    this.sound('snap', at, 1);
    this.glow.emit(24, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = dir.x * 3 + (Math.random() - 0.5) * 5; v[1] = Math.random() * 4; v[2] = dir.z * 3 + (Math.random() - 0.5) * 5; }, { life: 0.5, size: [0.05, 0], color: [[4, 2.6, 1.2, 1], [1.2, 0.4, 0.1, 0]] });
    item.onBreak?.(item, at, dir, strength, this);
    this.onEvent?.('break', item, at);
  }

  // Rapier's contact force events (Physics.step): something hit something hard enough.
  onForce(h1, h2, force) {
    const a = this.byCollider.get(h1), b = this.byCollider.get(h2);
    if (a) this.bump(a, h2, force);
    if (b) this.bump(b, h1, force);
  }

  bump(item, other, force) {
    if (item.kind === 'solid' || this.clock - (item.lastBump ?? -9) < 0.25 || this.clock < 0.5) return;
    const world = this.physics.world, oc = world.getCollider(other);
    const dv = (force * world.timestep) / Math.max(1, item.mass); // (the change of speed it took)
    // (the ground takes less out of it: a car dropping back onto its wheels isn't a crash)
    const strength = Math.min(40, dv * (oc?.shapeType() === RAPIER.ShapeType.HeightField ? 2.4 : 4));
    if (strength < 4) return;
    item.lastBump = this.clock;
    // where they touched (the solver's contact point), struck inward from there
    let at = null;
    if (oc) world.contactPair(item.collider, oc, (m) => { for (let i = 0; i < m.numSolverContacts() && !at; i++) { const q = m.solverContactPoint(i); if (q) at = V(q.x, q.y, q.z); } });
    if (!at) { const ob = oc?.parent(), t = ob ? ob.translation() : item.body.translation(); at = this.nearest(item, V(t.x, t.y, t.z), V(0, 0, 0)); }
    const dir = this.toWorld(item, item.center, V(0, 0, 0)).sub(at).normalize();
    if (!Number.isFinite(dir.x) || dir.lengthSq() < 0.5) dir.set(0, -1, 0);
    this.blow(item, strength, at, dir, 'crash');
  }

  // Everything round an explosion takes it (cars nearby catch, glass goes, light things fly; Physics
  // `burst` does the throwing).
  blast(center, radius, strength, except = null) {
    for (const it of this.items) {
      if (it === except || it.kind === 'solid') continue;
      const p = this.nearest(it, center, V(0, 0, 0)), d = p.distanceTo(center);
      if (d > radius) continue;
      const k = 1 - d / radius;
      this.blow(it, strength * k, p, p.clone().sub(center).normalize(), 'blast');
    }
  }

  // ---------------------------------------------------------------------------------- cars
  carParts(item) {
    const o = item.object, wheels = new Set();
    for (const w of o.userData.wheels ?? []) w.traverse((m) => wheels.add(m));
    item.parts = [];
    item.lamps = [];
    o.traverse((m) => {
      if (!m.isMesh || wheels.has(m)) return;
      if (m.material.transparent && /light|lamp/i.test(m.material.name)) item.lamps.push(m);
      else if (!item.glass.some((g) => g.mesh === m)) item.parts.push(m);
    });
    // the engine, under the bonnet (the nose is +Z)
    const h = item.half, c = item.center;
    item.engine = V(c.x, c.y + h.y * 0.45, c.z + h.z * 0.62);
  }

  hurtCar(item, damage, at, dir, gun) {
    if (item.wreck) { if (!gun) this.dent(item, at, dir, damage * 0.6); this.sound('crunch', at, Math.min(1, damage / 25)); return; }
    item.health -= damage;
    this.dent(item, at, dir, damage);
    if (!gun || Math.random() < 0.25) this.sound('crunch', at, Math.min(1.3, damage / 22));
    // the alarm, the first time it's touched
    if (!item.alarm) { item.alarm = 12; if (!item.hurt) { item.hurt = true; this.onEvent?.('car', item, at); } }
    if (item.health <= CAR.fire && !item.burning) this.ignite(item);
    if (item.health <= 0) item.fuse = Math.min(item.fuse ?? CAR.fuse, 1.2);
  }

  // Dents: the parts' vertices within reach of the blow pushed in along it, falling off with the
  // distance, never more than 0.28 m from where they started (each part gets its own geometry the
  // first time).
  dent(item, at, dir, damage) {
    if (!item.parts?.length) return;
    const gun = damage < 6;
    if (gun) { item.pending = (item.pending ?? 0) + damage; item.pendingAt = at.clone(); item.pendingDir = dir.clone(); if (this.clock - (item.lastDent ?? -9) < 0.2) return; damage = item.pending; at = item.pendingAt; dir = item.pendingDir; item.pending = 0; }
    item.lastDent = this.clock;
    // pushed in, mostly into the body (a hook's swing can run along a car's flank), partly the way the blow went
    const inward = this.toWorld(item, item.center, V(0, 0, 0)).sub(at);
    inward.y *= 0.5;
    dir = inward.normalize().multiplyScalar(0.7).addScaledVector(dir, 0.3).normalize();
    this.frameOf(item);
    item.dentAt = at.clone().sub(_t).applyQuaternion(_qi.copy(_q).invert()); // (in its own frame, for looking at it after)
    item.dentDir = dir.clone().applyQuaternion(_qi);
    const depth = Math.min(0.26, 0.02 + damage * 0.0075), reach = Math.min(1.2, 0.35 + damage * 0.02); // (a hook: 15 cm over 70)
    item.object.updateMatrixWorld(true);
    const inv = new THREE.Matrix4(), la = V(0, 0, 0), lb = V(0, 0, 0), v = V(0, 0, 0), sph = new THREE.Sphere();
    for (const m of item.parts) {
      const g = m.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      sph.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
      if (sph.distanceToPoint(at) > reach) continue;
      if (!m.userData.own) {
        // its own copy, positions in a plain array (a loaded model's are often interleaved with its
        // normals and uvs: indexing that array as x, y, z threw vertices across the car as shards)
        const own = g.clone(), src = g.attributes.position, n = src.count, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
        own.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        if (g.attributes.normal) { const nn = g.attributes.normal, na = new Float32Array(n * 3); for (let i = 0; i < n; i++) { na[i * 3] = nn.getX(i); na[i * 3 + 1] = nn.getY(i); na[i * 3 + 2] = nn.getZ(i); } own.setAttribute('normal', new THREE.BufferAttribute(na, 3)); }
        m.geometry = own;
        m.userData.own = true;
        m.userData.rest = arr.slice();
      }
      const pos = m.geometry.attributes.position, rest = m.userData.rest;
      inv.copy(m.matrixWorld).invert();
      la.copy(at).applyMatrix4(inv);
      lb.copy(at).addScaledVector(dir, depth).applyMatrix4(inv);
      const disp = lb.sub(la), scale = disp.length() / depth, R = reach * scale, R2 = R * R, cap = 0.28 * scale;
      let moved = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const d2 = v.distanceToSquared(la);
        if (d2 > R2) continue;
        const w = (1 - d2 / R2) ** 2;
        v.addScaledVector(disp, w);
        // (no further from rest than the cap)
        const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2], ox = v.x - rx, oy = v.y - ry, oz = v.z - rz, o = Math.hypot(ox, oy, oz);
        if (o > cap) v.set(rx + (ox / o) * cap, ry + (oy / o) * cap, rz + (oz / o) * cap);
        pos.setXYZ(i, v.x, v.y, v.z);
        moved = true;
      }
      if (moved) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); }
    }
  }

  // A pane going: hidden, its pieces showering out and down, sparkling.
  shatter(item, g) {
    g.broken = true;
    g.mesh.visible = false;
    const b = g.box, c = b.getCenter(V(0, 0, 0)), s = b.getSize(V(0, 0, 0));
    this.bits.emit(Math.min(90, 20 + Math.round(s.x * s.y * s.z * 400)), (q, v) => {
      q[0] = c.x + (Math.random() - 0.5) * s.x; q[1] = c.y + (Math.random() - 0.5) * s.y; q[2] = c.z + (Math.random() - 0.5) * s.z;
      v[0] = (Math.random() - 0.5) * 3; v[1] = Math.random() * 2; v[2] = (Math.random() - 0.5) * 3;
    }, { life: 1.4, size: [0.035, 0.02], color: [[0.75, 0.85, 0.9, 0.9], [0.5, 0.6, 0.65, 0.0]] });
    this.glow.emit(12, (q, v) => { q[0] = c.x; q[1] = c.y; q[2] = c.z; v[0] = (Math.random() - 0.5) * 3; v[1] = Math.random() * 2; v[2] = (Math.random() - 0.5) * 3; }, { life: 0.5, size: [0.03, 0], color: [[1.4, 1.6, 1.8, 1], [0.4, 0.5, 0.6, 0]] });
    this.sound('glass', c, Math.min(1, 0.4 + s.x * s.y));
    void item;
  }

  ignite(item) {
    item.burning = true;
    this.onEvent?.('burn', item, null);
    item.fuse ??= CAR.fuse;
    const at = this.toWorld(item, item.engine);
    item.fire = new Fire(at, { radius: 0.45, rate: 60, height: 1.1 });
    item.fire.group.remove(item.fire.light); // (a light added mid-fight recompiles every material: a hitch; the bloom carries the glow)
    this.scene.add(item.fire.group);
    item.fireLoop = this.fx?.audio.fire(0.0);
    item.hazard = { position: at, radius: 1.6, dps: 10, height: 2.2, active: () => !!item.fire };
    this.fx?.hazards.push(item.hazard);
  }

  // The fuse burnt down: it goes up. A fireball, a shock that throws everything near and catches the
  // cars beside it, the car itself thrown up and over, every window gone, the paint burnt black.
  explode(item) {
    item.wreck = true;
    this.onEvent?.('explode', item, null);
    item.burning = false;
    item.alarm = 0;
    const fx = this.fx, c = this.toWorld(item, item.center), body = item.body, m = item.mass;
    body.applyImpulse({ x: (Math.random() - 0.5) * 2 * m, y: 7 * m, z: (Math.random() - 0.5) * 2 * m }, true);
    body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 3.5 * m, y: (Math.random() - 0.5) * m, z: (Math.random() - 0.5) * 3.5 * m }, true);
    for (const g of item.glass) if (!g.broken) this.shatter(item, g);
    for (const l of item.lamps) l.visible = false;
    char(item.object);
    this.glow.emit(140, (q, v) => {
      const d = V(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 7);
      q[0] = c.x; q[1] = c.y + 0.5; q[2] = c.z; v[0] = d.x; v[1] = d.y + 2; v[2] = d.z;
    }, { life: 0.9, size: [0.9, 0.2], color: [[6, 2.6, 0.7, 1], [1.2, 0.25, 0.05, 0]] });
    this.smoke.emit(40, (q, v) => { q[0] = c.x + (Math.random() - 0.5) * 2; q[1] = c.y + 1; q[2] = c.z + (Math.random() - 0.5) * 2; v[0] = (Math.random() - 0.5) * 2; v[1] = 2 + Math.random() * 3; v[2] = (Math.random() - 0.5) * 2; }, { life: 6, size: [1.4, 5], color: [[0.06, 0.055, 0.05, 0.7], [0.12, 0.12, 0.12, 0]] });
    this.physics.burst(c, 9, CAR.blast, 4, 1.2, { blow: 34, except: item });
    if (fx) {
      const d = this.camera ? this.camera.position.distanceTo(c) : 10;
      fx.audio.explosion(Math.min(1.4, 0.4 + 14 / Math.max(6, d)));
      fx.director.shake(Math.min(0.9, 8 / Math.max(6, d)), 0.8);
      fx.flash.position.copy(c).y += 1.5;
      fx.flash.intensity = 40;
      fx.hitStop = Math.max(fx.hitStop, 0.05);
      // Hal, and whoever he's fighting, if they're close
      const hal = fx.player.position, dh = hal.distanceTo(c);
      if (dh < CAR.blast) fx.damage(36 * (1 - dh / CAR.blast), c.clone().setY(c.y + 0.5), 'blast');
      for (const tg of fx.targets) {
        const dt = tg.position.distanceTo(c);
        if (tg.alive && dt < CAR.blast) fx.dealDamage(tg, 60 * (1 - dt / CAR.blast), tg.position, tg.position.clone().sub(c).normalize(), 'explosion');
      }
    }
    // it burns on a while as a wreck
    if (item.fire) { item.fire.height = 1.5; item.fire.radius = 0.9; }
    item.burnOut = 14;
  }

  // ---------------------------------------------------------------------------------- effects
  chips(item, at, dir, strength) {
    const s = STUFF[item.stuff] ?? STUFF.metal, n = Math.min(26, Math.round(strength * 1.2));
    if (n < 2) return;
    const [r, g, b] = s.chip;
    this.bits.emit(n, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = -dir.x * 2 + (Math.random() - 0.5) * 4; v[1] = 1 + Math.random() * 3; v[2] = -dir.z * 2 + (Math.random() - 0.5) * 4; }, { life: 0.8, size: [0.04, 0.03], color: [[r, g, b, 1], [r * 0.6, g * 0.6, b * 0.6, 0]] });
    if (item.stuff === 'metal' && strength > 6) this.glow.emit(Math.round(strength), (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = -dir.x * 3 + (Math.random() - 0.5) * 6; v[1] = Math.random() * 4; v[2] = -dir.z * 3 + (Math.random() - 0.5) * 6; }, { life: 0.4, size: [0.04, 0], color: [[5, 3.2, 1.4, 1], [1.4, 0.5, 0.1, 0]] });
    if (item.stuff === 'stone' || strength > 14) this.fx?.dustFx(at, Math.min(18, Math.round(strength * 0.6)), 1.4);
  }

  sound(kind, at, scale = 1) {
    const audio = this.fx?.audio;
    if (!audio) return;
    const d = this.camera ? this.camera.position.distanceTo(at) : 8, k = scale * THREE.MathUtils.clamp(1.2 - d / 55, 0.12, 1);
    if (k < 0.05) return;
    if (kind === 'crunch' || kind === 'metal') audio.crunch(k);
    else if (kind === 'clatter') audio.clatter(k);
    else if (kind === 'glass') audio.glass(k);
    else if (kind === 'snap') audio.snap(k);
    else if (kind === 'alarm' || kind === 'alarm2') audio.alarm(k, kind === 'alarm');
    else audio.impact(k * 0.6);
  }

  // ---------------------------------------------------------------------------------- helpers
  frameOf(item) {
    if (item.pose) { _q.copy(item.pose.q); _t.copy(item.pose.p); return; }
    const t = item.body.translation(), r = item.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _t.set(t.x, t.y, t.z);
  }

  toWorld(item, local, out = V(0, 0, 0)) {
    this.frameOf(item);
    return out.copy(local).applyQuaternion(_q).add(_t);
  }

  // the point on the item's box nearest `p`
  nearest(item, p, out) {
    this.frameOf(item);
    out.copy(p).sub(_t).applyQuaternion(_qi.copy(_q).invert()).sub(item.center);
    out.set(THREE.MathUtils.clamp(out.x, -item.half.x, item.half.x), THREE.MathUtils.clamp(out.y, -item.half.y, item.half.y), THREE.MathUtils.clamp(out.z, -item.half.z, item.half.z));
    return out.add(item.center).applyQuaternion(_q).add(_t);
  }

  // ---------------------------------------------------------------------------------- frame
  update(dt, t, camera, renderer) {
    this.clock += dt;
    this.camera = camera;
    for (const it of this.items) {
      if (it.kind !== 'car') continue;
      // the alarm and the hazard lights
      if (it.alarm > 0) {
        it.alarm -= dt;
        const beat = Math.floor(it.alarm * 2.4);
        if (beat !== it.beat) { it.beat = beat; const on = beat % 2 === 0; this.sound(on ? 'alarm' : 'alarm2', this.toWorld(it, it.center, _t2), 1); for (const l of it.lamps) { l.material.emissive?.setRGB(1, 0.55, 0.12); l.material.emissiveIntensity = on ? 2.5 : 0; } }
        if (it.alarm <= 0) for (const l of it.lamps) l.material.emissiveIntensity = 0;
      }
      // smoke from under the bonnet once it's badly hurt
      if (it.health < CAR.smoke && !it.wreck && Math.random() < dt * (it.health < CAR.fire ? 14 : 6)) {
        const e = this.toWorld(it, it.engine, _t2);
        this.smoke.emit(1, (q, v) => { q[0] = e.x + (Math.random() - 0.5) * 0.4; q[1] = e.y + 0.1; q[2] = e.z + (Math.random() - 0.5) * 0.4; v[0] = (Math.random() - 0.5) * 0.3; v[1] = 0.8 + Math.random() * 0.6; v[2] = (Math.random() - 0.5) * 0.3; }, { life: 3.5, size: [0.4, 1.8], color: it.health < CAR.fire ? [[0.05, 0.05, 0.05, 0.6], [0.1, 0.1, 0.1, 0]] : [[0.5, 0.5, 0.5, 0.35], [0.6, 0.6, 0.6, 0]] });
      }
      if (it.fire) {
        this.toWorld(it, it.wreck ? it.center : it.engine, it.fire.position);
        if (it.wreck) it.fire.position.y = Math.max(it.fire.position.y - 0.3, 0.1);
        it.hazard.position.copy(it.fire.position);
        it.fire.update(dt, t, camera, renderer);
        const d = camera.position.distanceTo(it.fire.position);
        it.fireLoop?.level(THREE.MathUtils.clamp(0.5 - d / 60, 0, 0.4) * it.fire.intensity, 0.3);
        if (it.burning && (it.fuse -= dt) <= 0) this.explode(it);
        if (it.wreck && (it.burnOut -= dt) < 4) it.fire.intensity = Math.max(0, it.burnOut / 4);
        if (it.wreck && it.burnOut <= 0) this.putOut(it);
      }
    }
    for (const l of this.live) l.update(dt, t);
    this.live = this.live.filter((l) => !l.done);
    this.bits.update(dt, t, camera, renderer);
    this.smoke.update(dt, t, camera, renderer);
    this.glow.update(dt, t, camera, renderer);
    this.water.update(dt, t, camera, renderer);
  }

  putOut(it) {
    it.fire.group.removeFromParent();
    it.fire = null;
    it.fireLoop?.stop(1.5);
    if (this.fx) this.fx.hazards = this.fx.hazards.filter((h) => h !== it.hazard);
  }

  // A geyser out of a sheared hydrant (`at` its foot), for `life` seconds.
  geyser(at, life = 18) {
    const loop = this.fx?.audio.water(0);
    const g = {
      t: 0,
      update: (dt) => {
        g.t += dt;
        const k = g.t < 0.4 ? g.t / 0.4 : g.t > life - 3 ? Math.max(0, (life - g.t) / 3) : 1;
        this.water.emit(Math.round(16 * k), (q, v) => { q[0] = at.x + (Math.random() - 0.5) * 0.12; q[1] = at.y + 0.3; q[2] = at.z + (Math.random() - 0.5) * 0.12; v[0] = (Math.random() - 0.5) * 1.4; v[1] = 9 + Math.random() * 4; v[2] = (Math.random() - 0.5) * 1.4; }, { life: 1.9, size: [0.16, 0.55], color: [[0.62, 0.7, 0.78, 0.42], [0.55, 0.62, 0.7, 0.0]] });
        if (this.camera) loop?.level(THREE.MathUtils.clamp(0.4 - this.camera.position.distanceTo(at) / 80, 0, 0.3) * k, 0.4);
        if (g.t > life) { g.done = true; loop?.stop(1); }
      },
    };
    this.live.push(g);
  }

  dispose() {
    for (const it of this.items) { it.fireLoop?.stop(0.5); }
    this.items = [];
  }
}

// The panes of a thing: its transparent parts that aren't lamps, each with its box in the world
// (taken when it's placed; a pane that moves with a loose body is found by its own box near enough).
function glassOf(object) {
  const out = [];
  object.updateMatrixWorld(true);
  object.traverse((m) => {
    if (!m.isMesh || !m.material?.transparent || /light|lamp/i.test(m.material.name ?? '')) return;
    out.push({ mesh: m, get box() { return new THREE.Box3().setFromObject(m); } });
  });
  return out;
}

// Burnt black: every part's material its own, darkened, matt.
function char(object) {
  object.traverse((m) => {
    if (!m.isMesh) return;
    const mat = (m.material = m.material.clone());
    mat.color?.multiplyScalar(0.12);
    if (mat.map) mat.color?.setRGB(0.09, 0.085, 0.08);
    mat.roughness = 1;
    mat.metalness = 0.15;
    if (mat.emissive) mat.emissiveIntensity = 0;
  });
}

const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _t = new THREE.Vector3(), _t2 = new THREE.Vector3();
