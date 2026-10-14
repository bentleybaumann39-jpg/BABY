# Prose sections 1-4 of STORYBOARD.md (sections 5-9 are in text_b.py).
MD = []
w = MD.append

w("# OPPOSITE DAY - Storyboard and shot list\n")
w(f"**Runtime: {TOTAL:.1f} s ({tc(TOTAL)})** at 640x480, 30 fps. {len(SEGMENTS)} segments, {len(SHOTS)} shots. "
  f"Real scares at {', '.join(tc(x) for x in scare_times)} (gaps {', '.join(f'{g:.1f} s' for g in gaps)}).\n")
w("This file and `assets.json` are generated from one source (`gen_storyboard.py` + `sb/*.py`), so every asset path named "
  "here is in the manifest and every manifest entry is used here. Edit the generator, not this file. Paths are relative to "
  "`/home/user/BABY/opposite/`. Times are `m:ss.s` from the start of the tape; cue offsets inside a shot are `+seconds` "
  "from the shot's first frame. Levels are mix peaks in dBFS (section 5).\n")

w("## 1. The tape in one paragraph\n")
w("A second-generation dub of *OPPOSITE DAY! A Learn-Along Game Tape* (© 1994 Two-Way Kids Home Video), parts of it "
  "recorded over with a stage manager's night camcorder footage. Two felt mirror-twins, BIM and his copy MIB, host from "
  "either side of a big empty gold frame in a playroom built perfectly symmetric, and they teach the children's game every "
  "viewer already knows: on Opposite Day yes means no, forward is backward, goodbye means hello. BIM points to the little "
  "chair on his side: 'This is your spot.' He laughs that MIB's cards are mirror-written, so 'if you can read them, "
  "you're on the wrong side.' The tape keeps its rules perfectly, and that is the horror: once the viewer has learned to "
  "decode, every reassurance decodes into a threat inside their own head. 'Is everybody here?' 'NO!' - and one more "
  "voice answers, backwards. A figure in MIB's doorway is the only thing in the tape that walks forward. A jolly "
  "upside-down portrait is turned over and the tape tears away before we see it. The night camcorder's negative effect "
  "shows MIB sitting in your chair. When the show comes back, the twins have traded sides and become each other's "
  "mirror image, and nobody mentions it. BIM frowns, and MIB's smile is that frown upside down. MIB says 'You're safe' "
  "while the lights go out, and the portrait is right way up: its eyes and mouth were upside down all along. MIB teaches "
  "the way to end the game - say 'It's NOT Opposite Day!' - and the children chant it, and 'on Opposite Day, that "
  "means...'. Behind the set there is another, darker Turnaround Room, and in the gold frame's mirror the one holding the "
  "camera is MIB. MIB says goodbye (hello): 'BIM isn't with you. He isn't right behind you.' The dead TV on MIB's side "
  "reflects a living room, and on the couch someone small kneels with its back to the screen; it is BIM, and his face "
  "was upside down too. The VCR rewinds by itself, and the whisper we heard backwards plays forwards: 'Your turn to be "
  "the reflection.' PLAY comes back mirrored. From MIB's side of the frame we look at the empty Chair For You; the "
  "blanket is on the chair we are sitting in, and MIB's card is readable. 'Bye!' '...I mean hello.' Two knocks on the "
  "glass. TODAY IS NOT OPPOSITE DAY.\n")

w("## 2. Timeline at a glance\n")
w("| # | Segment | Start | End | Dur | Act | What happens |")
w("|---|---|---|---|---|---|---|")
for g in SEGMENTS:
    w(f"| {g['id']} | {g['title']} | {tc(g['start'])} | {tc(g['end'])} | {g['end'] - g['start']:.1f} s | {g['act']} | "
      f"{g['summary']} |")
w(f"| | **TOTAL** | 0:00.0 | {tc(TOTAL)} | **{TOTAL:.1f} s** | | |\n")

