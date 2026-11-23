// The valley's day in free roam (the user's "time and weather", 2026-11-18): a clock at GTA's pace (a
// minute every two seconds, a day in 48), the sun on its arc from the east over the south to the
// west, the moon after it, and the light, the sky, the haze and the town's lamps and windows blended
// between the times of day the story already had (Sky.js's presets, Ferris's `day()`, `dusk()`,
// `night()`, `dawn()`), then the weather over that: clear most days, the marine layer some mornings,
// overcast, now and then rain (streaks round the camera, the streets darker and glossier, its hiss).
// Only free roam runs it; the story's chapters keep their own fixed light.
import * as THREE from 'three';
import { PRESETS } from '../fx/Sky.js';
import { cityU } from '../city/Kit.js';

const RATE = 1 / 120; // game hours a second
const RISE = 6.0, SET = 19.6; // (summer on the California coast)
// the times of day: the sky preset and what Ferris's presets set the lights to. `env` is the image light from
// the sky itself (fx/SkyEnv.js: darker than the studio room it replaced, so about twice what it was by day, and
// the night's moonlit fill from the hemisphere light, bluer and stronger); `sat` and `contrast` the grade. (The
// graphics rework, 2026-11-23: warmer sun and haze by day, a Californian coast's gold in the afternoon; the polish
// pass: the sky's fill cooler and deeper, so the warm sun stands out against blue shade.)
const NIGHT = { sky: 'night', sun: 0x9fb2d8, sunI: 0.36, hemiSky: 0x5a6c9c, hemiGround: 0x2a282e, hemi: 0.62, fog: 0x121722, fogD: 0.0009, exposure: 1.0, night: 1, env: 1.6, sat: 0.92, contrast: 1.06 };
const KEYS = [
  { h: 0, ...NIGHT },
  { h: 4.9, ...NIGHT },
  { h: 6.3, sky: 'dawn', sun: 0xffbc86, sunI: 1.7, hemiSky: 0x7f8fb8, hemiGround: 0x5e4a40, hemi: 0.56, fog: 0xbba4a0, fogD: 0.0006, exposure: 0.95, night: 0.15, env: 0.65, sat: 1.04, contrast: 1.04 },
  { h: 7.6, sky: 'morning', sun: 0xffecc8, sunI: 2.4, hemiSky: 0x7896bc, hemiGround: 0x7e6a52, hemi: 0.65, fog: 0xcfd3d4, fogD: 0.0005, exposure: 0.86, night: 0, env: 0.8, sat: 1.06, contrast: 1.05 },
  { h: 10.5, sky: 'desert', sun: 0xfff0d6, sunI: 2.9, hemiSky: 0x6b8fb5, hemiGround: 0x8c7458, hemi: 0.65, fog: 0xd9d6cc, fogD: 0.00042, exposure: 0.82, night: 0, env: 0.85, sat: 1.08, contrast: 1.06 },
  { h: 16.8, sky: 'desert', sun: 0xffd8a8, sunI: 2.8, hemiSky: 0x6e8cb2, hemiGround: 0x8c7054, hemi: 0.65, fog: 0xe0d0ba, fogD: 0.00045, exposure: 0.83, night: 0, env: 0.85, sat: 1.1, contrast: 1.07 },
  { h: 18.7, sky: 'sunset', sun: 0xffb878, sunI: 2.1, hemiSky: 0x7c88b0, hemiGround: 0x705040, hemi: 0.58, fog: 0xd6a88a, fogD: 0.0005, exposure: 0.9, night: 0.1, env: 0.92, sat: 1.12, contrast: 1.07 },
  { h: 19.5, sky: 'dusk', sun: 0xffa86e, sunI: 1.3, hemiSky: 0x76849f, hemiGround: 0x6a4a38, hemi: 0.58, fog: 0xc49a86, fogD: 0.00055, exposure: 0.95, night: 0.5, env: 0.85, sat: 1.06, contrast: 1.06 },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];
