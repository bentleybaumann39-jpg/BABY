"""KRAGMAW: a volcanic megaprimate. Knuckle-walking, basalt hide split by glowing magma
veins, obsidian shards on the shoulders, tusked jaw. Faces -Y, metres (52 m model)."""
import math
import numpy as np
from mathutils import Vector
from sdf import Sculpt, Noise
from rig import Skeleton, env, smooth
from parts import Parts
from anim_lib import Limb, gait_limb

NAME = 'kragmaw'
VOXEL = 0.24
LOW_TRIS = 46000

J = dict(
    hips=(0, 10, 22.5), sp1=(0, 6, 27), sp2=(0, 1.5, 31.5), chest=(0, -3, 35), chestTop=(0, -7.5, 38),
    neck=(0, -11, 39.2), snout=(0, -20.5, 37.6), jaw0=(0, -12, 37.0), chin=(0, -19.5, 34.6),
    clav=(2.5, -5, 37.5), sho=(12, -6.5, 37), elb=(21.5, -3, 22.5), wri=(20, -12.5, 6.5), knuckle=(20, -15.2, 2.0),
    hip=(6.5, 9, 21), knee=(8, 3, 12), ankle=(8, 9, 3.2), ball=(8.3, 3.5, 1.2), toe=(8.5, -0.8, 0.7),
)


def V(*a):
    return np.array(a, float)


def mirror(p):
    return (-p[0], p[1], p[2])