w("### Escalation curve\n")
SEG = {g["id"]: g for g in SEGMENTS}
w(f"- **0:00-{tc(SEG['6']['end'])} Act 1, trust (with seeds).** A bright, sweet, symmetric kids' tape. Every wrongness is small enough to "
  "doubt: reversed bars, a mirrored logo, an anticlockwise clock, a lyric that does not match its caption, a silent copy "
  "4 frames late, one extra 'NO!', a figure walking forward in a doorway, a duck on the wrong chest. The only dread "
  "spike is the withheld portrait turn (6d-6e).")
w(f"- **{tc(SEG['7']['start'])}-{tc(SEG['8']['end'])} Act 2, slippage.** Recorded-over night footage (the held negative, the memo), then the show resumes "
  "with the swap: the rules start applying to the viewer ('safe means not safe'). The 'You're safe' rhythm drains the "
  "light into scare 1.")
w(f"- **{tc(SEG['9']['start'])}-{tc(SEG['11']['end'])} Act 3, descent.** Bright and cheerful again, which is worse: MIB alone, BIM gone, the blanket moved, the "
  "paradox lock. The camcorder behind B finds a second studio and MIB in the mirror (scare 2). The corrections cancel "
  "out, MIB's reassurance decodes into a warning, and the dead TV holds a living room with BIM in it (scare 3).")
w(f"- **{tc(SEG['12']['start'])}-{tc(TOTAL)}, the ending.** The self-rewind gives the whisper its meaning; the reverse angle shows which side we are "
  "on; 'Bye... I mean hello', two knocks, the tape stops in silence.\n")

w("### Scare map\n")
w("Three real scares, each closer, longer and louder than the last (0.7 / 0.8 / 1.0 s filling 60 / 75 / 90% of the "
  "frame), at least 45 s apart, each set up differently, each preceded by exactly ONE sound, each revealing something "
  "new, and each followed by silence.\n")
w("| Beat | Time | Shot | Setup | The one sound before it | Payload | After |")
w("|---|---|---|---|---|---|---|")
for (name, sid, fill, setup, one, payload, after), x in zip(SCARES, scare_times):
    w(f"| **{name}** | **{tc(x)}** | {sid} | {setup} | {one} | {payload} | {after} |")
w("")
w("Subliminal frames (1-2 frames each, hidden inside glitches or rewinds, at least 1 s apart):\n")
w("| # | Time | Shot | Frames | Image |")
w("|---|---|---|---|---|")
for k, sid, off, n, img in SUBLIMINALS:
    w(f"| {k} | {tc(at(sid, off))} | {sid} | {n} | {img} |")
w("")
w("Hidden figures (never acknowledged; in doorways or reflections; blurred 2-4 px; 4-10% luma over their surroundings; "
  "they come back closer):\n")
w("| # | Time | Shot | What and where | Then |")
w("|---|---|---|---|---|")
for k, sid, off, what, then in HIDDEN:
    w(f"| {k} | {tc(at(sid, off))} | {sid} | {what} | {then} |")
w("")
w("Changes between cuts (small ones first, hidden behind glitches or cuts; 8a is the large one near the faces that makes "
  "the viewer realise the others happened):\n")
w("| Shot | Time | Change |")
w("|---|---|---|")
for sid, off, what in CHANGES:
    w(f"| {sid} | {tc(at(sid, off))} | {what} |")
w("")
w("'Did I see that?' moments and quiet dread beats (on screen for real, never mentioned):\n")
w("| Beat | Time | Shot | What |")
w("|---|---|---|---|")
for name, sid, what in DREAD:
    w(f"| {name} | {tc(at(sid))} | {sid} | {what} |")
w("")
w("Silences: true digital silence exactly three times: "
  + ", ".join(f"{tc(at(sid))} ({why})" for _, sid, why in SILENCES)
  + ". After scare 2 the tape drops to near-silence (camcorder hiss at -60 dBFS) instead. Before each scare the bed is "
  "stripped to one or two quiet sounds (room tone at ~-42 dBFS plus a reversed clock, a sinking Shepard tone, or "
  "sub-bass breathing) and then to the single cue listed above.\n")

