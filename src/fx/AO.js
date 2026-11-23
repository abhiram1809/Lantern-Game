// Ambient occlusion from the depth buffer (the perf and looks pass, 2026-11-23): the dark that gathers where
// things meet (a kerb's foot, a doorway's reveal, under an awning, the folds of a figure), which the shadow map
// doesn't make and the sky's light (fx/SkyEnv.js) lights evenly. Worked out from the depth the scene's draw
// already left (Engine's ScenePass), with no second draw of the scene for normals: at half the resolution, each
// pixel's place and facing rebuilt from the depth around it, twelve samples in a spiral turned a different way at
// each pixel, how much of the hemisphere over it they find filled; then blurred within a 4x4 block without
// crossing an edge in depth, and laid over the picture as it's copied out, scaled up by the depth (so a figure's
// dark doesn't bleed onto the wall behind it). Nothing past 120 m (the haze has it), nothing on the sky.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// a view-space place from a depth (the camera's inverse projection)
const VIEW_GLSL = /* glsl */ `
  uniform mat4 uProjInv;
  vec3 viewAt(vec2 uv, float d) {
    vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return v.xyz / v.w;
  }`;

export class DepthAO {
  constructor() {
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.raw = rt(); // (r: how open, g: the view depth there)
    this.blurred = rt();
    this.uniforms = {
      tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uFocal: { value: 1 }, uSize: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: 0.9 }, uIntensity: { value: 1.5 },
    };
    this.ao = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDepth; uniform vec2 uSize; uniform float uFocal, uRadius, uIntensity;
        varying vec2 vUv;
        ${VIEW_GLSL}
        // the place at a depth texel's centre (a half-size pixel's centre is on the line between two of them: the
        // depth read from one and the place worked out between them, wrong by half a pixel, banded flat ground)
        vec3 at(vec2 uv) {
          uv = (floor(uv * uSize) + 0.5) / uSize;
          return viewAt(uv, texture2D(tDepth, uv).x);
        }
        void main() {
          vec2 c = (floor(vUv * uSize) + 0.5) / uSize;
          float d = texture2D(tDepth, c).x;
          if (d >= 0.99999) { gl_FragColor = vec4(1.0, 1e4, 0.0, 1.0); return; }
          vec3 P = viewAt(c, d);
          float z = -P.z;
          if (z > 120.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
          // its facing from the depth beside it, each way from the nearer side (across an edge the far side lies)
          vec2 t = 1.0 / uSize;
          vec3 R = at(c + vec2(t.x, 0.0)) - P, L = P - at(c - vec2(t.x, 0.0));
          vec3 U = at(c + vec2(0.0, t.y)) - P, D = P - at(c - vec2(0.0, t.y));
          vec3 N = normalize(cross(abs(R.z) < abs(L.z) ? R : L, abs(U.z) < abs(D.z) ? U : D));
          // the samples' reach on the screen, in pixels (a pixel or less: nothing to find)
          float rPx = uRadius * uFocal / z;
          if (rPx < 1.5) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
          rPx = min(rPx, 90.0);
          float turn = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); // (interleaved gradient noise)
          float shut = 0.0, r2 = uRadius * uRadius;
          for (int i = 0; i < 12; i++) {
            float k = (float(i) + 0.5) / 12.0, a = float(i) * 2.3999632 + turn;
            vec3 v = at(c + vec2(cos(a), sin(a)) * sqrt(k) * rPx * t) - P;
            float vv = dot(v, v);
            shut += max(0.0, dot(N, v) * inversesqrt(vv + 1e-4) - 0.08) * max(0.0, 1.0 - vv / r2);
          }
          float ao = clamp(1.0 - shut / 12.0 * uIntensity * 1.6, 0.0, 1.0);
          ao = mix(ao, 1.0, smoothstep(70.0, 120.0, z));
          gl_FragColor = vec4(ao, z, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    }));
    this.blurU = { tAO: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) } };
    this.blur = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.blurU,
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tAO; uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec2 c = texture2D(tAO, vUv).rg;
          float sum = 0.0, w = 0.0;
          // (whole texels, its own among them: between texels, all sixteen could miss its depth, every weight
          // nothing, and the sky's edge came out black)
          for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
            vec2 s = texture2D(tAO, vUv + vec2(x, y) * uTexel).rg;
            float k = exp(-abs(s.g - c.g) / max(c.g, 0.1) * 40.0); // (not across an edge in depth)
            sum += s.r * k; w += k;
          }
          gl_FragColor = vec4(w > 1e-3 ? sum / w : c.r, c.g, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    }));
  }

  setSize(w, h) {
    const hw = Math.max(1, Math.floor(w / 2)), hh = Math.max(1, Math.floor(h / 2));
    this.raw.setSize(hw, hh);
    this.blurred.setSize(hw, hh);
    this.uniforms.uSize.value.set(w, h);
    this.blurU.uTexel.value.set(1 / hw, 1 / hh);
  }

  render(renderer, depth, camera) {
    const u = this.uniforms;
    u.tDepth.value = depth;
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uFocal.value = (u.uSize.value.y / (2 * Math.tan(THREE.MathUtils.DEG2RAD * camera.fov / 2))) * camera.zoom; // (in the full-size pixels of the depth it samples)
    renderer.setRenderTarget(this.raw);
    this.ao.render(renderer);
    this.blurU.tAO.value = this.raw.texture;
    renderer.setRenderTarget(this.blurred);
    this.blur.render(renderer);
    return this.blurred.texture;
  }

  dispose() { this.raw.dispose(); this.blurred.dispose(); this.ao.dispose(); this.blur.dispose(); }
}

// laid over the picture as it's copied out (Engine's ScenePass): scaled up from the half size by the depth (each
// of the four half-size pixels round it weighed by how near its depth is to this one's), and spared where the
// picture's brighter than white (a lamp, a lit window, the neon: lights aren't in the dark)
export const AO_APPLY_GLSL = /* glsl */ `
  uniform sampler2D tAO, tDepth; uniform vec2 uAOTexel; uniform float uAO; uniform mat4 uProjInvA;
  float viewZ(float d) { vec4 v = uProjInvA * vec4(0.0, 0.0, d * 2.0 - 1.0, 1.0); return -v.z / v.w; }
  float aoAt(vec2 uv, vec3 col) {
    float z = viewZ(texture2D(tDepth, uv).x);
    vec2 p = uv / uAOTexel - 0.5, f = fract(p), b = (floor(p) + 0.5) * uAOTexel;
    float sum = 0.0, w = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = vec2(float(i - (i / 2) * 2), float(i / 2));
      vec2 s = texture2D(tAO, b + o * uAOTexel).rg;
      float k = (o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y) * exp(-abs(s.g - z) / max(z, 0.1) * 30.0) + 1e-4;
      sum += s.r * k; w += k;
    }
    float ao = sum / w, lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    return mix(1.0, ao, uAO * (1.0 - smoothstep(0.9, 2.5, lum)));
  }`;
