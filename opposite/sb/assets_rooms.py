# Blender rooms (render with opposite/render_rooms.py, adapted from poppy/render_rooms.py).
# All coordinates below are in 640x480 reference pixels; rooms rendered larger write their
# anchors into build/rooms/rooms_meta.json in their OWN pixel space (scale them up).

SET_LAYOUT = (
    "THE TURNAROUND ROOM (one Blender scene, reused by every turnaround_* render). A bright pastel kids'-show playroom, about "
    "7 m wide x 5 m deep x 3.2 m high, built PERFECTLY mirror-symmetric left/right about its centre line. Left half = SET A "
    "(BIM's side), right half = SET B (MIB's side). On the centre line, 1.4 m in front of the back wall, stands THE FRAME: a big "
    "ornate gilded picture frame (2.0 m tall x 1.5 m wide outside, 18 cm carved moulding with acanthus scrolls and beading, "
    "warm burnished gold with darker gold in the recesses), upright on two small gold claw feet, facing the camera, EMPTY: no "
    "glass, no canvas, no backing, so the room simply continues through it. The back wall is papered in two colours that meet "
    "in a hard vertical seam exactly on the centre line, seen through the frame opening: Set A pale Easter yellow (#F6E7A4), "
    "Set B pale sky blue (#C2E2F2), both with a small repeating white five-point-star pattern; a chunky white skirting board; "
    "pastel wainscot on the lower 0.9 m in the OTHER side's colour (Set A blue, Set B yellow). Floor: big cream and pale pink "
    "checkerboard lino tiles, symmetric. Each half holds the same props, mirrored: (1) an open DOORWAY in the back wall near the "
    "side wall (no door leaf, a rounded-top arch with a white wooden surround, opening onto a short black corridor so the "
    "opening reads as a pure black shape); (2) a round kids' WALL CLOCK high on the back wall above the doorway, white face, "
    "red rim, big numerals 1-12 (Set B's numerals are MIRROR-WRITTEN and run anticlockwise, it is a mirror copy), rendered WITH "
    "NO HANDS (the compositor draws the hands); (3) a pastel TOY CHEST against the back wall between the doorway and the frame "
    "(Set A mint with a yellow lid, Set B mint with a blue lid), lid closed; (4) a small 1980s CRT TELEVISION (13-inch, "
    "wood-grain cabinet, two knobs) on a little chrome-legged stand against the side wall near the front, switched OFF, its "
    "dark curved glass facing three-quarters toward the camera; (5) a wooden EASEL with a small green CHALKBOARD (60 x 45 cm) "
    "standing in the front corner, the board turned toward the camera, BLANK (cards are composited onto it). The mirror "
    "symmetry must be exact: build Set A, then duplicate it with scale x = -1. Two asymmetries only: the Set A CHAIR and Set A's "
    "PORTRAIT NAIL (see below). THE CHAIR FOR YOU: a small wooden child's chair painted white with a red heart cut out of the "
    "backrest, in Set A, front-left of the frame, about 1.6 m from the camera, turned 30 degrees toward the frame, with a "
    "KNITTED BLANKET (chunky cream wool with a red zig-zag band, folded over the backrest and seat). MR. TURNABOUT'S NAIL: on "
    "Set A's back wall, between the toy chest and the frame at eye height, a single brass picture nail with nothing on it (the "
    "portrait is composited); at the mirrored spot on Set B's wall, a faintly paler rectangle of wallpaper where a picture used "
    "to hang, and no nail. Grime: almost none (a clean studio set), but visible seams between set flats and slightly scuffed "
    "floor tiles. Everything chunky, rounded, saturated pastel, a little cheap.")