// what each weather does over the time of day (blended in over about half a game hour)
const WEATHER = {
  clear: { cloud: 0, sun: 1, fog: 1, grey: 0, rain: 0 },
  haze: { cloud: 0.35, sun: 0.7, fog: 11, grey: 0.45, rain: 0 }, // (the marine layer, in from the sea of a morning)
  overcast: { cloud: 0.75, sun: 0.35, fog: 3, grey: 0.55, rain: 0 },
  rain: { cloud: 0.95, sun: 0.18, fog: 5, grey: 0.7, rain: 1 },
};
const GREY = new THREE.Color(0xb4bac0), GREY_NIGHT = new THREE.Color(0x1a1d22);
const COLORS = ['top', 'horizon', 'bottom', 'sun', 'cloudColor', 'cloudLit'];
const _c = new THREE.Color(), _d = new THREE.Vector3(), _a = {}, _b = {};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const clockText = (h) => { const m = Math.floor((h % 24) * 60), hh = Math.floor(m / 60), mm = m % 60; return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };

export class DayCycle {
  // f: the Ferris scene; life: the open world's store (engine/Save.js LifeSave)
  constructor(f, life, { audio, engine } = {}) {
    Object.assign(this, { f, life, audio, engine });
    const d = life.load();
    this.hour = d.hour;
    this.day = d.day;
    this.weather = d.weather;
    this.weatherNext = d.weatherNext;
    this.w = { ...WEATHER[this.weather] }; // the weather as it is now (eased toward its target)
    this.saveT = 0;
    this.k = -1;
    this.rain = new Rain(f.scene);
  }

  get night() { return this.k; } // (0 by day to 1 at night: the lamps, the windows)
  get isNight() { return this.k > 0.5; }
  get clock() { return clockText(this.hour); }

  // the clock on (also while he's away: the day goes on on Earth)
  tick(dt) {
    this.hour += dt * RATE;
    if (this.hour >= 24) { this.hour -= 24; this.day++; this.weatherNext -= 24; }
    if (this.hour > this.weatherNext) this.pickWeather();
    const target = WEATHER[this.weather];
    for (const k in target) this.w[k] += (target[k] - this.w[k]) * Math.min(1, dt * RATE * 3);
    if ((this.saveT += dt) > 10) { this.saveT = 0; this.save(); }
  }

  // set the hour (sleeping through to it, or a test)
  setHour(h, nextDay = false) {
    if (nextDay || h < this.hour) this.day++;
    this.hour = ((h % 24) + 24) % 24;
    this.weatherNext = this.hour + 2 + Math.random() * 4;
    this.save();
  }
  setWeather(name, now = false) {
    this.weather = name;
    if (now) Object.assign(this.w, WEATHER[name]);
    this.weatherNext = this.hour + 3 + Math.random() * 4;
  }
  // mostly clear (it's California); the marine layer only of a morning, rain seldom
  pickWeather() {
    const h = this.hour, r = Math.random();
    const morning = h > 4 && h < 10;
    this.weather = morning && r < 0.35 ? 'haze' : r < 0.68 ? 'clear' : r < 0.86 ? 'overcast' : r < 0.95 ? 'clear' : 'rain';
    this.weatherNext = h + 2.5 + Math.random() * 4.5;
  }
  save() { this.life.update((d) => Object.assign(d, { hour: this.hour, day: this.day, weather: this.weather, weatherNext: this.weatherNext })); }

  // the sun's direction now (the sky's and the light's): its arc, east (+x) over the south (-z) to the west
  sunDir(out) {
    const a = Math.PI * (this.hour - RISE) / (SET - RISE);
    return out.set(Math.cos(a), Math.sin(a) * 0.94, -0.34 * Math.sin(a) - 0.12).normalize();
  }
  moonDir(out) {
    const n = ((this.hour - SET + 24) % 24) / (24 - (SET - RISE)), a = Math.PI * n;
    return out.set(Math.cos(a) * 0.6, 0.18 + 0.55 * Math.sin(a), -0.8).normalize();
  }

