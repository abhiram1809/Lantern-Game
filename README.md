# Green Lantern — Awakening · The Corps · Coast City · The Prisoner

A Three.js story game. **Part One, Awakening:** test pilot Hal Jordan comes home, falls asleep,
relives his father's crash, is visited by the ring's light, refuses to be afraid, and is carried
to Abin Sur's wreck on the lake shore, where the ring chooses him. **Part Two, The Corps:** the
Guardians summon Hal, the ring carries him across the universe to Oa, Kilowog trains him,
Sinestro spars with him, and the Guardians lay Abin Sur to rest and give Hal Sector 2814; he flies
home before dawn. **Part Three, Coast City:** the morning after. He has slept through the test
flight, rent is two months late, and Carol Ferris fires him. That afternoon the test goes ahead
without him and the jet goes down: Green Lantern's first time in public, Carol meets him, Hector
Hammond attacks, Sinestro ends it. At dusk, his father's grave. **Part Four, The Prisoner:** Carol takes him
back as her pilot; that night Sinestro shows him the empty cell in Abin Sur's ship, and they fight
the escaped prisoner, Atrocitus, at a building site downtown; then Ysmault, where Atrocitus is
chained and prophesies, and the Guardians' verdict on Oa. (Parts Three and Four follow *Green
Lantern: Secret Origin*.)

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
| E | Interact / reach for the ring / recharge at the lantern; high in flight, enter hyperspace |
| Space, Enter, click | Advance dialogue |
| Y / N | Answer the light |
| V | Toggle spoken voices |
| Esc / P | Pause menu |

Once the ring is charged (after the oath):

| Key | Action |
| --- | --- |
| 4 | Construct wheel: time stops; move the mouse to a construct and click (or hold 4 and let go) |
| Left click | Use the armed construct: strike with the fist, place a wall, cut with the sword (click in rhythm for a three-cut combo); hold to keep the shield up or to fire the gatling |
| Scroll | Change the construct's range |
| Q | Holster the construct |
| Space twice | Take off / drop out of flight (there is no jump) |
| W / Space / C / Shift (flying) | Fly where you look / climb / descend / boost |
| L | Keep the lantern in the ring's pocket dimension, or set it down in front of you |

While the shield, the gatling or the sword is up, Hal faces where you look and strafes: W/S/A/D move him
relative to the camera (S backs him off) without turning him away from your aim. Flying with
one, he hovers upright and faces where you look instead of flying head-first.

The ring's HUD shows Hal's health (bottom left) and the ring's charge with the armed construct
(bottom right). Constructs and flight use charge; recharge at the lantern (on Oa the Central
Power Battery recharges the ring continuously). As in the comics, the lantern lives in the ring's
pocket dimension: press **L** and a rift opens to swallow it, press **L** again and it drops out
in front of you. Beside it, **E** recharges the ring (or puts it away when the ring is full).

**Hyperspace travel** (Part Two, from Kilowog's range on): fly high (about 30 m) and press **E**.
The ring's star chart opens (time stops); choose a charted world with the mouse or the arrow keys
and press **E** or **Enter**. Earth and Oa are charted; Korugar, Ysmault and Mogo are on the chart
but uncharted until the story reaches them. Fire and drone bolts hurt; health comes back if
Hal stays out of harm for a few seconds. Aim near an enemy and the reticle locks on: brackets
and a health bar mark it, and hits pop damage numbers.

## Checkpoints and saving

Progress saves automatically at each checkpoint, to `localStorage` with a cookie mirror as a
fallback. Each part has its own save (`gl_awakening_v1`, `gl_corps_v1`, `gl_coast_v1`,
`gl_prisoner_v1`); constructs
learned in any carry over. The title screen offers **Continue**, **New game** and **Chapters** (any
checkpoint reached so far), **Part Two: The Corps** once Part One is finished, and **Part Three:
Coast City** once Part Two is, and **Part Four: The Prisoner** once Part Three is (each part's end card
also offers the next). The pause menu can resume, restart the current checkpoint, jump to a
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
| `summons` | The summons: at the lake, by Abin Sur, as the Guardians call Hal to Oa |
| `voyage` | Hyperluminal: the flight to Oa, from high orbit over Earth |
| `oa` | Kilowog's range: the landing on Oa, then the target drones |
| `livefire` | Live fire: the gatling, then drones that shoot back |
| `sinestro` | Sinestro: his arrival and the sword lesson |
| `duel` | Sparring: the duel with Sinestro |
| `guardians` | The Guardians: Kilowog sends Hal to their hall; the council, Abin Sur laid to rest |
| `homeward` | Sector 2814: on the hall's dais, about to fly home (the voyage, the window, Part Two's end) |
| `range` | The training ground: free flight on Oa, with hyperspace travel |
| `earth` | Home: Sector 2814: free flight at the lake, with hyperspace travel |

