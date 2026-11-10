import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Physics, RAPIER } from '../engine/Physics.js';
import { createSky } from '../fx/Sky.js';
import { Particles } from '../fx/Particles.js';
import { Cloth } from '../fx/Cloth.js';
import { treeKit, foliageMaterial, forest } from '../fx/Trees.js';
import { noiseTexture, woodTexture, fabricTexture, plaidTexture, ClockFace, photoTexture, glowTexture, pbrMaterial } from '../fx/Textures.js';
import { prop, piece, hasProp, meshes, boundsIn, pivot } from '../props/Props.js';
import { makeCar } from '../props/Car.js';

const ROOM = { x0: -2.2, x1: 2.2, z0: -2.0, z1: 2.0, h: 2.6 };
const HALL = { x0: -4.6, x1: 1.2, z0: 2.12, z1: 3.52 };
const DOOR = { x0: -1.75, x1: -0.85, h: 2.05 };
const WALL = 0.12;
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const BED = { x0: -1.825, x1: -0.375, z0: -1.95, z1: 0.1, top: 0.56 };
const WINDOW = { z0: -1.2, z1: 0.5, y0: 0.95, y1: 2.15 };

const box = (w, h, d, mat, r = 0) => new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), mat);

export class Bedroom {
  constructor({ engine, assets }) {
    this.engine = engine;
    this.assets = assets;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
    this.bodyCapsules = null; // set by the story while Hal is in bed
  }

  // `morning`: the morning after the storm (Part Three): sun through the window, no rain, the lamp off.
  build({ morning = false } = {}) {
    const s = this.scene;
    this.morning = morning;
    s.fog = morning ? new THREE.FogExp2(0xbac9d6, 0.005) : new THREE.FogExp2(0x05070a, 0.012);
    s.environment = this.engine.envMap;
    s.environmentIntensity = morning ? 0.32 : 0.12;
    this.materials();
    this.buildShell();
    this.buildKitchen();
    this.buildFurniture();
    this.buildWindow();
    this.buildProps();
    this.buildLights();
    this.buildOutside();
    return this;
  }

