import * as THREE from 'three';
import { createSky } from '../fx/Sky.js';
import { Fire, Particles } from '../fx/Particles.js';
import { noiseTexture } from '../fx/Textures.js';
import { buildJet } from './Bedroom.js';

// Childhood memory: the airfield at sunset, seen from eight-year-old Hal's eye level.
export class Dream {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.updaters = [];
  }

  build() {
    const s = this.scene;
    s.fog = new THREE.Fog(0xd9a070, 60, 520);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.5;
    this.sky = createSky('sunset');
    s.add(this.sky);
    const sun = new THREE.DirectionalLight(0xffc48a, 2.4);
    sun.position.set(-10, 8, -60);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 150 });
    sun.shadow.mapSize.set(1024, 1024);
    s.add(sun, new THREE.HemisphereLight(0xffd8b0, 0x5a3a24, 0.9));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#a67c52', spots: 3000, spread: 30, alpha: 0.08, repeat: [60, 60], fine: 0.15 }), roughness: 1 }));
    ground.receiveShadow = true;
    s.add(ground);
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(500, 22).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 }));
    runway.position.set(0, 0.02, -34);
    runway.receiveShadow = true;
    s.add(runway);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 });
    for (let x = -240; x < 240; x += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.4).rotateX(-Math.PI / 2), dashMat);
      d.position.set(x, 0.03, -34);
      s.add(d);
    }
    // hangar and tower
    const metal = new THREE.MeshStandardMaterial({ color: 0x8c8479, metalness: 0.4, roughness: 0.6 });
    const hangar = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 30, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), metal);
    hangar.position.set(-48, 0, -70);
    hangar.castShadow = true;
    s.add(hangar);
    const tower = new THREE.Group();
    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 4), new THREE.MeshStandardMaterial({ color: 0xb9ab95, roughness: 0.9 }));
    towerBase.position.y = 8;
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3, 3, 8), new THREE.MeshStandardMaterial({ color: 0x3d4a55, metalness: 0.6, roughness: 0.2 }));
    cab.position.y = 17.5;
    tower.add(towerBase, cab);
    tower.position.set(38, 0, -78);
    tower.traverse((o) => (o.castShadow = true));
    s.add(tower);
    // fence in the foreground
    const post = new THREE.MeshStandardMaterial({ color: 0x5e5850, metalness: 0.6, roughness: 0.5 });
    for (let x = -30; x <= 30; x += 3) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), post);
      p.position.set(x, 0.9, -7);
      s.add(p);
    }
    for (const y of [0.4, 1.0, 1.6]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 60, 4).rotateZ(Math.PI / 2), post);
      w.position.set(0, y, -7);
      s.add(w);
    }
    // distant mesas
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x7a4e3a, roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(20 + Math.random() * 30, 40 + Math.random() * 40, 18 + Math.random() * 30, 7), mesaMat);
      const a = -Math.PI * 0.85 + (i / 13) * Math.PI * 0.7;
      m.position.set(Math.cos(a) * 380, 8, Math.sin(a) * 380);
      s.add(m);
    }
    this.jet = buildJet({ scale: 1, color: 0xc9ced2 });
    this.jet.position.set(-30, 1.1, -34);
    s.add(this.jet);
    this.dust = new Particles(200, { additive: false, puffy: true, drag: 0.8 });
    s.add(this.dust.points);
    this.crash = new Fire(new THREE.Vector3(160, 0, -300), { radius: 14, rate: 140, height: 18, embers: false });
    this.crash.intensity = 0;
    this.crash.light.distance = 600;
    s.add(this.crash.group);
    return this;
  }

  update(dt, t, camera, renderer) {
    this.sky.userData.uniforms.uTime.value = t;
    this.dust.update(dt, t, camera, renderer);
    this.crash.update(dt, t, camera, renderer);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [o.material ?? []].flat()) m.dispose();
    });
  }
}
