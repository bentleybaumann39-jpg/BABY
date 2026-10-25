# BENTHOS: THE SILENT PRESSURE

*A survival-horror descent into the Trench of Whispers, in 480×270 pixel art.*

You are Mara Ekdahl, the last pilot certified on Halvard Marine's HV-series hardsuits. Three days ago the survey ROV *Magpie-3* went dark at 2,904 metres. Its final eleven seconds show a helmet in the silt with your suit's serial stencilled on the collar, and its hydrophone caught your voice calling out a depth. You have never been in the Asher Deep.

The full design is in [DESIGN.md](DESIGN.md). The game is a compressed, playable version of that whole arc. It runs 30–45 minutes from the ship's deck to the bottom of the trench, with three endings and a New Game+.

## Play

**Easiest:** double-click `Benthos.html`. It is one self-contained file with no server and no install.

`index.html` also works from disk, because the source files are plain scripts. You need a desktop browser with Web Audio (Chrome, Edge or Firefox; WebGL is optional). Use headphones, and play in a dark room.

| Key | Action |
|---|---|
| WASD / arrows | Thrust (screen-relative). Let go to coast; coasting is silent. |
| Mouse | Aim the lamp, the Pick, the narrow ping and the Siphon jet |
| Shift | Boost (loud) |
| C / Space | Flood the ballast tank to sink (silent) / blow it to rise (hisses, spends air) |
| R | Ping. Tap for a wide pulse; hold and release for a narrow cone. The hull rings for 10 s and leaves a trail predators follow. |
| Right mouse (hold) | Listen through the hydrophones (directional sound, edge arcs, no thrust) |
| Left mouse | Fire the Pick / hold to reel in / click again to let go |
| F | Lamp: white, red, off. Hold to throw a flare. |
| E | Interact. Hold it to absorb biomass. |
| Q | Clamp to nearby rock (damps the ring). Hold to brace and power down. |
| 1–5, G | Use a biomass cell (Siphon jet, Caul shield, Bloom decoy) / Graft it into the hull |
| X | Powerhead (three shells in the whole game, very loud) |
| V / H / T | Hold breath / read the chest gauge (the truth) / swap the scrubber canister |
| Tab · M · Z | Fabricator at a Cairn · Szabo's chart · wipe the visor |
| Esc | Pause |

A gamepad also works: left stick thrust, right stick aim, RT boost, LT listen, LB/RB rise/sink, A use, B clamp, X ping, Y lamp, RS-click Pick, D-pad cells and gauge.

The settings menu has Honest HUD (turns off the CO₂ lies), photosensitivity mode, steady trim, screen shake, rumble and CRT toggles.

## What's in it

**The descent**
* **Prologue on the deck of the *Halcyon Mercy*.** The only scene in full colour, with the eleven seconds of footage and a waltz on the galley radio.
* **Act I, 0–1,000 m.** The shaft and its terraces, riding the cage between stops:
  * the Sunlit Wall
  * the Phantom Floor, where sonar lies and the lamp blinds you
  * the *Gannet* bell
  * a whale fall
  * the Cage Fall
* **Act II, 1,000–2,904 m.** Open water with no walls and no shadow, plus:
  * the SOFAR channel and the Slow Wave
  * three Processions
  * the hanging *Thalassa Vigil*
  * *Magpie-3*
* **Act III, 3,000–4,190 m.** The impossible Benthic Plain:
  * brine lakes
  * the Machine's Eye
  * the overheard briefing
  * the Archive
* **The Breach at 1,140 m.** The death screen is true, RETRY does not reload, and everything after is subtly, provably wrong.

**Creatures** (each one is described in DESIGN.md §3)
* **The Reliquary.** It waits for you to weaken and wears helmets at their own era's resolution.
* **The Sleeper.** Its sprite lags 500 ms behind its hitbox; only sonar and sound show where it really is.
* **The Procession.** A 300 m siphonophore that learns your signals.
* **The Grain.** A swarm hiding in the dither.
* **The Second Diver.** It replays your own recorded inputs.

**Systems**
* **Breath.** The Lung Cluster lies when CO₂ builds up.
* **Pressure.** Crush Debt closes the playfield and bends the CRT into pincushion.
* **Fidelity.** Hidden until the breach; the colours left in Mara's sprite.
* **Sonar.** Wireframes that see through rock, plus a terrain point cloud.
* **Biomass.** Strains that rebuild you as much as they help you.
* **Cairns** save the game, and their fabricator builds upgrades.

**Rendering** (all software; every shape and texture is generated in code)
* A column ray-marcher over a floor heightfield, with a cut plane at the diver's depth.
* Beer–Lambert light, so warm colours die first.
* 3D-primitive models ray-cast into a small G-buffer.
* Ordered dithering into per-depth palettes that shrink as you descend.
* An optional WebGL CRT pass. Its curvature inverts under pressure.

**Audio**
* Procedural Web Audio: a dry interior against a hull-filtered exterior.
* The Ostinato, built from the harmonics of a 17 Hz pulse your speakers can't play.
* Comms latency of depth ÷ 1,500 m/s, which goes negative after the breach.
* A bit-crushed mix on the plain.

**Endings and New Game+**
* Three endings: ASCENT, SEDIMENT, and a secret one.
* Finishing unlocks *Second Copy*, a New Game+ at 320×180.

## Project layout

```
index.html        page shell; loads src/*.js in order (works from file://)
Benthos.html      built single-file version (node benthos/tools/build.mjs)
DESIGN.md         the concept document
src/core.js       namespace, math, noise, input, persistence
src/palette.js    Halvard-48 palette, zone palettes, 32^3 LUTs, Fidelity merges
src/world.js      heightfield maps: deck, Act I-III, the void
src/render.js     terrain march, lighting, primitive models, quantise, CRT present
src/models.js     every model as a list of 3D primitives
src/audio.js      procedural audio engine, the Ostinato, the waltz
src/entities.js   entity list, noise events, items, props, cairns, the cage, effects
src/creatures.js  Reliquary, Sleeper, Procession, Grain, fauna, Second Diver
src/player.js     the diver: physics, sonar, breath, Crush Debt, Fidelity, biomass
src/zones.js      Phantom Floor, Slow Wave and SOFAR, the Settling
src/story.js      population, dialogue and latency, triggers, set pieces, endings
src/hud.js        pixel font, HUD, menus, sequences, endings
src/main.js       modes, fixed-step loop, camera, marine snow, frame pipeline
tests/smoke.mjs   visits every act and set piece headlessly; fails on any page error
tests/story.mjs   plays the critical path with simulated input, beat by beat
```

## Tests

Both tests use Playwright (`npm install` at the repo root, or a global install).

```bash
node benthos/tests/smoke.mjs [shotDir]   # every act and sequence; optional screenshots
node benthos/tests/story.mjs [shotDir]   # deck -> Breach -> Magpie -> Archive -> ending -> title
node benthos/tools/build.mjs --check     # Benthos.html matches the sources
```
