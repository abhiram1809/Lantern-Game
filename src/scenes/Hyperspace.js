import * as THREE from 'three';
import { NOISE_GLSL } from '../fx/Sky.js';
import { Particles } from '../fx/Particles.js';
import { glowTexture } from '../fx/Textures.js';

const SPAN = 420;   // depth of the streak field
const FRONT = 16;   // streaks wrap once they pass this z (behind every camera we use)

// The light's transit, styled after the space-flight reference video: Hal carried head-first
// through hyperspace. Light streaks rush past toward the camera and stretch with `warp` (0 = star
// points, 1 = full hyperspeed); a starfield/nebula backdrop sits behind, green energy wisps and
// sparks stream off him, and a destination core glows at the vanishing point.
export class Hyperspace {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010204);
    this.warp = 0;
    this.travel = 0;
    this.burst = 0;
    this.anchor = new THREE.Vector3(); // where Hal's hips are; wisps and sparks stream from here
    this.buildBackdrop();
    this.buildStreaks();
    this.buildCore();
    this.buildWisps();
    this.sparks = new Particles(700, { additive: true, drag: 0.7, turbulence: 3 });
    this.scene.add(this.sparks.points);
    this.acc = 0;

    this.scene.add(new THREE.AmbientLight(0x22334a, 0.7));
    const ahead = new THREE.DirectionalLight(0xbff6ea, 1.4);
    ahead.position.set(0, 0.5, -10);
    this.scene.add(ahead);
    this.glow = new THREE.PointLight(0x55ff88, 6, 5, 2);
    this.scene.add(this.glow);
  }

  buildBackdrop() {
    this.backdropU = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.backdropU,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        ${NOISE_GLSL}
        void main() {
          vec3 d = normalize(vDir);
          vec2 p = vec2(atan(d.x, -d.z), d.y) * vec2(2.0, 2.6);
          float n = fbm(p * 1.3 + 3.0), n2 = fbm(p * 3.1 - 7.0);
          vec3 col = vec3(0.001, 0.0015, 0.003);
          col += vec3(0.012, 0.018, 0.032) * pow(n, 3.0) * 1.5 + vec3(0.03, 0.01, 0.008) * pow(n2, 5.0) * 1.6;
          float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.2))) / 0.2, 2.0));
          col += vec3(0.016, 0.018, 0.026) * band * (0.4 + n2);
          col *= 1.0 - band * smoothstep(0.55, 0.75, fbm(p * 5.0)) * 0.6;
          vec3 sp = d * 230.0, cell = floor(sp);
          float h = hash12(vec2(cell.x + cell.z * 17.3, cell.y - cell.z * 7.1));
          float star = step(0.986, h) * smoothstep(0.5, 0.05, length(fract(sp) - 0.5));
          col += vec3(0.85, 0.92, 1.0) * star * (0.4 + 2.2 * hash12(cell.yz + 4.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  buildStreaks(count = 1900) {
    const geo = new THREE.InstancedBufferGeometry();
    // x: across the streak (-1..1), y: head (0) .. tail (1)
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
    geo.setIndex([0, 2, 1, 2, 3, 1]);
    const start = new Float32Array(count * 3), speed = new Float32Array(count), len = new Float32Array(count), width = new Float32Array(count), tint = new Float32Array(count * 3);
    const teal = new THREE.Color(0.72, 1.0, 0.93), green = new THREE.Color(0.35, 1.0, 0.55), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 3.2 + Math.pow(Math.random(), 0.65) * 42;
      start.set([Math.cos(a) * r, Math.sin(a) * r, Math.random() * SPAN], i * 3);
      speed[i] = 0.75 + Math.random() * 0.6;
      len[i] = 7 + Math.random() * 20;
      width[i] = (0.025 + Math.random() * 0.07) * (0.6 + r / 22);
      c.copy(teal).lerp(green, Math.random() < 0.25 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.15);
      tint.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 3));
    geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
    geo.setAttribute('aLen', new THREE.InstancedBufferAttribute(len, 1));
    geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(width, 1));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    geo.instanceCount = count;
    this.streakU = { uTravel: { value: 0 }, uWarp: { value: 0 }, uIntensity: { value: 3.2 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.streakU,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aStart; attribute float aSpeed, aLen, aWidth; attribute vec3 aTint;
        uniform float uTravel, uWarp;
        varying vec2 vQ; varying vec3 vTint; varying float vFade;
        void main() {
          float z = ${FRONT.toFixed(1)} - ${SPAN.toFixed(1)} + mod(aStart.z + uTravel * aSpeed, ${SPAN.toFixed(1)});
          vec3 head = vec3(aStart.xy, z);
          vec3 tail = head - vec3(0.0, 0.0, aLen * (0.03 + uWarp) + 0.06);
          vec4 vh = modelViewMatrix * vec4(head, 1.0), vt = modelViewMatrix * vec4(tail, 1.0);
          // clip the segment against a near plane so streaks crossing the camera stay sane
          const float near = -0.3;
          if (vh.z > near && vt.z > near) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          if (vh.z > near) vh = mix(vt, vh, (near - vt.z) / (vh.z - vt.z));
          if (vt.z > near) vt = mix(vh, vt, (near - vh.z) / (vt.z - vh.z));
          vec3 dir = normalize(vt.xyz - vh.xyz);
          vec3 c = cross(dir, normalize(vh.xyz));
          vec3 side = c / max(length(c), 1e-5);
          vec4 v = mix(vh, vt, position.y);
          v.xyz += side * position.x * aWidth * mix(1.0, 0.3, position.y);
          gl_Position = projectionMatrix * v;
          vQ = position.xy;
          vTint = aTint;
          // far streaks fade in, so the vanishing point stays a dark eye instead of a grey knot
          vFade = smoothstep(${(FRONT - SPAN).toFixed(1)}, ${(FRONT - SPAN + 220).toFixed(1)}, z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        varying vec2 vQ; varying vec3 vTint; varying float vFade;
        void main() {
          float across = 1.0 - abs(vQ.x);
          float a = across * across * pow(1.0 - vQ.y, 1.4) * vFade;
          gl_FragColor = vec4(vTint * uIntensity * a, 1.0);
        }
      `,
    });
    const streaks = new THREE.Mesh(geo, mat);
    streaks.frustumCulled = false;
    this.scene.add(streaks);
  }

  buildCore() {
    const tex = glowTexture('rgba(255,255,255,1)', 'rgba(110,255,170,0.45)');
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.4, 3, 1.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.core.position.set(0, 0, -380);
    this.core.scale.setScalar(55);
    this.scene.add(this.core);
  }

  // Smoky green ribbons spiralling back from Hal toward the camera.
  buildWisps() {
    this.wisps = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1, 1, 1, 90);
    for (let i = 0; i < 5; i++) {
      // kept short enough to end before the chase camera (~3 m behind Hal)
      const u = { uTime: { value: 0 }, uSeed: { value: i / 5 + Math.random() * 0.1 }, uWidth: { value: 0.5 + Math.random() * 0.5 }, uLength: { value: 2.2 + Math.random() * 0.8 }, uSpread: { value: 0.9 + Math.random() * 1.2 }, uOpacity: { value: 1 } };
      const mat = new THREE.ShaderMaterial({
        uniforms: u,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uSeed, uWidth, uLength, uSpread;
          varying vec2 vUv; varying float vS;
          void main() {
            float s = position.y + 0.5;
            float ang = uSeed * 6.2832 + s * 2.4 + uTime * 0.7;
            float rad = 0.2 + s * uSpread;
            float w = position.x * uWidth * (0.35 + s);
            vec3 p = vec3(cos(ang) * rad - sin(ang) * w, sin(ang) * rad + cos(ang) * w, s * uLength);
            p.x += sin(s * 7.0 - uTime * 3.0 + uSeed * 9.0) * 0.45 * s;
            p.y += cos(s * 6.0 - uTime * 2.6 + uSeed * 5.0) * 0.4 * s;
            vUv = vec2(position.x + 0.5, s);
            vS = s;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime, uSeed, uOpacity;
          varying vec2 vUv; varying float vS;
          ${NOISE_GLSL}
          void main() {
            float n = fbm(vec2(vUv.x * 2.5 + uSeed * 10.0, vUv.y * 6.0 - uTime * 2.4));
            float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
            float a = smoothstep(0.38, 0.8, n) * edge * (1.0 - vS) * smoothstep(0.0, 0.05, vS) * uOpacity;
            gl_FragColor = vec4(vec3(0.2, 1.2, 0.45) * a * 0.7, 1.0);
          }
        `,
      });
      const ribbon = new THREE.Mesh(geo, mat);
      ribbon.frustumCulled = false;
      ribbon.userData.u = u;
      this.wisps.add(ribbon);
    }
    this.scene.add(this.wisps);
  }

  update(dt, t, camera, renderer) {
    this.travel += dt * (6 + this.warp * 270);
    this.streakU.uTravel.value = this.travel;
    this.streakU.uWarp.value = this.warp;
    this.backdropU.uTime.value = t;
    this.core.scale.setScalar(45 + this.warp * 20 + this.burst * 520);
    this.core.material.opacity = 0.6 + 0.4 * this.warp;
    this.wisps.position.copy(this.anchor);
    for (const r of this.wisps.children) {
      r.userData.u.uTime.value = t;
      r.userData.u.uOpacity.value = 0.35 + 0.65 * this.warp;
    }
    this.glow.position.copy(this.anchor).add(_glowOffset);
    this.glow.intensity = 1.5 + this.warp * 1.5;
    this.acc += dt * (30 + this.warp * 90);
    const n = Math.floor(this.acc);
    this.acc -= n;
    if (n > 0) {
      const p0 = this.anchor, w = this.warp;
      // sparks peel off and trail behind him, dying out before they reach the camera
      this.sparks.emit(n, (p, v) => {
        p[0] = p0.x + (Math.random() - 0.5) * 0.7; p[1] = p0.y + (Math.random() - 0.5) * 0.7; p[2] = p0.z + (Math.random() - 0.5) * 0.7;
        v[0] = (Math.random() - 0.5) * 1.6; v[1] = (Math.random() - 0.5) * 1.6; v[2] = 1.2 + w * 3 + Math.random();
      }, { life: 0.6, size: [0.035, 0.0], color: [[0.6, 3.0, 1.2, 1], [0.15, 1.2, 0.4, 0]] });
    }
    this.sparks.update(dt, t, camera, renderer);
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [o.material ?? []].flat()) m.dispose();
    });
  }
}
// behind and below Hal (toward his legs), so the green rims his body instead of flooding his face
const _glowOffset = new THREE.Vector3(0, -0.5, 0.9);
