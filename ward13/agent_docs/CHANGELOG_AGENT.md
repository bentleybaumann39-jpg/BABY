# Agent change log

| # | Change | Why | Files |
|---|---|---|---|
| 0 | Added the QA harness, vendored three.js r128, agent docs, and a `renderInfo`/`AU`/`settings` test hook (only when `window.__W13_TEST`) | Phases 1–3: baseline evidence and repeatable tests | `tests/qa.mjs`, `vendor/`, `agent_docs/`, `index.html` (test hook only) |
| 1 | Added `cleanSettings()` with a schema (`SET_DEF`/`SET_RULE`). It runs at load and on every save. New keys `still`, `fov` and `captions` are reserved for R-07/R-08. | R-01: a corrupt `vol` made `audioInit` throw inside every click handler, so the menu was dead | `index.html` (settings section) |
| 2 | Added `repairSave()`. It rebuilds a v3 save field by field onto `newSave()` defaults, clamping and dropping malformed data. | R-02: a partial save crashed the shop and the game | `index.html` (settings section) |
| 3 | Added `dirReset()`, called from `startFloor`, `toMenu`, `die`, `completeFloor`, `fatal` and `pause` (crash only). The fake crash runs at most once per session, never on floors 1–2, and scares don't repeat back to back. The glitch timer is now dt-based. | R-03 and R-10: the fear director leaked its overlay and muted audio into the menu, the meta-scare repeated, and the twitch rate depended on frame rate | `index.html` (DIR, flow, `secMotion`) |
| 4 | `nmap`: precomputed row offsets, no `%`, `sqrt` instead of `Math.hypot`. `rmap`: works at half resolution and applies puddles only inside each puddle's bounding box. | R-04: `rmap` (added in an earlier pass) was the single biggest JS cost of a floor load | `index.html` (procedural textures) |
| 5 | `tools/build.mjs` inlines `vendor/three.min.js` and writes `Ward13.html` (`--check` mode for QA). `index.html` falls back to `vendor/three.min.js` if the CDN fails. | R-05: the game could not start offline | `tools/build.mjs`, `Ward13.html`, `index.html` (boot script) |
| 6 | `perf()` rewritten with hysteresis and recovery. Added `perfSettle()` after loads, resume and notes. The "too slow" level becomes a per-floor ceiling. | R-06: dynamic resolution only ever degraded, so one hitch lowered quality for the whole session | `index.html` (safety nets, flow) |
