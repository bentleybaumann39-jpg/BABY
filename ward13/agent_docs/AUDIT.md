# Ward 13 — Game Audit (Phase 2)

## Evidence sources
- **QA harness:** `tests/qa.mjs`, baseline run at commit `ab24062`.
- **CPU profiles:** taken through Chrome DevTools Protocol (CDP) during boot, floor 1 and floor 30.
- **Code reading:** every function cited below.
- **Test environment caveats:** see `ASSUMPTIONS.md`. Software GL means absolute frame times are not meaningful. CPU-side costs are.

### Baseline QA results

| Scenario | Result | Notes |
|---|---|---|
| boot | PASS | Menu in 1.7–7.7 s, depending on CPU contention |
| newgame | PASS | |
| controls | PASS | Movement, flashlight, flash, camcorder, map, items, pause and resume all work |
| deathRetry | PASS | Includes the Lazarus revive |
| shopLoop | PASS | Buy, descend, and the save persists across a reload |
| spam | PASS | 150 mixed keys and 12 Escapes |
| floors | PASS | All 30 floors build and play with zero errors |
| resize | FAIL | Test timing at large software-rendered sizes; re-check after the harness fix |
| corruptSave | **FAIL** | A page error makes menu buttons dead |
| scares | **FAIL** | The fake-crash overlay is still visible after quitting to the menu |
| perf | PASS | Relative only |

## Findings by lens

Severity is C (Critical), H (High), M (Medium) or L (Low).

### 1. Player experience
- **H:**
  - A floor load (the title card) takes **7.7 s on floor 30** and 3–5 s on typical floors (CPU profile, no contention).
  - The first load and each wing change is the slowest.
  - This is dead time in a game whose loop is "die, retry".
- **M:** The **floor 1 onboarding** delivers three mechanics in one 7-second text block at t=10 s: UV, flash and camcorder (`startFloor`, `HINTS`). It is "a wall of text", not teaching by doing.
- **M:** The fake-crash scare (`sigCrash`) can repeat every 55–100 s. A meta-scare works once; repeated, it feels cheap and can make players think the game really crashed.

### 2. Gameplay
- **L:** The core loop is solid: objective, avoid or burn, exit, shop. It has 6 quest types, 5 enemy types, 6 bosses, the Echo stalker, and upgrades.
- **L:** No dead mechanics were found. Every item and upgrade is read somewhere: `calcStats`, `useItem`, `DF()`.

### 3. Game feel
- **M:** **Camera shake** is per-frame white noise: `mr(-sh,sh)` in `syncCamera`. It reads as jitter, not impact. The standard fix is a trauma² model with smooth noise.
- **M:** The procedural glitch timer is frame-based (`S.gt-=1/60` in `secMotion`), so twitch frequency depends on frame rate.
- **L:** Movement acceleration (exponential, k=11) and stamina feel fine. Jump has no buffering, which is acceptable for horror.

### 4. Visual quality
- **L:** Strong art direction. A possible regression to check: the patient's new chest-wound blob reads as a red ball at distance (earlier screenshot).

### 5. Audio
- **M:** **No captions for important positional audio** (screams, footsteps behind, crying, whispers). Deaf and hard-of-hearing players miss core horror and gameplay information. Hearing the weeper is a mechanic.
- **L:** Synthesis has variation (randomized `mr` pitches). The mix uses a compressor.

### 6. Level design
- **L:** Procedural layouts. The floors sweep shows every quest type generating and exits present. No issues found within the test budget.

### 7. UI / UX
- **H:** **Corrupted `w13.settings` (e.g. non-numeric `vol`) makes every menu button dead.**
  - Evidence: `pageerror: Failed to set the 'value' property on 'AudioParam': non-finite`.
  - Cause: `audioInit()` runs first in every click handler (`bindUI → on()`) and sets `AU.master.gain.value=settings.vol`.
  - It survives a reload, so the player is permanently stuck until they clear site data.
