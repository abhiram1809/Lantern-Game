import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { solveTwoBone } from '../characters/IK.js';
import { makePose } from '../characters/Poses.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Sinestro's statue on Korugar (Part Five's plaza; pulled down in Part Six). His own figure
// (Characters.createSinestro, in his own metres) posed as he stands, chin up and his hands clasped
// behind his back (the arm IK to the stance his live self uses: the parameter pose alone left the
// hands splayed flat at his sides, the user's "weird hands"), then baked into stone: the skinned
// figure's vertices and normals run through its bones once on the CPU into plain meshes, and cut in
// three, at the ankles and through the neck (by the bind pose's height), so that when he comes down
// the feet stay on the pedestal and the head breaks off and rolls.
//
// The fall is simulated, not keyed: a small Rapier world of its own (the plaza, the pedestal's
// steps, drum and cap, the feet as fixed blocks) with the body a box for the legs and one for the
// torso and arms, the head a ball fixed to it until it nears the ground, then let go with its share of
// the motion. Its own world so the chapter's fall and free roam's fallen statue are the same: free
// roam runs the same simulation to its end at once (`settle()`).
export const STATUE_SCALE = 14 / 1.96; // fourteen metres of him
const CUT = { ankle: 0.165, neck: 1.645 }; // the bind pose's heights of the two breaks
// his hands behind him (Sinestro.js's `behind` stance, his metres), the elbows out and back
const BEHIND = { L: V(0.06, 1.06, -0.27), R: V(-0.06, 1.08, -0.27), poleL: V(0.9, -0.1, -0.7), poleR: V(-0.9, -0.1, -0.7) };

// The posed figure, baked: { parts: { feet, body, head } (groups, his metres, origin at his feet),
// joints (posed joint positions, same frame) }.
export function bakeStatue(rig, stoneFor) {
  rig.apply(makePose({ nx: -0.16, kx: -0.04, sx: -0.03, cx: -0.02, lLz: 0.07, lRz: -0.07 }));
  rig.root.updateMatrixWorld(true);
  const b = rig.bones;
  for (const s of ['L', 'R']) {
    solveTwoBone(b[`upperArm_${s}`], b[`foreArm_${s}`], b[`hand_${s}`], BEHIND[s], BEHIND[`pole${s}`], 1);
    rig.root.updateMatrixWorld(true);
  }
  const joints = Object.fromEntries(Object.keys(b).map((n) => [n, b[n].getWorldPosition(V(0, 0, 0))]));
  const parts = { feet: new THREE.Group(), body: new THREE.Group(), head: new THREE.Group() };
  const v = V(0, 0, 0), w = V(0, 0, 0), base = V(0, 0, 0);
  for (const m of rig.meshes) {
    m.skeleton.update();
    m.updateMatrixWorld(true);
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, idx = g.index.array, n = P.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      base.fromBufferAttribute(P, i);
      v.copy(base);
      m.applyBoneTransform(i, v);
      v.applyMatrix4(m.matrixWorld);
      // the normal: a point a millimetre out along it, run through the same bones
      w.fromBufferAttribute(N, i).multiplyScalar(0.001).add(base);
      m.applyBoneTransform(i, w);
      w.applyMatrix4(m.matrixWorld).sub(v).normalize();
      pos.set([v.x, v.y, v.z], i * 3);
      nor.set([w.x, w.y, w.z], i * 3);
    }
    // each triangle to its piece: the feet below the ankles (by the bind pose's height), the head by
    // its bone (a cut by height took the collar's flaps with it), the rest the body
    const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, HEAD = 4;
    const onHead = (i) => { let w = 0; for (let c = 0; c < 4; c++) if (SI.getComponent(i, c) === HEAD) w += SW.getComponent(i, c); return w > 0.6; };
    const tris = { feet: [], body: [], head: [] };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b2 = idx[t + 1], c = idx[t + 2], y = (P.getY(a) + P.getY(b2) + P.getY(c)) / 3;
      const head = y > CUT.neck - 0.1 && (onHead(a) + onHead(b2) + onHead(c)) >= 2;
      tris[y < CUT.ankle ? 'feet' : head ? 'head' : 'body'].push(a, b2, c);
    }
    for (const [name, list] of Object.entries(tris)) {
      if (!list.length) continue;
      const remap = new Map(), p2 = [], n2 = [], uv2 = [];
      const ix = list.map((i) => {
        if (!remap.has(i)) {
          remap.set(i, remap.size);
          p2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          n2.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
          if (UV) uv2.push(UV.getX(i), UV.getY(i));
        }
        return remap.get(i);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(n2, 3));
      if (UV) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv2, 2));
      geo.setIndex(ix);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, stoneFor(m));
      mesh.castShadow = mesh.receiveShadow = true;
      parts[name].add(mesh);
    }
  }
  // the breaks: rough plugs of broken stone over the cut ends (the meshes are open there)
  const rough = new THREE.MeshStandardMaterial({ color: 0x7d7569, roughness: 0.95, flatShading: true });
  // (jagged: a smooth flattened ball read as a coin stuck on the neck)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const plug = (at, r, h) => {
    const d = new THREE.DodecahedronGeometry(1, 1);
    d.deleteAttribute('normal'); d.deleteAttribute('uv');
    const geo = mergeVertices(d), P = geo.attributes.position; // (welded, so the jitter can't open the faces)
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i);
      const j = 0.7 + rnd() * 0.6;
      P.setXYZ(i, _v.x * r * j, _v.y * h * (0.6 + rnd() * 1.6), _v.z * r * j);
    }
    geo.computeVertexNormals();
    const p = new THREE.Mesh(geo, rough);
    p.position.copy(at);
    p.castShadow = true;
    return p;
  };
  const neckAt = joints.head.clone().lerp(joints.neck, 0.15);
  parts.head.add(plug(neckAt, 0.085, 0.03));
  parts.body.add(plug(neckAt.clone().add(V(0, -0.005, 0)), 0.088, 0.028));
  for (const s of ['L', 'R']) {
    const a = joints[`foot_${s}`].clone().setY(CUT.ankle);
    parts.feet.add(plug(a, 0.07, 0.02));
    parts.body.add(plug(a.clone().add(V(0, 0.004, 0)), 0.072, 0.022));
  }
  for (const g of Object.values(parts)) g.userData.box = new THREE.Box3().setFromObject(g);
  return { parts, joints };
}

