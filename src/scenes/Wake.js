import * as THREE from 'three';
import { Physics } from '../engine/Physics.js';
import { glowTexture } from '../fx/Textures.js';
import { prop, piece, hasProp } from '../props/Props.js';
import { Smash } from '../props/Smash.js';
import { violetCrystal, crystalTime } from '../fx/Crystal.js';

// The breach's wake (Part Seven, `trail`): out past the charted stars, the way the Zamarons took Carol.
// Ours. Where the breach went it left its light behind, a stream of violet motes on a line through
// space, fading as it cools; the ring can follow it only while Hal stays on it. Three stretches:
//   the edge   open space, the galaxy's band behind him, a nebula ahead that the wake runs into
//   the shards the breach's light gone solid: drifting crystal, rocks grown over with it, some in the way
//   the veil   inside the nebula: thick rose and teal, the wake hard to see but for the ring's pings
// and at its end, out of the veil, Zamaron (the story's cut: scenes/Space.js shows the planet).
// Hal flies all of it (no ground anywhere: he can't land). North is -Z; the wake starts at the origin.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const WAKE_PROPS = ['crystal_shard', 'crystal_cluster', 'crystal_rocks', 'rocks'];
const POINTS = [
  [0, 0, 0], [6, 6, -170], [52, 24, -350], [124, 12, -530], [160, -26, -710], // the edge
  [128, -52, -880], [52, -44, -1020], [-34, -14, -1150], [-62, 28, -1300], [-30, 52, -1450], // the shards
  [48, 44, -1600], [104, 4, -1750], [82, -38, -1910], [8, -34, -2060], [-36, -4, -2210], [-6, 12, -2370], [10, 14, -2500], // the veil
];
export const SHARDS = [0.29, 0.55], VEIL = [0.55, 0.94]; // the stretches, as shares of the wake's length
export const LOCK = 20, WEAK = 58; // metres off the wake: locked on, losing it (beyond: lost, after a moment)
const N = 2048; // samples along it (positions, tangents and frames, for everything that follows it)

