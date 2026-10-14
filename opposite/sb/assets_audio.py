# Audio stems (opposite/make_audio.py, adapted from poppy/make_audio.py). 44.1 kHz mono 16-bit.
# Every file is normalised by the builder (voice -3 dBFS, the rest -1 dBFS); shot cues give mix peaks.

TWIN_RAW = ("ONE shared twin voice: espeak-ng -v en-us+m3 -s 170 -g 2, -p varied 60-85 between phrases (sing-song), "
            "rendered once per line ('raw'). ")
VOICE_SPECS.update([
    ("bim", ("BIM", "bright, bouncy kids'-show host, a little too eager",
             TWIN_RAW + "BIM = raw pitched UP 4 semitones with the granular shifter (duration kept); band-pass 250-4000 Hz "
             "(TV speaker); tanh(1.5x); room reverb 0.3 s at 10% wet; -3 dBFS. Compositor pans it 30% LEFT while BIM "
             "stands on the left.")),
    ("bim_low", ("BIM (with MIB's voice)", "the same bright delivery, but in MIB's lower voice",
                 TWIN_RAW + "raw pitched DOWN 4 semitones (the same interval the other way: this is MIB's voice, which "
                 "MIB never used), same band-pass, tanh and reverb; -3 dBFS. Used only by BIM after the swap. Compositor "
                 "pans it 30% LEFT although BIM now stands on the RIGHT (the voices crossed).")),
    ("mib_as_bim", ("MIB (with BIM's voice)", "BIM's exact bright host voice coming out of MIB's mouth",
                    "Identical recipe to 'bim' (same pitch-up, EQ, reverb), a different render per line. Compositor pans "
                    "it 30% RIGHT although MIB now stands on the LEFT.")),
    ("mib_flat", ("MIB (with BIM's voice, flat)", "BIM's voice gone flat, slow and much too close",
                  TWIN_RAW.replace("-s 170", "-s 135").replace("-p varied 60-85 between phrases (sing-song)",
                                                               "-p 55 fixed, no melody") +
                  "pitched UP 4 semitones like 'bim'; band-pass 200-5000 Hz; reverb 3% wet; +4 dB proximity bump at "
                  "150-250 Hz; 45 Hz amplitude modulation at 20% depth (roughness); -3 dBFS. Panned dead centre.")),
    ("kids", ("THE TURNAROUND KIDS (laugh-track children)", "a studio audience of excited children shouting together",
              "8 espeak-ng renders of the line with different voices (en-us+f1..f5, +m1, +m3, +klatt) at -p 80-99 and "
              "-s 150-190, each pitched up 2-5 semitones, randomly offset 0-70 ms and panned across the stereo field by "
              "the builder's mono sum (keep it mono), summed, band-passed 250-5000 Hz, room reverb 0.6 s at 25% wet "
              "(a studio bleacher); -3 dBFS.")),
    ("narrator", ("NARRATOR", "Two-Way Kids announcer: warm, calm, corporate",
                  "espeak-ng -v en-us+m3 -s 160 -p 40 -g 4; band-pass 180-3600 Hz; tanh(2.0x); slight low-shelf warmth; "
                  "-3 dBFS.")),
    ("crew", ("STAGE MANAGER (camcorder operator)", "nervous whisper close to a cheap camcorder mic",
              "espeak-ng -v en-us+whisperf -s 155 -p 40; band-pass 300-3400 Hz (camcorder mic); -6 dBFS.")),
    ("whisper", ("WHISPER", "a child-sized whisper right at the microphone",
                 "espeak-ng -v en-us+whisperf -s 120 -p 55; dry, high-passed at 300 Hz, attack under 5 ms; -1 dBFS.")),
    ("child_rev", ("ONE CHILD (reversed)", "a single laugh-track child, played backwards",
                   "espeak-ng -v en-us+f4 -s 160 -p 95, pitched up 3 semitones, band-pass 250-5000 Hz, the same bleacher "
                   "reverb as 'kids'; then REVERSED with a reverse-reverb swell so it sucks inward and stops dead; -3 dBFS.")),
    ("sung", ("BIM (sung)", "robotic sing-song vocal inside the theme",
              "'bim' preset, one espeak render per syllable with -p chosen to follow the melody note, placed on the beat.")),
])

