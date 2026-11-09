import * as THREE from 'three';
import { RAPIER } from '../engine/Physics.js';
import { glowTexture } from '../fx/Textures.js';

// The Hall of the Guardians: an open chamber on the summit of a tower in Oa's citadel, between
// Kilowog's range and the Central Battery. A disc of polished stone inlaid with light; on its north
// side, a crescent of tall pillars, a Guardian on each, with the battery's glow behind them; a
// dais at the centre for the Lantern who is called; a great ring hanging over it all. Part of the
// Oa scene (you can see it from the range and fly there).
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const HALL = V(-62, 3, -150); // the centre of its floor
export const HALL_RADIUS = 17;
const DAIS = { r: 3.2, h: 0.3 };
// the Guardians' places: round the north side, the eldest highest in the middle
export const HALL_PILLARS = Array.from({ length: 7 }, (_, i) => {
  const a = (i - 3) * (23 * Math.PI) / 180, h = 7.2 - Math.abs(i - 3) * 0.45;
  const x = HALL.x + Math.sin(a) * 10.8, z = HALL.z - Math.cos(a) * 10.8;
  return { x, z, h, top: HALL.y + h, yaw: Math.atan2(HALL.x - x, HALL.z - z) };
});
// Abin Sur's bier, between the dais and the pillars, lying across the hall
export const BIER = HALL.clone().add(V(0, 0, -5.2));
export const DAIS_TOP = HALL.y + DAIS.h;

function hullPrism(sides, top, bottom, h, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
    pts.push(s * top, h / 2, c * top, s * bottom, -h / 2, c * bottom);
  }
  return RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
}

