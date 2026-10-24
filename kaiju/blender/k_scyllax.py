"""SCYLLAX: an abyssal crab-scorpion. Flat armoured cephalothorax on eight jointed legs,
two crushing chelae, a segmented tail arched over the back ending in a stinger, and
bioluminescent seams. Faces -Y, metres (model ~34 m to the stinger, ~70 m across)."""
import math
import numpy as np
from mathutils import Vector
from sdf import Sculpt, Noise
from rig import Skeleton, env, smooth, foot_cycle
from parts import Parts

NAME = 'scyllax'
VOXEL = 0.2
LOW_TRIS = 44000

BODY_Z = 13.0
TAILP = [(0, 9, 14.5), (0, 15.5, 19.5), (0, 19, 27), (0, 19.5, 35.5), (0, 16.5, 42.5), (0, 10.5, 46.5), (0, 4.5, 44.5)]
TAIL_R = [4.6, 4.0, 3.5, 3.1, 2.8, 2.5, 2.2]
# legs: attachment on the body side, foot on the ground (left side, x > 0)
LEGS = [((7.5, -6.5, 12.5), (24, -17, 0.6)), ((8.5, -2.0, 12.5), (28, -5, 0.6)),
        ((8.5, 2.5, 12.5), (28, 6.5, 0.6)), ((7.5, 6.5, 12.5), (23, 17, 0.6))]
ARM = dict(sho=(7.5, -9.5, 14), elb=(15.5, -17, 19), wri=(14.5, -25.5, 17.5), claw=(13.0, -43.5, 16.8), dac0=(15.0, -32.0, 20.0), dac1=(13.2, -43.0, 18.0))


def V(*a):
    return np.array(a, float)


def knee_of(a, f):
    a, f = V(*a), V(*f)
    return tuple(a + (f - a) * 0.42 + V(0, 0, 11.5))


def skeleton():
    s = Skeleton()
    s.bone('root', None, (0, 0, 0), (0, -6, 0))
    s.bone('hips', 'root', (0, 6, BODY_Z + 1.5), (0, -2, BODY_Z + 2))
    s.bone('chest', 'hips', (0, -2, BODY_Z + 2), (0, -11, BODY_Z + 2))
    s.bone('head', 'chest', (0, -11, BODY_Z + 2), (0, -16.5, BODY_Z + 1))
    s.bone('jaw', 'head', (0, -14.5, BODY_Z - 1.0), (0, -18.5, BODY_Z - 2.0))
    s.bone('mouth', 'head', (0, -16.5, BODY_Z - 0.6), (0, -18.5, BODY_Z - 0.6))
    s.bone('upperarm.L', 'chest', ARM['sho'], ARM['elb'], mirror=True)
    s.bone('forearm.L', 'upperarm.L', ARM['elb'], ARM['wri'], mirror=True)
    s.bone('claw.L', 'forearm.L', ARM['wri'], ARM['claw'], mirror=True)
    s.bone('pincer.L', 'claw.L', ARM['dac0'], ARM['dac1'], mirror=True)
    for i, (a, f) in enumerate(LEGS):
        k = knee_of(a, f)
        s.bone(f'leg{i + 1}.L', 'hips' if i >= 2 else 'chest', a, k, mirror=True)
        s.bone(f'leg{i + 1}lo.L', f'leg{i + 1}.L', k, f, mirror=True)
        s.bone(f'foot{i + 1}.L', f'leg{i + 1}lo.L', f, (f[0], f[1], f[2] - 0.6), mirror=True)
    prev = 'hips'
    for i in range(6):
        s.bone(f'tail{i + 1}', prev, TAILP[i], TAILP[i + 1])
        prev = f'tail{i + 1}'
    return s


