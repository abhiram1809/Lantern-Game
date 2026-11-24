// Ground that isn't level (the map rework, 2026-11-24): the hills, the beach going down to the sea, the banks of the
// bay and the river. Square tiles of it on the level ground's lattice (Ground.js, Ferris.js: the level tiles are
// one quad each, these are their own grids), each drawn at the detail its distance from the camera wants: a vertex
// every 2 metres near (the hills' road beds and terraces exact), every 5 out to 760 m, every 10 beyond. All of it
// one BatchedMesh, one draw: the two far levels of every tile kept, the near ones a pool of slots rebuilt as the
// camera moves (a few a frame, nearest first; a tile shows its middle level until its near one's built). Each level
// has a skirt hanging from its edges, so no crack shows where neighbours differ. Normals come from the height
// function at the near level's spacing, so a tile shades the same at every level.
import * as THREE from 'three';

const _cam = new THREE.Vector3();

function gridIndex(n) {
  // the grid's two triangles a cell, then the skirt's strip round it
  const idx = [], row = n + 1, ring = row * row;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * row + i, b = a + 1, c = a + row, d = c + 1; idx.push(a, c, b, b, c, d); }
  const edge = border(n);
  for (let k = 0; k < edge.length; k++) {
    const a = edge[k], b = edge[(k + 1) % edge.length], sa = ring + k, sb = ring + ((k + 1) % edge.length);
    idx.push(a, b, sa, b, sb, sa);
  }
  return idx;
}
// the grid's edge vertices, round it (one way round: the skirt's faces all face out)
function border(n) {
  const row = n + 1, out = [];
  for (let i = 0; i < n; i++) out.push(i); // south edge, west to east
  for (let j = 0; j < n; j++) out.push(j * row + n); // east, south to north
  for (let i = n; i > 0; i--) out.push(n * row + i); // north, east to west
  for (let j = n; j > 0; j--) out.push(j * row); // west, north to south
  return out;
}

export class ReliefTiles {
  // tiles: [{ x0, z0 }] each `size` square, in the frame the mesh stands in (`origin`); height(x, z, level) there; uv(x, z)
  // the material's texture coordinates there; levels: subdivisions a tile, near to far
  constructor({ material, tiles, size, height, uv, origin = new THREE.Vector3(), levels = [50, 20, 10], near = 260, mid = 760, pool = 40, skirt = 2.5, name = 'relief', castShadow = false }) {
    Object.assign(this, { material, tiles, size, height, uv, origin, levels, near, mid, pool, skirt });
    this.index = levels.map((n) => gridIndex(n));
    this.counts = levels.map((n) => (n + 1) * (n + 1) + 4 * n);
    this.name = name;
    this.castShadow = castShadow;
    this.mesh = null;
  }