# --- music ---
aud("mus_ident_palindrome", "music",
    "Two-Way Kids ident jingle, 4.0 s: toy piano + glockenspiel play the PALINDROME motif C5 E5 G5 A5 G5 E5 C5 (seven "
    "notes, 0.32 s apart, symmetric dynamics p-mf-f-ff-f-mf-p) over a soft major pad, then the C major chord rings out. "
    "Melody and rhythm read the same forwards and backwards; in 9e the compositor plays it forwards then reversed, and the "
    "tune is identical. Clean. Peak -1 dBFS.", seconds=4.0)
aud("mus_theme", "music",
    "OPPOSITE DAY! theme song, full mix with vocals, exactly 22.0 s. Original tune in C major built on the palindrome "
    "C-E-G-A-G-E-C (every 2-bar phrase is a palindrome), toy piano (sine + partials x2, x3, 0.3-0.6 s decays), bass, "
    "handclaps, glockenspiel counter-line, 160 bpm (1 bar = 1.5 s). Structure: 2.0 s intro; six sung lines at 2.0, 5.0, "
    "8.0, 11.0, 14.0, 17.0 s ('sung' voice); outro 20.0-22.0 s with the spoken 'Hi, kids!' ('bim' preset) at 20.3 s and a "
    "button ending. The ONLY wrongness: the fifth line is SUNG as 'Come and sit on the other side,' while the on-screen "
    "caption reads 'Come and sit here by my side,' (keep both in the manifest). Write 'lyrics': [[start, caption text], "
    "...] into build/audio/manifest.json. Peak -1 dBFS.",
    text="Turn around and turn around, / up is down and down is up! / Yes is no and no is yes, / BIM and MIB, who's who? "
         "Guess! / (sung) Come and sit on the other side, [caption: Come and sit here by my side,] / Opposite Day is "
         "here for you! / (spoken) Hi, kids!",
    voice="sung", seconds=22.0)
aud("mus_bumper", "music",
    "Rule bumper sting, 1.5 s: a glockenspiel arpeggio C-E-G-E-C (a palindrome again), a slide whistle up then down, a "
    "'ta-da' chord. Clean. Peak -1 dBFS.", seconds=1.5)
aud("mus_show_bed", "music",
    "Background bed for the show, 30.0 s seamless loop: toy piano and glockenspiel noodling on the palindrome motif in C "
    "major, soft bass, 100 bpm, +-12 cent detune. Loops without a click. Peak -6 dBFS (mixed about -24 dBFS under "
    "dialogue).", seconds=30.0)
aud("mus_theme_wrong", "music",
    "Goodbye reprise, 14.0 s: the theme melody (instrumental) on a music box (sine + inharmonic partials x2.76, x5.40, "
    "mechanism clicks) slowed to 80%, pulled 70 cents flat, doubled 50 cents off so it beats, noise-driven wow 1.5%, the "
    "last phrase ending on a tritone (F#) that never resolves, then the mechanism keeps clicking with no notes to the end. "
    "Peak -6 dBFS.", seconds=14.0)

# --- ambience ---
aud("amb_room_tone", "ambience", "Studio room tone, 20 s loop: brown noise low-passed at 500 Hz, faint HVAC. Mixed at "
    "-42 dBFS RMS.", seconds=20.0)
aud("amb_studio_night", "ambience", "The empty studio at night, 20 s loop: HVAC rumble, the ghost light's faint 120 Hz "
    "filament buzz, a distant tick of cooling lamps. Mixed -38 dBFS.", seconds=20.0)
aud("amb_drone", "ambience", "Dread drone, 20 s: two sines at 41 and 42 Hz (1 Hz beating) plus a quiet 83 Hz partial. "
    "Mixed -34 to -28 dBFS, always cut dead.", seconds=20.0)
aud("amb_cluster", "ambience", "Tone cluster, 20 s: five sines a semitone apart around 330-440 Hz, each with its own "
    "0.1-0.3 Hz vibrato (micropolyphony), slowly swelling over the whole file. Cut dead.", seconds=20.0)
