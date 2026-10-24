"""Builds one kaiju end to end and writes kaiju/assets/<name>.glb + <name>.json.

usage: python build.py <name> [--fast] [--preview out.png] [--tex 2048] [--noanim]

Stages: sculpt (SDF) -> marching cubes high-poly -> vertex colours/masks ->
decimated low-poly -> skin weights -> UVs -> Cycles bakes (normal, albedo,
roughness, AO) -> materials -> parts -> armature -> baked animations -> GLB.
"""
import sys, os, time, json, math, importlib, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import bpy
from mathutils import Vector
import butil, rig
from sdf import polygonise

ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)


# ----------------------------------------------------------------------------- masks / weights

def material_weights(S, P, tau=0.9):
    d, adds = S.nearest(P)
    dm = d.min(1, keepdims=True)
    w = np.exp(-(d - dm) / tau)
    w /= w.sum(1, keepdims=True)
    mats = {}
    for j, p in enumerate(adds):
        mats[p.mat] = mats.get(p.mat, 0) + w[:, j]
    for p in S.prims:
        if p.op == 'sub' and p.mat != 'skin':
            ds = np.abs(p.dist(P))
            mats[p.mat] = np.maximum(mats.get(p.mat, 0), np.clip(1 - ds / 0.55, 0, 1))
    return mats


