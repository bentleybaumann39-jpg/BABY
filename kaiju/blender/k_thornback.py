"""THORNBACK: an armoured quadruped the size of a stadium. Domed carapace studded with
osteoderm spikes, a skirt of lateral thorns, a rhino horn and a clubbed tail.
Faces -Y, metres (model ~42 m to the top of the shell, ~110 m long)."""
import math
import numpy as np
from mathutils import Vector
from sdf import Sculpt, Noise
from rig import Skeleton, env, smooth
from parts import Parts
from anim_lib import Limb, gait_limb

NAME = 'thornback'
VOXEL = 0.26
LOW_TRIS = 46000

J = dict(
    hips=(0, 14, 21), sp1=(0, 6, 24), sp2=(0, -4, 25), chest=(0, -14, 23), neck=(0, -20, 20), head0=(0, -25, 18),
    snout=(0, -38.5, 13), jaw0=(0, -27, 14.5), chin=(0, -36, 11.2),
    sho=(11, -15, 16), elb=(13, -13.5, 8.5), wri=(13, -16, 2.6), fball=(13, -19.5, 0.9),
    hip=(10, 14, 17), knee=(12, 10, 9.5), ankle=(12, 15, 2.8), hball=(12, 11.5, 0.9),
    t0=(0, 24, 20), t1=(0, 32, 17), t2=(0, 41, 13.5), t3=(0, 50, 10), t4=(0, 59, 7.5), t5=(0, 68, 6), t6=(0, 77, 5.4),
)
TAIL = ['t0', 't1', 't2', 't3', 't4', 't5', 't6']
TAIL_R = [7.2, 5.8, 4.6, 3.6, 2.8, 2.2, 1.8]


def V(*a):
    return np.array(a, float)


