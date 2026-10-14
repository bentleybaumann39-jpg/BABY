"""
Builds and renders the Blender rooms for OPPOSITE DAY (adapted from poppy/render_rooms.py).

Run with the bpy module (Blender 5.x as a Python module), headless:

    VENV/bin/python opposite/render_rooms.py                      # every room whose PNG is missing
    VENV/bin/python opposite/render_rooms.py turnaround_wide night # only these (always re-rendered)
    VENV/bin/python opposite/render_rooms.py --force               # every room, overwriting
    VENV/bin/python opposite/render_rooms.py --list                # room names and status

Each room renders in its own child process (so no single process runs long, and a crash or a
container restart loses at most one room). Room names are the manifest file stems
(opposite/assets.json "rooms"):

    turnaround_wide  turnaround_wide_late  turnaround_frame  turnaround_frame_dim
    turnaround_portrait  turnaround_night  crt_set_b  turnaround_reverse     (THE TURNAROUND ROOM)
    mirror_studio  frame_mirror_night        (the same set: mirrored copy / mirror pane at night)
    behind_set                               (the backs of Set B's flats)
    livingroom                               (the viewer's living room, seen from the TV)

THE TURNAROUND ROOM is one scene description. Set A (the left half, x < 0) is built once by
Turnaround.half(); Set B is the SAME builder run again under a root empty with scale x = -1 and the
other palette, so the room is exactly mirror-symmetric (Set B's clock numerals come out mirror-written
and run anticlockwise for free, and all procedural grime is mirrored too). Shared centre pieces (floor,
ceiling, the gold frame) use |x| texture coordinates so their noise is symmetric as well.
The only asymmetries are the ones the story asks for: the Chair For You (+ blanket), Set A's empty
brass nail and Set B's paler rectangle.

Variants that must cut against each other keep geometry and camera identical:
    turnaround_wide_late   = turnaround_wide with only the chairs/blanket changed; after rendering it is
                             composited onto turnaround_wide outside the chair regions, so every other
                             pixel is identical.
    turnaround_frame_dim   = turnaround_frame's camera with the studio light switched off.
Writes:
    opposite/build/rooms/<room>.png          the renders (sizes from the manifest)
    opposite/build/rooms/rooms_meta.json     pixel anchors for the compositor
    opposite/build/rooms/blend/<room>.blend  the scene files (cameras and light rigs saved with them)

Environment knobs: OPP_SAMPLES (default 48), OPP_PREVIEW=1 (quarter-cost test renders written to
build/rooms/preview/ instead of the real files).
"""

import json
import math
import os
import sys
import time

import bpy  # noqa: E402  (must come before bmesh/mathutils)
import bmesh
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "rooms")
BLEND_DIR = os.path.join(OUT, "blend")
SAMPLES = int(os.environ.get("OPP_SAMPLES", "48"))
PREVIEW = os.environ.get("OPP_PREVIEW", "") == "1"
if PREVIEW:
    OUT_IMG = os.path.join(OUT, "preview")
else:
    OUT_IMG = OUT
META_PATH = os.path.join(OUT_IMG, "rooms_meta.json")


# ============================================================== colour utils
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h, a=1.0):
    """'#RRGGBB' (sRGB) -> linear RGBA tuple for Blender."""
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (_lin(r), _lin(g), _lin(b), a)


def srgb01(h):
    """'#RRGGBB' -> sRGB floats 0-1 (for numpy-painted textures)."""
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def kelvin(k):
    """Approximate blackbody colour (Tanner Helland fit) as linear RGB."""
    t = k / 100.0
    r = 255.0 if t <= 66 else 329.698727446 * ((t - 60) ** -0.1332047592)
    if t <= 66:
        g = 99.4708025861 * math.log(t) - 161.1195681661
    else:
        g = 288.1221695283 * ((t - 60) ** -0.0755148492)
    if t >= 66:
        b = 255.0
    elif t <= 19:
        b = 0.0
    else:
        b = 138.5177312231 * math.log(t - 10) - 305.0447927307
    return tuple(_lin(min(255.0, max(0.0, v)) / 255.0) for v in (r, g, b))


def tint(rgb, other, amount):
    return tuple(a * (1 - amount) + b * amount for a, b in zip(rgb, other))


