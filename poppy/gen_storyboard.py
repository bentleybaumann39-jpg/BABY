"""
Single source of truth for THE WORLD OF POPPY storyboard + asset manifest.

    python3 poppy/gen_storyboard.py [--out DIR]

Writes:
  /home/user/BABY/poppy/STORYBOARD.md
  /home/user/BABY/poppy/assets.json
  /home/user/BABY/poppy/SCARE_PASS.md   (the "make it 1000x scarier" change list)
and checks that every asset referenced by a shot exists in the manifest and
every manifest asset is used by at least one shot, that the runtime is
inside 290-320 s, that real scares are >= 45 s apart and that subliminal
frames are >= 1 s apart.

Edit THIS file, not the generated ones, so the storyboard stays the single
source of truth. Entries touched by the scare pass carry sp="new"/"changed"
and are written to assets.json with "scare_pass": true.
"""
import json
import os
import re
import sys
from collections import OrderedDict, defaultdict

BASE = "/home/user/BABY/poppy"
if "--out" in sys.argv:
    BASE = sys.argv[sys.argv.index("--out") + 1]

# ---------------------------------------------------------------------------
# ASSET DEFINITIONS
# ---------------------------------------------------------------------------

ROOMS = [
    dict(
        name="playroom_wide", size=[640, 480],
        description=(
            "Poppy's Playroom, the bright TV-studio set of the show, wide master shot. A three-walled "
            "kids'-show set: back wall sky blue on top with puffy painted white clouds and a big painted "
            "sun (plain yellow disc with rays, no face) top-left, mint-green wainscot on the lower third, "
            "light wood floor. A red-painted wooden door in the back wall right of centre (closed). A window "
            "flat at back-left with a painted meadow backdrop (green hills, tiny red flowers). A felt board on "
            "a wooden easel at far left. A low toy shelf at right with chunky wooden blocks, a ball and a "
            "stacking-ring toy. A small yellow child's chair near the right. A round rainbow-striped rug at "
            "centre. Everything chunky, rounded, saturated and a little cheap (visible seams between set flats)."),
        camera="Eye level 1.25 m, 3.8 m from the back wall, centred, ~32 mm lens, level horizon, no tilt. Save the camera in the .blend: playroom_wide_ajar and playroom_dark must match it pixel-for-pixel.",
        lighting="Bright, flat TV-studio light: large soft key front-left, strong fill front-right, soft top light, almost no visible shadows, slightly warm white (~4500 K). Bright but no clipped whites on the back wall.",
        notes=(
            "Leave the rug centre completely clear: Poppy is composited standing on the rug with her feet at about "
            "(320, 445) and her head top near y=115 (height ~330 px), so nothing tall may stand behind her between "
            "x=220-420. The red door must be a separate object fully visible at about x=430-520 (the variants open it). "
            "Felt board at far left (about x=20-170). Write the Poppy foot anchor, door rectangle, board rectangle and "
            "chair centre into build/rooms/rooms_meta.json (keyed by room name, pixel coordinates of this image)."),
    ),
    dict(
        name="playroom_wide_ajar", size=[640, 480],
        description=(
            "Identical to playroom_wide in every pixel except the red back-wall door, which now stands open about "
            "15 degrees showing a narrow, pitch-black gap (nothing visible inside). This is the 'something moved "
            "between shots' seed: nobody on the show mentions it."),
        camera="Exactly the playroom_wide camera.",
        lighting="Exactly playroom_wide. No light spills through the door gap.",
        notes="Re-render the playroom_wide .blend with only the door rotated. Poppy composites at the same foot anchor as playroom_wide.",
    ),
    dict(
        name="playroom_board", size=[640, 480],
        description=(
            "Closer angle of the same set, turned toward the felt board: a big sky-blue felt board in a chunky pine "
            "frame on an easel fills the left ~70% of the frame (board surface roughly x=20-450, y=60-370) and is "
            "BLANK (every flower and face is composited later). The right ~30% shows the set wall (clouds, mint "
            "wainscot) and the end of the toy shelf."),
        camera="Eye level 1.1 m, ~2.2 m from the board, ~40 mm, camera about 15 degrees right of the board's normal so the board still reads as a flat surface facing us.",
        lighting="Same bright flat studio light as playroom_wide; the felt surface evenly lit with no hot spots.",
        notes=(
            "The board surface must be flat, evenly lit, uncluttered felt: the compositor pins five items in a row on it "
            "(slot centres about x=70,155,240,325,410 at y~215, each ~80x120 px). Poppy is composited at the right edge, "
            "cropped at the knees, head centre around (545,150): keep x=460-640 free of tall foreground props. Record the "
            "board's four corner pixels and the five slot centres in build/rooms/rooms_meta.json."),
    ),
    dict(
        name="playroom_dark", size=[1280, 960],
        description=(
            "Poppy's Playroom after the turn: the exact playroom_wide set and camera, but every studio light is off. "
            "The only light is one red work light high on the right plus a faint cold spill from the doorway. The red "
            "back door stands WIDE open onto pure black. The small yellow chair has been turned to face the back wall. "
            "Colours desaturated, long deep shadows, painted clouds and sun barely visible, the felt board at left blank "
            "and dim."),
        camera="Exactly the playroom_wide camera, rendered at 1280x960 so the compositor can crop 2x close-ups (chair, open doorway, felt board) without blur.",
        lighting="One red (#FF2A1A) area/spot light high right at low power with hard-ish shadows; very faint blue-grey rim from the doorway; black world. Dark but readable on a TV: the rug, chair, board and door frame must still read.",
        notes=(
            "Rug centre clear for the wrong-Poppy cutout (same foot anchor as playroom_wide, doubled for this resolution). "
            "The doorway interior must be pure black. Record in build/rooms/rooms_meta.json (in this image's 1280x960 pixel "
            "space): Poppy foot anchor, chair centre, door-opening rectangle, board rectangle."),
    ),
    dict(
        name="studio_night", size=[960, 720],
        description=(
            "Camcorder footage location: the TV studio after hours, seen from the studio floor. The Poppy's Playroom set "
            "(same set model) is a dim island in the middle distance, seen from ~8 m back and ~30 degrees to the left, so "
            "the raw plywood backs and braces of the set flats show at the set's right edge. A theatre ghost light (bare "
            "bulb in a wire cage on a pole stand) stands on the set rug and is the main light. Two studio TV cameras on "
            "pedestals are dark silhouettes in the left foreground; cables snake across a concrete floor; a lighting grid "
            "with hanging lamps disappears into black above. The right third of the frame is mostly dark empty floor "
            "with the edge of a tall light stand and a road case."),
        camera="Handheld camcorder height 1.5 m, ~28 mm equivalent, 2-degree roll (handheld feel).",
        lighting="Ghost light: warm 2700 K point light at set centre; a faint green exit-sign glow at far right (plain green box, no readable text); everything else falls off to black.",
        notes="The compositor crops 1.4x into the dark right third (x~640-960) for the whip-pan beat, so put a few faint shapes there (light stand, road case) but nothing figure-like. Rendered larger than 640x480 for that crop.",
    ),
    dict(
        name="backstage_corridor", size=[640, 480],
        description=(
            "A narrow backstage service corridor: painted cinderblock walls (pale institutional green-cream), speckled "
            "linoleum floor, three fluorescent tube fixtures on the ceiling (the farthest one dimmer), doors on both sides "
            "with small blank name plaques, a mop bucket and a folded chair against the left wall, a closed door at the far "
            "end. Worn, scuffed, grimy (use the grime material from horror/render_scenes.py)."),
        camera="Camcorder eye height 1.55 m, looking straight down the corridor, slightly left of centre, ~30 mm.",
        lighting="Cool greenish fluorescent (~4100 K, green tint) from the tubes; the far end slightly darker; no daylight.",
        notes=(
            "Keep the far end of the floor clear and lit (around x=290-350, y=230-300): costume_standing (~70 px tall) is "
            "composited there under the far tube. The compositor also MIRRORS this render horizontally for the 'looking "
            "back' shots, so avoid any readable text. Record the far-end foot anchor in build/rooms/rooms_meta.json."),
    ),
    dict(
        name="dressing_room", size=[640, 480],
        description=(
            "A small performer's dressing room: a long counter along the left wall with a makeup mirror ringed by round "
            "bulbs (about half burnt out); a plain wooden chair at centre-right facing the camera, EMPTY; a metal clothes "
            "rack at screen-left with wire hangers and a spare pair of big yellow overalls; a foam wig head on the counter "
            "wearing a spare ring of red felt poppy petals; a sink, a small trash can, a door at the right edge. Grimy, cramped."),
        camera="Camcorder 1.5 m high in the doorway, ~28 mm, looking slightly down at the chair.",
        lighting="Mirror bulbs warm (a few on), one cold overhead fluorescent, greenish cast overall; corners fall off to dark.",
        notes=(
            "The chair seat and backrest must be completely empty and clearly visible: costume_slumped is composited sitting "
            "in it (seat top centre roughly at (400, 330); the backrest should rise behind where a slumped figure's shoulders "
            "would be). The same render is reused with no costume ('the chair is empty'). Record the seat point in "
            "build/rooms/rooms_meta.json."),
    ),
    dict(
        name="bedroom_night", size=[960, 720],
        description=(
            "A child's bedroom at night (the viewer's home): a single bed against the right wall with the covers thrown back "
            "and the pillow dented, as if someone just got up; a low dresser at left with a small 1990s CRT TV on top, screen "
            "facing the room; toys on the rug (wooden blocks, a stuffed bunny lying on its side); a window with half-open "
            "curtains and blue moonlight; a star-shaped nightlight by the bed; a few plain posters (abstract shapes only, no "
            "characters or logos). Plenty of dark corners."),
        camera="From the bedroom doorway corner, 1.4 m high, ~30 mm, looking diagonally across the room so both the TV (left) and the bed (right) are in frame.",
        lighting="Cold blue moonlight through the window; the TV screen is an emissive dim blue-grey rectangle (strength ~1.5) casting a soft blue glow on the dresser and floor; a tiny warm nightlight. Otherwise dark.",
        notes=(
            "The TV screen must be a flat, uniformly emissive plane facing roughly toward the camera and at least 110 px wide "
            "in this 960x720 render: the compositor replaces it with the show picture by perspective warp. Record its four "
            "corner pixels (clockwise from top-left) and the bed centre in build/rooms/rooms_meta.json. Rendered larger than "
            "640x480 so the 1.5x push toward the bed stays sharp."),
    ),
    dict(
        name="hallway_night", size=[640, 480],
        description=(
            "An upstairs house hallway at night: carpet runner, cream walls with a few picture frames (blank or abstract), two "
            "doors on the left (one ajar onto black), one on the right, a small plug-in nightlight low on the right wall casting "
            "a warm pool on the carpet, the far end dark with a closed door. A small side table at near-left with a lamp (off) "
            "and a plastic toy on it."),
        camera="Child's eye height 1.1 m, looking down the hallway, ~30 mm, centred.",
        lighting="Warm nightlight pool (near right), faint blue moonlight from an unseen window at the far end, everything else dark.",
        notes="The compositor pushes in toward the far end (1.0 to 1.2), so keep the far door centred around (320, 200). Keep the near-left table edge in frame: the false-scare sound (a toy falling) comes from screen-left.",
    ),
    dict(
        name="closet_door", size=[640, 480],
        description=(
            "A child's closet door at night, front-on: a pale yellow painted panel door standing slightly ajar (~8 cm) so a "
            "vertical pitch-black gap runs down the centre of the frame (gap roughly x=305-340). A small stuffed toy and a "
            "sneaker on the floor in front; the edge of the bed at the right frame edge; a star nightlight low-left up-lighting "
            "the door with cool light."),
        camera="1.2 m high, 2.0 m from the door, ~35 mm, square-on, centred on the gap. Same camera as closet_door_open.",
        lighting="Cool blue-white nightlight from low-left, faint moonlight; the gap is absolutely black.",
        notes="The gap must be pure black with no visible interior. The compositor pushes in 1.0 to 1.1 toward the gap.",
    ),
    dict(
        name="closet_door_open", size=[640, 480],
        description=(
            "Identical to closet_door except the door has swung open wider (~35 cm): a tall black slot in which the barely "
            "visible shapes of hanging clothes and wire hangers can just be made out in the dark."),
        camera="Exactly the closet_door camera.",
        lighting="Exactly closet_door; the interior gets only a faint edge of nightlight.",
        notes="The hard cut from closet_door to this frame is the 'it moved between cuts' beat right before scare 2. No face or figure inside.",
    ),
]

FULL = [420, 640]   # full-body Poppy canvas
CLOSE = [640, 480]  # close-up canvas
SCARE = [800, 600]  # scare faces (drawn bigger so push-ins stay sharp)

POPPY = [
    dict(name="poppy_idle", size=FULL, transparent=True, description=(
        "Normal Poppy (Stage 1), full body, standing facing the viewer, arms relaxed at her sides, white four-fingered gloves "
        "(fingers 1.4x too long) hanging near mid-thigh, mouth closed in a wide painted smile (corners under the eye centres, "
        "lower lids flat), glossy black button pupils on white felt eyes with a catchlight at the same pixel in both eyes; her "
        "left eye (screen right) 7% bigger and 3 px higher; one pupil offset outward so she looks just past the lens; head "
        "tilted 12 degrees and held. Friendly at a glance. REGISTRATION for every full-body frame: canvas 420x640, feet bottom "
        "centre at (210, 628), identical pixels except the parts that change.")),
    dict(name="poppy_talk", size=FULL, transparent=True, description=(
        "Identical to poppy_idle except the mouth: open in a rounded D shape, dark maroon inside with a pink felt tongue, no teeth. "
        "Lip-flap partner of poppy_idle.")),
    dict(name="poppy_blink", size=FULL, transparent=True, description=(
        "Identical to poppy_idle but both eyes closed (felt lids with a stitched curved line). Used for 2-frame blinks and for "
        "the held eyes-closed shot in the theme song.")),
    dict(name="poppy_wave_a", size=FULL, transparent=True, description=(
        "Poppy full body waving: her right arm (screen left) raised beside her head with the glove tilted outward, other arm "
        "at her side, mouth open in a happy smile (same open mouth as poppy_talk). Same canvas and foot anchor as poppy_idle.")),
    dict(name="poppy_wave_b", size=FULL, transparent=True, description=(
        "Same as poppy_wave_a but the raised glove tilted the other way (inward). Alternate with poppy_wave_a to make the wave.")),
    dict(name="poppy_point", size=FULL, transparent=True, description=(
        "Poppy full body pointing: her right arm extended to screen-left at shoulder height, the too-long index finger pointing, "
        "body turned 15 degrees toward screen-left, head still facing the viewer, mouth closed smile. Used beside the felt board.")),
    dict(name="poppy_point_talk", size=FULL, transparent=True, description=(
        "Identical to poppy_point but with the open mouth (same mouth shape as poppy_talk).")),
    dict(name="poppy_close", size=CLOSE, transparent=True, description=(
        "Normal Poppy (Stage 1) head-and-shoulders close-up. Head centre at (320, 210), felt face ~300 px wide, petal ring ~460 px "
        "wide, shoulders cut by the bottom edge. Mouth closed smile, button eyes with catchlights at the same pixel in both eyes, "
        "pupils aimed 5-10 degrees past the lens (camera-left), 12-degree head tilt held, felt fibres visible at this size. "
        "Pleasant but slightly too still. REGISTRATION for every close-up: identical canvas and head position.")),
    dict(name="poppy_close_talk", size=CLOSE, transparent=True, description=(
        "Identical to poppy_close but with the mouth open (D shape, maroon inside, pink tongue).")),
    dict(name="poppy_close_wink", size=CLOSE, transparent=True, description=(
        "Identical to poppy_close but ONLY her left eye (screen right) is closed; the other eye stays open and staring. Shown for "
        "exactly 2 frames as a one-eyed blink.")),
    dict(name="poppy_close_stare", size=CLOSE, transparent=True, description=(
        "Stage 2 'turned' close-up, same framing as poppy_close: the eyes are now realistic painted human eyes (sclera #ECE5D3 "
        "visible all round the iris, iris with 40-60 fine radial strokes and a dark limbal ring, pinpoint pupils 14% of eye "
        "width, NO catchlight), eyes 22% of head width, aimed just beside the lens; smile wider, corners 5-10% of head width "
        "past the outer eye edges, lips parted on a row of 18-20 identical small square white teeth; lower lids flat; head tilt "
        "25 degrees. She speaks with this face completely unmoving.")),
    dict(name="poppy_wrong_idle", size=FULL, transparent=True, sp="changed", description=(
        "Stage 2 'wrong' Poppy, full body, same canvas and foot anchor as poppy_idle (420x640, feet at (210, 628)), drawn under "
        "neutral light (the compositor grades it red). SCARE PASS redraw - two proportion breaks plus texture: (1) neck 1.5x the "
        "Stage 1 length (head higher; keep the whole head and petal ring inside the canvas); (2) the head, petal ring and face "
        "outline tilted 35 degrees clockwise while the eyes, the nose and the mouth line stay LEVEL (horizontal) - an impossible "
        "head that reads as wrong at a 64 px thumbnail. Eyes: big flat glossy BLACK buttons (24% of head width, blown, not human), "
        "no catchlight, her left eye (screen right) 4% of head height higher, a hairline crack across the screen-left button with "
        "a 1 px highlight on one side. Mouth closed: the painted smile has been re-sewn wider with a dark running stitch (4-6 px "
        "stitches with a thread shadow) that continues past the old corners to 10% of head width beyond the face outline on both "
        "sides; between the lips a thin glimpse of small ivory teeth of uneven widths (not identical squares); lower lids flat. "
        "Worn felt: pilling (2-4 px balls), grime darkening the creases, grey-brown multiply stains (never red), and at the neck "
        "a seam split 30x6 px where real skin shows through the felt (pores as 1 px dots at two noise scales, one faint blue vein "
        "at 12% opacity) - fabric worn thin, never an opening, never red. Arms hanging to the knees, glove fingers 1.6x long and "
        "slightly spread. Silhouette test: long neck, head on its side, arms too long. Mouth never opens in the story.")),
    dict(name="poppy_cover_eyes", size=FULL, transparent=True, sp="changed", description=(
        "Wrong Poppy counting for hide-and-seek, SAME body, 1.5x neck, tilted head and re-sewn smile as the redrawn "
        "poppy_wrong_idle, same canvas and foot anchor: both gloved hands pressed over her eyes, the 1.6x fingers (one extra "
        "knuckle each) spread across her face. SCARE PASS: through the gap between the two middle fingers of her right hand ONE "
        "realistic wet human eye looks dead into the lens: sclera visible all round with 4-6 branching 1 px grey-pink capillaries "
        "(#C9A3A0 at 30-50% opacity) from the corners, iris of 40-60 radial fibres (grey-green) with a dark limbal ring (10% of "
        "the iris radius), a pinpoint pupil (10% of the iris), a sharp window specular, a shining 1-2 px lower-lid waterline, a "
        "pink inner corner and 10-15 single lashes pressed against the glove. That eye is the only realistic patch (~4% of the "
        "face). The re-sewn closed smile shows below the hands. Head and hands carry the most detail: the compositor crops this "
        "to waist-up and head-only (up to 2.3x). The head now sits higher (1.5x neck): the compositor re-measures the head centre.")),
    dict(name="costume_slumped", size=[420, 480], transparent=True, description=(
        "The EMPTY Poppy costume slumped in a chair (do not draw the chair): the hollow mascot head has fallen onto its right "
        "shoulder, its neck opening a dark hole; same petal ring and seed-pod nose, but the eyes are black mesh vision holes; the "
        "body deflated and folded at the waist, the overalls' bib sagging, empty white gloves hanging limp where the chair arms "
        "would be, legs bent forward and flattened toward the viewer. Clearly nobody inside. Seat contact point (bottom centre of "
        "the pelvis) at (210, 330) in the canvas.")),
    dict(name="costume_standing", size=[240, 640], transparent=True, description=(
        "The empty Poppy costume standing upright by itself, to be shown far away (~70 px tall): facing the viewer, head tilted "
        "20 degrees, arms hanging limp to the knees, black mesh eye holes. Feet bottom centre at (120, 630). A simple, readable "
        "silhouette under neutral light (the compositor grades it).")),
    dict(name="poppy_scare_costume", size=SCARE, transparent=False, sp="changed", description=(
        "JUMP SCARE 1 (camcorder, 7o, 0.7 s, the head fills ~60% of the frame height). REDRAW with horror-illustration technique: "
        "it must stop reading as a cartoon. The empty-costume head lunges at the lens out of black, lit ONLY by the camcorder's "
        "on-camera light held low: key light 40 degrees BELOW the face and slightly right, hard terminator (under 3 px, a panic "
        "frame). Composition in the 800x600 canvas: felt face ~330 px tall plus petals, centred at (380, 310), tilted 32 degrees "
        "clockwise; its right side dissolves into black (lost edge: the silhouette never closes). VALUE BUDGET: 60-70% of pixels "
        "at or below 8% luma (RGB <= ~20), only 5-10% above 60% luma. Lit: the chin, the torn mouth, the lower rim of the left "
        "eye hole and the left cheek; the forehead is 60% darker than the chin and the seed-pod nose throws its shadow UPWARD "
        "between the eye holes. EYES: the costume's two mesh vision holes (a dark grid; the lower edge of each mesh wire catches "
        "the light). Pressed right up against the LEFT mesh from inside is a REAL human eye: wet, iris of ~50 radial fibres "
        "(hazel-grey) with a dark limbal ring, pinpoint pupil (9% of the iris), a sharp window specular, a shining lower-lid "
        "waterline, 5 thin grey-pink capillaries (#C9A3A0) in the white, lashes squashed against the mesh, the mesh grid crossing "
        "in front of it. The RIGHT hole is black and empty and sits 5% of head height lower. MOUTH: Poppy's painted smile line "
        "torn open along its whole length into a ragged slit of frayed felt (loose 1 px threads, fibres, grey-cream torn edges: "
        "fabric, never a wound, never red); through the tear, REAL human teeth: 12-16 ivory (#E8DFC8) teeth of uneven widths "
        "(central incisors 1.6x the laterals), grey gaps, bluish translucent edges, an uneven scalloped pink gum line (#C98C8C) "
        "with a wet highlight above the upper row, black behind. The tear runs 8% of head width past the face outline on the "
        "right, into the dark. The eye and the teeth are the only realistic patches (~8% of the face together); everything else "
        "stays felt: pilling, grime in the creases, grey-brown stains (never red), running stitches, a scuffed seed-pod nose. "
        "Petals crushed flat on the left and sunk in shadow (#4A0E12) with a 1-2 px rim: red covers under 8% of the frame. "
        "Shadows are HATCHED, not flat: 300-500 one-pixel strokes at 2-3 angles over the dark felt (Junji Ito); the outer contour "
        "is a tremor line (0.6-1.5 px jitter, 2-3 overdrawn passes). Slight motion smear only on the top and right edges; the eye "
        "and teeth razor sharp. Background pure black. Human teeth, never pointed fangs; nothing resembling any franchise mascot. "
        "No blood, no gore, no wound.")),
    dict(name="poppy_scare_closet", size=SCARE, transparent=False, sp="changed", description=(
        "JUMP SCARE 2 (closet, 8m, 0.8 s, the face fills ~75% of the frame height) and, colour-inverted, subliminal S3. REDRAW: "
        "Poppy's face pushed through the gap of the closet door, lit ONLY from below-left by the cold blue-white nightlight (key "
        "45 degrees below; soft falloff on the felt, a hard edge on the teeth). Composition: face ~430 px tall in the 800x600 "
        "canvas, centred at (400, 300), stretched 15% vertically; the head outline, petals and mouth tilted 28 degrees "
        "counter-clockwise while the EYES STAY LEVEL; two dark painted closet-door edges press in from left and right (inner edges "
        "near x=150 and x=650, each with a 1-2 px cold rim) and squeeze the petals back behind them into black. VALUE BUDGET: "
        "55-70% of pixels <= 8% luma; lit: the lower halves of the eyes, the teeth, the left cheek, the chin; the forehead and the "
        "right third of the face are black. EYES (realistic, set into felt sockets, no felt whites): 27% of head width each, "
        "wide-set (+25% spacing), open 135% so white shows ABOVE the iris, pale grey-blue irises with ~50 fibres and dark limbal "
        "rings, pinpoint pupils (9% of the iris) - pinpoint in darkness, which is physiologically wrong - symmetric window "
        "catchlights so she stares dead into the lens, shining lower-lid waterlines, 6 branching grey-pink capillaries per eye, "
        "her left eye (screen left) 4% of head height higher; thin felt brows raised high (terror/joy mismatch); lower lids FLAT. "
        "MOUTH: a smile running 12% of head width past the face outline on both sides, jaw dropped 1.4x: 34 REAL ivory teeth in "
        "two rows (front row lit, uneven widths, grey gaps, translucent edges; a half-lit second row behind at ~30% brightness), "
        "an uneven scalloped pink gum line with a wet highlight; black inside. Human details on the toy: two real nostrils under "
        "the seed-pod button nose; fine creases at the eye and mouth corners; on the left cheek a 40x30 px oval where the felt is "
        "worn through to human skin (pores as 1 px dots at two noise scales, faint blue veins at 12% opacity, a pilled and frayed "
        "felt edge) - not an opening, not red. Shadows hatched (300-500 one-pixel strokes), contour a tremor line (0.6-1.5 px "
        "jitter, 2-3 passes). Black closet interior around. Human teeth, never fangs. No blood, no gore.")),
    dict(name="poppy_scare_final", size=SCARE, transparent=False, sp="changed", description=(
        "JUMP SCARE 3 - the last image of the tape (11j, 1.0 s, after the false ending; the face fills ~90% of the frame) and, "
        "colour-inverted, subliminal S7. The closest, most realistic, most broken Poppy. Composition: face ~560 px tall in the "
        "800x600 canvas, so the forehead top and the chin are cut by the frame edges; head tilted 35 degrees clockwise with the "
        "eyes kept LEVEL; face stretched 18% vertically; the left face half 6% larger than the right. LIGHT: a dim warm underlight "
        "bouncing off the playroom floor (key 50 degrees below), hard on the teeth and the eyes, soft elsewhere. NOT a red frame: "
        "red only as a 1-2 px rim on the few visible petals and a faint warm cast; under 6% of the frame saturated red. VALUE "
        "BUDGET: 60-70% of pixels <= 8% luma, 5-10% above 60%. EYES: wet, open 140% with white visible all round, BLOWN pupils "
        "filling 90% of the iris (only a thin grey-green iris ring and its limbal edge remain - not human), symmetric sharp window "
        "catchlights dead centre into the lens, shining lower-lid waterlines, 8 branching grey-pink capillaries each, her right "
        "eye (screen left) 5% of head height higher; brows raised high; lower lids flat. MOUTH: jaw dropped 1.6x in a silent "
        "scream that runs 15% of head width past the face outline on both sides and below the chin line; 38 REAL ivory teeth in "
        "two rows (front lit, uneven, translucent edges; back row half-lit), scalloped wet pink gums top and bottom, a black "
        "throat. Human details: two real nostrils; the seed-pod button nose cracked (hairline crack with a 1 px highlight); real "
        "skin showing through worn felt at the right temple seam (pores, faint blue veins at 15%); fine creases at the eye "
        "corners. Felt everywhere else: pilling, grime, running stitches. Shadows hatched (400-600 strokes at 2-3 angles), the "
        "contour a tremor line overdrawn 3 times. Background: the black of the dark playroom. Human teeth, never fangs. No blood, "
        "no gore, no wounds.")),
    dict(name="poppy_final_close", size=[640, 480], transparent=False, description=(
        "The last image of the tape. Ordinary friendly Poppy (Stage 1 face, button eyes WITH catchlights again, opaque white felt eye whites, gentle closed smile) impossibly close to the lens: the face overfills the frame (forehead and chin cut off, the red petal bonnet visible in all four corners), slight wide-angle bulge, looking just past the lens like Stage 1, soft warm bedside-lamp light from the left, the dark bedroom (moonlit window, bed edge) faintly visible and blurred at the edges. Calm and still: dread, not a scare.")),
    dict(name="poppy_final_close_look", size=[640, 480], transparent=False, description=(
        "Identical to poppy_final_close except the eyes: both pupils a little larger and dead centre on the lens, no catchlights. Alternates with poppy_final_close field by field during the 11g VCR pause, so one field is looking straight at you.")),
    # --- scare pass: new Poppy art ---
    dict(name="poppy_scare_costume_b", size=SCARE, transparent=False, sp="new", description=(
        "BOIL frame for scare 1: identical to poppy_scare_costume (same registration, same eye, teeth, light and composition) "
        "except that every hatch stroke is re-seeded and the contour tremor re-jittered (0.6-1.5 px). The compositor alternates "
        "the pair every 4 frames (7.5 fps) so the shadows crawl like hand-drawn animation. Mean luminance of the pair must match "
        "within 2%: this is texture, not a flash.")),
    dict(name="poppy_scare_closet_b", size=SCARE, transparent=False, sp="new", description=(
        "BOIL frame for scare 2: identical to poppy_scare_closet except the re-seeded hatching and re-jittered contour, as "
        "poppy_scare_costume_b. Mean luminance within 2% of the original.")),
    dict(name="poppy_scare_final_b", size=SCARE, transparent=False, sp="new", description=(
        "BOIL frame for scare 3: identical to poppy_scare_final except the re-seeded hatching and re-jittered contour, as "
        "poppy_scare_costume_b. Mean luminance within 2% of the original.")),
    dict(name="poppy_address", size=CLOSE, transparent=True, sp="new", description=(
        "DIRECT ADDRESS close-up (11e, 12 s): Poppy talks straight to the viewer. Close-up registration (640x480, head centre "
        "(320, 210)), head and shoulders, felt face ~320 px wide. Unlike every other shot she is perfectly LEVEL (0 degrees tilt) "
        "and dead centre - that alone is wrong. Stage 2 face: realistic wet eyes set into the felt (no felt whites), 22% of head "
        "width, open 125% so a sliver of white shows above each iris, pale grey irises with 40-60 fibres and dark limbal rings, "
        "pinpoint pupils (10% of the iris), symmetric catchlights dead centre: she looks straight INTO the lens; 3-4 faint "
        "capillaries; shining lower-lid waterlines; lower lids flat. Mouth closed in the Stage 1 painted smile, corners at the "
        "outer eye edges (the smile never reaches the eyes); faded pink felt cheeks. Light: soft cool TV-glow from 35 degrees "
        "below (soft gradients: dread, not panic), the forehead 50% darker than the chin, the petals mostly dark with a 1 px rim; "
        "transparent background (the compositor puts the blurred dark playroom behind her). Felt moderately worn (pilling, grime "
        "in the creases, grey-brown stains). Keep the eye line at y~190 and 20 px of margin below the chin: the compositor "
        "stretches everything below the eye line vertically up to 1.22x.")),
    dict(name="poppy_address_talk", size=CLOSE, transparent=True, sp="new", description=(
        "Identical to poppy_address except the mouth: open in the rounded D of poppy_talk, but inside the felt there are REAL "
        "human teeth (an upper row of 10-12 ivory teeth of uneven widths with grey gaps and translucent edges, an uneven "
        "scalloped pink gum line with a wet highlight, the tips of a lower row) and dark behind - no felt tongue. The teeth are "
        "the only realistic patch (~4% of the face) and must read clearly at 640x480: every time she opens her mouth to chirp "
        "her cheerful lines, you glimpse human teeth. Lip-flap partner of poppy_address (identical registration).")),
    dict(name="hidden_poppy_stand", size=[240, 640], transparent=True, sp="new", description=(
        "HIDDEN-FIGURE cutout, used for H2, H3, H4, H5 and H6 (never commented on). A full-body wrong-Poppy SILHOUETTE: feet "
        "bottom centre at (120, 630), total height ~600 px, neck 1.5x, head tilted 30 degrees, the petal ring readable as a "
        "jagged ring around the round head, arms hanging to the knees, long spread fingers. Rendered almost black: body #0B0A0C, "
        "petal ring #1A0D10, a 1 px cool grey rim (#3A4048) only along the right edge of the head, petals and one shoulder, two "
        "tiny wet eye glints (2-3 px, at the same height, 70% white) and nothing else - no face detail, no colour. Soft alpha "
        "edge (0.8 px). Must read as 'a person with a ring around its head, head on one side, arms too long' at 60-150 px tall. "
        "The compositor blurs it 2-4 px and keeps its luma only 4-10% different from its surroundings.")),
    dict(name="hidden_peek", size=[120, 240], transparent=True, sp="new", description=(
        "Door-gap PEEK for hidden figure H1 (6b): the right-hand 30% of a Poppy face seen past a door edge. Three dark petal tips "
        "(#3A0C10) at the top and right, a slice of cream felt cheek, and ONE realistic wet eye centred at (70, 100) (iris ~18 px "
        "with fibres and a limbal ring, pinpoint pupil, a 2 px window catchlight, a shining waterline), lit only by a thin warm "
        "spill from the right; everything else near-black; the left 30 px fade to transparent so it tucks behind the door edge. "
        "Reads at 45-60 px tall.")),
]

