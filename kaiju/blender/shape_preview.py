"""Fast look-dev loop: sculpt a creature at coarse resolution and render a Cycles still.
usage: python shape_preview.py <kaiju> <out.png> [voxel] [angle]"""
import sys, os, time, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
import butil
from sdf import polygonise

name, out = sys.argv[1], sys.argv[2]
voxel = float(sys.argv[3]) if len(sys.argv) > 3 else 0.45
angle = float(sys.argv[4]) if len(sys.argv) > 4 else 35
spec = importlib.import_module('k_' + name)
butil.reset()
t0 = time.time()
S = spec.sculpt()
D, lo = S.eval_grid(voxel, noise=spec.noise)
V, F = polygonise(D, lo, voxel)
print(f'mc {len(V)} verts {len(F)} tris in {time.time() - t0:.1f}s')
ob = butil.make_mesh('Body', V, F)
butil.shade_smooth(ob)
m = bpy.data.materials.new('B')
b = m.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.06, 0.06, 0.065, 1)
b.inputs['Roughness'].default_value = 0.75
ob.data.materials.append(m)
P = spec.parts(S)
po = butil.make_mesh('Parts', P.verts, P.faces)
for mname in P.mats:
    mm = bpy.data.materials.new(mname)
    bb = mm.node_tree.nodes['Principled BSDF']
    d = spec.PART_MATS[mname]
    bb.inputs['Base Color'].default_value = (*d['color'], 1)
    bb.inputs['Roughness'].default_value = d['rough']
    po.data.materials.append(mm)
po.data.polygons.foreach_set('material_index', np.array(P.fmat, np.int32))
lo_, hi_ = V.min(0), V.max(0)
c = (lo_ + hi_) / 2
size = (hi_ - lo_).max()
butil.preview(out, (c[0], c[1], c[2]), size * 1.9, c[2] + size * 0.12, angle=angle, samples=24, target_z=c[2], lens=40)
print('done', time.time() - t0)
