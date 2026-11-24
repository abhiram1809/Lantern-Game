import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityU } from './Kit.js';
import { pbrMaterial } from '../fx/Textures.js';
import { RAPIER } from '../engine/Physics.js';
import { LOT_Z } from './Plan.js';
import { buildHighway, highwaySigns } from './Highway.js';
import { buildBridge, BRIDGE_SIGNS } from './Bridge.js';
import { average } from './Lod.js';

// What makes a city besides its blocks: Highway 1 round it on its piers, its ramps and its spurs over the river
// (city/Highway.js), and the Coast Bay Bridge on the road from the field (city/Bridge.js). (The old straight
// viaduct down the street at z 1070 and the flood channel are gone: the map rework of 2026-11-24, city/Layout.js.)
// Built once with the city (Stream.steps), in the lot's frame, every part of it solid: one triangle collider for each
// stretch of highway (its deck, parapets, piers, lamps' masts and gantries' posts) and one for the bridge.
const ORIGIN = new THREE.Vector3(0, 0, LOT_Z);

// The signs, all in one canvas: Highway 1's green guide signs (the route's shield, the exit's number tab, the
// places in white, the distance or EXIT ONLY under them, an arrow down to the lane), the bridge's at its ends.
const CELL = { w: 512, h: 216, cols: 4 };
function signAtlas(list) {
  const rows = Math.ceil(list.length / CELL.cols), c = document.createElement('canvas');
  c.width = CELL.w * CELL.cols; c.height = 2 ** Math.ceil(Math.log2(CELL.h * rows));
  const g = c.getContext('2d'), rects = new Map();
  g.fillStyle = '#5a5e60'; g.fillRect(0, 0, c.width, c.height);
  list.forEach((s, i) => {
    const x = (i % CELL.cols) * CELL.w, y = Math.floor(i / CELL.cols) * CELL.h, W = CELL.w, H = CELL.h;
    g.save(); g.translate(x, y);
    // the panel: green (the bridge's too), a white border inset, the corners rounded
    g.fillStyle = '#0f6b3c';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f1f3ef'; g.lineWidth = 6;
    roundRect(g, 9, 9, W - 18, H - 18, 14); g.stroke();
    // the exit's number on a tab at the top right
    if (s.exit) {
      g.fillStyle = '#f1f3ef'; g.font = '700 25px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'top';
      g.fillText(`EXIT ${s.exit}`, W - 24, 18);
    }
    // the route's shield on the left: a green spade, "1"
    if (!s.bridge) shield(g, 26, 44, 74);
    const left = s.bridge ? 34 : 116;
    g.fillStyle = '#f6f7f3'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    s.lines.forEach((t, k) => {
      let size = k === 0 ? 52 : 42;
      g.font = `600 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
      while (g.measureText(t).width > W - left - 34 && size > 24) { size -= 2; g.font = `600 ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`; }
      g.fillText(t, left, 94 + k * 50);
    });
    if (s.sub) {
      g.font = '700 26px "Arial Narrow", Arial, sans-serif';
      if (s.sub === 'EXIT ONLY') { g.fillStyle = '#f2c230'; g.fillRect(left - 6, H - 58, 168, 36); g.fillStyle = '#111'; }
      else g.fillStyle = '#f6f7f3';
      g.fillText(s.sub, left, H - 31);
    }
    // the arrow down to the lane, or right toward the exit
    if (s.arrow) {
      g.fillStyle = '#f6f7f3';
      g.save(); g.translate(W - 70, H - 64);
      if (s.arrow === 'right') g.rotate(-Math.PI / 4);
      g.beginPath(); g.moveTo(-9, -30); g.lineTo(9, -30); g.lineTo(9, 4); g.lineTo(22, 4); g.lineTo(0, 30); g.lineTo(-22, 4); g.lineTo(-9, 4); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    // (in the texture's 0..1, v up: three.js flips the canvas)
    rects.set(s.id, [x / c.width + 0.002, 1 - (y + H) / c.height + 0.002, (x + W) / c.width - 0.002, 1 - y / c.height - 0.002]);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, rects };
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// a state route's shield: a spade, white edged, its number
function shield(g, x, y, s) {
  g.save(); g.translate(x, y);
  const path = () => { g.beginPath(); g.moveTo(s * 0.5, s * 1.08); g.bezierCurveTo(s * 0.12, s * 0.86, -s * 0.02, s * 0.5, s * 0.06, s * 0.18); g.lineTo(s * 0.5, 0); g.lineTo(s * 0.94, s * 0.18); g.bezierCurveTo(s * 1.02, s * 0.5, s * 0.88, s * 0.86, s * 0.5, s * 1.08); g.closePath(); };
  path(); g.fillStyle = '#f1f3ef'; g.fill();
  g.scale(0.86, 0.86); g.translate(s * 0.08, s * 0.08);
  path(); g.fillStyle = '#1a7a48'; g.fill();
  g.restore();
  g.fillStyle = '#f6f7f3'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(s * 0.58)}px "Arial Narrow", Arial, sans-serif`;
  g.fillText('1', x + s * 0.5, y + s * 0.56);
  g.font = `700 ${Math.round(s * 0.13)}px Arial, sans-serif`;
  g.fillText('COAST', x + s * 0.5, y + s * 0.2);
}

// a material lit at night from inside (cityU.uNight, the city's 0 by day to 1 at night): its emissive by `day` + `night`
function nightLit(mat, day, night, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = cityU.uNight;
    sh.uniforms.uLit = { value: new THREE.Vector2(day, night) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; uniform vec2 uLit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uLit.x + uLit.y * uNight;');
  };
  mat.customProgramCacheKey = () => `nightLit${key}`;
  return mat;
}

export function* buildLandmarks(stream) {
  const f = stream.f, P = f.physics, mats = stream.mats;
  // ---- the materials (the city's where they'll do: their programs are compiled already)
  const asphalt = Object.assign(pbrMaterial('asphalt_02', { repeat: [1 / 6, 1 / 6], tint: new THREE.Color(0.84, 0.82, 0.8), roughness: 1 }), { vertexColors: true });
  const { texture, rects } = signAtlas([...highwaySigns(), ...BRIDGE_SIGNS]);
  const sign = nightLit(new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, roughness: 0.55, metalness: 0.1, vertexColors: true }), 0.05, 0.55, 'sign');
  const far = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  // (cast concrete, clean and pale: the city's weathered concrete, grimed toward the ground, read as old wood on a
  // girder in its own shade)
  // (smooth cast concrete: the plaster's grain and its roughness, not its colour, which is blotched brown at this size)
  const cast = (rep, normal, grey) => {
    const m = pbrMaterial('white_plaster_02', { repeat: [1 / rep, 1 / rep], roughness: 0.86, normalScale: normal });
    m.map = null; m.vertexColors = true; m.color.setScalar(grey);
    return m;
  };
  // the highway's: the concrete floor's stains and patches kept, but grey and at half their contrast (as they are, a
  // girder in its own shade read as brown, mottled like old wood)
  const concrete = Object.assign(pbrMaterial('concrete_floor_02', { repeat: [1 / 5, 1 / 5], roughness: 0.9, normalScale: 0.5 }), { vertexColors: true });
  concrete.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      { float l = dot(texture2D(map, vMapUv).rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb *= 0.62 + (l - 0.42) * 0.55; }
    #endif`);
  };
  concrete.customProgramCacheKey = () => 'highwayConcrete';
  concrete.color.setScalar(1.0);
  const M = {
    concrete, asphalt, paint: mats.roadpaint, metal: mats.iron, lamp: mats.lamp, pool: stream.pool, sign, far,
  };
  // the bridge's own: its concrete whiter and smoother (the user's reference: a big white-grey bridge), white-painted
  // steel, the stays (a faint cool light in them at night), its red lights and the towers' floodlight wash
  const bridgeConcrete = cast(7, 0.35, 0.8);
  const steel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });
  const stays = nightLit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, emissive: new THREE.Color(0.72, 0.84, 1.0) }), 0, 0.4, 'stays');
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.12, 0.06) });
  const flood = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.94, 0.84), vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const BM = { concrete: bridgeConcrete, steel, asphalt, paint: mats.roadpaint, stays, lamp: mats.lamp, pool: stream.pool, red, flood, sign };
  // ---- the colliders: triangles, in the world
  const bodies = [];
  const trimesh = (pos, idx) => {
    if (!idx.length) return null;
    for (let i = 0; i < pos.length; i += 3) { pos[i] += ORIGIN.x; pos[i + 1] += ORIGIN.y; pos[i + 2] += ORIGIN.z; }
    const body = P.fixedCollider(RAPIER.ColliderDesc.trimesh(pos, idx).setFriction(0.9));
    bodies.push(body);
    return body;
  };
  const g = new THREE.Group();
  g.name = 'landmarks';
  g.position.copy(ORIGIN);
  const highway = yield* buildHighway({ mats: M, signRects: rects, trimesh });
  yield;
  const bridge = yield* buildBridge({ mats: BM, signRects: rects, trimesh });
  g.add(highway.group, bridge.group);
  const bridgeFar = farBridge(bridge.group);
  g.add(bridgeFar);
  g.traverse((o) => { if (o.isMesh && o.receiveShadow === undefined) o.receiveShadow = true; });
  g.updateMatrixWorld(true);
  g.traverse((o) => { o.matrixAutoUpdate = false; });
  stream.root.add(g);
  // ---- each frame: which stretches of the highway are near enough to be themselves, and the lights' night
  const camera = f.engine.camera;
  highway.update(1, camera, ORIGIN, true);
  // (the lamps' pools on the roads are drawn only at night: transparent at nothing, they were a draw a chunk by day)
  const pools = [];
  g.traverse((o) => { if (o.isMesh && o.material === stream.pool) pools.push(o); });
  // (the bridge from more than 600 m: its far copy, below)
  const bridgeBox = new THREE.Box3().setFromObject(bridge.group), _cam = new THREE.Vector3();
  const nearBridge = (on) => {
    bridge.group.visible = on;
    bridgeFar.visible = !on;
  };
  nearBridge(bridgeBox.distanceToPoint(camera.getWorldPosition(_cam)) < 600);
  f.updaters.push((dt) => {
    highway.update(dt, camera, ORIGIN);
    const d = bridgeBox.distanceToPoint(camera.getWorldPosition(_cam));
    if (bridge.group.visible ? d > 640 : d < 600) nearBridge(!bridge.group.visible);
    const k = cityU.uNight.value;
    if (flood.userData.k !== k) {
      flood.userData.k = k; flood.opacity = k * 0.3; flood.visible = k > 0.01;
      for (const m of pools) m.visible = k > 0.01;
    }
  });
  return { group: g, bodies, highway, bridge };
}