def skeleton():
    s = Skeleton()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', J['hips'], J['sp1'])
    s.bone('spine1', 'hips', J['sp1'], J['sp2'])
    s.bone('spine2', 'spine1', J['sp2'], J['chest'])
    s.bone('chest', 'spine2', J['chest'], J['neck'])
    s.bone('neck', 'chest', J['neck'], J['head0'])
    s.bone('head', 'neck', J['head0'], J['snout'])
    s.bone('jaw', 'head', J['jaw0'], J['chin'])
    s.bone('mouth', 'head', (0, -36.5, 13.0), (0, -38.5, 13.0))
    s.bone('upperarm.L', 'chest', J['sho'], J['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', J['elb'], J['wri'], mirror=True)
    s.bone('hand.L', 'forearm.L', J['wri'], J['fball'], mirror=True)
    s.bone('thigh.L', 'hips', J['hip'], J['knee'], mirror=True)
    s.bone('shin.L', 'thigh.L', J['knee'], J['ankle'], mirror=True)
    s.bone('foot.L', 'shin.L', J['ankle'], J['hball'], mirror=True)
    prev = 'hips'
    for i in range(6):
        s.bone(f'tail{i + 1}', prev, J[TAIL[i]], J[TAIL[i + 1]])
        prev = f'tail{i + 1}'
    return s


def sculpt():
    S = Sculpt()
    # carapace dome in three overlapping sections so it bends a little with the spine
    S.ell((0, 10, 23), (16, 15, 13), rot=(8, 0, 0), bone='hips', k=4)
    S.ell((0, 0, 25), (17, 15, 14), bone='spine1', k=4)
    S.ell((0, -10, 24), (16, 13, 12.5), rot=(-8, 0, 0), bone='spine2', k=4)
    S.ell((0, 0, 17.5), (18.5, 26.5, 3.0), bone='spine1', k=2.0)  # shell rim lip
    S.ell((0, 0, 16), (12, 20, 6.5), bone='spine1', k=4, mat='belly')
    # neck and head
    S.cone(J['chest'], J['neck'], 8.2, 6.8, bone='chest', k=3)
    S.cone(J['neck'], J['head0'], 6.8, 5.8, bone='neck', k=2.5)
    S.ell((0, -28, 17.5), (6.2, 6.5, 4.8), rot=(18, 0, 0), bone='head', k=2)
    S.cone((0, -30, 16), (0, -38.6, 13.2), 4.6, 2.5, bone='head', k=1.6)
    S.ell((0, -34, 15.8), (3.6, 4.5, 1.8), rot=(22, 0, 0), bone='head', k=1.2)
    S.ell((3.6, -28.5, 19.2), (1.8, 3, 1.4), bone='head', k=1, mirror=True)  # brow
    S.ell((0, -32, 12.2), (4.0, 5.5, 1.6), rot=(22, 0, 0), bone='jaw', k=1.0)
    S.ell((0, -32.6, 13.8), (4.4, 6.2, 0.35), rot=(22, 0, 0), op='sub', k=0.25, mat='mouth')
    S.ell((4.6, -29.5, 17.2), (0.9, 1.1, 0.8), op='sub', k=0.3, mirror=True)
    # front legs: columnar, elephant-like pads
    S.ell((11.5, -15, 17), (5.5, 5.5, 5), bone='upperarm.L', k=2.5, mirror=True)
    S.cone(J['sho'], J['elb'], 5.2, 4.4, bone='upperarm.L', k=2, mirror=True)
    S.cone(J['elb'], J['wri'], 4.4, 3.9, bone='forearm.L', k=1.6, mirror=True)
    S.ell((13, -17, 1.9), (4.2, 4.6, 2.2), bone='hand.L', k=1.4, mirror=True)
    # hind legs
    S.cone(J['hip'], J['knee'], 6.2, 4.8, bone='thigh.L', k=2.6, mirror=True)
    S.ell((11.5, 12.5, 14), (5.0, 6.0, 5.5), rot=(20, 0, 0), bone='thigh.L', k=2.2, mirror=True)
    S.cone(J['knee'], J['ankle'], 4.6, 3.9, bone='shin.L', k=1.6, mirror=True)
    S.ell((12, 13.5, 1.9), (4.4, 5.0, 2.2), bone='foot.L', k=1.4, mirror=True)
    # tail with a bony club
    S.chain([J[t] for t in TAIL], TAIL_R, [f'tail{i + 1}' for i in range(6)], k=2.4)
    S.ell((0, 75, 5.6), (5.8, 6.5, 4.2), bone='tail6', k=1.2)
    S.ell((4, 74, 5.4), (2.6, 4, 2.6), bone='tail6', k=1, mirror=True)
    return S


_N = Noise(31)


def noise(P):
    shell = np.clip((P[:, 2] - 18) / 4, 0, 1) * (np.abs(P[:, 1]) < 26)
    n = 0.16 * _N.fbm(P, 0.09, 2) + 0.2 * (_N.ridged(P, 0.4, 3) - 0.55) * (0.6 + 0.6 * shell)
    return n


def body_color(P, N, mats):
    n = len(P)
    shell = np.array([0.12, 0.095, 0.065])
    skin = np.array([0.075, 0.07, 0.062])
    up = np.clip(N[:, 2], -1, 1)
    top = np.clip((P[:, 2] - 17) / 4, 0, 1) * np.clip(up + 0.3, 0, 1) * (np.abs(P[:, 1]) < 27)
    col = skin[None] * (1 - top[:, None]) + shell[None] * top[:, None]
    belly = np.clip(mats.get('belly', 0) * 1.2, 0, 1)
    col = col * (1 - 0.3 * belly[:, None]) + np.array([0.1, 0.09, 0.08])[None] * 0.3 * belly[:, None]
    club = np.clip((P[:, 1] - 70) / 3, 0, 1)
    col = col * (1 - club[:, None]) + shell[None] * 1.3 * club[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.15, 0.04, 0.03])[None] * mouth[:, None]
    mask = np.stack([np.clip(1 - top, 0, 1) * 0.8, np.zeros(n), mouth, np.ones(n)], 1)
    return col, mask


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(23)
    # osteoderm spikes in staggered rows over the dome
    for row, y in enumerate(np.arange(-19, 22, 4.6)):
        for x in np.arange(-13, 13.5, 4.4) + (2.2 if row % 2 else 0):
            top = on_surface(S, float(x), float(y))
            if top is None or top[2] < 21:
                continue
            nrm = normal_at(S, top)
            L = 2.4 + 2.6 * (1 - abs(x) / 15) + rng.random() * 1.2
            P.horn(top - nrm * 0.6, nrm + np.array([0, 0.25, 0]), L, 1.0 + L * 0.12, bend=(0, L * 0.15, 0), bone=bone_at(S, top - nrm * 2),
                   mat='horn', seg=7, rings=4, tip=0.05)
    # lateral thorns along the shell rim
    for y in np.arange(-20, 23, 5.2):
        for sx in (1, -1):
            st = S.surface((sx * 40, float(y), 17.8), (-sx, 0, 0), far=40, step=0.08)
            if st is None:
                continue
            L = 4.5 + 2.0 * math.cos(y / 25 * math.pi / 2)
            P.horn(st - np.array([sx * 0.8, 0, 0]), (sx, 0.15, -0.25), L, 1.4, bend=(0, L * 0.2, -L * 0.1), bone=bone_at(S, st - np.array([sx * 3, 0, 0])),
                   mat='horn', seg=7, rings=4)
    # nose horn, brow horns, frill
    P.horn((0, -34.5, 16.6), (0, -0.55, 1.0), 9.5, 2.0, bend=(0, 2.5, -0.5), bone='head', mat='horn', seg=9, rings=7, flat=0.85)
    P.horn((0, -30.2, 18.5), (0, -0.3, 1.0), 3.6, 1.1, bone='head', mat='horn', seg=7, rings=4)
    for sx in (1, -1):
        P.horn((sx * 3.8, -27.5, 20.6), (sx * 0.5, 0.6, 0.8), 5.0, 1.0, bend=(0, 1.5, 0), bone='head', mat='horn', seg=7, rings=5)
    P.plate((0, -23.5, 21.0), (0, 0.55, 1.0), (0, -1, 0.3), 8.5, 16, 1.0, bone='neck', mat='plate', seed=5, lobes=5, lean=0.0)
    # club spikes and tail thorns
    for a in np.linspace(0, 2 * math.pi, 7)[:-1]:
        d = np.array([math.cos(a), 0.2, math.sin(a) * 0.9])
        P.horn(np.array([0, 75, 5.6]) + d * 4.5, d, 3.6, 1.1, bone='tail6', mat='horn', seg=6, rings=3)
    for i, t in enumerate(TAIL[1:5]):
        p = np.array(J[t])
        for sx in (1, -1):
            P.horn(p + np.array([sx * TAIL_R[i + 1] * 0.8, 0, TAIL_R[i + 1] * 0.4]), (sx, 0.3, 0.5), 2.5 - i * 0.3, 0.8, bone=f'tail{i + 2}' if i < 4 else 'tail5', mat='horn', seg=6, rings=3)
    L = Parts()
    L.row_of_teeth((3.0, -29, 13.8), (0.8, -37.2, 13.3), 7, 0.7, 0.3, (0, 0, -1), 'head', rng)
    L.sphere((4.5, -29.4, 17.2), 0.75, bone='head', mat='eye')
    L.mirrored()
    P.merge(L)
    return P