def sculpt():
    S = Sculpt()
    z = BODY_Z
    # carapace and plastron
    S.ell((0, -1, z + 1.5), (11.5, 13.5, 5.2), bone='chest', k=2.5)
    S.ell((0, 6, z + 1.0), (10.5, 8.5, 5.0), bone='hips', k=2.5)
    S.ell((0, -12, z + 1.2), (7.5, 5.5, 4.0), bone='head', k=2.0)
    S.ell((0, 0, z - 2.5), (9.5, 14, 2.5), bone='chest', k=2.0, mat='belly')
    for sx in (1, -1):
        S.ell((sx * 9.5, -3, z + 2.2), (3.0, 11, 2.0), rot=(0, sx * 20, 0), bone='chest', k=1.6)
    S.ell((0, -6, z + 6.2), (5.5, 7.5, 1.4), bone='chest', k=1.5)  # dorsal ridge
    # mandibles
    S.ell((0, -16.8, z - 1.6), (4.2, 2.6, 1.2), bone='jaw', k=0.6)
    S.ell((0, -15.8, z - 0.55), (4.6, 3.6, 0.3), op='sub', k=0.2, mat='mouth')
    # eye stalks
    for sx in (1, -1):
        S.cone((sx * 2.5, -14, z + 3), (sx * 3.5, -15.5, z + 6.2), 0.8, 0.6, bone='head', k=0.6)
    # chelae: swollen palm, a fixed finger below and the hinged dactyl above, both curving in
    for sx in (1, -1):
        m = (lambda p: (p[0] * sx, p[1], p[2]))
        side = 'L' if sx > 0 else 'R'
        S.cone(m(ARM['sho']), m(ARM['elb']), 2.4, 2.2, bone='upperarm.' + side, k=0.8)
        S.ell(m((15.5, -17, 19)), (2.7, 2.7, 2.7), bone='forearm.' + side, k=0.6)
        S.cone(m(ARM['elb']), m(ARM['wri']), 2.4, 3.0, bone='forearm.' + side, k=0.8)
        S.ell(m((14.6, -30.0, 17.6)), (4.3, 6.4, 4.0), rot=(6, 0, 0), bone='claw.' + side, k=1.2)
        S.ell(m((16.6, -29.0, 18.2)), (1.6, 4.5, 2.6), bone='claw.' + side, k=0.8)  # outer knuckle ridge
        S.chain([m((14.5, -34.0, 16.0)), m((14.0, -39.0, 15.4)), m(ARM['claw'])], [2.4, 1.5, 0.35], ['claw.' + side] * 2, k=0.6)
        S.chain([m(ARM['dac0']), m((14.6, -37.5, 19.9)), m(ARM['dac1'])], [2.0, 1.35, 0.35], ['pincer.' + side] * 2, k=0.35)
    # legs: jointed armoured segments, kept rigid between joints
    for i, (a, f) in enumerate(LEGS):
        k = knee_of(a, f)
        a_, k_, f_ = V(*a), V(*k), V(*f)
        mid = k_ + (f_ - k_) * 0.5
        S.ell(tuple(a_ + V(1.2, 0, 0)), (2.4, 2.4, 2.2), bone=f'leg{i + 1}.L', k=0.8, mirror=True)  # coxa
        S.cone(a, k, 2.0, 1.55, bone=f'leg{i + 1}.L', k=0.6, mirror=True)
        S.ell(k, (1.9, 1.9, 1.9), bone=f'leg{i + 1}lo.L', k=0.3, mirror=True)  # knee knuckle
        S.cone(k, tuple(mid), 1.5, 1.15, bone=f'leg{i + 1}lo.L', k=0.3, mirror=True)
        S.ell(tuple(mid), (1.35, 1.35, 1.35), bone=f'leg{i + 1}lo.L', k=0.25, mirror=True)
        S.cone(tuple(mid), f, 1.15, 0.4, bone=f'leg{i + 1}lo.L', k=0.25, mirror=True)
    # tail: segmented, swelling into the venom bulb
    for i in range(6):
        a, b = V(*TAILP[i]), V(*TAILP[i + 1])
        ang = -math.degrees(math.atan2(b[1] - a[1], b[2] - a[2]))
        ln = np.linalg.norm(b - a)
        # each ring flares toward its rear edge and overlaps the next, like real metasoma segments
        S.ell(tuple(a + (b - a) * 0.52), (TAIL_R[i] * 1.08, TAIL_R[i] * 0.88, ln * 0.6), rot=(ang, 0, 0), bone=f'tail{i + 1}', k=0.35)
        S.ell(tuple(a + (b - a) * 0.8), (TAIL_R[i] * 1.12, TAIL_R[i] * 0.95, ln * 0.18), rot=(ang, 0, 0), bone=f'tail{i + 1}', k=0.3)
        top = np.cross(b - a, [1, 0, 0])
        top = top / (np.linalg.norm(top) + 1e-9)
        if top[2] < 0:
            top = -top
        S.ell(tuple(a + (b - a) * 0.5 + top * TAIL_R[i] * 0.7), (TAIL_R[i] * 0.35, TAIL_R[i] * 0.4, ln * 0.45), rot=(ang, 0, 0), bone=f'tail{i + 1}', k=0.5)
    S.ell((0, 6.8, 45.2), (3.4, 4.2, 3.4), rot=(30, 0, 0), bone='tail6', k=0.8)
    return S