- **M:** The fatal-error path (`loop` catch, then `fatal`) sets `state='paused'` without showing any screen. The player sees a frozen frame with a red line of text and no way back except reloading.
- **L:** No FOV setting. FOV is fixed at 74, kicking to 80 when sprinting.

### 8. Performance (CPU-side, representative)

| Hotspot (floor 30 load, 7.7 s) | Self time | Cause |
|---|---|---|
| `rmap` | 2.9 s | Per-pixel loop over every puddle at 1024²: about 40 M distance checks |
| canvas raster, `getImageData` | ~2 s (inside "program") | Thousands of 2D draw calls flushed on readback |
| `texImage2D` | 1.5 s | Nine 1024² RGBA uploads (map, normal, roughness for each surface) |
| WebGL program link (`Jr`) | 0.95 s | 32 programs |
| `nmap` | 0.8 s | `Math.hypot` and `%` in the inner loop (3× slower than needed; Node benchmark) |

- **M:** `perf()` dynamic resolution only ever lowers resolution and turns bloom off. It never restores them, so one hitch (for example during a load or a tab switch) permanently degrades the session.
- **L:** 32 shader programs and 38–41 textures. Reasonable.

### 9. Stability
- **H:** **Fear director state leaks across flow changes** (my own previous change).
  - `toMenu`, `die` and `completeFloor` do not reset `DIR`.
  - A fake crash interrupted by pause, then quit, leaves the overlay on the menu (QA confirmed) and the master volume muted until the next floor starts.
- **H:** **Save validation** only checks `v===3`.
  - A save with missing or `null` `inv`, `up`, `stats` or `notes` passes the check, then throws in `renderShop`, `calcStats` and `useItem`.
  - Partly masked in the baseline by the settings bug; to re-verify after that fix.
- **M:** Settings are not validated. `quality:'ultra'` happens to fall back safely through `qual()`. `sens`, `bright` and `vol` can be NaN or strings.

### 10. Accessibility
- **M:** No reduced-motion option for head bob, shake, FOV kick and screen warp. There is a photosensitivity toggle (`calm`).
- **M:** No sound captions (see Audio).
- **L:** No key rebinding or gamepad. The menu states keyboard and mouse are required. Gamepad is UNVERIFIED anyway: no device in the sandbox.

### 11. Progression
- **L:** Upgrade costs scale reasonably. The floor bonus (`20+lvl*4`) plus coins funds about one upgrade per floor. No predatory loops.

### 12. Replayability
- **L:** Seeded layouts, New Game+ with a difficulty multiplier, 3 endings, 30 notes. Good.

### 13. Technical architecture
- **M:** The game **cannot run offline.** three.js comes only from the cdnjs CDN. Offline, behind a blocking firewall, or if cdnjs is down, the page shows "The 3D engine could not be loaded."
  - The owner's very first request was simply to be able to open the game in a browser.
- **L:** The single-file closure is large but well sectioned. There is a test hook. Tunables live in tables (`UPG`, `SUP`, `DIFFS`, `WINGS`, `BOSSES`).

### 14. Security
- **L:** Single-player, local only. No network and no secrets. Save tampering only affects the player, except that malformed saves crash the game (see Stability).

### 15. Maintainability
- **L:** Dense minified-style code, but consistent and sectioned. There was no build tool and no tests (both added in this pass).

## Top 10 highest-impact weaknesses (player impact × frequency)
1. Corrupted settings make the menu dead, permanently (H, stability and UX).
2. Long floor loads, 3–8 s, on every retry and descent (H, performance and experience).
3. The game cannot start offline or without the CDN (M→H for this owner).
4. Fear director state leaks into the menu: overlay and muted audio (H, stability).
5. A malformed save crashes the shop or the game (H, stability).
6. Dynamic resolution never recovers (M, performance and visuals).
7. The fake-crash scare repeats and feels cheap (M, experience).
8. Camera shake is jitter, not impact, and there is no reduced-motion option (M, feel and accessibility).
9. Fatal errors leave a frozen screen with no recovery (M, UX).
10. No captions for gameplay-critical sounds (M, accessibility).