HARD = [('head', 'jaw')]
WEIGHT_ITERS = 10

LOOK = dict(cell=0.3, wrinkle=2.2, scute=0.16, bump=0.45, cellvar=0.45, groove=0.7, wear=0.4,
            wearcol=(0.22, 0.2, 0.16), rough=0.66, cage=1.0)

PART_MATS = {
    'horn': dict(color=(0.42, 0.36, 0.26), rough=0.45),
    'plate': dict(color=(0.3, 0.24, 0.17), rough=0.5, emissive=(1.0, 0.8, 0.45), emit=0.0),
    'keratin': dict(color=(0.4, 0.34, 0.25), rough=0.4),
    'eye': dict(color=(1.0, 0.75, 0.2), rough=0.15, emissive=(1.0, 0.7, 0.2), emit=2.0),
}

# ============================================================================= animation

FRONT, HIND = {}, {}
for side, sx in (('L', 1), ('R', -1)):
    m = (lambda p: Vector((p[0] * sx, p[1], p[2])))
    FRONT[side] = Limb('upperarm.' + side, 'forearm.' + side, 'hand.' + side, m(J['fball']), m(J['fball']) - m(J['wri']), (sx * 18, 15, 10),
                       end_len=(m(J['fball']) - m(J['wri'])).length)
    HIND[side] = Limb('thigh.' + side, 'shin.' + side, 'foot.' + side, m(J['hball']), m(J['hball']) - m(J['ankle']), (sx * 16, -25, 12),
                      end_len=(m(J['hball']) - m(J['ankle'])).length)

