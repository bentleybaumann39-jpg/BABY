# LANDFALL: QA Report

All runs used headless Chromium on SwiftShader (no GPU), at `q=low`, driven with a fixed 1/30 s timestep. Absolute frame rates in this environment say nothing about real hardware.

## Rivals, Cataclysm, chain and cinematics

**Rival fight** (`play.mjs rival`, Clash mission). A rival loads in the background and arrives in a 3.4 s cinematic, which locks the controls and moves the building cutaway onto it. It then hunts the player.

| Player | Rival | Rival health (tier 1) | Rival's power on the player |
|---|---|---|---|
| Infernal Razormaw | Titan Hollowstrider | 3,309 under the earlier flat multiplier | Spore spray: about 190 damage at 300 m |
| Void Gravemaw | Glacial Razormaw | 2,520 behind 40% armour (effective health 4,200, the final balance) | Breath beam stopped on the player: 267 damage |

Both rivals closed in and used their moves and powers. Forcing the rival to 30% health set off its enrage: a roar, a shock ring, a surge and the HUD's ENRAGED state. Its death:
- slowed time to 0.25
- played the finisher cinematic
- counted the kill
- paid the bounty and +$3B to the chain, which reached DEVASTATING

A mission without `every` sends exactly one rival.

**Cataclysm** (`play.mjs cataclysm`, downtown Metro Bay at dusk, surged Infernal Razormaw):
- one blast broke about 8,000 chunks and did $45.9B of damage, collapsing 35 towers
- the chain reached EXTINCTION EVENT
- the military within 1.1 km was destroyed
- 1.5 s of game time around the blast cost 213 ms of script time, with the worst frame at 66 ms, during the slow motion
- the mushroom cloud is visible over the skyline from 1.3 km
- the surge meter stays locked for 12 s afterwards

**Menus** (`tests/ui.mjs`): passed again with the new settings row and the 8-cell results, with 0 errors.

## Mutation

**Strains on the lab stage** (`tests/forms.mjs`). Every strain was rendered on Razormaw from the front and the back, and on Carapex and Nyxwing for the six-legged and winged bodies. Hide, seams, glow recolour, growths and aura all appear, with 0 errors. Growths stay on the back, spine and tail of every body type, and never on wings, jaws or hands.

**Surge** (`play.mjs surge`, Infernal Razormaw with Barbed Hide, Echo Chamber and Volatile Blood). Pressing T with a full meter:
- scales the kaiju from 1.55 to 1.78
- raises melee from 384 to 538 and armour from 0.30 to 0.45
- sets 491 building chunks burning through the Infernal element
- drains the meter over 18 s, after which every stat and the scale return exactly to base

**Elements and genes** (`play.mjs elements`, with tanks and gunships spawned at the kaiju).

| Strain | Genes | Result |
|---|---|---|
| Glacial | Volatile Blood, Echo Chamber, Gigantism | Froze 6 of 6 units; frozen gunships sank from 60 m to 33 m. The echo roar raised suppression to 8 s. Scale was 1.76. |
| Venom | Reservoir Lungs, Hyper-Regeneration, Seismic Tread | 6 acid patches killed 4 units. Energy 140, regeneration 21.6. |
| Void | Feeding Frenzy, Adrenal Gland, Barbed Hide | 6 rifts killed 6 units |
| Titan | none | Scale 1.84 (×1.15) |
| Infernal | Volatile Blood | Vented once it had taken more than 10% of maximum health |

**Menus** (`tests/ui.mjs`, run against both `index.html` and the built `Landfall.html`):
- previewed Glacial on Carapex
- mutated it to Infernal (−1,500)
- bought and slotted Barbed Hide and Echo Chamber (−2,100)
- deployed: the save state and the session's mutation matched

There were 0 console errors.

## Alien roster: `tests/play.mjs ... probe`

The probe stands each kaiju in front of an intact 65 m building and fires every move in turn. It records:
- where the striking bones are mid-window, in metres in front of the body and above the ground
- the damage each move deals, in millions of dollars
- the special, then the stomp

Moves run one after another, so later moves hit a building that earlier ones have already damaged.

