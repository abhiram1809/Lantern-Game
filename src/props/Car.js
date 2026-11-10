import * as THREE from 'three';
import { prop, meshes, boundsIn, pivot } from './Props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PAINT = /^(body|bodycolou?r|510w_body)$/i;

// A car from the props (CREDITS.md), nose to +Z, origin on the ground at its centre:
//   paint        its colour (the body material, sun-faded and dusty toward the sills)
//   primer       the driver's door in grey primer (Hal's car)
// userData: `wheels` (pivots at the hubs: spin with rotation.x), `door` (the driver's door on its
// hinge: `openDoor(k)`, 0 shut to 1 open), `wheel` (the steering wheel), `seat` (the driver's hip
// joints' midpoint), `pedals` (where his ankles go), `rim(side, clock)` (a point on the steering
// wheel's rim, for a hand: 'L' or 'R', the hour), `tail` (the trunk lid's rear edge), `exhaust`
// (a tailpipe's mouth). All in the car's own frame.
export function makeCar(name, { paint = 0x8c2a22, primer = false, dust = 0.55 } = {}) {
  const g = new THREE.Group();
  const car = prop(name, { ownMaterials: true });
  g.add(car);
  g.updateMatrixWorld(true);
  const all = meshes(car, () => true);
  // chrome a little less mirror-like: the sun in a 0.1-rough bumper blooms into white blobs (the
  // roughness comes from a map on most parts, so the floor goes in the shader)
  for (const m of new Set(all.map((o) => o.material))) if (m.metalness > 0.5 || m.metalnessMap) roughFloor(m, 0.45);
  // lamp lenses and glass: less of the sky in them (the lenses read as lit)
  for (const m of new Set(all.map((o) => o.material))) if (m.transparent) { m.envMapIntensity = 0.35; if (/light/i.test(m.name)) { m.roughness = Math.max(m.roughness, 0.3); m.color.multiplyScalar(0.75); } }
  // paint, faded, with the desert's dust on the lower body
  const paintMat = all.map((m) => m.material).find((m) => PAINT.test(m.name));
  if (paintMat) {
    paintMat.color.set(paint);
    paintMat.metalness = 0.35;
    paintMat.roughness = 0.5;
    dusty(paintMat, dust);
  }
  // the wheels, each on a pivot at its hub
  const wheelSets = {};
  for (const m of all) {
    const k = /Wheel_(FL|FR|RL|RR)/i.exec(m.name)?.[1] ?? /wheel_0([1-4])/i.exec(m.name)?.[1];
    if (k) (wheelSets[k] ??= []).push(m);
  }
  g.userData.wheels = Object.values(wheelSets).map((list) => pivot(g, list, boundsIn(g, list).getCenter(V(0, 0, 0))));
  // the driver's door (front left: +X, the US driver's side), hinged at its front edge
  const doorParts = all.filter((m) => /door/i.test(m.name) && /(^|_)FL(_|$)/.test(m.name));
  if (doorParts.length) {
    const outer = doorParts.filter((m) => m.material === paintMat);
    const b = boundsIn(g, outer.length ? outer : doorParts);
    const door = pivot(g, doorParts, V(b.max.x - 0.06, (b.min.y + b.max.y) / 2, b.max.z - 0.07));
    g.userData.door = door;
    g.userData.openDoor = (k) => (door.rotation.y = -1.15 * k);
    if (primer) {
      const grey = new THREE.MeshStandardMaterial({ color: 0x5e605d, roughness: 0.95, metalness: 0 });
      dusty(grey, dust);
      for (const m of doorParts) if (m.material === paintMat) m.material = grey;
    }
  }
  const sw = all.find((m) => /Steering_wheel/i.test(m.name));
  if (sw) g.userData.wheel = sw;
  // the driver: hips sunk a little into the bucket's cushion, half a metre behind the wheel, ankles
  // in the footwell under the dash (measured on the Phoenix: cushion 0.44, floor 0.27, roof 1.3)
  const c = sw ? boundsIn(g, [sw]).getCenter(V(0, 0, 0)) : V(0.37, 0.78, 0.1);
  g.userData.seat = V(c.x, 0.48, c.z - 0.46);
  g.userData.pedals = V(c.x, 0.36, c.z + 0.24);
  // the rim: radius 0.17, its face tilted 31 degrees back toward the driver (the column's angle)
  const up = V(0, 0.857, 0.515), toward = V(0, 0.515, -0.857);
  g.userData.rim = (side, hour = side === 'L' ? 10 : 2) => {
    const a = ((3 - hour) / 12) * Math.PI * 2; // 3 o'clock is the driver's right (-X)
    // the wrist, a hand's breadth back from the rim and a little outside it, so the palm closes on it
    return c.clone().addScaledVector(V(-1, 0, 0), Math.cos(a) * 0.19).addScaledVector(up, Math.sin(a) * 0.19 - 0.03).addScaledVector(toward, 0.085);
  };
  const tb = boundsIn(g, all.filter((m) => /Trunk_?door/i.test(m.name) && m.material === paintMat));
  g.userData.tail = V(0, tb.isEmpty() ? 0.88 : tb.max.y - 0.02, tb.isEmpty() ? -2.3 : tb.min.z + 0.04);
  const ex = all.filter((m) => /exhaust/i.test(m.name));
  const eb = ex.length ? boundsIn(g, ex) : null;
  g.userData.exhaust = eb ? V(eb.max.x - 0.08, eb.min.y + 0.05, eb.min.z) : V(0.45, 0.25, -2.4);
  return g;
}

function roughFloor(mat, r) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${r.toFixed(2)});`);
  };
  mat.customProgramCacheKey = () => `gl-rough-${r}`;
}

// Dust settling on a car's lower body: paler and flatter toward the ground.
function dusty(mat, amount) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDustY;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDustY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDustY;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float dustK = ${amount.toFixed(2)} * (1.0 - smoothstep(0.15, 0.85, vDustY));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.53, 0.42), dustK * 0.75);
        roughnessFactor = mix(roughnessFactor, 0.95, dustK);`);
  };
  mat.customProgramCacheKey = () => `gl-dust-${amount}`;
}