  // one tile at one level: positions, normals (from heights a near step apart), texture coordinates
  geometry(t, level) {
    const n = this.levels[level], s = this.size / n, h = this.size / this.levels[0], H = this.height;
    const row = n + 1, nv = this.counts[level], pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    // heights on the grid and a ring round it (for the normals), at this level's step; the near level's normals are
    // its own neighbours', the others' sampled a near step either side
    const own = level === 0, R = own ? n + 3 : n + 1, hs = new Float32Array(R * R), o = own ? 1 : 0;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) hs[j * R + i] = H(t.x0 + (i - o) * s, t.z0 + (j - o) * s, level);
    let y0 = Infinity, y1 = -Infinity;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * row + i, x = t.x0 + i * s, z = t.z0 + j * s, y = hs[(j + o) * R + i + o];
      let gx, gz;
      if (own) { gx = (hs[(j + 1) * R + i + 2] - hs[(j + 1) * R + i]) / (2 * h); gz = (hs[(j + 2) * R + i + 1] - hs[j * R + i + 1]) / (2 * h); }
      else { gx = (H(x + h, z, level) - H(x - h, z, level)) / (2 * h); gz = (H(x, z + h, level) - H(x, z - h, level)) / (2 * h); }
      const l = Math.hypot(gx, 1, gz);
      pos.set([x, y, z], k * 3);
      nor.set([-gx / l, 1 / l, -gz / l], k * 3);
      uv.set(this.uv(x, z), k * 2);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    // the skirt: the edge again, hanging down
    const edge = border(n), ring = row * row;
    edge.forEach((e, q) => {
      const k = ring + q;
      pos.set([pos[e * 3], pos[e * 3 + 1] - this.skirt, pos[e * 3 + 2]], k * 3);
      nor.set([nor[e * 3], nor[e * 3 + 1], nor[e * 3 + 2]], k * 3);
      uv.set([uv[e * 2], uv[e * 2 + 1]], k * 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(this.index[level]);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(t.x0, y0 - this.skirt, t.z0), new THREE.Vector3(t.x0 + this.size, y1, t.z0 + this.size));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    t.y1 = Math.max(t.y1 ?? -Infinity, y1);
    return g;
  }

  // the far levels of every tile, a few tiles a step (city/Slice.js), and the near level's pool
  *build() {
    const nt = this.tiles.length, [c0, c1, c2] = this.counts, [i0, i1, i2] = this.index.map((x) => x.length);
    const mesh = (this.mesh = new THREE.BatchedMesh(nt * 2 + this.pool, nt * (c1 + c2) + this.pool * c0, nt * (i1 + i2) + this.pool * i0, this.material));
    mesh.name = this.name;
    mesh.position.copy(this.origin);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // (its tiles are culled one by one)
    mesh.perObjectFrustumCulled = true;
    mesh.sortObjects = false;
    mesh.receiveShadow = true;
    mesh.castShadow = this.castShadow;
    for (let k = 0; k < nt; k++) {
      const t = this.tiles[k];
      t.k = k;
      t.ids = [null, mesh.addInstance(mesh.addGeometry(this.geometry(t, 1))), mesh.addInstance(mesh.addGeometry(this.geometry(t, 2)))];
      mesh.setVisibleAt(t.ids[1], false);
      t.level = 2;
      t.slot = null;
      if (k % 8 === 7) yield;
    }
    yield;
    // (a placeholder fills each slot's room till it's needed)
    const blank = this.geometry(this.tiles[0], 0);
    this.slots = [];
    for (let i = 0; i < this.pool; i++) {
      const gid = mesh.addGeometry(blank, c0, i0), iid = mesh.addInstance(gid);
      mesh.setVisibleAt(iid, false);
      this.slots.push({ gid, iid, tile: null });
    }
    this.camAt = new THREE.Vector3(1e9, 0, 0);
    return mesh;
  }

  // how near a tile is: across to its nearest edge, and up from its highest point
  dist(t, p) {
    const dx = Math.max(t.x0 - p.x, 0, p.x - t.x0 - this.size), dz = Math.max(t.z0 - p.z, 0, p.z - t.z0 - this.size);
    return Math.hypot(dx, dz, Math.max(0, p.y - (t.y1 ?? 0)));
  }
  show(t, level) {
    const m = this.mesh;
    if (t.level === level) return;
    if (t.level === 1 || t.level === 2) m.setVisibleAt(t.ids[t.level], false);
    else if (t.level === 0 && t.slot) m.setVisibleAt(t.slot.iid, false);
    t.level = level;
    m.setVisibleAt(level === 0 ? t.slot.iid : t.ids[level], true);
  }
  release(s) {
    const t = s.tile;
    this.mesh.setVisibleAt(s.iid, false);
    if (t) { if (t.level === 0) t.level = null; t.slot = null; }
    s.tile = null;
  }
  // each frame: the level each tile wants (with a margin either way, so one doesn't flick between two), the
  // nearest few that want the near level and haven't got it built into the slots furthest from the camera
  update(camera, budget = 3) {
    if (!this.mesh) return;
    _cam.copy(camera.position).sub(this.origin);
    if (_cam.distanceToSquared(this.camAt) < 4 && !this.pending) return;
    this.camAt.copy(_cam);
    const want = [];
    for (const t of this.tiles) {
      const d = (t.d = this.dist(t, _cam)), cur = t.level;
      const lv = d < this.near + (cur === 0 ? 30 : 0) ? 0 : d < this.mid + (cur === 2 ? 0 : 30) ? 1 : 2;
      if (lv === 0) {
        if (t.slot) this.show(t, 0);
        else { want.push(t); this.show(t, 1); }
      } else {
        if (t.slot) this.release(t.slot);
        this.show(t, lv);
      }
    }
    want.sort((a, b) => a.d - b.d);
    let built = 0;
    for (const t of want) {
      if (built >= (want.length > 10 ? budget * 3 : budget)) break;
      let s = this.slots.find((q) => !q.tile);
      if (!s) {
        // the slot of the furthest tile that has one, if it's further than this
        let far = null;
        for (const q of this.slots) if (!far || q.tile.d > far.tile.d) far = q;
        if (!far || far.tile.d <= t.d) continue;
        const ft = far.tile;
        this.release(far);
        this.show(ft, ft.d < this.mid ? 1 : 2);
        s = far;
      }
      this.mesh.setGeometryAt(s.gid, this.geometry(t, 0));
      s.tile = t;
      t.slot = s;
      this.show(t, 0);
      built++;
    }
    this.pending = want.length > built;
  }
}
