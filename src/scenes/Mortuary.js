import * as THREE from 'three';
import { Physics } from '../engine/Physics.js';
import { noiseTexture, pbrMaterial, glowTexture } from '../fx/Textures.js';
import { prop, hasProp } from '../props/Props.js';

// Part Seven's sting: the preparation room in the basement of the Hand family's funeral home, Coast City, two in
// the morning (Secret Origin's William Hand is the undertaker's son who picks up the weapon Atrocitus left behind;
// the room is ours). Tiled to shoulder height, a steel table under two hanging fluorescents, the cold drawers
// along one wall, his desk and its lamp along the other, the door to the stairs ajar on a line of the house's
// light. On the table, the heart of Atrocitus's machine. The story puts its lights out one by one (`lamps`).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const MORTUARY_PROPS = ['autopsy', 'fluoro', 'desklamp', 'wallshelf'];
export const ROOM = { x0: -3.6, x1: 3.6, z0: -2.8, z1: 2.8, h: 2.7 };
export const TABLE = V(0.51, 0, -0.4); // the steel table's middle, on the floor (its long axis along z)
export const TABLE_TOP = 0.79;
export const HEART = V(0.84, TABLE_TOP + 0.085, -0.35); // the heart on the table, by his hands
export const HAND_AT = V(1.52, 0, -0.35); // where he stands at it, on its east side, facing west (-x)
export const STAIRS = V(2.45, 0, ROOM.z1); // the door to the stairs (back wall, its middle)

