# Canvas art (headless Chromium, adapted from poppy/draw/*.js; realism from poppy/draw/horror.js).
FULL = [360, 600]     # full-body twins: feet bottom-centre at (180, 588), body ~560 px tall
CLOSE = [640, 480]    # close-ups: head centre (320, 220), head ~300 px wide
SCARE = [800, 600]    # scare faces, opaque, drawn big so push-ins stay sharp

BIM = (
    "BIM: a full-body felt puppet boy (Muppet-style, about 1.1 m tall), Easter-yellow felt skin (#F4CF4A, visible fibre "
    "texture: noise fill plus hundreds of 1-3 px fibre strokes, blur(0.6px)), head 12% too big for the body, a brown felt "
    "BOWL HAIRCUT (#6B4226) with its parting on HIS left (screen right), round glossy black BUTTON EYES with a catchlight at "
    "the same pixel in both, a small round orange felt nose, rosy cheek circles, a SEWN-ON SMILE (a running-stitch curve in "
    "dark red thread #6E1020, corners turned up, each corner finished with a small upward 'tuck' stitch like a dimple), a "
    "red-and-white horizontally striped shirt (#D9473B / #FFF4E2), a pink felt HEART PATCH on HIS left chest (screen right), "
    "royal-blue felt shorts, white socks, red sneakers, four-fingered yellow hands with fingers 1.3x too long, and a felt "
    "POINTER (a yellow dowel with a red felt star tip) in his RIGHT hand (screen left).")
MIB = (
    "MIB: BIM's exact mirror twin. Draw him by running BIM's drawing function mirrored left/right (the parting on HIS right "
    "= screen left, the heart patch on HIS right chest = screen left, the pointer in his LEFT hand = screen right), with ONE "
    "deliberate difference: his MOUTH is BIM's FROWN (see bim_close_frown) flipped upside down. So it curves up like a "
    "smile, but everything that belongs below a frown is above it: the little puckered-chin stitch (a small '^' of thread "
    "that sits under the centre of BIM's frown) sits ABOVE the centre of MIB's mouth, between mouth and nose, and the corner "
    "tuck stitches point down-and-in instead of up-and-out. At a glance it is a smile; once you have seen BIM frown it is a "
    "frown turned over. His button eyes have the catchlight at the same pixel as BIM's (mirrored).")

# --- BIM full body -----------------------------------------------------------------------------
char("bim_idle", FULL, True,
     BIM + " Pose: standing facing the viewer, turned 15 degrees toward screen right (toward the frame), pointer held "
     "upright at chest height, mouth closed. Friendly at a glance. REGISTRATION for every full-body twin frame: canvas "
     "360x600, feet bottom centre at (180, 588), identical pixels except the parts that change.")
char("bim_talk", FULL, True,
     "BIM, identical to bim_idle except the mouth is open: the stitched smile opens into a rounded D, dark maroon inside, a "
     "pink felt tongue, NO teeth. Lip-flap partner of bim_idle.")
char("bim_point", FULL, True,
     "BIM, same registration, pointer arm stretched out and down toward screen LEFT (toward the Chair For You / his easel), "
     "head turned to the viewer, mouth closed, free hand on hip.")
char("bim_point_talk", FULL, True, "bim_point with the open D mouth. Lip-flap partner of bim_point.")
char("bim_walk_a", FULL, True,
     "BIM mid Backwards Walk, frame A: leaning back slightly, left heel lifted BEHIND him (he steps backwards, toe last), "
     "arms swinging, big closed smile. Same registration (feet near (180, 588)).")
char("bim_walk_b", FULL, True,
     "BIM mid Backwards Walk, frame B: the opposite leg and arms. The compositor alternates A/B at 7 fps and plays the "
     "travel in reverse; MIB's walk is these two frames mirrored by the compositor (his mouth difference is invisible at "
     "that size).")

