# ANECHOIC — Design Document

> *"The quietest room in the world was never empty. It was waiting for something to fill it."*

---

## 1. Title
**ANECHOIC**

## 2. One-sentence hook
A field recordist hired to capture sixty seconds of silence in an abandoned acoustics lab discovers that the silence has learned to walk, and that **when the building goes quiet, it is standing next to you.**

## 3. Core gameplay loop
**Listen → Explore → Read the building → Solve → Survive → Return changed.**

1. *Listen.* The world's sound is your sensor. Hum, pipes, rain, and your own footsteps tell you what is normal. Missing sound is the threat.
2. *Explore* the interconnected wings of Larkhollow with a failing flashlight and a tape recorder whose VU needle measures the room.
3. *Read the building.* Notes, tapes, terminals, pictograms, and changed rooms build the mystery and contain every puzzle answer.
4. *Solve* grounded, observation-based puzzles: breakers labelled with a custodian's private pictograms, a boiler set by chalk marks, a voice lock that only opens for a dead woman.
5. *Survive* the Remainder: hide, hold your breath, close doors, use loud places, throw a calibration oscillator, or loop a corridor you know.
6. *Return changed.* Areas you already know get altered behind you, the entity learns your habits, and the story recontextualises what you've already heard.

## 4. Setting
**Larkhollow Acoustical Research Laboratory**, a brutalist concrete institute in a pine forest. It was built in 1959 to study architectural acoustics and later psychoacoustics. It was sealed in November 1987 after "the Keene Event". Thick walls absorb sound. The corridors are tiled in institutional green. The **reverberation hall** echoes for seven seconds. **Chamber Zero** is an anechoic room lined with foam wedges, measured at −20 dB, and it is the quietest place ever built.

It is 23:41 on a wet October night. You've parked inside the fence. The key is under the mat, just like the voicemail said.

Areas (all interconnected, several with alternate routes):

| Wing | Spaces |
|---|---|
| Exterior | Car park, path, lamp posts, chained gate, pines, rain |
| Public / Admin | Lobby, reception, staff lounge, restrooms (mirror), west corridor, secretary office, **Director Morrow's office** (locked) |
| Residential | Upper corridor, six subject dormitories, infirmary, showers |
| Research ring | A loop corridor around the studio **Control Room** and **Live Room** (piano), four **Listening Booths**, the **Reverberation Hall**, **Records Archive** with a **hidden room**, the **Broadcast Room** (PA), the **Antechamber** and **Chamber Zero** |
| Basement | West stairwell, service tunnel, electrical room (breaker puzzle), **boiler room**, custodian's workshop, storage, flooded cistern, east stairwell up into the research ring (one-way bolt = shortcut) |

## 5. Main entity: **The Remainder**
What is left when you subtract every sound from a room.

* **Silhouette:** about 2.5 m tall, emaciated and hunched. Its limbs are far too long. It has no face. A long, curved neck ends in a **wide, shallow concave dish of skin**, like an inverted ear. The dish turns toward whatever it is listening to. You read its attention by where the dish points.
* **Movement:** it moves in **stop-motion**. Its pose and position update at about 9 fps while the world runs at 60. It never looks like it belongs in the frame. When it chases, it drops low and lurches, and its frames skip forward.
* **Audio identity:**
  * It is **silent**. As it comes closer, the world goes quiet. Ambience ducks, reverb dies, and a faint tinnitus ring and your own heartbeat rise.
  * Its "voice" is a **reversed inhale** that never exhales.
  * When it chases, it screams with **every sound it has ever stolen**: door slams, typewriter keys, piano notes and your own footsteps, played as a frantic collage.
* **Rules the player can learn:**
  1. *Silence means proximity.* If the fluorescent hum dies, it is near. The recorder's VU needle sinks.
  2. *It hunts by sound.* It perceives sight only where its dish points, and only at short range in darkness.
  3. *It steals sounds* the player makes near it, such as the flashlight click, the door creak or the piano note. Later it **mimics** them to lure you.
  4. *The second footstep.* When it stalks, it walks in time with you. When you stop, you hear **one more step**.
  5. *It avoids loud places.* The running boiler and the PA are refuges.
  6. *It cannot open locked doors.* It does know the walls, though, and crawls through service ducts. You hear it scratch through the masonry.
* **Why it exists:** in 1979, perfect silence gave it room to exist. It fed on the subjects' sounds (heartbeats, footsteps, voices) until Subject 11, Daniel Keene, was erased entirely.
* **What it wants:** Director Morrow sealed its core inside Chamber Zero behind a lock that opens only to her voice. It has fragments of her voice, but not all of it. So it used those fragments to **phone a recordist**.