aud("amb_sub_breath", "ambience", "Sub-bass breathing, 20 s loop: 30-45 Hz rumble amplitude-modulated at 0.3 Hz like slow "
    "breathing. Mixed -30 to -24 dBFS under long holds.", seconds=20.0)
aud("amb_shepard_down", "ambience",
    "DESCENDING Shepard tone, 16.0 s (a riser turned upside down, sinking forever): 8 octave-spaced sines from 55 Hz under a "
    "sin^2 loudness window, falling 0.10 octave/s, +-6 cent drift. Starts at -40 dBFS and climbs +12 dB over the file. "
    "Always cut dead (no fade, zero crossing).", seconds=16.0)

# --- sfx ---
aud("sfx_vcr_insert", "sfx", "Cassette pushed in: mechanism clunk and motor whirr, 1.2 s.", seconds=1.2)
aud("sfx_bars_tone_rev", "sfx",
    "The colour-bars tone played BACKWARDS, 4.2 s: a 1 kHz sine that fades IN from silence over 3.9 s along a reversed "
    "release curve, then stops dead on the last sample (no tail). Not a broadcast alert tone; just a test tone run "
    "backwards.", seconds=4.2)
aud("sfx_static_burst", "sfx", "Static burst, 1.5 s: white noise through a 300-6000 Hz band with crackle. Trimmed by the "
    "compositor.", seconds=1.5)
aud("sfx_tracking_garble", "sfx", "Tracking garble, 0.6 s: warbling pitch-smeared noise with a 0.1 s pop at the start.",
    seconds=0.6)
aud("sfx_boing", "sfx", "Cartoon boing (felt spring), 0.5 s, for the logo snapping the right way round.", seconds=0.5)
aud("sfx_pop", "sfx", "Soft felt 'pop' with a tiny slide-whistle blip, 0.3 s, for the twins popping into frame.",
    seconds=0.3)
aud("sfx_laugh", "sfx", "Laugh track, 3.0 s: a bleacher of children giggling and laughing (built from 'kids' preset "
    "'ha ha ha' and 'hee hee' renders, 10-12 voices, staggered), swelling then settling.", seconds=3.0)
aud("sfx_laugh_rev", "sfx", "sfx_laugh reversed, 3.0 s: the giggles become long sucking inhales that end abruptly. "
    "Re-render whenever sfx_laugh changes.", seconds=3.0)
aud("sfx_kids_yay", "sfx", "Children cheering 'Yaaay!' with claps, 2.0 s ('kids' preset).", seconds=2.0)
aud("sfx_clock_rev", "sfx", "Reversed wall clock, 10.0 s seamless loop: one tick per second, each tick reversed so it "
    "swells into a click ('tock-tick').", seconds=10.0)
aud("sfx_steps_rev", "sfx", "Reversed felt-puppet footsteps, 6.0 s: soft padded thumps at 1.6 per second, each REVERSED "
    "(a swelling attack that stops dead), plus faint reversed squeaks.", seconds=6.0)
aud("sfx_ratchet", "sfx", "The portrait turning one step on its nail: a dry wooden creak and a click, 0.8 s.",
    seconds=0.8)
aud("sfx_cam_beep", "sfx", "Camcorder record-start beep and tape-transport whirr, 0.4 s.", seconds=0.4)
aud("sfx_neg_click", "sfx", "Camcorder effect-button click and a tiny relay tick, 0.3 s (NEG on / NEG off).",
    seconds=0.3)
aud("sfx_light_step", "sfx", "A big studio light switched off: a heavy contactor clunk, a filament tick, the lamp's hum "
    "dying away, 1.2 s.", seconds=1.2)
aud("sfx_preverb_safe", "sfx",
    "Reverse-reverb pre-echo of 'You're safe', 0.8 s: take the first 0.6 s of vo_safe_1, reverse it, put a 2.5 s reverb "
    "on it (100% wet), reverse again and keep the 0.8 s swell that leads INTO the word; the file ends where the word "
    "would start. Re-render whenever vo_safe_1 changes.", seconds=0.8)
