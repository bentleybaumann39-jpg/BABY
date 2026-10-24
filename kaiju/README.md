# LANDFALL

*A kaiju destruction game. Choose a titan, come ashore and level a living city.*

The city was built on the assumption that nothing bigger would ever come ashore. Pick one of six alien kaiju, wade in from the harbour and tear the city apart floor by floor while traffic jams, crowds flee and the military escalates. Your rampages earn **biomass**, which you spend to evolve your kaiju or to awaken new ones.

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

Six original alien kaiju. Each is sculpted, textured, rigged and animated in Blender, with 13 animations, bioluminescent markings, and secondary motion on its tail and antennae.

| Kaiju | Height | Build | Signature power |
|---|---|---|---|
| **Razormaw**, the Split Crest | 87 m | Hunched brute that knuckle-walks on glowing talons. Its skull splits into two toothed crest blades. | **Plasma Breath**: a sustained beam |
| **Harrowblade**, the Knife Stalker | 85 m | Digitigrade hunter with a knife-blade skull, a shark fin and glowing chevrons. | **Blade Charge**: a head-down sprint through whole blocks |
| **Hollowstrider**, the Gaunt Walker | 83 m | Pale, ribbed horror on four enormously long limbs, with a forked whip tail. | **Spore Torrent**: a choking spray |
| **Nyxwing**, the Acid Wraith | 74 m, 175 m wingspan | Four-legged acid-spitter with vast membrane wings. Its leaps carry further. | **Acid Volley**: burning globs, two a second |
| **Gravemaw**, the Siege Titan | 70 m | Hammer-headed armoured brute. The seams of its carapace glow amber. | **Dread Pulse**: an EMP shockwave that wrecks every machine nearby |
| **Carapex**, the Hive Engine | 66 m | Six-legged siege insect with sickle mandibles. | **Bile Mortar**: bile bombs lobbed over the skyline |

Razormaw is available from the start. You awaken the others with biomass. Each kaiju has seven upgrade tracks: Vitality, Armoured Hide, Might, Metabolism, Stride, Growth (which makes it physically bigger), and Signature Power. Saves from the earlier four-kaiju version still load: biomass spent on those kaiju is refunded.

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

- **Rebuild `Landfall.html`:** run `npm install` at the repo root, then `node kaiju/tools/build.mjs`. Add `--web <dir>` for a hosted build instead: a small page plus the models as separate files, for a site that can't serve one 25 MB page.
- **Rebuild a kaiju:** use Python 3.11 with the `bpy`, `numpy`, `scipy` and `scikit-image` packages. From `kaiju/blender/`, run `python build.py <razormaw|harrowblade|hollowstrider|nyxwing|gravemaw|carapex>`. A full build takes three to five minutes.
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