`range` and `earth` are free flight after Part Two's story (the end card offers it); travelling
saves the checkpoint of the world you arrive at.

Part Three:

| Checkpoint | Where it puts you |
| --- | --- |
| `morning` | The morning after: asleep in daylight, 9:41 AM, the phone buzzing |
| `drive` | Running late: the car behind his building, the road out to Ferris Aircraft |
| `ferris` | Ferris Aircraft: in the staff lot, on foot |
| `carol` | Carol: on the apron by the prototype, facing her |
| `after` | Out of work: on his car afterwards; Tom rings at 1:52 |
| `wreck` | Earlier that morning: Hector Hammond at Abin Sur's wreck, 5:12 AM |
| `test` | The test: by his car in the staff lot, 2 PM |
| `catch` | Green Lantern: in the air over the field, the jet going down |
| `hector` | Hector Hammond: on the runway beside the jet, Carol with him |
| `grave` | Martin Jordan: the memorial park at dusk (the end card) |

Part Four:

| Checkpoint | Where it puts you |
| --- | --- |
| `pilot` | His pilot: by his car at Ferris, 8:52 AM, Carol on the apron |
| `cell` | The empty cell: flying in to the lake at 10:40 PM, Sinestro at the wreck |
| `site` | Atrocitus: in the air over downtown at midnight, the building site below |
| `ysmault` | Ysmault: the flight out from Earth, then the prison world |
| `trial` | The verdict: on the dais in the Hall of the Guardians |

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
   pours more light into the ring until it reads 100%, and the suit sweeps over him. The ring then
   shows him its pocket dimension: **L** sends the lantern into it.
5. **The ring's power** (training at Abin Sur's side): open the construct wheel (time stops),
   knock a burning hull plate away with a giant fist, raise a shield as the wreck's power core
   blows and hurls burning debris at you, raise a wall, then double-tap Space to fly above the
   treeline and land. After the end card you can keep exploring as Green Lantern.

Constructs: **Fist** (attack, up to 14 m), **Shield** (defense, held), **Wall** (defense, placed
where you aim, stands 20 s), **Gatling** (attack, learned from Kilowog: hold to spin up and fire,
45 m) and **Sword** (attack, learned from Sinestro: cuts in a three-cut combo, and lunges at a
target you aim at) and **Hammer** (attack, learned in Part Four: brought down on where you aim,
the hardest blow the ring has, 16 m). Staff and axe are on the wheel but locked for later. Every construct is
physical: the fist throws debris and drones, the shield deflects debris and bolts, and walls
block debris, bolts and Hal.

### Part Two: The Corps

1. **The summons:** at the lake, by Abin Sur's body, the ring relays a message from the Guardians:
   come to Oa. Hal says goodbye to Abin Sur, flies up above the trees and presses **E**.
2. **Hyperluminal:** he punches up out of the sky with a sonic boom, hangs over the night side of
   Earth (city lights, the dawn about to break over the limb, the Moon), the ring plots the
   course, and he jumps: the streak tunnel of the space-flight reference video, with the ring's
   flight readout counting down the distance. He drops out over Oa: a world-city on its night
   side, green conduits running to the Central Battery, a ringed giant beyond.
3. **Oa:** he streaks down onto Kilowog's training range, a disc floating high above the city,
   with the Central Power Battery on the horizon: the giant lantern of the comics, its glowing
   lens set in a green globe under a wide cap and handle ring, ringed by the citadel's towers.
   Kilowog sizes up his new "poozer" (he talks with his hands now: chest thumps, pointing,
   shrugs, a raised fist, fists on his hips between lines, and he turns to keep you in front of him).
4. **Targets:** five target drones rise from the pads; break them with the fist.
5. **Live fire:** Kilowog teaches the gatling, then sends two waves of drones that circle, take
   turns to attack (watch for the red aim line), and fire bursts of bolts. Block with the
   shield, use the pillars and walls, or fly.
6. **Sinestro:** Sinestro of Korugar comes down beside the podium. He was Abin Sur's friend, and
   he thinks little of his successor. He forms a blade from nothing and teaches the **Sword** on
   four target drones.
