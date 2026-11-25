// What a city that's turned against Green Lantern does about it (the user's call, 2026-11-18: when
// public opinion is low, "pressure, no fighting: cordons, helicopters, booing, the Air Force at the
// lowest"). The booing is in what people mutter (story/CityLife.js's mood pools); here, by how low it's
// gone (story/Life.js's opinion) while he's in town in the uniform:
// - below -30, a news helicopter: up over him, circling and keeping him in view (a beam on him at
//   night, a light's cone drawn, not a light: one added mid-play recompiles every material);
// - below -50, police lines across the block's two ends, each with a cruiser behind it, its bar going;
// - below -80, the Air Force: a pair of jets low over the town every so often, the boom after.
import * as THREE from 'three';
import { prop, loadProps, meshes, boundsIn, pivot } from '../props/Props.js';
import { glowTexture } from '../fx/Textures.js';
import { LOT } from '../scenes/Ferris.js';
import { LANES } from '../city/Traffic.js';

const V = (x, y, z) => new THREE.Vector3(x + LOT.x, y, z + LOT.z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);

// a searchlight's beam: additive, its light along the cone's core (how square on the surface faces the camera), none
// at its silhouette, falling off from the lamp (the cone's uv runs 1 at its apex to 0 at its foot)
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.95, 0.85) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vAlong;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vAlong = uv.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying float vAlong;
      void main() {
        float face = abs(dot(normalize(vN), normalize(vV)));
        float a = uOpacity * pow(face, 2.2) * mix(0.25, 1.0, vAlong * vAlong) * smoothstep(0.0, 0.08, vAlong) * smoothstep(1.0, 0.97, vAlong);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}

export class Pressure {
  constructor(story, f) {
    Object.assign(this, { story, f });
    this.t = 0;
    this.loaded = loadProps(['helicopter', 'policeline', 'policecar', 'prototype']).then(() => (this.ready = true));
  }

  update(dt) {
    const story = this.story, life = story.life;
    if (!this.ready || !life || dt <= 0) return;
    this.t += dt;
    const o = life.opinion, here = story.roaming && story.current === this.f && !story.civilian && story.player.position.z > LOT.z - 320;
    this.heli(dt, here && o < -30);
    this.cordon(here && o < -50 || (this.lines && o < -45)); // (a margin, so a point either way doesn't flicker it)
    this.airForce(dt, here && o < -80);
  }

  // ---------------------------------------------------------------- the helicopter
  heli(dt, want) {
    const story = this.story, hp = story.player.position;
    if (want && !this.chopper) {
      const g = new THREE.Group(), body = prop('helicopter');
      g.add(body);
      // its rotors on hubs of their own (the main one's blades are one mesh, the tail's another)
      const main = meshes(body, (n) => true).filter((m) => /elise/i.test(m.material?.name ?? '')), tail = meshes(body, () => true).filter((m) => /^rotor$/i.test(m.material?.name ?? ''));
      const hub = (list) => (list.length ? pivot(body, list, boundsIn(body, list).getCenter(new THREE.Vector3())) : null);
      this.rotor = hub(main);
      this.tailRotor = hub(tail);
      // the beam: a long cone, drawn additively, from its nose down to him; bright along its core and gone at its
      // edges as it turns away from the camera, brightest near the lamp (a flat cone of one opacity read as a pale
      // wedge across the picture, hard-edged)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1, 32, 8, true).translate(0, -0.5, 0), beamMaterial());
      cone.frustumCulled = false;
      this.f.scene.add(cone);
      this.beam = cone;
      // and where it lands: a pool of its light on the ground round him (from inside the cone, the camera just
      // behind him, the cone's walls are what's left out)
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'), color: new THREE.Color(1.0, 0.95, 0.85), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      spot.scale.setScalar(6.5);
      this.f.scene.add(spot);
      this.spot = spot;
      g.position.copy(hp).add(_a.set(-140, 90, 80));
      this.f.scene.add(g);
      this.chopper = { g, a: Math.random() * 6, life: 0, gone: false, sound: story.audio.wind?.(0) };
      story.ui.toast('A news helicopter is following Green Lantern');
    }
    const c = this.chopper;
    if (!c) return;
    // circling him at 70 m, 55 m up; leaving when it's no longer wanted, away to the east
    c.a += dt * 0.12;
    const tgt = want ? _a.set(hp.x + Math.cos(c.a) * 70, hp.y + 55, hp.z + Math.sin(c.a) * 70) : _a.copy(c.g.position).add(_b.set(400, 60, -200));
    c.g.position.lerp(tgt, Math.min(1, dt * (want ? 0.35 : 0.08)));
    // nose toward him, banked a little into its turn
    _b.copy(hp).sub(c.g.position).setY(0);
    c.g.rotation.set(0, Math.atan2(_b.x, _b.z), 0.12); // (props face +z)
    if (this.rotor) this.rotor.rotation.y += dt * 38;
    if (this.tailRotor) this.tailRotor.rotation.x += dt * 60;
    // the beam on him by night
    const night = this.f.isNight, b = this.beam;
    // (fainter with the camera inside it: from in there it washed out half the picture)
    const cam = this.story.engine.camera.position, axis = _b.copy(hp).sub(c.g.position), tt = Math.max(0, Math.min(1, _a.copy(cam).sub(c.g.position).dot(axis) / axis.lengthSq()));
    const off = _a.copy(c.g.position).addScaledVector(axis, tt).distanceTo(cam), inside = off < 2.6 * tt + 0.5;
    const u = b.material.uniforms.uOpacity;
    u.value += ((want && night ? (inside ? 0 : 0.22) : 0) - u.value) * Math.min(1, dt * 3);
    b.visible = u.value > 0.005;
    const sp = this.spot, on = want && night ? 0.55 : 0;
    sp.material.opacity += (on - sp.material.opacity) * Math.min(1, dt * 3);
    sp.visible = sp.material.opacity > 0.005;
    if (sp.visible) sp.position.set(hp.x, (story.player.flying ? this.f.groundAt?.(hp.x, hp.z) ?? 0 : hp.y) + 0.03, hp.z);
    if (b.visible) {
      // its apex at the helicopter, out along the line to him (the cone runs down -y from its apex)
      const d = _b.copy(hp).sub(c.g.position), len = d.length();
      b.position.copy(c.g.position);
      b.scale.set(1, len, 1);
      b.quaternion.setFromUnitVectors(_down, d.normalize());
    }
    const dist = c.g.position.distanceTo(this.story.engine.camera.position);
    c.sound?.level(Math.max(0, 0.08 * (1 - dist / 260)), 1);
    if (!want && dist > 380) { c.sound?.stop(1); c.g.removeFromParent(); this.beam.removeFromParent(); this.spot.removeFromParent(); this.chopper = null; this.rotor = this.tailRotor = null; }
  }

