import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Every construct the ring can make, in wheel order (clockwise from the top). `cost` is ring charge
// in percent per use, `drain` per second while held; `range` is [min, max] metres from Hal.
export const CONSTRUCTS = [
  { id: 'fist', name: 'Fist', kind: 'attack', cost: 6, range: [2, 14], desc: 'A giant fist that strikes where you aim. Reaches 14 m.' },
  { id: 'gatling', name: 'Gatling', kind: 'attack', cost: 1, perShot: 0.12, rate: 14, damage: 6, range: [2, 45], desc: 'Rotary cannon. Hold to spin up and fire. Reaches 45 m.' },
  { id: 'sword', name: 'Sword', kind: 'attack', cost: 3, perSwing: 0.8, damage: 24, range: [0, 5], desc: 'A blade of light. Click to cut; click in rhythm for a three-cut combo. Lunges at a target you aim at.' },
  { id: 'staff', name: 'Staff', kind: 'attack', desc: 'Long reach, sweeping strikes.' },
  { id: 'hammer', name: 'Hammer', kind: 'utility', desc: 'Smash through cover and barriers.' },
  { id: 'axe', name: 'Axe', kind: 'utility', desc: 'Cut through debris and wreckage.' },
  { id: 'wall', name: 'Wall', kind: 'defense', cost: 10, range: [2.5, 20], life: 20, desc: 'A barrier raised where you aim. Holds for 20 s.' },
  { id: 'shield', name: 'Shield', kind: 'defense', cost: 2, drain: 3, desc: 'Held in front of you while the button is down.' },
];
export const constructInfo = (id) => CONSTRUCTS.find((c) => c.id === id);
export const KINDS = { attack: 'Attack', defense: 'Defense', utility: 'Utility' };

const NOISE = /* glsl */ `
  float cHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float cNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(cHash(i), cHash(i + vec3(1,0,0)), f.x), mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x), mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float hexDist(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
  // 1 on the borders of a hex grid with cells of size s
  float hexLines(vec2 uv, float s) {
    uv /= s;
    const vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
    vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    return 1.0 - smoothstep(0.03, 0.075, 0.5 - hexDist(g));
  }
  // running-bond brickwork, rows of height s
  float brickLines(vec2 uv, float s) {
    uv /= s;
    float row = floor(uv.y);
    uv.x += mod(row, 2.0) * 0.5 * 2.2;
    vec2 f = fract(vec2(uv.x / 2.2, uv.y));
    vec2 e = min(f, 1.0 - f) * vec2(2.2, 1.0);
    return 1.0 - smoothstep(0.035, 0.08, min(e.x, e.y));
  }
`;