def skin_weights(S, ob, bones, hard_pairs=(), iters=10):
    P = butil.vert_array(ob)
    d, adds = S.nearest(P)
    bone_of = np.array([bones.index(p.bone) if p.bone in bones else -1 for p in adds])
    d = np.where(bone_of[None] >= 0, d, 1e9)
    nearest = bone_of[np.argmin(d, 1)]
    n, nb = len(P), len(bones)
    W = np.zeros((n, nb), np.float32)
    W[np.arange(n), nearest] = 1
    E = butil.edges(ob)
    a, b = nearest[E[:, 0]], nearest[E[:, 1]]
    keep = np.ones(len(E), bool)
    for x, y in hard_pairs:
        ix, iy = bones.index(x), bones.index(y)
        keep &= ~(((a == ix) & (b == iy)) | ((a == iy) & (b == ix)))
    E = E[keep]
    from scipy.sparse import coo_matrix, diags
    A = coo_matrix((np.ones(2 * len(E)), (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n)).tocsr()
    deg = np.asarray(A.sum(1)).ravel()
    An = diags(1.0 / np.maximum(deg, 1)) @ A
    for _ in range(iters):
        W = 0.5 * W + 0.5 * (An @ W)
    # top 4, normalised
    idx = np.argsort(-W, 1)[:, :4]
    top = np.take_along_axis(W, idx, 1)
    top[top < 0.02] = 0
    top /= np.maximum(top.sum(1, keepdims=True), 1e-9)
    for name in bones:
        if name not in ob.vertex_groups:
            ob.vertex_groups.new(name=name)
    groups = {}
    for i in range(n):
        for k in range(4):
            if top[i, k] > 0:
                groups.setdefault(idx[i, k], ([], []))
                groups[idx[i, k]][0].append(i)
                groups[idx[i, k]][1].append(float(top[i, k]))
    for bi, (vs, ws) in groups.items():
        vg = ob.vertex_groups[bones[bi]]
        # group vertices by identical weight to cut API calls
        order = np.argsort(ws)
        ws_s = np.array(ws)[order]
        vs_s = np.array(vs)[order]
        q = np.round(ws_s, 3)
        cuts = np.nonzero(np.diff(q))[0] + 1
        for seg_v, seg_w in zip(np.split(vs_s, cuts), np.split(q, cuts)):
            vg.add(seg_v.tolist(), float(seg_w[0]), 'REPLACE')
    return nearest


# ----------------------------------------------------------------------------- materials

def node(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def hi_material(spec):
    """Procedural look-dev material on the high-poly, used only as a bake source."""
    m = bpy.data.materials.new('HiSkin')
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (1200, 0))
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (900, 0))
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    tc = node(nt, 'ShaderNodeTexCoord', (-1200, 0))
    col = node(nt, 'ShaderNodeAttribute', (-400, 300))
    col.attribute_name = 'Col'
    mask = node(nt, 'ShaderNodeAttribute', (-1200, -500))
    mask.attribute_name = 'Mask'
    sep = node(nt, 'ShaderNodeSeparateColor', (-1000, -500))
    nt.links.new(mask.outputs['Color'], sep.inputs[0])
    L = spec.LOOK
    # crag cells: voronoi distance-to-edge gives raised scales separated by grooves
    vor = node(nt, 'ShaderNodeTexVoronoi', (-900, 200))
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = L['cell']
    vor.inputs['Randomness'].default_value = 1.0
    nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
    vorc = node(nt, 'ShaderNodeTexVoronoi', (-900, 450))
    vorc.inputs['Scale'].default_value = L['cell']
    nt.links.new(tc.outputs['Object'], vorc.inputs['Vector'])
    vor2 = node(nt, 'ShaderNodeTexVoronoi', (-900, -50))
    vor2.feature = 'DISTANCE_TO_EDGE'
    vor2.inputs['Scale'].default_value = L['cell'] * 3.1
    nt.links.new(tc.outputs['Object'], vor2.inputs['Vector'])
    noi = node(nt, 'ShaderNodeTexNoise', (-900, -300))
    noi.inputs['Scale'].default_value = L['wrinkle']
    noi.inputs['Detail'].default_value = 8
    noi.inputs['Roughness'].default_value = 0.62
    nt.links.new(tc.outputs['Object'], noi.inputs['Vector'])
    # belly scutes: horizontal bands
    wave = node(nt, 'ShaderNodeTexWave', (-900, -700))
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = L['scute']
    wave.inputs['Distortion'].default_value = 1.2
    wave.inputs['Detail'].default_value = 2
    nt.links.new(tc.outputs['Object'], wave.inputs['Vector'])

    def math_node(op, a, b=None, loc=(0, 0), clamp=False, c=None):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        n.location = loc
        n.use_clamp = clamp
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    crag = math_node('SMOOTH_MIN', vor.outputs['Distance'], 0.12, (-650, 200))
    crag = math_node('MULTIPLY', crag, 1 / 0.12, (-500, 200), clamp=True)
    crag2 = math_node('MULTIPLY', vor2.outputs['Distance'], 1 / 0.1, (-650, -50), clamp=True)
    back_h = math_node('ADD', math_node('MULTIPLY', crag, 0.75, (-350, 200)),
                       math_node('MULTIPLY', crag2, 0.25, (-350, 0)), (-200, 100))
    back_h = math_node('ADD', back_h, math_node('MULTIPLY', noi.outputs['Fac'], 0.35, (-350, -250)), (-50, 100))
    belly_h = math_node('ADD', math_node('MULTIPLY', wave.outputs['Fac'], 0.7, (-500, -700)),
                        math_node('MULTIPLY', noi.outputs['Fac'], 0.3, (-500, -850)), (-300, -700))
    mixh = nt.nodes.new('ShaderNodeMix')
    mixh.data_type = 'FLOAT'
    mixh.location = (100, -200)
    nt.links.new(sep.outputs[0], mixh.inputs['Factor'])
    nt.links.new(back_h, mixh.inputs['A'])
    nt.links.new(belly_h, mixh.inputs['B'])
    # mouth interior is smooth
    hm = math_node('MULTIPLY', mixh.outputs['Result'], math_node('SUBTRACT', 1.0, sep.outputs[2], (0, -400)), (250, -250))
    disp = node(nt, 'ShaderNodeDisplacement', (900, -350))
    disp.inputs['Midlevel'].default_value = 0.5
    disp.inputs['Scale'].default_value = L['bump']
    nt.links.new(hm, disp.inputs['Height'])
    nt.links.new(disp.outputs[0], out.inputs['Displacement'])
    m.displacement_method = 'BUMP'
    # colour: base * cell variation * groove darkening
    hsv = node(nt, 'ShaderNodeHueSaturation', (-200, 450))
    hsv.inputs['Value'].default_value = 1.0
    nt.links.new(col.outputs['Color'], hsv.inputs['Color'])
    vvar = math_node('MULTIPLY_ADD', vorc.outputs['Distance'], L['cellvar'], (-500, 500), c=1 - L['cellvar'] * 0.5)
    groove = math_node('ADD', math_node('MULTIPLY', crag, L['groove'], (-200, 250)), 1 - L['groove'], (0, 250))
    shade = math_node('MULTIPLY', vvar, groove, (150, 400))
    cm = nt.nodes.new('ShaderNodeMix')
    cm.data_type = 'RGBA'
    cm.blend_type = 'MULTIPLY'
    cm.location = (350, 350)
    cm.inputs['Factor'].default_value = 1.0
    nt.links.new(hsv.outputs[0], cm.inputs['A'])
    comb = node(nt, 'ShaderNodeCombineColor', (200, 200))
    for i in range(3):
        nt.links.new(shade, comb.inputs[i])
    nt.links.new(comb.outputs[0], cm.inputs['B'])
    # tips of crags catch a little dust / wear
    wear = math_node('POWER', crag, 6.0, (200, 600))
    wm = nt.nodes.new('ShaderNodeMix')
    wm.data_type = 'RGBA'
    wm.location = (600, 350)
    nt.links.new(math_node('MULTIPLY', wear, L['wear'], (400, 600)), wm.inputs['Factor'])
    nt.links.new(cm.outputs['Result'], wm.inputs['A'])
    wm.inputs['B'].default_value = (*L['wearcol'], 1)
    nt.links.new(wm.outputs['Result'], bsdf.inputs['Base Color'])
    # roughness: grooves rough, crag tops a bit smoother, mouth wet
    r = math_node('MULTIPLY_ADD', crag, -0.18, (400, -100), c=L['rough'] + 0.12)
    r = math_node('ADD', r, math_node('MULTIPLY', noi.outputs['Fac'], 0.12, (250, -150)), (550, -100))
    rm = nt.nodes.new('ShaderNodeMix')
    rm.data_type = 'FLOAT'
    rm.location = (700, -100)
    nt.links.new(sep.outputs[2], rm.inputs['Factor'])
    nt.links.new(r, rm.inputs['A'])
    rm.inputs['B'].default_value = 0.28
    nt.links.new(rm.outputs['Result'], bsdf.inputs['Roughness'])
    if L.get('emit'):
        # emissive veins in deep grooves (masked by the Mask.G channel)
        ve = math_node('MULTIPLY', math_node('SUBTRACT', 1.0, crag2, (300, -500)), sep.outputs[1], (450, -500))
        ve = math_node('POWER', ve, 2.0, (600, -500))
        nt.links.new(ve, bsdf.inputs['Emission Strength'])
        bsdf.inputs['Emission Color'].default_value = (*L['emit'], 1)
    return m