  // ---------------------------------------------------------------- the police lines
  cordon(want) {
    const story = this.story;
    if (want && !this.lines) {
      this.lines = [];
      // across the boulevard at the block's two ends, the pavements too
      for (const z of [-30, -201]) for (const x of [-3.2, 1.2, 4.0, 6.8, 9.6, 13.6]) {
        const b = prop('policeline');
        b.position.copy(V(x, 0, z));
        b.rotation.y = 0;
        this.f.scene.add(b);
        this.f.smash.add(b, { mass: 18, stuff: 'wood' });
        this.lines.push(b);
        story.traffic?.extra.push(b); // (the traffic stops at them)
      }
      const { NB, SB, SOUTH, STOP } = LANES, tr = story.traffic;
      // (the first nose up to the line, its tail clear of the cross street's eastbound lane: short of -205 it stood
      // over it, and the cross street's traffic, that the cordon leaves open, queued behind it through the crossing)
      this.cruisers = tr ? [tr.dispatch('policecar', [[NB, SOUTH], [NB, STOP.NB], [NB, -204]], { speed: 12 }), tr.dispatch('policecar', [[SB, -8], [SB, -26]], { speed: 10 })] : [];
      story.ui.toast('The police have cordoned off the block');
    } else if (!want && this.lines) {
      for (const b of this.lines) this.f.smash.remove(this.f.smash.items.find((it) => it.object === b));
      for (const c of this.cruisers ?? []) { story.traffic?.dismiss(c); this.f.smash.remove(c.item); }
      if (story.traffic) story.traffic.extra = story.traffic.extra.filter((o) => !this.lines.includes(o));
      this.lines = null;
      this.cruisers = null;
    }
    // their bars going
    if (this.cruisers) for (const c of this.cruisers) {
      c.bar ??= (() => { const out = []; c.obj.updateMatrixWorld(true); c.obj.traverse((m) => { if (m.isMesh && /light/i.test(m.material?.name ?? '') && m.getWorldPosition(_a).y > 1.3) { m.material = m.material.clone(); out.push(m); } }); return out; })();
      const k = Math.floor(this.t * 4);
      for (const [i, m] of c.bar.entries()) { if (!m.material.emissive) continue; m.material.emissive.setHex(i % 2 ? 0x2a50ff : 0xff2020); m.material.emissiveIntensity = (k + i) % 2 ? 2.2 : 0.2; }
    }
  }

  // ---------------------------------------------------------------- the Air Force
  airForce(dt, want) {
    const story = this.story;
    if (this.jets) {
      const j = this.jets;
      j.t += dt;
      for (const [i, m] of j.planes.entries()) {
        m.position.copy(j.from).addScaledVector(j.dir, j.t * 230 + i * -40).add(_a.set(i * 18, -i * 6, i * 12));
        m.lookAt(_b.copy(m.position).add(j.dir));
      }
      const d = j.planes[0].position.distanceTo(story.engine.camera.position);
      if (!j.boomed && d < 160) { j.boomed = true; story.audio.sonicBoom?.(0.9); story.director.shake?.(0.35, 0.5); }
      if (j.t > 12) { for (const m of j.planes) m.removeFromParent(); j.sound?.stop?.(); this.jets = null; }
      return;
    }
    if (!want || (this.jetT = (this.jetT ?? 8) - dt) > 0) return;
    this.jetT = 35 + Math.random() * 25;
    // a pass over the town, from the desert to the sea, 140 m up
    const hp = story.player.position, dir = new THREE.Vector3(Math.random() - 0.5, 0, -1).normalize();
    const from = hp.clone().addScaledVector(dir, -1400).setY(140);
    const planes = [prop('prototype'), prop('prototype')];
    for (const m of planes) this.f.scene.add(m);
    this.jets = { t: 0, dir, from, planes, boomed: false, sound: story.audio.jetEngine?.() };
    story.ui.toast('The Air Force is over Coast City');
  }
}
