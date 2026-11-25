# CLAUDE.md — Green Lantern: Awakening

The agent-facing guide: how the game is put together, how the user likes to work, and the traps
that have already cost time. `README.md` is the player-facing overview (controls, chapters, story).

## Keeping this file useful

- Keep it short. Edit the section a change affects so it describes the game as it is now, and
  delete what's no longer true.
- When a bug teaches something non-obvious, add one or two lines to **Gotchas**.
- History goes in commit messages, not here: no change log, no lists of what was verified.
  The long version of this file, with its change log, is in git history (`git log -p -- CLAUDE.md`).
- If players would notice a change (controls, checkpoints, story beats), update `README.md` too.

## What the game is

A browser story game in Three.js about Hal Jordan becoming Green Lantern, in parts. Each part is a
story class with its own save store and checkpoints. Checkpoint ids are unique across parts, so
`#id` in the URL jumps straight to one.

| Part | Class (`src/story/`) | Save key | Checkpoints |
| --- | --- | --- | --- |
| One, Awakening | `Story` (`Story.js`) | `gl_awakening_v1` | home bedroom light question crash abin lantern powers free |
| Two, The Corps | `Corps` (`Corps.js`, `Voyage.js`) | `gl_corps_v1` | summons voyage oa livefire sinestro duel guardians homeward range earth |
| Three, Coast City | `Coast` (`Coast.js`) | `gl_coast_v1` | morning drive ferris carol after wreck test catch hector grave |
| Four, The Prisoner | `Prisoner` (`Prisoner.js`) | `gl_prisoner_v1` | pilot cell site ysmault trial |
| Five, Probation | `Probation` (`Probation.js`) | `gl_probation_v1` | rent commute advance testflight pickup korugar patrol rebels report |
| Six, Exile | `Exile` (`Exile.js`), run as `Roam` (`Roam.js`) | `gl_exile_v1` | dawn palace tribunal firstnight qward yellow |
| Seven, Sapphire | `Sapphire` (`Sapphire.js`) | `gl_sapphire_v1` | ask pier strike hold trail zamaron queen predator return wheel hangar hand |
| Free roam (after Six) | `FreeRoam` (`Roam.js`) | `gl_roam_v1` | world |

- `world` is **free roam**, a feature of the game, not a part's chapter: opened by Part Six's end and there for every
  part after it, with what each one adds (Zamaron, after Seven). **Every part's ending sends the player to it
  (`RoamSave.resumeAfterReload('world')`), never back into the part that introduced it** (it used to be Part Six's
  last checkpoint: finishing Part Seven landed you "in Part Six"). It has its own store (`RoamSave`) and its own
  title button; it runs as `FreeRoam`, which is `Roam` (so what a new part adds to `Roam`, free roam has). A new
  part's hook in free roam (Carol in Hangar Two, for Seven) stops offering it once that part is finished.
  Free roam covers every world the story has visited (Earth's valley and Coast City, the
  lake, Oa, Korugar, Ysmault, Qward), travel by star chart or menu, Hal in the suit or his clothes,
  his car, a job at Ferris, money, XP, public opinion, traffic, emergencies, a day and weather cycle.
  `range` and `earth` are Part Two's free flight.
