"""RAZORMAW: a hunched alien brute. Its skull splits into two tall crest blades lined with
teeth along their inner edges, framing a red face with clustered bioluminescent eyes; long
heavy arms end in three glowing talons. Faces -Y, metres (model ~56 m to the crest tips)."""
import math
import numpy as np
from sdf import Sculpt, Noise
from rig import Skeleton
from parts import Parts

NAME = 'razormaw'
VOXEL = 0.2
LOW_TRIS = 64000

J = dict(
    hips=(0, 4, 24), sp1=(0, 0, 28.5), sp2=(0, -5, 32.5), chest=(0, -10.5, 35.5), neck0=(0, -14.5, 37.0),
    neck1=(0, -18, 37.6), head0=(0, -21, 37.8), snout=(0, -32, 35.6), jaw0=(0, -22.4, 35.4), chin=(0, -31, 32.6),
    clav=(3.0, -11, 36.2), sho=(9.6, -12.2, 36.4), elb=(15.6, -13.6, 25.2), wri=(14.8, -20.4, 13.4), hand=(14.4, -23.6, 9.6),
    hip=(6.6, 4.6, 23), knee=(8.6, -3.6, 13.2), ankle=(8.6, 4.4, 4.4), ball=(8.8, -2.6, 1.3), toe=(9.0, -8.2, 0.8),
    t0=(0, 9, 23.4), t1=(0, 16, 21.0), t2=(0, 24, 17.6), t3=(0, 33, 13.6), t4=(0, 43, 10.2), t5=(0, 53, 7.8),
    t6=(0, 63, 6.8), t7=(0, 72, 7.6), t8=(0, 80, 10.4),
)
TAIL = ['t%d' % i for i in range(9)]
TAIL_R = [7.0, 6.2, 5.2, 4.2, 3.3, 2.5, 1.8, 1.2, 0.55]
NT = len(TAIL) - 1
# three talons per hand: knuckle offset from the hand joint, fingertip offset
FINGERS = [((-1.5, -1.2, -0.4), (-2.6, -6.0, -6.2)), ((0.2, -1.6, -0.6), (0.4, -6.6, -6.8)), ((1.9, -1.0, -0.4), (3.4, -5.4, -6.0))]


def V(*a):
    return np.array(a, float)


HS = 1.3  # head scale: the skull is drawn in units of this


def head_frame():
    o = V(*J['head0'])
    f = V(*J['snout']) - o
    f /= np.linalg.norm(f)
    u = np.cross(V(1, 0, 0), f)
    u = -u if u[2] < 0 else u
    pitch = math.degrees(math.atan2(-f[2], -f[1]))

    def H(x, y, z):
        return tuple(o + (V(1, 0, 0) * x + f * y + u * z) * HS)
    return H, pitch, f, u


def finger_pts(i, side='L'):
    sx = 1 if side == 'L' else -1
    h = V(*J['hand'])
    k, t = FINGERS[i]
    a = h + V(*k)
    b = h + V(*t)
    a[0] *= 1 if sx > 0 else -1
    b[0] *= 1 if sx > 0 else -1
    return a, b


def crest_pts(s):
    H, _, f, u = head_frame()
    return V(*H(s * 3.0, 4.6, 0.6)), V(*H(s * 9.6, 6.4, 13.8))


def crest_frame(s):
    """Axis along the blade, the across-blade direction in the frontal plane pointing away from
    the centreline, and the blade width/thickness profile."""
    a, b = crest_pts(s)
    ax = (b - a) / np.linalg.norm(b - a)
    wd = V(s, 0, 0) - ax * ax[0] * s
    wd /= np.linalg.norm(wd)
    if wd[2] > 0:  # keep 'outer' pointing outward-down so the inner edge faces up and in
        wd = -wd
    return a, b, ax, wd


