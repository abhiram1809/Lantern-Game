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
as free flight afterwards. **Part Three, "Coast City"**, is complete: the morning after on Earth
(late, broke, fired by Carol Ferris), then the afternoon the comics give it (*Green Lantern: Secret
Origin*): the test jet going down, Green Lantern's first public rescue, Carol meeting him, Hector
Hammond, Sinestro, and the coda at Martin Jordan's grave. **Part Four, "The Prisoner"**, is
complete: the second half of *Secret Origin*. Carol takes Hal back as her pilot, Sinestro shows him
the empty prisoner cell in Abin Sur's wreck, they fight Atrocitus downtown (his machine drains their
rings, the lantern and the oath bring Hal's back, the hammer breaks the excavator), Atrocitus is
chained on Ysmault and prophesies, and the Guardians give their verdict on Oa. **Part Five,
"Probation"**, is complete: Hal's first shift as Carol's pilot (the car driven and the prototype
flown by the player), Sinestro collecting him at dusk in front of Carol, Korugar's capital cheering
Sinestro out of fear, Katma Tui's resistance, and Hal's report to the Guardians. **Part Six,
"Exile"**, is complete (2026-11-16 and 17): first light at Ferris with Carol, Sinestro brought in from
his palace on Korugar, his trial on Oa (his ring taken, his banishment to Qward, Katma Tui chosen),
Katma's first night on Korugar (the oath, the statue pulled down, Qward's Thunderers), Qward and the
Weaponers' forge (the yellow ring), Sinestro's return as the Yellow Lantern ("Are you afraid?" asked
again, yes the answer that wins) and a Parallax hint in the Central Battery, then **free roam** (`src/story/Roam.js`): every world the
story has been to (Earth's valley and the lake, Oa, Korugar, Ysmault, Qward), the star chart high in
flight and a travel menu (M), Hal in the suit or his clothes (T), his car with a ring-made key, and Part
Seven's marker on Hangar Two.

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

Part Three (`src/story/Coast.js`): a civilian morning (the ring stays on, its powers off), then the
afternoon in the suit:

1. **The morning after** (the apartment by day, `Bedroom.build({ morning: true })`, Coast City's
   street through the window): 9:41 AM, the phone buzzing; he wakes in stages (`getUpFromBed`:
   rolled to the edge, up on an elbow to squint at the clock, the blanket thrown back, sitting up
   with the legs along the bed, round onto the edge), drags his hands down his face (`rubFace`),
   plays four voicemails on speaker (the landlord Sal Delgado, Tom Kalmaku twice, Carol). Free
   roam: the fridge (the downloaded one; it opens), the bills, the photo, the window, a rent notice
   under the front door; leave by the front door.
2. **Running late** (`scenes/Ferris.js`): out of his building's door to his car (`getIn`, the way
   a driver gets into a low coupe, leg first: the door pulled open by its edge, beside the seat
   facing the front, the right hand up on the roof rail, the right leg lifted in over the sill,
   ducking under the rail as he lowers himself onto the seat, the hand onto the wheel, the outside
   foot pivoting closer, the left leg brought in, settled back, the door pulled shut); the car (the
   downloaded '71 Phoenix, `makeCar`) takes three tries to start; backed out of its bay with the tail
   swung round, a stop, forward round onto the road; out through Coast City (the boulevard, from the
   kerb); the desert road; the gate (braking for it); round into the staff lot's aisle and nose first
   into his bay; out of the car (`getOut`:
   a hand to the handle, the door pushed open, a turn in the seat, feet out over the sill, up, out
   past the door's tip, the door pulled shut by its edge).
3. **Ferris Aircraft:** on foot between the hangars to the apron, where the prototype stands.
4. **Carol** (her own Tripo scan): she fires him for the missed Air Force test.
5. **Out of work:** Hal sitting on his car's trunk lid, feet on the bumper; at 1:52 Tom rings (the
   phone on speaker, `buildPhone({ call })`): General Hammond's own pilot takes the prototype up at two.
6. **Earlier that morning** (`wreck`, the crash site at 5:12 AM, `airForceNight`): floodlights (two
   downloaded light towers with spot lights), an M35, the fires banked (`site.fireRest`). Hector
   Hammond where Abin Sur sat, a hand on the hull; the ship's breath (`exhaustBurst`, a shaft and
   particles) hits him; on his knees he hears the technicians' thoughts (offscreen voices).
7. **The test** (`test`): walk to the gap between Hangars Two and Three (`GAP`); the prototype
   (`ferrisScene.freeJet()`, `jetAt(t)`: a keyed Catmull-Rom flight then an analytic flat spin)
   takes off west, the left engine lets go at `FLAME_T` (`flameout`, smoke and fire particles from
   the nozzle), the ring relays the mayday; into the gap and `suitUp()` (the reverse of the suit
   coming off), up and away. The jet's clock slows (`jetRate` 0.3) while it's off screen in the
   dialogue, so the chase always starts with time to catch it.
8. **The catch** (`catch`): free flight with `player.boostScale` 1.7 and a marker on the jet; within
   26 m, `theCatch()`: the hand of light (`handGeometry` through `constructMesh`, `HAND`) forms under
   it, the weight comes on (hit-stop, charge −26), then `carry()`: hold the click (else it slips),
   WASD, C (faster from high up), a flare near the ground, the ring refusing to set it down off the
   field (`canSetDown`), the jet eased to the runway's heading; `setDown()` parks it (`parkJet`) and
   lands Hal on its south side. Failing (`jetLost`: too late, or dropped) restarts the checkpoint.
   Then `meetCarolGL()`: she runs out; Hal's lines are subtitled "Green Lantern".
9. **Hector Hammond** (`hector`, `enemies/Hammond.js`): a psychic shriek, he walks in down the runway
   (from the side away from the jet), his lines (`sayAs`), Carol knocked to her knees; the fight
   (boss bar, `onAimCarol` marks her and the ring warns); at the shell's crack `mindAttack()` pulls
   Hal down to his knees, the grade goes to the dream's sepia, the F-104 falls across the sky again,
   and Hector says his name; `sinestroOnEarth()`: Sinestro's giant fist flattens Hector, Sinestro
   streaks down (`createShaft`), says Ganthet sent him and the prisoner cell is empty (the Part Four
   hook), sirens, he leaves; Hal checks on Carol and flies off.
10. **Martin Jordan** (`grave`, `Ferris.dusk()`, `Ferris.cemetery()` at `CEMETERY`): Hal's car at the
   gate, walk to the stone (`GRAVE`: alone at the far end of the central path, past the rows, two
   cypresses behind it and a bench; a marker drawn by `grave()` itself, since the ring's HUD is off;
   Hal's hint `halGraveWay`; E from anywhere round it or on the path beside it), kneel; the ring makes his
   father (`createLightFigure`), who waves the way he did from the airfield and goes back into the
   light; the end card ("FIRST LIGHT").

Part Four (`src/story/Prisoner.js`, extends `Coast` with Part Two's Oa, travel and Guardian methods
copied onto its prototype):

1. **His pilot** (`pilot`, Ferris at 8:52 AM): Carol on the apron takes him back on probation, he asks
   her to dinner, she doesn't date employees, and thanks "whoever that was on my runway".
From the lake on, every chapter starts with `lanternUp()` (the suit, the HUD, full charge, the
constructs, the lantern pocketed), not only `prepare()`: played on from the pilot's morning, Hal
otherwise came to the lake and downtown in his clothes with no HUD or constructs (see Gotchas).

2. **The empty cell** (`cell`, the lake at 10:40 PM): Sinestro at Abin Sur's ship; three clues to
   find (`wreckClues`: the cell's hatch torn out and the hole in the hull, the prisoner's burning
   blood, a word of Ysmault's script cut in a stone), Sinestro names Atrocitus, the trail west.
3. **Atrocitus** (`site`, `scenes/Site.js`, `enemies/Atrocitus.js`; the chapter method is
   `atrocitus()`, not `site()`: see Gotchas): downtown at 11:58 PM, a tower going up on a floodlit
   lot. Atrocitus at the machine he built from the cell. The fight beside Sinestro (`Sinestro.ally`)
   down to 60%; his hands on the machine and both rings drain (`drainRings`), Hal's suit dissolving
   back into his clothes (`suitOff`); L brings the lantern out of the pocket dimension, E at it is
   the whole oath (`recharge()` overridden while `drained`), the suit back (`suitUp`); Atrocitus has
   the excavator's bucket raised over Sinestro by his blood (`excavatorBeat`, `diggerArm`), the ring
   gives Hal the **hammer** (`learn('hammer')`), three blows break the machine apart in 24 s or it's
   "TOO LATE"; Sinestro binds him (`bindings`), and the machine is gone (`removeDevice`, the hook).
4. **Ysmault** (`ysmault`, `scenes/Ysmault.js`): the voyage Earth → Ysmault (`voyage`, Sector 666,
   `Space.ysmault`), the basin under the red sun, Atrocitus chained at his obelisk (`chainAtrocitus`);
   his prophecy of the Blackest Night and of Sinestro's Korugar; Sinestro gags him with light; the
   voyage on to Oa. Ysmault is added to the save's charted worlds.
5. **The verdict** (`trial`, the Hall of the Guardians): the charge (acting outside their sectors)
   set aside, Sinestro to train Jordan in the field, "the next time we meet... on Korugar"; the end
   card ("THE PRISONER"), which offers Part Five.

Part Five (`src/story/Probation.js`, extends `Prisoner`), the user's outline (2026-11-12: day-to-day
life first, then Korugar, the crux being that Korugar worships Sinestro out of fear; Hal reports it,
the Guardians strip him, he becomes the Yellow Lantern, spread over parts; Carol covers the rent
against his probation and finds out who Hal is when Sinestro collects him, falling for him; driving
and flying playable in third and first person; no Tom yet). From *Emerald Dawn II* and what Johns
kept of it; ours: the rent and the advance, the test card, Carol finding out at the pickup (later in
the comics), the market's whispers, the drones' raid.

1. **The rent** (`rent`, `setupFlat`, the apartment by day, 7:10 AM): the clock radio (`radio1-3`, a
   caller), Sal knocking (`audio.knock`, `salDoor1-2`); coffee, photo, window, radio off; leave.
2. **The drive in** (`commute`): `getIn`, the car starts first time, then **driven**
   (`vehicles/Drive.js`): out of the lot and down the boulevard to its end (`townEnd`), a fade to the
   desert road at z 1000, the gate, his bay (`HAL_BAY`, the painted space: parked = its middle
   within 1.2 m across and from pulled right in to `CAR_SPOT` along, square to the lines, stopped
   0.6 s; stopped close but out of it, the objective says "Park between the lines");
   `drv.stop()`, `f.carSolid()`, `getOut`. Radio lines go through `radio(key)` (queued, never
   blocking; `hushRadio()` drops what's left at a chapter's end).
3. **An advance** (`advance`): Carol on the apron pays Sal; his probation hours pay her back; the card.
4. **First shift** (`testFlight`): Hal in the flight suit (`wearFlightSuit`, `FlightSuit.js`) walks out
   to the prototype at the runway's east end (`ROLL`), is seated (`seatInJet`: two-bone legs on the
   cockpit's measured seat and pedals, `COCKPIT`, hands on stick and throttle, helmet and visor), and
   **flies** it (`vehicles/Jet.js`) over the airspace (`Ferris.airspace`, `flightAir(true)`). The test
   card (`VehicleHud.setCard`): take off and gear up, 12,000 ft, 5 g held 3 s, Mach 1.2, a low pass
   past the tower (< 320 ft, > 380 kt, within 320 m), land on 27 and stop. Carol on the radio
   (`tower1-9`, `towerRange`, `towerGear`). A crash: `jetDown` (card, restart). The vapour cone and
   boom at Mach 1; g greys the view (`vhud.gloc`).
5. **Field training** (`pickup`): dusk (`f.dusk()`), the jet parked, Carol; dinner refused, "the man
   on my runway"; Sinestro streaks down (as in Part Three); Hal suits up in front of her (`suitUp`
   dissolves the pilot rig), her hand on his chest (arm IK), "Go. And come back"; up and away.
6. **Korugar** (`korugar`, method `korugarArrival`): `voyage(earth > korugar)`, Korugar charted, the
   capital (`scenes/Korugar.js`): the plaza's crowd chanting (`crowd1-2`, `cheer(on)`), Sinestro on
   his statue's pedestal, his address, down to Hal.
7. **Order** (`patrol`): the **staff** (`learn('staff')`, four target drones on the plaza); the market
   (`marketPeople`): four people who praise Sinestro (`kvNa`) and mutter after (`kvNb`, `alien: true`
   so the ring's decode shows), everyone backing away from Hal's ring; the arrest (`arrest`): a man
   taken for laughing, lifted to the cells in Sinestro's light.
8. **The resistance** (`rebels`): the old quarter (`QUARTER`), Katma Tui (`createKatma`, `addKatma`)
   leading Hal into the courtyard (`HIDEOUT`), three rebels, the Halls of Correction (`PRISON`, cells
   barred with green light, prisoners kneeling), the raid: two waves of security drones.
9. **The report** (`report`): Sinestro in the courtyard (the crux: "fear is order" / "that's a cage"),
   Katma's line, up and `voyage(korugar > oa)`, the hall: Hal's report, "a Lantern may not rule",
   "Bring him to Oa"; the end card ("PROBATION"). Part Six: the trial, Qward, the Yellow Lantern.

Part Six (`src/story/Exile.js`, extends `Probation`), the user's arc (2026-11-12: the trial, Qward and
the Weaponers, Sinestro as the Yellow Lantern, Katma given the ring). They picked the first three of
my seven suggested beats to build (2026-11-16: "implement the first three"; the Weaponers' models come
from them next). The part's name, "Exile", is mine. Ours, not the comics': Carol's morning, the palace
scene, Katma testifying, the bubble; from the comics (*Emerald Dawn II*): the trial, the ring taken,
banishment to Qward through the antimatter, the ring choosing Katma Tui for Sector 1417.

1. **Coming back** (`dawn`, Ferris at 5:48 AM, `f.dawn()`): `arriveFlying` in from the east, land at
   Hangar Two (`HANGAR_MOUTH`), `suitOff`, `powers.detach()`; Carol waiting by the second airframe
   (`CAROL_IN`); the talk (`carolDawn1-13`, `halDawn0-10`); the ring relays the Guardians' call
   (`gCall`); a fade out to the hangar's mouth, `suitUp` in front of her, `powerUp()`, fly up past 60 m.
2. **Bringing him in** (`palace`, method `bringHimIn()`): `voyage(earth > korugar)`; the forecourt
   packed (`kor.fillForecourt()`, twelve full figures at the lane's edge, four guards before the
   portal); Sinestro on the balcony (`BALCONY`), Hal lands at `FORECOURT`; the exchange
   (`sinPal0-8`, `halPal1-5`, `katmaPal1-2`); the guards come off the portal and are stood down;
   Katma steps out of the crowd; he comes down to them; Katma carried in `createBubble`; the voyage
   on to Oa.
