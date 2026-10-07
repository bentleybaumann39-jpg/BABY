"""
Builds and renders the Blender rooms for THE WORLD OF POPPY.

Run with the bpy module (Blender 5.x as a Python module), headless:

    VENV/bin/python poppy/render_rooms.py                     # every room
    VENV/bin/python poppy/render_rooms.py playroom_wide dressing_room

Room names are the manifest file stems (see poppy/assets.json "rooms"):
    playroom_wide  playroom_wide_ajar  playroom_board  playroom_dark   (one set model, shared camera)
    studio_night   (the same set model seen from the dark studio floor)
    backstage_corridor  dressing_room
    bedroom_night  hallway_night  closet_door  closet_door_open        (the viewer's home)
Variants that must match pixel-for-pixel (playroom_wide_ajar, closet_door_open) are re-rendered from the
same scene and then composited onto their base image outside the changed door region.
Writes:
    poppy/build/rooms/<room>.png         the renders (sizes from the manifest)
    poppy/build/rooms/rooms_meta.json    pixel anchors for the compositor
    poppy/build/rooms/blend/<set>.blend  the scene files (cameras saved with them)

Environment knobs: POPPY_SAMPLES (default 48), POPPY_PREVIEW=1 (quarter-cost
test renders written to build/rooms/preview/ instead of the real files).
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
from mathutils import Euler, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "rooms")
BLEND_DIR = os.path.join(OUT, "blend")
SAMPLES = int(os.environ.get("POPPY_SAMPLES", "48"))
PREVIEW = os.environ.get("POPPY_PREVIEW", "") == "1"
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
        if space == "world":
            return self.node("ShaderNodeNewGeometry").outputs["Position"]
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
    if streak:
        v2 = b.mapping(b.coords("world"), scale=(7.0, 7.0, 0.45))
        st = b.maprange(b.noise(v2, 1.0, 6.0, 0.6), 0.48, 0.78, 1.0, 1.0 - streak)
        dark = st if dark is None else b.math("MULTIPLY", dark, st)
    if floor_dirt:
        z = b.sep(b.coords("world"))[2]
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
    os.makedirs(OUT_IMG, exist_ok=True)
    meta = {}
    if os.path.exists(META_PATH):
        with open(META_PATH) as f:
            meta = json.load(f)
    s = scene()
    data = dict(data)
    data["size"] = [s.render.resolution_x, s.render.resolution_y]
    meta[room] = data
    meta["_note"] = ("Pixel coordinates in each room image's own resolution, origin top-left. "
                     "Written by poppy/render_rooms.py from the Blender cameras.")
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=1, sort_keys=True)


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


CLOUD = [(-0.32, 0.00, 0.15), (-0.13, 0.09, 0.20), (0.10, 0.12, 0.22), (0.31, 0.03, 0.16),
         (0.00, -0.01, 0.17)]


def paint_cloud(img, X, Z, cx, cz, s, ppm, outline="#C9DFEE", belly="#E3EEF6"):
    d = np.full(X.shape, 1e9, np.float32)
    for dx, dz, r in CLOUD:
        d = np.minimum(d, np.hypot(X - (cx + dx * s), Z - (cz + dz * s)) - r * s)
    base = cz - 0.07 * s
    d = np.maximum(d, base - Z)
    px = 1.5 / ppm
    o = _cov(d - 0.016 * s, px)
    img[:] = img * (1 - o) + srgb01(outline) * o
    bl = np.clip((base + 0.09 * s - Z) / (0.09 * s), 0, 1)[..., None]
    fill = np.ones(3, np.float32) * (1 - bl) + srgb01(belly) * bl
    i = _cov(d, px)
    img[:] = img * (1 - i) + fill * i


def paint_sun(img, X, Z, cx, cz, R, ppm, rays=12):
    px = 1.5 / ppm
    dx, dz = X - cx, Z - cz
    r = np.hypot(dx, dz)
    th = np.arctan2(dz, dx)
    r0, r1, w0 = R * 1.12, R * 1.75, R * 0.30
    d_ray = np.full(X.shape, 1e9, np.float32)
    for k in range(rays):
        a = 2 * math.pi * k / rays + math.pi / rays
        along = dx * math.cos(a) + dz * math.sin(a)
        perp = -dx * math.sin(a) + dz * math.cos(a)
        half = w0 * np.clip((r1 - along) / (r1 - r0), 0, 1)
        dd = np.maximum.reduce([r0 - along, along - r1, np.abs(perp) - half])
        d_ray = np.minimum(d_ray, dd)
    ray = _cov(d_ray, px)
    img[:] = img * (1 - ray) + srgb01("#FFC93C") * ray
    ring = _cov(r - R, px)
    img[:] = img * (1 - ring) + srgb01("#F7A928") * ring
    disc = _cov(r - R * 0.9, px)
    shade = np.clip(0.5 + 0.5 * (dz - dx) / R, 0, 1)[..., None]
    img[:] = img * (1 - disc) + (srgb01("#FFE066") * shade + srgb01("#FFD23F") * (1 - shade)) * disc


def sky_texture(w_m, h_m, x0, z0, ppm, clouds=(), sun=None, seed=1):
    X, Z = _grid(w_m, h_m, x0, z0, ppm)
    t = ((Z - z0) / h_m)[..., None]
    img = srgb01("#A6DCF4") * (1 - t) + srgb01("#79C6EE") * t
    img = img + _smooth_noise(X.shape, 40, seed, 0.010)[..., None]
    for cx, cz, s in clouds:
        paint_cloud(img, X, Z, cx, cz, s, ppm)
    if sun:
        paint_sun(img, X, Z, *sun, ppm)
    return img


def meadow_texture(w_m, h_m, ppm, seed=3):
    """Painted backdrop seen through the playroom window: sky, two hills, red flowers."""
    X, Z = _grid(w_m, h_m, 0.0, 0.0, ppm)
    px = 1.5 / ppm
    t = (Z / h_m)[..., None]
    img = srgb01("#CDEFFB") * (1 - t) + srgb01("#8AD0F2") * t
    paint_cloud(img, X, Z, 0.25 * w_m, 0.82 * h_m, 0.35, ppm)
    paint_cloud(img, X, Z, 0.85 * w_m, 0.9 * h_m, 0.25, ppm)
    back = 0.42 * h_m + 0.06 * np.sin(X * 3.1 + 0.7) + 0.04 * np.sin(X * 7.3 + 2.0)
    c = _cov(Z - back, px)
    img = img * (1 - c) + srgb01("#9AD66B") * c
    front = 0.26 * h_m + 0.07 * np.sin(X * 2.3 + 2.4) + 0.03 * np.sin(X * 6.1)
    c = _cov(Z - front, px)
    shade = np.clip((front - Z) / 0.25, 0, 1)[..., None]
    img = img * (1 - c) + (srgb01("#5DBB4A") * (1 - shade) + srgb01("#3F9A3A") * shade) * c
    rng = np.random.default_rng(seed)
    for _ in range(140):
        fx = rng.uniform(0, w_m)
        fz = rng.uniform(0.0, 0.26 * h_m + 0.07 * math.sin(fx * 2.3 + 2.4) - 0.02)
        rr = rng.uniform(0.008, 0.016) * (1.4 - fz / h_m)
        d = np.hypot(X - fx, Z - fz) - rr
        c = _cov(d, px)
        img = img * (1 - c) + srgb01("#E2332B") * c
    for _ in range(60):
        fx = rng.uniform(0, w_m)
        fz = rng.uniform(0.25 * h_m, 0.40 * h_m)
        d = np.hypot(X - fx, Z - fz) - 0.006
        c = _cov(d, px)
        img = img * (1 - c) + srgb01("#E86A5A") * c
    return img + _smooth_noise(X.shape, 30, seed + 1, 0.012)[..., None]


# ============================================================== THE PLAYROOM SET
# World: back wall interior face at y=0, set opens toward -y, floor z=0, x right.
PR_CAM = dict(loc=(0.0, -4.4, 1.25), rot=(90.0, 0.0, 0.0), lens=32.0, shift_y=-0.048)
PR_BACK_X = 2.0           # back wall spans x in [-2, 2]
PR_WALL_H = 3.05
PR_DOOR = (0.85, 1.55, 1.95)  # x0, x1, top
PR_WINDOW = (-1.50, -0.85, 1.62, 2.36)
PR_POPPY_MARK = (0.0, -1.383, 0.0)
PR_BOARD = dict(center=(-1.41, -0.73, 1.05), yaw=50.0, w=0.95, h=0.70)
PR_CHAIR = (1.27, -1.42)
PR_TABLE = (-1.12, -1.62)


class Playroom:
    def __init__(self, variant="wide", studio=False):
        self.variant = variant
        self.studio = studio
        self.objs = {}

    # ------------------------------------------------------------ materials
    def materials(self):
        M = {}
        dark = self.variant in ("dark", "studio")
        sky_back = sky_texture(2 * PR_BACK_X, PR_WALL_H - 0.95, -PR_BACK_X, 0.95, 300,
                               clouds=[(0.12, 2.47, 0.95), (1.25, 2.56, 0.6), (-0.72, 2.64, 0.36),
                                       (1.85, 2.22, 0.4)],
                               sun=(-1.86, 2.58, 0.15))
        M["sky_back"] = make_mat("SkyBack", rough=0.85, var=0.0, spec=0.25,
                                 base=planar_image_base(image_from_array("sky_back", sky_back),
                                                        ("x", "z"), -PR_BACK_X, PR_BACK_X, 0.95,
                                                        PR_WALL_H))
        sky_side = sky_texture(2.8, PR_WALL_H - 0.95, -2.8, 0.95, 200,
                               clouds=[(-0.55, 2.2, 0.6)], seed=5)
        M["sky_side"] = make_mat("SkySide", rough=0.85, var=0.0, spec=0.25,
                                 base=planar_image_base(image_from_array("sky_side", sky_side),
                                                        ("y", "z"), -2.8, 0.0, 0.95, PR_WALL_H))
        M["mint"] = make_mat("Mint", hexc("#93DEBE"), 0.6, var=0.03, spec=0.35)
        M["mint_dk"] = make_mat("MintStile", hexc("#74CBA6"), 0.55, var=0.03, spec=0.35)
        M["rail"] = make_mat("Rail", hexc("#F79AC0"), 0.35, var=0.02, coat=0.2)
        M["white"] = make_mat("TrimWhite", hexc("#FFF6E6"), 0.4, var=0.02)
        M["seam"] = make_mat("Seam", hexc("#5B6F7C"), 0.8, var=0.0)
        M["plywood"] = make_mat("Plywood", rough=0.8, var=0.05, grime=0.25, grime_scale=1.5,
                                base=wood_base(hexc("#C9A274"), hexc("#A07A4E"), 2.0, "Z"))
        M["pine"] = make_mat("Pine", rough=0.45, var=0.0, coat=0.15,
                             base=streak_wood(hexc("#EDC994"), hexc("#D3A46A"), "x"))
        M["pine_v"] = make_mat("PineV", rough=0.45, var=0.0, coat=0.15,
                               base=streak_wood(hexc("#EDC994"), hexc("#D3A46A"), "z"))
        M["floor"] = make_mat("SetFloor", rough=0.32, var=0.05, coat=0.25, space="world",
                              base=planks_base(hexc("#E6C08F"), hexc("#C99A63"), hexc("#7A5636")))
        M["door"] = make_mat("DoorRed", hexc("#D8352B"), 0.38, var=0.04, coat=0.25)
        M["door_dk"] = make_mat("DoorPanel", hexc("#B52820"), 0.38, var=0.04, coat=0.25)
        M["brass"] = make_mat("Knob", hexc("#F2C230"), 0.25, var=0.0, metallic=0.6, coat=0.5)
        M["void"] = void_mat()
        M["felt_blue"] = make_mat("FeltBoard", hexc("#4F9FE2"), 0.95, var=0.035, var_scale=30,
                                  sheen=0.5, spec=0.15, bump=0.12, bump_scale=420)
        M["felt"] = {}
        for k, h in dict(red="#E2342D", orange="#F59A2E", yellow="#F7CF3E", green="#5FBF4F",
                         blue="#4A9EE0", purple="#9466CC", pink="#F58BB8", leaf="#3E9E45",
                         stem="#4AAE4A", white="#FFF8EE", black="#1A1418", brown="#9A6235",
                         cream="#FFF1D6").items():
            M["felt"][k] = make_mat("Felt_" + k, hexc(h), 0.92, var=0.04, var_scale=25,
                                    sheen=0.45, spec=0.2, bump=0.1, bump_scale=380)
        M["paint"] = {}
        for k, h in dict(red="#E8463A", orange="#F79B2C", yellow="#F9D23E", green="#5CC45A",
                         blue="#3E97E0", purple="#9867D2", chair="#F8CC2C", table="#FF8FB5",
                         tabletop="#FFF2DA", shelf="#6CC7E8").items():
            M["paint"][k] = make_mat("Paint_" + k, hexc(h), 0.35, var=0.03, coat=0.3)
        rug_stops = [(0.0, hexc("#FFF4E0")), (0.22, hexc("#9A6BD1")), (0.36, hexc("#4DA3E0")),
                     (0.50, hexc("#6CC65A")), (0.64, hexc("#F7D046")), (0.78, hexc("#F59A2E")),
                     (0.90, hexc("#E8473C"))]

        def rug_base(b, vec):
            vm = b.node("ShaderNodeVectorMath", operation="LENGTH")
            b.set(vm.inputs[0], b.comb(b.sep(vec)[0], b.sep(vec)[1], 0.0))
            rn = b.math("DIVIDE", vm.outputs[1], 0.95)
            return b.ramp(rn, rug_stops, "CONSTANT")

        M["rug"] = make_mat("Rug", rough=0.95, var=0.05, var_scale=12, sheen=0.4, spec=0.15,
                            bump=0.25, bump_scale=300, base=rug_base)
        M["meadow"] = make_mat("Meadow", rough=0.9, var=0.0, spec=0.1,
                               emission=(0.0 if dark else 0.55),
                               base=planar_image_base(
                                   image_from_array("meadow", meadow_texture(1.55, 1.2, 300)),
                                   ("x", "z"), -1.95, -0.40, 1.45, 2.65))
        if not dark:
            # emission of the backdrop follows its own painted colour
            mt = M["meadow"].node_tree
            bsdf = mt.nodes["Principled BSDF"]
            src = bsdf.inputs["Base Color"].links[0].from_socket
            mt.links.new(src, bsdf.inputs["Emission Color"])
        M["block"] = [M["paint"][k] for k in ("red", "blue", "yellow", "green", "orange", "purple")]
        self.M = M
        return M

    # ------------------------------------------------------------ build
    def build(self):
        M = self.materials()
        o = self.objs
        BX, H = PR_BACK_X, PR_WALL_H
        dx0, dx1, dtop = PR_DOOR
        wx0, wx1, wz0, wz1 = PR_WINDOW
        holes = [(dx0, dx1, -0.1, dtop), (wx0, wx1, wz0, wz1)]

        # --- back wall: three flats (plywood core + painted faces), visible seams
        flats = [(-BX, -0.8), (-0.8, 0.62), (0.62, BX)]
        for i, (a, b) in enumerate(flats):
            hs = [h for h in holes if h[0] < b and h[1] > a]
            wall_with_holes(f"BackCore{i}", "x", 0.004, a + 0.003, b - 0.003, 0.0, H, 0.05, hs,
                            M["plywood"])
            wall_with_holes(f"BackPaint{i}", "x", 0.0, a + 0.003, b - 0.003, 0.95, H, 0.004,
                            [h for h in hs if h[3] > 0.95], M["sky_back"])
        for x in (-0.8, 0.62):
            box2(f"Seam{x}", (x - 0.004, 0.01, 0.0), (x + 0.004, 0.03, H), M["seam"])
        # wainscot (mint) + stiles + chair rail + baseboard, around the door
        wain = 0.95
        wall_with_holes("Wainscot", "x", -0.012, -BX, BX, 0.0, wain, 0.016,
                        [(dx0 - 0.08, dx1 + 0.08, -0.1, 2.5)], M["mint"])
        for x in np.arange(-BX + 0.35, BX - 0.1, 0.62):
            if dx0 - 0.15 < x < dx1 + 0.15:
                continue
            box2(f"Stile{x:.2f}", (x - 0.03, -0.022, 0.12), (x + 0.03, -0.012, wain - 0.06),
                 M["mint_dk"])
        for a, b in ((-BX, dx0 - 0.08), (dx1 + 0.08, BX)):
            box2(f"Rail{a:.2f}", (a, -0.045, wain - 0.03), (b, -0.0, wain + 0.035), M["rail"],
                 bevel=0.012)
            box2(f"Base{a:.2f}", (a, -0.035, 0.0), (b, -0.0, 0.11), M["white"], bevel=0.008)

        # --- side walls (slightly splayed), painted inside, raw plywood + braces outside
        for side in (-1, 1):
            hinge = empty(f"SideWall{side}", (side * BX, 0.0, 0.0), (0, 0, side * -8.0))
            L = 3.0
            box2(f"SideCore{side}", (side * 0.0 if side > 0 else -0.05, -L, 0.0),
                 (0.05 if side > 0 else 0.0, 0.0, H), M["plywood"]).parent = hinge
            px = -0.004 if side > 0 else 0.0
            p = box2(f"SidePaint{side}", (px, -L, wain), (px + 0.004, 0.0, H), M["sky_side"])
            p.parent = hinge
            box2(f"SideWain{side}", (-0.016 if side > 0 else 0.0, -L, 0.0),
                 (0.0 if side > 0 else 0.016, 0.0, wain), M["mint"]).parent = hinge
            box2(f"SideRail{side}", (-0.045 if side > 0 else 0.0, -L, wain - 0.03),
                 (0.0 if side > 0 else 0.045, 0.0, wain + 0.035), M["rail"], bevel=0.012).parent = hinge
            box2(f"SideBase{side}", (-0.035 if side > 0 else 0.0, -L, 0.0),
                 (0.0 if side > 0 else 0.035, 0.0, 0.11), M["white"], bevel=0.008).parent = hinge
            if self.studio:
                # braces and stage weights behind the flat
                ox = 0.05 if side > 0 else -0.05
                for y in (-0.6, -1.5, -2.4):
                    br = box(f"Brace{side}{y}", (ox + side * 0.45, y, 1.0), (0.025, 0.07, 2.3),
                             M["plywood"], rot=(0, side * -25.0, 0))
                    br.parent = hinge
                    box2(f"BraceFoot{side}{y}", (min(ox, ox + side * 0.95), y - 0.05, 0.0),
                         (max(ox, ox + side * 0.95), y + 0.05, 0.04), M["plywood"]).parent = hinge
                    sb = cyl(f"Sandbag{side}{y}", (ox + side * 0.8, y, 0.08), 0.12, 0.16,
                             make_mat("Sandbag", hexc("#3A3530"), 0.95, var=0.1, bump=0.3)
                             if "Sandbag" not in bpy.data.materials else bpy.data.materials["Sandbag"])
                    sb.scale = (1.0, 0.7, 0.6)
                    sb.parent = hinge
                for z in (0.6, 1.6, 2.6):
                    box2(f"Rail{side}{z}", (min(ox, ox + side * 0.02), -L, z),
                         (max(ox, ox + side * 0.02), 0.0, z + 0.07), M["plywood"]).parent = hinge

        if self.studio:
            # back of the back wall: horizontal battens + diagonal braces
            for z in (0.5, 1.5, 2.5):
                box2(f"BackBatten{z}", (-BX, 0.054, z), (BX, 0.075, z + 0.07), M["plywood"])
            for x in (-1.4, -0.1, 1.9):
                box(f"BackBrace{x}", (x, 0.5, 1.0), (0.07, 0.025, 2.3), M["plywood"], rot=(25, 0, 0))

        # --- set floor (platform) slightly raised
        box2("SetFloor", (-2.6, -3.3, -0.06), (2.6, 0.06, 0.0), M["floor"])

        # --- door opening: casing, void behind, the door on a hinge
        cas = 0.075
        box2("CasingL", (dx0 - cas, -0.035, 0.0), (dx0, 0.0, dtop + cas), M["white"], bevel=0.01)
        box2("CasingR", (dx1, -0.035, 0.0), (dx1 + cas, 0.0, dtop + cas), M["white"], bevel=0.01)
        box2("CasingT", (dx0 - cas - 0.02, -0.04, dtop), (dx1 + cas + 0.02, 0.0, dtop + cas + 0.03),
             M["white"], bevel=0.01)
        box2("Jamb", (dx0, 0.0, 0.0), (dx1, 0.06, 0.012), M["white"])
        if not self.studio:
            # an open-fronted black tunnel behind the doorway: whatever the door reveals is pitch black
            vx0, vx1, vy0, vy1, vz0, vz1 = dx0 - 1.2, dx1 + 1.2, 0.056, 2.6, 0.0, dtop + 0.6
            box2("VoidBack", (vx0, vy1, vz0), (vx1, vy1 + 0.05, vz1), M["void"])
            box2("VoidL", (vx0 - 0.05, vy0, vz0), (vx0, vy1, vz1), M["void"])
            box2("VoidR", (vx1, vy0, vz0), (vx1 + 0.05, vy1, vz1), M["void"])
            box2("VoidFloor", (vx0, vy0, vz0 - 0.05), (vx1, vy1, vz0 + 0.001), M["void"])
            box2("VoidTop", (vx0, vy0, vz1), (vx1, vy1, vz1 + 0.05), M["void"])
        door_angle = {"wide": 0.0, "ajar": 15.0, "dark": 104.0}.get(self.variant, 0.0)
        hinge = empty("DoorHinge", (dx0 + 0.004, 0.02, 0.0), (0, 0, door_angle))
        dw, dh, dt = (dx1 - dx0) - 0.008, dtop - 0.008, 0.04
        box2("Door", (0.0, -0.02, 0.006), (dw, 0.02, dh), M["door"], bevel=0.006).parent = hinge
        for (cx, cz, pw, ph) in ((0.25, 1.45, 0.42, 0.62), (0.25, 0.55, 0.42, 0.7)):
            box(f"DoorPanel{cz}", (dw / 2, -0.024, cz), (pw, 0.012, ph), M["door_dk"],
                bevel=0.012, parent=hinge)
        sphere("DoorKnob", (dw - 0.08, -0.07, 0.95), 0.045, M["brass"], parent=hinge)
        cyl("KnobStem", (dw - 0.08, -0.04, 0.95), 0.016, 0.06, M["brass"], rot=(90, 0, 0), parent=hinge)
        sphere("DoorKnobB", (dw - 0.08, 0.07, 0.95), 0.045, M["brass"], parent=hinge)
        o["door_hinge"] = hinge

        # --- window: frame, muntins, sill and the painted meadow backdrop behind
        box2("WinCasL", (wx0 - cas, -0.035, wz0 - cas), (wx0, 0.0, wz1 + cas), M["white"], bevel=0.01)
        box2("WinCasR", (wx1, -0.035, wz0 - cas), (wx1 + cas, 0.0, wz1 + cas), M["white"], bevel=0.01)
        box2("WinCasT", (wx0 - cas - 0.01, -0.04, wz1), (wx1 + cas + 0.01, 0.0, wz1 + cas), M["white"],
             bevel=0.01)
        box2("WinSill", (wx0 - cas - 0.04, -0.09, wz0 - cas - 0.02), (wx1 + cas + 0.04, 0.0, wz0),
             M["white"], bevel=0.012)
        box2("WinMullion", ((wx0 + wx1) / 2 - 0.018, -0.01, wz0), ((wx0 + wx1) / 2 + 0.018, 0.03, wz1),
             M["white"])
        box2("WinTransom", (wx0, -0.014, (wz0 + wz1) / 2 - 0.018), (wx1, 0.03, (wz0 + wz1) / 2 + 0.018),
             M["white"])
        for i, (a, b) in enumerate(((wx0, wx1),)):
            box2("WinReveal", (a, 0.0, wz0), (b, 0.055, wz0 + 0.005), M["white"])
        box2("Backdrop", (-1.95, 0.32, 1.45), (-0.4, 0.34, 2.65), M["meadow"])

        self.build_props()
        return o

    def build_props(self):
        M, F, P = self.M, self.M["felt"], self.M["paint"]
        o = self.objs

        # --- rainbow rug under Poppy's mark
        rug = cyl("Rug", (PR_POPPY_MARK[0], PR_POPPY_MARK[1] + 0.02, 0.008), 0.95, 0.016, M["rug"],
                  verts=96, bevel=0.006)
        o["rug"] = rug

        # --- easel + felt board (left)
        bc = PR_BOARD["center"]
        ez = empty("Easel", (bc[0], bc[1], 0.0), (0, 0, PR_BOARD["yaw"]))
        o["easel"] = ez
        bw, bh, fr = PR_BOARD["w"], PR_BOARD["h"], 0.065
        cz = bc[2]
        felt = box("BoardFelt", (0.0, 0.0, cz), (bw, 0.02, bh), M["felt_blue"], parent=ez)
        o["board_felt"] = felt
        for nm, c, s in (("BoardFrT", (0, -0.012, cz + bh / 2 + fr / 2), (bw + 2 * fr, 0.05, fr)),
                         ("BoardFrB", (0, -0.012, cz - bh / 2 - fr / 2), (bw + 2 * fr, 0.05, fr)),
                         ("BoardFrL", (-bw / 2 - fr / 2, -0.012, cz), (fr, 0.05, bh)),
                         ("BoardFrR", (bw / 2 + fr / 2, -0.012, cz), (fr, 0.05, bh))):
            box(nm, c, s, M["pine_v"] if nm[-1] in "LR" else M["pine"], bevel=0.012, parent=ez)
        box("BoardBack", (0, 0.02, cz), (bw + 0.05, 0.015, bh + 0.05), M["plywood"], parent=ez)
        # ledge / tray with a few loose felt shapes
        ledge_z = cz - bh / 2 - fr - 0.02
        box("Ledge", (0, -0.07, ledge_z), (bw + 0.32, 0.13, 0.03), M["pine"], bevel=0.008, parent=ez)
        box("LedgeLip", (0, -0.13, ledge_z + 0.03), (bw + 0.32, 0.015, 0.05), M["pine"], bevel=0.005,
            parent=ez)
        for i, (x, m, r) in enumerate(((-0.42, F["red"], 0.05), (-0.25, F["yellow"], 0.045),
                                       (0.3, F["green"], 0.05), (0.43, F["purple"], 0.04))):
            cyl(f"FeltDisc{i}", (x, -0.06, ledge_z + 0.02 + r * 0.6), r, 0.01, m, rot=(80, 0, 0),
                parent=ez)
        prism("FeltTri", [(-0.06, 0), (0.06, 0), (0, 0.1)], 0.01, F["orange"], loc=(0.08, -0.05, ledge_z + 0.02),
              rot=(80, 0, 0), parent=ez)
        # legs: two front legs splayed, one rear leg
        top = cz + bh / 2 + fr + 0.18
        for sx in (-1, 1):
            box(f"EaselLeg{sx}", (sx * (bw / 2 + fr + 0.035), 0.0, top / 2), (0.05, 0.035, top + 0.02),
                M["pine_v"], rot=(0, sx * -3.0, 0), bevel=0.008, parent=ez)
        box("EaselRear", (0, 0.3, top / 2 - 0.05), (0.05, 0.035, top), M["pine_v"], rot=(-17, 0, 0),
            bevel=0.008, parent=ez)
        box("EaselCross", (0, 0.0, 0.42), (bw + 2 * fr + 0.12, 0.03, 0.045), M["pine"], bevel=0.008, parent=ez)

        # --- little table (front-left) with crayon cup and paper
        tx, ty = PR_TABLE
        cyl("TableTop", (tx, ty, 0.47), 0.32, 0.04, P["table"], verts=48, bevel=0.012)
        cyl("TableTopIn", (tx, ty, 0.492), 0.27, 0.004, P["tabletop"], verts=48)
        for a in (45, 135, 225, 315):
            lx, ly = tx + 0.2 * math.cos(math.radians(a)), ty + 0.2 * math.sin(math.radians(a))
            cyl(f"TableLeg{a}", (lx, ly, 0.23), 0.028, 0.46, P["table"], verts=16)
        cyl("CrayonCup", (tx + 0.08, ty + 0.05, 0.55), 0.045, 0.11, P["blue"], verts=24)
        for i, (c, ang) in enumerate(((P["red"], 8), (P["green"], -6), (P["yellow"], 14), (P["purple"], -12))):
            cyl(f"Crayon{i}", (tx + 0.08 + 0.012 * (i - 1.5), ty + 0.05, 0.63), 0.008, 0.12, c, verts=8,
                rot=(ang, ang * 0.5, 0))
        box("Paper", (tx - 0.1, ty - 0.05, 0.496), (0.21, 0.28, 0.002), M["felt"]["white"], rot=(0, 0, 18))

        # --- small yellow chair (right). In the dark variant it faces the back wall.
        chx, chy = PR_CHAIR
        yaw = 180.0 if self.variant == "dark" else -15.0
        ch = empty("Chair", (chx, chy, 0.0), (0, 0, yaw))
        o["chair"] = ch
        box("ChairSeat", (0, 0, 0.29), (0.34, 0.32, 0.04), P["chair"], bevel=0.012, parent=ch)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(f"ChairLeg{sx}{sy}", (sx * 0.14, sy * 0.13, 0.135), 0.018, 0.27, P["chair"],
                    verts=12, parent=ch)
            cyl(f"ChairPost{sx}", (sx * 0.14, 0.14, 0.45), 0.018, 0.32, P["chair"], verts=12, parent=ch)
        box("ChairBack", (0, 0.145, 0.53), (0.34, 0.03, 0.14), P["chair"], bevel=0.012, parent=ch)
        box("ChairSlat", (0, 0.145, 0.39), (0.30, 0.025, 0.04), P["chair"], bevel=0.008, parent=ch)

        # --- toy shelf along the right side wall
        sh = empty("Shelf", (PR_BACK_X - 0.24, -0.62, 0.0), (0, 0, 90 - 8.0))
        o["shelf"] = sh
        SW, SD, SH = 1.15, 0.34, 0.72
        for nm, c, s in (("ShelfTop", (0, 0, SH), (SW, SD, 0.035)), ("ShelfMid", (0, 0, SH / 2), (SW, SD, 0.03)),
                         ("ShelfBot", (0, 0, 0.06), (SW, SD, 0.03)),
                         ("ShelfL", (-SW / 2, 0, SH / 2), (0.035, SD, SH)),
                         ("ShelfR", (SW / 2, 0, SH / 2), (0.035, SD, SH)),
                         ("ShelfDiv", (0, 0, SH / 2), (0.03, SD, SH)),
                         ("ShelfBack", (0, SD / 2, SH / 2), (SW, 0.01, SH))):
            box(nm, c, s, P["shelf"], bevel=0.01, parent=sh)
        # blocks on the shelves and on top
        blk = M["block"]
        k = 0
        for (x0, z0, n) in ((-0.48, SH + 0.02, 3), (-0.45, SH / 2 + 0.015, 3), (0.1, 0.075, 4)):
            for i in range(n):
                s = 0.11
                box(f"Block{k}", (x0 + i * 0.125, -0.02 + 0.01 * (i % 2), z0 + s / 2), (s, s, s), blk[k % 6],
                    rot=(0, 0, (k * 17) % 25 - 12), bevel=0.012, parent=sh)
                k += 1
        box(f"Block{k}", (-0.42, -0.0, SH + 0.02 + 0.165), (0.11, 0.11, 0.11), blk[(k + 2) % 6],
            rot=(0, 0, 20), bevel=0.012, parent=sh)
        # striped ball
        ball_mat = make_mat("Ball", rough=0.3, var=0.0, coat=0.4, base=lambda b, v: b.ramp(
            b.math("MULTIPLY", b.math("ADD", b.math("ARCTAN2", b.sep(v)[1], b.sep(v)[0]), math.pi),
                   3.0 / math.pi), [(0.0, hexc("#E8463A")), (0.166, hexc("#F9D23E")), (0.333, hexc("#3E97E0")),
                                    (0.5, hexc("#FFFFFF")), (0.666, hexc("#5CC45A")), (0.833, hexc("#F79B2C"))],
            "CONSTANT"))
        sphere("Ball", (-0.12, -0.02, SH / 2 + 0.015 + 0.13), 0.13, ball_mat, rot=(20, 30, 0), parent=sh)
        # stacking-ring toy on top
        cyl("RingBase", (0.3, 0.0, SH + 0.035), 0.1, 0.035, P["purple"], verts=32, parent=sh, bevel=0.01)
        cyl("RingPeg", (0.3, 0.0, SH + 0.2), 0.018, 0.3, M["pine_v"], verts=12, parent=sh)
        for i, (c, r) in enumerate(((P["red"], 0.085), (P["orange"], 0.074), (P["yellow"], 0.064),
                                    (P["green"], 0.054), (P["blue"], 0.045))):
            torus(f"Ring{i}", (0.3, 0.0, SH + 0.075 + i * 0.05), r, 0.026, c, parent=sh)
        sphere("RingTop", (0.3, 0.0, SH + 0.36), 0.035, P["red"], parent=sh)

        # --- giant felt flowers in the two back corners
        def flower(name, base, height, petal_col, center_col, n=8, R=0.30, tilt=8.0, yaw=0.0):
            root = empty(name, base, (0, 0, yaw))
            cyl(name + "Stem", (0, 0, height / 2), 0.035, height, F["stem"], verts=16, parent=root)
            head = empty(name + "Head", (0, 0, height), (90 - tilt, 0, 0), parent=root)
            for i in range(n):
                a = 2 * math.pi * i / n
                sphere(f"{name}Petal{i}", (math.cos(a) * R * 0.62, math.sin(a) * R * 0.62, 0.0), R * 0.45,
                       petal_col, scale=(1.0, 0.62, 0.12), rot=(0, 0, math.degrees(a)), parent=head)
            sphere(name + "Center", (0, 0, -0.03), R * 0.36, center_col, scale=(1, 1, 0.35), parent=head)
            for j, (hz, side) in enumerate(((height * 0.35, 1), (height * 0.55, -1))):
                sphere(f"{name}Leaf{j}", (side * 0.17, 0.0, hz), 0.17, F["leaf"], scale=(1.0, 0.25, 0.42),
                       rot=(0, side * -35, 0), parent=root)
            box(name + "Pot", (0, 0, 0.13), (0.3, 0.3, 0.26), P["orange"], bevel=0.03, parent=root)
            return root

        o["flower_r"] = flower("FlowerR", (1.80, -0.32, 0.0), 2.08, F["pink"], F["yellow"], n=9)
        o["flower_l"] = flower("FlowerL", (-1.92, -0.25, 0.0), 1.85, F["red"], F["black"], n=7, R=0.27,
                               yaw=10.0)

    # ------------------------------------------------------------ lights
    def light_bright(self):
        warm = kelvin(4500)
        s = scene()
        s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.57, 0.6, 1)
        s.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
        light("Key", "AREA", (-3.3, -6.6, 3.9), 2100, warm, target=(-0.2, -0.8, 1.0), size=3.5, size_y=2.5)
        light("Fill", "AREA", (3.6, -6.2, 3.3), 1300, warm, target=(0.2, -0.8, 1.0), size=3.5, size_y=2.5)
        light("Top", "AREA", (0.0, -1.7, 4.3), 650, warm, target=(0.0, -1.2, 0.0), size=3.5, size_y=2.0)
        light("Kick", "AREA", (0.0, -3.0, 0.6), 120, warm, target=(0.0, 0.0, 0.5), size=2.5, size_y=0.6)

    def light_dark(self):
        s = scene()
        s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
        red = hexc("#FF2A1A")[:3]
        # one red work light clamped high on the right flat, aimed down across the set
        light("WorkRed", "SPOT", (2.02, -1.6, 3.35), 1100, red, target=(-0.3, -1.1, 0.0), size=0.04,
              spot=78.0, blend=1.0)
        can = cyl("WorkLampCan", (2.12, -1.62, 3.42), 0.09, 0.2, make_mat("LampCan", hexc("#222222"), 0.5),
                  rot=(0, -50, 0))
        can.visible_shadow = False
        light("RedBounce", "AREA", (0.0, -4.6, 2.2), 14, red, target=(0, 0, 1.0), size=4.0, size_y=2.0)
        # faint cold spill out of the open doorway (the doorway itself stays black)
        light("DoorSpill", "AREA", (1.2, 0.03, 0.95), 3.0, (0.55, 0.65, 0.85), rot=(-90, 0, 0), size=0.62,
              size_y=1.8, spread=75.0)
        light("Ambient", "AREA", (0.0, -5.0, 2.0), 5, (0.6, 0.65, 0.8), target=(0, 0, 1.0), size=5.0,
              size_y=3.0)


def playroom_camera_wide():
    return camera(PR_CAM["loc"], rot=PR_CAM["rot"], lens=PR_CAM["lens"], shift_y=PR_CAM["shift_y"])


def playroom_camera_board():
    bc = Vector(PR_BOARD["center"])
    yaw = math.radians(PR_BOARD["yaw"])
    n = Vector((math.sin(yaw), -math.cos(yaw), 0.0))
    side = Vector((math.cos(yaw), math.sin(yaw), 0.0))
    a = math.radians(15.0)
    d = n * math.cos(a) + side * math.sin(a)
    D = 1.55
    loc = Vector((bc.x + d.x * D, bc.y + d.y * D, 1.1))
    look = Vector((bc.x, bc.y, 1.1)) - loc
    heading = math.atan2(look.y, look.x) - math.atan2(85.0, 711.0)
    rz = math.degrees(heading) - 90.0
    return camera(tuple(loc), rot=(90.0, 0.0, rz), lens=40.0, shift_y=-0.075)


def playroom_meta_common(pr):
    o = pr.objs
    felt = o["board_felt"]
    bpy.context.view_layer.update()
    mw = felt.matrix_world
    w, h = PR_BOARD["w"], PR_BOARD["h"]
    corners = [proj(mw @ Vector((sx * w / 2, -0.011, sz * h / 2)))
               for sx, sz in ((-1, 1), (1, 1), (1, -1), (-1, -1))]
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    chair = o["chair"].matrix_world @ Vector((0, 0, 0.31))
    return dict(board_corners_tl_tr_br_bl=corners,
                board_rect=[min(xs), min(ys), max(xs), max(ys)],
                chair_center=proj(chair),
                chair_seat_rect=proj_obj_bbox(o["chair"]))


def render_playroom(variant):
    """variant: wide | ajar | dark | board"""
    big = variant == "dark"
    reset(1280 if big else 640, 960 if big else 480,
          samples=64 if variant != "dark" else 96,
          look="AgX - Medium High Contrast", exposure=0.0)
    if variant != "dark":
        scene().view_settings.view_transform = "Standard"
        scene().view_settings.look = "None"
        scene().view_settings.exposure = float(os.environ.get("POPPY_PR_EXPOSURE", "-2.3"))
    pr = Playroom("dark" if variant == "dark" else ("ajar" if variant == "ajar" else "wide"))
    pr.build()
    if variant == "dark":
        pr.light_dark()
    else:
        pr.light_bright()
    if variant == "board":
        playroom_camera_board()
    else:
        playroom_camera_wide()
    name = {"wide": "playroom_wide", "ajar": "playroom_wide_ajar", "dark": "playroom_dark",
            "board": "playroom_board"}[variant]
    path = render(name)
    meta = {}
    if variant == "board":
        bpy.context.view_layer.update()
        felt = pr.objs["board_felt"].matrix_world
        w, h = PR_BOARD["w"], PR_BOARD["h"]
        cz = PR_BOARD["center"][2]
        corners = [proj(felt @ Vector((sx * w / 2, -0.011, sz * h / 2)))
                   for sx, sz in ((-1, 1), (1, 1), (1, -1), (-1, -1))]
        slots = [proj(felt @ Vector((-w / 2 + w * (i + 0.5) / 5, -0.011, 0.0))) for i in range(5)]
        meta = dict(board_corners_tl_tr_br_bl=corners, slot_centers=slots, slot_size=[80, 120],
                    poppy_head_center=[545, 150], poppy_note="Poppy cropped at the knees at the right edge")
    else:
        meta = playroom_meta_common(pr)
        mark = Vector(PR_POPPY_MARK)
        meta["poppy_foot"] = proj(mark)
        meta["poppy_px_per_m"] = px_per_m_at(mark)
        meta["poppy_head_top_for_1p75m"] = proj((mark.x, mark.y, 1.75))
        dx0, dx1, dtop = PR_DOOR
        meta["door_opening_rect"] = [*proj((dx0, 0.0, dtop)), *proj((dx1, 0.0, 0.0))]
        meta["door_rect"] = proj_obj_bbox(pr.objs["door_hinge"])
        if variant == "dark":
            meta["note"] = "1280x960 render; all coordinates in this pixel space."
    save_blend("playroom_" + variant)
    write_meta(name, meta)
    return path, pr


def post_ajar():
    """Make playroom_wide_ajar identical to playroom_wide outside the door region."""
    a = load_png(os.path.join(OUT_IMG, "playroom_wide.png"))
    b = load_png(os.path.join(OUT_IMG, "playroom_wide_ajar.png"))
    diff = np.abs(a - b).max(axis=2) > (6.0 / 255.0)
    meta = json.load(open(META_PATH)) if os.path.exists(META_PATH) else {}
    r = meta.get("playroom_wide_ajar", {}).get("door_rect")
    mask = np.zeros(diff.shape, bool)
    if r:
        x0, y0, x1, y1 = int(r[0]) - 12, int(r[1]) - 12, int(r[2]) + 14, int(r[3]) + 12
        mask[max(0, y0):y1, max(0, x0):x1] = True
    keep = diff & mask
    # grow the region a little so edges blend
    k = keep.copy()
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            k |= np.roll(np.roll(keep, dy, 0), dx, 1)
    k &= mask
    out = np.where(k[..., None], b, a)
    save_png(os.path.join(OUT_IMG, "playroom_wide_ajar.png"), out)
    print("ajar: kept", int(k.sum()), "door pixels; rest identical to playroom_wide")


def post_dark():
    p = os.path.join(OUT_IMG, "playroom_dark.png")
    a = load_png(p)
    lum = (a * np.array([0.299, 0.587, 0.114], np.float32)).sum(axis=2, keepdims=True)
    a = a * 0.6 + lum * 0.4
    save_png(p, a)


# ============================================================== institutional kit
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


def cinder_mat(name, u_axis, lower, upper, stripe=None, band_z=1.05, grime=0.45, streak=0.45,
               floor_dirt=0.45, scuff=0.35):
    """Painted cinderblock: two-tone institutional paint, mortar lines, porous bump."""

    def base(b, vec):
        uv, p = _uv(b, u_axis)
        br = _brick(b, uv, 0.40, 0.20, 0.010)
        zf = b.math("DIVIDE", p[2], 3.0)
        stops = [(0.0, lower)]
        if stripe is not None:
            stops += [(band_z / 3.0, stripe), ((band_z + 0.06) / 3.0, upper)]
        else:
            stops += [(band_z / 3.0, upper)]
        paint = b.ramp(zf, stops, "CONSTANT")
        col = b.mix(paint, br.outputs[0], 1.0, "MULTIPLY")
        if scuff:
            sv = b.mapping(b.coords("world"), scale=(1.2, 1.2, 16.0))
            sn = b.maprange(b.noise(sv, 1.0, 4.0, 0.6), 0.6, 0.75, 1.0, 1.0 - scuff)
            zband = b.math("MULTIPLY", b.maprange(p[2], 0.15, 0.3, 0.0, 1.0),
                           b.maprange(p[2], 0.95, 1.15, 1.0, 0.0))
            col = b.scale(col, b.math("ADD", 1.0, b.math("MULTIPLY", b.math("SUBTRACT", sn, 1.0), zband)))
        return col

    def normal(b, vec):
        uv, p = _uv(b, u_axis)
        br = _brick(b, uv, 0.40, 0.20, 0.010)
        h = b.math("ADD", b.math("MULTIPLY", br.outputs[1], -1.0),
                   b.math("MULTIPLY", b.noise(vec, 45.0, 6.0, 0.7), 0.35))
        bp = b.node("ShaderNodeBump")
        bp.inputs["Strength"].default_value = 0.45
        bp.inputs["Distance"].default_value = 0.01
        b.set(bp.inputs["Height"], h)
        return bp.outputs[0]

    return make_mat(name, rough=0.75, var=0.06, var_scale=2.0, grime=grime, grime_scale=1.3, streak=streak,
                    floor_dirt=floor_dirt, space="world", base=base, normal_fn=normal, spec=0.35)


def vct_mat(name, c1, c2, mortar, speck_dark, speck_light, tile=0.305, wall_x=None, dirt=0.35):
    """Speckled vinyl-composition floor tiles with traffic dirt along the walls."""

    def base(b, vec):
        uv, p = _uv(b, "x", "y")
        br = _brick(b, uv, tile, tile, 0.0025, offset=0.0, freq=1, c1=c1, c2=c2, cm=mortar, smooth=0.0)
        col = br.outputs[0]
        n = b.noise(b.mapping(uv, scale=(1, 1, 1)), 260.0, 1.0, 0.5)
        dk = b.maprange(n, 0.30, 0.285, 0.0, 1.0)
        lt = b.maprange(n, 0.70, 0.715, 0.0, 1.0)
        col = b.mix(col, b.rgb(speck_dark), dk)
        col = b.mix(col, b.rgb(speck_light), lt)
        if wall_x is not None:
            ax = b.math("ABSOLUTE", b.math("SUBTRACT", p[0], wall_x[0]))
            d = b.maprange(ax, wall_x[1] - 0.45, wall_x[1], 1.0, 1.0 - dirt)
            col = b.scale(col, d)
        return col

    m = make_mat(name, rough=0.3, var=0.08, var_scale=1.5, grime=0.3, grime_scale=0.9, space="world",
                 base=base, rough_var=0.18, spec=0.5, bump=0.04, bump_scale=30)
    return m


def ceiling_tile_mat(name, grime=0.35):
    def base(b, vec):
        uv, p = _uv(b, "x", "y")
        br = _brick(b, uv, 0.61, 0.61, 0.012, offset=0.0, freq=1, c1=hexc("#D9D6CB"), c2=hexc("#D2CFC3"),
                    cm=hexc("#BDBDB4"), smooth=0.0)
        return br.outputs[0]

    return make_mat(name, rough=0.95, var=0.06, grime=grime, grime_scale=1.1, space="world", base=base,
                    bump=0.2, bump_scale=140, spec=0.2)


def fluoro(name, center, length=1.22, axis="y", power=60.0, color=None, on=True, tubes=2,
           housing=None, glow=6.0):
    """Ceiling fluorescent fixture: white housing, bare tubes, area light underneath."""
    color = color or tint(kelvin(4100), (0.78, 1.0, 0.78), 0.35)
    housing = housing or make_mat("FluoroHousing", hexc("#DCDCD2"), 0.4, var=0.04, grime=0.35)
    cx, cy, cz = center
    rot = (0, 0, 0) if axis == "y" else (0, 0, 90)
    root = empty(name, (cx, cy, cz), rot)
    box(name + "Housing", (0, 0, 0.0), (0.24, length + 0.06, 0.07), housing, bevel=0.01, parent=root)
    if on:
        tube_m = emit_mat(name + "Tube", (*color, 1.0), glow)
    else:
        tube_m = make_mat(name + "TubeOff", hexc("#BFC2BC"), 0.3, var=0.0)
    for i in range(tubes):
        x = (i - (tubes - 1) / 2) * 0.08
        cyl(f"{name}Tube{i}", (x, 0, -0.055), 0.017, length, tube_m, rot=(90, 0, 0), verts=14, parent=root)
    for sy in (-1, 1):
        box(f"{name}Cap{sy}", (0, sy * length / 2, -0.05), (0.2, 0.03, 0.04), housing, parent=root)
    lt = None
    if on and power > 0:
        lt = light(name + "Light", "AREA", (cx, cy, cz - 0.09), power, color, rot=rot, size=0.18,
                   size_y=length)
        if axis != "y":
            lt.rotation_euler = (0, 0, math.radians(90))
    return root, lt


def inst_door(name, origin, wall_axis, facing, width=0.9, height=2.1, slab=None, frame=None, plaque=True,
              ajar=0.0, void=None, plaque_side=1, hinge_side=-1):
    """Hollow-metal door set into a wall opening.

    origin: (x, y) of the opening centre on the wall's room-side face; wall_axis 'y' means the wall runs
    along y (corridor side wall); facing: +1/-1, direction (along the wall normal) toward the room."""
    slab = slab or make_mat("DoorSlab", hexc("#5E6E6E"), 0.45, var=0.05, grime=0.4, grime_scale=2.0,
                            floor_dirt=0.3, coat=0.1)
    frame = frame or make_mat("DoorFrame", hexc("#4E524C"), 0.4, var=0.05, grime=0.35, metallic=0.2)
    metal = bpy.data.materials.get("BrushedMetal") or make_mat("BrushedMetal", hexc("#9EA19C"), 0.35,
                                                                metallic=0.8, var=0.08, grime=0.3)
    ox, oy = origin
    yaw = {("y", 1): 90.0, ("y", -1): -90.0, ("x", 1): 180.0, ("x", -1): 0.0}[(wall_axis, facing)]
    root = empty(name, (ox, oy, 0.0), (0, 0, yaw))
    # local frame: door plane = local XZ, room toward local -Y
    fw = 0.06
    box(name + "FrL", (-width / 2 - fw / 2, -0.01, height / 2), (fw, 0.05, height + fw), frame, parent=root)
    box(name + "FrR", (width / 2 + fw / 2, -0.01, height / 2), (fw, 0.05, height + fw), frame, parent=root)
    box(name + "FrT", (0, -0.012, height + fw / 2), (width + 2 * fw + 0.004, 0.054, fw), frame, parent=root)
    m = 1.0 if hinge_side < 0 else -1.0
    hinge = empty(name + "Hinge", (-m * width / 2, 0.03, 0.0), (0, 0, m * ajar), parent=root)
    box(name + "Slab", (m * width / 2, 0.0, height / 2 + 0.005), (width - 0.006, 0.045, height - 0.012), slab,
        parent=hinge)
    box(name + "Kick", (m * width / 2, -0.025, 0.13), (width - 0.06, 0.004, 0.24), metal, parent=hinge)
    box(name + "LeverBase", (m * (width - 0.09), -0.03, 1.0), (0.05, 0.02, 0.16), metal, bevel=0.005,
        parent=hinge)
    box(name + "Lever", (m * (width - 0.15), -0.06, 1.02), (0.13, 0.025, 0.025), metal, bevel=0.008,
        parent=hinge)
    if plaque:
        pm = bpy.data.materials.get("Plaque") or make_mat("Plaque", hexc("#D9CFB0"), 0.4, var=0.06,
                                                           grime=0.3)
        box(name + "Plaque", (plaque_side * (width / 2 + 0.22), -0.008, 1.55), (0.22, 0.012, 0.09), pm,
            bevel=0.004, parent=root)
    if void is not None:
        box(name + "Void", (0, 1.5, height / 2), (width + 1.2, 2.5, height + 0.6), void, parent=root)
    return root


def folding_chair(name, loc, yaw, lean, mat):
    """A metal folding chair, folded flat and leaned against a wall."""
    root = empty(name, loc, (lean, 0, yaw))
    for sx in (-1, 1):
        cyl(f"{name}Leg{sx}", (sx * 0.2, 0, 0.45), 0.012, 0.92, mat, verts=10, parent=root)
        cyl(f"{name}LegB{sx}", (sx * 0.17, 0.03, 0.38), 0.011, 0.78, mat, verts=10, parent=root)
    box(name + "Back", (0, -0.005, 0.8), (0.42, 0.014, 0.18), mat, bevel=0.01, parent=root)
    box(name + "Seat", (0, 0.03, 0.45), (0.38, 0.02, 0.36), mat, bevel=0.01, parent=root)
    for z in (0.05, 0.62):
        cyl(f"{name}Bar{z}", (0, 0.0, z), 0.009, 0.4, mat, rot=(0, 90, 0), verts=8, parent=root)
    return root


def mop_bucket(name, loc, yaw=0.0):
    yel = make_mat("BucketYellow", hexc("#D9B21C"), 0.45, var=0.08, grime=0.45, grime_scale=4.0, floor_dirt=0.5)
    grey = make_mat("WringerGrey", hexc("#55585A"), 0.5, var=0.08, grime=0.4)
    blk = make_mat("Rubber", hexc("#151515"), 0.7, var=0.05)
    water = make_mat("DirtyWater", hexc("#3E4231"), 0.05, var=0.1, spec=0.6)
    wood = make_mat("MopHandle", hexc("#B48A5A"), 0.5, var=0.1, grime=0.3)
    strands = make_mat("MopStrands", hexc("#8E8A7C"), 0.95, var=0.15, grime=0.5, bump=0.6, bump_scale=60)
    root = empty(name, loc, (0, 0, yaw))
    box(name + "Tub", (0, 0, 0.2), (0.42, 0.36, 0.32), yel, bevel=0.04, parent=root)
    box(name + "Water", (0, 0, 0.33), (0.36, 0.30, 0.01), water, parent=root)
    box(name + "Wringer", (0.13, 0, 0.47), (0.16, 0.3, 0.22), grey, bevel=0.015, parent=root)
    cyl(name + "Press", (0.13, 0, 0.75), 0.012, 0.5, grey, verts=8, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"{name}Wheel{sx}{sy}", (sx * 0.17, sy * 0.14, 0.03), 0.03, 0.025, blk, rot=(90, 0, 0), verts=12,
                parent=root)
    cyl(name + "Handle", (-0.05, 0.02, 0.78), 0.013, 1.4, wood, rot=(0, -14, 0), verts=10, parent=root)
    sphere(name + "Head", (0.03, 0.02, 0.18), 0.13, strands, scale=(1, 1, 1.3), parent=root)
    return root


def cardboard_box(name, center, size, yaw=0.0, mat=None):
    mat = mat or bpy.data.materials.get("Cardboard") or make_mat(
        "Cardboard", hexc("#A07B4E"), 0.85, var=0.12, var_scale=6, grime=0.35, bump=0.15, bump_scale=40)
    tape = bpy.data.materials.get("Tape") or make_mat("Tape", hexc("#C8B07A"), 0.3, var=0.05)
    b = box(name, center, size, mat, rot=(0, 0, yaw), bevel=0.006)
    box(name + "Tape", (center[0], center[1], center[2] + size[2] / 2 + 0.001), (0.06, size[1] + 0.004, 0.003),
        tape, rot=(0, 0, yaw))
    return b


# ============================================================== BACKSTAGE CORRIDOR
CORR = dict(w=1.9, h=2.6, L=14.6, cam=(-0.15, 0.0, 1.55), costume_y=13.15)


def render_corridor():
    reset(640, 480, samples=64, look="AgX - Medium High Contrast", exposure=-0.35)
    W, H, L = CORR["w"] / 2, CORR["h"], CORR["L"]
    wall_l = cinder_mat("CinderL", "y", hexc("#9FB08C"), hexc("#DCDDBE"), hexc("#7C8C6C"), band_z=1.0)
    wall_r = cinder_mat("CinderR", "y", hexc("#9FB08C"), hexc("#DCDDBE"), hexc("#7C8C6C"), band_z=1.0)
    wall_e = cinder_mat("CinderE", "x", hexc("#9FB08C"), hexc("#DCDDBE"), hexc("#7C8C6C"), band_z=1.0)
    floor = vct_mat("VCT", hexc("#BDB79C"), hexc("#B0A98D"), hexc("#6D6858"), hexc("#55524A"),
                    hexc("#E2DECF"), wall_x=(0.0, W), dirt=0.5)
    ceil = ceiling_tile_mat("CeilTile")
    void = void_mat()
    base_m = make_mat("CoveBase", hexc("#3B3A35"), 0.6, var=0.05, grime=0.2)
    pipe = make_mat("Conduit", hexc("#8E928C"), 0.4, metallic=0.6, var=0.06, grime=0.4)

    # doors (left wall x=-W, right wall x=+W): y centres
    left_doors = [5.9, 10.9]
    right_doors = [7.9, 12.2]
    dw = 0.9
    holes_l = [(y - dw / 2, y + dw / 2, -0.1, 2.1) for y in left_doors]
    holes_r = [(y - dw / 2, y + dw / 2, -0.1, 2.1) for y in right_doors]
    wall_with_holes("WallL", "y", -W - 0.2, -1.0, L, 0.0, H, 0.2, holes_l, wall_l)
    wall_with_holes("WallR", "y", W, -1.0, L, 0.0, H, 0.2, holes_r, wall_r)
    box2("EndWall", (-W - 0.2, L, 0.0), (W + 0.2, L + 0.2, H), wall_e)
    box2("Floor", (-W - 0.3, -1.0, -0.05), (W + 0.3, L + 0.3, 0.0), floor)
    box2("Ceiling", (-W - 0.3, -1.0, H), (W + 0.3, L + 0.3, H + 0.05), ceil)
    for sx in (-1, 1):
        x0 = sx * W
        box2(f"Cove{sx}", (min(x0, x0 - sx * 0.012), -1.0, 0.0), (max(x0, x0 - sx * 0.012), L, 0.1), base_m)
    box2("CoveE", (-W, L - 0.012, 0.0), (W, L, 0.1), base_m)
    # conduit + junction boxes high on the left wall, a pipe on the right
    cyl("ConduitL", (-W + 0.05, L / 2, H - 0.12), 0.022, L + 2, pipe, rot=(90, 0, 0), verts=12)
    cyl("PipeR", (W - 0.07, L / 2, H - 0.2), 0.045, L + 2, pipe, rot=(90, 0, 0), verts=16)
    for y in (2.5, 6.8, 11.0):
        box(f"JBox{y}", (-W + 0.05, y, H - 0.12), (0.06, 0.12, 0.12), pipe)

    # doors
    slab_a = make_mat("DoorSlabA", hexc("#5D6E70"), 0.45, var=0.05, grime=0.4, grime_scale=2.0, floor_dirt=0.3)
    for i, y in enumerate(left_doors):
        inst_door(f"DoorL{i}", (-W, y), "y", 1, slab=slab_a, plaque_side=-1)
    for i, y in enumerate(right_doors):
        ajar = 9.0 if i == 0 else 0.0
        inst_door(f"DoorR{i}", (W, y), "y", -1, slab=slab_a, ajar=ajar, void=void if ajar else None,
                  plaque_side=1, hinge_side=1)
    # far end: closed double-width door with a push bar
    inst_door("DoorEnd", (0.0, L), "x", -1, width=1.0, slab=make_mat("DoorEndSlab", hexc("#6A5A4A"), 0.45,
                                                                      var=0.05, grime=0.45), plaque=False)

    # lights: three fixtures, the far one dimmer
    col = tint(kelvin(4100), (0.75, 1.0, 0.72), 0.4)
    fluoro("Tube1", (0.0, 3.4, H - 0.04), power=70, color=col, glow=6.0)
    fluoro("Tube2", (0.0, 8.4, H - 0.04), power=55, color=col, glow=5.0)
    fluoro("Tube3", (0.0, 13.0, H - 0.04), power=26, color=col, glow=2.4)

    # props along the left wall near the camera, boxes on the right
    mop_bucket("Mop", (-W + 0.3, 3.75, 0.0), yaw=8)
    grey = make_mat("ChairMetal", hexc("#6E716C"), 0.45, metallic=0.5, var=0.08, grime=0.4)
    folding_chair("FoldChair", (-W + 0.21, 4.65, 0.0), -90, 11, grey)
    cardboard_box("Box1", (W - 0.32, 4.1, 0.2), (0.5, 0.45, 0.4), yaw=4)
    cardboard_box("Box2", (W - 0.3, 4.12, 0.6), (0.42, 0.4, 0.36), yaw=-7)
    cardboard_box("Box3", (W - 0.28, 4.75, 0.17), (0.4, 0.35, 0.34), yaw=12)
    # cork board with blank pinned sheets on the right wall
    cork = make_mat("Cork", hexc("#A87B4F"), 0.9, var=0.12, var_scale=40, grime=0.3, bump=0.3, bump_scale=200)
    paper = make_mat("Paper", hexc("#E9E4D2"), 0.8, var=0.06, grime=0.35)
    box("Cork", (W - 0.015, 5.6, 1.5), (0.02, 0.9, 0.6), cork, bevel=0.005)
    for i, (y, z, r, sw, sh) in enumerate(((5.33, 1.58, 4, 0.21, 0.28), (5.74, 1.62, -7, 0.15, 0.2),
                                            (5.88, 1.36, 11, 0.21, 0.27), (5.5, 1.33, -3, 0.13, 0.13))):
        box(f"Sheet{i}", (W - 0.028 - 0.001 * i, y, z), (0.004, sw, sh), paper, rot=(r, 0, 0))
    # fire extinguisher on the left wall (plain red cylinder, no text)
    red = make_mat("ExtRed", hexc("#A8231D"), 0.3, var=0.05, coat=0.3, grime=0.25)
    cyl("Extinguisher", (-W + 0.11, 8.9, 0.95), 0.08, 0.5, red, verts=20)
    cyl("ExtTop", (-W + 0.11, 8.9, 1.24), 0.03, 0.08, grey, verts=12)
    # a stack of chairs / a rolling cart in the mid distance on the right
    cart_m = make_mat("CartGrey", hexc("#4C5150"), 0.5, metallic=0.3, var=0.08, grime=0.35)
    for z in (0.15, 0.55, 0.9):
        box(f"CartShelf{z}", (W - 0.3, 9.9, z), (0.45, 0.8, 0.03), cart_m)
    for sy in (-1, 1):
        for sx in (-1, 1):
            cyl(f"CartPost{sx}{sy}", (W - 0.3 + sx * 0.21, 9.9 + sy * 0.38, 0.5), 0.012, 0.95, cart_m, verts=8)
    cardboard_box("CartBox", (W - 0.3, 9.8, 0.68), (0.38, 0.5, 0.22))
    # stains: puddle near the bucket

    cam = camera(CORR["cam"], rot=(90.0, 0.0, 0.0), lens=30.0, shift_y=-0.02)
    render("backstage_corridor")
    foot = (0.02, CORR["costume_y"], 0.0)
    fp = proj(foot)
    meta = dict(far_end_foot=fp, far_end_foot_mirrored=[round(640 - fp[0], 1), fp[1]],
                px_per_m_at_far_end=px_per_m_at(foot), costume_head_top_for_1p8m=proj((0.02, CORR["costume_y"], 1.8)),
                far_door_rect=[*proj((-0.5, L, 2.1)), *proj((0.5, L, 0.0))],
                note="The compositor mirrors this image horizontally for 'looking back' shots; use "
                     "far_end_foot_mirrored there.")
    save_blend("backstage_corridor")
    write_meta("backstage_corridor", meta)


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


def wooden_chair(name, loc, yaw, wood, seat_h=0.46, back_h=0.95):
    """Plain wooden chair; local -Y is the front (faces the viewer at yaw=0 when camera looks +Y)."""
    root = empty(name, loc, (0, 0, yaw))
    sw, sd = 0.44, 0.42
    box(name + "Seat", (0, 0, seat_h - 0.02), (sw, sd, 0.04), wood, bevel=0.01, parent=root)
    for sx in (-1, 1):
        cyl(f"{name}FrontLeg{sx}", (sx * (sw / 2 - 0.03), -(sd / 2 - 0.03), (seat_h - 0.04) / 2), 0.02,
            seat_h - 0.04, wood, verts=12, parent=root)
        cyl(f"{name}BackPost{sx}", (sx * (sw / 2 - 0.03), sd / 2 - 0.03, back_h / 2), 0.022, back_h, wood,
            verts=12, parent=root)
    for z in (0.16,):
        box(f"{name}Rung{z}", (0, -(sd / 2 - 0.03), z), (sw - 0.06, 0.02, 0.02), wood, parent=root)
        box(f"{name}RungB{z}", (0, sd / 2 - 0.03, z), (sw - 0.06, 0.02, 0.02), wood, parent=root)
    box(name + "TopRail", (0, sd / 2 - 0.03, back_h - 0.06), (sw - 0.02, 0.03, 0.1), wood, bevel=0.01, parent=root)
    box(name + "MidRail", (0, sd / 2 - 0.03, seat_h + 0.22), (sw - 0.06, 0.025, 0.05), wood, bevel=0.006,
        parent=root)
    for x in (-0.09, 0.0, 0.09):
        box(f"{name}Spindle{x}", (x, sd / 2 - 0.03, (seat_h + back_h) / 2 + 0.05), (0.025, 0.02,
            back_h - seat_h - 0.2), wood, parent=root)
    return root


def wire_hanger(name, loc, mat, parent=None, yaw=0.0):
    root = empty(name, loc, (0, 0, yaw), parent=parent)
    tube(name + "Hook", [(0, 0, 0.0), (0, 0, 0.05), (0.025, 0, 0.07), (0.035, 0, 0.045)], 0.003, mat).parent = root
    tube(name + "Body", [(-0.2, 0, -0.14), (0.0, 0, 0.0), (0.2, 0, -0.14), (-0.2, 0, -0.14)], 0.003, mat).parent = root
    return root


def render_dressing_room():
    reset(640, 480, samples=64, look="AgX - Medium High Contrast", exposure=-0.3)
    X0, X1, Y1, H = -1.25, 1.45, 3.7, 2.55
    walls_y = cinder_mat("DRWallY", "y", hexc("#A7B394"), hexc("#CBD2BA"), band_z=1.1, grime=0.5, streak=0.5)
    walls_x = cinder_mat("DRWallX", "x", hexc("#A7B394"), hexc("#CBD2BA"), band_z=1.1, grime=0.5, streak=0.5)
    floor = vct_mat("DRFloor", hexc("#A9A88F"), hexc("#9E9C84"), hexc("#64614F"), hexc("#4F4D42"),
                    hexc("#D6D3C2"), dirt=0.45)
    ceil = ceiling_tile_mat("DRCeil", grime=0.45)
    void = void_mat()
    door_y0, door_y1 = 2.62, 3.5
    wall_with_holes("DRWallL", "y", X0 - 0.2, -0.5, Y1, 0.0, H, 0.2, [], walls_y)
    wall_with_holes("DRWallR", "y", X1, -0.5, Y1, 0.0, H, 0.2, [(door_y0, door_y1, -0.1, 2.08)], walls_y)
    box2("DRWallBack", (X0 - 0.2, Y1, 0.0), (X1 + 0.2, Y1 + 0.2, H), walls_x)
    box2("DRWallFront", (X0 - 0.2, -0.45, 0.0), (X1 + 0.2, -0.25, H), walls_x)
    box2("DRFloor", (X0 - 0.3, -0.5, -0.05), (X1 + 0.3, Y1 + 0.3, 0.0), floor)
    box2("DRCeil", (X0 - 0.3, -0.5, H), (X1 + 0.3, Y1 + 0.3, H + 0.05), ceil)
    base_m = make_mat("DRCove", hexc("#34332E"), 0.6, var=0.05, grime=0.2)
    box2("DRCoveL", (X0, -0.4, 0.0), (X0 + 0.012, Y1, 0.1), base_m)
    box2("DRCoveR", (X1 - 0.012, -0.4, 0.0), (X1, door_y0 - 0.05, 0.1), base_m)
    box2("DRCoveB", (X0, Y1 - 0.012, 0.0), (X1, Y1, 0.1), base_m)
    slab = make_mat("DRDoorSlab", hexc("#6D5F4F"), 0.45, var=0.06, grime=0.45, floor_dirt=0.3)
    inst_door("DRDoor", (X1, (door_y0 + door_y1) / 2), "y", -1, width=door_y1 - door_y0 - 0.02, slab=slab,
              ajar=20.0, void=void, plaque=False, hinge_side=1)

    # --- counter along the left wall, with cabinet fronts, sink at the far end
    top_m = make_mat("Formica", hexc("#D8D0B8"), 0.35, var=0.06, grime=0.45, grime_scale=3.0)
    cab_m = make_mat("CabinetPaint", hexc("#7E8C78"), 0.5, var=0.06, grime=0.5, floor_dirt=0.5)
    cx0, cx1, cy0, cy1, ctop = X0, X0 + 0.55, 1.15, Y1, 0.8
    box2("CounterTop", (cx0, cy0, ctop - 0.04), (cx1, cy1, ctop), top_m, bevel=0.008)
    box2("CounterBody", (cx0, cy0 + 0.02, 0.08), (cx1 - 0.04, cy1, ctop - 0.04), cab_m)
    box2("CounterToe", (cx0, cy0 + 0.04, 0.0), (cx1 - 0.1, cy1, 0.08), base_m)
    metal = bpy.data.materials.get("BrushedMetal") or make_mat("BrushedMetal", hexc("#9EA19C"), 0.35,
                                                                metallic=0.8, var=0.08, grime=0.3)
    for i, y in enumerate(np.arange(cy0 + 0.05, cy1 - 0.4, 0.5)):
        box2(f"CabDoor{i}", (cx1 - 0.045, y + 0.01, 0.12), (cx1 - 0.035, y + 0.48, ctop - 0.08), cab_m)
        box(f"CabPull{i}", (cx1 - 0.03, y + 0.4, ctop - 0.16), (0.012, 0.012, 0.08), metal)
    porcelain = make_mat("Porcelain", hexc("#E6E3DA"), 0.15, var=0.05, grime=0.45, grime_scale=5.0, coat=0.3)
    box2("SinkBasin", (cx0 + 0.1, cy1 - 0.55, ctop - 0.16), (cx1 - 0.08, cy1 - 0.15, ctop + 0.004), porcelain)
    box2("SinkWater", (cx0 + 0.13, cy1 - 0.52, ctop - 0.15), (cx1 - 0.11, cy1 - 0.18, ctop - 0.14),
         make_mat("SinkStain", hexc("#5E5845"), 0.3, var=0.2))
    cyl("Faucet", (cx0 + 0.06, cy1 - 0.35, ctop + 0.1), 0.014, 0.2, metal, verts=12)
    cyl("FaucetSpout", (cx0 + 0.12, cy1 - 0.35, ctop + 0.19), 0.012, 0.13, metal, rot=(0, 90, 0), verts=12)

    # --- mirror with bulbs (about half burnt out)
    mirror = make_mat("Mirror", hexc("#B8BCB4"), 0.06, metallic=1.0, var=0.08, grime=0.55, grime_scale=4.0)
    mframe = make_mat("MirrorFrame", hexc("#2E2C28"), 0.5, var=0.05, grime=0.3)
    my0, my1, mz0, mz1 = 1.45, 3.05, 1.05, 1.85
    box2("MirrorBack", (X0, my0 - 0.12, mz0 - 0.12), (X0 + 0.03, my1 + 0.12, mz1 + 0.12), mframe)
    box2("Mirror", (X0 + 0.03, my0, mz0), (X0 + 0.04, my1, mz1), mirror)
    warm = kelvin(2600)
    bulb_on = emit_mat("BulbOn", (*warm, 1.0), 9.0)
    bulb_off = make_mat("BulbOff", hexc("#8F8B80"), 0.15, var=0.0, spec=0.8, coat=0.5)
    bulbs = [(y, mz1 + 0.07) for y in np.linspace(my0, my1, 7)]
    bulbs += [(my0 - 0.07, z) for z in np.linspace(mz0 + 0.05, mz1 - 0.05, 3)]
    bulbs += [(my1 + 0.07, z) for z in np.linspace(mz0 + 0.05, mz1 - 0.05, 3)]
    on_set = {1, 2, 4, 9, 11}
    for i, (y, z) in enumerate(bulbs):
        on = i in on_set
        cyl(f"Socket{i}", (X0 + 0.045, y, z), 0.02, 0.03, mframe, rot=(0, 90, 0), verts=12)
        sphere(f"Bulb{i}", (X0 + 0.08, y, z), 0.032, bulb_on if on else bulb_off, segs=16, rings=10)
        if on:
            light(f"BulbL{i}", "POINT", (X0 + 0.13, y, z), 4.5, warm, size=0.03)

    # --- things on the counter: foam wig head wearing a ring of red felt petals, makeup clutter
    foam = make_mat("Foam", hexc("#D6D1C6"), 0.85, var=0.05, grime=0.35, grime_scale=6.0, bump=0.15,
                    bump_scale=200, sheen=0.2)
    head_loc = (cx0 + 0.3, 2.3, ctop)
    hr = empty("WigHead", head_loc, (0, 0, 22))
    cyl("WigBase", (0, 0, 0.015), 0.07, 0.03, mframe, verts=20, parent=hr)
    cyl("WigNeck", (0, 0, 0.11), 0.045, 0.18, foam, verts=20, parent=hr)
    sphere("WigSkull", (0, 0, 0.29), 0.1, foam, scale=(0.85, 0.95, 1.18), parent=hr)
    petal = make_mat("PetalFelt", hexc("#B8231F"), 0.9, var=0.08, var_scale=30, sheen=0.4, bump=0.15,
                     bump_scale=300)
    petal_dk = make_mat("PetalBase", hexc("#1C1214"), 0.9, var=0.05)
    ring = empty("PetalRing", (0, -0.02, 0.29), (90 + 8, 0, 0), parent=hr)
    for k in range(9):
        a = 2 * math.pi * k / 9
        sphere(f"Petal{k}", (math.cos(a) * 0.15, math.sin(a) * 0.17, 0.0), 0.085, petal,
               scale=(1.0, 0.7, 0.14), rot=(0, 0, math.degrees(a)), parent=ring)
        sphere(f"PetalBlot{k}", (math.cos(a) * 0.09, math.sin(a) * 0.1, -0.012), 0.025, petal_dk,
               scale=(1.0, 0.7, 0.2), rot=(0, 0, math.degrees(a)), parent=ring)
    case_m = make_mat("MakeupCase", hexc("#3B2F2A"), 0.5, var=0.06, grime=0.3)
    box("MakeupCase", (cx0 + 0.25, 2.75, ctop + 0.06), (0.3, 0.22, 0.12), case_m, rot=(0, 0, 8), bevel=0.01)
    cup = make_mat("Mug", hexc("#C9C2AE"), 0.3, var=0.05, grime=0.35, coat=0.2)
    cyl("BrushCup", (cx0 + 0.36, 1.95, ctop + 0.06), 0.04, 0.12, cup, verts=20)
    for k, ang in enumerate((-8, 6, 14, -3)):
        cyl(f"Brush{k}", (cx0 + 0.36 + 0.01 * (k - 1.5), 1.95, ctop + 0.17), 0.006, 0.16, mframe,
            rot=(ang, -ang * 0.6, 0), verts=8)
    cyl("Mug", (cx0 + 0.4, 1.6, ctop + 0.05), 0.04, 0.1, cup, verts=20)
    box("Tissues", (cx0 + 0.2, 3.0, ctop + 0.05), (0.12, 0.22, 0.1), make_mat("TissueBox", hexc("#7A9AB0"),
        0.6, var=0.05, grime=0.2), rot=(0, 0, -6))
    paper = bpy.data.materials.get("Paper") or make_mat("Paper", hexc("#E9E4D2"), 0.8, var=0.06, grime=0.35)
    box("Script", (cx0 + 0.36, 2.2, ctop + 0.003), (0.2, 0.28, 0.004), paper, rot=(0, 0, 12))
    for k, (y, h, c) in enumerate(((2.62, 0.14, "#5A3A52"), (2.67, 0.1, "#2F4A3A"), (2.71, 0.17, "#8A6A3A"))):
        cyl(f"Bottle{k}", (cx0 + 0.42, y, ctop + h / 2), 0.022, h, make_mat(f"Bottle{k}", hexc(c), 0.2,
            var=0.05, coat=0.4), verts=14)

    # --- trash can near the counter
    can_m = make_mat("TrashCan", hexc("#8A8370"), 0.45, var=0.08, grime=0.5, floor_dirt=0.4)
    cyl("TrashCan", (cx1 + 0.2, 2.15, 0.2), 0.15, 0.4, can_m, verts=24, radius2=0.17)
    sphere("TrashPaper", (cx1 + 0.18, 2.17, 0.4), 0.05, paper, scale=(1, 0.8, 0.7))

    # --- clothes rack along the back wall (screen-left), wire hangers, spare yellow overalls
    rack_m = make_mat("RackChrome", hexc("#A8AAA5"), 0.25, metallic=0.9, var=0.06, grime=0.35)
    rx0, rx1, ry, rz = -0.95, 0.15, Y1 - 0.38, 1.62
    cyl("RackBar", ((rx0 + rx1) / 2, ry, rz), 0.013, rx1 - rx0 + 0.08, rack_m, rot=(0, 90, 0), verts=12)
    for x in (rx0, rx1):
        cyl(f"RackPost{x}", (x, ry, rz / 2), 0.014, rz, rack_m, verts=12)
        cyl(f"RackFoot{x}", (x, ry, 0.03), 0.012, 0.5, rack_m, rot=(90, 0, 0), verts=10)
    for k, x in enumerate((-0.68, -0.36, -0.29, -0.22)):
        wire_hanger(f"Hanger{k}", (x, ry, rz - 0.01), rack_m, yaw=90 + 9 * math.sin(k * 1.7))
    # spare overalls hanging limp from a hanger (cloth sheets with folds), turned partly side-on so they read
    # as a garment on a rack and not as a figure
    ov = make_mat("OverallsYellow", hexc("#E3B52A"), 0.9, var=0.08, var_scale=8, grime=0.4, sheen=0.3,
                  bump=0.25, bump_scale=60)
    ovx = rx0 + 0.42
    ovr = empty("Overalls", (ovx, ry, rz - 0.02), (0, 0, 62))
    wire_hanger("OvHanger", (0, 0, 0.0), rack_m, parent=ovr)

    def folds(n, amp, sag=0.0):
        def f(u, v):
            return amp * math.sin(u * math.pi * n + v * 1.3) * (0.4 + 0.6 * (1 - v)) + sag * (u - 0.5) ** 2
        return f
    for sx in (-1, 1):
        cloth_grid(f"OvStrap{sx}", 0.04, 0.2, 2, 6, ov, loc=(sx * 0.15, 0.0, -0.11), rot=(90, sx * 12, 0),
                   subsurf=0, parent=ovr)
        cyl(f"OvClip{sx}", (sx * 0.135, -0.012, -0.2), 0.012, 0.006, rack_m, rot=(90, 0, 0), verts=12, parent=ovr)
    cloth_grid("OvBib", 0.32, 0.26, 12, 10, ov, loc=(0, 0, -0.33), rot=(90, 0, 0), height_fn=folds(3, 0.012),
               subsurf=1, parent=ovr)
    # small felt flower patch low on the bib pocket (as on Poppy's own overalls)
    fl = empty("OvFlower", (0.07, -0.016, -0.41), (90, 0, 0), parent=ovr)
    for k in range(5):
        a_ = 2 * math.pi * k / 5
        sphere(f"OvPetal{k}", (0.016 * math.cos(a_), 0.016 * math.sin(a_), 0), 0.013, petal,
               scale=(1, 0.8, 0.3), parent=fl)
    cloth_grid("OvHip", 0.5, 0.24, 16, 8, ov, loc=(0, 0.005, -0.58), rot=(90, 0, 0), height_fn=folds(4, 0.02),
               subsurf=1, parent=ovr)
    for sx in (-1, 1):
        cloth_grid(f"OvLeg{sx}", 0.23, 0.56, 8, 16, ov, loc=(sx * 0.125, 0.008 * sx, -0.97),
                   rot=(90, sx * 3.0, 0), height_fn=folds(2.5, 0.025), subsurf=1, parent=ovr)
    # other garments on the rack: hung edge-on with a little twist, cloth sheets with folds
    for k, (x, c, ln, tw) in enumerate(((rx1 - 0.1, "#3E4A57", 0.75, 70), (rx1 - 0.2, "#6B5A48", 0.65, 80),
                                         (rx1 - 0.3, "#5A6150", 0.8, 74), (rx0 + 0.12, "#4F4A44", 0.95, 76),
                                         (rx0 + 0.2, "#7A6A5A", 0.7, 84))):
        g = empty(f"Garment{k}", (x, ry, rz - 0.01), (0, 0, tw))
        wire_hanger(f"GHanger{k}", (0, 0, 0.0), rack_m, parent=g)
        cloth_grid(f"Shirt{k}", 0.44, ln, 12, 16, make_mat(f"Shirt{k}", hexc(c), 0.85, var=0.08, grime=0.3,
                   bump=0.2, bump_scale=25, sheen=0.2), loc=(0, 0, -0.13 - ln / 2), rot=(90, 0, 0),
                   height_fn=folds(3 + k % 2, 0.02), subsurf=1, parent=g)

    # --- the empty chair, facing the camera
    wood = make_mat("ChairWood", hexc("#6E4A2E"), 0.45, var=0.08, grime=0.35, coat=0.15,
                    base=streak_wood(hexc("#73502F"), hexc("#5A3A22"), "z"))
    chair_loc = (0.62, 2.45, 0.0)
    wooden_chair("DRChair", chair_loc, 10.0, wood)

    # --- overhead cold fluorescent + practical bits
    col = tint(kelvin(5200), (0.75, 1.0, 0.8), 0.35)
    fluoro("DRTube", (0.15, 2.0, H - 0.04), length=1.22, axis="y", power=28, color=col, glow=4.5)
    box("Outlet", (X1 - 0.005, 1.4, 0.35), (0.01, 0.08, 0.12), make_mat("Outlet", hexc("#D8D2C0"), 0.4))
    # a few things on the back wall: hook with a cardigan, a blank poster, a clock with no hands
    poster = make_mat("PosterBlank", hexc("#C9B98F"), 0.7, var=0.1, grime=0.5, grime_scale=4.0)
    box("Poster", (0.75, Y1 - 0.005, 1.6), (0.45, 0.01, 0.6), poster, rot=(0, 2.0, 0))
    sun_m = make_mat("PosterSun", hexc("#C88F3A"), 0.7, var=0.1, grime=0.4)
    cyl("PosterSun", (0.75, Y1 - 0.012, 1.68), 0.12, 0.004, sun_m, rot=(90, 0, 0), verts=24)
    clock_m = make_mat("ClockFace", hexc("#E2DDCC"), 0.4, var=0.05, grime=0.3)
    cyl("ClockRim", (1.15, Y1 - 0.02, 2.1), 0.15, 0.04, mframe, rot=(90, 0, 0), verts=32)
    cyl("ClockFace", (1.15, Y1 - 0.042, 2.1), 0.13, 0.005, clock_m, rot=(90, 0, 0), verts=32)
    box("Hook", (-0.15, Y1 - 0.03, 1.75), (0.03, 0.06, 0.03), metal)

    cam = camera((0.22, 0.12, 1.5), rot=(80.0, 0.0, 6.0), lens=28.0)
    seat = (chair_loc[0], chair_loc[1], 0.46)
    got = aim_camera(cam, seat, (400.0, 330.0))
    print("dressing room seat at", got)
    render("dressing_room")
    meta = dict(seat_point=proj(seat), seat_px_per_m=px_per_m_at(seat),
                backrest_top=proj((chair_loc[0] - 0.0, chair_loc[1] + 0.18, 0.95)),
                chair_rect=proj_obj_bbox(bpy.data.objects["DRChair"]),
                door_rect=[*proj((X1, door_y0, 2.08)), *proj((X1, door_y1, 0.0))],
                note="seat_point = top centre of the empty chair's seat (costume_slumped sits here).")
    save_blend("dressing_room")
    write_meta("dressing_room", meta)


# ============================================================== home kit
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


def stuffed_bunny(name, loc, yaw, mat, inner, eye, lying=True):
    root = empty(name, loc, (0, 90 if lying else 0, yaw))
    sphere(name + "Body", (0, 0, 0.09), 0.09, mat, scale=(0.85, 0.75, 1.0), parent=root)
    sphere(name + "Head", (0, 0, 0.22), 0.07, mat, scale=(1.0, 0.95, 0.9), parent=root)
    for sx in (-1, 1):
        sphere(f"{name}Ear{sx}", (sx * 0.035, 0.0, 0.33), 0.03, mat, scale=(0.7, 0.4, 2.6),
               rot=(0, sx * -12, 0), parent=root)
        sphere(f"{name}EarIn{sx}", (sx * 0.035, -0.011, 0.33), 0.02, inner, scale=(0.6, 0.3, 2.3),
               rot=(0, sx * -12, 0), parent=root)
        sphere(f"{name}Eye{sx}", (sx * 0.028, -0.062, 0.235), 0.009, eye, parent=root)
        sphere(f"{name}Arm{sx}", (sx * 0.075, -0.02, 0.12), 0.03, mat, scale=(0.7, 0.7, 1.4), parent=root)
        sphere(f"{name}Foot{sx}", (sx * 0.045, -0.05, 0.02), 0.035, mat, scale=(0.8, 1.3, 0.6), parent=root)
    return root


def crt_tv(name, loc, yaw, screen_mat, body_mat, w=0.56, h=0.48, d=0.46, scr=(0.42, 0.315)):
    """A small 90s CRT: boxy body, bezel, flat emissive screen plane. Returns (root, screen_obj).
    Local -Y is the front; the screen plane is centred at (0, -0.03, h/2 + 0.03)."""
    root = empty(name, loc, (0, 0, yaw))
    box(name + "Body", (0, d / 2 - 0.02, h / 2), (w, d - 0.04, h), body_mat, bevel=0.025, parent=root)
    box(name + "Back", (0, d - 0.05, h / 2 - 0.02), (w * 0.7, 0.2, h * 0.7), body_mat, bevel=0.03, parent=root)
    box(name + "Bezel", (0, -0.01, h / 2 + 0.02), (w - 0.02, 0.03, h - 0.08), body_mat, bevel=0.02, parent=root)
    blk = bpy.data.materials.get("TVBlack") or make_mat("TVBlack", hexc("#0E0E0F"), 0.4, var=0.0)
    box(name + "ScreenSurround", (0, -0.026, h / 2 + 0.03), (scr[0] + 0.03, 0.004, scr[1] + 0.03), blk,
        parent=root)
    scr_obj = box(name + "Screen", (0, -0.03, h / 2 + 0.03), (scr[0], 0.002, scr[1]), screen_mat, parent=root)
    box(name + "Panel", (0, -0.028, 0.035), (w - 0.1, 0.006, 0.03), blk, parent=root)
    for k in range(3):
        cyl(f"{name}Btn{k}", (w / 2 - 0.08 - k * 0.05, -0.034, 0.035), 0.008, 0.01, body_mat, rot=(90, 0, 0),
            verts=10, parent=root)
    sphere(name + "Led", (-w / 2 + 0.06, -0.033, 0.035), 0.004, emit_mat(name + "LedM", (1.0, 0.05, 0.02, 1), 4.0),
           parent=root)
    metal = bpy.data.materials.get("Chrome") or make_mat("Chrome", hexc("#C8C8C4"), 0.15, metallic=1.0, var=0.0)
    for sx in (-1, 1):
        cyl(f"{name}Ear{sx}", (sx * 0.075, d / 2, h + 0.16), 0.003, 0.32, metal, rot=(0, sx * 24, 0), verts=6,
            parent=root)
    sphere(name + "EarBase", (0, d / 2, h + 0.015), 0.045, blk, scale=(1.4, 1, 0.5), parent=root)
    return root, scr_obj


def crumpled(name, w, d, mat, loc, yaw=0.0, lump=0.06, seed=0.0, n=18):
    """A crumpled piece of cloth lying on the floor (a sweater, a sock pile)."""
    def hf(u, v):
        r = math.hypot(u - 0.5, v - 0.5)
        return lump * max(0.0, 1.0 - 1.8 * r) * (0.7 + 0.3 * math.sin(u * 11 + seed) * math.cos(v * 9 + seed))
    return cloth_grid(name, w, d, n, n, mat, loc=loc, rot=(0, 0, yaw), height_fn=hf, displace=0.04,
                      disp_scale=0.12)


# ============================================================== BEDROOM AT NIGHT
def render_bedroom():
    reset(960, 720, samples=96, look="AgX - Medium High Contrast", exposure=0.45)
    X1, Y1, H = 3.4, 3.3, 2.45
    moon = (0.40, 0.55, 1.0)

    def paper(u_axis):
        def fn(b, vec):
            uv, p = _uv(b, u_axis)
            w = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
            b.set(w.inputs["Vector"], uv)
            w.inputs["Scale"].default_value = 6.0
            w.inputs["Distortion"].default_value = 0.0
            stripes = b.mix(b.rgb(hexc("#CFD0DE")), b.rgb(hexc("#B9BCD3")), b.maprange(w.outputs[1], 0.45, 0.55, 0, 1))
            # small sprigs between the stripes so the paper reads as 'a child's room' wallpaper
            dots = b.maprange(b.noise(b.mapping(uv, scale=(1, 1, 1)), 14.0, 0.0, 0.5), 0.70, 0.72, 0.0, 0.35)
            return b.mix(stripes, b.rgb(hexc("#9AA6C8")), dots)
        return fn

    wall_x = make_mat("PaperX", rough=0.85, var=0.07, grime=0.25, grime_scale=1.4, floor_dirt=0.25,
                      base=paper("x"), space="world")
    wall_y = make_mat("PaperY", rough=0.85, var=0.07, grime=0.25, grime_scale=1.4, floor_dirt=0.25,
                      base=paper("y"), space="world")
    floor = make_mat("BedFloor", rough=0.4, var=0.06, coat=0.1, space="world", grime=0.2,
                     base=planks_base(hexc("#9A6D45"), hexc("#7A5232"), hexc("#3A2618"), plank_w=0.11))
    ceil = make_mat("BedCeil", hexc("#D8D6DE"), 0.9, var=0.05, grime=0.2)
    trim = make_mat("BedTrim", hexc("#EEEAE0"), 0.4, var=0.04, grime=0.2)
    win_x0, win_x1, win_z0, win_z1 = 1.62, 2.42, 0.95, 2.05
    wall_with_holes("BWallBack", "x", Y1, -0.2, X1 + 0.2, 0.0, H, 0.15, [(win_x0, win_x1, win_z0, win_z1)], wall_x)
    box2("BWallL", (-0.15, -0.5, 0.0), (0.0, Y1, H), wall_y)
    box2("BWallR", (X1, -0.5, 0.0), (X1 + 0.15, Y1, H), wall_y)
    box2("BWallF", (-0.15, -0.65, 0.0), (X1 + 0.15, -0.5, H), wall_x)
    box2("BFloor", (-0.2, -0.6, -0.05), (X1 + 0.2, Y1 + 0.2, 0.0), floor)
    box2("BCeil", (-0.2, -0.6, H), (X1 + 0.2, Y1 + 0.2, H + 0.05), ceil)
    for nm, lo, hi in (("SkirtB", (0, Y1 - 0.015, 0), (X1, Y1, 0.1)), ("SkirtL", (0, -0.5, 0), (0.015, Y1, 0.1)),
                       ("SkirtR", (X1 - 0.015, -0.5, 0), (X1, Y1, 0.1))):
        box2(nm, lo, hi, trim)
    # ceiling light (off) and a smoke detector
    cyl("CeilDome", (1.7, 1.5, H - 0.04), 0.17, 0.08, make_mat("DomeGlass", hexc("#E8E4D8"), 0.3, var=0.03),
        verts=32, radius2=0.12)
    cyl("Smoke", (2.6, 0.9, H - 0.015), 0.06, 0.03, trim, verts=20)

    # --- window frame, sill, night sky outside, tree branches, curtains
    cas = 0.06
    box2("BWinL", (win_x0 - cas, Y1 - 0.03, win_z0 - cas), (win_x0, Y1, win_z1 + cas), trim)
    box2("BWinR", (win_x1, Y1 - 0.03, win_z0 - cas), (win_x1 + cas, Y1, win_z1 + cas), trim)
    box2("BWinT", (win_x0 - cas - 0.005, Y1 - 0.034, win_z1), (win_x1 + cas + 0.005, Y1, win_z1 + cas), trim)
    box2("BWinSill", (win_x0 - cas - 0.04, Y1 - 0.08, win_z0 - 0.04), (win_x1 + cas + 0.04, Y1 + 0.05, win_z0),
         trim)
    box2("BWinMull", ((win_x0 + win_x1) / 2 - 0.02, Y1 + 0.04, win_z0), ((win_x0 + win_x1) / 2 + 0.02, Y1 + 0.08,
         win_z1), trim)
    box2("BWinRail", (win_x0, Y1 + 0.04, (win_z0 + win_z1) / 2 - 0.02), (win_x1, Y1 + 0.084,
         (win_z0 + win_z1) / 2 + 0.02), trim)
    sky = make_mat("NightSky", rough=1.0, var=0.0, spec=0.0, emission=1.0,
                   base=lambda b, v: b.mix(b.rgb((0.003, 0.006, 0.025, 1)), b.rgb((0.025, 0.04, 0.10, 1)),
                                           b.maprange(b.sep(b.coords("world"))[2], 0.8, 2.6, 0.0, 1.0)))
    nt = sky.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    nt.links.new(bsdf.inputs["Base Color"].links[0].from_socket, bsdf.inputs["Emission Color"])
    box2("NightSkyPlane", (win_x0 - 2.5, Y1 + 3.0, -1.0), (win_x1 + 2.5, Y1 + 3.05, 4.5), sky)
    sky_obj = bpy.data.objects["NightSkyPlane"]
    sky_obj.visible_shadow = False
    # neighbour's roofline and a bare tree as black silhouettes outside
    tree = make_mat("TreeSil", hexc("#03040A"), 1.0, var=0.0, spec=0.0)
    prism("Roofline", [(-1.5, 0.0), (3.0, 0.0), (3.0, 1.15), (1.4, 1.55), (-1.5, 1.2)], 0.05, tree,
          loc=(0.6, Y1 + 2.6, 0.0), rot=(90, 0, 0))
    for k, (x0, z0, a, ln, r) in enumerate(((2.25, 1.0, 8, 2.4, 0.06), (2.1, 1.75, -38, 0.9, 0.025),
                                             (2.35, 1.55, 50, 0.8, 0.02), (2.25, 2.0, -15, 0.7, 0.015),
                                             (2.0, 2.05, 62, 0.6, 0.012))):
        b = cyl(f"Branch{k}", (x0, Y1 + 1.6, z0), r, ln, tree, rot=(0, a, 0), verts=8)
        b.visible_shadow = False
    curtain = make_mat("Curtain", hexc("#4E5F96"), 0.9, var=0.08, sheen=0.4, bump=0.1, bump_scale=60)
    for side, (cx, cw) in ((-1, (win_x0 - 0.02, 0.5)), (1, (win_x1 + 0.08, 0.38))):
        def pleats(u, v, side=side):
            return 0.03 * math.sin(u * math.pi * 7) + 0.02 * (1 - v) * math.sin(u * 3)
        cloth_grid(f"Curtain{side}", cw, 1.55, 40, 20, curtain, loc=(cx, Y1 - 0.12, 1.42), rot=(90, 0, 0),
                   height_fn=pleats, subsurf=0)
    cyl("CurtainRod", ((win_x0 + win_x1) / 2, Y1 - 0.12, 2.23), 0.012, 1.5, trim, rot=(0, 90, 0), verts=10)

    # --- dresser + CRT TV (left); the screen is a flat, uniformly emissive plane
    wood = make_mat("DresserWood", rough=0.45, var=0.06, coat=0.15, grime=0.2,
                    base=streak_wood(hexc("#8C6A4A"), hexc("#6E5036"), "x"))
    dx0, dx1, dy0, dy1, dtop = 0.18, 1.32, Y1 - 0.5, Y1 - 0.02, 0.72
    box2("Dresser", (dx0, dy0, 0.06), (dx1, dy1, dtop), wood, bevel=0.01)
    for k in range(3):
        z0 = 0.1 + k * 0.205
        box2(f"Drawer{k}", (dx0 + 0.03, dy0 - 0.012, z0), (dx1 - 0.03, dy0 + 0.01, z0 + 0.18), wood, bevel=0.006)
        for sx in (0.3, 0.7):
            sphere(f"DrawerKnob{k}{sx}", (dx0 + (dx1 - dx0) * sx, dy0 - 0.03, z0 + 0.09), 0.018, trim)
    # top drawer pulled out a little with a sock hanging over its lip
    for sx in (dx0 + 0.04, dx1 - 0.04):
        box2(f"DresserFoot{sx}", (sx - 0.03, dy0 + 0.02, 0.0), (sx + 0.03, dy1 - 0.02, 0.06), wood)
    tv_body = make_mat("TVPlastic", hexc("#2B2A28"), 0.45, var=0.05, grime=0.25)
    screen = emit_mat("TVScreen", (0.085, 0.105, 0.15, 1), 1.5)
    tv_root, tv_scr = crt_tv("TV", ((dx0 + dx1) / 2 + 0.1, dy0 + 0.1, dtop), -6.0, screen, tv_body,
                             w=0.6, h=0.5, d=0.48, scr=(0.46, 0.345))
    tv_light = light("TVGlow", "AREA", (0, 0, 0), 5.0, (0.45, 0.55, 0.78), size=0.42, size_y=0.315)
    tv_light.parent = tv_scr
    tv_light.location = (0, -0.03, 0)
    tv_light.rotation_euler = (math.radians(-90), 0, 0)
    # lamp (off) and a cup on the dresser
    lx, ly = dx0 + 0.13, dy0 + 0.25
    cyl("DresserLampBase", (lx, ly, dtop + 0.02), 0.07, 0.04, trim, verts=20)
    cyl("DresserLampStem", (lx, ly, dtop + 0.15), 0.012, 0.24, trim, verts=10)
    cyl("DresserLampShade", (lx, ly, dtop + 0.3), 0.11, 0.14, make_mat("Shade", hexc("#E8D9A8"), 0.8, var=0.05),
        radius2=0.07, verts=24)
    cyl("DresserCup", (dx1 - 0.1, dy0 + 0.12, dtop + 0.05), 0.035, 0.1,
        make_mat("CupPlastic", hexc("#D25A4A"), 0.35, var=0.05, coat=0.2), verts=20)
    # posters: abstract shapes only
    pmat = make_mat("PosterPaper", hexc("#E3DCC8"), 0.7, var=0.07, grime=0.3)
    box("PosterA", (0.75, Y1 - 0.006, 1.62), (0.5, 0.008, 0.66), pmat, rot=(0, 2.5, 0))
    for k, (dx, dz, r, c) in enumerate(((-0.1, 0.12, 0.11, "#D2483C"), (0.1, -0.05, 0.08, "#3F7FC4"),
                                         (-0.05, -0.18, 0.06, "#E9C23B"))):
        cyl(f"PosterDot{k}", (0.75 + dx, Y1 - 0.012, 1.62 + dz), r, 0.004, make_mat(f"PD{k}", hexc(c), 0.7),
            rot=(90, 0, 0), verts=24)
    box("PosterB", (X1 - 0.006, 2.25, 1.6), (0.008, 0.55, 0.45), pmat)
    prism("PosterTri", [(-0.15, -0.12), (0.15, -0.12), (0.0, 0.15)], 0.004, make_mat("PTri", hexc("#4FA36A"), 0.7),
          loc=(X1 - 0.012, 2.25, 1.6), rot=(90, 0, -90))
    # a shelf on the right wall above the bed with a few plain toys (shapes, no characters)
    box2("WallShelf", (X1 - 0.2, 1.25, 1.48), (X1, 2.0, 1.5), wood)
    for k, (y, h, c) in enumerate(((1.35, 0.16, "#C8453A"), (1.5, 0.12, "#3A78C2"), (1.62, 0.2, "#E3B93A"))):
        box(f"ShelfBook{k}", (X1 - 0.1, y, 1.5 + h / 2), (0.15, 0.04, h), make_mat(f"Book{k}", hexc(c), 0.6,
            var=0.08, grime=0.2), rot=(0, 0, 0 if k < 2 else 0))
    sphere("ShelfBall", (X1 - 0.1, 1.85, 1.57), 0.07, make_mat("ShelfBallM", hexc("#E58A2E"), 0.4, coat=0.3))

    # --- the bed (right), covers thrown back, pillow dented, pitch-dark gap underneath
    frame_m = make_mat("BedFrame", hexc("#E6E1D4"), 0.45, var=0.05, grime=0.2)
    sheet = make_mat("Sheet", hexc("#E4E6EE"), 0.85, var=0.06, sheen=0.3, bump=0.08, bump_scale=30, grime=0.12)
    duvet = make_mat("Duvet", rough=0.9, var=0.06, sheen=0.4, bump=0.12, bump_scale=25,
                     base=lambda b, v: b.mix(b.rgb(hexc("#7F98C6")), b.rgb(hexc("#D9C27A")),
                                             b.maprange(b.node("ShaderNodeTexChecker").outputs[1], 0.4, 0.6, 0, 1)))
    ck = [n for n in duvet.node_tree.nodes if n.bl_idname == "ShaderNodeTexChecker"][0]
    ck.inputs["Scale"].default_value = 6.0
    bx0, bx1, by0, by1 = X1 - 1.02, X1 - 0.02, Y1 - 2.05, Y1 - 0.04
    zb0, zb1 = 0.24, 0.40
    box2("BedBase", (bx0, by0, zb0), (bx1, by1, zb1), frame_m, bevel=0.015)
    for (x, y) in ((bx0 + 0.04, by0 + 0.04), (bx1 - 0.04, by0 + 0.04), (bx0 + 0.04, by1 - 0.04),
                   (bx1 - 0.04, by1 - 0.04)):
        box2(f"BedLeg{x}{y}", (x - 0.03, y - 0.03, 0.0), (x + 0.03, y + 0.03, zb0 + 0.02), frame_m)
    box2("Headboard", (bx0, by1 - 0.04, zb0), (bx1, by1, 1.0), frame_m, bevel=0.02)
    box2("Footboard", (bx0, by0, zb0), (bx1, by0 + 0.04, 0.62), frame_m, bevel=0.02)
    box2("Mattress", (bx0 + 0.03, by0 + 0.05, zb1), (bx1 - 0.03, by1 - 0.05, zb1 + 0.17), sheet, bevel=0.04)
    zt = zb1 + 0.17
    # the space under the bed is black (a dark box hugging the floor under the frame)
    box2("UnderBed", (bx0 + 0.05, by0 + 0.08, 0.001), (bx1 - 0.02, by1 - 0.08, zb0 - 0.01), void_mat())
    pillow = make_mat("Pillow", hexc("#EDEFF5"), 0.85, var=0.05, sheen=0.3, grime=0.1)
    pl = empty("Pillow", ((bx0 + bx1) / 2, by1 - 0.3, zt + 0.04), (0, 0, 5))
    sphere("PillowL", (-0.18, 0, 0.0), 0.2, pillow, scale=(1.0, 0.85, 0.42), parent=pl)
    sphere("PillowR", (0.18, 0, 0.0), 0.2, pillow, scale=(1.0, 0.85, 0.42), parent=pl)
    sphere("PillowMid", (0.0, 0.06, -0.012), 0.18, pillow, scale=(1.0, 0.7, 0.3), parent=pl)

    def throw(u, v):
        # u across the bed (x), v along the bed (y, 0 = foot). Thrown back toward the foot: a thick rolled
        # edge where it was flung, spilling off the side nearest the room.
        roll = 0.17 * math.exp(-((v - 0.86) / 0.1) ** 2) * (0.8 + 0.2 * math.sin(u * 7))
        hump = roll + 0.04 * math.sin(u * 9 + v * 4) * (1 - v)
        drop = 0.0
        if u < 0.14:
            drop = -min(0.5, (0.14 - u) * 4.2) * (0.75 + 0.25 * (1 - v))
        return (0.0, 0.0, hump + drop)
    cloth_grid("Duvet", 1.15, 0.98, 46, 36, duvet, loc=((bx0 + bx1) / 2 - 0.06, by0 + 0.54, zt + 0.03),
               height_fn=throw, displace=0.05, disp_scale=0.25)

    def slept_in(u, v):
        # rumpled sheet with a shallow body-shaped hollow where someone was lying a moment ago
        hollow = -0.03 * math.exp(-(((u - 0.45) / 0.22) ** 2 + ((v - 0.45) / 0.42) ** 2))
        edge = min(1.0, min(u, 1 - u) / 0.06, min(v, 1 - v) / 0.06)
        return 0.034 * edge + 0.008 * math.sin(u * 23 + v * 7) * math.cos(v * 17 - u * 5) + hollow
    cloth_grid("SheetRumple", bx1 - bx0 - 0.08, 0.98, 30, 30, sheet,
               loc=((bx0 + bx1) / 2, by0 + 1.05 + 0.49 - 0.02, zt + 0.004), height_fn=slept_in, subsurf=1)
    box2("SheetFold", (bx0 + 0.05, by0 + 0.98, zt), (bx1 - 0.05, by0 + 1.08, zt + 0.035), sheet, bevel=0.02)

    # --- rug and toys on the floor in front of the bed
    rugm = make_mat("BedRug", hexc("#7C5A7E"), 0.95, var=0.1, var_scale=8, sheen=0.4, bump=0.2, bump_scale=200,
                    grime=0.2)
    rug = cyl("BedRug", (1.75, 1.95, 0.006), 0.85, 0.012, rugm, verts=64)
    rug.scale = (1.25, 0.85, 1.0)
    blk = [make_mat(f"BBlock{c}", hexc(c), 0.45, var=0.06, coat=0.2, grime=0.15)
           for c in ("#C8453A", "#3A78C2", "#E3B93A", "#4E9E55")]
    for k, (x, y, r, z) in enumerate(((1.55, 2.0, 15, 0.0), (1.68, 2.07, -20, 0.0), (1.6, 2.04, 40, 0.09),
                                      (1.9, 1.75, 5, 0.0), (1.38, 2.25, 30, 0.0), (2.05, 2.3, 62, 0.0))):
        box(f"Toy{k}", (x, y, 0.057 + z), (0.09, 0.09, 0.09), blk[k % 4], rot=(0, 0, r), bevel=0.008)
    bunny = make_mat("BunnyFelt", hexc("#BDAFA8"), 0.95, var=0.07, var_scale=20, sheen=0.5, bump=0.15,
                     bump_scale=200, grime=0.25)
    inner = make_mat("BunnyInner", hexc("#D9A3A8"), 0.95, var=0.04, sheen=0.4)
    eye = make_mat("BunnyEye", hexc("#0A0A0A"), 0.1, coat=0.6)
    stuffed_bunny("Bunny", (2.15, 1.6, 0.075), 120, bunny, inner, eye, lying=True)
    # a sweater on the floor by the dresser, slippers by the bed, a picture book
    crumpled("Sweater", 0.55, 0.45, make_mat("SweaterM", hexc("#B4483E"), 0.95, var=0.1, sheen=0.3, bump=0.3,
             bump_scale=90), (1.05, 2.3, 0.01), yaw=25, lump=0.07)
    slip = make_mat("Slipper", hexc("#6D86B8"), 0.9, var=0.06, sheen=0.4)
    for k, (x, y, r) in enumerate(((bx0 - 0.18, 1.55, 80), (bx0 - 0.12, 1.72, 100))):
        sphere(f"Slipper{k}", (x, y, 0.035), 0.12, slip, scale=(0.45, 1.0, 0.3), rot=(0, 0, r - 90))
    box("PictureBook", (1.3, 1.6, 0.012), (0.24, 0.3, 0.018), make_mat("BookCover", hexc("#E0B040"), 0.5,
        var=0.06), rot=(0, 0, -22))
    box("PictureBookP", (1.3, 1.6, 0.023), (0.22, 0.28, 0.004), make_mat("BookPages", hexc("#EDE6D2"), 0.8),
        rot=(0, 0, -22))

    # --- star nightlight by the bed (warm, tiny)
    star_m = emit_mat("StarLight", (*kelvin(2400), 1), 6.0)
    nlx = bx0 - 0.3
    prism("NightStar", star_points(0.055, 0.024), 0.015, star_m, loc=(nlx, Y1 - 0.02, 0.32), rot=(90, 0, 0))
    box("Outlet", (nlx, Y1 - 0.004, 0.32), (0.07, 0.008, 0.11), trim)
    light("StarL", "POINT", (nlx, Y1 - 0.1, 0.32), 1.0, kelvin(2400), size=0.03)

    # --- moonlight through the window (blue), very low ambient
    sun = light("Moon", "SUN", (2.0, Y1 + 3.0, 4.0), 2.2, moon, size=0.8)
    look_at(sun, (2.0 + 0.9, Y1 - 1.3, 3.4 - 3.3))
    sun.location = (2.0, Y1 + 3.0, 4.0)
    light("MoonSpill", "AREA", ((win_x0 + win_x1) / 2, Y1 - 0.05, (win_z0 + win_z1) / 2), 1.0, moon,
          target=(1.7, 1.2, 0.3), size=0.8, size_y=1.1)
    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.006, 0.009, 0.02, 1)

    cam = camera((0.3, 0.2, 1.4), rot=(78.5, 0.0, -31.0), lens=28.0)
    render("bedroom_night")
    bpy.context.view_layer.update()
    mw = tv_scr.matrix_world
    hw, hh = 0.23, 0.1725
    quad = [proj(mw @ Vector((x, -0.0011, z))) for x, z in ((-hw, hh), (hw, hh), (hw, -hh), (-hw, -hh))]
    bed_c = ((bx0 + bx1) / 2, (by0 + by1) / 2, zt)
    meta = dict(tv_screen_quad_tl_tr_br_bl=quad, tv_screen_width_px=round(quad[1][0] - quad[0][0], 1),
                bed_center=proj(bed_c), pillow_center=proj(((bx0 + bx1) / 2, by1 - 0.3, zt + 0.05)),
                bed_rect=proj_obj_bbox(bpy.data.objects["Mattress"]),
                note="tv_screen_quad is clockwise from top-left; the screen is a flat emissive plane.")
    save_blend("bedroom_night")
    write_meta("bedroom_night", meta)


def home_door(name, origin, wall_axis, facing, slab, trim, knob, width=0.8, height=2.03, wall_t=0.12,
              ajar=0.0, hinge_side=-1, void=None, casing=0.07, panels=True):
    """Painted interior panel door in a house wall (same local frame as inst_door: door plane = local XZ,
    the room the camera is in toward local -Y, the wall thickness toward local +Y).
    ajar > 0 swings the slab away from the camera side (into the room behind)."""
    ox, oy = origin
    yaw = {("y", 1): 90.0, ("y", -1): -90.0, ("x", 1): 180.0, ("x", -1): 0.0}[(wall_axis, facing)]
    root = empty(name, (ox, oy, 0.0), (0, 0, yaw))
    # casing (proud of the wall on the camera side) and jamb lining the opening
    box(name + "CasL", (-width / 2 - casing / 2, -0.01, (height + casing) / 2), (casing, 0.02, height + casing), trim,
        bevel=0.006, parent=root)
    box(name + "CasR", (width / 2 + casing / 2, -0.01, (height + casing) / 2), (casing, 0.02, height + casing), trim,
        bevel=0.006, parent=root)
    box(name + "CasT", (0, -0.011, height + casing / 2), (width + 2 * casing + 0.01, 0.022, casing), trim,
        bevel=0.006, parent=root)
    for sx in (-1, 1):
        box(f"{name}Jamb{sx}", (sx * (width / 2 + 0.01), wall_t / 2, height / 2), (0.02, wall_t, height), trim,
            parent=root)
    box(name + "JambT", (0, wall_t / 2, height + 0.01), (width + 0.04, wall_t, 0.02), trim, parent=root)
    m = 1.0 if hinge_side < 0 else -1.0
    t = 0.036
    hinge = empty(name + "Hinge", (-m * width / 2, 0.025, 0.0), (0, 0, m * ajar), parent=root)
    sw = width - 0.006
    box(name + "Slab", (m * sw / 2, t / 2, height / 2 + 0.004), (sw, t, height - 0.01), slab, bevel=0.003,
        parent=hinge)
    if panels:
        # four raised panels (two tall, two short) on the camera-side face
        cxs = (m * sw * 0.29, m * sw * 0.71)
        for k, cx in enumerate(cxs):
            for zc, ph in ((height * 0.70, height * 0.40), (height * 0.27, height * 0.33)):
                box(f"{name}Panel{k}{zc:.2f}", (cx, -0.004, zc), (sw * 0.30, 0.012, ph), slab, bevel=0.012, segs=2,
                    parent=hinge)
    kx = m * (sw - 0.065)
    cyl(name + "Rose", (kx, -0.006, 0.95), 0.028, 0.012, knob, rot=(90, 0, 0), verts=20, parent=hinge)
    sphere(name + "Knob", (kx, -0.045, 0.95), 0.03, knob, scale=(1, 0.8, 1), parent=hinge)
    cyl(name + "KnobStem", (kx, -0.022, 0.95), 0.009, 0.03, knob, rot=(90, 0, 0), verts=10, parent=hinge)
    return root, hinge


def void_room(name, lo, hi, mat, open_side="-y", t=0.02):
    """Five thin boxes of `mat` enclosing lo..hi with one side left open (where the doorway is)."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    faces = {"-x": ((x0 - t, y0, z0), (x0, y1, z1)), "+x": ((x1, y0, z0), (x1 + t, y1, z1)),
             "-y": ((x0, y0 - t, z0), (x1, y0, z1)), "+y": ((x0, y1, z0), (x1, y1 + t, z1)),
             "-z": ((x0, y0, z0 - t), (x1, y1, z0)), "+z": ((x0, y0, z1), (x1, y1, z1 + t))}
    out = []
    for k, (a, b) in faces.items():
        if k != open_side:
            out.append(box2(f"{name}{k}", a, b, mat))
    return out