aud("sfx_stinger_1", "sfx",
    "Scare 1 stinger, 1.0 s: attack under 5 ms; a 0.3 s noise burst, a 45 Hz decaying thump, a dry felt-thump transient "
    "and 3 detuned saws 800-2500 Hz gliding down with 10 Hz vibrato, a 90 ms slap delay, 50 Hz roughness AM at 40%, tanh. "
    "The smallest of the three.", seconds=1.0)
aud("sfx_stinger_2", "sfx",
    "Scare 2 stinger, 1.0 s: as stinger 1 but 4 saws, a pitch jump up a minor ninth at 0.25 s, 60 Hz roughness AM at 50%, "
    "an octave-down subharmonic at -10 dB, denser.", seconds=1.0)
aud("sfx_scream_rev", "sfx",
    "Reversed scream, 0.8 s: the brief's synthetic scream (espeak 'aaa' -p 99 ring-modulated at 55 Hz, formant noise at "
    "800/1200/2500 Hz with 7 Hz vibrato, a x0.5 growl copy) REVERSED, so it swells and cuts off dead at the end. Layered "
    "under sfx_stinger_2 from the hit.", seconds=0.8)
aud("sfx_stinger_3", "sfx",
    "Scare 3 stinger, 1.4 s, the loudest and densest: 5 saws 700-3000 Hz with abrupt pitch jumps, a 40 Hz thump, a "
    "reversed-cymbal layer underneath the attack (not before it), 65 Hz roughness AM at 60%, subharmonic at -8 dB, tanh. "
    "Attack under 5 ms.", seconds=1.4)
aud("sfx_breath_rev", "sfx",
    "The operator's breathing played REVERSED, 6.0 s: close-mic, dry, inhale-swells that end abruptly, a cycle every 3 s, "
    "mouth clicks, +5 dB at 150-250 Hz.", seconds=6.0)
aud("sfx_inhale_rev", "sfx",
    "A single reversed inhale, 1.3 s: swells from nothing to a rough peak and stops dead on the last sample. The one "
    "sound before scare 2.", seconds=1.3)
aud("sfx_couch_creak", "sfx", "A couch spring and cushion creaking under a small weight, dry and close, 0.9 s. The one "
    "sound before scare 3.", seconds=0.9)
aud("sfx_rewind", "sfx", "VCR rewinding by itself, 2.2 s: the motor whine rising in pitch, tape hiss, a soft clunk at the "
    "end, and PLAY engaging.", seconds=2.2)
aud("sfx_knocks", "sfx", "Two soft knocks on glass, a knuckle on a TV screen, 0.6 s apart, close-miked and dry, 1.6 s.",
    seconds=1.6)
aud("sfx_vcr_stop", "sfx", "VCR stop mechanism clunk, 0.6 s (the compositor does the pitch dive on the mix).",
    seconds=0.6)

# --- voice ---
vo("vo_narr_ident", "narrator", "Two-Way Kids Home Video presents...", 2.6)
vo("vo_bim_hi", "bim", "Hi, kids! I'm BIM!", 1.8)
vo("vo_bim_twin", "bim", "And this is my twin brother, MIB! He does everything just like me!", 4.2)
vo("vo_bim_spot", "bim", "And this is your spot, right here on my side!", 3.0)
vo("vo_bim_rule1", "bim", "Rule number one! On Opposite Day, yes means no!", 3.2)
vo("vo_bim_wrongside", "bim", "Hee hee! MIB's cards are backwards. If you can read them, you're on the wrong side!", 4.6,
   "Giggly; a tiny pause before 'wrong side'.")
vo("vo_bim_sky", "bim", "Is the sky green?", 1.3)
vo("vo_bim_icecream", "bim", "Is ice cream yucky?", 1.4)
vo("vo_bim_everybody", "bim", "Is everybody here?", 1.4)
vo("vo_bim_great", "bim", "Great job, kids!", 1.3, "Bright, as if nothing was heard.")
vo("vo_kids_yes", "kids", "YES!", 0.8)
vo("vo_kids_no", "kids", "NO!", 0.8)
vo("vo_child_no_rev", "child_rev", "NO!", 0.9,
   "Played one beat after the chorus, panned 70% RIGHT (from MIB's side). One voice too many.")
