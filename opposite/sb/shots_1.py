# Shot list part 1: segments 1-4 (Act 1: the tape earns trust).
V1 = "V1 (Act 1, nearly clean), warm tint."
LIPFLAP = ("LIP-FLAP: talk frame while the voice's 20 ms RMS is above -30 dBFS, delayed 3 frames, minimum 3 frames "
           "per mouth state.")
MIRROR_FLAP = ("MIB MIRROR RULE (Act 1): MIB copies BIM's every pose and mouth state 4 frames LATE, with no voice of "
               "his own (his mouth flaps silently).")
CLOCKS = ("CLOCKS: the compositor draws the hands on clock_a and clock_b: Set A's runs normally (second hand clockwise, "
          "1 step/s); Set B's runs ANTICLOCKWISE (a quiet plant; nobody mentions it).")

# ===== 1 =====
seg("1", "TAPE START",
    "Black, the cassette loads, VCR blue with the PLAY OSD in the top-RIGHT corner, and colour bars in REVERSE order whose "
    "test tone fades IN instead of out: the first inversion, unexplained.", "Act 1")

sh("1a", 0.8, "Black, tape loads")
pic("Pure black.")
vhs("none (black). Tape hiss fades in from +0.5 s.")
au(SFX("sfx_vcr_insert", 0.0, "-14 dBFS."))

sh("1b", 2.4, "VCR blue screen")
pic("Flat VCR blue (R 0.08, G 0.08, B 0.75); VCR OSD 'PLAY ▶' in the TOP-RIGHT corner with the counter '0:00:00' "
    "under it, counting up normally (DejaVu Sans Mono Bold 30, white, 2 px black shadow).")
vhs("V1 on the blue, no dropouts.")
au("Compositor: tape hiss (-43 dBFS RMS, 2-8 kHz) and 60 Hz hum (-52 dBFS) start and run under the whole tape except the "
   "three digital silences.")
note("Plant: the OSD corner. It moves to the top-LEFT after the swap (8a) and reads mirrored at the end (12b-12f).")

sh("1c", 0.8, "Tracking lock")
pic("Rolling snow with a 'TRACKING' OSD bar filling left to right at bottom centre; the bars bleed in over the last 0.3 s.")
vhs("V4.")
au(SFX("sfx_static_burst", 0.0, "-20 dBFS, trimmed to 0.8 s with a 0.3 s fade."),
   SFX("sfx_tracking_garble", 0.5, "-24 dBFS."))

sh("1d", 4.2, "Colour bars, backwards")
pic("Compositor colour bars (color_bars() from horror/make_video.py) with the seven top bars in REVERSE order (blue, "
    "red, magenta, green, cyan, yellow, white from left to right) and the lower castellations reversed too; black caption "
    "strip: 'TWK-0194   OPPOSITE DAY!   SP' (mono 22, readable).")
vhs("V1; a tracking band clears over the first 0.6 s.")
au(SFX("sfx_bars_tone_rev", 0.0, "-20 dBFS: the tone swells IN from silence and stops dead on the cut to 1e. The "
       "compositor applies the tape-start pitch ramp (x0.6 -> x1.0 over the first 0.4 s)."))

sh("1e", 0.5, "Edit point")
pic("Black; one vertical roll with a 25 px black bar; 2 frames of rainbow hue sweep.")
vhs("V3.")
au(SFX("sfx_tracking_garble", 0.0, "-26 dBFS, trimmed to 0.4 s."))

# ===== 2 =====
seg("2", "IDENT AND TITLE",
    "The Two-Way Kids ident: the two chasing arrows spin in, overshoot and land MIRRORED (the wordmark backwards) for "
    "12 frames before snapping right with a boing, over a palindrome jingle. Then the title card.", "Act 1")

