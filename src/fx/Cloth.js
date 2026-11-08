import * as THREE from 'three';

// Verlet cloth hung from its top edge (curtains). Wind is a vector plus gusty noise; an optional
// plane keeps the cloth on one side of a wall.
export class Cloth {
  constructor({ width, height, segX = 10, segY = 16, material, wallX = null }) {
    this.segX = segX; this.segY = segY;
    this.geometry = new THREE.PlaneGeometry(width, height, segX, segY);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const pos = this.geometry.attributes.position;
    this.n = pos.count;
    this.p = new Float32Array(this.n * 3);
    this.prev = new Float32Array(this.n * 3);
    this.rest = new Float32Array(this.n * 3);
    this.pinned = new Uint8Array(this.n);
    this.wind = new THREE.Vector3();
    this.gust = 0;
    this.wallX = wallX;
    this.constraints = [];
    const idx = (x, y) => y * (segX + 1) + x;
    for (let y = 0; y <= segY; y++) for (let x = 0; x <= segX; x++) {
      if (x < segX) this.constraints.push([idx(x, y), idx(x + 1, y), width / segX]);
      if (y < segY) this.constraints.push([idx(x, y), idx(x, y + 1), height / segY]);
      if (y === 0) this.pinned[idx(x, y)] = 1;
    }
  }

  // Call after positioning the mesh: converts the rest shape to world space for simulation.
  init() {
    this.mesh.updateMatrixWorld(true);
    const pos = this.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(this.mesh.matrixWorld);
      // a few soft folds (toward the room) so it hangs like fabric
      const col = i % (this.segX + 1);
      this.p.set([v.x - Math.abs(Math.sin(col * 1.3)) * 0.04, v.y, v.z], i * 3);
    }
    this.prev.set(this.p);
    this.rest.set(this.p);
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.scale.set(1, 1, 1);
  }

  update(dt, t) {
    dt = Math.min(dt, 1 / 30);
    const p = this.p, q = this.prev;
    const gust = 0.5 + 0.5 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1);
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;
      const wy = p[j + 1];
      const fx = this.wind.x * (0.4 + gust) + Math.sin(t * 3 + wy * 4) * this.gust;
      const fz = this.wind.z * (0.4 + gust) + Math.cos(t * 2.3 + wy * 3 + i) * this.gust;
      for (let a = 0; a < 3; a++) {
        const acc = a === 1 ? -9.81 + this.wind.y : a === 0 ? fx : fz;
        const cur = p[j + a];
        p[j + a] += (cur - q[j + a]) * 0.985 + acc * dt * dt;
        q[j + a] = cur;
      }
    }
    for (let it = 0; it < 6; it++) {
      for (const [a, b, len] of this.constraints) {
        const ja = a * 3, jb = b * 3;
        const dx = p[jb] - p[ja], dy = p[jb + 1] - p[ja + 1], dz = p[jb + 2] - p[ja + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - len) / d;
        const wa = this.pinned[a] ? 0 : this.pinned[b] ? 1 : 0.5, wb = this.pinned[b] ? 0 : this.pinned[a] ? 1 : 0.5;
        p[ja] += dx * diff * wa; p[ja + 1] += dy * diff * wa; p[ja + 2] += dz * diff * wa;
        p[jb] -= dx * diff * wb; p[jb + 1] -= dy * diff * wb; p[jb + 2] -= dz * diff * wb;
      }
      if (this.wallX !== null) for (let i = 0; i < this.n; i++) if (p[i * 3] > this.wallX) p[i * 3] = this.wallX;
    }
    const pos = this.geometry.attributes.position;
    pos.array.set(p);
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
