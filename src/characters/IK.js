import * as THREE from 'three';

const _pw = new THREE.Quaternion(), _pwi = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
const _d = new THREE.Vector3(), _bend = new THREE.Vector3(), _knee = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _endWorld = new THREE.Quaternion(), _rw = new THREE.Quaternion();

// Rotate a bone by a world-space rotation q (pre-multiplied in world space).
export function rotateBoneWorld(bone, q) {
  bone.parent.getWorldQuaternion(_pw);
  _pwi.copy(_pw).invert();
  // L' = Pw^-1 * q * Pw * L   (own scratch, so callers may pass any temporary as q)
  bone.quaternion.premultiply(_rw.copy(_pwi).multiply(q).multiply(_pw));
}

// Analytic two-bone IK in world space. Moves the end joint of upper → lower → end toward `target`
// (blended by `weight`), bending in the plane of `pole` (a world direction the middle joint should
// point toward). keepEnd keeps the end bone's world orientation (feet stay flat, hands stay set).
export function solveTwoBone(upper, lower, end, target, pole, weight = 1, keepEnd = false) {
  upper.updateMatrixWorld(true);
  upper.getWorldPosition(_a);
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  if (keepEnd) end.getWorldQuaternion(_endWorld);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(_c).lerp(target, weight);
  _d.subVectors(_t, _a);
  const dist = Math.min(Math.max(_d.length(), Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.9995);
  _d.normalize();
  // bend direction: the pole, made perpendicular to the reach direction
  _bend.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_bend.lengthSq() < 1e-8) _bend.subVectors(_b, _a).addScaledVector(_d, -_u.subVectors(_b, _a).dot(_d));
  _bend.normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _knee.copy(_a).addScaledVector(_d, l1 * cosA).addScaledVector(_bend, l1 * sinA);
  // upper bone: swing its current direction onto the new middle joint
  _u.subVectors(_b, _a).normalize();
  _w.subVectors(_knee, _a).normalize();
  rotateBoneWorld(upper, _q.setFromUnitVectors(_u, _w));
  upper.updateMatrixWorld(true);
  // lower bone: swing onto the target
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  _u.subVectors(_c, _b).normalize();
  _w.subVectors(_a.copy(_t), _b).normalize();
  rotateBoneWorld(lower, _q.setFromUnitVectors(_u, _w));
  lower.updateMatrixWorld(true);
  if (keepEnd) {
    lower.getWorldQuaternion(_pw);
    end.quaternion.copy(_pw.invert().multiply(_endWorld));
    end.updateMatrixWorld(true);
  }
}
