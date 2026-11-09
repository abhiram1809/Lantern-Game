# CLAUDE.md — Green Lantern: Awakening

Guide for coding agents working on this project. `README.md` is the player-facing overview
(controls, checkpoints, story); this file is the agent-facing one: how the game works, how the
user likes to work, what has been done, and what to watch out for.

## Keep this file current (do this every time)

This folder has been a git repository since 2026-11-09 (on `main`), pushed to the **public**
GitHub repo https://github.com/abhiram1809/Lantern-Game and licensed MIT (see *Git and GitHub*
under Commands). Commit and push only when the user asks. This file's change log still holds
the project's history from before git, and the reasons behind changes that a commit message
doesn't carry.

After any decent update to the game, update CLAUDE.md before you finish. A decent update is:

- a new part, chapter, scene, cutscene or checkpoint
- a new system or a rewritten one, such as movement, animation, physics, save, audio, UI or rendering
- a new or replaced model, animation set or asset pipeline step
- changes to controls, the save format, commands, ports or tooling
- a bug fix that taught something non-obvious; add it to **Gotchas**

How to update it:

1. Edit the sections the change affects, so they describe the game as it is now. Delete or
   correct statements that are no longer true; don't just append.
2. Add a dated entry at the top of the **Change log**: what changed, the files involved, what you
   verified in the browser and what you didn't.
3. Update **Status** (verified and not verified) and **Open items**.
4. If players would notice the change (controls, checkpoints, story beats), update `README.md`
   too.

Small tweaks such as a colour value, a timing nudge or a typo don't need an entry.

---

## What this is

A browser story game in Three.js about Hal Jordan becoming Green Lantern. **Part One,
"Awakening"**, is complete and playable. **Part Two, "The Corps"** has its first slice: the
Guardians' summons at the lake, the flight across the universe to Oa, Kilowog's range (target
drones, the Gatling, a live-fire drill), Sinestro (the sword, a sparring duel), and hyperspace
travel between Oa and Earth. Part Three (Coast City) is planned.

The story of Part One:

1. Hal comes home tired and naps.
2. He dreams uneasily of his father Martin's crash.
3. A green light wakes him and asks *"Are you afraid?"*. **Yes fails** (retry or restart the
   chapter); **No continues**.
4. The light carries him through hyperspace to Abin Sur's wreck on a lake shore.
5. Abin Sur speaks in a glyph script that decodes into English once the ring is on Hal's finger.
   The ring arrives nearly spent: **12% charge**.
6. Abin Sur dies. The ring's HUD comes up (health and charge) and points Hal to the lantern.
   Taking it, Hal speaks the full oath; each of its four lines pours light into the ring, **12% →
   100%**, then the transformation into the suit. The ring shows Hal its **pocket dimension**: L
   puts the lantern away (and brings it back out).
7. **Ring training** at Abin Sur's body: the construct wheel, the fist, the shield (the wreck's
   power core blows), the wall, then flight and landing. Then the end card (which offers Part
   Two) and free roam.

Part Two so far (`src/story/Corps.js`):

1. **The summons** (the lake, 10:31 PM): by Abin Sur's body the ring relays the Guardians' call to
   Oa. Hal says goodbye, flies above the trees and presses E.
2. **Hyperluminal** (`src/story/Voyage.js`): a launch out of the sky, high orbit over Earth's night
   side, the jump through the streak tunnel, Oa's orbital approach.
3. **Arrival:** Hal streaks down onto the range in front of Kilowog ("poozer").
4. **Targets:** five target drones to break with the fist.
5. **Live fire:** Kilowog teaches the **Gatling** ("if you can see it, the ring can make it"), then
   two waves of drones that shoot back.
