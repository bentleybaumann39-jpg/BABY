"""City and military props, exported together as kaiju/assets/props.glb.

Vehicles are built from side-profile extrusions (body, glasshouse) with bevelled edges,
wheels and light clusters; each vehicle is split by material into separate objects
(<name>_paint, _glass, _dark, _lamp) so the game can tint paint per instance while glass
and rubber stay put. Units are metres; vehicles face -Y in Blender (+Z in the game).

usage: python props.py [--preview out.png]
"""
import sys, os, math, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
import butil

ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
MATS = {}


def mat(name, color, rough=0.5, metal=0.0, emit=None, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 3.0
    MATS[name] = m
    return m


class Builder:
    """Accumulates geometry per material for one prop, then emits one object per material."""

    def __init__(self, name):
        self.name = name
        self.parts = {}  # material -> bmesh

    def bm(self, m):
        if m not in self.parts:
            self.parts[m] = bmesh.new()
        return self.parts[m]

    def profile(self, m, pts, width, x0=0.0, bevel=0.06, segs=2):
        """Extrude a side profile [(y, z), ...] (counter-clockwise seen from +X) across X."""
        b = bmesh.new()
        verts = [b.verts.new((x0 - width / 2, y, z)) for y, z in pts]
        f = b.faces.new(verts)
        res = bmesh.ops.extrude_face_region(b, geom=[f])
        nv = [e for e in res['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(b, verts=nv, vec=(width, 0, 0))
        bmesh.ops.recalc_face_normals(b, faces=b.faces)
        if bevel > 0:
            bmesh.ops.bevel(b, geom=list(b.edges), offset=bevel, segments=segs, profile=0.5, affect='EDGES', clamp_overlap=True)
        self._merge(m, b)

    def box(self, m, c, s, bevel=0.0, rot=None):
        b = bmesh.new()
        bmesh.ops.create_cube(b, size=1.0)
        bmesh.ops.scale(b, vec=s, verts=b.verts)
        if bevel > 0:
            bmesh.ops.bevel(b, geom=list(b.edges), offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)
        if rot:
            bmesh.ops.rotate(b, verts=b.verts, cent=(0, 0, 0), matrix=rot)
        bmesh.ops.translate(b, verts=b.verts, vec=c)
        self._merge(m, b)

    def cyl(self, m, c, r, h, axis='Z', segs=12, r2=None, cap=True):
        b = bmesh.new()
        bmesh.ops.create_cone(b, cap_ends=cap, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)
        if axis == 'X':
            bmesh.ops.rotate(b, verts=b.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
        elif axis == 'Y':
            bmesh.ops.rotate(b, verts=b.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
        bmesh.ops.translate(b, verts=b.verts, vec=c)
        self._merge(m, b)

    def sphere(self, m, c, r, scale=(1, 1, 1), sub=2, noise=0.0, seed=0):
        b = bmesh.new()
        bmesh.ops.create_icosphere(b, subdivisions=sub, radius=r)
        rng = np.random.default_rng(seed)
        for v in b.verts:
            d = 1 + noise * (rng.random() - 0.5)
            v.co = Vector((v.co.x * scale[0] * d, v.co.y * scale[1] * d, v.co.z * scale[2] * d))
        bmesh.ops.translate(b, verts=b.verts, vec=c)
        self._merge(m, b)

    def loft(self, m, sections, segs=10):
        """Fuselage from cross-sections [(y, cx, cz, rx, rz), ...] (ellipses)."""
        b = bmesh.new()
        rings = []
        for y, cx, cz, rx, rz in sections:
            ring = []
            for k in range(segs):
                a = 2 * math.pi * k / segs
                ring.append(b.verts.new((cx + rx * math.cos(a), y, cz + rz * math.sin(a))))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for k in range(segs):
                a, bb = rings[i][k], rings[i][(k + 1) % segs]
                c, d = rings[i + 1][(k + 1) % segs], rings[i + 1][k]
                b.faces.new((a, bb, c, d))
        b.faces.new(rings[0][::-1])
        b.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(b, faces=b.faces)
        self._merge(m, b)

    def wing(self, m, root, tip, span_dir, thick=0.25):
        """Flat tapered panel: root/tip are (y_lead, y_trail, z) at the root and the tip position."""
        b = bmesh.new()
        (rl, rt, rz), (tl, tt, tz, tx) = root, tip
        sd = span_dir
        pts = [(0, rl, rz), (0, rt, rz), (tx * sd, tt, tz), (tx * sd, tl, tz)]
        top = [b.verts.new((x, y, z + thick / 2)) for x, y, z in pts]
        bot = [b.verts.new((x, y, z - thick / 2)) for x, y, z in pts]
        b.faces.new(top)
        b.faces.new(bot[::-1])
        for i in range(4):
            b.faces.new((top[i], bot[i], bot[(i + 1) % 4], top[(i + 1) % 4]))
        bmesh.ops.recalc_face_normals(b, faces=b.faces)
        self._merge(m, b)

    def _merge(self, m, b):
        dst = self.bm(m)
        me = bpy.data.meshes.new('_tmp')
        b.to_mesh(me)
        b.free()
        dst.from_mesh(me)
        bpy.data.meshes.remove(me)

    def emit(self, collection, offset=(0, 0, 0)):
        objs = []
        for m, b in self.parts.items():
            me = bpy.data.meshes.new(f'{self.name}_{m.name}')
            b.to_mesh(me)
            b.free()
            me.materials.append(m)
            ob = bpy.data.objects.new(f'{self.name}_{m.name.split(".")[0]}', me)
            for p in me.polygons:
                p.use_smooth = False
            collection.objects.link(ob)
            ob.location = offset
            objs.append(ob)
        self.parts = {}
        return objs


# ----------------------------------------------------------------------------- vehicles

def wheels(B, xs, ys, r, w, rim=None):
    for x in xs:
        for y in ys:
            B.cyl(M['rubber'], (x, y, r), r, w, axis='X', segs=14)
            B.cyl(M['trim'], (x + (w / 2 + 0.01) * (1 if x > 0 else -1), y, r), r * 0.55, 0.04, axis='X', segs=10)


def sedan(name='car_sedan', L=4.7, W=1.85, H=1.45, long_roof=False):
    B = Builder(name)
    hl = L / 2
    belt = 0.95
    body = [(-hl, 0.35), (-hl, 0.75), (-hl + 0.25, 0.92), (-hl + 1.05, belt), (hl - 0.9, belt), (hl - 0.15, 0.9), (hl, 0.7), (hl, 0.35), (hl - 0.6, 0.28), (-hl + 0.6, 0.28)]
    B.profile(M['paint'], body[::-1], W, bevel=0.07)
    rear = hl - (0.3 if long_roof else 0.95)
    cabin = [(-hl + 1.05, belt - 0.02), (-hl + 1.75, H - 0.05), (rear - 0.15, H - 0.05), (rear + 0.35, belt - 0.02)]
    B.profile(M['glass'], cabin[::-1], W - 0.16, bevel=0.05)
    B.box(M['paint'], (0, (-hl + 1.75 + rear - 0.15) / 2, H - 0.03), (W - 0.2, (rear - 0.15) - (-hl + 1.75) + 0.1, 0.06))
    wheels(B, (-W / 2 + 0.12, W / 2 - 0.12), (-hl + 0.85, hl - 0.85), 0.34, 0.24)
    B.box(M['lamp'], (0, -hl + 0.02, 0.72), (W - 0.4, 0.05, 0.12))
    B.box(M['tail'], (0, hl - 0.02, 0.72), (W - 0.3, 0.05, 0.1))
    B.box(M['dark'], (0, -hl + 0.02, 0.45), (W - 0.5, 0.06, 0.18))
    return B


def suv():
    return sedan('car_suv', L=4.9, W=1.95, H=1.8, long_roof=True)


def van():
    B = Builder('car_van')
    L, W, H = 5.3, 2.0, 2.3
    hl = L / 2
    body = [(-hl, 0.35), (-hl, 1.0), (-hl + 0.6, 1.25), (-hl + 0.9, H), (hl, H), (hl, 0.35)]
    B.profile(M['paint'], body[::-1], W, bevel=0.08)
    B.profile(M['glass'], [(-hl + 0.62, 1.28), (-hl + 0.9, 2.15), (-hl + 1.5, 2.15), (-hl + 1.5, 1.28)][::-1], W + 0.02, bevel=0.02)
    wheels(B, (-W / 2 + 0.12, W / 2 - 0.12), (-hl + 0.8, hl - 0.9), 0.36, 0.26)
    B.box(M['lamp'], (0, -hl + 0.02, 0.85), (W - 0.4, 0.05, 0.14))
    B.box(M['tail'], (0, hl - 0.02, 0.9), (W - 0.2, 0.05, 0.2))
    return B


def bus():
    B = Builder('car_bus')
    L, W, H = 12.0, 2.55, 3.2
    hl = L / 2
    body = [(-hl, 0.4), (-hl, H - 0.2), (-hl + 0.2, H), (hl - 0.15, H), (hl, H - 0.15), (hl, 0.4)]
    B.profile(M['paint'], body[::-1], W, bevel=0.1)
    B.box(M['glass'], (0, 0.3, 2.2), (W + 0.02, L - 1.6, 1.1))
    B.box(M['glass'], (0, -hl + 0.02, 2.0), (W - 0.2, 0.06, 1.6))
    wheels(B, (-W / 2 + 0.15, W / 2 - 0.15), (-hl + 2.4, hl - 2.8), 0.5, 0.3)
    B.box(M['lamp'], (0, -hl - 0.01, 0.8), (W - 0.4, 0.05, 0.16))
    return B


def truck():
    B = Builder('car_truck')
    W = 2.5
    cab = [(-8.0, 0.6), (-8.0, 2.4), (-7.6, 3.1), (-5.6, 3.1), (-5.6, 0.6)]
    B.profile(M['paint'], cab[::-1], W, bevel=0.1)
    B.box(M['glass'], (0, -7.7, 2.6), (W - 0.2, 0.25, 0.75))
    B.box(M['trailer'], (0, 1.2, 2.35), (W + 0.05, 13.0, 3.3), bevel=0.05)
    B.box(M['dark'], (0, -2.0, 0.85), (1.2, 12.5, 0.4))
    wheels(B, (-W / 2 + 0.2, W / 2 - 0.2), (-7.0, -4.7, -3.4, 4.8, 6.1), 0.52, 0.32)
    B.box(M['lamp'], (0, -8.02, 1.0), (W - 0.3, 0.05, 0.16))
    return B


def tank():
    B = Builder('mil_tank')
    hull = [(-4.8, 0.55), (-5.0, 1.3), (-3.6, 2.05), (3.6, 2.05), (4.9, 1.45), (4.7, 0.55)]
    B.profile(M['olive'], hull[::-1], 3.6, bevel=0.06)
    for x in (-1.75, 1.75):
        B.box(M['track'], (x, 0, 0.75), (0.75, 9.6, 1.2), bevel=0.15)
        for y in np.linspace(-3.9, 3.9, 7):
            B.cyl(M['dark'], (x * 1.03, y, 0.62), 0.42, 0.66, axis='X', segs=12)
    B.box(M['olive'], (0, 0, 2.08), (3.3, 6.8, 0.12))
    return B


def tank_turret():
    B = Builder('mil_turret')
    tur = [(-2.9, 0.0), (-2.4, 0.95), (1.9, 0.95), (2.3, 0.0)]
    B.profile(M['olive'], tur[::-1], 3.1, bevel=0.08)
    B.cyl(M['olive'], (0, -5.0, 0.55), 0.12, 5.2, axis='Y', segs=10)
    B.cyl(M['olive'], (0, -3.2, 0.55), 0.2, 1.4, axis='Y', segs=10)
    B.box(M['dark'], (0.8, 0.6, 1.05), (0.6, 0.6, 0.2))
    return B


def heli():
    B = Builder('mil_heli')
    secs = [(-7.6, 0, 1.75, 0.1, 0.1), (-7.1, 0, 1.7, 0.55, 0.6), (-6.0, 0, 1.75, 0.75, 0.95), (-3.5, 0, 1.9, 0.95, 1.25),
            (-1.0, 0, 2.0, 1.0, 1.25), (0.8, 0, 2.1, 0.75, 0.95), (2.5, 0, 2.3, 0.35, 0.45), (8.5, 0, 2.6, 0.22, 0.28), (9.4, 0, 2.7, 0.18, 0.2)]
    B.loft(M['heli'], secs, segs=12)
    B.loft(M['glass'], [(-6.8, 0, 2.3, 0.05, 0.05), (-6.3, 0, 2.35, 0.45, 0.5), (-4.5, 0, 2.55, 0.62, 0.62), (-3.3, 0, 2.6, 0.55, 0.5), (-2.8, 0, 2.55, 0.1, 0.1)], segs=10)
    for s in (-1, 1):
        B.wing(M['heli'], (-1.6, -0.2, 1.8), (-1.3, -0.4, 1.7, 2.6), s, thick=0.18)
        B.cyl(M['dark'], (2.3 * s, -1.0, 1.35), 0.32, 2.0, axis='Y', segs=10)
        B.cyl(M['heli'], (1.2 * s, -0.5, 2.6), 0.42, 2.4, axis='Y', segs=10)
    B.wing(M['heli'], (8.2, 9.2, 2.6), (8.5, 9.2, 4.4, 0.0), 1, thick=0.15)
    B.box(M['heli'], (0, 8.9, 4.0), (0.12, 1.1, 2.6))
    B.cyl(M['dark'], (0, -0.5, 3.35), 0.28, 0.9, segs=10)
    for s in (-1, 1):
        B.box(M['dark'], (0.95 * s, -2.4, 0.4), (0.15, 0.15, 0.8))
        B.cyl(M['rubber'], (0.95 * s, -2.4, 0.3), 0.3, 0.2, axis='X')
    return B


def heli_rotor():
    B = Builder('mil_rotor')
    for k in range(4):
        R = Matrix.Rotation(k * math.pi / 2, 3, 'Z')
        B.box(M['dark'], tuple(R @ Vector((3.9, 0, 0))), (7.4, 0.55, 0.08), rot=R)
    B.cyl(M['dark'], (0, 0, 0), 0.35, 0.4, segs=10)
    return B


def tail_rotor():
    B = Builder('mil_tailrotor')
    for k in range(2):
        R = Matrix.Rotation(k * math.pi / 2, 3, 'X')
        B.box(M['dark'], (0, 0, 0), (0.06, 2.6, 0.22), rot=R)
    return B


def jet():
    B = Builder('mil_jet')
    secs = [(-8.4, 0, 1.0, 0.05, 0.05), (-7.5, 0, 1.05, 0.38, 0.38), (-5.5, 0, 1.15, 0.7, 0.7), (-3.0, 0, 1.15, 0.9, 0.85),
            (0.0, 0, 1.1, 1.0, 0.8), (4.0, 0, 1.1, 0.95, 0.75), (6.6, 0, 1.15, 0.55, 0.55), (7.2, 0, 1.15, 0.5, 0.5)]
    B.loft(M['jet'], secs, segs=12)
    B.loft(M['glass'], [(-6.4, 0, 1.55, 0.05, 0.05), (-5.8, 0, 1.75, 0.38, 0.35), (-4.0, 0, 1.95, 0.42, 0.4), (-2.6, 0, 1.8, 0.3, 0.25), (-2.0, 0, 1.6, 0.05, 0.05)], segs=10)
    for s in (-1, 1):
        B.wing(M['jet'], (-2.5, 3.8, 1.0), (2.4, 4.4, 1.0, 5.0), s, thick=0.18)
        B.wing(M['jet'], (4.4, 7.0, 1.1), (6.2, 7.2, 1.15, 2.4), s, thick=0.12)
        B.cyl(M['dark'], (2.8 * s, 1.5, 0.75), 0.15, 2.6, axis='Y', segs=8)
    B.wing(M['jet'], (3.8, 6.9, 1.6), (6.0, 7.0, 4.4, 0.0), 1, thick=0.14)
    B.box(M['jet'], (0, 5.4, 2.9), (0.1, 2.2, 2.8))
    B.cyl(M['dark'], (0, 7.25, 1.15), 0.48, 0.3, axis='Y', segs=12)
    return B


def missile():
    B = Builder('mil_missile')
    B.cyl(M['trim'], (0, 0, 0), 0.09, 1.8, axis='Y', segs=8)
    B.cyl(M['trim'], (0, -1.0, 0), 0.0, 0.25, axis='Y', segs=8, r2=0.09)
    return B


# ----------------------------------------------------------------------------- city furniture

def tree(kind, seed):
    B = Builder(f'tree_{kind}')
    rng = np.random.default_rng(seed)
    if kind == 'round':
        B.cyl(M['bark'], (0, 0, 2.2), 0.28, 4.4, segs=8, r2=0.18)
        for k in range(7):
            a = rng.random() * 6.28
            r = 1.2 + rng.random() * 1.0
            B.sphere(M['leaf'], (math.cos(a) * r, math.sin(a) * r, 5.4 + rng.random() * 2.4), 2.0 + rng.random() * 0.9, sub=1, noise=0.35, seed=seed + k)
        B.sphere(M['leaf'], (0, 0, 7.6), 2.5, sub=1, noise=0.3, seed=seed + 9)
    elif kind == 'conifer':
        B.cyl(M['bark'], (0, 0, 1.0), 0.25, 2.0, segs=8)
        for k in range(4):
            B.cyl(M['needle'], (0, 0, 2.2 + k * 1.9), 2.8 - k * 0.6, 3.0, segs=9, r2=0.15)
    else:  # tall street tree
        B.cyl(M['bark'], (0, 0, 3.0), 0.22, 6.0, segs=8, r2=0.15)
        for k in range(5):
            a = rng.random() * 6.28
            B.sphere(M['leaf2'], (math.cos(a) * 0.9, math.sin(a) * 0.9, 6.0 + rng.random() * 3.0), 1.6 + rng.random() * 0.6, scale=(1, 1, 1.3), sub=1, noise=0.35, seed=seed + k)
    return B


def streetlight():
    B = Builder('streetlight')
    B.cyl(M['pole'], (0, 0, 4.5), 0.13, 9.0, segs=8, r2=0.08)
    B.box(M['pole'], (0, -1.1, 8.85), (0.12, 2.3, 0.12))
    B.box(M['pole'], (0, -2.3, 8.75), (0.45, 0.8, 0.18), bevel=0.04)
    B.box(M['bulb'], (0, -2.3, 8.64), (0.32, 0.6, 0.04))
    return B


def traffic_light():
    B = Builder('trafficlight')
    B.cyl(M['pole'], (0, 0, 3.0), 0.12, 6.0, segs=8)
    B.box(M['pole'], (0, -3.0, 5.8), (0.12, 6.0, 0.14))
    B.box(M['dark'], (0, -4.5, 5.2), (0.4, 0.35, 1.1), bevel=0.04)
    return B


def ac_unit():
    B = Builder('roof_ac')
    B.box(M['metal'], (0, 0, 0.9), (4.0, 2.4, 1.8), bevel=0.05)
    for x in (-1.0, 1.0):
        B.cyl(M['dark'], (x, 0, 1.82), 0.75, 0.06, segs=14)
    return B


def water_tower():
    B = Builder('roof_tank')
    for x in (-1.6, 1.6):
        for y in (-1.6, 1.6):
            B.box(M['metal'], (x, y, 2.0), (0.2, 0.2, 4.0))
    B.cyl(M['wood'], (0, 0, 6.2), 2.4, 4.4, segs=16)
    B.cyl(M['metal'], (0, 0, 8.9), 2.5, 1.0, segs=16, r2=0.15)
    return B


def antenna():
    B = Builder('roof_antenna')
    B.cyl(M['metal'], (0, 0, 9), 0.45, 18, segs=6, r2=0.08)
    for z in (6, 11, 15):
        B.box(M['metal'], (0, 0, z), (2.2, 0.08, 0.08))
    B.sphere(M['bulb_red'], (0, 0, 18.2), 0.25, sub=1)
    return B


def crane():
    """Ship-to-shore container crane: portal legs, a long boom over the water."""
    B = Builder('crane')
    for x in (-9, 9):
        for y in (-6, 6):
            B.box(M['crane'], (x, y, 22), (1.2, 1.2, 44))
    for y in (-6, 6):
        B.box(M['crane'], (0, y, 43.5), (19.5, 1.4, 2.0))
    for x in (-9, 9):
        B.box(M['crane'], (x, 0, 44), (1.4, 13.0, 1.6))
        B.box(M['crane'], (x, 0, 18), (1.0, 13.0, 1.0))
    B.box(M['crane'], (0, 22, 47), (4, 70, 2.4))
    B.box(M['crane'], (0, -12, 47), (4, 14, 2.4))
    B.box(M['metal'], (0, -16, 49.5), (6, 6, 4))
    B.box(M['crane'], (0, 0, 58), (1.2, 1.2, 22))
    for s_ in (1, -1):
        ang = math.atan2(11, 30)
        B.box(M['metal'], (0, 15 * s_, 63.5), (0.3, math.hypot(30, 11), 0.3), rot=Matrix.Rotation(-ang * s_, 3, 'X'))
    B.box(M['dark'], (0, 30, 44.5), (3, 5, 2.4))
    return B


def person():
    B = Builder('person')
    B.box(M['cloth'], (0, 0, 1.2), (0.42, 0.26, 0.62), bevel=0.04)
    B.box(M['jeans'], (-0.11, 0, 0.45), (0.16, 0.2, 0.9))
    B.box(M['jeans'], (0.11, 0, 0.45), (0.16, 0.2, 0.9))
    B.sphere(M['skin'], (0, 0, 1.68), 0.13, sub=1)
    B.box(M['cloth'], (-0.28, 0, 1.2), (0.1, 0.12, 0.58))
    B.box(M['cloth'], (0.28, 0, 1.2), (0.1, 0.12, 0.58))
    return B


def build_all():
    global M
    M = {
        'paint': mat('paint', (0.8, 0.8, 0.8), 0.25, 0.4), 'glass': mat('glass', (0.03, 0.04, 0.05), 0.08, 0.6),
        'rubber': mat('rubber', (0.02, 0.02, 0.02), 0.85), 'trim': mat('trim', (0.55, 0.55, 0.56), 0.3, 0.9),
        'dark': mat('dark', (0.04, 0.04, 0.045), 0.6, 0.2), 'lamp': mat('lamp', (0.9, 0.9, 0.85), 0.2, 0, emit=(1.0, 0.95, 0.8)),
        'tail': mat('tail', (0.5, 0.02, 0.02), 0.3, 0, emit=(0.8, 0.02, 0.02)), 'trailer': mat('trailer', (0.75, 0.75, 0.74), 0.5, 0.3),
        'olive': mat('olive', (0.16, 0.17, 0.11), 0.75, 0.1), 'track': mat('track', (0.06, 0.06, 0.05), 0.9, 0.3),
        'heli': mat('heli', (0.12, 0.14, 0.12), 0.6, 0.2), 'jet': mat('jet', (0.28, 0.3, 0.32), 0.45, 0.35),
        'bark': mat('bark', (0.09, 0.07, 0.05), 0.95), 'leaf': mat('leaf', (0.07, 0.13, 0.04), 0.85), 'leaf2': mat('leaf2', (0.09, 0.15, 0.05), 0.85),
        'needle': mat('needle', (0.03, 0.08, 0.04), 0.9), 'pole': mat('pole', (0.25, 0.26, 0.27), 0.5, 0.7),
        'bulb': mat('bulb', (1, 0.95, 0.8), 0.2, 0, emit=(1.0, 0.82, 0.55)), 'bulb_red': mat('bulb_red', (1, 0.1, 0.05), 0.3, 0, emit=(1, 0.05, 0.02)),
        'metal': mat('metal', (0.45, 0.46, 0.47), 0.45, 0.8), 'wood': mat('wood', (0.25, 0.17, 0.1), 0.9),
        'crane': mat('crane', (0.65, 0.1, 0.06), 0.55, 0.3), 'cloth': mat('cloth', (0.3, 0.3, 0.32), 0.9),
        'jeans': mat('jeans', (0.08, 0.1, 0.16), 0.9), 'skin': mat('skin', (0.55, 0.38, 0.28), 0.6),
    }
    col = bpy.context.scene.collection
    builders = [sedan(), suv(), van(), bus(), truck(), tank(), tank_turret(), heli(), heli_rotor(), tail_rotor(), jet(), missile(),
                tree('round', 1), tree('conifer', 2), tree('street', 3), streetlight(), traffic_light(), ac_unit(), water_tower(),
                antenna(), crane(), person()]
    objs = []
    for i, b in enumerate(builders):
        objs += b.emit(col, offset=((i % 6) * 30, (i // 6) * 40, 0))
    return objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default=None)
    args = ap.parse_args(sys.argv[1:])
    butil.reset()
    objs = build_all()
    # export at the origin: each object keeps its own name; the game reads offsets from 0
    for o in objs:
        o['grid'] = list(o.location)
    if args.preview:
        butil.preview(args.preview, (75, 60, 2), 260, 120, angle=20, samples=24, target_z=0, lens=40)
    for o in objs:
        o.location = (0, 0, 0)
    butil.activate(objs[0], objs)
    out = os.path.join(ASSETS, 'props.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_animations=False, export_materials='EXPORT', export_extras=False)
    print('wrote', out, os.path.getsize(out) / 1e6, 'MB', len(objs), 'objects')


if __name__ == '__main__':
    main()
