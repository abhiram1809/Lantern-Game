// Contact shadows (the polish pass, 2026-11-23: "nothing should look like it is floating"): a soft dark footprint
// on the ground under every car and every character near the camera, where the sun's shadow map doesn't reach
// (the shade, the night, past its box) or is too coarse to show the dark where a tyre or a shoe meets the
// street. One instanced draw for the scene: each frame the cars (Smash's) and the characters (every Rig adds
// its root to `contactBodies`) within 70 m are found the ground under them by a short ray, and their footprints
// laid there, a rounded box for a car and a disc for a body, faded with height above it (Hal flying) and in
// the haze.
import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';

export const contactBodies = new Set(); // character roots (characters/Rig.js)
const REACH = 70, CAP = 192;
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _e = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0);
const inScene = (o, scene) => { for (; o; o = o.parent) { if (!o.visible) return false; if (o === scene) return true; } return false; };

export class ContactShadows {
  // cars(): the scene's cars as [{ object, half: Vector3 (its box's half size, in its own frame) }]
  constructor(scene, physics, { cars = () => [] } = {}) {
    Object.assign(this, { scene, physics, cars });
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2); // (its darkness, its shape: 0 a disc, 1 a car)
    geo.setAttribute('aFade', this.fade);
    this.uniforms = { uFog: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      vertexShader: /* glsl */ `
        attribute vec2 aFade;
        varying vec2 vUv; varying vec2 vFade; varying float vDist;
        void main() {
          vUv = position.xz;
          vFade = aFade;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vDist = distance(w.xyz, cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFog;
        varying vec2 vUv; varying vec2 vFade; varying float vDist;
        void main() {
          vec2 a = abs(vUv);
          // a car's a rounded box (a superellipse), darkest under its middle; a body's a disc, darkest at its feet
          float d = mix(length(a), pow(pow(a.x, 4.0) + pow(a.y, 4.0), 0.25), vFade.y);
          float k = pow(1.0 - smoothstep(mix(0.05, 0.62, vFade.y), 1.0, d), 1.4);
          float fog = exp(-uFog * uFog * vDist * vDist);
          float alpha = k * vFade.x * fog;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }`,
    });
    mat.name = 'contactShadows';
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  // the ground under (x, y, z) (the feet, a car's floor), or null within 40 m: fixed colliders only (not the
  // bodies' own capsules, the cars, loose props), from a little above it, hollow (from inside a collider, as
  // under Hal's car's box, the ray meets its underside: the ground)
  ground(x, y, z) {
    this.ray.origin = { x, y: y + 0.3, z };
    const hit = this.physics.world.castRay(this.ray, 40, false, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    return hit ? y + 0.3 - hit.timeOfImpact : null;
  }

  update(camera) {
    const c = camera.position, fade = this.fade.array;
    this.uniforms.uFog.value = this.scene.fog?.density ?? 0;
    let n = 0;
    const put = (x, y, z, yaw, w, l, dark, shape) => {
      if (n >= CAP) return;
      _m.compose(_p.set(x, y + 0.025, z), _q.setFromAxisAngle(_Y, yaw), _s.set(w / 2, 1, l / 2));
      this.mesh.setMatrixAt(n, _m);
      fade[n * 2] = dark;
      fade[n * 2 + 1] = shape;
      n++;
    };
    for (const car of this.cars()) {
      const o = car.object;
      o.getWorldPosition(_p);
      if (_p.distanceToSquared(c) > REACH * REACH || !inScene(o, this.scene)) continue;
      const g = this.ground(_p.x, _p.y, _p.z);
      if (g == null) continue;
      const h = _p.y - g, dark = 0.78 * (1 - THREE.MathUtils.smoothstep(h, 0.3, 2.2));
      if (dark < 0.01) continue;
      _e.setFromQuaternion(o.getWorldQuaternion(_q), 'YXZ');
      const x = _p.x, z = _p.z, yaw = _e.y;
      // (a little past the body all round: under it the footprint's hidden, what shows is its edge)
      put(x, g, z, yaw, car.half.x * 2 + 0.9, car.half.z * 2 + 1.2, dark, 1);
    }
    for (const root of contactBodies) {
      if (!inScene(root, this.scene)) continue;
      root.getWorldPosition(_p);
      if (_p.distanceToSquared(c) > REACH * REACH) continue;
      const g = this.ground(_p.x, _p.y, _p.z);
      if (g == null) continue;
      const h = _p.y - g, s = root.scale.y, dark = 0.6 * (1 - THREE.MathUtils.smoothstep(h, 0.15, 3.0));
      if (dark < 0.01) continue;
      const r = (0.6 + h * 0.15) * s;
      put(_p.x, g, _p.z, 0, r * 2, r * 2, dark, 0);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
}
