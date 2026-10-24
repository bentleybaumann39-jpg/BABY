"""Shared animation building blocks for multi-legged creatures: a limb with two-bone IK,
an optional foot/hand aimed in armature space and an optional toe; a gait sampler that
moves each limb's contact point through stance and swing with its own phase."""
import math
from mathutils import Vector
from rig import smooth, foot_cycle

TAU = 2 * math.pi


class Limb:
    def __init__(self, upper, lower, end, contact, end_dir, pole, toe=None, toe_dir=None, end_len=None):
        """contact: rest ground contact point (end of `end` bone); end_dir: rest direction of the
        end bone (unit, armature space); pole: knee/elbow pole target (armature space)."""
        self.upper, self.lower, self.end, self.toe = upper, lower, end, toe
        self.contact = Vector(contact)
        self.end_dir = Vector(end_dir).normalized()
        self.pole = Vector(pole)
        self.toe_dir = Vector(toe_dir).normalized() if toe_dir else None
        self.end_len = end_len

    def pitch(self):
        d = self.end_dir
        return math.degrees(math.atan2(-d.z, math.hypot(d.x, d.y)))

    def place(self, p, contact, pitch=None, toe_pitch=None, pole_shift=(0, 0, 0)):
        """Put the end bone's tip at `contact`, end bone pitched `pitch` degrees below horizontal
        (keeping its rest heading), knee toward the pole."""
        d0 = self.end_dir
        h = Vector((d0.x, d0.y, 0))
        if h.length < 1e-4:
            h = Vector((0, -1, 0))
        h.normalize()
        a = math.radians(self.pitch() if pitch is None else pitch)
        d = (h * math.cos(a) - Vector((0, 0, 1)) * math.sin(a)).normalized()
        joint = Vector(contact) - d * self.end_len
        p.ik(self.upper, self.lower, joint, self.pole + Vector(pole_shift))
        p.aim(self.end, d)
        if self.toe and self.toe_dir is not None:
            ta = math.radians(toe_pitch if toe_pitch is not None else math.degrees(math.atan2(-self.toe_dir.z, math.hypot(self.toe_dir.x, self.toe_dir.y))))
            th = Vector((self.toe_dir.x, self.toe_dir.y, 0)).normalized()
            p.aim(self.toe, (th * math.cos(ta) - Vector((0, 0, 1)) * math.sin(ta)).normalized())

    def rest(self, p, offset=(0, 0, 0)):
        self.place(p, self.contact + Vector(offset))


def gait_limb(limb, p, phase, stride, lift, duty, heel=30.0, swing_pitch=14.0, forward=Vector((0, -1, 0)), extra=(0, 0, 0)):
    """Moves one limb through a gait cycle; returns its swing amount (0 in stance)."""
    f, h, sw = foot_cycle(phase, stride, lift, duty)
    sp = phase % 1.0
    base = limb.pitch()
    if sp < duty:
        k = smooth((sp / duty - 0.7) / 0.3)
        pitch = base + heel * k
    else:
        pitch = base + heel * (1 - smooth(sw * 1.4)) + swing_pitch * math.sin(math.pi * sw)
    c = limb.contact + forward * f + Vector((0, 0, h)) + Vector(extra)
    limb.place(p, c, pitch)
    return sw if sp >= duty else 0.0
