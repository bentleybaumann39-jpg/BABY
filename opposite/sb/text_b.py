# Prose sections 5-9 of STORYBOARD.md.

w("## 5. Compositing conventions (for the compositor)\n")
w("- **Base code:** copy `poppy/make_video.py` to `opposite/make_video.py` (chunked, restartable, parameter-hashed "
  "chunks, `vhs()`, `color_bars()`, `cam_osd()`, `vcr_osd()`, `hidden()`, `boil()`, `scare_framing()`, `mouth()`, "
  "the audio mix and `--status/--force/--still/--sheets/--audio-report`). It reads shot timings from section 9 of this "
  "file. Output `opposite/opposite_day.mp4`, 640x480, 30 fps, H.264 + AAC.")
w("- **Anchors:** read `build/rooms/rooms_meta.json` (written by the rooms builder; keys listed in each room's notes in "
  "`assets.json`). Full-body twins share one canvas (360x600, feet at (180, 588)); normal on-mark height in "
  "`turnaround_wide` is ~215 px in 640x480 terms. Close-ups share 640x480 with the head centre at (320, 220). Scare "
  "faces are 800x600: centre-crop for push-ins.")
w("- **Mirroring:** MIB's walk = BIM's walk frames flipped. From 8a to the end EVERY twin frame is flipped left/right "
  "(see 8a). Mirror-written cards = the card PNG flipped left/right before the perspective paste. Mirrored OSD text = "
  "the OSD layer rendered normally and flipped.")
w("- **Grading:** grade cutouts to the room (room tint multiply, ~0.6 px blur, a soft contact shadow under the feet). "
  "Set B's half of every turnaround shot loses saturation slowly over the tape (see 3a); Set A never changes. Night "
  "camcorder footage: green-grey cast.")
w("- **Motion:** the twins never move smoothly: pops with 6-frame squash-and-stretch, stepped turns and flips at 6 fps, "
  "walks at 7 fps, everything else stillness or 'moved between cuts'. Lip-flap: talk frame while the voice's 20 ms RMS "
  "is above -30 dBFS, delayed 3 frames, minimum 3 frames per state; MIB's mirror flap is BIM's flap delayed 4 more "
  "frames (Act 1) or 4 frames EARLY (9c).")
w("- **Clocks:** hands drawn by the compositor on every visible clock face (hour, minute, thin red second hand stepping "
  "once a second). Direction per side as noted in 3a and 8a.")
w("- **Scare frames:** CLEAN (V0), the sharpest and best-lit images of the tape, cut hard in and hard out, boiling "
  "with their `_b` frames every 4 frames.")
w("- **VHS levels** (damage escalates with the story; the scare frames stay clean):")
w("")
w("| Level | noise | jitter | chroma shift | dropouts/frame | extras |")
w("|---|---|---|---|---|---|")
w("| V0 CLEAN | 0.015 | 0.2 | 2 | 0 | slight unsharp mask, sat 1.0, lift 0.03 (scare frames only) |")
w("| V1 light (Act 1) | 0.03 | 0.6 | 3 | 0-1 (p 0.15) | sat 0.85, warm tint, rightward-only chroma bleed, edge ringing |")
w("| V2 medium | 0.05 | 1.0 | 4 | 0-2 | top-edge flagging (12 rows, up to 15 px), +-1 px wobble, sat 0.75 |")
w("| V3 heavy | 0.08 | 1.6 | 6 | 2-5 | intermittent tracking band, flagging 20 rows, sat 0.65, 1-row vertical hops |")
w("| V4 wrecked | 0.14 | 3.0 | 9 | 4-8 | tracking 1.0, rainbow hue sweep, vertical roll with a 25 px black bar, audio garble |")
w("| EP (camcorder) | x1.6 | - | - | +2 | luma blur k=5, chroma blur 25, green-grey tint, autofocus hunting, exposure pumping (gain 0.7-1.0) |")
w("")
w("- **VCR OSD** (DejaVu Sans Mono Bold 30, white, 2 px black shadow): 'PLAY ▶' + counter top-RIGHT in 1b; 'PLAY ▶' "
  "+ counter top-LEFT for 3 s in 8a; '◀◀ REW' top-left in 12a; MIRRORED 'PLAY ▶' (reads '◀ YALP') top-left in 12b-12d "
  "with the counter rolling DOWN; MIRRORED 'STOP ■' (reads '■ POTS') in 12e-12f.")