- **Part Seven is built**, end to end: `trail` (the breach's wake flown through space: `scenes/Wake.js`),
  `zamaron` (the valley, the Kept, the wardens, Carol over the dais: `scenes/Zamaron.js`), `queen` (Aga'po, the
  user's model, comes down out of the battery's light; Hal crosses her light on foot, the shield up for each
  wave; she seals him in crystal at the dais's foot; Carol, played, holds on to one voice and frees him),
  `predator` (the boss on the plaza, Carol beside him: `enemies/Predator.js`, `SapphireAlly`; then the queen's
  farewell: the gem becomes a violet ring on Carol's hand, the Kept are to be asked, the ring charts Zamaron),
  `return` (Earth's night side, the race to the pier, both out of their light on the deck), `wheel` (the pier at
  one in the morning: the hot dog stand, her father's bench, the wheel turned by one construct and ridden to the
  top), `hangar` (the morning after: he's fired, seven o'clock, rehired Monday) and `hand` (the sting: William
  Hand, the user's model, in the basement of his family's funeral home, `scenes/Mortuary.js`, with the heart of
  Atrocitus's machine; then the end card). Part Eight (Black Hand's story) isn't planned yet: discuss its beats
  first. Free roam has Zamaron once Part Seven charts it (`Roam.zamaronRoam`: two of the Kept gone home, the
  queen over her dais); the Zamaron scene's people are built in `Roam` for both (`setupZamaron`, `keptFigures`,
  `zamSapphires`; `Sapphire.zamSapphires` adds Carol and hides the queen till `queen`). The user's graphics and
  map rework (2026-11-23, their brief: a GTA-style Coast City peninsula, warm haze, a glowing suit) began with the
  performance pass (counter, palms, cars, Korugar's lights), the light pass (each scene lit by its own sky,
  warmer coastal light, Korugar's wet neon nights) and a polish pass measured step by step (softer, wider sun
  shadows and a cooler fill, contact shadows, worn roads and a kerb, roof silhouettes and wall-foot shade, night
  emissives and sodium lamps), and the map (2026-11-24, below: "Coast City's map").
- **Coast City's map** (the user's reference map, "not a hard goal"): a peninsula about 3 × 4 km with the sea west,
  Coast Bay south (the Bay Bridge on the road to the field), Coast River east, Port Haven north. `city/Layout.js` is
  the one description of it (coast, bay, river, basins, districts, parks, Highway 1, the hills and their ground,
  the bridge, names) and everything reads it: `Plan.js` (`cityCells()`: the grid's blocks where the layout has land
  for them, cut back from the water; `streetSegments()`: which stretches of street exist, read by the ground, the
  traffic, the people and the map), the terrain and water, the highway, the districts' builders, the map.
  `node tools/draw-layout.mjs out.png 3.4` draws it (`... 1.2 x z span` a close-up). What didn't move, so the story
  keeps its places: Hal's blocks and the grid round them, the pier (Part Seven is staged on it), the beach by it,
  the memorial park (now a block of its own on the bluff over the bay), the straight road to the field. Inside the
  districts the streets are the old grid (Hal's blocks stand on it); the curves are the coast, the river, the hill
  roads and the highway.
- **Story rules:** take beats from the comics (*Green Lantern: Secret Origin* first, modern
  continuity: no yellow weakness). When proposing beats, say which come from the comics and which
  are ours. Discuss a new part's beats with the user before building it.

Stack: `three` r0.187 (WebGLRenderer + EffectComposer), `@dimforge/rapier3d-compat`, Vite 8, Node
tools on `@gltf-transform`, `meshoptimizer` and `sharp`. Sounds are synthesised with WebAudio; spoken
lines are pre-rendered clips (`public/voices/`), with `speechSynthesis` only as an opt-in fallback.

## Working with this user

- **They supervise closely and are blunt about visual breakage.** Before handing anything over,
  look at faces, hands and deformation **in close-up** during the motion you changed, and from the
  camera angles the player actually sees. They catch contact errors: legs through a car floor, a
  phone through a hand, bent elbows and cocked wrists in a walk. They say "hands" for arms.
- **Quality bar:** nothing should look low effort or "done last minute". Prefer depth and polish to
  more features. Play it as a player would, in every place it appears, and fix what feels cheap even
  if it wasn't asked for; suggest the natural next touches and say which were your ideas.
- **Everything in a scene can be touched** ("GTA 5's level of interactability"): every prop goes
  through `props/Smash.js` as solid, loose, breakable or a car. Nothing without a collider. Check new
  scenes by walking into, flying into and hooking their props.
- **Props: find downloaded models, don't build them.** CC BY, CC0 or MIT only; check the licence and
  author on the source page, never from memory; look at each model in `tools/propview.html` first;
  credit it (`CREDITS.md` is generated by `npm run props`).
- **Characters:** the user makes key characters in Tripo and drops them in `assets/raw/`; integrate
  what they give you rather than repairing scans. Their Tripo credits are low, so for anything else
  look for open-source models (Rocketbox for people) or derive from existing scans, and tell them if
  nothing meets the bar. A woman can't be derived from the male scans: ask. When they say "I'm making
  X", leave X alone (no stand-ins).
- **Show each iteration of a new model and ask** (front, three-quarter, profile, eyes). Keep review
  sheets short: very tall images preview with banding.
- **NPCs need purpose:** jobs with visible steps, answers to Hal, talk he can overhear.
- **T changes him only out of sight** (the user, 2026-11-24, back to their 2026-11-18 rule after a day of
  "anywhere"): `Roam.watchers()` (`CityLife.seenBy`: near, looking his way, nothing between) refuses T, the
  car's change and travel off Earth, and the SEEN / OUT OF SIGHT badge shows it. Keep who counts fair: at 40 m
  and anyone facing his way, the street refused him for people a block off. In the air the ring sets him down first.
- **Movement and physics matter most.** Borrow established techniques (mocap, IK, motion matching,
  momentum steering) rather than inventing them. Lip movement yes; visemes and hair not needed.
- **Boss fights:** challenging like Resident Evil, not Souls. Spam gets very little; blocking and
  parrying open the opponent: "block, and then attack".
- **Efficiency matters:** small textures for distant props, instancing, lazy loading by part.
- **Their dev server runs on 5173: never kill it.** Run yours on 5180. After rebuilding models in
  `public/models`, tell them to hard refresh (Cmd+Shift+R).
- **File hand-off:** macOS blocks reading `~/Downloads`; ask them to copy files into the project
  (they sometimes land in `~/Documents`).
- They ask in plain language and expect the work done, then a clear summary: what changed, what you
  checked, what you didn't.
- **Controls they chose:** no jump, ever. `4` construct wheel (time stops), click to deploy; right
  click or `F` guard; double-tap Space flies (Space up, C down, Shift boost); `L` stores or summons
  the lantern; `E` interacts, and high in flight opens the star chart; `M` travel menu; `T` Hal or
  Green Lantern; `C` changes the view in the car and the jet (`V` toggles voices); `G` phone; `N` map;
  `K` ring stats; Esc or `P` pause. (`` ` `` is mine: the performance counter.)

## Commands

```bash
npm install
npm run dev        # Vite on http://localhost:5173 (strictPort)
npm run build      # production build to dist/; must be clean
npm run assets     # tools/build-assets.mjs: assets/raw/*.glb → public/models/*.glb, rigged (ONLY=name, DEBUG_DIR=dir)
npm run props      # tools/build-props.mjs: assets/props/*.glb → public/models/props/, and CREDITS.md
npm run people     # tools/build-people.mjs: Rocketbox avatars → public/models/people/ (FETCH=1 downloads)
                   # (both, and fetch-textures, write KTX2 textures with basisu: brew install basis_universal)
npm run voices     # tools/build-voices.mjs: lines.js → public/voices/*.mp3 + manifest.json (ONLY=keys, WHO=chars, FORCE=1)
npm run mocap      # tools/strip-mocap.mjs: assets/mocap → public/anims/
npm run posters    # tools/extract-posters.mjs
node tools/fetch-textures.mjs   # Poly Haven CC0 surfaces: assets/textures/pbr → public/textures/pbr/*.ktx2 (FORCE=1)
```

### Git and GitHub

- **The repo is public and open source by the user's choice**: https://github.com/abhiram1809/Lantern-Game,
  MIT (`LICENSE`), raw scans and videos included. Never commit secrets, tokens or personal data, and
  don't make it private. Commit and push only when asked.
- No `gh` CLI or stored login on this Mac. The user pastes a short-lived token for a push; use it for
  that one command only, then remind them to revoke it:

  ```bash
  T='<token>' git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo "password=$T"; }; f' push
  ```

- Keep every committed file under 25 MB (`assets/raw` and `assets/mocap` are committed).

## How the code works

### Map

```
src/main.js        boot, title / Continue / Parts / Chapters, loading plans, window.__game
src/engine/        Engine (renderer, post chain), Input, Physics (Rapier), CameraDirector, Time (game-time
                   waits and tweens), Audio (synth), Voice (clips, mouth curve), Save, Slice (building in slices),
                   Ktx2 (the compressed textures' loader)
src/characters/    Rig + Animator, IK, Mocap, Poses, Player (walk + flight), Characters (scans, shaders, JAW),
                   BodyLanguage, Guardian/Robe/HairCards, FlightSuit, People (Rocketbox)
src/powers/        RingPowers (charge, health, wheel, aim, guard, constructs), Constructs (list, shaders, geometry)
src/scenes/        Bedroom, Dream, Hyperspace, CrashSite (the lake), Space, Oa + Hall, Ferris (the field, the
                   road, Coast City's host scene), Site, Ysmault, Korugar + KorugarSigns + Statue, Qward, Wake
                   (Part Seven's flight through space), Zamaron, Mortuary (Part Seven's sting), DayCycle
src/city/          Coast City: Layout (the map), Plan (blocks, streets), Kit, Building, Signs (+ SignWorker), HalsBlock,
                   Interiors, Shops, Stock (the shops' products), HalsHome (Las Palmas), Homes (the residential streets),
                   Office, Lod, Lamps, Traffic, Tower, Stream, Ground + Terrain + Relief + Water (the
                   ground, the hills' ground, the water, the quay walls), Landmarks + Highway + Bridge (Highway 1, the Bay
                   Bridge), Parks (Coast Park, the plazas, the city's trees), Hills (houses, roads, the Observatory),
                   Port, Playland, Marina, Waterfront, Palms (every palm, near or as its picture), Homes (the houses' lots)
src/props/         Props (load, clone, helpers), Car (makeCar, planDrive), Smash (every prop touchable)
src/enemies/       Drones, Sinestro, Hammond, Atrocitus, Thunderers, StarSapphire (+ SapphireAlly), Predator
src/vehicles/      Drive (the car, raycast vehicle), Jet (flight model, mouse aim)
src/story/         one file per part (table above), Voyage, Roam (free roam), CityLife, DinerLife, KorugarLife,
                   Life, Work, Emergencies, Pressure, Trap, Album, Gym (the gym's workouts), Shopping (taking, carrying,
                   paying), Inventory (what Hal has on him), lines.js (all dialogue)
src/ui/            UI (HUD, subtitles, cards, pause, loading), PowerHud, TravelHud, VehicleHud, Phone, CityMap,
                   PerfHud (the ` performance counter), Inventory (the I screen)
tools/             asset, prop, people and voice builders, autorig, debug renderers, propview.html,
                   voices.html, fight-bots.js, sapphire-bot.js, sapphire-end-bot.js, story-monitor.js, people-test.js,
                   perf-probe.js (what each draw costs), look-shots.js (the same views at the same hours, to compare),
                   bake-window.js + .mjs (the view from Hal's window, baked for Part Three),
                   hood-shots.js + hood-ab.js (the residential streets' views and their costs, build against build), flicker.js,
                   shop-test.js (into a shop, aim, take, pay), prep-products.mjs (the products' downloads cut down)
```

### Boot and loading

- `entry.js` shows the loader while the game modules download. `main.js` starts Rapier and tracks
  the core scans, Xbot mocap and posters before showing the title. A selected chapter loads its part's
  code and scans with the overlay already shown.
- Continue is the checkpoint played last in any part (`latestCheckpoint()`). A part opens once the
  one before it is finished. A step that throws shows a "The story stopped" card offering a restart.
- **The loading screen** (`ui.loadStart(title, stages)`, `ui.loadStage(key, k)`, `LOAD_PLANS`) covers
  startup and the work between a chapter choice and its first frame. It ends when the scene fades in,
  control is given to the player, or a card takes over. Stalls keep the progress visible.
- Heavy scenes build in slices (`engine/Slice.js`: `sliced(steps, budget)`, generator steps that
  yield; `breath()` yields by message, since timers are throttled in hidden tabs).
  `Story.warmUp()` compiles shaders behind the loading screen in pieces.
- `assetUrl()` (`engine/Assets.js`) resolves public files under the Vite build base: every path to `public/` goes
  through it (the signs' worker is sent the base: `SignWorker.js`). `public/sw.js` caches models,
  textures, voices, animations and the signs' encoder under its own scope and refreshes behind it: bump a rebuilt
  scan's number in `SCAN_VERSION` (`Characters.js`). On a local dev host it asks the server first.
  JSON is never cached. Bump the cache version to replace the game's cache.

### Game time and the engine

- **Story timing uses game time** (`engine/Time.js`: `wait`, `tween`, `waitFor`, `onFrame`), not
  `setTimeout`. Game time pauses with the game and `engine.advance(seconds)` steps it.
- `engine.timeScale = 0` freezes the world while rendering goes on (the wheel, hit-stop). The frame
  callback gets `(dt, t, real)`; anything that moves while time is stopped uses `real`.
- Post chain: ScenePass → UnrealBloom → grade → Output. `ScenePass` (`Engine.js`, `engine.renderPass`) draws the
  scene into its own multisampled target (4×; the composer's own targets have no samples), and copies it out with
  the **NaN guard (keep it)** and the ambient occlusion (`fx/AO.js`, from its depth: `scene.userData.ao` the
  strength, 0.55 by default, 0 for none). `engine.gradeUniforms` drives the grade (dream sepia, flash, focus, hurt,
  choke, and a scene's own `uSat` / `uContrast` from `scene.userData.grade`, set by `setScene`). Resolution adapts
  to the frame rate, the samples going to 2× before any resolution; `localStorage.gl_res` and `gl_msaa` fix them,
  `gl_ao = '0'` turns the AO off.
- Each frame's matrices are worked out only where something can be drawn (`Engine.js` `updateDrawn`: hidden
  subtrees are skipped, marked to update when next seen). Between frames, read a hidden object's place only after
  `updateWorldMatrix(true, false)` (as `getWorldPosition` does).
- **Image light:** a scene with `userData.skyEnv` (Ferris, Korugar) is lit and reflected by its own sky dome
  (`fx/SkyEnv.js`: drawn into a PMREM without the sun's disc, again when the sky has changed, ~1.4 ms, at most
  twice a second); the rest still use the studio room (`engine.envMap`). The sky's light is dimmer than the
  room's: such a scene's `environmentIntensity` is about twice what the room needed by day, more at night.

### Story, checkpoints and saves

- `Story` is Part One **and** the shared plumbing: player, camera director, powers, HUD, dialogue,
  pause, the lantern, interactions, collapse. The parts extend it: `Story → Corps`, and
  `Story → Coast → Prisoner → Probation → Exile → Roam → Sapphire` (`Prisoner` also copies Corps'
  Oa, travel and Guardian methods onto its prototype; the list is at the end of `Prisoner.js`).
- Each part overrides `get save()`, `steps()` (checkpoint id → async chapter method) and
  `prepare(id)` (the world state a step expects when the game *starts* there). `run(start)` walks the
  checkpoints, saving each before its step. Restarting a checkpoint reloads the page
  (`Save.resumeAfterReload`, `gl_resume` in sessionStorage).
- **Adding a checkpoint:** an entry in the part's list in `engine/Save.js` (unique id), a step in
  `steps()`, state in `prepare()`. Then test it from `#id` **and** played on from the step before.
- **A chapter sets up what it needs itself** (suit, HUD, constructs: e.g. `Prisoner.lanternUp()`);
  `prepare()` never runs for a step that's played into.
- Saves (`createSave` in `Save.js`): one store per part in localStorage with a cookie mirror,
  `{ version: 1, checkpoint, reached, settings, stats, unlocks, worlds, savedAt, playedAt }`. Settings
  live in Part One's store; `allUnlocks()` / `allWorlds()` merge parts. **Bump the version for an
  incompatible change** (old saves then reset). Free roam's clock, money and XP are in `LifeSave`
  (`gl_life_v1`). Charge and health aren't saved: each checkpoint sets them.

### Scenes

- Every scene has `build()`, `update(dt, t, camera, renderer)`, `dispose()`, a `scene`, its own Rapier
  `physics` and `interactables`. Scenes are **built once and entered** (`show()`, `player.spawn()`,
  ground, sounds, `powers.attach()`, `lanternSpots(scene)`); travel goes back and forth, so they stay
  cached. Entering a place must spawn Hal in it and re-register any targets or markers
  (`powers.attach` clears them).
- Interactions: `scene.interact({ position, radius, look, label, action })`. The nearest one shows
  while the player has control; E runs it **with `story.busy` already set**.
- The **Ferris scene** hosts the airfield, the road and all of Coast City. `LOT` (6 km down the road)
  is the frame for Hal's building (Las Palmas, `city/HalsHome.js`: a Spanish Revival court of flats built from the
  kit with the block, two wings to the lot, the court and its gate between, the front range to the street; the
  doors `HOME_DOORS`, his window `WINDOW`), his two detailed blocks (`city/HalsBlock.js`) and the streamed
  city around them (`city/Plan.js` blocks from `city/Layout.js`, `city/Stream.js` builds blocks near the camera,
  boxes beyond; Hal's two outer halves are the cells with `half` / `halRow`). Traffic keeps right: southbound on the
  boulevard is its east half (x 6 to 10); its network is `streetSegments()`, the bridge's lanes and Highway 1's
  (`Highway.js` `highwayLanes()`).
- The shops' stock (`city/Stock.js`): the fit-outs place products (`PRODUCTS`, downloaded) with `stockRow` (facings
  along a shelf) and `stockHeap` (a crate's produce) into `ctx.stock`. Drawn as the goods atlas's boxes and cans (two
  instanced draws for the block) until the camera's within 4.5 m of a shop; then, the products loaded the first time,
  each one within 7.5 m of the camera as itself (a `BatchSet` a material, no shadows), its stand-in beyond. `phys`
  items stand on shelf colliders (a gondola's boards, not one box round it) and are knocked off lazily: Hal running or
  leaning into the shelf, a moving body touching one, a construct's sphere, a blow or blast through Smash (`blow` and
  `blast` wrapped); then a Smash 'loose' body, back in the batch where it sleeps. `story/Shopping.js` takes them
  (`stock.aim` along the camera's line), carries them (on his upturned palm, the hand turned in `animator.post`
  after the IK; a big thing between both palms), rings them up at the counter (`checkout`), puts them back, and
  minds the door; what's bought goes into `story/Inventory.js` (`story.inventory`, saved in LifeSave `inventory`).
  The I screen (`ui/Inventory.js`, the user's sketch) shows it with his fixed keys, wallet and phone, the ring's
  pocket (the stowed lantern, keepsakes by the checkpoints reached), Life's grades (`Life.condition()`) and the stats
  (`Life.tally`: constructs, metres flown and driven, property in dollars). `tools/shop-test.js` drives a shop.
- The residential streets (Suburbia, Bayside, Coast Heights, the outer halves beside Hal's blocks: 2026-11-24) are
  lots, `city/Homes.js` (`planLots` from `Stream.replanCells`, `yard`, `garage`, `dingbat`, `homeExtras`, `alleyLine`):
  Spanish Revival, Craftsman, ranch, postwar boxes, dingbats over carports and bungalow courts, a style leading each
  face (`styleMix` by where the block is), garages beside the house, at the back of the drive, on the alley or (a
  corner's) on the side street; one tree kind down a street's parkways (`STREET_TREES`); parked cars in some drives
  (Smash's, through `Lod.addCar`, made after the block's colliders, asleep). Building.js has what they need, opt-in by
  spec: `roof: 'gable'` (`ridge` 'x' or 'z') and `'slab'`, `roofMat`/`roofColor`/`eave`, windows as `{ u, w, h, v,
  pic, lites }`, `flatColor`; `s.lot` makes the tile eaves lighter. A block of lots' trim is gathered by colour
  (`Kit.js` `Sink`) so each near material is one draw. Look at them with `tools/hood-shots.js` (`shots`, `lotShot`).
- Water: one surface at `Terrain.js` `WATER_Y` (-1.5, so the quay walls show), sea, bay, river and basins alike; the
  ground's height is `Ferris.groundAt(x, z)` (the water's surface over water) and `Ferris.waterAt(x, z)`, the
  terrain's baked from the layout (`Terrain.js`: a signed distance to the water). The ring takes the scene's water
  height (`powers.attach({ water })`). In deep water Hal can't swim: in the suit the ring lifts him out, in his
  clothes he's put back ashore (`Roam.updateWater`).
- Grounding: the sun's shadow box is 120 m across round the player (`shadowSpan(60)`), softened by `shadow.radius`;
  every Rig's root is in `contactBodies` and gets a footprint under it, as do the scene's cars
  (`fx/ContactShadows.js`: one instanced draw, a ray down for each). The roads' tyre tracks and ruts are
  `WEAR_GLSL` / `wearRoad()` in `city/Ground.js` (`cityU.uWear` turns them off). The far city's roofs are
  `Stream.buildRoofs` (hidden with their block's box in `farShow`).
- Coast City's haze takes the colour of the sky behind what the camera looks at (`Ferris.update`: `fogBase`
  turned toward `skyColor()` by `hazeSky`); its presets and `DayCycle` set `fogBase`, not `fog.color`. The
  palms' fronds glow by an emissive map in daylight only (`palms.daylight(k)`).
- Other worlds: `CrashSite` (the lake, `terrainHeight`), `Oa` + `Hall`, `Space` (planets from orbit,
  `Voyage.js` routes), `Site` (downtown at night), `Ysmault`, `Korugar` (built, not downloaded;
  `night(on)`: wet streets, the screens' and neon's light in them, `KorugarWet.js`), `Qward`, `Wake` (no ground: Hal can't land; `track(p)` is how far off the line he is),
  `Zamaron` (downloaded crystal re-skinned by `fx/Crystal.js`; the Kept are `kept[i].hold(rig)`).

### Dialogue and voices

- Every line is in `src/story/lines.js` (`LINES[key] = { who, text, alien?, style? }`). Play with
  `say(key)`, `lines(k1, k2)`, `bark(key)` (Hal while the player has control: not skippable by
  clicks), `ringSay(key)` (the ring's readout; don't `await` it in training flow), and
  `perform(body, key, cues)` (gestures and head beats cued to words). `ui.overhear()`, `ui.pick()`.
- **Add a line to `lines.js`, then run `npm run voices`.** Kokoro-82M renders each character's voice
  (pitch and effects per character in `CHARACTERS` in the script). Clips are keyed by `who|text`, so
  a changed text needs re-rendering; a line without a clip plays silent with its subtitle.
  `alien: true` lines use the synthetic buzz. Add misread names to the script's lexicon.
- The manifest (`public/voices/manifest.json`) holds each clip's duration, word timings and mouth
  curve; `Story.updateMouths` turns the speaker's jaw from it. `tools/voices.html` auditions lines.
- People with lines of their own, as Ray has (voice `clerk`): Sami at the Blue Marlin's bar (voice `sami`; `lines` to
  Hal and `glLines` to Green Lantern on his SHOPS regular, his talk with Doris and Gus in CityLife's `TALKS`, his word
  on what Hal orders `CityLife.barChime`). A post's own `lines` / `glLines` beat the voice's generic `TALK`.

### Characters and animation

- **Pipeline** (`tools/build-assets.mjs`, `MODELS`): decode, orient to Y-up facing +Z with feet at 0,
  scale to height, weld, simplify, **auto-rig** (`tools/autorig.mjs`: 17 translation-only bones, joints
  from anatomical landmarks, a jaw-line override that puts the face on the head bone), WebP textures.
  Per-model `rig: {}` overrides merge over `RIG_DEFAULTS` (`arms` gives the arm joints outright, in
  metres); `keepSide` / `figure` pick figures from a sheet; `merge` handles models made of parts;
  `rigidPieces` gives each piece of hard armour one bone.
- **After any rig change, and before building a new model into a scene**, look at the rig previews
  (`DEBUG_DIR=dir ONLY=name npm run assets`: in `_bones.png` every joint sits inside its limb and each
  limb has its own colour; `_posed.png` bends it) and check the weights:
  `node tools/inspect-weights.mjs public/models/hal_casual.glb out.png` (face and jaw solid red).
- Derived characters are shader layers over scans (`Characters.js`): Sinestro and Korugar's people
  from Abin Sur's scan, the Guardians and Weaponers (`Guardian.js`). `JAW` holds each scan's mouth
  seam, set by eye with the mouth held open.
- `Rig.js`: parameter poses (`Poses.js`) and quaternion poses; the `Animator` crossfades generators
  and layers breathing, lean, gestures, look-at (keep it gentle), arm IK (`reach`, blended between
  targets) and foot IK; `animator.post` runs last.
- `Mocap.js` retargets Mixamo's Xbot clips onto every rig (`MAP`, world-delta retargeting);
  `Locomotion` blends idle, walk and run by speed with the gait advanced by distance;
  `relaxArms` and `smoothArms` fix the clips' bent arms and idle tremor.
- `People.js` / `build-people.mjs`: Rocketbox avatars re-skinned onto our skeleton at build time,
  keeping fingers, eyes and seven blendshapes.
- `Player.js`: momentum ground movement, flight, `strafe` while a held construct is up. **`walkTo`
  does nothing while `player.control` is true and only runs on the ground** (use `Story.touchDown()`
  after flights and fights; `standDown()` after seats). Mount rigs with `player.mount(rig)`.
  `player.ground` feeds the foot IK. Off the ground nothing walks: `fallGen` (Poses `falling`: let down upright by
  the ring in the suit, `canFly`, its speed held to what's under him, `groundBelow()`; arms out falling in his
  clothes) and `touchGen` (the knees taking the touch down, `softLand`); the hard landing's crouch past 9 m/s.

### Powers, props and fights

- `RingPowers`: charge, health, the wheel, aim (camera ray, aim assist), the guard and **parry**
  (`guardHit`: a shield raised within 0.5 s of a blow), and the constructs (`CONSTRUCTS` in
  `Constructs.js`, wheel order). Targets are any object with `{ body, collider, position, radius,
  health, maxHealth, alive, hit() }`; `dealDamage(target, amount, point, dir, kind)`. Construct looks
  come from `constructMesh()` (depth pre-pass, translucent body, additive outline).
- `props/Props.js`: `loadProps(names)` once per set, `prop(name)` clones; roughness floored on load.
  `props/Smash.js`: solid, loose (real mass), breaks (`strong`), car (dents, glass, fire, explosion);
  blows arrive through the ring (`shove`) and collisions (contact-force events).
- `props/Car.js`: `makeCar` dresses a car with seat, pedal and wheel points; scripted driving is
  `planDrive` (the rear axle on arcs and straights, a stop between forward and reverse), checked
  against everything near the path.
- **Bosses read Hal** (Sinestro, Atrocitus, Star Sapphire, the Predator): `stance()` and `LANDS` scale each
  blow by how open they are; between attacks they turn blows and answer them; a parry exposes them; poise
  breaks an attack only with a real hit; a held shield gets flanked. Test balance with bots:
  `tools/fight-bots.js` (`setupDuel()`, `setupSite()`, `run(secs, 'hookSpam' | 'gunSpam' |
  'blocker' | 'turtle')`), `tools/sapphire-bot.js` and `tools/predator-bot.js` (`toFight()`, `fight()`,
  `sequence(kind)` to shoot one attack); compare damage dealt and taken.
- The Predator is a downloaded wyvern on its own skeleton (`createPredator`): in-place clips cut from its
  two, layers turned about the creature's own axes in the world (rear, lunge, neck aim, jaw, tail, wings),
  three hit parts (head, body, tail) on kinematic sensor capsules following its bones, one health.

### Performance rules

- Measure first (2026-11-23 round two: street 11 PM 14.1 → 11.1 ms, Korugar 7.1 → 4.9; 2026-11-24 the map put the
  street at 13.6 ms and 457 static draws, and its pass took it to 10.4 / 301, against the last commit before the map's
  11.6 / 376 timed the same session; serialised CPU + GPU):
  `` ` `` shows the counter (`ui/PerfHud.js`: frame, GPU time where the browser allows it, draw
  calls and triangles with the shadow pass's share, lights, buffer sizes); `tools/perf-probe.js` lists what each
  draw costs (`table()`, `table({ by: 'root' })`, `systems()`), times a frame (`time()`) and its CPU and GPU apart
  (`split()`, after `view(i)` stages a benchmark view). `bench(label)` runs the four
  standard views (downtown 6 PM, the street at 11 PM, a parked car by day, Korugar's plaza) and keeps the numbers
  in localStorage across reloads; `deltas([...labels])` compares runs. Set `localStorage.gl_seed` first; traffic and
  people still vary by ±20 draws, so judge by `staticCalls` / `staticShadow`, and time one change on and off in
  the same session (a uniform or `visible`) rather than across reloads. On Hal's street half the frame was
  the CPU issuing draw calls (about 6 µs each), so count calls, not only triangles. `time()` waits for the GPU
  each frame, so it's CPU plus GPU; in play they overlap. The GPU is shared with whatever else is running: for a
  GPU cost, time the pass alone in a loop inside one timer query, or alternate on and off and take the minimum.
  Two tabs of the game slow each other (22 → 27 ms, both): to compare against an older build, check it out in a
  worktree, serve it on 5181 and bench it in the same tab, one build after the other.
- Textures: the props', the people's and the surfaces' are KTX2, UASTC (`tools/texture-fit.mjs`, `basisu`): one
  byte a texel on the GPU (ASTC here, BC7 elsewhere), a quarter of RGBA8, and sharper than the WebP they replaced
  (a face's colour map: 51.7 dB against 40.3; Basis's smaller ETC1S mode, 37.8, is worse than the WebP). Each build
  caps a map at its `tex` and at one texel a pixel from the thing's closest view (`near`), halves it while it still
  rebuilds within a tolerance, and folds a one-colour map into the material's factors. Load them through
  `engine/Ktx2.js` (`setKTX2Loader(ktx2)`, `ktx2Texture(url)`). `tools/texture-probe.js` lists what's on the GPU by
  owner and file: Coast City 2026-11-23, 2,742 → 1,073 MB (props 720 → 153, people 678 → 113, cars 460 → 111,
  surfaces 235 → 47). The price is download: those files went from 168 to 472 MB.
- The shop signs (`city/Signs.js` `SignPages`) are 2048² pages on the GPU only, each sign drawn on its own canvas and
  copied into its place (`copyTextureToTexture`; `flush()` makes the mipmaps after), packed by max rects, lightboxes
  and boards on the same pages. The streamed city's are recycled: each block counts the signs it uses
  (`ctx.signUses`), and a page none of whose signs is in use is cleared and filled again. A full page is sealed (the
  streamed city's when the next is begun, Hal's blocks' and the office's once built: `sealAll()`) and compressed to
  UASTC in a worker (`city/SignWorker.js`, Basis Universal's WASM encoder in `public/basis/`, Apache-2.0: ~3 s a page,
  160 MB while a worker's up, put away after 30 s idle), 22.4 → 5.6 MB a page; only the page being filled stays RGBA.
  2026-11-24, arrival in Hal's street: 358 → 91 MB (before, the pages also grew without end: 43, 962 MB, over 80
  blocks). The weathering is seeded by the sign's words and size, so a sign is the same every time it's drawn;
  `localStorage.gl_signs_rgba = '1'` leaves the pages uncompressed, to compare.
- Point lights: four for a whole scene, handed to the nearest sources (`city/Lamps.js`, `LampPool`;
  `adopt(light)` takes over a light something else made and follows its intensity). Every point light
  costs every lit pixel, and changing the count recompiles every material.
- Distance culling, merged statics and car LOD tiers: `city/Lod.js` (a car: its parts within 15 m, merged,
  simplified, then past 75 m `flatCopy`, one vertex-coloured mesh and its lamps). Static repeated props are
  instanced; static matrices frozen; small things and room contents cast no shadows.
- **Culling and batching** (the perf pass, 2026-11-23; the night street went 1,086 → ~400 static draws, 1.6 M → 0.4 M
  shadow triangles, 20 → 14 ms):
  - Occlusion (`engine/Occlusion.js`): a scene's `userData.occlusion` tests big pieces' boxes against the frame's
    depth with GPU queries, the boxes drawn in the scene's own render after the opaque things (`ask(camera)` before
    it, `after()` once it's answered); the streamed blocks are in it, the shore's parts (port, beach, Playland, the
    marina: `Waterfront.js`) and the memorial park.
  - Batches (`BatchedMesh`): Hal's block's props and doors one per material (`Lod.js` `BatchSet`; `move(e, M)` for
    a door swinging, per-copy colours), the streamed blocks' walls, glass, roofs, signs and night light one per
    material (`Stream.js` `CityBatches`: one is drawn only while a copy in it is shown, culled whole by a sphere round
    those; 46 of the street's 51 drew nothing). A batch keeps a copy of all it holds in memory: the trim (barrel
    tiles, sills) stays in per-block meshes that free theirs once uploaded (batched, the city held 553 MB of it).
  - Far cars (`Lod.js` `FarCars`): past `far` (24 m, parked 16) every car of a model is one instanced draw, paint per
    instance (`userData.paint`, `aPaint`), lamps lit from their materials; every car's shadow is its model's shape
    from a shadow-only copy, its own parts cast none.
  - Props (`HalsBlock`): what's touchable and not a car or glass is drawn instanced (`Lod.js` `InstanceSet`: each copy
    within its distance, a shadow-only copy within its shadow distance) until `smash.watch` sees its body move; then
    it's shown as itself. Hal's block merges by material in 600 m cells, their grid off the blocks (`at`).
  - Smash's fixed stand-ins with nothing to draw (a collider for an instanced copy) are kept in a hidden group
    (`smash.stands`, `stow()`), out of the renderer's walk of the scene; one that breaks goes back into the scene.
    The map's 7,800 of them, each visited in every pass, were 1.5 ms of the street's CPU.
  - Far copies in one draw: the memorial park beyond 280 m (`flatCopy`, its cypresses as spindles), the Bay Bridge
    beyond 600 m (`Landmarks.js` `farBridge`: its lit parts kept), Highway 1's piers in its far copy (its columns,
    masts and gantries instanced only for the near chunks). A far copy's colours are its textures' averages
    (`Lod.js` `average`; a compressed texture's on the GPU, `Ktx2.js` `averageColour`).
  - A room's small things are drawn only while the camera's near it (the diner's plates and mugs: `DinerLife`).
  - Shadow-only stand-ins live on layer 1, which every shadow camera sees (`Engine` patches `shadowMap.render`) and
    the camera never does: scans' simplified twins (`Rig.js` `shadowTwin`, a fifth of the triangles; set a twinned
    mesh's shadow with `(m.userData.twin ?? m).castShadow`), palms' cards, cars' models.
  - Characters are frustum-culled by a bind-pose sphere 1.6× wide (they were never culled). Idle particle systems
    aren't drawn. Coast City's desert shrubs hide from the streets.
  - Scans draw at their height on screen (`Rig.js` `detailLevels`): all of it over 260 px, then 30%, 10% and 3.5% of
    the triangles over the same vertices (Korugar's plaza 949 k → 190 k triangles). A figure whose depth is drawn
    first from its whole shape sets `userData.noLod`. A downloaded prop of many parts goes through `flatten` before
    it's placed (Zamaron's plants were 3,100 draws: 46 parts a flower).
  - Far shadows: with the camera high, Ferris widens the sun's box in steps to ±450 m ahead of it (`spanFor`, never
    under a chapter's `shadowSpan`) and the far boxes cast (`Stream.farCast`).
- What casts shadows in a city batch is decided in `Kit.js` (`NO_SHADOW`: glass, lamps, signs, glow, road paint,
  floor tiles, decals, painted trim). A batch piece in a material its block didn't draw before costs a draw in each pass: put
  small additions in the block's existing materials (`metal`, `roofing`).
- Palms go through the scene's palm field (`Ferris.palms`, `city/Palms.js`: `add(kind, matrix)`, `addPair`,
  `remove(id)`), never as meshes of their own: the model within 90 m, its impostor beyond. The collider is
  still made where the palm's placed.
- Per-material numbers go in uniforms, not into shader source (or each material gets a program).

## Testing in the browser

1. **Mute when testing** (and always if asked): `localStorage.gl_mute = '1'`; voices off in the save
   (`Save.setting('voice', false)` before Continue) so lines don't hold fixed-step tests.
   `localStorage.gl_res = '1.5'` for comparable captures.
2. Run your own server on 5180 in the background, then attach the pane with the url-only config
   `lantern-attach` from `.claude/launch.json` (starting a command through `preview_start` hangs):

   ```bash
   SHOT_DIR=<scratchpad>/shots node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort
   ```

3. Size the viewport first (`resize_window` 1024×640; a hidden pane is 0×0 and throttled). Reset it
   to `desktop` when done.
4. Jump with a hash (`http://127.0.0.1:5180/#question`), click Continue.
5. Step and capture: `await __game.shot('name', seconds)` advances in fixed steps and saves
   `$SHOT_DIR/name.png` (1536×960, no HUD: use a pane screenshot for the HUD). Poke state through
   `window.__game` (`engine`, `story`, `ui`, `input`). Synthetic `KeyboardEvent`s and mouse events on
   the canvas work; two `Space` keydowns within 300 ms fly.
6. Helpers: `tools/texture-probe.js` (the textures on the GPU by owner and file; `ab()` draws one frame
   with the textures from before a rebuild and after), `tools/story-monitor.js` (`run()` steps a chapter
   with the engine paused, logs lines and flags bones moving faster than a body can, whole-body flights
   included; `around(prefix, rig)` saves close-ups of a figure and its hands in whatever pose it's in), `tools/fight-bots.js`,
   `tools/sapphire-bot.js`, `tools/people-test.js`, `tools/propview.html?src=…`.
7. Check faces and contact in close-up for anything touching skinning, poses or look-at.
8. `npm run build` at the end; stop your server. If the user is playing on your server, open your own
   tab (`tabs_create`), drive it with `engine.advance()`, and leave the server up. Every source edit
   reloads all tabs.

## Gotchas

**Testing**
- Travel sets `roam.where` and leaves control on all through the voyage: wait for the place's own scene
  (`story.current`, not `Space` or `Hyperspace`) before placing him (`place` threw on a freed controller).
- Test each step from its hash and played on from the one before; `prepare()` can hide what a step
  forgot to build. Read what a step builds only after building it.
- Press E with `KeyE` events, not by calling the action: actions run with `story.busy` set, so a
  `if (this.busy) return` guard makes E silently dead.
- Test the end of every fight with Hal in the air, and every new interaction by walking up to it.
- The test tab pauses itself once the player has control (no pointer lock), so step
  `engine.advance()`; never `await` a story promise without stepping. A pane screenshot after stepping
  shows the last drawn frame: `engine.frame(0)` first. A hidden tab throttles
  `requestAnimationFrame` and timers to ~1 Hz: in-page loops yield by `MessageChannel`.
- A loop of `engine.advance()` never yields to the network: yield a macrotask per step when loading.
- A pending restart (`gl_resume`) beats the URL hash: `sessionStorage.clear()`. Going from `/` to
  `/#id` is a hash change, not a reload: use `/?r=1#id`.
- `#screen button` also finds the last card's buttons: click `#screen.show button`.
- Only POST to `/__shot`: a GET with no body crashes the dev server.
- The loading screen's state is `ui.load` (null when it's gone); boot is a loading screen too (`LOAD_PLANS.boot`), ended by the title's card.
- A service worker left from earlier sessions on 127.0.0.1:5180 can break new model files: unregister
  it and delete its caches from the page.
- `shot(name, 0)` renders the camera from before a `director.cut()`; step a few frames after a cut.
- Probe state in the same call that reaches the moment, with `engine.paused`; the tab runs on between
  calls. Measuring a frame counts the game's own frames too: pause and render one frame by hand.
- Flicker tests: render twice with the camera moved 0.5 mm (z-fighting flips whole areas) or 3 cm
  (crawling lines); move `director.pos` / `look`, not `camera.position`.
- Check rooms and spots with Hal's capsule (`world.intersectionsWithShape` on a grid), not by eye.
- Parse a changed file (`rolldown/parseAst`) before reloading: a comment pasted mid-line can swallow
  the rest of it.

- Agents in worktrees start from the GitHub commit (origin/main), not the local main: reset theirs to main first.
  With `node_modules` symlinked into a worktree, Vite won't serve the KTX2 transcoder (every texture missing): run
  it with a config adding the main checkout's `node_modules` to `server.fs.allow`.
- Lines held by voices wait for real time, and cutscene lines for a click: voices off (`Save.setting('voice',
  false)`, `import('/src/engine/Save.js')`) and click the canvas while stepping a chapter.

- A filler that skips what doesn't fit must stop when nothing in its mix fits: `stockRow` looped for ever on a top shelf
  too low for every bag in its mix, and the tab froze (close it and open another: a frozen tab won't navigate).
- Run the dev server on a port nobody's using (`lsof -iTCP:<port> -sTCP:LISTEN`): another agent's server answered on
  5184 and the test's localStorage went to it.

**Story flow**
- A new world goes in every planet table in `Voyage.js` (leaving Zamaron threw: it was missing from the departures,
  and Hal was left in space).
- The loading screen stays up until a fade up, `giveControl()` or a card: a chapter that opens on a cut with no fade
  (the way home's orbit) plays out behind it. End it (`ui.loadEnd()`) on the first picture.
- A chapter method can't share a name with a story field (`site`, `pilot`, `trail`): the field wins. The
  `site` step's method is `atrocitus()`; `trail`'s is `followWake()`; the flight-suit rig is `pilotRig`.
- A part's end card that starts the next part must save this part's last checkpoint first.
- A scripted jet or NPC must wait for the player: slow its clock while it's off screen.
- `warmUp`'s far pieces compile after the chapter has begun, so its `prepare` must undo to the state
  as it is by then, not a fixed one (the pier's night ran with dusk's lamps: `Sapphire.pierLamps`).
- A goal zone must sit where the player sees the goal, and say on screen why a near miss doesn't count.
- An interaction placed inside a prop's colliders never shows; prefer a prompt that says why not.
- Look-at targets outlive cuts: aim heads at what the next shot holds before the fade (Hal turned back
  to a warden still standing at the court), and place walkers in the dark, not after the fade up.
- Nothing fades the grade's `uFlash`: whatever sets it fades it, including a chapter entered from one.
- Camera helpers in absolute heights break on raised floors (the pier's deck is 4.2 m up); work
  relative to the player or a head bone. Cameras placed by offset can land inside crowds and buildings.
- Spawn enemies relative to the player, not the arena.
- The guard needs `powers.enabled.constructs`: turning constructs off takes the shield too. `player.knock` is the
  Predator's; the player's own push is `player.dash(dir, speed, dur)`.
- `powersFor()` turns flight and constructs back on for the suit: indoors (`Roam.indoors`, his flat) it has to keep
  them off, or a change in the hall let him take off, and flying, interactions and T are gone (the user: "once I
  enter the home, I cannot get out").
- A view turned by yaw and pitch: `(d.z, 0, -d.x)` is the *left* of `d`, so pitching about it turns the wrong way
  (Carol's hold had the mouse and W/S inverted).
- A body on a ball joint (the gym's bags and gloves, `Shops.js` `hang`) went over the top of its beam and through the
  ceiling from one construct's hook: past 70 degrees off the plumb it tears loose instead (`physics.beforeStep`).
- A deck over the water (the bridge, the highway's arches) is somewhere to land (`canLand`), never the flight's
  `ground`/`floor`: as ground it lifted him onto the deck whenever he flew under it.

**Physics**
- A sensor collider blocks the character controller unless its filter skips it (`Player.filter` does):
  the Predator's sensor capsules held Hal inside it.
- Walk on boxes, hull prisms or heightfields (`physics.fixedGround`): the character controller sinks
  into Rapier cylinders and into very large boxes.
- Fixed colliders through Smash pass `shrink: 1` (the default shrinks boxes 6% and leaves gaps).
- Never create a body where another already is; a kinematic body walking into a dynamic one shoves
  it (people's capsules are in no collision pairs).
- A body removed from the world but left in `physics.dynamics` panics Rapier (`Smash.remove`).
- The ring's impacts only damage bodies in `physics.dynamics`, and an impact skips what its sweep
  already touched.
- Locking a body's translation stops its friction; `setCanSleep(false)` for scripted falls (on the
  body's desc: a made body has no `setCanSleep`).
- Rapier's wheel brake is an impulse per step: pass force × dt. `Player.place` must clear fall speed
  and end a scripted walk (it does: a walk left running turned him back toward its old target).
- The controller sometimes returns no movement on a flat floor box (`floorOnly` retry in
  `updateGround`). A ray exactly on a heightfield's cell line can miss.
- Camera and aim rays must skip invisible walls and dynamic bodies.
- `removeFromPhysics` frees the controller with the body (`kcc` null): `place()` while he was out of the world (a
  rift, the car) reached into the freed one and threw (`enableAutostep` of undefined).

**Rendering**
- One NaN pixel becomes black blocks under bloom (keep the guard; don't normalise zero vectors).
- A half-size pass reading a full-size depth texture at its own pixels' centres reads on the line between two texels:
  snap to a texel's centre before rebuilding the place (the AO banded flat ground). A depth-weighted blur needs its
  own texel among its samples, or every weight underflows and an edge comes out black.
- Multisample only the scene's target: the composer's full-screen passes drew four samples a pixel and resolved
  each (4.5 ms of 9.4).
- Bloom whites out bright things: keep constructs under ~1.5 and stars under ~1; dim coloured light
  columns; beware big sprites and close lenses.
- Huge ground planes z-fight: cut them into tiles (`flat()`), near plane 0.1 outdoors, nothing layered
  1 mm apart. Move a following shadow box in whole texels (`Ferris.focus`).
- Anti-alias procedural lines and windows with `fwidth` and fade sub-pixel patterns to their average;
  paint canvas glow maps on opaque black (transparent canvases upload un-premultiplied).
- `onBeforeCompile` reading `instanceMatrix` needs `#ifdef USE_INSTANCING`; `Material.clone()` drops
  `onBeforeCompile`. Adding or removing a light recompiles every material.
- Mirror-smooth downloaded materials catch the environment map as glowing blobs: floor roughness.
- Transparent things at zero opacity still draw; the shadow map is a second pass of every caster.
- `compileAsync` on a whole scene stalls: split it. A scene's first draw uploads all its geometry.
- `mergeGeometries` returns null on mismatched attributes. `Color.multiplyScalar` is linear.
- Geometry whose arrays were freed (`freeArray`) can't be measured: compute bounds first.
- `getImageData` / `putImageData` ignore a canvas's transform: drawn into a page, each sign's weathering read the
  page's corner (its first sign bleached, every other one never worn). `glowTexture()`'s default mid-tone is green.
- Whatever letters the streamed city's sign pages for good (the waterfront) passes a `signUses` it never releases, or
  its page looks unused and is cleared under it. A sign page lives on the GPU only: read it back through a framebuffer.
- A camera inside a translucent construct tints the frame. A glow tube the camera flies inside is seen
  edge-on and vanishes under a view-angle falloff: draw a thin core faded near the camera (`Wake`).
- A bright point light on glossy pale stone (or polished steel: the mortuary's drawers) blooms into a white sun:
  roughness 0.6 or more under it.
- three.js leaves out a shader define whose value is `false` (`#define X false` never appears, and `X ? a : b`
  doesn't compile): give defines 0 or 1. A shader that fails to compile draws nothing and logs little.
- An impostor painted into a texture: draw it premultiplied on clear black, and divide by alpha when sampling,
  or its thin parts fade to the clear colour in the small mips (the palms' cards went dark with distance). Paint
  the emissive map as well as the colour: two of the palms' frond materials glow by one.
- A sky-lit scene lights its interiors with the sky too (Korugar's tavern went orange by day, violet at night):
  damp the image light and turn the hemisphere fill to the room's own colour while the camera's inside
  (`Korugar.update`, `lightBase`). Code that saves a scene's light values must read the base, not the damped.
- GLSL in a JS template literal: a backtick in a shader comment ends the string; `half` is a reserved word.
- three r187 has no `PCFSoftShadowMap` (it warns and uses PCF): softness is `shadow.radius` on `PCFShadowMap`.
- r187's `vColor` is a vec4: a shader replacing `color_vertex` writes `vColor = vec4(1.0); vColor.rgb *= …`.
- WebGL answers occlusion (and timer) queries only after control returns to the browser: a test that renders frames
  back to back never sees them; yield a task between frames (`bench` does).
- The scans' vertex positions are interleaved (decoded meshopt): copy them out (`getX/Y/Z`) for anything that reads
  `.array` (meshopt's simplifier).
- Each car clones its materials and owns its geometry (to be dented), so nothing about two cars is shared by identity:
  key copies of them by model name and part names (`FarCars.model`).
- Hal's street's surface isn't the city's ground: the road in from the field (`Ferris.buildRoad`, x 2–10, 1.2 cm
  up) runs on up to his lot over it. A change to how the city's roads look needs both (`wearRoad`).
- Derivatives (`dFdx`) inside a branch that differs between neighbouring pixels are undefined: work out a bump's
  height outside the branch (the roads' ruts).
- A camera-facing card in the shadow pass faces the sun: its material needs `shadowSide = DoubleSide` (a
  front-faced material's shadow is drawn from its back) and a `customDepthMaterial` with the same vertex code.
- An `EffectComposer` given its own render target takes the target's size for the window's and multiplies by the
  pixel ratio again (the bloom ran at 2.25 times the pixels): `composer.setSize(innerWidth, innerHeight)` after.
- Two systems setting one object's `visible` fight: `Lod` acted only when its own answer changed, so a traffic
  car taken out of its pool 300 m away stayed drawn whole (69 draws each, five of them). What shows or hides a
  Lod-managed object calls `lod.recheck(object)`; `userData.away` keeps it hidden at any distance.
- A district's `Batch` built in small cells (`build(mats, { cell })`) is a draw a material for every cell in view:
  the marina's 120 m cells were 24 of Hal's street's draws from a kilometre off. Cells as big as the district.
- A set built for a chapter's close-ups is seen from all over town once it's in the city (the memorial park: 500
  draws, 790 k triangles of headstones, from Hal's street): merge it by material (`mergeByMaterial`) and swap a
  simplified copy in at a distance (`Ferris.cemLod`).
- A merge's cells cut where their grid's lines run: Hal's street had x = 0 down its middle, and every material of
  his blocks was two draws in each pass. Keep the grid off what's merged (`Batch.buildSteps({ at })`). The streamed
  blocks' 4 km grid split every block across z 0 (the ones round Hal's lot) the same way.
- A `BatchedMesh` takes its attributes from the first geometry added: giving `CityStream.pool` vertex colours left the
  Hills', the Bridge's and the Highway's pools (added first, without them) and then every street lamp's black.
- A Smash collider is shrunk about its centre, so a car's sits 2 cm above its wheels: made on a drive it dropped onto
  it when anything woke it, hard enough to count as a crash (alarms all down the street). Fit the box to the wheels,
  make it after the ground, and `item.settle` (Smash `bump`) skips the first seconds.
- A transparent two-sided material is drawn twice, its back faces then its front (the cypresses' leaf cards, 300 k
  triangles each time): leaves are cut-outs (`Props.js` `prepare`).
- Nothing is tone-mapped or converted to the output colour space when drawn into a render target: a cube of the city
  is linear and brighter than white (the window's bake stores it at a quarter, `BAKED_GAIN`). A cube target's faces
  read back (`readRenderTargetPixels`) and written into images first row first sample the same loaded as a CubeTexture.
- A camera inside an additive cone sees its walls all round and the whole frame washes pale (the news helicopter's
  beam, a "wedge" over the street at night): leave the walls out from inside and light the ground instead.
- The canvas can't read a compressed (KTX2) texture: its average comes from the GPU (`Ktx2.js` `averageColour`). A
  far copy that got none drew its textured parts in their materials' plain colours (the far cars, from the KTX2
  change until this was found).

**Models and props**
- A loader reading the props or the people needs `setKTX2Loader(ktx2)` (`engine/Ktx2.js`), or their textures
  fail. Node tools can't read the built files' textures (sharp has no KTX2): read the sources in `assets/`.
- three flips a texture loaded outside glTF at upload (TextureLoader's `flipY`) and can't flip a compressed one:
  write its rows bottom first (`encodeKtx2(..., { flipY: true })`), or tiles turn upside down and a normal map's
  bumps light from below. A compressed texture without its mips throws when uploaded (`ktx2Texture` waits).
- Lossy WebP halves the colour channels (YUV 4:2:0): on a metal-roughness map it wiped the metal off a police car's
  chrome handles (they shine again in KTX2, as modelled). Build from the sources in `assets/`, not re-downloads:
  Poly Haven's asphalt normal map is a third stronger than the one the game had, and glittered in the sun.
- Tripo sheets can hold several figures (`keepSide`, `figure`); a scanned bow or weapon can be a sheet.
- Paint over a scan in bind-pose object space; push vertices along position-only directions (normals
  differ across UV seams and crack). A scan's sculpted ring can't be cut out: fold it into skin.
- Decimating hard-surface armour shatters it; blended weights bend it.
- A scan's normal map can be broken where the scan saw little (casual Hal's face: white rims on brows and lips;
  his throat, grey and facing up, mirrored the sky at a grazing angle). Test with `normalMap = null` and the
  reflections off before repainting a texture (`plainHead` in `Characters.js`).
- The fitted arm axis is pulled off the arm by forearm armour or long hair: Star Sapphire's shoulders
  landed 30 and 67 cm behind her, the upper arms went to the chest and the forearms swung about a
  point behind her back (her arms hung off her in every pose). Measure the limb and give `rig.arms`.
- A cluster scaled up into a spire is as wide as it's tall: one beside the citadel's stair swallowed the
  stair's head and the camera. Check what's within a spire's width of a path.
- Check a downloaded prop's size by a part you know (the hot dog cart's counter was 65 cm high: its umbrellas came
  at head height). A set of pieces (the autopsy lab) isn't centred on its main one: hide the rest by their bounds
  in the prop's own frame (`Mortuary.buildFixtures`).
- A downloaded prop may be two objects, turned, off its origin, or bounded far past its shape: look
  at its parts and ground contact (`piece(..., { root: true })`) and give non-boxes triangle colliders.
- Loaded vertex positions may be interleaved: use `getX/Y/Z` and a plain attribute before moving them.
- GLTFLoader renames nodes (spaces to underscores, `:` stripped) and mesh names include material
  names: anchor patterns on node names. A drop rule matches parents too.
- A Smash item's pose is its body's: change it where it's placed. A wheel modelled turned wobbles
  (`Car.js` `straighten`).
- Downloaded rigs aren't world-aligned: re-skin onto translation-only bones at build time.

**Animation**
- `AnimationUtils.subclip` drops a track with no key inside the cut (an exporter's constant tracks): put
  them back, or those bones keep whatever played before.
- The mixer writes a bone only when its clip's value changes: layers over a clip go back to the clip's
  pose before it runs again, not to the bind pose (a held pose dropped to bind under them).
- A point fixed in a bone's frame, measured while the model is scaled, is wrong at full size (the
  Predator's snout, first seen small inside the battery, ended up 7 m ahead of its head).
- IK target functions must not return a shared scratch vector; helpers taking temporaries need their
  own scratch objects.
- An arm held near full reach shakes, or its elbow swings out (Carol's at the pier's rail went out sideways):
  hold it short of straight, in the body's frame (`steadyHand`); a shorter body needs its own lean.
- A thing carried on Hal's palm (no finger bones) sits on the palm turned up after the IK (`Shopping.posts`); eating,
  bring it to his chin, not his eyes (at eye height a crisp bag hid his face).
- Arm IK set in one scene stays on into the next (Hal walked into the hangar the morning after with his arms still
  pulled to his lap from the Ferris wheel): take every `reach` off when its scene ends, and clear both arms at a
  chapter's start. A hand's IK target must sit within the arm's reach (`Sapphire.handsOnLap` slides it down the
  thigh only as far as 88% of the arm): out of reach the arm goes straight and the hand lands inside the body.
- A scripted move outside the player's update needs something to run the animator (`onFrame`).
  Seated poses need `player.autoAnim` off. A driver that reads tweened marks runs a frame behind them from
  `onFrame` (its task precedes the tweens made after it): run it from the scene's `updaters` (`Gym.js` `Body`).
- `story/Gym.js` `fingerBones(rig)` gives a scan two finger joints and a thumb (added to its skeleton, the vertices
  past the knuckles weighted over; uncurled they move as before); `grip(side, r)` solves the curls round a bar of
  radius `r` without going into it. `Body` drives a rig: hips placed, feet and hands on marks by IK after the pose.
- Turn a body about its hips, not the object's origin (which is at the feet). Point with the arm on
  the target's side.
- Foot IK only lowers the hips: a root must ride at or above the ground under its feet. `player.ground` is the floor
  under each foot: `player.floorAt` (a ray onto the fixed colliders) in Coast City and Korugar; a `() => 0` there
  had him walk the 14 cm pavements and the shops' floors on bent knees, the hips dropped to reach the street.
- A hand inside a glove: scale the hand bone down (it carries the thumb's weights) and the glove up by as much
  (`Gym.wearGloves`, `HAND_IN`); drawing the fingers in left the thumb through the glove's top in a hook. A stair's slope
  goes through the steps' noses, not the risers' feet, or a body standing on it squats.

**Code**
- `v.copy(p).y += 1.2` is a number, not a vector.
- Wrappers and hooks must forward every argument (`(...args) =>`); `tg.hit` takes `(a, p, d, kind)`.
- `f?.(x++)` skips its side effects when `f` is missing.
- Catch fire-and-forget async (`.catch(console.warn)`); an uncaught throw freezes the actor.
- Disposing a scene disposes everything in it: take Hal out first. `input.consume()` a key that opens
  another interface, or it's read twice. Audio starts only after a user gesture.
- Spoken text written outside `lines.js` gets no clip.
- The voice builder's per-line hash includes `LEXICON` and `RESPELL`: one new entry re-renders every clip (and
  changes them). Render new lines with `ONLY=`; leave the tables alone, or restore `public/voices` from git.
- A key defined twice in `lines.js` silently replaces the earlier line, so an earlier part plays a later
  part's text (Part One's "Core breach." played the Qward breach). `npm run voices` refuses to run until
  one is renamed; grep the key's callers to see which moment each means.

## Known weak spots

- The ambient occlusion has only depth (no normals drawn): what's behind glass or a translucent construct is what
  darkens it, and it fades out by 120 m. Zamaron's crystals are still ~600 draw calls. A sign page some long-built
  block (a tower's, from 950 m) still uses can't be emptied, and the sign pages stay RGBA for the ~25 s the encoder
  takes to catch up after arriving in Coast City (13 pages).

- Unreviewed by the user: the flight suit (`FlightSuit.js`), the Weaponers, Part Six's later beats
  (built on my defaults while they slept).
- Star Sapphire's model: weak feet and tiara, a pale fin on each forearm; the night sea's moon glint
  shows as pixelated patches. No Zamaron models yet (the Guardian generator starts from a male scan).
- Part Seven's last six chapters (`queen` to `hand`) have been run by `tools/sapphire-end-bot.js` and checked in
  captures, not played by hand or reviewed by the user. The hot dog man is a Rocketbox avatar; the pier's Ferris
  wheel cars are built (open bench cars); the funeral home's shelf is Coast Liquor's, its bottles and all.
- The Predator fight hasn't been played by hand: balanced by bots and staged tests (the scripted player
  manages the ground phase, not the air one). Carol held in its beam hangs stiffly.
- The derived Star Sapphires all have Carol's face (other skins, hair, markings); the Korugarians kept
  in crystal still wear the Corps emblem from Abin Sur's scan; the citadel's plaza has only its
  parapet (the `queen` and `predator` arena, not dressed yet). Zamaron isn't in free roam's places yet.
- The streamed city has no interiors or wall props; the houses (Homes.js) can't be entered; Hal's blocks' upper-floor
  flats can't be entered. Tom Kalmaku is a voice only. The hills' houses (Hills.js) and Old Town's courts still have the
  old stucco-and-hip styles; the trees are the field's lumpy shapes tinted (a jacaranda is a lavender oak).
- Hal's flat is still Part One's bedroom scene, not a room inside Las Palmas: its window shows the city drawn from his
  real window into a cube (`Roam.windowView`, `Bedroom.setView`, a face redrawn every half second for the light),
  so the traffic and people out there stand still while he's in. Part Three's morning shows a bake of it at 9:41
  (`tools/bake-window.js`, `public/textures/views/`): re-bake it after changing what's round the lot.
- The map (2026-11-24, built by six agents in parallel and merged): checked in captures, Part Three's `drive` and
  `grave` played through by script, Part Three's `drive` and Part Five's `commute` again on Las Palmas's lot; not played
  by hand. Not re-run: Part Seven's pier chapters (`pier`, `strike`, `return`, `wheel`) with the water 1.5 m lower. No
  traffic on the hill roads; the containers' colours read toy-like; the bay's sea wall and the bluff have no rocks; the
  spurs end in open desert; the in-game map draws Highway 1 from its own arcs (`Highway.js` exports
  `highwayCentrelines()`). A travel error (`null` reading `add`) was seen once in a bench run, not reproduced.
- Scans have no finger bones of their own (only the gym gives Hal's some: `fingerBones`) and lip sync is a jaw only.
- The shops' stock (2026-11-24): checked in captures and by script (`tools/shop-test.js`), not played by hand. What
  Hal carries sits on his open palm (a can on it reads a little like a waiter's); eating is the hand at his chin and a
  nod. A cooler's door doesn't open (his hand stops at the glass). The cases' pastries and the bar's bottles aren't
  taken (bought over the counter; Gus's); the produce heaps aren't physical. What he walked out with, or broke, is
  remembered for the session only.
- Coast City's `player.ground` is `() => 0` (`Roam.js`, `Coast.js`): on a raised floor (a shop's, 15 cm; a pavement)
  the foot IK drops his hips to the street's level and he walks with bent knees. The gym sets its floor for its
  workouts only. The gym's workouts (`Gym.js`) are checked in captures and by script, not played by hand; the jump
  rope's handles are built (cylinders), the rope a tube drawn each frame; a glove's wide cuff shows the wrist.
- Performance still to do (2026-11-25, with Las Palmas, the residential streets and the shops' stock: Hal's street at
  11 PM 336 static draws, 529 k shadow triangles, car by day 295, downtown 6 PM 164; their times not taken clean, the
  GPU shared): the new houses' shadows (+90 k triangles on the street) are the first thing to win back. Before them, Hal's street was ~300 static draws, of which Hal's block's prop batches are ~70 (one per
  material: fewer needs their textures in atlases), the streamed blocks' near meshes ~20, doors and neon ~16.
  Downtown from the air is 0.6 ms over the last commit before the map, at 11 PM (the new ground, the waterfront, the
  trees). Scans have no detail levels in the main pass (a Korugarian is 90 k triangles up
  close); Korugar's built props are ~370 draws of small boxes. The counter's GPU time
  hasn't been read in a visible window (a hidden pane's is meaningless).
- Light: the suit reads dark at night away from lamps (no rim light yet); Coast City's shop and diner
  interiors are lit by the sky like the street (only Korugar's tavern damps it). Nothing past the sun's 120 m
  box casts a shadow (downtown from the air is unshadowed). The tyre tracks are faint, and downtown's towers at
  night glow into a haze under the bloom. The polish pass was checked in captures, not played.
