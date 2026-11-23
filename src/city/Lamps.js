// The scene's point lights, pooled. three.js shades every point light in a scene for every lit pixel,
// on or off, near or far, and adding or removing one recompiles every material; the valley had 17 (the
// hangar's work lamps, the street lamps' lights at night, the diner's and the store's, the shops', the
// offices'), most of them out of sight or at nothing. Here a few real lights stay in the scene for good
// and go to the sources nearest the camera that are on, fading over a few frames as they move between
// them. A source is a place (an Object3D: a marker that moves with whatever it's on) with a colour, a
// power and a reach; set its `power` to turn it up, down or off.
import * as THREE from 'three';

const _p = new THREE.Vector3();
// in the scene and drawn (an adopted light's marker: put away with whatever it was on)
const shown = (o) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };

export class LampPool {
  // (`decay`: how fast its light falls off; 2 is physical, lower reaches further and softer)
  constructor(scene, n = 4, { decay = 2 } = {}) {
    this.lights = Array.from({ length: n }, () => {
      const l = new THREE.PointLight(0xffffff, 0, 10, decay);
      l.userData.src = null;
      scene.add(l);
      return l;
    });
    this.sources = [];
    this.t = 1;
  }

  // a source at `at` (an Object3D), `power` its intensity when on
  add(at, { color = 0xffffff, power = 10, reach = 12 } = {}) {
    const src = { at, color: new THREE.Color(color), power, reach, d: Infinity };
    this.sources.push(src);
    return src;
  }

  // A point light already made (by a scene, or a fire) taken out of the scene and lit by the pool from now
  // on: its place (a marker where it stood), colour and reach, and its intensity followed as whatever made
  // it goes on changing it (a fire's flicker, a room's light put out). (Korugar had seventeen.)
  adopt(light) {
    const at = new THREE.Object3D();
    at.position.copy(light.position);
    light.parent?.add(at);
    light.removeFromParent();
    const src = this.add(at, { color: light.color, power: light.intensity, reach: light.distance || 12 });
    src.from = light;
    return src;
  }

  update(dt, camera) {
    this.t += dt;
    const cam = camera.position;
    for (const s of this.sources) if (s.from) s.power = s.from.visible && shown(s.at) ? s.from.intensity : 0;
    // which ones: those on, nearest to the camera's reach of them (checked ten times a second)
    if (this.t > 0.1) {
      this.t = 0;
      const live = [];
      for (const s of this.sources) {
        if (s.power <= 0.01) continue;
        s.d = s.at.getWorldPosition(_p).distanceTo(cam) - s.reach;
        if (s.d < 45) live.push(s);
      }
      live.sort((a, b) => a.d - b.d);
      this.chosen = new Set(live.slice(0, this.lights.length));
      // a light keeps its source if it's still chosen; the others go to the newly chosen
      const free = [];
      for (const l of this.lights) if (!this.chosen.has(l.userData.src)) free.push(l);
      const held = new Set(this.lights.map((l) => l.userData.src));
      for (const s of this.chosen) if (!held.has(s)) { const l = free.find((f) => f.intensity < 0.05); if (l) { l.userData.src = s; l.color.copy(s.color); l.distance = s.reach; } }
    }
    for (const l of this.lights) {
      const s = l.userData.src, want = s && this.chosen?.has(s) ? s.power : 0;
      l.intensity += (want - l.intensity) * Math.min(1, dt * 6);
      if (s) l.position.copy(s.at.getWorldPosition(_p));
      if (!want && l.intensity < 0.05) { l.intensity = 0; l.userData.src = null; }
    }
  }
}
