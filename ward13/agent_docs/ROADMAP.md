# Ward 13 — Improvement Roadmap (Phase 3)

Each item has a status. Verification is done with `tests/qa.mjs` (scenario named) unless stated otherwise.

## CRITICAL

### R-01 — Validate settings so a corrupt value cannot kill the menu
| | |
|---|---|
| What is wrong | `settings.vol` can be NaN or a string. `audioInit` throws inside every click handler (AUDIT §7). |
| Why it matters | The menu becomes permanently dead, which looks to the player like a broken game. |
| Change | Add a `sanitizeSettings()` with a schema (type, range, enum) that runs at load and before every save. `audioInit` uses the sanitized value. |
| Player benefit | The game always reaches play. |
| Risk / deps | Low / none |
| Effort | S |
| Verify | The `corruptSave` scenario runs with zero page errors, and Continue / New game work. |
| **Status** | DONE: verified by `corruptSave` (8/8 cases) and `scares` |

### R-02 — Validate and repair saves
| | |
|---|---|
| What is wrong | Any `{v:3}` object is accepted. Missing fields throw later (AUDIT §9). |
| Change | Add `repairSave(s)`: deep-merge onto `newSave()` defaults, clamp `level` to 1–30, coerce numbers, filter `notes` to valid indices. Keep `v:3` so existing saves still load. |
| Player benefit | No crash from old or partial saves, and progress is kept where possible. |
| Risk / deps | Low / R-01 |
| Effort | S |
| Verify | The `corruptSave` cases all reach play. A real v3 save round-trips unchanged (`shopLoop`). |
| **Status** | DONE: verified by `corruptSave` (8/8 cases) and `scares` |

### R-03 — Fear director lifecycle
| | |
|---|---|
| What is wrong | `DIR` is not reset on menu, death or floor complete. The overlay persists and the master is left muted (AUDIT §9). |
| Change | Add a single `DIR.reset()`: remove the overlay, restore master gain, remove stalker meshes, clear state. Call it from `startFloor`, `toMenu`, `die`, `completeFloor`, `pause` (the overlay only) and `fatal`. Make the crash timer real-time and pause-safe. |
| Player benefit | No ghost overlay and no silent menu. |
| Risk / deps | Low / none |
| Effort | S |
| Verify | The `scares` scenario: no overlay after quit, and gain > 0. |
| **Status** | DONE: verified by `corruptSave` (8/8 cases) and `scares` (overlay gone, gain 0.8 after quit) |

## HIGH IMPACT

### R-04 — Cut floor load time
| | |
|---|---|
| What is wrong | Floor 30 takes 7.7 s. The hotspots are `rmap` 2.9 s, texture upload 1.5 s and `nmap` 0.8 s (AUDIT §8). |
| Change | **rmap:** stamp puddles with canvas radial gradients onto a half-resolution canvas instead of looping every pixel against every puddle. **nmap:** use `sqrt`, precomputed row indices and no `%` in the inner loop. Roughness maps drop to 512² (they are low-frequency), so their upload is 4× smaller. |
| Player benefit | Faster retries and descents. |
| Risk / deps | Low: visual parity must hold. Compare screenshots. |
| Effort | M |
| Verify | Profile floor 1 and floor 30 before and after (see `PERF_REPORT.md`). Screenshot comparison. |
| **Status** | DONE: `rmap` 2.8–3.3 s → 41–76 ms and `nmap` ~850 → ~650 ms (medians of 7 profiled loads of floor 30). Roughness upload is 4× smaller. Total load time in the sandbox is dominated by bimodal software-GPU sync waits, so it is **UNVERIFIED** on real hardware (see PERF_REPORT). Visual parity was checked by screenshot. |

### R-05 — Offline single-file build
| | |
|---|---|
| What is wrong | The game only loads three.js from a CDN (AUDIT §13). |
| Change | `tools/build.mjs` inlines `vendor/three.min.js` into `Ward13.html`, a single file that works offline. `index.html` also falls back to `vendor/three.min.js` when the CDN fails. |
| Player benefit | Double-click and it plays. No internet needed. |
| Risk / deps | Low / none |
| Effort | S |
| Verify | Run the QA suite against `Ward13.html` with **network blocked** (no CDN route). |
| **Status** | DONE: `Ward13.html` passes boot, newgame and floors 1/5/30 with **all network blocked** (`--offline`). `index.html` with the CDN blocked falls back to `vendor/` (boot and newgame pass). `buildFresh` guards against a stale build. |

### R-06 — Dynamic resolution that recovers
| | |
|---|---|
| What is wrong | `perf()` only degrades (AUDIT §8). |
| Change | Hysteresis. Ignore the first 2 s after a load, a resume or a hidden tab. Step down when the average frame is over 34 ms. Step back up (bloom first, then resolution) after 6 s under 20 ms. |
| Player benefit | Quality comes back after a hitch. |
| Risk / deps | Low |
| Effort | S |
| Verify | Unit-drive `perf()` with synthetic dt through the test hook. |
| **Status** | DONE: the `dynres` scenario drives `perf()` with synthetic frame times. Slow frames for 20 s give 0.55 scale; fast frames for 60 s restore 1.00 and bloom; a bounce becomes a ceiling. Steps every ~8 s, settles 2.5 s after load, resume or a note. A quality change resets it. |

## MEDIUM IMPACT

