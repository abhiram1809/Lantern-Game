import * as THREE from 'three';
import { prop, meshes, boundsIn, pivot } from './Props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A wheel modelled turned (three of the four town cars have their front wheels steered 20 to 30°)
// spins about the car's axle like a wheel on a bent axle: the traffic's front wheels wobbled from side
// to side. Its disc's axis (the direction its vertices spread least along) is turned back onto the
// axle by a group inside the hub's pivot.
const _wm = new THREE.Matrix4();
function straighten(hub) {
  hub.updateMatrixWorld(true);
  const inv = _wm.copy(hub.matrixWorld).invert(), m = [0, 0, 0], pts = [], p = V(0, 0, 0), M = new THREE.Matrix4();
  hub.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 1200));
    M.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i += step) { p.fromBufferAttribute(pos, i).applyMatrix4(M); pts.push(p.x, p.y, p.z); }
  });
  const n = pts.length / 3;
  if (n < 12) return;
  for (let i = 0; i < pts.length; i++) m[i % 3] += pts[i] / n;
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < pts.length; i += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += (pts[i + a] - m[a]) * (pts[i + b] - m[b]) / n;
  // the least spread: the largest of (trace - C), by power iteration
  const tr = C[0] + C[4] + C[8];
  let a = [1, 0.05, 0.05];
  for (let it = 0; it < 50; it++) {
    const b = [0, 1, 2].map((r) => tr * a[r] - (C[r * 3] * a[0] + C[r * 3 + 1] * a[1] + C[r * 3 + 2] * a[2]));
    const l = Math.hypot(...b) || 1;
    a = b.map((x) => x / l);
  }
  if (a[0] < 0) a = a.map((x) => -x);
  const yaw = Math.atan2(a[2], a[0]);
  if (Math.abs(yaw) < 0.02 || Math.abs(yaw) > 0.7) return; // (straight already, or not a wheel's disc)
  const inner = new THREE.Group();
  for (const c of [...hub.children]) inner.add(c);
  inner.rotation.y = yaw;
  hub.add(inner);
}
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
  g.userData.paint = paintMat ?? null; // (the far cars' batch takes its colour per car: city/Lod.js FarCars)
  g.userData.model = name;
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
  for (const w of g.userData.wheels) straighten(w);
  // the axles (the rear one is where a car turns about), and the front wheels steer: about their
  // upright first, then spinning about the steered axle
  const hubZ = g.userData.wheels.map((w) => w.position.z);
  if (hubZ.length) g.userData.axle = { rear: Math.min(...hubZ), base: Math.max(...hubZ) - Math.min(...hubZ) };
  g.userData.front = g.userData.wheels.filter((w) => w.position.z > 0);
  for (const w of g.userData.front) w.rotation.order = 'YXZ';
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
  // the steering wheel turns about its column (`steer(a)`: radians, positive to the left); the rim's
  // points turn with it
  let turn = 0;
  if (sw) {
    const hub = pivot(g, [sw], c.clone()), axis = toward.clone(); // (toward the driver: positive turns it anticlockwise as he sees it)
    g.userData.steer = (a) => { turn = a; hub.quaternion.setFromAxisAngle(axis, a); };
  }
  g.userData.rim = (side, hour = side === 'L' ? 10 : 2) => {
    const a = ((3 - hour) / 12) * Math.PI * 2 + turn; // 3 o'clock is the driver's right (-X)
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

// A drive the way a car moves: the rear axle follows straights and arcs (each leg's `segs`, { len, k }
// with k the curvature, positive turning left), the body always along its heading, backing up when
// the leg's `dir` is -1 (a change of direction is a new leg: the car stops between them). The path is
// smoothed over a couple of metres, so the steering winds on and off instead of snapping. `at` is the
// car's centre and `yaw` its heading at the start; world x/z. Each leg gets `len` and `pose(s, out)`:
// the centre, the heading and the curvature `s` metres along it.
export function planDrive(car, { at, yaw, legs }) {
  const { rear = -1.3 } = car.userData.axle ?? {}, ds = 0.05, w = 18;
  let x = at.x + Math.sin(yaw) * rear, z = at.z + Math.cos(yaw) * rear, h = yaw;
  return legs.map(({ dir, segs }) => {
    const raw = [[x, z]];
    for (const { len, k = 0 } of segs) {
      const n = Math.max(1, Math.round(len / ds)), step = len / n;
      for (let i = 0; i < n; i++) {
        const turn = k * step * dir, travel = h + (dir < 0 ? Math.PI : 0) + turn / 2;
        x += Math.sin(travel) * step;
        z += Math.cos(travel) * step;
        h += turn;
        raw.push([x, z]);
      }
    }
    // smoothed (the ends held), the heading from the smoothed path, the curvature from the heading
    const n = raw.length, pts = raw.map((_, i) => {
      const r = Math.min(w, i, n - 1 - i);
      let sx = 0, sz = 0;
      for (let j = i - r; j <= i + r; j++) { sx += raw[j][0]; sz += raw[j][1]; }
      return { x: sx / (2 * r + 1), z: sz / (2 * r + 1), yaw: 0, k: 0 };
    });
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      p.yaw = Math.atan2(b.x - a.x, b.z - a.z) + (dir < 0 ? Math.PI : 0);
    });
    const unwrap = (a, b) => b + Math.round((a - b) / (Math.PI * 2)) * Math.PI * 2;
    for (let i = 1; i < n; i++) pts[i].yaw = unwrap(pts[i - 1].yaw, pts[i].yaw);
    pts.forEach((p, i) => (p.k = (pts[Math.min(n - 1, i + 1)].yaw - pts[Math.max(0, i - 1)].yaw) / (2 * ds * dir)));
    h = pts[n - 1].yaw;
    const len = (n - 1) * ds;
    return {
      dir, len,
      pose(s, out = {}) {
        const f = THREE.MathUtils.clamp(s / ds, 0, n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i, a = pts[i], b = pts[i + 1];
        out.yaw = a.yaw + (b.yaw - a.yaw) * u;
        out.k = a.k + (b.k - a.k) * u;
        out.x = a.x + (b.x - a.x) * u - Math.sin(out.yaw) * rear;
        out.z = a.z + (b.z - a.z) * u - Math.cos(out.yaw) * rear;
        return out;
      },
    };
  });
}

