"""GORVAX: a 58 m bipedal saurian. Bark-black hide, three rows of crystalline dorsal
plates that glow when it charges its thermal breath. Faces -Y, metres."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'gorvax'
VOXEL = 0.24
LOW_TRIS = 46000

# ----------------------------------------------------------------------------- joints
J = dict(
    hips=(0, 2, 28), sp1=(0, -1, 33), sp2=(0, -5, 38), chest=(0, -9, 42.5), neck0=(0, -12.5, 46),
    neck1=(0, -15.5, 49), head0=(0, -18, 51), snout=(0, -30, 50.4), jaw0=(0, -19.4, 49.3), chin=(0, -29.2, 48.1),
    clav=(2.6, -10, 42.5), sho=(6.8, -11.6, 41.4), elb=(9.4, -9.4, 34.2), wri=(9.0, -15.8, 30.2), hand=(8.6, -19.8, 27.9),
    hip=(5.8, 2.5, 27), knee=(7.4, -4.0, 15.5), ankle=(7.2, 2.0, 4.6), ball=(7.4, -4.6, 1.5), toe=(7.6, -10, 0.9),
    t0=(0, 6, 27.5), t1=(0, 13, 23.8), t2=(0, 21, 19.0), t3=(0, 30, 14.0), t4=(0, 40, 9.8), t5=(0, 51, 6.4),
    t6=(0, 62, 4.3), t7=(0, 74, 2.9),
)
TAIL = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7']
TAIL_R = [8.4, 7.3, 6.1, 4.9, 3.7, 2.6, 1.7, 0.75]


def skeleton():
    s = Skeleton()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', J['hips'], J['sp1'])
    s.bone('spine1', 'hips', J['sp1'], J['sp2'])
    s.bone('spine2', 'spine1', J['sp2'], J['chest'])
    s.bone('chest', 'spine2', J['chest'], J['neck0'])
    s.bone('neck1', 'chest', J['neck0'], J['neck1'])
    s.bone('neck2', 'neck1', J['neck1'], J['head0'])
    s.bone('head', 'neck2', J['head0'], J['snout'])
    s.bone('jaw', 'head', J['jaw0'], J['chin'])
    H, _ = head_frame()
    s.bone('mouth', 'head', H(0, 10.6, -0.8), H(0, 12.6, -0.8))
    s.bone('clavicle.L', 'chest', J['clav'], J['sho'], mirror=True)
    s.bone('upperarm.L', 'clavicle.L', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['hand'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['ball'], mirror=True)
    s.bone('toe.L', 'foot.L', J['ball'], J['toe'], mirror=True)
    prev = 'hips'
    for i in range(7):
        s.bone(f'tail{i + 1}', prev, J[TAIL[i]], J[TAIL[i + 1]])
        prev = f'tail{i + 1}'
    return s


def V(*a):
    return np.array(a, float)


def head_frame():
    o = V(*J['head0'])
    f = V(*J['snout']) - o
    f /= np.linalg.norm(f)
    u = np.cross(V(1, 0, 0), f)
    u = -u if u[2] < 0 else u
    pitch = math.degrees(math.atan2(-f[2], -f[1]))  # nose-down angle

    def H(x, y, z):
        return tuple(o + V(1, 0, 0) * x + f * y + u * z)
    return H, pitch


def sculpt():
    S = Sculpt()
    H, hp = head_frame()
    # torso: a stack of ellipsoids, broader than deep, leaning forward
    S.ell((0, 3.0, 27.4), (9.2, 8.4, 7.8), rot=(-12, 0, 0), bone='hips', k=3)
    S.ell((0, -0.6, 32.8), (9.6, 7.8, 7.4), rot=(-24, 0, 0), bone='spine1', k=3.2)
    S.ell((0, -4.8, 38.0), (10.0, 7.2, 7.2), rot=(-36, 0, 0), bone='spine2', k=3.2)
    S.ell((0, -8.6, 42.2), (9.6, 6.4, 6.0), rot=(-44, 0, 0), bone='chest', k=3.0)
    S.ell((0, -10.2, 33.6), (7.0, 3.4, 8.6), rot=(-26, 0, 0), bone='spine1', k=3.5, mat='belly')
    S.ell((3.9, -13.0, 39.4), (3.9, 2.3, 4.2), rot=(-34, 0, 12), bone='chest', k=2.6, mat='belly', mirror=True)
    # neck: thick, merging into the shoulders
    S.ell((0, -11.8, 45.6), (6.8, 5.4, 5.0), rot=(-48, 0, 0), bone='neck1', k=2.8)
    S.cone(J['neck0'], J['neck1'], 6.6, 5.7, bone='neck1', k=2.5)
    S.cone(J['neck1'], J['head0'], 5.7, 4.9, bone='neck2', k=2.0)
    S.ell((0, -16.4, 46.4), (4.4, 3.6, 4.4), rot=(-36, 0, 0), bone='neck1', k=2, mat='belly')  # throat
    # head (head-local: x side, y forward along the skull, z up)
    S.ell(H(0, 2.4, 1.6), (4.6, 4.9, 3.3), rot=(hp + 4, 0, 0), bone='head', k=1.7)  # skull
    S.ell(H(0, 7.2, 0.75), (3.15, 5.0, 1.75), rot=(hp + 3, 0, 0), bone='head', k=1.3)  # snout
    S.cone(H(0, 3.6, 2.8), H(0, 11.7, 1.05), 1.7, 1.1, bone='head', k=1.0)  # nasal ridge
    S.ell(H(2.65, 4.1, 2.75), (1.45, 2.8, 1.0), rot=(hp, -12, -8), bone='head', k=0.9, mirror=True)  # brow
    S.ell(H(3.5, 1.7, 0.0), (1.95, 2.7, 2.05), rot=(hp, 0, 0), bone='head', k=1.2, mirror=True)  # jaw muscle
    S.ell(H(0, 0.3, 3.6), (3.2, 3.2, 1.8), rot=(hp, 0, 0), bone='head', k=1.5)  # crest
    S.ell(H(1.3, 11.3, 0.95), (0.5, 0.55, 0.32), op='sub', k=0.25, mirror=True)  # nostrils
    # lower jaw
    S.ell(H(0, 6.0, -1.85), (3.1, 5.4, 1.12), rot=(hp + 3, 0, 0), bone='jaw', k=1.0)
    S.cone(H(0, 2.6, -2.15), H(0, 10.8, -1.95), 2.1, 1.0, bone='jaw', k=1.0)
    S.ell(H(2.7, 2.4, -1.6), (1.35, 2.4, 1.3), rot=(hp, 0, 0), bone='jaw', k=0.8, mirror=True)
    # mouth gap and eye sockets
    S.ell(H(0, 7.2, -0.83), (4.0, 6.3, 0.34), rot=(hp + 3, 0, 0), op='sub', k=0.25, mat='mouth')
    S.ell(H(3.05, 5.2, 1.85), (0.85, 1.0, 0.66), op='sub', k=0.3, mirror=True)
    # arms
    S.ell((7.0, -11.0, 40.8), (3.5, 3.8, 4.0), bone='clavicle.L', k=2.4, mirror=True)  # deltoid
    S.cone(J['sho'], J['elb'], 3.2, 2.45, bone='upperarm.L', k=1.6, mirror=True)
    S.ell((8.5, -10.4, 37.6), (2.6, 2.8, 3.6), rot=(-10, 0, 0), bone='upperarm.L', k=1.4, mirror=True)  # bicep
    S.cone(J['elb'], J['wri'], 2.5, 1.8, bone='forearm.L', k=1.2, mirror=True)
    S.ell(tuple(V(*J['wri']) * 0.55 + V(*J['hand']) * 0.45), (1.85, 2.3, 1.3), rot=(30, 0, 0), bone='hand.L', k=0.8, mirror=True)
    for fx in (-0.95, 0.0, 0.95):
        a = V(*J['hand']) + V(fx, 0.9, 0.6)
        b = a + V(fx * 0.6, -2.4 + abs(fx) * 0.4, -1.7)
        S.cone(a, b, 0.66, 0.44, bone='hand.L', k=0.45, mirror=True)
    # legs: massive thighs
    S.cone(J['hip'], J['knee'], 7.9, 5.1, bone='thigh.L', k=3, mirror=True)
    S.ell((7.2, -1.0, 20.6), (5.8, 6.4, 8.0), rot=(-24, 0, 0), bone='thigh.L', k=2.6, mirror=True)  # quad
    S.cone(J['knee'], J['ankle'], 4.9, 3.15, bone='shin.L', k=1.6, mirror=True)
    S.ell((7.2, 2.0, 11.4), (3.7, 3.6, 5.2), rot=(25, 0, 0), bone='shin.L', k=1.6, mirror=True)  # calf
    S.cone(J['ankle'], J['ball'], 3.1, 2.35, bone='foot.L', k=1.2, mirror=True)
    S.ell((7.3, 2.3, 2.0), (2.6, 2.6, 2.0), bone='foot.L', k=1.2, mirror=True)  # heel pad
    for fx, ln in ((-1.9, 4.4), (0.0, 5.6), (1.9, 4.4)):
        a = V(*J['ball']) + V(fx * 0.7, 0.4, -0.1)
        b = a + V(fx * 0.55, -ln, -0.6)
        S.cone(a, b, 1.4, 0.88, bone='toe.L', k=0.8, mirror=True)
    # tail
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(7)], k=2.4)
    return S


_N = Noise(7)


def noise(P):
    # rugged bark-like hide: broad lumps + ridged crags, calmer on the belly and face
    belly = np.clip((-P[:, 1] - 7.0 - np.abs(P[:, 0]) * 0.9) / 4.0, 0, 1) * (P[:, 2] > 18) * (P[:, 2] < 46)
    face = np.clip((-P[:, 1] - 19.0) / 3.0, 0, 1) * (P[:, 2] > 46)
    calm = 1.0 - 0.75 * np.maximum(belly, face)
    n = 0.14 * _N.fbm(P, 0.09, 2) + 0.24 * (_N.ridged(P, 0.45, 3) - 0.55)
    return n * calm


def body_color(P, N, mats):
    """Base colour (linear RGB) and masks per vertex; mats is a dict tag -> weight array."""
    n = len(P)
    back = np.array([0.030, 0.031, 0.034])
    belly = np.array([0.085, 0.078, 0.070])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.2, 0, 1)
    t = np.clip(t + np.clip(-up - 0.2, 0, 1) * 0.5, 0, 1)
    col = back[None] * (1 - t[:, None]) + belly[None] * t[:, None]
    # dorsal ridge slightly warmer, extremities darker
    ridge = np.clip(1 - np.abs(P[:, 0]) / 3.0, 0, 1) * np.clip(up, 0, 1)
    col *= (1 + 0.35 * ridge)[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.20, 0.035, 0.03])[None] * mouth[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(3)
    # dorsal plates: three rows following the actual back surface from neck to tail tip
    hs_scale = 1.35
    ys = [-15.6, -12.8, -9.8, -6.6, -3.2, 0.2, 3.6, 7.2, 11.0, 15.2, 19.8, 24.8, 30.2, 36.0, 42.2, 48.6, 55.0, 61.4, 67.5]
    hs = [2.6, 3.8, 5.2, 6.6, 7.6, 8.0, 7.8, 7.2, 6.6, 6.0, 5.4, 4.7, 4.0, 3.4, 2.8, 2.2, 1.7, 1.3, 0.9]
    for i, (y, h) in enumerate(zip(ys, hs)):
        h *= hs_scale if 3 <= i <= 12 else 1.15
        top = on_surface(S, 0.0, y)
        if top is None:
            continue
        nrm = normal_at(S, top)
        nxt = on_surface(S, 0.0, y + 1.0)
        fwd = top - nxt
        fwd /= np.linalg.norm(fwd)
        base = top - nrm * (0.9 + h * 0.08)
        b = bone_at(S, top - nrm * 2.0)
        P.plate(base, nrm, fwd, h + 0.9 + h * 0.08, h * 0.95 + 1.2, 0.5 + h * 0.07, bone=b, seed=i, lobes=3, lean=0.32)
        if 1 <= i <= 16:
            for sx in (1, -1):
                sh = h * 0.6
                x0 = sx * (1.4 + h * 0.2)
                st = S.surface((x0 * 3.0, y + 0.8, top[2] + 20), (-x0 * 0.1, 0, -1), far=60, step=0.08)
                if st is None:
                    continue
                sn = normal_at(S, st)
                sb = st - sn * (0.8 + sh * 0.08)
                P.plate(sb, sn, fwd, sh + 0.8 + sh * 0.08, sh * 0.9 + 0.9, 0.42 + sh * 0.06,
                        bone=bone_at(S, st - sn * 2.0), seed=100 + i * 2 + (sx > 0), lobes=2, lean=0.36)
    L = Parts()
    H, hp = head_frame()
    # teeth: irregular, yellowed
    L.row_of_teeth(H(2.7, 3.2, -0.62), H(0.85, 11.6, -0.62), 9, 1.2, 0.31, (0, 0, -1), 'head', rng)
    L.row_of_teeth(H(2.55, 3.0, -1.05), H(0.8, 10.8, -1.05), 8, 0.95, 0.27, (0, 0, 1), 'jaw', rng)
    # claws
    for fx in (-0.95, 0.0, 0.95):
        a = np.array(J['hand']) + np.array([fx, 0.9, 0.6])
        tip = a + np.array([fx * 0.6, -2.4 + abs(fx) * 0.4, -1.7])
        L.horn(tip - np.array([0, 0.2, -0.1]), (fx * 0.2, -0.55, -0.83), 2.0, 0.44, bend=(0, 0.25, -0.7),
               bone='hand.L', seg=7, rings=5, flat=0.75)
    for fx, ln in ((-1.9, 4.4), (0.0, 5.6), (1.9, 4.4)):
        a = np.array(J['ball']) + np.array([fx * 0.7, 0.4, -0.1])
        tip = a + np.array([fx * 0.55, -ln, -0.6])
        L.horn(tip + np.array([0, 0.3, 0.25]), (fx * 0.15, -1, -0.35), 1.9, 0.64, bend=(0, 0, -0.55),
               bone='toe.L', seg=7, rings=5, flat=0.7)
    L.sphere(H(2.92, 5.2, 1.88), 0.64, bone='head', mat='eye')
    L.mirrored()
    P.merge(L)
    return P


def _merge(A, B):
    for m in B.mats:
        A._mat(m)
    o = len(A.verts)
    A.verts += B.verts
    A.vbone += B.vbone
    A.vcol += B.vcol
    for f, mi in zip(B.faces, B.fmat):
        A.faces.append(tuple(o + i for i in f))
        A.fmat.append(A.mats.index(B.mats[mi]))


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 10

LOOK = dict(cell=0.55, wrinkle=2.6, scute=0.2, bump=0.38, cellvar=0.4, groove=0.6, wear=0.3,
            wearcol=(0.13, 0.125, 0.12), rough=0.6, cage=0.9)

PART_MATS = {
    'plate': dict(color=(0.42, 0.44, 0.47), rough=0.42, emissive=(0.25, 0.75, 1.0), emit=0.0),
    'keratin': dict(color=(0.36, 0.30, 0.21), rough=0.45),
    'eye': dict(color=(0.9, 0.45, 0.08), rough=0.15, emissive=(1.0, 0.55, 0.12), emit=2.0),
}


# ============================================================================= animation
import rig
from rig import env, smooth, foot_cycle
from mathutils import Vector

TAU = 2 * math.pi
BALL = {'L': Vector(J['ball']), 'R': Vector((-J['ball'][0], J['ball'][1], J['ball'][2]))}
FOOT_LEN = (Vector(J['ball']) - Vector(J['ankle'])).length
FOOT_PITCH = math.degrees(math.atan2(J['ankle'][2] - J['ball'][2], J['ankle'][1] - J['ball'][1]))
TOE_PITCH = math.degrees(math.atan2(J['ball'][2] - J['toe'][2], J['ball'][1] - J['toe'][1]))
TAILB = [f'tail{i + 1}' for i in range(7)]

WALK = dict(T=2.6, stride=18.0, duty=0.62, lift=3.4)
RUN = dict(T=1.7, stride=22.0, duty=0.48, lift=5.6)


def leg(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    ankle = ball - d * FOOT_LEN
    p.ik('thigh.' + side, 'shin.' + side, ankle, Vector((sx * 9.5, -30.0, 18.0)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def stand(p, spread=0.0):
    for side in ('L', 'R'):
        leg(p, side, BALL[side] + Vector(((1 if side == 'L' else -1) * spread, 0, 0)))


def gait(ph, p, g, bob, sway, lean, arm, tail, crouch=0.0):
    s1, c1 = math.sin(TAU * ph), math.cos(TAU * ph)
    c2 = math.cos(2 * TAU * ph)
    p.loc('hips', (sway * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    duty = g['duty']
    for side, off in (('L', 0.0), ('R', 0.5)):
        sp = (ph + off) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        if sp < duty:
            k = smooth((sp / duty - 0.68) / 0.32)
            fp, tp = FOOT_PITCH + 32 * k, TOE_PITCH
        else:
            fp = FOOT_PITCH + 32 * (1 - smooth(sw * 1.4)) + 6 * math.sin(math.pi * sw)
            tp = TOE_PITCH + 22 * math.sin(math.pi * sw)
        leg(p, side, BALL[side] + Vector((0.0, -f, h)), fp, tp)
    p.rot('hips', x=lean * 0.35, y=3.0 * s1, z=4.0 * s1)
    p.rot('spine1', x=lean * 0.3, z=-1.6 * s1)
    p.rot('spine2', x=lean * 0.25, y=-1.4 * s1, z=-1.6 * s1)
    p.rot('chest', x=lean * 0.1, z=-1.2 * s1)
    p.rot('neck1', x=-lean * 0.35 + 1.0 * c2)
    p.rot('neck2', x=-lean * 0.3)
    p.rot('head', x=-1.4 * c2, z=-1.2 * s1)
    p.rot('jaw', x=3.0)
    p.rot('upperarm.L', x=-arm * s1)
    p.rot('upperarm.R', x=arm * s1)
    p.rot('forearm.L', x=-arm * 0.4 * s1 - 4)
    p.rot('forearm.R', x=arm * 0.4 * s1 - 4)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-(1.4 + i * 0.85) * tail * math.sin(TAU * ph - 0.55 * (i + 1)),
              x=0.9 * tail * math.cos(2 * TAU * ph - 0.6 * (i + 1)) + (1.5 * tail if i < 3 else 0))


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.55, sway=0.9, lean=3.0, arm=7.0, tail=1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=1.1, sway=0.55, lean=11.0, arm=16.0, tail=1.5, crouch=1.4)


def breathe(p, t, T, amt=1.0):
    b = math.sin(TAU * 2 * t / T)
    p.rot('spine2', x=-0.8 * b * amt)
    p.rot('chest', x=-0.8 * b * amt)
    p.loc('hips', (0.0, 0.0, 0.12 * b * amt))
    return b


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = breathe(p, t, T)
    p.loc('hips', (0.3 * math.sin(TAU * ph), 0.0, -0.2))
    p.rot('hips', y=0.8 * math.sin(TAU * ph))
    p.rot('neck1', z=4.0 * math.sin(TAU * ph + 1.0), x=0.8 * b)
    p.rot('head', z=5.0 * math.sin(TAU * ph + 0.6), x=1.6 * math.sin(TAU * 3 * ph))
    p.rot('jaw', x=2.5 + 1.2 * (b + 1))
    for s in ('L', 'R'):
        p.rot('upperarm.' + s, x=2.0 * math.sin(TAU * ph + (0 if s == 'L' else 1.5)))
    for i, b_ in enumerate(TAILB):
        p.rot(b_, z=2.4 * math.sin(TAU * ph - 0.5 * i), x=0.5 * math.sin(TAU * 2 * ph - 0.6 * i))


def a_swipe(t, T, p, side='R'):
    stand(p, 0.6)
    sg = 1 if side == 'R' else -1
    w = env(t, 0.0, 0.36, 0.40, 0.60)
    s = env(t, 0.36, 0.55, 0.66, T)
    twist = -sg * 22 * w + sg * 30 * s
    p.rot('hips', z=twist * 0.2, x=4 * s)
    p.loc('hips', (0, -1.6 * s, -0.6 * s))
    for b, k in (('spine1', 0.3), ('spine2', 0.35), ('chest', 0.35)):
        p.rot(b, z=twist * k, x=3 * s)
    p.rot('neck1', z=-twist * 0.25)
    p.rot('head', z=-twist * 0.2, x=-6 * s)
    p.rot('jaw', x=3 + 16 * s)
    o = 'L' if side == 'R' else 'R'
    p.rot('upperarm.' + side, x=-35 * w - 75 * s, y=sg * 55 * w - sg * 5 * s, z=sg * 40 * s)
    p.rot('forearm.' + side, x=-25 * w + 15 * s)
    p.rot('hand.' + side, x=20 * s - 10 * w)
    p.rot('upperarm.' + o, x=-15 * s, y=-sg * 18 * s)
    for i, b in enumerate(TAILB):
        p.rot(b, z=twist * 0.08 * (1 + 0.3 * i), x=1.5 * s)


def a_swipe_l(t, T, p):
    a_swipe(t, T, p, 'L')


def a_bite(t, T, p):
    stand(p, 0.6)
    l = env(t, 0.05, 0.40, 0.58, T)
    o = env(t, 0.10, 0.38, 0.42, 0.58)
    p.loc('hips', (0, -2.6 * l, -1.0 * l))
    p.rot('hips', x=5 * l)
    for b, k in (('spine1', 6), ('spine2', 6), ('chest', 6), ('neck1', 9), ('neck2', 5)):
        p.rot(b, x=k * l)
    p.rot('head', x=-20 * o + 4 * l)
    p.rot('jaw', x=3 + 44 * o)
    for s in ('L', 'R'):
        p.rot('upperarm.' + s, x=-28 * l, y=(1 if s == 'L' else -1) * -14 * l)
        p.rot('forearm.' + s, x=-10 * l)
    for i, b in enumerate(TAILB):
        p.rot(b, x=(5 - i * 0.6) * l)


def a_tail(t, T, p):
    stand(p, 1.0)
    w = env(t, 0.0, 0.45, 0.50, 0.70)
    yaw_h = 22 * w
    lag = lambda i: env(t - 0.035 * i, 0.52, 0.95, 1.10, T)
    s = lag(0)
    yaw_h += -38 * s
    p.rot('hips', z=yaw_h, x=3 * s)
    p.loc('hips', (0, 0, -0.9 * (w + s)))
    for b in ('spine1', 'spine2', 'chest'):
        p.rot(b, z=yaw_h * 0.22)
    p.rot('neck1', z=-yaw_h * 0.35)
    p.rot('head', z=-yaw_h * 0.3)
    p.rot('jaw', x=3 + 12 * s)
    for i, b in enumerate(TAILB):
        k = 1 + 0.18 * i
        p.rot(b, z=(-9 * w + 17 * lag(i + 1)) * k, x=3.5 * max(w, lag(i + 1)))
    for sd in ('L', 'R'):
        p.rot('upperarm.' + sd, y=(1 if sd == 'L' else -1) * -20 * s, x=-10 * s)


def a_stomp(t, T, p):
    up = env(t, 0.08, 0.58, 0.64, 0.64)
    if 0.64 <= t < 0.84:
        q = (t - 0.64) / 0.2
        up = 1 - q * q
    elif t >= 0.84:
        up = 0.0
    imp = env(t, 0.82, 0.86, 0.95, T)
    leg(p, 'L', BALL['L'] + Vector((0.6, 0, 0)))
    leg(p, 'R', BALL['R'] + Vector((-0.4, -4.0 * up, 11.0 * up)), FOOT_PITCH + 14 * up, TOE_PITCH + 10 * up)
    p.loc('hips', (1.9 * up, 0, 0.7 * up - 1.8 * imp))
    p.rot('hips', y=4 * up)
    p.rot('spine1', x=-4 * up + 7 * imp)
    p.rot('spine2', x=-3 * up + 5 * imp)
    p.rot('chest', x=-2 * up + 4 * imp)
    p.rot('neck1', x=-6 * up + 4 * imp)
    p.rot('head', x=-6 * up + 10 * imp)
    p.rot('jaw', x=3 + 22 * up + 10 * imp)
    for s in ('L', 'R'):
        sg = 1 if s == 'L' else -1
        p.rot('upperarm.' + s, y=-sg * 30 * up, x=-22 * up + 10 * imp)
    for i, b in enumerate(TAILB):
        p.rot(b, x=3 * up - 2.5 * imp, z=1.5 * up * math.sin(i))


def a_roar(t, T, p):
    stand(p, 0.8)
    r = env(t, 0.1, 0.8, 2.6, 3.3)
    o = env(t, 0.55, 0.9, 2.5, 2.95)
    vib = math.sin(TAU * 17 * t) * o
    p.loc('hips', (0, 1.2 * r, -0.9 * r))
    p.rot('hips', x=-3 * r)
    for b, k in (('spine1', -4), ('spine2', -5), ('chest', -6), ('neck1', -14), ('neck2', -10)):
        p.rot(b, x=k * r)
    p.rot('head', x=-9 * r + 0.8 * vib, z=3 * math.sin(TAU * 0.8 * t) * o)
    p.rot('jaw', x=3 + 46 * o + 1.5 * vib)
    for s in ('L', 'R'):
        sg = 1 if s == 'L' else -1
        p.rot('upperarm.' + s, y=-sg * 42 * r, x=-32 * r)
        p.rot('forearm.' + s, x=-18 * r)
        p.rot('hand.' + s, x=-15 * r)
    for i, b in enumerate(TAILB):
        p.rot(b, x=(4.5 - 0.5 * i) * r, z=3 * r * math.sin(TAU * 0.5 * t - 0.5 * i))


def breath_pose(p, k, t=0.0, T=1.0):
    stand(p, 0.9)
    p.loc('hips', (0, 0.8 * k, -0.7 * k))
    p.rot('spine2', x=-3 * k)
    p.rot('chest', x=-3 * k)
    p.rot('neck1', x=-4 * k)
    p.rot('neck2', x=-2 * k)
    p.rot('head', x=-3 * k)
    p.rot('jaw', x=3 + 34 * k)
    for s in ('L', 'R'):
        sg = 1 if s == 'L' else -1
        p.rot('upperarm.' + s, y=-sg * 14 * k, x=-8 * k)
    for i, b in enumerate(TAILB):
        p.rot(b, x=2.5 * k)


def a_breath_in(t, T, p):
    k = smooth(t / T)
    breath_pose(p, k)
    p.rot('neck1', x=8 * math.sin(math.pi * t / T))  # dip and rise while charging


def a_breath_loop(t, T, p):
    breath_pose(p, 1.0)
    tr = math.sin(TAU * 6 * t / T)
    p.rot('head', x=0.7 * tr, z=0.5 * math.sin(TAU * 4 * t / T))
    p.rot('jaw', x=1.5 * math.sin(TAU * 8 * t / T))


def a_breath_out(t, T, p):
    breath_pose(p, 1 - smooth(t / T))


def a_hit(t, T, p):
    stand(p)
    h = env(t, 0.0, 0.08, 0.16, T)
    p.loc('hips', (0, 1.4 * h, -0.4 * h))
    p.rot('spine2', y=-5 * h, x=-4 * h)
    p.rot('chest', x=-5 * h)
    p.rot('neck1', z=-9 * h)
    p.rot('head', z=-14 * h, x=-6 * h)
    p.rot('jaw', x=3 + 20 * h)
    for i, b in enumerate(TAILB):
        p.rot(b, z=4 * h * math.sin(i * 0.7))


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.9) / 1.4)) ** 2
    bounce = math.sin(max(0.0, t - 2.3) * 9) * math.exp(-max(0.0, t - 2.3) * 4) * (t > 2.3)
    if t < 0.9:
        stand(p)
    else:
        for s in ('L', 'R'):
            sg = 1 if s == 'L' else -1
            p.rot('thigh.' + s, x=-14 * f, y=-sg * 6 * f)
            p.rot('shin.' + s, x=10 * f)
    p.rot('root', y=86 * f + 2 * bounce)
    p.loc('root', (3.0 * f, 0, 6.5 * f))
    p.rot('spine1', x=-5 * a, y=6 * f)
    p.rot('chest', x=-6 * a)
    p.rot('neck1', x=-12 * a + 10 * f, y=8 * f)
    p.rot('neck2', x=6 * f)
    p.rot('head', x=-10 * a + 4 * f, y=10 * f)
    p.rot('jaw', x=3 + 30 * a + 18 * f)
    for s in ('L', 'R'):
        sg = 1 if s == 'L' else -1
        p.rot('upperarm.' + s, y=-sg * 30 * a + sg * 10 * f, x=-20 * a + 20 * f)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-2.5 * f, x=-1.0 * f)


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_swipe, 1.3, False),
    'attack2': (a_bite, 1.1, False),
    'heavy': (a_tail, 1.9, False),
    'stomp': (a_stomp, 1.5, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_breath_in, 1.0, False),
    'special_loop': (a_breath_loop, 1.0, True),
    'special_out': (a_breath_out, 0.7, False),
    'hit': (a_hit, 0.7, False),
    'death': (a_death, 3.6, False),
}

META = dict(
    height=58.0,
    preview_angle=40,
    close=(0, -14, 44, 34),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.52, attack2=0.56, heavy=0.98, stomp=0.85, special_in=1.0),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.5]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['thighL', 'shinL', 6.5], ['thighR', 'shinR', 6.5], ['shinL', 'footL', 4.2], ['shinR', 'footR', 4.2],
          ['hips', 'chest', 10.0], ['chest', 'head', 6.0], ['tail1', 'tail3', 7.0], ['tail3', 'tail5', 4.6],
          ['tail5', 'tail7', 2.6]],
    aim=dict(head='head', chain=['neck1', 'neck2', 'head'], pitch0=0.05),
    feet=['toeL', 'toeR'],
    mouth='mouth',
)
