// Coast City's people: Microsoft's Rocketbox avatars (MIT), on our skeleton by tools/build-people.mjs,
// with their own fingers and eyes and seven face shapes. The mocap, the IK, the look-at and the poses
// drive them as they drive the scans; what the scans can't do, they do here: blinking, a jaw that
// opens on the voice's curve (a real blendshape, not the scans' shader hinge), eyes that turn to
// what they look at, and hands that rest curled or close round what they hold.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Rig } from './Rig.js';
import { makeUniforms, patchMaterial } from './Characters.js';
import { assetUrl } from '../engine/Assets.js';

const loader = new GLTFLoader();
const cache = new Map();
let roster = null;

// people.json: who exists (heights, eye heights, roles)
export async function peopleRoster() {
  roster ??= fetch(assetUrl('models/people/people.json')).then((r) => (r.ok ? r.json() : { people: {} })).catch(() => ({ people: {} }));
  return (await roster).people;
}

// load each id once (the GLB is shared; every person made from it is a clone)
export function loadPeople(ids) {
  return Promise.all(ids.map((id) => {
    if (!cache.has(id)) {
      cache.set(id, loader.loadAsync(assetUrl(`models/people/${id}.glb`)).then((g) => {
        g.scene.traverse((o) => {
          if (!o.isSkinnedMesh) return;
          const m = o.material;
          m.envMapIntensity = 0.55;
          // the hair and lashes are cut-outs: smoothed by the MSAA instead of stair-stepped
          if (m.alphaTest > 0 || m.transparent) { m.transparent = false; m.alphaTest = 0.4; m.alphaToCoverage = true; m.side = THREE.DoubleSide; }
        });
        return g;
      }).catch(() => null));
    }
    return cache.get(id);
  }));
}
export const personLoaded = (id) => cache.get(id);

// curl of each finger's three joints (radians) for a hand at rest, a hand round a thing, and a fist
export const GRIPS = {
  relaxed: { thumb: [0.15, 0.15, 0.1], index: [0.22, 0.32, 0.2], middle: [0.28, 0.4, 0.24], ring: [0.34, 0.46, 0.26], pinky: [0.4, 0.5, 0.28] },
  hold: { thumb: [0.35, 0.4, 0.3], index: [0.9, 1.0, 0.6], middle: [1.0, 1.05, 0.6], ring: [1.05, 1.05, 0.6], pinky: [1.1, 1.0, 0.6] },
  fist: { thumb: [0.55, 0.6, 0.5], index: [1.45, 1.6, 1.0], middle: [1.5, 1.6, 1.0], ring: [1.5, 1.6, 1.0], pinky: [1.5, 1.55, 1.0] },
  open: { thumb: [0, 0, 0], index: [0.05, 0.05, 0.05], middle: [0.05, 0.05, 0.05], ring: [0.05, 0.05, 0.05], pinky: [0.05, 0.05, 0.05] },
};
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _e = new THREE.Vector3();