let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export class Wake {
  constructor({ engine }) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.physics.world.gravity = { x: 0, y: 0, z: 0 };
    this.interactables = [];
    this.updaters = [];
    this.time = { value: 0 };
    this.progress = 0; // how far along it Hal has come (0 .. 1), the furthest point he's been locked on at
    this.near = 0; // the sample nearest him
    this.off = 0; // how far off it he is, in metres
  }

  build() {
    const s = this.scene;
    s.userData.exposure = 1.05;
    s.userData.near = 0.1;
    s.userData.far = 9000;
    s.environment = this.engine.envMap;
    s.environmentIntensity = 0.14;
    s.fog = new THREE.FogExp2(0x12061a, 0);
    this.curve = new THREE.CatmullRomCurve3(POINTS.map(([x, y, z]) => V(x, y, z)), false, 'centripetal');
    this.length = this.curve.getLength();
    this.samples = this.curve.getSpacedPoints(N - 1);
    this.frames = this.curve.computeFrenetFrames(N - 1, false);
    s.add((this.hemi = new THREE.HemisphereLight(0x3a2850, 0x0a0812, 0.5)));
    // a far white star ahead and above: the only sun out here
    this.key = new THREE.DirectionalLight(0xe8dcff, 1.6);
    this.key.position.set(-0.4, 0.6, -0.7).multiplyScalar(100);
    s.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight(0xff70d0, 0.5);
    this.rim.position.set(0.5, -0.3, 0.6).multiplyScalar(100);
    s.add(this.rim, this.rim.target);
    this.buildSky();
    this.buildWake();
    this.buildMotes();
    this.smash = new Smash(this.physics, s);
    this.smash.bits.gravity = 0; // (chips in space drift)
    this.smash.water.gravity = 0;
    this.crystal = violetCrystal({ glow: 0.55, scale: 0.08 });
    this.rock = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.85, metalness: 0.05 });
    this.buildShards();
    this.buildVeil();
    this.buildDust();
    return this;
  }

  // Where along the wake `k` (0 .. 1) is, and its frame there
  at(k, out = V(0, 0, 0)) { return out.copy(this.samples[Math.round(THREE.MathUtils.clamp(k, 0, 1) * (N - 1))]); }
  tangent(k) { return this.frames.tangents[Math.round(THREE.MathUtils.clamp(k, 0, 1) * (N - 1))]; }

  // ------------------------------------------------------------------------------------- the sky
  // The galaxy's band behind him (where he came from) and the stars thinning ahead: past the charts
  buildSky() {
    this.skyU = { uTime: this.time, uVeil: { value: 0 }, uBand: { value: V(0.2, 0.5, 0.84).normalize() } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uVeil; uniform vec3 uBand;
        varying vec3 vDir;
        float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
        float stars(vec3 d, float scale, float thresh) {
          vec3 sp = d * scale, cell = floor(sp);
          return step(thresh, h3(cell)) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5)) * (0.3 + 2.0 * h3(cell + 7.0));
        }
        void main() {
          vec3 d = normalize(vDir);
          float behind = smoothstep(-0.2, 0.7, d.z); // (the charted galaxy is back the way he came, +Z)
          float b = dot(d, uBand);
          float band = exp(-b * b / 0.03) * behind;
          float cloud = fbm(d * 3.0 + 2.0);
          vec3 col = vec3(0.002, 0.0015, 0.004);
          col += vec3(0.06, 0.06, 0.08) * band * (0.5 + cloud);
          col += vec3(0.08, 0.05, 0.035) * band * pow(cloud, 3.0) * 1.5;
          // ahead, the nebula he's flying into: rose and teal veils on the dark
          float ahead = smoothstep(0.1, -0.8, d.z);
          float neb = fbm(d * 2.4 - 3.0), neb2 = fbm(d * 5.0 + 11.0);
          col += (vec3(0.16, 0.04, 0.12) * smoothstep(0.42, 0.85, neb) + vec3(0.02, 0.08, 0.09) * smoothstep(0.5, 0.9, neb2)) * ahead * 0.8;
          // stars: thick behind, few ahead
          float th = mix(0.985, 0.968, behind);
          col += vec3(0.75, 0.85, 1.0) * stars(d, 480.0, th - band * 0.02) * 0.3;
          col += vec3(1.0, 0.95, 0.88) * stars(d, 200.0, 0.994) * 0.55;
          // inside the veil the sky is the cloud's own glow
          col = mix(col, vec3(0.05, 0.016, 0.045) * (0.4 + 0.9 * neb) + vec3(0.0, 0.025, 0.03) * neb2, uVeil);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 64, 32), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  // ------------------------------------------------------------------------------------- the wake
  // Its heart: a thin thread of light along the line, its pulses running on ahead (the way she went),
  // fading behind him as it cools and dimming far ahead. Round it, at the edge of where the ring can
  // hold it (`LOCK`), a faint wall, seen edge-on as a tunnel of light; it brightens as he nears it.
  // `uLock` is how well the ring holds it (0 lost .. 1 locked), `uPing` a pulse the ring sends along it.
  buildWake() {
    this.wakeU = { uTime: this.time, uLen: { value: this.length }, uProg: { value: 0 }, uLock: { value: 1 }, uPing: { value: -1 }, uVeil: { value: 0 }, uOff: { value: 0 } };
    const vert = /* glsl */ `
      varying vec2 vU; varying vec3 vN, vV;
      void main() {
        vU = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = cameraPosition - w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
    const common = /* glsl */ `
      uniform float uTime, uLen, uProg, uLock, uPing, uVeil, uOff;
      varying vec2 vU; varying vec3 vN, vV;
      float windowAt(float along, float prog, float ahead) { return smoothstep(prog - 160.0, prog - 20.0, along) * (1.0 - smoothstep(prog + 120.0, prog + ahead, along)); }`;
    const core = new THREE.ShaderMaterial({
      uniforms: this.wakeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexShader: vert,
      fragmentShader: /* glsl */ `${common}
        void main() {
          float along = vU.x * uLen, prog = uProg * uLen, dist = length(vV);
          float pulse = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(along * 0.07 - uTime * 3.4), 6.0);
          float ping = uPing < 0.0 ? 0.0 : exp(-pow((along - uPing) / 10.0, 2.0)) * 3.0;
          float round = 0.25 + 0.75 * pow(abs(dot(normalize(vN), vV / dist)), 1.5);
          float a = (pulse * mix(0.2, 1.0, uLock) + ping) * round * windowAt(along, prog, mix(1100.0, 300.0, uVeil));
          a *= smoothstep(3.0, 24.0, dist); // (it shows from some way ahead of him: under him it was a road)
          gl_FragColor = vec4(vec3(0.85, 0.36, 1.15) * a * 0.9, 1.0);
        }`,
    });
    this.tube = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 2400, 0.3, 8, false), core);
    this.tube.frustumCulled = false;
    this.scene.add(this.tube);
    // a soft halo round the thread, so from behind him at speed it reads as a river of light (faded out
    // close to, where he flies inside it)
    const halo = new THREE.ShaderMaterial({
      uniforms: this.wakeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexShader: vert,
      fragmentShader: /* glsl */ `${common}
        void main() {
          float along = vU.x * uLen, prog = uProg * uLen, dist = length(vV);
          float round = pow(abs(dot(normalize(vN), vV / dist)), 3.0);
          float flow = 0.6 + 0.4 * sin(along * 0.035 - uTime * 2.2);
          float a = round * flow * mix(0.25, 1.0, uLock) * windowAt(along, prog, mix(1100.0, 300.0, uVeil));
          a *= smoothstep(10.0, 45.0, dist);
          gl_FragColor = vec4(vec3(0.55, 0.18, 0.85) * a * 0.22, 1.0);
        }`,
    });
    this.halo = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 1400, 3.4, 12, false), halo);
    this.halo.frustumCulled = false;
    this.scene.add(this.halo);
    const wall = new THREE.ShaderMaterial({
      uniforms: this.wakeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: vert,
      fragmentShader: /* glsl */ `${common}
        void main() {
          float along = vU.x * uLen, prog = uProg * uLen, dist = length(vV);
          float edge = pow(1.0 - abs(dot(normalize(vN), vV / dist)), 2.5);
          float streak = 0.55 + 0.45 * sin(vU.y * 6.2832 * 12.0 + along * 0.05 - uTime * 1.5);
          float rings = 0.6 + 0.4 * pow(0.5 + 0.5 * sin(along * 0.12 - uTime * 2.0), 8.0);
          float near = smoothstep(${(LOCK * 0.55).toFixed(1)}, ${LOCK.toFixed(1)}, uOff); // (brighter as he nears the edge)
          float a = edge * streak * rings * windowAt(along, prog, mix(700.0, 240.0, uVeil)) * (0.05 + 0.18 * near) * mix(0.4, 1.0, uLock);
          a *= smoothstep(2.0, 14.0, dist);
          gl_FragColor = vec4(vec3(0.6, 0.22, 0.95) * a, 1.0);
        }`,
    });
    this.wall = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 1400, LOCK, 28, false), wall);
    this.wall.frustumCulled = false;
    this.scene.add(this.wall);
  }

  // motes of the light, streaming along it on ahead of him: thick in its middle, a few strays out to its edge
  buildMotes(count = 4200) {
    const pos = new Float32Array(count * 3), seedA = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rnd(), 2.2) * 9;
      seedA.set([rnd(), r, rnd() * Math.PI * 2, 0.7 + rnd() * 0.6], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(V(0, 0, 0), 1e5);
    const tex = glowTexture('rgba(255,255,255,1)', 'rgba(210,120,255,0.35)');
    // (a size in metres, but never under two pixels: far ones stay points of light, not nothing)
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uScale: { value: 800 }, uOpacity: { value: 0.8 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `uniform float uScale; varying float vFar;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z; vFar = d;
          gl_PointSize = clamp(0.32 * uScale / max(d, 0.1), 2.0, 40.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uOpacity; varying float vFar;
        void main() { vec4 t = texture2D(uMap, gl_PointCoord); float fade = smoothstep(1.0, 4.0, vFar) * (1.0 - smoothstep(400.0, 700.0, vFar));
          gl_FragColor = vec4(vec3(1.0, 0.52, 1.25) * t.rgb * t.a * uOpacity * fade, 1.0); }`,
    });
    this.motes = new THREE.Points(geo, this.moteMat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
    this.mote = { pos, seed: seedA, count, flow: 0 };
  }

  // -------------------------------------------------------------------------------- the shards
  // Off the line and across it: rocks crusted with the crystal, big ones fixed (Hal goes round or
  // bounces off), and loose shards drifting, knocked tumbling by him or by the ring.
  buildShards() {
    const s = this.scene, [a, b] = SHARDS;
    const rockNames = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => new RegExp(`^Object_${n}$`));
    const place = (k, offset) => {
      const p = this.at(k), f = Math.round(k * (N - 1));
      return p.addScaledVector(this.frames.normals[f], offset.x).addScaledVector(this.frames.binormals[f], offset.y);
    };
    // the big rocks: ringed round the line, a few on it
    for (let i = 0; i < 34; i++) {
      const k = a + (b - a) * (i + rnd()) / 34;
      const onLine = i % 6 === 2;
      const ang = rnd() * Math.PI * 2, r = onLine ? rnd() * 6 : 26 + rnd() * 90;
      const at = place(k, V(Math.cos(ang) * r, Math.sin(ang) * r, 0));
      const g = new THREE.Group();
      if (hasProp('rocks')) {
        const rk = piece('rocks', rockNames[i % rockNames.length], { root: true });
        rk.traverse((m) => { if (m.isMesh) m.material = this.rock; });
        g.add(rk);
      }
      // the crystal grown on it
      for (let j = 0; j < 3; j++) {
        if (!hasProp(j === 1 ? 'crystal_rocks' : 'crystal_cluster')) continue;
        const c = prop(j === 1 ? 'crystal_rocks' : 'crystal_cluster');
        c.traverse((m) => { if (m.isMesh) m.material = this.crystal; });
        c.scale.setScalar(j === 1 ? 0.9 + rnd() * 0.8 : 0.14 + rnd() * 0.12);
        c.position.set((rnd() - 0.5) * 1.2, 0.5 + rnd() * 0.6, (rnd() - 0.5) * 1.2);
        c.rotation.set((rnd() - 0.5) * 1.4, rnd() * 6.28, (rnd() - 0.5) * 1.4);
        g.add(c);
      }
      g.position.copy(at);
      g.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      g.scale.setScalar(onLine ? 5 + rnd() * 4 : 3 + rnd() * 9);
      s.add(g);
      this.smash.solid(g, { stuff: 'stone', mesh: true });
    }
    // loose shards near the line
    this.loose = [];
    if (!hasProp('crystal_shard')) return;
    for (let i = 0; i < 46; i++) {
      const k = a + (b - a) * rnd();
      const ang = rnd() * Math.PI * 2, r = 3 + rnd() * 30;
      const sh = prop('crystal_shard');
      sh.traverse((m) => { if (m.isMesh) m.material = this.crystal; });
      const sc = 0.25 + rnd() * 0.45;
      sh.scale.setScalar(sc);
      sh.position.copy(place(k, V(Math.cos(ang) * r, Math.sin(ang) * r, 0)));
      sh.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      s.add(sh);
      const it = this.smash.add(sh, { kind: 'loose', mass: 80 * sc * sc * sc * 8, stuff: 'stone', glass: false, shrink: 0.8 });
      it.body.setLinearDamping(0.02);
      it.body.setAngularDamping(0.02);
      it.body.setAngvel({ x: (rnd() - 0.5) * 0.4, y: (rnd() - 0.5) * 0.4, z: (rnd() - 0.5) * 0.4 }, true);
      this.loose.push(it);
    }
  }

  // -------------------------------------------------------------------------------- the veil
  // The nebula as big soft clouds round its stretch of the line (seen from the edge as a glow ahead;
  // from inside, all round), and the fog thickening with how far into it he is.
  buildVeil() {
    const [a, b] = VEIL, tex = cloudTexture();
    const mats = [new THREE.Color(0.5, 0.14, 0.4), new THREE.Color(0.1, 0.32, 0.34), new THREE.Color(0.36, 0.1, 0.46)].map((c) =>
      new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.clouds = [];
    for (let i = 0; i < 120; i++) {
      const k = a - 0.04 + (b - a + 0.08) * rnd(), ang = rnd() * Math.PI * 2, r = 20 + rnd() * 260;
      const p = this.at(k), f = Math.round(k * (N - 1));
      p.addScaledVector(this.frames.normals[f], Math.cos(ang) * r).addScaledVector(this.frames.binormals[f], Math.sin(ang) * r);
      const sp = new THREE.Sprite(mats[i % 3]);
      sp.position.copy(p);
      sp.scale.setScalar(140 + rnd() * 260);
      sp.material.rotation = rnd() * 6.28;
      this.scene.add(sp);
      this.clouds.push(sp);
    }
    // lightning in the cloud, now and then: a flash somewhere near him
    this.bolt = new THREE.PointLight(0xd890ff, 0, 220, 1.5);
    this.scene.add(this.bolt);
  }

  // fine dust round the camera, stretched by his speed
  buildDust(count = 700) {
    const pos = new Float32Array(count * 3).map(() => (rnd() - 0.5) * 90);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(V(0, 0, 0), 1e5);
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(0.6, 0.55, 0.75), size: 0.07, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.dustPos = pos;
  }

  // ------------------------------------------------------------------------------------- tracking
  // How far off the line `p` is, and where on it (a window of samples round the last nearest one: the
  // line doubles back near itself nowhere, so the search never jumps)
  track(p) {
    let best = Infinity, bi = this.near;
    const from = Math.max(0, this.near - 220), to = Math.min(N - 1, this.near + 220);
    for (let i = from; i <= to; i++) {
      const d = this.samples[i].distanceToSquared(p);
      if (d < best) { best = d; bi = i; }
    }
    // (lost the window entirely, after a move: search all of it)
    if (best > 400 * 400) for (let i = 0; i < N; i++) { const d = this.samples[i].distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    this.near = bi;
    this.off = Math.sqrt(best);
    const k = bi / (N - 1);
    if (this.off < LOCK) this.progress = Math.max(this.progress, k);
    return k;
  }

  airBounds() {
    return { ground: () => -1e5, floor: () => -1e5, canLand: () => false, center: V(0, 0, -1250), radius: 1e5, ceiling: 1e5 };
  }

  update(dt, t, camera) {
    this.physics.step(dt);
    this.smash.update(dt, t, camera, this.engine.renderer);
    this.time.value = t;
    crystalTime.value = t;
    this.sky.position.copy(camera.position);
    this.wakeU.uProg.value = this.progress;
    this.wakeU.uOff.value = this.off;
    // the veil: how deep in it the camera is
    const k = this.near / (N - 1), [a, b] = VEIL;
    const veil = THREE.MathUtils.smoothstep(k, a - 0.02, a + 0.06) * (1 - THREE.MathUtils.smoothstep(k, b - 0.03, b + 0.02));
    this.veil = veil;
    this.scene.fog.density = 0.0065 * veil;
    this.skyU.uVeil.value = veil;
    this.wakeU.uVeil.value = veil;
    this.key.intensity = 1.6 * (1 - veil * 0.6);
    // lightning
    this.flash = Math.max(0, (this.flash ?? 0) - dt * 4);
    if (veil > 0.5 && Math.random() < dt * 0.35) { this.flash = 1; this.bolt.position.copy(camera.position).add(V((Math.random() - 0.5) * 160, (Math.random() - 0.3) * 100, -40 - Math.random() * 120)); }
    this.bolt.intensity = this.flash * 4000 * veil;
    // the motes, streaming along it round where he is
    const m = this.mote, prog = Math.max(this.progress, k) * (this.length);
    m.flow += dt * 26;
    for (let i = 0; i < m.count; i++) {
      const sd = m.seed, j = i * 4;
      // spread from 60 m behind him to 640 m ahead (less in the veil), flowing on
      const span = 700 - veil * 380;
      const along = prog - 60 + ((sd[j] * span + m.flow * sd[j + 3]) % span);
      const f = Math.round(THREE.MathUtils.clamp(along / this.length, 0, 1) * (N - 1));
      const c = this.samples[f], nn = this.frames.normals[f], bn = this.frames.binormals[f], ang = sd[j + 2] + t * 0.15 * sd[j + 3];
      const r = sd[j + 1];
      m.pos[i * 3] = c.x + nn.x * Math.cos(ang) * r + bn.x * Math.sin(ang) * r;
      m.pos[i * 3 + 1] = c.y + nn.y * Math.cos(ang) * r + bn.y * Math.sin(ang) * r;
      m.pos[i * 3 + 2] = c.z + nn.z * Math.cos(ang) * r + bn.z * Math.sin(ang) * r;
    }
    this.motes.geometry.attributes.position.needsUpdate = true;
    this.moteMat.uniforms.uOpacity.value = 0.35 + 0.55 * this.wakeU.uLock.value;
    this.moteMat.uniforms.uScale.value = this.engine.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    // the dust, wrapped round the camera
    const p = this.dustPos, cp = camera.position;
    for (let i = 0; i < p.length; i += 3) for (let q = 0; q < 3; q++) {
      const rel = p[i + q] - cp.getComponent(q);
      if (rel > 45) p[i + q] -= 90; else if (rel < -45) p[i + q] += 90;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    for (const fn of this.updaters) fn(dt, t);
  }

  dispose() {
    this.physics.dispose();
    this.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isSprite) { o.geometry?.dispose?.(); } });
  }
}

// a soft cloud for the veil's sprites: lumpy, bright in the middle, nothing at its edge
function cloudTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = size * (0.3 + rnd() * 0.4), y = size * (0.3 + rnd() * 0.4), r = size * (0.12 + rnd() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  // (faded to black at the rim, so no sprite shows its square)
  const fade = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
