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
"Awakening"**, and **Part Two, "The Corps"**, are complete and playable: Part Two runs from the
Guardians' summons at the lake, across the universe to Oa, through Kilowog's range and Sinestro's
sparring, to the Guardians' hall and home before dawn, with hyperspace travel between Oa and Earth
as free flight afterwards. **Part Three, "Coast City"**, has its first slice: the morning after on
Earth (late, broke, fired by Carol Ferris).

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
8. **The Guardians** (`scenes/Hall.js`, `characters/Guardian.js`): Kilowog sends Hal to their hall;
   he flies there himself. Seven Guardians on pillars round the dais, Sinestro by Abin Sur's bier;
   the council (Sinestro objects, Hal won't give the ring back), Abin Sur's body dissolving into
   light that streams to the Central Battery, and Sector 2814 given to Hal.
9. **Home:** up out of the hall and E; the short voyage; his bedroom at 4:16 AM, still raining: a
   green flash at the window, the suit sweeping back into his clothes, bed. Part Two's end card
   offers Part Three or free flight.
10. **Free flight** (`range`, `earth`): the range (Kilowog starts another round on request) and the
   lake, with the ring's hyperspace routes between them (the star chart: E high in flight).

Part Three so far (`src/story/Coast.js`), a civilian morning (the ring stays on, its powers off):

1. **The morning after** (the apartment by day, `Bedroom.build({ morning: true })`, Coast City's
   street through the window): 9:41 AM, the phone buzzing; he wakes in stages (`getUpFromBed`:
   rolled to the edge, up on an elbow to squint at the clock, the blanket thrown back, sitting up
   with the legs along the bed, round onto the edge), drags his hands down his face (`rubFace`),
   plays four voicemails on speaker (the landlord Sal Delgado, Tom Kalmaku twice, Carol). Free
   roam: the fridge (the downloaded one; it opens), the bills, the photo, the window, a rent notice
   under the front door; leave by the front door.
2. **Running late** (`scenes/Ferris.js`): out of his building's door to his car (`getIn`: the door
   pulled open by its edge, sat down sideways, legs swung in, the door pulled shut); the car (the
   downloaded '71 Phoenix, `makeCar`) takes three tries to start; out through Coast City (the
   boulevard, from the kerb); the desert road; the gate; the staff lot; out of the car (`getOut`:
   a hand to the handle, the door pushed open, a turn in the seat, feet out over the sill, up, out
   past the door's tip, the door pulled shut by its edge).
3. **Ferris Aircraft:** on foot between the hangars to the apron, where the prototype stands.
4. **Carol** (her own Tripo scan): she fires him for the missed Air Force test.
5. **Out of work:** Hal sitting on his car's trunk lid, feet on the bumper; the end card ("to be
   continued").

Seated poses in Coast are solved for the seat, not guessed: `legTo(pose, side, dy, dz, thigh,
shin, toe)` is two-bone IK in the leg's plane from the hip joint to an ankle target, and
`drivingPose`, `swingPose`, `outPose` and `trunkPose` use it with the car's measured points. At the
wheel Hal is reclined 0.34 (the roof is low) and his hands are on the rim by arm IK
(`driveHands`). The phone (`buildPhone`, the downloaded iPhone with its logo removed and the
morning's lock screen drawn on its screen mesh, double-sided) is held by `holdInHand`: parented to
`hand_L`, eased onto `rig.palm('L')`, and the wrist turned in `animator.post` so the screen faces
his eyes.

The ring recharges continuously on Oa (the Central Battery is in range); the lantern can still be
set down there.

The user chose Part Three's beats (2026-11-10): Carol fires him for **missing the test** (he was on
Oa all night), he gets there in **his old car** (three tries to start), and they made Carol in Tripo.
Stack:

- `three` r0.187 (WebGLRenderer plus EffectComposer)
- `@dimforge/rapier3d-compat` for physics
- Vite 8
- Node tools built on `@gltf-transform`, `meshoptimizer` and `sharp` for the asset pipeline

Sounds and music are synthesised with WebAudio; no sound files are shipped. Spoken lines are
pre-rendered clips (`public/voices/`, Kokoro-82M from Hugging Face, see *Voices*), with the browser's
`speechSynthesis` as the fallback for a line that has none.

## Working with this user

- **They supervise closely and are blunt about visual breakage.** One example was "What the hell
  is this sideways face" when the head weights sheared the face. Before handing anything over:
  - Look at faces, hands and deformation **in close-up** during the motion you changed.
  - Look at the camera angles the player actually sees.
- **Quality bar:** it should not look low effort, or "like it was made in a day". Prefer depth
  and polish over adding features quickly. Their words (2026-11-10): "in no scene whatsoever should
  the game scream that it was done last minute". They catch contact errors: legs through a car's
  floor, a phone through a hand, a walk with bent elbows and cocked wrists ("looks a bit gay": it
  read as mincing; see `relaxArms`).
- **Their second round of Part Three notes (2026-11-10):** a body part poking out of the blanket;
  waking up "should not be just one motion"; lip movement while speaking; better, more versatile
  TTS voices from Hugging Face, matched by pitch to each character (Kilowog "should be monstrous");
  "make the environment not feel like a 8th grade project but like actual coast city, keep it
  efficient though". Efficiency matters to them: small textures for props seen far off, instanced
  or shared meshes, lazy loading per part.
- **Props and set dressing: find detailed models, don't build them** (2026-11-10: "better to just
  find one and replace rather than building stuff from scratch"; they pointed at Hugging Face
  datasets). The Sandflow `sand3d-*` sets they named are objects rebuilt as code from primitives,
  without textures, so no better than ours; their source, Objaverse, has the original Sketchfab
  meshes. See *Props*. Use CC BY or CC0 only (no NC, ND, SA or "Free Standard"), check every model
  in the prop viewer before using it, and credit it in `CREDITS.md` (generated).
