"""Hard-surface creature parts built as plain vertex/face lists: teeth, claws, horns,
spikes, dorsal plates, eyes. Every part is rigidly bound to a single bone."""
import math
import numpy as np


def _basis(d):
    d = np.asarray(d, float)
    d = d / np.linalg.norm(d)
    t = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    u = np.cross(d, t)
    u /= np.linalg.norm(u)
    v = np.cross(d, u)
    return d, u, v


class Parts:
    def __init__(self):
        self.verts = []
        self.faces = []
        self.vbone = []
        self.fmat = []
        self.vcol = []
        self.mats = []

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def _emit(self, V, F, bone, mat, col=None):
        o = len(self.verts)
        mi = self._mat(mat)
        for i, v in enumerate(V):
            self.verts.append(tuple(v))
            self.vbone.append(bone)
            self.vcol.append(col[i] if col is not None else (1, 1, 1, 1))
        for f in F:
            self.faces.append(tuple(o + i for i in f))
            self.fmat.append(mi)

    def horn(self, base, direction, length, radius, bend=(0, 0, 0), bone=None, mat='keratin',
             seg=7, rings=6, flat=1.0, tip=0.04):
        """Curved cone; bend is a vector the tip is pulled toward (metres at the tip)."""
        d, u, v = _basis(direction)
        base = np.asarray(base, float)
        bend = np.asarray(bend, float)
        V, F, C = [], [], []
        for r in range(rings + 1):
            s = r / rings
            c = base + d * length * s + bend * s * s
            rad = radius * (1 - s) ** 0.9 + radius * tip
            for k in range(seg):
                a = 2 * math.pi * k / seg
                V.append(c + rad * (math.cos(a) * u + flat * math.sin(a) * v))
                g = 0.55 + 0.45 * s
                C.append((g, g, g, 1))
        tip_i = len(V)
        V.append(base + d * length + bend)
        C.append((1, 1, 1, 1))
        bottom = len(V)
        V.append(base - d * radius * 0.3)
        C.append((0.4, 0.4, 0.4, 1))
        for r in range(rings):
            for k in range(seg):
                a, b = r * seg + k, r * seg + (k + 1) % seg
                F.append((a, b, b + seg, a + seg))
        for k in range(seg):
            F.append((rings * seg + k, rings * seg + (k + 1) % seg, tip_i))
            F.append(((k + 1) % seg, k, bottom))
        self._emit(V, F, bone, mat, C)

    def plate(self, base, up, fwd, height, length, thick, bone=None, mat='plate', lobes=3, seed=0, lean=0.25):
        """Jagged dorsal plate: a lens-shaped solid whose outline has several pointed lobes."""
        rng = np.random.default_rng(seed)
        up = np.asarray(up, float) / np.linalg.norm(up)
        fwd = np.asarray(fwd, float)
        fwd = fwd - up * fwd.dot(up)
        fwd /= np.linalg.norm(fwd)
        side = np.cross(up, fwd)
        base = np.asarray(base, float)
        # outline in (forward, up) plane, from front base around the top to the back base
        pts = []
        n = 40
        for i in range(n + 1):
            s = i / n
            ang = math.pi * s
            x = -math.cos(ang) * length * 0.5
            y = math.sin(ang) ** 0.75 * height
            fr = (s * lobes + 0.15) % 1.0
            lob = (1 - abs(2 * fr - 1)) ** 0.65
            y *= 0.5 + 0.5 * lob
            x += -lean * y  # sweep back
            x += rng.normal() * 0.02 * length
            pts.append((x, y))
        pts = np.array(pts)
        V, F, C = [], [], []
        # rim
        for x, y in pts:
            V.append(base + fwd * x + up * y)
            C.append((1, 1, 1, 1))
        rim = len(pts)
        # two inner rings on each side for a lens profile
        centre = np.array([pts[:, 0].mean() * 0.8, height * 0.28])
        layers = []
        for sgn in (1, -1):
            for t, w in ((0.55, 0.8), (0.2, 1.0)):
                start = len(V)
                for x, y in pts:
                    q = centre + (np.array([x, y]) - centre) * t
                    V.append(base + fwd * q[0] + up * q[1] + side * sgn * thick * w * (1 - 0.5 * (q[1] / height)))
                    g = 0.35 + 0.65 * (q[1] / height)
                    C.append((g, g, g, 1))
                layers.append(start)
        # faces: rim -> ring1 -> ring2 for each side
        for side_i in range(2):
            a0 = 0
            r1 = layers[side_i * 2]
            r2 = layers[side_i * 2 + 1]
            for ring_a, ring_b in ((a0, r1), (r1, r2)):
                for i in range(rim - 1):
                    q = (ring_a + i, ring_a + i + 1, ring_b + i + 1, ring_b + i)
                    F.append(q if side_i == 0 else q[::-1])
        # close the base between the two inner-most rings
        r2a, r2b = layers[1], layers[3]
        for i in range(rim - 1):
            F.append((r2a + i + 1, r2a + i, r2b + i, r2b + i + 1))
        F.append((0, r2a, r2b))
        self._emit(V, F, bone, mat, C)

    def sphere(self, c, r, bone=None, mat='eye', seg=12, rings=8, col=(1, 1, 1, 1)):
        c = np.asarray(c, float)
        V, F = [], []
        for i in range(1, rings):
            th = math.pi * i / rings
            for k in range(seg):
                ph = 2 * math.pi * k / seg
                V.append(c + r * np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)]))
        top, bot = len(V), len(V) + 1
        V.append(c + np.array([0, 0, r]))
        V.append(c - np.array([0, 0, r]))
        for i in range(rings - 2):
            for k in range(seg):
                a, b = i * seg + k, i * seg + (k + 1) % seg
                F.append((a, a + seg, b + seg, b))
        for k in range(seg):
            F.append((top, k, (k + 1) % seg))
            last = (rings - 2) * seg
            F.append((bot, last + (k + 1) % seg, last + k))
        self._emit(V, F, bone, mat, [col] * len(V))

    def row_of_teeth(self, a, b, n, length, radius, direction, bone, rng, mat='keratin', curve=0.25):
        a, b = np.asarray(a, float), np.asarray(b, float)
        direction = np.asarray(direction, float)
        for i in range(n):
            s = (i + 0.5) / n
            p = a + (b - a) * s
            L = length * (0.65 + 0.35 * math.sin(math.pi * min(1, s * 1.3))) * rng.uniform(0.8, 1.15)
            back = (a - b) / np.linalg.norm(a - b)
            self.horn(p, direction, L, radius * rng.uniform(0.85, 1.1), bend=back * L * curve, bone=bone, mat=mat,
                      seg=6, rings=3, tip=0.02)

    def merge(self, B):
        for m in B.mats:
            self._mat(m)
        o = len(self.verts)
        self.verts += B.verts
        self.vbone += B.vbone
        self.vcol += B.vcol
        for f, mi in zip(B.faces, B.fmat):
            self.faces.append(tuple(o + i for i in f))
            self.fmat.append(self.mats.index(B.mats[mi]))

    def mirrored(self):
        """Mirror every part across X=0 (bone names .L <-> .R)."""
        from sdf import mirror_name
        n = len(self.verts)
        nf = len(self.faces)
        for i in range(n):
            x, y, z = self.verts[i]
            self.verts.append((-x, y, z))
            self.vbone.append(mirror_name(self.vbone[i]))
            self.vcol.append(self.vcol[i])
        for j in range(nf):
            self.faces.append(tuple(n + i for i in self.faces[j][::-1]))
            self.fmat.append(self.fmat[j])


# ----------------------------------------------------------------------------- surface helpers

def normal_at(S, p, h=0.15):
    p = np.asarray(p, float)
    e = np.eye(3) * h
    g = np.array([S.eval_points([p + e[i]])[0] - S.eval_points([p - e[i]])[0] for i in range(3)])
    return g / (np.linalg.norm(g) + 1e-9)


def bone_at(S, p):
    d, adds = S.nearest(np.asarray([p], float))
    order = np.argsort(d[0])
    for j in order:
        if adds[j].bone:
            return adds[j].bone
    return None


def on_surface(S, x, y, top=120.0, dirn=(0, 0, -1)):
    """Surface point hit by a ray cast downward (by default) through (x, y)."""
    return S.surface((x, y, top), dirn, far=top + 10, step=0.08)