def paint_wall_mat(name, color, u_axis, grime=0.35, dirt=0.35):
    """Flat interior wall paint with a slight orange-peel bump, smudges and darker skirting dirt."""
    return make_mat(name, hexc(color), 0.8, var=0.06, var_scale=1.5, grime=grime, grime_scale=1.6,
                    floor_dirt=dirt, space="world", bump=0.06, bump_scale=160, streak=0.15)


def picture_frame(name, loc, yaw, w, h, frame_m, art_fn=None, mat_m=None, glass=True):
    """A framed picture on a wall. loc = centre on the wall surface; local -Y faces the room."""
    root = empty(name, loc, (0, 0, yaw))
    fw = 0.03
    for nm, c, s in (("T", (0, -0.012, h / 2 - fw / 2), (w, 0.024, fw)), ("B", (0, -0.012, -h / 2 + fw / 2), (w, 0.024, fw)),
                     ("L", (-w / 2 + fw / 2, -0.012, 0), (fw, 0.024, h)), ("R", (w / 2 - fw / 2, -0.012, 0), (fw, 0.024, h))):
        box(name + nm, c, s, frame_m, bevel=0.004, parent=root)
    mat_m = mat_m or bpy.data.materials.get("FrameMat") or make_mat("FrameMat", hexc("#E9E2CF"), 0.8, var=0.05,
                                                                    grime=0.2)
    box(name + "Mat", (0, -0.006, 0), (w - 2 * fw, 0.006, h - 2 * fw), mat_m, parent=root)
    if art_fn:
        art_fn(root, w - 2 * fw - 0.06, h - 2 * fw - 0.06)
    if glass:
        g = bpy.data.materials.get("FrameGlass") or make_mat("FrameGlass", hexc("#101214"), 0.04, var=0.0, spec=0.9)
        gm = g
        gl = box(name + "Glass", (0, -0.0205, 0), (w - 2 * fw, 0.001, h - 2 * fw), gm, parent=root)
        # glass: transparent-ish via a mix with transparency is costly; use a very dark glossy film with low alpha
        gl.visible_diffuse = False
        gl.hide_render = True
    return root


