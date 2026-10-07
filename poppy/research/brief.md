# THE WORLD OF POPPY: creative brief

The audience is PG-13. Scares come from dread, wrongness and a few well-timed jump scares. No gore, no blood, no self-harm. This brief covers techniques only. Do not copy any character, scene, line or logo from the works cited. Poppy is original: no porcelain doll, and no curly red hair with a blue dress. The only producer is "Sunny Meadow Home Video".

## 1. Uncanny face rules (canvas artists)

**What the research says**
- **Mismatched realism** is the strongest trigger. Realistic eyes in a stylized head, or eyes enlarged by 50% on realistic skin, were rated eeriest. Off proportions hurt more the more realistic the rendering is (MacDorman).
- **Bizarre eyes:** in morph studies, the valley appeared only when faces had bizarre eyes (Seyama & Nagayama).
- **Large eye whites** read as a fear/threat signal, even when flashed subliminally (Whalen 2004).
- **Fake smile:** the mouth smiles but the eyes stay wide, with no lower-lid lift (non-Duchenne).
- **Gaze 5-10° off** the viewer reads as looking *past* you. Eyes with no catchlight look like doll eyes.
- **Audio ahead of the lips** makes a face more uncanny.

**Drawing rules.** HW = head width. Build every feature as a parameterized function so one Poppy can be drawn at any stage.

| Feature | Stage 0 friendly | Stage 1 subtle (always on) | Stage 2 turned | Stage 3 scare frame |
|---|---|---|---|---|
| Eye width | 18% HW | left eye 7% bigger, 3 px higher | 22% HW | 27% HW |
| Pupil | 40% of eye width, catchlight | 25%; catchlight at the same pixel in both eyes even when the head tilts | 14%, no catchlight, sclera visible all round | 8% pinpoint |
| Gaze | camera | one pupil offset 0.08 eye-width outward | both aimed ~10% of frame width beside the lens | dead center |
| Smile | corners at the inner eye edges | corners at the eye centers, lower lids flat | corners 5-10% HW **past the outer eye edges**, lids wide | mouth width +30% |
| Teeth | none | none | 16-24 identical small square teeth (a real smile shows ~10) | teeth fill the mouth, too white against the felt |
| Head | upright | 12-20° tilt, held | 25° tilt | face stretched 5-15% vertically, underlit |

- **Texture mismatch.**
  - Keep the body felt: a noise fill plus hundreds of 1-3 px fiber strokes, with `ctx.filter='blur(0.6px)'`.
  - Paint the eyes realistically: a radial-gradient iris with 40-60 thin radial strokes and a dark limbal ring, sclera `#ECE5D3` with pink corners, and a wet highlight (Stages 0-1 only).
  - Human-looking teeth in a felt mouth have the same effect.
- **Proportions 10-20% off.**
  - Neck 15% too long.
  - Arms reach the knees.
  - Four fingers, each 1.4x too long with one extra knuckle.
  - Head 10% oversized.
  - Nothing should look openly monstrous before Stage 3.
- **Stillness.** Hold Poppy completely still for 3-6 s while the camera and the tape move. Then show one 2-frame blink, or a blink of only one eye.
- **Motion.** Use stepped 6-8 fps motion on a 30 fps tape. Or move her only *between* cuts: when we cut back, she is closer or has turned.
- **Lip sync.** In normal segments the mouth flaps lag the voice by 3-4 frames. After the turn, the voice keeps going with the mouth closed, or the mouth keeps moving for 0.5 s after the voice stops.
- **Lighting.** The turned Poppy under flat, bright studio light is creepier than in darkness. Save underlighting and darkness for Stage 3.
- **Concealment.** Static, color inversion and darkness make the viewer fill in the gaps. Leave big dark empty areas in the rooms (doorways, under tables, windows) for the eye to search.

## 2. Structure, pacing, scares

**A 300 s arc**
- **0:00-0:20 Opening.** Blue screen with `PLAY` OSD, color bars, then the Sunny Meadow logo and jingle.
- **0:20-1:30 Normal show.** Theme song, Poppy's greeting, a cheerful lesson (counting, colors, feelings). Keep at least 60 s mostly normal so the format earns the viewer's trust. Plant seeds: a prop moves between shots, one lyric is wrong, Poppy looks just past the lens.
- **1:30-2:30 Slippage.**
  - A tracking burst into a **recorded-over** splice: 3-8 frames of rainbow hue garbage, a vertical roll, and a 0.1 s audio pop.
  - Camcorder footage of the empty set at night.
  - A lesson repeats with its logic going wrong, e.g. the count continues past the number of children.
  - One false scare and the first subliminal frame.
- **2:30-3:45 Descent.**
  - Behind-the-scenes camcorder walk through the Blender rooms, with autofocus hunting and exposure pumping.
  - Production memos (mundane, mundane, then one wrong line).
  - A slumped Poppy puppet that has moved by the next shot.
  - Two main jump scares.