6. **Sinestro** (`enemies/Sinestro.js`): he comes down beside the podium ("Abin Sur was my
   friend"), forms a blade ("a construct is a thought, held still"), and Hal learns the **Sword**
   on four target drones.
7. **Sparring:** a duel with Sinestro, flying, until he calls it at 35% ("Fearless is not the same
   as wise").
8. **The range:** an end card ("to be continued: the Guardians"), then free training, and the ring's
   hyperspace routes between Oa and Earth (the star chart: E high in flight). Kilowog starts
   another round on request. Back on Earth the Corps has taken Abin Sur's body home.

The ring recharges continuously on Oa (the Central Battery is in range); the lantern can still be
set down there.
Stack:

- `three` r0.187 (WebGLRenderer plus EffectComposer)
- `@dimforge/rapier3d-compat` for physics
- Vite 8
- Node tools built on `@gltf-transform`, `meshoptimizer` and `sharp` for the asset pipeline

No audio files are shipped: everything is synthesised with WebAudio, and voices use the browser's
`speechSynthesis`.

## Working with this user

- **They supervise closely and are blunt about visual breakage.** One example was "What the hell
  is this sideways face" when the head weights sheared the face. Before handing anything over:
  - Look at faces, hands and deformation **in close-up** during the motion you changed.
  - Look at the camera angles the player actually sees.
- **Quality bar:** it should not look low effort, or "like it was made in a day". Prefer depth
  and polish over adding features quickly.
- **Physics of movement matters most**: natural running, arm interactions and weight. Hair and lip
  sync are explicitly optional.
- **Borrow established techniques.** The user said to copy physics and animation approaches from
  other games instead of inventing them, so prefer known methods: mocap, IK, motion matching,
  speed-matched blending, momentum steering.
- **Models:** the user makes 3D models in Tripo and drops them in `assets/raw/`. Integrate what
  they give you; don't spend effort repairing bad scans. For new characters (from 2026-11-09)
  they asked you to **try making the model first, at the quality of the current scans** (built
  procedurally, or derived from an existing scan). Check it in close-up; if it falls short, say
  so plainly and they will generate it. When they say "I'm making X, you focus on other things",
  leave X alone.
  - **Show them each iteration and ask** (their words: "keep asking for my opinion on how good it
    looks"). Send close-ups (front, three-quarter, profile, eyes) after each pass and ask before
    moving on; they push for improvements until it meets the scans' bar. For Sinestro they gave
    a comic reference and said to match it **facially, not the suit**; they picked out the eyes,
    the front view and the nose. Keep tall review sheets short: very tall images preview with
    colour banding.
- **File hand-off:** macOS blocks reads of `~/Downloads`. Ask the user to copy files into the
  project folder. Files they "copy" sometimes land in `~/Documents` instead.
- **The user often runs their own dev server on port 5173.** Never kill it. Run your own on 5180
  (see *Testing in the browser*). After you rebuild models in `public/models`, tell them to hard
  refresh (Cmd+Shift+R).
- They ask questions in plain language and expect the work done, then a clear summary of what
  changed, what you checked, and what you didn't check.
- **Comic accuracy** is preferred where the constraints allow (the oath, the lantern recharge,
  constructs, the ring's voice). For the story after Part One they want to discuss options first.
- **Controls they chose:** no jump, ever. `4` opens the construct wheel (time stops), click
  deploys. Double-tap Space flies. `L` stores or summons the lantern (pocket dimension). `E` high in
  flight enters hyperspace (they asked for E). Fist, shield and wall are the starter constructs;
  the gatling (Kilowog) and the sword (Sinestro) are learned on Oa; staff, hammer and axe stay
  locked for later parts.
- **Travel and planets (their design, 2026-11-09):** after Kilowog's training Hal can go home; the
  star chart unlocks more planets as the story goes on. For now only Oa and Earth are charted.

## Commands

```bash
npm install
npm run dev        # Vite on http://localhost:5173 (strictPort)
npm run build      # production build to dist/ (should be clean, no errors)
npm run assets     # tools/build-assets.mjs: assets/raw/*.glb → public/models/*.glb (rigged)
npm run mocap      # tools/strip-mocap.mjs: assets/mocap/{Xbot,Soldier}.glb → public/anims/
npm run posters    # tools/extract-posters.mjs: cuts posters from assets/ref/4.webp
```

Environment variables for `npm run assets`:

- `ONLY=abin_sur` builds one model.
- `DEBUG_DIR=/some/dir` also writes rig preview PNGs (`_tex`, `_bones`, `_head`, `_posed`).

The model build takes a minute or two.

### Git and GitHub

- **The repository is public and open source by the user's choice** ("keep everything
  open-source"), raw scans and videos included. Everything committed is world-readable: never
  commit secrets, tokens or personal data, and don't make the repo private.
- **License:** MIT (`LICENSE`, copyright abhiram1809, the user's GitHub name; the README's
  License section says what it covers). The Mixamo clips (`assets/mocap/Xbot.glb`,
  `Soldier.glb`, and `public/anims/`) are third-party and stay under Mixamo's terms.
- **Pushing:** this Mac has no `gh` CLI and no stored GitHub login. The user pastes a
  short-lived token when they want a push. Use it for that one command only, never in the
  remote URL or a file. The empty `credential.helper=` stops macOS's keychain helper from
  saving it:

  ```bash
  T='<token>' git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo "password=$T"; }; f' push
  ```

  Remind the user to revoke the token afterwards.

`assets/raw` and `assets/mocap` are the large source files (about 120 MB, every file under
25 MB). They are committed, at the user's request, so the repository holds the original scans
and reference videos. The built outputs in `public/` are what the game loads.

## Assets and references

| Path | What it is |
| --- | --- |
| `assets/raw/Hal-Improved.glb` | **Casual Hal** (the user's model), built as `public/models/hal_casual.glb` |
| `assets/raw/hal_b.glb` | **Suited Hal**, built as `hal_lantern.glb`. The user calls it "the perfect one". |
| `assets/raw/Abin.glb` | **Abin Sur** (the user's model), built as `abin_sur.glb` |
| `assets/raw/Kilowog.glb` | **Kilowog** (the user's model, 2026-11-09), built as `kilowog.glb`. Two figures side by side; the z > 0 one is kept (`keepSide: 1`). |
| (none) | **Sinestro** has no file: `createSinestro()` derives him at runtime from `abin_sur.glb` with a shader layer (see *Characters*). |
| `assets/raw/hal_a.glb` | Old casual scan: two figures, poor face. Unused; see the commented entry in `build-assets.mjs`. |
| `assets/raw/gemini_generated_video_93604faf.mp4` | Hyperluminal space flight: radial streaks, "ORBITAL APPROACH" HUD. **The Hyperspace scene is styled after it.** |
| `assets/raw/gemini_generated_video_6bbb1091.mp4` | Reference for a **later part**: the suited Lantern flying over a neon night city, fighting red-eyed mechs with constructs (minigun, hex shield); combat HUD with minimap, health, ammo and damage numbers. |
| `assets/ref/1–4.webp` | Concept art. The HUD frame, the 10:00 PM timestamp and the glyph subtitles come from here. `4.webp` is the bedroom; the posters are cut from it. |
| `assets/mocap/Xbot.glb`, `Soldier.glb` | Mixamo-rigged characters from the three.js examples. Only Xbot's clips are used at runtime (`public/anims/xbot.glb`). |

Model build settings (`MODELS` in `tools/build-assets.mjs`):

| Model | Target triangles | Height |
| --- | --- | --- |
| Casual Hal | 100k | 1.83 m |
| Suited Hal | 90k | 1.83 m |
| Abin Sur | 90k | 1.96 m |
| Kilowog | 90k | 2.4 m |

Every model faces +Z (`facing: 1`) and has WebP textures.

---

## Architecture

### Boot and frame loop (`src/main.js`)

`boot()` sets up the game in this order:

1. It creates the `Engine`, `Input`, `AudioBank`, `Voice` and `UI`.
2. Three things load in parallel: `loadCharacters()` (three GLBs plus the Xbot mocap),
   the poster textures, and `initPhysics()` (Rapier WASM).
3. It exposes `window.__game` (`story` is a getter: the story object doesn't exist until the
   title has picked a part).
4. It starts `engine.start((dt, t, real) => { tick(dt); story?.update(dt, t, real); input.endFrame(); })`.
5. It runs `titleFlow()`, which resolves with `{ part, id }`.
6. It calls `audio.init()`. That has to happen after a user click, because of the browser's
   autoplay rules.
7. It makes the part's story (`Story` for Part One, `Corps` for Part Two) and calls
   `story.run(id)`.

`titleFlow` shows **Begin** on a fresh save, or **Continue**, **New game** and **Chapters** once
there is a save. Once Part One has reached `free` (or Part Two has a save) it adds **Part Two: The
Corps**, and Chapters asks which part first. A pause-menu restart reloads the page with
`{ part, id }` in sessionStorage. That resume, or a URL hash (checkpoint ids are unique across
parts, e.g. `#oa`), shows a one-button "Continue" card.

### Game time (`src/engine/Time.js`, `Engine.timeScale`)

`wait(s)`, `tween(dur, fn, ease)`, `waitFor(pred)` and `onFrame(fn)` all advance with
`tick(dt)` in the game loop. They pause with the game, and `engine.advance()` can step them
deterministically. **Use these for story timing, not `setTimeout`.** The only exception is
cosmetic audio delays.

Helpers: `lerp`, `clamp`, `damp(current, target, lambda, dt)` (frame-rate-independent easing)
and the `ease` curves.

`engine.timeScale` scales game time; `0` stops it while rendering carries on (the construct wheel,
hit-stop on impacts). The frame callback gets `(dt, t, real)`: scaled and unscaled step. Physics
skips steps under 0.1 ms and `Story.update` skips the scene update when `dt` is 0, so a stopped
world is truly frozen. Anything that must keep moving while time is stopped (wheel input, the
grade fade) uses `real`.

### Engine (`src/engine/Engine.js`)

- **Renderer:** pixel ratio capped at 1.5, PCF shadows, ACES tone mapping.
- **Post chain:** `RenderPass` → NaN/Inf guard → `UnrealBloomPass` → grade `ShaderPass` →
  `OutputPass`.
  - The composer renders into a HalfFloat target with 4× MSAA.
  - The NaN guard exists because a single NaN pixel gets smeared into black blocks by the bloom.
    Keep it.
  - `engine.gradeUniforms` drives the grade: dream sepia, aberration, vignette, grain, the
    colour flash, `uFocus` (time stopped: drained and green) and `uHurt` (red edges on damage).
- `engine.paused` keeps rendering but skips updates.
- `engine.frame(dt, render)` and `async engine.advance(seconds, dt = 1/30)` step the game
  manually, for debugging and captures.

### Story (`src/story/Story.js`, `src/story/lines.js`)

`Story` owns the flow, the current scene (`show(scene)`), the player, the camera director and the
interactions. Each chapter is an `async` method that awaits waits, tweens, dialogue and the
player's actions.

**Parts:** `Story` is Part One *and* the shared plumbing. Part Two's `Corps` (`src/story/Corps.js`)
extends it and overrides `get save()` (its own store), `steps()` (checkpoint id → method) and
`prepare(id)`. Everything else (powers, HUD, pause, dialogue, barks, collapse, interactions) is
inherited. A later part should do the same.

**Checkpoints:**

- `CHECKPOINTS` in `src/engine/Save.js` is the ordered list: `home`, `bedroom`, `light`,
  `question`, `crash`, `abin`, `lantern`, `powers`, `free`. Each entry has a label and an
  in-game clock.
- `run(start)` walks `this.save.checkpoints`, mapping each id through `steps()`: for Part One
  `home()`, `bedroomRoam()` (which calls `nap()`), `light()`, `question()`, `crashArrival()`,
  `meetAbin()`, `takeLantern()` (which calls `transform()`, where the oath charges the ring),
  `ringTraining()`, and `explore()`. It saves a checkpoint (`this.checkpoint(id)`) before each
  step. Part Two's are `summons` → `summons()`, `voyage` → `flyToOa()`, `oa` → `targets()` (the
  landing and the drones), `livefire` → `liveFire()`, `sinestro` → `sinestroArrives()`, `duel` →
  `duel()`, `range` → `openRange()`, `earth` → `home()`.
  The free-roam steps never resolve; travel saves `range` or `earth` itself on arrival.
- `prepare(id)` rebuilds the world state a step expects when the game is resumed from it: which
  scene, where the player is, whether Hal is in bed, ring on, Abin dead, suit on, ring charge
  (12% at `lantern`), and `empower()` (constructs unlocked, HUD up, 100%) at `powers` and `free`;
  `pocketLantern()` at every checkpoint after the first charge.

**Adding a checkpoint** takes three changes:

1. An entry in the part's checkpoint list (`CHECKPOINTS` or `CORPS_CHECKPOINTS`); ids must be
   unique across parts.
2. A step in that part's `steps()`.
3. State setup in its `prepare()`.

Test it by loading `#<id>` directly.

**Restarting** a checkpoint is a page reload (`Save.resumeAfterReload(id)`), which is the
cleanest way to reset the scenes.

**Scenes are entered, not just built.** `setupCrash({ body })` / `setupOa()` build once; `enterCrash()`
/ `enterOa(at, yaw)` make the scene current: `show()`, `player.spawn()` (which first takes Hal out of
the previous world's physics), ground, sounds, `powers.attach()` (which first `detach()`es from the
last scene). Travel goes back and forth, so both scenes stay cached. `show()` also sets the
camera's near and far planes from `scene.userData` (Space needs a far of 6000).

**The lantern** (Story, shared): `this.lantern` is one object moved between scenes.
`placeLantern(sceneObj, spot)` stands it (with a small collider), `pocketLantern()` hides it
without an effect, `stowLantern()` / `summonLantern(spot)` play the rift (`fx/Rift.js`) with the ring
arm reaching out, `toggleLantern()` is the L key (summon needs ground in front of Hal; out of sight,
it is just recalled). `lanternSpots(sceneObj)` registers the two E interactions that follow
`this.lanternSpot`: recharge below 99.5%, put away when full. `lanternReady` is false until the
pocket-dimension beat after the oath (`learnPocket()`).

**Travel** (Corps): `this.travel` is `'oa'` during the summons (E jumps straight to the voyage) or
`'chart'` from the range on (E opens `StarMap`). `travelReady()` needs flight above
`JUMP_HEIGHT[world]` (Earth 26 m, Oa 30 m) and no drill. The override of `updateInteractions()`
shows the prompt and consumes the E press. `openChart()` sets `powers.freeze` (time stops, as with
the wheel). `travelTo(id)` → `voyage()` → `arriveOa()` / `arriveEarth()`, which spawn Hal flying
(`player.airborne(vel)`) and save the checkpoint. Charted worlds are `d.worlds` in the save
(`allWorlds()` merges parts); `WORLDS` in `ui/TravelHud.js` lists them with their chart positions.

**Dialogue and UI:**

- **Dialogue:** every line is in `lines.js` (`LINES[key] = { who, text, alien?, ... }`). Play
  lines with `this.say(key)` or `this.lines(k1, k2)`. `ui.say()` shows the subtitle, speaks it
  and waits for it to finish or be skipped.
  - `this.bark(key)` is for lines Hal says while the player has control: `skip: false`, so
    clicks and Space (which are construct and flight inputs then) don't cut them off.
  - `who: 'ring'` lines are the ring's readout: `this.ringSay(key)` types them under the
    objective and speaks them in the `ring` voice. Don't `await` them in training flow (the
    voice's time-based fallback can hold a step for several seconds).
  - `who: 'guardian'` (style `light`) is the Guardians speaking through the ring.
  - `ui.say({ onWord })` reports the voice's word boundaries (`Voice.speak(text, who, onWord)`);
    Kilowog's gestures are cued from them (see *Characters*).
- **Alien speech:** `toGlyphs()` in `UI.js` is a fixed letter-to-glyph cipher, so the "translation"
  is a literal decode (`ui.decode(english)`). `audio.alienVoice()` gives it a formant-buzz voice.
- **Interactables:** register them with
  `scene.interact({ position, radius, look, label, action })`. While the player has control,
  `updateInteractions()` picks the nearest one. Hal glances at its `look` point with weight 0.55,
  and E runs `action`.
- **Pause:** Esc or P, or losing pointer lock. The menu offers resume, restart checkpoint,
  chapters, voices on/off and quit to title.

### Save (`src/engine/Save.js`)

Each part has its own store, made by `createSave({ part, key, checkpoints, label, first })`:
`Save` (Part One, key `gl_awakening_v1`) and `CorpsSave` (Part Two, `gl_corps_v1`). Each is kept
in `localStorage` with a cookie mirror (1 year, SameSite=Lax) for when storage is blocked. Settings
(voices) always live in Part One's store. `allUnlocks()` merges both parts' `unlocks`, so
constructs learned anywhere carry over. The pending restart is `gl_resume` in sessionStorage.
`PARTS`, `partOf(id)` and `takeResume()` serve the title flow. A store's shape:

```js
{ version: 1, checkpoint, reached: [ids], settings: { voice }, stats: { fears }, unlocks: [construct ids], worlds: [world ids], savedAt }
```

`unlocks` and `worlds` were added without a version bump (`load()` fills missing fields from the
blank save). Part Two's `first` is now `summons` (it was `oa`); older Corps saves keep working.
Ring charge and health are not saved: each checkpoint sets them.

`load()` discards any save whose `version` isn't 1. **If you change the shape incompatibly, bump
the version**, and accept that old saves will reset, or write a migration.

`newGame()` keeps the unlocked chapters and settings. A later part gets its own `createSave`.

### Scenes (`src/scenes/`)

Every scene exposes `build()`, `update(dt, t, camera, renderer)` and `dispose()`, plus
`scene`, `physics` (its own Rapier world) and `interactables`.

- **`Bedroom.js`:** Hal's apartment hallway and bedroom.
  - Furniture, posters and the photo of Martin.
  - A rain window with a treeline outside, lightning, verlet curtains (`fx/Cloth.js`) and an alarm
    clock face.
  - Props that the light shoves with physics.
  - A blanket that is a height field draping over Hal's body.
  - `BED` holds the bed's bounds.
  - `buildJet()` is also used in the dream.
- **`Dream.js`:** the sepia airfield at sunset, from eight-year-old Hal's eye level. Martin waves
  (mocap idle plus arm IK), then the jet goes down.
- **`Hyperspace.js`:** the transit, styled after the 93604faf video. Light streaks stretch with
  `warp` (0 = points, 1 = full speed), with a starfield and nebula backdrop, green wisps and
  sparks, and a core burst at the vanishing point.
- **`CrashSite.js`:** the lake shore at night.
  - `terrainHeight(x, z)` gives the ground height; there are also rocks, grass, the crashed ship,
    hot debris, fires and lights reflected in the water.
  - The far shore is low wooded hills whose skyline is the tree line. There is also forest
    inland and at both ends of the bay.
  - `explode(center, strength)` fires a secondary blast; `spawnDebris(pos, { size, velocity })`
    throws a (hot) hull fragment as a physics body.
  - `bounds` holds the collider handles of the invisible walls (aiming and flight pass through
    them). `canLand(x, z)` says where Hal can stand. `inTrees(x, y, z)` is the forest as a
    solid block below the canopy (the trees have no colliders).
  - Exports `ABIN_SPOT`, `ABIN_YAW`, `LANTERN_SPOT`, `ARRIVAL` and `WATER_LEVEL`.
- **`Space.js`:** the flights between worlds (built once, `story.space`). `show('earth' | 'oa')`
  picks the place; Hal sits at the origin and the story moves the planet groups, not him.
  - Backdrop: stars at three scales, the galaxy's band with dust lanes, nebulae, and (for Oa) the
    galactic core's glow (`uCore`).
  - **Earth** (`EARTH`, radius 300, centre 362 below Hal): the continents come from
    `fx/EarthMap.js`, coarse [lon, lat] outlines from memory rasterised to a 2048×1024 mask, coasts
    roughened with 3D noise in the shader; biomes by latitude and noise, clouds, ocean glint, a
    twilight band, and city lights as noise specks over a blurred density map of real clusters.
    The globe is turned so North America (lon −104, lat 41) is under Hal with north ahead (−Z).
    The sun sits just under the far limb (night below, dawn ahead); the Moon lights Hal.
  - **Oa** (`OA`, radius 190, 760 ahead): a world-city, night side toward the approach: metal
    plates by day, winding arteries and specks of light by night, seven green conduits (great
    circles) meeting at the Central Battery's glow. A ringed giant upper left, half in shadow.
  - `atmosphere()` is a back-face shell glowing just off the limb, blue by day, orange at the
    terminator, flaring where the sun is behind the planet.
  - `drift` streams dust motes past Hal so speed reads against the stars.
- **`Oa.js`:** Kilowog's training range, a disc (radius `RANGE_RADIUS` = 42 m) floating far above
  Oa's city.
  - The deck is a canvas-textured slate: hex flagstones with faint lit inlays, rings, the Corps
    emblem, six spawn `PADS`. There are hex cover pillars (`blocks`), Kilowog's podium
    (`KILOWOG_SPOT`), pylons, and metal crates as dynamic bodies.
  - An invisible edge wall (`bounds`, ignored in flight). Every collider Hal walks on or against
    is a convex prism (`hullPrism`), never a Rapier cylinder (see Gotchas).
  - **The city** is four instanced tower kinds (setback, flared disc, crystal, dome) with a
    world-space window and light-band shader (`onBeforeCompile`), standing on a floor 230 m below.
    Most of it is below the range; the citadel's great towers ring the **Central Power Battery**,
    leaving a gap toward the range so none stands in front of its lens.
  - **The Central Power Battery** (`buildBattery`) follows the comics (*Green Lantern Corps*,
    *Rebirth* onward): the Corps' lantern on a colossal scale, its silhouette the emblem. A green
    metal globe, open front and back, holds a domed lens of light (a shader: white-hot core, slow
    swirl) in a layered bezel; a frame ring and C-shaped brackets brace its sides. Above are a
    neck, the wide cap (the emblem's top bar) and the handle ring; below, a conical collar on a
    wide slab (the bottom bar) and stepped octagonal tiers with lit seams down to the city floor.
    It is built in metres about the globe's centre (`BATTERY`, 577 m from the range), stands
    about 450 m from floor to ring, and its lens is turned to face the range. A green point light
    in front of the lens washes the citadel.
  - The sky (`buildSky`) draws a ringed gas giant analytically (it's beyond the far plane), with
    nebula and stars. Lanterns cross the sky as particle trails (`buildTraffic`).
  - `ground(x, z)`, `canLand(x, z)`, `interact()`.

### Drones (`src/enemies/Drones.js`)

`DroneSwarm` owns the training drones, their bolts and their effects. `swarm.spawn(pos, 'target' |
'attacker')`; `swarm.alive`; `swarm.update(dt, t)` (Part Two runs it from an Oa updater).

- **Model:** rigid hard-surface parts (lathed core, armour plates, red eye, thruster pods), built
  in code; `size` scales it (1.4, about 1.1 m across). No skinning, so nothing can tear.
- **Physics:** each drone is a dynamic Rapier ball with gravity off and rotations locked, flown by
  a damped spring toward the AI's target point. Construct hits knock it about and it recovers;
  it's "staggered" for a moment (weaker spring, wobble).
- **AI:** targets hover on their pad. Attackers circle Hal at their own radius and height
  (strafing, keeping out of the pillars and inside the arena), keep apart, and need line of sight.
- **Attack tokens:** at most two attack at once, the pacing trick action games use. An attack is
  a 0.75 s telegraph (the eye brightens, a red aim line, a charge tone), then a three-bolt burst
  aimed with lead.
- **Bolts:** instanced red streaks at 26 m/s, ray-cast each frame. They hit the shield (ripple,
  blocked), Hal (5 damage, less the suit's aura), walls and cover; near misses whiz.
- **Death:** the drone spirals down trailing smoke and sparks, then bursts: every part becomes its
  own physics body, and the parts fade after 9 s.
- `onHit`, `onKill` and `onPlayerHit` hooks (Kilowog's commentary uses the last two).

### Sinestro (`src/enemies/Sinestro.js`)

- **Out of the fight** he stands (mocap idle) with his hands clasped behind his back (his own
  `BodyLanguage` library, `GESTURES` / `STANCES` in his metres), talks with the ring hand, and
  plays the sword lesson (`demo()`).
- **In the fight** (`engage()`) he flies: a dynamic capsule with gravity off, steered by a damped
  spring (like the drones), so fists shove him and he recovers. He faces Hal, circles at about
  6.5 m, matches Hal's height when Hal flies, leans into his flight, keeps his left hand behind his
  back, and is a construct target (`tg`, 420 health).
- **Moves** (`think()` / `runAction()`): a **lunge** (the blade raised and flaring for 0.6 s, a dash,
  a cut; Hal's shield blocks it, a sword cut meeting it parries and staggers him for 1.2 s);
  a **volley** of five light spikes formed behind him and fired with lead (shield and walls stop
  them); a **guard** (a hex shield in front of his fist when four hits land within a second,
  turning frontal hits); and below 62% a **slam** (a ring marks the spot under Hal, then a giant
  fist comes down on it).
- At 35% he yields (`onYield`); `onQuip` and `onHurtHal` drive his lines.

### Ring powers (`src/powers/`, `src/ui/PowerHud.js`)

`Story` owns one `RingPowers` (`this.powers`) and one `PowerHud` (`this.hud`). `powers.attach()`
binds them to a scene (the crash site); `powers.update(dt, real)` runs right after the player.

- **State:** `charge` (0–100), `health`, `unlocked` (Set), `enabled = { hud, constructs, flight }`,
  `suited` (the uniform's aura takes 45% off damage), `hazards` (fire zones with a dps), `regen`
  (charge %/s near a power source; 1.5 on Oa).
- **Targets:** `addTarget` / `removeTarget` / `targetOf(body)`. Anything with `{ body, collider,
  position, radius, health, maxHealth, alive, hit() }` can be damaged by constructs:
  `dealDamage(target, amount, point, dir)` hits it, plays a tick and pops a damage number.
- **Aim assist:** for attack constructs, a live target within a few degrees of the reticle (wider
  for small, distant ones), in range and in clear view, takes the aim (`aim.target`). The HUD
  brackets the aimed or nearest target with its health bar.
- **The wheel** (`openWheel` / `updateWheel` / `choose`): `4` opens it and sets `timeScale` to 0,
  muffles audio and greens the grade. With the pointer locked, mouse motion drives a virtual
  cursor; otherwise the real cursor position is used. Click chooses; holding `4` and letting go
  also chooses; `4`, right-click or `Q` closes. Locked sectors shake and buzz.
  `CONSTRUCTS` in `Constructs.js` is the list, in wheel order, with cost, drain and range.
- **Aiming:** a ray from the camera through the reticle (`castRay` skipping Hal, invisible walls
  and held constructs; water counts as a surface), capped to the construct's range measured from
  Hal's chest. The scroll wheel caps the range. A hologram ghost shows where the construct will
  form (red when it can't: low charge, or no footing for a wall).
- **Constructs** (`FistStrike`, `HeldShield`, `WallConstruct` in `RingPowers.js`):
  - Fist: Hal's ring arm thrusts (fast IK, `rate`), the fist launches from the ring, sweeps
    debris along its path, strikes with hit-stop, shake, sparks and an impulse capped by mass
    (light things fly, heavy ones shift), recoils and dissolves. Range 2–14 m, 6% charge.
  - Shield: held while the button is down, in front of Hal's fist; a kinematic body, so debris
    bounces off it; `blocks(point)` stops damage from the front. 2% + 3%/s.
  - Wall: rises out of the ground as a kinematic body (it lifts what it comes up under), stands
    20 s, at most three. The player collides with it. 10%.
  - Fist and its blast damage targets: 40 along its path, 45 for a direct hit.
  - Gatling (`GatlingConstruct`, Part Two): held at Hal's right hip with both hands on it (arm IK
    to its grips), aimed at the aim point. Hold to spin the barrels up, then hitscan rounds at
    14/s with tracers (instanced streaks), sparks and 6 damage each. 1% to form, 0.12% a round.
    Hal moves slower while it's out (`player.moveScale`). It dissolves 1.4 s after you stop.
  - Sword (`SwordConstruct`, from Sinestro): forms in the ring hand on the first click and stays
    while armed (Hal strafes). Clicks in rhythm chain three cuts (`SWINGS`: forehand diagonal,
    backhand, an overhead chop that hits hardest), each a keyed hand path plus blade direction in
    Hal's frame, solved with the arm IK; the blade's edge leads the cut. The blade sweeps between
    frames (`cut()`), so targets take each cut once and fast cuts can't skip them; loose bodies
    are knocked aside. Aimed at a target 1.7–5 m away, the cut lunges at it (`player.dash`).
    3% to form, 0.8% a cut, 24 / 24 / 38 damage. `cutting` is true in a cut's hitting window
    (Sinestro's blade is parried then). The blade mesh and its short light trail are `Blade` in
    `Constructs.js`, shared with Sinestro.
  - While the shield or the gatling is up, `RingPowers.update` sets `player.strafe`: Hal faces
    where the camera looks and moves where the keys say (see *Player*). The constructs don't
    turn Hal themselves any more. Choosing another construct puts the held one away.
- **Look:** `constructMesh()` is a depth pre-pass, a translucent lit body (fresnel rim, flow
  noise, hex or brick lines, the lantern emblem) and an additive inverted-hull outline.
  `ghostMesh()` is the additive scan-line hologram. Formation and dissolve sweep through noise
  (`uForm`). Keep values under about 1.5: brighter and the bloom turns them into blobs.
- **HUD** (`PowerHud`): vitals bottom-left (health with the trailing damage chunk), ring charge
  and the armed construct bottom-right (layout from the 6bbb1091 combat video), the ring's
  readout under the objective, reticle, a world marker, the training panel (`kicker` names the
  drill), the target bracket, damage numbers (rapid hits on one target add up into one number),
  and the wheel.
- `attach()` also takes `floor(x, z)` and `ceiling` for flight (Oa's floor drops to −60 off the
  deck; the default treats low ground as water). It first calls `detach()`, which clears the old
  scene's constructs, hazards, targets and effect layers and resets `timeScale` and the grade.
- `powers.freeze` stops time like the wheel does (the star chart).
- `hud.boss(name, frac, yieldAt)` shows an opponent's health across the top (Sinestro), with a
  mark where the fight ends.
  `ringhud.force` keeps the charge visible during cutscenes (the oath, recharging).
- **Flight effects:** charge drain (0.12%/s, more boosting), a green aura light, light trails off
  the ring fist and boots, airflow sound, takeoff and landing shockwaves.
- **Lantern:** `Story.addRecharge()` adds "Recharge the ring" (enabled under 100%).
- **Health:** fire zones and the training's core breach do damage; it regenerates after 4 s.
  At 0, `Story.collapse()` shows a card and restarts the checkpoint.

### Effects (`src/fx/`)

- **`Trees.js`:**
  - `conifer()` builds stacked, drooping, jagged branch tiers, tilted and offset.
  - `broadleaf()` builds a clumped crown.
  - `foliageMaterial(time)` sways in the wind through an `onBeforeCompile` vertex patch, phased
    per instance.
  - `forest()` returns an InstancedMesh with per-instance tint.
  - `treeKit()` provides near, mid, far and leaf variants.
  - Scenes must update the shared `time` uniform.
- **`Water.js`:** procedural ripples, sky fresnel, moon glint, and streaky reflections of up to 6
  point lights passed in as uniforms. Light intensity is clamped to 2.0 so fires don't blow it out.
- **`Sky.js`:** sky dome presets.
- **`Particles.js`:** CPU point sprites with drag, gravity and turbulence. `Fire` is built on it.
- **`GreenLight.js`:** the orb (core, halos, rays, sparks), the fresnel bubble that carries Hal,
  and additive light shafts.
- **`Cloth.js`:** verlet cloth for the curtains.
- **`Textures.js`:** canvas textures (noise, wood, fabric, glow), the clock face and the photo.

### Physics (`src/engine/Physics.js`)

Each scene has one Rapier world. The helpers are `fixedBox`, `fixedCollider`, `fixedTrimesh`,
`dynamic`, `dynamicBox`, `burst(center, strength, radius, lift, spin)` (the light bursting in, or
explosions) and `setGravityScale`.

Dynamic bodies are paired with meshes and synced after each `step(dt)`. The player is a Rapier
**kinematic character controller**, and the camera uses a raycast so it doesn't clip through
walls.

---

## Characters and animation

The main recent effort went here, and the user cares about it most.

### Asset pipeline (`tools/build-assets.mjs`, `tools/autorig.mjs`)

`readScan` processes each raw scan:

1. Decode the meshopt compression.
2. Reorient so the model is Y-up, faces +Z and has its feet at y = 0, then scale it to `height`.
3. Weld, then simplify to `tris` (with LockBorder).
4. **Auto-rig** it.
5. Compress textures to WebP, prune, and write the result to `public/models/<name>.glb`.

Multi-primitive meshes are supported: all primitives are rigged together and each gets a skin.

**Per-model rig overrides:** a `MODELS` entry may carry `rig: { … }`, passed to `autoRig` and
merged over `RIG_DEFAULTS` in `autorig.mjs` (the defaults are the original constants, so the
other models build byte-identically). Kilowog uses it: fixed neck, jaw-line, shoulder, hip and
knee landmarks, a thicker arm radius, a head fill limited to surface connected to the face, and a
"neck column" that keeps the armour collar on the chest. `keepSide` picks one figure from a
two-figure sheet.

**`autoRig(pos, idx, H)`** builds a 17-bone humanoid. The bones are `BONE_ORDER` in
`src/characters/Rig.js`: `hips`, `spine`, `chest`, `neck`, `head`, then upper arm, forearm and
hand on each side (`upperArm_L/R`, `foreArm_L/R`, `hand_L/R`), then thigh, shin and foot on each
side (`thigh_L/R`, `shin_L/R`, `foot_L/R`).

- **Joints** are placed from anatomical landmarks measured on the mesh.
- **Weights** come from distance to the limb chains, with a smoothstep partition across joints,
  then Laplacian smoothing over the surface, then the 4 strongest influences are kept.
- **Jaw-line override** (the fix for the "sideways face"):
  1. Find the nose tip from the front profile.
  2. Walk down past the lips and chin until the profile falls well behind the nose. That point
     is the chin.
  3. Every vertex above a jaw line sloping from the chin back to the neck goes to the **head**
     bone.
  - Without this, the mouth and chin were weighted to the neck, so head turns tore the face.
  - The landmarks returned include `chinY`, which is about 1.56 for both Hals and 1.67 for Abin.
- **Check weights after any rig change:**

  ```bash
  node tools/inspect-weights.mjs public/models/hal_casual.glb out.png
  ```

  The face and jaw must be solid red (head). Blue is neck, green is chest.

Other debug tools, all software rasterised with no browser needed:

- `tools/debug-render.mjs`: front, side, back and three-quarter views, optionally skinned.
- `inspect-model.mjs`: textured renders of the primitives.
- `inspect-heads.mjs`: raw scan face close-ups.
- `preview.mjs`: point-splat axis views.

`tools/headswap.mjs` transplanted the suit scan's head onto the old casual scan. **It is unused
now** and kept only for reference.

### Rig and Animator (`src/characters/Rig.js`)

`Rig` wraps a skeleton. It drives two kinds of pose:

- **Parameter poses:** `apply(param)` takes flat Euler parameters from `Poses.js` and aims each
  arm by direction, so it works on both T-pose and A-pose scans.
- **Quaternion poses:** `applyQ(QPose)` and `capture(QPose)`, used for mocap.

It also provides `bonePosition(name)`, `hipsHeight`, `legLength`, `restDir`, and `u` (the shared
material uniforms).

`Animator` crossfades between generators in quaternion space (slerp). A generator is either a
function `(out, t, dt) => param` or an object with `sample(outQPose, rig)` and optionally
`update(dt)`.

`addRig(rig)` lets several rigs follow one animator. Both bodies do this during the
transformation.

Layers are applied every frame, in this order:

1. **Breathing**, when `animator.breath` is set. The mocap already breathes.
2. **Momentum lean:** `animator.lean.pitch` and `.roll`, spread over the spine and chest.
3. **Gestures:** `gesture('nod' | 'shake', duration, amount)`.
4. **Look-at:** `lookAt(target | fn, weight)`. It is split 50/50 between neck and head, limited
   to `maxYaw` 0.85, and eased in and out (damping 4). **Keep it gentle**, because hard head
   turns expose skinning artefacts.
5. **Arm IK:** `reach('L' | 'R', target | fn, { weight, pole, keepHand, rate })`, an analytic
   two-bone solve with a pole vector (`src/characters/IK.js`). `rate` is the blend speed (18 for
   a punch). Pass `null` to release: the arm eases out toward its last target.
6. **Foot IK:** `animator.feet.ground = (x, z) => height`. It lowers the hips for the lower foot
   and bends the other knee.

`animator.armSpread` (radians) swings both upper arms out from the body before the IK layers.
Kilowog uses 0.17 so his hands clear his thigh armour.

`animator.lean.yaw` turns the chest (spine and chest, about the body's up axis) for gestures that
follow a hand. Head gestures are `nod`, `shake`, `beat` (one dip, for emphasis), `chin` (a lift)
and `tilt` (negative amount tilts the other way).

`animator.twist` (radians, after the lean) turns the hips toward the direction of travel while
strafing; the spine and chest turn back by the same amount (55/45), so the legs step toward the
travel and the chest stays square to the aim. This is the upper/lower body split of older
third-person shooters, used because the mocap has no strafe clips.

`Poses.js` holds the cutscene parameter poses: lying, on his side, sitting on the bed edge,
shielding his eyes, floating, carried head-first, reaching, fist raised, and Abin slumped.

### Mocap retargeting (`src/characters/Mocap.js`)

- `MocapSource(gltf)` holds the Xbot skeleton and clips: idle, walk, run, sad_pose, sneak_pose,
  agree and headShake. It measures their gait.
- `MocapInstance.retarget(out, rig)` maps the clips onto each scan's own skeleton:
  - For every bone it computes the world rotation delta from rest, `D = Q(t)·Q0⁻¹`.
  - For limbs it multiplies in a fixed correction,
    `C = setFromUnitVectors(ourRestDir, srcRestDir)`. That is how T-pose and A-pose rigs both
    work.
  - Local rotation is `parentW⁻¹·W`.
  - The hips offset is scaled by the ratio of hips heights.
- `MAP` translates our bone names to Mixamo names. **GLTFLoader strips the `:`**, so names look
  like `mixamorigHips`.
- `Locomotion` handles walking and running:
  - It blends idle, walk and run by ground speed.
  - Gait phase advances with distance travelled, so the feet don't slide. `direction = -1`
    plays it backwards (backing off while strafing); footsteps fire in either direction.
  - `onStep` fires on foot contact (for footstep sounds).
  - A "tired" posture is layered on top.
  - Measured clip speeds: walk 1.55 m/s (0.967 s cycle), run 3.36 m/s (0.70 s cycle). Xbot's hips
    are at 1.04 m, and `scale = rig.hipsHeight / 1.04`.
- `MocapClip(source, name)` is a single looping clip, used for the dad's idle.

### Player (`src/characters/Player.js`)

Third-person controller with momentum (ground) and flight:

- **Acceleration:** 3.2–5.5 m/s² (higher toward run speed). Deceleration is 7 m/s².
- **Turning:** the turn rate falls from 11 to 4.5 rad/s as speed rises, and Hal brakes going into
  sharp turns.
- **Lean:** forward lean comes from acceleration and speed, and he banks into turns.
- **Speeds:** walking is about 1.26 m/s and running about 2.78 m/s for Hal.
  - The tiredness multipliers are `walkSpeed × (1 − 0.22·tired)` and
    `runSpeed × (1 − 0.15·tired)`, both times `speedScale`.
- **Camera:** an orbit camera with collision, set by `camDist`, `camYaw`, `camPitch` and
  `shoulder`. In flight it pulls back, rides higher at speed, and the FOV widens. The collision
  ray (`camFilter`) only dodges fixed and kinematic bodies: drones, debris and crates are ignored,
  or one passing behind Hal snapped the camera into his head.
- **Strafing** (`player.strafe`, set while the shield or gatling is up): on the ground the travel
  direction (`heading`) is separate from the facing (`yaw`). Hal turns to face where the camera
  looks, travels where the keys point (camera-relative, same acceleration limits, 30% slower
  backing off), the gait runs backwards when he backs off (with hysteresis), and `animator.twist`
  turns his legs toward the travel. In flight he faces the camera and hovers upright (no
  head-first pose), pitching and banking a little toward the way he drifts. Without strafe,
  `heading` always equals `yaw`. Before this, the shield's `turnTo(camera)` fought the
  controller: S turned Hal around, the shield turned him back, and he crept forward.
- **Rig mounting:** rigs hang under `player.pivot` (1 m up) so the body can pitch and bank about
  its centre. Use `player.mount(rig)`, not `player.object.add(rig.root)`.
- **Flight** (`takeOff`, `stopFlying`, `updateFlight`): double-tap Space (`input.doubleTap`).
  Velocity with limited acceleration toward a wanted velocity (W flies where the camera looks,
  Space climbs, C descends, Shift boosts: 7.5 / 19 m/s). The body faces its velocity, pitches its
  long axis toward it and banks into turns; the flight pose blends hover into flat-out flying
  (`flight()` in `Poses.js`). Kept above ground and water (`air.floor`), out of the forest
  (`air.solid`), inside a radius. Touching landable ground while descending lands; double-tap
  drops (refused over water). A fall faster than 9 m/s ends in the kneeling hard landing.
  The invisible shore walls are ignored while airborne.
- `player.spawn()` removes Hal from the previous world's physics first (skipped if that world was
  freed), so moving between scenes leaves no stale capsule behind. `player.airborne(vel)` starts
  him flying without a takeoff (arriving from space).
- `player.ignore` is a Set of collider handles the controller and camera pass through (the held
  shield). `player.inputBlocked` is set while the wheel has the mouse. `player.moveScale` slows
  him while he fires a held construct.

Scripted movement uses `walkTo(target, speed)` (with stuck detection), `turnTo(yaw)` and
`lookAt(target, weight)`.

**`walkTo` does nothing while `player.control` is true.** The player starts without control,
`giveControl(objective)` hands it over, and cutscenes call `takeControl()` before scripted moves.
`player.ground` feeds the foot IK; it is `() => 0` in the bedroom and `terrainHeight` at the
crash site. `player.surface` picks the footstep sound.

### Characters (`src/characters/Characters.js`)

- `loadCharacters()` returns `{ casual, lantern, abin, mocap }`. Tripo packs ambient occlusion
  into the red channel of its ORM texture, so the loader reuses `metalnessMap` as `aoMap`.
- `createHal(gltf, { roughMin })` and `createAbinSur(gltf)` (glow 0.32) clone a scan with its own
  skeleton.
- `makeUniforms` gives all of a character's meshes one shared set of material uniforms:
  - `glow` for the suit panels
  - a sweep **dissolve** for the transformation
  - a tint
  - `hideBone`
  - `roughMin`, a roughness floor. Casual Hal uses 0.62 so his skin doesn't look like wax.
- `createKilowog(gltf)` (glow 0.6: his eyes and emblem are green in the texture).
- `createSinestro(abinGltf)`: Sinestro derived from Abin Sur's scan, matched facially to a comic
  reference the user chose. A shader layer over `patchMaterial`, worked in the bind pose's object
  space from the scan's front profile (chin 1.665, mouth 1.72, nose 1.75–1.79, brow ridge 1.83,
  crown 1.96): coral-red skin (everything on the head that isn't uniform, plus the pink of the
  hands), more orange up the forehead, hollow cheeks; black hair slicked back from a sharp widow's
  peak with receded temples, given volume by pushing the scalp out radially (fuller at the crown
  and back) and combed grooves in the normal so its sheen streaks along the strands (front to back
  on top and sides, down the back to the nape), with the scan's scalp normal, AO and metalness
  maps switched off under it; heavy brows slanting down to the nose with frown creases; glowing
  yellow irises with dark pupils, a lash line and cleaner sockets painted into the scan's narrow
  eye slits; a thin moustache drooping at the corners. The vertex stage also narrows the head 8%
  and the nose 28%. Uniform a shade darker than Abin Sur's. `rig.su` holds every value
  (tunable live in the browser).
- **Kilowog's body language** (`characters/BodyLanguage.js`, driven from `Corps.addKilowog`), the
  usual conversation-system approach: a library of short hand gestures (`chest`, `fist`, `pump`,
  `open`, `shrug`, `sweep`, `beckon`, `dismiss`, `temple`) keyed in his body frame and solved with
  the arm IK; `pointAt(target)` with the arm on the target's side; a resting stance (`hips`: fists
  on hips) the hands return to; head beats while he talks; idle fidgets (tilts, glances, stance
  changes). `Corps.kwSay(key, cues)` cues gestures to words of a line (from the voice's word
  boundaries, or a 14 chars/s pace without voice). He now plays a `Locomotion` and turns to face
  Hal with shuffling steps past about 35° (`kwTurn`). His arms are short for his bulk (0.69 m from
  shoulder to wrist): hands can't meet in front of his belly, so there is no clasp or palm-pound.
  He has no face bones, so his "expression" is the head and body.
- `createRing()` and `createLantern()` are procedural.
- `loadCharacters()` loads `kilowog.glb` optionally (null if it's missing; Part Two then stands a
  broadened Abin Sur in for him).
- Story helpers: `attachRing(ring, rig)` puts the ring on a hand bone, and `putOnSuit()` and
  `transform()` swap between the casual and suit rigs.

---

## Testing in the browser (for agents)

The checks that have worked:

1. **Run your own dev server on 5180** from Bash, in the background. The user's server is on 5173;
   leave it alone.

   ```bash
   SHOT_DIR=<your scratchpad>/shots node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort
   ```

   Then attach the browser pane with the url-only config **`lantern-attach`** from
   `.claude/launch.json`. Starting the server through `preview_start` with a command hung in
   "starting".
2. **Size the viewport first.** A collapsed or hidden pane gives a 0×0 canvas and throttled frames.
   Use `resize_window` at 1024×640, and set it back to `desktop` when you're done.
3. **Jump to a checkpoint** with a URL hash, for example `http://127.0.0.1:5180/#question`, then
   click Continue.
4. **Step deterministically and capture.** In the page:

   ```js
   await __game.shot('name', seconds)
   ```

   This advances the game by `seconds` in fixed steps, then POSTs a canvas capture to the
   dev-only `/__shot` middleware in `vite.config.js`. The capture is saved as
   `$SHOT_DIR/name.png`; read it with the Read tool. This is more reliable than pane screenshots,
   which go stale when the page is throttled.
5. **Poke at state** through `window.__game`: `engine`, `story`, `ui` and `input`. Examples:
   - `__game.story.player.control = false` before scripted `walkTo`s
   - `__game.engine.advance(2)`
   - `__game.story.hal.bonePosition('head')`
   - `__game.story.powers.choose(0)` arms a construct (wheel order); `__game.story.voice.enabled
     = false` stops voice lines from holding steps up
   - synthetic input works: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' }))`
     (and `keyup`), `renderer.domElement.dispatchEvent(new MouseEvent('mousedown', { button: 0,
     bubbles: true }))` then a window `mouseup`. Two `Space` keydowns within 300 ms fly.
   - The canvas capture has no HUD (it's DOM): use a pane screenshot for the HUD.
   - Part Two: `__game.story.travelTo('earth' | 'oa')` from `#range` or `#earth` runs a trip;
     `__game.story.kw.play('chest')` / `.pointAt(v)` plays one of Kilowog's gestures.
6. **Check faces in close-up** for anything that touches skinning, look-at or poses. Also check
   the moments the user will look at: the keys table, sitting up facing the light, Abin's hand,
   and the ring on the finger.
7. Run `npm run build` at the end. It must be clean.
8. **Clean up:** stop your 5180 server and reset the viewport. **Exception:** the user sometimes
   plays in the browser pane on your server while you work (you'll see keys held and Hal moving
   on his own). Don't drive their tab: open your own with `tabs_create`, drive it with
   `engine.advance()` (works while it's in the background), and leave the server up if they're
   still playing. Every source edit makes Vite reload all tabs, theirs included.

## Gotchas (learned the hard way)

- **One key press can be read twice.** The E that opened the star chart was still in `pressed` when
  the chart updated the same frame, so it confirmed a destination at once. `input.consume()` a key
  when it opens another interface.
- **Disposing a scene disposes whatever is in it.** `Hyperspace.dispose()` traverses the scene: take
  Hal (`player.object`) out first.
- **Background browser tabs pause CSS animations**, so a DOM overlay with a fade-in looks nearly
  invisible in a pane screenshot of a background tab. Set `animation: none` on it to inspect.
- **A right arm pointing across the body reads as a fist at the chin.** Point with the arm on the
  target's side (`BodyLanguage.pointAt`).
- **Bloom turns bright stars into blobs.** Keep star values under about 1 in the space backdrops.
- **Pushing a scan's vertices along their normals opens cracks** at its UV seams (duplicated
  vertices, different normals). Push along a direction that depends on position only (Sinestro's
  hair goes out from the skull's centre).
- **Paint over a scan in its bind-pose object space** (`vDPos`), not world space: painted features
  then follow skinning and any vertex-stage reshaping (Sinestro's narrowed face) for free. Find the
  landmarks from the mesh's front profile, then confirm each with a deliberately thick debug band:
  brows placed 1.5 cm too low vanished into the eye sockets' shadow.
- **Painting hair onto a bald scan exposes the scan's own scalp maps** (normal-map seams as
  stitches, AO): switch them off under the hair.
- **Construct trails need short histories.** Half a second of the sword's path drew opaque white
  sheets; a tenth of a second reads as a swoosh.

- **Rapier's character controller sinks into cylinder colliders.** On Oa's deck (a 43 m
  cylinder) Hal's capsule rested 0.33 m inside it; the foot IK then pulled his feet up to the
  deck and he stood with his knees bent at 99°. Use convex hulls (`hullPrism` in `Oa.js`) or
  boxes for anything walked on.
- **A held construct must not steer the facing with `turnTo`** while the controller moves Hal
  along his facing: the two fight (S did nothing but creep forward). Use `player.strafe`.
- **The camera's collision ray must ignore dynamic bodies.** Drones circling behind Hal pulled the
  camera into his head, so in a fight you could see nothing.

- **An `onBeforeCompile` patch that reads `instanceMatrix` breaks plain meshes** sharing the
  material: the shader fails to compile (they vanish). Wrap it in `#ifdef USE_INSTANCING`.
- **Non-uniform instance scale stretches round parts.** A dome on a tower scaled (w, 7w, w)
  became a tall pale bullet. Model caps already flattened for the usual aspect.
- **Lit windows average into a tint at distance.** Dense green windows made whole towers read
  mint. Keep windows sparse; let a few light bands carry the colour.
- **Additive particle trails are metres wide.** A Lantern flyer dipping through the range drew a
  pale band across the deck. Keep sky traffic high and clear of the play space.
- **The browser pane keeps console messages across reloads**, so old shader errors show up after a
  fix. Check the source line quoted in the error before chasing it.
- **Negative frame time.** `THREE.Timer.getDelta()` can come back negative when its clock and
  the frame timestamps disagree (seen after test stepping; visibility changes can do it too).
  One negative step turned flight velocity and yaw into NaN for good. The engine clamps `dt` at 0.
- **Translucent constructs need the depth pre-pass.** Without it the inner parts (tucked
  fingers, the palm behind the knuckles) stack up through the glass into a white blob.
- **Aim and camera rays must skip the invisible walls** (`site.bounds`), or aiming at the lake
  lands constructs on an invisible wall at the shore.
- **The trees have no colliders.** Flight treats the forest as solid below the canopy
  (`inTrees`); anything else that moves through the forest needs the same.
- **Viewed from directly behind, a flying body is a dark sliver.** The flight camera rides
  higher at speed to see Hal's back.
- **A shared scratch object corrupted IK.** `rotateBoneWorld` once wrote into the caller's
  temporary quaternion, which damped the mocap thigh swing from 34° to 2°. Helpers that callers
  pass temporaries into need their own scratch objects (`_rw` in `IK.js`).
- **`mergeGeometries` returns `null`** if the parts don't have identical attribute sets. The
  render loop then throws "reading 'id'" forever. `Trees.js#merge()` strips everything except
  position, normal and colour first.
- **Sheared or torn faces** come from head and neck weights, not from the model. See the jaw-line
  override above. Keep look-at limits gentle.
- **One NaN pixel** turns into black blocks after bloom. The NaN guard pass handles that; also
  watch for NaNs from normalising zero vectors.
- **Audio** can only start after a user gesture: `audio.init()` runs after the title click.
  `speechSynthesis` may stay silent, so `Voice.speak` has a time-based fallback.
- **Pointer lock:** pressing Esc releases the lock, which pauses the game (`input.onLockLost`).
  When the game releases the lock itself, it sets `input.releasing` so that doesn't count as a
  pause.
- **Rebuilt models** need a hard refresh in the user's open tab.
- **Head-swap hue detection** (in the unused `headswap.mjs`): bright, warm skin passed the eyeball
  test and got eyes painted on the forehead. Classify by hue, not brightness.

## Status

Verified by playing in the browser:

- (2026-11-09, Sinestro) the model reviewed with the user through six passes in close-up (front,
  three-quarter, profile, back, eyes), matched facially to their reference; his arrival (the
  streak in, the landing, hands behind his back, his lines and gestures, the sword demo); the
  sword: forming, the three-cut combo on keyed paths, damage 24/24/38 on Sinestro, the trail; the
  sword lesson's drones; the sparring: the lunge (telegraph, dash, cut, damage), the volley, the
  guard turning a frontal hit, the slam (mark, fist, damage), the parry stagger, yielding at 35%,
  the ending lines and his departure, through to `range`; no console errors; a clean `vite build`.
  Synthetic input; Hal never fought him with a real mouse.

- (2026-11-09, pocket dimension, voyage, travel, Kilowog) in fixed-step captures with synthetic
  input: the pocket-dimension beat after the oath (L stows the lantern through the rift); summoning
  it on the crash site and on Earth after travel; E at the lantern ("Put the lantern away" when
  full); the summons at the lake (shots, ring raised to the eyes, the Guardians' lines); flying up
  and E; the whole first voyage (launch, Earth from orbit with city lights, the ring plotting the
  course, hyperspace from behind and alongside, Oa's approach, the dive) into the landing in front
  of Kilowog and his intro; resuming at `voyage` (starts in orbit) and at `earth`; the open range,
  the star chart, Oa → Earth (Abin Sur's body gone, the ring's line, `earth` saved) and Earth → Oa
  (`range` saved, "Back already, poozer?"); Kilowog's gestures in close-up (chest, fist, shrug,
  temple, sweep, beckon, open, dismiss, pointing left and right), his fists-on-hips stance and his
  turn to face Hal; the live-fire intro into the drill; no console errors; a clean `vite build`.

- (2026-11-09, fixes) Hal stands at deck height on Oa (hips at rest height, knees about 10°);
  with the shield or gatling up, S backs him off and A/D side-step while he faces the camera
  (shield and gatling, on Oa and at the crash site); flying with the gatling he stays upright and
  faces the camera through more than a full turn while firing; a drone between Hal and the camera
  no longer pulls the camera in; the new Central Battery from the deck, in the arrival shot, from
  above and up close. Normal walking (S turns Hal around) is unchanged. Synthetic input only.

- mocap walk and run with full strides
- foot IK on the crash-site terrain
- the bedroom interactions, with no face tearing at the keys table
- the shield-eyes wake-up and the hands-on-knees seated pose
- the Abin Sur meeting: hand offered, ring reached for, ring examined
- the transformation, using both rigs and the lantern-reach IK
- the forest skyline
- checkpoint save and reload, Continue, Chapters, and the pause menu
- a clean `vite build`

- (2026-11-09) the ring HUD at 12% before the oath, the oath charging 12 → 100% line by line
- (2026-11-09) the construct wheel (time stop, locked sectors, click, hold-and-release, Esc into
  pause), the fist (aim ghost, strike, debris thrown), the held shield blocking the core breach,
  walls (no footing over water), the training from start to end card, lantern recharge, fire
  damage and the collapse card, flight (hover, cruise, boost, forest wall, soft and hard landing)
- (2026-11-09) the bedroom chapters still play after the player rig moved under a pivot
- (2026-11-09, Part Two) the title flow and per-part saves; Oa's range, city and battery from the
  deck, from above and in the establishing shot; Kilowog's model in close-up (idle, arms set out,
  pointing) and in both dialogue cameras. The intro played through.
  - Targets drill: fist strikes with aim assist, knockback, the one-punch kill.
  - Live fire: the gatling forming, aiming and firing; tracers, damage numbers, the target
    bracket; drones' strafing, tokens, telegraph, bolts and breakup; the shield blocking bolts;
    death to unblocked fire.
  - Both waves through to the end card; the open range's "another round"; Part One still runs.
  - All of it with synthetic input and fixed-step captures. The user also played it in the pane
    and reported "all working".

Not verified:

- audio and voices (never listened to), including every new power sound and the ring voice
- the wheel's virtual cursor with a real pointer-locked mouse (tested with synthetic events)
- a single uninterrupted start-to-finish playthrough
- the dad's wave IK in the dream
- frame rate with several walls, the fist and flight trails at once, and with 5 drones on Oa
- Kilowog walking or running (he only idles, gestures and shuffles round to face Hal); his rig's
  shoulder pads bend at big arm angles (see the helper's notes in the change log; the raised-fist
  and temple gestures are the largest)
- strafing with a real pointer-locked mouse, and how the side-step reads at full speed (the legs
  turn at most 60°, so a pure side-step slides the feet a little)
- the star chart's virtual cursor with a real pointer-locked mouse (tested with keyboard and
  synthetic events), and the new sounds (rift, sonic boom, arrival)
- Kilowog's gesture timing against real speech (cues follow the voice's word boundaries where the
  browser reports them; tested with the voice off, on the 14 chars/s pace)
- the Part One end card's "Part Two" button into `summons` after a full Part One playthrough
- frame rate in the Space scene (two 192×96 spheres with heavy fragment shaders)
- the sparring's balance and feel with a real player (health, damage, timing of his moves); the
  camera keeping him in view; the lunge (`player.dash`) on uneven ground or into a wall
- the sword in flight, and Sinestro's flight pose at speed (he mostly hovers)
- the Sinestro sounds and voice (never heard)

## Open items and ideas

- **Roadmap (agreed 2026-11-09): Oa first, then Coast City.** Proposed, not yet built:
  - Part Two, "The Corps": Hal buries Abin Sur (as in *Secret Origin* #31) and finds the empty
    prisoner tank (Abin Sur was transporting Atrocitus); the ring summons him to Oa (space trip
    in the 93604faf "orbital approach" style); Kilowog's boot camp, whose drills unlock the
    locked constructs and introduce combat (drones, lock-on, damage numbers); Sinestro as
    training officer, with a sparring duel; the Guardians; news of trouble in Sector 2814.
  - Part Three, Coast City: the neon night city and Manhunters of the 6bbb1091 video (the
    Guardians' rogue androids, who massacred Sector 666, Atrocitus's home), with Atrocitus behind
    it.
  - Models: Manhunters and drones procedural (rigid parts, no skinning); Sinestro derived from
    the suit scan and a Guardian from Abin's, both to be judged in close-up; Kilowog most likely
    needs a Tripo model (non-human head and build).
  - Each part gets its own save section or key (see *Save*), carrying `unlocks` over.
- **Next for Part Two** (the plan the user said to go ahead with, 2026-11-09): Sinestro is done;
  next the Guardians (a Guardian derived from Abin Sur's scan, judged in close-up with the user;
  Abin Sur laid to rest on Oa; Hal sworn in); then a mission that charts Korugar or Ysmault on the
  star map and unlocks a construct; then Part Three, Coast City. Earlier ideas still open: burying
  Abin Sur at the lake, the empty prisoner tank (Atrocitus).
- Sinestro's front view could still improve (the user's note); his face shape is Abin Sur's skull
  narrowed, his hair is painted volume with no loose strands, and a faint seam can show on the
  crown in extreme close-up.
- The staff, hammer and axe have wheel slots but no geometry or behaviour.
- Travel trips are cutscenes of about 12 s every time; a skip (or a shorter repeat) may be wanted.
- Earth's continents are coarse hand-made outlines; a NASA Blue Marble / Black Marble texture
  would be far better but needs a download (ask first).
- Kilowog has no face bones: a jaw bone in the auto-rig would allow speech; lip sync stays optional.
- The voyage's Hal is the suit rig in parameter poses (hover, flyFast); no cape or secondary motion.
- Unlocking constructs is `powers.unlocked` plus the part's `unlocks`.
- Oa's city is primitives with a window shader: fine from the range, plain up close (flying low
  among the towers). Sky bridges, greebles or a real model kit would lift it.
- Seen from behind (the usual camera), the fist reads as a rounded block in flight; it reads as a
  fist on impact and from the side.
- Hal's hands are open in every pose (the scans have no finger bones).
- Lip sync and hair simulation were deliberately skipped.
- `public/anims/soldier.glb` is built but unused. It could supply extra clips.

## Code map

```
index.html, src/style.css   UI layers (letterbox, HUD, subtitle, choice, cards, pause, checkpoint, loading)
src/main.js                 boot, loading, title / continue / chapters, window.__game
src/engine/                 Engine (renderer + post), Input, Physics (Rapier), CameraDirector
                            (follow / shot / orbit / shake), Time (game-time waits + tweens),
                            Audio (WebAudio synth), Voice (speech), Save (checkpoints)
src/characters/             Rig + Animator, IK, Mocap, Poses, Player (walk + flight), Characters,
                            BodyLanguage (Kilowog's talking gestures)
src/powers/                 RingPowers (charge, health, wheel, aim, constructs incl. the sword, flight fx),
                            Constructs (list, shaders, fist / shield / wall / gatling / sword geometry, Blade)
src/scenes/                 Bedroom (+ hallway, buildJet), Dream, Hyperspace, CrashSite, Oa (Part Two),
                            Space (Earth and Oa from orbit)
src/enemies/                Drones (training drones: model, spring flight, AI, bolts, breakup), Sinestro
                            (the sparring opponent: flight, blade, spikes, guard, slam)
src/fx/                     Sky, Particles + Fire, Water, Trees, GreenLight, Cloth, Textures, Rift
                            (pocket dimension), EarthMap (continent outlines, city-light density)
src/story/                  Story (Part One + shared plumbing, the lantern), Corps (Part Two, travel),
                            Voyage (flights between worlds), lines (all dialogue)
src/ui/UI.js                HUD, subtitles, glyph cipher + decode, choice, cards, pause, toasts
src/ui/PowerHud.js          vitals, ring charge, armed construct, ring readout, reticle, marker,
                            training panel, target bracket, damage numbers, construct wheel
src/ui/TravelHud.js         flight readout, arrival card, StarMap (the ring's star chart), WORLDS
tools/                      build-assets, autorig, strip-mocap, extract-posters, debug renderers
public/models, public/anims built GLBs loaded at runtime; public/textures/posters
```

---

## Change log

Newest first. Add an entry for every decent update (see the top of this file).

### 2026-11-09: Sinestro, the sword and the sparring duel
- **Sinestro's model** (`createSinestro` in `Characters.js`): derived from Abin Sur's scan with a
  shader layer, reviewed with the user pass by pass (they asked to be shown every iteration) and
  matched to the comic reference they sent, facially only. Passes: crimson skin, painted hair and
  brows; hair volume and combed grooves; eyes painted into the slits; the reference's colours,
  yellow eyes, scowl and moustache; a narrower face; a thinner nose. See *Characters*.
- **The sword** (`SwordConstruct` in `RingPowers.js`, `swordGeometry` and `Blade` in
  `Constructs.js`, `player.dash`, sword sounds in `Audio.js`). See *Ring powers*.
- **Sinestro the opponent** (`enemies/Sinestro.js`, new), a boss bar (`hud.boss`), and
  `BodyLanguage` taking another character's library (`gestures`, `stances`, `scale`, `hold()`,
  one-handed stances).
- **Story:** checkpoints `sinestro` and `duel` between `livefire` and `range`; his lines and a
  `sinestro` voice; the range's end card now follows the sparring.
- Verified: see Status (2026-11-09, Sinestro). Not verified: a real player fighting him, sounds.

### 2026-11-09: the pocket dimension, the flight to Oa, travel, Kilowog's body language
- **Pocket dimension** (`Story.js` lantern section, `fx/Rift.js`, new): after the oath the ring shows
  Hal how to keep the lantern in its pocket dimension (`learnPocket()`, still in the `lantern`
  checkpoint). L stores it (a rift opens above it; it lifts, turns and shrinks in) or sets it down
  in front of Hal; E beside it recharges or puts it away. Works on Earth and Oa. The training's
  landing marker moved from the lantern to Abin Sur. `setupCrash` split into build + `enterCrash()`.
- **Part Two now starts at the lake** (`Corps.js` rewritten, `Voyage.js`, `scenes/Space.js`,
  `fx/EarthMap.js`, new): checkpoints `summons`, `voyage`, then `oa` (now a landing out of the sky
  in front of Kilowog) and the drills; the user asked for the trip to be shown, not a cut to Oa.
- **Travel** (the user's design): from the range on, E high in flight opens the star chart
  (`ui/TravelHud.js`, new); Earth and Oa are charted, Korugar, Ysmault and Mogo locked. A short
  voyage, then Hal arrives flying; `earth` is a new checkpoint (the lake without Abin Sur's body).
  Saves gained `worlds`.
- **Kilowog** (`characters/BodyLanguage.js`, new; `Rig.js` lean yaw and head gestures; `Voice.js` /
  `UI.js` word boundaries): gestures cued to words in every line and quip, fists-on-hips stance,
  head beats while talking, idle fidgets, turning to face Hal.
- Also: `RingPowers.detach()` / `freeze`, `Player.airborne()` and the physics clean-up in `spawn()`,
  per-scene near/far, new sounds (`rift`, `sonicBoom`, `arrive`), a `guardian` voice.
- Verified: see Status (2026-11-09, pocket dimension...). Not verified: audio, real mouse on the
  chart, gesture timing with real speech, Space frame rate.

### 2026-11-09: git, GitHub and the MIT license
- `git init` on `main` and three commits: the project, then the raw scans, mocap and reference
  videos (taken out of `.gitignore` at the user's request), then the MIT `LICENSE`,
  `"license": "MIT"` in `package.json` and a License section in the README. `.gitignore` keeps
  out `node_modules`, `dist`, `shots` and `.DS_Store`.
- Pushed to https://github.com/abhiram1809/Lantern-Game. It was created private first; the user
  stopped the push and asked for it public ("keep everything open-source"). See *Git and GitHub*.

### 2026-11-09: Part Two feedback: strafing, the camera, bent knees, the comic battery
- **Strafing with held constructs** (`Player.js` `strafe`, `heading`, `strafeStep`; `Rig.js`
  `Animator.twist`; `Mocap.js` `Locomotion.direction`; `RingPowers.js`): the user reported S did
  nothing with the shield up (Hal crept forward) and that firing, especially in flight, wrecked
  the mouse turning. Cause: the shield and gatling called `turnTo(camera)` every frame against a
  controller that moves along the facing (and, in flight, against the face-the-velocity code).
  Now Hal faces the camera and moves where the keys say; in flight he hover-strafes upright.
  `choose()` puts the other held construct away.
- **Camera:** its collision ray ignores dynamic bodies (`camFilter`).
- **Bent knees after Kilowog's speech:** Hal stood 0.33 m inside Oa's cylinder deck collider.
  The deck, pillars (now matching their hex meshes), pylons and podium are convex prisms
  (`hullPrism` in `Oa.js`).
- **The Central Power Battery** rebuilt after the comics (see *Scenes*), from reference panels the
  user approved looking up. `BATTERY` is now the globe's centre. The citadel leaves a gap toward
  the range.
- Verified: see Status (2026-11-09, fixes). Not verified: a real mouse, audio.

### 2026-11-09: Part Two's first slice: Oa, Kilowog's range, drones, the Gatling
- **Parts:** `Save.js` rewritten around `createSave` (`Save`, `CorpsSave`, `allUnlocks`,
  `takeResume`). `Story` now reads its part's store (`get save()`, `steps()`, `chapterMenu`).
  `main.js` makes the story after the title. Part One's end card offers Part Two.
- **Oa** (`src/scenes/Oa.js`, new): the floating range, the city kit, the Central Battery, the
  ringed giant, sky traffic, cover, crates. It took several passes: towers that read as needles
  or "bullets", a blown-out battery, an over-bright deck, mint window tint, and a broken
  instancing shader (see Gotchas).
- **Drones** (`src/enemies/Drones.js`, new): see *Drones*.
- **Combat in `RingPowers.js`:** targets, aim assist, damage numbers and the target bracket
  (`PowerHud.js`), the fist hurting targets, the **Gatling** construct (`gatlingGeometry` in
  `Constructs.js`) with tracers, Oa's charge `regen`, and `attach({ floor, ceiling })`.
- **Kilowog:**
  - The user generated the model. A helper agent built it with per-model rig overrides
    (`tools/build-assets.mjs` entry, `RIG_DEFAULTS` in `tools/autorig.mjs`). It confirmed the
    other three models rebuild byte-identically, and I re-checked the md5s.
  - `createKilowog`, his voice profile and speaker label, and `Animator.armSpread`.
  - Helper's risk notes: the shoulder pads bend at big arm angles, there's little neck (keep the
    look-at gentle; he uses maxYaw 0.6), and in a run his fist would swing into the chest armour.
- **Story** (`src/story/Corps.js`, new) and the Part Two lines in `lines.js`: intro with close-up
  and two-shot cameras, the targets drill, live fire, the open range, and Kilowog's commentary.
- Also: `player.moveScale`, a `stone` footstep, new sounds (gatling spin and shot, hit tick,
  drone spawn, charge, shot, crash, bolt whiz).
- Verified: see Status (2026-11-09, Part Two). Not verified: audio, performance, Kilowog moving.

### 2026-11-09: Ring powers: charge, health, constructs, flight, the oath, ring training
- **Ring charge and health:** `src/powers/RingPowers.js` and `src/ui/PowerHud.js` (new). The ring
  arrives at 12% (`meetAbin`); the HUD comes up at "Take the lantern" with a marker on it; the
  four-line oath in `transform()` fills it to 100%. Fire zones hurt, health regenerates, and
  `collapse()` restarts the checkpoint at 0. The lantern recharges the ring in free roam.
- **Construct wheel:** `4`, time stops (`Engine.timeScale`, `uFocus` grade, muffled audio).
  Fist, shield and wall work; gatling, sword, staff, hammer and axe are locked slots.
  `src/powers/Constructs.js` (new) has the list, the construct and ghost shaders, and the
  geometry. Aiming shows a hologram ghost, capped by range; scroll changes the range.
- **Flight:** `Player.js` rewritten around a pivot (`mount()`), with double-tap-Space flight,
  hover / flat-out poses (`Poses.flight`, `hover`, `flyFast`, `land`), banking, landings.
- **Training chapter:** new checkpoint `powers` and `Story.ringTraining()`, plus the thrown
  burning plate, the core breach with chunks hurled at Hal, and the step panel.
- **Input:** mouse buttons (`Mouse0`/`Mouse2`), held buttons, releases, the scroll wheel, raw mouse
  deltas, `doubleTap()` and `consume()`.
- Also: `ui.say({ skip: false })`, `ui.powerKeys`, `Animator.reach({ rate })` with eased releases,
  `CrashSite` bounds handles / `canLand` / `inTrees` / `spawnDebris`, new synth sounds in
  `Audio.js` (form, punch, impact, shield, wall, takeoff, land, airflow, hum, muffle), a `ring`
  voice, `Save.unlocks`, and the negative-`dt` clamp in `Engine.start`.
- Verified in the browser on 5180 (synthetic input, fixed-step captures): everything listed under
  Status for 2026-11-09, and a clean `vite build`. Not verified: any audio, the pointer-locked
  wheel with a real mouse, performance under load.

### 2026-11-08: Round 3: checkpoints, user's models, natural movement, forests, face fix
- **Checkpoints and saving:**
  - `src/engine/Save.js` (new) saves to localStorage plus a cookie mirror, at 8 checkpoints.
  - Title flow (`main.js`) offers Continue, New game and Chapters.
  - New pause menu (`UI.pauseMenu`, `Story.pause/resume`, `Engine.paused`) and a checkpoint
    notice.
  - Each story step has a `prepare(id)` so it can be resumed.
- **Models:**
  - The user's `Hal-Improved.glb` (casual) and `Abin.glb` replace the old casual scan and the
    procedural Abin.
  - `build-assets.mjs` was rewritten for multi-primitive meshes. The head-transplant path
    (`headswap.mjs`) was retired.
- **Movement:** replaced the procedural walk with Mixamo Xbot mocap retargeting (`Mocap.js`,
  new). Added momentum steering and lean (`Player.js`, rewritten), and a quaternion-pose animator
  with look-at, gestures, two-bone arm IK and foot IK (`Rig.js`, rewritten; `IK.js`, new).
- **Arm interactions** use IK:
  - shielding his eyes
  - hands on knees
  - Abin offering his hand
  - Hal reaching for the ring, then looking at it
  - reaching toward the lantern
  - the dad's wave
- **Environment:**
  - `fx/Trees.js` (new) replaces the crash site's "pointy mountains" with wooded hills and
    forest. The bedroom window treeline uses the same trees.
  - Toned down the water glitter, the debris emissive and the fire reflections.
  - Gave Abin a fainter glow (0.32) and set casual Hal's `roughMin` to 0.62.
- **Face fix:** the "sideways face". Added the jaw-line weight override in `autorig.mjs` and
  softened the look-at to maxYaw 0.85, split 50/50 between neck and head, with glance weight
  0.55.
- Rewrote `README.md`. Created this file.

### 2026-11-08: Round 2: hyperspace restyle
- Restyled the teleport tunnel after the space-flight video: `src/scenes/Hyperspace.js` (new)
  with streaks, warp, starfield, wisps, sparks and a core burst. The old `Tunnel` class was
  removed from `Dream.js`.

### 2026-11-08: Round 1: Part One built
- Built the whole of Part One:
  - the engine and post chain, Rapier physics, synth audio and speech voices
  - the bedroom with physics props, curtains and the blanket
  - the dream airfield, the green light, the "Are you afraid?" choice, and the crash site with
    water, fire and debris
  - the glyph-to-English decode, the transformation, and free roam
  - the auto-rig pipeline for the Tripo scans
- The user chose third-person walking plus directed cinematics.