7. **Sparring:** Sinestro fights you in the air. Read his tells: a raised blade means a lunge
   (shield it, or meet it with a sword cut to parry and stagger him), spikes forming behind him
   mean a volley, a ring on the ground means a giant fist is coming down. He guards against the
   gatling. Bring him to the mark on his health bar and he calls it.
8. **The Guardians:** Kilowog sends Hal to the Hall of the Guardians, on a tower between the range
   and the battery; fly there yourself. Seven Guardians stand on tall pillars round the dais,
   Sinestro beside Abin Sur's bier. They judge the ring's choice, Sinestro objects, Hal refuses to
   give it back; then they lift their hands and Abin Sur's body goes into light, streaming away to
   the Central Battery. Sector 2814 is Hal's.
9. **Home:** climb out of the hall and press **E**. The voyage home ends at his bedroom window a
   little after four in the morning, still raining: a green flash, the curtains blown in, the suit
   sweeping back into his clothes, and he makes it to the bed. Part Two's end card offers Part
   Three, or free flight: the range stays open (ask Kilowog for another round), with hyperspace
   routes to Earth and back.

### Part Three: Coast City

1. **The morning after:** 9:41 AM, daylight, the phone buzzing on the nightstand, Coast City's
   street outside the window. Hal wakes by stages (rolls over, props up on an elbow to squint at
   the clock, throws the blanket back, sits up, swings his legs off the bed, drags his hands down
   his face), and plays four voicemails: the landlord (two months behind), Tom Kalmaku twice
   (where are you; they scrubbed the test), Carol ("come in, we need to talk"). Then the
   apartment is yours: an empty fridge, red-ink bills, the photo of his father, and a rent notice
   slipped under the front door. Leave by the front door.
2. **Running late:** out of his building to his old '71 muscle car (faded maroon, one door in
   primer); in, and it takes three tries to start. Out through Coast City (a palm-lined boulevard of
   office blocks), the desert road to Ferris Aircraft, the gate, the staff lot; he opens the door,
   swings his feet out, gets out and shuts it behind him.
3. **Ferris Aircraft:** walk between the hangars to the apron, where the prototype he was meant
   to fly at nine stands fuelled and Carol Ferris is waiting.
4. **Carol:** the Air Force came out from Edwards and watched an empty cockpit. He can't tell her
   where he was. She fires him.
5. **Out of work:** Hal sitting on the trunk of his car, the ring telling him there's no threat.
   At 1:52 he's still there. Tom rings from the hangar: General Hammond's own pilot is taking the
   prototype up at two.
6. **Earlier that morning:** the lake at 5 AM, the Air Force's floodlights on Abin Sur's wreck.
   Doctor Hector Hammond, the general's son, wakes something in the ship; its exhaust hits him,
   and he can hear what the men round him are thinking.
7. **The test:** watch from between the hangars as the prototype takes off. Its left engine goes;
   the ring hears the pilot's mayday. Into the gap, out of sight, and up in the suit.
8. **The catch:** fly after the jet before it hits the desert (**Shift** flies faster). Under it,
   the ring makes a hand of light the size of a house and catches it. Bring it down to the runway:
   **hold the click** to keep the hand, **WASD** to move it, **C** to come down, before the charge
   runs out. Carol runs out to meet Green Lantern; she doesn't know him.
9. **Hector Hammond:** he walks out of the heat, swollen-headed, knows Carol, hears Hal under the
   mask, and admits he made the jet fall. He tears slabs out of the runway and throws them, and
   sends out waves that warp the screen. Break his shield with the constructs (**4**), and get a
   shield, wall or fist between Carol and what he throws at her (the ring warns you). When it
   breaks he gets into Hal's head and finds his name; Sinestro's fist ends it. Abin Sur's ship
   was carrying a prisoner, and the cell is empty.
10. **Martin Jordan:** dusk at the memorial park on the edge of town. His father's grave is at the
    far end of the path, under two cypresses by a bench (a marker shows it; **E** there). The ring
    makes his father out of its light.

### Part Four: The Prisoner

1. **His pilot:** Friday morning, Carol called at seven. On the apron by the repaired prototype she
   takes him back, on probation. He asks her to dinner; she doesn't date employees. And whoever was
   on her runway yesterday: thank him.
2. **The empty cell:** the lake at night, the Air Force's lights still on the wreck, Sinestro
   waiting. Search the wreck (three things, each with a marker): the cell's hatch torn out from
   inside, the prisoner's blood still burning on the shore, a word of Ysmault's script cut into a
   stone. Abin Sur was carrying Atrocitus of Ysmault to Oa. The trail leads west, to Coast City.