_N = Noise(53)


def noise(P):
    return 0.08 * _N.fbm(P, 0.12, 2) + 0.08 * (_N.ridged(P, 0.5, 2) - 0.55)


def body_color(P, N, mats):
    n = len(P)
    shell = np.array([0.018, 0.04, 0.042])
    under = np.array([0.16, 0.06, 0.035])
    up = np.clip(N[:, 2], -1, 1)
    t = np.clip(-up * 1.2, 0, 1) * np.clip((16 - P[:, 2]) / 6, 0, 1)
    col = shell[None] * (1 - t[:, None]) + under[None] * t[:, None]
    tips = np.clip((-P[:, 1] - 33) / 5, 0, 1)
    col = col * (1 - tips[:, None]) + np.array([0.2, 0.08, 0.04])[None] * tips[:, None]
    mouth = np.clip(mats.get('mouth', 0), 0, 1)
    col = col * (1 - mouth[:, None]) + np.array([0.12, 0.05, 0.03])[None] * mouth[:, None]
    seams = np.clip(up + 0.2, 0, 1) * (1 - t) * (1 - mouth)
    mask = np.stack([t, seams, mouth, np.ones(n)], 1)
    return col, mask


def parts(S):
    from parts import on_surface, normal_at, bone_at
    P = Parts()
    rng = np.random.default_rng(29)
    # stinger and spines along the tail
    P.horn((0, 4.4, 43.6), (0, -0.55, -0.6), 8.5, 1.7, bend=(0, -2.0, 2.0), bone='tail6', mat='horn', seg=8, rings=6)
    for i in range(1, 6):
        a, b = V(*TAILP[i]), V(*TAILP[i + 1])
        c = (a + b) / 2
        d = b - a
        out = np.cross(d, [1, 0, 0])
        out = out / (np.linalg.norm(out) + 1e-9)
        if out[2] < 0:
            out = -out
        P.horn(c + out * TAIL_R[i] * 0.8, out, 2.0 - i * 0.15, 0.6, bone=f'tail{i + 1}', mat='horn', seg=6, rings=3)
    # serrations on the claw fingers, carapace spikes, rostrum and leg spines
    L = Parts()

    def along(pts, radii, u):
        pts = [V(*q) for q in pts]
        seg = min(int(u * (len(pts) - 1)), len(pts) - 2)
        f = u * (len(pts) - 1) - seg
        return pts[seg] + (pts[seg + 1] - pts[seg]) * f, radii[seg] + (radii[seg + 1] - radii[seg]) * f

    fixed = [(14.5, -34.0, 16.0), (14.0, -39.0, 15.4), ARM['claw']]
    dac = [ARM['dac0'], (14.6, -37.5, 19.9), ARM['dac1']]
    for k in range(6):
        u = 0.18 + k * 0.12
        c, r = along(fixed, [2.4, 1.5, 0.35], u)
        L.horn(c + V(0, 0, r * 0.8), (0, -0.25, 1), 0.5 + 0.5 * r, 0.32 + 0.1 * r, bone='claw.L', mat='horn', seg=5, rings=2)
        c, r = along(dac, [2.0, 1.35, 0.35], u + 0.04)
        L.horn(c - V(0, 0, r * 0.8), (0, -0.25, -1), 0.45 + 0.45 * r, 0.3 + 0.1 * r, bone='pincer.L', mat='horn', seg=5, rings=2)
    for (x, y) in ((6, -10), (8, -4), (8, 2), (6, 8), (3, -13)):
        top = on_surface(S, x, y)
        if top is None:
            continue
        nrm = normal_at(S, top)
        L.horn(top - nrm * 0.3, nrm + np.array([0.4, 0, 0]), 2.4, 0.8, bone=bone_at(S, top - nrm), mat='horn', seg=6, rings=3)
    shell = Sculpt()
    shell.prims = [q for q in S.prims if q.bone in ('chest', 'hips', 'head')]
    for y, ln in ((-12, 2.6), (-7, 3.2), (-2, 3.4), (3, 3.0), (8, 2.4)):
        q = shell.surface((30.0, y, BODY_Z + 2.6), (-1.0, 0.0, 0.0))
        if q is not None:
            L.horn(q - V(0.4, 0, 0), (1, -0.25, 0.25), ln, 0.9, bend=(0, -0.4, 0.5), bone=bone_at(S, q - V(1, 0, 0)), mat='horn', seg=6, rings=3)
    L.horn((1.4, -16.6, BODY_Z + 2.6), (0.2, -1, 0.25), 3.2, 0.8, bend=(0, 0, 0.6), bone='head', mat='horn', seg=6, rings=3)
    for i, (a, f) in enumerate(LEGS):
        k = V(*knee_of(a, f))
        a_ = V(*a)
        for u in (0.35, 0.7):
            c = a_ + (k - a_) * u + V(0, 0, 1.7 - 0.3 * u)
            L.horn(c, (0.3, 0, 1), 1.3, 0.45, bone=f'leg{i + 1}.L', mat='horn', seg=5, rings=2)
        L.horn(k + V(0.3, 0, 1.4), (0.2, 0, 1), 1.6, 0.55, bone=f'leg{i + 1}lo.L', mat='horn', seg=5, rings=2)
    L.sphere((3.6, -15.6, BODY_Z + 6.6), 0.75, bone='head', mat='eye')
    L.mirrored()
    P.merge(L)
    return P


