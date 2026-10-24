# LANDFALL: QA Report

All runs used headless Chromium on SwiftShader (no GPU), at `q=low`, driven with a fixed 1/30 s timestep. Absolute frame rates in this environment say nothing about real hardware.

## Gameplay: `tests/play.mjs ... moves`

Each run walks into the city, then performs every move.

| Kaiju | Attack 1 / 2 | Heavy | Stomp / leap | Signature | Result |
|---|---|---|---|---|---|
| Gorvax | ✔ | ✔ tail sweep | ✔ quake | ✔ beam (`default`, `beam` scripts) | Pass |
| Kragmaw | ✔ | ✔ ground slam | ✔ leap, apex ≈ 63 m, lands with a slam | ✔ grab → hold → throw. The rock is released on button-up and adds about $1.7B of damage. | Pass |
| Thornback | ✔ | ✔ tail mace | ✔ earthshaker | ✔ charge at 41 m/s, about 260 m through the city | Pass |
| Scyllax | ✔ | ✔ stinger | ✔ pounce, apex ≈ 65 m | ✔ acid spray: in → loop → out, adds about $3.4B | Pass |

The only console error in any run is *"A user gesture is required to request Pointer Lock"*. That is expected headless, because no click ever happens.

## Menus: `tests/ui.mjs`

The test runs against both `index.html` and the built `Landfall.html`. It covers:
- title
- lab
- awakening the three locked kaiju, with the correct biomass deducted
- buying two Growth levels, after which the model is rescaled on the stage
- settings
- deploy
- mission
- results, with the correct reward credited
- the return to the lab

Peak memory was about 0.7 GB in the GPU process plus 0.6 GB in the renderer. In an earlier run three software-rendered browsers shared four cores and one was OOM-killed at 8 GB. That did not recur when the test ran alone.

## Fixed during this pass
- Building drag multiplied speed by up to 0.6 per frame, so kaiju crawled at about 1 m/s in dense blocks. It is now a bounded exponential drag that settles at about 45% of intended speed against a solid wall.
- Move windows were read as fractions of the clip in code but written in seconds in config. Everything now uses clip seconds. Gorvax's tail sweep and the new kaiju's heavies had been landing outside their swings.
- During the intro, the HUD showed the default name ("GORVAX") for every kaiju.
- The Settings panel overflowed at 720p.
- Mission briefs were cut mid-line in the lab cards.
- The camera could dive into wide kaiju when towers boxed it in. It now keeps a minimum distance based on the body's footprint.

## Known limits
- Real-GPU performance is unmeasured. Dynamic resolution (`App._adapt`) drops the render scale to as low as 0.6 when frame time exceeds 24 ms.
- The thin horn and spike parts are low-poly cones. They read fine at gameplay distance but look faceted in extreme close-ups.
