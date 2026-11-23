// The image light from the scene's own sky (the graphics rework, 2026-11-23). Every scene used to light and
// reflect one studio room (three.js's RoomEnvironment: grey walls and white panels), so the street at 2 AM
// was lit as evenly as at dusk, and cars, glass and the suit showed the same white strip lights at every
// hour. A scene that opts in (`scene.userData.skyEnv = true`) gets its sky dome (fx/Sky.js) drawn into a
// cube from inside, without the sun's disc (the sun light makes its own highlight), and prefiltered for
// reflections (PMREM); it's drawn again when the sky has changed enough to see (the day cycle, a preset
// swapped in, the weather), at most twice a second.
import * as THREE from 'three';

const KEYS = ['uTop', 'uHorizon', 'uBottom', 'uSunColor', 'uSunDir', 'uCloudColor', 'uCloudLit'];
const NUMS = ['uCloud', 'uGlow', 'uStars'];

export class SkyEnv {
  constructor(renderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.stage = new THREE.Scene();
    this.t = 1;
  }

  // the values the sky's picture depends on, flat
  values(u) {
    const out = [];
    for (const k of KEYS) { const v = u[k]?.value; if (v) out.push(...(v.isColor ? [v.r, v.g, v.b] : [v.x, v.y, v.z])); }
    for (const k of NUMS) out.push(u[k]?.value ?? 0);
    return out;
  }

  update(scene, dt) {
    if (!scene?.userData.skyEnv) return;
    this.t += dt;
    const state = (scene.userData.skyEnvState ??= { sky: null, last: null, rt: null });
    const sky = scene.children.find((o) => o.userData.isSky);
    if (!sky) return;
    const now = this.values(sky.userData.uniforms);
    const changed = sky !== state.sky || !state.last || now.some((v, i) => Math.abs(v - state.last[i]) > 0.012);
    if (!changed || (state.rt && sky === state.sky && this.t < 0.5)) return;
    this.t = 0;
    this.capture(scene, sky, state, now);
  }

  capture(scene, sky, state, values) {
    const u = sky.userData.uniforms, disc = u.uDisc.value;
    const mesh = new THREE.Mesh(sky.geometry, sky.material);
    this.stage.add(mesh);
    u.uDisc.value = 0;
    const radius = sky.geometry.parameters?.radius ?? 1000;
    const rt = this.pmrem.fromScene(this.stage, 0, radius * 0.01, radius * 2, { size: 256 });
    u.uDisc.value = disc;
    this.stage.remove(mesh);
    state.rt?.dispose();
    Object.assign(state, { sky, last: values, rt });
    scene.environment = rt.texture;
  }
}