def skeleton():
    s = Skeleton()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', J['hips'], J['sp1'])
    s.bone('spine1', 'hips', J['sp1'], J['sp2'])
    s.bone('spine2', 'spine1', J['sp2'], J['chest'])
    s.bone('chest', 'spine2', J['chest'], J['chestTop'])
    s.bone('neck', 'chest', J['chestTop'], J['neck'])
    s.bone('head', 'neck', J['neck'], J['snout'])
    s.bone('jaw', 'head', J['jaw0'], J['chin'])
    s.bone('mouth', 'head', (0, -19.0, 36.4), (0, -21.0, 36.4))
    s.bone('clavicle.L', 'chest', J['clav'], J['sho'], mirror=True)
    s.bone('upperarm.L', 'clavicle.L', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['knuckle'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['ball'], mirror=True)
    s.bone('toe.L', 'foot.L', J['ball'], J['toe'], mirror=True)
    return s


def sculpt():
    S = Sculpt()
    # torso: heavy barrel chest rising to a hump of trapezius
    S.ell((0, 10, 22), (8.5, 7, 7.5), rot=(-15, 0, 0), bone='hips', k=3)
    S.ell((0, 5, 27), (10, 8, 8.5), rot=(-25, 0, 0), bone='spine1', k=3.2)
    S.ell((0, -1, 32.5), (11.2, 9.5, 9), rot=(-40, 0, 0), bone='spine2', k=3.2)
    S.ell((0, -4.5, 35.5), (11, 8, 7), rot=(-45, 0, 0), bone='chest', k=3)
    S.ell((0, -1.5, 39.5), (9.5, 7, 5.5), rot=(-20, 0, 0), bone='chest', k=3.2)
    S.ell((0, -1, 26), (7.5, 5, 6.5), rot=(-20, 0, 0), bone='spine1', k=3.5, mat='belly')
    S.ell((5, -9, 32), (5, 3, 5), rot=(-40, 0, 10), bone='chest', k=2.6, mat='belly', mirror=True)
    # arms: deltoid, upper arm, huge forearm, knuckle fist
    S.ell((12.2, -6.5, 36), (6, 6.5, 6.5), bone='clavicle.L', k=2.6, mirror=True)
    S.cone(J['sho'], J['elb'], 5.6, 4.3, bone='upperarm.L', k=1.4, mirror=True)
    S.ell((17.8, -5.2, 29), (4.4, 4.8, 6.8), rot=(-12, 0, 30), bone='upperarm.L', k=1.4, mirror=True)
    S.cone(J['elb'], J['wri'], 4.9, 3.6, bone='forearm.L', k=1.4, mirror=True)
    S.ell((21.2, -7, 15.5), (4.6, 5.0, 7.4), rot=(32, 0, 0), bone='forearm.L', k=1.6, mirror=True)
    S.ell((20, -13.6, 4.4), (3.9, 3.7, 3.3), rot=(25, 0, 0), bone='hand.L', k=1.4, mirror=True)
    for dx in (-2.0, -0.65, 0.65, 2.0):
        a = V(20 + dx, -14.4, 3.6)
        b = V(20 + dx * 1.05, -16.0, 1.75)
        S.cone(a, b, 1.35, 1.1, bone='hand.L', k=0.7, mirror=True)
    S.cone((17.6, -12.6, 5.0), (17.0, -14.8, 2.8), 1.2, 0.9, bone='hand.L', k=0.6, mirror=True)  # thumb
    # legs: short and thick
    S.cone(J['hip'], J['knee'], 5.8, 4.4, bone='thigh.L', k=2.4, mirror=True)
    S.ell((7.5, 6.5, 17), (4.8, 5.6, 6.6), rot=(-30, 0, 0), bone='thigh.L', k=2.0, mirror=True)
    S.cone(J['knee'], J['ankle'], 4.2, 3.0, bone='shin.L', k=1.6, mirror=True)
    S.ell((8, 7.5, 8), (3.3, 3.3, 4.2), rot=(30, 0, 0), bone='shin.L', k=1.4, mirror=True)
    S.cone(J['ankle'], J['ball'], 3.0, 2.4, bone='foot.L', k=1.2, mirror=True)
    S.ell((8.1, 9.6, 1.9), (2.5, 2.4, 1.9), bone='foot.L', k=1.2, mirror=True)
    for dx, ln in ((-1.8, 3.4), (-0.6, 4.0), (0.6, 4.2), (1.8, 3.6)):
        a = V(*J['ball']) + V(dx, 0.3, 0)
        S.cone(a, a + V(dx * 0.2, -ln, -0.4), 1.15, 0.85, bone='toe.L', k=0.7, mirror=True)
    # neck and head: low-slung, crested skull, heavy brow, prognathous jaw
    S.cone(J['chestTop'], J['neck'], 6.6, 5.6, bone='neck', k=2.6)
    S.ell((0, -13.5, 40.2), (4.8, 5, 4.2), bone='head', k=1.8)
    S.ell((0, -12, 43.6), (1.0, 4.2, 1.9), rot=(-10, 0, 0), bone='head', k=1.2)
    S.ell((0, -16.8, 41.6), (4.7, 1.8, 1.5), bone='head', k=1.1)
    S.ell((3, -15.5, 38.5), (2.2, 3, 2.5), bone='head', k=1.2, mirror=True)
    S.ell((0, -18.8, 38.3), (3.6, 3.2, 2.15), rot=(10, 0, 0), bone='head', k=1.2)
    S.ell((0.9, -21.6, 38.6), (0.5, 0.45, 0.4), op='sub', k=0.25, mirror=True)
    S.ell((0, -17.2, 35.6), (3.5, 4.0, 1.7), rot=(8, 0, 0), bone='jaw', k=1.0)
    S.ell((0, -19.5, 35.0), (2.4, 1.6, 1.6), bone='jaw', k=0.9)
    S.ell((0, -18.3, 36.75), (3.9, 3.6, 0.32), rot=(9, 0, 0), op='sub', k=0.25, mat='mouth')
    S.ell((2.1, -17.6, 40.4), (0.85, 0.7, 0.65), op='sub', k=0.3, mirror=True)
    return S


_N = Noise(19)


def noise(P):
    face = np.clip((-P[:, 1] - 15.0) / 2.5, 0, 1) * (P[:, 2] > 33)
    hands = np.clip((6.0 - P[:, 2]) / 2.0, 0, 1) * (np.abs(P[:, 0]) > 14)
    calm = 1.0 - 0.75 * np.maximum(face, hands)
    n = 0.18 * _N.fbm(P, 0.08, 2) + 0.34 * (_N.ridged(P, 0.3, 3) - 0.55)
    return n * calm


def body_color(P, N, mats):
    n = len(P)
    rock = np.array([0.026, 0.024, 0.024])
    hide = np.array([0.045, 0.036, 0.032])
    up = np.clip(N[:, 2], -1, 1)
    belly = np.clip(mats.get('belly', 0) * 1.2, 0, 1)
    col = rock[None] * (1 - belly[:, None]) + hide[None] * belly[:, None]
    face = np.clip((-P[:, 1] - 15.0) / 2.5, 0, 1) * (P[:, 2] > 33)
    col *= (1 - 0.25 * face)[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.16, 0.03, 0.02])[None] * mouth[:, None]
    # magma veins run over the back, shoulders and arms, not the face, belly or palms
    veins = np.clip(1 - belly * 1.5 - face - mouth, 0, 1) * np.clip((P[:, 2] - 4) / 6, 0, 1) * (0.6 + 0.4 * np.clip(up + 0.3, 0, 1))
    mask = np.stack([belly, veins, mouth, np.ones(n)], 1)
    return col, mask


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(11)
    # obsidian shards erupting from the shoulders and upper back
    spots = [(0, -2.5), (3.5, -1.0), (-3.5, -1.0), (6.5, -4.5), (-6.5, -4.5), (2.0, 2.5), (-2.0, 2.5), (5.0, 1.5), (-5.0, 1.5),
             (9.5, -6.0), (-9.5, -6.0), (0, 5.5), (3.5, 6.5), (-3.5, 6.5)]
    for i, (x, y) in enumerate(spots):
        top = on_surface(S, x, y)
        if top is None:
            continue
        nrm = normal_at(S, top)
        h = 3.2 + rng.random() * 2.6 - abs(x) * 0.08
        fwd = np.array([0.0, -1.0, 0.25])
        base = top - nrm * 0.8
        P.plate(base, nrm + np.array([0, 0.35, 0]), fwd, h + 0.8, h * 0.55 + 0.6, 0.6 + h * 0.08, bone=bone_at(S, top - nrm * 2.0),
                mat='shard', seed=40 + i, lobes=1, lean=0.55)
    L = Parts()
    for i, (y, z) in enumerate(((-6.5, 25.0), (-8.0, 19.0), (-9.5, 13.0))):
        st = S.surface((40, y, z), (-1, 0, 0), far=40, step=0.08)
        if st is None:
            continue
        sn = normal_at(S, st)
        L.plate(st - sn * 0.7, sn + np.array([0, 0.5, 0.3]), np.array([0, -1, 0.4]), 2.6 + i * 0.3, 2.2, 0.5, bone=bone_at(S, st - sn * 2),
                mat='shard', seed=70 + i, lobes=1, lean=0.6)
    # tusks and teeth
    L.horn((2.3, -19.6, 35.9), (0.18, -0.35, 1.0), 3.2, 0.62, bend=(0.2, 0.6, 0.2), bone='jaw', seg=8, rings=6, flat=0.85)
    L.row_of_teeth((2.6, -16.2, 36.85), (0.6, -20.6, 36.9), 6, 0.8, 0.28, (0, 0, -1), 'head', rng)
    L.row_of_teeth((2.4, -16.4, 36.55), (0.6, -19.8, 36.55), 5, 0.6, 0.25, (0, 0, 1), 'jaw', rng)
    L.sphere((2.12, -17.35, 40.42), 0.56, bone='head', mat='eye')
    L.mirrored()
    P.merge(L)
    return P