w("- **Camcorder OSD (segments 7 and 10):** drawn at 1/3 resolution, nearest-neighbour upscale, 2 px shadow: '● REC' "
  "top-left blinking at 1 Hz; 'SP' and a battery icon top-right; date bottom-left ('MAR 19 1994' in 7, 'MAR 22 1994' in "
  "10); clock bottom-right ('11:40 PM' in 7a-7c, '11:41 PM' from 7d; '11:58 PM' in 10a-10d, '11:59 PM' from 10e); 'NEG' "
  "under 'SP' during 7c(+3.0 s)-7d. No brand names.")
w("- **Colour negative (7d, S5):** invert RGB of the whole picture under the OSD (1 - x after the room grade, before the "
  "VHS pass). Held 8.0 s, entered and left on hard cuts; never alternated with positive.")
w("- **CRT reflection (4a tiny, 11f-11h):** `livingroom` flipped left/right, darkened to 6-15% luma, barrel-distorted "
  "into the screen quad, `crt_glass` on top; the reflection itself gets no VHS damage (the set around it does).")
w("- **Mirror reflection (10e-10f):** `mib_camcorder` inside `mirror_quad`, darkened 20%, green-grey tint, 1 px blur; "
  "his lamp is a hard white disc with bloom.")
w("- **Captions and subtitles:** sing-along captions yellow #FFE14D DejaVu Sans Bold 24 with a black outline, centred at "
  "y~440; the reversed-speech subtitle white DejaVu Sans Bold 26 on a black box.")
w("- **Audio mix:** dialogue around -11 dBFS peak (crew -13, whispers as noted); bumpers -10; the show bed -24 under "
  "dialogue (ducked 8 dB under every line), its hard cuts (6d, 8c, 9d) are 12-15 dB drops; ambiences -34 to -40 and room "
  "tone -42 RMS; hiss -43 RMS (2-8 kHz) plus 60 Hz hum -52 under everything except the digital silences; stingers "
  "saturated and dense, attack < 5 ms, scare 1 about -6 dB, scare 2 about -5 dB, scare 3 about -3 dB RMS over 400 ms, "
  "at least 18 dB above the previous 3 s. Bandwidth 80 Hz-8 kHz (100 Hz-6 kHz in the camcorder segments). Wow/flutter "
  "0.2% in Act 1, 0.6% after the swap, 1-2% in segments 10-12; a garble on every tracking burst; audio dropouts "
  "(-20 dB, 20-200 ms) synced to the picture's dropout clusters. Pan law: BIM's voice 30% left in Act 1; after the swap "
  "the twins' voices come from the side they are NOT on (as noted per cue). Normalise the final mix to -1 dBFS peak "
  "WITHOUT limiting the stingers. The tape-stop (12d) pitch-dives the mix to zero over 0.5 s.")
w("- **Sound rules:** exactly one sound before each hit (8h pre-verb swell, 10f reversed inhale, 11h couch creak); the "
  "Shepard tone, drone, sub-bass and every swell are cut DEAD (no fade, on a zero crossing); close breaths sit 20% "
  "left, dry; whispers alternate hard left/right with a 22 ms Haas double on the opposite side at -8 dB; digital "
  "silence exactly 3 times (section 2).")
