# Assumptions

The owner left every field in the project brief blank. Each value below was inferred from the project and the earlier conversation.

| Field | Assumed value | Basis |
|---|---|---|
| Game name | Ward 13 — The Lazarus Protocol | `<title>` and menu |
| Engine | three.js r128, vanilla JS, a single HTML file | Script tag. The owner earlier asked to keep r128. |
| Genre and core fantasy | First-person psychological horror roguelite. The player should feel hunted, fragile, and resourceful with light. | Menu copy, the light and darkness mechanics, a 30-floor descent |
| Platforms and input | Desktop browsers (Chrome, Edge, Firefox) with keyboard and mouse | Menu says "Desktop browser with keyboard and mouse required" |
| Project location | `ward13/index.html` in this repo | — |
| Build and run | Open the HTML file. There is no build step today. | — |
| Known problems | None stated. The owner's history shows they care most that it opens and plays in a browser without fuss. | Earlier requests ("make it so i can open in browser", "still can't enter") |
| Desired features | "Make it insane", better rigs and textures, "the greatest horror game" | Owner's messages |
| Visual style | Grimy 1980s hospital, analog VHS, body horror. Darkness with selective light. | Existing art |
| Audio direction | Procedural drones, positional stingers, silence used as tension | Existing audio |
| Performance target | 60 fps at 1080p on medium quality on an integrated or mid-range GPU (e.g. Intel Iris Xe, GTX 1650). A floor should load in under 3 s on a typical laptop CPU. | No target given. These are standard expectations for a browser game. |
| Audience | Adult horror fans playing in a desktop browser | Content warning on the menu |
| Monetization | None | No store or ads |
| Hard constraints | Stay a single HTML file. Keep three.js r128. Keep saves working (`v:3`). No new runtime dependencies. | Owner's earlier instruction, and risk |
| Time budget | One long autonomous session | The request |

## Testing environment limits
- **Software GPU:** the sandbox has no GPU. Chromium runs on SwiftShader, so absolute frame times are 10–50× worse than real hardware. Frame-time numbers are **relative** comparisons only. CPU-side costs, such as texture generation and level build, are representative of a slow laptop CPU.
- **Fixed timestep:** `dt` is capped at 50 ms, so the game runs in slow motion under SwiftShader. Tests wait on state changes, not wall-clock time.
- **Audio:** audio output cannot be heard. Audio checks are limited to the WebAudio graph state, such as gain values and node counts.
- **Gamepad, touch and high-DPI:** these cannot be exercised with real devices. They are marked UNVERIFIED wherever they apply.