- **3:45-5:00 Return and ending.**
  - The show resumes "normal" but wrong: the same set, empty, while Poppy's voice keeps teaching.
  - Final jump scare around 4:30.
  - A quiet sign-off card.
  - End on implication, never explanation: the last frame is Poppy closer to the lens than ever, then a tape-stop pitch dive and true silence.

**Scare budget and staging**
- **Budget:** 3-4 real scares, 1-2 false scares, 4-6 subliminal frames. Keep real scares at least 45 s apart.
- **Setup:** 2-6 s of near-silence (room tone at about -42 dBFS) over a lingering, mostly empty frame.
- **Misdirection:**
  - Set up a rhythm, e.g. three empty-room cuts every 2.0 s, then break it on the 4th: 0.7 s early or 1.5 s late.
  - Pull the eye to one side with a small movement or an off-center sound, then hit in the center.
- **The hit:**
  - Hard-cut to the Stage 3 face filling 60-90% of the frame for 0.4-1.0 s.
  - Hard-cut out to black or static, then 1-2 s of *total* silence.
  - The scare image is the sharpest, best-lit image in the video.
- **Subliminal frames:** 1-3 frames (33-100 ms) of the Stage 3 face, its negative, or one line of text. Hide them inside tracking bursts or at cuts.
- **Text cards:**
  - Mono font, dated 1993-1996, at most 30 words per card.
  - On screen for 4 s plus 1 s per 4 words.
  - Rules for the viewer must be harmless ("If Poppy asks where you live, do not answer.").
  - Never instruct harm. No real FBI or government warnings.

## 3. Sound

- **Jingle.** An original 4-bar major-pentatonic tune on toy piano: a sine plus partials at x2 and x3, decaying over 0.3-0.6 s. To make it wrong, apply these step by step:
  - Detune each note randomly by ±15-30 cents.
  - Resample by 0.97-0.94, which pulls it 50-100 cents flat.
  - Slow it by 10-25%.
  - Add wow (0.5-1.5 Hz, depth 0.3% rising to 2%) and flutter (6-12 Hz, 0.1-0.3%). Drive both from filtered noise, not a looping LFO.
  - Put the last note a minor second or a tritone off.
- **Music box.** Sine partials plus inharmonic metallic ones at x2.76 and x5.40, with mechanism clicks. To wind it down, decay the tempo and pitch exponentially and stop mid-phrase.
- **Kids-show voice.**
  - Base: espeak `en-us+f3`/`+f4`, `-p 75-90 -s 160`, band-passed 250-4000 Hz, with a short room reverb.
  - Wrong versions: resample at 0.82 (about 3 semitones down); a `-p 20 -g 20` monotone; an octave-down double mixed in at -12 dB; or a dry, too-close version.
- **Beds.**
  - Room tone: brown noise low-passed at 500 Hz, at -45 to -38 dBFS.
  - Hum: 120 Hz plus harmonics, at -50 dBFS.
  - Dread drone: two sines 1 Hz apart in the 35-55 Hz range, kept above 30 Hz because most speakers can't reproduce lower. Swell it over 10-20 s before a scare, then cut to silence.
  - Use digital-zero silence only 2-3 times. Everywhere else, tape hiss stays under everything.
- **Stingers.**
  - Attack under 5 ms: a rise time over about 100 ms kills the startle reflex.
  - Peak at -1 dBFS, 15-20 dB above the previous 3 s.
  - Layers: a 0.3 s noise burst, a decaying 45 Hz thump, and a screech of 3-5 detuned saws at 800-3000 Hz with 8-14 Hz vibrato and a downward glide. Run the mix through tanh.
- **Synthetic scream (under 1.5 s).**
  - espeak "aaa" at `-p 99`, ring-modulated by a 40-70 Hz sine.
  - Noise through formant band-passes at about 800, 1200 and 2500 Hz, with 6-9 Hz vibrato at 4%.
  - A copy resampled at 0.5 underneath as a growl.
- **False scares.** Knocks or a clunk at about -12 dBFS, to lower the audience's guard.

## 4. VHS additions beyond `horror/make_video.py`

`vhs()` already does luma and chroma blur, chroma shift, grain, line noise, streaks, row jitter, head-switching noise, a tracking band, scanlines, vignette, black lift and desaturation. Add:

- **Dropouts.** Horizontal dashes 1-2 rows high and 10-120 px long, white or black, with a comet tail to the right. Real decks fill a dropout by copying the previous line, so copy row y-1 into the span. Fire them in clustered random bursts, 0-6 per frame, with more in the damaged sections.
- **Chroma.** Bleed chroma **rightward only** with a one-sided IIR (0.88 per px), so reds smear most. Add color blotch noise at 1/8 resolution, upscaled, ±0.03 in Cb/Cr.
- **Edge ringing.** `y += 0.5*(y - blur(y))`, shifted 2 px. This gives the white halo right of dark edges.
- **Timebase.**
  - Top 8-20 rows bend sideways, up to 15-25 px ("flagging").
  - Whole-frame horizontal wobble of ±1-2 px, driven by noise at 0.2-1 Hz.
  - Occasional 1-row vertical hops.