# ============================================================== scene setup
def reset(w=640, h=480, samples=None, look="AgX - Medium High Contrast", exposure=0.0,
          world=(0.0, 0.0, 0.0), world_strength=1.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    n = samples or SAMPLES
    if PREVIEW:
        n = max(8, n // 3)
    s.cycles.samples = n
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.02
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 6
    s.cycles.diffuse_bounces = 3
    s.cycles.glossy_bounces = 3
    s.cycles.transmission_bounces = 4
    s.cycles.transparent_max_bounces = 8
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 1.0
    s.cycles.sample_clamp_indirect = 8.0
    s.cycles.seed = 11
    s.render.resolution_x = w
    s.render.resolution_y = h
    s.render.resolution_percentage = 50 if PREVIEW else 100
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGB"
    s.render.image_settings.color_depth = "8"
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = look
    s.view_settings.exposure = exposure
    wd = bpy.data.worlds.new("World")
    bg = wd.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*world[:3], 1.0)
    bg.inputs["Strength"].default_value = world_strength
    s.world = wd
    return s


def scene():
    return bpy.context.scene


# ============================================================== node builder
class NB:
    """Small helper for wiring shader node graphs."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.n = self.nt.nodes
        self.l = self.nt.links

    def node(self, kind, **props):
        nd = self.n.new(kind)
        for k, v in props.items():
            setattr(nd, k, v)
        return nd

    def set(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.l.new(v, sock)
        else:
            sock.default_value = v

    def coords(self, space="object"):
        """'world', 'object', 'sym' (world position with |x|, so procedural noise is mirror-symmetric
        about the set's centre line) or a bpy Object (coordinates in that object's space: the root
        empty of a set half, so Set B's x = -1 copy gets the mirrored texture)."""
        if space == "world":
            return self.node("ShaderNodeNewGeometry").outputs["Position"]
        if space == "sym":
            p = self.sep(self.node("ShaderNodeNewGeometry").outputs["Position"])
            return self.comb(self.math("ABSOLUTE", p[0]), p[1], p[2])
        if isinstance(space, bpy.types.Object):
            tc = self.node("ShaderNodeTexCoord")
            tc.object = space
            return tc.outputs["Object"]
        return self.node("ShaderNodeTexCoord").outputs["Object"]

    def rgb(self, color):
        nd = self.node("ShaderNodeRGB")
        nd.outputs[0].default_value = color
        return nd.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.55, distortion=0.0):
        nd = self.node("ShaderNodeTexNoise")
        self.set(nd.inputs["Vector"], vec)
        nd.inputs["Scale"].default_value = scale
        nd.inputs["Detail"].default_value = detail
        nd.inputs["Roughness"].default_value = rough
        nd.inputs["Distortion"].default_value = distortion
        return nd.outputs[0]

    def maprange(self, v, fmin, fmax, tmin, tmax, clamp=True):
        nd = self.node("ShaderNodeMapRange")
        nd.clamp = clamp
        self.set(nd.inputs[0], v)
        nd.inputs[1].default_value = fmin
        nd.inputs[2].default_value = fmax
        nd.inputs[3].default_value = tmin
        nd.inputs[4].default_value = tmax
        return nd.outputs[0]

    def math(self, op, a, b=0.0, clamp=False):
        nd = self.node("ShaderNodeMath", operation=op)
        nd.use_clamp = clamp
        self.set(nd.inputs[0], a)
        self.set(nd.inputs[1], b)
        return nd.outputs[0]

    def scale(self, col, fac):
        nd = self.node("ShaderNodeVectorMath", operation="SCALE")
        self.set(nd.inputs[0], col)
        self.set(nd.inputs[3], fac)
        return nd.outputs[0]

    def mix(self, a, b, fac, blend="MIX"):
        nd = self.node("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        self.set(nd.inputs[0], fac)
        self.set(nd.inputs[6], a)
        self.set(nd.inputs[7], b)
        return nd.outputs[2]

    def sep(self, vec):
        nd = self.node("ShaderNodeSeparateXYZ")
        self.set(nd.inputs[0], vec)
        return nd.outputs

    def comb(self, x, y, z=0.0):
        nd = self.node("ShaderNodeCombineXYZ")
        self.set(nd.inputs[0], x)
        self.set(nd.inputs[1], y)
        self.set(nd.inputs[2], z)
        return nd.outputs[0]

    def mapping(self, vec, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
        nd = self.node("ShaderNodeMapping")
        self.set(nd.inputs["Vector"], vec)
        nd.inputs["Location"].default_value = loc
        nd.inputs["Rotation"].default_value = rot
        nd.inputs["Scale"].default_value = scale
        return nd.outputs[0]

    def ramp(self, fac, stops, interp="LINEAR"):
        nd = self.node("ShaderNodeValToRGB")
        self.set(nd.inputs[0], fac)
        cr = nd.color_ramp
        cr.interpolation = interp
        els = cr.elements
        while len(els) < len(stops):
            els.new(0.5)
        for el, (pos, col) in zip(els, stops):
            el.position = pos
            el.color = col
        return nd.outputs[0]


def make_mat(name, color=(0.5, 0.5, 0.5, 1), rough=0.7, *, var=0.08, var_scale=4.0,
             hue_var=0.0, grime=0.0, grime_scale=2.0, streak=0.0, floor_dirt=0.0,
             bump=0.0, bump_scale=80.0, bump_detail=2.0, sheen=0.0, spec=0.5,
             metallic=0.0, coat=0.0, emission=0.0, emit_color=None, space="object",
             base=None, normal_fn=None, rough_var=0.0):
    """Principled material with colour variation, grime and bump options.

    base(nb, vec) may return a colour socket to use instead of `color`.
    """
    mat = bpy.data.materials.new(name)
    b = NB(mat)
    bsdf = b.n["Principled BSDF"]
    vec = b.coords(space)
    col = base(b, vec) if base else b.rgb(color)
    if var:
        f = b.maprange(b.noise(vec, var_scale, 3.0), 0.3, 0.7, 1.0 - var, 1.0 + var)
        col = b.scale(col, f)
    if hue_var:
        hs = b.node("ShaderNodeHueSaturation")
        b.set(hs.inputs["Hue"], b.maprange(b.noise(vec, var_scale * 0.7 + 1.3, 2.0), 0.3, 0.7,
                                             0.5 - hue_var, 0.5 + hue_var))
        b.set(hs.inputs["Color"], col)
        col = hs.outputs[0]
    dark = None
    if grime:
        g = b.maprange(b.noise(vec, grime_scale, 8.0, 0.62), 0.45, 0.72, 1.0, 1.0 - grime)
        dark = g
    wsp = "world" if space == "object" else space
    if streak:
        v2 = b.mapping(b.coords(wsp), scale=(7.0, 7.0, 0.45))
        st = b.maprange(b.noise(v2, 1.0, 6.0, 0.6), 0.48, 0.78, 1.0, 1.0 - streak)
        dark = st if dark is None else b.math("MULTIPLY", dark, st)
    if floor_dirt:
        z = b.sep(b.coords(wsp))[2]
        fd = b.maprange(z, 0.0, 0.45, 1.0 - floor_dirt, 1.0)
        dark = fd if dark is None else b.math("MULTIPLY", dark, fd)
    if dark is not None:
        col = b.scale(col, dark)
    b.set(bsdf.inputs["Base Color"], col)
    if rough_var:
        b.set(bsdf.inputs["Roughness"],
              b.maprange(b.noise(vec, var_scale * 1.7, 3.0), 0.3, 0.7, rough - rough_var,
                         rough + rough_var))
    else:
        bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    bsdf.inputs["Metallic"].default_value = metallic
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Roughness"].default_value = 0.5
    if emission:
        bsdf.inputs["Emission Color"].default_value = emit_color or color
        bsdf.inputs["Emission Strength"].default_value = emission
    nrm = None
    if normal_fn:
        nrm = normal_fn(b, vec)
    elif bump:
        bp = b.node("ShaderNodeBump")
        bp.inputs["Strength"].default_value = bump
        bp.inputs["Distance"].default_value = 0.02
        b.set(bp.inputs["Height"], b.noise(vec, bump_scale, bump_detail))
        nrm = bp.outputs[0]
    if nrm is not None:
        b.set(bsdf.inputs["Normal"], nrm)
    return mat


def emit_mat(name, color, strength):
    mat = bpy.data.materials.new(name)
    b = NB(mat)
    b.n.remove(b.n["Principled BSDF"])
    em = b.node("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    b.l.new(em.outputs[0], b.n["Material Output"].inputs["Surface"])
    return mat


def void_mat():
    """Absolutely black: no reflection, no emission (open doorways, gaps)."""
    return emit_mat("Void", (0, 0, 0, 1), 0.0)


def image_from_array(name, arr):
    """arr: HxWx3 float sRGB 0-1, row 0 = TOP. Returns an in-memory bpy image."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.pack()
    return img


def planar_image_base(img, axes, u0, u1, v0, v1, flip_u=False):
    """Base-colour function mapping an image onto world axes (e.g. 'x','z')."""
    idx = {"x": 0, "y": 1, "z": 2}

    def fn(b, vec):
        p = b.sep(b.coords("world"))
        a, c = p[idx[axes[0]]], p[idx[axes[1]]]
        u = b.math("MULTIPLY", b.math("SUBTRACT", a, u0), 1.0 / (u1 - u0))
        if flip_u:
            u = b.math("SUBTRACT", 1.0, u)
        v = b.math("MULTIPLY", b.math("SUBTRACT", c, v0), 1.0 / (v1 - v0))
        tex = b.node("ShaderNodeTexImage", interpolation="Cubic", extension="EXTEND")
        tex.image = img
        b.set(tex.inputs[0], b.comb(u, v, 0.0))
        return tex.outputs[0]

    return fn


def wood_base(light, dark, scale=3.0, axis="X", distortion=7.0):
    def fn(b, vec):
        w = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction=axis)
        b.set(w.inputs["Vector"], vec)
        w.inputs["Scale"].default_value = scale
        w.inputs["Distortion"].default_value = distortion
        w.inputs["Detail"].default_value = 3.0
        w.inputs["Detail Scale"].default_value = 1.5
        return b.mix(b.rgb(light), b.rgb(dark), b.maprange(w.outputs[1], 0.2, 1.0, 0.0, 0.8))

    return fn


def streak_wood(light, dark, along="x"):
    """Fine wood streaks running along one local axis (for sticks and frames)."""
    sc = {"x": (1.5, 40.0, 40.0), "y": (40.0, 1.5, 40.0), "z": (40.0, 40.0, 1.5)}[along]

    def fn(b, vec):
        n = b.noise(b.mapping(vec, scale=sc), 1.0, 5.0, 0.6, 1.5)
        return b.mix(b.rgb(light), b.rgb(dark), b.maprange(n, 0.35, 0.75, 0.0, 1.0))

    return fn


def planks_base(light, dark, gap, plank_w=0.13, plank_l=1.3, axes=("x", "y")):
    """Floorboards: brick pattern of long planks with grain."""
    idx = {"x": 0, "y": 1, "z": 2}

    def fn(b, vec):
        p = b.sep(b.coords("world"))
        uv = b.comb(p[idx[axes[0]]], p[idx[axes[1]]], 0.0)
        grain = wood_base(light, dark, scale=1.6, axis="X", distortion=5.0)(b, b.mapping(uv, scale=(0.35, 6.0, 1.0)))
        alt = b.scale(grain, 0.86)
        br = b.node("ShaderNodeTexBrick", offset=0.37, offset_frequency=1)
        b.set(br.inputs["Vector"], uv)
        b.set(br.inputs["Color1"], grain)
        b.set(br.inputs["Color2"], alt)
        br.inputs["Mortar"].default_value = gap
        br.inputs["Scale"].default_value = 1.0
        br.inputs["Mortar Size"].default_value = 0.004
        br.inputs["Mortar Smooth"].default_value = 0.3
        br.inputs["Bias"].default_value = 0.0
        br.inputs["Brick Width"].default_value = plank_l
        br.inputs["Row Height"].default_value = plank_w
        return br.outputs[0]

    return fn


# ============================================================== geometry
def _link(obj):
    scene().collection.objects.link(obj)
    return obj


def _finish(name, bm, mat, loc, rot, parent, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    mats = mat if isinstance(mat, (list, tuple)) else [mat]
    for m in mats:
        if m is not None:
            me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    if parent is not None:
        obj.parent = parent
    return obj


def _bevel(obj, width, segs=3):
    if width <= 0:
        return obj
    m = obj.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segs
    m.limit_method = "ANGLE"
    m.harden_normals = True
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def box(name, center, size, mat, rot=(0, 0, 0), bevel=0.0, segs=3, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    return _bevel(_finish(name, bm, mat, center, rot, parent), bevel, segs)


def box2(name, lo, hi, mat, bevel=0.0, parent=None):
    """Axis-aligned box from min corner to max corner."""
    c = [(a + b) / 2 for a, b in zip(lo, hi)]
    s = [abs(b - a) for a, b in zip(lo, hi)]
    return box(name, c, s, mat, bevel=bevel, parent=parent)


def cyl(name, center, radius, depth, mat, rot=(0, 0, 0), verts=32, radius2=None,
        bevel=0.0, parent=None, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth)
    obj = _finish(name, bm, mat, center, rot, parent, smooth=smooth)
    if smooth:
        # keep caps flat: split normals by angle via a light bevel or modifier
        m = obj.modifiers.new("Smooth", "EDGE_SPLIT")
        m.split_angle = math.radians(40)
    return _bevel(obj, bevel, 2)


def sphere(name, center, radius, mat, scale=(1, 1, 1), rot=(0, 0, 0), segs=32, rings=16,
           parent=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return _finish(name, bm, mat, center, rot, parent, smooth=True)


def torus(name, center, major, minor, mat, rot=(0, 0, 0), seg=40, ring=14, parent=None):
    bm = bmesh.new()
    grid = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            t = 2 * math.pi * j / ring
            r = major + minor * math.cos(t)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(t))))
        grid.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((grid[i][j], grid[(i + 1) % seg][j], grid[(i + 1) % seg][(j + 1) % ring],
                          grid[i][(j + 1) % ring]))
    return _finish(name, bm, mat, center, rot, parent, smooth=True)


def prism(name, pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, bevel=0.0):
    """Extrude a 2D polygon (in local XY) by `depth` along local +Z."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _bevel(_finish(name, bm, mat, loc, rot, parent), bevel, 2)


def tube(name, pts, radius, mat, parent=None, res=12):
    """Smooth cable through points."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.resolution_u = res
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(mat)
    obj = _link(bpy.data.objects.new(name, cu))
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    e = _link(bpy.data.objects.new(name, None))
    e.location = loc
    e.rotation_euler = [math.radians(a) for a in rot]
    if parent is not None:
        e.parent = parent
    return e


def wall_with_holes(name, axis, plane, a0, a1, z0, z1, thick, holes, mat, bevel=0.0):
    """A wall in the plane (axis='x': wall spans x, sits at y=plane, thickness toward +y;
    axis='y': spans y, sits at x=plane, thickness toward `thick` sign).
    holes: list of (a_lo, a_hi, z_lo, z_hi). Returns list of boxes."""
    cuts = sorted({a0, a1, *[h[0] for h in holes], *[h[1] for h in holes]})
    parts = []
    for i in range(len(cuts) - 1):
        lo, hi = cuts[i], cuts[i + 1]
        if hi - lo < 1e-6:
            continue
        mid = (lo + hi) / 2
        zs = [(z0, z1)]
        for h in holes:
            if h[0] <= mid <= h[1]:
                nz = []
                for s0, s1 in zs:
                    if h[3] <= s0 or h[2] >= s1:
                        nz.append((s0, s1))
                        continue
                    if h[2] > s0:
                        nz.append((s0, h[2]))
                    if h[3] < s1:
                        nz.append((h[3], s1))
                zs = nz
        for j, (s0, s1) in enumerate(zs):
            if s1 - s0 < 1e-6:
                continue
            if axis == "x":
                parts.append(box2(f"{name}_{i}_{j}", (lo, plane, s0), (hi, plane + thick, s1), mat, bevel))
            else:
                parts.append(box2(f"{name}_{i}_{j}", (plane, lo, s0), (plane + thick, hi, s1), mat, bevel))
    return parts


# ============================================================== lights & camera
def look_at(obj, target, roll=0.0):
    d = Vector(target) - Vector(obj.location)
    q = d.to_track_quat("-Z", "Y")
    if roll:
        q = q @ Quaternion((0, 0, 1), math.radians(roll))
    obj.rotation_euler = q.to_euler()


def light(name, kind, loc, energy, color=(1, 1, 1), target=None, rot=None, size=0.1,
          size_y=None, spot=60.0, blend=0.3, shape="RECTANGLE", spread=None, cam_visible=False):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color[:3]
    if kind == "AREA":
        d.shape = shape
        d.size = size
        if size_y is not None:
            d.size_y = size_y
        if spread is not None:
            d.spread = math.radians(spread)
    elif kind in ("POINT", "SPOT"):
        d.shadow_soft_size = size
    if kind == "SPOT":
        d.spot_size = math.radians(spot)
        d.spot_blend = blend
    if kind == "SUN":
        d.angle = math.radians(size)
    o = _link(bpy.data.objects.new(name, d))
    o.location = loc
    if target is not None:
        look_at(o, target)
    elif rot is not None:
        o.rotation_euler = [math.radians(a) for a in rot]
    o.visible_camera = cam_visible
    return o


def camera(loc, target=None, rot=None, lens=32.0, shift_x=0.0, shift_y=0.0, roll=0.0, name="Cam"):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36.0
    data.sensor_fit = "HORIZONTAL"
    data.shift_x = shift_x
    data.shift_y = shift_y
    data.clip_start = 0.05
    data.clip_end = 200.0
    cam = _link(bpy.data.objects.new(name, data))
    cam.location = loc
    if target is not None:
        look_at(cam, target, roll)
    else:
        cam.rotation_euler = [math.radians(a) for a in rot]
    scene().camera = cam
    return cam


def proj(p):
    """World point -> pixel (x, y) in the final render (top-left origin)."""
    s = scene()
    bpy.context.view_layer.update()
    co = world_to_camera_view(s, s.camera, Vector(p))
    w, h = s.render.resolution_x, s.render.resolution_y
    return [round(co.x * w, 1), round((1.0 - co.y) * h, 1)]


def proj_obj_bbox(obj):
    """Pixel bounding rectangle [x0, y0, x1, y1] of an object (and its children)."""
    bpy.context.view_layer.update()
    pts = []
    stack = [obj]
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type == "MESH":
            ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for v in ev.data.vertices:
                pts.append(proj(o.matrix_world @ v.co))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]


def px_per_m_at(p):
    """Approximate vertical pixels per metre for an upright object standing at p."""
    a = proj(p)
    b = proj((p[0], p[1], p[2] + 1.0))
    return round(abs(a[1] - b[1]), 1)


# ============================================================== render & meta
def render(name):
    os.makedirs(OUT_IMG, exist_ok=True)
    path = os.path.join(OUT_IMG, name + ".png")
    s = scene()
    s.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"rendered {path} in {time.time() - t:.1f}s", flush=True)
    return path


def save_blend(name):
    if PREVIEW:
        return
    os.makedirs(BLEND_DIR, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_DIR, name + ".blend"),
                                compress=True, check_existing=False)


def write_meta(room, data):
    """Merge one room's anchors into rooms_meta.json (file-locked: rooms may render in parallel)."""
    import fcntl
    os.makedirs(OUT_IMG, exist_ok=True)
    s = scene()
    data = dict(data)
    data["size"] = [s.render.resolution_x, s.render.resolution_y]
    with open(META_PATH + ".lock", "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        meta = {}
        if os.path.exists(META_PATH):
            try:
                with open(META_PATH) as f:
                    meta = json.load(f)
            except ValueError:
                meta = {}
        meta[room] = data
        meta["_note"] = ("Pixel coordinates in each room image's own resolution, origin top-left, x right, "
                         "y down. Quads are listed clockwise from top-left (tl, tr, br, bl). Written by "
                         "opposite/render_rooms.py from the Blender cameras.")
        tmp = META_PATH + ".tmp"
        with open(tmp, "w") as f:
            json.dump(meta, f, indent=1, sort_keys=True)
        os.replace(tmp, META_PATH)


def load_png(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1, :, :3].copy()


def save_png(path, arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new("post", w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


# ============================================================== painted textures
def _cov(d, px):
    """Anti-aliased coverage from a signed distance (negative = inside)."""
    return np.clip(0.5 - d / px, 0.0, 1.0)[..., None]


def _grid(w_m, h_m, x0, z0, ppm):
    W, H = int(round(w_m * ppm)), int(round(h_m * ppm))
    xs = x0 + (np.arange(W) + 0.5) / ppm
    zs = z0 + h_m - (np.arange(H) + 0.5) / ppm
    return np.meshgrid(xs, zs)


def _smooth_noise(shape, cell, seed, amp):
    rng = np.random.default_rng(seed)
    H, W = shape
    gh, gw = H // cell + 3, W // cell + 3
    g = rng.normal(0, 1, (gh, gw)).astype(np.float32)
    yi = np.arange(H) / cell
    xi = np.arange(W) / cell
    y0 = yi.astype(int)
    x0 = xi.astype(int)
    fy = (yi - y0)[:, None]
    fx = (xi - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy)
    fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]
    b = g[y0][:, x0 + 1]
    c = g[y0 + 1][:, x0]
    d = g[y0 + 1][:, x0 + 1]
    return amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)

def _brick(b, uv, width, height, mortar, offset=0.5, freq=2, c1=(1, 1, 1, 1), c2=(0.93, 0.93, 0.93, 1),
           cm=(0.7, 0.7, 0.7, 1), smooth=0.4):
    br = b.node("ShaderNodeTexBrick", offset=offset, offset_frequency=freq)
    b.set(br.inputs["Vector"], uv)
    b.set(br.inputs["Color1"], c1)
    b.set(br.inputs["Color2"], c2)
    b.set(br.inputs["Mortar"], cm)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Mortar Smooth"].default_value = smooth
    br.inputs["Bias"].default_value = 0.0
    br.inputs["Brick Width"].default_value = width
    br.inputs["Row Height"].default_value = height
    return br


def _uv(b, u_axis, v_axis="z"):
    idx = {"x": 0, "y": 1, "z": 2}
    p = b.sep(b.coords("world"))
    return b.comb(p[idx[u_axis]], p[idx[v_axis]], 0.0), p


def aim_camera(cam, world_pt, target_px, iters=8):
    """Rotate `cam` (yaw/pitch only) so world_pt lands on target_px."""
    for _ in range(iters):
        p0 = proj(world_pt)
        ex, ey = target_px[0] - p0[0], target_px[1] - p0[1]
        if abs(ex) < 0.3 and abs(ey) < 0.3:
            break
        d = math.radians(0.5)
        cam.rotation_euler.z += d
        px = proj(world_pt)
        cam.rotation_euler.z -= d
        cam.rotation_euler.x += d
        py = proj(world_pt)
        cam.rotation_euler.x -= d
        jxz, jyx = (px[0] - p0[0]) / d, (py[1] - p0[1]) / d
        if abs(jxz) > 1e-6:
            cam.rotation_euler.z += ex / jxz
        if abs(jyx) > 1e-6:
            cam.rotation_euler.x += ey / jyx
    return proj(world_pt)


def cloth_grid(name, w, d, nx, ny, mat, loc=(0, 0, 0), rot=(0, 0, 0), height_fn=None, parent=None,
               displace=0.0, disp_scale=0.35, seed=0, subsurf=1):
    """A subdivided rectangle (local XY, centred) whose z comes from height_fn(u, v) (u, v in 0..1),
    plus optional noise displacement for crumples. Used for blankets, sheets, curtains."""
    bm = bmesh.new()
    verts = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            z = height_fn(u, v) if height_fn else 0.0
            if isinstance(z, tuple):
                row.append(bm.verts.new(((u - 0.5) * w + z[0], (v - 0.5) * d + z[1], z[2])))
            else:
                row.append(bm.verts.new(((u - 0.5) * w, (v - 0.5) * d, z)))
        verts.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    obj = _finish(name, bm, mat, loc, rot, parent, smooth=True)
    if displace:
        tex = bpy.data.textures.new(name + "Tex", "CLOUDS")
        tex.noise_scale = disp_scale
        tex.noise_depth = 2
        m = obj.modifiers.new("Disp", "DISPLACE")
        m.texture = tex
        m.strength = displace
        m.mid_level = 0.5
        m.texture_coords = "GLOBAL" if seed == 0 else "OBJECT"
    if subsurf:
        sm = obj.modifiers.new("Sub", "SUBSURF")
        sm.levels = subsurf
        sm.render_levels = subsurf
    so = obj.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 0.012
    return obj


def star_points(r_out, r_in, n=5, rot=90.0):
    pts = []
    for k in range(2 * n):
        r = r_out if k % 2 == 0 else r_in
        a = math.radians(rot) + math.pi * k / n
        pts.append((r * math.cos(a), r * math.sin(a)))
    return pts



def floor_at_pixel(px, py, z, axis=2):
    """World point where the camera ray through pixel (px, py) meets the plane {axis} = z (default: height)."""
    s = scene()
    cam = s.camera
    bpy.context.view_layer.update()
    tr, br, bl, tl = cam.data.view_frame(scene=s)
    u, v = px / s.render.resolution_x, py / s.render.resolution_y
    p = tl.lerp(tr, u).lerp(bl.lerp(br, u), v)
    d = cam.matrix_world.to_3x3() @ p
    o = cam.matrix_world.translation
    t = (z - o[axis]) / d[axis]
    return o + d * t



def _drape_normal(b):
    """Vertical folds for black studio drapes."""
    p = b.sep(b.coords("world"))
    wv = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
    b.set(wv.inputs["Vector"], b.comb(b.math("ADD", p[0], p[1]), 0.0, 0.0))
    wv.inputs["Scale"].default_value = 1.2
    wv.inputs["Distortion"].default_value = 2.0
    bp = b.node("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.6
    b.set(bp.inputs["Height"], wv.outputs[1])
    return bp.outputs[0]



def studio_camera_rig(name, loc, yaw, body_m, dark_m, metal_m):
    """A 1990s studio TV camera on a pedestal: column, ring skirt, camera head, lens hood, viewfinder,
    pan bars. Local -Y is where the lens points."""
    root = empty(name, loc, (0, 0, yaw))
    cyl(name + "Skirt", (0, 0, 0.12), 0.42, 0.22, dark_m, verts=32, radius2=0.36, bevel=0.02, parent=root)
    for k in range(3):
        a = 2 * math.pi * k / 3
        cyl(f"{name}Foot{k}", (0.5 * math.cos(a), 0.5 * math.sin(a), 0.06), 0.06, 0.08, dark_m, verts=12,
            parent=root)
        box(f"{name}Leg{k}", (0.25 * math.cos(a), 0.25 * math.sin(a), 0.1), (0.5, 0.08, 0.06), dark_m,
            rot=(0, 0, math.degrees(a)), parent=root)
    cyl(name + "Column", (0, 0, 0.75), 0.11, 1.1, metal_m, verts=24, parent=root)
    cyl(name + "Wheel", (0, 0, 1.0), 0.3, 0.035, metal_m, verts=32, parent=root)
    box(name + "Head", (0, 0, 1.36), (0.24, 0.3, 0.12), dark_m, bevel=0.02, parent=root)
    box(name + "Body", (0, 0.05, 1.6), (0.36, 0.62, 0.36), body_m, bevel=0.03, parent=root)
    box(name + "LensHood", (0, -0.42, 1.6), (0.3, 0.26, 0.28), dark_m, bevel=0.02, parent=root)
    cyl(name + "Lens", (0, -0.3, 1.6), 0.1, 0.25, dark_m, rot=(90, 0, 0), verts=24, parent=root)
    box(name + "Viewfinder", (0, 0.12, 1.89), (0.3, 0.34, 0.22), body_m, bevel=0.02, parent=root)
    box(name + "VFHood", (0, 0.32, 1.89), (0.24, 0.08, 0.18), dark_m, bevel=0.01, parent=root)
    for sx in (-1, 1):
        cyl(f"{name}PanBar{sx}", (sx * 0.22, 0.6, 1.45), 0.016, 0.75, metal_m, rot=(-62, 0, sx * 12), verts=10,
            parent=root)
        cyl(f"{name}Grip{sx}", (sx * 0.26, 0.92, 1.27), 0.022, 0.14, dark_m, rot=(-62, 0, sx * 12), verts=10,
            parent=root)
    tally = emit_mat(name + "Tally", (0.25, 0.0, 0.0, 1), 0.6)
    sphere(name + "TallyL", (0.14, -0.2, 1.8), 0.015, tally, parent=root)
    return root


def fresnel_lamp(name, loc, rot, body_m, lens_m, metal_m, stand=False):
    """A theatre fresnel: can, lens ring, barn doors, yoke."""
    root = empty(name, loc, rot)
    cyl(name + "Can", (0, 0, 0), 0.13, 0.32, body_m, rot=(90, 0, 0), verts=24, parent=root)
    cyl(name + "Lens", (0, -0.165, 0), 0.105, 0.012, lens_m, rot=(90, 0, 0), verts=24, parent=root)
    for k, (dx, dz, rx, ry) in enumerate(((0, 0.15, -35, 0), (0, -0.15, 35, 0), (0.15, 0, 0, 35), (-0.15, 0, 0, -35))):
        box(f"{name}Barn{k}", (dx * 1.05, -0.24, dz * 1.05), (0.26 if dx == 0 else 0.01, 0.16, 0.01 if dx == 0 else 0.26),
            body_m, rot=(rx, 0, -ry), parent=root)
    cyl(name + "Yoke", (0, 0, 0.2), 0.01, 0.12, metal_m, verts=8, parent=root)
    box(name + "YokeBar", (0, 0, 0.16), (0.32, 0.02, 0.02), metal_m, parent=root)
    return root


# ============================================================== OPPOSITE DAY: small helpers
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_STENCIL = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def font(path=FONT_BOLD):
    try:
        return bpy.data.fonts.load(path, check_existing=True)
    except Exception:  # noqa: BLE001 - fall back to Blender's built-in font
        return None


def text_obj(name, body, size, mat, loc, rot=(90, 0, 0), extrude=0.002, fnt=None, parent=None,
             align=("CENTER", "CENTER"), bevel=0.0):
    """3D text (the clock numerals, stencils). Text lies in local XY facing +Z; rot (90,0,0) stands it
    on a wall facing -Y."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x, cu.align_y = align
    if bevel:
        cu.bevel_depth = bevel
    f = fnt if fnt is not None else font()
    if f is not None:
        cu.font = f
    cu.materials.append(mat)
    o = _link(bpy.data.objects.new(name, cu))
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    if parent is not None:
        o.parent = parent
    return o


def boolean_cut(obj, cutter, solver="EXACT"):
    m = obj.modifiers.new("Cut" + cutter.name, "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = solver
    m.object = cutter
    cutter.hide_render = True
    cutter.display_type = "WIRE"
    return m


def arch_pts(x0, x1, z_spring, z_bottom=-0.1, n=24):
    """Outline (x, z) of a round-topped arch opening, counter-clockwise."""
    r = (x1 - x0) / 2
    cx = (x0 + x1) / 2
    pts = [(x0, z_bottom), (x1, z_bottom), (x1, z_spring)]
    for i in range(1, n):
        a = math.pi * i / n
        pts.append((cx + r * math.cos(a), z_spring + r * math.sin(a)))
    pts.append((x0, z_spring))
    return pts


def heart_pts(cx, cz, s, n=48):
    """Heart outline (x, z) of overall width ~s, centred near (cx, cz)."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 34.0, cz + (y + 2.5) * s / 34.0))
    return pts


def strip_ring(name, inner, outer, depth, mat, parent=None, loc=(0, 0, 0), rot=(90, 0, 0)):
    """A flat moulding following a path: inner and outer are equal-length (x, z) polylines; the strip
    is extruded `depth` toward local -Y after rot (90,0,0) (i.e. off a wall toward the room)."""
    bm = bmesh.new()
    n = len(inner)
    fi = [bm.verts.new((x, y, 0.0)) for x, y in inner]
    fo = [bm.verts.new((x, y, 0.0)) for x, y in outer]
    bi = [bm.verts.new((x, y, depth)) for x, y in inner]
    bo = [bm.verts.new((x, y, depth)) for x, y in outer]
    for i in range(n - 1):
        bm.faces.new((bi[i], bo[i], bo[i + 1], bi[i + 1]))          # front
        bm.faces.new((fi[i + 1], fo[i + 1], fo[i], fi[i]))          # back
        bm.faces.new((fi[i], bi[i], bi[i + 1], fi[i + 1]))          # inner edge
        bm.faces.new((fo[i + 1], bo[i + 1], bo[i], fo[i]))          # outer edge
    bm.faces.new((fi[0], fo[0], bo[0], bi[0]))
    bm.faces.new((bi[-1], bo[-1], fo[-1], fi[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _bevel(_finish(name, bm, mat, loc, rot, parent), 0.004, 2)


def tile_base(img, space, axes=("x", "z"), tile=(0.3, 0.3), offset=(0.0, 0.0), flip_u=False):
    """Base colour from a repeating image tile mapped on two axes of `space` coordinates."""
    idx = {"x": 0, "y": 1, "z": 2}

    def fn(b, vec):
        p = b.sep(b.coords(space))
        u = b.math("DIVIDE", b.math("SUBTRACT", p[idx[axes[0]]], offset[0]), tile[0])
        if flip_u:
            u = b.math("MULTIPLY", u, -1.0)
        v = b.math("DIVIDE", b.math("SUBTRACT", p[idx[axes[1]]], offset[1]), tile[1])
        tex = b.node("ShaderNodeTexImage", interpolation="Cubic", extension="REPEAT")
        tex.image = img
        b.set(tex.inputs[0], b.comb(u, v, 0.0))
        return tex.outputs[0]

    return fn


def uv_image_base(img):
    def fn(b, vec):
        uv = b.node("ShaderNodeUVMap")
        tex = b.node("ShaderNodeTexImage", interpolation="Cubic", extension="EXTEND")
        tex.image = img
        b.set(tex.inputs[0], uv.outputs[0])
        return tex.outputs[0]

    return fn


def blur_np(a, r):
    """Cheap separable box-blur x3 (~gaussian) on an HxWxC float array."""
    r = max(1, int(r))
    out = a.astype(np.float32)
    for _ in range(3):
        for ax in (0, 1):
            pad = [(0, 0)] * out.ndim
            pad[ax] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=ax, dtype=np.float64)
            sl_hi = [slice(None)] * out.ndim
            sl_lo = [slice(None)] * out.ndim
            sl_hi[ax] = slice(2 * r + 1, None)
            sl_lo[ax] = slice(0, -2 * r - 1)
            out = ((c[tuple(sl_hi)] - c[tuple(sl_lo)]) / (2 * r + 1)).astype(np.float32)
    return out


def poly_sdf(X, Y, pts):
    """Signed distance (negative inside) from grid points to a closed polygon."""
    P = np.asarray(pts, np.float32)
    d = np.full(X.shape, 1e9, np.float32)
    inside = np.zeros(X.shape, bool)
    n = len(P)
    for i in range(n):
        ax, ay = P[i]
        bx, by = P[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        wx, wy = X - ax, Y - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey + 1e-12), 0, 1)
        dx, dy = wx - ex * t, wy - ey * t
        d = np.minimum(d, np.hypot(dx, dy))
        cond = ((ay > Y) != (by > Y)) & (X < (bx - ax) * (Y - ay) / (by - ay + 1e-12) + ax)
        inside ^= cond
    return np.where(inside, -d, d)


# ============================================================== painted textures (numpy, sRGB 0-1)
def wallpaper_tile(bg, star, outline, tile_m=0.30, ppm=900, seed=0):
    """One repeat of the star wallpaper: two small white five-point stars per tile (half-drop)."""
    n = int(round(tile_m * ppm))
    xs = (np.arange(n) + 0.5) / ppm
    X, Y = np.meshgrid(xs, xs)
    img = np.ones((n, n, 3), np.float32) * srgb01(bg)
    # paper fibre: a faint mottle that tiles (built from sines so the repeat is seamless)
    k = 2 * math.pi / tile_m
    mott = (np.sin(X * k * 3 + 1.3) * np.sin(Y * k * 2 + 0.4) * 0.006
            + np.sin(X * k * 7 + Y * k * 5) * 0.004 + np.sin(X * k * 13 - Y * k * 11 + 2.0) * 0.003)
    img = img * (1.0 + mott[..., None])
    px = 1.2 / ppm
    for cx, cy, rot in ((0.25, 0.25, 90.0), (0.75, 0.75, 90.0)):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                c = ((cx + ox) * tile_m, (cy + oy) * tile_m)
                pts = [(c[0] + x, c[1] - y) for x, y in star_points(0.036, 0.0155, 5, rot)]
                d = poly_sdf(X, Y, pts)
                o = np.clip(0.5 - (d - 0.0022) / px, 0, 1)[..., None]
                img = img * (1 - o * 0.55) + srgb01(outline) * (o * 0.55)
                s = np.clip(0.5 - d / px, 0, 1)[..., None]
                img = img * (1 - s) + srgb01(star) * s
    return np.clip(img, 0, 1)


def bunting_tile(band, line, flags, tile_m=0.48, h_m=0.24, ppm=500):
    """Frieze border: a cream band with a sagging string of triangle flags (seamless along u)."""
    W, H = int(round(tile_m * ppm)), int(round(h_m * ppm))
    X, Y = np.meshgrid((np.arange(W) + 0.5) / ppm, (np.arange(H) + 0.5) / ppm)  # Y down from the top
    img = np.ones((H, W, 3), np.float32) * srgb01(band)
    px = 1.2 / ppm
    nf = len(flags)
    seg = tile_m / nf
    # string: catenary-ish sag between pins every `seg`
    t = (X % seg) / seg
    sag = 0.035 + 0.03 * (4 * t * (1 - t))
    dl = np.abs(Y - sag) - 0.0018
    for i, col in enumerate(flags):
        x0 = i * seg + seg * 0.18
        x1 = i * seg + seg * 0.82
        def s_at(x):
            tt = ((x % seg) / seg)
            return 0.035 + 0.03 * (4 * tt * (1 - tt))
        pts = [(x0, s_at(x0) + 0.002), (x1, s_at(x1) + 0.002), ((x0 + x1) / 2, s_at((x0 + x1) / 2) + 0.15)]
        d = poly_sdf(X, Y, pts)
        c = np.clip(0.5 - d / px, 0, 1)[..., None]
        shade = np.clip(1.0 - (Y - s_at((x0 + x1) / 2)) * 0.6, 0.85, 1.0)[..., None]
        img = img * (1 - c) + srgb01(col) * shade * c
    c = np.clip(0.5 - dl / px, 0, 1)[..., None]
    img = img * (1 - c) + srgb01(line) * c
    # thin edge lines top and bottom of the band
    for y0 in (0.006, h_m - 0.006):
        c = np.clip(0.5 - (np.abs(Y - y0) - 0.0025) / px, 0, 1)[..., None]
        img = img * (1 - c) + srgb01(line) * c
    return np.clip(img, 0, 1)


def knit_texture(w_m, l_m, bands, ppm=700, seed=2):
    """Chunky cream knit with red zig-zag bands. u across the width, v along the length.
    bands: list of (v_centre_fraction, half_height_m). Returns (colour image, height image)."""
    W, H = int(round(w_m * ppm)), int(round(l_m * ppm))
    U, V = np.meshgrid((np.arange(W) + 0.5) / ppm, (np.arange(H) + 0.5) / ppm)
    ws, hs = 0.016, 0.011                     # stitch width / row height (chunky)
    fu = (U / ws) % 1.0
    # V-shaped stitches: each column is two slanted half-loops
    phase = V / hs + np.abs(fu - 0.5) * 1.1
    ridge = 0.5 + 0.5 * np.cos(2 * math.pi * phase)
    col_gap = np.clip(1.0 - np.exp(-((fu - 0.5) / 0.09) ** 2) * 0.55, 0, 1)
    height = ridge * col_gap
    rng = np.random.default_rng(seed)
    cream = srgb01("#EEE4CE")
    red = srgb01("#C2302A")
    img = np.ones((H, W, 3), np.float32) * cream
    for vc, hh in bands:
        v0 = vc * l_m
        tri = np.abs(((U / 0.07) % 1.0) - 0.5) * 2.0          # 0..1 zig-zag along u
        centre = v0 + (tri - 0.5) * 0.045
        dz = np.abs(V - centre) - hh
        # stitch-quantised edge so the band reads as knitted, not printed
        q = np.floor(V / hs) * hs + hs / 2
        dzq = np.abs(q - centre) - hh
        m = (dzq < 0).astype(np.float32)[..., None]
        img = img * (1 - m) + red * m
        # thin cream-red-cream border rows
        e = ((np.abs(dz + 0.012) < 0.004) & (dz > -0.02)).astype(np.float32)[..., None] * 0.0
        img = img * (1 - e) + red * e
    shade = (0.78 + 0.22 * height)[..., None]
    fuzz = 1.0 + rng.normal(0, 0.025, (H, W, 1)).astype(np.float32)
    img = np.clip(img * shade * fuzz, 0, 1)
    return img, height


def clock_face_img(ppm=1400, r_m=0.26, mirror=False):
    """Not used for numerals (those are 3D text) - the face's printed minute track."""
    n = int(round(2 * r_m * ppm))
    xs = (np.arange(n) + 0.5) / ppm - r_m
    X, Y = np.meshgrid(xs, -xs)
    img = np.ones((n, n, 3), np.float32) * srgb01("#FBFAF4")
    R = np.hypot(X, Y)
    A = np.arctan2(Y, X)
    px = 1.3 / ppm
    for k in range(60):
        a = math.pi / 2 - 2 * math.pi * k / 60
        big = k % 5 == 0
        L0 = r_m * (0.84 if big else 0.88)
        L1 = r_m * 0.93
        wdt = 0.006 if big else 0.0022
        along = X * math.cos(a) + Y * math.sin(a)
        perp = -X * math.sin(a) + Y * math.cos(a)
        d = np.maximum.reduce([L0 - along, along - L1, np.abs(perp) - wdt / 2])
        c = np.clip(0.5 - d / px, 0, 1)[..., None]
        img = img * (1 - c) + srgb01("#2B3A6E") * c
    ring = np.clip(0.5 - (np.abs(R - r_m * 0.955) - 0.0016) / px, 0, 1)[..., None]
    img = img * (1 - ring) + srgb01("#2B3A6E") * ring
    return np.clip(img, 0, 1)


# ============================================================== THE TURNAROUND ROOM
# World: back wall's room face at y = 0, the set opens toward -y, floor z = 0, x to the right.
# The centre line x = 0 is the mirror plane. Set A = x < 0 (BIM's side), Set B = x > 0 (MIB's side).
RW, RD, RH = 3.4, 5.0, 3.2          # half width, depth, ceiling height
WALL_T = 0.06
FR_Y, FR_W, FR_H, FR_M, FR_Z0 = -1.4, 1.5, 2.0, 0.18, 0.07   # the gold frame
WAIN = 0.9
DOOR = (-3.18, -2.53, 1.70)          # x0, x1, spring height (round top: + half width)
CLOCK = (-2.855, 2.56, 0.28)         # x, z, radius (on the back wall)
CHEST = dict(x0=-2.40, x1=-1.80, d=0.42, h=0.50, lid=0.07)
NAIL = (-2.10, 1.56)                 # Mr. Turnabout's nail (Set A only); Set B: the paler rectangle
PORTRAIT = (0.56, 0.66)              # the composited portrait's size (for the paler rectangle)
EASEL = (-1.13, -2.15, 1.33)         # x, y, board centre height
BOARD = (0.60, 0.45)
CHAIR = (-1.10, -3.30, 150.0)        # x, y, yaw (front of the chair turned toward the frame)
TV = (-2.85, -1.40, 61.0)            # x, y, yaw (screen three-quarters toward the camera)
PENDANT = (-1.78, -1.05, 2.56)       # practical pendant lamp: x, y, shade bottom
TWIN_H = 1.10                        # puppet height (m) for scale anchors

PAL = {
    "A": dict(paper="#F6E7A4", wain="#C2E2F2", wain_dk="#9FC9E2", lid="#F6D45E", outline="#E4CF84",
              shade="#F8DC74", flags=("#F59FB6", "#8FD9B6", "#B9A4E6", "#8CC4EC")),
    "B": dict(paper="#C2E2F2", wain="#F6E7A4", wain_dk="#E6D27E", lid="#8CC4EC", outline="#A7CCE1",
              shade="#A9D5F2", flags=("#F59FB6", "#8FD9B6", "#B9A4E6", "#F6D45E")),
}
CAM_WIDE = dict(loc=(0.0, -6.6, 1.15), lens=30.0, shift_y=-0.0375)


class Turnaround:
    """chairs: {'A': 'blanket'|'bare'|None, 'B': ...}. night/dim only change lights (see light_*)."""

    def __init__(self, chairs=None, nail=True, pale=True, pendants_on=True, front_wall=False,
                 easel_a=None, easel_b=None, show_easels=True, frame_mirror=False, tv_screen_glow=0.0):
        self.chairs = chairs or {"A": "blanket", "B": None}
        self.nail = nail
        self.pale = pale
        self.pendants_on = pendants_on
        self.front_wall = front_wall
        self.easel_over = {"A": easel_a, "B": easel_b}
        self.show_easels = show_easels
        self.frame_mirror = frame_mirror
        self.tv_screen_glow = tv_screen_glow
        self.objs = {}
        self.roots = {}
        self.fnt = font(FONT_BOLD)

    # ------------------------------------------------------------ shared materials
    def shared_materials(self):
        M = {}
        M["void"] = void_mat()

        def lino(b, vec):
            p = b.sep(b.coords("sym"))
            u = b.math("ADD", b.math("DIVIDE", p[0], 0.30), 0.5)
            v = b.math("DIVIDE", p[1], 0.30)
            fu = b.math("FLOOR", u)
            fv = b.math("FLOOR", v)
            par = b.math("MODULO", b.math("ABSOLUTE", b.math("ADD", fu, fv)), 2.0)
            col = b.mix(b.rgb(hexc("#F3E9D6")), b.rgb(hexc("#F1C6CC")), par)
            # tile joints: distance to the nearest edge, in metres
            du = b.math("MULTIPLY", b.math("ABSOLUTE", b.math("SUBTRACT", b.math("FRACT", u), 0.5)), 0.30)
            dv = b.math("MULTIPLY", b.math("ABSOLUTE", b.math("SUBTRACT", b.math("FRACT", v), 0.5)), 0.30)
            edge = b.math("MAXIMUM", du, dv)
            seam = b.maprange(edge, 0.1475, 0.1495, 0.0, 1.0)
            col = b.mix(col, b.rgb(hexc("#B9A99A")), b.math("MULTIPLY", seam, 0.55))
            # scuffs: thin dark streaks (sparse) + a soft traffic haze in the middle of each half
            sv = b.mapping(b.coords("sym"), scale=(9.0, 2.2, 1.0), rot=(0, 0, 0.35))
            sc = b.maprange(b.noise(sv, 1.3, 5.0, 0.62), 0.66, 0.74, 0.0, 0.33)
            col = b.mix(col, b.rgb(hexc("#7E7468")), sc)
            haze = b.maprange(b.noise(b.coords("sym"), 0.9, 3.0, 0.5), 0.35, 0.65, 0.97, 1.0)
            return b.scale(col, haze)

        M["lino"] = make_mat("Lino", rough=0.34, var=0.03, var_scale=3.0, space="sym", base=lino,
                             rough_var=0.12, coat=0.18, spec=0.45, bump=0.03, bump_scale=60)
        M["ceiling"] = make_mat("Ceiling", hexc("#F7F1E6"), 0.9, var=0.03, var_scale=1.5, space="sym", spec=0.2)
        M["white_sym"] = make_mat("TrimSym", hexc("#FBF7EE"), 0.42, var=0.02, space="sym", coat=0.15)
        M["seam_sym"] = make_mat("SeamSym", hexc("#8C8678"), 0.8, var=0.0, space="sym")
        M["platform"] = make_mat("Platform", hexc("#3A3633"), 0.7, var=0.1, space="sym", grime=0.3)

        # burnished gold: bright on the high carving, dark gold in every recess (AO), a faint wear noise
        def gold_base(b, vec):
            ao = b.node("ShaderNodeAmbientOcclusion")
            ao.inputs["Distance"].default_value = 0.035
            ao.samples = 8
            hi = b.rgb(hexc("#E2B85C"))
            lo = b.rgb(hexc("#5E3F16"))
            occ = b.maprange(ao.outputs["AO"], 0.35, 0.95, 0.0, 1.0)
            col = b.mix(lo, hi, occ)
            wear = b.maprange(b.noise(b.coords("sym"), 22.0, 4.0, 0.6), 0.55, 0.75, 1.0, 0.82)
            return b.scale(col, wear)

        def gold_normal(b, vec):
            uvn = b.node("ShaderNodeUVMap")
            sp = b.sep(uvn.outputs[0])
            # x = across the moulding (m of profile), y = along the perimeter (m)
            band = b.math("MULTIPLY", b.maprange(sp[0], 0.055, 0.075, 0.0, 1.0),
                          b.maprange(sp[0], 0.135, 0.155, 1.0, 0.0))
            t = b.maprange(sp[0], 0.06, 0.15, 0.0, 1.0)
            lobes = b.math("SINE", b.math("MULTIPLY", b.math("ADD", b.math("DIVIDE", sp[1], 0.075),
                                                                     b.math("MULTIPLY", t, 0.9)), 2 * math.pi))
            vein = b.math("SINE", b.math("MULTIPLY", b.math("ADD", b.math("DIVIDE", sp[1], 0.075),
                                                                    b.math("MULTIPLY", t, 0.9)), 4 * math.pi))
            h = b.math("ADD", b.math("MULTIPLY", lobes, 0.8), b.math("MULTIPLY", vein, 0.25))
            h = b.math("ADD", h, b.math("MULTIPLY", b.noise(b.coords("sym"), 90.0, 3.0, 0.55), 0.6))
            h = b.math("MULTIPLY", h, band)
            # fine gesso texture everywhere
            h = b.math("ADD", h, b.math("MULTIPLY", b.noise(b.coords("sym"), 260.0, 2.0, 0.5), 0.12))
            bp = b.node("ShaderNodeBump")
            bp.inputs["Strength"].default_value = 0.55
            bp.inputs["Distance"].default_value = 0.004
            b.set(bp.inputs["Height"], h)
            return bp.outputs[0]

        M["gold"] = make_mat("Gold", rough=0.30, var=0.0, metallic=0.92, spec=0.6, base=gold_base,
                             normal_fn=gold_normal, rough_var=0.08, var_scale=40.0)
        M["gold_plain"] = make_mat("GoldPlain", rough=0.32, var=0.0, metallic=0.92, spec=0.6,
                                   base=gold_base, rough_var=0.08, var_scale=40.0,
                                   bump=0.15, bump_scale=200)
        self.M = M
        return M

    # ------------------------------------------------------------ per-half materials
    def half_materials(self, side, root):
        pal = PAL[side]
        H = {}
        paper = image_from_array(f"paper_{side}", wallpaper_tile(pal["paper"], "#FFFFFF", pal["outline"]))
        H["paper_x"] = make_mat(f"Paper{side}X", rough=0.85, var=0.015, var_scale=1.0, space=root,
                                base=tile_base(paper, root, ("x", "z"), (0.30, 0.30)), spec=0.25)
        H["paper_y"] = make_mat(f"Paper{side}Y", rough=0.85, var=0.015, var_scale=1.0, space=root,
                                base=tile_base(paper, root, ("y", "z"), (0.30, 0.30), flip_u=True), spec=0.25)

        def boards(axis):
            def fn(b, vec):
                p = b.sep(b.coords(root))
                a = p[{"x": 0, "y": 1}[axis]]
                f = b.math("FRACT", b.math("DIVIDE", a, 0.11))
                g = b.maprange(b.math("ABSOLUTE", b.math("SUBTRACT", f, 0.5)), 0.455, 0.49, 0.0, 1.0)
                return b.mix(b.rgb(hexc(pal["wain"])), b.rgb(hexc(pal["wain_dk"])), g)
            return fn

        def boards_n(axis):
            def fn(b, vec):
                p = b.sep(b.coords(root))
                a = p[{"x": 0, "y": 1}[axis]]
                f = b.math("FRACT", b.math("DIVIDE", a, 0.11))
                g = b.maprange(b.math("ABSOLUTE", b.math("SUBTRACT", f, 0.5)), 0.45, 0.49, 0.0, 1.0)
                bp = b.node("ShaderNodeBump")
                bp.inputs["Strength"].default_value = 0.6
                bp.inputs["Distance"].default_value = 0.003
                b.set(bp.inputs["Height"], b.math("MULTIPLY", g, -1.0))
                return bp.outputs[0]
            return fn

        H["wain_x"] = make_mat(f"Wain{side}X", rough=0.45, var=0.02, space=root, base=boards("x"),
                               normal_fn=boards_n("x"), coat=0.12)
        H["wain_y"] = make_mat(f"Wain{side}Y", rough=0.45, var=0.02, space=root, base=boards("y"),
                               normal_fn=boards_n("y"), coat=0.12)
        H["white"] = make_mat(f"Trim{side}", hexc("#FBF7EE"), 0.4, var=0.02, space=root, coat=0.15,
                              grime=0.06, grime_scale=3.0)
        H["seam"] = make_mat(f"Seam{side}", hexc("#7F7A70"), 0.8, var=0.0, space=root)
        bun = image_from_array(f"bunting_{side}", bunting_tile("#FFF7E8", "#C9B9A0", pal["flags"]))
        H["frieze_x"] = make_mat(f"Frieze{side}X", rough=0.8, var=0.0, space=root, spec=0.25,
                                 base=tile_base(bun, root, ("x", "z"), (0.48, -0.24), (0.0, 3.12)))
        H["frieze_y"] = make_mat(f"Frieze{side}Y", rough=0.8, var=0.0, space=root, spec=0.25,
                                 base=tile_base(bun, root, ("y", "z"), (0.48, -0.24), (0.0, 3.12), flip_u=True))
        H["mint"] = make_mat(f"Mint{side}", hexc("#A6E3C8"), 0.4, var=0.03, space=root, coat=0.3, grime=0.05)
        H["lid"] = make_mat(f"Lid{side}", hexc(pal["lid"]), 0.38, var=0.03, space=root, coat=0.3)
        H["star"] = make_mat(f"Star{side}", hexc("#FFFFFF"), 0.4, var=0.0, space=root, coat=0.3)
        H["red"] = make_mat(f"Red{side}", hexc("#D8352E"), 0.38, var=0.02, space=root, coat=0.3)
        H["navy"] = make_mat(f"Navy{side}", hexc("#26356B"), 0.45, var=0.0, space=root)
        face = image_from_array(f"clockface_{side}", clock_face_img())
        H["clockface"] = make_mat(f"ClockFace{side}", rough=0.3, var=0.0, space=root, coat=0.4,
                                  base=tile_base(face, root, ("x", "z"), (2 * CLOCK[2] * 0.93, 2 * CLOCK[2] * 0.93),
                                                 (CLOCK[0] - CLOCK[2] * 0.93, CLOCK[1] - CLOCK[2] * 0.93)))
        H["pine"] = make_mat(f"Pine{side}", rough=0.5, var=0.0, coat=0.1, space=root,
                             base=streak_wood(hexc("#E3BE88"), hexc("#C99A5F"), "z"))
        H["pine_x"] = make_mat(f"PineX{side}", rough=0.5, var=0.0, coat=0.1, space=root,
                               base=streak_wood(hexc("#E3BE88"), hexc("#C99A5F"), "x"))

        def slate(b, vec):
            n1 = b.noise(b.coords(root), 6.0, 4.0, 0.6)
            n2 = b.noise(b.mapping(b.coords(root), scale=(3.0, 3.0, 9.0)), 4.0, 3.0, 0.55)
            col = b.mix(b.rgb(hexc("#263D30")), b.rgb(hexc("#3F5A49")), b.maprange(n1, 0.35, 0.75, 0.0, 1.0))
            dust = b.maprange(n2, 0.55, 0.8, 0.0, 0.22)
            return b.mix(col, b.rgb(hexc("#8E9C92")), dust)

        H["slate"] = make_mat(f"Slate{side}", rough=0.88, var=0.0, space=root, base=slate, spec=0.2)
        H["chalk"] = [make_mat(f"Chalk{side}{i}", hexc(c), 0.95, var=0.03, space=root)
                      for i, c in enumerate(("#F4F1EA", "#F6B7C8", "#F8E58A"))]
        H["felt_eraser"] = make_mat(f"Eraser{side}", hexc("#5C5148"), 0.95, var=0.06, space=root, sheen=0.4)
        H["wood_tv"] = make_mat(f"TVWood{side}", rough=0.4, var=0.0, coat=0.25, space=root,
                                base=wood_base(hexc("#7A4E2C"), hexc("#4F3019"), 4.0, "X", 5.0))
        H["tv_plastic"] = make_mat(f"TVPlastic{side}", hexc("#2A2622"), 0.45, var=0.04, space=root)
        H["tv_silver"] = make_mat(f"TVSilver{side}", hexc("#A9A9A2"), 0.32, metallic=0.75, var=0.03, space=root)

        def grille(b, vec):
            p = b.sep(b.coords(root))
            w = b.math("FRACT", b.math("DIVIDE", p[2], 0.009))
            s = b.maprange(b.math("ABSOLUTE", b.math("SUBTRACT", w, 0.5)), 0.22, 0.3, 0.0, 1.0)
            return b.mix(b.rgb(hexc("#0D0C0B")), b.rgb(hexc("#6E6A62")), s)

        H["grille"] = make_mat(f"Grille{side}", rough=0.6, var=0.0, space=root, base=grille, metallic=0.3)
        H["glass"] = make_mat(f"CRTGlass{side}", hexc("#060807"), 0.10, var=0.0, coat=1.0, spec=0.55,
                              space=root)
        H["glass"].node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
        if self.tv_screen_glow:
            bs = H["glass"].node_tree.nodes["Principled BSDF"]
            bs.inputs["Emission Color"].default_value = (0.32, 0.42, 0.55, 1)
            bs.inputs["Emission Strength"].default_value = self.tv_screen_glow
        H["chrome"] = make_mat(f"Chrome{side}", hexc("#D6D6D2"), 0.12, metallic=1.0, var=0.0, space=root)
        H["laminate"] = make_mat(f"Laminate{side}", hexc("#EFE3CF"), 0.35, var=0.03, space=root, coat=0.2)
        H["vcr"] = make_mat(f"VCR{side}", hexc("#1B1A19"), 0.4, var=0.03, space=root)
        H["vcr_led"] = emit_mat(f"VCRLed{side}", (0.25, 1.0, 0.45, 1), 2.2)
        H["paint_white"] = make_mat(f"ChairWhite{side}", hexc("#FAF7F0"), 0.35, var=0.02, space=root,
                                    coat=0.35, grime=0.05, grime_scale=6.0)
        H["heart"] = make_mat(f"HeartRed{side}", hexc("#D3262C"), 0.35, var=0.02, space=root, coat=0.35)
        H["brass"] = make_mat(f"Brass{side}", hexc("#D9B45A"), 0.25, metallic=1.0, var=0.0, space=root)
        H["shade"] = make_mat(f"Shade{side}", hexc(pal["shade"]), 0.45, var=0.02, space=root, coat=0.3)
        H["cord"] = make_mat(f"Cord{side}", hexc("#EDE7DA"), 0.5, var=0.0, space=root)
        H["blocks"] = [make_mat(f"Block{side}{i}", hexc(c), 0.42, var=0.03, space=root, coat=0.25)
                       for i, c in enumerate(("#F28B8B", "#8FD0F0", "#F8D86A", "#9EDB9E"))]
        # paler rectangle where a picture used to hang (Set B): the unfaded paper is a touch lighter/cleaner
        pale_img = wallpaper_tile(pal["paper"], "#FFFFFF", pal["outline"])
        pale_img = np.clip(pale_img * 1.035 + 0.012, 0, 1)
        pimg = image_from_array(f"paper_pale_{side}", pale_img)
        H["paper_pale"] = make_mat(f"PaperPale{side}", rough=0.85, var=0.0, space=root,
                                   base=tile_base(pimg, root, ("x", "z"), (0.30, 0.30)), spec=0.25)
        return H

    # ------------------------------------------------------------ the gold frame (shared, centred)
    def build_frame(self):
        M = self.M
        root = empty("FrameRoot", (0.0, FR_Y, 0.0))
        self.objs["frame_root"] = root
        prof = [(0.000, 0.000), (0.000, 0.030), (0.004, 0.044), (0.012, 0.053), (0.022, 0.055),
                (0.030, 0.051), (0.036, 0.050), (0.044, 0.058), (0.054, 0.072), (0.066, 0.086),
                (0.080, 0.096), (0.096, 0.100), (0.112, 0.096), (0.124, 0.086), (0.132, 0.074),
                (0.137, 0.066), (0.150, 0.066), (0.158, 0.060), (0.166, 0.050), (0.173, 0.040),
                (0.180, 0.034), (0.180, 0.000)]
        loop = prof + [(u, -z) for u, z in reversed(prof[1:-1])]
        # cumulative profile length (UV x)
        plen = [0.0]
        for i in range(1, len(loop)):
            plen.append(plen[-1] + math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]))
        W, Hh = FR_W, FR_H
        zc = FR_Z0 + Hh / 2
        seg = 0.02
        n_w = int(round(W / seg))
        n_h = int(round(Hh / seg))
        sides = [((-1, -1), (1, -1), n_w, W), ((1, -1), (1, 1), n_h, Hh), ((1, 1), (-1, 1), n_w, W),
                 ((-1, 1), (-1, -1), n_h, Hh)]
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        rings = []
        vcoords = []
        for (u, d) in loop:
            a, bb = W / 2 - u, Hh / 2 - u
            ring = []
            vv = []
            off = 0.0
            for (s0, s1, n, L) in sides:
                for i in range(n):
                    t = i / n
                    x = (s0[0] + (s1[0] - s0[0]) * t) * a
                    z = (s0[1] + (s1[1] - s0[1]) * t) * bb
                    ring.append(bm.verts.new((x, -d, zc + z)))
                    vv.append(off + t * L)
                off += L
            rings.append(ring)
            vcoords.append(vv)
        nr = len(rings[0])
        per = 2 * (W + Hh)
        for i in range(len(rings)):
            j = (i + 1) % len(rings)
            for k in range(nr):
                k2 = (k + 1) % nr
                f = bm.faces.new((rings[i][k], rings[i][k2], rings[j][k2], rings[j][k]))
                vk2 = vcoords[i][k2] if k2 != 0 else per
                uvs = [(plen[i], vcoords[i][k]), (plen[i], vk2), (plen[j] if j else plen[-1] + 0.04, vk2),
                       (plen[j] if j else plen[-1] + 0.04, vcoords[i][k])]
                for lp, uv in zip(f.loops, uvs):
                    lp[uvl].uv = uv
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        mo = _finish("FrameMoulding", bm, M["gold"], (0, 0, 0), (0, 0, 0), root)
        for p in mo.data.polygons:
            p.use_smooth = True
        self.objs["frame"] = mo
        # bead-and-reel row on both faces + corner ornaments + crest
        bm = bmesh.new()
        ub, db, rb = 0.1435, 0.066, 0.0072
        a, bb = W / 2 - ub, Hh / 2 - ub
        per_in = 2 * (2 * a + 2 * bb)
        nbead = int(per_in / 0.02)
        for face_sign in (1, -1):
            for k in range(nbead):
                s = per_in * k / nbead
                if s < 2 * a:
                    x, z = -a + s, -bb
                elif s < 2 * a + 2 * bb:
                    x, z = a, -bb + (s - 2 * a)
                elif s < 4 * a + 2 * bb:
                    x, z = a - (s - 2 * a - 2 * bb), bb
                else:
                    x, z = -a, bb - (s - 4 * a - 2 * bb)
                mat = (Matrix.Translation((x, -face_sign * (db + rb * 0.4), zc + z)))
                bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=rb, matrix=mat)
        beads = _finish("FrameBeads", bm, M["gold_plain"], (0, 0, 0), (0, 0, 0), root, smooth=True)
        self.objs["beads"] = beads
        # corner bosses with acanthus leaves, a shell crest top-centre and a smaller one bottom-centre
        gp = M["gold_plain"]
        for face_sign in (1, -1):
            yf = -face_sign * 0.098
            for sx in (-1, 1):
                for sz in (-1, 1):
                    cx, cz = sx * (W / 2 - 0.088), zc + sz * (Hh / 2 - 0.088)
                    sphere(f"FrBoss{face_sign}{sx}{sz}", (cx, yf, cz), 0.042, gp, scale=(1, 0.5, 1), parent=root)
                    for k in range(5):
                        ang = math.atan2(-sz, -sx) + (k - 2) * 0.42
                        lx, lz = cx + math.cos(ang) * 0.06, cz + math.sin(ang) * 0.06
                        sphere(f"FrLeaf{face_sign}{sx}{sz}{k}", (lx, yf + face_sign * 0.006, lz), 0.03, gp,
                               scale=(1.7, 0.35, 0.55), rot=(0, -math.degrees(ang), 0), parent=root)
                    for k in range(3):
                        ang = math.atan2(sz, sx) + (k - 1) * 0.5
                        lx, lz = cx + math.cos(ang) * 0.05, cz + math.sin(ang) * 0.05
                        sphere(f"FrLeafO{face_sign}{sx}{sz}{k}", (lx, yf + face_sign * 0.012, lz), 0.024, gp,
                               scale=(1.5, 0.3, 0.5), rot=(0, -math.degrees(ang), 0), parent=root)
            for (cz, size, n) in ((zc + Hh / 2 - 0.06, 1.0, 9), (zc - Hh / 2 + 0.07, 0.6, 7)):
                up = 1 if cz > zc else -1
                sphere(f"FrCrestBoss{face_sign}{cz:.2f}", (0, yf, cz), 0.05 * size, gp, scale=(1.2, 0.55, 0.9),
                       parent=root)
                for k in range(n):
                    ang = math.pi * (k + 0.5) / n
                    lx, lz = math.cos(ang) * 0.11 * size, up * math.sin(ang) * 0.075 * size
                    sphere(f"FrShell{face_sign}{cz:.2f}{k}", (lx, yf + face_sign * 0.004, cz + lz), 0.03 * size,
                           gp, scale=(1.9, 0.38, 0.55), rot=(0, -math.degrees(math.atan2(lz, lx)), 0), parent=root)
        # two small claw feet: a ball gripped by three toes, front and back
        for sx in (-1, 1):
            fx = sx * (W / 2 - 0.2)
            sphere(f"FootBall{sx}", (fx, 0.0, 0.034), 0.034, gp, parent=root)
            box(f"FootPad{sx}", (fx, 0.0, 0.066), (0.14, 0.16, 0.012), gp, bevel=0.005, parent=root)
            for fy in (-1, 1):
                for k in (-1, 0, 1):
                    sphere(f"FootToe{sx}{fy}{k}", (fx + k * 0.022, fy * 0.03, 0.045), 0.016, gp,
                           scale=(0.7, 1.9, 0.75), rot=(fy * -38.0, 0, 0), parent=root)
            sphere(f"FootKnee{sx}", (fx, 0.0, 0.062), 0.03, gp, scale=(1.5, 2.6, 0.5), parent=root)
        if self.frame_mirror:
            self.build_mirror_pane(root, zc)
        return root

    def build_mirror_pane(self, root, zc):
        """A real silvered mirror in the opening (frame_mirror_night): old glass, foxing at the corners."""
        a, bb = FR_W / 2 - FR_M + 0.004, FR_H / 2 - FR_M + 0.004
        mat = bpy.data.materials.new("MirrorGlass")
        nb = NB(mat)
        nb.n.remove(nb.n["Principled BSDF"])
        out = nb.n["Material Output"]
        gl = nb.node("ShaderNodeBsdfGlossy")
        gl.inputs["Roughness"].default_value = 0.02
        gl.inputs["Color"].default_value = (0.80, 0.84, 0.80, 1.0)
        # foxing: dark-grey diffuse blotches growing in from the corners and edges
        p = nb.sep(nb.coords("object"))
        ex = nb.math("SUBTRACT", a, nb.math("ABSOLUTE", p[0]))
        ez = nb.math("SUBTRACT", bb, nb.math("ABSOLUTE", nb.math("SUBTRACT", p[2], 0.0)))
        edge = nb.math("MINIMUM", ex, ez)
        corner = nb.math("MULTIPLY", nb.maprange(ex, 0.0, 0.32, 1.0, 0.0), nb.maprange(ez, 0.0, 0.32, 1.0, 0.0))
        rim = nb.maprange(edge, 0.0, 0.05, 0.55, 0.0)
        n = nb.noise(nb.coords("object"), 9.0, 6.0, 0.62)
        fox = nb.math("MULTIPLY", nb.math("ADD", corner, rim), nb.maprange(n, 0.4, 0.7, 0.0, 1.6))
        fox = nb.math("MINIMUM", fox, 0.92)
        spots = nb.maprange(nb.noise(nb.coords("object"), 60.0, 2.0, 0.5), 0.68, 0.72, 0.0, 0.5)
        fox = nb.math("MINIMUM", nb.math("ADD", fox, nb.math("MULTIPLY", spots, corner)), 0.95)
        df = nb.node("ShaderNodeBsdfDiffuse")
        df.inputs["Color"].default_value = (0.05, 0.045, 0.035, 1)
        mix = nb.node("ShaderNodeMixShader")
        nb.set(mix.inputs[0], fox)
        nb.l.new(gl.outputs[0], mix.inputs[1])
        nb.l.new(df.outputs[0], mix.inputs[2])
        nb.l.new(mix.outputs[0], out.inputs["Surface"])
        pane = box("MirrorPane", (0, 0.0, zc), (2 * a, 0.006, 2 * bb), mat, parent=root)
        backing = box("MirrorBacking", (0, 0.012, zc), (2 * a, 0.012, 2 * bb),
                      make_mat("MirrorBack", hexc("#2A2420"), 0.8, var=0.05), parent=root)
        self.objs["mirror"] = pane
        return pane

    # ------------------------------------------------------------ one half of the set (Set A geometry)
    def half(self, side, root, chair=None, nail=False, pale=False, front_only=False):
        """Build Set A's half (x <= 0) under `root`. Called for B with a scale x = -1 root.
        front_only: only the back-wall pieces (used, y-mirrored, as the reverse angle's fourth wall)."""
        H = self.half_materials(side, root)
        o = {}
        P = lambda nm: f"{nm}{side}{'F' if front_only else ''}"  # noqa: E731
        x0, x1, zs = DOOR
        r = (x1 - x0) / 2
        cut = prism(P("DoorCut"), arch_pts(x0, x1, zs, -0.2), 0.8, H["white"], loc=(0, 0.45, 0), rot=(90, 0, 0),
                    parent=root)
        cut.hide_render = True
        cut.display_type = "WIRE"
        # back wall (one flat, papered) with the arched doorway
        wall = box2(P("BackWall"), (-RW - WALL_T, 0.0, 0.0), (0.0, WALL_T, RH), H["paper_x"], parent=root)
        boolean_cut(wall, cut)
        o["wall"] = wall
        for nm, lo, hi, m in (("Wain", (-RW, -0.018, 0.0), (0.0, 0.0, WAIN), H["wain_x"]),
                              ("Rail", (-RW, -0.042, WAIN - 0.018), (0.0, 0.0, WAIN + 0.03), H["white"]),
                              ("Skirt", (-RW, -0.032, 0.0), (0.0, 0.0, 0.15), H["white"])):
            ob = box2(P(nm), lo, hi, m, parent=root, bevel=0.006 if nm != "Wain" else 0.0)
            boolean_cut(ob, cut)
        box2(P("Frieze"), (-RW, -0.004, 2.88), (0.0, 0.0, 3.12), H["frieze_x"], parent=root)
        box2(P("Cornice"), (-RW, -0.07, 3.12), (0.0, 0.0, RH), H["white"], parent=root, bevel=0.01)
        box2(P("FriezeRail"), (-RW, -0.022, 2.865), (0.0, 0.0, 2.885), H["white"], parent=root, bevel=0.004)
        for sx in (-1.2, -2.4):
            if not (x0 - 0.1 < sx < x1 + 0.1):
                box2(P(f"SeamB{sx}"), (sx - 0.0018, -0.0012, WAIN + 0.03), (sx + 0.0018, 0.0, 2.865), H["seam"],
                     parent=root)
        # architrave round the arch
        inner = []
        outer = []
        w = 0.085
        inner.append((x0, 0.0))
        outer.append((x0 - w, 0.0))
        inner.append((x0, zs))
        outer.append((x0 - w, zs))
        for i in range(1, 24):
            ang = math.pi - math.pi * i / 24
            inner.append(((x0 + x1) / 2 + r * math.cos(ang), zs + r * math.sin(ang)))
            outer.append(((x0 + x1) / 2 + (r + w) * math.cos(ang), zs + (r + w) * math.sin(ang)))
        inner.append((x1, zs))
        outer.append((x1 + w, zs))
        inner.append((x1, 0.0))
        outer.append((x1 + w, 0.0))
        strip_ring(P("Architrave"), inner, outer, 0.04, H["white"], parent=root)
        # the doorway reveal and a short corridor of pure black behind it
        box2(P("Corridor"), (x0 - 0.5, WALL_T + 0.001, -0.05), (x1 + 0.5, 1.6, 2.6), self.M["void"], parent=root)
        box2(P("RevealFloor"), (x0, -0.01, -0.05), (x1, WALL_T + 0.002, 0.0005), self.M["void"], parent=root)
        o["door"] = (x0, x1, zs + r)

        # wall clock (no hands) above the doorway
        cx, cz, R = CLOCK
        ck = empty(P("Clock"), (cx, 0.0, cz), parent=root)
        cyl(P("ClockBody"), (0, -0.03, 0), R, 0.05, H["red"], rot=(90, 0, 0), verts=64, parent=ck, bevel=0.008)
        torus(P("ClockRim"), (0, -0.058, 0), R - 0.012, 0.016, H["red"], rot=(90, 0, 0), seg=64, ring=12, parent=ck)
        cyl(P("ClockFace"), (0, -0.056, 0), R * 0.93, 0.004, H["clockface"], rot=(90, 0, 0), verts=64, parent=ck)
        for k in range(1, 13):
            ang = math.pi / 2 - 2 * math.pi * k / 12
            rr = R * 0.66
            text_obj(P(f"Num{k}"), str(k), R * 0.30, H["navy"], (rr * math.cos(ang), -0.0595, rr * math.sin(ang)),
                     extrude=0.0015, fnt=self.fnt, parent=ck)
        cyl(P("ClockBoss"), (0, -0.062, 0), 0.012, 0.01, H["red"], rot=(90, 0, 0), verts=16, parent=ck)
        o["clock"] = ck

        # toy chest against the back wall (lid closed)
        c = CHEST
        ccx = (c["x0"] + c["x1"]) / 2
        cw = c["x1"] - c["x0"]
        ch = empty(P("Chest"), (ccx, -c["d"] / 2 - 0.035, 0.0), parent=root)
        box(P("ChestBody"), (0, 0, c["h"] / 2 + 0.02), (cw, c["d"], c["h"] - 0.04), H["mint"], bevel=0.025, parent=ch)
        box(P("ChestLid"), (0, 0, c["h"] + c["lid"] / 2 - 0.01), (cw + 0.03, c["d"] + 0.03, c["lid"]), H["lid"],
            bevel=0.025, parent=ch)
        box(P("ChestPlinth"), (0, 0, 0.02), (cw - 0.02, c["d"] - 0.02, 0.04), H["white"], bevel=0.008, parent=ch)
        # front: a raised panel and a white star, two rope-loop handles on the sides
        box(P("ChestPanel"), (0, -c["d"] / 2 - 0.004, c["h"] / 2 + 0.01), (cw - 0.12, 0.01, c["h"] - 0.17), H["lid"],
            bevel=0.006, parent=ch)
        prism(P("ChestStar"), star_points(0.075, 0.032), 0.008, H["star"], loc=(0, -c["d"] / 2 - 0.009,
              c["h"] / 2 + 0.01), rot=(90, 0, 0), parent=ch, bevel=0.002)
        for sx in (-1, 1):
            torus(P(f"ChestRope{sx}"), (sx * (cw / 2 + 0.012), 0, c["h"] * 0.62), 0.045, 0.009,
                  make_mat(f"Rope{side}", hexc("#D9C9A3"), 0.9, var=0.05, space=root), rot=(0, 90, 0), parent=ch)
        o["chest"] = ch
        o["chest_lid_top"] = (ccx, -c["d"] / 2 - 0.035, c["h"] + c["lid"] - 0.01)
        if front_only:
            self.objs[f"half_{side}_front"] = o
            return o

        # three alphabet blocks stacked on the floor beside the chest
        bx, by = c["x1"] + 0.17, -0.30
        for k, (dx, dy, dz, rz) in enumerate(((0, 0, 0, 8), (0.125, 0.02, 0, -12), (0.06, 0.01, 0.11, 25))):
            box(P(f"Block{k}"), (bx + dx, by + dy, 0.055 + dz), (0.11, 0.11, 0.11), H["blocks"][k], rot=(0, 0, rz),
                bevel=0.01, parent=root)

        # side wall
        for nm, lo, hi, m in (("SideWall", (-RW - WALL_T, -RD, 0.0), (-RW, WALL_T, RH), H["paper_y"]),
                              ("SideWain", (-RW, -RD, 0.0), (-RW + 0.018, 0.0, WAIN), H["wain_y"]),
                              ("SideRail", (-RW, -RD, WAIN - 0.018), (-RW + 0.042, 0.0, WAIN + 0.03), H["white"]),
                              ("SideSkirt", (-RW, -RD, 0.0), (-RW + 0.032, 0.0, 0.15), H["white"]),
                              ("SideFrieze", (-RW, -RD, 2.88), (-RW + 0.004, 0.0, 3.12), H["frieze_y"]),
                              ("SideFriezeRail", (-RW, -RD, 2.865), (-RW + 0.022, 0.0, 2.885), H["white"]),
                              ("SideCornice", (-RW, -RD, 3.12), (-RW + 0.07, 0.0, RH), H["white"])):
            box2(P(nm), lo, hi, m, parent=root, bevel=0.006 if m is H["white"] else 0.0)
        for sy in (-1.6, -3.2):
            box2(P(f"SeamS{sy}"), (-RW, sy - 0.0018, WAIN + 0.03), (-RW + 0.0012, sy + 0.0018, 2.865), H["seam"],
                 parent=root)

        # practical pendant lamp hanging from the ceiling
        px_, py_, pz_ = PENDANT
        cyl(P("PendCord"), (px_, py_, (RH + pz_ + 0.2) / 2), 0.005, RH - pz_ - 0.2, H["cord"], verts=8, parent=root)
        cyl(P("PendRose"), (px_, py_, RH - 0.015), 0.05, 0.03, H["white"], verts=24, parent=root)
        shade = sphere(P("PendShade"), (px_, py_, pz_), 0.19, H["shade"], scale=(1, 1, 0.62), parent=root)
        cutp = box(P("PendCut"), (px_, py_, pz_ - 0.12), (0.5, 0.5, 0.24), H["white"], parent=root)
        boolean_cut(shade, cutp, "FLOAT")
        so = shade.modifiers.new("Solid", "SOLIDIFY")
        so.thickness = 0.008
        cyl(P("PendCap"), (px_, py_, pz_ + 0.115), 0.04, 0.04, H["shade"], verts=20, parent=root)
        if self.pendants_on:
            bulb = sphere(P("PendBulb"), (px_, py_, pz_ + 0.03), 0.045,
                          emit_mat(P("BulbGlow"), (*kelvin(2900), 1.0), 9.0), parent=root)
            lt = light(P("PendLight"), "POINT", (px_, py_, pz_ + 0.02), 22.0, kelvin(2900), size=0.04)
            lt.parent = root
            # warm glow inside the shade
            lt2 = light(P("PendIn"), "POINT", (px_, py_, pz_ + 0.06), 3.0, kelvin(2900), size=0.03)
            lt2.parent = root
        else:
            sphere(P("PendBulb"), (px_, py_, pz_ + 0.03), 0.045,
                   make_mat(P("BulbOff"), hexc("#DCD8CC"), 0.2, var=0.0, coat=0.5), parent=root)

        # CRT television on a chrome-legged stand, VCR on the shelf underneath
        tx, ty, tyaw = TV
        tv = empty(P("TVStand"), (tx, ty, 0.0), (0, 0, tyaw), parent=root)
        sw, sd, shh = 0.50, 0.42, 0.46
        box(P("StandTop"), (0, 0, shh), (sw, sd, 0.025), H["laminate"], bevel=0.006, parent=tv)
        box(P("StandShelf"), (0, 0, 0.14), (sw - 0.04, sd - 0.04, 0.018), H["laminate"], bevel=0.004, parent=tv)
        for lx in (-1, 1):
            for ly in (-1, 1):
                cyl(P(f"StandLeg{lx}{ly}"), (lx * (sw / 2 - 0.03), ly * (sd / 2 - 0.03), shh / 2), 0.011, shh,
                    H["chrome"], verts=12, parent=tv)
                sphere(P(f"StandFoot{lx}{ly}"), (lx * (sw / 2 - 0.03), ly * (sd / 2 - 0.03), 0.008), 0.014,
                       H["tv_plastic"], parent=tv)
        box(P("VCR"), (0, 0.0, 0.14 + 0.009 + 0.045), (0.38, 0.27, 0.09), H["vcr"], bevel=0.004, parent=tv)
        box(P("VCRSlot"), (-0.04, -0.136, 0.205), (0.2, 0.004, 0.022), self.M["void"], parent=tv)
        box(P("VCRStrip"), (0, -0.136, 0.165), (0.36, 0.003, 0.004), H["tv_silver"], parent=tv)
        text_obj(P("VCRClock"), "12:00", 0.026, H["vcr_led"], (0.12, -0.1375, 0.206), extrude=0.0005,
                 fnt=font(FONT_STENCIL), parent=tv)
        tw, th, td = 0.46, 0.37, 0.38
        tz = shh + 0.0125
        body = empty(P("TV"), (0, 0.0, tz), parent=tv)
        box(P("TVCab"), (0, 0.0, th / 2), (tw, td, th), H["wood_tv"], bevel=0.018, parent=body)
        box(P("TVFront"), (0, -td / 2 - 0.004, th / 2), (tw - 0.03, 0.012, th - 0.03), H["tv_plastic"], bevel=0.008,
            parent=body)
        scw, sch = 0.285, 0.215
        scx, scz = -0.055, th / 2 + 0.005
        box(P("TVBezel"), (scx, -td / 2 - 0.012, scz), (scw + 0.04, 0.01, sch + 0.04), H["tv_silver"], bevel=0.012,
            parent=body)
        # bulged screen glass
        bm = bmesh.new()
        nx_, nz_ = 24, 18
        grid = []
        for j in range(nz_ + 1):
            row = []
            for i in range(nx_ + 1):
                u, v = i / nx_ - 0.5, j / nz_ - 0.5
                bulge = 0.016 * (1 - (2 * u) ** 2) * (1 - (2 * v) ** 2)
                # rounded-rectangle corners: pull the corner points in a little
                k = max(abs(2 * u), abs(2 * v))
                row.append(bm.verts.new((u * scw, -bulge, v * sch)))
            grid.append(row)
        for j in range(nz_):
            for i in range(nx_):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f in bm.faces:
            if f.normal.y > 0:
                f.normal_flip()
        scr = _finish(P("TVScreen"), bm, H["glass"], (scx, -td / 2 - 0.019, scz), (0, 0, 0), body, smooth=True)
        o["tv_screen"] = (scr, scw, sch)
        # controls on the right: two knobs and a speaker grille
        for k, kz in enumerate((th / 2 + 0.085, th / 2 + 0.02)):
            cyl(P(f"Knob{k}"), (tw / 2 - 0.06, -td / 2 - 0.018, kz), 0.022, 0.026, H["tv_silver"], rot=(90, 0, 0),
                verts=20, parent=body, bevel=0.003)
            cyl(P(f"KnobCap{k}"), (tw / 2 - 0.06, -td / 2 - 0.032, kz), 0.012, 0.004, H["tv_plastic"],
                rot=(90, 0, 0), verts=12, parent=body)
        box(P("Grille"), (tw / 2 - 0.06, -td / 2 - 0.012, th / 2 - 0.085), (0.07, 0.006, 0.09), H["grille"],
            parent=body)
        box(P("TVPower"), (tw / 2 - 0.06, -td / 2 - 0.013, 0.035), (0.03, 0.008, 0.018), H["tv_silver"], parent=body)
        # rabbit-ear antenna
        sphere(P("AntBase"), (0.06, 0.05, th + 0.012), 0.04, H["tv_plastic"], scale=(1.3, 1, 0.45), parent=body)
        for sx in (-1, 1):
            cyl(P(f"Ant{sx}"), (0.06 + sx * 0.11, 0.05, th + 0.24), 0.0032, 0.5, H["chrome"],
                rot=(0, sx * 28.0, 0), verts=6, parent=body)
        o["tv"] = tv

        # wooden easel with a green chalkboard, board facing the show camera
        over = self.easel_over.get(side)
        if self.show_easels and over != "hide":
            ex_, ey_, eyaw, ebz = EASEL[0], EASEL[1], 0.0, EASEL[2]
            if over:
                ex_, ey_, eyaw = over[:3]
                if len(over) > 3:
                    ebz = over[3]
            o.update(self.build_easel(P("Easel"), H, root, ex_, ey_, eyaw, ebz))

        # Mr. Turnabout's empty brass nail (Set A) / the paler rectangle (Set B)
        nx, nz = NAIL
        if nail:
            cyl(P("Nail"), (nx, -0.012, nz), 0.0045, 0.03, H["brass"], rot=(80, 0, 0), verts=10, parent=root)
            cyl(P("NailHead"), (nx, -0.027, nz + 0.003), 0.008, 0.004, H["brass"], rot=(80, 0, 0), verts=14,
                parent=root)
            o["nail"] = (nx, -0.02, nz)
        if pale:
            pw, ph = PORTRAIT
            box2(P("PaleRect"), (nx - pw / 2, -0.0008, nz - 0.05 - ph), (nx + pw / 2, 0.0, nz - 0.05), H["paper_pale"],
                 parent=root)
            o["pale"] = (nx, nz)

        # the child's chair (+ the knitted blanket)
        if chair:
            o["chair"] = self.build_chair(P("Chair"), H, root, CHAIR, blanket=(chair == "blanket"))
        self.objs[f"half_{side}"] = o
        return o

    # ------------------------------------------------------------ easel + chalkboard
    def build_easel(self, name, H, parent, ex_, ey_, eyaw, ebz):
        ez_ = empty(name, (ex_, ey_, 0.0), (0, 0, eyaw), parent=parent)
        lean = 8.0
        tilt = empty(name + "Tilt", (0, 0, 0), (-lean, 0, 0), parent=ez_)
        bw, bh = BOARD
        fr = 0.04
        board = box(name + "Board", (0, 0.0, ebz), (bw, 0.018, bh), H["slate"], parent=tilt)
        for nm, cc, ss, m in (("BFrT", (0, -0.006, ebz + bh / 2 + fr / 2), (bw + 2 * fr, 0.03, fr), H["pine_x"]),
                              ("BFrB", (0, -0.006, ebz - bh / 2 - fr / 2), (bw + 2 * fr, 0.03, fr), H["pine_x"]),
                              ("BFrL", (-bw / 2 - fr / 2, -0.006, ebz), (fr, 0.03, bh), H["pine"]),
                              ("BFrR", (bw / 2 + fr / 2, -0.006, ebz), (fr, 0.03, bh), H["pine"])):
            box(name + nm, cc, ss, m, bevel=0.006, parent=tilt)
        tray_z = ebz - bh / 2 - fr - 0.02
        box(name + "Tray", (0, -0.05, tray_z), (bw + 0.2, 0.09, 0.02), H["pine_x"], bevel=0.005, parent=tilt)
        box(name + "TrayLip", (0, -0.093, tray_z + 0.018), (bw + 0.2, 0.012, 0.035), H["pine_x"], bevel=0.004,
            parent=tilt)
        for k, (xx, mm) in enumerate(((-0.2, 0), (-0.14, 1), (0.22, 2))):
            cyl(f"{name}Chalk{k}", (xx, -0.05, tray_z + 0.018), 0.0065, 0.07, H["chalk"][mm], rot=(0, 90, 8 * k),
                verts=8, parent=tilt)
        box(name + "Eraser", (0.05, -0.05, tray_z + 0.028), (0.12, 0.05, 0.035), H["felt_eraser"], bevel=0.004,
            parent=tilt)
        top = ebz + bh / 2 + fr + 0.2
        for sx in (-1, 1):
            box(f"{name}Leg{sx}", (sx * (bw / 2 + fr + 0.03), 0.02, top / 2), (0.045, 0.03, top + 0.02), H["pine"],
                rot=(0, sx * -2.5, 0), bevel=0.006, parent=tilt)
        box(name + "Cross", (0, 0.02, min(0.5, tray_z - 0.25)), (bw + 2 * fr + 0.1, 0.025, 0.04), H["pine_x"],
            bevel=0.005, parent=tilt)
        rear_ang = 22.0
        rl = top / math.cos(math.radians(rear_ang))
        top_y = 0.02 + top * math.sin(math.radians(lean))
        box(name + "Rear", (0, top_y + rl / 2 * math.sin(math.radians(rear_ang)), top / 2), (0.045, 0.03, rl),
            H["pine"], rot=(-rear_ang, 0, 0), bevel=0.006, parent=ez_)
        return {"board": (board, bw, bh), "easel": ez_}

    # ------------------------------------------------------------ the Chair For You
    def build_chair(self, name, H, parent, pos, blanket=True):
        cx, cy, yaw = pos
        ch = empty(name, (cx, cy, 0.0), (0, 0, yaw), parent=parent)
        W_ = H["paint_white"]
        sw, sd, sz = 0.32, 0.30, 0.30
        box(name + "Seat", (0, 0, sz), (sw, sd, 0.025), W_, bevel=0.007, parent=ch)
        lx, ly = sw / 2 - 0.022, sd / 2 - 0.022
        for sx in (-1, 1):
            box(f"{name}FL{sx}", (sx * lx, -ly, (sz - 0.0125) / 2), (0.028, 0.028, sz - 0.0125), W_, bevel=0.004,
                parent=ch)
            box(f"{name}BL{sx}", (sx * lx, ly, 0.645 / 2), (0.028, 0.028, 0.645), W_, bevel=0.004, parent=ch)
            box(f"{name}SR{sx}", (sx * lx, 0, 0.11), (0.018, sd - 0.05, 0.02), W_, bevel=0.003, parent=ch)
            sphere(f"{name}Fin{sx}", (sx * lx, ly, 0.652), 0.019, W_, parent=ch)
        box(name + "FR", (0, -ly, 0.11), (sw - 0.05, 0.018, 0.02), W_, bevel=0.003, parent=ch)
        panel = box(name + "Back", (0, ly, 0.515), (sw - 0.03, 0.02, 0.23), W_, bevel=0.006, parent=ch)
        hp = heart_pts(0.0, 0.0, 0.105)
        cutter = prism(name + "HeartCut", hp, 0.2, H["heart"], loc=(0, ly + 0.1, 0.478), rot=(90, 0, 0), parent=ch)
        m = boolean_cut(panel, cutter)
        try:
            m.material_mode = "TRANSFER"
        except (AttributeError, TypeError):
            pass
        # a red painted rim round the heart on both faces
        outer = heart_pts(0.0, 0.0, 0.135)
        for k, yy in enumerate((ly - 0.0108, ly + 0.0108 + 0.0016)):
            strip_ring(f"{name}HeartRim{k}", hp + [hp[0]], outer + [outer[0]], 0.0016, H["heart"],
                       loc=(0, yy, 0.478), rot=(90, 0, 0), parent=ch)
        if blanket:
            self.build_blanket(name + "Blanket", H, ch)
        return ch

    def build_blanket(self, name, H, parent):
        """Chunky knitted blanket folded over the seat and the backrest (chair local frame: front = -y)."""
        path = [(-0.168, 0.215), (-0.161, 0.293), (-0.142, 0.318), (-0.05, 0.322), (0.06, 0.322), (0.092, 0.326),
                (0.107, 0.345), (0.112, 0.42), (0.111, 0.55), (0.112, 0.612), (0.118, 0.645), (0.131, 0.667),
                (0.146, 0.667), (0.157, 0.650), (0.160, 0.615), (0.160, 0.585), (0.159, 0.552)]
        seg = [0.0]
        for i in range(1, len(path)):
            seg.append(seg[-1] + math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
        L = seg[-1]
        wid = 0.38
        nu, nv = 26, 90

        def at(s):
            for i in range(1, len(path)):
                if s <= seg[i] or i == len(path) - 1:
                    t = (s - seg[i - 1]) / max(1e-9, seg[i] - seg[i - 1])
                    y = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t
                    z = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t
                    ty, tz = path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]
                    ln = math.hypot(ty, tz) or 1.0
                    return y, z, ty / ln, tz / ln
            return path[-1][0], path[-1][1], 0.0, -1.0

        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        grid = []
        for j in range(nv + 1):
            v = j / nv
            y, z, ty, tz = at(v * L)
            ny_, nz_ = -tz, ty           # in-plane normal (points up on the seat, toward -y... on the back)
            row = []
            for i in range(nu + 1):
                u = i / nu
                x = (u - 0.5) * wid
                ov = max(0.0, abs(x) - 0.150)
                horiz = 1.0 - min(1.0, abs(tz) * 2.5)          # 1 on the seat, 0 on vertical parts
                droop = -min(0.07, 1.6 * ov) * horiz
                side_tuck = -min(0.03, 0.4 * ov) * (1 - horiz)
                wr = (0.0045 * math.sin(2 * math.pi * (u * 2.6 + v * 1.7)) +
                      0.003 * math.sin(2 * math.pi * (u * 6.3 - v * 5.1) + 1.0) +
                      0.004 * math.sin(2 * math.pi * v * 9.0 + u * 2.0) * (1 - horiz))
                row.append(bm.verts.new((x, y + ny_ * wr + side_tuck * 0.3, z + nz_ * wr + droop)))
            grid.append(row)
        for j in range(nv):
            for i in range(nu):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for lp, (uu, vv) in zip(f.loops, ((i / nu, j / nv), ((i + 1) / nu, j / nv),
                                                  ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv))):
                    lp[uvl].uv = (uu, 1.0 - vv)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        if "BlanketMat" not in bpy.data.materials:
            img, hgt = knit_texture(wid, L, bands=[(0.07, 0.016), (0.905, 0.016)])
            cimg = image_from_array("knit_col", img)
            himg = image_from_array("knit_h", np.repeat(hgt[..., None], 3, axis=2))

            def knit_n(b, vec):
                uv = b.node("ShaderNodeUVMap")
                tex = b.node("ShaderNodeTexImage", interpolation="Cubic", extension="EXTEND")
                tex.image = himg
                tex.image.colorspace_settings.name = "Non-Color"
                b.set(tex.inputs[0], uv.outputs[0])
                bp = b.node("ShaderNodeBump")
                bp.inputs["Strength"].default_value = 0.9
                bp.inputs["Distance"].default_value = 0.004
                b.set(bp.inputs["Height"], tex.outputs[0])
                return bp.outputs[0]

            mat = make_mat("BlanketMat", rough=0.95, var=0.0, sheen=0.6, spec=0.15, base=uv_image_base(cimg),
                           normal_fn=knit_n)
        else:
            mat = bpy.data.materials["BlanketMat"]
        bl = _finish(name, bm, mat, (0, 0, 0), (0, 0, 0), parent, smooth=True)
        so = bl.modifiers.new("Solid", "SOLIDIFY")
        so.thickness = 0.014
        so.offset = 0.0
        sm = bl.modifiers.new("Sub", "SUBSURF")
        sm.levels = 1
        sm.render_levels = 1
        return bl

    # ------------------------------------------------------------ shared room shell
    def build_shared(self):
        M = self.M
        box2("Floor", (-RW - WALL_T, -RD, -0.06), (RW + WALL_T, WALL_T, 0.0), M["lino"])
        box2("PlatformFace", (-RW - WALL_T, -RD - 0.02, -0.32), (RW + WALL_T, -RD, 0.0), M["platform"])
        box2("Ceiling", (-RW - 0.2, -RD, RH), (RW + 0.2, 0.2, RH + 0.06), M["ceiling"])
        box2("CentreSeam", (-0.0012, -0.0011, WAIN + 0.03), (0.0012, 0.0, 2.865), M["seam_sym"])
        # ceiling rose in the middle of the room (symmetric dressing)
        cyl("CeilRose", (0.0, -2.4, RH - 0.012), 0.16, 0.024, M["white_sym"], verts=48, bevel=0.006)

    # ------------------------------------------------------------ build everything
    def build(self):
        self.shared_materials()
        self.build_shared()
        self.build_frame()
        for side in ("A", "B"):
            root = empty(f"Set{side}", (0, 0, 0))
            if side == "B":
                root.scale = (-1.0, 1.0, 1.0)
            self.roots[side] = root
            self.half(side, root, chair=self.chairs.get(side), nail=(self.nail and side == "A"),
                      pale=(self.pale and side == "B"))
        if self.front_wall:
            for side in ("A", "B"):
                fr = empty(f"Front{side}", (0, -RD, 0))
                fr.scale = (-1.0 if side == "B" else 1.0, -1.0, 1.0)
                self.roots["F" + side] = fr
                self.half(side, fr, front_only=True)
        return self

    def mirror_world(self):
        """Parent every top-level object to an x = -1 empty: the whole room becomes its mirror image."""
        mw = empty("WorldMirror", (0, 0, 0))
        mw.scale = (-1.0, 1.0, 1.0)
        for ob in list(scene().collection.objects):
            if ob is mw or ob.parent is not None or ob.type == "CAMERA":
                continue
            ob.parent = mw
        return mw

    # ------------------------------------------------------------ light rigs
    def light_bright(self, scale=1.0, k=4800, top=True):
        """Flat 1990s kids'-TV light: two big soft keys (equal, mirrored), a soft top light."""
        warm = kelvin(k)
        s = scene()
        bg = s.world.node_tree.nodes["Background"]
        bg.inputs["Color"].default_value = (*tint(warm, (1, 1, 1), 0.5), 1)
        bg.inputs["Strength"].default_value = 0.06 * scale
        for sx in (-1, 1):
            light(f"Key{sx}", "AREA", (sx * 3.1, -8.6, 2.75), 1550 * scale, warm, target=(sx * 0.4, -2.0, 1.0),
                  size=3.6, size_y=2.4)
            light(f"Low{sx}", "AREA", (sx * 1.6, -8.0, 0.9), 260 * scale, warm, target=(sx * 0.6, -1.5, 0.6),
                  size=2.4, size_y=1.0)
        if top:
            light("Top", "AREA", (0.0, -2.4, RH - 0.06), 520 * scale, warm, rot=(0, 0, 0), size=5.6, size_y=3.6)
        light("BackFill", "AREA", (0.0, -0.9, RH - 0.06), 120 * scale, warm, rot=(0, 0, 0), size=6.0, size_y=1.0)

    def light_ghost(self, loc=(0.0, -2.4), height=1.6, power=260.0, stand=True):
        """Theatre ghost light: a bare bulb in a wire cage on a pole stand; the only light."""
        s = scene()
        s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.0045, 0.006, 1)
        s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
        gx, gy = loc
        warm = kelvin(2700)
        metal = make_mat("GhostMetal", hexc("#4A4A48"), 0.45, metallic=0.7, var=0.06, grime=0.3)
        dark = make_mat("GhostDark", hexc("#151515"), 0.6, var=0.04)
        bulb_z = height + 0.1
        if stand:
            gl = empty("GhostLight", (gx, gy, 0.0), (0, 0, 20))
            cyl("GhostBase", (0, 0, 0.02), 0.2, 0.04, dark, verts=32, bevel=0.01, parent=gl)
            cyl("GhostPole", (0, 0, height / 2), 0.016, height, metal, verts=12, parent=gl)
            cyl("GhostSocket", (0, 0, height + 0.03), 0.028, 0.07, dark, verts=16, parent=gl)
            wire = make_mat("CageWire", hexc("#2B2B2B"), 0.5, metallic=0.6, var=0.0)
            for kk in range(6):
                rr = empty(f"CageRib{kk}", (0, 0, bulb_z), (0, 0, 60.0 * kk), parent=gl)
                tube(f"CageRibW{kk}", [(0.0, 0.0, -0.07), (0.085, 0.0, -0.04), (0.095, 0.0, 0.05),
                                       (0.05, 0.0, 0.13), (0.0, 0.0, 0.15)], 0.0028, wire).parent = rr
            for zz, r in ((bulb_z - 0.04, 0.088), (bulb_z + 0.05, 0.094)):
                torus(f"CageRing{zz:.2f}", (0, 0, zz), r, 0.003, wire, seg=24, ring=6, parent=gl)
        sphere("GhostBulb", (gx, gy, bulb_z), 0.05, emit_mat("GhostBulbGlow", (*warm, 1.0), 60.0),
               scale=(1, 1, 1.25))
        lt = light("GhostPoint", "POINT", (gx, gy, bulb_z), power, warm, size=0.04)
        return (gx, gy, bulb_z)


def wide_camera(name="CamWide"):
    return camera(CAM_WIDE["loc"], rot=(90.0, 0.0, 0.0), lens=CAM_WIDE["lens"], shift_y=CAM_WIDE["shift_y"],
                  name=name)


# ============================================================== anchors (meta) helpers
def wpt(root, p):
    bpy.context.view_layer.update()
    return root.matrix_world @ Vector(p)


def proj_pts(pts):
    return [proj(tuple(p)) for p in pts]


def rect_of(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]


def frame_quads():
    zc0, zc1 = FR_Z0, FR_Z0 + FR_H
    yo = FR_Y - 0.03
    outer = [(-FR_W / 2, yo, zc1), (FR_W / 2, yo, zc1), (FR_W / 2, yo, zc0), (-FR_W / 2, yo, zc0)]
    a = FR_W / 2 - FR_M
    yi = FR_Y - 0.034
    inner = [(-a, yi, zc1 - FR_M), (a, yi, zc1 - FR_M), (a, yi, zc0 + FR_M), (-a, yi, zc0 + FR_M)]
    return proj_pts(outer), proj_pts(inner)


def board_quad(t, side):
    h = t.objs[f"half_{side}"]
    if "board" not in h:
        return None
    ob, bw, bh = h["board"]
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    pts = [mw @ Vector((sx * bw / 2, -0.0095, sz * bh / 2)) for sx, sz in ((-1, 1), (1, 1), (1, -1), (-1, -1))]
    q = proj_pts(pts)
    if side == "B":                       # x = -1 root: keep the quad clockwise from the image top-left
        q = [q[1], q[0], q[3], q[2]]
    return q


def screen_quad(t, side):
    ob, w, h = t.objs[f"half_{side}"]["tv_screen"]
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    q = proj_pts([mw @ Vector((sx * w / 2, 0.0, sz * h / 2)) for sx, sz in ((-1, 1), (1, 1), (1, -1), (-1, -1))])
    if side == "B":
        q = [q[1], q[0], q[3], q[2]]
    return q


def door_anchor(t, side):
    root = t.roots[side]
    x0, x1, zs = DOOR
    pts = [wpt(root, (x, -0.001, z)) for x, z in arch_pts(x0, x1, zs, 0.0)]
    poly = proj_pts(pts)
    return rect_of(poly), [[round(p[0], 1), round(p[1], 1)] for p in poly]


def clock_anchor(t, side):
    root = t.roots[side]
    cx, cz, R = CLOCK
    c = proj(tuple(wpt(root, (cx, -0.06, cz))))
    e = proj(tuple(wpt(root, (cx + R * 0.93, -0.06, cz))))
    f = proj(tuple(wpt(root, (cx, -0.06, cz + R * 0.93))))
    return dict(centre=c, radius=round(abs(e[0] - c[0]), 1), radius_y=round(abs(f[1] - c[1]), 1),
                rim_radius=round(abs(e[0] - c[0]) / 0.93, 1),
                direction=("clockwise" if side == "A" else "anticlockwise (numerals mirror-written)"))


def chest_lid(t, side):
    p = t.objs[f"half_{side}"]["chest_lid_top"]
    return proj(tuple(wpt(t.roots[side], p)))


def chair_anchor(root, z=0.33):
    cx, cy, _ = CHAIR
    return proj(tuple(wpt(root, (cx, cy, z))))


def twin_marks():
    """Floor marks for BIM/MIB in the wide: the floor points under (205, 440) and (435, 440) at 640x480."""
    s = scene()
    k = s.render.resolution_x / 640.0
    a = floor_at_pixel(205 * k, 440 * k, 0.0)
    return (round(a.x, 4), round(a.y, 4), 0.0), (round(-a.x, 4), round(a.y, 4), 0.0)


def twin_anchor(mark):
    foot = proj(mark)
    head = proj((mark[0], mark[1], TWIN_H))
    return foot, round(foot[1] - head[1], 1)


# ============================================================== Turnaround renders
def setup_color(look="AgX - Base Contrast", exposure=0.0, transform="AgX"):
    s = scene()
    s.view_settings.view_transform = transform
    s.view_settings.look = look
    s.view_settings.exposure = exposure


BRIGHT_EXPOSURE = float(os.environ.get("OPP_BRIGHT_EXPOSURE", "0.0"))


def render_wide(variant="wide"):
    late = variant == "wide_late"
    reset(1280, 960, samples=48)
    setup_color("AgX - Base Contrast", BRIGHT_EXPOSURE)
    chairs = {"A": "bare", "B": "blanket"} if late else {"A": "blanket", "B": None}
    t = Turnaround(chairs=chairs).build()
    t.light_bright()
    wide_camera()
    m_bim, m_mib = twin_marks()
    name = "turnaround_wide_late" if late else "turnaround_wide"
    render(name)
    fo, fi = frame_quads()
    foot_b, h_b = twin_anchor(m_bim)
    foot_m, h_m = twin_anchor(m_mib)
    da, da_poly = door_anchor(t, "A")
    db, db_poly = door_anchor(t, "B")
    meta = dict(
        frame_outer=rect_of(fo), frame_outer_quad=fo, frame_opening=rect_of(fi), frame_opening_quad=fi,
        foot_bim=foot_b, foot_mib=foot_m, twin_height_px=h_b, twin_height_note=f"{TWIN_H} m puppet on its mark",
        marks_world=dict(bim=list(m_bim), mib=list(m_mib)),
        px_per_m_at_marks=px_per_m_at(m_bim),
        chair_a=chair_anchor(t.roots["A"]), chair_b_spot=chair_anchor(t.roots["B"]),
        chair_a_floor=chair_anchor(t.roots["A"], 0.0), chair_b_floor=chair_anchor(t.roots["B"], 0.0),
        door_a=da, door_b=db, door_a_poly=da_poly, door_b_poly=db_poly,
        clock_a=clock_anchor(t, "A"), clock_b=clock_anchor(t, "B"),
        crt_a=screen_quad(t, "A"), crt_b=screen_quad(t, "B"),
        board_a=board_quad(t, "A"), board_b=board_quad(t, "B"),
        chest_a_lid=chest_lid(t, "A"), chest_b_lid=chest_lid(t, "B"),
        nail_a=proj(tuple(wpt(t.roots["A"], (NAIL[0], -0.025, NAIL[1])))),
        pale_rect_b=rect_of(proj_pts([wpt(t.roots["B"], (NAIL[0] + sx * PORTRAIT[0] / 2, 0.0, NAIL[1] - 0.05 - sz))
                                      for sx in (-1, 1) for sz in (0.0, PORTRAIT[1])])),
        pendant_a=proj(tuple(wpt(t.roots["A"], (PENDANT[0], PENDANT[1], PENDANT[2] + 0.03)))),
        pendant_b=proj(tuple(wpt(t.roots["B"], (PENDANT[0], PENDANT[1], PENDANT[2] + 0.03)))),
        horizon_y=proj((0.0, 50.0, CAM_WIDE["loc"][2]))[1],
        note="1280x960 render (2x of the 640x480 layout); every coordinate is in 1280x960 pixels. Clocks have "
             "no hands. Set B's clock is mirror-written. Doorways are pure black (void) inside door_*_poly.")
    if late:
        meta["chair_b"] = chair_anchor(t.roots["B"])
        meta["chair_b_rect"] = proj_obj_bbox(t.objs["half_B"]["chair"])
    meta["chair_a_rect"] = proj_obj_bbox(t.objs["half_A"]["chair"]) if t.objs["half_A"].get("chair") else None
    save_blend(name)
    write_meta(name, meta)
    if late:
        post_late()


def post_late():
    """turnaround_wide_late keeps turnaround_wide's pixels everywhere except around the two chairs."""
    a_p = os.path.join(OUT_IMG, "turnaround_wide.png")
    b_p = os.path.join(OUT_IMG, "turnaround_wide_late.png")
    if not os.path.exists(a_p):
        print("post_late: turnaround_wide missing, leaving wide_late as rendered")
        return
    a = load_png(a_p)
    b = load_png(b_p)
    if a.shape != b.shape:
        print("post_late: size mismatch; skipped")
        return
    meta = json.load(open(META_PATH))
    m = meta.get("turnaround_wide_late", {})
    mask = np.zeros(a.shape[:2], np.float32)
    for key in ("chair_a_rect", "chair_b_rect"):
        r = m.get(key)
        if r:
            x0, y0, x1, y1 = int(r[0]) - 40, int(r[1]) - 40, int(r[2]) + 40, int(r[3]) + 60
            mask[max(0, y0):y1, max(0, x0):x1] = 1.0
    diff = (np.abs(a - b).max(axis=2) > (5.0 / 255.0)).astype(np.float32)
    keep = np.clip(blur_np(diff[..., None], 4)[..., 0] * 3.0, 0, 1) * mask
    keep = np.clip(blur_np(keep[..., None], 2)[..., 0], 0, 1)
    out = a * (1 - keep[..., None]) + b * keep[..., None]
    save_png(b_p, out)
    print("wide_late: kept", int((keep > 0.5).sum()), "changed pixels; the rest is turnaround_wide")


FRAME_CAM = dict(loc=(0.0, -5.0, 1.0), lens=35.0, shift_y=-0.023)


def frame_camera():
    return camera(FRAME_CAM["loc"], rot=(90.0, 0.0, 0.0), lens=FRAME_CAM["lens"], shift_y=FRAME_CAM["shift_y"],
                  name="CamFrame")


def render_frame(dim=False):
    reset(640, 480, samples=64 if not dim else 96)
    setup_color("AgX - Base Contrast", BRIGHT_EXPOSURE)
    t = Turnaround(chairs={"A": "blanket", "B": None}, pendants_on=not dim).build()
    if dim:
        light_dim_rig()
    else:
        t.light_bright()
    frame_camera()
    name = "turnaround_frame_dim" if dim else "turnaround_frame"
    render(name)
    fo, fi = frame_quads()
    meta = dict(frame_outer=rect_of(fo), frame_outer_quad=fo, frame_opening=rect_of(fi), frame_opening_quad=fi,
                board_a=board_quad(t, "A"), board_b=board_quad(t, "B"),
                head_bim=[150, 170], head_mib=[490, 170],
                chest_a_lid=chest_lid(t, "A"), chest_b_lid=chest_lid(t, "B"),
                note="Twin heads are compositor anchors (waist-up cut-outs); the boards are the chalk surfaces.")
    save_blend(name)
    write_meta(name, meta)


def light_dim_rig():
    """turnaround_frame_dim: the studio lights off; one narrow hard warm spot over the frame; a whisper of
    cold bounce so the blacks are not dead."""
    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.03, 0.04, 0.06, 1)
    s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.012
    light("FrameSpot", "SPOT", (0.0, FR_Y - 0.75, RH - 0.08), 950.0, kelvin(3200), target=(0.0, FR_Y - 0.1, 0.55),
          size=0.025, spot=30.0, blend=0.12)
    light("ColdBounce", "AREA", (0.0, -8.6, 2.2), 60.0, (0.55, 0.68, 1.0), target=(0.0, -2.0, 1.0), size=4.0,
          size_y=2.0)


def render_portrait():
    reset(640, 480, samples=64)
    setup_color("AgX - Base Contrast", BRIGHT_EXPOSURE)
    t = Turnaround(chairs={"A": "blanket", "B": None}).build()
    t.light_bright()
    nx, nz = NAIL
    dist = 2.55
    cam = camera((nx, -dist, 1.45), rot=(90.0, 0.0, 0.0), lens=45.0, name="CamPortrait")
    # shift so the nail sits at (320, 150) while the camera stays square to the wall at eye height 1.45
    F = 45.0 / 36.0 * 640.0
    dy = (nz - 1.45) * F / dist
    cam.data.shift_y = -(240.0 - 150.0 - dy) / 640.0
    render("turnaround_portrait")
    root = t.roots["A"]
    meta = dict(nail_a=proj(tuple(wpt(root, (nx, -0.025, nz)))),
                portrait_clear=[210, 120, 430, 380],
                chest_a_lid=chest_lid(t, "A"),
                door_a=door_anchor(t, "A")[0], door_a_poly=door_anchor(t, "A")[1],
                px_per_m_wall=round(F / dist, 1),
                portrait_size_px=[round(PORTRAIT[0] * F / dist, 1), round(PORTRAIT[1] * F / dist, 1)],
                clock_a=None,
                note="Set A's clock hangs above the doorway, out of this frame (clock_a is null: no hands to draw). "
                     "The black arch at the left is Set A's doorway. The portrait hangs from nail_a by its ring.")
    save_blend("turnaround_portrait")
    write_meta("turnaround_portrait", meta)


def bloom_post(path, thresh=0.82, radius=10, amount=0.55):
    a = load_png(path)
    lum = a.max(axis=2, keepdims=True)
    hi = np.clip((lum - thresh) / (1 - thresh), 0, 1) * a
    g = blur_np(hi, radius) * amount + blur_np(hi, radius * 3) * amount * 0.6
    save_png(path, np.clip(a + g, 0, 1))


def render_night():
    reset(960, 720, samples=96)
    setup_color("AgX - Base Contrast", float(os.environ.get("OPP_NIGHT_EXPOSURE", "0.0")))
    t = Turnaround(chairs={"A": "blanket", "B": None}, pendants_on=False).build()
    bulb = t.light_ghost((0.0, -2.4), height=1.6, power=float(os.environ.get("OPP_GHOST_W", "180")))
    loc = (CAM_WIDE["loc"][0], CAM_WIDE["loc"][1], CAM_WIDE["loc"][2] + 0.35)
    camera(loc, rot=(87.0, 0.0, 0.0), lens=32.0, name="CamNight")
    render("turnaround_night")
    bloom_post(os.path.join(OUT_IMG, "turnaround_night.png"))
    fo, fi = frame_quads()
    da, dap = door_anchor(t, "A")
    db, dbp = door_anchor(t, "B")
    meta = dict(chair_a=chair_anchor(t.roots["A"]), chair_a_rect=proj_obj_bbox(t.objs["half_A"]["chair"]),
                door_a=da, door_b=db, door_a_poly=dap, door_b_poly=dbp,
                frame_opening=rect_of(fi), frame_opening_quad=fi, frame_outer=rect_of(fo),
                ghost_bulb=proj(bulb), chair_b_spot=chair_anchor(t.roots["B"]),
                note="960x720. Only light: the ghost light. Doorways pure black.")
    save_blend("turnaround_night")
    write_meta("turnaround_night", meta)


def render_crt_b():
    reset(1280, 960, samples=64)
    setup_color("AgX - Base Contrast", BRIGHT_EXPOSURE)
    t = Turnaround(chairs={"A": "blanket", "B": None}).build()
    t.light_bright()
    scr, w, h = t.objs["half_B"]["tv_screen"]
    bpy.context.view_layer.update()
    mw = scr.matrix_world
    c = mw @ Vector((0, -0.008, 0))
    n = (mw.to_3x3() @ Vector((0, -1, 0))).normalized()
    n.z = 0
    n.normalize()
    d = 0.98
    cam_loc = (c.x + n.x * d, c.y + n.y * d, 0.80)
    camera(cam_loc, target=(c.x, c.y, c.z), lens=50.0, name="CamCRT")
    render("crt_set_b")
    q = screen_quad(t, "B")
    meta = dict(crt_screen_quad=q, crt_screen_rect=rect_of(q),
                note="1280x960; the screen glass is dark (no tube glow); quad is the glass edge, clockwise from "
                     "top-left. The glass bulges ~16 mm at the centre.")
    save_blend("crt_set_b")
    write_meta("crt_set_b", meta)


REV_CAM = dict(loc=(0.46, -0.32, 0.75), target=(-1.02, -3.25, 0.58), lens=22.0)


def render_reverse():
    reset(640, 480, samples=96)
    setup_color("AgX - Base Contrast", BRIGHT_EXPOSURE)
    loc = Vector(REV_CAM["loc"])
    d = Vector(REV_CAM["target"]) - loc
    d.z = 0
    d.normalize()
    left = Vector((-d.y, d.x, 0.0))
    # Set A's easel turned to face this camera; Set B's easel brought round to our side, board lowered
    ex, ey = EASEL[0], EASEL[1]
    yaw_a = math.degrees(math.atan2(loc.x - ex, -(loc.y - ey)))
    t = Turnaround(chairs={"A": "bare", "B": None}, front_wall=True, easel_a=(ex, ey, yaw_a),
                   easel_b="hide", pendants_on=True)
    t.build()
    HB = t.half_materials("B", t.roots["B"])
    bc = loc + d * float(os.environ.get("OPP_REV_EB_F", "1.05")) + left * float(os.environ.get("OPP_REV_EB_L", "0.66"))
    yaw_b = math.degrees(math.atan2(loc.x - bc.x, -(loc.y - bc.y)))
    eb = t.build_easel("EaselOurs", HB, None, bc.x, bc.y, yaw_b, float(os.environ.get("OPP_REV_EB_Z", "0.80")))
    # our chair, with the blanket: bottom-right foreground, facing the frame, right in front of us
    cp = loc + d * 0.52 - left * 0.30
    yaw_c = math.degrees(math.atan2(d.x, -d.y))
    t.build_chair("ChairOurs", HB, None, (cp.x, cp.y, yaw_c), blanket=True)
    # light: the room is closed by the fourth wall now, so the studio keys become ceiling soft-boxes
    s = scene()
    cool = kelvin(5600)
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (*cool, 1)
    s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.03
    for sx in (-1, 1):
        light(f"RevKey{sx}", "AREA", (sx * 1.9, -1.0, RH - 0.06), 330 * 0.85, cool, rot=(0, 0, 0), size=2.4,
              size_y=1.6)
        light(f"RevFront{sx}", "AREA", (sx * 1.9, -4.0, RH - 0.06), 330 * 0.85, cool, rot=(0, 0, 0), size=2.4,
              size_y=1.6)
    light("RevTop", "AREA", (0.0, -2.5, RH - 0.06), 380 * 0.85, cool, rot=(0, 0, 0), size=3.0, size_y=2.4)
    cam = camera(REV_CAM["loc"], target=REV_CAM["target"], lens=REV_CAM["lens"], name="CamReverse")
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = (Vector(REV_CAM["target"]) - Vector(REV_CAM["loc"])).length
    cam.data.dof.aperture_fstop = 2.0
    render("turnaround_reverse")
    fo, fi = frame_quads()
    ob, bw, bh = eb["board"]
    bpy.context.view_layer.update()
    mw = ob.matrix_world
    near = proj_pts([mw @ Vector((sx * bw / 2, -0.0095, sz * bh / 2)) for sx, sz in ((-1, 1), (1, 1), (1, -1), (-1, -1))])
    meta = dict(frame_opening=rect_of(fi), frame_opening_quad=fi,
                board_a=board_quad(t, "A"), board_b_near=near,
                chair_a=chair_anchor(t.roots["A"]),
                door_a=door_anchor_front(t, "A"), clock_a=clock_anchor_front(t, "A"),
                note="Reverse angle from behind the frame on Set B's side. Through the opening: Set A's chair (bare), "
                     "Set A's easel turned to us, and Set A's fourth wall (doorway, handless clock, chest) - all "
                     "reading mirrored, because we are on the wrong side. Our chair + blanket bottom-right, soft.")
    save_blend("turnaround_reverse")
    write_meta("turnaround_reverse", meta)


def door_anchor_front(t, side):
    root = t.roots["F" + side]
    x0, x1, zs = DOOR
    poly = proj_pts([wpt(root, (x, -0.001, z)) for x, z in arch_pts(x0, x1, zs, 0.0)])
    return dict(rect=rect_of(poly), poly=[[round(p[0], 1), round(p[1], 1)] for p in poly])


def clock_anchor_front(t, side):
    root = t.roots["F" + side]
    cx, cz, R = CLOCK
    c = proj(tuple(wpt(root, (cx, -0.06, cz))))
    e = proj(tuple(wpt(root, (cx + R * 0.93, -0.06, cz))))
    f = proj(tuple(wpt(root, (cx, -0.06, cz + R * 0.93))))
    return dict(centre=c, radius_x=round(abs(e[0] - c[0]), 1), radius_y=round(abs(f[1] - c[1]), 1))




def drape_path(name, wid, path, mat, x_center=0.0, amp=0.01, nu=40, nv=40, parent=None, thick=0.012):
    """A cloth strip of width `wid` (along x) laid along a (y, z) polyline, with soft wrinkles; UV u across,
    v along."""
    seg = [0.0]
    for i in range(1, len(path)):
        seg.append(seg[-1] + math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
    L = seg[-1]

    def at(s_):
        for i in range(1, len(path)):
            if s_ <= seg[i] or i == len(path) - 1:
                t = (s_ - seg[i - 1]) / max(1e-9, seg[i] - seg[i - 1])
                y = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t
                z = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t
                ty, tz = path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]
                ln = math.hypot(ty, tz) or 1.0
                return y, z, ty / ln, tz / ln
        return path[-1][0], path[-1][1], 0.0, -1.0

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(nv + 1):
        v = j / nv
        y, z, ty, tz = at(v * L)
        row = []
        for i in range(nu + 1):
            u = i / nu
            w = amp * (math.sin(2 * math.pi * (u * 3.1 + v * 1.3)) + 0.6 * math.sin(2 * math.pi * (u * 7.7 - v * 2.9)))
            row.append(bm.verts.new((x_center + (u - 0.5) * wid, y - tz * w, z + ty * w)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for lp, (uu, vv) in zip(f.loops, ((i / nu, j / nv), ((i + 1) / nu, j / nv),
                                              ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv))):
                lp[uvl].uv = (uu, vv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = _finish(name, bm, mat, (0, 0, 0), (0, 0, 0), parent, smooth=True)
    so = ob.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = thick
    so.offset = 0.0
    return ob


# ============================================================== the dark studio round the set
STUDIO_Z = -0.32          # studio floor (the set stands on a 32 cm platform)


def concrete_mat(name="StudioConcrete", tone=("#5E5B57", "#4A4845")):
    def concrete(b, vec):
        p = b.coords("world")
        n1 = b.noise(p, 0.35, 6.0, 0.65)
        n2 = b.noise(p, 3.0, 4.0, 0.6)
        base = b.mix(b.rgb(hexc(tone[0])), b.rgb(hexc(tone[1])), b.maprange(n1, 0.35, 0.65, 0.0, 1.0))
        stain = b.maprange(n2, 0.62, 0.7, 1.0, 0.72)
        return b.scale(base, stain)
    return make_mat(name, rough=0.6, var=0.06, var_scale=1.0, space="world", base=concrete, rough_var=0.2,
                    bump=0.08, bump_scale=60, grime=0.25, grime_scale=0.4)


def studio_surround(cameras=True, seed=4):
    """Concrete floor, black drapes, two pedestal cameras facing the set and cable runs (in front of the set)."""
    floor = concrete_mat()
    box2("StudioFloor", (-16.0, -18.0, STUDIO_Z - 0.1), (16.0, 6.0, STUDIO_Z), floor)
    drape = make_mat("Drape", hexc("#161517"), 0.95, var=0.1, sheen=0.3, normal_fn=lambda b, v: _drape_normal(b))
    box2("DrapeFront", (-16.0, -16.2, STUDIO_Z), (16.0, -16.0, 8.0), drape)
    box2("DrapeL", (-12.2, -18.0, STUDIO_Z), (-12.0, 6.0, 8.0), drape)
    box2("DrapeR", (12.0, -18.0, STUDIO_Z), (12.2, 6.0, 8.0), drape)
    box2("StudioCeil", (-16.0, -18.0, 7.0), (16.0, 6.0, 7.2), make_mat("StudioCeilM", hexc("#1E1E20"), 0.9))
    rubber = make_mat("CableRubber", hexc("#121212"), 0.5, var=0.05, spec=0.4)
    rng = np.random.default_rng(seed)
    paths = [
        [(-0.9, -5.4), (-1.6, -6.2), (-0.8, -7.4), (-2.2, -8.6), (-1.5, -10.5)],
        [(0.6, -5.3), (1.5, -6.0), (2.6, -5.6), (3.4, -6.9), (5.5, -7.2)],
        [(-2.6, -5.5), (-3.4, -6.6), (-4.6, -6.1), (-6.0, -7.4)],
        [(1.9, -5.4), (1.2, -7.0), (2.2, -8.1), (1.4, -9.6)],
    ]
    for k, path in enumerate(paths):
        pts = [(x + float(rng.uniform(-0.08, 0.08)), y, STUDIO_Z + 0.017) for x, y in path]
        tube(f"Cable{k}", pts, 0.016, rubber)
    for k, (cx, cy) in enumerate(((-1.2, -6.5), (2.8, -7.0))):
        torus(f"CableCoil{k}", (cx, cy, STUDIO_Z + 0.03), 0.3, 0.018, rubber, seg=40, ring=8)
        torus(f"CableCoilB{k}", (cx + 0.04, cy + 0.02, STUDIO_Z + 0.065), 0.27, 0.018, rubber, seg=40, ring=8)
    if cameras:
        body = make_mat("CamBody", hexc("#3B3E42"), 0.45, var=0.05, grime=0.2)
        dark = make_mat("CamDark", hexc("#141516"), 0.5, var=0.04)
        metal = make_mat("StudioMetal", hexc("#6A6C6E"), 0.35, metallic=0.8, var=0.06, grime=0.3)
        studio_camera_rig("TVCam1", (-1.9, -8.4, STUDIO_Z), 180 + 12, body, dark, metal)
        studio_camera_rig("TVCam2", (2.3, -9.2, STUDIO_Z), 180 - 15, body, dark, metal)


# ============================================================== MIRROR STUDIO (behind Set B)
def render_mirror_studio():
    reset(960, 720, samples=int(os.environ.get("OPP_MS_SAMPLES", "128")))
    setup_color("AgX - Base Contrast", float(os.environ.get("OPP_MS_EXPOSURE", "1.4")))
    s = scene()
    s.cycles.volume_bounces = 1
    t = Turnaround(chairs={"A": "blanket", "B": "blanket"}, pendants_on=False, easel_b="hide").build()
    t.mirror_world()
    floor = concrete_mat()
    box2("StudioFloor", (-12.0, -16.0, STUDIO_Z - 0.1), (12.0, 4.0, STUDIO_Z), floor)
    box2("FarDrape", (-12.0, 3.0, STUDIO_Z), (12.0, 3.2, 8.0), make_mat("Drape", hexc("#121113"), 0.95, var=0.1))
    # the gap we peer through: two flats close to the camera, plywood edges
    cam_loc = (0.42, -9.3, STUDIO_Z + 1.5)
    ply = make_mat("PlyEdge", rough=0.85, var=0.08, grime=0.45, grime_scale=3.0, space="world",
                   base=wood_base(hexc("#8A6A48"), hexc("#5E4630"), 3.0, "Z"))
    pine = make_mat("FlatFrame", rough=0.8, var=0.08, grime=0.4, space="world",
                    base=streak_wood(hexc("#9C7A52"), hexc("#7A5C3C"), "z"))
    gy = cam_loc[1] + 0.85
    for sx, x_edge in ((-1, cam_loc[0] - 0.32), (1, cam_loc[0] + 0.30)):
        xa, xb = (x_edge - 1.2, x_edge) if sx < 0 else (x_edge, x_edge + 1.2)
        box2(f"GapFlat{sx}", (xa, gy, STUDIO_Z), (xb, gy + 0.018, STUDIO_Z + 3.6), ply)
        ex = x_edge if sx < 0 else x_edge
        box2(f"GapStile{sx}", (ex - 0.045 if sx < 0 else ex, gy + 0.018, STUDIO_Z),
             (ex if sx < 0 else ex + 0.045, gy + 0.11, STUDIO_Z + 3.6), pine)
        for z in (0.6, 1.8, 3.0):
            box2(f"GapToggle{sx}{z}", (xa, gy + 0.018, STUDIO_Z + z), (xb, gy + 0.11, STUDIO_Z + z + 0.07), pine)
    # dust in the air: a thin scattering volume + a few motes near the gap
    vol = bpy.data.materials.new("Dust")
    nb = NB(vol)
    nb.n.remove(nb.n["Principled BSDF"])
    sc = nb.node("ShaderNodeVolumeScatter")
    sc.inputs["Density"].default_value = float(os.environ.get("OPP_DUST", "0.035"))
    sc.inputs["Anisotropy"].default_value = 0.45
    nb.l.new(sc.outputs[0], nb.n["Material Output"].inputs["Volume"])
    box2("DustVolume", (-4.0, -8.3, STUDIO_Z + 0.01), (4.0, 0.0, 3.15), vol)
    mote = emit_mat("Mote", (0.75, 0.82, 0.9, 1), 0.6)
    rng = np.random.default_rng(9)
    bm = bmesh.new()
    for _ in range(140):
        p = (cam_loc[0] + rng.uniform(-0.9, 0.9), cam_loc[1] + rng.uniform(1.4, 4.5), rng.uniform(0.0, 2.4))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=float(rng.uniform(0.0012, 0.0028)),
                                   matrix=Matrix.Translation(p))
    _finish("Motes", bm, mote, (0, 0, 0), (0, 0, 0), None)
    # light: a faint cold wash, low and to the right, as if from a dead TV screen
    cold = kelvin(6500)
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.002, 0.0025, 0.004, 1)
    light("ColdWash", "AREA", (3.6, -4.2, 0.6), float(os.environ.get("OPP_MS_WASH", "55")), cold,
          target=(-0.6, -1.6, 0.9), size=1.2, size_y=0.9)
    light("TVScreenWash", "AREA", (2.62, -1.95, 0.72), 6.0, (0.55, 0.68, 0.95), target=(0.0, -2.6, 0.6),
          size=0.3, size_y=0.22)
    light("FrameRim", "AREA", (1.9, -0.6, 2.6), 8.0, cold, target=(0.3, -1.4, 1.2), size=0.8, size_y=0.8)
    cam = camera(cam_loc, target=(0.0, FR_Y, 0.95), lens=30.0, roll=4.0, name="CamMirrorStudio")
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = abs(cam_loc[1] - FR_Y)
    cam.data.dof.aperture_fstop = 4.0
    render("mirror_studio")
    a = FR_W / 2 - FR_M
    zc0, zc1 = FR_Z0 + FR_M, FR_Z0 + FR_H - FR_M
    yi = FR_Y - 0.034
    q = proj_pts([(-a, yi, zc1), (a, yi, zc1), (a, yi, zc0), (-a, yi, zc0)])
    h5 = (-0.95, -1.62, 0.0)
    meta = dict(far_frame_opening=rect_of(q), far_frame_opening_quad=q, h5_foot=proj(h5),
                h5_px_per_m=px_per_m_at(h5),
                gap=[proj((cam_loc[0] - 0.32, gy, STUDIO_Z + 1.5))[0], proj((cam_loc[0] + 0.30, gy, STUDIO_Z + 1.5))[0]],
                chairs=[proj((-CHAIR[0], CHAIR[1], 0.33)), proj((CHAIR[0], CHAIR[1], 0.33))],
                note="960x720. The far set is the Turnaround Room mirrored (blue left, yellow right). H5 stands at "
                     "h5_foot (just left of the far frame) in a clear dark spot.")
    save_blend("mirror_studio")
    write_meta("mirror_studio", meta)


# ============================================================== FRAME MIRROR NIGHT
def render_frame_mirror_night():
    reset(640, 480, samples=int(os.environ.get("OPP_FM_SAMPLES", "128")))
    setup_color("AgX - Base Contrast", float(os.environ.get("OPP_FM_EXPOSURE", "0.6")))
    t = Turnaround(chairs={"A": "bare", "B": "blanket"}, pendants_on=False, frame_mirror=True).build()
    studio_surround()
    gx, gy = 1.15, -4.05
    bulb = t.light_ghost((gx, gy), height=1.45, power=float(os.environ.get("OPP_FM_GHOST", "110")))
    cam = camera((0.0, -3.0, 1.5), target=(0.0, FR_Y, 1.5), lens=32.0, roll=2.0, name="CamMirror")
    render("frame_mirror_night")
    bloom_post(os.path.join(OUT_IMG, "frame_mirror_night.png"), thresh=0.85, radius=6, amount=0.4)
    a = FR_W / 2 - FR_M
    zc0, zc1 = FR_Z0 + FR_M, FR_Z0 + FR_H - FR_M
    yi = FR_Y - 0.004
    q = proj_pts([(-a, yi, zc1), (a, yi, zc1), (a, yi, zc0), (-a, yi, zc0)])
    # reflections: the virtual image of a point P is P mirrored in the plane y = FR_Y
    refl = lambda p: (p[0], 2 * FR_Y - p[1], p[2])  # noqa: E731
    lamp = proj(refl(bulb))
    foot = proj(refl((0.0, -3.0, 0.0)))
    meta = dict(mirror_quad=q, mirror_rect=rect_of(q), refl_lamp=lamp, refl_figure_foot=foot,
                refl_figure_px_per_m=round(abs(proj(refl((0.0, -3.0, 1.0)))[1] - foot[1]), 1),
                note="640x480. mirror_quad is the glass (it runs off the top/bottom of the image). refl_figure_foot = "
                     "where the camera operator's feet would be in the reflection (virtual image of the floor under "
                     "the camera); refl_lamp = the reflected ghost light.")
    save_blend("frame_mirror_night")
    write_meta("frame_mirror_night", meta)


# ============================================================== BEHIND SET B
def render_behind_set():
    reset(640, 480, samples=int(os.environ.get("OPP_BS_SAMPLES", "128")))
    setup_color("AgX - Base Contrast", float(os.environ.get("OPP_BS_EXPOSURE", "1.0")))
    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
    floor = concrete_mat("PassageConcrete", ("#6A6662", "#55524E"))
    box2("PFloor", (-3.0, -3.0, -0.1), (4.0, 10.0, 0.0), floor)
    ply = make_mat("PlyBack", rough=0.85, var=0.1, var_scale=2.5, grime=0.4, grime_scale=1.8, space="world",
                   floor_dirt=0.35, base=wood_base(hexc("#B08A60"), hexc("#8E6C48"), 2.2, "Z", 6.0))
    ply2 = make_mat("PlyBack2", rough=0.85, var=0.1, var_scale=2.5, grime=0.45, grime_scale=1.6, space="world",
                    floor_dirt=0.35, base=wood_base(hexc("#A47F58"), hexc("#7E603F"), 2.4, "Y", 6.0))
    pine = make_mat("TwoByFour", rough=0.8, var=0.08, grime=0.35, space="world",
                    base=streak_wood(hexc("#C9A577"), hexc("#A88356"), "z"))
    pine_y = make_mat("TwoByFourY", rough=0.8, var=0.08, grime=0.35, space="world",
                      base=streak_wood(hexc("#C9A577"), hexc("#A88356"), "y"))
    paint = make_mat("StencilPaint", hexc("#121110"), 0.7, var=0.05, grime=0.2)
    tape = make_mat("GaffTape", hexc("#2A2A2A"), 0.55, var=0.08, grime=0.3)
    rubber = make_mat("CableRubber", hexc("#151515"), 0.5, var=0.05, spec=0.4)
    steel = make_mat("StageWeight", hexc("#3E3F40"), 0.5, metallic=0.6, var=0.08, grime=0.4)
    sand = make_mat("Sandbag", hexc("#3C3630"), 0.95, var=0.12, bump=0.3, bump_scale=40, grime=0.3)
    clamp_m = make_mat("CClamp", hexc("#2F3A6A"), 0.45, metallic=0.4, var=0.08, grime=0.4)
    H_ = 3.3
    XL, XR = -0.52, 0.50
    fw = 1.22
    # left: the backs of Set B's flats (plywood faces toward +x, 1x3 framing proud of the plywood)
    for i in range(6):
        y0, y1 = 0.3 + i * fw, 0.3 + (i + 1) * fw
        box2(f"LFlat{i}", (XL - 0.018, y0 + 0.003, 0.0), (XL, y1 - 0.003, H_), ply)
        for yy in (y0 + 0.004, y1 - 0.074):
            box2(f"LStile{i}{yy:.2f}", (XL, yy, 0.0), (XL + 0.07, yy + 0.07, H_), pine_y)
        for z in (0.0, 1.1, 2.2, H_ - 0.07):
            box2(f"LToggle{i}{z}", (XL, y0 + 0.07, z), (XL + 0.06, y1 - 0.07, z + 0.07), pine_y)
        if i in (0, 2, 4):
            # a jack brace leaning into the passage, a stage weight + a sandbag on its foot
            yb = (y0 + y1) / 2
            box(f"LJack{i}", (XL + 0.24, yb, 1.25), (0.045, 0.07, 2.65), pine, rot=(0, 11.0, 0))
            box2(f"LJackFoot{i}", (XL + 0.02, yb - 0.035, 0.0), (XL + 0.5, yb + 0.035, 0.07), pine_y)
            box(f"Weight{i}", (XL + 0.36, yb + 0.12, 0.05), (0.28, 0.16, 0.1), steel, rot=(0, 0, 8), bevel=0.006)
            sb = sphere(f"Sandbag{i}", (XL + 0.33, yb - 0.12, 0.08), 0.15, sand, scale=(1.1, 0.75, 0.55),
                        rot=(0, 0, 15 * i))
        # C-clamps joining this flat to the next
        if i < 5:
            for z in (0.8, 2.4):
                torus(f"Clamp{i}{z}", (XL + 0.04, y1, z), 0.06, 0.012, clamp_m, rot=(90, 0, 0), seg=20, ring=8)
                cyl(f"ClampScrew{i}{z}", (XL + 0.06, y1, z), 0.008, 0.16, steel, rot=(0, 90, 0), verts=8)
    # stencils on the plywood: only B-3 and B-4
    fnt = font(FONT_STENCIL)
    for i, label in ((1, "B-3"), (2, "B-4")):
        yc = 0.3 + (i + 0.5) * fw
        text_obj(f"Stencil{label}", label, 0.30, paint, (XL + 0.001, yc, 1.62), rot=(90, 0, 90), extrude=0.0004,
                 fnt=fnt)
    # right: the backs of another run of flats (no numbers), ending at y = 5.3 - the passage turns right there
    for i in range(4):
        y0, y1 = 0.0 + i * fw * 1.08, 0.0 + (i + 1) * fw * 1.08
        y1 = min(y1, 5.3)
        if y1 - y0 < 0.2:
            continue
        box2(f"RFlat{i}", (XR, y0 + 0.003, 0.0), (XR + 0.018, y1 - 0.003, H_), ply2)
        for yy in (y0 + 0.004, y1 - 0.074):
            box2(f"RStile{i}{yy:.2f}", (XR - 0.07, yy, 0.0), (XR, yy + 0.07, H_), pine_y)
        for z in (0.0, 1.3, 2.5, H_ - 0.07):
            box2(f"RToggle{i}{z}", (XR - 0.06, y0 + 0.07, z), (XR, y1 - 0.07, z + 0.07), pine_y)
    # the corner flat: the right run's end, edge-on, and a flat across the far end of the passage
    box2("CornerEdge", (XR - 0.07, 5.23, 0.0), (XR + 0.02, 5.3, H_), pine_y)
    box2("EndFlat", (XL - 0.1, 6.35, 0.0), (2.6, 6.37, H_), ply)
    for x in (XL + 0.6, 1.2, 2.0):
        box2(f"EndStile{x}", (x, 6.28, 0.0), (x + 0.07, 6.35, H_), pine)
    for z in (0.0, 1.2, 2.4):
        box2(f"EndToggle{z}", (XL, 6.28, z), (2.6, 6.35, z + 0.07), pine_y)
    box2("RoundCornerWall", (2.6, 4.0, 0.0), (2.7, 6.4, H_), ply2)
    # a closed stepladder leaning on the right flats, a cable run taped along the left foot
    lad = make_mat("Ladder", hexc("#8D8A84"), 0.45, metallic=0.6, var=0.08, grime=0.4)
    for sx in (0.0, 0.42):
        box(f"LadRail{sx}", (XR - 0.16, 2.9 + sx, 1.05), (0.04, 0.025, 2.1), lad, rot=(0, -6.0, 0))
    for z in (0.3, 0.6, 0.9, 1.2, 1.5, 1.8):
        box(f"LadStep{z}", (XR - 0.16 + z * 0.1, 3.11, z), (0.06, 0.42, 0.02), lad)
    for k, yy in enumerate((0.4, 5.9)):
        pass
    pts = [(XL + 0.09, -1.0, 0.016), (XL + 0.1, 1.5, 0.016), (XL + 0.08, 3.4, 0.016), (XL + 0.11, 5.2, 0.016),
           (XL + 0.3, 6.1, 0.016), (1.6, 6.15, 0.016)]
    tube("CableRun", pts, 0.014, rubber)
    tube("CableRun2", [(p[0] + 0.035, p[1] + 0.02, p[2] + 0.004) for p in pts[:4]], 0.011, rubber)
    for k in range(9):
        yy = -0.4 + k * 0.72
        if yy > 5.3:
            break
        box(f"Gaff{k}", (XL + 0.1, yy, 0.0215), (0.13, 0.05, 0.004), tape, rot=(0, 0, 3 * (k % 3) - 3))
    tube("CableUp", [(XL + 0.03, 4.4, 0.02), (XL + 0.03, 4.42, 1.2), (XL + 0.05, 4.5, 2.6), (XL + 0.04, 4.6, 3.3)],
         0.009, rubber)
    # light: cold grey spill from round the far corner, a faint warm bounce on the near flats from behind
    cold = kelvin(6500)
    light("CornerSpill", "AREA", (2.2, 5.85, 1.4), float(os.environ.get("OPP_BS_COLD", "70")), cold,
          target=(-0.4, 5.6, 0.9), size=0.8, size_y=2.2)
    light("CornerSpillLow", "AREA", (1.4, 5.8, 0.25), 8.0, cold, target=(-0.6, 5.0, 0.0), size=0.6, size_y=0.4)
    light("GhostBounce", "AREA", (0.15, -1.6, 2.2), float(os.environ.get("OPP_BS_WARM", "9")), kelvin(2700),
          target=(-0.3, 1.2, 1.2), size=0.9, size_y=0.9)
    cam = camera((0.04, -0.6, 1.5), target=(0.05, 6.0, 1.28), lens=28.0, roll=2.0, name="CamBehind")
    render("behind_set")
    meta = dict(far_end=proj((0.0, 6.0, 1.2)), corner=proj((XR, 5.3, 1.2)),
                stencils={"B-3": proj((XL, 0.3 + 1.5 * fw, 1.62)), "B-4": proj((XL, 0.3 + 2.5 * fw, 1.62))},
                note="640x480 camcorder view down the 1 m passage behind Set B; the passage turns right at the far "
                     "end, where the cold light comes from.")
    save_blend("behind_set")
    write_meta("behind_set", meta)


# ============================================================== THE LIVING ROOM (seen from the TV)
def render_livingroom():
    reset(640, 480, samples=int(os.environ.get("OPP_LR_SAMPLES", "128")))
    setup_color("AgX - Base Contrast", float(os.environ.get("OPP_LR_EXPOSURE", "1.2")))
    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
    X0, X1, Y0, Y1, H_ = -2.7, 2.7, -0.6, 4.2, 2.45

    def panels(axis):
        def fn(b, vec):
            p = b.sep(b.coords("world"))
            a = p[{"x": 0, "y": 1}[axis]]
            f = b.math("FRACT", b.math("DIVIDE", a, 0.203))
            g = b.maprange(b.math("ABSOLUTE", b.math("SUBTRACT", f, 0.5)), 0.47, 0.495, 0.0, 1.0)
            grain = wood_base(hexc("#7B5536"), hexc("#5C3D25"), 2.0, "Z", 9.0)(b, b.mapping(b.coords("world"),
                                                                                       scale=(6, 6, 0.4)))
            return b.mix(grain, b.rgb(hexc("#2C1D12")), g)
        return fn

    wall_x = make_mat("PanelX", rough=0.45, var=0.06, grime=0.15, space="world", base=panels("x"), coat=0.15)
    wall_y = make_mat("PanelY", rough=0.45, var=0.06, grime=0.15, space="world", base=panels("y"), coat=0.15)
    carpet = make_mat("Carpet", hexc("#B4A184"), 0.97, var=0.08, var_scale=3.0, space="world", bump=0.35,
                      bump_scale=420, sheen=0.4, grime=0.2, grime_scale=0.8)
    ceil = make_mat("Popcorn", hexc("#DCD6C8"), 0.95, var=0.05, bump=0.4, bump_scale=300)
    trim = make_mat("LRTrim", hexc("#4E3420"), 0.45, var=0.06)
    win_x0, win_x1, win_z0, win_z1 = -2.15, -1.05, 0.95, 2.05
    wall_with_holes("LRBack", "x", Y1, X0 - 0.2, X1 + 0.2, 0.0, H_, 0.12, [(win_x0, win_x1, win_z0, win_z1)], wall_x)
    box2("LRLeft", (X0 - 0.12, Y0, 0.0), (X0, Y1, H_), wall_y)
    hall_y0, hall_y1 = 1.1, 2.05
    wall_with_holes("LRRight", "y", X1, Y0, Y1, 0.0, H_, 0.12, [(hall_y0, hall_y1, -0.1, 2.05)], wall_y)
    box2("LRFloor", (X0 - 0.2, Y0, -0.05), (X1 + 0.2, Y1 + 0.2, 0.0), carpet)
    box2("LRCeil", (X0 - 0.2, Y0, H_), (X1 + 0.2, Y1 + 0.2, H_ + 0.05), ceil)
    for nm, lo, hi in (("BaseB", (X0, Y1 - 0.015, 0), (X1, Y1, 0.1)), ("BaseL", (X0, Y0, 0), (X0 + 0.015, Y1, 0.1))):
        box2(nm, lo, hi, trim)
    # the hallway off to the right: a dim corridor with a warm light further along
    hall = make_mat("HallWall", hexc("#CBBFA8"), 0.8, var=0.06, grime=0.2)
    box2("HallFloor", (X1, hall_y0 - 0.5, -0.05), (X1 + 3.0, hall_y1 + 0.5, 0.0), carpet)
    box2("HallFar", (X1 + 0.12, hall_y1 + 0.02, 0.0), (X1 + 3.0, hall_y1 + 0.1, H_), hall)
    box2("HallNear", (X1 + 0.12, hall_y0 - 0.1, 0.0), (X1 + 3.0, hall_y0 - 0.02, H_), hall)
    box2("HallCeil", (X1, hall_y0 - 0.5, H_), (X1 + 3.0, hall_y1 + 0.5, H_ + 0.05), ceil)
    light("HallLight", "AREA", (X1 + 2.2, (hall_y0 + hall_y1) / 2, H_ - 0.05), float(os.environ.get("OPP_LR_HALL", "28")),
          kelvin(2600), rot=(0, 0, 0), size=0.3, size_y=0.3)
    # window: casing, dark night outside, venetian blinds half closed
    box2("WinSill", (win_x0 - 0.08, Y1 - 0.08, win_z0 - 0.04), (win_x1 + 0.08, Y1 + 0.02, win_z0), trim)
    for nm, lo, hi in (("WinL", (win_x0 - 0.07, Y1 - 0.03, win_z0), (win_x0, Y1, win_z1 + 0.07)),
                       ("WinR", (win_x1, Y1 - 0.03, win_z0), (win_x1 + 0.07, Y1, win_z1 + 0.07)),
                       ("WinT", (win_x0 - 0.07, Y1 - 0.03, win_z1), (win_x1 + 0.07, Y1, win_z1 + 0.07))):
        box2(nm, lo, hi, trim)
    sky = emit_mat("NightOutside", (0.012, 0.02, 0.05, 1), 1.0)
    box2("Outside", (win_x0 - 3, Y1 + 2.5, -1.0), (win_x1 + 3, Y1 + 2.6, 4.0), sky)
    slat_m = make_mat("Slat", hexc("#D9D3C4"), 0.45, var=0.04, grime=0.15)
    nsl = 42
    for k in range(nsl):
        z = win_z1 - 0.03 - k * (win_z1 - win_z0 - 0.02) / nsl
        box(f"Slat{k}", ((win_x0 + win_x1) / 2, Y1 + 0.03, z), (win_x1 - win_x0 - 0.02, 0.025, 0.0015), slat_m,
            rot=(48.0, 0, 0))
    box2("BlindHead", (win_x0, Y1 + 0.005, win_z1 - 0.03), (win_x1, Y1 + 0.06, win_z1 + 0.02), slat_m)
    # streetlight: a cold blue source outside, raking down through the slats
    blue = (0.35, 0.5, 1.0)
    sl = light("Streetlight", "SPOT", ((win_x0 + win_x1) / 2 - 0.4, Y1 + 3.5, 3.4),
               float(os.environ.get("OPP_LR_STREET", "2600")), blue, target=(-1.2, 2.6, 0.3), size=0.05, spot=24.0,
               blend=0.25)
    # the couch: brown corduroy, three seat and three back cushions, a crocheted throw over the back
    def cord(b, vec):
        p = b.sep(b.coords("object"))
        w = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
        b.set(w.inputs["Vector"], b.coords("object"))
        w.inputs["Scale"].default_value = 70.0
        w.inputs["Distortion"].default_value = 0.0
        return b.mix(b.rgb(hexc("#6A4A30")), b.rgb(hexc("#4E3420")), b.maprange(w.outputs[1], 0.3, 0.7, 0.0, 1.0))

    def cord_n(b, vec):
        w = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
        b.set(w.inputs["Vector"], b.coords("object"))
        w.inputs["Scale"].default_value = 70.0
        bp = b.node("ShaderNodeBump")
        bp.inputs["Strength"].default_value = 0.5
        b.set(bp.inputs["Height"], w.outputs[1])
        return bp.outputs[0]

    corduroy = make_mat("Corduroy", rough=0.9, var=0.05, sheen=0.7, base=cord, normal_fn=cord_n, grime=0.15)
    cx0, cx1, cy0, cy1 = -1.08, 1.08, 3.05, 3.95
    cv = empty("Couch", (0, 0, 0))
    box2("CouchBase", (cx0, cy0 + 0.02, 0.06), (cx1, cy1, 0.36), corduroy, bevel=0.03).parent = cv
    box2("CouchBackFrame", (cx0, cy1 - 0.22, 0.3), (cx1, cy1, 0.9), corduroy, bevel=0.05).parent = cv
    for sx in (-1, 1):
        ax0 = cx0 if sx < 0 else cx1 - 0.2
        box2(f"CouchArm{sx}", (ax0, cy0, 0.06), (ax0 + 0.2, cy1, 0.64), corduroy, bevel=0.06).parent = cv
    seat_w = (cx1 - cx0 - 0.4) / 3
    for k in range(3):
        xa = cx0 + 0.2 + k * seat_w
        box2(f"SeatCush{k}", (xa + 0.005, cy0 + 0.0, 0.36), (xa + seat_w - 0.005, cy1 - 0.2, 0.5), corduroy,
             bevel=0.045).parent = cv
        bc = box2(f"BackCush{k}", (xa + 0.01, cy1 - 0.42, 0.46), (xa + seat_w - 0.01, cy1 - 0.2, 0.98), corduroy,
                  bevel=0.07)
        bc.rotation_euler.x = math.radians(-9)
        bc.parent = cv
    for sx in (-1, 1):
        for sy in (cy0 + 0.08, cy1 - 0.08):
            cyl(f"CouchFoot{sx}{sy}", (sx * (cx1 - 0.08), sy, 0.03), 0.025, 0.06, trim, verts=10)
    # crocheted afghan (granny squares) over the back
    def granny(b, vec):
        uv = b.node("ShaderNodeUVMap")
        sp = b.sep(uv.outputs[0])
        cu = b.math("FLOOR", b.math("MULTIPLY", sp[0], 9.0))
        cv_ = b.math("FLOOR", b.math("MULTIPLY", sp[1], 3.0))
        idx = b.math("MODULO", b.math("ADD", cu, b.math("MULTIPLY", cv_, 2.0)), 4.0)
        col = b.ramp(b.math("DIVIDE", idx, 4.0), [(0.0, hexc("#C98A2B")), (0.25, hexc("#8A9A3A")),
                                                  (0.5, hexc("#B5502E")), (0.75, hexc("#D9C9A0"))], "CONSTANT")
        fu = b.math("FRACT", b.math("MULTIPLY", sp[0], 9.0))
        fv = b.math("FRACT", b.math("MULTIPLY", sp[1], 3.0))
        ring = b.math("MAXIMUM", b.math("ABSOLUTE", b.math("SUBTRACT", fu, 0.5)),
                      b.math("ABSOLUTE", b.math("SUBTRACT", fv, 0.5)))
        inner = b.maprange(ring, 0.18, 0.22, 1.0, 0.0)
        col = b.mix(col, b.rgb(hexc("#E8DDC0")), b.math("MULTIPLY", inner, 0.0))
        border = b.maprange(ring, 0.43, 0.46, 0.0, 1.0)
        mid = b.math("MULTIPLY", b.maprange(ring, 0.24, 0.27, 0.0, 1.0), b.maprange(ring, 0.33, 0.36, 1.0, 0.0))
        col = b.mix(col, b.rgb(hexc("#2A1E16")), border)
        return b.mix(col, b.rgb(hexc("#E3D7B8")), b.math("MULTIPLY", mid, 0.8))

    throw = make_mat("Afghan", rough=0.95, var=0.06, sheen=0.4, base=granny, bump=0.3, bump_scale=260)

    path = [(cy1 - 0.40, 0.60), (cy1 - 0.37, 0.75), (cy1 - 0.31, 0.90), (cy1 - 0.24, 0.965), (cy1 - 0.14, 0.975),
            (cy1 - 0.05, 0.95), (cy1 + 0.01, 0.88), (cy1 + 0.02, 0.70)]
    drape_path("Afghan", 1.25, path, throw, x_center=-0.28, amp=0.012, nu=60, nv=40)
    # end table + lamp (off) at the right, a framed print above the couch, a plant in the left corner
    tw = make_mat("TableWood", rough=0.4, var=0.0, coat=0.3, base=wood_base(hexc("#6E4A2C"), hexc("#4A2F1A"), 4.0))
    box2("EndTop", (1.18, 3.2, 0.56), (1.72, 3.85, 0.6), tw, bevel=0.01)
    box2("EndShelf", (1.22, 3.24, 0.18), (1.68, 3.81, 0.21), tw)
    for x in (1.21, 1.69):
        for y in (3.23, 3.82):
            box2(f"EndLeg{x}{y}", (x - 0.02, y - 0.02, 0.0), (x + 0.02, y + 0.02, 0.58), tw)
    ceramic = make_mat("LampCeramic", hexc("#8C6E4E"), 0.25, var=0.05, coat=0.5)
    sphere("LampBase", (1.45, 3.52, 0.76), 0.13, ceramic, scale=(1, 1, 1.25))
    cyl("LampNeck", (1.45, 3.52, 0.95), 0.015, 0.14, make_mat("Brass", hexc("#A88A4A"), 0.3, metallic=0.9))
    cyl("LampShade", (1.45, 3.52, 1.1), 0.22, 0.26, make_mat("Shade", hexc("#E3D6B8"), 0.85, var=0.05),
        radius2=0.15, verts=40)
    box("Magazine", (1.32, 3.32, 0.605), (0.21, 0.28, 0.008), make_mat("Mag", hexc("#8C3A2E"), 0.4), rot=(0, 0, 12))
    frame_m = make_mat("PrintFrame", hexc("#3A2A1A"), 0.4)
    box2("PrintFrame", (-0.55, Y1 - 0.03, 1.32), (0.55, Y1, 1.92), frame_m)
    pr = make_mat("Print", rough=0.6, var=0.0, base=lambda b, v: b.mix(
        b.rgb(hexc("#6E8AA0")), b.rgb(hexc("#7A8A4E")),
        b.maprange(b.sep(b.coords("world"))[2], 1.55, 1.6, 0.0, 1.0)))
    box2("PrintArt", (-0.5, Y1 - 0.035, 1.37), (0.5, Y1 - 0.03, 1.87), pr)
    pot = make_mat("Pot", hexc("#8A4E32"), 0.6, var=0.06)
    cyl("PlantPot", (-2.35, 3.75, 0.17), 0.17, 0.34, pot, radius2=0.13, verts=24)
    leaf = make_mat("Leaf", hexc("#2E4A28"), 0.6, var=0.1)
    for k in range(9):
        a = k * 40.0
        box(f"PlantLeaf{k}", (-2.35 + 0.05 * math.cos(math.radians(a)), 3.75 + 0.05 * math.sin(math.radians(a)), 0.75),
            (0.07, 0.01, 0.75), leaf, rot=(8 * math.sin(k), 10 * math.cos(k * 1.3), a))
    # TV light is off; the room is lit only by the streetlight bars, a hallway spill and a faint sky bounce
    light("SkyBounce", "AREA", ((win_x0 + win_x1) / 2, Y1 - 0.2, 1.5), 6.0, (0.4, 0.5, 0.9), rot=(-90, 0, 0),
          size=1.1, size_y=1.1)
    light("RoomFill", "AREA", (0.0, 0.2, 2.3), float(os.environ.get("OPP_LR_FILL", "6")), (0.55, 0.6, 0.75),
          target=(0.0, 3.4, 0.5), size=2.0, size_y=1.0)
    camera((0.0, 0.0, 0.9), rot=(90.0, 0.0, 0.0), lens=28.0, name="CamTV")
    render("livingroom")
    left = (cx0 + 0.2 + seat_w / 2, (cy0 + cy1 - 0.2) / 2, 0.5)
    right = (cx1 - 0.2 - seat_w / 2, (cy0 + cy1 - 0.2) / 2, 0.5)
    meta = dict(couch_left_seat=proj(left), couch_middle_seat=proj((0.0, left[1], 0.5)),
                couch_right_seat=proj(right), couch_px_per_m=px_per_m_at((left[0], left[1], 0.0)),
                couch_left_seat_after_mirror=[round(640 - proj(right)[0], 1), proj(right)[1]],
                note="640x480 as rendered (NOT mirrored). The compositor flips it left/right for the CRT reflection: "
                     "after the flip the screen-left cushion is couch_left_seat_after_mirror (the right cushion here).")
    save_blend("livingroom")
    write_meta("livingroom", meta)


# ============================================================== dispatcher
ROOMS = {
    "turnaround_wide": lambda: render_wide("wide"),
    "turnaround_wide_late": lambda: render_wide("wide_late"),
    "turnaround_frame": lambda: render_frame(False),
    "turnaround_frame_dim": lambda: render_frame(True),
    "turnaround_portrait": render_portrait,
    "turnaround_night": render_night,
    "crt_set_b": render_crt_b,
    "turnaround_reverse": render_reverse,
    "behind_set": render_behind_set,
    "mirror_studio": render_mirror_studio,
    "frame_mirror_night": render_frame_mirror_night,
    "livingroom": render_livingroom,
}


def manifest_sizes():
    try:
        a = json.load(open(os.path.join(HERE, "assets.json")))
        return {os.path.splitext(os.path.basename(r["file"]))[0]: tuple(r["size"]) for r in a["rooms"]}
    except (OSError, ValueError, KeyError):
        return {}


def png_size(path):
    import struct
    try:
        with open(path, "rb") as f:
            head = f.read(24)
        if head[:8] != b"\x89PNG\r\n\x1a\n":
            return None
        return struct.unpack(">II", head[16:24])
    except OSError:
        return None


def valid(name, sizes):
    sz = png_size(os.path.join(OUT_IMG, name + ".png"))
    if sz is None:
        return False
    want = sizes.get(name)
    if PREVIEW and want:
        want = (want[0] // 2, want[1] // 2)
    return want is None or tuple(sz) == tuple(want)


def main():
    import subprocess
    os.makedirs(OUT_IMG, exist_ok=True)
    args = sys.argv[1:]
    if "--" in args:
        args = args[args.index("--") + 1:]
    if "--one" in args:
        name = args[args.index("--one") + 1]
        t0 = time.time()
        ROOMS[name]()
        print(f"[{name}] done in {time.time() - t0:.0f}s", flush=True)
        return
    sizes = manifest_sizes()
    if "--list" in args:
        for n in ROOMS:
            print(f"{n:24s} {'ok' if valid(n, sizes) else 'MISSING'}  {sizes.get(n)}")
        return
    force = "--force" in args
    named = [a for a in args if a in ROOMS]
    unknown = [a for a in args if not a.startswith("-") and a not in ROOMS and not a.isdigit()]
    if unknown:
        print("unknown rooms:", unknown, "choose from", list(ROOMS))
    if named:
        wanted = named
    else:
        wanted = [n for n in ROOMS if force or not valid(n, sizes)]
    if "turnaround_wide_late" in wanted and "turnaround_wide" not in wanted and not valid("turnaround_wide", sizes):
        wanted.insert(0, "turnaround_wide")
    if "turnaround_wide" in wanted and "turnaround_wide_late" in wanted:
        wanted.remove("turnaround_wide_late")
        wanted.insert(wanted.index("turnaround_wide") + 1, "turnaround_wide_late")
    print("rendering:", wanted or "nothing (all present; name rooms or pass --force)", flush=True)
    t0 = time.time()
    failed = []
    for name in wanted:
        t1 = time.time()
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--one", name], timeout=1800)
        ok = r.returncode == 0 and valid(name, sizes)
        print(f"== {name}: {'ok' if ok else 'FAILED'} ({time.time() - t1:.0f}s)", flush=True)
        if not ok:
            failed.append(name)
    print(f"done {len(wanted) - len(failed)}/{len(wanted)} in {time.time() - t0:.0f}s", "failed:" if failed else "",
          failed if failed else "")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