const VERT = /* glsl */ `
  uniform float uInflate;
  varying vec3 vN, vV, vL, vLN, vW;
  void main() {
    vec3 p = position + normal * uInflate;
    vL = position; vLN = normal;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// pattern: 0 none, 1 hex, 2 brick. emblem: draws the lantern emblem on the +Z face.
const FRAG = /* glsl */ `
  uniform float uTime, uForm, uOpacity, uGhost, uPattern, uScale, uEmblem, uHit, uOutline;
  uniform vec3 uColor, uRim, uHitPos;
  uniform vec2 uFadeZ;
  varying vec3 vN, vV, vL, vLN, vW;
  ${NOISE}
  float pattern(vec3 p, vec3 n) {
    if (uPattern < 0.5) return 0.0;
    vec3 a = abs(n);
    vec2 uv = a.z >= a.x && a.z >= a.y ? p.xy : a.x >= a.y ? p.zy : p.xz;
    return uPattern < 1.5 ? hexLines(uv, uScale) : brickLines(uv, uScale);
  }
  float emblem(vec2 p) {
    float ring = abs(length(p) - 0.25) - 0.045;
    float bars = max(abs(abs(p.y) - 0.205) - 0.035, abs(p.x) - 0.43);
    return 1.0 - smoothstep(0.0, 0.012, min(ring, bars));
  }
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    vec3 q = vL * 2.6 + vec3(0.0, -uTime * 0.7, uTime * 0.25);
    float flow = cNoise(q) * 0.6 + cNoise(q * 2.7) * 0.4;
    float lines = pattern(vL, vLN);
    float mark = uEmblem > 0.5 && vLN.z > 0.5 ? emblem(vL.xy - vec2(0.0, 0.12)) : 0.0;
    // formation: the shape fills in through noise, with a bright crackling edge
    float field = cNoise(vL * 4.5) * 0.75 + cNoise(vL * 13.0) * 0.25;
    float gap = uForm * 1.15 - field;
    if (gap < 0.0) discard;
    float edge = 1.0 - smoothstep(0.0, 0.09, gap);
    float fadeZ = uFadeZ.x < uFadeZ.y ? smoothstep(uFadeZ.x, uFadeZ.y, vL.z) : 1.0;
    float ripple = 0.0;
    if (uHit > 0.0) { float d = distance(vW, uHitPos); ripple = exp(-pow((d - (1.0 - uHit) * 1.8) * 5.0, 2.0)) * uHit; }
    vec3 col; float alpha;
    if (uOutline > 0.5) {
      col = uRim * 0.85;
      alpha = (0.5 + 0.5 * fres) * uOpacity;
    } else if (uGhost > 0.5) {
      float scan = 0.55 + 0.45 * sin(vW.y * 38.0 - uTime * 7.0);
      float flick = 0.88 + 0.12 * sin(uTime * 41.0) * sin(uTime * 17.0);
      col = uColor * (0.035 + fres * 0.5 + lines * 0.22 + mark * 0.3) * scan * flick;
      alpha = 1.0;
    } else {
      // lit from above so the form reads (knuckles, finger joints, the curve of a shield)
      float lam = 0.5 + 0.5 * dot(normalize(vN), vec3(-0.3, 0.86, 0.4));
      col = uColor * (0.22 + 0.78 * lam * lam) * (0.75 + 0.4 * flow) + uRim * (fres * 0.75 + lines * 0.55 + mark * 1.2 + ripple * 2.0);
      alpha = uOpacity * clamp(0.5 + 0.2 * flow + fres * 0.4 + lines * 0.3 + mark * 0.5, 0.0, 1.0);
    }
    col += uRim * edge * 2.5;
    alpha = min(1.0, alpha + edge);
    gl_FragColor = vec4(col * fadeZ * (uGhost > 0.5 || uOutline > 0.5 ? uOpacity : 1.0), alpha * fadeZ);
  }