def abstract_art(shapes):
    """shapes: list of (kind, dx, dz, size, hex). Returns an art_fn for picture_frame."""
    def fn(root, w, h):
        for k, (kind, dx, dz, sz, c) in enumerate(shapes):
            m = bpy.data.materials.get("Art" + c) or make_mat("Art" + c, hexc(c), 0.75, var=0.08, grime=0.15)
            if kind == "disc":
                cyl(f"{root.name}Art{k}", (dx * w, -0.011, dz * h), sz * w, 0.003, m, rot=(90, 0, 0), verts=28,
                    parent=root)
            elif kind == "tri":
                prism(f"{root.name}Art{k}", [(-sz * w, -sz * w * 0.8), (sz * w, -sz * w * 0.8), (0, sz * w)], 0.003, m,
                      loc=(dx * w, -0.011, dz * h), rot=(90, 0, 0), parent=root)
            else:
                box(f"{root.name}Art{k}", (dx * w, -0.011, dz * h), (sz * w, 0.003, sz * w * 0.7), m, parent=root)
    return fn


def plug_nightlight(name, loc, yaw, shell_m, glow_m, star=False):
    """A small plug-in nightlight on an outlet plate. loc on the wall surface, local -Y into the room."""
    root = empty(name, loc, (0, 0, yaw))
    box(name + "Plate", (0, -0.004, 0), (0.07, 0.008, 0.115), shell_m, bevel=0.003, parent=root)
    if star:
        prism(name + "Star", star_points(0.05, 0.022), 0.018, glow_m, loc=(0, -0.012, 0.0), rot=(90, 0, 0),
              parent=root)
    else:
        box(name + "Body", (0, -0.025, -0.01), (0.06, 0.035, 0.07), shell_m, bevel=0.01, parent=root)
        sphere(name + "Dome", (0, -0.03, 0.035), 0.032, glow_m, scale=(1, 0.7, 0.7), parent=root)
    return root


