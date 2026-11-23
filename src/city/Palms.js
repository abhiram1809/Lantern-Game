// Every palm in Coast City in one field (the graphics rework, 2026-11-23). The two trees of the palms model
// are 9,300 and 6,700 triangles in five parts each, and they stood a thousand down the promenade and the
// streets, each drawn whole from anywhere, twice with its shadow: 4.6 of the street's 9 million triangles.
// Now a tree within `NEAR` of the camera is the model (one instanced mesh for each of its parts, all those
// trees at once), and one further out is its impostor: a card that turns on its trunk to face the camera,
// showing the tree as painted at load from the nearest two of eight sides (blended between them), and a
// card level over its crown painted from above, for looking down on it (4 triangles). (Cards crossed
// through the trunk showed a leaning trunk three times over.) The trees are sorted again when the camera
// has moved a couple of metres. What touches a palm is its collider, made where it's placed (Stream.js,
// HalsBlock.js, Ferris.js); the field only draws.
import * as THREE from 'three';
import { piece, prop } from '../props/Props.js';

export const PALM_KINDS = [/^Palm_tree_001/, /^Palm_tree_002/];
const NEAR = 90, BACK = 8; // (a tree drawn whole goes to its cards a little further out than it came in: no flicker on the line)
const VIEWS = 8, COLS = 4, CW = 256, CH = 384; // the sides it's painted from, and each view's cell in the picture (four by three: the top's is the ninth)
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();

export class PalmField {
  constructor(scene, renderer) {
    this.group = new THREE.Group();
    this.group.name = 'palms';
    scene.add(this.group);
    this.trees = new Map();
    this.next = 1;
    this.dirty = true;
    this.at = new THREE.Vector3(1e9, 0, 0);
    this.near = NEAR; // (how far the trees are drawn whole)
    this.kinds = PALM_KINDS.map((re) => this.kind(re, renderer));
  }

  // a tree's parts (their geometry and materials the prop's own) and its cards
  kind(re, renderer) {
    const o = piece('palms', re, { root: true });
    o.updateMatrixWorld(true);
    const parts = [];
    let R = 0, y0 = Infinity, y1 = -Infinity;
    o.traverse((m) => {
      if (!m.isMesh) return;
      parts.push({ geo: m.geometry, mat: m.material, M: m.matrixWorld.clone(), cast: m.castShadow });
      const P = m.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
        R = Math.max(R, Math.hypot(_v.x, _v.z));
        y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
      }
    });
    R *= 1.03;
    // where piece() stood the tree, against where it stands in the model (for `addPair`)
    const kit = prop('palms');
    kit.updateMatrixWorld(true);
    let at = null;
    kit.traverse((m) => { if (!at && m.isMesh && m.geometry === parts[0].geo) at = parts[0].M.clone().multiply(_m.copy(kit.matrixWorld).invert().multiply(m.matrixWorld).invert()); });
    const K = { parts, R, y0, y1, mid: (y0 + y1) / 2, n: 0, cap: 0, hi: [], lo: null, unplace: at.invert() };
    K.cards = cards(K, renderer);
    this.grow(K, 64);
    return K;
  }

  // room for `cap` trees of a kind: its part meshes and cards made again
  grow(K, cap) {
    for (const m of [...K.hi, K.lo, K.shade]) if (m) { m.removeFromParent(); m.dispose(); }
    K.cap = cap;
    K.hi = K.parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, cap);
      im.castShadow = false; // (the near trees' shadows from their cards: `shade`, below; the model's 9,000 triangles each, twice, were 174 k in the street's shadow pass)
      im.receiveShadow = true;
      return im;
    });
    K.shade = new THREE.InstancedMesh(K.cards.geo, K.cards.mat, cap);
    K.shade.customDepthMaterial = K.cards.depth;
    K.shade.castShadow = true;
    K.shade.layers.set(1); // (seen by the sun's shadow camera only: Ferris.buildLight)
    K.lo = new THREE.InstancedMesh(K.cards.geo, K.cards.mat, cap);
    K.lo.customDepthMaterial = K.cards.depth; // (turned to the sun in its shadow, as to the camera)
    K.lo.castShadow = K.lo.receiveShadow = true;
    for (const im of [...K.hi, K.lo, K.shade]) {
      im.matrixAutoUpdate = false;
      im.count = 0;
      im.visible = false;
      this.group.add(im);
    }
    this.dirty = true;
  }

  // a tree of kind 0 or 1 standing at world matrix `M` (its trunk's foot at the origin); returns its id
  add(kind, M) {
    const K = this.kinds[kind], id = this.next++;
    const p = new THREE.Vector3(0, K.mid, 0).applyMatrix4(M);
    this.trees.set(id, { kind, M: M.clone(), p, near: false });
    if (++K.n > K.cap) this.grow(K, Math.max(K.cap * 2, K.n));
    this.dirty = true;
    return id;
  }

  // The fronds' glow (two of their materials glow by an emissive map: sunlight through the leaves), by the
  // daylight, 0 at night to 1 at noon: at night they shone pale green over the dark promenade.
  daylight(k) {
    if (Math.abs(k - (this.light ?? -1)) < 0.01) return;
    this.light = k;
    for (const K of this.kinds) {
      for (const p of K.parts) if (p.mat.emissiveMap) p.mat.emissiveIntensity = (p.mat.userData.glow ??= p.mat.emissiveIntensity) * k;
      K.cards.mat.emissiveIntensity = k;
    }
  }

  // the model's two trees as it stands (prop('palms') at world matrix `M`)
  addPair(M) { return this.kinds.map((K, i) => this.add(i, _m.multiplyMatrices(M, K.unplace))); }

  remove(id) {
    const t = this.trees.get(id);
    if (!t) return;
    this.trees.delete(id);
    this.kinds[t.kind].n--;
    this.dirty = true;
  }

  update(camera) {
    const c = camera.position;
    if (!this.dirty && c.distanceToSquared(this.at) < 4) return;
    this.dirty = false;
    this.at.copy(c);
    const counts = this.kinds.map(() => ({ hi: 0, lo: 0 }));
    for (const t of this.trees.values()) {
      const K = this.kinds[t.kind], n = counts[t.kind], r = t.near ? this.near + BACK : this.near;
      t.near = t.p.distanceToSquared(c) < r * r;
      if (t.near) {
        for (let j = 0; j < K.parts.length; j++) K.hi[j].setMatrixAt(n.hi, _m.multiplyMatrices(t.M, K.parts[j].M));
        K.shade.setMatrixAt(n.hi, t.M);
        n.hi++;
      } else K.lo.setMatrixAt(n.lo++, t.M);
    }
    this.kinds.forEach((K, i) => {
      const n = counts[i];
      for (const [im, k] of [...K.hi.map((m) => [m, n.hi]), [K.lo, n.lo], [K.shade, n.hi]]) {
        im.count = k;
        im.visible = k > 0;
        if (!k) continue;
        im.instanceMatrix.needsUpdate = true;
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, k * 16);
        im.computeBoundingSphere();
      }
    });
  }
}