# --- MIB full body -----------------------------------------------------------------------------
char("mib_idle", FULL, True,
     MIB + " Pose: the exact mirror of bim_idle (turned 15 degrees toward screen LEFT), mouth closed in his flipped-frown "
     "smile. Same registration as BIM.")
char("mib_talk", FULL, True,
     "MIB, identical to mib_idle except the mouth is open: the flipped-frown opens into an upside-down D (flat edge at the "
     "BOTTOM, round edge on top), maroon inside, no teeth. Used for his silent mirrored lip-flap in Act 1 and for his "
     "'speaking with BIM's voice' after the swap.")
char("mib_point", FULL, True,
     "MIB, the mirror of bim_point: pointer arm stretched out and down toward screen RIGHT, mouth closed.")
char("mib_wave", FULL, True,
     "MIB waving goodbye: pointer tucked under the arm, the free hand raised beside his head, fingers spread (four, too "
     "long), mouth closed. Alternates with mib_idle at 6 fps for the wave.")

# --- close-ups ---------------------------------------------------------------------------------
char("bim_close", CLOSE, True,
     "BIM head-and-shoulders close-up, facing the viewer, the stitched smile, button eyes with matching catchlights looking "
     "5 degrees past the lens (one pupil offset outward by 0.08 eye width). Friendly. REGISTRATION for all close-ups: canvas "
     "640x480, head centre (320, 220), head ~300 px wide.")
char("bim_close_frown", CLOSE, True,
     "BIM close-up, the FIRST and only time he frowns: the same head, but the stitched mouth is a down-turned curve, a small "
     "puckered-chin stitch ('^' of thread) under its centre, the corner tuck stitches pointing down and out; brows (two felt "
     "slivers) slanted sadly; button eyes looking straight into the lens. This exact mouth drawing, flipped vertically, IS "
     "MIB's smile: draw it once and reuse it.")
char("mib_close_smile", CLOSE, True,
     "MIB close-up, the mirror of bim_close with his flipped-frown smile: the identical curve of bim_close_frown turned upside "
     "down (pucker stitch ABOVE the mouth, tucks pointing down and in). Eyes dead into the lens, catchlights symmetric. Must "
     "read as a smile on its own and as BIM's frown turned over when cut right after bim_close_frown.")
char("mib_close_talk", CLOSE, True,
     "mib_close_smile with the upside-down-D open mouth. Lip-flap partner of mib_close_smile.")

# --- special poses -----------------------------------------------------------------------------
char("mib_chair_sit", [360, 520], True,
     "MIB sitting perfectly upright in a child's chair, hands flat on his knees, pointer across his lap, facing the viewer, "
     "feet not touching the floor, the flipped-frown smile, eyes dead ahead. ONLY the puppet (no chair). Seat contact at "
     "about (180, 380). Used only inside the colour-negative hold (7d), where his yellow felt turns BLUE.")
char("mib_camcorder", FULL, True,
     "MIB standing and holding a chunky 1990s shoulder camcorder up to his face with both hands, its small lamp ON (a hard "
     "white disc with a bloom), lens pointed straight at the viewer; his felt face half hidden behind the camcorder, one "
     "button eye and the flipped-frown smile visible beside it; perfectly still posture. Seen only as a mirror reflection "
     "(10e-10f), small, dark, lit by his own lamp. No brand names on the camcorder.")
char("hidden_twin_stand", [240, 600], True,
     "HIDDEN FIGURE: a near-black child-height silhouette standing perfectly straight, arms hanging, fingers to the knees, "
     "with the unmistakable bowl-haircut puppet head of the twins tilted 15 degrees; no features except two pinpoint glints "
     "where the button eyes would be. Soft edge, 4-10% luma over pure black. Feet at (120, 588). Used in Set B's doorway "
     "(H1-H3), in Set A's doorway in the negative hold (H4, where it inverts to a white figure-shaped hole), and in the "
     "mirror studio (H5).")