| Kaiju | Attack 1 | Attack 2 | Heavy | Special | Stomp |
|---|---|---|---|---|---|
| Razormaw | Talon Rake 41 | Backhand Rake 97 | Hammerfall 407 | Plasma Breath: beam fires, ≈ 400/s | Quake Stomp ✔ |
| Harrowblade | Blade Cleave 95 | Raptor Claw 12 | Fin Scythe 218 | Blade Charge: 5 s sprint, ≈ 1,400 | Pounce ✔ (see the note below) |
| Hollowstrider | Impaler 68 (reach 67 m) | Maw Lunge 71 | Fork Lash 153 (tail tip 94 m high) | Spore Torrent ≈ 3,900 | Pillar Slam ✔ |
| Nyxwing | Lance Strike 127 | Wing Buffet 95 | Spade Lash 194 | Acid Volley: 2 globs/s, ≈ 1,800 | Wingbeat Leap, apex 55 m ✔ |
| Gravemaw | Siege Fist 83 | Hammerhead Ram 5 | Twin Pound 383 | Dread Pulse ≈ 1,100 | Earthbreaker ✔ |
| Carapex | Mandible Snap 126 | Leg Spear 5 | Scythe Fall 353 | Bile Mortar: 4 bombs, ≈ 3,100 | Hive Quake ✔ |

Notes:
- Harrowblade's leap was pressed the instant its charge ended, so it was correctly ignored.
- Razormaw also ran the full `moves` script: it walks through dense blocks at about 12 m/s, and every move and the roar run with 0 console errors.

## Menus: `tests/ui.mjs`

The test runs against both `index.html` and the built `Landfall.html`. It covers:
- title
- lab
- awakening all five locked kaiju, with the correct biomass deducted (40,000 → 18,400)
- buying two Growth levels, after which the model is rescaled on the stage
- settings
- deploying as Carapex, with the correct name, health and moves on the HUD
- results, with the correct reward credited (+264)
- the return to the lab

The run produced 0 console errors.

## Fixed during this pass
- Hollowstrider's Fork Lash and Carapex's mortar curl rotated the wrong way: the tail went into the ground and the abdomen tucked under the body. Both now arc up over the back.
- Harrowblade's flank chevrons were too thick, and the faint vein glow on Nyxwing's wing membranes came out as green blotches in game, where emission is boosted. The markings are thinner and the membranes no longer glow.
- Hollowstrider's skin folds were a regular corrugation. Folds are now patchy and noise-modulated.
- Holding the special button chained a second Dread Pulse straight away. Each pulse now needs its own press.
- Other small fixes:
  - Bile Mortar damage and radius toned down.
  - Spore Torrent power reduced.
  - Long kaiju names no longer collide with the price tag.
  - The dossier opens at the top for each kaiju.
  - The HUD never shows more health than the maximum.

## Earlier passes (kept for reference)
- Building drag is a bounded exponential, so kaiju wade through dense blocks at about 45% speed instead of crawling.
- Move windows use seconds of clip time.
- The HUD identity is set when the mission loads, not after the intro.
- Settings fit at 720p.
- The camera keeps a minimum distance based on the body's footprint.

## Fixed during the mutation pass
- The first seam pattern was a ridge on value noise, which glows over broad areas and turned the whole body into fire. It was replaced with Voronoi cell walls broken into runs.
- Fire never caught, because it was applied only inside the radius the blow had already cleared. It now spreads twice as far as the hit.
- Growths glowed so hot that bloom washed them white. Their emissive is now scaled per strain and concentrated at the root.
- The move hint collided with the five-key move bar at 960 px. It now sits above the bar.

## Fixed during the rivals pass
- The Clash mission sent a second rival as soon as the first died. The schedule is now cleared on spawn and set again on death only when the mission repeats rivals.
- The Cataclysm waited for the surge's roar to finish. It now cuts through anything except a leap or a power.
- The blast's own damage refilled the surge meter instantly.
- A locked meter printed "Surge spent" every frame.
- The dust from thousands of broken chunks evicted the mushroom cloud from the shared particle pool. Set pieces now have their own pool.
- Rival health was a flat multiplier, so an armoured Gravemaw took about 90 claw hits. Health now targets an effective-health value.
- The chain meter collided with the centre banner at 540 px. It now sits above the move bar.

## Known limits
- The Voronoi seams cost 27 cell lookups per pixel of kaiju surface. This is negligible on a desktop GPU, but it is the most expensive part of the kaiju shader.
- Real-GPU performance is unmeasured. Dynamic resolution (`App._adapt`) drops the render scale to as low as 0.6 when frame time exceeds 24 ms.
- Folded wings (Nyxwing at rest) bunch up on the back. Skinning a membrane sculpted spread cannot fold it neatly.
- `Landfall.html` is about 44 MB, because it embeds six 2048-texture kaiju. The hosted build loads the same models as separate files.