FLOWER = [200, 320]
FEEL = [240, 300]
FRIEND = [320, 360]
FULLSCREEN = [640, 480]

MEMO_TEXT = (
    "SUNNY MEADOW HOME VIDEO / INTERNAL MEMO // "
    "TO: \"The World of Poppy\" crew, Studio B / FROM: R. Hollis, Production Office / DATE: June 12, 1996 / RE: After-hours rules // "
    "1. Return all props to the prop room after taping. / "
    "2. Craft services closes at 6:00 PM on Fridays. / "
    "3. Do not leave the Poppy costume unattended in Studio B or the dressing rooms. / "
    "4. If the costume speaks when no one is inside it, do not answer it. // "
    "Handwritten in blue ballpoint below: \"Dana says it finished the song without her. - R.\""
)

MISC = [
    dict(name="ident_sunny_meadow", size=FULLSCREEN, transparent=False, description=(
        "Sunny Meadow Home Video ident card, early-90s airbrushed look: sky gradient (pale yellow at the horizon to warm blue), a "
        "big cheerful sun with a simple smiling face rising behind two rolling green meadow hills dotted with tiny red, white and "
        "yellow flowers, soft rays; the wordmark 'Sunny Meadow' in rounded bold lettering (white with an orange outline and soft "
        "drop shadow) across the lower third, and 'HOME VIDEO' in small letter-spaced caps beneath. Original design, no "
        "resemblance to any real company's logo.")),
    dict(name="sm_logo", size=[240, 160], transparent=True, description=(
        "Logo-only version of the Sunny Meadow mark (small smiling sun over two hills plus the 'Sunny Meadow' wordmark), for the "
        "home-viewing card and the advisory cards.")),
    dict(name="title_card", size=FULLSCREEN, transparent=False, description=(
        "Show title card: sky-blue radial sunburst (alternating light/dark blue rays), a border of red poppies and green leaves "
        "along the bottom-left corner; 'THE WORLD OF' in small white rounded caps above a huge bubbly 'POPPY!' in red with a thick "
        "yellow outline, white highlights and a dark drop shadow, slightly arched; a few twinkle stars. Leave the lower-right area "
        "(x=420-640, y=220-480) as clear sky for the composited waving Poppy, and keep the bottom 60 px calm for sing-along captions.")),
    dict(name="bumper_bg", size=FULLSCREEN, transparent=False, description=(
        "Segment bumper background: bright yellow-orange radial sunburst with a felt-flower border (red poppies, daisies), and a "
        "rounded white panel in the centre (about x=90-550, y=150-330) left BLANK for compositor text ('COUNTING TIME!' etc.), "
        "bouncing flowers, or a friend portrait.")),
    dict(name="flower_1", size=FLOWER, transparent=True, description=(
        "Felt cut-out flower 1: a white daisy with a yellow centre that has a simple cute face (two black dot eyes, small smile), "
        "on a green felt stem with two leaves, stitched edges, felt texture. Stem bottom at the canvas bottom centre.")),
    dict(name="flower_2", size=FLOWER, transparent=True, description=(
        "Felt cut-out flower 2: a pink tulip with the cute dot-eyed face on the cup; same stem, style and anchor as flower_1.")),
    dict(name="flower_3", size=FLOWER, transparent=True, description=(
        "Felt cut-out flower 3: a sunflower with the cute face on its brown centre; same stem, style and anchor as flower_1.")),
    dict(name="flower_4", size=FLOWER, transparent=True, description=(
        "Felt cut-out flower 4: a blue bell-flower cluster with the cute face on the biggest bloom; same stem, style and anchor as flower_1.")),
    dict(name="flower_5_eye", size=FLOWER, transparent=True, description=(
        "Felt cut-out flower 5: a red felt poppy, same felt style and stem as flowers 1-4 but with NO cute face: its black "
        "seed-pod centre is replaced by a single realistic human eye (wet look, detailed iris, sclera visible all round, pinpoint "
        "pupil, small pink corners) looking to screen-left, toward Poppy and not at the viewer.")),
    dict(name="flower_5_eye_look", size=FLOWER, transparent=True, description=(
        "Identical to flower_5_eye (same pixels) except the eye now looks straight out at the viewer, pupil dead centre.")),
    dict(name="feel_happy", size=FEEL, transparent=True, description=(
        "Feelings face card: a round sunny-yellow felt face with a big smile and rosy cheeks on a pale card, with a word strip "
        "underneath in rounded hand-cut felt letters: 'HAPPY'.")),
    dict(name="feel_sad", size=FEEL, transparent=True, description=(
        "Feelings face card, same format: light-blue felt face, downturned mouth, one felt tear. Label 'SAD'.")),
    dict(name="feel_angry", size=FEEL, transparent=True, description=(
        "Feelings face card, same format: orange-red felt face, slanted brows, frown. Label 'ANGRY'.")),
    dict(name="feel_scared", size=FEEL, transparent=True, description=(
        "Feelings face card, same format: lavender felt face, round eyes, wavy mouth. Label 'SCARED'.")),
    dict(name="feel_hungry", size=FEEL, transparent=True, sp="changed", description=(
        "The fifth feelings face that should not exist. Same card format as the other four (pale card, felt face, word strip). "
        "SCARE PASS redraw - realism in the wrong place: sickly pale cream-grey felt with grime in the creases; REALISTIC wet human "
        "eyes set into the felt (sclera all round with 3 grey-pink capillaries each, pale irises with fibres and limbal rings, "
        "pinpoint pupils, a shining lower-lid waterline, NO catchlight), open so white shows above the irises; a cut-felt mouth "
        "(frayed fibre edges) stretched 8% past the face outline on both sides and packed with REAL ivory human teeth: 30-34 "
        "teeth in two rows of uneven widths with grey gaps and translucent edges, scalloped pink gums with a wet highlight above "
        "and below. The label 'HUNGRY' hand-lettered in black marker, crooked and slightly too big. Must read as 'eyes' and "
        "'teeth' at ~80 px tall on the board and hold up as the full-screen insert (5e) and as five copies on the board (11h). "
        "Human teeth, never fangs. No blood.")),
    dict(name="friend_mr_buttons", size=FRIEND, transparent=True, description=(
        "Friend portrait card: a sky-blue scalloped picture frame around Mr. Buttons, a brown felt teddy bear with mismatched "
        "button eyes (one big blue four-hole button, one small black one), cream muzzle with a stitched smile, red bow tie, one "
        "ear patched with plaid. Name banner 'MR. BUTTONS' across the bottom.")),
    dict(name="friend_dot", size=FRIEND, transparent=True, description=(
        "Friend portrait card, same frame style in pink: Dot, a round red felt ladybug with black spots, big friendly eyes, curly "
        "pipe-cleaner antennae with pom-poms, rosy cheeks, sitting on a leaf. Banner 'DOT'.")),
    dict(name="friend_pip_scribbled", size=FRIEND, transparent=True, description=(
        "Friend portrait card, same frame style in yellow: Pip, a small round sky-blue felt bird with an orange beak and a feather "
        "tuft, but the whole portrait is violently scribbled over with heavy black crayon loops (face completely covered, strokes "
        "overrunning the frame), the card creased and one corner torn off; the banner 'PIP' is still readable.")),
    dict(name="memo_card", size=FULLSCREEN, transparent=False, description=(
        "Typed internal memo, photographed: off-white, slightly yellowed paper filling the frame, typewriter font (uneven ink, a "
        "couple of struck-over letters), a coffee ring, a strip of tape across the top. EXACT TEXT ('/' = new line, '//' = blank "
        "line): " + MEMO_TEXT + " Put items 3-4 and the handwritten line in the lower half, because the compositor's pan ends on them. "
        "Keep the type large enough to read at 640x480 after VHS blur (body ~20 px cap height).")),
    dict(name="end_card", size=FULLSCREEN, transparent=False, description=(
        "End card in the same style as title_card (sky-blue sunburst, poppy border): 'SEE YOU TOMORROW, FRIEND!' in bubbly red "
        "letters with a yellow outline over two lines, upper half. Same lower-right clear area as title_card for the waving Poppy.")),
    dict(name="end_card_cracked", size=FULLSCREEN, transparent=False, description=(
        "end_card broken: identical layout, but the picture is cracked like a smashed plastic/glass screen, with dark fracture "
        "lines radiating from the lower right (where Poppy stood, now empty); colours drained to a sickly sepia-green; a few "
        "chipped letters (still readable); grimy grey smudges (not red).")),
    dict(name="sub_crayon_house", size=FULLSCREEN, transparent=False, description=(
        "Child's crayon drawing on off-white paper (3-frame subliminal): a simple house with a peaked roof; in an upstairs window "
        "a small stick-figure child; right behind the child, inside the house, a much taller figure with a ring of red petals "
        "around a round face, black dot eyes, a huge toothy smile and very long arms; a yellow sun in the corner; scrawled kid "
        "handwriting 'POPPY IS IN MY HOUSE' with a backwards S. Heavy waxy crayon texture.")),
    dict(name="sub_eyes_dark", size=FULLSCREEN, transparent=False, sp="changed", description=(
        "Near-black subliminal frame (S1, 2 frames inside the recorded-over roll). SCARE PASS redraw: two realistic wet human "
        "eyes in the left third, underlit from 45 degrees below, open 140% (white above the irises), pinpoint pupils, symmetric "
        "catchlights dead centre, shining waterlines, 4-6 capillaries each, the left eye 5% of the frame height higher than the "
        "right; around them only a sliver of lit felt cheek and the faintest edge of dark red petals, the dark felt hatched with "
        "1 px strokes (Junji Ito); 65-75% of pixels at or below 8% luma. Everything else black.")),
    dict(name="sub_teeth", size=FULLSCREEN, transparent=False, sp="changed", description=(
        "Subliminal extreme close-up (S2, 1 frame inside the 7c whip-pan smear). SCARE PASS redraw: cream felt lips with "
        "visible fibres and frayed cut edges parted on REAL human teeth - two rows, ~36 ivory teeth of uneven widths, grey gaps, "
        "bluish translucent edges, scalloped wet pink gums above the upper row - underlit from below so the teeth and the lower "
        "lip glow and everything else falls into black (60% of pixels <= 8% luma); the mouth runs off both frame edges; dark red "
        "petal tips barely visible in the top corners. Human teeth, never fangs. No blood.")),
    dict(name="sub_scrawl_face", size=FULLSCREEN, transparent=False, sp="new", description=(
        "Subliminal S6 (1 frame inside the self-rewind, 11a): an obsessive ballpoint scrawl of Poppy's face on yellowed, creased "
        "lined paper photographed under a weak lamp (the paper vignetted to dark at the edges). Tremor-line drawing: every contour "
        "overdrawn 3-4 passes with 0.6-1.5 px jitter, line widths 0.6-2.5 px, blue-black ink; the petal ring as frantic "
        "overlapping loops; the eyes as dense cross-hatched black voids with one tiny white glint each, the left one higher; a "
        "mouth of dozens of small rectangular teeth drawn one by one in two rows, running off the face; shadows hatched with 400+ "
        "strokes. Along the bottom margin in shaky capitals: 'SHE FINDS YOU ON TEN'. No blood.")),
    dict(name="crt_glass", size=FULLSCREEN, transparent=True, sp="new", description=(
        "Overlay for the dark-CRT reflection (8o): the glass of a switched-off 1990s CRT television seen head-on. A soft curved "
        "specular highlight band running from the upper left toward the centre (white at 6-10% alpha, feathered), faint dust "
        "specks and one fingerprint smudge (3-5% alpha), a very faint convex-glass vignette, and the rounded-rectangle tube edge "
        "darkening to opaque black in the four corners (corner radius ~60 px). Transparent everywhere else.")),
]

# Voice presets (shared by the audio builder and the storyboard).
VOICE_SPECS = OrderedDict([
    ("poppy", ("POPPY", "normal: bright, sing-song kids'-show host",
               "espeak-ng -v en-us+f3 -s 175 -p 85 -g 2 (vary -p 75-95 between phrases for sing-song); band-pass 250-4000 Hz; "
               "gentle tanh(1.5x); short room reverb (~0.3 s, 12% wet); normalise to -3 dBFS.")),
    ("poppy_flat", ("POPPY", "flat: same voice, slower, no melody, a little too close",
                    "espeak-ng -v en-us+f3 -s 140 -p 70 -g 4, no pitch variation; band-pass 250-4000 Hz; reverb 5% wet; -3 dBFS.")),
    ("poppy_wrong", ("POPPY (WRONG)", "slowed and deep, dry, too close",
                     "espeak-ng -v en-us+f3 -s 150 -p 60 -g 10, then resample x0.82 (about 3.4 semitones down and slower); add "
                     "an octave-down double at -12 dB (e.g. render at double speed and resample x0.5 so lengths match); no "
                     "reverb; full band 80-7000 Hz; light tanh; -3 dBFS.")),
    ("poppy_whisper", ("POPPY (WHISPER)", "dry whisper right at the microphone, hard attack",
                       "espeak-ng -v en-us+whisperf -s 120 -p 50; completely dry, full band, no fade-in (attack < 5 ms), "
                       "normalise to -1 dBFS.")),
    ("narrator", ("NARRATOR", "Sunny Meadow announcer: warm, calm, corporate",
                  "espeak-ng -v en-us+m3 -s 160 -p 40 -g 4; band-pass 180-3600 Hz; tanh(2.0x) like speak() in "
                  "horror/make_video.py; slight low-shelf warmth; -3 dBFS.")),
    ("crew", ("CREW (camcorder operator)", "nervous whisper, close to a cheap camcorder mic",
              "espeak-ng -v en-us+whisper -s 160 -p 35; band-pass 300-3400 Hz (camcorder mic); -6 dBFS.")),
    ("poppy_sung", ("POPPY (sung)", "robotic sing-song vocal inside the music",
                    "poppy preset, one espeak render per word/syllable with -p chosen to follow the melody notes, placed on "
                    "the beat.")),
])

# Pitch/speed ramp for the hide-and-seek count.
HS_RESAMPLE = [0.90, 0.88, 0.86, 0.84, 0.81, 0.78, 0.75, 0.72, 0.68]
HS_WORDS = ["One.", "Two.", "Three.", "Four.", "Five.", "Six.", "Seven.", "Eight.", "Nine."]

AUDIO = []


def aud(name, kind, description, text="", voice="", seconds=None, sp=None):
    AUDIO.append(dict(name=name, kind=kind, description=description, text=text, voice=voice, seconds=seconds, sp=sp))


# --- music ---
aud("mus_ident_chime", "music",
    "Sunny Meadow ident jingle, 5.0 s: a bright rising 4-note toy-piano/glockenspiel motif (C-E-G-C') over a warm pad and a soft "
    "shaker, ending on a sparkle and a held major chord that decays. Clean (Act 1). Peak -1 dBFS.", seconds=5.0)
