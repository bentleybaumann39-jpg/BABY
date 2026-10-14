# OPPOSITE DAY

An original analog-horror tape of about 5 minutes (300.4 s, 640x480, 30 fps, MP4). It is a worn VHS dub of
*OPPOSITE DAY! A Learn-Along Game Tape*, (c) 1994 by the invented label Two-Way Kids Home Video, and parts of it
have been recorded over with a stage manager's night camcorder footage.

## Premise

The hosts are two felt mirror-twins:
- BIM, on the left.
- MIB, his copy, on the right, across a big empty gold frame in a playroom built perfectly symmetric.

They teach a game every viewer knows. On Opposite Day:
- yes means no
- forward is backward
- goodbye means hello
- to stop the game you say "It's NOT Opposite Day!"

BIM points to the little chair on his side ("This is your spot!") and jokes that MIB's cards are mirror-written, so
"if you can read them, you're on the wrong side."

The tape keeps its own rules. Once the viewer has learned to decode, every reassurance decodes into a threat in their
own head ("You're safe." "BIM isn't with you. He isn't right behind you."). Along the way:
- The copy runs late, then early.
- A figure in MIB's doorway is the only thing that walks forward.
- A camcorder's negative shows MIB in your chair.
- The twins quietly trade sides.
- A jolly upside-down portrait, then BIM himself, turn out to be Thatcher faces.

The tape teaches the viewer the way to end the game, and that way locks it on. It ends on a reverse angle from MIB's
side of the frame: the blanket is on the chair *we* are in, MIB's card is readable, the VCR's PLAY reads mirrored, and
"Bye!... I mean hello."

The scares are three jump scares: 2:51.5 (60% of the frame), 3:50.1 (75%) and 4:37.0 (90%).

The rest is dread, built from:
- six hidden figures
- five subliminal frames
- continuity swaps
- reversed sound
- three digital silences

There is no gore, no blood, and nobody is harmed.

## Files

- `STORYBOARD.md`: the full script and shot list, with exact times, assets, camera moves, VHS levels, voice lines,
  cue levels, the scare map and the rules of the game. Section 9 is the machine-readable shot list the compositor reads.
- `assets.json`: every asset, as `{"rooms", "char_art", "misc_art", "audio"}`, with specs and the shots that use it.
  This is 12 rooms, 25 character art pieces, 17 misc art pieces and 78 audio stems.
- `gen_storyboard.py` and `sb/*.py`: the single source for both files. Edit `sb/*.py`, then run
  `python3 opposite/gen_storyboard.py`. It checks:
  - every asset is used and defined
  - the runtime is 280-320 s
  - the scares are at least 45 s apart and grow
  - the subliminals are at least 1 s apart
  - there are 4-6 hidden figures
  - there are at most 3 digital silences

## Rebuilding

The pipeline is the proven one from `poppy/`, copied and adapted into this folder. Do not edit `poppy/` or `horror/`.
Every step is incremental: it skips valid existing outputs unless they are forced or named, and no single process runs
longer than about 10 minutes.

```bash
cd /home/user/BABY
python3 opposite/gen_storyboard.py                         # STORYBOARD.md + assets.json
BPY=/tmp/claude-0/-home-user-BABY/21a6af28-3cff-5de5-ac10-48d3d6a27efc/scratchpad/venv/bin/python
$BPY opposite/render_rooms.py [names...]                    # build/rooms/*.png + rooms_meta.json (Cycles CPU)
NODE_PATH=$(npm root -g) node opposite/draw/render_char.cjs [names...]   # build/art/char/*.png
NODE_PATH=$(npm root -g) node opposite/draw/misc/render_misc.cjs [names...]  # build/art/misc/*.png
python3 opposite/make_audio.py [names...]                   # build/audio/*.wav, manifest.json, *.env.json
python3 opposite/make_video.py                              # opposite/opposite_day.mp4 (chunked, restartable)
python3 opposite/make_video.py --status | --still 2:51.5 | --sheets | --audio-report
```

Always look at the output (stills, contact sheets, audio report) and iterate. Run the photosensitivity check before
delivery:
- no flashing faster than 3 per second
- the negative is a single 8 s hold
- no red full-frame flicker