// When the car is where along a leg: a speed profile under `limit` ([s, speed] points, linear in
// between), entering at `v0` and leaving at `v1`, accelerating and braking at most `accel` / `brake`
// (m/s²). Returns { T, s(t), time(s) }.
export function timeLeg(leg, { limit, v0 = 0, v1 = 0, accel = 2, brake = 2.5 }) {
  const ds = 0.25, n = Math.max(2, Math.ceil(leg.len / ds) + 1), step = leg.len / (n - 1);
  const cap = (s) => {
    let i = 0;
    while (i < limit.length - 2 && s > limit[i + 1][0]) i++;
    const [s0, a] = limit[i], [s1, b] = limit[Math.min(i + 1, limit.length - 1)];
    return s1 > s0 ? a + (b - a) * THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1) : a;
  };
  const v = Array.from({ length: n }, (_, i) => cap(i * step));
  v[0] = Math.min(v[0], v0);
  for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * accel * step));
  v[n - 1] = Math.min(v[n - 1], v1);
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * brake * step));
  const t = [0];
  for (let i = 1; i < n; i++) t.push(t[i - 1] + (2 * step) / Math.max(0.05, v[i] + v[i - 1]));
  const T = t[n - 1];
  return {
    T,
    time(s) {
      const f = THREE.MathUtils.clamp(s / step, 0, n - 1), i = Math.min(n - 2, Math.floor(f));
      return t[i] + (t[i + 1] - t[i]) * (f - i);
    },
    s(time) {
      let i = 1;
      while (i < n - 1 && t[i] < time) i++;
      const u = THREE.MathUtils.clamp((time - t[i - 1]) / Math.max(1e-6, t[i] - t[i - 1]), 0, 1);
      return (i - 1 + u) * step;
    },
  };
}

// Put a car on its leg at `s` (the wheels turning through the distance since the last call, the
// front ones steered for the curvature). Returns the new s.
export function rollCar(car, leg, s, last) {
  const ud = car.userData, p = leg.pose(s, _pose), base = ud.axle?.base ?? 2.7;
  car.position.x = p.x;
  car.position.z = p.z;
  car.rotation.y = p.yaw;
  for (const w of ud.wheels) w.rotation.x += (leg.dir * (s - last)) / 0.33;
  for (const w of ud.front ?? []) w.rotation.y = Math.atan(base * p.k);
  return s;
}
const _pose = {};

// (the amounts are uniforms, not numbers written into the shader: one program for every car's paint.
// Each car's dust in its source was a program of its own, about a hundred of them, and compiling them
// was most of free roam's way in)
function roughFloor(mat, r) {
  const u = { value: r };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRoughFloor = u;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRoughFloor;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, uRoughFloor);');
  };
  mat.customProgramCacheKey = () => 'gl-rough';
}

// Dust settling on a car's lower body: paler and flatter toward the ground.
function dusty(mat, amount) {
  const u = { value: amount };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDust = u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDustY;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDustY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDustY;\nuniform float uDust;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float dustK = uDust * (1.0 - smoothstep(0.15, 0.85, vDustY));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.53, 0.42), dustK * 0.75);
        roughnessFactor = mix(roughnessFactor, 0.95, dustK);`);
  };
  mat.customProgramCacheKey = () => 'gl-dust';
}