w("## 3. The rules of Opposite Day (recurring devices that flip)\n")
w("The tape teaches its rules, keeps them, and then turns them on the viewer. Builders must keep every instance "
  "consistent.\n")
w("| Rule / device | Taught or planted | Applied | Flipped onto the viewer |")
w("|---|---|---|---|")
w("| **Yes means no** (Rule 1) | 4d card; 4f quiz ('Is the sky green?' 'YES!') | 4g 'Is everybody here?' 'NO!' = yes; 6b 'Is "
  "he happy?' 'YES!' = no | 9a 'BIM is right here!' = he is not; 11e 'BIM isn't with you. He isn't right behind you.' = "
  "he is |")
w("| **Forward is backward** (Rule 2) | 1d reversed bars and tone; 5b-5e Backwards Walk, reversed footsteps, reversed "
  "speech | the doorway figure is the only thing moving forward (H1-H3) | 10b the footage drifts backward while the "
  "steps go forward; 7d/11g reversed whisper becomes forward in 12a |")
w("| **Safe means not safe** (Rule 3) | 8b card (after the swap) | 8e-8g 'You're safe' x3 while the lights die | scare 1 |")
w("| **Goodbye means hello** | 5e | 11d MIB's goodbye | 12c 'Bye!' '...I mean hello.' |")
w("| **To stop, say IT'S NOT OPPOSITE DAY** (Rule 4) | 9b | 9c the kids (and you) chant it | 9d 'that means...' it is; "
  "11a-11b the corrections cancel; 12f the last card |")
w("| **Mirror-written cards** | 4d-4e: MIB's board is mirrored; 'If you can read them, you're on the wrong side!' | 8b "
  "the readable card is now on the LEFT | 12c MIB's card is readable: we are on his side |")
w("| **The copy** | 3b-4a MIB mirrors BIM 4 frames late, silently | 4f MIB is AHEAD for 15 frames; 8a BIM copies MIB, "
  "8 frames late | 10f the camera operator's reflection is MIB |")
w("| **Upside-down faces** (Thatcher illusion) | 6b Mr. Turnabout looks jolly upside down | 6d the turn is withheld; "
  "8c-8d BIM's frown = MIB's smile turned over | scare 1 (the portrait); scare 3 (BIM himself) |")
w("| **Which side** | 1b OSD top-right; 3f 'Come and sit here by my side' (sung 'on the other side'); 4b 'your spot, on "
  "my side' | 8a OSD top-left, sides swapped; 9a the blanket moves to MIB's side | 12b-12f the OSD is mirrored; the "
  "blanket is on our chair |")
w("| **Negative** | 7c 'The camera does negative' | 7d the held negative shows what the dark hides | S5 MIB in negative |")
w("| **Clocks** | 3a Set B's clock runs anticlockwise | 8a they swap | 11c both running opposite ways in the empty set |\n")

w("## 4. Characters (design bible for the canvas artists)\n")
w("All characters, the label and the show are ORIGINAL (nothing resembling any existing kids' show, puppet franchise, "
  "analog-horror series, real TV station or agency). PG-13: no blood, gore, wounds or harm to anyone; the horror is "
  "wrongness, inversion and realism in the wrong place.\n")
w(f"**BIM** (`bim_*`, Set A, the LEFT side until 8a). {BIM}\n")
w(f"**MIB** (`mib_*`, Set B, the RIGHT side until 8a). {MIB} He never speaks with his own voice. In Act 1 his mouth flaps "
  "silently 4 frames after BIM's. After the swap BIM's bright voice comes out of HIS mouth, and BIM speaks with MIB's "
  "lower voice.\n")
w("**MR. TURNABOUT** (`turnabout_upside`, `turnabout_scare`). A little gouache portrait of a rosy, bald, white-whiskered "
  "grandfather in a blue bow tie, hung upside down on Set A's wall. His eyes and mouth were painted the right way up for "
  "the viewer, so upside down he reads as jolly (the Thatcher illusion). Turned right way up, the eyes and mouth are "
  "inverted: wet, real, pinpoint eyes with the lids the wrong way round and a down-turned grimace of real ivory teeth with "
  "the gums underneath. No wounds or blood: the wrongness is only the inversion and the realism.\n")