def toy_car(name, loc, yaw, body_m, cabin_m, wheel_m):
    root = empty(name, loc, (0, 0, yaw))
    box(name + "Body", (0, 0, 0.04), (0.17, 0.08, 0.04), body_m, bevel=0.012, parent=root)
    box(name + "Cabin", (-0.015, 0, 0.075), (0.08, 0.07, 0.04), cabin_m, bevel=0.012, parent=root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"{name}W{sx}{sy}", (sx * 0.055, sy * 0.042, 0.02), 0.02, 0.014, wheel_m, rot=(90, 0, 0), verts=14,
                parent=root)
    return root


def sneaker(name, loc, yaw, upper_m, sole_m, lace_m, tilt=0.0):
    root = empty(name, loc, (tilt, 0, yaw))
    box(name + "Sole", (0, 0, 0.012), (0.26, 0.095, 0.024), sole_m, bevel=0.01, parent=root)
    sphere(name + "Toe", (0.075, 0, 0.035), 0.06, upper_m, scale=(1.3, 0.75, 0.55), parent=root)
    sphere(name + "Heel", (-0.07, 0, 0.055), 0.06, upper_m, scale=(1.15, 0.78, 0.95), parent=root)
    box(name + "Tongue", (0.0, 0, 0.075), (0.09, 0.06, 0.03), upper_m, bevel=0.012, rot=(0, -14, 0), parent=root)
    cyl(name + "Collar", (-0.075, 0, 0.1), 0.035, 0.012, sole_m, verts=16, parent=root)
    for k in range(3):
        box(f"{name}Lace{k}", (0.01 + 0.025 * k, 0, 0.088 - 0.006 * k), (0.008, 0.065, 0.006), lace_m,
            rot=(0, -14, 0), parent=root)
    return root