3. **Atrocitus:** midnight downtown, a tower going up, the lot floodlit, Atrocitus at a machine he
   built from the cell. Fight him beside Sinestro: he **charges** (a red line runs along the ground
   first; put a **wall** or your **shield** in his way and he runs into it and reels, open to
   attack), **throws steel beams** from the lot (block them), **flings burning blood** that sets the
   ground alight, and close in **slams the ground** (fly over the shockwave). At 60% he puts his
   hands on his machine and both rings go dark; Hal's suit goes with the light. **L** calls the
   lantern out of the pocket dimension, **E** at it to say the oath and charge the ring. Atrocitus
   has the excavator's bucket raised over Sinestro: the ring gives you the **hammer**, and three
   blows break the machine apart before the bucket comes down. Sinestro binds him. His machine is
   gone.
4. **Ysmault:** Sector 666, a dead world under a red sun. Atrocitus chained at his obelisk, and his
   prophecy: the Blackest Night is coming. And for Sinestro, Korugar in chaos and a rage like his own.
5. **The verdict:** the Guardians on Oa. A Lantern keeps to his own sector; the charge is set aside.
   Sinestro will train Hal in the field: next time, on Korugar.

## Characters and movement

- **Models.** `npm run assets` (`tools/build-assets.mjs`) turns the Tripo scans in `assets/raw`
  (`Hal-Improved.glb` casual, `hal_b.glb` suit, `Abin.glb`, `Kilowog.glb`, `Carol.glb`, `Hector.glb`) into `public/models/*.glb`: reoriented,
  scaled, decimated to 90–100 k triangles, WebP textures, and **auto-rigged** by `tools/autorig.mjs`
  (17-bone humanoid placed from anatomical landmarks; skin weights from limb chains, blended at the
  joints, smoothed, with the whole skull/face/jaw on the head bone along a detected jaw line).
- **Sinestro** has no scan of his own: he is derived at runtime from Abin Sur's (`createSinestro`
  in `src/characters/Characters.js`), a shader layer painting his face, hair, brows, eyes and
  moustache in the scan's object space, with the hair pushed out into volume and the head and nose
  narrowed in the vertex stage.
- **The Guardians** are derived from Abin Sur's scan too (`src/characters/Guardian.js`): blue skin,
  a domed and enlarged head, a white fringe and brows made of hair cards (`HairCards.js`: alpha-cut
  strand ribbons grown from the scalp), and a red robe built as cloth round the body in the pose
  they stand in, skinned to the skeleton (`Robe.js`).
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
  Sitting poses in a seat (at the wheel, getting out of the car, on its trunk) solve the legs with
  two-bone IK for that seat's measured cushion and floor, and the hands go on the steering wheel's
  rim by arm IK.
- **Held props:** the scans have no finger bones, so the phone lies flat in Hal's palm (a palm frame
  measured from the hand's vertices), and his wrist turns so its screen faces his eyes.
- **Lip sync:** each speaker's jaw opens with their voice (the scans have no face bones: the lower
  face turns about a hinge in the vertex shader, the gap between the lips darkening), following a
  mouth curve measured from each line's audio.
- **Voices:** every line is spoken by a neural text-to-speech model,
  [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), rendered ahead of time
  (`npm run voices`) so the game only plays small MP3s. Each character has their own voice pitched to
  suit them: Hal a warm baritone, Sinestro lower and colder, Kilowog an octave-layered growl, the
  Guardians a reverberant choir, Carol, Abin Sur, the ring's band-limited readout. Lines without a
  clip fall back to the browser's speech synthesiser. `tools/voices.html` on the dev server
  auditions them.

## Environment

- **Trees** (`src/fx/Trees.js`): procedural conifers (stacked, drooping, jagged branch tiers, tilted
  and offset; near/mid/far detail levels) and clumped broadleaf trees, instanced with per-tree colour
  and a wind sway. The lake's far shore is low wooded hills whose skyline is the tree line; forest
  also stands inland and frames both ends of the bay, and fills the view from the bedroom window.
