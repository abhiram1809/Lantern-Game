# Green Lantern — Awakening · The Corps · Coast City · The Prisoner · Probation · Exile

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
Lantern: Secret Origin*.) **Part Five, Probation:** Hal still owes the rent; he drives himself to
work, Carol pays his landlord against his probation hours, and he flies the prototype's test card
himself. At dusk Sinestro comes down on the apron to collect him for field training, in front of
Carol, who finds out who he is. On Korugar the crowds cheer Sinestro, and the ring hears what they
mutter once he has passed: they are afraid. Katma Tui and the resistance show Hal the cells barred
with Sinestro's light; Hal takes their side against his drones and takes what he has seen to the
Guardians. (After *Emerald Dawn II* and what Geoff Johns kept of it.) **Part Six, Exile:** first
light at Ferris, where Carol has waited all night; on Korugar, Sinestro won't answer the Guardians, so
Hal comes to his palace for him; at his trial on Oa his ring is taken, he is banished through a rift
into the antimatter universe, Qward, and the ring chooses Katma Tui. That night on Korugar she speaks
the oath and the two of them pull his statue down; Qward's Thunderers come through the sky after the
ring, and Hal follows them back into the dark, where the Weaponers give Sinestro the yellow ring.
He returns to Korugar as the Yellow Lantern and asks Hal the question the light asked him on his
first night: are you afraid? Then free roam: everywhere the story has been, Earth's valley and the
lake, Oa, Korugar, Ysmault and Qward, by the ring's star chart; Hal in the suit or in his clothes,
with his car (and a ring-made key); Part Seven's marker on Hangar Two.

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
| Left click | Use the armed construct: a hook with the fist (click again straight away for the left), place a wall, cut with the sword (click in rhythm for a three-cut combo); hold to keep the shield up or to fire the gatling |
| Right click or F (hold) | Guard: the shield comes up whatever is armed, and goes down when you let go. Raised just as a blow lands, it **parries**. A left click behind it drops it and strikes |
| Scroll | Change the construct's range |
| Q | Holster the construct |
| Space twice | Take off / drop out of flight (there is no jump) |
| W / Space / C / Shift (flying) | Fly where you look / climb / descend / boost |
| L | Keep the lantern in the ring's pocket dimension, or set it down in front of you |

