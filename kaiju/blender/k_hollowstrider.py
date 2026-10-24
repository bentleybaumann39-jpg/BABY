"""HOLLOWSTRIDER: a gaunt alien carried on four enormously long limbs. The forelimbs rise above
its hunched, ribbed body to high elbows before plunging to the ground; a pair of withered arms
hangs from its chest; a long jaw lolls a tongue; a whip tail ends in a forked tip. Pale, mottled,
wrinkled hide. Faces -Y, metres (~52 m to the elbows)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'hollowstrider'
VOXEL = 0.2
LOW_TRIS = 62000

J = dict(
    hips=(0, 8, 31), sp1=(0, 4, 34.5), sp2=(0, -1, 36.4), chest=(0, -6, 35.6), neck0=(0, -9.4, 33.6),
    neck1=(0, -12.6, 30.6), head0=(0, -15.4, 28.6),
    sho=(5.6, -6.4, 33.2), elb=(13.0, -12.4, 50.0), wri=(17.0, -21.6, 8.0), hand=(17.4, -23.4, 0.8),
    msho=(3.0, -9.6, 29.4), melb=(5.4, -12.8, 23.6), mwri=(4.6, -15.6, 18.6), mhand=(4.2, -17.2, 15.2),
    hip=(5.8, 9.6, 29.4), knee=(12.0, 1.6, 22.4), ankle=(12.6, 15.4, 9.0), ball=(12.6, 11.4, 1.2), toe=(12.8, 6.4, 0.7),
    t0=(0, 13, 28.6), t1=(0, 20, 24.4), t2=(0, 28, 19.6), t3=(0, 37, 14.8), t4=(0, 47, 10.8), t5=(0, 57, 8.6),
    t6=(0, 67, 9.0), t7=(0, 76, 11.6), t8=(0, 83, 16.2), t9=(0, 88, 22.6), t10=(0, 90, 30.0),
)
TAIL = ['t%d' % i for i in range(11)]
TAIL_R = [4.2, 3.6, 3.0, 2.5, 2.1, 1.8, 1.5, 1.25, 1.05, 0.9, 0.75]
NT = len(TAIL) - 1
FORK = [(2.8, 88.6, 38.4), (-2.8, 88.6, 38.4)]


def V(*a):
    return np.array(a, float)


def head_frame():
    o = V(*J['head0'])
    f = V(0, -0.93, -0.36)
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
    s.bone('neck2', 'neck1', J['neck1'], J['head0'])
    s.bone('head', 'neck2', J['head0'], H(0, 12.0, 0))
    s.bone('jaw', 'head', H(0, 1.6, -1.6), H(0, 12.6, -3.6))
    s.bone('mouth', 'head', H(0, 11.0, -2.0), H(0, 13.0, -2.0))
    s.bone('tongue1', 'jaw', H(0, 4.0, -1.8), H(0, 8.0, -2.2))
    s.bone('tongue2', 'tongue1', H(0, 8.0, -2.2), H(0, 11.6, -3.4))
    s.bone('tongue3', 'tongue2', H(0, 11.6, -3.4), H(0, 13.6, -6.0))
    s.bone('upperarm.L', 'chest', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['hand'], mirror=True)
    s.bone('minarm.L', 'chest', J['msho'], J['melb'], mirror=True)
    s.bone('minfore.L', 'minarm.L', J['melb'], J['mwri'], mirror=True)
    s.bone('minhand.L', 'minfore.L', J['mwri'], J['mhand'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['ball'], mirror=True)
    s.bone('toe.L', 'foot.L', J['ball'], J['toe'], mirror=True)
    prev = 'hips'
    for i in range(NT):
        s.bone(f'tail{i + 1}', prev, J[TAIL[i]], J[TAIL[i + 1]])
        prev = f'tail{i + 1}'
    s.bone('fork.L', prev, J['t10'], FORK[0])
    s.bone('fork.R', prev, J['t10'], FORK[1])
    return s


def knob(S, p, r, bone, k=0.8):
    S.ell(tuple(p), (r, r, r), bone=bone, k=k, mirror=True)


def sculpt():
    S = Sculpt()
    H, hp, f, u = head_frame()
    # hunched, bony torso with a hanging belly and visible ribs
    S.ell((0, 8.0, 31.0), (6.0, 6.4, 5.2), rot=(-8, 0, 0), bone='hips', k=2.6)
    S.ell((0, 3.6, 33.6), (5.6, 5.4, 5.6), rot=(-20, 0, 0), bone='spine1', k=2.6)
    S.ell((0, -1.2, 35.0), (7.4, 6.2, 6.8), rot=(-6, 0, 0), bone='spine2', k=2.8)
    S.ell((0, -5.8, 33.8), (7.2, 5.4, 6.6), rot=(24, 0, 0), bone='chest', k=2.6)
    S.ell((0, 2.0, 28.6), (4.8, 6.0, 4.0), rot=(-10, 0, 0), bone='spine1', k=2.4, mat='belly')  # sagging belly
    for i, y in enumerate((-4.6, -2.2, 0.2, 2.6, 4.8)):
        for sx in (1, -1):
            # ribs: thin arcs bulging under the skin
            S.cone((sx * 1.5, y, 40.6 - i * 0.6), (sx * 6.2, y + 0.8, 33.6 - i * 0.4), 0.7, 0.6, bone='spine2' if i < 3 else 'spine1', k=0.9)
            S.cone((sx * 6.2, y + 0.8, 33.6 - i * 0.4), (sx * 4.6, y + 1.4, 28.8 - i * 0.3), 0.6, 0.45, bone='spine2' if i < 3 else 'spine1', k=0.9)
    for y, z in ((-7.0, 38.8), (-3.6, 41.0), (0.2, 41.4), (4.0, 39.4), (7.8, 36.8)):
        S.ell((0, y, z), (1.4, 1.6, 1.2), bone='spine2' if y < 1 else 'spine1', k=0.9)  # vertebrae
    S.ell((0, -6.4, 38.2), (5.4, 3.2, 2.6), rot=(30, 0, 0), bone='chest', k=2.0)  # shoulder mass
    # neck hangs down and forward
    S.cone(J['neck0'], J['neck1'], 3.6, 3.0, bone='neck1', k=1.8)
    S.cone(J['neck1'], J['head0'], 3.0, 2.7, bone='neck2', k=1.6)
    # head: long narrow skull, heavy underslung jaw
    S.ell(H(0, 2.6, 0.6), (2.8, 4.4, 2.6), rot=(hp, 0, 0), bone='head', k=1.2)
    S.ell(H(0, 8.0, -0.4), (2.0, 4.6, 1.6), rot=(hp + 4, 0, 0), bone='head', k=1.0)
    S.ell(H(0, 1.0, 1.8), (2.4, 2.8, 2.0), rot=(hp - 10, 0, 0), bone='head', k=1.0)  # brain case
    for sx in (1, -1):
        S.ell(H(sx * 1.8, 5.6, 1.2), (0.5, 0.6, 0.4), op='sub', k=0.25)
        S.ell(H(sx * 2.4, 2.0, -0.6), (1.2, 2.4, 1.4), rot=(hp, 0, 0), bone='head', k=0.8)
    S.ell(H(0, 7.4, -3.2), (2.4, 5.6, 1.3), rot=(hp + 8, 0, 0), bone='jaw', k=0.8)
    S.cone(H(0, 2.2, -2.6), H(0, 12.4, -4.4), 1.9, 1.0, bone='jaw', k=0.8)
    S.ell(H(0, 7.6, -1.8), (2.6, 6.2, 0.45), rot=(hp + 6, 0, 0), op='sub', k=0.25, mat='mouth')
    S.chain([H(0, 4.0, -2.0), H(0, 8.0, -2.4), H(0, 11.6, -3.6), H(0, 13.8, -6.4)], [0.9, 0.75, 0.55, 0.3],
            ['tongue1', 'tongue2', 'tongue3'], k=0.4, mat='mouth')
    # forelimbs: up to a high elbow, then a long plunge to the ground
    S.ell((6.4, -6.6, 34.6), (3.2, 3.2, 3.6), bone='upperarm.L', k=1.8, mirror=True)
    S.cone(J['sho'], J['elb'], 3.0, 2.3, bone='upperarm.L', k=1.4, mirror=True)
    S.ell(tuple(V(*J['sho']) * 0.6 + V(*J['elb']) * 0.4), (2.4, 2.4, 4.2), rot=(-30, 20, 0), bone='upperarm.L', k=1.2, mirror=True)
    knob(S, V(*J['elb']), 2.2, 'forearm.L', 1.0)
    S.cone(J['elb'], J['wri'], 2.5, 1.4, bone='forearm.L', k=1.0, mirror=True)
    S.ell(tuple(V(*J['elb']) * 0.8 + V(*J['wri']) * 0.2), (2.6, 2.6, 6.4), rot=(10, -10, 0), bone='forearm.L', k=1.2, mirror=True)
    knob(S, V(*J['wri']), 1.5, 'hand.L', 0.7)
    S.cone(J['wri'], J['hand'], 1.3, 0.9, bone='hand.L', k=0.6, mirror=True)
    # withered chest arms
    S.cone(J['msho'], J['melb'], 1.1, 0.85, bone='minarm.L', k=0.8, mirror=True)
    S.cone(J['melb'], J['mwri'], 0.8, 0.6, bone='minfore.L', k=0.5, mirror=True)
    knob(S, V(*J['melb']), 0.95, 'minfore.L', 0.4)
    S.cone(J['mwri'], J['mhand'], 0.65, 0.45, bone='minhand.L', k=0.4, mirror=True)
    for fx in (-0.6, 0.0, 0.6):
        a = V(*J['mhand'])
        S.cone(a, a + V(fx, -0.8, -2.4), 0.3, 0.16, bone='minhand.L', k=0.2, mirror=True)
    # hind legs: long, knock-kneed, digitigrade
    S.cone(J['hip'], J['knee'], 3.4, 2.4, bone='thigh.L', k=1.8, mirror=True)
    S.ell(tuple(V(*J['hip']) * 0.55 + V(*J['knee']) * 0.45), (3.0, 3.6, 3.0), bone='thigh.L', k=1.6, mirror=True)
    knob(S, V(*J['knee']), 2.4, 'shin.L', 1.0)
    S.cone(J['knee'], J['ankle'], 2.2, 1.3, bone='shin.L', k=1.0, mirror=True)
    knob(S, V(*J['ankle']), 1.5, 'foot.L', 0.7)
    S.cone(J['ankle'], J['ball'], 1.3, 1.0, bone='foot.L', k=0.7, mirror=True)
    for fx, ln in ((-1.0, 3.6), (0.0, 4.6), (1.0, 3.6)):
        a = V(*J['ball']) + V(fx * 0.5, 0.2, 0)
        S.cone(a, a + V(fx * 0.6, -ln, -0.4), 0.75, 0.4, bone='toe.L', k=0.5, mirror=True)
    # whip tail with a forked tip
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(NT)], k=1.6)
    for fp, side in zip(FORK, ('L', 'R')):
        S.cone(J['t10'], fp, 0.7, 0.2, bone='fork.' + side, k=0.6)
    return S


_N = Noise(5)


def noise(P):
    # loose wrinkled skin over bone: strong folds, little scale texture
    n = 0.12 * _N.fbm(P, 0.16, 3) + 0.08 * (_N.ridged(P * np.array([1.0, 1.0, 2.6]), 0.5, 3) - 0.55)
    return n


def body_color(P, N, mats):
    n = len(P)
    pale = np.array([0.30, 0.29, 0.27])
    mot = np.clip(_N.fbm(P, 0.14, 4) * 1.6 + 0.2, 0, 1)
    rust = np.array([0.17, 0.10, 0.075])
    col = pale[None] * (1 - mot[:, None] * 0.75) + rust[None] * (mot[:, None] * 0.75)
    # raw red at the joints and digits, darker in skin creases
    raw = np.clip(_N.fbm(P + 40.0, 0.5, 2) * 2.0 - 0.3, 0, 1) * 0.6
    col = col * (1 - raw[:, None]) + np.array([0.24, 0.05, 0.04])[None] * raw[:, None]
    up = np.clip(N[:, 2], -1, 1)
    col *= (0.82 + 0.18 * np.clip(up + 0.5, 0, 1))[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.28, 0.05, 0.05])[None] * mouth[:, None]
    belly = np.clip(mats.get('belly', 0), 0, 1)
    col = col * (1 - 0.3 * belly[:, None]) + np.array([0.34, 0.31, 0.28])[None] * (0.3 * belly)[:, None]
    glow = np.array([0.9, 0.25, 0.08])[None] * (mouth * 0.35)[:, None]
    mask = np.stack([belly, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(31)
    H, hp, f, u = head_frame()
    L = Parts()
    # snaggled, uneven teeth
    L.row_of_teeth(H(1.9, 3.0, -1.0), H(0.5, 12.0, -1.4), 9, 1.9, 0.32, (0.2, 0, -1), 'head', rng, curve=0.4)
    L.row_of_teeth(H(1.8, 3.0, -2.4), H(0.5, 12.2, -3.6), 9, 2.2, 0.34, (0.3, 0.2, 1), 'jaw', rng, curve=0.5)
    L.sphere(H(1.8, 5.6, 1.2), 0.42, bone='head', mat='eye')
    # hoof-claws on the forelimbs and toes
    w, h = V(*J['wri']), V(*J['hand'])
    d = (h - w) / np.linalg.norm(h - w)
    L.horn(h - d * 1.2, d + V(0, -0.4, 0), 3.0, 1.0, bend=(0, -0.6, -0.3), bone='hand.L', mat='horn', seg=8, rings=4, flat=0.8)
    for fx, ln in ((-1.0, 3.6), (0.0, 4.6), (1.0, 3.6)):
        a = V(*J['ball']) + V(fx * 0.5, 0.2, 0)
        tip = a + V(fx * 0.6, -ln, -0.4)
        L.horn(tip + V(0, 0.2, 0.1), (fx * 0.1, -1, -0.3), 1.4, 0.42, bend=(0, 0, -0.4), bone='toe.L', mat='horn', seg=6, rings=3)
    # spore pustules down the spine and flanks: they light up when it vents
    for (x, y, z, r) in ((1.6, -3.0, 41.0, 0.9), (2.6, 0.6, 41.2, 1.1), (1.4, 3.4, 40.2, 0.8), (3.6, -1.0, 39.6, 0.7),
                         (2.8, 5.8, 38.4, 0.9), (4.8, 2.4, 37.6, 0.6), (1.8, 8.4, 36.0, 0.7)):
        top = on_surface(S, x, y)
        if top is None:
            continue
        nrm = normal_at(S, top)
        L.sphere(top - nrm * r * 0.3, r, bone=bone_at(S, top - nrm), mat='glow', seg=10, rings=7)
    L.mirrored()
    P.merge(L)
    # fork tips
    for fp, side in zip(FORK, ('L', 'R')):
        d = V(*fp) - V(*J['t10'])
        d /= np.linalg.norm(d)
        P.horn(V(*fp) - d * 0.8, d, 3.0, 0.5, bend=(0, -0.6, 0), bone='fork.' + side, mat='horn', seg=6, rings=4)
    return P


HARD = [('head', 'jaw'), ('jaw', 'tongue1'), ('jaw', 'tongue2'), ('head', 'tongue1'), ('head', 'tongue2'),
        ('chest', 'minarm.L'), ('chest', 'minarm.R'), ('fork.L', 'fork.R')]
WEIGHT_ITERS = 8

LOOK = dict(cell=0.5, wrinkle=2.2, scute=0.2, bump=0.32, cellvar=0.2, groove=0.35, wear=0.1,
            wearcol=(0.32, 0.3, 0.28), rough=0.42, cage=0.8, crag=0.22, noisew=0.6, folds=0.6, foldscale=0.65,
            folddist=15.0, glow=True)

PART_MATS = {
    'keratin': dict(color=(0.6, 0.55, 0.42), rough=0.35),
    'horn': dict(color=(0.16, 0.13, 0.11), rough=0.4),
    'eye': dict(color=(0.04, 0.03, 0.02), rough=0.05),
    'glow': dict(color=(0.5, 0.3, 0.2), rough=0.3, emissive=(1.0, 0.45, 0.2), emit=0.0),
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

WALK = dict(T=3.2, stride=18.0, duty=0.72, lift=5.0, phases={'hL': 0.0, 'fL': 0.25, 'hR': 0.5, 'fR': 0.75})
RUN = dict(T=1.7, stride=27.0, duty=0.45, lift=8.0, phases={'hL': 0.0, 'hR': 0.12, 'fL': 0.5, 'fR': 0.62})


def fore(p, side, wri, hand_pitch=0.0):
    sx = 1 if side == 'L' else -1
    p.ik('upperarm.' + side, 'forearm.' + side, wri, Vector((sx * 40, -18, 130)))
    d = Vector((HAND_DIR.x * sx, HAND_DIR.y, HAND_DIR.z))
    a = math.radians(hand_pitch)
    p.aim('hand.' + side, Vector((d.x, d.y * math.cos(a) - d.z * math.sin(a), d.y * math.sin(a) + d.z * math.cos(a))))


def hind(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    p.ik('thigh.' + side, 'shin.' + side, ball - d * FOOT_LEN, Vector((sx * 30, -36, 26)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def minarms(p, k=0.0, flail=0.0, t=0.0):
    for side, sx in SIDES:
        w = math.sin(TAU * 3 * t + (0 if side == 'L' else 1.7)) * flail
        p.rot('minarm.' + side, x=-30 * k + 25 * w, y=sx * 10 * k)
        p.rot('minfore.' + side, x=-40 * k - 20 * w)
        p.rot('minhand.' + side, x=-20 * k + 30 * w)


def tongue(p, out=0.0, wag=0.0):
    p.rot('tongue1', x=6 * out, z=wag * 0.4)
    p.rot('tongue2', x=10 * out, z=wag * 0.8)
    p.rot('tongue3', x=14 * out, z=wag)


def stand(p, fspread=0.0):
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((sx * fspread, 0, 0)))
        hind(p, side, BALL[side])


def tail_wave(p, ph, amp, lift=0.0):
    for i, b in enumerate(TAILB):
        p.rot(b, z=amp * (0.8 + i * 0.5) * math.sin(TAU * ph - 0.5 * (i + 1)),
              x=lift * (1 if i < 5 else 0.5) + 0.5 * amp * math.cos(TAU * ph - 0.6 * i))
    p.rot('fork.L', y=6 * math.sin(TAU * 2 * ph))
    p.rot('fork.R', y=-6 * math.sin(TAU * 2 * ph))


def gait(ph, p, g, bob, sway, tail, crouch=0.0, head=0.0):
    duty = g['duty']
    for side, sx in SIDES:
        sp = (ph + g['phases']['f' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'] * 1.4, duty)
        # forelimbs swing forward in a high arc, the claw tip leading
        fore(p, side, WRI[side] + Vector((0.0, -f, h)), hand_pitch=-25 * math.sin(math.pi * sw) if sp >= duty else 0)
        sp = (ph + g['phases']['h' + side]) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        fp = FOOT_PITCH + (14 * smooth((sp / duty - 0.6) / 0.4) if sp < duty else 14 * (1 - smooth(sw * 1.3)))
        tp = TOE_PITCH + (26 * math.sin(math.pi * sw) if sp >= duty else 0)
        hind(p, side, BALL[side] + Vector((0.0, -f, h)), fp, tp)
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    p.loc('hips', (sway * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    p.rot('hips', y=3 * s1, z=3 * math.sin(TAU * ph + 0.6))
    p.rot('spine1', z=-2 * math.sin(TAU * ph + 0.3), x=1.5 * c2)
    p.rot('spine2', z=-2.4 * math.sin(TAU * ph + 0.9), y=-2 * s1)
    p.rot('chest', z=-2 * math.sin(TAU * ph + 1.2))
    p.rot('neck1', x=head + 2.5 * c2, z=4 * math.sin(TAU * ph + 1.6))
    p.rot('head', x=-2.5 * c2 - head * 0.4, z=-3 * math.sin(TAU * ph + 1.6))
    p.rot('jaw', x=5 + 3 * max(0.0, c2))
    tongue(p, 0.3, 6 * math.sin(TAU * 2 * ph))
    minarms(p, 0.4, 0.15, ph)
    tail_wave(p, ph, tail, lift=1.0)


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.8, sway=0.6, tail=1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=2.0, sway=0.4, tail=1.6, crouch=1.6, head=6.0)


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0.4 * math.sin(TAU * ph), 0, 0.25 * b))
    p.rot('spine2', x=-1.2 * b)
    p.rot('neck1', z=8 * math.sin(TAU * ph + 1.0), x=2 * b)
    p.rot('head', z=10 * math.sin(TAU * ph + 0.4) + 4 * math.sin(TAU * 7 * ph) * (math.sin(TAU * ph + 2) > 0.85),
          x=3 * math.sin(TAU * 3 * ph))
    p.rot('jaw', x=6 + 6 * max(0.0, math.sin(TAU * 3 * ph)))
    tongue(p, 0.5 + 0.3 * math.sin(TAU * 2 * ph), 10 * math.sin(TAU * 4 * ph))
    minarms(p, 0.5, 0.3, t / 2)
    tail_wave(p, ph, 1.2, lift=1.5)


def a_stab(t, T, p):
    w = env(t, 0.0, 0.4, 0.44, 0.56)
    s = env(t, 0.44, 0.56, 0.7, T)
    for side, sx in SIDES:
        hind(p, side, BALL[side])
    fore(p, 'L', WRI['L'] + Vector((0, 2.0 * s, 0)))
    # raise the right forelimb high and drive the claw down into whatever is in front
    tgt = WRI['R'] + Vector((2.0, 4.0, 24.0)) * w + Vector((4.0, -22.0, -6.0)) * s
    fore(p, 'R', tgt, hand_pitch=30 * w - 20 * s)
    p.loc('hips', (-1.5 * w, 3.0 * w - 4.0 * s, 1.0 * w - 1.5 * s))
    p.rot('spine2', x=-6 * w + 8 * s, z=-6 * w + 4 * s)
    p.rot('chest', x=-4 * w + 6 * s)
    p.rot('neck1', x=-8 * w + 6 * s)
    p.rot('jaw', x=6 + 24 * s)
    tongue(p, 0.6 * s, 0)
    minarms(p, 0.8 * w, 0.3, t)
    tail_wave(p, 0.2, 0.6, lift=3 * w)


def a_bite(t, T, p):
    l = env(t, 0.05, 0.36, 0.5, T)
    o = env(t, 0.08, 0.3, 0.36, 0.48)
    stand(p)
    p.loc('hips', (0, -4.0 * l, -1.5 * l))
    p.rot('spine2', x=6 * l)
    p.rot('chest', x=8 * l)
    p.rot('neck1', x=-14 * o + 10 * l)
    p.rot('neck2', x=-8 * o + 6 * l)
    p.rot('head', x=-22 * o + 6 * l)
    p.rot('jaw', x=6 + 46 * o)
    tongue(p, 1.0 * o, 12 * o)
    minarms(p, 1.0 * l, 0.5 * l, t)
    tail_wave(p, 0.1, 0.4)


def a_lash(t, T, p):
    # scorpion lash: the tail arcs up over the back and whips the forked tip down in front
    w = env(t, 0.0, 0.5, 0.55, 0.7)
    lag = lambda i: env(t - 0.025 * i, 0.55, 0.85, 1.0, T)
    stand(p, 1.5)
    p.loc('hips', (0, 1.5 * w - 2.0 * lag(0), -1.0 * lag(0)))
    p.rot('spine1', x=-4 * w + 4 * lag(0))
    p.rot('neck1', x=8 * w)
    p.rot('jaw', x=6 + 20 * lag(0))
    # + x curls a trailing bone upward: coil up over the back, then the tip whips over and down in front
    for i, b in enumerate(TAILB):
        p.rot(b, x=(5 + i * 1.2) * w + (8 + i * 1.6) * lag(i + 1) * (1 if i < 7 else -0.6), z=2 * math.sin(i * 0.6) * w)
    p.rot('fork.L', y=20 * lag(10))
    p.rot('fork.R', y=-20 * lag(10))
    minarms(p, 0.6, 0.4, t)


def a_slam(t, T, p):
    # rear up on the hind legs, both forelimbs high, then hammer them down
    up = env(t, 0.05, 0.6, 0.68, 0.68)
    if 0.68 <= t < 0.92:
        q = (t - 0.68) / 0.24
        up = 1 - q * q
    elif t >= 0.92:
        up = 0.0
    imp = env(t, 0.9, 0.95, 1.1, T)
    for side, sx in SIDES:
        hind(p, side, BALL[side] + Vector((0, 1.0 * up, 0)))
        fore(p, side, WRI[side] + Vector((sx * -4.0 * up, 14.0 * up - 6.0 * imp, 30.0 * up)), hand_pitch=35 * up)
    p.loc('hips', (0, 4.0 * up, 4.0 * up - 2.5 * imp))
    p.rot('hips', x=-18 * up + 6 * imp)
    p.rot('spine1', x=-10 * up + 6 * imp)
    p.rot('spine2', x=-8 * up + 6 * imp)
    p.rot('neck1', x=-6 * up + 10 * imp)
    p.rot('jaw', x=6 + 36 * up + 10 * imp)
    tongue(p, up, 10 * up)
    minarms(p, up, 0.6 * up, t)
    for i, b in enumerate(TAILB):
        p.rot(b, x=5 * up - 3 * imp)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.7, 2.6, 3.2)
    o = env(t, 0.45, 0.85, 2.5, 2.95)
    vib = math.sin(TAU * 15 * t) * o
    stand(p, 1.0)
    p.loc('hips', (0, 2.0 * r, 2.0 * r))
    p.rot('hips', x=-8 * r)
    p.rot('spine2', x=-6 * r)
    p.rot('chest', x=-8 * r)
    p.rot('neck1', x=-26 * r)
    p.rot('neck2', x=-12 * r)
    p.rot('head', x=-12 * r + vib, z=6 * math.sin(TAU * 0.7 * t) * o)
    p.rot('jaw', x=6 + 50 * o + 2 * vib)
    tongue(p, 1.2 * o, 16 * math.sin(TAU * 3 * t) * o)
    minarms(p, 0.8 * r, 1.0 * r, t)
    tail_wave(p, t / T * 2, 1.8 * r, lift=4 * r)


def spray_pose(p, k, t=0.0):
    stand(p, 1.0)
    p.loc('hips', (0, -1.5 * k, -1.5 * k))
    p.rot('spine2', x=4 * k)
    p.rot('chest', x=6 * k)
    p.rot('neck1', x=-10 * k)
    p.rot('head', x=-12 * k)
    p.rot('jaw', x=6 + 44 * k)
    tongue(p, 0.2 * k, 0)
    minarms(p, 0.9 * k, 0.2 * k, t)
    for i, b in enumerate(TAILB):
        p.rot(b, x=3 * k)


def a_spray_in(t, T, p):
    spray_pose(p, smooth(t / T), t)
    p.rot('spine2', y=4 * math.sin(TAU * 4 * t))


def a_spray_loop(t, T, p):
    spray_pose(p, 1.0, t)
    c = math.sin(TAU * 7 * t / T)
    p.rot('spine1', x=1.5 * c)
    p.rot('spine2', x=-1.5 * c)
    p.rot('head', z=5 * math.sin(TAU * t / T), x=1.2 * c)


def a_spray_out(t, T, p):
    spray_pose(p, 1 - smooth(t / T), t)


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    stand(p)
    p.loc('hips', (0, 1.6 * h, -1.0 * h))
    p.rot('spine2', y=-6 * h)
    p.rot('neck1', z=-14 * h)
    p.rot('head', z=-18 * h, x=-10 * h)
    p.rot('jaw', x=6 + 26 * h)
    minarms(p, h, h, t)


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.6) / 1.6)) ** 2
    for side, sx in SIDES:
        fore(p, side, WRI[side] + Vector((sx * 14 * f, -6 * f, 0)))
        hind(p, side, BALL[side] + Vector((sx * 10 * f, 4 * f, 0)))
    p.loc('hips', (0, 0, -16 * f))
    p.rot('hips', y=8 * f)
    p.rot('neck1', x=-20 * a + 26 * f)
    p.rot('head', x=-10 * a + 10 * f, y=14 * f)
    p.rot('jaw', x=6 + 40 * a)
    tongue(p, 1.5 * f, 0)
    minarms(p, a - f, a, t)
    for i, b in enumerate(TAILB):
        p.rot(b, x=-3 * f, z=3 * f * math.sin(i * 0.5))


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_stab, 1.3, False),
    'attack2': (a_bite, 1.0, False),
    'heavy': (a_lash, 1.6, False),
    'stomp': (a_slam, 1.6, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_spray_in, 0.9, False),
    'special_loop': (a_spray_loop, 1.2, True),
    'special_out': (a_spray_out, 0.7, False),
    'hit': (a_hit, 0.7, False),
    'death': (a_death, 3.4, False),
}

META = dict(
    height=52.0,
    preview_angle=50,
    sheet_angle=60,
    close=(0, -20, 30, 30),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.6, attack2=0.33, heavy=0.85, stomp=0.95),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.12]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['upperarmL', 'forearmL', 3.0], ['upperarmR', 'forearmR', 3.0], ['forearmL', 'handL', 2.4], ['forearmR', 'handR', 2.4],
          ['thighL', 'shinL', 3.2], ['thighR', 'shinR', 3.2], ['hips', 'chest', 7.4], ['chest', 'head', 4.0],
          ['tail1', 'tail4', 3.0], ['tail4', 'tail8', 1.8]],
    aim=dict(head='head', chain=['neck1', 'neck2', 'head'], pitch0=0.38),
    feet=['toeL', 'toeR', 'handL', 'handR'],
    mouth='mouth',
    springs=[{'bones': ['tail%d' % (i + 1) for i in range(10)], 'yaw': 1.2, 'pitch': 1.0, 'gain': 0.2},
             {'bones': ['tongue1', 'tongue2', 'tongue3'], 'yaw': 1.5, 'pitch': 2.0, 'gain': 0.5}],
)