// The fall. `start` is the figure's pose as the pull leaves it (position, quaternion, scale); the
// world's colliders are the plaza and the pedestal. step(dt) advances it; `events` fire once each:
// 'crack' (the ankles go), 'head' (the head breaks off, near the ground), 'impact' (the body lands:
// { at, k } its strength). `done` once it's settled.
export class StatueFall {
  constructor(fig, { pedestal, pivot, rest, angle, scale, spin = 0.22, pull = 5, release = 0.75, onEvent = null }) {
    Object.assign(this, { fig, onEvent, pivot, rest, k: scale, pull, release });
    const w = (this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
    w.timestep = 1 / 60;
    // the plaza, and the pedestal: [radius, bottom, top] tiers (polished stone: he slides off it)
    w.createCollider(RAPIER.ColliderDesc.cuboid(200, 1, 200).setTranslation(0, -1, 0).setFriction(0.9));
    for (const [r, y0, y1] of pedestal) w.createCollider(RAPIER.ColliderDesc.cylinder((y1 - y0) / 2, r).setTranslation(0, (y0 + y1) / 2, 0).setFriction(0.3));
    const k = scale, box = (g) => g.userData.box;
    // the feet stay where they stood (flat again: the break lets them settle back)
    const fb = box(fig.parts.feet), fc = fb.getCenter(V(0, 0, 0)), fs = fb.getSize(V(0, 0, 0));
    w.createCollider(RAPIER.ColliderDesc.cuboid(fs.x * k / 2, fs.y * k / 2, fs.z * k / 2).setTranslation(rest.x + fc.x * k, rest.y + fc.y * k, rest.z + fc.z * k).setFriction(0.9));
    // the body's shape (made when it's let go): a box for the legs and one for the torso and the
    // arms behind it (in the figure's frame, scaled), a ball for the head
    const bb = box(fig.parts.body), hipY = fig.joints.hips.y;
    const band = (lo, hi) => {
      const b = new THREE.Box3();
      fig.parts.body.traverse((o) => {
        if (!o.isMesh || o.geometry.type !== 'BufferGeometry') return;
        const P = o.geometry.attributes.position;
        for (let i = 0; i < P.count; i += 3) { const y = P.getY(i); if (y >= lo && y <= hi) b.expandByPoint(_v.fromBufferAttribute(P, i)); }
      });
      return b.isEmpty() ? bb.clone() : b;
    };
    this.boxes = [band(CUT.ankle, hipY), band(hipY, CUT.neck)];
    const hb = box(fig.parts.head), hc = hb.getCenter(V(0, 0, 0));
    this.headR = hb.getSize(V(0, 0, 0)).y * 0.42 * k;
    this.headLocal = hc.clone().multiplyScalar(k);
    // first it tips on its toes, pinned there (a rigid rod about its end: theta'' = 3g/2L sin theta),
    // then the ankles give and the chains pull it forward off the cap, and it's free
    this.theta = angle;
    this.omega = spin;
    this.L = (fig.joints.head.y + 0.12) * k;
    this.t = 0;
    this.acc = 0;
    this.fired = new Set();
    this.done = false;
  }

  // the figure's pose tipped by theta about the toes
  pinned(pos, quat) {
    const a = this.theta, d = _p.copy(this.rest).sub(this.pivot);
    pos.set(0, d.y * Math.cos(a) - d.z * Math.sin(a), d.y * Math.sin(a) + d.z * Math.cos(a)).add(this.pivot);
    pos.x = this.rest.x;
    quat.setFromAxisAngle(_X, a);
  }

  letGo() {
    const w = this.world, k = this.k, pos = V(0, 0, 0), quat = new THREE.Quaternion();
    this.pinned(pos, quat);
    // (it tips about one axis, straight out toward the plaza's front: free to turn any way, the
    // contacts' small asymmetries twisted it round and slid it ten metres aside)
    const body = (this.body = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(quat).setAngularDamping(0.05).setLinearDamping(0.02).setCcdEnabled(true).setCanSleep(false).enabledRotations(true, false, false)));
    for (const b of this.boxes) {
      const c = b.getCenter(V(0, 0, 0)), sz = b.getSize(V(0, 0, 0));
      w.createCollider(RAPIER.ColliderDesc.cuboid(sz.x * k * 0.46, sz.y * k * 0.5, sz.z * k * 0.46).setTranslation(c.x * k, c.y * k, c.z * k).setDensity(2.4).setFriction(0.6).setRestitution(0.05), body);
    }
    this.headCol = w.createCollider(RAPIER.ColliderDesc.ball(this.headR).setTranslation(this.headLocal.x, this.headLocal.y, this.headLocal.z).setDensity(2.4).setFriction(0.9).setRestitution(0.12), body);
    // its motion as it leaves the pivot (omega about x, the origin's velocity omega x r), and the pull
    const r = pos.clone().sub(this.pivot);
    body.setAngvel({ x: this.omega, y: 0, z: 0 }, true);
    body.setLinvel({ x: 0, y: -this.omega * r.z, z: this.omega * r.y + this.pull }, true);
  }