`;

const GREEN = new THREE.Color(0.05, 0.72, 0.2), RIM = new THREE.Color(0.16, 1.45, 0.42);
const GHOST = new THREE.Color(0.4, 1.3, 0.95), BAD = new THREE.Color(1.5, 0.3, 0.16);

function uniforms(opts) {
  return {
    uTime: { value: 0 }, uForm: { value: 1 }, uOpacity: { value: 1 }, uGhost: { value: 0 }, uOutline: { value: 0 },
    uPattern: { value: 0 }, uScale: { value: 0.25 }, uEmblem: { value: 0 }, uInflate: { value: 0 },
    uHit: { value: 0 }, uHitPos: { value: new THREE.Vector3() }, uFadeZ: { value: new THREE.Vector2(0, 0) },
    uColor: { value: GREEN.clone() }, uRim: { value: RIM.clone() },
    ...Object.fromEntries(Object.entries(opts).map(([k, v]) => [k, { value: v }])),
  };
}

// The solid construct: translucent green body, bright fresnel rim, panel lines, plus an additive
// inverted-hull outline for the hard bright edge of the reference constructs. A depth-only pass
// first means only the nearest surface is coloured (no inner parts stacking up through the glass).
export function constructMesh(geometry, opts = {}) {
  const u = uniforms(opts);
  const depth = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, colorWrite: false }));
  const body = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth }));
  const ou = { ...u, uOutline: { value: 1 }, uInflate: { value: opts.outline ?? 0.022 } };
  const outline = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: ou, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
  depth.renderOrder = 19;
  body.renderOrder = 20;
  outline.renderOrder = 21;
  const group = new THREE.Group();
  group.add(depth, body, outline);
  group.userData.u = u;
  group.userData.ou = ou;
  group.userData.set = (name, value) => { u[name].value = value; ou[name].value = value; };
  return group;
}

// Hologram preview of where a construct will form.
export function ghostMesh(geometry, opts = {}) {
  const u = uniforms({ ...opts, uGhost: 1, uOpacity: 0.85 });
  u.uColor.value.copy(GHOST);
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.renderOrder = 22;
  mesh.userData.u = u;
  mesh.userData.valid = (ok) => u.uColor.value.copy(ok ? GHOST : BAD);
  return mesh;
}

// ------------------------------------------------------------------------------------- shapes
const box = (w, h, d, x, y, z, r = 0.08, rot) => {
  const g = new RoundedBoxGeometry(w, h, d, 3, r);
  if (rot) g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
  return g.translate(x, y, z);
};

// A clenched right fist, knuckles toward +Z, back of the hand up, thumb on +X (the hand's inside),
// trailing a forearm that fades out behind it. About 1 m across.
export function fistGeometry() {
  const parts = [box(0.86, 0.56, 0.62, 0, 0, -0.06, 0.15)];
  const fingers = [[0.3, 0.2, 0], [0.1, 0.2, 0.025], [-0.1, 0.195, 0.01], [-0.29, 0.17, -0.03]];
  fingers.forEach(([x, w, dz], i) => {
    const s = i === 3 ? 0.9 : 1;
    parts.push(box(w, 0.25 * s, 0.32, x, 0.08 - (1 - s) * 0.1, 0.33 + dz, 0.095)); // knuckle row
    parts.push(box(w * 0.98, 0.31 * s, 0.21, x, -0.13 - (1 - s) * 0.06, 0.42 + dz, 0.09)); // folded down
    parts.push(box(w * 0.94, 0.16, 0.25, x, -0.26, 0.22 + dz * 0.5, 0.07)); // tucked tips
  });
  parts.push(box(0.25, 0.22, 0.4, 0.47, -0.1, 0.1, 0.1, [0, -0.45, 0.25])); // thumb base
  parts.push(box(0.38, 0.19, 0.2, 0.25, -0.2, 0.55, 0.09, [0.05, 0.18, 0.12])); // thumb across the fingers
  const wrist = new THREE.CylinderGeometry(0.27, 0.23, 1.1, 32, 1, true).rotateX(Math.PI / 2).scale(1.25, 1, 1).translate(0, -0.03, -0.85);
  parts.push(wrist);
  const geo = mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
  return mergeVertices(geo, 1e-4).scale(1.08, 1.08, 1.08);
}

// A heater shield facing +Z, curved toward its bearer, ~1.35 m wide and 1.75 m tall.
export function shieldGeometry() {
  const w = 0.78, s = new THREE.Shape();
  s.moveTo(-w, 0.92);
  s.quadraticCurveTo(0, 1.04, w, 0.92);
  s.lineTo(w, 0.3);
  s.quadraticCurveTo(w * 0.96, -0.58, 0, -1.02);
  s.quadraticCurveTo(-w * 0.96, -0.58, -w, 0.3);
  s.closePath();
  let geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, curveSegments: 28, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3 });
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, p.getZ(i) - 0.02 - 0.22 * (x / w) ** 2 - 0.05 * (y + 0.1) ** 2);
  }
  geo.computeVertexNormals();
  return geo.scale(0.86, 0.86, 0.86);
}

// A rotary cannon held at the hip, barrels along +Z. Returns the spinning barrel cluster and the
// static body separately, plus where the hands go (local space).
export function gatlingGeometry() {
  const strip = (g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
  const barrels = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    barrels.push(new THREE.CylinderGeometry(0.026, 0.026, 0.95, 10, 1).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.62));
  }
  for (const [z, r, d] of [[1.04, 0.112, 0.05], [0.62, 0.1, 0.04], [0.2, 0.118, 0.14]]) barrels.push(new THREE.CylinderGeometry(r, r, d, 24).rotateX(Math.PI / 2).translate(0, 0, z));
  barrels.push(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 10).rotateX(Math.PI / 2).translate(0, 0, 0.6)); // spindle
  const body = [
    box(0.26, 0.27, 0.5, 0, 0, -0.14, 0.06),
    box(0.2, 0.08, 0.34, 0, 0.17, -0.12, 0.03), // top rail
    new THREE.CylinderGeometry(0.15, 0.15, 0.22, 28).rotateZ(Math.PI / 2).translate(-0.24, -0.02, -0.12), // ammo drum
    new THREE.TorusGeometry(0.11, 0.022, 8, 20, Math.PI).translate(0, 0.21, 0.02).rotateX(0), // carry handle
    box(0.06, 0.17, 0.08, 0, -0.2, -0.3, 0.025, [0.35, 0, 0]), // pistol grip
    box(0.05, 0.05, 0.22, 0.13, -0.08, 0.22, 0.02), // fore-grip rail
  ];
  const merge = (parts) => mergeVertices(mergeGeometries(parts.map(strip)), 1e-4);
  return { barrels: merge(barrels), body: merge(body), grip: new THREE.Vector3(0, -0.24, -0.31), fore: new THREE.Vector3(0.14, -0.11, 0.28), muzzle: new THREE.Vector3(0, 0, 1.1) };
}

// A straight sword along +Y, hilt at the origin: a long diamond-section blade, a guard shaped like the
// emblem (its two bars and ring), a short grip and a pommel. About 1.3 m.
export function swordGeometry() {
  const strip = (g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
  const parts = [
    new THREE.CylinderGeometry(0.029, 0.037, 0.92, 4, 1).scale(1, 1, 0.3).translate(0, 0.63, 0), // blade
    new THREE.CylinderGeometry(0.0, 0.029, 0.2, 4, 1).scale(1, 1, 0.3).translate(0, 1.19, 0), // point
    box(0.34, 0.038, 0.06, 0, 0.14, 0, 0.016),
    box(0.2, 0.03, 0.05, 0, 0.085, 0, 0.012),
    new THREE.TorusGeometry(0.05, 0.012, 8, 24).translate(0, 0.112, 0),
    new THREE.CylinderGeometry(0.019, 0.022, 0.2, 12).translate(0, -0.02, 0), // grip
    new THREE.SphereGeometry(0.032, 14, 10).translate(0, -0.14, 0), // pommel
  ];
  return { geo: mergeVertices(mergeGeometries(parts.map(strip)), 1e-4), base: new THREE.Vector3(0, 0.17, 0), tip: new THREE.Vector3(0, 1.29, 0) };
}

// A construct blade in a hand, with a ribbon of light trailing the edge while it moves fast. Shared
// by Hal's sword and Sinestro's. `place(position, bladeDir, edgeDir)` each frame; `form` 0..1.
export class Blade {
  constructor(scene, sword, { outline = 0.008 } = {}) {
    this.sword = sword;
    this.mesh = constructMesh(sword.geo, { uPattern: 0, outline });
    this.mesh.userData.set('uForm', 0);
    scene.add(this.mesh);
    this.n = 6; // a short swoosh: about a tenth of a second of the edge's path
    this.hist = Array.from({ length: this.n }, () => [new THREE.Vector3(), new THREE.Vector3()]);
    this.filled = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3);
    this.age = new Float32Array(this.n * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1));
    const idx = [];
    for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    for (let i = 0; i < this.n; i++) { this.age[i * 2] = this.age[i * 2 + 1] = i / (this.n - 1); }
    this.trailU = { uOpacity: { value: 0 } };
    this.trail = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.trailU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float aAge; varying float vAge; void main(){ vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vAge; void main(){ float a = pow(1.0 - vAge, 2.5) * uOpacity; gl_FragColor = vec4(vec3(0.2, 1.1, 0.45) * a, 1.0); }',
    }));
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 22;
    scene.add(this.trail);
    this.base = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this.prevBase = new THREE.Vector3();
    this.prevTip = new THREE.Vector3();
    this.form = 0;
  }

  place(position, bladeDir, edgeDir) {
    const y = _bY.copy(bladeDir).normalize(), z = _bZ.crossVectors(edgeDir, y).normalize(), x = _bX.crossVectors(y, z);
    this.mesh.position.copy(position);
    this.mesh.quaternion.setFromRotationMatrix(_bM.makeBasis(x, y, z));
    this.mesh.updateMatrixWorld(true);
    this.prevBase.copy(this.base);
    this.prevTip.copy(this.tip);
    this.mesh.localToWorld(this.base.copy(this.sword.base));
    this.mesh.localToWorld(this.tip.copy(this.sword.tip));
  }

  update(dt, time) {
    this.mesh.userData.set('uForm', this.form);
    this.mesh.userData.set('uTime', time);
    if (dt <= 0) return;
    // the trail follows the edge; it shows while the tip moves fast
    const speed = this.tip.distanceTo(this.prevTip) / dt;
    this.trailU.uOpacity.value = Math.min(1, Math.max(0, (speed - 4) / 8)) * this.form * 0.45;
    const last = this.hist.pop();
    last[0].copy(this.base).lerp(this.tip, 0.45);
    last[1].copy(this.tip);
    this.hist.unshift(last);
    this.filled = Math.min(this.n, this.filled + 1);
    for (let i = 0; i < this.n; i++) {
      const h = this.hist[Math.min(i, this.filled - 1)];
      this.pos.set([h[0].x, h[0].y, h[0].z, h[1].x, h[1].y, h[1].z], i * 6);
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.trail.removeFromParent();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
  }
}
const _bX = new THREE.Vector3(), _bY = new THREE.Vector3(), _bZ = new THREE.Vector3(), _bM = new THREE.Matrix4();

// A brick wall standing on y = 0, facing ±Z. Extra height runs below ground to bury the base.
export const WALL = { width: 4.2, height: 2.7, depth: 0.3, buried: 0.45 };
export function wallGeometry() {
  const { width, height, depth, buried } = WALL;
  return new RoundedBoxGeometry(width, height + buried, depth, 2, 0.06).translate(0, (height + buried) / 2 - buried, 0);
}

// Thin additive beam between two points (the ring's tether to a construct).
export function createBeam(radius = 0.035) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 10, 1, true).translate(0, 0.5, 0);
  const u = { uTime: { value: 0 }, uOpacity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying float vT; varying vec3 vN, vV; void main(){ vT = position.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uTime, uOpacity; varying float vT; varying vec3 vN, vV; void main(){ float c = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); float pulse = 0.65 + 0.35 * sin(vT * 30.0 - uTime * 40.0); gl_FragColor = vec4(vec3(0.5, 3.0, 1.2) * c * pulse * uOpacity, 1.0); }',
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 23;
  mesh.frustumCulled = false;
  const _d = new THREE.Vector3();
  mesh.userData.u = u;
  mesh.userData.span = (a, b) => {
    _d.subVectors(b, a);
    const len = Math.max(1e-3, _d.length());
    mesh.position.copy(a);
    mesh.quaternion.setFromUnitVectors(_Y, _d.divideScalar(len));
    mesh.scale.set(1, len, 1);
  };
  return mesh;
}
const _Y = new THREE.Vector3(0, 1, 0);

// Random points on a geometry's surface (for formation sparks), in its local space.
export function surfaceSamples(geometry, n = 200) {
  const p = geometry.attributes.position, out = [];
  for (let i = 0; i < n; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, Math.floor(Math.random() * p.count)));
  return out;
}
