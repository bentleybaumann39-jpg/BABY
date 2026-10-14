# Shot list part 3: segments 8-10 (the swap, scare 1, the paradox, scare 2).
SWAPPED = ("SWAPPED STAGING (from 8a to the end): BIM stands at foot_mib on the RIGHT and every bim_* frame is MIRRORED "
           "left/right by the compositor (his parting and heart patch now on screen-left); MIB stands at foot_bim on the "
           "LEFT and every mib_* frame is MIRRORED too (heart on screen-right). Only the mouths tell them apart.")
CLOCKS_SWAPPED = "CLOCKS (from 8a): Set A's clock now runs ANTICLOCKWISE and Set B's clockwise."

# ===== 8 =====
seg("8", "THE SWAP",
    "The show resumes as if nothing happened, except that the twins have traded sides and become each other's mirror "
    "image, the PLAY OSD pops up in the wrong corner, the voices come from the wrong speakers and the clocks have "
    "swapped direction. Rule 3: safe means not safe. BIM frowns for the first time, and MIB's smile turns out to be that "
    "frown upside down. MIB says 'You're safe' in BIM's voice while the lights go out one by one. Scare 1.", "Act 2")

sh("8a", 7.0, "Welcome back (the swap)")
pic(f"{R('turnaround_wide')}, bright, normal at a glance. {SWAPPED} BIM {R('bim_idle')} / {R('bim_talk')} (mirrored) "
    f"lip-flaps on his line; MIB {R('mib_idle')} / {R('mib_talk')} (mirrored). Now BIM copies MIB, 8 frames late: at "
    f"+4.0 s MIB goes to {R('mib_point')}, BIM to {R('bim_point')} (mirrored) 8 frames later. {R('toy_duck')} still on "
    "chest_b_lid. VCR OSD 'PLAY ▶' with the counter pops up for 3.0 s at the TOP-LEFT (it was top-right in 1b), as a VCR "
    "does after a tracking event. " + CLOCKS_SWAPPED)
cam("Static.")
vhs("V1 -> V2 (from here the show is a generation worse: sat 0.8, more dropouts).")
au(SFX("mus_show_bed", 0.0, "-26 dBFS, resampled x0.97 by the compositor (half a semitone flat), ducked under lines."),
   VO("vo_bim_welcome_low", 0.6, "-11 dBFS, panned 30% LEFT although BIM is on the right."))
note("THE BIG CHANGE NEAR THE FACES, with no sting and no comment. The earlier lags (3b-4g) make sense in retrospect.")

sh("8b", 6.0, "Safe means not safe")
pic(f"{R('turnaround_frame')}: {R('card_rule3')} on board_a (LEFT, MIB's side now) READABLE, and MIRRORED on board_b "
    f"(right, BIM's). BIM on the right, {R('bim_point')} / {R('bim_point_talk')} mirrored, pointing at his mirrored "
    f"board; MIB on the left, {R('mib_idle')} mirrored, still. Nobody comments on the boards.")
cam("Static.")
vhs("V2.")
au(VO("vo_bim_rule3_low", 0.4, "-11 dBFS, panned 30% LEFT."),
   SFX("sfx_laugh", 3.7, "-18 dBFS, runs ONE SECOND too long and is cut dead at the end of the shot."))

sh("8c", 2.5, "BIM frowns")
pic(f"{R('bim_close_frown')} (mirrored, to match his new side) over {R('turnaround_frame')} blurred (6 px, x0.9).")
cam("Push 1.00 -> 1.05.")
vhs("V2.")
au("mus_show_bed CUT DEAD at +0.0 s.",
   SFX("sfx_clock_rev", 0.0, "-30 dBFS, looped under 8c-8h ('tock-tick')."),
   VO("vo_bim_aww_low", 0.4, "-13 dBFS, centre."))

sh("8d", 2.0, "MIB smiles")
pic(f"{R('mib_close_smile')} (mirrored) over {R('turnaround_frame')} blurred: the identical curve, upside down. Dead "
    "still, eyes into the lens.")
cam("Static.")
vhs("V2.")
au("Reversed clock and room tone only.")
note("The viewer realises every MIB smile so far was a frown turned over.")

