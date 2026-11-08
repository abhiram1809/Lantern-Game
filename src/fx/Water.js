import * as THREE from 'three';
import { NOISE_GLSL } from './Sky.js';

// Night lake: procedural ripples, sky fresnel, moon glint and streaky reflections of nearby
// light sources (fires, the ring) passed in as uniforms.
export function createWater({ size = 400, sunDir, skyTop, skyHorizon }) {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir.clone() },
    uSkyTop: { value: skyTop.clone() },
    uSkyHorizon: { value: skyHorizon.clone() },
    uDeep: { value: new THREE.Color(0x020507) },
    uLights: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, -100, 0, 0)) },
    uLightColors: { value: Array.from({ length: 6 }, () => new THREE.Color()) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSunDir, uSkyTop, uSkyHorizon, uDeep;
      uniform vec4 uLights[6]; uniform vec3 uLightColors[6];
      varying vec3 vW;
      ${NOISE_GLSL}
      float height(vec2 p) {
        return vnoise(p * 0.9 + vec2(uTime * 0.25, uTime * 0.1)) * 0.5
             + vnoise(p * 2.3 - vec2(uTime * 0.35, -uTime * 0.2)) * 0.3
             + vnoise(p * 6.0 + vec2(-uTime * 0.6, uTime * 0.5)) * 0.2;
      }
      void main() {
        vec2 p = vW.xz;
        float e = 0.06, h0 = height(p);
        vec3 n = normalize(vec3(-(height(p + vec2(e, 0)) - h0) / e * 0.22, 1.0, -(height(p + vec2(0, e)) - h0) / e * 0.22));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 sky = mix(uSkyHorizon, uSkyTop, pow(max(R.y, 0.0), 0.5));
        float glint = pow(max(dot(R, uSunDir), 0.0), 280.0) * 2.2 + pow(max(dot(R, uSunDir), 0.0), 30.0) * 0.12;
        vec3 col = mix(uDeep, sky, fres) + vec3(0.8, 0.85, 1.0) * glint;
        for (int i = 0; i < 6; i++) {
          vec4 L = uLights[i];
          if (L.w <= 0.0) continue;
          vec3 toL = L.xyz - vW;
          float d = length(toL);
          float a = max(dot(R, toL / d), 0.0);
          col += uLightColors[i] * min(L.w, 2.0) * (pow(a, 90.0) * 0.8 + pow(a, 10.0) * 0.06) / (1.0 + d * d * 0.08);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
  mesh.userData.uniforms = uniforms;
  mesh.userData.setLight = (i, position, color, strength) => {
    uniforms.uLights.value[i].set(position.x, position.y, position.z, strength);
    uniforms.uLightColors.value[i].copy(color);
  };
  return mesh;
}