## 6. Story premise
You are a freelance field recordist. A voicemail from "Dr. A. Morrow" hires you to record sixty seconds of room tone in Chamber Zero before demolition: *"Keys under the mat. Come at night. Come. At night."* The odd repetitions are the first clue.

* **Foreshadowing:** the stilted voicemail. Your name is already in the 1987 sign-in book, in pencil. The research doors carry the same bird pictogram as the breaker panel. The phone at reception has no line.
* **Misleading clues:** notes suggest Daniel Keene went mad and lives in the walls. Staff blamed infrasound from the boiler. Morrow's paranoia reads like a breakdown.
* **The revelation**, in Morrow's office: her **1987 obituary**, the **telephone disconnection notice** and her last note. *"It has most of my voice. Not all. Never all. If a voice asks you to open Chamber Zero, it is not mine."*
* **The recontextualisation:** the job, the voicemail, the key under the mat and the footsteps walking you through the building were all the Remainder steering you to the door it cannot open. The second footstep was never stalking you. **It was walking you there.**

## 7. Player mechanics
* **Movement:** walking, sprinting (stamina drives loud breathing), crouching (quiet, low profile) and holding your breath (limited, then a loud gasp).
* **Flashlight:** a shadow-casting beam with a lens cookie. Batteries drain and are scarce, and the beam flickers when low. It makes you more visible.
* **Recorder:** raise it with RMB. The **VU needle shows room loudness**, which works as a diegetic proximity sensor. Hold LMB while raised to record a sound source; you need this for the voice lock and the job itself.
* **Interaction:** doors (crouch to open them quietly), drawers, notes, tapes, terminals, switches, valves, keys and the piano.
* **Hiding:** lockers and wardrobes. You get a slatted view and can hold your breath. The entity remembers hiding spots you overuse.
* **Calibration oscillators (Q):** throwable 1 kHz tone units that lure the Remainder, which "eats" them. Very few exist.
* **Bolts:** some doors can be bolted from one side, which blocks the Remainder. It may wait you out or use the ducts.
* **Journal (Tab):** documents, tape transcripts, items and a pencil floor plan.

## 8. Horror mechanics
* **Silence-proximity audio.** The master ambience, reverb send and fixture hum duck in proportion to the entity's *path distance*. A tinnitus tone and a heartbeat replace them.
* **The second footstep.** During stalking, the entity mirrors your step cadence from behind and adds one extra step after you stop. If you stop often, it learns to stop with you.
* **Sound theft and mimicry.** It records your distinctive sounds into its repertoire and replays them elsewhere, in position, through walls.
* **Anomaly director** with phase-gated, seeded, never-in-view events:
  * Doors creak open off-screen, and chairs turn to face the wall.
  * Lights flicker, die in sequence or come back the wrong colour.
  * Distant footsteps, knocks inside walls and a phone that rings with no line.
  * The sign-in book gains entries, and Morrow's portrait changes.
  * Something stands in a mirror that isn't in the room.
* **Pacing director** (build-up, peak, relax). It hints the entity toward the player's *zone* (never their exact cell) when things are calm too long. It pulls the entity away after sustained pressure.
* **Dynamic lighting.** Pooled lights each carry room bounds, so nothing bleeds through walls. Flicker, power states and emergency-red finale lighting.
* **Post FX.** Film grain, vignette, fear-driven chromatic aberration and desaturation, plus a "pressure" pulse when the entity is close.

## 9. Level structure
A single seamless 2.5D sector-grid building (1 m cells) with a basement level, two stairwells, ~45 rooms and corridors, and a loop corridor designed for chases.

Progression gates (soft-ordered, verified by `tools/validate.mjs`):

```
Exterior ─(doormat key)→ Lobby/Admin/Residential
  └─ Reception key cabinet (teaches pictograms) → Infirmary: custodian's keys
       └─ Maintenance door → Basement ─ breaker puzzle ─→ RESEARCH POWER
            └─ Research ring (first sighting, AI awakens)
                 ├─ Reverberation Hall: Director's keys
                 │    └─ Morrow's office: revelation, dictation reel, gate key
                 │         └─ Control room: play reel, RECORD her voice (set-piece)
                 │              └─ Antechamber voice lock → CHAMBER ZERO (finale)
                 ├─ Archive → hidden room (Full Spectrum notes)       [optional]
                 └─ Live room piano ↔ dorm music box → secret reel   [optional]
Basement boiler (chalk-mark valves)  ─┐
Broadcast room PA amplifier          ─┼→ FULL SPECTRUM console (finale)
Chamber Zero open                    ─┘
```

