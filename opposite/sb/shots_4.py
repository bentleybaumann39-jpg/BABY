# Shot list part 4: segments 11-12 (scare 3 and the ending).

# ===== 11 =====
seg("11", "SEE YOU YESTERDAY",
    "The tape tries to correct itself and the corrections cancel out. The set stands empty, both clocks running opposite "
    "ways. MIB says goodbye (which means hello) and reassures you: 'BIM isn't with you. He isn't right behind you.' The "
    "camera drifts to the dead TV on Set B (the mirror side); it reflects a living room, and on the couch a small figure kneels with "
    "its back to the screen. Scare 3.", "Act 3")

sh("11a", 5.5, "Correction")
pic(f"{R('card_correction_1')} full frame.")
cam("Static.")
vhs("V2.")
au("Hiss returns at +0.0 s.",
   SFX("amb_room_tone", 0.0, "-42 dBFS. No voice."))

sh("11b", 5.5, "The previous correction")
pic(f"{R('card_correction_2')} full frame.")
cam("Static.")
vhs("V2; one dropout cluster at +3.0 s.")
au(SFX("amb_drone", 0.0, "fades in from -46 to -34 dBFS over the shot and is CUT DEAD on the cut to 11c."))

sh("11c", 4.0, "The empty set")
pic(f"{R('turnaround_wide_late')}, bright and flat, NOBODY in it: both chairs, the blanket on Set B's, {R('toy_duck')} "
    f"on chest_b_lid, both doorways black. At +3.2 s MIB pops up at foot_bim ({R('mib_idle')}, mirrored, 6-frame "
    "squash). " + CLOCKS_SWAPPED)
cam("Static.")
vhs("V2; Set B's half at saturation 0.65.")
au(SFX("sfx_clock_rev", 0.0, "-30 dBFS."),
   SFX("sfx_pop", 3.2, "-18 dBFS."))

sh("11d", 6.0, "Goodbye, kids!")
pic(f"{R('turnaround_wide_late')}: MIB on the left waving ({R('mib_wave')} / {R('mib_idle')} at 6 fps, mirrored) with "
    "his mouth CLOSED the whole time while BIM's voice talks.")
cam("Static.")
vhs("V2.")
au(SFX("mus_theme_wrong", 0.0, "-14 dBFS; runs under 11d-11e and is CUT DEAD at the cut to 11f."),
   VO("vo_mib_bye", 0.3, "-11 dBFS, panned 30% RIGHT."),
   VO("vo_kids_goodbye", 5.0, "-14 dBFS, with the same stem REVERSED under it at -24 dBFS (compositor)."))

sh("11e", 5.5, "BIM isn't with you")
pic(f"{R('mib_close_smile')} / {R('mib_close_talk')} (mirrored), dead centre, eyes into the lens, over "
    f"{R('turnaround_wide_late')} blurred (6 px, x0.85). Lip-flap per the rule.")
cam("Imperceptible push 1.00 -> 1.04.")
vhs("V2.")
au(VO("vo_mib_notwith", 0.4, "-11 dBFS, centre, close."))
note("Decoded by rule 1: BIM IS with you. He IS right behind you. Nobody says it.")

sh("11f", 8.5, "The other TV")
pic(f"{R('crt_set_b')} (1280x960): the dark screen of Set B's CRT holds a reflection of {R('livingroom')} (mirrored, "
    "darkened to 6-15% luma, barrel-distorted into crt_screen_quad), with HIDDEN FIGURE H6: "
    f"{R('bim_couch_back')} kneeling on the LEFT cushion (couch_left_seat), back to the screen, ~6% luma, ~22% of the "
    f"screen height, perfectly still. {R('crt_glass')} over the screen. The reflection itself has NO VHS damage.")
cam("Slow push 1.00 -> 1.45 into the screen.")
vhs("V2 on the set and cabinet; none inside the screen.")
au(SFX("amb_room_tone", 0.0, "-42 dBFS."),
   SFX("amb_cluster", 0.0, "starts at -48 dBFS and swells to -36 dBFS by the end of 11g; CUT DEAD with the sub-bass at "
       "11h +0.2 s."))

sh("11g", 8.0, "Hold on the reflection")
pic(f"{R('crt_set_b')} with the {R('livingroom')} reflection, H6 {R('bim_couch_back')} unmoving, {R('crt_glass')}.")
cam("Push 1.45 -> 1.60, so the couch fills the lower half of the frame and the figure sits left of centre.")
vhs("As 11f.")
au(SFX("amb_sub_breath", 0.0, "-28 dBFS."),
   VO("vo_whisper_rev", 2.0, "-26 dBFS, hard LEFT only (the figure's side), no Haas double this time."))

sh("11h", 1.4, "The creak")
pic(f"As the end of 11g ({R('crt_set_b')}, {R('livingroom')}, {R('bim_couch_back')}, {R('crt_glass')}); nothing "
    "visibly moves.")
cam("Static at 1.60.")
vhs("As 11f.")
au(SFX("sfx_couch_creak", 0.2, "-13 dBFS, hard LEFT, dry: the ONE sound before scare 3; it pulls the eye to the figure "
       "on the left. amb_sub_breath and amb_cluster are cut dead at +0.2 s, so the creak is alone."))

