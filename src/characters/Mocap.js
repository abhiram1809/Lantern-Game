import * as THREE from 'three';
import { BONE_ORDER, PARENT } from './Rig.js';
import { clamp } from '../engine/Time.js';

// Mixamo bone for each of our bones (three's GLTFLoader strips the ':' from 'mixamorig:').
const MAP = {
  hips: 'Hips', spine: 'Spine1', chest: 'Spine2', neck: 'Neck', head: 'Head',
  upperArm_L: 'LeftArm', foreArm_L: 'LeftForeArm', hand_L: 'LeftHand', upperArm_R: 'RightArm', foreArm_R: 'RightForeArm', hand_R: 'RightHand',
  thigh_L: 'LeftUpLeg', shin_L: 'LeftLeg', foot_L: 'LeftFoot', thigh_R: 'RightUpLeg', shin_R: 'RightLeg', foot_R: 'RightFoot',
};
// limb bones whose rest direction differs between rigs (T- vs A-pose); the torso and feet line up
const LIMB_CHILD = {
  upperArm_L: 'LeftForeArm', foreArm_L: 'LeftHand', hand_L: 'LeftHandMiddle1', upperArm_R: 'RightForeArm', foreArm_R: 'RightHand', hand_R: 'RightHandMiddle1',
  thigh_L: 'LeftLeg', shin_L: 'LeftFoot', thigh_R: 'RightLeg', shin_R: 'RightFoot',
};
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// One skeleton + its clips, as loaded. Instances (one per animated character) clone the skeleton.
export class MocapSource {
  constructor(gltf) {
    this.scene = gltf.scene;
    this.clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    const inst = new MocapInstance(this);
    this.hipsHeight = inst.restPos.Hips.y;
    this.metrics = {};
    for (const name of ['walk', 'run', 'Walk', 'Run']) if (this.clips[name]) this.metrics[name] = measureGait(inst, this.clips[name]);
  }
}

// Per-character copy of a source skeleton with its own mixer.
export class MocapInstance {
  constructor(source) {
    this.source = source;
    this.root = source.scene.clone(true);
    this.nodes = {};
    this.root.traverse((o) => { if (o.name.startsWith('mixamorig')) this.nodes[o.name.slice(9)] = o; });
    this.root.updateMatrixWorld(true);
    // face +Z: the character's left hand belongs on +X
    const lx = this.nodes.LeftArm.getWorldPosition(_v).x, rx = this.nodes.RightArm.getWorldPosition(new THREE.Vector3()).x;
    if (lx < rx) this.root.rotation.y += Math.PI;
    this.root.updateMatrixWorld(true);
    this.restQ = {};
    this.restPos = {};
    for (const [name, node] of Object.entries(this.nodes)) {
      this.restQ[name] = node.getWorldQuaternion(new THREE.Quaternion());
      this.restPos[name] = node.getWorldPosition(new THREE.Vector3());
    }
    this.mixer = new THREE.AnimationMixer(this.root);
    this.corrections = new WeakMap();
    this.world = BONE_ORDER.map(() => new THREE.Quaternion());
    this.delta = BONE_ORDER.map(() => new THREE.Quaternion());
  }

  // Read the current (mixer-evaluated) skeleton into per-bone world deltas from rest.
  read() {
    this.root.updateMatrixWorld(true);
    BONE_ORDER.forEach((name, i) => {
      const m = MAP[name];
      this.nodes[m].getWorldQuaternion(this.world[i]);
      this.delta[i].copy(this.world[i]).multiply(_q.copy(this.restQ[m]).invert());
    });
    this.hipsOffset = this.nodes.Hips.getWorldPosition(new THREE.Vector3()).sub(this.restPos.Hips);
  }

  // Map the last read() onto `rig` as a QPose. Each of our bones gets the source bone's world
  // rotation from rest, pre-composed with a fixed correction that carries our rest direction onto
  // the source's rest direction (so T-pose and A-pose scans both come out right).
  retarget(out, rig) {
    let C = this.corrections.get(rig);
    if (!C) {
      C = BONE_ORDER.map((name) => {
        const child = LIMB_CHILD[name];
        if (!child) return new THREE.Quaternion();
        const src = this.restPos[child].clone().sub(this.restPos[MAP[name]]).normalize();
        return new THREE.Quaternion().setFromUnitVectors(rig.restDir[name], src);
      });
      this.corrections.set(rig, C);
    }
    const W = this.scratchW ??= BONE_ORDER.map(() => new THREE.Quaternion());
    const index = Object.fromEntries(BONE_ORDER.map((n, i) => [n, i]));
    BONE_ORDER.forEach((name, i) => {
      W[i].copy(this.delta[i]).multiply(C[i]);
      const p = PARENT[name];
      if (p) _q.copy(W[index[p]]).invert().multiply(W[i]);
      else _q.copy(W[i]);
      _q.toArray(out.q, i * 4);
    });
    const s = rig.hipsHeight / this.source.hipsHeight, h = this.hipsOffset;
    out.hp[0] = clamp(h.x * s, -0.05, 0.05);
    out.hp[1] = h.y * s;
    out.hp[2] = clamp(h.z * s, -0.06, 0.06);
    return out;
  }
}

