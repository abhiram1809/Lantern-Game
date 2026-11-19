import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';

// What the ring's bubble can hold (powers/RingPowers.js BubbleTrap; the user, 2026-11-19: "it can be a
// car, it can be an NPC, it can be anyone... The bubble stays intact for criminals... until the police
// arrives... They take him"). Free roam's people (CityLife: the block's, the city's roamers, the
// emergencies' actors) and Smash's cars, parked, wrecked or in the traffic. For the ring: `center(out)`,
// `radius`, `name`, `hold(on)`, `criminal`, `free()`, `gone()` (and `trapped`, kept on the thing itself).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _c = new THREE.Vector3();

export const TRAP = {
  // whoever or whatever the aim is on: nearest the line from the camera through the reticle, in front
  // and in reach (people's bodies don't stop the ring's rays, so the ray's end was the wall behind them),
  // a little wider the further off; the body the ray met if it was a car
  trappable(body, point, origin, dir) {
    const f = this.ferrisScene, cl = this.cityLife;
    if (!f || this.current !== f || !origin || !dir) return null;
    const c = _c, off = (x, y, z, wide) => {
      c.set(x - origin.x, y - origin.y, z - origin.z);
      const t = c.dot(dir);
      if (t < 0.3 || t > 44) return Infinity; // (up close too: a mugger squaring up to him)
      const perp = c.addScaledVector(dir, -t).length();
      const allow = wide + t * 0.018;
      return perp < allow ? perp / allow + t * 0.004 : Infinity;
    };
    let best = null, bs = Infinity;
    for (const p of cl?.people ?? []) {
      if (!p.active || p.ghost) continue;
      const sc = off(p.pos.x, p.pos.y + 1.0, p.pos.z, 0.75);
      if (sc < bs) { bs = sc; best = { p }; }
    }
    for (const it of f.smash.items) {
      if (it.kind !== 'car' || !it.body) continue;
      const o = it.object.position, sc = body && it.body === body ? 0 : off(o.x, o.y + 0.7, o.z, 1.9) + 0.15;
      if (sc < bs) { bs = sc; best = { it }; }
    }
    if (!best) return null;
    return best.p ? this.personTrap(best.p) : this.carTrap(best.it);
  },

  // A person: held where they stand, hands up against the light. A criminal in an emergency is as good as
  // down (Emergencies.down, standing: the police are called), and the bubble lets him go as the officers
  // reach him; anyone else when it's done.
  personTrap(p) {
    const cl = this.cityLife, em = this.emergencies;
    const criminal = !!(p.actor && p.tg?.alive && em?.active?.actors.includes(p));
    const sL = V(0, 0, 0), sR = V(0, 0, 0);
    const up = (side, v) => () => {
      const y = p.rig.root.rotation.y;
      p.rig.bonePosition(side === 'L' ? 'upperArm_L' : 'upperArm_R', v);
      return v.add(V(Math.sin(y) * 0.28 + Math.cos(y) * (side === 'L' ? 0.08 : -0.08), 0.42, Math.cos(y) * 0.28 - Math.sin(y) * (side === 'L' ? 0.08 : -0.08)));
    };
    return {
      name: p.label ?? 'Someone', radius: 1.2, criminal,
      get trapped() { return p.trapped; }, set trapped(v) { p.trapped = v; },
      center: (out) => out.set(p.pos.x, p.pos.y + 0.95, p.pos.z),
      hold: (on) => {
        if (on) {
          p.anim.reach('L', up('L', sL), { weight: 1, rate: 6, pole: V(0.6, -0.6, -0.4) });
          p.anim.reach('R', up('R', sR), { weight: 1, rate: 6, pole: V(-0.6, -0.6, -0.4) });
          if (criminal && p.tg?.alive) em.down(p, { kneel: false });
          if (!criminal && !this.civilian) this.life?.opine(-0.2, null);
        } else {
          p.anim.reach('L', null);
          p.anim.reach('R', null);
        }
      },
      free: () => criminal && (em?.active?.cops ?? []).some((c) => c.pos.distanceTo(p.pos) < 2.8),
      gone: () => !cl?.people.includes(p),
    };
  },

  // A car: stopped dead (a driven one held in its lane; a loose one made still), and nothing dents it.
  carTrap(it) {
    const f = this.ferrisScene, rec = this.traffic?.cars.find((c) => c.item === it);
    return {
      name: 'A car', radius: 3.0, criminal: false,
      get trapped() { return it.trapped; }, set trapped(v) { it.trapped = v; },
      center: (out) => out.copy(it.object.position).setY(it.object.position.y + 0.75),
      hold: (on) => {
        it.shielded = on;
        if (rec && rec.state === 'drive') { rec.trapped = on; return; }
        if (rec) rec.trapped = false;
        const b = it.body;
        if (on) {
          if (b.bodyType() !== RAPIER.RigidBodyType.Dynamic) return;
          it.unheld = RAPIER.RigidBodyType.Dynamic;
          b.setLinvel({ x: 0, y: 0, z: 0 }, true);
          b.setAngvel({ x: 0, y: 0, z: 0 }, true);
          b.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        } else if (it.unheld != null) {
          b.setBodyType(it.unheld, true);
          it.unheld = null;
        }
      },
      gone: () => !f.smash.items.includes(it),
    };
  },
};