  // the scene to this hour and this weather
  apply(camera) {
    const f = this.f, s = f.scene, sky = f.sky.userData.uniforms, w = this.w;
    // the two times of day either side of now, and how far between them
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= this.hour) i++;
    const A = KEYS[i], B = KEYS[i + 1], t = smooth(0, 1, (this.hour - A.h) / (B.h - A.h));
    const k = THREE.MathUtils.lerp(A.night, B.night, t);
    // the sky: the presets' colours blended, the clouds and the grey of the weather over them
    const pa = PRESETS[A.sky], pb = PRESETS[B.sky], grey = k > 0.5 ? GREY_NIGHT : GREY;
    for (const c of COLORS) {
      _a[c] ??= new THREE.Color(); _b[c] ??= new THREE.Color();
      _a[c].setHex(pa[c]).lerp(_b[c].setHex(pb[c]), t);
    }
    sky.uTop.value.copy(_a.top).lerp(grey, w.grey * 0.8);
    sky.uHorizon.value.copy(_a.horizon).lerp(grey, w.grey * 0.7);
    sky.uBottom.value.copy(_a.bottom).lerp(grey, w.grey * 0.5);
    sky.uCloudColor.value.copy(_a.cloudColor).lerp(grey, w.grey * 0.6);
    sky.uCloudLit.value.copy(_a.cloudLit).lerp(grey, w.grey * 0.5);
    sky.uCloud.value = Math.min(1, THREE.MathUtils.lerp(pa.cloud, pb.cloud, t) + w.cloud);
    sky.uStars.value = THREE.MathUtils.lerp(pa.stars, pb.stars, t) * (1 - w.cloud);
    sky.uGlow.value = THREE.MathUtils.lerp(pa.glow, pb.glow, t) * (1 - w.cloud * 0.7);
    sky.uSunSize.value = THREE.MathUtils.lerp(pa.sunSize, pb.sunSize, t);
    // the light: the sun while it's up, the moon after; each faded out at the horizon, so the light
    // turns from one to the other unseen
    const e = this.sunDir(_d).y, up = e > -0.02;
    if (!up) this.moonDir(_d);
    const fade = up ? smooth(-0.02, 0.07, e) : smooth(-0.02, 0.07, -e);
    sky.uSunDir.value.copy(_d);
    sky.uSunColor.value.copy(_a.sun).multiplyScalar(fade * (1 - w.cloud * 0.85));
    f.sun.color.setHex(A.sun).lerp(_c.setHex(B.sun), t);
    f.sun.intensity = THREE.MathUtils.lerp(A.sunI, B.sunI, t) * fade * w.sun;
    f.hemi.color.setHex(A.hemiSky).lerp(_c.setHex(B.hemiSky), t).lerp(grey, w.grey * 0.3);
    f.hemi.groundColor.setHex(A.hemiGround).lerp(_c.setHex(B.hemiGround), t);
    f.hemi.intensity = THREE.MathUtils.lerp(A.hemi, B.hemi, t) * (1 + w.grey * 0.15);
    // (the haze's own colour: Ferris.update turns it toward the sky's behind what the camera looks at)
    f.fogBase.setHex(A.fog).lerp(_c.setHex(B.fog), t).lerp(grey, w.grey * 0.6);
    f.hazeSky = 0.5 * (1 - w.grey * 0.6);
    const g = (s.userData.grade ??= {});
    g.sat = THREE.MathUtils.lerp(A.sat, B.sat, t) * (1 - w.grey * 0.08);
    g.contrast = THREE.MathUtils.lerp(A.contrast, B.contrast, t);
    if (this.engine && this.engine.scene === s) { this.engine.gradeUniforms.uSat.value = g.sat; this.engine.gradeUniforms.uContrast.value = g.contrast; }
    s.fog.density = THREE.MathUtils.lerp(A.fogD, B.fogD, t) * (f.highAir ? 0.076 * Math.min(w.fog, 2.5) : w.fog);
    if (this.engine && this.engine.scene === s) this.engine.renderer.toneMappingExposure = THREE.MathUtils.lerp(A.exposure, B.exposure, t);
    s.userData.exposure = THREE.MathUtils.lerp(A.exposure, B.exposure, t);
    // (the image light: at its day's 0.4 all night, the street at 2 AM was lit like an overcast noon)
    s.environmentIntensity = THREE.MathUtils.lerp(A.env, B.env, t) * (1 + w.grey * 0.12);
    // the town: its lamps, its windows, its people indoors by night (and on overcast days the lamps
    // come on early)
    const lamps = Math.max(k, w.grey * 0.35 * (1 - k));
    if (Math.abs(lamps - this.k) > 0.003) { this.k = lamps; f.block?.setNight(lamps); f.office?.setNight(lamps); f.city?.setNight(lamps); }
    f.isNight = k > 0.5;
    // (the glass's rooms and reflections: city/Kit.js)
    cityU.uSkyTop.value.copy(sky.uTop.value);
    cityU.uSkyHor.value.copy(sky.uHorizon.value);
    cityU.uDayLight.value.copy(f.sun.color).multiplyScalar(Math.min(1, f.sun.intensity / 2.7) * 0.8 + 0.2);
    // the rain round the camera, and the streets wet under it
    this.rain.set(w.rain, camera, f.indoors?.(camera.position));
    this.wet(w.rain);
  }

  update(dt, camera) {
    this.rain.update(dt, camera);
    const a = this.audio;
    if (!a) return;
    const inside = this.f.indoors?.(camera.position);
    const rain = this.w.rain * 0.2 * (inside ? 0.35 : 1);
    if (rain > 0.005 && !this.rainLoop) this.rainLoop = a.rain(0);
    this.rainLoop?.level(rain, 2);
    // crickets in the dark (out on the desert most, the town fainter), birds of a dry morning
    const crickets = this.k > 0.6 && this.w.rain < 0.3 ? (inside ? 0.008 : camera.position.z > 3200 ? 0.02 : 0.045) : 0;
    if (crickets > 0 && !this.cricketLoop) this.cricketLoop = a.crickets(0);
    this.cricketLoop?.level(crickets, 3);
    if (!inside && this.hour > 5.8 && this.hour < 10.5 && this.w.rain < 0.2 && Math.random() < dt * 0.3) a.birdsong();
  }
  quiet() { this.rainLoop?.level(0, 1); this.cricketLoop?.level(0, 1); }

  // the roads, the pavements and the apron darker and glossier in the rain (their own materials,
  // remembered as they were)
  wet(k) {
    if (Math.abs(k - (this.wetK ?? 0)) < 0.01) return;
    this.wetK = k;
    const mats = (this.wetMats ??= collectWet(this.f.scene));
    for (const m of mats) {
      const o = m.userData.dry ??= { color: m.color.clone(), roughness: m.roughness };
      m.color.copy(o.color).multiplyScalar(1 - 0.38 * k);
      m.roughness = Math.max(0.42, o.roughness * (1 - 0.4 * k)); // (glossier went to white in the bloom: the kerbs)
    }
  }

  dispose() { this.rainLoop?.stop(1); this.cricketLoop?.stop(1); this.rain.dispose(); }
}