w("- **Photosensitivity:** no full-frame flashing or strobing faster than 3 per second; no rapid alternation of "
  "negative and positive (the negative is one 8 s hold plus one subliminal frame >= 1 s from anything similar); no "
  "saturated-red full-frame flicker; the 3d word swaps are position changes at <= 1 per second; the rewind keeps "
  "frame-to-frame mean luminance changes under 20% of full scale; boil pairs within 2% mean luminance. Run the "
  "flash scan from the Poppy pipeline before delivery.\n")

w("## 6. Voice presets and script (for the audio builder)\n")
w("| Preset | Speaker | Delivery | Recipe |")
w("|---|---|---|---|")
for k, (spk, deliv, recipe) in VOICE_SPECS.items():
    w(f"| `{k}` | {spk} | {deliv} | {recipe} |")
w("")
w("Every line in tape order. 'Max' is the longest the trimmed line may run and still fit its slot; write the real "
  "durations (and any 'phrases' or 'lyrics' start times) into `build/audio/manifest.json`, plus a `.env.json` mouth "
  "envelope for every voice file.\n")
w("| File | Preset | Exact text | Max | Cue time(s) (shot) |")
w("|---|---|---|---|---|")
first = {}
for s in SHOTS:
    for x, p in s["cues"]:
        first.setdefault(p, []).append(f"{tc(s['start'] + x)} ({s['id']})")
voice_rows = [a for a in AUDIO if a["kind"] == "voice"]
voice_rows.sort(key=lambda a: min(SHOT[i]["start"] for i in USED[PATH[a["name"]]]))
for a in voice_rows:
    p = PATH[a["name"]]
    w(f"| `{p}` | {a['voice']} | “{a['text']}” | {a['seconds']:.1f} s | {', '.join(first.get(p, []))} |")
w("")
w("Song lyrics (inside `build/audio/mus_theme.wav`): Turn around and turn around, / up is down and down is up! / Yes is "
  "no and no is yes, / BIM and MIB, who's who? Guess! / Come and sit on the other side, (captioned 'Come and sit here "
  "by my side,') / Opposite Day is here for you! / (spoken) Hi, kids!\n")

w("## 7. Shot list\n")
w("Each shot gives its timecode, duration, picture (with exact asset files), camera move, VHS level, audio cues and "
  "on-screen text.\n")
for g in SEGMENTS:
    w(f"### Segment {g['id']} - {g['title']} ({tc(g['start'])}-{tc(g['end'])}, {g['end'] - g['start']:.1f} s, "
      f"{g['act']})\n")
    w(f"*{g['summary']}*\n")
    for s in g["shots"]:
        w(f"#### {s['id']} · {tc(s['start'])}-{tc(s['end'])} ({s['dur']:.1f} s) · {s['title']}\n")
        if s["picture"]:
            w(f"- **Picture:** {s['picture']}")
        if s["camera"]:
            w(f"- **Camera:** {s['camera']}")
        if s["vhs"]:
            w(f"- **VHS:** {s['vhs']}")
        if len(s["audio"]) == 1:
            w(f"- **Audio:** {s['audio'][0]}")
        elif s["audio"]:
            w("- **Audio:**")
            for line in s["audio"]:
                w(f"  - {line}")
        if s["text"]:
            w(f"- **On-screen text:** {s['text']}")
        if s["scare"]:
            w(f"- **SCARE:** {s['scare']}")
        if s["notes"]:
            w(f"- **Notes:** {s['notes']}")
        w("")

w("## 8. Asset index and builder hand-off\n")
w("Every file the builders produce and every shot that uses it. Full specs are in `assets.json`.\n")
w(f"### Blender rooms ({len(ROOMS)})\n")
w("| File | Size | Used in |")
w("|---|---|---|")
for r in ROOMS:
    w(f"| `{PATH[r['name']]}` | {r['size'][0]}x{r['size'][1]} | {', '.join(USED[PATH[r['name']]])} |")
