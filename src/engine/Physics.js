import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };
export const initPhysics = () => RAPIER.init();

const _v = new THREE.Vector3();

// One Rapier world per scene. Dynamic bodies are paired with meshes and synced after each step.
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.dynamics = [];
  }

  fixedBox(position, half, rotation) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    if (rotation) desc.setRotation(rotation);
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setFriction(0.8), body);
    return body;
  }

  fixedCollider(colliderDesc, position = { x: 0, y: 0, z: 0 }, rotation) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    if (rotation) desc.setRotation(rotation);
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(colliderDesc, body);
    return body;
  }

  // Flat ground `size` metres square about the origin, as a heightfield. A box this big lets the
  // character controller sink in as it walks (by about 9 cm on a 600 m box, then it sticks): the
  // box's queries lose precision with its size, while a heightfield's cells stay local.
  fixedGround(size, y = 0, cells = Math.ceil(size / 10)) {
    const heights = new Float32Array((cells + 1) * (cells + 1));
    return this.fixedCollider(RAPIER.ColliderDesc.heightfield(cells, cells, heights, { x: size, y: 1, z: size }).setFriction(0.8), { x: 0, y, z: 0 });
  }

  // Collider for a static mesh's world-space triangles.
  fixedTrimesh(mesh) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.index ? mesh.geometry : mesh.geometry.toNonIndexed();
    const pos = geo.attributes.position;
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      verts.set([_v.x, _v.y, _v.z], i * 3);
    }
    const indices = geo.index ? new Uint32Array(geo.index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
    return this.fixedCollider(RAPIER.ColliderDesc.trimesh(verts, indices).setFriction(0.9));
  }

  dynamic(mesh, colliderDesc, { density = 1, damping = 0.1, angularDamping = 0.2, friction = 0.7, restitution = 0.1 } = {}) {
    mesh.updateMatrixWorld(true);
    const p = mesh.getWorldPosition(new THREE.Vector3());
    const q = mesh.getWorldQuaternion(new THREE.Quaternion());
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation(q)
        .setLinearDamping(damping)
        .setAngularDamping(angularDamping)
        .setCanSleep(true),
    );
    this.world.createCollider(colliderDesc.setDensity(density).setFriction(friction).setRestitution(restitution), body);
    this.dynamics.push({ body, mesh });
    return body;
  }

  dynamicBox(mesh, half, opts) {
    return this.dynamic(mesh, RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), opts);
  }

  // Outward push from a point, e.g. the green light bursting in or an explosion.
  burst(center, strength, radius, lift = 0, spin = 0.3) {
    for (const { body } of this.dynamics) {
      const t = body.translation();
      _v.set(t.x - center.x, t.y - center.y, t.z - center.z);
      const d = _v.length();
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      _v.normalize().multiplyScalar(strength * falloff * body.mass());
      _v.y += lift * falloff * body.mass();
      body.applyImpulse(_v, true);
      body.applyTorqueImpulse({ x: (Math.random() - 0.5) * spin * body.mass(), y: (Math.random() - 0.5) * spin * body.mass(), z: (Math.random() - 0.5) * spin * body.mass() }, true);
    }
  }

  setGravityScale(scale) {
    for (const { body } of this.dynamics) {
      body.setGravityScale(scale, true);
      body.wakeUp();
    }
  }

  step(dt) {
    if (dt < 1e-4) return; // game time stopped
    this.world.timestep = Math.min(1 / 30, dt);
    this.world.step();
    for (const { body, mesh } of this.dynamics) {
      if (body.isSleeping()) continue;
      const t = body.translation(), r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  dispose() {
    this.world.free();
    this.freed = true;
    this.dynamics = [];
  }
}
