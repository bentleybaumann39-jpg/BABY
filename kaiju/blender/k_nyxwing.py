"""NYXWING: a winged alien acid-spitter. Lean four-legged body, a long S-curved neck, a narrow
skull swept back into a spike, a throat sac glowing acid green, and two vast membrane wings that
grow from the shoulders (separate from its legs). A whip tail ends in a barbed spade.
Faces -Y, metres (~44 m to the wing wrists when raised, ~110 m wingspan)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'nyxwing'
VOXEL = 0.24
LOW_TRIS = 64000

J = dict(
    hips=(0, 8, 22.4), sp1=(0, 3, 23.8), sp2=(0, -3, 24.8), chest=(0, -9, 24.6), neck0=(0, -12.6, 26.4),
    neck1=(0, -16.4, 30.4), neck2=(0, -19.6, 35.0), head0=(0, -22.6, 38.0),
    sho=(5.0, -9.0, 22.0), elb=(6.6, -6.4, 12.6), wri=(6.2, -12.0, 3.2), hand=(6.2, -14.4, 0.8),
    hip=(5.2, 8.6, 21.2), knee=(6.6, 1.4, 12.2), ankle=(6.6, 10.0, 4.6), ball=(6.6, 6.0, 1.0), toe=(6.8, 2.0, 0.6),
    t0=(0, 13, 22.0), t1=(0, 20, 20.6), t2=(0, 28, 18.4), t3=(0, 37, 15.8), t4=(0, 46, 13.4), t5=(0, 55, 11.8),
    t6=(0, 64, 11.0), t7=(0, 72, 11.2), t8=(0, 79, 12.2), t9=(0, 85, 13.6), t10=(0, 90, 15.4),
    ws=(3.6, -6.0, 29.0), we=(15.0, -3.0, 39.0), ww=(28.0, 2.0, 44.0), wt=(55.0, -2.0, 41.0),
    f1=(49.0, 20.0, 35.0), f2=(35.0, 28.0, 28.0), wb=(5.6, 10.0, 25.6),
)
TAIL = ['t%d' % i for i in range(11)]
TAIL_R = [4.2, 3.6, 3.0, 2.5, 2.1, 1.8, 1.5, 1.25, 1.0, 0.8, 0.55]
NT = len(TAIL) - 1
WING_BONES = [('wing1', 'ws', 'we'), ('wing2', 'we', 'ww'), ('wing3', 'ww', 'wt'), ('wingf1', 'ww', 'f1'), ('wingf2', 'ww', 'f2')]


def V(*a):
    return np.array(a, float)


def head_frame():
    o = V(*J['head0'])
    f = V(0, -0.9, -0.43)
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
    s.bone('neck1', 'chest', J['neck0'], J['neck1'])
    s.bone('neck2', 'neck1', J['neck1'], J['neck2'])
    s.bone('neck3', 'neck2', J['neck2'], J['head0'])
    s.bone('head', 'neck3', J['head0'], H(0, 10.0, 0))
    s.bone('jaw', 'head', H(0, 1.2, -1.4), H(0, 9.4, -2.4))
    s.bone('mouth', 'head', H(0, 9.0, -1.6), H(0, 11.0, -1.6))
    s.bone('upperarm.L', 'chest', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['hand'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['ball'], mirror=True)
    s.bone('toe.L', 'foot.L', J['ball'], J['toe'], mirror=True)
    s.bone('wing1.L', 'chest', J['ws'], J['we'], mirror=True)
    s.bone('wing2.L', 'wing1.L', J['we'], J['ww'], mirror=True)
    s.bone('wing3.L', 'wing2.L', J['ww'], J['wt'], mirror=True)
    s.bone('wingf1.L', 'wing2.L', J['ww'], J['f1'], mirror=True)
    s.bone('wingf2.L', 'wing2.L', J['ww'], J['f2'], mirror=True)
    prev = 'hips'
    for i in range(NT):
        s.bone(f'tail{i + 1}', prev, J[TAIL[i]], J[TAIL[i + 1]])
        prev = f'tail{i + 1}'
    return s


def _seg_dist(p, a, b):
    a, b = V(*a), V(*b)
    t = np.clip((p - a) @ (b - a) / ((b - a) @ (b - a)), 0, 1)
    return np.linalg.norm(p - (a + (b - a) * t))


def membrane_bone(c):
    """Membrane pieces follow the nearest wing spar; the web next to the body stays with the torso."""
    c = np.abs(c) * V(1, 1, 1) * V(1, 0, 0) + c * V(0, 1, 1)  # evaluate on the left side
    best, bn = 1e9, 'spine2'
    for name, a, b in WING_BONES:
        d = _seg_dist(c, J[a], J[b])
        if d < best:
            best, bn = d, name + '.L'
    for name, a, b in (('spine2', 'sp2', 'chest'), ('spine1', 'sp1', 'sp2'), ('hips', 'hips', 'sp1')):
        d = _seg_dist(c, J[a], J[b]) - 4.0
        if d < best:
            best, bn = d, name
    return bn


def sculpt():
    S = Sculpt()
    H, hp, f, u = head_frame()
    # lean, deep-chested torso
    S.ell((0, 8.0, 22.4), (5.4, 6.4, 4.8), rot=(-6, 0, 0), bone='hips', k=2.4)
    S.ell((0, 2.6, 23.6), (5.0, 5.6, 4.8), bone='spine1', k=2.4)
    S.ell((0, -3.4, 24.2), (5.8, 5.6, 5.6), rot=(6, 0, 0), bone='spine2', k=2.6)
    S.ell((0, -8.6, 23.8), (5.6, 4.6, 5.4), rot=(16, 0, 0), bone='chest', k=2.4)
    S.ell((0, -7.0, 19.8), (3.8, 4.8, 3.0), rot=(10, 0, 0), bone='chest', k=2.2, mat='belly')
    S.ell((0, -5.0, 28.6), (6.4, 4.0, 2.8), bone='chest', k=2.0)  # wing-muscle hump
    # S-curved neck
    S.chain([J['neck0'], J['neck1'], J['neck2'], J['head0']], [3.6, 3.0, 2.6, 2.3], ['neck1', 'neck2', 'neck3'], k=1.6)
    S.ell((0, -15.6, 27.6), (2.4, 2.6, 3.0), rot=(40, 0, 0), bone='neck1', k=1.4, mat='sac')  # acid sac
    S.ell((0, -18.6, 31.2), (2.0, 2.2, 2.4), rot=(40, 0, 0), bone='neck2', k=1.2, mat='sac')
    # narrow skull swept back into a spike
    S.ell(H(0, 2.4, 0.6), (2.4, 4.2, 2.2), rot=(hp, 0, 0), bone='head', k=1.1)
    S.ell(H(0, 7.0, -0.4), (1.6, 3.8, 1.3), rot=(hp + 4, 0, 0), bone='head', k=0.9)
    S.blade(H(0, 1.0, 1.6), H(0, -10.0, 7.6), (1, 0, 0), (1.4, 0.3), (1.2, 0.3), n=8, bone='head', k=0.7, mat='crest')
    for sx in (1, -1):
        S.ell(H(sx * 1.7, 4.4, 0.8), (0.5, 0.65, 0.4), op='sub', k=0.25)
    S.ell(H(0, 5.6, -2.4), (1.6, 4.2, 0.9), rot=(hp + 4, 0, 0), bone='jaw', k=0.7)
    S.ell(H(0, 5.8, -1.4), (2.0, 4.6, 0.35), rot=(hp + 4, 0, 0), op='sub', k=0.2, mat='mouth')
    # forelegs (elbows back) and hind legs (knees forward)
    S.ell((5.4, -8.6, 21.4), (2.8, 3.2, 3.4), bone='upperarm.L', k=1.6, mirror=True)
    S.cone(J['sho'], J['elb'], 2.6, 1.8, bone='upperarm.L', k=1.4, mirror=True)
    S.cone(J['elb'], J['wri'], 1.8, 1.1, bone='forearm.L', k=1.0, mirror=True)
    S.cone(J['wri'], J['hand'], 1.1, 0.8, bone='hand.L', k=0.6, mirror=True)
    S.cone(J['hip'], J['knee'], 3.4, 2.2, bone='thigh.L', k=1.8, mirror=True)
    S.ell((6.0, 5.6, 17.4), (2.8, 3.8, 4.4), rot=(-30, 0, 0), bone='thigh.L', k=1.6, mirror=True)
    S.cone(J['knee'], J['ankle'], 2.1, 1.3, bone='shin.L', k=1.0, mirror=True)
    S.cone(J['ankle'], J['ball'], 1.3, 1.0, bone='foot.L', k=0.7, mirror=True)
    for fx, ln in ((-0.9, 3.0), (0.0, 3.8), (0.9, 3.0)):
        for base, bn in ((V(*J['ball']), 'toe.L'), (V(*J['hand']) + V(0, 0, 0.2), 'hand.L')):
            a = base + V(fx * 0.5, 0.1, 0)
            S.cone(a, a + V(fx * 0.5, -ln * (0.8 if bn == 'hand.L' else 1), -0.3), 0.6, 0.35, bone=bn, k=0.4, mirror=True)
    # wings: bony spars and the webs between them
    for name, a, b in WING_BONES:
        r0, r1 = {'wing1': (2.3, 1.6), 'wing2': (1.6, 1.1), 'wing3': (1.0, 0.35), 'wingf1': (0.8, 0.3), 'wingf2': (0.8, 0.3)}[name]
        S.cone(J[a], J[b], r0, r1, bone=name + '.L', k=0.8, mirror=True, mat='spar')
    S.ell(J['ws'], (3.0, 3.0, 2.6), bone='wing1.L', k=1.4, mirror=True)
    S.ell(J['ww'], (1.8, 1.8, 1.6), bone='wing2.L', k=0.8, mirror=True)
    for p0, p1, p2, n, sag in (('ws', 'we', 'ww', 5, 0.4), ('ww', 'wt', 'f1', 7, -1.4), ('ww', 'f1', 'f2', 7, -1.4),
                               ('ww', 'f2', 'wb', 8, -1.8), ('ws', 'ww', 'wb', 7, -1.2)):
        S.tri(J[p0], J[p1], J[p2], 0.42, n=n, bone=membrane_bone, k=0.5, mat='web', mirror=True, sag=sag)
    # whip tail with a barbed spade
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(NT)], k=1.6)
    S.blade((0, 87, 14.6), (0, 97, 18.0), (1, 0, 0), (3.6, 0.4), (0.5, 0.15), n=6, bone='tail10', k=0.6, mat='spar')
    return S


_N = Noise(91)


def noise(P):
    web = (np.abs(P[:, 0]) > 7.0) & (P[:, 2] > 25)
    n = 0.07 * _N.fbm(P, 0.14, 2) + 0.1 * (_N.ridged(P, 0.6, 3) - 0.55)
    return n * np.where(web, 0.25, 1.0)


GREEN = np.array([0.3, 1.0, 0.25])


def body_color(P, N, mats):
    n = len(P)
    dark = np.array([0.03, 0.018, 0.04])
    belly = np.array([0.09, 0.07, 0.09])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.2 + np.clip(-up - 0.35, 0, 1) * 0.4, 0, 1)
    col = dark[None] * (1 - t[:, None]) + belly[None] * t[:, None]
    web = np.clip(mats.get('web', 0), 0, 1)
    vein = np.clip(1 - np.abs(_N.ridged(P, 0.22, 2) - 1.2) * 9.0, 0, 1) * web
    col = col * (1 - web[:, None]) + np.array([0.045, 0.025, 0.05])[None] * web[:, None]
    col = col * (1 - 0.5 * vein[:, None]) + np.array([0.14, 0.04, 0.1])[None] * (0.5 * vein)[:, None]
    sac = np.clip(mats.get('sac', 0) * 1.5, 0, 1)
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - sac[:, None]) + np.array([0.12, 0.3, 0.08])[None] * sac[:, None]
    # photophore rows along the spars and dorsal line
    spar = np.clip(mats.get('spar', 0), 0, 1)
    dots = np.clip((np.sin(P[:, 0] * 1.1 + P[:, 1] * 0.7) * np.sin(P[:, 1] * 1.3 - P[:, 2] * 0.4) - 0.55) * 6, 0, 1) * spar
    g = np.clip(sac * 0.65 + mouth * 0.9 + dots * 0.7 * (1 - web), 0, 1)  # webs stay dark: the game boosts emission
    glow = GREEN[None] * g[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    P = Parts()
    rng = np.random.default_rng(47)
    H, hp, f, u = head_frame()
    L = Parts()
    L.row_of_teeth(H(1.5, 2.6, -1.0), H(0.4, 9.2, -0.9), 10, 1.0, 0.22, (0, 0, -1), 'head', rng)
    L.row_of_teeth(H(1.4, 2.6, -1.8), H(0.4, 8.8, -1.8), 9, 0.9, 0.2, (0, 0, 1), 'jaw', rng)
    L.sphere(H(1.7, 4.4, 0.8), 0.42, bone='head', mat='eye')
    L.sphere(H(1.9, 3.4, 1.2), 0.3, bone='head', mat='eye')
    # wing claws at the wrist and the leading tip, foot and hand claws
    L.horn(V(*J['ww']) + V(0, -1.2, 0.6), (0.2, -1, 0.4), 4.0, 0.7, bend=(0, -0.4, -1.2), bone='wing2.L', mat='horn', seg=7, rings=5)
    L.horn(V(*J['wt']) - V(0.6, 0, 0), (1, -0.1, -0.1), 3.0, 0.4, bend=(0, 0.6, -0.3), bone='wing3.L', mat='horn', seg=6, rings=4)
    for fx, ln in ((-0.9, 3.0), (0.0, 3.8), (0.9, 3.0)):
        for base, bn, sc in ((V(*J['ball']), 'toe.L', 1.0), (V(*J['hand']) + V(0, 0, 0.2), 'hand.L', 0.8)):
            a = base + V(fx * 0.5, 0.1, 0)
            tip = a + V(fx * 0.5, -ln * sc, -0.3)
            L.horn(tip + V(0, 0.2, 0.1), (fx * 0.1, -1, -0.35), 1.5, 0.38, bend=(0, 0, -0.4), bone=bn, mat='horn', seg=6, rings=3)
    L.mirrored()
    P.merge(L)
    # barbs on the spade
    for k, (y, z) in enumerate(((90, 16.6), (93, 17.4), (95.5, 18.0))):
        for sx in (1, -1):
            P.horn((sx * 2.4 * (1 - k * 0.25), y, z), (sx, 0.6, 0), 2.0, 0.35, bend=(0, 0.8, 0), bone='tail10', mat='horn', seg=6, rings=3)
    return P


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 6

LOOK = dict(cell=0.8, wrinkle=3.4, scute=0.24, bump=0.22, cellvar=0.3, groove=0.4, wear=0.12,
            wearcol=(0.1, 0.08, 0.1), rough=0.35, cage=0.8, crag=0.35, noisew=0.45, folds=0.3, foldscale=0.8,
            glow=True)

PART_MATS = {
    'keratin': dict(color=(0.7, 0.75, 0.6), rough=0.3),
    'horn': dict(color=(0.05, 0.04, 0.05), rough=0.35),
    'eye': dict(color=(0.5, 1.0, 0.4), rough=0.1, emissive=(0.4, 1.0, 0.3), emit=4.0),
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

WALK = dict(T=2.2, stride=13.0, duty=0.68, lift=3.2, phases={'hL': 0.0, 'fL': 0.25, 'hR': 0.5, 'fR': 0.75})
RUN = dict(T=1.2, stride=20.0, duty=0.42, lift=5.0, phases={'hL': 0.0, 'hR': 0.1, 'fL': 0.5, 'fR': 0.6})


def fore(p, side, wri, hand_pitch=0.0):
    sx = 1 if side == 'L' else -1
    p.ik('upperarm.' + side, 'forearm.' + side, wri, Vector((sx * 6, 34, 12)))
    d = Vector((HAND_DIR.x * sx, HAND_DIR.y, HAND_DIR.z))
    a = math.radians(hand_pitch)
    p.aim('hand.' + side, Vector((d.x, d.y * math.cos(a) - d.z * math.sin(a), d.y * math.sin(a) + d.z * math.cos(a))))


def hind(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    p.ik('thigh.' + side, 'shin.' + side, ball - d * FOOT_LEN, Vector((sx * 8, -30, 16)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def wings(p, fold=1.0, lift=0.0, sweep=0.0, only=None):
    """fold 1 = tucked along the back, 0 = fully spread (bind pose); lift raises the whole wing
    (negative lowers it, used for downstrokes); sweep pushes the spread wings forward."""
    for side, sx in SIDES:
        if only and side != only:
            continue
        p.rot('wing1.' + side, z=sx * (68 * fold - sweep), y=sx * (-lift + 26 * fold), x=-6 * fold)
        p.rot('wing2.' + side, z=-sx * 145 * fold, y=sx * 6 * fold)
        p.rot('wing3.' + side, z=sx * 162 * fold, y=-sx * 4 * fold)
        p.rot('wingf1.' + side, z=sx * 155 * fold, y=-sx * 6 * fold)
        p.rot('wingf2.' + side, z=sx * 140 * fold, y=-sx * 8 * fold)


def stand(p):
    for side, sx in SIDES:
        fore(p, side, WRI[side])
        hind(p, side, BALL[side])


def tail_wave(p, ph, amp, lift=0.0):
    for i, b in enumerate(TAILB):
        p.rot(b, z=amp * (0.8 + i * 0.5) * math.sin(TAU * ph - 0.5 * (i + 1)),
              x=lift + 0.4 * amp * math.cos(TAU * ph - 0.6 * i))


def neck(p, x=0.0, z=0.0):
    p.rot('neck1', x=x * 0.4, z=z * 0.3)
    p.rot('neck2', x=x * 0.3, z=z * 0.35)
    p.rot('neck3', x=x * 0.3, z=z * 0.35)


def gait(ph, p, g, bob, tail, fold=1.0, crouch=0.0):
    duty = g['duty']
    for side, sx in SIDES:
        sp = (ph + g['phases']['f' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        fore(p, side, WRI[side] + Vector((0.0, -f, h)), hand_pitch=-30 * math.sin(math.pi * sw) if sp >= duty else 0)
        sp = (ph + g['phases']['h' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        fp = FOOT_PITCH + (16 * smooth((sp / duty - 0.6) / 0.4) if sp < duty else 16 * (1 - smooth(sw * 1.3)))
        hind(p, side, BALL[side] + Vector((0.0, -f, h)), fp, TOE_PITCH + (24 * math.sin(math.pi * sw) if sp >= duty else 0))
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    p.loc('hips', (0.5 * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    p.rot('hips', y=2.5 * s1, z=2.5 * math.sin(TAU * ph + 0.5))
    p.rot('spine2', z=-2.0 * math.sin(TAU * ph + 0.8))
    neck(p, x=4 * c2, z=4 * math.sin(TAU * ph + 1.4))
    p.rot('head', x=-3 * c2)
    p.rot('jaw', x=3)
    wings(p, fold, lift=3 * c2 * (1 - fold * 0.6))
    tail_wave(p, ph, tail, lift=1.0)


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.6, tail=1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=1.4, tail=1.4, fold=0.55, crouch=1.2)


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0, 0, 0.2 * b))
    p.rot('spine2', x=-1.0 * b)
    neck(p, x=3 * b, z=12 * math.sin(TAU * ph + 0.8))
    p.rot('head', z=8 * math.sin(TAU * ph + 0.3), x=3 * math.sin(TAU * 3 * ph))
    p.rot('jaw', x=3 + 3 * max(0.0, math.sin(TAU * 4 * ph)))
    ruffle = max(0.0, math.sin(TAU * ph - 1.2)) ** 3
    wings(p, 1.0 - 0.25 * ruffle, lift=6 * ruffle)
    tail_wave(p, ph, 1.2, lift=1.0)


def a_strike(t, T, p):
    w = env(t, 0.0, 0.3, 0.34, 0.44)
    s = env(t, 0.34, 0.44, 0.56, T)
    stand(p)
    p.loc('hips', (0, 1.5 * w - 3.0 * s, -0.6 * s))
    p.rot('chest', x=-4 * w + 6 * s)
    neck(p, x=-40 * w + 70 * s)
    p.rot('head', x=10 * w - 26 * s)
    p.rot('jaw', x=3 + 40 * w * (1 - s) + 10 * s)
    wings(p, 1.0 - 0.3 * w, lift=10 * w)
    tail_wave(p, 0.3, 0.6)


def a_buffet(t, T, p):
    # snap the right wing open and slam it forward across the ground
    w = env(t, 0.0, 0.3, 0.34, 0.46)
    s = env(t, 0.34, 0.5, 0.6, T)
    stand(p)
    p.rot('hips', z=6 * w - 10 * s)
    p.rot('chest', z=8 * w - 14 * s)
    neck(p, z=20 * w - 30 * s)
    p.rot('jaw', x=3 + 24 * s)
    wings(p, 1.0, only='L')
    p.rot('wing1.R', z=-(58 * (1 - w) - 60 * s), y=-(-30 * w + 40 * s + 14 * (1 - w)), x=-10 * (1 - w))
    p.rot('wing2.R', z=125 * (1 - w) * (1 - s))
    p.rot('wing3.R', z=-150 * (1 - w) * (1 - s))
    p.rot('wingf1.R', z=-140 * (1 - w) * (1 - s))
    p.rot('wingf2.R', z=-120 * (1 - w) * (1 - s))
    tail_wave(p, 0.2, 0.6)


def a_tail(t, T, p):
    stand(p)
    w = env(t, 0.0, 0.42, 0.48, 0.64)
    lag = lambda i: env(t - 0.03 * i, 0.5, 0.86, 1.0, T)
    s = lag(0)
    yaw_h = 20 * w - 40 * s
    p.rot('hips', z=yaw_h)
    p.rot('spine2', z=yaw_h * 0.3)
    neck(p, z=-yaw_h * 0.8)
    wings(p, 1.0 - 0.2 * s, lift=6 * s)
    for i, b in enumerate(TAILB):
        p.rot(b, z=(-10 * w + 19 * lag(i + 1)) * (1 + 0.12 * i), x=3 * max(w, lag(i + 1)))


def a_leap(t, T, p):
    crouch = env(t, 0.0, 0.25, 0.3, 0.42)
    air = env(t, 0.35, 0.48, 1.1, 1.25)
    land = env(t, 1.15, 1.25, 1.32, T)
    beat = math.sin(TAU * 2.2 * (t - 0.35)) if 0.35 < t < 1.2 else 0.0
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((0, 3.0 * air, 6.0 * air)))
        hind(p, side, BALL[side] + Vector((0, 3.0 * air, 6.0 * air)), FOOT_PITCH + 25 * air)
    p.loc('hips', (0, 0, -3.0 * crouch + 2.0 * air - 2.5 * land))
    p.rot('hips', x=6 * crouch + 4 * air + 6 * land)
    neck(p, x=-12 * air + 10 * land)
    p.rot('jaw', x=3 + 20 * air)
    wings(p, 1.0 - air * 0.95 - crouch * 0.3, lift=30 * beat * air + 10 * crouch)
    tail_wave(p, t, 0.6, lift=-2 * air)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.8, 2.6, 3.2)
    o = env(t, 0.5, 0.85, 2.5, 2.95)
    vib = math.sin(TAU * 18 * t) * o
    for side, sx in SIDES:
        hind(p, side, BALL[side] + Vector((sx * 1.0, 1.0 * r, 0)))
        fore(p, side, WRI[side] + Vector((0, 6.0 * r, 12.0 * r)), hand_pitch=40 * r)
    p.loc('hips', (0, 2.0 * r, 1.0 * r))
    p.rot('hips', x=-24 * r)
    p.rot('spine1', x=-8 * r)
    p.rot('spine2', x=-8 * r)
    neck(p, x=-40 * r, z=6 * math.sin(TAU * 0.6 * t) * o)
    p.rot('head', x=-6 * r + vib)
    p.rot('jaw', x=3 + 48 * o + 2 * vib)
    wings(p, 1.0 - r, lift=26 * r + 3 * vib, sweep=10 * r)
    tail_wave(p, t / T * 2, 1.5 * r, lift=3 * r)


def spit_pose(p, k):
    stand(p)
    p.loc('hips', (0, 0.8 * k, -0.6 * k))
    neck(p, x=-24 * k)
    p.rot('head', x=10 * k)
    p.rot('jaw', x=3 + 10 * k)
    wings(p, 1.0 - 0.35 * k, lift=14 * k)


def a_spit_in(t, T, p):
    spit_pose(p, smooth(t / T))


def a_spit_loop(t, T, p):
    # two retching heaves per loop, each throwing a glob
    spit_pose(p, 1.0)
    for c in (0.0, 0.5):
        h = env((t / T - c) % 1.0, 0.0, 0.12, 0.18, 0.4)
        neck(p, x=34 * h)
        p.rot('head', x=-18 * h)
        p.rot('jaw', x=34 * h)
        p.rot('chest', x=4 * h)


def a_spit_out(t, T, p):
    spit_pose(p, 1 - smooth(t / T))


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    stand(p)
    p.loc('hips', (0, 1.4 * h, -0.5 * h))
    neck(p, x=-10 * h, z=-20 * h)
    p.rot('jaw', x=3 + 20 * h)
    wings(p, 1.0 - 0.3 * h, lift=12 * h)


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.7) / 1.4)) ** 2
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((sx * 6 * f, -3 * f, 0)))
        hind(p, side, BALL[side] + Vector((sx * 5 * f, 3 * f, 0)))
    p.loc('hips', (0, 0, -10 * f))
    p.rot('hips', y=10 * f)
    neck(p, x=-20 * a + 40 * f, z=20 * f)
    p.rot('jaw', x=3 + 36 * a)
    wings(p, 1.0 - 0.6 * a + 0.2 * f, lift=20 * a - 30 * f)
    for i, b in enumerate(TAILB):
        p.rot(b, x=-2 * f, z=3 * f * math.sin(i * 0.5))


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_strike, 0.9, False),
    'attack2': (a_buffet, 1.1, False),
    'heavy': (a_tail, 1.6, False),
    'stomp': (a_leap, 1.5, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_spit_in, 0.6, False),
    'special_loop': (a_spit_loop, 1.0, True),
    'special_out': (a_spit_out, 0.6, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.2, False),
}

META = dict(
    height=46.0,
    preview_angle=35,
    sheet_angle=40,
    close=(0, -22, 34, 28),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.42, attack2=0.48, heavy=0.82, stomp=1.25),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.1]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['upperarmL', 'forearmL', 2.4], ['upperarmR', 'forearmR', 2.4], ['thighL', 'shinL', 3.0], ['thighR', 'shinR', 3.0],
          ['hips', 'chest', 6.0], ['neck1', 'head', 3.0], ['tail1', 'tail4', 3.2], ['tail4', 'tail9', 1.8]],
    aim=dict(head='head', chain=['neck2', 'neck3', 'head'], pitch0=0.43),
    feet=['toeL', 'toeR', 'handL', 'handR'],
    mouth='mouth',
)