sh("8e", 2.0, "You're safe (1)")
pic(f"{R('turnaround_frame')} cross-faded 25% toward {R('turnaround_frame_dim')} (one light off); MIB alone at the "
    f"frame on the LEFT ({R('mib_idle')} / {R('mib_talk')}, mirrored), mouth flapping to BIM's voice. BIM is not in "
    "the shot.")
cam("Static.")
vhs("V2.")
au(SFX("sfx_light_step", 0.0, "-20 dBFS (the light going off on the cut)."),
   SFX("sfx_preverb_safe", 0.1, "-22 dBFS, swelling INTO the word."),
   VO("vo_safe_1", 0.9, "-12 dBFS, centre."))

sh("8f", 2.0, "You're safe (2)")
pic(f"As 8e at 50% {R('turnaround_frame_dim')}; MIB ({R('mib_idle')} / {R('mib_talk')}) 4% bigger (moved between "
    f"cuts). {R('turnaround_frame')} underneath.")
cam("Static.")
vhs("V2.")
au(SFX("sfx_light_step", 0.0, "-20 dBFS."),
   SFX("sfx_preverb_safe", 0.1, "-21 dBFS."),
   VO("vo_safe_2", 0.9, "-12 dBFS."))

sh("8g", 2.0, "You're so safe (3)")
pic(f"As 8e at 75% {R('turnaround_frame_dim')} over {R('turnaround_frame')}; MIB ({R('mib_idle')} / "
    f"{R('mib_talk')}) 8% bigger; only his eyes and the frame still catch the spot.")
cam("Static.")
vhs("V2.")
au(SFX("sfx_light_step", 0.0, "-20 dBFS."),
   SFX("sfx_preverb_safe", 0.0, "-20 dBFS."),
   VO("vo_safe_3", 0.8, "-12 dBFS."))

sh("8h", 1.3, "Fourth beat (cut 0.7 s early)")
pic(f"100% {R('turnaround_frame_dim')}: the frame glowing in its pool of light; MIB ({R('mib_idle')}, mirrored) a dim "
    "shape beside it, 12% bigger, perfectly still. No light step this time: the room is already as dark as it goes.")
cam("Static.")
vhs("V2.")
au(SFX("sfx_preverb_safe", 0.5, "-18 dBFS: the swell of a fourth 'You're safe' begins and is CUT DEAD by the hit at "
       "+1.3 s, before the word. The ONE sound before scare 1."),
   "sfx_clock_rev is cut dead at +0.5 s, so the swell is alone.")
note("RHYTHM: 8e-8g set a 2.0 s cut rhythm; 8h breaks it 0.7 s early.")

sh("8i", 0.7, "SCARE 1: Mr. Turnabout, right way up")
pic(f"{R('turnabout_scare')} alternating with {R('turnabout_scare_b')} every 4 frames, scaled so the face fills ~60% of "
    "the frame height, centred. CLEAN.")
cam("Push 1.00 -> 1.04, shake +-3 px.")
vhs("V0 CLEAN.")
au(SFX("sfx_stinger_1", 0.0, "peak -1 dBFS, attack < 5 ms; cut dead at the end of the shot (8j is digital silence)."))
scare("SCARE 1 (60% of frame, 0.7 s). Reveals that the happy painting was only happy upside down.")

sh("8j", 1.5, "Black: digital silence")
pic("Black.")
vhs("none.")
au("DIGITAL SILENCE #1: everything, hiss and hum included, cut on the first frame; hiss creeps back only at 9a.")

# ===== 9 =====
seg("9", "HOW TO END OPPOSITE DAY",
    "Bright and cheerful again. MIB hosts alone: 'BIM is right here!' (he is not: rule 1). The blanket has moved to a "
    "second chair on MIB's side. Rule 4: to stop Opposite Day, say 'It's NOT Opposite Day!' The kids chant it three "
    "times. 'Good! And on Opposite Day... that means...' The palindrome jingle plays forwards, then backwards, and it is "
    "the same.", "Act 3")

