# LANDFALL: QA Report

All runs used headless Chromium on SwiftShader (no GPU), at `q=low`, driven with a fixed 1/30 s timestep. Absolute frame rates in this environment say nothing about real hardware.

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

## Known limits
- Real-GPU performance is unmeasured. Dynamic resolution (`App._adapt`) drops the render scale to as low as 0.6 when frame time exceeds 24 ms.
- Folded wings (Nyxwing at rest) bunch up on the back. Skinning a membrane sculpted spread cannot fold it neatly.
- `Landfall.html` is about 44 MB, because it embeds six 2048-texture kaiju. The hosted build loads the same models as separate files.
