// Korugar's streets wet at night (the graphics rework, 2026-11-23, after the user's neon-alley reference): the
// screens, the neon blade signs and the lamps seen again in the stone under them, as games have long done it
// without drawing the city twice. Each light has a streak on the ground: where its mirror image would be, from
// the camera's height and how far off it is (a light h up, seen from c up and d away, shows d·h/(h + c) out
// from its foot), drawn out toward the camera the way a rough wet surface smears a reflection, broken up by
// puddles, faded by the haze, and only at night (`set(k)`). One instanced draw for all of them.
import * as THREE from 'three';
import { NOISE_GLSL } from '../fx/Sky.js';

export class WetStreaks {
  // sources: [{ at: Vector3 (the light's centre), w (its width), h (its height), out: Vector3 (the way its face
  // looks, flat), color: Color }]
  constructor(scene, sources) {
    const n = sources.length, base = new Float32Array(n * 3), size = new Float32Array(n * 3), col = new Float32Array(n * 3);
    sources.forEach((s, i) => {
      // its foot: under it on the ground, a little out from the wall it's on
      base.set([s.at.x + s.out.x * 0.8, s.at.y, s.at.z + s.out.z * 0.8], i * 3);
      size.set([s.w, s.h, s.strength ?? 1], i * 3);
      col.set([s.color.r, s.color.g, s.color.b], i * 3);
    });
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.instanceCount = n;
    this.uniforms = { uK: { value: 0 }, uFog: { value: scene.fog?.density ?? 0 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      vertexShader: /* glsl */ `
        attribute vec3 aBase, aSize, aColor;
        varying vec2 vUv; varying vec3 vColor; varying vec3 vWorld; varying float vFade;
        void main() {
          vec2 toCam = cameraPosition.xz - aBase.xz;
          float d = max(length(toCam), 0.5);
          vec2 f = toCam / d, r = vec2(-f.y, f.x);
          float c = max(cameraPosition.y, 0.3), y0 = max(aBase.y - aSize.y * 0.5, 0.2), y1 = aBase.y + aSize.y * 0.5;
          // the image's near and far ends on the ground (the top of the light shows nearest the camera), drawn out
          float a = d * y0 / (y0 + c), b = d * y1 / (y1 + c);
          float near = min(b + (b - a) * 0.45 + 0.8, d * 0.9), far = max(a - (b - a) * 0.1 - 0.3, 0.0);
          float along = mix(far, near, position.y);
          float hw = aSize.x * 0.42 * (1.0 + 0.15 * position.y); // (half is a reserved word)
          vec3 p = vec3(aBase.x + f.x * along + r.x * position.x * hw, 0.03, aBase.z + f.y * along + r.y * position.x * hw);
          vUv = position.xy;
          vColor = aColor * aSize.z;
          vWorld = p;
          vFade = smoothstep(0.0, 6.0, d); // (none right under it)
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uK, uFog, uTime;
        varying vec2 vUv; varying vec3 vColor; varying vec3 vWorld; varying float vFade;
        ${NOISE_GLSL}
        void main() {
          float across = exp(-vUv.x * vUv.x * 5.0);
          float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
          // puddles: the wet stone shines in patches, a fine ripple of grain over it
          float wet = smoothstep(0.45, 0.72, fbm(vWorld.xz * 0.11)) * 0.85 + 0.15;
          float grain = 0.6 + 0.8 * vnoise(vec2(dot(vWorld.xz, vec2(0.7, 0.7)) * 1.5, vUv.y * 14.0) + uTime * 0.05); // (broken along its length, as ripples break a reflection)
          float dist = distance(cameraPosition, vWorld), fog = exp(-uFog * uFog * dist * dist);
          float k = across * along * wet * grain * fog * vFade * uK;
          if (k < 0.002) discard;
          gl_FragColor = vec4(vColor * k, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  set(k) { this.uniforms.uK.value = k; this.mesh.visible = k > 0.01; }
  update(dt, fog) { this.uniforms.uTime.value += dt; if (fog) this.uniforms.uFog.value = fog.density; }
}
