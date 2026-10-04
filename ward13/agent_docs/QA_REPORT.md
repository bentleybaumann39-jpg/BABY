# Ward 13 — QA Report (Phases 7–8)

- **Harness:** `node ward13/tests/qa.mjs` (headless Chromium, SwiftShader). It has 21 scenarios. `soak` and `simSoak` are opt-in by name.
- **Offline:** `--offline` blocks all network access. `--file=ward13/Ward13.html` tests the shipped single file.

## Test matrix

| Category | How it was exercised | Scenario(s) | Result |
|---|---|---|---|
| New player | First launch, empty storage. New game, intro, floor 1. Contextual tips. | `boot`, `newgame`, `tips` | PASS |
| Experienced player and exploits | Buy 20× past the max (capped at 4 grades and 5 medkits). Retry restores the snapshot (no obol or item duplication). Win and die in the same tick resolve to "done". | `shopLoop`, `edges`, `deathRetry` | PASS |
| Unusual input | 150 mixed keys including E, Q, F, V, M, 1–3, G, Space and C, then 12 Escapes. Input during loading is ignored (state guard). | `spam` | PASS |
| Rapid repetition | Escape spam; pause and resume; buying in a loop | `spam`, `shopLoop` | PASS |
| Boundaries | Save level 99, negative inventory, string numbers, unknown upgrades, out-of-range notes | `corruptSave` | PASS (8/8) |
| Save and load | A valid v3 save survives unchanged. Not JSON. Empty v3. Nulls. Junk types. v2. Corrupt settings. Settings not JSON. A reload keeps progress. | `corruptSave`, `shopLoop` | PASS |
| Respawn and death | Death, then retry. Lazarus revive. Dying during a scare clears the scare. | `deathRetry`, `edges` | PASS |
| Interrupted actions | Pause during a fake crash, then quit (overlay removed, volume restored). Controller disconnected mid-hold (virtual key released). Window resized during play. | `scares`, `edges`, `resize` | PASS |
| State changes | Floor cleared mid-cascade. Injected runtime error, then recovery panel, then menu, then continue. Escape twice. | `edges`, `fatalRecovery` | PASS |
| Resolutions and aspect ratios | 1280×720, 1920×820 (21:9), 800×600 (4:3), 1440×900 (16:10), 390×844 (portrait), 2560×1440. HUD in bounds; band and belt no longer overlap. | `resize` | PASS |
| Input devices | Keyboard and mouse. Simulated standard-mapping gamepad covering menu navigation, intro skip, move, look, flashlight, ultraviolet and pause. | `controls`, `gamepad` | PASS (real pads **UNVERIFIED**) |
| Low-end hardware | Dynamic quality steps down and recovers; the "Low" preset exists | `dynres` | PASS (real low-end GPU **UNVERIFIED**) |
| Network | Not applicable (single-player). Offline: the shipped file plays with all network blocked; `index.html` falls back to `vendor/`. | `--offline` runs | PASS |
| Long sessions | 5 real minutes rendering (floor 1) and 20 simulated game-minutes on floor 24 (9 enemies). Heap, scene objects, geometries and textures all plateau. | `soak`, `simSoak` | PASS |
| Content coverage | All 30 floors, including all 6 bosses, build and run with zero errors | `floors` | PASS |
| Accessibility settings | FOV, reduced motion and captions persist and apply. Escape closes panels. Done is visible at 720p. | `settingsUI`, `captions` | PASS |

## Bugs found and fixed in this pass

| # | Severity | Bug | Found by | Fix (commit) |
|---|---|---|---|---|
| 1 | High | A corrupt `w13.settings.vol` made `audioInit` throw inside every click handler, so the menu was permanently dead | `corruptSave` | `cleanSettings` schema |
| 2 | High | A partial or junk v3 save was accepted and crashed later | Code review, then `corruptSave` | `repairSave` |
| 3 | High | The fake-crash overlay and muted audio leaked into the menu after a pause and quit (from my earlier pass) | `scares` | `dirReset` on every flow change |
| 4 | High | A gamepad-only player could not leave the intro (it listened for keyboard and mouse only) | `gamepad` | Any pad button skips the intro |
| 5 | Medium | A load stall: stale frames rendered behind the title card blocked the build's GPU sync points (exposed once texture generation got faster) | A/B performance | No rendering while loading (floor-30 load −52%) |
| 6 | Medium | Dynamic resolution only ever degraded | Code review | Hysteresis and recovery |
| 7 | Medium | The fatal-error path left a frozen frame with no way out | Code review | Recovery panel |
| 8 | Medium | At under 700 px wide the item belt covered the status card | `resize` screenshot | Media query; the test now checks for overlap |
| 9 | Low | The floor-1 hint said "three fuses" when the floor had 2 | Screenshot review | Count-neutral copy |
| 10 | Low | The fake crash used Chrome's "Aw, Snap!", which looks wrong in other browsers | Final review | Neutral wording |
| 11 | Low | The settings panel's Done button was below the fold at 720p | `settingsUI` screenshot | Tighter rows; Escape closes panels |
| 12 | Low | The map distinguished exit (green) and threats (red) by color only | Final review | Shapes per marker type and a legend in Controls |

## Remaining known issues (all Low)
- **Key rebinding:** there is still no rebinding UI. Arrow keys and WASD both work, and gamepad is supported. Deferred: it touches every key handler. See ROADMAP, "Deliberately not doing".
- **Untested hardware:** real gamepads, real GPUs and high-DPI displays are untested (no devices). Marked **UNVERIFIED**.
- **Balance:** difficulty balance has not been playtested by a human. The automated tests prove function, not fun.

## Phase 8 — final review

| Question | Answer |
|---|---|
| What still feels unfinished? | Key rebinding. Everything else on the roadmap is done and verified. |
| What is confusing? | The minimal HUD hides meters by default. It is mitigated by auto-peek on damage and floor start, warnings ("The battery is failing"), and the new contextual tips. Kept as the author's design. |
| What is frustrating? | Load waits: now about 2× shorter on heavy floors. The repeated fake crash now happens at most once per session. |
| What feels cheap or generic? | The browser-specific crash text (fixed). Nothing else found. |
| What could feel more satisfying? | Hits: trauma shake replaced white-noise jitter. |
| What could be faster or more responsive? | First-floor shader compilation on Windows Chrome (UNVERIFIED; r128 has no parallel compile). |
| What could be more memorable? | The signature scares now don't repeat back to back, which keeps them landing. |
| Which systems are unnecessarily complicated? | None added. Keyboard and pad now share `playKey()`, which removed duplication. |
| What bugs remain? | None known from the QA matrix. |
| What performance problems remain? | Software GL cannot measure real frame rates (see PERF_REPORT). |
| What would keep it from feeling professional? | No human playtest of balance, and untested real devices. Both need people and hardware, not code. |
