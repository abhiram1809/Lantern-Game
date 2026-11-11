import * as THREE from 'three';
import { Physics } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { glowTexture, pbrMaterial } from '../fx/Textures.js';
import { prop, piece, hasProp } from '../props/Props.js';

// Ysmault, Sector 666 (Part Four): the dead world where the Guardians chained the Five Inversions
// after the Manhunters had killed everything else in the sector. A basin of rust-red rock under a
// swollen red sun, ringed by buttes; five black obelisks in a ring at its middle, each with its
// chains, their old script still glowing; Atrocitus brought back to his. North is -Z; the sun low
// in the north-west.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const YSMAULT_PROPS = ['cliff', 'obelisks', 'chain', 'shackles', 'rocks'];
export const RING_R = 9; // the obelisks' circle
export const STAKE = V(0, 0, -RING_R); // Atrocitus's obelisk, the far one
export const LANDING = V(1.5, 0, 6); // where Hal comes down, facing it across the ring
const OBELISK = [/^Rock1/, /^Rock2/, /^Rock3/];

const _d = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export class Ysmault {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x3a160e, 0.0095);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.15;
    s.userData.exposure = 1.0;
    s.userData.far = 1500;
    s.userData.near = 0.1;
    this.sky = createSky('ysmault', 700);
    s.add(this.sky);
    const sunDir = this.sky.userData.uniforms.uSunDir.value;
    s.add(new THREE.HemisphereLight(0x7a3424, 0x180806, 0.55));
    const sun = (this.sun = new THREE.DirectionalLight(0xff9064, 1.9));
    sun.position.copy(sunDir).multiplyScalar(120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 300 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    // the basin floor: rust-red grit
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 28, 28).rotateX(-Math.PI / 2), pbrMaterial('gravelly_sand', { repeat: [140, 140], tint: new THREE.Color(0.48, 0.22, 0.15) }));
    floor.receiveShadow = true;
    s.add(floor);
    this.physics.fixedGround(700);
    this.buildCliffs();
    this.buildRocks();
    this.buildRing();
    return this;
  }

  // the buttes round the basin, darkened to the world's rust
  buildCliffs() {
    if (!hasProp('cliff')) return;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.4, r = 70 + rnd() * 40, sc = 1.3 + rnd() * 1.2;
      const c = prop('cliff', { ownMaterials: i === 0 });
      if (i === 0) c.traverse((m) => { if (m.isMesh) m.material.color.setRGB(0.62, 0.3, 0.24); });
      else c.traverse((m) => { if (m.isMesh) m.material = this.cliffMat; });
      if (i === 0) c.traverse((m) => { if (m.isMesh) this.cliffMat = m.material; });
      c.position.set(Math.sin(a) * r, -2 - rnd() * 3, Math.cos(a) * r);
      c.rotation.y = rnd() * 6.28;
      c.scale.setScalar(sc);
      this.scene.add(c);
    }
  }

  // loose rock across the floor, kept out of the ring
  buildRocks() {
    if (!hasProp('rocks')) return;
    const names = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => new RegExp(`^Object_${n}$`));
    let tinted = null;
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 15 + rnd() * 45;
      const o = piece('rocks', names[i % names.length], { root: true });
      o.traverse((m) => { if (m.isMesh) { if (!tinted) { tinted = m.material.clone(); tinted.color.setRGB(0.5, 0.26, 0.2); } m.material = tinted; } });
      o.position.set(Math.sin(a) * r, -0.1, Math.cos(a) * r);
      o.rotation.y = rnd() * 6.28;
      o.scale.setScalar(0.8 + rnd() * 1.4);
      this.scene.add(o);
    }
  }

  // Five obelisks in a ring, a pair of chains hanging from each, empty shackles at their feet; their
  // glyphs lit red (the pack's purple turned to the world's colour).
  buildRing() {
    const s = this.scene;
    this.obelisks = [];
    const glow = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)'), color: new THREE.Color(1.6, 0.25, 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    let mats = null;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 5) * Math.PI * 2; // the first at the far side (north)
      const at = V(Math.sin(a) * RING_R, 0, Math.cos(a) * RING_R);
      const o = hasProp('obelisks') ? piece('obelisks', OBELISK[i % 3], { root: true }) : new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.4).translate(0, 4, 0), new THREE.MeshStandardMaterial({ color: 0x1c1616 }));
      mats ??= new Map();
      o.traverse((m) => { if (m.isMesh) m.material = mats.get(m.material) ?? mats.set(m.material, redStone(m.material)).get(m.material); });
      o.position.copy(at);
      o.rotation.y = a + Math.PI; // its face to the middle
      s.add(o);
      this.physics.fixedBox({ x: at.x, y: 4, z: at.z }, { x: 0.8, y: 4, z: 0.8 });
      const front = V(-Math.sin(a), 0, -Math.cos(a)), side = V(front.z, 0, -front.x);
      // chains from iron rings high on the face, down to the shackles on the ground
      for (const k of [-1, 1]) {
        const top = at.clone().addScaledVector(front, 0.75).addScaledVector(side, 0.45 * k).setY(4.6);
        const foot = at.clone().addScaledVector(front, 1.6).addScaledVector(side, 0.7 * k).setY(0.05);
        if (i > 0) this.chainBetween(top, foot, 0.15);
        else this.anchors = [...(this.anchors ?? []), top];
      }
      if (i > 0 && hasProp('shackles')) { const sh = prop('shackles'); sh.position.copy(at).addScaledVector(front, 1.8).setY(0.02); sh.rotation.y = a + 0.4; s.add(sh); }
      const sp = new THREE.Sprite(glow.clone());
      sp.position.copy(at).addScaledVector(front, 0.7).setY(2.2);
      sp.scale.setScalar(2.4);
      s.add(sp);
      this.obelisks.push({ at, front, side, glow: sp });
    }
    const lamp = new THREE.PointLight(0xff3a18, 18, 18, 2);
    lamp.position.set(0, 3, 0);
    s.add(lamp);
  }

  // A hanging chain from `a` to `b` (the 4 m chain prop, stretched and turned to fit), with `sag`.
  chainBetween(a, b, sag = 0.1) {
    if (!hasProp('chain')) return null;
    const g = new THREE.Group(), c = prop('chain', { ownMaterials: !this.chainMat });
    if (!this.chainMat) c.traverse((m) => { if (m.isMesh) { m.material.color.multiplyScalar(0.32); m.material.roughness = 0.7; this.chainMat = m.material; } });
    else c.traverse((m) => { if (m.isMesh) m.material = this.chainMat; });
    // the prop hangs from its top (y 4) to its foot (y 0): along a→b, stretched to their distance
    c.position.y = -4;
    g.add(c);
    g.userData.twist = sag; // (a twist, so pairs don't hang identically)
    this.fitChain(g, a, b);
    this.scene.add(g);
    return g;
  }

  fitChain(g, a, b) {
    const d = _d.subVectors(b, a), len = d.length();
    g.position.copy(a);
    g.quaternion.setFromUnitVectors(_down, d.divideScalar(len || 1));
    g.scale.set(1, len / 4, 1);
    g.rotateY(g.userData.twist ?? 0);
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  ground() { return 0; }

  airBounds() {
    return { ground: () => 0, floor: () => 0, canLand: (x, z) => Math.hypot(x, z) < 60, center: V(0, 0, 0), radius: 90, ceiling: 80 };
  }

  update(dt, t, camera) {
    this.physics.step(dt);
    this.sky.position.copy(camera.position);
    this.sky.userData.uniforms.uTime.value = t;
    for (const [i, o] of (this.obelisks ?? []).entries()) o.glow.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.3 + i * 1.7);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}

// The obelisk pack's stone darkened, and its purple cracks and glyphs (in its colour and glow maps)
// turned to the world's red: blue swapped for red wherever blue leads.
function redStone(src) {
  const m = src.clone();
  m.color.multiplyScalar(0.6);
  m.emissive?.setRGB(1, 0.35, 0.3);
  m.onBeforeCompile = (sh) => {
    const swap = (v) => `if (${v}.b > ${v}.r && ${v}.b > ${v}.g) ${v} = vec3(${v}.b, ${v}.g * 0.25, ${v}.r * 0.15);`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n${swap('diffuseColor.rgb')}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${swap('totalEmissiveRadiance')}`);
  };
  m.customProgramCacheKey = () => 'ysmault-red-stone';
  return m;
}
