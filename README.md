# ANECHOIC

*A first-person psychological horror game about a silence that learned to walk.*

You are a field recordist. A voicemail from "Dr. A. Morrow" hires you to record sixty seconds of room tone in **Chamber Zero**, the quietest room ever built, before the abandoned Larkhollow Acoustical Research Laboratory is demolished. The key is under the mat, just like she said.

**When the building goes quiet, it is standing next to you.**

The full design document is in [DESIGN.md](DESIGN.md).

## Play

**Easiest:** double-click `ANECHOIC.html`. It is one self-contained file that opens straight in your browser, with no server and no install. Rebuild it with `npm run build`.

You need a desktop browser with WebGL2 and Web Audio (Chrome, Edge or Firefox). Use headphones.

```bash
npm start            # zero-dependency static server → http://localhost:8080
```

You can also serve the folder with any static server. Opening `index.html` straight from disk will not work, because browsers block ES modules on `file://`.

| Key | Action |
|---|---|
| WASD | Move |
| Shift | Run (you will breathe loudly afterwards) |
| C | Crouch: quiet footsteps, quiet doors. Hold C while using a door to bolt it. |
| E | Interact, read, hide, leave a hiding place |
| F / R | Flashlight / change battery |
| Hold RMB | Raise the recorder. The VU needle shows how loud the room is. |
| Hold LMB (recorder raised) | Record a sound source |
| Space (hold) | Hold your breath |
| Q | Switch on and throw a calibration oscillator (a lure) |
| Tab | Journal: documents, tapes, items, floor plan |
| Esc | Pause and settings |

Settings cover:
* quality presets
* sensitivity, invert-Y and field of view
* brightness calibration
* separate volume buses
* subtitles and sound captions
* head-bob

The game saves automatically at checkpoints.

## What's in it

* **The Remainder.** An original entity with a skin dish for a head, which turns toward whatever it hears.
  * It moves in **stop-motion**: its pose updates at about 9 fps while the world runs at 60.
  * When it is near, **the world goes silent**: ambience and reverb duck, then tinnitus and your heartbeat rise.
* **AI.** States: patrol, investigate, search, check hiding spot, stalk, watch, ambush (from the ceiling), hunt, chase, lost, retreat, lured and duct-crawl.
  * **Senses:** hearing is propagated along real paths, so sound travels through doorways and not through 1 m of concrete. Sight is a cone along the dish and scales with light. It always detects you by touch at close range.
  * **Memory:** it keeps your last known position and velocity.
  * **No cheating:** it never reads your position.
  * **Pacing director:** handles build-up, peak and relax. It only ever hints which *zone* you are in.
  * **Learning:** it learns your favourite hiding place, your most-used doorways, whether you stop to listen, and how much you rely on the flashlight.
  * **Sound theft:** it steals sounds you make (flashlight clicks, doors, piano notes, gasps) and **mimics** them later.
  * **The second footstep:** while stalking, it walks in time with you. Stop, and you hear one more step.
* **Audio.** Everything is synthesised at load time; the game ships no audio files.
  * HRTF positional sound, relocated to the doorway it travels through
  * per-zone convolution reverb with procedural impulse responses (the 7-second reverberation hall, and nothing at all in Chamber Zero)
  * sparse, tension-driven music
  * absolute silence on death
* **Visuals.**
  * Procedural PBR textures with normal maps
  * 2.5D sector level geometry with baked vertex ambient occlusion
  * a constant-size pool of point lights, each **masked to its room** by a shader patch so light never bleeds through walls
  * a shadow-casting flashlight with a lens cookie
  * a working mirror; something stands in it that isn't in the room
  * rain, dust in the beam, an HDR pipeline with bloom, and ACES grading, grain and chromatic aberration driven by fear
* **Puzzles.** Every answer is in the world:
  * a custodian's private pictograms on the breaker panel, with a 3-circuit limit and a loud trip
  * boiler valves set from chalk marks
  * a music box melody played back on the piano
  * a draft behind a shelf
  * recording a dead woman's voice off a reel to fool a voice lock
* **Four endings.** THE QUIET JOB, CARRIER, FULL SPECTRUM, and a secret ending.
* **Replayability.** Each playthrough is seeded, which varies:
  * where items and reels are placed
  * the breaker panel layout
  * the boiler solution
  * the music box melody
  * dead and flickering lights
  * the anomaly schedule

## Project layout

```
index.html, css/        UI shell
src/core/               Game loop & modes, input, settings, RNG, events
src/world/              MapData (pure layout), Grid, Nav (A* + sound propagation), Textures, Materials,
                        LevelBuilder, Props, Decor, Doors, Lights
src/player/             Player controller, Inventory, Interaction
src/entity/             Remainder body/animation, RemainderAI (+ Director, PlayerModel)
src/horror/             Anomalies
src/story/              Documents, Story (puzzles, beats, endings)
src/audio/              Synth (procedural sounds, IRs), AudioEngine
src/render/             PostFX, Mirror
src/ui/                 HUD, reader, journal, terminal, menus
tools/                  serve.mjs, validate.mjs (map + progression solver)
tests/                  smoke.mjs (headless playthrough), scenes.mjs (screenshot QA), title.mjs
vendor/                 three.js r186 (MIT)
```

## Tests

```bash
npm install          # only needed for Playwright (tests)
npm run validate     # map integrity, prop placement, progression solver, entity navigation
node tests/smoke.mjs # headless Chromium playthrough of the critical path + AI behaviours + an ending
node tests/scenes.mjs shots   # screenshot tour of the building
```
