# Green Lantern — Awakening · The Corps

A Three.js story game. **Part One, Awakening:** test pilot Hal Jordan comes home, falls asleep,
relives his father's crash, is visited by the ring's light, refuses to be afraid, and is carried
to Abin Sur's wreck on the lake shore, where the ring chooses him. **Part Two, The Corps** (in
progress): Hal on Oa, at Kilowog's training range.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Begin** (audio starts on that click; headphones help).

| Key | Action |
| --- | --- |
| WASD / arrows | Move (camera-relative) |
| Shift | Run |
| Mouse | Look (click the canvas to capture the pointer) |
| E | Interact / reach for the ring / recharge at the lantern |
| Space, Enter, click | Advance dialogue |
| Y / N | Answer the light |
| V | Toggle spoken voices |
| Esc / P | Pause menu |

Once the ring is charged (after the oath):

| Key | Action |
| --- | --- |
| 4 | Construct wheel: time stops; move the mouse to a construct and click (or hold 4 and let go) |
| Left click | Use the armed construct: strike with the fist, place a wall; hold to keep the shield up or to fire the gatling |
| Scroll | Change the construct's range |
| Q | Holster the construct |
| Space twice | Take off / drop out of flight (there is no jump) |
| W / Space / C / Shift (flying) | Fly where you look / climb / descend / boost |

While the shield or the gatling is up, Hal faces where you look and strafes: W/S/A/D move him
relative to the camera (S backs him off) without turning him away from your aim. Flying with
one, he hovers upright and faces where you look instead of flying head-first.

The ring's HUD shows Hal's health (bottom left) and the ring's charge with the armed construct
(bottom right). Constructs and flight use charge; recharge at the lantern (on Oa the Central
Power Battery recharges the ring continuously). Fire and drone bolts hurt; health comes back if
Hal stays out of harm for a few seconds. Aim near an enemy and the reticle locks on: brackets
and a health bar mark it, and hits pop damage numbers.

## Checkpoints and saving

Progress saves automatically at each checkpoint, to `localStorage` with a cookie mirror as a
fallback. Each part has its own save (`gl_awakening_v1`, `gl_corps_v1`); constructs learned in
either carry over. The title screen offers **Continue**, **New game** and **Chapters** (any
checkpoint reached so far), and **Part Two: The Corps** once Part One is finished (Part One's
end card also offers it). The pause menu can resume, restart the current checkpoint, jump to a
chapter, toggle voices, or quit to the title.

| Checkpoint | Where it puts you |
| --- | --- |
| `home` | Coming home: the hallway intro |
| `bedroom` | Get some rest: in the bedroom, in control |
| `light` | The light: asleep at 10:00 PM, just before the meteor |
| `question` | Are you afraid?: sitting up, facing the light |
| `crash` | The crash site: the arrival |
| `abin` | Abin Sur: a few metres from the wreck |
| `lantern` | The lantern: after Abin Sur's death, ring on your finger at 12% |
| `powers` | The ring's power: suited, fully charged, the ring training |
| `free` | Green Lantern: free roam in the suit, all starter constructs and flight |

Part Two:

| Checkpoint | Where it puts you |
| --- | --- |
| `oa` | Kilowog's range: arrival on Oa, then the target drones |
| `livefire` | Live fire: the gatling, then drones that shoot back |
| `range` | The training ground: the end card, then free training |

For testing, a URL hash starts at any checkpoint, e.g. `http://localhost:5173/#lantern`.

## Story beats

1. **Home** (free roam): hallway → bedroom. Optional looks at the photo of Martin Jordan, the posters,
   the window, the keys (Hal glances at whatever you can interact with). Interact with the bed to lie down.
2. **Nap**: Hal tosses and turns under a blanket that drapes over his body; two sepia dream fragments
   of the airfield (his father waving, then the jet going down).
3. **The light**: 10:00 PM. A meteor crosses the window, the light enters and blows the room's props
   around; Hal sits up shielding his eyes. *"Are you afraid?"*: **Yes** fails (face it again, or restart
   the chapter), **No** continues.
4. **Crash site**: the light carries Hal head-first through hyperspace (styled after the space-flight
   reference video `assets/raw/gemini_generated_video_93604faf.mp4`) and sets him down on the lake
   shore. A secondary blast throws debris; he walks to the wreck. Abin Sur speaks in a glyph script and
   holds out his hand; the ring floats to Hal, who reaches for it; once it is on his finger the alien
   line decodes into English. Abin Sur dies, and the ring's interface comes up: its charge is down
   to 12%. At the lantern Hal speaks the oath ("In brightest day, in blackest night…"); each line
   pours more light into the ring until it reads 100%, and the suit sweeps over him.
5. **The ring's power** (training at Abin Sur's side): open the construct wheel (time stops),
   knock a burning hull plate away with a giant fist, raise a shield as the wreck's power core
   blows and hurls burning debris at you, raise a wall, then double-tap Space to fly above the
   treeline and land. After the end card you can keep exploring as Green Lantern.

Constructs: **Fist** (attack, up to 14 m), **Shield** (defense, held), **Wall** (defense, placed
where you aim, stands 20 s), and **Gatling** (attack, learned on Oa: hold to spin up and fire,
45 m). Sword, staff, hammer and axe are on the wheel but locked for later. Every construct is
physical: the fist throws debris and drones, the shield deflects debris and bolts, and walls
block debris, bolts and Hal.

### Part Two: The Corps (in progress)

