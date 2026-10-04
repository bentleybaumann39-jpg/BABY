# Ward 13 — Performance Report (Phase 6)

**Environment:**
- Headless Chromium with SwiftShader software GL (no GPU) and `--disable-accelerated-2d-canvas`, so canvas painting runs on the CPU as it does on a typical machine.
- 4 CPU cores, 640×360 viewport.
- Absolute GPU frame times are **not** representative of real hardware. CPU-side numbers (JS time, texture generation) are.
- "Base" is commit `ab24062`, before this pass. "New" is the current build.
- Tools: `/tmp` A/B scripts (Chrome DevTools Protocol profiler), `tests/qa.mjs` `perf`/`dynres`/`soak`, `renderInfo()`.

## Load times (3 alternating runs each)

| Metric | Base | New | Change |
|---|---|---|---|
| Boot to menu | 1.52 / 1.61 / 2.03 s (median 1.61) | 1.47 / 1.49 / 1.64 s (median 1.49) | −7% |
| Floor 30 load (the Heart, wet flesh textures) | 7.56 / 6.04 / 7.28 s (median 7.28) | 3.50 / 3.84 / 3.38 s (median 3.50) | **−52%** |
| Floor 1 load | 5.37 / 11.70 / 4.55 s | 2.55 / 7.96 / 6.56 s | Too noisy to call. A separate 3-run profile gave 3.2–3.7 s new against 4.5–6.7 s base. |

## Where the load time went (floor 30, CPU profile, self time)

| Hotspot | Base | New | Fix |
|---|---|---|---|
| `rmap` (roughness and wet maps) | 2.8–3.3 s | 0.04–0.09 s | Half resolution; puddles applied only inside their bounding box (R-04) |
| `nmap` (normal maps) | ~0.85 s | ~0.45–0.65 s | No `%` or `Math.hypot` in the inner loop (R-04) |
| Roughness texture upload | 1024² × 3 | 512² × 3 | 4× less upload and GPU memory |
| Stale frames rendered during load | Rendered every frame behind the black title card | One black frame, then none | The build no longer waits on queued GPU work (root cause below) |

### Root-cause note: the regression found and fixed during this phase
- **What appeared:** after R-04, the A/B showed floor-1 load at **10–12 s, against 4.5–5 s base**, even though the JS work had shrunk.
- **Bisection:**
  - The old `nmap` plus the new `rmap` was fast.
  - The new `nmap` plus the old `rmap` was fast.
  - Only the combination was slow.
  - Adding a 1.5 s busy-wait made the load *faster*.
- **Root cause:** while loading, the loop kept rendering the previous floor behind the title card. With the build now finishing quickly, those queued frames made the build's GPU sync points (texture upload, program link) stall.
- **Fix:** in the `loading` state, render one black frame and then stop. This is also free GPU time on real hardware.
- **Result:** floor-1 load is a steady 3.2–3.7 s in profiled runs.

## Per-frame cost (floor 30, 15 s profile)

| | Base | New |
|---|---|---|
| JS per frame (game + three.js) | 5.3–8.6 ms | 4.7–4.9 ms |
| Game logic per frame | 0.3–0.9 ms | 0.7–1.5 ms |
| New systems (`pollPad`, `updTips`, captions) | — | under 0.2 ms combined |
| Draw calls / triangles (scene pass) | — | 157–181 calls, 31K–69K triangles |
| Shader programs | 31–32 | 31–32 |

Frame time under SwiftShader is GPU-bound: the native "(program)" time varies from 800 to 2,700 ms per frame between identical runs. The floor-30 median frame difference (base 817 ms, new 883 ms) is inside that noise. CPU-side JS per frame did not increase.

## Memory
- **JS heap after load:** about 16.7–17.4 MB (floor 1) and 12.4–13.0 MB (floor 30), the same for base and new.
- **GPU texture memory:** −9 MB per wing (three roughness maps at 512² instead of 1024², not counting mipmaps).
- **Soak:** see QA_REPORT (`soak`).

## Dynamic quality (R-06)
- The `dynres` scenario drives `perf()` with synthetic frame times.
- After a hitch, resolution and glow recover in about 8 s steps.
- A level that immediately proves too slow becomes a per-floor ceiling, which prevents oscillation.

## Remaining / UNVERIFIED
- **Real GPUs:** absolute load and frame times on real GPUs are UNVERIFIED (no GPU in the sandbox).
- **Shader compilation on Windows:** this is the largest remaining real-world load cost. Chrome on Windows (ANGLE/D3D) can take 50–300 ms per program for 31 programs on the first floor; Chrome caches them for later loads. three.js r128 has no parallel shader compile.
- **Reducing it further:** fewer material variants would help, at an art cost. Not attempted.