# ============================================================== HALLWAY AT NIGHT
def render_hallway():
    reset(640, 480, samples=96, look="AgX - Medium High Contrast", exposure=1.15)
    W, L, H, T = 0.6, 6.0, 2.45, 0.12
    wall_y = paint_wall_mat("HallWallY", "#E2D6BC", "y", grime=0.4)
    wall_x = paint_wall_mat("HallWallX", "#E2D6BC", "x", grime=0.4)
    trim = make_mat("HallTrim", hexc("#F1ECE0"), 0.4, var=0.04, grime=0.3, floor_dirt=0.3)
    floor = make_mat("HallFloor", rough=0.35, var=0.06, coat=0.15, space="world", grime=0.25,
                     base=planks_base(hexc("#7B5636"), hexc("#5E3F26"), hexc("#2A1A10"), plank_w=0.09,
                                      axes=("y", "x")))
    ceil = make_mat("HallCeil", hexc("#E4E0D6"), 0.9, var=0.05, grime=0.3, grime_scale=1.0)
    void = void_mat()
    slab = make_mat("HallDoor", hexc("#EDE7DA"), 0.4, var=0.05, grime=0.35, grime_scale=2.5, coat=0.1)
    brass = make_mat("HallBrass", hexc("#B8913A"), 0.3, metallic=0.8, var=0.06, grime=0.3)

    left_doors = [(2.35, 24.0), (4.25, 0.0)]      # (y centre, ajar degrees)
    right_doors = [(3.75, 0.0)]
    stair = (5.05, 5.85)                           # opening on the left near the end (landing, unseen window)
    dw, dh = 0.8, 2.03
    holes_l = [(y - dw / 2, y + dw / 2, -0.1, dh) for y, _ in left_doors] + [(stair[0], stair[1], -0.1, 2.12)]
    holes_r = [(y - dw / 2, y + dw / 2, -0.1, dh) for y, _ in right_doors]
    wall_with_holes("HWallL", "y", -W - T, -1.0, L, 0.0, H, T, holes_l, wall_y)
    wall_with_holes("HWallR", "y", W, -1.0, L, 0.0, H, T, holes_r, wall_y)
    wall_with_holes("HWallE", "x", L, -W - T, W + T, 0.0, H, T, [(-dw / 2, dw / 2, -0.1, dh)], wall_x)
    box2("HFloor", (-W - 1.5, -1.0, -0.05), (W + 0.3, L + 0.3, 0.0), floor)
    box2("HCeil", (-W - 1.5, -1.0, H), (W + 0.3, L + 0.3, H + 0.05), ceil)
    # skirting boards
    for sx in (-1, 1):
        x0 = sx * W
        holes = holes_l if sx < 0 else holes_r
        cuts = sorted({-1.0, L, *[h[0] for h in holes], *[h[1] for h in holes]})
        for a, b in zip(cuts[:-1], cuts[1:]):
            mid = (a + b) / 2
            if any(h[0] <= mid <= h[1] for h in holes):
                continue
            box2(f"Skirt{sx}{a:.2f}", (min(x0, x0 - sx * 0.014), a, 0.0), (max(x0, x0 - sx * 0.014), b, 0.1), trim)
    box2("SkirtE1", (-W, L - 0.014, 0), (-dw / 2 - 0.07, L, 0.1), trim)
    box2("SkirtE2", (dw / 2 + 0.07, L - 0.014, 0), (W, L, 0.1), trim)

    # doors
    for i, (y, aj) in enumerate(left_doors):
        home_door(f"HDoorL{i}", (-W, y), "y", 1, slab, trim, brass, width=dw, height=dh, wall_t=T,
                  ajar=aj, hinge_side=-1)
        if aj:
            # the dark bedroom behind the ajar door: pitch black
            void_room(f"HVoidRoom{i}", (-W - T - 2.4, y - 1.0, 0.001), (-W - T, y + 1.0, H - 0.001), void,
                      open_side="+x")
    for i, (y, aj) in enumerate(right_doors):
        home_door(f"HDoorR{i}", (W, y), "y", -1, slab, trim, brass, width=dw, height=dh, wall_t=T, hinge_side=-1)
    home_door("HDoorEnd", (0.0, L), "x", -1, slab, trim, brass, width=dw, height=dh, wall_t=T)

    # the landing beyond the left opening: a dark space with a banister and the top of the stairs
    land = make_mat("Landing", hexc("#3A3530"), 0.8, var=0.08, grime=0.3)
    box2("LandWallFar", (-W - 2.2, stair[1] + 0.3, 0.0), (-W - T, stair[1] + 0.42, H), wall_x)
    box2("LandWallSide", (-W - 2.3, stair[0] - 0.6, 0.0), (-W - 2.2, stair[1] + 0.4, H), wall_y)
    box2("LandWallNear", (-W - 2.2, stair[0] - 0.62, 0.0), (-W - T, stair[0] - 0.5, H), wall_x)
    for k in range(5):
        cyl(f"Baluster{k}", (-W - 0.45, stair[0] + 0.12 + k * 0.17, 0.45), 0.014, 0.9, trim, verts=10)
    box2("Handrail", (-W - 0.49, stair[0] + 0.05, 0.9), (-W - 0.41, stair[1] - 0.05, 0.95), land, bevel=0.01)
    cyl("NewelPost", (-W - 0.45, stair[0] + 0.03, 0.55), 0.04, 1.1, trim, verts=4)
    # a cold window light from the landing (the window itself is out of view)
    moon = (0.2, 0.36, 1.0)
    light("LandingMoon", "AREA", (-W - 1.6, (stair[0] + stair[1]) / 2 + 0.1, 1.9), 9.0, moon,
          target=(W, stair[0] + 0.1, 0.3), size=0.6, size_y=0.9)
    light("LandingMoonSoft", "AREA", (-W - 1.9, (stair[0] + stair[1]) / 2, 1.2), 2.0, moon,
          target=(0.0, 4.5, 0.6), size=1.2, size_y=1.2)

    # carpet runner with a border
    def runner_base(b, vec):
        p = b.sep(b.coords("world"))
        ax = b.math("ABSOLUTE", p[0])
        stops = [(0.0, hexc("#7A2630")), (0.27, hexc("#7A2630")), (0.30, hexc("#D8C7A0")), (0.32, hexc("#2E3A5A")),
                 (0.355, hexc("#D8C7A0")), (0.365, hexc("#5E1A22"))]
        base = b.ramp(b.math("DIVIDE", ax, 1.0), stops, "CONSTANT")
        motif = b.maprange(b.noise(b.mapping(b.coords("world"), scale=(6.0, 3.0, 1.0)), 1.0, 1.0, 0.5), 0.55, 0.6,
                           0.0, 0.25)
        inner = b.maprange(ax, 0.26, 0.27, 1.0, 0.0)
        return b.mix(base, b.rgb(hexc("#B89A60")), b.math("MULTIPLY", motif, inner))
    runner = make_mat("Runner", rough=0.95, var=0.08, var_scale=3.0, sheen=0.4, spec=0.15, grime=0.3,
                      grime_scale=1.2, bump=0.25, bump_scale=300, base=runner_base)
    box2("RunnerCarpet", (-0.37, 0.1, 0.0), (0.37, L - 0.25, 0.012), runner, bevel=0.004)

    # pictures: abstract shapes only
    fr_dark = make_mat("FrameWood", hexc("#3C2A1E"), 0.45, var=0.08, grime=0.2)
    fr_gold = make_mat("FrameGold", hexc("#9C7B3C"), 0.35, metallic=0.5, var=0.08, grime=0.3)
    picture_frame("PicL1", (-W, 3.3, 1.5), -90, 0.42, 0.52, fr_dark,
                  abstract_art([("disc", -0.1, 0.1, 0.22, "#C25B48"), ("rect", 0.12, -0.18, 0.4, "#5C7FA6")]))
    picture_frame("PicR1", (W, 1.45, 1.52), 90, 0.5, 0.4, fr_gold,
                  abstract_art([("tri", 0.0, -0.05, 0.25, "#5E8F5A"), ("disc", 0.25, 0.25, 0.1, "#D8B04A")]))
    picture_frame("PicR2", (W, 2.7, 1.55), 90, 0.32, 0.42, fr_dark,
                  abstract_art([("rect", 0.0, 0.0, 0.6, "#8B6A9A")]))
    picture_frame("PicR3", (W, 4.75, 1.45), 90, 0.25, 0.3, fr_gold, None)

    # ceiling lights (off), smoke detector, a thermostat
    dome = make_mat("DomeOff", hexc("#E6E1D2"), 0.3, var=0.04, grime=0.2)
    for y in (1.6, 4.4):
        cyl(f"Dome{y}", (0, y, H - 0.04), 0.16, 0.08, dome, verts=32, radius2=0.11)
    cyl("Smoke", (0.0, 3.0, H - 0.015), 0.06, 0.03, trim, verts=20)
    box("Thermostat", (W - 0.01, 2.0, 1.45), (0.02, 0.09, 0.12), trim, bevel=0.005)

    # nightlight low on the right wall: warm pool on the runner
    warm = kelvin(2300)
    nly = 2.3
    plug_nightlight("HallNL", (W, nly, 0.3), 90, trim, emit_mat("NLGlow", (*warm, 1.0), 10.0))
    light("NLPoint", "POINT", (W - 0.07, nly, 0.33), 0.45, warm, size=0.02)
    light("NLPool", "SPOT", (W - 0.06, nly, 0.34), 1.8, warm, target=(0.0, nly + 0.2, 0.0), size=0.02, spot=110.0,
          blend=1.0)
    # the faintest cold fill from behind the camera (a bedroom door behind us) so the near table reads
    light("BehindFill", "AREA", (0.35, -0.9, 1.6), 2.2, (0.45, 0.55, 0.85), target=(-0.45, 1.4, 0.7), size=0.6,
          size_y=1.2)

    # near-left side table with a lamp (off) and a plastic toy near the edge
    tw = make_mat("TableWood", rough=0.4, var=0.06, coat=0.2, grime=0.2,
                  base=streak_wood(hexc("#6B4A30"), hexc("#4E3420"), "y"))
    tx0, tx1, ty0, ty1, tz = -W + 0.01, -W + 0.32, 1.05, 1.5, 0.7
    box2("STableTop", (tx0, ty0, tz - 0.03), (tx1, ty1, tz), tw, bevel=0.006)
    box2("STableApron", (tx0 + 0.02, ty0 + 0.02, tz - 0.12), (tx1 - 0.02, ty1 - 0.02, tz - 0.03), tw)
    for (x, y) in ((tx0 + 0.035, ty0 + 0.035), (tx1 - 0.035, ty0 + 0.035), (tx0 + 0.035, ty1 - 0.035),
                   (tx1 - 0.035, ty1 - 0.035)):
        cyl(f"STableLeg{x}{y}", (x, y, (tz - 0.03) / 2), 0.016, tz - 0.03, tw, verts=10)
    lamp_m = make_mat("LampCeramic", hexc("#9DB3A8"), 0.3, var=0.05, coat=0.3)
    shade_m = make_mat("LampShadeOff", hexc("#D9CCA8"), 0.85, var=0.06, grime=0.25)
    lx, ly = tx0 + 0.16, ty0 + 0.33
    sphere("LampBody", (lx, ly, tz + 0.08), 0.065, lamp_m, scale=(1, 1, 1.25))
    cyl("LampNeck", (lx, ly, tz + 0.18), 0.01, 0.08, brass, verts=10)
    cyl("LampShade", (lx, ly, tz + 0.27), 0.11, 0.14, shade_m, radius2=0.07, verts=28)
    toy_car("ToyCar", (tx1 - 0.08, ty0 + 0.1, tz), 75,
            make_mat("ToyRed", hexc("#D23A2E"), 0.3, var=0.04, coat=0.4),
            make_mat("ToyYellow", hexc("#EFC531"), 0.3, var=0.04, coat=0.4),
            make_mat("ToyBlack", hexc("#1A1A1A"), 0.5, var=0.0))
    box("Keys", (tx0 + 0.1, ty0 + 0.12, tz + 0.004), (0.06, 0.03, 0.008), brass, rot=(0, 0, 30))

    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.005, 0.009, 1)
    cam = camera((0.0, 0.0, 1.1), rot=(90.0, 0.0, 0.0), lens=30.0, shift_y=-0.075)
    far_door_c = (0.0, L, dh / 2)
    print("far door centre at", proj(far_door_c))
    render("hallway_night")
    meta = dict(far_door_center=proj(far_door_c), far_door_rect=[*proj((-dw / 2, L, dh)), *proj((dw / 2, L, 0.0))],
                table_rect=proj_obj_bbox(bpy.data.objects["STableTop"]),
                ajar_door_rect=[*proj((-W, left_doors[0][0] - dw / 2, dh)), *proj((-W, left_doors[0][0] + dw / 2, 0.0))],
                nightlight=proj((W, nly, 0.3)))
    save_blend("hallway_night")
    write_meta("hallway_night", meta)