1. **Oa:** Hal arrives on Kilowog's training range, a disc floating high above Oa's city, with the
   Central Power Battery on the horizon: the giant lantern of the comics, its glowing lens set in
   a green globe under a wide cap and handle ring, ringed by the citadel's towers. Kilowog sizes
   up his new "poozer".
2. **Targets:** five target drones rise from the pads; break them with the fist.
3. **Live fire:** Kilowog teaches the gatling, then sends two waves of drones that circle, take
   turns to attack (watch for the red aim line), and fire bursts of bolts. Block with the
   shield, use the pillars and walls, or fly.
4. **The range:** after the end card the range stays open; ask Kilowog for another round.

## Characters and movement

- **Models.** `npm run assets` (`tools/build-assets.mjs`) turns the Tripo scans in `assets/raw`
  (`Hal-Improved.glb` casual, `hal_b.glb` suit, `Abin.glb`, `Kilowog.glb`) into `public/models/*.glb`: reoriented,
  scaled, decimated to 90–100 k triangles, WebP textures, and **auto-rigged** by `tools/autorig.mjs`
  (17-bone humanoid placed from anatomical landmarks; skin weights from limb chains, blended at the
  joints, smoothed, with the whole skull/face/jaw on the head bone along a detected jaw line).
- **Motion capture.** Locomotion and idles are real mocap (the Mixamo-rigged *Xbot* clips from the
  three.js examples, stripped to `public/anims/xbot.glb` by `npm run mocap`), **retargeted** onto each
  scan's own skeleton (`src/characters/Mocap.js`): per-bone world rotations from rest plus a fixed
  correction for each rig's rest pose, so T- and A-pose scans both work.
- **Natural motion layers** (`src/characters/Rig.js`, `Player.js`, `IK.js`), the standard techniques
  from third-person games:
  - idle / walk / run blended by ground speed, gait phase driven by distance so feet don't slide,
    footsteps on foot contact, a "tired" posture layered on at the start;
  - momentum: acceleration and braking limits, speed-dependent turn rate, slowing into sharp turns;
  - forward lean into acceleration, banking into turns;
  - foot IK: feet planted on uneven ground (hips lower for the lower foot, the other knee bends);
  - head look-at shared between neck and head, with limits and easing;
  - two-bone arm IK for interactions (shielding the eyes, hands on knees, Abin offering the ring,
    reaching for it, looking at it, aiming the ring at the lantern, the father's wave);
  - procedural nods and head shakes on dialogue.
- **Cutscene poses** (lying in bed, sitting, kneeling, floating, carried) are parameter poses in
  `src/characters/Poses.js`; the animator crossfades between them and mocap in quaternion space.

## Environment

- **Trees** (`src/fx/Trees.js`): procedural conifers (stacked, drooping, jagged branch tiers, tilted
  and offset; near/mid/far detail levels) and clumped broadleaf trees, instanced with per-tree colour
  and a wind sway. The lake's far shore is low wooded hills whose skyline is the tree line; forest
  also stands inland and frames both ends of the bay, and fills the view from the bedroom window.
- Everything else (rooms, ship, terrain, water, sky, fire, ring, lantern) is procedural, and all
  sound is synthesised with WebAudio. Spoken lines use the browser's speech synthesiser.

## Code map

```
src/main.js                 boot, asset loading, title / continue / chapters
src/engine/                 renderer + post (bloom, NaN guard, dream grade), pause, Rapier physics,
                            input, camera director, timers/tweens, synth audio, voices, Save (checkpoints)
src/characters/             Rig + Animator (quaternion poses, layers), IK (two-bone, world rotations),
                            Mocap (retargeting, locomotion blend), Poses (cutscene + flight poses), Player
                            (controller with momentum, flight, orbit camera), Characters (loading, suit
                            glow / dissolve material patch, Abin Sur, ring, lantern)
src/powers/                 RingPowers (charge, health, construct wheel, aiming + aim assist, fist / shield /
                            wall / gatling, damage, flight effects), Constructs (list, shaders, shapes)
src/scenes/                 Bedroom (+ hallway), Dream (airfield), Hyperspace (the transit), CrashSite, Oa
src/enemies/                Drones (Part Two's training drones: AI, physics, bolts)
src/fx/                     sky, particles + fire, water, trees, green light / bubble / shafts, cloth, textures
src/story/                  Story (Part One + the shared chapter plumbing), Corps (Part Two), lines (all dialogue)
src/ui/                     HUD, subtitles, glyph cipher + decode, choice, cards, pause menu, checkpoint
                            notice; PowerHud (health, ring charge, construct wheel, reticle, training panel)
tools/                      asset pipeline (build-assets, autorig, strip-mocap, extract-posters) and debug
                            renderers (inspect-model, inspect-weights, inspect-heads); headswap.mjs is the
                            earlier fix for the old casual scan, kept for reference
```

## Notes and limits

- No lip sync or hair simulation (as agreed). Physics covers the character controller, props in the
  bedroom (shoved by the light, floating when Hal rises), debris at the crash, verlet curtains and
  the body-following blanket.
- Credits: locomotion clips are Mixamo animations shipped with the three.js examples (`Xbot.glb`);
  Mixamo's terms allow use in projects but not redistribution of the raw animation files.
- `window.__game` exposes the engine/story for debugging; `__game.shot(name, seconds)` steps the game
  and saves a canvas capture through the dev server (set `SHOT_DIR` to choose the folder).