- **Edit points.** A vertical roll with a 25 px black bar, a rainbow hue sweep, and 2-4 frames of the "old recording" showing through.
- **Tape speed.** The show uses SP. Recorded-over and camcorder material uses EP: luma blur k=5, chroma blur 25, noise x1.6, more dropouts.
- **VCR modes.**
  - Pause: fields offset 1 px, jittering at 15 Hz, plus noise bars.
  - Fast-forward/rewind: 2-3 rolling noise bars, picture at 5-9x speed.
  - OSD: tape counter `0:42:17` and a `TRACKING` bar.
- **Camcorder OSD (no brand names).**
  - Content: `● REC` blinking at 1 Hz, `SP`, a battery icon, `JUN 14 1994` bottom-left and `11:52 PM` bottom-right.
  - Draw the OSD at 1/3 resolution, upscale it with nearest-neighbor, and give it a 2 px black shadow.
  - Add autofocus hunting and auto-exposure pumping (gain 0.7 to 1.0).
- **Generation loss.** Black floor at 0.06-0.08, whites clipped at 0.92, a green or warm tint per segment, saturation 0.6-0.8. Add interlace combing on fast motion.
- **Audio.**
  - Hiss in the 2-8 kHz band at -40 dBFS, plus 60 Hz hum at -50 dBFS.
  - Bandwidth 80 Hz-8 kHz (100 Hz-6 kHz for EP).
  - Wow/flutter at 0.2%, up to 3% where damaged.
  - 20-200 ms dropouts of -20 dB, synced to the video dropouts.
  - A garble on every tracking burst.
  - Tape start: pitch ramps 0.6 to 1.0 over 0.4 s. Tape stop: pitch dives to 0 over 0.5 s.
- **Escalate damage with the story.** Act 1 is nearly clean (noise 0.03), Act 3 heavy. Scare frames stay *clean and sharp*. Aim for the impression of tape, not a literal recreation: overdoing it reads as fake.

## Sources consulted

These came from web-search summaries; the network proxy blocked direct page fetches.

- MacDorman et al., uncanny CG faces: https://scholarworks.indianapolis.iu.edu/items/e8fb6458-ddad-4067-b877-1207d720ba0c ; https://newsinfo.iu.edu/news/email/normal/11945.html ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4264966
- Seyama & Nagayama / eye-size: https://www.frontiersin.org/articles/10.3389/fpsyg.2018.00774/full
- Whalen 2004, eye whites and the amygdala: https://mindhacks.com/2005/01/07/eyes-wide-with-fear/
- Duchenne smile: https://www.sciencealert.com/?p=163212
- Gaze and strabismus: https://pmc.ncbi.nlm.nih.gov/articles/PMC2634283
- Lip sync and the uncanny: https://www.snexplores.org/article/lip-synching-android-robots-uncanny
- Analog horror: https://www.studiobinder.com/blog/what-is-analog-horror-definition/ ; https://filmdaft.com/what-is-analog-horror-definition-history-examples/ ; https://www.dreadcentral.com/editorials/487662/analog-horror-you-really-shouldnt-be-seeing-this/ ; https://www.dreadcentral.com/editorials/534205/local58-and-the-birth-of-analog-horror ; https://frayedbranches.substack.com/p/gemini-home-entertainment-comic-horror ; https://bloody-disgusting.com/editorials/3958525/the-mandela-catalogue-explained-inside-alex-kisters-viral-analog-horror-phenomenon/ ; https://knowyourmeme.com/memes/subcultures/the-walten-files ; https://fanlore.org/wiki/Welcome_Home_(ARG) ; https://www.goodreads.com/book/show/28082029 ; https://egmnow.com/theres-something-hiding-in-petscop/ ; https://slasher.substack.com/p/the-shocking-decline-of-analog-horror
- Jump scares: https://nofilmschool.com/how-to-write-a-jump-scare ; https://cc.au.dk/recreational-fear-lab/blog/view/artikel/boo-aaah-an-investigation-of-where-our-attention-is-guided-during-a-jump-scare-sequence-1
- Startle rise time: https://musiciwant.com/guide/why-a-sudden-loud-sound-hits-your-body-before-your-brain
- Subliminal frames: https://www.mentalfloss.com/article/87245/terrifying-subliminal-image-hidden-exorcist
- Low drones: https://www.atlasobscura.com/articles/how-the-hidden-sounds-of-horror-movie-soundtracks-freak-you-out.amp
- Scream and creature design: https://violetrecording.com/how-to-design-a-creature-sound/
- Wow/flutter and VHS audio: https://sounddesign.irpr.agency/glossary/wow-and-flutter/ ; https://rekkerd.org/james-peck-releases-free-vhs-audio-degradation-suite-for-reaktor-6/
- VHS artifacts: https://forum.videohelp.com/threads/221868-VHS-Filters ; https://avartifactatlas.com/artifacts/head_switching_noise.html ; https://korben.info/en/ntsc-rs-open-source-vhs-effect-real-signal.html ; https://mltframework.org/plugins/FilterOpenfx-wtf-vala^ntscrs/