char("bim_couch_back", [240, 320], True,
     "A small figure kneeling on a couch cushion with its BACK to the viewer, facing away (toward the window behind the "
     "couch): the brown bowl haircut seen from behind, yellow felt neck, red-and-white striped shirt, arms at its sides, "
     "perfectly still. Drawn dim and flat (it will sit at ~6% luma inside a CRT reflection). Knee/cushion contact at "
     "(120, 300).")

# --- scare faces (horror.js realism toolkit) ---------------------------------------------------
char("turnabout_scare", SCARE, False,
     "SCARE 1 - MR. TURNABOUT RIGHT WAY UP (Thatcher reveal), fills 60% of the frame. The gouache portrait of the jolly bald "
     "grandfather (see turnabout_upside) turned right way up, close: the face is upright but its eyes and mouth are UPSIDE "
     "DOWN within it. Eyes: two realistic WET eyes (horror.js wetEye) inverted, the heavy upper lid at the bottom and the "
     "lower lid's waterline on top, irises with 40-60 fibres and a dark limbal ring, PINPOINT pupils, 4-6 grey-pink "
     "capillaries, staring dead into the lens. Mouth: the painted smile inverted into a deep down-turned grimace that is "
     "open, showing REAL ivory teeth (#E8DFC8) with the scalloped wet gum line (#C98C8C) BELOW the teeth, because they are "
     "upside down. No wounds, no blood. Underlit: key 45 degrees below, forehead 60% darker than the chin, hard terminator, "
     "55-70% of pixels at or below 8% luma; the gouache brush texture stays visible everywhere except the eyes and teeth. "
     "The sharpest image in the tape so far.")
char("turnabout_scare_b", SCARE, False,
     "Boil partner of turnabout_scare: identical except the shadow hatching (200-600 one-pixel strokes) and tremor contours "
     "are re-seeded. Mean luminance within 2% of turnabout_scare.")
char("mib_scare", SCARE, False,
     "SCARE 2 - MIB AT THE LENS, fills 75% of the frame, inches from the camera. His felt face, slightly fish-eyed by the "
     "closeness; the bowl haircut a black mass at the top; the felt pilled and frayed. His LEFT eye (screen right) is still a "
     "button, now with a hairline crack; his RIGHT eye (screen left) is a realistic WET human eye set in the felt, sclera "
     "showing all round the iris, pinpoint pupil, 6-8 grey-pink capillaries from the corners, a shining lower waterline. "
     "The flipped-frown grin has been RE-SEWN WIDER: running stitches continue 10-15% of head width past the old corners, "
     "and through the parted stitches a sliver of real ivory teeth shows. The puckered '^' stitch sits above the mouth. "
     "Underlit by the camcorder lamp from below-right: hard terminator, the far side of the head dissolving into black.")
char("mib_scare_b", SCARE, False,
     "Boil partner of mib_scare (re-seeded hatching and tremor lines, mean luminance within 2%).")
char("bim_scare_turn", SCARE, False,
     "SCARE 3, first frames: BIM's face UPSIDE DOWN and filling 90% of the frame, the eyes and mouth painted so that, upside "
     "down, they read the right way up: a sweet, normal, smiling face (the Thatcher illusion hides everything). Realistic "
     "wet eyes with pinpoint pupils, a closed smile. Underlit (light from what is the top of the frame, i.e. below his "
     "upside-down chin). It is exactly bim_scare rotated 180 degrees: draw bim_scare and rotate it.")
char("bim_scare", SCARE, False,
     "SCARE 3 - BIM THATCHERED, fills 90% of the frame, the biggest and loudest image of the tape. BIM's friendly felt face "
     "right way up, but its eyes and mouth upside down inside it: two realistic WET eyes inverted (waterline on top, heavy "
     "lid at the bottom), PINPOINT pupils dead into the lens, veined grey-pink whites; his friendly sewn smile inverted into "
     "a frown, its stitches torn open into a grimace of REAL ivory teeth with the wet scalloped gums BELOW them. Felt "
     "everywhere else (fibres, pilling, the bowl cut). Underlit 45 degrees from below, hard terminator, 55-70% of pixels "
     "black, one cheek and the eyes and teeth lit. No wounds, no blood.")
