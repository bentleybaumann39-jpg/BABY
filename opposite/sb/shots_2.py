# Shot list part 2: segments 5-7 (Act 1 -> Act 2).
EP = ("EP + V2 (camcorder recorded over the show): luma blur k=5, chroma blur 25, noise x1.6, green-grey tint, exposure "
      "pumping (gain 0.7-1.0 on 0.3 Hz noise). CAMCORDER OSD (section 4).")
HIDDEN_NOTE = ("Composited like any cutout but blurred 3 px, graded to the dark, kept 4-8% luma above the black doorway; "
               "nothing reacts to it.")

# ===== 5 =====
seg("5", "RULE 2: THE BACKWARDS WALK",
    "Forward is backward. The twins do the Backwards Walk to reversed footsteps; BIM talks backwards. Across three cuts a "
    "small dark figure in Set B's doorway is the only thing in the tape moving FORWARD, closer each time. Goodbye means "
    "hello. Then the doorway is empty and the toy duck has crossed to the other side.", "Act 1")

sh("5a", 1.5, "Bumper: RULE 2!")
pic(f"{R('bumper_bg')} with compositor text 'RULE 2!' bouncing in (as 4c).")
vhs(V1)
au(SFX("mus_bumper", 0.0, "-10 dBFS."))

sh("5b", 5.0, "Forward is backward")
pic(f"{R('turnaround_frame')}: {R('card_rule2')} on board_a, mirrored on board_b; BIM {R('bim_point')} / "
    f"{R('bim_point_talk')}; MIB {R('mib_point')} (pose mirrored 4 frames late).")
cam("Static.")
vhs(V1)
au(VO("vo_bim_rule2", 0.4, "-11 dBFS, panned 30% left."))

sh("5c", 4.0, "Backwards Walk 1")
pic(f"{R('turnaround_wide')}: BIM alternates {R('bim_walk_a')} / {R('bim_walk_b')} at 7 fps while his position "
    "steps BACKWARD from foot_bim toward screen left (205 -> 160 px in 640 terms, stepped at 7 fps); MIB is the same two "
    "frames mirrored, stepping from foot_mib toward screen right, 4 frames late. Both walks are animated forwards and "
    f"PLAYED IN REVERSE. HIDDEN FIGURE H1: {R('hidden_twin_stand')} deep in Set B's black doorway (door_b), ~11% of "
    "frame height, standing still. " + HIDDEN_NOTE)
cam("Static.")
vhs(V1)
au(SFX("sfx_steps_rev", 0.0, "-20 dBFS (reversed footsteps: swell, then cut), trimmed to the shot."),
   "mus_show_bed continues under, ducked 4 dB.")

sh("5d", 4.0, "Backwards Walk 2: Walk happily!")
pic(f"{R('turnaround_wide')}: the twins walk backwards again ({R('bim_walk_a')} / {R('bim_walk_b')}, MIB mirrored), "
    f"returning toward their marks; on the reversed line BIM's walk frames hold on {R('bim_walk_a')}. HIDDEN FIGURE H2: "
    f"{R('hidden_twin_stand')} closer, at the threshold of door_b, ~15% of frame height. " + HIDDEN_NOTE)
cam("Static.")
vhs(V1)
au(SFX("sfx_steps_rev", 0.0, "-20 dBFS, trimmed to the shot."),
   VO("vo_bim_walk_rev", 0.5, "-11 dBFS, panned 30% left."))
txt("Subtitle +0.5 to +1.9 s: 'WALK HAPPILY!' (white DejaVu Sans Bold 26 on a black box, bottom centre).")

sh("5e", 4.5, "Goodbye means hello")
pic(f"{R('turnaround_wide')}: twins back on their marks, BIM {R('bim_idle')} / {R('bim_talk')}, MIB {R('mib_idle')} / "
    f"{R('mib_talk')} per the mirror rule. HIDDEN FIGURE H3: {R('hidden_twin_stand')} now standing IN the mouth of "
    "door_b, its feet on the edge of the lit floor, ~20% of frame height; the light reaches its toes only. " + HIDDEN_NOTE)
cam("Static.")
vhs(V1)
au(VO("vo_bim_goodbye", 0.3, "-11 dBFS, panned 30% left."),
   VO("vo_kids_goodbye", 3.2, "-12 dBFS."))