sh("9a", 6.0, "BIM is right here")
pic(f"{R('turnaround_wide_late')}, flat bright light: MIB alone at foot_bim on the LEFT beside the bare Chair For You "
    f"({R('mib_idle')} / {R('mib_talk')}, mirrored), lip-flapping to BIM's voice; the right side is EMPTY except the "
    "new second chair with the blanket on it (chair_b). " + CLOCKS_SWAPPED)
cam("Static.")
vhs("V2; Set B's half at saturation 0.65.")
au("Hiss returns at +0.0 s.",
   SFX("mus_show_bed", 0.0, "-26 dBFS, resampled x0.94 by the compositor."),
   VO("vo_mib_here", 0.5, "-11 dBFS, panned 30% RIGHT (from the empty side)."),
   SFX("sfx_laugh_rev", 2.9, "-20 dBFS: the laugh track runs backwards, long sucking inhales."))
note("Decoded by rule 1: BIM is NOT here.")

sh("9b", 6.0, "Rule 4")
pic(f"{R('turnaround_frame')}: {R('card_rule4')} on board_a (left) READABLE; board_b blank; MIB on the left "
    f"({R('mib_idle')} / {R('mib_talk')}, mirrored); nobody on the right.")
cam("Static.")
vhs("V2.")
au(VO("vo_mib_rule4", 0.4, "-11 dBFS, panned 30% RIGHT."))

sh("9c", 6.5, "The chant")
pic(f"{R('turnaround_frame')} with MIB ({R('mib_idle')} / {R('mib_talk')}, mirrored) mouthing along with the kids, his "
    "mouth flapping 4 frames EARLY (ahead of the audio).")
cam("Slow push 1.00 -> 1.25 on MIB.")
vhs("V2.")
au(VO("vo_kids_chant", 0.3, "-11 dBFS; the bed ducks 10 dB."))

sh("9d", 5.5, "...that means...")
pic(f"{R('mib_close_smile')} / {R('mib_close_talk')} (mirrored) over {R('turnaround_frame')} blurred. After the line "
    "MIB's mouth keeps flapping for 0.5 s with no sound, then he is completely still, staring into the lens, to the end.")
cam("Static.")
vhs("V2.")
au("mus_show_bed CUT DEAD at +0.0 s.",
   VO("vo_mib_means", 0.4, "-11 dBFS, centre."))
note("PARADOX LOCK: the viewer was taught to end the game in a way that keeps it going. The missing word is 'it IS'.")

sh("9e", 4.0, "The palindrome")
pic(f"{R('bumper_bg')} with {R('twoway_logo')} centred: the arrows chase clockwise for 2.0 s, then the whole logo "
    "spins anticlockwise (reversed) for 2.0 s.")
cam("Static.")
vhs("V2.")
au(SFX("mus_ident_palindrome", 0.0, "-10 dBFS: the compositor plays its first 2.0 s forwards and then the same 2.0 s "
       "REVERSED from +2.0 s; the melody is identical both ways."))

sh("9f", 0.7, "Tracking: recorded over")
pic(f"Vertical roll and rainbow sweep; SUBLIMINAL S4 at +0.3 s: 2 frames of {R('livingroom')} (mirrored, normal "
    f"brightness) with {R('bim_couch_back')} kneeling on the left cushion, facing away.")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-16 dBFS."))

# ===== 10 =====
seg("10", "RECORDED OVER: BEHIND B",
    "The camcorder again, three nights later, walking behind Set B: the footage drifts backwards while the reversed "
    "footsteps go forward under a sinking Shepard tone. Behind B there is another Turnaround Room, mirrored and dark, with "
    "two chairs. The strike list. Then the gold frame, which tonight holds a mirror, and in it the one holding the "
    "camera is MIB. Scare 2.", "Act 3")

sh("10a", 0.6, "Camcorder starts")
pic("Black; OSD appears at +0.2 s; fade up from +0.3 s.")
vhs(EP + " OSD date 'MAR 22 1994', clock '11:58 PM'.")
au(SFX("sfx_cam_beep", 0.1, "-18 dBFS."))