# ============================================================== CLOSET DOOR
CL = dict(dx0=-0.82, dx1=0.0, dh=2.03, T=0.12, cam_d=2.4, cam_h=1.2, lens=28.0, ajar=-34.0, open=-56.0)


def render_closet(variant):
    """variant: 'ajar' (closet_door) or 'open' (closet_door_open). Same camera."""
    reset(640, 480, samples=96, look="AgX - Medium High Contrast", exposure=0.8)
    dx0, dx1, dh, T = CL["dx0"], CL["dx1"], CL["dh"], CL["T"]
    dw = dx1 - dx0
    is_open = variant == "open"

    def paper(b, vec):
        uv, p = _uv(b, "x")
        w = b.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X", wave_profile="SIN")
        b.set(w.inputs["Vector"], uv)
        w.inputs["Scale"].default_value = 6.0
        stripes = b.mix(b.rgb(hexc("#CFD0DE")), b.rgb(hexc("#B9BCD3")), b.maprange(w.outputs[1], 0.45, 0.55, 0, 1))
        dots = b.maprange(b.noise(uv, 14.0, 0.0, 0.5), 0.70, 0.72, 0.0, 0.35)
        return b.mix(stripes, b.rgb(hexc("#9AA6C8")), dots)
    wall = make_mat("ClWall", rough=0.85, var=0.07, grime=0.3, grime_scale=1.4, floor_dirt=0.3, base=paper,
                    space="world", streak=0.15)
    trim = make_mat("ClTrim", hexc("#EEEAE0"), 0.4, var=0.04, grime=0.3, floor_dirt=0.3)
    floor = make_mat("ClFloor", rough=0.4, var=0.06, coat=0.1, space="world", grime=0.25,
                     base=planks_base(hexc("#9A6D45"), hexc("#7A5232"), hexc("#3A2618"), plank_w=0.11))
    door_m = make_mat("ClosetDoorYellow", hexc("#F2DA86"), 0.62, var=0.06, grime=0.4, grime_scale=2.5,
                      floor_dirt=0.25, spec=0.3)
    brass = make_mat("ClBrass", hexc("#B8913A"), 0.3, metallic=0.8, var=0.06, grime=0.3)
    void = void_mat()

    wall_with_holes("ClWall", "x", 0.0, -3.5, 3.5, 0.0, 2.6, T, [(dx0, dx1, -0.1, dh)], wall)
    box2("ClFloor", (-3.5, -3.5, -0.05), (3.5, 1.2, 0.0), floor)
    box2("ClCeil", (-3.5, -3.5, 2.6), (3.5, 1.2, 2.65), make_mat("ClCeilM", hexc("#D8D6DE"), 0.9, var=0.04))
    box2("ClSkirtL", (-3.5, -0.014, 0.0), (dx0 - 0.07, 0.0, 0.1), trim)
    box2("ClSkirtR", (dx1 + 0.07, -0.014, 0.0), (3.5, 0.0, 0.1), trim)
    home_door("ClDoor", ((dx0 + dx1) / 2, 0.0), "x", -1, door_m, trim, brass, width=dw, height=dh, wall_t=T,
              ajar=CL["open"] if is_open else CL["ajar"], hinge_side=-1)

    # closet interior: in the ajar shot it is pure void; in the open shot dark clothes are barely there
    ix0, ix1, iy0, iy1, ih = dx0 - 0.35, dx1 + 0.45, T, T + 0.68, 2.3
    if is_open:
        inner = make_mat("ClosetInside", hexc("#3C3A40"), 0.9, var=0.1, grime=0.5)
        box2("InBack", (ix0, iy1, 0.0), (ix1, iy1 + 0.05, ih), inner)
        box2("InL", (ix0 - 0.05, iy0, 0.0), (ix0, iy1, ih), inner)
        box2("InR", (ix1, iy0, 0.0), (ix1 + 0.05, iy1, ih), inner)
        box2("InTop", (ix0, iy0, ih), (ix1, iy1, ih + 0.05), inner)
        box2("InFloor", (ix0, iy0, -0.01), (ix1, iy1, 0.001), inner)
        box2("InShelf", (ix0, iy0 + 0.1, 1.85), (ix1, iy1, 1.87), inner)
        rod_m = make_mat("ClRod", hexc("#8A8A86"), 0.3, metallic=0.8, var=0.05)
        cyl("ClRod", ((ix0 + ix1) / 2, (iy0 + iy1) / 2 + 0.04, 1.72), 0.012, ix1 - ix0, rod_m, rot=(0, 90, 0), verts=10)
        cloth_cols = ["#3A4458", "#5A3A3A", "#4A4A3C", "#2E3A30", "#56505C", "#3E3530", "#4C5466"]
        rng = np.random.default_rng(7)
        xs = np.linspace(ix0 + 0.12, ix1 - 0.1, 9)
        for k, x in enumerate(xs):
            x = float(x + rng.uniform(-0.03, 0.03))
            yc = (iy0 + iy1) / 2 + 0.04
            ln = float(rng.uniform(0.55, 1.0))
            cm = make_mat(f"Cloth{k}", hexc(cloth_cols[k % len(cloth_cols)]), 0.9, var=0.1, sheen=0.3, bump=0.2,
                          bump_scale=40)
            wire_hanger(f"ClHanger{k}", (x, yc, 1.72), rod_m, yaw=90 + float(rng.uniform(-8, 8)))
            box(f"Cloth{k}", (x, yc, 1.62 - ln / 2), (0.05, 0.42, ln), cm, rot=(0, float(rng.uniform(-3, 3)), 0),
                bevel=0.02)
        # the faintest edge of light inside
        light("InsideEdge", "AREA", (dx0 + 0.25, 0.3, 0.25), 0.9, (0.65, 0.75, 1.0), target=(dx1 - 0.1, 0.6, 1.5),
              size=0.2, size_y=0.2)
    else:
        void_room("InVoid", (ix0, iy0, 0.001), (ix1, iy1, ih), void, open_side="-y")

    # bed edge at the right of frame, its blanket spilling over the side
    frame_m = make_mat("ClBedFrame", hexc("#E6E1D4"), 0.45, var=0.05, grime=0.2)
    duvet = make_mat("ClDuvet", rough=0.9, var=0.06, sheen=0.4, bump=0.12, bump_scale=25,
                     base=lambda b, v: b.mix(b.rgb(hexc("#86A6DA")), b.rgb(hexc("#F1D36A")),
                                             b.maprange(b.node("ShaderNodeTexChecker").outputs[1], 0.4, 0.6, 0, 1)))
    ck = [n for n in duvet.node_tree.nodes if n.bl_idname == "ShaderNodeTexChecker"][0]
    ck.inputs["Scale"].default_value = 6.0
    bx0 = 1.25
    box2("ClBedBase", (bx0, -2.2, 0.24), (bx0 + 1.0, -0.02, 0.40), frame_m, bevel=0.015)
    box2("ClBedHead", (bx0, -0.06, 0.24), (bx0 + 1.0, -0.02, 1.0), frame_m, bevel=0.015)
    box2("ClBedLeg", (bx0 + 0.01, -0.1, 0.0), (bx0 + 0.07, -0.04, 0.26), frame_m)
    box2("ClBedLeg2", (bx0 + 0.01, -2.18, 0.0), (bx0 + 0.07, -2.12, 0.26), frame_m)
    box2("ClUnderBed", (bx0 + 0.04, -2.1, 0.001), (bx0 + 1.0, -0.1, 0.23), void)
    box2("ClMattress", (bx0 + 0.03, -2.15, 0.40), (bx0 + 0.97, -0.08, 0.57), make_mat("ClSheet", hexc("#E4E6EE"),
         0.85, var=0.06, sheen=0.3), bevel=0.04)

    def hang(u, v):
        drop = 0.0
        if u < 0.25:
            drop = -min(0.5, (0.25 - u) * 2.4)
        return (0.0, 0.0, drop + 0.03 * math.sin(v * 13 + u * 4))
    cloth_grid("ClDuvetObj", 1.2, 1.9, 30, 40, duvet, loc=(bx0 + 0.55, -1.15, 0.6), height_fn=hang, displace=0.05,
               disp_scale=0.25)

    # star nightlight low-left: cool light up across the door
    cool = (0.62, 0.74, 1.0)
    nl_x = -1.35
    plug_nightlight("ClNL", (nl_x, 0.0, 0.32), 0, trim, emit_mat("ClNLGlow", (*cool, 1.0), 4.0), star=True)
    light("ClNLPoint", "POINT", (nl_x + 0.03, -0.2, 0.36), 2.2, cool, size=0.05)
    # faint moonlight from an unseen window at the right
    light("ClMoon", "AREA", (2.6, -2.2, 1.9), 7.0, (0.42, 0.55, 1.0), target=(-0.3, 0.0, 0.9), size=0.8, size_y=1.2)

    # floor clutter in front of the door: a sneaker and a small stuffed toy on its side
    sneaker("Sneaker", (-1.05, -0.3, 0.0), 28, make_mat("SneakerUpper", hexc("#D9DDE4"), 0.7, var=0.06, grime=0.4),
            make_mat("SneakerSole", hexc("#E9E6DD"), 0.6, var=0.05, grime=0.5),
            make_mat("SneakerAccent", hexc("#3C64B8"), 0.6, var=0.05))
    bunny = make_mat("ClBunny", hexc("#BDAFA8"), 0.95, var=0.07, var_scale=20, sheen=0.5, bump=0.15, bump_scale=200,
                     grime=0.25)
    stuffed_bunny("ClToy", (0.32, -0.38, 0.075), 200, bunny, make_mat("ClBunnyIn", hexc("#D9A3A8"), 0.95),
                  make_mat("ClBunnyEye", hexc("#0A0A0A"), 0.1, coat=0.6), lying=True)
    # a small framed abstract picture and a growth chart strip on the wall at right
    picture_frame("ClPic", (0.85, 0.0, 1.5), 0, 0.34, 0.42, make_mat("ClFrame", hexc("#5A3E2A"), 0.45, var=0.06),
                  abstract_art([("disc", 0.0, 0.1, 0.25, "#D8B04A"), ("rect", 0.0, -0.25, 0.5, "#5C7FA6")]))
    box("LightSwitch", (0.55, -0.005, 1.1), (0.075, 0.01, 0.12), trim, bevel=0.003)

    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.003, 0.004, 0.008, 1)
    # square-on camera; shift so the door top sits near the frame top and the gap is centred
    cam = camera((-0.1, -CL["cam_d"], CL["cam_h"]), rot=(90.0, 0.0, 0.0), lens=CL["lens"], shift_y=-0.097)
    bpy.context.view_layer.update()
    hinge = bpy.data.objects["ClDoorHinge"]
    ang = math.radians(CL["ajar"])
    # where the (ajar) slab's free edge is, in world space
    edge = Vector((dx0 + dw * math.cos(ang), 0.025 + dw * math.sin(ang), 1.0))
    print("closet edge", tuple(edge))
    for _ in range(4):
        e = proj(edge)
        j = proj((dx1, 0.0, 1.0))
        cx = (e[0] + j[0]) / 2
        cam.data.shift_x += (cx - 322.5) / 640.0
    bpy.context.view_layer.update()
    name = "closet_door_open" if is_open else "closet_door"
    render(name)
    meta = dict(gap_rect=[proj(edge)[0], proj((dx1, 0.0, dh))[1], proj((dx1, 0.0, 1.0))[0], proj((dx1, 0.0, 0.0))[1]],
                door_opening_rect=[*proj((dx0, 0.0, dh)), *proj((dx1, 0.0, 0.0))],
                nightlight=proj((nl_x, 0.0, 0.32)))
    if is_open:
        ango = math.radians(CL["open"])
        edge_o = Vector((dx0 + dw * math.cos(ango), 0.025 + dw * math.sin(ango), 1.0))
        meta["gap_rect"] = [proj(edge_o)[0], meta["gap_rect"][1], meta["gap_rect"][2], meta["gap_rect"][3]]
    save_blend(name)
    write_meta(name, meta)