vo("vo_bim_rule2", "bim", "Rule number two! Forward is backward! Let's do the Backwards Walk!", 3.8)
vo("vo_bim_walk_rev", "bim", "Walk happily!", 1.2,
   "Rendered forwards, then REVERSED: plays as gibberish ('!yllippah klaw'); the compositor subtitles it 'WALK HAPPILY!'.")
vo("vo_bim_goodbye", "bim", "And goodbye means hello! Goodbye, kids!", 2.8)
vo("vo_kids_goodbye", "kids", "GOODBYE!", 1.0)
vo("vo_bim_turnabout", "bim", "This is Mister Turnabout! He's upside down today.", 3.0)
vo("vo_bim_happy", "bim", "Is he happy, kids?", 1.3)
vo("vo_bim_turn", "bim", "Let's turn him right side up!", 1.8)
vo("vo_crew_1", "crew", "Eleven forty. Set B. They said leave it dark.", 3.4)
vo("vo_crew_2", "crew", "The camera does negative. Watch.", 2.2)
vo("vo_crew_3", "crew", "Hello?", 0.8, "Called out a little louder, into the dark.")
vo("vo_whisper_rev", "whisper", "Your turn to be the reflection.", 2.4,
   "Rendered forwards then REVERSED with a reverse-reverb pre-echo swelling 0.6 s ahead of it: unintelligible until 12a, "
   "where vo_whisper_fwd plays the same take forwards. The compositor pans it hard LEFT then hard RIGHT (one half each) "
   "with a 22 ms Haas double on the opposite side at -8 dB.")
vo("vo_bim_welcome_low", "bim_low", "Welcome back, kids! Did you miss us?", 2.6)
vo("vo_bim_rule3_low", "bim_low", "Rule number three! Safe means not safe! Hee hee!", 3.2)
vo("vo_bim_aww_low", "bim_low", "Aww.", 0.8, "Flat and sad, the only time the voice is not cheerful.")
vo("vo_safe_1", "mib_flat", "You're safe.", 1.1)
vo("vo_safe_2", "mib_flat", "You're safe.", 1.1, "A different take: a little lower and closer than vo_safe_1.")
vo("vo_safe_3", "mib_flat", "You're so safe.", 1.2, "Slowest and closest of the three.")
vo("vo_mib_here", "mib_as_bim", "Hi, kids! BIM is right here!", 2.0)
vo("vo_mib_rule4", "mib_as_bim", "Rule number four! To stop Opposite Day, just say: It's NOT Opposite Day! Ready?", 5.0)
vo("vo_kids_chant", "kids", "It's NOT Opposite Day! It's NOT Opposite Day! It's NOT Opposite Day!", 6.0,
   "Three chants starting at 0.0, 2.0 and 4.0 s (write 'phrases' into manifest.json), each 2 dB louder; in the third "
   "chant ONE extra child voice is reversed (the same line backwards, mixed at -6 dB).")
vo("vo_mib_means", "mib_as_bim", "Good! And on Opposite Day... that means...", 3.2,
   "Slows down on 'that means'; the line simply stops there.")
vo("vo_crew_4", "crew", "Okay. Behind B.", 1.3)
vo("vo_crew_5", "crew", "There's another one. Why is there another one?", 2.8)
vo("vo_mib_bye", "mib_as_bim", "That's all for Opposite Day! Remember, goodbye means hello. Goodbye, kids!", 4.6)
vo("vo_mib_notwith", "mib_flat", "Don't worry. BIM isn't with you. He isn't right behind you.", 4.4,
   "Leave a 0.5 s gap between the sentences; the last one slower.")
vo("vo_whisper_fwd", "whisper", "Your turn to be the reflection.", 2.0,
   "The SAME take as vo_whisper_rev played forwards (no reverse reverb), clear and close; heard inside the self-rewind.")
vo("vo_bim_bye", "bim", "Bye!", 0.7, "Bright and cheerful, completely dry (no reverb), as if right beside you.")
vo("vo_whisper_hello", "whisper", "I mean hello.", 1.2)
