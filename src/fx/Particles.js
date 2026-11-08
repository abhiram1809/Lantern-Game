import * as THREE from 'three';

// CPU-simulated point sprites. Each particle carries position, velocity, life, size and colour;
// behaviour comes from the spawn callback and a per-system `drag`, `gravity`, `turbulence`.
export class Particles {
  constructor(count, { additive = true, soft = 0.0, puffy = false, gravity = 0, drag = 0, turbulence = 0, wind = new THREE.Vector3() } = {}) {
    this.count = count;
    this.gravity = gravity; this.drag = drag; this.turbulence = turbulence; this.wind = wind;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count).fill(1);
    this.size0 = new Float32Array(count);
    this.size1 = new Float32Array(count);
    this.col0 = new Float32Array(count * 4);
    this.col1 = new Float32Array(count * 4);
    this.seed = Float32Array.from({ length: count }, () => Math.random() * 100);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aColor', this.aColor);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.uniforms = { uScale: { value: 600 }, uSoft: { value: soft }, uPuffy: { value: puffy ? 1 : 0 }, uTime: { value: 0 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSize; attribute vec4 aColor; attribute float aSeed;
        uniform float uScale;
        varying vec4 vColor; varying float vSeed;
        void main() {
          vColor = aColor; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aColor.a <= 0.0 ? 0.0 : aSize * uScale / max(0.05, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uSoft, uPuffy, uTime;
        varying vec4 vColor; varying float vSeed;
        float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float a = 1.0 - smoothstep(uSoft, 1.0, d);
          a *= a;
          if (uPuffy > 0.5) a *= 0.45 + 0.75 * n(c * 4.0 + vSeed + uTime * 0.05) * n(c * 9.0 - vSeed);
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        }
      `,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  // init(i, pos, vel) fills position/velocity; options set lifetime, size and colour ramps.
  emit(n, init, { life = 1, lifeJitter = 0.3, size = [0.1, 0.1], color = [[1, 1, 1, 1], [1, 1, 1, 0]] } = {}) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      const p = this.pos.subarray(i * 3, i * 3 + 3), v = this.vel.subarray(i * 3, i * 3 + 3);
      init(p, v, i);
      this.maxLife[i] = life * (1 - lifeJitter * 0.5 + Math.random() * lifeJitter);
      this.life[i] = this.maxLife[i];
      this.size0[i] = size[0] * (0.7 + Math.random() * 0.6);
      this.size1[i] = size[1] * (0.7 + Math.random() * 0.6);
      this.col0.set(color[0], i * 4);
      this.col1.set(color[1], i * 4);
    }
  }

  update(dt, t, camera, renderer) {
    if (camera) {
      const h = renderer.getDrawingBufferSize(_size).y;
      this.uniforms.uScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    }
    this.uniforms.uTime.value = t;
    const P = this.aPos.array, S = this.aSize.array, C = this.aColor.array;
    const dragK = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { C[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const j = i * 3;
      if (this.turbulence) {
        const s = this.seed[i];
        this.vel[j] += Math.sin(t * 2.1 + s) * this.turbulence * dt;
        this.vel[j + 2] += Math.cos(t * 1.7 + s * 1.3) * this.turbulence * dt;
      }
      this.vel[j] = (this.vel[j] + this.wind.x * dt) * dragK;
      this.vel[j + 1] = (this.vel[j + 1] + (this.gravity + this.wind.y) * dt) * dragK;
      this.vel[j + 2] = (this.vel[j + 2] + this.wind.z * dt) * dragK;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      P[j] = this.pos[j]; P[j + 1] = this.pos[j + 1]; P[j + 2] = this.pos[j + 2];
      S[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k;
      const fadeIn = Math.min(1, (this.maxLife[i] - this.life[i]) / 0.12);
      for (let c = 0; c < 4; c++) C[i * 4 + c] = this.col0[i * 4 + c] + (this.col1[i * 4 + c] - this.col0[i * 4 + c]) * k;
      C[i * 4 + 3] *= fadeIn;
      if (this.life[i] <= 0) C[i * 4 + 3] = 0;
    }
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aColor.needsUpdate = true;
  }
}
const _size = new THREE.Vector2();

// Convenience emitters ------------------------------------------------------------------------
const rnd = (a, b) => a + Math.random() * (b - a);

export class Fire {
  constructor(position, { radius = 0.4, rate = 70, height = 1, smoke = true, embers = true } = {}) {
    this.position = position.clone();
    Object.assign(this, { radius, rate, height });
    this.group = new THREE.Group();
    this.flames = new Particles(Math.ceil(rate * 1.3), { additive: true, soft: 0.05, turbulence: 1.2 });
    this.group.add(this.flames.points);
    if (smoke) {
      this.smoke = new Particles(140, { additive: false, soft: 0.1, puffy: true, drag: 0.25, wind: new THREE.Vector3(0.35, 0.25, 0.1), turbulence: 0.3 });
      this.group.add(this.smoke.points);
    }
    if (embers) {
      this.embers = new Particles(160, { additive: true, soft: 0.0, gravity: -0.3, drag: 0.4, turbulence: 2.2, wind: new THREE.Vector3(0.4, 0, 0.1) });
      this.group.add(this.embers.points);
    }
    this.light = new THREE.PointLight(0xff7a2a, 8 * height, 9, 2);
    this.light.position.copy(position).y += 0.5 * height;
    this.group.add(this.light);
    this.acc = 0;
    this.intensity = 1;
  }

  update(dt, t, camera, renderer) {
    this.acc += dt * this.rate * this.intensity;
    const n = Math.floor(this.acc);
    this.acc -= n;
    const p0 = this.position, r = this.radius, hgt = this.height;
    if (n > 0) {
      this.flames.emit(n, (p, v) => {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
        p[0] = p0.x + Math.cos(a) * d; p[1] = p0.y + rnd(0, 0.1); p[2] = p0.z + Math.sin(a) * d;
        v[0] = -Math.cos(a) * d * 0.6; v[1] = rnd(0.9, 1.9) * hgt; v[2] = -Math.sin(a) * d * 0.6;
      }, { life: 0.75 * Math.sqrt(hgt), size: [0.34 * hgt, 0.06], color: [[2.0, 0.95, 0.28, 0.85], [1.0, 0.14, 0.02, 0.0]] });
    }
    if (this.smoke && Math.random() < dt * 9 * this.intensity) {
      this.smoke.emit(1, (p, v) => {
        p[0] = p0.x + rnd(-r, r) * 0.5; p[1] = p0.y + 0.6 * hgt; p[2] = p0.z + rnd(-r, r) * 0.5;
        v[0] = rnd(-0.1, 0.1); v[1] = rnd(0.5, 0.9); v[2] = rnd(-0.1, 0.1);
      }, { life: 7, size: [0.5 * hgt, 3.2 * hgt], color: [[0.06, 0.06, 0.065, 0.5], [0.12, 0.12, 0.13, 0.0]] });
    }
    if (this.embers && Math.random() < dt * 22 * this.intensity) {
      this.embers.emit(1, (p, v) => {
        p[0] = p0.x + rnd(-r, r); p[1] = p0.y + rnd(0.1, 0.5); p[2] = p0.z + rnd(-r, r);
        v[0] = rnd(-0.6, 0.6); v[1] = rnd(1.2, 3.2); v[2] = rnd(-0.6, 0.6);
      }, { life: 3, size: [0.035, 0.012], color: [[4, 1.6, 0.4, 1], [2, 0.4, 0.05, 0]] });
    }
    this.light.intensity = (4 + Math.sin(t * 13) * 0.8 + Math.sin(t * 31) * 0.5 + Math.random() * 0.8) * hgt * this.intensity;
    this.flames.update(dt, t, camera, renderer);
    this.smoke?.update(dt, t, camera, renderer);
    this.embers?.update(dt, t, camera, renderer);
  }
}