def skeleton():
    s = Skeleton()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', J['hips'], J['sp1'])
    s.bone('spine1', 'hips', J['sp1'], J['sp2'])
    s.bone('spine2', 'spine1', J['sp2'], J['chest'])
    s.bone('chest', 'spine2', J['chest'], J['neck0'])
    s.bone('neck1', 'chest', J['neck0'], J['neck1'])
    s.bone('neck2', 'neck1', J['neck1'], J['head0'])
    H, _, _, _ = head_frame()
    s.bone('head', 'neck2', J['head0'], H(0, 11.0, 0))
    s.bone('jaw', 'head', H(0, 0.6, -1.6), H(0, 10.0, -2.8))
    s.bone('mouth', 'head', H(0, 9.6, -1.4), H(0, 11.6, -1.4))
    a, b = crest_pts(1)
    s.bone('crest.L', 'head', tuple(a), tuple(a + (b - a) * 0.75), mirror=True)
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
    # torso: heavy shoulders, narrow waist, hunched forward
    S.ell((0, 4.0, 24.0), (8.4, 7.2, 6.6), rot=(-10, 0, 0), bone='hips', k=3)
    S.ell((0, -0.6, 28.0), (7.6, 6.6, 6.4), rot=(-28, 0, 0), bone='spine1', k=3.2)
    S.ell((0, -5.6, 32.0), (10.4, 7.4, 7.0), rot=(-40, 0, 0), bone='spine2', k=3.4)
    S.ell((0, -10.2, 35.2), (11.8, 6.4, 6.6), rot=(-50, 0, 0), bone='chest', k=3.2)
    S.ell((0, -10.4, 39.6), (8.4, 6.2, 4.0), rot=(-30, 0, 0), bone='chest', k=3.0)  # trapezius hump
    S.ell((0, -6.6, 27.6), (6.2, 4.0, 6.2), rot=(-34, 0, 0), bone='spine1', k=3.0, mat='belly')
    for sx in (1, -1):
        S.ell((sx * 5.0, -15.0, 32.8), (4.6, 3.0, 4.8), rot=(-40, 0, sx * 14), bone='chest', k=2.4, mat='belly')  # pecs
        S.ell((sx * 7.6, -4.0, 30.0), (2.2, 5.6, 4.6), rot=(-36, 0, 0), bone='spine2', k=2.0)  # flank ribs
    # neck: short and thick, throat red
    S.cone(J['neck0'], J['neck1'], 6.2, 5.3, bone='neck1', k=2.6)
    S.cone(J['neck1'], J['head0'], 5.3, 4.6, bone='neck2', k=2.2)
    S.ell((0, -18.6, 34.4), (4.4, 3.4, 3.6), rot=(-20, 0, 0), bone='neck1', k=2.0, mat='face')
    # head (head-local: x side, y forward, z up)
    S.ell(H(0, 2.4, 0.8), (5.07, 5.98, 4.16), rot=(hp, 0, 0), bone='head', k=1.6)
    S.ell(H(0, 7.0, -0.5), (3.90, 5.72, 2.60), rot=(hp + 4, 0, 0), bone='head', k=1.3)
    S.ell(H(0, 5.4, 1.7), (3.90, 5.46, 1.95), rot=(hp + 2, 0, 0), bone='head', k=1.2, mat='face')  # face mask
    S.ell(H(0, 9.2, 0.6), (2.60, 3.12, 1.82), rot=(hp + 8, 0, 0), bone='head', k=1.0, mat='face')
    for sx in (1, -1):
        S.ell(H(sx * 3.2, 1.6, 0.2), (2.34, 3.64, 2.60), rot=(hp, 0, 0), bone='head', k=1.0)  # jaw muscles
        S.ell(H(sx * 2.6, 5.2, 2.0), (0.9, 1.15, 0.7), op='sub', k=0.3)  # eye pits
    # crest blades: flat paddles rising up and out, flat faces turned outward
    for sx in (1, -1):
        a, b = crest_pts(sx)
        side = 'L' if sx > 0 else 'R'
        a, b, ax, wd = crest_frame(sx)
        S.blade(a, b, wd, (4.8, 0.8), (1.3, 0.35), n=9, bone=['head', 'head'] + ['crest.' + side] * 7, k=0.8, mat='crest')
        mid = a + (b - a) * 0.3
        S.ellx(mid + wd * 1.4, b - a, wd, (4.6, 2.2, 1.7), bone='crest.' + side, k=1.2, mat='crest')  # outer root ridge
    # lower jaw and mouth
    S.ell(H(0, 6.4, -2.3), (3.64, 6.24, 1.56), rot=(hp + 4, 0, 0), bone='jaw', k=0.9)
    S.cone(H(0, 2.4, -2.4), H(0, 10.0, -2.2), 2.6, 1.3, bone='jaw', k=1.0)
    S.ell(H(0, 6.6, -1.2), (4.68, 7.28, 0.52), rot=(hp + 4, 0, 0), op='sub', k=0.25, mat='mouth')
    # arms: long and heavy
    S.ell((10.6, -12.2, 37.2), (4.6, 4.6, 4.8), bone='clavicle.L', k=2.4, mirror=True)  # deltoid
    S.cone(J['sho'], J['elb'], 3.8, 3.0, bone='upperarm.L', k=1.8, mirror=True)
    S.ell((13.2, -11.6, 31.2), (2.8, 3.0, 4.6), rot=(-8, 18, 0), bone='upperarm.L', k=1.6, mirror=True)  # bicep
    S.ell((13.6, -14.8, 31.0), (2.6, 2.6, 4.2), rot=(-8, 18, 0), bone='upperarm.L', k=1.4, mirror=True)  # tricep
    S.cone(J['elb'], J['wri'], 3.4, 2.4, bone='forearm.L', k=1.6, mirror=True)
    S.ell((15.4, -16.4, 20.6), (3.0, 3.0, 4.6), rot=(30, 0, 0), bone='forearm.L', k=1.6, mirror=True)  # forearm mass
    S.ell((14.6, -22.0, 11.6), (2.8, 3.2, 2.0), rot=(52, 0, 0), bone='hand.L', k=1.0, mirror=True)  # palm
    for i in range(3):
        a, b = finger_pts(i)
        m = a + (b - a) * 0.5
        S.cone(a, m, 1.05, 0.85, bone=f'finger{i + 1}.L', k=0.5, mirror=True)
        S.cone(m, b, 0.85, 0.55, bone=f'finger{i + 1}.L', k=0.35, mirror=True)
    # legs: thick, bent
    S.cone(J['hip'], J['knee'], 6.6, 4.4, bone='thigh.L', k=2.8, mirror=True)
    S.ell((8.2, 0.6, 18.6), (5.0, 6.2, 6.8), rot=(-28, 0, 0), bone='thigh.L', k=2.4, mirror=True)
    S.cone(J['knee'], J['ankle'], 4.2, 2.6, bone='shin.L', k=1.6, mirror=True)
    S.ell((8.6, 2.6, 9.6), (3.0, 3.4, 4.2), rot=(40, 0, 0), bone='shin.L', k=1.4, mirror=True)  # calf
    S.cone(J['ankle'], J['ball'], 2.6, 2.0, bone='foot.L', k=1.2, mirror=True)
    for fx, ln in ((-1.8, 4.2), (0.0, 5.4), (1.8, 4.2)):
        a = V(*J['ball']) + V(fx * 0.7, 0.4, -0.1)
        S.cone(a, a + V(fx * 0.5, -ln, -0.5), 1.2, 0.75, bone='toe.L', k=0.7, mirror=True)
    # tail
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(NT)], k=2.2)
    return S


