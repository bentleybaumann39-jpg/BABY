# THE WORLD OF POPPY - Storyboard and shot list

**Runtime: 300.0 s (5:00.0)** at 640x480, 30 fps. 11 segments, 87 shots. Real scares at 2:52.8, 3:42.0, 4:30.5 (gaps 49.2 s, 48.5 s).

This file and `assets.json` are generated from one source, so every asset path named here is in the manifest and every manifest entry is used here. Paths are relative to `/home/user/BABY/poppy/`. Times are `m:ss.s` from the start of the tape; cue offsets inside a shot are `+seconds` from the shot's first frame.

## 1. The tape in one paragraph

A home-video cassette of *THE WORLD OF POPPY, Volume 4: Counting with Poppy* (© 1995 Sunny Meadow Home Video). It plays like a cheerful 1990s educational show: a theme song, counting, feelings, friends. Small things are wrong (an eye in a flower, a face nobody introduced, a friend scribbled out), and Poppy goes still for too long. Then the tape cuts to camcorder footage someone recorded over it in June 1996: the empty studio, the Poppy costume slumped in a dressing room with nobody inside, a memo that is mundane until line 4. The chair empties. When the show comes back it is a different, wrong episode: Poppy wants to play hide and seek and counts over shots of *your* home until she reaches ten in your closet. Sunny Meadow's advisory asks you to stop the tape. You don't. She counts again. The theme plays one last time, slowed. The last frame is Poppy closer to the lens than ever. STOP.

## 2. Timeline at a glance

| # | Segment | Start | End | Dur | Act | What happens |
|---|---|---|---|---|---|---|
| 1 | TAPE START | 0:00.0 | 0:18.0 | 18.0 s | Act 1 | VCR loads the tape: blue screen, tracking, colour bars, the Sunny Meadow ident and a home-viewing card. Establishes the 'real 1995 tape' frame. |
| 2 | THEME SONG | 0:18.0 | 0:41.0 | 23.0 s | Act 1 | The full, cheerful theme with sing-along captions. Plants seeds: an empty slot where a third friend should be, Poppy with her eyes shut on 'Close your eyes and hide away', and the lyric 'Poppy finds you every day!'. |
| 3 | GREETING | 0:41.0 | 0:53.0 | 12.0 s | Act 1 | Poppy says hello in her bright playroom. Mostly normal; one line ('You look ready to play!') implies she can see you. |
| 4 | COUNTING TIME | 0:53.0 | 1:19.5 | 26.5 s | Act 1 | Poppy counts five felt flowers. Flower 5 has a human eye. She freezes for seven seconds, blinks one eye, and carries on as if nothing happened; when we cut back, the eye is looking at us. |
| 5 | FEELINGS TIME | 1:19.5 | 1:43.5 | 24.0 s | Act 1 | Four feelings faces, then a fifth nobody introduced: HUNGRY. 'It's okay to feel hungry, friend.' |
| 6 | POPPY'S FRIENDS | 1:43.5 | 2:01.0 | 17.5 s | Act 1 -> 2 | Roll call. Mr. Buttons and Dot get a hello; Pip's portrait is scribbled out. 'Pip didn't follow the rules.' Poppy turns (Stage 2) and the tape is spliced: it was recorded over. |
| 7 | RECORDED OVER: CAMCORDER | 2:01.0 | 2:55.6 | 54.6 s | Act 2 | Behind-the-scenes camcorder footage from June 1996 recorded over the show: the empty studio, the corridor, the costume slumped in a dressing-room chair, the memo. The chair empties; the costume stands at the end of the corridor; then it is in your face. EP quality throughout. |
| 8 | BACK TO THE SHOW (WRONG): HIDE AND SEEK | 2:55.6 | 3:44.2 | 48.6 s | Act 2 -> 3 | The splice ends inside a different, wrong episode: the playroom is dark and red, Poppy is stretched with black eyes and never opens her mouth. She counts for hide-and-seek over cuts to a viewer's home; the count slows and drops; she leaves the TV; 'Ten.' arrives in the closet. |
| 9 | A MESSAGE FROM SUNNY MEADOW | 3:44.2 | 4:15.2 | 31.0 s | Act 3 | Calm, low-stimulus advisory cards from the distributor while a music box winds down. The rules are harmless; one card explains the count. |
| 10 | THE TAPE DOES NOT STOP | 4:15.2 | 4:32.9 | 17.7 s | Act 3 | You didn't stop the tape. Poppy's voice in the empty dark playroom: 'Let's count again.' One, two, three over a 2-second rhythm, and the fourth cut comes early. |
| 11 | SEE YOU TOMORROW | 4:32.9 | 5:00.0 | 27.1 s | Act 3 | The theme comes back slowed and detuned, Poppy waves goodbye a little too close, the end card cracks, one last subliminal, and the final frame is Poppy closer to the lens than ever. Pause, tape stop, silence. |
| | **TOTAL** | 0:00.0 | 5:00.0 | **300.0 s** | | |

### Scare map

| Beat | Time | Shot | Setup | Hit |
|---|---|---|---|---|
| False scare 1 | 2:09.0 | 7c | camcorder drifting in the dark studio | `sfx_clunk` at -12 dBFS + whip pan; nothing there |
| **SCARE 1** | **2:52.8** | 7o | chair empties; costume at the end of the corridor; lights out; 2.0 s rhythm 7l-7m; 7n cut 0.7 s early after a hanger rattle pulls the eye LEFT | `poppy_scare_costume` 0.8 s + `sfx_stinger_1`; camera drops; near-silence |
| False scare 2 | 3:18.5 | 8g | hide-and-seek count in the hallway | `sfx_toy_fall` at -12 dBFS from screen-left |
| **SCARE 2** | **3:42.0** | 8m | count slows and deepens; 'Nine.' then 5.5 s of nothing on the closet; door moved between cuts; creak pulls the eye LEFT | `poppy_scare_closet` 0.7 s + whispered 'Ten.' + `sfx_stinger_2`; digital silence |
| **SCARE 3** | **4:30.5** | 10g | 'Let's count again'; One/Two/Three on a 2.0 s rhythm; 'Four' never comes; cut 0.7 s early; creak pulls the eye RIGHT | `poppy_scare_final` 0.9 s + `sfx_stinger_3` + `sfx_scream`; digital silence |

Subliminal frames (hidden inside glitches; 1-3 frames each):

| # | Time | Shot | Frames | Image |
|---|---|---|---|---|
| S1 | 2:00.4 | 6g | 2 | `build/art/misc/sub_eyes_dark.png` inside the recorded-over roll |
| S2 | 2:09.3 | 7c | 1 | `build/art/misc/sub_teeth.png` inside the whip-pan smear |
| S3 | 3:23.0 | 8i | 2 | colour-inverted `build/art/poppy/poppy_scare_closet.png` (foreshadows scare 2) |
| S4 | 4:03.4 | 9c | 2 | compositor text 'SHE IS COUNTING' |
| S5 | 4:53.2 | 11e | 3 | `build/art/misc/sub_crayon_house.png` |

'Did I see that?' moments (on screen for real, never mentioned): the empty third friend slot (2d), Poppy's eyes shut on 'hide away' (2e), the 7-second freeze and one-eyed blink (4c), the flower eye turning to the lens (4d), the HUNGRY face appearing un-introduced (5d), the set door ajar (6b), the mouth that keeps flapping after the line (5f), Poppy moving closer during a glitch (8b), Poppy gone from the TV (8j), the closet door wider (8l).

Silences: true digital silence only 3 times: 3:42.7 (after scare 2), 4:31.4 (after scare 3) and 4:57.9-end (after STOP). After scare 1 the tape goes to near-silence (camcorder hiss at -60 dBFS). Near-silences before scares sit at room tone (~-42 dBFS) with hiss.

## 3. Characters (design bible for the Poppy and misc artists)

All characters are ORIGINAL. Poppy is a felt mascot, not a doll: no porcelain, no hair, no curly red hair, no blue dress. No existing franchise characters, logos or companies anywhere. PG-13: no blood, no gore, no self-harm.

**POPPY** - the Sunny Meadow mascot, a felt puppet/costume character.