**Driving** (Part Five's commute):

| Key | Action |
| --- | --- |
| W / S | Accelerate / brake, then reverse once stopped |
| A / D | Steer (full lock when slow, a little at speed) |
| Space | Handbrake |
| C | View: behind the car, or first person from Hal's seat |
| Mouse | Look round (the camera settles back behind the car) |

**Flying the prototype** (Part Five's test flight): the mouse points where to go and the jet rolls
and pulls to get there (on approach, with the gear down, it flies the path to where you point):

| Key | Action |
| --- | --- |
| Mouse | Point where to fly |
| W / S | Throttle up / down (past 100% is afterburner) |
| A / D | Roll |
| Q / E | Rudder |
| G | Landing gear |
| B | Wheel brakes (airbrake in the air) |
| C | View: chase, or the cockpit with its head-up display |

The test card is on screen: take off and raise the gear, climb to 12,000 ft, hold a 5 g turn, go
supersonic (Mach 1.2), make a low pass over the tower, and land on runway 27 and stop. Too much g
greys out the edges of the view. A crash restarts the flight.

**Fighting someone who thinks** (Sinestro, Atrocitus) is block, then strike. Between their attacks
their guard is up: punches are turned (a sliver gets through) and answered, and the gatling is
stopped. A parry (the guard raised in the half second before a blow lands) throws them wide open
for a moment: the target bracket turns gold and says OPEN, and blows land harder. A plain block
opens them less, and a lesser blow gets through while they're in the middle of an attack. Mashing
the guard doesn't parry; hiding behind it, they work round it or come over it.

While the shield, the gatling or the sword is up, Hal faces where you look and strafes: W/S/A/D move him
relative to the camera (S backs him off) without turning him away from your aim. Flying with
one, he hovers upright and faces where you look instead of flying head-first.

The ring's HUD shows Hal's health (bottom left) and the ring's charge with the armed construct
(bottom right). Constructs and flight use charge; recharge at the lantern (on Oa the Central
Power Battery recharges the ring continuously). As in the comics, the lantern lives in the ring's
pocket dimension: press **L** and a rift opens to swallow it, press **L** again and it drops out
in front of you. Beside it, **E** recharges the ring (or puts it away when the ring is full).

**Free roam** (after Part Six):

| Key | Action |
| --- | --- |
| E (flying high) | The star chart: Earth, Oa, Korugar, Ysmault, or Qward through a breach |
| M | The ring's travel menu: every place by name (Coast City, Ferris, the lake, Oa, Korugar, Ysmault, Qward) |
| T | Change: Green Lantern to Hal Jordan, or back (the suit needs a little charge) |
| E (at the car's door) | Hal makes a key with the ring and gets in (in the suit, he changes first); with the ring out of charge, the key won't form |
| E (stopped, driving) | Get out; the car stays where you left it |

**Hyperspace travel** (Part Two, from Kilowog's range on): fly high (about 30 m) and press **E**.
The ring's star chart opens (time stops); choose a charted world with the mouse or the arrow keys
and press **E** or **Enter**. Earth and Oa are charted; Korugar, Ysmault and Mogo are on the chart
but uncharted until the story reaches them. Fire and drone bolts hurt; health comes back if
Hal stays out of harm for a few seconds. Aim near an enemy and the reticle locks on: brackets
and a health bar mark it, and hits pop damage numbers.

## Checkpoints and saving

Progress saves automatically at each checkpoint, to `localStorage` with a cookie mirror as a
fallback. Each part has its own save (`gl_awakening_v1`, `gl_corps_v1`, `gl_coast_v1`,
`gl_prisoner_v1`, `gl_probation_v1`, `gl_exile_v1`); constructs
learned in any carry over. The title screen offers **Continue**, **New game** and **Chapters** (any
checkpoint reached so far), **Part Two: The Corps** once Part One is finished, and **Part Three:
Coast City** once Part Two is, **Part Four: The Prisoner** once Part Three is, **Part Five:
Probation** once Part Four is, and **Part Six: Exile** once Part Five is (each part's end card
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

Part Five:

| Checkpoint | Where it puts you |
| --- | --- |
| `rent` | The rent: the apartment at 7:10 AM, the radio on, Sal at the door |
| `commute` | The drive in: behind his building, at his car (you drive) |
| `advance` | An advance: by his car at Ferris, Carol on the apron |
| `testflight` | First shift: the walk out to the prototype, then the test flight (you fly) |
| `pickup` | Field training: dusk on the apron with Carol, then Sinestro |
| `korugar` | Korugar: the voyage from Earth, then the plaza |
| `patrol` | Order: in the plaza with Sinestro (the staff), then the market |
| `rebels` | The resistance: the old quarter, Katma Tui, the cells, the drones |
| `report` | The report: Sinestro in the courtyard, then the Guardians on Oa (the end card) |

Part Six:

| Checkpoint | Where it puts you |
| --- | --- |
| `dawn` | Coming back: flying in over Ferris at first light, to Hangar Two |
| `palace` | Bringing him in: the voyage to Korugar, then the palace forecourt |
| `tribunal` | The trial: the Hall of the Guardians |
| `firstnight` | Her first night: Korugar's plaza at night, Katma's oath, the statue, the Thunderers |
| `qward` | Qward: through the breach, the Thunderers on the way, the Weaponers' forge |
| `yellow` | The yellow light: Sinestro back on Korugar, the fight (the end card) |
| `world` | Free roam: at Ferris in the suit; **E** high in flight for the star chart, **M** for the travel menu, **T** to change |

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
   knock a burning hull plate away with a hook of light, raise a shield (hold right click or F)
   as the wreck's power core blows and hurls burning debris at you, raise a wall, then double-tap Space to fly above the
   treeline and land. After the end card you can keep exploring as Green Lantern.

Constructs: **Fist** (attack, 3 to 12 m: a giant fist swung in a hook through where you aim,
hitting everything in its arc; click again for the left hook, which hits harder; 13% of the charge
a hook), **Shield** (defense, held; also the guard on right click or F, and a parry when raised
just in time), **Wall** (defense, placed
where you aim, stands 20 s), **Gatling** (attack, learned from Kilowog: hold to spin up and fire,
45 m) and **Sword** (attack, learned from Sinestro: cuts in a three-cut combo, and lunges at a
target you aim at) and **Hammer** (attack, learned in Part Four: brought down on where you aim,
the hardest blow the ring has, 16 m) and **Staff** (attack, learned from Sinestro on Korugar: a
quarterstaff of light in both hands, wide sweeps that knock people back without cutting them).
The axe is on the wheel but locked for later. Every construct is
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
7. **Sparring:** Sinestro fights you in the air, and it's block, then strike. Read his tells: a
   raised blade means a lunge, spikes forming behind him mean a volley, a ring on the ground means
   a giant fist is coming down. Raise your guard as his blade comes in (or meet it with a sword
   cut) to parry, and he's wide open; parry the volley and the spikes fly back into him. Between
   attacks his guard is up: hooks and cuts are turned and answered with a lunge or a volley, the
   gatling is stopped, and he slips hooks thrown over and over. Hide behind the shield and he
   works round it. Your health comes back slowly. Bring him to the mark on his health bar and he
   calls it.
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
   first; a **wall** in his way and he runs into it and reels; your **shield** stops him, and
   raised just as he hits, it parries and he's wide open), **throws steel beams** from the lot,
   **flings burning blood** that sets the ground alight (parry either and it goes back into him),
   and close in **slams the ground** (fly over the shockwave). Between his attacks his gauntlets
   are up: hooks are turned and answered, and the gatling rings off them. Hit him when he's open:
   after a parry or a block, a beam held overhead, his blood drawn, the slam. Hide behind the
   shield and he walks in under it and slams. When Sinestro's spikes turn him, his side is open. At 60% he puts his
   hands on his machine and both rings go dark; Hal's suit goes with the light. **L** calls the
   lantern out of the pocket dimension, **E** at it to say the oath and charge the ring. Atrocitus
   has the excavator's bucket raised over Sinestro: the ring gives you the **hammer**, and three
   blows break the machine apart before the bucket comes down. Sinestro binds him. His machine is
   gone.
4. **Ysmault:** Sector 666, a dead world under a red sun. Atrocitus chained at his obelisk, and his
   prophecy: the Blackest Night is coming. And for Sinestro, Korugar in chaos and a rage like his own.
5. **The verdict:** the Guardians on Oa. A Lantern keeps to his own sector; the charge is set aside.
   Sinestro will train Hal in the field: next time, on Korugar.

### Part Five: Probation

1. **The rent:** Tuesday, 7:10. The radio is full of the man in green who caught a jet with his
   hand. Sal Delgado bangs on the door: two months, by Friday. Optional: coffee, the photo, the
   window, the radio off. Leave for work.
2. **The drive in:** his car starts first time, for once, and **you drive it**: back out of the bay,
   down the boulevard and out of town (everything along it is solid; lamps and signals snap,
   parked cars dent), then the last stretch of the desert road, the gate, and park in his space.
   **C** switches between the chase view and his seat.
3. **An advance:** Carol on the apron. She pays Sal herself, and his probation pays her back: every
   hour he flies for her until it's paid, he flies for free. Then the test card.
4. **First shift:** in the flight suit, out to the prototype at the runway's end, and **you fly
   it**: take off, gear up, climb to 12,000 ft, a 5 g turn, Mach 1.2 over the range, a low pass over
   the tower (Carol: "Jordan!"), and home on runway 27. The desert reaches the horizon from up
   there; Coast City and the Pacific are to the west.
5. **Field training:** dusk on the apron. Good enough for dinner? She doesn't date employees, but she
   would have dinner with the man on her runway. Then Sinestro comes down out of the sky for him,
   and Hal has to put the suit on in front of her. It was him. She puts her hand on his chest: go,
   and come back.
6. **Korugar:** Sector 1417. A plaza packed round a colossal Sinestro in stone, the crowd chanting his
   name; Sinestro at its feet. Seven years without a murder.
7. **Order:** Sinestro teaches the **staff** (sweep the training drones down), then sends Hal
   through his market. Speak to four people: each praises Sinestro to his face, and the ring
   hears what they mutter after (it's fear). They step back from the ring as he passes. A guard
   takes a man for laughing; Sinestro's light lifts him away to the cells.
8. **The resistance:** a hooded figure leads Hal into a courtyard in the old quarter: Katma Tui and
   what's left of the resistance. She shows him the Halls of Correction, the cells barred with
   Sinestro's light. Then his security drones come over the wall: protect them.
9. **The report:** Sinestro comes down into the courtyard. Fear is order; that's a cage. Hal flies
   to Oa and tells the Guardians. A Lantern may not rule: bring Sinestro to Oa. (Part Five's end.)

### Part Six: Exile

1. **Coming back:** Wednesday, 5:48 AM. Hal flies in over the desert and lands at Hangar Two, where
   the work lights are still on; the suit goes. Carol has been there all night. The runway, the
   jet, Hector: him and a ring. Korugar, and who he told. She grew up watching people wait for
   pilots and swore she'd never be one; they'll talk about the rest when he's back. The ring: the
   Guardians want Sinestro brought in. He suits up on the apron in front of her and flies.
2. **Bringing him in:** Korugar's Palace of Order, its forecourt packed below his balcony; he is
   telling them what Oa wants of him. Land in the lane through the crowd. He refuses; Katma Tui
   steps out of the crowd and calls him afraid of a summons in front of his city, and he comes down
   and goes of his own accord. She can't fly: Hal carries her in a sphere of light.
3. **The trial:** the Hall of the Guardians. The charge; Sinestro's defence (no war, no hunger, no
   murder); Hal's and Katma's testimony. A Lantern may not rule: his ring is taken, and he is
   banished through a rift into the antimatter universe, to Qward. The ring chooses Katma Tui, and
   Sector 1417 is hers.
4. **Her first night:** Korugar after dark, the plaza full and quiet. Katma speaks the oath under his
   statue; Hal shows her a first construct ("think about what it's for"). The people want him down:
   **hold the click** to pull with her, on chains of light, until he tips on his toes and goes: the
   ankles crack, the chains drag him off his plinth, and he comes down face first on the plaza, his
   head breaking off and rolling away, his feet left standing on the pedestal. Then the sky
   tears: Qward's Thunderers come through after the ring. Each kind shows you its attack first: the
   brute whirls his flail over his head (its chain swings free), the caster lights a bolt in her hand
   (parried, it flies back), the archer turns side-on, raises his bow and draws (the arrow's head
   glints), the winged one shrieks and rises, wings beating, before it dives with them folded back.
   When they're beaten, fly into the breach.
5. **Qward:** the antimatter universe, a plain of black glass under a dead sun. Follow the yellow
   light north past the Thunderers' archers on their pillars to the Weaponers' forge, where they give
   Sinestro the yellow ring and he takes the colour of fear. He knocks Hal down and goes up the
   forge's column into a breach of his own: follow him.
6. **The yellow light:** Korugar, an hour on. Sinestro strikes Katma down. His fight is the one you
   learned on the range, in yellow: block, then strike; and his fear made into light, the F-104 that
   killed Hal's father, diving at you through a ring marked on the ground. Halfway he cages Hal and
   asks: **are you afraid?** This time **yes** is the answer that wins. Beaten, he tears his way back
   into the dark; on Oa, something stirs inside the Central Power Battery. The end card offers free
   roam.
7. **Free roam:** the end card offers it. Everywhere the story has been is open. Fly high and press
   **E** for the star chart (the voyage to Oa, Korugar or Ysmault, or a breach into Qward), or press
   **M** for the ring's travel menu. On Earth: the valley from Ferris Aircraft to Coast City (fly it, or
   drive it), and the lake where Abin Sur's ship came down. Press **T** to change: out of the suit into
   Hal's clothes (no flying, no constructs), or back. Hal's car is in his space by the hangars: at the
   driver's door the ring makes him a key (unless it's out of charge), and he drives it anywhere on the
   valley floor and gets out where he stops. The lantern (**L**) comes to him on any world; from low
   charge, recharging is the whole oath. On Oa, Kilowog has another round and the Guardians speak to
   him in their hall; on Korugar, Sinestro's Times Square, its people walk the streets (**E** beside
   one talks), his statue lies where they pulled it down, Katma Tui keeps the city; on Ysmault,
   Atrocitus talks from his chains; on Qward, **E** in the circle calls the Thunderers, wave after wave.
   Part Seven starts with Carol, at Hangar Two (marked on the HUD).
   **Hal's block** in Coast City, his street from his building's lot to the cross street, is the first
   piece of the open-world city: seventeen shops and flats (the laundromat with the "Greetings from Coast
   City" mural, Ortega's barber shop, Coast Liquor, Mendoza's taqueria, the savings and loan, Rosie's diner,
   Sunny's Donuts, the Hotel Marisol, and more), windows with rooms behind them, parked cars and meters,
   palms and street lamps, the alleys behind; everything on it can be knocked about, and it lights up at
   night. Walk into **Rosie's Diner** (sit at the counter or in a booth with **E**, put
   a coin in the jukebox) or **Coast Liquor**; the doors open as you walk up. Hal's own front door, on
   the lot, takes him up to his flat: the fridge, the coffee, the window, and the bed, where sleeping
   turns the town from day to night or back.
   **People live on it**: Rosie runs the diner (she takes orders, Dot cooks them, Rosie brings the plates
   out, clears the tables and tops up the coffee; customers come in off the street, eat, pay and go),
   Ray works the liquor store's register (ring his bell), walkers go up and down both pavements, a mother
   and her kids wait at the bus stop, a man talks on his phone, friends chat outside Sunny's. Sit
   anywhere in Rosie's and she comes to take your order (**1**, **2** or **3**: coffee, the patty melt and
   the cherry pie, or nothing), brings it, and Hal eats. Press **E** beside anyone to talk; Rosie talks
   back. Walk near people and you'll overhear them, out loud or whispering about Hal Jordan, or about
   Green Lantern. Fly low over them and they look up and point; make a construct near them and they run.
   By night the street empties out.
   **Your secret**: on Earth Hal can only change (**T**) where nobody can see him; the HUD says "SEEN" or
   "OUT OF SIGHT". Try an alley, a roof, his flat, or the diner's restroom.

## Characters and movement

- **Models.** `npm run assets` (`tools/build-assets.mjs`) turns the Tripo scans in `assets/raw`
  (`Hal-Improved.glb` casual, `hal_b.glb` suit, `Abin.glb`, `Kilowog.glb`, `Carol.glb`, `Hector.glb`, `Atrocitus.glb`, `Katma-tui.glb`, and `Thunderers.glb`, a sheet of four figures built as four models) into `public/models/*.glb`: reoriented,
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
  [CREDITS.md](CREDITS.md). Coast City's people are from Microsoft's
  [Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox) (MIT), on the game's own
  skeleton (`npm run people`, `tools/build-people.mjs`). Surfaces (corrugated iron, concrete, asphalt, sand, plaster) are CC0
  textures from [Poly Haven](https://polyhaven.com). `npm run props` (`tools/build-props.mjs`) builds them from
  `assets/props/` into `public/models/props/` (turned to face +Z, scaled to metres, textures to WebP).
- **Everything can be touched** (`src/props/Smash.js`): buildings, columns and rocks are solid
  (you walk into them, a hook stops against them in a burst of dust); crates, bins, barriers,
  porta-potties, pipes, containers and the floodlight towers are physics bodies with their real
  weight; fence panels tear loose, street lamps snap and go dark, hydrants shear off and spout; and
  cars dent where they're hit, lose their windows, set off their alarms, smoke, catch fire and blow
  up, throwing and burning what's next to them. Anything thrown into them counts too: Atrocitus's
  beams, a car flung into a lamp post, Atrocitus charging through a fence.
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
                            (downtown at night, the building site), Ysmault (the prison world), Korugar (+ KorugarSigns:
                            Sinestro's capital, by day or night; Statue: his statue in stone, and its fall), Qward
                            (the antimatter world, the Weaponers' forge)
src/props/                  Props (loading the downloaded models), Car (paint, wheels, the driver's door,
                            seat, pedals and rim points for Hal)
src/enemies/                Drones (Part Two's training drones: AI, physics, bolts), Sinestro (the sparring duel,
                            or fighting beside Hal, or as the Yellow Lantern), Hammond (Hector at Ferris), Atrocitus
                            (the fight downtown), Thunderers (Qward's soldiers: brute, caster, archer, winged)
src/fx/                     sky, particles + fire, water, trees, green light / bubble / shafts, cloth, textures,
                            Rift (the pocket dimension), EarthMap (continents and city lights for Space)
src/city/                   Coast City's building kit and Hal's block (materials, windows with rooms, signs, the street)
src/story/                  Story (Part One + the shared chapter plumbing, the lantern's pocket dimension),
                            Corps (Part Two, travel), Coast (Part Three), Prisoner (Part Four), Probation
                            (Part Five), Exile (Part Six), Roam (free roam after it: travel, Hal or Green
                            Lantern, his car), Voyage (flights between worlds), lines (all dialogue)
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