_N = Noise(41)


def noise(P):
    # leathery hide: ridged folds and lumps, calmer over the face mask and crest faces
    face = np.clip((-P[:, 1] - 22.0) / 3.0, 0, 1) * (P[:, 2] > 31)
    n = 0.12 * _N.fbm(P, 0.1, 2) + 0.2 * (_N.ridged(P, 0.42, 3) - 0.55) + 0.06 * _N.fbm(P * np.array([1.0, 1.0, 3.0]), 0.35, 2)
    return n * (1.0 - 0.6 * face)


GLOW = np.array([0.12, 0.62, 1.0])


def body_color(P, N, mats):
    n = len(P)
    back = np.array([0.028, 0.034, 0.044])
    belly = np.array([0.15, 0.12, 0.085])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(mats.get('belly', 0) * 1.3 + np.clip(-up - 0.25, 0, 1) * 0.45, 0, 1)
    col = back[None] * (1 - t[:, None]) + belly[None] * t[:, None]
    face = np.clip(mats.get('face', 0) * 1.4, 0, 1)
    red = np.array([0.30, 0.025, 0.02]) * (0.75 + 0.5 * np.clip(_N.fbm(P, 0.6, 2) + 0.5, 0, 1))[:, None]
    col = col * (1 - face[:, None]) + red * face[:, None]
    crest = np.clip(mats.get('crest', 0), 0, 1)
    col = col * (1 - crest[:, None]) + np.array([0.05, 0.05, 0.06])[None] * crest[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.16, 0.02, 0.02])[None] * mouth[:, None]
    # bioluminescence: talon-ward forearm pores and a row of photophores along each flank
    pores = np.clip((_N.fbm(P, 1.4, 2) - 0.32) * 6.0, 0, 1)
    fore = np.clip((14.0 - P[:, 2]) / 6.0, 0, 1) * (np.abs(P[:, 0]) > 10.5) * (P[:, 1] < -14)
    flank = np.exp(-((np.abs(P[:, 0]) - 8.6) / 1.1) ** 2) * np.exp(-((P[:, 2] - 30.0 + P[:, 1] * 0.35) / 1.4) ** 2)
    spots = np.clip(np.sin(P[:, 1] * 1.6) * 3.0 - 1.4, 0, 1) * flank
    g = np.clip(pores * fore + spots, 0, 1) * (1 - face) * (1 - mouth)
    glow = GLOW[None] * g[:, None] * 0.9 + np.array([0.6, 0.05, 0.03])[None] * (mouth * 0.25)[:, None]
    mask = np.stack([t, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask, glow


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(11)
    H, hp, f, u = head_frame()
    L = Parts()
    # crest teeth: a row down the inner front edge of each blade, pointing inward and forward
    a, b, ax, wd = crest_frame(1)
    for i in range(12):
        s = 0.04 + i * 0.075
        w = 4.8 + (0.8 - 4.8) * s
        bn = 'crest.L' if s > 0.2 else 'head'
        # inner edge: the teeth face the other blade across the face, like a jaw split down the middle
        c = a + (b - a) * s - wd * w * 0.86
        ln = (3.6 - 2.4 * s) * rng.uniform(0.85, 1.12)
        L.horn(c, -wd + V(0, -0.25, 0) + ax * 0.15, ln, 0.5 - 0.22 * s, bend=ax * 0.5, bone=bn, mat='keratin',
               seg=6, rings=4, tip=0.03)
        # outer edge hooks
        if i % 2 == 1:
            cb = a + (b - a) * s + wd * w * 0.8
            L.horn(cb, wd + ax * 0.6, 2.0 - 1.0 * s, 0.5, bend=ax * 0.6, bone=bn, mat='horn', seg=6, rings=3)
    # mouth teeth
    L.row_of_teeth(H(2.9, 2.6, -1.0), H(0.8, 10.6, -0.9), 10, 1.8, 0.4, (0, 0, -1), 'head', rng)
    L.row_of_teeth(H(2.7, 2.8, -1.6), H(0.7, 10.0, -1.6), 9, 1.5, 0.36, (0, 0, 1), 'jaw', rng)
    # eye clusters: three glowing eyes per side under the crest root
    for (x, y, z, r) in ((2.6, 5.2, 2.0, 0.62), (3.0, 3.9, 2.9, 0.5), (2.5, 6.5, 1.5, 0.42), (3.2, 2.7, 3.7, 0.38)):
        L.sphere(H(x, y, z), r * HS, bone='head', mat='eye')
    # glowing talons
    for i in range(3):
        a_, b_ = finger_pts(i)
        d = (b_ - a_) / np.linalg.norm(b_ - a_)
        L.horn(b_ - d * 0.6, d + V(0, -0.35, 0), 5.6 - 0.6 * abs(i - 1), 0.78, bend=(0, 1.0, -1.6),
               bone=f'finger{i + 1}.L', mat='lum', seg=8, rings=6, flat=0.72, tip=0.03)
    # toe claws
    for fx, ln in ((-1.8, 4.2), (0.0, 5.4), (1.8, 4.2)):
        a_ = V(*J['ball']) + V(fx * 0.7, 0.4, -0.1)
        tip = a_ + V(fx * 0.5, -ln, -0.5)
        L.horn(tip + V(0, 0.3, 0.2), (fx * 0.15, -1, -0.4), 1.9, 0.62, bend=(0, 0, -0.5), bone='toe.L', seg=7, rings=4, flat=0.7)
    # elbow and shoulder spurs
    L.horn(V(*J['elb']) + V(1.6, 2.0, 0.4), (0.4, 1.0, -0.2), 3.0, 0.9, bend=(0, 0.6, 0.6), bone='upperarm.L', mat='horn', seg=7, rings=4)
    for k, (dx, dy, dz) in enumerate(((10.0, -9.6, 41.2), (12.6, -10.6, 40.0), (7.6, -8.4, 41.6))):
        q = V(dx, dy, dz)
        L.horn(q, (0.35, 0.5, 1.0), 3.2 - k * 0.5, 0.9, bend=(0, 0.8, 0), bone='clavicle.L', mat='horn', seg=7, rings=4)
    L.mirrored()
    P.merge(L)
    # dorsal armour: low jagged plates down the spine and tail
    ys = [-12.5, -9.5, -6.2, -2.6, 1.2, 5.2, 9.8, 15.0, 20.6, 26.8, 33.4, 40.4, 47.6, 55.0, 62.4, 69.6]
    hs = [2.0, 2.8, 3.4, 3.6, 3.4, 3.0, 2.8, 2.7, 2.5, 2.3, 2.0, 1.8, 1.5, 1.2, 0.9, 0.7]
    for i, (y, h) in enumerate(zip(ys, hs)):
        top = on_surface(S, 0.0, y)
        if top is None:
            continue
        nrm = normal_at(S, top)
        nxt = on_surface(S, 0.0, y + 1.0)
        fwd = top - nxt
        fwd /= np.linalg.norm(fwd)
        P.plate(top - nrm * (0.6 + h * 0.1), nrm, fwd, h + 0.7, h * 1.1 + 1.0, 0.4 + h * 0.06,
                bone=bone_at(S, top - nrm * 2.0), seed=i, lobes=2, lean=0.45)
    return P


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 10

LOOK = dict(cell=0.7, wrinkle=2.8, scute=0.22, bump=0.34, cellvar=0.35, groove=0.5, wear=0.22,
            wearcol=(0.14, 0.15, 0.16), rough=0.5, cage=0.9, crag=0.55, noisew=0.45, folds=0.35, foldscale=0.55,
            glow=True)

PART_MATS = {
    'keratin': dict(color=(0.72, 0.64, 0.48), rough=0.32),
    'horn': dict(color=(0.06, 0.065, 0.075), rough=0.4),
    'plate': dict(color=(0.07, 0.08, 0.1), rough=0.38, emissive=(0.2, 0.65, 1.0), emit=0.0),
    'lum': dict(color=(0.3, 0.7, 1.0), rough=0.2, emissive=(0.2, 0.68, 1.0), emit=2.2),
    'eye': dict(color=(0.5, 0.9, 1.0), rough=0.1, emissive=(0.3, 0.85, 1.0), emit=4.0),
}


# ============================================================================= animation
from rig import env, smooth, foot_cycle
from mathutils import Vector

TAU = 2 * math.pi
BALL = {'L': Vector(J['ball']), 'R': Vector((-J['ball'][0], J['ball'][1], J['ball'][2]))}
FOOT_LEN = (Vector(J['ball']) - Vector(J['ankle'])).length
FOOT_PITCH = math.degrees(math.atan2(J['ankle'][2] - J['ball'][2], J['ankle'][1] - J['ball'][1]))
TOE_PITCH = math.degrees(math.atan2(J['ball'][2] - J['toe'][2], J['ball'][1] - J['toe'][1]))
WRI = {'L': Vector(J['wri']), 'R': Vector((-J['wri'][0], J['wri'][1], J['wri'][2]))}
HAND_DIR = (Vector(J['hand']) - Vector(J['wri'])).normalized()
TAILB = [f'tail{i + 1}' for i in range(NT)]
SIDES = (('L', 1), ('R', -1))

WALK = dict(T=2.5, stride=15.0, duty=0.64, lift=3.0)
RUN = dict(T=1.6, stride=21.0, duty=0.5, lift=5.0)


def leg(p, side, ball, foot_pitch=None, toe_pitch=None):
    sx = 1 if side == 'L' else -1
    fp = math.radians(FOOT_PITCH if foot_pitch is None else foot_pitch)
    d = Vector((0.0, -math.cos(fp), -math.sin(fp)))
    p.ik('thigh.' + side, 'shin.' + side, ball - d * FOOT_LEN, Vector((sx * 11, -34, 16)))
    p.aim('foot.' + side, d)
    tp = math.radians(TOE_PITCH if toe_pitch is None else toe_pitch)
    p.aim('toe.' + side, Vector((sx * 0.03, -math.cos(tp), -math.sin(tp))))


def arm(p, side, wri, hand_pitch=0.0):
    """Plant the wrist at `wri` (armature space), elbow out and back; hand keeps its rest heading,
    pitched by hand_pitch degrees (+ = fingers further under)."""
    sx = 1 if side == 'L' else -1
    p.ik('upperarm.' + side, 'forearm.' + side, wri, Vector((sx * 30, 6, 30)))
    d = Vector((HAND_DIR.x * sx, HAND_DIR.y, HAND_DIR.z))
    a = math.radians(hand_pitch)
    d = Vector((d.x, d.y * math.cos(a) - d.z * math.sin(a), d.y * math.sin(a) + d.z * math.cos(a)))
    p.aim('hand.' + side, d)


def claws(p, side, curl=0.0, spread=0.0):
    sx = 1 if side == 'L' else -1
    for i in range(3):
        p.rot(f'finger{i + 1}.{side}', x=curl, z=sx * spread * (i - 1))


def crest(p, flare=0.0, fwd=0.0):
    p.rot('crest.L', y=flare, x=fwd)
    p.rot('crest.R', y=-flare, x=fwd)


def stand(p, spread=0.0, arms=True):
    for side, sx in SIDES:
        leg(p, side, BALL[side] + Vector((sx * spread, 0, 0)))
        if arms:
            arm(p, side, WRI[side])


def tail_wave(p, ph, amp, lift=0.0):
    for i, b in enumerate(TAILB):
        p.rot(b, z=amp * (1.2 + i * 0.7) * math.sin(TAU * ph - 0.6 * (i + 1)),
              x=lift * (1.0 if i < 3 else -0.4) + 0.5 * amp * math.cos(2 * TAU * ph - 0.5 * i))


def gait(ph, p, g, bob, sway, lean, reach, tail, crouch=0.0):
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    duty = g['duty']
    for side, off in (('L', 0.0), ('R', 0.5)):
        sp = (ph + off) % 1.0
        f, h, sw = foot_cycle(sp, g['stride'], g['lift'], duty)
        if sp < duty:
            k = smooth((sp / duty - 0.68) / 0.32)
            fp, tp = FOOT_PITCH + 30 * k, TOE_PITCH
        else:
            fp = FOOT_PITCH + 30 * (1 - smooth(sw * 1.4)) + 6 * math.sin(math.pi * sw)
            tp = TOE_PITCH + 20 * math.sin(math.pi * sw)
        leg(p, side, BALL[side] + Vector((0.0, -f, h)), fp, tp)
        # knuckle-walk: each arm moves with the opposite leg and plants its talons
        sa = (ph + off + 0.5) % 1.0
        fa, ha, swa = foot_cycle(sa, g['stride'] * reach, g['lift'] * 1.6, duty)
        arm(p, side, WRI[side] + Vector((0.0, -fa, ha)), hand_pitch=-12 * math.sin(math.pi * swa))
        claws(p, side, curl=8 + 18 * math.sin(math.pi * swa), spread=4)
    p.loc('hips', (sway * s1, 0.0, -crouch - bob * 0.5 * (1 + c2)))
    p.rot('hips', x=lean * 0.3, y=2.5 * s1, z=3.5 * s1)
    p.rot('spine1', x=lean * 0.3, z=-1.5 * s1)
    p.rot('spine2', x=lean * 0.25, y=-2.0 * s1, z=-2.0 * s1)
    p.rot('chest', z=-2.5 * s1, y=-2.0 * s1)
    p.rot('neck1', x=-lean * 0.4 + 1.6 * c2)
    p.rot('head', x=-1.6 * c2, z=-2.0 * s1)
    p.rot('jaw', x=4)
    crest(p, flare=1.5 * c2)
    tail_wave(p, ph, tail, lift=1.5)


def a_walk(t, T, p):
    gait(t / T, p, WALK, bob=0.7, sway=0.9, lean=3.0, reach=1.0, tail=1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, bob=1.4, sway=0.5, lean=10.0, reach=1.15, tail=1.4, crouch=1.2)


def breathe(p, t, T, amt=1.0):
    b = math.sin(TAU * 2 * t / T)
    p.rot('spine2', x=-0.9 * b * amt)
    p.rot('chest', x=-0.9 * b * amt)
    p.loc('hips', (0.0, 0.0, 0.15 * b * amt))
    return b


def a_idle(t, T, p):
    ph = t / T
    stand(p)
    b = breathe(p, t, T)
    p.rot('hips', y=0.8 * math.sin(TAU * ph))
    p.rot('neck1', z=5.0 * math.sin(TAU * ph + 1.0), x=0.8 * b)
    p.rot('head', z=6.0 * math.sin(TAU * ph + 0.6), x=2.0 * math.sin(TAU * 3 * ph))
    p.rot('jaw', x=4 + 2.0 * max(0.0, math.sin(TAU * 4 * ph)))
    crest(p, flare=2.0 + 3.0 * max(0.0, math.sin(TAU * 2 * ph + 0.4)))
    for side, sx in SIDES:
        claws(p, side, curl=6 + 6 * math.sin(TAU * 2 * ph + (0 if side == 'L' else 2.0)), spread=3)
    tail_wave(p, ph, 1.2)


def rake(t, T, p, side):
    sg = 1 if side == 'L' else -1
    o = 'R' if side == 'L' else 'L'
    w = env(t, 0.0, 0.32, 0.36, 0.5)
    s = env(t, 0.34, 0.52, 0.62, T)
    for sd, sx in SIDES:
        leg(p, sd, BALL[sd] + Vector((sx * 0.8, 0, 0)))
    arm(p, o, WRI[o] + Vector((0, 1.0 * s, 0.6 * s)))
    twist = sg * 18 * w - sg * 34 * s
    p.rot('hips', z=twist * 0.15)
    p.loc('hips', (0, -1.8 * s, -0.6 * s + 0.8 * w))
    for b, k in (('spine1', 0.25), ('spine2', 0.3), ('chest', 0.35)):
        p.rot(b, z=twist * k, x=-6 * w + 6 * s)
    p.rot('neck1', z=-twist * 0.3)
    p.rot('head', z=-twist * 0.25, x=-6 * w + 4 * s)
    p.rot('jaw', x=4 + 22 * s)
    # wind up high and out, then rake down and across
    p.rot('clavicle.' + side, x=-14 * w + 6 * s, z=sg * 6 * w)
    p.rot('upperarm.' + side, x=-95 * w + 70 * s, y=sg * 40 * w - sg * 70 * s, z=-sg * 20 * s)
    p.rot('forearm.' + side, x=-45 * w + 35 * s)
    p.rot('hand.' + side, x=-30 * w + 40 * s)
    claws(p, side, curl=-25 * w + 45 * s, spread=12 * w)
    crest(p, flare=6 * w + 4 * s)
    tail_wave(p, 0.25, 0.5)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-twist * 0.06 * (1 + 0.4 * i))


def a_rake_r(t, T, p):
    rake(t, T, p, 'R')


def a_rake_l(t, T, p):
    rake(t, T, p, 'L')


def a_smash(t, T, p):
    up = env(t, 0.05, 0.62, 0.72, 0.72)
    if 0.72 <= t < 0.95:
        q = (t - 0.72) / 0.23
        up = 1 - q * q
    elif t >= 0.95:
        up = 0.0
    imp = env(t, 0.92, 0.98, 1.15, T)
    for sd, sx in SIDES:
        leg(p, sd, BALL[sd] + Vector((sx * 1.4, 0, 0)), FOOT_PITCH + 6 * up)
    p.loc('hips', (0, 2.4 * up - 2.0 * imp, 3.0 * up - 2.6 * imp))
    p.rot('hips', x=-24 * up + 10 * imp)
    p.rot('spine1', x=-10 * up + 8 * imp)
    p.rot('spine2', x=-8 * up + 8 * imp)
    p.rot('chest', x=-6 * up + 6 * imp)
    p.rot('neck1', x=8 * up - 6 * imp)
    p.rot('head', x=6 * up - 8 * imp)
    p.rot('jaw', x=4 + 28 * up + 12 * imp)
    for sd, sx in SIDES:
        p.rot('upperarm.' + sd, x=-150 * up - 10 * imp, y=sx * 10 * up)
        p.rot('forearm.' + sd, x=-40 * up + 20 * imp)
        p.rot('hand.' + sd, x=-20 * up + 30 * imp)
        claws(p, sd, curl=40 * up + 30 * imp, spread=2)
    crest(p, flare=10 * up, fwd=-6 * up)
    for i, b in enumerate(TAILB):
        p.rot(b, x=5 * up - 6 * imp)


def a_stomp(t, T, p):
    up = env(t, 0.08, 0.58, 0.64, 0.64)
    if 0.64 <= t < 0.84:
        q = (t - 0.64) / 0.2
        up = 1 - q * q
    elif t >= 0.84:
        up = 0.0
    imp = env(t, 0.82, 0.86, 0.95, T)
    leg(p, 'L', BALL['L'] + Vector((0.8, 0, 0)))
    leg(p, 'R', BALL['R'] + Vector((-0.4, -4.0 * up, 12.0 * up)), FOOT_PITCH + 16 * up, TOE_PITCH + 10 * up)
    p.loc('hips', (2.2 * up, 1.0 * up, 1.6 * up - 2.2 * imp))
    p.rot('hips', y=5 * up, x=-12 * up + 6 * imp)
    p.rot('spine2', x=-6 * up + 8 * imp)
    p.rot('chest', x=-4 * up + 6 * imp)
    p.rot('neck1', x=4 * up - 2 * imp)
    p.rot('head', x=-4 * up + 10 * imp)
    p.rot('jaw', x=4 + 26 * up + 14 * imp)
    for sd, sx in SIDES:
        p.rot('upperarm.' + sd, y=sx * 40 * up, x=-30 * up + 20 * imp)
        p.rot('forearm.' + sd, x=-20 * up)
        claws(p, sd, curl=-20 * up, spread=14 * up)
    crest(p, flare=8 * up + 4 * imp)
    for i, b in enumerate(TAILB):
        p.rot(b, x=4 * up - 3 * imp)


def a_roar(t, T, p):
    r = env(t, 0.1, 0.7, 2.6, 3.2)
    o = env(t, 0.5, 0.85, 2.5, 2.95)
    vib = math.sin(TAU * 17 * t) * o
    for sd, sx in SIDES:
        leg(p, sd, BALL[sd] + Vector((sx * 1.2, 0, 0)))
    p.loc('hips', (0, 2.8 * r, 3.4 * r))
    p.rot('hips', x=-22 * r)
    for b, k in (('spine1', -8), ('spine2', -8), ('chest', -8), ('neck1', -10), ('neck2', -8)):
        p.rot(b, x=k * r)
    p.rot('head', x=-12 * r + 0.8 * vib, z=4 * math.sin(TAU * 0.7 * t) * o)
    p.rot('jaw', x=4 + 48 * o + 1.5 * vib)
    crest(p, flare=22 * o + 1.2 * vib, fwd=-8 * o)
    for sd, sx in SIDES:
        p.rot('clavicle.' + sd, y=sx * 8 * r)
        p.rot('upperarm.' + sd, y=sx * 65 * r, x=-50 * r)
        p.rot('forearm.' + sd, x=-30 * r)
        p.rot('hand.' + sd, x=-20 * r)
        claws(p, sd, curl=-30 * r, spread=16 * r)
    for i, b in enumerate(TAILB):
        p.rot(b, x=(5 - 0.8 * i) * r, z=3 * r * math.sin(TAU * 0.5 * t - 0.5 * i))


def breath_pose(p, k):
    stand(p, 0.8)
    p.loc('hips', (0, 0.8 * k, -0.8 * k))
    p.rot('spine2', x=2 * k)
    p.rot('chest', x=2 * k)
    p.rot('neck1', x=-6 * k)
    p.rot('neck2', x=-4 * k)
    p.rot('head', x=-4 * k)
    p.rot('jaw', x=4 + 38 * k)
    crest(p, flare=26 * k, fwd=-10 * k)
    for sd, sx in SIDES:
        claws(p, sd, curl=30 * k, spread=10 * k)
    for i, b in enumerate(TAILB):
        p.rot(b, x=3 * k)


def a_breath_in(t, T, p):
    k = smooth(t / T)
    breath_pose(p, k)
    p.rot('neck1', x=9 * math.sin(math.pi * t / T))


def a_breath_loop(t, T, p):
    breath_pose(p, 1.0)
    tr = math.sin(TAU * 6 * t / T)
    p.rot('head', x=0.8 * tr, z=0.6 * math.sin(TAU * 4 * t / T))
    p.rot('jaw', x=1.6 * math.sin(TAU * 8 * t / T))
    crest(p, flare=1.5 * tr)


def a_breath_out(t, T, p):
    breath_pose(p, 1 - smooth(t / T))


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.16, T)
    stand(p)
    p.loc('hips', (0, 1.6 * h, -0.5 * h))
    p.rot('spine2', y=-6 * h, x=-5 * h)
    p.rot('chest', x=-5 * h)
    p.rot('neck1', z=-10 * h)
    p.rot('head', z=-14 * h, x=-8 * h)
    p.rot('jaw', x=4 + 22 * h)
    crest(p, flare=10 * h)
    for i, b in enumerate(TAILB):
        p.rot(b, z=5 * h * math.sin(i * 0.7))


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.9) / 1.4)) ** 2
    bounce = math.sin(max(0.0, t - 2.3) * 9) * math.exp(-max(0.0, t - 2.3) * 4) * (t > 2.3)
    if t < 0.9:
        stand(p)
    else:
        for sd, sx in SIDES:
            p.rot('thigh.' + sd, x=-16 * f, y=-sx * 6 * f)
            p.rot('shin.' + sd, x=12 * f)
    p.rot('root', y=84 * f + 2 * bounce)
    p.loc('root', (3.0 * f, 0, 5.5 * f))
    p.rot('spine1', x=-6 * a, y=6 * f)
    p.rot('chest', x=-8 * a)
    p.rot('neck1', x=-14 * a + 10 * f, y=8 * f)
    p.rot('head', x=-12 * a + 4 * f, y=10 * f)
    p.rot('jaw', x=4 + 34 * a + 16 * f)
    crest(p, flare=20 * a - 8 * f)
    for sd, sx in SIDES:
        p.rot('upperarm.' + sd, y=sx * 40 * a + sx * 10 * f, x=-30 * a + 25 * f)
        claws(p, sd, curl=-20 * a + 50 * f)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-2.5 * f, x=-1.0 * f)


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_rake_r, 1.2, False),
    'attack2': (a_rake_l, 1.2, False),
    'heavy': (a_smash, 1.7, False),
    'stomp': (a_stomp, 1.5, False),
    'roar': (a_roar, 3.4, False),
    'special_in': (a_breath_in, 1.0, False),
    'special_loop': (a_breath_loop, 1.0, True),
    'special_out': (a_breath_out, 0.7, False),
    'hit': (a_hit, 0.7, False),
    'death': (a_death, 3.6, False),
}

META = dict(
    height=56.0,
    preview_angle=35,
    sheet_angle=55,
    close=(0, -30, 44, 30),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    hits=dict(attack1=0.5, attack2=0.5, heavy=0.97, stomp=0.85, special_in=1.0),
    foot_phase=dict(walk=[0.0, 0.5], run=[0.0, 0.5]),
    duty=dict(walk=WALK['duty'], run=RUN['duty']),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    body=[['thighL', 'shinL', 5.6], ['thighR', 'shinR', 5.6], ['upperarmL', 'forearmL', 4.0], ['upperarmR', 'forearmR', 4.0],
          ['forearmL', 'handL', 3.2], ['forearmR', 'handR', 3.2], ['hips', 'chest', 10.0], ['chest', 'head', 7.0],
          ['tail1', 'tail3', 6.0], ['tail3', 'tail5', 4.0], ['tail5', 'tail8', 2.4]],
    aim=dict(head='head', chain=['neck1', 'neck2', 'head'], pitch0=0.15),
    feet=['toeL', 'toeR'],
    mouth='mouth',
)