// The impostor's pictures: the tree drawn unlit from eight sides round it and once from above, into the cells
// of one texture, its colour in one and its glow in another (two of the fronds' materials glow by an emissive
// map: without it the cards were half as bright as the trees); and its cards, placed in the vertex shader
// (`card`): the upright one turned to whoever looks (the camera, or the sun for its shadow), its normals bent
// out from the trunk and up toward the crown so the sun rounds the clump; the level one over the crown, face up.
function cards(K, renderer) {
  const { R, y0, y1 } = K, H = y1 - y0, vb = y0 - 0.1, vt = y1 + 0.1, ROWS = Math.ceil((VIEWS + 1) / COLS);
  const target = (k) => new THREE.WebGLRenderTarget(CW * COLS * k, CH * ROWS * k, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.SRGBColorSpace });
  const rt = target(1), glow = target(0.5); // (the glow's soft: half the size)
  const scene = new THREE.Scene(), flat = [];
  // each part drawn with its map's colour (or its emissive map's glow), premultiplied by the map's alpha
  const shade = (m, emissive) => new THREE.ShaderMaterial({
    uniforms: { map: { value: m.map }, emap: { value: m.emissiveMap }, tint: { value: emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : m.color.clone() }, cut: { value: Math.max(m.alphaTest, 0.3) } },
    defines: { HAS_MAP: m.map ? 1 : 0, HAS_EMAP: m.emissiveMap ? 1 : 0, EMISSIVE: emissive ? 1 : 0 }, // (numbers: three.js leaves a define that's `false` out)
    side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map, emap; uniform vec3 tint; uniform float cut; varying vec2 vUv;
      void main() {
        vec4 a = HAS_MAP == 1 ? texture2D(map, vUv) : vec4(1.0);
        if (a.a < cut) discard;
        vec3 c = tint * (EMISSIVE == 1 ? (HAS_EMAP == 1 ? texture2D(emap, vUv).rgb : vec3(1.0)) : a.rgb);
        gl_FragColor = vec4(c * a.a, a.a);
      }`,
  });
  for (const p of K.parts) {
    const mesh = new THREE.Mesh(p.geo);
    mesh.userData.shades = [shade(p.mat, false), shade(p.mat, true)];
    flat.push(...mesh.userData.shades);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(p.M);
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  const side = new THREE.OrthographicCamera(-R, R, vt, vb, 0.1, 4 * R + 2);
  const top = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, H + 4);
  const keep = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate };
  // (premultiplied, on clear black: averaged into the smaller mips, thin fronds kept their colour; drawn straight
  // over a background colour, they faded to it, and the trees went dark with distance)
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.shadowMap.autoUpdate = false;
  [rt, glow].forEach((t, pass) => {
    for (const m of scene.children) m.material = m.userData.shades[pass];
    renderer.setRenderTarget(t);
    renderer.clear();
    t.scissorTest = true;
    const cw = t.width / COLS, ch = t.height / ROWS;
    const view = (i, camera) => {
      const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch;
      t.viewport.set(x, y, cw, ch);
      t.scissor.set(x, y, cw, ch);
      renderer.setRenderTarget(t);
      renderer.render(scene, camera);
    };
    for (let i = 0; i < VIEWS; i++) {
      const a = (i / VIEWS) * Math.PI * 2; // (seen from (sin a, 0, cos a): its right is (cos a, 0, -sin a))
      side.position.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(2 * R + 1);
      side.up.set(0, 1, 0);
      side.lookAt(0, 0, 0);
      side.updateMatrixWorld();
      view(i, side);
    }
    top.position.set(0, y1 + 2, 0);
    top.up.set(0, 0, -1); // (its right +x, its up -z)
    top.lookAt(0, 0, 0);
    top.updateMatrixWorld();
    view(VIEWS, top);
    t.scissorTest = false;
    t.viewport.set(0, 0, t.width, t.height);
    t.scissor.set(0, 0, t.width, t.height);
  });
  renderer.setRenderTarget(keep.target);
  renderer.setClearColor(keep.color, keep.alpha);
  renderer.autoClear = keep.auto;
  renderer.shadowMap.autoUpdate = keep.shadows;
  for (const m of flat) m.dispose();

  // the two cards: their corners (u -1..1 across, v 0..1 up; the crown's flagged), placed by the shader
  const geo = new THREE.BufferGeometry();
  const corner = [-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(16).fill(0), 2));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (y0 + y1) / 2, 0), Math.hypot(R, H / 2 + 0.2));
  const uniforms = { uCard: { value: new THREE.Vector4(R, vb, vt, y0 + H * 0.86) }, uCells: { value: new THREE.Vector2(COLS, ROWS) } };
  const patch = (m) => {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        uniform vec4 uCard; uniform vec2 uCells;
        varying vec2 vUv0; varying vec2 vUv1; varying float vBlend; varying float vFade;
        vec2 cellUv(float i, vec2 f) { return (vec2(mod(i, uCells.x), floor(i / uCells.x)) + f) / uCells; }
        void card(out vec3 P, out vec3 Nr) {
          vec2 c = position.xy;
          #ifdef USE_INSTANCING
            vec3 eye = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz; // (in the tree's own frame)
          #else
            vec3 eye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
          #endif
          float steep = (eye.y - uCard.w) / max(length(eye.xz), 0.01); // (how far above the crown it's seen from)
          if (position.z > 0.5) { // the crown's card, level, face up: only from above (from the side it was a dark smear)
            P = vec3(c.x * uCard.x, uCard.w, -c.y * uCard.x);
            Nr = normalize(vec3(c.x * 0.35, 1.0, -c.y * 0.35));
            vUv0 = vUv1 = cellUv(${VIEWS}.0, vec2(c.x, c.y) * 0.5 + 0.5);
            vBlend = 0.0;
            vFade = smoothstep(0.4, 0.9, steep);
            return;
          }
          vFade = 1.0 - smoothstep(1.7, 3.2, steep); // (and the upright one gone from straight above)
          float a = atan(eye.x, eye.z);
          vec3 T = vec3(cos(a), 0.0, -sin(a)), N = vec3(sin(a), 0.0, cos(a));
          P = T * c.x * uCard.x + vec3(0.0, mix(uCard.y, uCard.z, c.y), 0.0);
          Nr = normalize(T * c.x * 0.45 + N * 0.3 + vec3(0.0, 0.4 + 0.75 * c.y, 0.0)); // (the crown's fronds mostly face the sky)
          float f = mod(a / (2.0 * PI) * ${VIEWS}.0 + ${VIEWS}.0, ${VIEWS}.0), i0 = floor(f);
          vec2 q = vec2(c.x * 0.5 + 0.5, c.y);
          vUv0 = cellUv(i0, q);
          vUv1 = cellUv(mod(i0 + 1.0, ${VIEWS}.0), q);
          vBlend = f - i0;
        }`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal; { vec3 cp; card(cp, objectNormal); }')
        .replace('#include <begin_vertex>', 'vec3 transformed; { vec3 cn; card(transformed, cn); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec2 vUv0; varying vec2 vUv1; varying float vBlend; varying float vFade;`)
        .replace('#include <map_fragment>', `vec4 card = mix(texture2D(map, vUv0), texture2D(map, vUv1), vBlend);
          diffuseColor *= vec4(card.rgb / max(card.a, 0.004), card.a * vFade);`)
        .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
            totalEmissiveRadiance *= mix(texture2D(emissiveMap, vUv0), texture2D(emissiveMap, vUv1), vBlend).rgb / max(card.a, 0.004);
          #endif`);
    };
    m.customProgramCacheKey = () => 'palmCards';
    return m;
  };
  rt.texture.anisotropy = 4;
  const mat = patch(new THREE.MeshStandardMaterial({ map: rt.texture, emissiveMap: glow.texture, emissive: 0xffffff, alphaTest: 0.3, alphaToCoverage: true, roughness: 0.6, metalness: 0 })); // (as the trees' own materials)
  mat.shadowSide = THREE.DoubleSide; // (the card faces the sun in the shadow pass: a front-faced material's is drawn from its back)
  mat.name = 'palmCards';
  const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rt.texture, alphaTest: 0.45 }));
  return { geo, mat, depth, rt, glow };
}
