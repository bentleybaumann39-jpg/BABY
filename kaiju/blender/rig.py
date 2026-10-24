"""Armature construction, a small FK/IK pose solver and action baking.

Animations are authored as Python functions of time that describe a pose:
world-aligned rotation deltas per bone, root/hip offsets, and two-bone IK goals
for limbs. The solver turns that into each bone's local basis and keyframes it,
so the exported glTF holds plain baked rotations (no constraints).
"""
import math
import bpy
from mathutils import Matrix, Vector, Quaternion, Euler


class Skeleton:
    def __init__(self):
        self.bones = []  # (name, parent, head, tail)

    def bone(self, name, parent, head, tail, mirror=False):
        self.bones.append((name, parent, tuple(head), tuple(tail)))
        if mirror:
            mh = (-head[0], head[1], head[2])
            mt = (-tail[0], tail[1], tail[2])
            mp = parent[:-2] + '.R' if parent and parent.endswith('.L') else parent
            self.bones.append((name[:-2] + '.R', mp, mh, mt))
        return name

    def names(self):
        return [b[0] for b in self.bones]


def build_armature(skel, name='Armature'):
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    for n, parent, h, t in skel.bones:
        b = eb.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        d = (b.tail - b.head).normalized()
        b.align_roll(Vector((0, -1, 0)) if abs(d.z) > 0.7 else Vector((0, 0, 1)))
        b.use_deform = True
    for n, parent, h, t in skel.bones:
        if parent:
            eb[n].parent = eb[parent]
            eb[n].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in obj.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return obj


class Pose:
    """One frame's pose request. Angles in degrees about armature (rest) axes:
    X = pitch (+ swings a bone pointing forward downward / a leg backward),
    Y = roll, Z = yaw (+ turns toward the creature's left, +X)."""

    def __init__(self):
        self.rots = {}
        self.locs = {}
        self.iks = []    # (upper, lower, target, pole)
        self.aims = {}   # bone -> (dir, up) armature-space orientation

    def rot(self, bone, x=0.0, y=0.0, z=0.0):
        r = self.rots.get(bone, (0.0, 0.0, 0.0))
        self.rots[bone] = (r[0] + x, r[1] + y, r[2] + z)
        return self

    def loc(self, bone, v):
        o = self.locs.get(bone, (0.0, 0.0, 0.0))
        self.locs[bone] = (o[0] + v[0], o[1] + v[1], o[2] + v[2])
        return self

    def ik(self, upper, lower, target, pole):
        self.iks.append((upper, lower, Vector(target), Vector(pole)))
        return self

    def aim(self, bone, direction, up=None):
        self.aims[bone] = (Vector(direction).normalized(), Vector(up) if up else None)
        return self


