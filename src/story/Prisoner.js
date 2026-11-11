import * as THREE from 'three';
import { wait, waitFor, tween, ease, onFrame } from '../engine/Time.js';
import { PrisonerSave } from '../engine/Save.js';
import { Coast } from './Coast.js';
import { Corps } from './Corps.js';
import { voyage } from './Voyage.js';
import { POSES, still } from '../characters/Poses.js';
import { createRing, createAtrocitus } from '../characters/Characters.js';
import { Sinestro } from '../enemies/Sinestro.js';
import { createShaft } from '../fx/GreenLight.js';
import { Particles } from '../fx/Particles.js';
import { TravelHud, StarMap } from '../ui/TravelHud.js';
import { toGlyphs } from '../ui/UI.js';
import { CAROL_SPOT, CAR_SPOT, FERRIS_PROPS } from '../scenes/Ferris.js';
import { SHIP, ABIN_SPOT, ARRIVAL, terrainHeight } from '../scenes/CrashSite.js';
import { HALL, BIER, DAIS_TOP } from '../scenes/Hall.js';
import { loadProps, hasProp, meshes, boundsIn } from '../props/Props.js';
import { RAPIER } from '../engine/Physics.js';
import { Atrocitus } from '../enemies/Atrocitus.js';
import { Site, SITE_PROPS, SITE_IN, DEVICE, EXCAVATOR, ARENA } from '../scenes/Site.js';
import { Ysmault, YSMAULT_PROPS, STAKE, LANDING } from '../scenes/Ysmault.js';
import { Animator } from '../characters/Rig.js';
import { CONSTRUCTS, constructMesh } from '../powers/Constructs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the wreck's frame at the lake: along the hull (toward the tail) and out of it on the shore side
const AX = V(SHIP.axis.x, 0, SHIP.axis.y), OUT = V(-SHIP.axis.y, 0, SHIP.axis.x);
const SIN_WRECK = ABIN_SPOT.clone().addScaledVector(OUT, 0.9).addScaledVector(AX, -1.2); // where Sinestro waits, off the hull

// Part Four, "The Prisoner": the second half of Secret Origin. Friday morning Carol takes Hal back
// as her pilot (and won't date an employee); that night Sinestro shows him the empty prisoner cell
// in Abin Sur's wreck; downtown the two of them fight Atrocitus, whose device drains their rings,
// until Hal calls his lantern out of the pocket dimension and smashes the excavator Atrocitus
// would crush Sinestro with; Ysmault, where Atrocitus is chained and prophesies; the Guardians'
// verdict on Oa. Built on Coast (Ferris, Carol, the suit-up) with Corps' Oa and travel mixed in.
export class Prisoner extends Coast {
  get save() { return PrisonerSave; }

  constructor(opts) {
    super(opts);
    this.travelHud = new TravelHud();
    this.chart = new StarMap(this.input, this.audio);
  }

  steps() {
    return {
      pilot: () => this.pilot(),
      cell: () => this.cell(),
      site: () => this.atrocitus(), // (not `site`: that's the lake scene, Story.site)
      ysmault: () => this.ysmault(),
      trial: () => this.trial(),
    };
  }

  update(dt, t, real) {
    super.update(dt, t, real);
    this.chart.update();
  }

  async prepare(id) {
    const { ui, player } = this;
    await loadProps([...FERRIS_PROPS, 'phone', 'fridge', 'coffee', 'm35', 'lighttower']);
    ui.clock(this.save.info(id).clock);
    this.ring = createRing();
    this.attachRing(this.ring, this.hal);
    this.powers.ring = this.ring;
    Object.assign(this.powers.enabled, { hud: false, constructs: false, flight: false });
    this.hud.show(false);
    player.setTired(0.2);
    if (id === 'pilot') return; // pilot() builds Ferris and puts him in the lot
    this.lanternUp();
  }

  // From the lake on he's Green Lantern for the night: the suit, the ring's HUD and powers at full
  // charge, what he learned on Oa, the lantern in its pocket dimension. Every night chapter calls
  // it first: played on from the pilot's morning, prepare() never ran for them and he came to the
  // lake (and downtown) in his clothes, with no HUD.
  lanternUp() {
    if (this.player.rig !== this.suit) this.putOnSuit();
    this.empower(true);
    this.learn('gatling', false);
    this.learn('sword', false);
    this.pocketLantern(); // (one set down in the last scene would be in the wrong world)
  }