def post_closet_open():
    """closet_door_open = closet_door everywhere except where the door (and its shadow) changed."""
    a = load_png(os.path.join(OUT_IMG, "closet_door.png"))
    b = load_png(os.path.join(OUT_IMG, "closet_door_open.png"))
    diff = np.abs(a - b).max(axis=2) > (5.0 / 255.0)
    meta = json.load(open(META_PATH)) if os.path.exists(META_PATH) else {}
    r = meta.get("closet_door_open", {}).get("door_opening_rect")
    h, w = a.shape[:2]
    sc = w / 640.0
    region = np.zeros(diff.shape, bool)
    if r:
        x0, y0, x1, y1 = [v * sc for v in r]
        dwp = abs(x1 - x0)
        region[:, max(0, int(min(x0, x1) - 0.9 * dwp)):int(max(x0, x1) + 0.35 * dwp)] = True
    keep = diff & region
    k = keep.copy()
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            k |= np.roll(np.roll(keep, dy, 0), dx, 1)
    k &= region
    m = k.astype(np.float32)
    for _ in range(2):
        m = (m + np.roll(m, 1, 0) + np.roll(m, -1, 0) + np.roll(m, 1, 1) + np.roll(m, -1, 1)) / 5.0
    m = np.maximum(m, keep.astype(np.float32))[..., None]
    out = b * m + a * (1 - m)
    save_png(os.path.join(OUT_IMG, "closet_door_open.png"), out)
    print("closet_open: kept", int(k.sum()), "changed pixels from the open render")