3. **The trial** (`tribunal`): the hall, Sinestro centre of the dais, Hal and Katma behind either
   side (`addHallKatma`: her rebel and Lantern bodies on one animator, `setYaw` turns both); the
   charge and testimony (`gTri1-8`, `sinTri1-6`, `halTri1-4`, `katmaTri1-6`); `ringTaken` (his arm
   drawn out, the ring off his finger into the air, his suit's light, emissive and sheen drained);
   `banish` (an antimatter `Rift`, `openRift(..., { palette: 'antimatter' })`, behind him; drawn back
   and dissolved); `ringChooses` (`ringKatma`, the ring to her raised hand, the uniform up from her
   feet); Sector 1417; a fade, straight on into her night (no end card now).
4. **Her first night** (`firstnight`, `firstNight()`; the user's call, 2026-11-17: "continue till you
   are done"; the beats are mine): Korugar at night (`kor.night(true)`), the plaza full and quiet;
   Katma (in uniform, `addPerson`) speaks the oath (`katmaOath1-4`, her ring hand held out at shoulder
   height: an open hand raised upright reads badly), her first construct (a shield that flickers and
   holds); the crowd chants; **the pull** (`pullStatue`: chains of light, `lightChain`, from both ring
   hands to his shoulders; held click tips him on his toes, `kor.statueTilt(k)`, letting go settles
   him back; `statueFall()` takes him face down onto the plaza, `statueRubble`); the cheer; an
   antimatter rift over the plaza and **Qward's Thunderers** (`enemies/Thunderers.js`), two waves
   (brutes and casters, then archers on the empty pedestal, winged ones and a brute) while Katma holds a
   dome over the people in the old quarter's mouth; then fly into the breach.
5. **Qward** (`qward`, `qward()` and `forge()`, `scenes/Qward.js`): out of a rift high over a plain of
   black glass; the marker north on the yellow column; the ambush by the two glass pillars (archers on
   top, `PERCHES`); the forge: three Weaponers (`createGuardian(..., { weaponer: true })`) round the
   crucible, Sinestro drained and ringless before it (`drainSuit`); the ring out of the molten light
   (`fearRing`, `fearGlow`) onto his finger; the Yellow Lantern's uniform swept up him
   (`yellowLantern(rig, k)`), `sin.turnYellow()`; Hal steps out (`halQ3`), a yellow fist puts him down,
   Sinestro goes up the column into a breach of his own; follow him.
6. **The yellow light** (`yellow`, `yellowLight()`): Korugar an hour on, the plaza empty round the
   fallen statue (`kor.fallen()`); Sinestro strikes Katma down; Hal out of a rift; the fight (the
   sparring AI with 680 health, yielding at 30%, yellow constructs, the fear jet); at 62% `afraid()`:
   a yellow cage (`cage()`) round Hal, the grade to the dream's sepia, the F-104 falling in the sky,
   "Are you afraid?" (`ui.choice`): **No** ("Liar"): the bars close, 12 damage, asked again; **Yes**
   (`halY2-3`): the ring's answer, the cage breaks, charge and health full. At 30% he tears a rift and
   goes (escapes: my pick); Katma up again; **the sting** (`sting()`): Oa's Central Battery, a long
   segmented shadow crossing its light and two amber eyes opening in it (`parallaxShadow`; the user:
   Parallax hinted now, the model later), the Guardians' two lines, the ring's "Unknown entity"; the
   end card ("THE YELLOW LIGHT", "Part Six complete"), which offers free roam.
7. **Free roam** (`world`, `Roam.openWorld()`, `src/story/Roam.js`; `Roam` extends `Exile` and is
   Part Six's class in `main.js`). The user's call (2026-11-17: the world open after Part Six, a marker
   for Part Seven), then their notes the same day: "I really can't travel in space as a Green
   Lantern", "I should be able to change into Hal Jordan, and I should be able to use my car", "make
   keys with my ring... unless my lantern is depleted", the recharge not working, the lake unusable.
   - **Places** (`PLACES`: world, name, `jump` height): `ferris`, `coast` (one Ferris scene; which one
     follows Hal's z), `lake`, `oa`, `korugar`, `ysmault`, `qward`. `goTo(id)`: within a world a fade
     (the lake flown into from its sky), between worlds `voyage()`, to or from Qward `breach()` (an
     antimatter rift opened ahead of him, flown into, its violet flash; out of one at the other end);
     `enterPlace(id, { sky, breach })` builds and enters the scene and calls its `*Roam()` setup;
     `leavePlace` clears a fight in progress. Off Earth he must be in the suit (it forms first).
   - **The star chart**: flying above the place's `jump` (the valley 110 m, the lake 26, Oa 30,
     Korugar 75, Ysmault 36, Qward 45), E (`jumpReady`, `updateInteractions`, `openRoamChart`); Qward is
     on the chart (`anti`, off its edge), notes per world (`CHART_NOTES`, `StarMap.open({ notes })`).
     **M** is the same places by name (`travelMenu`).
   - **Who he is** (T, `changeClothes`): `becomeHal()` (`suitOff`, no flight or constructs, the vitals
     hidden, the ring's charge shown) and `becomeLantern()` (`suitUp`, 1% of charge; refused under 2%
     with `ringSuitLow`), the ring hand raised before his face (`ringFlourish`). **His secret** (the
     user, 2026-11-18): on Earth's streets he changes only where nobody can see him (`watchers()`,
     `CityLife.seenBy`): T, the car's "Change, and take the car", and the suit forming for a trip off
     Earth are refused (`refuseSeen`: a buzz, his thought `halSeen1-3`, a toast) while anyone can; an
     alley, a roof, his flat, or the diner's restroom (`restroom(sp)`: in, the door, changed, out). The
     HUD says which (`ui.watching(n)`: "SEEN · n PEOPLE" or "OUT OF SIGHT", top right). `powersFor()` applies it
     after every place; `roamKeys()` sets the keys line (`CIVILIAN_KEYS`, `LANTERN_KEYS`).
   - **His car** (`addCarSpot`, `takeCar`, `ringKey`, `driveCar`): E at the driver's door (it follows
     the car); in the suit he changes first. The key (`keyGeometry` in `Constructs.js`, the Corps emblem
     for its bow) forms on his palm, goes into the lock (car frame 0.972, 0.8, -0.52), turns, the latch
     clunks, it dissolves; with under 1% charge it flickers and won't hold (`ringKeyLow`, `halKeyFail`).
     Then `getIn(car, { spawn: false })`, the old starter (one in three takes two goes), `Drive` on the
     valley's ground (`roadGround`), the dash, E to get out when stopped (`getOut`); the car stays where
     it stopped (`carSolid`). Above 95 m over the valley the airspace (`flightAir`) comes on.
   - **The lantern**: `lanternSpots` on every place; L brings it from wherever it is in one press
     (`Story.toggleLantern`); under 25% the recharge is the whole oath (`Roam.recharge`).
   - **Each world**: Ferris, Carol in Hangar Two (`carolRoam`: her lines to Hal or to Green Lantern,
     then Part Seven's card once); the lake, Abin Sur's ship (`halLake`); Oa (`oaRoam`), Kilowog's
     "another round" (`addDrillStart`, copied from Corps) and the Guardians in their hall (`gRoam1-3`,
     the elder, `hallActive` within 48 m); Korugar (`korugarRoam`), by day, the statue down, `StreetLife`
     (`after`), Katma (`katmaW1-3`); Ysmault (`ysmaultRoam`), Atrocitus chained (`atroY1-3`); Qward
     (`qwardRoam`, `arenaFight`), a violet circle at `AMBUSH` where E calls a wave of Thunderers (2 + n,
     archers on the pillars). `collapse()` in free roam is a card and back on his feet where he is.

The user's decisions for the ending (2026-11-11): beats from *Secret Origin*, not invented (the
rescue, Carol meeting GL, Hammond's exposure at the ship and his telepathic attack, learning Hal's
name, Sinestro knocking him out, sent by Ganthet); **no yellow weakness** (retconned); **no Jim**
at the grave; **Carol rehires Hal in Part Four**, not here; Hector is their Tripo model. Ours, not
the comic's: whose plane it is, Hector as the general's son, Hector causing the failure, the
construct of Martin at the grave.

Seated poses in Coast are solved for the seat, not guessed: `legTo(pose, side, dy, dz, thigh,
shin, toe)` is two-bone IK in the leg's plane from the hip joint to an ankle target, and
`drivingPose`, `swingPose`, `outPose` and `trunkPose` use it with the car's measured points. At the
wheel Hal sits sunk 8 cm under the seat point and reclined 0.44, his hands on the rim by arm IK
(`driveHands`): the Phoenix's headroom (0.86 m from cushion to headliner) is less than his sitting
height, and at the old 0.34 the top of his head came out through the roof. Getting in is a keyed
move (`keyed(keys)`: channels such as the stance under the pelvis, pelvis height, spine and neck,
ankle targets, a hand target, with monotone cubic easing so held values stay put): the feet are
solved by two-bone IK to their keyed spots in the car's frame in `animator.post`, and the move
ends exactly on `drivingPose` (its ankles measured on the rig first). Measured on the car (its own
frame): body side x 0.95, floor 0.27 out to x 0.85 (the sill is low), door opening z -0.7 to 0.6,
roof rail about 1.22 m up at x 0.68, headliner 1.27 to 1.30. The phone (`buildPhone`, the downloaded iPhone with its logo removed and the
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
- **Everything in a scene can be touched (their standard, 2026-11-11): "GTA 5's level of
  interactability".** Their words: "I don't want a random asset to be something I cannot at least
  touch or feel" (they phased through parked cars by the building site); "I should be able to punch
  cars, destroy fences". Every prop a scene places goes through `props/Smash.js` as solid, loose,
  breakable or a car (see *The world's props*); no mesh without a collider, nothing big that can't
  be moved or broken unless the story needs it fixed (then say why in a comment). Check new scenes
  by walking into, flying into and hooking their props, and that nothing starts overlapping (a prop
  shoved out at load is the tell).
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
- **Part Five's vehicles** (their call: "flight and car control mechanics in play from third
  person/first person"): **C** changes the view in the car and the jet (V was already the voices
  toggle); the jet is flown with mouse aim (War Thunder's instructor, MouseFlight). The flight suit
  was left to me ("you design it"): see *Characters*.
- **Free roam's keys** (2026-11-17, mine on their asks): E high in flight is the star chart anywhere,
  M the travel menu, T changes between Hal and Green Lantern (they asked to "change into Hal Jordan"),
  E at the car's door makes the key.
- **The open world (agreed 2026-11-18, three rounds of questions; not built yet).** "GTA's level of
  detail" for free roam's Coast City. Their picks:
  - A **dense core** about 1.5 × 1.5 km (downtown, Hal's neighbourhood, the waterfront), the rest a
    skyline; a **sunny California coast** look (palms, stucco and Spanish tile, art deco on the front,
    a glass downtown, a pier and beach). **Buildings must not read as blocks**: "repeated assets are
    fine but bad details are not".
  - **Traffic, pedestrians, emergencies to answer** (robberies, thugs, crashes, fires...), **time and
    weather**.
  - **Public opinion** instead of a wanted level; when it's low, **pressure, no fighting** (cordons,
    helicopters, booing, the Air Force at the lowest).
  - **XP** mostly from main missions, some from side missions; their current save gets the XP of the
    main missions already played. **Points per level** in the six ring stats: efficiency, power,
    willpower, endurance, flight, focus.
  - **Secret identity**: change out of sight, or it's filmed and talked about (my suggestion, taken).
  - **Money, tight**: Ferris pay in, rent out, food and coffee cost; rescues don't pay.
  - **Interiors**: Hal's apartment, shops and a diner, the Ferris offices, the police station, a
    hospital and a bar; places like these on **Korugar** once it's freed.
  - **Out of the suit on Oa or Ysmault Hal suffocates**, badly (their words). Qward too is my default.
  - **People**: open-source models found online (Hugging Face and the like) and variants derived
    from our scans; Tripo only for critical characters (their credits are low). Tell them if no
    high-quality ones exist.
  - **First:** one block (Hal's) at the full standard, shown to them in close-ups for approval before
    the rest of the core is built from its kit. **Built 2026-11-18** (`src/city/`, see *Coast City's
    block* under Scenes) and **approved** the same day ("just the block meets the bar, design wise"),
    then its interiors ("Yes, interiors") and its people ("Yes, keep going").
  - **People are Microsoft's Rocketbox avatars** (MIT, 2026-11-18; see *Coast City's people* under
    Characters): 115 rigged people with fingers, eyes and face blendshapes, every age and background,
    professions included (police, fire, medical, construction, business: the emergencies later).
    Shown to the user: the models meet the bar ("if we are only talking about the people, yes"), but
    "they are not that intelligent", "about 70% there". Their notes (2026-11-18), now built: people
    with jobs who serve and answer (Rosie works the diner, takes Hal's order), **whispers** to
    overhear, not only lines when Green Lantern flies; and **Hal may not change where anyone can see
    him**: "he needs to go somewhere secret". Also: the diner "very unplayable... unwalkable, very
    glitchy", flickering floor, stuck behind the door (fixed; see the block's Gotchas).
  - Their leads for people (2026-11-18): restore50's "Humans for Archviz" collection on Sketchfab (2,093
    CC BY photo-real people, 200-350k triangles, natural poses, not rigged, **not on Objaverse**: they
    need a Sketchfab login to download), the "Citizen NPC Pack" (low-poly, below the bar), "Rugged Winter
    Traveler" (restore50, a winter coat). For buildings, "buildings with internals" on Sketchfab: nothing
    Californian; jimbogies' interiors (a stair lobby, a bay-windowed room, a diner booth) are kept for the
    interiors later.
- **Controls they chose:** no jump, ever. `4` opens the construct wheel (time stops), click
  deploys. Double-tap Space flies. `L` stores or summons the lantern (pocket dimension). `E` high in
  flight enters hyperspace (they asked for E). Fist, shield and wall are the starter constructs;
  the gatling (Kilowog) and the sword (Sinestro) are learned on Oa, the hammer against the excavator in
  Part Four, the staff on Korugar, the bubble trap in free roam; the axe stays locked for later. The fist is a **hook** (their call,
  2026-11-11): a big sideways area blow, not a straight cross, 13% of the charge each, a right then a
  left as a two-hit combo. The **guard** is held on right click or `F` whatever is armed (added for
  blocking in fights; a left click behind it drops it and strikes).
- **Boss fights (their call, 2026-11-11):** challenging "like Resident Evil", not Souls: opponents
  that read Hal and punish spam. They beat Sinestro and Atrocitus with a trackpad by holding the
  gatling down; now the gun is blocked whenever the boss isn't committed and held on him is
  answered, and it only works in short openings (see *Sinestro* and *Atrocitus*). Their second note
  the same day: hook spam still won ("just very power-intensive"); they want "very limited reward"
  for spam and blocking to be what pays, "block, and then attack rather than an all-out brawl".
  So between attacks a boss turns blows and answers them, and a parry is the big opening.
- **Travel and planets (their design, 2026-11-09):** after Kilowog's training Hal can go home; the
  star chart unlocks more planets as the story goes on. For now only Oa and Earth are charted.

## Commands

```bash
npm install
npm run dev        # Vite on http://localhost:5173 (strictPort)
npm run build      # production build to dist/ (should be clean, no errors)
npm run assets     # tools/build-assets.mjs: assets/raw/*.glb → public/models/*.glb (rigged)
npm run props      # tools/build-props.mjs: assets/props/*.glb → public/models/props/*.glb, and CREDITS.md
npm run people     # tools/build-people.mjs: assets/people/*.glb (Rocketbox) → public/models/people/ (FETCH=1 downloads)
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
| `assets/raw/Hector.glb` | **Hector Hammond** (the user's model, 2026-11-11), built as `hammond.glb`. One figure, T-pose, lab coat, glasses, moustache; his skull swells in the shader (`createHammond`). |
| `assets/raw/Atrocitus.glb` | **Atrocitus** (the user's model, 2026-11-11), built as `atrocitus.glb`. One figure, A-pose, crimson, dark armour with big pauldrons, the Red Lantern emblem. |
| `assets/raw/Katma-tui.glb` | **Katma Tui** (the user's model, 2026-11-12), built as `katma.glb`. One figure, A-pose, in a Lantern's uniform (recoloured to the resistance's until she gets the ring), pink skin, short black hair. Shoulders given by hand (fitted, they landed behind her back). |
| `assets/raw/Thunderers.glb` | **Qward's Thunderers** (the user's sheet, 2026-11-17): four separate figures in one file, built as four models: `thunder_archer` (crouched, bow drawn, a quiver), `thunder_winged` (floating, wings spread), `thunder_brute` (A-pose, a flail in his right hand), `thunder_woman` (A-pose). Bronze war gear, winged helmets. |
| (from `Abin.glb`) | **Korugar's crowd**, `kor_crowd.glb`: Abin Sur's scan at 1,500 triangles, baked into two poses and instanced round the plaza (`Korugar.buildCrowdFill`). |
| (none) | **Sinestro** has no file: `createSinestro()` derives him at runtime from `abin_sur.glb` with a shader layer (see *Characters*). |
| (none) | **The Guardians** have no file either: `createGuardian()` (`characters/Guardian.js`) derives them from `abin_sur.glb`. |
| `assets/raw/hal_a.glb` | Old casual scan: two figures, poor face. Unused; see the commented entry in `build-assets.mjs`. |
| `assets/raw/gemini_generated_video_93604faf.mp4` | Hyperluminal space flight: radial streaks, "ORBITAL APPROACH" HUD. **The Hyperspace scene is styled after it.** |
| `assets/raw/gemini_generated_video_6bbb1091.mp4` | Reference for a **later part**: the suited Lantern flying over a neon night city, fighting red-eyed mechs with constructs (minigun, hex shield); combat HUD with minimap, health, ammo and damage numbers. |
| `assets/ref/1–4.webp` | Concept art. The HUD frame, the 10:00 PM timestamp and the glyph subtitles come from here. `4.webp` is the bedroom; the posters are cut from it. |
| `assets/mocap/Xbot.glb`, `Soldier.glb` | Mixamo-rigged characters from the three.js examples. Only Xbot's clips are used at runtime (`public/anims/xbot.glb`). |
| `assets/props/*.glb` | **Downloaded props** (2026-11-10), CC BY 4.0 Sketchfab models from Objaverse, credited in `CREDITS.md`: Hal's car (`phoenix`), four period cars for the lots, the prototype (an F22), the phone, palms, Hal's apartment block, the apron's access stand, tug, fuel truck, cones, tool chest, drums, forklift; Coast City's six office blocks (`office1`–`6`, one artist), the street kit (`cityprops`: traffic lights, lamps, hydrants, bins, a dumpster, signs), a bus shelter, a billboard; the gate's guard booth; the kitchenette's fridge and coffee maker; the dream's F-104; Part Four's building site (the excavator, the girder kit, a tower crane, chain-link
fence, a container, barriers, a mixer, pipes, bricks, a porta-potty) and Ysmault (a butte, obelisks,
a chain, shackles, a rock pack). `apartment.glb`'s textures were re-encoded as JPEG to keep it under 25 MB. |
| `assets/people/*.glb` | **Coast City's people** (2026-11-18, 2026-11-19): 60 Microsoft Rocketbox avatars (MIT, `LICENSE-Rocketbox.md` beside them), the web-tier GLBs of the Hugging Face copy, built by `npm run people`. |
| `public/textures/pbr/` | **Surface textures** (CC0, Poly Haven, 1K WebP): corrugated iron (the hangars), concrete (the apron, lots, pavements), asphalt (roads, runway), gravelly sand (the desert), white plaster (the tower and office). `pbrMaterial(id, { repeat, tint, map, detailRepeat })` in `fx/Textures.js`. |

Model build settings (`MODELS` in `tools/build-assets.mjs`):

| Model | Target triangles | Height |
| --- | --- | --- |
| Casual Hal | 100k | 1.83 m |
| Suited Hal | 90k | 1.83 m |
| Abin Sur | 90k | 1.96 m |
| Kilowog | 90k | 2.4 m |
| Carol | 90k | 1.7 m |
| Hammond | 90k | 1.78 m |
| Atrocitus | 90k | 2.25 m |
| Katma Tui | 90k | 1.76 m |
| Korugar crowd | 1.5k | 1.9 m |
| Thunderers: archer, brute, woman | 60k each | 1.9, 2.1, 1.85 m |
| Thunderers: winged | 70k | 1.9 m to the head (`headTop`; the wings reach 2.3) |

Every model faces +Z (`facing: 1`) and has WebP textures.

---

## Architecture

### Boot and frame loop (`src/main.js`)

`boot()` sets up the game in this order:

1. It creates the `Engine`, `Input`, `AudioBank`, `Voice` and `UI`, and registers the service
   worker (`public/sw.js`, see *Loading and performance*).
2. Three things load in parallel: `loadCharacters()` (the core: both Hals, Abin Sur and the Xbot
   mocap), the poster textures, and `initPhysics()` (Rapier WASM).
3. It exposes `window.__game` (`story` is a getter: the story object doesn't exist until the
   title has picked a part).
4. It starts `engine.start((dt, t, real) => { tick(dt); story?.update(dt, t, real); input.endFrame(); })`.
5. While the title shows, it fetches the part it guesses comes next (the URL hash's, else
   `latestCheckpoint()`'s): that part's code (`PART_CODE`, a dynamic import) and its scans
   (`characters.more(PART_SCANS[part])`). Then it runs `titleFlow()`, which resolves with `{ part, id }`.
6. It calls `audio.init()`. That has to happen after a user click, because of the browser's
   autoplay rules.
7. It awaits the chosen part's class and scans (already there if the guess was right), makes the
   story (`Story` for Part One, `Corps` for Part Two, ... `Roam` for Part Six) and calls
   `story.run(id)`. If a step throws, the error is logged and a card ("The story stopped") offers
   to restart the checkpoint; before, the story just stopped and Hal kept walking a scene that
   never moved on.

`titleFlow` shows **Begin** on a fresh save, or **Continue**, **Parts**, **Chapters** and **New
game** once there is a save. Continue is the checkpoint played last in any part (`latestCheckpoint()`
in `Save.js`, by each store's `playedAt`); Parts lists every part opened so far with where it
continues; Chapters asks which part, then the chapter. A part opens once the one before it is
finished (Part Two once Part One has reached `free`, or once Part Two has a save, and so on). A pause-menu restart reloads the page with
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

- **Renderer:** pixel ratio capped at 1.5 and adapted to the frame rate (`adapt`: an eighth down
  after 1.5 s under 45 fps, to 0.6 of the cap at least, an eighth up after 4 s over 70;
  `localStorage.gl_res` fixes it), PCF shadows, ACES tone mapping.
- **Post chain:** `RenderPass` → NaN/Inf guard → `UnrealBloomPass` → grade `ShaderPass` →
  `OutputPass`.
  - The composer renders into a HalfFloat target with 4× MSAA.
  - The NaN guard exists because a single NaN pixel gets smeared into black blocks by the bloom.
    Keep it.
  - `engine.gradeUniforms` drives the grade: dream sepia, aberration, vignette, grain, the
    colour flash, `uFocus` (time stopped: drained and green) and `uHurt` (red edges on damage).
- `engine.paused` keeps rendering but skips updates.
- `CameraDirector.up` (when set) is the camera's up vector: the jet's cockpit banks with the jet.
- `Physics.beforeStep` (an array of `fn(dt)`) runs before each world step: a driven car's wheels.
- `engine.frame(dt, render)` and `async engine.advance(seconds, dt = 1/30)` step the game
  manually, for debugging and captures.

### Loading and performance (2026-11-19)

The user (2026-11-19): the frame rate "dropping quite fast" even on their Mac, the browser freezing
for a moment on every boot, and they asked for the game to load bit by bit and stay in the browser's
cache. What's in place:

- **Code by part.** `main.js` imports each part's story class on demand (`PART_CODE`); the build
  splits them (`Corps`, `Coast`, `Prisoner`, `Probation`, `Roam` chunks). The `Story` chunk (5 MB, 1.9
  MB gzipped) is mostly Rapier's WASM, which the compat build inlines as base64 (4.1 MB), and three.js.
- **Scans by part.** `loadCharacters()` loads only the core (both Hals, Abin Sur, the mocap: 0.3 s,
  was 2 s for everything); `characters.more(names)` loads the rest (`SCANS`, `PART_SCANS`: Kilowog for
  Part Two, Carol and Hector for Part Three, and so on), started while the title shows.
- **The browser's cache.** `public/sw.js`, a service worker: everything under `/models`, `/textures`,
  `/voices` and `/anims` is served from the cache (`gl-assets-v1`) at once and fetched again behind it,
  so a rebuilt file shows on the visit after. A hard refresh skips it. The code isn't cached there
  (the dev server and a deploy's hashed bundles do that). Bump `CACHE` to drop everything.
- **The loading screen** (the user, 2026-11-19: Continue "took 30 seconds... add a true loading screen
  for assets, just don't show users the dark"). `#loading` is kept after boot and comes back from the
  title's click to the first frame of the scene: the part and chapter as its title, the stage under
  way, a bar, a tip (`LOAD_TIPS` in `UI.js`). `ui.loadStart(title, stages)` (stages `[key, label,
  weight]`, `LOAD_PLANS` in `main.js`: free roam's code, props, scene, city, shaders; a chapter's code,
  props, scene, shaders), `ui.loadStage(key, k)` from the way in (`loadProps(names, onProgress)`,
  `setupFerrisAsync`, the city's fill, `warmUp`), and it goes by itself at the scene's first fade up
  (`ui.fade` to a lower level), `giveControl()` or a card (`ui.screen`), or after 15 s without
  progress. Free roam's switches within a world put it over the black too (`Roam.goTo`: Ferris and Coast
  City, the lake), and a switch that throws fades back up with control rather than staying black. It stays
  up two frames past `loadEnd()` (or 1.5 s, if no frames come): the scene's first draw (the geometry's upload and,
  in a chapter, its shaders) is a 0.5 to 1.2 s stall, and it's better under the loading screen. The bar
  never goes backwards. While it's up the engine neither draws (`engine.veiled`) nor changes resolution
  (its frames are slow because the scene is being built). `window.__load` (dev) has each stage's start.
- **Building in slices.** The Ferris scene with the block is built by generators (`Ferris.steps()`,
  `blockSteps`, `Batch.buildSteps`) that yield between buildings, rooms and batches;
  `sliced(steps, budget, { key, expect, onProgress })` (`engine/Slice.js`) runs them in pieces with a
  macrotask between (24 ms behind the loading screen) and reports how far it is (its yields counted
  against last time's, `localStorage.gl_steps_<key>`); `runSteps` runs them straight through
  (`Ferris.build()`, for a chapter that builds Ferris in play). `Coast.setupFerrisAsync()` /
  `Ferris.buildAsync()` are the way in for free roam and for every chapter whose `prepare` needs
  Ferris (Coast's, Prisoner's `pilot`, Probation's drive and field, Exile's `dawn`); a later
  `setupFerris()` gets the same scene. It was one 1.1 to 2 s frame before.
- **Shaders compiled behind the loading.** `Story.warmUp(scene, prepare, roots, onProgress, { near,
  radius })`: the scene split into pieces of 300 objects or fewer, each compiled with
  `renderer.compileAsync` (hidden things shown for it, `prepare()` setting the night so its variants
  are made too), a macrotask between pieces, then every texture uploaded (`initTexture`) a few at a
  time. With `near`, only the pieces within `radius` of that point are waited for (free roam: 700 m of
  where he arrives); the rest compile after he's in (`story.warming`). CityLife warms its people the
  same way. Programs: about 210 in the valley (399 before the cars' paint stopped making one each).
- **Point lights pooled** (`city/Lamps.js`, `LampPool`, `Ferris.lamps`): four real lights for the whole
  scene, given to the nearest sources that are on (rooms, shops, the offices, the hangar, the night's
  lamps; `lamps.add(object3d, { color, power, reach })`, `src.power` to dim). There were 17: three.js
  shades every point light for every lit pixel, and a change in the count recompiles every material.
- **Draw calls and triangles**: the block's cells, instancing, shared merges, the car tiers and draw
  distances under *Coast City's block* (`Lod.js`); 21 props decimated at build time (`tris` / `error`
  in `build-props.mjs`: the palms, the fire escape and the newsbox stayed heavy, they lose their shape);
  static things' matrices frozen (`matrixAutoUpdate` off), hidden people skipped.
- **Measured** in the block (Chrome, 1280×800, the pane's Mac): the update 5.3 → 2.9 ms, the render's
  CPU 32 → 11 ms, the GPU 25 → 13 ms, 1,134 draw calls (384 of them the shadow map), the heap 880 → 795
  MB. Entering free roam (with the streamed city): 5.4 s from Continue's click to control (16 s before
  the loading-screen work), the props 0.3 s, the valley and blocks 2.2 s, the shaders 2.1 s, then the
  first draw (0.5 s) under the loading screen; Part Six's `dawn` 4.3 s; Part Three's `morning` 1.4 s.
  The user's 30 s was on their server (a cold cache, or a slower first visit: not measured there).

### Story (`src/story/Story.js`, `src/story/lines.js`)

`Story` owns the flow, the current scene (`show(scene)`), the player, the camera director and the
interactions. Each chapter is an `async` method that awaits waits, tweens, dialogue and the
player's actions.

**Parts:** `Story` is Part One *and* the shared plumbing. Part Six's `Exile` extends `Probation`, and
its free roam `Roam` extends `Exile` (`main.js` makes a `Roam` for Part Six). Part Five's `Probation` extends `Prisoner`
(so it has Coast's Ferris, Carol and suit-up, and the Corps methods Prisoner copies).  Part Two's `Corps` (`src/story/Corps.js`)
and Part Three's `Coast` (`src/story/Coast.js`) extend it, and Part Four's `Prisoner` extends `Coast`
(Ferris, Carol, the suit-up) with Corps' Oa, travel and Guardian methods copied onto its prototype
(the list at the end of `Prisoner.js`); they and override `get save()` (their own
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
  `ferris` → `ferris()`, `carol` → `carolScene()`, `after` → `after()` (and Tom's call), `wreck` →
  `wreck()` (a flashback: its clock is 5:12 AM), `test` → `test()`, `catch` → `catchJet()` (the
  catch, the carry, `meetCarolGL()`), `hector` → `hector()` (the fight, `mindAttack()`,
  `sinestroOnEarth()`), `grave` → `grave()` (the end card, which offers Part Four). Part Four's
  (`PRISONER_CHECKPOINTS`) are `pilot` → `pilot()`, `cell` → `cell()`, `site` → `atrocitus()`,
  `ysmault` → `ysmault()`, `trial` → `trial()` (the end card). Part Six's (`EXILE_CHECKPOINTS`) are
  `dawn` → `dawn()`, `palace` → `bringHimIn()`, `tribunal` → `tribunal()`, `firstnight` →
  `firstNight()`, `qward` → `qward()`, `yellow` → `yellowLight()` (the end card), `world` →
  `openWorld()` (free roam; never resolves).
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

Test it by loading `#<id>` directly, and by playing on into it from the step before: `prepare()`
can hide a step that relies on something it hasn't built yet (see Gotchas).

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
arm reaching out, `toggleLantern()` is the L key (within 30 m it goes into the pocket dimension;
farther off or on another world it's recalled and set down in front of Hal in the same press; summon
needs ground in front of him). `lanternSpots(sceneObj)` registers the two E interactions that follow
`this.lanternSpot`: recharge below 99.5%, put away when full. `lanternReady` is false until the
pocket-dimension beat after the oath (`learnPocket()`).

**Travel** (Corps): `this.travel` is `'oa'` during the summons (E jumps straight to the voyage) or
`'chart'` from the range on (E opens `StarMap`). `travelReady()` needs flight above
`JUMP_HEIGHT[world]` (Earth 26 m, Oa 30 m) and no drill. The override of `updateInteractions()`
shows the prompt and consumes the E press. `openChart()` sets `powers.freeze` (time stops, as with
the wheel). `travelTo(id)` → `voyage()` → `arriveOa()` / `arriveEarth()`, which spawn Hal flying
(`player.airborne(vel)`) and save the checkpoint. Charted worlds are `d.worlds` in the save
(`allWorlds()` merges parts); `WORLDS` in `ui/TravelHud.js` lists them with their chart positions.
The ring's lines on a voyage follow the route (`ORBIT_LINE`, `APPROACH_LINE` in `Voyage.js`: Earth →
Oa, Oa → Earth, Earth → Ysmault, Ysmault → Oa); it said "Course locked: Oa" on every one before.
`Story.standDown()` puts Hal back on his feet after a cutscene that flew him (the voyage's dive left
his ring arm raised when `trial()` stood him on the dais: the user's "asking a question").

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
  - `ui.overhear({ name, text, whisper })` / `overhearHide()`: a smaller line above the subtitles for
    what Hal overhears (never takes the dialogue's place); `ui.pick(title, options)`: a small menu over
    the scene, keys 1-n or a click, a promise with `cancel()`; `ui.watching(n)`: the seen indicator.
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
`Save` (Part One, key `gl_awakening_v1`), `CorpsSave` (Part Two, `gl_corps_v1`), `CoastSave`
(Part Three, `gl_coast_v1`, `COAST_CHECKPOINTS`), `PrisonerSave` (Part Four, `gl_prisoner_v1`,
`PRISONER_CHECKPOINTS`; offered on the title once Part Three reaches `grave`) and `ProbationSave`
(Part Five, `gl_probation_v1`, `PROBATION_CHECKPOINTS`: `rent`, `commute`, `advance`, `testflight`,
`pickup`, `korugar`, `patrol`, `rebels`, `report`; offered once Part Four reaches `trial`, and by its
end card) and `ExileSave` (Part Six, `gl_exile_v1`, `EXILE_CHECKPOINTS`: `dawn`, `palace`, `tribunal`, `firstnight`, `qward`, `yellow`, `world`;
offered once Part Five reaches `report`, and by Part Five's end card). `partOf(id)` searches every part's
list. Each is kept
in `localStorage` with a cookie mirror (1 year, SameSite=Lax) for when storage is blocked. Settings
(voices) always live in Part One's store. `allUnlocks()` / `allWorlds()` merge every part's lists, so
constructs learned anywhere carry over. The pending restart is `gl_resume` in sessionStorage.
`PARTS`, `partOf(id)` and `takeResume()` serve the title flow. A store's shape:

```js
{ version: 1, checkpoint, reached: [ids], settings: { voice }, stats: { fears }, unlocks: [construct ids], worlds: [world ids], savedAt, playedAt }
```

`playedAt` is set by `checkpoint()` only (`savedAt` moves on every write, settings included, and the
settings live in Part One's store); stores from before it rank by `savedAt`, Part One's by 0.

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
  - The deck is a canvas-textured slate (noise, the flagstones' fills and dark seams, faint green
    grooves). Its lit markings are drawn in the shader (`deckGlow`, an `onBeforeCompile` patch over
    the emissive): hex flagstones 3.2 m to the corner with about half of them outlined, rings,
    spokes, the Corps emblem and the six spawn `PADS`, as distance fields anti-aliased over a pixel
    with `fwidth` (a line thinner than a pixel is drawn a pixel wide and dimmed; far off, the hex
    sides fade into their average glow). There are hex cover pillars (`blocks`), Kilowog's podium
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
  flies there. A floor disc of polished stone with lit rings and rays (a glow canvas on black,
  `lit()` drawing each line into it and into the groove layer); a crescent of seven pillars
  on the battery side (`HALL_PILLARS`: radius 10.8, 5.9–7.2 m, the eldest's in the middle), a
  Guardian's platform on each; the dais (`DAIS_TOP`); Abin Sur's bier (`BIER`, dark stone, lit
  edge); a great ring hanging over it; a spotlight on the Guardians. The floor's roughness is 0.45 and
  the dais's 0.55 (polished harder, the fill and key lights lay in them as white blots in shots from
  the pillars' side, Part Six's). Colliders are hull prisms and
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
  crossing with a cross street, a bus shelter, a billboard, two cars at the lights; the bins on the
pavement, the palms stood tree by tree on their trunks, `PALMS`, and every kit piece on its own base,
`piece(..., { root: true })`). Hal's car is `makeCar('phoenix',
  { primer: true })` (see *Props*). Everything the scene places from the props is listed in
  `FERRIS_PROPS`, which `Coast.prepare` loads first. `focus(at)` moves the sun's shadow box onto the
  action in whole shadow texels across the light (so still shadows don't crawl as it follows the
  car); `shadowSpan(half)` widens it for a shot that holds one box still (the boulevard, the gate);
  `follow` (a function of the camera) keeps it on Hal while he walks to Carol. Ground patches are
  `flat(w, d, tile)`, cut into tiles of 25 m or so (the desert 125 m), and the scene's near plane is
  0.1 (see Gotchas: the flicker). The sky dome follows the camera.

  `dawn()` (Part Six: the `dawn` sky, a low sun in the east). Hangar Two's inside (dressed for Part
  Six): a lit corrugated back wall, the shop office along it (lit windows, a door, a railed roof),
  the company sign and the flag, the safety lines round the airframe's bay, more of the downloaded kit;
  its floor is rougher (0.68: at 0.35 the work lights made a white blot of it).

  Part Three's afternoon adds to it: `freeJet()` (the prototype's boxes out of the world, the jet
  under a pivot at its middle, `jetRig`, with its nozzles' points, gear and gold-tinted canopy),
  `gear(down)`, `parkJet(at, yaw)` (solid again: the boxes are axis-aligned, so park it square to
  the field), `airBounds()` (flight over the field), `dusk()` (the sky's `dusk` preset, an amber
  low sun, warm haze) and `cemetery()` (built when first needed: the memorial park at `CEMETERY`,
  east of the road near the city: lawn, drive, the gate standing open, the fence, rows of the
  downloaded tablets, cypresses, a bench, Martin's stone at `GRAVE` with his name on a plate,
  `CEMETERY_PROPS`). Its near plane goes out with the camera's height (`update`): from 150 m up,
  3.5 cm between the apron and the desert was inside one depth step.
- **`CrashSite.js`** (Part Three): `SHIP` is exported; `fireRest` holds the fires low (they relaxed
  back to full), `glowBoost` brightens the ship's strip on cue.

- **`Site.js`** (Part Four): downtown Coast City at midnight. A fenced lot (`LOT`, x -30..30,
  z -26..22) between a south and an east street; the tower's steel frame (`FRAME`: H columns and I
  beams instanced from the girder kit, webs upright, two floors of slab, boxes for colliders); the
  Liebherr crane with blinking beacons; the excavator (`EXCAVATOR`, its parts by name in `digger`:
  `house`, `boom`, `stick`, `bucket`, `tracks`, each node a pivot, `userData.rest`); the spoil heap;
  container, porta-potties, mixer, bricks, pipes; a stack of beams and eight loose ones as physics
  bodies (`loose`, Atrocitus throws them); barriers; three floodlight towers (spot lights riding on
  them) and sodium street lamps (sprites, additive pools, a point light on every third); seven parked
  cars, three hydrants, bins and cans, a dumpster, two signs, a bus shelter (`buildStreet`); all of it
  through `smash` (the fence panel by panel, the lamps as poles, the cars as cars), raised pavements
  and the ground-floor slab you stand on (`walks`, `ground(x, z)`); ten office blocks with lit
  windows at night (`nightWindows`: their glass texels, a soft-edged lit room in one 1.6 × 3.4 m cell
  in five; triangle colliders) and downtown's towers. Atrocitus's machine (`DEVICE`, `buildDevice`: five iron spikes, a
  crystal heart whose pulse is `deviceU.uPulse`, a ring of Ysmault's script burnt into the ground).
  `blocks` is what Atrocitus and Sinestro walk and fly round.
- **`Ysmault.js`** (Part Four): the prison world. A basin of rust-red grit under the `ysmault` sky
  (a swollen red sun low in the north-west), nine darkened buttes round it, loose rock, and a ring of
  five obelisks (`RING_R`, their purple cracks turned red by `redStone`), chains and shackles;
  Atrocitus's obelisk is `STAKE`, its two chain anchors `anchors`; `chainBetween(a, b)` /
  `fitChain` stretch the chain prop between two points.
- **`Space.js`** also has **Ysmault** (`YSMAULT`, `buildYsmault`: rust and basalt, salt flats,
  fault lines glowing on the night side, a thin red atmosphere, its red dwarf); `show('ysmault')`;
  and **Korugar** (`KORUGAR`, `buildKorugar`: ochre continents, teal seas, its cities' ordered grids
  of light on the night side, a white-gold sun). `Voyage.js` routes Earth, Oa, Ysmault and Korugar
  (`SECTOR`, `ORBIT_LINE`, `APPROACH_LINE`, the approach target and dive per world).
- **`Korugar.js`** (Part Five): the capital, built (no download fits alien architecture), under the
  `korugar` sky. `PLAZA_R` 44 round a colossal stone Sinestro (`STATUE`, `PEDESTAL_TOP`: his own figure
  from `createSinestro`, posed with his hands behind him, turned to stone; a drum cut with the oath in
  glyphs); towers as one instanced kit (plinth, shaft, fins, crown, spire) under `stoneMaterial` (a
  world-space shader: slit windows lit amber at random, bronze bands, grime), boxes as colliders and
  `blocks` for walking round; his banners (`bannerTexture`: crimson, his profile, the emblem, the oath
  in glyphs; swaying, instanced) on facades and on poles that snap; the Avenue of Order north to the
  palace (`PALACE`, `BALCONY`), the market east (`MARKET`: stalls and crates through `smash`), the old
  quarter south (`QUARTER`, archways, the resistance's courtyard `HIDEOUT` with its map and candles),
  the Halls of Correction (`PRISON`, `CELLS`: alcoves barred with pulsing green light). The palace's
  front (Part Six): its first two tiers built round openings (`slab`, `holes`) with halls behind them
  (boxes seen from inside, inset so their walls hide the stone's): the bronze-framed portal between
  four columns, the oath on its lintel, his banners down the face, two braziers (`fires`, light reach
  4.2 m); the balcony (`BALCONY`, on the first tier's roof, over the portal on corbels, railed) with
  the lit doorway behind it and banners either side. `FORECOURT` is below it; `fillForecourt()` packs
  the avenue (the baked crowd again, `crowdKit`, `instanceCrowd(geo, spots, face)`, turned to the
  balcony, a lane |x| < 3.9 left clear, two box colliders). **Times Square for Sinestro**
  (`buildBroadcast`, `scenes/KorugarSigns.js`; the user, 2026-11-17): screens stacked up the plaza's
  tower faces (a big one over each banner, a second on the tallest, two rows either side) and two on
  each avenue tower, eight channels (`CHANNELS`: his portrait, slogans, the emblem, "report disorder",
  a saluting crowd, the news, the day count, the statue), each a 512×256 canvas redrawn at 8 Hz shared
  by its screens (one instanced quad per channel, an instanced bezel, an additive glow on the wall).
  His portrait is his own figure rendered once into a picture (`renderPortrait`). Tickers round two
  plaza towers (`tickerBand`, scrolled by texture offset), neon blade signs down the avenue and over
  the market (`bladeSign`, static), and skycars in lanes above the towers and down the open avenue
  (`SkyTraffic`, `ringLane`, `runLane`). The stone's windows and bronze bands are anti-aliased in the
  shader and fade to their average under a few pixels; the palace's columns are plain basalt; banners
  hung on walls use `wallBannerMat` (no sway). The crowd:
  `CROWD_FRONT` (16 spots for the story's full figures) and `buildCrowdFill` (about 1,600 instanced
  low-poly Korugarians, baked standing and fist-up: `setCheer(on)` swaps them). `airBounds()`.
- **`Ferris.js`** for Part Five: `roadGround()` (a 16 km heightfield for a car), `freeCar()` /
  `carSolid()` (his car's stand-in box out while it's driven, back where it stops); the boulevard's
  furniture is solid now (office blocks as triangle colliders, pavements as 14 cm boxes, palms by the
  trunk, lamps and signals that snap, bins and hydrants loose, the cars at the lights as cars); the
  **airspace** (`airspace()`, `flightAir(on)`: a 160 km relief, `reliefAt(x, z)` ridged noise past 9 km
  with dry lake beds, the coast `coastX(z)` and the Pacific west of town, Coast City from the air as
  ~1,700 instanced blocks over a paving the desert shader paints itself, the sky dome scaled, fog
  thinned, far 90 km); `terrainAt(x, z)` (the flats, the mesas, the relief) for the jet; `nearMax`
  caps the height-driven near plane (0.3 in the cockpit).

- **`Qward.js`** (Part Six): the antimatter world. A plain of black glass (`obsidian()`: glossy, its
  veins single noise isolines lit gold and violet, a pixel wide at least and faded to their average far
  off) under the `qward` sky, a dead sun (a black disc in a violet corona, following the camera); 16
  buttes of the same glass (the `cliff` prop) either side of the way north; two hexagonal glass pillars
  (`PERCHES`, `PERCH_H` 9, the archers' perches); 22 rocks hanging in the air; the forge at `FORGE`
  (a slab of rougher glass a few centimetres proud of the plain, eight obelisks with their glyphs turned
  yellow, `yellowStone`, a lathed crucible of molten light, `forgeMaterial`, its column going up 160 m,
  a light); ash round the camera; violet lightning in the sky. `RIFT_AT`, `AMBUSH`, `LANDING`,
  `airBounds()`, `blocks`, `focus(at)`. Props: `QWARD_PROPS`.
- **Korugar by night** (`kor.night(on)`): the `korugarNight` sky (violet, a moon, stars), dark fog, low
  hemisphere, a moonlit key, more of the towers' windows lit (`STONE_NIGHT`), the statue's stone darkened
  (`multiplyScalar(0.2)`: in linear terms); `night(false)` puts the day back. The statue (`scenes/Statue.js`, the user's
  note "his statue has like his weird hands", and the fall "not very good"): `bakeStatue` poses
  Sinestro's figure (chin up, his hands clasped behind his back by the arm IK to his live `behind`
  stance) and bakes it into stone on the CPU (`applyBoneTransform` for positions and, a millimetre out,
  normals), cut in three (the feet below the ankles by bind height, the head by its bone, the body),
  jagged stone plugs on the breaks; each piece solid by its own triangles (`statueSolid`).
  `statueTilt(k)` tips all of him on his toes (`TOES`, up to 0.3 rad); `statueFall({ onEvent })` runs
  `StatueFall` (its own Rapier world: the plaza and the pedestal's tiers): pinned about the toes as a
  rigid rod (θ'' = 3g/2L sin θ) to 0.75 rad, then let go with that motion and the chains' pull (5 m/s
  forward), turning about one axis only; the head breaks off near the ground (a ball with its share of
  the motion) and rolls; events `crack`, `head`, `impact`, `settled` (Exile's dust, shake, sounds and
  rubble go on them). `fallen()` runs the same simulation to its end at once, so free roam's statue
  lies where the chapter's fell. `laid()`: solid where he lies, `fallenBlocks` to walk round.

**Coast City's block** (`src/city/`, 2026-11-18; the first piece of the open world's city): the
boulevard from Hal's lot to the cross street, both sides, built into the Ferris scene at `LOT`
(`Ferris.blockOn` when its props are loaded; `buildCity` then leaves that stretch to it).
- `Kit.js`: the materials (stucco that weathers in the shader toward the ground and in sun-faded
  patches, painted and old brick, barrel tiles, shutters, frames, iron, roofing, canvas, road paint) and
  **the glass**: interior mapping (each pane's room in its attributes `aCell`, `aRoom`: the camera's ray
  followed into a box of a room, its walls, floor, ceiling, a sofa and a picture, shops' shelves of goods
  and fluorescent tubes, blinds and curtains in front, lit room by room at night or a TV's flicker, the
  sky in the glass at a grazing angle). `Batch` merges geometry by material: the block is about 20 draw
  calls and 77k triangles of its own.
- `Building.js` `building(ctx, spec)`: walls as slabs with their openings cut (reveals, frames, sills,
  meeting rails, lintels, iron bars), shop fronts (kick plate, mullions, transom, door, the sign board
  fitted to its lettering, awnings, barrel-tile pent roofs, shutters, neon in the window), doors (and
  French doors onto balconies), balconies with balusters, belt courses, cornices, copings (concrete or
  tile, following a mission gable's curve), deco pilasters, streamline bands, downpipes, a flat roof with
  condensers, vents, a hatch, a dish and an aerial, or a tiled hip. `label` for lettering, `decal` for the
  mural and the ghost sign. The colliders: the mass, the parapets (walk on a flat roof), a hip's hull.
- `Signs.js`: two sign atlases (painted boards, lightboxes that glow), vertical blade lettering, window
  neon, the mural ("Greetings from Coast City") and the ghost sign.
- `HalsBlock.js`: seventeen buildings (`WEST`, `EAST`: a laundromat with the mural facing the lot, a
  barber with a mission gable, three-storey flats over a takeout and a pawn shop, a liquor store, a
  taqueria with the billboard on its roof, a deco savings and loan, a pharmacy, auto parts, Rosie's
  diner on the corner; courtyard apartments with a hip roof, donuts, records and check cashing, a
  florist in old brick, the Hotel Marisol with its blade sign, a hardware store, a clinic, a pho house);
  the street (`BLOCK`: parking lanes added, kerbs at x -0.4 and 12.4, pavements to x -5.9 and 17.9;
  joints, red kerbs at hydrants, the corners and the bus stop, gutters, the double yellow, the parking
  T's, meters, about 20 parked cars, crosswalks, drains, manholes, palms in grates, lamps scaled to 7 m
  street lights, hydrants, newspaper boxes, a mailbox, a cabinet, the bus stop along the kerb, open to
  the pavement, and a bench); the
  alleys (walls, power lines, bins, dumpsters, a cart, the fire escape); `setNight(k)` (lamp pools,
  halos, the lamp pool's sources, light from the shops on the pavement, the neon). `Ferris.night()` is the
  night preset that turns it on.
- **Colliders are exact**: `ctx.solids` go to Smash with `shrink: 1` (its default shrinks a box 6%,
  which left the diner's floor half a metre short of every wall: see Gotchas). The fittings built from
  boxes are solid (`kit().solid`: the counters, the back bar's runs, the kitchen wall and line, the
  store's counter, cigarette wall, gondolas, candy rack, ice chest), the doorway has a threshold, a
  door swings away from whoever's coming (`d.away`: in from the street, out from the room), the
  linings stop at a side wall's windows (`openL` / `openR`), and the booths' tables and vinyl are satin
  and non-metallic (`satin`; the download had them as metal). The booth's table top is 64.5 cm up.
- `Interiors.js`, **rooms to walk into** (2026-11-18, the user: "building not interactable yet"):
  a shop with `interior: 'diner' | 'market'` gets clear glass (`clearGlass`, not the room shader), a
  glazed door on a hinge that swings in as Hal comes within 1.7 m (`ctx.doors`, `block.update`, a
  bell: `block.onDoor`), and colliders that are walls, a floor at the pavement's height and a ceiling
  in place of one block (`building()`, `ctx.inside`). **Rosie's Diner**: booths down both windows
  (`booth`, two down the side, back from the door), the jukebox, thirteen stools at a red and chrome
  counter with a foot rail, place mats, napkins and ketchup, the back bar in two runs either side of
  the pass (the coffee machine, warmers and pots, a pie case, cups), the menu boards, the pass to the
  kitchen (heat lamps, the order wheel; the line, griddle and hood behind), the restrooms (the men's
  is somewhere to change: `restroom` spot), pendant lamps. **Coast Liquor**: the counter (the brass register, the lotto
  lightbox, scratchers, the cigarette wall, a candy rack), three gondolas stocked to the edges, six
  coolers of cans, wall shelving, the ATM, magazines, the ice chest, a security mirror, a drop
  ceiling with troffers. Goods are two instanced meshes over a label atlas (`goodsTexture`,
  `stockShelves`: about 2,500). Each room's lamp is a source in the scene's lamp pool (see *Loading
  and performance*), not a light of its own. `ctx.spots` are what the
  story makes interactions of (Roam's `blockRoam`): sit at the counter or in a booth (`Roam.sit`:
  walked up, lowered onto it by `sitEdge` with the hips at the seat's height, `autoAnim` off; E or a
  step gets up), the jukebox (`Roam.jukebox`, a progression on `musicBox`), the menu, the store's bell,
  cooler and magazines (barks). **His flat**: E at his building's door on the lot (`enterFlat`): the
  Bedroom scene by day, or by night as the town is (`flatTime`: lamp, hall light, moon, sky, clock),
  the fridge, coffee, photo, window, the front door out (`exitFlat`); the bed sleeps the town from day
  to night or back (`Roam.sleep`, `Ferris.night()` / `day()`).
- `Lod.js`, **drawing by distance** (the user, 2026-11-18: "once Hal goes 200-300 meters away from the
  place there is no need to render everything"): `Ferris.lod`, checked five times a second and at once
  after a cut, from the camera; hysteresis of a tenth. Only drawing changes: bodies, colliders and
  Smash's items are untouched. The block's tiers (`DRAW`): walls, roofs, glass, signs, pavements and road
  paint always (from the air they're the town), in 80 m cells (`Batch.buildSteps`, `cell`) so the view
  and the shadow camera cull them; its trim (frames, sills, iron, copings, awnings) within 220 m; the
  street's furniture within 200; small props within 90. Inside the rooms: shelves, coolers and rooms
  within 45 to 50 m, small things 35, goods 50, doors 60, none of them casting shadows. Everything else
  Smash holds at Ferris by size (90 / 200 / 600 m, buildings always; shadows within 35 / 70 / 150); the
  prototypes (the apron's 1.8 km, Hangar Two's 300 m). Static props are merged per material when placed
  (`flatten`: a pole's 19 parts, a condenser's 12, one draw call each per material), and those that never
  move and repeat (`STILL`: palms, decals, booths, stools, coolers, wall shelves, the ATMs) are instanced
  per geometry, material, cell and tier. Merged copies share geometry where their parts and placement
  match (`mergeByMaterial`'s `shared`, refcounted, `releaseMerged`). **Cars** (`addCar(car, dist, item,
  { near, low, shadow })`): beyond `near` (15 m for traffic, 4 m for parked cars) a merged copy of
  themselves (about 10 draw calls, not 54), beyond `low` (45 m) a copy simplified to a third of its
  triangles (`simplified`, meshoptimizer), made again if the car has been hurt since; within `near`
  their own parts, for dents, glass and doors. At most two copies are merged per check (each is a few
  milliseconds). Measured in the block on 2026-11-18: 2,829 draw calls to 974; 230 m off, 1,906 to 491.

**Hal's block's people** (`story/CityLife.js`, `new CityLife(story, ferris).start()` from
`Roam.blockRoam`; 2026-11-18): 28 of the Rocketbox people (`STAFF`, `DINERS`, `STANDS`, `WALKERS`), each
with a voice (`townm1-3`, `townf1-3`, `citykid`, `rosie`, `cook`, `clerk`), a `label` (how Hal hears them
named: "A woman", "Rosie") and a `tag` for the groups that talk; lines for Hal Jordan (`hal`) or Green
Lantern (`gl`) by `story.civilian` (`TALK`); E beside one: they stop, turn to him, say one not heard just
now, the jaw on the voice. Movement is one primitive: `go(p, worldPoints, { speed, face })` (state
`route`, resolved on arrival, paused while they speak), `hold(p, yaw)`, `seatPose`, `carry(p, mesh)` /
`put(p, at)` (a thing on the right palm kept level in `post`, held out at the waist by `carryPose`).
- **The diner at work** (`story/DinerLife.js`, from the room's measures `ctx.rooms` and the seats it
  builds: seven booths' two benches, the two side booths', thirteen stools; each with its sit point,
  approach, plate spot on the table, and where Rosie stands to serve it). Rosie's routes (`route`): her
  lane behind the counter, out at the nearer end or through the counter's gate (`gate()` in
  `Interiors.js`: the counter in two runs with a red half door between them in front of the pass, swung
  open for her by the block's doors as `staff`, solid to Hal; round the ends only, a trip to a booth was
  25 to 35 s), the floor by the aisle, the pass between the back bar's two runs. **Hal comes first**: his
  order is taken first, his ticket goes to the front (Dot cooks it in 6 to 8 s), she walks it faster
  (`HURRY`), waits at the pass for his plate and takes it straight out, and fetches his coffee from the
  nearer end of the back bar (measured: asked 23 to 33 s after he sits, eating 40 to 50 s after that). Her loop (`nextTask`): Hal's order first, then plates up at the pass, then customers
  waiting, tables to clear, coffee to top up at the counter, else wiping the counter (her hand in
  circles). An order: to the table, her pad out (`pad`), the customer's line and hers overheard, the
  ticket up at the pass; Dot (`cookLoop`) takes it, cooks it at the griddle (hands working, a sizzle),
  plates it (`meal(kind)`: a patty melt and fries, a short stack, soup, tuna on rye, cherry pie and tea,
  a milkshake, coffee), puts it up with the bell and "Order up!"; Rosie carries it out and sets it down,
  leaning over. Customers eat (fork to mouth, the food going down, `shrink`), leave money and walk out
  the door (it opens for them: `block.openers`) back onto the pavement as walkers; walkers passing the
  door turn in (`arrive`) to a free table. **Hal**: wherever he sits (`Roam.sit` → `halSits`), she comes
  (or says "Be right with you" if she's busy), asks, and `ui.pick` gives him coffee, the patty melt
  and the cherry pie, or nothing (keys 1-3); she brings it, and he eats while he sits; get up and she
  clears it. Talking to her (`talkTo`): she stops where she is and they talk, her line, his, hers
  (`ROSIE_TALK`, by night `ROSIE_NIGHT`, to Green Lantern `ROSIE_GL`). Coming in: she says hello from
  wherever she is and the room looks up (Dot calls her if it's Green Lantern).
- **Inside, besides**: Ray at the liquor store's register, a shopper down the aisle (close to the shelf:
  in the aisle's middle he left Hal no way past); **the store's bell** (`bell()`): Ray comes to the
  register and answers.
- **Hal in the way** (`inWay`, `excuse`): anyone on a route or pacing a beat stops short of him rather
  than walking into him (a kinematic capsule walked into the player's left him stuck), and after 1.2 s
  asks him to let them by on the overheard channel (`byRosie1-2`, `byRosieG`, `byM1-3`, `byF1-3`, `byK`,
  `byCook`); not while he sits or flies.
- **What he overhears** (`TALKS`, `updateTalks`, `playTalk`, `murmur`): pairs near him (the couple, the
  friends outside Sunny's, the mother and her girl at the bus stop, Rosie and Dale at the counter, Ray
  and the shopper, the man on his phone) talk among themselves out loud, or whisper about him (Martin
  Jordan's boy, the Ferris pilot; the girl sees his ring glow) or about Green Lantern ("Don't stare");
  Green Lantern walking past people gets something under their breath (`MURMUR`). On their own channel
  (`voice.murmur`, its gain from his distance, cut when he walks away; a line without a clip times out
  in game time, `silent`), shown in the overheard line (`ui.overhear`, italics for a whisper); one
  exchange at a time, 40 s before a group talks again. The voices: style `'whisper'` in
  `build-voices.mjs` (`whisperize`: LPC per 20 ms frame, noise through the envelope, a fifth of the
  voiced sound kept, 7 dB down).
- **Who can see him** (`seenBy`, five times a second): anyone active facing him within 80° (and not
  far above their eye line), within 40 m by day or 20 by night, with nothing fixed between their eyes
  and his chest (a ray that skips the people's capsules). `Roam.watchers()` uses it: see *his secret*.
- **The street**: thirteen walkers on one loop (`LOOP`, block-local: down the west pavement, over the
  crosswalk at the corner, up the east one, out round the bus stop), half each way, keeping right
  (`lane`), stepping round Hal and slowing, no faster than someone ahead, glancing at him as they pass;
  the loop's last leg (the lot, where the pavements stop) is crossed **out of sight** (out of the
  camera's frustum or beyond 70 m: snapped to the other end), and someone at it in view waits, then
  turns back. A mother and two kids at the bus stop, a man on its seat, a man on his phone against
  Coast Liquor (the phone on his palm, the hand turned in `post` so it lies along his cheek), two
  friends talking outside Sunny's (nodding in turn).
- **Reactions**: Green Lantern flying low (within 16 m, 3 m above): they stop and look up, some point,
  the kids point, someone calls out (`cityUp1-3`); a construct cast near them (`powers.watchers`): the
  street runs, then crouches, then walks back to where it was (`return`, `settle`); inside they crouch
  where they are.
- **By night** (`ferris.isNight`) half the walkers and the bus stop's people and the friends are gone,
  going home and coming out only where the camera can't see them (`p.out`: the clock runs now).
  **Cost**: anyone beyond 110 m of the camera (40 m inside) isn't drawn or animated (nor are their
  matrices updated); the rest are posed every frame within 25 m and in view, every third frame farther
  or out of view, every eighth far and out of view; shadows within 22 m. They're made one at a time
  between frames, hidden until their shaders are compiled (`Story.warmUp`).
- **Their bodies are in no collision pairs** (`setCollisionGroups(0x00020000)`): Hal's controller still
  finds them (its queries don't filter by group) and the ring finds the emergencies' actors as targets,
  but a person walking through a parked car doesn't shove it (an officer did, and half the street went).

**Free roam's open world on Earth** (2026-11-19, the user's "finish everything I told you": the plan
agreed on 2026-11-18, see *Working with this user*). In the Ferris scene, free roam only:
- **The day** (`scenes/DayCycle.js`, `Roam.updateDay`): a clock at GTA's pace (a minute every 2 s, a day
  in 48 min) running wherever he is (off Earth the clock's place shows the sector); the sun on an arc
  (east +x, over the south -z, west), the moon after it, the light handed from one to the other at the
  horizon where both are faded out; ten keyframes of the story's own presets (Sky.js `PRESETS`, exported;
  Ferris's `day`/`dusk`/`night`/`dawn` values) blended: sky, sun, hemisphere, fog, exposure, the image
  light (`environmentIntensity`, 0.4 by day to 0.1 at night: at 0.4 the street at 2 AM was lit like an
  overcast noon), the town's lamps and windows (`block.setNight(k)`, the glass's `cityU` sky and
  daylight), `f.isNight`. **Weather** over it (`WEATHER`): clear most days, the marine layer some
  mornings (`haze`, fog ×11), overcast, now and then rain (streaks in a box round the camera, off indoors:
  `block.indoors`; the asphalt and concrete materials darker and glossier, roughness floored at 0.42 or
  the kerbs went white; its hiss), crickets at night, birds of a morning. `LifeSave` (engine/Save.js, its
  own store `gl_life_v1`) keeps the hour, day and weather. Night needs no recompile: the scene's point
  lights are the lamp pool's four, the same count all day, and the night kit's materials are compiled on
  the way in (`Story.warmUp` with the night set, in the background). Sleep
  in the flat sets the hour (7:06 AM or 7:39 PM).
- **His life** (`story/Life.js`, the panel under the clock `#life`, `ui.life`): **money** (starts $38.50;
  Ferris pays a test pilot's $62 an hour on the clock, see *Work at Ferris* below; the rent $75 a week to Sal at the notice by the flat's door, $5 a day late, the
  lock changed after five; Rosie's coffee 50¢ and the melt and pie $5.25, on a tab to $15 if he's short,
  Green Lantern's on the house; Ray's soda, candy bar and scratchers, which sometimes win); **XP** (60 a
  chapter played in any part, backfilled the first time; Kilowog's round 40, a Qward wave 30 + 10n, a day
  at Ferris 15, an emergency 60 to 70), a level each 100 + 50(n-1), a point each; **the ring's six stats**
  (K, `Roam.ringStats`, `STATS`, ten each) into `powers.mods` (cost, damage, drain, parry window, aim
  assist), `maxHealth` and `healBoost` (endurance), `trickle` (willpower), `player.flyScale` (flight);
  **public opinion** (-100 to 100, starts +35; `opine`: the ring breaking city property in town -1.5, a
  car hit -1, burning -2, blown up -4, through `smash.onEvent`, not collisions; people frightened -0.6;
  talking to people +0.4; emergencies +5 to +6, -3 ignored), shown as Green Lantern with its word
  (`mood`: Beloved to Hunted), and what people say and mutter to him follows it (`TALK_GOOD`, `TALK_BAD`,
  `MURMUR_GOOD`, `MURMUR_BAD`).
- **Traffic** (`city/Traffic.js`): 16 of Smash's cars driven kinematically on lanes (northbound x 4,
  southbound x 8, the cross street's eastbound z -207.8 and westbound -212.2, keeping right), through the
  crossing's light cycle (`PHASES`, no visible lamps: the signal props are one mesh) or turning (cubic
  curves), up the block into a bay in Hal's lot or out of its mouth, appearing and leaving only out of
  sight; slowing for bends, following at a gap, stopping for the lights, Hal, his car, people and
  `extra` things in the road (a wreck, the police; `holdR` holds a stretch for those coming, not those in
  it); horns, a whoosh going by, headlamps and tails at night. Hit by anything, a car is physics's
  (`release`), towed when unseen 45 s on and replaced (`tow`). In the LOD and the camera's ignore list.
  `dispatch(model, pts)` sends a car in from as near as it can start unseen (the police, the ambulance).
  Two cars Part Three left at the lights stood in the cross street's lanes on the wrong side: moved to its
  kerbs.
- **Emergencies** (`story/Emergencies.js`): every 2.2 to 4.5 game hours one of a hold-up at Coast Liquor
  (a revolver on Ray, his hands up; as Green Lantern comes in he turns, aims 0.7 s, fires twice, runs),
  a mugging in the west alley (one squares up: a wind-up, a lunge, a punch; one runs), a crash at the
  crossing (traffic held off, the wreck set once it's clear and unseen, steam, the driver trapped: E tears
  the door off; it burns at 75 s), a fire in the flats over Lucky Dragon (flames out of four windows,
  smoke off the roof, a woman waving on the roof: fly up, E carries her down; the fire crew after, the
  fire dying; at 100 s they get her). The ring's alert, a marker. Actors are CityLife people (`actor`,
  `mute`, `barge`: they don't wait for Hal, `ghost`: no body while sat in a car) with ring targets;
  downed by blows. After: the police (`policecar`, its roof bar flashing, two officers, by gaps in the
  parked cars and in by the door, cuffing) or the ambulance and a paramedic. The scene's cleared when
  unseen. People: Rocketbox `police-*`, `medical-*`, `fire-*` and three men added to `build-people`.
  Props: `policecar`, `ambulance` (Daniel Zhabotinsky, the town cars' artist), `revolver`, `policeline`,
  `helicopter` (CC BY, credited).
- **Pressure** (`story/Pressure.js`; the user's "cordons, helicopters, booing, the Air Force at the
  lowest"): as Green Lantern in town, opinion under -30 brings a news helicopter circling him at 55 m
  (its rotors on hubs, a drawn cone of a searchlight at night, fainter with the camera inside it); under
  -50 police lines across the block's two ends (traffic stops at them) with a cruiser behind each, bars
  going; under -80 a pair of jets low over the town every 35 to 60 s, a boom. The booing is the mood
  pools' murmurs. `Smash.remove(item)` takes a prop out of everything (the items, the physics step's list,
  the world, its fire).
- **The other shops** (`city/Shops.js`, `shopRoom`, `SHOPS`): the eighteen besides Rosie's and Coast
  Liquor are walk-in now (`interior: '<trade>'` on their specs: Suds & Duds, Ortega's barber, Lucky
  Dragon, Pacific Pawn, Mendoza's, the Savings & Loan, Sunset Pharmacy, Garcia Auto Parts, Sunny's Donuts,
  Rialto Records, Checks Cashed, Flores Elena, Café Marisol, Panadería La Estrella, Pacific Hardware, the
  Clínica, Phở Saigon, Coast Cellular). Each: the shell, its floor and walls, the shop's part 10.5 m deep
  at most (a wall across with the back room's door: deeper was a hall of empty floor), a counter on the
  far side from the door with stocked shelving behind it, the trade's fittings (tables and chairs with
  napkins and ketchup, washers, barber chairs and mirrors, glass cases, gondolas, record bins, flower
  stands, the tellers' glass, waiting chairs, a phone table), the block's props (a cooler, the espresso
  machine, an ATM, planters, a vending machine), posters, its board over the back wall, ceiling tubes.
  Staff: a Rocketbox person per shop at a post (CityLife makes any post's `staff`, with `lines` of their
  own); E at the counter (`buy` spots, `Roam.shopBuy`): the trade's items, paid (food heals a little, the
  clinic all of it, the laundromat and the barber take the time), thanks by voice, Green Lantern told
  he's welcome. Each shop's lamp is a source in the lamp pool (`ctx.shopLights`, HalsBlock's `shopLamp`):
  each its own point light would have cost every frame.
  A fitting may place its own staff (`room.post`), the buy spot (`room.buy`) and **regulars**
  (`regular()`: a post of anyone else, standing on a beat or sitting, `sit`, on a stool or a chair); a
  trade may keep its own counter (`ownCounter`), go without the stocked back shelving (`back: false`),
  keep its whole depth (`deep`), skip the generic posters (`posters`). The shops count as indoors for
  the rain (`block.indoors` checks `ctx.shopLights` too: it knew only the diner and the store).
- **The block over the crossing** (2026-11-19: "the police station, a hospital and a bar"), built by the
  same `buildHalsBlock` into the same ctx (one batch, one set of materials, one lamp, the same doors and
  spots; its own seeded random, `rndS`, so Hal's block comes out exactly as before: the refactor was
  checked against a fingerprint of the block's geometry). `WEST2`, `EAST2` from z -221 to -396: the **Blue
  Marlin** on the corner (brick; the bar down its far wall with a foot rail and taps, a smoked mirror and
  three shelves of bottles, stools, a pool table under its lamp, the jukebox, a dartboard, beer signs; Gus,
  two regulars on stools; a beer, a whiskey), the **14th Precinct** (deco pilasters, blue lamps by the
  door; inside the lobby's benches and boards, the sergeant's high desk with the flags behind it, the bull
  pen's four desks with typewriters, phones and lamps, filing cabinets, the coffee, the holding cell's bars;
  the sergeant and an officer at his typewriter; its cruisers at the red kerb out front), travel agent,
  thrift shop, the **Coronado** (four storeys: the cleaner's with its garment rail, bail bonds), a
  bookshop, the **Palms** (its marquee with this week's pictures and bulbs, a blade sign; the lobby's
  concession counter, popcorn machine, candy case, carpet and brass posts, posters, the two theatres'
  doors; a ticket takes two hours), Tony's Pizza (a brick oven); east, Starlight TV (sets on with their
  screens lit, three in the window facing the street), Belle's salon (hood dryers), **St. Mary's** (four
  storeys, its name lit on the roof, the emergency room's canopy over the pavement on two columns, the
  ambulance at its red kerb; inside the triage desk, rows of chairs, the TV, the water cooler, a gurney,
  the doors through to treatment; the triage nurse, the doctor on his rounds; $30 heals), the Iron Beach
  gym (a ring, heavy bags, a bench, dumbbells, mirrors; a workout takes an hour and heals), Del Mar Court,
  the Ocean Market (produce down the wall, gondolas, coolers). Its street (`STREETS.south`, the same
  `street()` as Hal's by a layout: the corner along the cross street, the red kerbs and the zones kept for
  the police and the ambulance, the stop bar and crosswalk at the crossing, the kerbs' end at the old
  boulevard, `endKerb`) and alleys (`ALLEYS`). Ferris's `buildCity` gives it the stretch to `SOUTH_END`
  (-404) and moves the crossing's south signals out to its kerbs; the stop lines are off the crosswalks now
  (`STOP` in `Traffic.js`: SB -196.6, NB -223.4, EB -6.5, WB 18.5). People: its own walkers' loop (`LOOP2`,
  `WALKERS2`, each walker has `p.loop`), the shops' staff and regulars (seated posts), 22 more Rocketbox
  people (`build-people.mjs`; `female-adult-16` failed to build and was dropped). Signs: the atlas grows
  pages (`signs.more`, `SignAtlas.fits`: two blocks' signs overflowed one, see Gotchas).
- **The Ferris offices** (`city/Office.js`, `Ferris.buildOffice` with the kit loaded): a two-storey
  building where the box stood, facing the staff lot, FERRIS across its north end; the lobby (reception
  desk and the receptionist, a CityLife post added by `CityLife.posts()`, the company's board, models of
  the prototype and an F-104 under glass, the test pilots' wall, Martin Jordan's portrait a `look` spot
  with Hal's thought, a sofa and magazines), the offices beyond staff only. Its doors through the block's
  `swingDoors` (exported from `HalsBlock.js`, with `SOLID`); `Ferris.indoors(at)` is the block's or the
  offices' (the rain asks it).
- **No air** (`Roam.updateAir`): out of the uniform on Oa, Ysmault or Qward (Korugar has air) a breath
  held, then the drain growing (gone in about 7.5 s), the grade's `uChoke` (drained, a closing tunnel,
  swimming), his heart, hands at his throat, legs going (`player.hamper`); T forms the uniform; down, the
  ring forms it on him at the last ("SUFFOCATED").

**The rest of Coast City, streamed** (2026-11-19, the user's "4x4 km", then "please do" to my plan: the
agreed 1.5 km core at full detail, a ring out to 4 km of fronts without interiors, the skyline beyond).
In the lot's frame, built round Hal's blocks whenever the block's kit is loaded (`Ferris.cityOn`: free
roam and the chapters that load Ferris with it):
- **The plan** (`city/Plan.js`): north-south streets every 80 m (`streetX(k) = 6 + 80k`: the boulevard
  k 0, Ocean Avenue on the beach k -14), east-west ones every 200 m from z 70 and Hal's cross street at
  -210 (`STREET_Z`); kerbs 7 and 6 m from a street's middle, fronts 12 and 11 (the boulevard's 6.4 and
  11.9, Hal's blocks'). The city from the shore (x about -1205, `shoreX`) to x 2818, z -404 to 3592: 980
  blocks (`cityCells`) 56 m across, two rows of lots back to back with an alley. Beside the boulevard by
  Hal's blocks and his lot only the outer half is new (`half`); his lot and building are kept clear
  (`HALS_LOT`). Districts by place (`district`): the **waterfront** (two columns along Ocean Avenue:
  pastel deco hotels and apartments, three to six storeys, streamline bands, pilasters, beach shops),
  **downtown** (300 m round (-560, 660): towers on plazas and masonry office blocks), **midtown** (to 540
  m: midrises and mixed blocks), **town** (the rest of the core: shops on every other street, flats and
  courts between), the **ring** (shops on every fifth street, flats and courts, single-storey houses with
  hip roofs and side yards to the north), **industrial** (east and south: warehouses, roll-up doors,
  painted names). Each face is filled with the kit's specs (`style`: shops, mixed, homes, houses, deco,
  midrise, warehouse), corner buildings turning the corner with shops or windows; signs from a pool of
  made-up businesses (`SIGNS`), names of courts, hotels and firms. `CityIndex`: every spec's boxes and a
  40 m grid of them (`solidAt`, `cellAt`). `planCell` is deterministic (each block's own seed).
- **Towers** (`city/Tower.js`, `tower(ctx, spec)`): a lobby of glass between stone piers, a canopy and
  the name over it; curtain wall floor on floor (spandrels, mullions, a pane a bay with its office behind
  it: the kit's glass with room kind 4, tinted and reflective, `vTint` from the pane's colour); setbacks;
  a crown (plant room, stepped deco shoulders lit at night, or a radio mast). One collider a tier.
- **Streaming** (`city/Stream.js`, `CityStream`, `Ferris.city`): a block is built when the camera comes
  within its reach (280 m in the core, 220 out of it, 950 for a block with a tower), nearest first, 3.5 ms
  a frame (9 when one within 90 m isn't built), its meshes shown three a frame (each is uploaded the
  first frame it's drawn), and put away beyond 1.25 times its reach, one a frame. Built: its buildings
  merged by material in runs of 350 parts (`Batch.buildSteps`'s `chunk`), walls, roofs, glass, signs and
  pavements drawn in reach and the trim within 210 m; pavements, kerbs, gutters; lamps and palms along
  the kerbs, hydrants, and in the core the signals at its corners (Hal's crossing and the T at his lot are
  Ferris's), drawn instanced (`placeKit`: each one a Smash stand-in without meshes; a post that snaps gets
  the real piece back and its copy taken out); colliders for every mass, parapet and pavement (plain
  boxes); the lamps' pools and the shops' light at night. Their backs on the alleys are blank (`back:
  false`). Once uploaded a block's arrays are let go (`freeArray`). No props on the walls and roofs, no
  interiors, people, parked cars or traffic: those are Hal's blocks'. Everything else is **shaded boxes**:
  one instanced mesh of every building's boxes (`buildFar`, 16,700), windows, storeys, glass towers, roofs
  and lit rooms at night in the shader, a block's hidden while it's built (`aShow`). Flying into a block
  that isn't built, `solidAt` is the flight's `solid`. `fill(x, z, r)` builds the blocks round a point at
  once (Ferris's steps fill round the lot; free roam's way in round where he arrives).
- **The ground and the bay** (`city/Ground.js`): one mesh over the city in 100 m tiles at y 0, its streets
  painted in the shader from the grid (`GRID_GLSL`: asphalt, the double yellow, the parking lanes' lines,
  crosswalks and stop bars at every corner, the pavements' concrete, alleys, downtown's plazas, the
  promenade and the beach to the wet sand); not over Hal's lot or the lines his blocks paint themselves.
  The desert, the old boulevard's asphalt (south of -412 now) and the cross street's plane step aside for
  it. The sea (`cityOcean`, in every Ferris scene: the coast came in): shallows to deep water, surf
  running in, waves in the normals. **The coast** (`coastX`, `COAST_GLSL` in Plan.js, used by Ferris's
  desert, relief, sea and airspace): the old shore far west, sweeping in to the city's beach as a bay.
- **The waterfront** (`city/Waterfront.js`): Ocean Avenue's promenade the city's length (paving in 100 m
  pieces, the sea wall with gaps, palms, lamps, bolted benches), lifeguard towers every 300 m, and the
  pier at z 372 (a ramp over the sand to a deck at 4.2 m on piles, railings, lamps, a bait shop, an
  arcade, the Crab Shack across its head, and a Ferris wheel turning, its cars kept level; the pier's
  deck is somewhere to land, `onPier`).
- Free roam's flight covers it (`powers.attach`: centre (0, 4600), radius 6400; no landing in the sea).
- **Cost** (the pane's Mac, 1280×800 at 1.5): at a street in the core with 31 blocks built, the city
  added about 4 ms of GPU (17.5 ms against 13.6 without it) and 440 draw calls; the page's memory after
  collection 1.1 GB (0.8 before). Flying north at 40 m/s, 30 m up: frames 15 ms at the median, 29 at the
  99th percentile, a few garbage collections over 50 ms. Entering free roam about 13.6 s (with the
  blocks round the lot).

**Free roam's additions of 2026-11-19, the second round** (the user's notes after playing the streamed city):
- **Work at Ferris** (`story/Work.js`, mixed onto `Roam`): a punch clock by the shop office's door in Hangar
  Two (`CLOCK`); as Hal between 9 and 5 E clocks in (or Carol, asked, `offerShift`), E again clocks out, and
  five o'clock or leaving the field (1.6 km) clocks him out; paid for the hours on it at **$62 an hour**
  (`PAY_HOUR`: Salary.com's US average for an experimental test pilot; the user guessed $250 and asked me to
  check). E by the prototype (on the apron south of it, `atPrototype`) clocks him in if he isn't and flies
  **a test card** (`testCard`); its prompt says why not outside the hours or in the suit, and the objective
  names where the work is. The card: Part Five's jet,
  cockpit and flight suit, the walk out cut (a fade to the seat at the runway's east end), the card off the
  ground, then 8,000 ft or 7 g held 2 s or both (random), then down on 27 and stopped; Carol on the radio
  (`towerJob*`); 25 XP. **Each step ticked is a checkpoint** (the user: "checkpoint every part of the
  flight"): a crash cuts through black to the jet as it was when the last step was ticked, flying, and the
  step's flown again (`snap`, `reset`); the landing restarts on final approach, his own once he's flown onto
  one (`finalCp`: lined up east of 27, low, gear down), else 4 km out on a three-degree path (`approach`).
  After three crashes in a step, "Again, from the checkpoint" or "Call it a day". After it he's on the
  apron south of the jet in his own clothes (`casualRig`; he was put under its wing, inside its colliders,
  and couldn't get out even as Green Lantern).
- **Home** (`blockRoam`): E at either of his building's two front doors (lot x ±13.6, the stoops) or on the
  lawn between them (the one spot there was stood in front of the middle wall, at neither door); out of the
  door he went in by (`homeDoor`). The bed is a choice (`sleep`: till morning, till evening, a two-hour nap;
  health full); the kitchenette's "Get ready for the day" in the morning (`getReady`: half an hour, health).
- **His phone** (`ui/Phone.js`; G on the ground, not driving or in the jet; `Roam.openPhone`): Coast's phone
  prop out into his left hand (`holdInHand` with `this.hal` set to the rig he's in), the DOM phone over the
  scene. Apps: What Up (threads: Carol, Tom, his mother, Jim, Jack, Sal, and Oa, where nothing's delivered;
  `live(phone)` lines from the game's state: the rent, the clock, the city's mood), Photos (rendered in the
  valley's own scene the first time it opens, one a frame inside the game's frame so the composer draws over
  it: `Phone.snap`, the set-ups in `story/Album.js`: Hal in the flight suit by the prototype, at the Blue
  Marlin with a beer, his Phoenix, the pier, Carol in the hangar, the jet; and Martin's photograph), Maps
  (the full map), Coast S&L (balance, the rent, the job, the ledger: `Life.record`), the Herald (the lead by
  the city's mood, what the emergencies came to: `Life.note`), Weather. Keys: arrows/WASD, E open, Q back,
  G put away.
- **The map** (`ui/CityMap.js`): a radar top left (the HUD's chapter and objective move right of it:
  `#hud.mapped`), turned with the camera, zoomed out with speed and height, the place's name under it; N or
  the phone's Maps for the whole map (north up; WASD or drag to pan, Q/E or the wheel to zoom, Enter or a
  click sets a waypoint as the HUD's marker, Backspace clears it). Drawn from the plan: blocks by district,
  parks, the channel and its bridges, the freeway, the beach and pier, Hal's blocks and building, the road
  south and the field; icons for the places from the people who work in them, home, the car, the city's
  emergency, the marker. The world's x is east with the view mirrored from a compass's, so the map is the
  ground turned half a turn (what's on Hal's left is on the map's left).
- **The rest of the city's people** (`roamer`s in `CityLife`): 26 of the walkers' models again, on the
  middle of every pavement of the grid (9.5 m off a north-south street's middle, 8.5 off an east-west one),
  over the crosswalks, on at each corner or round it (`roamTurn`), kept within about 115 m of the camera and
  put down at a corner nobody's looking at when it leaves them (`roamKeep`), half home by night; they talk,
  look up, run, see him change, as the block's people do (`remote`: drawn away from the block).
- **The rest of the city's traffic** (`Traffic` with `grid`: 16 more cars): routes generated across the
  grid near the camera (`gridRoute`: nine crossings on, straight mostly, turns by `curve`), keeping right
  2.2 m off a street's middle, stopping at each crossing's line on its own lights (`gridLight`: the cycle
  offset by the crossing), not on Hal's blocks' streets or under the freeway's west ramp; retired when far
  and unseen. The traffic's front wheels steer eased (they flickered).
- **Parks, the freeway, the channel** (`city/Plan.js`: `FREEWAY`, `CHANNEL`, `cell.park`; 56 parks by a
  hash, one big one of four blocks in the ring, none downtown or on the waterfront): a park's grass and
  paths are painted by the city ground's shader from a mask texture of the blocks (`cellMask`), its hedge,
  trees (`fx/Trees.js` broadleaf, instanced), benches, lamps, palms and fountain or pool built with its
  block (`Stream.park`), clear of the painted paths. The freeway (`city/Landmarks.js`, built once with the
  city): a deck 11.5 m up over the street at z 1070 on piers down its middle, a ramp off Ocean Avenue and
  one down to the desert road past the east edge, barriers, lanes, median lamps, three overhead signs. The
  channel: concrete banks 4 m down to a bed with water, railed, a deco bridge at every street (pylons with
  lamps); the ground shader opens it between the bridges, and the city has its own 10 m heightfield with
  the banks cut in (`Ferris.roadGround`, `Physics.fixedHeights`), the valley's coarse one dropped 10 m out
  of sight under it.

**Korugar's streets** (`story/KorugarLife.js`, `StreetLife(story, kor, { era, walkers, guards })`):
walkers on loops (`ROUTES`: the avenue, the market, the plaza at r 31), guards at posts; each a full
figure with a kinematic capsule (in `player.camIgnore`, so it doesn't pull the camera in). E beside
one: they stop, turn to Hal and say a line from their pool (`TALK[era][man|woman|guard]`, not the
last four heard); under Sinestro the ring then decodes what they mutter after. Reactions: under
Sinestro they back off from him with their eyes down; they look up at him flying low; a construct
cast near them (`powers.watchers`) sends everyone within 30 m running, then crouching. Part Five's
`patrol` adds one (`era: 'sinestro'`, 4 on the avenue, 3 in the market, two guards); free roam's
Korugar another (`era: 'after'`), with `posts` (people at a place of their own, each with their own
`lines` in turn and a `label`): **Korugar's places once it's freed** (2026-11-19). The **Broken Chain**
(`Korugar.buildTavern`, `TAVERN`), a tavern built where an old-quarter tower stood across the lane from
the courtyard (the tower skipped after its random numbers are drawn, so the city comes out the same):
plastered walls, its door open to the lane under a board of glyphs and a lamp, two lit windows; inside a
bar down the back wall with shelves of jars, stools, low tables with cushions, a hearth, lamps from the
beams, the Corps' emblem on green cloth; one light on near it. The keeper and two regulars; "Have
something" gives tea or stew. At the market, a fruit seller, a baker and a carver behind three stalls,
"Take something" at each. Nothing is paid for (`Roam.korugarRoam`'s `give`).

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
white lines. Leaves exported as blended (the palms' fronds) become cut-outs with alpha to coverage
(smoothed by the MSAA), so they keep their order instead of popping. `meshes(root, test)`, `boundsIn(space, list)`, `pivot(space, list, at)` (re-parent
parts under a hinge or hub) and `piece(name, test, { root })` (one part of a kit as its own object,
standing at its origin: `KIT` in `Ferris.js` names the street kit's parts; `root` centres it on what
touches the ground rather than its bounds, so a leaning palm or a signal's overhanging arm doesn't
push its base out) are the helpers; `hasProp(name)`
says whether one is loaded (scenes shared with Part One fall back to their built versions).

`Car.js` `makeCar(name, { paint, primer, dust })` dresses one of the cars: the paint material
recoloured with dust toward the sills, chrome roughened in the shader (most of it has roughness
maps), lamp lenses dimmed, wheels on pivots at their hubs (`userData.wheels`, spin with
`rotation.x`), the driver's door (front left, +X) on a hinge (`openDoor(k)`, 1.15 rad), and for the
driver (measured on the Phoenix: cushion 0.44, floor 0.27, roof 1.3, wheel centre 0.37/0.78/0.11,
its face tilted 31°): `seat` (the hip joints), `pedals` (the ankles), `rim(side, hour)` (wrist
targets on the steering wheel), `tail` (the trunk lid's back edge), `exhaust`, `axle` (`rear`, the
rear hub's z, and `base`, the wheelbase: Phoenix -1.22 and 2.77) and `front` (the front wheels,
steered about their upright).

Cars drive the way cars move (`Car.js`): `planDrive(car, { at, yaw, legs })` takes legs of
straights and arcs (`{ len, k }`, k the curvature, positive turning left) for the **rear axle**, the
body always along its heading, backing up when a leg's `dir` is -1 (a new leg for each change of
direction: the car stops between them); the path is smoothed over about 2 m so the steering winds
on and off, and each leg gets `pose(s)`. `timeLeg(leg, { limit, v0, v1, accel, brake })` is its
speed profile (`[s, speed]` limits, acceleration and braking caps) with `s(t)` and `time(s)`;
`rollCar(car, leg, s, last)` places the car, turns the wheels through the distance and steers the
front ones (`atan(base·k)`); `Coast.roll()` plays part of a leg. Plan a maneuver in the car's
rear-axle terms, worked back from where it must end, and check it against everything near it: the
car's footprint against parked cars' boxes and the low vertices of props, frame by frame.

### Vehicles (`src/vehicles/`, `src/ui/VehicleHud.js`)

- **`Drive.js`**: a car driven by the player, on Rapier's `DynamicRayCastVehicleController` (a
  dynamic chassis on four raycast wheels with springs and dampers, friction-slip tyres). Mass set
  (1450 kg, its centre low), rear-wheel drive, speed-sensitive steering, drag and rolling
  resistance, the handbrake letting the rear go. Brakes are forces times the step (about 0.87 g at
  30, 60 or 120 fps: 45 mph to a stop in 23 m; see Gotchas). The model follows the chassis; wheels ride their
  suspension and spin, the fronts steer, the steering wheel turns (`car.userData.steer`, the rim's
  points with it, so `driveHands` follows). Views (C): a chase camera that swings after the car (and
  the mouse, settling back behind), or first person from the head bone (`uHideBone` hides his head).
  Hooks into the physics step through `physics.beforeStep`. Keys W/S/A/D/Space; or a script sets
  `throttle`, `brake`, `steerIn`.
- **`Jet.js`**: the prototype flown. A rigid-body flight model (lift linear in alpha to a stall at
  22°, induced and transonic drag, thrust lapsing with density, the afterburner past 100%, side force
  from sideslip, weight), rotation from commanded rates (fly-by-wire: an alpha limiter and a 9 g
  limiter, authority falling with dynamic pressure), substeps of 1/120 s. Mouse aim (MouseFlight /
  War Thunder): the aim direction is level with the world; the autopilot rolls toward it and pulls,
  wings-level when it's close; with the gear down it steers the flight path (the nose rides high on
  approach). On the gear: rolling friction, brakes, nose-wheel steering, no sliding; touching down
  too hard (5.5 m/s), steep, banked or gear up, or off the runway, is a crash (`onCrash`). The
  control surfaces hinge (`hingeSurfaces`), afterburner cones (`buildFlames`), the cockpit darkened.
  Views (C): behind it along the aim, or the cockpit (`eye()`, the HUD; `CameraDirector.up` banks the
  camera with the jet).
- **`VehicleHud.js`**: the car's dash; the jet's panel (chase view), its HUD drawn on a canvas in
  the cockpit (heading tape, pitch ladder, flight-path marker, airspeed and altitude, Mach, g, climb,
  throttle), the aim circle and nose cross; the test card; `gloc(k)` greying the view.

### The world's props (`src/props/Smash.js`)

`new Smash(physics, scene)` per scene (the site, Ferris, Oa, Ysmault); `smash.update(dt, t, camera,
renderer)` from the scene's update; `RingPowers.attach` sets `smash.fx` to itself (effects, sounds,
hazards, damage go through it; null while the ring is off). Every prop is one of:

- **solid** (`smash.solid(object, { mesh })`): fixed; with `mesh: true` its own triangles
  (`fixedTrimesh`, for buildings, the spoil heap, rocks, palms: a box is wrong for anything not a
  box), else a box from its bounds. Struck, it sheds chips and dust and sounds by its `stuff`.
- **loose** (`smash.add(object, { mass, give, stuff })`): a dynamic body at the object's pose with a
  cuboid fitted to its bounds in its own frame (`localBox`, `box` to override, `shrink`), its real
  mass (kg); in `physics.dynamics` with its `radius` and `item`. `give` is how far past the ring's
  usual impulse cap a blow shoves it (heavy things: 3–8).
- **breaks** (`kind: 'breaks', strong`): fixed until blows total `strong` (a hook is about 25, a
  gatling round 2.5, a sword cut 6); then `breakOff` makes it dynamic and calls `onBreak` (the site's
  lamps put their light out and topple; the hydrants start a `geyser`; the Ferris cockpit stand, up
  against the jet, comes loose).
- **car** (`kind: 'car'`): loose, 100 health (a hook takes about 18): `dent` pushes the parts'
  vertices in round the blow, mostly into the body (each part gets its own geometry, positions copied
  into a plain array: see Gotchas), at most 0.28 m from rest, normals recomputed; panes within reach
  `shatter` (hidden, glass bits, a sound); the first hit sets off the alarm and hazard lights (12 s);
  below 55 it smokes, below 22 it burns (`ignite`: a `Fire` without its point light, a fire loop, a
  hazard) and after 5.5 s (1.2 s at 0) it `explode`s: thrown up and over, every pane gone, charred
  (`char`), a fireball and smoke, `physics.burst` (which blows the props round it too), 36 damage to
  Hal and 60 ('explosion', half through any guard) to a boss within 7.5 m, then burns out over 14 s.
- Blows reach props two ways: the ring (`RingPowers.shove(body, dir, at, k, power, cap, kind)` calls
  `smash.blow(item, k * power, at, dir, kind)` first: the hook, hammer, sword, gatling, impacts,
  bursts) and collisions (`Physics.step` runs an `EventQueue`; colliders of loose, breaking and car
  props carry contact-force events, threshold 25 × their mass, 4000 N for fixed ones; `onForce` →
  `bump`: strength from the change of speed it took, ×0.6 against the ground, at the solver's contact
  point). So a thrown beam (about 140 kg now) dents a car and tears a fence panel off, a flung car
  snaps a lamp post, Atrocitus walking or charging into a car shoves and dents it.
- Physics `burst` pushes as for at most 400 kg (heavy things move less) and then `smash.blast`.
- The hook stops against anything fixed along its path (`HookStrike.hitWall`: a level ray from the
  fist's last position to its knuckles, kept 0.3 m above the ground so the floor doesn't count).
- Atrocitus charges through breakables (they break) and walks round props wherever they've been
  knocked (`blocks` entries with a `body`); Sinestro's spikes and Atrocitus's blood mark what they hit.

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

- His suit has a roughness floor of 0.58 (`createSinestro`): the scan's suit is metal and
  mirror-smooth, and the environment map's bright patch in it bloomed into a green ball on his chest
  in close shots. His ring's point light is at 0 outside a fight (it is kept in the scene: toggling a
  light recompiles every material).
- **Out of the fight** he stands (mocap idle) with his hands clasped behind his back (his own
  `BodyLanguage` library, `GESTURES` / `STANCES` in his metres), talks with the ring hand, and
  plays the sword lesson (`demo()`).
- **In the fight** (`engage()`) he flies: a dynamic capsule with gravity off, steered by a damped
  spring (like the drones), so fists shove him and he recovers. He faces Hal, circles at about
  6.5 m, matches Hal's height when Hal flies, leans into his flight, keeps his left hand behind his
  back, and is a construct target (`tg`, 520 health).
- **Moves** (`think()` / `runAction()`): a **lunge** (`LUNGE`: the blade raised and flaring for
  0.55 s, a dash, a cut, 22; sometimes a quick second cut; 0.53–0.63 s from the dash's start to the
  blade landing); a **volley** of five light spikes formed behind him and fired with lead (8 each;
  shield and walls stop them); a **guard** (a hex shield in front of his fist); and below 62% a
  **slam** (a ring marks the spot under Hal, then a giant fist comes down on it, 22; dodge it).
  Cooldowns between attacks are short (0.7–1.6 s), halved while Hal's charge is under 15%. His
  answers (`armour: true`) hit 1.3× as hard.
- **Reading Hal** (`think`, `hit(amount, point, dir, kind)`, `onCast`; he is in `powers.watchers`
  while sparring). The fight is block, then strike. `stance()` says how a blow lands now, and
  `LANDS` how much of it: `exposed` 1.35× (a parry threw him open), `reeling` 1× (a stagger), `open`
  0.6× (his volley, his slam, the moment after a cut), `turned` 0.15× (between attacks, behind his
  raised blade (the lunge's tell, dash and cut), through an answer), `miss` (slipping it). The
  bracket shows it (`tg.openState()`: amber open, gold OPEN when exposed).
  - **Turned:** a hook, cut or hammer is turned on his guard (`block`, the "Turned" callout) and
    answered at once (`answer`): in a lunge's tell he comes straight on, else a quick armoured lunge
    (or a volley from beyond lunge range, `riposte`), at most once in 1.2 s. The gatling is stopped
    outright: he guards the moment the barrels spin up aimed at him (`threat`), a round that catches
    him idle raises it too, and held on him 0.75 s it's answered (`counter`). Gun damage is a further
    0.5× wherever it lands.
  - **Hal's shield** (`RingPowers.guardHit`): blocking his cut glances it off (0.6 s stagger, a push
    back); a **parry** (the shield raised in the 0.5 s before the blade lands) throws him open
    (`expose`: 1.5 s `exposed`, knocked back, the blade gone). A sword cut meeting his cut is a parry
    too (`clash`). Parried spikes fly back into him (`s.back`, homing; 10 each, the first exposes him
    for 1.5 s, `spiked`).
  - **Poise:** 70 damage inside one of his attacks while it's `open` (`POISE`) breaks him out of it
    into a 0.6 s stagger, at most once in 2.1 s (`steady`).
  - **Hooks thrown at him** between attacks he may slip (`onCast`, `dodge`: away and up, then often
    a quick lunge), likelier the more Hal has thrown (30% plus 20% per hook in 5 s, at most 85%; 75%
    for the hammer).
  - **A held shield:** past 0.8 s he circles fast round to its side to attack, or drops the slam on
    it. A held shield only blocks; mashing the guard doesn't parry (`PARRY_REST`).
  - Bot numbers (2026-11-11, `tools/fight-bots.js`): hook spam 71–128 dealt in 15 s, 96–108 taken; gun spam
    23 dealt, 88 taken; parrying every blow 511 in 20 s, 4 taken; blocking early 165, 72 taken;
    the shield held throughout 20, 36 taken. He yields after 338.
- At 35% he yields (`onYield`); `onQuip` ('parried', 'riposte', 'counter', 'dodge',
  'flank', 'slam', 'hurt') and `onHurtHal` drive his lines (`Corps.addSinestro`).

### Qward's Thunderers (`src/enemies/Thunderers.js`)

`new Thunderers({ scene, physics, powers, player, audio, director, mocap, ground, centre, radius,
blocks })`, `loadThunderers()` (the four GLBs, once), `spawn(kind, at)`, `alive`, `update(dt)`,
`clear()`; `Exile.thunderWave(T, spawns, label)` runs a wave. Each is a kinematic capsule in the
scene's dynamics and a construct target; they step out of a violet burst (the dissolve run backward)
and come apart in it when killed. At most two attack at once (`TOKENS`, as the drones). The kinds
(`KINDS`):

- **brute** (170): walks at Hal on the mocap; the flail up over his shoulder (0.75 s, arm IK), whirled
  flat round his fist, then down a pace ahead of him (18, a knock back). A parry staggers and exposes
  him. The flail's chain and ball (the hand bone's vertices below his fist, `FLAIL`) swing as a
  pendulum (`flail`, `swingFlail`: a point mass on the chain's length, verlet, gravity, the tell's
  whirl as a tangential push, the strike flinging it down at where Hal stood), turned in the vertex
  shader (`FLAIL_GLSL`, `uSwing`: the world rotation taken into the bind frame, S⁻¹·R·S).
- **caster** (110): keeps 11 m off, side-stepping round him; a bolt forms in her raised hand (0.6 s)
  and flies with lead (11). Parried, it homes back into her (3×).
- **archer** (90): crouched where he's placed, on his scan's stance (no animator: the bind pose each
  frame, `aimBow`). Low and ready, turned to Hal; the tell (1.05 s): side-on to him (yaw + 1.15), the
  bow comes up to the vertical and points at Hal's chest, both hands moving as one rigid piece from the
  scan's frame (the arrow from the string hand to the grip, the limbs tip to tip) to the aim's, the
  arms by two-bone IK and the hands given the turn; a nocked arrow, its head glinting; the loose (the
  string hand off it, the string snapping back); 10. His scan's bow was a sheet (the space between bow
  and string filled in, see Gotchas): cut out in the shader (`aBowCut`, `bowCut()`: the hand-bound
  bow past his fist, the string's end on the other hand, the rest by the bow's own texture cells in its
  band of height) and replaced by a built recurve (`makeBow`: iron limbs, gold grip and tips, a
  two-segment string to his string hand). His bow hand's wrist depth is given in the rig (`arms` z).
- **winged** (120): hovers and circles 11 m out and 6 m up; a shriek and a rise (0.7 s), then a dive
  through Hal (14); a parry knocks him back and open. Its own animator (`wings`, `WINGED` poses: hover
  with talons ready, shriek with arms flung wide, dive with arms swept back, strike with hands and feet
  out, blended by weights) and wings that beat and fold (`beat`, `WING_GLSL`: chest-bound vertices
  behind the back and out from the torso turned about each wing's root, `uFlap` about the forward axis
  and `uFold` about the vertical, the bend spread out from the root; a downstroke whoosh close by).

Hit, they reel (a hook interrupts a tell; a gun round seldom does); `openState()` drives the bracket.

### Hector Hammond (`src/enemies/Hammond.js`)

- On foot; turns to face Hal. A shell of force (a dynamic ball pinned in place, `lockTranslations`,
  so constructs register hits without shoving him; an additive fresnel sphere that ripples) takes
  the ring's hits; its strength is the boss bar, and at `YIELD` (45%) it cracks (`onBreak`).
- **Throws:** a hand to his temple, 1–3 slabs torn out of the runway (a dirt-dark hole left behind)
  rise and hang shaking for 1.15 s (the telegraph), then fly as physics bodies on a ballistic path
  with lead. 14 damage; the shield blocks them (physically, too). Every third throw is at Carol
  (slower, `onAimCarol` lets the story mark her and the ring warn); one reaching her is
  `onCarolHit` (the checkpoint restarts). The oldest of more than 14 bodies are removed.
- **Waves:** both hands to his head, then a sphere rolls out to 24 m; it hurts Hal on the way
  through (unblockable; get out of reach) and pulses the dream's warp (`uDream`). Each wave swells
  his skull a little (`rig.hu.uSwell`, capped 0.72).

### Atrocitus (`src/enemies/Atrocitus.js`)

- On foot and heavy: a kinematic capsule moved by his own code (`vel`), so constructs hit him but
  don't shove him (it's in `physics.dynamics` with a dummy mesh, where impacts look for targets); mocap `Locomotion` from his speed, facing Hal in the fight (out of it, the way he
  walks, or `faceYaw`); round the scene's `blocks` (steering round the ones ahead, `avoid`), inside
  `radius` of `center`; his gait follows how far he really moved, so he never walks on the spot
  (backwards when he steps back). 900 health (the fight ends at 60%); hits while a charge stopped by
  a wall has him reeling count 1.25×.
- **Charge:** head down, a red line along the ground (0.85 s; it follows Hal's lead for the first
  0.5 s, then sets), then a straight rush at 11 m/s. A wall or anything fixed in his way stops him
  dead and stuns him (1.8 s, 1.2 s for a column). Hal's shield stops him too (`crash`): held, a
  0.7 s stagger and Hal shoved back; raised just as he hits, a parry and he's wide open (`expose`,
  1.8 s, a step back, arms flung wide, leaning back). Through Hal: 26 (34 as an answer) and a knock
  back (`player.dash`).
- **Beam:** to the nearest point along a loose beam (`loose`, `alongBeam`, to arm's length: he's
  kinematic and would shove it away; one against a block he skips, one he can't reach in 3.5 s he
  leaves for 8 s), lifted overhead and held shaking (the tell), thrown with lead; 20 where it hits;
  it lies where it falls, to be thrown again. The shield stops it; a parry bats it back at him
  (`batBack`, `b.back`): 30, and he's open 1.5 s (`backAtHim`).
- **Blood:** his palm lit and dripping (0.75 s), then a fan of seven burning drops (6 each); each
  lands as a fire on the ground for 4.5 s (a `powers.hazards` entry, 9/s). The shield stops them;
  parried, they home back into him (6 each, the first opens him 1.2 s).
- **Slam** (Hal within 4 m, near the ground): fists up, then into the ground; a shockwave ring
  rolls out to 9.5 m (20, less with distance), which only flight gets over.
- **Reading Hal** (`think`, `hit(amount, point, dir, kind)`). Block, then strike, as with Sinestro:
  `stance()` and `LANDS`: `exposed` 1.35×, `reeling` 1× (stunned or rocked), `side` 1× (turned on
  Sinestro), `open` 0.6× (a beam lifted, held, thrown; his blood; the slam but its blow; a charge's
  skid; or Hal behind him), `turned` 0.15× (between attacks, fetching a beam, the charge's tell and
  rush, the slam's blow, his cover, an answer). `tg.openState()` drives the bracket.
  - **Turned:** a hook rings off his gauntlets (`deflect(point, true)`, a clank, "Turned") and he
    answers at once (`answer` → `brace`: a roar, then an armoured quick slam close in, a charge if
    the line is clear, else his blood), at most once in 1.4 s. The gatling: he covers (`cover`:
    forearms crossed before his face, walking on at 1.35 m/s) the moment the barrels spin up at him,
    rounds ring off, and held on him for a second (0.3 s close in) it's answered. Where the gun gets
    through it's a further 0.4×.
  - **Poise:** 90 damage inside one attack while it's `open` (`POISE`) rocks him out of it (0.7 s);
    a beam held overhead comes down on him (1.6 s, 20 more).
  - **A held shield** past 1.2 s (`shielded`): he won't charge into it; he walks in under it and
    slams.
  - Bot numbers (2026-11-11, `tools/fight-bots.js`, Sinestro held off): hook spam 36 dealt in 15 s, 61
    taken; gun spam 6, 78 taken; parrying 366 in 25 s (three parries), 14 taken; blocking early 50
    (168 also hitting him mid-attack, the charge ran out); the shield held throughout 0, 37 taken.
  - **Sinestro's spikes** (`kind 'spike'`, 0.35×) turn him on Sinestro for 1.6 s (`distract`,
    facing where they came from): his side is open to Hal; enough of Hal's fire turns him back.
  - **Hal at his lantern** (not in control): he attacks at once, a charge if the line is clear.
- `engage()` / `disengage()`, `onQuip` ('charge', 'stunned' (a wall, a parry), 'hurt', 'solid',
  'cover', 'answer', 'rocked', 'brace', 'distract'), `onHurtHal`. `Prisoner.atroFight` maps them to lines
  (Sinestro's hints `sinQGun`, `sinQFlank`) and shows a tutorial panel of his openings.
- **His machine:** he works it from `WORK` in `Prisoner.js` (1.75 m out on its fifth spike's line,
  facing it, his hands on the spike, `SPIKE(y)`); the machine's block (`Site.deviceBlock`, 1.2) is
  shrunk to 0.95 while he's scripted there, or the push-out kept him 2.55 m away and he walked into
  it on the spot until the walk timed out (the user: "he keeps walking to his orb").

**The Yellow Lantern** (Part Six): `turnYellow()` turns his shield, fist, blade, spikes, mark, ring
light and sparks to fear's yellow (`FEAR`, `fearLight(group)` in `Constructs.js`) and builds the
**fear jet**: the F-104 prop as a construct (`shapeOf(prop('f104'), 14)`). `fearJet` (in phase two
30% of choices, else 12%, never twice in 9 s): it forms 36 m out beyond him and 16 m up (1.3 s, where
the camera, on him, can see it, the line it will fly marked on the ground under Hal, its engine heard),
then dives through Hal's spot at 70 m/s (30 and a knock back; the shield blocks it to 6; a parry breaks
it and exposes him) and into the ground. Constructor options `health`, `yieldAt`, `centre` (the arena's
middle); `Prisoner.addSinestroAt(scene, blocks, opts)` passes them.

**Sinestro beside Hal** (`Sinestro.ally(foe)`, Part Four): he flies high and wide round the foe
(`{ position, vel, collider, hit }`) and fires a volley at him every 3–5.5 s; `aimAt(out)` is what he
faces and fires at; the spikes pass through Hal and his shield.

### Ring powers (`src/powers/`, `src/ui/PowerHud.js`)

`Story` owns one `RingPowers` (`this.powers`) and one `PowerHud` (`this.hud`). `powers.attach()`
binds them to a scene (the crash site); `powers.update(dt, real)` runs right after the player.

- **State:** `charge` (0–100), `health`, `unlocked` (Set), `enabled = { hud, constructs, flight }`,
  `suited` (the uniform's aura takes 45% off damage), `hazards` (fire zones with a dps), `regen`
  (charge %/s near a power source; 1.5 on Oa).
- **Targets:** `addTarget` / `removeTarget` / `targetOf(body)`. Anything with `{ body, collider,
  position, radius, health, maxHealth, alive, hit() }` can be damaged by constructs:
  `dealDamage(target, amount, point, dir, kind)` hits it, plays a tick and pops a damage number;
  `kind` is what landed ('hook', 'gatling', 'sword', 'hammer', 'blast', 'spike'), passed on as
  `tg.hit(amount, point, dir, kind)`, and opponents treat each differently. `cast(id, data)` tells
  `powers.watchers` (the bosses) what Hal just cast (a hook's side, radius, target).
- **The guard** (`updateGuard`): right click or `F` held raises the shield (`raiseShield(true)`,
  `shield.quick`) whatever is armed, or nothing; a held gatling or sword goes away; let go, it drops
  (`release(true)`, 0.05 s cooldown). A left click behind it drops it and strikes in the same frame
  (`updateCast`), and `guardLatch` keeps it down until the button comes up.
- **Parry** (`guardHit(from, at)`, `PARRY`, `PARRY_REST`, `HeldShield.fresh()`): an opponent's blow
  meeting the shield returns 'parry' if the shield went up less than 0.5 s before (and the raise
  before it was more than 0.8 s earlier: mashing doesn't parry), else 'block', or null if the shield
  isn't in its way. A parry stops time 0.16 s, shakes, flashes (`parryFlash`, the grade faded out in
  `update`), rings (`audio.parry`), gives back 4% charge and says "Parry"; for 0.6 s after one the
  shield parries everything (a whole volley). The bosses call it for their melee and projectiles;
  `damage(amount, from)` (drones, Hector) still only blocks.
- **Callouts and the bracket:** `hud.callout(text, kind)` pops a word over the reticle ('parry',
  'block', 'turned', 'counter'); a target's `openState()` ('open' / 'exposed') colours the bracket
  (`#target.open`, `#target.exposed` with OPEN under it).
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
- **Constructs** (`HookStrike`, `HeldShield`, `WallConstruct` in `RingPowers.js`):
  - Fist (`HookStrike`, `hookFrame`, `throwHook`): a hook. A giant fist (`fistGeometry`, the left one
    `mirrorX` of it) forms off to Hal's side and swings round him in a level arc through the aim
    point (radius the aim's distance, 3–11 m, at the aim's height; 0.11 s forming, 0.24 s swinging),
    the ring's beam its arm, knuckles leading. Everything in the swept arc, from his side out past
    the fist, is hit once: targets take 42 (the right) or 56 (the left) as 'hook', loose bodies are
    knocked along; the first target hit gets hit-stop, shake, a flash and a ring. A click during
    the right hook (it's buffered, `hook.queued`) throws the left within 1.1 s; then it's the right
    again. 13% charge each; cooldown 0.3 s after a right, 0.8 s after a left. Hal throws it: the
    hand on keys in his frame (`HOOK_HAND`, cocked by the shoulder, elbow out and up, whipped across)
    and the chest turning into it (`HOOK_CHEST`, `animator.lean.yaw`); the newest hook owns the arm
    (`powers.hooks`). The aim ghost is the next hook at mid-swing, with its arc drawn as a line.
  - The hook, the gatling, the sword and the hammer strike the scene's props through `shove` (see
    *The world's props*), and the hook stops dead against anything fixed (`hitWall`).
  - Shield: held while the button is down (armed), or as the guard; in front of Hal's fist; a
    kinematic body, so debris bounces off it; `blocks(point)` stops damage from the front. 2% + 3%/s.
  - Wall: rises out of the ground as a kinematic body (it lifts what it comes up under), stands
    20 s, at most three. The player collides with it. 10%.
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
  - Bubble (`BubbleTrap`, `bubbleGeometry`, free roam's; the user, 2026-11-19: "a bubble trap... any
    entity... a shield for them... they cannot escape"): a thin hex sphere round whoever or whatever is
    nearest the line of aim (`powers.trappable`, the story's: `story/Trap.js`, people and Smash's cars;
    its rays don't stop on people, so it's the line, not the ray's end), 10%, up to four at once.
    What's in it is held (people stop where they are with their hands up, `p.trapped`; a driven car
    stops in its lane, `c.trapped`; a loose one goes kinematic) and shielded (`item.shielded`: Smash's
    `blow`, `bump` and `blast` pass it by; `Emergencies.hit` too). A criminal in an emergency is as good
    as down (`Emergencies.down(p, { kneel: false })`: the police are called) and the bubble lets him go
    as the officers reach him (`a.cops`), who cuff him; anyone else after 15 s. Its kinematic ball is
    made once Hal's outside it. Unlocked on entering free roam (a toast says so).
  - Hammer (`HammerStrike`, `hammerGeometry`, Part Four): forms raised over the aim point and comes
    down about its pommel in 0.2 s, across Hal's view (its pommel to the right of the point, so from
    behind him it's a mallet seen side-on), landing square: 110 damage, a 3.6 m splash, a hard shove
    (`impact({ damage, splash, power })`), a ground ring and dust. 12%, 4.5–16 m; `hammerScale` grows
    it with the distance. No sweep on the way down (see Gotchas).
  - Staff (Part Five, from Sinestro on Korugar): `SwordConstruct` with `kind: 'staff'`
    (`staffGeometry`, 2.3 m held a third of the way up, `STAFF_SWINGS`: two wide sweeps and a stroke
    down, both hands on it, the left sliding along the shaft); 18 / 18 / 30 damage, a much bigger
    shove (`push`): crowd control, not cutting. 3% to form, 0.7% a sweep.
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
- **Health:** fire zones and the training's core breach do damage; it regenerates after
  `healDelay` (4 s) at `healRate` (8/s). The boss fights set 7 s and 3/s while they last.
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
- **`Rift.js`:** the tear in the air: `new Rift(radius, { palette })`, 'pocket' (the ring's green, the
  lantern's pocket dimension) or 'antimatter' (violet-black, pale arms, round stars, a thinner rim:
  the way into Qward); `Story.openRift(scene, at, radius, flow, opts)`.
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

**Sheets of separate figures** (the Thunderers): `figure: z` keeps the connected mesh whose bounds'
centre is nearest that z on the sheet (`pickFigure`: four figures whose wings and bow overlap in z, so
a cut by z can't split them); `headTop` (the sheet's own units) scales a figure to the top of its head
rather than its wings. `GRID=dir` renders a figure front and side with a 10 cm grid instead of rigging it
(measure joints on it); `DUMP=file` writes its vertices. The rig's `arms` gives the arm joints outright
in metres (for figures posed off any A- or T-pose: the archer), z found in the limb's column; `bind`
boxes (metres) take what's inside out of every landmark and weight it wholly to one bone (the winged
one's wings to the chest, the flail and the bow to the hand that holds them, the quiver to the chest).

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
  - `smoothArms` low-passes the arm bones per rig (a time constant of about 0.1 s at idle, light in
    the walk and run): the idle clip's arm keys carry a tremor, a few millimetres at the hand frame to
    frame, repeating with the clip (the user's "her hand is still shaky", on Katma).
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

Scripted movement uses `walkTo(target, speed)` (with stuck detection; it drops Hal out of flight
first, since the walk only runs on the ground), `turnTo(yaw)` and `lookAt(target, weight)`.
`Story.touchDown()` puts a flying Hal on his feet (constructs away, the drop, the landing waited
out) before a scene that needs him standing.

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
- **The Weaponers of Qward** (`createGuardian(abin, mocap, { weaponer: true, seed })`, Part Six; no
  scan of theirs: derived the way the Guardians are, as their mirror in the antimatter universe): grey
  skin, bald (`uHairOn` 0, no hair cards), dark brows rising at the ends, gold eyes, a taller narrower
  dome (head 1.22×), black robes trimmed gold with no emblem and a dark sheen (the warm one went orange
  in the forge's light), full height (1.02). Not reviewed by the user.
- **Sinestro as the Yellow Lantern** (`yellowLantern(rig, k)`, `su.uYellow`): in his shader layer, the
  uniform's green turned gold and the rest a deeper black, swept up him from his feet as k goes 0 to 1
  with a burning line at the edge (`sYEdge`); the suit's glow and emissive go gold with it. The chest
  emblem is still the Corps' shape, in gold.
- `createHammond(gltf)` (the user's scan, 2026-11-11): `rig.hu.uSwell` (0..1) swells his **whole
  head**, face, jaw and glasses included, as in the comics (the user, after a first pass that grew
  only the cranium: "his entire face enlarges"): everything above the neck scales about the neck's
  base (`HAMMOND_HEAD`, up to 2×), the neck stays thin and the coat's collar is left alone. On top
  of that the skull above the brow inflates into a smooth ellipsoid dome; everything inside it is
  pushed out onto it (never in), so the hair's lumps smooth over, and the normals follow in
  `beginnormal_vertex`. The hair recedes from the front as it grows, the bald scalp takes the
  forehead's colour sampled from the scan's own texture (`uForehead`, the UV of the vertex at the
  brow's top), veins show and darken with `uThrob`. Set it with `rig.setSwell(v)` (it moves the jaw's
  hinge with the head); `rig.face(out)` is where his eyes are now and `rig.headWidth()` his head's
  half-width (the head bone doesn't move with the vertices: aim cameras, looks and hands-to-temples
  with these). Part Three runs it from 0.12 (the lake) through 0.38 to about 0.68. Approved by the
  user on the second pass ("looks right").
- `createAtrocitus(gltf)` (the user's scan, 2026-11-11): the scan as it is, its lit red eyes glowing
  a little (the saturated red texels). Rig overrides in `build-assets.mjs`: Kilowog's neck settings
  (his head sits low between the shoulders) and an arm band fitted under the pauldrons (`armMaxY`)
  with the elbow and wrist further out along the arm (`elbowK`, `wristK`; short forearms, fingers
  curled under), all three new `autorig.mjs` options whose defaults leave the other models unchanged.
- **Coast City's people** (`characters/People.js`, `tools/build-people.mjs`, 2026-11-18): Microsoft's
  Rocketbox avatars (MIT; the GLB copy on Hugging Face, `codepawl/rocketbox-avatars-glb`; raw files in
  `assets/people/`, 28 of them in `PEOPLE`). `build-people` moves each onto **our skeleton**: the Biped is
  skinned into its bind pose (the figure in centimetres under a turned root), faced +Z and set on the
  ground, and its 80 joints' weights folded onto ours (Spine1 to spine, clavicles to chest, toes to the
  foot, the face's bones to the head) with **translation-only bones** like autorig's, so the mocap, the
  poses and the IK drive them as the scans; kept beyond our 17: fifteen finger joints a hand
  (`thumb1_L` .. `pinky3_R`) and the eyes (`eye_L`, `eye_R`). Of 175 blendshapes, seven: `jawOpen`,
  `blinkL/R`, `smileL/R`, `pucker`, `browUp`. Textures: the staff's (Rosie, Dot, Ray) at 1024, passers-by
  a 768 face and a 512 body (about 6 MB of GPU memory each). `people.json` lists heights. At runtime
  `loadPeople(ids)` (once each), `createPerson(gltf, { grip, seed })` → `{ rig, update(dt), setGrip(side,
  name), lookEyes(target), smile, setShape }`: blinks every 2–6 s, the jaw shape from `rig.u.uJaw` (set by
  `Story.updateMouths` from the voice; the shader jaw is off for them), the eyes turned to a target
  (capped), the fingers curled about axes found from the rest pose (`GRIPS`: relaxed, hold, fist, open;
  the thumb folds toward the middle finger). Their hair and lashes are cut-outs with alpha to coverage.
  `tools/people-test.js` (`stand`, `faces`, `hands`, `enterCoast`, `counter`) is the page helper.
- **Hal's flight suit** (`characters/FlightSuit.js`, `createPilot(casual)`, Part Five; designed by
  me at the user's request): a skinned coverall made from the casual scan's own body below the neck
  (not the hands or head), Taubin-smoothed until the T-shirt's hems and jeans' creases are gone,
  pushed out by a thickness field (loose sleeves and legs, close cuffs and collar, the anti-g layer
  thicker), never less than 5 mm off the skin, bound to the same skeleton and weights; the scan
  under it is discarded in its shader (`coverBase`, `vCover` from the skin weights), and the cuffs and
  collar are cut clean in the shader. Painted in bind space: sage CWU-27/P with yoke and side seams,
  a zip, slanted zip pockets, a name tag (HAL JORDAN, Ferris Aircraft, test pilot), Ferris wings, the
  flag and the Ferris roundel on the shoulders (`patchAtlas`, a canvas), the anti-g trousers over
  belly, thighs and calves, open at the knees, a parachute harness with Koch fittings and a chest
  buckle, black laced boots, creases at the joints. The helmet (`rig.helmet`, `wearHelmet(on)`,
  `helmetVisor(k)`): a dome on the head bone, ear cups, a gold visor; the hair under it is discarded.
- **Held hands** (`Exile.steadyHand(person, side, offset, { dur, pole })`): a hand raised along an eased
  path to a spot in the person's own frame (from the rest shoulder), then held still; tied to the
  root, not the swaying shoulder bone, and short of a straight arm. Katma's ring moments use it: the
  ring choosing her (she turns first, then holds her hand out; the ring flies to her finger, not her
  wrist; then she brings it in to look at it), her oath, her first shield.
- `createKatma(gltf, { uniform, citizen, seed })` (the user's scan): `uniform: false` (Part Five)
  recolours the Lantern uniform's green to oxblood leather and paints out and flattens the emblem
  (`KATMA_EMBLEM_Y`); `citizen` makes Korugar's women from her (the regime's grey, other skin and
  hair). `JAW.katma` (estimated from her profile; `MOUTH_GAIN` 0.32 keeps it small: wide open it shows
  a grey smear).
- `createKorugarian(abinGltf, { seed, guard })`: Sinestro's layer on Abin Sur's scan with a seed
  (skin from rose to crimson, the hairline or bald, face width, no glow in the eyes, a moustache on
  one in four) and the uniform recoloured by luminance to the regime's grey, matte (`KOR_GARB`); guards
  black with bronze.
- `createLightFigure(gltf)`: a scan drawn as the ring's light (Martin at the grave): translucent
  green, fresnel rim, a trace of the scan's shading so the face reads, the dissolve sweep as its
  formation, and a depth-only skinned twin (same geometry and skeleton, patched the same way) so
  only the nearest surface is coloured.
- **The scan's ring** (`withoutScanRing` in `Characters.js`): Abin Sur's scan has his ring sculpted
  as a lumpy band across three fingers of the right hand. Sinestro (and so Korugar's people and his
  statue) gets a copy of the geometry with every non-skin vertex of the fingers folded onto the
  nearest skin vertex (its normal and UV too) and flagged `aRingless`, which his shader paints the
  hands' pink; worked out once per scan and shared. Abin Sur keeps his.
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
  Carol 1.498, Kilowog 2.122, Atrocitus 1.945. `Story.updateMouths` drives the speaker's `uJaw` from the voice's
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
| hammond | am_adam | 108 Hz | presence, a little room: soft-spoken, precise |
| atrocitus | bm_george + am_onyx | 72 Hz | formants down, an octave-down layer, growl, saturation, a room: huge, rasping |
| weaponer | bm_lewis + am_onyx | 82 Hz | formants down, an octave layer, a faint growl, a 2.2 s hall |
| pilot (radio, `phone` band), tech, tech2 | am_onyx, am_liam, am_fenrir | | Part Three's afternoon and the lake |
| light, dad, kid, tom, landlord | blends and others | | see the script |

`style: 'phone'` lines (the voicemails) also get a telephone band. Loudness is levelled (speech
RMS -19 dBFS, peaks under -1 dBFS). All 585 voiced lines are 12.4 MB of MP3.

- `npm run voices` renders only what changed (text, voice settings or the pipeline, by hash in
  `build.json`); `ONLY=key1,key2`, `WHO=carol,tom`, `FORCE=1`, `SURVEY=1` (median F0 of every
  English Kokoro voice). The model downloads once to `~/.cache/lantern-voices` (`HF_CACHE`).
  **Add a line to `lines.js`, then run it**: a line without a clip falls back to the browser's
  voice, and a changed text misses its clip (the key is `who|text`).
- `public/voices/manifest.json`: `{ version: 1, lines: { key: { who, text, file, dur, end, words:
  [[charIndex, s]...], mouth } } }`; `end` is where the speech stops and a reverb tail begins,
  `mouth` a base64 openness curve (60 frames/s) taken from the speech's envelope.
- `Voice.murmur(text, who, { gain })`: a clip on a channel of its own (never cancels the dialogue or is
  cancelled by it), `{ done, stop(), mouth(), gain(v) }`; null when there's no clip or the voices are
  off (the caller times it).
- `style: 'whisper'` lines (`build-voices.mjs` `whisperize`) are made breath: LPC (order 18) per 20 ms
  frame, white noise through each frame's envelope at its loudness, 18% of the voiced sound under it, a
  high-pass, 7 dB down.
- `Voice.speak(text, who, onWord)` plays the clip through `audio.master` (so the pause muffle and
  volume apply), fires `onWord` on the word timings, sets `voice.mouth` / `voice.who` for the lip
  sync, and resolves at `end` (the tail rings on under the next line). Skipping fades it out.
  `pause()` / `resume()` suspend the audio context.
- `tools/voices.html` on the dev server is the audition page: every line by character, with the
  words lighting up on their timings and the mouth curve drawn.

## Testing in the browser (for agents)

The checks that have worked:

0. **Test silently** when the user asks (they did on 2026-11-12, asleep): `localStorage.gl_mute = '1'`
   routes the whole mix into a zero gain (`AudioBank.init`), and voices off in the save avoids the
   browser's speech fallback.
   Set `localStorage.gl_res = '1.5'` too for captures to compare: the resolution otherwise adapts to
   the frame rate, and a throttled test tab steps it down.
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
   - **Boss fights:** `tools/fight-bots.js` (`setupDuel()` from `#duel`, `setupSite()` from `#site`,
     then `run(secs, mode, opts)`: 'hookSpam', 'gunSpam', 'blocker' (`late: true` parries, else it
     blocks early; `greedy` also hits mid-attack), 'turtle'). It keeps Hal alive and reports damage
     dealt by stance, damage taken by attack, parries and blocks. The guard is `KeyF` events.
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

- **Entering a place clears the ring's targets and the HUD's marker** (`powers.attach` → `detach`;
  `enterPlace` sets `markerTarget` null). An emergency already going when Hal travelled into Coast City
  lost both: no marker to follow, and the constructs went through the mugger (the user's report).
  `Emergencies.rebind()` from `ferrisRoam` puts them back. Anything that registers targets once has to
  re-register after a place is entered.
- **A hook that forwards arguments must forward all of them.** `powers.trappable = (body, point) =>
  this.trappable(body, point)` dropped the aim's origin and direction the picker needed: the bubble found
  nothing, every time, while calling the picker by hand worked. `(...args) =>`.
- **A geometry whose arrays are freed after upload can't be measured again.** The streamed blocks let
  their vertex arrays go once on the GPU (`freeArray`), and `Box3.setFromObject` (the warm-up's distances)
  then computed a box no one had and read a null array: going back from Coast City to the field threw, and
  the switch stopped faded to black for good (the user waited half a minute and thought it had gone). The
  bounds are computed before the arrays go, the warm-up survives a piece it can't measure, and a travel
  that throws recovers.
- **An interaction placed inside a prop's colliders never shows.** The prototype's "Fly a test card" spot
  was under its wing, inside the airframe's boxes, and appeared only once he was clocked in: the user
  couldn't work at Ferris at all. Map each new spot with Hal's capsule (the overlap grid under *Check a room
  with Hal's capsule*) and walk to it before calling it done; and show a prompt that says why not rather
  than none.
- **A wheel modelled turned spins like a bent axle.** Three of the four town cars have their front wheels
  steered 20 to 30° in the model; spun about the car's axle by their hub pivots, they wobbled from side to
  side (the user's "wheels... wobbling left and right"). `Car.js` `straighten` finds each wheel's disc axis
  (the direction its vertices spread least along) and turns it back inside the pivot.
- **A timer to let the browser in is throttled in a hidden tab** to about one a second: the city's build
  in 85 slices took minutes with the pane hidden (a player who switched tabs while it loaded would come
  back to it loading). `engine/Slice.js` `breath()` posts a message to itself instead (React's way: no
  4 ms clamp, no throttling); the build, the warm-up and CityLife's making of people use it.
- **A comment written into a line of code swallows the rest of it.** A note added after `{ ... };` on one
  line took the traffic's updater with it, and the closing brace: Roam.js didn't parse ("Unexpected token"
  three hundred lines on, at the next method). Parse a changed file (`rolldown/parseAst`) before reloading.
- **A ray exactly on a heightfield's cell line can miss it** (straight down at x -500, z 6600: through both
  the city's and the valley's). The player's controller casts shapes; a test ray off the lines hits.
- **The block's people are only drawn near the block** (`near`: the camera within 900 m of the lot): the
  Ferris offices' receptionist, 6 km off on the field, was a voice behind an empty desk. `remote` people
  skip it. And a post's own `lines` were said to Green Lantern too ("Mr. Jordan" to the man in the mask):
  `glLines`, or the town's lines for Green Lantern.
- **A per-material number written into a shader's source makes a program per material.** The cars'
  dust and roughness floor (`Car.js` `dusty`, `roughFloor`) put each car's own amount into its
  `onBeforeCompile` text with a cache key that named it: 110 of the valley's 399 programs were car
  paint. Pass it as a uniform (each material's own: `onBeforeCompile` runs per material) and keep the
  cache key constant.
- **The loading screen was removed after boot**, so from Continue to the first frame the page was
  black (16 s here, 30 for the user). Anything slow between a click and the scene needs the loading
  screen up (`ui.loadStart`), and something has to end it: a fade up, `giveControl`, a card.
- **In page tests, going to `/#id` from `/` is a hash change, not a reload**: the old page stays, its
  title's buttons and all. Set `location.href` with a query (`/?r=1#id`).

- **Measuring a frame in the page counts the game's own frames too.** A wrapper on
  `renderBufferDirect` or a timer around `composer.render` also catches the animation loop's frames
  that run while the test awaits; wrappers left on stack up across runs; and a hidden pane throttles
  frames to one a second. Pause the engine, call `story.update` and `composer.render` by hand for one
  frame, take the wrapper off after, and keep the pane visible. HMR reloads modules: a wrap on a class's
  prototype from the console may not be the class the game uses.
- **The shadow map is a second scene's worth of draw calls.** 384 of the block's 1,134 were the sun's
  shadow pass: everything that casts is drawn again. Small things and room contents cast nothing.
- **A door built from boxes is a dozen draw calls.** Each frame, rail, panel and handle was a mesh;
  flattened per material they're two or three.
- **Every point light costs every lit pixel**, on or off, near or far (17 in the valley); adding one
  recompiles every material. Pool them (`LampPool`).
- **`compileAsync` isn't all off the main thread.** Its programs link in the background, but making
  them for a whole scene at once was a 1 s stall. Split the scene into pieces and yield between them.
  Rendering the scene in slices to warm it instead took 17 s and made 130 programs more.
- **The first frame that draws a new scene uploads all its geometry** (about 0.55 s for the valley
  with the blocks); `initTexture` covers the textures, not the buffers.

- **A sign atlas fills up quietly.** With the second block, every sign drawn after the 2048 atlas was
  full landed off its canvas: the shops' back-wall boards came out as black panels. `SignAtlas.add`
  warns now, and `label()` starts a new page with its own material when one won't fit (`signs.more`).
- **Refactor a builder against a fingerprint.** Turning `buildHalsBlock` into a two-block builder, the
  proof that Hal's block was untouched was a hash in the page: per merged mesh, a weighted sum of every
  seventh vertex, the triangle count, and the counts of Smash items, solids and spots, taken before and
  after (with the new block switched off): identical. A new block drawing on the old one's seeded random
  would have moved its parked cars; each block has its own.
- **A fitting hung on something optional floats when that's left out.** The eateries' menu photos are
  mounted on the back shelving's front; Tony's has an oven there instead, and the photos hung in the air.
- **A frame boxed over a lit pane hides it.** The tavern's windows were dark wood from outside: the frame
  box stood in front of the glow. Frame behind, light in front, bars before that.
- **A prop's origin isn't always its middle** (the prototype's): a scale model put "on the plinth" by its
  origin sat a metre off it. Place small copies by their bounds.

- **A body removed from the world but left in `physics.dynamics` panics Rapier on the next step**, and
  every call after reports "recursive use of an object" (the cordon's cruisers). `Smash.remove`.
- **Never make a physics body where another already is.** A police car added at its parking spot in
  the lane a traffic car was passing through: the solver threw the two apart and flipped cars onto the
  pavement and felled a lamp post. Cars sent somewhere are driven in from out of sight
  (`Traffic.dispatch`), and a scene placed in the road waits until the spot's clear.
- **A kinematic body walking through a dynamic one shoves it** whatever its mass: an officer walking
  to a suspect through a parked car pushed the car up onto the pavement. People's capsules are in no
  collision pairs, and routes cross the parking lane at gaps.
- **A test loop of `engine.advance` never yields to the network**: `loadProps` and `loadPeople` never
  finished inside one, and the emergency never started. Yield a macrotask (`setTimeout`) each step.
- **A drop rule matches parents too**: `/Bullet/` dropped the revolver's whole tree (its root node is
  "Gun_and_Bullets"). Anchor it (`/^Bullet/`) and print the node tree first.
- **Holding a stretch of road must not hold the cars already in it**, or it never clears (`holdR`).
- **A light Ferris's presets never touched was the night's brightness**: `environmentIntensity` (0.4)
  lit the street at 2 AM like an overcast noon. The day cycle sets it with the rest.

- **An interaction's action runs with `story.busy` already set** (`updateInteractions` sets it, then
  calls the action). Free roam's sit, restroom, flat door, sleep and talking to people each began
  `if (this.busy) return`, so E did nothing at all on them (the user: "I can't press E... I can't even
  talk anymore"); only the store's bell, which had no guard, worked. Test E by pressing it
  (`KeyE` events), not by calling the action.
- **Rapier's character controller gives no movement on some frames on a flat floor box.** On the shops'
  15 cm floors it was one frame in five (a frame in forty outdoors): the move came back zero with the
  floor as its only contact, and the "walked into something" damping then slowed his walk to a crawl
  (the user's "walking is sluggish"). `Player.updateGround` moves again without the press down when the
  floor alone stopped it (`floorOnly`). None of the controller's settings (nudge, autostep, snap) fixed it.
- **An interaction placed on a seat behind a table is out of reach.** The booths' prompt was centred on
  the bench, which Hal's capsule can't get within 0.75 m of past the table's end: no "Sit" ever showed.
  Seats are reached from their approach. And a prompt with a bigger radius beside small ones steals E
  (the menu's, among the stools).
- **Check a room with Hal's capsule, not by eye.** A 3.9 m propane cage stood across Coast Liquor's door,
  and the shopper browsing mid-aisle left no way past. The test: a grid of capsule overlap queries
  (`world.intersectionsWithShape` with his capsule, skipping the people) printed as a map, then walking
  each route with held keys and counting frames that move under half speed.

- **Smash shrinks a box 6% by default** (so loose props don't start touching), and the block's walls,
  floors and building masses went through it too: the diner's 16 m floor stopped half a metre short of
  each wall (Hal sank 7 cm when he walked up to one), long wall pieces left gaps at the corners and the
  door's jambs, the counter came up short. Fixed colliders pass `shrink: 1`. The test that found it: a
  ray straight down at a row of points across the room.
- **A walk-in room's linings must stop at its windows.** Lined over, the side windows were a white wall
  from inside, and the dado lay on the window's kick plate and fought it: "a lot of flickering in the
  floor". Two frames with nothing moved, diffed, showed it as a red band (1.75% of pixels; 0.03% after).
  And a dado offset worked out with `max(n, 0)` only goes out for walls facing +x or +z: on the right
  wall (facing -x) it lay flat on the face and flickered on the corner pier by the door (the user's
  "this one corner keeps flickering"); the chrome rail on it also crossed that wall's windows. Measure
  trim from the face the normal points out of (`shell`'s `out`), and diff a view of every wall.
- **A downloaded booth's table top is where it is.** Plates were set 12 cm above it and half off its edge
  (the table is 64.5 cm up and 66 cm across, not a guess's 76): measure a prop's parts' bounds before
  setting things on it. Its table and vinyl were metal, too, and the sun through the window mirrored off
  them into a white blaze.
- **`find(o => o.p === p.partner)` with no partner finds anything without a `p`.** A customer eating
  alone, done, looked for their partner, found Hal's record (it has no person), and ended his order.
- **A walker turned customer has no `home`**: setting it threw inside an async step that nobody caught,
  and the customer stood frozen at the stool. Catch a fire-and-forget async (`.catch(console.warn)`).
- **Timing a line by `requestAnimationFrame` stalls in a hidden test tab** (it draws once a second); a
  line with no clip is timed in game time (`silent`), so stepping the engine moves it.
- **A new key in the voices' hash re-renders every line** (`WHISPER: null` added to every line's hash:
  816 clips, ten minutes); the output was byte-identical, so only new files showed in git.
- **One frame after a long camera cut, the distance culling hasn't caught up** (the booth was missing in
  a capture): step a few frames after a cut before reading a capture.

- **A downloaded rig's bones aren't world-aligned.** The mocap retarget composes world deltas as local
  rotations and the parameter poses set Euler angles directly: both assume every bone rests at the
  identity, as autorig writes. A Biped (Rocketbox) rests at its own orientations, so it's re-skinned onto
  translation-only bones at build time (`build-people.mjs`), not mapped by name at runtime.
- **A Smash item's pose is its body's.** Turning a placed prop in the page (the bus shelter) does
  nothing: the body sets it back each frame. Change it where it's placed and reload. The shelter stood
  across the pavement for a day (its long axis is the model's z); look at street furniture from above.
- **A pedestrian moved off-screen must be put there, not steered there.** Setting a walker's place on
  the loop and letting the easing follow slid him nineteen metres across the lot; the hop snaps the
  position and the heading.

- **A seated pose needs the player's auto-animation off.** With `player.autoAnim` on, the player's own
  update plays the walk every frame: Hal "sat" standing with the stool through his legs.
- **The block's things are in its frame, the story's in the world's.** The doors and seats were made
  in the block's coordinates (LOT is 6 km off) and compared with Hal's world position: nothing opened.
  Spots go to world space when built; the doors compare Hal's position less the block's.

- **Switching a car's parts on and off brings back what Smash hid.** A shattered pane is a hidden part;
  the distance culling showed the parts again when the camera came back. The parts go under one group
  (`detail`) that's switched as a whole, and the merged copy is made from what's showing.
- **Transparent things at zero opacity still cost a draw call.** The night's pools and halos were drawn
  all day at opacity 0: their group is off by day.

- **A mesh-name pattern can match the material's name too.** GLTFLoader names meshes after node and
  material (`Cube_Material001_0`): hiding the power line's second pole by /001|003/ hid its wires and
  crossarms. Anchor patterns on the node name (`/^(Cylinder001|Cube00[345])_/`).
- **Poly Haven's plaster diffuse is a mid grey**: multiplied by a building's paint it came out a shade of
  mud. The stucco material's colour is lifted (1.38).
- **The interior shader needs a horizontal normal.** Glass made of thin boxes gave their top and bottom
  faces a zero tangent (NaN pixels, smeared by the bloom): panes are planes, and the shader falls back.
- **Part Three's town drive was on the wrong side of the road** (heading south at x 4.1, the west half);
  traffic keeps right, so southbound is the east half (x 6..10). It's at x 7.9 now; anything new that
  drives or parks on the boulevard follows that.

- **A part's end card that starts the next part must finish this one's save.** Part One's card
  sits inside its last step (`powers`) and its "Part Two" button reloaded into Part Two before `free`
  was saved; the title's Continue read Part One's store only, so after six parts it still offered
  "The ring's power" (the user: "the home screen shows me that I'm stuck at the ring's power
  chapter"). The card saves `free` now, the title moves such old saves on, and Continue is the latest
  checkpoint in any part.

- **A scanned bow can be a sheet.** Tripo filled the space between the archer's bow and its string:
  lying flat across him at eye level it read as a thin bow, and raised to the vertical it was a wall.
  A cut by bind boxes or by distance missed what was weighted to his hips; the bow's own texture cells
  (the atlas cells its hand-bound vertices use) found the rest. Look at a held weapon turned, not
  only in the pose it was scanned in.
- **`autoRig`'s arm depth is the middle of the column at that x and y**, and where the column runs
  through the body (the archer's bow hand in front of his hips) it lands inside him: his wrist was
  20 cm behind his hand. Give `arms` a z where the column holds more than the arm.
- **Entering a scene isn't putting Hal in it.** `enterCrash()` shows the lake and binds the powers but
  never spawned the player: free roam's lake showed on screen with Hal still in the valley's physics
  world, and nothing worked (the user: "I can't use it"). Spawn him in every place you enter.
- **The lantern's E interactions are per scene.** Free roam registered them only at the lake, so a
  lantern set down at Ferris or on Korugar had no "Recharge" (the user: "I can't really recharge my
  lantern"). `lanternSpots(scene)` in every place.
- **Locking a Rapier body's translation axis stopped its friction.** The statue, its sideways
  translation locked, slid along the plaza at 7 m/s for ever; lock only rotations. And a body
  balanced for a moment fell asleep across the pedestal: `setCanSleep(false)` for a scripted fall.
- **A rigid statue on a tall plinth comes to rest leaning on it** (legs on the cap, head on the plaza):
  as it tips about its toes, the cap holds its legs. Pulled down by chains it's dragged forward off
  the plinth; the simulation gives it that pull as the ankles go.
- **A two-bone arm held near full reach shakes.** Katma's offered hand was 0.49 m from her shoulder
  on a 0.52 m arm and followed her idle's swaying shoulder: the elbow swung. Hold hands short of a
  straight arm, in the body's frame (`steadyHand`); and the idle clip itself trembles (`smoothArms`).

- **The breach's flash outlives the chapter.** Qward ends by tweening `uFlash` to 1; played on into
  `yellow` (no voyage, whose arrival fades it), every frame came out white. A chapter entered from a
  flash fades it itself. (See "Nothing fades the grade's uFlash" below.)
- **A camera inside a translucent construct tints the whole frame.** Katma's dome over the people stood
  inside the fight's ground; the follow camera went into it and everything turned green. Keep big
  constructs out of where the player goes.
- **A sprite's quad is as big as its scale.** The forge's glow sprite (11 m) whited out a close shot
  placed 4 m from it; and from 95 m the Central Battery's lens filled the frame and the bloom clipped it
  to white (the sting is shot from 330 m with the exposure turned down while it's on screen).
- **`Color.multiplyScalar` works in linear terms.** 0.42 darkened the statue's stone to about 0.67 of its
  sRGB look; 0.2 gives about 0.45.
- **`Material.clone()` doesn't carry `onBeforeCompile`.** The forge's rougher copy of the glass lost its
  veins until the patch and its cache key were assigned to it.
- **Spawn enemies relative to the player, not the arena.** The first Thunderers came through on top of
  Hal (fixed spots, and Hal had walked to one); they come in round him now, 10 to 16 m out, ahead of him,
  and clear of the pedestal and the fallen statue.
- **A sheet of figures may not split by position.** The Thunderers' wings and bow overlap the next
  figure in z: pick each by its connected mesh (`figure`).

- **Hard-edged procedural windows crawl when the camera moves**, and on a curved face (a column) they
  are noise: the user's "a lot of flickering in Sinestro's speech scene". Anti-alias their edges with
  `fwidth` and fade a pattern smaller than a few pixels to its average (`stoneMaterial`). The test is
  the frame diff with the camera moved 3 cm (`director.pos` and `look`, not `camera.position`, which
  the director overwrites); the columns lit up solid red.
- **A swaying banner hung 5 to 20 cm off a wall cuts in and out of it** (its sway is up to 33 cm).
  Hang wall banners still (`wallBannerMat`).
- **A ring sculpted into a scan can't be cut out**: under the band there is no finger, and dropping
  its triangles opened holes through the hand. Fold the band's vertices onto the nearest skin and
  paint them skin in the shader (`withoutScanRing`). GLTFLoader's ImageBitmaps read straight with the
  glTF's UVs (row = v × height): plot the UVs onto the texture before trusting a texel lookup.
- **A scripted flight between two points must clear what's between them.** Sinestro's straight line
  from the balcony to the forecourt went through the rail and the balcony's slab ("he does not cleanly
  come down"); a cubic through points over the rail's top fixed it.
- **In page tests, `#screen button` also finds the last card's buttons** (the card's HTML stays when
  it hides): click `#screen.show button`.

- **A green ball on a character's chest can be the environment map.** Sinestro's suit is metal and
  mirror-smooth; in close shots on Korugar a bright patch of the environment map lay in it and the
  bloom made a glowing ball of it. Turning off his ring light, the braziers, the wash light, the sun
  and his glow changed nothing. `material.envMapIntensity` does nothing for `scene.environment` (use
  `scene.environmentIntensity` to test); hiding the body, then zeroing metalness, finds it. The fix
  is a roughness floor. **Probe in the same call that reaches the moment, with `engine.paused`:**
  the test tab runs on between calls, and three probes in a row measured a different shot.
- **A hall seen through an opening needs the opening cut.** The palace's portal hall (a box seen
  from inside) sat behind the first tier's solid front and never showed: the portal read as a black
  slab. Build the wall round the hole.
- **The towers' stone paints lit windows on anything.** Small trim under the balcony (the corbels)
  in `stoneMaterial` came out as glowing white blocks. Use a plain material for trim.
- **The `cones` prop is a roadworks kit** (barriers, lamps, cones): placed indoors it walled off a
  close-up.
- **Cameras placed by offset from a spot can land inside a crowd.** The palace's first cut was inside
  a man's head; keep cameras to the lane (|x| < 2.7 on the forecourt).

- **A scripted walk only runs on the ground.** `walkTo` is steered in `updateGround`; started while
  Hal was flying (the player usually is by a fight's end), it never ran and never resolved: after
  Korugar's raid Hal hovered over the courtyard for ever (the user: "he just keeps levitating").
  `walkTo` now drops him out of flight first, and before a walk or a talk that follows a fight or a
  flight, a chapter calls `Story.touchDown()` (holster, drop, wait for the landing). Test the end
  of every fight with Hal in the air.
- **A goal zone must be where the player sees the goal.** The commute's "parked" test was centred on
  `CAR_SPOT` (where Part Three's scripted drive leaves the car, 3 m out of the bay's mouth), not on
  the painted space: a car parked between the lines, level with the others, was outside it, and the
  chapter waited for ever (the user: "can't get out of car after I park it in my spot"). The
  scripted test had parked on `CAR_SPOT` and passed. Test the zone by doing what a player does
  (drive in between the lines and brake), and say on screen why a near miss doesn't count.
- **Rapier's wheel brake is an impulse per step, not a force.** `setWheelBrake(i, 34)` let a wheel
  lose at most 34 N·s a step: a fixed number braked twice as hard at 60 fps as at 30 (at 30 fps, 7 m
  to stop from walking pace). Pass force × dt (`Drive.step`). Its engine force is already a force.
- **A story field can't share a name with a chapter method, again.** Part Five's flight-suit rig was
  `this.pilot`, and `pilot()` is Part Four's first chapter (inherited): `this.pilot ??= createPilot()`
  kept the method and `player.setRig(function)` threw. It's `this.pilotRig`.
- **A seated pose outlives the seat.** After the cockpit, Hal stood up on the apron still in the
  seated pose (every shot of the pickup aimed low at a man sitting on concrete). Leaving a seat
  calls `standDown()`.
- **The jet's aim vector shared a scratch vector with its rotation axis.** `loc` (the aim in the
  jet's frame) lived in `_t`, and integrating the rotation copied the angular velocity into `_t`:
  the nose-wheel steering then read the spin axis and ran the jet 220 m off the runway. Its own
  vector (`_ax`).
- **Mouse aim points the nose; on approach the nose isn't where it's going.** Slow, the nose rides
  10° above the flight path, so aiming it at the runway dived the jet in. With the gear down the aim
  steers the flight path.
- **From altitude, layered ground planes z-fight even when tiled.** The far relief, the near desert
  and a city paving plane overlapped; with a small cockpit near plane they flickered. The relief is
  cut out under the near desert, the sea and desert discard each other along `coastX`, and the city's
  paving is painted in the desert's own shader, not a layer.
- **A driven car's chassis was found disabled** (`isEnabled()` false, the car never moved) after
  getting in, cause not found (nothing in our code disables bodies); `Drive.step` re-enables it.
- **A shell made from the scan frays at its rim.** The coverall's edge follows the scan's triangles;
  snapping the rim vertices to a line folded the triangles behind them. Cut the cuffs and collar in
  the shader (`discard` past a plane) and let the skin under them overlap.
- **The bedroom clock always said PM** (`ClockFace.set(text, pm = true)`), mornings included; `setClock`
  now defaults to AM in the morning variant.
- **A crowd of pills.** Capsules with spheres for heads read as a crowd from 40 m and as toys up close,
  and close-ups have the crowd behind the speakers. Bake a low-poly scan in a pose and instance it.

- **A loaded model's vertex positions may be interleaved.** The first car dents threw spikes across
  the car: the denting read `position.array` as x, y, z triples, but the GLB's positions share one
  buffer with normals and UVs. Read with `getX/getY/getZ` and give the part its own plain
  `BufferAttribute` before moving vertices (`Smash.dent`).
- **A prop's bounding box can reach far past it.** office6 is 66 × 57 m: in either of the site's side
  slots it stood out over the street (a parked car loaded inside it and was shoved out) and into
  office5. Buildings and other non-box things get triangle colliders (`smash.solid(o, { mesh: true })`),
  and a prop knocked or shoved at load means it starts overlapping something: test for that.
- **A contact's other body's origin isn't where they touched.** Collision dents first landed at the
  car's bottom corner: the box point nearest the ground's origin. Take the solver's contact point
  (`world.contactPair`, `solverContactPoint`).
- **A nearness test for "the fist met a wall" finds the floor.** A low hook on Oa's deck (a hull
  prism, not a heightfield) or over a pavement stopped the instant it started. Walls are found along
  the fist's path, level, above the ground (`hitWall`).
- **Adding or removing a light mid-fight recompiles every material** (a visible hitch): a burning car's
  `Fire` has its point light taken off, and a snapped lamp's light is left in the scene at 0.
- **A prop placed in a group has its pose in the group's frame**; a body made from it lands in the
  wrong place. `Smash.add` attaches the object to the scene first.

- **`v.copy(p).y += 1.2` is a number, not a vector.** Atrocitus's charge took `const from =
  _b.copy(me).y += 1.2` as its ray origin: the ray was garbage, so no wall or shield ever stopped
  him (the bots found it: the shield "blocked" the damage and he ran straight through). Write
  `_b.set(me.x, me.y + 1.2, me.z)`, and check any `.y +=` used as a value.
- **Nothing fades the grade's `uFlash`.** The story tweens it back itself; the parry's flash left
  once and stayed, and every frame after came out washed green. Fade what you set (`parryFlash`).

- **A target's `hit` wrapper must pass every argument on.** Sinestro's and Atrocitus's `tg.hit` were
  `(a, p, d) => this.hit(a, p, d)`: the new `kind` never arrived, so a hook into a guard counted as
  a plain blow (blocked, no guard break) and Sinestro's spikes never turned Atrocitus. Both pass
  `(a, p, d, k)` now; Hammond's and the drones' ignore `kind`.
- **A boss's "guard when shot at" must not fire over its own answer.** Atrocitus covered whenever
  he wasn't `open()`; his armoured answer isn't open, so the next frame's cover replaced it and he
  never punished anyone. Cover is triggered when he isn't `committed()`.
- **If the gun alone can break an attack, a player who fires at every tell never gets hit.** A
  scripted "fire only in his openings" bot did 945 damage in 20 s and took none: every attack was
  interrupted before it landed. Poise needs more than the gun does in a tell (it takes a hook as
  well), and the rush or dash itself isn't an opening. Test a fight with bots: hold the gun down,
  fire only in openings, spam hooks with the real charge, and look at damage dealt and taken.
- **A scripted spot inside an NPC's walk-round radius can't be reached.** Atrocitus was walked to
  2.1 m from his machine, whose block pushed him out to 2.55 m: he walked on the spot into it until
  the 12 s timeout. Shrink the block for the scripted moment, and give scripted walks a no-progress
  stop (`atroWalk`). His gait now follows his real movement, not his wanted velocity.
- **A stagger on every hit is a stun-lock.** Hooks every 0.8 s held Sinestro in stagger the whole
  fight (he could never dodge). After a stagger, a short immunity (`steady`), as action games do.

- **A chapter method can't share a name with a story field.** Part Four's third step was `site()`,
  and `Story.site` is the lake scene: `setupCrash` read `this.site`, got the method, and the next
  scene update threw ("this.current?.update is not a function"). The step key stays `site`; the
  method is `atrocitus()`.
- **A chapter's suit and powers can't live only in `prepare()`.** `prepare()` runs for the step the
  game starts at, never for one played into: Part Four's `cell` and `site` put the suit on there, so
  played on from `pilot` Hal flew to the lake and fought Atrocitus in his clothes, without the HUD
  or constructs (the user's report). Each chapter sets up what it needs itself (`lanternUp()`).
- **The ring's impacts only damage bodies in the scene's `physics.dynamics`.** A target with its own
  kinematic body (the excavator, Atrocitus) took no damage until its body was pushed there (with a
  dummy mesh, as Hector's shell is): the fist and the hammer passed through Atrocitus for nothing,
  and only Sinestro's spikes (which call `hit` directly) and the sword (which reads the targets)
  hurt him. And **an impact skips whatever its sweep already touched** (the fist's way of
  not hitting twice): a hammer that swept on the way down dealt the sweep's 40 instead of its 110.
- **A kinematic body walking into a loose dynamic one shoves it away.** Atrocitus never reached the
  beam he was fetching; he stops at arm's length and the lift closes the gap.
- **`glowTexture()`'s default mid-tone is green** (it was made for the ring's light): street lamps
  and fires drawn with it came out lime. Pass a white mid (`glowTexture(inner, 'rgba(255,255,255,0.3)')`).
- **An NPC's own update can undo a scripted walk.** Atrocitus faced Hal and damped his gait from his
  velocity every frame, so a position tween slid a frozen figure. Script his moves through his
  velocity (`Prisoner.atroWalk`) and let his update carry them.
- **A downloaded office block's glass is one texture region, not windows.** Lighting a whole cell
  of it made flat beige tiles; a soft-edged lit room inside each cell reads as a window at night.

- **An IK target function must not return a shared scratch vector.** Both hands to the head, the
  left target and the right one wrote into the same vector: the animator reads both before it
  solves either, so both hands went to the same side and the arms crossed over the face. Give each
  closure its own vectors (`temple()` in `Coast.js`). The same goes for a look-at and a reach.
- **A prop's bounding box isn't its hull.** Hector stood at a spot 1.5 m from Abin Sur's ship and
  was inside its broken wing: the close shots came out black. Stand people where someone already
  stood safely (`ABIN_SPOT`), and check the ship's box before placing anything near it.
- **Fixed-step tests stall on lines that have clips.** A clip ends on the audio clock, so stepping
  game time with `engine.advance()` doesn't finish it. Turn voices off in the save first
  (`Save.setting('voice', false)`, before Continue): setting `voice.enabled` after a line has
  started leaves that line holding.
- **A scripted jet must wait for the player.** Its clock ran through the dialogue and the suit-up
  (voice lengths vary), so by the time the player could fly it had already crashed. Slow its clock
  while it's off screen (`jetRate`) and start the chase from a known point.

- **A step can work from its own checkpoint and break when played into.** `targets()` took
  `this.swarm` at its first line and built the range (`setupOa()`) on the next. Loaded at `#oa`,
  `prepare()` had already built it; played on from the voyage, `swarm` was undefined, the drill
  ran, and `swarm.clear()` at its end threw: live fire never started (the user: "it does not link
  to the more difficult one"). Read what a step builds only after building it, and test each step
  played on from the one before, not just from its hash.
- **A car tweened by position and heading separately slides and snaps.** Backing out, the old drive
  moved the Phoenix straight back while turning it (it slid sideways), then a Catmull-Rom path took
  over with its own tangent and the car swung about 160° in a frame (the user: "the car
  automatically shifts to some other direction rather than going turn by turn"); the curve into
  the staff lot ran through parked cars. Drive cars as cars (`planDrive`: the rear axle on arcs,
  the body along its heading, a stop between forward and reverse) and check the footprint against
  everything near the path.
- **A downloaded prop isn't always one thing standing on its origin.** The palms model is two trees
  3.5 m apart, so a pair turned at random put one on the road; a traffic light's bounds include its
  arm, so centring it on them stood the pole 0.8 m out in the road. The bins were placed with the
  kerb offset's sign flipped, on the road. Look at a prop's parts and its ground contact before
  placing it (`piece(..., { root: true })`).
- **A ground plane made of two huge triangles z-fights with whatever is laid over it.** Where the
  near plane (3 cm) clips a triangle kilometres across, its depth comes out centimetres wrong: on
  the drive, the 16 km desert came up through the asphalt 3 cm above it and swapped with it from
  frame to frame (the user: the flickering "where the car is traveling on road, where Hal is
  going to his car, where Hal is going to Carol"). Cut big planes into tiles (`flat()` in
  `Ferris.js`), and give outdoor scenes a bigger near plane (Ferris 0.1). Tiling alone fixed it,
  even at 3 cm. Two layers 1 mm apart (the cross street under the boulevard) fight at any near.
  The test: render the same frame twice with the camera moved 0.5 mm and count changed pixels;
  z-fighting flips whole areas (41% of the lot), stable ground changes almost none (0.01%).
- **A shadow box that follows something smoothly makes every shadow crawl.** Move it in whole
  shadow-map texels across the light (`Ferris.focus`), or hold it still for a shot.
- **A scripted move out of the player's update needs something to run the animator.** Once
  `playerActive` is false, nothing calls `player.animator.update`: the old `getIn` slid a frozen,
  standing Hal into the seat (the user: "like a standing cylinder"). Run it with `onFrame` for the
  length of the move.
- **Hal is too tall for the Phoenix as modelled.** Its headroom (0.86 m) is less than his sitting
  height, so the old driving pose put the top of his head through the roof, and any upright
  moment inside the car does the same. He sits sunk and reclined, and gets in with his head leaning
  toward the middle of the car, where the roof is highest. Check head clearance with a crown point
  (head bone plus 0.22 m along its up axis, 1.832 standing) against an upward ray to the roof.
- **A canvas with a transparent background makes a bad emissive map.** WebGL uploads it
  un-premultiplied, so every texel a line's anti-aliasing touched glows at full strength: lines a
  texel or two wide come out hard, stair-stepped, and crawl as the camera moves (the user: "the
  floor flickering" on Kilowog's range). Paint glow on opaque black, or draw thin lines in the
  shader with `fwidth` anti-aliasing (`deckGlow` in `Oa.js`). Diffing two frames 3 cm apart shows
  crawl as beads along the lines, smooth motion as unbroken edges.

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
- **`f?.(x++)` skips its arguments when `f` is missing**, side effects included. The voice's word
  loop advanced its index inside an optional call (`onWord?.(words[w++][0])`); for every line
  without a word listener (most of them) `w` never moved and the page froze on the first word of
  the game (the user: "the video stops in between and the game hangs"). Earlier tests missed it:
  they ran with voices off, or passed a listener. Test voices on, in real time, from a new game.
- **Spoken text written outside `lines.js` gets no clip.** The ring's warnings were literal
  strings in `RingPowers.js` and would have spoken in the browser's voice; they are lines now.
- **A hidden browser pane throttles `requestAnimationFrame`** to about once a second. The voice's
  tick runs on it (its clock is the audio context's, so lines still end on time, checked about
  once a second). A page that stops answering even a one-line script is stuck in a loop, not
  throttled: leave synchronous breadcrumbs in `localStorage` (a wrapped `requestAnimationFrame`
  naming each callback) and read them from a new tab after the hang.
- **Pointer lock:** pressing Esc releases the lock, which pauses the game (`input.onLockLost`).
  When the game releases the lock itself, it sets `input.releasing` so that doesn't count as a
  pause.
- **Rebuilt models** need a hard refresh in the user's open tab.
- **Head-swap hue detection** (in the unused `headswap.mjs`): bright, warm skin passed the eyeball
  test and got eyes painted on the forehead. Classify by hue, not brightness.

## Status

Verified by playing in the browser:

- (2026-11-19, the bubble and the emergencies after travel) on 5180, muted, fixed-step, real mouse
  events: a mugging started, then the trip to Coast City: its marker and both muggers' targets back; a
  hook on one (45 to 0, down); the bubble on the other (found, criminal, 10%, held, downed), the cruiser
  20 s on, the bubble gone as its officers got out, cuffed (captures: the bubble in the alley, the
  officer with him); the bubble on a parked car (held, kinematic, a hook-strength blow ignored, health
  100; capture). Not: a bubble on a driven car or a passer-by run to its 15 s; the wheel's new slot seen.

- (2026-11-19, switching places) on 5180, muted, fixed-step: Ferris to Coast City and back by `goTo`
  (back threw before: the stack, `computeBoundingBox` on a freed array), then the lake and back; each with
  the loading screen up over the switch, gone after it, and control back. Not by the travel menu with a
  mouse; real-time durations not measured (the pane drew no frames: fades only ran as it was stepped).

- (2026-11-19, the test card's checkpoints) on 5180, muted, voices off, fixed-step with real key events
  from `#world`: as Hal at 10, E at the prototype (clocked in, seated); a takeoff by keys ("Take off, gear
  up" ticked); a crash forced in the climb: back flying from where takeoff was ticked, the card still on the
  climb; the climb done; a crash in the landing: on final 4.6 km out, 200 m up, gear down, holding a steady
  glide for five seconds; two more crashes, the choice, "Call it a day": on the apron at the clear spot, in
  his clothes, in control, still clocked in, walking away. A real landing to a stop not flown by me.

- (2026-11-19, work at Ferris fixed) on 5180, muted, voices off, fixed-step with real key events from
  `#world`: the capsule map round the old prototype spot (inside the jet's colliders) and the new one (clear);
  T to Hal, 10 AM, walked from the hangar's mouth to the new spot, the prompt "Clock in and fly a test card ·
  $62 an hour", E: clocked in and in the cockpit; W throttle, a pull, G: "Take off, gear up" ticked; the climb:
  "Climb to 8,000 ft" ticked. The landing and the clock-out after a flown card not replayed.

- (2026-11-19, the second round of the open world) on 5180, muted, voices off, fixed-step and scripted keys
  from `#world`: the receptionist drawn (the `remote` gate); every traffic car's wheels within 0.2° of their
  axles (20 to 30° before, measured in each pivot's frame); the home's doors found by an elevation shot
  (x ±13.6); clocking in at 10 (as Hal), a test card started (the flight suit, the jet), a crash forced (back
  on the apron in his clothes, in control, still on the clock), clocking out at 12:30 ($155 = 2.5 h × $62,
  in the ledger); the phone on G (pane screenshots: the home screen, a What Up thread), its photos developed
  (7 in 0.2 s, looked at: the flight suit by the jet, the bar, the car, the pier by night, Carol, the jet);
  the radar (pane screenshot) and the seen tag under the level; the city's people and traffic from a town
  corner (22 of 26 roamers out, 16 grid cars, captures); the channel's ground by rays (its banks exact, the
  bridges' decks, the freeway's deck and ramps); captures of a park, the big park, the channel and a bridge,
  the freeway from below and above; the load from Continue in a hidden pane (5 s; minutes before
  `breath()`); a frame's update 3 to 9 ms and render 7 to 11 ms in town; a clean build; 18 new lines rendered.

- (2026-11-19, the loading screen) on 5180, muted, voices off, Continue clicked by script and timed to
  control: free roam (the screen's title, stage, bar and tip in a pane screenshot; the bar moving
  through each stage; gone after the first draw; 5.4 s, 9.2 s before the bigger slices and the veil,
  16 s at the start; 209 programs; the resolution kept at 1.5), `#dawn` (4.3 s, the Ferris build sliced,
  no 2 s freeze), `#morning` (1.4 s), `#duel` (the screen ends); what ends it each time (traced); no
  console errors from the game; a clean build.

- (2026-11-19, the streamed city) on 5180, muted, voices off, fixed-step captures and scripted moves
  from `#world`: the streets north of Hal's lot (shops, flats, signs, palms, lamps, hydrants, the lines,
  crosswalks, stop bars and signals at a corner), downtown (the towers' lobbies and tinted curtain
  walls, the midrises), the waterfront (the promenade, sea wall, benches, beach, surf, the pier and the
  Ferris wheel), the city from the air by day, at golden hour and at night (lamps' pools, lit rooms, the
  towers); walking from a road up a kerb onto a new pavement and into a building's front (he stops at
  it); `solidAt` inside, above and beside a far block, landing refused in the sea and allowed on the
  pier; frame times flying across it, the GPU and draw calls, memory before and after collection; no
  console errors; a clean build.

- (2026-11-19, loading and performance) on 5180, muted, voices off, the pane's Mac Chrome at 1280×800:
  the block's frame measured by hand (update, render CPU, GPU by timer query, draw calls) before and
  after (*Loading and performance*); the boot and Continue into free roam with the service worker on
  (after one visit into free roam 180 files were in the cache; on a reload the boot's 17 came from it, nothing over the network, the scans in about 20 ms each), the part's code and scans
  loaded after the title; long tasks logged on the way in; captures of the street, the diner, the
  alley's poles and wires and the second block after the instancing (matching the earlier ones); no
  console errors; a clean build.

- (2026-11-19, the block over the crossing, Korugar's tavern, the Ferris offices) on 5180, muted,
  fixed-step and scripted keys from `#world`: Hal's block's fingerprint unchanged through the refactor;
  the new block from the crossing, down both pavements, from above and at dusk (captures); all fourteen
  new interiors inside (the bar, precinct, ER, the Palms' lobby, travel, thrift, cleaner's, bail bonds,
  books, pizza, TV, salon, gym, market); Hal walked in through six of their doors (on the floor, the door
  open); the 19 new staff and regulars in place (seated ones seated); a beer bought from Gus ($1.25 off);
  the new walkers moving on their loop; traffic for two minutes with the moved stop lines (flowing,
  crossing both ways); Korugar by the travel menu: walked into the Broken Chain, captures inside and out,
  the stew taken (no hang); the Ferris offices walked into from the staff lot (indoors, the door open,
  the receptionist there), captures inside and out; 30 game seconds with 71 people and 18 cars and no
  console errors; every new line rendered (1,028 clips); a clean build.

- (2026-11-19, the open world's systems) on 5180, muted, voices off, fixed-step with scripted keys from
  `#world`: the street at six times of day and in four weathers (captures); the clock off Earth; K's
  screen spending points (power, endurance, flight into the ring's numbers); a patty melt paid at Rosie's
  ($38.50 to $33.25), a scratcher at Ray's, a shift through Carol (9 AM to 4 PM, $104), the rent two days
  late ($85) at the notice; opinion falling for a hit, burning and blown-up car (35 to 28); traffic over
  minutes (lanes, turns, the lights, the lot, night lamps, a car released by a blow); each emergency to
  its end (the robber's two shots, down, the cruiser driven in, cuffed; the mugging's punches, the
  police up the alley; the crash set when clear, the door torn off, the driver out, the ambulance);
  suffocation on Ysmault and Oa both ways (saved by T; down and "SUFFOCATED", up in the suit); five game
  hours of everything with no console errors; a clean build.

- (2026-11-18, the diner and the store made playable) on 5180, muted, voices off, fixed-step with held
  keys from `#world`: walking in and out of both doors and round both rooms by waypoints, every frame at
  full speed (the floor's stalls all caught by the retry); capsule maps of both rooms (the store's door
  clear, every aisle wider than Hal, the diner's kitchen closed to him, the gate solid); E pressed (not
  called) on a booth, a stool, the restroom (changed), his flat's door both ways, the store's bell, a
  passer-by and Rosie (her three-line exchange); the whole order from sitting to eating at a booth, a
  stool and a side booth; Rosie stopping a metre short of Hal in her way, "Pardon me, sir.", and walking
  on when he stepped aside; the gate shut and swung open for her (captures); no console errors; a clean
  build; the 11 new lines rendered (not heard).

- (2026-11-18, the diner at work, whispers, his secret) on 5180, muted, voices off, fixed-step and
  scripted keys from `#world`: walking in through Rosie's door and out (no trench, no sinking, the door
  out from the room, in from the street), along the front wall and into the corner, into the counter
  (it stops him); the floor at 0.15 to the walls (rays), the flicker band gone (frame diff 0.03%);
  Rosie's day over three minutes (an order taken with her pad, the ticket up, Dot cooking and the bell,
  plates served, tables cleared to the back bar, customers leaving through the door and walking off,
  walkers turning in and sitting); Hal in a booth: Rosie comes, asks, the menu (key 2), his line, hers,
  the patty melt and pie brought, carried at the waist, set down, him eating; the NPCs eating (fork to
  mouth); the meals on the tables in close-up; talking to Rosie (her line, his, hers); overheard talk and
  whispers on screen (pane screenshot: the overheard line in italics, "SEEN · 2 PEOPLE"); T refused in
  view of four people (his thought, the toast), allowed in the alley; the restroom change; no console
  errors; a clean build; 66 new lines rendered (whispers checked by spectrogram, none heard).

- (2026-11-18, the block's people) on 5180, muted, fixed-step captures and scripted input from `#world`:
  the 28 people built and in close-up (faces front, three-quarter and profile; the whole figure; the
  jaw shape open, the smile, the eyes on the camera; the hands relaxed, holding, a fist); walking on the
  mocap; the street by day (walkers both ways, the bus stop, the friends at Sunny's, the man on his
  phone in close-up, the phone along his cheek); the diner (Rosie, Dot through the pass, the couple,
  the man at the counter, the one by the window); the store (Ray, the shopper); sitting at the counter:
  Rosie carrying the mug, leaning over, setting it in front of him; talking to a walker from the game
  camera (he stops, turns, his line); a hook cast near the bus stop (they run, crouch, walk back);
  flying over (the mother and kids look up, the kids point); night (10 out, 22 by day); draw calls and
  the update's cost; no console errors; a clean build; the 64 new lines rendered (none heard).

- (2026-11-18, Hal's block) on 5180, muted, fixed-step captures from `#world`: the block by day and by
  night from the street, close to each front (Bayview, the liquor store and its vending machine,
  newspaper box and meter, the barber, the bank, the hotel and the bus stop, the records shop, the mural
  from the lot), from a roof and down the west alley; no console errors; Part Three's town shot with the
  Phoenix on its new lane (clear of the parked cars); a clean build.

- (2026-11-17, free roam, the Thunderers, the statue, Katma's hand) on 5180, muted, voices off,
  fixed-step, synthetic input: free roam from `#world`: T to Hal and back (the dissolve, the ring hand
  up); the car: the key formed on his palm, into the lock and turned, getting in from where it stood,
  driven (reverse, steering, braking into a parked car), E stopped, getting out (the front wheel
  straightened since); the key failing on an empty ring; T refused without charge; M from Hal's clothes
  to Korugar (the suit first, the voyage, arriving in control); E flying at 125 m over the valley: the
  star chart with all five worlds (the airspace on above 95 m), Oa by the voyage, Oa to Qward by the
  breach, Qward's circle (a wave called and beaten), M to Ysmault (Atrocitus talking), M to the lake
  (Hal in it, walking and flying), M to Ferris, L and E there from 10% (the whole oath, to 100%); Oa's
  Guardians in close-up and Kilowog's round (five drones, the drill ending). The Thunderers in daylight
  at Ferris: the winged one's beat, shriek and dive; the brute's flail hanging, whirled flat and flung;
  the archer low, then side-on with the built bow vertical and drawn, the arrow nocked (the scan's sheet
  gone). Katma's ring in the trial: her hand's frame-to-frame jitter measured (0 while held; the idle's
  0.26 mm mean, was 1.4); the hand turned to, raised and held, the ring to the finger, the look at it.
  The statue standing (his hands clasped behind him) and its fall in `firstnight` played through
  (tipping, the crack, off the plinth, the head broken off and rolling, the impact, the rubble), and
  free roam's fallen statue (the same layout); the broken ends' plugs. No console errors; a clean build;
  `npm run voices` rendered the 30 new lines (614 in all).

- (2026-11-17, the rest of Part Six) on 5180, muted, voices off, fixed-step, scripted input: played on
  from `tribunal` into `firstnight` (no end card between); `firstnight` from its hash: the opening down
  the old quarter's street, Katma's oath (her hand held out), the shield flickering and holding, the
  chant, the pull (the chains, the tilt, the fall from the side, the rubble), the rift, both waves
  (the new spawns ahead of Hal, the brute's tell and swing in close-up, the bolts), the talk, into the
  breach and on into `qward`; Qward (the plain, the cracks after three passes, the pillars, the sky and
  dead sun, the ambush's seven, the forge, the Weaponers in close-up, the ring, the yellow sweep, Hal's
  line, the fist, the rise, the breach) and on into `yellow`; `yellow` from its hash: Sinestro in gold at
  night, Katma struck down, Hal's arrival, the fight, the fear jet (formed in view, the ring on the
  ground, the dive), the cage and the question (No: asked again; Yes: the cage breaks), the yield in the
  open, the rift, Katma, the sting (the shadow and the eyes in the Battery), the end card; free roam's
  Korugar by day with the statue down. `npm run voices` rendered every line (585); a clean build.
  Damage dealt to the Thunderers and Sinestro by script, not by a person playing.

- (2026-11-17, the user's Part Six notes, Korugar, free roam) on 5180, muted, voices off,
  fixed-step, synthetic input: the palace's opening shot with a 3 cm camera shift (only edges change;
  the columns lit up solid before), Sinestro rising over the rail and down, the green ball gone from
  his chest; the short voyage's course lock framed on Hal; Katma beside Hal through the Korugar → Oa
  voyage (not captured in hyperspace); Sinestro's right hand in close-up without the scan's ring (faint
  creases left in extreme close-up); Katma's hand held out for the ring. Korugar's screens, tickers,
  neon and traffic from the plaza, the avenue, the market and above; in `#patrol` the street life (9
  people), talking to one (her line, then the mutter decoded). Free roam from `#world` and played on
  from the trial's card: the menu to Korugar, Ferris, the lake and Coast City in turn (each arrives in
  control), Katma talking on Korugar, Carol's Part Seven card. `npm run voices` rendered the 24 new
  lines; a clean `vite build`.

- (2026-11-16, Part Six's first three beats) on 5180, muted, voices off, fixed-step, synthetic input:
  `dawn` from its hash (the flight in, the landing, the suit off, Carol's whole scene in captures, the
  ring's call, the cut to the apron, the suit-up in front of her) and played on by real flight (double
  tap, held Space) into `palace`; `palace` from its hash (the avenue and forecourt from the air, the
  landing, every line's shot, the portal and balcony, Katma out of the crowd, Sinestro coming down,
  the bubble, the take-off) and played on into `tribunal`; `tribunal` (every line's shot, the ring
  taken, the rift and Sinestro drawn into it, the ring to Katma and her uniform, the end card). The
  build is clean; `npm run voices` rendered the 68 new and changed lines (none listened to).

- (2026-11-12, landing after Korugar's fights) on 5180, muted, voices off, fixed-step with Hal put in
  the air by script: the raid ended with him flying 12 m over the courtyard (he drops, lands, walks
  to Katma, and the chapter plays on through her lines into `report` and its confrontation), and 45 m
  away over the roofs at 22 m (a fade, and he's beside her for her line); flying into the courtyard
  after her (dropped, walked to his spot, her challenge); the staff drill ended at 10 m (down before
  Sinestro's line, on into the market). No console errors; a clean `vite build`.

- (2026-11-12, parking and brakes) on 5180, muted, with synthetic keys at 60 Hz steps: down the
  staff lot's aisle, a right turn in, braked between the lines (stopped at 36.1, 51.4, level with the
  neighbours): taken in 1 s, and Hal got out in full (captures: the door, the turn, out, the door
  shut) into `advance`; stopped short in the aisle, and in the next bay over, it isn't taken and the
  objective says "Park between the lines of your space". Braking from 20 m/s: 0.86 g at 30 Hz, 0.89 at
  60, 0.90 at 120. No console errors; a clean `vite build`.

- (2026-11-12, Part Five) on 5180, fixed-step, **muted** (`gl_mute`) and voices off, synthetic input
  and scripted controls: every checkpoint from its hash, and played on chapter to chapter from
  `commute` through `advance`, `testflight`, `pickup` into `korugar`, and from `patrol` through
  `rebels` and `report` to the end card. Katma's rig (bones, weights: face and jaw on the head) and in
  close-up; the flight suit in close-up (front, three-quarter, back, chest, legs, cuffs, collar,
  walking); Korugarians and guards. The rent's shots and its interactions; getting in, the car
  driven (reverse, steering, the chase and first-person views with his hands on the turning wheel),
  the boulevard to the desert road, the gate, parking in the bay and getting out; Carol's advance; the
  walk-out, the seat, the chase and cockpit views with the HUD (pane screenshot), the whole test card
  (take-off at 150 kt, 12,000 ft, the 9 g turn, Mach 1.2 in 23 s, the low pass, a touchdown at 4.2 m/s
  that rolled straight and braked to a stop) into the pickup; the pickup's shots (Sinestro landing,
  the suit-up in front of Carol, her hand on his chest); the voyage to Korugar, the plaza (statue,
  banners, the baked crowd cheering), the staff on four drones, the market's four talkers and their
  mutters, the arrest; the courtyard, Katma's lines facing Hal, the cells (open, lit, prisoners), the
  raid's two waves, the confrontation, the jump to Oa and the Guardians to the end card. `npm run
  voices` rendered all 119 new lines (none listened to). A clean `vite build`.

- (2026-11-11, everything touchable) on 5180, fixed-step, voices off, synthetic input. The site:
  92 props registered, none shoved at load (after moving office6 out and a floodlight off the spoil
  heap); a hook dents a car (14 cm on the door, no shards), breaks its panes, sets off the alarm and
  hazard lights and shoves it 3–4 m; four hooks set one burning and it goes up 4.6 s later (fireball,
  flipped, charred, burning wreck); a flung car snapped a lamp post and tore fence panels off; a lamp
  hooked snaps and its light goes out; Atrocitus charging tears a panel off and goes through; Hal
  walks across a pavement, down the kerb and stops at a car's side (it gives 7 cm); the hook stops
  against the excavator (aimed high and low) and swings through open air; a hydrant hooked flies 24 m
  and the water goes up (soft spray, its own particles); the boss bots unchanged
  (parry 282 in 20 s, spam 57). Ferris: 30 props, Hal still walks out of his building into his car,
  the fuel truck shot with the gatling burns in 3.5 s and goes up. Oa: a crate hooked flies 13 m (6.5
  m aimed at the floor). Played from `#ysmault` through the voyage to Oa and the hall: the ring's
  lines follow the route, the HUD reads Sector 2814 → Sector 666, and Hal stands in the hall with his
  arms down. No console errors; a clean `vite build`.

- (2026-11-11, block then strike) on 5180, fixed-step, voices off, synthetic input, with scripted
  bots (`tools/fight-bots.js`, numbers under *Sinestro* and *Atrocitus*): hook spam, gun spam, parrying,
  blocking early, greedy blocking and the shield held throughout, against both. The guard on F and
  on the right button (it puts the gun away, drops on release, a click behind it hooks at once and
  it stays down until the button comes up). Captures: Sinestro's tell, the guard up, the parry's
  flash, him knocked open, a hook into him; the HUD (PARRY, the gold OPEN bracket, the new tutorial
  and key hints); Atrocitus's charge parried, him reeling (arms wide, stepping back), the hook; a
  beam held, parried, flying back and hitting him. The 0.53–0.63 s from Sinestro's dash to his blade
  landing. No console errors; a clean `vite build`.

- (2026-11-11, hooks and smarter bosses) on 5180, fixed-step, voices off, synthetic input and
  scripted bots (Hal's health held up so a run could finish; real charge where it says so):
  - Sinestro, 15–20 s runs: the gatling held down did 0 damage and took 84 (lethal); firing only in
    his openings did 184 and took 92; hooks every 0.8 s on the real charge did 274 of the 338 the
    fight needs before the ring ran dry, with dodges, and took 83; a hook into his guard broke it
    (0.84 s stagger).
  - Atrocitus: the gatling held down did 53 (shots at his back as his charges went past) and his
    answers came; firing in openings did 206 and took 31; hook spam did 273 and took 47, and he
    braced; a hook into his cover knocked it open; a spike from his side turned him 90° and the gun
    got through from Hal's side.
  - The hook from the game camera (the right sweeping in, the left after it, the arc line and
    ghost) and Hal's arm from the side and behind (cocked, elbow up, across); 42 and 56 damage, 13%
    each; the Part One plate knocked 4.9 m (the step passes).
  - Atrocitus at his machine: the intro (his hand on a spike), his walk round it (no walking on the
    spot), the drain (both hands on the spike, the new close-up clear of the spikes), on to "Call
    the lantern". His cover pose in close-up. A clean `vite build`.

- (2026-11-11, the suit in Part Four) on 5180, fixed-step, voices off, synthetic input: played on
  from `pilot` (Carol's scene run through) into `cell` (Hal in the suit, the HUD up with health and
  charge, constructs on), the three clues found, on into `site` (suited, HUD, Atrocitus's bar); a
  fist on Atrocitus now deals 40 (it dealt nothing before), from `#site` too. A clean `vite build`.

- (2026-11-11, Part Four) on 5180, fixed-step captures, voices off, synthetic input: Atrocitus's scan
  rigged (bones, weights, the face and jaw on the head bone, the posed test), in close-up (front,
  three-quarter, profile, the jaw held open); the hammer (raised, mid-swing, landing, its ghost) at the
  lake and on the excavator; the wreck's three clues (the hole and its torn metal, the burning blood,
  the stone's word); the building site at night (the arrival over the roofs, the lot, the frame, the
  crane, lit windows, the street lamps); the intro and its shots; each of Atrocitus's attacks (the
  charge's line and rush, the beam lifted and thrown, the blood flung, the slam's ring) and Sinestro
  circling as an ally; the drain (the pulse, the charge to 0, the suit off), L and E into the oath
  recharge and the suit back; the excavator beat, three hammer blows, the breakup, the binding and the
  machine gone, played through into Ysmault; Ysmault from orbit and its basin, Atrocitus chained, every
  line's shot, the gag, the voyage on; the verdict in the hall to the end card. `npm run voices`
  rendered every new line (none listened to). A clean `vite build`.

- (2026-11-11, Part Three's ending) on 5180, fixed-step captures, voices off, synthetic input:
  Tom's call on the trunk; the lake at 5 AM (the lights, Hector at the hull, the ship's breath, his
  face on his knees); the take-off from the gap (roll, lift-off, Carol watching, the long-lens
  flameout with its smoke), the suit-up in the gap; the chase start (camera turned to the jet), the
  catch (the hand forming, the weight, from below), the carry down to the runway with scripted keys
  (charge left 22%), the set-down, Carol running out and the two-shot (the mask in close-up);
  Hector's walk-in down the runway and his lines, the fight (slabs torn up, thrown, a wave hitting
  Hal, a slab reaching Carol giving the "CAROL!" card), the shell broken by direct hits, the mind
  attack (pulled to his knees, both hands to his head, the sepia, the F-104 across the sky past the
  tower), Sinestro's fist, his landing and lines, through to `grave`; the memorial park at dusk
  (the gate, the stone and its engraving, kneeling, Martin forming in green light, his dissolve).
  Hector's whole-head swelling in close-up at four levels (front, three-quarter, profile), the full
  figure, the jaw held open on the moved hinge, and his arrival and fight framing. A clean `vite build`. Played on: `wreck` into
  `test`, and `catch` into `meetCarolGL`.

- (2026-11-11, the drive's collisions and maneuvers) on 5180, fixed-step, the whole drive from
  `#drive` to the bay with the Phoenix's footprint checked every frame against every parked car
  and every prop's parts below its roof: nothing touches (closest: the kerb 0.79 m, the gate booth
  1.09 m, parked cars 2.6 m; before, the staff lot's path ran 0.64 m into a parked car, and bins
  stood in the lane). The heading never jumps (at most 0.03 rad a frame) and only the body's centre
  slips, as a car's does (the rear axle doesn't). Captures: backing out (tail round, the stop, round
  onto the road), the gate from the new camera (the car passing it, no booth in the way), the staff
  lot from above his bay (off the road, along the aisle, nose first in), the crossing's signals and
  the single palms. No console errors; a clean `vite build`.

- (2026-11-10, Coast City flicker, getting into the car) on 5180, fixed-step captures, voices off:
  frame pairs 0.5 mm apart in every shot of the drive (the lot, the boulevard twice, the desert
  verge, the long view, the gate twice), the walk from the car past the hangars to the apron, and
  the bedroom window's street view: 0.00 to 0.08% of pixels change (the lot was 41% before, the
  desert showing through its asphalt). Getting in frame by frame from the game camera, the side,
  the front, and close-ups of the feet and head: the foot over the sill, the outside foot planted
  then pivoting, the head under the rail (a crown check against the roof every frame: at most a
  brush of the headliner), sitting, the left leg in, ending on the driving pose. The driving pose
  from the side and through the windscreen (the head under the roof; it came through before), the
  starter shot, and getting out from the new pose. No console errors; a clean `vite build`.
- (2026-11-10, range fixes) on 5180, voices on: from `#voyage` through the flight, the landing,
  Kilowog's intro and the targets drill into `livefire`, the gatling learned and "Survive the
  live-fire drill" up (it stopped dead after the drill before); the targets ended both with direct
  damage and with real fist strikes; the error card on a forced failure, and its restart into the
  `livefire` card. The deck in fixed-step captures (the follow camera, a wide view, a low grazing
  view): smooth lines in place of stair-steps, a 3 cm camera shift showing unbroken edges, not the
  old beads; the hall floor from above. No console errors; a clean `vite build`.

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

- The second round by hand: a test card flown to its end by a person (only a forced crash; the landing and
  the card's ticks are Part Five's code), the phone with a real mouse (clicks) and the map's drag and wheel,
  the map's full screen and the waypoint followed to its end, the roamers at the real frame rate (their
  turns at corners, crowding at crosswalks, walking into the parks' hedges' gaps: they keep to pavements),
  the grid traffic's turns seen close and two cars meeting in a crossing on a turn (no right of way beyond
  the lights), cars under the freeway beside its piers, the channel walked along and its bridges driven
  over, Hal flying into the freeway's deck and signs, the parks' trees by night; the new lines heard; the
  map's icons for places whose people aren't made yet (before CityLife starts).

- The loading screen on the user's machine and server (their 30 s not reproduced; 5.4 s here, warm
  caches); a first visit with an empty service-worker cache; chapters whose `prepare` builds Oa,
  Korugar, Qward or the site (built in one go: the bar stops while they build, the screen stays up);
  the chapters after the first draw (their shaders compile on it, not warmed up); free roam's
  background compile against first sight of the far pieces (a stall if one draws before it's done).

- The streamed city by hand at the real frame rate: walking and driving its streets (the car on the new
  kerbs), hooking its lamps and palms, standing on its roofs, flying into a far block at full speed; the
  chapters that pass the lot (Part Three's drive and morning, Part Five's commute) with the new blocks
  round it (their cameras were checked only by their coordinates); frame rate on other machines.

- Loading and performance on other machines and at full screen on a Retina display (the adaptive
  resolution steps it down; its steps not seen by hand); Parts One to Five booted with their own scans
  since the scans load by part (only Part Six's free roam was played in); the service worker on a deploy
  (only on the dev server), and a rebuilt model showing on the next visit; the first draw's 0.55 s
  upload; the lamp pool's lights changing source at full speed (a light can fade across between rooms);
  the parked cars' merged copies past 4 m from the follow camera.

- The new block, Korugar's tavern and the offices by hand, by ear, at full frame rate (the second block
  adds about as much again as Hal's: two more pages of signs, 22 more people, 14 more rooms); talking to
  each new person (only Gus bought from; the lines exist and are rendered, not heard); the cinema's ticket
  and the gym's workout (the time-skip path is the laundromat's, tested before); the emergencies after the
  stop lines moved (the crash's hold and the police's routes use the lane points, not the stops, but
  weren't replayed); people crossing the new crosswalk with traffic stopping for them; the
  Coronado's fire escape and the south alleys walked; the bulb-outs at -404 seen close; Korugar's
  vendors bought from (only the tavern's keeper); the offices' receptionist talked to and Martin's
  photograph looked at.

- The shops by hand at the real frame rate (every walk since the fixes was stepped by script with held
  keys); someone standing still in Hal's way (seated, or holding at a spot) doesn't step aside: he walks
  round them; the counter's gate seen with Rosie through it at full speed.
- The diner by hand with sound: the whispers and the murmured lines heard (only their spectrograms and
  levels), the gain falling off as he walks away, Rosie's service at real speed for long (minutes, not
  an hour), crowding (two people routed through one spot pass through each other: they aren't steered
  round each other), the order menu with a real mouse, Hal eating with the camera behind him, a
  customer and Rosie at the same table at once; who-sees-him through the diner's glass (the front wall
  is one solid behind its windows, so people inside don't see the pavement through them).

- The block's people by hand and with sound: the lines heard, walkers stepping round Hal and Hal
  walking into them (code path only), several people answering at once, Ray's bell by hand, the hop at
  the lot with the real follow camera, walkers at the crosswalk's kerbs seen close, frame rate with
  everyone out and the diner lit at night; the people not yet shown to the user.

- The distance culling played by hand: popping at the tiers' edges at full speed (seen only in captures
  at fixed spots), a car's merged copy after a dent.
- The interiors by hand: walking in and out through the doors with the real camera, sitting at the real
  pace, the jukebox's tune and the door bells heard, Coast Liquor's door used (only Rosie's walked
  through), Hal flying indoors (constructs and flight are off in the flat only).
- Hal's block played by hand: walking and driving into everything (the pavements, kerbs, parked cars, the
  props knocked off walls and roofs), standing on its roofs, frame rate (about 470k triangles with the
  parked cars and palms; 20 cars), the other story chapters that pass through it (Part Five's commute,
  driven; the airspace from above), the night preset outside free roam (nothing calls it yet).

- Free roam by hand with a real mouse and keys and sound: driving the six kilometres from the field to
  the city (the road the whole way, the far plane, the boulevard's props driven into), the car's
  interaction after a drive into the city, getting in with something parked close to its door, flying
  into the standing statue (its triangles are solid now), the Qward arena past a few waves (balance),
  the star chart's virtual cursor from flight; the Guardians' and Atrocitus's free-roam lines heard;
  the oath recharge at its real pace; frame rate with every world's scene cached at once (Ferris, the
  lake, Oa with seven Guardians, Korugar, Ysmault, Qward). The archer's aim at every angle (seen from
  four), the winged one's wing roots from below, the flail's chain in a long fight; the statue's fall
  from the chapter's own camera at full frame rate (seen in fixed steps at night, dark), the head's
  roll into Hal or Katma.

- The rest of Part Six with a real mouse and keys and sound: the pull's feel (hold to pull), the
  Thunderers' balance (two waves on Korugar, seven on Qward), the Yellow fight's balance (680 health,
  the fear jet's 70 m/s dive: is the tell enough?), the cage's choice by click; every new line heard
  (rendered, none listened to); frame rate at night on Korugar and on Qward (16 buttes, 22 floating
  rocks, 1,600 ash points); the Thunderers' rigs in close-up beyond the brute's swing (the archer and
  the winged one move as a whole; the woman's long hair is on the head and chest bones); the Weaponers
  and the yellow uniform shown to the user.

- Free roam by hand: flying the six kilometres from the field to the city (bounds, the far plane,
  the city's collision on landing), the lake reached from the valley, frame rate on Korugar with
  ~100 screens redrawn and 15 walkers, people reacting to a construct (`scare`) and to flying low
  (code paths only), walking into a walker; the screens in the Part Five and Six chapters' own shots
  (seen only in my test shots); the Korugarian street lines heard.

- Part Six with real input and sound: the flights by hand, the voices' pace (all lines were timed on
  the fallback); Hangar Two's and the palace's new dressing at full frame rate; the forecourt's
  crowd (about 470 instanced, 12 full figures, 4 guards) for frame rate; Sinestro's rougher suit in
  Parts Two to Five (only seen on Korugar and in the hall); the hall's rougher floor and dais from
  the range.

- Part Five with a real mouse and keys at full frame rate: the car's feel (grip, steering, the
  handbrake), the jet's mouse aim by hand (every flight was scripted through `jet.aim` and the keys),
  how hard the landing is for a person, the g grey-out's strength, the cockpit at altitude for
  distant flicker (near 0.3), frame rate over the airspace (the 160 km relief, ~1,700 city blocks) and
  in the plaza (16 full figures, ~1,600 instanced, Sinestro, the statue); the car hitting the
  boulevard's lamps and parked cars (colliders built, never driven into); Korugarian lines heard; the
  staff's sweeps seen close; the vapour cone at Mach 1; Katma's jaw at speaking openings (only held
  wide open); the jet crash's card in play (code path shared with the restart).

- The props at full frame rate with a real mouse: frame rate with several cars burning, smoke and the
  glass bits; the dents by eye in every car model (one checked closely); the bus shelter's glass; the
  floodlight towers knocked over (their spots then light the ground). Ferris's staff-lot cars and
  Hector's slabs hitting them; the Part Three drive played through to the bay with the staff-lot cars
  now loose (they're where they were; only walked out to the car); the cemetery's new trunk and bench
  colliders walked into; Ysmault's buttes and rocks flown into. Every new sound by ear.

- The parry with a real mouse, trackpad and keys at full frame rate: whether the 0.5 s window feels
  fair, the guard on a trackpad's two-finger click, how often a person lands one. The new sounds
  (`parry`, `turned`) by ear. Part One's core breach step, Kilowog's live fire and Hector with the
  new guard (only the code path is shared; not played). A parried volley seen in a capture (the
  numbers show the spikes landing back on him).

- The hooks and both bosses' new AI with a real mouse and keys, voices on, in real time: how hard
  the fights feel to a person (the bots react instantly and never miss), the openings' length at
  full speed, the new lines heard (10 rendered); Kilowog's targets drill and the live-fire drill
  with hooks (only the Part One plate was tested); the excavator beat and the rest of Part Four
  played on since (the code it uses is unchanged); Hector's fight with hooks.

- Part Four with a real mouse and keys, voices on, in real time: the Atrocitus fight's balance (his
  health, the charge's stun window, how hard the beams and the blood are to dodge), the 24 s
  excavator timer, Sinestro's volleys landing; the pilot and cell chapters since their last visual
  fixes in real time; the breakup's new wide shot and the intro's closer first shot (changed after
  the last captures); the obelisks' red recolour (changed after the last capture); frame rate at the
  site (ten office blocks, the crane, the frame, eight lights) and on Ysmault; every new sound.

- Part Three's ending with a real mouse and keys, voices on, in real time: the chase and the carry
  were driven by script (the carry's difficulty, the camera's mouse turn), the Hector fight by
  direct hits (blocking his throws with a real shield or wall, how hard protecting Carol is), the
  pacing of every line with its clip (all 58 new lines rendered, none listened to); `catch` played
  into `hector`; Martin's wave seen frame by frame (only formation and dissolve were captured); the
  new sounds (jet engine, flameout, strain, psychic, rumble, siren); frame rate at the memorial
  park (about 120 tablets, 30 cypresses) and with Hector's slabs.

- the new maneuvers at real speed with sound (the engine follows the speed, never heard); the
  front wheels' steering seen close (only in wide shots); the bedroom window's palms are still the
  two-tree model (off the road there, not changed)
- the drive and the car entry in real time at full frame rate (fixed-step captures only); the
  palms as cut-outs in every shot (seen from the window and the boulevard); shadows at the gate and
  on the boulevard with the wider boxes (softer, not compared side by side)
- the deck at full frame rate with a real mouse (the captures were fixed-step, the pane hidden);
  the hall's dais emblem from the range with its new polygon offset (not captured)
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

- Part Six's later beats are mine, from the user's arc and my suggested defaults (they didn't pick
  before going to sleep): Hal follows Sinestro to Qward, he comes back to Korugar, he escapes, Parallax
  is a shadow in the Battery. The Weaponers are derived from the Guardian generator (no scan): a Tripo
  scan would be better. The Yellow Lantern's emblem is still the Corps' shape in gold. Parallax's model
  comes later (the user).
- The Thunderers don't speak; they have no hurt or death animation beyond a kneel and the dissolve (the
  winged one droops its wings); the flail's chain is rigid (it swings, it doesn't bend); the archer
  doesn't reach for a new arrow from his quiver.
- Coast City, what's left (2026-11-19): the streamed city's blocks have no interiors, no props on their
  walls and roofs, and no parked cars (its streets have people and traffic now; their signals' lamps don't
  change with the traffic's phases); nobody walks in the parks or sits on their benches, and nothing drives
  the freeway; the photos are taken at whatever hour it is (the pier by night is dark); the district edges are sharp (a block is one district);
  the sea and the pier have no boats or people; the Ferris wheel's rim has no collider; the far boxes
  are plain boxes (no roof shapes); the garbage collector still costs a frame now and then while
  blocks build (the kit allocates a geometry per box). In Hal's blocks: the
  flats over the shops can't be walked into (their glass is the room shader); the shops' rooms are big
  and plain beside the diner (a counter, one trade's fittings, a board); the diner's corner is square;
  the alleys are bare; Carol stays in Hangar Two (not at her desk in the offices). Its people: walkers
  keep to their block's loop (none cross mid-block or turn into the cross street), people in a route
  don't steer round each other, they don't react to cars or to emergencies; the man on his phone isn't
  at the payphone; a Rocketbox face is 8k triangles, the scans' 90k. Overheard talk is a few scripts
  per group. Korugar's places: one tavern and three stalls; nobody there has a job beyond their spot.
- The lake stays at night while the valley is day. The fallen statue's head is the scan's bald head (his
  painted hair is in the live figure's shader, not the stone's).

- Free roam's Part Seven marker is a placeholder card at Carol until Part Seven is written.
- Korugar's look is built from the user's brief ("Times Square, but for Sinestro"); the comic wiki
  pages couldn't be fetched (refused, paywalled), so no scans were studied: ask for reference images.
- **Part Seven** is open: the user's to choose. My suggestions (2026-11-17): Black Hand and the
  Blackest Night (Atrocitus's prophecy; who took the machine from the building site), or the Manhunters
  over Coast City (the old roadmap's neon night city). The part name "Exile" is a placeholder of mine.
- Korugar's forecourt crowd is the baked low-poly figures beyond the lane's full figures: fine past
  4 m, poor closer (cameras are kept to the lane).

- Korugar is built, not downloaded (towers, stalls, banners, the prison): the user prefers found
  models; nothing on Objaverse was searched for it. Its courtyard and lanes are plain walls up close.
- The F22's cockpit is the model's own simple console (darkened); a downloaded cockpit would be better.
- The flight suit is mine, unreviewed by the user (they asked me to design it): show it to them.
- Tom Kalmaku is still a voice only (the user: "No need for tom yet").

- **Part Four** is built (2026-11-11). Ours, not the comic's: the machine built from the cell (it
  drains rings; who took it is left open: Black Hand later?), the excavator, the hammer learned
  there, Sinestro's gag. Atrocitus wears the Red Lantern emblem in the user's scan (no red ring yet in
  the story). The other Inversions aren't shown on Ysmault (empty chains). Hal has no part in the
  verdict beyond his line; Kilowog is on his range, not in the hall.
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
- **Part Four** (agreed 2026-11-11): *Secret Origin*'s second half. Atrocitus (Abin Sur's escaped
  prisoner: the empty cell Sinestro names), Hal and Sinestro against him on Earth, his ring-draining
  device and the pocket-dimension recharge (the L key), the excavator, Ysmault; Carol hires Hal back
  as her pilot and won't date an employee. Atrocitus needs a Tripo model. The Manhunters come later.
- Part Three's ending: the F22 has no pilot model (the canopy is tinted gold); the Air Force people
  are voices and sirens; Hector's whole-head swelling was approved by the user (2026-11-11, second pass); Martin's wave is an arm IK
  sway (no finger bones); Hector knocked flat is a rotated root, not a ragdoll.
- Part Three: Tom Kalmaku, the landlord and the Air Force people are voices only (no models).
  Carol's face keeps faint highlights at the brows (her scan's normal map). The ring's powers are
  off for the civilian morning (no flying to work). The F22 still carries its "Raptor 01"
  markings. The Phoenix is small for Hal (see Gotchas); a car scaled up a few per cent would let
  him sit less sunk, but `makeCar`'s seat and pedal points are in metres and would need re-measuring.
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
                            speech fallback), Save (checkpoints), Slice (building in slices)
src/characters/             Rig + Animator, IK, Mocap, Poses, Player (walk + flight), Characters,
                            BodyLanguage (talking gestures), Guardian + Robe + HairCards (the Guardians),
                            FlightSuit (Hal's test-pilot kit), People (Coast City's Rocketbox people: load, fingers,
                            eyes, blinks, the jaw blendshape)
src/powers/                 RingPowers (charge, health, wheel, aim, constructs incl. the sword, flight fx),
                            Constructs (list, shaders, fist / shield / wall / gatling / sword geometry, Blade)
src/scenes/                 Bedroom (+ hallway, kitchenette, buildJet; night or morning), Dream, Hyperspace,
                            CrashSite, Oa (Part Two) + Hall (the Guardians' hall), Space (Earth and Oa
                            from orbit, and Ysmault), Ferris (Part Three: the airfield, the road, the lots),
                            Site (Part Four: downtown at night, the building site), Ysmault (the prison world),
                            Korugar (Part Five: Sinestro's capital, by day or night) + KorugarSigns (its screens, tickers,
                            neon, traffic) + Statue (his statue baked in stone, its fall),
                            Qward (Part Six: the antimatter world, the Weaponers' forge), DayCycle (free roam's
                            clock, sun, moon, weather and rain)
src/props/                  Props (downloaded models: load, clone, helpers), Car (makeCar: paint, wheels,
                            the driver's door, seat / pedals / rim / tail points), Smash (every prop
                            touchable: solid, loose, breakable, cars that dent, burn and go up)
src/enemies/                Drones (training drones: model, spring flight, AI, bolts, breakup), Sinestro
                            (the sparring opponent, or an ally: flight, blade, spikes, guard, slam), Hammond
                            (Hector at Ferris: the shell, thrown slabs, psychic waves), Atrocitus (Part
                            Four: charge, thrown beams, burning blood, slam), Thunderers (Part Six: Qward's
                            soldiers, four kinds with tells)
src/vehicles/               Drive (the car driven: raycast wheels, views), Jet (the prototype flown: flight model,
                            mouse aim, gear, cockpit)
src/fx/                     Sky, Particles + Fire, Water, Trees, GreenLight, Cloth, Textures, Rift
                            (pocket dimension), EarthMap (continent outlines, city-light density)
src/city/                   Coast City's kit: Kit (materials, the glass with rooms behind it, Batch), Building (the
                            generator), Signs (lettering, neon, the mural, the atlas), HalsBlock (Hal's block and the
                            one over the crossing, their streets, doors), Lod (drawing by distance, merged props,
                            cars' merged copies), Interiors (the diner, the corner store), Shops (every other shop's
                            fittings, staff and wares: the bar, the precinct, the ER...), Traffic (the cars),
                            Office (the Ferris offices), Lamps (the pooled point lights), Plan (the city's
                            grid, districts and buildings), Tower (downtown's towers), Stream (building
                            blocks near the camera, boxes for the rest), Ground (the painted streets, the
                            bay), Waterfront (the promenade, beach, pier and Ferris wheel), Landmarks (the freeway,
                            the channel and its bridges)
src/story/                  Story (Part One + shared plumbing, the lantern), Corps (Part Two, travel), KorugarLife (Korugar's street life),
                            CityLife (the blocks' people: walkers, talk, whispers, who sees him), DinerLife (Rosie's
                            service, Dot's kitchen, the customers, Hal's order), Life (money, XP, the ring's stats,
                            opinion), Emergencies (the city's), Pressure (when opinion's low),
                            Coast (Part Three), Prisoner (Part Four), Probation (Part Five), Exile (Part Six), Roam (free roam after it),
                            Work (the time clock, test cards), Album (the phone's photos),
                            Voyage (flights between worlds),
                            lines (all dialogue)
src/ui/UI.js                HUD, subtitles, glyph cipher + decode, choice, cards, pause, toasts
src/ui/PowerHud.js          vitals, ring charge, armed construct, ring readout, reticle, marker,
                            training panel, target bracket, damage numbers, construct wheel
src/ui/TravelHud.js         flight readout, arrival card, StarMap (the ring's star chart), WORLDS
src/ui/VehicleHud.js        the car's dash, the jet's panel and HUD, the test card, the g grey-out
src/ui/Phone.js             Hal's phone (G): What Up, Photos, Maps, the S&L, the Herald, Weather
src/ui/CityMap.js           the radar top left and the whole map (N), waypoints
tools/                      build-assets, autorig, build-props, build-people, people-test.js, propview.html, fetch-textures, build-voices,
                            voices.html, strip-mocap, extract-posters, debug renderers
public/models, public/anims built GLBs loaded at runtime (props in public/models/props); public/textures/posters,
                            public/textures/pbr (Poly Haven surfaces); public/voices (clips + manifest.json);
                            public/sw.js (the service worker: assets kept in the browser's cache)
```

---

## Change log

Newest first. Add an entry for every decent update (see the top of this file).

### 2026-11-19: the bubble trap, and emergencies that survive a trip
- The user: after teleporting to Coast City a mugging had no alert to follow and the constructs didn't
  hurt the mugger; and a new construct, a bubble that traps anyone or anything, shields them and holds a
  criminal till the police arrive and take him.
- `Emergencies.rebind` (from `ferrisRoam`), `down`'s `kneel`, `a.cops`, `hit` guarded; the bubble:
  `Constructs.js` (entry, `bubbleGeometry`), `PowerHud.js` (its icon), `RingPowers.js` (aim, ghost,
  `trapIt`, `BubbleTrap`), `story/Trap.js` (new: what it holds), `CityLife.js` and `Traffic.js` (held
  people and cars), `Smash.js` (`shielded`), `Roam.js` (unlock, the hook).
- Verified: see Status (2026-11-19, the bubble and the emergencies after travel).

### 2026-11-19: switching places without the black
- The user: switching between Ferris and Coast City was black, back to Ferris for 30 s ("I think like it
  has gone"). It had thrown (see Gotchas). `city/Stream.js` (bounds before freeing), `story/Story.js`
  (`warmUp`'s guard), `story/Roam.js` (`goTo`: the loading screen, the recovery), `ui/UI.js` (`loadEnd`'s
  fallback).
- Verified: see Status (2026-11-19, switching places).

### 2026-11-19: the test card's checkpoints, and out from under the wing
- The user: a crash on landing ended the card with Carol shouting; "checkpoint every part of the flight";
  after landing Hal was stuck under the wing, even as Green Lantern. `story/Work.js`: the card as steps,
  each ticked a checkpoint, a crash a reset to it (the landing to final approach), the choice after three;
  Hal put down at the prompt's clear spot.
- Verified: see Status (2026-11-19, the test card's checkpoints).

### 2026-11-19: work at Ferris that can be done
- The user: "I'm unable to work at Ferris Aircraft." The prototype's spot was inside its colliders (see
  Gotchas). `story/Work.js`: the spot moved clear of the wing, `atPrototype` (clock in and fly in one E),
  prompts that say why not (the hours, the suit), the clock's radius 2.2; `Roam.roamObjective` names the work.
- Verified: see Status (2026-11-19, work at Ferris fixed).

### 2026-11-19: work, a phone, a map, the city's life, parks, a freeway and a channel
- The user, after playing the streamed city: the receptionist missing and naming Green Lantern "Mr. Jordan";
  traffic's front wheels wobbling; no life outside the block ("the same everywhere, but more randomized");
  a GTA map top left; the seen tag over the XP; home with E from the front yard (to sleep or get ready);
  daytime test flights for test pilots' pay ("250 an hour, but double check"), 9 to 5, Part Five's mission
  simpler (7 g, 8,000 ft); a phone on G with What Up, photos and more, "5 6 apps"; parks, "a flyover or a
  bridge". Then Part Seven.
- New: `story/Work.js`, `story/Album.js`, `ui/Phone.js`, `ui/CityMap.js`, `city/Landmarks.js`. Changed:
  `CityLife.js` (roamers, `remote`, `glLines`), `Traffic.js` (the grid), `Car.js` (`straighten`), `Roam.js`
  (G, N, the phone, the doors, the bed, getting ready, the shift through Carol), `Plan.js` (`FREEWAY`,
  `CHANNEL`, parks), `Ground.js` (parks painted, the channel opened), `Stream.js` (`park`, the landmarks),
  `Ferris.js` (the city's heightfield), `Physics.js` (`fixedHeights`), `Life.js` (the ledger, the events),
  `Emergencies.js` (`note`), `Slice.js` (`breath`), `Office.js`, `Coast.js` (`buildPhone` exported),
  `UI.js`/`index.html`/`style.css` (the seen tag in the panel, the phone, the map), 20 lines.
- Verified: see Status (2026-11-19, the second round). Not verified: by hand, by ear.

### 2026-11-19: a real loading screen, and Continue three times quicker
- The user: "Does not work when i click continue, very slow load, took 30 seconds, either add a true
  loading screen for assets, just don't show users the dark". The loading screen went after boot, so
  everything from Continue to the scene was black; here it was 16 s.
- `ui/UI.js` (`loadStart`, `loadStage`, `loadEnd`, `LOAD_TIPS`, the watchdog, ended by `fade` and
  `screen`), `index.html` and `style.css` (its title and tip), `main.js` (`LOAD_PLANS`, the stages,
  `engine.veiled`), `engine/Engine.js` (no drawing or resolution changes while veiled),
  `engine/Slice.js` (progress), `props/Props.js` (`loadProps` progress), `Story.js` (`warmUp`'s `near`
  and background compile; `giveControl` ends it), `Roam.enterPlace` (the stages), `Ferris.buildAsync`
  and the fill in 24 ms slices, the chapters' `prepare` building Ferris in slices (`Coast`, `Prisoner`,
  `Probation`, `Exile`), `props/Car.js` (the paint's dust and roughness floor as uniforms: 399 programs
  to about 210).
- Verified: see Status (2026-11-19, the loading screen). Not verified: the user's machine.

### 2026-11-19: the rest of Coast City, four kilometres, streamed
- The user asked whether the city was 4 × 4 km (it was two blocks), then "please do" to my plan: the
  core at full detail streamed in blocks, a ring of fronts to 4 km, boxes beyond. See *The rest of Coast
  City, streamed*.
- New: `city/Plan.js`, `city/Tower.js`, `city/Stream.js`, `city/Ground.js`, `city/Waterfront.js`.
  Changed: `Ferris.js` (the coast from Plan.js, the bay's sea, the desert and old ground stepping aside,
  the placeholder offices round the lot and downtown only without the city, the airspace's blocks
  outside it, `city` built and updated), `Roam.js` (filling round the arrival, the flight's bounds,
  `solid`, landing), `DayCycle.js` (the city's night), `Building.js` (signs shared by key through
  `signs.cache`; a flat roof's vents without props), `Kit.js` (`chunk`; the glass's tinted office kind and
  `vTint`), `Smash.js` (`remove` clears its handle maps: Rapier reuses handles).
- Verified: see Status (2026-11-19, the streamed city). Not verified: by hand, the chapters by the lot.

### 2026-11-19: loading by part, the browser's cache, and the frame rate
- The user: the frame rate "dropping quite fast" even on their Mac, the browser freezing on boot, and
  the game to load "bit by bit" and stay in the browser's cache. See *Loading and performance*.
- `main.js` (`PART_CODE`, the guess prefetched behind the title, the service worker), `Characters.js`
  (`more`, `SCANS`, `PART_SCANS`), `public/sw.js` (new), `engine/Slice.js` (new), `city/Lamps.js`
  (new), `Engine.js` (`adapt`, `gl_res`), `Kit.js` (`buildSteps`, cells), `HalsBlock.js` (`blockSteps`,
  the pool's sources, `STILL` instancing, frozen matrices, draw and shadow distances), `Lod.js` (shared
  merges, the simplified tier, `near`), `Ferris.js` (`steps`, `buildAsync`, `lamps`, Smash's tiers),
  `Office.js`, `Coast.setupFerrisAsync`, `Roam.enterPlace` (`warmUp`), `Story.warmUp`, `CityLife.js`
  (made between frames, posed by distance and view), `build-props.mjs` (21 props decimated,
  `tris`/`error`); `meshoptimizer` moved to the runtime dependencies.
- Verified: see Status (2026-11-19, loading and performance). Not verified: other machines, the other
  parts' boots, a deploy.

### 2026-11-19: the block over the crossing (police, hospital, bar), the other shops, Korugar's tavern, the Ferris offices
- The user's "no finish everything i told you": the agreed interiors ("the Ferris offices, the police
  station, a hospital and a bar"; "places like these on Korugar once it's freed") and more of the core.
- `city/HalsBlock.js` (two blocks: `WEST2`, `EAST2`, `STREETS`, `ALLEYS`, `street`/`alleys` by layout,
  `marquee`, `blade` by text, the precinct's lamps, St. Mary's sign and canopy, `swingDoors` and `SOLID`
  exported, the atlas's pages), `city/Shops.js` (fourteen trades and their fittings, `regular`, `picture`,
  `room.post`/`buy`, `ownCounter`/`back`/`deep`/`posters`), `city/Building.js` (`label` fits an atlas or
  turns a page), `city/Signs.js` (`fits`), `city/Office.js` (new), `scenes/Ferris.js` (`buildOffice`,
  `indoors`, `buildCity` steps aside to -404, the south signals), `scenes/DayCycle.js` (`f.indoors`, the
  offices' signs), `city/Traffic.js` (`STOP`), `story/CityLife.js` (`LOOP2`, `WALKERS2`, `p.loop`, seated
  posts, `posts()`), `scenes/Korugar.js` (`TAVERN`, `buildTavern`), `story/KorugarLife.js` (`posts`),
  `story/Roam.js` (`TAKES`, new purchases, `look` spots, `korugarRoam`'s places), 22 Rocketbox people
  (`build-people.mjs`), 80 lines (`lines.js`, rendered), `README.md`.
- Verified: see Status (2026-11-19, the block over the crossing...). Not verified: by hand, by ear.

### 2026-11-19: the open world's systems: the day, money and XP, opinion, traffic, emergencies, no air
- The user: "no finish everything i told you" (the open world agreed on 2026-11-18), after the commit.
- `scenes/DayCycle.js` (new), `Roam.updateDay`, `engine/Save.js` `LifeSave`, Sky.js `PRESETS` exported,
  `HalsBlock` `indoors`, `Ferris.flightAir` `highAir`, CityLife `p.out`; `story/Life.js` (new), `#life`
  (`index.html`, `UI.life`, `style.css`), RingPowers `mods`/`healBoost`/`trickle`, Player `flyScale` and
  `hamper`, `Roam.ringStats` (K), `offerShift`, `buyAtStore`, `payRent`, the rent notice and lock,
  DinerLife prices and the tab; opinion through `Smash.onEvent`, CityLife's mood pools; `city/Traffic.js`
  (new), `Audio.horn`; `story/Emergencies.js` (new), CityLife `remove`, `actor`/`mute`/`barge`/`ghost`,
  collision groups; `Roam.updateAir`, the grade's `uChoke`; five props and nine people added; 129 lines
  rendered (901 in all).
- Verified: see Status (2026-11-19). Not verified: by hand, by ear, frame rate with traffic.

### 2026-11-18: the diner's flickering corner
- The user, after the fixes below ("All good"): one corner by the door kept flickering. The red dado on
  the right wall's lining had no thickness and fought the wall (see Gotchas); `Interiors.js` `shell`
  measures the dado and its rail from each wall's face, and the rail stops at the windows.
- Verified on 5180 by frame diffs with the camera moved 0.5 mm: that corner from two angles (the
  pier's band solid red before, steady after), the side wall and the back wall. Not verified: by hand.

### 2026-11-18: the diner and the store made playable
- The user: "I still can't do anything at Rosie's Diner... walking is sluggish... the objects outside
  the grocery store actually block the entrance... I can't press E. I can't even talk anymore"; the
  whispers and Rosie serving were good, and the store's bell worked.
- E: the `busy` guards removed (`Roam.js` sit, restroom, flat, sleep; `CityLife.talk`); seats' prompts
  from their approach (`Roam.blockRoam`); the menu's moved to the aisle (`Interiors.js`); overheard talk
  while he sits (`updateTalks`).
- Walking: the controller's retry (`Player.updateGround`, `floorOnly`); the propane cage off the store's
  door (`HalsBlock.js`); the shopper beside the shelf; people wait for Hal and ask to get by
  (`CityLife.inWay`, `excuse`, 11 lines rendered).
- The diner's pace: the counter's gate (`Interiors.js` `gate`, the counter in two runs; `HalsBlock.js`
  doors `staff`), Hal's order first (`DinerLife.js` `HURRY`, the ticket to the front, waiting at the
  pass, the nearer coffee).
- Verified: see Status (2026-11-18, the diner and the store made playable). Not verified: by hand at the
  real frame rate (the window wasn't in view, so no frames ran in real time), the new lines heard.

### 2026-11-18: the diner at work, whispers, changing out of sight, the diner made walkable
- The user, on the people: they meet the bar but "are not that intelligent... no one is serving them";
  whispers to hear; "Hal should not be allowed to change into Green Lantern if he's in someone's field
  of view"; the diner "very unplayable... unwalkable... flickering in the floor... stuck behind" the
  door; the waitress "just going back and forth... not someone that answers to you". "70% there."
- `story/DinerLife.js` (new: seats, routes, Rosie's tasks, Dot's kitchen, customers in and out, Hal's
  order, meals); `story/CityLife.js` rewritten (`go`, `hold`, `carry`, `put`, `carryPose`, `TALKS`,
  `murmur`, `playTalk`, `MURMUR`, `seenBy`, labels and tags); `Roam.js` (`watchers`, `refuseSeen`,
  `restroom`, the seen indicator, T / the car / off-Earth gated); `Voice.murmur`; `UI.overhear`,
  `watching`, `pick` (and `index.html`, `style.css`); `People.js` (`extraJaw`); `build-voices.mjs`
  (`whisperize`, style `'whisper'`); 68 lines (`lines.js`, rendered).
- The diner: `HalsBlock.js` (exact colliders, the door swinging away, `openers`), `Building.js` (the
  threshold, `openL`/`openR`), `Interiors.js` (fittings solid, linings round windows, the back bar in
  two runs at the pass, side booths back from the door with seats, the restroom spot, `satin`, the
  table's height, the room's measures).
- Verified: see Status (2026-11-18, the diner at work...). Not verified: by hand, by ear.

### 2026-11-18: people on Hal's block
- The user: "Yes, keep going" (after the interiors; the people were next in the plan). Their own leads
  needed a Sketchfab login (restore50) or were below the bar; Microsoft's Rocketbox library (MIT) was
  found as GLB on Hugging Face and checked in close-up first.
- `tools/build-people.mjs` (new, `npm run people`), 28 sources in `assets/people/` with the MIT licence,
  `public/models/people/`; `characters/People.js` (new); `story/CityLife.js` (new); `Interiors.js`
  (`ctx.posts`: Rosie, Dot, Ray, the shopper, the booths' far benches), `HalsBlock.js` (`posts` into the
  world; **the bus shelter turned along the kerb**, it had stood across the pavement), `Roam.js`
  (`CityLife` from `blockRoam`, seats `taken`, Rosie on `sit`, Ray on the bell), 64 lines and ten voices
  (`lines.js`, `build-voices.mjs`, `UI.js` speakers, `Story.js` mouth gains), `CREDITS.md` (and its
  generator) a People section, `tools/people-test.js`.
- Verified: see Status (2026-11-18, the block's people). Not verified: by hand, by ear, frame rate.

### 2026-11-18: rooms to walk into: Rosie's Diner, Coast Liquor, Hal's flat
- The user, approving the block: "Yes, interiors" (doors, the shops and the diner, Hal's flat).
- `city/Interiors.js` (new), `Building.js` (clear glass, `door()`, hollow colliders), `HalsBlock.js`
  (the rooms, doors, room lights, goods, the furniture's colliders and draw distances), `Kit.js`
  (`clearGlass`, `glow`), `Signs.js` (`goodsTexture`), `Roam.js` (`blockRoam`, `sit`, `jukebox`,
  `buildFlat`, `enterFlat`, `exitFlat`, `flatTime`, `sleep`; `PLACES.home`), `Ferris.js` (`day()`,
  `isNight`), `Bedroom.js` (`dayFill`), 11 props (`build-props.mjs`, credited), 8 lines (rendered).
- Verified on 5180, muted, by script: Hal walked in through Rosie's door (it swung open, he stands on
  the diner's floor); the diner and the store inside by day and night and from the street; sat at
  the counter and in a booth and got up; the jukebox; up to the flat, slept into the night (the flat
  and the town both night), out to the lot; the draw calls (the street 1,190, the diner 993, the store
  784); no console errors; a clean build. Not verified: walking it by hand (the door's swing against
  his capsule, the camera in the rooms), the jukebox and the bells by ear, the store's door.

### 2026-11-18: drawing by distance
- The user approved the block's design ("meets the bar, design wise"; the buildings aren't interactable
  yet) and asked that what's 200-300 m from Hal not be drawn.
- `city/Lod.js` (new: `Lod`, `mergeByMaterial`, `flatten`), `HalsBlock.js` (tiers, static props merged,
  the night kit off by day, the hip roof's tiles on their own key), `Building.js` (`roofTile`),
  `Ferris.js` (`lod` over the block and every Smash item by size, cars as merged copies, the jets).
- Verified on 5180 by script: draw calls and triangles in the block, mid-block, 230 m and 420 m off,
  from the air over the town and the field, on the apron, and back in the block (everything back, the
  same counts); captures at each; no errors; a clean build. Not verified: a car dented, then seen from
  past 15 m (the copy is remade, by the code path only); frame rate itself.

### 2026-11-18: Hal's block, the first piece of the open world's Coast City
- The user: "Start the block" (the plan agreed the same day). Their leads for people and buildings were
  evaluated (see *Working with this user*).
- `src/city/` (new: `Kit.js`, `Building.js`, `Signs.js`, `HalsBlock.js`), `Ferris.js` (`blockOn`, the
  stretch left to the block, the road's power poles there skipped, `night()`), 20 downloaded props
  (`build-props.mjs`: `pitch` for a model on its back; credited), nine Poly Haven surfaces
  (`fetch-textures.mjs` fetches only what's missing), `Coast.drive`'s town shot on the right lane.
- Verified: see Status (2026-11-18, Hal's block). Not verified: by hand, frame rate.

### 2026-11-18: Continue goes to the checkpoint played last
- The user: the title showed them stuck at Part One's "The ring's power" though they'd finished
  Part Six; they asked whether the cookies were saving. They were: the title's Continue only read
  Part One's store, which never got past `powers` (see Gotchas).
- `Save.js` (`playedAt`, `latestCheckpoint()`), `main.js` (`titleFlow`: Continue, Parts, Chapters,
  New game; old Part One saves moved on to `free`), `Story.ringTraining`'s end card saves `free`.
- Verified on 5180 with seeded saves (Part One at `powers`, its `savedAt` newest as a settings write
  leaves it, Parts Two to Six finished): Continue read "Part Six · Free roam" and started free roam;
  Parts listed all six; a Part One chapter played last took Continue; no saves, no Continue. A clean
  build. Not verified: the user's own browser's saves (each browser and address keeps its own).

### 2026-11-17: free roam everywhere, Hal or Green Lantern, his car; the Thunderers, the statue, Katma's hand
- The user, after playing Part Six: the flying Thunderers in A-poses and their weapons badly held;
  Katma's hand "still shaky" with the ring; the statue's fall "not very good" and its "weird hands";
  free roam not interactive (change into Hal, drive the car, "make keys with my ring... unless my
  lantern is depleted"), the recharge not working, the crash site unusable, no space travel outside
  missions ("I need you to imbibe that level of love for this game").
- **Free roam**: `story/Roam.js` (new; Exile's free roam moved there), `main.js` (Part Six is a
  `Roam`), `Coast.getIn({ spawn })`, `Story.toggleLantern` (one press brings it), `keyGeometry`
  (`Constructs.js`), the chart's Qward node and notes (`TravelHud.js`, `style.css`), the routes'
  ring lines (`Voyage.js`), 30 lines in `lines.js` (rendered).
- **Thunderers** (`enemies/Thunderers.js`): the winged one's poses and wing shader, the brute's flail
  pendulum, the archer's raised and drawn bow (his scan's sheet cut out, a built bow), the archer's
  rebuilt rig (`autorig.mjs` `arms` z, `build-assets.mjs`).
- **The statue**: `scenes/Statue.js` (new), `Korugar.js` (`statueTilt`, `statueFall`, `fallen`, `laid`,
  `statueSolid`, a rougher bronze cap), `Exile.pullStatue` on the fall's events, `fallenBlocks`.
- **Hands**: `Exile.steadyHand` for Katma's ring, oath and shield; `Mocap.smoothArms` for every idle.
- Verified: see Status (2026-11-17, free roam...). Not verified: real input, sound, frame rate.

### 2026-11-17: the rest of Part Six (her first night, Qward, the yellow light)
- The user, going to sleep: "Added assets for the thunderers... parallax we can hint in this part and
  release the model later, continue till you are done". Built on my default picks (see Open items).
- **Models**: `assets/raw/Thunderers.glb` (four figures) built as `thunder_archer`, `thunder_winged`,
  `thunder_brute`, `thunder_woman` (`build-assets.mjs`: `figure`, `headTop`, `GRID`, `DUMP`;
  `autorig.mjs`: `arms`, `bind`; the others' defaults unchanged).
- **Story**: `Exile.js` (`firstNight`, `pullStatue`, `lightChain`, `thunderWave`, `setupQward`,
  `enterQward`, `qward`, `forge`, `drainSuit`, `yellowLight`, `afraid`, `cage`, `sting`, `fearRing`,
  `fearGlow`, `parallaxShadow`; the trial's end card removed), `Save.js` (three checkpoints), 67 lines
  in `lines.js`, the `weaponer` voice (`build-voices.mjs`, `UI.js`), `qward` respelled.
- **Scenes**: `scenes/Qward.js` (new); `Korugar.js` (`night`, `statueTilt`, `statueFall`, `fallen`,
  `STONE_NIGHT`); skies `korugarNight`, `qward`.
- **Enemies and powers**: `enemies/Thunderers.js` (new); `Sinestro.js` (`turnYellow`, `fearJet`,
  `health`/`yieldAt`/`centre`); `Constructs.js` (`FEAR`, `fearLight`, `shapeOf`, the blade trail's colour);
  `Characters.js` (`yellowLantern`, `uYellow`); `Guardian.js` (`weaponer`, `uHairOn`);
  `Prisoner.addSinestroAt` options.
- Verified: see Status (2026-11-17, the rest of Part Six). Not verified: real input, sound, frame rate.

### 2026-11-17: Part Six fixes, Korugar as Times Square, its people, free roam
- The user's notes after playing Part Six: flicker in Sinestro's speech scene, his descent from the
  balcony, Katma's upright hand, Hal missing at the course lock, Sinestro's hands showing rings on
  every finger; Korugar should be "a New York Times Square, but for Sinestro" with NPCs to interact
  with; after Part Six the world opens with an indicator for Part Seven.
- **Fixes**: `Korugar.js` (anti-aliased windows, basalt columns, still wall banners, the oath lintel
  off its box), `Exile.js` (the descent's cubic, Katma's hand, Katma carried through the voyage),
  `Voyage.js` (the short trip's ring shot), `Characters.js` (`withoutScanRing`, a roughness floor),
  `Sinestro.js` (his ring light off outside fights), the braziers' and doorway lamp's reach.
- **Korugar**: `scenes/KorugarSigns.js` (new), `buildBroadcast`; `story/KorugarLife.js` (new), used in
  `Probation.patrol`; `Player.camIgnore`; 21 street lines.
- **Free roam**: `Exile.openWorld`, `travelMenu`, `goTo`, `partSeven`, `addTalker`; checkpoint `world`;
  `korugar>earth` in `Voyage.js`; lines `katmaW1-3`, `ringOrbitEarthFrom1417`.
- Verified: see Status (2026-11-17). Not verified: real input, frame rate, sound.

### 2026-11-16: Part Six, "Exile": coming back, bringing him in, the trial
- The user asked for suggestions for Part Six, then for the first three beats, built while they
  slept (tested muted).
- **Story**: `story/Exile.js` (new), 65 lines in `lines.js` (rendered), `Save.js` (`EXILE_CHECKPOINTS`,
  `ExileSave`, `partOf` over every part), `main.js` (Part Six on the title), Part Five's end card
  offering it.
- **Scenes**: `Korugar.js` (the palace's front, its openings and halls, the balcony, braziers,
  `FORECOURT`, `fillForecourt`, `instanceCrowd`); `Ferris.js` (`dawn()`, Hangar Two's back wall,
  office, sign, flag, lines, props, rougher floor); `Hall.js` (rougher floor and dais); the `dawn` sky.
- **Effects**: `Rift.js` palettes (antimatter), round stars; `Story.openRift` takes options.
- **Sinestro**: a roughness floor (0.58), his ring light off outside fights (`Sinestro.js`).
- Verified: see Status (2026-11-16). Not verified: real input, sound, frame rate.

### 2026-11-12: Hal stuck in the air after the raid
- The user: after the resistance chapter's drones, Hal "just keeps levitating" and the scene never
  came. The chapter took control and walked him to Katma, but a scripted walk only runs on the
  ground (see Gotchas). `Player.walkTo` drops out of flight; `Story.touchDown()` (new) lands him;
  `Probation.rebels` calls it after the raid (and cuts back to Katma if he's over the lane or on a
  wall) and on reaching the courtyard, and `patrol` after the staff drill.
- Verified: see Status (2026-11-12, landing after Korugar's fights). Not verified: real input; the
  other parts' fights (covered by `walkTo`'s fallback, not played).

### 2026-11-12: parking in his space, and the car's brakes
- The user: "can't get out of car after I park it in my spot". The parked test was centred 3 m
  from the painted bay (see Gotchas); it's on `HAL_BAY` now (`Ferris.js`), with a hint when he's
  stopped close but not in it (`Probation.commute`). The brakes were an impulse per step, so they
  were weak at low frame rates; they're forces now (`Drive.step`).
- Verified: see Status (2026-11-12, parking and brakes). Not verified: parking with a real keyboard.

### 2026-11-12: Part Five, "Probation"
- The user's outline (day-to-day life, then Korugar's fear, the report; Carol covering the rent and
  finding out; driving and flying playable; the flight suit designed by me; Katma from their scan),
  built overnight while they slept, tested muted.
- **Story**: `story/Probation.js` (new), lines in `lines.js` (119 voiced: new voices `katma`, `radio`,
  `caller`, `korugar`, `korugarf`, `guard`, `crowd` in `build-voices.mjs`, labels in `UI.js`),
  `Save.js` (`PROBATION_CHECKPOINTS`, `ProbationSave`), `main.js` (Part Five on the title), Part
  Four's end card offering it.
- **Vehicles**: `vehicles/Drive.js`, `vehicles/Jet.js`, `ui/VehicleHud.js` (all new), styles;
  `Physics.beforeStep`, `CameraDirector.up`, `Car.js` steering wheel on a pivot (`userData.steer`).
- **Characters**: `characters/FlightSuit.js` (new: the coverall and helmet), `createKatma`,
  `createKorugarian`, `JAW.katma`, `MOUTH_GAIN` for the new voices; models `katma.glb` and
  `kor_crowd.glb` (`build-assets.mjs`).
- **Scenes**: `scenes/Korugar.js` (new), the `korugar` sky, Korugar in `Space.js` and `Voyage.js`, the
  star chart's note; `Ferris.js` (the airspace, the road's ground, the boulevard's colliders, the
  car's box, `terrainAt`, `nearMax`); `Bedroom.setClock` AM by day.
- **Powers**: the staff (`staffGeometry`, `STAFF_SWINGS`, `SwordConstruct` by kind).
- **Audio**: `knock()`; `gl_mute` for silent testing.
- Verified: see Status (2026-11-12, Part Five). Not verified: real input, frame rate, sound.

### 2026-11-11: everything touchable, Hal's arm in the hall, the voyage's readout
- The user: parked cars by the building site Hal "can phase right through"; "every element should
  have some level of interactability... punch cars, destroy fences... GTA 5's level"; also Hal's hand
  left up in the hall "like he's asking a question", and the ring saying "course logged to Oa" on the
  way to Ysmault.
- **Props** (`props/Smash.js`, new; `Physics.js` contact-force events and a mass-capped `burst`;
  `RingPowers.js` `shove`, `hitWall`, the hook's and sword's prop sweeps, the gatling; `Audio.js`
  `crunch`, `glass`, `clatter`, `snap`, `alarm`): see *The world's props*.
- **Scenes**: `Site.js` (everything through `smash`; new cars, hydrants, bins, a dumpster, signs, a bus
  shelter; raised pavements; office6 swapped out of the two side slots, the third floodlight moved,
  the heap a triangle collider; beams about 140 kg), `Ferris.js` (the staff-lot and apartment-lot cars,
  the apron and hangar vehicles and kit, the cones, the apartment block, palms, power poles, the
  cemetery's trunks and bench), `Oa.js` (the crates), `Ysmault.js` (the buttes and rocks).
  Atrocitus charges through breakables and walks round moved props; spikes and blood mark props.
- **Fixes**: `Story.standDown()` in `trial()`; per-route ring lines (`Voyage.js`, five new lines
  rendered).
- Verified: see Status (2026-11-11, everything touchable). Not verified: real input, frame rate with
  fires, sounds by ear.

### 2026-11-11: block, then strike (the guard, parries, turned blows)
- The user: hooks spammed still won the boss fights, just at a cost in charge; they asked for
  "very limited reward" for spam and for blocking to pay, "block, and then attack rather than an
  all-out brawl".
- **The guard and the parry** (`RingPowers.js`: `updateGuard`, `guardHit`, `PARRY`, `PARRY_REST`,
  `HeldShield.fresh`, `parryFlash`; `Audio.js` `parry`, `turned`; `PowerHud.callout`, the bracket's
  open states, `style.css`): right click or F raises the shield whatever is armed; raised just in
  time it parries.
- **Sinestro** and **Atrocitus** (`stance`, `LANDS`, `answer`, `expose`, `openState`): between
  attacks they turn blows (0.15×) and answer them; a parry exposes them (1.35×); parried spikes,
  beams and blood go back into them; Atrocitus reels visibly and won't charge a held shield.
  Sinestro's guard no longer breaks to a hook (`breakGuard` gone); his blade is put away when a cut
  is cut short.
- **Fixed:** Atrocitus's charge passed through walls and the shield (its ray origin was a number,
  see Gotchas).
- Tutorials (`Story.js` the core breach step, `Corps.js` live fire and sparring, `Prisoner.js` the
  Atrocitus panel), key hints and `README.md`.
- Verified: see Status (2026-11-11, block then strike). Not verified: real input and sound.

### 2026-11-11: the hook, and bosses that read Hal
- The user: Atrocitus "keeps walking to his orb"; both boss fights beatable "with a mousepad while
  spamming gatling gun"; the AI should block spam and punish it, the gun usable only in small
  openings; the fist a big sideways AOE hook, 13% a use, a right and left combo; "something like
  Resident Evil, make the opponents more intelligent".
- **The hook** (`RingPowers.js` `HookStrike`, `hookFrame`, `throwHook`, the arc ghost; `Constructs.js`
  fist entry and `mirrorX`; hints in `Story.js` and `Corps.js`). `FistStrike` and `sweep` are gone.
- **Reading Hal**: `dealDamage(..., kind)`, `powers.cast()` / `watchers`, `healDelay` / `healRate`.
  Sinestro (`Sinestro.js`: guard on the gun's spin-up, armoured answers, openings, poise, dodges,
  ripostes, flanking a shield, `steady`; 520 health) and Atrocitus (`Atrocitus.js`: cover, armoured
  answers, openings, poise, braces, distraction by Sinestro, steering round blocks, beam fetching
  along the beam, gait from real movement; 900 health). Tutorial panels and lines for both
  (`Corps.duel`, `Prisoner.atroFight`); 10 new voiced lines.
- **His machine**: `WORK`, `SPIKE`, `Site.deviceBlock`, `atroWalk` stops when it can't progress, the
  drain's close-up moved clear of the spikes.
- Verified: see Status (2026-11-11, hooks and smarter bosses). Not verified: a person playing them.

### 2026-11-11: Part Four in the suit, and the fist hurting Atrocitus
- The user: at the lake and against Atrocitus, Hal was in his base form, flying but with no health
  bar, unable to fight. Played on from `pilot`, `prepare()` (where the suit went on) never ran for
  the later chapters. `Prisoner.lanternUp()` now starts `cell`, `site`, `ysmault` and `trial` (and
  `prepare()` uses it). Also found: Atrocitus's kinematic body wasn't in `physics.dynamics`, so the
  fist and the hammer did him no damage (`Atrocitus.js` adds it, and `dispose()` takes it out).
- Verified: see Status (2026-11-11, the suit in Part Four). Not verified: `ysmault` and `trial`
  played into since the change (the suit was already on from the site's recharge), the hammer on
  the excavator again with Atrocitus's body in the list (his `hit` deals nothing outside the fight),
  real input.

### 2026-11-11: Part Four, "The Prisoner"
- **Story** (`story/Prisoner.js`, new; `lines.js`; `Save.js` `PrisonerSave`, `PRISONER_CHECKPOINTS`;
  `main.js` the title's fourth part; Part Three's end card offers it): `pilot`, `cell`, `site`,
  `ysmault`, `trial`. See *What this is*. The user chose Secret Origin's second half and made
  Atrocitus in Tripo (a Kilowog-derived stand-in was dropped when the scan arrived).
- **Atrocitus**: `assets/raw/Atrocitus.glb` built (new `autorig.mjs` options `armMaxY`, `elbowK`,
  `wristK`), `createAtrocitus`, `JAW.atrocitus`, `enemies/Atrocitus.js`, voice `atrocitus`.
- **The hammer** (`hammerGeometry`, `HAMMER` in `Constructs.js`; `HammerStrike`, `hammerFrame`,
  `smash`, `impact()` options in `RingPowers.js`).
- **Sinestro beside Hal**: `Sinestro.ally`, `thinkAlly`, `aimAt`.
- **Scenes**: `scenes/Site.js` and `scenes/Ysmault.js` (new), Ysmault in `Space.js`, routes in
  `Voyage.js`, a `ysmault` sky.
- **Props** (CC BY, credited): `excavator`, `girders`, `crane`, `chainlink`, `container`, `barriers`,
  `roadclosed`, `mixer`, `pipe`, `bricks`, `portapotty`, `pipepallets`, `cliff`, `obelisks`, `chain`,
  `shackles`, `rocks`. A helper agent searched Objaverse and reported licences from the API pages.
- Verified: see Status (2026-11-11, Part Four). Not verified: a real-input playthrough with sound.

### 2026-11-11: finding Martin Jordan's grave
- The user couldn't find it: the stone stood between the rows among about 120 others, with no
  marker, and E only worked within 1.8 m of one spot behind it. `GRAVE` moved to the far end of the
  central path, past the rows, its two cypresses behind it (one had stood on the path) and the
  bench beside it; a marker on it with the distance (`grave()` draws it with `hud.setMarker`, as the
  ring's HUD is off), the objective says where, Hal's thought `halGraveWay` (voiced), E within 4.6 m
  (from the path beside it), and Hal walks round to the stone's front.
- Verified: the marker through the gate, the prompt from the path, the walk round, the kneel, his
  father forming clear of the trees. Not verified: real input.

### 2026-11-11: Part Three's ending, from Secret Origin
- **Story** (`Coast.js`, `lines.js`, `Save.js`): new checkpoints `wreck`, `test`, `catch`, `hector`,
  `grave` after `after` (which now ends with Tom's call, not the end card); see *What this is*. The
  user chose comic beats (*Secret Origin*), no yellow weakness, no Jim, Carol rehiring him in Part
  Four, and made Hector in Tripo.
- **Hector Hammond**: `assets/raw/Hector.glb` built (`build-assets.mjs` entry), `createHammond`
  (the swelling head: a second pass scales the whole head, face included, after the user said the
  first grew only his brain), `enemies/Hammond.js` (the fight), voice `hammond`.
- **The catch**: `handGeometry` (`Constructs.js`), the jet's flight (`jetAt`), the carry, the set-down;
  `Ferris.freeJet/parkJet/gear/airBounds`, the height-scaled near plane; `player.boostScale`.
- **Sinestro on Earth**: the `Sinestro` class dropped into Ferris for a scripted entrance.
- **The grave**: `Ferris.dusk()`, `Ferris.cemetery()`, the `dusk` sky, `createLightFigure`.
- **Props** (CC BY, credited): `m35`, `lighttower`, `tombstones`, `cemgate`, `ironfence`, `cypress`,
  `bench`. Sounds: `jetEngine`, `flameout`, `strain`, `psychic`, `rumble`, `siren`. Voices: `pilot`,
  `tech`, `tech2`, `hammond`; 58 lines rendered.
- Verified: see Status (2026-11-11, Part Three's ending). Not verified: a real-input playthrough
  with sound.

### 2026-11-11: the drive without collisions, and cars that steer
- The user: bins on the road the car drove through, parking through other cars, and the car
  swinging to a new direction instead of turning. Fixed:
  - `Car.js`: `planDrive`, `timeLeg`, `rollCar`; `axle` and steered `front` wheels in `makeCar`.
  - `Coast.drive`: backing out of the bay (1 m back, 1.7 rad on 5.2 m, straightened), a stop,
    forward round onto the boulevard's lane; at Ferris, braking for the gate and round into the
    staff lot's aisle, nose first into the bay, with `Coast.roll()`. New cameras: the gate's moved
    clear of the booth, the lot shot from above the bay, and the back-out a cut (the old crane move
    passed through the car).
  - `Ferris.js`: the bins on the pavement; the palms one tree at a time on their trunks (`PALMS`);
    the street kit on its own bases (`piece` `root`, `Props.js`); the staff lot's car at x 6 moved to
    x 15 to clear the aisle's mouth.
- Verified: see Status (2026-11-11). Not verified: real time with sound.

### 2026-11-10: Coast City's flickering ground, and getting into the car
- **The flicker on the roads and lots** (the user: "where the car is traveling on road, where Hal
  is going to his car, where Hal is going to Carol"): ground planes of two triangles kilometres
  across lost their depth at the near plane, and the desert swapped with the asphalt over it
  (see Gotchas). `Ferris.js`: ground cut into tiles (`flat()`), near plane 0.1, the cross street
  lifted off the boulevard (1 mm apart), the painted lines higher; `Bedroom.js`'s street view
  tiled the same way. Also: the sun's shadow box moves in whole texels (`focus`), holds still in
  the boulevard and gate shots (`shadowSpan`) and follows Hal on foot (`follow`, `Coast.ferris`);
  the palms' fronds and the gate's fence are cut-outs with alpha to coverage (`Props.js`).
- **Getting into the car** (the user: "comedic... like a standing cylinder"): nothing ran the
  animator once Hal left the player's update, so the old `getIn` slid his frozen standing body
  into the seat. Rewritten as a keyed leg-first entry (`keyed()`, leg IK in `animator.post`,
  `Coast.getIn`); see *What this is* and the seated poses note. The driving pose sits lower and
  more reclined: his head was through the roof.
- Verified: see Status (2026-11-10, Coast City flicker...). Not verified: real time at full frame
  rate, a real-input playthrough.

### 2026-11-10: the range's flickering floor, and live fire after the targets
- **The targets drill never led on to live fire** when played on from the voyage (`Corps.targets`
  read `this.swarm` before building the range; see Gotchas). Fixed, and `main.js` now catches a
  step that throws and offers to restart the checkpoint (it also no longer throws itself once the
  loading screen is gone).
- **The deck flickered** (`Oa.js`): its glowing lines came from a transparent canvas, uploaded
  un-premultiplied, so they were hard, stair-stepped and crawled as the camera moved. The lines are
  now drawn in the deck's shader (`deckGlow`), the same layout as before. The hall floor (`Hall.js`)
  had the same canvas: its glow is now painted on black (`lit()`), and the dais emblem has a polygon
  offset (4 mm over the dais was inside a depth step from the range).
- Verified: see Status (2026-11-10, range fixes). Not verified: a real-input playthrough.

### 2026-11-10: the hang at the first voice line
- The game froze on Hal's first line of a new game (and on any line without a word listener):
  an endless loop in `Voice.play`'s word timing (see Gotchas). Fixed; found with localStorage
  breadcrumbs. Also in `Voice.js`: a paused line now holds (`held`) and resumes where it was
  (it used to end during the pause, and an audio context's slow `resume()` ended it at once);
  wall time stands in for the audio clock only before the context has ever run.
- Verified in the browser, voices on, in real time: a new game through Hal's first two lines to
  control (the jaw moving, no errors); the light chapter through to the question; a line paused
  for 4 s finishing on time after resume. The user confirmed the new game plays.

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