sh("2a", 6.0, "Two-Way Kids ident")
pic(f"{R('ident_bg')} full frame; {R('twoway_logo')} composited at the centre (circle centre at (320, 210), 1.0x). It "
    "spins in from 0.2x to 1.08x over +0.0 to +1.2 s (two full turns, ease-out), settles to 1.0x MIRRORED left/right "
    "(the wordmark reads 'SDIK YAW-OWT', arrows reversed) and holds mirrored for exactly 12 frames (+1.3 to +1.7 s), then "
    "snaps the right way round in one frame at +1.7 s with a 4-frame squash (1.0 -> 0.92 -> 1.04 -> 1.0).")
cam("Static.")
vhs(V1)
au(SFX("mus_ident_palindrome", 0.1, "-8 dBFS peak."),
   SFX("sfx_boing", 1.7, "-14 dBFS, on the snap."),
   VO("vo_narr_ident", 2.4, "-11 dBFS."))

sh("2b", 4.5, "Title card")
pic(f"{R('title_card')} full frame.")
cam("Slow push 1.00 -> 1.05.")
vhs(V1)
au("The ident chord rings out; hiss and hum.")

sh("2c", 0.4, "Cut to the show")
pic("Black, with a single 2-frame tracking blip at +0.2 s.")
vhs("V2.")
au("Hiss only.")

# ===== 3 =====
seg("3", "THEME SONG",
    "The bright, perfectly symmetric Turnaround Room. BIM pops up on the left, his mirror twin MIB on the right, 4 frames "
    "late. Seeds: Set B's clock runs anticlockwise, one caption does not match the sung lyric, and the song invites you to "
    "'come and sit'.", "Act 1")

sh("3a", 2.0, "The Turnaround Room")
pic(f"{R('turnaround_wide')} (1280x960, scaled to fill), empty of puppets; {R('toy_duck')} sitting on Set A's toy-chest "
    "lid (chest_a_lid). " + CLOCKS)
cam("Push 1.00 -> 1.03.")
vhs(V1)
au(SFX("mus_theme", 0.0, "-8 dBFS peak; runs 22.0 s under 3a-3h. Sing-along captions use the 'lyrics' start times in "
       "build/audio/manifest.json (yellow #FFE14D DejaVu Sans Bold 24, black outline, centred at y~440)."))
note("From here the compositor drains Set B's (right half's) saturation very slowly over the tape: 1.00 now, 0.92 by "
     "segment 6, 0.80 after the swap, 0.65 in segments 9-11. Set A never changes. Nobody should notice it consciously.")

sh("3b", 3.0, "Turn around and turn around")
pic(f"{R('turnaround_wide')}: BIM pops up from below the frame edge at foot_bim ({R('bim_idle')}, 6-frame "
    "squash-and-stretch), MIB at foot_mib ({R('mib_idle')}) exactly 4 frames later. On 'turn around' each spins once in "
    "3 stepped poses at 6 fps (idle -> mirrored idle -> idle). " + MIRROR_FLAP)
cam("Static.")
vhs(V1)
au(SFX("sfx_pop", [0.1, 0.23], "-18 dBFS, one per twin (MIB's 4 frames late)."))
txt("Caption: 'Turn around and turn around,'")

sh("3c", 3.0, "Up is down")
pic(f"{R('turnaround_wide')}: both twins ({R('bim_idle')}, {R('mib_idle')}) flip upside down in three stepped frames "
    "(0, 90, 180 degrees at 6 fps, pivoting on their centres) on 'up is down', hold, and flip back on 'down is up'. MIB "
    "4 frames late.")
cam("Static.")
vhs(V1)
txt("Caption: 'up is down and down is up!'")

sh("3d", 3.0, "Yes is no")
pic(f"{R('bumper_bg')} with compositor felt-letter words 'YES' (left half, red) and 'NO' (right half, blue), DejaVu Sans "
    "Bold 96 with a 4 px white outline; on the beat at +1.0 and +2.0 s the two words swap halves (hard position swaps, "
    "not flashes).")
cam("Static.")
vhs(V1)
txt("Caption: 'Yes is no and no is yes,'")