// Natural ground speed of an in-place gait clip (how fast the stance foot moves back) and the
// time of left-foot contact (to line walk and run up by phase).
function measureGait(inst, clip) {
  const action = inst.mixer.clipAction(clip);
  action.play();
  const N = 120, dur = clip.duration;
  const foot = [], hips = [];
  for (let i = 0; i <= N; i++) {
    action.time = (i / N) * dur;
    inst.mixer.update(0);
    inst.root.updateMatrixWorld(true);
    hips.push(inst.nodes.Hips.getWorldPosition(new THREE.Vector3()));
    foot.push(inst.nodes.LeftFoot.getWorldPosition(new THREE.Vector3()).sub(hips[i]));
  }
  action.stop();
  inst.mixer.uncacheAction(clip);
  const minY = Math.min(...foot.map((f) => f.y));
  const speeds = [];
  for (let i = 1; i <= N; i++) if (foot[i].y < minY + 0.02 && foot[i - 1].y < minY + 0.02) speeds.push(-(foot[i].z - foot[i - 1].z) / (dur / N));
  speeds.sort((a, b) => a - b);
  const drift = (hips[N].z - hips[0].z) / dur;
  let contact = 0;
  for (let i = 1; i <= N; i++) if (foot[i].z > foot[contact].z) contact = i;
  return { speed: Math.max(0.3, (speeds[Math.floor(speeds.length / 2)] ?? 1) + drift), duration: dur, contact: contact / N };
}

// Locomotion from mocap: idle / walk / run blended by ground speed, gait phase driven by distance
// travelled (so feet don't slide), plus an additive "tired" posture and one-shot head gestures.
export class Locomotion {
  constructor(source, { tired = 0 } = {}) {
    this.source = source;
    this.m = new MocapInstance(source);
    const c = source.clips;
    this.idle = this.m.mixer.clipAction(c.idle ?? c.Idle);
    this.walk = this.m.mixer.clipAction(c.walk ?? c.Walk);
    this.run = this.m.mixer.clipAction(c.run ?? c.Run);
    this.gait = { walk: source.metrics.walk ?? source.metrics.Walk, run: source.metrics.run ?? source.metrics.Run };
    for (const a of [this.idle, this.walk, this.run]) { a.play(); a.setEffectiveWeight(0); }
    this.walk.timeScale = this.run.timeScale = 0; // driven by phase
    if (c.sad_pose) {
      const sad = THREE.AnimationUtils.subclip(c.sad_pose, 'sad', 2, 3, 30);
      THREE.AnimationUtils.makeClipAdditive(sad);
      this.sad = this.m.mixer.clipAction(sad);
      this.sad.blendMode = THREE.AdditiveAnimationBlendMode;
      this.sad.play();
    }
    this.gestures = {};
    for (const g of ['agree', 'headShake']) {
      if (!c[g]) continue;
      const clip = c[g].clone();
      THREE.AnimationUtils.makeClipAdditive(clip);
      const a = this.m.mixer.clipAction(clip);
      a.blendMode = THREE.AdditiveAnimationBlendMode;
      a.setLoop(THREE.LoopOnce, 1);
      this.gestures[g] = a;
    }
    this.tired = tired;
    this.speed = 0;
    this.direction = 1; // -1 plays the gait backwards (walking backwards while strafing)
    this.phase = 0;
    this.scale = 1; // our hips height / source hips height
    this.onStep = null;
  }

  // ground speeds (in our character's metres) at which the walk and run clips play naturally
  get walkSpeed() { return this.gait.walk.speed * this.scale; }
  get runSpeed() { return this.gait.run.speed * this.scale; }

  gesture(name) {
    const a = this.gestures[name];
    if (!a) return;
    a.reset().setEffectiveWeight(1).play();
  }

  update(dt) {
    const s = this.speed, wv = this.walkSpeed, rv = this.runSpeed;
    const wIdle = 1 - smooth(0.05, wv * 0.55, s);
    const wRun = smooth(wv * 1.05, rv * 0.95, s);
    const wWalk = Math.max(0, 1 - wIdle - wRun);
    this.idle.setEffectiveWeight(wIdle);
    this.walk.setEffectiveWeight(wWalk);
    this.run.setEffectiveWeight(wRun);
    this.sad?.setEffectiveWeight(this.tired * (1 - 0.5 * wRun));
    // one gait cycle covers speed * duration metres; blend the cycle length between walk and run
    const cycle = THREE.MathUtils.lerp(wv * this.gait.walk.duration, rv * this.gait.run.duration, wRun / Math.max(1e-3, wWalk + wRun));
    const before = this.phase, step = (this.direction * dt * Math.max(s, 0.08)) / cycle;
    this.phase = (((this.phase + step) % 1) + 1) % 1;
    this.walk.time = ((this.phase + this.gait.walk.contact) % 1) * this.gait.walk.duration;
    this.run.time = ((this.phase + this.gait.run.contact) % 1) * this.gait.run.duration;
    // footsteps at the two contacts per cycle (crossed in either direction)
    const unwrapped = before + step;
    if (wIdle < 0.7) for (const c of [0, 0.5, 1]) if ((before < c && unwrapped >= c) || (before > c && unwrapped <= c)) this.onStep?.(wRun > 0.5 ? 'run' : 'walk');
    this.m.mixer.update(dt);
    this.m.read();
  }

  sample(out, rig) { return this.m.retarget(out, rig); }
}

// A single looping mocap clip (e.g. the dad's idle in the dream).
export class MocapClip {
  constructor(source, name, { timeScale = 1 } = {}) {
    this.m = new MocapInstance(source);
    this.action = this.m.mixer.clipAction(source.clips[name]);
    this.action.timeScale = timeScale;
    this.action.play();
  }
  update(dt) { this.m.mixer.update(dt); this.m.read(); }
  sample(out, rig) { return this.m.retarget(out, rig); }
}
