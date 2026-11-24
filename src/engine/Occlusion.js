// Occlusion culling (the perf pass, 2026-11-23): from down in a street most of the city is behind the buildings
// that line it, and was drawn anyway. A scene with an `Occlusion` (`scene.userData.occlusion`) has its big pieces
// (Coast City's streamed blocks) tested each frame as the scene's drawn: each one's box drawn invisibly after
// everything opaque, against the depth that left, a GPU query counting whether any of it showed (in the same
// render as the scene, so its multisampled picture is resolved once: Engine's ScenePass). The
// answer comes a frame or two later; a piece is hidden after two answers in a row found it covered, and shown
// again as soon as one sees any of it, or when it's out of view (so it's there when the camera turns back),
// or when the camera's inside its box, or after a cut.
import * as THREE from 'three';

const _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4();

export class Occlusion {
  // (`scene`: where the boxes are drawn, last of its opaque things)
  constructor(renderer, scene) {
    this.gl = renderer.getContext();
    this.group = new THREE.Group();
    this.group.name = 'occlusion';
    scene.add(this.group);
    this.mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.items = new Set();
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.on = true;
  }

  // a piece: its world box, and `set(visible)` to show or hide it
  add(box, set) {
    const it = { box: box.clone().expandByScalar(1.5), set, visible: true, covered: 0, query: null, mesh: null };
    const m = (it.mesh = new THREE.Mesh(this.geo, this.mat));
    it.box.getCenter(m.position);
    it.box.getSize(m.scale);
    m.updateMatrixWorld(true);
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    m.visible = false;
    m.renderOrder = 1e6; // (after every opaque thing: against all the depth they leave)
    m.onBeforeRender = () => { if (it.ask) { it.query = this.gl.createQuery(); this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE, it.query); } };
    m.onAfterRender = () => { if (it.ask) { this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED_CONSERVATIVE); it.ask = false; } };
    this.group.add(m);
    this.items.add(it);
    return it;
  }

  remove(it) {
    if (!it) return;
    if (it.query) this.gl.deleteQuery(it.query);
    it.mesh.removeFromParent();
    this.items.delete(it);
  }

  show(it, v) { if (it.visible !== v) { it.visible = v; it.set(v); } }

  // before the scene's drawn: the answers that are in, then which boxes ask again as it's drawn
  ask(camera) {
    const gl = this.gl, cam = camera.position, cut = cam.distanceToSquared(this.last) > 400;
    this.last.copy(cam);
    _frustum.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const it of this.items) {
      if (it.query && gl.getQueryParameter(it.query, gl.QUERY_RESULT_AVAILABLE)) {
        const seen = gl.getQueryParameter(it.query, gl.QUERY_RESULT) > 0;
        gl.deleteQuery(it.query);
        it.query = null;
        it.covered = seen ? 0 : it.covered + 1;
        if (seen) this.show(it, true);
        else if (it.covered >= 2) this.show(it, false);
      }
      const inView = _frustum.intersectsBox(it.box), inside = it.box.containsPoint(cam);
      if (!this.on || cut || inside || !inView) { this.show(it, true); it.covered = 0; it.mesh.visible = false; continue; }
      it.mesh.visible = !it.query; // (one question at a time)
      it.ask = !it.query;
    }
    this.after?.(); // (what follows from the pieces shown and hidden: Stream.js, its batches)
  }
}