room("turnaround_wide", [1280, 960],
     "The Turnaround Room, wide master shot of the show. " + SET_LAYOUT,
     "Centred exactly on the symmetry plane, eye height 1.15 m (puppet head height), 5.2 m from the frame, ~30 mm lens, level "
     "horizon, no tilt, so the composition is perfectly symmetric left/right (only the chair, the nail and the pale rectangle "
     "break it). Save this camera in the .blend: turnaround_wide_late and turnaround_night must match it pixel for pixel.",
     "Flat, bright 1990s kids'-TV studio light: two big soft keys front-left and front-right at equal power, soft top light, "
     "almost no shadows, slightly warm white (~4800 K). Equal brightness on both halves (the compositor, not the render, drains "
     "Set B's saturation later in the tape). No clipped whites.",
     "Rendered 1280x960 for 2x crops. Reference layout in 640x480 terms: frame outer x 262-378, y 118-392, opening x 278-362, "
     "y 134-376; BIM foot anchor (205, 440) and MIB foot anchor (435, 440), twins ~215 px tall, so keep x 150-262 and 378-490 "
     "free of tall props in front of y 225-440; Chair For You centred near (150, 400); the mirrored empty spot on Set B near "
     "(490, 400) must be clear floor; doorways about x 58-118 and x 522-582, y 160-330 (pure black inside); clocks centred near "
     "(88, 104) and (552, 104), radius ~24 px; CRT screens near x 8-60, y 300-345 and x 580-632; easel boards near x 20-100, "
     "y 255-315 and x 540-620. Write every one of these into build/rooms/rooms_meta.json in 1280x960 pixels: frame_outer, "
     "frame_opening, foot_bim, foot_mib, chair_a, chair_b_spot, door_a, door_b, clock_a, clock_b (centre + radius), crt_a, "
     "crt_b (screen quads), board_a, board_b (board quads), chest_a_lid, chest_b_lid (lid-top centres), nail_a.")

room("turnaround_wide_late", [1280, 960],
     "Identical to turnaround_wide in every pixel except the chairs: the Chair For You on Set A no longer has its blanket (bare "
     "white chair, heart cut-out visible), and an IDENTICAL second child's chair now stands at the mirrored spot on Set B, "
     "turned 30 degrees toward the frame, with the knitted blanket folded over it exactly as it used to be on Set A's chair "
     "(mirrored drape). This is the 'it moved between cuts' change of segment 9: nobody mentions it.",
     "Exactly the turnaround_wide camera.",
     "Exactly turnaround_wide.",
     "Re-render the turnaround_wide .blend with only the chairs/blanket changed. Same rooms_meta anchors; add chair_b.")

room("turnaround_frame", [640, 480],
     "Medium two-shot framing of the same set, centred on THE FRAME: the gold frame fills the middle third (outer x 215-425, "
     "y 40-480, cropped at the feet), the yellow/blue wallpaper seam visible through its opening; Set A's easel chalkboard at "
     "far left and Set B's at far right, each board facing the camera about 130 px wide so composited rule cards are readable; "
     "slices of the toy chests behind. Space for a twin on each side of the frame, seen from the waist up.",
     "Centred on the symmetry plane, eye height 1.0 m, 2.6 m from the frame, ~40 mm, level. Same symmetric composition.",
     "Same flat bright studio light as turnaround_wide. Save the camera and light rig: turnaround_frame_dim must match it.",
     "Twin anchors (waist-up, compositor scales the full-body art and crops at the bottom edge): BIM side head centre about "
     "(150, 170), MIB side about (490, 170); keep x 80-215 and 425-560 clear of props above y 120. Board quads about x 10-140 "
     "and x 500-630, y 150-250 (record exact corners as board_a/board_b in rooms_meta.json, plus frame_opening).")

room("turnaround_frame_dim", [640, 480],
     "The turnaround_frame shot with the studio lights switched OFF one by one: only a single hard top spot remains, aimed "
     "down at the gold frame, so the frame glows and the floor around it holds a small pool of light; the wallpaper falls off "
     "to deep shadow within 1 m of the pool; the easels and boards are near-black silhouettes; the seam through the frame is "
     "barely visible.",
     "Exactly the turnaround_frame camera.",
     "One narrow, hard spot from directly above the frame (warm 3200 K), everything else off; a whisper of cold blue bounce "
     "(5% of the old fill) so blacks are not dead. Dark but readable on a TV.",
     "The compositor cross-fades turnaround_frame -> turnaround_frame_dim in steps (0.25 / 0.5 / 0.75 / 1.0) for the 'You're "
     "safe' rhythm (8e-8h), so both renders must align exactly. Same anchors as turnaround_frame.")