- **Downloaded models** (Part Three, and the kitchenette and the dream's jet in Part One): the cars,
  the prototype jet, the phone, the palms, Hal's apartment block, Coast City's office blocks and
  street furniture, the airfield's ground equipment and gate booth, the fridge, the coffee maker,
  the F-104, the Air Force's truck and light towers at the lake, and the memorial park's
  headstones, gate, fence, cypresses and bench are CC BY 4.0 models from Sketchfab by way of the
  [Objaverse](https://huggingface.co/datasets/allenai/objaverse) dataset, credited in
  [CREDITS.md](CREDITS.md). Surfaces (corrugated iron, concrete, asphalt, sand, plaster) are CC0
  textures from [Poly Haven](https://polyhaven.com). `npm run props` (`tools/build-props.mjs`) builds them from
  `assets/props/` into `public/models/props/` (turned to face +Z, scaled to metres, textures to WebP).
- Everything else (rooms, ship, terrain, water, sky, fire, ring, lantern, Oa, the hangars' shapes)
  is procedural, and all sound effects are synthesised with WebAudio.

## Code map

```
src/main.js                 boot, asset loading, title / continue / chapters
src/engine/                 renderer + post (bloom, NaN guard, dream grade), pause, Rapier physics,
                            input, camera director, timers/tweens, synth audio, voices, Save (checkpoints)
src/characters/             Rig + Animator (quaternion poses, layers), IK (two-bone, world rotations),
                            Mocap (retargeting, locomotion blend), Poses (cutscene + flight poses), Player
                            (controller with momentum, flight, orbit camera), Characters (loading, suit
                            glow / dissolve material patch, Abin Sur, Kilowog, Sinestro, Carol, Hector, Atrocitus,
                            ring, lantern),
                            Guardian + Robe + HairCards (the Guardians), BodyLanguage (talking gestures)
src/powers/                 RingPowers (charge, health, construct wheel, aiming + aim assist, fist / shield /
                            wall / gatling / sword / hammer, damage, flight effects), Constructs (list, shaders, shapes)
src/scenes/                 Bedroom (+ hallway, kitchenette; night or morning), Dream (airfield), Hyperspace
                            (the transit), CrashSite, Oa (+ Hall: the Guardians' hall), Space (Earth, Oa and
                            Ysmault from orbit), Ferris (the airfield by day, the road, the lots), Site
                            (downtown at night, the building site), Ysmault (the prison world)
src/props/                  Props (loading the downloaded models), Car (paint, wheels, the driver's door,
                            seat, pedals and rim points for Hal)
src/enemies/                Drones (Part Two's training drones: AI, physics, bolts), Sinestro (the sparring duel,
                            or fighting beside Hal), Hammond (Hector at Ferris), Atrocitus (the fight downtown)
src/fx/                     sky, particles + fire, water, trees, green light / bubble / shafts, cloth, textures,
                            Rift (the pocket dimension), EarthMap (continents and city lights for Space)
src/story/                  Story (Part One + the shared chapter plumbing, the lantern's pocket dimension),
                            Corps (Part Two, travel), Coast (Part Three), Prisoner (Part Four), Voyage (flights
                            between worlds),
                            lines (all dialogue)
src/ui/                     HUD, subtitles, glyph cipher + decode, choice, cards, pause menu, checkpoint
                            notice; PowerHud (health, ring charge, construct wheel, reticle, training panel);
                            TravelHud (flight readout, arrival card, star chart)
tools/                      asset pipeline (build-assets, autorig, build-props, strip-mocap, extract-posters),
                            propview.html (a dev page that renders a model from six angles), and debug
                            renderers (inspect-model, inspect-weights, inspect-heads); headswap.mjs is the
                            earlier fix for the old casual scan, kept for reference
```

## Notes and limits

- The lip movement is a jaw only (no visemes), and there is no hair simulation. Physics covers the character controller, props in the
  bedroom (shoved by the light, floating when Hal rises), debris at the crash, verlet curtains and
  the body-following blanket.
- Credits: locomotion clips are Mixamo animations shipped with the three.js examples (`Xbot.glb`);
  Mixamo's terms allow use in projects but not redistribution of the raw animation files.
- `window.__game` exposes the engine/story for debugging; `__game.shot(name, seconds)` steps the game
  and saves a canvas capture through the dev server (set `SHOT_DIR` to choose the folder).

## License

MIT (see [LICENSE](LICENSE)). It covers the code, the docs and the project's own assets: the
models in `assets/raw` and `public/models`, the reference videos, the concept art and the posters.
The Mixamo animation clips (`assets/mocap/Xbot.glb`, `Soldier.glb` and the clips stripped from
them into `public/anims/`) are third-party files from the three.js examples and stay under
Mixamo's own terms. The downloaded models in `assets/props/` and `public/models/props/` are
third-party too, each under CC BY 4.0 with its author and source listed in [CREDITS.md](CREDITS.md). The surface
textures in `public/textures/pbr/` are CC0 (Poly Haven). The voice clips in `public/voices/` were
made with Kokoro-82M (Apache-2.0); see [CREDITS.md](CREDITS.md).
