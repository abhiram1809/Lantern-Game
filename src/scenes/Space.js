import * as THREE from 'three';
import { NOISE_GLSL } from '../fx/Sky.js';
import { glowTexture } from '../fx/Textures.js';
import { earthMaps } from '../fx/EarthMap.js';

// Space, for the flights between worlds (styled after the 93604faf space-flight reference): a
// starfield with the galaxy's band behind, and one of two places in front of it.
//   'earth': Earth from high orbit over North America at night, city lights below, the sun about
//            to rise over the limb, the Moon off to the side.
//   'oa':    Oa from its orbital approach: a world-city glittering on its night side, green
//            conduits running to the Central Battery's glow, a ringed giant beyond, the galaxy's
//            core filling the sky (Oa sits at the centre of the universe).
// Hal is placed at the origin by the story; dust motes drift past to sell his speed (`drift`).
const NOISE3 = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
`;
const VERT = /* glsl */ `
  varying vec3 vObj, vN, vW;
  void main() {
    vObj = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// equirectangular lookup on the unit sphere (longitude 0 toward +Z, east toward +X)
const LATLON = /* glsl */ `
  vec2 latlon(vec3 d) { return vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))); }
  vec2 mapUv(vec2 ll) { return vec2(ll.x / 6.2831853 + 0.5, ll.y / 3.1415927 + 0.5); }
`;
// unit vector for a longitude / latitude in degrees, in the planet's own frame
const dirOf = (lon, lat) => {
  const a = THREE.MathUtils.degToRad(lon), b = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a));
};

export const EARTH = { radius: 300, center: new THREE.Vector3(0, -362, 0) };
export const OA = { radius: 190, center: new THREE.Vector3(0, -60, -760) };
export const YSMAULT = { radius: 170, center: new THREE.Vector3(30, -50, -700) };