room("turnaround_portrait", [640, 480],
     "Medium shot of Set A's back wall: yellow star wallpaper, the brass picture nail centred at about (320, 150) with nothing "
     "on it (Mr. Turnabout is composited hanging from it), the Set A wall clock (no hands) at about (520, 90) radius 40 px, the "
     "top of the mint toy chest with its yellow lid across the bottom (y 380-480), the edge of the gold frame's carved moulding "
     "at the far right edge (x 600-640).",
     "Eye height 1.45 m, 2.0 m from the wall, ~45 mm, square to the wall.",
     "Flat bright studio light as turnaround_wide; the nail casts a tiny soft shadow down-right.",
     "Leave a clear 220 x 260 px area around the nail (x 210-430, y 120-380) for the framed portrait, which rotates on the "
     "nail. Record nail point and clock (centre + radius) in rooms_meta.json.")

room("turnaround_night", [960, 720],
     "The Turnaround Room at night, seen by a stage manager's camcorder from the show camera's position: every studio light "
     "off; a theatre GHOST LIGHT (a bare bulb in a wire cage on a 1.6 m pole stand with a round base) stands on the centre "
     "line 1 m in front of the frame and is the only light, so the frame glows dull gold, the chair and its blanket on Set A "
     "catch a warm edge, and the room falls off to black toward the walls. Both doorways are pure black. Pastels read as dim "
     "browns and greys. Chair For You with its blanket, exactly as in turnaround_wide; Set B spot empty.",
     "The turnaround_wide camera position but 0.35 m higher (a handheld camcorder at 1.5 m) and tilted 3 degrees down; ~32 mm.",
     "Ghost light: warm 2700 K point light, bulb visible and slightly blooming; quadratic falloff; no other lights. The black "
     "doorways must stay pure black so a composited figure can sit 4-8% above them.",
     "Rendered 960x720 for handheld crops and the NEG hold (the compositor inverts it to colour negative in 7d). Record "
     "chair_a, door_a, door_b, frame_opening in rooms_meta.json. Keep the ghost light stand off the chair and doorways.")

room("behind_set", [640, 480],
     "Behind Set B, at night: the raw backs of the set flats (unpainted plywood, 2x4 braces, stage weights and sandbags, "
     "C-clamps, gaffer-taped cable runs) form a narrow 1 m wide passage running away from the camera; stencilled on the "
     "plywood only 'B-3' and 'B-4' in black paint (flat numbers, nothing else readable); at the far end the passage turns "
     "right around the corner of a flat, and from round that corner comes a faint cold grey light. Dusty concrete floor.",
     "Camcorder at 1.5 m, looking down the passage, ~28 mm, 2 degrees of roll.",
     "Almost dark: the cold spill from round the far corner (6500 K, low) and a faint warm bounce from the ghost light "
     "somewhere behind the camera on the near flats. 55-65% of the frame near black.",
     "The compositor walks into it (push 1.00 -> 1.18) while the footage seems to drift backward, so keep the far end "
     "readable around (330, 230).")

room("mirror_studio", [960, 720],
     "What is behind Set B: through a gap between two flats (plywood edges dark in the foreground left and right, x 0-170 "
     "and x 790-960), a SECOND Turnaround Room, complete and dark, a mirror image of the real one (Set A and Set B swapped: "
     "blue half on the LEFT, yellow half on the right, the clocks' numerals reversed), with its own gold frame, and TWO child "
     "chairs, both with knitted blankets, one each side. No ghost light: it is lit only by a faint cold wash as if from a "
     "dead TV screen. Dust in the air.",
     "Camcorder at 1.5 m peering through the gap, ~30 mm, the far set's frame roughly centred, 4 degrees of roll.",
     "Very low cold light (6500 K, a soft area light low and to the right, 3% power); the gold frame reads as a dim rim; "
     "doorways pure black.",
     "Duplicate the turnaround set with scale x = -1, move it behind the flats, add the second chair+blanket. Hidden figure H5 "
     "is composited standing just left of the far frame: keep that spot (about x 380-430, y 300-450 in 960x720) clear and "
     "dark. Record far_frame_opening and h5_foot in rooms_meta.json.")