aud("mus_theme", "music",
    "THE WORLD OF POPPY theme song, FULL MIX with vocals, exactly 23.0 s. Original 2-bars-per-line tune in C major pentatonic on "
    "toy piano (sine + partials x2 and x3, 0.3-0.6 s decays), simple bass, handclaps, a glockenspiel counter-melody; 160 bpm "
    "(1 bar = 1.5 s). Structure: 2.0 s intro; six sung lines starting at 2.0, 5.0, 8.0, 11.0, 14.0 and 17.0 s (poppy_sung voice, "
    "robotic sing-song); outro 20.0-23.0 s with the spoken 'Hi, friend!' (poppy preset) at 20.4 s and a button ending. Only "
    "Act-1 wrongness: notes detuned randomly by +-15 cents, nothing more. Write the actual line start times into "
    "build/audio/manifest.json as 'lyrics': [[start, text], ...]. Peak -1 dBFS.",
    text="Poppy, Poppy, red and bright, / in the meadow, warm and light! / Count the flowers, one, two, three, / "
         "feel your feelings, friends with me! / Close your eyes and hide away, / Poppy finds you every day! / (spoken) Hi, friend!",
    voice="poppy_sung", seconds=23.0)
aud("mus_bumper", "music",
    "Segment bumper sting, 2.0 s: quick toy-piano arpeggio up, slide whistle, 'ta-da' chord. Clean. Peak -1 dBFS.", seconds=2.0)
aud("mus_playroom_bed", "music",
    "Background music bed for the show, 30.0 s seamless loop: gentle toy piano and glockenspiel noodling on the theme melody in C "
    "major pentatonic, soft bass, 100 bpm, light +-15 cent detune. Must loop without a click. Peak -6 dBFS (the compositor mixes "
    "it at about -24 dBFS under dialogue).", seconds=30.0)
aud("mus_playroom_bed_wrong", "music",
    "The same bed gone wrong, 30.0 s loop: mus_playroom_bed resampled x0.94 (about 1 semitone flat) and slowed to ~80% tempo, "
    "random +-30 cent detune per note, noise-driven wow (0.5-1.5 Hz, depth 1.5%) and flutter (6-12 Hz, 0.2%), a few notes "
    "dropping out, low-passed at 3 kHz. Peak -6 dBFS.", seconds=30.0)
aud("mus_music_box", "music",
    "Music-box version of the theme melody, exactly 19.5 s: sine partials plus inharmonic metallic partials at x2.76 and x5.40, "
    "faint mechanism clicks. Plays normally for ~14 s, then winds down (tempo and pitch decay exponentially) and stops mid-phrase "
    "on a half-struck note at exactly 19.5 s (no fade, no tail). Peak -6 dBFS.", seconds=19.5)
aud("mus_reprise", "music",
    "Theme reprise for the ending, ~17.0 s: the theme slowed to 0.8x tempo and ~1.5 semitones flat, each note detuned +-25 cents, "
    "noise-driven wow/flutter growing from 0.3% to 2%, vocals deeper and slower (poppy_sung resampled x0.85). Intro 1.0 s; four sung "
    "lines starting at 1.0, 4.6, 8.2 and 11.8 s; the last note (~14.8 s) a tritone off; then the instrument winds down like a dying "
    "tape and is silent by 16.5 s, followed by 0.5 s of hiss. Write the line starts into manifest.json 'lyrics'. Peak -3 dBFS. "
    "SCARE PASS: keep the length (17.0 s) and the line starts (1.0, 4.6, 8.2, 11.8 s) but make it sicker: double the melody "
    "50 cents flat so the two copies beat against each other; detune each note +-25 cents and let the whole tune drift a "
    "further 30 cents flatter by the end; vocals resampled x0.80 instead of x0.85 (deeper, slower vowels) with an octave-down "
    "double at -14 dB; the last note a tritone off.",
    text="Poppy, Poppy, red and bright, / in your house, and out of sight. / Close your eyes and hide away, / "
         "Poppy found you. Now you stay.",
    voice="poppy_sung", seconds=17.0, sp="changed")

# --- ambience ---
aud("amb_room_tone", "ambience",
    "Room tone, 20 s seamless loop: brown noise low-passed at 500 Hz plus a very faint 120 Hz hum. Normalised to -20 dBFS RMS; the "
    "compositor places it around -42 dBFS.", seconds=20.0)
aud("amb_studio_night", "ambience",
    "Empty TV studio at night, 20 s loop: low HVAC rumble, faint ghost-light filament buzz (120 Hz + harmonics), a distant metal "
    "tick every ~6 s, big-room reverb. Peak -6 dBFS.", seconds=20.0)
aud("amb_fluorescent", "ambience",
    "Fluorescent ballast hum, 20 s loop: 120 Hz + harmonics, slightly crunchy, with occasional flicker ticks; small-room "
    "reflections. Peak -6 dBFS.", seconds=20.0)
aud("amb_house_night", "ambience",
    "Quiet house at night, 20 s loop: distant fridge hum, a slow far-away clock tick (1 Hz), soft wind against a window. Peak -6 dBFS.",
    seconds=20.0)
aud("amb_drone", "ambience",
    "Dread drone, 20 s loop: sines at 41 and 42 Hz (1 Hz beating) plus 82/83 Hz partials and band-passed noise 60-300 Hz with "
    "slow movement; nothing below 30 Hz. Steady level so the compositor can swell and cut it. Peak -6 dBFS.", seconds=20.0)
aud("amb_cluster", "ambience",
    "Ligeti-style tone cluster, 20 s seamless loop: five tones a semitone apart around 330-415 Hz (E4, F4, F#4, G4, G#4) plus a "
    "copy of F#4 detuned 50 cents, each a soft string-like tone (sawtooth low-passed at 2 kHz with 6% breath noise) with its OWN "
    "slow vibrato (0.1-0.3 Hz, +-8-15 cents, random phases) and its own slow amplitude drift (0.05-0.15 Hz), so the cluster "
    "shimmers and beats; no melody, it never resolves. Steady overall level so the compositor can swell it and cut it dead. "
    "Peak -6 dBFS.", seconds=20.0, sp="new")
aud("amb_sub_breath", "ambience",
    "Sub-bass pressure that breathes, 20 s seamless loop: a 36 Hz sine plus a 38 Hz sine (2 Hz beating) and noise low-passed at "
    "60 Hz, amplitude-modulated at 0.25 Hz (one 'breath' every 4 s: 1.6 s swell, 2.4 s ebb, 70% depth); high-passed at 30 Hz "
    "(4th order), nothing below. Felt more than heard: mixed at -32 to -24 dBFS under long holds. Peak -6 dBFS.",
    seconds=20.0, sp="new")

# --- sfx ---
aud("sfx_vcr_insert", "sfx", "VCR cassette insert: plastic clack, mechanism clunk, short motor whirr, 1.2 s. Peak -1 dBFS.", seconds=1.2)
aud("sfx_vcr_stop", "sfx", "VCR STOP button: mechanism clunk plus a short motor wind-down, 0.6 s. Peak -1 dBFS.", seconds=0.6)
aud("sfx_bars_tone", "sfx", "Colour-bars reference tone: 1 kHz sine, 4.0 s, 5 ms fades. Peak -1 dBFS.", seconds=4.0)
aud("sfx_static_burst", "sfx",
    "TV static, 1.5 s: uniform noise band-limited 200-9000 Hz with a hard ceiling (like snow() in horror/make_video.py), slight "
    "amplitude flutter. Peak -1 dBFS; the compositor trims it.", seconds=1.5)
aud("sfx_tracking_garble", "sfx",
    "Tracking-error garble, 0.6 s: chopped, pitch-wobbled noise plus a smeared fragment of toy piano, warbling. Peak -1 dBFS; trimmed "
    "freely by the compositor.", seconds=0.6)
aud("sfx_pop", "sfx",
    "Cartoon felt 'boing-pop' for items appearing on the felt board, 0.35 s (sine pitch blip up plus soft noise puff). Peak -1 dBFS. "
    "The compositor plays it resampled x0.7 for flower 5.", seconds=0.35)
aud("sfx_scribble", "sfx", "Harsh, fast, angry crayon scribbling on paper, 1.5 s. Peak -1 dBFS.", seconds=1.5)
aud("sfx_cam_beep", "sfx", "Camcorder record-start: two short 2.6 kHz beeps (0.1 s each, 0.08 s apart) plus a tiny tape-transport click. Peak -1 dBFS.", seconds=0.4)
aud("sfx_footsteps", "sfx", "Slow nervous footsteps on concrete/linoleum heard through a camcorder mic, 8.0 s, ~1.7 steps per second, loopable. Peak -1 dBFS.", seconds=8.0)
aud("sfx_clunk", "sfx",
    "FALSE SCARE 1: a tall metal light stand toppling in a big empty studio: short creak, loud clang on concrete, rattling tail with "
    "reverb, 1.5 s. Normalised to peak -1 dBFS; the compositor plays it at -12 dBFS.", seconds=1.5)
aud("sfx_hanger", "sfx", "Wire hangers jangling on a metal clothes rail, 0.8 s. Peak -1 dBFS.", seconds=0.8)
aud("sfx_cam_drop", "sfx", "Camcorder dropped: plastic thud on a hard floor, rattle, microphone crunch/overload, 0.8 s. Peak -1 dBFS.", seconds=0.8)
aud("sfx_toy_fall", "sfx",
    "FALSE SCARE 2: a hard plastic toy hits a wooden floor and bounces twice, then its voice box chirps a warped two-note 'hee-hee' "
    "(synth, not a real toy sample), 1.2 s. Peak -1 dBFS; played at -12 dBFS.", seconds=1.2)
aud("sfx_door_creak", "sfx", "Slow wooden door creak (friction-modulated resonances), 2.0 s. Peak -1 dBFS.", seconds=2.0)
aud("sfx_stinger_1", "sfx",
    "Scare-1 stinger (camcorder), 1.0 s, attack under 5 ms. SCARE PASS rebuild for roughness and nonlinearity (Arnal 2015, "
    "Blumstein 2010): a 0.25 s noise burst; a 45 Hz thump with a 0.4 s decay; a screech of 4 detuned saws 900-2400 Hz that JUMP "
    "abruptly in pitch twice (+7 semitones at 0.12 s, -11 at 0.30 s) and then glide down; the screech amplitude-modulated at 55 Hz "
    "with 50% depth; an octave-down copy of the screech at -10 dB (subharmonic); chaotic noise flickers in the tail; camcorder-mic "
    "overload crunch; all through tanh. No synthetic 'aaa' vocal. Peak -1 dBFS.", seconds=1.0, sp="changed")
aud("sfx_stinger_2", "sfx",
    "Scare-2 stinger (closet), 1.0 s, attack under 5 ms. SCARE PASS rebuild: higher and sharper than stinger 1: 5 detuned saws "
    "1200-3200 Hz with abrupt pitch jumps (+5 and -9 semitones) and a downward glide, 65 Hz AM at 45% depth, an octave-down "
    "subharmonic copy at -10 dB, a short noise burst and a 45 Hz thump; through tanh. It sits under the whispered 'Ten.', which "
    "must stay intelligible on the first frame (leave a 2-4 kHz notch of -6 dB for it). Peak -1 dBFS.", seconds=1.0, sp="changed")
aud("sfx_stinger_3", "sfx",
    "Scare-3 stinger (the final and biggest), 1.4 s, attack under 5 ms. SCARE PASS rebuild: 0.3 s noise burst; a 40 Hz thump "
    "with a 1.0 s decay; 6 detuned saws 700-3200 Hz with 8-14 Hz vibrato, three abrupt pitch jumps and a glide down an octave; "
    "45 Hz AM at 55% depth; an octave-down subharmonic at -10 dB; chaotic broadband noise flickering through the tail; "
    "through tanh. Peak -1 dBFS.", seconds=1.4, sp="changed")
aud("sfx_scream", "sfx",
    "Poppy's scream for scare 3, under 1.4 s, attack under 5 ms. SCARE PASS rebuild - a fake-sounding scream ruins the jump, "
    "so it is built from Poppy's OWN Act 1 voice and is recognisably her: render 'Friend!' with the poppy preset at -p 99, "
    "granular-stretch the vowel to 1.2 s, jump its pitch abruptly up 7 semitones at 0.15 s and down 12 at 0.6 s, ring-modulate "
    "at 55 Hz (60% depth) for roughness, add noise through formant band-passes at ~800/1200/2500 Hz with 6-9 Hz vibrato at "
    "4%, an octave-down copy at -10 dB as a growl, tanh saturation. Peak -1 dBFS.", seconds=1.4, sp="changed")
aud("sfx_shepard_riser", "sfx",
    "Shepard riser for the scare-1 approach, 14.0 s: 8 octave-spaced sines from 55 Hz (55, 110 ... 7040 Hz) under a fixed "
    "sin^2 loudness window over log-frequency (bottom and top layers silent, the middle loud), every layer gliding UP at 0.1 "
    "octave per second and wrapping, plus a faint noise layer band-passed around the loudest layer; the overall level rises "
    "12 dB from start to end. NO fade-out: it ends at full level on the last sample (the compositor cuts it dead). Peak -1 dBFS.",
    seconds=14.0, sp="new")
aud("sfx_breath_close", "sfx",
    "Dry close-mic breathing of someone standing right beside you, 6.0 s: breath 1 inhale 0.0-1.4 s and exhale 1.6-3.0 s; "
    "breath 2 inhale 3.4-4.6 s, then HELD - nothing from 4.6 s to the end (the held breath before a scare). Shaped noise "
    "(inhale brighter 1-5 kHz, exhale lower 300-2000 Hz), a +5 dB bell at 150-250 Hz for proximity, two soft wet mouth clicks "
    "(1.5 s and 3.3 s), no reverb, slightly irregular. Peak -3 dBFS. The compositor pans it 20% left of centre; 11i reuses only "
    "the 3.4-4.6 s inhale.", seconds=6.0, sp="new")
aud("sfx_rewind", "sfx",
    "The VCR rewinding BY ITSELF, 2.0 s: a mechanism clunk at 0.0 (relay and gears engaging), the motor whine rising 400 -> "
    "1100 Hz over 1.5 s with flutter, tape-squeal chirps (short 2-4 kHz glides every 0.2-0.4 s), a faint fast-backwards "
    "chatter of high garbled voice (any Poppy line reversed and resampled x6, -18 dB), and the stop clunk at 1.9 s. Peak -1 dBFS. "
    "The compositor adds the real programme audio of the previous ~14 s reversed at x7 underneath.", seconds=2.0, sp="new")
aud("sfx_preecho_welcome", "sfx",
    "Reversed-reverb pre-echo that swells INTO vo_wrong_welcome ('Welcome back, friend.'), 1.0 s: take the first 0.6 s of "
    "vo_wrong_welcome, reverse it, add a long dark reverb (t60 2.5 s, 100% wet, low-passed 3 kHz), reverse the result and keep "
    "its last 1.0 s, so the ghost of the word rises for 1.0 s and ends exactly where the line begins. Peak -1 dBFS (mixed about "
    "10 dB under the line). Re-render it whenever vo_wrong_welcome changes.", seconds=1.0, sp="new")
aud("sfx_preecho_tried", "sfx",
    "Reversed-reverb pre-echo that swells INTO vo_wrong_stop ('You tried to stop the tape, friend.'), 1.0 s, made exactly like "
    "sfx_preecho_welcome from the first 0.6 s of vo_wrong_stop. Re-render it whenever vo_wrong_stop changes. Peak -1 dBFS.",
    seconds=1.0, sp="new")

# --- voice ---
def vo(name, voice, text, seconds, extra="", sp=None):
    spec = VOICE_SPECS[voice]
    desc = f"{spec[0]} - {spec[1]}. Preset '{voice}' (see STORYBOARD.md section 5). {extra}".strip()
    aud(name, "voice", desc, text=text, voice=voice, seconds=seconds, sp=sp)


vo("vo_narr_ident", "narrator", "Sunny Meadow Home Video presents...", 2.6)
vo("vo_greet_1", "poppy", "Hi, friend! It's me, Poppy! Welcome to my world!", 4.2)
vo("vo_greet_2", "poppy", "I'm so glad you came over. You look ready to play!", 3.4)
vo("vo_greet_3", "poppy", "Today we're going to have so much fun!", 2.6)
vo("vo_count_intro", "poppy", "Let's count my flower friends! Count with me, friend!", 3.5)
for i, w in enumerate(["One!", "Two!", "Three!", "Four!", "Five!"], 1):
    vo(f"vo_count_{i}", "poppy", w, 0.9, "Bright and bouncy, rising pitch on each number." if i < 5 else
       "Same bright delivery as 1-4; nothing in the voice reacts to the wrong flower.")
vo("vo_count_done", "poppy", "Five flower friends! Great counting, friend!", 3.4,
   "Delivered exactly as cheerfully as before the freeze, as if nothing happened.")
vo("vo_feel_intro", "poppy", "How do we feel today? Let's look at our feelings faces!", 3.9)
vo("vo_feel_happy", "poppy", "This is happy!", 1.1)
vo("vo_feel_sad", "poppy", "This is sad.", 1.1, "Mock-sad 'aww' inflection (lower pitch -p 70).")
vo("vo_feel_angry", "poppy", "This is angry!", 1.1)
vo("vo_feel_scared", "poppy", "This is scared.", 1.1)
vo("vo_feel_hungry", "poppy_flat", "This is hungry.", 1.4)
vo("vo_feel_hungry_2", "poppy_flat", "It's okay to feel hungry, friend.", 2.8)
vo("vo_friends_intro", "poppy", "Let's say hello to all my friends!", 2.2)
vo("vo_friends_buttons", "poppy", "Hello, Mister Buttons!", 1.8)
vo("vo_friends_dot", "poppy", "Hello, Dot!", 1.3)
vo("vo_friends_pip", "poppy_flat", "Pip didn't follow the rules.", 2.1)
vo("vo_friends_pip_2", "poppy_flat", "You follow the rules. Don't you, friend?", 3.3,
   "Slightly drier and closer than vo_friends_pip.")
vo("vo_crew_1", "crew", "Okay. It's almost midnight. Studio B. Everybody went home.", 5.0)
vo("vo_crew_2", "crew", "Hello?", 0.7, "Louder than the other crew lines, called out into the dark.")
vo("vo_crew_3", "crew", "It's just a light stand.", 1.6, "Relieved, a breathy half-laugh feel.")
vo("vo_crew_4", "crew", "Dana left it in dressing room two. She won't touch it anymore.", 4.2)
vo("vo_crew_5", "crew", "There it is.", 0.9)
vo("vo_crew_6", "crew", "Where did it go?", 1.2, "Barely audible.")
vo("vo_wrong_welcome", "poppy_wrong", "Welcome back, friend. I missed you.", 4.0)
vo("vo_wrong_game", "poppy_wrong", "Let's play hide and seek, friend! I'll count.", 4.0)
for i, (w, r) in enumerate(zip(HS_WORDS, HS_RESAMPLE), 1):
    extra = (f"Hide-and-seek count number {i}: poppy_wrong preset but resample x{r:.2f} instead of x0.82 (each number lower and "
             f"slower than the last); octave-down double at {-18 + int(round((i - 1) * 1.5))} dB.")
    if i >= 8:
        extra += " Completely dry and close, as if spoken in the room right next to you."
    vo(f"vo_hs_{i}", "poppy_wrong", w, round(0.6 + 0.08 * i, 2), extra)
vo("vo_hs_10", "poppy_whisper", "Ten.", 0.7, "Lands on the first frame of scare 2. Must start with a hard consonant attack. "
   "SCARE PASS: add roughness - 50 Hz amplitude modulation at 40% depth - and an octave-down subharmonic copy at -10 dB under "
   "the whisper; keep it dry and right at the microphone.", sp="changed")
vo("vo_narr_adv_a", "narrator",
   "This videocassette was recalled in nineteen ninety-six. If you are watching it, please stop the tape.", 6.6)
vo("vo_wrong_stop", "poppy_wrong", "You tried to stop the tape, friend.", 3.2,
   "SCARE PASS: new text - it now plays after the tape was stopped and restarted itself, so she answers what the viewer did.",
   sp="changed")
vo("vo_wrong_again", "poppy_wrong", "That's okay. Let's count again.", 3.4)
vo("vo_end_see_you", "poppy", "See you tomorrow, friend!", 1.9,
   "Bright and cheerful (wrong in its cheerfulness); then resample x0.9 with light wow so it sits in the dying reprise.")
vo("vo_whisper_where", "poppy_whisper", "Where do you live? ... Where do you live? ... Where do you live, friend?", 5.6,
   "SCARE PASS: three phrases starting at 0.0, 1.9 and 3.8 s (write the starts into manifest.json as 'phrases'); each phrase "
   "fades in over 1.0-1.5 s and out over 0.4 s, high-passed at 300 Hz; the first two deliberately just under intelligibility "
   "(low-passed at 2.5 kHz, -4 dB), the third clear on 'friend'. The compositor pans phrase 1 hard LEFT, 2 hard RIGHT, 3 hard "
   "LEFT, each with a Haas double (the same phrase 22 ms later on the opposite side at -8 dB) so it sits outside the head.",
   sp="new")
vo("vo_addr_1", "poppy", "Hi, friend! I can see you!", 2.6,
   "SCARE PASS direct address: exactly the bright sing-song of the Act 1 greeting (that is what makes it wrong), a little drier "
   "(reverb 6% wet) and closer.", sp="new")
vo("vo_addr_2", "poppy", "Is that your room? It's so dark in there!", 2.9,
   "SCARE PASS direct address: same bright delivery; the pitch drops on 'dark'.", sp="new")
vo("vo_addr_3", "poppy_flat", "I heard you counting with me.", 2.2,
   "SCARE PASS direct address: flat, slow, much too close (+4 dB proximity bass at 150-250 Hz), completely dry, with 45 Hz "
   "amplitude modulation at 25% depth for roughness.", sp="new")

# ---------------------------------------------------------------------------
# PATHS + reference tracking
# ---------------------------------------------------------------------------

PATH = {}
for r in ROOMS:
    PATH[r["name"]] = f"build/rooms/{r['name']}.png"
for p in POPPY:
    PATH[p["name"]] = f"build/art/poppy/{p['name']}.png"
for m in MISC:
    PATH[m["name"]] = f"build/art/misc/{m['name']}.png"
for a in AUDIO:
    PATH[a["name"]] = f"build/audio/{a['name']}.wav"
AUD = {a["name"]: a for a in AUDIO}
assert len(PATH) == len(ROOMS) + len(POPPY) + len(MISC) + len(AUDIO), "duplicate asset name"

USED = defaultdict(list)
SEGMENTS = []
SHOTS = []
cur = None
curseg = None


def seg(sid, title, summary, act):
    global curseg
    curseg = dict(id=sid, title=title, summary=summary, act=act, shots=[])
    SEGMENTS.append(curseg)


def sh(sid, dur, title):
    global cur
    cur = dict(id=sid, dur=dur, title=title, seg=curseg["id"], picture="", camera="", vhs="",
               audio=[], text="", notes="", refs=[], cues=[], sp="")
    SHOTS.append(cur)
    curseg["shots"].append(cur)


def ref(name):
    path = PATH[name]  # KeyError = undefined asset
    if path not in cur["refs"]:
        cur["refs"].append(path)
    if cur["id"] not in USED[path]:
        USED[path].append(cur["id"])
    return f"`{path}`"


def R(n):
    return ref(n)


P = R
M = R


def VO(n, at, extra=""):
    a = AUD[n]
    spk, deliv, _ = VOICE_SPECS[a["voice"]]
    cur["cues"].append((at, PATH[n]))
    s = f"+{at:.1f} s {ref(n)} **{spk}** ({deliv}): “{a['text']}”"
    if extra:
        s += f" - {extra}"
    return s


def SFX(n, at, note):
    ats = at if isinstance(at, (list, tuple)) else [at]
    for x in ats:
        cur["cues"].append((x, PATH[n]))
    when = "/".join(f"+{x:.1f}" for x in ats)
    return f"{when} s {ref(n)} - {note}"


