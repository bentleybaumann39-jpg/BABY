"""GRAVEMAW: an armoured alien siege-brute. A hammerhead skull shield spans its face with glowing
eyes at the tips; tusks curl from its jaw; a domed carapace of plates covers its back, the seams
between them glowing amber. Knuckle-walks on colossal forearms and drags a spiked club tail.
Faces -Y, metres (~44 m to the shell crown)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'gravemaw'
VOXEL = 0.22
LOW_TRIS = 62000

J = dict(
    hips=(0, 10, 21), sp1=(0, 5, 25), sp2=(0, -1, 28), chest=(0, -7, 28), neck0=(0, -11, 26.4), head0=(0, -15, 25.4),
    sho=(9.0, -8.0, 26.0), elb=(15.6, -5.6, 15.4), wri=(14.6, -13.4, 6.0), hand=(14.4, -15.6, 2.0),
    hip=(7.4, 11.4, 18.6), knee=(9.4, 5.4, 10.6), ankle=(9.4, 12.0, 3.8), ball=(9.4, 8.6, 1.2), toe=(9.6, 4.6, 0.7),
    t0=(0, 16, 19.4), t1=(0, 22, 16.4), t2=(0, 28, 13.0), t3=(0, 34, 10.0), t4=(0, 39, 7.8), t5=(0, 43, 6.8), t6=(0, 47, 6.8),
)
TAIL = ['t%d' % i for i in range(7)]
TAIL_R = [6.4, 5.4, 4.4, 3.4, 2.6, 2.0, 1.6]
NT = len(TAIL) - 1


def V(*a):
    return np.array(a, float)


def head_frame():
    o = V(*J['head0'])
    f = V(0, -0.97, -0.24)
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
    s.bone('spine1', 'hips', J['sp1'], J['sp2'])
    s.bone('spine2', 'spine1', J['sp2'], J['chest'])
    s.bone('chest', 'spine2', J['chest'], J['neck0'])
    s.bone('neck1', 'chest', J['neck0'], J['head0'])
    s.bone('head', 'neck1', J['head0'], H(0, 9.0, 0))
    s.bone('jaw', 'head', H(0, 0.8, -2.4), H(0, 8.6, -4.0))
    s.bone('mouth', 'head', H(0, 8.0, -2.6), H(0, 10.0, -2.6))
    s.bone('upperarm.L', 'chest', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['hand'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['ball'], mirror=True)
    s.bone('toe.L', 'foot.L', J['ball'], J['toe'], mirror=True)
    prev = 'hips'
    for i in range(NT):
        s.bone(f'tail{i + 1}', prev, J[TAIL[i]], J[TAIL[i + 1]])
        prev = f'tail{i + 1}'
    return s


def sculpt():
    S = Sculpt()
    H, hp, f, u = head_frame()
    # massive hunched body under a domed carapace
    S.ell((0, 10.0, 21.0), (8.6, 7.4, 6.6), bone='hips', k=3)
    S.ell((0, 4.4, 24.6), (9.6, 7.0, 7.4), rot=(-12, 0, 0), bone='spine1', k=3.2)
    S.ell((0, -1.4, 26.8), (11.2, 7.2, 8.0), rot=(-6, 0, 0), bone='spine2', k=3.4)
    S.ell((0, -7.0, 26.4), (11.8, 6.0, 7.6), rot=(10, 0, 0), bone='chest', k=3.2)
    S.ell((0, -6.0, 20.6), (8.0, 5.4, 5.0), rot=(10, 0, 0), bone='chest', k=3.0, mat='belly')
    S.ell((0, 3.0, 31.4), (12.8, 15.6, 7.6), rot=(-4, 0, 0), bone='spine2', k=2.0, mat='shell')  # carapace dome
    S.ell((0, 12.0, 27.6), (10.0, 8.4, 5.4), rot=(-14, 0, 0), bone='hips', k=2.0, mat='shell')
    for sx in (1, -1):
        S.ell((sx * 11.6, -5.0, 29.6), (4.4, 5.6, 4.0), rot=(0, sx * 20, 0), bone='chest', k=2.0, mat='shell')  # pauldrons
    # short neck; head under a wide hammer shield
    S.cone(J['neck0'], J['head0'], 6.4, 5.4, bone='neck1', k=2.4)
    S.ell(H(0, 3.0, -0.2), (4.6, 5.0, 3.4), rot=(hp, 0, 0), bone='head', k=1.6)
    S.ellx(H(0, 3.6, 1.8), (1, 0, 0), f, (11.6, 3.8, 1.9), bone='head', k=1.4, mat='shield')  # cephalofoil
    for sx in (1, -1):
        S.ellx(H(sx * 9.4, 3.8, 1.6), (1, 0, 0), f, (2.6, 2.6, 2.4), bone='head', k=1.0, mat='shield')  # eye stalk tips
        S.ell(H(sx * 10.8, 2.6, 1.6), (0.9, 1.1, 0.9), op='sub', k=0.3)  # eye sockets
    S.ell(H(0, 6.0, -1.6), (3.6, 4.2, 2.0), rot=(hp, 0, 0), bone='head', k=1.2)  # muzzle
    S.ell(H(0, 5.0, -4.0), (4.0, 4.6, 1.6), rot=(hp + 6, 0, 0), bone='jaw', k=1.0)
    S.ell(H(0, 5.4, -2.7), (4.0, 5.0, 0.45), rot=(hp + 4, 0, 0), op='sub', k=0.25, mat='mouth')
    # colossal forearms, knuckle-walking
    S.ell((10.4, -8.0, 26.6), (5.2, 5.4, 5.6), bone='upperarm.L', k=2.4, mirror=True)  # shoulder
    S.cone(J['sho'], J['elb'], 4.4, 3.6, bone='upperarm.L', k=2.0, mirror=True)
    S.cone(J['elb'], J['wri'], 4.4, 3.2, bone='forearm.L', k=1.8, mirror=True)
    S.ell((15.6, -9.0, 11.6), (5.4, 5.0, 6.2), rot=(30, 0, 0), bone='forearm.L', k=2.0, mirror=True)  # forearm mass
    S.ell((15.8, -8.2, 12.4), (3.0, 5.4, 6.8), rot=(30, 0, 0), bone='forearm.L', k=1.4, mirror=True, mat='shell')  # bracer
    S.ell((14.4, -15.0, 3.4), (3.6, 3.4, 3.0), bone='hand.L', k=1.4, mirror=True)  # fist
    # stout hind legs
    S.cone(J['hip'], J['knee'], 5.4, 3.8, bone='thigh.L', k=2.4, mirror=True)
    S.cone(J['knee'], J['ankle'], 3.8, 2.6, bone='shin.L', k=1.6, mirror=True)
    S.cone(J['ankle'], J['ball'], 2.6, 2.2, bone='foot.L', k=1.2, mirror=True)
    for fx, ln in ((-1.6, 3.2), (0.0, 4.0), (1.6, 3.2)):
        a = V(*J['ball']) + V(fx * 0.7, 0.3, 0)
        S.cone(a, a + V(fx * 0.4, -ln, -0.4), 1.3, 0.9, bone='toe.L', k=0.7, mirror=True)
    # short tail and its club
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(NT)], k=2.2)
    S.ell((0, 46.0, 7.0), (4.6, 5.4, 4.0), bone='tail6', k=1.6, mat='shell')
    return S


_N = Noise(17)


def noise(P):
    n = 0.14 * _N.fbm(P, 0.09, 2) + 0.24 * (_N.ridged(P, 0.4, 3) - 0.55)
    return n


AMBER = np.array([1.0, 0.55, 0.12])


def body_color(P, N, mats):
    n = len(P)
    hide = np.array([0.045, 0.038, 0.034])
    belly = np.array([0.1, 0.085, 0.07])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.3 + np.clip(-up - 0.3, 0, 1) * 0.4, 0, 1)
    col = hide[None] * (1 - t[:, None]) + belly[None] * t[:, None]
    shell = np.clip(mats.get('shell', 0) + mats.get('shield', 0), 0, 1)
    col = col * (1 - shell[:, None]) + np.array([0.06, 0.055, 0.05])[None] * shell[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.15, 0.04, 0.02])[None] * mouth[:, None]
    # glowing seams in the shell: cracks along a coarse cell pattern
    cells = np.abs(np.sin(P[:, 0] * 0.42 + _N.fbm(P, 0.08, 2) * 2.5) * np.sin(P[:, 1] * 0.38 + _N.fbm(P + 9, 0.08, 2) * 2.5))
    seam = np.clip((0.14 - cells) * 9.0, 0, 1) * np.clip(mats.get('shell', 0) * 1.5, 0, 1)
    g = np.clip(seam * 0.85 + mouth * 0.6, 0, 1)
    glow = AMBER[None] * g[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(61)
    H, hp, f, u = head_frame()
    L = Parts()
    # tusks curling up from the jaw corners, and teeth
    L.horn(H(3.4, 6.6, -3.4), (0.5, -0.6, 1), 7.0, 1.1, bend=(0.8, -1.2, 1.5), bone='jaw', mat='keratin', seg=8, rings=6)
    L.row_of_teeth(H(3.0, 3.0, -2.2), H(0.8, 8.8, -2.2), 7, 1.4, 0.4, (0, 0, -1), 'head', rng)
    L.row_of_teeth(H(2.8, 3.0, -3.0), H(0.8, 8.4, -3.2), 6, 1.2, 0.36, (0, 0, 1), 'jaw', rng)
    L.sphere(H(11.4, 2.6, 1.6), 0.9, bone='head', mat='eye')
    # knuckle spikes and toe claws
    for k, dx in enumerate((-1.6, 0.0, 1.6)):
        L.horn(V(14.4 + dx, -17.6, 2.4), (0.1 * dx, -1, 0.2), 2.4, 0.8, bend=(0, 0, -0.6), bone='hand.L', mat='horn', seg=7, rings=4)
    for fx, ln in ((-1.6, 3.2), (0.0, 4.0), (1.6, 3.2)):
        a = V(*J['ball']) + V(fx * 0.7, 0.3, 0)
        tip = a + V(fx * 0.4, -ln, -0.4)
        L.horn(tip + V(0, 0.3, 0.2), (fx * 0.1, -1, -0.4), 1.8, 0.7, bend=(0, 0, -0.4), bone='toe.L', mat='horn', seg=7, rings=3)
    # bracer spikes
    for k in range(3):
        q = V(18.8, -6.4 - k * 2.2, 14.0 - k * 2.6)
        L.horn(q, (1, 0.3, 0.2), 3.0 - k * 0.4, 0.9, bend=(0, 0.6, 0.4), bone='forearm.L', mat='horn', seg=7, rings=4)
    L.mirrored()
    P.merge(L)
    # carapace plates: overlapping, with glowing seams showing between them
    for row, y in enumerate(np.arange(-10, 22, 4.6)):
        xs = np.arange(-12, 12.5, 4.8) + (2.4 if row % 2 else 0)
        for i, x in enumerate(xs):
            top = on_surface(S, x, y)
            if top is None or top[2] < 22:
                continue
            nrm = normal_at(S, top)
            nxt = on_surface(S, x, y + 1.0)
            if nxt is None:
                continue
            fwd = top - nxt
            fwd /= np.linalg.norm(fwd)
            h = 1.2 + 1.0 * np.exp(-(x / 7.0) ** 2) + rng.uniform(-0.2, 0.2)
            P.plate(top - nrm * 0.5, nrm, fwd, h, 6.0, 2.2, bone=bone_at(S, top - nrm * 2.0), seed=row * 20 + i, lobes=1, lean=0.8)
    for y, z in ((44.0, 10.4), (47.0, 10.4), (49.4, 8.6)):
        for sx in (-1, 0, 1):
            P.horn((sx * 3.4, y, z - abs(sx) * 2.2), (sx * 0.8, 0.3, 1), 3.2, 0.9, bone='tail6', mat='horn', seg=7, rings=4)
    return P


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 10

LOOK = dict(cell=0.5, wrinkle=2.4, scute=0.2, bump=0.4, cellvar=0.4, groove=0.6, wear=0.3,
            wearcol=(0.16, 0.14, 0.12), rough=0.62, cage=0.9, crag=0.9, noisew=0.35, folds=0.2, glow=True)

PART_MATS = {
    'keratin': dict(color=(0.62, 0.55, 0.42), rough=0.35),
    'horn': dict(color=(0.08, 0.07, 0.06), rough=0.4),
    'plate': dict(color=(0.09, 0.08, 0.07), rough=0.45, emissive=(1.0, 0.55, 0.12), emit=0.0),
    'eye': dict(color=(1.0, 0.6, 0.15), rough=0.1, emissive=(1.0, 0.55, 0.1), emit=4.0),
}


# ============================================================================= animation
from rig import env, smooth, foot_cycle
from mathutils import Vector

TAU = 2 * math.pi
SIDES = (('L', 1), ('R', -1))
TAILB = [f'tail{i + 1}' for i in range(NT)]


def mx(v, sx):
    return Vector((v[0] * sx, v[1], v[2]))


WRI = {s: mx(J['wri'], sx) for s, sx in SIDES}
HAND_DIR = (Vector(J['hand']) - Vector(J['wri'])).normalized()
BALL = {s: mx(J['ball'], sx) for s, sx in SIDES}
FOOT_LEN = (Vector(J['ball']) - Vector(J['ankle'])).length
FOOT_PITCH = math.degrees(math.atan2(J['ankle'][2] - J['ball'][2], J['ankle'][1] - J['ball'][1]))
TOE_PITCH = math.degrees(math.atan2(J['ball'][2] - J['toe'][2], J['ball'][1] - J['toe'][1]))

WALK = dict(T=2.6, stride=13.0, duty=0.66, lift=3.0, phases={'hL': 0.0, 'fR': 0.1, 'hR': 0.5, 'fL': 0.6})
RUN = dict(T=1.5, stride=19.0, duty=0.46, lift=5.2, phases={'hL': 0.0, 'hR': 0.15, 'fL': 0.5, 'fR': 0.62})


def fore(p, side, wri, hand_pitch=0.0):
    sx = 1 if side == 'L' else -1
    p.ik('upperarm.' + side, 'forearm.' + side, wri, Vector((sx * 34, 14, 26)))
    d = Vector((HAND_DIR.x * sx, HAND_DIR.y, HAND_DIR.z))
    a = math.radians(hand_pitch)
    p.aim('hand.' + side, Vector((d.x, d.y * math.cos(a) - d.z * math.sin(a), d.y * math.sin(a) + d.z * math.cos(a))))


def hind(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    p.ik('thigh.' + side, 'shin.' + side, ball - d * FOOT_LEN, Vector((sx * 12, -30, 14)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def stand(p, fspread=0.0):
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((sx * fspread, 0, 0)))
        hind(p, side, BALL[side])


def tail_wave(p, ph, amp, lift=0.0):
    for i, b in enumerate(TAILB):
        p.rot(b, z=amp * (1.5 + i * 0.8) * math.sin(TAU * ph - 0.6 * (i + 1)), x=lift)


def gait(ph, p, g, bob, tail, crouch=0.0):
    duty = g['duty']
    for side, sx in SIDES:
        sp = (ph + g['phases']['f' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'] * 1.2, duty)
        fore(p, side, WRI[side] + Vector((0.0, -f, h)), hand_pitch=-20 * math.sin(math.pi * sw) if sp >= duty else 0)
        sp = (ph + g['phases']['h' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        fp = FOOT_PITCH + (20 * smooth((sp / duty - 0.6) / 0.4) if sp < duty else 20 * (1 - smooth(sw * 1.3)))
        hind(p, side, BALL[side] + Vector((0.0, -f, h)), fp, TOE_PITCH + (18 * math.sin(math.pi * sw) if sp >= duty else 0))
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    p.loc('hips', (0.9 * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    p.rot('hips', y=4 * s1, z=3 * s1)
    p.rot('spine2', y=-3 * s1, z=-2.5 * s1)
    p.rot('chest', y=-2 * s1, z=-3 * s1)
    p.rot('neck1', x=2.5 * c2, z=4 * s1)
    p.rot('head', x=-2 * c2, z=-3 * s1)
    p.rot('jaw', x=4)
    tail_wave(p, ph, tail)


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.8, tail=1.2)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=1.6, tail=1.6, crouch=1.0)


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0.3 * math.sin(TAU * ph), 0, 0.25 * b))
    p.rot('spine2', x=-1.2 * b)
    p.rot('chest', x=-1.0 * b)
    p.rot('neck1', z=6 * math.sin(TAU * ph + 1.0), x=1.5 * b)
    p.rot('head', z=5 * math.sin(TAU * ph + 0.4))
    p.rot('jaw', x=4 + 3 * max(0.0, math.sin(TAU * 3 * ph)))
    tail_wave(p, ph, 1.0)


def a_haymaker(t, T, p):
    w = env(t, 0.0, 0.34, 0.38, 0.5)
    s = env(t, 0.38, 0.52, 0.64, T)
    for side, sx in SIDES:
        hind(p, side, BALL[side])
    fore(p, 'L', WRI['L'] + Vector((0, 1.0 * s, 0)))
    tgt = WRI['R'] + Vector((-4.0, 6.0, 22.0)) * w + Vector((6.0, -14.0, 6.0)) * s
    fore(p, 'R', tgt, hand_pitch=-40 * w + 30 * s)
    twist = -18 * w + 30 * s
    p.loc('hips', (0, 2.0 * w - 3.0 * s, 1.0 * w))
    p.rot('hips', z=twist * 0.2, x=-6 * w)
    p.rot('spine2', z=twist * 0.3, x=-6 * w + 4 * s)
    p.rot('chest', z=twist * 0.4)
    p.rot('neck1', z=-twist * 0.3)
    p.rot('jaw', x=4 + 20 * s)
    tail_wave(p, 0.2, 0.4)


def a_ram(t, T, p):
    # drop the hammer shield and drive it forward
    w = env(t, 0.0, 0.3, 0.34, 0.44)
    s = env(t, 0.34, 0.46, 0.6, T)
    stand(p, 1.5)
    p.loc('hips', (0, 3.0 * w - 6.0 * s, -1.4 * s))
    p.rot('hips', x=-4 * w + 6 * s)
    p.rot('spine2', x=-4 * w + 5 * s)
    p.rot('chest', x=-5 * w + 8 * s)
    p.rot('neck1', x=-14 * w + 22 * s)
    p.rot('head', x=-6 * w + 10 * s, y=8 * s)
    p.rot('jaw', x=4 + 10 * w)
    tail_wave(p, 0.1, 0.5)


def a_pound(t, T, p):
    up = env(t, 0.05, 0.62, 0.7, 0.7)
    if 0.7 <= t < 0.95:
        q = (t - 0.7) / 0.25
        up = 1 - q * q
    elif t >= 0.95:
        up = 0.0
    imp = env(t, 0.92, 0.98, 1.15, T)
    for side, sx in SIDES:
        hind(p, side, BALL[side] + Vector((0, 1.5 * up, 0)))
        fore(p, side, WRI[side] + Vector((sx * -3.0 * up, 8.0 * up - 3.0 * imp, 26.0 * up)), hand_pitch=-50 * up)
    p.loc('hips', (0, 3.0 * up, 4.0 * up - 2.6 * imp))
    p.rot('hips', x=-22 * up + 8 * imp)
    p.rot('spine2', x=-10 * up + 6 * imp)
    p.rot('chest', x=-8 * up + 6 * imp)
    p.rot('neck1', x=6 * up - 6 * imp)
    p.rot('jaw', x=4 + 30 * up + 10 * imp)
    tail_wave(p, 0.0, 0.0, lift=4 * up - 3 * imp)


def a_stomp(t, T, p):
    a_pound(t, T, p)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.7, 2.6, 3.2)
    o = env(t, 0.5, 0.85, 2.5, 2.95)
    vib = math.sin(TAU * 14 * t) * o
    beat = max(0.0, math.sin(TAU * 3 * t)) * env(t, 0.8, 1.0, 2.2, 2.5)
    for side, sx in SIDES:
        hind(p, side, BALL[side] + Vector((sx * 1.0, 2.0 * r, 0)))
        lr = 1 if side == 'L' else 0
        k = beat if (int(t * 3) % 2 == lr) else 0
        fore(p, side, WRI[side] + Vector((sx * -6.0 * r, 6.0 * r, 26.0 * r)) + Vector((sx * -3 * k, -2 * k, -2 * k)),
             hand_pitch=-60 * r)
    p.loc('hips', (0, 4.0 * r, 5.0 * r))
    p.rot('hips', x=-30 * r)
    p.rot('spine1', x=-8 * r)
    p.rot('spine2', x=-8 * r)
    p.rot('chest', x=-4 * r)
    p.rot('neck1', x=-14 * r + vib)
    p.rot('head', x=-10 * r, z=3 * math.sin(TAU * 0.6 * t) * o)
    p.rot('jaw', x=4 + 40 * o + 2 * vib)
    tail_wave(p, t, 0.6 * r, lift=3 * r)


def a_pulse_in(t, T, p):
    # rear up while the shell seams charge
    k = smooth(t / T)
    sh = math.sin(TAU * 9 * t) * k * 0.6
    for side, sx in SIDES:
        hind(p, side, BALL[side] + Vector((sx * 1.0, 1.5 * k, 0)))
        fore(p, side, WRI[side] + Vector((sx * -2.0 * k, 6.0 * k, 22.0 * k)), hand_pitch=-50 * k)
    p.loc('hips', (sh, 3.0 * k, 4.0 * k))
    p.rot('hips', x=-24 * k)
    p.rot('spine2', x=-8 * k + sh)
    p.rot('neck1', x=-10 * k)
    p.rot('jaw', x=4 + 30 * k)
    tail_wave(p, 0.0, 0.0, lift=4 * k)


def a_pulse_out(t, T, p):
    # slam down: the shockwave leaves on impact
    q = smooth(t / 0.22)
    imp = env(t, 0.18, 0.24, 0.5, T)
    k = 1 - q
    for side, sx in SIDES:
        hind(p, side, BALL[side])
        fore(p, side, WRI[side] + Vector((sx * -2.0 * k, 6.0 * k - 2.0 * imp, 22.0 * k)), hand_pitch=-50 * k)
    p.loc('hips', (0, 3.0 * k, 4.0 * k - 2.8 * imp))
    p.rot('hips', x=-24 * k + 8 * imp)
    p.rot('chest', x=8 * imp)
    p.rot('neck1', x=-10 * k + 8 * imp)
    p.rot('jaw', x=4 + 30 * k + 16 * imp)
    tail_wave(p, 0.0, 0.0, lift=4 * k - 3 * imp)


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    stand(p)
    p.loc('hips', (0, 1.4 * h, -0.5 * h))
    p.rot('spine2', y=-5 * h)
    p.rot('neck1', z=-10 * h)
    p.rot('head', z=-12 * h, x=-6 * h)
    p.rot('jaw', x=4 + 18 * h)


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.8) / 1.4)) ** 2
    bounce = math.sin(max(0.0, t - 2.2) * 9) * math.exp(-max(0.0, t - 2.2) * 4) * (t > 2.2)
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((sx * 8 * f, -2 * f, 0)))
        hind(p, side, BALL[side] + Vector((sx * 4 * f, 2 * f, 0)))
    p.loc('hips', (0, 0, -9 * f + 0.6 * bounce))
    p.rot('hips', y=12 * f)
    p.rot('neck1', x=-12 * a + 18 * f, z=12 * f)
    p.rot('jaw', x=4 + 34 * a)
    tail_wave(p, 0.0, 0.0, lift=-2 * f)


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_haymaker, 1.2, False),
    'attack2': (a_ram, 1.1, False),
    'heavy': (a_pound, 1.7, False),
    'stomp': (a_stomp, 1.7, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_pulse_in, 1.2, False),
    'special_out': (a_pulse_out, 1.0, False),
    'hit': (a_hit, 0.7, False),
    'death': (a_death, 3.4, False),
}

META = dict(
    height=44.0,
    preview_angle=35,
    sheet_angle=45,
    close=(0, -20, 30, 30),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.52, attack2=0.46, heavy=0.97, stomp=0.97, special_out=0.22),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.15]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['upperarmL', 'forearmL', 5.0], ['upperarmR', 'forearmR', 5.0], ['forearmL', 'handL', 4.4], ['forearmR', 'handR', 4.4],
          ['thighL', 'shinL', 4.4], ['thighR', 'shinR', 4.4], ['hips', 'chest', 11.0], ['chest', 'head', 7.0],
          ['tail1', 'tail3', 5.0], ['tail3', 'tail6', 3.6]],
    aim=dict(head='head', chain=['neck1', 'head'], pitch0=0.24),
    feet=['toeL', 'toeR', 'handL', 'handR'],
    mouth='mouth',
)
