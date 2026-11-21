import * as THREE from 'three';
import { NOISE_GLSL } from './Sky.js';
import { Particles } from './Particles.js';

// The ring's pocket dimension: a tear in the air that opens onto a green-lit void, where a Lantern
// keeps the power battery between charges. A camera-facing disc: the space inside as a slow dark
// swirl with motes of light, a ragged white-green rim, and a halo; motes stream in (or out).
// `open` (0..1) sizes it; `flow` > 0 pulls motes in, < 0 throws them out. `palette` picks its
// colours: 'pocket' (the ring's own green), or 'antimatter' (the way into Qward: a violet-black void,
// pale arms and a white rim, Part Six).
const PALETTES = {
  pocket: { stars: 60, sharp: 900, void: [0.0, 0.02, 0.012], arm: [0.05, 0.55, 0.24], core: [0.7, 1.6, 1.0], star: [0.8, 1.4, 1.0], band: [0.6, 2.4, 1.2], halo: [0.12, 0.8, 0.35], light: 0x55ff8a, mote: [[0.6, 3.2, 1.4, 1], [0.15, 1.2, 0.45, 0]] },
  antimatter: { stars: 150, sharp: 4000, void: [0.01, 0.0, 0.026], arm: [0.24, 0.15, 0.44], core: [0.55, 0.45, 1.0], star: [1.3, 1.2, 1.7], band: [0.8, 0.62, 1.2], halo: [0.22, 0.12, 0.46], light: 0xb08cff, mote: [[1.6, 1.4, 2.6, 1], [0.4, 0.2, 0.9, 0]] },
  // the Zamarons' way (Part Seven): a rose-violet void, warm arms, a pink-white rim
  love: { stars: 90, sharp: 2200, void: [0.03, 0.0, 0.03], arm: [0.5, 0.08, 0.38], core: [1.3, 0.55, 1.2], star: [1.5, 1.1, 1.5], band: [1.5, 0.45, 1.25], halo: [0.42, 0.08, 0.34], light: 0xd46bff, mote: [[2.4, 0.8, 2.2, 1], [0.7, 0.1, 0.55, 0]] },
};
export class Rift {
  constructor(radius = 0.5, { palette = 'pocket' } = {}) {
    this.radius = radius;
    this.open = 0;
    this.flow = 1;
    this.group = new THREE.Group();
    const P = (this.palette = PALETTES[palette]), c3 = (a) => new THREE.Vector3(...a);
    this.u = { uTime: { value: 0 }, uOpen: { value: 0 }, uVoid: { value: c3(P.void) }, uArm: { value: c3(P.arm) }, uCore: { value: c3(P.core) }, uStar: { value: c3(P.star) }, uBand: { value: c3(P.band) }, uHalo: { value: c3(P.halo) }, uStars: { value: P.stars }, uSharp: { value: P.sharp } };
    const vert = 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    // the void: darker than its surroundings, so it reads as a hole rather than a glow
    const inside = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false,
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpen, uStars; uniform vec3 uVoid, uArm, uCore, uStar; varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float r = length(vUv), a = atan(vUv.y, vUv.x);
          float edge = uOpen * (0.92 + 0.08 * vnoise(vec2(a * 2.6, uTime * 1.3)) + 0.05 * sin(a * 7.0 + uTime * 3.0));
          if (r > edge) discard;
          float k = r / max(edge, 1e-3);
          // arms of light winding in toward the centre
          float sw = a + k * 5.5 - uTime * 1.6;
          vec2 q = vec2(cos(sw), sin(sw)) * (0.6 + k * 2.0);
          float arms = smoothstep(0.45, 0.85, fbm(q * 1.7 + uTime * 0.2));
          // (round specks in a grid of cells, uStars across, so a big rift's stars aren't squares)
          vec2 sg = vUv * uStars + vec2(uTime * 2.0, 0.0);
          float stars = step(0.985, hash12(floor(sg))) * smoothstep(0.42, 0.1, length(fract(sg) - 0.5)) * (1.0 - k);
          vec3 col = uVoid + uArm * arms * (1.0 - k * 0.6) * 0.8;
          col += uCore * pow(1.0 - k, 6.0) * 0.6 + uStar * stars;
          gl_FragColor = vec4(col, smoothstep(1.0, 0.86, k) * 0.96);
        }`,
    });
    // the rim and halo, added on top
    const rim = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: vert,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpen, uSharp; uniform vec3 uBand, uHalo; varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float r = length(vUv) / 0.5, a = atan(vUv.y, vUv.x);
          float edge = uOpen * (0.92 + 0.08 * vnoise(vec2(a * 2.6, uTime * 1.3)) + 0.05 * sin(a * 7.0 + uTime * 3.0));
          float d = r - edge;
          float flick = 0.7 + 0.3 * vnoise(vec2(a * 9.0, uTime * 6.0));
          float band = exp(-d * d * uSharp) * flick;
          // a soft glow just outside the rim and a little light spilling inside it
          float halo = (step(0.0, d) * exp(-d * 6.0) * 0.35 + step(d, 0.0) * exp(d * 14.0) * 0.25) * smoothstep(2.0, 1.3, r);
          vec3 col = uBand * band + uHalo * halo;
          gl_FragColor = vec4(col * smoothstep(0.0, 0.15, uOpen), 1.0);
        }`,
    });
    this.inside = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), inside);
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(radius * 4, radius * 4), rim);
    this.inside.renderOrder = 5;
    this.halo.renderOrder = 6;
    this.group.add(this.inside, this.halo);
    this.light = new THREE.PointLight(P.light, 0, 5 * Math.max(1, radius / 0.5), 2);
    this.group.add(this.light);
    this.motes = new Particles(260, { additive: true, drag: 0.4 });
    this.motes.points.renderOrder = 7;
    this.acc = 0;
    this.group.visible = false;
  }

  addTo(scene) { scene.add(this.group, this.motes.points); return this; }

  update(dt, t, camera, renderer) {
    this.u.uTime.value = t;
    this.u.uOpen.value = this.open;
    this.group.visible = this.open > 0.002;
    this.group.quaternion.copy(camera.quaternion);
    this.light.intensity = this.open * 3;
    // motes spiral in along the disc's plane (or burst out of it)
    this.acc += dt * 90 * this.open;
    const n = Math.floor(this.acc);
    this.acc -= n;
    if (n > 0) {
      const c = this.group.position, R = this.radius * this.open;
      const right = _r.set(1, 0, 0).applyQuaternion(camera.quaternion), up = _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      this.motes.emit(n, (p, v) => {
        const a = Math.random() * Math.PI * 2, out = this.flow > 0 ? 1.5 + Math.random() * 0.9 : 0.3 * Math.random();
        const x = Math.cos(a), y = Math.sin(a);
        p[0] = c.x + (right.x * x + up.x * y) * R * out; p[1] = c.y + (right.y * x + up.y * y) * R * out; p[2] = c.z + (right.z * x + up.z * y) * R * out;
        // inward with a swirl, or outward
        const s = this.flow > 0 ? -1.6 : 2.2, sw = 1.1;
        v[0] = (right.x * (x * s - y * sw) + up.x * (y * s + x * sw)) * R * 1.6;
        v[1] = (right.y * (x * s - y * sw) + up.y * (y * s + x * sw)) * R * 1.6;
        v[2] = (right.z * (x * s - y * sw) + up.z * (y * s + x * sw)) * R * 1.6;
      }, { life: 0.7, size: [0.035 * Math.max(1, this.radius / 0.5) ** 0.5, 0.0], color: this.palette.mote });
    }
    this.motes.update(dt, t, camera, renderer);
  }

  dispose() {
    this.group.removeFromParent();
    this.motes.points.removeFromParent();
    for (const m of [this.inside, this.halo]) { m.geometry.dispose(); m.material.dispose(); }
  }
}
const _r = new THREE.Vector3(), _u = new THREE.Vector3();