def pic(s): cur["picture"] = s
def cam(s): cur["camera"] = s
def vhs(s): cur["vhs"] = s
def au(*lines):
    cur["audio"].extend(lines)
    cur["audio"].sort(key=lambda l: float(l[1:l.index(" s ")].split("/")[0]) if l.startswith("+") else -1.0)
def txt(s): cur["text"] = s
def note(s): cur["notes"] = s
def SP(s): cur["sp"] = s          # what the scare pass changed in this shot (feeds SCARE_PASS.md)


# ---------------------------------------------------------------------------
# THE SHOT LIST
# ---------------------------------------------------------------------------

# ===== 1 =====
seg("1", "TAPE START", "VCR loads the tape: blue screen, tracking, colour bars, the Sunny Meadow ident and a home-viewing card. Establishes the 'real 1995 tape' frame.", "Act 1")
sh("1a", 1.0, "Black, tape loads")
pic("Pure black.")
cam("-")
vhs("none (black). Tape hiss fades in from +0.6 s.")
au(SFX("sfx_vcr_insert", 0.0, "cassette pushed in, mechanism clunk and whirr, -14 dBFS."))

sh("1b", 2.5, "VCR blue screen")
pic("Flat VCR blue (R 0.08, G 0.08, B 0.75) with white OSD 'PLAY ▶' top-left and a tape counter '0:00:00' top-right (DejaVu Sans Mono Bold 30, 2 px black shadow), drawn by the compositor.")
cam("-")
vhs("V1 on the blue, no dropouts.")
au("Compositor: 60 Hz hum (-50 dBFS) joins the tape hiss (-40 dBFS, 2-8 kHz); both run under the whole tape except the digital silences.")

sh("1c", 1.0, "Tracking lock")
pic("Static snow rolling vertically; a 'TRACKING' OSD bar (a row of small blocks filling left to right) at the bottom centre; the colour bars bleed in during the last 0.3 s.")
cam("-")
vhs("V4.")
au(SFX("sfx_static_burst", 0.0, "-20 dBFS, trimmed to 1.0 s with a 0.3 s fade-out."),
   SFX("sfx_tracking_garble", 0.6, "-24 dBFS."))

sh("1d", 3.5, "Colour bars")
pic("Colour bars (reuse color_bars() from horror/make_video.py) with a black caption strip reading 'SMV-0417   THE WORLD OF POPPY   VOL. 4' (mono 22).")
cam("-")
vhs("V1; a tracking band clears over the first 0.8 s.")
au(SFX("sfx_bars_tone", 0.0, "-20 dBFS; the compositor applies the tape-start pitch ramp (x0.6 -> x1.0 over the first 0.4 s)."))

sh("1e", 5.5, "Sunny Meadow ident")
pic(f"{M('ident_sunny_meadow')} full frame.")
cam("Slow push 1.00 -> 1.04.")
vhs("V1, warm tint.")
au(SFX("mus_ident_chime", 0.1, "-8 dBFS peak."),
   VO("vo_narr_ident", 1.2))

sh("1f", 4.0, "Home-viewing card")
pic(f"Compositor-made card: deep navy (#101A4A) background, {M('sm_logo')} centred near the top (y~40), white centred text below (DejaVu Sans Bold). The tail of the ident chime rings out.")
cam("-")
vhs("V1.")
txt("THE WORLD OF POPPY / VOLUME 4: COUNTING WITH POPPY / © 1995 SUNNY MEADOW HOME VIDEO / FOR HOME VIEWING ONLY / BE KIND, PLEASE REWIND!")
au("Hiss and hum only.")

sh("1g", 0.5, "Edit point")
pic("Black; one vertical roll with a 25 px black bar passing through, 2 frames of rainbow hue sweep.")
cam("-")
vhs("V3.")
au(SFX("sfx_tracking_garble", 0.0, "-26 dBFS, trimmed to 0.4 s."))

# ===== 2 =====
seg("2", "THEME SONG", "The full, cheerful theme with sing-along captions. Plants seeds: an empty slot where a third friend should be, Poppy with her eyes shut on 'Close your eyes and hide away', and the lyric 'Poppy finds you every day!'.", "Act 1")
sh("2a", 5.0, "Title card")
pic(f"{M('title_card')} full frame.")
cam("Slow push 1.00 -> 1.06.")
vhs("V1.")
au(SFX("mus_theme", 0.0, "theme starts at -6 dBFS peak and runs under 2a-2g (23.0 s). Use the line starts from build/audio/manifest.json for the captions."))
txt("Sing-along caption from +2.0 s: 'Poppy, Poppy, red and bright,' (yellow #FFE14D DejaVu Sans Bold 24, black outline, centred at y~440; each caption shows from its line start to the next).")

sh("2b", 3.0, "Poppy waves")
pic(f"{R('playroom_wide')} with Poppy at her rug mark alternating {P('poppy_wave_a')} / {P('poppy_wave_b')} every 5 frames (6 fps wave).")
cam("Static.")
vhs("V1.")
txt("Caption: 'in the meadow, warm and light!'")

sh("2c", 3.0, "Flowers montage")
pic(f"{M('bumper_bg')} with four flowers bouncing into the white panel left to right, one every 0.6 s from +0.1 s: {M('flower_1')}, {M('flower_2')}, {M('flower_3')}, {M('flower_4')} (each ~110 px tall, 6-frame squash-and-stretch 0.6 -> 1.1 -> 1.0).")
cam("Static.")
vhs("V1.")
au(SFX("sfx_pop", [0.1, 0.7, 1.3, 1.9], "one per flower, -18 dBFS under the song."))
txt("Caption: 'Count the flowers, one, two, three,'")

sh("2d", 3.0, "Friends montage")
pic(f"{M('bumper_bg')} with {M('friend_mr_buttons')} (left, ~150 px wide) and {M('friend_dot')} (centre) bouncing in; the right-hand slot is EMPTY: only four faint tape marks where a third portrait used to be (compositor-drawn).")
cam("Static.")
vhs("V1.")
txt("Caption: 'feel your feelings, friends with me!'")
note("Seed: there should be three friends. Nobody mentions the empty slot.")

sh("2e", 3.0, "Eyes closed")
pic(f"{R('playroom_wide')} with {P('poppy_blink')} at the rug mark, eyes shut and perfectly still for the whole shot.")
cam("Static.")
vhs("V1.")
txt("Caption: 'Close your eyes and hide away,'")
note("Seed: the hide-and-seek lyric. Her eyes stay closed 3 full seconds; no movement at all.")

sh("2f", 3.0, "Close-up")
pic(f"{P('poppy_close')} over {R('playroom_wide')} blurred (Gaussian ~6 px, brightness x0.9).")
cam("Push 1.00 -> 1.08 toward her eyes.")
vhs("V1.")
txt("Caption: 'Poppy finds you every day!'")
note("Seed: she looks just past the lens, not at it.")

sh("2g", 3.0, "Title card with Poppy")
pic(f"{M('title_card')} with Poppy waving ({P('poppy_wave_a')} / {P('poppy_wave_b')} at 6 fps) composited lower-right, feet near (540, 470), ~250 px tall.")
cam("Static.")
vhs("V1.")
txt("Caption at +0.4 s: 'Hi, friend!'")
note("The spoken 'Hi, friend!' is inside mus_theme at 20.4 s (2g +0.4 s); both wave frames have an open mouth, so no lip flap is needed.")

# ===== 3 =====
seg("3", "GREETING", "Poppy says hello in her bright playroom. Mostly normal; one line ('You look ready to play!') implies she can see you.", "Act 1")
sh("3a", 12.0, "Hi, friend!")
pic(f"{R('playroom_wide')} with Poppy at the rug mark: lip flap between {P('poppy_idle')} and {P('poppy_talk')}; one 2-frame blink with {P('poppy_blink')} at +4.6 s.")
cam("Static, imperceptible push 1.00 -> 1.03.")
vhs("V1.")
au(SFX("mus_playroom_bed", 0.0, "show music bed at -24 dBFS, looping under every show shot until 4c."),
   VO("vo_greet_1", 0.5), VO("vo_greet_2", 5.0), VO("vo_greet_3", 8.6))
note("LIP FLAP RULE: show the talk frame while the voice's 20 ms RMS is above -30 dBFS, delayed by 3 frames, minimum 3 frames per mouth state.")

# ===== 4 =====
seg("4", "COUNTING TIME", "Poppy counts five felt flowers. Flower 5 has a human eye. She freezes for seven seconds, blinks one eye, and carries on as if nothing happened; when we cut back, the eye is looking at us.", "Act 1")
sh("4a", 2.0, "Bumper: COUNTING TIME!")
pic(f"{M('bumper_bg')} with compositor text 'COUNTING TIME!' bouncing into the panel (DejaVu Sans Bold 52, red #D7262B, 4 px yellow outline).")
cam("Static.")
vhs("V1.")
au(SFX("mus_bumper", 0.0, "-10 dBFS; the music bed ducks 6 dB under it."))

sh("4b", 11.5, "Count with me")
pic(f"{R('playroom_board')} with Poppy at the right edge, cropped at the knees (head centre ~(545,150)), lip flap between {P('poppy_point')} and {P('poppy_point_talk')}. Flowers pop into board slots 1-5 (6-frame squash-and-stretch): {M('flower_1')} at +4.0, {M('flower_2')} at +5.6, {M('flower_3')} at +7.2, {M('flower_4')} at +8.8, {M('flower_5_eye')} at +10.4 s.")
cam("Static.")
vhs("V1.")
au(VO("vo_count_intro", 0.3), VO("vo_count_1", 4.0), VO("vo_count_2", 5.6), VO("vo_count_3", 7.2),
   VO("vo_count_4", 8.8), VO("vo_count_5", 10.4),
   SFX("sfx_pop", [4.0, 5.6, 7.2, 8.8, 10.4], "one per flower, -16 dBFS; the fifth pop resampled x0.7 so it lands low and wrong."))
note("Flower 5's eye looks toward Poppy, not at us. Nothing on screen reacts.")

sh("4c", 7.0, "THE FREEZE")
pic(f"{P('poppy_close')} over {R('playroom_board')} blurred, held completely still. At +6.0 s swap to {P('poppy_close_wink')} for exactly 2 frames (one-eyed blink), then back to poppy_close.")
cam("Slow push 1.00 -> 1.10 toward her eyes: the camera moves, she does not.")
vhs("V1, plus one dropout cluster at +4.5 s (3-4 dropouts over 3 frames): the tape keeps living while she doesn't.")
au("HARD CUT of mus_playroom_bed on the first frame (no fade). Hiss and hum continue (NOT digital silence).",
   SFX("amb_room_tone", 0.0, "-42 dBFS."),
   SFX("amb_drone", 3.0, "fades in from silence to -36 dBFS by +6.0 s, cut dead at the end of the shot."),
   SFX("amb_cluster", 3.0, "joins the drone, fading in from silence to -42 dBFS by +6.0 s, cut dead with it: the first time the "
       "Ligeti shimmer is heard, barely."))
note("No voice for 7 seconds. The first wrongness the viewer cannot explain.")
SP("Audio only: the faint tone cluster (amb_cluster) joins the drone swell and is cut dead with it.")

sh("4d", 6.0, "As if nothing happened")
pic(f"{R('playroom_board')} as at the end of 4b, but {M('flower_5_eye')} is replaced by {M('flower_5_eye_look')}: the eye now looks into the lens. Poppy lip flap between {P('poppy_point_talk')} and {P('poppy_point')}.")
cam("Static until +4.0 s, then an operator-style push 1.00 -> 2.4x centred on slot 5 over 1.5 s, held (as if the camera operator noticed). Flower 5 is re-composited at full art resolution so the eye (~60 px) visibly looks into the lens.")
vhs("V1.")
au("mus_playroom_bed resumes on the first frame at its normal level, mid-phrase, no fade-in.",
   VO("vo_count_done", 0.4))

# ===== 5 =====
seg("5", "FEELINGS TIME", "Four feelings faces, then a fifth nobody introduced: HUNGRY. 'It's okay to feel hungry, friend.'", "Act 1")
sh("5a", 2.0, "Bumper: FEELINGS TIME!")
pic(f"{M('bumper_bg')} with compositor text 'FEELINGS TIME!' (same style as 4a).")
cam("Static.")
vhs("V1.")
au(SFX("mus_bumper", 0.0, "-10 dBFS."))

sh("5b", 4.5, "How do we feel today?")
pic(f"{R('playroom_board')} (board blank, the flowers are gone) with Poppy lip flap {P('poppy_point_talk')} / {P('poppy_point')} at the right edge.")
cam("Static.")
vhs("V1.")
au(VO("vo_feel_intro", 0.3))

sh("5c", 8.0, "Happy, sad, angry, scared")
pic(f"Same composite ({R('playroom_board')} + Poppy). Faces pop into slots 1-4: {M('feel_happy')} at +0.0, {M('feel_sad')} at +2.0, {M('feel_angry')} at +4.0, {M('feel_scared')} at +6.0 s. Poppy lip flap {P('poppy_point_talk')} / {P('poppy_point')}. No blinks in pointing shots (there is no eyes-closed pointing frame).")
cam("Static.")
vhs("V1.")
au(VO("vo_feel_happy", 0.1), VO("vo_feel_sad", 2.1), VO("vo_feel_angry", 4.1), VO("vo_feel_scared", 6.1),
   SFX("sfx_pop", [0.0, 2.0, 4.0, 6.0], "one per face, -16 dBFS."))

sh("5d", 1.5, "Nobody introduced it")
pic(f"Same composite ({R('playroom_board')}); at +0.2 s a 3-frame V3 tracking flicker, and when it clears {M('feel_hungry')} is simply there in slot 5 (no pop). Poppy switches to {P('poppy_idle')} (stops pointing) and faces us.")
cam("Static.")
vhs("V1, with the 3-frame V3 flicker.")
au(SFX("sfx_tracking_garble", 0.2, "-22 dBFS, 0.15 s."),
   "The music bed's pitch sags ~30% over 0.4 s and recovers (compositor varispeed).")

sh("5e", 1.5, "Insert: HUNGRY")
pic(f"{R('playroom_board')} cropped 2.5x on slot 5, with {M('feel_hungry')} re-composited at its full art resolution (not an upscale of the small composite) so the teeth and eyes are crisp.")
SP("feel_hungry is redrawn with real wet eyes and real teeth and gums inside the felt: this insert is the first 'realism in the wrong place' gross-out.")
cam("Dead still.")
vhs("V1.")
au("Music bed only.")

sh("5f", 2.5, "This is hungry.")
pic(f"{P('poppy_close')} over {R('playroom_board')} blurred; lip flap with {P('poppy_close_talk')}.")
cam("Static.")
vhs("V1.")
au(VO("vo_feel_hungry", 0.3, "her mouth keeps flapping for 0.5 s AFTER the voice ends (lip-sync error)."))

sh("5g", 4.0, "It's okay to feel hungry")
pic(f"{R('playroom_board')} two-shot, all five faces on the board, Poppy lip flap {P('poppy_idle')} / {P('poppy_talk')}.")
cam("Static.")
vhs("V1.")
au(VO("vo_feel_hungry_2", 0.2, "then she holds absolutely still, no blink, to the end of the shot."))

# ===== 6 =====
seg("6", "POPPY'S FRIENDS", "Roll call. Mr. Buttons and Dot get a hello; Pip's portrait is scribbled out. 'Pip didn't follow the rules.' Poppy turns (Stage 2) and the tape is spliced: it was recorded over.", "Act 1 -> 2")
sh("6a", 2.0, "Bumper: POPPY'S FRIENDS!")
pic(f"{M('bumper_bg')} with compositor text \"POPPY'S FRIENDS!\".")
cam("Static.")
vhs("V1.")
au(SFX("mus_bumper", 0.0, "-10 dBFS, resampled x0.97 (slightly flat)."))

sh("6b", 2.5, "Hello, friends")
pic(f"{R('playroom_wide_ajar')} (the red back-wall door is now ajar; nobody comments) with Poppy lip flap {P('poppy_idle')} / {P('poppy_talk')} at the rug mark. HIDDEN FIGURE H1: {P('hidden_peek')} tucked into the black gap of the ajar door (the gap between door_rect x~510 and door_opening_rect x~520 in rooms_meta.json), eye at about (516, 205), scaled to ~55 px tall and clipped to the gap so only the petal tips and the one wet eye show, luma 6-8% above the black, blurred 1 px. A second Poppy is behind the door while Poppy talks on the rug.")
cam("Static.")
vhs("V1.")
au(VO("vo_friends_intro", 0.2))
SP("New hidden figure H1 in the door gap (the only one in Act 1).")

sh("6c", 3.0, "Mr. Buttons")
pic(f"{M('bumper_bg')} with {M('friend_mr_buttons')} centred (~300 px tall), 6-frame bounce-in.")
cam("Static.")
vhs("V1.")
au(SFX("sfx_pop", 0.0, "-16 dBFS."), VO("vo_friends_buttons", 0.4))

sh("6d", 2.5, "Dot")
pic(f"{M('bumper_bg')} with {M('friend_dot')} centred, 6-frame bounce-in.")
cam("Static.")
vhs("V1.")
au(SFX("sfx_pop", 0.0, "-16 dBFS."), VO("vo_friends_dot", 0.4))

sh("6e", 3.0, "Pip")
pic(f"{M('bumper_bg')} with {M('friend_pip_scribbled')} centred: no bounce, it is just there.")
cam("Slow push 1.00 -> 1.05.")
vhs("V1.")
au("mus_playroom_bed HARD CUT on the first frame.",
   SFX("sfx_scribble", 0.5, "-20 dBFS, 1.1 s (a half-second of bare hiss after the hard cut first)."),
   VO("vo_friends_pip", 0.9, "from off-screen."))

sh("6f", 3.5, "Don't you, friend?")
pic(f"{P('poppy_close_stare')} (Stage 2, FIRST appearance) over {R('playroom_wide_ajar')} blurred. Dead still; her mouth never moves while she talks.")
cam("No move.")
vhs("V2 (the noise floor steps up here and stays up).")
au(SFX("amb_room_tone", 0.0, "-42 dBFS."),
   VO("vo_friends_pip_2", 0.2, "mouth closed the whole time; the splice in 6g may clip the reverb tail."))

sh("6g", 1.0, "RECORDED-OVER SPLICE")
pic(f"0.0-0.3 s heavy tracking band over the stare; 0.3-0.7 s rainbow hue sweep plus a vertical roll with a 25 px black bar; SUBLIMINAL S1 at +0.40 s: {M('sub_eyes_dark')} for 2 frames inside the roll; 0.7-1.0 s static snow.")
SP("S1 uses the redrawn, underlit sub_eyes_dark.")
cam("-")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-18 dBFS."),
   "+0.3 s a 0.1 s audio pop/click (compositor).",
   SFX("sfx_static_burst", 0.7, "-20 dBFS, 0.3 s."))

# ===== 7 =====
seg("7", "RECORDED OVER: CAMCORDER", "Behind-the-scenes camcorder footage from June 1996 recorded over the show: the empty studio (something stands in its dark corner, and after the whip pan it is gone), the corridor, the costume slumped in a dressing-room chair, the memo. The chair empties; the costume stands at the end of the corridor; a Shepard riser climbs and is cut dead; then the costume is in your face, and there is a real eye inside it. EP quality throughout.", "Act 2")
sh("7a", 0.8, "Camcorder starts")
pic("Black; the camcorder OSD appears at +0.3 s; the picture fades up from black from +0.5 s.")
cam("-")
vhs("EP + V2. CAMCORDER OSD for all of segment 7 (see section 4).")
au(SFX("sfx_cam_beep", 0.1, "-18 dBFS."), "Camcorder audio for the whole segment: band 100 Hz-6 kHz, faint motor whine -48 dBFS (compositor).")

sh("7b", 6.8, "Studio B, after hours")
pic(f"{R('studio_night')} scaled to fill the frame. HIDDEN FIGURE H2: {P('hidden_poppy_stand')} standing in the studio's dark right third among the road cases, feet hidden behind the road case at about (850, 500) of the 960x720 image, ~130 px tall in that image (~18% of the frame height), blurred 3 px, luma only 5-8% above the dark around it, eye glints ~10%. It is in the room: it moves with the pan and the handheld drift. Nothing reacts to it.")
cam("Handheld drift (low-pass noise, +-6 px, +-0.6 deg); autofocus blurry (Gaussian 4 px) -> sharp over the first 1.2 s; slow pan right 0 -> +40 px.")
vhs("EP + V2, green tint, exposure pumping.")
au(SFX("amb_studio_night", 0.0, "-36 dBFS."),
   SFX("sfx_footsteps", 0.5, "-26 dBFS, soft."),
   VO("vo_crew_1", 1.5))
SP("7.2 -> 6.8 s. New hidden figure H2, the first of the figures that come back closer (H4, H5).")

sh("7c", 1.0, "FALSE SCARE 1: the clunk")
pic(f"{R('studio_night')}; at +0.0 the camera jolts (6 px shake for 4 frames) and whip-pans right: horizontal motion smear (hblur ~60 px) for 8 frames, with SUBLIMINAL S2 inside the smear at +0.3 s: {M('sub_teeth')} for 1 frame; then it settles framed on the dark right side, exactly where H2 stood.")
cam("Jolt, whip-pan right.")
vhs("EP + V2.")
au(SFX("sfx_clunk", 0.0, "-12 dBFS peak, from screen-right. Footsteps stop."))
SP("S2 now uses the redrawn sub_teeth (real teeth in felt lips). The false scare now hides a figure: the pan lands where H2 was.")

sh("7d", 3.5, "Hello?")
pic(f"{R('studio_night')} cropped 1.4x on the right third (cx~0.82, cy~0.55): dark floor, the toppled light stand's edge, the road case - and nothing standing behind it any more.")
cam("Handheld, searching slightly.")
vhs("EP + V2; exposure pumps up (gain 0.7 -> 1.0) and the grain rises.")
au(VO("vo_crew_2", 0.4), VO("vo_crew_3", 1.8))
SP("Change between cuts: H2's spot behind the road case is empty (do not draw the figure here).")

sh("7e", 6.5, "The corridor")
pic(f"{R('backstage_corridor')}.")
cam("Walking push 1.00 -> 1.18 with walking bob (+-4 px vertical at 1.8 Hz, +-2 px horizontal).")
vhs("EP + V2; fluorescent flicker (frame brightness dips to x0.7 for 1-2 frames, about once a second at random).")
au(SFX("amb_fluorescent", 0.0, "-34 dBFS."), SFX("sfx_footsteps", 0.0, "-24 dBFS."),
   VO("vo_crew_4", 1.0))
SP("7.0 -> 6.5 s (vo_crew_4 ends at +5.2 s).")

sh("7f", 6.0, "There it is")
pic(f"{R('dressing_room')} with {P('costume_slumped')} composited in the chair at the seat point from rooms_meta.json (graded to the room: green cast, slight blur to match).")
cam("Autofocus hunts (blur 3 -> 0 -> 2 -> 0 px) over the first 1.5 s, then holds on the costume; slow push 1.00 -> 1.12 toward the costume head.")
vhs("EP + V2.")
au(SFX("amb_fluorescent", 0.0, "-36 dBFS."), VO("vo_crew_5", 2.5))

sh("7g", 9.0, "The memo")
pic(f"{M('memo_card')} as camcorder footage of the paper taped to the mirror. The memo keeps ~90 px side margins and its handwritten note ends above y~380, clear of the camcorder's date/clock band. The whole memo is in frame first (zoom 1.03, reading time to +3.6 s), drifts down to the items (1.09 by +5.4 s), then pushes to 1.21x on items 3-4 and the handwritten note by +6.8 s and holds to the end.")
cam("Handheld drift and autofocus breathing throughout.")
vhs("EP + V2.")
au(SFX("amb_fluorescent", 0.0, "-36 dBFS. No voice: reading time."))
note("Key lines: '4. If the costume speaks when no one is inside it, do not answer it.' and 'Dana says it finished the song without her. - R.'")
SP("10.0 -> 9.0 s; the drift and push keyframes scaled by 0.9.")

