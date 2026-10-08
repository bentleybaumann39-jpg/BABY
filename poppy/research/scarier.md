# Making THE WORLD OF POPPY scarier: craft rules

Extends `brief.md`. Core idea: **keep the felt cartoon cute, and make one thing in it too real, too still, too dark or in the wrong place.** Hard limits still apply: original characters, no blood, gore, wounds or self-harm, no harm to children, no flashing over 3 per second, no saturated-red full-frame flicker.

## 1. Drawing faces and creatures

**Light and darkness**
- **Underlight scare frames.** Key light 30-60° below the face; forehead 50-70% darker than the chin; nose and brows cast shadows upward. The visual system assumes light from above, so this reads as wrong.
- **Value budget.** 55-70% of scare-frame pixels at or below 8% luma (before the VHS black lift), only 5-15% above 60%. Light the eyes, teeth and one cheek; leave the far eye socket, body and hands dark.
- **Lost edges.** One side of the head dissolves into black; the silhouette never closes.
- **Hard or soft.** A hard terminator (under 3 px) for panic frames; soft gradients for dread.
- **Hatch the shadows (Ito).** 200-600 strokes 1 px wide at 2-3 angles instead of a flat fill, re-seeded at 6-8 fps so the dark "boils".
- **Edge light only in dark rooms (Skinamarink).** 1-2 px rims on objects; the rest sinks.

**Realism in the wrong place (the "gross-up")**
- **One realistic patch per frame**, 3-10% of the face. Everything else stays flat felt: the contrast is the effect.
- **Wet eye.** Iris of 40-60 radial fibres with a dark limbal ring (8-12% of iris radius); a sharp window specular plus a shiny 1-2 px lower-lid waterline; pink inner corner; 10-20 irregular single lashes.
- **Veins in the eye whites, not blood.** 4-8 branching 1 px capillaries, grey-pink `#C9A3A0` at 30-50% opacity, from the corners toward the iris. Never red pools.
- **Real teeth.** Ivory `#E8DFC8`, not paper white; central incisors about 1.6x the laterals; grey gaps and bluish translucent edges; an uneven scalloped gum line `#C98C8C` with a wet highlight, showing above the teeth. Teeth stay intact and clean.
- **Skin through the fabric.** Where the felt is worn thin, a patch of skin: pores (1 px dots at two noise scales), faint blue veins at 10-15% opacity. Never an opening, never red.
- **Human details on a toy.** Fine creases at eye and mouth corners; two nostrils that exist only in scare frames.

**Proportion breaks.** Change at most 2 proportions per beat in Acts 1-2, then stack 4-5 in the scare frames.
- **Eyes.** One eye 3-6% of head height higher than the other. Eye spacing +20-35% wide-set, or -15% too close.
- **Mouth and jaw.** Mouth 5-15% of head width past the face outline; jaw dropped 1.3-1.6x; 30-40 teeth where a real smile shows about 10, with a half-lit second row behind.
- **Neck and head.** Neck 1.3-1.8x; head tilted 25-40° while the eyes stay level (impossible); face stretched 10-20% vertically, body unchanged; one face half 4-8% larger.

**Texture and decay**
- **Worn felt.** Pilling (2-4 px balls), frayed seams with loose 1 px threads, grime darkening into creases, soft grey-brown multiply stains (never red).
- **Stitching.** Running stitch 4-6 px with a thread shadow. On the turned Poppy the mouth was re-sewn wider: stitches run past the old corners.
- **Button eyes.** Hairline cracks with a 1 px highlight on one side.

**Expression**
- **Smile that misses the eyes.** Corners up, lower lids flat, no crow's feet, eyes open 120-140% of rest so white shows above the iris.
- **Pupils.** Pinpoint (8-12% of iris) reads as fixation; blown (85-95%, black eyes) as not human. Pinpoint in darkness is worse still: it inverts physiology.
- **Gaze.** Stage 2 looks 5-10° past the lens; Stage 3 dead into it, catchlights symmetric, no blink for 4-8 s.
- **Brows.** High raised brows over a wide smile: terror/joy mismatch.

**Line work, silhouette and motion**
- **Tremor line.** Jitter path points 0.6-1.5 px at 0.3-0.5 cycles/px; overdraw 2-4 passes offset 0.5-1.5 px, widths 0.6-2.5 px; re-seed at 8-12 fps.
- **Silhouettes.** Hidden figures read as a person or a doorway shadow. Scare silhouettes must read as wrong at a 64 px thumbnail: long neck, tilted head, arms too long.
- **Negative space.** 30-50% of each dark room is empty black something *could* step out of.
- **Smear and double exposure.** Ghost trails of 3-5 copies at 50/30/15% opacity; Poppy's face at 8-15% opacity lingering over an empty room for 1-3 s.
- **Reversed motion (Ringu).** Animate a move backwards and play it forwards, stepped at 6-8 fps with a held frame then a jump.

