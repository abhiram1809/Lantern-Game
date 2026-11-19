import * as THREE from 'three';
import { Animator } from '../characters/Rig.js';
import { Locomotion } from '../characters/Mocap.js';
import { createHal, JAW } from '../characters/Characters.js';
import { createPilot } from '../characters/FlightSuit.js';
import { JET_SPOT } from '../scenes/Ferris.js';
import { PIER, LOT_Z } from '../city/Plan.js';

// The pictures on Hal's phone (ui/Phone.js's Photos), set up in the valley's own scene: a figure posed
// where it would have stood, the camera where a friend held the phone, the sun's shadows, the lamps
// and the drawing distances moved to it for the moment the picture's taken, then put back.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CAROL_IN = V(3.2, 0, 19.5); // (Exile.js's: Carol in Hangar Two)

export const ALBUM = {
  photoShots() {
    const f = this.ferrisScene;
    if (!f) return [];
    const scene = f.scene, cam0 = this.engine.camera, shots = [];
    // the world drawn round the picture's camera, and back round the game's after
    const around = (cam, at) => {
      f.focus?.(at);
      f.lod?.update(0, cam);
      f.lamps?.update(0.5, cam);
      return () => { f.lod?.update(0, cam0); f.lamps?.update(0.5, cam0); f.focus?.(this.player.position); };
    };
    // a figure standing at ease (the mocap idle, a moment of it), facing `face`
    const stand = (rig, at, face, reach = null) => {
      const anim = new Animator(rig), loco = new Locomotion(this.mocap);
      loco.scale = rig.hipsHeight / this.mocap.hipsHeight;
      loco.relax.adduct = 0.12;
      anim.play(loco, 0);
      rig.root.position.copy(at);
      rig.root.rotation.y = Math.atan2(face.x - at.x, face.z - at.z);
      scene.add(rig.root);
      if (reach) anim.reach('R', reach.at, { pole: reach.pole, rate: 40 });
      for (let i = 0; i < 16; i++) anim.update(1 / 20);
      rig.root.updateMatrixWorld(true);
      return anim;
    };

    // 1. test day: in the flight suit, the prototype behind him
    if (this.player.rig !== this.pilotRig) {
      const at = JET_SPOT.clone().add(V(-4.6, 0, 5.2)), from = JET_SPOT.clone().add(V(-2.4, 1.5, 9.4));
      shots.push({ scene, from, at: at.clone().add(V(0.9, 1.25, -1.2)), fov: 44, cap: 'Test day. Tom took this. Tom always takes this.', prepare: (cam) => {
        this.pilotRig ??= createPilot(this.assets.characters.casual);
        const p = this.pilotRig;
        p.wearHelmet?.(false);
        stand(p, at, from);
        const back = around(cam, at);
        return () => { p.root.removeFromParent(); back(); };
      } });
    }
    // 2. Friday at the Blue Marlin: a beer, the bottles behind the bar
    const gus = this.cityLife?.people.find((p) => p.label === 'Gus');
    if (gus) {
      const fwd = V(Math.sin(gus.yaw), 0, Math.cos(gus.yaw)), side = V(fwd.z, 0, -fwd.x);
      const at = gus.home.clone().addScaledVector(fwd, 1.55).setY(gus.home.y);
      const from = at.clone().addScaledVector(side, 2.3).addScaledVector(fwd, 0.6).add(V(0, 1.55, 0));
      shots.push({ scene, from, at: at.clone().addScaledVector(fwd, -0.5).add(V(0, 1.3, 0)), fov: 46, cap: 'Blue Marlin, Friday. Tom was buying. (Tom was not buying.)', prepare: (cam) => {
        this.photoHal ??= createHal(this.assets.characters.casual, { roughMin: 0.62, jaw: JAW.casual });
        const h = this.photoHal, hand = V(0, 0, 0);
        const grip = at.clone().addScaledVector(fwd, -0.36).add(V(0, 1.25, 0)).addScaledVector(side, 0.12);
        stand(h, at, gus.home.clone().setY(at.y), { at: grip, pole: V(0.4, -1, 0.3) });
        h.bonePosition('hand_R', hand);
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.15, 20), new THREE.MeshStandardMaterial({ color: 0xd99a2b, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.82 }));
        const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.025, 20), new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.6 }));
        foam.position.y = 0.085;
        glass.add(foam);
        glass.position.copy(hand).addScaledVector(fwd, -0.05).add(V(0, 0.03, 0));
        scene.add(glass);
        const back = around(cam, at);
        return () => { h.root.removeFromParent(); glass.removeFromParent(); back(); };
      } });
    }
    // 3. his Phoenix, wherever he left it
    if (f.car) {
      const car = f.car;
      car.updateMatrixWorld(true);
      shots.push({ scene, from: car.localToWorld(V(3.1, 1.15, 4.6)), at: car.localToWorld(V(0, 0.65, 0.2)), fov: 40, cap: 'The Phoenix. Starts on the third try. Every time.', prepare: (cam) => around(cam, car.position) });
    }
    // 4. the pier's Ferris wheel from the beach, out over the sea
    {
      const z = LOT_Z + PIER.z;
      shots.push({ scene, from: V(-1168, 1.9, z - 70), at: V(-1450, 16, z), fov: 50, cap: 'The pier from the beach. Coast City’s best view is of the ocean.', prepare: (cam) => around(cam, V(-1300, 0, z)) });
    }
    // 5. Carol in Hangar Two, not looking (she'd say delete it)
    if (this.carol?.root) {
      shots.push({ scene, from: CAROL_IN.clone().add(V(2.4, 1.6, -3.4)), at: CAROL_IN.clone().add(V(0, 1.45, 0)), fov: 40, cap: 'Carol at work. She’d tell me to delete this.', prepare: (cam) => {
        const vis = this.carol.root.visible;
        this.carol.root.visible = true;
        const back = around(cam, CAROL_IN);
        return () => { this.carol.root.visible = vis; back(); };
      } });
    }
    // 6. the prototype on the apron, low, the way the brochure has it
    shots.push({ scene, from: JET_SPOT.clone().add(V(17, 0.9, 15)), at: JET_SPOT.clone().add(V(0, 2.1, 0)), fov: 40, cap: 'Ferris Two-Seven. Mine, nine to five.', prepare: (cam) => around(cam, JET_SPOT) });
    return shots;
  },
};