- **Physics of movement matters most**: natural running, arm interactions and weight. Hair is
  optional; lip movement they asked for (2026-11-10), lip sync proper (visemes) is not needed.
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
    colour banding. The Guardian (2026-11-10) was accepted on the first pass shown ("good enough,
    move on"), after several internal passes (robe shape, hair cards).
  - A woman can't be derived from the male scans at the scans' bar: say so up front and ask for a
    Tripo model (Carol, 2026-11-10). Their sheets may hold two figures (Kilowog, Carol): `keepSide`.
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
npm run props      # tools/build-props.mjs: assets/props/*.glb → public/models/props/*.glb, and CREDITS.md
node tools/fetch-textures.mjs  # the Poly Haven surfaces (CC0) → public/textures/pbr/<id>/{diff,nor,rough}.webp
npm run voices     # tools/build-voices.mjs: every line in lines.js → public/voices/*.mp3 + manifest.json
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
| `assets/raw/Carol.glb` | **Carol Ferris** (the user's model, 2026-11-10), built as `carol.glb`. Two figures side by side (`keepSide: 1`), A-pose, a shoulder bag. |
| (none) | **Sinestro** has no file: `createSinestro()` derives him at runtime from `abin_sur.glb` with a shader layer (see *Characters*). |
| (none) | **The Guardians** have no file either: `createGuardian()` (`characters/Guardian.js`) derives them from `abin_sur.glb`. |
| `assets/raw/hal_a.glb` | Old casual scan: two figures, poor face. Unused; see the commented entry in `build-assets.mjs`. |
| `assets/raw/gemini_generated_video_93604faf.mp4` | Hyperluminal space flight: radial streaks, "ORBITAL APPROACH" HUD. **The Hyperspace scene is styled after it.** |
| `assets/raw/gemini_generated_video_6bbb1091.mp4` | Reference for a **later part**: the suited Lantern flying over a neon night city, fighting red-eyed mechs with constructs (minigun, hex shield); combat HUD with minimap, health, ammo and damage numbers. |
| `assets/ref/1–4.webp` | Concept art. The HUD frame, the 10:00 PM timestamp and the glyph subtitles come from here. `4.webp` is the bedroom; the posters are cut from it. |
| `assets/mocap/Xbot.glb`, `Soldier.glb` | Mixamo-rigged characters from the three.js examples. Only Xbot's clips are used at runtime (`public/anims/xbot.glb`). |
| `assets/props/*.glb` | **Downloaded props** (2026-11-10), CC BY 4.0 Sketchfab models from Objaverse, credited in `CREDITS.md`: Hal's car (`phoenix`), four period cars for the lots, the prototype (an F22), the phone, palms, Hal's apartment block, the apron's access stand, tug, fuel truck, cones, tool chest, drums, forklift; Coast City's six office blocks (`office1`–`6`, one artist), the street kit (`cityprops`: traffic lights, lamps, hydrants, bins, a dumpster, signs), a bus shelter, a billboard; the gate's guard booth; the kitchenette's fridge and coffee maker; the dream's F-104. `apartment.glb`'s textures were re-encoded as JPEG to keep it under 25 MB. |
| `public/textures/pbr/` | **Surface textures** (CC0, Poly Haven, 1K WebP): corrugated iron (the hangars), concrete (the apron, lots, pavements), asphalt (roads, runway), gravelly sand (the desert), white plaster (the tower and office). `pbrMaterial(id, { repeat, tint, map, detailRepeat })` in `fx/Textures.js`. |

Model build settings (`MODELS` in `tools/build-assets.mjs`):

| Model | Target triangles | Height |
| --- | --- | --- |
| Casual Hal | 100k | 1.83 m |
| Suited Hal | 90k | 1.83 m |
| Abin Sur | 90k | 1.96 m |
| Kilowog | 90k | 2.4 m |
| Carol | 90k | 1.7 m |

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
and Part Three's `Coast` (`src/story/Coast.js`) extend it and override `get save()` (their own
store), `steps()` (checkpoint id → method) and `prepare(id)`. Everything else (powers, HUD, pause,
dialogue, barks, `perform`, collapse, interactions) is inherited. `main.js` picks the class by part.

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
  `duel()`, `guardians` → `guardiansCall()` (the flight to the hall, `council()`, `rite()`),
  `homeward` → `homeward()` (the jump, the voyage, `backThroughWindow()`, the end card), `range` →
  `openRange()`, `earth` → `home()`. Part Three's are `morning` → `morning()`, `drive` → `drive()`,
  `ferris` → `ferris()`, `carol` → `carolScene()`, `after` → `after()`.
  The free-roam steps never resolve; travel saves `range` or `earth` itself on arrival. Part Two's
  linear run ends at `homeward`'s end card (Part Three, free flight via `earth`, or the title).
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
    `Story.perform(body, key, cues)` plays a line on a `BodyLanguage` (head beats, gestures cued to
    words). Kilowog, Sinestro, the Guardians and Carol all speak through it.
  - `style: 'phone'` is a voicemail on speaker (grey, quoted; `name` carries the caller and time).
    Part Three's ring lines go through `say` with `{ name: 'The ring' }` (its HUD readout is off).
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
`Save` (Part One, key `gl_awakening_v1`), `CorpsSave` (Part Two, `gl_corps_v1`) and `CoastSave`
(Part Three, `gl_coast_v1`, `COAST_CHECKPOINTS`). Each is kept
in `localStorage` with a cookie mirror (1 year, SameSite=Lax) for when storage is blocked. Settings
(voices) always live in Part One's store. `allUnlocks()` / `allWorlds()` merge every part's lists, so
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
  - A blanket (plaid flannel) that rests on Hal like cloth: his body's capsules (toes included)
    are a floor it can't pass through, and relaxation passes pull it taut between the high points
    (`updateBlanket`). `blanketWaist` slides it off his shoulders as he props up; `blanketOff`
    throws it back toward the wall, bunched.
  - `BED` holds the bed's bounds.
  - `buildJet()` is also used in the dream.
  - A kitchenette at the hallway's dead end (both versions): a fridge whose door opens
    (`openFridge(open, tween)`, with its light), a counter, the week's pizza boxes.
  - `build({ morning: true })` (Part Three): the morning sky through the window, the sun as the
    window light, no rain on the glass (`glassU.uRain`, `uDay`), the lamp off, brighter fill, and
    Coast City's street outside (`buildStreetView`: pavements, palms, lamps, parked cars, office
    blocks across the road, downtown's towers in the haze) in place of the tree line, when the
    city props are loaded.
  - The kitchenette's fridge is the downloaded "Old Fridge" where it's loaded (`buildFridge`: its
    front parts on a hinge, `fridgeSign`, a dimmer light), else the box one (`buildBoxFridge`);
    the coffee maker likewise. Part One and Part Two load both in `prepare`.
- **`Dream.js`:** the sepia airfield at sunset, from eight-year-old Hal's eye level. Martin waves
  (mocap idle plus arm IK), then the jet goes down: the downloaded F-104 Starfighter where it's
  loaded (`starfighter()`: nose to +x, its afterburner flame, `userData.offset` for the wheels),
  else `buildJet()`.
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
  - `ground(x, z)`, `canLand(x, z)`, `floor(x, z)` (flight's lowest height), `interact()`; all of
    them include the Guardians' hall.
- **`Hall.js`:** the Hall of the Guardians, built into the Oa scene (`oa.hall`) on a tower at
  `HALL` (-62, 3, -150), between the range and the battery, so it shows from the range and Hal
  flies there. A floor disc of polished stone with lit rings and rays; a crescent of seven pillars
  on the battery side (`HALL_PILLARS`: radius 10.8, 5.9–7.2 m, the eldest's in the middle), a
  Guardian's platform on each; the dais (`DAIS_TOP`); Abin Sur's bier (`BIER`, dark stone, lit
  edge); a great ring hanging over it; a spotlight on the Guardians. Colliders are hull prisms and
  boxes. Flight on Oa is bounded by a 200 m radius round (-30, 0, -70) to include it.
- **`Ferris.js`:** Ferris Aircraft by day (Part Three), the dream's airfield twenty years on:
  runway (z -150), taxiway, the apron with the prototype (`JET_SPOT`, the downloaded F22, nose
  east, colliders boxed round its own fuselage, wing, fin and gear parts by `solid()`), the access
  stand at its cockpit, the tug at its nose, the fuel truck, cones; three corrugated hangars with
  their doors open (procedural; Hangar Two lit, a second F22 inside without its canopy, tool
  chests, drums, a forklift, a stand), tower, office, the staff lot (`CAR_SPOT`, nine parked cars
  by `park()`, each with a box collider), gate (`GATE`), fence, power poles, the access road south,
  mesas, scrub, a desert floor (Poly Haven's sand, with world-space variation on top), walked on as
  a heightfield (`fixedGround`). The hangars are corrugated iron, the apron and roads real concrete
  and asphalt under their painted markings (`pbrMaterial`). The gate's booth is the downloaded one.
  `LOT` (6 km down the road, out of sight) is the lot behind Hal's building: the downloaded brick
  apartment block, palms, three neighbours' cars, its own patch of walkable ground; round it
  **Coast City** (`buildCity`): office blocks ringing the lot, downtown's towers behind his
  building, and the boulevard out of town (`BOULEVARD`, in the lot's frame: blocks fronting the
  street on both sides, kerbs and pavements, palms and street lamps from the kit, a signalled
  crossing with a cross street, a bus shelter, a billboard, two cars at the lights). Hal's car is `makeCar('phoenix',
  { primer: true })` (see *Props*). Everything the scene places from the props is listed in
  `FERRIS_PROPS`, which `Coast.prepare` loads first. `focus(at)` moves the sun's shadow box onto the
  action; the sky dome follows the camera.

### Props (`src/props/`, `tools/build-props.mjs`)

Downloaded models (CC BY 4.0, Sketchfab by way of Objaverse; `CREDITS.md`). How to find one:

1. Search Sketchfab's public API (`api.sketchfab.com/v3/search?type=models&q=…&downloadable=true`,
   no login) and keep the hits whose uid is in Objaverse's `object-paths.json.gz` (on Hugging Face,
   `allenai/objaverse`); download the GLB from `huggingface.co/datasets/allenai/objaverse/resolve/main/<path>`
   (no Sketchfab account needed). `lvis-annotations.json.gz` is a small category index of a subset.
2. Check the licence (CC BY or CC0) and the author on the model's API page; never write them from
   memory (seven of fourteen were wrong the first time).
3. Look at it in `tools/propview.html?src=…` on the dev server (six angles, a parts list with sizes
   and materials; `view()` / `save()` from the console write the sheet to `SHOT_DIR`). Many are
   untextured, in centimetres, or turned (the F22 lay 39° off its axis).
4. Add it to `PROPS` in `build-props.mjs`: `forward` (an axis or a yaw), `length` / `height` /
   `scale`, `origin`, `drop` (part names; GLTFLoader turns spaces into underscores, so match both),
   `opaque`, `simplify`, `tex`, and the title, author and uid for the credits. Raw files go in
   `assets/props/` (under 25 MB each).

At runtime `loadProps(names)` (`Props.js`) loads a set once; `prop(name, { ownMaterials })` hands
out clones. Loading also floors every material's roughness (0.12 glass, 0.2 the rest) and dims
glass reflections: Sketchfab exports are often mirror-smooth, and under the sun they bloomed into
white lines. `meshes(root, test)`, `boundsIn(space, list)`, `pivot(space, list, at)` (re-parent
parts under a hinge or hub) and `piece(name, test)` (one part of a kit as its own object, standing
at its origin: `KIT` in `Ferris.js` names the street kit's parts) are the helpers; `hasProp(name)`
says whether one is loaded (scenes shared with Part One fall back to their built versions).

`Car.js` `makeCar(name, { paint, primer, dust })` dresses one of the cars: the paint material
recoloured with dust toward the sills, chrome roughened in the shader (most of it has roughness
maps), lamp lenses dimmed, wheels on pivots at their hubs (`userData.wheels`, spin with
`rotation.x`), the driver's door (front left, +X) on a hinge (`openDoor(k)`, 1.15 rad), and for the
driver (measured on the Phoenix: cushion 0.44, floor 0.27, roof 1.3, wheel centre 0.37/0.78/0.11,
its face tilted 31°): `seat` (the hip joints), `pedals` (the ankles), `rim(side, hour)` (wrist
targets on the steering wheel), `tail` (the trunk lid's back edge), `exhaust`.

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
`fixedGround(size)` (flat ground as a heightfield: see Gotchas),
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
"neck column" that keeps the armour collar on the chest. Carol uses `neckMid: 0.86` (her long hair
hides the neck: the narrowest slice landed at her mouth, and her chin went to the chest) and the
A-pose arm band `armLo` / `armTipIn` / `armMinY` (the T-pose band was nearly empty, so the arm axis
fit was garbage and her arms stretched to the floor). `keepSide` picks one figure from a
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

`BodyLanguage` options: `gestures` / `stances` (a character's own library, `scale: 1` in its own
metres), `reach`, and `shift`, the pair of stances an idle fidget swaps between (Kilowog's default
`['hips', null]`; Sinestro `['behind', 'oneBehind']`; null never: the Guardians, Carol).
Kilowog uses 0.17 so his hands clear his thigh armour.

`animator.lean.yaw` turns the chest (spine and chest, about the body's up axis) for gestures that
follow a hand. Head gestures are `nod`, `shake`, `beat` (one dip, for emphasis), `chin` (a lift)
and `tilt` (negative amount tilts the other way).

`animator.twist` (radians, after the lean) turns the hips toward the direction of travel while
strafing; the spine and chest turn back by the same amount (55/45), so the legs step toward the
travel and the chest stays square to the aim. This is the upper/lower body split of older
third-person shooters, used because the mocap has no strafe clips.

`animator.post(rig, dt)` runs after every layer, IK included (Coast's held phone turns the wrist
there). `rig.palm(side)` is the palm measured from the hand bone's own vertices (cached): `centre`,
`normal` (the side that faces down in the bind pose), `along` (wrist to the hand's centre),
`thick`, `surface`, in the bone's frame; a prop parented to the hand bone sits flat on it.

**Getting out of bed** (`Story.getUpFromBed({ to, seat, pace, whilePropped, sweep })`, shared by
Part One's startled wake and Part Three's morning): rolled toward the open edge onto his left
side; up on that elbow by a sideways bend of the spine (`sz`/`cz`, so the legs stay put; tilting
the whole body lifted the legs off the bed), the hand flat on the mattress (IK), the blanket
sliding to his waist; `whilePropped` (the clock); the blanket thrown back with the other arm;
up to sitting facing the foot of the bed with the legs still along it (the thighs flexing as he
rises), turned about the hips; then round on the hips to the edge, the knees bending once the
feet clear the mattress. `rubFace()` drags both palms down his face.

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
  - A "tired" posture is layered on top: the sad pose's back, neck and head only (its shoulder and
    arm tracks are filtered out: they curled the arms).
  - `relaxArms` (in `Locomotion.sample`, `loco.relax = { elbow, wrist, adduct }`) pulls the
    elbows (0.5 of the way, less while running) and wrists (0.65) back toward straight and, for Hal
    only (`adduct` 0.12, set in `Player`), the upper arms in to his sides. Xbot's walk carries 35°
    elbows and cocked wrists, and Hal's walk read as mincing; Kilowog keeps `adduct` 0 (armour).
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
- `createCarol(gltf)`: her scan's normal map is broken over the skin (pale rims round the face,
  white flecks on the lips, whichever way the green channel is read), so skin-coloured texels use
  the surface normal; hair and clothes keep the map.
- **The Guardians** (`characters/Guardian.js`, `createGuardian(abinGltf, mocap, { seed, hairCount })`),
  from Abin Sur's scan, approved by the user on the first pass shown:
  - Vertex stage (bind space, like Sinestro): the skull swollen into a dome above the brow (radial
    push from the skull centre, a lift, a widening), the fringe's mass pushed out (`gThick`), then
    the whole head scaled 1.58× about the neck (`uPivot`); the figure scaled 0.62 (about 1.4 m).
  - Fragment: blue skin from the scan's luminance, paler up the dome; dark eyes painted into the
    slits; the fringe (a band round the back of the head from a rounded point at each temple,
    `gBand`) painted white with combed grooves in the normal; white brows; everything below the
    neck discarded except the hands (`vKeep`, from the skin weights), the robe covering it.
  - Hair cards (`characters/HairCards.js`, `growHair(mesh, opts)`): ribbons of alpha-cut strands
    grown from the scalp's triangles inside a mask, combed along a direction field, kept between
    `lift` and `lift + hug` off the drawn surface by a nearest-vertex search (a 1 cm grid), skinned
    to the head; radial normals so the mass shades as a volume. The fringe and the brows are cards.
  - The robe (`characters/Robe.js`, `buildRobe(rig)`): built *in the pose they stand in* (the mocap
    idle plus the `sleeves` stance, run for 2.5 s first) from the CPU-skinned scan: a gown from
    convex hulls of the torso's slices (an A-line from the chest, a bell from the hips), a yoke
    arcing off the neck over the shoulders, full sleeves from rounded shoulder caps to bell cuffs
    that hang, the high collar; skinned with a second `THREE.Skeleton` on the same bones whose
    inverses are that pose. Procedural weave, trim, the Corps emblem on the chest.
  - Body language: `GUARDIAN_STANCES.sleeves` (each hand in the other's sleeve; the hands are hidden
    while `uHandL` / `uHandR` are 0) and `GUARDIAN_GESTURES.decree` / `release` (set the hand's
    uniform to 1 first, so it comes out of the sleeve). `seed` varies the fringe, dome and skin.
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
- **Lip sync** (`JAW` and the jaw in `patchMaterial`, `Story.updateMouths`): the scans have no face
  bones, so the jaw turns in the vertex shader, before skinning and after any reshaping of the
  head (the Guardians' 1.58× head moves their hinge, `Guardian.js`): the lower face below the lips'
  seam, down to the chin and not the neck, narrowing to the mouth's corners, rotated about a
  hinge by `uJaw` (0..1, about 0.2 rad); the seam band darkens as it opens (the scans' mouths are
  sealed). `JAW` holds each scan's seam, chin, lip front, half-width and hinge, set by eye with the
  mouth held open: casual Hal 1.6045, suited Hal 1.6155, Abin Sur (Sinestro, the Guardians) 1.7295,
  Carol 1.498, Kilowog 2.122. `Story.updateMouths` drives the speaker's `uJaw` from the voice's
  mouth curve (`voice.mouth`) times `MOUTH_GAIN` (Kilowog widest, the Guardians least); the speaker
  is the rig a line is performed on (`Story.perform` sets `speakingRig`) or `mouthOf(who)`.
- `createRing()` and `createLantern()` are procedural.
- `loadCharacters()` loads `kilowog.glb` optionally (null if it's missing; Part Two then stands a
  broadened Abin Sur in for him).
- Story helpers: `attachRing(ring, rig)` puts the ring on a hand bone, and `putOnSuit()` and
  `transform()` swap between the casual and suit rigs.

---

### Voices (`tools/build-voices.mjs`, `src/engine/Voice.js`)

Every line in `lines.js` (except `alien: true`, which keeps the synthetic buzz) is pre-rendered
offline by **Kokoro-82M** (hexgrad, Apache-2.0; the ONNX export with per-phoneme durations,
`onnx-community/Kokoro-82M-v1.0-ONNX-timestamped`, run on the CPU through `kokoro-js`). Text goes
through espeak-ng (`phonemizer`) with a small lexicon for names it gets wrong. Each character is a
Kokoro voice (or a blend) moved to a target pitch (formants by resampling, pitch by TD-PSOLA) and
run through its own effects chain (`CHARACTERS` in the script):

| Who | Base voice | Target F0 | Processing |
| --- | --- | --- | --- |
| hal (and `thought`, closer and softer) | am_michael | 115 Hz | light EQ and compression |
| sinestro | bm_george | 100 Hz | darker, slower, a small room |
| kilowog | am_onyx + am_fenrir | 65 Hz | formants down, an octave-down layer, growl, saturation, chest boost: "monstrous" |
| guardian | bm_fable | 120 Hz | a choir of detuned and octave layers, 3 s reverb |
| carol | af_heart | 195 Hz | light EQ and compression |
| abin | bm_lewis | 90 Hz | breath noise, slower |
| ring | bf_emma | (unchanged) | band-limited, a metallic comb, a short room |
| light, dad, kid, tom, landlord | blends and others | | see the script |

`style: 'phone'` lines (the voicemails) also get a telephone band. Loudness is levelled (speech
RMS -19 dBFS, peaks under -1 dBFS). All 176 lines are 3.5 MB of MP3.

- `npm run voices` renders only what changed (text, voice settings or the pipeline, by hash in
  `build.json`); `ONLY=key1,key2`, `WHO=carol,tom`, `FORCE=1`, `SURVEY=1` (median F0 of every
  English Kokoro voice). The model downloads once to `~/.cache/lantern-voices` (`HF_CACHE`).
  **Add a line to `lines.js`, then run it**: a line without a clip falls back to the browser's
  voice, and a changed text misses its clip (the key is `who|text`).
- `public/voices/manifest.json`: `{ version: 1, lines: { key: { who, text, file, dur, end, words:
  [[charIndex, s]...], mouth } } }`; `end` is where the speech stops and a reverb tail begins,
  `mouth` a base64 openness curve (60 frames/s) taken from the speech's envelope.
- `Voice.speak(text, who, onWord)` plays the clip through `audio.master` (so the pause muffle and
  volume apply), fires `onWord` on the word timings, sets `voice.mouth` / `voice.who` for the lip
  sync, and resolves at `end` (the tail rings on under the next line). Skipping fades it out.
  `pause()` / `resume()` suspend the audio context.
- `tools/voices.html` on the dev server is the audition page: every line by character, with the
  words lighting up on their timings and the mouth curve drawn.

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
   - `shot(name, 0)` renders the camera from before a `director.cut()` you just made: step at
     least a frame (`shot(name, 1 / 30)`). Captures are 1536×960 (pixel ratio 1.5): crop with that.
   - `tools/propview.html?src=/path.glb` renders any GLB from six angles with a parts list; put
     candidate downloads in `shots/` (ignored by git) to look at them before they're used.
   - Part Two: `__game.story.travelTo('earth' | 'oa')` from `#range` or `#earth` runs a trip;
     `__game.story.kw.play('chest')` / `.pointAt(v)` plays one of Kilowog's gestures.
   - **The test tab pauses itself** once the player has control (no pointer lock there), so lines
     and tweens only move while you step `engine.advance()`; don't `await` a story promise without
     stepping, or the script hangs. To fly for real: `player.takeOff()`, then hold `Space`.
   - **A pending restart beats the URL hash**: `takeResume()` (sessionStorage `gl_resume`) is read
     first. If `#id` lands somewhere else, `sessionStorage.clear()` and reload.
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

- **A jaw drawn in the shader needs its seam set by eye.** The lips' seam from the front profile was
  2–25 mm off on every scan (Kilowog's mouth is far above his jutting jaw), and 2 mm puts the dark
  gap on a lip. Hold the mouth open (`u.uJaw`) and step the seam until the gap sits between them.
- **Raising someone lying on their side tilts their spine, not their body.** Tilting the whole body
  about the hips lifted the legs off the bed, and a thigh flex can't put them back (it bends them
  the wrong way when he's on his side). A sideways bend of the spine (`sz`, `cz`) raises the head
  and leaves the legs. Likewise the legs can't hang off the edge while he lies on his side: sit
  up with them along the bed first, then pivot on the hips.
- **Turn a body about its hips, not the object's origin.** The player object's origin is at his
  feet; turning it lifted a lying Hal into the air. Place the object so the hips follow a path.
- **A heightfield-drape blanket shrink-wraps each limb into a ridge** and lets the toes through.
  Treat it as cloth on a floor: the body as a minimum, relaxation passes, and toe capsules.
- **A test camera placed by guesswork can sit inside a building** (the city's blocks are big):
  check positions against the layout before reading a capture as a bug.
- **Decals on canted, thin fins are fiddly** (`DecalGeometry`): projected horizontally they clip,
  aligned to the face they missed it entirely. Removed; the prototype keeps its markings.
- **A big box collider lets the character controller sink in.** Ferris's 16 km ground box: Hal
  stood 0.27 m deep. Cut to 600 m, he still sank 9 cm as soon as he walked, and then stuck in
  place (the user: "can't walk properly after getting off the car"; it wasn't the car). The box's
  queries lose precision with its size. Flat ground is a heightfield (`physics.fixedGround`).
- **Sketchfab models render mirror-smooth.** Glass, lenses and badges at roughness 0 put
  highlights in the thousands under the sun, and the bloom turned window edges into glowing white
  lines. `Props.js` floors roughness on load; chrome with roughness maps needs it in the shader.
- **GLTFLoader renames nodes** (spaces become underscores): a `drop` pattern written for the
  loaded names (`Apple_Logo`) missed the file's own (`Apple Logo`) and the logo stayed.
- **A downloaded screen can face into the phone.** Its single-sided screen was culled from the
  front and you saw the inside of the back panel through it. Make such overlays double-sided, and
  check a canvas texture's flip on the model (this one wanted three's default `flipY`).
- **A principal-axis fit of a hand isn't along the fingers** when the thumb is spread (it came out
  diagonal): take the wrist-to-centre direction for `along`.
- **Sitting poses need the seat's numbers.** The old driving pose (guessed angles) put Hal's shins
  through the car's floor and his legs out under it. Measure the cushion, floor, roof and wheel from
  the mesh, and solve the legs (`legTo`).
- **A door swinging shut sweeps its whole radius.** A character standing in the opening gets hit;
  step out past the tip first (Coast's `getOut`).
- **Hair cards need the real surface, not a spherical lookup.** Binning the scalp by direction
  left most bins empty, and filling them from neighbours threw strands metres off the head (and an
  ear's max radius fanned the hair out). Search the nearest vertex (a spatial grid) and keep each
  strand between two heights along its normal.
- **A robe built in the bind pose fits nothing.** Build garments around the posed body (CPU-skin
  the scan with `getVertexPosition`) and bind them with their own `Skeleton` of the same bones.
  What the robe hides of the scan is discarded in its shader, so the robe needn't follow the
  scan's shapes (Abin Sur's shoulder armour would have made the Guardians boxy).
- **Tripo sheets can hold two figures** (Kilowog, Carol): bounds like 0.13 × 0.59 × 0.98 with
  the long axis z are two figures side by side, not a Z-up scan. Preview with `tools/preview.mjs`.
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
  `speechSynthesis` may stay silent, so `Voice.speak` has a time-based fallback. A clip's clock
  is the audio context's, or wall time while the context isn't running, so a line can't hold a
  scene up.
- **Spoken text written outside `lines.js` gets no clip.** The ring's warnings were literal
  strings in `RingPowers.js` and would have spoken in the browser's voice; they are lines now.
- **A hidden browser pane throttles `requestAnimationFrame`** to about once a second and, left
  long enough, freezes the page (scripts and navigation time out). The voice's tick runs on it;
  test voice timing with the pane visible, or close the tab and open a new one.
- **Pointer lock:** pressing Esc releases the lock, which pauses the game (`input.onLockLost`).
  When the game releases the lock itself, it sets `input.releasing` so that doesn't count as a
  pause.
- **Rebuilt models** need a hard refresh in the user's open tab.
- **Head-swap hue detection** (in the unused `headswap.mjs`): bright, warm skin passed the eyeball
  test and got eyes painted on the forehead. Classify by hue, not brightness.

## Status

Verified by playing in the browser:

- (2026-11-10, props, the car, the phone, the walk) in fixed-step captures: Hal walking on Ferris's
  ground after the drive (level at y 0, 1.18 m/s, no sticking; it sank 9 cm and stuck before);
  Hal at the Phoenix's wheel from outside, from the front and in cutaways with the body hidden
  (feet in the footwell, head under the roof, hands on the rim); the whole drive's getting-out
  sequence frame by frame (door opened by hand, the turn, standing, out past the door, the door
  pulled shut); the trunk scene (on the lid, feet on the bumper); the phone picked up, flat in the
  palm in four angles, the lock screen readable from his eyes, no logo; the walk, run and idle
  before and after `relaxArms` (front and side); the staff lot, the apron (F22, stand, tug, fuel
  truck, cones), Hangar Two's interior, the apartment lot; the Carol scene with the F22 behind her;
  Kilowog on the range (arms unaffected); no console errors; a clean `vite build`. Synthetic input.
- (2026-11-10, the Guardians, home, Part Three) in fixed-step captures: the Guardian model in
  close-up (front, three-quarter, profile, back, full body; the user approved it); the hall from
  the range, from above and inside; Kilowog's send-off, the trigger at the hall and the landing on
  the dais; the whole council with its cameras (the elder and a side Guardian close, Hal looking
  up, Sinestro), the rite (raised hands, Abin Sur dissolving feet to head, motes rising), the
  charge, Sinestro's farewell, to `homeward`; the jump with real flight input (take off, climb,
  the "Make the jump home" prompt, E into the voyage); the bedroom at 4:16 (the flash, the suit
  dissolving into his clothes, the walk to bed); the title screen with three parts. Part Three:
  the morning (sitting up, the clock, the phone held up through four voicemails, standing up,
  control), the fridge, the notice, the front door; the drive (three starts, the bay, the road,
  the verge shot, the gate, parking, getting out); the walk's trigger; Carol in daylight (her
  scan after the rig and normal-map fixes: idle, walk, head turns, close-ups) and the whole
  firing with its gestures and her walking away; the ending and end card. Part One's apartment
  still plays (with the new kitchenette). A clean `vite build`. Synthetic input, voices off.

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

- (2026-11-10, second round) in fixed-step captures: the blanket over Hal in bed (no toes or knees
  through it) and as he props up; the morning's staged wake (roll, prop up on an elbow, throw the
  blanket, sit up, swing to the edge) through to rubbing his face; Part One's wake with the light;
  the jaw of every scan held open (seam between the lips) and Carol's on a real clip's curve; the
  bedroom's street view; the fridge and coffee maker; the city lot, boulevard and downtown on the
  drive; getting into the car; the textured hangars, apron and the gate booth; the F-104 in the
  dream; Kilowog's arms; a clean `vite build`. In the page: a real clip (Carol's first line)
  played through the master bus, with its ten word cues, resolving at its end; every line in
  `lines.js` has a clip (checked by script).

Not verified:

- listening to the voices (the lines worth checking by ear: "Ow. Noted.", "Hm. Quick.", the
  oath's "Beware my power", Kilowog's "Live fire"); the lip sync and tails with the pane visible
  at full frame rate (it was hidden and throttled); frame rate in the city and on the boulevard
- the drive and walk with a real mouse and keys; the getting-out sequence at the voice's real pace
- frame rate with the props (the staff lot's nine cars, two F22s, the palms' alpha fronds)
- the car's bloom in every shot of the drive (glints were reduced and checked in the lot only)
- Sinestro, the Guardians and the Part One dream with the relaxed arms (their arms are mostly on IK)
- any of the new voices and sounds (car engine, starter, phone buzz, birds, traffic, fridge, the
  Guardians' hall)
- Part Three walked through with a real mouse and keys from start to end; the morning's optional
  looks (photo, window, mail) were only listed, not all played
- frame rate in the hall (seven Guardians: scan, robe and hair cards each) and at Ferris (shadows,
  the long ground plane)
- Carol at the voice's real pace (her gestures were cued on the 14 chars/s fallback)

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
- **Next** (the plan the user approved, 2026-11-09; the Guardians and Part Three's opening are
  done): a mission that charts Korugar or Ysmault on the star map and unlocks a construct; then
  the rest of Part Three, Coast City (the neon night city and the Manhunters, Atrocitus behind
  them). Earlier ideas still open: burying Abin Sur at the lake, the empty prisoner tank.
- **Still procedural, next to replace with downloads** (the user's direction, 2026-11-10): Ferris's
  three hangars (plain walls from up close), the control tower and the office (primitives), the
  gate booth, the kitchenette's fridge and counter, the apartment's furniture, the dream's jet
  (`buildJet`, also in the bedroom). Candidates already found and looked at: "j type hanger"
  (ElectricL, arched, textured, closed front), "Metal Storage Building" (jimbogies), "Old Fridge"
  (sergeilihandristov, door in unnamed parts), "Coffee Maker" (Ryan_Nein), "F-104 Starfighter"
  (Mikhail_Zelenov, for the dream). Rejected: "Airport Tower" and the Midwestern apartment
  (no textures), the hangar kit (untextured), the Smart car (wrong era).
- Part Three: Tom Kalmaku, the landlord and the Air Force people are voices only (no models).
  Carol's face keeps faint highlights at the brows (her scan's normal map). The ring's powers are
  off for the civilian morning (no flying to work). Hal starts the drive already in the car (no
  getting in). The F22 still carries its "Raptor 01" markings.
- The Guardians all share one face (Abin Sur's); their hands only come out for `decree`.
- Sinestro's front view could still improve (the user's note); his face shape is Abin Sur's skull
  narrowed, his hair is painted volume with no loose strands, and a faint seam can show on the
  crown in extreme close-up.
- The staff, hammer and axe have wheel slots but no geometry or behaviour.
- Travel trips are cutscenes of about 12 s every time; a skip (or a shorter repeat) may be wanted.
- Earth's continents are coarse hand-made outlines; a NASA Blue Marble / Black Marble texture
  would be far better but needs a download (ask first).
- The voyage's Hal is the suit rig in parameter poses (hover, flyFast); no cape or secondary motion.
- Unlocking constructs is `powers.unlocked` plus the part's `unlocks`.
- Oa's city is primitives with a window shader: fine from the range, plain up close (flying low
  among the towers). Sky bridges, greebles or a real model kit would lift it.
- Seen from behind (the usual camera), the fist reads as a rounded block in flight; it reads as a
  fist on impact and from the side.
- Hal's hands are open in every pose (the scans have no finger bones).
- Hair simulation was deliberately skipped. Lip sync is a jaw only (no visemes, no lips rounding).
- Voices: an alien line (`alien: true`) still uses the synthetic buzz; Kokoro may mispronounce a
  new name (add it to the script's lexicon).
- `public/anims/soldier.glb` is built but unused. It could supply extra clips.

## Code map

```
index.html, src/style.css   UI layers (letterbox, HUD, subtitle, choice, cards, pause, checkpoint, loading)
src/main.js                 boot, loading, title / continue / chapters, window.__game
src/engine/                 Engine (renderer + post), Input, Physics (Rapier), CameraDirector
                            (follow / shot / orbit / shake), Time (game-time waits + tweens),
                            Audio (WebAudio synth), Voice (pre-rendered clips, lip-sync curve,
                            speech fallback), Save (checkpoints)
src/characters/             Rig + Animator, IK, Mocap, Poses, Player (walk + flight), Characters,
                            BodyLanguage (talking gestures), Guardian + Robe + HairCards (the Guardians)
src/powers/                 RingPowers (charge, health, wheel, aim, constructs incl. the sword, flight fx),
                            Constructs (list, shaders, fist / shield / wall / gatling / sword geometry, Blade)
src/scenes/                 Bedroom (+ hallway, kitchenette, buildJet; night or morning), Dream, Hyperspace,
                            CrashSite, Oa (Part Two) + Hall (the Guardians' hall), Space (Earth and Oa
                            from orbit), Ferris (Part Three: the airfield, the road, the lots)
src/props/                  Props (downloaded models: load, clone, helpers), Car (makeCar: paint, wheels,
                            the driver's door, seat / pedals / rim / tail points)
src/enemies/                Drones (training drones: model, spring flight, AI, bolts, breakup), Sinestro
                            (the sparring opponent: flight, blade, spikes, guard, slam)
src/fx/                     Sky, Particles + Fire, Water, Trees, GreenLight, Cloth, Textures, Rift
                            (pocket dimension), EarthMap (continent outlines, city-light density)
src/story/                  Story (Part One + shared plumbing, the lantern), Corps (Part Two, travel),
                            Coast (Part Three), Voyage (flights between worlds), lines (all dialogue)
src/ui/UI.js                HUD, subtitles, glyph cipher + decode, choice, cards, pause, toasts
src/ui/PowerHud.js          vitals, ring charge, armed construct, ring readout, reticle, marker,
                            training panel, target bracket, damage numbers, construct wheel
src/ui/TravelHud.js         flight readout, arrival card, StarMap (the ring's star chart), WORLDS
tools/                      build-assets, autorig, build-props, propview.html, fetch-textures, build-voices,
                            voices.html, strip-mocap, extract-posters, debug renderers
public/models, public/anims built GLBs loaded at runtime (props in public/models/props); public/textures/posters,
                            public/textures/pbr (Poly Haven surfaces); public/voices (clips + manifest.json)
```

---

## Change log

Newest first. Add an entry for every decent update (see the top of this file).

### 2026-11-10: voices, lip movement, the blanket, a staged wake, Coast City
- **Voices** (`tools/build-voices.mjs`, `tools/voices.html`, `public/voices/`, new; `Voice.js`
  rewritten; `kokoro-js` dev dependency): every line pre-rendered with Kokoro-82M from Hugging Face,
  each character pitched to a target (Kilowog 65 Hz, layered and growled). See *Voices*. The ring's
  four warnings moved from `RingPowers.js` into `lines.js` so they have clips too.
- **Lip movement** (`JAW` and the jaw shader in `Characters.js`, `Guardian.js`, `Story.updateMouths`,
  `MOUTH_GAIN`): see *Lip sync* under Characters.
- **Blanket** (`Bedroom.updateBlanket`, a plaid texture, toe capsules, `blanketWaist`): no toes
  or knees through it; it drapes, and folds to his waist as he props up.
- **Waking up** (`Story.getUpFromBed`, `rubFace`): in stages, not one motion. Used by Part One's
  light and Part Three's morning.
- **Coast City** (`Ferris.buildCity`, `Bedroom.buildStreetView`, new props: six office blocks, a
  street kit, a bus stop, a billboard, the gate booth; `Coast.drive`'s city leg): a boulevard of
  offices, palms, lamps and signals round Hal's lot, downtown towers behind, the street outside
  his window by day. The Ferris hangars, apron, roads and desert use Poly Haven textures
  (`pbrMaterial`, `tools/fetch-textures.mjs`). Prop textures seen far off are 512 px.
- **Also:** a downloaded fridge (its door on a hinge) and coffee maker in the kitchenette, the
  dream's jet is the downloaded F-104 (`Dream.starfighter`), Hal walks to his car and gets in
  (`Coast.getIn`). Ferris markings on the jet were tried with decals and dropped.
- Verified: see Status (2026-11-10, second round). Not verified: listening to the voices, frame
  rate in the city, a real-input playthrough.

### 2026-11-10: downloaded props, the car and getting out, the phone in the hand, the walk
- **The walk after the car** (the user: "can't walk properly"): Hal sank 9 cm into Ferris's 600 m
  ground box and stuck. Flat ground is now a heightfield (`Physics.fixedGround`).
- **Props** (`src/props/`, `tools/build-props.mjs`, `tools/propview.html`, `CREDITS.md`, new): the
  user asked for found models over procedural ones. Sixteen CC BY models from Objaverse replace
  the procedural car, lot cars, prototype, palms, apartment block and apron kit; the phone too.
- **The car** (`Car.js`, `Coast.drive`, `getOut`): Hal seated by solved leg IK (his legs went
  through the old car's floor), hands on the rim, the door opened and shut by hand.
- **The phone** (`Coast.holdInHand`, `Rig.palm`, `Animator.post`): flat in the palm instead of
  through it, the screen turned to his eyes; the model's logo removed, the lock screen drawn on it.
- **The walk** (`Mocap.relaxArms`, the tired layer filtered): the user said it looked effeminate
  ("arms look a bit bent"); straighter elbows and wrists, arms in at his sides.
- **The trunk scene**: Hal sits on the lid with his feet on the bumper (he stood through it).
- Verified: see Status (2026-11-10, props...). Not verified: real input, frame rate, audio.

### 2026-11-10: the Guardians, home before dawn, Part Three's morning and the firing
- **The Guardians** (`characters/Guardian.js`, `Robe.js`, `HairCards.js`, new): derived from Abin
  Sur's scan; reviewed internally over eight passes (a stiff robe, then a sack, then sleeves; the
  hair from a painted patch to cards; strands floating off the head), shown once and approved.
- **The hall and the council** (`scenes/Hall.js`, new; `Corps.js` `guardiansCall`, `council`,
  `rite`): the flight to the hall, the judgement, Abin Sur laid to rest, Sector 2814.
- **Home** (`Corps.homeward`, `backThroughWindow`): the jump, the voyage, the bedroom at 4:16, the
  suit dissolving into his clothes; Part Two's end card. Checkpoints `guardians`, `homeward`; the
  range's old end card is gone (`range` / `earth` are free flight).
- **Part Three** (`story/Coast.js`, `scenes/Ferris.js`, new; `CoastSave`; `main.js`): the morning
  after (`Bedroom` morning variant and kitchenette, phone, mail, notice), the car and the drive,
  Ferris Aircraft, Carol and the firing, the end card. The user chose the beats.
- **Carol** (the user's Tripo scan): `build-assets.mjs` entry (`keepSide`, `neckMid`, A-pose arm
  band), new `autorig.mjs` options `armLo`, `armTipIn`, `armMinY` (defaults unchanged), and
  `createCarol` (skin without the broken normal map).
- Also: `Story.perform` (moved from Corps), `BodyLanguage` `shift`, new sounds (`engine`,
  `starter`, `carDoor`, `buzz`, `voicemail`, `paper`, `fridge`, `traffic`, `birdsong`), voices
  `carol`, `tom`, `landlord`, the `phone` subtitle style, sky presets `morning` and `desert`.
- Verified: see Status (2026-11-10). Not verified: audio, a real-input playthrough, frame rate.

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