sh("11i", 1.0, "SCARE 3: BIM, turned over")
pic(f"Frames 0-3: {R('bim_scare_turn')} (BIM's face upside down, sweet, 90% of the frame, centred); frames 4-5: "
    f"{R('bim_scare')} rotated 90 degrees (one stepped frame of the turn); frames 6-29: {R('bim_scare')} alternating with "
    f"{R('bim_scare_b')} every 4 frames, right way up, Thatchered. CLEAN.")
cam("Zoom 1.00 -> 1.06, shake +-6 px.")
vhs("V0 CLEAN.")
au(SFX("sfx_stinger_3", 0.0, "peak -1 dBFS, attack < 5 ms, the loudest sound on the tape; cut dead at the end of the shot (11j is digital silence)."))
scare("SCARE 3 (90% of frame, 1.0 s). Reveals that BIM is the one on the couch, on your side of the screen.")

sh("11j", 2.0, "Black: digital silence")
pic("Black.")
vhs("none.")
au("DIGITAL SILENCE #2: everything cut on the first frame.")

# ===== 12 =====
seg("12", "STAY ON YOUR SIDE",
    "The VCR rewinds by itself, and inside the rewind the reversed whisper finally plays forwards: 'Your turn to be the "
    "reflection.' PLAY comes back mirrored. The reverse angle: we are on Set B, MIB's mirror side, looking through the frame at the "
    "Chair For You, empty and bare; the blanket is on the chair we are sitting in, and MIB's card is readable. 'Bye!' "
    "'...I mean hello.' Two knocks on the glass. The tape stops. TODAY IS NOT OPPOSITE DAY.", "Act 3")

sh("12a", 2.2, "The tape rewinds itself")
pic("Rewind: the tape's own earlier frames (8a back to 3h) racing BACKWARDS at ~7x under 2-3 rolling noise bars; VCR "
    f"OSD '◀◀ REW' at the top-left, counter spinning down. SUBLIMINAL S5 at +1.0 s: 1 frame of {R('mib_scare')} in "
    "COLOUR NEGATIVE. Frame-to-frame mean luminance changes stay under 20% of full scale.")
vhs("V3 with rewind bars.")
au(SFX("sfx_rewind", 0.0, "-16 dBFS."),
   VO("vo_whisper_fwd", 0.1, "-8 dBFS, centre, close and clear: the forwards version of the whisper from 7d and 11g."))

sh("12b", 1.0, "PLAY, mirrored")
pic("VCR blue; the OSD reads 'PLAY ▶' MIRRORED ('◀ YALP' with every glyph flipped), at the top-LEFT, counter mirrored.")
vhs("V1.")
au("Hiss only.")

sh("12c", 8.5, "The reverse angle")
pic(f"{R('turnaround_reverse')}: through the gold frame, the Chair For You on Set A, bare, no blanket; on Set A's "
    f"board (board_a, seen from behind the frame) {R('card_rule1')} reads MIRRORED; in the near-left foreground, on OUR "
    f"side, Set B's board (board_b_near) shows {R('card_see_you')} perfectly READABLE. The blanket hangs on the chair "
    "back in the bottom-right foreground. Nobody is in the shot. The mirrored OSD 'YALP' stays at the top-left, its "
    "counter rolling DOWN from 0:04:59.")
cam("Locked off; a slow imperceptible push 1.00 -> 1.03.")
vhs("V2.")
au(SFX("amb_room_tone", 0.0, "-44 dBFS."),
   VO("vo_bim_bye", 2.5, "-10 dBFS, dry, centre-left, as if right beside you."),
   VO("vo_whisper_hello", 4.6, "-14 dBFS, dry, 20% left, close."))
note("PAYOFF of 4e: 'If you can read them, you're on the wrong side.' The viewer can read MIB's card.")

sh("12d", 2.2, "Two knocks; the tape stops")
pic(f"{R('turnaround_reverse')} held as 12c (card and boards as 12c: {R('card_see_you')}, {R('card_rule1')} "
    "mirrored); at +1.6 s the picture collapses: a downward smear and a tracking band over 0.5 s, then blue.")
vhs("V2 -> V4 over the collapse.")
au(SFX("sfx_knocks", 0.2, "-12 dBFS, dead centre, dry: on the glass, from our side."),
   SFX("sfx_vcr_stop", 1.6, "-14 dBFS; the compositor pitch-dives the whole mix to zero over +1.6 to +2.1 s."))

sh("12e", 3.0, "Stopped")
pic("VCR blue; the OSD reads 'STOP ■' MIRRORED ('■ POTS'), top-left.")
vhs("V1.")
au("DIGITAL SILENCE #3, from +0.0 s to the end of the tape.")

sh("12f", 3.5, "TODAY IS NOT OPPOSITE DAY")
pic(f"{R('end_card_blue')} with the mirrored '■ POTS' OSD still in its corner.")
vhs("V1.")
au("Digital silence.")
txt("In the art: TODAY IS NOT OPPOSITE DAY")
note("By rule 1 it is. It never ends.")
