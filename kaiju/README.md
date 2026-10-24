# LANDFALL

*A kaiju destruction game. Choose a titan, come ashore and level a living city.*

The city was built on the assumption that nothing bigger would ever come ashore. Pick one of four kaiju, wade in from the harbour and tear the city apart floor by floor while traffic jams, crowds flee and the military escalates. Your rampages earn **biomass**, which you spend to evolve your kaiju or to awaken new ones.

## Play

**Easiest:** double-click `Landfall.html`. It is one self-contained file of about 25 MB that opens in your browser with no server and no install.

**From source:** run `npm start` at the repo root, then open <http://localhost:8080/kaiju/>. Opening `index.html` straight from disk will not work, because browsers block ES modules on `file://`.

You need a desktop browser with WebGL2 (Chrome, Edge or Firefox) and a dedicated or recent integrated GPU. Use **Settings → Quality** to trade fidelity for frame rate. *Low* and *Medium* render at a reduced resolution without ambient occlusion. *Ultra* is for fast desktop GPUs.

| Input | Action |
|---|---|
| WASD / left stick | Move, relative to the camera. Hold **Shift** / LB to run. |
| Mouse / right stick | Look. Scroll to zoom. |
| Left mouse / X | Attack. Press again to chain the second attack. |
| Right mouse / R / Y | Heavy attack |
| Q, F, middle mouse / LT | Signature power. Hold to channel; it aims where you look. |
| Space / A | Stomp, or leap for the agile kaiju |
| E / B | Roar: panics the city and rattles the military |
| Esc / Start | Pause, settings, retreat |

## The roster

| Kaiju | Height | Style | Signature power |
|---|---|---|---|
| **Gorvax**, the Thermal Apex | 93 m | Bipedal saurian. Claw, bite, tail sweep, quake stomp. | **Thermal Breath**: a sustained beam that cuts through towers |
| **Kragmaw**, the Magma Primate | 74 m | Knuckle-walking megaprimate with magma veins. Haymaker, hammer fist, two-handed ground slam, seismic leap. | **Tectonic Hurl**: tears up a slab of city and throws it |
| **Thornback**, the Living Fortress | 64 m | Armoured quadruped. Horn gore, shield bash, club-tail mace, earthshaker. | **Juggernaut Charge**: an unstoppable sprint that plows through blocks |
| **Scyllax**, the Abyssal Reaver | 58 m | Eight-legged crab-scorpion. Pincer snap, twin shear, stinger lance, pounce. | **Acid Torrent**: a spray that melts what it touches |

Gorvax is available from the start. The others are awakened with biomass. Every kaiju has seven upgrade tracks: Vitality, Armoured Hide, Might, Metabolism, Stride, Growth (which makes it physically bigger), and Signature Power.

## Missions

Five story missions run across three cities (Harbor City, Metro Bay, Capital District) and six times of day (dawn, midday, golden hour, dusk, night, storm). The goals are damage totals, toppling a landmark, collapsing towers, surviving a storm under heavy fire, and levelling a share of the city. **Free Rampage** lets you pick any city and any hour with no objective.

## What makes it tick

- **Kaiju made in Blender.** Each creature is sculpted procedurally from signed-distance primitives with noise, then meshed and decimated. Blender then bakes normal, colour, roughness, AO and emissive maps from a high-detail procedural material; rigs it; keyframes thirteen animations with an FK/IK solver; and exports a GLB. Everything lives in `blender/`.
- **A destructible city.** Hundreds of buildings are split into floor-by-floor chunks. Each building checks whether it is still supported: knock out the lower floors and the rest pancakes or topples as a rigid group. Broken chunks fracture into Voronoi debris that keeps its facade, and dust, fire and smoke follow.
- **Physically based lighting.** A single-scattering sky drives the image-based lighting and the height fog. The scene uses cascaded shadow maps, ground-truth ambient occlusion, bloom, ACES tone mapping and SMAA. Building facades are a shader with windows, curtain walls and interior mapping, with no textures.
- **A living city.** Traffic follows the road grid, crowds flee, and the military escalates from tanks and helicopters to jets and artillery as your threat level rises.
- **Procedural audio.** Roars, impacts, collapses, engines, gunfire and the score are all synthesised in WebAudio. Distant sounds arrive late, at the speed of sound.

## Developing

```
kaiju/
  index.html, css/style.css   screens and HUD
  src/main.js                 app shell: menus, settings, dynamic resolution
  src/core/                   config (roster, upgrades, missions), input, save, asset loading
  src/render/                 renderer and post chain, sky, shared shader plumbing, particles, decals
  src/world/                  city generator, buildings and destruction, debris, ground, ocean, props
  src/kaiju/                  kaiju controller, camera rig, signature abilities
  src/game/                   the play session, menu backdrop, traffic, crowds, military
  src/audio/                  synthesis recipes and the audio engine
  blender/                    asset pipeline (Python, run with Blender's bpy module)
  assets/                     generated GLB and JSON files
  tests/                      headless Playwright captures and gameplay scripts
  tools/build.mjs             single-file build
```

- **Rebuild `Landfall.html`:** run `npm install` at the repo root, then `node kaiju/tools/build.mjs`.
- **Rebuild a kaiju:** use Python 3.11 with the `bpy`, `numpy`, `scipy` and `scikit-image` packages. From `kaiju/blender/`, run `python build.py <gorvax|kragmaw|thornback|scyllax>`. A full build takes about four minutes.
  - `--fast` gives a quick low-resolution pass.
  - `--sheet walk,attack1 --sheetdir out/` renders animation contact sheets.
  - `python shape_preview.py <name> out.png` renders the sculpt alone in seconds.
  - Rebuild the props with `python props.py`.
- **Gameplay smoke test:** run `node kaiju/tests/play.mjs <outdir> "auto=kragmaw&q=low&spawn=100,60&nointro=1" moves`. It drives the game with a fixed timestep and saves screenshots. The scripts are `default`, `city`, `moves`, `beam`, `army` and `nan`.
- **URL parameters:**
  - `auto=<kaiju>` skips the menus.
  - `mission=<id>` picks the mission.
  - `q=low|medium|high|ultra` sets the quality.
  - `spawn=x,z` sets the start position.
  - `nointro=1` skips the intro.
  - `bloom=0` turns off bloom.

The vendored three.js (r186) is MIT licensed.