TAU = 2 * math.pi
TAILB = [f'tail{i + 1}' for i in range(6)]
WALK = dict(T=2.8, stride=14.0, duty=0.7)
RUN = dict(T=1.6, stride=18.0, duty=0.5)


def plant(p, skip=()):
    for s in ('L', 'R'):
        if 'f' + s not in skip:
            FRONT[s].rest(p)
        if 'h' + s not in skip:
            HIND[s].rest(p)


def quad(ph, p, G, ph_off, lift, bob, sway, tailamp):
    s1, c2 = math.sin(TAU * ph), math.cos(2 * TAU * ph)
    gait_limb(HIND['L'], p, ph + ph_off['hL'], G['stride'], lift, G['duty'], heel=18)
    gait_limb(HIND['R'], p, ph + ph_off['hR'], G['stride'], lift, G['duty'], heel=18)
    gait_limb(FRONT['L'], p, ph + ph_off['fL'], G['stride'], lift, G['duty'], heel=18)
    gait_limb(FRONT['R'], p, ph + ph_off['fR'], G['stride'], lift, G['duty'], heel=18)
    p.loc('hips', (sway * s1, 0, -bob * 0.5 * (1 + c2)))
    p.rot('hips', y=2.0 * s1, z=2.0 * s1)
    p.rot('spine2', z=-1.5 * s1, y=-1.0 * s1)
    p.rot('chest', z=-1.0 * s1)
    p.rot('neck', x=1.2 * c2, z=-1.5 * s1)
    p.rot('head', x=-1.0 * c2)
    p.rot('jaw', x=2)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-(1.5 + i * 0.9) * tailamp * math.sin(TAU * ph - 0.6 * (i + 1)), x=0.6 * tailamp * math.cos(2 * TAU * ph - 0.7 * i))


def a_walk(t, T, p):
    quad(t / T, p, WALK, dict(hL=0.0, fL=0.25, hR=0.5, fR=0.75), 2.6, bob=0.4, sway=0.6, tailamp=1.0)


def a_run(t, T, p):
    quad(t / T, p, RUN, dict(hL=0.0, fR=0.05, hR=0.5, fL=0.55), 4.0, bob=1.0, sway=0.4, tailamp=1.6)


def a_idle(t, T, p):
    ph = t / T
    plant(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0.25 * math.sin(TAU * ph), 0, 0.15 * b))
    p.rot('spine1', x=-0.6 * b)
    p.rot('neck', z=6 * math.sin(TAU * ph + 0.8), x=1.5 * math.sin(TAU * 2 * ph))
    p.rot('head', z=4 * math.sin(TAU * ph + 0.4))
    p.rot('jaw', x=2 + 1.2 * (b + 1))
    for i, bb in enumerate(TAILB):
        p.rot(bb, z=3 * math.sin(TAU * ph - 0.5 * i))


def a_gore(t, T, p):
    w = env(t, 0.0, 0.35, 0.4, 0.5)
    s = env(t, 0.38, 0.5, 0.62, T)
    plant(p)
    p.loc('hips', (0, -1.5 * s + 1.0 * w, -0.8 * w))
    p.rot('chest', x=4 * w - 4 * s)
    p.rot('neck', x=18 * w - 26 * s, z=-6 * w + 10 * s)
    p.rot('head', x=12 * w - 22 * s)
    p.rot('jaw', x=2 + 18 * s)
    for i, b in enumerate(TAILB):
        p.rot(b, x=1.5 * s)


def a_bash(t, T, p):
    l = env(t, 0.1, 0.42, 0.55, T)
    plant(p)
    p.loc('hips', (0, -5 * l, -0.5 * l))
    p.rot('hips', x=3 * l)
    p.rot('spine2', x=3 * l)
    p.rot('neck', x=14 * l)
    p.rot('head', x=10 * l)
    p.rot('jaw', x=2 + 10 * l)
    for i, b in enumerate(TAILB):
        p.rot(b, x=3 * l)