export class Space {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.userData.exposure = 1.0;
    this.scene.userData.near = 0.1;
    this.scene.userData.far = 6000;
    this.scene.environmentIntensity = 0.12;
    this.time = { value: 0 };
    this.drift = new THREE.Vector3();
    this.buildBackdrop();
    this.buildEarth();
    this.buildOa();
    this.buildYsmault();
    this.buildDust();
    this.hemi = new THREE.HemisphereLight(0x1a2436, 0x0a1020, 0.35);
    this.key = new THREE.DirectionalLight(0xcfdcff, 1.2);
    this.rim = new THREE.DirectionalLight(0xffb070, 0.0);
    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target);
    this.glow = new THREE.PointLight(0x55ff88, 1.0, 3, 2); // the ring's light on Hal
    this.scene.add(this.glow);
    this.show('earth');
  }

  // ----------------------------------------------------------------------------------- backdrop
  buildBackdrop() {
    this.skyU = { uTime: this.time, uCore: { value: 0 }, uBand: { value: new THREE.Vector3(0.25, 0.42, -0.87).normalize() }, uCoreDir: { value: new THREE.Vector3(-0.5, 0.32, -0.8).normalize() } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uCore; uniform vec3 uBand, uCoreDir;
        varying vec3 vDir;
        ${NOISE_GLSL}
        ${NOISE3}
        float stars(vec3 d, float scale, float thresh) {
          vec3 sp = d * scale, cell = floor(sp);
          float h = h3(cell);
          return step(thresh, h) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5)) * (0.3 + 2.0 * h3(cell + 7.0));
        }
        void main() {
          vec3 d = normalize(vDir);
          // the galaxy's band: a dusty river of light across the sky
          float b = dot(d, uBand);
          float band = exp(-b * b / 0.035);
          float dust = smoothstep(0.45, 0.75, fbm3(d * 7.0)) * exp(-b * b / 0.004);
          float cloud = fbm3(d * 3.2 + 2.0);
          vec3 col = vec3(0.0015, 0.002, 0.004);
          col += vec3(0.05, 0.055, 0.07) * band * (0.5 + cloud) * (1.0 - dust * 0.85);
          col += vec3(0.07, 0.045, 0.03) * band * pow(cloud, 3.0) * 1.6;
          // nebulae: teal and violet veils
          float neb = fbm3(d * 2.2 - 4.0), neb2 = fbm3(d * 4.5 + 9.0);
          col += vec3(0.01, 0.045, 0.05) * smoothstep(0.5, 0.85, neb) + vec3(0.04, 0.012, 0.05) * smoothstep(0.55, 0.9, neb2) * 0.8;
          // the galactic core (Oa): a vast warm glow with dark lanes, stars thick around it
          float c = max(dot(d, uCoreDir), 0.0);
          float core = pow(c, 60.0) * 0.9 + pow(c, 12.0) * 0.07 + pow(c, 3.0) * 0.012;
          col += vec3(1.0, 0.86, 0.66) * core * uCore * (1.0 - dust * 0.8) * (0.5 + 0.7 * cloud);
          col += vec3(0.3, 0.9, 0.7) * pow(c, 3.0) * smoothstep(0.55, 0.85, neb) * 0.12 * uCore;
          // stars: fine dust everywhere, brighter ones scattered, thicker along the band
          col += vec3(0.75, 0.85, 1.0) * stars(d, 520.0, 0.972 - band * 0.025 - uCore * pow(c, 2.0) * 0.04) * 0.28;
          col += vec3(1.0, 0.95, 0.88) * stars(d, 210.0, 0.993) * 0.55;
          col += vec3(0.7, 0.8, 1.0) * stars(d, 90.0, 0.998) * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);
  }

  // --------------------------------------------------------------------------------------- earth
  buildEarth() {
    const g = (this.earth = new THREE.Group());
    const { land, lights } = earthMaps();
    // the sun sits just below the far limb: night under Hal, the dawn's glow ahead
    this.earthSun = new THREE.Vector3(-0.42, -0.56, -0.72).normalize();
    this.earthU = { uLand: { value: land }, uLights: { value: lights }, uSun: { value: this.earthSun }, uTime: this.time };
    const surface = new THREE.ShaderMaterial({
      uniforms: this.earthU,
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D uLand, uLights; uniform vec3 uSun; uniform float uTime;
        varying vec3 vObj, vN, vW;
        ${NOISE3}
        ${LATLON}
        void main() {
          vec3 d = normalize(vObj);
          vec2 ll = latlon(d), uv = mapUv(ll);
          float raw = texture2D(uLand, uv).r;
          float land = smoothstep(0.42, 0.58, raw + (fbm3(d * 38.0) - 0.5) * 0.5);
          float alat = abs(ll.y) * 57.3;
          float n = fbm3(d * 9.0), n2 = fbm3(d * 26.0 + 3.0);
          vec3 terrain = mix(vec3(0.035, 0.075, 0.03), vec3(0.11, 0.12, 0.055), smoothstep(0.35, 0.7, n2));
          terrain = mix(terrain, vec3(0.3, 0.23, 0.14), smoothstep(0.45, 0.62, n) * (1.0 - smoothstep(9.0, 17.0, abs(alat - 25.0))));
          terrain = mix(terrain, vec3(0.17, 0.16, 0.14), smoothstep(55.0, 64.0, alat));
          terrain = mix(terrain, vec3(0.8, 0.85, 0.9), smoothstep(70.0, 76.0, alat + n * 8.0));
          vec3 ocean = mix(vec3(0.004, 0.016, 0.045), vec3(0.008, 0.035, 0.075), n2);
          ocean = mix(ocean, vec3(0.015, 0.07, 0.09), smoothstep(0.2, 0.5, raw) * (1.0 - land));
          vec3 surf = mix(ocean, terrain, land);
          // weather: drifting cloud bands
          float ct = uTime * 0.006;
          vec3 cd = vec3(d.x * cos(ct) - d.z * sin(ct), d.y, d.x * sin(ct) + d.z * cos(ct));
          float cloud = smoothstep(0.52, 0.78, fbm3(cd * 4.5 + fbm3(cd * 1.7) * 1.6)) * 0.92;
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          float ndl = dot(N, uSun);
          float day = smoothstep(-0.1, 0.18, ndl);
          float twi = smoothstep(-0.2, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.3, ndl));
          vec3 col = surf * max(ndl, 0.0) * 2.4;
          col += vec3(1.0, 0.85, 0.7) * pow(max(dot(N, normalize(uSun + V)), 0.0), 70.0) * (1.0 - land) * (1.0 - cloud) * day * 1.6;
          vec3 cc = vec3(0.92) * max(ndl, 0.0) * 2.0;
          cc = mix(cc, vec3(1.0, 0.42, 0.18) * 0.45, twi * 0.7);
          col = mix(col, cc, cloud);
          // night side: faint moonlit cloud and coast, and city lights as specks where people live
          float night = 1.0 - day;
          col += (mix(vec3(0.002, 0.005, 0.012), vec3(0.008, 0.01, 0.01), land) + vec3(0.02, 0.024, 0.03) * cloud) * night;
          float dens = clamp(texture2D(uLights, uv).r * 1.4, 0.0, 1.0) * land;
          float fine = n3(d * 2400.0) * 0.6 + n3(d * 800.0) * 0.4;
          float specks = smoothstep(1.0 - dens * 0.75, 1.02 - dens * 0.55, fine);
          col += vec3(1.0, 0.68, 0.34) * (dens * dens * 0.35 + specks * 0.9) * night * (1.0 - cloud * 0.85) * 1.4;
          // the air, thicker toward the limb
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.1, 0.28, 0.75) * fres * (day + 0.015) + vec3(1.0, 0.42, 0.16) * fres * twi * 0.8;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const R = EARTH.radius;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 96), surface);
    // turn the globe so North America lies under Hal, north toward the horizon ahead (-Z)
    const below = dirOf(-104, 41), north = dirOf(-104, 51).sub(below);
    const q = new THREE.Quaternion().setFromUnitVectors(below, new THREE.Vector3(0, 1, 0));
    north.applyQuaternion(q).setY(0).normalize();
    planet.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(north, new THREE.Vector3(0, 0, -1))).multiply(q);
    planet.position.copy(EARTH.center);
    g.add(planet);
    g.add(this.atmosphere(EARTH.center, R * 1.045, this.earthSun, new THREE.Vector3(0.3, 0.6, 1.4), new THREE.Vector3(1.0, 0.55, 0.25), 1 / 1.045));

    // the Moon, high to the right, and lighting Hal
    this.moonDir = new THREE.Vector3(0.62, 0.3, -0.72).normalize();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(46, 64, 32), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.earthSun } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun; varying vec3 vObj, vN, vW;
        ${NOISE3}
        void main() {
          vec3 d = normalize(vObj), N = normalize(vN);
          float maria = smoothstep(0.45, 0.6, fbm3(d * 2.5 + 4.0));
          float crater = smoothstep(0.62, 0.7, fbm3(d * 14.0)) * 0.25;
          vec3 alb = mix(vec3(0.42, 0.41, 0.4), vec3(0.18, 0.18, 0.19), maria) - crater * 0.1 + (fbm3(d * 40.0) - 0.5) * 0.06;
          // lit from the side the sun is on (it is behind the Earth for us, so a thick crescent)
          vec3 L = normalize(uSun + vec3(0.9, 0.9, 0.0));
          float lit = max(dot(N, L), 0.0);
          gl_FragColor = vec4(alb * (lit * 1.9 + 0.01), 1.0);
        }`,
    }));
    moon.position.copy(this.moonDir).multiplyScalar(1500);
    g.add(moon);

    // the sun: hidden under the limb now, it clears it as Hal climbs away
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(255,190,120,0.25)');
    this.sun = new THREE.Group();
    for (const [sc, color, op] of [[60, [6, 5.4, 4.6], 1], [260, [1.2, 0.8, 0.5], 0.5], [900, [0.5, 0.35, 0.2], 0.25]]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(...color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
      s.scale.setScalar(sc);
      this.sun.add(s);
    }
    const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1.4, 1.0, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    streak.scale.set(1400, 18, 1);
    this.sun.add(streak);
    this.sun.position.copy(this.earthSun).multiplyScalar(2600);
    g.add(this.sun);
    this.scene.add(g);
  }

  // A shell of air round a planet: brightest just off the limb, blue on the day side, orange at the
  // terminator, and flaring where the sun is behind the planet.
  atmosphere(center, radius, sun, dayCol, duskCol, inner) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 64), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sun }, uDay: { value: dayCol }, uDusk: { value: duskCol }, uEdge: { value: Math.sqrt(1 - inner * inner) } },
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uDay, uDusk; uniform float uEdge;
        varying vec3 vObj, vN, vW;
        void main() {
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          float t = clamp(-dot(N, V) / uEdge, 0.0, 1.0);
          float glow = pow(t, 3.0);
          float lit = smoothstep(-0.3, 0.35, dot(N, uSun));
          float fwd = pow(max(dot(-V, uSun), 0.0), 8.0);
          vec3 col = mix(uDusk, uDay, lit) * glow * (lit * 0.45 + fwd * 0.9 + 0.015);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    mesh.position.copy(center);
    return mesh;
  }

  // ------------------------------------------------------------------------------------------ oa
  buildOa() {
    const g = (this.oa = new THREE.Group());
    this.oaSun = new THREE.Vector3(0.85, 0.2, -0.45).normalize(); // to the right and behind: the night side faces the approach
    // the range and the battery are on the evening side, facing the approach
    const battery = new THREE.Vector3(-0.32, 0.5, 0.8).normalize();
    const axes = [];
    for (let i = 0; i < 7; i++) {
      const r = new THREE.Vector3(Math.cos(i * 2.39), Math.sin(i * 1.7) * 0.6, Math.sin(i * 2.39)).normalize();
      axes.push(new THREE.Vector3().crossVectors(battery, r).normalize());
    }
    const surface = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.oaSun }, uB: { value: battery }, uAxes: { value: axes }, uTime: this.time },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uB, uAxes[7]; uniform float uTime;
        varying vec3 vObj, vN, vW;
        ${NOISE3}
        float grid(vec3 d, float k, float w) {
          vec3 f = abs(fract(d * k) - 0.5);
          return 1.0 - smoothstep(0.0, w, min(min(f.x, f.y), f.z));
        }
        void main() {
          vec3 d = normalize(vObj), N = normalize(vN), V = normalize(cameraPosition - vW);
          float ndl = dot(N, uSun);
          float day = smoothstep(-0.08, 0.2, ndl), night = 1.0 - day;
          // districts: dense cores and darker spaces between them
          float dist = smoothstep(0.32, 0.72, fbm3(d * 4.0));
          vec3 metal = mix(vec3(0.05, 0.06, 0.065), vec3(0.11, 0.12, 0.12), fbm3(d * 18.0)) * (0.7 + 0.6 * dist);
          vec3 col = metal * max(ndl, 0.0) * 1.6 + vec3(0.004, 0.006, 0.008);
          // the city by night: winding arteries of light, towers as specks between them
          float avenues = (1.0 - smoothstep(0.0, 0.012, abs(n3(d * 34.0) - 0.5))) * 0.35 + (1.0 - smoothstep(0.0, 0.03, abs(n3(d * 130.0 + 5.0) - 0.5))) * 0.3;
          float specks = smoothstep(0.7, 0.86, n3(d * 2600.0) * 0.6 + n3(d * 850.0) * 0.4);
          vec3 city = mix(vec3(1.0, 0.9, 0.72), vec3(0.45, 1.0, 0.66), smoothstep(0.45, 0.75, n3(d * 60.0)));
          col += city * (avenues * 0.45 + specks * 0.9) * (0.04 + 0.96 * dist) * (night * 0.9 + 0.1);
          // conduits of light running to the Central Battery, and its glow
          float cond = 0.0;
          for (int i = 0; i < 7; i++) cond += 1.0 - smoothstep(0.0, 0.0045, abs(dot(d, uAxes[i])));
          float toB = acos(clamp(dot(d, uB), -1.0, 1.0));
          cond *= smoothstep(1.4, 0.05, toB);
          col += vec3(0.2, 1.4, 0.55) * cond * (0.6 + 0.4 * sin(toB * 60.0 - uTime * 3.0));
          col += vec3(0.5, 3.0, 1.2) * exp(-toB * toB * 2200.0) * 3.0 + vec3(0.1, 0.8, 0.3) * exp(-toB * toB * 60.0) * 0.5;
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += vec3(0.1, 0.45, 0.42) * fres * (day + 0.08);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const R = OA.radius;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 96), surface);
    planet.position.copy(OA.center);
    g.add(planet);
    g.add(this.atmosphere(OA.center, R * 1.04, this.oaSun, new THREE.Vector3(0.25, 0.9, 0.8), new THREE.Vector3(0.6, 0.5, 0.3), 1 / 1.04));
    this.oaBattery = OA.center.clone().addScaledVector(battery, R);
    const glow = glowTexture('rgba(255,255,255,1)', 'rgba(90,255,150,0.35)');
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(0.5, 2.5, 1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    beacon.scale.setScalar(26);
    beacon.position.copy(this.oaBattery);
    g.add(beacon);

    // the ringed giant from Oa's sky, beyond the planet to the upper left, half in shadow
    const giantAt = new THREE.Vector3(-1700, 640, -2700), GR = 520, ringAxis = new THREE.Vector3(-0.05, 0.95, -0.1).normalize();
    const giant = new THREE.Mesh(new THREE.SphereGeometry(GR, 96, 48), new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.oaSun }, uAxis: { value: ringAxis } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uAxis; varying vec3 vObj, vN, vW;
        ${NOISE3}
        void main() {
          vec3 d = normalize(vObj), N = normalize(vN), V = normalize(cameraPosition - vW);
          float lat = dot(d, uAxis);
          float band = sin(lat * 24.0 + fbm3(d * 3.0) * 2.5) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.2, 0.34, 0.38), vec3(0.52, 0.56, 0.45), band);
          c = mix(c, vec3(0.62, 0.6, 0.5), smoothstep(0.6, 0.9, fbm3(d * 8.0 + lat * 6.0)) * 0.3);
          float lit = clamp(dot(N, uSun) * 1.1 + 0.03, 0.0, 1.0);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          gl_FragColor = vec4(c * lit * 0.9 + vec3(0.06, 0.16, 0.18) * fres * (lit + 0.05) + c * 0.006, 1.0);
        }`,
    }));
    giant.position.copy(giantAt);
    g.add(giant);
    const ringGeo = new THREE.RingGeometry(GR * 1.35, GR * 2.3, 160, 1);
    const rings = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
      uniforms: { uIn: { value: GR * 1.35 }, uOut: { value: GR * 2.3 } },
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uIn, uOut; varying vec3 vP;
        void main() {
          float r = (length(vP.xy) - uIn) / (uOut - uIn);
          float bands = 0.55 + 0.45 * sin(r * 90.0) * sin(r * 23.0 + 1.0);
          float a = smoothstep(0.0, 0.04, r) * smoothstep(1.0, 0.9, r) * bands * (1.0 - 0.7 * smoothstep(0.42, 0.46, r) * smoothstep(0.52, 0.48, r));
          gl_FragColor = vec4(vec3(0.5, 0.54, 0.5) * 0.45, a * 0.5);
        }`,
    }));
    rings.position.copy(giantAt);
    rings.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringAxis);
    g.add(rings);

    // Oa's sun, off to the right
    const sunTex = glowTexture('rgba(255,255,255,1)', 'rgba(200,255,230,0.25)');
    this.oaStar = new THREE.Group();
    for (const [sc, color, op] of [[70, [5, 5.4, 5], 1], [320, [0.7, 1.0, 0.85], 0.4]]) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: new THREE.Color(...color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
      s.scale.setScalar(sc);
      this.oaStar.add(s);
    }
    this.oaStar.position.copy(this.oaSun).multiplyScalar(2700);
    g.add(this.oaStar);
    this.scene.add(g);
  }

  // Motes of dust and ice drifting past Hal, so speed reads even against the far stars.
  // ------------------------------------------------------------------------------------- ysmault
  // The Inversions' world, Sector 666: dead since the Manhunters. Rust-red rock and black basalt
  // under a dim red sun, the seas long gone to salt flats, old fault lines glowing faintly on the
  // night side, a thin dirty atmosphere.
  buildYsmault() {
    const g = (this.ysmault = new THREE.Group());
    this.ysSun = new THREE.Vector3(-0.75, 0.35, -0.55).normalize();
    const surface = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: this.ysSun }, uTime: this.time },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun; uniform float uTime;
        varying vec3 vObj, vN, vW;
        ${NOISE3}
        void main() {
          vec3 d = normalize(vObj), N = normalize(vN);
          float h = fbm3(d * 3.2), r = fbm3(d * 11.0 + 4.0), m = fbm3(d * 34.0 + 9.0);
          vec3 rust = mix(vec3(0.32, 0.09, 0.05), vec3(0.55, 0.2, 0.1), r);
          vec3 basalt = vec3(0.07, 0.05, 0.05) + m * 0.04;
          vec3 salt = vec3(0.55, 0.45, 0.4);
          vec3 col = mix(basalt, rust, smoothstep(0.38, 0.6, h));
          col = mix(col, salt, smoothstep(0.62, 0.72, h) * (1.0 - smoothstep(0.72, 0.8, h)) * 0.55);
          // craters
          float c = smoothstep(0.62, 0.7, n3(d * 60.0)) * 0.4;
          col *= 1.0 - c;
          float lit = max(dot(N, uSun), 0.0);
          vec3 day = col * (0.05 + 1.4 * lit) * vec3(1.0, 0.82, 0.7);
          // the night side: fault lines faintly lit, like embers
          float fault = 1.0 - smoothstep(0.0, 0.018, abs(fbm3(d * 6.0 + 2.0) - 0.5));
          vec3 night = vec3(0.9, 0.18, 0.06) * fault * 0.35 * smoothstep(0.1, -0.2, dot(N, uSun));
          gl_FragColor = vec4(day + night, 1.0);
        }`,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(YSMAULT.radius, 160, 96), surface);
    planet.position.copy(YSMAULT.center);
    g.add(planet);
    g.add(this.atmosphere(YSMAULT.center, YSMAULT.radius * 1.025, this.ysSun, new THREE.Color(0.55, 0.22, 0.12), new THREE.Color(0.5, 0.06, 0.03), 1 / 1.025));
    // its sun: a swollen red dwarf, dim
    const sun = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.15) }));
    sun.position.copy(this.ysSun).multiplyScalar(3200);
    g.add(sun);
    this.scene.add(g);
  }

  buildDust(count = 900) {
    const geo = new THREE.BufferGeometry();
    this.dustPos = new Float32Array(count * 3).map(() => (Math.random() - 0.5) * 80);
    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(0.55, 0.65, 0.7), size: 0.06, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  show(place) {
    this.place = place;
    const earth = place === 'earth';
    this.earth.visible = earth;
    this.oa.visible = place === 'oa';
    this.ysmault.visible = place === 'ysmault';
    this.skyU.uCore.value = place === 'oa' ? 1 : 0;
    if (place === 'ysmault') {
      // its dim red sun off to the left; no light from the world itself
      this.key.color.set(0xff9a70); this.key.intensity = 1.1; this.key.position.copy(this.ysSun).multiplyScalar(50);
      this.rim.color.set(0x55ffaa); this.rim.intensity = 0.25; this.rim.position.set(0, -20, -50);
      this.hemi.color.set(0x2a1410); this.hemi.groundColor.set(0x0a0606); this.hemi.intensity = 0.3;
      return;
    }
    // Earth's night side: moonlight on Hal, a warm rim from the dawn under the limb; Oa: its sun
    if (earth) {
      this.key.color.set(0xc6d4ff); this.key.intensity = 1.3; this.key.position.copy(this.moonDir).multiplyScalar(50);
      this.rim.color.set(0xffa860); this.rim.intensity = 0.9; this.rim.position.copy(this.earthSun).setY(0.05).multiplyScalar(50);
      this.hemi.color.set(0x1a2436); this.hemi.groundColor.set(0x0c1424); this.hemi.intensity = 0.35;
    } else {
      this.key.color.set(0xeefff6); this.key.intensity = 2.0; this.key.position.copy(this.oaSun).multiplyScalar(50);
      this.rim.color.set(0x55ffaa); this.rim.intensity = 0.4; this.rim.position.set(0, -20, -50);
      this.hemi.color.set(0x203a36); this.hemi.groundColor.set(0x081210); this.hemi.intensity = 0.4;
    }
  }

  update(dt, t, camera) {
    this.time.value = t;
    // keep the backdrop and the far bodies centred on the camera's neighbourhood
    const p = this.dustPos, c = camera.position;
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= this.drift.x * dt; p[i + 1] -= this.drift.y * dt; p[i + 2] -= this.drift.z * dt;
      for (let k = 0; k < 3; k++) {
        const rel = p[i + k] - c.getComponent(k);
        if (rel > 40) p[i + k] -= 80; else if (rel < -40) p[i + k] += 80;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.glow.position.copy(this.anchor ?? _zero).add(_glowOff);
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [o.material ?? []].flat()) m.dispose();
    });
  }
}
const _zero = new THREE.Vector3(), _glowOff = new THREE.Vector3(0, 1.2, 0.6);