HARD = [('claw.L', 'pincer.L'), ('claw.R', 'pincer.R'), ('head', 'jaw')]
WEIGHT_ITERS = 3

LOOK = dict(cell=0.6, wrinkle=3.0, scute=0.25, bump=0.22, cellvar=0.3, groove=0.45, wear=0.25,
            wearcol=(0.12, 0.16, 0.15), rough=0.36, cage=0.7, emit=(0.35, 1.0, 0.55), vein=0.2, veinw=0.03)

PART_MATS = {
    'horn': dict(color=(0.22, 0.12, 0.07), rough=0.3),
    'keratin': dict(color=(0.3, 0.2, 0.12), rough=0.35),
    'eye': dict(color=(0.5, 1.0, 0.6), rough=0.1, emissive=(0.45, 1.0, 0.6), emit=3.0),
}

# ============================================================================= animation

TAU = 2 * math.pi
TAILB = [f'tail{i + 1}' for i in range(6)]
WALK = dict(T=1.5, stride=9.0, duty=0.55)
RUN = dict(T=1.05, stride=12.0, duty=0.5)
FEET = {}
for i, (a, f) in enumerate(LEGS):
    for side, sx in (('L', 1), ('R', -1)):
        FEET[(i, side)] = (Vector((f[0] * sx, f[1], f[2])), Vector((a[0] * sx, a[1], a[2])))
# alternating tetrapods
GROUP = {(0, 'L'): 0, (1, 'R'): 0, (2, 'L'): 0, (3, 'R'): 0, (0, 'R'): 1, (1, 'L'): 1, (2, 'R'): 1, (3, 'L'): 1}


def leg(p, i, side, foot):
    f0, a = FEETP(i, side)
    sx = 1 if side == 'L' else -1
    pole = Vector((a.x + sx * 6, a.y, a.z + 40))
    p.ik(f'leg{i + 1}.{side}', f'leg{i + 1}lo.{side}', foot, pole)


def FEETP(i, side):
    return FEET[(i, side)]


def legs_rest(p, lift=None):
    for (i, side), (f, a) in FEET.items():
        off = Vector((0, 0, 0)) if lift is None else lift(i, side)
        leg(p, i, side, f + off)


def arms(p, side, up=0.0, out=0.0, fwd=0.0, open_=0.0, bend=0.0):
    sg = 1 if side == 'L' else -1
    p.rot('upperarm.' + side, x=-up * 0.6 - fwd, z=sg * out)
    p.rot('forearm.' + side, x=-up * 0.4 + bend)
    p.rot('claw.' + side, x=-fwd * 0.3)
    p.rot('pincer.' + side, x=-open_)


def gait(ph, p, G, bob, tailamp):
    for (i, side), (f, a) in FEET.items():
        g = GROUP[(i, side)]
        fw, h, sw = foot_cycle(ph + 0.5 * g + 0.04 * i, G['stride'], 3.2, G['duty'])
        leg(p, i, side, f + Vector((0, -fw, h)))
    c2 = math.cos(2 * TAU * ph)
    p.loc('hips', (0.3 * math.sin(TAU * ph), 0, -bob * 0.5 * (1 + c2)))
    p.rot('hips', y=1.5 * math.sin(TAU * ph))
    for s in ('L', 'R'):
        arms(p, s, up=6, out=0, open_=4 + 3 * math.sin(TAU * ph + (0 if s == 'L' else math.pi)))
    for i, b in enumerate(TAILB):
        p.rot(b, z=tailamp * 1.6 * math.sin(TAU * ph - 0.5 * i), x=0.8 * tailamp * math.cos(2 * TAU * ph - 0.4 * i))