class Solver:
    def __init__(self, obj):
        self.obj = obj
        self.rest = {b.name: b.matrix_local.copy() for b in obj.data.bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in obj.data.bones}
        self.length = {b.name: b.length for b in obj.data.bones}
        self.order = [b.name for b in obj.data.bones]  # Blender keeps parents before children
        self.children = {n: [] for n in self.order}
        for n, p in self.parent.items():
            if p:
                self.children[p].append(n)
        # rest hinge axis for every bone that has a single child (used by IK twist)
        self.hinge = {}

    def rel(self, n):
        p = self.parent[n]
        return self.rest[n] if p is None else self.rest[p].inverted() @ self.rest[n]

    def solve(self, pose):
        """Returns {bone: (location Vector, rotation Quaternion)} local bases."""
        pm = {}
        basis = {}
        ik_upper = {u: (u, l, t, pl) for u, l, t, pl in pose.iks}
        ik_lower = {l: True for u, l, t, pl in pose.iks}
        pending_lower = {}
        for n in self.order:
            p = self.parent[n]
            parent_m = Matrix.Identity(4) if p is None else pm[p]
            base = parent_m @ self.rel(n)  # pose matrix with identity basis
            if n in pending_lower:
                want = pending_lower.pop(n)
                b = base.inverted() @ want
                loc, rot, _ = b.decompose()
                basis[n] = (Vector((0, 0, 0)), rot)
                pm[n] = base @ Matrix.Translation(Vector((0, 0, 0))) @ rot.to_matrix().to_4x4()
                continue
            if n in ik_upper:
                u, l, T, pole = ik_upper[n]
                head = base.translation.copy()
                want_u, want_l = self._ik(u, l, head, T, pole, base)
                b = base.inverted() @ want_u
                _, rot, _ = b.decompose()
                basis[n] = (Vector((0, 0, 0)), rot)
                pm[n] = base @ rot.to_matrix().to_4x4()
                pending_lower[l] = want_l
                continue
            if n in pose.aims:
                d, up = pose.aims[n]
                want = self._aim(n, base.translation.copy(), d, up)
                b = base.inverted() @ want
                _, rot, _ = b.decompose()
                basis[n] = (Vector((0, 0, 0)), rot)
                pm[n] = base @ rot.to_matrix().to_4x4()
                continue
            R = self.rest[n].to_3x3()
            Ri = R.inverted()
            e = pose.rots.get(n)
            q = Quaternion()
            if e:
                qw = Euler((math.radians(e[0]), math.radians(e[1]), math.radians(e[2])), 'XYZ').to_matrix()
                q = (Ri @ qw @ R).to_quaternion()
            loc = Vector((0, 0, 0))
            if n in pose.locs:
                loc = Ri @ Vector(pose.locs[n])
            basis[n] = (loc, q)
            pm[n] = base @ Matrix.Translation(loc) @ q.to_matrix().to_4x4()
        self.last_pm = pm
        return basis

    def _frame(self, y, hinge):
        y = y.normalized()
        x = hinge - y * hinge.dot(y)
        if x.length < 1e-6:
            x = Vector((1, 0, 0)) - y * y.x
        x.normalize()
        z = x.cross(y)
        return Matrix((x, y, z)).transposed()  # columns x, y, z

    def _rest_hinge(self, u, l):
        yu = self.rest[u].to_3x3() @ Vector((0, 1, 0))
        yl = self.rest[l].to_3x3() @ Vector((0, 1, 0))
        h = yu.cross(yl)
        if h.length < 1e-4:
            h = Vector((1, 0, 0))
        return h.normalized()

    def _orient(self, n, ydir, hinge_rest, hinge_want):
        """Pose rotation (armature space 3x3) mapping the rest frame so its Y follows ydir."""
        R = self.rest[n].to_3x3()
        yr = R @ Vector((0, 1, 0))
        Fr = self._frame(yr, hinge_rest)
        Fd = self._frame(ydir, hinge_want)
        return Fd @ Fr.inverted() @ R

    def _ik(self, u, l, H, T, pole, base_u):
        L1, L2 = self.length[u], self.length[l]
        v = T - H
        d = max(min(v.length, L1 + L2 - 1e-3), abs(L1 - L2) + 1e-3)
        dirn = v.normalized()
        n = (pole - H)
        n = n - dirn * n.dot(dirn)
        if n.length < 1e-6:
            n = Vector((0, -1, 0))
        n.normalize()
        ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
        a = math.acos(max(-1.0, min(1.0, ca)))
        ud = dirn * math.cos(a) + n * math.sin(a)
        K = H + ud * L1
        ld = (H + dirn * d - K).normalized()
        hr = self._rest_hinge(u, l)
        hw = ud.cross(ld)
        if hw.length < 1e-4:
            hw = dirn.cross(n)
        hw.normalize()
        Ru = self._orient(u, ud, hr, hw)
        Rl = self._orient(l, ld, hr, hw)
        mu = Matrix.Translation(H) @ Ru.to_4x4()
        ml = Matrix.Translation(K) @ Rl.to_4x4()
        return mu, ml

    def _aim(self, n, head, d, up):
        R = self.rest[n].to_3x3()
        yr = R @ Vector((0, 1, 0))
        up_rest = Vector((0, -1, 0)) if abs(yr.z) > 0.7 else Vector((0, 0, 1))
        hr = up_rest.cross(yr)
        hw = (up if up is not None else up_rest).cross(d)
        if hw.length < 1e-5:
            hw = hr
        Rw = self._frame(d, hw.normalized()) @ self._frame(yr, hr.normalized()).inverted() @ R
        return Matrix.Translation(head) @ Rw.to_4x4()

    def world_point(self, bone, local=(0, 1, 0)):
        """Armature-space point on a posed bone (local Y=1 is the tail) after solve()."""
        m = self.last_pm[bone]
        v = Vector(local)
        v.y *= self.length[bone]
        return m @ v


def bake_action(obj, solver, name, fn, duration, fps=30, loop=False, loc_bones=('root', 'hips')):
    """Samples fn(t, Pose) over the clip and keyframes every bone."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    obj.animation_data_create()
    obj.animation_data.action = act
    frames = int(round(duration * fps))
    prev = {}
    for f in range(frames + 1):
        t = f / fps
        if loop:
            t = (f % frames) / fps  # last frame equals first frame exactly
        pose = Pose()
        fn(t, duration, pose)
        basis = solver.solve(pose)
        for n, (loc, q) in basis.items():
            pb = obj.pose.bones[n]
            if n in prev and prev[n].dot(q) < 0:
                q = -q
            prev[n] = q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f + 1, group=n)
            if n in loc_bones:
                pb.location = loc
                pb.keyframe_insert('location', frame=f + 1, group=n)
    track = obj.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, act)
    strip.name = name
    obj.animation_data.action = None
    for pb in obj.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    return act


# ----------------------------------------------------------------------------- gait helpers

def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def env(t, a, b, c, d):
    """Trapezoid envelope: 0 before a, ramps to 1 by b, holds to c, back to 0 by d."""
    if t <= a or t >= d:
        return 0.0
    if t < b:
        return smooth((t - a) / max(b - a, 1e-6))
    if t <= c:
        return 1.0
    return 1.0 - smooth((t - c) / max(d - c, 1e-6))


def foot_cycle(phase, stride, lift, duty=0.6):
    """Foot path over one gait cycle. phase in [0,1). Returns (forward offset, height, swing 0..1).
    Stance (duty fraction): foot planted, slides backward from +stride/2 to -stride/2.
    Swing: lifts and travels forward. Forward is -Y in Blender, returned as a signed distance."""
    phase %= 1.0
    if phase < duty:
        s = phase / duty
        return stride * (0.5 - s), 0.0, 0.0
    s = (phase - duty) / (1 - duty)
    e = 0.5 - 0.5 * math.cos(math.pi * s)
    return stride * (-0.5 + e), lift * math.sin(math.pi * s) ** 0.8, s