  // ---------------------------------------------------------------- 1. his pilot
  // Friday, 8:52: Carol called at seven. On the apron by the prototype (repaired, back on its
  // wheels), she takes him back on probation; he asks her to dinner; she doesn't date employees.
  async pilot() {
    const { ui, director, player } = this;
    const f = this.setupFerris();
    f.car.rotation.y = Math.PI;
    this.enterFerris(CAR_SPOT.clone().add(V(-2.45, 0, 0.45)), Math.PI * 0.9);
    ui.clock(this.save.info('pilot').clock);
    const carol = this.addCarol();
    this.director.mode = 'follow';
    await ui.fade(0, 1.2);
    f.follow = (cam) => _p.set(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).setLength(15).add(player.position);
    this.giveControl('Carol’s waiting on the apron');
    await wait(1.2);
    this.bark('halPilot0');
    await waitFor(() => Math.hypot(player.position.x - CAROL_SPOT.x, player.position.z - CAROL_SPOT.z) < 6.5);
    f.follow = null;
    this.takeControl();
    const cb = this.cb, ca = this.carolAnim;
    const stand = CAROL_SPOT.clone().add(V(-0.6, 0, 2.6));
    if (player.position.distanceTo(stand) > 0.5) await player.walkTo(stand, player.walkSpeed);
    player.turnTo(Math.atan2(CAROL_SPOT.x - stand.x, CAROL_SPOT.z - stand.z));
    if (carol) {
      const from = carol.root.rotation.y, to = Math.atan2(stand.x - CAROL_SPOT.x, stand.z - CAROL_SPOT.z);
      tween(1.2, (k) => (carol.root.rotation.y = from + wrap(to - from) * ease.inOut(k)));
      player.lookAt(() => carol.bonePosition('head', _h), 0.8);
    }
    f.focus(CAROL_SPOT);
    await this.overHal(1.8);
    await this.carolSay('carolP1', [['early', () => ca.gesture('chin', 1.1, 0.4)]]);
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.9, 0.3);
    await this.say('halP1');
    await this.carolClose(1.2);
    await this.carolSay('carolP2', [['test', 'open'], ['cockpit', () => cb.pointAt(f.jet.position.clone().setY(2.2), 1.6)]]);
    await this.carolSay('carolP3', [['hospital', () => ca.gesture('shake', 1, 0.3)]]);
    await this.overHal(1.4);
    await this.carolSay('carolP4', [['pilot', 'open'], ['regret', 'cut']]);
    await this.halClose(1.0);
    player.animator.gesture('nod', 1, 0.4);
    await this.say('halP2');
    await wait(0.6);
    await this.halClose(0.8, -1);
    await this.say('halP3');
    await this.carolClose(1.4, -1, 28);
    await wait(0.5);
    await this.carolSay('carolP5', [['employees', () => ca.gesture('tilt', 1.2, 0.5)]]);
    // she goes, and turns back at the jet's nose
    if (carol) {
      // (toward Hangar Three across the open apron, clear of the stand and the tool chest)
      const loco = this.carolLoco, dest = CAROL_SPOT.clone().add(V(5, 0, 7)), from = carol.root.position.clone();
      ca.lookAt(null);
      const yaw0 = carol.root.rotation.y, yaw1 = Math.atan2(dest.x - from.x, dest.z - from.z);
      director.move(stand.clone().add(V(1.6, 1.7, 2.4)), from.clone().setY(1.3), 1.6, ease.inOut, 42);
      await tween(0.7, (k) => (carol.root.rotation.y = yaw0 + wrap(yaw1 - yaw0) * ease.inOut(k)));
      const dir = dest.clone().sub(from).setLength(1), len = from.distanceTo(dest), look = new THREE.Vector3();
      await tween(len / 1.2, (k) => {
        loco.speed = Math.min(1.2, k * 8);
        carol.root.position.copy(from).addScaledVector(dir, len * k);
        look.copy(carol.root.position).y += 1.3;
        director.look.lerp(look, 0.08);
      }, ease.linear);
      loco.speed = 0;
      const back = Math.atan2(stand.x - dest.x, stand.z - dest.z), y2 = carol.root.rotation.y;
      await tween(0.8, (k) => (carol.root.rotation.y = y2 + wrap(back - y2) * ease.inOut(k)));
      ca.lookAt(this.headOf(player.rig), 0.6);
      await this.carolSay('carolP6', [['thank', () => ca.gesture('nod', 1, 0.35)]]);
      await this.halClose(1.2);
    }
    await this.say('halP4', { hold: 1.0 });
    await ui.fade(1, 1.6);
  }

  // ---------------------------------------------------------------- 2. the empty cell
  // 10:40 PM, the lake: the Air Force's lights still on the wreck, nobody there but Sinestro. The
  // cell in the hull torn open from inside, the prisoner's blood still burning on the shore, a word
  // cut into a rock in Ysmault's script. Sinestro names him: Atrocitus. The trail leads west.
  async cell() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    const site = this.setupCrash({ body: false });
    this.enterCrash();
    this.removeAbin?.();
    site.fireRest = 0.02;
    for (const fire of site.fires) fire.intensity = 0.02;
    this.airForceNight(site);
    this.lanternSpots(site);
    this.world = 'earth';
    ui.clock(this.save.info('cell').clock);
    const sin = this.addSinestroAt(site);
    sin.place(SIN_WRECK, Math.atan2(ARRIVAL.x - SIN_WRECK.x, ARRIVAL.z - SIN_WRECK.z));
    const clues = this.wreckClues(site);
    // in over the lake from the city side
    this.ringSay('ringSinCall');
    await this.arriveFlying(V(-16, 26, 30), Math.PI * 0.82, V(3, -4, -8));
    await ui.fade(0, 0.8);
    powers.markerTarget = { pos: SIN_WRECK.clone().setY(2.2), label: 'Sinestro' };
    this.giveControl('Meet Sinestro at Abin Sur’s ship');
    await waitFor(() => !player.flying && player.position.distanceTo(SIN_WRECK) < 7);
    powers.markerTarget = null;
    this.takeControl();
    const meet = SIN_WRECK.clone().addScaledVector(V(ARRIVAL.x - SIN_WRECK.x, 0, ARRIVAL.z - SIN_WRECK.z).normalize(), 2.6);
    meet.y = terrainHeight(meet.x, meet.z);
    if (player.position.distanceTo(meet) > 0.6) await player.walkTo(meet, player.walkSpeed);
    player.turnTo(Math.atan2(SIN_WRECK.x - meet.x, SIN_WRECK.z - meet.z));
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    sin.yaw = Math.atan2(meet.x - SIN_WRECK.x, meet.z - SIN_WRECK.z);
    sin.place(SIN_WRECK, sin.yaw);
    this.sin = sin;
    await this.sinClose(1.4);
    await this.sinSay('sinCell1', [['time', () => sin.anim.gesture('chin', 1, 0.4)]]);
    await this.halClose(1.0);
    await this.say('halCell1');
    await this.sinClose(1.2, -1);
    await this.sinSay('sinCell2', [['ship', 'present']]);
    // the wreck searched: three things to look at, a marker on the next
    let found = 0;
    const next = () => { const c = clues.find((k) => !k.done); powers.markerTarget = c ? { pos: c.mark, label: c.label } : null; };
    for (const c of clues) {
      site.interact({ position: c.at, radius: 2.2, look: c.mark, label: c.label, action: async () => {
        if (c.done) return;
        c.done = true;
        c.it.enabled = false;
        found++;
        this.takeControl();
        powers.markerTarget = null;
        player.lookAt(c.mark, 0.9);
        c.reveal?.();
        await this.say(c.line, { name: 'The ring' });
        player.lookAt(null);
        if (found < clues.length) { next(); this.giveControl(`Search the wreck (${found} of ${clues.length})`); }
      } });
      c.it = site.interactables.at(-1);
    }
    next();
    this.giveControl(`Search the wreck (0 of ${clues.length})`);
    await waitFor(() => found >= clues.length && !this.busy);
    powers.markerTarget = null;
    this.takeControl();
    // Sinestro names him
    if (player.position.distanceTo(meet) > 0.6) await player.walkTo(meet, player.walkSpeed);
    player.turnTo(Math.atan2(SIN_WRECK.x - meet.x, SIN_WRECK.z - meet.z));
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    await this.halClose(1.2);
    await this.say('halCell2');
    await this.sinClose(1.4);
    await this.sinSay('sinCell3', [['prisoner', 'present'], ['inversions', () => sin.anim.gesture('beat', 0.6, 0.5)]]);
    await this.halClose(0.9, -1);
    await this.say('halCell3');
    await this.sinClose(1.3, -1);
    await this.sinSay('sinCell4', [['machines', 'dismiss'], ['hated', () => sin.anim.gesture('chin', 1.2, 0.5)]]);
    await this.sinSay('sinCell5', [['killed', () => sin.anim.gesture('beat', 0.6, 0.7)]]);
    await this.halClose(1.0);
    await this.say('halCell4');
    this.ringGlow = 3;
    audio.ringChime();
    await this.say('ringTrail', { name: 'The ring' });
    player.lookAt(V(-200, 30, 40), 0.6);
    await this.sinClose(1.2);
    await this.sinSay('sinCell6', [['lead', 'present']]);
    await ui.fade(1, 1.4);
  }

  // Sinestro in a scene of Part Four (the Sinestro class, as Part Three drops him into Ferris).
  addSinestroAt(scene, blocks = []) {
    const { powers, player, audio, director } = this;
    const sin = new Sinestro({ scene: scene.scene, physics: scene.physics, powers, player, audio, director, mocap: this.mocap, abin: this.assets.characters.abin, ring: createRing(), attachRing: (r, rig) => this.attachRing(r, rig), blocks });
    scene.updaters.push((dt, t) => sin.update(dt, t));
    return sin;
  }

  // What's left at the wreck to find: the cell's hatch torn out of the hull and thrown on the
  // shore, the prisoner's blood still smouldering where he dragged himself off, and a word of
  // Ysmault's script cut into a stone. Each { at, mark, label, line, reveal }.
  wreckClues(site) {
    const s = site.scene, h = terrainHeight;
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f2c, metalness: 0.7, roughness: 0.45 });
    // the hatch: a heavy plate, its bars bent outward, lying where it landed
    const hatchAt = ABIN_SPOT.clone().addScaledVector(AX, 1.9).addScaledVector(OUT, 1.9);
    hatchAt.y = h(hatchAt.x, hatchAt.z) + 0.06;
    const hatch = new THREE.Group();
    hatch.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.5), metal));
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 16, Math.PI * (0.55 + i * 0.08)), metal);
      bar.position.set(-0.36 + i * 0.24, 0.05, 0);
      bar.rotation.set(0, Math.PI / 2, 0.3 + i * 0.1);
      hatch.add(bar);
    }
    hatch.position.copy(hatchAt);
    hatch.rotation.set(0.12, 0.7, -0.05);
    hatch.traverse((o) => (o.castShadow = true));
    s.add(hatch);
    // the opening it came out of: a dark hole in the hull's side, red-hot at its edges, found by a
    // ray onto the hull (its surface curves away from where Abin Sur sat)
    const ray = new THREE.Raycaster(ABIN_SPOT.clone().addScaledVector(AX, 1.4).addScaledVector(OUT, 2.5).setY(h(ABIN_SPOT.x, ABIN_SPOT.z) + 1.0), OUT.clone().negate(), 0, 5);
    site.ship.updateMatrixWorld(true);
    const hit = ray.intersectObject(site.ship, true)[0];
    const holeAt = hit ? hit.point.clone() : ABIN_SPOT.clone().addScaledVector(AX, 1.4).setY(1.0);
    const holeN = hit?.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : OUT.clone();
    const holeTex = splat(['rgba(0,0,0,1)', 'rgba(0,0,0,0.95)'], 'rgba(255,70,20,0.9)', true);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15), new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, emissive: 0xffffff, emissiveMap: holeTex.userData.glow, emissiveIntensity: 0.9, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    hole.position.copy(holeAt).addScaledVector(holeN, 0.02);
    hole.lookAt(hole.position.clone().add(holeN));
    s.add(hole);
    // the hull's skin round it peeled outward, as it would be torn from inside
    const petals = [], hot = new THREE.Color(0xff4a18);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + Math.random() * 0.25, w = 0.04 + Math.random() * 0.05;
      const rx = Math.cos(a) * 0.23, ry = Math.sin(a) * 0.31, len = 0.1 + Math.random() * 0.16;
      const tx = Math.cos(a) * (0.23 + len * 0.5), ty = Math.sin(a) * (0.31 + len * 0.5), tz = len * (0.8 + Math.random() * 0.5);
      const px = -Math.sin(a) * w, py = Math.cos(a) * w;
      petals.push(rx - px, ry - py, 0, rx + px, ry + py, 0, tx, ty, tz);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(petals, 3));
    pg.setAttribute('color', new THREE.Float32BufferAttribute(petals.map((_, j) => (Math.floor(j / 3) % 3 === 2 ? 0 : 0.5) * [hot.r, hot.g, hot.b][j % 3]), 3));
    pg.computeVertexNormals();
    const peel = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x23262a, metalness: 0.75, roughness: 0.4, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.0 }));
    peel.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvHot = color;').replace('void main() {', 'attribute vec3 color;\nvarying vec3 vHot;\nvoid main() {');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec3 vHot;\nvoid main() {').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = vHot * vHot * 0.35;');
    };
    peel.position.copy(hole.position);
    peel.quaternion.copy(hole.quaternion);
    s.add(peel);
    // the blood: a dark splash that still glows and smokes, a trail of drops toward the trees
    const blood = ARRIVAL.clone().add(V(6, 0, -4));
    const stainTex = splat(['rgba(40,4,2,0.95)', 'rgba(20,2,1,0.9)'], 'rgba(200,30,10,0.8)');
    const stainMat = new THREE.MeshStandardMaterial({ map: stainTex, emissive: 0xffffff, emissiveMap: stainTex.userData.glow, emissiveIntensity: 0.35, roughness: 0.5, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (let i = 0; i < 7; i++) {
      const p = blood.clone().add(V(-i * 1.3 + (Math.random() - 0.5) * 0.4, 0, i * 0.85 + (Math.random() - 0.5) * 0.4));
      const r = i === 0 ? 1.3 : 0.32 + Math.random() * 0.3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r).rotateX(-Math.PI / 2).rotateY(Math.random() * 6), stainMat);
      m.position.set(p.x, h(p.x, p.z) + 0.03, p.z);
      s.add(m);
    }
    blood.y = h(blood.x, blood.z);
    const smoke = new Particles(160, { additive: false, puffy: true, drag: 0.6, turbulence: 0.6 });
    s.add(smoke.points);
    site.updaters.push((dt, t) => {
      if (Math.random() < dt * 6) smoke.emit(1, (q, v) => { q[0] = blood.x + (Math.random() - 0.5) * 0.8; q[1] = blood.y + 0.05; q[2] = blood.z + (Math.random() - 0.5) * 0.8; v[0] = 0; v[1] = 0.25 + Math.random() * 0.2; v[2] = 0; }, { life: 3, size: [0.25, 1.1], color: [[0.12, 0.04, 0.03, 0.5], [0.1, 0.08, 0.08, 0]] });
      smoke.update(dt, t, this.engine.camera, this.engine.renderer);
      stainMat.emissiveIntensity = 0.3 + 0.12 * Math.sin(t * 2.3);
    });
    // the word, cut into a standing stone, glowing red
    const stoneAt = ARRIVAL.clone().add(V(-7, 0, -8.5)); // (in the open, clear of the truck)
    stoneAt.y = h(stoneAt.x, stoneAt.z);
    // (its face cut flat for the word: the facets would poke through it)
    const sg = new THREE.DodecahedronGeometry(1, 1).scale(0.9, 1.25, 0.5), sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.min(sp.getZ(i), 0.36));
    sg.computeVertexNormals();
    const stone = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x3e3b38, roughness: 0.95, flatShading: true }));
    stone.position.copy(stoneAt).y += 0.95;
    stone.rotation.y = 0.4;
    stone.castShadow = true;
    s.add(stone);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.font = `64px ${getComputedStyle(document.documentElement).getPropertyValue('--glyph-font') || 'serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3018'; g.shadowBlur = 14; g.fillStyle = '#ff5030';
    g.fillText(toGlyphs('RAGE'), 128, 66);
    const word = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: new THREE.Color(1.6, 0.6, 0.5) }));
    const face = V(Math.sin(0.4), 0, Math.cos(0.4));
    word.position.copy(stone.position).addScaledVector(face, 0.375).y += 0.15;
    word.lookAt(word.position.clone().add(face));
    s.add(word);
    const lamp = new THREE.PointLight(0xff3018, 1.2, 4, 2);
    lamp.position.copy(word.position).addScaledVector(face, 0.4);
    s.add(lamp);
    return [
      { at: holeAt.clone().addScaledVector(OUT, 1.4).setY(0), mark: holeAt.clone(), label: 'The cell', line: 'ringClueCell' },
      { at: blood.clone(), mark: blood.clone().setY(blood.y + 0.4), label: 'The blood', line: 'ringClueBlood' },
      { at: stoneAt.clone().addScaledVector(face, 1.6), mark: word.position.clone(), label: 'The stone', line: 'ringClueGlyph' },
    ];
  }

  // ---------------------------------------------------------------- 3. Atrocitus
  // 11:58 PM, downtown: a tower going up, its lot floodlit, Atrocitus at the machine he's built in the
  // middle of it. The fight, beside Sinestro; at 60% he puts his hands on the machine and both rings
  // go dark (and Hal's suit with his); the lantern out of the pocket dimension and the oath bring the
  // light back; he's driving the excavator's bucket down on Sinestro with his blood; the hammer.
  // Sinestro binds him, and the machine is gone.
  async atrocitus() {
    const { ui, director, audio, player, powers, hud } = this;
    this.lanternUp();
    await loadProps(SITE_PROPS);
    const site = this.setupSite();
    this.enterSite(SITE_IN.clone().add(V(0, 0, 30)), Math.PI);
    ui.clock(this.save.info('site').clock);
    const atro = this.addAtrocitus(site);
    atro.place(DEVICE.clone().add(V(0, 0, -2.1)), 0);
    const touch = (on) => { const o = new THREE.Vector3(); atro.anim.reach('R', on ? () => o.copy(DEVICE).setY(1.25).add(V(0.25, 0, -0.55)) : null, { pole: V(-1, -0.4, 0), rate: 4 }); };
    touch(true);
    site.deviceU.uPulse.value = 0.45;
    const sin = (this.sin = this.addSinestroAt(site, site.blocks));
    sin.place(SITE_IN.clone().add(V(2.4, 0, 0.8)), Math.PI);
    // in over the street from the south, the lot lit up below
    await this.arriveFlying(V(8, 62, 70), Math.PI, V(-0.5, -6, -11)); // (over the roofs across the street)
    await ui.fade(0, 0.8);
    this.bark('halSite1');
    powers.markerTarget = { pos: SITE_IN.clone().setY(1.5), label: 'Sinestro' };
    this.giveControl('Land in the lot beside Sinestro');
    await waitFor(() => !player.flying && player.position.distanceTo(SITE_IN) < 9);
    powers.markerTarget = null;
    this.takeControl();
    if (player.position.distanceTo(SITE_IN) > 0.6) await player.walkTo(SITE_IN, player.walkSpeed);
    const toward = Math.atan2(atro.position.x - SITE_IN.x, atro.position.z - SITE_IN.z);
    player.turnTo(toward);
    player.lookAt(() => atro.rig.face?.(_h) ?? atro.rig.bonePosition('head', _h), 0.6);
    sin.yaw = toward; sin.place(sin.position, toward);
    // he takes his hand off the machine and comes round it toward them
    touch(false);
    director.move(DEVICE.clone().add(V(2.4, 2.0, 9.5)), DEVICE.clone().add(V(-2.4, 1.4, 2.4)), 2.2, ease.inOut, 40);
    const line = this.sayAs(atro.rig, 'atroSite1');
    await this.atroWalk(DEVICE.clone().add(V(-2.9, 0, 2.2)), 1.6);
    await this.atroWalk(DEVICE.clone().add(V(-2.2, 0, 5.4)), 1.6);
    atro.faceYaw = Math.atan2(SITE_IN.x - atro.position.x, SITE_IN.z - atro.position.z);
    await line;
    await this.atroClose(1.2, -1);
    await this.sayAs(atro.rig, 'atroSite2');
    await this.sinClose(1.2);
    await this.sinSay('sinSite1', [['arrest', 'present']]);
    await this.atroClose(1.0);
    atro.roar(1);
    director.shake(0.25, 0.6);
    await this.sayAs(atro.rig, 'atroSite3');
    // the fight
    this.director.mode = 'follow';
    player.lookAt(null);
    await this.atroFight(atro, sin, 0.6);
    // his machine: both rings go out
    await this.drainRings(atro, sin, site);
    // the lantern, the oath, the light back (Hal does this: L, then E at the lantern)
    this.giveControl('Call the lantern out of the pocket dimension (L)');
    await waitFor(() => !this.lanternStowed && !this.lanternMoving);
    this.giveControl('Recharge the ring at the lantern (E)');
    await waitFor(() => this.recharged);
    // the excavator over Sinestro; the hammer
    await this.excavatorBeat(atro, sin, site);
    await this.bindAtrocitus(atro, sin, site);
    hud.boss(null);
  }

  // The night site downtown, built once.
  setupSite() {
    if (this.siteScene) return this.siteScene;
    this.siteScene = new Site({ engine: this.engine }).build();
    return this.siteScene;
  }

  enterSite(at, yaw) {
    const { player, audio, powers } = this, s = this.siteScene;
    this.show(s);
    this.playerActive = true;
    player.spawn(s.physics, s.scene, at, yaw);
    player.ground = () => 0;
    player.surface = 'gravel';
    player.camDist = 2.8;
    powers.attach({ scene: s.scene, physics: s.physics, ...s.airBounds() });
    powers.regen = 0;
    this.lanternSpots(s);
    this.world = 'earth';
    this.ambience(audio.traffic(0.02), audio.wind(0.05), audio.pad([55, 82.4, 110], 0.03, { cutoff: 300 }));
  }

  addAtrocitus(site) {
    if (this.atro) return this.atro;
    const { powers, player, audio, director, engine } = this;
    const atro = (this.atro = new Atrocitus({ scene: site.scene, physics: site.physics, powers, player, audio, director, engine, mocap: this.mocap, characters: this.assets.characters, ground: () => 0, center: ARENA.center, radius: ARENA.radius, blocks: site.blocks, loose: site.loose }));
    site.updaters.push((dt, t) => atro.update(dt, t));
    return atro;
  }

  // Atrocitus walks to a point (his gait from his speed, facing the way he goes).
  async atroWalk(to, speed = 1.8) {
    const a = this.atro, t0 = this.engine.time, d = new THREE.Vector3(); // (its own vector: _h is a look-at's)
    a.faceYaw = null;
    const steer = onFrame(() => { d.subVectors(to, a.position).setY(0); a.vel.copy(d).setLength(Math.min(speed, d.length() * 3)); });
    await waitFor(() => d.subVectors(to, a.position).setY(0).length() < 0.12 || this.engine.time - t0 > 12);
    steer();
    a.vel.set(0, 0, 0);
  }

  // a close shot of Atrocitus from his front, a little to one side, low (he's big)
  atroClose(duration = 1.4, side = 1) {
    const a = this.atro, h = a.rig.face?.(V(0, 0, 0)) ?? a.rig.bonePosition('head', V(0, 0, 0));
    const f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 2.9).addScaledVector(r, 1.0 * side).add(V(0, -0.45, 0)), h.clone().add(V(0, -0.15, 0)), duration, ease.inOut, 36);
  }

  mouthOf(who) {
    if (this.speakingRig) return this.speakingRig;
    if (who === 'atrocitus') return this.atro?.rig;
    if (who === 'sinestro') return this.sin?.rig;
    return super.mouthOf(who);
  }

  // The fight, until Atrocitus is down to `until` of his health: Sinestro beside Hal, the boss bar,
  // their lines when something happens.
  async atroFight(atro, sin, until) {
    const { powers, hud } = this;
    const foe = { position: atro.position, vel: atro.vel, collider: atro.col, hit: (a, p) => powers.dealDamage(atro.tg, a, p, null) };
    sin.ally(foe);
    atro.engage();
    let last = -10, lines = 0;
    const quip = (key, gap = 7) => {
      const now = this.engine.time;
      if (now - last < gap || this.quipping) return;
      last = now;
      this.quipping = true;
      this.bark(key).finally(() => (this.quipping = false));
    };
    atro.onQuip = (k) => {
      if (k === 'stunned') quip('sinQStun', 4);
      else if (k === 'hurt' && Math.random() < 0.4) quip(['atroQ1', 'atroQ2'][lines++ % 2]);
      else if (k === 'charge' && Math.random() < 0.3) quip('atroQ3');
    };
    atro.onHurtHal = (k) => { if (k === 'charge' && Math.random() < 0.5) quip('sinQWall', 10); };
    const bar = onFrame(() => hud.boss('ATROCITUS', atro.health, until));
    this.giveControl('Fight Atrocitus beside Sinestro');
    wait(7).then(() => quip('sinQSite', 0));
    await waitFor(() => atro.health <= until);
    atro.onQuip = atro.onHurtHal = null;
    bar();
    hud.boss('ATROCITUS', atro.health, until);
  }

  // He breaks off and puts both hands on his machine: a red pulse goes out through the lot and both
  // rings go dark. Hal's suit goes with the light; Sinestro, older at this, has a little left to
  // hold him with.
  async drainRings(atro, sin, site) {
    const { ui, director, audio, player, powers } = this;
    this.takeControl();
    powers.holster();
    atro.disengage();
    sin.disengage();
    if (player.flying) player.stopFlying(true);
    // he backs to the machine
    // (round to the machine's far side, where he faces Hal across it)
    const at = DEVICE.clone().add(V(0, 0, -2.1)), round = DEVICE.clone().add(V(Math.sign(atro.position.x - DEVICE.x || 1) * 2.8, 0, -1.2));
    director.move(DEVICE.clone().add(V(5.5, 2.2, 6.5)), DEVICE.clone().add(V(0, 1.4, 0)), 1.4, ease.inOut, 40);
    atro.anim.lookAt(null);
    if (atro.position.z > DEVICE.z - 1) await this.atroWalk(round, 3);
    await this.atroWalk(at, 2.4);
    atro.faceYaw = 0;
    await wait(0.4);
    const R = (x, y, z) => { const o = new THREE.Vector3(); return () => o.copy(DEVICE).add(V(x, y, z)); };
    atro.anim.reach('R', R(0.35, 1.3, -0.5), { pole: V(-1, -0.4, 0), rate: 6 });
    atro.anim.reach('L', R(-0.35, 1.3, -0.5), { pole: V(1, -0.4, 0), rate: 6 });
    await wait(0.4);
    await this.atroClose(1.0, 2.6); // (wide of the machine, which is in front of him)
    const line = this.sayAs(atro.rig, 'atroDrain');
    await tween(1.6, (k) => (site.deviceU.uPulse.value = 0.45 + 0.55 * k));
    await line;
    // the pulse: a red wave out through the lot; the ring's light drained out of it
    director.move(player.position.clone().add(V(-2.4, 1.7, 3)), player.position.clone().add(V(0, 1.3, 0)), 0.8, ease.out, 44);
    const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.12, 0.06), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    wave.position.copy(DEVICE).y += 1.3;
    site.scene.add(wave);
    audio.psychic(1.2);
    audio.explosion(0.4);
    director.shake(0.4, 0.8);
    this.hud.ringhud.classList.add('force');
    const c0 = powers.charge;
    audio.tone({ type: 'sine', freq: 880, to: 110, attack: 0.02, peak: 0.08, dur: 2.4, wet: 0.6 });
    tween(1.4, (k) => { wave.scale.setScalar(1 + k * 40); wave.material.opacity = 0.5 * (1 - k); }).then(() => wave.removeFromParent());
    await tween(2.2, (k) => { powers.setCharge(c0 * (1 - ease.in(k))); this.ringGlow = 1 - k; }, ease.linear);
    powers.setCharge(0);
    this.ringSay('ringDrained');
    // the suit was the ring's light: it goes
    await this.suitOff(1.6);
    Object.assign(powers.enabled, { constructs: false, flight: false });
    this.drained = true;
    this.recharged = false;
    this.hud.ringhud.classList.remove('force');
    // Sinestro, his ring guttering, wraps a chain of what light he has round Atrocitus
    sin.place(DEVICE.clone().add(V(4.2, 0, 3.4)), Math.atan2(-4.2, -3.4));
    const chain = (this.atroChain = this.bindings(atro, site, 0.45));
    atro.anim.reach('R', null, { rate: 3 });
    atro.anim.reach('L', null, { rate: 3 });
    atro.anim.armSpread = 0.35;
    sin.anim.reach('R', () => this.atro.tg.position, { pole: V(-0.6, -0.7, -0.3), rate: 6 });
    await this.sinClose(1.2);
    await this.sinSay('sinDrain1');
    await this.sinSay('sinDrain2');
    void chain;
    director.mode = 'follow';
    this.lanternReady = true;
  }

  // Lantern bands round him (Sinestro's construct): rings at his chest and arms, flickering at
  // `strength` (low while Sinestro's ring is nearly out).
  bindings(atro, site, strength = 1) {
    const g = new THREE.Group(), bands = [];
    for (const [y, r] of [[1.75, 0.72], [1.45, 0.78], [1.15, 0.7]]) {
      const m = constructMesh(new THREE.TorusGeometry(r, 0.06, 8, 40).rotateX(Math.PI / 2), { uPattern: 0, outline: 0.012 });
      m.position.y = y;
      m.userData.set('uForm', 0);
      g.add(m);
      bands.push(m);
    }
    site.scene.add(g);
    const stop = onFrame((dt) => {
      g.position.copy(atro.position);
      g.rotation.y = atro.yaw;
      const flick = strength < 1 ? 0.55 + 0.45 * Math.sin(this.engine.time * 23) * Math.sin(this.engine.time * 7) : 1;
      for (const b of bands) { b.userData.set('uTime', this.engine.time); b.userData.set('uForm', Math.min(strength * flick, (b.userData.u.uForm.value ?? 0) + dt * 2)); }
    });
    return { group: g, bands, remove: () => { stop(); g.removeFromParent(); } };
  }

  // The suit dissolving back into his clothes (the ring's light gone), as Corps.backThroughWindow does it.
  async suitOff(dur = 1.6) {
    const { player, audio } = this, hal = this.hal, suit = this.suit;
    player.mount(hal);
    player.animator.addRig(hal);
    hal.u.uDissolveOn.value = 1; hal.u.uDissolveSign.value = -1;
    suit.u.uDissolveOn.value = 1; suit.u.uDissolveSign.value = 1;
    audio.dissolve();
    await tween(dur, (k) => { hal.u.uDissolve.value = -0.1 + k * 1.25; suit.u.uDissolve.value = -0.1 + k * 1.25; }, ease.inOut);
    hal.u.uDissolveOn.value = 0;
    suit.u.uDissolveOn.value = 0;
    suit.u.uDissolve.value = 0;
    this.ring.removeFromParent();
    player.setRig(hal);
    this.attachRing(this.ring, hal);
    this.powers.ring = this.ring;
    this.powers.suited = false;
    player.speedScale = 1;
  }

  // At the lantern with an empty ring, the whole oath: each line a quarter of the charge, then the
  // suit back. (Otherwise the ordinary recharge.)
  async recharge() {
    if (!this.drained) return super.recharge();
    const { player, powers, audio, director } = this, lantern = this.lantern, spot = this.lanternSpot.clone();
    this.takeControl();
    const yaw = Math.atan2(spot.x - player.position.x, spot.z - player.position.z);
    player.turnTo(yaw);
    player.lookAt(spot.clone().add(V(0, 0.3, 0)), 1);
    const shoulder = new THREE.Vector3(), rig = player.rig;
    player.animator.reach('R', () => { rig.bonePosition('upperArm_R', shoulder); return shoulder.add(spot.clone().add(V(0, 0.5, 0)).sub(shoulder).normalize().multiplyScalar(0.62)); }, { pole: V(-0.4, -0.85, -0.3) });
    const c = player.position.clone(), toHal = c.clone().sub(spot).setY(0).normalize(), across = V(toHal.z, 0, -toHal.x);
    const cam = (back, side, up) => spot.clone().addScaledVector(toHal, -back).addScaledVector(across, side).setY(spot.y + up);
    director.cut(cam(1.3, 0.9, 0.5), c.clone().add(V(0, 1.4, 0)), 42);
    director.move(cam(0.7, 0.75, 0.62), c.clone().add(V(0, 1.5, 0)), 11, ease.inOut, 36);
    await wait(0.6);
    const beam = createShaft({ from: spot.clone().add(V(0, 0.25, 0)), to: this.ring.getWorldPosition(new THREE.Vector3()), radiusFrom: 0.04, radiusTo: 0.07, color: new THREE.Color(0.5, 2.5, 1.0) });
    this.current.scene.add(beam);
    this.hud.ringhud.classList.add('force');
    audio.riser(9, 0.4);
    for (let i = 0; i < 4; i++) {
      const from = powers.charge, to = 25 * (i + 1);
      audio.tone({ freq: [293.7, 370, 440, 587.3][i], peak: 0.06, dur: 2.4, wet: 0.7 });
      const fill = tween(2.2, (k) => {
        powers.setCharge(from + (to - from) * k);
        const glow = (i + k) / 4;
        lantern.userData.light.intensity = 1.2 + glow * 12;
        beam.userData.uniforms.uOpacity.value = 1.5 + glow * 2;
        this.ringGlow = 1 + glow * 5;
      });
      await this.say(`oath${i + 1}`, { hold: i === 3 ? 0.8 : 0.25, name: i === 3 ? 'Hal Jordan' : undefined });
      await fill;
    }
    beam.removeFromParent();
    audio.ringChime();
    this.ringSay('ringFull');
    await this.suitUp(1.6);
    this.hud.ringhud.classList.remove('force');
    player.animator.reach('R', null);
    player.lookAt(null);
    Object.assign(powers.enabled, { hud: true, constructs: true, flight: true });
    this.drained = false;
    this.recharged = true;
  }

  // While Hal said the oath, Atrocitus tore free and threw Sinestro down in front of the excavator;
  // now his blood drives it, the bucket coming down on him. The ring gives Hal the hammer.
  async excavatorBeat(atro, sin, site) {
    const { ui, director, audio, player, powers } = this, D = site.digger;
    this.takeControl();
    this.atroChain?.remove();
    atro.anim.armSpread = 0;
    sin.anim.reach('R', null, { rate: 4 });
    // Sinestro on the ground in front of the bucket; Atrocitus at the machine's side, glaring down
    // the arm at him, his left hand flat on its house (his blood driving it)
    const ex = EXCAVATOR.at, fwd = V(Math.sin(EXCAVATOR.yaw), 0, Math.cos(EXCAVATOR.yaw)), right = V(fwd.z, 0, -fwd.x);
    const down = ex.clone().addScaledVector(fwd, 6.8);
    sin.place(down, EXCAVATOR.yaw + Math.PI);
    sin.anim.play(still(POSES.kneel, 1.2), 0.3);
    if (D.block) D.block.r = 0; // (he stands against it)
    atro.place(ex.clone().addScaledVector(right, 2.5).addScaledVector(fwd, 1.0), EXCAVATOR.yaw);
    atro.faceYaw = EXCAVATOR.yaw;
    const handOn = new THREE.Vector3();
    atro.anim.reach('L', () => handOn.copy(ex).addScaledVector(right, 1.45).addScaledVector(fwd, 0.9).setY(1.8), { pole: V(1, -0.4, 0), rate: 5 });
    atro.anim.lookAt(() => sin.rig.bonePosition('head', _p), 0.6);
    // his blood in the machine: a red glow from inside it, the bucket raised high over Sinestro
    const red = this.bleedInto(D, site);
    const arm = this.diggerArm(D);
    arm.set(1);
    const motor = audio.engine(0.14);
    motor.set(0.6);
    director.cut(down.clone().addScaledVector(fwd, 5).addScaledVector(right, 6.5).setY(1.7), ex.clone().addScaledVector(fwd, 3.2).addScaledVector(right, 0.8).setY(2.6), 42);
    await wait(0.3);
    await this.say('halExcavator');
    const ah = atro.rig.bonePosition('head', V(0, 0, 0));
    director.move(ah.clone().addScaledVector(fwd, 2.4).addScaledVector(right, 1.3).add(V(0, -0.35, 0)), ah.clone().add(V(0, -0.1, 0)), 1.0, ease.inOut, 36);
    await this.sayAs(atro.rig, 'atroExcavator');
    // the hammer
    this.learn('hammer', false);
    audio.ringChime();
    this.ringSay('ringHammer');
    powers.choose(CONSTRUCTS.findIndex((c) => c.id === 'hammer'));
    // the machine as something to hit: three blows and it comes apart
    const tg = { body: null, collider: null, position: ex.clone().setY(2.2), radius: 2.6, health: 300, maxHealth: 300, alive: true };
    const parts = this.diggerBodies(D, site); // its colliders, for the hammer to find
    tg.body = parts.body;
    tg.collider = parts.collider;
    let broken = false, blows = 0;
    tg.hit = (amount, point) => {
      if (broken) return 0;
      tg.health = Math.max(0, tg.health - amount);
      if (amount >= 60 || tg.health < tg.maxHealth * (1 - (blows + 1) / 3)) { blows++; this.knockLoose(D, site, blows, point); }
      if (tg.health <= 0) { broken = true; tg.alive = false; }
      return amount;
    };
    powers.addTarget(tg);
    const bar = onFrame(() => this.hud.boss('THE EXCAVATOR', tg.health / tg.maxHealth, 0));
    player.lookAt(null);
    director.mode = 'follow';
    const face = Math.atan2(ex.x - player.position.x, ex.z - player.position.z);
    player.turnTo(face);
    player.camYaw = face + Math.PI;
    player.camPitch = 0.12;
    this.giveControl('Smash the excavator before the bucket comes down');
    // the bucket comes down over 24 s
    let k = 0;
    const lower = onFrame((dt) => { if (!broken) { k = Math.min(1, k + dt / 24); arm.set(1 - k); motor.set(0.5 + 0.4 * Math.sin(this.engine.time * 3)); } });
    await waitFor(() => broken || k >= 1);
    lower();
    bar();
    powers.removeTarget(tg);
    this.hud.boss(null);
    if (!broken) {
      motor.stop();
      this.takeControl();
      await ui.fade(1, 0.8);
      await ui.screen({ kicker: 'Sinestro is down', title: 'TOO LATE', body: 'The bucket came down. Hit the machine with the hammer, three blows, before it does.', buttons: ['Restart checkpoint'] });
      this.save.resumeAfterReload(this.checkpointId);
      await new Promise(() => {});
    }
    // it comes apart; Atrocitus thrown clear
    this.takeControl();
    motor.stop(0.3);
    red.stop();
    atro.anim.reach('L', null, { rate: 6 });
    atro.anim.lookAt(() => player.rig.bonePosition('head', _p), 0.5);
    // wide, from the south-east: the machine flying apart, Atrocitus thrown off its side
    director.cut(ex.clone().addScaledVector(right, 15).addScaledVector(fwd, -3).setY(3.2), ex.clone().addScaledVector(fwd, 1.5).setY(1.6), 50);
    this.breakDigger(D, site);
    audio.explosion(0.8);
    director.shake(0.9, 0.8);
    atro.anim.reach('R', null, { rate: 6 });
    const from = atro.position.clone(), to = from.clone().addScaledVector(right, 4.5);
    await tween(0.7, (q) => { atro.position.lerpVectors(from, to, q); atro.position.y = Math.sin(q * Math.PI) * 1.4; }, ease.out);
    atro.place(to, atro.yaw);
    atro.anim.play(still(POSES.kneel, 1.6), 0.3);
    await wait(1.0);
    director.move(to.clone().addScaledVector(right, 5).addScaledVector(fwd, 3).setY(1.8), to.clone().setY(1.1), 1.4, ease.inOut, 42);
    await wait(1.2);
  }

  // Red light from inside the excavator: his blood driving it (a pulse in its paint, after its own
  // texture, and a red light in its house).
  bleedInto(D, site) {
    const mats = new Set();
    D.root.traverse((o) => { if (o.isMesh) mats.add(o.material); });
    for (const m of mats) { m.userData.em = [m.emissive.clone(), m.emissiveMap, m.emissiveIntensity]; m.emissive.setRGB(1, 0.12, 0.05); m.emissiveMap = m.map; m.emissiveIntensity = 0; m.needsUpdate = true; }
    const light = new THREE.PointLight(0xff2412, 0, 9, 2);
    light.position.copy(EXCAVATOR.at).setY(2.2);
    site.scene.add(light);
    const stop = onFrame(() => { const v = 0.5 + 0.5 * Math.sin(this.engine.time * 5); for (const m of mats) m.emissiveIntensity = 0.03 + 0.03 * v; light.intensity = 3 + 5 * v; });
    return { stop: () => { stop(); light.removeFromParent(); for (const m of mats) { [m.emissive, m.emissiveMap, m.emissiveIntensity] = [m.userData.em[0], m.userData.em[1], m.userData.em[2]]; m.needsUpdate = true; } } };
  }

  // The excavator's arm from raised (1) to the bucket on the ground in front of it (0): the boom, the
  // stick and the bucket each turned about its own pivot.
  diggerArm(D) {
    const turn = (node, a) => { if (!node) return; node.quaternion.copy(node.userData.rest).multiply(_q.setFromAxisAngle(_X, a)); };
    // (measured on the model: +X lifts each part; at 0 the bucket rests on the ground 6.5 m out)
    const L = (a, b, k) => a + (b - a) * k;
    return { set: (k) => { turn(D.boom, L(-0.2, 0.35, k)); turn(D.stick, L(0.45, 0.25, k)); turn(D.bucket, L(-0.1, 0.5, k)); } };
  }

  // A collider over the whole machine for the ring to find (its tracks' box from the scene).
  diggerBodies(D, site) {
    const p = D.root.position, body = site.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, 2.4, p.z));
    const collider = site.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1.8, 2.2, 2.6), body);
    site.physics.dynamics.push({ body, mesh: new THREE.Object3D() }); // (the ring's impacts look for targets there)
    D.hitBody = body;
    return { body, collider };
  }

  // Each blow knocks something off it: the bucket's thumb, then the stick's pipes and the cab's
  // glass (sparks, a lurch); the last blow takes it all apart (breakDigger).
  knockLoose(D, site, n, at) {
    const { powers } = this;
    powers.sparks.emit(80, (q, v) => { q[0] = at.x; q[1] = at.y; q[2] = at.z; v[0] = (Math.random() - 0.5) * 8; v[1] = Math.random() * 6; v[2] = (Math.random() - 0.5) * 8; }, { life: 0.8, size: [0.07, 0], color: [[3, 2.2, 1.2, 1], [0.6, 0.3, 0.1, 0]] });
    this.audio.clash?.();
    tween(0.4, (k) => (D.root.rotation.z = Math.sin(k * Math.PI * 3) * 0.04 * (1 - k)));
    if (n === 1) this.detachPart(D, site, /^claw_GEO$/, V(0, 4, 6));
    if (n === 2) { this.detachPart(D, site, /^shovel_GEO$/, V(2, 5, 4)); }
  }

  // One part of the excavator as a loose physics body, flung.
  detachPart(D, site, re, vel) {
    let node = null;
    D.root.traverse((o) => { if (!node && re.test(o.name)) node = o; });
    if (!node || node.userData.loose) return null;
    node.userData.loose = true;
    site.scene.attach(node);
    const b = boundsIn(node, meshes(node, () => true)), c = b.getCenter(V(0, 0, 0)), h = b.getSize(V(0, 0, 0)).multiplyScalar(0.5).multiply(node.scale);
    c.multiply(node.scale);
    const desc = RAPIER.ColliderDesc.cuboid(Math.max(0.05, h.x), Math.max(0.05, h.y), Math.max(0.05, h.z)).setTranslation(c.x, c.y, c.z);
    const body = site.physics.dynamic(node, desc, { density: 3, damping: 0.1, angularDamping: 0.3, restitution: 0.1 });
    const w = vel.clone().applyAxisAngle(_Y, D.root.rotation.y);
    body.setLinvel({ x: w.x, y: w.y, z: w.z }, true);
    body.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true);
    return body;
  }

  // The last blow: the arm off its house, the house off its tracks.
  breakDigger(D, site) {
    if (D.hitBody) { site.physics.dynamics = site.physics.dynamics.filter((d) => d.body !== D.hitBody); site.physics.world.removeRigidBody(D.hitBody); D.hitBody = null; }
    if (D.box) { site.physics.world.removeRigidBody(D.box); D.box = null; }
    this.detachPart(D, site, /^shovel_GEO$/, V(1, 6, 7));
    this.detachPart(D, site, /^Arm_2_GEO$/, V(-2, 7, 6));
    this.detachPart(D, site, /^arm_01_GEO1$/, V(0, 6, 4));
    this.detachPart(D, site, /^Body_GEO$/, V(0, 4, -3));
    this.detachPart(D, site, /^Tread_GEO$/, V(0, 1, -2));
    this.powers.dustFx(EXCAVATOR.at, 60, 5);
    this.powers.physics.burst(EXCAVATOR.at, 6, 8, 3, 0.5);
  }

  // Sinestro up and over him, the bands of light round him tight now; their lines; the machine gone.
  async bindAtrocitus(atro, sin, site) {
    const { ui, director, player } = this;
    sin.anim.play(sin.standGen, 0.5);
    const at = atro.position.clone().add(V(Math.sin(atro.yaw) * 2.8, 0, Math.cos(atro.yaw) * 2.8));
    sin.place(at, atro.yaw + Math.PI);
    this.bindings(atro, site, 1);
    this.audio.constructForm(1);
    sin.anim.reach('R', () => this.atro.tg.position, { pole: V(-0.6, -0.7, -0.3), rate: 6 });
    // Hal comes over
    const stand = atro.position.clone().add(V(Math.sin(atro.yaw + 0.9) * 3.6, 0, Math.cos(atro.yaw + 0.9) * 3.6));
    player.place(stand, Math.atan2(atro.position.x - stand.x, atro.position.z - stand.z));
    player.lookAt(() => atro.rig.bonePosition('head', _h), 0.6);
    await this.sinClose(1.4);
    await this.sinSay('sinBind1');
    await this.atroClose(1.2);
    await this.sayAs(atro.rig, 'atroBind1');
    sin.anim.reach('R', null, { rate: 4 });
    await this.sinClose(1.0, -1);
    await this.sinSay('sinBind2', [['Ysmault', 'present']]);
    await this.halClose(1.0);
    await this.say('halBind1');
    await this.sinClose(1.0);
    await this.sinSay('sinBind3');
    // and his machine: gone from the middle of the lot, a ring of script burning out
    site.removeDevice();
    player.lookAt(DEVICE.clone().setY(0.5), 0.7);
    player.turnTo(Math.atan2(DEVICE.x - player.position.x, DEVICE.z - player.position.z));
    director.move(player.position.clone().add(V(0.8, 1.9, 0)).lerp(DEVICE, -0.25), DEVICE.clone().setY(0.2), 2.4, ease.inOut, 40);
    await wait(1.2);
    await this.say('halDevice', { hold: 1.2 });
    await ui.fade(1, 1.6);
  }
  // ---------------------------------------------------------------- 4. Ysmault
  // Sector 666: the dead world where the Inversions were chained. Sinestro has brought Atrocitus
  // back to his obelisk; in his chains he prophesies the Blackest Night, and Sinestro's own future.
  async ysmault() {
    const { ui, director, audio, player, powers } = this;
    this.lanternUp();
    await loadProps(YSMAULT_PROPS);
    ui.clock(this.save.info('ysmault').clock);
    await voyage(this, { from: 'earth', to: 'ysmault', launch: false });
    this.save.update((d) => (d.worlds = [...new Set([...(d.worlds ?? []), 'ysmault'])]));
    const ys = this.setupYsmault();
    this.enterYsmault(LANDING.clone().add(V(0, 0, 18)), Math.PI);
    const atro = this.chainAtrocitus(ys);
    const sin = (this.sin = this.addSinestroAt(ys));
    const sinAt = STAKE.clone().add(V(-2.6, 0, 6.2));
    sin.place(sinAt, Math.atan2(STAKE.x - sinAt.x, STAKE.z - sinAt.z));
    await this.arriveFlying(V(4, 26, 34), Math.PI, V(-0.5, -5, -9));
    this.ringSay('ringYsmault');
    powers.markerTarget = { pos: LANDING.clone().setY(1.5), label: 'Sinestro' };
    this.giveControl('Land in the ring of obelisks');
    await waitFor(() => !player.flying && player.position.distanceTo(LANDING) < 8);
    powers.markerTarget = null;
    this.takeControl();
    if (player.position.distanceTo(LANDING) > 0.6) await player.walkTo(LANDING, player.walkSpeed);
    player.turnTo(Math.atan2(STAKE.x - LANDING.x, STAKE.z - LANDING.z));
    const head = () => atro.rig.bonePosition('head', _h);
    player.lookAt(head, 0.6);
    // the basin from behind Hal: the ring, Atrocitus in his chains, the red sun over the buttes
    director.cut(LANDING.clone().add(V(2.2, 2.2, 4.5)), STAKE.clone().add(V(0, 2.4, 0)), 46);
    director.move(LANDING.clone().add(V(1.6, 2.0, 3.4)), STAKE.clone().add(V(0, 2.2, 0)), 4, ease.inOut, 42);
    await wait(1.2);
    sin.yaw = Math.atan2(LANDING.x - sinAt.x, LANDING.z - sinAt.z);
    sin.place(sinAt, sin.yaw);
    await this.sinClose(1.4, -1); // (from the side away from the sun)
    await this.sinSay('sinYs1', [['chained', 'present']]);
    await this.atroChainedClose(atro, 1.4);
    await this.sayAs(atro.rig, 'atroYs1');
    await this.atroChainedClose(atro, 2.4, -0.6, 30);
    audio.psychic(0.5);
    await this.sayAs(atro.rig, 'atroYs2');
    await this.halClose(1.0);
    await this.say('halYs1');
    // to Sinestro now
    atro.anim.lookAt(() => sin.rig.bonePosition('head', _p), 0.6);
    await this.atroChainedClose(atro, 1.2, 0.8);
    await this.sayAs(atro.rig, 'atroYs3');
    await this.sinClose(0.9);
    sin.anim.gesture('chin', 1.1, 0.5);
    await this.sinSay('sinYs2');
    // Sinestro's ring at Atrocitus: a gag of light over his jaw, and he's silent
    const gag = constructMesh(new THREE.TorusGeometry(0.2, 0.035, 8, 32).scale(1.25, 1, 1.4), { uPattern: 0, outline: 0.01 });
    gag.userData.set('uForm', 0);
    ys.scene.add(gag);
    const stopGag = onFrame(() => { atro.rig.bonePosition('head', gag.position); gag.position.y -= 0.08; gag.rotation.set(Math.PI / 2, 0, atro.yaw); gag.userData.set('uTime', this.engine.time); gag.userData.set('uForm', Math.min(1, gag.userData.u.uForm.value + 0.05)); });
    audio.constructForm(0.8);
    await wait(1.0);
    sin.yaw = Math.atan2(player.position.x - sinAt.x, player.position.z - sinAt.z);
    sin.place(sinAt, sin.yaw);
    await this.sinClose(1.2, -1);
    await this.sinSay('sinYs3', [['Oa', 'present']]);
    player.lookAt(null);
    // up and away: Sinestro first, then Hal
    audio.whoosh(1.0, 0.7);
    const s0 = sin.object.position.clone();
    director.move(LANDING.clone().add(V(-4, 1.6, 4)), sinAt.clone().add(V(0, 4, 0)), 1.2, ease.inOut, 50);
    await tween(1.1, (k) => sin.object.position.copy(s0).add(V(0, 60 * k * k, 0)), ease.linear);
    sin.object.visible = false;
    stopGag();
    await voyage(this, { from: 'ysmault', to: 'oa' });
  }

  setupYsmault() {
    if (this.ysScene) return this.ysScene;
    this.ysScene = new Ysmault({ engine: this.engine }).build();
    return this.ysScene;
  }

  enterYsmault(at, yaw) {
    const { player, audio, powers } = this, ys = this.ysScene;
    this.world = 'ysmault';
    this.show(ys);
    this.playerActive = true;
    player.spawn(ys.physics, ys.scene, at, yaw);
    player.ground = () => 0;
    player.surface = 'gravel';
    player.camDist = 3;
    powers.attach({ scene: ys.scene, physics: ys.physics, ...ys.airBounds() });
    powers.regen = 0;
    this.ambience(audio.wind(0.09), audio.pad([41.2, 61.7, 82.4], 0.04, { cutoff: 260 }));
  }

  // Atrocitus on his knees at his obelisk, arms pulled up and out by the chains (his rig only:
  // there's no fight here).
  chainAtrocitus(ys) {
    const rig = createAtrocitus(this.assets.characters.atrocitus), anim = new Animator(rig);
    const yaw = Math.atan2(-STAKE.x, -STAKE.z); // facing the middle
    rig.root.position.copy(STAKE).add(V(Math.sin(yaw) * 1.7, 0, Math.cos(yaw) * 1.7));
    rig.root.rotation.y = yaw;
    ys.scene.add(rig.root);
    anim.play(still(POSES.kneel, 1.6), 0);
    anim.look.maxYaw = 0.6;
    anim.lookAt(() => this.player.rig.bonePosition('head', _p), 0.55);
    const wrist = (side) => { const o = new THREE.Vector3(); return () => o.copy(STAKE).add(V(side * 0.9, 2.5, 0).applyAxisAngle(_Y, yaw)).addScaledVector(V(Math.sin(yaw), 0, Math.cos(yaw)), 1.2); };
    anim.reach('L', wrist(1), { pole: V(1, 0.2, -0.4), rate: 20 });
    anim.reach('R', wrist(-1), { pole: V(-1, 0.2, -0.4), rate: 20 });
    anim.update(0.5);
    // the chains from his obelisk's rings to his wrists
    const chains = [];
    const at = { rig, anim, yaw, chains };
    ys.updaters.push((dt) => {
      anim.update(dt);
      if (!chains.length && ys.anchors) {
        for (const [i, side] of [['hand_L', 0], ['hand_R', 1]]) chains.push({ bone: i, top: ys.anchors[side], g: null });
      }
      for (const c of chains) {
        const hand = rig.bonePosition(c.bone, _c);
        if (!c.g) c.g = ys.chainBetween(c.top, hand, 0);
        else ys.fitChain(c.g, c.top, hand);
      }
    });
    Object.defineProperty(at, 'position', { get: () => rig.root.position });
    return at;
  }

  // a close shot of him chained, from in front and below (he's on his knees: the camera low)
  atroChainedClose(a, duration = 1.4, side = 0.6, fov = 36) {
    const h = a.rig.bonePosition('head', V(0, 0, 0)), f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)), r = V(f.z, 0, -f.x);
    return this.director.move(h.clone().addScaledVector(f, 2.3).addScaledVector(r, side).add(V(0, -0.25, 0)), h.clone().add(V(0, -0.05, 0)), duration, ease.inOut, fov);
  }

  // ---------------------------------------------------------------- 5. the verdict
  // Oa: the Guardians on their pillars, Hal and Sinestro on the dais. A Lantern keeps to his own
  // sector; the charge is set aside; Sinestro is to train Jordan in the field. The end of Part Four.
  async trial() {
    const { ui, director, audio, player } = this;
    this.lanternUp();
    this.setupOa();
    this.addGuardians();
    this.hallActive = true;
    const land = V(HALL.x, DAIS_TOP, HALL.z);
    this.enterOa(land, Math.PI);
    ui.clock(this.save.info('trial').clock);
    this.takeControl();
    const sin = (this.sin = this.addSinestroAt(this.oa));
    const sinAt = land.clone().add(V(1.7, 0, 0.4));
    sin.place(sinAt, Math.PI);
    const elder = this.elder, gs = this.guardians;
    const elderHead = () => elder.bonePosition('head', _p).add(V(0, 0.08, 0));
    player.lookAt(elderHead, 0.85);
    sin.bl.lookHome = () => elderHead;
    const choir = audio.pad([98, 146.8, 196, 293.7], 0, { cutoff: 900, fadeIn: 3 });
    choir.level(0.05, 3);
    // the hall from behind them: the two Lanterns small before the crescent of pillars
    director.cut(HALL.clone().add(V(2.4, 2.6, 6.8)), HALL.clone().add(V(0, 6.2, -10)), 48);
    tween(0.9, (k) => (this.engine.gradeUniforms.uFlash.value = 1 - k), ease.out);
    director.move(HALL.clone().add(V(1.6, 2.8, 5.4)), HALL.clone().add(V(0, 6.8, -10)), 6, ease.inOut, 44);
    await wait(2.0);
    await this.gSay('gTrial1');
    await this.gClose(gs[1], 1.6, 0.4);
    await this.gSay('gTrial2', gs[1], [['sector', () => gs[1].anim.gesture('chin', 1.1, 0.5)]]);
    await this.halUp(1.2);
    player.animator.gesture('beat', 0.5, 0.6);
    await this.say('halTrial1');
    await this.gClose(elder, 1.6);
    await this.gSay('gTrial3', elder, [['aside', () => elder.anim.gesture('nod', 1, 0.4)]]);
    await this.gClose(elder, 1.2, -0.3);
    elder.gu.uHandL.value = 1;
    elder.bl.play('decree');
    await this.gSay('gTrial4');
    setTimeout(() => (elder.gu.uHandL.value = 0), 1200);
    sin.yaw = Math.PI; sin.place(sinAt, Math.PI);
    await this.sinClose(1.2);
    await this.sinSay('sinTrial1');
    // to Hal, as they go
    sin.yaw = Math.atan2(player.position.x - sinAt.x, player.position.z - sinAt.z);
    sin.place(sinAt, sin.yaw);
    sin.bl.lookHome = () => this.headOf(player.rig)();
    player.lookAt(() => sin.rig.bonePosition('head', _h), 0.8);
    await this.sinClose(1.2, -1);
    await this.sinSay('sinTrial2', [['Korugar', () => sin.anim.gesture('chin', 1.1, 0.5)]]);
    await this.halClose(1.0);
    player.animator.gesture('tilt', 0.8, 0.4);
    await wait(1.2);
    choir.stop(4);
    await ui.fade(1, 2.0);
    this.hallActive = false;
    await ui.screen({ kicker: 'Part Four · The Prisoner', title: 'THE PRISONER', subtitle: 'End of Part Four', body: 'Atrocitus is back in his chains on Ysmault, and the Blackest Night is coming. Sinestro will see you on Korugar.', buttons: ['Quit to title'] });
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  }
}

// A splash on a canvas: an irregular blot (a few random harmonics round a circle, soft-edged) with
// spatters round it, shaded from `cols[0]` at the centre to `cols[1]` at the edge, and a matching
// glow map (`userData.glow`): `glow` along the rim (`rim`, the hole torn in the hull) or in
// specks through it (the prisoner's blood, still burning).
function splat(cols, glow, rim = false) {
  const N = 256, c = document.createElement('canvas'), gc = document.createElement('canvas');
  c.width = c.height = gc.width = gc.height = N;
  const x = c.getContext('2d'), gx = gc.getContext('2d');
  gx.fillStyle = '#000'; gx.fillRect(0, 0, N, N);
  const harmonics = (rough) => [2, 3, 4, 5, 7, 9].map((k) => [k, (0.16 / Math.pow(k, 0.8)) * rough * (0.5 + Math.random()), Math.random() * 6.28]);
  const outline = (ctx, cx, cy, r, harm) => {
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      let k = 1;
      for (const [n, amp, ph] of harm) k += amp * Math.sin(n * a + ph);
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
    }
    ctx.closePath();
  };
  const main = harmonics(1.6);
  const grad = x.createRadialGradient(128, 128, 8, 128, 128, 92);
  grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
  x.save(); x.shadowColor = cols[1]; x.shadowBlur = 6;
  outline(x, 128, 128, 70, main); x.fillStyle = grad; x.fill();
  // runs and drops thrown off it (none round a hole)
  for (let i = 0; i < (rim ? 0 : 16); i++) {
    const a = Math.random() * 6.28, d = 74 + Math.random() * 40, r = 2 + Math.random() * 8;
    outline(x, 128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, harmonics(0.6)); x.fillStyle = cols[1]; x.fill();
  }
  x.restore();
  gx.save(); gx.shadowColor = glow; gx.shadowBlur = 12;
  if (rim) {
    // a hot edge round the opening, fading into it
    gx.strokeStyle = glow; gx.lineWidth = 5;
    outline(gx, 128, 128, 70, main); gx.stroke();
    gx.lineWidth = 2; gx.globalAlpha = 0.5;
    outline(gx, 128, 128, 78, main); gx.stroke();
  } else {
    gx.fillStyle = glow;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 66, r = 1.5 + Math.random() * 4.5;
      outline(gx, 128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, harmonics(0.8)); gx.fill();
    }
  }
  gx.restore();
  const t = new THREE.CanvasTexture(c), gt = new THREE.CanvasTexture(gc);
  t.colorSpace = gt.colorSpace = THREE.SRGBColorSpace;
  t.userData.glow = gt;
  return t;
}

// Part Two's Oa, Kilowog, the Guardians and travel, shared with Part Four (their module's
// constants come with them).
for (const name of ['setupOa', 'enterOa', 'addKilowog', 'kwTurn', 'quip', 'onKill', 'onPlayerHit', 'addGuardians', 'gSay', 'gClose', 'halUp', 'sinClose', 'sinSay', 'learn', 'chartWorlds', 'arriveFlying']) {
  Prisoner.prototype[name] = Corps.prototype[name];
}

const _h = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3();
void BIER; void hasProp;