**Areas that change later:**
* Power restoration lights the research ring and wakes the PA.
* The lounge chairs face the walls.
* The sign-in book fills with "D. KEENE".
* The vault opening turns the building emergency-red, kills all ambience and swings doors open.

## 10. Puzzle system
Every answer is in the world:

1. **Doormat.** Teaches interaction.
2. **Pictogram breakers.** The custodian relabelled the eight circuits with her own symbols. The same symbols appear on the reception key cabinet (with old typed labels), on each wing's door plate and in her notes. The old generator handles three circuits; a fourth trips the main with a loud bang (a noise event).
3. **Director's keys.** These are lost in the 7-second reverberation hall, where your footsteps are amplified. Crouch or be heard.
4. **The dictation reel.** Play it on the control room's reel-to-reel and record Morrow's voice. The reel is loud and the entity comes. You must stay until the phrase completes.
5. **Voice lock.** Play your recording at the antechamber microphone.
6. **Boiler valves.** Match the three handles to the custodian's chalk half-moons, then pull ignition (needs the flame circuit). A wrong setting vents steam loudly. A running boiler is a safe zone.
7. **Music box and piano** *(optional)*. A wind-up music box in a dorm plays five notes. Reproduce them on the live-room piano to open the bench, which holds a subject reel. Captions show the notes for accessibility.
8. **Hidden room** *(optional)*. Dust drifts toward one archive shelf and wind whistles behind it. Push it.
9. **Full Spectrum** *(finale)*. Boiler running, PA amplifier live and Chamber Zero open, then start the 60-second sweep and survive it.

## 11. AI design
`DORMANT → PATROL ↔ INVESTIGATE → SEARCH → (STALK | WATCH | AMBUSH) → HUNT → CHASE → LOST → SEARCH → RETREAT`

* **Senses:**
  * **Hearing** uses *path-propagated* noise. Dijkstra over the cell grid makes closed doors cost attenuation, so sound travels around corners and through doorways, not through 1 m concrete.
  * **Sight** is a cone along the dish. Range scales with the player's light level, flashlight, movement and crouch, and it needs grid line of sight. Windows let it see; walls and closed doors don't.
  * **Touch:** it always detects you within 1.5 m.
* **Suspicion** (0–100) accumulates from both senses and decays. Thresholds pick the state.
* **Memory:** last known position, velocity and time, plus a confidence that decays. On losing you, it searches the last known position projected along your last velocity, then the nearby hiding spots (weighted by habits).
* **No cheating:** it never reads the player's position directly. The pacing director may hint at a *zone* only.
* **Habit learning** (persists across deaths):
  * hiding spot usage, so it checks your favourite locker first;
  * doorway heatmap, so it ambushes the doorway you use most, hanging from the ceiling;
  * flashlight reliance, which raises its light sensitivity;
  * how often you stop to listen, so it stops in time with you;
  * sprint frequency.
* **Behaviours:**
  * opens doors, and closes the ones you opened;
  * switches off lights you switched on;
  * mimics stolen sounds near you;
  * stands at the edge of your beam and is gone when you look again;
  * crawls through ducts with audible scratching;
  * retreats from loud places and lures.

## 12. Audio design
Every sound is synthesised at runtime with the Web Audio API. The project ships no audio files.

* **Bus graph:** SFX, ambience, music and voice buses run through a "silence" ducking stage, a fear low-pass and a compressor. A per-zone **convolution reverb** uses procedurally generated impulse responses: the corridor at 1.2 s, the lobby at 2 s, the reverb hall at 7 s, the basement as metallic and Chamber Zero as none.
* **Spatial audio:** HRTF panners. Sources are **portal-relocated**: a sound behind a wall is heard from the doorway it travels through, with path-length attenuation and occlusion low-pass.
* **Synthesised content:**
  * footsteps on six surfaces;
  * door creaks (resonant friction), latches, slams;
  * breathing and heartbeat, plus tinnitus;
  * fluorescent hum (positional, pooled), pipes, rain on glass, wind;
  * the boiler roar and steam whistles;
  * the phone bell, radio waltz, tape "voices" (formant-filtered babble with transcripts) and piano (additive);
  * relays and breaker clacks;
  * the entity's reversed inhale and stolen-sound collage.
