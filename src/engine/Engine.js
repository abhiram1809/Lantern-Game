import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Final grade, applied in linear HDR before tone mapping: dream look, aberration, vignette,
// grain and a full-screen colour flash.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDream: { value: 0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.025 },
    uAberration: { value: 0.0015 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0.55, 1.6, 0.75) },
    uFocus: { value: 0 },
    uHurt: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDream, uVignette, uGrain, uAberration, uFlash, uFocus, uHurt;
    uniform vec3 uTint, uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      uv += uDream * 0.0045 * vec2(sin(uv.y * 18.0 + uTime * 1.7), cos(uv.x * 15.0 + uTime * 1.3));
      float ab = (uAberration + uDream * 0.008) * dot(c, c) * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, uv + c * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ab).b);
      // Dream: soft bloom-ish lift, warm sepia, crushed edges.
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 sepia = vec3(l * 1.15, l * 0.93, l * 0.7) + vec3(0.025, 0.018, 0.0);
      col = mix(col, sepia, uDream * 0.78);
      col *= uTint;
      // Construct focus (time stopped): drained colour pushed toward the ring's green.
      col = mix(col, vec3(l * 0.55, l * 1.05, l * 0.7), uFocus * 0.72);
      float v = smoothstep(0.9, 0.18, length(c) * (1.0 + uDream * 0.45 + uFocus * 0.35));
      col *= mix(1.0, v, clamp(uVignette + uDream * 0.5 + uFocus * 0.4, 0.0, 1.0));
      // Damage: red pulled in from the screen edges.
      col = mix(col, vec3(0.5, 0.02, 0.01), uHurt * smoothstep(0.25, 0.75, length(c)) * 0.85);
      col += (hash(uv * 911.0 + fract(uTime)) - 0.5) * (uGrain + uDream * 0.07) * (0.35 + l);
      col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Engine {
  constructor(container) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.03, 900);
    this.scene = new THREE.Scene();

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.55, 1.0);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    // Any NaN pixel would be smeared into black blocks by the bloom blur, so zero them first.
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(60.0)), c.a); }',
    }));
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.time = 0;
    this.timeScale = 1; // 0 stops game time (construct wheel) while rendering carries on

    window.addEventListener('resize', () => this.resize());
  }

  get gradeUniforms() { return this.grade.uniforms; }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
    if (!scene.environment) {
      scene.environment = this.envMap;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  start(update) {
    this.update = update;
    this.renderer.setAnimationLoop((timestamp) => {
      this.timer.update(timestamp);
      // the timer can report a negative delta when its clock and the frame timestamps disagree
      // (around visibility changes); a negative step poisons damping and flight maths with NaN
      const dt = Math.max(0, Math.min(this.timer.getDelta(), 1 / 20));
      if (this.paused) this.composer.render(0); // keep drawing the frozen frame under the menu
      else this.frame(dt);
    });
  }

  frame(dt, render = true) {
    const real = dt;
    dt *= this.timeScale;
    this.time += dt;
    this.grade.uniforms.uTime.value = this.time + (this.timeScale < 1 ? performance.now() / 1000 : 0);
    this.update(dt, this.time, real);
    if (render) this.composer.render(dt);
  }

  // Debug: advance the game by `seconds` in fixed steps (independent of the browser's frame rate),
  // letting awaiting story code run between frames.
  async advance(seconds, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) {
      this.frame(dt, t + dt >= seconds);
      for (let k = 0; k < 12; k++) await null;
    }
  }
}
