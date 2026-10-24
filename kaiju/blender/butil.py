"""Small bpy helpers shared by the kaiju and prop builders."""
import math
import bpy
import numpy as np
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.unit_settings.system = 'METRIC'
    return sc


def make_mesh(name, verts, faces, link=True):
    verts = np.asarray(verts, np.float32)
    faces = [tuple(f) for f in faces]
    me = bpy.data.meshes.new(name)
    tri = all(len(f) == 3 for f in faces)
    if tri:
        F = np.asarray(faces, np.int32)
        me.vertices.add(len(verts))
        me.vertices.foreach_set('co', verts.ravel())
        me.loops.add(F.size)
        me.loops.foreach_set('vertex_index', F.ravel())
        me.polygons.add(len(F))
        me.polygons.foreach_set('loop_start', np.arange(0, F.size, 3, dtype=np.int32))
    else:
        me.from_pydata(verts.tolist(), [], faces)
    me.update(calc_edges=True)
    me.validate(clean_customdata=False)
    ob = bpy.data.objects.new(name, me)
    if link:
        bpy.context.scene.collection.objects.link(ob)
    return ob


def shade_smooth(ob):
    ob.data.shade_smooth()


def activate(ob, others=()):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in others:
        o.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def applied_copy(ob, name):
    """New object holding ob's evaluated (modifier-applied) mesh."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    me.name = name
    o2 = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o2)
    o2.matrix_world = ob.matrix_world.copy()
    return o2


def decimate(ob, target_tris, name):
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.ratio = min(1.0, target_tris / max(n, 1))
    m.use_collapse_triangulate = True
    out = applied_copy(ob, name)
    ob.modifiers.remove(m)
    return out


def smooth_mod(ob, factor=0.5, iters=2):
    m = ob.modifiers.new('sm', 'SMOOTH')
    m.factor, m.iterations = factor, iters
    return m


def vert_array(ob):
    me = ob.data
    v = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', v)
    return v.reshape(-1, 3).astype(np.float64)


def face_array(ob):
    me = ob.data
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get('vertices', t)
    return t.reshape(-1, 3)


def vert_normals(ob):
    me = ob.data
    n = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('normal', n)
    return n.reshape(-1, 3)


def set_point_color(ob, name, rgba):
    me = ob.data
    if name in me.color_attributes:
        me.color_attributes.remove(me.color_attributes[name])
    a = me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    a.data.foreach_set('color', np.asarray(rgba, np.float32).ravel())
    return a


def edges(ob):
    me = ob.data
    e = np.empty(len(me.edges) * 2, np.int32)
    me.edges.foreach_get('vertices', e)
    return e.reshape(-1, 2)


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def preview(path, objs_center, dist, height, size=(960, 640), samples=48, angle=35, lens=50, sun=(50, 0, 140),
            target_z=None, extra=None):
    """Cycles still of the current scene from a 3/4 front view."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.get('PW') or bpy.data.worlds.new('PW')
    sc.world = world
    wt = world.node_tree
    bg = wt.nodes.get('Background') or wt.nodes.new('ShaderNodeBackground')
    bg.inputs[0].default_value = (0.55, 0.62, 0.75, 1)
    bg.inputs[1].default_value = 0.9
    out = wt.nodes.get('World Output') or wt.nodes.new('ShaderNodeOutputWorld')
    wt.links.new(bg.outputs[0], out.inputs[0])
    for o in [o for o in sc.objects if o.name.startswith('_pv')]:
        bpy.data.objects.remove(o)
    cx, cy, cz = objs_center
    tz = target_z if target_z is not None else cz
    a = math.radians(angle)
    cam_d = bpy.data.cameras.new('_pvcam')
    cam_d.lens = lens
    cam_d.clip_end = 5000
    cam = bpy.data.objects.new('_pvcam', cam_d)
    sc.collection.objects.link(cam)
    cam.location = (cx + dist * math.sin(a), cy - dist * math.cos(a), height)
    look_at(cam, (cx, cy, tz))
    sc.camera = cam
    ld = bpy.data.lights.new('_pvsun', 'SUN')
    ld.energy = 4.0
    ld.angle = math.radians(2)
    ld.color = (1.0, 0.93, 0.85)
    ls = bpy.data.objects.new('_pvsun', ld)
    ls.rotation_euler = tuple(math.radians(x) for x in sun)
    sc.collection.objects.link(ls)
    if 'Ground' not in bpy.data.objects:
        bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0))
        g = bpy.context.active_object
        g.name = 'Ground'
        gm = bpy.data.materials.new('GroundM')
        bsdf = gm.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (0.18, 0.18, 0.17, 1)
        bsdf.inputs['Roughness'].default_value = 0.9
        g.data.materials.append(gm)
    if extra:
        extra(sc)
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