- **Head:** a big round felt head in warm cream-peach (#F3D9B8) with visible fibre texture (noise fill plus hundreds of 1-3 px fibre strokes, `ctx.filter='blur(0.6px)'`). About 10% too big for the body.
- **Petal bonnet:** a ring of 9 bright red poppy petals (#D7262B, crinkled tissue-like veins, darker #9E1A1F creases, a small black blotch at each petal's base like a real poppy) framing the whole face like a bonnet; the ring is ~1.5x the face width.
- **Seed-pod nose:** a shiny black button nose shaped like a poppy seed pod: a small black dome with a flat 7-ray star 'crown' stitched on top in dark grey. This is the black seed-pod motif.
- **Eyes (Stage 1):** white felt ovals (~18-20% of head width) with large glossy black button pupils (~25% of eye width) and a catchlight at the SAME pixel in both eyes; her left eye (screen right) 7% bigger and 3 px higher; one pupil offset outward by 0.08 eye-width so she looks 5-10 degrees past the viewer.
- **Cheeks and mouth:** pink felt cheek circles; a wide painted smile line in dark cherry (#6E1020) with corners under the eye centres and flat lower lids (the smile never reaches the eyes). Talking: an open rounded D, maroon inside, a pink felt tongue, no teeth.
- **Body:** a green felt 'stem' turtleneck with the neck 15% too long; bright yellow overalls (#F2C230) with two big white buttons and a red poppy patch on the bib pocket; a leaf-green long-sleeved shirt (#4E9A3A); white cartoon gloves with four fingers, each 1.4x too long; brown felt shoes. Arms reach mid-thigh. Head held tilted 12-20 degrees.

| Stage | Where | Eyes | Mouth | Head/body |
|---|---|---|---|---|
| 1 normal (always slightly off) | theme, greeting, counting, feelings, friends, final frame | button eyes with matched catchlight, one pupil off | closed smile / open D | 12-degree tilt, held still |
| 2a turned | `poppy_close_stare` (6f) | realistic painted eyes, sclera all round, 14% pupils, no catchlight | corners past the outer eye edges, 18-20 small square teeth | 25-degree tilt; never moves while talking |
| 2b wrong | `poppy_wrong_idle`, `poppy_cover_eyes` (segment 8) | flat glossy BLACK buttons, no catchlight (one realistic eye peeks through the fingers in cover_eyes) | stretched closed smile with a thin row of teeth | neck +25%, 25-degree tilt, arms to the knees |
| 3 scare | the three `poppy_scare_*` frames | realistic 8% pinpoint pupils (closet, costume) or huge black voids (final) | +30% wide, teeth fill it, or a screaming oval | stretched 12-15% vertically, under/rim lit, fills 75-90% of frame |

**The costume** (segment 7): the same Poppy design as an empty mascot costume: hollow head with a dark neck opening, black mesh vision holes instead of button eyes, a deflated body.

**Friends:** **Mr. Buttons**, a brown felt teddy bear with mismatched button eyes (one big blue four-hole button, one small black one), a red bow tie and a plaid-patched ear. **Dot**, a round red felt ladybug with black spots, pipe-cleaner antennae with pom-poms and rosy cheeks. **Pip**, a small round sky-blue felt bird with an orange beak and a feather tuft - only ever seen scribbled out.

**Sunny Meadow Home Video**: fictional distributor. Logo: a smiling sun rising over two green meadow hills with a rounded wordmark. No real-company resemblance, and no FBI or government warning screens anywhere.

## 4. Compositing conventions (for the compositor)

- **Base code:** start from `horror/make_video.py` (`Tape` timeline, `vhs()`, `color_bars()`, `card()`, `osd()`, `zoom()`, ffmpeg piping, final normalisation). Output `poppy/the_world_of_poppy.mp4`, 640x480, 30 fps, H.264 + AAC.
- **Anchors:** read `build/rooms/rooms_meta.json` (written by the rooms builder) for Poppy foot anchors, the felt-board slots, the bedroom TV screen quad, the dressing-room seat point and the corridor far-end anchor. Full-body Poppy frames share one canvas (420x640, feet at (210, 628)); close-ups share one canvas (640x480, head centre (320, 210)). Normal on-mark size in `playroom_wide`: ~330 px tall.
- **Grading:** grade cutouts to the room (multiply by a room tint, a slight blur of ~0.6 px, and a soft contact shadow under the feet). Red grade in the dark playroom; green cast in the camcorder footage.
- **Motion:** Poppy never moves smoothly. Mouths flap per the lip-flap rule (3-frame lag, minimum 3 frames per state); waves step at 6 fps (3 fps in the ending); everything else is stillness, or she 'moves between cuts' (or during a 2-frame glitch).
- **Larger art:** scare faces are 800x600, so centre-crop them for their push-ins. `playroom_dark` is 1280x960 and `bedroom_night`/`studio_night` are 960x720 so that crops of 1.4-2.2x stay sharp.
- **Scare frames:** clean (V0), the sharpest and best-lit images in the tape, and cut hard in and hard out.
- **VHS levels** (map onto `vhs()` plus the brief's additions; damage escalates with the story):

| Level | noise | jitter | chroma shift | dropouts/frame | extras |
|---|---|---|---|---|---|
| V0 CLEAN | 0.015 | 0.2 | 2 | 0 | slight unsharp mask, sat 1.0, lift 0.03 (scare frames only) |
| V1 light (Act 1) | 0.03 | 0.6 | 3 | 0-1 (p 0.15) | sat 0.85, warm tint, rightward-only chroma bleed, edge ringing |
| V2 medium | 0.05 | 1.0 | 4 | 0-2 | top-edge flagging (12 rows, up to 15 px), +-1 px frame wobble, sat 0.75 |
| V3 heavy | 0.08 | 1.6 | 6 | 2-5 | intermittent tracking band (0.3), flagging 20 rows, sat 0.65, occasional 1-row vertical hops |
| V4 wrecked | 0.14 | 3.0 | 9 | 4-8 | tracking 1.0, rainbow hue sweep, vertical roll with a 25 px black bar, audio garble |
| EP (camcorder) | x1.6 | - | - | +2 | luma blur k=5, chroma blur 25, green tint, autofocus hunting, exposure pumping (gain 0.7-1.0, 0.3 Hz noise) |

- **Dropouts:** horizontal dashes 1-2 rows high, 10-120 px long, filled from row y-1 with a bright comet tail to the right; fired in clustered bursts.
- **Camcorder OSD (segment 7):** drawn at 1/3 resolution and upscaled with nearest-neighbour, with a 2 px black shadow. '● REC' top-left blinking at 1 Hz; 'SP' and a battery icon top-right; 'JUN 14 1996' bottom-left; a clock bottom-right reading '11:52 PM' from 7a, '11:53 PM' from 7f and '11:54 PM' from 7l. No brand names.
- **VCR OSD:** DejaVu Sans Mono Bold 30, white with a 2 px black shadow: 'PLAY ▶' and the counter in 1b; 'STOP ■' in 11i.
- **Advisory cards (segment 9):** made in code (`card()`). Deep navy #101A4A background, `sm_logo` top-centre, white DejaVu Sans Mono Bold 26, lines left-aligned inside a centred block (so the cursor starts each new line at the text's left edge), text types on at ~25 characters per second with a soft teleprinter tick per character (-34 dBFS). Card D is on black with mono 40 and no logo.
- **Captions (theme and reprise):** yellow #FFE14D DejaVu Sans Bold 24 with a black outline, centred at y~440. The reprise uses a sickly pale yellow, offset 2-3 px from centre.
- **Audio mix:** (as mixed; these levels supersede the per-shot dBFS numbers below, which were written 5 dB hotter) dialogue, narrator and theme peak around -11 dBFS (crew whispers -13, reprise -13); bumpers -14; the show's music bed -14 peak in the gaps (about -27 dB RMS, so Act 1 sounds like a bouncy kids' show and its hard cuts at 4c and 6e are a 14-15 dB drop), ducked 8 dB under every line; the wrong bed -17; the music box -15 (its death at 9d is a 13 dB drop); ambiences -34 to -40 and room tone -42 as RMS targets; hiss -43 RMS (2-8 kHz band) plus 60 Hz hum -52 under everything except the digital silences; false scares -12; the misdirection cues (7n hanger, 8l and 10f creaks) -13 dBFS, hard-panned (12-13 dB louder on their side); teleprinter ticks -34; stingers saturated to be dense, attack under 5 ms: scare 1 about -6 dB, scare 2 about -5 dB and scare 3 about -3 dB RMS over 400 ms, 12-15 dB above the loudest dialogue and 24-32 dB above the previous 3 s. Bandwidth 80 Hz-8 kHz (100 Hz-6 kHz in segment 7). Add wow/flutter at 0.2% in Act 1, rising to 1-3% in segments 8-11, a garble on every tracking burst, and audio dropouts (-20 dB, 20-200 ms) synced to the picture's dropout clusters. Normalise the final mix to a -1 dBFS peak WITHOUT squashing the stingers (no limiter on the scare frames).
- **Every audio file is normalised by the audio builder** (voice to -3 dBFS, the rest to -1 dBFS). The dBFS numbers in the shot list are the peak levels to mix them at.

## 5. Voice presets and script (for the audio builder)

| Preset | Speaker | Delivery | Recipe |
|---|---|---|---|
| `poppy` | POPPY | normal: bright, sing-song kids'-show host | espeak-ng -v en-us+f3 -s 175 -p 85 -g 2 (vary -p 75-95 between phrases for sing-song); band-pass 250-4000 Hz; gentle tanh(1.5x); short room reverb (~0.3 s, 12% wet); normalise to -3 dBFS. |
| `poppy_flat` | POPPY | flat: same voice, slower, no melody, a little too close | espeak-ng -v en-us+f3 -s 140 -p 70 -g 4, no pitch variation; band-pass 250-4000 Hz; reverb 5% wet; -3 dBFS. |
| `poppy_wrong` | POPPY (WRONG) | slowed and deep, dry, too close | espeak-ng -v en-us+f3 -s 150 -p 60 -g 10, then resample x0.82 (about 3.4 semitones down and slower); add an octave-down double at -12 dB (e.g. render at double speed and resample x0.5 so lengths match); no reverb; full band 80-7000 Hz; light tanh; -3 dBFS. |
| `poppy_whisper` | POPPY (WHISPER) | dry whisper right at the microphone, hard attack | espeak-ng -v en-us+whisperf -s 120 -p 50; completely dry, full band, no fade-in (attack < 5 ms), normalise to -1 dBFS. |
| `narrator` | NARRATOR | Sunny Meadow announcer: warm, calm, corporate | espeak-ng -v en-us+m3 -s 160 -p 40 -g 4; band-pass 180-3600 Hz; tanh(2.0x) like speak() in horror/make_video.py; slight low-shelf warmth; -3 dBFS. |
| `crew` | CREW (camcorder operator) | nervous whisper, close to a cheap camcorder mic | espeak-ng -v en-us+whisper -s 160 -p 35; band-pass 300-3400 Hz (camcorder mic); -6 dBFS. |
| `poppy_sung` | POPPY (sung) | robotic sing-song vocal inside the music | poppy preset, one espeak render per word/syllable with -p chosen to follow the melody notes, placed on the beat. |

The hide-and-seek count `vo_hs_1`..`vo_hs_9` uses `poppy_wrong` with the resample factor stepping 0.90, 0.88, 0.86, 0.84, 0.81, 0.78, 0.75, 0.72, 0.68 (lower and slower each time), and the octave-down double rising from -18 dB to -6 dB; 8 and 9 are completely dry and close. `vo_hs_10` is the whisper.

Every line, in tape order. 'Max' is the longest the trimmed line may run and still fit its slot. Write the real durations into `build/audio/manifest.json`.

| File | Voice | Exact text | Max | Cue time(s) (shot) |
|---|---|---|---|---|
| `build/audio/vo_narr_ident.wav` | narrator | “Sunny Meadow Home Video presents...” | 2.6 s | 0:09.2 (1e) |
| `build/audio/vo_greet_1.wav` | poppy | “Hi, friend! It's me, Poppy! Welcome to my world!” | 4.2 s | 0:41.5 (3a) |
| `build/audio/vo_greet_2.wav` | poppy | “I'm so glad you came over. You look ready to play!” | 3.4 s | 0:46.0 (3a) |
| `build/audio/vo_greet_3.wav` | poppy | “Today we're going to have so much fun!” | 2.6 s | 0:49.6 (3a) |
| `build/audio/vo_count_intro.wav` | poppy | “Let's count my flower friends! Count with me, friend!” | 3.5 s | 0:55.3 (4b) |
| `build/audio/vo_count_1.wav` | poppy | “One!” | 0.9 s | 0:59.0 (4b) |
| `build/audio/vo_count_2.wav` | poppy | “Two!” | 0.9 s | 1:00.6 (4b) |
| `build/audio/vo_count_3.wav` | poppy | “Three!” | 0.9 s | 1:02.2 (4b) |
| `build/audio/vo_count_4.wav` | poppy | “Four!” | 0.9 s | 1:03.8 (4b) |
| `build/audio/vo_count_5.wav` | poppy | “Five!” | 0.9 s | 1:05.4 (4b) |
| `build/audio/vo_count_done.wav` | poppy | “Five flower friends! Great counting, friend!” | 3.4 s | 1:13.9 (4d) |
| `build/audio/vo_feel_intro.wav` | poppy | “How do we feel today? Let's look at our feelings faces!” | 3.9 s | 1:21.8 (5b) |
| `build/audio/vo_feel_happy.wav` | poppy | “This is happy!” | 1.1 s | 1:26.1 (5c) |
| `build/audio/vo_feel_sad.wav` | poppy | “This is sad.” | 1.1 s | 1:28.1 (5c) |
| `build/audio/vo_feel_angry.wav` | poppy | “This is angry!” | 1.1 s | 1:30.1 (5c) |
| `build/audio/vo_feel_scared.wav` | poppy | “This is scared.” | 1.1 s | 1:32.1 (5c) |
| `build/audio/vo_feel_hungry.wav` | poppy_flat | “This is hungry.” | 1.4 s | 1:37.3 (5f) |
| `build/audio/vo_feel_hungry_2.wav` | poppy_flat | “It's okay to feel hungry, friend.” | 2.8 s | 1:39.7 (5g) |
| `build/audio/vo_friends_intro.wav` | poppy | “Let's say hello to all my friends!” | 2.2 s | 1:45.7 (6b) |
| `build/audio/vo_friends_buttons.wav` | poppy | “Hello, Mister Buttons!” | 1.8 s | 1:48.4 (6c) |
| `build/audio/vo_friends_dot.wav` | poppy | “Hello, Dot!” | 1.3 s | 1:51.4 (6d) |
| `build/audio/vo_friends_pip.wav` | poppy_flat | “Pip didn't follow the rules.” | 2.1 s | 1:54.4 (6e) |
| `build/audio/vo_friends_pip_2.wav` | poppy_flat | “You follow the rules. Don't you, friend?” | 3.3 s | 1:56.7 (6f) |
| `build/audio/vo_crew_1.wav` | crew | “Okay. It's almost midnight. Studio B. Everybody went home.” | 5.0 s | 2:03.3 (7b) |
| `build/audio/vo_crew_2.wav` | crew | “Hello?” | 0.7 s | 2:10.4 (7d) |
| `build/audio/vo_crew_3.wav` | crew | “It's just a light stand.” | 1.6 s | 2:11.8 (7d) |
| `build/audio/vo_crew_4.wav` | crew | “Dana left it in dressing room two. She won't touch it anymore.” | 4.2 s | 2:14.5 (7e) |
| `build/audio/vo_crew_5.wav` | crew | “There it is.” | 0.9 s | 2:23.0 (7f) |
| `build/audio/vo_crew_6.wav` | crew | “Where did it go?” | 1.2 s | 2:38.7 (7h) |
| `build/audio/vo_wrong_welcome.wav` | poppy_wrong | “Welcome back, friend. I missed you.” | 4.0 s | 2:57.1 (8b) |
| `build/audio/vo_wrong_game.wav` | poppy_wrong | “Let's play hide and seek, friend! I'll count.” | 4.0 s | 3:01.1 (8b) |
| `build/audio/vo_hs_1.wav` | poppy_wrong | “One.” | 0.7 s | 3:06.4 (8c), 4:23.5 (10c) |
| `build/audio/vo_hs_2.wav` | poppy_wrong | “Two.” | 0.8 s | 3:08.9 (8d), 4:25.5 (10d) |
| `build/audio/vo_hs_3.wav` | poppy_wrong | “Three.” | 0.8 s | 3:11.5 (8e), 4:27.5 (10e) |
| `build/audio/vo_hs_4.wav` | poppy_wrong | “Four.” | 0.9 s | 3:14.1 (8f) |
| `build/audio/vo_hs_5.wav` | poppy_wrong | “Five.” | 1.0 s | 3:17.1 (8g) |
| `build/audio/vo_hs_6.wav` | poppy_wrong | “Six.” | 1.1 s | 3:20.7 (8h) |
| `build/audio/vo_hs_7.wav` | poppy_wrong | “Seven.” | 1.2 s | 3:23.8 (8i) |
| `build/audio/vo_hs_8.wav` | poppy_wrong | “Eight.” | 1.2 s | 3:27.5 (8j) |
| `build/audio/vo_hs_9.wav` | poppy_wrong | “Nine.” | 1.3 s | 3:31.7 (8k) |
| `build/audio/vo_hs_10.wav` | poppy_whisper | “Ten.” | 0.7 s | 3:42.0 (8m) |
| `build/audio/vo_narr_adv_a.wav` | narrator | “This videocassette was recalled in nineteen ninety-six. If you are watching it, please stop the tape.” | 6.6 s | 3:44.8 (9a) |
| `build/audio/vo_narr_adv_e.wav` | narrator | “Thank you for watching Sunny Meadow Home Video. Please stop the tape.” | 4.8 s | 4:09.5 (9e) |
| `build/audio/vo_wrong_stop.wav` | poppy_wrong | “You didn't stop the tape, friend.” | 3.2 s | 4:16.5 (10b) |
| `build/audio/vo_wrong_again.wav` | poppy_wrong | “That's okay. Let's count again.” | 3.4 s | 4:19.6 (10b) |
| `build/audio/vo_end_see_you.wav` | poppy | “See you tomorrow, friend!” | 1.9 s | 4:48.5 (11c) |

Song lyrics (inside the music files):

- `build/audio/mus_theme.wav`: Poppy, Poppy, red and bright, / in the meadow, warm and light! / Count the flowers, one, two, three, / feel your feelings, friends with me! / Close your eyes and hide away, / Poppy finds you every day! / (spoken) Hi, friend!
- `build/audio/mus_reprise.wav`: Poppy, Poppy, red and bright, / in your house, and out of sight. / Close your eyes and hide away, / Poppy found you. Now you stay.

## 6. Shot list

Each shot gives its timecode, duration, picture (with exact asset files), camera move, VHS level, audio cues and on-screen text.

### Segment 1 - TAPE START (0:00.0-0:18.0, 18.0 s, Act 1)

*VCR loads the tape: blue screen, tracking, colour bars, the Sunny Meadow ident and a home-viewing card. Establishes the 'real 1995 tape' frame.*

#### 1a · 0:00.0-0:01.0 (1.0 s) · Black, tape loads

- **Picture:** Pure black.
- **VHS:** none (black). Tape hiss fades in from +0.6 s.
- **Audio:** +0.0 s `build/audio/sfx_vcr_insert.wav` - cassette pushed in, mechanism clunk and whirr, -14 dBFS.

#### 1b · 0:01.0-0:03.5 (2.5 s) · VCR blue screen

- **Picture:** Flat VCR blue (R 0.08, G 0.08, B 0.75) with white OSD 'PLAY ▶' top-left and a tape counter '0:00:00' top-right (DejaVu Sans Mono Bold 30, 2 px black shadow), drawn by the compositor.
- **VHS:** V1 on the blue, no dropouts.
- **Audio:** Compositor: 60 Hz hum (-50 dBFS) joins the tape hiss (-40 dBFS, 2-8 kHz); both run under the whole tape except the digital silences.

#### 1c · 0:03.5-0:04.5 (1.0 s) · Tracking lock

- **Picture:** Static snow rolling vertically; a 'TRACKING' OSD bar (a row of small blocks filling left to right) at the bottom centre; the colour bars bleed in during the last 0.3 s.
- **VHS:** V4.
- **Audio:**
  - +0.0 s `build/audio/sfx_static_burst.wav` - -20 dBFS, trimmed to 1.0 s with a 0.3 s fade-out.
  - +0.6 s `build/audio/sfx_tracking_garble.wav` - -24 dBFS.

#### 1d · 0:04.5-0:08.0 (3.5 s) · Colour bars

- **Picture:** Colour bars (reuse color_bars() from horror/make_video.py) with a black caption strip reading 'SMV-0417   THE WORLD OF POPPY   VOL. 4' (mono 22).
- **VHS:** V1; a tracking band clears over the first 0.8 s.
- **Audio:** +0.0 s `build/audio/sfx_bars_tone.wav` - -20 dBFS; the compositor applies the tape-start pitch ramp (x0.6 -> x1.0 over the first 0.4 s).

#### 1e · 0:08.0-0:13.5 (5.5 s) · Sunny Meadow ident

- **Picture:** `build/art/misc/ident_sunny_meadow.png` full frame.
- **Camera:** Slow push 1.00 -> 1.04.
- **VHS:** V1, warm tint.
- **Audio:**
  - +0.1 s `build/audio/mus_ident_chime.wav` - -8 dBFS peak.
  - +1.2 s `build/audio/vo_narr_ident.wav` **NARRATOR** (Sunny Meadow announcer: warm, calm, corporate): “Sunny Meadow Home Video presents...”

#### 1f · 0:13.5-0:17.5 (4.0 s) · Home-viewing card

- **Picture:** Compositor-made card: deep navy (#101A4A) background, `build/art/misc/sm_logo.png` centred near the top (y~40), white centred text below (DejaVu Sans Bold). The tail of the ident chime rings out.
- **VHS:** V1.
- **Audio:** Hiss and hum only.
- **On-screen text:** THE WORLD OF POPPY / VOLUME 4: COUNTING WITH POPPY / © 1995 SUNNY MEADOW HOME VIDEO / FOR HOME VIEWING ONLY / BE KIND, PLEASE REWIND!

#### 1g · 0:17.5-0:18.0 (0.5 s) · Edit point

- **Picture:** Black; one vertical roll with a 25 px black bar passing through, 2 frames of rainbow hue sweep.
- **VHS:** V3.
- **Audio:** +0.0 s `build/audio/sfx_tracking_garble.wav` - -26 dBFS, trimmed to 0.4 s.

### Segment 2 - THEME SONG (0:18.0-0:41.0, 23.0 s, Act 1)

*The full, cheerful theme with sing-along captions. Plants seeds: an empty slot where a third friend should be, Poppy with her eyes shut on 'Close your eyes and hide away', and the lyric 'Poppy finds you every day!'.*

#### 2a · 0:18.0-0:23.0 (5.0 s) · Title card

- **Picture:** `build/art/misc/title_card.png` full frame.
- **Camera:** Slow push 1.00 -> 1.06.
- **VHS:** V1.
- **Audio:** +0.0 s `build/audio/mus_theme.wav` - theme starts at -6 dBFS peak and runs under 2a-2g (23.0 s). Use the line starts from build/audio/manifest.json for the captions.
- **On-screen text:** Sing-along caption from +2.0 s: 'Poppy, Poppy, red and bright,' (yellow #FFE14D DejaVu Sans Bold 24, black outline, centred at y~440; each caption shows from its line start to the next).

#### 2b · 0:23.0-0:26.0 (3.0 s) · Poppy waves

- **Picture:** `build/rooms/playroom_wide.png` with Poppy at her rug mark alternating `build/art/poppy/poppy_wave_a.png` / `build/art/poppy/poppy_wave_b.png` every 5 frames (6 fps wave).
- **Camera:** Static.
- **VHS:** V1.
- **On-screen text:** Caption: 'in the meadow, warm and light!'

#### 2c · 0:26.0-0:29.0 (3.0 s) · Flowers montage

- **Picture:** `build/art/misc/bumper_bg.png` with four flowers bouncing into the white panel left to right, one every 0.6 s from +0.1 s: `build/art/misc/flower_1.png`, `build/art/misc/flower_2.png`, `build/art/misc/flower_3.png`, `build/art/misc/flower_4.png` (each ~110 px tall, 6-frame squash-and-stretch 0.6 -> 1.1 -> 1.0).
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.1/+0.7/+1.3/+1.9 s `build/audio/sfx_pop.wav` - one per flower, -18 dBFS under the song.
- **On-screen text:** Caption: 'Count the flowers, one, two, three,'

#### 2d · 0:29.0-0:32.0 (3.0 s) · Friends montage

- **Picture:** `build/art/misc/bumper_bg.png` with `build/art/misc/friend_mr_buttons.png` (left, ~150 px wide) and `build/art/misc/friend_dot.png` (centre) bouncing in; the right-hand slot is EMPTY: only four faint tape marks where a third portrait used to be (compositor-drawn).
- **Camera:** Static.
- **VHS:** V1.
- **On-screen text:** Caption: 'feel your feelings, friends with me!'
- **Notes:** Seed: there should be three friends. Nobody mentions the empty slot.

#### 2e · 0:32.0-0:35.0 (3.0 s) · Eyes closed

- **Picture:** `build/rooms/playroom_wide.png` with `build/art/poppy/poppy_blink.png` at the rug mark, eyes shut and perfectly still for the whole shot.
- **Camera:** Static.
- **VHS:** V1.
- **On-screen text:** Caption: 'Close your eyes and hide away,'
- **Notes:** Seed: the hide-and-seek lyric. Her eyes stay closed 3 full seconds; no movement at all.

#### 2f · 0:35.0-0:38.0 (3.0 s) · Close-up

- **Picture:** `build/art/poppy/poppy_close.png` over `build/rooms/playroom_wide.png` blurred (Gaussian ~6 px, brightness x0.9).
- **Camera:** Push 1.00 -> 1.08 toward her eyes.
- **VHS:** V1.
- **On-screen text:** Caption: 'Poppy finds you every day!'
- **Notes:** Seed: she looks just past the lens, not at it.

#### 2g · 0:38.0-0:41.0 (3.0 s) · Title card with Poppy

- **Picture:** `build/art/misc/title_card.png` with Poppy waving (`build/art/poppy/poppy_wave_a.png` / `build/art/poppy/poppy_wave_b.png` at 6 fps) composited lower-right, feet near (540, 470), ~250 px tall.
- **Camera:** Static.
- **VHS:** V1.
- **On-screen text:** Caption at +0.4 s: 'Hi, friend!'
- **Notes:** The spoken 'Hi, friend!' is inside mus_theme at 20.4 s (2g +0.4 s); both wave frames have an open mouth, so no lip flap is needed.

### Segment 3 - GREETING (0:41.0-0:53.0, 12.0 s, Act 1)

*Poppy says hello in her bright playroom. Mostly normal; one line ('You look ready to play!') implies she can see you.*

#### 3a · 0:41.0-0:53.0 (12.0 s) · Hi, friend!

- **Picture:** `build/rooms/playroom_wide.png` with Poppy at the rug mark: lip flap between `build/art/poppy/poppy_idle.png` and `build/art/poppy/poppy_talk.png`; one 2-frame blink with `build/art/poppy/poppy_blink.png` at +4.6 s.
- **Camera:** Static, imperceptible push 1.00 -> 1.03.
- **VHS:** V1.
- **Audio:**
  - +0.0 s `build/audio/mus_playroom_bed.wav` - show music bed at -24 dBFS, looping under every show shot until 4c.
  - +0.5 s `build/audio/vo_greet_1.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Hi, friend! It's me, Poppy! Welcome to my world!”
  - +5.0 s `build/audio/vo_greet_2.wav` **POPPY** (normal: bright, sing-song kids'-show host): “I'm so glad you came over. You look ready to play!”
  - +8.6 s `build/audio/vo_greet_3.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Today we're going to have so much fun!”
- **Notes:** LIP FLAP RULE: show the talk frame while the voice's 20 ms RMS is above -30 dBFS, delayed by 3 frames, minimum 3 frames per mouth state.

### Segment 4 - COUNTING TIME (0:53.0-1:19.5, 26.5 s, Act 1)

*Poppy counts five felt flowers. Flower 5 has a human eye. She freezes for seven seconds, blinks one eye, and carries on as if nothing happened; when we cut back, the eye is looking at us.*

#### 4a · 0:53.0-0:55.0 (2.0 s) · Bumper: COUNTING TIME!

- **Picture:** `build/art/misc/bumper_bg.png` with compositor text 'COUNTING TIME!' bouncing into the panel (DejaVu Sans Bold 52, red #D7262B, 4 px yellow outline).
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.0 s `build/audio/mus_bumper.wav` - -10 dBFS; the music bed ducks 6 dB under it.

#### 4b · 0:55.0-1:06.5 (11.5 s) · Count with me

- **Picture:** `build/rooms/playroom_board.png` with Poppy at the right edge, cropped at the knees (head centre ~(545,150)), lip flap between `build/art/poppy/poppy_point.png` and `build/art/poppy/poppy_point_talk.png`. Flowers pop into board slots 1-5 (6-frame squash-and-stretch): `build/art/misc/flower_1.png` at +4.0, `build/art/misc/flower_2.png` at +5.6, `build/art/misc/flower_3.png` at +7.2, `build/art/misc/flower_4.png` at +8.8, `build/art/misc/flower_5_eye.png` at +10.4 s.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:**
  - +0.3 s `build/audio/vo_count_intro.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Let's count my flower friends! Count with me, friend!”
  - +4.0 s `build/audio/vo_count_1.wav` **POPPY** (normal: bright, sing-song kids'-show host): “One!”
  - +4.0/+5.6/+7.2/+8.8/+10.4 s `build/audio/sfx_pop.wav` - one per flower, -16 dBFS; the fifth pop resampled x0.7 so it lands low and wrong.
  - +5.6 s `build/audio/vo_count_2.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Two!”
  - +7.2 s `build/audio/vo_count_3.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Three!”
  - +8.8 s `build/audio/vo_count_4.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Four!”
  - +10.4 s `build/audio/vo_count_5.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Five!”
- **Notes:** Flower 5's eye looks toward Poppy, not at us. Nothing on screen reacts.

#### 4c · 1:06.5-1:13.5 (7.0 s) · THE FREEZE

- **Picture:** `build/art/poppy/poppy_close.png` over `build/rooms/playroom_board.png` blurred, held completely still. At +6.0 s swap to `build/art/poppy/poppy_close_wink.png` for exactly 2 frames (one-eyed blink), then back to poppy_close.
- **Camera:** Slow push 1.00 -> 1.10 toward her eyes: the camera moves, she does not.
- **VHS:** V1, plus one dropout cluster at +4.5 s (3-4 dropouts over 3 frames): the tape keeps living while she doesn't.
- **Audio:**
  - HARD CUT of mus_playroom_bed on the first frame (no fade). Hiss and hum continue (NOT digital silence).
  - +0.0 s `build/audio/amb_room_tone.wav` - -42 dBFS.
  - +3.0 s `build/audio/amb_drone.wav` - fades in from silence to -36 dBFS by +6.0 s, cut dead at the end of the shot.
- **Notes:** No voice for 7 seconds. The first wrongness the viewer cannot explain.

#### 4d · 1:13.5-1:19.5 (6.0 s) · As if nothing happened

- **Picture:** `build/rooms/playroom_board.png` as at the end of 4b, but `build/art/misc/flower_5_eye.png` is replaced by `build/art/misc/flower_5_eye_look.png`: the eye now looks into the lens. Poppy lip flap between `build/art/poppy/poppy_point_talk.png` and `build/art/poppy/poppy_point.png`.
- **Camera:** Static until +4.0 s, then an operator-style push 1.00 -> 2.4x centred on slot 5 over 1.5 s, held (as if the camera operator noticed). Flower 5 is re-composited at full art resolution so the eye (~60 px) visibly looks into the lens.
- **VHS:** V1.
- **Audio:**
  - mus_playroom_bed resumes on the first frame at its normal level, mid-phrase, no fade-in.
  - +0.4 s `build/audio/vo_count_done.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Five flower friends! Great counting, friend!”

### Segment 5 - FEELINGS TIME (1:19.5-1:43.5, 24.0 s, Act 1)

*Four feelings faces, then a fifth nobody introduced: HUNGRY. 'It's okay to feel hungry, friend.'*

#### 5a · 1:19.5-1:21.5 (2.0 s) · Bumper: FEELINGS TIME!

- **Picture:** `build/art/misc/bumper_bg.png` with compositor text 'FEELINGS TIME!' (same style as 4a).
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.0 s `build/audio/mus_bumper.wav` - -10 dBFS.

#### 5b · 1:21.5-1:26.0 (4.5 s) · How do we feel today?

- **Picture:** `build/rooms/playroom_board.png` (board blank, the flowers are gone) with Poppy lip flap `build/art/poppy/poppy_point_talk.png` / `build/art/poppy/poppy_point.png` at the right edge.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.3 s `build/audio/vo_feel_intro.wav` **POPPY** (normal: bright, sing-song kids'-show host): “How do we feel today? Let's look at our feelings faces!”

#### 5c · 1:26.0-1:34.0 (8.0 s) · Happy, sad, angry, scared

- **Picture:** Same composite (`build/rooms/playroom_board.png` + Poppy). Faces pop into slots 1-4: `build/art/misc/feel_happy.png` at +0.0, `build/art/misc/feel_sad.png` at +2.0, `build/art/misc/feel_angry.png` at +4.0, `build/art/misc/feel_scared.png` at +6.0 s. Poppy lip flap `build/art/poppy/poppy_point_talk.png` / `build/art/poppy/poppy_point.png`. No blinks in pointing shots (there is no eyes-closed pointing frame).
- **Camera:** Static.
- **VHS:** V1.
- **Audio:**
  - +0.0/+2.0/+4.0/+6.0 s `build/audio/sfx_pop.wav` - one per face, -16 dBFS.
  - +0.1 s `build/audio/vo_feel_happy.wav` **POPPY** (normal: bright, sing-song kids'-show host): “This is happy!”
  - +2.1 s `build/audio/vo_feel_sad.wav` **POPPY** (normal: bright, sing-song kids'-show host): “This is sad.”
  - +4.1 s `build/audio/vo_feel_angry.wav` **POPPY** (normal: bright, sing-song kids'-show host): “This is angry!”
  - +6.1 s `build/audio/vo_feel_scared.wav` **POPPY** (normal: bright, sing-song kids'-show host): “This is scared.”

#### 5d · 1:34.0-1:35.5 (1.5 s) · Nobody introduced it

- **Picture:** Same composite (`build/rooms/playroom_board.png`); at +0.2 s a 3-frame V3 tracking flicker, and when it clears `build/art/misc/feel_hungry.png` is simply there in slot 5 (no pop). Poppy switches to `build/art/poppy/poppy_idle.png` (stops pointing) and faces us.
- **Camera:** Static.
- **VHS:** V1, with the 3-frame V3 flicker.
- **Audio:**
  - The music bed's pitch sags ~30% over 0.4 s and recovers (compositor varispeed).
  - +0.2 s `build/audio/sfx_tracking_garble.wav` - -22 dBFS, 0.15 s.

#### 5e · 1:35.5-1:37.0 (1.5 s) · Insert: HUNGRY

- **Picture:** `build/rooms/playroom_board.png` cropped 2.5x on slot 5, with `build/art/misc/feel_hungry.png` re-composited at its full art resolution (not an upscale of the small composite) so the teeth and eyes are crisp.
- **Camera:** Dead still.
- **VHS:** V1.
- **Audio:** Music bed only.

#### 5f · 1:37.0-1:39.5 (2.5 s) · This is hungry.

- **Picture:** `build/art/poppy/poppy_close.png` over `build/rooms/playroom_board.png` blurred; lip flap with `build/art/poppy/poppy_close_talk.png`.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.3 s `build/audio/vo_feel_hungry.wav` **POPPY** (flat: same voice, slower, no melody, a little too close): “This is hungry.” - her mouth keeps flapping for 0.5 s AFTER the voice ends (lip-sync error).

#### 5g · 1:39.5-1:43.5 (4.0 s) · It's okay to feel hungry

- **Picture:** `build/rooms/playroom_board.png` two-shot, all five faces on the board, Poppy lip flap `build/art/poppy/poppy_idle.png` / `build/art/poppy/poppy_talk.png`.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.2 s `build/audio/vo_feel_hungry_2.wav` **POPPY** (flat: same voice, slower, no melody, a little too close): “It's okay to feel hungry, friend.” - then she holds absolutely still, no blink, to the end of the shot.

### Segment 6 - POPPY'S FRIENDS (1:43.5-2:01.0, 17.5 s, Act 1 -> 2)

*Roll call. Mr. Buttons and Dot get a hello; Pip's portrait is scribbled out. 'Pip didn't follow the rules.' Poppy turns (Stage 2) and the tape is spliced: it was recorded over.*

#### 6a · 1:43.5-1:45.5 (2.0 s) · Bumper: POPPY'S FRIENDS!

- **Picture:** `build/art/misc/bumper_bg.png` with compositor text "POPPY'S FRIENDS!".
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.0 s `build/audio/mus_bumper.wav` - -10 dBFS, resampled x0.97 (slightly flat).

#### 6b · 1:45.5-1:48.0 (2.5 s) · Hello, friends

- **Picture:** `build/rooms/playroom_wide_ajar.png` (the red back-wall door is now ajar; nobody comments) with Poppy lip flap `build/art/poppy/poppy_idle.png` / `build/art/poppy/poppy_talk.png` at the rug mark.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:** +0.2 s `build/audio/vo_friends_intro.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Let's say hello to all my friends!”

#### 6c · 1:48.0-1:51.0 (3.0 s) · Mr. Buttons

- **Picture:** `build/art/misc/bumper_bg.png` with `build/art/misc/friend_mr_buttons.png` centred (~300 px tall), 6-frame bounce-in.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:**
  - +0.0 s `build/audio/sfx_pop.wav` - -16 dBFS.
  - +0.4 s `build/audio/vo_friends_buttons.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Hello, Mister Buttons!”

#### 6d · 1:51.0-1:53.5 (2.5 s) · Dot

- **Picture:** `build/art/misc/bumper_bg.png` with `build/art/misc/friend_dot.png` centred, 6-frame bounce-in.
- **Camera:** Static.
- **VHS:** V1.
- **Audio:**
  - +0.0 s `build/audio/sfx_pop.wav` - -16 dBFS.
  - +0.4 s `build/audio/vo_friends_dot.wav` **POPPY** (normal: bright, sing-song kids'-show host): “Hello, Dot!”

#### 6e · 1:53.5-1:56.5 (3.0 s) · Pip

- **Picture:** `build/art/misc/bumper_bg.png` with `build/art/misc/friend_pip_scribbled.png` centred: no bounce, it is just there.
- **Camera:** Slow push 1.00 -> 1.05.
- **VHS:** V1.
- **Audio:**
  - mus_playroom_bed HARD CUT on the first frame.
  - +0.5 s `build/audio/sfx_scribble.wav` - -20 dBFS, 1.1 s (a half-second of bare hiss after the hard cut first).
  - +0.9 s `build/audio/vo_friends_pip.wav` **POPPY** (flat: same voice, slower, no melody, a little too close): “Pip didn't follow the rules.” - from off-screen.

#### 6f · 1:56.5-2:00.0 (3.5 s) · Don't you, friend?

- **Picture:** `build/art/poppy/poppy_close_stare.png` (Stage 2, FIRST appearance) over `build/rooms/playroom_wide_ajar.png` blurred. Dead still; her mouth never moves while she talks.
- **Camera:** No move.
- **VHS:** V2 (the noise floor steps up here and stays up).
- **Audio:**
  - +0.0 s `build/audio/amb_room_tone.wav` - -42 dBFS.
  - +0.2 s `build/audio/vo_friends_pip_2.wav` **POPPY** (flat: same voice, slower, no melody, a little too close): “You follow the rules. Don't you, friend?” - mouth closed the whole time; the splice in 6g may clip the reverb tail.

#### 6g · 2:00.0-2:01.0 (1.0 s) · RECORDED-OVER SPLICE

- **Picture:** 0.0-0.3 s heavy tracking band over the stare; 0.3-0.7 s rainbow hue sweep plus a vertical roll with a 25 px black bar; SUBLIMINAL S1 at +0.40 s: `build/art/misc/sub_eyes_dark.png` for 2 frames inside the roll; 0.7-1.0 s static snow.
- **VHS:** V4.
- **Audio:**
  - +0.0 s `build/audio/sfx_tracking_garble.wav` - -18 dBFS.
  - +0.3 s a 0.1 s audio pop/click (compositor).
  - +0.7 s `build/audio/sfx_static_burst.wav` - -20 dBFS, 0.3 s.

### Segment 7 - RECORDED OVER: CAMCORDER (2:01.0-2:55.6, 54.6 s, Act 2)

*Behind-the-scenes camcorder footage from June 1996 recorded over the show: the empty studio, the corridor, the costume slumped in a dressing-room chair, the memo. The chair empties; the costume stands at the end of the corridor; then it is in your face. EP quality throughout.*

#### 7a · 2:01.0-2:01.8 (0.8 s) · Camcorder starts

- **Picture:** Black; the camcorder OSD appears at +0.3 s; the picture fades up from black from +0.5 s.
- **VHS:** EP + V2. CAMCORDER OSD for all of segment 7 (see section 4).
- **Audio:**
  - Camcorder audio for the whole segment: band 100 Hz-6 kHz, faint motor whine -48 dBFS (compositor).
  - +0.1 s `build/audio/sfx_cam_beep.wav` - -18 dBFS.

#### 7b · 2:01.8-2:09.0 (7.2 s) · Studio B, after hours

- **Picture:** `build/rooms/studio_night.png` scaled to fill the frame.
- **Camera:** Handheld drift (low-pass noise, +-6 px, +-0.6 deg); autofocus blurry (Gaussian 4 px) -> sharp over the first 1.2 s; slow pan right 0 -> +40 px.
- **VHS:** EP + V2, green tint, exposure pumping.
- **Audio:**
  - +0.0 s `build/audio/amb_studio_night.wav` - -36 dBFS.
  - +0.5 s `build/audio/sfx_footsteps.wav` - -26 dBFS, soft.
  - +1.5 s `build/audio/vo_crew_1.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “Okay. It's almost midnight. Studio B. Everybody went home.”

#### 7c · 2:09.0-2:10.0 (1.0 s) · FALSE SCARE 1: the clunk

- **Picture:** `build/rooms/studio_night.png`; at +0.0 the camera jolts (6 px shake for 4 frames) and whip-pans right: horizontal motion smear (hblur ~60 px) for 8 frames, with SUBLIMINAL S2 inside the smear at +0.3 s: `build/art/misc/sub_teeth.png` for 1 frame; then it settles framed on the dark right side.
- **Camera:** Jolt, whip-pan right.
- **VHS:** EP + V2.
- **Audio:** +0.0 s `build/audio/sfx_clunk.wav` - -12 dBFS peak, from screen-right. Footsteps stop.

#### 7d · 2:10.0-2:13.5 (3.5 s) · Hello?

- **Picture:** `build/rooms/studio_night.png` cropped 1.4x on the right third (cx~0.82, cy~0.55): dark floor, the toppled light stand's edge, nothing else.
- **Camera:** Handheld, searching slightly.
- **VHS:** EP + V2; exposure pumps up (gain 0.7 -> 1.0) and the grain rises.
- **Audio:**
  - +0.4 s `build/audio/vo_crew_2.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “Hello?”
  - +1.8 s `build/audio/vo_crew_3.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “It's just a light stand.”

#### 7e · 2:13.5-2:20.5 (7.0 s) · The corridor

- **Picture:** `build/rooms/backstage_corridor.png`.
- **Camera:** Walking push 1.00 -> 1.18 with walking bob (+-4 px vertical at 1.8 Hz, +-2 px horizontal).
- **VHS:** EP + V2; fluorescent flicker (frame brightness dips to x0.7 for 1-2 frames, about once a second at random).
- **Audio:**
  - +0.0 s `build/audio/amb_fluorescent.wav` - -34 dBFS.
  - +0.0 s `build/audio/sfx_footsteps.wav` - -24 dBFS.
  - +1.0 s `build/audio/vo_crew_4.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “Dana left it in dressing room two. She won't touch it anymore.”

#### 7f · 2:20.5-2:26.5 (6.0 s) · There it is

- **Picture:** `build/rooms/dressing_room.png` with `build/art/poppy/costume_slumped.png` composited in the chair at the seat point from rooms_meta.json (graded to the room: green cast, slight blur to match).
- **Camera:** Autofocus hunts (blur 3 -> 0 -> 2 -> 0 px) over the first 1.5 s, then holds on the costume; slow push 1.00 -> 1.12 toward the costume head.
- **VHS:** EP + V2.
- **Audio:**
  - +0.0 s `build/audio/amb_fluorescent.wav` - -36 dBFS.
  - +2.5 s `build/audio/vo_crew_5.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “There it is.”

#### 7g · 2:26.5-2:36.5 (10.0 s) · The memo

- **Picture:** `build/art/misc/memo_card.png` as camcorder footage of the paper taped to the mirror. The memo keeps ~90 px side margins and its handwritten note ends above y~380, clear of the camcorder's date/clock band. The whole memo is in frame first (zoom 1.03, reading time to +4.0 s), drifts down to the items (1.09 by +6.0 s), then pushes to 1.21x on items 3-4 and the handwritten note by +7.5 s and holds to the end.
- **Camera:** Handheld drift and autofocus breathing throughout.
- **VHS:** EP + V2.
- **Audio:** +0.0 s `build/audio/amb_fluorescent.wav` - -36 dBFS. No voice: reading time.
- **Notes:** Key lines: '4. If the costume speaks when no one is inside it, do not answer it.' and 'Dana says it finished the song without her. - R.'

#### 7h · 2:36.5-2:41.5 (5.0 s) · The chair is empty

- **Picture:** `build/rooms/dressing_room.png` with NO costume: the chair is empty.
- **Camera:** Handheld, nearly still.
- **VHS:** EP + V2.
- **Audio:**
  - +0.0 s `build/audio/amb_fluorescent.wav` - -38 dBFS.
  - +0.0 s `build/audio/amb_drone.wav` - starts at -44 dBFS and swells to -30 dBFS by the end of 7m.
  - +2.2 s `build/audio/vo_crew_6.wav` **CREW (camcorder operator)** (nervous whisper, close to a cheap camcorder mic): “Where did it go?”

#### 7i · 2:41.5-2:45.0 (3.5 s) · Looking back

- **Picture:** `build/rooms/backstage_corridor.png` MIRRORED horizontally (looking back the way he came) with `build/art/poppy/costume_standing.png` composited small (~70 px tall) at the mirrored far-end anchor under the far tube, perfectly still.
- **Camera:** Handheld, nearly still.
- **VHS:** EP + V2; the far tube flickers twice; exposure pumping.
- **Audio:** Fluorescent hum and drone continue. No voice.

#### 7j · 2:45.0-2:45.5 (0.5 s) · Lights out

- **Picture:** The 7i frame (`build/rooms/backstage_corridor.png` mirrored) at x0.12 brightness; the costume is invisible in the dark.
- **VHS:** EP + V2.
- **Audio:** amb_fluorescent cuts out (the hum stops): room tone and drone only.

#### 7k · 2:45.5-2:47.5 (2.0 s) · Lights on: gone

- **Picture:** `build/rooms/backstage_corridor.png` mirrored, lights back on: the far end is EMPTY.
- **Camera:** Handheld.
- **VHS:** EP + V2.
- **Audio:** amb_fluorescent back on at -36 dBFS.

#### 7l · 2:47.5-2:49.5 (2.0 s) · Rhythm beat 1

- **Picture:** `build/rooms/dressing_room.png`, empty chair.
- **Camera:** Handheld.
- **VHS:** EP + V2.
- **Audio:** Hum and drone.
- **Notes:** 7l, 7m and 7n set up a 2.0 s cutting rhythm that 7n breaks 0.7 s early.

#### 7m · 2:49.5-2:51.5 (2.0 s) · Rhythm beat 2

- **Picture:** `build/rooms/backstage_corridor.png` mirrored, empty.
- **Camera:** Handheld.
- **VHS:** EP + V2.
- **Audio:** amb_drone pulled down to nothing at +1.0 s: only room tone and camcorder hiss remain (near-silence, ~-45 dBFS).

#### 7n · 2:51.5-2:52.8 (1.3 s) · Rhythm beat 3 (cut early)

- **Picture:** `build/rooms/dressing_room.png`, empty chair.
- **Camera:** At +0.5 s the camera drifts 12 px LEFT toward the sound.
- **VHS:** EP + V2.
- **Audio:** +0.5 s `build/audio/sfx_hanger.wav` - -13 dBFS, hard-panned screen-left: pulls attention left.

#### 7o · 2:52.8-2:53.6 (0.8 s) · SCARE 1

- **Picture:** `build/art/poppy/poppy_scare_costume.png` filling the frame (centre-cropped from 800x600). Keep the REC OSD on top (it is still the camcorder) and degrade the OSD layer with the same EP softness and chroma bleed as 7a-7n, but the image itself is CLEAN.
- **Camera:** Zoom 1.00 -> 1.06, shake +-6 px.
- **VHS:** V0 CLEAN under the OSD.
- **Audio:** +0.0 s `build/audio/sfx_stinger_1.wav` - peak -1 dBFS, attack < 5 ms; the compositor adds camcorder-mic overload (tanh drive x6) for the first 0.3 s.

#### 7p · 2:53.6-2:54.1 (0.5 s) · Camcorder drops

- **Picture:** `build/rooms/dressing_room.png` rotating 30 -> 110 degrees with heavy motion blur and static bars; the OSD jitters.
- **Camera:** Tumble.
- **VHS:** V4.
- **Audio:**
  - +0.0 s `build/audio/sfx_cam_drop.wav` - -8 dBFS.
  - +0.3 s `build/audio/sfx_static_burst.wav` - -18 dBFS, 0.2 s.

#### 7q · 2:54.1-2:55.6 (1.5 s) · Black

- **Picture:** Black.
- **VHS:** none.
- **Audio:** NEAR-silence: camcorder hiss only at -60 dBFS (deliberately NOT digital zero; save true silence for later).

### Segment 8 - BACK TO THE SHOW (WRONG): HIDE AND SEEK (2:55.6-3:44.2, 48.6 s, Act 2 -> 3)

*The splice ends inside a different, wrong episode: the playroom is dark and red, Poppy is stretched with black eyes and never opens her mouth. She counts for hide-and-seek over cuts to a viewer's home; the count slows and drops; she leaves the TV; 'Ten.' arrives in the closet.*

#### 8a · 2:55.6-2:56.5 (0.9 s) · Edit point out of the recording

- **Picture:** Rainbow roll; at +0.3 s, 3 frames of the ORIGINAL bright show bleeding through at 50% (`build/rooms/playroom_wide.png` + `build/art/poppy/poppy_idle.png`); then the roll settles on the dark playroom.
- **VHS:** V4.
- **Audio:** +0.0 s `build/audio/sfx_tracking_garble.wav` - -20 dBFS.

#### 8b · 2:56.5-3:06.0 (9.5 s) · Welcome back, friend

- **Picture:** `build/rooms/playroom_dark.png` (1280x960 scaled to 640x480) with `build/art/poppy/poppy_wrong_idle.png` at the rug mark at 1.15x her normal size (closer than her old mark), graded red. Dead still. At +4.2 s a 2-frame tracking flicker; when it clears she is at 1.3x (she moved closer during the glitch).
- **Camera:** Static.
- **VHS:** V2 -> V3 over the shot (red grade, saturation 0.65).
- **Audio:**
  - +0.0 s `build/audio/mus_playroom_bed_wrong.wav` - -26 dBFS.
  - +0.6 s `build/audio/vo_wrong_welcome.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Welcome back, friend. I missed you.” - her mouth never moves.
  - +4.6 s `build/audio/vo_wrong_game.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Let's play hide and seek, friend! I'll count.” - mouth still closed.

#### 8c · 3:06.0-3:08.5 (2.5 s) · One

- **Picture:** `build/rooms/playroom_dark.png` cropped 1.4x (centre) with `build/art/poppy/poppy_cover_eyes.png` scaled so her head and hands fill the upper half (cropped at the waist).
- **Camera:** Static.
- **VHS:** V3.
- **Audio:**
  - mus_playroom_bed_wrong HARD CUT on the first frame.
  - +0.0 s `build/audio/amb_drone.wav` - -40 dBFS, under the whole count.
  - +0.4 s `build/audio/vo_hs_1.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “One.”

#### 8d · 3:08.5-3:11.0 (2.5 s) · Two: your bedroom

- **Picture:** `build/rooms/bedroom_night.png` wide (960x720 scaled), then a push to 2.9x on the TV (+0.3 -> +2.1 s). The TV screen quad (rooms_meta.json) shows the 8c picture (`build/rooms/playroom_dark.png` + `build/art/poppy/poppy_cover_eyes.png`) perspective-warped in at x1.15 brightness with its own scanlines, plus a faint blue bloom onto the dresser: she is on your TV.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:**
  - +0.0 s `build/audio/amb_house_night.wav` - -38 dBFS, runs under 8d-8l.
  - +0.4 s `build/audio/vo_hs_2.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Two.” - processed as coming FROM THE TV: band-pass 300-3000 Hz, -6 dB.

#### 8e · 3:11.0-3:13.5 (2.5 s) · Three: the empty bed

- **Picture:** `build/rooms/bedroom_night.png` cropped 1.5x on the bed (covers thrown back, nobody there).
- **Camera:** Slow push 1.5x -> 1.6x.
- **VHS:** V3.
- **Audio:** +0.5 s `build/audio/vo_hs_3.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Three.” - from the TV, quieter, off-screen left.

#### 8f · 3:13.5-3:16.5 (3.0 s) · Four: the hallway

- **Picture:** `build/rooms/hallway_night.png`.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +0.6 s `build/audio/vo_hs_4.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Four.” - now full band, as if in the house rather than on the TV.

#### 8g · 3:16.5-3:20.0 (3.5 s) · Five + FALSE SCARE 2

- **Picture:** `build/rooms/hallway_night.png`.
- **Camera:** Push 1.00 -> 1.20 toward the far door; 3-frame jolt at +2.0 s.
- **VHS:** V3.
- **Audio:**
  - +0.6 s `build/audio/vo_hs_5.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Five.”
  - +2.0 s `build/audio/sfx_toy_fall.wav` - -12 dBFS, from screen-left.

#### 8h · 3:20.0-3:23.0 (3.0 s) · Six: closer

- **Picture:** `build/rooms/playroom_dark.png` cropped 1.6x with `build/art/poppy/poppy_cover_eyes.png` much closer (hands and face fill ~60% of the frame width); the realistic eye between the fingers is clearly peeking at us.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +0.7 s `build/audio/vo_hs_6.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Six.”

#### 8i · 3:23.0-3:26.5 (3.5 s) · Seven: the closet

- **Picture:** First 4 frames: a V4 tracking flicker containing SUBLIMINAL S3, a NEGATIVE (colour-inverted) `build/art/poppy/poppy_scare_closet.png` for 2 frames at +0.03 s. Then `build/rooms/closet_door.png`.
- **Camera:** Static.
- **VHS:** V3 (V4 for the first 4 frames).
- **Audio:**
  - +0.0 s `build/audio/sfx_tracking_garble.wav` - -24 dBFS, 0.15 s.
  - +0.8 s `build/audio/vo_hs_7.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Seven.”

#### 8j · 3:26.5-3:30.5 (4.0 s) · Eight: she left the TV

- **Picture:** `build/rooms/bedroom_night.png` at the identical 2.9x TV framing as the end of 8d. The TV now shows `build/rooms/playroom_dark.png` EMPTY (no Poppy): she has left the show. After 'Eight' (+1.9 s) the camera pulls back to the whole dark bedroom.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +1.0 s `build/audio/vo_hs_8.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Eight.” - NOT from the TV: full band, dry, close, slightly left of centre, in the room with you.

#### 8k · 3:30.5-3:38.5 (8.0 s) · Nine

- **Picture:** `build/rooms/closet_door.png`.
- **Camera:** Slow push 1.00 -> 1.10 into the black gap.
- **VHS:** V3.
- **Audio:**
  - From +2.5 s nothing but room tone (-42 dBFS) and the drone swelling from -40 to -28 dBFS; the drone drops out completely at +6.8 s (1.2 s of hiss only before the cut). No 'ten'.
  - +1.2 s `build/audio/vo_hs_9.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Nine.” - the deepest and slowest number.

#### 8l · 3:38.5-3:42.0 (3.5 s) · The door moved

- **Picture:** HARD CUT to `build/rooms/closet_door_open.png`: the door has opened wider between cuts.
- **Camera:** No push. Dead still.
- **VHS:** V3.
- **Audio:**
  - Otherwise hiss only. The count's rhythm says 'ten' should come about 1 s into the shot; it doesn't.
  - +2.2 s `build/audio/sfx_door_creak.wav` - -13 dBFS, trimmed to 0.8 s, hard-panned screen-left (pulls attention left).

#### 8m · 3:42.0-3:42.7 (0.7 s) · SCARE 2

- **Picture:** `build/art/poppy/poppy_scare_closet.png`, cropped in on the face so it fills ~80% of the frame width.
- **Camera:** Zoom 1.5 -> 1.6, shake +-4 px.
- **VHS:** V0 CLEAN.
- **Audio:**
  - +0.0 s `build/audio/vo_hs_10.wav` **POPPY (WHISPER)** (dry whisper right at the microphone, hard attack): “Ten.” - on the first frame, -3 dBFS.
  - +0.0 s `build/audio/sfx_stinger_2.wav` - peak -1 dBFS, attack < 5 ms.

#### 8n · 3:42.7-3:44.2 (1.5 s) · Black

- **Picture:** Black.
- **VHS:** none.
- **Audio:** DIGITAL SILENCE #1: true zero. Cut the stinger with a 5 ms fade on the first frame.

### Segment 9 - A MESSAGE FROM SUNNY MEADOW (3:44.2-4:15.2, 31.0 s, Act 3)

*Calm, low-stimulus advisory cards from the distributor while a music box winds down. The rules are harmless; one card explains the count.*

#### 9a · 3:44.2-3:52.2 (8.0 s) · Card A

- **Picture:** Compositor card (style in section 4) with the yellow header bar.
- **VHS:** V2.
- **Audio:**
  - +0.0 s `build/audio/mus_music_box.wav` - -15 dBFS (ducked 4 dB under the narrator); it runs 19.5 s and dies mid-phrase exactly on 9d's first frame.
  - +0.6 s `build/audio/vo_narr_adv_a.wav` **NARRATOR** (Sunny Meadow announcer: warm, calm, corporate): “This videocassette was recalled in nineteen ninety-six. If you are watching it, please stop the tape.”
- **On-screen text:** Header: 'A MESSAGE FROM SUNNY MEADOW HOME VIDEO'. Body: 'THIS VIDEOCASSETTE WAS RECALLED IN 1996. IF YOU ARE WATCHING IT, PLEASE STOP THE TAPE.'
- **Notes:** `build/art/misc/sm_logo.png` sits top-centre on cards A, B, C and E.

#### 9b · 3:52.2-3:57.7 (5.5 s) · Card B

- **Picture:** Compositor card.
- **VHS:** V2.
- **Audio:** Music box only.
- **On-screen text:** 'IF POPPY ASKS WHERE YOU LIVE, DO NOT ANSWER.'

#### 9c · 3:57.7-4:03.7 (6.0 s) · Card C

- **Picture:** Compositor card. At +5.6 s a 0.3 s V4 glitch containing SUBLIMINAL S4 at +5.7 s: 2 frames of compositor text 'SHE IS COUNTING' (white on black, mono 56).
- **VHS:** V2 (V4 for the last 0.3 s).
- **Audio:** +5.6 s `build/audio/sfx_tracking_garble.wav` - -22 dBFS, 0.3 s.
- **On-screen text:** 'IF POPPY IS IN YOUR HOME, DO NOT COUNT WITH HER.'

#### 9d · 4:03.7-4:08.7 (5.0 s) · Card D

- **Picture:** Compositor card on BLACK, no logo, larger text (mono 40), centred.
- **VHS:** V2.
- **Audio:** The music box has just died mid-phrase on the first frame. Hiss and hum only.
- **On-screen text:** 'SHE ALWAYS FINDS YOU ON TEN.'

#### 9e · 4:08.7-4:15.2 (6.5 s) · Card E

- **Picture:** Compositor card (navy, logo).
- **VHS:** V2.
- **Audio:** +0.8 s `build/audio/vo_narr_adv_e.wav` **NARRATOR** (Sunny Meadow announcer: warm, calm, corporate): “Thank you for watching Sunny Meadow Home Video. Please stop the tape.”
- **On-screen text:** 'THANK YOU FOR WATCHING SUNNY MEADOW HOME VIDEO. PLEASE STOP THE TAPE.'

### Segment 10 - THE TAPE DOES NOT STOP (4:15.2-4:32.9, 17.7 s, Act 3)

*You didn't stop the tape. Poppy's voice in the empty dark playroom: 'Let's count again.' One, two, three over a 2-second rhythm, and the fourth cut comes early.*

#### 10a · 4:15.2-4:15.7 (0.5 s) · Tracking roll

- **Picture:** Tracking roll from card E into the dark playroom.
- **VHS:** V4.
- **Audio:** +0.0 s `build/audio/sfx_tracking_garble.wav` - -22 dBFS.

#### 10b · 4:15.7-4:23.2 (7.5 s) · You didn't stop the tape

- **Picture:** `build/rooms/playroom_dark.png` wide, EMPTY: no Poppy anywhere.
- **Camera:** Static.
- **VHS:** V3, red grade.
- **Audio:**
  - +0.0 s `build/audio/amb_drone.wav` - -38 dBFS, rising slowly.
  - +0.8 s `build/audio/vo_wrong_stop.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “You didn't stop the tape, friend.” - from off-screen.
  - +3.9 s `build/audio/vo_wrong_again.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “That's okay. Let's count again.” - from off-screen.

#### 10c · 4:23.2-4:25.2 (2.0 s) · One (the chair)

- **Picture:** `build/rooms/playroom_dark.png` cropped 3.0x on the yellow chair (turned to face the wall), so the chair sits near the centre; the light spill on the cabinet and the shiny floor around it pulled down.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +0.3 s `build/audio/vo_hs_1.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “One.” - reused.

#### 10d · 4:25.2-4:27.2 (2.0 s) · Two (the doorway)

- **Picture:** `build/rooms/playroom_dark.png` cropped 2.2x on the open black doorway.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +0.3 s `build/audio/vo_hs_2.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Two.” - reused, full band (not from a TV).

#### 10e · 4:27.2-4:29.2 (2.0 s) · Three (the board)

- **Picture:** `build/rooms/playroom_dark.png` cropped 2.0x on the felt board, with `build/art/misc/feel_hungry.png` pinned alone in the middle, dim (x0.6, red graded).
- **Camera:** Static.
- **VHS:** V3.
- **Audio:**
  - amb_drone CUT on the first frame: from here to the scare only room tone (-42 dBFS), hiss and the voice (~3.3 s of near-silence).
  - +0.3 s `build/audio/vo_hs_3.wav` **POPPY (WRONG)** (slowed and deep, dry, too close): “Three.” - reused, full band.

#### 10f · 4:29.2-4:30.5 (1.3 s) · (Four never comes)

- **Picture:** `build/rooms/playroom_dark.png` wide, empty again.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:**
  - The viewer expects 'Four' at +0.3 s; it never comes. Near-silence.
  - +0.6 s `build/audio/sfx_door_creak.wav` - -13 dBFS, trimmed to 0.4 s, hard-panned screen-RIGHT (pulls attention right).
- **Notes:** Cut 0.7 s early against the 2.0 s rhythm of 10c-10e.

#### 10g · 4:30.5-4:31.4 (0.9 s) · SCARE 3

- **Picture:** `build/art/poppy/poppy_scare_final.png`, the whole 800x600 frame scaled to 640x480 (petals whole), extra contrast (bright face, pure black voids).
- **Camera:** Zoom 1.00 -> 1.08, shake +-8 px.
- **VHS:** V0 CLEAN.
- **Audio:**
  - +0.0 s `build/audio/sfx_stinger_3.wav` - peak -1 dBFS, attack < 5 ms.
  - +0.0 s `build/audio/sfx_scream.wav` - -3 dBFS.

#### 10h · 4:31.4-4:32.9 (1.5 s) · Black

- **Picture:** Black.
- **VHS:** none.
- **Audio:** DIGITAL SILENCE #2: true zero; cut the stinger and scream with a 5 ms fade.

### Segment 11 - SEE YOU TOMORROW (4:32.9-5:00.0, 27.1 s, Act 3)

*The theme comes back slowed and detuned, Poppy waves goodbye a little too close, the end card cracks, one last subliminal, and the final frame is Poppy closer to the lens than ever. Pause, tape stop, silence.*

#### 11a · 4:32.9-4:33.5 (0.6 s) · Tracking in

- **Picture:** Tracking roll into the title card.
- **VHS:** V4.
- **Audio:** +0.0 s `build/audio/sfx_static_burst.wav` - -24 dBFS, 0.3 s.

#### 11b · 4:33.5-4:41.5 (8.0 s) · Reprise: title

- **Picture:** `build/art/misc/title_card.png`, heavily degraded.
- **Camera:** Slow push 1.00 -> 1.05, wobble +-3 px.
- **VHS:** V3, saturation 0.5.
- **Audio:** +0.0 s `build/audio/mus_reprise.wav` - -8 dBFS peak; runs ~17 s across 11b-11c.
- **On-screen text:** Captions in sickly pale yellow, slightly misaligned (use manifest.json line starts): 'Poppy, Poppy, red and bright,' (~+1.0 s), 'in your house, and out of sight.' (~+4.6 s).

#### 11c · 4:41.5-4:50.5 (9.0 s) · Reprise: goodbye

- **Picture:** `build/art/misc/end_card.png` with Poppy waving lower-right (`build/art/poppy/poppy_wave_a.png` / `build/art/poppy/poppy_wave_b.png` alternating every 10 frames = 3 fps, stepped), at 1.7x her 2g size, head near y=200, her body cut off well below the frame edge (much closer than before). Normal Stage 1 Poppy: the friendliness is the wrong part.
- **Camera:** Static.
- **VHS:** V3.
- **Audio:** +7.0 s `build/audio/vo_end_see_you.wav` **POPPY** (normal: bright, sing-song kids'-show host): “See you tomorrow, friend!” - over the dying last note; the reprise is silent by ~+8.5 s.
- **On-screen text:** Captions: 'Close your eyes and hide away,' (~+0.2 s), 'Poppy found you. Now you stay.' (~+3.8 s).

#### 11d · 4:50.5-4:53.0 (2.5 s) · Cracked

- **Picture:** HARD CUT to `build/art/misc/end_card_cracked.png`. No Poppy.
- **Camera:** Slow push 1.00 -> 1.03.
- **VHS:** V3.
- **Audio:** Hiss only.

#### 11e · 4:53.0-4:53.5 (0.5 s) · Last subliminal

- **Picture:** V4 tracking burst; SUBLIMINAL S5 at +0.2 s: `build/art/misc/sub_crayon_house.png` for 3 frames.
- **VHS:** V4.
- **Audio:** +0.0 s `build/audio/sfx_tracking_garble.wav` - -22 dBFS.

#### 11f · 4:53.5-4:54.1 (0.6 s) · Static

- **Picture:** Static snow.
- **VHS:** V4.
- **Audio:** +0.0 s `build/audio/sfx_static_burst.wav` - -22 dBFS, 0.6 s.

#### 11g · 4:54.1-4:57.3 (3.2 s) · Closer than ever

- **Picture:** `build/art/poppy/poppy_final_close.png`: completely still, looking just past the lens. At +2.7 s the picture drops into VCR PAUSE (the two fields offset 1 px and jittering at 15 Hz, two horizontal noise bars) - she is still there, and the two fields are not the same picture: every other field is `build/art/poppy/poppy_final_close_look.png`, her pupils dead centre on the lens with no catchlight.
- **Camera:** None.
- **VHS:** V2 (calm, clean-ish), warm vignette.
- **Audio:**
  - Hiss (-40 dBFS), plus:
  - +0.0 s `build/audio/amb_house_night.wav` - very low, -46 dBFS (we are in the bedroom).

#### 11h · 4:57.3-4:57.9 (0.6 s) · Tape stop

- **Picture:** The picture collapses: vertical squash to a bright horizontal line while rolling.
- **VHS:** V4.
- **Audio:**
  - Program audio pitch-dives to zero over 0.5 s (compositor applies it to everything playing).
  - +0.5 s `build/audio/sfx_vcr_stop.wav` - -12 dBFS.

#### 11i · 4:57.9-4:59.3 (1.4 s) · STOP

- **Picture:** VCR blue screen with OSD 'STOP ■'.
- **VHS:** none.
- **Audio:** Only the tail of sfx_vcr_stop, then nothing (no hiss, no hum).

#### 11j · 4:59.3-5:00.0 (0.7 s) · Black

- **Picture:** Black.
- **VHS:** none.
- **Audio:** DIGITAL SILENCE #3 to the end.

## 7. Asset index

Every file the builders produce, and every shot that uses it. The full specs are in `assets.json`.

### Blender rooms (11)

| File | Size | Used in |
|---|---|---|
| `build/rooms/playroom_wide.png` | 640x480 | 2b, 2e, 2f, 3a, 8a |
| `build/rooms/playroom_wide_ajar.png` | 640x480 | 6b, 6f |
| `build/rooms/playroom_board.png` | 640x480 | 4b, 4c, 4d, 5b, 5c, 5d, 5e, 5f, 5g |
| `build/rooms/playroom_dark.png` | 1280x960 | 8b, 8c, 8d, 8h, 8j, 10b, 10c, 10d, 10e, 10f |
| `build/rooms/studio_night.png` | 960x720 | 7b, 7c, 7d |
| `build/rooms/backstage_corridor.png` | 640x480 | 7e, 7i, 7j, 7k, 7m |
| `build/rooms/dressing_room.png` | 640x480 | 7f, 7h, 7l, 7n, 7p |
| `build/rooms/bedroom_night.png` | 960x720 | 8d, 8e, 8j |
| `build/rooms/hallway_night.png` | 640x480 | 8f, 8g |
| `build/rooms/closet_door.png` | 640x480 | 8i, 8k |
| `build/rooms/closet_door_open.png` | 640x480 | 8l |

### Poppy art (20)

| File | Size | Used in |
|---|---|---|
| `build/art/poppy/poppy_idle.png` | 420x640 alpha | 3a, 5d, 5g, 6b, 8a |
| `build/art/poppy/poppy_talk.png` | 420x640 alpha | 3a, 5g, 6b |
| `build/art/poppy/poppy_blink.png` | 420x640 alpha | 2e, 3a |
| `build/art/poppy/poppy_wave_a.png` | 420x640 alpha | 2b, 2g, 11c |
| `build/art/poppy/poppy_wave_b.png` | 420x640 alpha | 2b, 2g, 11c |
| `build/art/poppy/poppy_point.png` | 420x640 alpha | 4b, 4d, 5b, 5c |
| `build/art/poppy/poppy_point_talk.png` | 420x640 alpha | 4b, 4d, 5b, 5c |
| `build/art/poppy/poppy_close.png` | 640x480 alpha | 2f, 4c, 5f |
| `build/art/poppy/poppy_close_talk.png` | 640x480 alpha | 5f |
| `build/art/poppy/poppy_close_wink.png` | 640x480 alpha | 4c |
| `build/art/poppy/poppy_close_stare.png` | 640x480 alpha | 6f |
| `build/art/poppy/poppy_wrong_idle.png` | 420x640 alpha | 8b |
| `build/art/poppy/poppy_cover_eyes.png` | 420x640 alpha | 8c, 8d, 8h |
| `build/art/poppy/costume_slumped.png` | 420x480 alpha | 7f |
| `build/art/poppy/costume_standing.png` | 240x640 alpha | 7i |
| `build/art/poppy/poppy_scare_costume.png` | 800x600 opaque | 7o |
| `build/art/poppy/poppy_scare_closet.png` | 800x600 opaque | 8i, 8m |
| `build/art/poppy/poppy_scare_final.png` | 800x600 opaque | 10g |
| `build/art/poppy/poppy_final_close.png` | 640x480 opaque | 11g |
| `build/art/poppy/poppy_final_close_look.png` | 640x480 opaque | 11g |

### Misc art (24)

| File | Size | Used in |
|---|---|---|
| `build/art/misc/ident_sunny_meadow.png` | 640x480 opaque | 1e |
| `build/art/misc/sm_logo.png` | 240x160 alpha | 1f, 9a |
| `build/art/misc/title_card.png` | 640x480 opaque | 2a, 2g, 11b |
| `build/art/misc/bumper_bg.png` | 640x480 opaque | 2c, 2d, 4a, 5a, 6a, 6c, 6d, 6e |
| `build/art/misc/flower_1.png` | 200x320 alpha | 2c, 4b |
| `build/art/misc/flower_2.png` | 200x320 alpha | 2c, 4b |
| `build/art/misc/flower_3.png` | 200x320 alpha | 2c, 4b |
| `build/art/misc/flower_4.png` | 200x320 alpha | 2c, 4b |
| `build/art/misc/flower_5_eye.png` | 200x320 alpha | 4b, 4d |
| `build/art/misc/flower_5_eye_look.png` | 200x320 alpha | 4d |
| `build/art/misc/feel_happy.png` | 240x300 alpha | 5c |
| `build/art/misc/feel_sad.png` | 240x300 alpha | 5c |
| `build/art/misc/feel_angry.png` | 240x300 alpha | 5c |
| `build/art/misc/feel_scared.png` | 240x300 alpha | 5c |
| `build/art/misc/feel_hungry.png` | 240x300 alpha | 5d, 5e, 10e |
| `build/art/misc/friend_mr_buttons.png` | 320x360 alpha | 2d, 6c |
| `build/art/misc/friend_dot.png` | 320x360 alpha | 2d, 6d |
| `build/art/misc/friend_pip_scribbled.png` | 320x360 alpha | 6e |
| `build/art/misc/memo_card.png` | 640x480 opaque | 7g |
| `build/art/misc/end_card.png` | 640x480 opaque | 11c |
| `build/art/misc/end_card_cracked.png` | 640x480 opaque | 11d |
| `build/art/misc/sub_crayon_house.png` | 640x480 opaque | 11e |
| `build/art/misc/sub_eyes_dark.png` | 640x480 opaque | 6g |
| `build/art/misc/sub_teeth.png` | 640x480 opaque | 7c |

### Audio (76)

| File | Kind | Target length | Used in |
|---|---|---|---|
| `build/audio/mus_ident_chime.wav` | music | 5.0 s | 1e |
| `build/audio/mus_theme.wav` | music | 23.0 s | 2a |
| `build/audio/mus_bumper.wav` | music | 2.0 s | 4a, 5a, 6a |
| `build/audio/mus_playroom_bed.wav` | music | 30.0 s | 3a |
| `build/audio/mus_playroom_bed_wrong.wav` | music | 30.0 s | 8b |
| `build/audio/mus_music_box.wav` | music | 19.5 s | 9a |
| `build/audio/mus_reprise.wav` | music | 17.0 s | 11b |
| `build/audio/amb_room_tone.wav` | ambience | 20.0 s | 4c, 6f |
| `build/audio/amb_studio_night.wav` | ambience | 20.0 s | 7b |
| `build/audio/amb_fluorescent.wav` | ambience | 20.0 s | 7e, 7f, 7g, 7h |
| `build/audio/amb_house_night.wav` | ambience | 20.0 s | 8d, 11g |
| `build/audio/amb_drone.wav` | ambience | 20.0 s | 4c, 7h, 8c, 10b |
| `build/audio/sfx_vcr_insert.wav` | sfx | 1.2 s | 1a |
| `build/audio/sfx_vcr_stop.wav` | sfx | 0.6 s | 11h |
| `build/audio/sfx_bars_tone.wav` | sfx | 4.0 s | 1d |
| `build/audio/sfx_static_burst.wav` | sfx | 1.5 s | 1c, 6g, 7p, 11a, 11f |
| `build/audio/sfx_tracking_garble.wav` | sfx | 0.6 s | 1c, 1g, 5d, 6g, 8a, 8i, 9c, 10a, 11e |
| `build/audio/sfx_pop.wav` | sfx | 0.3 s | 2c, 4b, 5c, 6c, 6d |
| `build/audio/sfx_scribble.wav` | sfx | 1.5 s | 6e |
| `build/audio/sfx_cam_beep.wav` | sfx | 0.4 s | 7a |
| `build/audio/sfx_footsteps.wav` | sfx | 8.0 s | 7b, 7e |
| `build/audio/sfx_clunk.wav` | sfx | 1.5 s | 7c |
| `build/audio/sfx_hanger.wav` | sfx | 0.8 s | 7n |
| `build/audio/sfx_cam_drop.wav` | sfx | 0.8 s | 7p |
| `build/audio/sfx_toy_fall.wav` | sfx | 1.2 s | 8g |
| `build/audio/sfx_door_creak.wav` | sfx | 2.0 s | 8l, 10f |
| `build/audio/sfx_stinger_1.wav` | sfx | 1.0 s | 7o |
| `build/audio/sfx_stinger_2.wav` | sfx | 1.0 s | 8m |
| `build/audio/sfx_stinger_3.wav` | sfx | 1.4 s | 10g |
| `build/audio/sfx_scream.wav` | sfx | 1.4 s | 10g |
| `build/audio/vo_narr_ident.wav` | voice | 2.6 s | 1e |
| `build/audio/vo_greet_1.wav` | voice | 4.2 s | 3a |
| `build/audio/vo_greet_2.wav` | voice | 3.4 s | 3a |
| `build/audio/vo_greet_3.wav` | voice | 2.6 s | 3a |
| `build/audio/vo_count_intro.wav` | voice | 3.5 s | 4b |
| `build/audio/vo_count_1.wav` | voice | 0.9 s | 4b |
| `build/audio/vo_count_2.wav` | voice | 0.9 s | 4b |
| `build/audio/vo_count_3.wav` | voice | 0.9 s | 4b |
| `build/audio/vo_count_4.wav` | voice | 0.9 s | 4b |
| `build/audio/vo_count_5.wav` | voice | 0.9 s | 4b |
| `build/audio/vo_count_done.wav` | voice | 3.4 s | 4d |
| `build/audio/vo_feel_intro.wav` | voice | 3.9 s | 5b |
| `build/audio/vo_feel_happy.wav` | voice | 1.1 s | 5c |
| `build/audio/vo_feel_sad.wav` | voice | 1.1 s | 5c |
| `build/audio/vo_feel_angry.wav` | voice | 1.1 s | 5c |
| `build/audio/vo_feel_scared.wav` | voice | 1.1 s | 5c |
| `build/audio/vo_feel_hungry.wav` | voice | 1.4 s | 5f |
| `build/audio/vo_feel_hungry_2.wav` | voice | 2.8 s | 5g |
| `build/audio/vo_friends_intro.wav` | voice | 2.2 s | 6b |
| `build/audio/vo_friends_buttons.wav` | voice | 1.8 s | 6c |
| `build/audio/vo_friends_dot.wav` | voice | 1.3 s | 6d |
| `build/audio/vo_friends_pip.wav` | voice | 2.1 s | 6e |
| `build/audio/vo_friends_pip_2.wav` | voice | 3.3 s | 6f |
| `build/audio/vo_crew_1.wav` | voice | 5.0 s | 7b |
| `build/audio/vo_crew_2.wav` | voice | 0.7 s | 7d |
| `build/audio/vo_crew_3.wav` | voice | 1.6 s | 7d |
| `build/audio/vo_crew_4.wav` | voice | 4.2 s | 7e |
| `build/audio/vo_crew_5.wav` | voice | 0.9 s | 7f |
| `build/audio/vo_crew_6.wav` | voice | 1.2 s | 7h |
| `build/audio/vo_wrong_welcome.wav` | voice | 4.0 s | 8b |
| `build/audio/vo_wrong_game.wav` | voice | 4.0 s | 8b |
| `build/audio/vo_hs_1.wav` | voice | 0.7 s | 8c, 10c |
| `build/audio/vo_hs_2.wav` | voice | 0.8 s | 8d, 10d |
| `build/audio/vo_hs_3.wav` | voice | 0.8 s | 8e, 10e |
| `build/audio/vo_hs_4.wav` | voice | 0.9 s | 8f |
| `build/audio/vo_hs_5.wav` | voice | 1.0 s | 8g |
| `build/audio/vo_hs_6.wav` | voice | 1.1 s | 8h |
| `build/audio/vo_hs_7.wav` | voice | 1.2 s | 8i |
| `build/audio/vo_hs_8.wav` | voice | 1.2 s | 8j |
| `build/audio/vo_hs_9.wav` | voice | 1.3 s | 8k |
| `build/audio/vo_hs_10.wav` | voice | 0.7 s | 8m |
| `build/audio/vo_narr_adv_a.wav` | voice | 6.6 s | 9a |
| `build/audio/vo_narr_adv_e.wav` | voice | 4.8 s | 9e |
| `build/audio/vo_wrong_stop.wav` | voice | 3.2 s | 10b |
| `build/audio/vo_wrong_again.wav` | voice | 3.4 s | 10b |
| `build/audio/vo_end_see_you.wav` | voice | 1.9 s | 11c |

Not files (the compositor makes these in code): tape hiss, 60 Hz hum, colour bars, OSDs, the home-viewing card, advisory cards A-E, bumper titles, captions, the 'SHE IS COUNTING' subliminal, the negative of `poppy_scare_closet`, the tape-start and tape-stop pitch ramps, and all VHS damage.

## 8. Builder hand-off checklist

- **Rooms (Blender, bpy 5.2, Cycles CPU, 32-64 samples, denoising on):** 11 renders, three of them variants of the same .blend (`playroom_wide` / `playroom_wide_ajar` / `playroom_dark`, and `closet_door` / `closet_door_open`). Write `build/rooms/rooms_meta.json` with the anchors listed in each room's notes. Leave the empty spaces described; never put a figure in a room.
- **Poppy art (canvas):** 19 files. Keep identical registration inside each family (full-body, close-up) so frames can be swapped without jumping. Make a contact sheet and check the Stage 1 frames look friendly at a glance and only slightly off, and that the scare frames are the sharpest, most finished images.
- **Misc art (canvas):** 24 files. Felt texture for the show props; real-paper texture for the memo and crayon drawing. Text inside the art must be spelled exactly as given.
- **Audio (numpy + espeak-ng):** 76 files at 44.1 kHz mono 16-bit, plus `build/audio/manifest.json` with each file's duration and the `lyrics` start times for `mus_theme` and `mus_reprise`.
- **Compositor:** follow sections 2, 4 and 6. Total runtime must stay within 290-310 s; if a voice line comes back longer than its slot, extend the shot's hold and trim the following static/black shot rather than moving the scare beats.

## 9. Machine-readable shot list

One shot per line: id, segment, start (s), duration (s), title, asset files, and audio cues as [absolute start in s, file]. Mix levels and processing for each cue are in section 6.

```json
[
  {"id": "1a", "seg": "1", "start": 0.0, "dur": 1.0, "title": "Black, tape loads", "assets": ["build/audio/sfx_vcr_insert.wav"], "cues": [[0.0, "build/audio/sfx_vcr_insert.wav"]]},
  {"id": "1b", "seg": "1", "start": 1.0, "dur": 2.5, "title": "VCR blue screen", "assets": [], "cues": []},
  {"id": "1c", "seg": "1", "start": 3.5, "dur": 1.0, "title": "Tracking lock", "assets": ["build/audio/sfx_static_burst.wav", "build/audio/sfx_tracking_garble.wav"], "cues": [[3.5, "build/audio/sfx_static_burst.wav"], [4.1, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "1d", "seg": "1", "start": 4.5, "dur": 3.5, "title": "Colour bars", "assets": ["build/audio/sfx_bars_tone.wav"], "cues": [[4.5, "build/audio/sfx_bars_tone.wav"]]},
  {"id": "1e", "seg": "1", "start": 8.0, "dur": 5.5, "title": "Sunny Meadow ident", "assets": ["build/art/misc/ident_sunny_meadow.png", "build/audio/mus_ident_chime.wav", "build/audio/vo_narr_ident.wav"], "cues": [[8.1, "build/audio/mus_ident_chime.wav"], [9.2, "build/audio/vo_narr_ident.wav"]]},
  {"id": "1f", "seg": "1", "start": 13.5, "dur": 4.0, "title": "Home-viewing card", "assets": ["build/art/misc/sm_logo.png"], "cues": []},
  {"id": "1g", "seg": "1", "start": 17.5, "dur": 0.5, "title": "Edit point", "assets": ["build/audio/sfx_tracking_garble.wav"], "cues": [[17.5, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "2a", "seg": "2", "start": 18.0, "dur": 5.0, "title": "Title card", "assets": ["build/art/misc/title_card.png", "build/audio/mus_theme.wav"], "cues": [[18.0, "build/audio/mus_theme.wav"]]},
  {"id": "2b", "seg": "2", "start": 23.0, "dur": 3.0, "title": "Poppy waves", "assets": ["build/rooms/playroom_wide.png", "build/art/poppy/poppy_wave_a.png", "build/art/poppy/poppy_wave_b.png"], "cues": []},
  {"id": "2c", "seg": "2", "start": 26.0, "dur": 3.0, "title": "Flowers montage", "assets": ["build/art/misc/bumper_bg.png", "build/art/misc/flower_1.png", "build/art/misc/flower_2.png", "build/art/misc/flower_3.png", "build/art/misc/flower_4.png", "build/audio/sfx_pop.wav"], "cues": [[26.1, "build/audio/sfx_pop.wav"], [26.7, "build/audio/sfx_pop.wav"], [27.3, "build/audio/sfx_pop.wav"], [27.9, "build/audio/sfx_pop.wav"]]},
  {"id": "2d", "seg": "2", "start": 29.0, "dur": 3.0, "title": "Friends montage", "assets": ["build/art/misc/bumper_bg.png", "build/art/misc/friend_mr_buttons.png", "build/art/misc/friend_dot.png"], "cues": []},
  {"id": "2e", "seg": "2", "start": 32.0, "dur": 3.0, "title": "Eyes closed", "assets": ["build/rooms/playroom_wide.png", "build/art/poppy/poppy_blink.png"], "cues": []},
  {"id": "2f", "seg": "2", "start": 35.0, "dur": 3.0, "title": "Close-up", "assets": ["build/art/poppy/poppy_close.png", "build/rooms/playroom_wide.png"], "cues": []},
  {"id": "2g", "seg": "2", "start": 38.0, "dur": 3.0, "title": "Title card with Poppy", "assets": ["build/art/misc/title_card.png", "build/art/poppy/poppy_wave_a.png", "build/art/poppy/poppy_wave_b.png"], "cues": []},
  {"id": "3a", "seg": "3", "start": 41.0, "dur": 12.0, "title": "Hi, friend!", "assets": ["build/rooms/playroom_wide.png", "build/art/poppy/poppy_idle.png", "build/art/poppy/poppy_talk.png", "build/art/poppy/poppy_blink.png", "build/audio/mus_playroom_bed.wav", "build/audio/vo_greet_1.wav", "build/audio/vo_greet_2.wav", "build/audio/vo_greet_3.wav"], "cues": [[41.0, "build/audio/mus_playroom_bed.wav"], [41.5, "build/audio/vo_greet_1.wav"], [46.0, "build/audio/vo_greet_2.wav"], [49.6, "build/audio/vo_greet_3.wav"]]},
  {"id": "4a", "seg": "4", "start": 53.0, "dur": 2.0, "title": "Bumper: COUNTING TIME!", "assets": ["build/art/misc/bumper_bg.png", "build/audio/mus_bumper.wav"], "cues": [[53.0, "build/audio/mus_bumper.wav"]]},
  {"id": "4b", "seg": "4", "start": 55.0, "dur": 11.5, "title": "Count with me", "assets": ["build/rooms/playroom_board.png", "build/art/poppy/poppy_point.png", "build/art/poppy/poppy_point_talk.png", "build/art/misc/flower_1.png", "build/art/misc/flower_2.png", "build/art/misc/flower_3.png", "build/art/misc/flower_4.png", "build/art/misc/flower_5_eye.png", "build/audio/vo_count_intro.wav", "build/audio/vo_count_1.wav", "build/audio/vo_count_2.wav", "build/audio/vo_count_3.wav", "build/audio/vo_count_4.wav", "build/audio/vo_count_5.wav", "build/audio/sfx_pop.wav"], "cues": [[55.3, "build/audio/vo_count_intro.wav"], [59.0, "build/audio/sfx_pop.wav"], [59.0, "build/audio/vo_count_1.wav"], [60.6, "build/audio/sfx_pop.wav"], [60.6, "build/audio/vo_count_2.wav"], [62.2, "build/audio/sfx_pop.wav"], [62.2, "build/audio/vo_count_3.wav"], [63.8, "build/audio/sfx_pop.wav"], [63.8, "build/audio/vo_count_4.wav"], [65.4, "build/audio/sfx_pop.wav"], [65.4, "build/audio/vo_count_5.wav"]]},
  {"id": "4c", "seg": "4", "start": 66.5, "dur": 7.0, "title": "THE FREEZE", "assets": ["build/art/poppy/poppy_close.png", "build/rooms/playroom_board.png", "build/art/poppy/poppy_close_wink.png", "build/audio/amb_room_tone.wav", "build/audio/amb_drone.wav"], "cues": [[66.5, "build/audio/amb_room_tone.wav"], [69.5, "build/audio/amb_drone.wav"]]},
  {"id": "4d", "seg": "4", "start": 73.5, "dur": 6.0, "title": "As if nothing happened", "assets": ["build/rooms/playroom_board.png", "build/art/misc/flower_5_eye.png", "build/art/misc/flower_5_eye_look.png", "build/art/poppy/poppy_point_talk.png", "build/art/poppy/poppy_point.png", "build/audio/vo_count_done.wav"], "cues": [[73.9, "build/audio/vo_count_done.wav"]]},
  {"id": "5a", "seg": "5", "start": 79.5, "dur": 2.0, "title": "Bumper: FEELINGS TIME!", "assets": ["build/art/misc/bumper_bg.png", "build/audio/mus_bumper.wav"], "cues": [[79.5, "build/audio/mus_bumper.wav"]]},
  {"id": "5b", "seg": "5", "start": 81.5, "dur": 4.5, "title": "How do we feel today?", "assets": ["build/rooms/playroom_board.png", "build/art/poppy/poppy_point_talk.png", "build/art/poppy/poppy_point.png", "build/audio/vo_feel_intro.wav"], "cues": [[81.8, "build/audio/vo_feel_intro.wav"]]},
  {"id": "5c", "seg": "5", "start": 86.0, "dur": 8.0, "title": "Happy, sad, angry, scared", "assets": ["build/rooms/playroom_board.png", "build/art/misc/feel_happy.png", "build/art/misc/feel_sad.png", "build/art/misc/feel_angry.png", "build/art/misc/feel_scared.png", "build/art/poppy/poppy_point_talk.png", "build/art/poppy/poppy_point.png", "build/audio/vo_feel_happy.wav", "build/audio/vo_feel_sad.wav", "build/audio/vo_feel_angry.wav", "build/audio/vo_feel_scared.wav", "build/audio/sfx_pop.wav"], "cues": [[86.0, "build/audio/sfx_pop.wav"], [86.1, "build/audio/vo_feel_happy.wav"], [88.0, "build/audio/sfx_pop.wav"], [88.1, "build/audio/vo_feel_sad.wav"], [90.0, "build/audio/sfx_pop.wav"], [90.1, "build/audio/vo_feel_angry.wav"], [92.0, "build/audio/sfx_pop.wav"], [92.1, "build/audio/vo_feel_scared.wav"]]},
  {"id": "5d", "seg": "5", "start": 94.0, "dur": 1.5, "title": "Nobody introduced it", "assets": ["build/rooms/playroom_board.png", "build/art/misc/feel_hungry.png", "build/art/poppy/poppy_idle.png", "build/audio/sfx_tracking_garble.wav"], "cues": [[94.2, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "5e", "seg": "5", "start": 95.5, "dur": 1.5, "title": "Insert: HUNGRY", "assets": ["build/rooms/playroom_board.png", "build/art/misc/feel_hungry.png"], "cues": []},
  {"id": "5f", "seg": "5", "start": 97.0, "dur": 2.5, "title": "This is hungry.", "assets": ["build/art/poppy/poppy_close.png", "build/rooms/playroom_board.png", "build/art/poppy/poppy_close_talk.png", "build/audio/vo_feel_hungry.wav"], "cues": [[97.3, "build/audio/vo_feel_hungry.wav"]]},
  {"id": "5g", "seg": "5", "start": 99.5, "dur": 4.0, "title": "It's okay to feel hungry", "assets": ["build/rooms/playroom_board.png", "build/art/poppy/poppy_idle.png", "build/art/poppy/poppy_talk.png", "build/audio/vo_feel_hungry_2.wav"], "cues": [[99.7, "build/audio/vo_feel_hungry_2.wav"]]},
  {"id": "6a", "seg": "6", "start": 103.5, "dur": 2.0, "title": "Bumper: POPPY'S FRIENDS!", "assets": ["build/art/misc/bumper_bg.png", "build/audio/mus_bumper.wav"], "cues": [[103.5, "build/audio/mus_bumper.wav"]]},
  {"id": "6b", "seg": "6", "start": 105.5, "dur": 2.5, "title": "Hello, friends", "assets": ["build/rooms/playroom_wide_ajar.png", "build/art/poppy/poppy_idle.png", "build/art/poppy/poppy_talk.png", "build/audio/vo_friends_intro.wav"], "cues": [[105.7, "build/audio/vo_friends_intro.wav"]]},
  {"id": "6c", "seg": "6", "start": 108.0, "dur": 3.0, "title": "Mr. Buttons", "assets": ["build/art/misc/bumper_bg.png", "build/art/misc/friend_mr_buttons.png", "build/audio/sfx_pop.wav", "build/audio/vo_friends_buttons.wav"], "cues": [[108.0, "build/audio/sfx_pop.wav"], [108.4, "build/audio/vo_friends_buttons.wav"]]},
  {"id": "6d", "seg": "6", "start": 111.0, "dur": 2.5, "title": "Dot", "assets": ["build/art/misc/bumper_bg.png", "build/art/misc/friend_dot.png", "build/audio/sfx_pop.wav", "build/audio/vo_friends_dot.wav"], "cues": [[111.0, "build/audio/sfx_pop.wav"], [111.4, "build/audio/vo_friends_dot.wav"]]},
  {"id": "6e", "seg": "6", "start": 113.5, "dur": 3.0, "title": "Pip", "assets": ["build/art/misc/bumper_bg.png", "build/art/misc/friend_pip_scribbled.png", "build/audio/sfx_scribble.wav", "build/audio/vo_friends_pip.wav"], "cues": [[113.5, "build/audio/sfx_scribble.wav"], [114.4, "build/audio/vo_friends_pip.wav"]]},
  {"id": "6f", "seg": "6", "start": 116.5, "dur": 3.5, "title": "Don't you, friend?", "assets": ["build/art/poppy/poppy_close_stare.png", "build/rooms/playroom_wide_ajar.png", "build/audio/amb_room_tone.wav", "build/audio/vo_friends_pip_2.wav"], "cues": [[116.5, "build/audio/amb_room_tone.wav"], [116.7, "build/audio/vo_friends_pip_2.wav"]]},
  {"id": "6g", "seg": "6", "start": 120.0, "dur": 1.0, "title": "RECORDED-OVER SPLICE", "assets": ["build/art/misc/sub_eyes_dark.png", "build/audio/sfx_tracking_garble.wav", "build/audio/sfx_static_burst.wav"], "cues": [[120.0, "build/audio/sfx_tracking_garble.wav"], [120.7, "build/audio/sfx_static_burst.wav"]]},
  {"id": "7a", "seg": "7", "start": 121.0, "dur": 0.8, "title": "Camcorder starts", "assets": ["build/audio/sfx_cam_beep.wav"], "cues": [[121.1, "build/audio/sfx_cam_beep.wav"]]},
  {"id": "7b", "seg": "7", "start": 121.8, "dur": 7.2, "title": "Studio B, after hours", "assets": ["build/rooms/studio_night.png", "build/audio/amb_studio_night.wav", "build/audio/sfx_footsteps.wav", "build/audio/vo_crew_1.wav"], "cues": [[121.8, "build/audio/amb_studio_night.wav"], [122.3, "build/audio/sfx_footsteps.wav"], [123.3, "build/audio/vo_crew_1.wav"]]},
  {"id": "7c", "seg": "7", "start": 129.0, "dur": 1.0, "title": "FALSE SCARE 1: the clunk", "assets": ["build/rooms/studio_night.png", "build/art/misc/sub_teeth.png", "build/audio/sfx_clunk.wav"], "cues": [[129.0, "build/audio/sfx_clunk.wav"]]},
  {"id": "7d", "seg": "7", "start": 130.0, "dur": 3.5, "title": "Hello?", "assets": ["build/rooms/studio_night.png", "build/audio/vo_crew_2.wav", "build/audio/vo_crew_3.wav"], "cues": [[130.4, "build/audio/vo_crew_2.wav"], [131.8, "build/audio/vo_crew_3.wav"]]},
  {"id": "7e", "seg": "7", "start": 133.5, "dur": 7.0, "title": "The corridor", "assets": ["build/rooms/backstage_corridor.png", "build/audio/amb_fluorescent.wav", "build/audio/sfx_footsteps.wav", "build/audio/vo_crew_4.wav"], "cues": [[133.5, "build/audio/amb_fluorescent.wav"], [133.5, "build/audio/sfx_footsteps.wav"], [134.5, "build/audio/vo_crew_4.wav"]]},
  {"id": "7f", "seg": "7", "start": 140.5, "dur": 6.0, "title": "There it is", "assets": ["build/rooms/dressing_room.png", "build/art/poppy/costume_slumped.png", "build/audio/amb_fluorescent.wav", "build/audio/vo_crew_5.wav"], "cues": [[140.5, "build/audio/amb_fluorescent.wav"], [143.0, "build/audio/vo_crew_5.wav"]]},
  {"id": "7g", "seg": "7", "start": 146.5, "dur": 10.0, "title": "The memo", "assets": ["build/art/misc/memo_card.png", "build/audio/amb_fluorescent.wav"], "cues": [[146.5, "build/audio/amb_fluorescent.wav"]]},
  {"id": "7h", "seg": "7", "start": 156.5, "dur": 5.0, "title": "The chair is empty", "assets": ["build/rooms/dressing_room.png", "build/audio/amb_fluorescent.wav", "build/audio/amb_drone.wav", "build/audio/vo_crew_6.wav"], "cues": [[156.5, "build/audio/amb_drone.wav"], [156.5, "build/audio/amb_fluorescent.wav"], [158.7, "build/audio/vo_crew_6.wav"]]},
  {"id": "7i", "seg": "7", "start": 161.5, "dur": 3.5, "title": "Looking back", "assets": ["build/rooms/backstage_corridor.png", "build/art/poppy/costume_standing.png"], "cues": []},
  {"id": "7j", "seg": "7", "start": 165.0, "dur": 0.5, "title": "Lights out", "assets": ["build/rooms/backstage_corridor.png"], "cues": []},
  {"id": "7k", "seg": "7", "start": 165.5, "dur": 2.0, "title": "Lights on: gone", "assets": ["build/rooms/backstage_corridor.png"], "cues": []},
  {"id": "7l", "seg": "7", "start": 167.5, "dur": 2.0, "title": "Rhythm beat 1", "assets": ["build/rooms/dressing_room.png"], "cues": []},
  {"id": "7m", "seg": "7", "start": 169.5, "dur": 2.0, "title": "Rhythm beat 2", "assets": ["build/rooms/backstage_corridor.png"], "cues": []},
  {"id": "7n", "seg": "7", "start": 171.5, "dur": 1.3, "title": "Rhythm beat 3 (cut early)", "assets": ["build/rooms/dressing_room.png", "build/audio/sfx_hanger.wav"], "cues": [[172.0, "build/audio/sfx_hanger.wav"]]},
  {"id": "7o", "seg": "7", "start": 172.8, "dur": 0.8, "title": "SCARE 1", "assets": ["build/art/poppy/poppy_scare_costume.png", "build/audio/sfx_stinger_1.wav"], "cues": [[172.8, "build/audio/sfx_stinger_1.wav"]]},
  {"id": "7p", "seg": "7", "start": 173.6, "dur": 0.5, "title": "Camcorder drops", "assets": ["build/rooms/dressing_room.png", "build/audio/sfx_cam_drop.wav", "build/audio/sfx_static_burst.wav"], "cues": [[173.6, "build/audio/sfx_cam_drop.wav"], [173.9, "build/audio/sfx_static_burst.wav"]]},
  {"id": "7q", "seg": "7", "start": 174.1, "dur": 1.5, "title": "Black", "assets": [], "cues": []},
  {"id": "8a", "seg": "8", "start": 175.6, "dur": 0.9, "title": "Edit point out of the recording", "assets": ["build/rooms/playroom_wide.png", "build/art/poppy/poppy_idle.png", "build/audio/sfx_tracking_garble.wav"], "cues": [[175.6, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "8b", "seg": "8", "start": 176.5, "dur": 9.5, "title": "Welcome back, friend", "assets": ["build/rooms/playroom_dark.png", "build/art/poppy/poppy_wrong_idle.png", "build/audio/mus_playroom_bed_wrong.wav", "build/audio/vo_wrong_welcome.wav", "build/audio/vo_wrong_game.wav"], "cues": [[176.5, "build/audio/mus_playroom_bed_wrong.wav"], [177.1, "build/audio/vo_wrong_welcome.wav"], [181.1, "build/audio/vo_wrong_game.wav"]]},
  {"id": "8c", "seg": "8", "start": 186.0, "dur": 2.5, "title": "One", "assets": ["build/rooms/playroom_dark.png", "build/art/poppy/poppy_cover_eyes.png", "build/audio/amb_drone.wav", "build/audio/vo_hs_1.wav"], "cues": [[186.0, "build/audio/amb_drone.wav"], [186.4, "build/audio/vo_hs_1.wav"]]},
  {"id": "8d", "seg": "8", "start": 188.5, "dur": 2.5, "title": "Two: your bedroom", "assets": ["build/rooms/bedroom_night.png", "build/rooms/playroom_dark.png", "build/art/poppy/poppy_cover_eyes.png", "build/audio/amb_house_night.wav", "build/audio/vo_hs_2.wav"], "cues": [[188.5, "build/audio/amb_house_night.wav"], [188.9, "build/audio/vo_hs_2.wav"]]},
  {"id": "8e", "seg": "8", "start": 191.0, "dur": 2.5, "title": "Three: the empty bed", "assets": ["build/rooms/bedroom_night.png", "build/audio/vo_hs_3.wav"], "cues": [[191.5, "build/audio/vo_hs_3.wav"]]},
  {"id": "8f", "seg": "8", "start": 193.5, "dur": 3.0, "title": "Four: the hallway", "assets": ["build/rooms/hallway_night.png", "build/audio/vo_hs_4.wav"], "cues": [[194.1, "build/audio/vo_hs_4.wav"]]},
  {"id": "8g", "seg": "8", "start": 196.5, "dur": 3.5, "title": "Five + FALSE SCARE 2", "assets": ["build/rooms/hallway_night.png", "build/audio/vo_hs_5.wav", "build/audio/sfx_toy_fall.wav"], "cues": [[197.1, "build/audio/vo_hs_5.wav"], [198.5, "build/audio/sfx_toy_fall.wav"]]},
  {"id": "8h", "seg": "8", "start": 200.0, "dur": 3.0, "title": "Six: closer", "assets": ["build/rooms/playroom_dark.png", "build/art/poppy/poppy_cover_eyes.png", "build/audio/vo_hs_6.wav"], "cues": [[200.7, "build/audio/vo_hs_6.wav"]]},
  {"id": "8i", "seg": "8", "start": 203.0, "dur": 3.5, "title": "Seven: the closet", "assets": ["build/art/poppy/poppy_scare_closet.png", "build/rooms/closet_door.png", "build/audio/sfx_tracking_garble.wav", "build/audio/vo_hs_7.wav"], "cues": [[203.0, "build/audio/sfx_tracking_garble.wav"], [203.8, "build/audio/vo_hs_7.wav"]]},
  {"id": "8j", "seg": "8", "start": 206.5, "dur": 4.0, "title": "Eight: she left the TV", "assets": ["build/rooms/bedroom_night.png", "build/rooms/playroom_dark.png", "build/audio/vo_hs_8.wav"], "cues": [[207.5, "build/audio/vo_hs_8.wav"]]},
  {"id": "8k", "seg": "8", "start": 210.5, "dur": 8.0, "title": "Nine", "assets": ["build/rooms/closet_door.png", "build/audio/vo_hs_9.wav"], "cues": [[211.7, "build/audio/vo_hs_9.wav"]]},
  {"id": "8l", "seg": "8", "start": 218.5, "dur": 3.5, "title": "The door moved", "assets": ["build/rooms/closet_door_open.png", "build/audio/sfx_door_creak.wav"], "cues": [[220.7, "build/audio/sfx_door_creak.wav"]]},
  {"id": "8m", "seg": "8", "start": 222.0, "dur": 0.7, "title": "SCARE 2", "assets": ["build/art/poppy/poppy_scare_closet.png", "build/audio/vo_hs_10.wav", "build/audio/sfx_stinger_2.wav"], "cues": [[222.0, "build/audio/sfx_stinger_2.wav"], [222.0, "build/audio/vo_hs_10.wav"]]},
  {"id": "8n", "seg": "8", "start": 222.7, "dur": 1.5, "title": "Black", "assets": [], "cues": []},
  {"id": "9a", "seg": "9", "start": 224.2, "dur": 8.0, "title": "Card A", "assets": ["build/audio/mus_music_box.wav", "build/audio/vo_narr_adv_a.wav", "build/art/misc/sm_logo.png"], "cues": [[224.2, "build/audio/mus_music_box.wav"], [224.8, "build/audio/vo_narr_adv_a.wav"]]},
  {"id": "9b", "seg": "9", "start": 232.2, "dur": 5.5, "title": "Card B", "assets": [], "cues": []},
  {"id": "9c", "seg": "9", "start": 237.7, "dur": 6.0, "title": "Card C", "assets": ["build/audio/sfx_tracking_garble.wav"], "cues": [[243.3, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "9d", "seg": "9", "start": 243.7, "dur": 5.0, "title": "Card D", "assets": [], "cues": []},
  {"id": "9e", "seg": "9", "start": 248.7, "dur": 6.5, "title": "Card E", "assets": ["build/audio/vo_narr_adv_e.wav"], "cues": [[249.5, "build/audio/vo_narr_adv_e.wav"]]},
  {"id": "10a", "seg": "10", "start": 255.2, "dur": 0.5, "title": "Tracking roll", "assets": ["build/audio/sfx_tracking_garble.wav"], "cues": [[255.2, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "10b", "seg": "10", "start": 255.7, "dur": 7.5, "title": "You didn't stop the tape", "assets": ["build/rooms/playroom_dark.png", "build/audio/amb_drone.wav", "build/audio/vo_wrong_stop.wav", "build/audio/vo_wrong_again.wav"], "cues": [[255.7, "build/audio/amb_drone.wav"], [256.5, "build/audio/vo_wrong_stop.wav"], [259.6, "build/audio/vo_wrong_again.wav"]]},
  {"id": "10c", "seg": "10", "start": 263.2, "dur": 2.0, "title": "One (the chair)", "assets": ["build/rooms/playroom_dark.png", "build/audio/vo_hs_1.wav"], "cues": [[263.5, "build/audio/vo_hs_1.wav"]]},
  {"id": "10d", "seg": "10", "start": 265.2, "dur": 2.0, "title": "Two (the doorway)", "assets": ["build/rooms/playroom_dark.png", "build/audio/vo_hs_2.wav"], "cues": [[265.5, "build/audio/vo_hs_2.wav"]]},
  {"id": "10e", "seg": "10", "start": 267.2, "dur": 2.0, "title": "Three (the board)", "assets": ["build/rooms/playroom_dark.png", "build/art/misc/feel_hungry.png", "build/audio/vo_hs_3.wav"], "cues": [[267.5, "build/audio/vo_hs_3.wav"]]},
  {"id": "10f", "seg": "10", "start": 269.2, "dur": 1.3, "title": "(Four never comes)", "assets": ["build/rooms/playroom_dark.png", "build/audio/sfx_door_creak.wav"], "cues": [[269.8, "build/audio/sfx_door_creak.wav"]]},
  {"id": "10g", "seg": "10", "start": 270.5, "dur": 0.9, "title": "SCARE 3", "assets": ["build/art/poppy/poppy_scare_final.png", "build/audio/sfx_stinger_3.wav", "build/audio/sfx_scream.wav"], "cues": [[270.5, "build/audio/sfx_stinger_3.wav"], [270.52, "build/audio/sfx_scream.wav"]]},
  {"id": "10h", "seg": "10", "start": 271.4, "dur": 1.5, "title": "Black", "assets": [], "cues": []},
  {"id": "11a", "seg": "11", "start": 272.9, "dur": 0.6, "title": "Tracking in", "assets": ["build/audio/sfx_static_burst.wav"], "cues": [[272.9, "build/audio/sfx_static_burst.wav"]]},
  {"id": "11b", "seg": "11", "start": 273.5, "dur": 8.0, "title": "Reprise: title", "assets": ["build/art/misc/title_card.png", "build/audio/mus_reprise.wav"], "cues": [[273.5, "build/audio/mus_reprise.wav"]]},
  {"id": "11c", "seg": "11", "start": 281.5, "dur": 9.0, "title": "Reprise: goodbye", "assets": ["build/art/misc/end_card.png", "build/art/poppy/poppy_wave_a.png", "build/art/poppy/poppy_wave_b.png", "build/audio/vo_end_see_you.wav"], "cues": [[288.5, "build/audio/vo_end_see_you.wav"]]},
  {"id": "11d", "seg": "11", "start": 290.5, "dur": 2.5, "title": "Cracked", "assets": ["build/art/misc/end_card_cracked.png"], "cues": []},
  {"id": "11e", "seg": "11", "start": 293.0, "dur": 0.5, "title": "Last subliminal", "assets": ["build/art/misc/sub_crayon_house.png", "build/audio/sfx_tracking_garble.wav"], "cues": [[293.0, "build/audio/sfx_tracking_garble.wav"]]},
  {"id": "11f", "seg": "11", "start": 293.5, "dur": 0.6, "title": "Static", "assets": ["build/audio/sfx_static_burst.wav"], "cues": [[293.5, "build/audio/sfx_static_burst.wav"]]},
  {"id": "11g", "seg": "11", "start": 294.1, "dur": 3.2, "title": "Closer than ever", "assets": ["build/art/poppy/poppy_final_close.png", "build/art/poppy/poppy_final_close_look.png", "build/audio/amb_house_night.wav"], "cues": [[294.1, "build/audio/amb_house_night.wav"]]},
  {"id": "11h", "seg": "11", "start": 297.3, "dur": 0.6, "title": "Tape stop", "assets": ["build/audio/sfx_vcr_stop.wav"], "cues": [[297.8, "build/audio/sfx_vcr_stop.wav"]]},
  {"id": "11i", "seg": "11", "start": 297.9, "dur": 1.4, "title": "STOP", "assets": [], "cues": []},
  {"id": "11j", "seg": "11", "start": 299.3, "dur": 0.7, "title": "Black", "assets": [], "cues": []}
]
```
