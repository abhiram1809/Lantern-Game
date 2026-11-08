import * as THREE from 'three';
import { tween, ease, damp } from './Time.js';

// Owns the camera. In 'follow' mode the player writes the desired pose each frame; in
// 'shot' mode cinematic moves do. Handheld drift and shake are layered on top.
export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'shot';
    this.pos = new THREE.Vector3(0, 1.6, 3);
    this.look = new THREE.Vector3(0, 1.4, 0);
    this.fov = 55;
    this.handheld = 0.6;
    this.shakeAmount = 0;
    this.target = null; // optional Object3D/function to keep looking at
    this._q = new THREE.Vector3();
  }

  // Each cut or move supersedes any move still running.
  cut(pos, look, fov) {
    this.mode = 'shot';
    this.shot = (this.shot ?? 0) + 1;
    this.pos.copy(pos);
    this.look.copy(look);
    if (fov) this.fov = fov;
  }

  move(pos, look, duration = 2, easing = ease.inOut, fov) {
    this.mode = 'shot';
    const id = (this.shot = (this.shot ?? 0) + 1);
    const p0 = this.pos.clone(), l0 = this.look.clone(), f0 = this.fov;
    return tween(duration, (k) => {
      if (id !== this.shot) return;
      this.pos.lerpVectors(p0, pos, k);
      this.look.lerpVectors(l0, look, k);
      if (fov) this.fov = f0 + (fov - f0) * k;
    }, easing);
  }

  // Arc around a centre point (for orbiting shots).
  orbit(center, radius, height, fromAngle, toAngle, duration, lookOffset = new THREE.Vector3()) {
    this.mode = 'shot';
    const id = (this.shot = (this.shot ?? 0) + 1);
    return tween(duration, (k) => {
      if (id !== this.shot) return;
      const a = fromAngle + (toAngle - fromAngle) * k;
      this.pos.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
      this.look.copy(center).add(lookOffset);
    }, ease.inOut);
  }

  shake(amount = 0.3, duration = 0.8) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeDecay = amount / duration;
  }

  update(dt, t) {
    const c = this.camera;
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = damp(c.fov, this.fov, 6, dt); c.updateProjectionMatrix(); }
    c.position.copy(this.pos);
    const h = this.handheld * (this.mode === 'shot' ? 1 : 0.25);
    const s = this.shakeAmount;
    c.position.x += (Math.sin(t * 0.9) * 0.012 + Math.sin(t * 2.3) * 0.004) * h + (Math.random() - 0.5) * 0.06 * s;
    c.position.y += (Math.sin(t * 1.3 + 1) * 0.008) * h + (Math.random() - 0.5) * 0.06 * s;
    c.lookAt(this.look);
    if (s > 0) this.shakeAmount = Math.max(0, s - (this.shakeDecay ?? 1) * dt);
  }
}