let seed = 29;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export function buildHall(oa) {
  const s = oa.scene, P = oa.physics, R = HALL_RADIUS, C = HALL;
  const group = new THREE.Group();
  group.position.copy(C);
  s.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: 0x232b31, roughness: 0.38, metalness: 0.7 });
  const light = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  const seamMat = light(0.1, 0.75, 0.34);

  // ---- the floor: dark polished stone, rings and rays of light, the emblem under the dais
  const size = 2048, k = size / (R * 2), cx = size / 2;
  const c = document.createElement('canvas'), e = document.createElement('canvas');
  c.width = c.height = e.width = e.height = size;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#15191c';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i++) {
    const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 22;
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.012 + rnd() * 0.025})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // flagstones: concentric courses of curved slabs with dark joints
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  for (let ring = 4; ring < R; ring += 1.6) {
    g.beginPath(); g.arc(cx, cx, ring * k, 0, Math.PI * 2); g.stroke();
    const n = Math.round((ring * Math.PI * 2) / 2.4), off = rnd();
    for (let j = 0; j < n; j++) {
      const a = ((j + off) / n) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * ring * k, cx + Math.sin(a) * ring * k); g.lineTo(cx + Math.cos(a) * (ring + 1.6) * k, cx + Math.sin(a) * (ring + 1.6) * k); g.stroke();
    }
  }
  const ringL = (r, w, a) => { ge.strokeStyle = `rgba(90,255,150,${a})`; ge.lineWidth = w * k; ge.beginPath(); ge.arc(cx, cx, r * k, 0, Math.PI * 2); ge.stroke(); };
  ringL(R - 0.5, 0.25, 0.8); ringL(R - 1.6, 0.06, 0.35); ringL(8.6, 0.08, 0.35); ringL(DAIS.r + 0.5, 0.1, 0.45); ringL(DAIS.r + 0.9, 0.04, 0.3);
  // rays from the dais to each pillar, and between them to the south
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    ge.strokeStyle = 'rgba(90,255,150,0.16)'; ge.lineWidth = 0.05 * k;
    ge.beginPath(); ge.moveTo(cx + Math.sin(a) * (DAIS.r + 0.9) * k, cx + Math.cos(a) * (DAIS.r + 0.9) * k); ge.lineTo(cx + Math.sin(a) * 8.6 * k, cx + Math.cos(a) * 8.6 * k); ge.stroke();
  }
  for (const p of HALL_PILLARS) {
    const x = cx + (p.x - C.x) * k, y = cx + (p.z - C.z) * k;
    ge.strokeStyle = 'rgba(110,255,170,0.5)'; ge.lineWidth = 0.12 * k;
    ge.beginPath(); ge.arc(x, y, 1.7 * k, 0, Math.PI * 2); ge.stroke();
    ge.strokeStyle = 'rgba(90,255,150,0.28)'; ge.lineWidth = 0.06 * k;
    ge.beginPath(); ge.moveTo(cx, cx); ge.lineTo(x, y); ge.stroke();
  }
  g.globalAlpha = 0.45;
  g.drawImage(e, 0, 0); // the lit lines read as cut grooves too
  g.globalAlpha = 1;
  const map = new THREE.CanvasTexture(c), emap = new THREE.CanvasTexture(e);
  map.colorSpace = emap.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = emap.anisotropy = 8;
  const floorMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.28, metalness: 0.35 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  group.add(floor);
  P.fixedCollider(hullPrism(64, R + 0.5, R + 0.5, 2).setFriction(0.9), { x: C.x, y: C.y - 1, z: C.z });

  // ---- the tower under it, down to the city floor, banded with light
  const prof = [[R, 0], [R + 0.5, -0.3], [R + 0.5, -1.5], [R - 0.6, -2.4], [R - 0.6, -9], [R + 1.6, -11], [R + 1.6, -13], [R - 1.2, -15.5], [R - 2.4, -40], [R + 0.5, -44], [R + 0.5, -47], [R - 2.8, -50], [R - 3.5, -120], [R + 2, -126], [R + 4, -233]];
  const tower = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 96), new THREE.MeshStandardMaterial({ color: 0x182025, roughness: 0.5, metalness: 0.6 }));
  group.add(tower);
  for (const [r, y, w] of [[R + 1.65, -12, 0.12], [R - 1.0, -15.7, 0.1], [R + 0.55, -45.5, 0.15], [R + 2.05, -125, 0.3]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 128), light(0.2, 1.4, 0.6));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }
  // vertical seams of light down the shaft
  const seamGeo = new THREE.BoxGeometry(0.16, 22, 0.16);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2, r = R - 2.3;
    const m = new THREE.Mesh(seamGeo, seamMat);
    m.position.set(Math.sin(a) * r, -28, Math.cos(a) * r);
    group.add(m);
  }

  // ---- the parapet: a low wall round the south half, open to the north and at the landing (south)
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.3, 10, 160), metal);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.16;
  lip.castShadow = lip.receiveShadow = true;
  group.add(lip);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.035, 6, 160), light(0.25, 1.6, 0.7));
  cap.rotation.x = Math.PI / 2;
  cap.position.y = 0.46;
  group.add(cap);

  // ---- the dais
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(DAIS.r, DAIS.r + 0.25, DAIS.h, 64).translate(0, DAIS.h / 2, 0), new THREE.MeshStandardMaterial({ color: 0x1d2328, roughness: 0.3, metalness: 0.55 }));
  dais.castShadow = dais.receiveShadow = true;
  group.add(dais);
  // its top: the Corps emblem in light
  const ec = document.createElement('canvas');
  ec.width = ec.height = 512;
  const eg = ec.getContext('2d');
  eg.strokeStyle = eg.fillStyle = 'rgba(120,255,175,0.9)';
  eg.lineWidth = 30;
  eg.beginPath(); eg.arc(256, 256, 120, 0, Math.PI * 2); eg.stroke();
  eg.fillRect(60, 150, 392, 26); eg.fillRect(60, 336, 392, 26);
  eg.lineWidth = 6;
  eg.beginPath(); eg.arc(256, 256, 246, 0, Math.PI * 2); eg.stroke();
  const etex = new THREE.CanvasTexture(ec);
  etex.colorSpace = THREE.SRGBColorSpace;
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(DAIS.r - 0.15, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: etex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.22, 0.6, 0.36) }));
  emblem.position.y = DAIS.h + 0.004;
  group.add(emblem);
  const daisRing = new THREE.Mesh(new THREE.TorusGeometry(DAIS.r + 0.02, 0.03, 6, 96), light(0.25, 1.6, 0.7));
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = DAIS.h;
  group.add(daisRing);
  P.fixedCollider(hullPrism(32, DAIS.r, DAIS.r + 0.25, DAIS.h), { x: C.x, y: C.y + DAIS.h / 2, z: C.z });

  // ---- the pillars: tall fluted columns, each crowned with a platform for its Guardian
  const pillarGeo = (h) => {
    const pr = [[0, 0], [1.25, 0], [1.25, 0.25], [1.05, 0.4], [1.05, 0.62], [0.78, 0.8], [0.66, 1.2], [0.56, h - 1.4], [0.62, h - 1.0], [1.05, h - 0.55], [1.5, h - 0.32], [1.5, h], [0, h]];
    return new THREE.LatheGeometry(pr.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  };
  const glow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.4)');
  oa.hallLights = [];
  for (const p of HALL_PILLARS) {
    const col = new THREE.Group();
    col.position.set(p.x - C.x, 0, p.z - C.z);
    col.rotation.y = p.yaw;
    group.add(col);
    const m = new THREE.Mesh(pillarGeo(p.h), metal);
    m.castShadow = m.receiveShadow = true;
    col.add(m);
    // a seam of light up the face toward the dais, and a lit rim round the platform
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, p.h - 2.6, 0.045), seamMat);
    seam.position.set(0, p.h / 2, 0.62);
    seam.rotation.x = -Math.atan2(0.1, p.h - 2.6);
    col.add(seam);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 6, 64), light(0.25, 1.7, 0.75));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = p.h - 0.02;
    col.add(rim);
    const base = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.03, 6, 64), seamMat);
    base.rotation.x = Math.PI / 2;
    base.position.y = 0.26;
    col.add(base);
    P.fixedCollider(hullPrism(16, 0.7, 1.2, p.h), { x: p.x, y: C.y + p.h / 2, z: p.z });
    // the platform's glow from below, faintly lighting its Guardian
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.25, 0.8, 0.45), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    halo.scale.setScalar(3.2);
    halo.position.set(0, p.h - 0.4, 0);
    col.add(halo);
  }

  // ---- the great ring hanging over the hall, tilted toward the battery
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x1c2328, roughness: 0.35, metalness: 0.8, emissive: new THREE.Color(0.05, 0.4, 0.18), emissiveIntensity: 1 });
  const bigRing = new THREE.Mesh(new THREE.TorusGeometry(14, 0.55, 16, 160), ringMat);
  bigRing.position.set(0, 21, -3);
  bigRing.rotation.set(Math.PI / 2 - 0.22, 0, 0);
  group.add(bigRing);
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(14, 0.06, 6, 160), light(0.3, 2.0, 0.9));
  ringLight.position.copy(bigRing.position);
  ringLight.rotation.copy(bigRing.rotation);
  ringLight.position.y -= 0.5;
  group.add(ringLight);

  // ---- the bier: a slab of dark stone on two pedestals, its edges lit from within
  const bier = new THREE.Group();
  bier.position.copy(BIER).sub(C);
  group.add(bier);
  const stone = new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.3, metalness: 0.5 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 0.9), stone);
  slab.position.y = 0.92;
  slab.castShadow = slab.receiveShadow = true;
  bier.add(slab);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.025, 0.92), light(0.2, 1.3, 0.55));
  edge.position.y = 0.87;
  bier.add(edge);
  for (const x of [-0.85, 0.85]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.84, 24).translate(0, 0.42, 0), metal);
    ped.position.x = x;
    ped.castShadow = true;
    bier.add(ped);
  }
  P.fixedCollider(RAPIER.ColliderDesc.cuboid(1.25, 0.5, 0.45), { x: BIER.x, y: BIER.y + 0.5, z: BIER.z });
  const bierLight = new THREE.PointLight(0x55ff99, 0.6, 4, 2);
  bierLight.position.set(0, 1.6, 0);
  bier.add(bierLight);

  // ---- light for the ceremony: the Guardians lit from in front and above; a cool fill on the floor
  const key = new THREE.SpotLight(0xdfe9ff, 900, 70, 0.62, 0.7, 2);
  key.position.set(0, 26, 12);
  key.target.position.set(0, 9, -11);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  group.add(key, key.target);
  const fill = new THREE.PointLight(0x9fc2ff, 60, 30, 2);
  fill.position.set(0, 6, 4);
  group.add(fill);

  return {
    group, slabTop: BIER.y + 1.0, bier, key, fill,
    // ground under Hal: the dais, the floor, or nothing
    ground(x, z) {
      const d = Math.hypot(x - C.x, z - C.z);
      if (d < DAIS.r) return DAIS_TOP;
      return d < R + 0.4 ? C.y : null;
    },
    canLand(x, z) {
      const d = Math.hypot(x - C.x, z - C.z);
      if (d > R - 0.8) return false;
      if (Math.abs(x - BIER.x) < 1.6 && Math.abs(z - BIER.z) < 0.8) return false;
      return !HALL_PILLARS.some((p) => Math.hypot(x - p.x, z - p.z) < 1.6);
    },
    contains(x, z, margin = 0) { return Math.hypot(x - C.x, z - C.z) < R + margin; },
  };
}
