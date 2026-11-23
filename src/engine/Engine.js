import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SkyEnv } from '../fx/SkyEnv.js';
import { DepthAO, AO_APPLY_GLSL } from '../fx/AO.js';

// The world's matrices brought up to date before a frame, only where something can be drawn (the perf pass,
// 2026-11-23): three.js walks every object in the scene each frame, hidden or not, and Coast City's has 27,000,
// most of them in what's hidden (the people not out, a scene's unused rigs and models): 3.3 ms of a 7 ms frame
// in Hal's street, 0.6 this way. A hidden object passed over while its parent moved is marked to be worked out
// when it's next seen (its own and its children's matrices then follow); anything that reads a hidden object's
// place between frames calls `updateWorldMatrix` first (getWorldPosition does), as it had to anyway. (What has
// its own update, a camera's inverse or a skinned mesh's bind matrix, does it its own way, all of it.)
const OWN = THREE.Object3D.prototype.updateMatrixWorld;
function updateDrawn(o, force) {
  if (o.updateMatrixWorld !== OWN) return o.updateMatrixWorld(force);
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.matrixWorldNeedsUpdate || force) {
    if (o.matrixWorldAutoUpdate) {
      if (o.parent === null) o.matrixWorld.copy(o.matrix);
      else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
    }
    o.matrixWorldNeedsUpdate = false;
    force = true;
  }
  const ch = o.children;
  for (let i = 0, l = ch.length; i < l; i++) {
    const c = ch[i];
    if (c.visible) updateDrawn(c, force);
    else if (force) c.matrixWorldNeedsUpdate = true;
  }
}