# ============================================================== STUDIO B AFTER HOURS (camcorder)
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


def render_studio_night():
    reset(960, 720, samples=96, look="AgX - Base Contrast", exposure=2.6)
    pr = Playroom("studio", studio=True)
    pr.build()
    zf = -0.06
    # camcorder: 1.5 m, ~28 mm, 2-degree roll, ~8.5 m from the set and ~22 degrees off its axis (to the right,
    # so the plywood back and braces of the right-hand flat show at the set's right edge)
    brg = math.radians(22.0)
    cam = camera((8.6 * math.sin(brg), -1.5 - 8.6 * math.cos(brg), 1.5), target=(2.6, -1.0, 1.75), lens=28.0,
                 roll=2.0)
    # --- the studio around the set: concrete floor, black drapes, a far wall with an exit sign
    def concrete(b, vec):
        p = b.coords("world")
        n1 = b.noise(p, 0.35, 6.0, 0.65)
        n2 = b.noise(p, 3.0, 4.0, 0.6)
        base = b.mix(b.rgb(hexc("#6E6B66")), b.rgb(hexc("#55534F")), b.maprange(n1, 0.35, 0.65, 0.0, 1.0))
        stain = b.maprange(n2, 0.62, 0.7, 1.0, 0.72)
        return b.scale(base, stain)
    floor = make_mat("StudioConcrete", rough=0.55, var=0.06, var_scale=1.0, space="world", base=concrete,
                     rough_var=0.2, bump=0.08, bump_scale=60, grime=0.25, grime_scale=0.4)
    box2("StudioFloor", (-14.0, -14.0, zf - 0.1), (14.0, 9.0, zf), floor)
    drape = make_mat("Drape", hexc("#1B1A1C"), 0.95, var=0.1, sheen=0.3,
                     normal_fn=lambda b, v: _drape_normal(b))
    box2("DrapeBack", (-14.0, 7.0, zf), (14.0, 7.2, 8.0), drape)
    box2("DrapeLeft", (-12.0, -14.0, zf), (-11.8, 7.0, 8.0), drape)
    wallm = make_mat("StudioWall", hexc("#2A2A2C"), 0.9, var=0.08, grime=0.4, space="world")
    box2("WallRight", (11.0, -14.0, zf), (11.2, 9.0, 8.0), wallm)
    box2("StudioCeil", (-14.0, -14.0, 8.0), (14.0, 9.0, 8.2), wallm)
    # exit sign: plain green glowing box over a door on the right wall, no text
    green = (0.12, 1.0, 0.25)
    # exit sign + door on the back drape wall, placed so the sign sits near the right edge of frame
    ep = floor_at_pixel(915, 330, 6.95, axis=1)
    ex, ey, ez = ep.x, 6.95, max(2.4, ep.z)
    box2("ExitSign", (ex - 0.3, ey - 0.15, ez), (ex + 0.3, ey, ez + 0.25), emit_mat("ExitGlow", (*green, 1.0), 5.0))
    box2("ExitDoor", (ex - 0.5, ey - 0.06, zf), (ex + 0.5, ey, 2.2), make_mat("ExitDoorM", hexc("#3A3D3A"), 0.5,
                                                                            var=0.06, grime=0.4))
    light("ExitLight", "AREA", (ex, ey - 0.3, ez - 0.05), 30.0, green, target=(6.0, -1.2, 0.0), size=0.6,
          size_y=0.3, spread=80.0)
    # the ghost light's spill bouncing off the grid and floor faintly reveals the plywood backs of the flats
    light("SpillBounce", "AREA", (4.6, 1.8, 3.6), 5.0, kelvin(3000), target=(2.4, -1.5, 1.0), size=2.5,
          size_y=2.5)

    # tape marks and cable runs on the floor
    tape = make_mat("GaffTape", hexc("#C9C3A8"), 0.6, var=0.1, grime=0.4)
    for k, (x, y, r) in enumerate(((-0.6, -4.2, 0), (-0.45, -4.35, 90), (1.2, -4.6, 0), (1.35, -4.45, 90),
                                   (3.3, -3.0, 20), (-2.2, -5.0, 70))):
        box(f"Tape{k}", (x, y, zf + 0.002), (0.3, 0.05, 0.003), tape, rot=(0, 0, r))
    rubber = make_mat("CableRubber", hexc("#121212"), 0.5, var=0.05, spec=0.4)
    rng = np.random.default_rng(4)
    cable_paths = [
        [(1.5, -6.4), (2.4, -6.9), (3.6, -6.2), (5.2, -6.8), (7.5, -6.0), (10.5, -5.0)],
        [(0.9, -5.0), (1.8, -5.6), (2.8, -4.6), (4.0, -4.9), (6.5, -3.6), (9.0, -3.9)],
        [(0.4, -3.4), (2.6, -3.7), (4.4, -2.2), (5.6, -2.9), (7.0, -1.0), (8.6, -1.4)],
        [(-1.5, -3.6), (-0.6, -5.2), (0.5, -6.2), (0.2, -7.6), (1.0, -9.0)],
        [(5.8, -5.4), (6.6, -4.5), (7.7, -5.1), (8.6, -4.2)],
    ]
    for k, path in enumerate(cable_paths):
        pts = [(x + float(rng.uniform(-0.1, 0.1)), y, zf + 0.018) for x, y in path]
        tube(f"Cable{k}", pts, 0.017, rubber)

    # two studio TV cameras on pedestals: dark silhouettes in the left foreground
    cam_body = make_mat("CamBody", hexc("#3B3E42"), 0.45, var=0.05, grime=0.2)
    cam_dark = make_mat("CamDark", hexc("#141516"), 0.5, var=0.04)
    metal = make_mat("StudioMetal", hexc("#6A6C6E"), 0.35, metallic=0.8, var=0.06, grime=0.3)
    c1 = floor_at_pixel(-15, 655, zf)
    c2 = floor_at_pixel(70, 575, zf)
    studio_camera_rig("TVCam1", (c1.x, c1.y, zf), -160, cam_body, cam_dark, metal)
    studio_camera_rig("TVCam2", (c2.x, c2.y, zf), 175, cam_body, cam_dark, metal)
    # a monitor cart near the set's left edge
    box2("MonCart", (-3.6, -3.2, zf), (-3.0, -2.6, 0.85), cam_dark)
    box("Monitor", (-3.3, -2.9, 1.08), (0.5, 0.45, 0.4), cam_body, rot=(0, 0, 25), bevel=0.02)

    # lighting grid: pipe battens with hanging fresnels, fading into black above
    pipe = make_mat("GridPipe", hexc("#8A8C8E"), 0.4, metallic=0.7, var=0.06, grime=0.3)
    lamp_body = make_mat("LampBody", hexc("#3A3B3D"), 0.45, var=0.05, grime=0.3)
    lens_m = make_mat("FresnelLens", hexc("#5A5E62"), 0.15, var=0.03, spec=0.8, coat=0.5)
    gz = 5.2
    for k, y in enumerate((-4.5, -2.5, -0.5, 1.5)):
        cyl(f"Batten{k}", (0.0, y, gz), 0.03, 16.0, pipe, rot=(0, 90, 0), verts=10)
    for k, x in enumerate((-4.0, 0.0, 4.0)):
        cyl(f"GridCross{k}", (x, -1.5, gz + 0.06), 0.03, 7.5, pipe, rot=(90, 0, 0), verts=10)
    for k, (x, y) in enumerate(((-2.4, -4.5), (-0.8, -4.5), (0.9, -4.5), (2.6, -4.5), (-1.8, -2.5), (1.6, -2.5),
                                (3.4, -2.5), (-3.0, -0.5), (-0.4, -0.5), (2.2, -0.5), (4.6, -4.5), (5.2, -2.5))):
        fresnel_lamp(f"Grid{k}", (x, y, gz - 0.42), (-35 + 10 * math.sin(k), 0, 20 * math.cos(k * 1.7)), lamp_body,
                     lens_m, pipe)
        cyl(f"GridDrop{k}", (x, y, gz - 0.14), 0.012, 0.28, pipe, verts=8)
    for k in range(5):
        tube(f"GridCable{k}", [(-3.5 + 2.0 * k, -4.5, gz - 0.05), (-3.2 + 2.0 * k, -3.5, gz - 0.6),
                               (-2.9 + 2.0 * k, -2.5, gz - 0.05)], 0.012, rubber)

    # the ghost light: bare bulb in a wire cage on a pole, standing on the rug
    gx, gy = PR_POPPY_MARK[0] + 0.15, PR_POPPY_MARK[1] + 0.25
    gl = empty("GhostLight", (gx, gy, 0.016), (0, 0, 15))
    for k in range(3):
        a = 2 * math.pi * k / 3
        cyl(f"GhostLeg{k}", (0.17 * math.cos(a), 0.17 * math.sin(a), 0.1), 0.012, 0.42, metal,
            rot=(math.degrees(math.sin(a)) * -0.6, math.degrees(math.cos(a)) * 0.6, 0), verts=8, parent=gl)
        sphere(f"GhostCaster{k}", (0.3 * math.cos(a), 0.3 * math.sin(a), 0.03), 0.03, cam_dark, parent=gl)
    cyl("GhostBase", (0, 0, 0.2), 0.06, 0.08, cam_dark, verts=16, parent=gl)
    cyl("GhostPole", (0, 0, 0.95), 0.018, 1.5, metal, verts=12, parent=gl)
    cyl("GhostSocket", (0, 0, 1.74), 0.03, 0.08, cam_dark, verts=16, parent=gl)
    bulb_z = 1.86
    warm = kelvin(2700)
    sphere("GhostBulb", (0, 0, bulb_z), 0.055, emit_mat("GhostBulbGlow", (*warm, 1.0), 40.0),
           scale=(1, 1, 1.25), parent=gl)
    wire = make_mat("CageWire", hexc("#2A2A2A"), 0.5, metallic=0.6, var=0.0)
    for k in range(6):
        a = 360.0 * k / 6
        rr = empty(f"CageRib{k}", (0, 0, bulb_z), (0, 0, a), parent=gl)
        tube(f"CageRibW{k}", [(0.0, 0.0, -0.1), (0.1, 0.0, -0.05), (0.11, 0.0, 0.05), (0.06, 0.0, 0.14),
                              (0.0, 0.0, 0.16)], 0.003, wire).parent = rr
    for z, r in ((bulb_z - 0.05, 0.1), (bulb_z + 0.05, 0.105)):
        torus(f"CageRing{z:.2f}", (0, 0, z), r, 0.003, wire, seg=24, ring=6, parent=gl)
    bpy.context.view_layer.update()
    bulb_w = gl.matrix_world @ Vector((0, 0, bulb_z))
    light("GhostPoint", "POINT", tuple(bulb_w), 1500.0, warm, size=0.05)

    # right third: a toppled light stand and a road case in the dark (the whip-pan lands here)
    tsp = floor_at_pixel(770, 560, zf)
    ts = empty("ToppledStand", (tsp.x, tsp.y, zf + 0.04), (0, 0, -32))
    metal = make_mat("StandPaint", hexc("#4E4F50"), 0.5, metallic=0.2, var=0.08, grime=0.3)
    cyl("TSPole", (0.0, 0.0, 0.0), 0.02, 2.3, metal, rot=(0, 90, 0), verts=10, parent=ts)
    cyl("TSPole2", (-0.6, 0.0, 0.0), 0.028, 1.1, metal, rot=(0, 90, 0), verts=10, parent=ts)
    for k, (ry, rz) in enumerate(((60, 30), (60, -30), (110, 0))):
        cyl(f"TSLeg{k}", (-1.35 - 0.3 * math.cos(math.radians(rz)), 0.3 * math.sin(math.radians(rz)), 0.25),
            0.014, 0.9, metal, rot=(0, ry, rz), verts=8, parent=ts)
    fresnel_lamp("TSLamp", (1.3, 0.05, 0.14), (0, 75, 70), lamp_body, lens_m, metal).parent = ts
    case_m = make_mat("RoadCase", hexc("#1C1D1F"), 0.45, var=0.05, grime=0.35, bump=0.05)
    edge_m = make_mat("CaseEdge", hexc("#8C8E90"), 0.3, metallic=0.9, var=0.05, grime=0.3)
    rcp = floor_at_pixel(890, 515, zf)
    rc = box("RoadCase", (rcp.x, rcp.y, zf + 0.42), (1.2, 0.7, 0.84), case_m, rot=(0, 0, -20), bevel=0.01)
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(f"RCEdge{sx}{sz}", (sx * 0.6, 0, sz * 0.42), (0.04, 0.72, 0.04), edge_m, parent=rc)
    box("RoadCaseLid", (rcp.x, rcp.y, zf + 0.86), (1.24, 0.74, 0.05), case_m, rot=(0, 0, -20), bevel=0.01)
    box("RoadCase2", (rcp.x + 0.7, rcp.y + 1.3, zf + 0.3), (0.8, 0.6, 0.6), case_m, rot=(0, 0, 10), bevel=0.01)
    # a stack of sandbags and a coiled cable near the case
    for k in range(3):
        cyl(f"Sandbag2_{k}", (rcp.x - 0.7 + 0.3 * k, rcp.y + 0.8, zf + 0.06), 0.14, 0.12,
            make_mat(f"SB{k}", hexc("#2E2A26"), 0.95, var=0.1), verts=16).scale = (1.0, 0.65, 1.0)
    ccp = floor_at_pixel(640, 520, zf)
    torus("CableCoil", (ccp.x, ccp.y, zf + 0.03), 0.28, 0.02, rubber, seg=40, ring=8)
    torus("CableCoil2", (ccp.x + 0.03, ccp.y + 0.02, zf + 0.07), 0.25, 0.02, rubber, seg=40, ring=8)

    s = scene()
    s.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.005, 0.0048, 0.0045, 1)
    print("set centre at", proj((0.0, -1.2, 1.0)), "set right edge", proj((2.45, -3.0, 0.0)), "stand at", tuple(tsp),
          "case at", tuple(rcp), "exit at", proj((ex, ey, ez)), "grid at", proj((0.0, -2.5, 5.2)))
    render("studio_night")
    meta = dict(ghost_light=proj(tuple(bulb_w)), set_rect=[*proj((-2.4, -3.0, 3.05)), *proj((2.4, 0.0, 0.0))],
                toppled_stand=proj(tuple(tsp)), road_case=proj((rcp.x, rcp.y, 0.5)),
                exit_sign=proj((ex, ey, ez)),
                note="Right third (x>640) is dark floor with a toppled light stand and road cases; no figures.")
    save_blend("studio_night")
    write_meta("studio_night", meta)


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


# ============================================================== dispatcher
ROOMS = {
    "playroom_wide": lambda: render_playroom("wide"),
    "playroom_wide_ajar": lambda: (render_playroom("ajar"), post_ajar()),
    "playroom_board": lambda: render_playroom("board"),
    "playroom_dark": lambda: (render_playroom("dark"), post_dark()),
    "backstage_corridor": render_corridor,
    "dressing_room": render_dressing_room,
    "studio_night": render_studio_night,
    "bedroom_night": render_bedroom,
    "hallway_night": render_hallway,
    "closet_door": lambda: render_closet("ajar"),
    "closet_door_open": lambda: (render_closet("open"), post_closet_open()),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    if "--" in args:
        args = args[args.index("--") + 1:]
    wanted = [a for a in args if a in ROOMS] or list(ROOMS)
    unknown = [a for a in args if a not in ROOMS and not a.startswith("-")]
    if unknown:
        print("unknown rooms:", unknown, "choose from", list(ROOMS))
    if "playroom_wide_ajar" in wanted and "playroom_wide" not in wanted and not os.path.exists(
            os.path.join(OUT_IMG, "playroom_wide.png")):
        wanted.insert(0, "playroom_wide")
    t0 = time.time()
    for name in wanted:
        ROOMS[name]()
    print(f"done {wanted} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