// The bridge from across the city: its concrete, steel and road one mesh in their colours (each part's vertex colours
// times its material's, and its texture's average: the road's), no shadows; its stays, lamps, red lights, signs and
// the towers' floodlight wash as they are, since they light at night (the stays' glow is the bridge at night). By
// material it was ten draws, eight by day, the tower in sight at the end of Hal's street.
const FAR_PARTS = new Set(['bridge_concrete', 'bridge_steel', 'bridge_asphalt']);
const farBridgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02, name: 'bridgeFar' });
function farBridge(group) {
  const out = new THREE.Group(), geos = [], tint = new THREE.Color();
  out.name = 'baybridgeFar';
  for (const m of group.children) {
    if (!m.isMesh) continue;
    if (m.name === 'bridge_paint') continue; // (its lines: nothing from this far)
    if (!FAR_PARTS.has(m.name)) {
      const c = new THREE.Mesh(m.geometry, m.material);
      Object.assign(c, { name: `${m.name}Far`, renderOrder: m.renderOrder, castShadow: false, receiveShadow: false });
      out.add(c);
      continue;
    }
    tint.copy(m.material.color);
    if (m.material.map) tint.multiply(average(m.material.map) ?? tint.clone().setScalar(0.32)); // (the asphalt: dark, if its texture isn't in yet)
    const g = new THREE.BufferGeometry(), src = m.geometry, n = src.attributes.position.count, col = new Float32Array(n * 3), sc = src.attributes.color;
    for (let i = 0; i < n; i++) { col[i * 3] = (sc ? sc.getX(i) : 1) * tint.r; col[i * 3 + 1] = (sc ? sc.getY(i) : 1) * tint.g; col[i * 3 + 2] = (sc ? sc.getZ(i) : 1) * tint.b; }
    g.setAttribute('position', src.attributes.position);
    g.setAttribute('normal', src.attributes.normal);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(src.index);
    geos.push(g);
  }
  const merged = geos.length ? mergeGeometries(geos, false) : null;
  if (merged) {
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, farBridgeMat);
    mesh.name = 'bridge_far';
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  out.visible = false;
  return out;
}