  fire(name, data) {
    if (this.fired.has(name)) return;
    this.fired.add(name);
    this.onEvent?.(name, data);
  }

  step(dt) {
    if (this.done) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= 1 / 60 && !this.done) { this.acc -= 1 / 60; this.tick(); }
    this.sync();
  }

  tick() {
    const w = this.world, dt = 1 / 60;
    this.t += dt;
    if (this.t > 0.12) this.fire('crack', {});
    if (!this.body) {
      this.omega += (1.5 * 9.81 / this.L) * Math.sin(this.theta) * dt;
      this.theta += this.omega * dt;
      if (this.theta >= this.release) this.letGo();
      return;
    }
    const body = this.body;
    w.step();
    // the head: off when it's about to meet the plaza, with its share of the body's motion
    if (!this.head) {
      const hp = _p.copy(this.headLocal).applyQuaternion(_q.copy(body.rotation())).add(_v.copy(body.translation()));
      if (hp.y < this.headR + 0.7) {
        const lv = body.linvel(), av = body.angvel(), c = body.translation();
        const r = _w.subVectors(hp, _v2.set(c.x, c.y, c.z)), vel = _v3.set(av.x, av.y, av.z).cross(r).add(_v4.set(lv.x, lv.y, lv.z));
        w.removeCollider(this.headCol, true);
        this.head = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(hp.x, hp.y, hp.z).setRotation(body.rotation()).setLinvel(vel.x + 0.35, vel.y, vel.z * 0.8).setAngvel({ x: av.x * 0.8, y: 0.25, z: -0.35 }).setAngularDamping(0.6).setLinearDamping(0.15).setCcdEnabled(true).setCanSleep(false));
        w.createCollider(RAPIER.ColliderDesc.ball(this.headR).setDensity(2.4).setFriction(0.9).setRestitution(0.18), this.head);
        this.fire('head', { at: hp.clone() });
      }
    }
    // the body down: the first hard stop of its fall
    const lv = body.linvel(), speed = Math.hypot(lv.x, lv.y, lv.z);
    this.peak = Math.max(this.peak ?? 0, speed);
    if (this.head && !this.fired.has('impact') && (this.prevSpeed ?? 0) - speed > 1.6) {
      const c = body.worldCom(); // (his middle, where the dust goes up)
      this.fire('impact', { at: V(c.x, 0, c.z), k: Math.min(1, (this.prevSpeed - speed) / 6) });
    }
    this.prevSpeed = speed;
    // settled: everything still for a moment (or long enough)
    const still = speed < 0.05 && (!this.head || Math.hypot(...Object.values(this.head.linvel())) < 0.05);
    this.stillT = still ? (this.stillT ?? 0) + 1 / 60 : 0;
    if ((this.t > 3 && this.stillT > 0.5) || this.t > 12) { this.done = true; this.fire('settled', {}); }
  }

  // The pieces on their bodies (the figure's groups: origin at his feet, scaled).
  sync() {
    const { body, fig } = this;
    if (!body) {
      this.pinned(fig.parts.body.position, fig.parts.body.quaternion);
      fig.parts.head.position.copy(fig.parts.body.position);
      fig.parts.head.quaternion.copy(fig.parts.body.quaternion);
      return;
    }
    const t = body.translation(), r = body.rotation();
    fig.parts.body.position.set(t.x, t.y, t.z);
    fig.parts.body.quaternion.set(r.x, r.y, r.z, r.w);
    if (this.head) {
      // the head's body sits at its middle: the group's origin is the figure's feet
      const h = this.head.translation(), q = this.head.rotation();
      fig.parts.head.quaternion.set(q.x, q.y, q.z, q.w);
      fig.parts.head.position.set(h.x, h.y, h.z).sub(_p.copy(this.headLocal).applyQuaternion(fig.parts.head.quaternion));
    } else fig.parts.head.position.copy(fig.parts.body.position), fig.parts.head.quaternion.copy(fig.parts.body.quaternion);
  }

  // Run on to the end at once (free roam's statue, already down).
  settle() { while (!this.done) this.tick(); this.sync(); }

  dispose() { this.world.free(); }
}

const _X = new THREE.Vector3(1, 0, 0), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
