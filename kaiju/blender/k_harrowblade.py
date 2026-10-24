"""HARROWBLADE: a fast alien stalker. Its skull runs forward into a long vertical knife blade,
a shark-like dorsal fin rises from its back, glowing chevrons run down its flanks and the inside
of its mouth burns blue. Digitigrade legs, finned tail. Faces -Y, metres (~50 m to the fin)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'harrowblade'
VOXEL = 0.2
LOW_TRIS = 60000

J = dict(
    hips=(0, 6, 27.5), sp1=(0, 1, 31.0), sp2=(0, -4.5, 34.0), chest=(0, -10, 36.4), neck0=(0, -13.6, 38.6),
    neck1=(0, -17.6, 40.4), head0=(0, -21.6, 41.4),
    clav=(2.6, -11, 36.6), sho=(7.0, -12.6, 35.4), elb=(9.6, -9.8, 28.0), wri=(8.6, -16.8, 24.4), hand=(8.2, -20.0, 22.6),
    hip=(6.6, 6.2, 26.4), knee=(8.2, -2.4, 17.4), ankle=(8.2, 7.6, 8.6), ball=(8.2, 3.4, 1.4), toe=(8.4, -2.8, 0.8),
    t0=(0, 12, 26.6), t1=(0, 19, 25.2), t2=(0, 27, 23.4), t3=(0, 36, 21.2), t4=(0, 46, 18.8), t5=(0, 56, 16.4),
    t6=(0, 66, 14.4), t7=(0, 76, 13.0), t8=(0, 85, 12.4), t9=(0, 93, 12.6),
)
TAIL = ['t%d' % i for i in range(10)]
TAIL_R = [6.4, 5.6, 4.8, 4.0, 3.3, 2.6, 2.0, 1.5, 1.1, 0.6]
NT = len(TAIL) - 1
FINGERS = [((-1.0, -1.0, -0.2), (-1.8, -4.4, -3.4)), ((0.1, -1.2, -0.3), (0.2, -5.0, -3.8)), ((1.2, -0.8, -0.2), (2.2, -4.0, -3.2))]
HS = 1.0


def V(*a):
    return np.array(a, float)


def head_frame():
    o = V(*J['head0'])
    f = V(0, -0.985, -0.17)
    f /= np.linalg.norm(f)
    u = np.cross(V(1, 0, 0), f)
    u = -u if u[2] < 0 else u
    pitch = math.degrees(math.atan2(-f[2], -f[1]))

    def H(x, y, z):
        return tuple(o + (V(1, 0, 0) * x + f * y + u * z) * HS)
    return H, pitch, f, u


def finger_pts(i, side='L'):
    h = V(*J['hand'])
    k, t = FINGERS[i]
    a, b = h + V(*k), h + V(*t)
    if side == 'R':
        a[0], b[0] = -a[0], -b[0]
    return a, b


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
    s.bone('head', 'neck2', J['head0'], H(0, 14.0, 0))
    s.bone('jaw', 'head', H(0, 1.0, -2.4), H(0, 12.5, -4.0))
    s.bone('mouth', 'head', H(0, 12.0, -2.6), H(0, 14.0, -2.6))
    s.bone('clavicle.L', 'chest', J['clav'], J['sho'], mirror=True)
    s.bone('upperarm.L', 'clavicle.L', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['hand'], mirror=True)
    for i in range(3):
        a, b = finger_pts(i)
        s.bone(f'finger{i + 1}.L', 'hand.L', tuple(a), tuple(b), mirror=True)
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
    # torso: deep-chested and lean, sloping down to the hips
    S.ell((0, 5.6, 27.4), (7.0, 7.4, 6.2), rot=(-14, 0, 0), bone='hips', k=3)
    S.ell((0, 0.6, 30.6), (6.6, 6.6, 6.4), rot=(-24, 0, 0), bone='spine1', k=3)
    S.ell((0, -4.6, 33.6), (7.8, 6.6, 7.4), rot=(-30, 0, 0), bone='spine2', k=3)
    S.ell((0, -9.6, 36.0), (8.2, 6.0, 7.0), rot=(-36, 0, 0), bone='chest', k=3)
    S.ell((0, -8.0, 30.6), (5.0, 4.4, 5.2), rot=(-30, 0, 0), bone='spine2', k=2.6, mat='belly')  # keel
    # neck: long, muscular
    S.cone(J['neck0'], J['neck1'], 5.2, 4.4, bone='neck1', k=2.2)
    S.cone(J['neck1'], J['head0'], 4.4, 3.8, bone='neck2', k=1.8)
    S.ell((0, -17.0, 37.6), (3.4, 3.6, 3.0), rot=(-30, 0, 0), bone='neck1', k=1.8, mat='belly')
    # head: a long skull whose roof runs forward into the knife blade
    S.ell(H(0, 3.0, 0.4), (3.4, 5.0, 3.0), rot=(hp, 0, 0), bone='head', k=1.4)
    S.ell(H(0, 9.0, -1.0), (2.4, 5.2, 1.8), rot=(hp, 0, 0), bone='head', k=1.2)  # upper jaw
    for sx in (1, -1):
        S.ell(H(sx * 2.6, 2.4, -0.6), (1.6, 3.0, 1.8), rot=(hp, 0, 0), bone='head', k=0.9)  # cheek
        S.ell(H(sx * 2.0, 5.6, 1.0), (0.6, 0.8, 0.5), op='sub', k=0.25)  # eye pits
    # the blade: a vertical knife from the brow forward and up, thick at the root, keen at the tip
    S.blade(H(0, -1.0, 4.4), H(0, 23.0, 6.4), u, (6.6, 0.7), (1.5, 0.28), n=14, bone='head', k=0.6, mat='blade')
    S.blade(H(0, -2.0, 6.0), H(0, 4.0, 12.6), f, (3.6, 0.8), (1.1, 0.3), n=6, bone='head', k=0.7, mat='blade')  # rear spur
    # lower jaw and mouth
    S.ell(H(0, 7.0, -3.0), (2.2, 5.6, 1.2), rot=(hp + 3, 0, 0), bone='jaw', k=0.8)
    S.cone(H(0, 2.0, -3.0), H(0, 12.0, -3.4), 1.9, 0.9, bone='jaw', k=0.8)
    S.ell(H(0, 7.6, -2.0), (2.8, 6.4, 0.4), rot=(hp + 3, 0, 0), op='sub', k=0.25, mat='mouth')
    # dorsal fin: a tall swept shark fin over the shoulders, smaller ones down the tail
    S.blade((0, -6.0, 41.2), (0, 6.0, 55.0), (0, -1, 0.35), (5.4, 0.8), (0.9, 0.22), n=9, bone='spine2', k=1.0, mat='fin')
    for y0, h in ((14, 4.6), (23, 3.8), (32, 3.0)):
        z0 = np.interp(y0, [12, 19, 27, 36], [26.6, 25.2, 23.4, 21.2]) + TAIL_R[min(3, int((y0 - 12) / 8))] * 0.7
        S.blade((0, y0 - 2, z0), (0, y0 + 3.5, z0 + h), (0, -1, 0.3), (2.2, 0.4), (0.5, 0.15), n=4,
                bone=f'tail{1 + int((y0 - 12) / 8)}', k=0.6, mat='fin')
    # arms: medium, sinewy
    S.ell((7.6, -12.4, 35.6), (3.4, 3.4, 3.6), bone='clavicle.L', k=2.0, mirror=True)
    S.cone(J['sho'], J['elb'], 2.7, 2.1, bone='upperarm.L', k=1.4, mirror=True)
    S.ell((8.6, -11.4, 31.8), (1.9, 2.0, 3.2), rot=(14, 0, 0), bone='upperarm.L', k=1.2, mirror=True)
    S.cone(J['elb'], J['wri'], 2.2, 1.5, bone='forearm.L', k=1.2, mirror=True)
    S.blade(V(*J['elb']) + V(0.6, 0.6, 0.4), V(*J['wri']) + V(0.6, 1.4, 1.0), (1, 0, 0.3), (1.8, 0.4), (0.45, 0.2), n=5,
            bone='forearm.L', k=0.6, mat='fin', mirror=True)  # forearm fin
    S.ell((8.4, -18.6, 23.4), (1.8, 2.2, 1.3), rot=(40, 0, 0), bone='hand.L', k=0.8, mirror=True)
    for i in range(3):
        a, b = finger_pts(i)
        S.cone(a, b, 0.7, 0.4, bone=f'finger{i + 1}.L', k=0.35, mirror=True)
    # legs: digitigrade, powerful thighs
    S.cone(J['hip'], J['knee'], 5.8, 3.6, bone='thigh.L', k=2.6, mirror=True)
    S.ell((7.8, 2.6, 21.4), (4.4, 6.0, 6.6), rot=(-36, 0, 0), bone='thigh.L', k=2.2, mirror=True)
    S.cone(J['knee'], J['ankle'], 3.4, 2.0, bone='shin.L', k=1.4, mirror=True)
    S.ell((8.2, 1.6, 14.0), (2.6, 3.0, 3.8), rot=(46, 0, 0), bone='shin.L', k=1.2, mirror=True)
    S.cone(J['ankle'], J['ball'], 2.0, 1.6, bone='foot.L', k=1.0, mirror=True)
    S.ell(tuple(V(*J['ankle']) + V(0, 0.8, 0)), (2.0, 1.8, 1.8), bone='foot.L', k=1.0, mirror=True)  # hock
    for fx, ln in ((-1.6, 4.0), (0.0, 5.6), (1.6, 4.0)):
        a = V(*J['ball']) + V(fx * 0.6, 0.2, -0.1)
        S.cone(a, a + V(fx * 0.5, -ln, -0.4), 1.05, 0.6, bone='toe.L', k=0.6, mirror=True)
    # tail with a tall caudal fin
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(NT)], k=2.0)
    S.blade((0, 74, 13.6), (0, 95, 26.0), (0, -0.6, 1), (3.0, 0.5), (0.6, 0.18), n=7,
            bone=['tail7', 'tail7', 'tail8', 'tail8', 'tail9', 'tail9', 'tail9'], k=0.8, mat='fin')
    S.blade((0, 78, 11.6), (0, 94, 3.4), (0, -0.4, -1), (2.4, 0.4), (0.55, 0.16), n=6,
            bone=['tail7', 'tail8', 'tail8', 'tail9', 'tail9', 'tail9'], k=0.8, mat='fin')
    return S


_N = Noise(77)


def noise(P):
    # tight, shark-like hide with fine ridges; smooth over the blade and fins
    n = 0.07 * _N.fbm(P, 0.12, 2) + 0.12 * (_N.ridged(P, 0.55, 3) - 0.55)
    calm = 1.0 - 0.6 * np.clip((np.abs(P[:, 0]) < 1.4) * ((P[:, 2] > 42) | (P[:, 1] > 70)), 0, 1)
    return n * calm


GLOW = np.array([0.1, 0.75, 1.0])


def body_color(P, N, mats):
    n = len(P)
    back = np.array([0.018, 0.026, 0.038])
    belly = np.array([0.07, 0.08, 0.09])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.2 + np.clip(-up - 0.3, 0, 1) * 0.5, 0, 1)
    col = back[None] * (1 - t[:, None]) + belly[None] * t[:, None]
    blade = np.clip(mats.get('blade', 0), 0, 1)
    fin = np.clip(mats.get('fin', 0), 0, 1)
    col = col * (1 - blade[:, None] * 0.3) + np.array([0.012, 0.016, 0.024])[None] * (blade * 0.3)[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.02, 0.06, 0.08])[None] * mouth[:, None]
    # chevron photophores down the flanks, limbs and tail: slanted bands on side-facing skin
    side = np.clip((np.abs(N[:, 0]) - 0.55) * 3.0, 0, 1)
    phase = P[:, 1] + np.abs(P[:, 2] - 26 + P[:, 1] * 0.1) * 0.7
    chev = np.clip((np.sin(phase * 2 * np.pi / 6.5) - 0.94) * 16.0, 0, 1) * side * (1 - t)
    chev *= np.clip((P[:, 2] - 12.0) / 6.0, 0, 1) * 0.8  # flanks and tail, not the lower legs
    # two running lines along each side of the blade
    bl = blade * np.clip(1 - np.abs(np.sin((P[:, 2] - 40.0 + P[:, 1] * 0.17) * 0.9)) * 6.0, 0, 1) * (P[:, 1] < -24)
    g = np.clip(chev * (1 - blade) * (1 - fin * 0.5) + bl, 0, 1)
    glow = GLOW[None] * g[:, None] + np.array([0.15, 0.85, 1.0])[None] * (mouth * 0.9)[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    P = Parts()
    rng = np.random.default_rng(23)
    H, hp, f, u = head_frame()
    L = Parts()
    L.row_of_teeth(H(2.2, 3.0, -1.6), H(0.6, 13.6, -1.8), 12, 1.5, 0.3, (0, 0, -1), 'head', rng)
    L.row_of_teeth(H(2.0, 3.2, -2.4), H(0.5, 12.6, -2.6), 11, 1.3, 0.27, (0, 0, 1), 'jaw', rng)
    for (x, y, z, r) in ((2.0, 5.6, 1.0, 0.5), (2.3, 4.4, 1.4, 0.36)):
        L.sphere(H(x, y, z), r, bone='head', mat='eye')
    for i in range(3):
        a, b = finger_pts(i)
        d = (b - a) / np.linalg.norm(b - a)
        L.horn(b - d * 0.4, d + V(0, -0.3, 0), 3.2, 0.5, bend=(0, 0.6, -1.0), bone=f'finger{i + 1}.L', mat='horn',
               seg=7, rings=5, flat=0.7, tip=0.03)
    for fx, ln in ((-1.6, 4.0), (0.0, 5.6), (1.6, 4.0)):
        a = V(*J['ball']) + V(fx * 0.6, 0.2, -0.1)
        tip = a + V(fx * 0.5, -ln, -0.4)
        L.horn(tip + V(0, 0.3, 0.2), (fx * 0.15, -1, -0.45), 2.2 if fx else 2.8, 0.55, bend=(0, 0, -0.7), bone='toe.L',
               mat='horn', seg=7, rings=4, flat=0.7)
    # sickle claw on the inner toe and a spur at the hock
    L.horn(V(*J['ball']) + V(-1.4, -0.6, 1.0), (-0.2, -0.6, 0.8), 3.0, 0.7, bend=(0, -1.2, -1.2), bone='toe.L', mat='horn',
           seg=7, rings=5, flat=0.7)
    L.horn(V(*J['ankle']) + V(0.4, 1.8, 0.2), (0.1, 1, 0.3), 2.2, 0.6, bend=(0, 0.3, 0.5), bone='foot.L', mat='horn', seg=6, rings=3)
    L.mirrored()
    P.merge(L)
    return P


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 9

LOOK = dict(cell=0.9, wrinkle=3.2, scute=0.26, bump=0.24, cellvar=0.25, groove=0.4, wear=0.15,
            wearcol=(0.1, 0.12, 0.14), rough=0.38, cage=0.9, crag=0.4, noisew=0.4, folds=0.2, foldscale=0.7,
            glow=True)

PART_MATS = {
    'keratin': dict(color=(0.8, 0.84, 0.86), rough=0.25),
    'horn': dict(color=(0.05, 0.06, 0.07), rough=0.35),
    'eye': dict(color=(0.5, 0.95, 1.0), rough=0.1, emissive=(0.3, 0.9, 1.0), emit=4.0),
}


# ============================================================================= animation
from rig import env, smooth, foot_cycle
from mathutils import Vector

TAU = 2 * math.pi
BALL = {'L': Vector(J['ball']), 'R': Vector((-J['ball'][0], J['ball'][1], J['ball'][2]))}
FOOT_LEN = (Vector(J['ball']) - Vector(J['ankle'])).length
FOOT_PITCH = math.degrees(math.atan2(J['ankle'][2] - J['ball'][2], J['ankle'][1] - J['ball'][1]))
TOE_PITCH = math.degrees(math.atan2(J['ball'][2] - J['toe'][2], J['ball'][1] - J['toe'][1]))
TAILB = [f'tail{i + 1}' for i in range(NT)]
SIDES = (('L', 1), ('R', -1))

WALK = dict(T=2.0, stride=17.0, duty=0.6, lift=3.6)
RUN = dict(T=1.15, stride=26.0, duty=0.42, lift=6.0)


def leg(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    p.ik('thigh.' + side, 'shin.' + side, ball - d * FOOT_LEN, Vector((sx * 9, -34, 20)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def claws(p, side, curl=0.0, spread=0.0):
    sx = 1 if side == 'L' else -1
    for i in range(3):
        p.rot(f'finger{i + 1}.{side}', x=curl, z=sx * spread * (i - 1))


def stand(p, spread=0.0, crouch=0.0):
    for side, sx in SIDES:
        leg(p, side, BALL[side] + Vector((sx * spread, 0, 0)))
    if crouch:
        p.loc('hips', (0, 0, -crouch))


def arms_tuck(p, k=1.0):
    for side, sx in SIDES:
        p.rot('upperarm.' + side, x=-10 * k, y=-sx * 6 * k)
        p.rot('forearm.' + side, x=-26 * k)
        claws(p, side, curl=14 * k)


def tail_wave(p, ph, amp, lift=0.0):
    for i, b in enumerate(TAILB):
        p.rot(b, z=amp * (1.0 + i * 0.6) * math.sin(TAU * ph - 0.55 * (i + 1)),
              x=lift + 0.4 * amp * math.cos(2 * TAU * ph - 0.5 * i))


def gait(ph, p, g, bob, sway, lean, arm, tail, crouch=0.0, head=0.0):
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    duty = g['duty']
    for side, off in (('L', 0.0), ('R', 0.5)):
        sp = (ph + off) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        if sp < duty:
            k = smooth((sp / duty - 0.55) / 0.45)
            fp, tp = FOOT_PITCH + 18 * k, TOE_PITCH - 10 * k
        else:
            fp = FOOT_PITCH + 18 * (1 - smooth(sw * 1.3)) - 8 * math.sin(math.pi * sw)
            tp = TOE_PITCH + 30 * math.sin(math.pi * sw)
        leg(p, side, BALL[side] + Vector((0.0, -f, h)), fp, tp)
    p.loc('hips', (sway * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    p.rot('hips', x=lean * 0.4, y=2.5 * s1, z=4.0 * s1)
    p.rot('spine1', x=lean * 0.25, z=-1.6 * s1)
    p.rot('spine2', x=lean * 0.2, z=-1.8 * s1)
    p.rot('chest', z=-1.4 * s1)
    p.rot('neck1', x=-lean * 0.5 + head + 2.0 * c2)
    p.rot('neck2', x=-lean * 0.2)
    p.rot('head', x=-2.0 * c2 - head * 0.3, z=-1.6 * s1)
    p.rot('jaw', x=3)
    for side, sx in SIDES:
        p.rot('upperarm.' + side, x=-arm * s1 * sx - 8, y=-sx * 4)
        p.rot('forearm.' + side, x=-24 - arm * 0.3 * s1 * sx)
        claws(p, side, curl=12)
    tail_wave(p, ph, tail, lift=1.2)


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.8, sway=0.8, lean=4.0, arm=6.0, tail=1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=1.6, sway=0.5, lean=16.0, arm=10.0, tail=1.4, crouch=1.8)


def a_charge(t, T, p):
    # head down, blade levelled forward like a lance
    gait(t / T, p, RUN, bob=1.4, sway=0.4, lean=22.0, arm=4.0, tail=0.9, crouch=2.6, head=14.0)
    p.rot('jaw', x=10)
    arms_tuck(p, 1.2)


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = math.sin(TAU * 2 * ph)
    p.rot('spine2', x=-0.8 * b)
    p.rot('chest', x=-0.8 * b)
    p.loc('hips', (0.3 * math.sin(TAU * ph), 0, 0.15 * b))
    p.rot('neck1', z=6 * math.sin(TAU * ph + 1.0), x=1.0 * b)
    p.rot('head', z=8 * math.sin(TAU * ph + 0.4) + 3 * math.sin(TAU * 5 * ph) * (math.sin(TAU * ph) > 0.8),
          x=2.0 * math.sin(TAU * 3 * ph))
    p.rot('jaw', x=3 + 2 * max(0.0, math.sin(TAU * 4 * ph)))
    arms_tuck(p, 0.6 + 0.2 * math.sin(TAU * ph))
    tail_wave(p, ph, 1.0, lift=1.0)


def a_slash(t, T, p):
    # the head itself is the weapon: coil the neck right, then cut the blade across to the left
    w = env(t, 0.0, 0.32, 0.36, 0.48)
    s = env(t, 0.36, 0.5, 0.6, T)
    stand(p, 0.8)
    yaw = -30 * w + 52 * s
    p.loc('hips', (0, -1.6 * s, -0.8 * (w + s)))
    p.rot('hips', z=yaw * 0.12)
    for b, k in (('spine1', 0.12), ('spine2', 0.16), ('chest', 0.2)):
        p.rot(b, z=yaw * k, x=3 * s)
    p.rot('neck1', z=yaw * 0.35, x=-6 * w + 8 * s)
    p.rot('neck2', z=yaw * 0.3)
    p.rot('head', z=yaw * 0.3, y=-18 * w + 24 * s, x=-6 * w + 4 * s)
    p.rot('jaw', x=3 + 16 * w)
    arms_tuck(p, 1.0)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-yaw * 0.06 * (1 + 0.4 * i))


def a_swipe(t, T, p):
    w = env(t, 0.0, 0.3, 0.34, 0.46)
    s = env(t, 0.32, 0.46, 0.56, T)
    stand(p, 0.8)
    twist = 20 * w - 36 * s
    p.loc('hips', (0, -1.4 * s, -0.5 * s))
    for b, k in (('spine1', 0.25), ('spine2', 0.3), ('chest', 0.35)):
        p.rot(b, z=twist * k)
    p.rot('neck1', z=-twist * 0.3)
    p.rot('head', z=-twist * 0.25, x=-4 * w)
    p.rot('jaw', x=3 + 22 * s)
    p.rot('upperarm.R', x=-70 * w - 30 * s, y=-30 * w + 50 * s, z=-30 * s)
    p.rot('forearm.R', x=-40 * w + 30 * s)
    p.rot('hand.R', x=-20 * w + 30 * s)
    claws(p, 'R', curl=-20 * w + 40 * s, spread=10 * w)
    p.rot('upperarm.L', x=-12, y=8)
    p.rot('forearm.L', x=-30)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-twist * 0.05 * (1 + 0.3 * i))


def a_tail(t, T, p):
    stand(p, 1.0)
    w = env(t, 0.0, 0.42, 0.48, 0.66)
    lag = lambda i: env(t - 0.03 * i, 0.5, 0.88, 1.0, T)
    s = lag(0)
    yaw_h = 24 * w - 46 * s
    p.rot('hips', z=yaw_h, x=3 * s)
    p.loc('hips', (0, 0, -1.0 * (w + s)))
    for b in ('spine1', 'spine2', 'chest'):
        p.rot(b, z=yaw_h * 0.2)
    p.rot('neck1', z=-yaw_h * 0.4)
    p.rot('head', z=-yaw_h * 0.3)
    p.rot('jaw', x=3 + 10 * s)
    arms_tuck(p, 1.0)
    for i, b in enumerate(TAILB):
        k = 1 + 0.15 * i
        p.rot(b, z=(-10 * w + 19 * lag(i + 1)) * k, x=2.5 * max(w, lag(i + 1)))


def a_pounce(t, T, p):
    crouch = env(t, 0.0, 0.25, 0.3, 0.42)
    air = env(t, 0.35, 0.5, 1.1, 1.25)
    land = env(t, 1.15, 1.25, 1.32, T)
    for side, sx in SIDES:
        leg(p, side, BALL[side] + Vector((0, 2.0 * air, 8.0 * air)), FOOT_PITCH + 30 * air, TOE_PITCH + 30 * air)
    p.loc('hips', (0, 0, -4.0 * crouch + 2.0 * air - 3.0 * land))
    p.rot('hips', x=10 * crouch + 6 * air + 8 * land)
    p.rot('neck1', x=-14 * air + 8 * land)
    p.rot('head', x=-6 * air)
    p.rot('jaw', x=3 + 30 * air)
    for side, sx in SIDES:
        p.rot('upperarm.' + side, x=-60 * air, y=sx * 20 * air)
        p.rot('forearm.' + side, x=-20 * air)
        claws(p, side, curl=-20 * air + 30 * land, spread=12 * air)
    for i, b in enumerate(TAILB):
        p.rot(b, x=(2.5 if i < 4 else -1.0) * air + 2 * land)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.7, 2.4, 3.0)
    o = env(t, 0.45, 0.8, 2.3, 2.8)
    vib = math.sin(TAU * 19 * t) * o
    stand(p, 1.0)
    p.loc('hips', (0, 1.4 * r, 1.0 * r))
    p.rot('hips', x=-12 * r)
    for b, k in (('spine1', -5), ('spine2', -6), ('chest', -6), ('neck1', -20), ('neck2', -12)):
        p.rot(b, x=k * r)
    p.rot('head', x=-14 * r + 0.8 * vib, z=4 * math.sin(TAU * 0.6 * t) * o)
    p.rot('jaw', x=3 + 50 * o + 1.5 * vib)
    for side, sx in SIDES:
        p.rot('upperarm.' + side, y=sx * 40 * r, x=-34 * r)
        p.rot('forearm.' + side, x=-30 * r)
        claws(p, side, curl=-20 * r, spread=14 * r)
    tail_wave(p, t / T, 1.2 * r, lift=3 * r)


def a_charge_in(t, T, p):
    k = smooth(t / T)
    stand(p, 1.0, crouch=2.0 * k)
    p.rot('hips', x=10 * k)
    p.rot('neck1', x=12 * k + 10 * math.sin(math.pi * t / T))
    p.rot('head', x=-6 * k)
    p.rot('jaw', x=3 + 30 * math.sin(math.pi * t / T))
    arms_tuck(p, 1.2 * k)


def a_charge_out(t, T, p):
    k = 1 - smooth(t / T)
    skid = env(t, 0.0, 0.1, 0.3, T)
    for side, sx in SIDES:
        leg(p, side, BALL[side] + Vector((sx * 1.0, -3.0 * skid if side == 'L' else 2.0 * skid, 0)))
    p.loc('hips', (0, 1.2 * skid, -2.0 * k))
    p.rot('hips', x=10 * k - 8 * skid)
    p.rot('neck1', x=12 * k - 6 * skid)
    arms_tuck(p, k)


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    stand(p)
    p.loc('hips', (0, 1.4 * h, -0.4 * h))
    p.rot('spine2', y=-5 * h, x=-4 * h)
    p.rot('neck1', z=-12 * h)
    p.rot('head', z=-16 * h, x=-8 * h)
    p.rot('jaw', x=3 + 22 * h)
    for i, b in enumerate(TAILB):
        p.rot(b, z=4 * h * math.sin(i * 0.7))


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.9) / 1.3)) ** 2
    bounce = math.sin(max(0.0, t - 2.2) * 9) * math.exp(-max(0.0, t - 2.2) * 4) * (t > 2.2)
    if t < 0.9:
        stand(p)
    else:
        for side, sx in SIDES:
            p.rot('thigh.' + side, x=-18 * f, y=-sx * 8 * f)
            p.rot('shin.' + side, x=14 * f)
    p.rot('root', y=-86 * f - 2 * bounce)
    p.loc('root', (-3.0 * f, 0, 5.0 * f))
    p.rot('spine1', x=-5 * a, y=-6 * f)
    p.rot('neck1', x=-16 * a + 12 * f, y=-8 * f)
    p.rot('head', x=-10 * a + 6 * f, y=-12 * f)
    p.rot('jaw', x=3 + 32 * a + 16 * f)
    arms_tuck(p, 1 - a)
    for i, b in enumerate(TAILB):
        p.rot(b, z=2.5 * f, x=-1.0 * f)


ANIMS = {
    'idle': (a_idle, 5.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_slash, 1.1, False),
    'attack2': (a_swipe, 1.0, False),
    'heavy': (a_tail, 1.7, False),
    'stomp': (a_pounce, 1.5, False),
    'roar': (a_roar, 3.1, False),
    'special_in': (a_charge_in, 0.7, False),
    'special_loop': (a_charge, RUN['T'], True),
    'special_out': (a_charge_out, 0.7, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.4, False),
}

META = dict(
    height=55.0,
    preview_angle=40,
    sheet_angle=60,
    close=(0, -34, 44, 30),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.45, attack2=0.42, heavy=0.8, stomp=1.25),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.5]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['thighL', 'shinL', 5.0], ['thighR', 'shinR', 5.0], ['shinL', 'footL', 2.6], ['shinR', 'footR', 2.6],
          ['hips', 'chest', 8.6], ['chest', 'head', 5.0], ['tail1', 'tail3', 5.4], ['tail3', 'tail6', 3.4],
          ['tail6', 'tail9', 2.0]],
    aim=dict(head='head', chain=['neck1', 'neck2', 'head'], pitch0=0.17),
    feet=['toeL', 'toeR'],
    mouth='mouth',
)