def a_walk(t, T, p):
    gait(t / T, p, WALK, 0.4, 1.0)


def a_run(t, T, p):
    gait(t / T, p, RUN, 0.7, 1.5)


def a_idle(t, T, p):
    ph = t / T
    legs_rest(p)
    b = math.sin(TAU * 2 * ph)
    p.loc('hips', (0, 0, 0.2 * b))
    for s, o in (('L', 0), ('R', 1.4)):
        arms(p, s, up=6 + 2 * math.sin(TAU * ph + o), open_=6 + 6 * max(0, math.sin(TAU * 3 * ph + o)))
    p.rot('head', z=3 * math.sin(TAU * ph))
    p.rot('jaw', x=3 + 3 * max(0, math.sin(TAU * 4 * ph)))
    for i, bb in enumerate(TAILB):
        p.rot(bb, z=4 * math.sin(TAU * ph - 0.5 * i), x=1.5 * math.sin(TAU * 2 * ph - 0.4 * i))


def a_snap(t, T, p, side='R'):
    w = env(t, 0.0, 0.25, 0.28, 0.4)
    s = env(t, 0.3, 0.42, 0.52, T)
    legs_rest(p)
    sg = 1 if side == 'L' else -1
    p.loc('hips', (0, -1.5 * s, 0.6 * w))
    p.rot('chest', z=sg * (8 * w - 10 * s))
    arms(p, side, up=20 * w + 5 * s, out=-sg * 15 * w + sg * 10 * s, fwd=-15 * w + 35 * s, open_=38 * w * (1 - s), bend=-20 * w + 25 * s)
    o = 'L' if side == 'R' else 'R'
    arms(p, o, up=10, open_=10)
    p.rot('jaw', x=3 + 10 * s)


def a_snap_r(t, T, p):
    a_snap(t, T, p, 'R')


def a_shear(t, T, p):
    w = env(t, 0.0, 0.28, 0.32, 0.42)
    s = env(t, 0.32, 0.44, 0.55, T)
    legs_rest(p)
    p.loc('hips', (0, -2 * s, 0.8 * w))
    p.rot('hips', x=-6 * w + 4 * s)
    for side, sg in (('L', 1), ('R', -1)):
        arms(p, side, up=30 * w, out=sg * 25 * w - sg * 30 * s, fwd=20 * s, open_=40 * w * (1 - s), bend=-15 * w + 20 * s)


def a_sting(t, T, p):
    w = env(t, 0.0, 0.4, 0.45, 0.58)
    s = env(t, 0.5, 0.62, 0.75, T)
    legs_rest(p)
    p.loc('hips', (0, 1.5 * w - 2.5 * s, -1 * w))
    p.rot('hips', x=4 * w - 6 * s)
    # coil back, then the base whips forward while the tip straightens to drive the stinger over the head
    coil = (-12, -8, -4, 6, 8, 10)
    strike = (34, 26, 16, -2, -10, -16)
    for i, b in enumerate(TAILB):
        p.rot(b, x=coil[i] * w + strike[i] * s)
    for s_ in ('L', 'R'):
        arms(p, s_, up=8, out=(1 if s_ == 'L' else -1) * 10 * s, open_=8)


def a_pounce(t, T, p):
    crouch = env(t, 0.0, 0.25, 0.3, 0.42)
    air = env(t, 0.35, 0.5, 1.1, 1.25)
    land = env(t, 1.15, 1.25, 1.3, T)
    legs_rest(p, lambda i, side: Vector(((1 if side == 'L' else -1) * -4 * air, 0, 6 * air)))
    p.loc('hips', (0, 0, -3 * crouch + 2 * air - 2 * land))
    p.rot('hips', x=4 * crouch - 10 * air + 6 * land)
    for s in ('L', 'R'):
        arms(p, s, up=30 * air, out=(1 if s == 'L' else -1) * 20 * air, open_=30 * air)
    for i, b in enumerate(TAILB):
        p.rot(b, x=-5 * air + 3 * land)