// A person: `rig` (a Rig like the scans'), with `person.update(dt)` to run blinks, the mouth and the
// eyes. `opts.grip` sets both hands' rest ('relaxed').
export function createPerson(gltf, { grip = 'relaxed', seed = 1 } = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  // the shader jaw is off (the mouth is a blendshape): its uniforms put the hinge out of reach, but
  // uJawOn tells the story this face can speak
  const u = makeUniforms({ roughMin: 0.5 });
  u.uJawOn.value = 1;
  u.uMouth.value.set(-10, -10, -10, 0.02);
  const shaped = [];
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.material = o.material.clone();
    patchMaterial(o.material, { u });
    if (o.morphTargetDictionary) shaped.push(o);
  });
  const rig = new Rig(root);
  rig.u = u;
  rig.person = true;
  const b = rig.bones;

  // each finger joint's curl axis, from the rest pose: across the finger, so a turn brings the tip
  // toward the palm (the palm: the side the hand's knuckle plane faces toward the body and down)
  const axes = {};
  for (const s of ['L', 'R']) {
    const hand = rig.restPos[`hand_${s}`] ?? b[`hand_${s}`].getWorldPosition(new THREE.Vector3());
    const at = (n) => b[n].getWorldPosition(new THREE.Vector3());
    const idx = at(`index1_${s}`), pink = at(`pinky1_${s}`), mid = at(`middle1_${s}`);
    const palm = new THREE.Vector3().crossVectors(idx.clone().sub(hand), pink.clone().sub(hand)).normalize();
    // toward the body's middle and down
    const inward = new THREE.Vector3(-Math.sign(hand.x), -1, 0).normalize();
    if (palm.dot(inward) < 0) palm.negate();
    for (const f of FINGERS) for (let k = 1; k <= 3; k++) {
      const n = `${f}${k}_${s}`, next = b[`${f}${k + 1}_${s}`];
      const from = at(n), to = next ? at(`${f}${k + 1}_${s}`) : from.clone().add(from.clone().sub(at(k > 1 ? `${f}${k - 1}_${s}` : `hand_${s}`)));
      const along = to.sub(from).normalize();
      let ax;
      // the thumb folds across the palm, toward the middle finger's second joint
      if (f === 'thumb') ax = new THREE.Vector3().crossVectors(along, at(`middle2_${s}`).add(palm.clone().multiplyScalar(0.025)).sub(at(`thumb1_${s}`))).normalize();
      else ax = new THREE.Vector3().crossVectors(along, palm).normalize();
      axes[n] = ax;
    }
  }
  const setGrip = (side, name, k = 1) => {
    const g = GRIPS[name] ?? name;
    for (const s of side === 'both' ? ['L', 'R'] : [side]) for (const f of FINGERS) for (let j = 1; j <= 3; j++) {
      const n = `${f}${j}_${s}`;
      b[n]?.quaternion.setFromAxisAngle(axes[n], g[f][j - 1] * k);
    }
  };
  setGrip('both', grip);

  // blinking: every 2 to 6 s, a 0.16 s close and open (a double blink now and then)
  let rnd = seed * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  let blinkIn = 1 + rand() * 3, blinkT = -1, gaze = null;
  const eyesRest = { L: b.eye_L?.quaternion.clone(), R: b.eye_R?.quaternion.clone() };
  const shapes = shaped.map((m) => ({ m, d: m.morphTargetDictionary }));
  const setShape = (name, v) => { for (const { m, d } of shapes) if (d[name] !== undefined) m.morphTargetInfluences[d[name]] = v; };

  const person = {
    rig, setGrip, setShape,
    smile: 0, extraJaw: 0,
    // the eyes turn toward a point (a Vector3 or a function), within their limits; null: ahead
    lookEyes(target) { gaze = target; },
    update(dt) {
      // blink
      if (blinkT < 0 && (blinkIn -= dt) < 0) { blinkT = 0; blinkIn = 2 + rand() * 4; if (rand() < 0.15) blinkIn = 0.25; }
      let lid = 0;
      if (blinkT >= 0) { blinkT += dt; lid = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) blinkT = -1; }
      setShape('blinkL', lid);
      setShape('blinkR', lid);
      // the mouth (the jaw shape from the voice's curve, set by the story into u.uJaw), a smile
      setShape('jawOpen', Math.min(1, Math.max(u.uJaw.value * 1.1, this.extraJaw))); // (extraJaw: a line overheard, story/CityLife.js)
      setShape('smileL', this.smile);
      setShape('smileR', this.smile);
      // the eyes: a rotation from the head's forward to the target, capped (about 25° across, 15° up or down)
      for (const s of ['L', 'R']) {
        const eye = b[`eye_${s}`];
        if (!eye) continue;
        const t = typeof gaze === 'function' ? gaze() : gaze;
        if (!t) { eye.quaternion.slerp(eyesRest[s], Math.min(1, dt * 8)); continue; }
        eye.parent.updateWorldMatrix(true, false);
        _w.copy(t).applyMatrix4(_m.copy(eye.parent.matrixWorld).invert()).sub(eye.position).normalize();
        const yaw = THREE.MathUtils.clamp(Math.atan2(_w.x, _w.z), -0.45, 0.45), pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(_w.y, -1, 1)), -0.28, 0.22);
        _q.setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
        eye.quaternion.slerp(_q, Math.min(1, dt * 14));
      }
    },
  };
  rig.personal = person;
  return person;
}

// where a person's eyes are (for others to look at them)
export const eyesOf = (rig, out = _e) => (rig.bones.eye_L ? rig.bonePosition('eye_L', out).lerp(rig.bonePosition('eye_R', _v), 0.5) : rig.bonePosition('head', out).add(_v.set(0, 0.08, 0.06)));