HARD = [('head', 'jaw')] + [(a + s, b) for s in ('.L', '.R') for a in ('upperarm', 'forearm', 'hand')
                              for b in ('hips', 'spine1', 'spine2', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R')]
WEIGHT_ITERS = 10

LOOK = dict(cell=0.34, wrinkle=1.7, scute=0.18, bump=0.55, cellvar=0.5, groove=0.75, wear=0.32,
            wearcol=(0.11, 0.1, 0.095), rough=0.72, cage=0.9, emit=(1.0, 0.3, 0.04), vein=0.16, veinw=0.035)

PART_MATS = {
    'shard': dict(color=(0.035, 0.032, 0.036), rough=0.12, emissive=(1.0, 0.36, 0.06), emit=0.0),
    'keratin': dict(color=(0.32, 0.28, 0.2), rough=0.4),
    'eye': dict(color=(1.0, 0.4, 0.05), rough=0.15, emissive=(1.0, 0.42, 0.06), emit=2.5),
}

# ============================================================================= animation

ARM = {}
LEG = {}
for side, sx in (('L', 1), ('R', -1)):
    m = (lambda p: (p[0] * sx, p[1], p[2]))
    kn, wr = Vector(m(J['knuckle'])), Vector(m(J['wri']))
    ARM[side] = Limb('upperarm.' + side, 'forearm.' + side, 'hand.' + side, kn, kn - wr, (sx * 34, 24, 26), end_len=(kn - wr).length)
    ba, an, to = Vector(m(J['ball'])), Vector(m(J['ankle'])), Vector(m(J['toe']))
    LEG[side] = Limb('thigh.' + side, 'shin.' + side, 'foot.' + side, ba, ba - an, (sx * 12, -30, 14), toe='toe.' + side,
                     toe_dir=to - ba, end_len=(ba - an).length)

TAU = 2 * math.pi
WALK = dict(T=2.3, stride=13.0, duty=0.65)
RUN = dict(T=1.55, stride=18.0, duty=0.45)


def plant(p, skip=(), shift=(0, 0, 0)):
    for s in ('L', 'R'):
        if 'arm' + s not in skip:
            ARM[s].rest(p, shift)
        if 'leg' + s not in skip:
            LEG[s].rest(p)


def quad(ph, p, G, arm_off, arm_lift, leg_lift, bob, sway, pitch_osc, lean):
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    gait_limb(LEG['L'], p, ph, G['stride'], leg_lift, G['duty'], heel=30)
    gait_limb(LEG['R'], p, ph + 0.5, G['stride'], leg_lift, G['duty'], heel=30)
    gait_limb(ARM['L'], p, ph + arm_off[0], G['stride'], arm_lift, G['duty'], heel=22, swing_pitch=12)
    gait_limb(ARM['R'], p, ph + arm_off[1], G['stride'], arm_lift, G['duty'], heel=22, swing_pitch=12)
    p.loc('hips', (sway * s1, 0, -bob * 0.5 * (1 + c2)))
    p.rot('hips', x=lean + pitch_osc * math.sin(TAU * ph + 1.2), y=2.5 * s1, z=3 * s1)
    p.rot('spine1', z=-1.5 * s1)
    p.rot('spine2', z=-2 * s1, y=-2 * s1, x=pitch_osc * 0.5 * math.sin(TAU * ph + 0.6))
    p.rot('chest', y=-2 * math.sin(TAU * (ph + arm_off[0])), z=-1.5 * s1)
    p.rot('neck', x=-lean * 0.6 - pitch_osc * 0.6 * math.sin(TAU * ph + 1.2))
    p.rot('head', x=-1.5 * c2, z=-1.5 * s1)
    p.rot('jaw', x=2.5)


def a_walk(t, T, p):
    quad(t / T, p, WALK, (0.18, 0.68), 3.4, 2.4, bob=0.45, sway=0.7, pitch_osc=1.5, lean=0)


def a_run(t, T, p):
    quad(t / T, p, RUN, (0.0, 0.1), 6.0, 4.2, bob=1.2, sway=0.3, pitch_osc=6.0, lean=4)


def a_idle(t, T, p):
    ph = t / T
    plant(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0.3 * math.sin(TAU * ph), 0, 0.15 * b))
    p.rot('spine2', x=-1.0 * b)
    p.rot('chest', x=-1.2 * b, y=1.0 * math.sin(TAU * ph))
    p.rot('neck', z=6 * math.sin(TAU * ph + 0.7), x=1.5 * math.sin(TAU * 3 * ph))
    p.rot('head', z=5 * math.sin(TAU * ph + 0.3))
    p.rot('jaw', x=2 + 1.5 * (b + 1))


def a_haymaker(t, T, p):
    w = env(t, 0.0, 0.28, 0.32, 0.45)
    s = env(t, 0.3, 0.44, 0.56, T)
    plant(p, skip=('armR',), shift=(0, 0, 0))
    p.loc('hips', (0, 1.4 * w - 1.5 * s, 1.0 * (w + s)))
    p.rot('hips', x=-6 * w - 4 * s)
    p.rot('spine1', x=-4 * w, z=-6 * w + 8 * s)
    p.rot('spine2', x=-3 * w, z=-8 * w + 12 * s)
    p.rot('chest', z=-6 * w + 10 * s)
    p.rot('upperarm.R', x=55 * w - 105 * s, y=25 * w - 5 * s, z=10 * s)
    p.rot('forearm.R', x=-45 * w + 10 * s)
    p.rot('hand.R', x=-20 * s)
    p.rot('upperarm.L', x=-6 * s)
    p.rot('neck', z=6 * s, x=4 * s)
    p.rot('jaw', x=2.5 + 22 * s)


def a_hammer(t, T, p):
    w = env(t, 0.0, 0.32, 0.36, 0.5)
    s = env(t, 0.36, 0.5, 0.62, T)
    plant(p, skip=('armL',))
    p.loc('hips', (0, 1.0 * w, 1.6 * w - 1.2 * s))
    p.rot('hips', x=-12 * w + 6 * s)
    p.rot('spine1', x=-6 * w + 4 * s)
    p.rot('spine2', x=-5 * w + 5 * s, z=4 * w)
    p.rot('chest', y=-6 * w + 4 * s)
    p.rot('upperarm.L', x=-150 * w - 55 * s, y=-15 * w)
    p.rot('forearm.L', x=-30 * w + 20 * s)
    p.rot('neck', x=-6 * w + 8 * s)
    p.rot('jaw', x=2.5 + 30 * s)


def a_slam(t, T, p):
    if t < 0.85:
        up = smooth(t / 0.85)
    elif t < 1.0:
        q = (t - 0.85) / 0.15
        up = 1 - q * q
    else:
        up = 0.0
    down = env(t, 0.88, 1.0, 1.15, T)
    plant(p, skip=('armL', 'armR'))
    p.loc('hips', (0, 3 * up + 1 * down, 2.0 * up - 1.5 * down))
    p.rot('hips', x=-38 * up + 12 * down)
    p.rot('spine1', x=-8 * up + 6 * down)
    p.rot('spine2', x=-6 * up + 6 * down)
    p.rot('chest', x=-4 * up + 4 * down)
    for s, sg in (('L', 1), ('R', -1)):
        p.rot('upperarm.' + s, x=-165 * up - 40 * down, y=-sg * 10 * up)
        p.rot('forearm.' + s, x=-25 * up + 10 * down)
    p.rot('neck', x=-10 * up + 14 * down)
    p.rot('jaw', x=2.5 + 30 * up + 20 * down)


def a_leap(t, T, p):
    crouch = env(t, 0.0, 0.25, 0.3, 0.42)
    air = env(t, 0.35, 0.5, 1.1, 1.25)
    land = env(t, 1.15, 1.25, 1.3, T)
    for s, sx in (('L', 1), ('R', -1)):
        LEG[s].place(p, LEG[s].contact + Vector((0, -3 * air, 7 * air)))
        if air > 0.01:
            p.rot('upperarm.' + s, x=-110 * air, y=-sx * 30 * air)
            p.rot('forearm.' + s, x=-40 * air)
        else:
            ARM[s].rest(p, (0, -2 * land, 0))
    p.loc('hips', (0, 0, -3 * crouch + 2 * air - 2.5 * land))
    p.rot('hips', x=6 * crouch - 18 * air + 10 * land)
    p.rot('spine2', x=4 * crouch - 6 * air + 6 * land)
    p.rot('neck', x=-8 * air + 10 * land)
    p.rot('jaw', x=2.5 + 25 * air + 20 * land)


def a_grab(t, T, p):
    reach = env(t, 0.0, 0.35, 0.45, 0.65)
    lift = smooth((t - 0.45) / 0.55)
    plant(p, skip=('armR',))
    tgt = Vector((-14, -26, 3)) * (1 - lift) + Vector((-15, 0, 62)) * lift
    p.ik('upperarm.R', 'forearm.R', tgt, Vector((-38, 25, 30)))
    p.rot('hips', x=8 * reach - 26 * lift)
    p.loc('hips', (0, 0, -1.5 * reach + 2 * lift))
    p.rot('spine2', x=5 * reach - 5 * lift, z=-6 * lift)
    p.rot('neck', x=-6 * lift)
    p.rot('jaw', x=2.5 + 10 * lift)


def a_hold(t, T, p):
    plant(p, skip=('armR',))
    tr = math.sin(TAU * 5 * t / T)
    p.ik('upperarm.R', 'forearm.R', Vector((-15, 0.5 + 0.3 * tr, 62)), Vector((-38, 25, 30)))
    p.rot('hips', x=-26)
    p.loc('hips', (0, 0, 2))
    p.rot('spine2', z=-6)
    p.rot('neck', x=-6)
    p.rot('jaw', x=12 + 2 * tr)


def a_throw(t, T, p):
    s = smooth(t / (0.35 * T))
    rec = smooth((t - 0.45 * T) / (0.55 * T))
    plant(p, skip=('armR',))
    tgt = Vector((-15, 0, 62)) * (1 - s) + Vector((-10, -34, 26)) * s
    tgt = tgt * (1 - rec) + Vector(ARM['R'].contact) * rec
    p.ik('upperarm.R', 'forearm.R', tgt, Vector((-38, 25, 30)))
    p.rot('hips', x=-26 * (1 - s) + 6 * s * (1 - rec))
    p.loc('hips', (0, -2 * s * (1 - rec), 2 * (1 - rec)))
    p.rot('spine2', z=-6 + 14 * s * (1 - rec), x=6 * s * (1 - rec))
    p.rot('jaw', x=2.5 + 25 * s * (1 - rec))


def a_roar(t, T, p):
    up = env(t, 0.0, 0.6, 2.5, 3.1)
    plant(p, skip=('armL', 'armR'))
    p.loc('hips', (0, 3.5 * up, 2.5 * up))
    p.rot('hips', x=-48 * up)
    p.rot('spine1', x=-6 * up)
    p.rot('spine2', x=-4 * up)
    for s, sg, ph0 in (('L', 1, 0.0), ('R', -1, 0.5)):
        beat = 0.0
        if 0.8 < t < 2.4:
            beat = max(0.0, math.sin(TAU * 2.5 * (t - 0.8) + ph0 * math.pi))
        p.rot('upperarm.' + s, x=-70 * up - 25 * beat, y=sg * 25 * up * (1 - beat))
        p.rot('forearm.' + s, x=-70 * up)
        if up < 0.05:
            ARM[s].rest(p)
    o = env(t, 0.5, 0.9, 2.3, 2.8)
    vib = math.sin(TAU * 15 * t) * o
    p.rot('neck', x=-12 * o)
    p.rot('head', x=-10 * o + 1.0 * vib)
    p.rot('jaw', x=2.5 + 40 * o + vib)


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.15, T)
    plant(p)
    p.loc('hips', (0, 1.2 * h, 0))
    p.rot('spine2', y=-6 * h, x=-4 * h)
    p.rot('neck', z=-10 * h)
    p.rot('head', z=-12 * h)
    p.rot('jaw', x=2.5 + 22 * h)


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.8) / 1.3)) ** 2
    if t < 0.8:
        plant(p)
    else:
        for s in ('L', 'R'):
            p.rot('upperarm.' + s, x=-20 * f)
            p.rot('thigh.' + s, x=-10 * f)
    p.rot('root', y=-78 * f)
    p.loc('root', (-3 * f, 0, 9 * f))
    p.rot('hips', x=-14 * a)
    p.rot('neck', x=-14 * a + 12 * f)
    p.rot('jaw', x=2.5 + 32 * a + 15 * f)