w("**THE CHAIR FOR YOU.** A small white child's chair with a red heart cut out of its backrest and a knitted cream "
  "blanket with a red zig-zag band. 'This is your spot, right here on my side!' (4b). From 9a a second identical chair "
  "stands on MIB's side and the blanket is on it; in 12c we are sitting in it.\n")
w("**THE FIGURE** (`hidden_twin_stand`). A near-black child-height silhouette with the twins' bowl-cut head, arms to the "
  "knees, head tilted 15 degrees, two pinpoint glints for eyes. Never lit, never acknowledged.\n")
w("**THE TURNAROUND KIDS.** The unseen studio audience of children (laugh track, cheers, chants). Late in the tape the "
  "laugh track runs backwards and becomes long inhales.\n")
w("**TWO-WAY KIDS HOME VIDEO.** Fictional 1994 label. Logo: a red left-pointing arrow and a blue right-pointing arrow "
  "chasing each other round a circle, bubble wordmark. No real-company resemblance; no warning screens of any real kind.\n")
w("| Stage | Where | Eyes | Mouth | Body |")
w("|---|---|---|---|---|")
w("| 1 normal (subtly off) | segments 3-6 | glossy black buttons, catchlight at the same pixel in both; BIM looks 5 deg "
  "past the lens | BIM: stitched smile, open D; MIB: flipped-frown smile, upside-down D | head 12% too big, fingers 1.3x "
  "long, MIB copies 4 frames late |")
w("| 2 swapped | segments 8-11 | the same, but MIB stares dead into the lens and never blinks | BIM frowns once "
  "(8c); MIB's mouth moves to BIM's voice, or stays shut while it talks (11d) | both mirrored left/right; BIM gone from "
  "9a |")
w("| 3 scare | `turnabout_scare`, `mib_scare`, `bim_scare` (+ `_b` boil) | realistic wet eyes (40-60 iris fibres, dark "
  "limbal ring, window specular, waterline, 4-8 grey-pink capillaries at 30-50%), pinpoint pupils; in the Thatcher faces "
  "the eyes are UPSIDE DOWN | real ivory teeth (#E8DFC8, uneven, central incisors 1.6x the laterals, grey gaps, bluish "
  "edges) with scalloped wet gums (#C98C8C); in the Thatcher faces the gums are BELOW the teeth | underlit 40-50 deg "
  "from below, 55-70% of pixels at or below 8% luma, hard terminator, one side lost in black; fills 60 / 75 / 90% |")
w("| hidden | `hidden_twin_stand`, `bim_couch_back`, `mib_chair_sit`, `mib_camcorder` | glints only, or none | - | dim, "
  "blurred, 4-10% luma over the surroundings |")
w("")
w("**Drawing rules (from `poppy/research/brief.md` and `scarier.md`).** Keep the felt cute and make ONE thing per frame "
  "too real, too still, too dark or in the wrong place. Felt: noise fill plus hundreds of 1-3 px fibre strokes, "
  "blur(0.6px), pilling, running stitches 4-6 px with a thread shadow. Realism patches use `poppy/draw/horror.js` "
  "(`wetEye`/`eyePP`, `teethRow`/`teethPP`, `gumsPP`, `reliefPP`, `hatch`, `tremor`, `levels`, `budget`). At most 2 "
  "proportion breaks per beat before the scares; stack 4-5 in the scare frames. Scare frames: shadow hatching of 200-600 "
  "one-pixel strokes at 2-3 angles; tremor contours (0.6-1.5 px jitter, overdrawn 2-4 times); each has a `_b` boil frame "
  "with re-seeded hatching whose mean luminance matches within 2%. The Thatcher faces must be drawn so that the "
  "UPSIDE-DOWN view reads as a pleasant, normal face (check by rotating the PNG 180 degrees) and the upright view is "
  "grotesque. Never blood, gore, wounds, self-harm or harm to anyone.\n")

run_part("text_b.py")