// The scene drawn into a multisampled target of its own and copied out into the composer's, with any NaN pixel
// zeroed on the way (the bloom's blur would smear one into black blocks). (The perf pass, 2026-11-23: both the
// composer's targets were 4x multisampled, so the NaN guard, the grade and the output each drew four samples a
// pixel and resolved them again: 4.5 ms of a 9.4 ms frame on the GPU. The post passes are full-screen and need
// none.) The occlusion boxes (engine/Occlusion.js) are asked about in the same render, after the opaque things.
// `samples` from `localStorage.gl_msaa` when set (0, 2, 4): the foliage's alpha-to-coverage needs some. The
// ambient occlusion (fx/AO.js) comes from the depth it leaves, laid on in the copy: `scene.userData.ao` its
// strength (0.55 unless a scene says, 0 or false for none; `gl_ao = '0'` turns it off everywhere).
class ScenePass extends Pass {
  constructor(scene, camera, samples) {
    super();
    Object.assign(this, { scene, camera, needsSwap: true });
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    this.target.depthTexture = new THREE.DepthTexture(1, 1); // (resolved with the colour: three blits both)
    this.ao = new DepthAO();
    this.aoOff = globalThis.localStorage?.gl_ao === '0';
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, tDepth: { value: null }, uAOTexel: { value: new THREE.Vector2(1, 1) }, uAO: { value: 0 }, uProjInvA: { value: new THREE.Matrix4() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        ${AO_APPLY_GLSL}
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
          if (uAO > 0.0) c.rgb *= aoAt(vUv, c.rgb);
          gl_FragColor = vec4(min(c.rgb, vec3(60.0)), c.a);
        }`,
      depthTest: false,
      depthWrite: false,
    }));
  }
  setSize(w, h) { this.target.setSize(w, h); this.ao.setSize(w, h); }
  render(renderer, writeBuffer) {
    this.scene.userData.occlusion?.ask(this.camera);
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    const u = this.copy.material.uniforms, k = this.aoOff ? 0 : Number(this.scene.userData.ao ?? 0.55) || 0;
    u.tDiffuse.value = this.target.texture;
    u.uAO.value = k;
    if (k > 0) {
      u.tAO.value = this.ao.render(renderer, this.target.depthTexture, this.camera);
      u.tDepth.value = this.target.depthTexture;
      u.uAOTexel.value.set(1 / this.ao.raw.width, 1 / this.ao.raw.height);
      u.uProjInvA.value.copy(this.camera.projectionMatrixInverse);
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.render(renderer);
  }
  dispose() { this.target.dispose(); this.ao.dispose(); this.copy.dispose(); }
}

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
    uChoke: { value: 0 },
    uSat: { value: 1 }, // (a scene's own grade: `scene.userData.grade`, { sat, contrast })
    uContrast: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uDream, uVignette, uGrain, uAberration, uFlash, uFocus, uHurt, uChoke, uSat, uContrast;
    uniform vec3 uTint, uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      uv += uDream * 0.0045 * vec2(sin(uv.y * 18.0 + uTime * 1.7), cos(uv.x * 15.0 + uTime * 1.3));
      uv += uChoke * 0.005 * vec2(sin(uv.y * 7.0 + uTime * 2.3), cos(uv.x * 6.0 + uTime * 1.9)); // (swimming)
      float ab = (uAberration + uDream * 0.008) * dot(c, c) * 4.0;
      vec3 col = vec3(texture2D(tDiffuse, uv + c * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ab).b);
      // the scene's grade: contrast about mid grey (in stops), saturation about the grey of the same brightness
      col = pow(max(col, 0.0) / 0.18, vec3(uContrast)) * 0.18;
      col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat), 0.0);
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
      // Choking (no air out of the suit): the colour drained cold, the edges closing in to a tunnel
      col = mix(col, vec3(l * 0.78, l * 0.84, l * 0.95), uChoke * 0.85);
      col *= mix(1.0, smoothstep(0.78 - uChoke * 0.5, 0.06, length(c)), clamp(uChoke * 1.2, 0.0, 1.0));
      col += (hash(uv * 911.0 + fract(uTime)) - 0.5) * (uGrain + uDream * 0.07) * (0.35 + l);
      col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Engine {
  constructor(container) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' }));
    // the resolution adapts to the frame rate (`adapt`); `gl_res` in localStorage fixes it
    this.maxRatio = Math.min(window.devicePixelRatio, 1.5);
    this.fixedRatio = Number(globalThis.localStorage?.gl_res) || 0;
    this.ratio = this.fixedRatio || this.maxRatio;
    this.frameAvg = 1 / 60;
    this.slowT = this.fastT = 0;
    renderer.setPixelRatio(this.ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // every light's shadow camera sees layer 1 too: the shadow-only stand-ins (characters' simplified twins, the palms'
    // and cars' shadow copies: characters/Rig.js, city/Palms.js, city/Lod.js), which the camera itself never draws
    const shadows = renderer.shadowMap.render.bind(renderer.shadowMap);
    renderer.shadowMap.render = (lights, ...rest) => { for (const l of lights) l.shadow?.camera.layers.enable(1); return shadows(lights, ...rest); };
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.03, 900);
    this.scene = new THREE.Scene();

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    const msaa = Number(localStorage.gl_msaa);
    this.renderPass = new ScenePass(this.scene, this.camera, [0, 2, 4].includes(msaa) ? msaa : 4);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.68, 0.62, 1.0); // (strength, radius, threshold: only what's brighter than white blooms)
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass); // (the NaN guard in its copy out: ScenePass)
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    const render = this.composer.render.bind(this.composer);
    this.composer.render = (dt) => {
      const sc = this.scene, auto = sc.matrixWorldAutoUpdate;
      if (auto) updateDrawn(sc, false);
      sc.matrixWorldAutoUpdate = false; // (the renderer's own walk of it skipped)
      try { render(dt); } finally { sc.matrixWorldAutoUpdate = auto; }
    };
    // (made from a target of the buffer's size, the composer took that size for the window's and multiplied
    // it by the pixel ratio again: the bloom ran at 2.25 times the pixels, and a lower ratio grew the buffers)
    this.composer.setSize(window.innerWidth, window.innerHeight);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.skyEnv = new SkyEnv(renderer); // (a scene with `userData.skyEnv` is lit and reflected by its own sky instead)

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
    const g = scene.userData.grade;
    this.grade.uniforms.uSat.value = g?.sat ?? 1;
    this.grade.uniforms.uContrast.value = g?.contrast ?? 1;
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
      const raw = this.lastStamp == null ? 0 : (timestamp - this.lastStamp) / 1000;
      this.lastStamp = timestamp;
      // (not behind the loading screen: its frames are slow because the scene's being built, not drawn)
      if (!this.paused && !this.veiled?.() && raw > 0 && raw < 0.25 && !document.hidden) this.adapt(raw);
      // the timer can report a negative delta when its clock and the frame timestamps disagree
      // (around visibility changes); a negative step poisons damping and flight maths with NaN
      const dt = Math.max(0, Math.min(this.timer.getDelta(), 1 / 20));
      this.perf?.begin(); // (the performance counter, ui/PerfHud.js, while it's up)
      if (this.paused) this.composer.render(0); // keep drawing the frozen frame under the menu
      else this.frame(dt);
      this.perf?.end(timestamp);
    });
  }

  // Dynamic resolution, as games do it: a second and a half of frames slower than 45 a second steps the
  // pixel ratio down an eighth (to 0.6 of the screen's at the least), four seconds faster than 70 steps
  // it back up. (A big Retina window drew 4 million pixels with 4x multisampling and bloom.) The scene's 4x
  // multisampling goes to 2x first, before any resolution (1.4 ms of the street's GPU time, and the edges
  // hardly change), and comes back last; `gl_msaa` fixes it.
  setSamples(n) {
    const t = this.renderPass.target;
    if (t.samples !== n) { t.samples = n; t.dispose(); }
  }
  adapt(raw) {
    if (this.fixedRatio) return;
    this.frameAvg += (raw - this.frameAvg) * 0.08;
    if (this.frameAvg > 1 / 45) { this.slowT += raw; this.fastT = 0; }
    else if (this.frameAvg < 1 / 70) { this.fastT += raw; this.slowT = 0; }
    else this.slowT = this.fastT = 0;
    const min = Math.max(0.75, this.maxRatio * 0.6);
    let next = this.ratio;
    const samples = this.renderPass.target.samples, msaaFixed = globalThis.localStorage?.gl_msaa != null;
    if (this.slowT > 1.5 && samples === 4 && !msaaFixed) { this.setSamples(2); this.slowT = 0; this.frameAvg = 1 / 60; return; }
    if (this.fastT > 4 && this.ratio >= this.maxRatio && samples === 2 && !msaaFixed) { this.setSamples(4); this.fastT = 0; return; }
    if (this.slowT > 1.5) next = Math.max(min, this.ratio - 0.125);
    else if (this.fastT > 4) next = Math.min(this.maxRatio, this.ratio + 0.125);
    if (next === this.ratio) return;
    this.ratio = next;
    this.slowT = this.fastT = 0;
    this.frameAvg = 1 / 60;
    this.renderer.setPixelRatio(next);
    this.composer.setPixelRatio(next);
  }

  frame(dt, render = true) {
    const real = dt;
    dt *= this.timeScale;
    this.time += dt;
    this.grade.uniforms.uTime.value = this.time + (this.timeScale < 1 ? performance.now() / 1000 : 0);
    const t0 = performance.now();
    this.update(dt, this.time, real);
    const t1 = performance.now();
    this.skyEnv.update(this.scene, real);
    if (render && !this.veiled?.()) this.composer.render(dt); // (behind the loading screen nothing's seen: `veiled`, main.js)
    const t2 = performance.now();
    this.cpu = { update: t1 - t0, render: t2 - t1 };
    // (dev only: frames over 50 ms, how long the game's update and the render each took)
    if (import.meta.env.DEV && t2 - t0 > 50) (window.__slowFrames ??= []).push({ at: Math.round(t0), update: Math.round(t1 - t0), render: Math.round(t2 - t1) });
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