sh("7h", 4.5, "The chair is empty")
pic(f"{R('dressing_room')} with NO costume: the chair is empty.")
cam("Handheld, nearly still.")
vhs("EP + V2.")
au(SFX("amb_fluorescent", 0.0, "-38 dBFS."),
   SFX("sfx_shepard_riser", 0.0, "starts at -40 dBFS (its own +12 dB climb brings it to about -28 dBFS), runs under 7h-7m and is CUT DEAD (no fade, on a zero crossing) at 7m +1.0 s, 13.5 s after it starts. It replaces the old amb_drone swell: an endlessly rising tone the ear cannot place."),
   VO("vo_crew_6", 2.2))
SP("5.0 -> 4.5 s. The drone swell is replaced by the Shepard riser (7h -> 7m +1.0 s).")

sh("7i", 3.5, "Looking back")
pic(f"{R('backstage_corridor')} MIRRORED horizontally (looking back the way he came) with {P('costume_standing')} composited small (~70 px tall) at the mirrored far-end anchor under the far tube, perfectly still.")
cam("Handheld, nearly still.")
vhs("EP + V2; the far tube flickers twice; exposure pumping.")
au("Fluorescent hum and the riser continue. No voice.")

sh("7j", 0.5, "Lights out")
pic(f"The 7i frame ({R('backstage_corridor')} mirrored) at x0.12 brightness; the costume is invisible in the dark - except two pinpoint eye glints (1 px each, ~10% luma, 4 px apart) where its head was.")
cam("-")
vhs("EP + V2.")
au("amb_fluorescent cuts out (the hum stops): room tone and the riser only.")
SP("New: two pinpoint eye glints in the dark where the empty costume's head was.")

sh("7k", 2.0, "Lights on: gone")
pic(f"{R('backstage_corridor')} mirrored, lights back on: the far end is EMPTY.")
cam("Handheld.")
vhs("EP + V2.")
au("amb_fluorescent back on at -36 dBFS.")

sh("7l", 2.0, "Rhythm beat 1")
pic(f"{R('dressing_room')}, empty chair.")
cam("Handheld.")
vhs("EP + V2.")
au("Hum and riser.")
note("7l, 7m and 7n set up a 2.0 s cutting rhythm that 7n breaks 0.7 s early.")

sh("7m", 2.0, "Rhythm beat 2")
pic(f"{R('backstage_corridor')} mirrored, empty.")
cam("Handheld.")
vhs("EP + V2.")
au("sfx_shepard_riser CUT DEAD at +1.0 s (no fade): from here only room tone and camcorder hiss remain (near-silence, ~-45 dBFS).")
SP("The riser cut replaces the old drone pull-down.")

sh("7n", 1.3, "Rhythm beat 3 (cut early)")
pic(f"{R('dressing_room')}, empty chair.")
cam("At +0.5 s the camera drifts 12 px LEFT toward the sound.")
vhs("EP + V2.")
au(SFX("sfx_hanger", 0.5, "-13 dBFS, hard-panned screen-left: pulls attention left. The ONE sound before the hit."))

sh("7o", 0.7, "SCARE 1")
pic(f"{P('poppy_scare_costume')} alternating with {P('poppy_scare_costume_b')} every 4 frames (the hatched shadows crawl), scaled so the head fills ~60% of the frame height. Keep the REC OSD on top (it is still the camcorder) and degrade the OSD layer with the same EP softness and chroma bleed as 7a-7n, but the image itself is CLEAN.")
cam("Zoom 1.00 -> 1.05, shake +-6 px.")
vhs("V0 CLEAN under the OSD.")
au(SFX("sfx_stinger_1", 0.0, "peak -1 dBFS, attack < 5 ms (rebuilt: rough, pitch-jumping); the compositor adds camcorder-mic overload (tanh drive x6) for the first 0.3 s."))
SP("Redrawn face (underlit, a real eye behind the mesh, real teeth through the torn smile, hatched boiling shadows); 0.8 -> 0.7 s; 60% of the frame (the three scares grow 60/75/90%).")

sh("7p", 0.5, "Camcorder drops")
pic(f"{R('dressing_room')} rotating 30 -> 110 degrees with heavy motion blur and static bars; the OSD jitters.")
cam("Tumble.")
vhs("V4.")
au(SFX("sfx_cam_drop", 0.0, "-8 dBFS."), SFX("sfx_static_burst", 0.3, "-18 dBFS, 0.2 s."))

sh("7q", 1.5, "Black")
pic("Black.")
cam("-")
vhs("none.")
au("NEAR-silence: camcorder hiss only at -60 dBFS (deliberately NOT digital zero; save true silence for later).")

# ===== 8 =====
seg("8", "BACK TO THE SHOW (WRONG): HIDE AND SEEK", "The splice ends inside a different, wrong episode: the playroom is dark and red, Poppy's head lies on its side while her eyes stay level, and she never opens her mouth. In the glitches she comes closer, then flips. She counts for hide-and-seek over cuts to a viewer's home while something stands outside the window and inside a doorway; the count slows; she leaves the TV; someone breathes right beside you and holds their breath; 'Ten.' arrives in the closet. Then the black screen turns out to be the glass of a dark TV, and in its reflection something stands behind your bed.", "Act 2 -> 3")
sh("8a", 0.9, "Edit point out of the recording")
pic(f"Rainbow roll; at +0.3 s, 3 frames of the ORIGINAL bright show bleeding through at 50% ({R('playroom_wide')} + {P('poppy_idle')}); then the roll settles on the dark playroom.")
cam("-")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-20 dBFS."))

sh("8b", 9.5, "Welcome back, friend")
pic(f"{R('playroom_dark')} (1280x960 scaled to 640x480) with the redrawn {P('poppy_wrong_idle')} at the rug mark at 1.15x her normal size (closer than her old mark), graded red. Dead still. At +4.2 s a 2-frame tracking flicker; when it clears she is at 1.3x. At +7.4 s a second 2-frame flicker: when it clears she is at 1.45x AND mirrored left-right (her head now lies on the other shoulder, the higher eye on the other side) - the one large change near the focus that tells the viewer things move between glitches. Keep her head top inside the frame (lower the foot anchor as needed).")
cam("Static.")
vhs("V2 -> V3 over the shot (red grade, saturation 0.65).")
au(SFX("mus_playroom_bed_wrong", 0.0, "-26 dBFS."),
   SFX("sfx_preecho_welcome", 0.0, "-24 dBFS: the reversed-reverb ghost of 'Welcome' swells for 1.0 s and ends exactly where the line begins."),
   VO("vo_wrong_welcome", 1.0, "her mouth never moves."),
   VO("vo_wrong_game", 5.0, "mouth still closed."))
SP("Redrawn wrong_idle (1.5x neck, head on its side with level eyes, re-sewn smile). New second glitch at +7.4 s (1.45x, mirrored). New pre-echo; both lines 0.4 s later than before.")

sh("8c", 2.5, "One")
pic(f"{R('playroom_dark')} cropped 1.4x (centre) with the redrawn {P('poppy_cover_eyes')} scaled so her head and hands fill the upper half (cropped at the waist). Her head sits higher now (1.5x neck): re-measure the head centre.")
cam("Static.")
vhs("V3.")
au("mus_playroom_bed_wrong HARD CUT on the first frame.",
   SFX("amb_drone", 0.0, "-40 dBFS, under the whole count until 8k +7.0 s."),
   VO("vo_hs_1", 0.4))
SP("Redrawn cover_eyes (fully realistic wet peeking eye).")

sh("8d", 2.5, "Two: your bedroom")
pic(f"{R('bedroom_night')} wide (960x720 scaled), then a push to 2.9x on the TV (+0.3 -> +2.1 s). The TV screen quad (rooms_meta.json) shows the 8c picture ({R('playroom_dark')} + {P('poppy_cover_eyes')}) perspective-warped in at x1.15 brightness with its own scanlines, plus a faint blue bloom onto the dresser: she is on your TV.")
cam("Static.")
vhs("V3.")
au(SFX("amb_house_night", 0.0, "-38 dBFS, runs under 8d-8l."),
   VO("vo_hs_2", 0.4, "processed as coming FROM THE TV: band-pass 300-3000 Hz, -6 dB."))

sh("8e", 2.5, "Three: the empty bed")
pic(f"{R('bedroom_night')} cropped 1.5x on the bed (covers thrown back, nobody there). HIDDEN FIGURE H3: in the moonlit window (glass at about x 433-520, y 60-305 of the 960x720 image) the head and shoulders of {P('hidden_poppy_stand')} stand OUTSIDE, cut off by the sill at y~300, head centre about (478, 175), ~110 px from head top to sill: a silhouette 6-10% DARKER than the moonlit glass (against light a figure is darker, not brighter), the tilted head and the petal ring readable, blurred 2 px. Still.")
cam("Slow push 1.5x -> 1.6x.")
vhs("V3.")
au(VO("vo_hs_3", 0.5, "from the TV, quieter, off-screen left."))
SP("New hidden figure H3 outside the bedroom window.")

sh("8f", 3.0, "Four: the hallway")
pic(f"{R('hallway_night')}. HIDDEN FIGURE H4: {P('hidden_poppy_stand')} standing about 2 m back inside the dark ajar doorway on the left (ajar_door_rect in rooms_meta.json, x 156-204), ~140 px tall (~29% of the frame height), half hidden by the door edge, luma 5% above the black doorway, eye glints ~9%, blurred 3 px.")
cam("Static.")
vhs("V3.")
au(VO("vo_hs_4", 0.6, "now full band, as if in the house rather than on the TV."))
SP("New hidden figure H4 (H2 again, closer).")

sh("8g", 3.5, "Five + FALSE SCARE 2")
pic(f"{R('hallway_night')}; H4 ({P('hidden_poppy_stand')}) is still in the left doorway, growing with the push, until the 3-frame jolt at +2.0 s; when the jolt settles the doorway is EMPTY (the toy fell from where it stood).")
cam("Push 1.00 -> 1.20 toward the far door; 3-frame jolt at +2.0 s.")
vhs("V3.")
au(VO("vo_hs_5", 0.6), SFX("sfx_toy_fall", 2.0, "-12 dBFS, from screen-left."))
SP("The false scare now hides a change: H4 vanishes behind the jolt.")

sh("8h", 3.0, "Six: closer")
pic(f"{R('playroom_dark')} cropped 1.6x with {P('poppy_cover_eyes')} much closer (hands and face fill ~60% of the frame width); the realistic eye between the fingers is clearly peeking at us.")
cam("Static.")
vhs("V3.")
au(VO("vo_hs_6", 0.7))

sh("8i", 3.5, "Seven: the closet")
pic(f"First 4 frames: a V4 tracking flicker containing SUBLIMINAL S3, a NEGATIVE (colour-inverted) of the redrawn {P('poppy_scare_closet')} for 2 frames at +0.03 s. Then {R('closet_door')}.")
cam("Static.")
vhs("V3 (V4 for the first 4 frames).")
au(SFX("sfx_tracking_garble", 0.0, "-24 dBFS, 0.15 s."), VO("vo_hs_7", 0.8))
SP("S3 is the negative of the redrawn closet face (Hitchcock: show the threat early).")

sh("8j", 4.0, "Eight: she left the TV")
pic(f"{R('bedroom_night')} at the identical 2.9x TV framing as the end of 8d. The TV now shows {R('playroom_dark')} EMPTY (no Poppy): she has left the show. After 'Eight' (+1.9 s) the camera pulls back to the whole dark bedroom - and the window is EMPTY now (H3 is gone; do not draw it).")
cam("Static, then the pull-back.")
vhs("V3.")
au(VO("vo_hs_8", 1.0, "NOT from the TV: full band, dry, close, slightly left of centre, in the room with you."))
SP("Change between cuts: the window figure is gone on the pull-back.")

sh("8k", 8.0, "Nine")
pic(f"{R('closet_door')}.")
cam("Slow push 1.00 -> 1.10 into the black gap.")
vhs("V3.")
au(VO("vo_hs_9", 1.2, "the deepest and slowest number."),
   SFX("amb_cluster", 2.0, "fades in from silence to -32 dBFS by +7.0 s: the shimmer under the hold."),
   SFX("amb_sub_breath", 2.0, "-30 dBFS: pressure you feel, swelling every 4 s."),
   SFX("sfx_breath_close", 2.4, "-22 dBFS, panned 20% LEFT, dry: someone breathing right beside you - two breaths, the second inhale ends at +7.0 s and is HELD."),
   "The drone (from 8c) swells with them from -40 to -30 dBFS. At +7.0 s cut EVERYTHING (cluster, sub, drone, breath) dead on one frame: 1.0 s of hiss and room tone only before the cut. No 'ten'.")
SP("Sound redesign of the hold: cluster + sub-bass + close breathing panned left, then a held breath and a dead cut at +7.0 s (was a drone swell dropped at +6.8 s).")

sh("8l", 3.5, "The door moved")
pic(f"HARD CUT to {R('closet_door_open')}: the door has opened wider between cuts.")
cam("No push. Dead still.")
vhs("V3.")
au(SFX("sfx_door_creak", 2.2, "-13 dBFS, trimmed to 0.8 s, hard-panned screen-left (pulls attention left). The ONE sound before the hit."),
   "Otherwise hiss only. The count's rhythm says 'ten' should come about 1 s into the shot; it doesn't.")

sh("8m", 0.8, "SCARE 2")
pic(f"{P('poppy_scare_closet')} alternating with {P('poppy_scare_closet_b')} every 4 frames, scaled so the face fills ~75% of the frame height (centred; the door edges stay in frame).")
cam("Zoom 1.00 -> 1.05, shake +-4 px.")
vhs("V0 CLEAN.")
au(VO("vo_hs_10", 0.0, "on the first frame, -3 dBFS; now rough (50 Hz AM) with a subharmonic under it."),
   SFX("sfx_stinger_2", 0.0, "peak -1 dBFS, attack < 5 ms (rebuilt)."))
SP("Redrawn face; 0.7 -> 0.8 s; 75% of the frame.")

sh("8n", 1.5, "Black")
pic("Black.")
cam("-")
vhs("none.")
au("DIGITAL SILENCE #1: true zero. Cut the stinger with a 5 ms fade on the first frame.")

sh("8o", 6.0, "Your screen")
pic(f"Compositor-made DARK-CRT REFLECTION: the tape has gone black, and the black is the glass of a switched-off TV reflecting the room it stands in. {R('bedroom_night')} cropped to x 330-960, y 60-532 (the bed, the window, the wall; the TV itself stays outside the crop), mirrored left-right, scaled to 640x480, graded cold grey-blue and darkened so the room sits at 3-12% luma with the moonlit window the brightest thing (~18%), barrel-distorted (k ~0.12) like curved glass, then {M('crt_glass')} on top. HIDDEN FIGURE H5 (H2 and H4 come back, closer): {P('hidden_poppy_stand')} standing just behind the far end of the bed in the dark left third, feet hidden by the bed, ~145 px tall (30% of the frame height), blurred 3 px, luma 5-8% above the wall behind it, eye glints ~12%. The image fades up from black over 0.0-2.5 s, like eyes adjusting, then holds absolutely still; hard cut to card A.")
cam("None.")
vhs("NO VHS damage at all - no chroma shift, dropouts, tracking or scanlines, only fine grain in the shadows: this is not the tape, it is your screen.")
au("Tape hiss creeps back from digital zero over 0.0-2.0 s and settles 4 dB lower than usual (about -47 dBFS RMS); no hum.",
   SFX("amb_house_night", 0.5, "-50 dBFS: the fridge hum and the slow clock tick of the bedroom."),
   SFX("amb_sub_breath", 1.0, "-32 dBFS, fading in over 2 s."),
   "No sting and no voice: let the viewer find the figure.")
note("Dread, not a scare. Nothing moves. The viewer has just heard 'Ten' in their closet; now they see their own room, and something standing in it.")
SP("NEW shot (6.0 s): the dark-CRT reflection with hidden figure H5.")

# ===== 9 =====
seg("9", "A MESSAGE FROM SUNNY MEADOW", "Calm, low-stimulus advisory cards from the distributor while a music box winds down - but under card B something whispers 'where do you live?' from the left, then the right, and card C hides a subliminal. The music box dies on 'SHE ALWAYS FINDS YOU ON TEN.'", "Act 3")
sh("9a", 7.6, "Card A")
pic("Compositor card (style in section 4) with the yellow header bar.")
cam("-")
vhs("V2.")
txt("Header: 'A MESSAGE FROM SUNNY MEADOW HOME VIDEO'. Body: 'THIS VIDEOCASSETTE WAS RECALLED IN 1996. IF YOU ARE WATCHING IT, PLEASE STOP THE TAPE.'")
au(SFX("mus_music_box", 0.0, "-15 dBFS (ducked 4 dB under the narrator), played from 2.1 s into the file so its mid-phrase death still lands exactly on 9d's first frame (17.4 s later)."),
   VO("vo_narr_adv_a", 0.6))
note(f"{M('sm_logo')} sits top-centre on cards A, B and C.")
SP("8.0 -> 7.6 s; the music box starts 2.1 s into its file.")

sh("9b", 4.8, "Card B")
pic("Compositor card.")
cam("-")
vhs("V2.")
txt("'IF POPPY ASKS WHERE YOU LIVE, DO NOT ANSWER.'")
au("Music box.",
   VO("vo_whisper_where", 0.6, "-27 dBFS under the music box: phrase 1 hard LEFT, phrase 2 hard RIGHT, phrase 3 hard LEFT, each with a Haas double 22 ms later on the opposite side at -8 dB; only 'friend' at the end is clearly intelligible."))
SP("5.5 -> 4.8 s; new L/R whispers asking the question the card forbids answering.")

sh("9c", 5.0, "Card C")
pic("Compositor card. At +4.6 s a 0.3 s V4 glitch containing SUBLIMINAL S4 at +4.7 s: 2 frames of compositor text 'SHE IS COUNTING' (white on black, mono 56).")
cam("-")
vhs("V2 (V4 for +4.6-4.9 s).")
txt("'IF POPPY IS IN YOUR HOME, DO NOT COUNT WITH HER.'")
au(SFX("sfx_tracking_garble", 4.6, "-22 dBFS, 0.3 s."))
SP("6.0 -> 5.0 s; the glitch and S4 move to +4.6/+4.7 s.")

sh("9d", 4.0, "Card D")
pic("Compositor card on BLACK, no logo, larger text (mono 40), centred.")
cam("-")
vhs("V2.")
txt("'SHE ALWAYS FINDS YOU ON TEN.'")
au("The music box has just died mid-phrase on the first frame. Hiss and hum only.")
SP("5.0 -> 4.0 s. Card E ('THANK YOU FOR WATCHING... PLEASE STOP THE TAPE.') and vo_narr_adv_e are CUT: the show now 'ends' straight after this card.")

# ===== 10 =====
seg("10", "SEE YOU TOMORROW", "The show 'ends': the theme comes back slowed, detuned and beating against itself, Poppy waves goodbye a little too close, the end card cracks, a last subliminal, Poppy closer to the lens than ever, and the tape stops. Blue screen. True silence. It is over.", "Act 3")
sh("10a", 0.6, "Tracking in")
pic("Tracking roll from card D into the title card.")
cam("-")
vhs("V4.")
au(SFX("sfx_static_burst", 0.0, "-24 dBFS, 0.3 s."))
SP("Was 11a.")

sh("10b", 8.0, "Reprise: title")
pic(f"{M('title_card')}, heavily degraded.")
cam("Slow push 1.00 -> 1.05, wobble +-3 px.")
vhs("V3, saturation 0.5.")
au(SFX("mus_reprise", 0.0, "-8 dBFS peak; runs ~17 s across 10b-10c (rebuilt: deeper, doubled 50 cents flat, drifting flatter)."))
txt("Captions in sickly pale yellow, slightly misaligned (use manifest.json line starts): 'Poppy, Poppy, red and bright,' (~+1.0 s), 'in your house, and out of sight.' (~+4.6 s).")
SP("Was 11b; the reprise stem is rebuilt with the same timing.")

sh("10c", 9.0, "Reprise: goodbye")
pic(f"{M('end_card')} with Poppy waving lower-right ({P('poppy_wave_a')} / {P('poppy_wave_b')} alternating every 10 frames = 3 fps, stepped), at 1.7x her 2g size, head near y=200, her body cut off well below the frame edge (much closer than before). Normal Stage 1 Poppy: the friendliness is the wrong part.")
cam("Static.")
vhs("V3.")
txt("Captions: 'Close your eyes and hide away,' (~+0.2 s), 'Poppy found you. Now you stay.' (~+3.8 s).")
au(VO("vo_end_see_you", 7.0, "over the dying last note; the reprise is silent by ~+8.5 s."))
SP("Was 11c.")

sh("10d", 2.0, "Cracked")
pic(f"HARD CUT to {M('end_card_cracked')}. No Poppy.")
cam("Slow push 1.00 -> 1.03.")
vhs("V3.")
au("Hiss only.")
SP("Was 11d (2.5 -> 2.0 s).")

sh("10e", 0.5, "Last subliminal")
pic(f"V4 tracking burst; SUBLIMINAL S5 at +0.2 s: {M('sub_crayon_house')} for 3 frames.")
cam("-")
vhs("V4.")
au(SFX("sfx_tracking_garble", 0.0, "-22 dBFS."))
SP("Was 11e.")

sh("10f", 0.5, "Static")
pic("Static snow.")
cam("-")
vhs("V4.")
au(SFX("sfx_static_burst", 0.0, "-22 dBFS, 0.5 s."))
SP("Was 11f (0.6 -> 0.5 s).")

sh("10g", 3.2, "Closer than ever")
pic(f"{P('poppy_final_close')}: completely still, looking just past the lens. At +2.7 s the picture drops into VCR PAUSE (the two fields offset 1 px and jittering at 15 Hz, two horizontal noise bars) - she is still there, and the two fields are not the same picture: every other field is {P('poppy_final_close_look')}, her pupils dead centre on the lens with no catchlight.")
cam("None.")
vhs("V2 (calm, clean-ish), warm vignette.")
au("Hiss (-40 dBFS), plus:",
   SFX("amb_house_night", 0.0, "very low, -46 dBFS (we are in the bedroom)."))
SP("Was 11g. Unchanged: the calm 'last image' that the false ending pulls away.")

sh("10h", 0.6, "Tape stop")
pic("The picture collapses: vertical squash to a bright horizontal line while rolling.")
cam("-")
vhs("V4.")
au("Program audio pitch-dives to zero over 0.5 s (compositor applies it to everything playing).",
   SFX("sfx_vcr_stop", 0.5, "-12 dBFS."))
SP("Was 11h.")

sh("10i", 3.0, "STOP")
pic("VCR blue screen with OSD 'STOP ■'. Nothing else.")
cam("-")
vhs("none.")
au("Only the tail of sfx_vcr_stop, then DIGITAL SILENCE #2 (no hiss, no hum): long enough that the viewer believes the tape is over.")
note("THE FALSE ENDING. Its setup is planted at 0:13.5 ('BE KIND, PLEASE REWIND!' on the home-viewing card) and in 1b ('PLAY ▶' and the counter).")
SP("Was 11i + 11j (STOP 1.4 s + black 0.7 s) -> STOP held 3.0 s in true silence.")