sh("10b", 7.0, "Behind B")
pic(f"{R('behind_set')}.")
cam("The camera WALKS forward (bob +-4 px at 1.8 Hz) but the image DRIFTS BACKWARD: zoom 1.18 -> 1.00 over the shot, as "
    "if the footage were running in reverse.")
vhs(EP)
au(SFX("sfx_steps_rev", 0.0, "-22 dBFS (reversed footsteps)."),
   SFX("amb_shepard_down", 0.0, "starts -40 dBFS, climbs +12 dB, runs to the hit and is CUT DEAD at 10f's end."),
   VO("vo_crew_4", 1.0, "-13 dBFS."))

sh("10c", 5.5, "Another one")
pic(f"{R('mirror_studio')} scaled to fill. HIDDEN FIGURE H5: {R('hidden_twin_stand')} standing just left of the far "
    "gold frame (h5_foot), ~14% of frame height, 5% above the dark. " + HIDDEN_NOTE)
cam("Handheld; autofocus hunts once (3 -> 0 px); a slow drift toward the far frame.")
vhs(EP)
au(VO("vo_crew_5", 1.8, "-13 dBFS."))

sh("10d", 5.5, "The strike list")
pic(f"{R('memo_cutlist')} as camcorder footage: whole list at 1.03x, then a push to 1.25x on 'CHILD CHAIR' and the "
    "pencil line by +3.5 s, held.")
cam("Handheld drift; autofocus breathing.")
vhs(EP)
au("amb_shepard_down continues.")

sh("10e", 5.0, "The frame has a mirror tonight")
pic(f"{R('frame_mirror_night')}. In the mirror quad, reflected (darkened 20%, green-grey tint, 1 px blur): "
    f"{R('mib_camcorder')} at refl_figure_foot, ~28% of frame height, holding a camcorder whose lamp glows; the "
    "reflected ghost light at frame right pulls the eye there.")
cam("Handheld; AUTOFOCUS HUNTS on the reflection for 4 s (blur 6 -> 0 -> 4 -> 1 -> 3 px, irregular).")
vhs(EP)
au(SFX("sfx_breath_rev", 0.0, "-24 dBFS, dry, 20% LEFT (the operator's breath, reversed)."))

sh("10f", 4.1, "It is MIB filming")
pic(f"{R('frame_mirror_night')}: focus settles at +0.8 s. {R('mib_camcorder')} in the mirror is now ~40% of frame height "
    "(closer between cuts: he walks FORWARD while the operator stands still), felt, too still, his lamp aimed at us. The "
    "last 3 frames are a tracking glitch.")
cam("Handheld, nearly still; the operator does not move.")
vhs(EP + " V4 for the last 3 frames.")
au(SFX("sfx_inhale_rev", 2.8, "-14 dBFS, 20% LEFT: one reversed inhale swelling and CUT DEAD at +4.1 s. The ONE sound "
       "before scare 2."),
   "sfx_breath_rev and amb_shepard_down are CUT DEAD at +2.8 s, so the inhale is alone.")

sh("10g", 0.8, "SCARE 2: MIB at the lens")
pic(f"{R('mib_scare')} alternating with {R('mib_scare_b')} every 4 frames, ~75% of the frame, centred. Keep the REC OSD "
    "on top, degraded like 10a-10f, but the image itself is CLEAN.")
cam("Zoom 1.00 -> 1.05, shake +-5 px.")
vhs("V0 CLEAN under the OSD.")
au(SFX("sfx_stinger_2", 0.0, "peak -1 dBFS, attack < 5 ms; its tail runs into the 10h static."),
   SFX("sfx_scream_rev", 0.0, "-6 dBFS under the stinger; it swells and cuts off at the end of the shot."))
scare("SCARE 2 (75% of frame, 0.8 s). Reveals that whoever was filming the empty set was MIB.")

sh("10h", 1.7, "Static, then black")
pic("0.3 s of static, then black.")
vhs("V4 -> none.")
au(SFX("sfx_static_burst", 0.0, "-14 dBFS, trimmed to 0.3 s, no fade."),
   "Then NEAR-silence: camcorder hiss only at -60 dBFS (not digital zero).")