* **Music is rare.** Low drones carry tension states, a dissonant cluster stinger is reserved for sightings and a pulse appears only in chases. **Silence is used on purpose.** Death cuts *all* audio to nothing.

## 13. Visual direction
* **Look:** cold institutional greens, sodium-orange lamps outside and red emergency light in the finale. Deep blacks where you'll need your flashlight.
* **Rendering:** procedural canvas textures (tile, concrete, wallpaper, wood, foam, rust) with generated normal maps. World-aligned UVs, wainscot bands and baked vertex ambient occlusion in every corner.
* **Lighting:** a flashlight spot with a shadow map and lens cookie, plus a constant-size pool of point lights. Every point light carries room bounds injected into the Three.js light loop, so light never leaks through walls.
* **Atmosphere:** exponential fog, rain particles outdoors, drifting dust motes in your beam and a working **mirror** (a reflected camera). The Remainder can stand in the mirror and nowhere else.
* **Post:** HDR render target, then a custom pass: ACES tone mapping, grain, vignette, chromatic aberration, fear desaturation and an optional cheap bloom. The quality presets scale resolution, shadows, bloom and MSAA.

## 14. Technical architecture
* **Platform:** desktop browsers (Chrome, Edge, Firefox) with WebGL2 and the Web Audio API. Three.js r186 is vendored (MIT). There is no build step; native ES modules load through an import map.
* **Layout:**

```
index.html, css/                 shell, overlays, menus
src/main.js                      bootstrap
src/core/                        Game loop & state machine, Input, Events, Settings, Save, RNG, math utils
src/world/                       MapData (pure), Grid (collision/LOS), NavGrid (A*/Dijkstra), Textures, Materials,
                                 LevelBuilder (2.5D sectors → merged chunked geometry), Props, Doors, Lights, Interactables
src/player/                      Player controller, Flashlight, Recorder, Inventory, Interaction, Hiding
src/entity/                      Remainder (model + stop-motion procedural animation), RemainderAI (senses/states/memory),
                                 PlayerModel (habit learning), PacingDirector
src/horror/                      AnomalyDirector (seeded phase-gated events), Mirror scare
src/story/                       Documents, Story/progression flags, scripted sequences, endings
src/puzzles/                     Breakers, Boiler, Piano/MusicBox, VoiceLock, FullSpectrum
src/audio/                       AudioEngine (buses, zone reverb, ducking, propagation), Synth (procedural SFX), Ambience, Music
src/render/                      PostFX, Mirror
src/ui/                          HUD, Journal, Menus, Terminal
tools/                           serve.mjs (zero-dependency static server), validate.mjs (map + progression solver)
tests/                           Playwright smoke and scenario tests
```

* **Determinism:** a per-playthrough seed drives item placement, anomaly schedules and AI variation. Saves store the seed and world deltas.
* **Pure logic modules** (map, grid, navigation, progression) import nothing from Three.js, so Node tooling can validate them headlessly.

## 15. Development roadmap
| Stage | Deliverable |
|---|---|
| 1 | Architecture, loop, input, settings, save, server |
| 2 | Player controller, collision, stamina, crouch, head-bob |
| 3 | Interaction raycasts, doors, notes, terminals |
| 4 | Inventory, journal, keys, batteries, recorder |
| 5 | Map data, 2.5D level builder, procedural textures, props |
| 6 | Light pool with room bounds, flashlight shadows, fog, rain, post FX, mirror |
| 7 | Anomaly director, phases, environmental changes |
| 8 | Remainder model and animation, senses, state machine, pacing director, habit learning |
| 9 | Puzzles: breakers, keys, reel recording, voice lock, boiler, piano, hidden room |
| 10 | Story events, documents, revelation |
| 11 | Procedural audio: buses, reverb zones, propagation, synthesis, music |
| 12 | Four endings, death sequence, credits |
| 13 | Optimisation: chunked merges, constant light count, shader precompile, throttled AI |
| 14 | QA: progression solver, Playwright smoke and scenario runs, screenshot review |

## Endings
| Ending | Condition |
|---|---|
| **THE QUIET JOB** | You learn the truth and leave *without* opening Chamber Zero. The phone rings in your car. |
| **CARRIER** | You open Chamber Zero and escape before the Full Spectrum completes. The room tone on your tape is not empty. |
| **FULL SPECTRUM** | You flood Larkhollow with sound while the vault stands open, then drive away at dawn. |
| **ROOM TONE** *(secret)* | You carry all six subject reels into Chamber Zero and give back what was taken. |