char("bim_scare_b", SCARE, False,
     "Boil partner of bim_scare (re-seeded hatching and tremor lines, mean luminance within 2%).")

# --- misc art ----------------------------------------------------------------------------------
FELT_CARD = ("A rule card: a cream felt card (480x360) with a red felt border and rounded corners, the text in chunky "
             "hand-cut felt letters (alternating red, blue and green, slightly uneven baselines), a small two-arrow "
             "Two-Way Kids logo bottom-right. READABLE (not mirrored): the compositor mirrors it for the board on the far "
             "side. Exact text: ")
misc("ident_bg", [640, 480], False,
     "Two-Way Kids ident background, early-90s airbrush: a soft pastel gradient (lemon at the bottom to sky blue at the top) "
     "with faint white stars and a subtle radial glow at the centre where the logo lands. No text.")
misc("twoway_logo", [400, 300], True,
     "The Two-Way Kids Home Video logo (original): two fat cartoon arrows, one red pointing left and one blue pointing right, "
     "chasing each other round a circle (their tails meet their heads), with the rounded bubble wordmark 'TWO-WAY KIDS' "
     "across the middle (white letters, purple outline, drop shadow) and 'HOME VIDEO' in small letter-spaced caps beneath. "
     "Centre of the circle at (200, 140). The compositor spins it, lands it MIRRORED for 12 frames, then snaps it correct.",
     text="TWO-WAY KIDS / HOME VIDEO")
misc("title_card", [640, 480], False,
     "Title card: pale yellow left half and pale blue right half split by a vertical seam (the room's colours), 'OPPOSITE "
     "DAY!' in huge bouncy felt letters across the middle, every second letter printed upside down as a joke (O, P, S, T, A "
     "and the '!' right way up; P, O, I, E, D and Y upside down), 'A Learn-Along Game Tape' in a rounded font beneath, "
     "small felt heads of BIM (left) and MIB (right) peeking up from the bottom corners, '(c) 1994 TWO-WAY KIDS HOME VIDEO' "
     "in small type at the bottom.",
     text="OPPOSITE DAY! / A Learn-Along Game Tape / (c) 1994 TWO-WAY KIDS HOME VIDEO")
misc("bumper_bg", [640, 480], False,
     "Segment-bumper background: a felt panel split yellow/blue down the middle with a scalloped white felt border and "
     "little felt stars; the centre left clear for compositor text (and for the twoway_logo in 9e).")
misc("card_rule1", [480, 360], False, FELT_CARD + "'RULE 1: YES MEANS NO'", text="RULE 1: YES MEANS NO")
misc("card_rule2", [480, 360], False, FELT_CARD + "'RULE 2: FORWARD IS BACKWARD'", text="RULE 2: FORWARD IS BACKWARD")
misc("card_rule3", [480, 360], False, FELT_CARD + "'RULE 3: SAFE MEANS NOT SAFE'", text="RULE 3: SAFE MEANS NOT SAFE")
misc("card_rule4", [480, 360], False,
     FELT_CARD + "'RULE 4: TO STOP, SAY IT'S NOT OPPOSITE DAY!' (three lines).",
     text="RULE 4: / TO STOP, SAY / IT'S NOT OPPOSITE DAY!")
misc("card_see_you", [480, 360], False,
     FELT_CARD + "'SEE YOU YESTERDAY! STAY ON YOUR SIDE.' (two lines). Shown READABLE in the ending, which is the reveal: "
     "MIB's side's cards are only readable from MIB's side.", text="SEE YOU YESTERDAY! / STAY ON YOUR SIDE.")
