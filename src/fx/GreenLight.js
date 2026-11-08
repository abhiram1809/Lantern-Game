import * as THREE from 'three';
import { Particles } from './Particles.js';
import { glowTexture } from './Textures.js';

const GREEN = new THREE.Color(0.35, 1, 0.55);

// The ring's light: a hot core, halo sprites, slowly turning rays and orbiting sparks.
export class GreenOrb {
  constructor({ scale = 1, lightIntensity = 30, lightRange = 12 } = {}) {
    this.group = new THREE.Group();
    this.intensity = 0;
    this.scale = scale;
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.45)');
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 8, 4) }));
    this.group.add(this.core);
    this.halos = [[0.8, 1.6, 1], [1.8, 0.6, 0.35], [3.6, 0.35, 0.12]].map(([s, gain, opacity]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: GREEN.clone().multiplyScalar(gain), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      sp.scale.setScalar(s * scale);
      sp.userData.base = s * scale;
      sp.userData.opacity = opacity;
      this.group.add(sp);
      return sp;
    });
    this.rays = new THREE.Group();
    const rayMat = new THREE.MeshBasicMaterial({ map: rayTexture(), color: GREEN.clone().multiplyScalar(1.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
    for (let i = 0; i < 7; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.08 * scale, 2.6 * scale), rayMat);
      ray.rotation.z = (i / 7) * Math.PI;
      ray.rotation.y = i * 0.7;
      this.rays.add(ray);
    }
    this.rayMat = rayMat;
    this.group.add(this.rays);
    this.sparks = new Particles(260, { additive: true, drag: 1.2, turbulence: 2 });
    this.light = new THREE.PointLight(0x55ff88, 0, lightRange, 2);
    this.lightIntensity = lightIntensity;
    this.group.add(this.light);
    this.acc = 0;
  }

  addTo(scene) {
    scene.add(this.group);
    scene.add(this.sparks.points);
  }

  update(dt, t, camera, renderer) {
    const k = this.intensity, s = this.scale;
    const pulse = 1 + Math.sin(t * 6) * 0.06 + Math.sin(t * 17) * 0.03;
    this.core.scale.setScalar(Math.max(0.001, k) * pulse);
    this.halos.forEach((h) => {
      h.material.opacity = Math.min(1, k) * h.userData.opacity;
      h.scale.setScalar(h.userData.base * pulse * (0.6 + 0.4 * k));
    });
    this.rayMat.opacity = Math.min(1, k) * 0.3;
    this.rays.rotation.y = t * 0.35;
    this.rays.rotation.x = Math.sin(t * 0.3) * 0.4;
    this.light.intensity = this.lightIntensity * k * pulse;
    this.acc += dt * 90 * k;
    const n = Math.floor(this.acc);
    this.acc -= n;
    if (n > 0) {
      const c = this.group.getWorldPosition(_p);
      this.sparks.emit(n, (p, v) => {
        const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * 2, r = (0.25 + Math.random() * 0.5) * s;
        p[0] = c.x + Math.cos(a) * r; p[1] = c.y + e * r * 0.6; p[2] = c.z + Math.sin(a) * r;
        v[0] = -Math.sin(a) * 1.4 * s; v[1] = (Math.random() - 0.3) * 0.6 * s; v[2] = Math.cos(a) * 1.4 * s;
      }, { life: 1.3, size: [0.05 * s, 0.0], color: [[0.8, 3.5, 1.4, 1], [0.2, 1.5, 0.5, 0]] });
    }
    this.sparks.update(dt, t, camera, renderer);
  }
}
const _p = new THREE.Vector3();

function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 256);
  const h = g.createLinearGradient(0, 0, 32, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = h;
  g.fillRect(0, 0, 32, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fresnel energy sphere that carries Hal.
export function createBubble(radius = 1.2) {
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vP = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float bands = 0.5 + 0.5 * sin(vP.y * 22.0 - uTime * 4.0 + sin(vP.x * 9.0 + uTime) * 2.0);
        vec3 col = vec3(0.3, 1.5, 0.7) * (f * 0.9 + bands * 0.15 * f + 0.025);
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// Additive, soft-edged light shaft (fake volumetrics) between two points.
export function createShaft({ from, to, radiusFrom = 0.6, radiusTo = 1.6, color = new THREE.Color(0.35, 1, 0.55) }) {
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(radiusTo, radiusFrom, len, 32, 1, true);
  geo.translate(0, -len / 2, 0);
  const uniforms = { uColor: { value: color }, uOpacity: { value: 0 }, uTime: { value: 0 }, uLen: { value: len } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vT; varying vec3 vN; varying vec3 vV; varying float vA;
      uniform float uLen;
      void main() {
        vT = -position.y / uLen;
        vA = atan(position.x, position.z);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity, uTime;
      varying float vT; varying vec3 vN; varying vec3 vV; varying float vA;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float streak = 0.6 + 0.4 * sin(vA * 13.0 + uTime * 0.7) * sin(vA * 7.0 - uTime * 0.4);
        float fall = (1.0 - vT) * smoothstep(0.0, 0.08, vT);
        gl_FragColor = vec4(uColor * edge * streak * fall * uOpacity, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  mesh.userData.uniforms = uniforms;
  return mesh;
}