## 2. Scare craft in the edit

**Show the threat early (Hitchcock).** "There is no terror in the bang, only in the anticipation of it." Show it 3-6 s before anything on screen acknowledges it.

**Hidden figures (Hill House).** 4-6 in 300 s, each 10-25% of frame height, in the darkest third, at edges or in doorways, blurred 2-4 px, luma only 4-10% above the surroundings. Nothing reacts. Bring one back later, closer.

**Things that move between cuts.** Levin and Simons' viewers missed nearly all of 9 continuity errors; the few caught were near faces.
- Make 3-5 background changes (door angle, toy count, Poppy's head angle), each hidden behind a 2-4 frame glitch or black frame.
- Then one large change near the focus, so the viewer realises the earlier ones happened. Remove a door or window entirely (Skinamarink).

**Fourth-wall address.** No cutaways. A wide, quiet shot unsettles more; a close-up confronts. Poppy answers something the viewer did ("No, don't look away") and names their room.

**Reflection in a dark screen.** 3-5 s of an "off" CRT showing a faint living-room reflection, a figure behind the couch at 5-8% luma. No sting; let the viewer find it.

**False ending.** "THE END", 2-3 s of blue screen, the tape rewinds itself (1.5 s of rewind bars), PLAY, and the ident restarts wrong with Poppy already in frame. Set it up earlier or it feels like a trick.

**Long holds.** 6-12 s static shots of empty space, grain swirling only in the shadows, until the eye invents movement.

**Before the scare.**
- Strip music and dialogue to one diegetic sound (Lewton kept only footsteps).
- Rule of three: a one-two-three rhythm, then land on the third or break it (0.7 s early, or much later). Never repeat the same pattern.

**Escalation.**
- Small to big, with breathers; back-to-back scares lose force. Lewton allowed 4-5 per feature, so 3 real scares fit 5 minutes, at least 45 s apart.
- Each scare is closer and longer: 0.7, 0.8, then 1.0 s, filling 60, 75, then 90% of the frame.

**Cheap or effective.**
- Cheap: a loud noise on a mundane moment, or a scare that changes nothing. Effective: it reveals something new (Poppy is no longer inside the TV).
- At most 2 false scares, each hiding a figure that pays off on a rewatch.
- Never explain. Straub credits Candle Cove's vagueness and earnest start; Gammell's drawings frightened because they did not show the literal scene.

## 3. Sound

**Clusters.** 3-6 tones a semitone (or 50 cents) apart in 200-800 Hz, each with its own 0.1-0.3 Hz vibrato (Ligeti's micropolyphony), swelling over 8-15 s. Melodies use minor seconds and tritones and never resolve.

**Roughness (Arnal 2015).** Screams carry 30-150 Hz amplitude modulation; adding it to speech made listeners more alarmed. AM Poppy's scare lines and stingers at 40-70 Hz, depth 30-60%. Add nonlinear features (Blumstein 2010): an octave-down subharmonic at -10 dB, abrupt pitch jumps, chaotic noise.

**Shepard riser.** 8 octave-spaced sines from 55 Hz under a sin² loudness window, climbing 0.05-0.15 octaves/s for 10-25 s before a scare; cut dead at the hit.

**Sub-bass.** 30-45 Hz rumble, AM at 0.2-0.5 Hz like slow breathing, at -24 to -18 dBFS under long holds. Infrasound-fear evidence is weak: aim for bass you feel, not bass below hearing.

**Close-mic breath.** Dry, +4-6 dB at 150-250 Hz, audible mouth clicks, panned 20% off centre (someone just beside you); a cycle every 3.5-4.5 s, then a held breath before the scare.

**Whispers.** Fade in 1-2 s, hold, fade out; high-pass at 300 Hz; double with a 15-30 ms delay (Haas) so they sit outside the head; alternate hard left and right per phrase. Just under intelligibility, except one clear word.

**Reversed swells.** Reverse, reverb, re-reverse, so the swell leads into the sound by 0.5-2 s: a "pre-echo" before Poppy speaks.

**Detuned children's song.** Each note ±15-30 cents, drifting flatter over the tape; double the melody 50 cents off so it beats; the music box slows and stops mid-phrase.

**Unidentifiable sounds.** Sounds you cannot name or locate, with wavering pitch and level, scare more than recognisable ones (Hills).

**Digital silence.** Cut everything, hiss included, on the exact frame; hold 1-2.5 s, then let hiss creep back. At most 3 times, always after a dense bed, a drop of at least 18 dB.

**Stingers.** A fake-sounding scream ruins the jump.

## Sources consulted

Read via web-search summaries (the proxy blocked direct fetches).

- https://soundstripe.com/blogs/creating-tension-with-chiaroscuro-lighting
- https://nofilmschool.com/2016/10/8-spooky-lighting-techniques-you-can-use-your-horror-film
- https://theasc.com/blog/shot-craft/halloween-horrors-creating-visual-cues-to-foster-fright
- https://reference-global.com/download/article/10.2478/bsmr-2022-0020.pdf
- https://www.overthinkingit.com/2018/07/24/junji-itos-eyes/
- https://ww4.soapcentral.com/anime/the-spiral-madness-junji-ito-s-art-style-uzumaki-explained
- https://austinkleon.com/2020/12/29/the-art-of-the-gross-up/
- https://bigshinyrobot.com/tag/ren-and-stimpy
- https://blog.threadless.com/an-ode-to-the-illustrations-that-scared-scarred-us-for-life/
- https://bloody-disgusting.com/editorials/3577739/beyond-scary-stories-macabre-works-artist-stephen-gammell/
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4392592/
- https://en.wikipedia.org/wiki/Ring_(film)
- https://www.slashfilm.com/haunting-of-hill-house-hidden-ghosts
- https://bloody-disgusting.com/tv/3526189/look-hidden-ghosts-including-mike-flanagan-cameos-haunting-hill-house-exclusive/
- https://www.davidbordwell.net/blog/2011/02/14/watching-you-watch-there-will-be-blood/
- https://home.cs.colorado.edu/~mozer/Teaching/syllabi/3702/readings/Simons2000.pdf
- https://slashfilm.com/1167722/why-does-skinamarink-look-like-that-a-guide-to-the-new-horror-movies-unique-visual-style
- https://reverseshot.org/reviews/entry/3029/Skinamarink
- https://www.rollingstone.com/tv-movies/tv-movie-reviews/skinamarink-review-15000-horror-movie-viral-tiktok-kyle-edward-ball-1234657868/
- https://nofilmschool.com/how-to-write-a-jump-scare
- https://nofilmschool.com/how-cat-people-created-the-first-jump-scare
- https://avclub.com/do-jump-scares-in-films-suck-this-video-examines-a-bet-1798251105
- https://slashfilm.com/1326837/insidious-james-wan-strict-rule-every-scare
- https://www.cbsnews.com/news/scary-movies-grip-your-brain
- https://www.fictorians.com/?p=8537
- https://filmlifestyle.com/what-is-a-false-ending/
- https://www.dreadcentral.com/editorials/534205/local58-and-the-birth-of-analog-horror
- https://en.wikipedia.org/wiki/Candle_Cove
- https://fnewsmagazine.com/2022/02/ghosts-in-the-machine-archiving-the-end-of-the-world-with-gemini-home-entertainment/
- https://offscreen.com/view/theyare-herea-supernatural-televisions-in-the-horror-genre
- https://blog.indiecinema.co/what-is-the-fourth-wall/
- https://www.sciencedaily.com/releases/2015/07/150716123834.htm
- https://www.vice.com/en/article/why-screams-are-terrifying
- https://eprints.kingston.ac.uk/id/eprint/17660
- https://www.npr.org/blogs/health/2012/06/12/154853739/putting-fear-in-your-ears-what-makes-music-sound-scary
- https://splice.com/blog/music-production-elements-horror-themes
- https://interlude.hk/gyorgy-ligeti-died-on-june-12-2006-micropolyphony-hearing-the-inaudible/
- https://www.popsci.com/science/shepard-tone/
- https://www.nicolastiteux.com/en/blog/shepard-and-risset-audio-illusions/
- https://nofilmschool.com/2017/06/disquieting-uses-infrasound
- https://lbbonline.com/news/horror-sound-designs-secrets-how-audio-experts-craft-bone-chilling-scares/
- https://disquiet.com/2008/06/11/backwards-reverb-sound-design-mp3s-from-tim-prebble/
- https://www.soundonsound.com/techniques/binaural-panning-logic-pro
- https://odr.chalmers.se/server/api/core/bitstreams/76af030b-7be3-47f3-8192-7021b26b6a62/content