room("frame_mirror_night", [640, 480],
     "Close on THE FRAME at night: the carved gold frame fills about 80% of the image, and tonight its opening holds a real "
     "MIRROR (silvered glass, slightly old, faint foxing at the corners). The mirror reflects the dark studio behind the "
     "camera: the black studio floor, the ghost light glowing small at reflected frame right (about (470, 250)), dim cable "
     "loops. The space where the camera operator should appear in the reflection (centre, about x 250-390, y 140-400) is "
     "plain dark studio (the compositor puts the reflection's figure there).",
     "Camcorder at 1.5 m, 1.6 m in front of the frame, square to it, ~32 mm, 2 degrees of roll.",
     "Ghost light behind and right of the camera (2700 K) gilding the frame's carving from the right; the mirror shows its "
     "reflection. Use a true mirror material (Glossy, roughness 0.02) in Cycles; hide the camera from reflections.",
     "Record mirror_quad (the opening) and refl_figure_foot (about (320, 400)) and refl_lamp (the ghost light reflection) in "
     "rooms_meta.json. The compositor's figure must look reflected: slightly darker, faint green-grey mirror tint.")

room("crt_set_b", [1280, 960],
     "Close shot of Set B's little CRT television on its chrome stand in the BRIGHT show set: wood-grain cabinet, two knobs, "
     "a small speaker grille, the dark curved glass of the screen facing the camera almost square-on and filling the central "
     "40% of the image (screen about x 190-450, y 120-330 in 640x480 terms). Behind it the sky-blue star wallpaper and the "
     "yellow wainscot. The screen glass itself is near-black with only the faint reflection of bright studio lights in its "
     "upper-left corner (the compositor adds the living-room reflection into the screen).",
     "Eye height 0.8 m, 1.1 m from the screen, ~50 mm, square to the screen.",
     "Same flat bright studio light as turnaround_wide. The screen must stay dark (no lit tube).",
     "Rendered 1280x960 because the compositor pushes in 1.0 -> 1.7x on the screen. Record crt_screen_quad in "
     "rooms_meta.json (1280x960 pixels).")

room("turnaround_reverse", [640, 480],
     "THE REVERSE ANGLE, never seen before the ending: the camera now stands on Set B (MIB's side), close behind the gold "
     "frame and to its right, looking back left THROUGH the frame's opening at Set A. The frame's carved moulding is big in "
     "the foreground (opening about x 140-500, y 30-470) and the shot of Set A is seen through it: the Chair For You, bare, "
     "with NO blanket (its red heart cut-out showing), Set A's easel and chalkboard (blank), Set A's toy chest, the yellow "
     "star wallpaper, Set A's black doorway and its handless clock. Set A's easel has been turned so its blank board faces THIS camera. In the bottom-right "
     "foreground, OUTSIDE the frame on our side, the top of the backrest of a second child's chair, out of focus, with the "
     "knitted blanket draped over it (we are sitting in it). In the near-left foreground, also on our side, Set B's easel "
     "with its blank chalkboard square to the camera and sharp enough to read a composited card (board about x 10-150, "
     "y 250-360).",
     "Camera on Set B at 0.75 m (the eye height of a seated child), 1.0 m behind the frame plane, aimed back through the "
     "opening at the Set A chair, ~28 mm, depth of field: foreground chair and frame slightly soft, Set A sharp.",
     "The same flat bright studio light, but 15% dimmer and a little colder than turnaround_wide, so it looks like the same "
     "place in a different hour.",
     "Record board_a quad (Set A's board seen through the frame), board_b_near quad, chair_a, door_a, clock_a in "
     "rooms_meta.json for this view.")

room("livingroom", [640, 480],
     "A dim 1990s family living room at night, seen from where the television sits (it is what a dark TV screen would "
     "reflect): a brown corduroy three-seat couch facing the camera across the middle of the frame (seat top about y 300), a "
     "crocheted throw over its back, an end table with a switched-off lamp at right, wood-panelled walls, a window with "
     "half-closed blinds behind the couch at left letting in thin bars of blue streetlight, a beige carpet. Ordinary, homely, "
     "empty.",
     "Eye height 0.9 m (TV height), 3.2 m from the couch, ~28 mm, level.",
     "Night: blue streetlight through the blinds (low), a very faint warm spill from a hallway off screen right; the room is "
     "dark but its shapes read.",
     "Used only as a REFLECTION: the compositor mirrors it horizontally, darkens it to 6-15% luma, barrels it and lays it "
     "inside a dark CRT screen (tiny in Set A's TV in 4a, full in Set B's TV in 11c-11e). Record couch_left_seat (where "
     "bim_couch_back kneels, left cushion) in rooms_meta.json.")