ANIMS = {
    'idle': (a_idle, 5.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_haymaker, 1.1, False),
    'attack2': (a_hammer, 1.2, False),
    'heavy': (a_slam, 1.6, False),
    'stomp': (a_leap, 1.5, False),
    'roar': (a_roar, 3.2, False),
    'special_in': (a_grab, 1.0, False),
    'special_loop': (a_hold, 1.0, True),
    'special_out': (a_throw, 0.8, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.4, False),
}

META = dict(
    height=46.0,
    preview_angle=50,
    close=(0, -12, 30, 38),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    hits=dict(attack1=0.48, attack2=0.55, heavy=1.0, stomp=1.25),
    feet=['toeL', 'handL', 'toeR', 'handR'],
    foot_phase=dict(walk=[0.0, 0.18, 0.5, 0.68], run=[0.0, 0.0, 0.5, 0.1]),
    body=[['thighL', 'shinL', 5.2], ['thighR', 'shinR', 5.2], ['upperarmL', 'forearmL', 5.2], ['upperarmR', 'forearmR', 5.2],
          ['forearmL', 'handL', 4.5], ['forearmR', 'handR', 4.5], ['hips', 'chest', 10.5], ['chest', 'head', 6.5]],
    aim=dict(head='head', chain=['neck', 'head'], pitch0=0.1),
    mouth='mouth',
)
