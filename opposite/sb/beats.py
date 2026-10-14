# Scare map, subliminals, hidden figures, changes between cuts, dread beats, silences.
# Defined once here; used by STORYBOARD.md section 2 and by the checks in gen_storyboard.py.

# (name, shot, % of frame filled, setup, the one sound before it, payload, after)
SCARES = [
    ("SCARE 1", "8i", 60,
     "Mr. Turnabout's turn was withheld at 6d-6e, so the audience is waiting for it. After the swap MIB says 'You're "
     "safe' in BIM's voice on a steady 2.0 s cut rhythm (8e-8g) while the studio lights go off one step per line; only "
     "a reversed clock ticks between lines. 8h breaks the rhythm 0.7 s early.",
     "the reverse-reverb swell of a fourth 'You're safe' (sfx_preverb_safe), cut dead before the word",
     "turnabout_scare (+ _b boil): the portrait right way up, Thatchered, wet eyes and teeth upside down, underlit; 60% of "
     "the frame, 0.7 s; sfx_stinger_1",
     "hard cut to black and 1.5 s of DIGITAL SILENCE (#1), then the bright show"),
    ("SCARE 2", "10g", 75,
     "Behind B, under a sinking Shepard tone: the second dark studio, the strike list, then the gold frame holding a "
     "mirror. Autofocus hunts on the reflection for 4 s; the eye is pulled right to the reflected ghost light; between "
     "cuts the reflected figure is closer and it is MIB holding the camcorder. The operator's breathing plays reversed; "
     "Shepard and breath are cut dead.",
     "one reversed inhale (sfx_inhale_rev), 20% left, swelling and cut dead by the hit",
     "after a 3-frame tracking glitch, mib_scare (+ _b): MIB inches from the lens, one real wet eye in the felt, the "
     "flipped-frown grin re-sewn wider; 75% of the frame, 0.8 s; sfx_stinger_2 + sfx_scream_rev",
     "0.3 s static, then near-silence (camcorder hiss at -60 dBFS, deliberately not digital zero)"),
    ("SCARE 3", "11i", 90,
     "'BIM isn't with you. He isn't right behind you' (decoded: he is). A 17.9 s push into Set B's dead CRT, which "
     "reflects a living room; a small figure kneels on the LEFT of the couch with its back to the screen (H6), ~6% luma. "
     "Room tone, sub-bass breathing, the reversed whisper hard left; the sub-bass is cut dead.",
     "a couch-spring creak hard LEFT (sfx_couch_creak), pulling the eye to the figure",
     "in the CENTRE: bim_scare_turn (BIM's face upside down, sweet) for 4 frames, one stepped 90-degree frame, then "
     "bim_scare (+ _b) right way up and Thatchered; 90% of the frame, 1.0 s; sfx_stinger_3, the loudest sound on the tape",
     "black and 2.0 s of DIGITAL SILENCE (#2), then the VCR rewinds itself"),
]

# (id, shot, offset in shot, frames, image)
SUBLIMINALS = [
    ("S1", "5f", 0.03, 1, "`build/rooms/turnaround_wide_late.png` (two chairs, the blanket on MIB's side) inside the "
                          "glitch that moves the duck"),
    ("S2", "6e", 0.30, 2, "`build/art/char/turnabout_scare.png` (right way up) inside the withheld turn's tracking burst"),
    ("S3", "7g", 0.40, 1, "compositor text 'YES MEANS NO', MIRRORED, white on black, at the vertical roll back to the show"),
    ("S4", "9f", 0.30, 2, "`build/rooms/livingroom.png` mirrored, normal brightness, with `build/art/char/bim_couch_back.png` "
                          "on the left cushion (foreshadows scare 3)"),
    ("S5", "12a", 1.00, 1, "`build/art/char/mib_scare.png` in colour negative, inside the self-rewind"),
]

# (id, shot, offset, what and where, then)
HIDDEN = [
    ("H1", "5c", 0.0, "`hidden_twin_stand` deep in Set B's black doorway, ~11% of frame height",
     "Closer in each cut (H2, H3): the only thing in the tape moving forward."),
    ("H2", "5d", 0.0, "the same figure at the threshold of Set B's doorway, ~15%",
     "Closer again in 5e."),
    ("H3", "5e", 0.0, "the same figure standing IN the mouth of Set B's doorway, its toes in the light, ~20%",
     "Gone after the 5f glitch (and the duck has crossed sides)."),
    ("H4", "7d", 0.0, "in the held colour negative, a glowing WHITE figure-shaped hole in Set A's doorway, ~24% "
     "(dark in reality; only the negative shows it), beside MIB sitting in the Chair For You",
     "7e (positive): the doorway is black and empty, the chair empty."),
    ("H5", "10c", 0.0, "`hidden_twin_stand` beside the far gold frame in the mirrored dark studio behind Set B, ~14%",
     "Never seen again; in 10e-10f MIB is in the mirror instead."),
    ("H6", "11f", 0.0, "`bim_couch_back` kneeling on the left of the couch in the dead CRT's living-room reflection, "
     "back to the screen, ~6% luma",
     "Held 17.9 s, never acknowledged; it turns into scare 3."),
]