def gltf_output_group():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    g.interface.new_socket('Thickness', in_out='INPUT', socket_type='NodeSocketFloat')
    return g


def low_material(name, albedo, normal, orm, emissive=None):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (500, 0))
    nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    ta = nt.nodes.new('ShaderNodeTexImage')
    ta.image = albedo
    ta.location = (0, 300)
    nt.links.new(ta.outputs['Color'], bsdf.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = normal
    tn.location = (-200, -300)
    nm = node(nt, 'ShaderNodeNormalMap', (200, -300))
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    to = nt.nodes.new('ShaderNodeTexImage')
    to.image = orm
    to.location = (-200, 0)
    sep = node(nt, 'ShaderNodeSeparateColor', (100, 0))
    nt.links.new(to.outputs['Color'], sep.inputs[0])
    nt.links.new(sep.outputs[1], bsdf.inputs['Roughness'])
    nt.links.new(sep.outputs[2], bsdf.inputs['Metallic'])
    grp = nt.nodes.new('ShaderNodeGroup')
    grp.node_tree = gltf_output_group()
    grp.location = (500, -400)
    nt.links.new(sep.outputs[0], grp.inputs['Occlusion'])
    if emissive is not None:
        te = nt.nodes.new('ShaderNodeTexImage')
        te.image = emissive
        te.location = (0, 600)
        nt.links.new(te.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return m


def part_material(name, d):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    vc = nt.nodes.new('ShaderNodeVertexColor')
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs['A'].default_value = (*d['color'], 1)
    nt.links.new(vc.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = d['rough']
    if d.get('emissive'):
        bsdf.inputs['Emission Color'].default_value = (*d['emissive'], 1)
        bsdf.inputs['Emission Strength'].default_value = d.get('emit', 0.0)
    return m


# ----------------------------------------------------------------------------- baking

def new_image(name, size, color=True, alpha=False):
    im = bpy.data.images.new(name, size, size, alpha=alpha, float_buffer=False)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return im


def bake(kind, low, high, image, samples, extrusion, ray, pass_filter=None, margin=8):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    mat = low.data.materials[0]
    nt = mat.node_tree
    tgt = nt.nodes.get('_bake') or nt.nodes.new('ShaderNodeTexImage')
    tgt.name = '_bake'
    tgt.image = image
    for nd in nt.nodes:
        nd.select = False
    tgt.select = True
    nt.nodes.active = tgt
    butil.activate(low, [high])
    kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=extrusion, max_ray_distance=ray,
              margin=margin, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
    if kind == 'NORMAL':
        kw.update(normal_space='TANGENT')
    if pass_filter:
        kw['pass_filter'] = pass_filter
    t = time.time()
    bpy.ops.object.bake(**kw)
    log(f'  baked {kind} {image.size[0]}px in {time.time() - t:.1f}s')


def pixels(im):
    a = np.empty(im.size[0] * im.size[1] * 4, np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(im.size[1], im.size[0], 4)


def set_pixels(im, a):
    im.pixels.foreach_set(a.astype(np.float32).ravel())
    im.update()


def resample(a, size):
    h = a.shape[0]
    if h == size:
        return a
    f = h // size
    return a.reshape(size, f, size, f, a.shape[2]).mean((1, 3))


# ----------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name')
    ap.add_argument('--fast', action='store_true')
    ap.add_argument('--preview', default=None)
    ap.add_argument('--tex', type=int, default=2048)
    ap.add_argument('--noanim', action='store_true')
    ap.add_argument('--pose', default=None, help='clip:frame to show in the preview')
    ap.add_argument('--sheet', default=None, help='comma-separated clips to render as contact sheets')
    ap.add_argument('--sheetdir', default='/tmp')
    ap.add_argument('--close', default=None, help='close-up still path')
    ap.add_argument('--metaonly', action='store_true', help='rewrite <name>.json and exit')
    args = ap.parse_args(sys.argv[1:])
    spec = importlib.import_module('k_' + args.name)
    if args.metaonly:
        meta = dict(name=args.name, **spec.META)
        meta['clips'] = {k: dict(duration=v[1], loop=v[2]) for k, v in spec.ANIMS.items()}
        with open(os.path.join(ASSETS, f'{args.name}.json'), 'w') as f:
            json.dump(meta, f, indent=1)
        log('meta written')
        return
    sc = butil.reset()
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    voxel = spec.VOXEL * (1.8 if args.fast else 1.0)
    tex = 512 if args.fast else args.tex

    log('sculpt', args.name)
    S = spec.sculpt()
    D, lo = S.eval_grid(voxel, noise=spec.noise, log=log)
    V, F = polygonise(D, lo, voxel)
    del D
    log(f'high-poly {len(V)} verts {len(F)} tris')
    high = butil.make_mesh('High', V, F)
    butil.shade_smooth(high)
    sm = butil.smooth_mod(high, 0.5, 1)
    hi2 = butil.applied_copy(high, 'HighS')
    bpy.data.objects.remove(high)
    high = hi2
    butil.shade_smooth(high)

    # colour + masks on the high-poly
    HP = butil.vert_array(high)
    HN = butil.vert_normals(high)
    mats = material_weights(S, HP)
    col, mask = spec.body_color(HP, HN, mats)
    butil.set_point_color(high, 'Col', np.c_[col, np.ones(len(col))])
    butil.set_point_color(high, 'Mask', mask)
    high.data.materials.append(hi_material(spec))
    log('colours + masks')

    low = butil.decimate(high, spec.LOW_TRIS // (3 if args.fast else 1), 'Body')
    butil.shade_smooth(low)
    for a in list(low.data.color_attributes):
        low.data.color_attributes.remove(a)
    log(f'low-poly {len(low.data.vertices)} verts {len(low.data.polygons)} tris')

    # UVs
    butil.activate(low)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70), island_margin=0.004, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    log('uv unwrap')

    # bakes
    bm = bpy.data.materials.new('BakeTarget')
    low.data.materials.clear()
    low.data.materials.append(bm)
    ext = spec.LOOK.get('cage', 0.9)
    im_n = new_image(f'{args.name}_n', tex, color=False)
    bake('NORMAL', low, high, im_n, 4 if not args.fast else 1, ext, ext * 2.2)
    im_c = new_image(f'{args.name}_c', tex)
    bake('DIFFUSE', low, high, im_c, 4 if not args.fast else 1, ext, ext * 2.2, pass_filter={'COLOR'})
    im_r = new_image(f'{args.name}_r', tex, color=False)
    bake('ROUGHNESS', low, high, im_r, 4 if not args.fast else 1, ext, ext * 2.2)
    im_ao = new_image(f'{args.name}_ao', tex, color=False)
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_shadow', 'visible_transmission'):
        setattr(low, k, False)
    sc.world = sc.world or bpy.data.worlds.new('W')
    bake('AO', low, high, im_ao, 32 if not args.fast else 4, ext, ext * 2.2)
    for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_shadow', 'visible_transmission'):
        setattr(low, k, True)
    im_e = None
    if spec.LOOK.get('emit'):
        im_e = new_image(f'{args.name}_e', tex)
        bake('EMIT', low, high, im_e, 4 if not args.fast else 1, ext, ext * 2.2)

    # pack: albedo gets a touch of AO; ORM = (AO, rough, 0) at half resolution
    ao = pixels(im_ao)[..., 0]
    c = pixels(im_c)
    c[..., :3] *= (0.55 + 0.45 * ao)[..., None]
    set_pixels(im_c, c)
    orm_size = tex // 2
    orm_px = np.ones((tex, tex, 4), np.float32)
    orm_px[..., 0] = ao
    orm_px[..., 1] = pixels(im_r)[..., 0]
    orm_px[..., 2] = 0.0
    im_orm = new_image(f'{args.name}_orm', orm_size, color=False)
    set_pixels(im_orm, resample(orm_px, orm_size))
    low.data.materials.clear()
    low.data.materials.append(low_material(f'{args.name}_skin', im_c, im_n, im_orm, im_e))
    for im in (im_c, im_n, im_orm) + ((im_e,) if im_e else ()):
        im.pack()
    bpy.data.objects.remove(high)
    log('materials')

    # parts
    P = spec.parts(S)
    parts = butil.make_mesh('Parts', P.verts, P.faces)
    butil.shade_smooth(parts)
    for mname in P.mats:
        parts.data.materials.append(part_material(f'{args.name}_{mname}', spec.PART_MATS[mname]))
    parts.data.polygons.foreach_set('material_index', np.array(P.fmat, np.int32))
    butil.set_point_color(parts, 'Col', np.array(P.vcol, np.float32))
    # parts that need flat facets
    log(f'parts {len(P.verts)} verts')

    # rig
    skel = spec.skeleton()
    arm = rig.build_armature(skel, 'Armature')
    bones = [b.name for b in arm.data.bones]
    skin_weights(S, low, bones, getattr(spec, 'HARD', ()), iters=getattr(spec, 'WEIGHT_ITERS', 10))
    for name in bones:
        if name not in parts.vertex_groups:
            parts.vertex_groups.new(name=name)
    vb = np.array(P.vbone)
    for name in set(P.vbone):
        parts.vertex_groups[name].add(np.nonzero(vb == name)[0].tolist(), 1.0, 'REPLACE')
    for ob in (low, parts):
        ob.parent = arm
        m = ob.modifiers.new('Armature', 'ARMATURE')
        m.object = arm
    log('skinned')

    meta = dict(name=args.name, **spec.META)
    if not args.noanim:
        solver = rig.Solver(arm)
        for clip, (fn, dur, loop) in spec.ANIMS.items():
            rig.bake_action(arm, solver, clip, fn, dur, loop=loop)
        log(f'animations: {", ".join(spec.ANIMS)}')
        meta['clips'] = {k: dict(duration=v[1], loop=v[2]) for k, v in spec.ANIMS.items()}

    os.makedirs(ASSETS, exist_ok=True)
    out = os.path.join(ASSETS, f'{args.name}.glb')
    butil.activate(arm, [low, parts])
    opts = dict(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                export_animations=not args.noanim, export_skins=True, export_def_bones=True,
                export_image_format='WEBP', export_image_quality=88, export_animation_mode='NLA_TRACKS',
                export_force_sampling=True, export_optimize_animation_size=True, export_vertex_color='ACTIVE',
                export_all_vertex_colors=False, export_tangents=False, export_morph=False,
                export_extras=False, export_cameras=False, export_lights=False)
    valid = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    dropped = [k for k in opts if k not in valid]
    if dropped:
        log('exporter lacks options:', dropped)
    bpy.ops.export_scene.gltf(**{k: v for k, v in opts.items() if k in valid})
    with open(os.path.join(ASSETS, f'{args.name}.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    log(f'wrote {out} ({os.path.getsize(out) / 1e6:.2f} MB)')

    if args.preview:
        if args.pose and not args.noanim:
            clip, fr = args.pose.split(':')
            arm.animation_data.action = bpy.data.actions[clip]
            sc.frame_set(int(fr))
        V2 = butil.vert_array(low)
        lo_, hi_ = V2.min(0), V2.max(0)
        c = (lo_ + hi_) / 2
        size = (hi_ - lo_).max()
        butil.preview(args.preview, (c[0], c[1], c[2]), size * 1.6, c[2] + size * 0.1, angle=spec.META.get('preview_angle', 40),
                      samples=32, target_z=c[2], lens=40)
        log('preview', args.preview)

    if args.close:
        sc.frame_set(1)
        hx = spec.META.get('close', (0, 0, 40, 30))
        butil.preview(args.close, hx[:3], hx[3], hx[2] + hx[3] * 0.25, angle=30, samples=48, target_z=hx[2], lens=50,
                      size=(1200, 800))
        log('close-up', args.close)

    if args.sheet:
        import subprocess
        V2 = butil.vert_array(low)
        lo_, hi_ = V2.min(0), V2.max(0)
        c = (lo_ + hi_) / 2
        size = (hi_ - lo_).max()
        for clip in args.sheet.split(','):
            act = bpy.data.actions[clip]
            arm.animation_data.action = act
            n = int(round(spec.ANIMS[clip][1] * 30))
            frames = [1 + round(i * n / 7) for i in range(8)]
            for i, fr in enumerate(frames):
                sc.frame_set(fr)
                butil.preview(os.path.join(args.sheetdir, f'_s{i}.png'), (c[0], c[1], c[2]), size * 1.7,
                              c[2] + size * 0.1, angle=spec.META.get('sheet_angle', 60), samples=6,
                              target_z=c[2], lens=40, size=(400, 300))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(args.sheetdir, '_s%d.png'),
                            '-filter_complex', 'tile=4x2', os.path.join(args.sheetdir, f'sheet_{clip}.png')], check=True)
            log('sheet', clip, frames)


if __name__ == '__main__':
    main()
