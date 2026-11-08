import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Rig } from './Rig.js';
import { MocapSource } from './Mocap.js';

export async function loadCharacters(manager) {
  const loader = new GLTFLoader(manager);
  const [casual, lantern, abin, xbot, kilowog] = await Promise.all([
    loader.loadAsync('/models/hal_casual.glb'),
    loader.loadAsync('/models/hal_lantern.glb'),
    loader.loadAsync('/models/abin_sur.glb'),
    loader.loadAsync('/anims/xbot.glb'),
    loader.loadAsync('/models/kilowog.glb').catch(() => null), // Part Two; optional until built
  ]);
  for (const g of [casual, lantern, abin, kilowog]) {
    if (!g) continue;
    g.scene.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const m = o.material;
      // Tripo packs occlusion into the red channel of the ORM texture.
      if (m.metalnessMap) { m.aoMap = m.metalnessMap; m.aoMapIntensity = 0.85; }
      m.envMapIntensity = 0.6;
    });
  }
  return { casual, lantern, abin, kilowog, mocap: new MocapSource(xbot) };
}

// Adds suit glow, a sweep dissolve for the transformation, a tint, and an optional hidden bone.
// Pass `u` to share one set of uniforms across all of a character's meshes.
export function makeUniforms({ glow = 0, hideBone = -1, roughMin = 0 } = {}) {
  return {
    uRoughMin: { value: roughMin },
    uDissolve: { value: 0 }, uDissolveOn: { value: 0 }, uDissolveSign: { value: 1 },
    uGlow: { value: glow }, uTint: { value: new THREE.Color(1, 1, 1) },
    uEdgeColor: { value: new THREE.Color(0.5, 4, 1.4) }, uHideBone: { value: hideBone },
  };
}

export function patchMaterial(mat, { glow = 0, hideBone = -1, u = makeUniforms({ glow, hideBone }) } = {}) {
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDPos;\nvarying float vHide;\nuniform float uHideBone;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vDPos = position;
        vHide = 0.0;
        #ifdef USE_SKINNING
          vHide = dot(skinWeight, vec4(equal(skinIndex, vec4(uHideBone))));
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDPos; varying float vHide;
        uniform float uDissolve, uDissolveOn, uDissolveSign, uGlow, uRoughMin;
        uniform vec3 uEdgeColor, uTint;
        float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float dNoise(vec3 x) {
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vHide > 0.5) discard;
        diffuseColor.rgb *= uTint;
        float dEdge = 0.0;
        if (uDissolveOn > 0.5) {
          float field = vDPos.y / 1.9 * 0.6 + (dNoise(vDPos * 11.0) * 0.6 + dNoise(vDPos * 31.0) * 0.4) * 0.4;
          float gap = uDissolveSign > 0.0 ? field - uDissolve : uDissolve - field;
          if (gap < 0.0) discard;
          dEdge = 1.0 - smoothstep(0.0, 0.05, gap);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n        roughnessFactor = max(roughnessFactor, uRoughMin);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_MAP
          vec3 gc = texture2D(map, vMapUv).rgb;
          float gm = smoothstep(0.08, 0.3, gc.g - max(gc.r, gc.b) * 1.1) * smoothstep(0.3, 0.65, gc.g);
          totalEmissiveRadiance += vec3(0.25, 1.0, 0.45) * gm * uGlow;
        #endif
        totalEmissiveRadiance += uEdgeColor * dEdge;`);
  };
  mat.customProgramCacheKey = () => `gl-patch-${hideBone >= 0}`;
  return u;
}

// A character from one of the rigged scans, with its own skeleton and shared material uniforms.
function createCharacter(gltf, { glow = 0, roughMin = 0 } = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  const u = makeUniforms({ glow, roughMin });
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.material = o.material.clone();
    patchMaterial(o.material, { u });
  });
  const rig = new Rig(root);
  rig.u = u;
  return rig;
}

export const createHal = (gltf, opts) => createCharacter(gltf, opts);

// Abin Sur, from his own scan: the suit's green panels glow faintly until he dies.
export const createAbinSur = (gltf) => createCharacter(gltf, { glow: 0.32 });

// Kilowog, the Corps' drill sergeant, from his own scan.
export const createKilowog = (gltf) => createCharacter(gltf, { glow: 0.6, roughMin: 0.45 });

function emblemTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#062b12';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = g.fillStyle = '#d9ffe4';
  g.lineWidth = size * 0.1;
  g.beginPath();
  g.arc(size / 2, size / 2, size * 0.27, 0, Math.PI * 2);
  g.stroke();
  g.fillRect(size * 0.12, size * 0.22, size * 0.76, size * 0.08);
  g.fillRect(size * 0.12, size * 0.7, size * 0.76, size * 0.08);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRing() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x3bff7a, emissive: 0x22ff66, emissiveIntensity: 1.6, metalness: 0.7, roughness: 0.25 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0032, 14, 48), metal);
  group.add(band);
  const emblem = emblemTexture();
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: emblem, emissive: 0x7dffaa, emissiveMap: emblem, emissiveIntensity: 3 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 32), [metal, faceMat, metal]);
  crown.position.y = 0.0125;
  group.add(crown);
  group.userData.materials = [metal, faceMat];
  return group;
}

// The power battery: a lathed lantern body with glowing panes.
export function createLantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, metalness: 0.8, roughness: 0.35, emissive: 0x0a3d18, emissiveIntensity: 0.6 });
  const profile = [
    [0, 0], [0.13, 0], [0.14, 0.02], [0.12, 0.045], [0.1, 0.05], [0.1, 0.07], [0.125, 0.085], [0.125, 0.1],
    [0.1, 0.11], [0.1, 0.33], [0.13, 0.35], [0.13, 0.37], [0.09, 0.4], [0.06, 0.43], [0.06, 0.46], [0.03, 0.47], [0, 0.47],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), metal);
  body.castShadow = true;
  group.add(body);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.21, 6, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x9dffc0, emissive: 0x4dff88, emissiveIntensity: 2.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  glass.position.y = 0.22;
  group.add(glass);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.22, 0.014), metal);
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    bar.position.set(Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1);
    group.add(bar);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 10, 40, Math.PI), metal);
  handle.position.y = 0.47;
  group.add(handle);
  const light = new THREE.PointLight(0x55ff8a, 1.2, 4, 2);
  light.position.y = 0.22;
  group.add(light);
  group.userData = { glass, light };
  return group;
}