def spray_pose(p, k, t=0.0):
    legs_rest(p, lambda i, side: Vector((0, 0, 0)))
    p.loc('hips', (0, 1.0 * k, 1.5 * k))
    p.rot('hips', x=-12 * k)
    p.rot('head', x=-6 * k)
    p.rot('jaw', x=3 + 30 * k)
    for s in ('L', 'R'):
        arms(p, s, up=25 * k, out=(1 if s == 'L' else -1) * 25 * k, open_=20 * k)
    for i, b in enumerate(TAILB):
        p.rot(b, x=3 * k)


def a_spray_in(t, T, p):
    spray_pose(p, smooth(t / T))


def a_spray_loop(t, T, p):
    spray_pose(p, 1.0)
    p.rot('head', z=4 * math.sin(TAU * t / T), x=0.8 * math.sin(TAU * 6 * t / T))


def a_spray_out(t, T, p):
    spray_pose(p, 1 - smooth(t / T))


def a_roar(t, T, p):
    r = env(t, 0.1, 0.6, 2.3, 2.9)
    vib = math.sin(TAU * 18 * t) * r
    legs_rest(p)
    p.loc('hips', (0, 1.5 * r, 2 * r))
    p.rot('hips', x=-14 * r)
    p.rot('jaw', x=3 + 28 * r + vib)
    for s in ('L', 'R'):
        clack = max(0.0, math.sin(TAU * 4 * t))
        arms(p, s, up=50 * r, out=(1 if s == 'L' else -1) * 35 * r, open_=45 * r * clack)
    for i, b in enumerate(TAILB):
        p.rot(b, x=-4 * r, z=2 * vib)


def a_hit(t, T, p):
    h = env(t, 0.0, 0.08, 0.15, T)
    legs_rest(p)
    p.loc('hips', (0, 1.2 * h, -0.6 * h))
    p.rot('hips', y=-5 * h)
    for s in ('L', 'R'):
        arms(p, s, up=-8 * h, open_=15 * h)


def a_death(t, T, p):
    f = smooth((t - 0.5) / 1.6)
    curl = smooth((t - 1.0) / 1.8)
    legs_rest(p, lambda i, side: Vector((0, 0, 8 * curl)))
    p.loc('hips', (0, 0, -6 * f))
    p.rot('hips', y=10 * f)
    for s in ('L', 'R'):
        arms(p, s, up=-20 * f, open_=30 * f)
    droop = (-10, -12, -14, -10, -8, -6)
    for i, b in enumerate(TAILB):
        p.rot(b, x=droop[i] * f)


ANIMS = {
    'idle': (a_idle, 4.0, True),
    'walk': (a_walk, WALK['T'], True),
    'run': (a_run, RUN['T'], True),
    'attack1': (a_snap_r, 1.0, False),
    'attack2': (a_shear, 1.1, False),
    'heavy': (a_sting, 1.5, False),
    'stomp': (a_pounce, 1.5, False),
    'roar': (a_roar, 3.0, False),
    'special_in': (a_spray_in, 0.8, False),
    'special_loop': (a_spray_loop, 1.0, True),
    'special_out': (a_spray_out, 0.6, False),
    'hit': (a_hit, 0.6, False),
    'death': (a_death, 3.0, False),
}

META = dict(
    height=34.0,
    preview_angle=40,
    close=(0, -14, 14, 34),
    speed=dict(walk=WALK['stride'] / (WALK['duty'] * WALK['T']), run=RUN['stride'] / (RUN['duty'] * RUN['T'])),
    cycle=dict(walk=WALK['stride'] / WALK['duty'], run=RUN['stride'] / RUN['duty']),
    hits=dict(attack1=0.42, attack2=0.48, heavy=0.64, stomp=1.25),
    feet=['foot2L', 'foot2R'],
    foot_phase=dict(walk=[0.54, 0.04], run=[0.54, 0.04]),
    body=[['hips', 'head', 12.0], ['upperarmL', 'clawL', 4.0], ['upperarmR', 'clawR', 4.0], ['tail1', 'tail4', 4.5], ['tail4', 'tail6', 3.0],
          ['leg1L', 'foot1L', 2.0], ['leg1R', 'foot1R', 2.0], ['leg4L', 'foot4L', 2.0], ['leg4R', 'foot4R', 2.0]],
    aim=dict(head='head', chain=['head'], pitch0=0.0),  # front legs hang off the chest: aim with the head alone
    mouth='mouth',
)