# ===== 11 =====
seg("11", "THE TAPE DOES NOT STOP", "Nobody touches the VCR. It rewinds by itself (the tape runs backwards, faces flicker past), presses PLAY, and starts again wrong: the colour bars say HIDE AND SEEK, the dark playroom is empty but something stands in the doorway. 'You tried to stop the tape, friend.' Then Poppy is right in front of the lens, level and dead centre, chirping in her happy Act 1 voice while her face slowly stretches: 'I can see you! Is that your room?' She counts again: one, two, three - four never comes. The last image of the tape is her face.", "Act 3")
sh("11a", 2.0, "Rewinding by itself")
pic(f"0.0-0.3 s: the STOP screen's OSD changes by itself to '◀◀ REW' (nobody pressed anything) and the counter starts spinning down. 0.3-1.9 s: reverse-search picture bleeding through: the tape's own earlier frames played BACKWARDS at x7 (from the 10g final close back through the cracked end card and the goodbye, skipping the static and the S5 frames), desaturated 30%, with 2-3 rolling noise bars and the counter OSD spinning down to '0:00:00'. Keep frame-to-frame luminance changes small (under 20% of full scale) - no flashing. SUBLIMINAL S6 at +0.8 s: {M('sub_scrawl_face')} for 1 frame; SUBLIMINAL S7 at +1.8 s: a colour-inverted {P('poppy_scare_final')} for 1 frame (foreshadows scare 3). 1.9-2.0 s: blue screen.")
cam("-")
vhs("V4 on the reverse-search picture; none on the blue screen.")
au(SFX("sfx_rewind", 0.0, "-14 dBFS: the clunk of the mechanism engaging breaks the digital silence, motor whine, squeal, stop clunk at +1.9 s."),
   "Under it, the real programme audio of the ~14 s before the STOP (10c-10h) reversed at x7, band-passed 300-5000 Hz, -24 dBFS: chipmunk-backwards Poppy.")
SP("NEW shot: the self-rewind, with subliminals S6 and S7.")

sh("11b", 0.8, "PLAY by itself")
pic("VCR blue screen with OSD 'PLAY ▶' top-left and the counter '0:00:00' top-right (exactly the 1b layout); nobody pressed it.")
cam("-")
vhs("V1 on the blue.")
au(SFX("sfx_vcr_insert", 0.1, "-16 dBFS, played from 0.5 s into the file: just the mechanism clunk and whirr."),
   "Hiss and hum return on the first frame.")
SP("NEW shot.")

sh("11c", 1.0, "Bars, wrong")
pic("Colour bars as in 1d but dimmed x0.7 and desaturated 40%; the caption strip now reads 'SMV-0417   HIDE AND SEEK   VOL. 4'.")
cam("-")
vhs("V2.")
au(SFX("sfx_bars_tone", 0.0, "-22 dBFS, sagging (varispeed 1.0 -> 0.6 over the shot) and cut on the last frame."))
SP("NEW shot: the restarted tape is a different episode.")

sh("11d", 5.0, "You tried to stop the tape")
pic(f"0.0-0.5 s tracking roll from the bars into {R('playroom_dark')} wide, EMPTY, red grade as in 8b. CHANGE: the four window panes are now solid black - the painted meadow behind them is gone (measure the panes; the window is at about x 230-440, y 100-340 of the 1280x960 image). HIDDEN FIGURE H6: {P('hidden_poppy_stand')} in the open black doorway (door_opening_rect), feet at about (950, 735) of the 1280x960 image, ~260 px tall there (~27% of the frame height), blurred 3 px, luma 5% above the black, eye glints ~9%. Static.")
cam("Static.")
vhs("V4 -> V3 over the first 0.5 s, then V3, red grade.")
au(SFX("sfx_tracking_garble", 0.0, "-22 dBFS."),
   SFX("sfx_preecho_tried", 0.6, "-24 dBFS: the reversed ghost of 'You' swells into the line."),
   VO("vo_wrong_stop", 1.6, "from off-screen (new text)."),
   SFX("amb_sub_breath", 0.5, "-30 dBFS, under 11d-11h."))
SP("Was 10a + 10b (tracking + empty room). New line text, pre-echo, black window panes, hidden figure H6.")

sh("11e", 12.0, "I can see you")
pic(f"DIRECT ADDRESS. Lip flap between {P('poppy_address')} and {P('poppy_address_talk')} over {R('playroom_dark')} cropped 1.6x on the rug area, Gaussian-blurred 8 px, x0.5, red graded. She is simply there, right in front of the lens, in the room 11d showed empty (direct cut, no glitch). (1) FACE STRETCH: the compositor stretches only the part of her sprite below the eye line (y > 190) vertically, 1.00 -> 1.22 over the shot, eased and STEPPED at 8 fps (every 4 frames), so her lower face lengthens while she chats; the eyes never move. (2) The camera pushes 1.00 -> 1.15 toward her eyes, smoothly (the camera moves, she does not). (3) Lip flap per the lip-flap rule, but the lag grows from 3 frames at +0.0 s to 12 frames by +7.5 s (the voice runs ahead of her mouth). (4) From +8.4 s she speaks in the WRONG voice and her mouth stays SHUT ({P('poppy_address')}) to the end. (5) No blink for 12 s.")
cam("Push 1.00 -> 1.15, smooth.")
vhs("V2: she is the sharpest thing in the shot; slight vignette.")
au(SFX("amb_sub_breath", 0.0, "-26 dBFS under the whole shot (rises 4 dB)."),
   SFX("amb_cluster", 6.0, "from silence to -34 dBFS by the end of 11h."),
   VO("vo_addr_1", 0.4, "dry, 3 dB hotter than Act 1: the show's happy voice, talking to YOU."),
   VO("vo_addr_2", 3.0),
   VO("vo_addr_3", 6.0, "much too close."),
   VO("vo_wrong_again", 8.4, "the deep wrong voice coming out of the same, now closed, mouth."))
note("The slow uncomfortable close-up: no cutaways. It pays off card B ('where you live'), card C ('do not count with her') and the reflection in 8o.")
SP("NEW shot (12.0 s): direct address with the stretching face.")

sh("11f", 2.0, "One (the chair)")
pic(f"{R('playroom_dark')} cropped 3.0x on the yellow chair (turned to face the wall), so the chair sits near the centre; the light spill on the cabinet and the shiny floor around it pulled down.")
cam("Static.")
vhs("V3.")
au(VO("vo_hs_1", 0.3, "reused."), "The cluster keeps rising under the count.")
SP("Was 10c.")

sh("11g", 2.0, "Two (the doorway)")
pic(f"{R('playroom_dark')} cropped 2.2x on the open black doorway - EMPTY now (H6 is gone; do not draw it).")
cam("Static.")
vhs("V3.")
au(VO("vo_hs_2", 0.3, "reused, full band (not from a TV)."))
SP("Was 10d. Change between cuts: the doorway figure is gone - she is coming.")

sh("11h", 2.0, "Three (the board)")
pic(f"{R('playroom_dark')} cropped 2.0x on the felt board: FIVE copies of {M('feel_hungry')} pinned in a row at the board's slot spacing, each rotated a different -6..+6 degrees, dim (x0.6, red graded). Every feeling is HUNGRY now.")
cam("Static.")
vhs("V3.")
au(VO("vo_hs_3", 0.3, "reused, full band."))
SP("Was 10e (one hungry face) -> five hungry faces.")

sh("11i", 1.3, "(Four never comes)")
pic(f"{R('playroom_dark')} wide, empty (window panes still black, doorway empty).")
cam("Static.")
vhs("V3.")
au("On the first frame cut the cluster, the sub-bass and the drone DEAD: room tone and hiss only. The viewer expects 'Four' at +0.3 s; it never comes.",
   SFX("sfx_breath_close", 0.4, "only its 3.4-4.6 s inhale, -20 dBFS, 20% LEFT: a single breath drawn in right beside you. The ONE sound before the hit."))
note("Cut 0.7 s early against the 2.0 s rhythm of 11f-11h. No creak this time (scares 1 and 2 used a side noise): the misdirection is the breath and the broken rhythm.")
SP("Was 10f. The creak is replaced by a single close inhale.")

sh("11j", 1.0, "SCARE 3")
pic(f"{P('poppy_scare_final')} alternating with {P('poppy_scare_final_b')} every 4 frames, scaled so the face fills ~90% of the frame height. NOT a red frame.")
cam("Zoom 1.00 -> 1.06, shake +-6 px.")
vhs("V0 CLEAN.")
au(SFX("sfx_stinger_3", 0.0, "peak -1 dBFS, attack < 5 ms (rebuilt)."),
   SFX("sfx_scream", 0.02, "-3 dBFS: Poppy's own voice, torn (rebuilt)."))
SP("Was 10g. Redrawn face; 0.9 -> 1.0 s; 90% of the frame; now the last image of the tape.")

sh("11k", 1.8, "Black")
pic("Black to the end.")
cam("-")
vhs("none.")
au("DIGITAL SILENCE #3 to the end: cut the stinger and scream with a 5 ms fade on the first frame. No tape-stop, no OSD, nothing.")
SP("Was 10h / 11j.")

# ---------------------------------------------------------------------------
# TIMING
# ---------------------------------------------------------------------------
t = 0.0
for s in SHOTS:
    s["start"] = round(t, 3)
    t = round(t + s["dur"], 3)
    s["end"] = t
for g in SEGMENTS:
    g["start"] = g["shots"][0]["start"]
    g["end"] = g["shots"][-1]["end"]
TOTAL = t
SHOT = {s["id"]: s for s in SHOTS}