misc("turnabout_upside", [240, 300], True,
     "MR. TURNABOUT as he hangs on the wall: a small portrait (oval gilt frame with a brass hanging ring) in thick gouache "
     "of a smiling, rosy, bald grandfatherly man with white side whiskers and a blue bow tie, hung UPSIDE DOWN (his chin "
     "and bow tie at the top, his bald crown at the bottom). His eyes and mouth are painted the RIGHT way up relative to "
     "the viewer (the Thatcher illusion), so upside down he still reads as a jolly, twinkling, smiling old man. Painted "
     "button-bright eyes, no realism here. Hanging ring at (120, 8) (the compositor rotates the portrait about it).")
misc("toy_duck", [120, 100], True,
     "A wooden pull-toy duck (yellow body, orange beak, red wheels, a string loop), facing screen right, sitting on its "
     "wheels. Composited on Set A's toy chest lid, then on Set B's (the 5f continuity swap).")
misc("memo_setb", [640, 480], False,
     "Production memo photographed by a camcorder: a typed memo on yellowing paper taped to a set flat with brown tape, "
     "typewriter mono, ~90 px side margins, a coffee ring at top right. Header 'TWO-WAY KIDS - OPPOSITE DAY! - STAGE "
     "MANAGEMENT' and 'MARCH 17, 1994'. Lines: '1. Turnaround Room is struck nightly to the A side only.' / '2. SET B IS NOT "
     "TO BE LIT.' / '3. Performers are not to work the left-hand puppet.' / '4. If the left-hand puppet is in a different "
     "place in the morning, leave it there and tell nobody.' Then in blue ballpoint below: 'Nobody has worked it since "
     "the pilot. - D.' All text above y 380 (clear of the camcorder date band).",
     text="TWO-WAY KIDS - OPPOSITE DAY! - STAGE MANAGEMENT / MARCH 17, 1994 / 1. Turnaround Room is struck nightly to the "
          "A side only. / 2. SET B IS NOT TO BE LIT. / 3. Performers are not to work the left-hand puppet. / 4. If the "
          "left-hand puppet is in a different place in the morning, leave it there and tell nobody. / (handwritten) "
          "Nobody has worked it since the pilot. - D.")
misc("memo_cutlist", [640, 480], False,
     "A strike list on a clipboard hanging from a nail on the back of a flat, photographed by the camcorder: typed "
     "'STRIKE LIST - 3/22/94' and a short list: 'GOLD FRAME (1)' / 'TOY CHEST (2)' / 'WALL CLOCK (2)' / 'CHILD CHAIR (1)'. "
     "The '(1)' after CHILD CHAIR has been crossed out in pencil and '(2)' written beside it, and under the list in "
     "pencil: 'There is only one chair. Who is the other one for?' Text above y 380.",
     text="STRIKE LIST - 3/22/94 / GOLD FRAME (1) / TOY CHEST (2) / WALL CLOCK (2) / CHILD CHAIR (1 -> 2) / (pencil) "
          "There is only one chair. Who is the other one for?")
misc("card_correction_1", [640, 480], False,
     "A plain inserted video card in the style of a 1994 home-video dub: flat royal-blue background, white chunky mono "
     "capitals centred, a thin white rule above and below the text, the small two-arrow logo bottom-centre. No real "
     "station, network or agency styling, no warning-screen look.",
     text="CORRECTION: / TODAY IS NOT OPPOSITE DAY.")
misc("card_correction_2", [640, 480], False,
     "Same style as card_correction_1.", text="THE PREVIOUS CORRECTION / WAS ALSO OPPOSITE.")
misc("end_card_blue", [640, 480], False,
     "The last card: flat VCR blue (R 0.08, G 0.08, B 0.75), white text centred in the same chunky rounded font as the "
     "title card, no logo.", text="TODAY IS NOT OPPOSITE DAY")
misc("crt_glass", [640, 480], True,
     "Overlay for a dark CRT screen seen head-on (copy poppy/build/art/misc/crt_glass.png if it fits): a soft curved "
     "specular band from upper left (white at 6-10% alpha), dust specks and one smudge at 3-5% alpha, a faint convex "
     "vignette, the rounded tube edge darkening to opaque black in the corners. Transparent elsewhere.")