w(f"\n### Character art ({len(CHAR)})\n")
w("| File | Size | Used in |")
w("|---|---|---|")
for p in CHAR:
    w(f"| `{PATH[p['name']]}` | {p['size'][0]}x{p['size'][1]} {'alpha' if p['transparent'] else 'opaque'} | "
      f"{', '.join(USED[PATH[p['name']]])} |")
w(f"\n### Misc art ({len(MISC)})\n")
w("| File | Size | Text in the art | Used in |")
w("|---|---|---|---|")
for m in MISC:
    w(f"| `{PATH[m['name']]}` | {m['size'][0]}x{m['size'][1]} {'alpha' if m['transparent'] else 'opaque'} | "
      f"{m['text'] or '-'} | {', '.join(USED[PATH[m['name']]])} |")
w(f"\n### Audio ({len(AUDIO)})\n")
w("| File | Kind | Target length | Used in |")
w("|---|---|---|---|")
for a in AUDIO:
    w(f"| `{PATH[a['name']]}` | {a['kind']} | {a['seconds']:.1f} s | {', '.join(USED[PATH[a['name']]])} |")
w("")
w("### Hand-off checklist\n")
w(f"- **Rooms** (`opposite/render_rooms.py`, adapted from `poppy/render_rooms.py`; bpy 5.2, Cycles CPU, 32-64 samples, "
  f"denoise): {len(ROOMS)} renders from essentially three scenes - the Turnaround Room (wide, wide_late, frame, "
  "frame_dim, portrait, night, crt_set_b, reverse; plus a mirrored duplicate for mirror_studio and a mirror pane for "
  "frame_mirror_night), the back of the flats (behind_set) and the living room. Build Set A once and duplicate it with "
  "scale x = -1 so the symmetry is exact. Write `build/rooms/rooms_meta.json`. Never put a figure in a room render.")
w(f"- **Character art** (`opposite/draw/`, adapted from `poppy/draw/`): {len(CHAR)} files; MIB is BIM's drawing "
  "function mirrored with the flipped-frown mouth; keep registration identical within each family. Contact-sheet them: "
  "the Act 1 frames must look friendly at a glance, the Thatcher faces must look pleasant when rotated 180 degrees, and "
  "the scare frames must be the sharpest, most finished images.")
w(f"- **Misc art:** {len(MISC)} files; text spelled exactly as given (the 'text' column).")
w(f"- **Audio** (`opposite/make_audio.py`, adapted from `poppy/make_audio.py`): {len(AUDIO)} files, 44.1 kHz mono "
  "16-bit, plus `build/audio/manifest.json` (durations, 'lyrics' for mus_theme, 'phrases' for vo_kids_chant) and "
  "`.env.json` mouth envelopes for the voices. Derived stems (sfx_preverb_safe, sfx_laugh_rev, vo_whisper_fwd/rev from "
  "one take) must be re-rendered when their source changes.")
w(f"- **Compositor:** sections 2, 3, 5 and 7. Runtime must stay within 280-320 s; if a voice line comes back longer than "
  "its slot, extend that shot's hold and trim a following static shot rather than moving the scare beats.")
w("- **Every generator is incremental** (skip valid existing outputs unless forced or named), saves progress often, and "
  "no single process runs longer than ~10 minutes.\n")

w("## 9. Machine-readable shot list\n")
w("One shot per line: id, segment, start (s), duration (s), title, asset files, and audio cues as [absolute start in s, "
  "file]. Mix levels and processing for each cue are in section 7.\n")
w("```json")
w("[")
lines = []
for s in SHOTS:
    lines.append("  " + json.dumps(dict(id=s["id"], seg=s["seg"], start=s["start"], dur=s["dur"], title=s["title"],
                                        assets=s["refs"],
                                        cues=[[round(s["start"] + x, 3), p] for x, p in sorted(s["cues"])]),
                                   ensure_ascii=False))
w(",\n".join(lines))
w("]")
w("```")