def a_tail(t, T, p):
    w = env(t, 0.0, 0.45, 0.5, 0.7)
    lag = lambda i: env(t - 0.04 * i, 0.55, 0.95, 1.1, T)
    s = lag(0)
    yaw = 18 * w - 32 * s
    plant(p)
    p.rot('hips', z=yaw * 0.6)
    p.rot('spine1', z=yaw * 0.25)
    p.rot('neck', z=-yaw * 0.5)
    for i, b in enumerate(TAILB):
        p.rot(b, z=(-10 * w + 22 * lag(i + 1)) * (1 + 0.1 * i), x=3 * max(w, lag(i + 1)))


def a_quake(t, T, p):
    if t < 0.75:
        up = smooth(t / 0.75)
    elif t < 0.9:
        q = (t - 0.75) / 0.15
        up = 1 - q * q
    else:
        up = 0.0
    imp = env(t, 0.88, 0.92, 1.0, T)
    for s in ('L', 'R'):
        HIND[s].rest(p)
        FRONT[s].place(p, FRONT[s].contact + Vector((0, 2 * up, 14 * up)), FRONT[s].pitch() + 20 * up)
    p.loc('hips', (0, 2.5 * up, 1.5 * up - 1.5 * imp))
    p.rot('hips', x=-24 * up + 4 * imp)
    p.rot('neck', x=-10 * up + 12 * imp)
    p.rot('head', x=-8 * up + 8 * imp)
    p.rot('jaw', x=2 + 25 * up + 15 * imp)
    for i, b in enumerate(TAILB):
        p.rot(b, x=6 * up - 3 * imp)


def a_roar(t, T, p):
    o = env(t, 0.3, 0.7, 2.3, 2.8)
    vib = math.sin(TAU * 13 * t) * o
    plant(p)
    p.loc('hips', (0, 0.8 * o, 0.6 * o))
    p.rot('hips', x=-4 * o)
    p.rot('neck', x=-20 * o)
    p.rot('head', x=-14 * o + vib)
    p.rot('jaw', x=2 + 34 * o + vib)
    for i, b in enumerate(TAILB):
        p.rot(b, x=4 * o, z=6 * o * math.sin(TAU * 1.5 * t - 0.5 * i))


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.15, T)
    plant(p)
    p.loc('hips', (0, 1.2 * h, 0))
    p.rot('spine2', y=-4 * h)
    p.rot('neck', z=-10 * h, x=-6 * h)
    p.rot('jaw', x=2 + 18 * h)


def a_death(t, T, p):
    a = env(t, 0.0, 0.4, 0.8, 1.2)
    f = max(0.0, min(1.0, (t - 0.8) / 1.4)) ** 2
    if t < 0.8:
        plant(p)
    p.rot('root', y=68 * f)
    p.loc('root', (6 * f, 0, 8 * f))
    p.rot('neck', x=-14 * a + 18 * f)
    p.rot('jaw', x=2 + 26 * a + 12 * f)
    for s in ('L', 'R'):
        if t >= 0.8:
            p.rot('upperarm.' + s, x=-20 * f)
            p.rot('thigh.' + s, x=-15 * f)
    for i, b in enumerate(TAILB):
        p.rot(b, z=-3 * f)


ANIMS = {
    'idle': (a_idle, 6.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_gore, 1.2, False),
    'attack2': (a_bash, 1.1, False),
    'heavy': (a_tail, 1.9, False),
    'stomp': (a_quake, 1.6, False),
    'roar': (a_roar, 3.0, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.6, False),
}

META = dict(
    height=40.0,
    preview_angle=55,
    close=(0, -20, 18, 44),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    hits=dict(attack1=0.5, attack2=0.5, heavy=1.0, stomp=0.9),
    feet=['handL', 'handR', 'footL', 'footR'],
    foot_phase=dict(walk=[0.25, 0.75, 0.0, 0.5], run=[0.55, 0.05, 0.0, 0.5]),
    body=[['hips', 'chest', 19.0], ['chest', 'head', 7.5], ['thighL', 'shinL', 5.5], ['thighR', 'shinR', 5.5],
          ['upperarmL', 'forearmL', 5.0], ['upperarmR', 'forearmR', 5.0], ['tail1', 'tail3', 6.0], ['tail3', 'tail6', 4.0]],
    aim=dict(head='head', chain=['neck', 'head'], pitch0=0.25),
    mouth='mouth',
)