// the materials the rain wets: the asphalt and concrete surfaces (Poly Haven's, by their textures)
function collectWet(scene) {
  const out = new Set();
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      const src = m?.roughnessMap?.source?.data?.src ?? m?.roughnessMap?.image?.src ?? '';
      if (m?.isMeshStandardMaterial && /asphalt|concrete/.test(src)) out.add(m);
    }
  });
  return [...out];
}

// Rain: streaks in a box that follows the camera, falling and slanting with the wind, drawn as lines;
// off indoors
class Rain {
  constructor(scene, n = 2600) {
    this.n = n;
    this.size = new THREE.Vector3(46, 26, 46);
    const pos = new Float32Array(n * 6);
    this.seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.seed[i * 3] = Math.random(); this.seed[i * 3 + 1] = Math.random(); this.seed[i * 3 + 2] = Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xaab6c4, transparent: true, opacity: 0, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.t = 0;
    scene.add(this.lines);
  }
  set(k, camera, indoors) {
    this.k = k;
    this.lines.visible = k > 0.02 && !indoors;
    this.mat.opacity = Math.min(0.55, k * 0.6);
  }
  update(dt, camera) {
    if (!this.lines.visible) return;
    this.t += dt;
    const { n, size, seed } = this, p = this.lines.geometry.attributes.position.array, c = camera.position;
    const fall = 11, wind = 1.6, len = 0.55;
    for (let i = 0; i < n; i++) {
      // each drop fixed in the world, falling, and wrapped into the box round the camera (so turning
      // or walking never shows its edges)
      const wx = c.x + wrap(seed[i * 3] * size.x + this.t * wind - c.x, size.x);
      const wz = c.z + wrap(seed[i * 3 + 2] * size.z - c.z, size.z);
      const wy = c.y + wrap(seed[i * 3 + 1] * size.y - this.t * fall - c.y, size.y);
      p[i * 6] = wx; p[i * 6 + 1] = wy; p[i * 6 + 2] = wz;
      p[i * 6 + 3] = wx - wind * len / fall; p[i * 6 + 4] = wy + len; p[i * 6 + 5] = wz;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.lines.removeFromParent(); this.lines.geometry.dispose(); this.mat.dispose(); }
}
const wrap = (v, s) => ((((v + s / 2) % s) + s) % s) - s / 2;