sh("3e", 3.0, "Who's who?")
pic(f"{R('turnaround_frame')}: BIM waist-up on the left ({R('bim_idle')} / {R('bim_talk')} flapping on the sung "
    f"syllables) and MIB on the right ({R('mib_idle')} / {R('mib_talk')}, 4 frames late), both leaning in so their noses "
    "almost meet in the empty frame opening.")
cam("Push 1.00 -> 1.06.")
vhs(V1)
txt("Caption: 'BIM and MIB, who's who? Guess!'")

sh("3f", 3.0, "Come and sit")
pic(f"{R('turnaround_wide')} cropped 1.7x on the Chair For You (chair_a, with its blanket); BIM at the left edge, "
    f"cropped at the waist, pointing at it ({R('bim_point')}).")
cam("Push 1.00 -> 1.12 toward the chair.")
vhs(V1)
txt("Caption: 'Come and sit here by my side,'")
note("SEED: the vocal SINGS 'Come and sit on the other side,' under this caption (it is inside mus_theme). The mismatch is "
     "never explained.")

sh("3g", 3.0, "Opposite Day is here for you")
pic(f"{R('bim_close')} over {R('turnaround_wide')} blurred (6 px, x0.9): BIM's friendly close-up, the stitched smile "
    "with its upturned corner tucks clearly visible (the viewer will need to remember this smile at 8c-8d).")
cam("Push 1.00 -> 1.06.")
vhs(V1)
txt("Caption: 'Opposite Day is here for you!'")

sh("3h", 2.0, "Hi, kids!")
pic(f"{R('turnaround_wide')}, both twins on their marks: BIM {R('bim_talk')} on 'Hi, kids!' (+0.3 to +0.9 s) else "
    f"{R('bim_idle')}; MIB alternates {R('mib_wave')} / {R('mib_idle')} at 6 fps, waving. " + CLOCKS)
cam("Static.")
vhs(V1)
txt("Caption at +0.3 s: 'Hi, kids!'")
note("The spoken 'Hi, kids!' is inside mus_theme at 20.3 s (3h +0.3 s).")

# ===== 4 =====
seg("4", "HELLO, AND RULE 1",
    "BIM introduces his twin ('he does everything just like me!') and YOUR spot on his side. Rule 1: yes means no. MIB's "
    "cards are mirror-written: 'If you can read them, you're on the wrong side!' A cheerful quiz; then 'Is everybody "
    "here?' 'NO!' (yes) - and one more 'NO!' comes back reversed from MIB's side.", "Act 1")

sh("4a", 8.5, "Hi, I'm BIM")
pic(f"{R('turnaround_wide')}; BIM at foot_bim lip-flapping {R('bim_idle')} / {R('bim_talk')}; MIB at foot_mib with "
    f"{R('mib_idle')} / {R('mib_talk')} per the mirror rule. On 'just like me' (about +5.6 s) BIM switches to "
    f"{R('bim_point')} (pointer raised toward MIB) and MIB to {R('mib_point')} 4 frames later. {R('toy_duck')} on "
    f"chest_a_lid. In Set A's dark CRT screen (crt_a quad): a tiny reflection of {R('livingroom')} (mirrored, ~8% luma, "
    "barrelled, no figure) - our side's room, plausibly a reflection. " + CLOCKS + " " + MIRROR_FLAP + " " + LIPFLAP)
cam("Static; both twins bob 2 px at 0.4 Hz, MIB's bob 4 frames behind.")
vhs(V1)
au(SFX("mus_show_bed", 0.0, "-24 dBFS, looped under segments 4-6, ducked 8 dB under every line."),
   VO("vo_bim_hi", 0.4, "-11 dBFS, panned 30% left."),
   VO("vo_bim_twin", 2.4, "-11 dBFS, panned 30% left."),
   SFX("sfx_laugh", 6.8, "-20 dBFS ('aww, hee hee')."))

sh("4b", 5.0, "Your spot")
pic(f"{R('turnaround_wide')} cropped 1.6x between BIM and the chair (chair_a with its blanket in the left third); BIM "
    f"{R('bim_point')} / {R('bim_point_talk')}, pointing at the chair.")