# (shot, offset, what changes between cuts or inside a glitch)
CHANGES = [
    ("4f", 4.3, "MIB is a full gesture AHEAD of BIM for 15 frames (the copy leads the original), then back in sync"),
    ("5f", 0.0, "behind a 3-frame glitch: the toy duck has moved from Set A's chest to the mirror position on Set B's; "
                "the doorway figure is gone"),
    ("7e", 0.0, "NEG off: MIB is not in the chair; the white figure is not in the doorway"),
    ("8a", 0.0, "THE BIG ONE, near the faces: the twins have traded sides AND become each other's mirror image (heart "
                "patches and partings flipped), the PLAY OSD pops up top-LEFT instead of top-right, the voices come "
                "from the wrong speakers, the clocks have swapped direction. Nobody comments."),
    ("8b", 0.0, "the rule card is readable on the LEFT board and mirrored on BIM's board"),
    ("9a", 0.0, "BIM is gone; the blanket has left the Chair For You for a second, identical chair on MIB's side"),
    ("10f", 0.0, "the MIB in the mirror is closer (he walks forward between cuts while the operator stands still)"),
    ("11f", 0.0, "the living-room reflection is now in Set B's TV (in 4a it was a faint, empty reflection in Set A's)"),
    ("12c", 0.0, "the reverse angle: Set A's card reads mirrored, MIB-side card readable, the OSD mirrored"),
]

# (name, shot, description) - 'did I see that?' moments and quiet dread beats (never mentioned on screen)
DREAD = [
    ("Backwards bars", "1d", "colour bars in reverse order; the test tone fades IN and stops dead"),
    ("Mirrored ident", "2a", "the logo lands mirror-reversed for 12 frames before snapping right"),
    ("Anticlockwise clock", "3a", "Set B's clock runs anticlockwise from the first shot"),
    ("Wrong lyric", "3f", "the caption says 'Come and sit here by my side,' while the vocal sings 'on the other side'"),
    ("Silent copy", "4a", "MIB's mouth flaps 4 frames late with no voice; Set A's dead TV reflects an empty living room"),
    ("The third NO", "4g", "'Is everybody here?' 'NO!' (yes) - and one more reversed child's 'NO!' from MIB's side; both "
                           "twins freeze for 1.4 s, then BIM carries on"),
    ("Forward figure", "5c", "H1-H3: across the Backwards Walk the only thing moving forward is the figure in the doorway"),
    ("Withheld turn", "6d", "the portrait stops at ninety degrees and the tape tears away (false scare; pays off at 8i)"),
    ("The negative", "7d", "an 8 s held negative: MIB in your chair, a white figure in Set A's door; NEG off, both gone"),
    ("The memo", "7f", "'Performers are not to work the left-hand puppet.' / 'Nobody has worked it since the pilot.'"),
    ("The swap", "8a", "sides, mirror image, OSD corner, voices and clocks all swapped, unannounced"),
    ("The frown", "8c", "BIM frowns once; the next cut is MIB smiling with the same curve turned over"),
    ("The lock", "9d", "'It's NOT Opposite Day!' x3 - 'and on Opposite Day, that means...'"),
    ("Two chairs", "10d", "the strike list: CHILD CHAIR (1) corrected to (2). 'Who is the other one for?'"),
    ("Corrections", "11b", "'CORRECTION: TODAY IS NOT OPPOSITE DAY.' / 'THE PREVIOUS CORRECTION WAS ALSO OPPOSITE.'"),
    ("Reassurance", "11e", "'BIM isn't with you. He isn't right behind you.' Decoded, it is a warning."),
]

# (name, shot, why) - true digital silence, exactly three times
SILENCES = [
    ("#1", "8j", "after scare 1"),
    ("#2", "11j", "after scare 3, before the self-rewind"),
    ("#3", "12e", "the tape stops: silence to the end"),
]
