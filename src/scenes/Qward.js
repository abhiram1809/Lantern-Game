import * as THREE from 'three';
import { Physics } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { glowTexture } from '../fx/Textures.js';
import { prop, piece, hasProp } from '../props/Props.js';
import { Smash } from '../props/Smash.js';

// Qward (Part Six): the antimatter universe's world, where the Guardians sent Sinestro and where the
// Weaponers forge the yellow ring. Ours, after Emerald Dawn II's: a plain of black glass under a dead
// sun (a black disc in a violet corona), veined with the light of their furnaces; buttes of the same
// glass either side of the way north, broken rock hanging in the air; and at the end of it their
// forge, a ring of black obelisks round a crucible of yellow light whose column goes up into the
// dark. Built from Ysmault's rock props (re-skinned as obsidian) and primitives. North is -Z.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const QWARD_PROPS = ['cliff', 'obelisks', 'rocks'];
export const RIFT_AT = V(0, 46, 170); // where Hal comes through, high over the plain
export const FORGE = V(0, 0, -260); // the crucible, at the forge's middle
export const AMBUSH = V(0, 0, -10); // where the Thunderers wait for him on the way
export const PERCHES = [V(-15, 0, -34), V(16, 0, -30)]; // two glass pillars, their archers on top
export const PERCH_H = 9;
export const FORGE_R = 20; // the forge's floor
export const LANDING = V(0, 0, -260 + 16); // where Hal comes down at the forge's edge, facing the crucible

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export class Qward {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.time = { value: 0 };
    this.forgeU = { uTime: this.time, uHeat: { value: 1 } };
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0x120818, 0.0042);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.12;
    s.userData.exposure = 1.15;
    s.userData.far = 1800;
    s.userData.near = 0.1;
    this.sky = createSky('qward', 900);
    s.add(this.sky);
    const sunDir = this.sky.userData.uniforms.uSunDir.value;
    s.add((this.hemi = new THREE.HemisphereLight(0x4a2a66, 0x0c0610, 0.55)));
    const key = (this.key = new THREE.DirectionalLight(0x9a78d8, 0.9));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 400 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.05;
    s.add(key, key.target);
    this.focus(AMBUSH);
    this.glass = obsidian();
    // the plain: black glass, its veins lit from below
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 64, 64).rotateX(-Math.PI / 2), this.glass);
    floor.receiveShadow = true;
    s.add(floor);
    this.physics.fixedGround(1600);
    this.smash = new Smash(this.physics, s);
    this.blocks = [];
    this.buildSun(sunDir);
    this.buildButtes();
    this.buildPerches();
    this.buildFloating();
    this.buildForge();
    this.buildAsh();
    return this;
  }

  focus(at) {
    const d = this.sky.userData.uniforms.uSunDir.value;
    this.key.target.position.copy(at);
    this.key.position.copy(at).addScaledVector(d, 180);
    this.key.target.updateMatrixWorld();
  }

  // the dead sun: a black disc with a violet corona round it, low in the north
  buildSun(dir) {
    const at = dir.clone().multiplyScalar(820);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.25)'), color: new THREE.Color(1.1, 0.35, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    corona.scale.setScalar(260);
    corona.position.copy(at);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    disc.position.copy(at).addScaledVector(dir, -2);
    disc.lookAt(0, 0, 0);
    this.sunGroup = new THREE.Group();
    this.sunGroup.add(corona, disc);
    this.scene.add(this.sunGroup);
  }

  // buttes of glass either side of the way north
  buildButtes() {
    if (!hasProp('cliff')) return;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, z = 150 - Math.floor(i / 2) * 52 + rnd() * 18;
      const c = prop('cliff');
      c.traverse((m) => { if (m.isMesh) { m.material = this.glass; m.castShadow = m.receiveShadow = true; } });
      c.position.set(side * (52 + rnd() * 40), -3 - rnd() * 4, z);
      c.rotation.y = rnd() * 6.28;
      c.scale.setScalar(2.2 + rnd() * 1.8);
      this.scene.add(c);
      this.smash.solid(c, { stuff: 'stone', mesh: true });
    }
  }

  // two pillars of glass by the way, archers on their tops: hexagonal, walked on (hull colliders)
  buildPerches() {
    this.perchTops = [];
    for (const at of PERCHES) {
      const geo = new THREE.CylinderGeometry(2.4, 3.4, PERCH_H, 6).translate(0, PERCH_H / 2, 0);
      const m = new THREE.Mesh(geo, this.glass);
      m.position.copy(at);
      m.rotation.y = rnd();
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.smash.solid(m, { stuff: 'stone', mesh: true });
      this.blocks.push({ x: at.x, z: at.z, r: 3.6, h: PERCH_H });
      this.perchTops.push(at.clone().setY(PERCH_H));
    }
  }

  // broken rock hanging in the air, turning slowly
  buildFloating() {
    if (!hasProp('rocks')) return;
    const names = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => new RegExp(`^Object_${n}$`));
    const list = [];
    for (let i = 0; i < 22; i++) {
      const o = piece('rocks', names[i % names.length], { root: true });
      o.traverse((m) => { if (m.isMesh) m.material = this.glass; });
      const a = rnd() * Math.PI * 2, r = 30 + rnd() * 160;
      o.position.set(Math.sin(a) * r, 18 + rnd() * 50, -60 + Math.cos(a) * r);
      o.scale.setScalar(1.5 + rnd() * 4);
      o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      o.userData.spin = (rnd() - 0.5) * 0.12;
      o.userData.y0 = o.position.y;
      this.scene.add(o);
      list.push(o);
    }
    this.updaters.push((dt, t) => { for (const [i, o] of list.entries()) { o.rotation.y += o.userData.spin * dt; o.position.y = o.userData.y0 + Math.sin(t * 0.3 + i) * 0.6; } });
  }

  // The Weaponers' forge: a floor of glass, a ring of obelisks (their pack's purple glyphs turned to
  // the yellow light), and the crucible in the middle with its column going up.
  buildForge() {
    const s = this.scene, F = FORGE;
    // (rougher than the plain: polished, the low key light laid a white sheet across it)
    // (a slab only a few centimetres proud of the plain, so feet on it are feet on the ground; drawn
    // over the plain by polygon offset)
    const forgeGlass = this.glass.clone();
    Object.assign(forgeGlass, { roughness: 0.55, onBeforeCompile: this.glass.onBeforeCompile, customProgramCacheKey: this.glass.customProgramCacheKey, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(FORGE_R, FORGE_R + 0.6, 0.04, 64), forgeGlass);
    floor.position.copy(F).setY(0.01);
    floor.receiveShadow = true;
    s.add(floor);
    let mats = null;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8, at = F.clone().add(V(Math.sin(a) * (FORGE_R + 3), 0, Math.cos(a) * (FORGE_R + 3)));
      const o = hasProp('obelisks') ? piece('obelisks', [/^Rock1/, /^Rock2/, /^Rock3/][i % 3], { root: true }) : new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.4).translate(0, 4, 0), this.glass);
      mats ??= new Map();
      o.traverse((m) => { if (m.isMesh) { m.material = mats.get(m.material) ?? mats.set(m.material, yellowStone(m.material)).get(m.material); m.castShadow = true; } });
      o.position.copy(at);
      o.rotation.y = a + Math.PI;
      o.scale.setScalar(2.2);
      s.add(o);
      this.physics.fixedBox({ x: at.x, y: 9, z: at.z }, { x: 1.8, y: 9, z: 1.8 });
      this.blocks.push({ x: at.x, z: at.z, r: 2.4, h: 18 });
    }
    // the crucible: a lathed bowl on three legs, the yellow light molten in it
    const iron = new THREE.MeshStandardMaterial({ color: 0x15110c, metalness: 0.85, roughness: 0.4 });
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.9], [1.2, 0.95], [2.6, 1.4], [3.3, 2.2], [3.5, 2.6], [3.25, 2.62], [3.0, 2.25]].map(([x, y]) => new THREE.Vector2(x, y)), 48), iron);
    bowl.position.copy(F).setY(0.6);
    bowl.castShadow = true;
    s.add(bowl);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 8), iron);
      leg.position.copy(F).add(V(Math.sin(a) * 2.0, 1.2, Math.cos(a) * 2.0));
      leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
      s.add(leg);
    }
    this.physics.fixedBox({ x: F.x, y: 1.9, z: F.z }, { x: 3.2, y: 1.3, z: 3.2 });
    this.blocks.push({ x: F.x, z: F.z, r: 4.2, h: 4 });
    const melt = new THREE.Mesh(new THREE.CircleGeometry(3.05, 48).rotateX(-Math.PI / 2), forgeMaterial(this.forgeU));
    melt.position.copy(F).setY(2.3);
    s.add(melt);
    // the column of it, up into the dark
    const colMat = new THREE.ShaderMaterial({
      uniforms: this.forgeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime, uHeat; varying vec2 vU;
        void main(){ float y = vU.y; float edge = pow(sin(vU.x * 3.14159 * 2.0 * 3.0 + uTime * 2.0) * 0.5 + 0.5, 6.0);
          float a = (0.35 + 0.65 * edge) * (1.0 - smoothstep(0.0, 1.0, y)) * smoothstep(0.0, 0.03, y) * uHeat;
          gl_FragColor = vec4(vec3(1.3, 0.85, 0.12) * a * 0.55, 1.0); }`,
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 160, 32, 1, true).translate(0, 80, 0), colMat);
    col.position.copy(F).setY(2.3);
    s.add(col);
    this.light = new THREE.PointLight(0xffb030, 50, 40, 1.8);
    this.light.position.copy(F).setY(6);
    s.add(this.light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)'), color: new THREE.Color(2.2, 1.4, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.copy(F).setY(3.2);
    glow.scale.setScalar(5.5);
    s.add(glow);
    this.updaters.push((dt, t) => { this.light.intensity = (46 + Math.sin(t * 7) * 4 + Math.sin(t * 2.3) * 6) * this.forgeU.uHeat.value; });
  }

  // ash coming down through the air round the camera
  buildAsh() {
    const n = 1600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 80; pos[i * 3 + 1] = rnd() * 40; pos[i * 3 + 2] = (rnd() - 0.5) * 80; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8a6a9a, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.ash = { pts, pos, n };
  }

  interact(def) {
    const it = { radius: 1.4, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  ground() { return 0; }

  airBounds() {
    return { ground: () => 0, floor: () => 0, canLand: (x, z) => Math.hypot(x, z + 60) < 420, center: V(0, 0, -60), radius: 440, ceiling: 150 };
  }

  update(dt, t, camera) {
    this.physics.step(dt);
    this.smash.update(dt, t, camera, this.engine.renderer);
    this.time.value = t;
    this.sky.position.copy(camera.position);
    this.sunGroup.position.copy(camera.position);
    const su = this.sky.userData.uniforms;
    su.uTime.value = t;
    // far-off violet lightning
    this.flash = Math.max(0, (this.flash ?? 0) - dt * 3);
    if (Math.random() < dt * 0.12) this.flash = 0.6 + Math.random() * 0.4;
    su.uFlash.value = this.flash * 0.5;
    su.uFlashTint.value.setRGB(0.6, 0.3, 0.9);
    // the ash, wrapped round the camera
    const { pos, n, pts } = this.ash, c = camera.position;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] -= dt * (0.4 + (i % 7) * 0.05);
      pos[i * 3] += Math.sin(t * 0.4 + i) * dt * 0.2;
      for (const [k, h] of [[0, 40], [1, 20], [2, 40]]) {
        const d = pos[i * 3 + k] - (k === 1 ? c.y : c.getComponent(k));
        if (d < -h) pos[i * 3 + k] += h * 2; else if (d > h) pos[i * 3 + k] -= h * 2;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() { this.physics.dispose(); }
}

// Black glass: dark and glossy, its veins lit gold and violet from inside. The veins are lines in
// world space (two warped noise fields), drawn a pixel wide at least and fading to their average far
// off (as the deck's and the stone's are: hard lines crawl).
function obsidian() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0c0a10, roughness: 0.24, metalness: 0.15 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vQw;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vQw = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vQw = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vQw;
        float qH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float qN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(qH(i), qH(i + vec3(1,0,0)), f.x), mix(qH(i + vec3(0,1,0)), qH(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(qH(i + vec3(0,0,1)), qH(i + vec3(1,0,1)), f.x), mix(qH(i + vec3(0,1,1)), qH(i + vec3(1,1,1)), f.x), f.y), f.z); }
        // one crack where the noise crosses its middle: a pixel wide at least, its average far off
        float qIso(float v, float w) { float fw = max(fwidth(v), 1e-4); float l = 1.0 - smoothstep(w - fw, w + fw, abs(v - 0.5)); return mix(l, 2.0 * w, smoothstep(0.04, 0.2, fw)); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 qp = vQw * 0.028;
        float qa = qN(qp + qN(qp * 2.3 + 4.0) * 0.9), qb = qN(qp * 2.7 + 9.0 + qN(qp * 4.1) * 0.7);
        float qGold = qIso(qa, 0.0014), qViol = qIso(qb, 0.0018) * 0.6;
        float qDepth = smoothstep(40.0, 0.0, vQw.y); // (dimmer high up the buttes)
        totalEmissiveRadiance += (vec3(1.0, 0.55, 0.08) * qGold * 0.8 + vec3(0.45, 0.12, 0.75) * qViol * 0.45) * qDepth;
        diffuseColor.rgb *= 0.8 + 0.4 * qN(vQw * 0.6);`);
  };
  m.customProgramCacheKey = () => 'qward-obsidian';
  return m;
}

