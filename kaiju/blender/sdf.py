"""Signed-distance-field sculpting for kaiju bodies.

A creature is a list of primitives (tapered capsules and ellipsoids) blended with
smooth unions, carved with smooth subtractions, and roughened with fractal noise.
The field is sampled on a voxel grid and polygonised with marching cubes. Each
primitive names the bone it belongs to and a material tag; the same primitive
list is re-evaluated at mesh vertices to derive skin weights and colour masks.

Units are metres, Blender axes (Z up, the creature faces -Y, its left is +X).
"""
import math
import numpy as np


# ----------------------------------------------------------------------------- noise

class Noise:
    """Vectorised 3D gradient (Perlin) noise with fBm and ridged variants."""

    _G = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
                   [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], np.float32)

    def __init__(self, seed=1):
        p = np.random.default_rng(seed).permutation(256).astype(np.int32)
        self.p = np.concatenate([p, p, p[:2]])

    def perlin(self, x, y, z):
        p, G = self.p, self._G
        xi, yi, zi = np.floor(x), np.floor(y), np.floor(z)
        xf, yf, zf = (x - xi).astype(np.float32), (y - yi).astype(np.float32), (z - zi).astype(np.float32)
        X, Y, Z = xi.astype(np.int64) & 255, yi.astype(np.int64) & 255, zi.astype(np.int64) & 255
        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        w = zf * zf * zf * (zf * (zf * 6 - 15) + 10)

        def g(ix, iy, iz, dx, dy, dz):
            h = p[p[p[ix] + iy] + iz] % 12
            gr = G[h]
            return gr[..., 0] * dx + gr[..., 1] * dy + gr[..., 2] * dz

        n000 = g(X, Y, Z, xf, yf, zf)
        n100 = g(X + 1, Y, Z, xf - 1, yf, zf)
        n010 = g(X, Y + 1, Z, xf, yf - 1, zf)
        n110 = g(X + 1, Y + 1, Z, xf - 1, yf - 1, zf)
        n001 = g(X, Y, Z + 1, xf, yf, zf - 1)
        n101 = g(X + 1, Y, Z + 1, xf - 1, yf, zf - 1)
        n011 = g(X, Y + 1, Z + 1, xf, yf - 1, zf - 1)
        n111 = g(X + 1, Y + 1, Z + 1, xf - 1, yf - 1, zf - 1)
        x00 = n000 + u * (n100 - n000)
        x10 = n010 + u * (n110 - n010)
        x01 = n001 + u * (n101 - n001)
        x11 = n011 + u * (n111 - n011)
        y0 = x00 + v * (x10 - x00)
        y1 = x01 + v * (x11 - x01)
        return y0 + w * (y1 - y0)

    def fbm(self, P, freq, octaves=4, lac=2.03, gain=0.5):
        x, y, z = P[:, 0] * freq, P[:, 1] * freq, P[:, 2] * freq
        out = np.zeros(len(P), np.float32)
        a = 1.0
        for o in range(octaves):
            out += a * self.perlin(x + o * 17.3, y - o * 9.1, z + o * 5.7)
            x, y, z = x * lac, y * lac, z * lac
            a *= gain
        return out

    def ridged(self, P, freq, octaves=3, lac=2.1, gain=0.55):
        x, y, z = P[:, 0] * freq, P[:, 1] * freq, P[:, 2] * freq
        out = np.zeros(len(P), np.float32)
        a = 1.0
        for o in range(octaves):
            n = 1.0 - np.abs(self.perlin(x + o * 3.1, y + o * 7.7, z - o * 1.3))
            out += a * n * n
            x, y, z = x * lac, y * lac, z * lac
            a *= gain
        return out


# ----------------------------------------------------------------------------- primitives