note("PLANT for the ending: goodbye means hello.")

sh("5f", 2.0, "Glitch: the duck has crossed")
pic(f"A 3-frame tracking blip at +0.0 s containing SUBLIMINAL S1 (one frame of {R('turnaround_wide_late')}: two "
    f"chairs, the blanket on Set B's). Then {R('turnaround_wide')}: door_b empty and black; {R('toy_duck')} now on "
    "Set B's chest lid (chest_b_lid), facing screen LEFT (mirrored); twins idle "
    f"({R('bim_idle')}, {R('mib_idle')}).")
cam("Static.")
vhs("V1, V3 inside the blip.")
au(SFX("sfx_tracking_garble", 0.0, "-24 dBFS, 0.1 s."),
   SFX("sfx_laugh", 0.3, "-20 dBFS."))

# ===== 6 =====
seg("6", "UPSIDE-DOWN FACES (withheld)",
    "Mr. Turnabout, a jolly portrait that hangs upside down. 'Is he happy?' 'YES!' (no). 'Let's turn him right side "
    "up!' The portrait turns on its nail in creaking steps; at ninety degrees the tape tears into recorded-over footage. "
    "The payoff is withheld.", "Act 1 -> 2")

sh("6a", 1.5, "Bumper: UPSIDE-DOWN FACES!")
pic(f"{R('bumper_bg')} with compositor text 'UPSIDE-DOWN FACES!' (two lines; the second word printed upside down).")
vhs(V1)
au(SFX("mus_bumper", 0.0, "-10 dBFS."))

sh("6b", 6.0, "Mister Turnabout")
pic(f"{R('turnaround_portrait')} with {R('turnabout_upside')} hanging from nail_a by its ring, upside down, jolly. "
    "Clock hands as Set A's (normal).")
cam("Static.")
vhs(V1)
au(VO("vo_bim_turnabout", 0.3, "-11 dBFS, BIM off screen, panned 30% left."),
   VO("vo_bim_happy", 3.5, "-11 dBFS."),
   VO("vo_kids_yes", 5.0, "-12 dBFS ('YES!' = no)."))

sh("6c", 3.0, "Let's turn him over")
pic(f"{R('turnaround_portrait')} with {R('turnabout_upside')}.")
cam("Push 1.00 -> 1.25 on the portrait.")
vhs(V1)
au(VO("vo_bim_turn", 0.2, "-11 dBFS."),
   SFX("sfx_kids_yay", 1.9, "-18 dBFS, trimmed to 1.1 s with a 0.3 s fade so nothing spills into 6d."))

sh("6d", 3.2, "The turn")
pic(f"{R('turnaround_portrait')} at 1.25x on the portrait; {R('turnabout_upside')} rotates about its ring in hard steps: "
    "180 degrees (as hung) -> 135 at +0.4 s -> 90 at +1.2 s, then HOLDS sideways (the face unreadable, neither happy nor "
    "not) until the end of the shot. Tracking noise starts creeping up from the bottom of the frame at +2.6 s.")
cam("Static.")
vhs("V1 -> V3 over the last 0.6 s.")
au("mus_show_bed CUT DEAD at +0.0 s (no fade): room tone only.",
   SFX("amb_room_tone", 0.0, "-42 dBFS."),
   SFX("sfx_ratchet", [0.4, 1.2], "-16 dBFS, one per step."))

sh("6e", 0.8, "Tracking burst (withheld)")
pic(f"Rainbow hue sweep, a vertical roll with a 25 px black bar; SUBLIMINAL S2 at +0.3 s: 2 frames of "
    f"{R('turnabout_scare')} (right way up), hard in and out. Then black.")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-16 dBFS."),
   SFX("sfx_static_burst", 0.1, "-20 dBFS, 0.6 s."),
   "Compositor: a 0.1 s audio pop at +0.0 s.")
note("FALSE SCARE / WITHHELD PAYOFF: the audience braces for the face; the tape takes it away. It comes back at 8i.")

# ===== 7 =====
seg("7", "RECORDED OVER: SET B",
    "Night camcorder footage recorded over the show (EP): the stage manager in the dark studio. The camera's NEG effect "
    "holds the set in colour negative for eight seconds - MIB sits in the Chair For You, a blue shape, and something "
    "white stands in Set A's doorway. NEG off: the chair is empty. A memo: performers are not to work the left-hand "
    "puppet.", "Act 2")