def tc(x):
    m = int(x // 60)
    return f"{m}:{x - 60 * m:04.1f}"


SCARES = [("SCARE 1", "7o"), ("SCARE 2", "8m"), ("SCARE 3", "11j")]
scare_times = [SHOT[i]["start"] for _, i in SCARES]

# Beats that are defined once here and used by STORYBOARD.md, SCARE_PASS.md and the checks.
# (id, shot, offset in the shot, frames, image)
SUBLIMINALS = [
    ("S1", "6g", 0.40, 2, "`build/art/misc/sub_eyes_dark.png` (redrawn) inside the recorded-over roll"),
    ("S2", "7c", 0.30, 1, "`build/art/misc/sub_teeth.png` (redrawn) inside the whip-pan smear"),
    ("S3", "8i", 0.03, 2, "colour-inverted `build/art/poppy/poppy_scare_closet.png` (redrawn; foreshadows scare 2)"),
    ("S4", "9c", 4.70, 2, "compositor text 'SHE IS COUNTING' (white on black, mono 56)"),
    ("S5", "10e", 0.20, 3, "`build/art/misc/sub_crayon_house.png`"),
    ("S6", "11a", 0.80, 1, "`build/art/misc/sub_scrawl_face.png` (new) inside the self-rewind"),
    ("S7", "11a", 1.80, 1, "colour-inverted `build/art/poppy/poppy_scare_final.png` (redrawn; foreshadows scare 3)"),
]
# (id, shot(s), offset, how big / where, what happens to it)
HIDDEN = [
    ("H1", "6b", 0.0, "`hidden_peek`: one wet eye and petal tips in the black gap of the ajar red door, ~55 px", "Only in 6b; Poppy keeps talking on the rug."),
    ("H2", "7b", 0.0, "`hidden_poppy_stand` in the studio's dark right third behind a road case, ~18% of frame height", "The 7c whip pan lands on its spot: in 7d it is gone."),
    ("H3", "8e", 0.0, "`hidden_poppy_stand` head and shoulders OUTSIDE the moonlit bedroom window, darker than the glass", "8j's pull-back shows the window empty."),
    ("H4", "8f", 0.0, "`hidden_poppy_stand` inside the dark ajar doorway of the hallway, ~29% of frame height", "Gone when the 8g jolt settles (the toy fell from where it stood)."),
    ("H5", "8o", 0.0, "`hidden_poppy_stand` behind the bed in the dark-CRT reflection of your room, ~30% of frame height", "The return, closest: it is in your room. No sting."),
    ("H6", "11d", 0.0, "`hidden_poppy_stand` in the open black doorway of the dark playroom, ~27% of frame height", "11g frames the doorway: empty. Then 11j."),
]
# (shot, offset in the shot, what changes between cuts or inside a glitch)
CHANGES = [
    ("5d", 0.3, "the HUNGRY face is simply there in slot 5 when a 3-frame flicker clears"),
    ("6b", 0.0, "the red back-wall door is ajar (and something is in the gap: H1)"),
    ("7d", 0.0, "the figure behind the road case (H2) is gone after the whip pan"),
    ("7h", 0.0, "the costume's chair is empty"),
    ("8b", 4.2, "glitch 1: Poppy is closer (1.3x); glitch 2 at +7.4 s: closer again (1.45x) AND mirrored, her head on the other shoulder - the big change near the focus"),
    ("8g", 2.1, "the doorway figure (H4) is gone after the jolt"),
    ("8j", 0.0, "the TV is empty (she left the show); on the pull-back at +1.9 s the window figure (H3) is gone too"),
    ("8l", 0.0, "the closet door has opened wider"),
    ("10d", 0.0, "the end card is cracked and Poppy has gone from it"),
    ("11d", 0.5, "the playroom window panes are black: the painted meadow outside is gone"),
    ("11g", 0.0, "the doorway figure (H6) is gone"),
    ("11h", 0.0, "every feelings face on the board is HUNGRY now (five copies)"),
]
FALSE_SCARES = [("False scare 1", "7c", 0.0), ("False scare 2", "8g", 2.0)]
SILENCES = [("8n", "after scare 2"), ("10i", "the false ending: STOP"), ("11k", "after scare 3, to the end")]

# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------
all_paths = set(PATH.values())
used_paths = set(USED)
unused = sorted(all_paths - used_paths)
assert not unused, f"assets never used in a shot: {unused}"
assert 290 <= TOTAL <= 320, TOTAL
gaps = [b - a for a, b in zip(scare_times, scare_times[1:])]
assert all(g >= 45 for g in gaps), gaps
sub_times = sorted(SHOT[sid]["start"] + off for _, sid, off, _, _ in SUBLIMINALS)
assert all(b - a >= 1.0 for a, b in zip(sub_times, sub_times[1:])), sub_times
for _, sid, off, n, _ in SUBLIMINALS:
    assert off + n / 30.0 <= SHOT[sid]["dur"] + 1e-6, sid
assert 4 <= len(HIDDEN) <= 6
for sid, _ in SILENCES + [(x[1], "") for x in FALSE_SCARES] + [(x[1], "") for x in HIDDEN] + [(x[0], "") for x in CHANGES]:
    assert sid in SHOT, sid
SCARE_PASS_ASSETS = [it for it in ROOMS + POPPY + MISC + AUDIO if it.get("sp")]

# ---------------------------------------------------------------------------
# MARKDOWN
# ---------------------------------------------------------------------------
out = []
w = out.append

w("# THE WORLD OF POPPY - Storyboard and shot list\n")
w(f"**Runtime: {TOTAL:.1f} s ({tc(TOTAL)})** at 640x480, 30 fps. {len(SEGMENTS)} segments, {len(SHOTS)} shots. "
  f"Real scares at {', '.join(tc(x) for x in scare_times)} (gaps {', '.join(f'{g:.1f} s' for g in gaps)}).\n")
w("This file and `assets.json` are generated from one source (`gen_storyboard.py`, which also writes `SCARE_PASS.md`), so every "
  "asset path named here is in the manifest and every manifest entry is used here. Edit the generator, not this file. Paths are "
  "relative to `/home/user/BABY/poppy/`. Times are `m:ss.s` from the start of the tape; cue offsets inside a shot are `+seconds` "
  "from the shot's first frame. Shots touched by the scare pass carry a **Scare pass** line; assets touched by it carry "
  "`\"scare_pass\": true` in `assets.json`.\n")

w("## 1. The tape in one paragraph\n")
w("A home-video cassette of *THE WORLD OF POPPY, Volume 4: Counting with Poppy* (© 1995 Sunny Meadow Home Video). It plays like a "
  "cheerful 1990s educational show: a theme song, counting, feelings, friends. Small things are wrong (an eye in a flower, a face "
  "with real human teeth that nobody introduced, a friend scribbled out, something peeking through a door), and Poppy goes still for "
  "too long. Then the tape cuts to camcorder footage someone recorded over it in June 1996: the empty studio (something stands in "
  "its dark corner, then doesn't), the Poppy costume slumped in a dressing room with nobody inside, a memo that is mundane until "
  "line 4. The chair empties; the costume is in your face, and there is a real eye inside it. When the show comes back it is a "
  "different, wrong episode: Poppy, her head lying on its side, wants to play hide and seek and counts over shots of *your* home "
  "while a figure stands at your window and in your hallway, until she reaches ten in your closet. Then the black screen is your "
  "own dark TV, and in its reflection something stands behind your bed. Sunny Meadow's advisory asks you to stop the tape. The show "
  "ends sweetly, the tape stops, silence - and the VCR rewinds itself and presses PLAY. 'You tried to stop the tape, friend.' Poppy "
  "talks to you, happily, while her face stretches. She counts again. Four never comes. The last image is her face.\n")

w("## 2. Timeline at a glance\n")
w("| # | Segment | Start | End | Dur | Act | What happens |")
w("|---|---|---|---|---|---|---|")
for g in SEGMENTS:
    w(f"| {g['id']} | {g['title']} | {tc(g['start'])} | {tc(g['end'])} | {g['end'] - g['start']:.1f} s | {g['act']} | {g['summary']} |")
w(f"| | **TOTAL** | 0:00.0 | {tc(TOTAL)} | **{TOTAL:.1f} s** | | |\n")

w("### Scare map\n")
w("Three real scares, each closer and longer than the last (0.7 / 0.8 / 1.0 s filling 60 / 75 / 90% of the frame), at least 45 s "
  "apart, each set up differently and each landing after exactly one sound; two false scares, each hiding a figure that pays off on "
  "a rewatch; one false ending.\n")
w("| Beat | Time | Shot | Setup | Hit |")
w("|---|---|---|---|---|")
w(f"| False scare 1 | {tc(SHOT['7c']['start'])} | 7c | camcorder drifting in the dark studio; a figure (H2) stands in the dark right third | `sfx_clunk` at -12 dBFS + whip pan to exactly where H2 stood; nothing there |")
w(f"| **SCARE 1** | **{tc(SHOT['7o']['start'])}** | 7o | chair empties; costume at the end of the corridor; lights out (two eye glints); a Shepard riser climbs 13.5 s and is cut dead; 2.0 s rhythm 7l-7m; 7n cut 0.7 s early after a hanger rattle pulls the eye LEFT | redrawn `poppy_scare_costume` (+ `_b` boil) 0.7 s, 60% of frame: a real eye behind the mesh, real teeth through the torn smile; rebuilt `sfx_stinger_1`; camera drops; near-silence |")
w(f"| False scare 2 | {tc(SHOT['8g']['start'] + 2.0)} | 8g | hide-and-seek count in the hallway; a figure (H4) in the left doorway | `sfx_toy_fall` at -12 dBFS from screen-left; after the jolt the doorway is empty |")
w(f"| **SCARE 2** | **{tc(SHOT['8m']['start'])}** | 8m | count slows and deepens; 'Nine.'; close breathing beside you (20% left), cluster + sub-bass, a held breath and a dead cut; door moved between cuts; creak pulls the eye LEFT | redrawn `poppy_scare_closet` (+ `_b`) 0.8 s, 75% of frame; rough whispered 'Ten.' + rebuilt `sfx_stinger_2`; digital silence; then the dark-CRT reflection with H5 behind your bed |")
w(f"| False ending | {tc(SHOT['10i']['start'])} | 10i-11c | the show says goodbye, the tape stops: blue STOP screen in true silence for 3 s | the VCR rewinds by itself (S6, S7 inside), presses PLAY, and the bars read HIDE AND SEEK |")
w(f"| **SCARE 3** | **{tc(SHOT['11j']['start'])}** | 11j | 'You tried to stop the tape'; 12 s direct address with the stretching face and the happy voice; One/Two/Three on a 2.0 s rhythm while the cluster rises; everything cut dead; a single close inhale on the left; 'Four' never comes; cut 0.7 s early | redrawn `poppy_scare_final` (+ `_b`) 1.0 s, 90% of frame; rebuilt `sfx_stinger_3` + `sfx_scream` made from Poppy's own voice; digital silence to the end |")
w("")
w("Subliminal frames (1-3 frames each, hidden inside glitches, at least 1 s apart):\n")
w("| # | Time | Shot | Frames | Image |")
w("|---|---|---|---|---|")
for k, sid, off, n, img in SUBLIMINALS:
    w(f"| {k} | {tc(SHOT[sid]['start'] + off)} | {sid} | {n} | {img} |")
w("")
w("Hidden figures (never acknowledged; in the darkest third or a doorway; blurred 2-4 px; luma only 4-10% different from their "
  "surroundings; they come back closer):\n")
w("| # | Time | Shot | What and where | Then |")
w("|---|---|---|---|---|")
for k, sid, off, what, then in HIDDEN:
    w(f"| {k} | {tc(SHOT[sid]['start'] + off)} | {sid} | {what} | {then} |")
w("")
w("Changes between cuts (most hidden behind a glitch, a jolt or a cut; 8b's second glitch is the large one near the focus that makes "
  "the viewer realise the others happened):\n")
w("| Shot | Time | Change |")
w("|---|---|---|")
for sid, off, what in CHANGES:
    w(f"| {sid} | {tc(SHOT[sid]['start'] + off)} | {what} |")
w("")
w("'Did I see that?' moments (on screen for real, never mentioned): the empty third friend slot (2d), Poppy's eyes shut on 'hide away' (2e), "
  "the 7-second freeze and one-eyed blink (4c), the flower eye turning to the lens (4d), the HUNGRY face appearing un-introduced (5d), the "
  "eye in the door gap (6b), the mouth that keeps flapping after the line (5f), the figure in the studio (7b), the eye glints in the dark "
  "corridor (7j), Poppy moving closer and flipping during glitches (8b), the figure at the window (8e) and in the doorway (8f), Poppy gone "
  "from the TV (8j), the closet door wider (8l), the figure behind your bed in the dark screen (8o), the doorway figure (11d), the face "
  "stretching while she chats (11e).\n")
w(f"Silences: true digital silence only 3 times: "
  + ", ".join(f"{tc(SHOT[sid]['start'])} ({why})" for sid, why in SILENCES)
  + ". After scare 1 the tape goes to near-silence (camcorder hiss at -60 dBFS). Near-silences before scares sit at room tone "
  "(~-42 dBFS) with hiss, and each hit is preceded by exactly one sound (7n hanger, 8l creak, 11i inhale).\n")

w("## 3. Characters (design bible for the Poppy and misc artists)\n")
w("All characters are ORIGINAL. Poppy is a felt mascot, not a doll: no porcelain, no hair, no curly red hair, no blue dress. No existing "
  "franchise characters, logos or companies anywhere. PG-13: no blood, no gore, no self-harm.\n")
w("**POPPY** - the Sunny Meadow mascot, a felt puppet/costume character.\n")
w("- **Head:** a big round felt head in warm cream-peach (#F3D9B8) with visible fibre texture (noise fill plus hundreds of 1-3 px fibre strokes, `ctx.filter='blur(0.6px)'`). About 10% too big for the body.")
w("- **Petal bonnet:** a ring of 9 bright red poppy petals (#D7262B, crinkled tissue-like veins, darker #9E1A1F creases, a small black blotch at each petal's base like a real poppy) framing the whole face like a bonnet; the ring is ~1.5x the face width.")
w("- **Seed-pod nose:** a shiny black button nose shaped like a poppy seed pod: a small black dome with a flat 7-ray star 'crown' stitched on top in dark grey. This is the black seed-pod motif.")
w("- **Eyes (Stage 1):** white felt ovals (~18-20% of head width) with large glossy black button pupils (~25% of eye width) and a catchlight at the SAME pixel in both eyes; her left eye (screen right) 7% bigger and 3 px higher; one pupil offset outward by 0.08 eye-width so she looks 5-10 degrees past the viewer.")
w("- **Cheeks and mouth:** pink felt cheek circles; a wide painted smile line in dark cherry (#6E1020) with corners under the eye centres and flat lower lids (the smile never reaches the eyes). Talking: an open rounded D, maroon inside, a pink felt tongue, no teeth.")
w("- **Body:** a green felt 'stem' turtleneck with the neck 15% too long; bright yellow overalls (#F2C230) with two big white buttons and a red poppy patch on the bib pocket; a leaf-green long-sleeved shirt (#4E9A3A); white cartoon gloves with four fingers, each 1.4x too long; brown felt shoes. Arms reach mid-thigh. Head held tilted 12-20 degrees.")
w("")
w("| Stage | Where | Eyes | Mouth | Head/body |")
w("|---|---|---|---|---|")
w("| 1 normal (always slightly off) | theme, greeting, counting, feelings, friends, final frame | button eyes with matched catchlight, one pupil off | closed smile / open D | 12-degree tilt, held still |")
w("| 2a turned | `poppy_close_stare` (6f) | realistic painted eyes, sclera all round, 14% pupils, no catchlight | corners past the outer eye edges, 18-20 small square teeth | 25-degree tilt; never moves while talking |")
w("| 2b wrong | `poppy_wrong_idle`, `poppy_cover_eyes` (segment 8) | flat glossy BLACK buttons (blown), no catchlight, one 4% higher, a hairline crack (one realistic wet eye peeks through the fingers in cover_eyes) | closed; the smile re-sewn wider with running stitches past the old corners, a glimpse of uneven teeth | neck 1.5x, head tilted 35 degrees while the eyes stay LEVEL, arms to the knees, skin showing through a split neck seam |")
w("| 2c address | `poppy_address`, `poppy_address_talk` (11e) | realistic wet eyes, pinpoint pupils, dead centre into the lens, no blink for 12 s | the Stage 1 painted smile; opening it reveals REAL human teeth and gums | perfectly level and centred; the compositor stretches the lower face 1.00 -> 1.22 while she chats |")
w("| 3 scare | the three `poppy_scare_*` frames (+ `_b` boil frames) | real wet eyes: pinpoint 9% (closet), one real eye behind the costume mesh, blown 90% black pupils (final); veined whites, waterlines | REAL ivory teeth and scalloped gums through torn or stretched felt, 12-38 teeth, the mouth 8-15% past the face outline | underlit 40-50 degrees from below, 55-70% of pixels black, tilted 28-35 degrees with LEVEL eyes, stretched 15-18%, fills 60 / 75 / 90% of the frame |")
w("| hidden | `hidden_poppy_stand`, `hidden_peek` | two pinpoint glints / one wet eye | - | a near-black silhouette (long neck, head on its side, arms to the knees, petal ring) at 4-10% luma over its surroundings |")
w("")
w("**Horror drawing rules (scare pass; from `research/scarier.md`).** Keep the felt cartoon cute and make ONE thing in each frame "
  "too real, too still, too dark or in the wrong place:\n")
w("- **Realism in the wrong place:** one realistic patch per frame, 3-10% of the face - wet human eyes (40-60 iris fibres, a dark "
  "limbal ring, a window specular, a shining 1-2 px lower-lid waterline, 4-8 grey-pink `#C9A3A0` capillaries at 30-50% opacity, never "
  "red pools) or real teeth (ivory `#E8DFC8`, uneven widths, central incisors 1.6x the laterals, grey gaps, bluish translucent "
  "edges, a scalloped `#C98C8C` gum line with a wet highlight; human teeth, never fangs) or skin through worn felt (pores, faint blue "
  "veins at 10-15%; never an opening, never red). Everything else stays flat felt.")
w("- **Underlight and value budget for scare frames:** key light 30-60 degrees below the face, forehead 50-70% darker than the "
  "chin, the nose shadow cast upward; 55-70% of pixels at or below 8% luma and only 5-15% above 60%; light the eyes, the teeth and "
  "one cheek; let one side of the head dissolve into black. Hard terminators (under 3 px) for panic frames, soft gradients for dread.")
w("- **Proportion breaks:** at most 2 per beat in Acts 1-2; stack 4-5 in the scare frames (one eye 3-6% higher, mouth 5-15% past "
  "the face outline, 30-40 teeth with a half-lit second row, neck 1.3-1.8x, head tilted 25-40 degrees while the eyes stay level, "
  "face stretched 10-20%, one face half 4-8% larger).")
w("- **Expression:** a smile with FLAT lower lids; eyes open 120-140% so white shows above the iris; pupils pinpoint (8-12%) or "
  "blown (85-95%); a dead-centre stare with symmetric catchlights; brows raised over a wide smile.")
w("- **Line:** hatch shadows with 200-600 one-pixel strokes at 2-3 angles (Junji Ito) instead of flat fills; draw scare contours "
  "as tremor lines (0.6-1.5 px jitter, overdrawn 2-4 times). Each scare face has a `_b` boil frame with re-seeded hatching that the "
  "compositor alternates at 7.5 fps; the pair's mean luminance must match within 2%.")
w("- **Never:** blood, gore, wounds, self-harm, harm to children, or anything resembling an existing franchise character.")
w("")
w("**The costume** (segment 7): the same Poppy design as an empty mascot costume: hollow head with a dark neck opening, black mesh vision holes instead of button eyes, a deflated body.\n")
w("**Friends:** **Mr. Buttons**, a brown felt teddy bear with mismatched button eyes (one big blue four-hole button, one small black one), a red bow tie and a plaid-patched ear. **Dot**, a round red felt ladybug with black spots, pipe-cleaner antennae with pom-poms and rosy cheeks. **Pip**, a small round sky-blue felt bird with an orange beak and a feather tuft - only ever seen scribbled out.\n")
w("**Sunny Meadow Home Video**: fictional distributor. Logo: a smiling sun rising over two green meadow hills with a rounded wordmark. No real-company resemblance, and no FBI or government warning screens anywhere.\n")

w("## 4. Compositing conventions (for the compositor)\n")
w("- **Base code:** start from `horror/make_video.py` (`Tape` timeline, `vhs()`, `color_bars()`, `card()`, `osd()`, `zoom()`, ffmpeg piping, final normalisation). Output `poppy/the_world_of_poppy.mp4`, 640x480, 30 fps, H.264 + AAC.")
w("- **Anchors:** read `build/rooms/rooms_meta.json` (written by the rooms builder) for Poppy foot anchors, the felt-board slots, the bedroom TV screen quad, the dressing-room seat point and the corridor far-end anchor. Full-body Poppy frames share one canvas (420x640, feet at (210, 628)); close-ups share one canvas (640x480, head centre (320, 210)). Normal on-mark size in `playroom_wide`: ~330 px tall.")
w("- **Grading:** grade cutouts to the room (multiply by a room tint, a slight blur of ~0.6 px, and a soft contact shadow under the feet). Red grade in the dark playroom; green cast in the camcorder footage.")
w("- **Motion:** Poppy never moves smoothly. Mouths flap per the lip-flap rule (3-frame lag, minimum 3 frames per state); waves step at 6 fps (3 fps in the ending); everything else is stillness, or she 'moves between cuts' (or during a 2-frame glitch).")
w("- **Larger art:** scare faces are 800x600, so centre-crop them for their push-ins. `playroom_dark` is 1280x960 and `bedroom_night`/`studio_night` are 960x720 so that crops of 1.4-2.2x stay sharp.")
w("- **Scare frames:** clean (V0), the sharpest and best-lit images in the tape, and cut hard in and hard out.")
w("- **VHS levels** (map onto `vhs()` plus the brief's additions; damage escalates with the story):")
w("")
w("| Level | noise | jitter | chroma shift | dropouts/frame | extras |")
w("|---|---|---|---|---|---|")
w("| V0 CLEAN | 0.015 | 0.2 | 2 | 0 | slight unsharp mask, sat 1.0, lift 0.03 (scare frames only) |")
w("| V1 light (Act 1) | 0.03 | 0.6 | 3 | 0-1 (p 0.15) | sat 0.85, warm tint, rightward-only chroma bleed, edge ringing |")
w("| V2 medium | 0.05 | 1.0 | 4 | 0-2 | top-edge flagging (12 rows, up to 15 px), +-1 px frame wobble, sat 0.75 |")
w("| V3 heavy | 0.08 | 1.6 | 6 | 2-5 | intermittent tracking band (0.3), flagging 20 rows, sat 0.65, occasional 1-row vertical hops |")
w("| V4 wrecked | 0.14 | 3.0 | 9 | 4-8 | tracking 1.0, rainbow hue sweep, vertical roll with a 25 px black bar, audio garble |")
w("| EP (camcorder) | x1.6 | - | - | +2 | luma blur k=5, chroma blur 25, green tint, autofocus hunting, exposure pumping (gain 0.7-1.0, 0.3 Hz noise) |")
w("")
w("- **Dropouts:** horizontal dashes 1-2 rows high, 10-120 px long, filled from row y-1 with a bright comet tail to the right; fired in clustered bursts.")
w("- **Camcorder OSD (segment 7):** drawn at 1/3 resolution and upscaled with nearest-neighbour, with a 2 px black shadow. '● REC' top-left blinking at 1 Hz; 'SP' and a battery icon top-right; 'JUN 14 1996' bottom-left; a clock bottom-right reading '11:52 PM' from 7a, '11:53 PM' from 7f and '11:54 PM' from 7l. No brand names.")
w("- **VCR OSD:** DejaVu Sans Mono Bold 30, white with a 2 px black shadow: 'PLAY ▶' and the counter in 1b; 'STOP ■' in 10i; '◀◀ REW' with the counter spinning down to '0:00:00' in 11a; 'PLAY ▶' and '0:00:00' again in 11b.")
w("- **Advisory cards (segment 9):** made in code (`card()`). Deep navy #101A4A background, `sm_logo` top-centre, white DejaVu Sans Mono Bold 26, lines left-aligned inside a centred block (so the cursor starts each new line at the text's left edge), text types on at ~25 characters per second with a soft teleprinter tick per character (-34 dBFS). Card D is on black with mono 40 and no logo.")
w("- **Captions (theme and reprise):** yellow #FFE14D DejaVu Sans Bold 24 with a black outline, centred at y~440. The reprise uses a sickly pale yellow, offset 2-3 px from centre.")
w("- **Audio mix:** (as mixed; these levels supersede the per-shot dBFS numbers below, which were written 5 dB hotter) dialogue, narrator and theme peak around -11 dBFS (crew whispers -13, reprise -13); bumpers -14; the show's music bed -14 peak in the gaps (about -27 dB RMS, so Act 1 sounds like a bouncy kids' show and its hard cuts at 4c and 6e are a 14-15 dB drop), ducked 8 dB under every line; the wrong bed -17; the music box -15 (its death at 9d is a 13 dB drop); ambiences -34 to -40 and room tone -42 as RMS targets; hiss -43 RMS (2-8 kHz band) plus 60 Hz hum -52 under everything except the digital silences; false scares -12; the misdirection cues (7n hanger, 8l creak) -13 dBFS, hard-panned (12-13 dB louder on their side), and the 11i inhale -20 dBFS at 20% left; teleprinter ticks -34; stingers saturated to be dense, attack under 5 ms: scare 1 about -6 dB, scare 2 about -5 dB and scare 3 about -3 dB RMS over 400 ms, 12-15 dB above the loudest dialogue and 24-32 dB above the previous 3 s. Bandwidth 80 Hz-8 kHz (100 Hz-6 kHz in segment 7). Add wow/flutter at 0.2% in Act 1, rising to 1-3% in segments 8-11, a garble on every tracking burst, and audio dropouts (-20 dB, 20-200 ms) synced to the picture's dropout clusters. Normalise the final mix to a -1 dBFS peak WITHOUT squashing the stingers (no limiter on the scare frames).")
w("- **Every audio file is normalised by the audio builder** (voice to -3 dBFS, the rest to -1 dBFS). The dBFS numbers in the shot list are the peak levels to mix them at.")
w("- **Scare-pass picture rules:** (1) HIDDEN FIGURES (table in section 2) are composited like any cutout but blurred 2-4 px, graded to "
  "the room, and kept within 4-10% luma of what is behind them (darker than a lit window, a little brighter than a black doorway); "
  "nothing on screen ever reacts to them, and they are never in the shot named as their 'Then'. (2) BOIL: each scare face alternates "
  "with its `_b` frame every 4 frames. (3) FACE STRETCH (11e): scale only the rows below the eye line, stepped at 8 fps. (4) "
  "SUBLIMINALS: 1-3 frames, at least 1 s apart, hard in and out. (5) PHOTOSENSITIVITY: no full-frame flashing or strobing faster "
  "than 3 per second, no saturated-red full-frame flicker; the rewind (11a) keeps frame-to-frame luminance changes under 20% of full "
  "scale; boil and VCR-pause field swaps must not change mean luminance by more than 2%. (6) The dark-CRT reflection (8o) has NO "
  "VHS damage at all.")
w("- **Scare-pass sound rules:** exactly one sound before each hit (7n hanger, 8l creak, 11i inhale); the Shepard riser and every "
  "swell are cut DEAD (no fade, on a zero crossing); close breathing and the 11i inhale sit 20% left of centre, dry; the whispers "
  "(9b) alternate hard left / hard right per phrase with a 22 ms Haas double on the opposite side at -8 dB; sub-bass (`amb_sub_breath`) "
  "at -32 to -24 dBFS under long holds; the tone cluster (`amb_cluster`) swells 8-15 s and is cut dead; digital silence exactly 3 "
  "times (section 2); the reversed programme audio in 11a is made from the mix itself.\n")

w("## 5. Voice presets and script (for the audio builder)\n")
w("| Preset | Speaker | Delivery | Recipe |")
w("|---|---|---|---|")
for k, (spk, deliv, recipe) in VOICE_SPECS.items():
    w(f"| `{k}` | {spk} | {deliv} | {recipe} |")
w("")
w("The hide-and-seek count `vo_hs_1`..`vo_hs_9` uses `poppy_wrong` with the resample factor stepping "
  + ", ".join(f"{r:.2f}" for r in HS_RESAMPLE)
  + " (lower and slower each time), and the octave-down double rising from -18 dB to -6 dB; 8 and 9 are completely dry and close. `vo_hs_10` is the whisper.\n")
w("Every line, in tape order. 'Max' is the longest the trimmed line may run and still fit its slot. Write the real durations into `build/audio/manifest.json`.\n")
w("| File | Voice | Exact text | Max | Cue time(s) (shot) |")
w("|---|---|---|---|---|")
seen = set()
for s in SHOTS:
    for p in s["refs"]:
        if p.startswith("build/audio/vo_") and p not in seen:
            seen.add(p)
            a = AUD[os.path.basename(p)[:-4]]
            when = ", ".join(f"{tc(x['start'] + off)} ({x['id']})" for x in SHOTS for off, q in x["cues"] if q == p)
            w(f"| `{p}` | {a['voice']} | “{a['text']}” | {a['seconds']:.1f} s | {when} |")
w("")
w("Song lyrics (inside the music files):\n")
w(f"- `build/audio/mus_theme.wav`: {AUD['mus_theme']['text']}")
w(f"- `build/audio/mus_reprise.wav`: {AUD['mus_reprise']['text']}\n")

w("## 6. Shot list\n")
w("Each shot gives its timecode, duration, picture (with exact asset files), camera move, VHS level, audio cues and on-screen text.\n")
for g in SEGMENTS:
    w(f"### Segment {g['id']} - {g['title']} ({tc(g['start'])}-{tc(g['end'])}, {g['end'] - g['start']:.1f} s, {g['act']})\n")
    w(f"*{g['summary']}*\n")
    for s in g["shots"]:
        w(f"#### {s['id']} · {tc(s['start'])}-{tc(s['end'])} ({s['dur']:.1f} s) · {s['title']}\n")
        w(f"- **Picture:** {s['picture']}")
        if s["camera"] and s["camera"] != "-":
            w(f"- **Camera:** {s['camera']}")
        w(f"- **VHS:** {s['vhs']}")
        if s["audio"]:
            if len(s["audio"]) == 1:
                w(f"- **Audio:** {s['audio'][0]}")
            else:
                w("- **Audio:**")
                for a in s["audio"]:
                    w(f"  - {a}")
        if s["text"]:
            w(f"- **On-screen text:** {s['text']}")
        if s["notes"]:
            w(f"- **Notes:** {s['notes']}")
        if s["sp"]:
            w(f"- **Scare pass:** {s['sp']}")
        w("")

w("## 7. Asset index\n")
w("Every file the builders produce, and every shot that uses it. The full specs are in `assets.json`.\n")


def index_table(title, items, prefix):
    w(f"### {title} ({len(items)})\n")
    w("| File | Size | Used in |")
    w("|---|---|---|")
    for it in items:
        p = PATH[it["name"]]
        size = it.get("size")
        size_s = f"{size[0]}x{size[1]}" if size else "-"
        if "transparent" in it:
            size_s += " alpha" if it["transparent"] else " opaque"
        w(f"| `{p}` | {size_s} | {', '.join(USED[p])} |")
    w("")


index_table("Blender rooms", ROOMS, "rooms")
index_table("Poppy art", POPPY, "poppy")
index_table("Misc art", MISC, "misc")
w(f"### Audio ({len(AUDIO)})\n")
w("| File | Kind | Target length | Used in |")
w("|---|---|---|---|")
for a in AUDIO:
    p = PATH[a["name"]]
    w(f"| `{p}` | {a['kind']} | {a['seconds']:.1f} s | {', '.join(USED[p])} |")
w("")
w("Not files (the compositor makes these in code): tape hiss, 60 Hz hum, colour bars (and the wrong bars of 11c), OSDs, the home-viewing card, advisory cards A-D, bumper "
  "titles, captions, the 'SHE IS COUNTING' subliminal, the negatives of `poppy_scare_closet` and `poppy_scare_final`, the dark-CRT reflection "
  "of 8o (from `bedroom_night` + `crt_glass`), the black window panes of 11d, the face stretch of 11e, the reverse-search picture and "
  "reversed audio of 11a, the tape-start and tape-stop pitch ramps, and all VHS damage.\n")

w("## 8. Builder hand-off checklist\n")
w(f"- **Rooms (Blender, bpy 5.2, Cycles CPU, 32-64 samples, denoising on):** {len(ROOMS)} renders, three of them variants of the same .blend (`playroom_wide` / `playroom_wide_ajar` / `playroom_dark`, and `closet_door` / `closet_door_open`). Write `build/rooms/rooms_meta.json` with the anchors listed in each room's notes. Leave the empty spaces described; never put a figure in a room.")
w(f"- **Poppy art (canvas):** {len(POPPY)} files. Keep identical registration inside each family (full-body, close-up) so frames can be swapped without jumping. Make a contact sheet and check the Stage 1 frames look friendly at a glance and only slightly off, and that the scare frames are the sharpest, most finished images.")
w(f"- **Misc art (canvas):** {len(MISC)} files. Felt texture for the show props; real-paper texture for the memo and crayon drawing. Text inside the art must be spelled exactly as given.")
w(f"- **Audio (numpy + espeak-ng):** {len(AUDIO)} files at 44.1 kHz mono 16-bit, plus `build/audio/manifest.json` with each file's duration and the `lyrics` start times for `mus_theme` and `mus_reprise`.")
w("- **Compositor:** follow sections 2, 4 and 6 (and `SCARE_PASS.md` for what changed). Total runtime must stay within 290-320 s; if a voice line comes back longer than its slot, extend the shot's hold and trim the following static/black shot rather than moving the scare beats.\n")

w("## 9. Machine-readable shot list\n")
w("One shot per line: id, segment, start (s), duration (s), title, asset files, and audio cues as [absolute start in s, file]. Mix levels and processing for each cue are in section 6.\n")
w("```json")
w("[")
lines = []
for s in SHOTS:
    cues = [[round(s["start"] + off, 3), q] for off, q in sorted(s["cues"])]
    lines.append("  " + json.dumps(dict(id=s["id"], seg=s["seg"], start=s["start"], dur=s["dur"], title=s["title"],
                                        assets=s["refs"], cues=cues), ensure_ascii=False))
w(",\n".join(lines))
w("]")
w("```")

md = "\n".join(out) + "\n"

# ---------------------------------------------------------------------------
# JSON MANIFEST
# ---------------------------------------------------------------------------
manifest = OrderedDict()
manifest["rooms"] = [OrderedDict(file=PATH[r["name"]], description=r["description"], camera=r["camera"],
                                 lighting=r["lighting"], notes=r["notes"], size=r["size"],
                                 used_in=USED[PATH[r["name"]]]) for r in ROOMS]
def flag(entry, item):
    """Entries touched by the scare pass: "scare_pass": true plus whether the file is new or must be re-made."""
    if item.get("sp"):
        entry["scare_pass"] = True
        entry["scare_pass_status"] = item["sp"]
    return entry


manifest["poppy_art"] = [flag(OrderedDict(file=PATH[p["name"]], description=p["description"], transparent=p["transparent"],
                                          size=p["size"], used_in=USED[PATH[p["name"]]]), p) for p in POPPY]
manifest["misc_art"] = [flag(OrderedDict(file=PATH[m["name"]], description=m["description"], transparent=m["transparent"],
                                         size=m["size"], used_in=USED[PATH[m["name"]]]), m) for m in MISC]
manifest["audio"] = [flag(OrderedDict(file=PATH[a["name"]], kind=a["kind"], description=a["description"], text=a["text"],
                                      voice=a["voice"], target_seconds=a["seconds"], used_in=USED[PATH[a["name"]]]), a)
                     for a in AUDIO]

os.makedirs(BASE, exist_ok=True)
with open(os.path.join(BASE, "STORYBOARD.md"), "w") as f:
    f.write(md)
with open(os.path.join(BASE, "assets.json"), "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")

# ---------------------------------------------------------------------------
# SCARE_PASS.md - the change list for the builders and the compositor
# ---------------------------------------------------------------------------
# The cut before the scare pass (segments 7-11; segments 1-6 kept their timings).
OLD_TOTAL, OLD_NSHOTS = 300.0, 87
OLD_SHOTS = {"7a": (121.0, 0.8), "7b": (121.8, 7.2), "7c": (129.0, 1.0), "7d": (130.0, 3.5), "7e": (133.5, 7.0),
             "7f": (140.5, 6.0), "7g": (146.5, 10.0), "7h": (156.5, 5.0), "7i": (161.5, 3.5), "7j": (165.0, 0.5),
             "7k": (165.5, 2.0), "7l": (167.5, 2.0), "7m": (169.5, 2.0), "7n": (171.5, 1.3), "7o": (172.8, 0.8),
             "7p": (173.6, 0.5), "7q": (174.1, 1.5), "8a": (175.6, 0.9), "8b": (176.5, 9.5), "8c": (186.0, 2.5),
             "8d": (188.5, 2.5), "8e": (191.0, 2.5), "8f": (193.5, 3.0), "8g": (196.5, 3.5), "8h": (200.0, 3.0),
             "8i": (203.0, 3.5), "8j": (206.5, 4.0), "8k": (210.5, 8.0), "8l": (218.5, 3.5), "8m": (222.0, 0.7),
             "8n": (222.7, 1.5), "9a": (224.2, 8.0), "9b": (232.2, 5.5), "9c": (237.7, 6.0), "9d": (243.7, 5.0),
             "9e": (248.7, 6.5), "10a": (255.2, 0.5), "10b": (255.7, 7.5), "10c": (263.2, 2.0), "10d": (265.2, 2.0),
             "10e": (267.2, 2.0), "10f": (269.2, 1.3), "10g": (270.5, 0.9), "10h": (271.4, 1.5), "11a": (272.9, 0.6),
             "11b": (273.5, 8.0), "11c": (281.5, 9.0), "11d": (290.5, 2.5), "11e": (293.0, 0.5), "11f": (293.5, 0.6),
             "11g": (294.1, 3.2), "11h": (297.3, 0.6), "11i": (297.9, 1.4), "11j": (299.3, 0.7)}
OLD_SCARES = {"SCARE 1": 172.8, "SCARE 2": 222.0, "SCARE 3": 270.5}
# new shot id -> old shot id(s) it is made from ("" = new shot)
FROM_OLD = {"8o": "", "10a": "11a", "10b": "11b", "10c": "11c", "10d": "11d", "10e": "11e", "10f": "11f", "10g": "11g",
            "10h": "11h", "10i": "11i+11j", "11a": "", "11b": "", "11c": "", "11d": "10a+10b", "11e": "", "11f": "10c",
            "11g": "10d", "11h": "10e", "11i": "10f", "11j": "10g", "11k": "10h"}
REMOVED = [("9e", "Card E ('THANK YOU FOR WATCHING ... PLEASE STOP THE TAPE.') and its narration `vo_narr_adv_e`: the show now "
                  "'ends' straight after card D, and the reprise says goodbye instead.")]

DIAGNOSIS = [
    "**The scare faces read as cartoons (the #1 weakness).** The closet face (3:42) is a moon-faced emoji grin with 22 identical "
    "square teeth, front-lit, symmetrical and bright; the costume face (2:52) is a pale panda mask with round mesh eyes and a "
    "four-line grin; the final face (4:30) is a red 'screaming oval' that fills the whole frame with saturated red. All three are "
    "mid-to-bright overall, so there is no darkness for them to come out of; nothing in them is realistic; their proportions are "
    "drawn, not broken.",
    "**Nothing hides in the dark.** The studio, hallway, bedroom and closet are well built and dark, but none of them holds "
    "anything to find. After the closet door moves (3:38) there is no 'did I see that?' left in the tape.",
    "**The ending lets the viewer go.** The last scare is at 4:30; then the tape winds down gently (reprise, a cute close-up, "
    "STOP, silence). The viewer relaxes and the tape agrees with them.",
    "**Poppy never talks to the viewer about the viewer.** 'You look ready to play!' (0:46) is the only hint that she sees you.",
    "**The 31 s of advisory cards are the longest low-stimulus stretch.** They work as a breather, but nothing threatens under them.",
    "**Every scare is set up the same way** (drone swell, near-silence, a side noise, a stinger); there is no rising-tension device, "
    "no sense of presence (breath, whispers) and the scream is a generic synthetic 'aaa'.",
    "**What already works, and stays:** Act 1's convincing cheerfulness and its seeds; the 7-second freeze (4c); the camcorder "
    "segment's pacing and the empty chair; the count over YOUR home and the TV she leaves; the closet door that moved; the 6f "
    "stare; the crayon-house subliminal; the VCR-pause look fields; the three digital silences.",
]

# (shot, offset, beat, why it is scarier) - the new beat sheet, in tape order
BEATS = [
    ("5e", 0.0, "HUNGRY insert", "the card's eyes and teeth are now real (wet eyes, ivory teeth and gums in felt): the first gross-up"),
    ("6b", 0.0, "H1 - the eye in the door gap", "while Poppy talks on the rug, a second face peeks through the ajar door"),
    ("6g", 0.4, "S1", "redrawn underlit eyes in the recorded-over roll"),
    ("7b", 0.0, "H2 - figure in the studio", "a silhouette in the dark right third; the 7c whip pan lands on its empty spot"),
    ("7h", 0.0, "Shepard riser starts", "an endlessly rising tone under the empty chair, corridor and lights-out"),
    ("7j", 0.0, "eye glints in the dark", "two pinpoints where the empty costume's head was"),
    ("7m", 1.0, "riser cut dead", "near-silence; one hanger rattle on the left"),
    ("7o", 0.0, "SCARE 1", "underlit costume head, a real eye pressed to the mesh, real teeth through the torn smile, boiling hatching"),
    ("8b", 7.4, "the flip", "in a 2-frame glitch Poppy is closer AND mirrored - the big change near the focus"),
    ("8e", 0.0, "H3 - at your window", "a silhouette outside the moonlit bedroom window while she counts on your TV"),
    ("8f", 0.0, "H4 - in your hallway", "a figure in the dark doorway, gone after the toy falls"),
    ("8k", 2.4, "breathing beside you", "dry close breaths 20% left, cluster and sub-bass, then a held breath and a dead cut"),
    ("8m", 0.0, "SCARE 2", "the face squeezed through the closet gap: wide-set real eyes, pinpoint pupils, 34 real teeth, worn-through skin"),
    ("8o", 0.0, "H5 - your screen", "the black is your dark TV glass; in its reflection something stands behind your bed. No sting"),
    ("9b", 0.6, "whispers", "'where do you live?' from the left, then the right, under 'IF POPPY ASKS WHERE YOU LIVE, DO NOT ANSWER.'"),
    ("10g", 0.0, "the gentle ending", "the cute close-up and the look fields, as before"),
    ("10i", 0.0, "FALSE ENDING", "STOP, blue screen, 3 s of true silence: it is over"),
    ("11a", 0.0, "it rewinds by itself", "'◀◀ REW' with nobody touching it; the tape runs backwards; S6 and S7 flash past"),
    ("11b", 0.0, "PLAY by itself", "counter 0:00:00; the bars now say HIDE AND SEEK"),
    ("11d", 0.0, "'You tried to stop the tape, friend.'", "the empty dark playroom; black window panes; H6 in the doorway"),
    ("11e", 0.0, "direct address", "12 s, no cutaways: the happy Act 1 voice says 'I can see you! Is that your room?' while her lower face stretches 22% and real teeth show when she talks"),
    ("11f", 0.0, "the count again", "One (chair), Two (the doorway - empty now), Three (five HUNGRY faces)"),
    ("11i", 0.4, "one breath", "everything cut dead; a single inhale right beside you; 'Four' never comes"),
    ("11j", 0.0, "SCARE 3", "the closest face: blown black pupils, 38 real teeth past the face outline, tilted head with level eyes; Poppy's own voice torn into a scream; the last image of the tape"),
]

SP_GLOBAL_EDIT = [
    "**Runtime:** `TOTAL = 300.0` -> `TOTAL = @TOTAL@` (NFRAMES follows). `load_shots()` reads the new section-9 JSON unchanged in "
    "format; every shot still chains frame-exactly.",
    "**Shot functions:** re-tag the existing segment-10/11 functions to their new ids (table 5.2), add functions for the new shots "
    "8o, 11a, 11b, 11c and 11e, delete 9e, and update every shot listed in 5.3. Segments 7-11 all move, so all their chunks re-render; "
    "in segments 1-6 only the chunks holding 4c (audio only), 5c-5g (redrawn `feel_hungry`), 6b (H1) and 6g (S1) change - the "
    "chunk hashes pick up the changed asset bytes automatically.",
    "**New helpers:** `hidden(base, rel, foot, height_px, blur, luma_delta, glint)` for the six hidden figures (grade to the room, "
    "blur 2-4 px, then scale the figure's luma toward its local background so the difference is 4-10%; window silhouettes go "
    "DARKER); `boil(ctx, a, b)` (alternate every 4 frames); `stretch_below(sprite, y_eye, k)` for 11e (rows below the eye line "
    "resampled vertically by k, stepped at 8 fps); `crt_reflection(lt)` for 8o; `rewind_frame(ctx)` for 11a (calls `render_frame()` "
    "for earlier frames, x7 backwards, plus rolling noise bars - deterministic because every frame is seeded by its number); "
    "`window_black()` for the 11d-11i playroom panes; `hungry_board()` with five copies for 11h.",
    "**Scare frames:** each is 800x600; scale so the face fills 60% (7o), 75% (8m) and 90% (11j) of the frame height, V0 clean, "
    "boil frames alternating every 4 frames, hard cut in and out. Do NOT boost contrast on the new art (the old 10g 'extra "
    "contrast' note is gone): its value budget is drawn in.",
    "**Mix:** new layers per section 4 'Scare-pass sound rules'. Pans: `sfx_breath_close` 20% left (both uses), `vo_whisper_where` "
    "phrases L/R/L with a 22 ms Haas double at -8 dB, misdirection cues as before. The riser (7h) is cut dead at 7m +1.0 s; the "
    "cluster, drone, sub-bass and breath in 8k are cut dead together at +7.0 s; in 11i everything but room tone and hiss is cut on "
    "the first frame. Digital zero exactly at 8n, 10i (after the vcr_stop tail) and 11k. The 11a reversed audio = the mix's own "
    "@RW@ s, reversed and resampled x7, band-passed 300-5000 Hz, -24 dBFS, under `sfx_rewind`. `mus_music_box` starts 2.1 s "
    "into its file at 9a so it still dies on 9d's first frame.",
]


def write_scare_pass():
    o = []
    v = o.append
    n_new_art = sum(1 for it in POPPY + MISC if it.get("sp") == "new")
    n_chg_art = sum(1 for it in POPPY + MISC if it.get("sp") == "changed")
    n_new_aud = sum(1 for it in AUDIO if it.get("sp") == "new")
    n_chg_aud = sum(1 for it in AUDIO if it.get("sp") == "changed")
    v("# THE WORLD OF POPPY - Scare pass ('make it 1000x scarier')\n")
    v("Written by `gen_storyboard.py` together with `STORYBOARD.md` and `assets.json`, so every timecode and file here matches the "
      "storyboard, which stays the single source of truth. This file lists only what CHANGES and how to build it. Craft rules come "
      "from `research/scarier.md` (the YouTube drawing tutorial could not be fetched; YouTube is blocked here).\n")
    v(f"**At a glance:** runtime {OLD_TOTAL:.1f} s -> **{TOTAL:.1f} s** ({tc(TOTAL)}), {OLD_NSHOTS} -> {len(SHOTS)} shots. "
      f"Real scares {', '.join(tc(t) for t in OLD_SCARES.values())} -> **{', '.join(tc(t) for t in scare_times)}** "
      f"(gaps {', '.join(f'{g:.1f} s' for g in gaps)}), plus a false ending at {tc(SHOT['10i']['start'])}. "
      f"ART: {n_new_art} new + {n_chg_art} redrawn. ROOMS: none. AUDIO: {n_new_aud} new + {n_chg_aud} changed stems, 1 removed. "
      f"{len(HIDDEN)} hidden figures, {len(SUBLIMINALS)} subliminals, {len(CHANGES)} changes between cuts. Hard limits unchanged: "
      "original characters only; no blood, gore, wounds, self-harm or harm to children; no full-frame flashing faster than 3 per "
      "second and no saturated-red full-frame flicker.\n")

    v("## 0. What was weak in the current cut\n")
    v("Watched as 2-second contact sheets plus full-size stills of every scare and Poppy close-up.\n")
    for k, d in enumerate(DIAGNOSIS, 1):
        v(f"{k}. {d}")
    v("")

    v("## 1. The new shape\n")
    v("Act 1 stays a convincing, cheerful show (it buys the contrast) with three quiet additions. Act 2 adds a figure in the dark "
      "studio, a Shepard riser and a scare face that is no longer a cartoon. Act 3 now has a figure at your window, one in your "
      "hallway and one behind your bed in the reflection of your own dark screen; then the show ends sweetly, the tape stops, and "
      "the VCR rewinds and plays by itself. Poppy talks to you in her happy voice while her face stretches, counts again, and the "
      "last image of the tape is her face.\n")
    v("| Time | Shot | Beat | Why it is scarier |")
    v("|---|---|---|---|")
    for sid, off, beat, why in BEATS:
        bold = beat.startswith("SCARE") or beat.startswith("FALSE")
        b = f"**{beat}**" if bold else beat
        v(f"| {tc(SHOT[sid]['start'] + off)} | {sid} | {b} | {why} |")
    v("")
    v("Escalation: Act 1 has one hidden face and one gross-up; Act 2 one hidden figure, one riser, scare 1 at 60% of the frame; "
      "Act 3 four hidden figures getting closer (window, hallway, behind your bed, the doorway), breathing beside you, scare 2 at 75%, "
      "whispers, a false ending, direct address, scare 3 at 90%. Full tables of scares, subliminals, hidden figures and changes "
      "between cuts: `STORYBOARD.md` section 2.\n")

    v("## 2. ART\n")
    v("Canvas builders: Poppy art via `draw/poppy.js` + `draw/scenes.js` (`Poppy.ASSETS[name]` presets) rendered by "
      "`NODE_PATH=$(npm root -g) node poppy/draw/render_poppy.cjs <names>` (manifest list `poppy_art`); misc art via "
      "`draw/misc/*.js` rendered by `draw/misc/render_misc.cjs` (`misc_art`). New entries need new presets (the renderers report "
      "'no preset' until then). Every entry below has `\"scare_pass\": true` and `\"scare_pass_status\": \"new\"|\"changed\"` in "
      "`assets.json`; 'changed' files must be re-drawn and overwritten (render them by name). Keep registration identical inside "
      "each family (full-body 420x640 feet at (210, 628); close-up 640x480 head centre (320, 210)). Use `--out DIR` for review "
      "passes and LOOK at every result before overwriting `build/`.\n")
    v("| # | File | Size | Alpha | Status | Used in |")
    v("|---|---|---|---|---|---|")
    arts = [it for it in POPPY + MISC if it.get("sp")]
    for k, it in enumerate(arts, 1):
        p = PATH[it["name"]]
        v(f"| A{k} | `{p}` | {it['size'][0]}x{it['size'][1]} | {'transparent' if it['transparent'] else 'opaque'} | "
          f"{it['sp']} | {', '.join(USED[p])} |")
    v("")
    for k, it in enumerate(arts, 1):
        p = PATH[it["name"]]
        v(f"**A{k}. `{p}`** ({it['size'][0]}x{it['size'][1]}, {'transparent' if it['transparent'] else 'opaque'}, "
          f"{it['sp']}). {it['description']}\n")
    v("**Art acceptance checks.** (1) Contact-sheet every new and redrawn file and LOOK at it; a scare face must not read as a "
      "cartoon or emoji at thumbnail size. (2) Value budget, measured on the scare faces: "
      "`python3 -c \"from PIL import Image; import numpy as np; a=np.asarray(Image.open(F).convert('L'))/255; print((a<=0.08).mean(), (a>0.6).mean())\"` "
      "must print 0.55-0.70 and 0.05-0.15. (3) Each `_b` boil frame differs only in hatching and contour, and its mean luminance is "
      "within 2% of its partner. (4) Composite `hidden_poppy_stand` at 64 px on black: long neck, head on its side and a petal ring "
      "must read. (5) No red anywhere that could read as blood; human teeth, never fangs; nothing resembling a franchise mascot.\n")

    v("## 3. ROOMS\n")
    v("**None. No Blender work is needed.** Everything new happens in rooms that already exist:\n")
    v("- The dark-CRT reflection (8o) is made by the compositor from `build/rooms/bedroom_night.png`: crop x 330-960, y 60-532 (the "
      "bed, the window and the wall, without the TV), mirror it, grade it cold and dark, barrel-distort it and lay `crt_glass.png` "
      "over it. A prototype of exactly this read convincingly as a bedroom reflected in a dark TV.")
    v("- The black window panes of 11d-11i are a compositor fill on `playroom_dark.png` (the window is at about x 230-440, y 100-340 "
      "of the 1280x960 image).")
    v("- The hidden figures are composited cutouts (`hidden_poppy_stand`, `hidden_peek`) at the coordinates in section 5. The rooms "
      "rule 'never put a figure in a room' still holds for the renders themselves.\n")

    v("## 4. AUDIO\n")
    v("Audio builder: `make_audio.py` renders every `audio` entry of `assets.json`. Mono 44.1 kHz 16-bit; voice normalised to "
      "-3 dBFS, the rest to -1 dBFS; it updates `build/audio/manifest.json` (and `<name>.env.json` mouth envelopes for every voice "
      "stem; `vo_whisper_where` also gets `phrases`). Note: `make_audio.py` keeps its own `VOICE_LINES` table (text, preset, options) "
      "and `GENERATORS` table - add the new stems there and change `vo_wrong_stop`'s text there too. Existing .wav files are skipped "
      "unless named, so re-render every 'changed' stem explicitly: `python3 poppy/make_audio.py "
      + " ".join(a["name"] for a in AUDIO if a.get("sp") == "changed") + "` (then the two pre-echo stems, which are cut from "
      "`vo_wrong_welcome` and the new `vo_wrong_stop`).\n")
    v("| File | Kind | Length | Status | Used in | What |")
    v("|---|---|---|---|---|---|")
    def first_sentence(t):
        return re.split(r"(?<=[a-z0-9)'])\. (?=[A-Z])", t, maxsplit=1)[0].rstrip(".") + "."

    for a in AUDIO:
        if a.get("sp"):
            p = PATH[a["name"]]
            d = a["description"]
            what = first_sentence(d[d.index("SCARE PASS"):]) if "SCARE PASS" in d else first_sentence(d)
            if a["kind"] == "voice":
                what = f"“{a['text']}” - " + what
            v(f"| `{p}` | {a['kind']} | {a['seconds']:.1f} s | {a['sp']} | {', '.join(USED[p])} | {what} |")
    v("| `build/audio/vo_narr_adv_e.wav` | voice | - | REMOVED | - | card E is cut; the file may stay on disk but is no longer in the manifest. |")
    v("")
    v("**New and changed voice lines (exact text):**\n")
    v("| File | Preset | Exact text | Max | Cue |")
    v("|---|---|---|---|---|")
    for a in AUDIO:
        if a.get("sp") and a["kind"] == "voice":
            p = PATH[a["name"]]
            when = ", ".join(f"{tc(x['start'] + off)} ({x['id']})" for x in SHOTS for off, q in x["cues"] if q == p)
            v(f"| `{p}` | {a['voice']} | “{a['text']}” | {a['seconds']:.1f} s | {when} |")
    v("")
    v("**Full stem specs:**\n")
    for a in AUDIO:
        if a.get("sp"):
            v(f"- **`{PATH[a['name']]}`** ({a['kind']}, {a['seconds']:.1f} s, {a['sp']}). {a['description']}")
    v("")
    v("Re-used unchanged but re-timed or re-processed by the compositor: `mus_music_box` (starts 2.1 s into the file), "
      "`vo_wrong_welcome` / `vo_wrong_game` (+0.4 s), `amb_drone` (no longer in 7h; cut with the cluster at 8k +7.0 s), "
      "`sfx_door_creak` (8l only), `sfx_vcr_insert` (11b, from 0.5 s), `sfx_bars_tone` (11c, sagging), `vo_hs_1..3` (11f-11h), "
      "`vo_wrong_again` (11e, from her closed mouth).\n")

    v("## 5. EDIT (make_video.py)\n")
    v("### 5.1 Global\n")
    g = list(SP_GLOBAL_EDIT)
    rw0, rw1 = SHOT["10i"]["start"] - 14.0, SHOT["10i"]["start"]
    g = [x.replace("@TOTAL@", f"{TOTAL:.1f}").replace("@RW@", f"{rw0:.1f}-{rw1:.1f}") for x in g]
    for x in g:
        v(f"- {x}")
    v("")
    v("### 5.2 Old -> new shot map (segments 7-11)\n")
    v("Segments 1-6 keep their ids and timings. In 7-9 ids are kept but times move. Old segment 11 (the reprise ending) is now "
      "segment 10; old segment 10 (count again) is folded into the new segment 11 after the false ending.\n")
    v("| New shot | New time | Dur | From old | Old time | Old dur | Title |")
    v("|---|---|---|---|---|---|---|")
    for x in SHOTS:
        if int(x["seg"]) < 7:
            continue
        src = FROM_OLD.get(x["id"], x["id"])
        if src == "":
            old_t, old_d, src_s = "-", "-", "NEW"
        else:
            ids = src.split("+")
            old_t = tc(OLD_SHOTS[ids[0]][0])
            old_d = "+".join(f"{OLD_SHOTS[i][1]:.1f}" for i in ids)
            src_s = src
        v(f"| {x['id']} | {tc(x['start'])} | {x['dur']:.1f} | {src_s} | {old_t} | {old_d} | {x['title']} |")
    for sid, why in REMOVED:
        v(f"| - | - | - | {sid} (REMOVED) | {tc(OLD_SHOTS[sid][0])} | {OLD_SHOTS[sid][1]:.1f} | {why} |")
    v("")
    v("### 5.3 Per-shot changes\n")
    v("Every shot the scare pass touches, with its NEW timecode, what changed, and its full new description (identical to "
      "`STORYBOARD.md` section 6). Audio offsets are `+seconds` from the shot's first frame.\n")
    for g2 in SEGMENTS:
        rows = [x for x in g2["shots"] if x["sp"]]
        if not rows:
            continue
        v(f"**Segment {g2['id']} - {g2['title']} ({tc(g2['start'])}-{tc(g2['end'])})**\n")
        for x in rows:
            v(f"- **{x['id']}** {tc(x['start'])}-{tc(x['end'])} ({x['dur']:.1f} s) *{x['title']}*: {x['sp']}")
            v(f"  - Picture: {x['picture']}")
            if x["camera"] and x["camera"] != "-":
                v(f"  - Camera: {x['camera']}")
            v(f"  - VHS: {x['vhs']}")
            if x["audio"]:
                v("  - Audio: " + " / ".join(x["audio"]))
            if x["text"]:
                v(f"  - On-screen text: {x['text']}")
        v("")

    v("## 6. Build order and checks\n")
    v("1. **In parallel:** the art (section 2; scare faces and their `_b` frames first, then `poppy_address`/`_talk`, the hidden "
      "cutouts, `feel_hungry`, the subliminals, `crt_glass`) and the audio (section 4; the pre-echo stems after `vo_wrong_welcome` "
      "and the new `vo_wrong_stop`).")
    v("2. **Compositor:** update `make_video.py` (section 5), then `--still` the key frames and LOOK at them: "
      + ", ".join(f"{tc(SHOT[sid]['start'] + off + 0.1)}" for sid, off in
                  [("6b", 0.5), ("7b", 3.0), ("7o", 0.2), ("8b", 8.0), ("8e", 1.0), ("8f", 1.0), ("8m", 0.2), ("8o", 4.0),
                   ("11a", 1.0), ("11d", 3.0), ("11e", 1.0), ("11e", 11.0), ("11h", 1.0), ("11j", 0.2)]) + ".")
    v("3. **Render** (`python3 poppy/make_video.py`, restartable), then `--sheets` and `--audio-report`.")
    v(f"4. **Checks:** runtime {TOTAL:.1f} s; scares at {', '.join(tc(t) for t in scare_times)}; the three scare frames are the "
      "sharpest images in the tape and do not read as cartoons; every hidden figure is findable on a still but easy to miss at "
      "speed; subliminals at least 1 s apart; no flashing over 3 per second and no red full-frame flicker; digital zero only at "
      + ", ".join(tc(SHOT[sid]['start']) for sid, _ in SILENCES)
      + "; the mix 0.5 s before each hit is at room-tone level with exactly one cue in it; stingers 24-32 dB above the previous 3 s.\n")
    return "\n".join(o) + "\n"


with open(os.path.join(BASE, "SCARE_PASS.md"), "w") as f:
    f.write(write_scare_pass())

# ---------------------------------------------------------------------------
# Cross-check the written files (independent of the in-memory tracking)
# ---------------------------------------------------------------------------
md_paths = set(re.findall(r"build/(?:rooms|art/poppy|art/misc|audio)/[A-Za-z0-9_]+\.(?:png|wav)", md))
js = json.load(open(os.path.join(BASE, "assets.json")))
js_paths = {e["file"] for k in ("rooms", "poppy_art", "misc_art", "audio") for e in js[k]}
assert md_paths == js_paths, (sorted(md_paths - js_paths), sorted(js_paths - md_paths))

print(f"TOTAL {TOTAL:.1f}s  segments {len(SEGMENTS)}  shots {len(SHOTS)}  -> {BASE}")
print(f"scare pass: art new {sum(1 for x in POPPY + MISC if x.get('sp') == 'new')}, art changed "
      f"{sum(1 for x in POPPY + MISC if x.get('sp') == 'changed')}, audio new {sum(1 for x in AUDIO if x.get('sp') == 'new')}, "
      f"audio changed {sum(1 for x in AUDIO if x.get('sp') == 'changed')}, rooms {sum(1 for x in ROOMS if x.get('sp'))}")
print(f"rooms {len(ROOMS)}  poppy {len(POPPY)}  misc {len(MISC)}  audio {len(AUDIO)} "
      f"(voice {sum(a['kind']=='voice' for a in AUDIO)}, music {sum(a['kind']=='music' for a in AUDIO)}, "
      f"sfx {sum(a['kind']=='sfx' for a in AUDIO)}, ambience {sum(a['kind']=='ambience' for a in AUDIO)})")
for (n, i), t0 in zip(SCARES, scare_times):
    print(n, tc(t0), i)
print("gaps", gaps)
for g in SEGMENTS:
    print(f"  seg {g['id']:>2} {tc(g['start'])}-{tc(g['end'])} {g['title']}")
