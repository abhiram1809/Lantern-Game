import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const PRESETS = {
  storm: { top: 0x05070c, horizon: 0x1a2130, bottom: 0x040506, sun: 0x9fb4d8, sunDir: [0.4, 0.5, -0.8], sunSize: 0.0004, glow: 0.25, cloud: 0.75, cloudColor: 0x0b0e14, cloudLit: 0x35405a, stars: 0.0 },
  night: { top: 0x04070d, horizon: 0x1b2433, bottom: 0x05070a, sun: 0xdfe8ff, sunDir: [-0.25, 0.55, -0.8], sunSize: 0.0009, glow: 0.6, cloud: 0.58, cloudColor: 0x0c1018, cloudLit: 0x6d7a94, stars: 1.0 },
  sunset: { top: 0x3a5d8a, horizon: 0xffb070, bottom: 0x6b4a32, sun: 0xffd6a0, sunDir: [0.0, 0.08, -1], sunSize: 0.002, glow: 2.2, cloud: 0.35, cloudColor: 0xd08a6a, cloudLit: 0xffe0b0, stars: 0.0 },
};

export function createSky(preset = 'night', radius = 450) {
  const p = PRESETS[preset];
  const uniforms = {
    uTop: { value: new THREE.Color(p.top) }, uHorizon: { value: new THREE.Color(p.horizon) }, uBottom: { value: new THREE.Color(p.bottom) },
    uSunColor: { value: new THREE.Color(p.sun) }, uSunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
    uSunSize: { value: p.sunSize }, uGlow: { value: p.glow }, uCloud: { value: p.cloud },
    uCloudColor: { value: new THREE.Color(p.cloudColor) }, uCloudLit: { value: new THREE.Color(p.cloudLit) },
    uStars: { value: p.stars }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashTint: { value: new THREE.Color(0.55, 0.6, 0.8) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uSunColor, uSunDir, uCloudColor, uCloudLit, uFlashTint;
      uniform float uSunSize, uGlow, uCloud, uStars, uTime, uFlash;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.5)) : mix(uHorizon, uBottom, pow(-h, 0.35));
        if (uStars > 0.0 && h > 0.0) {
          vec2 sp = d.xz / (h + 0.25) * 260.0;
          float s = hash12(floor(sp));
          float tw = 0.6 + 0.4 * sin(uTime * 3.0 + s * 90.0);
          col += vec3(0.85, 0.9, 1.0) * step(0.9965, s) * tw * uStars * smoothstep(0.0, 0.25, h) * smoothstep(0.42, 0.1, length(fract(sp) - 0.5));
        }
        float sd = dot(d, uSunDir);
        col += uSunColor * (smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.5, sd) * 4.0 + pow(max(sd, 0.0), 18.0) * uGlow * 0.6 + pow(max(sd, 0.0), 4.0) * uGlow * 0.08);
        if (h > -0.03) {
          vec2 uv = d.xz / (h + 0.14) * 0.9 + vec2(uTime * 0.006, uTime * 0.0025);
          float n = fbm(uv * 1.3);
          float c = smoothstep(1.0 - uCloud - 0.12, 1.0 - uCloud + 0.38, n);
          float lit = pow(max(sd, 0.0), 5.0) * (1.0 - c * 0.5) + (n - 0.5) * 0.4;
          vec3 cc = mix(uCloudColor, uCloudLit, clamp(lit + uFlash * 1.5, 0.0, 1.5));
          col = mix(col, cc, c * smoothstep(-0.03, 0.12, h));
        }
        col += uFlash * uFlashTint * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.uniforms = uniforms;
  return mesh;
}