sh("7a", 0.8, "Camcorder starts")
pic("Black; the camcorder OSD appears at +0.3 s; the picture fades up from black from +0.5 s.")
vhs(EP + " OSD: '● REC' top-left blinking at 1 Hz, 'SP' and a battery icon top-right, 'MAR 19 1994' bottom-left, "
    "'11:40 PM' bottom-right.")
au(SFX("sfx_cam_beep", 0.1, "-18 dBFS."),
   "Camcorder audio for segments 7 and 10: band 100 Hz-6 kHz, motor whine at about 2 kHz at -50 dBFS, AGC pumping the "
   "hiss up in quiet moments (compositor).")

sh("7b", 6.5, "The studio at night")
pic(f"{R('turnaround_night')} scaled to fill: the ghost light, the dull gold frame, the chair and blanket catching a warm "
    "edge, both doorways black.")
cam("Handheld drift (+-6 px, +-0.6 deg); autofocus blurry (4 px) -> sharp over 1.2 s; slow pan from the frame toward "
    "the chair (cx 0.50 -> 0.38).")
vhs(EP)
au(SFX("amb_studio_night", 0.0, "-38 dBFS, runs under 7b-7f."),
   VO("vo_crew_1", 1.0, "-13 dBFS."))

sh("7c", 3.5, "The chair")
pic(f"{R('turnaround_night')} cropped 1.5x on chair_a: the empty chair with its blanket. At +3.0 s the OSD shows 'NEG' "
    "(top-right, under 'SP').")
cam("Handheld, settling.")
vhs(EP)
au(VO("vo_crew_2", 0.3, "-13 dBFS."),
   SFX("sfx_neg_click", 2.9, "-20 dBFS."))

sh("7d", 8.0, "NEG: the held negative")
pic(f"{R('turnaround_night')} cropped 1.25x to hold both chair_a and door_a, shown as a held COLOUR NEGATIVE for the "
    f"whole shot (enters and leaves on hard cuts; no flicker, never alternated with positive). Before inverting, the "
    f"compositor puts {R('mib_chair_sit')} in the chair (so his yellow felt reads BLUE and his heart patch sits on "
    "screen-LEFT: MIB, not BIM), and grades the inside of door_a up to 12% grey with "
    f"{R('hidden_twin_stand')} (HIDDEN FIGURE H4) in it at 0-2% luma, ~24% of frame height: in the negative the doorway "
    "is pale and the figure is a glowing WHITE figure-shaped hole. Everything is perfectly still.")
cam("Almost still handheld (+-2 px); one autofocus breath at +4.0 s.")
vhs(EP + " The OSD stays positive (white) and reads 'NEG'.")
au(SFX("amb_sub_breath", 0.0, "-30 dBFS."),
   VO("vo_whisper_rev", 1.5, "-20 dBFS; first half hard LEFT, second half hard RIGHT, each with a 22 ms Haas double on "
      "the opposite side at -8 dB."))
note("No sting. The viewer finds both things on their own.")

sh("7e", 3.0, "NEG off")
pic(f"Positive again: {R('turnaround_night')}, same 1.25x crop: the chair EMPTY with its blanket; door_a pure black and "
    "empty. 'NEG' gone from the OSD.")
cam("Handheld; a small startled jolt at +0.0 s (4 px).")
vhs(EP)
au(SFX("sfx_neg_click", 0.0, "-20 dBFS."),
   VO("vo_crew_3", 1.2, "-11 dBFS."))

sh("7f", 7.0, "The memo")
pic(f"{R('memo_setb')} as camcorder footage of a paper taped to a flat: whole memo at 1.03x until +3.0 s, then a drift "
    "down and push to 1.20x on items 3-4 and the ballpoint note by +5.0 s, held.")
cam("Handheld drift; autofocus breathing.")
vhs(EP)
au("amb_studio_night continues at -40 dBFS. No voice: reading time.")

sh("7g", 0.8, "Tracking: back to the show")
pic("Vertical roll with a 25 px black bar and a rainbow hue sweep; SUBLIMINAL S3 at +0.4 s: 1 frame of compositor text "
    "'YES MEANS NO' MIRRORED (white on black, DejaVu Sans Mono Bold 56, centred).")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-16 dBFS."))
