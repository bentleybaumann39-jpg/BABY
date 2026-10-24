"""CARAPEX: a six-legged alien siege-insect. A helmeted head carries two sickle mandibles and
clusters of glowing compound eyes; six jointed legs hold a ridged thorax high; a swollen,
upturned abdomen ends in a glowing bile sac that curls over its back to lob bile like a mortar.
Faces -Y, metres (~40 m to the knees, ~75 m long)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'carapex'
VOXEL = 0.22
LOW_TRIS = 62000

BODY_Z = 22.0
J = dict(
    hips=(0, 8, 22.4), sp1=(0, 0, 23.2), chest=(0, -8, 23.6), head0=(0, -13, 24.4), snout=(0, -24, 21.0),
    ab0=(0, 10, 22.6), ab1=(0, 20, 25.4), ab2=(0, 29, 30.4), ab3=(0, 34, 37.4),
)
LEGS = [((5.2, -7.0, 21.0), (22.0, -26.0, 0.6)), ((6.2, -1.0, 21.0), (27.0, -2.0, 0.6)), ((5.6, 5.0, 21.0), (23.0, 20.0, 0.6))]


def V(*a):
    return np.array(a, float)


def knee_of(a, f):
    a, f = V(*a), V(*f)
    return tuple(a + (f - a) * 0.38 + V(0, 0, 15.5))


def head_frame():
    o = V(*J['head0'])
    f = V(*J['snout']) - o
    f /= np.linalg.norm(f)
    u = np.cross(V(1, 0, 0), f)
    u = -u if u[2] < 0 else u
    pitch = math.degrees(math.atan2(-f[2], -f[1]))

    def H(x, y, z):
        return tuple(o + V(1, 0, 0) * x + f * y + u * z)
    return H, pitch, f, u


def skeleton():
    s = Skeleton()
    H, _, _, _ = head_frame()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', J['hips'], J['sp1'])
    s.bone('spine1', 'hips', J['sp1'], J['chest'])
    s.bone('chest', 'spine1', J['chest'], J['head0'])
    s.bone('head', 'chest', J['head0'], J['snout'])
    s.bone('mouth', 'head', H(0, 9.0, -2.0), H(0, 11.0, -2.0))
    s.bone('mandible.L', 'head', H(3.4, 6.0, -2.2), H(0.8, 20.0, -3.6), mirror=True)
    s.bone('ant1.L', 'head', H(1.6, 3.0, 3.0), H(4.0, 9.0, 12.0), mirror=True)
    s.bone('ant2.L', 'ant1.L', H(4.0, 9.0, 12.0), H(8.0, 17.0, 17.0), mirror=True)
    s.bone('abdomen1', 'hips', J['ab0'], J['ab1'])
    s.bone('abdomen2', 'abdomen1', J['ab1'], J['ab2'])
    s.bone('abdomen3', 'abdomen2', J['ab2'], J['ab3'])
    for i, (a, f) in enumerate(LEGS):
        k = knee_of(a, f)
        s.bone(f'leg{i + 1}.L', 'chest' if i == 0 else ('spine1' if i == 1 else 'hips'), a, k, mirror=True)
        s.bone(f'leg{i + 1}lo.L', f'leg{i + 1}.L', k, f, mirror=True)
        s.bone(f'foot{i + 1}.L', f'leg{i + 1}lo.L', f, (f[0], f[1], f[2] - 0.6), mirror=True)
    return s


def sculpt():
    S = Sculpt()
    H, hp, f, u = head_frame()
    # thorax: three armoured segments
    for (y, rx, ry, rz, bn) in ((6.0, 7.0, 5.6, 5.6, 'hips'), (-0.6, 7.6, 5.4, 6.0, 'spine1'), (-7.4, 7.0, 5.0, 5.6, 'chest')):
        S.ell((0, y, BODY_Z + 1.0), (rx, ry, rz), bone=bn, k=1.6)
        S.ell((0, y - 0.6, BODY_Z + 5.4), (rx * 0.85, ry * 0.9, 2.0), bone=bn, k=1.0, mat='shell')  # dorsal tergite
    S.ell((0, -1.0, BODY_Z - 3.6), (5.0, 11.0, 2.4), bone='spine1', k=1.6, mat='belly')
    # head: a helmet with a cheek shield either side
    S.ell(H(0, 3.0, 0.6), (5.0, 5.2, 4.4), rot=(hp, 0, 0), bone='head', k=1.4)
    S.ell(H(0, 2.6, 3.2), (5.4, 6.0, 2.0), rot=(hp - 6, 0, 0), bone='head', k=1.0, mat='shell')  # helmet crown
    S.ell(H(0, 7.6, -0.8), (3.6, 3.8, 2.8), rot=(hp, 0, 0), bone='head', k=1.2)  # face
    for sx in (1, -1):
        S.ellx(H(sx * 4.6, 3.6, 0.6), (sx, 0, 0.2), f, (1.2, 4.6, 3.6), bone='head', k=0.9, mat='shell')
    S.ell(H(0, 9.4, -1.6), (2.4, 2.4, 1.2), op='sub', k=0.3, mat='mouth')
    # mandibles: thick at the hinge, curving to a point
    for sx, side in ((1, 'L'), (-1, 'R')):
        base, tip = V(*H(sx * 3.4, 6.0, -2.2)), V(*H(sx * 1.6, 16.0, -3.2))
        mid = (base + tip) / 2 + V(sx * 4.2, 0, 0)
        S.chain([base, mid, tip], [2.2, 1.5, 0.3], ['mandible.' + side] * 2, k=0.5)
    # antennae
    for sx, side in ((1, 'L'), (-1, 'R')):
        S.chain([H(sx * 1.6, 3.0, 3.0), H(sx * 4.0, 9.0, 12.0), H(sx * 8.0, 17.0, 17.0)], [0.6, 0.4, 0.15],
                ['ant1.' + side, 'ant2.' + side], k=0.3)
    # abdomen: banded, swelling and curling up to the bile sac
    S.chain([J['ab0'], J['ab1'], J['ab2'], J['ab3']], [6.4, 9.0, 7.6, 3.6], ['abdomen1', 'abdomen2', 'abdomen3'], k=1.6)
    for i, (c, r, bn) in enumerate((((0, 16, 24.8), 8.4, 'abdomen1'), ((0, 22, 27.0), 9.2, 'abdomen2'),
                                    ((0, 27.4, 29.6), 8.4, 'abdomen2'), ((0, 31.4, 33.4), 6.4, 'abdomen3'))):
        S.ell(c, (r, 2.6, r * 0.92), rot=(-30 - i * 12, 0, 0), bone=bn, k=0.8, mat='band')
    S.ell((0, 33.6, 37.6), (3.4, 3.4, 3.4), bone='abdomen3', k=1.2, mat='sac')
    # legs: tall jointed stilts with knobbed joints
    for i, (a, ft) in enumerate(LEGS):
        k = knee_of(a, ft)
        a_, k_, f_ = V(*a), V(*k), V(*ft)
        S.ell(tuple(a_ + V(0.8, 0, 0)), (2.6, 2.6, 2.4), bone=f'leg{i + 1}.L', k=0.9, mirror=True)
        S.cone(a, k, 2.2, 1.6, bone=f'leg{i + 1}.L', k=0.6, mirror=True)
        S.ell(k, (2.0, 2.0, 2.0), bone=f'leg{i + 1}lo.L', k=0.35, mirror=True)
        mid = k_ + (f_ - k_) * 0.55
        S.cone(k, tuple(mid), 1.6, 1.2, bone=f'leg{i + 1}lo.L', k=0.35, mirror=True)
        S.ell(tuple(mid), (1.35, 1.35, 1.35), bone=f'leg{i + 1}lo.L', k=0.25, mirror=True)
        S.cone(tuple(mid), ft, 1.15, 0.45, bone=f'leg{i + 1}lo.L', k=0.25, mirror=True)
    return S


_N = Noise(33)


def noise(P):
    n = 0.05 * _N.fbm(P, 0.15, 2) + 0.07 * (_N.ridged(P, 0.7, 3) - 0.55)
    return n


BILE = np.array([0.7, 1.0, 0.15])


def body_color(P, N, mats):
    n = len(P)
    chitin = np.array([0.012, 0.03, 0.03])
    under = np.array([0.08, 0.07, 0.04])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.3 + np.clip(-up - 0.35, 0, 1) * 0.5, 0, 1)
    col = chitin[None] * (1 - t[:, None]) + under[None] * t[:, None]
    # iridescent sheen bands on the shell
    shell = np.clip(mats.get('shell', 0) + mats.get('band', 0), 0, 1)
    sheen = 0.5 + 0.5 * np.sin(P[:, 1] * 0.35 + N[:, 0] * 2.0)
    col = col + (np.array([0.0, 0.03, 0.02])[None] * sheen[:, None]) * shell[:, None]
    sac = np.clip(mats.get('sac', 0) * 1.5, 0, 1)
    band = np.clip(mats.get('band', 0), 0, 1)
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - sac[:, None]) + np.array([0.25, 0.32, 0.04])[None] * sac[:, None]
    # bile glows through the soft gaps between abdominal bands, and in the sac
    abdomen = (P[:, 1] > 12) * (P[:, 2] > 15)
    rings = np.clip((np.sin(P[:, 1] * 1.05 + P[:, 2] * 0.62) - 0.86) * 9.0, 0, 1)
    gap = abdomen * rings * (1 - band * 0.7)
    g = np.clip(sac * 0.95 + gap * 0.6 + mouth * 0.5, 0, 1)
    glow = BILE[None] * g[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    P = Parts()
    rng = np.random.default_rng(71)
    H, hp, f, u = head_frame()
    L = Parts()
    # compound eye clusters
    for (x, y, z, r) in ((3.4, 6.2, 1.8, 1.0), (4.2, 4.6, 2.4, 0.8), (3.0, 7.8, 0.8, 0.7), (4.6, 6.8, 1.0, 0.6), (2.4, 5.0, 3.4, 0.6)):
        L.sphere(H(x, y, z), r, bone='head', mat='eye', seg=10, rings=7)
    # serrations inside each mandible
    for k in range(5):
        s = 0.25 + k * 0.15
        base, tip = V(*H(3.4, 6.0, -2.2)), V(*H(0.8, 20.0, -3.6))
        mid = (base + tip) / 2 + V(4.2, 0, 0)
        q = (1 - s) ** 2 * base + 2 * (1 - s) * s * mid + s * s * tip
        L.horn(q - V(0.6, 0, 0), (-1, 0.2, 0), 1.6 - k * 0.15, 0.4, bone='mandible.L', mat='horn', seg=6, rings=3)
    # leg spines and foot hooks
    for i, (a, ft) in enumerate(LEGS):
        k = V(*knee_of(a, ft))
        a_ = V(*a)
        for s in (0.4, 0.75):
            c = a_ + (k - a_) * s + V(0, 0, 1.7)
            L.horn(c, (0.4, 0, 1), 1.6, 0.5, bone=f'leg{i + 1}.L', mat='horn', seg=6, rings=3)
        L.horn(V(*ft) + V(0, 0, 0.6), (V(*ft) - k) / np.linalg.norm(V(*ft) - k), 1.8, 0.5, bend=(0, -0.4, 0),
               bone=f'leg{i + 1}lo.L', mat='horn', seg=6, rings=3)
    L.mirrored()
    P.merge(L)
    # dorsal spikes along the thorax and the bile nozzle
    for y, h in ((-8.6, 2.4), (-2.0, 3.0), (4.6, 2.6)):
        P.horn((0, y, BODY_Z + 7.0), (0, 0.4, 1), h, 0.9, bone='spine1', mat='horn', seg=7, rings=4)
    P.horn((0, 33.6, 40.2), (0, -0.3, 1), 3.0, 1.2, bone='abdomen3', mat='horn', seg=8, rings=4)
    return P


HARD = [('head', 'mandible.L'), ('head', 'mandible.R'), ('head', 'ant1.L'), ('head', 'ant1.R')]
WEIGHT_ITERS = 4

LOOK = dict(cell=1.2, wrinkle=3.6, scute=0.3, bump=0.16, cellvar=0.2, groove=0.3, wear=0.12,
            wearcol=(0.1, 0.14, 0.12), rough=0.22, cage=0.7, crag=0.35, noisew=0.3, glow=True)

PART_MATS = {
    'horn': dict(color=(0.02, 0.03, 0.03), rough=0.25),
    'eye': dict(color=(0.7, 1.0, 0.2), rough=0.05, emissive=(0.6, 1.0, 0.15), emit=3.5),
}


# ============================================================================= animation
from rig import env, smooth, foot_cycle
from mathutils import Vector

TAU = 2 * math.pi
SIDES = (('L', 1), ('R', -1))
FEET = {}
for i, (a, ft) in enumerate(LEGS):
    for side, sx in SIDES:
        FEET[(i, side)] = (Vector((ft[0] * sx, ft[1], ft[2])), Vector((a[0] * sx, a[1], a[2])))
# alternating tripods: front and back on one side with the middle on the other
TRIPOD = {(0, 'L'): 0, (2, 'L'): 0, (1, 'R'): 0, (0, 'R'): 1, (2, 'R'): 1, (1, 'L'): 1}
WALK = dict(T=2.0, stride=12.0, duty=0.56)
RUN = dict(T=1.2, stride=18.0, duty=0.5)


def leg(p, i, side, foot):
    f0, a = FEET[(i, side)]
    sx = 1 if side == 'L' else -1
    p.ik(f'leg{i + 1}.{side}', f'leg{i + 1}lo.{side}', foot, Vector((a.x + sx * 8, a.y, a.z + 50)))


def legs_rest(p, off=None):
    for (i, side), (f, a) in FEET.items():
        leg(p, i, side, f + (off(i, side) if off else Vector()))


def mandibles(p, open_=0.0):
    p.rot('mandible.L', z=open_)
    p.rot('mandible.R', z=-open_)


def antennae(p, t, amp=1.0, up=0.0):
    for side, sx in SIDES:
        p.rot('ant1.' + side, x=-up + 6 * amp * math.sin(TAU * 0.7 * t + sx), z=sx * 5 * amp * math.sin(TAU * 0.5 * t))
        p.rot('ant2.' + side, x=8 * amp * math.sin(TAU * 1.1 * t + 1 + sx))


def abdomen(p, curl=0.0, sway=0.0):
    """curl > 0 arches the abdomen up and forward over the back."""
    for i, b in enumerate(('abdomen1', 'abdomen2', 'abdomen3')):
        p.rot(b, x=curl * (0.6 + 0.4 * i), z=sway * (1 + i))


def gait(ph, p, G, bob):
    for (i, side), (f, a) in FEET.items():
        g = TRIPOD[(i, side)]
        fw, h, sw = foot_cycle(ph + 0.5 * g + 0.03 * i, G['stride'], 4.0, G['duty'])
        leg(p, i, side, f + Vector((0, -fw, h)))
    c2 = math.cos(2 * TAU * ph)
    p.loc('hips', (0.4 * math.sin(TAU * ph), 0, -bob * 0.5 * (1 + c2)))
    p.rot('hips', y=1.6 * math.sin(TAU * ph))
    p.rot('head', z=2 * math.sin(TAU * ph), x=1.5 * c2)
    mandibles(p, 3 + 3 * math.sin(TAU * 2 * ph))
    antennae(p, ph * 2)
    abdomen(p, 0.0, 1.5 * math.sin(TAU * ph - 1.0))


def a_walk(t, T, p):
    gait(t / T, p, WALK, 0.5)


def a_run(t, T, p):
    gait(t / T, p, RUN, 0.9)
    p.rot('hips', x=4)


def a_idle(t, T, p):
    ph = t / T
    legs_rest(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0, 0, 0.25 * b))
    p.rot('head', z=6 * math.sin(TAU * ph), x=2 * math.sin(TAU * 3 * ph))
    mandibles(p, 4 + 6 * max(0.0, math.sin(TAU * 3 * ph)))
    antennae(p, t, 1.4)
    abdomen(p, 3 * b, 2 * math.sin(TAU * ph))


def a_snap(t, T, p):
    w = env(t, 0.0, 0.3, 0.34, 0.42)
    s = env(t, 0.34, 0.44, 0.56, T)
    legs_rest(p)
    p.loc('hips', (0, 2.0 * w - 4.0 * s, 1.0 * w - 1.2 * s))
    p.rot('chest', x=-6 * w + 6 * s)
    p.rot('head', x=-10 * w + 12 * s)
    mandibles(p, 35 * w * (1 - s) - 6 * s)
    antennae(p, t, 1.0, up=20 * w)
    abdomen(p, -4 * w, 0)


def a_spear(t, T, p):
    w = env(t, 0.0, 0.34, 0.38, 0.48)
    s = env(t, 0.38, 0.5, 0.62, T)
    # raise the right foreleg high, then drive it forward into whatever stands in front at mid-height
    legs_rest(p, lambda i, side: Vector((0, 0, 0)) if (i, side) != (0, 'R') else
              Vector((4.0, 10.0, 24.0)) * w + Vector((2.0, -8.0, 16.0)) * s * (1 - w) + Vector((2.0, -8.0, -8.0)) * s * w)
    p.loc('hips', (0, 1.0 * w - 2.0 * s, 1.0 * w))
    p.rot('chest', z=-6 * w + 6 * s)
    p.rot('head', z=-8 * w + 6 * s)
    mandibles(p, 12 * w)
    antennae(p, t, 1.0, up=10 * w)


def a_scythe(t, T, p):
    # both forelegs rear high and come down together
    up = env(t, 0.05, 0.6, 0.68, 0.68)
    if 0.68 <= t < 0.92:
        q = (t - 0.68) / 0.24
        up = 1 - q * q
    elif t >= 0.92:
        up = 0.0
    imp = env(t, 0.9, 0.95, 1.1, T)
    legs_rest(p, lambda i, side: (Vector(((1 if side == 'L' else -1) * -6.0 * up, 12.0 * up, 26.0 * up)) if i == 0
                                  else Vector((0, 0, 0))))
    p.loc('hips', (0, 2.0 * up, 3.0 * up - 2.0 * imp))
    p.rot('hips', x=-14 * up + 5 * imp)
    p.rot('chest', x=-8 * up + 6 * imp)
    p.rot('head', x=-8 * up + 10 * imp)
    mandibles(p, 30 * up)
    antennae(p, t, 1.0, up=25 * up)
    abdomen(p, -6 * up + 4 * imp)


def a_quake(t, T, p):
    # every leg braces, the body drops onto the street
    up = env(t, 0.05, 0.55, 0.62, 0.62)
    if 0.62 <= t < 0.8:
        q = (t - 0.62) / 0.18
        up = 1 - q * q
    elif t >= 0.8:
        up = 0.0
    imp = env(t, 0.78, 0.82, 0.95, T)
    legs_rest(p, lambda i, side: Vector(((1 if side == 'L' else -1) * 2.0 * up, 0, 0)))
    p.loc('hips', (0, 0, 6.0 * up - 9.0 * imp))
    p.rot('head', x=-6 * up + 8 * imp)
    mandibles(p, 20 * up)
    antennae(p, t, 1.0, up=15 * up)
    abdomen(p, -8 * up + 6 * imp)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.7, 2.6, 3.2)
    o = env(t, 0.4, 0.8, 2.5, 3.0)
    vib = math.sin(TAU * 21 * t) * o
    legs_rest(p, lambda i, side: (Vector(((1 if side == 'L' else -1) * -5.0 * r, 8.0 * r, 22.0 * r)) if i == 0
                                  else Vector((0, 2.0 * r if i == 1 else 0, 0))))
    p.loc('hips', (0, 2.0 * r, 2.0 * r))
    p.rot('hips', x=-12 * r)
    p.rot('chest', x=-10 * r)
    p.rot('head', x=-14 * r + vib)
    mandibles(p, 40 * o + 4 * vib)
    antennae(p, t, 2.0 * r + 0.5, up=30 * r)
    abdomen(p, 10 * r + vib, 0)


def mortar_pose(p, k):
    legs_rest(p, lambda i, side: Vector((0, 0, -0.5 * k)))
    p.loc('hips', (0, 1.0 * k, -1.5 * k))
    p.rot('hips', x=4 * k)
    p.rot('head', x=4 * k)
    mandibles(p, 10 * k)
    abdomen(p, 70 * k)


def a_mortar_in(t, T, p):
    mortar_pose(p, smooth(t / T))
    antennae(p, t, 1.0, up=10)


def a_mortar_loop(t, T, p):
    # the sac pumps: each squeeze throws a bomb over the head
    mortar_pose(p, 1.0)
    for c in (0.0, 0.5):
        h = env((t / T - c) % 1.0, 0.0, 0.1, 0.16, 0.42)
        abdomen(p, 10 * h)
        p.loc('hips', (0, 0, -0.8 * h))
    antennae(p, t, 1.0, up=10)


def a_mortar_out(t, T, p):
    mortar_pose(p, 1 - smooth(t / T))


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    legs_rest(p)
    p.loc('hips', (0, 1.4 * h, -0.6 * h))
    p.rot('hips', y=-5 * h)
    p.rot('head', z=-12 * h)
    mandibles(p, 25 * h)
    antennae(p, t, 3.0 * h)


def a_death(t, T, p):
    f = smooth((t - 0.5) / 1.6)
    curl = smooth((t - 1.0) / 1.8)
    legs_rest(p, lambda i, side: Vector((0, 0, 10 * curl)))
    p.loc('hips', (0, 0, -9 * f))
    p.rot('hips', y=12 * f)
    mandibles(p, 30 * f)
    abdomen(p, -10 * f)
    antennae(p, t, 1.0 - f, up=-20 * f)


ANIMS = {
    'idle': (a_idle, 4.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_snap, 1.0, False),
    'attack2': (a_spear, 1.1, False),
    'heavy': (a_scythe, 1.6, False),
    'stomp': (a_quake, 1.4, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_mortar_in, 0.8, False),
    'special_loop': (a_mortar_loop, 1.2, True),
    'special_out': (a_mortar_out, 0.7, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.0, False),
}

META = dict(
    height=40.0,
    preview_angle=40,
    sheet_angle=55,
    close=(0, -16, 26, 30),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    hits=dict(attack1=0.44, attack2=0.5, heavy=0.95, stomp=0.8),
    feet=['foot2L', 'foot2R'],
    foot_phase=dict(walk=[0.53, 0.03], run=[0.53, 0.03]),
    body=[['hips', 'head', 9.0], ['abdomen1', 'abdomen3', 7.0], ['leg1L', 'foot1L', 2.0], ['leg1R', 'foot1R', 2.0],
          ['leg3L', 'foot3L', 2.0], ['leg3R', 'foot3R', 2.0]],
    aim=dict(head='head', chain=['head'], pitch0=0.3),
    mouth='mouth',
    launcher='abdomen3',
    springs=[{'bones': ['ant1L', 'ant2L'], 'yaw': 2.0, 'pitch': 2.0, 'gain': 0.6},
             {'bones': ['ant1R', 'ant2R'], 'yaw': 2.0, 'pitch': 2.0, 'gain': 0.6}],
)