def _rot(deg):
    rx, ry, rz = (math.radians(a) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


class Prim:
    __slots__ = ('kind', 'a', 'b', 'r1', 'r2', 'R', 'radii', 'bone', 'k', 'mat', 'op', 'lo', 'hi', 'bias')

    def bounds(self, pad):
        return self.lo - pad, self.hi + pad

    def dist(self, P):
        """Signed distance for an (N,3) array of points."""
        if self.kind == 'cone':
            return _round_cone(P, self.a, self.b, self.r1, self.r2)
        q = (P - self.a) @ self.R  # into ellipsoid frame (R columns are its axes)
        r = self.radii
        k0 = np.linalg.norm(q / r, axis=1)
        k1 = np.linalg.norm(q / (r * r), axis=1)
        return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def _round_cone(P, a, b, r1, r2):
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = P - a
    y = pa @ ba
    z = y - l2
    t = pa * l2 - np.outer(y, ba)
    x2 = np.einsum('ij,ij->i', t, t)
    y2 = y * y * l2
    z2 = z * z * l2
    k = math.copysign(1.0, rr) * rr * rr * x2
    d = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1
    m1 = np.sign(z) * a2 * z2 > k
    m2 = (np.sign(y) * a2 * y2 < k) & ~m1
    d = np.where(m1, np.sqrt(x2 + z2) * il2 - r2, d)
    d = np.where(m2, np.sqrt(x2 + y2) * il2 - r1, d)
    return d


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


MIRROR = {'.L': '.R', '.R': '.L'}


def mirror_name(n):
    if n is None:
        return None
    for s, t in MIRROR.items():
        if n.endswith(s):
            return n[:-2] + t
    return n


class Sculpt:
    """Collects primitives. Coordinates are tuples in metres (Blender axes)."""

    def __init__(self):
        self.prims = []
        self.noise_layers = []  # (fn(P) -> displacement in metres)

    def _add(self, p, mirror):
        self.prims.append(p)
        if mirror and abs(p.a[0]) + (abs(p.b[0]) if p.b is not None else 0) > 1e-6:
            m = Prim()
            for s in Prim.__slots__:
                setattr(m, s, getattr(p, s))
            m.a = p.a * np.array([-1, 1, 1])
            if p.b is not None:
                m.b = p.b * np.array([-1, 1, 1])
            if p.R is not None:
                F = np.diag([-1.0, 1.0, 1.0])
                m.R = F @ p.R @ F
            m.bone = mirror_name(p.bone)
            _set_bounds(m)
            self.prims.append(m)
        return p

    def cone(self, a, b, r1, r2=None, bone=None, k=1.0, mat='skin', op='add', mirror=False, bias=0.0):
        p = Prim()
        p.kind, p.a, p.b = 'cone', np.array(a, float), np.array(b, float)
        p.r1, p.r2 = float(r1), float(r1 if r2 is None else r2)
        p.R = None
        p.radii = None
        p.bone, p.k, p.mat, p.op, p.bias = bone, k, mat, op, bias
        _set_bounds(p)
        return self._add(p, mirror)

    def ell(self, c, radii, rot=(0, 0, 0), bone=None, k=1.0, mat='skin', op='add', mirror=False, bias=0.0):
        p = Prim()
        p.kind, p.a, p.b = 'ell', np.array(c, float), None
        p.radii = np.array(radii, float)
        p.R = _rot(rot)
        p.r1 = p.r2 = float(max(radii))
        p.bone, p.k, p.mat, p.op, p.bias = bone, k, mat, op, bias
        _set_bounds(p)
        return self._add(p, mirror)

    def ellx(self, c, xdir, ydir, radii, bone=None, k=1.0, mat='skin', op='add', mirror=False, bias=0.0):
        """Ellipsoid with explicit axes: radii[0] along xdir, radii[1] along ydir (made orthogonal
        to xdir), radii[2] along their cross product. Handy for flat crests, fins and webbing."""
        X = np.asarray(xdir, float)
        X = X / np.linalg.norm(X)
        Y = np.asarray(ydir, float)
        Y = Y - X * (Y @ X)
        Y = Y / np.linalg.norm(Y)
        Z = np.cross(X, Y)
        p = Prim()
        p.kind, p.a, p.b = 'ell', np.array(c, float), None
        p.radii = np.array(radii, float)
        p.R = np.stack([X, Y, Z], 1)
        p.r1 = p.r2 = float(max(radii))
        p.bone, p.k, p.mat, p.op, p.bias = bone, k, mat, op, bias
        _set_bounds(p)
        return self._add(p, mirror)

    def blade(self, a, b, wdir, widths, thick, n=6, bone=None, k=0.6, mat='skin', mirror=False, bias=0.0):
        """A flat tapering sheet from a to b, `widths` (start, end) across wdir, `thick` (start, end)
        through it, built from overlapping oriented ellipsoids. bone may be a list (one per piece)."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        L = np.linalg.norm(b - a)
        for i in range(n):
            s = (i + 0.5) / n
            w = widths[0] + (widths[1] - widths[0]) * s
            t = thick[0] + (thick[1] - thick[0]) * s
            bn = bone[i] if isinstance(bone, (list, tuple)) else bone
            self.ellx(a + (b - a) * s, b - a, wdir, (L / n * 1.35, w, t), bone=bn, k=k, mat=mat, mirror=mirror, bias=bias)

    def tri(self, p0, p1, p2, thick, n=6, bone=None, k=0.4, mat='skin', mirror=False, sag=0.0):
        """A thin membrane filling the triangle p0-p1-p2 (a wing web), tiled with flat ellipsoids
        lying in its plane. bone may be a function of the piece centre returning a bone name.
        sag bows the membrane along its normal (metres at the centre)."""
        p0, p1, p2 = (np.asarray(p, float) for p in (p0, p1, p2))
        nrm = np.cross(p1 - p0, p2 - p0)
        nrm /= np.linalg.norm(nrm)
        e = p1 - p0
        cell = max(np.linalg.norm(p1 - p0), np.linalg.norm(p2 - p0), np.linalg.norm(p2 - p1)) / n
        for i in range(n):
            for j in range(n - i):
                for flip in ((0,) if j == n - i - 1 else (0, 1)):
                    if flip == 0:
                        a, b = (i + 1 / 3) / n, (j + 1 / 3) / n
                    else:
                        a, b = (i + 2 / 3) / n, (j + 2 / 3) / n
                    c = p0 + (p1 - p0) * a + (p2 - p0) * b
                    w0 = 1 - a - b
                    c = c + nrm * sag * 27.0 * max(0.0, w0 * a * b)  # 1 at the centroid
                    bn = bone(c) if callable(bone) else bone
                    self.ellx(c, e, np.cross(nrm, e), (cell * 0.75, cell * 0.75, thick), bone=bn, k=k, mat=mat,
                              mirror=mirror)

    def chain(self, pts, radii, bones, k=1.0, mat='skin', mirror=False):
        """Tapered capsules through successive points; bones[i] owns segment i."""
        for i in range(len(pts) - 1):
            self.cone(pts[i], pts[i + 1], radii[i], radii[i + 1], bone=bones[i], k=k, mat=mat, mirror=mirror)

    # ------------------------------------------------------------------ evaluation

    def adds(self):
        return [p for p in self.prims if p.op == 'add']

    def eval_grid(self, voxel, pad=2.0, noise=None, band=2.5, log=print):
        adds = self.adds()
        lo = np.min([p.lo for p in adds], axis=0) - pad
        hi = np.max([p.hi for p in adds], axis=0) + pad
        n = np.ceil((hi - lo) / voxel).astype(int) + 1
        log(f'  grid {n[0]}x{n[1]}x{n[2]} = {n.prod() / 1e6:.1f}M voxels @ {voxel} m')
        D = np.full(tuple(n), 1e3, np.float32)
        axes = [lo[i] + np.arange(n[i]) * voxel for i in range(3)]
        for p in self.prims:
            plo, phi = p.bounds(p.k + 3 * voxel + (0 if p.op == 'add' else 0.5))
            i0 = np.clip(np.floor((plo - lo) / voxel).astype(int), 0, n - 1)
            i1 = np.clip(np.ceil((phi - lo) / voxel).astype(int) + 1, 0, n)
            if np.any(i1 <= i0):
                continue
            gx, gy, gz = np.meshgrid(axes[0][i0[0]:i1[0]], axes[1][i0[1]:i1[1]], axes[2][i0[2]:i1[2]], indexing='ij')
            P = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], 1)
            d = p.dist(P).astype(np.float32).reshape(gx.shape)
            sl = (slice(i0[0], i1[0]), slice(i0[1], i1[1]), slice(i0[2], i1[2]))
            if p.op == 'add':
                D[sl] = smin(D[sl], d, p.k)
            else:
                D[sl] = smax(D[sl], -d, p.k)
        if noise is not None:
            idx = np.nonzero(np.abs(D) < band)
            P = np.stack([axes[0][idx[0]], axes[1][idx[1]], axes[2][idx[2]]], 1)
            D[idx] += noise(P).astype(np.float32)
        return D, lo

    def eval_points(self, P):
        """Field value (without noise) at an (N,3) array of points."""
        P = np.asarray(P, float)
        D = np.full(len(P), 1e3)
        for p in self.prims:
            d = p.dist(P)
            D = smin(D, d, p.k) if p.op == 'add' else smax(D, -d, p.k)
        return D

    def surface(self, origin, direction, far=200.0, step=0.1):
        """First surface hit marching from origin along direction (None if missed)."""
        o = np.asarray(origin, float)
        d = np.asarray(direction, float)
        d = d / np.linalg.norm(d)
        ts = np.arange(0, far, step)
        vals = self.eval_points(o[None] + ts[:, None] * d[None])
        hit = np.nonzero(vals < 0)[0]
        if len(hit) == 0:
            return None
        i = hit[0]
        if i == 0:
            return o
        a, b = vals[i - 1], vals[i]
        t = ts[i - 1] + step * a / (a - b)
        return o + d * t

    def nearest(self, P, chunk=200000):
        """Per point: distance to every additive primitive (N, M) in float32."""
        adds = self.adds()
        out = np.empty((len(P), len(adds)), np.float32)
        for s in range(0, len(P), chunk):
            Q = P[s:s + chunk]
            for j, p in enumerate(adds):
                out[s:s + chunk, j] = p.dist(Q) - p.bias
        return out, adds


def _set_bounds(p):
    if p.kind == 'cone':
        lo = np.minimum(p.a - p.r1, p.b - p.r2)
        hi = np.maximum(p.a + p.r1, p.b + p.r2)
    else:
        # bound of a rotated ellipsoid: half extent along world axis i = |R_i * radii|
        ext = np.sqrt(((p.R * p.radii) ** 2).sum(1))
        lo, hi = p.a - ext, p.a + ext
    p.lo, p.hi = lo, hi


def polygonise(D, lo, voxel):
    from skimage.measure import marching_cubes
    verts, faces, _, _ = marching_cubes(D, 0.0, spacing=(voxel, voxel, voxel), allow_degenerate=False)
    verts = verts + lo
    # keep the largest connected component only (drops stray noise islands)
    faces = _largest_component(verts, faces)
    used, inv = np.unique(faces.ravel(), return_inverse=True)
    verts, faces = verts[used], inv.reshape(-1, 3)
    # orient outward: positive signed volume
    v0, v1, v2 = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    vol = np.einsum('ij,ij->i', v0, np.cross(v1, v2)).sum() / 6.0
    if vol < 0:
        faces = faces[:, ::-1].copy()
    return verts.astype(np.float64), faces.astype(np.int64)


def _largest_component(verts, faces):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    n = len(verts)
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    A = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(n, n))
    nc, lab = connected_components(A, directed=False)
    if nc > 1:
        fl = lab[faces[:, 0]]
        faces = faces[fl == np.bincount(fl).argmax()]
    return faces