cam("Static; at +3.6 s a small operator push 1.00 -> 1.06 onto the chair.")
vhs(V1)
au(VO("vo_bim_spot", 0.4, "-11 dBFS, panned 30% left."),
   SFX("sfx_kids_yay", 3.5, "-18 dBFS."))

sh("4c", 1.5, "Bumper: RULE 1!")
pic(f"{R('bumper_bg')} with compositor text 'RULE 1!' bouncing in (DejaVu Sans Bold 64, red, 4 px white outline).")
vhs(V1)
au(SFX("mus_bumper", 0.0, "-10 dBFS; the bed ducks 6 dB."))

sh("4d", 6.0, "Yes means no")
pic(f"{R('turnaround_frame')}: {R('card_rule1')} pasted in perspective on board_a (readable) and the SAME card mirrored "
    f"left/right on board_b; BIM waist-up on the left {R('bim_point')} / {R('bim_point_talk')}, pointing at his board; "
    f"MIB on the right {R('mib_point')}, mouth closed (the mirror rule applies to pose only here).")
cam("Static.")
vhs(V1)
au(VO("vo_bim_rule1", 0.5, "-11 dBFS, panned 30% left."))
txt("Card (in the art): RULE 1: YES MEANS NO (mirrored on MIB's board).")

sh("4e", 6.0, "You're on the wrong side")
pic(f"Same framing: {R('turnaround_frame')} with both boards as in 4d; BIM {R('bim_idle')} / {R('bim_talk')} giggling, "
    f"turned to camera; MIB {R('mib_idle')} / {R('mib_talk')} flapping silently 4 frames late.")
cam("Push 1.00 -> 1.08 toward MIB's mirrored board (right third) during 'If you can read them'.")
vhs(V1)
au(VO("vo_bim_wrongside", 0.3, "-11 dBFS, panned 30% left."),
   SFX("sfx_laugh", 4.9, "-18 dBFS."))
note("PLANT for the ending (12c): MIB's cards are only readable from MIB's side.")

sh("4f", 6.5, "Quiz")
pic(f"{R('turnaround_wide')}; BIM {R('bim_idle')} / {R('bim_talk')}; MIB {R('mib_idle')} / {R('mib_talk')} per the "
    f"mirror rule. HIDDEN BEAT at +4.3 s: MIB goes to {R('mib_point')} FIFTEEN FRAMES BEFORE BIM goes to "
    f"{R('bim_point')} (+4.8 s) - for half a second the copy is AHEAD of the original - then both hold the pose in "
    "sync. " + CLOCKS)
cam("Static.")
vhs(V1)
au(VO("vo_bim_sky", 0.3, "-11 dBFS."),
   VO("vo_kids_yes", [1.8, 5.5], "-12 dBFS ('YES!' = no)."),
   SFX("sfx_laugh", 2.6, "-20 dBFS."),
   VO("vo_bim_icecream", 3.9, "-11 dBFS."))

sh("4g", 6.5, "Is everybody here?")
pic(f"{R('turnaround_wide')}, both twins {R('bim_idle')} / {R('bim_talk')} and {R('mib_idle')}; after the reversed "
    "'NO!' (+2.9 s) BOTH twins freeze completely - no bob, no flap - for 1.4 s, then BIM carries on brightly.")
cam("Static.")
vhs(V1)
au(VO("vo_bim_everybody", 0.3, "-11 dBFS."),
   VO("vo_kids_no", 1.8, "-12 dBFS ('NO!' = yes, everybody is here)."),
   VO("vo_child_no_rev", 2.9, "-16 dBFS, panned 70% RIGHT: one voice too many, from MIB's side."),
   "+2.9 s mus_show_bed ducks to -36 dBFS for the freeze and returns at +4.4 s.",
   VO("vo_bim_great", 4.6, "-11 dBFS, bright, as if nothing was heard."))
note("DREAD: the headcount answered by one extra child. Under rule 1 it means: everybody is here, and someone else too.")