### R-07 — Camera trauma shake + reduced-motion and FOV settings
| | |
|---|---|
| What is wrong | Shake is white noise. There is no reduced-motion option and no FOV setting (AUDIT §3, §10). |
| Change | Trauma² shake from smooth sine noise. New settings: "Reduce camera motion" (scales bob, shake, FOV kick and warp by 0.25) and a FOV slider (60–95). |
| Player benefit | Impacts feel weighty, and motion-sensitive players can play. |
| Risk / deps | Low / R-01 (schema) |
| Effort | S |
| Verify | `controls` plus a settings round-trip. |
| **Status** | DONE: `settingsUI` shows FOV 88 persisted and applied to the camera (88.0), and reduced motion and captions persist. Shake is trauma² with smooth sines; reduced motion scales bob, shake, sprint FOV kick and warp. Escape now closes the settings and controls panels, and rows were tightened so Done is visible at 720p (screenshot). |

### R-08 — Sound captions
| | |
|---|---|
| What is wrong | Critical audio has no text (AUDIT §5). |
| Change | Optional captions: a small queue that shows `[Footsteps — behind you]` with a direction from the listener-relative angle. Hooked into the `SFX` calls for scream, whisper, step-behind, growl, screech, slam, glass, the weeper's sob and the stalker's breathing. Rate-limited, default off. |
| Player benefit | Accessibility, plus clarity of horror cues. |
| Risk / deps | Low |
| Effort | M |
| Verify | Trigger scares with captions on and check the caption DOM text. |
| **Status** | DONE: `captions` shows "[Breathing, close behind you]" for the stalker. Hooked SFX: scream, whisper, growl, screech, slam, glass, clang, roar, scrape. Also enemy footsteps (by type), crying, locker banging, phone, the footsteps scare. Rate-limited per line, at most 3 on screen. |

### R-09 — Fatal error recovery screen
| | |
|---|---|
| What is wrong | A frozen frame with no exit (AUDIT §7). |
| Change | `fatal()` shows the error inside a panel with "Return to the menu" (it restores the snapshot) and "Reload". It also clears the director and audio. |
| Player benefit | Recovery without losing progress. |
| Risk / deps | Low |
| Effort | S |
| Verify | Inject a throwing update through the test hook, then click Return. The menu works. |
| **Status** | DONE: `fatalRecovery` injects a broken enemy, then checks the recovery panel, then menu → continue → play with no further errors. |

### R-10 — Fear director pacing
| | |
|---|---|
| What is wrong | The fake crash repeats (AUDIT §1). The glitch timer is frame-based (§3). |
| Change | The fake crash happens at most once per session and never on floors 1–2. Signature scares avoid repeating the previous one. Use a dt-based glitch timer. |
| Player benefit | Scares stay surprising. |
| Risk / deps | Low |
| Effort | S |
| Verify | Code review plus the `scares` scenario. |
| **Status** | DONE: implemented with R-03 (`DIR.crashed`, `DIR.last`, floor > 2) and dt-based `secMotion` timer. Verified by code review and `scares` (the stalker, cascade and crash still trigger). |

### R-11 — Onboarding: teach by doing
| | |
|---|---|
| What is wrong | A three-mechanic text dump on floor 1 (AUDIT §1). |
| Change | Contextual one-shot tips: UV when the player first sees an enemy or growth, the flash when an enemy first closes within 6 m, the camcorder when battery first drops below 30% in darkness. Tips are stored in save and skipped in New Game+. |
| Player benefit | Each mechanic is learned at the moment it is useful. |
| Risk / deps | Low |
| Effort | S |
| Verify | Drive the triggers through the test hook and check the message text. |
| **Status** | DONE: the floor-1 text dump was removed. `TIPS` teaches uv, flash, hide, dark and sanity on first relevance, saved in `save.tips` and skipped in New Game+. The `tips` scenario shows the UV tip appearing when an enemy comes into view, and `save.tips.uv` is set. |

## NICE-TO-HAVE
- **R-12 — Gamepad support (Gamepad API):**
  - Sticks for move and look, triggers for UV and flash, face buttons for the actions.
  - **Status:** DONE. The `gamepad` scenario uses a simulated standard-mapping pad. It covers menu focus with the d-pad, A to activate, A to skip the intro, the left stick to move, the right stick to look, Y for the flashlight, RT for ultraviolet, and Menu to pause and resume.
  - It also found and fixed a real blocker: the intro could only be dismissed by keyboard or mouse.
  - Real hardware is **UNVERIFIED**.
- **R-13 — Draw-call statistics for the dev hook:** capture `renderer.info` after the scene pass. **Status:** DONE (floor 1: 157 calls and 69K triangles; floor 30: 181 calls and 31K triangles).

## Deliberately not doing
- **Upgrading three.js beyond r128:** the owner asked to keep r128. The risk of large API changes (encoding, skinning flags) is high and the gain for players is small.
- **Key rebinding UI:** medium effort and touches every key handler. The keyboard layout is standard WASD, and arrow keys already work for turning and moving. Revisit after gamepad.
- **Moving texture generation to GPU shaders or Web Workers:** after R-04, CPU texture time is well under 1 s. `OffscreenCanvas` worker support is uneven in older Safari. Not worth the complexity.
- **Splitting the single file into modules:** this conflicts with the single-file constraint and offers no player benefit.