export class Mortuary {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.interactables = [];
    this.updaters = [];
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x020203);
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.08;
    this.buildShell();
    this.buildFixtures();
    this.buildLights();
    this.buildHeart();
    // somewhere for Hal's body to stand out of sight (the story needs a floor under him)
    this.physics.fixedBox(V(0, -0.5, -30), V(4, 0.5, 4));
    return this;
  }

  // the floor's tiles and its drain, the walls tiled to 1.5 m and painted over it, the plaster ceiling; the door
  buildShell() {
    const s = this.scene, R = ROOM, W = R.x1 - R.x0, D = R.z1 - R.z0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), pbrMaterial('floor_tiles_06', { repeat: [W / 1.2, D / 1.2], roughness: 0.55, tint: 0xb8bcb4 }));
    floor.receiveShadow = true;
    s.add(floor);
    const drain = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.4, metalness: 0.7 }));
    drain.position.set(TABLE.x - 0.2, 0.004, TABLE.z + 1.5);
    s.add(drain);
    const tile = pbrMaterial('rectangular_facade_tiles', { repeat: [3, 1], roughness: 0.35, tint: 0xd9e3dc });
    const paint = new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#9aa79d', spots: 260, spread: 60, alpha: 0.03, repeat: [3, 1], fine: 0.03 }), color: 0xb7c2b6, roughness: 0.92 });
    const ceil = new THREE.MeshStandardMaterial({ map: noiseTexture({ base: '#b9b6ad', spots: 200, spread: 70, alpha: 0.02, repeat: [2, 2], fine: 0.02 }), roughness: 1 });
    const TH = 1.5;
    const wall = (len, x, z, yaw) => {
      for (const [y0, y1, m] of [[0, TH, tile], [TH, R.h, paint]]) {
        const g = new THREE.PlaneGeometry(len, y1 - y0).translate(0, (y0 + y1) / 2, 0);
        const w = new THREE.Mesh(g, m.clone());
        if (m === tile) w.material.map = w.material.map.clone(), w.material.map.repeat.set(len / 1.4, 1.1), w.material.map.needsUpdate = true;
        w.position.set(x, 0, z);
        w.rotation.y = yaw;
        w.receiveShadow = true;
        s.add(w);
      }
      // the tiles' cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x5f6e66, roughness: 0.4 }));
      cap.position.set(x, TH, z).add(V(Math.sin(yaw) * 0.015, 0, Math.cos(yaw) * 0.015));
      cap.rotation.y = yaw;
      s.add(cap);
    };
    wall(W, 0, R.z0, 0);
    wall(W, 0, R.z1, Math.PI);
    wall(D, R.x0, 0, Math.PI / 2);
    wall(D, R.x1, 0, -Math.PI / 2);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), ceil);
    c.position.y = R.h;
    s.add(c);
    for (const [x, z, hx, hz] of [[0, R.z0 - 0.1, W / 2, 0.1], [0, R.z1 + 0.1, W / 2, 0.1], [R.x0 - 0.1, 0, 0.1, D / 2], [R.x1 + 0.1, 0, 0.1, D / 2]]) this.physics.fixedBox(V(x, R.h / 2, z), V(hx, R.h / 2, hz));
    this.physics.fixedBox(V(0, -0.1, 0), V(W / 2, 0.1, D / 2));
    // the door to the stairs, ajar: a dark doorway, the door swung in, and up the stairs a line of the house's light
    const dw = 0.9, dh = 2.05;
    const frame = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.6 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, dh, 0.12), frame); p.position.set(STAIRS.x + sx * (dw / 2 + 0.035), dh / 2, R.z1 - 0.02); s.add(p); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.14, 0.07, 0.12), frame);
    lintel.position.set(STAIRS.x, dh + 0.035, R.z1 - 0.02);
    s.add(lintel);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: 0x050403 }));
    hole.position.set(STAIRS.x, dh / 2, R.z1 - 0.025);
    hole.rotation.y = Math.PI;
    s.add(hole);
    this.stairLight = new THREE.Mesh(new THREE.PlaneGeometry(0.06, dh * 0.92), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.26) }));
    this.stairLight.position.set(STAIRS.x + 0.2, dh * 0.46, R.z1 - 0.03);
    this.stairLight.rotation.y = Math.PI;
    s.add(this.stairLight);
    const door = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.02, dh - 0.02, 0.045), new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.7 }));
    door.geometry.translate((dw - 0.02) / 2, 0, 0);
    const hinge = new THREE.Group();
    hinge.position.set(STAIRS.x - dw / 2, dh / 2, R.z1 - 0.06);
    hinge.rotation.y = Math.PI + 1.15;
    hinge.add(door);
    door.castShadow = door.receiveShadow = true;
    s.add(hinge);
  }

  // the table, the drawers, his desk and its lamp, the shelf of bottles, the lights on their chains
  buildFixtures() {
    const s = this.scene, R = ROOM;
    const steel = new THREE.MeshStandardMaterial({ color: 0x9da3a6, metalness: 0.6, roughness: 0.62 }); // (brushed: polished, the tubes' light on it bloomed into a sun behind his head)
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d2e, metalness: 0.6, roughness: 0.45 });
    const shadow = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (hasProp('autopsy')) {
      // the set's table and its tray (its middle 0.31 m east and 0.2 m south of the set's origin); not its curtain
      // screens or the surgical lamp over it, which stood in front of him from everywhere a camera could be
      const t = prop('autopsy');
      t.position.copy(TABLE).add(V(-0.31, 0, 0.2));
      t.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(t.matrixWorld).invert(), bb = new THREE.Box3();
      t.traverse((m) => {
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        if (bb.max.x < 0.0 || bb.min.z > 0.4 || (bb.min.y > 1.2 && bb.max.z > 0.1)) m.visible = false;
      });
      shadow(t);
      s.add(t);
    }
    this.physics.fixedBox(V(TABLE.x, 0.4, TABLE.z), V(0.58, 0.4, 1.2));
    // the cold drawers: a steel wall of six doors, two high, on the east wall
    const unit = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.9, 2.5), steel);
    body.position.set(0, 0.95, 0);
    unit.add(body);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const z = -0.82 + i * 0.82, y = 0.55 + j * 0.86;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.74, 0.74), steel);
      door.position.set(-0.39, y, z);
      unit.add(door);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.3), dark);
      handle.position.set(-0.42, y + 0.18, z);
      unit.add(handle);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshStandardMaterial({ color: 0xe6e0cc, roughness: 0.9 }));
      tag.position.set(-0.406, y - 0.18, z);
      tag.rotation.y = -Math.PI / 2;
      unit.add(tag);
    }
    unit.position.set(R.x1 - 0.38, 0, 0.1);
    shadow(unit);
    s.add(unit);
    this.physics.fixedBox(V(R.x1 - 0.38, 0.95, 0.1), V(0.38, 0.95, 1.25));
    // his desk on the west wall: a steel top on legs, a ledger and papers, the lamp
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 1.4), new THREE.MeshStandardMaterial({ color: 0x55493c, roughness: 0.55 }));
    top.position.y = 0.76;
    desk.add(top);
    for (const [x, z] of [[-0.3, -0.64], [0.3, -0.64], [-0.3, 0.64], [0.3, 0.64]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.74, 0.04), dark); l.position.set(x, 0.37, z); desk.add(l); }
    const paper = new THREE.MeshStandardMaterial({ color: 0xd9d2bf, roughness: 0.95 });
    for (const [x, z, w, d, r] of [[0.05, 0.2, 0.22, 0.3, 0.1], [0.1, 0.27, 0.22, 0.3, -0.15], [-0.05, -0.35, 0.3, 0.42, 0.04]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004 + Math.random() * 0.01, d), paper); p.position.set(x, 0.785, z); p.rotation.y = r; desk.add(p); }
    const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.36), new THREE.MeshStandardMaterial({ color: 0x3a1c16, roughness: 0.7 }));
    ledger.position.set(-0.08, 0.797, -0.35);
    desk.add(ledger);
    desk.position.set(R.x0 + 0.38, 0, 0.6);
    shadow(desk);
    s.add(desk);
    this.physics.fixedBox(V(R.x0 + 0.38, 0.39, 0.6), V(0.35, 0.39, 0.7));
    this.deskLampAt = V(R.x0 + 0.3, 0.78, 1.05);
    if (hasProp('desklamp')) {
      const lamp = prop('desklamp');
      lamp.position.copy(this.deskLampAt);
      lamp.rotation.y = Math.PI / 2 + 0.3; // (its head out over the desk)
      shadow(lamp);
      s.add(lamp);
    }
    if (hasProp('wallshelf')) {
      const sh = prop('wallshelf');
      sh.position.set(-1.75, 0, R.z0 + 0.28);
      shadow(sh);
      s.add(sh);
    }
    // the two fluorescents over the table, on their chains
    this.fixtures = [TABLE.clone().add(V(0, R.h, -0.75)), TABLE.clone().add(V(0, R.h, 0.65))].map((at) => {
      const g = new THREE.Group();
      if (hasProp('fluoro')) { const f = prop('fluoro'); f.traverse((m) => { if (m.isMesh) m.castShadow = false; }); g.add(f); f.position.y = -0.52; }
      // its tubes' diffuser, lit (the light itself is `buildLights`'s)
      // (a weak white: at 1.4 the bloom made a sun of it behind his head)
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 1.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.82, 0.86, 0.9) }));
      tube.position.y = -0.53;
      g.add(tube);
      g.position.copy(at);
      s.add(g);
      return { group: g, tube, at: at.clone().add(V(0, -0.56, 0)) };
    });
  }

  // The fixtures' light (cool, from above), the desk lamp's (warm, on the desk), the stairs' faint warmth, and a
  // breath of fill so the dark corners aren't black. `lamps` is the list the story puts out, in order.
  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x3c4650, 0x14110e, 0.12));
    const tube = (fx) => {
      const l = new THREE.PointLight(0xdfe9ff, 7.5, 8, 1.6);
      l.position.copy(fx.at).add(V(0, -0.05, 0));
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      l.shadow.bias = -0.002;
      s.add(l);
      return l;
    };
    const [a, b] = this.fixtures;
    const desk = new THREE.SpotLight(0xffcf96, 9, 4.5, 0.75, 0.6, 1.6);
    desk.position.copy(this.deskLampAt).add(V(0.38, 0.32, -0.1));
    desk.target.position.copy(this.deskLampAt).add(V(0.4, -0.2, -0.35));
    s.add(desk, desk.target);
    const deskBulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.64) }));
    deskBulb.position.copy(desk.position).add(V(0, -0.04, 0));
    s.add(deskBulb);
    this.lamps = [
      { light: tube(a), power: 7.5, glow: a.tube, at: a.at, k: 1 },
      { light: tube(b), power: 7.5, glow: b.tube, at: b.at, k: 1 },
      { light: desk, power: 9, glow: deskBulb, at: desk.position.clone(), k: 1 },
    ];
    for (const l of this.lamps) l.base = l.glow.material.color.clone();
  }

  // a lamp's brightness, 0..1 (its light and its glowing part together)
  setLamp(i, k) {
    const l = this.lamps[i];
    l.k = k;
    l.light.intensity = l.power * k;
    l.glow.material.color.copy(l.base).multiplyScalar(Math.max(0.03, k));
  }

  // The heart of the machine: a fist of red crystal, three iron prongs where it was torn out of the rest, a little
  // light of its own; `drink(k)` 0 (red, as Atrocitus left it) .. 1 (black, a violet-black rim round it)
  buildHeart() {
    const s = this.scene, g = (this.heart = new THREE.Group());
    const glass = (this.heartMat = new THREE.MeshStandardMaterial({ color: 0x300404, emissive: 0xff2010, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.1, flatShading: true }));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), glass);
    core.castShadow = true;
    g.add(core);
    const iron = new THREE.MeshStandardMaterial({ color: 0x1a1716, metalness: 0.8, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const curve = new THREE.CatmullRomCurve3([V(Math.cos(a) * 0.06, -0.03, Math.sin(a) * 0.06), V(Math.cos(a) * 0.1, 0.0, Math.sin(a) * 0.1), V(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12)]);
      const p = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.009, 5), iron);
      p.castShadow = true;
      g.add(p);
    }
    this.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,120,90,1)', 'rgba(255,30,10,0.35)'), color: 0xff4020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 }));
    this.heartGlow.scale.setScalar(0.42);
    g.add(this.heartGlow);
    this.heartLight = new THREE.PointLight(0xff2a12, 1.6, 3, 2);
    g.add(this.heartLight);
    g.position.copy(HEART);
    s.add(g);
  }

  drink(k) {
    this.drunk = k;
    const red = new THREE.Color(0xff2010), black = new THREE.Color(0x2a0a40);
    this.heartMat.emissive.copy(red).lerp(black, k);
    this.heartMat.color.setRGB(0.19 * (1 - k) + 0.01, 0.015 * (1 - k) + 0.005, 0.015 + 0.02 * k);
    this.heartGlow.material.color.copy(new THREE.Color(0xff4020).lerp(new THREE.Color(0x4a1a8a), k));
    this.heartLight.color.copy(new THREE.Color(0xff2a12).lerp(new THREE.Color(0x5a2aa0), k));
  }

  update(dt, t) {
    for (const u of this.updaters) u(dt, t);
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
  }
}