  materials() {
    const plaster = noiseTexture({ base: '#c2b6a0', spots: 220, spread: 70, alpha: 0.018, repeat: [2, 1.2], fine: 0.02 });
    this.m = {
      wall: new THREE.MeshStandardMaterial({ map: plaster, color: 0xd8cdb8, roughness: 0.95 }),
      ceiling: new THREE.MeshStandardMaterial({ map: plaster, color: 0xcfc6b5, roughness: 1 }),
      carpet: new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#5a5045', spots: 3000, spread: 10, alpha: 0.08, repeat: [4, 4], fine: 0.22 }), roughness: 1 }),
      floor: new THREE.MeshStandardMaterial({ map: woodTexture({ base: '#6d4c30', repeat: [6, 1.5], planks: 4 }), roughness: 0.55 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTexture({ base: '#8a6a45', repeat: [1, 1] }), roughness: 0.6 }),
      darkWood: new THREE.MeshStandardMaterial({ map: woodTexture({ base: '#4a3424', repeat: [1, 1] }), roughness: 0.55 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.6 }),
      sheet: new THREE.MeshStandardMaterial({ map: fabricTexture({ base: '#7d858a', repeat: [3, 3], weave: 0.04, blotches: 0 }), roughness: 0.95 }),
      blanket: new THREE.MeshStandardMaterial({ map: plaidTexture({ repeat: [2.2, 1.9] }), roughness: 1, side: THREE.DoubleSide }),
      pillow: new THREE.MeshStandardMaterial({ map: fabricTexture({ base: '#a9a69e', repeat: [2, 2], weave: 0.03, blotches: 0 }), roughness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.35 }),
      black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }),
      curtain: new THREE.MeshStandardMaterial({ map: fabricTexture({ base: '#2f4a38', repeat: [2, 4], weave: 0.05, blotches: 0 }), roughness: 0.9, side: THREE.DoubleSide }),
      olive: new THREE.MeshStandardMaterial({ map: fabricTexture({ base: '#4b4f36', repeat: [2, 2] }), roughness: 0.8 }),
      leather: new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.55 }),
    };
  }

  add(mesh, x, y, z, { shadow = true, receive = true, collide = false, parent = this.scene } = {}) {
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    if (collide) {
      const bb = new THREE.Box3().setFromObject(mesh);
      const c = bb.getCenter(new THREE.Vector3()), h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      this.physics.fixedBox(c, h);
    }
    return mesh;
  }

  buildShell() {
    const { m } = this;
    const cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2;
    const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h;
    const floor = this.add(new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), m.carpet), cx, 0, cz, { shadow: false });
    this.physics.fixedBox({ x: cx, y: -0.1, z: cz }, { x: W / 2 + 0.5, y: 0.1, z: D / 2 + 0.5 });
    this.add(box(W + WALL * 2, 0.1, D + WALL * 2, m.ceiling), cx, H + 0.05, cz, { collide: true });
    // back and left walls
    this.add(box(W + WALL * 2, H, WALL, m.wall), cx, H / 2, ROOM.z0 - WALL / 2, { collide: true });
    this.add(box(WALL, H, D, m.wall), ROOM.x0 - WALL / 2, H / 2, cz, { collide: true });
    // right wall with a window opening
    const rx = ROOM.x1 + WALL / 2;
    this.add(box(WALL, H, WINDOW.z0 - ROOM.z0, m.wall), rx, H / 2, (ROOM.z0 + WINDOW.z0) / 2, { collide: true });
    this.add(box(WALL, H, ROOM.z1 - WINDOW.z1, m.wall), rx, H / 2, (WINDOW.z1 + ROOM.z1) / 2, { collide: true });
    this.add(box(WALL, WINDOW.y0, WINDOW.z1 - WINDOW.z0, m.wall), rx, WINDOW.y0 / 2, (WINDOW.z0 + WINDOW.z1) / 2, { collide: true });
    this.add(box(WALL, H - WINDOW.y1, WINDOW.z1 - WINDOW.z0, m.wall), rx, (H + WINDOW.y1) / 2, (WINDOW.z0 + WINDOW.z1) / 2, { collide: true });
    this.physics.fixedBox({ x: rx, y: (WINDOW.y0 + WINDOW.y1) / 2, z: (WINDOW.z0 + WINDOW.z1) / 2 }, { x: WALL / 2, y: (WINDOW.y1 - WINDOW.y0) / 2, z: (WINDOW.z1 - WINDOW.z0) / 2 });
    // front wall with the bedroom door opening (this is also the hallway's back wall)
    const fz = ROOM.z1 + WALL / 2;
    this.add(box(DOOR.x0 - ROOM.x0 + WALL, H, WALL, m.wall), (ROOM.x0 - WALL + DOOR.x0) / 2, H / 2, fz, { collide: true });
    this.add(box(ROOM.x1 + WALL - DOOR.x1, H, WALL, m.wall), (DOOR.x1 + ROOM.x1 + WALL) / 2, H / 2, fz, { collide: true });
    this.add(box(DOOR.x1 - DOOR.x0, H - DOOR.h, WALL, m.wall), (DOOR.x0 + DOOR.x1) / 2, (H + DOOR.h) / 2, fz, { collide: true });
    this.add(box(ROOM.x0 - WALL - HALL.x0 + WALL, H, WALL, m.wall), (HALL.x0 - WALL + ROOM.x0 - WALL) / 2, H / 2, fz, { collide: true });
    // door frame trim
    for (const x of [DOOR.x0 - 0.03, DOOR.x1 + 0.03]) this.add(box(0.06, DOOR.h, WALL + 0.04, m.trim), x, DOOR.h / 2, fz);
    this.add(box(DOOR.x1 - DOOR.x0 + 0.12, 0.07, WALL + 0.04, m.trim), (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.035, fz);
    // the bedroom door, hinged on its east side and swung open flat against the front wall
    const door = box(0.86, 2.0, 0.045, m.trim, 0.01);
    const hinge = new THREE.Group();
    const swing = -Math.PI * 0.94;
    hinge.position.set(DOOR.x1, 0, ROOM.z1 - 0.03);
    door.position.set(-0.43, 1.0, 0);
    door.castShadow = door.receiveShadow = true;
    hinge.add(door);
    hinge.rotation.y = swing;
    this.scene.add(hinge);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), m.metal);
    knob.position.set(-0.78, 0.98, 0.04);
    door.add(knob);
    const dir = new THREE.Vector3(-Math.cos(swing), 0, Math.sin(swing));
    const dc = hinge.position.clone().addScaledVector(dir, 0.43);
    this.physics.fixedBox({ x: dc.x, y: 1, z: dc.z }, { x: 0.43, y: 1, z: 0.03 }, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), swing));
    // skirting boards
    for (const [w, d, x, z] of [[W, 0.02, cx, ROOM.z0 + 0.01], [0.02, D, ROOM.x0 + 0.01, cz], [0.02, D, ROOM.x1 - 0.01, cz]]) this.add(box(w, 0.1, d, m.trim), x, 0.05, z, { shadow: false });

    // Hallway
    const hx = (HALL.x0 + HALL.x1) / 2, hz = (HALL.z0 + HALL.z1) / 2, HW = HALL.x1 - HALL.x0, HD = HALL.z1 - HALL.z0;
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(HW, HD).rotateX(-Math.PI / 2), m.floor), hx, 0, hz, { shadow: false });
    this.physics.fixedBox({ x: hx, y: -0.1, z: hz }, { x: HW / 2 + 0.3, y: 0.1, z: HD / 2 + 0.3 });
    this.add(box(HW, 0.1, HD + WALL, m.ceiling), hx, H + 0.05, hz, { collide: true });
    this.add(box(HW + WALL * 2, H, WALL, m.wall), hx, H / 2, HALL.z1 + WALL / 2, { collide: true });
    this.add(box(WALL, H, HD + WALL * 2, m.wall), HALL.x1 + WALL / 2, H / 2, hz, { collide: true });
    // front door at the west end
    this.add(box(WALL, H, HD + WALL * 2, m.wall), HALL.x0 - WALL / 2, H / 2, hz, { collide: true });
    this.frontDoor = this.add(box(0.05, 2.03, 0.92, m.darkWood, 0.01), HALL.x0 + 0.03, 1.02, hz);
    const fk = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), m.metal);
    fk.position.set(0.04, 0, 0.35);
    this.frontDoor.add(fk);
    // hall table with keys + a framed photo
    this.add(box(0.9, 0.05, 0.35, m.darkWood), -3.4, 0.8, HALL.z1 - 0.2, { collide: true });
    for (const x of [-3.8, -3.0]) this.add(box(0.04, 0.8, 0.3, m.darkWood), x, 0.4, HALL.z1 - 0.2);
    this.add(box(0.08, 0.015, 0.05, m.metal), -3.2, 0.83, HALL.z1 - 0.22);
    // coat hooks
    for (let i = 0; i < 3; i++) this.add(box(0.03, 0.03, 0.1, m.metal), -2.6 + i * 0.25, 1.75, HALL.z1 - 0.05);
    // hall pictures
    const photo = photoTexture();
    for (const [x, w, h] of [[-1.9, 0.4, 0.5], [-0.2, 0.5, 0.36]]) {
      const frame = box(w + 0.05, h + 0.05, 0.03, m.black);
      this.add(frame, x, 1.55, HALL.z1 - 0.02);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: photo, roughness: 0.4 }));
      pic.position.z = -0.017;
      pic.rotation.y = Math.PI;
      frame.add(pic);
    }
  }

  // The kitchenette at the hallway's dead end: a fridge whose door opens (`openFridge`), a counter
  // with a coffee maker and the week's pizza boxes.
  buildKitchen() {
    const { m } = this;
    const enamel = new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.32, metalness: 0.05 });
    const fx = 0.8, fz = HALL.z1 - 0.33, fw = 0.7, fd = 0.62, fh = 1.72;
    if (hasProp('fridge')) this.buildFridge(fx, fz);
    else this.buildBoxFridge(fx, fz, fw, fd, fh, enamel);
    this.buildCounter();
  }

  // The fridge (the downloaded "Old Fridge", CREDITS.md): turned to face the hall, its door (the parts
  // at its front) on a hinge on the side away from the counter, a light inside, the shelves bare
  // but for a bottle of ketchup, half a lemon and a carton.
  buildFridge(fx, fz) {
    const f = prop('fridge');
    f.rotation.y = Math.PI;
    f.position.set(fx, 0, fz);
    this.scene.add(f);
    f.updateMatrixWorld(true);
    const parts = meshes(f, () => true), c = new THREE.Vector3();
    const door = parts.filter((m) => boundsIn(f, [m]).getCenter(c).z > 0.2);
    this.fridgeHinge = pivot(f, door, new THREE.Vector3(-0.35, 0, 0.33));
    this.fridgeSign = -1;
    this.fridgeGlow = 0.28; // its white enamel inside blooms under a brighter bulb
    this.physics.fixedBox({ x: fx, y: 0.76, z: fz }, { x: 0.37, y: 0.76, z: 0.36 });
    this.fridgeLight = new THREE.PointLight(0xfff2dc, 0, 1.6, 2);
    this.fridgeLight.position.set(fx, 1.0, fz - 0.15);
    this.scene.add(this.fridgeLight);
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.17, 14), new THREE.MeshStandardMaterial({ color: 0xa3150f, roughness: 0.35 })), fx - 0.12, 0.83, fz + 0.02);
    const lemon = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe0c23a, roughness: 0.6 })), fx + 0.1, 0.76, fz + 0.05);
    lemon.rotation.x = Math.PI;
    this.add(box(0.07, 0.19, 0.07, new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.7 })), fx + 0.12, 0.48, fz + 0.04);
  }

  buildBoxFridge(fx, fz, fw, fd, fh, enamel) {
    const { m } = this;
    this.add(box(fw, fh, fd - 0.04, enamel, 0.02), fx, fh / 2, fz + 0.02, { collide: true });
    // the doors (fridge below, freezer above), hinged on the east side
    const hinge = (this.fridgeHinge = new THREE.Group());
    hinge.position.set(fx + fw / 2, 0, fz - fd / 2 + 0.02);
    this.scene.add(hinge);
    this.add(box(fw - 0.01, 1.2, 0.045, enamel, 0.015), -fw / 2, 0.62, -0.02, { parent: hinge });
    this.add(box(0.025, 0.4, 0.03, m.metal), -fw + 0.06, 0.95, -0.06, { parent: hinge });
    this.add(box(fw - 0.01, 0.48, 0.045, enamel, 0.015), fx, 1.47, fz - fd / 2);
    this.add(box(0.025, 0.2, 0.03, m.metal), fx - fw / 2 + 0.06, 1.42, fz - fd / 2 - 0.04);
    // inside: a light, a shelf, and next to nothing on it
    const inside = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5, side: THREE.BackSide });
    this.add(box(fw - 0.08, 1.1, fd - 0.12, inside), fx, 0.62, fz + 0.04, { shadow: false });
    this.add(box(fw - 0.1, 0.012, fd - 0.14, new THREE.MeshStandardMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.6, roughness: 0.1 })), fx, 0.62, fz + 0.04);
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.17, 14), new THREE.MeshStandardMaterial({ color: 0xa3150f, roughness: 0.35 })), fx - 0.16, 0.71, fz + 0.06);
    const lemon = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe0c23a, roughness: 0.6 })), fx + 0.08, 0.627, fz + 0.1);
    lemon.rotation.x = Math.PI;
    lemon.position.y = 0.66;
    this.add(box(0.07, 0.19, 0.07, new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.7 })), fx + 0.17, 0.25, fz + 0.12);
    this.fridgeLight = new THREE.PointLight(0xfff2dc, 0, 1.6, 2);
    this.fridgeLight.position.set(fx, 1.0, fz - 0.1);
    this.scene.add(this.fridgeLight);
    // a takeout menu and a photo held on with magnets
    this.add(box(0.16, 0.22, 0.004, new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.9 })), -0.25, 1.0, -0.047, { parent: hinge, shadow: false });
    this.add(box(0.1, 0.07, 0.004, new THREE.MeshStandardMaterial({ map: photoTexture(), roughness: 0.4 })), -0.5, 0.82, -0.047, { parent: hinge, shadow: false });
    this.fridgeSign = 1;
  }

  // the counter: the coffee maker (downloaded where it's loaded), the week's pizza boxes
  buildCounter() {
    const { m } = this;
    const cx = -0.08, cw = 1.0, cd = 0.58;
    this.add(box(cw, 0.86, cd, m.darkWood), cx, 0.43, HALL.z1 - cd / 2, { collide: true });
    this.add(box(cw + 0.03, 0.04, cd + 0.03, new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.45 })), cx, 0.88, HALL.z1 - cd / 2);
    for (const x of [cx - 0.25, cx + 0.25]) this.add(box(0.008, 0.6, 0.01, m.black), x, 0.45, HALL.z1 - cd - 0.003);
    let maker;
    if (hasProp('coffee')) { maker = prop('coffee'); maker.rotation.y = Math.PI + 0.15; } else {
      maker = new THREE.Group();
      this.add(box(0.18, 0.3, 0.2, m.black, 0.02), 0, 0.15, 0, { parent: maker });
      this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x2a1a10, transparent: true, opacity: 0.75, roughness: 0.1 })), 0, 0.08, 0.07, { parent: maker });
    }
    maker.position.set(cx + 0.3, 0.9, HALL.z1 - 0.3);
    this.scene.add(maker);
    const pizza = new THREE.MeshStandardMaterial({ color: 0xc7a879, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const b = this.add(box(0.36, 0.04, 0.36, pizza), cx - 0.22, 0.92 + i * 0.041, HALL.z1 - 0.3);
      b.rotation.y = (i - 1) * 0.12;
    }
  }

  // Open (or close) the fridge door; its light comes on.
  async openFridge(open = true, tweenFn) {
    const from = this.fridgeHinge.rotation.y, to = open ? 1.6 * this.fridgeSign : 0;
    await tweenFn(0.7, (k) => { this.fridgeHinge.rotation.y = from + (to - from) * k; this.fridgeLight.intensity = (open ? k : 1 - k) * (this.fridgeGlow ?? 1.2); });
  }

  buildFurniture() {
    const { m } = this;
    // Bed
    const bw = BED.x1 - BED.x0, bl = BED.z1 - BED.z0, bx = (BED.x0 + BED.x1) / 2, bz = (BED.z0 + BED.z1) / 2;
    this.add(box(bw + 0.06, 0.28, bl + 0.04, m.wood, 0.02), bx, 0.2, bz);
    for (const [x, z] of [[BED.x0, BED.z1], [BED.x1, BED.z1]]) this.add(box(0.07, 0.42, 0.07, m.wood), x, 0.21, z);
    this.add(box(bw, 0.24, bl - 0.02, m.sheet, 0.08), bx, 0.44, bz);
    const head = new THREE.Group();
    this.add(box(bw + 0.14, 0.08, 0.07, m.wood, 0.02), 0, 1.06, 0, { parent: head });
    this.add(box(bw + 0.14, 0.08, 0.07, m.wood, 0.02), 0, 0.5, 0, { parent: head });
    for (const x of [-(bw + 0.07) / 2, (bw + 0.07) / 2]) this.add(box(0.08, 1.12, 0.08, m.wood, 0.02), x, 0.56, 0, { parent: head });
    for (let i = 0; i < 6; i++) this.add(box(0.12, 0.5, 0.03, m.wood), -bw / 2 + 0.2 + i * (bw - 0.4) / 5, 0.78, 0, { parent: head });
    head.position.set(bx, 0, BED.z0 - 0.02);
    this.scene.add(head);
    this.pillow = this.add(box(0.62, 0.13, 0.4, m.pillow, 0.06), bx + 0.1, BED.top + 0.06, BED.z0 + 0.3);
    this.pillow.rotation.y = 0.06;
    this.physics.fixedBox({ x: bx, y: 0.3, z: bz }, { x: bw / 2 + 0.03, y: 0.28, z: bl / 2 + 0.02 });
    this.buildBlanket();

    // Nightstand + alarm clock
    this.add(box(0.5, 0.55, 0.45, m.wood, 0.01), 0.0, 0.275, -1.75, { collide: true });
    this.add(box(0.44, 0.16, 0.02, m.darkWood), 0.0, 0.38, -1.52);
    this.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), m.metal), 0.0, 0.38, -1.505);
    this.clockFace = new ClockFace();
    const clock = this.add(box(0.2, 0.09, 0.08, m.black, 0.01), 0.02, 0.6, -1.7);
    clock.rotation.y = -0.35;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.065), new THREE.MeshBasicMaterial({ map: this.clockFace.texture, color: new THREE.Color(2.2, 2.2, 2.2) }));
    face.position.z = 0.041;
    clock.add(face);
    this.clockLight = new THREE.PointLight(0xff2a14, 0.5, 1.6, 2);
    this.clockLight.position.set(0.05, 0.65, -1.6);
    this.scene.add(this.clockLight);

    // Desk, lamp and clutter
    this.add(box(1.3, 0.04, 0.62, m.wood, 0.01), 1.15, 0.74, -1.68, { collide: true });
    for (const [x, z] of [[0.53, -1.95], [1.77, -1.95], [0.53, -1.41], [1.77, -1.41]]) this.add(box(0.05, 0.72, 0.05, m.wood), x, 0.36, z);
    this.add(box(0.4, 0.5, 0.55, m.wood), 1.55, 0.47, -1.68, { collide: true });
    this.physics.fixedBox({ x: 1.15, y: 0.37, z: -1.68 }, { x: 0.65, y: 0.37, z: 0.31 });
    const lamp = new THREE.Group();
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.025, 20), m.black), 0, 0.012, 0, { parent: lamp });
    const arm1 = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), m.black), 0, 0.2, 0, { parent: lamp });
    arm1.rotation.z = 0.25;
    const arm2 = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8), m.black), 0.12, 0.42, 0.04, { parent: lamp });
    arm2.rotation.set(0.4, 0, -0.9);
    const shade = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, side: THREE.DoubleSide })), 0.25, 0.47, 0.12, { parent: lamp });
    shade.rotation.set(-0.5, 0, 0.6);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.5, 2.6) }));
    bulb.position.set(0.24, 0.44, 0.13);
    lamp.add(bulb);
    lamp.position.set(0.68, 0.76, -1.85);
    this.scene.add(lamp);
    this.lamp = { group: lamp, bulb };
    // framed photo of Martin Jordan
    const frame = this.add(box(0.2, 0.25, 0.02, m.black), 1.3, 0.89, -1.86);
    frame.rotation.x = -0.12;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.22), new THREE.MeshStandardMaterial({ map: photoTexture(), roughness: 0.35 }));
    pic.position.z = 0.011;
    frame.add(pic);
    this.photo = frame;
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x1d3d6b, roughness: 0.4 })), 1.65, 0.81, -1.5);

    // Chair with Hal's flight jacket
    const chair = new THREE.Group();
    this.add(box(0.45, 0.05, 0.45, m.darkWood), 0, 0.47, 0, { parent: chair });
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) this.add(box(0.04, 0.47, 0.04, m.darkWood), x, 0.235, z, { parent: chair });
    this.add(box(0.45, 0.5, 0.04, m.darkWood), 0, 0.75, 0.21, { parent: chair });
    const jacket = this.add(box(0.5, 0.62, 0.16, m.olive, 0.06), 0, 0.68, 0.24, { parent: chair });
    jacket.rotation.x = 0.08;
    for (const x of [-0.28, 0.28]) {
      const sleeve = this.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 6, 10), m.olive), x, 0.5, 0.18, { parent: chair });
      sleeve.rotation.z = x > 0 ? -0.15 : 0.15;
    }
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshStandardMaterial({ color: 0x7a1d1d, roughness: 0.7 }));
    patch.position.set(0, 0.1, 0.081);
    jacket.add(patch);
    chair.position.set(1.2, 0, -0.95);
    chair.rotation.y = 0.25;
    this.scene.add(chair);
    this.physics.fixedBox({ x: 1.2, y: 0.4, z: -0.95 }, { x: 0.27, y: 0.4, z: 0.27 });

    // Dresser with a model jet on top
    this.add(box(0.5, 0.9, 1.1, m.wood, 0.01), 1.93, 0.45, 1.35, { collide: true });
    for (let i = 0; i < 3; i++) {
      this.add(box(0.02, 0.24, 1.0, m.darkWood), 1.67, 0.16 + i * 0.27, 1.35);
      this.add(box(0.03, 0.02, 0.14, m.metal), 1.66, 0.2 + i * 0.27, 1.35);
    }
    const model = buildJet({ scale: 0.035, color: 0xb9bec4 });
    model.position.set(1.95, 0.98, 1.2);
    model.rotation.set(0.2, -0.6, 0.15);
    this.scene.add(model);
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), m.metal), 1.95, 0.94, 1.2);
    this.add(box(0.12, 0.2, 0.05, new THREE.MeshStandardMaterial({ color: 0x3a6b8c, transparent: true, opacity: 0.7, roughness: 0.1 })), 1.9, 1.0, 1.65);

    // Posters cut from the concept art
    const posters = this.assets.posters;
    const place = (name, x, y, z, w, h, ry = 0) => {
      const tex = posters[name];
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.rotation.z = (Math.random() - 0.5) * 0.02;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    const bz0 = ROOM.z0 + 0.006;
    this.posters = [
      place('airforce', -0.95, 1.72, bz0, 0.62, 0.95),
      place('squadron', -1.78, 1.88, bz0, 0.4, 0.5),
      place('whitejet', -1.72, 1.31, bz0, 0.3, 0.43),
      place('testpilot', 0.12, 1.46, bz0, 0.38, 0.7),
      place('jets', 0.85, 1.86, bz0, 0.66, 0.6),
      place('flightseat', 1.55, 1.38, bz0, 0.32, 0.58),
      place('sidewall', ROOM.x1 - 0.006, 1.62, -1.62, 0.36, 0.66, -Math.PI / 2),
    ];
  }

  buildBlanket() {
    const W = 1.75, L = 1.5, sx = 42, sz = 36;
    const geo = new THREE.PlaneGeometry(W, L, sx, sz).rotateX(-Math.PI / 2);
    this.blanket = new THREE.Mesh(geo, this.m.blanket);
    this.blanket.castShadow = this.blanket.receiveShadow = true;
    this.blanket.frustumCulled = false;
    this.scene.add(this.blanket);
    this.blanketBase = Float32Array.from(geo.attributes.position.array);
    this.blanketCenter = new THREE.Vector3((BED.x0 + BED.x1) / 2, 0, BED.z1 - L / 2 + 0.08);
    this.blanketGrid = { cols: sx + 1, rows: sz + 1 };
    this.blanketOff = 0; // 0 over him .. 1 thrown back against the wall
    this.blanketWaist = 0; // 0 up to his chin .. 1 slid down to his waist (he's sat up)
    this.updateBlanket(0);
  }

  // The blanket rests on Hal like a sheet of cloth: his body (capsules, each with a little drape)
  // is a floor it can't pass through, and relaxation passes pull it taut between the high points,
  // so it tents over the knees, feet and toes instead of shrink-wrapping each limb into a ridge.
  // Arms rest on top, so they are left out. Past the mattress it hangs down the sides.
  // `blanketOff` (0..1) throws it back toward the wall, bunched.
  updateBlanket(t) {
    const pos = this.blanket.geometry.attributes.position;
    const base = this.blanketBase, c = this.blanketCenter, { cols, rows } = this.blanketGrid;
    const off = this.blanketOff ?? 0, hold = 1 - smoothstep(0.15, 0.7, off);
    const caps = this.bodyCapsules && hold > 0 ? this.bodyCapsules().filter((c) => !c.arm) : [];
    const n = pos.count;
    const X = (this._bx ??= new Float32Array(n)), Z = (this._bz ??= new Float32Array(n)), F = (this._bf ??= new Float32Array(n)), Y = (this._by ??= new Float32Array(n));
    for (let i = 0; i < n; i++) {
      let x = base[i * 3] + c.x;
      const z = base[i * 3 + 2] + c.z;
      x += (BED.x0 + 0.34 - x) * 0.7 * off; // thrown back toward the wall
      let y = BED.top + 0.025 + Math.sin(x * 9 + z * 5) * 0.006 + Math.sin(z * 13) * 0.004;
      for (const cp of caps) {
        const abx = cp.b.x - cp.a.x, abz = cp.b.z - cp.a.z;
        const tt = Math.max(0, Math.min(1, ((x - cp.a.x) * abx + (z - cp.a.z) * abz) / (abx * abx + abz * abz + 1e-6)));
        const px = cp.a.x + abx * tt, pz = cp.a.z + abz * tt, py = cp.a.y + (cp.b.y - cp.a.y) * tt;
        const d2 = (x - px) ** 2 + (z - pz) ** 2;
        const w = cp.torso ? hold * (1 - this.blanketWaist) : hold;
        y = Math.max(y, BED.top + (py + cp.r + 0.03 - d2 / (1.4 * cp.r) - BED.top) * w);
      }
      // heaped where it was thrown: folds standing up off the mattress
      y += off * (0.04 + 0.035 * Math.sin(x * 38 + z * 6) + 0.02 * Math.sin(z * 17 + 1.3)) * smoothstep(BED.x0 + 0.75, BED.x0 + 0.3, x);
      X[i] = x; Z[i] = z; F[i] = y; Y[i] = y;
    }
    // relax: each point to its neighbours' mean, never below the floor (cloth resting on the body)
    for (let it = 0; it < 14; it++) {
      for (let r = 1; r < rows - 1; r++) for (let q = 1; q < cols - 1; q++) {
        const i = r * cols + q;
        if (X[i] < BED.x0 || X[i] > BED.x1 || Z[i] > BED.z1) continue;
        Y[i] = Math.max(F[i], (Y[i - 1] + Y[i + 1] + Y[i - cols] + Y[i + cols]) * 0.25);
      }
    }
    for (let i = 0; i < n; i++) {
      let x = X[i], z = Z[i], y = Y[i];
      // overhang: slide down the side of the mattress (kept slightly apart so no triangle collapses)
      const over = Math.max(BED.x0 - x, x - BED.x1, z - BED.z1, 0);
      if (over > 0) {
        if (x < BED.x0) x = BED.x0 - 0.025 - (BED.x0 - x) * 0.08; else if (x > BED.x1) x = BED.x1 + 0.025 + (x - BED.x1) * 0.08;
        if (z > BED.z1) z = BED.z1 + 0.025 + (z - BED.z1) * 0.08;
        y = Math.min(y, BED.top + 0.02) - over * 1.05;
      }
      pos.setXYZ(i, x, Math.max(0.3, y), z);
    }
    pos.needsUpdate = true;
    const geo = this.blanket.geometry;
    geo.computeVertexNormals();
    const nm = geo.attributes.normal;
    for (let i = 0; i < nm.count; i++) if (!(Math.abs(nm.getX(i)) + Math.abs(nm.getY(i)) + Math.abs(nm.getZ(i)) > 1e-4)) nm.setXYZ(i, 0, 1, 0);
  }

  buildWindow() {
    const { m } = this;
    const zc = (WINDOW.z0 + WINDOW.z1) / 2, yc = (WINDOW.y0 + WINDOW.y1) / 2, ww = WINDOW.z1 - WINDOW.z0, wh = WINDOW.y1 - WINDOW.y0;
    const x = ROOM.x1;
    for (const [w, h, y, z] of [[ww + 0.1, 0.06, WINDOW.y0, zc], [ww + 0.1, 0.06, WINDOW.y1, zc], [0.06, wh, yc, WINDOW.z0], [0.06, wh, yc, WINDOW.z1], [0.05, wh, yc, zc]]) {
      this.add(box(0.1, h, w, m.trim), x + 0.02, y, z);
    }
    this.add(box(0.2, 0.04, ww + 0.16, m.trim), x - 0.06, WINDOW.y0 - 0.03, zc);
    // Rain-streaked glass
    this.glassU = { uTime: { value: 0 }, uFlash: { value: 0 }, uGreen: { value: 0 }, uRain: { value: this.morning ? 0 : 1 }, uDay: { value: this.morning ? 1 : 0 } };
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.ShaderMaterial({
      uniforms: this.glassU, transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uFlash, uGreen, uRain, uDay; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
        void main() {
          vec2 uv = vUv * vec2(26.0, 9.0);
          vec2 cell = floor(uv); float r = h(cell);
          vec2 f = fract(uv + vec2(0.0, uTime * (0.2 + r * 0.6) + r));
          float drop = smoothstep(0.12, 0.0, length((f - vec2(0.5, 0.3)) * vec2(1.0, 2.2))) * step(0.55, r);
          float streak = smoothstep(0.08, 0.0, abs(f.x - 0.5)) * smoothstep(0.3, 0.9, f.y) * step(0.7, r) * 0.5;
          float a = 0.05 + (drop + streak) * 0.5 * uRain;
          vec3 c = mix(vec3(0.45, 0.55, 0.7), vec3(0.4, 1.4, 0.7), uGreen) * (0.25 + uFlash * 2.0 + uGreen * 1.5);
          // by day: a faint sheen, a few dried spots
          c = mix(c, vec3(0.85, 0.9, 0.95), uDay * 0.6);
          a = mix(a, 0.035 + step(0.93, r) * smoothstep(0.1, 0.0, length(f - 0.5)) * 0.12, uDay);
          gl_FragColor = vec4(c, a);
        }`,
    }));
    glass.position.set(x + 0.02, yc, zc);
    glass.rotation.y = -Math.PI / 2;
    this.scene.add(glass);
    this.glass = glass;
    // curtain rod + two cloth curtains
    this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, ww + 1.2, 8).rotateX(Math.PI / 2), m.metal), x - 0.12, 2.32, zc);
    this.curtains = [WINDOW.z0 - 0.2, WINDOW.z1 + 0.18].map((z) => {
      const cloth = new Cloth({ width: 0.6, height: 2.2, segX: 9, segY: 18, material: m.curtain, wallX: x - 0.03 });
      cloth.mesh.position.set(x - 0.12, 2.3 - 1.1, z);
      cloth.mesh.rotation.y = -Math.PI / 2;
      this.scene.add(cloth.mesh);
      cloth.init();
      cloth.gust = 0.15;
      return cloth;
    });
  }

  buildProps() {
    const { m } = this;
    const P = this.physics;
    // duffel bag
    const bag = this.add(box(0.62, 0.3, 0.3, new THREE.MeshStandardMaterial({ color: 0x353a2e, roughness: 0.85 }), 0.12), 1.2, 0.16, 0.6);
    bag.rotation.y = 0.4;
    P.dynamicBox(bag, { x: 0.31, y: 0.15, z: 0.15 }, { density: 120 });
    this.add(box(0.5, 0.02, 0.04, m.black), 0, 0.16, 0, { parent: bag }).position.set(0, 0.155, 0);
    // clothes on the floor
    const clothColors = [0x7a2f2f, 0x3d4f6e, 0x9a9488, 0x2e2e33];
    [[0.5, 0.35], [1.55, -0.3], [-0.2, 1.1], [0.9, 1.5]].forEach(([x, z], i) => {
      const c = this.add(box(0.38, 0.05, 0.32, new THREE.MeshStandardMaterial({ map: fabricTexture({ base: '#' + clothColors[i].toString(16).padStart(6, '0') }), roughness: 1 }), 0.024), x, 0.03, z);
      c.rotation.y = i * 1.3;
      P.dynamicBox(c, { x: 0.19, y: 0.025, z: 0.16 }, { density: 60, damping: 1.5, angularDamping: 2 });
    });
    // sneakers
    [[0.35, 1.45, 0.3], [0.55, 1.6, -0.5]].forEach(([x, z, r]) => {
      const sh = this.add(box(0.28, 0.1, 0.11, new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.7 }), 0.04), x, 0.06, z);
      sh.rotation.y = r;
      P.dynamicBox(sh, { x: 0.14, y: 0.05, z: 0.055 }, { density: 300 });
    });
    // basketball
    const ball = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc0581f, roughness: 0.7 })), -0.15, 0.13, 0.75);
    P.dynamic(ball, RAPIER.ColliderDesc.ball(0.12), { density: 80, restitution: 0.7, damping: 0.3, angularDamping: 0.4 });
    // books and papers on the desk
    [0x8a2b22, 0x22435e, 0x3d5a2a, 0x6b5a2c].forEach((col, i) => {
      const b = this.add(box(0.16, 0.035, 0.23, new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })), 1.0 + (i % 2) * 0.05, 0.78 + i * 0.036, -1.62);
      b.rotation.y = i * 0.2;
      P.dynamicBox(b, { x: 0.08, y: 0.0175, z: 0.115 }, { density: 500 });
    });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const sh = this.add(box(0.21, 0.004, 0.29, paper), 1.32 + Math.random() * 0.25, 0.765 + i * 0.006, -1.5 - Math.random() * 0.1, { shadow: true });
      sh.rotation.y = Math.random() * 0.8 - 0.4;
      const body = P.dynamicBox(sh, { x: 0.105, y: 0.004, z: 0.145 }, { density: 250, damping: 2.5, angularDamping: 3 });
      body.enableCcd(true);
    }
    // soda can on the nightstand
    const can = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xb01e1e, metalness: 0.7, roughness: 0.3 })), -0.15, 0.61, -1.82);
    P.dynamic(can, RAPIER.ColliderDesc.cylinder(0.06, 0.033), { density: 300 });

    // dust in the lamp light
    this.dust = new Particles(220, { additive: true, drag: 0.5, turbulence: 0.05 });
    this.scene.add(this.dust.points);
    this.dust.emit(220, (p, v) => {
      p[0] = -1.5 + Math.random() * 3.5; p[1] = 0.3 + Math.random() * 2; p[2] = -1.9 + Math.random() * 3.5;
      v[0] = (Math.random() - 0.5) * 0.02; v[1] = (Math.random() - 0.5) * 0.01; v[2] = (Math.random() - 0.5) * 0.02;
    }, { life: 1e6, size: [0.008, 0.008], color: this.morning ? [[1.2, 1.05, 0.85, 0.35], [1.2, 1.05, 0.85, 0.35]] : [[0.7, 0.62, 0.5, 0.22], [0.7, 0.62, 0.5, 0.22]] });
  }

  buildLights() {
    const s = this.scene, day = this.morning;
    this.hemi = day ? new THREE.HemisphereLight(0xc4d6ea, 0x3c3024, 0.55) : new THREE.HemisphereLight(0x6a7a99, 0x1a1410, 0.1);
    s.add(this.hemi);
    // desk lamp
    const spot = new THREE.SpotLight(0xffb26a, 6, 9, 1.05, 0.65, 2);
    spot.position.set(0.93, 1.2, -1.72);
    spot.target.position.set(0.9, 0.0, -0.6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    s.add(spot, spot.target);
    this.lampLight = spot;
    this.lampFill = new THREE.PointLight(0xffa860, 0.7, 6, 2);
    this.lampFill.position.set(0.8, 1.6, -1.2);
    s.add(this.lampFill);
    // moonlight through the window (by day, the low morning sun)
    const moon = day ? new THREE.DirectionalLight(0xffdcb0, 3.2) : new THREE.DirectionalLight(0x8ea8dd, 0.9);
    moon.position.set(9, 6.5, -2.5);
    moon.target.position.set(0, 0, -0.4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.03;
    s.add(moon, moon.target);
    this.moon = moon;
    // hallway ceiling light
    const hall = new THREE.PointLight(0xffc48a, 2.2, 7, 2);
    hall.position.set(-2.8, 2.35, 2.82);
    s.add(hall);
    const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.6) }));
    fixture.rotation.x = Math.PI;
    fixture.position.copy(hall.position).y += 0.22;
    s.add(fixture);
    this.hallLight = hall;
    // the green light floods in from here
    if (day) {
      // the lamp and hallway light off; daylight bounced in off the walls
      spot.intensity = 0;
      this.lampFill.intensity = 0;
      this.lamp.bulb.material.color.setRGB(0.3, 0.25, 0.2);
      hall.intensity = 0.25;
      fixture.material.color.setRGB(0.9, 0.85, 0.8);
      const bounce = new THREE.PointLight(0xffe6c8, 1.4, 6, 2);
      bounce.position.set(0.6, 1.3, -0.4);
      s.add(bounce);
      const hallDay = new THREE.PointLight(0xdfe6ee, 0.9, 6, 2);
      hallDay.position.set(-2.4, 2.0, 2.8);
      s.add(hallDay);
      this.clockLight.intensity = 0.15;
    }
    this.greenFill = new THREE.PointLight(0x55ff88, 0, 14, 1.6);
    this.greenFill.position.set(2.6, 1.6, -0.35);
    s.add(this.greenFill);
  }

  // The street below the window (+x): pavements, the road, palms and lamps at the kerb, parked cars,
  // the office blocks opposite, and downtown's towers further off through the morning haze.
  buildStreetView() {
    const s = this.scene, y0 = -3.4;
    const put = (o, x, z, yaw = 0, sc = 1) => { o.position.set(x, y0, z); o.rotation.y = yaw; o.scale.setScalar(sc); s.add(o); return o; };
    const plane = (w, d, x, z, mat, y = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat); m.position.set(x, y0 + y, z); m.receiveShadow = true; s.add(m); };
    plane(5, 300, 5.2, 0, pbrMaterial('concrete_floor_02', { repeat: [1.7, 100], tint: new THREE.Color(1.12, 1.08, 1.03) }), 0.14);
    plane(14, 300, 14.7, 0, pbrMaterial('asphalt_02', { repeat: [4.7, 100] }));
    plane(5, 300, 24.2, 0, pbrMaterial('concrete_floor_02', { repeat: [1.7, 100], tint: new THREE.Color(1.12, 1.08, 1.03) }), 0.14);
    plane(600, 600, 300, 0, pbrMaterial('asphalt_02', { repeat: [120, 120], tint: new THREE.Color(0.8, 0.78, 0.75) }), -0.02);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 300).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd9b23e }));
    line.position.set(14.7, y0 + 0.01, 0);
    s.add(line);
    let z = 60;
    for (const name of ['office5', 'office2', 'office4', 'office5', 'office1']) {
      const o = prop(name), b = new THREE.Box3().setFromObject(o), w = b.max.x - b.min.x, dep = b.max.z - b.min.z;
      put(o, 26.7 + dep / 2 + 1, z - w / 2, -Math.PI / 2);
      z -= w + 5;
    }
    for (const [name, x, zz, sc] of [['office3', 240, -50, 2.2], ['office1', 300, 70, 2.0], ['office3', 210, 160, 1.8], ['office4', 180, -170, 1.7]]) put(prop(name), x, zz, -Math.PI / 2, sc);
    for (let zz = -60; zz <= 60; zz += 14) {
      put(prop('palms'), 23, zz, zz * 0.37, 0.6 + (Math.abs(zz) % 3) * 0.04);
      put(prop('palms'), 6.8, zz + 7, zz * 0.53 + 1, 0.55);
      put(piece('cityprops', /low_poly012_/), 22.3, zz + 7, Math.PI);
    }
    put(makeCar('sialia', { paint: 0x355e80, dust: 0.2 }), 19.8, -6, 0);
    put(makeCar('negotiator', { paint: 0xb7ad9a, dust: 0.2 }), 19.8, 9, Math.PI);
    put(makeCar('fairheaven_sw', { paint: 0x4f5b47, dust: 0.2 }), 9.6, 22, Math.PI);
  }

  buildOutside() {
    const s = this.scene;
    this.sky = createSky(this.morning ? 'morning' : 'storm');
    s.add(this.sky);
    this.treeTime = { value: 0 };
    // by day in Part Three: Coast City's street outside, the blocks across it, downtown in the haze;
    // by night (Part One) the wooded ground and the tree line
    if (this.morning && hasProp('office1')) this.buildStreetView();
    else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.morning ? 0x46553a : 0x070a07, roughness: 1 }));
      ground.position.set(0, -2.5, 0);
      ground.receiveShadow = true;
      s.add(ground);
      const kit = treeKit();
      const spots = [[], []];
      for (let i = 0; i < 140; i++) {
        const a = -0.95 + (i / 140) * 1.9 + (Math.random() - 0.5) * 0.04;
        const d = 60 + Math.random() * 70, h = 8 + Math.random() * 9;
        spots[i % 2].push({ x: Math.cos(a) * d, y: -2.6, z: Math.sin(a) * d, h, w: h * (0.9 + Math.random() * 0.3) });
      }
      const mat = foliageMaterial(this.treeTime);
      spots.forEach((sp, k) => s.add(forest(kit.far[k], mat, sp)));
    }
    // the meteor: hot core + trail, flies past the window when the light arrives
    this.meteor = new THREE.Group();
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(120,255,160,0.5)');
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(3, 6, 3.5), blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.setScalar(4);
    this.meteor.add(core);
    this.meteor.visible = false;
    s.add(this.meteor);
    this.meteorTrail = new Particles(500, { additive: true, drag: 0.6, turbulence: 1.5 });
    s.add(this.meteorTrail.points);
  }

  // Interactable: { position, radius, label, key, action, enabled }
  interact(def) {
    const it = { radius: 1.1, key: 'E', enabled: true, ...def };
    this.interactables.push(it);
    return it;
  }

  setClock(text) { this.clockFace.set(text); }

  lightning(strength = 1) {
    const u = this.sky.userData.uniforms;
    this.flash = Math.max(this.flash ?? 0, strength);
    u.uFlash.value = strength;
  }

  update(dt, t, camera, renderer) {
    this.physics.step(dt);
    const u = this.sky.userData.uniforms;
    u.uTime.value = t;
    this.glassU.uTime.value = t;
    this.treeTime.value = t;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.5);
      const f = this.flash * (0.6 + 0.4 * Math.sin(t * 60));
      u.uFlash.value = f;
      this.glassU.uFlash.value = f;
      this.moon.intensity = 0.9 + f * 6;
    }
    for (const c of this.curtains) c.update(dt, t);
    this.updateBlanket(t);
    this.dust.update(dt, t, camera, renderer);
    this.meteorTrail.update(dt, t, camera, renderer);
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() {
    this.physics.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const mat of [o.material ?? []].flat()) {
        for (const v of Object.values(mat)) if (v?.isTexture) v.dispose();
        mat.dispose();
      }
    });
  }
}

// Procedural jet (used for the dresser model and the dream). Length ~12 m at scale 1.
export function buildJet({ scale = 1, color = 0xaeb4ba } = {}) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.5, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 9, 20).rotateZ(Math.PI / 2), metal);
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3, 20).rotateZ(-Math.PI / 2), metal);
  nose.position.x = 6;
  g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.9, roughness: 0.05 }));
  canopy.scale.set(2.2, 0.9, 0.9);
  canopy.position.set(3.2, 0.45, 0);
  g.add(canopy);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(1.5, 0); wingShape.lineTo(-2.2, 5.2); wingShape.lineTo(-3.2, 5.2); wingShape.lineTo(-2.4, 0); wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: false });
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(wingGeo, metal);
    w.rotation.x = side * Math.PI / 2;
    w.position.set(0, -0.1, 0);
    g.add(w);
  }
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0); tailShape.lineTo(-1.6, 2.4); tailShape.lineTo(-2.4, 2.4); tailShape.lineTo(-2.0, 0); tailShape.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape, { depth: 0.1, bevelEnabled: false }), metal);
  fin.position.set(-2.6, 0.3, -0.05);
  g.add(fin);
  for (const side of [1, -1]) {
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape, { depth: 0.08, bevelEnabled: false }), metal);
    st.scale.set(0.8, 0.9, 1);
    st.rotation.x = side * Math.PI / 2;
    st.position.set(-2.8, 0.05, 0);
    g.add(st);
  }
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16).rotateZ(Math.PI / 2), dark);
  exhaust.position.x = -4.6;
  g.add(exhaust);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 16).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.x = -5.5;
  g.add(flame);
  g.userData.flame = flame;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.scale.setScalar(scale);
  return g;
}