// the obelisk pack's stone blackened, its purple glyphs turned to the yellow light
function yellowStone(src) {
  const m = src.clone();
  m.color.multiplyScalar(0.25);
  m.emissive?.setRGB(1.4, 1.0, 0.3);
  m.onBeforeCompile = (sh) => {
    const swap = (v) => `if (${v}.b > ${v}.r && ${v}.b > ${v}.g) ${v} = vec3(${v}.b, ${v}.b * 0.7, ${v}.r * 0.1);`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n${swap('diffuseColor.rgb')}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${swap('totalEmissiveRadiance')}`);
  };
  m.customProgramCacheKey = () => 'qward-yellow-stone';
  return m;
}

// the molten light in the crucible: slow swirls, white-hot at the middle
function forgeMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uHeat; varying vec3 vP;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){ vec2 p = vP.xz; float r = length(p) / 3.05; float a = atan(p.y, p.x);
        float sw = n(vec2(a * 2.0 + uTime * 0.4 + r * 3.0, r * 4.0 - uTime * 0.6)) * 0.6 + n(p * 2.5 + uTime * 0.3) * 0.4;
        vec3 c = mix(vec3(1.2, 0.5, 0.04), vec3(2.6, 2.0, 0.8), smoothstep(0.35, 0.9, sw) * (1.0 - r * 0.6));
        gl_FragColor = vec4(c * uHeat * (0.75 + 0.25 * (1.0 - r)), 1.0); }`,
  });
}
